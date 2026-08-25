// roller_shutter_door — arm B: built from profiles.
// Closed. The curtain is ONE sweep: the corrugated slat profile drawn as a
// folded sheet of constant thickness and extruded across the opening, so the
// slats are curved on the back as well as the front. The hood is a swept
// hexagonal section and the guides are swept C-channels.
//
// g.userData.curtain is the whole curtain as one Object3D. It only survives
// loading with { keepHierarchy: true }; ASSET() merges by material otherwise.
export default function (THREE) {
  const g = new THREE.Group();

  const mat = (color, name, r, m, dbl) => {
    const s = new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m });
    if (dbl) s.side = THREE.DoubleSide;
    if (name) s.name = name;
    return s;
  };
  const SLAT    = mat(0x878c8f, 'metal', 0.66, 0.40);
  const STEEL   = mat(0x5b6167, 'metal', 0.76, 0.18);
  const STEEL_L = mat(0x646a70, 'metal', 0.70, 0.22);
  const GALV    = mat(0x9aa0a3, 'metal', 0.60, 0.62);
  const GALV_D  = mat(0x8d9396, 'metal', 0.66, 0.55);
  const GUN     = mat(0x3a3d40, 'metal', 0.70, 0.45);
  const RUST    = mat(0x6e4128, 'metal', 0.93, 0.08);
  const RUBBER  = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.92, metalness: 0.05 });
  const ORANGE  = mat(0xbe5220, 'metal', 0.82, 0.06);
  const YELLOW  = mat(0xd6a41f, 'metal', 0.80, 0.06);

  const EX = (shape, len) =>
    new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false, steps: 1, curveSegments: 4 });
  const poly = (pts) => {
    const s = new THREE.Shape();
    s.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
    s.closePath();
    return s;
  };
  // horizontal run: profile drawn in (z, y), swept along -X from x = +len/2
  const run = (parent, pts, len, material, y) => {
    const geo = EX(poly(pts), len);
    geo.rotateY(-Math.PI / 2);
    const m = new THREE.Mesh(geo, material);
    m.position.set(len / 2, y, 0);
    parent.add(m);
    return m;
  };
  // vertical post: profile drawn in (x, -z), swept up +Y from y0
  const post = (parent, pts, len, material, x, y0) => {
    const geo = EX(poly(pts), len);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y0, 0);
    parent.add(m);
    return m;
  };
  const B = (parent, w, h, d, m, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const instance = (parent, geo, material, list, px, py, pz) => {
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
    parent.add(im);
    return im;
  };

  const GX = 1.80, CW = 3.46;
  const HOOD_Y0 = 3.94, H = 4.50;
  const SLAT_Y0 = 0.09, SLAT_Y1 = 3.89, PITCH = 0.10;
  const N = Math.round((SLAT_Y1 - SLAT_Y0) / PITCH);

  // ---- curtain -------------------------------------------------------------
  const curtain = new THREE.Group();
  g.add(curtain);
  g.userData.curtain = curtain;

  {
    const front = [];
    for (let i = 0; i < N; i++) {
      const y = SLAT_Y0 + i * PITCH;
      front.push([0.000, y], [0.026, y + 0.016], [0.034, y + 0.050], [0.026, y + 0.084]);
    }
    front.push([0.000, SLAT_Y0 + N * PITCH]);
    const pts = front.concat(front.slice().reverse().map((p) => [p[0] - 0.019, p[1]]));
    const geo = EX(poly(pts), CW);
    geo.rotateY(-Math.PI / 2);
    const m = new THREE.Mesh(geo, SLAT);
    m.position.x = CW / 2;
    curtain.add(m);
  }
  // end locks riding in the guides
  const locks = [];
  for (let i = 0; i < N; i += 2) {
    const y = SLAT_Y0 + (i + 0.5) * PITCH;
    for (const sx of [-1, 1]) locks.push({ p: [sx * (CW / 2 + 0.025), y, 0.008] });
  }
  instance(curtain, new THREE.BoxGeometry(0.060, 0.086, 0.046), GALV_D, locks, 0, 2.0, 0);

  // knee-height kick plate, 0.30 - 0.60 m
  B(curtain, CW - 0.08, 0.30, 0.014, GALV, 0, 0.45, 0.048);
  run(curtain, [[0.040, -0.013], [0.060, -0.013], [0.060, 0.013], [0.040, 0.013]], CW - 0.08, GALV_D, 0.312);
  run(curtain, [[0.040, -0.013], [0.060, -0.013], [0.060, 0.013], [0.040, 0.013]], CW - 0.08, GALV_D, 0.588);
  B(curtain, 0.34, 0.11, 0.012, RUST, -0.95, 0.78, 0.036);
  B(curtain, 0.26, 0.09, 0.012, RUST, 1.20, 1.05, 0.036);

  // bottom rail: a swept T-section with a rubber astragal under it
  run(curtain, [[-0.050, 0.022], [0.050, 0.022], [0.050, 0.042], [0.014, 0.042],
                [0.014, 0.098], [-0.014, 0.098], [-0.014, 0.042], [-0.050, 0.042]],
    CW + 0.02, STEEL_L, 0);
  run(curtain, [[-0.030, 0.000], [0.030, 0.000], [0.030, 0.024], [-0.030, 0.024]], CW + 0.02, RUBBER, 0);
  B(curtain, 0.24, 0.055, 0.030, GUN, 0, 0.062, 0.062);

  // ---- guides: swept C-channels, opening toward the curtain ----------------
  const frameBolts = [];
  for (const sx of [-1, 1]) {
    // the channel mouth has to face the curtain, so the notch sits on the
    // INBOARD side: k = -sx, not sx
    const k = -sx;
    const chan = [[k * 0.070, 0.085], [-k * 0.070, 0.085], [-k * 0.070, -0.085],
                  [k * 0.070, -0.085], [k * 0.070, -0.052], [-k * 0.032, -0.052],
                  [-k * 0.032, 0.052], [k * 0.070, 0.052]];
    post(g, chan, HOOD_Y0 - 0.03, STEEL, sx * GX, 0.03);
    B(g, 0.30, 0.030, 0.24, STEEL, sx * GX, 0.015, 0);
    B(g, 0.16, 0.055, 0.19, STEEL_L, sx * GX, HOOD_Y0 - 0.02, 0);
    B(g, 0.17, 0.10, 0.20, RUST, sx * GX, 0.09, 0);
    for (const y of [0.10, 1.05, 2.05, 3.05, 3.80]) {
      frameBolts.push({ p: [sx * GX, y, 0.090], r: [Math.PI / 2, 0, 0] });
      frameBolts.push({ p: [sx * GX, y, -0.090], r: [Math.PI / 2, 0, 0] });
    }
    for (const bx of [-0.11, 0.11]) for (const bz of [-0.085, 0.085]) {
      frameBolts.push({ p: [sx * GX + bx, 0.036, bz] });
    }
  }
  instance(g, new THREE.CylinderGeometry(0.019, 0.019, 0.026, 6), GALV_D, frameBolts, 0, 2.0, 0);

  // ---- barrel housing: one swept hexagonal section --------------------------
  run(g, [[-0.150, -0.280], [0.062, -0.280], [0.150, -0.186], [0.150, 0.244],
          [0.104, 0.280], [-0.150, 0.280]], 3.90, STEEL, H - 0.28);
  B(g, 4.00, 0.022, 0.30, STEEL_L, 0, H - 0.011, 0);
  B(g, 3.90, 0.030, 0.020, GALV_D, 0, H - 0.50, 0.140);
  for (const sx of [-1, 1]) B(g, 0.022, 0.60, 0.30, STEEL_L, sx * 1.94, H - 0.30, 0);
  B(g, 1.30, 0.10, 0.012, RUST, -0.60, H - 0.10, 0.142);

  // ---- gear motor -----------------------------------------------------------
  B(g, 0.28, 0.46, 0.24, GUN, 1.86, H - 0.30, 0.02);
  B(g, 0.30, 0.055, 0.26, STEEL_L, 1.86, H - 0.075, 0.02);
  B(g, 0.20, 0.16, 0.030, GALV_D, 1.86, H - 0.42, 0.15);
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.055, 12), STEEL_L);
  sp.position.set(1.70, H - 0.34, 0.02); sp.rotation.z = Math.PI / 2; g.add(sp);
  B(g, 0.030, 0.90, 0.030, GUN, 1.79, H - 0.95, 0.12);
  B(g, 0.10, 0.16, 0.070, GUN, 1.79, H - 1.44, 0.12);

  // ---- markings -------------------------------------------------------------
  B(g, 0.26, 0.18, 0.012, ORANGE, -1.80, 1.55, 0.098);
  B(g, 0.30, 0.22, 0.008, GALV_D, -1.80, 1.55, 0.093);
  B(g, 0.18, 0.18, 0.012, YELLOW, 1.80, 1.55, 0.098);

  // ---- place ---------------------------------------------------------------
  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= box.min.y; m.position.z -= c.z; });

  return g;
}
