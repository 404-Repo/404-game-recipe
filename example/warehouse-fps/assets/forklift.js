// forklift — arm B: built from swept profiles. The mast rails, the guard posts and
// the forks are real sections (C channel, square tube, fork L) drawn as Shapes and
// extruded; the body is separate un-tapered masses, never a scaled extrusion.
// Front = +Z. 1.15 x 2.40 x 2.10.
export default function (THREE) {
  const g = new THREE.Group();
  const DS = THREE.DoubleSide;

  const mk = (color, name, rough, metal, opts) => {
    const m = new THREE.MeshStandardMaterial(Object.assign(
      { color, roughness: rough === undefined ? 0.82 : rough, metalness: metal === undefined ? 0.12 : metal }, opts || {}));
    if (name) m.name = name;
    return m;
  };
  const YEL   = mk(0xd6a41f, 'metal', 0.80, 0.12, { side: DS });
  const YEL2  = mk(0xc79a20, 'metal', 0.86, 0.10, { side: DS });
  const YEL3  = mk(0xcaa62c, 'metal', 0.74, 0.16, { side: DS });
  const STEEL = mk(0x5b6167, 'metal', 0.78, 0.22, { side: DS });
  const GALV  = mk(0x9aa0a3, 'metal', 0.62, 0.55, { side: DS });
  const GUN   = mk(0x3a3d40, 'metal', 0.70, 0.32, { side: DS });
  const DARK  = mk(0x2a2c2e, 'metal', 0.80, 0.18);
  const RUST  = mk(0x6e4128, 'metal', 0.92, 0.08);
  const ORNG  = mk(0xbe5220, 'metal', 0.84, 0.10);
  const RUB   = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.93, metalness: 0.02 });
  const VIN   = new THREE.MeshStandardMaterial({ color: 0x212325, roughness: 0.88, metalness: 0.03 });
  const LENS  = new THREE.MeshStandardMaterial({ color: 0x7a2a22, roughness: 0.55, metalness: 0.05,
                  emissive: new THREE.Color(0xd8342a), emissiveIntensity: 0.7 });
  const LAMP  = new THREE.MeshStandardMaterial({ color: 0xa8905f, roughness: 0.55, metalness: 0.10,
                  emissive: new THREE.Color(0xffb45a), emissiveIntensity: 0.6 });

  const add = (geo, mat, x, y, z, rx, ry, rz) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0);
    g.add(m);
    return m;
  };
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const CYL = (r1, r2, h, s, open) => new THREE.CylinderGeometry(r1, r2, h, s, 1, !!open);
  const poly = (pts, holes) => {
    const s = new THREE.Shape();
    s.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
    s.closePath();
    if (holes) for (const h of holes) {
      const p = new THREE.Path();
      p.moveTo(h[0][0], h[0][1]);
      for (let i = 1; i < h.length; i++) p.lineTo(h[i][0], h[i][1]);
      p.closePath();
      s.holes.push(p);
    }
    return s;
  };
  // bevelEnabled: false, always. A bevel grows the profile outward and hangs it
  // below its own base. Centred on the sweep so placement means the middle.
  const ex = (shape, depth) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 4, steps: 1 });
    geo.translate(0, 0, -depth / 2);
    return geo;
  };

  const boltGeo = new THREE.CylinderGeometry(0.019, 0.023, 0.016, 8);
  function bolts(list, rx, ry, rz, mat) {
    // parked deep inside the body: the bbox pass measures an instanced mesh's
    // prototype at the mesh transform, and on its own centroid a wheel-nut set
    // pushed the measured width out by 40mm.
    const im = new THREE.InstancedMesh(boltGeo, mat || GALV, list.length);
    const cx = 0, cy = 0.65, cz = -0.50;
    im.position.set(cx, cy, cz);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(),
          s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    q.setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0));
    list.forEach((v, i) => { p.set(v[0] - cx, v[1] - cy, v[2] - cz); im.setMatrixAt(i, m4.compose(p, q, s)); });
    im.instanceMatrix.needsUpdate = true;
    g.add(im);
    return im;
  }

  // ---- sections -------------------------------------------------------------
  // A vertical member is drawn in (u,v) and rotated -PI/2 about X so the sweep
  // runs up +Y; profile +u -> world +X, profile +v -> world -Z.
  const chan = (fw, dep, t) => poly([[0, 0], [fw, 0], [fw, t], [t, t], [t, dep - t], [fw, dep - t], [fw, dep], [0, dep]]);
  const tube = (w, d, t) => poly([[0, 0], [w, 0], [w, d], [0, d]], [[[t, t], [w - t, t], [w - t, d - t], [t, d - t]]]);
  const vert = (geo, mat, x, y, z) => add(geo, mat, x, y, z, -Math.PI / 2, 0, 0);

  // ---- chassis, hood, counterweight (separate masses) ------------------------
  add(B(0.98, 0.36, 1.30), YEL, 0, 0.46, -0.40);
  add(B(1.02, 0.09, 1.22), STEEL, 0, 0.24, -0.42);
  add(B(0.92, 0.32, 0.58), YEL2, 0, 0.80, -0.50);
  add(B(0.88, 0.05, 0.52), YEL3, 0, 0.965, -0.50);
  add(B(0.96, 0.28, 0.05), YEL2, 0, 0.78, -0.22);
  for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) add(B(0.02, 0.15, 0.05), DARK, sx * 0.462, 0.80, -0.70 + i * 0.09);
  // scuff band, 0.40..0.52
  add(B(1.02, 0.12, 1.32), DARK, 0, 0.46, -0.40);
  add(B(1.04, 0.035, 1.34), RUST, 0, 0.415, -0.40);
  // counterweight as its own mass, plus a stepped cap
  add(B(1.08, 0.56, 0.50), YEL, 0, 0.66, -0.91);
  add(B(0.98, 0.16, 0.44), YEL3, 0, 0.99, -0.91);
  for (let i = 0; i < 5; i++) add(B(0.035, 0.36, 0.025), YEL3, -0.40 + i * 0.20, 0.62, -1.172); // cast ribs
  add(B(0.26, 0.16, 0.012), GALV, -0.30, 0.86, -1.172);   // stencilled rating plate
  add(B(0.44, 0.09, 0.025), YEL3, 0.24, 0.86, -1.172);
  add(B(0.24, 0.12, 0.12), GUN, 0, 0.42, -1.14);
  for (let i = 0; i < 4; i++) add(B(0.085, 0.34, 0.014), DARK, -0.33 + i * 0.22, 0.60, -1.186, 0, 0, 0.55);
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++)
    add(B(0.014, 0.28, 0.075), DARK, sx * 0.544, 0.50, -0.72 - i * 0.15, sx * 0.5, 0, 0);
  for (const sx of [-1, 1]) {
    add(B(0.10, 0.12, 0.03), GUN, sx * 0.40, 0.88, -1.175);
    add(B(0.07, 0.085, 0.02), LENS, sx * 0.40, 0.88, -1.192);
  }

  // ---- wheels ---------------------------------------------------------------
  function wheel(x, y, z, R, W) {
    add(CYL(R, R, W, 16), RUB, x, y, z, 0, 0, Math.PI / 2);
    add(CYL(R * 0.46, R * 0.46, W * 1.00, 12), GALV, x, y, z, 0, 0, Math.PI / 2);
    add(CYL(R * 0.18, R * 0.18, W * 1.00, 8), GUN, x, y, z, 0, 0, Math.PI / 2);
    const nuts = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      nuts.push([x + Math.sign(x) * W * 0.58, y + Math.cos(a) * R * 0.28, z + Math.sin(a) * R * 0.28]);
    }
    bolts(nuts, 0, 0, Math.PI / 2, GUN);
    const tg = new THREE.BoxGeometry(W * 1.01, 0.05, R * 0.40);
    const im = new THREE.InstancedMesh(tg, RUB, 14);
    im.position.set(x, y, z);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      q.setFromEuler(new THREE.Euler(a, 0, 0));
      p.set(0, Math.cos(a) * (R - 0.026), Math.sin(a) * (R - 0.026));
      im.setMatrixAt(i, m4.compose(p, q, s));
    }
    im.instanceMatrix.needsUpdate = true;
    g.add(im);
  }
  wheel(0.470, 0.30, -0.06, 0.30, 0.21);
  wheel(-0.470, 0.30, -0.06, 0.30, 0.21);
  wheel(0.330, 0.23, -0.92, 0.23, 0.15);
  wheel(-0.330, 0.23, -0.92, 0.23, 0.15);
  add(CYL(0.09, 0.09, 0.78, 12), GUN, 0, 0.30, -0.06, 0, 0, Math.PI / 2);
  add(CYL(0.07, 0.07, 0.54, 10), GUN, 0, 0.23, -0.92, 0, 0, Math.PI / 2);
  for (const sx of [-1, 1]) add(B(0.22, 0.05, 0.64), YEL2, sx * 0.46, 0.605, -0.06);

  // ---- step + grab rail ------------------------------------------------------
  for (const sx of [-1, 1]) {
    add(B(0.18, 0.035, 0.32), GALV, sx * 0.484, 0.34, -0.46);
    add(B(0.05, 0.14, 0.06), STEEL, sx * 0.47, 0.42, -0.46);
    add(B(0.045, 0.44, 0.045), STEEL, sx * 0.50, 0.62, -0.28);
    add(B(0.045, 0.045, 0.18), STEEL, sx * 0.50, 0.83, -0.28);
  }

  // ---- seat, dash, column ----------------------------------------------------
  add(B(0.58, 0.12, 0.54), GUN, 0, 1.00, -0.60);
  add(B(0.50, 0.13, 0.46), VIN, 0, 1.09, -0.60);
  add(B(0.48, 0.46, 0.12), VIN, 0, 1.32, -0.85, -0.17, 0, 0);
  add(B(0.52, 0.05, 0.07), GUN, 0, 1.55, -0.91);
  add(B(0.76, 0.30, 0.24), YEL2, 0, 1.03, 0.00);
  add(B(0.72, 0.06, 0.22), GUN, 0, 1.19, 0.00);
  add(B(0.20, 0.12, 0.012), GALV, -0.20, 1.11, 0.11);
  add(B(0.14, 0.09, 0.012), ORNG, 0.20, 1.11, 0.11);
  for (let i = 0; i < 3; i++) {
    add(CYL(0.012, 0.012, 0.32, 6), GUN, -0.26 + i * 0.10, 1.32, -0.11, -0.20, 0, 0);
    add(CYL(0.022, 0.022, 0.05, 6), RUB, -0.26 + i * 0.10, 1.48, -0.145);
  }
  add(CYL(0.036, 0.042, 0.34, 10), GUN, 0, 1.07, -0.07, -0.49, 0, 0);
  add(new THREE.TorusGeometry(0.135, 0.017, 6, 14), RUB, 0, 1.23, -0.155, -1.08, 0, 0);
  add(CYL(0.05, 0.05, 0.035, 10), GUN, 0, 1.23, -0.155, -1.08, 0, 0);
  for (let i = 0; i < 3; i++) add(B(0.022, 0.12, 0.012), GUN, 0, 1.23, -0.155, -1.08, 0, (i / 3) * Math.PI * 2);

  // ---- overhead guard: square tube posts, swept -------------------------------
  const postGeo = ex(tube(0.065, 0.065, 0.012), 1.12);
  const legGeo = ex(tube(0.065, 0.065, 0.012), 1.34);
  const POST = [[0.475, 0.10], [-0.475, 0.10], [0.475, -0.84], [-0.475, -0.84]];
  for (const [px, pz] of POST) {
    const front = pz > 0;
    vert(front ? legGeo : postGeo, YEL, px - 0.0325, front ? 1.38 : 1.49, pz + 0.0325);
    add(B(0.11, 0.035, 0.11), GALV, px, front ? 0.72 : 0.94, pz);
  }
  // cross rails: profile u -> -Z, v -> +Y, sweep -> X
  const railGeo = ex(tube(0.07, 0.06, 0.012), 1.06);
  add(railGeo, STEEL, 0, 2.00, 0.135, 0, Math.PI / 2, 0);
  add(railGeo, STEEL, 0, 2.00, -0.805, 0, Math.PI / 2, 0);
  // side rails: no rotation at all, sweep runs along +Z
  const sideRail = ex(tube(0.07, 0.06, 0.012), 0.94);
  for (const sx of [-1, 1]) add(sideRail, STEEL, sx * 0.475 - 0.035, 2.00, -0.37);
  const slat = ex(poly([[0, 0], [0.98, 0], [0.98, 0.03], [0, 0.03]]), 0.05);
  for (let i = 0; i < 7; i++) add(slat, STEEL, -0.49, 2.06, -0.74 + i * 0.145);
  for (let i = 0; i < 2; i++) add(B(0.05, 0.028, 0.94), GALV, -0.24 + i * 0.48, 2.083, -0.37);

  // ---- cab furniture ---------------------------------------------------------
  add(CYL(0.035, 0.035, 0.46, 10), GUN, 0.36, 1.19, -0.24);            // exhaust stack
  add(CYL(0.045, 0.045, 0.05, 10), RUST, 0.36, 1.44, -0.24);
  add(CYL(0.03, 0.03, 0.05, 8), GALV, 0.36, 0.99, -0.24);
  add(CYL(0.045, 0.045, 0.04, 10), GALV, -0.30, 0.99, -0.62);          // fuel filler
  add(B(0.05, 0.05, 0.03), GUN, -0.44, 1.72, -0.02);                   // mirror arm
  add(B(0.13, 0.09, 0.02), GUN, -0.47, 1.72, 0.02, 0, 0.4, 0);         // mirror head
  add(B(0.12, 0.08, 0.05), GUN, 0.30, 1.94, 0.11);                     // work lamp body
  add(CYL(0.036, 0.036, 0.02, 10), LAMP, 0.30, 1.92, 0.135, Math.PI / 2, 0, 0);
  add(CYL(0.045, 0.045, 0.26, 10), ORNG, -0.44, 1.24, -0.66);          // extinguisher
  add(CYL(0.02, 0.02, 0.05, 8), GUN, -0.44, 1.39, -0.66);
  for (let i = 0; i < 2; i++) add(B(0.055, 0.02, 0.05), GALV, -0.44, 1.16 + i * 0.14, -0.66);
  add(B(0.05, 0.30, 0.014), DARK, 0.24, 1.15, -0.62, 0, 0, -0.35);     // seat belt
  add(B(0.05, 0.30, 0.014), DARK, -0.24, 1.15, -0.62, 0, 0, 0.35);

  // ---- mast: swept C channels ------------------------------------------------
  // Both rails are true rotations, never a mirror: rot(-90,0,180) sends the
  // profile's +u to -X, so the channel opens inward on the right-hand rail too.
  const outer = ex(chan(0.075, 0.19, 0.030), 1.94);
  const inner = ex(chan(0.062, 0.15, 0.026), 1.66);
  add(outer, YEL, -0.3375, 1.13, 0.245, -Math.PI / 2, 0, 0);
  add(outer, YEL, 0.3375, 1.13, 0.055, -Math.PI / 2, 0, Math.PI);
  add(inner, STEEL, -0.253, 1.03, 0.225, -Math.PI / 2, 0, 0);
  add(inner, STEEL, 0.253, 1.03, 0.075, -Math.PI / 2, 0, Math.PI);
  add(B(0.72, 0.09, 0.08), YEL3, 0, 2.055, 0.150);
  add(B(0.72, 0.08, 0.08), YEL2, 0, 1.22, 0.150);
  add(B(0.68, 0.11, 0.10), STEEL, 0, 0.25, 0.150);
  add(B(0.52, 0.06, 0.06), GALV, 0, 1.82, 0.150);
  add(CYL(0.075, 0.075, 0.05, 12), GALV, 0, 1.85, 0.150, 0, 0, Math.PI / 2);
  for (const sx of [-1, 1]) {
    add(B(0.022, 1.32, 0.022), GUN, sx * 0.10, 1.20, 0.085);
    add(B(0.022, 1.06, 0.022), GUN, sx * 0.10, 1.05, 0.215);
  }
  add(CYL(0.055, 0.055, 0.94, 12), GUN, 0, 0.72, 0.150);
  add(CYL(0.030, 0.030, 0.62, 10), GALV, 0, 1.44, 0.150);
  for (const sx of [-1, 1]) add(CYL(0.014, 0.014, 1.35, 6), RUB, sx * 0.145, 0.92, 0.048);
  for (const sx of [-1, 1]) {
    add(CYL(0.048, 0.048, 0.40, 10), GUN, sx * 0.38, 0.58, -0.14, 1.16, 0, 0);
    add(CYL(0.028, 0.028, 0.22, 8), GALV, sx * 0.38, 0.71, 0.05, 1.16, 0, 0);
    add(CYL(0.05, 0.05, 0.10, 10), GALV, sx * 0.30, 0.25, 0.05, 0, 0, Math.PI / 2);
  }

  // ---- carriage, backrest, forks (fork = swept L profile) ---------------------
  add(B(0.70, 0.32, 0.030), STEEL, 0, 0.37, 0.245);
  for (const sx of [-1, 1]) for (const cy of [0.24, 0.50]) add(CYL(0.036, 0.036, 0.05, 8), GUN, sx * 0.27, cy, 0.19, 0, 0, Math.PI / 2);
  add(B(0.74, 0.055, 0.055), GALV, 0, 0.52, 0.252);
  add(B(0.74, 0.045, 0.045), GALV, 0, 0.21, 0.252);
  add(B(0.72, 0.05, 0.05), YEL, 0, 1.20, 0.245);
  add(B(0.72, 0.05, 0.05), YEL2, 0, 0.88, 0.245);
  for (const sx of [-1, 1]) add(B(0.05, 0.70, 0.045), YEL, sx * 0.335, 0.88, 0.245);
  for (let i = 0; i < 3; i++) add(B(0.045, 0.68, 0.04), YEL2, -0.16 + i * 0.16, 0.88, 0.245);
  add(B(0.16, 0.10, 0.010), GALV, 0.22, 1.07, 0.272);
  // fork side elevation: heel up the carriage, blade forward, tapered nose
  const forkShape = poly([
    [0.00, 0.00], [0.94, 0.005], [0.94, 0.026], [0.10, 0.052], [0.10, 0.56],
    [0.00, 0.56],
  ]);
  const forkGeo = ex(forkShape, 0.125);
  for (const sx of [-1, 1]) {
    add(forkGeo, GUN, sx * 0.215, 0.018, 0.255, 0, -Math.PI / 2, 0);
    add(B(0.145, 0.06, 0.09), STEEL, sx * 0.215, 0.545, 0.285);
    add(B(0.145, 0.05, 0.08), STEEL, sx * 0.215, 0.225, 0.285);
  }

  // ---- fixings ---------------------------------------------------------------
  const bz = [];
  for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) bz.push([sx * 0.30, 0.32 + i * 0.33, 0.248]);
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) bz.push([sx * 0.245, 0.88 + i * 0.16, 0.272]);
  bolts(bz, Math.PI / 2, 0, 0);
  const br = [];
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) br.push([sx * 0.45, 0.42 + i * 0.20, -1.182]);
  br.push([0, 0.96, -1.182], [0.24, 0.96, -1.182], [-0.24, 0.96, -1.182]);
  bolts(br, Math.PI / 2, 0, 0, GUN);
  const bs = [];
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 4; i++) bs.push([sx * 0.491, 0.60, -0.10 - i * 0.22]);
    for (const [px, pz] of POST) if (Math.sign(px) === sx) for (let i = 0; i < 2; i++) bs.push([px + sx * 0.056, 0.94, pz - 0.035 + i * 0.07]);
  }
  bolts(bs, 0, 0, Math.PI / 2);

  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= box.min.y; m.position.z -= c.z; });
  return g;
}
