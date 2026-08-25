// pallet_jack — arm B: swept profiles. The fork is one side-elevation Shape,
// roller pocket and tapered nose included, extruded across its own width; the
// frame plates and the tiller are drawn the same way. 0.55 x 1.60 x 1.25.
export default function (THREE) {
  const g = new THREE.Group();
  const DS = THREE.DoubleSide;

  const mk = (color, name, rough, metal, opts) => {
    const m = new THREE.MeshStandardMaterial(Object.assign(
      { color, roughness: rough === undefined ? 0.82 : rough, metalness: metal === undefined ? 0.14 : metal }, opts || {}));
    if (name) m.name = name;
    return m;
  };
  const RED   = mk(0x8c3a2b, 'metal', 0.84, 0.10);
  const RED2  = mk(0x7f3427, 'metal', 0.88, 0.08);
  const STEEL = mk(0x5b6167, 'metal', 0.78, 0.22);
  const GUN   = mk(0x3a3d40, 'metal', 0.72, 0.32);
  const GALV  = mk(0x9aa0a3, 'metal', 0.62, 0.55);
  const RUST  = mk(0x6e4128, 'metal', 0.92, 0.08);
  const DARK  = mk(0x2a2c2e, 'metal', 0.82, 0.18);
  const ORNG  = mk(0xbe5220, 'metal', 0.84, 0.10);
  const RUB   = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.93, metalness: 0.02 });

  const add = (geo, mat, x, y, z, rx, ry, rz, parent) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0);
    (parent || g).add(m);
    return m;
  };
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const CYL = (r1, r2, h, s, open) => new THREE.CylinderGeometry(r1, r2, h, s, 1, !!open);
  const poly = (pts) => {
    const s = new THREE.Shape();
    s.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
    s.closePath();
    return s;
  };
  // bevelEnabled: false. A bevel grows the profile outward on every side and
  // drops it below its own base; a 55mm fork blade would come out 65mm.
  const ex = (shape, depth) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 4, steps: 1 });
    geo.translate(0, 0, -depth / 2);
    return geo;
  };

  const boltGeo = new THREE.CylinderGeometry(0.014, 0.017, 0.012, 8);
  function bolts(list, rx, ry, rz, mat) {
    const im = new THREE.InstancedMesh(boltGeo, mat || GALV, list.length);
    im.position.set(0, 0.30, -0.45);     // inside the head, so the prototype cannot set an extent
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(),
          s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    q.setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0));
    list.forEach((v, i) => { p.set(v[0], v[1] - 0.30, v[2] + 0.45); im.setMatrixAt(i, m4.compose(p, q, s)); });
    im.instanceMatrix.needsUpdate = true;
    g.add(im);
  }

  // ---- fork: one profile, swept across the blade width -----------------------
  // u runs along +Z from the heel, v is height. The notch on the underside is the
  // load-roller pocket; the nose taper is in the profile, never a vertex scale.
  const forkShape = poly([
    [0.00, 0.165], [0.11, 0.165], [0.11, 0.092], [0.88, 0.078], [1.10, 0.055],
    [1.10, 0.030], [1.02, 0.024], [0.99, 0.024], [0.99, 0.080], [0.90, 0.080],
    [0.90, 0.024], [0.11, 0.024], [0.11, 0.000], [0.00, 0.000],
  ]);
  const forkGeo = ex(forkShape, 0.155);
  for (const sx of [-1, 1]) {
    const x = sx * 0.195;
    add(forkGeo, GUN, x, 0.000, -0.31, 0, -Math.PI / 2, 0);
    add(B(0.158, 0.018, 0.78), RUST, x, 0.029, 0.16);       // scraped underside
    add(CYL(0.042, 0.042, 0.078, 12), RUB, x, 0.045, 0.635, 0, 0, Math.PI / 2);
    add(CYL(0.015, 0.015, 0.115, 8), GALV, x, 0.045, 0.635, 0, 0, Math.PI / 2);
    add(CYL(0.015, 0.015, 0.80, 6), STEEL, x, 0.105, 0.16, Math.PI / 2, 0, 0);  // push rod
    add(B(0.05, 0.055, 0.05), STEEL, x, 0.105, 0.58);
  }
  add(B(0.50, 0.09, 0.055), RED, 0, 0.118, -0.355);
  add(B(0.52, 0.03, 0.05), RUST, 0, 0.064, -0.355);

  // ---- frame side plates: swept triangles ------------------------------------
  const plateShape = poly([
    [0.00, 0.115], [0.36, 0.115], [0.36, 0.225], [0.11, 0.520], [0.00, 0.520],
  ]);
  const plateGeo = ex(plateShape, 0.030);
  for (const sx of [-1, 1]) {
    add(plateGeo, RED, sx * 0.185, 0, -0.62, 0, -Math.PI / 2, 0);
    add(B(0.046, 0.055, 0.34), RED2, sx * 0.207, 0.31, -0.44, -0.86, 0, 0);   // folded top flange
    add(B(0.038, 0.11, 0.038), STEEL, sx * 0.185, 0.16, -0.30);
  }
  add(B(0.40, 0.17, 0.05), RED, 0, 0.30, -0.30);
  add(B(0.40, 0.09, 0.05), RED2, 0, 0.50, -0.53);
  add(B(0.16, 0.10, 0.012), GALV, 0.10, 0.33, -0.272);
  add(B(0.10, 0.07, 0.012), ORNG, -0.12, 0.33, -0.272);
  // scuff band 0.34..0.46
  add(B(0.44, 0.05, 0.38), DARK, 0, 0.395, -0.46);
  add(B(0.445, 0.022, 0.385), RUST, 0, 0.352, -0.46);

  // ---- lift linkage + pivot castings -----------------------------------------
  for (const sx of [-1, 1]) {
    const x = sx * 0.195;
    add(CYL(0.030, 0.030, 0.09, 10), GUN, x, 0.13, -0.30, 0, 0, Math.PI / 2);   // heel pivot boss
    add(CYL(0.013, 0.013, 0.13, 8), GALV, x, 0.13, -0.30, 0, 0, Math.PI / 2);   // pin
    add(B(0.030, 0.22, 0.05), STEEL, x, 0.22, -0.38, 0.55, 0, 0);               // lift link
    add(B(0.05, 0.05, 0.05), GUN, x, 0.31, -0.44);
    add(B(0.028, 0.05, 0.16), RUST, x + sx * 0.066, 0.07, 0.30);                // chipped paint
  }
  add(B(0.05, 0.05, 0.22), GUN, 0, 0.115, -0.14);                               // centre tie
  add(B(0.10, 0.04, 0.04), RUST, -0.12, 0.42, -0.28);
  add(B(0.07, 0.05, 0.03), RUST, 0.15, 0.24, -0.283);

  // ---- pump ------------------------------------------------------------------
  add(CYL(0.078, 0.078, 0.34, 12), RED, 0, 0.28, -0.50);
  add(CYL(0.084, 0.084, 0.04, 12), GUN, 0, 0.46, -0.50);
  add(CYL(0.032, 0.032, 0.15, 10), GALV, 0, 0.545, -0.50);
  add(B(0.10, 0.05, 0.12), GUN, 0, 0.14, -0.60);
  add(CYL(0.018, 0.018, 0.24, 6), RUB, 0.07, 0.28, -0.43, 0.5, 0, 0);

  // ---- steer wheels ----------------------------------------------------------
  add(B(0.26, 0.10, 0.16), STEEL, 0, 0.14, -0.615);
  add(CYL(0.05, 0.05, 0.12, 10), GUN, 0, 0.22, -0.615);
  for (const sx of [-1, 1]) {
    add(CYL(0.090, 0.090, 0.058, 16), RUB, sx * 0.105, 0.090, -0.615, 0, 0, Math.PI / 2);
    add(CYL(0.044, 0.044, 0.062, 10), GALV, sx * 0.105, 0.090, -0.615, 0, 0, Math.PI / 2);
    add(B(0.022, 0.13, 0.11), STEEL, sx * 0.145, 0.115, -0.615);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      add(B(0.052, 0.055, 0.020), GALV, sx * 0.105, 0.090 + Math.cos(a) * 0.055, -0.615 + Math.sin(a) * 0.055, a, 0, 0);
    }
  }
  add(CYL(0.016, 0.016, 0.30, 8), GALV, 0, 0.090, -0.615, 0, 0, Math.PI / 2);

  // ---- tiller ----------------------------------------------------------------
  // The rake is the whole character of the object, and its sign is the trap:
  // rotation.x must be NEGATIVE to lay the handle back over the steer wheels.
  const till = new THREE.Group();
  till.position.set(0, 0.34, -0.50);
  till.rotation.x = -0.29;
  g.add(till);
  const tillShape = poly([
    [-0.065, 0.00], [0.065, 0.00], [0.048, 0.50], [0.045, 0.80], [-0.045, 0.80], [-0.048, 0.50],
  ]);
  add(ex(tillShape, 0.05), STEEL, 0, 0, 0, 0, 0, 0, till);
  add(B(0.115, 0.10, 0.065), GUN, 0, 0.04, 0, 0, 0, 0, till);
  add(B(0.078, 0.16, 0.072), DARK, 0, 0.26, 0, 0, 0, 0, till);
  add(B(0.09, 0.40, 0.026), RED2, 0, 0.32, -0.038, 0, 0, 0, till);
  add(CYL(0.011, 0.011, 0.68, 6), GALV, 0.028, 0.44, 0.032, 0, 0, 0, till);
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.021, 5, 10, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.9, metalness: 0.05, side: DS }));
  loop.position.set(0, 0.80, 0);
  till.add(loop);
  for (const sx of [-1, 1]) {
    add(CYL(0.021, 0.021, 0.12, 8), RUB, sx * 0.14, 0.74, 0, 0, 0, 0, till);
    add(B(0.055, 0.10, 0.055), GUN, sx * 0.072, 0.70, 0, 0, 0, 0, till);
  }
  add(B(0.20, 0.030, 0.05), GUN, 0, 0.70, -0.03, 0, 0, 0, till);
  add(B(0.05, 0.13, 0.030), GUN, 0.10, 0.755, -0.05, 0.4, 0, 0, till);
  add(B(0.12, 0.08, 0.010), GALV, 0, 0.52, 0.030, 0, 0, 0, till);

  // ---- fixings ---------------------------------------------------------------
  const bz = [];
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) bz.push([sx * 0.185, 0.20 + i * 0.10, -0.272]);
  bz.push([0, 0.24, -0.272], [0.12, 0.24, -0.272], [-0.12, 0.24, -0.272]);
  bolts(bz, Math.PI / 2, 0, 0);
  const bx = [];
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) bx.push([sx * 0.201, 0.24 + i * 0.09, -0.40 - i * 0.06]);
  for (const sx of [-1, 1]) bx.push([sx * 0.213, 0.09, -0.30], [sx * 0.213, 0.075, 0.60]);
  bolts(bx, 0, 0, Math.PI / 2);

  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= box.min.y; m.position.z -= c.z; });
  return g;
}
