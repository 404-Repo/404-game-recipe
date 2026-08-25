/**
 * assault_rifle — the winner (arm C: a different part breakdown / reading).
 *
 * A and B read the handguard as a slim M-LOK tube. This reads it as a QUAD RAIL:
 * four picatinny faces with real cross-slots all the way round, which is the
 * older, heavier, more beaten-up carbine the reference photo actually looks
 * like. The gun is decomposed into five sub-assemblies rather than a flat list
 * of parts — UPPER, LOWER, FURNITURE, BARREL, OPTIC — each a Group with its own
 * local origin on the bore axis, so the whole thing can be re-proportioned by
 * moving five numbers.
 *
 * Datum: magazine floor 0.000 | BORE 0.205 | rail top 0.247 | SIGHT 0.264 | crown 0.280
 */
export default function (THREE) {
  const g = new THREE.Group();

  const M = (color, name, roughness = 0.72, metalness = 0.22) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    if (name) m.name = name;
    return m;
  };
  const receiver = M(0x3a3d40, 'metal', 0.66, 0.28);
  const receiverB = M(0x45484b, 'metal', 0.70, 0.24);
  const steelD = M(0x2f3235, 'metal', 0.58, 0.45);
  const galv = M(0x5b6167, 'metal', 0.62, 0.40);
  const brass = M(0x9c7a4e, 'metal', 0.55, 0.55);
  const marker = M(0xd6a41f, 'metal', 0.80, 0.10);
  const poly = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.80, metalness: 0.03 });
  const polyB = new THREE.MeshStandardMaterial({ color: 0x242629, roughness: 0.84, metalness: 0.03 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x2b4a63, roughness: 0.38, metalness: 0.10, transparent: true, opacity: 0.55,
    side: THREE.DoubleSide });

  // Datum, chosen against the 0.28 m height budget. A 30-round magazine and a
  // hooded holographic sight do not both fit in 0.28 m at real scale, and the
  // optic is the part the player stares at for the whole game, so the magazine
  // is a 20-rounder and the sight gets the room.
  const BORE = 0.190, RAIL = 0.236, SIGHT = 0.262;

  const B = (w, h, d, x, y, z, mat, parent) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); parent.add(m); return m;
  };
  const TUBE = (rt, rb, len, x, y, z, mat, parent, seg = 8, open = false) => {
    let mm = mat;
    if (open) { mm = mat.clone(); mm.side = THREE.DoubleSide; mm.name = mat.name; }
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, len, seg, 1, open), mm);
    m.rotation.x = Math.PI / 2; m.position.set(x, y, z); parent.add(m); return m;
  };
  const J = (x, y, z, parent) => {
    const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o;
  };
  /** a run of picatinny cross-slots on one face of a rail */
  const slots = (n, z0, pitch, w, t, axis, sign, r, mat, parent) => {
    for (let i = 0; i < n; i++) {
      const z = z0 + i * pitch;
      if (axis === 'y') B(w, t, 0.0075, 0, sign * r, z, mat, parent);
      else B(t, w, 0.0075, sign * r, 0, z, mat, parent);
    }
  };

  // ===== UPPER ================================================================
  const UPPER = new THREE.Group();
  UPPER.position.set(0, BORE, 0);
  g.add(UPPER);
  B(0.038, 0.054, 0.230, 0, 0.001, -0.008, receiver, UPPER);
  B(0.028, 0.024, 0.230, 0, 0.030, -0.008, receiverB, UPPER);       // flat-top riser
  B(0.021, 0.008, 0.238, 0, 0.034, -0.008, receiverB, UPPER);       // rail base
  slots(11, -0.116, 0.0198, 0.021, 0.010, 'y', 1, 0.041, receiverB, UPPER);
  B(0.006, 0.032, 0.072, 0.0205, 0.006, 0.012, steelD, UPPER);      // port recess
  B(0.009, 0.036, 0.078, 0.0250, 0.004, 0.012, receiverB, UPPER);   // dust cover
  B(0.004, 0.011, 0.064, 0.0300, 0.004, 0.012, galv, UPPER);
  B(0.018, 0.032, 0.032, 0.0245, 0.014, -0.032, receiverB, UPPER);  // brass deflector
  B(0.014, 0.018, 0.018, 0.0235, 0.016, 0.058, receiverB, UPPER);   // forward assist
  B(0.009, 0.013, 0.013, 0.0300, 0.016, 0.058, galv, UPPER);
  B(0.011, 0.026, 0.042, -0.0235, -0.014, -0.020, receiverB, UPPER);
  B(0.007, 0.015, 0.015, -0.0285, -0.014, -0.034, galv, UPPER);
  B(0.003, 0.014, 0.026, 0.0305, 0.024, -0.078, marker, UPPER);     // plated data panel

  // ===== LOWER ================================================================
  const LOWER = new THREE.Group();
  LOWER.position.set(0, BORE, 0);
  g.add(LOWER);
  B(0.038, 0.052, 0.194, 0, -0.026, -0.026, receiver, LOWER);
  B(0.046, 0.064, 0.078, 0, -0.018, 0.026, receiver, LOWER);        // magwell
  B(0.050, 0.011, 0.086, 0, -0.045, 0.026, receiverB, LOWER);       // flared mouth
  B(0.011, 0.015, 0.015, 0.0250, -0.015, 0.054, galv, LOWER);       // mag release
  B(0.015, 0.011, 0.011, -0.0250, -0.015, 0.054, galv, LOWER);
  for (const s of [1, -1]) B(0.011, 0.024, 0.024, s * 0.0235, -0.019, -0.052, galv, LOWER);
  for (const z of [-0.058, -0.006]) for (const s of [1, -1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.005, 6), galv);
    p.rotation.z = Math.PI / 2; p.position.set(s * 0.020, -0.015, z); LOWER.add(p);
  }
  B(0.015, 0.008, 0.082, 0, -0.079, 0.010, receiverB, LOWER);       // guard, bottom bar
  B(0.015, 0.034, 0.008, 0, -0.062, 0.048, receiverB, LOWER);       // guard, front bar
  const rearBar = B(0.015, 0.034, 0.008, 0, -0.062, -0.028, receiverB, LOWER);
  rearBar.rotation.x = -0.24;                                       // NEGATIVE leans it FORWARD
  B(0.009, 0.032, 0.011, 0, -0.064, 0.014, galv, LOWER);            // trigger

  // ===== FURNITURE: grip and stock ===========================================
  const FURN = new THREE.Group();
  FURN.position.set(0, BORE, 0);
  g.add(FURN);
  const grip = new THREE.Group();
  grip.position.set(0, -0.055, -0.048);
  grip.rotation.x = 0.32;
  B(0.036, 0.118, 0.046, 0, -0.052, 0, poly, grip);
  B(0.040, 0.022, 0.052, 0, -0.110, 0, polyB, grip);
  B(0.032, 0.026, 0.016, 0, -0.018, 0.028, polyB, grip);
  for (let i = 0; i < 6; i++) B(0.038, 0.007, 0.007, 0, -0.024 - i * 0.016, -0.022, polyB, grip);
  FURN.add(grip);
  TUBE(0.020, 0.020, 0.200, 0, 0, -0.208, receiverB, FURN, 10);     // receiver extension
  for (let i = 0; i < 7; i++) B(0.034, 0.007, 0.007, 0, -0.024, -0.216 - i * 0.016, galv, FURN);
  B(0.064, 0.092, 0.158, 0, -0.014, -0.362, poly, FURN);            // stock body
  for (const s2 of [1, -1]) {                                       // lightening cuts
    B(0.010, 0.050, 0.088, s2 * 0.031, -0.016, -0.360, polyB, FURN);
    B(0.008, 0.022, 0.030, s2 * 0.033, 0.020, -0.300, polyB, FURN); // sling slot
  }
  B(0.074, 0.032, 0.126, 0, 0.032, -0.354, polyB, FURN);            // comb
  B(0.052, 0.012, 0.098, 0, 0.050, -0.352, poly, FURN);             // comb top pad
  B(0.070, 0.020, 0.034, 0, -0.056, -0.418, poly, FURN);            // toe hook under the butt
  B(0.078, 0.100, 0.022, 0, -0.018, -0.437, polyB, FURN);           // butt plate
  B(0.072, 0.092, 0.010, 0, -0.018, -0.4455, poly, FURN);           // rubber recoil pad
  for (let i = 0; i < 5; i++) B(0.076, 0.009, 0.009, 0, -0.056 + i * 0.020, -0.4475, poly, FURN);
  B(0.032, 0.032, 0.044, 0, -0.058, -0.332, polyB, FURN);           // adjustment lever
  B(0.026, 0.040, 0.030, 0, 0.010, -0.300, polyB, FURN);            // sling bar housing
  for (const s of [1, -1]) {                                        // sling loops -> +-0.045
    B(0.022, 0.032, 0.028, s * 0.033, -0.006, -0.300, receiverB, FURN);
    const l = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0035, 4, 8), galv);
    l.rotation.y = Math.PI / 2; l.position.set(s * 0.0415, -0.006, -0.300); FURN.add(l);
  }

  // ===== BARREL: quad rail, barrel, gas block, muzzle brake ===================
  const BARREL = new THREE.Group();
  BARREL.position.set(0, BORE, 0);
  g.add(BARREL);
  TUBE(0.021, 0.021, 0.028, 0, 0, 0.118, steelD, BARREL, 10);       // barrel nut
  TUBE(0.0115, 0.0115, 0.300, 0, 0, 0.258, steelD, BARREL, 8);      // barrel
  // the quad rail: four flat faces, each with its own cross-slots, joined by
  // four corner fillets. Nothing here is a plain tube.
  const QR0 = 0.116, QRL = 0.262, QRC = QR0 + QRL / 2, QRF = 0.0335, QRS = 0.0395;
  B(0.021, 0.010, QRL, 0, QRF, QRC, receiverB, BARREL);
  B(0.021, 0.010, QRL, 0, -QRF, QRC, receiverB, BARREL);
  B(0.010, 0.021, QRL, QRF, 0, QRC, receiverB, BARREL);
  B(0.010, 0.021, QRL, -QRF, 0, QRC, receiverB, BARREL);
  for (const s of [1, -1]) for (const t of [1, -1]) {
    B(0.016, 0.016, QRL, s * 0.022, t * 0.022, QRC, poly, BARREL);  // corner fillets
  }
  B(0.078, 0.078, 0.020, 0, 0, QR0 + 0.006, receiverB, BARREL);     // rear collar
  B(0.078, 0.078, 0.018, 0, 0, QR0 + QRL - 0.006, receiverB, BARREL);
  slots(11, 0.134, 0.0215, 0.021, 0.011, 'y', 1, QRS, receiverB, BARREL);
  slots(11, 0.134, 0.0215, 0.021, 0.011, 'y', -1, QRS, receiverB, BARREL);
  slots(11, 0.134, 0.0215, 0.021, 0.011, 'x', 1, QRS, receiverB, BARREL);
  slots(11, 0.134, 0.0215, 0.021, 0.011, 'x', -1, QRS, receiverB, BARREL);
  B(0.032, 0.028, 0.032, 0, 0.020, 0.392, steelD, BARREL);          // gas block
  B(0.013, 0.013, 0.062, 0, 0.014, 0.360, steelD, BARREL);          // gas tube
  TUBE(0.018, 0.020, 0.054, 0, 0, 0.423, steelD, BARREL, 10);       // muzzle brake
  for (let i = 0; i < 3; i++) B(0.042, 0.006, 0.008, 0, 0.0, 0.408 + i * 0.014, poly, BARREL);
  TUBE(0.011, 0.011, 0.008, 0, 0, 0.446, poly, BARREL, 8, true);    // open bore, DoubleSide

  // ===== OPTIC ================================================================
  const OPTIC = new THREE.Group();
  OPTIC.position.set(0, 0, 0);
  g.add(OPTIC);
  B(0.032, 0.016, 0.090, 0, RAIL + 0.004, -0.008, receiverB, OPTIC);   // mount base
  for (const s of [1, -1]) {
    const n = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.011, 6), galv);
    n.rotation.z = Math.PI / 2; n.position.set(s * 0.0325, RAIL + 0.005, -0.008); OPTIC.add(n);
  }
  B(0.058, 0.007, 0.090, 0, 0.2465, -0.008, receiverB, OPTIC);      // hood floor
  // hood walls, front wall and roof. The REAR stays open, so the sight line
  // from sightRear to sightFront actually passes through the housing.
  for (const s of [1, -1]) B(0.009, 0.033, 0.072, s * 0.0245, 0.2635, -0.008, receiverB, OPTIC);
  B(0.058, 0.033, 0.014, 0, 0.2635, 0.032, receiverB, OPTIC);       // front wall
  B(0.044, 0.005, 0.070, 0, 0.2775, -0.008, receiverB, OPTIC);      // roof -> crown 0.280
  for (const s of [1, -1]) B(0.007, 0.006, 0.070, s * 0.017, 0.2775, -0.008, polyB, OPTIC);
  B(0.038, 0.026, 0.004, 0, SIGHT, -0.030, glass, OPTIC);           // holo screen
  B(0.044, 0.008, 0.008, 0, 0.2475, -0.044, receiverB, OPTIC);      // rear lip
  for (const z of [-0.050, 0.024]) B(0.014, 0.011, 0.010, 0.033, 0.256, z, galv, OPTIC);
  B(0.016, 0.017, 0.017, -0.033, 0.257, 0.006, galv, OPTIC);        // battery cap
  B(0.016, 0.026, 0.011, 0, RAIL + 0.011, 0.330, receiverB, OPTIC); // back-up front sight
  B(0.004, 0.021, 0.004, 0, RAIL + 0.020, 0.330, galv, OPTIC);
  for (const s of [1, -1]) B(0.003, 0.017, 0.007, s * 0.006, RAIL + 0.020, 0.330, receiverB, OPTIC);

  // ===== moving parts =========================================================
  // magazine, pivoted at the magwell, built as a stack of shells so its curve is
  // geometry rather than a texture
  const magazine = J(0, 0.142, 0.026, g);
  let link = magazine;
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Object3D();
    seg.position.y = i === 0 ? 0 : -0.0191;
    seg.rotation.x = i === 0 ? 0 : -0.062;
    link.add(seg);
    B(0.031, 0.030, 0.050, 0, -0.0140, 0, i === 5 ? polyB : poly, seg);
    if (i > 0) B(0.033, 0.005, 0.052, 0, 0.0010, 0, polyB, seg);    // shell seam
    link = seg;
  }
  B(0.038, 0.013, 0.058, 0, -0.034, 0, polyB, link);                // floor plate
  B(0.032, 0.009, 0.009, 0, -0.026, 0.028, galv, link);

  const charging = J(0, BORE + 0.028, -0.106, g);
  B(0.032, 0.013, 0.074, 0, 0, 0.032, receiverB, charging);
  B(0.066, 0.015, 0.017, 0, 0, 0, receiverB, charging);
  B(0.024, 0.011, 0.013, -0.027, -0.004, -0.007, galv, charging);

  // spent 5.56 case at the origin of its own local space, inside the receiver.
  // 45 mm long: below the verifier's 5 cm minimum, so it can never be its own asset.
  const casingProto = J(0, BORE + 0.002, -0.020, g);
  const cs = [[0.0055, -0.0225], [0.0055, -0.0198], [0.0048, -0.0188],
              [0.0048, 0.0075], [0.0033, 0.0135], [0.0033, 0.0225]];
  for (let i = 0; i < cs.length - 1; i++) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(cs[i + 1][0], cs[i][0], cs[i + 1][1] - cs[i][1], 8), brass);
    m.rotation.x = Math.PI / 2;
    m.position.z = (cs[i][1] + cs[i + 1][1]) / 2;
    casingProto.add(m);
  }

  const muzzle = J(0, BORE, 0.450, g);
  const ejectPort = J(0.0250, BORE + 0.006, 0.012, g);
  ejectPort.rotation.y = Math.PI / 2;
  const sightRear = J(0, SIGHT, -0.020, g);
  const sightFront = J(0, SIGHT, 0.330, g);

  g.userData.muzzle = muzzle;
  g.userData.ejectPort = ejectPort;
  g.userData.magazine = magazine;
  g.userData.charging = charging;
  g.userData.sightRear = sightRear;
  g.userData.sightFront = sightFront;
  g.userData.casingProto = casingProto;
  g.userData.chargingTravel = -0.075;

  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= box.min.y; m.position.z -= c.z; });
  return g;
}
