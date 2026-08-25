/**
 * tool_chest_trolley — the winner (arm A: primitive assembly).
 *
 * 0.90 x 0.50 x 1.00. Worn red paint over steel, a ribbed rubber top mat, nine
 * drawers of four different heights with long chrome pulls, four castors of
 * which the two at the front have brakes, and a push handle on the -X end.
 *
 * Every drawer is an Object3D at its own closed position with the front, the
 * pull and a real tray inside it, so translating it in +Z pulls it out and the
 * inside of the drawer is there when it does.
 *
 * Datum: wheel contact 0.000 | carcass underside 0.140 | carcass top 0.965 | mat 1.000
 */
export default function (THREE) {
  const g = new THREE.Group();

  const M = (color, name, roughness = 0.80, metalness = 0.15) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    if (name) m.name = name;
    return m;
  };
  const red = M(0x8c3a2b, 'metal', 0.78, 0.16);          // worn container red
  const redB = M(0x7e3427, 'metal', 0.82, 0.14);
  const redC = M(0x95402f, 'metal', 0.76, 0.18);
  const gun = M(0x3a3d40, 'metal', 0.72, 0.28);          // drawer interiors, shadow lines
  const chrome = M(0x9aa0a3, 'metal', 0.44, 0.70);       // pull handles, castor forks
  const steel = M(0x5b6167, 'metal', 0.68, 0.38);
  const rust = M(0x6e4128, 'metal', 0.92, 0.18);         // chipped edges
  const yellow = M(0xd6a41f, 'metal', 0.82, 0.10);       // the plated marking
  // rubber: near-black, deliberately unnamed
  const rubber = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.86, metalness: 0.02 });

  const B = (w, h, d, x, y, z, mat, parent = g) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); parent.add(m); return m;
  };
  const J = (x, y, z, parent = g) => {
    const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o;
  };
  const BAR = (r, len, x, y, z, mat, parent = g, axis = 'x') => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
    if (axis === 'x') m.rotation.z = Math.PI / 2;
    if (axis === 'z') m.rotation.x = Math.PI / 2;
    m.position.set(x, y, z); parent.add(m); return m;
  };

  const CW = 0.80, CD = 0.44, BOT = 0.140, TOPY = 0.972;   // carcass width, depth
  const HX = CW / 2, HZ = CD / 2;
  const FZ = HZ;                                            // drawer front plane

  // ---- carcass: sides, back, top, bottom, and a face frame -----------------
  B(0.012, TOPY - BOT, CD, HX - 0.006, (BOT + TOPY) / 2, 0, red);        // right side
  B(0.012, TOPY - BOT, CD, -HX + 0.006, (BOT + TOPY) / 2, 0, red);       // left side
  B(CW - 0.024, TOPY - BOT, 0.012, 0, (BOT + TOPY) / 2, -HZ + 0.006, redB);  // back
  B(CW, 0.014, CD, 0, TOPY - 0.007, 0, redC);                            // top deck
  B(CW - 0.024, 0.012, CD - 0.012, 0, BOT + 0.006, 0, redB);             // floor
  // face frame round the drawer bank
  B(CW, 0.030, 0.014, 0, TOPY - 0.030, HZ - 0.007, redC);
  B(CW, 0.040, 0.014, 0, BOT + 0.020, HZ - 0.007, redC);
  for (const sx of [1, -1]) B(0.024, TOPY - BOT, 0.014, sx * (HX - 0.012), (BOT + TOPY) / 2, HZ - 0.007, redC);

  // ---- back panel: ribs, braces and fittings, not a slab ------------------
  // The first pass had 5mm ribs in the same colour as the panel behind them and
  // the back rendered as one flat red face. Ribs need depth AND a colour change.
  for (let i = 0; i < 5; i++) {
    B(0.034, TOPY - BOT - 0.090, 0.020, -0.30 + i * 0.15, (BOT + TOPY) / 2, -HZ - 0.004, redC);
  }
  B(CW - 0.024, 0.030, 0.026, 0, TOPY - 0.060, -HZ - 0.006, redC);       // top rail
  B(CW - 0.024, 0.030, 0.026, 0, BOT + 0.036, -HZ - 0.006, redC);        // bottom rail
  B(CW - 0.024, 0.024, 0.022, 0, 0.470, -HZ - 0.005, gun);               // mid rail, knee height
  for (const sx of [1, -1]) {                                            // diagonal corner braces
    for (let i = 0; i < 4; i++) {
      B(0.070, 0.024, 0.016, sx * (0.300 - i * 0.052), 0.640 + i * 0.052, -HZ - 0.003, redB);
    }
  }
  B(0.150, 0.090, 0.014, -0.230, 0.300, -HZ - 0.004, gun);               // recessed data panel
  B(0.110, 0.055, 0.008, -0.230, 0.300, -HZ - 0.012, yellow);            // plated marking, rear
  for (const z of [0]) for (const x of [-0.070, 0.070]) {                // cable hooks
    B(0.014, 0.052, 0.014, x, 0.760, -HZ - 0.012, chrome);
    B(0.014, 0.014, 0.034, x, 0.738, -HZ - 0.024, chrome);
  }
  for (const x of [-0.34, -0.17, 0, 0.17, 0.34]) for (const y of [0.230, 0.900]) {
    B(0.011, 0.011, 0.008, x, y, -HZ - 0.006, steel);                    // panel bolts
  }
  B(CW - 0.040, 0.040, 0.026, 0, BOT + 0.014, -HZ - 0.014, steel);       // rear kick bumper
  for (const x of [-0.28, 0.28]) B(0.060, 0.030, 0.018, x, 0.520, -HZ - 0.010, rubber);

  // ---- side panels ---------------------------------------------------------
  // The first pass left both ends as a swage and a rubbing strip, and the gate
  // was right to call them featureless: the drawer bank is so busy that a plain
  // end reads as unmodelled from three metres. A working trolley never has a
  // clear end anyway — it carries the rail, the hooks and the hose.
  for (const sx of [1, -1]) {
    B(0.010, 0.470, 0.330, sx * (HX - 0.001), 0.580, 0, redB);           // recessed swage
    for (const y of [0.360, 0.580, 0.800]) {                             // pressed ribs
      B(0.014, 0.014, CD - 0.070, sx * (HX + 0.003), y, 0, redC);
    }
    B(0.014, 0.036, CD - 0.010, sx * (HX + 0.004), 0.450, 0, gun);       // rubbing strip 0.43-0.47
    B(0.014, 0.014, CD - 0.060, sx * (HX + 0.006), 0.432, 0, rust);      // chipped paint under it
    for (const y of [0.220, 0.900]) for (const z of [-0.170, 0, 0.170]) {  // panel bolts
      B(0.008, 0.012, 0.012, sx * (HX + 0.006), y, z, chrome);
    }
  }
  // right end (+X): a hanging rail with hooks, a socket tray and a coiled hose
  B(0.030, 0.026, 0.030, HX + 0.016, 0.860, -0.150, steel);
  B(0.030, 0.026, 0.030, HX + 0.016, 0.860, 0.150, steel);
  BAR(0.010, 0.330, HX + 0.030, 0.860, 0, chrome, g, 'z');
  for (const z of [-0.120, -0.040, 0.040, 0.120]) {                      // hooks off the rail
    B(0.008, 0.046, 0.008, HX + 0.030, 0.836, z, chrome);
    B(0.008, 0.008, 0.026, HX + 0.030, 0.815, z + 0.010, chrome);
  }
  B(0.048, 0.014, 0.190, HX + 0.014, 0.700, 0.040, steel);               // socket tray floor
  B(0.048, 0.026, 0.010, HX + 0.014, 0.716, 0.140, steel);
  B(0.048, 0.026, 0.010, HX + 0.014, 0.716, -0.060, steel);
  B(0.010, 0.026, 0.190, HX + 0.033, 0.716, 0.040, steel);
  for (let i = 0; i < 5; i++) B(0.020, 0.030, 0.014, HX + 0.018, 0.722, -0.036 + i * 0.038, gun);
  for (const z of [-0.020, 0.100]) B(0.028, 0.048, 0.014, HX + 0.008, 0.672, z, steel);   // tray brackets
  {                                                                       // coiled air hose
    const hose = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.013, 5, 14), rubber);
    hose.rotation.y = Math.PI / 2;
    hose.position.set(HX + 0.016, 0.560, -0.060);
    g.add(hose);
    const hose2 = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.011, 5, 12), rubber);
    hose2.rotation.y = Math.PI / 2;
    hose2.position.set(HX + 0.010, 0.556, -0.060);
    g.add(hose2);
    B(0.024, 0.030, 0.014, HX + 0.008, 0.626, -0.060, chrome);            // hose hook
  }
  // left end (-X): a folded shelf, a magnetic tool strip and the rating plate
  B(0.052, 0.012, 0.200, -HX - 0.022, 0.590, -0.050, steel);             // shelf
  B(0.052, 0.020, 0.010, -HX - 0.022, 0.600, 0.045, steel);              // shelf lip
  for (const z of [-0.130, 0.030]) B(0.044, 0.046, 0.012, -HX - 0.018, 0.565, z, steel);  // brackets
  for (let i = 0; i < 4; i++) B(0.030, 0.026, 0.026, -HX - 0.026, 0.606, -0.122 + i * 0.048, gun);
  B(0.012, 0.036, 0.240, -HX - 0.006, 0.790, 0, gun);                    // magnetic strip
  for (let i = 0; i < 6; i++) B(0.016, 0.014, 0.014, -HX - 0.014, 0.790, -0.100 + i * 0.040, chrome);
  // the plated marking, a rating plate on the left end
  B(0.008, 0.100, 0.150, -HX - 0.004, 0.700, 0.040, yellow);
  B(0.006, 0.070, 0.110, -HX - 0.008, 0.700, 0.040, redB);

  // ---- rubber top mat with ribs ------------------------------------------
  B(CW + 0.008, 0.014, CD + 0.008, 0, TOPY + 0.007, 0, rubber);
  for (let i = 0; i < 12; i++) B(CW - 0.020, 0.008, 0.012, 0, TOPY + 0.018, -0.187 + i * 0.034, rubber);
  for (const sz of [1, -1]) B(CW + 0.012, 0.028, 0.010, 0, TOPY + 0.014, sz * (HZ + 0.007), redC);
  for (const sx of [1, -1]) B(0.010, 0.028, CD + 0.012, sx * (HX + 0.007), TOPY + 0.014, 0, redC);

  // ---- push handle on the -X end -----------------------------------------
  for (const z of [-0.150, 0.150]) {
    BAR(0.011, 0.062, -HX - 0.031, 0.870, z, chrome, g, 'x');
    B(0.030, 0.052, 0.040, -HX - 0.004, 0.870, z, steel);                // mounting boss
    B(0.012, 0.012, 0.012, -HX - 0.010, 0.888, z + 0.014, steel);        // fixing bolt
  }
  BAR(0.013, 0.316, -HX - 0.058, 0.870, 0, chrome, g, 'z');
  for (const z of [-0.158, 0.158]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6), chrome);
    cap.position.set(-HX - 0.058, 0.870, z); g.add(cap);
  }

  // ---- castors: four, the two at the front with brakes -------------------
  function castor(sx, sz, brake) {
    const x = sx * (HX - 0.070), z = sz * (HZ - 0.070);
    B(0.090, 0.014, 0.090, x, BOT - 0.007, z, steel);                    // top plate
    for (const bx of [-0.032, 0.032]) for (const bz of [-0.032, 0.032]) {
      B(0.012, 0.010, 0.012, x + bx, BOT - 0.016, z + bz, chrome);       // plate bolts
    }
    B(0.056, 0.040, 0.070, x, BOT - 0.040, z - 0.008, steel);            // swivel yoke
    for (const fx of [-0.026, 0.026]) B(0.010, 0.058, 0.056, x + fx, BOT - 0.072, z - 0.008, chrome);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.050, 0.050, 0.040, 14), rubber);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.050, z - 0.008);
    g.add(wheel);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.044, 10), chrome);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(x, 0.050, z - 0.008);
    g.add(hub);
    if (brake) {
      B(0.048, 0.012, 0.036, x, 0.028, z + 0.048, steel);                // brake pedal
      B(0.014, 0.030, 0.014, x, 0.042, z + 0.034, chrome);               // brake linkage
      B(0.040, 0.008, 0.014, x, 0.020, z + 0.062, rust);                 // worn pedal lip
    }
  }
  castor(1, 1, true); castor(-1, 1, true); castor(1, -1, false); castor(-1, -1, false);

  // ---- drawers -------------------------------------------------------------
  // heights from the top down; the top two rows are split into halves, as the
  // reference has them, the rest run the full width
  const drawers = [];
  const rows = [
    { h: 0.065, split: true }, { h: 0.065, split: true },
    { h: 0.080 }, { h: 0.095 }, { h: 0.110 }, { h: 0.130 }, { h: 0.165 },
  ];
  let y = TOPY - 0.055;                                    // top of the drawer bank
  for (const row of rows) {
    const cy = y - row.h / 2;
    const spans = row.split ? [[-0.187, 0.362], [0.187, 0.362]] : [[0, 0.744]];
    for (const [cx, w] of spans) {
      // pivot AT the front face: drawer.position.z += d pulls it out by d
      const d = J(cx, cy, FZ, g);
      B(w, row.h - 0.006, 0.014, 0, 0, 0.007, red, d);                   // front panel
      B(w - 0.020, 0.008, 0.008, 0, row.h / 2 - 0.010, 0.016, redC, d);  // front top lip
      B(w - 0.020, 0.006, 0.006, 0, -row.h / 2 + 0.008, 0.016, gun, d);  // shadow line
      // long chrome pull, on brackets
      BAR(0.009, w - 0.070, 0, row.h / 2 - 0.020, 0.026, chrome, d, 'x');
      for (const sx of [1, -1]) B(0.016, 0.020, 0.024, sx * (w / 2 - 0.030), row.h / 2 - 0.020, 0.020, chrome, d);
      // the tray behind the front, so an open drawer is not a hole
      B(w - 0.030, 0.008, 0.400, 0, -row.h / 2 + 0.012, -0.200, gun, d);
      for (const sx of [1, -1]) B(0.008, row.h - 0.020, 0.400, sx * (w / 2 - 0.019), 0, -0.200, gun, d);
      B(w - 0.030, row.h - 0.020, 0.008, 0, 0, -0.398, gun, d);
      drawers.push(d);
    }
    y -= row.h + 0.006;
  }
  // a chipped patch on the second-biggest drawer front, the worn-paint signature
  B(0.120, 0.030, 0.006, 0.140, 0, 0.016, rust, drawers[drawers.length - 2]);

  // MEASURED, not assumed. `drawers` is an ARRAY, and assetlib's carryDeclarations
  // only follows Object3D values and flat MAPS of them — an array falls through to
  // the "plain data" branch, gets round-tripped through JSON by Object3D.copy, and
  // arrives at the game as 9 plain objects with no methods. Rotating or moving one
  // changes nothing and throws nothing. It also cost 103 KB of serialised geometry
  // on every single clone, because Object3D has a toJSON.
  //
  // So the array is published NON-ENUMERABLY: it is there for anyone calling this
  // module directly (where it works, and is what the brief asked for), and both
  // Object.entries and JSON.stringify skip it, so it costs the loader nothing.
  // The keyed map beside it is the form that survives, and it holds the same nodes.
  Object.defineProperty(g.userData, 'drawers', {
    value: drawers, enumerable: false, writable: true, configurable: true,
  });
  const byName = {};
  drawers.forEach((d, i) => { byName['d' + i] = d; });
  g.userData.drawerParts = byName;     // d0..d8, top row left to right, then downward
  g.userData.drawerOpenAxis = 'translate +Z to pull out; travel 0.34 m';

  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= box.min.y; m.position.z -= c.z; });
  return g;
}
