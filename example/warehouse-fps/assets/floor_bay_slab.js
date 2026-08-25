// floor_bay_slab — arm C: a different reading of the same reference.
// One monolithic power-floated bay whose TOP is a real surface rather than a
// face: a hand-built grid that falls toward the gully, carries two wheel-worn
// ruts, is sawn through by two joint grooves with real walls and a real floor,
// and has the gully cut out of it as a hole with a sump under the grate.
//
// Every marking - the joints, the worn lane, the wheel ruts, the aisle stripe,
// the mottling - is a bucket of CELLS of that same grid rather than a decal laid
// on top, so nothing floats when the surface undulates beneath it. The grid is
// shared: seven meshes, one set of vertices.
//
// This is the whole floor of the game and the floor is most of the screen, so
// the cost goes into the top and almost nothing into the underside.
export default function (THREE) {
  const g = new THREE.Group();

  const mat = (color, name, r, m, dbl) => {
    const s = new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m });
    if (dbl) s.side = THREE.DoubleSide;
    if (name) s.name = name;
    return s;
  };
  const GROUND  = mat(0x77746d, 'ground', 0.93, 0.02);   // concrete pale
  const MOTT_A  = mat(0x7a7770, 'ground', 0.91, 0.02);   // 3% lighter float marks
  const MOTT_B  = mat(0x726f69, 'ground', 0.95, 0.02);   // 4% darker patches
  const LANE    = mat(0x4e4c47, 'ground', 0.90, 0.03);   // wheel-tracked area
  const RUT     = mat(0x474540, 'ground', 0.88, 0.03);   // the tracks themselves
  const STRIPE  = mat(0xd6a41f, 'ground', 0.88, 0.03);   // safety yellow paint
  const JOINT   = mat(0x4a4843, 'stone', 0.94, 0.02);    // sawn cut faces
  const EDGE    = mat(0x6b685f, 'stone', 0.95, 0.02);    // the arris all round
  const SUB     = mat(0x5a5852, 'stone', 0.96, 0.02);    // sub-base
  const SPALL   = mat(0x67645e, 'stone', 0.95, 0.02);
  const RUST    = mat(0x6e4128, 'metal', 0.93, 0.08, true);
  const GUN     = mat(0x3a3d40, 'metal', 0.72, 0.40);

  const B = (w, h, d, m, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
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
    g.add(im);
    return im;
  };

  const T = 0.12, BASE = 0.062;
  const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

  // Stations are regular across the bay and tight where something has to line up
  // with them: the two sawn joints, the gully, the wheel ruts and the stripe.
  const S = [-4, -3.55, -3.1, -2.65, -2.2, -1.75, -1.3, -0.85, -0.4, -0.26,
             -0.075, -0.045, 0.045, 0.075, 0.26, 0.4, 0.85, 1.3, 1.75, 2.2,
             2.54, 2.66, 3.1, 3.55, 4];
  const n = S.length;

  const height = (x, z) => {
    let y = T;
    y -= 0.010 * Math.max(0, 1 - Math.hypot(x, z) / 3.0);            // fall to the gully
    if (Math.abs(x) <= 0.045 || Math.abs(z) <= 0.045) y -= 0.014;    // sawn joint
    for (const rx of [-1.075, 1.075]) y -= 0.0045 * Math.exp(-Math.pow((x - rx) / 0.30, 2));
    if (Math.abs(z - 2.60) < 0.07) y += 0.0015;                      // built-up paint
    const fade = Math.min(1, (4 - Math.abs(x)) / 0.5) * Math.min(1, (4 - Math.abs(z)) / 0.5);
    y -= 0.0030 * hash(x, z) * fade;
    return y;
  };

  // --- the wearing surface, one grid in seven colours -----------------------
  {
    const pos = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) pos.push(S[i], height(S[i], S[j]), S[j]);
    const attr = new THREE.Float32BufferAttribute(pos, 3);

    const buckets = { ground: [], mottA: [], mottB: [], lane: [], rut: [], stripe: [], joint: [] };
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < n - 1; j++) {
        const cx = (S[i] + S[i + 1]) / 2, cz = (S[j] + S[j + 1]) / 2;
        if (Math.max(Math.abs(cx), Math.abs(cz)) < 0.20) continue;      // the gully hole
        let key;
        if (Math.abs(cx) <= 0.062 || Math.abs(cz) <= 0.062) key = 'joint';
        else if (Math.abs(cz - 2.60) < 0.07) key = 'stripe';
        else if (Math.abs(Math.abs(cx) - 1.075) < 0.03) key = 'rut';
        else if (cz > -0.26 && cz < 2.54) key = 'lane';
        else {
          const h = hash(i * 3.7, j * 5.3);
          key = h < 0.09 ? 'mottB' : h > 0.90 ? 'mottA' : 'ground';
        }
        const a = i * n + j, b = a + 1, c = a + n, d = c + 1;
        buckets[key].push(a, b, c, b, d, c);
      }
    }
    const skins = { ground: GROUND, mottA: MOTT_A, mottB: MOTT_B, lane: LANE,
                    rut: RUT, stripe: STRIPE, joint: JOINT };
    for (const k of Object.keys(buckets)) {
      if (!buckets[k].length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', attr);
      geo.setIndex(buckets[k]);
      geo.computeVertexNormals();
      g.add(new THREE.Mesh(geo, skins[k]));
    }
  }

  // --- the arris: a skirt that follows the undulating top edge down ---------
  {
    const pos = [], idx = [];
    let k = 0;
    const strip = (px, pz) => {
      const start = k;
      for (let i = 0; i < n; i++) {
        const x = px === null ? S[i] : px;
        const z = pz === null ? S[i] : pz;
        pos.push(x, height(x, z), z, x, BASE - 0.004, z);
        k += 2;
      }
      for (let i = 0; i < n - 1; i++) {
        const a = start + i * 2, b = a + 1, c = a + 2, d = a + 3;
        idx.push(a, b, c, b, d, c);
      }
    };
    strip(null, -4); strip(null, 4); strip(-4, null); strip(4, null);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, EDGE);
    m.material.side = THREE.DoubleSide;
    g.add(m);
  }
  B(8.0, BASE, 8.0, SUB, 0, BASE / 2, 0);

  // --- the gully: a real hole with a sump under the grate ------------------
  B(0.52, 0.010, 0.52, GUN, 0, BASE + 0.005, 0);                       // sump floor
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.310, 0.310, 0.046, 16, 1, true), RUST);
  rim.position.y = BASE + 0.023;
  g.add(rim);
  const frame = new THREE.Mesh(new THREE.RingGeometry(0.216, 0.310, 16), RUST);
  frame.rotation.x = -Math.PI / 2;
  frame.position.y = BASE + 0.046;
  g.add(frame);
  const bars = [];
  for (let i = 0; i < 9; i++) bars.push({ p: [0, BASE + 0.040, -0.176 + i * 0.044] });
  instance(new THREE.BoxGeometry(0.40, 0.014, 0.018), RUST, bars, 0, 0.06, 0);

  // --- shrinkage cracks, cut through the surface ---------------------------
  const cracks = [
    [-3.20, -1.10, 1.70, 0.5], [2.20, 0.90, 2.10, -0.35], [-1.90, 2.95, 1.20, 0.9],
    [3.05, -2.60, 1.40, 1.25], [0.55, 3.40, 0.95, -0.7],
  ];
  for (const [x, z, len, a] of cracks) B(len, 0.010, 0.022, JOINT, x, T - 0.006, z).rotation.y = a;

  // --- spalled corners ------------------------------------------------------
  const chips = [];
  for (let i = 0; i < 18; i++) {
    const t = ((i * 0.7137) % 1) * 7.2 - 3.6;
    const side = i % 4;
    const p = side === 0 ? [t, -3.97] : side === 1 ? [t, 3.97] : side === 2 ? [-3.97, t] : [3.97, t];
    chips.push({ p: [p[0], T - 0.028 - (i % 3) * 0.010, p[1]], r: [0, (i * 1.31) % 1, 0] });
  }
  instance(new THREE.BoxGeometry(0.28, 0.036, 0.085), SPALL, chips, 0, 0.06, 0);

  // --- place ---------------------------------------------------------------
  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n2) => { const p = n2.isMesh && n2.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n2.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= box.min.y; m.position.z -= c.z; });

  return g;
}
