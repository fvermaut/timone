// Probe for PRD-05.R11 — takeover and cancel stay, and retry goes (on runner projects only in this phase).
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
//   2. GIVEN any run WHEN the operator runs `timone takeover <ticket>`
//      THEN a terminal session opens on that ticket, and when it ends the runner wakes and reads what it left
//   3. GIVEN the command line WHEN `timone retry` is typed
//      THEN it does not exist, and the message says to write on the ticket instead
//   Phase 40's header: "In this phase retry refuses on a runner project and says to write on the
//   ticket instead. Deleting the command is #166's, with R20."
//
// Clause 1c added 2026-09-29 (re-check after 40u). Clause 1a closes the ticket right after the cancel,
// so it never saw what the first check found outside its verdicts: the cancelled ticket, still open and
// marked, was taken up again as a new run within seconds, and held the project again. 1c leaves the
// ticket as a person who only ran `timone cancel` would leave it. Its break step removes the hold the
// cancel puts on the ticket, which is what a cancel that does not hold its ticket looks like.
import fs from 'node:fs';
import path from 'node:path';
import { fixture, model, daemon, act, say, sleep, clause, assert, finish, OPERATOR, MACHINE_HEADER } from './_rig.mjs';

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

// Clause 2: takeover opens a terminal session on the ticket; when it ends, the runner wakes and reads what it left.
const CLOSING = `${MACHINE_HEADER}🔁 **Picking it back up** · written by the machine when a stop has been cleared and the work goes on without you\n\nPROBE-R11-LEFT: we agreed to build only the count.\n\nCarrying on at: building\n\n**What I need from you:** nothing.`;
async function takeover({ doTakeover, daemonUp = true }) {
  const fx = fixture({ issues: { fixture: { [N]: {} } } });
  // The stand-in session posts through the person's account, as the real one does from their terminal.
  fs.writeFileSync(path.join(fx.dir, 'closing.md'), CLOSING);
  fs.writeFileSync(path.join(fx.dir, 'bin', 'claude'), [
    '#!/bin/sh',
    `printf '%s\\n' "$@" > "${path.join(fx.dir, 'takeover-prompt.txt')}"`,
    `FAKE_BOT_LOGIN=${OPERATOR} gh issue comment ${N} --repo probe-owner/fixture --body-file - < "${path.join(fx.dir, 'closing.md')}" > /dev/null`,
    'exit 0', '',
  ].join('\n'));
  fs.chmodSync(path.join(fx.dir, 'bin', 'claude'), 0o755);
  const m = await model({ runner: () => say() });
  await daemon(fx, m, { until: () => fx.record(N).some((e) => e.kind === 'runner-ended'), timeoutMs: 20000, settleMs: 500 });
  const before = m.runner().length;
  let out = { code: null, out: '' };
  if (daemonUp) {
    const d = daemon(fx, m, { until: () => m.runner().length > before, timeoutMs: 15000, settleMs: 1000 });
    await sleep(1500);
    if (doTakeover) out = fx.cli(['takeover', `fixture#${N}`, '--manifest', fx.manifest, '--state', fx.statePath]);
    await d;
  } else {
    // No daemon while the session runs; the daemon is started again afterwards.
    if (doTakeover) out = fx.cli(['takeover', `fixture#${N}`, '--manifest', fx.manifest, '--state', fx.statePath]);
    await daemon(fx, m, { until: () => m.runner().length > before, timeoutMs: 15000, settleMs: 1000 });
  }
  await m.stop();
  const prompt = fs.existsSync(path.join(fx.dir, 'takeover-prompt.txt')) ? fs.readFileSync(path.join(fx.dir, 'takeover-prompt.txt'), 'utf8') : '';
  const after = m.runner().slice(before);
  const r = { out, prompt, woke: after.length > 0, sawLeft: after.some((q) => q.brief.includes('PROBE-R11-LEFT')), fx };
  return r;
}
const took = await takeover({ doTakeover: true });
const didNotTake = await takeover({ doTakeover: false });
function assertSessionOpened(r) {
  assert(r.prompt.includes(`fixture #${N}`) || r.prompt.includes(`fixture#${N}`), 'no terminal session was opened on the ticket');
}
await clause('PRD-05.R11 clause 2a', 'timone takeover opens a terminal session on that ticket', {
  broken: async () => assertSessionOpened(didNotTake),
  correct: async () => assertSessionOpened(took),
});
function assertWokeAndRead(r) {
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

// Clause 3, as split by the phase: on a runner project retry refuses and says to write on the ticket.
async function retryOn(driver) {
  const fx = fixture({ issues: { fixture: { [N]: {} } }, projects: { fixture: driver ? { driver } : {} } });
  const r = fx.cli(['retry', `fixture#${N}`, '--manifest', fx.manifest, '--state', fx.statePath]);
  fx.cleanup();
  return r;
}
const retryRunner = await retryOn('runner');
const retryDaemon = await retryOn(null);
function assertWriteOnTicket(r) {
  assert(r.code !== 0, 'retry went ahead');
  assert(/write on the ticket/i.test(r.out + r.err), `the message does not say to write on the ticket: "${(r.out + r.err).trim()}"`);
}
await clause('PRD-05.R11 clause 3 (this phase)', 'on a runner project, timone retry refuses and says to write on the ticket instead', {
  broken: async () => assertWriteOnTicket(retryDaemon),
  correct: async () => assertWriteOnTicket(retryRunner),
});
console.log(`    (retry on a runner project said: "${(retryRunner.out + retryRunner.err).trim()}")`);
console.log('    (clause 3 as written — "it does not exist" — is not claimed by this phase: the command stays for ivtrends, and #166 deletes it)');

for (const r of [cancelledDead, notCancelledDead, stepCancelled, stepNotCancelled, leftOpen, leftOpenUnheld, took, didNotTake, tookWhileDown, noTakeoverWhileDown]) r.fx.cleanup();
finish('PRD-05.R11');
