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

/** Run the gate over a directory and hand back its report. */
function gate(dir) {
  const res = spawnSync(process.execPath, [path.join(ROOT, 'harness/verify.mjs'), dir],
    { encoding: 'utf8' });
  const rp = path.join(dir, '_verify/report.json');
  return { status: res.status, stdout: res.stdout || '',
           report: fs.existsSync(rp) ? JSON.parse(fs.readFileSync(rp, 'utf8')) : null };
}

const backWarned = (row) =>
  !!row && row.problems.some((p) => p.startsWith('back face') && p.includes('never modelled'));

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
const GOOD = fs.readdirSync(path.join(HERE, 'good')).filter((f) => f.endsWith('.js')).sort();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'recipe-outoftree-'));
for (const f of fs.readdirSync(path.join(HERE, 'good'))) {
  fs.copyFileSync(path.join(HERE, 'good', f), path.join(tmp, f));   // .js and any .expect.json beside it
}

console.log(`\nrunning the gate on clean assets from OUTSIDE the tree (${tmp})\n`);
const out = spawnSync(process.execPath, [path.join(ROOT, 'harness/verify.mjs'), tmp],
  { encoding: 'utf8' });
process.stdout.write(out.stdout || '');

const outReport = path.join(tmp, '_verify/report.json');
let outRows = fs.existsSync(outReport) ? JSON.parse(fs.readFileSync(outReport, 'utf8')) : [];
const clean = outRows.find((x) => x.name === 'clean');
const fetchFailed = clean && clean.problems.some((p) => p.includes('dynamically imported module'));
const outOk = out.status === 0 && clean && clean.ok && !fetchFailed;
if (fetchFailed) {
  console.log('\nMISSED  out-of-tree     the server would not serve the target directory');
}
console.log(`${outOk ? 'caught  ' : 'MISSED  '}${'out-of-tree'.padEnd(16)} ` +
            'expected a clean asset outside the repo to pass');
if (!outOk) bad++;
fs.rmSync(tmp, { recursive: true, force: true });

/* ---------------------------------------------------------------------------
 * A declared mounting face, and the control that makes the claim mean something.
 *
 * mounted_lamp sets userData.mounts = 'back', because a wall lamp really does
 * have a flat back and the blank-side check was flagging every one of them.
 * Asserting only that it passes would prove nothing: it would also pass if the
 * exemption did nothing and the back were simply never blank enough to trip the
 * threshold. So run the same asset again with the declaration stripped out and
 * require the warning to appear. Either run alone is not a test.
 */
/* An asset whose copies live in instance matrices measures as one copy of its
 * prototype unless the bounds walk expands them. It shipped that way: ten slabs
 * stacked two metres tall reported 0.1m, and size, ground, centring and camera
 * framing went wrong together. racking.js is 2.0m tall and says so in its
 * expect.json, so this asserts the bounds AND the stated size at once. */
const rack = outRows.find((x) => x.name === 'racking');
const rackOk = !!rack && rack.ok && Math.abs((rack.size ? rack.size[1] : 0) - 2.0) < 0.05;
console.log(`${rackOk ? 'caught  ' : 'MISSED  '}${'instanced bounds'.padEnd(16)} ` +
            `expected a 2.0m instanced asset to measure 2.0m${rack && rack.size ? `, got ${rack.size[1]}` : ''}`);
if (!rackOk) bad++;

const lamp = outRows.find((x) => x.name === 'mounted_lamp');
const lampQuiet = lamp && lamp.ok && !backWarned(lamp);
console.log(`${lampQuiet ? 'quiet   ' : 'MISSED  '}${'mounted_lamp'.padEnd(16)} ` +
            "expected mounts:'back' to exempt the declared face");
if (!lampQuiet) bad++;

const ctlDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recipe-mounts-'));
fs.writeFileSync(
  path.join(ctlDir, 'mounted_lamp.js'),
  fs.readFileSync(path.join(HERE, 'good/mounted_lamp.js'), 'utf8')
    .replace(/^.*userData\.mounts.*$/m, ''),
);
const ctl = spawnSync(process.execPath, [path.join(ROOT, 'harness/verify.mjs'), ctlDir],
  { encoding: 'utf8' });
const ctlReport = path.join(ctlDir, '_verify/report.json');
const ctlLamp = fs.existsSync(ctlReport)
  ? JSON.parse(fs.readFileSync(ctlReport, 'utf8')).find((x) => x.name === 'mounted_lamp')
  : null;
const ctlFired = backWarned(ctlLamp);
console.log(`${ctlFired ? 'caught  ' : 'MISSED  '}${'mounted_lamp'.padEnd(16)} ` +
            'expected the same asset undeclared to be flagged');
if (!ctlFired) {
  console.log('        without this the exemption above proved nothing');
  if (ctl.status !== 0 && !ctlLamp) process.stdout.write(ctl.stdout || '');
  bad++;
}
fs.rmSync(ctlDir, { recursive: true, force: true });

/* ---------------------------------------------------------------------------
 * A stated size, which the gate could not use until now.
 *
 * Its only size test is 5cm to 300m, which passed a 9.4m facade written to a 6m
 * brief. Both directions matter: a wrong size must fire, and a right one must
 * stay quiet, or the check is just noise on every asset that has an expect file.
 */
const sizeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recipe-size-'));
fs.copyFileSync(path.join(HERE, 'good/clean.js'), path.join(sizeDir, 'toobig.js'));
fs.copyFileSync(path.join(HERE, 'good/clean.js'), path.join(sizeDir, 'right.js'));
fs.writeFileSync(path.join(sizeDir, 'toobig.expect.json'), JSON.stringify({ height: 4.0 }));
fs.writeFileSync(path.join(sizeDir, 'right.expect.json'), JSON.stringify({ height: 1.0, tolerance: 0.2 }));
const sz = gate(sizeDir);
const rows = sz.report || [];
const tooBig = rows.find((x) => x.name === 'toobig');
const right = rows.find((x) => x.name === 'right');
const firedOnWrong = !!tooBig && tooBig.problems.some((p) => p.includes('expected 4m'));
const quietOnRight = !!right && right.ok;
console.log('');
console.log(`${firedOnWrong ? 'caught  ' : 'MISSED  '}${'expected size'.padEnd(16)} a 1m object declared 4m tall`);
if (!firedOnWrong) bad++;
console.log(`${quietOnRight ? 'quiet   ' : 'MISSED  '}${'expected size'.padEnd(16)} the same object declared correctly`);
if (!quietOnRight) bad++;
fs.rmSync(sizeDir, { recursive: true, force: true });

console.log(bad ? `\n${bad} check(s) did not fire. The gate is not protecting you.`
                : '\nevery check fired. the gate works.');
process.exit(bad ? 1 : 0);
