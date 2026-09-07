#!/usr/bin/env node
/**
 * Check a game folder is fit to ship, and stamp it so a host's cache cannot serve half of it.
 *
 *   node harness/ship.mjs <game-dir>              check only
 *   node harness/ship.mjs <game-dir> --stamp      check, then stamp every relative import
 *
 * Two jobs, both of which cost us a day the first time we skipped them.
 *
 * PARSE EVERY MODULE. An asset that throws on import prints one line and the game carries on,
 * emptier than it should be. We shipped four rounds where three assets were broken by a comment
 * appended to a one line arrow body: the level logged "loaded empty", the frame rate gate saw
 * nothing wrong because an empty level is fast, and the filmstrip looked plausible. Anything that
 * can silently drop content needs a hard check in front of it.
 *
 * STAMP THE IMPORTS. Static hosts cache aggressively (GitHub Pages sends max-age=600). A visitor
 * who opened your game in the ten minutes before you pushed keeps the old modules against the new
 * index.html, which is a version of your game that has never existed and cannot be reproduced.
 * Stamping every relative specifier with ?v=<stamp> makes a new index pull new modules.
 *
 * It also refuses to stamp a folder that reaches outside itself, since that game will 404 on any
 * host that is not your laptop.
 */
import fs from 'fs';
import path from 'path';

const target = path.resolve(process.argv[2] || '.');
const STAMP = process.argv.includes('--stamp');
if (!fs.existsSync(path.join(target, 'index.html'))) {
  console.error(`no index.html in ${target}`);
  process.exit(1);
}

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('_') || e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else files.push(p);
  }
})(target);

const scripts = files.filter((f) => /\.(m?js)$/.test(f));
const pages = files.filter((f) => f.endsWith('.html'));
const problems = [];

// 1. every module parses
const { execFileSync } = await import('child_process');
for (const f of scripts) {
  try {
    execFileSync(process.execPath, ['--input-type=module', '--check'], { input: fs.readFileSync(f), stdio: ['pipe', 'ignore', 'pipe'] });
  } catch (e) {
    problems.push(`${path.relative(target, f)} does not parse: ${String(e.stderr || e).split('\n').find((l) => l.includes('Error')) || 'syntax error'}`);
  }
}

// 2. nothing reaches above the folder
const escapes = [];
for (const f of [...scripts, ...pages]) {
  const src = fs.readFileSync(f, 'utf8');
  const dir = path.dirname(f);
  for (const m of src.matchAll(/(?:from|import|src=|href=)\s*\(?\s*['"](\.\.\/[^'"]+)['"]/g)) {
    const resolved = path.resolve(dir, m[1]);
    if (!resolved.startsWith(target)) escapes.push(`${path.relative(target, f)} -> ${m[1]}`);
  }
}
if (escapes.length) {
  problems.push(`${escapes.length} path(s) reach outside the game folder, so this ships broken: ` +
                `${escapes.slice(0, 3).join(', ')}${escapes.length > 3 ? ' ...' : ''}`);
}

// 3. an absolute path is a subpath deploy waiting to fail
const absolutes = [];
for (const f of [...scripts, ...pages]) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/(?:from|import|src=|href=)\s*\(?\s*['"](\/[^/'"][^'"]*)['"]/g)) absolutes.push(`${path.relative(target, f)} -> ${m[1]}`);
}
if (absolutes.length) {
  problems.push(`${absolutes.length} absolute path(s): these resolve to the domain root and 404 under /<repo>/. ` +
                `${absolutes.slice(0, 3).join(', ')}`);
}

console.log(`${scripts.length} module(s), ${pages.length} page(s) in ${path.relative(process.cwd(), target) || target}`);
if (problems.length) {
  console.log('\nproblems:');
  for (const p of problems) console.log('  ' + p);
  process.exit(1);
}
console.log('every module parses, every path stays inside the folder');

if (STAMP) {
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  let n = 0;
  for (const f of [...scripts, ...pages]) {
    const before = fs.readFileSync(f, 'utf8');
    const after = before
      .replace(/((?:from|import)\s*\(?\s*['"])(\.{1,2}\/[^'"?]+\.m?js)(['"])/g, `$1$2?v=${stamp}$3`)
      .replace(/(<script[^>]*\ssrc=['"])(\.?\/?[^'"?]+\.m?js)(['"])/g, `$1$2?v=${stamp}$3`);
    if (after !== before) { fs.writeFileSync(f, after); n++; }
  }
  console.log(`stamped ${n} file(s) with ?v=${stamp}`);
  console.log('after deploying, check the live page actually carries it: node harness/live.mjs <url>');
}
