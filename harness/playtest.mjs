#!/usr/bin/env node
/**
 * Play the game and photograph it moving.
 *
 *   node harness/playtest.mjs <dir-containing-the-game's-index.html>
 *
 * The directory can be anywhere: relative, absolute, inside this repo or not.
 * It drives forward and photographs the result, which means it tests play. It
 * cannot reach a menu, a death screen or a restart, so those stay yours to
 * check.
 *
 * Two habits are baked in here because skipping either one wasted days.
 *
 * It DRIVES. An early harness of ours opened a game, took a beautiful
 * screenshot, and reported success. The car was parked, the score was zero and
 * the frame rate was measured on a static scene. If the harness does not press
 * the buttons, it is testing a wallpaper.
 *
 * It shoots a FILMSTRIP, six frames spread through the run rather than one
 * posed hero shot. Things that only appear in motion, geometry popping in,
 * assets sunk into the road, a camera that clips the player at speed, are
 * invisible in a still and obvious across six.
 */
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
if (!process.argv[2]) {
  console.error("usage: node harness/playtest.mjs <dir-containing-the-game's-index.html>");
  process.exit(1);
}
// Resolve against the working directory, not the repo root. Joining an absolute
// path onto ROOT produced /repo/Users/you/game and an error message naming a
// path that never existed; a ../game outside the tree got as far as loading and
// then failed as "game never signalled __READY__", which reads as a bug in the
// game rather than a directory the server would not serve.
const target = path.resolve(process.argv[2]);
if (!fs.existsSync(path.join(target, 'index.html'))) {
  console.error(`no index.html in ${target}`);
  process.exit(1);
}
const outDir = path.join(target, '_playtest');
const label = path.relative(process.cwd(), target) || target;

// TWO roots. The game is mounted under a prefix so it can live anywhere, and the
// repo root is the fallback so a game's ../harness/assetlib.js still resolves.
//
// What is mounted is the game's PARENT, not the game directory itself. A game
// laid out the way this repo's own example is, game/ and assets/ as siblings,
// asks for ../assets/townhouse.js; mounting the game directory sends that above
// the mount, where it lands in the repo and 404s. The town then loads completely
// empty while the run still drives, still writes a filmstrip, and still reports
// a distance, with nothing but a console-error count to say the world is missing.
const GAME_PREFIX = '/__game__/';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
               '.png': 'image/png', '.json': 'application/json', '.css': 'text/css' };

const MOUNT = path.dirname(target);
const GAME_URL = `${GAME_PREFIX}${path.basename(target)}/`;

function resolveRequest(urlPath) {
  if (urlPath.startsWith(GAME_PREFIX)) {
    const file = path.join(MOUNT, urlPath.slice(GAME_PREFIX.length));
    if (file.startsWith(MOUNT) && fs.existsSync(file)) return file;
  }
  const file = path.join(ROOT, urlPath.startsWith(GAME_PREFIX)
    ? urlPath.slice(GAME_PREFIX.length - 1) : urlPath);
  return file.startsWith(ROOT) ? file : null;
}

const server = createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel.endsWith('/')) rel += 'index.html';
  // The browser asks for this on its own. Letting it 404 puts a console error in
  // every run, and console errors fail the gate, so a game with no favicon was
  // reported as broken for a file it never asked for.
  if (rel === '/favicon.ico') { res.writeHead(204); return res.end(); }
  const file = resolveRequest(rel);
  if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end('not found');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

fs.mkdirSync(outDir, { recursive: true });
// Do NOT force swiftshader here. Headless Chrome reaches the real GPU on its own
// where there is one, and pinning it to the software rasteriser costs more than
// the frame rate: a fully dressed scene takes minutes per run instead of
// seconds, which is long enough that people stop running the gate. The flag
// below only permits the software fallback on a machine with no usable GPU, so
// a headless box still works. Whether it ended up on software is detected
// below, and the frame rate is captioned accordingly.
const browser = await puppeteer.launch({
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--no-sandbox', '--window-size=1280,720'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });

// A machine with no usable GPU still lands on SwiftShader, a SOFTWARE rasteriser.
// Frame rates measured on it are meaningless as a performance verdict and run
// two orders of magnitude below the same scene on a real GPU. Treating a
// SwiftShader number as a perf regression sends you optimising something that
// was never slow, so the report says which one you got.
let software = false;

const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });

// A file the page asked for and did not get is reported separately, by URL. As a
// console error it arrives as "Failed to load resource: 404", twelve times, which
// says nothing about which twelve and reads like noise next to a run that
// otherwise looks healthy.
const missing = [];
page.on('response', (r) => {
  if (r.status() >= 400) missing.push(`${r.status()} ${r.url().replace(BASE, '')}`);
});

console.log(`loading ${label} …`);
await page.goto(`${BASE}${GAME_URL}`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 180000 })
  .catch(() => { throw new Error('game never signalled __READY__'); });
software = await page.evaluate(() => {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
    const r = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '';
    return /swiftshader|llvmpipe|software/i.test(String(r));
  } catch { return false; }
});
if (software) console.log('  (software rendering: frame rate below is not a perf verdict)');
await page.evaluate(() => window.__START__ && window.__START__());

// A route that turns, so the filmstrip is not six pictures of the same street.
//
// Legs are measured in METRES COVERED IN THE GAME, not in milliseconds and not
// in frames. Both of those tie the route to how fast the machine happens to be.
// A wall-clock hold under-drives a slow machine, which is what made an early
// harness report that input was not reaching the game. Counting frames fixes
// that and then fails the other way round: a game stepping on real elapsed time
// advances about 8ms per frame at 120fps against 30ms at 30fps, so the same 130
// frames covered 80m on a software rasteriser and 37m on a GPU, and the run
// accused a game that was working perfectly of ignoring its controls.
//
// Distance is what the route actually means. It is identical on both. It has to
// be PATH length rather than displacement from where the leg started: a car
// holding a turn drives in a circle, so its displacement stops growing at the
// diameter of that circle, and a turning leg asking for more than that can never
// finish however well the game works.
const ROUTE = [
  { keys: ['ArrowUp'], metres: 50 },
  { keys: ['ArrowUp', 'ArrowRight'], metres: 18 },
  { keys: ['ArrowUp'], metres: 45 },
  { keys: ['ArrowUp', 'ArrowLeft'], metres: 18 },
  { keys: ['ArrowUp'], metres: 45 },
  { keys: ['ArrowUp', 'ArrowRight'], metres: 20 },
];
const ROUTE_METRES = ROUTE.reduce((a, l) => a + l.metres, 0);
// A leg that cannot cover its distance gives up. The allowance is far larger on
// a software rasteriser, where the same drive genuinely takes two orders of
// magnitude longer in wall time, so a GPU-less CI box does not report a stall
// that is only the renderer being slow.
const LEG_WALL_CAP_MS = () => (software ? 120000 : 25000);

const frames = [];
const samples = [];
let idx = 0;
let hasPos = true;
let stalledLegs = 0;
let driven = 0;
for (const leg of ROUTE) {
  for (const k of leg.keys) await page.keyboard.down(k);
  let prev = await page.evaluate(() => window.__GAME__?.pos);
  if (Array.isArray(prev) && prev.length === 2) {
    let legDist = 0;
    const until = Date.now() + LEG_WALL_CAP_MS();
    while (legDist < leg.metres && Date.now() < until) {
      await new Promise((r) => setTimeout(r, 50));
      const p = await page.evaluate(() => window.__GAME__?.pos);
      if (!Array.isArray(p)) break;
      legDist += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      prev = p;
    }
    driven += legDist;
    if (legDist < leg.metres) stalledLegs++;
  } else {
    // No position to steer by, so fall back to wall clock and say so, because
    // the movement check below is only meaningful with one.
    hasPos = false;
    await new Promise((r) => setTimeout(r, 2600));
  }
  const t = await page.evaluate(() => window.__GAME__ || null);
  const shot = path.join(outDir, `f${idx}.png`);
  await page.screenshot({ path: shot });
  frames.push(shot);
  samples.push(t);
  console.log(`  frame ${idx}  speed ${t?.speed ?? '?'} m/s  pos ${t?.pos ?? '?'}  ` +
              `fps ${t?.fps ?? '?'}  draws ${t?.draws ?? '?'}  tris ${t?.tris ?? '?'}`);
  for (const k of leg.keys) await page.keyboard.up(k);
  idx++;
}

// Did it actually move, and did anything happen?
//
// This is the path length accumulated while driving, not the distance between
// the six screenshots. A route that turns back on itself covers real ground
// while those six points sit close together.
const moved = driven;
const last = samples[samples.length - 1] || {};
const fpsVals = samples.filter(Boolean).map((s) => s.fps).filter((n) => n > 0);
const minFps = fpsVals.length ? Math.min(...fpsVals) : 0;

// Contact sheet.
const sheet = `<!doctype html><meta charset="utf-8">
<style>body{margin:0;background:#111;display:grid;grid-template-columns:1fr 1fr;gap:4px}
img{width:100%;display:block}</style>
${frames.map((f) => `<img src="${GAME_PREFIX}_playtest/${path.basename(f)}">`).join('')}`;
fs.writeFileSync(path.join(outDir, 'strip.html'), sheet);
const sp = await browser.newPage();
await sp.setViewport({ width: 1300, height: 900 });
await sp.goto(`${BASE}${GAME_PREFIX}_playtest/strip.html`,
  { waitUntil: 'networkidle0' });
await sp.screenshot({ path: path.join(outDir, 'filmstrip.png'), fullPage: true });
await sp.close();

await browser.close();
server.close();

// Gate on cost, not on frame rate.
//
// Frame rate here is measured under a software rasteriser and is not a verdict
// on anything. Draw calls and triangles are, because they are the same number
// on any machine. A build that blew its draw budget by three and a half times
// once passed this harness because the only performance gate was an fps
// threshold that could never fire.
const BUDGET = { draws: 900, tris: 1_700_000 };
const peakDraws = Math.max(...samples.filter(Boolean).map((s) => s.draws || 0));
const peakTris = Math.max(...samples.filter(Boolean).map((s) => s.tris || 0));

const problems = [];
if (!hasPos) {
  problems.push(`the game reports no __GAME__.pos, so this ran on wall clock and nothing below ` +
                `about movement means anything. Expose it.`);
} else if (stalledLegs) {
  problems.push(`${stalledLegs} of ${ROUTE.length} legs could not cover their distance within ` +
                `${LEG_WALL_CAP_MS() / 1000}s. Either the car is stuck on something, or input is ` +
                `not reaching the game${software ? ', or this software rasteriser is slower still' : ''}.`);
}
if (peakDraws > BUDGET.draws) problems.push(`${peakDraws} draw calls, over the ${BUDGET.draws} budget.`);
if (peakTris > BUDGET.tris) problems.push(`${peakTris.toLocaleString()} triangles, over the ${BUDGET.tris.toLocaleString()} budget.`);
if (!software && minFps && minFps < 24) problems.push(`frame rate dipped to ${minFps}.`);
if (missing.length) {
  problems.push(`${missing.length} file(s) the page asked for were not there, starting with ` +
                `${missing[0]}. Anything loaded dynamically, which is most of the assets, will ` +
                `be silently absent from the frames above.`);
}
// Those 404s also arrive as console errors. Do not count them twice.
const otherErrors = errors.filter((e) => !/Failed to load resource/.test(e));
if (otherErrors.length) {
  problems.push(`${otherErrors.length} console error(s): ${otherErrors.slice(0, 3).join(' | ')}`);
}

console.log(`\ndistance driven  ${moved.toFixed(1)} m  (route asks for ${ROUTE_METRES})`);
console.log(`score            ${last.score ?? '?'}   drops ${last.collected ?? '?'}   busted ${last.busted ?? '?'}`);
console.log(`peak draws       ${peakDraws}  (budget ${BUDGET.draws})`);
console.log(`peak triangles   ${peakTris.toLocaleString()}  (budget ${BUDGET.tris.toLocaleString()})`);
console.log(`frame rate       ${minFps} min${software ? '  (software rendering, measured but NOT a verdict)' : ''}`);
console.log(`filmstrip        ${path.join(outDir, 'filmstrip.png')}`);
if (problems.length) {
  console.log('\nproblems:');
  for (const p of problems) console.log('  ' + p);
  process.exit(1);
}
console.log('\nit plays. now LOOK at the filmstrip.');
