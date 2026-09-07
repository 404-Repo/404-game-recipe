# What you need beyond this repo, and what it costs

Everything here is a recommendation. It is written down because the games we built this way
needed things the repo does not ship, and that is cheaper to read now than to meet at round two.

---

## The agent

Read and write files, run a shell, and **look at images**. The third is the one that gets
skipped.

An agent that cannot see cannot run this loop. Both decisions that produce the quality are made
by looking: the choice between three candidate modules, made on the sheet `harness/verify.mjs`
writes, because nothing in its report tells you which one still reads as the reference from
behind; and every critic round, which is frames judged in pairs.

An agent without vision can still do most of the work. Have it write the candidates, run the
verifier and the gate, produce the sheets and filmstrips, then hand those pictures to a person
and take the answer back. Say in your notes that a human made the judgement, rather than
reporting a verdict nobody looked at.

It also needs Node 20 or newer and network access: the verifier loads Three.js from a CDN, and
offline every asset fails with `did not load`, which reads as a broken pack and is not.

## Fanning out

The prompt means what it says. Our kart racer's first pass was 25 agents: a lead that decided the
split, then one per group of five to eight objects and one per engine subsystem writing at once
against a shared style lock, then an integrator. Each round after it was one fresh critic that
could fail the build, and eight or nine fix agents doing only what it named.

The parallelism is a convenience rather than the method. Run the same prompts one after another
and the shape holds: a lead that decides the split, agents that own their files, a critic that
can send the work back, a gate that drives.

What is not that shape is one agent making one pass. That is the floor build in
[claims.md](claims.md). It is a fine place to start and worth keeping either way as the mark you
measure against, but it is not what the prompt describes, and every critic round of ours beat it
eight pairs out of eight.

## Pictures

The one real dependency. A picture beats a sentence by a wide margin, measured in
[404.md](../404.md): "a shop front" failed outright, while the same object written out as form gave
usable geometry on 14 of 16 attempts. The repo ships no image generator on purpose, because any
of them will do.

- an agent that makes images itself, the shortest path
- any external image tool or API you already have
- photographs, background cut out, which work well for vehicles and street furniture
- for anyone entering the 404 game jam, the Atlas credits that come with signing up

A usable reference is one object filling the frame, plain background, three-quarter view, even
light, nothing cropped. [concept-images.md](concept-images.md) has the rest.

With none of these, the fallback in 404.md is real: write each object out as **form, not
function**, one paragraph of shape, parts, proportion and count. Expect it to be worse than
working from pictures, and expect the loop to carry more of the weight. Scene frames for the
blind comparison are easier, since photographs of real places are everywhere.

## Textures, sky and sound

Surfaces are free. `harness/surfaces.js` generates albedo, roughness and normal maps at load time
from a seed and a material name, and `harness/rig.js` gives you a lighting rig and a sky, which is
otherwise the part a reader writes from scratch and mostly does not write at all.

Recorded sound and photographic texture are not in here. Our kart racer generated twelve PBR
sets, a sky panorama, cutout cards for foliage and crowds, its sound effects and three music
cues, none of which this repo can give you.

Sound is worth saying plainly: a silent game reads as unfinished to a judge whatever the frames
look like, and generated audio is the cheapest fix available.

## What it costs

Our kart racer, 60 objects and 9 subsystems:

| | agents | tokens | wall clock |
|---|---|---|---|
| first pass | 25 | about 10M, over three attempts | about 2.5 hours uninterrupted |
| each critic round, three of them | 8 to 9 | about 2M | 80 to 90 minutes |
| a targeted round, no critic | 3 | 0.7M | 40 minutes |

About ten hours end to end. The first pass dominates. Budget roughly 4M tokens per five hour
window: we tripped a usage limit twice and a credit cap once, and the running agents died
each time.

A smaller version is a real thing to aim at rather than a compromise. One pass plus one critic
round, on ten or twelve objects, is a fraction of the above, and it is where the method starts
showing: our first critic round is the one that passed the floor on every pair.

## A half day version

1. **Lock the style.** Ten minutes with [style-lock.md](style-lock.md), one file, handed whole to
   every agent that generates anything. It decides whether you get a set or a pile.
2. **Reference the ten objects that carry the frame.** Not the whole list. The hero, the ground,
   the things nearest the camera.
3. **One pass**, every object through the 404 loop, with a gate that actually drives the game.
4. **One critic round, on the deciding property only.** Ask the critic for the single property it
   would change first, and fix that. Ours named one thing a round, and what moved every round was the margin it lost by.
5. **Run the gate, ship it, then open what you shipped.** `harness/ship.mjs` parses every module;
   `harness/live.mjs` loads the real URL on a phone viewport and touches it.
6. **Write down what is still wrong.** A round that produces a list rather than a change is the
   signal to stop.

If you can spare one more hour, spend it on the floor build. It is the only evidence you will
have that any of this paid for itself.
