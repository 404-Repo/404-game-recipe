# Traps

Bugs specific to this domain that produce **wrong output silently**. Nothing throws, nothing
warns, and the code reads correctly. You will not catch these by testing the way you normally
test, so read the list before you start.

---

## InstancedMesh collapses to one copy

An `InstancedMesh` holds one prototype geometry plus a matrix per copy. It also reports
`isMesh === true`. So any loop that walks a scene, sees `isMesh`, and clones `o.geometry` keeps
exactly one instance at the origin and silently deletes every other one.

A barrel built from instanced staves and hoops arrives as a smooth egg. We shipped four builds
with this bug and spent a week blaming the asset generator before finding it in our own loader.
The assets had been correct the entire time.

Expand instances explicitly: instance matrix first, then the mesh's own world matrix.

```js
for (let i = 0; i < o.count; i++) {
  o.getMatrixAt(i, m);
  const g = o.geometry.clone();
  g.applyMatrix4(m);              // instance-local
  g.applyMatrix4(o.matrixWorld);  // then the mesh's own transform
}
```

`harness/assetlib.js` already does this. Use it rather than writing your own.

Per-instance colours set with `setColorAt` need baking to a vertex colour attribute at the same
time, or every copy comes out the material's base colour.

---

## Merging drops a colour attribute and everything goes black

`mergeGeometries` refuses geometries whose attribute sets differ, and quietly reduces to the
common set when they nearly match. Bucket some geometry that carries `color` together with
geometry that does not, merge, and the colour is dropped. A material with `vertexColors: true`
then renders the whole thing black.

Bucket by material value **and** by the geometry's attribute signature.

---

## Decimation shreds exactly what you wanted

Vertex-cluster decimation destroys thin and lattice geometry: railings, ladders, slats, window
mullions, anything whose form is thin members with space between them. The triangle count drops
beautifully and the asset stops being recognisable.

If you find yourself reaching for a decimator, reduce segment counts at generation time
instead. And if you report a performance win, check first whether decimation or a resolution
drop paid for it, and say so, because a number that improved because quality fell is not a win.

---

## Box3.setFromObject is already axis-aligned

It returns a world-space **axis-aligned** box, so any rotation is already folded into the
extents. Storing the object's rotation alongside it and rotating again double-counts, which
inflates every angled prop into a square large enough to block the road beside it.

Either use the AABB as-is with no rotation, or compute the oriented box yourself. Not both.

---

## A positive rotation.x tilts the front down

`rotation.x = a` maps local `+z` to `(0, -sin a, cos a)`. A positive angle pitches the front
**down**, not up. Getting the sign backwards on a windscreen or a roof panel launches it off
the vehicle, and the code reads perfectly.

This is the single most common geometry error we see, and rendering the object is the only way
to catch it.

---

## Warping an ExtrudeGeometry cap face bows it

`ExtrudeGeometry` triangulates its cap faces with earcut, across the whole profile. Apply a
coordinate-dependent scale, tapering a shape along its own axis, and the transform interpolates
linearly over long triangles and bows the surface outward. A car cabin built this way swallowed
its own side glass.

Box faces are single quads and are safe. Extruded caps are not. Use separate masses instead.

---

## Foreshortening lies about proportions

Reference images are usually three-quarter views. A round object's base ellipse is foreshortened,
so reading height against apparent width gets the proportions wrong, typically making the object
too tall. Check the object from a pure side view before trusting its proportions.

---

## A screenshot of a parked car

If your harness does not press the buttons, it is testing a wallpaper. Ours once reported a
clean pass on a stationary vehicle with a score of zero and a frame rate measured on a static
scene.

Drive the game, and assert that the player actually moved.

---

## Headless frame rates are software rendering

Headless Chrome usually falls back to SwiftShader, a CPU rasteriser. Frame rates measured there
run several times below the same scene on a real GPU. Treat them as a smoke test for "does it
run", never as a performance verdict, or you will spend a day optimising something that was
never slow. `harness/playtest.mjs` detects this and says so.

---

## Absolute asset paths break on a project subpath

If you deploy to GitHub Pages under `/<repo>/`, an absolute path like `/assets/car.js` resolves
to the domain root and 404s. The page loads, the game is dead. Use relative paths, and test by
serving from a subpath locally before you deploy.
