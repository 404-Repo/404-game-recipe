// structural_bay — arm B: built from profiles.
// Every steel member is a real rolled section swept from its cross-section:
// I-sections for the columns, chord and rafters, Z-sections for the purlins,
// angle sections for the lattice web, cut plates for every gusset.
// bevelEnabled is false everywhere, so the swept bounds are the drawn bounds.
export default function (THREE) {
  const g = new THREE.Group();

  const mat = (color, name, r, m) => {
    const s = new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m });
    if (name) s.name = name;
    return s;
  };
  const STEEL_A = mat(0x5b6167, 'metal', 0.74, 0.18);
  const STEEL_B = mat(0x565c62, 'metal', 0.81, 0.14);
  const STEEL_C = mat(0x636970, 'metal', 0.70, 0.20);
  const GALV    = mat(0x9aa0a3, 'metal', 0.60, 0.62);
  const GALV_D  = mat(0x8e9497, 'metal', 0.67, 0.55);
  const RUST    = mat(0x6e4128, 'metal', 0.93, 0.08);
  const ORANGE  = mat(0xbe5220, 'metal', 0.82, 0.06);
  const YELLOW  = mat(0xd6a41f, 'metal', 0.80, 0.06);
  const CONC    = mat(0x4e4c47, 'stone', 0.94, 0.02);

  const sweep = (shape, len) =>
    new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false, steps: 1, curveSegments: 4 });

  // --- cross-sections, drawn in the profile's own XY ------------------------
  const iShape = (d, bf, tw, tf) => {
    const s = new THREE.Shape();
    const hd = d / 2, hb = bf / 2, ht = tw / 2;
    s.moveTo(-hb, -hd); s.lineTo(hb, -hd); s.lineTo(hb, -hd + tf); s.lineTo(ht, -hd + tf);
    s.lineTo(ht, hd - tf); s.lineTo(hb, hd - tf); s.lineTo(hb, hd); s.lineTo(-hb, hd);
    s.lineTo(-hb, hd - tf); s.lineTo(-ht, hd - tf); s.lineTo(-ht, -hd + tf); s.lineTo(-hb, -hd + tf);
    s.closePath();
    return s;
  };
  const zShape = (d, fl, t) => {
    const s = new THREE.Shape();
    const hd = d / 2, ht = t / 2;
    s.moveTo(-fl, -hd); s.lineTo(ht, -hd); s.lineTo(ht, hd - t); s.lineTo(fl, hd - t);
    s.lineTo(fl, hd); s.lineTo(-ht, hd); s.lineTo(-ht, -hd + t); s.lineTo(-fl, -hd + t);
    s.closePath();
    return s;
  };
  const lShape = (a, t) => {
    const s = new THREE.Shape();
    const h = a / 2;
    s.moveTo(-h, -h); s.lineTo(h, -h); s.lineTo(h, -h + t); s.lineTo(-h + t, -h + t);
    s.lineTo(-h + t, h); s.lineTo(-h, h);
    s.closePath();
    return s;
  };
  const plateShape = (w, h, cut) => {
    const s = new THREE.Shape();
    const hw = w / 2, hh = h / 2;
    s.moveTo(-hw + cut, -hh); s.lineTo(hw - cut, -hh); s.lineTo(hw, -hh + cut);
    s.lineTo(hw, hh - cut); s.lineTo(hw - cut, hh); s.lineTo(-hw + cut, hh);
    s.lineTo(-hw, hh - cut); s.lineTo(-hw, -hh + cut);
    s.closePath();
    return s;
  };

  // --- orientations ---------------------------------------------------------
  // column: sweep axis -> +Y, profile depth -> X, profile width -> Z
  const column = (shape, len, material, x, y0, z) => {
    const geo = sweep(shape, len);
    geo.rotateX(-Math.PI / 2); geo.rotateY(Math.PI / 2);
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y0, z);
    g.add(m); return m;
  };
  // beam: sweep axis -> +X from the mesh origin, profile depth -> Y
  const beam = (shape, len, material, x0, y0, z, rz) => {
    const geo = sweep(shape, len);
    geo.rotateY(Math.PI / 2);
    const m = new THREE.Mesh(geo, material);
    m.position.set(x0, y0, z);
    if (rz) m.rotation.z = rz;
    g.add(m); return m;
  };
  // a member drawn end to end, whatever direction it runs
  const strut = (shape, material, x1, y1, x2, y2, z) =>
    beam(shape, Math.hypot(x2 - x1, y2 - y1), material, x1, y1, z, Math.atan2(y2 - y1, x2 - x1));
  // vertical plate: shape in XY, thickness through Z
  const vplate = (shape, t, material, x, y, z) => {
    const geo = sweep(shape, t); geo.translate(0, 0, -t / 2);
    const m = new THREE.Mesh(geo, material); m.position.set(x, y, z);
    g.add(m); return m;
  };
  // horizontal plate: shape in XZ, thickness through Y
  const hplate = (shape, t, material, x, y, z) => {
    const geo = sweep(shape, t); geo.translate(0, 0, -t / 2); geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, material); m.position.set(x, y, z);
    g.add(m); return m;
  };
  // purlin: sweep axis -> +Z with no reorientation at all
  const purlin = (shape, len, material, x, y, z, rz) => {
    const geo = sweep(shape, len); geo.translate(0, 0, -len / 2);
    const m = new THREE.Mesh(geo, material); m.position.set(x, y, z);
    if (rz) m.rotation.z = rz;
    g.add(m); return m;
  };
  const B = (w, h, d, m, x, y, z, rz) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    if (rz) mesh.rotation.z = rz;
    g.add(mesh); return mesh;
  };
  const instance = (geo, material, list, px, py, pz) => {
    const im = new THREE.InstancedMesh(geo, material, list.length);
    im.position.set(px, py, pz);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    list.forEach((t, i) => {
      const r = t.r || [0, 0, 0], s = t.s || [1, 1, 1];
      e.set(r[0], r[1], r[2]); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(t.p[0] - px, t.p[1] - py, t.p[2] - pz), q,
        new THREE.Vector3(s[0], s[1], s[2]));
      im.setMatrixAt(i, m4);
    });
    im.instanceMatrix.needsUpdate = true;
    g.add(im); return im;
  };

  // --- frame layout ---------------------------------------------------------
  const HALF = 4.0;
  const TH = (20 * Math.PI) / 180;
  const TAN = Math.tan(TH), COS = Math.cos(TH), SIN = Math.sin(TH);
  const RAF_T = 0.18, RAF_W = 0.16;
  const APEX_TOP = 9.34;
  const CHORD_Y = 7.65, CHORD_H = 0.20, CHORD_W = 0.16;
  const CHORD_TOP = CHORD_Y + CHORD_H / 2;
  const PAD_H = 0.02, PLATE_H = 0.032, COL_BASE = PAD_H + PLATE_H;
  const COL_TOP = CHORD_Y - CHORD_H / 2;
  const yTop = (x) => APEX_TOP - Math.abs(x) * TAN;
  const yBot = (x) => yTop(x) - RAF_T / COS;

  const COL = iShape(0.32, 0.20, 0.018, 0.028);
  const CHORD = iShape(CHORD_H, CHORD_W, 0.018, 0.026);
  const RAFT = iShape(RAF_T, RAF_W, 0.017, 0.026);
  const BRACE = iShape(0.15, 0.13, 0.014, 0.020);
  const PURL = zShape(0.16, 0.062, 0.014);
  const EAVE = zShape(0.22, 0.085, 0.018);

  for (const sx of [-1, 1]) {
    const cx = sx * HALF;
    B(0.46, PAD_H, 0.38, CONC, cx, PAD_H / 2, 0);
    hplate(plateShape(0.44, 0.36, 0.06), PLATE_H, STEEL_B, cx, PAD_H + PLATE_H / 2, 0);
    column(COL, COL_TOP + 0.20 - COL_BASE, STEEL_A, cx, COL_BASE, 0);

    for (const fz of [-1, 1]) vplate(plateShape(0.26, 0.16, 0.04), 0.014, STEEL_B, cx, COL_BASE + 0.09, fz * 0.072);
    B(0.37, 0.035, 0.25, RUST, cx, COL_BASE + 0.016, 0);

    // knee-height rubbing guard, 0.32 - 0.62 m
    B(0.375, 0.30, 0.25, GALV, cx, 0.47, 0);
    B(0.385, 0.026, 0.26, GALV_D, cx, 0.335, 0);
    B(0.385, 0.026, 0.26, GALV_D, cx, 0.605, 0);

    for (const fz of [-1, 1]) vplate(plateShape(0.30, 0.34, 0.05), 0.012, STEEL_C, cx, 3.10, fz * 0.017);

    // eaves haunch
    strut(BRACE, STEEL_B, cx, 6.95, sx * 3.40, 7.55, 0);
    for (const fz of [-1, 1]) vplate(plateShape(0.34, 0.28, 0.08), 0.014, STEEL_C, sx * 3.84, 7.40, fz * 0.09);
  }

  vplate(plateShape(0.22, 0.16, 0.03), 0.014, ORANGE, -HALF, 1.62, 0.107);
  vplate(plateShape(0.18, 0.18, 0.04), 0.014, YELLOW, HALF, 1.62, 0.107);

  beam(CHORD, 2 * HALF + 0.06, STEEL_B, -HALF - 0.03, CHORD_Y, 0);
  // Rafters run from the eaves INBOARD to the ridge. beam() always sweeps along
  // its own +X, so the right-hand rafter needs both endpoints given, not a
  // mirrored angle: signing the rotation alone sent it off the far side of the
  // frame and the bay measured 12.3 m wide.
  for (const sx of [-1, 1]) {
    const y0 = APEX_TOP - (HALF + 0.03) * TAN - (RAF_T / 2) / COS;
    strut(RAFT, STEEL_B, sx * (HALF + 0.03), y0, -sx * 0.03, y0 + (HALF + 0.06) * TAN, 0);
  }
  for (const fz of [-1, 1]) {
    vplate(plateShape(0.42, 0.50, 0.10), 0.013, STEEL_C, 0, 8.98, fz * 0.088);
    for (const sx of [-1, 1]) vplate(plateShape(0.44, 0.18, 0.04), 0.012, STEEL_C, sx * 2.0, CHORD_Y, fz * 0.088);
  }
  B(0.16, 0.14, 0.20, RUST, 0, APEX_TOP - 0.08, 0);

  // --- lattice web, angle sections -----------------------------------------
  const NODES = [0, 1.15, 2.30, 3.45];
  const members = [];
  const member = (x1, y1, x2, y2) => {
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    members.push({ p: [(x1 + x2) / 2, (y1 + y2) / 2, 0], r: [0, 0, Math.atan2(dy, dx)], s: [len / 0.10, 1, 1] });
  };
  member(0, CHORD_TOP, 0, yBot(0));
  for (const sx of [-1, 1]) {
    for (let k = 1; k < NODES.length; k++) { const x = sx * NODES[k]; member(x, CHORD_TOP, x, yBot(x)); }
    for (let k = 0; k < NODES.length - 1; k++) {
      const a = sx * NODES[k], b = sx * NODES[k + 1];
      member(a, CHORD_TOP, b, yBot(b));
      if (k > 0) member(a, yBot(a), b, CHORD_TOP);
    }
  }
  const memGeo = sweep(lShape(0.09, 0.016), 0.10);
  memGeo.rotateY(Math.PI / 2);
  memGeo.translate(-0.05, 0, 0);
  instance(memGeo, STEEL_C, members, 0, 8.40, 0);

  // --- purlins --------------------------------------------------------------
  purlin(PURL, 0.40, GALV, 0, 9.42, 0);                        // ridge, top = 9.50
  for (const sx of [-1, 1]) {
    purlin(EAVE, 0.40, GALV, sx * (HALF + SIN * 0.11), yTop(HALF) + COS * 0.11, 0, -sx * TH);
    B(0.24, 0.022, 0.40, GALV_D, sx * (HALF + SIN * 0.215), yTop(HALF) + COS * 0.222, 0, -sx * TH);
  }
  const pl = [], cleats = [];
  for (const sx of [-1, 1]) {
    for (const px of [0.85, 1.70, 2.55, 3.40]) {
      const x = sx * px, yt = yTop(x), rz = -sx * TH;
      pl.push({ p: [x + sx * SIN * 0.08, yt + COS * 0.08, 0], r: [0, 0, rz] });
      for (const z of [0.11, -0.11]) cleats.push({ p: [x, yt - COS * 0.02, z], r: [0, 0, rz] });
    }
  }
  const purlGeo = sweep(PURL, 0.38); purlGeo.translate(0, 0, -0.19);
  instance(purlGeo, GALV, pl, 0, 8.40, 0);
  const cleatGeo = sweep(plateShape(0.13, 0.13, 0.03), 0.010); cleatGeo.translate(0, 0, -0.005);
  instance(cleatGeo, GALV_D, cleats, 0, 8.40, 0);

  // --- fixings --------------------------------------------------------------
  const vb = [];
  for (const sx of [-1, 1]) for (const bx of [-0.155, 0.155]) for (const bz of [-0.13, 0.13]) {
    vb.push({ p: [sx * HALF + bx, COL_BASE + 0.022, bz] });
  }
  instance(new THREE.CylinderGeometry(0.026, 0.026, 0.032, 6), GALV_D, vb, 0, 4.0, 0);

  const zb = [];
  const ring = (cx, cy, rx, ry, n) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.4;
      for (const z of [0.10, -0.10]) zb.push({ p: [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, z], r: [Math.PI / 2, 0, 0] });
    }
  };
  ring(0, 8.98, 0.14, 0.17, 6);
  for (const sx of [-1, 1]) { ring(sx * 2.0, CHORD_Y, 0.15, 0.05, 4); ring(sx * 3.84, 7.40, 0.10, 0.08, 4); }
  for (const sx of [-1, 1]) for (const by of [2.98, 3.22]) for (const bx of [-0.10, 0.10]) for (const z of [0.026, -0.026]) {
    zb.push({ p: [sx * HALF + bx, by, z], r: [Math.PI / 2, 0, 0] });
  }
  instance(new THREE.CylinderGeometry(0.022, 0.022, 0.030, 6), GALV_D, zb, 0, 8.0, 0);

  // --- place ----------------------------------------------------------------
  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= box.min.y; m.position.z -= c.z; });

  return g;
}
