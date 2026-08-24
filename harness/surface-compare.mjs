#!/usr/bin/env node
/**
 * Show what procedural surfaces do to an asset, and what they cost.
 *
 *   node harness/surface-compare.mjs <dir-or-file> [more...]
 *
 * Renders each asset twice under one camera and one light rig, flat on the left
 * and textured on the right, and writes the pair to harness/_surfaces/.
 *
 * It also reports draw calls after bakeStatic on both versions. That number is
 * the reason this tool exists: texturing per mesh is easy to do in a way that
 * defeats merging, and an asset that looks better while costing five times the
 * draw calls is not an improvement. Surfaces quantise their repeats so meshes of
 * a similar size share a material; these two numbers are how you check it held.
 */
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = path.join(HERE, '_surfaces');
const args = process.argv.slice(2);
if (!args.length) {
  console.error('usage: node harness/surface-compare.mjs <dir-or-file> [more...]');
  process.exit(1);
}

const targets = [];
for (const a of args) {
  const p = path.resolve(a);
  if (fs.statSync(p).isDirectory()) {
    for (const f of fs.readdirSync(p).sort()) if (f.endsWith('.js')) targets.push(path.join(p, f));
  } else targets.push(p);
}
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png' };
const server = createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]);
  const file = rel.startsWith('/@asset/')
    ? targets[+rel.split('/')[2]]
    : path.join(ROOT, rel);
  if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

// Plain headless reaches the real GPU. Forcing swiftshader is what makes a
// capture crawl, and it is easy to copy that flag in from somewhere else.
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
let worst = 1;
for (const [i, file] of targets.entries()) {
  const name = path.basename(file, '.js');
  const page = await browser.newPage();
  await page.setViewport({ width: 1800, height: 900 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)));
  await page.goto(`${BASE}/harness/surface-compare.html?src=${encodeURIComponent(`/@asset/${i}`)}&size=900`,
    { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction('window.__DONE__ === true', { timeout: 180000 });
  const info = await page.evaluate('window.__INFO__');
  await (await page.$('canvas')).screenshot({ path: path.join(OUT, `${name}.png`) });
  await page.close();

  const ratio = info.drawsAfter / Math.max(1, info.drawsBefore);
  worst = Math.max(worst, ratio);
  console.log(`${name.padEnd(24)} ${String(info.textured).padStart(4)} meshes textured, ${info.left} left alone, ` +
              `${info.materials} materials   draws ${info.drawsBefore} -> ${info.drawsAfter} (x${ratio.toFixed(2)})` +
              (errors.length ? `   ERROR ${errors[0]}` : ''));
}
await browser.close();
server.close();
console.log(`\npictures: ${OUT}\nworst draw-call ratio: x${worst.toFixed(2)}`);
if (worst > 2) {
  console.error('\nDraw calls more than doubled. The repeat ladder is not sharing materials; fix that before shipping.');
  process.exit(1);
}
