# Reference images

Generating an asset from a picture beats generating it from a sentence by a wide margin. It is
the cheapest quality win in this whole process, and it is worth doing even roughly.

## Why

A name is not a description. Asked for "a shop front", a model has to invent everything, and
mostly invents badly. Given a picture, it has proportions, colour, and a parts list.

We measured the text-only version of this. "A shop front" failed outright. Rewriting it as "a
solid one-storey block with a striped awning slab and a shutter recessed into the wall" gave
usable geometry on 14 of 16 attempts. If you have no images at all, that rewriting step is
where your effort goes: describe **form**, not function.

## What makes a good reference

- **One object**, filling the frame, nothing else in shot.
- **Plain background.** White is ideal. Background clutter ends up modelled as part of the
  object.
- **A three-quarter view**, so two sides and the top are visible. A flat elevation gives the
  generator no depth information and you get a relief carving.
- **Even lighting**, no dramatic shadow. Hard shadow reads as geometry.
- **The whole object**, not cropped. Anything out of frame will not exist.

Note the foreshortening trap in [traps.md](traps.md): a three-quarter view compresses the base
of a round object, and reading height against apparent width will make it too tall.

## The part people skip

**Use one consistent style across the whole set.**

Ten assets each generated in their own style give you ten fine objects and one incoherent game.
Consistency of palette, level of stylisation, material feel and lighting is most of what people
mean when they say a game looks art-directed. It matters more than any individual asset.

The practical trick is to lock the style once and then reuse it: fix a single prompt suffix,
keep the same seed or the same style reference image, and generate the entire set in one pass
rather than adding assets one at a time over a week. That single decision does more for how a
finished game reads than any individual asset does.

## Where to get them

Anything that makes images will do. A few options in rough order of effort:

- **An image model you already have access to.** Fine. Do the style-locking above by hand.
- **Photographs.** They work well, especially for vehicles and street furniture. Cut the
  background out.
- **[Atlas](https://atlas.design).** This is what we use, and what produced the references in
  `examples/concepts/`. It is a paid product, and the reason we reach for it is the
  style-locking: it will hold one art direction across a whole set, which is the tedious part
  to do by hand. Not required for anything in this repo.

## What not to do

Do not skip straight to text because images are inconvenient. It is the largest single quality
difference in the pipeline, and no amount of prompt effort downstream recovers it.
