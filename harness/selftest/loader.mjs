#!/usr/bin/env node
/**
 * Proves the loader does not eat things that move.
 *
 *   node harness/selftest/loader.mjs
 *
 * ASSET() merges by material as it loads, which is right for scenery and fatal
 * for a character: it welds the parts into one mesh and drops the userData that
 * named them. The asset still renders perfectly, so nothing you look at will
 * tell you. That is why this exists as a test rather than as a comment.
 *
 * It asserts both directions, because only one of them is a claim:
 *   - default: merged, few meshes  (the optimisation still happens)
 *   - keepHierarchy: parts and userData intact  (the escape hatch works)
 */
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

let puppeteer;
try {
  puppeteer = (await import('puppeteer')).default;
} catch {
  console.error('puppeteer is not installed. Run "npm install" in this repo first.');
  process.exit(1);
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript' };
const server = createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end('not found');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const page = `<!doctype html><meta charset="utf-8">
<script type="importmap">{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"
} }</script>
<script type="module">
import { ASSET } from '/harness/assetlib.js';
const url = '/harness/selftest/good/hinged.js';
const count = (o) => { let n = 0; o.traverse((x) => { if (x.isMesh) n++; }); return n; };
try {
  const merged = await ASSET(url);
  const tree = await ASSET(url, { keepHierarchy: true });
  const tree2 = await ASSET(url, { keepHierarchy: true });
  // The reference has to point at THIS instance's node. Pointing at a shared
  // prototype is the failure that looks like success: rotating it moves nothing
  // and throws nothing, and two customers turn into one.
  const lid = tree.userData.parts && tree.userData.parts.lid;
  const lid2 = tree2.userData.parts && tree2.userData.parts.lid;
  let ownNode = false, distinct = false;
  if (lid && lid.isObject3D) {
    tree.traverse((o) => { if (o === lid) ownNode = true; });
    distinct = !!(lid2 && lid2 !== lid);
    lid.rotation.x = -0.7;
  }
  window.__R__ = {
    ok: true,
    mergedMeshes: count(merged),
    treeMeshes: count(tree),
    mergedHasParts: !!(merged.userData && merged.userData.parts),
    treeHasParts: !!(tree.userData && tree.userData.parts),
    treeLidIsObject: !!(lid && lid.isObject3D),
    ownNode,
    distinct,
    rotated: !!(lid && Math.abs(lid.rotation.x + 0.7) < 1e-6),
  };
} catch (e) { window.__R__ = { ok: false, error: String(e && e.message || e) }; }
window.__DONE__ = true;
</script>`;
fs.writeFileSync(path.join(HERE, '_loader.html'), page);

const browser = await puppeteer.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const p = await browser.newPage();
await p.goto(`${BASE}/harness/selftest/_loader.html`, { waitUntil: 'load', timeout: 60000 });
await p.waitForFunction('window.__DONE__', { timeout: 60000 }).catch(() => {});
const r = await p.evaluate(() => window.__R__ || { ok: false, error: 'never finished' });
await browser.close();
server.close();
fs.rmSync(path.join(HERE, '_loader.html'), { force: true });

if (!r.ok) {
  console.error(`FAILED: ${r.error}`);
  process.exit(1);
}

let bad = 0;
const check = (label, pass, detail) => {
  console.log(`${pass ? 'ok      ' : 'FAILED  '}${label.padEnd(34)} ${detail}`);
  if (!pass) bad++;
};
console.log('loading an asset that has moving parts, both ways\n');
check('default still merges', r.mergedMeshes < r.treeMeshes,
      `${r.mergedMeshes} meshes merged vs ${r.treeMeshes} kept`);
check('default drops userData', !r.mergedHasParts, 'as documented, and why the option exists');
check('keepHierarchy keeps userData', r.treeHasParts, 'userData.parts present');
check('and the named part is an object', r.treeLidIsObject, 'userData.parts.lid is an Object3D');
check('it belongs to this instance', r.ownNode, 'found inside the returned tree, not a prototype');
check('two instances get their own', r.distinct, 'otherwise every copy moves as one');
check('and rotating it takes effect', r.rotated, 'the point of the whole exercise');

console.log(bad ? `\n${bad} check(s) failed. Anything that moves will arrive welded solid.`
                : '\nthe loader keeps what moves, and still merges what does not.');
process.exit(bad ? 1 : 0);
