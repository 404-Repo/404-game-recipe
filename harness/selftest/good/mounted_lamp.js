/**
 * A fixture that SHOULD pass.
 *
 * A wall lamp genuinely has a flat back: it hangs against masonry and nobody
 * ever sees that face. Without the mounts declaration the blank-side check
 * reports it as unmodelled, which is the check crying wolf on correct work, and
 * a newcomer who sees that on their first run learns to ignore the gate.
 *
 * The other fixtures here prove the checks fire. This one proves they do not
 * fire on something that is right, which is the half of a gate that is easy to
 * forget to test.
 */
export default function (THREE) {
  const g = new THREE.Group();
  g.userData.mounts = 'back';

  const iron = new THREE.MeshStandardMaterial({ color: 0x1e2024, roughness: 0.6, metalness: 0.4 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb08d4a, roughness: 0.45, metalness: 0.7 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xf2e6c4, roughness: 0.25 });

  // The mounting plate. Flat by definition, and the reason this asset exists.
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.86, 0.05), iron);
  plate.position.set(0, 1.62, -0.44);
  g.add(plate);

  // A raised moulding, on the front of the plate only. A cast backplate really is
  // made this way, and it keeps the front and side faces comfortably clear of the
  // detail threshold so this fixture passes for the right reason rather than by a
  // hair.
  // Coplanar panels do not help here: same material, same normal, no shading step,
  // so the edge measure reads them as one flat area. Detail has to change the
  // direction a surface faces. These are studs and a raised boss, and they sit on
  // the front of the plate only, so the back stays honestly flat.
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const stud = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.05, 6), brass);
      stud.rotation.x = Math.PI / 2;
      stud.position.set(sx * 0.19, 1.62 + sy * 0.33, -0.39);
      g.add(stud);
    }
  }
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), iron);
  boss.rotation.x = Math.PI / 2;   // +x turns the dome forward; -x buries it through the plate
  boss.position.set(0, 1.62, -0.4);
  g.add(boss);

  // Everything in front of it is modelled properly.
  for (const y of [1.44, 1.8]) {
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 10), brass);
    bolt.rotation.x = Math.PI / 2;
    bolt.position.set(0, y, -0.4);
    g.add(bolt);
  }

  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.62, 10), iron);
  arm.rotation.x = Math.PI / 2;
  arm.position.set(0, 1.84, -0.13);
  g.add(arm);

  const scroll = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.022, 8, 18, Math.PI * 1.3), iron);
  scroll.position.set(0, 1.7, -0.02);
  g.add(scroll);

  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.016, 8, 16, Math.PI), iron);
  hook.rotation.y = Math.PI / 2;
  hook.position.set(0, 1.8, 0.16);
  g.add(hook);

  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.12, 6), iron);
  cap.position.set(0, 1.7, 0.16);
  g.add(cap);

  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.3, 6), glass);
  lantern.position.set(0, 1.5, 0.16);
  g.add(lantern);

  // Corner posts, so the lantern reads as a made object rather than a blob.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.3, 0.022), iron);
    post.position.set(0.115 * Math.sin(a), 1.5, 0.16 + 0.115 * Math.cos(a));
    post.rotation.y = -a;
    g.add(post);
  }

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.07, 6), brass);
  base.position.set(0, 1.32, 0.16);
  g.add(base);

  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), brass);
  finial.position.set(0, 1.28, 0.16);
  g.add(finial);

  // The contract says the lowest point sits at y=0 and the object is centred on
  // x and z, so drop and centre the whole thing once at the end.
  const box = new THREE.Box3().setFromObject(g);
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= box.min.y; m.position.z -= c.z; });
  return g;
}
