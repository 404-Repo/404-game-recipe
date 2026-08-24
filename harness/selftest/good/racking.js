/**
 * A correct asset built the efficient way: one prototype, many instances.
 *
 * Warehouse racking, a stack of pallets, a row of railings. This is the shape of
 * asset whose bounds cannot be measured by walking geometry alone, because the
 * copies exist only in the instance matrices. Measured as its prototype it comes
 * out a fraction of its real size, and then the size check, the base-at-y=0
 * check, the centring check and the camera framing all go wrong at once.
 *
 * It ships with racking.expect.json, so this fixture also proves the stated-size
 * check stays quiet on an asset that is the size it says it is.
 */
export default function (THREE) {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x8a7a3a, roughness: 0.6, metalness: 0.5 });
  steel.name = 'metal';
  const deck = new THREE.MeshStandardMaterial({ color: 0x9a6b3f, roughness: 0.9 });
  deck.name = 'timber';

  // Four uprights, as ordinary meshes.
  for (const x of [-0.55, 0.55]) {
    for (const z of [-0.35, 0.35]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.0, 0.08), steel);
      post.position.set(x, 1.0, z);
      g.add(post);
    }
  }

  // Three shelves, as instances of one prototype. 1.2 x 0.06 x 0.8, at y = 0.6,
  // 1.2 and 1.8, so the whole thing is 2.0 m tall with its base on the floor.
  const shelf = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 0.06, 0.8), deck, 3);
  const m = new THREE.Matrix4();
  [0.6, 1.2, 1.8].forEach((y, i) => { m.makeTranslation(0, y, 0); shelf.setMatrixAt(i, m); });
  shelf.instanceMatrix.needsUpdate = true;
  g.add(shelf);

  // Braces on both long sides, so no face is blank.
  for (const z of [-0.35, 0.35]) {
    for (const y of [0.35, 0.95, 1.55]) {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.05, 0.05), steel);
      brace.position.set(0, y, z);
      brace.rotation.z = z > 0 ? 0.12 : -0.12;
      g.add(brace);
    }
  }
  return g;
}
