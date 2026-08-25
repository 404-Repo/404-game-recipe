// oil_drum — winner (arm B): one swept profile (LatheGeometry) for the whole
// pressed shell: rolled chimes, body and both swaged rolling hoops in one skin.
// 205 litre steel drum, 0.585 x 0.585 x 0.880 m
export default function (THREE) {
  const g = new THREE.Group();

  const mat = (color, name, o = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.2, ...o });
    if (name) m.name = name;
    return m;
  };

  const BODY = mat(0x2b4a63, 'metal', { roughness: 0.72, metalness: 0.22, side: THREE.DoubleSide });
  const BODY2 = mat(0x27455c, 'metal', { roughness: 0.82, metalness: 0.16 });
  const LID = mat(0x30536d, 'metal', { roughness: 0.7, metalness: 0.25, side: THREE.DoubleSide });
  const RUST = mat(0x6e4128, 'metal', { roughness: 0.93, metalness: 0.1, side: THREE.DoubleSide });
  const RUST2 = mat(0x66401f, 'metal', { roughness: 0.95, metalness: 0.08 });
  const STEEL = mat(0x5b6167, 'metal', { roughness: 0.6, metalness: 0.55 });
  const GALV = mat(0x9aa0a3, 'metal', { roughness: 0.55, metalness: 0.68 });
  const YELLOW = mat(0xd6a41f, 'metal', { roughness: 0.85, metalness: 0.1 });
  const DIRT = mat(0x3d3a33, 'metal', { roughness: 0.96, metalness: 0.05, side: THREE.DoubleSide });

  const RS = 20;   // a lathe almost never needs more than 20

  // --- the shell profile, bottom rolled chime -> body -> two swaged rolling
  //     hoops -> top rolled chime. r = 0.286 body, 0.2925 over the hoops.
  const P = [
    [0.000, 0.000], [0.240, 0.000], [0.266, 0.005], [0.283, 0.016],
    [0.2925, 0.030], [0.2915, 0.046], [0.284, 0.058], [0.286, 0.072],
    [0.286, 0.276], [0.2905, 0.290], [0.2925, 0.302], [0.2925, 0.330],
    [0.2905, 0.342], [0.286, 0.356],
    [0.286, 0.548], [0.2905, 0.562], [0.2925, 0.574], [0.2925, 0.602],
    [0.2905, 0.614], [0.286, 0.628],
    [0.286, 0.812], [0.284, 0.824], [0.2915, 0.836], [0.2925, 0.852],
    [0.283, 0.866], [0.266, 0.876], [0.245, 0.880],
  ].map(([x, y]) => new THREE.Vector2(x, y));

  const shell = new THREE.Mesh(new THREE.LatheGeometry(P, RS), BODY);
  g.add(shell);

  // lid: a second short lathe, slightly dished, with a rolled stiffening bead
  const LP = [
    [0.000, 0.8695], [0.120, 0.8695], [0.150, 0.8735], [0.178, 0.8775],
    [0.206, 0.8735], [0.236, 0.8705], [0.245, 0.8750], [0.245, 0.8800],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  g.add(new THREE.Mesh(new THREE.LatheGeometry(LP, RS), LID));

  // bottom head, closing the drum
  const BP = [
    [0.000, 0.0160], [0.150, 0.0160], [0.210, 0.0125], [0.240, 0.0000],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  g.add(new THREE.Mesh(new THREE.LatheGeometry(BP, RS), BODY2));

  const add = (geo, m, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); g.add(mesh); return mesh;
  };

  // --- knee-height scuff: a rust ring sleeved over the lower rolling hoop ----
  add(new THREE.CylinderGeometry(0.2945, 0.2945, 0.062, RS, 1, true), RUST, 0, 0.316, 0);
  // and a dirt band above it, still inside 0.30-0.60
  add(new THREE.CylinderGeometry(0.2872, 0.2872, 0.13, RS, 1, true), DIRT, 0, 0.445, 0);
  // the upper rolling hoop, same section, in body colour, so the pair reads
  add(new THREE.CylinderGeometry(0.2945, 0.2945, 0.062, RS, 1, true),
      mat(0x2f5069, 'metal', { roughness: 0.76, metalness: 0.24, side: THREE.DoubleSide }), 0, 0.588, 0);

  // --- bungs (2" and 3/4") with hex flanges: visible fixing ------------------
  add(new THREE.CylinderGeometry(0.050, 0.054, 0.012, 6), BODY2, 0.148, 0.8765, 0);
  add(new THREE.CylinderGeometry(0.037, 0.037, 0.017, 12), STEEL, 0.148, 0.8875, 0);
  add(new THREE.TorusGeometry(0.030, 0.005, 4, 12), GALV, 0.148, 0.8955, 0).rotation.x = -Math.PI / 2;
  add(new THREE.CylinderGeometry(0.032, 0.035, 0.010, 6), BODY2, -0.098, 0.8745, 0.118);
  add(new THREE.CylinderGeometry(0.023, 0.023, 0.015, 10), GALV, -0.098, 0.8845, 0.118);

  // --- vertical weld seam ---------------------------------------------------
  add(new THREE.BoxGeometry(0.014, 0.74, 0.010), RUST2, 0, 0.45, 0.2865);
  // seam tack welds
  for (let i = 0; i < 5; i++) {
    add(new THREE.BoxGeometry(0.030, 0.014, 0.008), RUST2, 0, 0.16 + i * 0.14, 0.2885);
  }

  // --- stencilled plate ------------------------------------------------------
  add(new THREE.BoxGeometry(0.17, 0.115, 0.007), YELLOW, 0, 0.70, -0.2845);
  add(new THREE.BoxGeometry(0.12, 0.026, 0.010), mat(0x4e4c47, 'metal', { roughness: 0.9 }), 0, 0.715, -0.286);
  // a smaller hazard diamond, recessed
  add(new THREE.BoxGeometry(0.075, 0.075, 0.006), mat(0xbe5220, 'metal', { roughness: 0.85 }), 0.16, 0.70, -0.268).rotation.z = Math.PI / 4;

  // --- rust streaks between the hoops ---------------------------------------
  const streak = new THREE.BoxGeometry(0.020, 1.0, 0.005);
  for (const [a, y, h] of [[0.4, 0.20, 0.22], [1.5, 0.62, 0.30], [2.6, 0.36, 0.18],
                           [3.9, 0.66, 0.26], [5.0, 0.22, 0.20], [5.9, 0.50, 0.24]]) {
    const m = new THREE.Mesh(streak.clone().scale(1, h, 1), RUST2);
    m.position.set(Math.sin(a) * 0.2875, y, Math.cos(a) * 0.2875);
    m.rotation.y = a;
    g.add(m);
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
