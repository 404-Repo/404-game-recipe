/**
 * FIXTURE, deliberately broken. Do not copy this.
 *
 * A shrub in a pot that looks correct and costs a quarter of a million
 * triangles, because every leaf is its own high-segment sphere.
 *
 * This is the expensive failure: it passes every visual check, so it ships, and
 * then thirty of them in a scene cost more than the rest of the game. We
 * measured a real generated planter at 265,265 triangles against 3,880 for the
 * same object built sensibly, which is 68 times the cost for a worse result.
 * verify.mjs must flag the triangle count.
 */
export default function (THREE) {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0xded6c4, roughness: 0.95 });
  const leaf = new THREE.MeshStandardMaterial({ color: 0x4e7a34, roughness: 0.85 });

  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.7, 4), stone);
  pot.rotation.y = Math.PI / 4;
  pot.position.y = 0.35;
  g.add(pot);

  // The bug: 220 leaves at 32x32 segments each.
  for (let i = 0; i < 220; i++) {
    const a = i * 2.399963;
    const r = 0.42 * Math.sqrt((i % 60) / 60);
    const blob = new THREE.Mesh(new THREE.SphereGeometry(0.1, 32, 32), leaf);
    blob.position.set(Math.cos(a) * r, 0.78 + Math.sin(i * 1.7) * 0.22 + 0.2, Math.sin(a) * r);
    g.add(blob);
  }
  return g;
}
