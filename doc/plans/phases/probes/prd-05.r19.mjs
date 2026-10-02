// Probe for PRD-05.R19 — Each project runs on the runner or on the current daemon, until every project has moved.
// Stage 7 artifact. First authored 2026-09-28 (phase 40) from the register alone.
//
// ✏ Re-authored 2026-10-02 (phase 41 verification, timone#166) from the register as it now stands.
// The phase-40 probe checked that a `driver` line chose the driver, and that ivtrends had not moved.
// The register's note of 2026-09-30 says that period is over, so that probe tested what this phase
// removed on purpose. What the register now says, and what this probe checks:
//
//   Criterion (verbatim): a project's entry in timone.yaml says which one drives its tickets. The
//   daemon drives each project the way its entry says, and two projects can differ. scratch-app
//   moves first, and ivtrends moves only after a supervised run on scratch-app has passed R9, R12,
//   R13 and R15.
//   Note of 2026-09-30 (verbatim): every project has moved to the runner. The `driver` line went
//   with the old code (R20): a `timone.yaml` that still has one does not load, and says to delete
//   the line. So the period R19 covers is over. Its status is left to verification.
//
// The criterion's own title bounds it: "until every project has moved". The checks below are the
// note's two facts. Break legs run the build from just before phase 41 (_old-build.mjs), where a
// project with no `driver` line ran on the current daemon and a `driver` line was accepted.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import { execFileSync } from 'node:child_process';
import { oldBuild } from './_old-build.mjs';
import { fixture, model, daemon, act, say, clause, assert, finish, REPO_ROOT, CLI } from './_rig.mjs';

const OLD = oldBuild();
const N = 11;

// Note 1 — every project has moved to the runner.
// (a) The repository's own timone.yaml: no entry carries a `driver` line, and this build loads it.
// (b) A project whose entry has no `driver` line — the only kind of entry left — is driven by the
//     runner: a runner session starts on its ticket, and the step that runs is the one it started.
async function servedBy(cliPath) {
  const fx = fixture({ issues: { fixture: { [N]: {} } }, cli: cliPath });
  const m = await model({
    runner: (c) => (c.wake === 0 && c.turn === 0 ? act('start_step', { stage: 'triage', instructions: 'sort it', reason: 'probe', skipReason: 'probe' }) : say()),
    step: () => say('done'),
  });
  await daemon(fx, m, { until: () => m.steps().length > 0, timeoutMs: 25000, settleMs: 3000 });
  await m.stop();
  const r = { runner: m.runner().length, steps: m.steps().length, decisions: fx.record(N).filter((e) => e.kind === 'decision' && e.action === 'start_step').length };
  fx.cleanup();
  return r;
}
const nowServed = await servedBy(CLI);
const oldServed = await servedBy(OLD);
const realManifest = fs.readFileSync(path.join(REPO_ROOT, 'timone.yaml'), 'utf8');
function loads(cliPath, text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-r19-'));
  fs.writeFileSync(path.join(dir, 'timone.yaml'), text);
  const r = (() => { try { return { code: 0, out: execFileSync(process.execPath, [cliPath, 'projects', 'list'], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] }).toString() }; } catch (e) { return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }; } })();
  fs.rmSync(dir, { recursive: true, force: true });
  return r;
}
function assertAllMoved(served, cliPath) {
  const y = YAML.parse(realManifest);
  const withLine = Object.entries(y.projects ?? {}).filter(([, p]) => p && 'driver' in p).map(([n]) => n);
  assert(withLine.length === 0, `entries still carrying a driver line: ${withLine.join(', ')}`);
  const l = loads(cliPath, realManifest);
  assert(l.code === 0, `the repository's timone.yaml does not load: ${l.out.trim()}`);
  assert(served.runner > 0, 'a project with no driver line was not driven by the runner: no runner session started');
  assert(served.steps === served.decisions, `${served.steps} step session(s) ran, and the runner started ${served.decisions}`);
}
await clause('PRD-05.R19 note 1', 'every project has moved to the runner', {
  broken: async () => assertAllMoved(oldServed, OLD),
  correct: async () => assertAllMoved(nowServed, CLI),
});
console.log(`    (projects in the repository's timone.yaml: ${Object.keys(YAML.parse(realManifest).projects ?? {}).join(', ')})`);
console.log(`    (a project with no driver line — this build: ${nowServed.runner} runner request(s), ${nowServed.steps} step request(s), ${nowServed.decisions} start decision(s); the build before phase 41: ${oldServed.runner}, ${oldServed.steps}, ${oldServed.decisions})`);

// Note 2 — a timone.yaml that still has a `driver` line does not load, and says to delete the line.
// Both values the line used to take are tried.
const ENTRY = `projects:\n  fixture:\n    repo_url: https://example.invalid/fixture.git\n    path: projects/fixture\n    stack:\n      - typescript\n    bindings:\n      ticketing: github\n`;
function assertRefused(cliPath) {
  for (const value of ['runner', 'daemon']) {
    const r = loads(cliPath, `${ENTRY}    driver: ${value}\n`);
    assert(r.code !== 0, `a timone.yaml with "driver: ${value}" loaded`);
    assert(/driver/.test(r.out) && /delete/i.test(r.out), `with "driver: ${value}", the message does not say to delete the driver line: "${r.out.trim()}"`);
  }
  const plain = loads(cliPath, ENTRY);
  assert(plain.code === 0, `the same entry without the line does not load either: "${plain.out.trim()}"`);
}
await clause('PRD-05.R19 note 2', 'a timone.yaml that still has a driver line does not load, and says to delete the line', {
  broken: async () => assertRefused(OLD),
  correct: async () => assertRefused(CLI),
});
console.log(`    (this build said: "${loads(CLI, `${ENTRY}    driver: daemon\n`).out.trim()}")`);
console.log('    (the criterion\'s first sentences — a driver per entry, two projects differing — describe the period the note says is over; they are not checked as written)');

finish('PRD-05.R19');
