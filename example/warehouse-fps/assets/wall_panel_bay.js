// wall_panel_bay — arm C: a different reading of the same reference.
// The cladding is what it actually is on site: a single-thickness folded sheet,
// hand-built as a BufferGeometry from the fold line and rendered DoubleSide, in
// two lengths with a horizontal lap where one sheet ends and the next begins.
// In front of it sit the horizontal sheeting rails you see from inside a shed,
// and the plinth is precast units with open joints rather than one cast beam.
export default function (THREE) {
  const g = new THREE.Group();
  g.userData.mounts = 'back';   // weather face of the shed, never in shot

  const mat = (color, name, r, m, dbl) => {
    const s = new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m });
    if (dbl) s.side = THREE.DoubleSide;
    if (name) s.name = name;
    return s;
  };
  const CLAD    = mat(0x878c8f, 'metal', 0.68, 0.35, true);
  const CLAD_U  = mat(0x81868a, 'metal', 0.72, 0.32, true);  // upper sheet, 4% darker
  const CLAD_L  = mat(0x8f9497, 'metal', 0.64, 0.38);
  const STEEL   = mat(0x5b6167, 'metal', 0.75, 0.18);
  const GALV    = mat(0x9aa0a3, 'metal', 0.60, 0.60);
  const GALV_D  = mat(0x8d9396, 'metal', 0.66, 0.55);
  const CONC_S  = mat(0x4e4c47, 'stone', 0.95, 0.02);
  const CONC_P  = mat(0x77746d, 'stone', 0.92, 0.02);
  const RUST    = mat(0x6e4128, 'metal', 0.93, 0.08);
  const RUBBER  = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.90, metalness: 0.05 });
  const ORANGE  = mat(0xbe5220, 'metal', 0.82, 0.06);
  const YELLOW  = mat(0xd6a41f, 'metal', 0.80, 0.06);

  const B = (w, h, d, m, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  const instance = (geo, material, list, px, py, pz) => {
    const im = new THREE.InstancedMesh(geo, material, list.length);
    im.position.set(px, py, pz);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    list.forEach((t, i) => {
      const r = t.r || [0, 0, 0], s = t.s || [1, 1, 1];
      e.set(r[0], r[1], r[2]); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(t.p[0] - px, t.p[1] - py, t.p[2] - pz), q,
        new THREE.Vector3(s[0], s[1], s[2]));
      im.setMatrixAt(i, m4);
    });
    im.instanceMatrix.needsUpdate = true;
    g.add(im);
    return im;
  };

  const W = 8.0, H = 9.5;
  const PLINTH_H = 0.90, CAP_Y = 9.36;
  const Z_VAL = -0.070, Z_CR = 0.005;
  const LAP_Y = 5.40;

  // --- the fold line --------------------------------------------------------
  const PITCH = 0.40, N = 20, xa = -W / 2;
  const fold = [];
  for (let i = 0; i < N; i++) {
    const x = xa + i * PITCH;
    fold.push([x, Z_VAL], [x + 0.105, Z_VAL], [x + 0.145, Z_CR], [x + 0.255, Z_CR], [x + 0.295, Z_VAL]);
  }
  fold.push([xa + N * PITCH, Z_VAL]);

  // a folded sheet of no thickness at all, which is what profiled cladding is
  const sheet = (y0, y1, material) => {
    const pos = [], idx = [];
    for (let i = 0; i < fold.length; i++) {
      pos.push(fold[i][0], y0, fold[i][1]);
      pos.push(fold[i][0], y1, fold[i][1]);
    }
    for (let i = 0; i < fold.length - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, material);
    g.add(m);
    return m;
  };
  sheet(PLINTH_H - 0.02, LAP_Y + 0.06, CLAD);     // lower sheet
  sheet(LAP_Y - 0.02, CAP_Y, CLAD_U);             // upper sheet, lapped over it

  // --- precast plinth units -------------------------------------------------
  for (let i = 0; i < 4; i++) {
    const cx = -3.0 + i * 2.0;
    B(1.97, PLINTH_H, 0.14, CONC_S, cx, PLINTH_H / 2, -0.020);
    B(0.03, PLINTH_H, 0.012, RUST, cx + 0.985, PLINTH_H / 2, 0.054);   // open joint, stained
    B(1.90, 0.024, 0.010, CONC_P, cx, 0.62, 0.055);                    // lift-line
  }
  // knee-height wear band, 0.30 - 0.60 m
  B(W, 0.28, 0.010, CONC_P, 0, 0.46, 0.055);
  B(W, 0.05, 0.022, GALV_D, 0, 0.335, 0.061);
  B(W, 0.18, 0.038, RUBBER, 0, 0.445, 0.069);
  B(W, 0.05, 0.022, GALV_D, 0, 0.555, 0.061);
  for (const t of [[-3.90, 0.07], [-3.90, 0.85], [3.90, 0.12], [3.90, 0.86], [-1.55, 0.05], [2.35, 0.07]]) {
    B(0.18, 0.08, 0.022, CONC_P, t[0], t[1], 0.050);
  }
  for (const t of [[-2.4, 0.22], [0.9, 0.70], [3.1, 0.33]]) B(0.24, 0.11, 0.010, RUST, t[0], t[1], 0.055);
  // steel angle kerb capping the plinth, with the horizontal leg sloping out
  B(W, 0.020, 0.135, CLAD_L, 0, PLINTH_H + 0.030, 0.006).rotation.x = 0.20;
  B(W, 0.055, 0.020, GALV_D, 0, PLINTH_H + 0.002, 0.052);

  // --- sheeting rails, seen from inside in front of the cladding -------------
  const railBolts = [];
  for (const y of [2.10, LAP_Y, 8.30]) {
    B(W, 0.170, 0.070, STEEL, 0, y, 0.043);
    B(W, 0.026, 0.088, STEEL, 0, y + 0.072, 0.045);
    B(W, 0.026, 0.088, STEEL, 0, y - 0.072, 0.045);
    for (let i = 0; i < 12; i++) railBolts.push({ p: [-3.63 + i * 0.66, y, 0.082], r: [Math.PI / 2, 0, 0] });
  }
  // the lap: a flashing over the joint between the two sheets, drip pointing out
  B(W, 0.016, 0.105, CLAD_L, 0, LAP_Y - 0.150, 0.034).rotation.x = 0.26;
  B(W, 0.034, 0.010, RUST, 0, LAP_Y - 0.215, 0.014);

  // --- top capping ----------------------------------------------------------
  B(W, H - CAP_Y, 0.165, CLAD_L, 0, (CAP_Y + H) / 2, -0.008);
  B(W, 0.024, 0.170, GALV, 0, H - 0.012, -0.005);
  B(W, 0.05, 0.024, GALV_D, 0, CAP_Y + 0.036, 0.062);

  // --- fixings --------------------------------------------------------------
  const rivets = [];
  for (let i = 0; i < N; i++) {
    const x = xa + i * PITCH + 0.20;
    for (const y of [PLINTH_H + 0.16, 3.60, LAP_Y + 0.22, CAP_Y - 0.20]) {
      rivets.push({ p: [x, y, Z_CR + 0.006], r: [Math.PI / 2, 0, 0] });
    }
  }
  instance(new THREE.CylinderGeometry(0.013, 0.013, 0.014, 6), GALV_D, rivets, 0, 5.0, 0);
  instance(new THREE.CylinderGeometry(0.017, 0.017, 0.020, 6), GALV, railBolts, 0, 5.0, 0);

  // --- markings: a painted hazard block and a bay tag -----------------------
  B(0.28, 0.20, 0.012, ORANGE, -2.20, 1.85, Z_CR + 0.008);
  B(0.32, 0.24, 0.008, GALV_D, -2.20, 1.85, Z_CR + 0.003);
  B(0.18, 0.18, 0.012, YELLOW, 2.60, 1.85, Z_CR + 0.008);

  // --- place ----------------------------------------------------------------
  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= box.min.y; m.position.z -= c.z; });

  return g;
}
