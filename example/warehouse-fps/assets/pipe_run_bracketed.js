// pipe_run_bracketed — arm B: built from swept profiles.
// The bracket is an extruded C-channel profile, the valve body and bonnet are
// LatheGeometry turned about their own axes (which is what a cast valve body
// actually is), and the lagging is a lathe with tucked ends rather than a
// cylinder with flat caps.
export default function (THREE) {
  const g = new THREE.Group();

  const M = (c, n, r, mt, ds) => {
    const s = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: mt });
    if (n) s.name = n;
    if (ds) s.side = THREE.DoubleSide;
    return s;
  };
  const STEEL  = M(0x5b6167, 'metal', 0.82, 0.18);
  const STEELD = M(0x545a60, 'metal', 0.86, 0.16);
  const GALV   = M(0x9aa0a3, 'metal', 0.70, 0.60, true);
  const BLUE   = M(0x2b4a63, 'metal', 0.80, 0.16, true);
  const GREY   = M(0x5b6167, 'metal', 0.78, 0.22, true);
  const LAG    = M(0xc9c6bd, 'fabric', 0.94, 0.00);
  const LAGD   = M(0xbfbcb3, 'fabric', 0.95, 0.00);
  const RED    = M(0x8c3a2b, 'metal', 0.86, 0.10);
  const GUN    = M(0x3a3d40, 'metal', 0.76, 0.32);
  const RUST   = M(0x6e4128, 'metal', 0.92, 0.25);
  const YEL    = M(0xd6a41f, 'metal', 0.84, 0.10);
  const ORA    = M(0xbe5220, 'metal', 0.85, 0.10);

  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (r, h, s) => new THREE.CylinderGeometry(r, r, h, s || 8);
  const tube = (r, h, s) => new THREE.CylinderGeometry(r, r, h, s || 12, 1, true);
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
  const XR = Math.PI / 2;
  // sweep a (u,v) profile along its own +Z by len, centred
  const sweep = (pts, len) => {
    const sh = new THREE.Shape();
    sh.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
    sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false });
    geo.translate(0, 0, -len / 2);
    return geo;
  };
  const lathe = (pts, seg) =>
    new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg || 12);

  const L = 4.00, CTOP = 0.220;
  const PIPES = [
    { r: 0.085, z: -0.165, mat: BLUE, seg: 16 },
    { r: 0.055, z:  0.005, mat: GREY, seg: 12 },
    { r: 0.038, z:  0.150, mat: GALV, seg: 8 },
  ];
  PIPES.forEach((p) => { p.y = CTOP + p.r; });
  PIPES.forEach((p) => add(tube(p.r, L, p.seg), p.mat, 0, p.y, p.z, 0, 0, XR));

  // ---- extruded C-channel bracket -----------------------------------------
  // profile centred on both axes so a swept member lands where it is positioned
  const CH = [
    [-0.035, -0.035], [0.035, -0.035], [0.035, -0.021], [-0.021, -0.021],
    [-0.021, 0.021], [0.035, 0.021], [0.035, 0.035], [-0.035, 0.035],
  ];
  const legGeo = sweep(CH, 0.204);      // swept along local +Z, stood upright below
  const beamGeo = sweep(CH, 0.500);
  // 4.000 / 3 spacing, so the frame rhythm carries unbroken across a tiled joint
  const BR = [-4 / 3, 0.000, 4 / 3];
  const baseBolts = [];
  for (const bx of BR) {
    const beam = new THREE.Mesh(beamGeo, STEEL);   // sweep axis already runs along Z
    beam.position.set(bx, CTOP - 0.035, 0);
    g.add(beam);
    for (const s of [-1, 1]) {
      // rotation.x = -PI/2 turns the sweep axis from +Z to +Y (a POSITIVE angle
      // would pitch it the other way and stand the leg on its head)
      const leg = new THREE.Mesh(legGeo, STEELD);
      leg.position.set(bx, 0.118, s * 0.205);
      leg.rotation.set(-XR, 0, s > 0 ? 0 : Math.PI);
      g.add(leg);
      add(box(0.130, 0.016, 0.140), GUN, bx, 0.008, s * 0.205);
      add(box(0.012, 0.058, 0.058), STEELD, bx, 0.188, s * 0.150);
      for (const dx of [-0.045, 0.045]) baseBolts.push([bx + dx, 0.024, s * 0.205]);
    }
  }
  inst(cyl(0.011, 0.020, 6), RUST, baseBolts);

  // ---- U-bolt clamps --------------------------------------------------------
  const uLegs = [], uNuts = [];
  for (const bx of BR)
    PIPES.forEach((p) => {
      const R = p.r + 0.013;
      const t = new THREE.Mesh(new THREE.TorusGeometry(R, 0.007, 4, 6, Math.PI), GUN);
      t.position.set(bx, p.y, p.z);
      t.rotation.y = XR;
      g.add(t);
      add(box(0.052, 0.012, 2 * R + 0.030), GUN, bx, CTOP + 0.006, p.z);
      for (const s of [-1, 1]) {
        uLegs.push([bx, (p.y + CTOP) / 2, p.z + s * R, 0, 0, 0, 1, (p.y - CTOP) / 0.10, 1]);
        uNuts.push([bx, CTOP - 0.008, p.z + s * R]);
      }
    });
  inst(cyl(0.007, 0.100, 6), GUN, uLegs);
  inst(cyl(0.011, 0.012, 6), RUST, uNuts);

  // ---- lagging, turned with tucked ends ------------------------------------
  const PA = PIPES[0], LR = 0.105;
  const bands = [];
  for (const seg of [[0.450, 1.200], [-1.250, -0.900]]) {
    const len = seg[1] - seg[0], cx = (seg[0] + seg[1]) / 2, h = len / 2;
    const geo = lathe([
      [PA.r, -h], [LR - 0.020, -h], [LR, -h + 0.026], [LR, h - 0.026],
      [LR - 0.020, h], [PA.r, h],
    ], 10);
    add(geo, LAG, cx, PA.y, PA.z, 0, 0, XR);
    for (let i = 0; i <= 3; i++) bands.push([seg[0] + (len / 3) * i, PA.y, PA.z, 0, 0, XR]);
  }
  inst(cyl(LR + 0.005, 0.016, 10), LAGD, bands);

  // ---- flanged joint, turned ------------------------------------------------
  const FX = -0.700;
  const jointGeo = lathe([
    [PA.r, -0.048], [PA.r + 0.022, -0.048], [PA.r + 0.022, -0.020], [0.110, -0.020],
    [0.110, -0.002], [0.108, -0.002], [0.108, 0.002], [0.110, 0.002],
    [0.110, 0.020], [PA.r + 0.022, 0.020], [PA.r + 0.022, 0.048], [PA.r, 0.048],
  ], 10);
  add(jointGeo, STEELD, FX, PA.y, PA.z, 0, 0, XR);
  const fBolts = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    fBolts.push([FX, PA.y + Math.sin(a) * 0.092, PA.z + Math.cos(a) * 0.092, 0, 0, XR]);
  }
  inst(cyl(0.010, 0.048, 6), RUST, fBolts);

  // ---- gate valve: body turned about the pipe axis, bonnet about the stem --
  const PB = PIPES[1], VX = 0.350;
  const bodyGeo = lathe([
    [PB.r, -0.090], [0.075, -0.090], [0.075, -0.066], [0.058, -0.058],
    [0.062, 0.000], [0.058, 0.058], [0.075, 0.066], [0.075, 0.090], [PB.r, 0.090],
  ], 10);
  add(bodyGeo, GUN, VX, PB.y, PB.z, 0, 0, XR);
  add(box(0.118, 0.096, 0.118), GUN, VX, 0.298, PB.z);
  const bonnetGeo = lathe([
    [0.062, 0.000], [0.062, 0.020], [0.058, 0.026], [0.058, 0.040],
    [0.046, 0.048], [0.042, 0.096], [0.030, 0.104], [0.014, 0.104], [0.014, 0.000],
  ], 10);
  add(bonnetGeo, GUN, VX, 0.334, PB.z);
  for (const s of [-1, 1]) add(box(0.014, 0.062, 0.014), STEELD, VX, 0.452, PB.z + s * 0.032);
  add(cyl(0.010, 0.120, 8), STEELD, VX, 0.442, PB.z);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.010, 6, 10), RED);
  wheel.position.set(VX, 0.470, PB.z);
  wheel.rotation.x = XR;
  g.add(wheel);
  add(lathe([[0.000, 0.000], [0.020, 0.000], [0.022, 0.010], [0.016, 0.022], [0.000, 0.022]], 10), RED, VX, 0.460, PB.z);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    add(box(0.062, 0.010, 0.012), RED, VX + Math.cos(a) * 0.043, 0.471, PB.z - Math.sin(a) * 0.043, 0, a, 0);
  }
  add(cyl(0.014, 0.020, 6), GUN, VX, 0.490, PB.z);
  add(box(0.070, 0.050, 0.006), YEL, VX + 0.052, 0.352, PB.z + 0.062);

  // ---- identification bands and plated markings ---------------------------
  const idb = [];
  for (const bx of [-1.900, -0.200, 1.750]) idb.push([bx, PIPES[2].y, PIPES[2].z, 0, 0, XR]);
  inst(cyl(PIPES[2].r + 0.004, 0.070, 8), ORA, idb);
  for (const bx of [-1.150, 1.150]) add(cyl(PIPES[1].r + 0.004, 0.060, 12), YEL, bx, PB.y, PB.z, 0, 0, XR);
  add(box(0.150, 0.100, 0.008), ORA, -4 / 3, 0.118, -0.213);
  add(box(0.150, 0.100, 0.008), ORA,  4 / 3, 0.118,  0.213);

  // ---- placement ------------------------------------------------------------
  const box3 = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box3.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box3.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= box3.min.y; m.position.z -= c.z; });

  return g;
}
