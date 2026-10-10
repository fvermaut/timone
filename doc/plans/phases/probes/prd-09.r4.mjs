// Probe for PRD-09.R4 — A takeover typed while a step is running waits for it, then opens.
// Stage 7 artifact, authored 2026-10-05 (phase 51 verification) from the register alone. Runs the
// built daemon and the built `timone takeover` through _rig.mjs. Needs `npm run build` first.
//
// Register clauses (verbatim):
//   1. GIVEN a run of ticket `<n>` whose step is still running, for example because it has just
//      posted a question and has not yet ended
//      WHEN a named person runs the command
//      THEN the command does not refuse
//      AND it says at the terminal, in one sentence, which step it waits for, and that the person
//      can stop waiting with Ctrl-C
//   2. GIVEN a takeover waiting this way
//      WHEN the step ends
//      THEN the terminal session opens on the ticket
//      AND the runner starts no other step on the ticket between the step's end and the session opening
//      AND when the session ends, the runner wakes and reads what it left on the ticket, as PRD-05.R11 says
//   3. GIVEN a takeover waiting this way
//      WHEN the person stops it before the step ends
//      THEN the run is the same as if the command had never been typed, and the runner carries on as it would have
//   4. GIVEN a run whose step is running
//      WHEN the command is typed, both while the daemon is running and holds the run ledger, and
//      while no daemon is running
//      THEN it behaves as the clauses above say, or, when no daemon is running and so no step can
//      end, it says so and does not wait
//
// The fixture. Ticket 12's runner is eager: on every wake it starts a step, until two steps have
// started. Each step answers after STEP_MS and ends. So, if nothing holds the ticket when a step
// ends, the runner is woken and starts the next step at once: that is what clause 2's middle line
// forbids, and what the fixture makes happen whenever it is allowed to. A stand-in `claude` on PATH
// plays the terminal session: it writes the time it opened, posts the session's closing comment
// through the person's account, as the real one does, and ends.
//
// Break legs.
//   1     — the build from just before phase 51 (main at e16cb71), where the takeover of a run whose
//           step runs was refused (PRD-05.R11's old note).
//   1 (which step) — the same takeover while a step of another kind runs: the sentence must not
//           name the build step then.
//   2a/2c — the same takeover on the build from just before phase 51: no session opens.
//   2b    — a takeover that does not hold the ticket: the person watches from outside, and types
//           the command only once the step has ended. The eager runner starts its next step in
//           between, and the check must see it.
//   3     — the same takeover not stopped: then the run is not as if it had never been typed.
//   4     — the same command with the daemon running: then it waits.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { oldBuild } from './_old-build.mjs';
import { fixture, model, daemon, act, say, sleep, clause, assert, finish, OPERATOR, MACHINE_HEADER } from './_rig.mjs';

const REAL_ONLY = process.env.PROBE_REAL_ONLY === '1';
const N = 12;
const STEP_MS = 12000;
// main just before phase 51: its takeover refuses a run whose step runs.
export const BEFORE_PHASE_51 = 'e16cb719c20bf56ebb9f38871d27ec497dc1f32f';
const LEFT = 'PROBE-R4-LEFT: we agreed to keep the count blue.';
const CLOSING = `${MACHINE_HEADER}${LEFT}\n\n**What I need from you:** nothing.`;
const ms = (iso) => Date.parse(iso);
const one = (s) => String(s).replace(/\s+/g, ' ').trim();

function standIn(fx) {
  fs.writeFileSync(path.join(fx.dir, 'closing.md'), CLOSING);
  fs.writeFileSync(path.join(fx.dir, 'bin', 'claude'), [
    '#!/bin/sh',
    // ✏ 2026-10-10 (phase 58 verification): the time is written by node, not by `date +%s%3N`.
    // BSD date (a Mac) has no %N and printed "17916436183N", read as no session at all.
    `"${process.execPath}" -e 'console.log(Date.now())' > "${path.join(fx.dir, 'opened-at')}"`,
    `printf '%s\\n' "$@" > "${path.join(fx.dir, 'takeover-prompt.txt')}"`,
    `FAKE_BOT_LOGIN=${OPERATOR} gh issue comment ${N} --repo probe-owner/fixture --body-file - < "${path.join(fx.dir, 'closing.md')}" > /dev/null`,
    'exit 0', '',
  ].join('\n'));
  fs.chmodSync(path.join(fx.dir, 'bin', 'claude'), 0o755);
}
const read = (fx, f) => (fs.existsSync(path.join(fx.dir, f)) ? fs.readFileSync(path.join(fx.dir, f), 'utf8') : '');

function typeTakeover(fx, m) {
  const child = spawn(process.execPath, [fx.cliPath, 'takeover', `fixture#${N}`, '--manifest', fx.manifest, '--state', fx.statePath], { cwd: fx.dir, env: fx.env(m?.port), stdio: ['ignore', 'pipe', 'pipe'] });
  const t = { out: '', code: null, signal: null, at: Date.now(), exitAt: null, child };
  child.stdout.on('data', (d) => (t.out += d));
  child.stderr.on('data', (d) => (t.out += d));
  t.done = new Promise((r) => child.on('exit', (c, s) => { t.code = c; t.signal = s; t.exitAt = Date.now(); r(); }));
  return t;
}
const kill = (t) => { try { t.child.kill('SIGKILL'); } catch {} };

// mode:
//   'wait'      — typed while the first step runs, and left alone.
//   'late'      — not typed during the step; typed once the step has ended and the runner has
//                 started its next step (2b's break leg).
//   'ctrlc'     — typed while the first step runs; Ctrl-C once it has said it waits.
//   'ctrlc-now' — typed while the first step runs; Ctrl-C at once, before it has said anything.
//   'none'      — never typed: the run as the command had never been typed (clause 3's comparison).
async function scenario({ mode, cli, stage = 'execution' }) {
  const fx = fixture({ issues: { fixture: { [N]: {} } }, cli });
  standIn(fx);
  const startedSteps = () => fx.record(N).filter((e) => e.kind === 'step-started');
  const m = await model({
    runner: (c) => (c.turn === 0 && startedSteps().length < 2 ? act('start_step', { stage, instructions: 'probe: do the work', reason: 'probe', skipReason: 'probe: verifier fixture' }) : say()),
    step: () => ({ delayMs: STEP_MS, blocks: [{ type: 'text', text: 'done' }] }),
  });
  let t = null;
  let stopAt = null;
  const ended = () => fx.record(N).filter((e) => e.kind === 'step-ended');
  const done = () => {
    if (mode === 'wait' || mode === 'late') return t && t.exitAt && m.runner().some((q) => q.brief.includes(LEFT)) ? true : false;
    return ended().length >= 1 && startedSteps().length >= 2;
  };
  const d = daemon(fx, m, { until: done, timeoutMs: cli ? 45000 : 90000, settleMs: 1500 });
  const deadline = Date.now() + 60000;
  while (startedSteps().length < 1 && Date.now() < deadline) await sleep(200);
  const runWhileStep = fx.run(N);
  await sleep(2000);
  if (mode === 'wait' || mode === 'ctrlc' || mode === 'ctrlc-now') t = typeTakeover(fx, m);
  if (mode === 'ctrlc-now') { await sleep(150); stopAt = Date.now(); t.child.kill('SIGINT'); }
  if (mode === 'ctrlc') {
    const until = Date.now() + 15000;
    while (!/ctrl-c/i.test(t.out) && Date.now() < until) await sleep(100);
    await sleep(500);
    stopAt = Date.now();
    t.child.kill('SIGINT');
  }
  if (mode === 'late') {
    while (startedSteps().length < 2) await sleep(100);
    t = typeTakeover(fx, m);
  }
  const res = await d;
  if (t) { await Promise.race([t.done, sleep(15000)]); kill(t); }
  await m.stop();
  const rec = fx.record(N);
  const opened = read(fx, 'opened-at').trim();
  return {
    mode, stage, fx, t, res, rec, runWhileStep, stopAt,
    said: one(t?.out ?? ''),
    prompt: read(fx, 'takeover-prompt.txt'),
    openedAt: opened ? Number(opened) : null,
    firstEnd: rec.find((e) => e.kind === 'step-ended'),
    starts: rec.filter((e) => e.kind === 'step-started'),
    wakes: rec.filter((e) => e.kind === 'woke'),
    runnerAfterLeft: m.runner().filter((q) => q.brief.includes(LEFT)),
    runAfter: fx.run(N),
    comments: (fx.issue(N).comments ?? []).map((c) => c.body),
  };
}

const sessionOpened = (r) => Boolean(r.prompt) && (r.prompt.includes(`fixture #${N}`) || r.prompt.includes(`fixture#${N}`));
const sentences = (s) => s.split(/(?<=[.!?])\s+(?=[A-Z])/);
const waitSentence = (r) => sentences(r.said).filter((x) => /ctrl-c/i.test(x));

const waited = await scenario({ mode: 'wait' });
const OLD = REAL_ONLY ? null : oldBuild(BEFORE_PHASE_51);
const oldWaited = REAL_ONLY ? null : await scenario({ mode: 'wait', cli: OLD });
const otherStep = REAL_ONLY ? null : await scenario({ mode: 'wait', stage: 'verification' });

// ---------------------------------------------------------------- clause 1
function assertNotRefused(r) {
  assert(r.runWhileStep?.status === 'active', `setup: the run was ${r.runWhileStep?.status} when the command was typed, not one whose step is running`);
  assert(!/working on .* right now/i.test(r.said), `the command refused: "${r.said.slice(0, 240)}"`);
  const w = waitSentence(r);
  assert(w.length === 1, `no single sentence says that Ctrl-C stops the wait: "${r.said.slice(0, 300)}"`);
  assert(/wait/i.test(w[0]), `the Ctrl-C sentence does not say it waits: "${w[0]}"`);
}
const namesBuildStep = (r) => {
  const w = waitSentence(r);
  assert(w.length === 1, `no single sentence says that Ctrl-C stops the wait: "${r.said.slice(0, 300)}"`);
  assert(/\bbuild/i.test(w[0]) && w[0].includes(`#${N}`), `the sentence does not name the build step on #${N} as the step it waits for: "${w[0]}"`);
};
await clause('PRD-09.R4 clause 1a', 'a run whose step is still running: when a named person runs the command, the command does not refuse, and says in one sentence that it waits and that Ctrl-C stops the wait', {
  broken: async () => assertNotRefused(oldWaited),
  correct: async () => assertNotRefused(waited),
});
await clause('PRD-09.R4 clause 1b', 'that one sentence says which step it waits for (a build step, on this ticket)', {
  broken: async () => { assert(otherStep.runWhileStep?.status === 'active', 'setup: no step running'); namesBuildStep(otherStep); },
  correct: async () => namesBuildStep(waited),
});
console.log(`    (the command said: "${waited.said}")`);
if (otherStep) console.log(`    (break leg, a verification step running, it said: "${waitSentence(otherStep)[0] ?? otherStep.said}")`);
if (oldWaited) console.log(`    (break leg, the build before phase 51 said, exit ${oldWaited.t?.code}: "${oldWaited.said.slice(0, 200)}")`);

// ---------------------------------------------------------------- clause 2
function assertOpenedAfterStep(r) {
  assert(r.firstEnd, `setup: the step never ended (${r.rec.map((e) => e.kind).join(', ')})`);
  assert(sessionOpened(r), 'no terminal session opened on the ticket');
  assert(r.openedAt >= ms(r.firstEnd.at) - 50, `the session opened ${ms(r.firstEnd.at) - r.openedAt} ms before the step ended`);
}
await clause('PRD-09.R4 clause 2a', 'a takeover waiting this way: when the step ends, the terminal session opens on the ticket', {
  broken: async () => assertOpenedAfterStep(oldWaited),
  correct: async () => assertOpenedAfterStep(waited),
});
const late = REAL_ONLY ? null : await scenario({ mode: 'late' });
function startsBetween(r) {
  const from = ms(r.firstEnd.at), to = r.openedAt;
  return r.starts.filter((s) => ms(s.at) > from && ms(s.at) < to);
}
function assertNoStepBetween(r) {
  assert(r.firstEnd && r.openedAt, `setup: the step did not end, or no session opened (ended: ${Boolean(r.firstEnd)}, opened: ${Boolean(r.openedAt)})`);
  const between = startsBetween(r);
  assert(between.length === 0, `the runner started ${between.length} step(s) between the step's end and the session opening: ${between.map((s) => `${s.stage} at ${s.at}`).join(', ')}`);
}
await clause('PRD-09.R4 clause 2b', "the runner starts no other step on the ticket between the step's end and the session opening", {
  broken: async () => assertNoStepBetween(late),
  correct: async () => assertNoStepBetween(waited),
});
{
  const from = ms(waited.firstEnd?.at ?? 0);
  const wakesBetween = waited.wakes.filter((w) => ms(w.at) > from && ms(w.at) < (waited.openedAt ?? 0));
  console.log(`    (step ended ${waited.firstEnd?.at}; session opened ${waited.openedAt ? new Date(waited.openedAt).toISOString() : 'never'}; runner wakes in between: ${wakesBetween.length}; steps started in all: ${waited.starts.length})`);
  if (late) console.log(`    (break leg, typed after the step ended: steps started in between: ${late.firstEnd && late.openedAt ? startsBetween(late).map((s) => s.at).join(', ') : 'n/a'})`);
}
function assertWokeAndRead(r) {
  assertOpenedAfterStep(r);
  assert(r.runnerAfterLeft.length > 0, 'after the session ended, the runner did not wake with what the session left on the ticket');
  assert(r.runnerAfterLeft.every((q) => ms(q.at) >= r.openedAt), 'the runner read the closing comment before the session opened');
}
await clause('PRD-09.R4 clause 2c', 'when the session ends, the runner wakes and reads what it left on the ticket, as PRD-05.R11 says', {
  broken: async () => assertWokeAndRead(oldWaited),
  correct: async () => assertWokeAndRead(waited),
});
console.log(`    (wakes after the session: ${waited.wakes.filter((w) => ms(w.at) >= (waited.openedAt ?? Infinity)).map((w) => JSON.stringify(w.events)).join(' | ')})`);

// ---------------------------------------------------------------- clause 3
const none = await scenario({ mode: 'none' });
const stopped = await scenario({ mode: 'ctrlc' });
const stoppedNow = await scenario({ mode: 'ctrlc-now' });
const VOLATILE = new Set(['createdAt', 'updatedAt', 'heartbeatAt', 'sessionId', 'id']);
const shape = (run) => {
  const o = {};
  // A holder is a process: its token, pid, host and times differ between any two fixtures. What it
  // is (its command) is compared; that a holder is there at all is compared.
  for (const [k, v] of Object.entries(run ?? {})) if (!VOLATILE.has(k)) o[k] = k === 'wait' && v ? { on: v.on, kind: v.kind } : k === 'holder' && v ? { command: v.command, keys: Object.keys(v).sort().join(',') } : k === 'planner' || k === 'place' ? Object.keys(v ?? {}).sort().join(',') : v;
  return JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));
};
const kinds = (r) => r.rec.filter((e) => !['seen', 'notice'].includes(e.kind)).map((e) => (e.kind === 'woke' ? `woke:${(e.events ?? []).join('/')}` : e.kind === 'step-started' ? `step-started:${e.stage}` : e.kind)).join(' > ');
// The break leg passes { comparisonOnly: true } with the takeover that was not stopped, so that it
// goes red on the comparison of the run and of what the runner did, not only on the session.
function assertAsIfNeverTyped(r, base, { comparisonOnly = false } = {}) {
  if (!comparisonOnly) {
    assert(r.t?.exitAt, 'the command did not end when it was stopped');
    assert(r.stopAt && r.firstEnd && r.stopAt < ms(r.firstEnd.at), 'setup: the command was not stopped before the step ended');
    assert(!sessionOpened(r), 'a terminal session opened on the ticket');
  }
  assert(shape(r.runAfter) === shape(base.runAfter), `the run differs from the run where nothing was typed:\n      stopped: ${shape(r.runAfter)}\n      never:   ${shape(base.runAfter)}`);
  assert(kinds(r) === kinds(base), `the runner did not carry on as it would have:\n      stopped: ${kinds(r)}\n      never:   ${kinds(base)}`);
  assert(r.comments.length === base.comments.length, `the ticket has ${r.comments.length} comments, against ${base.comments.length} where nothing was typed`);
}
await clause('PRD-09.R4 clause 3a', 'a takeover waiting this way, stopped with Ctrl-C before the step ends: the run is the same as if the command had never been typed, and the runner carries on as it would have', {
  broken: async () => assertAsIfNeverTyped(waited, none, { comparisonOnly: true }),
  correct: async () => assertAsIfNeverTyped(stopped, none),
});
console.log(`    (stopped after it said: "${stopped.said}"; exit ${stopped.t?.code}${stopped.t?.signal ? ` ${stopped.t.signal}` : ''}, ${stopped.t?.exitAt - stopped.stopAt} ms after Ctrl-C)`);
console.log(`    (what happened after: ${kinds(stopped)})`);
await clause('PRD-09.R4 clause 3b', 'the same, with Ctrl-C pressed at once, before the command has said anything', {
  broken: async () => assertAsIfNeverTyped(waited, none, { comparisonOnly: true }),
  correct: async () => assertAsIfNeverTyped(stoppedNow, none),
});
console.log(`    (stopped at once; it said: "${stoppedNow.said}"; exit ${stoppedNow.t?.code}${stoppedNow.t?.signal ? ` ${stoppedNow.t.signal}` : ''})`);
console.log(`    (what happened after: ${kinds(stoppedNow)})`);

// ---------------------------------------------------------------- clause 4
// A run whose step is running, and no daemon: the daemon is stopped while the step runs (the step
// never answers), and the command is typed after. The break leg types the same command while the
// daemon still runs.
async function noDaemon({ daemonUp }) {
  const fx = fixture({ issues: { fixture: { [N]: {} } } });
  standIn(fx);
  const m = await model({
    runner: (c) => (c.turn === 0 && fx.record(N).filter((e) => e.kind === 'step-started').length < 1 ? act('start_step', { stage: 'execution', instructions: 'probe: do the work', reason: 'probe', skipReason: 'probe: verifier fixture' }) : say()),
    step: () => ({ hang: true }),
  });
  let t = null;
  let typed = false;
  const d = daemon(fx, m, { until: () => (daemonUp ? typed && Date.now() - t.at > 12000 : fx.record(N).some((e) => e.kind === 'step-started')), timeoutMs: 60000, settleMs: 1500 });
  if (daemonUp) {
    while (!fx.record(N).some((e) => e.kind === 'step-started')) await sleep(200);
    await sleep(1500);
    t = typeTakeover(fx, m); typed = true;
  }
  await d;
  const before = fx.run(N);
  if (!daemonUp) t = typeTakeover(fx, m);
  await Promise.race([t.done, sleep(12000)]);
  const exitedIn = t.exitAt ? t.exitAt - t.at : null;
  kill(t);
  await m.stop();
  return { fx, before, t, exitedIn, said: one(t.out), prompt: read(fx, 'takeover-prompt.txt') };
}
const down = await noDaemon({ daemonUp: false });
const up = REAL_ONLY ? null : await noDaemon({ daemonUp: true });
function assertSaysNoWait(r) {
  assert(r.before?.status === 'active', `setup: the run is ${r.before?.status}, not one whose step is running`);
  assert(r.exitedIn !== null && r.exitedIn < 10000, `the command was still waiting ${r.exitedIn ?? '12000+'} ms after it was typed`);
  assert(!sessionOpened(r), 'a terminal session opened');
  assert(/daemon/i.test(r.said) && /(cannot|can't|can not|won't|will not|no step)/i.test(r.said), `it does not say that no daemon runs and so no step can end: "${r.said.slice(0, 300)}"`);
}
await clause('PRD-09.R4 clause 4', 'a run whose step is running, and no daemon running: so no step can end, the command says so and does not wait', {
  broken: async () => assertSaysNoWait(up),
  correct: async () => assertSaysNoWait(down),
});
console.log(`    (no daemon: it said, in ${down.exitedIn} ms, exit ${down.t.code}: "${down.said}")`);
console.log('    (with the daemon running and holding the ledger, clauses 1 to 3 above are the check: every one of them ran with the daemon up)');

for (const r of [waited, oldWaited, otherStep, late, none, stopped, stoppedNow, down, up]) r?.fx.cleanup();
finish('PRD-09.R4');
