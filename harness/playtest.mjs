#!/usr/bin/env node
/**
 * Play the game and photograph it moving.
 *
 *   node harness/playtest.mjs <dir-containing-the-game's-index.html>
 *
 * The directory is given relative to the repo root, because that is what gets
 * served. It drives forward and photographs the result, which means it tests
 * play. It cannot reach a menu, a death screen or a restart, so those stay
 * yours to check.
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
const target = process.argv[2].replace(/^\/+|\/+$/g, '');
if (!fs.existsSync(path.join(ROOT, target, 'index.html'))) {
  console.error(`no index.html in ${path.join(ROOT, target)}`);
  process.exit(1);
}
const outDir = path.join(ROOT, target, '_playtest');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
               '.png': 'image/png', '.json': 'application/json', '.css': 'text/css' };
const server = createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end('not found');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

fs.mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--no-sandbox', '--window-size=1280,720'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });

// Headless Chrome usually falls back to SwiftShader, a SOFTWARE rasteriser.
// Frame rates measured on it are meaningless as a performance verdict and are
// routinely three to five times below the same scene on a real GPU. Treating a
// SwiftShader number as a perf regression sends you optimising something that
// was never slow.
let software = false;

const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });

console.log(`loading ${target} …`);
await page.goto(`${BASE}/${target}/`, { waitUntil: 'load', timeout: 90000 });
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
// Legs are measured in FRAMES, not milliseconds. Simulated time is frames times
// the game's clamped delta, so a wall-clock hold on a slow or loaded machine
// advances the game by a fraction of what you intended and the harness then
// reports that the car would not move. Frames make the run identical on a fast
// laptop and on a box at load average 15.
const ROUTE = [
  { keys: ['ArrowUp'], frames: 130 },
  { keys: ['ArrowUp', 'ArrowRight'], frames: 60 },
  { keys: ['ArrowUp'], frames: 110 },
  { keys: ['ArrowUp', 'ArrowLeft'], frames: 65 },
  { keys: ['ArrowUp'], frames: 120 },
  { keys: ['ArrowUp', 'ArrowRight'], frames: 75 },
];
const LEG_WALL_CAP_MS = 90000;   // safety net if the game stops rendering entirely

const frames = [];
const samples = [];
let idx = 0;
let usedFrameClock = true;
for (const leg of ROUTE) {
  for (const k of leg.keys) await page.keyboard.down(k);
  const start = await page.evaluate(() => window.__GAME__?.frame);
  if (typeof start === 'number') {
    await page.waitForFunction(
      (s, n) => (window.__GAME__?.frame ?? 0) >= s + n,
      { timeout: LEG_WALL_CAP_MS, polling: 60 }, start, leg.frames,
    ).catch(() => {});
  } else {
    // The game does not report a frame counter, so fall back to wall clock and
    // say so, because the movement check below is only meaningful with one.
    usedFrameClock = false;
    await new Promise((r) => setTimeout(r, leg.frames * 20));
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
const moved = samples.filter(Boolean).reduce((acc, s, i, a) => {
  if (i === 0) return 0;
  return acc + Math.hypot(s.pos[0] - a[i - 1].pos[0], s.pos[1] - a[i - 1].pos[1]);
}, 0);
const last = samples[samples.length - 1] || {};
const fpsVals = samples.filter(Boolean).map((s) => s.fps).filter((n) => n > 0);
const minFps = fpsVals.length ? Math.min(...fpsVals) : 0;

// Contact sheet.
const sheet = `<!doctype html><meta charset="utf-8">
<style>body{margin:0;background:#111;display:grid;grid-template-columns:1fr 1fr;gap:4px}
img{width:100%;display:block}</style>
${frames.map((f) => `<img src="/${path.relative(ROOT, f).split(path.sep).join('/')}">`).join('')}`;
fs.writeFileSync(path.join(outDir, 'strip.html'), sheet);
const sp = await browser.newPage();
await sp.setViewport({ width: 1300, height: 900 });
await sp.goto(`${BASE}/${path.relative(ROOT, path.join(outDir, 'strip.html')).split(path.sep).join('/')}`,
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
if (moved < 40) {
  problems.push(usedFrameClock
    ? `the car barely moved (${moved.toFixed(1)}m). Input is not reaching the game.`
    : `the car barely moved (${moved.toFixed(1)}m), but the game reports no frame counter so this ` +
      `ran on wall clock and may just be a slow machine. Expose __GAME__.frame.`);
}
if (peakDraws > BUDGET.draws) problems.push(`${peakDraws} draw calls, over the ${BUDGET.draws} budget.`);
if (peakTris > BUDGET.tris) problems.push(`${peakTris.toLocaleString()} triangles, over the ${BUDGET.tris.toLocaleString()} budget.`);
if (!software && minFps && minFps < 24) problems.push(`frame rate dipped to ${minFps}.`);
if (errors.length) problems.push(`${errors.length} console error(s): ${errors.slice(0, 3).join(' | ')}`);

console.log(`\ndistance driven  ${moved.toFixed(1)} m`);
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
