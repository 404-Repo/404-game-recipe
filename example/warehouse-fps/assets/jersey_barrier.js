// jersey_barrier — arm C
// A different reading of the same silhouette: not one casting but four stacked
// masses with visible lift joints between them - scalloped foot, flared toe,
// body and a capping beam with a drip lip. Each mass is its own extrusion, so
// the horizontal joint lines and the slight differences of tone between pours
// are real geometry rather than paint.
export default function (THREE) {
  const g = new THREE.Group();

  const L = 3.0, HALF = L / 2, H = 0.82;

  const mat = (hex, name, rough, metal) => {
    const m = new THREE.MeshStandardMaterial({
      color: hex, roughness: rough ?? 0.9, metalness: metal ?? 0.05,
    });
    if (name) m.name = name;
    return m;
  };
  const pourA = mat(0x7a776f, 'stone', 0.94, 0.0);
  const pourB = mat(0x726f68, 'stone', 0.93, 0.0);
  const pourC = mat(0x6d6a64, 'stone', 0.95, 0.0);
  const stained = mat(0x4e4c47, 'stone', 0.95, 0.0);
  const aggregate = mat(0x8a8378, 'stone', 0.86, 0.0);
  const rust = mat(0x6e4128, 'metal', 0.92, 0.3);
  const steel = mat(0x5b6167, 'metal', 0.7, 0.6);
  const orange = mat(0xbe5220, 'metal', 0.6, 0.15);
  const galv = mat(0x9aa0a3, 'metal', 0.6, 0.7);

  let seed = 24681357;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

  // a trapezoid mass: half width at the bottom, half width at the top, over a
  // height band. Extruded along X with the bevel off, so the ends stay at
  // exactly +/-len/2 and barriers butt flush.
  const massGeo = (zBot, zTop, y0, y1, len) => {
    const s = new THREE.Shape();
    s.moveTo(-zBot, y0);
    s.lineTo(-zTop, y1);
    s.lineTo(zTop, y1);
    s.lineTo(zBot, y0);
    s.closePath();
    const gm = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false, curveSegments: 1 });
    gm.rotateY(Math.PI / 2);
    gm.translate(-len / 2, 0, 0);
    return gm;
  };

  // --- lift 1: the scalloped foot, four pads ---------------------------------
  const PADS = 4, GAP = 0.150;
  const padLen = (L - GAP * (PADS - 1)) / PADS;
  for (let i = 0; i < PADS; i++) {
    const cx = -HALF + padLen / 2 + i * (padLen + GAP);
    const m = new THREE.Mesh(massGeo(0.300, 0.292, 0.0, 0.100, padLen), pourC);
    m.position.x = cx;
    g.add(m);
    // a small cast keying rib on the outside of each pad
    for (const sz of [1, -1]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(padLen * 0.55, 0.020, 0.014), stained);
      rib.position.set(cx, 0.062, sz * 0.298);
      g.add(rib);
    }
  }

  // --- lift 2: the flared toe, full length -----------------------------------
  g.add(new THREE.Mesh(massGeo(0.292, 0.158, 0.100, 0.335, L), pourB));
  // --- lift 3: the body -------------------------------------------------------
  g.add(new THREE.Mesh(massGeo(0.152, 0.098, 0.335, 0.735, L), pourA));
  // --- lift 4: the capping beam, with an overhanging drip lip ----------------
  g.add(new THREE.Mesh(massGeo(0.108, 0.085, 0.735, H, L), pourB));

  // --- the joints between pours, as recessed shadow lines --------------------
  for (const [jy, jz] of [[0.100, 0.292], [0.335, 0.155], [0.735, 0.103]]) {
    for (const sz of [1, -1]) {
      const j = new THREE.Mesh(new THREE.BoxGeometry(L - 0.02, 0.012, 0.008), stained);
      j.position.set(0, jy, sz * (jz - 0.004));
      g.add(j);
    }
  }

  // --- knee-height scuff: a rubbing strip on the toe/body joint --------------
  for (const sz of [1, -1]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(L - 0.16, 0.150, 0.010), stained);
    b.position.set(0, 0.425, sz * 0.145);
    b.rotation.x = -sz * 0.135;
    g.add(b);
  }

  // --- lifting eyes recessed into the capping beam ---------------------------
  for (const s of [1, -1]) {
    const well = new THREE.Mesh(new THREE.BoxGeometry(0.140, 0.030, 0.100), stained);
    well.position.set(s * 0.72, H - 0.016, 0);
    g.add(well);
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.012, 5, 9, Math.PI), rust);
    eye.position.set(s * 0.72, H - 0.010, 0);
    g.add(eye);
    for (const sz of [1, -1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 6), rust);
      leg.position.set(s * 0.72, H - 0.032, sz * 0.048);
      g.add(leg);
    }
  }

  // --- orange reflective panels bolted to galvanised straps ------------------
  for (const sz of [1, -1]) {
    for (const sx of [1, -1]) {
      const zface = 0.150 - 0.055;   // mid of the body face
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.42, 0.006), galv);
      strap.position.set(sx * 1.16, 0.545, sz * (0.122));
      strap.rotation.x = -sz * 0.135;
      g.add(strap);
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.36, 0.008), orange);
      p.position.set(sx * 1.16, 0.545, sz * (0.127));
      p.rotation.x = -sz * 0.135;
      g.add(p);
      for (const by of [0.40, 0.69]) {
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.014, 6), rust);
        const bz = 0.152 - (by - 0.335) / 0.40 * 0.054;
        bolt.position.set(sx * 1.16, by, sz * (bz + 0.012));
        bolt.rotation.x = Math.PI / 2 - sz * 0.135;
        g.add(bolt);
      }
      void zface;
    }
  }

  // --- cast identification plate --------------------------------------------
  for (const sz of [1, -1]) {
    const pl = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.007), stained);
    pl.position.set(sz * 0.30, 0.60, sz * 0.124);
    pl.rotation.x = -sz * 0.135;
    g.add(pl);
    const tag = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.06, 0.004), galv);
    tag.position.set(sz * 0.30, 0.60, sz * 0.130);
    tag.rotation.x = -sz * 0.135;
    g.add(tag);
  }

  // --- the ends: pocket, dowel, and the joint lines carried round ------------
  for (const sx of [1, -1]) {
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.28, 0.080), stained);
    pocket.position.set(sx * (HALF - 0.010), 0.50, 0);
    g.add(pocket);
    const dowel = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.046, 8), steel);
    dowel.position.set(sx * (HALF - 0.006), 0.70, 0);
    dowel.rotation.z = Math.PI / 2;
    g.add(dowel);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.09, 0.16), rust);
    plate.position.set(sx * (HALF - 0.004), 0.19, 0);
    g.add(plate);
  }

  // --- spalled corners -------------------------------------------------------
  const chips = [
    [-HALF + 0.12, 0.75, 0.06], [-HALF + 0.10, 0.34, -0.15],
    [HALF - 0.12, 0.73, -0.06], [HALF - 0.15, 0.12, 0.26],
    [0.22, H - 0.02, -0.07], [-0.90, 0.10, 0.28],
  ];
  for (const [cx, cy, cz] of chips) {
    const s = 0.030 + rnd() * 0.028;
    const chip = new THREE.Mesh(new THREE.OctahedronGeometry(s, 0), aggregate);
    chip.position.set(cx, cy, cz);
    chip.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    chip.scale.set(1.2, 0.8, 0.9);
    g.add(chip);
    for (let k = 0; k < 3; k++) {
      const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.009 + rnd() * 0.006, 0), stained);
      st.position.set(cx + (rnd() - 0.5) * 0.10, cy + (rnd() - 0.5) * 0.07, cz + (rnd() - 0.5) * 0.04);
      st.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      g.add(st);
    }
  }

  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= box.min.y; m.position.z -= c.z; });

  return g;
}
