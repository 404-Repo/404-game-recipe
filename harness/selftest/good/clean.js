/**
 * A deliberately CORRECT asset, for the other half of the selftest.
 *
 * The broken fixtures prove the gate fires. This one proves it does not fire on
 * something that is fine, which is the failure mode nobody looks for: a gate
 * that fails everything is as useless as one that passes everything, and it is
 * far more convincing while it wastes your day.
 *
 * Deliberately symmetric on all four sides, so the blank-side check has nothing
 * legitimate to complain about, and built from plain boxes so the triangle
 * count cannot drift with a Three.js version.
 */
export default function (THREE) {
  const g = new THREE.Group();

  const wood = new THREE.MeshStandardMaterial({ color: 0x9a6b3f, roughness: 0.85, metalness: 0 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x4a4a4e, roughness: 0.6, metalness: 0.45 });

  const box = (w, h, d, x, y, z, mat, ry = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    g.add(m);
    return m;
  };

  const S = 0.5;        // half width of the crate
  const H = 1.0;        // total height
  const POST = 0.08;

  // four corner posts
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      box(POST, H, POST, sx * (S - POST / 2), H / 2, sz * (S - POST / 2), wood);
    }
  }

  // planks on all four walls, same treatment each side, so no face is blank
  const PLANKS = 5;
  for (let side = 0; side < 4; side++) {
    const ry = (side * Math.PI) / 2;
    const nx = Math.sin(ry), nz = Math.cos(ry);
    for (let i = 0; i < PLANKS; i++) {
      const y = 0.09 + i * ((H - 0.18) / (PLANKS - 1));
      const m = box(2 * S - POST * 2, 0.11, 0.05, 0, y, 0, wood, ry);
      m.position.set(nx * (S - 0.02), y, nz * (S - 0.02));
    }
    // a diagonal brace, so each face carries the same interior detail
    const br = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.07, 0.035), wood);
    br.position.set(nx * (S - 0.055), H / 2, nz * (S - 0.055));
    br.rotation.y = ry;
    br.rotation.z = Math.PI / 4.6;
    g.add(br);
  }

  // lid boards, and iron straps over the corners
  for (let i = 0; i < 4; i++) {
    box(2 * S, 0.05, 0.22, 0, H + 0.025, -0.33 + i * 0.22, wood);
  }
  for (const sx of [-1, 1]) {
    box(0.05, 0.16, 2 * S - 0.04, sx * (S - 0.06), H - 0.06, 0, iron);
  }
  for (const sz of [-1, 1]) {
    box(2 * S - 0.04, 0.16, 0.05, 0, H - 0.06, sz * (S - 0.06), iron);
  }

  return g;
}
