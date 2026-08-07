/**
 * FIXTURE, deliberately broken. Do not copy this.
 *
 * A perfectly good crate that does not sit on the ground: its base is at y=1.8
 * instead of y=0, and it is off-centre on x and z.
 *
 * In isolation it renders fine, which is why this survives review. It only goes
 * wrong once a game places it by ground coordinate and it hovers, or sinks.
 * verify.mjs must flag both the ground offset and the centring.
 */
export default function (THREE) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x9a6b3f, roughness: 0.85 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x40444a, roughness: 0.6, metalness: 0.4 });

  const S = 1.4;
  const body = new THREE.Mesh(new THREE.BoxGeometry(S, S, S), wood);
  g.add(body);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, S + 0.04, 0.16), iron);
      post.position.set(sx * S / 2, 0, sz * S / 2);
      g.add(post);
    }
  }
  for (const sy of [-1, 1]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(S + 0.06, 0.12, S + 0.06), iron);
    band.position.y = sy * S * 0.32;
    g.add(band);
  }
  for (let i = 0; i < 4; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(S * 0.9, 0.1, 0.05), iron);
    slat.position.set(0, -S / 2 + 0.25 + i * 0.3, S / 2 + 0.02);
    g.add(slat);
  }

  // The bug: lifted clear of the ground and shoved sideways.
  g.position.set(0.9, 1.8 + S / 2, -0.7);
  return g;
}
