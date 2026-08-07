# Generating the assets

Two steps per object: a reference image, then geometry from it. Do not skip the first, and do
not skip the looking at the end.

---

## 1. The reference image

Generating from a picture beats generating from a sentence by a wide margin, and it is the
cheapest quality win in the whole process.

A name is not a description. Asked for "a shop front" a model has to invent everything and
mostly invents badly. Measured: "a shop front" failed outright, while "a solid one-storey block
with a striped awning slab and a shutter recessed into the wall" gave usable geometry on 14 of
16 attempts. If you write descriptions rather than generate images, that is where the effort
goes: describe **form**, not function.

**Use one style for the whole set.** Ten objects each generated in their own style give you ten
fine objects and one incoherent game. Fix a single style sentence, reuse it for every object,
and generate the set in one pass. Consistency of palette, stylisation and material feel is most
of what people mean when a game looks art-directed.

### With Atlas

`concept.py` calls [Atlas](https://atlas.design), which is what we use. It pins the art style
across the set and returns each object cut out on white.

```bash
export ATLAS_API_KEY=atk_...
python3 gen/concept.py spec.json -o concepts/
```

```json
{
  "style": "one art-style sentence, identical for every object in the pack",
  "theme": "the place these objects belong to",
  "objects": [
    {"name": "hero_coupe", "desc": "a two-door muscle coupe, long bonnet, chrome bumper", "seed": 42}
  ]
}
```

Roughly 80 seconds per image, so generate in parallel batches.

### Without Atlas

Anything that makes images works. Do the style-locking by hand: one prompt suffix, one seed or
one style reference, the whole set in one sitting. Photographs work well for vehicles and
street furniture; cut the background out.

What makes a usable reference: one object filling the frame, plain background, a three-quarter
view so two sides and the top are visible, even lighting, nothing cropped.

More detail in [../docs/concept-images.md](../docs/concept-images.md).

---

## 2. Image to Three.js

For each reference image, **three independent attempts**. Independent means different
construction strategies, not three edits of one file:

- one assembled from primitives: Box, Cylinder, Sphere, Cone, Torus
- one built from profiles: `ExtrudeGeometry` or `LatheGeometry` swept along an axis
- one with a different part breakdown, or a different reading of the reference

Write each as a module per [../docs/asset-contract.md](../docs/asset-contract.md). Then:

```bash
node --check <file>                # every candidate
node harness/verify.mjs <dir>      # renders all of them from four sides
```

**Look at `_verify/sheet.png` and choose by eye.** The verifier tells you what is broken. It
cannot tell you what is good.

If all three attempts are poor, the reference or the description is the problem rather than the
generation. Fix that and go again.

---

## Why three attempts

Measured on ten objects: one arm got a single attempt, the other got three attempts plus a
syntax check, a four-sided render and a choice between them. Same model, same references, same
output contract. The second arm won on essentially every object, and the difference was
entirely the loop.

Two of the errors it caught in one run, neither of which is a syntax error and neither of which
survives being looked at: an inverted rotation sign that flung a car's windscreen off into
space, and a water tank built 20% too tall because the reference photograph foreshortened its
base.
