/**
 * carton_pallet_load — arm A: assembled from primitives.
 *
 * 1200 x 800 x 1500. Three tiers of six plain corrugated cartons on a weathered
 * pallet, boxes knocked 1-3 cm out of line, one crushed in on the front face,
 * one lid left flapping. The stretch film is a lofted skin drawn in at every
 * tier joint: transparent 0.35 and DELIBERATELY UNNAMED so surfaces.js skips it.
 */
export default function (THREE) {
  const g = new THREE.Group();

  const mat = (color, name, o) => {
    const m = new THREE.MeshStandardMaterial(Object.assign(
      { color, roughness: 0.88, metalness: 0.0 }, o || {}));
    if (name) m.name = name;
    return m;
  };
  const C1 = mat(0xa8794a, 'fabric', { roughness: 0.90 });
  const C2 = mat(0x9f7145, 'fabric', { roughness: 0.92 });
  const C3 = mat(0xb0804f, 'fabric', { roughness: 0.88 });
  const C4 = mat(0x966a41, 'fabric', { roughness: 0.93 });
  const TAPE = mat(0x6e4128, 'fabric', { roughness: 0.78 });
  const LABEL = mat(0xc9c6bd, 'fabric', { roughness: 0.86 });
  const GRIME = mat(0x6e4128, 'fabric', { roughness: 0.95 });
  const WD1 = mat(0x7a5f3d, 'timber', { roughness: 0.92 });
  const WD2 = mat(0x6e5637, 'timber', { roughness: 0.94 });
  const WD3 = mat(0x87683f, 'timber', { roughness: 0.90 });
  // Stretch film. Unnamed on purpose: transparent materials are skipped by the
  // surface system, and a film with a 'fabric' recipe stamped on it goes opaque.
  const FILM = new THREE.MeshStandardMaterial({
    color: 0xc9c6bd, roughness: 0.42, metalness: 0.0,
    transparent: true, opacity: 0.35, side: THREE.DoubleSide,
  });

  const B = (w, h, d, m, x, y, z, ry) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z); if (ry) o.rotation.y = ry; g.add(o); return o;
  };
  let seed = 20250824;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const jit = (a) => (rnd() * 2 - 1) * a;

  // ---- a simplified, well-used pallet -------------------------------------
  const T = 0.022, BH = 0.078;
  for (const z of [-0.350, 0, 0.350]) B(1.200, T, z ? 0.100 : 0.145, WD2, 0, T / 2, z);
  for (const x of [-0.550, 0, 0.550]) {
    for (const z of [-0.3275, 0, 0.3275]) {
      B(x ? 0.100 : 0.145, BH, 0.145, WD1, x, T + BH / 2, z);
    }
    B(0.145, T, 0.800, WD3, x * 0.959, T + BH + T / 2, 0);
  }
  for (const [z, w] of [[-0.350, 0.100], [-0.186, 0.145], [0, 0.145],
                        [0.186, 0.145], [0.350, 0.100]]) {
    B(1.200, T, w, z === 0 ? WD3 : WD1, 0, T + BH + 1.5 * T, z);
  }

  // ---- eighteen cartons, three tiers of six -------------------------------
  const BW = 0.376, BD = 0.376;
  const TIERS = [[0.144, 0.450], [0.596, 0.450], [1.048, 0.404]];
  const CM = [C1, C2, C3, C4];
  TIERS.forEach(([y0, h0], ti) => {
    let hh = h0;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 2; j++) {
        hh = h0;
        const x = (i - 1) * 0.394 + jit(0.012);
        const z = (j - 0.5) * 0.394 + jit(0.012);
        const m = CM[(ti * 3 + i * 2 + j) % 4];
        if (ti === 2 && i === 0 && j === 1) hh = 0.446;   // this one stands proud
        if (ti === 1 && i === 1 && j === 1) {
          // the crushed one: a segmented box with its front face driven in
          const geo = new THREE.BoxGeometry(BW, hh, BD, 2, 2, 2);
          const p = geo.attributes.position;
          for (let k = 0; k < p.count; k++) {
            const px = p.getX(k), py = p.getY(k), pz = p.getZ(k);
            if (pz > BD / 2 - 1e-4) {
              const f = (1 - Math.abs(px) / (BW / 2)) * (1 - Math.abs(py) / (hh / 2));
              p.setZ(k, pz - 0.115 * f);
              p.setY(k, py - 0.030 * f);
            }
          }
          geo.computeVertexNormals();
          const o = new THREE.Mesh(geo, C4);
          o.position.set(x, y0 + hh / 2, z);
          o.rotation.y = jit(0.03);
          g.add(o);
        } else {
          const o = B(BW, hh, BD, m, x, y0 + hh / 2, z, jit(0.03));
          o.rotation.y = jit(0.03);
        }
        // packing tape down the lid seam, and a cross strip on the outer face
        B(0.048, 0.004, BD + 0.004, TAPE, x, y0 + hh + 0.001, z);
        if (j === 1) B(0.048, hh * 0.9, 0.005, TAPE, x + 0.06, y0 + hh * 0.45, z + BD / 2 + 0.001);
        if (j === 0) B(0.048, hh * 0.9, 0.005, TAPE, x - 0.06, y0 + hh * 0.45, z - BD / 2 - 0.001);
      }
    }
  });
  // a lid left standing open on the top tier
  B(0.372, 0.006, 0.190, C2, -0.394, 1.498, 0.096, 0.05);
  B(0.372, 0.150, 0.006, C3, -0.394, 1.410, -0.092, 0.05);

  // ---- vertical corner boards, tucked under the film ---------------------
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      B(0.072, 1.300, 0.008, C4, sx * 0.552, 0.800, sz * 0.392);
      B(0.008, 1.300, 0.072, C4, sx * 0.590, 0.800, sz * 0.354);
    }
  }

  // ---- knee-height grime band, 0.32 - 0.52 --------------------------------
  for (const [w, d, x, z] of [[1.176, 0.006, 0, 0.393], [1.176, 0.006, 0, -0.393],
                              [0.006, 0.780, 0.590, 0], [0.006, 0.780, -0.590, 0]]) {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, 0.200, d), GRIME);
    o.position.set(x, 0.420, z); g.add(o);
  }
  // ---- shipping labels ----------------------------------------------------
  B(0.150, 0.100, 0.005, LABEL,  0.300, 1.230, 0.392);
  B(0.150, 0.100, 0.005, LABEL, -0.330, 0.760, 0.392);
  B(0.005, 0.090, 0.120, LABEL,  0.592, 0.360, 0.180);

  // ---- stretch film: a lofted skin, cinched at every tier joint -----------
  const ringPts = (a, b, c) => [
    [a, b - c], [a, 0], [a, -(b - c)], [a - c, -b], [0, -b], [-(a - c), -b],
    [-a, -(b - c)], [-a, 0], [-a, b - c], [-(a - c), b], [0, b], [a - c, b],
  ];
  const LV = [[0.120, 0.052], [0.180, 0.006], [0.400, 0.000], [0.575, 0.026],
              [0.640, 0.004], [0.860, 0.000], [1.030, 0.026], [1.100, 0.004],
              [1.330, 0.000], [1.450, 0.014], [1.500, 0.062]];
  const pos = [], idx = [];
  const N = 12;
  LV.forEach(([y, ins]) => {
    ringPts(0.600 - ins, 0.400 - ins, 0.070).forEach((p) => pos.push(p[0], y, p[1]));
  });
  for (let i = 0; i < LV.length - 1; i++) {
    for (let j = 0; j < N; j++) {
      const a = i * N + j, b = i * N + (j + 1) % N;
      const c = (i + 1) * N + j, d = (i + 1) * N + (j + 1) % N;
      idx.push(a, c, d, a, d, b);
    }
  }
  const top = pos.length / 3;
  pos.push(0, 1.500, 0);
  for (let j = 0; j < N; j++) {
    idx.push((LV.length - 1) * N + j, top, (LV.length - 1) * N + (j + 1) % N);
  }
  const filmGeo = new THREE.BufferGeometry();
  filmGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  filmGeo.setIndex(idx);
  filmGeo.computeVertexNormals();
  g.add(new THREE.Mesh(filmGeo, FILM));

  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= box.min.y; m.position.z -= c.z; });
  return g;
}
