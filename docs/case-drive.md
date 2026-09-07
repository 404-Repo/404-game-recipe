# One build, start to finish

A record of a single run, so the shape of one that worked can be seen rather than inferred from
instructions. No advice here; the rest of the repo has that. Where the round notes and the
verdicts disagreed we went back to the verdicts, and one of them changes the story below.

---

## What was built

A kart racer around a coastal town circuit: a closed 1061 m lap from a 59 waypoint centreline, 60
objects, eight karts, seven AI racers with items, drift tiers, keyboard and touch. Every mesh in
it is code. Twelve tileable PBR sets, cutout cards for foliage and crowds, one sky panorama,
seven sound effects and three music cues came from an image and audio API, as did every reference
image. The shipped folder is 5.6 MB and starts in about 7 seconds on emulated 4G.

## The set up

**The bar.** 23 real gameplay frames of a commercial kart racer, chase camera, in motion, 1280 px
or wider, indexed with the source of each. For the critic only: never published, never copied
into the game.

**The floor.** One agent, one pass, 60 to 90 minutes, told not to read anything the other agents
were writing, then six driving frames from `harness/playtest.mjs`.

**The style lock.** 246 lines: one style sentence, 18 hex colours with the role of each, real
sizes for common objects, material recipe names, triangle bands by class, and three visual
signatures every object over 0.6 m carries. Handed whole to every agent that generated anything.

**The gate.** 815 lines, written for this game rather than borrowed. A real tap on the start
button, real keys, real multi finger touch through the DevTools protocol, steering by telemetry
against the track's own centreline, 600 m of driving, eight frames in motion. It fails on
movement, progress, items used, drift tier, AI count, console errors, anything served from
outside the folder, draws over 900 or triangles over 1.5M.

Eleven claims were measured against both sets of frames and kept only where the bar and the floor
fell on different sides on 70 percent or more of them. Two stayed as eye checks, because no
number separated the sets without being gameable.

## Round 0: 25 agents, and a build 81 percent over budget

A lead agent wrote the spec, the style lock, the 60 row object list, a 597 line track plan and a
722 line architecture, and chose its own nine subsystem split. Nine asset agents ran the 404 loop
on five to eight objects each, nine engine agents built to the lead's signatures, one integrator
wired it together.

The result was a complete playable in one pass: every asset placed with none missing, 601 m
driven under the gate, tier 3 drift, p50 82 fps. It also failed that gate, at 951 draw calls
against a 900 budget and 2.72M triangles against 1.5M, over on 214 of 320 samples and 81 percent
above budget at the peak. The level alone was 1.97M of it.

The first critic then judged it blind, 8 pairs against the floor and 8 against the bar. It beat
the floor 8 of 8, all decisive, and lost the bar 8 of 8, 6 decisive and 2 clear. Deciding
property: hero scale and value range. A matte matchbox kart at about 8 percent of frame height
under a far high camera, shade crushed to near black, whitewash clipped.

## Round 1: the hero got bigger, the shade came up

Seven fix agents. The chase camera moved to 4.3 m back and 1.5 m up at fov 58, putting the kart
at 0.27 to 0.32 of frame height; clearcoat paint went on body, caps and helmet; the rig was
re-solved at sun 3.2, sky fill 2.0 and PMREM 0.35, taking shaded cobble from luma 16 to 90. A
hybrid bake took triangles to 1.67M and draws to 819. The next critic, a fresh one, took 1 of 8
bar pairs, the first the build had won, and decisive losses fell from 6 to 4.

## Round 2: nothing in the frame was bright

The property came measured: p98 luma 209 against the bar's 239, pixels above 245 luma at 0.1
percent of the frame against 1.1, pixels above 0.6 saturation at 4 percent against 19. Blacks
were as deep as the bar's, so it was not haze. Six fix agents re-solved the rig at sun 12 with a
paler key, wrap 0.65, env 0.40, bloom threshold 4.0 and sky gain 1.25, moving p98 median from 208
to 239. The camera came in to 2.8 m and the kart to half the frame, and 18 assets had their
segment counts cut at generation time with nothing decimated. The next critic took 0 of 8, so the
count went backwards. What moved was the margin: decisive losses 4 to 2, and one pair lost only
slightly for the first time.

## Round 3: the hero object's own surfaces

"The hero kart and driver are a matte block toy": flat red albedo with no gloss, black cylinder
tyres, two glowing headlight polygons, a featureless helmet. The reason two rounds of paint work
had not shown was silent. Three.js 0.169 overrides `envMapIntensity` with the scene's value, 0.4
here, whenever a material's own `envMap` is null, so the clearcoat added in round 1 had never
reflected the sky at all. Round 3 gave the paint the PMREM as its own environment map, added
chrome exhausts, dished hubs, block treads, a mirrored visor and decals, pulled the camera to
3.5 m with the kart at 0.36 to 0.40 of the frame, and re-solved the rig for a second colour
temperature: shaded whitewash went from B minus R of -7 to between +27 and +40. Far bake variants
took the triangle peak to 1.24M, and the gate passed for the first time, at 731 draws, 1,238,468
triangles and p50 68.

No critic judged round 3. We had agreed three rounds before starting and the same structural
reason had failed all three, so we stopped and wrote the list.

| round | the property the critic named | bar pairs | floor pairs |
|---|---|---|---|
| 1 | hero scale and value range: a matte kart at 8 percent of frame height, shade crushed to black | 0 of 8 | 8 of 8 |
| 2 | nothing in the frame ever gets bright: p98 luma 209 against the bar's 239 | 1 of 8 | 8 of 8 |
| 3 | the hero object's own surfaces: no gloss, no reflection, no readable driver | 0 of 8 | 8 of 8 |

Each critic judged the build published at the end of the round before it, so those counts belong
to the build going in, and round 3's own build was never judged. Every critic named which half of
all 16 pairs was ours, and the tells.

## What it never fixed

The shaded hero kart reads magenta: body median 119, 36, 80 in house shadow against coral in sun,
which is grazing Fresnel plus the clearcoat reflecting a saturated zenith, and neither the index
of refraction nor the environment intensity is the lever. The foam shield still occludes the kart
when held. The touch harness leaves the road at two corners in about one run of two at boost
speed, corners a phone player meets too. Load reads 9 to 10 seconds whenever another Chrome
shares the GPU, against 7 on a quiet box. Never attempted: frame rates on a real phone, a human
listening to the audio mix, item balance judged by a person, multiplayer.

## What it cost

Round 0 was 25 agents and about 10M subagent tokens across three attempts, two of which died on
usage limits, and roughly 2.5 hours of agent time on the attempt that ran uninterrupted. Each
critic round after it was 8 or 9 agents, about 2M tokens and 80 to 90 minutes. Rounds 0 to 3
together were 50 agents and about 16M tokens: round 0 published at 04:34 on 6 September, round 3
at 15:10 UTC the same day.

## Three things we took from it

The deciding property was about the hero object and the light every round, never about the model
or the asset generator: scale and value range, then highlight range, then the hero's own
surfaces. A fresh critic each round beat the same critic twice, because all three picked our
frames out of all 16 pairs and each named a different property. And the floor is what tells you
the loop is working at all: 8 of 8 against the floor every round while the bar count went 0, 1, 0
are two different facts, and a build with only the bar to look at would have read as three rounds
of nothing.
