#!/usr/bin/env node
/**
 * The jam's one gate: load the deployed game on a phone, over 4G, touch it, print the verdict.
 *
 *   node harness/jam.mjs https://you.github.io/yourgame/game/
 *   node harness/jam.mjs <url> --start="#play"      press that control instead of #startb
 *   node harness/jam.mjs <url> --hold="#stick"      hold that control instead of guessing
 *   node harness/jam.mjs <url> --out=_jam/          where the screenshots and verdict.json go
 *   node harness/jam.mjs <url> --commit=<sha>       stamp the verdict with the commit it judged
 *   node harness/jam.mjs <url> --desktop            a laptop viewport, a click and keys (secondary)
 *
 * The jam site promises a verdict block that an entrant pastes into their pull request. This is
 * the tool that prints it. It runs against the URL you actually shipped, not your working tree:
 * the local gates prove your folder works, and this proves that a stranger on a phone, on a
 * mobile network, gets a game they can start and play.
 *
 * The phone run is the verdict. It uses a 390 by 844 viewport at 3x, a real touch on the start
 * control, and a real drag on the first visible control it can find. The network is shaped to a
 * 4G profile (4 Mbps down, 1 Mbps up, 60 ms latency) through the browser's own emulation and the
 * CPU is slowed 2x, because a game that loads in two seconds on a laptop on office wifi and in
 * forty on the phone it was made for has not shipped. --desktop exists so you can compare, and a
 * desktop pass is not a jam pass.
 *
 * What it judges, and why each one is a number rather than an opinion:
 *   ready     seconds from navigation to window.__READY__ === true, under the 4G profile
 *   weight    megabytes the page pulled to get there and to play, summed from every response
 *   started   whether the start control exists and a real tap on it starts the game
 *   moved     metres __GAME__.pos travelled while a control was held for six seconds
 *   draws     peak draw calls and peak triangles from __GAME__, the same on any machine
 *   fps       median, reported but never judged: a headless box usually has no GPU and renders
 *             in software, and a software frame rate is not a verdict on anything
 *   errors    console errors and files that 404ed, which on a deployed URL are always real
 *   reach     whether every file came from the game's own folder; anything else is flagged so
 *             the reader knows the game leans on a host that is not the entrant's
 *
 * The budgets live in JAM below, in one place, so the jam can tighten them without touching
 * the logic. Frame rate has no budget on purpose. A gate that judges fps on a software
 * rasteriser fails every good game on CI and passes every bad one on a gaming laptop.
 */
import fs from 'fs';
import path from 'path';

let puppeteer;
try { puppeteer = (await import('puppeteer')).default; }
catch { console.error('puppeteer is not installed. Run "npm install" in this repo first.'); process.exit(1); }

// Everything the verdict judges against. Nothing below hardcodes a threshold.
const JAM = {
  READY_S: 20,          // seconds to __READY__ under the 4G profile
  MB: 10,               // megabytes transferred to load and play
  DRAWS: 900,           // peak draw calls
  TRIS: 1_500_000,      // peak triangles
  MOVE_M: 1,            // metres the player must travel during the hold
};
const HOLD_MS = 6000;         // how long a control is held
const SETTLE_MS = 2000;       // after the tap, before the hold, so a slow first frame is not a false fail
const AFTER_MS = 1500;        // keep sampling after the hold so the last frames count
const SAMPLE_MS = 250;        // how often __GAME__ is read
const READY_TIMEOUT_MS = 60000;
const NET = { name: '4G', downMbps: 4, upMbps: 1, latencyMs: 60, cpuSlowdown: 2 };
// Hosts a jam entry may pull a library from without being flagged as an external dependency.
const CDN_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

const url = process.argv[2];
if (!url || !/^https?:\/\//.test(url)) {
  console.error('usage: node harness/jam.mjs <url> [--start="#startb"] [--hold="#stick"] [--out=_jam/] [--commit=<sha>] [--desktop]');
  process.exit(1);
}
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=').replace(/^["']|["']$/g, '') : d; };
const DESKTOP = process.argv.includes('--desktop');
const START = arg('start', '#startb');
const HOLD = arg('hold', '');
const OUT = path.resolve(arg('out', '_jam'));
const COMMIT = arg('commit', '') || 'not given';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The game's own folder. Everything under it is the entrant's; everything else is somebody else's.
const u0 = new URL(url); u0.search = ''; u0.hash = '';
const FOLDER = u0.href.endsWith('/') ? u0.href : u0.href.slice(0, u0.href.lastIndexOf('/') + 1);
const ORIGIN = u0.origin;

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const VIEWPORT = DESKTOP
  ? { width: 1280, height: 800, deviceScaleFactor: 1 }
  : { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
await page.setViewport(VIEWPORT);
if (!DESKTOP) await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36');
// A fresh profile has an empty cache already; this makes the weight number honest on a rerun too.
await page.setCacheEnabled(false);

// Shape the network and the CPU through the browser's own emulation, before anything loads.
const cdp = typeof page.createCDPSession === 'function' ? await page.createCDPSession() : await page.target().createCDPSession();
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', {
  offline: false, latency: NET.latencyMs,
  downloadThroughput: NET.downMbps * 1024 * 1024 / 8, uploadThroughput: NET.upMbps * 1024 * 1024 / 8,
});
await cdp.send('Emulation.setCPUThrottlingRate', { rate: NET.cpuSlowdown });
// Bytes as they crossed the wire, compressed. Kept in the json next to the body total so a reader
// can see both; the verdict line uses the body total, which is what the budget names.
let wireBytes = 0;
cdp.on('Network.loadingFinished', (e) => { wireBytes += e.encodedDataLength || 0; });

const requested = [];   // every URL the page asked for
const responses = [];   // { url, status, bytes }
const pending = [];     // body reads still in flight
const missing = [];     // 4xx and 5xx, by URL
const errors = [];
page.on('request', (r) => { const u = r.url(); if (!/^(data|blob):/.test(u)) requested.push(u); });
page.on('response', (r) => {
  const u = r.url();
  if (/^(data|blob):/.test(u)) return;
  const rec = { url: u, status: r.status(), bytes: 0 };
  responses.push(rec);
  // The browser asks for /favicon.ico on its own. A game with no favicon is not a game with a 404.
  if (r.status() >= 400 && !/\/favicon\.ico$/.test(u)) missing.push(`${r.status()} ${u}`);
  const fromHeader = Number(r.headers()['content-length'] || 0);
  pending.push(r.buffer().then((b) => { rec.bytes = b.length; }).catch(() => { rec.bytes = fromHeader; }));
});
page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
// 404s also arrive as console errors. They are counted once, above, by URL.
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 200)); });

const shots = { loaded: path.join(OUT, 'loaded.png'), started: path.join(OUT, 'started.png'), moving: path.join(OUT, 'moving.png') };
const snap = async (p) => { try { await page.screenshot({ path: p }); } catch {} };
const readGame = () => page.evaluate(() => {
  const g = window.__GAME__;
  if (!g) return null;
  return { fps: g.fps, draws: g.draws, tris: g.tris, pos: Array.isArray(g.pos) ? [g.pos[0], g.pos[1]] : null, speed: g.speed };
}).catch(() => null);

// 1. ready
const t0 = Date.now();
let readyS = null;
let loadNote = '';
try {
  await page.goto(url, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
  await page.waitForFunction('window.__READY__ === true', { timeout: Math.max(1000, READY_TIMEOUT_MS - (Date.now() - t0)) });
  readyS = (Date.now() - t0) / 1000;
} catch (e) {
  loadNote = /Navigation|net::/i.test(String(e.message)) ? String(e.message).slice(0, 120) : `no __READY__ within ${READY_TIMEOUT_MS / 1000} s`;
}

// Which renderer did we get. A headless box with no GPU lands on SwiftShader, and a frame rate
// measured there is captioned, not judged.
const gpu = await page.evaluate(() => {
  let renderer = '';
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
    renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : (gl ? String(gl.getParameter(gl.RENDERER)) : '');
  } catch {}
  return { renderer, webgpu: !!navigator.gpu };
}).catch(() => ({ renderer: '', webgpu: false }));
const software = !gpu.webgpu || /swiftshader|llvmpipe|software/i.test(gpu.renderer);
await snap(shots.loaded);

// 2. start, from the real control. Never through a hook: a build once shipped unstartable on
// every phone for a fortnight because every check started it through __START__().
const startBox = await page.evaluate((sel) => {
  const e = document.querySelector(sel);
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, visible: e.offsetParent !== null && r.width > 0 && r.height > 0 };
}, START).catch(() => null);
let tapped = false;
let startNote = '';
if (!startBox) startNote = `no ${START} on the page: name your start control with --start="<selector>"`;
else if (!startBox.visible) startNote = `${START} is in the DOM but not visible, so a player cannot press it`;
else {
  if (DESKTOP) await page.mouse.click(startBox.x, startBox.y);
  else await page.touchscreen.tap(startBox.x, startBox.y);
  tapped = true;
}
// Wait for the first frame before holding. A game that takes a second to build its scene after
// the tap would otherwise be judged on a hold that began before it was listening.
await sleep(SETTLE_MS);
const startGone = tapped ? await page.evaluate((sel) => {
  const e = document.querySelector(sel);
  if (!e) return true;
  const r = e.getBoundingClientRect();
  return e.offsetParent === null || r.width === 0 || getComputedStyle(e).visibility === 'hidden' || Number(getComputedStyle(e).opacity) === 0;
}, START).catch(() => false) : false;
await snap(shots.started);

// 3. hold something: the named control, else a VISIBLE touch control, else a key. On a laptop
// viewport the touch controls are usually in the DOM and hidden, and holding one of those moves
// nothing, so the key fallback is the desktop path.
const control = HOLD || (DESKTOP ? '' : await page.evaluate(() => {
  for (const id of ['#stick', '#steerR', '#steerL', '#bgas', '#look']) {
    const e = document.querySelector(id);
    if (e && e.offsetParent !== null && e.getBoundingClientRect().width > 8) return id;
  }
  return '';
}).catch(() => ''));

const samples = [];
let sampling = true;
const sampler = (async () => {
  while (sampling) { samples.push({ t: Date.now() - t0, g: await readGame() }); await sleep(SAMPLE_MS); }
})();

const before = (await readGame())?.pos || null;
const holdEnd = Date.now() + HOLD_MS;
if (control) {
  // A virtual stick reads its vector from where the finger landed, so pressing the centre and
  // holding still is no input at all. Land in the middle, then drag up and hold there.
  const box = await page.$eval(control, (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, h: r.height }; }).catch(() => null);
  if (!box) { startNote = startNote || `--hold=${control} is not on the page`; }
  else {
    const dy = Math.max(24, box.h * 0.35);
    if (DESKTOP) { await page.mouse.move(box.x, box.y); await page.mouse.down(); await sleep(120); await page.mouse.move(box.x, box.y - dy, { steps: 4 }); }
    else { await page.touchscreen.touchStart(box.x, box.y); await sleep(120); await page.touchscreen.touchMove(box.x, box.y - dy); }
    await sleep(HOLD_MS / 2);
    await snap(shots.moving);
    await sleep(Math.max(0, holdEnd - Date.now()));
    if (DESKTOP) await page.mouse.up(); else await page.touchscreen.touchEnd();
  }
} else {
  // Most games take one of these two for forward; hold both, nothing binds them to opposite ends.
  await page.keyboard.down('ArrowUp'); await page.keyboard.down('KeyW');
  await sleep(HOLD_MS / 2);
  await snap(shots.moving);
  await sleep(Math.max(0, holdEnd - Date.now()));
  await page.keyboard.up('KeyW'); await page.keyboard.up('ArrowUp');
}
const after = (await readGame())?.pos || null;
await sleep(AFTER_MS);
sampling = false;
await sampler;
// Let the body reads finish, but not forever: a streaming response never finishes.
await Promise.race([Promise.allSettled(pending), sleep(5000)]);
await browser.close();

// 4. numbers
const moved = before && after ? Math.hypot(after[0] - before[0], after[1] - before[1]) : null;
let pathM = 0;
for (let i = 1; i < samples.length; i++) {
  const a = samples[i - 1].g?.pos, b = samples[i].g?.pos;
  if (a && b) pathM += Math.hypot(b[0] - a[0], b[1] - a[1]);
}
const gs = samples.map((s) => s.g).filter(Boolean);
const nums = (k) => gs.map((g) => Number(g[k])).filter((n) => Number.isFinite(n) && n > 0);
const peak = (k) => (nums(k).length ? Math.max(...nums(k)) : null);
const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const peakDraws = peak('draws');
const peakTris = peak('tris');
const medianFps = median(nums('fps'));
const bodyBytes = responses.reduce((a, r) => a + (r.bytes || 0), 0);
const mb = bodyBytes / 1e6;
const started = tapped && (startGone || (moved !== null && moved >= JAM.MOVE_M));

// Where did the files come from.
const outsideFolder = new Set();
const external = new Set();
const cdn = new Set();
for (const u of new Set(requested)) {
  if (u.startsWith(FOLDER) || /\/favicon\.ico$/.test(u)) continue;
  let host = '';
  try { host = new URL(u).host; } catch { continue; }
  if (u.startsWith(ORIGIN + '/')) outsideFolder.add(u);
  else if (CDN_HOSTS.includes(host)) cdn.add(host);
  else external.add(host);
}

// 5. verdict
const fails = [];
if (readyS === null) fails.push(loadNote || `no __READY__ within ${READY_TIMEOUT_MS / 1000} s`);
else if (readyS > JAM.READY_S) fails.push(`ready in ${readyS.toFixed(1)} s, budget ${JAM.READY_S} s`);
if (mb > JAM.MB) fails.push(`${mb.toFixed(1)} MB transferred, budget ${JAM.MB} MB`);
if (!tapped) fails.push(startNote);
else if (!started) fails.push(`tapped ${START} but the start control stayed on screen and the player did not move`);
if (moved === null) fails.push('no __GAME__.pos, so nothing here can say whether the player moved');
else if (moved < JAM.MOVE_M) fails.push(`moved ${moved.toFixed(2)} m during a ${HOLD_MS / 1000} s hold, needs ${JAM.MOVE_M} m`);
if (peakDraws === null) fails.push('__GAME__.draws not exposed, so the draw budget cannot be judged');
else if (peakDraws > JAM.DRAWS) fails.push(`${peakDraws} draw calls, budget ${JAM.DRAWS}`);
if (peakTris === null) fails.push('__GAME__.tris not exposed, so the triangle budget cannot be judged');
else if (peakTris > JAM.TRIS) fails.push(`${peakTris.toLocaleString('en-US')} triangles, budget ${JAM.TRIS.toLocaleString('en-US')}`);
if (missing.length) fails.push(`${missing.length} file(s) 404ed, starting with ${missing[0]}`);
if (errors.length) fails.push(`${errors.length} console error(s): ${errors[0]}`);
const result = fails.length ? `FAIL (${fails.join('; ')})` : 'PASS';

const utc = new Date().toISOString();
const viewportLine = DESKTOP
  ? `${VIEWPORT.width}x${VIEWPORT.height} @1x laptop, click and keys (NOT the jam verdict, run without --desktop)`
  : `${VIEWPORT.width}x${VIEWPORT.height} @${VIEWPORT.deviceScaleFactor}x phone, real touch, Android Chrome UA`;
const networkLine = `${NET.name}: ${NET.downMbps} Mbps down, ${NET.upMbps} Mbps up, ${NET.latencyMs} ms latency, CPU ${NET.cpuSlowdown}x slower`;
const fpsNote = software ? ' (software rendering, not a verdict)' : ` (${gpu.renderer || 'GPU'})`;
const heldLine = control ? `${control} dragged up and held ${HOLD_MS / 1000} s` : `ArrowUp and KeyW held ${HOLD_MS / 1000} s${DESKTOP ? '' : ' (no visible touch control found)'}`;
const pf = (ok) => (ok ? 'PASS' : 'FAIL');
const fmt = (n) => (n === null ? 'not exposed' : n.toLocaleString('en-US'));

const verdict = {
  url, utc, commit: COMMIT, viewport: VIEWPORT, desktop: DESKTOP, network: NET, budgets: JAM,
  ready_s: readyS, load_note: loadNote || null,
  body_bytes: bodyBytes, wire_bytes: wireBytes, mb: Number(mb.toFixed(2)), mb_note: 'body bytes over 1e6; wire_bytes is the compressed transfer',
  start_control: START, tapped, started, start_gone_after_tap: startGone, start_note: startNote || null,
  held: control || 'ArrowUp and KeyW', hold_ms: HOLD_MS, pos_before: before, pos_after: after,
  moved_m: moved === null ? null : Number(moved.toFixed(2)), path_m: Number(pathM.toFixed(2)),
  peak_draws: peakDraws, peak_tris: peakTris, median_fps: medianFps, software, renderer: gpu.renderer, webgpu: gpu.webgpu,
  errors, missing, requests: responses.length,
  external_hosts: [...external], cdn_hosts: [...cdn], outside_folder: [...outsideFolder],
  screenshots: shots, samples, fails, result: fails.length ? 'FAIL' : 'PASS',
};
fs.writeFileSync(path.join(OUT, 'verdict.json'), JSON.stringify(verdict, null, 2));

console.log(`screenshots     ${shots.loaded}`);
console.log(`                ${shots.started}`);
console.log(`                ${shots.moving}`);
console.log(`verdict.json    ${path.join(OUT, 'verdict.json')}`);
console.log(`held            ${heldLine}`);
console.log(`path length     ${pathM.toFixed(1)} m over the run`);
console.log(`wire bytes      ${(wireBytes / 1e6).toFixed(1)} MB compressed, ${responses.length} responses`);
if (!software) console.log(`renderer        ${gpu.renderer}`);
console.log('');
console.log('=== 404 JAM VERDICT ===');
console.log(`url             ${url}`);
console.log(`utc             ${utc}`);
console.log(`commit          ${COMMIT}`);
console.log(`viewport        ${viewportLine}`);
console.log(`network         ${networkLine}`);
console.log(`ready           ${readyS === null ? `none in ${READY_TIMEOUT_MS / 1000} s` : readyS.toFixed(1) + ' s'}   budget ${JAM.READY_S} s   ${pf(readyS !== null && readyS <= JAM.READY_S)}`);
console.log(`weight          ${mb.toFixed(1)} MB   budget ${JAM.MB} MB   ${pf(mb <= JAM.MB)}`);
console.log(`started         ${started ? 'yes' : 'no'} (${tapped ? (DESKTOP ? 'click' : 'tap') + ' on ' + START : startNote})`);
console.log(`moved           ${moved === null ? 'unknown, no __GAME__.pos' : moved.toFixed(1) + ' m'}   needs ${JAM.MOVE_M} m   ${pf(moved !== null && moved >= JAM.MOVE_M)}`);
console.log(`peak draws      ${fmt(peakDraws)}   budget ${JAM.DRAWS.toLocaleString('en-US')}   ${pf(peakDraws !== null && peakDraws <= JAM.DRAWS)}`);
console.log(`peak tris       ${fmt(peakTris)}   budget ${JAM.TRIS.toLocaleString('en-US')}   ${pf(peakTris !== null && peakTris <= JAM.TRIS)}`);
console.log(`median fps      ${medianFps === null ? 'not exposed' : medianFps}${fpsNote}`);
console.log(`errors          ${errors.length}   ${pf(errors.length === 0)}${errors.length ? '   ' + errors[0] : ''}`);
console.log(`404s            ${missing.length}   ${pf(missing.length === 0)}${missing.length ? '   ' + missing[0] : ''}`);
console.log(`external deps   ${external.size ? [...external].join(', ') + '   (warning, not a fail)' : 'none'}${cdn.size ? '   cdn: ' + [...cdn].join(', ') : ''}`);
console.log(`outside folder  ${outsideFolder.size ? outsideFolder.size + ' file(s) from ' + ORIGIN + ' above ' + FOLDER + '   (warning, not a fail)' : 'none, every file came from the game folder'}`);
console.log(`RESULT: ${result}`);
console.log('=== END ===');
process.exit(fails.length ? 1 : 0);
