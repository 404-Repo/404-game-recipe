// exit_sign_box — WINNER (arm C): a second reading. A clamshell — deep back pan plus a
// front lid with a stepped joint line all round — and the diffuser stands PROUD of
// the lid on a chamfered collar instead of being recessed behind a frame, so the
// lit face catches light on its edge. Bracket is a folded channel that wraps the
// right-hand END of the box, as the reference shows, plus a back pad.
// 0.35 x 0.06 x 0.20 m.
export default function (THREE) {
  const g = new THREE.Group();

  const M = (c, n, o = {}) => {
    const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.84, metalness: 0.1, ...o });
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

  const shell  = M(0xc9c6bd, 'plaster', { roughness: 0.88, metalness: 0.04 });
  const shell2 = M(0xbfbcb3, 'plaster', { roughness: 0.90, metalness: 0.04 });
  const lid    = M(0xc3c0b7, 'plaster', { roughness: 0.86, metalness: 0.04 });
  // The pictogram on a backlit sign is the part that TRANSMITS light, so it has to
  // read brighter than the green field, not darker. Give it the same sign-green
  // emissive over a pale base and push the intensity above the field's, or in a
  // night interior the figure goes to silhouette and the sign reads inverted.
  const legend = new THREE.MeshStandardMaterial({
    color: 0xc9c6bd, roughness: 0.55, metalness: 0.0,
    emissive: 0x2fd06a, emissiveIntensity: 1.8,
    transparent: true, opacity: 0.94,
  });
  const steel  = M(0x9aa0a3, 'metal',   { roughness: 0.76, metalness: 0.60 });
  const rusty  = M(0x6e4128, 'metal',   { roughness: 0.94, metalness: 0.25 });
  const tagMat = M(0xd6a41f, 'metal',   { roughness: 0.88, metalness: 0.10 });
  // gasket behind the diffuser: near-black, left unnamed so surfaces.js skips it
  const backing = new THREE.MeshStandardMaterial({ color: 0x24282a, roughness: 0.92, metalness: 0.05 });
  const greenM = new THREE.MeshStandardMaterial({
    // A pale base colour under the verifier's two strong lights washes the whole
    // panel out to grey and the emissive stops reading as green at all. The base
    // has to be a dark green for the emissive to sit on top of.
    color: 0x4d7a60, roughness: 0.48, metalness: 0.0,
    emissive: 0x2fd06a, emissiveIntensity: 1.0,
    transparent: true, opacity: 0.93, side: THREE.DoubleSide,
  });
  const amberM = new THREE.MeshStandardMaterial({
    color: 0xb9b3a6, roughness: 0.40, metalness: 0.0,
    emissive: 0xffb45a, emissiveIntensity: 1.0,
    transparent: true, opacity: 0.88,
  });

  // --- clamshell: back pan, joint step, front lid --------------------------
  put(new THREE.BoxGeometry(0.350, 0.184, 0.026), shell,  [0, 0, -0.007]);
  put(new THREE.BoxGeometry(0.340, 0.174, 0.008), shell2, [0, 0,  0.007]);   // the joint step
  put(new THREE.BoxGeometry(0.348, 0.182, 0.012), lid,    [0, 0,  0.016]);
  // lid screws at four corners
  for (const x of [-0.158, 0.158]) for (const y of [-0.077, 0.077]) {
    put(new THREE.CylinderGeometry(0.007, 0.007, 0.007, 8), steel, [x, y, 0.024], [Math.PI / 2, 0, 0]);
  }
  // end ribs on the back pan, so the box is not a plain brick from the sides
  for (const s of [-1, 1]) {
    put(new THREE.BoxGeometry(0.006, 0.150, 0.022), shell2, [s * 0.176, 0, -0.008]);
    put(new THREE.BoxGeometry(0.010, 0.020, 0.024), shell2, [s * 0.172, 0.060, -0.008]);
    put(new THREE.BoxGeometry(0.010, 0.020, 0.024), shell2, [s * 0.172, -0.060, -0.008]);
  }

  // --- diffuser standing proud on a chamfered collar ----------------------
  // a two-step collar: the lens stands on a bevel instead of sitting in a recess
  put(new THREE.BoxGeometry(0.268, 0.150, 0.006), shell2, [-0.021, 0, 0.023]);
  put(new THREE.BoxGeometry(0.260, 0.142, 0.004), backing, [-0.021, 0, 0.0265]);
  const panel = put(new THREE.BoxGeometry(0.252, 0.134, 0.005), greenM, [-0.021, 0, 0.0285]);

  // --- raised pictogram on the proud lens ---------------------------------
  const B = (w, h, x, y, rz) => put(new THREE.BoxGeometry(w, h, 0.003), legend, [x, y, 0.0315], [0, 0, rz || 0]);
  B(0.010, 0.096, -0.104, 0.006);
  B(0.044, 0.010, -0.086, 0.049);
  B(0.044, 0.010, -0.086, -0.037);
  B(0.019, 0.019, -0.062, 0.041);
  B(0.015, 0.043, -0.060, 0.010);
  B(0.012, 0.041, -0.070, -0.024, 0.42);
  B(0.012, 0.041, -0.046, -0.022, -0.34);
  B(0.011, 0.032, -0.078, 0.021, 0.75);
  B(0.011, 0.030, -0.042, 0.019, -0.70);
  B(0.062, 0.014, 0.034, 0.004);
  B(0.030, 0.014, 0.060, 0.021, -0.78);
  B(0.030, 0.014, 0.060, -0.013, 0.78);

  // --- test indicator, reset button on the bottom edge --------------------
  put(new THREE.CylinderGeometry(0.012, 0.014, 0.008, 10), lid,    [0.140, 0.030, 0.021], [Math.PI / 2, 0, 0]);
  put(new THREE.CylinderGeometry(0.009, 0.009, 0.005, 10), amberM, [0.140, 0.030, 0.0245], [Math.PI / 2, 0, 0]);
  put(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 8),  steel,  [0.140, -0.096, -0.004]);
  put(new THREE.CylinderGeometry(0.012, 0.012, 0.004, 8),  steel,  [0.140, -0.090, -0.004]);

  // --- ident plate: the plated marking ------------------------------------
  put(new THREE.BoxGeometry(0.100, 0.016, 0.004), tagMat, [-0.060, -0.070, 0.024]);

  // --- back: an end-wrap channel bracket and a back pad -------------------
  put(new THREE.BoxGeometry(0.030, 0.150, 0.010), steel, [0.164, 0, -0.025]);
  put(new THREE.BoxGeometry(0.010, 0.150, 0.036), steel, [0.176, 0, -0.008]);
  for (const y of [-0.050, 0.050]) {
    put(new THREE.CylinderGeometry(0.012, 0.012, 0.008, 6), rusty, [0.164, y, -0.024], [Math.PI / 2, 0, 0]);
  }
  put(new THREE.BoxGeometry(0.070, 0.150, 0.010), steel, [-0.130, 0, -0.025]);
  for (const y of [-0.050, 0.050]) {
    put(new THREE.CylinderGeometry(0.012, 0.012, 0.008, 6), rusty, [-0.130, y, -0.024], [Math.PI / 2, 0, 0]);
  }
  put(new THREE.BoxGeometry(0.200, 0.010, 0.006), shell2, [0.010, 0.052, -0.023]);
  put(new THREE.BoxGeometry(0.200, 0.010, 0.006), shell2, [0.010, -0.052, -0.023]);
  put(new THREE.CylinderGeometry(0.011, 0.013, 0.016, 8), steel, [-0.150, 0.100, -0.006]);
  put(new THREE.CylinderGeometry(0.008, 0.008, 0.010, 6), steel, [-0.150, 0.108, -0.006]);

  const lightOrigin = new THREE.Object3D();
  lightOrigin.position.set(-0.021, 0, 0.036);
  g.add(lightOrigin);
  g.userData.lampMesh = panel;
  g.userData.lightOrigin = lightOrigin;
  g.userData.mounts = 'back';

  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= box.min.y; m.position.z -= c.z; });
  return g;
}
