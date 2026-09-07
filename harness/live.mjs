#!/usr/bin/env node
/**
 * Prove the deployed game works, on a phone, by touching it.
 *
 *   node harness/live.mjs https://you.github.io/yourgame/game/
 *   node harness/live.mjs <url> --hold="#stick"     hold that control instead of guessing
 *   node harness/live.mjs <url> --desktop           a laptop viewport and a click
 *
 * The local gate proves your folder works. This proves the thing you actually gave someone works,
 * which is a different claim: paths that resolved from your working tree, a cached module against
 * a new index, a case-sensitive filename that only matters on a Linux host, an asset that 404s
 * behind a CDN. All of those pass locally and fail here.
 *
 * It loads the URL in a phone viewport, waits for __READY__, taps the real start button with a
 * real touch, holds the first control it can find, and asserts the player moved. It writes a
 * screenshot so you can look at what a visitor sees rather than trusting the exit code.
 */
import fs from 'fs';
import path from 'path';

let puppeteer;
try { puppeteer = (await import('puppeteer')).default; }
catch { console.error('puppeteer is not installed. Run "npm install" in this repo first.'); process.exit(1); }

const url = process.argv[2];
if (!url || !/^https?:\/\//.test(url)) {
  console.error('usage: node harness/live.mjs <url-of-the-deployed-game> [--hold="#stick"] [--desktop]');
  process.exit(1);
}
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=').replace(/^["']|["']$/g, '') : d; };
const DESKTOP = process.argv.includes('--desktop');
const HOLD = arg('hold', '');
const OUT = arg('out', 'live.png');

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
if (DESKTOP) await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
else {
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36');
}

const missing = [];
page.on('response', (r) => { if (r.status() >= 400) missing.push(`${r.status()} ${r.url()}`); });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });

const problems = [];
const t0 = Date.now();
await page.goto(url + (url.includes('?') ? '&' : '?') + 'x=' + Math.random().toString(36).slice(2), { waitUntil: 'load', timeout: 90000 });
try { await page.waitForFunction('window.__READY__ === true', { timeout: 120000 }); }
catch { problems.push('the page never signalled __READY__'); }
const ready = ((Date.now() - t0) / 1000).toFixed(1);

const before = await page.evaluate(() => (window.__GAME__ && window.__GAME__.pos) || null);
const started = await page.evaluate(() => !!document.querySelector('#startb'));
if (!started) problems.push('no #startb on the page: the harness could not find a real control to press');
else if (DESKTOP) await page.click('#startb');
else await page.touchscreen.tap(...await page.$eval('#startb', (b) => { const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }));
await new Promise((r) => setTimeout(r, 1500));

// hold something for four seconds: the named control, else a touch control, else the arrow key
const control = HOLD || (await page.evaluate(() => {
  for (const id of ['#stick', '#steerR', '#steerL', '#bgas', '#look']) if (document.querySelector(id)) return id;
  return '';
}));
if (control) {
  const box = await page.$eval(control, (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.touchscreen.touchStart(box.x, box.y);
  await new Promise((r) => setTimeout(r, 4000));
  await page.touchscreen.touchEnd();
} else {
  await page.keyboard.down('ArrowUp');
  await new Promise((r) => setTimeout(r, 4000));
  await page.keyboard.up('ArrowUp');
}

const after = await page.evaluate(() => (window.__GAME__ && window.__GAME__.pos) || null);
const moved = before && after ? Math.hypot(after[0] - before[0], after[1] - before[1]) : null;
if (moved === null) problems.push('no __GAME__.pos, so nothing here can say whether the player moved');
else if (moved < 1) problems.push(`the player moved ${moved.toFixed(2)} m while a control was held for four seconds`);
if (missing.length) problems.push(`${missing.length} file(s) 404ed, starting with ${missing[0]}`);
if (errors.length) problems.push(`${errors.length} console error(s): ${errors.slice(0, 2).join(' | ')}`);

await page.screenshot({ path: OUT });
await browser.close();

console.log(`url        ${url}`);
console.log(`ready      ${ready} s   (${DESKTOP ? 'laptop viewport, click' : 'phone viewport, real touch'})`);
console.log(`held       ${control || 'ArrowUp'}`);
console.log(`moved      ${moved === null ? '?' : moved.toFixed(1) + ' m'}`);
console.log(`screenshot ${path.resolve(OUT)}`);
if (problems.length) {
  console.log('\nproblems:');
  for (const p of problems) console.log('  ' + p);
  process.exit(1);
}
console.log('\nit loads, it starts from a real press, and it moves. now look at the screenshot.');
