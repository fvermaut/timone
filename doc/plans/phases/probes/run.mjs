// Runs the standing regression set in one command, in parallel.
//
//   node doc/plans/phases/probes/run.mjs --regression
//
// The set is DERIVED here, at run time, from the criteria registers — priority
// MUST, verify-via api, status verified — never maintained as a second list.
// A criterion with no probe file is printed as NO PROBE so the gap is a visible
// number rather than a silent omission.
//
// ✏ 2026-10-02 (phase 42 verification, ADR-0061 D1): the one command does REAL
// RUNS ONLY. Each probe is started with PROBE_REAL_ONLY=1, so its clauses skip
// their break leg. A probe owed a break run (new, rewritten, in doubt) is run on
// its own, `node doc/plans/phases/probes/<id>.mjs`, which does both legs.
//   --with-break   does both legs for every probe, as every pass did before.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { PROBE_DIR, REPO_ROOT } from './_lib.mjs';

const PRD_DIR = path.join(REPO_ROOT, 'doc', 'specs', 'prd');

function derive() {
  const set = [];
  for (const file of fs.readdirSync(PRD_DIR).filter((f) => f.endsWith('.criteria.md')).sort()) {
    const prd = file.match(/^(prd-\d+)/)[1].toUpperCase();
    const text = fs.readFileSync(path.join(PRD_DIR, file), 'utf8');
    for (const block of text.split(/\n(?=## R\d+ )/).slice(1)) {
      const rk = block.match(/^## (R\d+) /)[1];
      const field = (name) => (block.match(new RegExp(`^- \\*\\*${name}:\\*\\* ?(\\S*)`, 'm')) || [])[1];
      const priority = field('Priority');
      const status = field('Status');
      const channel = field('Verify-via');
      if (priority === 'MUST' && channel === 'api' && status === 'verified') {
        set.push({ id: `${prd}.${rk}`, title: block.split('\n')[0].replace(/^## /, '') });
      }
    }
  }
  return set;
}

const set = derive();
const withBreak = process.argv.includes('--with-break');
console.log(`Derived regression set: ${set.length} criteria (MUST + api + verified)`);
console.log(withBreak ? 'Mode: break run, then real run, for every probe (--with-break)\n' : 'Mode: real runs only (PROBE_REAL_ONLY=1)\n');
const childEnv = { ...process.env };
if (withBreak) delete childEnv.PROBE_REAL_ONLY;
else childEnv.PROBE_REAL_ONLY = '1';

const run = (file) =>
  new Promise((resolve) => {
    execFile(process.execPath, [file], { cwd: REPO_ROOT, env: childEnv, maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) =>
      resolve({ code: err ? (err.code ?? 1) : 0, out: `${stdout}${stderr}` }),
    );
  });

const results = await Promise.all(
  set.map(async (c) => {
    const file = path.join(PROBE_DIR, `${c.id.toLowerCase()}.mjs`);
    if (!fs.existsSync(file)) return { ...c, verdict: 'NO PROBE', out: '' };
    const r = await run(file);
    // A probe exits 3 when none of its clauses could be judged: all were BLOCKED (_rig.mjs's finish()).
    // ✏ 2026-10-02 (phase 41 verification): that used to be counted as FAIL here.
    return { ...c, verdict: r.code === 0 ? 'PASS' : r.code === 3 ? 'BLOCKED' : 'FAIL', out: r.out };
  }),
);

for (const r of results.filter((r) => r.out)) {
  console.log(r.out.trimEnd());
  console.log('');
}

const width = Math.max(...results.map((r) => r.id.length));
console.log('| ID'.padEnd(width + 3) + ' | Verdict   | Criterion');
console.log('|-'.padEnd(width + 3, '-') + '-|-----------|----------');
for (const r of results) {
  console.log(`| ${r.id.padEnd(width)} | ${r.verdict.padEnd(9)} | ${r.title}`);
}
const passing = results.filter((r) => r.verdict === 'PASS').length;
const failing = results.filter((r) => r.verdict === 'FAIL').length;
const blockedN = results.filter((r) => r.verdict === 'BLOCKED').length;
console.log(`\n${passing} passing, ${failing} failing, ${blockedN} blocked, ${results.length - passing - failing - blockedN} with no probe.`);
process.exit(failing > 0 ? 1 : 0);
