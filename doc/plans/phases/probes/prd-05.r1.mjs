// Probe for PRD-05.R1 — The runner chooses each step, with the written order as its default.
// Stage 7 artifact, authored 2026-09-28 (phase 40) from the register alone; runs the built
// daemon through _rig.mjs. The fake model stands in for the runner's judgement, so what this
// probe can decide is what CODE does: what the runner is shown, and that the step started is
// the one the runner chose. The real runner's own choice needs a real model (R18's replay).
//
// Register clauses (verbatim):
//   1. GIVEN a feature request that was just sorted, and nothing unusual about it
//      WHEN the runner wakes THEN it starts the interview, which is the next step of the default order
//   2. GIVEN a request whose requirements are already approved on the default branch (#104)
//      WHEN the runner wakes after sorting THEN it skips the interview and starts planning
//      AND the skip is a departure, handled as R5 and R6 say
//   3. GIVEN any run WHEN code decides which session to start
//      THEN the choice comes from the runner's decision, and no table in code picks the next step
import { fixture, model, daemon, act, say, clause, blocked, assert, finish } from './_rig.mjs';

const N = 12;
const whyOf = (q) => q.brief.split('## The ticket')[0];
const orderOf = (q) => q.brief.split('## The default order')[1]?.split('## Facts')[0] ?? '';

// A run where sorting ran; returns the brief the runner got when sorting ended.
async function afterSorting({ sort = true, files } = {}) {
  const fx = fixture({ issues: { fixture: { [N]: {} } }, projects: { fixture: { driver: 'runner', files } } });
  const m = await model({
    runner: (c) => (c.turn === 0 && whyOf(c).includes('picked up') && sort ? act('start_step', { stage: 'triage', instructions: 'sort it', reason: 'probe' }) : say()),
    step: () => say('sorted: a feature'),
  });
  await daemon(fx, m, { until: () => (sort ? m.runner().some((q) => whyOf(q).includes('sorting the request ended')) : m.runner().length > 0), timeoutMs: 30000 });
  await m.stop();
  fx.cleanup();
  return sort ? m.runner().find((q) => whyOf(q).includes('sorting the request ended')) : m.runner()[0];
}

// Clause 1, code's part: after sorting, the runner is shown the feature's default order with
// sorting done and the interview ("asking what you need") as the next step not yet run.
function assertInterviewNext(q) {
  assert(q, 'the runner was never woken after sorting');
  const o = orderOf(q);
  assert(/Kind of ticket: feature/.test(o), `the brief does not name the feature order:\n${o}`);
  assert(/1\. sorting the request — ran/.test(o), `sorting is not shown as done:\n${o}`);
  assert(/2\. asking what you need — not run yet/.test(o), `the interview is not shown as the next step not run:\n${o}`);
}
await clause('PRD-05.R1 clause 1 (code)', 'after sorting, the runner is shown the interview as the next step of the default order', {
  broken: async () => assertInterviewNext(await afterSorting({ sort: false })),
  correct: async () => assertInterviewNext(await afterSorting()),
});
blocked('PRD-05.R1 clause 1 (runner)', 'the real runner then starts the interview',
  'needs a real model. Seen live on scratch-app#62 (sorting, then four questions at 12:41:38 on 2026-09-28), on the build before 40s and 40t.');

// Clause 2, code's part: requirements already approved on the default branch are shown to the runner.
const APPROVED = { 'doc/specs/prd/prd-01-count.md': '# PRD-01: A count of open to-dos\n\n> **Status:** Active\n\nShow the count.\n', 'doc/specs/prd/prd-01-count.criteria.md': '# PRD-01 criteria\n\n## R1 — The count\n\n- **Priority:** MUST\n- **Status:** draft\n' };
function assertApprovedShown(q) {
  const facts = q.brief.split('## Facts about the work')[1]?.split('## The pull request')[0] ?? '';
  assert(/prd-01-count/.test(facts), `the requirements on the default branch are not shown to the runner:\n${facts}`);
}
await clause('PRD-05.R1 clause 2 (code)', 'requirements already on the default branch are shown to the runner when it wakes after sorting', {
  broken: async () => assertApprovedShown(await afterSorting()),
  correct: async () => assertApprovedShown(await afterSorting({ files: APPROVED })),
});
blocked('PRD-05.R1 clause 2 (runner)', 'the real runner skips the interview and starts planning, and the skip is a departure',
  'needs a real model. Replay case #104 passed 3 of 3 in runs 2, 4 and 5; run 6, on this build, is owed. The departure handling itself is checked by the R5 and R6 probes.');

// Clause 3: the step code starts is the one the runner chose — even one no fixed order would pick
// first — and when the runner chooses nothing, no step starts.
async function choose(stage) {
  const fx = fixture({ issues: { fixture: { [N]: {} } } });
  const m = await model({
    runner: (c) => (c.turn === 0 && c.wake === 0 && stage ? act('start_step', { stage, instructions: `probe: do ${stage}`, reason: 'probe', skipReason: 'probe: chosen out of order on purpose' }) : say()),
    step: () => say('done'),
  });
  await daemon(fx, m, { until: () => (stage ? fx.record(N).some((e) => e.kind === 'step-ended') : false), timeoutMs: stage ? 30000 : 10000 });
  await m.stop();
  const started = fx.record(N).filter((e) => e.kind === 'step-started').map((e) => e.stage);
  const trailers = m.steps().map((s) => (s.brief.match(/Timone-Stage: (\S+)/) || [])[1]);
  fx.cleanup();
  return { started, trailers };
}
function assertStarted(r, stage) {
  assert(r.started.length === 1 && r.started[0] === stage, `steps started: [${r.started}] — expected only ${stage}`);
  assert(r.trailers[0] === stage, `the step session was told it is "${r.trailers[0]}", not ${stage}`);
}
await clause('PRD-05.R1 clause 3a', 'the session code starts is the one the runner chose (checking, first, on a fresh ticket)', {
  broken: async () => assertStarted(await choose('planning'), 'verification'),
  correct: async () => assertStarted(await choose('verification'), 'verification'),
});
await clause('PRD-05.R1 clause 3b', 'no table in code picks the next step: when the runner chooses nothing, no session starts', {
  broken: async () => { const r = await choose('triage'); assert(r.started.length === 0, `steps started: [${r.started}]`); },
  correct: async () => { const r = await choose(null); assert(r.started.length === 0, `steps started: [${r.started}]`); },
});

finish('PRD-05.R1');
