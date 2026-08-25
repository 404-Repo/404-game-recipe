// cable_reel — arm C: a second reading of the reference. Its flange boards are not
// radial: they are parallel planks laid across the disc and cut to the circle, so
// each plank is a box of its own chord length, stepping in toward the rim, with a
// steel rim band and two cross battens over them. Axis along Z, per the size table.
export default function (THREE) {
  const g = new THREE.Group();
  const DS = THREE.DoubleSide;

  const mk = (color, name, rough, metal, opts) => {
    const m = new THREE.MeshStandardMaterial(Object.assign(
      { color, roughness: rough === undefined ? 0.88 : rough, metalness: metal === undefined ? 0.05 : metal }, opts || {}));
    if (name) m.name = name;
    return m;
  };
  const WOOD  = mk(0x9c7a4e, 'timber', 0.90, 0.03, { side: DS });
  const WOOD2 = mk(0x8f6f47, 'timber', 0.92, 0.03, { side: DS });
  const WOOD3 = mk(0x7d6140, 'timber', 0.93, 0.03, { side: DS });
  const RUST  = mk(0x6e4128, 'metal', 0.92, 0.10);
  const GALV  = mk(0x9aa0a3, 'metal', 0.62, 0.55);
  const STEEL = mk(0x5b6167, 'metal', 0.78, 0.22, { side: DS });
  const CABLE = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.90, metalness: 0.04 });

  const add = (geo, mat, x, y, z, rx, ry, rz) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0);
    g.add(m);
    return m;
  };
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const CYL = (r1, r2, h, s, open) => new THREE.CylinderGeometry(r1, r2, h, s, 1, !!open);

  const CY = 0.70, R = 0.70;
  const FZ = [-0.265, 0.265];
  const SHADE = [WOOD2, WOOD, WOOD3, WOOD, WOOD3, WOOD2, WOOD];

  for (const fz of FZ) {
    const sgn = Math.sign(fz);
    // seven parallel planks, each cut to the chord it spans
    for (let i = 0; i < 7; i++) {
      const dy = -0.57 + i * 0.19;
      const half = Math.sqrt(Math.max(R * R - Math.pow(Math.abs(dy) + 0.095, 2), 0.02));
      add(B(half * 2, 0.184, 0.05), SHADE[i], 0, CY + dy, fz);
      add(B(half * 2 - 0.06, 0.012, 0.052), WOOD3, 0, CY + dy - 0.092, fz);   // board gap shadow
    }
    add(CYL(R, R, 0.026, 24), WOOD3, 0, CY, fz - sgn * 0.038, Math.PI / 2, 0, 0);   // backing layer
    add(CYL(R, R, 0.056, 24, true), WOOD3, 0, CY, fz, Math.PI / 2, 0, 0);      // rim band
    // two cross battens over the planks, the second at knee height (0.40..0.50)
    add(B(0.115, 1.26, 0.028), WOOD3, -0.30, CY, fz + sgn * 0.030);
    add(B(1.24, 0.10, 0.030), WOOD3, 0, 0.45, fz + sgn * 0.030);
    add(B(1.26, 0.024, 0.028), RUST, 0, 0.385, fz + sgn * 0.030);
    // hub plate and bore
    add(CYL(0.30, 0.30, 0.058, 16), WOOD2, 0, CY, fz + sgn * 0.006, Math.PI / 2, 0, 0);
    add(CYL(0.155, 0.155, 0.08, 12), GALV, 0, CY, fz + sgn * 0.012, Math.PI / 2, 0, 0);
    add(CYL(0.058, 0.058, 0.052, 10), STEEL, 0, CY, fz + sgn * 0.012, Math.PI / 2, 0, 0);
    // splintered rim damage
    add(B(0.11, 0.08, 0.048), WOOD2, 0.42, CY + 0.53, fz, 0, 0, 0.7);
    add(B(0.09, 0.06, 0.046), WOOD2, -0.53, CY - 0.40, fz, 0, 0, -0.5);
  }
  add(B(0.26, 0.15, 0.012), GALV, 0.14, 0.50, 0.302);
  add(B(0.20, 0.10, 0.012), GALV, -0.16, 0.90, -0.302);

  // ---- hub barrel and wound cable ---------------------------------------------
  add(CYL(0.245, 0.245, 0.50, 16, true), WOOD2, 0, CY, 0, Math.PI / 2, 0, 0);
  for (const fz of [-0.235, 0.235]) add(CYL(0.255, 0.255, 0.05, 16), WOOD3, 0, CY, fz, Math.PI / 2, 0, 0);
  add(CYL(0.350, 0.350, 0.42, 16, true), CABLE, 0, CY, 0, Math.PI / 2, 0, 0);
  for (let i = 0; i < 5; i++) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.385, 0.043, 5, 16), CABLE);
    t.position.set(0, CY, -0.18 + i * 0.09);
    g.add(t);
  }
  add(new THREE.TorusGeometry(0.12, 0.036, 4, 10, Math.PI * 1.2), CABLE, 0.30, 0.30, 0.10, 0.5, 0.3, 0.9);

  // ---- tie rods and bolts ------------------------------------------------------
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i / 4) * Math.PI * 2;
    const x = Math.cos(a) * 0.56, y = CY + Math.sin(a) * 0.56;
    add(CYL(0.017, 0.017, 0.62, 6), RUST, x, y, 0, Math.PI / 2, 0, 0);
    for (const fz of FZ) add(CYL(0.032, 0.032, 0.030, 6), RUST, x, y, fz + Math.sign(fz) * 0.030, Math.PI / 2, 0, 0);
  }
  const boltGeo = new THREE.CylinderGeometry(0.022, 0.026, 0.018, 6);
  const list = [];
  for (const fz of FZ) {
    for (let i = 0; i < 6; i++) list.push([-0.30, CY - 0.50 + i * 0.20, fz + Math.sign(fz) * 0.038]);
    for (let i = 0; i < 4; i++) list.push([0.20 + (i % 2) * 0.26, CY - 0.30 + i * 0.20, fz + Math.sign(fz) * 0.028]);
  }
  const im = new THREE.InstancedMesh(boltGeo, RUST, list.length);
  im.position.set(0, CY, 0);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  q.setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
  list.forEach((vv, i) => { p.set(vv[0], vv[1] - CY, vv[2]); im.setMatrixAt(i, m4.compose(p, q, s)); });
  im.instanceMatrix.needsUpdate = true;
  g.add(im);

  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p2 = n.isMesh && n.geometry.attributes.position; if (!p2) return;
    for (let i = 0; i < p2.count; i++) box.expandByPoint(v.fromBufferAttribute(p2, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= box.min.y; m.position.z -= c.z; });
  return g;
}
