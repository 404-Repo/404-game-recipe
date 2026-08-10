#!/usr/bin/env node
/**
 * Wrap a unit-cube asset module into the contract this repo uses.
 *
 * The open model behind the 404 competition emits modules to the competition
 * contract: `export default function generate(THREE)`, geometry normalised to
 * fit inside [-0.5, 0.5] on every axis and centred on the origin. This repo's
 * contract (docs/asset-contract.md) wants real-world metres, the base at
 * y = 0 and the object centred on x and z — and verify.mjs enforces that, so
 * unwrapped model output fails verification on size and ground checks even
 * when the geometry is perfect.
 *
 * This script rewrites one module into the other. You supply the one fact the
 * model cannot know: how tall the object is in real life.
 *
 *   node harness/wrap.mjs <module.js> <height-in-metres> [-o out.js]
 *
 * Writes <module>.wrapped.js next to the input unless -o says otherwise. The
 * output is a self-contained module in the repo contract; verify it and load
 * it like any other asset.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const oIdx = args.indexOf('-o');
const outArg = oIdx >= 0 ? args.splice(oIdx, 2)[1] : null;
const [inPath, heightArg] = args;
const height = Number(heightArg);

if (!inPath || !Number.isFinite(height) || height <= 0) {
  console.error('usage: node harness/wrap.mjs <module.js> <height-in-metres> [-o out.js]');
  process.exit(1);
}

const src = readFileSync(inPath, 'utf8');

// The competition contract promises exactly one export: the default function.
// Anything else means this is not a module in that contract, and silently
// wrapping it would produce garbage with a working file extension.
const exports_ = src.match(/^\s*export\b/gm) || [];
if (exports_.length !== 1 || !/export\s+default\s+(async\s+)?function/.test(src)) {
  console.error(`${inPath}: expected exactly one "export default function" and no other exports.`);
  process.exit(1);
}
if (/export\s+default\s+async/.test(src)) {
  console.error(`${inPath}: the module's default function is async; the contract requires synchronous.`);
  process.exit(1);
}

const inner = src.replace(/export\s+default\s+function/, 'const __POD_MODULE__ = function');

const wrapped = `${inner}

// Appended by harness/wrap.mjs: unit-cube module -> repo contract.
// Real height ${height} m, base at y = 0, centred on x and z.
export default function (THREE) {
  const wrap = new THREE.Group();
  const obj = __POD_MODULE__(THREE);
  wrap.add(obj);
  wrap.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(obj);
  let size = box.getSize(new THREE.Vector3());
  if (size.y > 1e-9) {
    obj.scale.multiplyScalar(${height} / size.y);
    obj.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(obj);
  }
  const c = box.getCenter(new THREE.Vector3());
  obj.position.x -= c.x;
  obj.position.z -= c.z;
  obj.position.y -= box.min.y;
  return wrap;
}
`;

const outPath = outArg || inPath.replace(/\.js$/, '') + '.wrapped.js';
writeFileSync(outPath, wrapped);
console.log(`${outPath}  (${height} m tall, based at y=0)`);
