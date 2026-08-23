# Procedural surfaces

Assets in this repo are geometry and flat colours. That is most of what makes them
cheap, and it is also why they read as painted cardboard next to a scanned mesh: a
real surface varies in colour, in roughness and in normal at the same time, and a
flat `MeshStandardMaterial` varies in none of them.

`harness/surfaces.js` generates all three maps into a canvas at load time from a
seed. Nothing is downloaded, nothing is licensed, and the same seed produces the
same surface on every machine, so the zero-file rule in the asset contract holds
exactly as before.

## Using it

```js
const crate = await ASSET('/assets/produce_crate_stack.js', { surfaces: true });
```

or once, for a whole game:

```js
import { setSurfaceDefaults } from '/harness/surfaces.js';
setSurfaceDefaults({ on: true });
```

Surfaces are applied to the instance, not to the cached prototype, so a game can
hold a textured and an untextured copy of the same asset.

## How a surface is chosen

Each material is classified into one of eight recipes: `plaster`, `stone`,
`timber`, `tile`, `metal`, `fabric`, `foliage`, `ground`.

**An asset can simply say which it wants.** Name the material after a recipe and
the classifier uses it:

```js
const wall = new THREE.MeshStandardMaterial({ color: 0xbdb6a8, roughness: 0.9 });
wall.name = 'stone';
```

That is the preferred route and it costs the generator one string. Where a
material has no name, the recipe is inferred from colour, roughness and
metalness, which is right most of the time and wrong often enough to be worth
overriding by hand on anything important.

Glass and near-black trim are deliberately left alone. `applySurfaces` returns
`{ textured, left, materials }` so a silent no-op is visible rather than
mysterious.

## Two traps, both paid for already

**Classify in sRGB, not in the working space.** Three.js keeps material colours
linear, so reading `material.color` directly gives values far more saturated and
far darker than the hex an author wrote. Classified that way, every warm grey
stone comes back as terracotta and half a wall wears roof tiles. `classify()`
converts before it decides.

**Put texel density in the UVs, not in `texture.repeat`.** A shared material on a
six metre wall and a twenty centimetre sill needs a different density on each, or
the small part looks like a different substance. Doing that through `repeat` means
a distinct material per size, and `assetlib` merges by material *values*: the
sample house went from 33 draw calls to 144. Scaling the UV attribute instead lets
every mesh share one material per recipe and colour, and merging behaves exactly
as it did before. Geometry is cloned before its UVs are touched, because generated
assets reuse geometry across parts of different sizes.

## What it costs

Measured on the sample set: eight recipes generate in about 56 ms on first use and
are cached after that, roughly 25 MB of texture on the GPU. Triangle counts are
unchanged, because none of this is geometry.

Draw calls after `bakeStatic` are unchanged as well, and that is a property worth
protecting rather than assuming:

```
stone_arch_tunnel    1013 meshes textured, 37 materials   draws 38 -> 38
oldtown_house_wide   1517 meshes textured, 30 materials   draws 33 -> 33
oil_drum               25 meshes textured, 20 materials   draws 21 -> 21
produce_crate_stack   132 meshes textured, 24 materials   draws 25 -> 25
```

## Seeing it

```
node harness/surface-compare.mjs <dir-or-file>
```

Renders each asset twice under one rig, flat on the left and textured on the
right, into `harness/_surfaces/`, and prints the draw-call count both ways. It
exits non-zero if draw calls more than double, so the merge behaviour above stays
true rather than becoming a comment that used to be true.
