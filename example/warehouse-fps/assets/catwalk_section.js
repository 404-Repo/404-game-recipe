// catwalk_section — arm A: assembled from primitives (Box / Cylinder / InstancedMesh).
// Straight 4.00 m tiling run of steel catwalk. Welded I-section stringers, open bar
// grating deck, tubular handrail + mid rail + toe kickplate down BOTH long sides.
export default function (THREE) {
  const g = new THREE.Group();

  const M = (c, n, r, mt, ds) => {
    const s = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: mt });
    if (n) s.name = n;
    if (ds) s.side = THREE.DoubleSide;
    return s;
  };
  const STEEL  = M(0x5b6167, 'metal', 0.82, 0.18);
  const STEELD = M(0x555b60, 'metal', 0.86, 0.16);
  const GALV   = M(0x9aa0a3, 'metal', 0.70, 0.60, true);
  const GALVD  = M(0x8f9598, 'metal', 0.74, 0.55, true);
  const YEL    = M(0xd6a41f, 'metal', 0.84, 0.10);
  const YELD   = M(0xc59a22, 'metal', 0.88, 0.08);
  const RUST   = M(0x6e4128, 'metal', 0.92, 0.25);
  const GUN    = M(0x3a3d40, 'metal', 0.78, 0.30);
  const ORA    = M(0xbe5220, 'metal', 0.85, 0.10);

  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (r, h, s) => new THREE.CylinderGeometry(r, r, h, s || 8);
  const add = (geo, mtl, x, y, z, rx, ry, rz) => {
    const m = new THREE.Mesh(geo, mtl);
    m.position.set(x, y, z);
    m.rotation.set(rx || 0, ry || 0, rz || 0);
    g.add(m);
    return m;
  };
  const inst = (geo, mtl, list) => {
    // The six canonical placement lines below traverse with n.matrixWorld and do
    // NOT expand instance matrices, so an InstancedMesh left at the origin drags
    // its prototype geometry's AABB into the measurement. Park the instanced mesh
    // at the centroid of its instances and store instance offsets relative to it:
    // the prototype box then lands inside the real object and the maths is exact.
    let mx = 0, my = 0, mz = 0;
    list.forEach((t) => { mx += t[0]; my += t[1]; mz += t[2]; });
    mx /= list.length; my /= list.length; mz /= list.length;
    const im = new THREE.InstancedMesh(geo, mtl, list.length);
    im.position.set(mx, my, mz);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    const e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    list.forEach((t, i) => {
      p.set(t[0] - mx, t[1] - my, t[2] - mz);
      e.set(t[3] || 0, t[4] || 0, t[5] || 0);
      q.setFromEuler(e);
      sc.set(t[6] === undefined ? 1 : t[6], t[7] === undefined ? 1 : t[7], t[8] === undefined ? 1 : t[8]);
      m4.compose(p, q, sc);
      im.setMatrixAt(i, m4);
    });
    im.instanceMatrix.needsUpdate = true;
    g.add(im);
    return im;
  };

  const L = 4.00;                 // tiles end to end along X, flush at x = +/-2.00
  const SZ = 0.52;                // stringer web centreline in Z
  const STOP = 0.14;              // top of the stringers
  const DECK = 0.16;              // walking surface = STOP + 0.02
  const RTOP = 1.10;              // top of handrail = overall height
  const RZ = 0.556;               // handrail / post centreline in Z
  const TZ = 0.585;               // toe kickplate face in Z

  // ---- welded I-section stringers, both sides -------------------------------
  for (const s of [-1, 1]) {
    add(box(L, 0.020, 0.160), STEEL,  0, 0.010, s * SZ);   // bottom flange
    add(box(L, 0.100, 0.020), STEELD, 0, 0.070, s * SZ);   // web
    add(box(L, 0.020, 0.160), STEEL,  0, 0.130, s * SZ);   // top flange
    for (const x of [-1.90, -0.63, 0.63, 1.90])            // bearing stiffeners
      add(box(0.012, 0.098, 0.140), STEELD, x, 0.070, s * SZ);
  }

  // ---- transverse joists and underslung bracing -----------------------------
  for (const x of [-1.60, -0.80, 0.00, 0.80, 1.60])
    add(box(0.060, 0.060, 1.020), STEELD, x, 0.105, 0);
  add(box(2.00, 0.030, 0.030), STEELD, -0.95, 0.050, 0, 0,  0.45, 0);
  add(box(2.00, 0.030, 0.030), STEELD,  0.95, 0.050, 0, 0, -0.45, 0);

  // ---- open bar grating deck (InstancedMesh, DoubleSide) --------------------
  const NB = 64, pb = L / NB;
  const bars = [];
  for (let i = 0; i < NB; i++) bars.push([-L / 2 + pb * (i + 0.5), 0.148, 0]);
  inst(box(0.006, 0.024, 1.020), GALV, bars);

  const NR = 13, pr = 1.020 / NR;
  const rods = [];
  for (let i = 0; i < NR; i++) rods.push([0, 0.150, -0.510 + pr * (i + 0.5)]);
  inst(box(L, 0.008, 0.008), GALVD, rods);

  for (const s of [-1, 1]) add(box(L, 0.028, 0.012), GALVD, 0, 0.146, s * 0.505);

  // ---- toe kickplate with top return, both long sides -----------------------
  for (const s of [-1, 1]) {
    add(box(L, 0.300, 0.018), YEL,  0, 0.310, s * TZ);
    add(box(L, 0.020, 0.055), YELD, 0, 0.450, s * (TZ - 0.028));
  }

  // ---- hazard chevrons (stencilled marking, geometry only) ------------------
  for (const s of [-1, 1])
    for (let i = 0; i < 4; i++)
      add(box(0.070, 0.230, 0.006), ORA, -1.35 + i * 0.90, 0.310, s * 0.5965, 0, 0, s * 0.42);

  // ---- load-rating plates ---------------------------------------------------
  for (const s of [-1, 1]) {
    add(box(0.160, 0.100, 0.006), GALVD, -1.85, 0.310, s * 0.5965);
    add(box(0.220, 0.090, 0.008), ORA,   -1.20, 0.075, s * 0.534);
  }

  // ---- handrail: posts, top rail, mid rail ----------------------------------
  const POSTS = [-1.90, -0.63, 0.63, 1.90];
  const boltList = [];
  for (const s of [-1, 1]) {
    for (const x of POSTS) {
      add(box(0.140, 0.014, 0.110), GUN, x, 0.147, s * 0.545);
      add(cyl(0.028, RTOP - 0.154, 8), YEL, x, (0.154 + RTOP) / 2, s * RZ);
      for (const dx of [-0.048, 0.048])
        for (const dz of [-0.034, 0.034])
          boltList.push([x + dx, 0.161, s * 0.545 + dz]);
    }
    add(cyl(0.024, L, 8), YEL,  0, RTOP - 0.024, s * RZ, 0, 0, Math.PI / 2);
    add(cyl(0.020, L, 8), YELD, 0, 0.630,        s * RZ, 0, 0, Math.PI / 2);
  }
  inst(cyl(0.009, 0.014, 6), RUST, boltList);

  // ---- bolted splice plates at both ends (this is where it tiles) -----------
  const spliceBolts = [];
  for (const s of [-1, 1])
    for (const ex of [-1, 1]) {
      add(box(0.014, 0.140, 0.160), GUN, ex * 1.993, 0.075, s * SZ);
      for (const dy of [-0.045, 0.045])
        for (const dz of [-0.052, 0.052])
          spliceBolts.push([ex * 1.975, 0.070 + dy, s * SZ + dz, 0, 0, Math.PI / 2]);
    }
  inst(cyl(0.010, 0.024, 6), RUST, spliceBolts);

  // ---- placement ------------------------------------------------------------
  const box3 = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box3.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box3.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= box3.min.y; m.position.z -= c.z; });

  return g;
}
