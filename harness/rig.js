/**
 * A render rig, for any Three.js game in this format.
 *
 *     import { createRig } from './rig.js';
 *     const rig = createRig(THREE, renderer, scene, { hour: 16.5, azimuth: 250 });
 *     rig.render(camera, dt);        // once a frame, instead of renderer.render(scene, camera)
 *
 * That is the whole of it. Copy this file next to `assetlib.js` in your game folder, the same way
 * you copy that one, and the frame arrives lit rather than lit-looking.
 *
 * WHY THIS EXISTS. Assets are only half of what a frame is made of. Across three critic rounds on
 * a daylight build of ours the deciding property was hero scale and value range, then that nothing
 * in frame ever got bright, then the hero object's own surfaces. Two of those three are the rig,
 * and the third is lit by it. The numbers that moved as they were fixed: shaded ground from sRGB
 * luma 16 to 90, shaded plaster from B minus R -7 to +27, and the 98th percentile luma from 208 to
 * the reference set's own 239. None of that came from a better crate.
 *
 * A reader who writes lighting from scratch writes one DirectionalLight and one AmbientLight,
 * which is a lit box: every surface in the frame is the same colour temperature, so the picture
 * has no depth in it and no amount of asset quality puts any back.
 *
 * THIS IS A RECOMMENDATION, NOT A RULE. It is one rig that works, offered so nobody has to start
 * from a grey scene. Delete it, replace it, or take the ideas out of it and write your own.
 * The architecture of your game is yours; this repo has no opinion about it.
 *
 * ---
 *
 * WHAT IT DOES, and it is deliberately only these six things.
 *
 *  1. TWO COLOUR TEMPERATURES, made in the lights and never in post. A warm key with real
 *     cascaded shadows, and a cool fill that is DIRECTIONAL: a north face sees sky and goes cool,
 *     an underside sees bounce off sunlit ground and stays warm. The fill is a hemisphere light
 *     plus the PMREM of an analytic sky built in code, and a ground-bounce term added to the
 *     irradiance, weighted by the world normal. There is no tint pass anywhere in this file.
 *     Shade is cool because the sky is what is lighting it.
 *
 *  2. AERIAL PERSPECTIVE, not flat fog. Every lit material's fog chunk is replaced so the haze
 *     colour is the sky radiance in that pixel's own view direction and the amount grows with
 *     distance. Distant things lose contrast toward the sky behind them, which is what depth
 *     looks like; flat fog turns everything the same grey and reads as a fault.
 *
 *  3. A SKY THAT AGREES WITH THE LIGHT. A gradient dome with a sun disc and a horizon haze band,
 *     drawn from the same atmosphere numbers that made the key, the fill and the haze. It cannot
 *     disagree with the lighting because there is only one set of numbers. No texture, no file.
 *
 *  4. ACES, A SANE EXPOSURE, AND THRESHOLD BLOOM. The bloom threshold is derived from the key's
 *     own intensity, so it catches the sun disc, specular hits and emissive lenses and never a
 *     diffuse surface. No film grain, no vignette, no global bloom, no colour grade. We
 *     reverted a heavier pass on the daylight build because nobody could see the difference.
 *
 *  5. QUALITY TIERS. One name, or 'auto'. It picks shadow map size, cascade count, pixel ratio
 *     and whether post runs at all.
 *
 *  6. A TIME OF DAY. `hour` and `azimuth` set the sun; the sky palette, the fill colour, the
 *     bounce colour, the haze colour and the bloom threshold all follow from them.
 *
 * IT IS AN EXTERIOR RIG, and that is a limit rather than a preference. Everything warm in it comes
 * from the sun, so in a room the sun cannot reach, the fill is the only light left and the frame
 * has one colour temperature: the exact failure the rig exists to prevent, arrived at from the
 * other side. Measured on a closed warehouse, two patches of the same floor, one in a daylight
 * strip through a roof gap and one beside it: 201 against 92 in luma and 68 units of blue minus
 * red apart, so where the sun does land through an opening the rig works indoors as well as out;
 * away from those strips the room is uniformly cool. An interior wants its own lamps as well.
 *
 * NOT IN HERE, on purpose: ambient occlusion, a colour grade, motion blur, volumetric shafts,
 * god rays, lens dirt. The daylight rig this was extracted from had a depth-only SSAO and a
 * three-way grade under six percent. Neither survived the question "can you see it".
 *
 * ---
 *
 * MEASURED. Seven assets loaded through `assetlib.js` with `surfaces: true`, a ground plane, a
 * camera at 1.7 m, and a post placed so its shadow falls on open ground 4.5 m in front of the camera.
 * A patch of that ground inside the shadow against a patch of the same ground beside it in sun,
 * median of the displayed sRGB values over a 13 x 13 patch:
 *
 * | clock | sun elevation | tier  | lit luma | shaded luma | lit B-R | shaded B-R | shade cooler by |
 * |---|---|---|---|---|---|---|---|
 * | 08:00 | 31.0 | high  | 206 | 121 | -19 | +41 | 60 |
 * | 16:30 | 23.7 | high  | 207 | 116 | -29 | +26 | 55 |
 * | 17:36 |  6.5 | high  | 174 |  92 | -62 |  +2 | 64 |
 * | 16:30 | 23.7 | phone | 207 | 116 | -29 | +26 | 55 |
 * | 17:36 |  6.5 | phone | 174 |  92 | -62 |  +2 | 64 |
 *
 * Shade is 55 to 64 units of blue-minus-red cooler than sun at every hour and on both tiers, and
 * it gets there with no filter anywhere in the pipeline. Shade sits at 0.53 to 0.59 of lit, which
 * is a shadow you can see into.
 *
 * Against the alternative, on a different scene: seventeen of these assets in twenty three
 * placements laid out as a yard street, one frame lit by this rig and one by a single
 * DirectionalLight and a single AmbientLight with no tone mapping and no fog, both given a
 * shadow-casting key and both scaled so their sunlit ground reads the same 175. Sun to shade went
 * 55 units cooler under the rig and 4 units WARMER under the pair of lights, and 1.3 percent of
 * the plain frame clipped to white against none of the rig's. The two pictures are
 * docs/img/rig-before.png and docs/img/rig-after.png.
 *
 * Take one measurement of your own before you trust any of this on your scene: point at ground in
 * sun and ground in shadow and read both. If they are the same temperature the rig is not doing
 * its job, and no amount of this comment fixes that.
 *
 * IF IT LOOKS WRONG. Shade neutral rather than cool: raise `fillChroma`, and check `bounceSide`
 * has not been raised. Everything too bright: `sunIntensity`, then `exposure`. No shadows at all:
 * `receiveShadow` on your ground, and `castShadow` on anything you built by hand rather than
 * through `ASSET()`.
 *
 * ---
 *
 * OPTIONS. Every one of them, and all of them optional.
 *
 * | option          | default      | what it does |
 * |---|---|---|
 * | `hour`          | `16.5`       | time of day, 0 to 24. Sets the sun's elevation and, through it, the whole palette. |
 *
 * AT NIGHT, READ THIS. Below the horizon this rig is a sky, a haze and a cool fill, and nothing
 * else: the key light fades out across the horizon and the warm ground bounce goes with it, both
 * by construction, because a directional light whose direction has gone negative lights every
 * underside in the scene. So a night game lit by the rig ALONE has one colour temperature, which
 * is the failure the rig exists to prevent, reached from the other side. It warns once when it
 * notices. What a night scene needs is its own practicals: emissive surfaces for the lamps
 * themselves, and a small number of real point or spot lights placed at them, warm, with a short
 * range. Keep the rig for the sky, the haze and the tone curve, and let the market light itself.
 * | `azimuth`       | `250`        | compass bearing of the sun, degrees clockwise from north. East is 90. 250 is west south west, so shadows fall east north east. |
 * | `elevation`     | from `hour`  | sun elevation in degrees above the horizon. Set it to override the hour's own. |
 * | `sunrise`       | `6`          | hour the sun crosses the horizon going up. With `sunset`, this is the only thing that makes `hour` mean anything. |
 * | `sunset`        | `18`         | and going down. |
 * | `maxElevation`  | `62`         | how high the sun gets at noon. A latitude and a season in one number: about 60 for a temperate summer, 20 for a temperate winter, near 90 in the tropics. |
 * | `tier`          | `'auto'`     | `'high'`, `'phone'`, `'auto'`, or a tier object of your own. See TIERS. |
 * | `camera`        | `null`       | the camera the shadow cascades are fitted to. If you omit it the first `update(camera)` supplies it, which is why the two-line version works. |
 * | `exposure`      | `1.0`        | `renderer.toneMappingExposure`. The exposure barely moves the top of the ACES curve; the sun does. |
 * | `sunIntensity`  | from time    | linear intensity of the key light. |
 * | `sunColor`      | from time    | hex. Overriding this without also overriding the sky is how a rig starts disagreeing with itself. |
 * | `envMap`        | `null`       | your own PMREM environment instead of the one built from the sky. |
 * | `fill`          | `1`          | scale on the whole cool fill (hemisphere and environment together). 0 gives you black shadows and one colour temperature. |
 * | `fillChroma`    | `1.4`        | how far the fill's hue is pushed away from neutral, beyond the sky's own colour. 1 is the literal sky. See the note in `applyTime`: warm albedos eat the blue, and this is what survives them. |
 * | `bounce`        | `1`          | scale on the warm ground-bounce term. |
 * | `bounceUnder`   | `8`          | how much more of the bounce an underside gets than a wall. This is what keeps a soffit warm while the wall beside it goes cool. |
 * | `bounceSide`    | `0.15`       | the wall's share. Raising it greys the shade out; that is the failure it is set low to avoid. |
 * | `bounceFlat`    | `3.5`        | an up-facing surface in shadow, which sees sunlit ground and walls around it. Keeps a shaded street blue grey rather than blue. |
 * | `envIntensity`  | `1.0`        | `scene.environmentIntensity`: the sky as a REFLECTION. |
 * | `envDiffuse`    | `0.10`       | the environment's share of the DIFFUSE fill only. Low on purpose: the hemisphere is directional and the PMREM is not, and a strong PMREM diffuse term is what greys shade back to neutral. |
 * | `sky`           | `true`       | draw the gradient dome. |
 * | `fog`           | `true`       | aerial perspective. Off means no `scene.fog`, which means no haze at all. |
 * | `fogStart`      | `40`         | metres before the haze begins. Near objects keep their own colour. |
 * | `fogDensity`    | `0.0021`     | with the default start, an object at 300 m keeps about 58 percent of its own colour and one at 700 m about 25 percent. |
 * | `wrap`          | `0.65`       | softens the key's falloff on UP-FACING surfaces only, so a road and a roof read sunlit under a low sun. 1 is plain Lambert. |
 * | `toe`           | `0.12`       | on VERTICAL faces, how far before the terminator the key gives up, in units of dotNL. It is what makes a grazed wall read as shade rather than as dim sun. |
 * | `capEnv`        | `0.8`        | ceiling on a material's own `envMapIntensity`, for materials tuned against somebody else's fill. |
 * | `post`          | from tier    | run the composer at all. |
 * | `bloom`         | `true`       | threshold bloom, when post runs. |
 * | `bloomThreshold`| from the key | linear HDR value a pixel must beat. Derived so no diffuse surface can reach it. |
 * | `bloomStrength` | `0.28`       | |
 * | `bloomRadius`   | `0.35`       | blur step. Read the bloom trap in docs/traps.md before raising it. |
 * | `shadows`       | `true`       | |
 * | `shadowDist`    | from tier    | metres the cascades cover. |
 * | `shadowMap`     | from tier    | texels per cascade. |
 * | `cascades`      | from tier    | |
 * | `background`    | `true`       | set `scene.background` to the horizon colour, so the frame is right for the one frame before the dome draws and whenever the dome is off. |
 * | `refreshEvery`  | `15`         | frames between scene sweeps for materials the rig has not seen. See "things added later" below. |
 * | `CSM`           | `null`       | pass the CSM class in yourself instead of letting the rig import it. |
 *
 * WHAT IT RETURNS.
 *
 *     rig.render(camera, dt)     update, then draw. Use this instead of renderer.render.
 *     rig.update(camera, dt)     lights, cascades, sky, material sweep. Call this instead if you
 *                                draw the frame yourself; you then get no bloom.
 *     rig.setTime({ hour, azimuth, elevation })   one call, everything follows
 *     rig.refresh(root)          patch materials under root now. Call after a level build.
 *     rig.resize(w, h)           on a canvas resize, if post is running
 *     rig.dispose()
 *     rig.sun                    the key DirectionalLight (the first cascade's, under CSM)
 *     rig.sunDir                 unit vector FROM the world TOWARD the sun
 *     rig.hemi, rig.fog, rig.tier, rig.atmos, rig.environment, rig.ready
 *
 * ---
 *
 * HOW IT COEXISTS WITH THE REST OF THE HARNESS. Both of these are why the rig patches materials
 * through `onBeforeCompile` and never clones one.
 *
 * `assetlib.js` merges geometry by MATERIAL VALUES, which is what makes a two hundred prop street
 * affordable, and `bakeStatic()` does it again at world scale. A rig that cloned a material per
 * object, or that wrote a new colour or a new map onto one, would change those values and the
 * merge would stop merging: the house in the sample set went from 33 draws to 144 the one time
 * something did that. Nothing here writes a material property except `envMapIntensity`, and that
 * only where a material asked for more than 1 (see `capEnv` below). A patch installed through
 * `onBeforeCompile` is invisible to `materialKey()`, so two materials that merged before the rig
 * existed still merge after it.
 *
 * `bakeStatic()` builds NEW meshes but reuses the material objects it bucketed by, so patches
 * survive a bake and the order does not matter. New MESHES do not survive, which is a different
 * problem: they are new objects the rig has never traversed. That is what `refresh()` and the
 * periodic sweep are for.
 *
 * `surfaces.js` sets `map`, `roughnessMap`, `normalMap` and `normalScale`, and shares one material
 * per recipe and colour so the merge still works. The rig touches none of those. It reads the
 * result: a procedural roughness map is most of what makes the specular half of this rig visible,
 * because a constant roughness gives you one highlight shape over the whole surface. Turn
 * surfaces on (`ASSET(url, { surfaces: true })`) before you judge the lighting.
 *
 * THINGS ADDED AFTER THE RIG WAS CREATED are handled, and they have to be, because a game loads
 * its level after it builds its renderer. `update()` sweeps the scene every `refreshEvery` frames
 * (and every frame for the first 120) and patches anything it has not seen. Call `rig.refresh()`
 * explicitly after a level build if you would rather not wait a few frames.
 *
 * WHAT THE RIG CANNOT DO FOR YOU: set `castShadow` and `receiveShadow`. `ASSET()` sets both on
 * everything it loads and `bakeStatic()` carries them across, so assets are fine. A ground plane
 * you built yourself is not: `receiveShadow` defaults to false and a floor that receives no
 * shadow has nothing standing on it. The rig cannot tell "false" from "never set", so it counts
 * instead, and warns once if it finds meshes and not one of them receives.
 *
 * VERSIONS. Plain Three.js 0.169 or newer. It takes THREE as a parameter, exactly as an asset
 * does, so it has no static imports and no version of its own. The one addon it wants, CSM, is
 * loaded with a dynamic `import('three/addons/csm/CSM.js')` and it degrades to a single snapped
 * shadow camera if that fails, so a page with no `three/addons/` in its import map still works.
 */

/* ------------------------------------------------------------------ tiers */

/**
 * Two tiers. The phone one drops the second cascade, quarters the shadow texels and turns the
 * composer off entirely. What it will actually run at on a phone is not something this file can
 * tell you and neither can a headless capture: those numbers are SwiftShader, a CPU rasteriser,
 * and docs/traps.md is about why treating them as a verdict costs you a day. Cost is the thing
 * that is the same on every machine, so that is what the tiers cut.
 *
 * On `high`, two cascades over 90 m at 2048: CSM's practical split puts the near cascade over
 * roughly the first 24 m, which is about a centimetre a texel underfoot and about three at the far
 * end, and that near cascade is what makes a contact shadow read. It costs a second shadow pass,
 * and that is not free: on an earlier build of ours a second cascade doubled the shadow pass
 * triangles. If your budget is tight, `{ cascades: 1, shadowMap: 4096, shadowDist: 70 }` is what
 * that build shipped, 1.7 cm texels everywhere in one pass.
 *
 * `renderer.info.render.calls` counts the shadow pass, because the GPU does. A wide shadow
 * camera is drawn twice over.
 */
export const TIERS = {
  high:  { pixelRatio: 1.5, shadowMap: 2048, cascades: 2, shadowDist: 90, post: true,  fog: true },
  phone: { pixelRatio: 1.0, shadowMap: 1024, cascades: 1, shadowDist: 45, post: false, fog: true },
};
for (const k of Object.keys(TIERS)) TIERS[k].name = k;

/**
 * A touch device with a small viewport is a phone; everything else is high. Deliberately
 * conservative: a touch laptop at 1400 px stays high.
 *
 * `screen.*` as well as `inner*`, because a page with no viewport meta lays out at Chrome's
 * 980 px default and `innerWidth` then lies about a 412 px phone.
 */
export function detectTier() {
  try {
    const q = new URLSearchParams(location.search).get('q');
    if (q && TIERS[q]) return q;
  } catch (e) { /* no location */ }
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const touch = !!nav && (('maxTouchPoints' in nav && nav.maxTouchPoints > 0) || ('ontouchstart' in globalThis));
  const w = globalThis.innerWidth || 1280, h = globalThis.innerHeight || 720;
  let sw = w, sh = h;
  try { if (globalThis.screen && globalThis.screen.width) { sw = globalThis.screen.width; sh = globalThis.screen.height; } } catch (e) { /* no screen */ }
  const small = Math.min(w, h) <= 500 || Math.min(sw, sh) <= 500 || (w * h) <= 1000 * 1000;
  const mobileUA = !!nav && /iPhone|iPad|Android|Mobile/i.test(nav.userAgent || '');
  if ((touch && small) || (mobileUA && small)) return 'phone';
  return 'high';
}

function getTier(t) {
  if (!t || t === 'auto') return TIERS[detectTier()];
  if (typeof t === 'string') return TIERS[t] || TIERS.high;
  return { ...TIERS.high, ...t, name: t.name || 'custom' };
}

/* ------------------------------------------------------- time of day */

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
/** sRGB hex to linear rgb. Colour arithmetic in this file is all linear; only the display is not. */
function hexToLinear(hex) {
  const f = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return [f(((hex >> 16) & 255) / 255), f(((hex >> 8) & 255) / 255), f((hex & 255) / 255)];
}
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/**
 * Where the sun is, from a clock time.
 *
 * `elevation` rides a sine between sunrise and sunset and goes negative outside them, so 20:00
 * with a 18:00 sunset is dusk and not a second noon. `maxElevation` stands in for a latitude.
 *
 * `direction` is the unit vector FROM the world TOWARD the sun. Azimuth is measured clockwise
 * from north (-Z) seen from above, so east (+X) is 90.
 */
export function sunPosition(THREE, { hour = 16.5, azimuth = 250, elevation, sunrise = 6, sunset = 18, maxElevation = 62 } = {}) {
  let el = elevation;
  if (!Number.isFinite(el)) {
    const day = Math.max(1e-3, sunset - sunrise);
    const t = (hour - sunrise) / day;             // 0 at sunrise, 1 at sunset
    el = maxElevation * Math.sin(Math.PI * t);    // negative outside the day, which is what we want
    if (el < -12) el = -12;                       // below that the sky has stopped changing
  }
  const az = azimuth * Math.PI / 180, e = el * Math.PI / 180;
  const c = Math.cos(e);
  const direction = new THREE.Vector3(Math.sin(az) * c, Math.sin(e), -Math.cos(az) * c).normalize();
  return { elevation: el, azimuth, direction };
}

/**
 * The atmosphere, as five keyframes on sun elevation, in LINEAR radiance before the ACES curve.
 * Everything else in the rig is derived from whichever of these the current elevation lands on:
 * the sky dome, the environment map, the hemisphere fill, the haze colour and the sun's own
 * colour and strength. One table, so the rig cannot disagree with itself.
 *
 * The `12` row is a solve rather than a guess: it is the golden hour palette from a daylight
 * build of ours, arrived at over three critic rounds against real reference frames. The rows
 * above and below it are that palette carried to other elevations and checked by eye.
 *
 * The stops are radiance at 0, 12, 35, 55 and 85 degrees up from the horizon; `haze` is the band
 * that sits on the horizon, `below` the dome under it, `sunGlow` the halo around the disc.
 */
export const ATMOS_KEYS = [
  { el: -8,                                    // night, or well after sunset
    horizon: [0.070, 0.062, 0.075], low: [0.045, 0.046, 0.064], mid: [0.026, 0.031, 0.052], high: [0.018, 0.024, 0.046], zenith: [0.012, 0.018, 0.038],
    haze: [0.090, 0.072, 0.078], below: [0.040, 0.038, 0.045], sunGlow: [0.30, 0.18, 0.12],
    sun: 0xffa060, intensity: 0.35, exposure: 1.25 },
  { el: 2,                                     // the sun on the horizon
    horizon: [1.450, 0.620, 0.300], low: [0.720, 0.440, 0.340], mid: [0.300, 0.300, 0.380], high: [0.180, 0.220, 0.350], zenith: [0.100, 0.150, 0.300],
    haze: [1.600, 0.660, 0.320], below: [0.620, 0.420, 0.340], sunGlow: [1.00, 0.52, 0.24],
    sun: 0xffab6a, intensity: 12.0, exposure: 1.0 },
  { el: 12,                                    // golden hour: the solved row
    horizon: [1.250, 0.780, 0.480], low: [0.640, 0.520, 0.430], mid: [0.330, 0.360, 0.420], high: [0.210, 0.270, 0.390], zenith: [0.140, 0.200, 0.340],
    haze: [1.350, 0.850, 0.520], below: [0.700, 0.560, 0.450], sunGlow: [1.00, 0.70, 0.40],
    sun: 0xffcd96, intensity: 16.0, exposure: 1.0 },
  { el: 35,                                    // mid afternoon
    horizon: [0.720, 0.800, 0.950], low: [0.460, 0.580, 0.820], mid: [0.330, 0.480, 0.850], high: [0.210, 0.360, 0.760], zenith: [0.140, 0.270, 0.680],
    haze: [0.850, 0.900, 1.020], below: [0.420, 0.440, 0.480], sunGlow: [1.00, 0.85, 0.66],
    sun: 0xffe3c0, intensity: 8.5, exposure: 1.0 },
  { el: 70,                                    // noon
    horizon: [0.850, 0.960, 1.200], low: [0.550, 0.720, 1.050], mid: [0.400, 0.620, 1.150], high: [0.260, 0.470, 1.050], zenith: [0.180, 0.360, 0.950],
    haze: [0.950, 1.050, 1.250], below: [0.480, 0.520, 0.580], sunGlow: [1.00, 0.94, 0.86],
    sun: 0xfff2e2, intensity: 6.2, exposure: 0.95 },
];

const STOPS = ['horizon', 'low', 'mid', 'high', 'zenith', 'haze', 'below', 'sunGlow'];

/** The atmosphere at one elevation, interpolated between the two keyframes it sits between. */
function atmosphereAt(elevation) {
  const K = ATMOS_KEYS;
  let i = 0;
  while (i < K.length - 2 && elevation > K[i + 1].el) i++;
  const a = K[i], b = K[i + 1];
  const t = clamp((elevation - a.el) / (b.el - a.el), 0, 1);
  const out = {};
  for (const s of STOPS) out[s] = mix3(a[s], b[s], t);
  out.sun = mix3(hexToLinear(a.sun), hexToLinear(b.sun), t);
  out.intensity = mix(a.intensity, b.intensity, t);
  out.exposure = mix(a.exposure, b.exposure, t);
  return out;
}

/* ---------------------------------------------------------------- GLSL */

const ATMOS_PARS = /* glsl */`
uniform vec3 uAtmHorizon, uAtmLow, uAtmMid, uAtmHigh, uAtmZenith, uAtmHaze, uAtmBelow, uAtmSunGlow;
uniform vec3 uAtmSunDir;
uniform float uAerDensity, uAerLift, uAerStart;
`;

/**
 * The atmosphere model, shared verbatim by the dome, the environment map and the haze in every
 * material. `atmosSky(dir)` is the linear radiance of the sky in a direction; `aerialAmount()`
 * is how much of it a fragment at that depth has picked up.
 */
const ATMOS_GLSL = /* glsl */`
vec3 atmosSky(vec3 d) {
  float y = clamp(d.y, -1.0, 1.0);
  float el = asin(y);
  vec3 col = mix(uAtmHorizon, uAtmLow, smoothstep(0.0, 0.21, el));
  col = mix(col, uAtmMid, smoothstep(0.17, 0.61, el));
  col = mix(col, uAtmHigh, smoothstep(0.58, 0.96, el));
  col = mix(col, uAtmZenith, smoothstep(0.90, 1.55, el));
  // the haze band: thickest on the horizon, gone by about eight degrees
  float band = pow(1.0 - clamp(el / 0.14, 0.0, 1.0), 1.7);
  col = mix(col, uAtmHaze, band * 0.8);
  float sd = max(dot(d, uAtmSunDir), 0.0);
  float glow = pow(sd, 6.0) * 0.18 + pow(sd, 48.0) * 0.5;
  // the glow spreads along the horizon toward the sun's bearing, not just around the disc
  float az = max(dot(normalize(vec3(d.x, 0.0, d.z) + 1e-5), normalize(vec3(uAtmSunDir.x, 0.0, uAtmSunDir.z) + 1e-5)), 0.0);
  glow += pow(az, 3.0) * 0.10 * (1.0 - smoothstep(0.0, 0.5, el));
  col += uAtmSunGlow * glow;
  col = mix(col, uAtmBelow, smoothstep(0.004, -0.02, y));
  return col;
}
float aerialAmount(float depth, float dirY) {
  float t = max(depth - uAerStart, 0.0);
  float k = uAerDensity * (1.0 + uAerLift * clamp(dirY, 0.0, 0.5) * 2.0);
  return 1.0 - exp(-t * k);
}
`;

/**
 * AERIAL PERSPECTIVE. Replace three's fog_fragment with a mix toward the sky in this pixel's own
 * view direction. It runs before tone mapping, in linear HDR, so the hazed geometry and the dome
 * agree exactly where they meet at the horizon.
 *
 * This is the difference between depth and a grey wash. Flat fog gives every direction the same
 * colour, so a building against a bright horizon and a building against the zenith fade to the
 * same value and the frame goes flat at exactly the distance the fog starts.
 */
function aerialPatch(shader, uniforms) {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <fog_pars_vertex>', '#include <fog_pars_vertex>\nvarying vec3 vAerDir;')
    .replace('#include <fog_vertex>', '#include <fog_vertex>\nvAerDir = transpose(mat3(viewMatrix)) * mvPosition.xyz;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <fog_pars_fragment>', '#include <fog_pars_fragment>\nvarying vec3 vAerDir;\n' + ATMOS_PARS + ATMOS_GLSL)
    .replace('#include <fog_fragment>', /* glsl */`
#ifdef USE_FOG
  {
    vec3 aerD = normalize(vAerDir);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, atmosSky(aerD), aerialAmount(vFogDepth, aerD.y));
  }
#endif`);
}

/**
 * THE GROUND BOUNCE, and the reason shade has a direction rather than a colour.
 *
 * Added to `irradiance` right where three has finished summing the ambient and hemisphere terms
 * and before it folds them through the material's own Lambert term, so it is lit exactly as the
 * hemisphere is: albedo applies, metalness applies, it is light and not a tint.
 *
 * Weighted by the WORLD normal, which is the whole point:
 *   - an UNDERSIDE (an awning soffit, a balcony, the underneath of a vehicle) sees nothing but
 *     sunlit ground, so it gets `uBounceUnder` times the term and stays warm;
 *   - a WALL sees half a hemisphere of mostly shadowed ground beside it, so it gets `uBounceSide`,
 *     which is small, and the cool sky term wins: the wall goes blue and the soffit above it does
 *     not. Raise `bounceSide` and the two temperatures collapse into one neutral grey. That is
 *     the exact failure this weighting exists to avoid, and it was diagnosed by a critic as
 *     "the shaded face is the same cream as the lit face, only darker";
 *   - an UP-FACING surface in shadow sees sunlit ground and sunlit walls all round it, so it gets
 *     `uBounceFlat`, which keeps a shaded road blue GREY instead of blue.
 */
const BOUNCE_PARS = /* glsl */`
uniform vec3 uBounce;
uniform float uBounceUnder, uBounceSide, uBounceFlat;`;
const BOUNCE_FS = /* glsl */`
#if defined( RE_IndirectDiffuse )
{
  vec3 bN = normalize( ( vec4( geometryNormal, 0.0 ) * viewMatrix ).xyz );
  float bW = smoothstep( 0.15, 0.6, 1.0 - abs( bN.y ) ) * uBounceSide
           + clamp( -bN.y, 0.0, 1.0 ) * uBounceUnder
           + smoothstep( 0.4, 0.9, bN.y ) * uBounceFlat;
  irradiance += uBounce * bW;
}
#endif`;
function bouncePatch(shader, uniforms) {
  Object.assign(shader.uniforms, uniforms);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>' + BOUNCE_PARS)
    // CSM has already replaced lights_fragment_begin with expanded text, so hook the neighbour
    .replace('#include <lights_fragment_maps>', BOUNCE_FS + '\n#include <lights_fragment_maps>');
}

/**
 * THE ENVIRONMENT'S DIFFUSE SHARE. `scene.environmentIntensity` scales both the reflection and
 * the diffuse fill, and those want different numbers. The PMREM is a good reflection and a poor
 * fill: it has no direction to it that the hemisphere does not already have, and at full strength
 * a vertical face integrates the whole warm horizon band and goes neutral, which is the grey that
 * eats the second colour temperature. So the specular keeps `envIntensity` and the diffuse is
 * scaled by `envDiffuse` here.
 */
const ENVD_PARS = /* glsl */`
uniform float uEnvDiffuse;`;
const ENVD_FS = /* glsl */`
#if defined( RE_IndirectDiffuse )
  iblIrradiance *= uEnvDiffuse;
#endif`;
function envDiffusePatch(shader, uniforms) {
  Object.assign(shader.uniforms, uniforms);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>' + ENVD_PARS)
    .replace('#include <lights_fragment_maps>', '#include <lights_fragment_maps>' + ENVD_FS);
}

/**
 * SUN WRAP, on up-facing surfaces only.
 *
 * Under a low sun every horizontal surface, which in a game where you move along the ground is
 * most of the screen, takes `sin(elevation)` of the key: at 14 degrees that is 24 percent, and
 * the road can never read as sunlit however bright the sun is. `pow(dotNL, 0.65)` takes it to
 * about 37 percent while leaving a face square to the sun untouched.
 *
 * It is deliberately NOT applied to vertical faces. Applied everywhere, it puts a third of the
 * key onto a wall ten degrees short of the terminator, and that wall then sums a warm sun with a
 * cool fill to a neutral grey: the second colour temperature disappears on exactly the surfaces
 * where you were looking for it. Walls take the plain Lambert sun plus a small toe, so a face
 * near the terminator sees only the fill and reads cool.
 *
 * Returns false and changes nothing if the chunk it needs is not the shape it expects, which is
 * the honest behaviour for a shader patch against a library version it has not seen.
 */
const WRAP_PARS = /* glsl */`
uniform float uSunWrap, uSunToe;`;
function wrapPatch(shader, THREE, uniforms) {
  Object.assign(shader.uniforms, uniforms);
  const chunk = THREE.ShaderChunk.lights_physical_pars_fragment;
  const line = 'vec3 irradiance = dotNL * directLight.color;';
  if (!chunk || !chunk.includes(line) || !shader.fragmentShader.includes('#include <lights_physical_pars_fragment>')) return false;
  const up = 'clamp( dot( geometryNormal, ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz ), 0.0, 1.0 )';
  const term = /* glsl */`
	float sunUpW = smoothstep( 0.25, 0.75, ${up} );
	float sunToe = uSunToe * ( 1.0 - sunUpW );
	float sunNL = max( dotNL - sunToe, 0.0 ) / max( 1.0 - sunToe, 1e-4 );
	vec3 irradiance = pow( sunNL, mix( 1.0, uSunWrap, sunUpW ) ) * directLight.color;`;
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>' + WRAP_PARS)
    .replace('#include <lights_physical_pars_fragment>', chunk.replace(line, term));
  return true;
}

/* ------------------------------------------------------------- the sky */

const SKY_VS = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  p.z = p.w * 0.999999;          // pinned to the far plane, so nothing can ever be behind it
  gl_Position = p;
}`;
const SKY_FS = ATMOS_PARS + ATMOS_GLSL + /* glsl */`
uniform vec3 uSunDisc;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  vec3 col = atmosSky(d);
  float sd = max(dot(d, uAtmSunDir), 0.0);
  col = mix(col, uSunDisc, smoothstep(0.99925, 0.99965, sd));   // about half a degree across
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/**
 * The environment map: the same atmosphere rendered into a small dome and filtered by PMREM. The
 * sky above the horizon at just over half strength, because this is the sky as a LIGHT and not as
 * a picture, and a warm ground below it taken from the bounce colour so the reflection in a
 * puddle and the light on a soffit come from the same place.
 *
 * Built at load and again on `setTime()`. Never per frame.
 */
function buildEnvironment(THREE, renderer, uniforms, ground) {
  const envScene = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uEnvGround: { value: new THREE.Color(ground[0], ground[1], ground[2]) } },
    vertexShader: 'varying vec3 vDir;\nvoid main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: ATMOS_PARS + ATMOS_GLSL + /* glsl */`
uniform vec3 uEnvGround;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float g = smoothstep(0.10, -0.06, d.y);
  gl_FragColor = vec4(mix(atmosSky(d) * 0.55, uEnvGround, g), 1.0);
}`,
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, toneMapped: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), mat);
  envScene.add(dome);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let tex = null;
  try { tex = pmrem.fromScene(envScene, 0.02, 1, 100).texture; }
  catch (e) { console.warn('[rig] environment build failed:', e && e.message); }
  pmrem.dispose(); dome.geometry.dispose(); mat.dispose();
  return tex;
}

/* ---------------------------------------------------------------- bloom */

const QUAD_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

/**
 * Threshold bloom. Half resolution bright pass, two separable blurs at quarter resolution, a
 * plain composite.
 *
 * The threshold is derived from the key's own intensity in `createRig`, so it sits above what a
 * white diffuse surface in full sun can reach and below the sun disc, a specular hit and an
 * emissive lens. A bloom that lifts diffuse surfaces is a milk filter.
 *
 * The NaN guard is not defensive coding. One Inf pixel from a degenerate normal, spread by two
 * blurs, comes back as a hard-edged black square eighty pixels across, and it took two rounds of
 * filmstrips to find that on the build this came from.
 *
 * If you add sparks or tracers, read the bloom trap in docs/traps.md first: at quarter resolution
 * a two pixel spark becomes a forty pixel disc, and it reads as bokeh rather than as speed.
 */
function makeBloom(THREE, Pass, FullScreenQuad, w, h, { threshold, strength, radius }) {
  const BRIGHT_FS = /* glsl */`
uniform sampler2D tDiffuse; uniform float uThreshold, uKnee; varying vec2 vUv;
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  if (!(c.r == c.r) || !(c.g == c.g) || !(c.b == c.b)) c = vec3(0.0);
  c = min(c, vec3(256.0));
  float l = max(max(c.r, c.g), c.b);
  float soft = clamp((l - uThreshold + uKnee) / (2.0 * uKnee), 0.0, 1.0);
  soft = soft * soft * uKnee;
  gl_FragColor = vec4(c * (max(soft, l - uThreshold) / max(l, 1e-4)), 1.0);
}`;
  const BLUR_FS = /* glsl */`
uniform sampler2D tDiffuse; uniform vec2 uStep; varying vec2 vUv;
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb * 0.2270270270;
  c += (texture2D(tDiffuse, vUv + uStep * 1.3846153846).rgb + texture2D(tDiffuse, vUv - uStep * 1.3846153846).rgb) * 0.3162162162;
  c += (texture2D(tDiffuse, vUv + uStep * 3.2307692308).rgb + texture2D(tDiffuse, vUv - uStep * 3.2307692308).rgb) * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}`;
  const COMP_FS = /* glsl */`
uniform sampler2D tDiffuse, tBloom; uniform float uStrength; varying vec2 vUv;
void main() { gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb + texture2D(tBloom, vUv).rgb * uStrength, 1.0); }`;

  class ThresholdBloomPass extends Pass {
    constructor() {
      super();
      this.radius = radius;
      const opts = { type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace, depthBuffer: false, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
      this.rtBright = new THREE.WebGLRenderTarget(1, 1, opts);
      this.rtA = new THREE.WebGLRenderTarget(1, 1, opts);
      this.rtB = new THREE.WebGLRenderTarget(1, 1, opts);
      const mat = (fs, uniforms) => new THREE.ShaderMaterial({ uniforms, vertexShader: QUAD_VS, fragmentShader: fs, depthTest: false, depthWrite: false, blending: THREE.NoBlending });
      this.bright = mat(BRIGHT_FS, { tDiffuse: { value: null }, uThreshold: { value: threshold }, uKnee: { value: 0.25 } });
      this.blur = mat(BLUR_FS, { tDiffuse: { value: null }, uStep: { value: new THREE.Vector2() } });
      this.comp = mat(COMP_FS, { tDiffuse: { value: null }, tBloom: { value: null }, uStrength: { value: strength } });
      this.quad = new FullScreenQuad(this.bright);
      this.setSize(w, h);
    }
    setSize(w2, h2) {
      this.rtBright.setSize(Math.max(1, Math.round(w2 / 2)), Math.max(1, Math.round(h2 / 2)));
      this.qw = Math.max(1, Math.round(w2 / 4)); this.qh = Math.max(1, Math.round(h2 / 4));
      this.rtA.setSize(this.qw, this.qh); this.rtB.setSize(this.qw, this.qh);
    }
    setThreshold(v) { this.bright.uniforms.uThreshold.value = v; }
    render(renderer, writeBuffer, readBuffer) {
      const autoClear = renderer.autoClear; renderer.autoClear = false;
      this.bright.uniforms.tDiffuse.value = readBuffer.texture; this.quad.material = this.bright;
      renderer.setRenderTarget(this.rtBright); renderer.clear(); this.quad.render(renderer);
      const step = 1 + this.radius;
      this.quad.material = this.blur;
      this.blur.uniforms.tDiffuse.value = this.rtBright.texture; this.blur.uniforms.uStep.value.set(step / this.qw, 0);
      renderer.setRenderTarget(this.rtA); renderer.clear(); this.quad.render(renderer);
      this.blur.uniforms.tDiffuse.value = this.rtA.texture; this.blur.uniforms.uStep.value.set(0, step / this.qh);
      renderer.setRenderTarget(this.rtB); renderer.clear(); this.quad.render(renderer);
      // composite as a normal full-screen write into the write buffer, never an additive draw onto
      // the multisampled read buffer: that path intermittently returned a black half-frame for us
      this.comp.uniforms.tDiffuse.value = readBuffer.texture; this.comp.uniforms.tBloom.value = this.rtB.texture;
      this.quad.material = this.comp;
      renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
      if (this.clear) renderer.clear();
      this.quad.render(renderer);
      renderer.autoClear = autoClear;
    }
    dispose() { this.rtBright.dispose(); this.rtA.dispose(); this.rtB.dispose(); this.bright.dispose(); this.blur.dispose(); this.comp.dispose(); this.quad.dispose(); }
  }
  return new ThresholdBloomPass();
}

/* ------------------------------------------------------------- the rig */

const isLit = (m) => !!m && (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial);
const isFoggable = (m) => !!m && m.fog !== false && (isLit(m) || m.isMeshBasicMaterial || (m.isShaderMaterial && m.fog === true));

export function createRig(THREE, renderer, scene, opts = {}) {
  const T = getTier(opts.tier);
  const o = {
    hour: 16.5, azimuth: 250, sunrise: 6, sunset: 18, maxElevation: 62,
    fill: 1, fillChroma: 1.4, bounce: 1, bounceUnder: 8.0, bounceSide: 0.15, bounceFlat: 3.5,
    envIntensity: 1.0, envDiffuse: 0.10,
    sky: true, fog: T.fog !== false, fogStart: 40, fogDensity: 0.0021,
    wrap: 0.65, toe: 0.12, shadows: true, background: true,
    post: T.post, bloom: true, bloomStrength: 0.28, bloomRadius: 0.35,
    refreshEvery: 15, capEnv: 0.8, CSM: null,
    ...opts,
  };
  const shadowMap = o.shadowMap || T.shadowMap;
  const shadowDist = o.shadowDist || T.shadowDist;
  const cascades = o.cascades || T.cascades;

  // The colour pipeline, fixed here, once, so no other module can leave the frame in linear space
  // or on a different curve. This is the whole of the "grade": a curve and an exposure.
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = !!o.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  try { renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, T.pixelRatio)); } catch (e) { /* headless */ }

  /* --- state that every derived number comes from --------------------- */

  let time = { hour: o.hour, azimuth: o.azimuth, elevation: o.elevation };
  let sunPos = sunPosition(THREE, { ...time, sunrise: o.sunrise, sunset: o.sunset, maxElevation: o.maxElevation });
  let atm = atmosphereAt(sunPos.elevation);
  // The key's current linear intensity, kept here rather than read back off a light, because
  // once the cascades exist the plain `sun` light is parked at zero and reading its intensity
  // gives you nothing. The bloom threshold is derived from this number in two places, and the
  // composer builds asynchronously, so it cannot read it from wherever the key happens to live.
  let keyIntensity = 0;
  let warnedNight = false;

  const col = (v) => ({ value: new THREE.Color(v[0], v[1], v[2]) });
  const atmosU = {
    uAtmHorizon: col(atm.horizon), uAtmLow: col(atm.low), uAtmMid: col(atm.mid), uAtmHigh: col(atm.high),
    uAtmZenith: col(atm.zenith), uAtmHaze: col(atm.haze), uAtmBelow: col(atm.below), uAtmSunGlow: col(atm.sunGlow),
    uAtmSunDir: { value: sunPos.direction.clone() },
    uAerDensity: { value: o.fogDensity },
    uAerLift: { value: 1.2 },
    uAerStart: { value: o.fogStart },
  };
  const bounceU = {
    uBounce: { value: new THREE.Color(0, 0, 0) },
    uBounceUnder: { value: o.bounceUnder },
    uBounceSide: { value: o.bounceSide },
    uBounceFlat: { value: o.bounceFlat },
  };
  const wrapU = { uSunWrap: { value: o.wrap }, uSunToe: { value: o.toe } };
  const envdU = { uEnvDiffuse: { value: o.envDiffuse } };

  /* --- the lights ----------------------------------------------------- */

  // The cool fill, part one. Its colour is the sky the atmosphere table says is up there, not a
  // blue somebody liked, which is what keeps the fill and the dome the same weather.
  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
  hemi.name = 'rig.fill';
  scene.add(hemi);

  // The warm key. A plain DirectionalLight until CSM arrives; if CSM never arrives this stays and
  // its shadow camera is snapped to the camera instead. Either way `rig.sun` is a real light.
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.name = 'rig.sun';
  sun.castShadow = !!o.shadows;
  sun.shadow.mapSize.set(shadowMap, shadowMap);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = shadowDist * 4;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = T.name === 'phone' ? 0.08 : 0.035;
  scene.add(sun);
  scene.add(sun.target);

  const fog = new THREE.Fog(0xffffff, 1, 1);
  if (o.fog) scene.fog = fog;

  let skyMesh = null;
  const skyU = { ...atmosU, uSunDisc: { value: new THREE.Color(0, 0, 0) } };
  if (o.sky) {
    const skyMat = new THREE.ShaderMaterial({
      uniforms: skyU, vertexShader: SKY_VS, fragmentShader: SKY_FS,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    skyMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), skyMat);
    skyMesh.frustumCulled = false;
    skyMesh.renderOrder = -1000;
    skyMesh.name = 'rig.sky';
    scene.add(skyMesh);
  }

  let envTex = null;

  /**
   * Bloom above what a white diffuse surface in full sun can reach. A Lambert BRDF puts a 0.8
   * albedo face square to the key at intensity * 0.8 / PI, so a third above that is clear of every
   * diffuse surface in the frame and still under the disc, a specular hit and a lens.
   *
   * It reads `keyIntensity` and not a light, and that is the whole reason this is a function.
   * The composer is imported asynchronously and builds a few microtasks after the cascades do, by
   * which time the plain `sun` light has been parked at zero; the version that read `sun.intensity`
   * there got 0, fell to the 0.6 floor, and shipped a threshold six times too low. At 0.6 a lit
   * concrete floor is over the line, so every diffuse surface in the frame blooms, which is the
   * milk filter this rig says three lines above that it does not do. It was invisible in a still.
   */
  const bloomThreshold = () =>
    (Number.isFinite(o.bloomThreshold) ? o.bloomThreshold : Math.max(0.6, keyIntensity * (0.8 / Math.PI) * 1.35));

  /**
   * Everything the time of day decides, in one place. Called at construction and by setTime().
   *
   * The sun's colour and strength, the sky stops, the fill colour, the fill strength, the bounce
   * colour, the haze colour and the bloom threshold are all read off the same atmosphere row, so
   * "late afternoon" is one number and the frame that comes out is coherent.
   */
  function applyTime() {
    sunPos = sunPosition(THREE, { hour: time.hour, azimuth: time.azimuth, elevation: time.elevation, sunrise: o.sunrise, sunset: o.sunset, maxElevation: o.maxElevation });
    atm = atmosphereAt(sunPos.elevation);
    renderer.toneMappingExposure = Number.isFinite(o.exposure) ? o.exposure : atm.exposure;
    for (const s of STOPS) atmosU['uAtm' + s[0].toUpperCase() + s.slice(1)].value.setRGB(atm[s][0], atm[s][1], atm[s][2]);
    atmosU.uAtmSunDir.value.copy(sunPos.direction);

    // The key fades out as the sun crosses the horizon and is gone below it. Left on, a
    // DirectionalLight whose direction has gone negative lights every UNDERSIDE in the scene,
    // which reads as the world glowing from underneath and is very hard to attribute.
    const below = clamp((sunPos.elevation + 0.5) / 2.0, 0, 1);
    const sunI = (Number.isFinite(o.sunIntensity) ? o.sunIntensity : atm.intensity) * below;
    keyIntensity = sunI;
    const sunLin = Number.isFinite(o.sunColor) ? hexToLinear(o.sunColor) : atm.sun;
    sun.color.setRGB(sunLin[0], sunLin[1], sunLin[2]);
    // once the cascades exist they ARE the key; the plain light is out of the scene and left at
    // zero, or a second unshadowed sun appears the first time setTime() is called
    sun.intensity = csm ? 0 : sunI;
    for (const l of csmLights()) { l.color.copy(sun.color); l.intensity = sunI; }
    // A light of intensity 0 still renders a shadow map, because three keys that off castShadow
    // and not off intensity: below the horizon that is a whole pass for nothing. Measured on one
    // night scene: 1004 draw calls and 19k triangles a frame, all of it discarded.
    for (const l of csmLights()) l.castShadow = !!o.shadows && sunI > 0.01;
    if (!csm) sun.castShadow = !!o.shadows && sunI > 0.01;
    // And say the quiet part out loud, once. Below the horizon this rig is a sky and a haze: the
    // key is off by construction and the warm ground bounce goes with it, so a night scene lit by
    // the rig ALONE has one colour temperature, which is the failure the rig exists to prevent.
    if (sunPos.elevation < 0 && !warnedNight) {
      warnedNight = true;
      console.warn('[rig] the sun is below the horizon: the key light and the warm bounce are off, ' +
        'so the rig is giving you sky fill, haze and a sky only. A night scene needs its own practical ' +
        'lights (emissive surfaces plus a few point or spot lights at the lamps); see the header of harness/rig.js.');
    }

    // The fill's colour is the sky a vertical face actually sees: the band between 12 and 55
    // degrees is most of the solid angle above a wall's horizon. Normalised to a hue and carried
    // as an intensity, because a HemisphereLight's colour is a direction in colour space and its
    // intensity is how much of it there is.
    // The chroma boost is not decoration. Almost every surface in a game is warm (concrete,
    // timber, plaster, dirt, skin), and a warm albedo under the literal sky colour comes back
    // NEUTRAL: measured on a shaded whitewashed wall in the build this came from, the sky's own
    // colour reached only B minus R +16 where the reference frames sat at +30 to +40. Pushing the
    // fill's chroma away from neutral is what survives the multiply.
    const skyLin = mix3(atm.mid, atm.high, 0.45);
    const skyMag = Math.max(1e-4, lum(skyLin));
    const ch = (v) => 1 + (v / skyMag - 1) * o.fillChroma;
    hemi.color.setRGB(ch(skyLin[0]), ch(skyLin[1]), ch(skyLin[2]));
    // The hemisphere's GROUND term is what a wall sees below its horizon. Kept cool and dim: the
    // warm half of what a wall sees is the bounce term, which is weighted by normal, and this one
    // is not. A warm ground term here would warm every wall equally and take the second
    // temperature back out.
    const gndLin = mix3(skyLin, atm.below, 0.18);
    const gndMag = Math.max(1e-4, lum(gndLin));
    const cg = (v) => (1 + (v / gndMag - 1) * o.fillChroma * 0.7) * 0.62;
    hemi.groundColor.setRGB(cg(gndLin[0]), cg(gndLin[1]), cg(gndLin[2]));
    hemi.intensity = skyMag * 5.4 * o.fill;

    // The bounce: the key's own colour, reflected off a warm neutral ground, scaled by how much
    // of the key that ground is catching. It follows the sun round the sky for free.
    const cosSun = Math.max(0, Math.sin(sunPos.elevation * Math.PI / 180));
    const k = sunI * cosSun * 0.034 * o.bounce;
    bounceU.uBounce.value.setRGB(sunLin[0] * k, sunLin[1] * k, sunLin[2] * k);

    // Haze colour for anything the aerial patch never reached (sprites, points, a material with
    // no fog chunks). Horizon radiance through the same ACES curve the rest of the frame takes.
    const hz = atm.haze;
    const tm = (v) => { const x = v * (renderer.toneMappingExposure || 1); return Math.min(1, Math.max(0, (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14))); };
    fog.color.setRGB(tm(hz[0]), tm(hz[1]), tm(hz[2]), THREE.SRGBColorSpace);
    fog.near = o.fogStart;
    fog.far = o.fogStart + 3 / Math.max(1e-6, o.fogDensity) * 0.35;
    if (o.background) {
      if (!scene.background || !scene.background.isColor) scene.background = new THREE.Color();
      scene.background.copy(fog.color);
    }

    if (skyMesh) skyU.uSunDisc.value.setRGB(sunLin[0] * sunI * 0.9, sunLin[1] * sunI * 0.9, sunLin[2] * sunI * 0.9);

    // The environment. Rebuilt because its content is the atmosphere, and the atmosphere moved.
    const groundLin = [bounceU.uBounce.value.r * 1.6 + 0.02, bounceU.uBounce.value.g * 1.6 + 0.02, bounceU.uBounce.value.b * 1.6 + 0.02];
    const next = opts.envMap || buildEnvironment(THREE, renderer, atmosU, groundLin);
    if (next) {
      if (envTex && envTex !== opts.envMap && scene.environment === envTex) envTex.dispose();
      envTex = next;
      scene.environment = envTex;
      scene.environmentIntensity = o.envIntensity;
    }

    if (post && post.bloom) post.bloom.setThreshold(bloomThreshold());
  }

  /* --- cascades ------------------------------------------------------- */

  let csm = null;
  let camera = opts.camera || null;
  let pendingCSM = null;
  const csmLights = () => (csm ? csm.lights : []);

  function buildCSM(CSM, cam) {
    csm = new CSM({
      camera: cam, parent: scene, cascades, maxFar: shadowDist, mode: 'practical',
      shadowMapSize: shadowMap, shadowBias: -0.0002,
      lightDirection: sunPos.direction.clone().negate(),   // CSM wants the direction light travels
      lightIntensity: sun.intensity,
      lightNear: 1, lightFar: shadowDist * 6,
      // how far up-sun the shadow camera sits behind the cascade box: a 24 m building under a
      // 14 degree sun throws a 96 m shadow, and it has to still be inside the box to cast one
      lightMargin: Math.max(60, shadowDist * 1.6),
    });
    csm.fade = true;
    for (const l of csm.lights) {
      l.color.copy(sun.color);
      l.intensity = sun.intensity;
      l.shadow.normalBias = T.name === 'phone' ? 0.08 : 0.035;
      l.name = 'rig.sun';
    }
    csm.updateFrustums();
    // the plain light steps aside entirely; `rig.sun` becomes the first cascade's light
    sun.castShadow = false;
    sun.intensity = 0;
    scene.remove(sun); scene.remove(sun.target);
    // Everything compiled before the cascades existed has to be patched again for the cascade
    // uniforms. setupMaterial() restores each material's original hook first, so this is a
    // re-patch and not a second one stacked on the first.
    done = new WeakSet();
    refresh();
  }

  const ready = (async () => {
    if (!o.shadows) return null;
    let CSM = o.CSM;
    if (!CSM) {
      try { ({ CSM } = await import(/* @vite-ignore */ 'three/addons/csm/CSM.js')); }
      catch (e) {
        console.info('[rig] no three/addons/csm/CSM.js; using a single snapped shadow camera. Add "three/addons/" to your import map for cascades.');
        return null;
      }
    }
    if (camera) buildCSM(CSM, camera);
    else pendingCSM = CSM;
    return CSM;
  })();

  /* --- material setup -------------------------------------------------- */

  let done = new WeakSet();
  // What each material had before the rig touched it. Patching is not idempotent, and the rig
  // patches a second time when the cascades arrive, so the original hook has to be recoverable.
  const original = new WeakMap();
  let receivers = 0, meshes = 0, warned = false;

  /**
   * Patch one material, once. Nothing here writes a material VALUE, so assetlib's merge key is
   * unchanged and anything that merged before still merges.
   */
  function setupMaterial(m) {
    if (!m || done.has(m)) return false;
    const lit = isLit(m), foggable = isFoggable(m);
    if (!lit && !foggable) return false;
    done.add(m);

    // A material that asked for more environment than the scene has was tuned against somebody
    // else's fill. Left alone, car paint under this rig's environment reads as a sky mirror and a
    // red body goes salmon in sun and magenta in shade (see the clearcoat trap in docs/traps.md).
    if (lit && typeof m.envMapIntensity === 'number' && m.envMapIntensity > 1 && m.envMapIntensity > o.capEnv) {
      m.envMapIntensity = o.capEnv;
    }

    const useBounce = lit && o.bounce !== 0;
    const useEnvD = lit && o.envDiffuse !== 1;
    const useWrap = lit && !!m.isMeshStandardMaterial && (o.wrap !== 1 || o.toe > 0);
    // CSM replaces onBeforeCompile outright, and so does this. Keep whatever the material had
    // before the rig ever saw it and run all of them, and keep the program cache keys distinct so
    // two differently patched materials do not silently share one program.
    let rec = original.get(m);
    if (!rec) {
      const h = m.onBeforeCompile;
      rec = {
        hook: (typeof h === 'function' && h !== THREE.Material.prototype.onBeforeCompile) ? h : null,
        key: (typeof m.customProgramCacheKey === 'function' && m.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey) ? m.customProgramCacheKey : null,
      };
      original.set(m, rec);
    } else {
      m.onBeforeCompile = rec.hook || THREE.Material.prototype.onBeforeCompile;
      m.customProgramCacheKey = rec.key || THREE.Material.prototype.customProgramCacheKey;
    }
    const prevHook = rec.hook, hasPrev = !!rec.hook;
    const prevKey = rec.key ? rec.key.call(m) : '';
    let csmHook = null;
    if (lit && csm) { csm.setupMaterial(m); csmHook = m.onBeforeCompile; }
    m.onBeforeCompile = function (shader, r) {
      if (hasPrev) prevHook.call(this, shader, r);
      if (csmHook) csmHook.call(this, shader, r);
      if (useBounce) bouncePatch(shader, bounceU);
      if (useEnvD) envDiffusePatch(shader, envdU);
      if (useWrap) wrapPatch(shader, THREE, wrapU);
      if (foggable) aerialPatch(shader, atmosU);
    };
    m.customProgramCacheKey = () => (hasPrev ? prevKey : '') + (csmHook ? '|csm' + cascades : '') +
      (useBounce ? '|bnc' : '') + (useEnvD ? '|envd' : '') + (useWrap ? '|wrap' : '') + (foggable ? '|aer' : '');
    // A game that patches its own materials and then checks "is my hook still the one installed"
    // will see this composite instead, read it as its patch being dropped, and re-wrap every
    // frame until the shader stops compiling and everything it touched draws nothing. Leave a
    // marker so that check can be written correctly: if `userData.rigPatched` is set, the rig has
    // your hook and is calling it, and you must not re-wrap.
    m.userData = m.userData || {};
    m.userData.rigPatched = true;
    m.needsUpdate = true;
    return true;
  }

  /** Sweep a subtree and patch every material under it. Safe to call as often as you like. */
  function refresh(root = scene) {
    let n = 0;
    receivers = 0; meshes = 0;
    root.traverse((ob) => {
      if (ob.isMesh) { meshes++; if (ob.receiveShadow) receivers++; }
      const m = ob.material;
      if (!m) return;
      if (Array.isArray(m)) { for (const mm of m) if (setupMaterial(mm)) n++; }
      else if (setupMaterial(m)) n++;
    });
    if (!warned && o.shadows && meshes > 4 && receivers === 0) {
      warned = true;
      console.warn('[rig] ' + meshes + ' meshes and not one of them has receiveShadow. Nothing in this scene is standing on anything. ASSET() sets both flags; a ground plane you built yourself does not.');
    }
    return n;
  }

  /* --- post ------------------------------------------------------------ */

  let post = null;
  const postReady = (async () => {
    if (!o.post) return null;
    try {
      const [{ EffectComposer }, { RenderPass }, { OutputPass }, { Pass, FullScreenQuad }] = await Promise.all([
        import(/* @vite-ignore */ 'three/addons/postprocessing/EffectComposer.js'),
        import(/* @vite-ignore */ 'three/addons/postprocessing/RenderPass.js'),
        import(/* @vite-ignore */ 'three/addons/postprocessing/OutputPass.js'),
        import(/* @vite-ignore */ 'three/addons/postprocessing/Pass.js'),
      ]);
      const size = renderer.getSize(new THREE.Vector2());
      // 4x MSAA on a half float target: WebGLRenderer's own antialias is discarded the moment a
      // composer renders into a target of its own, and a game with no antialiasing looks broken
      // in a way nobody attributes to the bloom they just switched on.
      const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), {
        samples: 4, type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace,
      });
      const composer = new EffectComposer(renderer, rt);
      composer.setSize(size.x, size.y);
      const renderPass = new RenderPass(scene, camera || new THREE.PerspectiveCamera());
      composer.addPass(renderPass);
      let bloom = null;
      if (o.bloom) {
        bloom = makeBloom(THREE, Pass, FullScreenQuad, size.x, size.y, { threshold: bloomThreshold(), strength: o.bloomStrength, radius: o.bloomRadius });
        composer.addPass(bloom);
      }
      // OutputPass applies ACES and the sRGB transfer at the end, which is where they belong: the
      // scene renders into a linear target, so three switches its own tone mapping off there.
      composer.addPass(new OutputPass());
      post = { composer, renderPass, bloom, rt };
      return post;
    } catch (e) {
      console.info('[rig] postprocessing addons unavailable; rendering direct, no bloom.');
      return null;
    }
  })();

  /* --- per frame -------------------------------------------------------- */

  const _camPos = new THREE.Vector3();
  const _tgt = new THREE.Vector3();
  let frame = 0, lastNear = 0, lastFar = 0, lastFov = 0, lastAspect = 0;

  /** The single-light fallback: a tight shadow camera on the player, snapped to texel steps so
   *  the shadow edges do not crawl as you walk. Only runs when CSM is not available. */
  function updatePlainShadow(cam) {
    const r = shadowDist * 0.35;
    const c = sun.shadow.camera;
    if (c.right !== r) { c.left = -r; c.right = r; c.top = r; c.bottom = -r; c.updateProjectionMatrix(); }
    const texel = (r * 2) / shadowMap;
    cam.getWorldPosition(_camPos);
    const sx = Math.round(_camPos.x / texel) * texel;
    const sz = Math.round(_camPos.z / texel) * texel;
    _tgt.set(sx, 0, sz);
    sun.target.position.copy(_tgt);
    sun.target.updateMatrixWorld();
    sun.position.copy(_tgt).addScaledVector(sunPos.direction, shadowDist * 1.2);
  }

  function update(cam, dt = 0.016) {
    if (cam) camera = cam;
    if (!camera) return;
    if (pendingCSM) { const C = pendingCSM; pendingCSM = null; buildCSM(C, camera); }
    if (post) post.renderPass.camera = camera;

    if (csm) {
      if (camera !== csm.camera || camera.near !== lastNear || camera.far !== lastFar || camera.fov !== lastFov || camera.aspect !== lastAspect) {
        lastNear = camera.near; lastFar = camera.far; lastFov = camera.fov; lastAspect = camera.aspect;
        csm.camera = camera;
        csm.updateFrustums();
      }
      csm.update();
    } else if (o.shadows) {
      updatePlainShadow(camera);
    }

    camera.getWorldPosition(_camPos);
    hemi.position.set(_camPos.x, _camPos.y + 50, _camPos.z);
    if (skyMesh) {
      skyMesh.position.copy(_camPos);
      const s = Math.max(10, (camera.far || 1000) * 0.5);
      skyMesh.scale.setScalar(s);
    }

    frame++;
    if (frame < 120 || frame % o.refreshEvery === 0) refresh();
  }

  /** Update, then draw. Use this instead of renderer.render(scene, camera). */
  function render(cam, dt = 0.016) {
    update(cam, dt);
    if (!camera) return;
    if (post) {
      // so renderer.info covers the WHOLE frame (scene, shadow passes and post) for telemetry
      renderer.info.autoReset = false;
      renderer.info.reset();
      post.composer.render(dt);
    } else {
      renderer.render(scene, camera);
    }
  }

  function setTime(next = {}) {
    time = { ...time, ...next };
    applyTime();
    if (csm) {
      csm.lightDirection.copy(sunPos.direction).negate();
      csm.updateFrustums();
    }
    return { ...time, elevation: sunPos.elevation };
  }

  function resize(w, h) {
    if (!post) return;
    post.composer.setSize(w, h);
    if (post.bloom) post.bloom.setSize(w, h);
  }

  function dispose() {
    if (csm) { csm.dispose(); csm.remove(); }
    scene.remove(hemi); scene.remove(sun); scene.remove(sun.target);
    if (skyMesh) { scene.remove(skyMesh); skyMesh.geometry.dispose(); skyMesh.material.dispose(); }
    if (scene.fog === fog) scene.fog = null;
    if (scene.environment === envTex) scene.environment = null;
    if (envTex && envTex !== opts.envMap) envTex.dispose();
    if (post) { post.composer.dispose(); post.rt.dispose(); renderer.info.autoReset = true; }
  }

  applyTime();
  refresh();

  return {
    hemi, fog, scene, renderer,
    get sun() { return csm ? csm.lights[0] : sun; },
    get csm() { return csm; },
    get sunDir() { return sunPos.direction; },
    get elevation() { return sunPos.elevation; },
    get environment() { return envTex; },
    get post() { return post; },
    tier: T, atmos: atmosU, bounce: bounceU, wrapU,
    ready: Promise.all([ready, postReady]),
    update, render, setTime, refresh, setupMaterial, resize, dispose,
  };
}
