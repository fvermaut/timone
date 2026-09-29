// Probe for PRD-05.R8 — Each ticket has a limit of $150.
// Stage 7 artifact, authored 2026-09-28 (phase 40) from the register alone. Costs are made by the
// fake model service: it reports token counts, and the session library turns them into dollars
// (observed rate for claude-opus-5-5: $4 per million input tokens, $20 per million output tokens).
//
// Register clauses (verbatim):
//   1. GIVEN a ticket whose sessions have cost $150 or more in total, the runner's own sessions included
//      WHEN anything asks to start a session for it
//      THEN no session starts
//      AND the ticket says what was spent and where the work stands, and that a named person can reply
//      "continue" to allow another $150
//   2. GIVEN that ticket WHEN a named person replies "continue", in any wording that means it
//      THEN another $150 is allowed, and the work carries on
//   3. GIVEN a project whose entry in timone.yaml sets a different limit
//      WHEN its tickets are counted THEN that limit is used instead of $150
//
// Instrument fix, 2026-09-29 (re-check after 40u): the one-turn check that reads a reply at the limit
// used to be started with the full tool set, so the fake model filed it as a "step" and this probe
// answered it there. It is now started with no tools, so the fake model files it as "other". The
// probe now answers the check, and counts it, whatever tools it carries. Clause 2 says nothing about
// the check's tools, so this changes what the probe can reach, not what it asserts.
import { fixture, model, daemon, act, say, bash, sleep, clause, blocked, assert, finish, OPERATOR, STRANGER } from './_rig.mjs';

const N = 12;
const whyOf = (q) => q.brief.split('## The ticket')[0];
const M = 1e6;
const isConsult = (c) => c.brief.includes('A ticket reached its spending limit, and the machine asked whether to go on.');

// Sorting costs `sortUsd`; afterwards the operator writes, and we watch what starts.
async function spend({ sortUsd, limit, reply = 'please go on', replyBy = OPERATOR, consult = 'NO' }) {
  const fx = fixture({ issues: { fixture: { [N]: {} } }, projects: { fixture: { driver: 'runner', ...(limit !== undefined ? { limit } : {}) } } });
  const m = await model({
    runner: (c) => {
      if (c.turn > 0) return say();
      if (whyOf(c).includes('picked up')) return act('start_step', { stage: 'triage', instructions: 'sort it', reason: 'probe' });
      if (whyOf(c).includes('commented on the ticket')) return act('start_step', { stage: 'clarification', instructions: 'ask', reason: 'probe: go on' });
      return say();
    },
    step: (c) => (isConsult(c) ? say(consult) : c.brief.includes('Timone-Stage: triage') ? { ...say('sorted'), usage: { input_tokens: Math.round((sortUsd / 4) * M) } } : say('asked')),
    other: (c) => (isConsult(c) ? say(consult) : say()),
  });
  await daemon(fx, m, { until: () => fx.record(N).some((e) => e.kind === 'step-ended') && fx.record(N).at(-1).kind !== 'step-ended', timeoutMs: 30000, settleMs: 1500 });
  const before = { runner: m.runner().length, steps: m.steps().filter((s) => !isConsult(s)).length };
  const replyAt = fx.comment(N, replyBy, reply);
  await daemon(fx, m, { until: () => false, timeoutMs: 9000 });
  await m.stop();
  const r = {
    fx, replyAt,
    newRunner: m.runner().length - before.runner,
    newSteps: m.steps().filter((s) => !isConsult(s)).length - before.steps,
    consults: m.requests.filter(isConsult).map((c) => c.brief.match(/replied: ([\s\S]*?)\. Does/)?.[1]),
    notice: fx.issue(N).comments.find((c) => /spending limit/.test(c.body))?.body ?? '',
    raised: fx.record(N).filter((e) => e.kind === 'limit-raised'),
    reached: fx.record(N).filter((e) => e.kind === 'limit-reached'),
    lastLimitLine: m.runner().at(-1)?.brief.match(/Spent on this ticket: [^\n]*/)?.[0],
  };
  return r;
}

// Clause 1: over the limit, nothing starts, and the ticket says so.
const over = await spend({ sortUsd: 160 });
const under = await spend({ sortUsd: 10 });
function assertNothingStarts(r) {
  assert(r.reached.length === 1, `the limit was not reached: ${JSON.stringify(r.reached)}`);
  assert(r.newRunner === 0 && r.newSteps === 0, `sessions started after the limit: ${r.newRunner} runner, ${r.newSteps} step`);
}
await clause('PRD-05.R8 clause 1a', 'sessions cost $150 or more: when anything asks to start a session, no session starts', {
  broken: async () => assertNothingStarts(under),
  correct: async () => assertNothingStarts(over),
});
function assertSaysSpentAndContinue(r) {
  assert(/\$160\.\d\d/.test(r.notice) && /\$150\.00/.test(r.notice), `the ticket does not say what was spent against the limit: ${r.notice.slice(0, 300)}`);
  assert(/continue/.test(r.notice) && /another \$150/.test(r.notice), 'the ticket does not say a reply of "continue" allows another $150');
}
await clause('PRD-05.R8 clause 1b', 'the ticket says what was spent, and that a named person can reply "continue" to allow another $150', {
  broken: async () => assertSaysSpentAndContinue(under),
  correct: async () => assertSaysSpentAndContinue(over),
});
console.log(`    (the notice read: "${over.notice.split('---\n\n')[1]?.replace(/\n+/g, ' ')}")`);
function assertSaysWhereWorkStands(r, step) {
  assert(r.notice, 'no notice');
  assert(new RegExp(step, 'i').test(r.notice), `the notice does not say where the work stands (the last step, "${step}", is not named): ${r.notice.split('---\n\n')[1]?.replace(/\n+/g, ' ')}`);
}
await clause('PRD-05.R8 clause 1c', 'the ticket says where the work stands', {
  broken: async () => assertSaysWhereWorkStands(over, 'building'),
  correct: async () => assertSaysWhereWorkStands(over, 'sorting the request'),
});

// Clause 1, "the runner's own sessions included": steps cost $148; then one runner session is billed
// $4 and fails. The real total is $152. With the runner's cost counted, nothing may start after it.
async function runnerBilledThenFails({ fails, stepsUsd = 148 }) {
  const fx = fixture({ issues: { fixture: { [N]: {} } } });
  let billed = false;
  const m = await model({
    runner: (c) => {
      const w = whyOf(c);
      if (w.includes('picked up') && c.turn === 0) return act('start_step', { stage: 'triage', instructions: 'sort it', reason: 'probe' });
      if (w.includes('sorting the request ended') && !billed) {
        if (c.turn === 0) { billed = true; return { ...act('post', { where: 'ticket', body: 'Sorted.\n\n**What I need from you:** nothing.', reason: 'probe' }), usage: { output_tokens: 200000 } }; }
      }
      if (billed && c.turn === 1 && w.includes('sorting the request ended')) return fails ? { httpError: 400 } : say('done');
      if (c.turn === 0 && w.includes('"please go on"')) return act('start_step', { stage: 'clarification', instructions: 'ask', reason: 'probe' });
      return say();
    },
    step: (c) => (c.brief.includes('Timone-Stage: triage') ? { ...say('sorted'), usage: { input_tokens: Math.round((stepsUsd / 4) * M) } } : say('asked')),
  });
  await daemon(fx, m, { until: () => billed && fx.record(N).filter((e) => e.kind === 'runner-ended').length >= 2, timeoutMs: 30000, settleMs: 1500 });
  const runnerEnded = fx.record(N).filter((e) => e.kind === 'runner-ended')[1];
  const work = () => m.steps().filter((q) => !isConsult(q)).length;
  const beforeSteps = work(), beforeRunner = m.runner().length;
  fx.comment(N, OPERATOR, 'please go on');
  await daemon(fx, m, { until: () => false, timeoutMs: 9000 });
  await m.stop();
  // As in clause 1a, the one-turn check that reads the reply is not counted as a work session.
  const r = { runnerEnded, started: (work() - beforeSteps) + (m.runner().length - beforeRunner), reached: fx.record(N).some((e) => e.kind === 'limit-reached'), fx };
  return r;
}
const billedAndFailed = await runnerBilledThenFails({ fails: true });
const billedAndOk = await runnerBilledThenFails({ fails: false });
const belowLimit = await runnerBilledThenFails({ fails: true, stepsUsd: 100 });
console.log(`    (a runner session billed $4.00 that then failed was recorded as: ${JSON.stringify(billedAndFailed.runnerEnded)})`);
console.log(`    (the same session, not failing, was recorded as: ${JSON.stringify(billedAndOk.runnerEnded)}; then the limit was ${billedAndOk.reached ? '' : 'not '}reached and ${billedAndOk.started} work session(s) started)`);
function assertRunnerCounted(r) {
  assert(r.reached && r.started === 0, `the ticket's sessions cost $152 in all, the runner's own included, yet ${r.started} session(s) started and the limit was ${r.reached ? '' : 'not '}reached`);
}
await clause('PRD-05.R8 clause 1d', 'the runner\'s own sessions are included: a runner session that is billed, then fails, still counts', {
  broken: async () => assertRunnerCounted({ ...billedAndOk, reached: false, started: 1 }),
  correct: async () => assertRunnerCounted(billedAndFailed),
});

// Clause 2: a named person's reply that means "continue" allows another $150, and the work carries on.
const cont = await spend({ sortUsd: 160, reply: 'please keep going', consult: 'YES' });
const strangerCont = await spend({ sortUsd: 160, reply: 'please keep going', replyBy: STRANGER, consult: 'YES' });
const notCont = await spend({ sortUsd: 160, reply: 'what is the status?', consult: 'NO' });
function assertRaised(r) {
  assert(r.raised.length === 1 && r.raised[0].by === OPERATOR && r.raised[0].commentAt === r.replyAt, `no raise from the named person's reply: ${JSON.stringify(r.raised)}`);
  assert(/\$160\.\d\d of \$300\.00 allowed/.test(r.lastLimitLine ?? ''), `the allowance is not another $150: ${r.lastLimitLine}`);
  assert(r.newRunner > 0 && r.newSteps > 0, `the work did not carry on: ${r.newRunner} runner, ${r.newSteps} step sessions`);
}
await clause('PRD-05.R8 clause 2a', 'a named person replies "continue" (read as YES): another $150 is allowed, and the work carries on', {
  broken: async () => assertRaised(strangerCont),
  correct: async () => assertRaised(cont),
});
function assertNotRaised(r) {
  assert(r.raised.length === 0, `the allowance was raised: ${JSON.stringify(r.raised)}`);
  assert(r.newRunner === 0 && r.newSteps === 0, 'sessions started');
}
await clause('PRD-05.R8 clause 2b', 'a reply that does not mean "continue", or one by someone not named, allows nothing', {
  broken: async () => assertNotRaised(cont),
  correct: async () => { assertNotRaised(notCont); assertNotRaised(strangerCont); assert(strangerCont.consults.length === 0, 'the stranger\'s words were read'); },
});
console.log(`    (the reply is read by a one-turn check; it was asked about: ${JSON.stringify([...cont.consults, ...notCont.consults])})`);
blocked('PRD-05.R8 clause 2 (wording)', '"in any wording that means it"', 'the wording is judged by a one-turn model check; it needs a real model.');

// Clause 3: a project limit replaces $150.
const own = await spend({ sortUsd: 6, limit: 5 });
const dflt = await spend({ sortUsd: 6 });
function assertOwnLimit(r) {
  assert(r.reached.length === 1 && r.newRunner === 0 && r.newSteps === 0, `the $5 limit was not applied (reached: ${r.reached.length}, started: ${r.newRunner + r.newSteps})`);
  assert(/\$5\.00/.test(r.notice), `the notice does not name the $5 limit: ${r.notice.slice(0, 200)}`);
}
await clause('PRD-05.R8 clause 3', 'a project limit in timone.yaml is used instead of $150', {
  broken: async () => assertOwnLimit(dflt),
  correct: async () => assertOwnLimit(own),
});

for (const r of [over, under, billedAndFailed, billedAndOk, belowLimit, cont, strangerCont, notCont, own, dflt]) r.fx.cleanup();
finish('PRD-05.R8');
