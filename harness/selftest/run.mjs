#!/usr/bin/env node
/**
 * Proves the gate works.
 *
 *   node harness/selftest/run.mjs
 *
 * Runs verify.mjs against fixtures that are broken in known ways and asserts it
 * catches each one. A check nobody has ever seen fail is not a check, it is
 * decoration, and a silently passing gate is worse than no gate because it buys
 * you confidence you have not earned.
 *
 * Run this once after cloning. If it does not pass, verify.mjs is not protecting
 * you and nothing downstream of it can be trusted.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const FIXTURES = path.join(HERE, 'fixtures');

// Each fixture, and the substring the report must contain for it.
const EXPECT = {
  blank_back:   'never modelled',
  floating:     'should be 0',
  runaway_tris: 'far heavier',
};

console.log('running the gate against deliberately broken assets\n');
const r = spawnSync(process.execPath, [path.join(ROOT, 'harness/verify.mjs'), FIXTURES],
  { encoding: 'utf8' });
process.stdout.write(r.stdout || '');

if (r.status === 0) {
  console.error('\nFAILED: the gate passed assets that are all broken.');
  process.exit(1);
}

const reportPath = path.join(FIXTURES, '_verify/report.json');
if (!fs.existsSync(reportPath)) {
  console.error('\nFAILED: no report written.');
  process.exit(1);
}
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

let bad = 0;
for (const [name, needle] of Object.entries(EXPECT)) {
  const row = report.find((x) => x.name === name);
  const found = row && row.problems.some((p) => p.includes(needle));
  console.log(`${found ? 'caught  ' : 'MISSED  '}${name.padEnd(16)} expected "${needle}"`);
  if (!found) bad++;
}

// floating.js should trip the centring check as well as the ground check.
const floating = report.find((x) => x.name === 'floating');
const centred = floating && floating.problems.some((p) => p.includes('not centred'));
console.log(`${centred ? 'caught  ' : 'MISSED  '}${'floating'.padEnd(16)} expected "not centred"`);
if (!centred) bad++;

/* ---------------------------------------------------------------------------
 * The gate must also be right about GOOD assets, from anywhere on disk.
 *
 * This half exists because the verifier used to serve only the repo root. An
 * asset directory outside the tree got a module URL the server refused, so
 * every asset in it failed with "Failed to fetch dynamically imported module"
 * and the run reported 0/N clean. The files were fine. A gate that calls a
 * perfect pack broken, in the vocabulary of a broken asset, sends you to debug
 * a generator that was never wrong, and the false negative is invisible unless
 * something checks for it.
 */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'recipe-outoftree-'));
fs.copyFileSync(path.join(HERE, 'good/clean.js'), path.join(tmp, 'clean.js'));

console.log(`\nrunning the gate on a clean asset from OUTSIDE the tree (${tmp})\n`);
const out = spawnSync(process.execPath, [path.join(ROOT, 'harness/verify.mjs'), tmp],
  { encoding: 'utf8' });
process.stdout.write(out.stdout || '');

const outReport = path.join(tmp, '_verify/report.json');
let outOk = false;
if (fs.existsSync(outReport)) {
  const rows = JSON.parse(fs.readFileSync(outReport, 'utf8'));
  const row = rows.find((x) => x.name === 'clean');
  const fetchFailed = row && row.problems.some((p) => p.includes('dynamically imported module'));
  outOk = out.status === 0 && row && row.ok && !fetchFailed;
  if (fetchFailed) {
    console.log('\nMISSED  out-of-tree     the server would not serve the target directory');
  }
}
console.log(`${outOk ? 'caught  ' : 'MISSED  '}${'out-of-tree'.padEnd(16)} ` +
            'expected a clean asset outside the repo to pass');
if (!outOk) bad++;
fs.rmSync(tmp, { recursive: true, force: true });

console.log(bad ? `\n${bad} check(s) did not fire. The gate is not protecting you.`
                : '\nevery check fired. the gate works.');
process.exit(bad ? 1 : 0);
