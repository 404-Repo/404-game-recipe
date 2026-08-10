#!/usr/bin/env node
/**
 * The gate. Run this on a directory of asset modules before you trust any of them.
 *
 *   node harness/verify.mjs <dir-of-asset-modules>
 *
 * It parses each module, loads it in a real browser, renders it from four sides,
 * measures it, and writes a picture you can look at. It exits non-zero if
 * anything fails, so an agent can loop on it.
 *
 * The check that earns its keep is the blank-side test. A generator working from
 * one reference image will produce something convincing from the front and a
 * featureless box from behind. Nothing in a syntax check or a hero screenshot
 * catches that. Comparing interior edge density across four sides does.
 *
 * What this cannot check is whether the thing looks like what you asked for.
 * That is what the pictures are for. Look at them.
 */
import { execFileSync } from 'child_process';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
if (!process.argv[2]) {
  console.error('usage: node harness/verify.mjs <dir-of-asset-modules>');
  process.exit(1);
}
const dir = path.resolve(process.argv[2]);
if (!fs.existsSync(dir)) {
  console.error(`no such directory: ${dir}`);
  process.exit(1);
}
const outDir = path.join(dir, '_verify');

const LIMITS = {
  minTris: 150,        // below this it is a placeholder, not an asset
  maxTris: 60000,      // above this something has run away, check for a lathe/sphere with huge segment counts
  minSize: 0.05,       // metres
  maxSize: 300,
  groundTol: 0.02,     // fraction of height the base may sit off y=0
  centreTol: 0.05,     // fraction of footprint the centre may sit off x/z zero
  sideRatio: 0.35,     // a side with less than this share of the busiest side's detail is unmodelled
};

// --- a static server, because ES modules will not import from file:// ---------
//
// TWO roots, and the second one is the whole point. Serving only the repo root
// means an asset directory anywhere outside the tree gets a module URL full of
// ../.. that the server refuses, and every asset in it fails with "Failed to
// fetch dynamically imported module". That reads as a broken asset. It is not:
// the same files pass from inside the tree and fail from outside it, so the
// gate reports a perfect pack as entirely broken and points the blame at the
// generator. Mount the target under a prefix and the location stops mattering.
//
// Paths that climb above the target resolve against the repo root, which is
// what a game's ../harness/assetlib.js expects.
const TARGET_PREFIX = '/__target__/';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
               '.png': 'image/png', '.json': 'application/json', '.css': 'text/css' };

function resolveRequest(urlPath) {
  if (urlPath.startsWith(TARGET_PREFIX)) {
    const file = path.join(dir, urlPath.slice(TARGET_PREFIX.length));
    return file.startsWith(dir) ? file : null;
  }
  const file = path.join(ROOT, urlPath);
  return file.startsWith(ROOT) ? file : null;
}

const server = createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]);
  const file = resolveRequest(rel);
  if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end('not found');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

// --- the run -----------------------------------------------------------------
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort();
if (!files.length) {
  console.error(`no .js assets in ${dir}`);
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

const results = [];
for (const f of files) {
  const name = f.replace(/\.js$/, '');
  const abs = path.join(dir, f);
  const problems = [];

  // 1. does it parse at all
  try {
    execFileSync(process.execPath, ['--check', abs], { stdio: 'pipe' });
  } catch (e) {
    results.push({ name, ok: false, problems: ['does not parse: ' + String(e.stderr || '').split('\n')[0]] });
    console.log(`FAIL  ${name.padEnd(22)} does not parse`);
    continue;
  }

  // 2. does it load, and what does it look like from every side
  const page = await browser.newPage();
  await page.setViewport({ width: 320 * 4, height: 320, deviceScaleFactor: 1 });
  const rel = TARGET_PREFIX + f;
  await page.goto(`${BASE}/harness/render.html?src=${encodeURIComponent(rel)}&size=320`,
    { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__DONE__', { timeout: 90000 }).catch(() => {});
  const info = await page.evaluate(() => window.__INFO__ || { ok: false, error: 'never finished' });
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
  await page.close();

  if (!info.ok) {
    results.push({ name, ok: false, problems: ['did not load: ' + info.error] });
    console.log(`FAIL  ${name.padEnd(22)} ${info.error}`);
    continue;
  }

  // 3. is it a sane object
  const [w, h, d] = info.size;
  if (info.tris < LIMITS.minTris) problems.push(`only ${info.tris} triangles, too crude to be finished`);
  if (info.tris > LIMITS.maxTris) problems.push(`${info.tris} triangles, far heavier than it needs to be`);
  const big = Math.max(w, h, d);
  if (big < LIMITS.minSize || big > LIMITS.maxSize) problems.push(`${big}m across, not a plausible real-world size`);
  if (h > 1e-6 && Math.abs(info.groundOffset) > Math.max(LIMITS.groundTol * h, 0.01)) {
    problems.push(`base sits at y=${info.groundOffset}, should be 0`);
  }
  const foot = Math.max(w, d);
  if (foot > 1e-6) {
    const [cx, cz] = info.centreOffset;
    if (Math.abs(cx) > LIMITS.centreTol * foot || Math.abs(cz) > LIMITS.centreTol * foot) {
      problems.push(`not centred on x/z (offset ${cx}, ${cz})`);
    }
  }

  // 4. the blank-side test
  const sides = Object.entries(info.sides);
  const busiest = Math.max(...sides.map(([, s]) => s.edgeDensity));
  for (const [side, s] of sides) {
    if (busiest > 0 && s.edgeDensity < LIMITS.sideRatio * busiest) {
      problems.push(`${side} face is nearly featureless next to the others, it was probably never modelled`);
    }
    if (s.coverage < 0.005) problems.push(`${side} face is empty`);
  }

  const ok = problems.length === 0;
  // Spread info FIRST: it carries its own ok:true from the render page, and
  // letting it land last silently overwrote the verdict computed above, so the
  // gate reported everything clean while printing warnings.
  results.push({ ...info, name, ok, problems });
  const tag = ok ? 'ok  ' : 'WARN';
  console.log(`${tag}  ${name.padEnd(22)} ${String(info.tris).padStart(6)} tris  ${info.meshes} meshes  ${w}x${h}x${d}m`);
  for (const p of problems) console.log(`        ${p}`);
}

// --- a sheet you can actually look at ----------------------------------------
const rows = results.filter((r) => fs.existsSync(path.join(outDir, `${r.name}.png`)));
const sheetHtml = `<!doctype html><meta charset="utf-8">
<style>
 body{margin:0;background:#16181c;font:13px -apple-system,Helvetica,sans-serif;color:#ddd}
 .r{padding:6px 10px}
 .h{display:flex;gap:10px;align-items:baseline;padding:2px 0}
 .n{font-size:15px;color:#eee}
 .s{color:#8fa}
 .b{color:#f88}
 img{width:1280px;display:block;border-radius:3px}
</style>
<div style="padding:10px 10px 0"><b>front &nbsp; right &nbsp; back &nbsp; left</b> &nbsp; each asset, four sides, same camera and light</div>
${rows.map((r) => `<div class="r"><div class="h"><span class="n">${r.name}</span>
  <span class="${r.ok ? 's' : 'b'}">${r.ok ? 'ok' : r.problems.join(' | ')}</span>
  <span style="color:#888">${r.tris ?? '?'} tris, ${r.meshes ?? '?'} meshes</span></div>
  <img src="${TARGET_PREFIX}_verify/${r.name}.png"></div>`).join('\n')}`;
fs.writeFileSync(path.join(outDir, 'sheet.html'), sheetHtml);
const sp = await browser.newPage();
await sp.setViewport({ width: 1320, height: 900 });
await sp.goto(`${BASE}${TARGET_PREFIX}_verify/sheet.html`,
  { waitUntil: 'networkidle0', timeout: 60000 });
await sp.screenshot({ path: path.join(outDir, 'sheet.png'), fullPage: true });
await sp.close();

await browser.close();
server.close();

fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(results, null, 1));
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} clean`);
console.log(`sheet:  ${path.join(outDir, 'sheet.png')}`);
console.log(`report: ${path.join(outDir, 'report.json')}`);
if (bad.length) {
  console.log(`\nLook at the sheet before you fix anything. The measurements below flag structure,`);
  console.log(`they cannot tell you whether the asset resembles what you asked for.`);
  process.exit(1);
}
