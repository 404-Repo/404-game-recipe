/**
 * enemy_soldier — the winner (arm A: primitive assembly, capsules + boxes).
 *
 * ARTICULATED. Built as a real skeleton: every joint is an empty Object3D placed
 * AT the anatomical joint, with the limb geometry as an offset child inside it,
 * so a thigh rotates about the hip and not about its own middle.
 *
 * Facing +Z, up +Y. Right-handed: for a figure facing +Z the character's RIGHT
 * is at -X and their LEFT is at +X (right = forward x up = Z x Y = -X).
 *
 * Anchors, world metres: sole 0, ankle 0.09, knee 0.49, hip 0.93, waist 1.00,
 * shoulder 1.42, neck base 1.45, chin 1.58, helmet crown 1.80.
 */
export default function (THREE) {
  const g = new THREE.Group();

  const M = (color, name, roughness = 0.88, metalness = 0.04) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    if (name) m.name = name;
    return m;
  };
  // fatigues, three worn shades of the same olive drab
  const fatigue = M(0x3a3d33, 'fabric', 0.92);
  const fatigueB = M(0x41443a, 'fabric', 0.90);
  const vest = M(0x33362d, 'fabric', 0.90);
  const webbing = M(0x363a30, 'fabric', 0.94);
  const helmetMat = M(0x42453a, 'metal', 0.72, 0.18);
  const steel = M(0x5b6167, 'metal', 0.62, 0.35);
  const patch = M(0xc9c6bd, 'fabric', 0.90);        // stencilled/plated marking
  const leather = M(0x633b24, 'fabric', 0.90);      // boots, a worn-down rust
  const rubber = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.78, metalness: 0.02 });
  const glove = new THREE.MeshStandardMaterial({ color: 0x1f2022, roughness: 0.82, metalness: 0.02 });
  const skin = new THREE.MeshStandardMaterial({ color: 0x9c7a4e, roughness: 0.75, metalness: 0.0 });

  const B = (w, h, d, x, y, z, mat, parent) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const CAP = (r, len, x, y, z, mat, parent) => {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 8), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const CYL = (rt, rb, h, x, y, z, mat, parent, open = false, seg = 10) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat);
    if (open) m.material = mat.clone(), m.material.side = THREE.DoubleSide, m.material.name = mat.name;
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const J = (x, y, z, parent) => {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };

  // ---- root: hips is a child of g, and everything hangs off it ---------------
  const hips = J(0, 0.95, 0, g);

  // pelvis + belt
  B(0.31, 0.20, 0.22, 0, -0.06, 0, fatigue, hips);
  B(0.335, 0.055, 0.235, 0, 0.035, 0, webbing, hips);           // belt
  for (const x of [-0.10, 0.10]) B(0.05, 0.035, 0.03, x, 0.035, 0.122, steel, hips);  // belt buckles
  // rear kit: a dump pouch and two utility pouches, so the back is not a slab
  B(0.13, 0.11, 0.045, 0, -0.02, -0.135, vest, hips);
  for (const x of [-0.115, 0.115]) B(0.075, 0.10, 0.04, x, -0.03, -0.125, vest, hips);
  B(0.09, 0.10, 0.045, 0.135, -0.02, 0.09, vest, hips);          // hip pouch

  // ---- torso ----------------------------------------------------------------
  const torso = J(0, 0.05, 0, hips);                             // world y 1.00
  B(0.325, 0.22, 0.215, 0, 0.10, 0, fatigue, torso);             // abdomen
  B(0.395, 0.30, 0.225, 0, 0.31, 0, fatigueB, torso);            // chest
  B(0.30, 0.09, 0.20, 0, 0.455, 0, fatigueB, torso);             // upper chest / yoke

  // plate carrier: separate front and rear masses, cummerbund at the sides
  B(0.285, 0.355, 0.035, 0, 0.245, 0.1175, vest, torso);         // front plate  -> z 0.135
  B(0.285, 0.355, 0.035, 0, 0.245, -0.1175, vest, torso);        // rear plate   -> z -0.135
  for (const x of [-0.165, 0.165]) B(0.045, 0.20, 0.215, x, 0.20, 0, vest, torso);
  // shoulder straps over the yoke
  for (const x of [-0.10, 0.10]) B(0.075, 0.045, 0.28, x, 0.435, 0, webbing, torso);
  // 4 magazine pouches across the front, plus a radio pouch
  for (let i = 0; i < 4; i++) {
    const x = -0.1125 + i * 0.075;
    B(0.068, 0.135, 0.05, x, 0.115, 0.16, vest, torso);
    B(0.062, 0.022, 0.012, x, 0.178, 0.19, webbing, torso);      // flap
  }
  B(0.075, 0.115, 0.05, 0.145, 0.125, 0.15, vest, torso);        // radio pouch
  B(0.014, 0.10, 0.014, 0.145, 0.23, 0.15, rubber, torso);       // antenna
  // rear admin pouch + hydration bladder, the reason the back reads at all
  B(0.20, 0.20, 0.04, 0, 0.30, -0.155, vest, torso);
  B(0.115, 0.10, 0.04, 0, 0.135, -0.155, vest, torso);
  for (const x of [-0.075, 0.075]) B(0.02, 0.24, 0.012, x, 0.30, -0.18, webbing, torso);
  // MOLLE ladder webbing on the front plate, visible fixing
  for (let i = 0; i < 4; i++) B(0.26, 0.012, 0.01, 0, 0.13 + i * 0.075, 0.138, webbing, torso);
  // stencilled marking: a plated ID panel, 0.14 across, front and back
  B(0.135, 0.065, 0.009, 0, 0.395, 0.140, patch, torso);
  B(0.14, 0.07, 0.009, 0, 0.335, -0.161, patch, torso);
  // buckles
  for (const x of [-0.09, 0.09]) B(0.045, 0.035, 0.02, x, 0.055, 0.132, steel, torso);

  // ---- head -----------------------------------------------------------------
  const head = J(0, 0.45, 0, torso);                             // world y 1.45
  CYL(0.052, 0.058, 0.10, 0, 0.05, -0.005, skin, head);          // neck
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.098, 12, 8), skin);
  skull.position.set(0, 0.195, -0.005);
  skull.scale.set(0.92, 1.0, 1.0);
  head.add(skull);
  B(0.115, 0.085, 0.055, 0, 0.155, 0.068, skin, head);           // jaw / face front
  B(0.06, 0.022, 0.02, 0, 0.205, 0.098, skin, head);             // brow

  // helmet: a dome, a rim, ear cups, a front mount and a chinstrap
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.118, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.60), helmetMat);
  dome.position.set(0, 0.202, -0.008);
  dome.scale.set(1.0, 1.24, 1.05);
  head.add(dome);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.113, 0.011, 5, 14), helmetMat);
  rim.rotation.x = -Math.PI / 2;
  rim.position.set(0, 0.198, -0.008);
  head.add(rim);
  for (const x of [-0.113, 0.113]) B(0.022, 0.075, 0.085, x, 0.175, -0.01, rubber, head);  // ear cups
  B(0.052, 0.032, 0.030, 0, 0.245, 0.108, steel, head);          // front NVG shroud
  B(0.026, 0.020, 0.022, 0, 0.262, 0.122, rubber, head);
  for (const x of [-0.09, 0.09]) B(0.012, 0.115, 0.012, x, 0.135, 0.045, webbing, head);   // chinstrap
  B(0.085, 0.026, 0.030, 0, 0.086, 0.062, webbing, head);        // chin cup
  B(0.028, 0.020, 0.014, 0.03, 0.086, 0.078, steel, head);       // strap buckle
  B(0.09, 0.028, 0.012, 0, 0.235, -0.118, webbing, head);        // rear retention strap

  // ---- arms -----------------------------------------------------------------
  // rotation.z swings the arm outward: +z for the LEFT arm (at +X), -z for the
  // RIGHT. rotation.x on the elbow is NEGATIVE for a forward bend, because a
  // positive x rotation swings a downward-pointing limb BACKWARD.
  function arm(side) {                                            // side: +1 left, -1 right
    const sh = J(side * 0.175, 0.425, 0, torso);
    sh.rotation.z = side * 0.16;
    B(0.105, 0.10, 0.185, 0, 0.015, 0, vest, sh);                 // shoulder pad over deltoid
    CAP(0.052, 0.20, 0, -0.15, 0, fatigueB, sh);                  // upper arm
    B(0.085, 0.075, 0.045, 0, -0.055, 0.078, vest, sh);           // sleeve pocket
    B(0.055, 0.028, 0.008, 0, -0.055, 0.101, patch, sh);          // sleeve patch (marking)

    const el = J(0, -0.30, 0, sh);
    el.rotation.x = -0.14;
    CAP(0.046, 0.155, 0, -0.125, 0, fatigueB, el);                // forearm
    CYL(0.056, 0.052, 0.045, 0, -0.185, 0, fatigueB, el, true);   // rolled cuff, open both ends

    const wr = J(0, -0.235, 0, el);
    B(0.072, 0.028, 0.048, 0, -0.012, 0.004, glove, wr);          // wrist cuff of the glove
    B(0.074, 0.085, 0.052, 0, -0.062, 0.006, glove, wr);          // palm
    for (let i = 0; i < 4; i++) {                                 // fingers
      B(0.016, 0.055, 0.024, -0.027 + i * 0.018, -0.128, 0.012, glove, wr);
    }
    B(0.022, 0.045, 0.022, side * -0.036, -0.108, 0.020, glove, wr);   // thumb
    B(0.05, 0.030, 0.008, 0, -0.075, 0.030, rubber, wr);          // knuckle guard
    return { sh, el, wr };
  }
  const L = arm(1), R = arm(-1);

  // ---- legs -----------------------------------------------------------------
  function leg(side) {
    const hp = J(side * 0.105, -0.02, 0, hips);                   // world y 0.93
    CAP(0.078, 0.28, 0, -0.218, 0, fatigue, hp);                  // thigh
    B(0.085, 0.11, 0.045, side * 0.062, -0.20, 0.055, fatigue, hp);   // cargo pocket
    B(0.058, 0.014, 0.010, side * 0.062, -0.148, 0.079, webbing, hp); // pocket flap

    const kn = J(0, -0.44, 0, hp);                                // world y 0.49
    // knee pad: the knee-height scuff band this set asks for, 0.44-0.55 m
    B(0.125, 0.115, 0.045, 0, -0.015, 0.070, rubber, kn);
    B(0.095, 0.035, 0.020, 0, 0.048, 0.070, rubber, kn);
    for (const y of [-0.075, 0.055]) B(0.135, 0.016, 0.014, 0, y, 0.008, webbing, kn);  // pad straps
    CAP(0.062, 0.235, 0, -0.180, 0, fatigue, kn);                 // lower leg
    B(0.075, 0.10, 0.038, 0, -0.20, -0.062, fatigue, kn);         // calf pouch
    B(0.09, 0.055, 0.085, 0, -0.335, 0.002, fatigue, kn);         // blouse over the boot

    // boot: sole, heel, upper, toe cap and lace band
    B(0.112, 0.026, 0.265, 0, -0.477, 0.030, rubber, kn);         // sole -> world y 0.0
    B(0.100, 0.028, 0.075, 0, -0.452, -0.075, rubber, kn);        // heel block
    B(0.104, 0.125, 0.195, 0, -0.402, 0.020, leather, kn);        // upper
    B(0.098, 0.070, 0.085, 0, -0.437, 0.118, leather, kn);        // toe cap
    B(0.086, 0.100, 0.030, 0, -0.372, 0.100, leather, kn);        // tongue
    for (let i = 0; i < 4; i++) B(0.070, 0.008, 0.010, 0, -0.415 + i * 0.030, 0.115, rubber, kn);
    B(0.100, 0.055, 0.030, 0, -0.318, -0.055, leather, kn);       // ankle collar
    return { hp, kn };
  }
  const LL = leg(1), RL = leg(-1);

  // ---- what the game drives -------------------------------------------------
  const weaponHand = J(0, -0.068, 0.030, R.wr);
  const hbHead = J(0, 0.195, 0, head);   hbHead.scale.set(0.25, 0.30, 0.27);
  const hbTorso = J(0, 0.265, 0.005, torso); hbTorso.scale.set(0.44, 0.62, 0.34);
  const hbLimbs = J(0, -0.45, 0.01, hips); hbLimbs.scale.set(0.62, 1.10, 0.34);

  g.userData.joints = {
    hips, torso, head,
    leftShoulder: L.sh, leftElbow: L.el, rightShoulder: R.sh, rightElbow: R.el,
    leftHip: LL.hp, leftKnee: LL.kn, rightHip: RL.hp, rightKnee: RL.kn,
  };
  g.userData.weaponHand = weaponHand;
  g.userData.hitboxes = { head: hbHead, torso: hbTorso, limbs: hbLimbs };
  // hitbox nodes carry their full box extents on .scale (a unit box scaled by it)
  g.userData.hitboxShape = 'unit-box-scaled';
  // Sign conventions, measured on this rig rather than guessed. Every limb hangs
  // down its joint's local -Y, and rotation.x = +a pitches a -Y-pointing limb
  // BACKWARD, so:
  g.userData.jointHints = {
    kneeFlex: '+rotation.x  (heel goes back and up)',
    hipSwingForward: '-rotation.x',
    elbowFlex: '-rotation.x  (forearm comes forward)',
    shoulderRaiseOut: 'left +rotation.z, right -rotation.z',
    headTurn: 'rotation.y on joints.head',
  };

  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= box.min.y; m.position.z -= c.z; });
  return g;
}
