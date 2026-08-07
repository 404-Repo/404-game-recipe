/**
 * FIXTURE, deliberately broken. Do not copy this.
 *
 * A building modelled only on the side the reference image showed. Detailed
 * from +Z, a featureless slab from every other direction.
 *
 * This is the single most common failure of image-to-3D generation and the one
 * a hero screenshot will never reveal, because the hero screenshot is taken
 * from the good side. verify.mjs must flag the back face.
 */
export default function (THREE) {
  const g = new THREE.Group();
  const wall = new THREE.MeshStandardMaterial({ color: 0xd8cdb4, roughness: 0.9 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x8f7f66, roughness: 0.8 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x2e4a52, roughness: 0.3 });

  const W = 8, H = 9, D = 7;
  const core = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), wall);
  core.position.y = H / 2;
  g.add(core);

  // Everything below is applied to +Z only, which is the bug.
  for (let floor = 0; floor < 3; floor++) {
    const y = 1.6 + floor * 2.7;
    for (let i = -1; i <= 1; i++) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.8, 0.16), glass);
      win.position.set(i * 2.4, y, D / 2 + 0.02);
      g.add(win);
      const sill = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, 0.4), trim);
      sill.position.set(i * 2.4, y - 1.0, D / 2 + 0.12);
      g.add(sill);
      const lint = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.22, 0.35), trim);
      lint.position.set(i * 2.4, y + 1.02, D / 2 + 0.1);
      g.add(lint);
    }
    const band = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.22, 0.3), trim);
    band.position.set(0, y + 1.5, D / 2 + 0.05);
    g.add(band);
  }
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 0.2), trim);
  door.position.set(0, 1.2, D / 2 + 0.03);
  g.add(door);

  const cornice = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.5, D + 0.6), trim);
  cornice.position.y = H + 0.25;
  g.add(cornice);
  return g;
}
