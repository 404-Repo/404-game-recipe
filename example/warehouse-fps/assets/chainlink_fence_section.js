// chainlink_fence_section — arm A
// A plain line-of-fence panel: two tubular posts with domed caps, a top and a
// bottom rail, and real diamond mesh made of two crossed families of round wire
// on an InstancedMesh. Every part is DoubleSide, because at 80 mm deep there is
// no such thing as a back you cannot see.
export default function (THREE) {
  const g = new THREE.Group();

  const W = 3.00, H = 2.40;
  const POST_R = 0.030;                 // outer face lands on x = +/-1.50
  const POST_X = W / 2 - POST_R;
  const BOLT_Z = 0.040;                 // bolt ends set the 80 mm depth

  const mat = (hex, name, rough, metal) => {
    const m = new THREE.MeshStandardMaterial({
      color: hex, roughness: rough ?? 0.62, metalness: metal ?? 0.7, side: THREE.DoubleSide,
    });
    if (name) m.name = name;
    return m;
  };
  const galv = mat(0x9aa0a3, 'metal', 0.60, 0.72);
  const galvDull = mat(0x8f9598, 'metal', 0.68, 0.66);
  const wire = mat(0x949a9d, 'metal', 0.58, 0.74);
  const dirty = mat(0x6f7477, 'metal', 0.80, 0.45);
  const rust = mat(0x6e4128, 'metal', 0.90, 0.35);
  const yellow = mat(0xd6a41f, 'metal', 0.72, 0.10);

  // ---- the diamond mesh ------------------------------------------------------
  const X0 = -1.435, X1 = 1.435, Y0 = 0.155, Y1 = 2.215;
  const PITCH = 0.060;                  // 60 mm, so a 60 mm diamond aperture
  const CY = (Y0 + Y1) / 2;
  const items = [];
  for (const s of [1, -1]) {
    const cMin = s === 1 ? X0 - Y1 : X0 + Y0;
    const cMax = s === 1 ? X1 - Y0 : X1 + Y1;
    const n = Math.ceil((cMax - cMin) / PITCH);
    for (let i = 0; i <= n; i++) {
      const c = cMin + i * PITCH;
      const ya = s === 1 ? Math.max(Y0, X0 - c) : Math.max(Y0, c - X1);
      const yb = s === 1 ? Math.min(Y1, X1 - c) : Math.min(Y1, c - X0);
      if (yb - ya < 0.035) continue;
      items.push({
        x: (s * ya + c + s * yb + c) / 2,
        y: (ya + yb) / 2,
        z: s * 0.0060,
        rz: -s * Math.PI / 4,
        len: (yb - ya) * Math.SQRT2,
      });
    }
  }
  // prototype is a unit-height open cylinder, 12 triangles, and the instanced
  // mesh is parked at the panel centre so its untransformed prototype box still
  // sits inside the asset (the loader and the gate both measure prototypes).
  const wireGeo = new THREE.CylinderGeometry(0.0026, 0.0026, 1, 6, 1, true);
  const mesh = new THREE.InstancedMesh(wireGeo, wire, items.length);
  mesh.position.set(0, CY, 0);
  {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(),
      p = new THREE.Vector3(), sc = new THREE.Vector3();
    items.forEach((it, i) => {
      q.setFromEuler(new THREE.Euler(0, 0, it.rz));
      p.set(it.x, it.y - CY, it.z);
      sc.set(1, it.len, 1);
      mesh.setMatrixAt(i, m4.compose(p, q, sc));
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
  g.add(mesh);

  // knuckled selvage along the top of the mesh
  const knuckGeo = new THREE.CylinderGeometry(0.0026, 0.0026, 0.055, 5, 1, true);
  const KN = 24;
  const knuck = new THREE.InstancedMesh(knuckGeo, wire, KN);
  knuck.position.set(0, Y1 + 0.020, 0);
  {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(),
      p = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < KN; i++) {
      const x = X0 + 0.06 + (i / (KN - 1)) * (X1 - X0 - 0.12);
      q.setFromEuler(new THREE.Euler(0, 0, (i % 2 ? 1 : -1) * 0.28));
      p.set(x, 0, (i % 2 ? 1 : -1) * 0.006);
      knuck.setMatrixAt(i, m4.compose(p, q, sc));
    }
    knuck.instanceMatrix.needsUpdate = true;
  }
  g.add(knuck);

  // ---- posts -----------------------------------------------------------------
  for (const s of [1, -1]) {
    const px = s * POST_X;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(POST_R, POST_R, 2.352, 12), galv);
    post.position.set(px, 1.176, 0);
    g.add(post);
    // knee-height mud and scuff band, 0.30 - 0.55
    const band = new THREE.Mesh(new THREE.CylinderGeometry(POST_R + 0.004, POST_R + 0.005, 0.25, 12), dirty);
    band.position.set(px, 0.425, 0);
    g.add(band);
    // cap: collar plus dome, topping out at exactly 2.40
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.032, 0.030, 12), galvDull);
    collar.position.set(px, 2.367, 0);
    g.add(collar);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.034, 12, 4, 0, Math.PI * 2, 0, Math.PI / 2), galvDull);
    dome.position.set(px, 2.366, 0);
    g.add(dome);
    // ground sleeve, the visible fixing at the foot
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.040, 0.044, 0.090, 12), rust);
    sleeve.position.set(px, 0.045, 0);
    g.add(sleeve);
    // tension bands with a carriage bolt through, three per post
    for (const by of [0.30, 1.20, 2.16]) {
      const bandC = new THREE.Mesh(
        new THREE.CylinderGeometry(POST_R + 0.007, POST_R + 0.007, 0.042, 12, 1, true), galvDull);
      bandC.position.set(px, by, 0);
      g.add(bandC);
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, BOLT_Z * 2, 6), rust);
      bolt.position.set(px, by, 0);
      bolt.rotation.x = Math.PI / 2;
      g.add(bolt);
      for (const bz of [1, -1]) {
        const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.010, 6), galvDull);
        nut.position.set(px, by, bz * (BOLT_Z - 0.006));
        nut.rotation.x = Math.PI / 2;
        g.add(nut);
      }
    }
    // tension bar: the flat bar that laces the mesh to the post
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.010, 2.02, 0.026), galvDull);
    bar.position.set(s * (POST_X - 0.042), 1.19, 0);
    g.add(bar);
  }

  // ---- rails ------------------------------------------------------------------
  for (const [ry, rr] of [[2.245, 0.021], [0.128, 0.021]]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, W - 2 * POST_R, 12), galv);
    rail.position.set(0, ry, 0);
    rail.rotation.z = Math.PI / 2;
    g.add(rail);
    // rail sleeve joint at midspan, so the rail is not one moulded stick
    const sl = new THREE.Mesh(new THREE.CylinderGeometry(rr + 0.005, rr + 0.005, 0.13, 12, 1, true), galvDull);
    sl.position.set(0.10, ry, 0);
    sl.rotation.z = Math.PI / 2;
    g.add(sl);
  }
  // bottom tension wire at knee height, running the full panel
  const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, W - 2 * POST_R - 0.02, 6), dirty);
  tw.position.set(0, 0.44, 0);
  tw.rotation.z = Math.PI / 2;
  g.add(tw);

  // ---- the marking: a warning plate wired to the mesh -------------------------
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.006), yellow);
  plate.position.set(0.58, 1.52, 0.012);
  g.add(plate);
  const plateEdge = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.004), galvDull);
  plateEdge.position.set(0.58, 1.52, 0.008);
  g.add(plateEdge);
  for (const [tx, ty] of [[-0.10, 0.07], [0.10, 0.07], [-0.10, -0.07], [0.10, -0.07]]) {
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0025, 3, 6), wire);
    tie.position.set(0.58 + tx, 1.52 + ty, 0.006);
    tie.rotation.y = Math.PI / 2;
    g.add(tie);
  }

  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= box.min.y; m.position.z -= c.z; });

  return g;
}
