/**
 * A correct asset WITH MOVING PARTS, for the loader test.
 *
 * A crate whose lid opens. It names its moving part on userData, which is the
 * convention for anything articulated, and it is the thing the default merge
 * throws away.
 */
export default function (THREE) {
  const g = new THREE.Group();
  const timber = new THREE.MeshStandardMaterial({ color: 0x9a6b3f, roughness: 0.9 });
  timber.name = 'timber';
  const iron = new THREE.MeshStandardMaterial({ color: 0x4a4a4e, roughness: 0.6, metalness: 0.4 });
  iron.name = 'metal';

  const box = (w, h, d, x, y, z, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return m;
  };

  // body: four walls and a floor, so it is not a decorated cube
  g.add(box(0.6, 0.04, 0.44, 0, 0.02, 0, timber));
  g.add(box(0.6, 0.36, 0.04, 0, 0.2, 0.20, timber));
  g.add(box(0.6, 0.36, 0.04, 0, 0.2, -0.20, timber));
  g.add(box(0.04, 0.36, 0.44, 0.28, 0.2, 0, timber));
  g.add(box(0.04, 0.36, 0.44, -0.28, 0.2, 0, timber));
  for (const x of [-0.28, 0.28]) for (const z of [-0.20, 0.20]) g.add(box(0.05, 0.40, 0.05, x, 0.2, z, timber));

  // the lid, pivoted at its hinge rather than at its own centre, which is what
  // lets it swing instead of tearing itself off
  const lid = new THREE.Group();
  lid.position.set(0, 0.4, -0.22);
  const panel = box(0.62, 0.04, 0.46, 0, 0.02, 0.23, timber);
  lid.add(panel);
  lid.add(box(0.62, 0.03, 0.05, 0, 0.045, 0.44, iron));
  g.add(lid);
  for (const x of [-0.18, 0.18]) g.add(box(0.08, 0.03, 0.06, x, 0.4, -0.21, iron));

  g.userData.parts = { lid };
  return g;
}
