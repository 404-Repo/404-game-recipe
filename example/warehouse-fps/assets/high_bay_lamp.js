// high_bay_lamp — WINNER (arm A): assembled from primitives (Cylinder/Cone/Torus/Box/Tube)
// 0.55 x 0.55 x 0.50 m. Straight-cone spun reflector, wire cage, cast body, hook + chain.
export default function (THREE) {
  const g = new THREE.Group();

  const M = (c, n, o = {}) => {
    const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.82, metalness: 0.2, ...o });
    if (n) m.name = n;
    return m;
  };
  const put = (geo, mat, p, r) => {
    const m = new THREE.Mesh(geo, mat);
    if (p) m.position.set(p[0], p[1], p[2]);
    if (r) m.rotation.set(r[0], r[1], r[2]);
    g.add(m);
    return m;
  };

  // --- materials -------------------------------------------------------------
  // The reflector's INSIDE is the lit surface seen from below and must be a much
  // brighter, smoother material than the dirty painted outside. One material for
  // the whole cone is what makes these read as plastic toys.
  const shadeOut = M(0x8f9599, 'metal', { roughness: 0.86, metalness: 0.28, side: THREE.DoubleSide });
  const shadeIn  = M(0xc9c6bd, 'metal', { roughness: 0.40, metalness: 0.74, side: THREE.DoubleSide });
  const rimMat   = M(0x878c8f, 'metal', { roughness: 0.80, metalness: 0.45, side: THREE.DoubleSide });
  const bandMat  = M(0x5b6167, 'metal', { roughness: 0.84, metalness: 0.40, side: THREE.DoubleSide });
  const castMat  = M(0x5b6167, 'metal', { roughness: 0.87, metalness: 0.18 });
  const finMat   = M(0x565c62, 'metal', { roughness: 0.90, metalness: 0.18 });
  const galv     = M(0x9aa0a3, 'metal', { roughness: 0.72, metalness: 0.62 });
  const rusty    = M(0x6e4128, 'metal', { roughness: 0.94, metalness: 0.25 });
  const tagMat   = M(0xd6a41f, 'metal', { roughness: 0.88, metalness: 0.10, side: THREE.DoubleSide });
  // near-black rubber: left unnamed on purpose, surfaces.js skips it
  const rubber   = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.92, metalness: 0.05 });
  // the lit lens: emissive sodium, unnamed AND transparent so surfaces.js skips it
  const lensMat  = new THREE.MeshStandardMaterial({
    color: 0xb9b3a6, roughness: 0.45, metalness: 0.0,
    emissive: 0xffb45a, emissiveIntensity: 1.0,
    transparent: true, opacity: 0.88, side: THREE.DoubleSide,
  });

  const S = 20; // radial segments for the hero cone

  // --- reflector -------------------------------------------------------------
  // truncated cones, open-ended, DoubleSide: you see the inside from below
  put(new THREE.CylinderGeometry(0.105, 0.272, 0.160, S, 1, true), shadeOut, [0, 0.205, 0]);
  put(new THREE.CylinderGeometry(0.098, 0.262, 0.152, S, 1, true), shadeIn,  [0, 0.207, 0]);
  // rolled rim band + rolled edge torus, in a distinctly darker steel so the
  // bottom edge of the shade reads as an edge and not as more cone
  put(new THREE.CylinderGeometry(0.275, 0.271, 0.032, S, 1, true), bandMat, [0, 0.120, 0]);
  put(new THREE.TorusGeometry(0.270, 0.010, 5, S), bandMat, [0, 0.106, 0], [Math.PI / 2, 0, 0]);
  // spinning ribs pressed into the cone: they are what says "spun sheet metal"
  put(new THREE.TorusGeometry(0.218, 0.0032, 4, S), shadeOut, [0, 0.180, 0], [Math.PI / 2, 0, 0]);
  put(new THREE.TorusGeometry(0.161, 0.0032, 4, S), shadeOut, [0, 0.235, 0], [Math.PI / 2, 0, 0]);
  // closing shoulder ring where the cone meets the casting
  put(new THREE.CylinderGeometry(0.112, 0.105, 0.016, S, 1, true), rimMat, [0, 0.289, 0]);

  // --- lens ------------------------------------------------------------------
  const lens = put(new THREE.CylinderGeometry(0.214, 0.208, 0.014, S, 1, true), lensMat, [0, 0.118, 0]);
  put(new THREE.CircleGeometry(0.212, S), lensMat, [0, 0.112, 0], [Math.PI / 2, 0, 0]);

  // --- wire cage guard -------------------------------------------------------
  // three hoops and ten bent bars sweeping from a small bottom ring out to the rim
  put(new THREE.TorusGeometry(0.085, 0.006, 5, 14), rusty, [0, 0.006, 0], [Math.PI / 2, 0, 0]);
  put(new THREE.TorusGeometry(0.185, 0.006, 5, S),  rusty, [0, 0.050, 0], [Math.PI / 2, 0, 0]);
  put(new THREE.TorusGeometry(0.262, 0.007, 5, S),  rusty, [0, 0.100, 0], [Math.PI / 2, 0, 0]);
  {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0.085, 0.006, 0),
      new THREE.Vector3(0.215, 0.012, 0),
      new THREE.Vector3(0.262, 0.100, 0),
    );
    const bar = new THREE.TubeGeometry(curve, 5, 0.006, 4, false);
    const N = 12;
    const im = new THREE.InstancedMesh(bar, rusty, N);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < N; i++) {
      m4.makeRotationY((i / N) * Math.PI * 2);
      im.setMatrixAt(i, m4);
    }
    im.instanceMatrix.needsUpdate = true;
    g.add(im);
  }

  // --- cast body -------------------------------------------------------------
  put(new THREE.CylinderGeometry(0.100, 0.106, 0.090, 16), castMat, [0, 0.330, 0]);
  put(new THREE.CylinderGeometry(0.074, 0.084, 0.024, 16), castMat, [0, 0.387, 0]);
  put(new THREE.CylinderGeometry(0.088, 0.088, 0.010, 16), rimMat,  [0, 0.373, 0]);
  // radial cooling fins.
  // The prototype geometry is TRANSLATED to a real fin position and the instance
  // matrix is a pure rotation about Y. A prototype left at the origin would put a
  // phantom box at y=0 in every bounding-box walk that ignores instance matrices
  // (which is every one of them, including the verifier's), and the whole asset
  // would be re-centred off that phantom and end up hovering.
  {
    const fin = new THREE.BoxGeometry(0.030, 0.052, 0.005);
    fin.translate(0.114, 0.318, 0);
    const N = 12;
    const im = new THREE.InstancedMesh(fin, finMat, N);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < N; i++) im.setMatrixAt(i, m4.makeRotationY((i / N) * Math.PI * 2));
    im.instanceMatrix.needsUpdate = true;
    g.add(im);
  }
  // strap band round the casting, with bolt heads: visible fixing
  put(new THREE.CylinderGeometry(0.110, 0.110, 0.020, 16, 1, true), rimMat, [0, 0.358, 0]);
  {
    const bolt = new THREE.CylinderGeometry(0.008, 0.008, 0.014, 6);
    bolt.rotateZ(-Math.PI / 2);          // axis along +X, i.e. radial
    bolt.translate(0.114, 0.358, 0);
    const N = 4;
    const im = new THREE.InstancedMesh(bolt, galv, N);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < N; i++) im.setMatrixAt(i, m4.makeRotationY((i / N) * Math.PI * 2 + 0.4));
    im.instanceMatrix.needsUpdate = true;
    g.add(im);
  }

  // --- rating tag: the plated marking ---------------------------------------
  put(new THREE.CylinderGeometry(0.108, 0.108, 0.044, 12, 1, true, -0.5, 1.0), tagMat, [0, 0.322, 0]);

  // --- cable gland -----------------------------------------------------------
  put(new THREE.CylinderGeometry(0.017, 0.021, 0.070, 10), castMat, [0.132, 0.352, 0], [0, 0, -Math.PI / 2]);
  put(new THREE.CylinderGeometry(0.025, 0.025, 0.018, 6),  galv,    [0.108, 0.352, 0], [0, 0, -Math.PI / 2]);
  put(new THREE.CylinderGeometry(0.014, 0.014, 0.020, 8),  galv,    [0.176, 0.352, 0], [0, 0, -Math.PI / 2]);
  put(new THREE.CylinderGeometry(0.008, 0.008, 0.044, 6),  rubber,  [0.204, 0.348, 0], [0, 0, -Math.PI / 2 - 0.25]);

  // --- suspension hook and chain --------------------------------------------
  put(new THREE.CylinderGeometry(0.011, 0.013, 0.024, 8), galv, [0, 0.399, 0]);
  put(new THREE.TorusGeometry(0.021, 0.007, 5, 12), galv, [0, 0.418, 0], [0, Math.PI / 2, 0]);
  put(new THREE.TorusGeometry(0.014, 0.0045, 5, 10), galv, [0, 0.4555, 0], [0, 0, 0]);
  put(new THREE.TorusGeometry(0.014, 0.0045, 5, 10), galv, [0, 0.4815, 0], [0, Math.PI / 2, 0]);

  // --- what the game attaches a real light to -------------------------------
  // the emitting part, and an empty at the centre of the lens plane
  const lightOrigin = new THREE.Object3D();
  lightOrigin.position.set(0, 0.118, 0);
  g.add(lightOrigin);
  g.userData.lampMesh = lens;
  g.userData.lightOrigin = lightOrigin;

  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= box.min.y; m.position.z -= c.z; });
  return g;
}
