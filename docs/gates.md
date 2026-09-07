# Gates

`harness/playtest.mjs` drives your game with the arrow keys, steers by `__GAME__.pos`, and
photographs it moving. That is the right gate for a game you walk or drive forward through, and it
is deliberately the only one this repo ships.

It is also the wrong gate for most games, and the failure is quiet. Point it at a shooter and it
never aims and never fires, so the entire subject of the game goes untested while the run reports
a clean pass. Point it at a kart racer and it cannot drift, so the mechanic the whole build is
about is never exercised. A gate that passes while testing none of the game is worse than no gate,
because you believe it.

The example in this repo shows it plainly. Run `node harness/playtest.mjs example/warehouse-fps`
and the game loads, renders, holds its budgets and reports five of its six legs stalled, because
the route drives fifty metres forward into a warehouse wall and the gate has no way to shoot, aim
or turn a corner deliberately. Nothing is broken. The gate is simply not the gate that game needs.

So: **write the gate for your game.** It is an afternoon, it is the tool you will run a hundred
times, and everything below is what two of ours learned the hard way.

---

## What a gate has to do

1. **Serve the folder the way a host will.** Mount the game's own directory, not your working
   tree, and record any request that 404s. A game that reaches outside its folder works locally
   and dies the moment it is deployed.
2. **Press the real control.** A real click, and a real touch tap on a phone viewport. Never call
   into the game through a debug hook. A build here shipped unstartable on every phone for a
   fortnight because every check started it by calling `__START__()` directly.
3. **Drive with real input.** Real `keydown`, real mouse deltas under pointer lock, real
   multi-finger `Input.dispatchTouchEvent` through the DevTools protocol. Synthetic state changes
   test your telemetry, not your game.
4. **Assert the game actually happened**, not that the page loaded: the player moved this many
   metres, progress increased, a shot was fired and something died, an item was used, a drift
   reached tier one. Pick the two or three facts that mean your genre was exercised.
5. **Photograph it while all that is happening**, six to eight frames spread through the run, and
   write them as one filmstrip. Judge the filmstrip, never a still.
6. **Fail loudly and exit non-zero**, with the problem named in a line a person can act on.

---

## The telemetry a gate steers by

The contract in [GAME.md](../GAME.md) is the minimum. Add what your genre needs; these are the
fields our two builds ended up with, and every one of them exists because a gate could not do its
job without it.

```js
window.__GAME__ = {
  pos: [x, z],          // metres. The gate steers and measures distance by this
  fps,                  // from REAL elapsed time, never a clamped delta
  speed, over,
  draws, tris,          // renderer.info.render.calls / .triangles

  // a racer
  progress,             // 0..1 around the lap, so the gate knows where it is and when to drift
  lap, laps_total, position, race_progress,
  item, items_used,     // what is held, and how many have been used
  drift,                // current mini turbo tier, so the gate can assert a drift happened
  surface,              // what the wheels are on: the gate can report time spent off track
  heading,              // radians, so a gate can steer toward a line instead of guessing
  kartBox,              // the player's screen box, for measuring hero scale in a frame

  // a shooter
  hp, shots, kills, alive,
  aim: [sx, sy, visible],   // screen position of the nearest visible hostile
  aimMouse: [dx, dy],       // the mouse delta that would centre the reticle on it
};
```

The two that repay themselves fastest are **`pos`** and one **progress-like scalar**. With them a
gate can hold a leg until the player has covered real ground, which is the only unit that works on
both a fast machine and a slow one. Holding a key for a wall-clock duration under-drives a slow
box; holding it for a fixed number of frames under-drives a fast one. We shipped both bugs and
each one accused a working game of ignoring its controls.

The other one worth adding early is a **screen box for the player**, because "is the hero big
enough in frame" turns out to decide blind comparisons and you cannot measure it from outside.

---

## A driver, in about sixty lines

The parts that differ between genres are how you steer and what you assert. Everything else is the
same, so the shape below is worth copying.

```js
// hold a leg until the player has covered `metres` of PATH length, steering as we go
async function leg(page, { metres, keys = ['ArrowUp'], steer, fire }) {
  for (const k of keys) await page.keyboard.down(k);
  let g = await page.evaluate(() => window.__GAME__);
  let prev = g.pos, covered = 0, held = null;
  const until = Date.now() + 60000;                    // a leg that cannot finish gives up
  while (covered < metres && Date.now() < until) {
    await new Promise((r) => setTimeout(r, 70));
    g = await page.evaluate(() => window.__GAME__);
    if (!g || !Array.isArray(g.pos)) break;
    covered += Math.hypot(g.pos[0] - prev[0], g.pos[1] - prev[1]);
    prev = g.pos;

    // steering is the one genre specific part: return 'left', 'right' or null
    const want = steer ? steer(g) : null;
    if (want !== held) {
      if (held) await page.keyboard.up(held === 'left' ? 'ArrowLeft' : 'ArrowRight');
      if (want) await page.keyboard.down(want === 'left' ? 'ArrowLeft' : 'ArrowRight');
      held = want;
    }
    if (fire && fire(g)) {                             // a shooter aims and shoots here instead
      await page.mouse.down(); await new Promise((r) => setTimeout(r, 120)); await page.mouse.up();
    }
  }
  if (held) await page.keyboard.up(held === 'left' ? 'ArrowLeft' : 'ArrowRight');
  for (const k of keys) await page.keyboard.up(k);
  return covered;
}
```

A racer's `steer` compares the player's heading to the direction of the next point on its own
centreline and returns the side to turn. A shooter's `fire` reads `aim` and `aimMouse`, moves the
mouse by that delta, and clicks. Neither is more than twenty lines, and both are the difference
between a gate that tests your game and one that tests your loading screen.

---

## Two things that will bite

**A warning is not a gate.** An asset that fails to import, a texture that 404s, an audio file
that never decodes: each of those prints a line and the game carries on, emptier than it should
be. We shipped a build for four rounds where three assets threw on import; the level logged
"loaded empty" and kept going, and the frame rate gate never noticed because an empty level is
fast. Anything that can silently drop content needs a hard check that fails the run. The cheapest
one, and it costs nothing: parse every module before you ship, with
[`harness/ship.mjs`](../harness/ship.mjs).

**Headless frame rates are software rendering, unless you look.** Headless Chrome falls back to
SwiftShader on a machine with no usable GPU and the number is then two orders of magnitude out.
Detect it and caption the number rather than gating on it; gate on draw calls and triangles
instead, which are the same everywhere. And never copy `--use-angle=swiftshader` out of a
screenshot tool into a gate: it forces the software path on a machine that has a GPU, and a
capture that should run at 60 frames a second records at less than one.

---

## The blind pairs

The critic's instrument is a pair of frames side by side with the answer withheld, and the repo
ships the tool for it:

```bash
node harness/pairs.mjs --mine game/_gate/f0.png game/_gate/f1.png --ref refs/bar/*.jpg --out work/critic1/bar
```

It writes `pair_01.png` onward with the side shuffled per pair, a `KEY.json` you never show the
critic, and a `CONTACT.png` of every pair stacked. Look at the contact sheet before you send
anything. A run here lost a whole critic round to a home made version of this tool that wrote
eight identical sheets of broken image icons: the critic judged them, wrote a confident verdict on
nothing, and the only reason anyone noticed is that all eight sheets were byte identical.

---

## Checking the thing you deployed

The gate proves your folder works. `harness/live.mjs` proves the URL you gave someone works, which
is a different claim: paths that only resolved from your working tree, a cached module against a
new page, a filename whose case only matters on a Linux host, an asset behind a CDN that 404s.

```bash
node harness/live.mjs https://you.github.io/yourgame/game/     # phone viewport, real touch
node harness/live.mjs <url> --desktop                          # laptop viewport, click and keys
```

Two details in there worth stealing for your own gate. **A virtual stick reads the vector from
where the finger landed**, so pressing its centre and holding still is not input: land in the
middle, drag, then hold. And **a touch control on a laptop viewport is usually still in the DOM
and hidden**, so a check that holds it moves nothing and blames the game.

---

## Recording a clip

Once a gate can drive your game, it can film it. Use the DevTools screencast rather than
screenshots: `page.screenshot()` costs 50 to 100 ms a frame and turns a run into a slideshow,
while `Page.startScreencast` streams JPEG frames off the compositor at close to the render rate.

```js
const cdp = await page.target().createCDPSession();
cdp.on('Page.screencastFrame', async (f) => {
  fs.writeFileSync(`clip/f${String(n++).padStart(5, '0')}.jpg`, Buffer.from(f.data, 'base64'));
  await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId });
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });
```

Then `ffmpeg -framerate <measured> -i clip/f%05d.jpg -vf "scale=1280:-2,fps=24" -crf 28 out.mp4`.
Hide the interface first with an injected style tag rather than by setting `style.visibility`,
which a game will overwrite on its next frame.

One warning from doing this on a shooter: a gate aims at whatever it can see, so a capture run
spends most of its time pointed at the sky. If your build exposes no way to hold the camera, film
a scripted walk instead: teleport to chosen spots with a level pitch, hold the movement keys, and
yaw with real mouse deltas while leaving the vertical delta at zero.
