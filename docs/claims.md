# Claims, and the floor

[GAME.md](../GAME.md) says the blind comparison needs a real image, and that you should turn that
image into claims you can fail a round on. This is how to do that so the claims are worth having,
and the one extra build that makes the whole comparison mean something.

---

## Build a floor first

Before the loop starts, have **one agent build the same game in one pass**: no asset loop, no
critic, no rounds, told not to read anything the rest of your build is using. An hour of its time,
then drive it with your gate and keep six frames.

That is your floor. Everything after it is measured between two marks rather than against a
feeling:

- **the floor**, what one agent writes cold, which is what a reader would have got without the
  method
- **the bar**, real frames of the game you are imitating

A round that does not beat the floor on every pair means the loop is not paying for itself, and
you want to know that on day two rather than at the end. Ours beat the floor eight pairs out of
eight from the first critic round onward, which is the only evidence we have that any of this
works, and it cost an hour to be able to say it.

The floor is also the honest control for your claims: a statistic that separates your build from
the bar might just be separating "a game" from "a screenshot of a game". A statistic that
separates the bar from the floor is measuring something the method is supposed to fix.

---

## Making the claims

1. **Collect the bar.** Fifteen to twenty-five frames of the real game, in motion, from the camera
   your game uses, at the resolution you can find. Photographs work for anything real. Keep them
   local; they are for your critic, not for your site.
2. **Write down what is true of them**, before you build, as statements a machine could check. The
   four that did the most for one night market build: the surround is nearly black and everything
   readable sits in a pool of light; there are always two colour temperatures in frame; the counter
   is loaded rather than tastefully arranged; the volume above the counter is full.
3. **Measure both sets.** One script, one row per frame, statistics computed on the frame resampled
   to a fixed width, with bands taken inside the frame so a HUD at the edge does not enter them.
4. **Throw away the statistics that do not separate.** Keep a claim only if the bar and the floor
   land on different sides of it on **70 percent or more** of frames. We started with a dozen and
   kept eight; the four we dropped had felt like the most insightful ones.
5. **Give every claim a "gameable by" line**, naming a concrete way a build could hit the number
   and still look wrong. A statistic will be optimised the moment it exists, and a bad statistic is
   worse than none because it certifies the failure.
6. **Let the critic reject a metric.** If a number says pass while the picture plainly fails, the
   critic should say so in its verdict rather than accept the frame. One of ours threw out an edge
   density claim with the note that the edges were one cobble texture tiled at a single scale over
   the whole road: the number was real and it was measuring the wrong thing.

Two claims of ours never got a number and stayed as eye checks, which is the right outcome for
them: "two colour temperatures in frame" and "speed is visible". Not everything that decides a
comparison can be counted, and pretending otherwise puts a fake gate in front of a real judgement.

---

## What claims are for

They are not a score. Nobody should be adding them up, and a build that improves its numbers while
the picture stands still has learned to satisfy you rather than to look good.

They exist so that "make it better" becomes a specific thing to change, and so that a fresh critic
each round can point at the same evidence. In three rounds ours named one deciding property each
time:

| round | the property the critic named | blind pairs won against the bar | how the losses were scored |
|---|---|---|---|
| 1 | hero scale and value range: the player is a small matte object and shade crushes to black | 0 of 8 | 6 decisive, 2 clear |
| 2 | nothing in the frame ever gets bright or vivid: p98 luma 209 against the bar's 239 | 1 of 8 | 4 decisive, 3 clear |
| 3 | the hero object's own surfaces: no gloss, no reflection, no readable driver | 0 of 8 | 2 decisive, 5 clear, 1 slight |

The win column barely moved. The margins did: six decisive losses, then four, then two. Ask your
critic how badly as well as which, or a round that plainly improved the picture reads as a round
that did nothing.

Spend the round on the one property, not on the critic's whole list. The list is long every time
and one item on it is doing all the work.
