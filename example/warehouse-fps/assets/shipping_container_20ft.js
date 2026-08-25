// shipping_container_20ft — winner (arm C): a different reading. A container is not a
// decorated box, it is a welded steel SKELETON with a folded 2 mm sheet skin
// stretched over it and the doors set deep inside the corner posts. So: the skin
// is a genuine folded sheet (hand-built strip, DoubleSide, flat-shaded), the
// frame is modelled as members you could count, and the door reveal is real
// depth rather than a painted-on line.  6.06 x 2.44 x 2.59 m
export default function (THREE) {
  const g = new THREE.Group();

  const mat = (color, name, o = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.15, ...o });
    if (name) m.name = name;
    return m;
  };
  const skinMat = (color) => mat(color, 'metal', {
    roughness: 0.85, metalness: 0.12, side: THREE.DoubleSide, flatShading: true,
  });

  const RED = skinMat(0x8c3a2b);
  const RED_D = skinMat(0x813527);
  const RED_L = skinMat(0x95402f);
  const RED_F = mat(0x8c3a2b, 'metal', { roughness: 0.84, metalness: 0.12 });
  const RED_FD = mat(0x7d3325, 'metal', { roughness: 0.88, metalness: 0.1 });
  const RUST = mat(0x6e4128, 'metal', { roughness: 0.94, metalness: 0.08 });
  const STEEL = mat(0x5b6167, 'metal', { roughness: 0.72, metalness: 0.22 });
  const STEEL2 = mat(0x646a70, 'metal', { roughness: 0.76, metalness: 0.20 });
  const GALV = mat(0x9aa0a3, 'metal', { roughness: 0.55, metalness: 0.68 });
  const DARK = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.9, metalness: 0.05 });
  const YELLOW = mat(0xd6a41f, 'metal', { roughness: 0.86, metalness: 0.1 });
  const PLATE = mat(0x878c8f, 'metal', { roughness: 0.58, metalness: 0.62 });

  const HX = 3.03, HZ = 1.22, H = 2.59;

  const add = (geo, m, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); g.add(mesh); return mesh;
  };

  // --- a folded sheet: a corrugation polyline lofted between two heights -----
  function fold(len, n, depth, y0, y1) {
    const pitch = len / n, s = pitch * 0.175, fo = pitch * 0.345;
    const pts = [];
    let u = -len / 2;
    pts.push([u, 0]);
    for (let i = 0; i < n; i++) {
      pts.push([u + s, depth]);
      pts.push([u + s + fo, depth]);
      pts.push([u + 2 * s + fo, 0]);
      pts.push([u + pitch, 0]);
      u += pitch;
    }
    const pos = [], idx = [];
    for (const [a, b] of pts) { pos.push(a, y0, b); pos.push(a, y1, b); }
    for (let i = 0; i < pts.length - 1; i++) {
      const p = i * 2;
      idx.push(p, p + 2, p + 3, p, p + 3, p + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  // ----------------------------------------------------------- the skin -----
  add(fold(5.80, 20, 0.042, 0.22, 2.46), RED, 0, 0, 1.156);
  const back = fold(5.80, 20, 0.042, 0.22, 2.46); back.rotateY(Math.PI);
  add(back, RED_D, 0, 0, -1.156);
  const endw = fold(2.28, 8, 0.042, 0.22, 2.46); endw.rotateY(-Math.PI / 2);
  add(endw, RED_D, -2.966, 0, 0);
  const roof = fold(5.88, 20, 0.038, -1.15, 1.15); roof.rotateX(-Math.PI / 2);
  add(roof, RED_L, 0, 2.552, 0);

  // ----------------------------------------------------------- skeleton -----
  // side rails, top and bottom
  for (const sz of [1, -1]) {
    add(new THREE.BoxGeometry(5.90, 0.17, 0.09), STEEL, 0, 0.145, sz * 1.175);
    add(new THREE.BoxGeometry(5.90, 0.15, 0.09), STEEL2, 0, 2.510, sz * 1.175);
    // the sheet is welded to a flange: a thin lip along each rail
    add(new THREE.BoxGeometry(5.86, 0.030, 0.035), RUST, 0, 0.240, sz * 1.168);
    add(new THREE.BoxGeometry(5.86, 0.030, 0.035), RUST, 0, 2.442, sz * 1.168);
  }
  // end rails
  for (const sx of [1, -1]) {
    add(new THREE.BoxGeometry(0.09, 0.16, 2.30), STEEL, sx * 2.982, 0.150, 0);
    add(new THREE.BoxGeometry(0.09, 0.16, 2.30), STEEL2, sx * 2.982, 2.505, 0);
  }
  // corner posts
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    add(new THREE.BoxGeometry(0.115, 2.30, 0.150), STEEL, sx * 2.972, 1.29, sz * 1.145);
  }
  // underframe: cross members you can count from any low angle
  for (let i = -5; i <= 5; i++) {
    add(new THREE.BoxGeometry(0.085, 0.080, 2.24), mat(0x54595e, 'metal', { roughness: 0.9 }), i * 0.50, 0.095, 0);
  }
  add(new THREE.BoxGeometry(5.80, 0.070, 0.16), mat(0x4f545a, 'metal', { roughness: 0.9 }), 0, 0.100, 0);
  // floor slab seen through the door opening
  add(new THREE.BoxGeometry(5.80, 0.040, 2.22), mat(0x9c7a4e, 'timber', { roughness: 0.92, metalness: 0.0 }), 0, 0.215, 0);

  // ------------------------------------------------------- corner castings ---
  const HOLE = mat(0x2c2f31, 'metal', { roughness: 0.95, metalness: 0.2, side: THREE.DoubleSide });
  for (const sx of [1, -1]) for (const sz of [1, -1]) for (const sy of [0, 1]) {
    const y = sy ? H - 0.059 : 0.059;
    const x = sx * (HX - 0.089), z = sz * (HZ - 0.081);
    add(new THREE.BoxGeometry(0.178, 0.118, 0.162), mat(sy ? 0x6a7076 : 0x565b60, 'metal', { roughness: 0.74, metalness: 0.24 }), x, y, z);
    // chamfer plates on the outer corner, the way a casting is actually shaped
    add(new THREE.BoxGeometry(0.052, 0.126, 0.052), STEEL2, x + sx * 0.048, y, z + sz * 0.044).rotation.y = Math.PI / 4;
    const a = add(new THREE.CylinderGeometry(0.033, 0.033, 0.030, 8, 1, true), HOLE, x + sx * 0.074, y, z);
    a.rotation.z = Math.PI / 2; a.scale.set(1, 1, 1.5);
    const b = add(new THREE.CylinderGeometry(0.033, 0.033, 0.030, 8, 1, true), HOLE, x, y, z + sz * 0.066);
    b.rotation.x = Math.PI / 2; b.scale.set(1.5, 1, 1);
    const c2 = add(new THREE.CylinderGeometry(0.037, 0.037, 0.030, 8, 1, true), HOLE, x, y + (sy ? 0.044 : -0.044), z);
    c2.scale.set(1.4, 1, 1);
  }

  // ------------------------------------------------------- forklift pockets --
  for (const sz of [1, -1]) for (const sx of [1, -1]) {
    const x = sx * 0.95;
    add(new THREE.BoxGeometry(0.38, 0.115, 0.06), DARK, x, 0.145, sz * 1.200);
    add(new THREE.BoxGeometry(0.44, 0.028, 0.055), GALV, x, 0.212, sz * 1.205);
    add(new THREE.BoxGeometry(0.44, 0.028, 0.055), GALV, x, 0.078, sz * 1.205);
    add(new THREE.BoxGeometry(0.030, 0.115, 0.058), STEEL, x - 0.190, 0.145, sz * 1.203);
    add(new THREE.BoxGeometry(0.030, 0.115, 0.058), STEEL, x + 0.190, 0.145, sz * 1.203);
  }

  // ----------------------------------------------- knee-height scuff / rub ---
  for (const sz of [1, -1]) {
    add(new THREE.BoxGeometry(5.70, 0.060, 0.026), RUST, 0, 0.455, sz * 1.209);
    for (let i = 0; i < 12; i++) {
      add(new THREE.CylinderGeometry(0.013, 0.013, 0.018, 6), GALV, -2.60 + i * 0.47, 0.455, sz * 1.216)
        .rotation.x = Math.PI / 2;
    }
    // chipped paint band above it
    add(new THREE.BoxGeometry(5.60, 0.16, 0.008), mat(0x6b4a3c, 'metal', { roughness: 0.95 }), 0, 0.60, sz * 1.202);
  }

  // ------------------------------------------------------------- the doors ---
  // set 0.16 back from the corner posts so the reveal is real depth
  const DOORF = 2.855;
  // door frame: header, sill and jambs standing proud of the leaves
  add(new THREE.BoxGeometry(0.16, 0.150, 2.30), STEEL, 2.950, 2.470, 0);
  add(new THREE.BoxGeometry(0.16, 0.140, 2.30), STEEL, 2.950, 0.190, 0);
  for (const sz of [1, -1]) add(new THREE.BoxGeometry(0.16, 2.20, 0.115), STEEL, 2.950, 1.290, sz * 1.152);
  // reveal walls, so you see into the recess rather than at a painted line
  add(new THREE.BoxGeometry(0.14, 2.20, 0.020), mat(0x4a4f54, 'metal', { roughness: 0.9, side: THREE.DoubleSide }), 2.940, 1.29, 1.090);
  add(new THREE.BoxGeometry(0.14, 2.20, 0.020), mat(0x4a4f54, 'metal', { roughness: 0.9, side: THREE.DoubleSide }), 2.940, 1.29, -1.090);

  for (const sz of [-1, 1]) {
    const zc = sz * 0.545;
    add(new THREE.BoxGeometry(0.055, 2.18, 1.070), RED_F, DOORF - 0.028, 1.30, zc);
    for (let r = 0; r < 4; r++) {
      add(new THREE.BoxGeometry(0.024, 0.070, 0.990), RED_FD, DOORF + 0.010, 0.38 + r * 0.52, zc);
    }
    add(new THREE.BoxGeometry(0.060, 2.18, 0.052), STEEL, DOORF - 0.024, 1.30, zc + sz * 0.520);
    add(new THREE.BoxGeometry(0.060, 2.18, 0.040), DARK, DOORF - 0.024, 1.30, zc - sz * 0.530);   // gasket
    for (const s2 of [-1, 1]) {
      const zb = zc + s2 * 0.285;
      add(new THREE.CylinderGeometry(0.017, 0.017, 2.14, 8), GALV, DOORF + 0.062, 1.30, zb);
      for (const yy of [0.32, 1.03, 1.70, 2.26]) {
        add(new THREE.BoxGeometry(0.078, 0.050, 0.050), STEEL, DOORF + 0.028, yy, zb);
        add(new THREE.CylinderGeometry(0.010, 0.010, 0.030, 6), GALV, DOORF + 0.010, yy + 0.030, zb).rotation.z = Math.PI / 2;
      }
      add(new THREE.BoxGeometry(0.052, 0.052, 0.056), STEEL, DOORF + 0.062, 1.20, zb);
      const hl = add(new THREE.BoxGeometry(0.046, 0.056, 0.31), GALV, DOORF + 0.086, 1.14, zb + s2 * 0.105);
      hl.rotation.x = 0.20;
      add(new THREE.BoxGeometry(0.034, 0.100, 0.048), STEEL, DOORF + 0.076, 0.99, zb + s2 * 0.195);
      add(new THREE.BoxGeometry(0.062, 0.080, 0.105), STEEL, DOORF + 0.056, 0.24, zb);
      add(new THREE.BoxGeometry(0.062, 0.080, 0.105), STEEL, DOORF + 0.056, 2.36, zb);
    }
    for (const yy of [0.33, 1.06, 1.79, 2.30]) {
      add(new THREE.CylinderGeometry(0.027, 0.027, 0.150, 8), STEEL, DOORF + 0.050, yy, zc + sz * 0.552);
      add(new THREE.BoxGeometry(0.080, 0.066, 0.066), STEEL, DOORF + 0.005, yy, zc + sz * 0.540);
    }
  }
  // lock box between the leaves
  add(new THREE.BoxGeometry(0.070, 0.20, 0.115), STEEL2, DOORF + 0.055, 1.02, 0);

  // ------------------------------------------------- stencilled/plated marks --
  add(new THREE.BoxGeometry(0.012, 0.21, 0.27), PLATE, DOORF + 0.006, 1.64, -0.86);
  add(new THREE.BoxGeometry(0.014, 0.055, 0.20), mat(0x4e4c47, 'metal', { roughness: 0.9 }), DOORF + 0.012, 1.68, -0.86);
  add(new THREE.BoxGeometry(0.012, 0.14, 0.20), PLATE, DOORF + 0.006, 0.74, -0.86);
  add(new THREE.BoxGeometry(0.28, 0.18, 0.012), YELLOW, -1.60, 1.98, 1.212);
  add(new THREE.BoxGeometry(0.28, 0.18, 0.012), YELLOW, 1.20, 1.98, -1.212);
  add(new THREE.BoxGeometry(0.012, 0.18, 0.24), YELLOW, -3.014, 1.95, 0.55);

  // vents under the top rail
  for (const sz of [1, -1]) for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.24, 0.095, 0.026), STEEL, sx * 2.35, 2.345, sz * 1.208);
  }

  // rust runs down the panel joints
  for (const [x, z, y, h] of [[-2.1, 1, 1.5, 1.9], [0.9, 1, 1.2, 1.4], [2.0, -1, 1.6, 2.0],
                              [-1.1, -1, 1.0, 1.2], [1.6, 1, 0.9, 1.0], [-0.3, -1, 1.7, 1.6],
                              [-2.6, -1, 1.3, 1.7]]) {
    add(new THREE.BoxGeometry(0.05, h, 0.010), RUST, x, y, z * 1.202);
  }

  // --- the six lines --------------------------------------------------------
  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= box.min.y; m.position.z -= c.z; });

  return g;
}
