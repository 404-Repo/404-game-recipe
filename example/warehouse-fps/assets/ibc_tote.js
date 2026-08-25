// ibc_tote — winner (arm B): built from swept profiles.
// The tank is a rounded-rectangle Shape extruded up its own axis (bevelEnabled
// false), the top deck is a SEPARATE smaller mass rather than a tapered extrude,
// the cage is round tube, and the pallet is C-channel section.
// 1.20 x 1.00 x 1.16 m
export default function (THREE) {
  const g = new THREE.Group();

  const mat = (color, name, o = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.18, ...o });
    if (name) m.name = name;
    return m;
  };

  // tank left UNNAMED on purpose: the surface system must skip it
  const TANK = new THREE.MeshStandardMaterial({
    color: 0xc9c6bd, transparent: true, opacity: 0.75, roughness: 0.4, metalness: 0.0,
  });
  const TANK2 = new THREE.MeshStandardMaterial({
    color: 0xc2bfb5, transparent: true, opacity: 0.75, roughness: 0.4, metalness: 0.0,
  });

  const GALV = mat(0x9aa0a3, 'metal', { roughness: 0.55, metalness: 0.7 });
  const GALV2 = mat(0x929899, 'metal', { roughness: 0.6, metalness: 0.65 });
  const STEEL = mat(0x5b6167, 'metal', { roughness: 0.68, metalness: 0.46 });
  const RUST = mat(0x6e4128, 'metal', { roughness: 0.94, metalness: 0.1 });
  const RED = mat(0x8c3a2b, 'metal', { roughness: 0.75, metalness: 0.1 });
  const YELLOW = mat(0xd6a41f, 'metal', { roughness: 0.86, metalness: 0.1 });
  const GRIME = mat(0x4e4c47, 'metal', { roughness: 0.95, metalness: 0.05 });

  const add = (geo, m, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); g.add(mesh); return mesh;
  };
  const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
  const inst = (geo, m, mats) => {
    const im = new THREE.InstancedMesh(geo, m, mats.length);
    for (let i = 0; i < mats.length; i++) im.setMatrixAt(i, mats[i]);
    im.instanceMatrix.needsUpdate = true;
    g.add(im);
    return im;
  };

  // --- a rounded rectangle, swept vertically --------------------------------
  function rrect(w, d, r) {
    const s = new THREE.Shape();
    const hx = w / 2 - r, hz = d / 2 - r;
    s.moveTo(-hx, -d / 2);
    s.lineTo(hx, -d / 2);
    s.absarc(hx, -hz, r, -Math.PI / 2, 0, false);
    s.lineTo(w / 2, hz);
    s.absarc(hx, hz, r, 0, Math.PI / 2, false);
    s.lineTo(-hx, d / 2);
    s.absarc(-hx, hz, r, Math.PI / 2, Math.PI, false);
    s.lineTo(-w / 2, -hz);
    s.absarc(-hx, -hz, r, Math.PI, Math.PI * 1.5, false);
    s.closePath();
    return s;
  }
  function sweptUp(shape, height, seg) {
    const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: seg || 4 });
    geo.rotateX(-Math.PI / 2);     // extrusion +Z -> +Y, shape +Y -> -Z
    return geo;
  }
  function channel(len, hgt, dep, wall) {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(dep, 0); s.lineTo(dep, wall); s.lineTo(wall, wall);
    s.lineTo(wall, hgt - wall); s.lineTo(dep, hgt - wall); s.lineTo(dep, hgt); s.lineTo(0, hgt);
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false, curveSegments: 1 });
    geo.translate(-dep / 2, -hgt / 2, -len / 2);
    geo.rotateY(Math.PI / 2);
    return geo;
  }

  // ------------------------------------------------------------ pallet base --
  add(new THREE.BoxGeometry(1.20, 0.030, 1.00), GALV2, 0, 0.130, 0);
  for (const sz of [1, -1]) add(channel(1.20, 0.085, 0.065, 0.010), GALV, 0, 0.072, sz * 0.4675);
  for (const sx of [1, -1]) {
    const c = channel(0.87, 0.085, 0.065, 0.010); c.rotateY(Math.PI / 2);
    add(c, GALV, sx * 0.5675, 0.072, 0);
  }
  for (const x of [-0.495, 0, 0.495]) add(new THREE.BoxGeometry(0.13, 0.115, 0.99), STEEL, x, 0.0575, 0);
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.31, 0.022, 0.92), STEEL, sx * 0.25, 0.104, 0);
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    add(new THREE.BoxGeometry(0.095, 0.050, 0.095), STEEL, sx * 0.545, 0.168, sz * 0.445);
    add(new THREE.CylinderGeometry(0.011, 0.011, 0.022, 6), GALV, sx * 0.545, 0.192, sz * 0.445);
  }
  add(new THREE.BoxGeometry(1.15, 0.028, 0.018), GALV2, 0, 0.152, 0.478);

  // ------------------------------------------------------------------ tank --
  add(sweptUp(rrect(1.16, 0.96, 0.11), 0.895, 4), TANK, 0, 0.146, 0);
  // moulded horizontal ribs, each its own mass
  for (const y of [0.285, 0.515, 0.745, 0.935]) {
    add(sweptUp(rrect(1.175, 0.975, 0.115), 0.028, 3), TANK2, 0, y, 0);
  }
  // knee-height grime band
  add(sweptUp(rrect(1.168, 0.968, 0.112), 0.145, 3), GRIME, 0, 0.395, 0);
  // top deck: a separate, smaller mass. Tapering the extrude by scaling its
  // vertices would bow the earcut cap outward, so it is two masses.
  add(sweptUp(rrect(1.10, 0.90, 0.10), 0.050, 4), TANK2, 0, 1.041, 0);
  add(sweptUp(rrect(1.00, 0.80, 0.09), 0.030, 3), TANK2, 0, 1.078, 0);
  // fill neck and red screw cap
  add(new THREE.CylinderGeometry(0.112, 0.122, 0.030, 16), TANK2, 0, 1.098, 0.09);
  add(new THREE.CylinderGeometry(0.100, 0.100, 0.044, 16), RED, 0, 1.130, 0.09);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    add(new THREE.BoxGeometry(0.022, 0.044, 0.024), mat(0x7d3325, 'metal', { roughness: 0.78 }),
      Math.sin(a) * 0.100, 1.130, 0.09 + Math.cos(a) * 0.100).rotation.y = a;
  }
  add(new THREE.CylinderGeometry(0.030, 0.030, 0.014, 10), mat(0x953f2e, 'metal', { roughness: 0.8 }), 0, 1.156, 0.09);
  // moulded label recess
  add(new THREE.BoxGeometry(0.26, 0.19, 0.014), TANK2, -0.22, 0.80, 0.470);

  // ------------------------------------------------------------------ cage --
  // round tube. Prototype geometry is pre-placed inside the object because the
  // bounding-box pass reads an InstancedMesh's prototype only.
  const vT = new THREE.CylinderGeometry(0.0085, 0.0085, 0.985, 6);
  vT.translate(-0.5915, 0.660, 0.4915);
  const vm = [];
  for (let i = 0; i < 9; i++) { vm.push(T(i * 0.1479, 0, 0)); vm.push(T(i * 0.1479, 0, -0.983)); }
  for (let i = 1; i < 8; i++) { vm.push(T(0, 0, -i * 0.1229)); vm.push(T(1.183, 0, -i * 0.1229)); }
  inst(vT, GALV, vm);

  const LEV = [0.210, 0.340, 0.575, 0.705, 0.840, 0.970, 1.095, 1.151];
  const hXg = new THREE.CylinderGeometry(0.0085, 0.0085, 1.183, 6);
  hXg.rotateZ(Math.PI / 2); hXg.translate(0, LEV[0], 0.4915);
  const hm = [];
  for (const y of LEV) { hm.push(T(0, y - LEV[0], 0)); hm.push(T(0, y - LEV[0], -0.983)); }
  inst(hXg, GALV2, hm);

  const hZg = new THREE.CylinderGeometry(0.0085, 0.0085, 0.983, 6);
  hZg.rotateX(Math.PI / 2); hZg.translate(0.5915, LEV[0], 0);
  const hm2 = [];
  for (const y of LEV) { hm2.push(T(0, y - LEV[0], 0)); hm2.push(T(-1.183, y - LEV[0], 0)); }
  inst(hZg, GALV2, hm2);

  // knee-height rubbing rail, proud and rusted, all four sides
  for (const sz of [1, -1]) add(new THREE.BoxGeometry(1.19, 0.028, 0.026), RUST, 0, 0.455, sz * 0.497);
  for (const sx of [1, -1]) add(new THREE.BoxGeometry(0.026, 0.028, 0.99), RUST, sx * 0.597, 0.455, 0);

  // ------------------------------------------------------- valve, front (+Z) --
  add(sweptUp(rrect(0.22, 0.10, 0.03), 0.13, 3), TANK2, 0, 0.152, 0.435);
  add(new THREE.CylinderGeometry(0.046, 0.046, 0.070, 12), GALV, 0, 0.215, 0.490).rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.060, 0.060, 0.022, 12), STEEL, 0, 0.215, 0.505).rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.014, 0.014, 0.030, 8), STEEL, 0, 0.215, 0.522).rotation.x = Math.PI / 2;
  const lever = add(new THREE.BoxGeometry(0.150, 0.024, 0.028), RUST, 0.055, 0.256, 0.522);
  lever.rotation.z = 0.62;
  add(new THREE.CylinderGeometry(0.032, 0.032, 0.028, 10), RED, 0, 0.152, 0.486).rotation.x = Math.PI / 2;
  // bolted valve flange
  for (const a of [0.6, 2.2, 3.7, 5.3]) {
    add(new THREE.CylinderGeometry(0.008, 0.008, 0.016, 6), GALV,
      Math.sin(a) * 0.052, 0.215 + Math.cos(a) * 0.052, 0.500).rotation.x = Math.PI / 2;
  }

  // -------------------------------------------------------- plated marking ---
  add(new THREE.BoxGeometry(0.22, 0.14, 0.012), YELLOW, 0.32, 0.72, 0.494);
  add(new THREE.BoxGeometry(0.15, 0.028, 0.016), STEEL, 0.32, 0.746, 0.496);
  add(new THREE.BoxGeometry(0.012, 0.13, 0.20), YELLOW, -0.594, 0.72, -0.16);
  add(new THREE.BoxGeometry(0.20, 0.13, 0.012), YELLOW, 0.20, 0.72, -0.494);

  for (const [x, z, y, h] of [[-0.45, 1, 0.75, 0.5], [0.30, 1, 0.55, 0.35],
                              [-0.15, -1, 0.80, 0.6], [0.52, -1, 0.60, 0.4], [0.05, 1, 0.95, 0.3]]) {
    add(new THREE.BoxGeometry(0.024, h, 0.010), RUST, x, y, z * 0.497);
  }

  // --- the six lines --------------------------------------------------------
  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= box.min.y; m.position.z -= c.z; });

  return g;
}
