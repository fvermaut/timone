// Probe for PRD-05.R14 — Each wake is a fresh runner session, working from a run record kept by code.
// Stage 7 artifact, authored 2026-09-28 (phase 40) from the register alone. A runner session is
// identified by the session id the model service sees; "kept alive" is read from the processes
// under the daemon while the run waits.
//
// Register clauses (verbatim):
//   1. GIVEN a run waiting on a person for days WHEN the person answers
//      THEN a new runner session starts, and no runner session was kept alive while the run waited
//   2. GIVEN any run WHEN its record is read
//      THEN it holds every step that ran, with its start, its end and its cost; every decision of the
//      runner and its reason; every departure; and the total cost so far
//   3. GIVEN a finished run WHEN the operator asks for its record from the command line
//      THEN the record is shown in plain words
import { execSync } from 'node:child_process';
import { fixture, model, daemon, act, say, sleep, clause, assert, finish, OPERATOR } from './_rig.mjs';

const N = 12;
const whyOf = (q) => q.brief.split('## The ticket')[0];

// A run: sorting (skipping nothing), then building with a skip and a reason, then a question to the
// person; the run waits; the person answers; the runner ends the run (nothing changed on the branch).
const fx = fixture({ issues: { fixture: { [N]: {} } } });
const m = await model({
  runner: (c) => {
    if (c.turn > 0) return say();
    const w = whyOf(c);
    if (w.includes('picked up')) return act('start_step', { stage: 'triage', instructions: 'sort it', reason: 'PROBE-R14-REASON-1: a new ticket starts with sorting' });
    if (w.includes('sorting the request ended')) return act('start_step', { stage: 'execution', instructions: 'build it', reason: 'PROBE-R14-REASON-2: small enough to build', skipReason: 'PROBE-R14-SKIP: the ticket says exactly what to build' });
    if (w.includes('building ended')) return act('post', { where: 'ticket', body: 'Is the count right above the list?\n\n**What I need from you:** say yes or no.', reason: 'PROBE-R14-REASON-3: a question for the person' });
    if (w.includes('"yes, it is right"')) return act('end_run', { reason: 'PROBE-R14-REASON-4: the person confirmed; nothing to change', closeTicket: true });
    return say();
  },
  step: (c) => ({ ...say('done'), usage: { input_tokens: c.brief.includes('Timone-Stage: execution') ? 2500000 : 250000 } }),
});
const runDaemon = (until, ms = 30000) => daemon(fx, m, { until, timeoutMs: ms, settleMs: 1500 });

let aliveWhileWaiting = null;
{
  // Run until the question is posted, then look under the daemon while the run waits.
  const d = daemon(fx, m, { until: () => false, timeoutMs: 30000 });
  while (!fx.record(N).some((e) => e.kind === 'decision' && e.action === 'post')) await sleep(200);
  await sleep(4000);
  let pid;
  try { pid = execSync(`pgrep -f "${fx.statePath}"`).toString().trim().split('\n')[0]; } catch {}
  const kids = (p) => { try { return execSync(`pgrep -P ${p}`).toString().trim().split('\n').filter(Boolean); } catch { return []; } };
  const all = []; const walk = (p) => { for (const k of kids(p)) { all.push(execSync(`ps -o command= -p ${k}`).toString().trim()); walk(k); } };
  if (pid) walk(pid);
  aliveWhileWaiting = all.filter((c) => /claude/i.test(c));
  // stop this daemon
  await sleep(100);
  const { default: _ } = { default: 0 };
  process.kill(Number(pid), 'SIGTERM');
  await d;
}
const sessionsBefore = new Set(m.runner().map((q) => q.sid));
fx.comment(N, OPERATOR, 'yes, it is right');
await runDaemon(() => m.runner().some((q) => whyOf(q).includes('"yes, it is right"') && q.turn === 1));
await m.stop();
const answered = m.runner().find((q) => whyOf(q).includes('"yes, it is right"'));

// Clause 1.
function assertFreshAndNotKept(sids, alive, a) {
  assert(a, 'the person\'s answer did not wake the runner');
  assert(!sids.has(a.sid), `the answer was handled by an earlier runner session (${a.sid})`);
  assert(alive.length === 0, `runner sessions kept alive while the run waited: ${alive.join(' | ')}`);
}
await clause('PRD-05.R14 clause 1', 'the person answers: a new runner session starts, and no runner session was kept alive while the run waited', {
  broken: async () => assertFreshAndNotKept(new Set([...sessionsBefore, answered?.sid]), aliveWhileWaiting, answered),
  correct: async () => assertFreshAndNotKept(sessionsBefore, aliveWhileWaiting, answered),
});
console.log(`    (${new Set(m.runner().map((q) => q.sid)).size} runner sessions for ${fx.record(N).filter((e) => e.kind === 'woke').length} wakes; claude processes under the daemon while waiting: ${aliveWhileWaiting.length})`);

// Clause 2.
const rec = fx.record(N);
function assertHolds(record, { stages, reasons, skip }) {
  for (const st of stages) {
    const s = record.find((e) => e.kind === 'step-started' && e.stage === st);
    const e = record.find((x) => x.kind === 'step-ended' && x.stage === st && x.sessionId === s?.sessionId);
    assert(s && e, `step ${st} is not in the record with its start and end`);
    assert(typeof e.costUsd === 'number' && e.costUsd > 0, `step ${st} has no cost`);
  }
  for (const r of reasons) assert(record.some((e) => e.kind === 'decision' && e.reason === r), `the decision "${r}" is not recorded with its reason`);
  assert(record.some((e) => e.kind === 'departure' && e.reason === skip && e.skipped.includes('planning')), 'the departure is not recorded with its reason');
  const runnerCosts = record.filter((e) => e.kind === 'runner-ended').map((e) => e.costUsd);
  assert(runnerCosts.length >= 4 && runnerCosts.every((c) => typeof c === 'number'), 'the runner sessions\' costs are not recorded');
}
const expected = { stages: ['triage', 'execution'], reasons: ['PROBE-R14-REASON-1: a new ticket starts with sorting', 'PROBE-R14-REASON-2: small enough to build', 'PROBE-R14-REASON-3: a question for the person', 'PROBE-R14-REASON-4: the person confirmed; nothing to change'], skip: 'PROBE-R14-SKIP: the ticket says exactly what to build' };
await clause('PRD-05.R14 clause 2', 'the record holds every step with its start, end and cost; every decision with its reason; every departure; and what was spent', {
  broken: async () => assertHolds(rec, { ...expected, stages: [...expected.stages, 'verification'] }),
  correct: async () => assertHolds(rec, expected),
});

// Clause 3.
const shown = fx.cli(['record', `fixture#${N}`, '--manifest', fx.manifest]);
const other = fx.cli(['record', 'fixture#99', '--manifest', fx.manifest]);
function assertPlainWords(r) {
  const t = r.out + r.err;
  assert(r.code === 0, `exit ${r.code}: ${t.trim()}`);
  assert(/Sorting the request: started .*ended .*cost \$\d+\.\d\d/i.test(t) && /Building: started .*ended .*cost \$\d+\.\d\d/i.test(t), `the steps are not shown with their times and costs:\n${t}`);
  for (const r2 of expected.reasons) assert(t.includes(r2.split(': ')[1]), `a decision's reason is missing: ${r2}`);
  assert(t.includes('the ticket says exactly what to build'), 'the departure is missing');
  assert(/spent \$\d+\.\d\d of the \$150\.00/.test(t), 'the total spent against the limit is missing');
  assert(!/"kind"|step-started|runner-ended|\bexecution\b|\btriage\b/.test(t), 'the record shows internal words, not plain ones');
}
await clause('PRD-05.R14 clause 3', 'timone record shows a finished run\'s record in plain words', {
  broken: async () => assertPlainWords(other),
  correct: async () => assertPlainWords(shown),
});
console.log(`    (timone record printed:\n${shown.out.trim().split('\n').map((l) => `      | ${l}`).join('\n')})`);
console.log(`    (the run ended as: ${fx.run(N)?.status}; the ticket is ${fx.issue(N).state})`);

fx.cleanup();
finish('PRD-05.R14');
