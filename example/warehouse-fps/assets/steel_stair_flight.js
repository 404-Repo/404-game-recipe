// steel_stair_flight — arm B: built from swept profiles.
// The stringer is one ExtrudeGeometry whose outline is drawn in the ZY plane, so
// its ends are cut SQUARE (vertical at the base, level at the landing) the way a
// real plate stringer is - a rotated box can only be cut perpendicular to the
// slope. Treads are extruded panels with the grating slots cut as holes, and the
// handrail is a tube swept along a curve that turns onto the landing.
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
  // sweep a closed (u,v) profile along X. u becomes -Z, v becomes Y.
  const sweepX = (pts, len) => {
    const sh = new THREE.Shape();
    sh.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
    sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false });
    geo.translate(0, 0, -len / 2);
    geo.rotateY(Math.PI / 2);
    return geo;
  };

  const RISE = 2.500, NRISE = 13, R = RISE / NRISE;
  const NOSE1 = 1.550, LAND_F = -1.150, LAND_B = -1.600;
  const G = (NOSE1 - LAND_F) / 12;
  const ANG = Math.atan2(R, G);
  const CA = Math.cos(ANG), TA = R / G;
  const RX = 0.528, RAIL_R = 0.022, RAIL_TOP = 3.500;
  const OFF = (RAIL_TOP - RAIL_R) - RISE;
  const nosingY = (z) => R + (NOSE1 - z) * TA;
  const topEdge = (z) => nosingY(z) - 0.030 / CA;

  // ---- plate stringer, square cut at both ends -----------------------------
  const zC = NOSE1 - (0.020 + 0.330 / CA - R) / TA;
  const yF = topEdge(LAND_F);
  const P = (z, y) => [-z, y];
  const stringer = sweepX([
    P(1.600, topEdge(1.600)),
    P(1.600, 0.020),
    P(zC, 0.020),
    P(LAND_F - 0.070, topEdge(LAND_F - 0.070) - 0.300 / CA),
    P(LAND_F - 0.070, yF),
    P(LAND_F, yF),
  ], 0.020);
  for (const s of [-1, 1]) {
    add(stringer, YEL, s * 0.540, 0, 0);
    add(box(0.200, 0.020, 0.220), GUN, s * 0.450, 0.010, 1.490);
    add(box(0.018, 0.110, 0.130), STEELD, s * 0.519, 0.075, 1.480);
  }
  const baseBolts = [];
  for (const s of [-1, 1])
    for (const dx of [-0.070, 0.070])
      for (const dz of [-0.075, 0.075])
        baseBolts.push([s * 0.450 + dx, 0.028, 1.490 + dz]);
  inst(cyl(0.011, 0.020, 6), RUST, baseBolts);

  // ---- knee-height wear plate, stencil plate, rivet line -------------------
  const rivets = [];
  for (const s of [-1, 1]) {
    add(box(0.006, 0.120, 0.320), RUST, s * 0.552, 0.460, 0.960);
    add(box(0.006, 0.130, 0.200), ORA,  s * 0.552, 1.280, 0.000);
    for (let i = 0; i < 10; i++) {
      const z = 1.40 - i * 0.260;
      rivets.push([s * 0.553, topEdge(z) - 0.075, z, 0, 0, Math.PI / 2]);
    }
  }
  inst(cyl(0.009, 0.008, 6), RUST, rivets);

  // ---- extruded grated tread panel, reused 12 times ------------------------
  const tShape = new THREE.Shape();
  tShape.moveTo(-0.530, -0.1175);
  tShape.lineTo( 0.530, -0.1175);
  tShape.lineTo( 0.530,  0.1175);
  tShape.lineTo(-0.530,  0.1175);
  tShape.closePath();
  for (let j = 0; j < 7; j++) {
    const cz = -0.1175 + 0.0294 * (j + 1);
    const h = new THREE.Path();
    h.moveTo(-0.492, cz - 0.009);
    h.lineTo(-0.492, cz + 0.009);
    h.lineTo( 0.492, cz + 0.009);
    h.lineTo( 0.492, cz - 0.009);
    h.closePath();
    tShape.holes.push(h);
  }
  const tread = new THREE.ExtrudeGeometry(tShape, { depth: 0.030, bevelEnabled: false });
  tread.rotateX(-Math.PI / 2);
  const cleats = [];
  for (let k = 1; k <= 12; k++) {
    const zn = NOSE1 - (k - 1) * G, ty = k * R;
    add(tread, GALV, 0, ty - 0.030, zn - 0.1175);
    add(box(1.060, 0.038, 0.026), GALVD, 0, ty - 0.019, zn - 0.013);
    for (const s of [-1, 1]) {
      add(box(0.014, 0.070, 0.120), STEEL, s * 0.523, ty - 0.048, zn - 0.117);
      cleats.push([s * 0.534, ty - 0.032, zn - 0.117, 0, 0, Math.PI / 2]);
    }
  }
  inst(cyl(0.009, 0.010, 6), RUST, cleats);

  // ---- landing -------------------------------------------------------------
  add(box(1.060, 0.080, 0.050), STEEL, 0, 2.460, -1.170);
  add(box(1.060, 0.080, 0.050), STEEL, 0, 2.460, -1.580);
  for (const s of [-1, 1]) add(box(0.050, 0.080, 0.400), STEEL, s * 0.500, 2.460, -1.375);
  const lShape = new THREE.Shape();
  lShape.moveTo(-0.530, -0.210); lShape.lineTo(0.530, -0.210);
  lShape.lineTo(0.530, 0.210);  lShape.lineTo(-0.530, 0.210); lShape.closePath();
  for (let j = 0; j < 12; j++) {
    const cz = -0.210 + 0.0323 * (j + 1);
    const h = new THREE.Path();
    h.moveTo(-0.492, cz - 0.010); h.lineTo(-0.492, cz + 0.010);
    h.lineTo(0.492, cz + 0.010);  h.lineTo(0.492, cz - 0.010); h.closePath();
    lShape.holes.push(h);
  }
  const lPanel = new THREE.ExtrudeGeometry(lShape, { depth: 0.028, bevelEnabled: false });
  lPanel.rotateX(-Math.PI / 2);
  add(lPanel, GALV, 0, 2.472, -1.375);
  for (const s of [-1, 1]) add(box(0.016, 0.110, 0.450), YEL, s * 0.532, 2.555, -1.375);
  add(box(1.060, 0.150, 0.014), GUN, 0, 2.440, -1.593);
  const endBolts = [];
  for (let i = 0; i < 6; i++) endBolts.push([-0.42 + i * 0.168, 2.440, -1.578]);
  inst(cyl(0.011, 0.024, 6), RUST, endBolts);

  // ---- handrail swept along a curve that turns onto the landing ------------
  const sweepRail = (s, vOff, radius) => {
    const pts = [];
    for (let i = 0; i <= 5; i++) {
      const z = NOSE1 - (NOSE1 - LAND_F) * (i / 5);
      pts.push(new THREE.Vector3(s * RX, nosingY(z) + vOff, z));
    }
    pts.push(new THREE.Vector3(s * RX, RISE + vOff, -1.320));
    pts.push(new THREE.Vector3(s * RX, RISE + vOff, -1.555));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.2);
    return new THREE.TubeGeometry(curve, 18, radius, 6, false);
  };
  for (const s of [-1, 1]) {
    g.add(new THREE.Mesh(sweepRail(s, OFF, RAIL_R), GALV));
    g.add(new THREE.Mesh(sweepRail(s, 0.500, 0.018), GALVD));
    for (let k = 1; k <= 12; k++) {
      const z = NOSE1 - (k - 0.5) * G;
      const yb = topEdge(z), yt = nosingY(z) + OFF;
      add(cyl(0.012, yt - yb, 6), GALVD, s * RX, (yb + yt) / 2, z);
    }
    for (const z of [-1.200, -1.520]) add(cyl(0.014, 0.978, 6), GALVD, s * RX, RISE + 0.489, z);
    add(cyl(RAIL_R, 1.020, 8), GALV, s * RX, (topEdge(NOSE1) + nosingY(NOSE1) + OFF) / 2, NOSE1);
  }

  // ---- placement ------------------------------------------------------------
  const box3 = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box3.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box3.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= box3.min.y; m.position.z -= c.z; });

  return g;
}
