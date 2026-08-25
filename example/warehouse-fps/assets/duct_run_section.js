// duct_run_section — arm B: built from swept profiles.
// The duct is ONE ExtrudeGeometry of a rectangular ring cross-section swept the
// full 4.00 m, so the open ends show a real 10 mm sheet wall instead of four
// boxes butted together. Flanges are extruded rings on the same bore and the
// hangers are extruded angle iron.
export default function (THREE) {
  const g = new THREE.Group();

  const M = (c, n, r, mt, ds) => {
    const s = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: mt });
    if (n) s.name = n;
    if (ds) s.side = THREE.DoubleSide;
    return s;
  };
  const GALV   = M(0x9aa0a3, 'metal', 0.68, 0.62, true);
  const GALVD  = M(0x8f9598, 'metal', 0.74, 0.56, true);
  const GALVL  = M(0xa3a9ac, 'metal', 0.66, 0.60);
  const STEEL  = M(0x5b6167, 'metal', 0.82, 0.18);
  const RUST   = M(0x6e4128, 'metal', 0.92, 0.25);
  const GUN    = M(0x3a3d40, 'metal', 0.78, 0.30);
  const ORA    = M(0xbe5220, 'metal', 0.85, 0.10);
  const YEL    = M(0xd6a41f, 'metal', 0.84, 0.10);

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
    let mx = 0, my = 0, mz = 0;
    list.forEach((t) => { mx += t[0]; my += t[1]; mz += t[2]; });
    mx /= list.length; my /= list.length; mz /= list.length;
    const im = new THREE.InstancedMesh(geo, mtl, list.length);
    im.position.set(mx, my, mz);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    const e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
    list.forEach((t, i) => {
      p.set(t[0] - mx, t[1] - my, t[2] - mz);
      e.set(t[3] || 0, t[4] || 0, t[5] || 0);
      q.setFromEuler(e);
      m4.compose(p, q, sc);
      im.setMatrixAt(i, m4);
    });
    im.instanceMatrix.needsUpdate = true;
    g.add(im);
    return im;
  };
  const rect = (u0, v0, u1, v1, into) => {
    const p = into || new THREE.Shape();
    p.moveTo(u0, v0); p.lineTo(u1, v0); p.lineTo(u1, v1); p.lineTo(u0, v1); p.closePath();
    return p;
  };
  // sweep a profile (with optional holes) along X. u -> -Z, v -> Y.
  const sweepX = (shape, len) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false });
    geo.translate(0, 0, -len / 2);
    geo.rotateY(Math.PI / 2);
    return geo;
  };

  const L = 4.00, DB = 0.040, DT = 0.460, DZ = 0.250, WALL = 0.010;

  // ---- the duct itself: one swept rectangular ring -------------------------
  const bore = rect(-DZ, DB, DZ, DT);
  const hole = new THREE.Path();
  rect(-DZ + WALL, DB + WALL, DZ - WALL, DT - WALL, hole);
  bore.holes.push(hole);
  add(sweepX(bore, L), GALV, 0, 0, 0);

  // ---- flanged joints, ends flush at x = +/-2.00 --------------------------
  const flangeShape = () => {
    const s = rect(-0.290, 0.000, 0.290, 0.500);
    const h = new THREE.Path();
    rect(-DZ + WALL, DB + WALL, DZ - WALL, DT - WALL, h);
    s.holes.push(h);
    return s;
  };
  const flangeGeo = sweepX(flangeShape(), 0.014);
  const flangeBolts = [];
  const ring = (fx, bxc) => {
    add(flangeGeo, GALVL, fx, 0, 0);
    for (const bx of [-0.215, -0.110, 0.000, 0.110, 0.215]) {
      flangeBolts.push([bxc, 0.018, bx, 0, 0, Math.PI / 2]);
      flangeBolts.push([bxc, 0.482, bx, 0, 0, Math.PI / 2]);
    }
    for (const s of [-1, 1])
      for (const by of [0.110, 0.250, 0.390]) flangeBolts.push([bxc, by, s * 0.272, 0, 0, Math.PI / 2]);
  };
  ring(-1.993, -1.989); ring(-0.015, -0.015); ring(0.015, 0.015); ring(1.993, 1.989);
  inst(cyl(0.009, 0.022, 6), RUST, flangeBolts);

  // ---- angle-iron hangers: extruded L, swept 60 mm ------------------------
  const angleL = sweepX(((() => {
    const s = new THREE.Shape();
    s.moveTo(0.000, 0.000); s.lineTo(0.075, 0.000); s.lineTo(0.075, 0.009);
    s.lineTo(0.009, 0.009); s.lineTo(0.009, 0.215); s.lineTo(0.000, 0.215);
    s.closePath();
    return s;
  })()), 0.060);
  const nuts = [];
  for (const hx of [-1.780, 1.780])
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(angleL, GALVL);
      m.position.set(hx, 0.339, s * 0.2465);
      m.rotation.y = s > 0 ? 0 : Math.PI;
      g.add(m);
      add(cyl(0.008, 0.096, 6), STEEL, hx, 0.602, s * 0.286);
      nuts.push([hx, 0.564, s * 0.286]);
      nuts.push([hx, 0.545, s * 0.286]);
      for (const dy of [-0.070, 0.070]) nuts.push([hx, 0.410 + dy, s * 0.2585, 0, 0, Math.PI / 2]);
    }
  inst(cyl(0.014, 0.012, 6), GUN, nuts);

  // ---- access panel: extruded door and swaged frame -----------------------
  const PX = 0.900, PY = 0.200;
  const doorGeo = new THREE.ExtrudeGeometry(rect(-0.240, -0.125, 0.240, 0.125), { depth: 0.009, bevelEnabled: false });
  const frameShape = rect(-0.276, -0.161, 0.276, 0.161);
  const fh = new THREE.Path();
  rect(-0.246, -0.131, 0.246, 0.131, fh);
  frameShape.holes.push(fh);
  const frameGeo = new THREE.ExtrudeGeometry(frameShape, { depth: 0.013, bevelEnabled: false });
  add(doorGeo, GALVD, PX, PY, DZ + 0.001);
  add(frameGeo, GALVL, PX, PY, DZ - 0.001);
  for (const sx of [-1, 1])
    for (const sy of [-1, 1]) {
      add(box(0.020, 0.020, 0.028), GUN, PX + sx * 0.190, PY + sy * 0.098, DZ + 0.020);
      add(box(0.014, 0.072, 0.010), GUN, PX + sx * 0.190, PY + sy * 0.138, DZ + 0.026, 0, 0, sx * 0.5);
    }

  // ---- beads, ID band, plates --------------------------------------------
  for (const rx of [-1.400, -0.600, 0.600, 1.400]) {
    add(box(0.020, 0.012, 2 * DZ - 0.004), GALVD, rx, DT + 0.003, 0);
    for (const s of [-1, 1]) add(box(0.020, DT - DB - 0.030, 0.012), GALVD, rx, (DB + DT) / 2, s * (DZ + 0.003));
  }
  for (const s of [-1, 1]) add(box(L, 0.090, 0.005), ORA, 0, 0.390, s * (DZ + 0.006));
  add(box(0.180, 0.100, 0.006), YEL, -1.200, 0.200, -(DZ + 0.006));
  add(box(0.240, 0.160, 0.008), GALVL, 0.700, 0.230, -(DZ + 0.007));
  const patch = [];
  for (const px of [-0.100, 0.100])
    for (const py of [-0.060, 0.060]) patch.push([0.700 + px, 0.230 + py, -(DZ + 0.014), Math.PI / 2, 0, 0]);
  inst(cyl(0.008, 0.016, 6), RUST, patch);

  // ---- placement ------------------------------------------------------------
  const box3 = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box3.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box3.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= box3.min.y; m.position.z -= c.z; });

  return g;
}
