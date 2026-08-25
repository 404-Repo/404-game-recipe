/**
 * ammo_crate — the winner (arm B: profile sweeps).
 *
 * The body is one ExtrudeGeometry of a rectangular RING swept up in Y, so the
 * four walls and the real inner face come out of a single drawn profile instead
 * of four boxes that meet at guessed corners. The corner brackets are extruded
 * L-sections, the latches and hinges are drawn side silhouettes, and the rope
 * handles are a circle swept along a CatmullRom path.
 *
 * bevelEnabled is false everywhere. Nothing is tapered by scaling cap vertices.
 *
 * The lid pivots at the hinge line, the back top edge, not at its own centre.
 * Datum: floor 0.000 | wall top 0.248 | hinge y 0.262 z -0.171 | crown ~0.295
 */
export default function (THREE) {
  const g = new THREE.Group();

  const M = (color, name, roughness = 0.86, metalness = 0.12) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    if (name) m.name = name;
    return m;
  };
  const olive = M(0x3a3d33, 'metal', 0.86, 0.14);
  const oliveB = M(0x41443a, 'metal', 0.84, 0.14);
  const oliveC = M(0x33362d, 'metal', 0.88, 0.14);
  const galv = M(0x8a9093, 'metal', 0.70, 0.50);   // bright fittings, toned off pure galv
  const bracket = M(0x5b6167, 'metal', 0.74, 0.42);  // corner brackets: worn structural steel
  const steel = M(0x5b6167, 'metal', 0.70, 0.40);
  const rust = M(0x6e4128, 'metal', 0.92, 0.20);
  const rope = M(0x9c7a4e, 'fabric', 0.95, 0.0);
  const plate = M(0xc9c6bd, 'metal', 0.80, 0.10);
  const hazard = M(0xbe5220, 'metal', 0.84, 0.10);

  const B = (w, h, d, x, y, z, mat, parent = g) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); parent.add(m); return m;
  };
  const J = (x, y, z, parent = g) => {
    const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o;
  };
  const shapeOf = (pts) => {
    const s = new THREE.Shape();
    s.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
    s.closePath();
    return s;
  };
  /** extrude a PLAN outline drawn in (x, z) upward in Y by `h`, base at y */
  const PLAN = (outer, holes, h, mat, y, parent = g) => {
    const s = shapeOf(outer);
    for (const hole of holes || []) {
      const p = new THREE.Path();
      p.moveTo(hole[0][0], hole[0][1]);
      for (let i = 1; i < hole.length; i++) p.lineTo(hole[i][0], hole[i][1]);
      p.closePath();
      s.holes.push(p);
    }
    const geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);        // shape +Y -> world -Z, extrude depth -> world +Y
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    parent.add(m); return m;
  };
  /** extrude a SIDE outline drawn in (z, y) across X by `w`, centred on x */
  const SIDE = (pts, w, mat, x, parent = g) => {
    const geo = new THREE.ExtrudeGeometry(shapeOf(pts), { depth: w, bevelEnabled: false });
    geo.translate(0, 0, -w / 2);
    geo.rotateY(-Math.PI / 2);        // shape +X -> world +Z, depth -> world X
    const m = new THREE.Mesh(geo, mat);
    m.position.x = x;
    parent.add(m); return m;
  };

  const HW = 0.274, HD = 0.159, TOP = 0.248, T = 0.014;

  // ---- body: one swept ring, so the inner face is real ---------------------
  const rect = (hw, hd) => [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
  PLAN(rect(HW, HD), [rect(HW - T, HD - T)], TOP, olive, 0.000);
  PLAN(rect(HW - T + 0.001, HD - T + 0.001), null, 0.016, oliveC, 0.000);       // floor
  PLAN(rect(HW + 0.004, HD + 0.004), [rect(HW - 0.020, HD - 0.020)], 0.014, oliveB, TOP);
  for (const z of [-HD + 0.030, HD - 0.030]) B(2 * HW - 0.020, 0.010, 0.024, 0, 0.005, z, oliveC);

  // ---- rubbing strip, a swept band round the middle ------------------------
  PLAN(rect(HW + 0.002, HD + 0.002), [rect(HW - 0.006, HD - 0.006)], 0.022, oliveC, 0.107);
  B(2 * HW - 0.040, 0.010, 0.006, 0, 0.092, HD + 0.001, rust);

  // ---- corner brackets, drawn as L-sections in plan ------------------------
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    // the L wraps the corner and runs INWARD along both faces
    const L = [
      [sx * (HW + 0.001), sz * (HD + 0.001)], [sx * (HW + 0.001), sz * (HD - 0.052)],
      [sx * (HW - 0.010), sz * (HD - 0.052)], [sx * (HW - 0.010), sz * (HD - 0.010)],
      [sx * (HW - 0.052), sz * (HD - 0.010)], [sx * (HW - 0.052), sz * (HD + 0.001)],
    ];
    for (const yy of [0.002, TOP - 0.062]) {
      const geo = new THREE.ExtrudeGeometry(shapeOf(L), { depth: 0.060, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, bracket);
      m.position.y = yy;
      g.add(m);
    }
  }

  // ---- rivets: a circle swept as a run of small cylinders ------------------
  const rivet = new THREE.CylinderGeometry(0.0055, 0.0055, 0.006, 6);
  const im = new THREE.InstancedMesh(rivet, galv, 52);
  {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
    const xf = [];
    for (let i = 0; i < 9; i++) {
      const x = -0.232 + i * 0.058;
      for (const sz of [1, -1]) for (const yy of [0.028, TOP - 0.020]) {
        xf.push([x, yy, sz * (HD + 0.005), Math.PI / 2, 0, 0]);
      }
    }
    for (let i = 0; i < 4; i++) {
      const z = -0.108 + i * 0.072;
      for (const sx of [1, -1]) for (const yy of [0.028, TOP - 0.020]) {
        xf.push([sx * (HW + 0.005), yy, z, 0, 0, Math.PI / 2]);
      }
    }
    im.count = xf.length;
    xf.forEach((t, i) => {
      q.setFromEuler(new THREE.Euler(t[3], t[4], t[5]));
      m4.compose(new THREE.Vector3(t[0], t[1], t[2]), q, sc);
      im.setMatrixAt(i, m4);
    });
    im.instanceMatrix.needsUpdate = true;
    g.add(im);
  }

  // ---- rope handles: a circle swept along a path, which is what a rope is --
  for (const sx of [1, -1]) {
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx * (HW + 0.006), 0.150, -0.033),
      new THREE.Vector3(sx * (HW + 0.016), 0.156, -0.024),
      new THREE.Vector3(sx * (HW + 0.021), 0.158, 0.000),
      new THREE.Vector3(sx * (HW + 0.016), 0.156, 0.024),
      new THREE.Vector3(sx * (HW + 0.006), 0.150, 0.033),
    ]);
    const circle = new THREE.Shape();
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x = Math.cos(a) * 0.0085, y = Math.sin(a) * 0.0085;
      i === 0 ? circle.moveTo(x, y) : circle.lineTo(x, y);
    }
    const geo = new THREE.ExtrudeGeometry(circle, {
      steps: 14, bevelEnabled: false, extrudePath: path });
    g.add(new THREE.Mesh(geo, rope));
    for (const z of [-0.033, 0.033]) {
      B(0.026, 0.020, 0.016, sx * (HW + 0.006), 0.150, z, steel);
      B(0.014, 0.010, 0.010, sx * (HW + 0.014), 0.150, z, galv);
    }
  }

  // ---- latches, drawn as side silhouettes ---------------------------------
  for (const x of [-0.118, 0.118]) {
    SIDE([[HD + 0.001, TOP - 0.046], [HD + 0.013, TOP - 0.046], [HD + 0.013, TOP + 0.006],
          [HD + 0.001, TOP + 0.006]], 0.044, galv, x);
    SIDE([[HD + 0.013, TOP - 0.048], [HD + 0.023, TOP - 0.044], [HD + 0.021, TOP - 0.012],
          [HD + 0.013, TOP - 0.012]], 0.030, steel, x);
    B(0.034, 0.008, 0.008, x, TOP - 0.046, HD + 0.019, galv);
    B(0.008, 0.014, 0.008, x + 0.020, TOP - 0.030, HD + 0.016, galv);
  }

  // ---- lid, pivoted at the hinge line -------------------------------------
  const lid = J(0, TOP + 0.014, -HD - 0.012);
  // panel drawn in plan, with a raised frame ring on top of it
  PLAN(rect(HW + 0.005, HD + 0.012), null, 0.014, oliveB, 0.000, lid).position.z = HD + 0.012;
  PLAN(rect(HW + 0.009, HD + 0.016), [rect(HW - 0.010, HD - 0.004)], 0.012, olive, 0.014, lid)
    .position.z = HD + 0.012;
  for (const z of [HD - 0.048, HD + 0.012, HD + 0.072]) {
    B(2 * HW - 0.030, 0.010, 0.014, 0, 0.019, z, oliveC, lid);
  }
  for (const sx of [1, -1]) for (const dz of [0.016, 2 * HD + 0.008]) {
    B(0.046, 0.012, 0.038, sx * (HW - 0.014), 0.023, dz, bracket, lid);
  }
  B(0.200, 0.008, 0.096, 0.040, 0.021, HD + 0.028, plate, lid);
  B(0.062, 0.008, 0.062, -0.176, 0.021, HD + 0.028, hazard, lid);
  for (const x of [-0.150, 0.150]) {
    B(0.070, 0.010, 0.048, x, 0.012, 0.026, galv, lid);
    B(0.070, 0.010, 0.046, x, TOP + 0.006, -HD + 0.010, galv);
    const knuckle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.076, 8), steel);
    knuckle.rotation.z = Math.PI / 2;
    knuckle.position.set(x, 0.004, 0.004);
    lid.add(knuckle);
  }

  g.userData.lid = lid;
  g.userData.lidOpenAxis = 'rotate lid.rotation.x NEGATIVE to lift the front';

  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= box.min.y; m.position.z -= c.z; });
  return g;
}
