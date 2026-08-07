# Build the game

You are an agent. Someone has pointed you at this repository and given you a game to build.
This file is the whole method. Follow it in order.

You will be doing two things that most agents skip, and they are the two things that decide
whether the result is any good:

- **You will generate your own 3D assets from reference images**, not from primitives you
  invent, and you will verify each one from four sides before trusting it.
- **You will loop.** A harsh critic compares your work against a real reference image, blind,
  and if it loses you go again.

---

## Step 0. Decide the game

Write down, in a file, before any code:

- what the player does, what a good run looks like, what the failure state is
- **the art direction in one sentence**, committed to now and not revisited: place, time of
  day, weather, palette, level of stylisation
- what should be in frame at any given moment

If the request was vague, make it concrete and say what you chose.

Time of day is worth thinking about rather than defaulting. Night and dusk let lamps, lit
windows and headlights do the work that texture maps would otherwise have to do, which is the
cheapest route to a frame that looks expensive.

---

## Step 1. Make the reference frames you will be judged against

You cannot run a blind comparison without something to compare to. Generate three or four
frames of what your game **should** look like: the same places, the same time of day, at the
quality you are aiming for. See [docs/concept-images.md](docs/concept-images.md).

Keep them. Step 5 uses them and they are the bar for the whole build.

---

## Step 2. List the assets

Enumerate every distinct object the game needs. Be specific: `police_cruiser`, not `vehicle`.
Twenty to forty is a normal range for a world you drive or walk through.

Write down the intended real-world size of each in metres now, so the pack does not come out
at mixed scales.

Prefer a small set used well. Variety in the frame comes from placement, height, tint and
grouping far more than from model count.

---

## Step 3. Generate the assets

For each object: a **reference image**, then **three independent attempts** at geometry, then
**verify**, then **pick by eye**. Full instructions in [gen/README.md](gen/README.md).

Independent means different construction strategies, not three edits of one file: one from
primitives, one from extruded or lathed profiles, one with a different part breakdown.

Then:

```bash
node --check <each file>
node harness/verify.mjs <dir>      # renders every candidate from four sides
```

**Look at the sheet it writes.** Choose by looking. Not by triangle count: a score once picked
a broken planter at 265,265 triangles over a correct one at 3,880.

Every asset must pass the verifier with no warnings before you build anything with it. Read
[docs/asset-contract.md](docs/asset-contract.md) for the output contract and
[docs/traps.md](docs/traps.md) for bugs in this domain that fail silently.

---

## Step 4. Build the game

This part is the Claude-of-Duty method, and the wording below is close to the original because
the original works. Credit: [Claude-of-Duty](https://github.com/mshumer/Claude-of-Duty) by
Matt Shumer.

> Build the game at the level of the most recent AAA games in its genre. It should be utterly
> perfect, visually beautiful, with every single thing done at AAA quality, from materials to
> physics to anything you could think of.
>
> Fan out sub-agents and have sub-agents tackle each part individually so that the game is
> utterly perfect. Loop on each item, and have a separate sub-agent check it visually to make
> sure it looks triple A. That sub-agent should be a really harsh critic, and if it does not
> look triple A, it should keep going.

Two things follow from that which are easy to lose:

**You decide the architecture.** Nobody hands you a subsystem split. Work out what the parts
are and give each to one owner. Coupled concerns get one owner: sky and fog together, vehicle
dynamics and camera together, road layout and the drivable-space query together. A seam
through a coupled concern is where these builds fail.

**Place things by hand.** We measured two games from an identical asset pack, one with authored
coordinates and one with a placement rule tuned for density and spacing. The authored one was
dramatically better. Rules produce arrangements that are plausible and dead, because nothing
has a reason to be anywhere. Author a few units properly and choose where each goes.

Load assets with `harness/assetlib.js`. Copy it, do not rewrite it, and read the comment at the
top for what it costs when you do.

---

## Step 5. The loop

This is the part that is usually skipped, and skipping it is why most of these look the way
they do.

Each round:

1. **Drive or play the game and capture it in motion.** `node harness/playtest.mjs <dir>`
   writes a six-frame filmstrip.
2. **A harsh critic compares your frames against your reference frames from step 1, blind**,
   and says which it would rather look at and precisely what the better one has that yours
   does not. Not "more atmosphere". Something physical: "its wet road throws a 25m reflection
   where ours has a small pool under each lamp".
3. If the reference wins, the critic writes a ranked list of concrete failures with the owning
   file and the smallest fix for each.
4. Fan out and fix. Go to 1.

Stop when the critic stops choosing the reference, or after four rounds, and **say which round
you reached** rather than implying it converged.

### Two things the critic must do, or it is not a critic

**Judge frames in motion, not posed screenshots.** We have watched a build whose parked hero
shots were beautiful and whose driving frames were a dark, unreadable mess, and its own critic
passed it every round because it was comparing stills. If your critic only ever looks at a
parked frame, it will approve a game nobody can play.

**Be allowed to fail the round.** A reviewer that writes notes is not a gate. If it cannot send
the work back, quality stops at whatever the first pass produced.

---

## Step 6. Before you call it done

- [ ] every asset passes `harness/verify.mjs` with no warnings, and you have **looked** at the sheet
- [ ] `harness/playtest.mjs` reports the game actually moved, and you have **looked** at the filmstrip
- [ ] you drove the whole thing and listed every place the player gets stuck
- [ ] inside your draw call and triangle budget, measured with `renderer.info.render`
- [ ] it runs on a phone: touch controls, and a frame readable on a small screen
- [ ] nothing in the frame is unidentifiable

---

## Constraints worth setting before you start

**A budget.** Something like 800 draw calls and 1.5M triangles for a browser game. Measure it at
many points, not three. **Never buy budget with decimation**: it shreds thin and lattice
geometry, which is exactly the detail worth keeping. Reduce segment counts at generation time
instead.

**Telemetry**, so the harness can drive your game:

```js
window.__READY__ = true;               // loaded and startable
window.__START__ = () => { ... };      // begin play
window.__GAME__  = {                   // refreshed every frame
  frame,                               // frames rendered since boot
  fps,                                 // from REAL elapsed time, never a clamped delta
  speed, pos: [x, z], score, over,
  draws: renderer.info.render.calls,
  tris: renderer.info.render.triangles,
};
```

Both notes on that object are there because getting them wrong cost us real time. A frame
counter that divides by clamped deltas is pinned to a constant and will happily report a
healthy number on a build running at one frame a second. And a harness that holds inputs for a
wall-clock duration advances a slow machine's simulation by a fraction of what it intended,
then tells you your car will not move.

---

## Known failure modes, so you check for them instead of rediscovering them

**The ground plane.** In a game where you move along the ground, the ground is most of the
screen. It needs markings, edges, wear, and a visible boundary between where you can go and
where you cannot. The most common version of this failure is lights that emit but do not couple
to the surfaces around them, so the world is lit and the floor it stands on is not.

**Objects modelled from one side.** A generator working from one reference image produces
something convincing from the front and a featureless box from behind, and every screenshot
hides it because every screenshot is taken from the good side. `harness/verify.mjs` tests for
this specifically.

**Everything in [docs/traps.md](docs/traps.md).** Read it before you start, not after.
