// sandbag_wall — arm C
// A different reading of the reference: the photograph is five courses of
// smaller, flatter bags, not three fat ones, laid in a proper running bond with
// the ends of the wall stepped back. Bags are squashed capsules, which gives
// the rounded end lobes a filled hessian sack actually has.
export default function (THREE) {
  const g = new THREE.Group();

  const mat = (hex, name, rough) => {
    const m = new THREE.MeshStandardMaterial({ color: hex, roughness: rough ?? 0.96, metalness: 0.0 });
    if (name) m.name = name;
    return m;
  };
  const lerpHex = (a, b, t) => {
    const c = (s) => [(s >> 16) & 255, (s >> 8) & 255, s & 255];
    const A = c(a), B = c(b);
    return ((Math.round(A[0] + (B[0] - A[0]) * t) << 16)
      | (Math.round(A[1] + (B[1] - A[1]) * t) << 8)
      | Math.round(A[2] + (B[2] - A[2]) * t));
  };
  const HESS = [0.05, 0.14, 0.24, 0.34, 0.45, 0.56].map((t) =>
    mat(lerpHex(0x9c7a4e, 0x3a3d33, t), 'fabric', 0.96));
  const dirt = mat(lerpHex(0x9c7a4e, 0x3a3d33, 0.82), 'fabric', 0.97);
  const cord = mat(lerpHex(0x9c7a4e, 0x3a3d33, 0.08), 'fabric', 0.94);
  const cordOpen = mat(lerpHex(0x9c7a4e, 0x3a3d33, 0.08), 'fabric', 0.94);
  cordOpen.side = THREE.DoubleSide;   // the wraps are open rings
  const stencil = mat(0x3a3d33, 'fabric', 0.9);
  const orange = mat(0xbe5220, 'metal', 0.7);
  const galv = mat(0x9aa0a3, 'metal', 0.6);

  let seed = 31415926;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const j = (a) => (rnd() - 0.5) * 2 * a;

  // capsule laid along X: radius 0.5, straight length 0.30 -> unit length 1.30
  const capGeo = new THREE.CapsuleGeometry(0.5, 0.30, 2, 7);
  capGeo.rotateZ(Math.PI / 2);
  {   // slacken it: the ends droop and the belly is not a perfect cylinder
    const p = capGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const t = Math.min(1, Math.abs(x) / 0.65);
      p.setXYZ(i, x, y * (1 - 0.10 * t) - 0.05 * t * t, z * (1 + 0.06 * (1 - t)));
    }
    capGeo.computeVertexNormals();
  }

  // unit capsule spans 1.30 x 1.00 x 1.06
  const BAG_L = 0.475, BAG_T = 0.215, BAG_W = 0.285;
  const COURSE_Y = [0.105, 0.278, 0.451, 0.624, 0.797];
  const ZS = [-0.115, 0.115];

  const bags = [];
  COURSE_Y.forEach((cy, ci) => {
    // running bond: three bags on even courses, three offset on odd, with the
    // odd course tucked in so nothing overhangs more than a bag lobe
    const odd = ci % 2 === 1;
    const XS = odd ? [-0.615, 0.0, 0.615] : [-0.585, 0.03, 0.60];
    XS.forEach((bx, xi) => {
      ZS.forEach((bz, zi) => {
        const dirty = cy > 0.30 && cy < 0.58 && rnd() > 0.35;
        const m = new THREE.Mesh(capGeo, dirty ? dirt : HESS[(xi * 2 + zi * 3 + ci) % HESS.length]);
        m.position.set(bx + j(0.022), cy + j(0.012), bz + j(0.018));
        m.rotation.set(j(0.10), j(0.055), j(0.075) + (odd ? 0.02 : -0.02));
        m.scale.set(BAG_L * (0.94 + rnd() * 0.12), BAG_T * (0.94 + rnd() * 0.14), BAG_W * (0.92 + rnd() * 0.16));
        g.add(m);
        bags.push(m);
      });
    });
  });
  // header bags across the wall, one in the second course and one in the fourth
  for (const [bx, cy] of [[-0.31, 0.278], [0.31, 0.624]]) {
    const m = new THREE.Mesh(capGeo, HESS[5]);
    m.position.set(bx, cy + 0.004, j(0.015));
    m.rotation.set(j(0.04), Math.PI / 2 + j(0.08), j(0.04));
    m.scale.set(BAG_L * 0.80, BAG_T * 0.96, BAG_W);
    g.add(m);
    bags.push(m);
  }

  // --- tied necks, cord wraps ------------------------------------------------
  for (const m of bags) {
    for (const s of [1, -1]) {
      if (rnd() > 0.38) continue;
      const local = new THREE.Vector3(s * m.scale.x * 0.63, 0, 0).applyEuler(m.rotation).add(m.position);
      const knot = new THREE.Mesh(new THREE.ConeGeometry(0.030, 0.065, 4), cord);
      knot.position.copy(local);
      knot.rotation.set(m.rotation.x, m.rotation.y, m.rotation.z + s * Math.PI / 2);
      g.add(knot);
      // the cord wrap is a ring, not a torus: 12 triangles instead of 36
      const wrap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.023, 0.023, 0.013, 6, 1, true), cordOpen);
      wrap.position.copy(local);
      wrap.rotation.set(m.rotation.x, m.rotation.y, m.rotation.z + s * Math.PI / 2);
      g.add(wrap);
    }
  }
  // --- stitched seam along the shoulder of the outward-facing bags ----------
  // it has to sit ON the bag: at 0.40 of the half height the section has already
  // closed to about 0.6 of its half width, and a full-length seam at full width
  // floats off the ends as a rod.
  for (const m of bags) {
    if (Math.abs(m.position.z) < 0.05 || rnd() > 0.5) continue;
    const seam = new THREE.Mesh(new THREE.BoxGeometry(m.scale.x * 0.55, 0.011, 0.017), cord);
    seam.position.set(m.position.x, m.position.y + m.scale.y * 0.40,
      m.position.z + Math.sign(m.position.z) * m.scale.z * 0.30);
    seam.rotation.copy(m.rotation);
    g.add(seam);
  }

  // --- the marking: a stencilled block and a wired tag -----------------------
  const st = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.095, 0.008), stencil);
  st.position.set(-0.31, 0.455, 0.185);
  st.rotation.set(-0.09, 0.05, 0.02);
  g.add(st);
  const tag = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.08, 0.006), orange);
  tag.position.set(0.60, 0.455, 0.19);
  tag.rotation.set(-0.05, -0.06, 0.08);
  g.add(tag);
  const tagWire = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.12, 4), galv);
  tagWire.position.set(0.60, 0.515, 0.182);
  tagWire.rotation.z = 0.16;
  g.add(tagWire);

  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= box.min.y; m.position.z -= c.z; });

  return g;
}
