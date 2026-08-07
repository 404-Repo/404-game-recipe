# Building a game

Two ingredients. The prompt below builds the game. [404.md](404.md) makes the 3D it needs.

Nothing else in this repo tells you how to work. How you break the problem up, what the
architecture is, what order you do things in, all of that is yours, and the prompt is
deliberately unspecific about it.

---

## The prompt

From [Claude-of-Duty](https://github.com/mshumer/Claude-of-Duty) by Matt Shumer. Changed only
where it names a genre. Run it.

> I want you to build **&lt;the game you were asked for&gt;** at the level of the most recent AAA
> games in its genre. It should be utterly perfect, visually beautiful, with every single thing
> done at AAA quality—from textures to physics to anything you could think of.
>
> Fan out sub-agents and have sub-agents tackle each one individually so that the game is
> utterly perfect. You should /loop on each item and have a separate sub-agent check it visually
> to ensure it looks triple A. That separate sub-agent should be a really harsh critic, and if
> it doesn't look triple A, it should keep going.
>
> Don't stop until each sub-agent is utterly wowed with the quality when compared with the
> actual AAA game in that genre. It should literally compare them side by side blind and say
> which one looks better. Do this in ThreeJS. /loop until it's utterly perfect. Fan out
> sub-agents and ultracode.

## Every object in it comes from 404

When the build needs a car, a building, a crate, anything: [404.md](404.md). A reference image,
three independent attempts, verified, picked by eye.

Do not model from a description and do not assemble objects from primitives you invent. That is
the one substitution this repo makes, and it is the only one.

---

## Three things that decide whether the loop works

Everything below is about running the prompt properly. None of it is an instruction about how to
build your game.

**The blind comparison needs a real image.** A critic recalling a game from memory produces
opinions, not a verdict. Generate a few frames of what your game should look like, same places,
same time of day, at the quality you are aiming for, and compare against those. `gen/` makes
them the same way it makes asset references.

**The critic has to be able to fail the round.** A reviewer that writes notes is not a gate. If
it cannot send the work back, quality stops wherever the first pass landed.

**The critic must judge frames in motion.** We have watched a build whose parked screenshots were
genuinely beautiful and whose driving frames were a dark unreadable mess, passed every round by
its own critic because the critic was comparing stills.

```bash
node harness/playtest.mjs <dir>
```

plays the game and captures six frames while it moves. For it to work, expose:

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

Both comments on that object are there because getting them wrong cost real time. A frame counter
that divides by clamped deltas is pinned to a constant and will report a healthy number on a build
running at one frame a second. And a harness that holds inputs for a wall-clock duration advances
a slow machine's simulation by a fraction of what it intended, then tells you the player would
not move.

---

## One failure mode worth knowing in advance

In a game where you move along the ground, the ground is most of the screen. The usual way it
fails is lights that emit without coupling to the surfaces around them, so the world is lit and
the floor it stands on is not. It is worth naming to your critic as something to check, because
in our runs it went four rounds unfixed while being correctly diagnosed every single time.

[docs/traps.md](docs/traps.md) has the rest, and they are all the same kind: wrong output, no
exception, no warning, and code that reads correctly.
