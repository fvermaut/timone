// Probe for PRD-05.R4 — A run that changed the project's files ends at a pull request.
// Stage 7 artifact, authored 2026-09-28 (phase 40) from the register alone (clause 3 as amended
// on 2026-09-28, 40t). The runner's "end the run" answer is read from the tool result the runner
// session receives next; whether the run ended is read from the ledger.
//
// Register clauses (verbatim):
//   1. GIVEN a run whose branch has commits that are not on the default branch
//      WHEN the runner asks to end the run with no open pull request for that branch
//      THEN code refuses and tells the runner why
//   2. GIVEN the same run WHEN a named person cancels it with `timone cancel`
//      THEN the run ends, and no pull request is required
//   3. GIVEN the same run WHEN a named person asks on the ticket, in plain words, for the work to stop for good
//      THEN the runner may end the run citing that comment, and code ends it with no pull request,
//      once it has checked the comment exists and is theirs
//   4. GIVEN a run that changed no files, such as a question or a decision ticket
//      WHEN the runner ends it THEN it ends on the ticket, with no pull request
import { fixture, model, daemon, act, say, clause, assert, finish, OPERATOR, STRANGER } from './_rig.mjs';

const N = 12;
const whyOf = (q) => q.brief.split('## The ticket')[0];
const ENDED = new Set(['done', 'cancelled', 'failed']);

// A run whose first step made a branch. With `commit`, the branch then gets a commit that is not on main.
async function runWithBranch({ commit }) {
  const fx = fixture({ issues: { fixture: { [N]: {} } } });
  const plan = { wake: [] };
  const m = await model({
    runner: (c) => {
      if (c.wake === 0 && c.turn === 0) return act('start_step', { stage: 'execution', instructions: 'build it', reason: 'probe', skipReason: 'probe' });
      const a = plan.wake[c.wake]?.[c.turn];
      return a ? a() : say();
    },
    step: () => say('built'),
  });
  await daemon(fx, m, { until: () => fx.record(N).some((e) => e.kind === 'step-ended') && fx.record(N).at(-1).kind !== 'step-ended', timeoutMs: 30000, settleMs: 1500 });
  if (commit) fx.pushBranch(fx.run(N).branch, { 'src/count.ts': 'export const count = 1;\n' }, 'the build');
  return { fx, m, plan };
}
function endResult(m, wake) {
  const q = m.runner().find((r) => r.wake === wake && r.turn === 1);
  return q?.last ?? '';
}

// Clause 1.
async function askToEnd({ commit }) {
  const r = await runWithBranch({ commit });
  const wake = r.m.runner().at(-1).wake + 1;
  r.plan.wake[wake] = [() => act('end_run', { reason: 'probe: the work is done', closeTicket: false })];
  r.fx.comment(N, OPERATOR, 'is it finished?');
  await daemon(r.fx, r.m, { until: () => r.m.runner().some((q) => q.wake === wake && q.turn === 1), timeoutMs: 30000, settleMs: 1000 });
  await r.m.stop();
  const out = { said: endResult(r.m, wake), run: r.fx.run(N), prs: Object.keys(r.fx.forge().prs).length, fx: r.fx };
  return out;
}
const unmerged = await askToEnd({ commit: true });
const clean = await askToEnd({ commit: false });
function assertRefused(o) {
  assert(/^Refused:/.test(o.said), `the runner was not refused: "${o.said.slice(0, 200)}"`);
  assert(/no pull request|pull request/i.test(o.said) && /changed files|commits/i.test(o.said), `the refusal does not say why: "${o.said}"`);
  assert(!ENDED.has(o.run.status), `the run ended anyway: ${o.run.status}`);
}
await clause('PRD-05.R4 clause 1', 'a branch with commits not on the default branch and no open pull request: code refuses to end the run and says why', {
  broken: async () => assertRefused(clean),
  correct: async () => assertRefused(unmerged),
});
console.log(`    (the refusal read: "${unmerged.said}")`);

// Clause 2: timone cancel ends the same run, with no pull request.
async function cancelOf(doCancel) {
  const r = await runWithBranch({ commit: true });
  let c = { code: null, out: '' };
  if (doCancel) c = r.fx.cli(['cancel', `fixture#${N}`, '--manifest', r.fx.manifest, '--state', r.fx.statePath, '--reason', 'probe: stop it']);
  await r.m.stop();
  return { run: r.fx.state().runs.find((x) => x.ticket === N && x.seq === 1), prs: Object.keys(r.fx.forge().prs).length, c, fx: r.fx };
}
const cancelled = await cancelOf(true);
const notCancelled = await cancelOf(false);
function assertCancelled(o) {
  assert(o.run.status === 'cancelled', `the run is ${o.run.status}`);
  assert(o.prs === 0, 'a pull request was opened');
}
await clause('PRD-05.R4 clause 2', 'timone cancel ends the same run, and no pull request is required', {
  broken: async () => assertCancelled(notCancelled),
  correct: async () => assertCancelled(cancelled),
});

// Clause 3: a named person's plain-words stop, cited by the runner, ends the run with no pull request;
// code checks the comment exists and is theirs.
async function stopCitedBy(author, { cite } = {}) {
  const r = await runWithBranch({ commit: true });
  const wake = r.m.runner().at(-1).wake + 1;
  const at = r.fx.comment(N, author, 'I finished this by hand. Please stop the work for good.');
  r.plan.wake[wake] = [() => act('end_run', { reason: 'probe: they asked to stop for good', closeTicket: false, stopCommentAt: cite ?? at })];
  await daemon(r.fx, r.m, { until: () => r.m.runner().some((q) => q.wake === wake && q.turn === 1) || r.m.runner().length > wake + 1, timeoutMs: 30000, settleMs: 1000 });
  await r.m.stop();
  return { said: endResult(r.m, wake), run: r.fx.state().runs.find((x) => x.ticket === N && x.seq === 1), prs: Object.keys(r.fx.forge().prs).length, woke: r.m.runner().some((q) => q.wake === wake), fx: r.fx };
}
const byOperator = await stopCitedBy(OPERATOR);
const byStrangerCited = await (async () => {
  // A stranger's comment does not wake the runner (R10), so it is cited from a wake a named person caused.
  const r = await runWithBranch({ commit: true });
  const wake = r.m.runner().at(-1).wake + 1;
  const sAt = r.fx.comment(N, STRANGER, 'I finished this by hand. Please stop the work for good.');
  r.fx.comment(N, OPERATOR, 'where does this stand?');
  r.plan.wake[wake] = [() => act('end_run', { reason: 'probe', closeTicket: false, stopCommentAt: sAt })];
  await daemon(r.fx, r.m, { until: () => r.m.runner().some((q) => q.wake === wake && q.turn === 1), timeoutMs: 30000, settleMs: 1000 });
  await r.m.stop();
  return { said: endResult(r.m, wake), run: r.fx.state().runs.find((x) => x.ticket === N && x.seq === 1), prs: 0, fx: r.fx };
})();
const byNobody = await stopCitedBy(OPERATOR, { cite: '2026-01-01T00:00:00Z' });
function assertStoppedWithoutPr(o) {
  assert(ENDED.has(o.run.status), `the run did not end (${o.run.status}); the runner was told: "${o.said.slice(0, 200)}"`);
  assert(o.prs === 0, 'a pull request was opened');
}
await clause('PRD-05.R4 clause 3a', 'a named person asked in plain words to stop for good: the run ends citing that comment, with no pull request', {
  broken: async () => assertStoppedWithoutPr(byStrangerCited),
  correct: async () => assertStoppedWithoutPr(byOperator),
});
function assertChecked(o) {
  assert(/^Refused:/.test(o.said), `code did not refuse: "${o.said.slice(0, 200)}"`);
  assert(!ENDED.has(o.run.status), `the run ended: ${o.run.status}`);
}
await clause('PRD-05.R4 clause 3b', 'code checks the comment exists and is theirs (a stranger\'s, or one that does not exist, is refused)', {
  broken: async () => assertChecked(byOperator),
  correct: async () => { assertChecked(byStrangerCited); assertChecked(byNobody); },
});
console.log(`    (a stranger's comment: "${byStrangerCited.said}")`);
console.log(`    (no such comment: "${byNobody.said}")`);

// Clause 4: a run that changed no files ends on the ticket, with no pull request.
async function endWithoutWork({ step }) {
  const fx = fixture({ issues: { fixture: { [N]: { labels: ['timone'] } } } });
  const m = await model({
    runner: (c) => {
      if (c.wake === 0 && c.turn === 0) return step ? act('start_step', { stage: 'execution', instructions: 'x', reason: 'p', skipReason: 'p' }) : act('end_run', { reason: 'probe: a question, answered; nothing to change', closeTicket: true });
      if (step && c.wake === 1 && c.turn === 0) return act('end_run', { reason: 'probe', closeTicket: true });
      return say();
    },
    step: () => say('built'),
  });
  await daemon(fx, m, { until: () => m.runner().some((q) => q.turn === 1 && (step ? q.wake === 1 : q.wake === 0)), timeoutMs: 30000, settleMs: 1500 });
  if (step) {
    // the step's work is on the branch before the run is asked to end
  }
  await m.stop();
  return { run: fx.state().runs.find((x) => x.ticket === N && x.seq === 1), prs: Object.keys(fx.forge().prs).length, ticket: fx.issue(N), fx };
}
const question = await endWithoutWork({ step: false });
function assertEndedOnTicket(o) {
  assert(o.run.status === 'done', `the run is ${o.run.status}`);
  assert(o.prs === 0, 'a pull request was opened');
  assert(o.ticket.state === 'CLOSED', `the ticket is ${o.ticket.state}`);
}
await clause('PRD-05.R4 clause 4', 'a run that changed no files ends on the ticket, with no pull request', {
  broken: async () => assertEndedOnTicket({ ...unmerged, ticket: unmerged.fx.issue(N) }),
  correct: async () => assertEndedOnTicket(question),
});

for (const o of [unmerged, clean, cancelled, notCancelled, byOperator, byStrangerCited, byNobody, question]) o.fx.cleanup();
finish('PRD-05.R4');
