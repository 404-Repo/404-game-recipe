// conveyor_section — arm B: swept sections. The side rails are a real C channel
// drawn once and extruded the full 3.00 m, the legs are swept angle iron and the
// gussets are swept triangles. Tiles along X, flush at x = +/-1.50.
export default function (THREE) {
  const g = new THREE.Group();
  const DS = THREE.DoubleSide;

  const mk = (color, name, rough, metal, opts) => {
    const m = new THREE.MeshStandardMaterial(Object.assign(
      { color, roughness: rough === undefined ? 0.80 : rough, metalness: metal === undefined ? 0.20 : metal }, opts || {}));
    if (name) m.name = name;
    return m;
  };
  const STEEL = mk(0x5b6167, 'metal', 0.80, 0.22, { side: DS });
  const STEEL2= mk(0x555b61, 'metal', 0.84, 0.20, { side: DS });
  const GALV  = mk(0x9aa0a3, 'metal', 0.60, 0.60, { side: DS });
  const GALV2 = mk(0x8f9598, 'metal', 0.66, 0.55);
  const GUN   = mk(0x3a3d40, 'metal', 0.72, 0.30);
  const RUST  = mk(0x6e4128, 'metal', 0.92, 0.10);
  const DARK  = mk(0x2a2c2e, 'metal', 0.82, 0.18);
  const ORNG  = mk(0xbe5220, 'metal', 0.84, 0.10);

  const add = (geo, mat, x, y, z, rx, ry, rz) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0);
    g.add(m);
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
  // bevelEnabled: false — a bevel would push each section outward by 2x bevelSize
  // and hang it below its own base, which on a 3 m rail is a 100 mm error.
  const ex = (shape, depth) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 4, steps: 1 });

  // ---- rails: one C section, swept 3.00 m ------------------------------------
  const chan = poly([[0, 0], [0.055, 0], [0.055, 0.014], [0.014, 0.014],
                     [0.014, 0.161], [0.055, 0.161], [0.055, 0.175], [0, 0.175]]);
  const railGeo = ex(chan, 3.00);
  railGeo.translate(0, 0, -1.50);
  add(railGeo, STEEL, 0, 0.690, 0.400, 0, Math.PI / 2, 0);     // web outboard at z=+0.40
  add(railGeo, STEEL, 0, 0.690, -0.400, 0, -Math.PI / 2, 0);
  for (const sz of [-1, 1]) add(B(2.96, 0.030, 0.012), GALV2, 0, 0.760, sz * 0.394);
  for (const sx of [-1, 1]) {
    add(B(0.012, 0.20, 0.74), STEEL2, sx * 1.494, 0.775, 0);   // splice plate, inside the tile line
    for (const sz of [-1, 1]) add(B(0.030, 0.085, 0.085), GALV2, sx * 1.482, 0.775, sz * 0.30);
  }

  // ---- rollers ----------------------------------------------------------------
  const N = 20;
  const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.030, 0.030, 0.665, 10), GALV2, N);
  im.position.set(0, 0.870, 0);
  im.rotation.set(Math.PI / 2, 0, 0);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  for (let i = 0; i < N; i++) { p.set(-1.425 + i * 0.15, 0, 0); im.setMatrixAt(i, m4.compose(p, q, s)); }
  im.instanceMatrix.needsUpdate = true;
  g.add(im);
  const sp = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.009, 0.009, 0.79, 6), GUN, N);
  sp.position.set(0, 0.870, 0);
  sp.rotation.set(Math.PI / 2, 0, 0);
  for (let i = 0; i < N; i++) { p.set(-1.425 + i * 0.15, 0, 0); sp.setMatrixAt(i, m4.compose(p, q, s)); }
  sp.instanceMatrix.needsUpdate = true;
  g.add(sp);

  // ---- legs: swept angle iron -------------------------------------------------
  const ang = poly([[0, 0], [0.060, 0], [0.060, 0.014], [0.014, 0.014], [0.014, 0.060], [0, 0.060]]);
  const legGeo = ex(ang, 0.60);
  legGeo.translate(0, 0, 0);
  const gus = ex(poly([[0, 0], [0.11, 0], [0, 0.11]]), 0.012);
  const LEG = [[-1.30, -0.30], [-1.30, 0.30], [1.30, -0.30], [1.30, 0.30]];
  for (const [lx, lz] of LEG) {
    const sx = Math.sign(lx), sz = Math.sign(lz);
    // -PI/2 about X sweeps the section up +Y; the extra PI about Z turns the
    // angle's heel to face the frame corner on the far side.
    add(legGeo, STEEL, lx - sx * 0.030, 0.100, lz + sz * 0.030,
      -Math.PI / 2, 0, sx * sz > 0 ? 0 : Math.PI);
    add(B(0.085, 0.05, 0.085), GALV2, lx, 0.685, lz);
    add(CYL(0.014, 0.014, 0.10, 8), GALV2, lx, 0.075, lz);
    add(CYL(0.048, 0.048, 0.022, 10), GUN, lx, 0.014, lz);
    add(CYL(0.026, 0.026, 0.020, 6), GALV2, lx, 0.040, lz);
    add(gus, STEEL2, lx - sx * 0.006, 0.660, lz - sz * 0.11, 0, 0, sx > 0 ? Math.PI / 2 : 0);
  }
  // bracing: an X across each end frame, an X down each side
  for (const sx of [-1, 1]) for (const d of [-1, 1])
    add(B(0.030, 0.80, 0.020), STEEL2, sx * 1.30, 0.40, 0, d * 0.83, 0, 0);
  for (const sz of [-1, 1]) {
    for (const d of [-1, 1]) add(B(2.64, 0.030, 0.018), STEEL2, 0, 0.40, sz * 0.30, 0, 0, d * 0.223);
    add(B(2.60, 0.055, 0.030), DARK, 0, 0.395, sz * 0.30);        // knee-height scuff stringer
    add(B(2.62, 0.020, 0.028), RUST, 0, 0.360, sz * 0.30);
  }

  // ---- stencil plate + bolts ---------------------------------------------------
  add(B(0.22, 0.11, 0.012), GALV2, -0.55, 0.780, 0.403);
  add(B(0.14, 0.08, 0.012), ORNG, 0.62, 0.780, 0.403);
  const boltGeo = new THREE.CylinderGeometry(0.013, 0.016, 0.012, 6);
  const list = [];
  for (const sz of [-1, 1]) for (let i = 0; i < 11; i++) list.push([-1.40 + i * 0.28, 0.715, sz * 0.402]);
  for (const [lx, lz] of LEG) for (let i = 0; i < 2; i++) list.push([lx, 0.640 - i * 0.12, lz + (lz > 0 ? 0.032 : -0.032)]);
  const bim = new THREE.InstancedMesh(boltGeo, RUST, list.length);
  bim.position.set(0, 0.75, 0);
  for (let i = 0; i < list.length; i++) {
    const v3 = list[i];
    q.setFromEuler(new THREE.Euler(v3[2] > 0 ? Math.PI / 2 : -Math.PI / 2, 0, 0));
    p.set(v3[0], v3[1] - 0.75, v3[2]);
    bim.setMatrixAt(i, m4.compose(p, q, s));
  }
  bim.instanceMatrix.needsUpdate = true;
  g.add(bim);

  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p2 = n.isMesh && n.geometry.attributes.position; if (!p2) return;
    for (let i = 0; i < p2.count; i++) box.expandByPoint(v.fromBufferAttribute(p2, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= box.min.y; m.position.z -= c.z; });
  return g;
}
