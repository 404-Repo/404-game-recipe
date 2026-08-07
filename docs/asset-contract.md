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

**Placement**

- Real-world scale, in **metres**. A dumpster is about 2m long, a four-storey building about
  13m tall.
- The lowest point sits at **y = 0**, and the object is **centred on x and z**. A placement
  coordinate then means "put it here on the ground" rather than "put its arbitrary origin
  here", which is the difference between a level that assembles and one that hovers.
- The front faces **+Z**.

**Quality**

- Recognisable **from every angle**, not just the one the reference image showed. This is the
  most common failure and the verifier tests for it specifically.
- Correct proportions and silhouette. Silhouette is what reads at distance in a game frame.
- Model the structure. If the reference has wheels, panels, railings, a roof or fittings, build
  them, rather than approximating the whole thing as a decorated box.

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
