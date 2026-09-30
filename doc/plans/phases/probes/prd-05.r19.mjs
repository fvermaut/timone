// Probe for PRD-05.R19 — Each project runs on the runner or on the current daemon, until every project has moved.
// Stage 7 artifact, authored 2026-09-28 (phase 40) from the register alone.
//
// Register criterion (verbatim): a project's entry in timone.yaml says which one drives its tickets.
// The daemon drives each project the way its entry says, and two projects can differ. scratch-app
// moves first, and ivtrends moves only after a supervised run on scratch-app has passed R9, R12,
// R13 and R15.
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { fixture, model, daemon, say, clause, assert, finish, REPO_ROOT } from './_rig.mjs';

// Two projects in one manifest, one on each driver, each with a marked ticket.
async function twoProjects(drivers) {
  const fx = fixture({ projects: { alpha: drivers.alpha ? { driver: drivers.alpha } : {}, beta: drivers.beta ? { driver: drivers.beta } : {} }, issues: { alpha: { 11: { title: 'Alpha ticket' } }, beta: { 21: { title: 'Beta ticket' } } } });
  const m = await model({ runner: () => say(), step: () => say('done') });
  await daemon(fx, m, { until: () => m.runner().length > 0 && m.steps().length > 0, timeoutMs: 20000, settleMs: 1500 });
  await m.stop();
  const of = (p, t) => ({
    runnerSessions: m.runner().filter((q) => q.brief.includes(`${p} #${t}:`)).length,
    fixedStep: m.steps().some((q) => q.brief.includes(`${p}#${t}`) && /Timone-Stage: triage/.test(q.brief)),
    record: fx.record(t, p).length > 0,
  });
  const r = { alpha: of('alpha', 11), beta: of('beta', 21) };
  fx.cleanup();
  return r;
}
const mixed = await twoProjects({ alpha: 'runner', beta: null });
const swapped = await twoProjects({ alpha: null, beta: 'runner' });
function assertEachAsItsEntry(r) {
  assert(r.alpha.runnerSessions > 0 && r.alpha.record, 'the runner project was not driven by the runner');
  assert(!r.alpha.fixedStep, 'the runner project got the fixed order\'s first step');
  assert(r.beta.fixedStep, 'the other project did not get the fixed order\'s first step');
  assert(r.beta.runnerSessions === 0 && !r.beta.record, 'the other project was driven by the runner');
}
await clause('PRD-05.R19 clause 1', 'the daemon drives each project the way its entry says, and two projects can differ', {
  broken: async () => assertEachAsItsEntry(swapped),
  correct: async () => assertEachAsItsEntry(mixed),
});

// The repository's own manifest at this commit: scratch-app has moved; ivtrends has not.
function assertOrder(text) {
  const y = YAML.parse(text);
  assert(y.projects['scratch-app']?.driver === 'runner', 'scratch-app is not on the runner');
  assert((y.projects.ivtrends?.driver ?? 'daemon') === 'daemon', 'ivtrends has moved to the runner');
}
const real = fs.readFileSync(path.join(REPO_ROOT, 'timone.yaml'), 'utf8');
await clause('PRD-05.R19 clause 2', 'scratch-app moves first, and ivtrends has not moved', {
  broken: async () => assertOrder(real.replace(/(\n  ivtrends:\n(?:    .*\n)+?)(    bindings:)/, '$1    driver: runner\n$2')),
  correct: async () => assertOrder(real),
});

finish('PRD-05.R19');
