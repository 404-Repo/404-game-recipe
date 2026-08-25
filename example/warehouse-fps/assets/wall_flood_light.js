// wall_flood_light — WINNER (arm A): assembled from primitives.
// 0.40 x 0.35 x 0.30 m. Cast housing with a top fin stack, toughened glass front
// held by a clipped bezel, U-yoke strapped flat to the wall, knurled locking knobs,
// cable gland out of the back into the gap behind the housing.
export default function (THREE) {
  const g = new THREE.Group();

  const M = (c, n, o = {}) => {
    const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.82, metalness: 0.2, ...o });
    if (n) m.name = n;
    return m;
  };
  const put = (geo, mat, p, r) => {
    const m = new THREE.Mesh(geo, mat);
    if (p) m.position.set(p[0], p[1], p[2]);
    if (r) m.rotation.set(r[0], r[1], r[2]);
    g.add(m);
    return m;
  };

  const cast   = M(0x878c8f, 'metal', { roughness: 0.86, metalness: 0.22 });
  const cast2  = M(0x81868a, 'metal', { roughness: 0.88, metalness: 0.22 });   // 4% darker, same casting
  const bezel  = M(0x7d8286, 'metal', { roughness: 0.84, metalness: 0.26 });
  const yokeM  = M(0x5b6167, 'metal', { roughness: 0.87, metalness: 0.30 });
  const galv   = M(0x9aa0a3, 'metal', { roughness: 0.70, metalness: 0.64 });
  const rusty  = M(0x6e4128, 'metal', { roughness: 0.94, metalness: 0.25 });
  const tagMat = M(0xd6a41f, 'metal', { roughness: 0.88, metalness: 0.10 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.92, metalness: 0.05 });
  // the lit face: emissive sodium, unnamed AND transparent so surfaces.js skips it
  const glassM = new THREE.MeshStandardMaterial({
    color: 0xb9b3a6, roughness: 0.42, metalness: 0.0,
    emissive: 0xffb45a, emissiveIntensity: 1.0,
    transparent: true, opacity: 0.86, side: THREE.DoubleSide,
  });

  // --- yoke: a flat strap against the wall, two arms forward ----------------
  put(new THREE.BoxGeometry(0.370, 0.062, 0.020), yokeM, [0, 0, -0.190]);
  put(new THREE.BoxGeometry(0.020, 0.078, 0.240), yokeM, [ 0.170, 0, -0.070]);
  put(new THREE.BoxGeometry(0.020, 0.078, 0.240), yokeM, [-0.170, 0, -0.070]);
  put(new THREE.CylinderGeometry(0.039, 0.039, 0.020, 12), yokeM, [ 0.170, 0, 0.010], [0, 0, Math.PI / 2]);
  put(new THREE.CylinderGeometry(0.039, 0.039, 0.020, 12), yokeM, [-0.170, 0, 0.010], [0, 0, Math.PI / 2]);
  // wall fixings through the strap
  {
    const bolt = new THREE.CylinderGeometry(0.009, 0.009, 0.016, 6);
    bolt.rotateX(Math.PI / 2);
    for (const x of [-0.150, -0.050, 0.050, 0.150]) put(bolt, rusty, [x, 0, -0.178]);
  }
  // slotted adjustment holes in the arms, shown as recessed pads
  for (const s of [-1, 1]) {
    put(new THREE.BoxGeometry(0.006, 0.030, 0.090), yokeM, [s * 0.183, 0, -0.090]);
  }

  // --- pivot bosses and knurled locking knobs -------------------------------
  for (const s of [-1, 1]) {
    put(new THREE.CylinderGeometry(0.022, 0.022, 0.014, 10), cast2, [s * 0.156, 0, 0.010], [0, 0, Math.PI / 2]);
    put(new THREE.CylinderGeometry(0.030, 0.030, 0.018, 14), galv,  [s * 0.189, 0, 0.010], [0, 0, Math.PI / 2]);
    put(new THREE.CylinderGeometry(0.023, 0.030, 0.006, 14), galv,  [s * 0.199, 0, 0.010], [0, 0, Math.PI / 2]);
  }

  // --- cast housing ---------------------------------------------------------
  put(new THREE.BoxGeometry(0.300, 0.245, 0.240), cast, [0, 0.0025, -0.030]);
  // back ribs: the face that would otherwise be a flat plate
  for (const x of [-0.090, 0, 0.090]) put(new THREE.BoxGeometry(0.026, 0.215, 0.010), cast2, [x, 0.0025, -0.155]);
  put(new THREE.BoxGeometry(0.290, 0.020, 0.010), cast2, [0, -0.098, -0.155]);
  // side bosses
  for (const s of [-1, 1]) put(new THREE.BoxGeometry(0.008, 0.150, 0.140), cast2, [s * 0.152, 0.0025, -0.040]);

  // --- fin stack on top -----------------------------------------------------
  for (let i = 0; i < 8; i++) {
    const z = -0.130 + i * 0.0271;
    put(new THREE.BoxGeometry(0.286, 0.042, 0.013), cast2, [0, 0.144, z]);
  }
  put(new THREE.CylinderGeometry(0.006, 0.006, 0.215, 6), galv, [0.118, 0.150, -0.035], [Math.PI / 2, 0, 0]);
  put(new THREE.CylinderGeometry(0.006, 0.006, 0.215, 6), galv, [-0.118, 0.150, -0.035], [Math.PI / 2, 0, 0]);
  for (const s of [-1, 1]) {
    put(new THREE.CylinderGeometry(0.011, 0.011, 0.010, 6), galv, [s * 0.118, 0.150, 0.070], [Math.PI / 2, 0, 0]);
  }

  // --- glass and bezel ------------------------------------------------------
  const glass = put(new THREE.BoxGeometry(0.256, 0.192, 0.014), glassM, [0, 0.0025, 0.097]);
  put(new THREE.BoxGeometry(0.312, 0.030, 0.040), bezel, [0,  0.120, 0.110]);
  put(new THREE.BoxGeometry(0.312, 0.030, 0.040), bezel, [0, -0.115, 0.110]);
  put(new THREE.BoxGeometry(0.030, 0.212, 0.040), bezel, [ 0.141, 0.0025, 0.110]);
  put(new THREE.BoxGeometry(0.030, 0.212, 0.040), bezel, [-0.141, 0.0025, 0.110]);
  // toggle clips holding the bezel down: the visible fixing
  for (const s of [-1, 1]) {
    put(new THREE.BoxGeometry(0.030, 0.016, 0.034), galv, [s * 0.141,  0.120, 0.133]);
    put(new THREE.BoxGeometry(0.030, 0.016, 0.034), galv, [s * 0.141, -0.115, 0.133]);
    put(new THREE.CylinderGeometry(0.007, 0.007, 0.022, 6), rusty, [s * 0.141, 0.120, 0.140], [Math.PI / 2, 0, 0]);
    put(new THREE.CylinderGeometry(0.007, 0.007, 0.022, 6), rusty, [s * 0.141, -0.115, 0.140], [Math.PI / 2, 0, 0]);
  }

  // --- cable gland out of the back -----------------------------------------
  put(new THREE.CylinderGeometry(0.020, 0.024, 0.036, 10), galv,   [0.095, -0.060, -0.166], [Math.PI / 2, 0, 0]);
  put(new THREE.CylinderGeometry(0.027, 0.027, 0.014, 6),  galv,   [0.095, -0.060, -0.156], [Math.PI / 2, 0, 0]);
  // the tail hangs DOWN in the gap behind the housing, not backwards: anything
  // behind z = -0.200 would be inside the wall this thing declares it mounts to
  put(new THREE.CylinderGeometry(0.009, 0.009, 0.070, 6),  rubber, [0.095, -0.100, -0.178], [0.35, 0, 0]);

  // --- rating plate: the plated marking ------------------------------------
  put(new THREE.BoxGeometry(0.100, 0.046, 0.005), tagMat, [-0.070, 0.060, -0.153]);

  // --- what the game attaches a real light to ------------------------------
  const lightOrigin = new THREE.Object3D();
  lightOrigin.position.set(0, 0.0025, 0.120);       // just in front of the glass
  g.add(lightOrigin);
  g.userData.lampMesh = glass;
  g.userData.lightOrigin = lightOrigin;
  // the strap and both arm backs sit flat on the wall at z = -0.200
  g.userData.mounts = 'back';

  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= box.min.y; m.position.z -= c.z; });
  return g;
}
