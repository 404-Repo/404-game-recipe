/**
 * wooden_pallet — arm C: a different reading of the reference.
 *
 * Arms A and B read the brief's "seven top deck boards" as a GMA layout with the
 * deck running the 800 direction. The photograph is a true EPAL: five deck
 * boards running the full 1200 length, sitting on three crosswise bearers, on
 * nine blocks in three sizes, on three lengthwise bottom boards, with the
 * branded end blocks the photograph shows. That is the layer order transposed,
 * not a tweak, so it is worth its own arm.
 */
export default function (THREE) {
  const g = new THREE.Group();

  const mat = (color, name, o) => {
    const m = new THREE.MeshStandardMaterial(Object.assign(
      { color, roughness: 0.88, metalness: 0.0 }, o || {}));
    if (name) m.name = name;
    return m;
  };
  const W1 = mat(0x9c7a4e, 'timber', { roughness: 0.86 });
  const W2 = mat(0x93724a, 'timber', { roughness: 0.90 });
  const W3 = mat(0xa38152, 'timber', { roughness: 0.84 });
  const W4 = mat(0x8a6a43, 'timber', { roughness: 0.92 });
  const BLK = mat(0x8f6f47, 'timber', { roughness: 0.90 });
  const BLK2 = mat(0x82653f, 'timber', { roughness: 0.93 });
  const STAMP = mat(0x6e4128, 'timber', { roughness: 0.94 });
  const NAIL = mat(0x3a3d40, 'metal', { roughness: 0.72, metalness: 0.55 });

  const B = (w, h, d, m, x, y, z) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z); g.add(o); return o;
  };
  const MX = (x, y, z, rx, ry, rz) => new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)),
    new THREE.Vector3(1, 1, 1));
  const instanced = (geo, m, mats) => {
    const c = new THREE.Vector3(), p = new THREE.Vector3();
    for (const q of mats) { p.setFromMatrixPosition(q); c.add(p); }
    c.divideScalar(mats.length || 1);
    const im = new THREE.InstancedMesh(geo, m, mats.length);
    const off = new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z);
    const t = new THREE.Matrix4();
    for (let i = 0; i < mats.length; i++) {
      t.multiplyMatrices(off, mats[i]); im.setMatrixAt(i, t);
    }
    im.position.copy(c);
    im.instanceMatrix.needsUpdate = true;
    g.add(im); return im;
  };

  const T = 0.022, BH = 0.078;
  const ZR = [-0.3275, 0, 0.3275];      // bottom-board / block rows
  const XC = [-0.550, 0, 0.550];        // block columns
  const XB = [-0.5275, 0, 0.5275];      // bearer columns, flush at +/-0.600
  const nails = [];

  // ---- three bottom boards, running the 1200 length ----------------------
  const ZB = [-0.350, 0, 0.350];        // bottom boards, flush at +/-0.400
  for (let i = 0; i < 3; i++) {
    B(1.200, T, i === 1 ? 0.145 : 0.100, i === 1 ? W2 : W4, 0, T / 2, ZB[i]);
    for (const x of XC) nails.push(MX(x, T - 0.0015, ZB[i], Math.PI / 2, 0, 0));
  }

  // ---- nine blocks, three sizes as EPAL actually builds them --------------
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const wx = j === 1 ? 0.145 : 0.100;
      const wz = i === 1 ? 0.145 : 0.145;
      B(wx, BH, wz, (i + j) % 2 ? BLK2 : BLK, XC[j], T + BH / 2, ZR[i]);
    }
  }

  // ---- three bearers across the blocks, running the 800 direction ---------
  for (let j = 0; j < 3; j++) {
    B(0.145, T, 0.800, W3, XB[j], T + BH + T / 2, 0);
  }

  // ---- five deck boards running the full 1200 length ---------------------
  const DECK = [[-0.350, 0.100], [-0.18625, 0.145], [0, 0.145],
                [0.18625, 0.145], [0.350, 0.100]];
  const yTop = T + BH + T + T / 2;
  DECK.forEach(([z, w], i) => {
    if (i === 0) {
      // this one is snapped through: two lengths with the break left open
      B(0.955, T, w, W4, -0.1225, yTop, z);
      B(0.205, T, w, W2, 0.4975, yTop, z);
    } else {
      B(1.200, T, w, [W1, W3, W2, W1, W3][i], 0, yTop, z);
    }
    for (const x of XC) {
      nails.push(MX(x - 0.040, yTop + T / 2 - 0.0015, z, Math.PI / 2, 0, 0));
      nails.push(MX(x + 0.040, yTop + T / 2 - 0.0015, z, Math.PI / 2, 0, 0));
    }
  });
  instanced(new THREE.CylinderGeometry(0.0055, 0.0055, 0.004, 6), NAIL, nails);

  // ---- branded end blocks, as the photograph shows -----------------------
  for (const j of [0, 2]) {
    B(0.075, 0.048, 0.004, STAMP, XC[j], T + BH * 0.58, ZR[2] + 0.0740);
    B(0.075, 0.030, 0.004, STAMP, XC[j], T + BH * 0.26, ZR[2] + 0.0740);
    B(0.075, 0.048, 0.004, STAMP, XC[j], T + BH * 0.58, ZR[0] - 0.0740);
  }
  B(0.004, 0.048, 0.078, STAMP, XC[2] + 0.0510, T + BH * 0.58, ZR[1]);
  B(0.004, 0.048, 0.078, STAMP, XC[0] - 0.0510, T + BH * 0.58, ZR[1]);

  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= box.min.y; m.position.z -= c.z; });
  return g;
}
