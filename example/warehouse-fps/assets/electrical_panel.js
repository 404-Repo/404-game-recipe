// electrical_panel — WINNER (arm A): assembled from primitives.
// 0.80 x 0.25 x 0.60 m. Grey steel distribution enclosure, drip canopy, hinged
// front door on a right-hand hinge barrel, red rotary isolator, two indicator
// lamps, a latch, a warning plate, five conduit glands out of the bottom.
//
// The door is exposed as g.userData.door, an Object3D pivoted ON the hinge line.
// It only survives the loader with { keepHierarchy: true }; the default merge
// welds every part into one mesh per material and drops userData with the nodes.
export default function (THREE) {
  const g = new THREE.Group();

  const M = (c, n, o = {}) => {
    const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.84, metalness: 0.18, ...o });
    if (n) m.name = n;
    return m;
  };
  const at = (parent, geo, mat, p, r) => {
    const m = new THREE.Mesh(geo, mat);
    if (p) m.position.set(p[0], p[1], p[2]);
    if (r) m.rotation.set(r[0], r[1], r[2]);
    parent.add(m);
    return m;
  };
  const put = (geo, mat, p, r) => at(g, geo, mat, p, r);

  const body   = M(0x878c8f, 'metal', { roughness: 0.86, metalness: 0.20 });
  const body2  = M(0x81868a, 'metal', { roughness: 0.88, metalness: 0.20 });   // 4% darker, same steel
  const doorM  = M(0x8b9093, 'metal', { roughness: 0.85, metalness: 0.20 });
  const dark   = M(0x5b6167, 'metal', { roughness: 0.88, metalness: 0.22 });
  const scuff  = M(0x4e4c47, 'metal', { roughness: 0.92, metalness: 0.12 });   // the rubbing band
  const galv   = M(0x9aa0a3, 'metal', { roughness: 0.70, metalness: 0.64 });
  const rusty  = M(0x6e4128, 'metal', { roughness: 0.94, metalness: 0.25 });
  const redM   = M(0x8c3a2b, 'metal', { roughness: 0.80, metalness: 0.10 });   // worn red isolator
  const plate  = M(0xc9c6bd, 'plaster', { roughness: 0.88, metalness: 0.04 });
  const tagMat = M(0xd6a41f, 'metal', { roughness: 0.88, metalness: 0.10 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.92, metalness: 0.05 });
  const lampR  = new THREE.MeshStandardMaterial({
    color: 0x9a6a62, roughness: 0.40, metalness: 0.0,
    emissive: 0xd8342a, emissiveIntensity: 1.0, transparent: true, opacity: 0.88 });
  const lampG  = new THREE.MeshStandardMaterial({
    color: 0x7d9a86, roughness: 0.40, metalness: 0.0,
    emissive: 0x2fd06a, emissiveIntensity: 1.0, transparent: true, opacity: 0.88 });

  // --- enclosure ------------------------------------------------------------
  put(new THREE.BoxGeometry(0.760, 0.520, 0.180), body, [0, 0.315, -0.035]);
  // back stiffener ribs and mounting ears: the back is against a wall but it is
  // still a silhouette when you walk behind it
  for (const y of [0.130, 0.315, 0.500]) put(new THREE.BoxGeometry(0.700, 0.028, 0.012), body2, [0, y, -0.131]);
  for (const s of [-1, 1]) {
    put(new THREE.BoxGeometry(0.028, 0.500, 0.012), body2, [s * 0.350, 0.315, -0.131]);
    for (const y of [0.100, 0.530]) {
      put(new THREE.BoxGeometry(0.040, 0.070, 0.010), dark, [s * 0.390, y, -0.120]);
      put(new THREE.CylinderGeometry(0.009, 0.009, 0.012, 6), rusty, [s * 0.390, y, -0.128], [Math.PI / 2, 0, 0]);
    }
  }
  // side ribs
  for (const s of [-1, 1]) for (const y of [0.160, 0.470]) {
    put(new THREE.BoxGeometry(0.010, 0.026, 0.150), body2, [s * 0.382, y, -0.038]);
  }

  // --- drip canopy ----------------------------------------------------------
  // rotation.x = +0.06 pitches the FRONT of the roof down, which is the way water
  // is supposed to run off it
  put(new THREE.BoxGeometry(0.800, 0.020, 0.220), body2, [0, 0.580, -0.015], [0.06, 0, 0]);
  for (const s of [-1, 1]) put(new THREE.BoxGeometry(0.016, 0.030, 0.180), body2, [s * 0.372, 0.562, -0.020]);

  // --- hinge barrel on the right, latch keep on the left -------------------
  for (const y of [0.140, 0.315, 0.490]) {
    put(new THREE.CylinderGeometry(0.016, 0.016, 0.086, 10), dark, [0.383, y, 0.062]);
    put(new THREE.BoxGeometry(0.030, 0.086, 0.012), dark, [0.372, y, 0.048]);
  }
  put(new THREE.BoxGeometry(0.024, 0.070, 0.016), dark, [-0.378, 0.315, 0.058]);
  // rusted screws down the hinge strip: the reference's most distinctive edge
  for (const y of [0.108, 0.172, 0.283, 0.347, 0.458, 0.522]) {
    put(new THREE.CylinderGeometry(0.007, 0.007, 0.010, 6), rusty, [0.376, y, 0.058], [Math.PI / 2, 0, 0]);
  }

  // --- conduit glands out of the bottom -----------------------------------
  for (const x of [-0.240, -0.120, 0, 0.120, 0.240]) {
    put(new THREE.CylinderGeometry(0.020, 0.020, 0.024, 10), galv,   [x, 0.048, -0.035]);
    put(new THREE.CylinderGeometry(0.027, 0.027, 0.018, 6),  galv,   [x, 0.033, -0.035]);
    put(new THREE.CylinderGeometry(0.019, 0.019, 0.030, 8),  rusty,  [x, 0.015, -0.035]);
    put(new THREE.CylinderGeometry(0.016, 0.016, 0.014, 8),  rubber, [x, 0.005, -0.035]);
  }

  // --- the door, on a pivot at the hinge line ------------------------------
  const door = new THREE.Object3D();
  door.position.set(0.372, 0.315, 0.070);
  g.add(door);
  const L = (x, y, z) => [x - 0.372, y - 0.315, z - 0.070];

  at(door, new THREE.BoxGeometry(0.720, 0.500, 0.030), doorM, L(0, 0.315, 0.070));
  // pressed return lip round the door edge
  at(door, new THREE.BoxGeometry(0.720, 0.022, 0.038), body2, L(0, 0.554, 0.068));
  at(door, new THREE.BoxGeometry(0.720, 0.022, 0.038), body2, L(0, 0.076, 0.068));
  at(door, new THREE.BoxGeometry(0.022, 0.500, 0.038), body2, L(-0.349, 0.315, 0.068));
  at(door, new THREE.BoxGeometry(0.022, 0.500, 0.038), body2, L(0.349, 0.315, 0.068));
  // the knee-height rubbing band, at 0.30-0.345 m off the floor
  at(door, new THREE.BoxGeometry(0.700, 0.045, 0.008), scuff, L(0, 0.3225, 0.089));
  at(door, new THREE.BoxGeometry(0.700, 0.006, 0.012), dark,  L(0, 0.3455, 0.089));
  at(door, new THREE.BoxGeometry(0.700, 0.006, 0.012), dark,  L(0, 0.2995, 0.089));

  // rotary isolator
  at(door, new THREE.CylinderGeometry(0.055, 0.058, 0.020, 16), dark, L(0.090, 0.415, 0.095), [Math.PI / 2, 0, 0]);
  at(door, new THREE.CylinderGeometry(0.044, 0.044, 0.014, 16), body2, L(0.090, 0.415, 0.108), [Math.PI / 2, 0, 0]);
  at(door, new THREE.BoxGeometry(0.108, 0.026, 0.014), redM, L(0.090, 0.415, 0.117));
  at(door, new THREE.BoxGeometry(0.030, 0.030, 0.016), redM, L(0.090, 0.415, 0.116));
  for (const a of [0.6, -0.6]) {
    at(door, new THREE.BoxGeometry(0.020, 0.005, 0.004), dark,
      L(0.090 + Math.cos(a) * 0.070, 0.415 + Math.sin(a) * 0.070, 0.087), [0, 0, a]);
  }

  // two indicator lamps
  at(door, new THREE.CylinderGeometry(0.019, 0.021, 0.012, 10), dark, L(0.050, 0.505, 0.089), [Math.PI / 2, 0, 0]);
  at(door, new THREE.SphereGeometry(0.016, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), lampR,
    L(0.050, 0.505, 0.093), [Math.PI / 2, 0, 0]);
  at(door, new THREE.CylinderGeometry(0.019, 0.021, 0.012, 10), dark, L(0.130, 0.505, 0.089), [Math.PI / 2, 0, 0]);
  at(door, new THREE.SphereGeometry(0.016, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), lampG,
    L(0.130, 0.505, 0.093), [Math.PI / 2, 0, 0]);

  // warning plate: the plated marking, geometry only
  at(door, new THREE.BoxGeometry(0.220, 0.130, 0.006), plate, L(0.150, 0.200, 0.088));
  at(door, new THREE.BoxGeometry(0.200, 0.026, 0.004), dark,  L(0.150, 0.246, 0.092));
  at(door, new THREE.BoxGeometry(0.046, 0.040, 0.004), tagMat, L(0.072, 0.184, 0.092));
  at(door, new THREE.BoxGeometry(0.110, 0.008, 0.003), dark,  L(0.182, 0.190, 0.092));
  at(door, new THREE.BoxGeometry(0.110, 0.008, 0.003), dark,  L(0.182, 0.168, 0.092));

  // latch handle
  at(door, new THREE.BoxGeometry(0.036, 0.080, 0.024), dark, L(-0.352, 0.315, 0.094));
  at(door, new THREE.CylinderGeometry(0.012, 0.012, 0.044, 8), galv, L(-0.352, 0.315, 0.104), [0, 0, Math.PI / 2]);
  at(door, new THREE.BoxGeometry(0.014, 0.030, 0.010), galv, L(-0.352, 0.290, 0.108));
  // door hinge leaves
  for (const y of [0.140, 0.315, 0.490]) {
    at(door, new THREE.BoxGeometry(0.034, 0.086, 0.012), dark, L(0.356, y, 0.092));
  }

  g.userData.door = door;
  // the back plate and both mounting ears sit flat against the wall at z = -0.125
  g.userData.mounts = 'back';

  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= box.min.y; m.position.z -= c.z; });
  return g;
}
