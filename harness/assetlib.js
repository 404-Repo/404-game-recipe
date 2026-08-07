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

const cache = new Map();   // url -> Promise<prototype>

function materialKey(m) {
  if (!m) return 'none';
  return [
    m.type, m.color?.getHexString?.(), m.roughness, m.metalness, m.flatShading,
    m.transparent, m.opacity, m.side, m.emissive?.getHexString?.(), m.vertexColors,
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
      if (!buckets.has(k)) buckets.set(k, { mat: mats[0], geos: [] });
      const bucket = buckets.get(k);

      if (o.isInstancedMesh) { expandInstances(o, bucket); return; }

      const g = o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      bucket.geos.push(g);
    } else if (o.isLight || o.isSprite || o.isPoints) {
      skip.push(o);
    }
  });

  const out = new THREE.Group();
  for (const { mat, geos } of buckets.values()) {
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
        for (const g of geos) out.add(new THREE.Mesh(g, mat));
        continue;
      }
    }
    out.add(new THREE.Mesh(geo, mat));
  }
  for (const o of skip) {
    const c = o.clone();
    c.matrix.copy(o.matrixWorld);
    c.matrix.decompose(c.position, c.quaternion, c.scale);
    out.add(c);
  }
  return out;
}

async function loadPrototype(url) {
  if (cache.has(url)) return cache.get(url);
  const p = (async () => {
    const mod = await import(/* @vite-ignore */ new URL(url, location.href).href);
    const fn = mod.default || mod.build || mod.create;
    if (typeof fn !== 'function') throw new Error(`asset has no default export function: ${url}`);
    const merged = mergeByMaterialValues(fn(THREE));
    // Normalise so a placement coordinate means "put it here on the ground"
    // rather than "put its arbitrary origin here".
    const box = new THREE.Box3().setFromObject(merged);
    const c = box.getCenter(new THREE.Vector3());
    merged.position.set(-c.x, -box.min.y, -c.z);
    const wrapper = new THREE.Group();
    wrapper.add(merged);
    wrapper.userData.nativeSize = box.getSize(new THREE.Vector3());
    return wrapper;
  })();
  cache.set(url, p);
  return p;
}

/**
 * ASSET(url, {height}) -> a fresh Object3D you can position and rotate.
 * `height` is the finished height in metres; omit it to keep native scale.
 * Never throws into a game loop: an unloadable asset returns an empty Group.
 */
export async function ASSET(url, opts = {}) {
  let proto;
  try {
    proto = await loadPrototype(url);
  } catch (e) {
    console.warn('[assets]', url, e.message);
    return new THREE.Group();
  }
  const inst = proto.clone(true);
  const native = proto.userData.nativeSize;
  if (opts.height && native && native.y > 1e-6) {
    inst.scale.setScalar(opts.height / native.y);
  }
  inst.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return inst;
}

/** Preload in parallel so the first frame is not a slideshow. */
export async function preloadAssets(urls) {
  await Promise.all(urls.map((u) => loadPrototype(u).catch((e) => console.warn('[assets]', u, e.message))));
}

/**
 * bakeStatic(group) -> a new Group with the same appearance and far fewer draws.
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
