# The verify loop

Two tools. Both of them end by telling you to go and look at a picture, which is the part that
actually catches things.

---

## verify.mjs, for assets

```
node harness/verify.mjs <dir-of-assets>
```

For every `.js` in the directory it parses the file, loads it in a real browser, renders it from
four sides under fixed camera and lighting, measures it, and writes `_verify/sheet.png` plus a
`report.json`. It exits non-zero if anything fails, so you can loop on it.

**What it checks**

| check | why |
|---|---|
| parses | a truncated generation is common and looks like nothing until it fails to load |
| loads and returns an `Object3D` | catches a wrong or missing export |
| non-degenerate bounding box | catches an object that built nothing |
| plausible real-world size | catches unit confusion, a 400m dumpster |
| base at `y = 0` | placement by ground coordinate depends on it |
| centred on x and z | same |
| triangle count in band | catches both a placeholder and a runaway |
| **no blank sides** | the important one, below |

**The blank-side check**

Four views, one per side, comparing interior edge density. A face the generator never modelled
is flat and almost edge-free, so it stands out against the sides that were modelled.

This is the failure that matters, because it is invisible in normal review. A generator working
from one reference image produces something genuinely good from the front and a featureless box
from behind, and every screenshot anyone takes is from the good side. We shipped a building
detailed on one elevation and blank on the other three, and only found it when a player drove
round the back.

**What it cannot check**

Whether the asset looks like what you asked for. Nothing automated can. That is why the tool
prints the path to the sheet and tells you to look at it, and why you should choose between
candidates by eye rather than by any number in the report.

---

## playtest.mjs, for the game

```
node harness/playtest.mjs <dir-with-index.html>
```

It loads the game, starts it, drives it along a route with real key events, and captures six
frames spread through the run into `_playtest/filmstrip.png`.

**It drives.** A harness that opens a game and screenshots it is testing a wallpaper.

**It shoots six frames, in motion.** Problems that only exist in motion, geometry popping in,
props sunk into the road, a camera that clips the player at speed, a pickup nobody can see, are
invisible in one posed still and obvious across six. The beacon columns on the pickups in the
example game exist because a filmstrip showed the drop counter never moving.

**Hook it up to your game** by setting three globals:

```js
window.__READY__ = true;               // the game has loaded and can be started
window.__START__ = () => { ... };      // begin play
window.__GAME__ = {                    // refreshed every frame
  fps,                                 // from REAL elapsed time, never a clamped dt
  frame,                               // frames rendered since boot
  speed, pos: [x, z], score, over,
  draws: renderer.info.render.calls,
  tris: renderer.info.render.triangles,
};
```

Match those names and the harness works on your game with no changes.

`frame` matters more than it looks. The harness holds each input for a number of **frames**, not
for a wall-clock duration, because simulated time is frames multiplied by the clamped delta. On a
slow or loaded machine a fixed wall-clock hold advances the game by a fraction of what the
harness believes, and it then reports that your car would not move. `fps` must likewise come from
real elapsed time; see the trap about that in [traps.md](traps.md).

**It fails the run** if the player barely moved, if there were console errors, or if the build is
over its **draw call or triangle budget**. It does not fail on frame rate under software
rendering, because that number is not a verdict. Cost is, and cost is the same on every machine.

---

## Proving the gate works

```
node harness/selftest/run.mjs
```

Runs the verifier against fixtures that are broken in known ways, a building blank on three
sides, a crate floating off the ground, a shrub costing 436,000 triangles, and asserts each one
is caught.

It then runs the verifier on a **correct** asset from a directory **outside this repo**, and
asserts it passes. That half is there because a gate can be wrong in both directions. The
verifier used to serve only the repo root, so an asset directory anywhere else produced a module
URL the server refused and every asset in it failed with "Failed to fetch dynamically imported
module". The files were fine. A gate that calls a good pack broken, in the vocabulary of a
broken asset, sends you off to fix a generator that was never wrong, and nothing catches it
unless something explicitly checks that good input still passes.

Run it once after cloning. A check nobody has seen fail is not a check, and a gate that passes
everything is worse than no gate, because it hands you confidence you have not earned.
