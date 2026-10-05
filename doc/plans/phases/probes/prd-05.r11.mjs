// Probe for PRD-05.R11 — takeover and cancel stay, and retry goes.
// Stage 7 artifact, authored 2026-09-28 (phase 40) from the register alone and the phase header's
// split of this requirement. Commands are run from the built CLI against the rig's folder, with
// the daemon running (so they go through the daemon's request file, as they do for the operator).
// For takeover, a stand-in `claude` on PATH plays the terminal session: it records how it was
// started and leaves the closing comment its instructions ask for.
//
// Register clauses (verbatim):
//   1. GIVEN the runner cannot start, for example because the model service cannot be reached
//      WHEN the operator runs `timone cancel <ticket>`
//      THEN the run stops, any running session is stopped, and the project is free for the next ticket
//   2. GIVEN a run that nothing is working on, on a project where no other run is working, holds a
//      work branch, or waits its turn
//      WHEN the operator runs `timone takeover <ticket>`
//      THEN a terminal session opens on that ticket, and when it ends the runner wakes and reads what it left
//      Note under it, 2026-10-02 (in part): "A takeover of a run the machine is working on opens no
//      session, and says what is happening. Nor does a takeover of a run waiting its turn: it waits
//      because another run holds the project, and a terminal session on it would work in the same
//      repository at the same time." Refined the same day: "the clause now names the rules the code
//      keeps: one session per project at a time, and one work branch per project at a time. A
//      takeover is also refused while another run of the same project is working or holds a work
//      branch, for the same reason".
//   3. GIVEN the command line WHEN `timone retry` is typed
//      THEN it does not exist, and the message says to write on the ticket instead
//   Phase 40's header: "In this phase retry refuses on a runner project and says to write on the
//   ticket instead. Deleting the command is #166's, with R20."
//   ✏ 2026-10-02 (phase 41, #166): clause 3 is now checked as written, and its old split is gone.
//   The fixtures no longer carry a `driver` line, which no longer loads (see _rig.mjs).
//   ✏ 2026-10-02 (phase 41 verification, iteration 3): clause 2 was reworded on fvermaut's answer on
//   pull request #189. It used to say "GIVEN any run". Its checks are re-authored from the new words;
//   see the comment above clause 2 below.
//   Since the same day the register names this file in R11's `Falsified-by` line, so a run that
//   cannot go red on a break leg leaves that line naming a check that does not work.
//   ✏ 2026-10-02 (phase 41 verification, iteration 4): clause 2's words were refined again, on
//   fvermaut's answer "change the words" on #189 to iteration 3's question, and then once more to
//   name the one-work-branch rule (`fb3f88a`). The case iteration 3 printed without judging (a run
//   nothing works on, while another run of the project is working) is now judged, under "clause 2,
//   note 3a". New: another run of the project parked and holding a work branch (note 3b, with and
//   without a daemon), and another run parked holding none (clause 2d). Labels quote the new words.
//
//   ✏ 2026-10-04 (phase 47 verification): the register's note on clause 2 dated 2026-10-04 replaces
//   the refusal while another run of the same project is working or holds a work branch with
//   PRD-07.R13, and says there is no queue any more. Notes 2, 3a and 3b checked that refusal and
//   that queue; they are removed here, and the takeover now allowed in those states is checked by
//   prd-07.r13.mjs. Clause 2d's break leg used a takeover refused over another run's work branch,
//   which is no longer refused; it now uses the takeover of a run the machine is working on (note 1's
//   fixture), where no session opens. Note 1 stays: the register keeps that refusal.
//
//   ✏ 2026-10-05 (phase 51 verification): the register's notes on clause 2 dated 2026-10-05 replace
//   that refusal with PRD-09.R4: a takeover of a run whose step is running waits for the step, then
//   opens. Note 1 now checks that, and its break leg is the build from just before phase 51, which
//   refused. Clause 2d's break leg, which used note 1's refused takeover, now uses the same takeover
//   on that older build, which still refuses.
//
// Clause 1c added 2026-09-29 (re-check after 40u). Clause 1a closes the ticket right after the cancel,
// so it never saw what the first check found outside its verdicts: the cancelled ticket, still open and
// marked, was taken up again as a new run within seconds, and held the project again. 1c leaves the
// ticket as a person who only ran `timone cancel` would leave it. Its break step removes the hold the
// cancel puts on the ticket, which is what a cancel that does not hold its ticket looks like.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { oldBuild } from './_old-build.mjs';
import { fixture, model, daemon, act, say, sleep, clause, assert, finish, OPERATOR, MACHINE_HEADER, REPO_ROOT } from './_rig.mjs';

const N = 12;
const whyOf = (q) => q.brief.split('## The ticket')[0];
const cancel = (fx, t = N) => fx.cli(['cancel', `fixture#${t}`, '--manifest', fx.manifest, '--state', fx.statePath, '--reason', 'probe: drop it']);

// Clause 1a: the model service cannot be reached, so the runner cannot start; cancel still stops the run.
async function unreachable({ doCancel }) {
  const fx = fixture({ issues: { fixture: { [N]: {} } } });
  const dead = { port: 9 };
  let out = null;
  const d = daemon(fx, dead, { until: () => out && fx.state().runs.find((r) => r.ticket === N && r.seq === 1)?.status === 'cancelled', timeoutMs: 45000 });
  while (!fx.record(N).some((e) => e.kind === 'woke')) await sleep(200);
  await sleep(2000);
  if (doCancel) { out = cancel(fx); fx.editForge((f) => { f.issues[N].state = 'CLOSED'; }); } else out = { code: null };
  if (!doCancel) await sleep(12000);
  // the next ticket arrives
  fx.editForge((f) => { f.issues[13] = { number: 13, title: 'Next ticket', body: 'x', labels: ['timone'], state: 'OPEN', author: OPERATOR, createdAt: new Date().toISOString(), comments: [] }; });
  await d;
  await daemon(fx, dead, { until: () => fx.state().runs.some((r) => r.ticket === 13), timeoutMs: 15000, settleMs: 500 });
  const runs = fx.state().runs;
  const r = { first: runs.find((x) => x.ticket === N && x.seq === 1), active: runs.filter((x) => x.status === 'active'), again: runs.filter((x) => x.ticket === N && x.seq > 1), next: runs.find((x) => x.ticket === 13), out, fx };
  return r;
}
const cancelledDead = await unreachable({ doCancel: true });
const notCancelledDead = await unreachable({ doCancel: false });
function assertStoppedAndFree(r) {
  assert(r.first?.status === 'cancelled', `the run is ${r.first?.status}`);
  assert(r.active.length === 0, `left running: ${r.active.map((x) => x.id).join(', ')}`);
  assert(r.next, 'the next ticket was not taken up');
}
await clause('PRD-05.R11 clause 1a', 'the model service cannot be reached: timone cancel stops the run, and the project is free for the next ticket', {
  broken: async () => assertStoppedAndFree(notCancelledDead),
  correct: async () => assertStoppedAndFree(cancelledDead),
});
console.log(`    (the command said, exit ${cancelledDead.out.code}: "${(cancelledDead.out.out + cancelledDead.out.err).trim().replace(/\n/g, ' ')}")`);
console.log(`    (the cancelled ticket, still open and marked, was picked up again as a new run: ${cancelledDead.again.map((x) => `${x.id} ${x.status}`).join(', ') || 'no'})`);

// Clause 1b: a running session is stopped by cancel.
async function runningStep({ doCancel }) {
  const fx = fixture({ issues: { fixture: { [N]: {} } } });
  const m = await model({
    runner: (c) => (c.wake === 0 && c.turn === 0 ? act('start_step', { stage: 'execution', instructions: 'build', reason: 'p', skipReason: 'p' }) : say()),
    step: () => ({ hang: true }),
  });
  let out = { code: null };
  const d = daemon(fx, m, { until: () => false, timeoutMs: 25000 });
  while (!m.steps().length) await sleep(200);
  await sleep(1500);
  if (doCancel) out = cancel(fx);
  await d;
  await m.stop();
  const step = m.steps()[0];
  const r = { closedBeforeStop: step.closedAt, run: fx.state().runs.find((x) => x.ticket === N && x.seq === 1), ended: fx.record(N).find((e) => e.kind === 'step-ended'), out, fx };
  return r;
}
const stepCancelled = await runningStep({ doCancel: true });
const stepNotCancelled = await runningStep({ doCancel: false });
function assertSessionStopped(r) {
  assert(r.run.status === 'cancelled', `the run is ${r.run.status}`);
  assert(r.ended, 'the running step was not ended');
  assert(r.closedBeforeStop, 'the running session was not stopped');
}
await clause('PRD-05.R11 clause 1b', 'timone cancel stops any running session', {
  broken: async () => assertSessionStopped(stepNotCancelled),
  correct: async () => assertSessionStopped(stepCancelled),
});
console.log(`    (the stopped step was recorded as: ${JSON.stringify(stepCancelled.ended)})`);
console.log(`    (the command said, exit ${stepCancelled.out.code}: "${(stepCancelled.out.out + stepCancelled.out.err).trim().replace(/\n/g, ' ')}")`);

// Clause 1c: the ticket is left open and marked after the cancel. The cancelled ticket is not taken up
// again, and the project is free for the next ticket.
async function cancelLeftOpen({ unhold }) {
  const fx = fixture({ issues: { fixture: { [N]: {} } } });
  const dead = { port: 9 };
  let out = null, at = 0;
  const d = daemon(fx, dead, { until: () => out && Date.now() - at > 15000, timeoutMs: 70000 });
  while (!fx.record(N).some((e) => e.kind === 'woke')) await sleep(200);
  await sleep(2000);
  out = cancel(fx);
  at = Date.now();
  const labels = [...fx.issue(N).labels];
  if (unhold) fx.editForge((f) => { f.issues[N].labels = f.issues[N].labels.filter((l) => l === 'timone'); });
  fx.editForge((f) => { f.issues[13] = { number: 13, title: 'Next ticket', body: 'x', labels: ['timone'], state: 'OPEN', author: OPERATOR, createdAt: new Date().toISOString(), comments: [] }; });
  await d;
  const runs = fx.state().runs;
  return { first: runs.find((x) => x.ticket === N && x.seq === 1), again: runs.filter((x) => x.ticket === N && x.seq > 1), active: runs.filter((x) => x.status === 'active'), next: runs.find((x) => x.ticket === 13), labels, out, fx };
}
const leftOpen = await cancelLeftOpen({ unhold: false });
const leftOpenUnheld = await cancelLeftOpen({ unhold: true });
function assertNotTakenUpAgain(r) {
  assert(r.first?.status === 'cancelled', `the run is ${r.first?.status}`);
  assert(r.again.length === 0, `the cancelled ticket was taken up again: ${r.again.map((x) => `${x.id} ${x.status}`).join(', ')}`);
  assert(r.active.length === 0, `left running: ${r.active.map((x) => x.id).join(', ')}`);
  assert(r.next, 'the next ticket was not taken up');
}
await clause('PRD-05.R11 clause 1c', 'the ticket left open and marked: after timone cancel the cancelled ticket is not taken up again, and the project is free for the next ticket', {
  broken: async () => assertNotTakenUpAgain(leftOpenUnheld),
  correct: async () => assertNotTakenUpAgain(leftOpen),
});
console.log(`    (the command said, exit ${leftOpen.out.code}: "${(leftOpen.out.out + leftOpen.out.err).trim().replace(/\n/g, ' ')}")`);
console.log(`    (the ticket's labels after the cancel: ${JSON.stringify(leftOpen.labels)}; the next ticket's run: ${leftOpen.next ? `${leftOpen.next.id} ${leftOpen.next.status}` : 'none'})`);

// Clause 2, re-authored 2026-10-02 (phase 41 verification, iteration 3) from the register's words as
// they now stand: "GIVEN any run that nothing is working on, and that is not waiting its turn behind
// another run WHEN the operator runs `timone takeover <ticket>` THEN a terminal session opens on that
// ticket, and when it ends the runner wakes and reads what it left." The phase-40 version said
// "GIVEN any run" and checked one kind of run. This version states and checks the GIVEN for each
// fixture, and checks two kinds of run nothing is working on: one the runner left with nothing to do
// (2a, 2b), and one the operator stopped with `timone cancel` (2c). The note under the clause names
// the two runs it leaves out; each is checked under its own "note" label. Their break legs use the
// takeover of a run nothing is working on, where a session does open: an instrument that cannot
// tell a session opening from none cannot go red there.
//
// Iteration 3 printed one case and did not judge it: a run nothing is working on, not in the queue,
// while another run of the same project holds it. The words then covered it; the note's reason
// argued against it. ✏ 2026-10-02 (iteration 4): fvermaut answered "change the words". Clause 2 now
// reads "GIVEN a run that nothing is working on, on a project where no other run is working, holds a
// work branch, or waits its turn", and its refined note says "A takeover is also refused while
// another run of the same project is working or holds a work branch". The case is judged under
// "clause 2, note 3a"; its break leg, like notes 1 and 2, uses the takeover of a run nothing is
// working on, where a session does open. The work-branch half is judged under "note 3b": ticket 13's
// run is parked (not working, not queued) and holds a work branch. Its break leg is the same fixture
// with ticket 13's run parked holding no work branch, where a session does open: the two differ only
// in the branch. That same pair, the other way round, is clause 2d.
const CLOSING = `${MACHINE_HEADER}🔁 **Picking it back up** · written by the machine when a stop has been cleared and the work goes on without you\n\nPROBE-R11-LEFT: we agreed to build only the count.\n\nCarrying on at: building\n\n**What I need from you:** nothing.`;
// A stand-in `claude` on PATH plays the terminal session. It posts through the person's account, as
// the real one does from their terminal.
function standIn(fx, ticket = N) {
  fs.writeFileSync(path.join(fx.dir, 'closing.md'), CLOSING);
  fs.writeFileSync(path.join(fx.dir, 'bin', 'claude'), [
    '#!/bin/sh',
    `printf '%s\\n' "$@" > "${path.join(fx.dir, 'takeover-prompt.txt')}"`,
    `FAKE_BOT_LOGIN=${OPERATOR} gh issue comment ${ticket} --repo probe-owner/fixture --body-file - < "${path.join(fx.dir, 'closing.md')}" > /dev/null`,
    'exit 0', '',
  ].join('\n'));
  fs.chmodSync(path.join(fx.dir, 'bin', 'claude'), 0o755);
}
const promptOf = (fx) => (fs.existsSync(path.join(fx.dir, 'takeover-prompt.txt')) ? fs.readFileSync(path.join(fx.dir, 'takeover-prompt.txt'), 'utf8') : '');
const takeoverCmd = (fx, t = N) => fx.cli(['takeover', `fixture#${t}`, '--manifest', fx.manifest, '--state', fx.statePath]);
const runsOf = (fx) => fx.state().runs.map((r) => `${r.id} ${r.status}`).join(', ');
// The GIVEN, read from the ledger before the takeover: nothing is working on the run (it is not
// active), and on its project no other run is working (none is active), holds a work branch (none
// names a branch in the ledger — counted whatever its status, so the check can only be stricter
// than the words), and nothing waits its turn (none is queued, the run itself included).
function givenOf(fx, t = N) {
  const runs = fx.state().runs;
  const mine = runs.filter((r) => r.ticket === t).at(-1);
  const others = runs.filter((r) => r.ticket !== t && (['active', 'queued'].includes(r.status) || r.branch));
  return { status: mine?.status, ok: mine && !['active', 'queued'].includes(mine.status) && others.length === 0, runs: runsOf(fx) };
}
// kind: 'idle' — the runner woke on the new ticket and chose to do nothing, so the run waits on nothing.
//       'cancelled' — the same, then `timone cancel` stopped it.
async function takeover({ doTakeover, daemonUp = true, kind = 'idle' }) {
  const fx = fixture({ issues: { fixture: { [N]: {} } } });
  standIn(fx);
  const m = await model({ runner: () => say() });
  await daemon(fx, m, { until: () => fx.record(N).some((e) => e.kind === 'runner-ended'), timeoutMs: 20000, settleMs: 500 });
  if (kind === 'cancelled') cancel(fx);
  const given = givenOf(fx);
  const before = m.runner().length;
  let out = { code: null, out: '', err: '' };
  if (daemonUp) {
    const d = daemon(fx, m, { until: () => m.runner().length > before, timeoutMs: 15000, settleMs: 1000 });
    await sleep(1500);
    if (doTakeover) out = takeoverCmd(fx);
    await d;
  } else {
    // No daemon while the session runs; the daemon is started again afterwards.
    if (doTakeover) out = takeoverCmd(fx);
    await daemon(fx, m, { until: () => m.runner().length > before, timeoutMs: 15000, settleMs: 1000 });
  }
  await m.stop();
  const after = m.runner().slice(before);
  return { kind, given, out, prompt: promptOf(fx), woke: after.length > 0, sawLeft: after.some((q) => q.brief.includes('PROBE-R11-LEFT')), fx };
}
const took = await takeover({ doTakeover: true });
const didNotTake = await takeover({ doTakeover: false });
function assertGiven(r) {
  assert(r.given.ok, `setup: not a run nothing is working on, on a project where no other run is working, holds a work branch, or waits its turn (${r.given.runs})`);
}
function assertSessionOpened(r) {
  assertGiven(r);
  assert(r.prompt.includes(`fixture #${N}`) || r.prompt.includes(`fixture#${N}`), 'no terminal session was opened on the ticket');
}
await clause('PRD-05.R11 clause 2a', 'a run that nothing is working on, on a project where no other run is working, holds a work branch, or waits its turn: timone takeover opens a terminal session on that ticket', {
  broken: async () => assertSessionOpened(didNotTake),
  correct: async () => assertSessionOpened(took),
});
console.log(`    (the run before the takeover: ${took.given.runs}; no other run on the project)`);
function assertWokeAndRead(r) {
  assertGiven(r);
  assert(r.woke, 'the terminal session ended and left its closing comment, but the runner did not wake');
  assert(r.sawLeft, 'the runner woke without what the session left');
}
await clause('PRD-05.R11 clause 2b', 'when the terminal session ends, the runner wakes and reads what it left', {
  broken: async () => assertWokeAndRead(didNotTake),
  correct: async () => assertWokeAndRead(took),
});
console.log(`    (takeover said, exit ${took.out.code}: "${took.out.out.trim().replace(/\n/g, ' ')}")`);
const tookWhileDown = await takeover({ doTakeover: true, daemonUp: false });
const noTakeoverWhileDown = await takeover({ doTakeover: false, daemonUp: false });
await clause('PRD-05.R11 clause 2b (daemon stopped)', 'takeover with no daemon running: when the daemon runs again, the runner wakes and reads what the session left', {
  broken: async () => assertWokeAndRead(noTakeoverWhileDown),
  correct: async () => assertWokeAndRead(tookWhileDown),
});
console.log(`    (takeover with no daemon said, exit ${tookWhileDown.out.code}: "${tookWhileDown.out.out.trim().replace(/\n/g, ' ')}")`);
const tookCancelled = await takeover({ doTakeover: true, kind: 'cancelled' });
const noTakeoverCancelled = await takeover({ doTakeover: false, kind: 'cancelled' });
await clause('PRD-05.R11 clause 2c', 'a run stopped with timone cancel is also one nothing is working on: timone takeover opens a terminal session on that ticket, and when it ends the runner wakes and reads what it left', {
  broken: async () => { assert(noTakeoverCancelled.given.status === 'cancelled', `setup: the run is ${noTakeoverCancelled.given.status}`); assertSessionOpened(noTakeoverCancelled); assertWokeAndRead(noTakeoverCancelled); },
  correct: async () => { assert(tookCancelled.given.status === 'cancelled', `setup: the run is ${tookCancelled.given.status}`); assertSessionOpened(tookCancelled); assertWokeAndRead(tookCancelled); },
});
console.log(`    (takeover of the cancelled run said, exit ${tookCancelled.out.code}: "${tookCancelled.out.out.trim().replace(/\n/g, ' ')}"; runs after: ${runsOf(tookCancelled.fx)})`);

// ✏ 2026-10-05 (phase 51 verification): the register's note on clause 2 dated 2026-10-05 replaces
// the refusal on a run whose step is running with PRD-09.R4: "A takeover typed then says which step
// it waits for, waits for it to end, and then opens the session." R4's Falsified-by line asks that
// this probe's check that such a takeover opens no session be replaced by one that it waits and then
// opens, seen to fail first; this is that check, "note 1" below. The command is typed as a child
// process, so the probe's fake model keeps answering while it waits: the step answers after 10 s,
// and ends. Its break leg is the build from just before phase 51 (main at e16cb71), which refused.
// The build's own note of the same day, "A run just picked up, where no step runs yet, is still
// refused with 'I'm working on … right now'", is not checked: from outside, a run could not be held
// in that state (a runner session that does not answer leaves the run parked, not picked up).
const BEFORE_PHASE_51 = 'e16cb719c20bf56ebb9f38871d27ec497dc1f32f';
const REAL_ONLY = process.env.PROBE_REAL_ONLY === '1';
function typeAsync(fx, port) {
  const child = spawn(process.execPath, [fx.cliPath, 'takeover', `fixture#${N}`, '--manifest', fx.manifest, '--state', fx.statePath], { cwd: fx.dir, env: fx.env(port), stdio: ['ignore', 'pipe', 'pipe'] });
  const t = { out: '', code: null, exited: false };
  child.stdout.on('data', (d) => (t.out += d));
  child.stderr.on('data', (d) => (t.out += d));
  t.done = new Promise((r) => child.on('exit', (c) => { t.code = c; t.exited = true; r(); }));
  t.kill = () => { try { child.kill('SIGKILL'); } catch {} };
  return t;
}
async function busyTakeover({ cli } = {}) {
  const fx = fixture({ issues: { fixture: { [N]: {} } }, cli });
  standIn(fx);
  const m = await model({
    runner: (c) => (c.turn === 0 && !fx.record(N).some((e) => e.kind === 'step-started') ? act('start_step', { stage: 'execution', instructions: 'build', reason: 'p', skipReason: 'p' }) : say()),
    step: () => ({ delayMs: 10000, blocks: [{ type: 'text', text: 'done' }] }),
  });
  let t = null;
  const d = daemon(fx, m, { until: () => t && t.exited && (m.runner().some((q) => q.brief.includes('PROBE-R11-LEFT')) || !promptOf(fx)), timeoutMs: cli ? 40000 : 60000, settleMs: 1500 });
  while (!m.steps().length) await sleep(200);
  await sleep(1500);
  const status = fx.run(N)?.status;
  t = typeAsync(fx, m.port);
  await d;
  await Promise.race([t.done, sleep(10000)]);
  t.kill();
  await m.stop();
  const ended = fx.record(N).find((e) => e.kind === 'step-ended');
  return { status, out: { code: t.code }, said: t.out.replace(/\s+/g, ' ').trim(), prompt: promptOf(fx), ended, sawLeft: m.runner().some((q) => q.brief.includes('PROBE-R11-LEFT')), fx };
}
const busy = await busyTakeover();
const busyOld = REAL_ONLY ? null : await busyTakeover({ cli: oldBuild(BEFORE_PHASE_51) });
const noSession = (r) => assert(!r.prompt, `a terminal session was opened on the ticket: "${r.prompt.split('\n')[0].slice(0, 120)}"`);
function assertWaitsThenOpens(r) {
  assert(r.status === 'active', `setup: the run is ${r.status}, not one whose step is running`);
  assert(/wait/i.test(r.said) && /ctrl-c/i.test(r.said) && r.said.includes(`#${N}`), `it does not say which step it waits for: "${r.said.slice(0, 200)}"`);
  assert(r.ended, 'setup: the step never ended');
  assert(r.prompt.includes(`fixture #${N}`) || r.prompt.includes(`fixture#${N}`), 'no terminal session opened on the ticket after the step ended');
  assert(r.sawLeft, 'the runner did not wake and read what the session left');
}
await clause('PRD-05.R11 clause 2, note 1', 'a takeover of a run whose step is running (note of 2026-10-05, PRD-09.R4): it says which step it waits for, waits for it to end, and then opens the session', {
  broken: async () => assertWaitsThenOpens(busyOld),
  correct: async () => assertWaitsThenOpens(busy),
});
console.log(`    (takeover of the run whose step was running said, exit ${busy.out.code}: "${busy.said.slice(0, 600)}")`);
if (busyOld) console.log(`    (break leg, the build before phase 51 said, exit ${busyOld.out.code}: "${busyOld.said.slice(0, 200)}")`);

// The refined note's second run, added in iteration 4. Ticket 12's run waits on nothing; then ticket
// 13 arrives. withBranch: the runner starts a step on 13, the step ends at once, and 13's run is left
// parked — nothing works on it, it is not queued — holding its work branch, which is then pushed with
// one commit, as a step would have. Without: the runner does nothing on 13, so its run is parked
// holding no work branch. Each is taken over with the daemon running, or with none.
async function otherParked({ withBranch, daemonUp }) {
  const fx = fixture({ issues: { fixture: { [N]: {} } } });
  standIn(fx);
  const m = await model({
    runner: (c) => (withBranch && c.turn === 0 && c.brief.includes('fixture #13') && whyOf(c).includes('picked up') ? act('start_step', { stage: 'execution', instructions: 'build', reason: 'p', skipReason: 'p' }) : say()),
    step: () => say('done'),
  });
  await daemon(fx, m, { until: () => fx.record(N).some((e) => e.kind === 'runner-ended'), timeoutMs: 20000, settleMs: 500 });
  fx.editForge((f) => { f.issues[13] = { number: 13, title: 'Next ticket', body: 'x', labels: ['timone'], state: 'OPEN', author: OPERATOR, createdAt: new Date().toISOString(), comments: [] }; });
  await daemon(fx, m, { until: () => fx.run(13)?.status === 'parked' && fx.record(13).filter((e) => e.kind === 'runner-ended').length >= (withBranch ? 2 : 1), timeoutMs: 40000, settleMs: 1500 });
  const o = fx.run(13);
  if (o?.branch) fx.pushBranch(o.branch, { 'probe-work.txt': 'work in progress\n' });
  const other = { status: o?.status, branch: o?.branch, onRemote: o?.branch ? Boolean(fx.remoteHead(o.branch)) : false };
  const given = givenOf(fx);
  const runs = fx.state().runs.map((r) => `${r.id} ${r.status}${r.branch ? ` holding ${r.branch}` : ''}`).join(', ');
  const before = m.runner().length;
  let out = { code: null, out: '', err: '' };
  if (daemonUp) {
    let asked = 0;
    const d = daemon(fx, m, { until: () => asked && (m.runner().length > before || Date.now() - asked > 10000), timeoutMs: 30000, settleMs: 1000 });
    await sleep(1500);
    out = takeoverCmd(fx);
    asked = Date.now();
    await d;
  } else {
    out = takeoverCmd(fx);
  }
  await m.stop();
  const after = m.runner().slice(before);
  const why = fs.readFileSync(path.join(fx.dir, 'daemon.log'), 'utf8').split('\n').filter((l) => /takeover/i.test(l)).at(-1) ?? '';
  return { withBranch, daemonUp, given, other, otherAfter: fx.run(13), mineAfter: fx.run(N)?.status, runs, steps: m.steps().length, out, said: (out.out + out.err).trim(), prompt: promptOf(fx), woke: after.length > 0, sawLeft: after.some((q) => q.brief.includes('PROBE-R11-LEFT')), why, fx };
}
const holdsNone = await otherParked({ withBranch: false, daemonUp: true });
function assertOpenedAndRead(r) {
  assert(r.prompt.includes(`fixture #${N}`) || r.prompt.includes(`fixture#${N}`), 'no terminal session was opened on the ticket');
  assert(r.woke, 'the terminal session ended and left its closing comment, but the runner did not wake');
  assert(r.sawLeft, 'the runner woke without what the session left');
}
await clause('PRD-05.R11 clause 2d', 'another run of the project is parked and holds no work branch: timone takeover opens a terminal session on that ticket, and when it ends the runner wakes and reads what it left', {
  broken: async () => assertOpenedAndRead(busyOld),
  correct: async () => {
    assert(holdsNone.other.status === 'parked' && !holdsNone.other.branch, `setup: ticket 13's run is ${holdsNone.other.status}${holdsNone.other.branch ? `, holding ${holdsNone.other.branch}` : ''}`);
    assertGiven(holdsNone);
    assertOpenedAndRead(holdsNone);
  },
});
console.log(`    (runs at the takeover: ${holdsNone.runs}. Takeover said, exit ${holdsNone.out.code}: "${holdsNone.said.replace(/\n/g, ' ')}")`);
// Clause 3, re-authored 2026-10-02 (phase 41 verification) from the register's clause as it now
// stands: "it does not exist, and the message says to write on the ticket instead". The phase-40
// version checked only that retry refused on a runner project, which was that phase's split.
// Break legs run the build from just before phase 41 (_old-build.mjs), where `timone retry` still
// exists. The state both builds are given is one the old build made itself: a run it marked failed,
// which is the run its retry exists to act on.
const OLD = oldBuild();
const withFailedRun = fixture({ issues: { fixture: { [N]: {} } }, cli: OLD });
{
  const dead = await model({ step: () => say('done') });
  await daemon(withFailedRun, dead, { until: (fx) => fx.run(N)?.status === 'failed', timeoutMs: 30000, settleMs: 500 });
  await dead.stop();
}
assert(withFailedRun.run(N)?.status === 'failed', `setup: the old build did not leave a failed run (it left ${withFailedRun.run(N)?.status})`);
// Everything a command could change in the folder: the state, the forge, the daemon's request files.
function snapshot(fx) {
  const out = {};
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      const rel = path.relative(fx.dir, p);
      if (e.isDirectory()) { if (!['.git', 'remote', 'projects', 'work', 'bin', 'claude-config'].includes(e.name)) walk(p); continue; }
      if (/\.log$/.test(e.name) || /\.lock$/.test(e.name)) continue;
      out[rel] = crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex');
    }
  };
  walk(fx.dir);
  return out;
}
const changes = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]);
const typed = (cliPath) => {
  const before = snapshot(withFailedRun);
  const r = withFailedRun.cli(['retry', `fixture#${N}`, '--manifest', withFailedRun.manifest, '--state', withFailedRun.statePath]);
  return { ...r, said: (r.out + r.err).trim(), changed: changes(before, snapshot(withFailedRun)), cliPath };
};
// The current build first, so the old build's retry cannot have changed what it is given.
withFailedRun.cliPath = path.join(REPO_ROOT, 'dist', 'cli.js');
const retryNow = typed(withFailedRun.cliPath);
const helpNow = withFailedRun.cli(['--help']);
withFailedRun.cliPath = OLD;
const retryOld = typed(OLD);
const helpOld = withFailedRun.cli(['--help']);

const listed = (h) => (h.out + h.err).split('\n').filter((l) => /^\s+retry\b/.test(l));
await clause('PRD-05.R11 clause 3a', 'timone retry does not exist: the command line does not offer it', {
  broken: async () => { const l = listed(helpOld); assert(helpOld.code === 0 && l.length === 0, `the command list offers it: "${l.join(' ').trim()}"`); },
  correct: async () => { const l = listed(helpNow); assert(helpNow.code === 0 && l.length === 0, `the command list offers it: "${l.join(' ').trim()}"`); },
});
function assertDidNothing(r) {
  assert(r.code !== 0, `timone retry went ahead (exit 0): "${r.said}"`);
  assert(r.changed.length === 0, `timone retry changed ${r.changed.join(', ')}`);
}
await clause('PRD-05.R11 clause 3b', 'timone retry does not exist: typed on a ticket whose run the old build marked failed, it changes nothing', {
  broken: async () => assertDidNothing(retryOld),
  correct: async () => assertDidNothing(retryNow),
});
const assertWriteOnTicket = (r) => assert(/write on the ticket/i.test(r.said), `the message does not say to write on the ticket: "${r.said}"`);
await clause('PRD-05.R11 clause 3c', 'the message says to write on the ticket instead', {
  broken: async () => assertWriteOnTicket(retryOld),
  correct: async () => assertWriteOnTicket(retryNow),
});
console.log(`    (timone retry said, exit ${retryNow.code}: "${retryNow.said}")`);
console.log(`    (the build before phase 41 said, exit ${retryOld.code}: "${retryOld.said.replace(/\n/g, ' ').slice(0, 200)}"; it changed: ${retryOld.changed.join(', ') || 'nothing'})`);
const helpRetry = (() => { withFailedRun.cliPath = path.join(REPO_ROOT, 'dist', 'cli.js'); return withFailedRun.cli(['help', 'retry']); })();
console.log(`    (seen, not part of the clause: \`timone help retry\` prints, exit ${helpRetry.code}: "${(helpRetry.out + helpRetry.err).trim()}")`);
withFailedRun.cleanup();

for (const r of [cancelledDead, notCancelledDead, stepCancelled, stepNotCancelled, leftOpen, leftOpenUnheld, took, didNotTake, tookWhileDown, noTakeoverWhileDown, tookCancelled, noTakeoverCancelled, busy, busyOld, holdsNone]) r?.fx.cleanup();
finish('PRD-05.R11');
