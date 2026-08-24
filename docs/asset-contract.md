# The asset contract

Every asset is a JavaScript module exporting one function of `THREE` that returns a `Group`.

```js
export default function (THREE) {
  const g = new THREE.Group();
  // ... build the object ...
  return g;
}
```

That is the whole interface. The loader, the verifier and any game in this repo depend on it,
so it is the one part you should not change.

## Rules

**Structure**

- Exactly one module per asset, one default export, a function taking the `THREE` namespace.
- It returns a single `THREE.Group`.
- No imports, no network access, no `eval`, no timers, no animation loop, no Node APIs. It is
  loaded by dynamic `import()` in a browser.

**Geometry**

- Built from Three.js primitives: `Box`, `Cylinder`, `Sphere`, `Cone`, `Torus`, `Plane`,
  `Lathe`, `Extrude`, `Shape`.
- `MeshStandardMaterial`, with explicit colours per part. No textures, no external files, no
  image loading.
- Avoid `vertexColors` unless you are baking instance colours deliberately. The loader handles
  that case; setting it by hand is how assets come out black.
- Anything open-ended needs `side: THREE.DoubleSide`. An open cylinder or a lathe is the natural
  way to build a basket wall, a crate liner, a lantern or a pot, and every one of them is a hole
  when you can see its inside.
- The permitted geometry list above is a starting point, not a fence. `Capsule`,
  `ExtrudeGeometry` with an `extrudePath`, and writing to `geometry.attributes.position` after
  construction are all fine and all in use; the best asset in one set was a hand-built
  `BufferGeometry`. What is forbidden is imports, files and the network, not techniques.

**Placement**

- The six lines that satisfy the two rules below are the same in every asset anyone writes, and
  the obvious shortcut is wrong, so here they are. `Box3.setFromObject` unions each mesh's own
  bounding box after transform, which measures the box of a rotated part rather than the part,
  so measure vertices:

  ```js
  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= box.min.y; m.position.z -= c.z; });
  ```

- Real-world scale, in **metres**. A dumpster is about 2m long, a four-storey building about
  13m tall.
- The lowest point sits at **y = 0**, and the object is **centred on x and z**. A placement
  coordinate then means "put it here on the ground" rather than "put its arbitrary origin
  here", which is the difference between a level that assembles and one that hovers.
- The front faces **+Z**.

**Quality**

- Recognisable **from every angle**, not just the one the reference image showed. This is the
  most common failure and the verifier tests for it specifically.
- If a face of the object is legitimately flat, say so, and the verifier will stop reporting it
  as unmodelled:

  ```js
  g.userData.mounts = 'back';   // 'back' | 'front' | 'left' | 'right', or an array
  ```

  Two cases qualify. A face that mounts flush against something: a wall lamp, an awning, a
  hanging sign. And a face that IS a flat thing: the panel of a chalkboard, a poster, a
  sandwich board. Both are correct work that the check would otherwise report as missing.

  Do not use it to excuse a face you did not model. That check is the most useful one in the
  gate, a set of assets that all opt out of it tells you nothing, and every exemption is printed
  on the asset's line in the report precisely so that a set which has quietly opted out
  everywhere is obvious rather than buried in twenty modules.
- Correct proportions and silhouette. Silhouette is what reads at distance in a game frame.
- Model the structure. If the reference has wheels, panels, railings, a roof or fittings, build
  them, rather than approximating the whole thing as a decorated box.

## Surfaces

Materials in an asset are flat colours, and that is correct: surfaces are applied
at load time by `harness/surfaces.js`, over the built asset, so modules stay
import-free exactly as above.

An asset can declare what a material is made of by naming it after a recipe,
which beats any amount of inference from colour:

```js
const wall = new THREE.MeshStandardMaterial({ color: 0xbdb6a8, roughness: 0.9 });
wall.name = 'stone';   // plaster | stone | timber | tile | metal | fabric | foliage | ground
```

Naming is optional and nothing breaks without it. See [surfaces.md](surfaces.md).

## Anything that moves

`ASSET()` merges an asset by material as it loads, which is what makes a two hundred prop street
affordable. It is also destructive: it welds every part into one mesh per material and discards
the asset's `userData` along with the nodes it was attached to. A character loaded that way
renders perfectly and can never move a limb, and no still frame will show you.

For anything with moving parts, ask for the tree:

```js
const person = await ASSET('assets/person.js', { keepHierarchy: true });
person.userData.joints.leftUpperLeg.rotation.x = -0.4;
```

Name the moving parts on `userData` and give each one a pivot at the joint rather than at the
limb's centre, by putting the geometry as a child offset inside a parent placed at the joint. A
thigh that rotates about its own middle tears itself apart the moment it walks, and a still
render will not show that either.

## Saying how big it should be

The gate's only size test is that an object is between 5 cm and 300 m, which passed a 9.4 m
facade written to a 6 m brief. If you know the size, say so, in a file beside the asset:

```json
// shop_front.expect.json
{ "width": 6.0, "height": 7.0, "tolerance": 0.25 }
```

Any of `width`, `height`, `depth` and `tolerance` (a fraction, default 0.25). An asset that is
right in every respect except that it does not belong next to anything is the last silent
failure left in this pipeline.

## Cost

There is no hard triangle limit, but there is a sane band, and `verify.mjs` warns outside
roughly 150 to 60,000.

Treat the top of that as a real budget. A generated planter we measured came in at 265,265
triangles, against 3,880 for the same object built sensibly. That is 68 times the cost for a
worse-looking result, and thirty of them in a scene costs more than everything else combined.
It happens when every leaf becomes its own high-segment sphere, or a `LatheGeometry` gets 64
radial segments it does not need.

If an asset is heavy, the fix is almost always segment counts, not decimation. **Do not run a
decimator over these.** It shreds thin and lattice geometry, which is exactly the detail that
made the asset worth keeping.

## Naming

One file per asset, named for what it is: `police_cruiser.js`, `rooftop_water_tank.js`. The
name is what a level file refers to and what you will read in a hundred coordinates, so make
it specific.
