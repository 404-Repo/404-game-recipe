# A game that came out of this repo

**[Play it](https://ben-atlas.github.io/warehouse-fps/)** &nbsp;·&nbsp; `warehouse-fps/` is the
whole thing, 708 KB, no build step. Serve the folder and it runs.

```bash
node harness/serve.mjs example/warehouse-fps
```

A first-person shooter in an industrial warehouse. Keyboard and mouse, or touch on a phone.

## What it is, and what it is not

**It is** a sample of the output: 33 objects, none modelled by hand, none downloaded, no
mesh files and no image files anywhere in it. Every crate, catwalk, roller door, forklift, the
weapon in your hands and the soldiers in front of you is a JavaScript module built from Three.js
primitives, chosen from three independent candidates by looking at a five-sided render. 99
candidates were written and 66 thrown away.

**It is not a template.** [GAME.md](../GAME.md) says that how you break the problem up and what
your architecture is are yours, and it means it. This is one agent's answer, not the answer, and
copying its structure would be the opposite of the point. Read it for evidence that the method
produces something real, not for a scaffold.

## Numbers, from the run

| | |
|---|---|
| Objects | 33, all generated as code |
| Candidates written | 99, three per object |
| Assets kept | 33 |
| Gate | 33/33 clean |
| Draw calls | 594 desktop, 696 phone, against a 900 budget |
| Triangles | 1.37M against a 1.7M budget |
| Frame rate | 60 on both |
| Total size | 708 KB |
| Critic rounds | 3 |

Reference images for the objects were generated with an image model. The geometry was not.
