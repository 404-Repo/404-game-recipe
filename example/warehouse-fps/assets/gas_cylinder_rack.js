// gas_cylinder_rack — winner (arm C): a different reading. The reference is not a fence
// with bottles behind it, it is six PIGEONHOLES: full-depth divider plates weld
// the frame into six cells and each bottle stands in one. The frame reads as
// flat strap steel rather than angle, the valve guards are collars with two real
// handle openings (arc bands, DoubleSide), and the bottles are not all the same
// height, which is what stops six copies looking like six copies.
// 1.20 x 0.60 x 1.80 m
export default function (THREE) {
  const g = new THREE.Group();

  const mat = (color, name, o = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.2, ...o });
    if (name) m.name = name;
    return m;
  };
  const open = (color, o = {}) => mat(color, 'metal', { side: THREE.DoubleSide, ...o });

  const FRAME = mat(0x3a3d40, 'metal', { roughness: 0.86, metalness: 0.22 });
  const FRAME2 = mat(0x44474a, 'metal', { roughness: 0.82, metalness: 0.24 });
  const FRAME3 = mat(0x33363a, 'metal', { roughness: 0.88, metalness: 0.20 });
  const STEEL = mat(0x5b6167, 'metal', { roughness: 0.7, metalness: 0.45 });
  const GALV = mat(0x9aa0a3, 'metal', { roughness: 0.55, metalness: 0.7 });
  const BRASS = mat(0x6e5a2b, 'metal', { roughness: 0.68, metalness: 0.62 });
  const RUST = mat(0x6e4128, 'metal', { roughness: 0.94, metalness: 0.12 });
  const YELLOW = mat(0xd6a41f, 'metal', { roughness: 0.86, metalness: 0.1 });
  const DARK = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.92, metalness: 0.05 });

  const BOTTLE = [
    mat(0x8c3a2b, 'metal', { roughness: 0.80, metalness: 0.15 }),
    mat(0x2b4a63, 'metal', { roughness: 0.80, metalness: 0.15 }),
    mat(0xd6a41f, 'metal', { roughness: 0.82, metalness: 0.12 }),
    mat(0x9aa0a3, 'metal', { roughness: 0.60, metalness: 0.60 }),
    mat(0x953f2e, 'metal', { roughness: 0.82, metalness: 0.14 }),
    mat(0x2f5069, 'metal', { roughness: 0.82, metalness: 0.14 }),
  ];

  const add = (geo, m, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); g.add(mesh); return mesh;
  };

  // -------------------------------------------------- the skid and its base --
  for (const x of [-0.50, 0, 0.50]) add(new THREE.BoxGeometry(0.17, 0.126, 0.60), FRAME3, x, 0.063, 0);
  for (const sx of [-1, 1]) for (const sz of [1, -1]) {
    add(new THREE.BoxGeometry(0.28, 0.096, 0.032), DARK, sx * 0.25, 0.060, sz * 0.282);
    add(new THREE.BoxGeometry(0.30, 0.018, 0.034), FRAME2, sx * 0.25, 0.117, sz * 0.281);
  }
  add(new THREE.BoxGeometry(1.20, 0.028, 0.60), FRAME2, 0, 0.140, 0);
  for (const sz of [1, -1]) add(new THREE.BoxGeometry(1.20, 0.070, 0.026), FRAME, 0, 0.120, sz * 0.287);
  for (const sx of [1, -1]) add(new THREE.BoxGeometry(0.026, 0.070, 0.60), FRAME, sx * 0.587, 0.120, 0);
  // the scuffed kick band along the front of the skid
  add(new THREE.BoxGeometry(1.15, 0.048, 0.016), RUST, 0, 0.118, 0.298);
  // drainage slots in the deck
  for (const x of [-0.38, 0, 0.38]) add(new THREE.BoxGeometry(0.16, 0.014, 0.030), DARK, x, 0.156, 0);

  // --------------------------------------------- pigeonhole divider plates ---
  // two running front-to-back, one running left-to-right: six cells
  for (const x of [-0.19, 0.19]) {
    add(new THREE.BoxGeometry(0.020, 1.060, 0.575), FRAME3, x, 0.690, 0);
    add(new THREE.BoxGeometry(0.034, 0.030, 0.575), FRAME2, x, 1.205, 0);
    add(new THREE.BoxGeometry(0.034, 0.030, 0.575), FRAME2, x, 0.180, 0);
  }
  add(new THREE.BoxGeometry(1.15, 1.060, 0.018), FRAME3, 0, 0.690, 0);
  add(new THREE.BoxGeometry(1.15, 0.030, 0.032), FRAME2, 0, 1.205, 0);

  // -------------------------------------------------- flat-strap outer frame --
  for (const sz of [1, -1]) for (const x of [-0.575, 0.575]) {
    add(new THREE.BoxGeometry(0.048, 1.070, 0.026), FRAME, x, 0.695, sz * 0.287);
  }
  for (const sz of [1, -1]) for (const y of [0.36, 0.75, 1.15, 1.228]) {
    add(new THREE.BoxGeometry(1.20, 0.060, 0.022), y === 0.36 ? RUST : FRAME2, 0, y, sz * 0.289);
  }
  for (const sx of [1, -1]) for (const y of [0.36, 0.75, 1.228]) {
    add(new THREE.BoxGeometry(0.022, 0.060, 0.60), FRAME2, sx * 0.589, y, 0);
  }
  // the diagonal brace, on the -X face, the way the reference has it
  const br = add(new THREE.BoxGeometry(0.022, 1.05, 0.055), FRAME2, -0.589, 0.71, 0);
  br.rotation.x = -0.50;
  add(new THREE.BoxGeometry(0.026, 0.10, 0.10), FRAME, -0.589, 0.235, -0.235);
  add(new THREE.BoxGeometry(0.026, 0.10, 0.10), FRAME, -0.589, 1.185, 0.235);
  // bolts through every strap crossing
  for (const sz of [1, -1]) for (const x of [-0.575, -0.19, 0.19, 0.575]) for (const y of [0.36, 1.228]) {
    add(new THREE.CylinderGeometry(0.013, 0.013, 0.020, 6), GALV, x, y, sz * 0.300).rotation.x = Math.PI / 2;
  }

  // ---------------------------------------------------------- the cylinders --
  // two lathes, a tall bottle and a short one, so the six are not six copies
  const profile = (h) => [
    [0.000, 0.000], [0.085, 0.000], [0.112, 0.008], [0.120, 0.026],
    [0.120, h], [0.1185, h + 0.050], [0.1130, h + 0.095], [0.1030, h + 0.135],
    [0.0880, h + 0.168], [0.0680, h + 0.194], [0.0500, h + 0.210], [0.0480, h + 0.226],
    [0.0340, h + 0.244], [0.0340, h + 0.256],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const tall = new THREE.LatheGeometry(profile(1.150), 12);
  const short = new THREE.LatheGeometry(profile(1.010), 12);

  const XS = [-0.38, 0, 0.38], ZS = [0.145, -0.145];
  const TALL = [1, 0, 1, 0, 1, 1];   // which cells hold the tall bottles
  let n = 0;
  for (let iz = 0; iz < 2; iz++) for (let ix = 0; ix < 3; ix++) {
    const x = XS[ix], z = ZS[iz], m = BOTTLE[n % 6];
    const isTall = !!TALL[n];
    const top = 0.160 + (isTall ? 1.406 : 1.266);   // top of the neck
    add((isTall ? tall : short).clone(), m, x, 0.160, z);
    add(new THREE.CylinderGeometry(0.1225, 0.1225, 0.055, 12, 1, true),
      open(0x4a4f54, { roughness: 0.9, metalness: 0.4 }), x, 0.190, z);
    add(new THREE.CylinderGeometry(0.1225, 0.1225, 0.115, 12, 1, true),
      open(0x4e4c47, { roughness: 0.95, metalness: 0.1 }), x, 0.48, z);
    add(new THREE.CylinderGeometry(0.1222, 0.1222, 0.065, 12, 1, true),
      open(n % 2 ? 0x9aa0a3 : 0xd6a41f, { roughness: 0.85, metalness: 0.15 }), x, 0.98, z);
    // valve
    add(new THREE.BoxGeometry(0.068, 0.076, 0.068), BRASS, x, top + 0.038, z);
    add(new THREE.CylinderGeometry(0.025, 0.025, 0.056, 8), BRASS, x + 0.056, top + 0.032, z).rotation.z = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.019, 0.019, 0.030, 8), BRASS, x, top + 0.088, z);
    add(new THREE.CylinderGeometry(0.040, 0.040, 0.020, 10), GALV, x, top + 0.106, z);
    // guard collar: two arc bands leaving two handle openings, plus rims
    for (const a0 of [0.35, Math.PI + 0.35]) {
      add(new THREE.CylinderGeometry(0.104, 0.104, 0.360, 8, 1, true, a0, 2.44),
        open(0x646a70, { roughness: 0.72, metalness: 0.42 }), x, top + 0.030, z);
    }
    add(new THREE.CylinderGeometry(0.108, 0.108, 0.040, 12, 1, true),
      open(0x5b6167, { roughness: 0.74, metalness: 0.42 }), x, top - 0.150, z);
    const ring = add(new THREE.TorusGeometry(0.101, 0.016, 4, 10), STEEL, x, top + 0.218, z);
    ring.rotation.x = -Math.PI / 2;
    // the two vertical edge posts the guard's handle openings are cut between
    for (const a of [0.35 + 2.44 + 0.351, 0.35 - 0.351]) {
      add(new THREE.BoxGeometry(0.020, 0.360, 0.020), STEEL,
        x + Math.sin(a) * 0.104, top + 0.030, z + Math.cos(a) * 0.104).rotation.y = a;
    }
    n++;
  }

  // ------------------------------------------------------------- the chain --
  const link = new THREE.TorusGeometry(0.029, 0.0075, 4, 5);
  const N = 19;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = -0.545 + t * 1.09;
    const y = 0.995 - 0.085 * Math.sin(Math.PI * t);
    const l = add(link.clone(), i % 2 ? RUST : mat(0x7d4a2e, 'metal', { roughness: 0.92 }), x, y, 0.295);
    l.rotation.y = Math.PI / 2;
    l.rotation.x = (i % 2) * Math.PI / 2;
    l.rotation.z = -0.085 * Math.PI * Math.cos(Math.PI * t) * 0.9;
  }
  add(new THREE.TorusGeometry(0.026, 0.008, 4, 6), GALV, -0.573, 0.995, 0.295).rotation.y = Math.PI / 2;
  // a hook on the free end
  add(new THREE.TorusGeometry(0.026, 0.008, 4, 6, Math.PI * 1.4), GALV, 0.582, 0.995, 0.295).rotation.y = Math.PI / 2;
  for (const sx of [1, -1]) {
    add(new THREE.BoxGeometry(0.030, 0.060, 0.030), FRAME, sx * 0.575, 0.995, 0.295);
  }

  // ------------------------------------------------------- plated markings ---
  add(new THREE.BoxGeometry(0.24, 0.16, 0.012), YELLOW, -0.38, 0.545, 0.302);
  add(new THREE.BoxGeometry(0.17, 0.032, 0.016), FRAME, -0.38, 0.575, 0.304);
  add(new THREE.BoxGeometry(0.012, 0.15, 0.22), YELLOW, -0.598, 0.98, -0.06);
  add(new THREE.BoxGeometry(0.20, 0.14, 0.012), YELLOW, 0.36, 0.545, -0.302);

  for (const [x, z, y, h] of [[-0.575, 1, 0.85, 0.55], [0.19, 1, 0.55, 0.35],
                              [0.575, -1, 0.90, 0.6], [-0.19, -1, 0.62, 0.4], [0.0, 1, 1.05, 0.3]]) {
    add(new THREE.BoxGeometry(0.028, h, 0.010), RUST, x, y, z * 0.297);
  }

  // --- the six lines --------------------------------------------------------
  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n2) => { const p = n2.isMesh && n2.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n2.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= box.min.y; m.position.z -= c.z; });

  return g;
}
