/**
 * viewmodel_arms — the winner (arm C: a different breakdown / reading).
 *
 * The reference image is the wrong view for this asset (someone else's hands,
 * from the front, palms up) and it is also wrong about the pose: the hands in it
 * are open and relaxed. A first-person viewmodel is a pair of forearms coming in
 * from the near edge with the hands already closed on a weapon.
 *
 * A and B read the glove as one soft mass with fingers on it. This reads it as
 * HARD-KNUCKLE ARMOUR over a soft liner: a palm liner, a separate back-of-hand
 * plate, four individual knuckle caps, THREE-segment fingers with visible gaps
 * at the joints, and a gauntlet cuff strapped over the sleeve. The forearm is
 * three stacked tapered segments rather than one, so the sleeve roll and the
 * wrist taper are separate masses.
 *
 * Owner's right is -X. Datum: underside 0.000, elbow axis 0.058, wrist 0.086.
 */
export default function (THREE) {
  const g = new THREE.Group();

  const M = (color, name, roughness = 0.88, metalness = 0.04) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    if (name) m.name = name;
    return m;
  };
  const sleeve = M(0x3a3d33, 'fabric', 0.92);
  const sleeveB = M(0x45483c, 'fabric', 0.90);
  const patch = M(0x878c8f, 'fabric', 0.92);   // subdued unit patch, not a white flag
  const steel = M(0x5b6167, 'metal', 0.60, 0.38);
  const glove = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.82, metalness: 0.03 });
  const gloveB = new THREE.MeshStandardMaterial({ color: 0x282a2d, roughness: 0.86, metalness: 0.03 });
  const armour = new THREE.MeshStandardMaterial({ color: 0x303235, roughness: 0.70, metalness: 0.08 });

  const B = (w, h, d, x, y, z, mat, parent) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); parent.add(m); return m;
  };
  const J = (x, y, z, parent) => {
    const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o;
  };
  /** a tapered cylinder along +Z, from z0 to z1 */
  const SEGZ = (r0, r1, z0, z1, mat, parent, seg = 12, open = false) => {
    let mm = mat;
    if (open) { mm = mat.clone(); mm.side = THREE.DoubleSide; mm.name = mat.name; }
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, z1 - z0, seg, 1, open), mm);
    m.rotation.x = Math.PI / 2;
    m.position.z = (z0 + z1) / 2;
    parent.add(m); return m;
  };
  const AIM = (to, parent) => {
    const o = new THREE.Object3D();
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), to.clone().normalize());
    parent.add(o);
    return o;
  };

  const EY = 0.058, WY = 0.086, EX = 0.140, WX = 0.098, EZ = -0.150, WZ = 0.160;

  function arm(side) {
    // --- upper arm stub: three masses, open at the cut so the back view has a hole
    const stub = new THREE.Group();
    g.add(stub);
    const sx = side * EX;
    const s1 = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.050, 0.100, 12), sleeve);
    s1.rotation.x = Math.PI / 2; s1.position.set(sx, EY, -0.200); stub.add(s1);
    const s2 = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.056, 0.056, 12), sleeveB);
    s2.rotation.x = Math.PI / 2; s2.position.set(sx, EY, -0.278); stub.add(s2);
    const cut = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.028, 12, 1, true),
      (() => { const m = sleeveB.clone(); m.side = THREE.DoubleSide; m.name = 'fabric'; return m; })());
    cut.rotation.x = Math.PI / 2; cut.position.set(sx, EY, -0.299); stub.add(cut);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.024, 12, 1, true),
      (() => { const m = glove.clone(); m.side = THREE.DoubleSide; return m; })());
    inner.rotation.x = Math.PI / 2; inner.position.set(sx, EY, -0.303); stub.add(inner);
    B(0.100, 0.008, 0.048, sx, EY + 0.054, -0.234, patch, stub);    // unit patch on the sleeve
    for (const t of [1, -1]) B(0.014, 0.012, 0.052, sx + t * 0.052, EY, -0.186, sleeveB, stub);

    // --- elbow -----------------------------------------------------------------
    const elbow = J(sx, EY, EZ, g);
    const wristPos = new THREE.Vector3(side * (WX - EX), WY - EY, WZ - EZ);
    const aim = AIM(wristPos, elbow);
    const len = wristPos.length();
    // A forearm is not a tube: it is thick at the elbow and narrow at the wrist,
    // and the first pass barely tapered so it read as a length of pipe.
    SEGZ(0.054, 0.049, 0.000, 0.120, glove, aim);                   // forearm, upper third
    SEGZ(0.049, 0.041, 0.120, 0.230, glove, aim);                   // middle
    SEGZ(0.041, 0.033, 0.230, len - 0.008, glove, aim);             // wrist taper
    B(0.062, 0.030, 0.070, 0, 0.006, 0.070, glove, aim);            // the flat of the forearm
    // the rolled sleeve is its own loose mass over the top of the forearm
    SEGZ(0.057, 0.053, -0.006, 0.120, sleeve, aim);
    SEGZ(0.053, 0.049, 0.120, 0.148, sleeveB, aim);
    {                                                                // the roll itself
      const roll = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.012, 5, 12), sleeveB);
      roll.position.z = 0.150; aim.add(roll);
    }
    B(0.020, 0.012, 0.014, 0.044, 0.014, 0.080, sleeveB, aim);
    B(0.020, 0.012, 0.014, -0.044, 0.014, 0.080, sleeveB, aim);

    // --- wrist -----------------------------------------------------------------
    const wrist = J(side * (WX - EX), WY - EY, WZ - EZ, elbow);
    SEGZ(0.048, 0.046, -0.056, -0.004, gloveB, wrist);              // gauntlet cuff
    B(0.088, 0.014, 0.024, 0, 0.044, -0.030, armour, wrist);        // cuff strap
    B(0.026, 0.014, 0.016, side * 0.032, 0.052, -0.030, steel, wrist);   // buckle
    B(0.090, 0.046, 0.104, 0, -0.002, 0.052, glove, wrist);         // palm liner
    B(0.078, 0.034, 0.032, 0, -0.014, 0.008, gloveB, wrist);        // heel pad
    B(0.092, 0.013, 0.066, 0, 0.028, 0.068, armour, wrist);         // back-of-hand plate
    for (const fx of [-0.030, -0.010, 0.010, 0.030]) {              // individual knuckle caps
      B(0.017, 0.013, 0.018, fx, 0.030, 0.096, armour, wrist);
    }
    B(0.020, 0.010, 0.020, -side * 0.040, 0.020, 0.028, armour, wrist);  // thumb knuckle cap

    // --- fingers: three segments, gaps at the joints -----------------------------
    for (const fx of [-0.030, -0.010, 0.010, 0.030]) {
      const f1 = J(fx, -0.004, 0.100, wrist);
      f1.rotation.x = 0.62;
      B(0.017, 0.023, 0.036, 0, 0, 0.019, glove, f1);
      B(0.018, 0.008, 0.012, 0, 0.014, 0.028, armour, f1);
      const f2 = J(0, 0, 0.038, f1);
      f2.rotation.x = 0.62;
      B(0.016, 0.021, 0.030, 0, 0, 0.016, glove, f2);
      B(0.017, 0.007, 0.010, 0, 0.013, 0.024, armour, f2);
      const f3 = J(0, 0, 0.032, f2);
      f3.rotation.x = 0.52;
      B(0.015, 0.019, 0.026, 0, 0, 0.013, glove, f3);
      B(0.014, 0.017, 0.010, 0, 0, 0.028, gloveB, f3);
    }
    // --- thumb, three masses, wrapped across where the grip would be
    const t1 = J(-side * 0.044, -0.004, 0.044, wrist);
    t1.rotation.y = side * 0.90;
    t1.rotation.x = 0.36;
    B(0.023, 0.025, 0.044, 0, 0, 0.023, glove, t1);
    const t2 = J(0, 0, 0.044, t1);
    t2.rotation.y = side * 0.40;
    t2.rotation.x = 0.22;
    B(0.021, 0.022, 0.030, 0, 0, 0.016, glove, t2);
    B(0.019, 0.019, 0.012, 0, 0, 0.034, gloveB, t2);

    return { elbow, wrist };
  }

  const L = arm(1), R = arm(-1);
  const gripPoint = J(0, -0.028, 0.066, R.wrist);

  g.userData.joints = {
    leftWrist: L.wrist, rightWrist: R.wrist,
    leftElbow: L.elbow, rightElbow: R.elbow,
  };
  g.userData.gripPoint = gripPoint;
  g.userData.handedness = 'owner right is -X; asset faces +Z';

  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= box.min.y; m.position.z -= c.z; });
  return g;
}
