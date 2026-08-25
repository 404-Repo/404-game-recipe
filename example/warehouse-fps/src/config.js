/**
 * DEPOT 17 — shared constants.
 *
 * Everything the level, the lighting and the critic agree on lives here so a
 * tuning round changes one file rather than five.
 */
export const PAL = {
  concretePale: 0x77746d, concreteStained: 0x4e4c47,
  steelStruct: 0x5b6167, steelGalv: 0x9aa0a3, cladding: 0x878c8f,
  safetyYellow: 0xd6a41f, rackOrange: 0xbe5220,
  timber: 0x9c7a4e, cardboard: 0xa8794a,
  contRed: 0x8c3a2b, contBlue: 0x2b4a63, plasticWhite: 0xc9c6bd,
  rubber: 0x1b1c1e, gunmetal: 0x3a3d40, oliveDrab: 0x3a3d33, rust: 0x6e4128,
  lampSodium: 0xffb45a, lightCold: 0x8fb4d8, signGreen: 0x2fd06a, warnRed: 0xd8342a,
};

// Building envelope, in metres. The level, the collision hull and the light
// grid are all derived from these four numbers.
export const B = {
  halfX: 16, halfZ: 24,        // interior extent
  eaves: 9.5,                  // underside of truss
  bayX: 8, bayZ: 8,            // structural grid
  mezzY: 5.0,                  // catwalk deck height
};

export const PLAYER = {
  eye: 1.65, eyeCrouch: 1.02, radius: 0.34, height: 1.78,
  walk: 4.0, sprint: 7.0, crouchMul: 0.45, adsMul: 0.5,
  accel: 46, airAccel: 7, friction: 11,
  jump: 5.0, gravity: 21.5, stepUp: 0.42,
  maxHp: 100, regenDelay: 5.0, regenRate: 14,
};

export const WEAPONS = {
  carbine: {
    name: 'M4 CARBINE', mag: 30, reserve: 210, rpm: 750, damage: 26, headMul: 2.6,
    spread: 0.0130, adsSpread: 0.0026, moveSpread: 0.019, recoil: 0.0075, recoilH: 0.0031,
    reload: 2.05, range: 90, adsFov: 46, tracerEvery: 3,
  },
};

// Frame rate is measured from real elapsed time, never from a clamped delta.
// A counter that divides by a clamped dt is pinned to a constant and reports a
// healthy number on a build running at one frame a second.
export const MAX_DT = 1 / 20;

export const QUALITY = {
  // `cull` is the block visibility radius in metres, and it is the single
  // biggest lever on the draw count. A shadow-casting spot light is a whole
  // extra scene pass, which took the top tier 20% over budget on exactly the
  // machine most likely to select it; the tiers spend their headroom on
  // resolution, view distance, decals and live lights instead.
  ultra: { shadowMap: 2048, bloom: true, spotShadows: 0, liveSpots: 12, pixelCap: 2.0,  decals: 96, fog: true, cull: 18, msaa: 4 },
  high:  { shadowMap: 2048, bloom: true, spotShadows: 0, liveSpots: 8,  pixelCap: 1.75, decals: 64, fog: true, cull: 18, msaa: 4 },
  med:   { shadowMap: 1024, bloom: true, spotShadows: 0, liveSpots: 6,  pixelCap: 1.4,  decals: 40, fog: true, cull: 20, msaa: 4 },
  low:   { shadowMap: 1024, bloom: false, spotShadows: 0, liveSpots: 4, pixelCap: 1.0,  decals: 24, fog: true, cull: 18, msaa: 2 },
};


export const rnd = (a, b) => a + Math.random() * (b - a);
export const rndi = (a, b) => Math.floor(rnd(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
// Frame-rate independent exponential smoothing. `damp(a,b,lambda,dt)` reaches
// the same place in the same wall time at 30fps and at 144fps; `lerp(a,b,0.1)`
// in a loop does not, and the difference is a weapon that feels different on
// every machine.
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
