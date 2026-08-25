/**
 * Procedural surfaces for coded assets.
 *
 * Assets in this repo are geometry and flat colours, which is most of what makes
 * them cheap. It is also why they read as painted cardboard next to a scanned
 * mesh: a real surface varies in colour, in roughness and in normal at the same
 * time, and a flat MeshStandardMaterial varies in none of them.
 *
 * This generates all three maps into a canvas at load time from a seed. No files
 * are downloaded, nothing is licensed, and the same seed gives the same surface
 * on every machine, so it keeps the asset contract's zero-file rule intact.
 *
 * It runs over a BUILT asset rather than inside one, so asset modules stay
 * import-free exactly as the contract requires, and every asset already written
 * gets the benefit without being touched.
 *
 * Opt in through the loader:
 *
 *     const crate = await ASSET('/assets/produce_crate_stack.js', { surfaces: true });
 *
 * or turn it on once for a whole game with `setSurfaceDefaults({ on: true })`.
 */
const TAU = Math.PI * 2;

/** Deterministic value noise. Same seed, same surface, on any machine. */
function makeNoise(seed = 1) {
  const P = new Uint8Array(512);
  let s = seed >>> 0 || 1;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const perm = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) P[i] = perm[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  const grad = (h, x, y) => ((h & 1) ? -x : x) + ((h & 2) ? -y : y);
  return (x, y) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const u = fade(xf), v = fade(yf);
    const aa = P[P[X] + Y], ab = P[P[X] + Y + 1], ba = P[P[X + 1] + Y], bb = P[P[X + 1] + Y + 1];
    return lerp(lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
                lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u), v);
  };
}

/** Octaves at halving amplitude. Three scales is the minimum that reads as a real surface. */
function fbm(noise, x, y, octaves = 5, lacunarity = 2.07, gain = 0.5) {
  let a = 1, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) { sum += a * noise(x * f, y * f); norm += a; a *= gain; f *= lacunarity; }
  return sum / norm;
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => a + (b - a) * t;

/**
 * Recipes describe a surface as a height field plus how colour and roughness
 * follow it. Keeping them declarative is what lets one classifier cover a whole
 * asset library.
 */
export const RECIPES = {
  plaster: { tile: 1.3, seed: 11, rough: [0.72, 0.95], bump: 0.55,
    height: (n, x, y) => fbm(n, x * 3, y * 3, 5) * 0.5 + 0.5,
    tint: (h) => 0.86 + h * 0.22,
    extra: (n, x, y, h) => { const streak = clamp01(fbm(n, x * 0.7, y * 6, 3) * 0.5 + 0.5);
      return { grime: Math.pow(clamp01(1 - y), 2.2) * 0.34 * streak }; } },

  stone: { tile: 0.85, seed: 23, rough: [0.68, 0.98], bump: 1.0,
    height: (n, x, y) => { const base = fbm(n, x * 4, y * 4, 6) * 0.5 + 0.5;
      const pit = Math.pow(clamp01(fbm(n, x * 11 + 40, y * 11, 3) * 0.5 + 0.5), 5) * 0.6;
      return clamp01(base - pit); },
    tint: (h) => 0.78 + h * 0.36 },

  timber: { tile: 0.5, seed: 37, rough: [0.66, 0.92], bump: 0.7,
    // Grain runs along one axis, with knots as rare low-frequency blobs.
    height: (n, x, y) => { const grain = Math.sin((y * 34 + fbm(n, x * 2, y * 5, 3) * 6) * TAU * 0.08);
      const knot = Math.pow(clamp01(fbm(n, x * 3 + 11, y * 3, 2) * 0.5 + 0.5), 9) * 2;
      return clamp01(0.5 + grain * 0.22 + knot * 0.3); },
    tint: (h) => 0.74 + h * 0.4 },

  tile: { tile: 0.9, seed: 53, rough: [0.7, 0.95], bump: 0.9,
    // Barrel roof tiles: repeating ridges, each course slightly off in tone.
    height: (n, x, y) => { const course = Math.floor(y * 7);
      const ridge = 0.5 + 0.5 * Math.cos((x * 9 + (course % 2) * 0.5) * TAU);
      const wear = fbm(n, x * 8, y * 8, 4) * 0.5 + 0.5;
      return clamp01(ridge * 0.7 + wear * 0.3); },
    tint: (h, n, x, y) => 0.8 + h * 0.3 + (fbm(n, x * 1.3 + 5, y * 1.3, 2) * 0.16) },

  metal: { tile: 0.55, seed: 71, rough: [0.24, 0.8], bump: 0.5,
    height: (n, x, y) => { const brush = fbm(n, x * 40, y * 2, 3) * 0.5 + 0.5;
      const dent = fbm(n, x * 5, y * 5, 4) * 0.5 + 0.5;
      return clamp01(brush * 0.35 + dent * 0.65); },
    tint: (h) => 0.85 + h * 0.25,
    extra: (n, x, y, h) => ({ rust: Math.pow(clamp01(fbm(n, x * 3 + 90, y * 3, 4) * 0.5 + 0.5), 2.6) * 0.85 }) },

  fabric: { tile: 0.7, seed: 97, rough: [0.86, 1.0], bump: 0.4,
    height: (n, x, y) => { const weave = (Math.sin(x * 90) * Math.sin(y * 90)) * 0.5 + 0.5;
      return clamp01(weave * 0.4 + (fbm(n, x * 6, y * 6, 3) * 0.5 + 0.5) * 0.6); },
    tint: (h) => 0.9 + h * 0.16 },

  foliage: { tile: 0.8, seed: 113, rough: [0.8, 1.0], bump: 0.6,
    height: (n, x, y) => { const clump = fbm(n, x * 7, y * 7, 5) * 0.5 + 0.5;
      return clamp01(Math.pow(clump, 1.5)); },
    tint: (h) => 0.7 + h * 0.55 },

  ground: { tile: 2.6, seed: 131, rough: [0.8, 1.0], bump: 0.8,
    height: (n, x, y) => { const base = fbm(n, x * 5, y * 5, 6) * 0.5 + 0.5;
      const grit = Math.pow(clamp01(fbm(n, x * 17, y * 17, 3) * 0.5 + 0.5), 3);
      return clamp01(base * 0.75 + grit * 0.25); },
    tint: (h) => 0.8 + h * 0.34 },
};

/** Height field to normal map, by central difference. Agrees with the albedo by construction. */
function heightToNormal(h, size, strength) {
  const out = new Uint8ClampedArray(size * size * 4);
  const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
    const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const len = Math.hypot(dx, dy, 1);
    const i = (y * size + x) * 4;
    out[i] = ((-dx / len) * 0.5 + 0.5) * 255;
    out[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
    out[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
    out[i + 3] = 255;
  }
  return out;
}

const cache = new Map();

/**
 * Build albedo, roughness and normal maps for one recipe. Cached, because a
 * building reuses the same plaster on forty meshes and generating it once is
 * the difference between instant and a visible hitch.
 */
export function surface(THREE, name, size = 512) {
  const key = name + ':' + size;
  if (cache.has(key)) return cache.get(key);
  const r = RECIPES[name];
  if (!r) throw new Error('no recipe: ' + name);
  const noise = makeNoise(r.seed);

  const hf = new Float32Array(size * size);
  const alb = new Uint8ClampedArray(size * size * 4);
  const rgh = new Uint8ClampedArray(size * size * 4);

  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const h = clamp01(r.height(noise, u, v));
    hf[y * size + x] = h;
    const e = r.extra ? r.extra(noise, u, v, h) : {};

    // Albedo is a tint multiplier, not a colour. The asset keeps its own palette
    // and the texture only modulates it, so one recipe serves every stone in the
    // library without flattening the variety the generator already produces.
    let t = r.tint(h, noise, u, v);
    let tr = t, tg = t, tb = t;
    if (e.grime) { tr = mix(tr, 0.62, e.grime); tg = mix(tg, 0.60, e.grime); tb = mix(tb, 0.55, e.grime); }
    if (e.rust)  { tr = mix(tr, 1.18, e.rust);  tg = mix(tg, 0.62, e.rust);  tb = mix(tb, 0.40, e.rust); }

    const i = (y * size + x) * 4;
    alb[i] = clamp01(tr) * 255; alb[i + 1] = clamp01(tg) * 255; alb[i + 2] = clamp01(tb) * 255; alb[i + 3] = 255;

    // Rougher where it is low and dirty, smoother where it is proud and worn.
    let rr = mix(r.rough[1], r.rough[0], h);
    if (e.rust) rr = mix(rr, 0.96, e.rust);
    const rv = clamp01(rr) * 255;
    rgh[i] = rv; rgh[i + 1] = rv; rgh[i + 2] = rv; rgh[i + 3] = 255;
  }

  const mk = (data) => {
    const c = document.createElement('canvas'); c.width = c.height = size;
    c.getContext('2d').putImageData(new ImageData(data, size, size), 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  };
  const maps = {
    map: mk(alb),
    roughnessMap: mk(rgh),
    normalMap: mk(heightToNormal(hf, size, r.bump * 2.4)),
    tileMeters: r.tile,
  };
  maps.map.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, maps);
  return maps;
}

/**
 * Classify an existing flat material into a recipe from what the asset already
 * declares. Generated assets carry no material names, so colour, roughness and
 * metalness are the only signal available, and they turn out to be enough.
 */
export function classify(mat) {
  // An asset that knows what it is built from can just say so. Naming a material
  // after a recipe beats any amount of guessing from colour, and it costs the
  // generator one string.
  if (mat.name && RECIPES[mat.name]) return mat.name;

  // Three.js keeps material colours in the LINEAR working space, so reading
  // mat.color directly gives values that look far more saturated and far darker
  // than the hex the asset author wrote. Classify in sRGB or every warm grey
  // stone comes back as terracotta.
  const c = mat.color.clone().convertLinearToSRGB();
  const r = mat.roughness ?? 1, m = mat.metalness ?? 0;
  const max = Math.max(c.r, c.g, c.b), min = Math.min(c.r, c.g, c.b);
  const sat = max === 0 ? 0 : (max - min) / max;
  const lum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;

  if (mat.transparent && mat.opacity < 0.95) return null;          // glass, leave alone
  if (m > 0.25 || (r < 0.55 && sat < 0.25)) return 'metal';
  if (c.g > c.r && c.g > c.b && sat > 0.18) return 'foliage';
  if (sat > 0.44 && c.r > c.g && c.g > c.b && lum < 0.42) return 'tile';   // terracotta roof only
  // Timber has to be genuinely brown. A warm grey stone was landing here and
  // wearing wood grain, which reads as a crosshatch once the texture repeats.
  if (sat > 0.32 && c.r > c.g && c.g > c.b && lum < 0.5) return 'timber';
  if (lum < 0.16) return null;                                      // near-black trim, leave alone
  if (lum > 0.66 && sat < 0.2) return 'plaster';
  return 'stone';                                                   // the safe default
}

/**
 * Texel density has to come from each mesh's own size: a shared material on a
 * six metre wall and a twenty centimetre sill needs a different repeat on each,
 * or the small part looks like a different substance.
 *
 * The obvious way to do that is to clone a material per mesh, and it is a trap.
 * assetlib merges by material VALUES, so a unique material per mesh means
 * nothing merges and the draw calls go up by an order of magnitude. Quantising
 * the repeat onto a ladder fixes it: meshes of a similar size land on the same
 * rung, share one material instance, and merge again.
 */
const DEFAULTS = { on: false, size: 512, normalScale: 0.85 };
export function setSurfaceDefaults(o) { Object.assign(DEFAULTS, o); }

/**
 * Texel density has to come from each mesh's own size: a shared material on a
 * six metre wall and a twenty centimetre sill needs a different repeat on each,
 * or the small part looks like a different substance.
 *
 * Doing that through `texture.repeat` means a material per size, and assetlib
 * merges by material VALUES, so the draw calls go up several times over. The
 * house in the sample set went from 33 draws to 144 that way.
 *
 * So the repeat goes into the UVs instead. Every mesh keeps one shared material
 * per recipe and colour, the density lives in the geometry, and merging behaves
 * exactly as it did before texturing existed. Geometry is cloned before its UVs
 * are touched, because generated assets reuse geometry across parts of different
 * sizes and mutating in place corrupts the others.
 */
function scaleUVs(THREE, mesh, u, v) {
  const geo = mesh.geometry;
  const uv = geo.attributes.uv;
  if (!uv) return;
  const clone = geo.clone();
  const a = clone.attributes.uv;
  for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * u, a.getY(i) * v);
  a.needsUpdate = true;
  mesh.geometry = clone;
}

export function applySurfaces(THREE, root, opts = {}) {
  const { size, normalScale } = { ...DEFAULTS, ...opts };
  const box = new THREE.Box3(), v = new THREE.Vector3();
  const shared = new Map();
  let textured = 0, left = 0;

  root.traverse((o) => {
    if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
    const recipe = opts.only || classify(o.material);
    if (!recipe) { left++; return; }

    const s = surface(THREE, recipe, size);
    box.setFromObject(o); box.getSize(v);
    const density = 1 / s.tileMeters;
    const uRep = Math.max(1, (v.x > v.z ? v.x : v.z) * density);
    const vRep = Math.max(1, v.y * density);
    scaleUVs(THREE, o, uRep, vRep);

    const m0 = o.material;
    const key = [recipe, m0.color.getHexString(), m0.roughness, m0.metalness].join('|');
    let mat = shared.get(key);
    if (!mat) {
      mat = m0.clone();
      mat.map = s.map; mat.roughnessMap = s.roughnessMap; mat.normalMap = s.normalMap;
      mat.normalScale = new THREE.Vector2(normalScale, normalScale);
      mat.needsUpdate = true;
      shared.set(key, mat);
    }
    o.material = mat;
    textured++;
  });

  return { textured, left, materials: shared.size };
}
