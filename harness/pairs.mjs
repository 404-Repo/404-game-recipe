#!/usr/bin/env node
/**
 * Build the blind pairs a critic judges, and withhold the answer.
 *
 *   node harness/pairs.mjs --mine game/_gate/f0.png game/_gate/f1.png --ref refs/bar/*.jpg --out work/critic1/bar
 *   node harness/pairs.mjs --mine <frames> --ref <frames> --out <dir> [--seed 7] [--width 960] [--crop 0.07]
 *
 * GAME.md tells you the critic must compare your game against a real reference side by side,
 * blind, and the whole loop turns on that instrument. Until now the repo did not ship it, so
 * everyone wrote their own. One run here lost an entire critic round to a home made one that
 * produced eight identical sheets of broken image icons, and a confident verdict on them: it used
 * `page.setContent`, which puts the document on `about:blank`, from where Chromium blocks every
 * `file://` subresource, and `waitUntil: 'load'` resolves happily once the images have failed.
 *
 * This one serves the frames over a local HTTP server and loads the page from it, so there is no
 * `file://` subresource to block and no data URL to overflow (Chromium aborts a data URL of a few
 * megabytes, which two screenshots reach immediately). It fails loudly if any image does not decode
 * in the browser, rather than writing a black panel and letting a critic judge it.
 *
 * It writes:
 *   <out>/pair_01.png .. pair_NN.png    two frames side by side, letterboxed into the same box
 *   <out>/KEY.json                      which side is yours, per pair. NEVER show this to a critic
 *   <out>/CONTACT.png                   every pair stacked, so you look at what you are about to send
 *
 * Three details that matter, each learned the hard way:
 *   - the side is chosen per pair from a seeded shuffle, so a critic cannot learn "mine is left"
 *   - the bottom of every frame is cropped, because a HUD, a build stamp or a watermark in one set
 *     and not the other is a tell, and a critic will find it and tell you about the lighting instead
 *   - the key is written next to the pairs but is never part of them, and the critic is told the
 *     filename to refuse. A critic that can see the answer is a reviewer.
 */
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';

let puppeteer;
try { puppeteer = (await import('puppeteer')).default; }
catch { console.error('puppeteer is not installed. Run "npm install" in this repo first.'); process.exit(1); }

const args = process.argv.slice(2);
const list = (flag) => {
  const i = args.indexOf(flag);
  if (i < 0) return [];
  const out = [];
  for (let j = i + 1; j < args.length && !args[j].startsWith('--'); j++) out.push(args[j]);
  return out;
};
const opt = (flag, d) => { const i = args.indexOf(flag); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };

const mine = list('--mine');
const refs = list('--ref');
const out = opt('--out', '');
const W = +opt('--width', 960);
const SEED = +opt('--seed', 7);
const CROP = +opt('--crop', 0.07);
if (!mine.length || !refs.length || !out) {
  console.error('usage: node harness/pairs.mjs --mine <your frames> --ref <reference frames> --out <dir> [--seed 7] [--width 960] [--crop 0.07]');
  process.exit(1);
}
for (const f of [...mine, ...refs]) if (!fs.existsSync(f)) { console.error(`no such frame: ${f}`); process.exit(1); }

const H = Math.round((W * 9) / 16);
const mime = (f) => ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[path.extname(f).toLowerCase()] || 'image/png');

// Every frame gets an id and is served from here. Only the files named on the command line are
// reachable, so this cannot be pointed at the rest of the disk.
const served = new Map();
const idOf = (f) => { const abs = path.resolve(f); if (!served.has(abs)) served.set(abs, 'i' + served.size); return served.get(abs); };
for (const f of [...mine, ...refs]) idOf(f);
const byId = new Map([...served].map(([abs, id]) => [id, abs]));
const server = createServer((req, res) => {
  const id = decodeURIComponent(req.url.replace(/^\//, '').split('?')[0]);
  const abs = byId.get(id);
  if (!abs) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': mime(abs), 'Cache-Control': 'no-store' });
  fs.createReadStream(abs).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;
const url = (f) => BASE + idOf(f);

let seed = SEED >>> 0;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(out)) if (/^pair_\d+\.png$/.test(f) || f === 'KEY.json' || f === 'CONTACT.png') fs.unlinkSync(path.join(out, f));

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: W * 2 + 8, height: H, deviceScaleFactor: 1 });

const css = `html,body{margin:0;background:#0c0c0c}
.row{display:flex;gap:8px;width:${W * 2 + 8}px;height:${H}px}
.cell{width:${W}px;height:${H}px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#0c0c0c}
.cell img{max-width:100%;max-height:100%;object-fit:contain;clip-path:inset(0 0 ${(CROP * 100).toFixed(2)}% 0)}`;

const key = {};
const pairFiles = [];
for (let i = 0; i < mine.length; i++) {
  const ref = refs[i % refs.length];
  const mineLeft = rnd() < 0.5;
  const left = mineLeft ? mine[i] : ref;
  const right = mineLeft ? ref : mine[i];
  await page.goto(BASE + 'page?' + encodeURIComponent(left + '|' + right), { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.setContent(
    `<meta charset="utf-8"><base href="${BASE}"><style>${css}</style><div class="row">` +
    `<div class="cell"><img id="a" src="${url(left)}"></div>` +
    `<div class="cell"><img id="b" src="${url(right)}"></div></div>`, { waitUntil: 'load' });
  // a decoded image has a natural size; a broken one does not, and that is the failure this tool exists for
  const ok = await page.evaluate(async () => {
    const imgs = [...document.images];
    await Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
    return imgs.every((i) => i.naturalWidth > 0);
  });
  if (!ok) {
    await browser.close(); server.close();
    console.error(`pair ${i + 1} did not decode: one of\n  ${left}\n  ${right}\nis not an image the browser can read. Nothing written.`);
    process.exit(1);
  }
  const name = `pair_${String(i + 1).padStart(2, '0')}.png`;
  await page.screenshot({ path: path.join(out, name) });
  pairFiles.push(name);
  key[name] = { build: mineLeft ? 'left' : 'right', build_file: path.basename(mine[i]), ref_file: path.basename(ref) };
}

fs.writeFileSync(path.join(out, 'KEY.json'), JSON.stringify(key, null, 1));

// The contact sheet is not decoration. Every failure this tool is written against looked fine in a
// directory listing and was obviously broken the moment a person looked at one image.
await page.setViewport({ width: W * 2 + 8, height: (H + 6) * pairFiles.length, deviceScaleFactor: 1 });
for (const f of pairFiles) idOf(path.join(out, f));
await page.setContent(
  `<meta charset="utf-8"><base href="${BASE}"><style>html,body{margin:0;background:#0c0c0c}img{display:block;width:${W * 2 + 8}px;margin-bottom:6px}</style>` +
  pairFiles.map((f) => `<img src="${url(path.join(out, f))}">`).join(''), { waitUntil: 'load' });
await page.screenshot({ path: path.join(out, 'CONTACT.png'), fullPage: true });
await browser.close(); server.close();

console.log(`${pairFiles.length} pair(s) -> ${out}`);
console.log(`key         ${path.join(out, 'KEY.json')}   do not show this to the critic`);
console.log(`contact     ${path.join(out, 'CONTACT.png')}   LOOK at this before you send the pairs`);
