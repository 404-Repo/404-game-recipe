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

// Each broken fixture, and the substring the report must contain for it.
const EXPECT = {
  blank_back:   'never modelled',
  floating:     'should be 0',
  runaway_tris: 'far heavier',
};

/** Run the gate over a directory and return its report, or null. */
function gate(dir) {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'harness/verify.mjs'), dir],
    { encoding: 'utf8' });
  const p = path.join(dir, '_verify/report.json');
  return { status: r.status, stdout: r.stdout || '',
           report: fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null };
}

const backWarned = (row) =>
  !!row && row.problems.some((p) => p.startsWith('back face') && p.includes('never modelled'));

console.log('running the gate against deliberately broken assets\n');
const r = gate(FIXTURES);
process.stdout.write(r.stdout);

if (r.status === 0) {
  console.error('\nFAILED: the gate passed assets that are broken.');
  process.exit(1);
}
if (!r.report) {
  console.error('\nFAILED: no report written.');
  process.exit(1);
}
const report = r.report;

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

// The other half of a gate: it must not fire on work that is correct.
//
// mounted_lamp declares userData.mounts = 'back', because a wall lamp really does
// have a flat back. Asserting only that it passes would prove nothing, since it
// would also pass if the exemption did nothing and the back were never blank
// enough to flag. So run the same asset again with the declaration stripped and
// require the warning to appear. One run without the other is not a test.
console.log('');
const lamp = report.find((x) => x.name === 'mounted_lamp');
if (backWarned(lamp)) {
  console.log(`MISSED  ${'mounted_lamp'.padEnd(16)} declares mounts:'back' and was flagged anyway`);
  bad++;
} else {
  console.log(`quiet   ${'mounted_lamp'.padEnd(16)} declared mounting face not flagged`);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'recipe-selftest-'));
fs.writeFileSync(
  path.join(tmp, 'mounted_lamp.js'),
  fs.readFileSync(path.join(FIXTURES, 'mounted_lamp.js'), 'utf8')
    .replace(/^.*userData\.mounts.*$/m, ''),
);
const ctl = gate(tmp);
const ctlLamp = ctl.report && ctl.report.find((x) => x.name === 'mounted_lamp');
if (backWarned(ctlLamp)) {
  console.log(`caught  ${'mounted_lamp'.padEnd(16)} same asset undeclared IS flagged`);
} else {
  console.log(`MISSED  ${'mounted_lamp'.padEnd(16)} undeclared back was not flagged, so the`);
  console.log(`        exemption above proved nothing`);
  bad++;
}
fs.rmSync(tmp, { recursive: true, force: true });

console.log(bad ? `\n${bad} check(s) did not fire. The gate is not protecting you.`
                : '\nevery check fired, and none fired on correct work. the gate works.');
process.exit(bad ? 1 : 0);
