// Probe for PRD-05.R6 — A departure is posted on the ticket when it happens.
// Stage 7 artifact, authored 2026-09-28 (phase 40) from the register alone. Order is read from
// two clocks on the same machine: the fake forge's log (when the comment was posted) and the
// run record (when the step started).
//
// Register clauses (verbatim):
//   1. GIVEN the runner decides to skip a step WHEN it starts the step after it
//      THEN a comment on the ticket, posted before that step starts, names the skipped step and gives the reason
//      AND the run does not wait for a reply
//   2. GIVEN a named person replies to that comment asking for the skipped step
//      WHEN the runner wakes THEN it stops what it started, if that is still running, and runs the skipped step
import { fixture, model, daemon, act, say, sleep, clause, blocked, assert, finish, OPERATOR, STRANGER } from './_rig.mjs';

const N = 12;
const whyOf = (q) => q.brief.split('## The ticket')[0];
const REASON = 'PROBE-R6: the ticket says exactly what to build';

// The runner starts `stage` with or without a skip; returns when that step starts, and what the ticket got before it.
async function skipTo({ skip }) {
  const fx = fixture({ issues: { fixture: { [N]: {} } } });
  const m = await model({
    runner: (c) => (c.wake === 0 && c.turn === 0 ? act('start_step', skip ? { stage: 'requirements', instructions: 'write it', reason: 'probe', skipReason: REASON } : { stage: 'triage', instructions: 'sort it', reason: 'probe' }) : say()),
    step: () => say('done'),
  });
  await daemon(fx, m, { until: () => fx.record(N).some((e) => e.kind === 'step-started'), timeoutMs: 30000, settleMs: 500 });
  await m.stop();
  const started = fx.record(N).find((e) => e.kind === 'step-started');
  const posts = fx.gh().filter((g) => g.argv[0] === 'issue' && g.argv[1] === 'comment');
  const bodies = fx.issue(N).comments.filter((c) => c.author !== OPERATOR).map((c) => ({ at: c.createdAt, body: c.body }));
  fx.cleanup();
  return { started, posts, bodies, repliesBefore: 0 };
}
const skipped = await skipTo({ skip: true });
const inOrder = await skipTo({ skip: false });
function assertPostedBefore(r) {
  const notice = r.bodies.find((b) => /skipping/i.test(b.body));
  assert(notice, 'no comment on the ticket about the skip');
  assert(/sorting the request/.test(notice.body) && /asking what you need/.test(notice.body), `the comment does not name the skipped steps: ${notice.body.slice(0, 300)}`);
  assert(notice.body.includes(REASON), 'the comment does not give the reason');
  assert(r.started && Date.parse(notice.at) < Date.parse(r.started.at), `the comment (${notice.at}) was not posted before the step started (${r.started?.at})`);
  assert(r.started.stage === 'requirements', 'the step after the skip did not start without a reply');
}
await clause('PRD-05.R6 clause 1', 'a skip: a comment naming the skipped steps and the reason is posted before the next step starts, and the run does not wait for a reply', {
  broken: async () => assertPostedBefore(inOrder),
  correct: async () => assertPostedBefore(skipped),
});
console.log(`    (the comment read: "${skipped.bodies.find((b) => /skipping/i.test(b.body))?.body.split('---\n\n')[1]?.replace(/\n+/g, ' ').slice(0, 400)}")`);

// Clause 1 again, when the skip comes after going back: building runs again after the check, then
// delivery starts — leaving out the check of that last build.
async function backThenDeliver({ recheck }) {
  const fx = fixture({ issues: { fixture: { [N]: { labels: ['timone', 'triage:chore'] } } } });
  const steps = [['triage'], ['planning'], ['execution'], ['verification'], ['execution'], ...(recheck ? [['verification']] : []), ['delivery']];
  let i = 0;
  const m = await model({
    runner: (c) => {
      if (c.turn === 1 && /^Refused/.test(c.last)) return act('start_step', { stage: 'delivery', instructions: 'p', reason: 'p', skipReason: 'PROBE-R6-BACK: the second build changed one line' });
      return c.turn === 0 && i < steps.length && /picked up|ended: it succeeded/.test(whyOf(c)) ? act('start_step', { stage: steps[i++][0], instructions: 'p', reason: 'p' }) : say();
    },
    step: () => say('done'),
  });
  await daemon(fx, m, { until: () => fx.record(N).some((e) => e.kind === 'step-started' && e.stage === 'delivery'), timeoutMs: 45000, settleMs: 800 });
  await m.stop();
  const deliveryAt = fx.record(N).find((e) => e.kind === 'step-started' && e.stage === 'delivery')?.at;
  const lastExec = fx.record(N).filter((e) => e.kind === 'step-ended' && e.stage === 'execution').at(-1)?.at;
  const notices = fx.issue(N).comments.filter((c) => c.author !== OPERATOR && Date.parse(c.createdAt) > Date.parse(lastExec ?? 0) && Date.parse(c.createdAt) < Date.parse(deliveryAt ?? 0));
  const checkedAfter = fx.record(N).some((e) => e.kind === 'step-ended' && e.stage === 'verification' && Date.parse(e.at) > Date.parse(lastExec ?? 0));
  fx.cleanup();
  return { notices, checkedAfter, deliveryAt };
}
const back = await backThenDeliver({ recheck: false });
const backRechecked = await backThenDeliver({ recheck: true });
function assertSkipOfCheckPosted(r) {
  assert(r.deliveryAt, 'delivery never started');
  if (r.checkedAfter) throw new Error('the last build was checked, so nothing was left out');
  assert(r.notices.some((c) => /checking the result/i.test(c.body) && c.body.includes('PROBE-R6-BACK')), 'delivery started straight after building, leaving out the check, and no comment on the ticket named the check with the reason');
}
await clause('PRD-05.R6 clause 1 (after going back)', 'building ran again after the check, then delivery started: a comment names the check that was left out', {
  broken: async () => assertSkipOfCheckPosted(backRechecked),
  correct: async () => assertSkipOfCheckPosted(back),
});

// Clause 2, code's part: a named person's reply wakes the runner while the started step still runs;
// stopping it stops it, and the skipped step can then run. A stranger's reply wakes nothing.
async function replyAskingForSkipped(author) {
  const fx = fixture({ issues: { fixture: { [N]: {} } } });
  let asked = false;
  const m = await model({
    runner: (c) => {
      const w = whyOf(c);
      if (c.wake === 0 && c.turn === 0) return act('start_step', { stage: 'requirements', instructions: 'write it', reason: 'probe', skipReason: REASON });
      if (w.includes('please do the questions first') && c.turn === 0) { asked = true; return act('stop_step', { reason: 'probe: they asked for the skipped step' }); }
      if (asked && /stopped|ended/.test(w) && c.turn === 0) return act('start_step', { stage: 'clarification', instructions: 'ask the questions', reason: 'probe: they asked for it' });
      return say();
    },
    step: (c) => (c.brief.includes('Timone-Stage: requirements') ? { hang: true } : say('asked')),
  });
  // One daemon throughout: the reply lands while the started step is still running.
  const d = daemon(fx, m, { until: () => fx.record(N).some((e) => e.kind === 'step-started' && e.stage === 'clarification'), timeoutMs: 40000, settleMs: 1500 });
  while (!fx.record(N).some((e) => e.kind === 'step-started')) await sleep(200);
  await sleep(1500);
  fx.comment(N, author, 'please do the questions first');
  await d;
  await m.stop();
  const rec = fx.record(N);
  const r = {
    woke: m.runner().some((q) => whyOf(q).includes('please do the questions first')),
    requirementsEnded: rec.find((e) => e.kind === 'step-ended' && e.stage === 'requirements'),
    clarification: rec.some((e) => e.kind === 'step-started' && e.stage === 'clarification'),
    sessionClosed: m.steps().find((s) => s.brief.includes('Timone-Stage: requirements'))?.closedAt,
  };
  fx.cleanup();
  return r;
}
const operatorAsks = await replyAskingForSkipped(OPERATOR);
const strangerAsks = await replyAskingForSkipped(STRANGER);
function assertStoppedAndRan(r) {
  assert(r.woke, 'the reply did not wake the runner');
  assert(r.requirementsEnded, 'the running step was not stopped');
  assert(r.sessionClosed, 'the stopped step\'s session was not ended');
  assert(r.clarification, 'the skipped step did not run');
}
await clause('PRD-05.R6 clause 2 (code)', 'a named person asks for the skipped step: the runner wakes, what it started is stopped, and the skipped step runs', {
  broken: async () => assertStoppedAndRan(strangerAsks),
  correct: async () => assertStoppedAndRan(operatorAsks),
});
console.log(`    (the stopped step was recorded as: ${JSON.stringify(operatorAsks.requirementsEnded)})`);
blocked('PRD-05.R6 clause 2 (runner)', 'the real runner chooses to stop what it started and run the skipped step',
  'needs a real model. No replay case covers it, and the watched run did not reach it.');

finish('PRD-05.R6');
