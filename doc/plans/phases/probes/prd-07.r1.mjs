// Probe for PRD-07.R1 — A ticket frees its project when its pull request opens.
// Stage 7 artifact, authored 2026-10-04 (phase 47) from the register alone. Runs the built
// daemon through _places.mjs and _rig.mjs. Needs `npm run build` first.
//
// Register clauses (verbatim):
//   1. GIVEN a ticket whose pull request is open and not merged, and no step of it running
//      WHEN another ticket of the same project asks to start a step
//      THEN the step is not refused because of the first ticket
//   2. GIVEN a ticket parked on its own work branch, waiting for a named person to answer
//      WHEN another ticket of the same project asks to start a step
//      THEN the step is not refused because of the first ticket
//   3. GIVEN a ticket whose pull request is open
//      WHEN its pull request merges, closes, or gets a review comment from a named person
//      THEN that ticket's run wakes as it does today
//
// Break legs. Clauses 1 and 2: the same fixture on the build from just before phase 47
// (_places.mjs's BEFORE_PHASE_47), where a run held its project from its work branch until its
// pull request ended — the rule this requirement replaces. Clause 3: the same fixture where the
// thing does not happen (the pull request left as it is; for the review, a comment by someone
// not named for the project), so a wake the probe counts must be one the event caused.
import { secondAsks, assertNotRefused, said, before47, A, B, runsLine, OPERATOR, STRANGER } from './_places.mjs';
import { daemon, model, say, sleep, clause, assert, finish } from './_rig.mjs';

const REAL_ONLY = process.env.PROBE_REAL_ONLY === '1';
const OLD = REAL_ONLY ? null : before47();

const [prOpen, asks] = await Promise.all([secondAsks({ state: 'pr-open' }), secondAsks({ state: 'asks-person' })]);
const [prOpenOld, asksOld] = REAL_ONLY ? [null, null] : await Promise.all([
  secondAsks({ state: 'pr-open', cli: OLD, timeoutMs: 40000 }),
  secondAsks({ state: 'asks-person', cli: OLD, timeoutMs: 40000 }),
]);

await clause('PRD-07.R1 clause 1', 'a ticket whose pull request is open and not merged, and no step of it running: another ticket of the same project asks to start a step, and the step is not refused because of the first ticket', {
  broken: async () => { assertGiven1(prOpenOld); assertNotRefused(prOpenOld, assert); },
  correct: async () => { assertGiven1(prOpen); assertNotRefused(prOpen, assert); },
});
console.log(`    (${said(prOpen)})`);
if (prOpenOld) console.log(`    (break leg, the build before phase 47: ${said(prOpenOld)})`);
function assertGiven1(r) {
  const a = r.atAsk?.aRun;
  assert(a && a.status !== 'active', `setup: the first ticket has a step running (${r.atAsk?.runs})`);
  assert(r.pr && r.fx.forge().prs[r.pr]?.state === 'OPEN', 'setup: the first ticket has no open pull request');
}

await clause('PRD-07.R1 clause 2', 'a ticket parked on its own work branch, waiting for a named person to answer: another ticket of the same project asks to start a step, and the step is not refused because of the first ticket', {
  broken: async () => { assertGiven2(asksOld); assertNotRefused(asksOld, assert); },
  correct: async () => { assertGiven2(asks); assertNotRefused(asks, assert); },
});
console.log(`    (${said(asks)}; the first ticket's wait: "${asks.atAsk?.aRun?.wait?.on ?? 'none'}")`);
if (asksOld) console.log(`    (break leg, the build before phase 47: ${said(asksOld)})`);
function assertGiven2(r) {
  const a = r.atAsk?.aRun;
  assert(a && a.status === 'parked', `setup: the first ticket's run is not parked (${r.atAsk?.runs})`);
  assert(a.branch && r.fx.remoteHead(a.branch), `setup: the first ticket holds no work branch on the remote (${r.atAsk?.runs})`);
  assert(r.fx.issue(A).comments.some((c) => c.body.includes('Which colour')), 'setup: no question for a named person on the first ticket');
}

// Clause 3. Each case starts from clause 1's state: the first ticket's pull request open, the
// second ticket's step started. Then the event happens (or, on the break leg, does not), and
// the daemon runs until the first ticket's runner is woken or 20 s pass.
async function afterEvent(event) {
  const r = await secondAsks({ state: 'pr-open' });
  const { fx } = r;
  const m = await model({ runner: () => say() });
  if (event === 'merge') fx.editForge((f) => { f.prs[r.pr].state = 'MERGED'; f.prs[r.pr].mergedAt = new Date().toISOString(); });
  if (event === 'close') fx.editForge((f) => { f.prs[r.pr].state = 'CLOSED'; f.prs[r.pr].closedAt = new Date().toISOString(); });
  if (event === 'review') fx.comment(r.pr, OPERATOR, 'Please call it the open count.', { pr: true });
  if (event === 'stranger') fx.comment(r.pr, STRANGER, 'Please call it the open count.', { pr: true });
  await daemon(fx, m, { until: () => m.runner().some((q) => q.brief.includes(`fixture #${A}`)), timeoutMs: 20000, settleMs: 1000 });
  await m.stop();
  const wake = m.runner().find((q) => q.brief.includes(`fixture #${A}`));
  const events = fx.record(A).filter((e) => e.kind === 'woke').at(-1)?.events ?? [];
  return { event, pr: r.pr, woke: Boolean(wake), events, secondStarted: r.bStarted, fx, runs: runsLine(fx) };
}
const cases = await Promise.all(['merge', 'close', 'review', ...(REAL_ONLY ? [] : ['nothing', 'stranger'])].map(afterEvent));
const byEvent = Object.fromEntries(cases.map((c) => [c.event, c]));
const words = { merge: /merged/i, close: /closed/i, review: /Please call it the open count/ };
function assertWoke(c, kind) {
  assert(c.secondStarted, 'setup: the second ticket\'s step did not start while the pull request was open');
  assert(c.woke, `the first ticket's run did not wake after the event (${c.runs})`);
  assert(c.events.some((e) => words[kind].test(e) && e.includes(`#${c.pr}`) || (kind === 'review' && words.review.test(e))), `it woke, but not on the event: ${JSON.stringify(c.events)}`);
}
await clause('PRD-07.R1 clause 3 (merge)', 'a ticket whose pull request is open: its pull request merges, and that ticket\'s run wakes as it does today', {
  broken: async () => assertWoke(byEvent.nothing, 'merge'),
  correct: async () => assertWoke(byEvent.merge, 'merge'),
});
console.log(`    (woken with: ${JSON.stringify(byEvent.merge.events)})`);
await clause('PRD-07.R1 clause 3 (close)', 'its pull request closes, and that ticket\'s run wakes as it does today', {
  broken: async () => assertWoke(byEvent.nothing, 'close'),
  correct: async () => assertWoke(byEvent.close, 'close'),
});
console.log(`    (woken with: ${JSON.stringify(byEvent.close.events)})`);
await clause('PRD-07.R1 clause 3 (review comment)', 'its pull request gets a review comment from a named person, and that ticket\'s run wakes as it does today', {
  broken: async () => assertWoke(byEvent.stranger, 'review'),
  correct: async () => assertWoke(byEvent.review, 'review'),
});
console.log(`    (woken with: ${JSON.stringify(byEvent.review.events)})`);
if (byEvent.nothing) console.log(`    (break legs: nothing happened — woke ${byEvent.nothing.woke}; a comment by someone not named — woke ${byEvent.stranger.woke})`);

for (const r of [prOpen, asks, prOpenOld, asksOld, ...cases]) r?.fx.cleanup();
finish('PRD-07.R1');
