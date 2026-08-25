/**
 * Loader for generated assets.
 *
 * Every asset in this system is a JavaScript module exporting a function of
 * THREE that returns a Group. This file turns one of those into something you
 * can place in a game: correctly scaled, sitting on the ground, and collapsed
 * to as few draw calls as the materials allow.
 *
 * COPY THIS FILE. Do not write your own.
 *
 * That is not stylistic advice. Each rule below is here because writing a
 * reasonable-looking loader without it silently destroyed a whole asset pack,
 * and the damage does not throw, does not warn, and does not show up until you
 * look at a screenshot and wonder why everything is a blob.
 *
 *  - An InstancedMesh is also an isMesh. Treat it as a plain mesh and you keep
 *    exactly one copy and delete the rest. A barrel built from instanced staves
 *    arrives as a smooth egg. See expandInstances below.
 *  - Merge by material VALUES, not identity. Generated assets build a fresh
 *    material object per part, so identity-merging merges nothing and a single
 *    prop arrives as forty draw calls.
 *  - Bucket by attribute signature too. Mixing geometry that carries a colour
 *    attribute with geometry that does not makes the merge drop colour, and a
 *    material with vertexColors renders the result black.
 *  - Scale by HEIGHT, never by fitting a bounding box. Fitting the smallest of
 *    three ratios silently halves anything whose proportions differ from what
 *    the caller assumed.
 */
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { applySurfaces } from './surfaces.js';

const cache = new Map();   // url -> Promise<prototype>

function materialKey(m) {
  if (!m) return 'none';
  // Maps have to be part of the key. Two materials can agree on every scalar and
  // still carry different surfaces, and merging those produces an asset wearing
  // one part's texture on another part's geometry.
  const tex = (t) => (t ? `${t.uuid}:${t.repeat.x},${t.repeat.y}` : '-');
  return [
    m.type, m.color?.getHexString?.(), m.roughness, m.metalness, m.flatShading,
    m.transparent, m.opacity, m.side, m.emissive?.getHexString?.(), m.vertexColors,
    tex(m.map), tex(m.roughnessMap), tex(m.normalMap),
  ].join('|');
}

/**
 * mergeGeometries refuses to combine geometries whose attribute sets differ
 * (some indexed and some not, some carrying uv). Generated assets build each
 * part independently, so one asset routinely mixes both. Normalise everything
 * to the same shape first: de-index, keep only shared attributes, drop morphs.
 */
function normaliseForMerge(geos) {
  const plain = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let common = null;
  for (const g of plain) {
    const names = new Set(Object.keys(g.attributes));
    common = common ? new Set([...common].filter((n) => names.has(n))) : names;
  }
  if (!common || !common.has('position')) return null;
  for (const g of plain) {
    for (const name of Object.keys(g.attributes)) {
      if (!common.has(name)) g.deleteAttribute(name);
    }
    g.morphAttributes = {};
    g.clearGroups();
  }
  return plain;
}

/**
 * THE BUG THIS FILE EXISTS FOR.
 *
 * An InstancedMesh holds ONE prototype geometry plus a matrix per copy. Cloning
 * its geometry gives you the prototype at the origin and throws away every
 * placement. Expand it: one geometry per instance, instance matrix first, then
 * the mesh's own world matrix.
 */
function expandInstances(o, bucket) {
  const _m = new THREE.Matrix4();
  const _col = new THREE.Color();
  const ic = o.instanceColor;
  for (let i = 0; i < o.count; i++) {
    o.getMatrixAt(i, _m);
    const g = o.geometry.clone();
    g.applyMatrix4(_m);              // instance-local placement
    g.applyMatrix4(o.matrixWorld);   // then the mesh's own world transform
    // Instances can carry a per-instance colour via setColorAt. Merge without
    // baking it and every copy comes out the material's base colour.
    if (ic) {
      _col.fromArray(ic.array, i * 3);
      const n = g.attributes.position.count;
      const arr = new Float32Array(n * 3);
      for (let v = 0; v < n; v++) {
        arr[v * 3] = _col.r; arr[v * 3 + 1] = _col.g; arr[v * 3 + 2] = _col.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    }
    bucket.geos.push(g);
  }
  if (ic && !bucket.mat.vertexColors) {
    bucket.mat = bucket.mat.clone();
    bucket.mat.vertexColors = true;   // or the bake above is wasted
  }
}

/**
 * Collapse a subtree to one mesh per distinct material value.
 *
 * Exported as bakeStatic() below, because the same operation is worth running a
 * second time at world scale. Each asset arrives already merged, but a city of
 * two hundred props is still two hundred separate objects and the draw calls
 * add up faster than the triangles do. Bake scenery that never moves.
 */
function mergeByMaterialValues(root) {
  const buckets = new Map();
  const skip = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (o.isMesh && o.geometry) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.length > 1) { skip.push(o); return; }   // multi-material: leave alone
      const sig = Object.keys(o.geometry.attributes).sort().join(',') +
        (o.isInstancedMesh && o.instanceColor ? ',color' : '');
      const k = materialKey(mats[0]) + '#' + sig;
      if (!buckets.has(k)) buckets.set(k, { mat: mats[0], geos: [], cast: false, receive: false });
      const bucket = buckets.get(k);
      // Carry the shadow flags across the merge. A merged mesh is a NEW mesh and
      // castShadow defaults to false, so without this the merge silently switches
      // off every shadow its inputs had. Nothing throws, the scene still renders,
      // and nothing in it is attached to the ground any more. bakeStatic runs
      // over a whole dressed scene, which is exactly where it is most expensive
      // and hardest to spot.
      bucket.cast = bucket.cast || o.castShadow;
      bucket.receive = bucket.receive || o.receiveShadow;

      if (o.isInstancedMesh) { expandInstances(o, bucket); return; }

      const g = o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      bucket.geos.push(g);
    } else if (o.isLight || o.isSprite || o.isPoints) {
      skip.push(o);
    }
  });

  const out = new THREE.Group();
  const shadowed = (m, cast, receive) => { m.castShadow = cast; m.receiveShadow = receive; return m; };
  for (const { mat, geos, cast, receive } of buckets.values()) {
    if (!geos.length) continue;
    let geo = geos.length === 1 ? geos[0] : null;
    if (!geo) {
      const ready = normaliseForMerge(geos);
      if (ready) {
        try { geo = BufferGeometryUtils.mergeGeometries(ready, false); } catch { geo = null; }
      }
      if (!geo) {
        // Merging is an optimisation, never a correctness requirement. If these
        // still will not combine, draw them separately rather than lose them.
        for (const g of geos) out.add(shadowed(new THREE.Mesh(g, mat), cast, receive));
        continue;
      }
    }
    out.add(shadowed(new THREE.Mesh(geo, mat), cast, receive));
  }
  for (const o of skip) {
    const c = o.clone();
    c.matrix.copy(o.matrixWorld);
    c.matrix.decompose(c.position, c.quaternion, c.scale);
    out.add(c);
  }
  return out;
}

async function loadPrototype(url, keepHierarchy = false) {
  const key = keepHierarchy ? url + '#tree' : url;
  if (cache.has(key)) return cache.get(key);
  const p = (async () => {
    const mod = await import(/* @vite-ignore */ new URL(url, location.href).href);
    const fn = mod.default || mod.build || mod.create;
    if (typeof fn !== 'function') throw new Error(`asset has no default export function: ${url}`);
    const built = fn(THREE);
    // Merging is what keeps the draw calls down and it is right for scenery. It
    // is also destructive: it collapses the hierarchy and drops everything the
    // asset attached to userData, so anything with moving parts arrives welded
    // solid, renders perfectly, and can never move. See keepHierarchy below.
    const merged = keepHierarchy ? built : mergeByMaterialValues(built);
    // Normalise so a placement coordinate means "put it here on the ground"
    // rather than "put its arbitrary origin here".
    const box = new THREE.Box3().setFromObject(merged);
    const c = box.getCenter(new THREE.Vector3());
    merged.position.set(-c.x, -box.min.y, -c.z);
    const wrapper = new THREE.Group();
    wrapper.add(merged);
    wrapper.userData.nativeSize = box.getSize(new THREE.Vector3());
    if (keepHierarchy) carryDeclarations(built, wrapper);
    return wrapper;
  })();
  cache.set(key, p);
  return p;
}

/**
 * An asset that moves names its moving parts on `userData`, as objects:
 *
 *   g.userData.joints = { leftUpperLeg, rightUpperLeg, head };
 *
 * Those references cannot survive a clone. `Object3D.copy` round-trips userData
 * through JSON, so a cloned instance's `userData.joints.head` is a plain object
 * with no methods, and code that rotates it changes nothing and throws nothing.
 * Copying the references onto the prototype and hoping is worse than dropping
 * them, because it looks like it worked.
 *
 * So the prototype records NAMES, and every instance resolves them against its
 * own tree. Parts without a name are given one, since most authors do not set it.
 */
const REF_PREFIX = '__part__';

function carryDeclarations(src, wrapper) {
  const refs = {};
  for (const [key, val] of Object.entries(src.userData || {})) {
    if (key === 'nativeSize') continue;
    if (val && val.isObject3D) {
      if (!val.name) val.name = `${REF_PREFIX}${key}`;
      refs[key] = val.name;
    } else if (val && typeof val === 'object' && !Array.isArray(val) &&
               Object.values(val).some((v) => v && v.isObject3D)) {
      const map = {};
      for (const [sub, node] of Object.entries(val)) {
        if (!node || !node.isObject3D) continue;
        if (!node.name) node.name = `${REF_PREFIX}${key}_${sub}`;
        map[sub] = node.name;
      }
      refs[key] = map;
    } else {
      wrapper.userData[key] = val;      // plain data survives a clone unharmed
    }
  }
  if (Object.keys(refs).length) wrapper.userData[REF_PREFIX] = refs;
}

/** Rebuild the declared references against THIS instance's own nodes. */
function resolveDeclarations(inst) {
  const refs = inst.userData && inst.userData[REF_PREFIX];
  if (!refs) return;
  const byName = new Map();
  inst.traverse((o) => { if (o.name) byName.set(o.name, o); });
  for (const [key, val] of Object.entries(refs)) {
    if (typeof val === 'string') {
      const node = byName.get(val);
      if (node) inst.userData[key] = node;
    } else {
      const out = {};
      for (const [sub, name] of Object.entries(val)) {
        const node = byName.get(name);
        if (node) out[sub] = node;
      }
      if (Object.keys(out).length) inst.userData[key] = out;
    }
  }
  delete inst.userData[REF_PREFIX];
}

/**
 * ASSET(url, {height, surfaces, keepHierarchy}) -> a fresh Object3D you can
 * position and rotate.
 *
 * `height` is the finished height in metres; omit it to keep native scale.
 * `surfaces` applies procedural albedo, roughness and normal maps; see
 * docs/surfaces.md. Never throws into a game loop: an unloadable asset returns
 * an empty Group.
 *
 * `keepHierarchy: true` skips the merge. Use it for ANYTHING THAT MOVES.
 *
 * The default merge is what makes a two hundred prop street affordable, and it
 * is the wrong thing for a character, a door, a wheel or a lid. It welds every
 * part into one mesh per material and discards the asset's own userData with the
 * nodes it was attached to, so a figure exposing named limbs arrives with no
 * limbs to name. It renders perfectly. It simply never moves again, and no still
 * frame will ever show you that, which is why this option exists and why it is
 * documented here rather than in a footnote.
 *
 *   const crate  = await ASSET('assets/crate.js');                        // merged, cheap
 *   const person = await ASSET('assets/person.js', { keepHierarchy: true }); // articulated
 *
 * With keepHierarchy the asset's userData is copied onto the returned wrapper,
 * so `obj.userData.joints` works without knowing how the loader nested things.
 */
export async function ASSET(url, opts = {}) {
  let proto;
  try {
    proto = await loadPrototype(url, !!opts.keepHierarchy);
  } catch (e) {
    console.warn('[assets]', url, e.message);
    return new THREE.Group();
  }
  const inst = proto.clone(true);
  if (opts.keepHierarchy) resolveDeclarations(inst);
  const native = proto.userData.nativeSize;
  if (opts.height && native && native.y > 1e-6) {
    inst.scale.setScalar(opts.height / native.y);
  }
  inst.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // Surfaces are applied per instance rather than on the cached prototype, so a
  // game can have a textured and an untextured copy of the same asset.
  if (opts.surfaces) applySurfaces(THREE, inst, opts.surfaces === true ? {} : opts.surfaces);
  return inst;
}

/** Preload in parallel so the first frame is not a slideshow. */
export async function preloadAssets(urls) {
  await Promise.all(urls.map((u) => loadPrototype(u).catch((e) => console.warn('[assets]', u, e.message))));
}

/**
 * bakeStatic(group) -> a new Group with the same appearance and far fewer draws.
 *
 * Shadow flags survive it. They did not always: a merged mesh is a new mesh and
 * `castShadow` defaults to false, so baking a dressed scene used to switch off
 * every shadow in it and leave nothing attached to the ground, with no error and
 * no warning. Only a critic sampling pixels under a counter leg found it.
 *
 * Use it on scenery that never moves, in chunks rather than all at once: one
 * bake per city block keeps frustum culling working, whereas baking the entire
 * world into one mesh means every block is drawn even when it is behind you.
 */
export function bakeStatic(root) {
  return mergeByMaterialValues(root);
}

/** Native size of an already-loaded asset, for layout maths. */
export async function assetSize(url) {
  const p = await loadPrototype(url);
  return p.userData.nativeSize.clone();
}
