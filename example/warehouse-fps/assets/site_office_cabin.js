// site_office_cabin — arm A
// Primitives assembly. A welded steel box on a skid chassis: door and two
// sliding windows on +Z, vertical corrugation on both ends and on the back, and
// the back also carries the louvred vents, the conduit run and the isolator
// that stop it being a blank wall. Corrugation and rivets are instanced.
export default function (THREE) {
  const g = new THREE.Group();

  // 6.00 x 2.50 x 2.60 overall. The shell is smaller than that; the roof, the
  // step and the lifting brackets take it out to the stated size.
  const BX = 2.90, BZ = 1.12;           // shell half extents
  const Y0 = 0.16, Y1 = 2.42;           // shell bottom and top
  const RX = 2.96, RZ = 1.19;           // roof half extents
  const MY = (Y0 + Y1) / 2, MH = Y1 - Y0;
  const BKZ = -BZ - 0.028;              // the plane the back fittings sit on

  const mat = (hex, name, rough, metal, extra) => {
    const m = new THREE.MeshStandardMaterial(Object.assign({
      color: hex, roughness: rough ?? 0.8, metalness: metal ?? 0.15,
    }, extra || {}));
    if (name) m.name = name;
    return m;
  };
  const cream = mat(0xc9c6bd, 'metal', 0.86, 0.10);
  const creamDull = mat(0xbfbcb3, 'metal', 0.88, 0.10);
  const creamDirty = mat(0xafaca3, 'metal', 0.90, 0.10);
  const corrMat = mat(0xc4c1b8, 'metal', 0.87, 0.10, { side: THREE.DoubleSide });
  const green = mat(0x3a3d33, 'metal', 0.84, 0.14);
  const greenDull = mat(0x44483c, 'metal', 0.86, 0.14);
  const rust = mat(0x6e4128, 'metal', 0.92, 0.30);
  const steel = mat(0x5b6167, 'metal', 0.72, 0.45);
  const galv = mat(0x9aa0a3, 'metal', 0.62, 0.70);
  const galvOpen = mat(0x9aa0a3, 'metal', 0.62, 0.70, { side: THREE.DoubleSide });
  const gun = mat(0x3a3d40, 'metal', 0.70, 0.55);
  const orange = mat(0xbe5220, 'metal', 0.72, 0.12);
  // glass is left unnamed on purpose: surfaces.js skips it
  const glass = new THREE.MeshStandardMaterial({
    color: 0x2b4a63, roughness: 0.35, metalness: 0.2,
    transparent: true, opacity: 0.25, side: THREE.DoubleSide,
  });

  const box = (w, h, d, x, y, z, m) => {
    const n = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    n.position.set(x, y, z);
    g.add(n);
    return n;
  };

  // --- skid chassis -----------------------------------------------------------
  box(2 * BX, 0.10, 2 * BZ, 0, 0.11, 0, rust);
  for (const sz of [1, -1]) box(2 * BX + 0.02, 0.15, 0.09, 0, 0.085, sz * (BZ - 0.045), steel);
  for (const sx of [1, -1]) box(0.09, 0.15, 2 * BZ, sx * (BX - 0.045), 0.085, 0, steel);
  for (const cx of [-2.05, -0.68, 0.68, 2.05]) box(0.07, 0.13, 2 * BZ - 0.12, cx, 0.075, 0, rust);
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      box(0.34, 0.09, 0.10, sx * 1.05, 0.075, sz * (BZ - 0.045), gun);      // forklift pocket
      box(0.16, 0.16, 0.16, sx * (BX - 0.08), 0.08, sz * (BZ - 0.08), rust); // corner foot
    }
  }

  // --- shell ------------------------------------------------------------------
  box(2 * BX, MH, 0.05, 0, MY, BZ - 0.025, cream);
  box(2 * BX, MH, 0.05, 0, MY, -BZ + 0.025, creamDull);
  for (const sx of [1, -1]) box(0.05, MH, 2 * BZ - 0.10, sx * (BX - 0.025), MY, 0, cream);
  box(2 * BX - 0.10, 0.05, 2 * BZ - 0.10, 0, Y1 - 0.025, 0, creamDull);

  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      box(0.10, MH, 0.10, sx * (BX - 0.05), MY, sz * (BZ - 0.05), creamDull);   // corner post
      box(0.055, MH, 0.055, sx * (BX - 0.012), MY, sz * (BZ - 0.012), rust);    // weathered arris
    }
  }
  for (const sz of [1, -1]) {
    box(2 * BX, 0.10, 0.055, 0, Y1 - 0.05, sz * (BZ + 0.005), creamDull);
    box(2 * BX, 0.12, 0.055, 0, Y0 + 0.06, sz * (BZ + 0.005), rust);
  }
  for (const sx of [1, -1]) {
    box(0.055, 0.10, 2 * BZ, sx * (BX + 0.005), Y1 - 0.05, 0, creamDull);
    box(0.055, 0.12, 2 * BZ, sx * (BX + 0.005), Y0 + 0.06, 0, rust);
  }

  // --- knee-height scuff: dirt band plus a rubbing rail, 0.34 - 0.56 ----------
  for (const sz of [1, -1]) {
    box(2 * BX, 0.22, 0.020, 0, 0.45, sz * (BZ + 0.012), creamDirty);
    box(2 * BX, 0.035, 0.032, 0, 0.545, sz * (BZ + 0.018), steel);
  }
  for (const sx of [1, -1]) {
    box(0.020, 0.22, 2 * BZ, sx * (BX + 0.012), 0.45, 0, creamDirty);
    box(0.032, 0.035, 2 * BZ, sx * (BX + 0.018), 0.545, 0, steel);
  }

  // --- corrugation on both ends and the back, one instanced rib --------------
  const RIB_H = MH - 0.20;
  const ribGeo = new THREE.CylinderGeometry(0.030, 0.030, RIB_H, 6, 1, true, -Math.PI / 2, Math.PI);
  const ribs = [];
  for (let x = -BX + 0.14; x <= BX - 0.14; x += 0.101) ribs.push([x, -BZ - 0.012, Math.PI]);
  for (const sx of [1, -1]) {
    for (let z = -BZ + 0.14; z <= BZ - 0.14; z += 0.101) {
      ribs.push([sx * (BX + 0.012), z, sx * Math.PI / 2]);
    }
  }
  const corr = new THREE.InstancedMesh(ribGeo, corrMat, ribs.length);
  corr.position.set(0, MY, 0);
  {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(),
      p = new THREE.Vector3(), s1 = new THREE.Vector3(1, 1, 1);
    ribs.forEach(([a, b, ry], i) => {
      q.setFromEuler(new THREE.Euler(0, ry, 0));
      p.set(a, 0, b);
      corr.setMatrixAt(i, m4.compose(p, q, s1));
    });
    corr.instanceMatrix.needsUpdate = true;
  }
  g.add(corr);

  // --- roof -------------------------------------------------------------------
  // a positive rotation.x drops the +Z edge, which is the fall we want: the roof
  // sheds to the front, over the door.
  const PITCH = 0.028;
  const roof = box(2 * RX, 0.09, 2 * RZ, 0, 2.475, 0, green);
  roof.rotation.x = PITCH;
  box(2 * RX, 0.055, 0.05, 0, 2.443, RZ - 0.02, greenDull);       // drip edge, front
  box(2 * RX, 0.055, 0.05, 0, 2.510, -RZ + 0.02, greenDull);      // upstand, back
  for (const sx of [1, -1]) box(0.05, 0.06, 2 * RZ, sx * (RX - 0.02), 2.478, 0, greenDull);
  for (const cz of [-0.60, 0.0, 0.60]) {
    const r = box(2 * RX - 0.14, 0.030, 0.045, 0, 2.526 - cz * PITCH, cz, greenDull);
    r.rotation.x = PITCH;
  }
  box(0.30, 0.13, 0.30, -1.60, 2.585, -0.34, galv);               // roof vent cowl
  box(0.38, 0.030, 0.38, -1.60, 2.665, -0.34, galv);
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      const br = box(0.13, 0.045, 0.20, sx * 2.935, 2.545, sz * (RZ - 0.16), steel);
      br.rotation.z = sx * 0.03;
      const eye = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.009, 4, 8), rust);
      eye.position.set(sx * 2.950, 2.572, sz * (RZ - 0.16));
      eye.rotation.y = Math.PI / 2;
      g.add(eye);
      box(0.055, 0.17, 0.16, sx * (BX - 0.03), 2.44, sz * (RZ - 0.16), steel);
    }
  }

  // --- the door, on +Z ---------------------------------------------------------
  const DX = 1.00, DW = 0.90, DH = 2.05, DY0 = Y0 + 0.02;
  box(DW + 0.16, DH + 0.14, 0.06, DX, DY0 + DH / 2, BZ + 0.030, creamDull);
  box(DW, DH, 0.045, DX, DY0 + DH / 2, BZ + 0.048, cream);
  box(DW - 0.10, 0.05, 0.030, DX, DY0 + DH - 0.22, BZ + 0.066, creamDull);
  box(DW - 0.10, 0.05, 0.030, DX, DY0 + 0.30, BZ + 0.066, rust);
  for (const hy of [DY0 + 0.22, DY0 + DH / 2, DY0 + DH - 0.22]) {
    box(0.055, 0.13, 0.055, DX - DW / 2 - 0.035, hy, BZ + 0.048, gun);
  }
  box(0.13, 0.17, 0.055, DX + DW / 2 - 0.13, DY0 + 1.10, BZ + 0.075, galv);
  box(0.065, 0.075, 0.042, DX + DW / 2 - 0.13, DY0 + 1.16, BZ + 0.102, gun);
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.007, 4, 8, Math.PI), gun);
  shackle.position.set(DX + DW / 2 - 0.13, DY0 + 1.20, BZ + 0.102);
  g.add(shackle);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.30, 6), galv);
  handle.position.set(DX - DW / 2 + 0.12, DY0 + 1.00, BZ + 0.082);
  g.add(handle);
  for (const hy of [DY0 + 0.86, DY0 + 1.14]) {
    box(0.030, 0.030, 0.070, DX - DW / 2 + 0.12, hy, BZ + 0.060, galv);
  }
  box(0.86, 0.035, 0.28, DX, 0.155, BZ + 0.10, rust);                       // step tread
  for (const sx of [1, -1]) box(0.05, 0.14, 0.05, DX + sx * 0.36, 0.075, BZ + 0.19, steel);

  // --- two sliding windows with security bars, on +Z --------------------------
  const winY0 = 1.12, winY1 = 1.84;
  for (const wx of [-2.08, -0.58]) {
    const WW = 1.16, WH = winY1 - winY0, WY = (winY0 + winY1) / 2;
    box(WW + 0.10, WH + 0.10, 0.045, wx, WY, BZ + 0.028, galv);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(WW, WH, 0.014), glass);
    pane.position.set(wx, WY, BZ + 0.040);
    g.add(pane);
    box(0.035, WH, 0.050, wx, WY, BZ + 0.046, galv);                 // sliding-light mullion
    box(WW + 0.12, 0.045, 0.075, wx, winY0 - 0.055, BZ + 0.040, creamDull);
    box(WW + 0.12, 0.035, 0.055, wx, winY1 + 0.058, BZ + 0.038, creamDull);
    for (let i = 0; i < 6; i++) {
      const bxp = wx - WW / 2 + 0.09 + i * ((WW - 0.18) / 5);
      box(0.016, WH + 0.06, 0.016, bxp, WY, BZ + 0.062, rust);
    }
    for (const by of [winY0 + 0.12, winY1 - 0.12]) box(WW + 0.04, 0.014, 0.014, wx, by, BZ + 0.062, rust);
  }

  // --- the back: panel joints, vents, conduit, isolator ------------------------
  box(2 * BX - 0.16, 0.05, 0.030, 0, 1.28, BKZ, creamDirty);
  for (const jx of [-1.58, 0.0, 1.58]) box(0.055, MH - 0.18, 0.030, jx, MY, BKZ, creamDirty);
  for (const vx of [-1.92, 1.12]) {
    box(0.50, 0.38, 0.040, vx, 1.86, BKZ - 0.012, steel);
    for (let i = 0; i < 5; i++) {
      const bl = box(0.44, 0.028, 0.045, vx, 1.72 + i * 0.07, BKZ - 0.030, galv);
      bl.rotation.x = 0.55;
    }
  }
  const cond = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.28, 8), galv);
  cond.position.set(2.32, 0.95, BKZ - 0.030);
  g.add(cond);
  const cond2 = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.90, 8), galv);
  cond2.position.set(1.38, 1.60, BKZ - 0.030);
  cond2.rotation.z = Math.PI / 2;
  g.add(cond2);
  const elbow = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.022, 5, 8, Math.PI / 2), galv);
  elbow.position.set(2.272, 1.552, BKZ - 0.030);
  g.add(elbow);
  for (const cy of [0.50, 0.95, 1.40]) box(0.070, 0.020, 0.055, 2.32, cy, BKZ - 0.048, rust);
  box(0.30, 0.40, 0.12, 2.32, 1.92, BKZ - 0.050, gun);              // isolator
  box(0.085, 0.085, 0.040, 2.39, 1.78, BKZ - 0.112, orange);        // isolator handle
  box(0.26, 0.20, 0.09, 0.40, 0.62, BKZ - 0.035, steel);            // terminal box
  const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.10, 10, 1, true), galvOpen);
  cowl.position.set(-0.88, 0.95, BKZ - 0.048);
  cowl.rotation.x = Math.PI / 2;
  g.add(cowl);
  box(0.28, 0.028, 0.28, -0.88, 1.05, BKZ - 0.048, galv);

  // --- the front is not allowed to be a blank sheet either --------------------
  // a sheet joint strap right of the door, and a small louvred vent beside it
  box(0.055, MH - 0.18, 0.028, 2.14, MY, BZ + 0.012, creamDirty);
  box(0.36, 0.28, 0.035, 2.56, 0.95, BZ + 0.020, steel);
  for (let i = 0; i < 4; i++) {
    const bl = box(0.30, 0.026, 0.042, 2.56, 0.86 + i * 0.06, BZ + 0.036, galv);
    bl.rotation.x = 0.55;
  }

  // --- the marking: a plated number beside the door, another on the back -----
  box(0.30, 0.20, 0.010, 1.70, 1.86, BZ + 0.032, gun);
  box(0.26, 0.16, 0.014, 1.70, 1.86, BZ + 0.040, orange);
  box(0.24, 0.20, 0.010, -2.55, 0.92, BKZ - 0.008, gun);
  box(0.20, 0.12, 0.012, -2.55, 0.92, BKZ - 0.016, orange);

  // --- rivets, instanced --------------------------------------------------------
  const rivGeo = new THREE.SphereGeometry(0.0085, 4, 2);
  const rivets = [];
  for (const sz of [1, -1]) {
    for (const sx of [1, -1]) {
      for (let i = 0; i < 11; i++) rivets.push([sx * (BX - 0.05), Y0 + 0.14 + i * 0.20, sz * (BZ + 0.036)]);
    }
    for (let i = 0; i < 22; i++) {
      rivets.push([-BX + 0.18 + i * 0.25, Y1 - 0.05, sz * (BZ + 0.036)]);
      rivets.push([-BX + 0.18 + i * 0.25, Y0 + 0.09, sz * (BZ + 0.036)]);
    }
  }
  for (const sx of [1, -1]) {
    for (let i = 0; i < 9; i++) {
      rivets.push([sx * (BX + 0.036), Y1 - 0.05, -BZ + 0.14 + i * 0.25]);
      rivets.push([sx * (BX + 0.036), Y0 + 0.09, -BZ + 0.14 + i * 0.25]);
    }
  }
  for (const jx of [-1.58, 0.0, 1.58]) {
    for (let i = 0; i < 8; i++) rivets.push([jx, Y0 + 0.20 + i * 0.28, BKZ - 0.016]);
  }
  for (let i = 0; i < 8; i++) rivets.push([2.14, Y0 + 0.20 + i * 0.28, BZ + 0.030]);
  const riv = new THREE.InstancedMesh(rivGeo, steel, rivets.length);
  riv.position.set(0, MY, 0);
  {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(),
      p = new THREE.Vector3(), s1 = new THREE.Vector3(1, 1, 1);
    rivets.forEach(([x, y, z], i) => { p.set(x, y - MY, z); riv.setMatrixAt(i, m4.compose(p, q, s1)); });
    riv.instanceMatrix.needsUpdate = true;
  }
  g.add(riv);

  const bb = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) bb.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = bb.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= bb.min.y; m.position.z -= c.z; });

  return g;
}
