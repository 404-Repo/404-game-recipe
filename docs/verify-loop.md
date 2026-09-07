# The verify loop

Two tools, one for the assets and one for the game. Both end by telling you to go and look at a
picture, which is the part that actually catches things. Everything below is read off the code in
`harness/`; where the two disagree, the code is right and this file is stale.

---

## verify.mjs, for assets

```
node harness/verify.mjs <dir-of-assets>              # 320 px views
node harness/verify.mjs <dir-of-assets> --size=560   # bigger, when the choice is close
```

For every `.js` in the directory it runs `node --check`, loads the module in headless Chrome
through `harness/render.html`, renders it from four sides plus a three-quarter view under one
fixed camera and light, measures it, and writes `_verify/<name>.png` per asset, `_verify/sheet.png`
for the set and `_verify/report.json`. It exits non-zero if any asset fails, so an agent can loop
on it. It needs the network, because the render page loads Three.js from a CDN.

It forces SwiftShader on purpose: these are still frames of a fixed scene, a deterministic software
rasteriser gives the same pixels on every machine, and speed does not matter. That flag is wrong in
a gate that measures play; see [gates.md](gates.md).

**What it checks**

| check | limit | why |
|---|---|---|
| parses | `node --check` | a truncated generation looks like nothing until it fails to load |
| loads and returns an `Object3D` | | a wrong or missing export |
| stated size, if `<name>.expect.json` sits beside it | width, height, depth within 25 percent, or the file's own `tolerance` | the only way the gate can know the size the brief asked for |
| plausible size | largest dimension 0.05 to 300 m | unit confusion, a 400 m dumpster |
| triangle count | 150 to 60,000 | a placeholder, or a runaway lathe |
| base at `y = 0` | within 2 percent of height or 1 cm, whichever is larger | placement by ground coordinate depends on it |
| centred on x and z | within 5 percent of the footprint | same |
| **no blank sides** | a judged side with under 35 percent of the busiest side's edge density | the important one, below |
| no empty sides | any side under 0.5 percent coverage | the object is missing from that view |

**The blank-side check.** Four axis-aligned views, comparing interior edge density. A face the
generator never modelled is flat and nearly edge-free, so it stands out against the sides that
were modelled. A side is only judged when it fills at least a quarter of the widest silhouette,
because a thin sign seen edge-on is not evidence either way. An asset can declare a flat face
with `group.userData.mounts = 'back'` (or `'front'`, `'left'`, `'right'`, or an array): that face
is exempt from the density comparison and still has to be non-empty, and every exemption is
printed on the asset's line so a pack that has opted out everywhere is visible at a glance.

This is the failure that matters, because it is invisible in normal review. A generator working
from one reference image produces something genuinely good from the front and a featureless box
from behind, and every screenshot anyone takes is from the good side. We shipped a building
detailed on one elevation and blank on the other three, and only found it when a player drove
round the back.

**What it cannot check.** Whether the asset looks like what you asked for. Nothing automated can.
That is why the tool prints the path to the sheet and tells you to look at it, and why you choose
between candidates by eye rather than by any number in the report.

---

## playtest.mjs, for the game

```
node harness/playtest.mjs <dir-with-index.html>
```

It serves the game folder, loads it in headless Chrome on the real GPU where there is one, waits
for `window.__READY__`, presses the real `#startb` button (falling back to `window.__START__()`
and saying so, since a hook cannot prove the button works), and drives a six leg route with real
key events: ArrowUp for 50 m, ArrowUp and ArrowRight for 18 m, ArrowUp for 45 m, ArrowUp and
ArrowLeft for 18 m, ArrowUp for 45 m, ArrowUp and ArrowRight for 20 m. 196 m in all.

**Legs are measured in metres covered**, not in milliseconds and not in frames. Every 50 ms it
reads `__GAME__.pos` and adds the distance since the last reading, so a leg is path length, and
the leg ends when its metres are covered. A wall-clock hold under-drives a slow machine; a frame
count under-drives a fast one; we shipped both and each accused a working game of ignoring its
controls. A leg that cannot cover its distance in 25 s (120 s under software rendering) counts as
stalled. If `__GAME__.over` turns true the run stops there and reports the death, with how many
legs ran before it, instead of blaming the legs that never started.

**The filmstrip** is one screenshot at the end of each leg, `_playtest/f0.png` onward, assembled
into `_playtest/filmstrip.png`. The tool checks the strip actually contains its frames, because
for a while it was a screenshot of six broken image icons and nobody noticed. Problems that only
exist in motion, geometry popping in, props sunk into the road, a camera that clips the player at
speed, are invisible in one posed still and obvious across six. Judge the filmstrip, never a
still.

**It fails the run**, exit 1, when the player died, a leg stalled, `pos` is missing, a file was
served from outside the game folder, a request 404ed, there were console errors, peak draw calls
exceed 900, peak triangles exceed 1.5M, or on a real GPU the frame rate dipped under 24. Under
software rendering the frame rate is printed and captioned, not gated, because that number is not
a verdict. Cost is, and cost is the same on every machine.

**Hook it up to your game** with the contract in [GAME.md](../GAME.md), and a start button with
the id `startb`:

```js
window.__READY__ = true;               // loaded and startable
window.__START__ = () => { ... };      // begin play
window.__GAME__  = {                   // refreshed every frame
  pos: [x, z],                         // where the player is, in metres
  fps,                                 // from REAL elapsed time, never a clamped delta
  speed, score, over,
  draws: renderer.info.render.calls,
  tris: renderer.info.render.triangles,
};
```

Match those names and the harness works on your game with no changes. Any other numeric field on
`__GAME__` is printed with the summary, so the telemetry a gate of your own needs
([gates.md](gates.md)) shows up without touching this file. `fps` must come from real elapsed
time; see the trap about that in [traps.md](traps.md).

---

## Proving the gate works

```
npm run selftest
```

`harness/selftest/run.mjs` runs the verifier against fixtures broken in known ways, a building
blank at the back, a crate floating off the ground and off centre, an asset with a runaway
triangle count, and asserts each one is caught. It then runs it on **correct** assets copied to a
directory **outside this repo** and asserts they pass, because a gate can be wrong in both
directions: the verifier used to serve only the repo root, so every asset outside it failed with
"Failed to fetch dynamically imported module", and a gate that calls a good pack broken sends you
off to fix a generator that was never wrong. It also checks that a declared mounting face is
exempt and the same asset undeclared is flagged, that an instanced asset measures its full size,
and that a stated size fires when wrong and stays quiet when right. `harness/selftest/loader.mjs`
proves the loader merges by default and keeps parts and `userData` when asked.

Run it once after cloning. A check nobody has seen fail is not a check, and a gate that passes
everything is worse than no gate, because it hands you confidence you have not earned.
