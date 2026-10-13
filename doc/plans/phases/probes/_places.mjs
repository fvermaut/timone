// Verifier instrument (stage 7 artifact), written 2026-10-04 for phase 47's verification.
//
// Places on a project, observed from outside: PRD-07.R1, R2, R3 and R13. Built from the
// register's clauses and from what the built daemon was seen to do in this pass — never from
// its source, its tests or its build notes. Runs the BUILT daemon through _rig.mjs (fake forge,
// fake model, in-process steps). Nothing reaches GitHub or a real model.
//
// What the built app was seen to do, and what these helpers read:
//   - a runner's start_step answered "Refused: No place is free on <project>: run <id> has a
//     step running. …" is recorded in the ticket's run record as a `decision` whose `detail`
//     starts "Refused:";
//   - a started step is recorded as `step-started`;
//   - a run given a freed place is woken with the event "A place on the project is free for
//     this ticket now. …";
//   - the ledger's run carries `place: { priority, openedAt, waitingSince?, givenAt? }`.
// The words are matched loosely (/place/ and /free/), so a rewording does not read as a fault.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fixture, model, daemon, act, say, sleep, OPERATOR, STRANGER } from './_rig.mjs';
import { oldBuild } from './_old-build.mjs';

// main just before phase 47 (the merge-base of timone/201): a run still holds its project
// from its work branch until its pull request ends, refused tickets are queued, and the
// runner's driver wakes every refused run with "The project is free now".
export const BEFORE_PHASE_47 = 'c2daa7c908bd64874a90e8a437deffbd450f9578';
export const before47 = () => oldBuild(BEFORE_PHASE_47);

export const A = 12; // the first ticket, put into the state a clause names
export const B = 13; // the ticket that then asks to start a step
export const tk = (c) => Number((c.brief.match(/fixture #(\d+)/) || [])[1]);
export const whyOf = (c) => c.brief.split('## The ticket')[0];
export const START = (stage = 'execution') => act('start_step', { stage, instructions: 'probe: do the work', reason: 'probe', skipReason: 'probe: verifier fixture' });
export const QUESTION = 'Which colour should the count be?\n\n**What I need from you:** tell me the colour of the count.';

export function addTicket(fx, n, { title = `Ticket ${n}`, createdAt = new Date().toISOString(), labels = ['timone'] } = {}) {
  fx.editForge((f) => { f.issues[n] = { number: n, title, body: 'Show how many to-dos are open.', labels, state: 'OPEN', author: OPERATOR, createdAt, comments: [] }; });
}
export const isPlaceWake = (e) => e.kind === 'woke' && (e.events ?? []).some((x) => /place/i.test(x) && /free/i.test(x) || /project is free/i.test(x));
export const decisions = (fx, t) => fx.record(t).filter((e) => e.kind === 'decision' && e.action === 'start_step');
// ✏ 2026-10-05 (phase 49 verification): since phase 49 a build's first try is refused until the
// planner has decided (PRD-07.R5), and the rig then tries it again once the planner lets it build.
// That refusal is the planner's gate, not a place taken by another ticket, so `refusals` leaves
// it out; `plannerGates` lists it.
export const isPlannerGate = (d) => /The planner has not decided/.test(d ?? '');
export const refusals = (fx, t) => decisions(fx, t).filter((e) => /^Refused/.test(e.detail ?? '') && !isPlannerGate(e.detail));
export const plannerGates = (fx, t) => decisions(fx, t).filter((e) => isPlannerGate(e.detail));
export const started = (fx, t) => fx.record(t).filter((e) => e.kind === 'step-started');
export const runsLine = (fx) => fx.state().runs.map((r) => `${r.id} ${r.status}${r.stage ? ` (${r.stage})` : ''}${r.branch ? ` on ${r.branch}` : ''}${r.pr ? ` pr #${r.pr}` : ''}${r.place?.waitingSince ? ' waiting for a place' : ''}${r.place?.givenAt ? ' given the place' : ''}`).join('; ');

// A stand-in `claude` for a takeover: records how it was started, then stays open until
// the probe writes <dir>/release, as a person's terminal session would.
export function standInTerminal(fx) {
  fs.writeFileSync(path.join(fx.dir, 'bin', 'claude'), [
    '#!/bin/sh',
    `printf '%s\\n' "$@" > "${path.join(fx.dir, 'takeover-prompt.txt')}"`,
    `while [ ! -f "${path.join(fx.dir, 'release')}" ]; do sleep 0.2; done`,
    'exit 0', '',
  ].join('\n'));
  fs.chmodSync(path.join(fx.dir, 'bin', 'claude'), 0o755);
}
export const takeoverPrompt = (fx) => (fs.existsSync(path.join(fx.dir, 'takeover-prompt.txt')) ? fs.readFileSync(path.join(fx.dir, 'takeover-prompt.txt'), 'utf8') : '');
export function startTakeover(fx, m, ticket) {
  const child = spawn(process.execPath, [fx.cliPath, 'takeover', `fixture#${ticket}`, '--manifest', fx.manifest, '--state', fx.statePath], { cwd: fx.dir, env: fx.env(m.port), stdio: ['ignore', 'pipe', 'pipe'] });
  const t = { out: '', code: null };
  child.stdout.on('data', (d) => (t.out += d));
  child.stderr.on('data', (d) => (t.out += d));
  t.done = new Promise((r) => child.on('exit', (c) => { t.code = c; r(); }));
  t.release = async () => { fs.writeFileSync(path.join(fx.dir, 'release'), ''); await Promise.race([t.done, sleep(15000)]); try { child.kill('SIGKILL'); } catch {} };
  return t;
}

// ---------------------------------------------------------------- the first ticket's states
//
// state:
//   'pr-open'       A built (a commit on its work branch), then a delivery step opened its pull
//                   request; A's run is parked, no step running. "Waiting for a merge", "with
//                   only an open pull request".
//   'asks-person'   A built (a commit on its work branch), then its runner posted a question
//                   for a named person; A's run is parked on its own work branch.
//   'step-running'  A's step (stage `aStage`) is running and does not end.
//   'runner-running' A's runner session is open and has not answered yet.
//   'takeover'      A's runner did nothing; then `timone takeover` opened a terminal session on
//                   A, which stays open.
//   'idle'          A's runner did nothing: no branch, no step, no pull request.
// Then ticket B is put on the forge, and its runner starts a step when it is picked up.
//
// Returns what B's runner was answered, whether B's step started, and the ledger at that time.
// ✏ 2026-10-05 (phase 49 verification): `places` sets the project's number of places in
// timone.yaml. It defaults to 1, the number these fixtures were written for; it is not written
// for an older build (`cli`), which had one place and no such key.
export async function secondAsks({ state, aStage = 'execution', cli, places = 1, timeoutMs = 60000 }) {
  const fx = fixture({ projects: { fixture: cli ? {} : { places } }, issues: { fixture: { [A]: { title: 'First ticket', createdAt: '2026-09-01T10:00:00.000Z' } } }, cli });
  if (state === 'takeover') standInTerminal(fx);
  let prOf = null;
  const m = await model({
    runner: (c) => {
      const t = tk(c), w = whyOf(c);
      if (t === B) return c.turn === 0 && w.includes('picked up') ? START('execution') : say();
      if (c.turn > 0) return say();
      if (state === 'runner-running') return { hang: true };
      if (state === 'idle' || state === 'takeover') return say();
      if (w.includes('picked up')) return START(state === 'step-running' ? aStage : 'execution');
      if (state === 'pr-open' && /step building ended/i.test(w)) return START('delivery');
      if (state === 'asks-person' && /step building ended/i.test(w)) return act('post', { where: 'ticket', body: QUESTION, reason: 'probe: a question for a named person' });
      return say();
    },
    step: (c) => {
      if (c.turn > 0) return say('done');
      const a = fx.state().runs.find((r) => r.ticket === A && r.status === 'active');
      if (a && state === 'step-running') return { hang: true };
      if (a && a.stage === 'execution' && a.branch) fx.pushBranch(a.branch, { 'src/count.ts': 'export const count = 1;\n' }, 'the build');
      if (a && a.stage === 'delivery' && a.branch) {
        prOf = fx.editForge((f) => { const num = f.nextNumber++; f.prs[num] = { number: num, title: 'Add a count', body: `For #${A}.`, head: a.branch, base: 'main', state: 'OPEN', createdAt: new Date().toISOString(), comments: [] }; return num; });
      }
      const b = fx.state().runs.find((r) => r.ticket === B && r.status === 'active');
      if (b) return { hang: true };
      return say('done');
    },
  });
  const aReady = () => {
    const r = fx.run(A);
    const quiet = ['runner-ended', 'seen'].includes(fx.record(A).at(-1)?.kind);
    if (state === 'pr-open') return prOf && r?.status === 'parked' && quiet && fx.record(A).some((e) => e.kind === 'step-ended' && e.stage === 'delivery') && fx.record(A).filter((e) => e.kind === 'runner-ended').length >= 3;
    if (state === 'asks-person') return r?.status === 'parked' && fx.issue(A).comments.some((x) => x.body.includes('Which colour')) && quiet;
    if (state === 'step-running') return started(fx, A).length > 0;
    if (state === 'runner-running') return m.runner().some((q) => tk(q) === A);
    return fx.record(A).some((e) => e.kind === 'runner-ended');
  };
  let added = false, atAsk = null, take = null;
  const addB = () => { added = true; addTicket(fx, B, { title: 'Second ticket', createdAt: '2026-09-02T10:00:00.000Z' }); };
  if (state === 'takeover') {
    await daemon(fx, m, { until: aReady, timeoutMs: 20000, settleMs: 500 });
    const d = daemon(fx, m, { until: () => refusals(fx, B).length > 0 || started(fx, B).length > 0 || decisions(fx, B).some((e) => !isPlannerGate(e.detail)), timeoutMs, settleMs: 1500 });
    await sleep(1500);
    take = startTakeover(fx, m, A);
    { const t0 = Date.now(); while (!takeoverPrompt(fx) && Date.now() - t0 < 20000) await sleep(200); }
    atAsk = { runs: runsLine(fx), takeoverOpen: Boolean(takeoverPrompt(fx)) };
    addB();
    await d;
  } else {
    await daemon(fx, m, {
      until: () => {
        if (!added && aReady()) { atAsk = { runs: runsLine(fx), aRun: fx.run(A) }; addB(); }
        return added && (refusals(fx, B).length > 0 || started(fx, B).length > 0 || decisions(fx, B).some((e) => !isPlannerGate(e.detail)));
      },
      timeoutMs, settleMs: 1500,
    });
  }
  if (take) await take.release();
  await m.stop();
  return {
    fx, m, state, aStage, atAsk, pr: prOf,
    bDecisions: decisions(fx, B).map((e) => e.detail ?? 'accepted'),
    bRefused: refusals(fx, B).map((e) => e.detail),
    bStarted: started(fx, B).length > 0,
    reachedA: Boolean(atAsk),
    added,
  };
}

// Asserts B's step was not refused because of A, and started.
export function assertNotRefused(r, assert) {
  assert(r.reachedA, `setup: the first ticket never reached the state "${r.state}" (${runsLine(r.fx)})`);
  assert(r.added, 'setup: the second ticket was never put on the forge');
  assert(r.bRefused.length === 0, `the second ticket's step was refused: "${r.bRefused[0]}"`);
  assert(r.bStarted, `the second ticket's step did not start (its runner was answered: ${JSON.stringify(r.bDecisions)}; runs: ${runsLine(r.fx)})`);
}
export const said = (r) => `the first ticket at that time: ${r.atAsk?.runs ?? 'never reached'}; the second ticket's runner was answered: ${r.bDecisions.length ? r.bDecisions.map((d) => `"${d}"`).join(', ') : 'nothing (it was never woken to ask)'}; its step started: ${r.bStarted ? 'yes' : 'no'}`;

// ---------------------------------------------------------------- a freed place
//
// Ticket 20 starts a step that ends after `holdMs`, and its runner then does nothing. While it
// runs, tickets arrive and are refused: `waiters` = [{ n, createdAt, priority }]. givenDoes
// says what the runner of the ticket given the place does: 'start' (a step that does not end)
// or 'nothing'. Returns, per ticket, the time of every place wake, every refusal, every
// started step.
// ✏ 2026-10-05 (phase 49 verification): `places` as in secondAsks, 1 by default. holdMs grew from
// 9 s to 20 s: each waiting ticket is now refused by the planner's gate first, and the planner
// decides one ticket per cycle, so the waiters reach "refused for want of a place" later.
export async function freedPlace({ waiters, givenDoes = 'start', cli, places = 1, holdMs = cli ? 9000 : 20000, timeoutMs = 90000 }) {
  const fx = fixture({ projects: { fixture: cli ? {} : { places } }, issues: { fixture: { 20: { title: 'The ticket building', createdAt: '2026-09-20T10:00:00.000Z' } } }, cli });
  const m = await model({
    runner: (c) => {
      if (c.turn > 0) return say();
      const t = tk(c), w = whyOf(c);
      if (t === 20) return w.includes('picked up') ? START() : say();
      if (w.includes('picked up')) return START();
      return givenDoes === 'start' ? START() : say('probe: nothing to do now');
    },
    step: (c) => {
      const a = fx.state().runs.find((r) => r.ticket === 20 && r.status === 'active');
      return a && c.turn === 0 && !waitersStarted() ? { delayMs: holdMs, blocks: [{ type: 'text', text: 'done' }] } : { hang: true };
    },
  });
  const nums = waiters.map((w) => w.n);
  const waitersStarted = () => nums.some((n) => started(fx, n).length > 0);
  let added = false, refusedAt = null;
  const allRefused = () => nums.every((n) => refusals(fx, n).length > 0);
  await daemon(fx, m, {
    until: () => {
      if (!added && started(fx, 20).length) { added = true; for (const w of waiters) addTicket(fx, w.n, { title: `Waiting ${w.n}`, createdAt: w.createdAt, labels: w.priority ? ['timone', 'priority:high'] : ['timone'] }); }
      if (added && !refusedAt && allRefused()) refusedAt = runsLine(fx);
      const stepEnded = fx.record(20).some((e) => e.kind === 'step-ended');
      if (!stepEnded) return false;
      const tells = nums.filter((n) => fx.record(n).some(isPlaceWake));
      if (givenDoes === 'start') return waitersStarted() && Date.now() - (fx._firstStart ??= Date.now()) > 6000;
      return tells.length >= Math.min(2, nums.length) && Date.now() - (fx._secondTell ??= Date.now()) > 3000;
    },
    timeoutMs, settleMs: 1000,
  });
  await m.stop();
  const per = {};
  for (const n of [20, ...nums]) {
    const rec = fx.record(n);
    per[n] = {
      tells: rec.filter(isPlaceWake).map((e) => e.at),
      tellWords: rec.filter(isPlaceWake).flatMap((e) => e.events),
      refused: refusals(fx, n).map((e) => ({ at: e.at, detail: e.detail })),
      started: started(fx, n).map((e) => e.at),
      decisions: decisions(fx, n).map((e) => ({ at: e.at, detail: e.detail ?? 'accepted' })),
    };
  }
  const stepEndedAt = fx.record(20).find((e) => e.kind === 'step-ended')?.at;
  return { fx, per, nums, stepEndedAt, refusedAt, runs: runsLine(fx) };
}
// The ticket told first after the first step ended.
export function firstTold(r) {
  const told = r.nums.map((n) => ({ n, at: r.per[n].tells.find((t) => t >= r.stepEndedAt) })).filter((x) => x.at).sort((a, b) => (a.at < b.at ? -1 : 1));
  return told;
}
export { OPERATOR, STRANGER };

// ---------------------------------------------------------------- how many places
//
// ✏ 2026-10-05 (phase 49 verification), for PRD-07.R2 clauses 1 to 4 with more than one place.
// `count` tickets (31, 32, …, oldest first) are picked up together; each one's runner starts a
// building step that does not end. `places` is written into timone.yaml, or left out when
// undefined. Runs until every ticket's step has started or been refused for want of a place,
// then a few seconds more. Returns, per ticket, whether its step started, its refusals, its run
// in the ledger at the end, and the number of steps running at the end.
export async function manyAsk({ places, count, timeoutMs = 120000 }) {
  const nums = Array.from({ length: count }, (_, i) => 31 + i);
  const issues = Object.fromEntries(nums.map((n, i) => [n, { title: `Ticket ${n}`, createdAt: `2026-09-${String(10 + i).padStart(2, '0')}T10:00:00.000Z` }]));
  const fx = fixture({ projects: { fixture: places === undefined ? {} : { places } }, issues: { fixture: issues } });
  const m = await model({
    runner: (c) => (c.turn === 0 && whyOf(c).includes('picked up') ? START('execution') : say()),
    step: () => ({ hang: true }),
  });
  await daemon(fx, m, {
    until: () => nums.every((n) => started(fx, n).length > 0 || refusals(fx, n).length > 0),
    timeoutMs, settleMs: 4000,
  });
  await m.stop();
  const per = {};
  for (const n of nums) per[n] = { started: started(fx, n).map((e) => e.at), refused: refusals(fx, n).map((e) => e.detail), run: fx.run(n), stepEnded: fx.record(n).some((e) => e.kind === 'step-ended') };
  const running = nums.filter((n) => per[n].run?.status === 'active' && per[n].started.length && !per[n].stepEnded);
  return { fx, nums, per, running, places, runs: runsLine(fx) };
}

// ---------------------------------------------------------------- a runner session after a step
//
// ✏ 2026-10-05 (phase 49 verification), for PRD-07.R2 clause 6: the runner session that a step's
// end wakes. Ticket 12's building step ends at once; its runner, woken by that end, is put on the
// forge's second ticket (13) and then does not answer, so its session stays open. Ticket 13's
// runner starts a building step when it is picked up (the rig tries it again once the planner
// lets it). `places` as in secondAsks. Returns ticket 13's refusals, whether its step started,
// and whether ticket 12's runner session was still open when ticket 13 was answered.
// The older build it is run against for a break leg (this branch's first fix commit) reads
// `places`, so the line is written for it too.
export async function afterStepAsks({ cli, places = 1, timeoutMs = 60000 }) {
  const fx = fixture({ projects: { fixture: { places } }, issues: { fixture: { [A]: { title: 'First ticket', createdAt: '2026-09-01T10:00:00.000Z' } } }, cli });
  let added = false;
  const m = await model({
    runner: (c) => {
      if (c.turn > 0) return say();
      const t = tk(c), w = whyOf(c);
      if (t === B) return w.includes('picked up') ? START('execution') : say();
      if (w.includes('picked up')) return START('execution');
      if (/step building ended/i.test(w)) { if (!added) { added = true; addTicket(fx, B, { title: 'Second ticket', createdAt: '2026-09-02T10:00:00.000Z' }); } return { hang: true }; }
      return say();
    },
    step: () => (fx.state().runs.find((r) => r.ticket === A && r.status === 'active') ? say('done') : { hang: true }),
  });
  await daemon(fx, m, { until: () => refusals(fx, B).length > 0 || started(fx, B).length > 0, timeoutMs, settleMs: 1000 });
  const answeredAt = (refusals(fx, B)[0] ?? started(fx, B)[0])?.at;
  const aEnded = fx.record(A).find((e) => e.kind === 'step-ended')?.at;
  const aRunnerOpen = Boolean(answeredAt && aEnded && !fx.record(A).some((e) => e.kind === 'runner-ended' && e.at > aEnded && e.at < answeredAt));
  await m.stop();
  return { fx, bRefused: refusals(fx, B).map((e) => e.detail), bStarted: started(fx, B).length > 0, aRunnerOpen, aStepEnded: aEnded, answeredAt, runs: runsLine(fx), aPlace: fx.run(A)?.place };
}

// ---------------------------------------------------------------- recording an approval with every place taken
//
// ✏ 2026-10-13 (phase 60 verification), for PRD-07.R2 clause 3 and PRD-07.R3 clause 3, on the step
// that writes a named person's approval into the requirements. One place (`places` in timone.yaml).
// Ticket 13 (created 2026-09-01, the oldest) writes its requirements while the place is free; a
// draft requirements file is then pushed to its branch, between two daemon runs. Ticket 12
// (created 2026-09-20) is put on the forge and starts a step that ends after `holdMs`; ticket 14
// (created 2026-09-05) is put on the forge once that step runs, asks to start a step and is refused. While
// ticket 12's step runs, the operator writes "looks right" on ticket 13, and ticket 13's runner asks
// to record the approval citing that comment. When it is woken with a place given, it asks again.
// The session that writes the approval is recognised by its instructions, "set the PRD's status to
// Active" (what PRD-05.R7's probe was seen to receive); it does not end, so ticket 13 keeps the
// place it was given. Ticket 14's runner starts nothing when woken later, so a place given to it
// would show as a wake only.
//
// What the built app was seen to do, on this branch, and what these helpers read: a refused try is
// a `decision` with `action: 'record_approval'` whose `detail` starts "Refused:"; the ledger's run
// then carries `place.waitingSince`; a place given is a wake whose event says a place is free.
// On the build from just before phase 60 (main at 534b4dd), the try was refused with "The approval
// is written down, but the step that writes it into the file did not start: No place is free …",
// the run carried no `waitingSince`, and the freed place went to ticket 14.
export const BEFORE_PHASE_60 = '534b4dd7e558a19c99af0a24424fe046869ab84c';
export const before60 = () => oldBuild(BEFORE_PHASE_60);
export const HOLDER = 12, APPROVER = 13, OTHER = 14;
const PRD_DRAFT = '# PRD-01: A count of open to-dos\n\n> **Status:** Draft\n\nShow how many to-dos are open.\n';
const isWriter = (s) => /set the PRD's status to Active/.test(s.brief);
export const approvalDecisions = (fx, t = APPROVER) => fx.record(t).filter((e) => e.kind === 'decision' && e.action === 'record_approval');
export async function approvalAsks({ cli, holdMs = 25000, timeoutMs = 150000 }) {
  const fx = fixture({ projects: { fixture: { places: 1 } }, issues: { fixture: { [APPROVER]: { title: 'Requirements to approve', createdAt: '2026-09-01T10:00:00.000Z' } } }, cli });
  const T = {};
  const m = await model({
    runner: (c) => {
      if (c.turn > 0) return say();
      const t = tk(c), w = whyOf(c);
      if (t === APPROVER) {
        if (w.includes('picked up')) return act('start_step', { stage: 'requirements', instructions: 'write it down', reason: 'probe', skipReason: 'probe: the request is clear' });
        if (w.includes('"looks right"') || (/place/i.test(w) && /free/i.test(w))) return act('record_approval', { what: 'requirements', commentAt: T.ok, reason: 'probe: the operator approved' });
        return say();
      }
      if (t === HOLDER || t === OTHER) return w.includes('picked up') ? act('start_step', { stage: 'planning', instructions: 'probe: plan it', reason: 'probe', skipReason: 'probe' }) : say();
      return say();
    },
    step: (c) => {
      if (c.turn > 0) return say('done');
      if (isWriter(c)) return { hang: true };
      const holder = fx.state().runs.find((r) => r.ticket === HOLDER && r.status === 'active');
      const approver = fx.state().runs.find((r) => r.ticket === APPROVER && r.status === 'active');
      if (holder && !approver && !T.holderStep) { T.holderStep = new Date().toISOString(); return { delayMs: holdMs, blocks: [{ type: 'text', text: 'done' }] }; }
      if (approver && !T.ok) return say('done');
      return { hang: true };
    },
  });
  // The approver's requirements, written while the place is free.
  await daemon(fx, m, { until: () => fx.record(APPROVER).some((e) => e.kind === 'step-ended') && ['runner-ended', 'seen'].includes(fx.record(APPROVER).at(-1)?.kind), timeoutMs: 40000, settleMs: 1500 });
  const branch = fx.run(APPROVER)?.branch;
  if (branch) fx.pushBranch(branch, { 'doc/specs/prd/prd-01-count.md': PRD_DRAFT }, 'requirements');
  addTicket(fx, HOLDER, { title: 'The ticket building', createdAt: '2026-09-20T10:00:00.000Z' });
  let atRefusal = null;
  await daemon(fx, m, {
    until: () => {
      // The other ticket is put on the forge only once the holder's step runs, so the two are never
      // picked up in the same cycle, where either could take the place first.
      if (!T.otherAdded && started(fx, HOLDER).length) { T.otherAdded = true; addTicket(fx, OTHER, { title: 'Another waiting ticket', createdAt: '2026-09-05T10:00:00.000Z' }); }
      if (!T.ok && started(fx, HOLDER).length && decisions(fx, OTHER).some((d) => /^Refused/.test(d.detail ?? ''))) {
        T.ok = fx.comment(APPROVER, OPERATOR, 'looks right');
        T.holderRunning = runsLine(fx);
      }
      if (!atRefusal && approvalDecisions(fx).length) atRefusal = { runs: runsLine(fx), run: fx.run(APPROVER), writers: m.steps().filter(isWriter).length };
      const holderEnded = fx.record(HOLDER).some((e) => e.kind === 'step-ended');
      const done = m.steps().some(isWriter) || approvalDecisions(fx).length >= 2;
      if (!holderEnded) return false;
      return Date.now() - (fx._afterEnd ??= Date.now()) > (done ? 6000 : 20000);
    },
    timeoutMs, settleMs: 1500,
  });
  await m.stop();
  const holderEndedAt = fx.record(HOLDER).find((e) => e.kind === 'step-ended')?.at;
  const per = {};
  for (const n of [APPROVER, OTHER]) {
    per[n] = {
      tells: fx.record(n).filter(isPlaceWake).map((e) => e.at),
      approvals: approvalDecisions(fx, n).map((e) => ({ at: e.at, detail: e.detail ?? 'accepted' })),
      steps: decisions(fx, n).map((e) => ({ at: e.at, detail: e.detail ?? 'accepted' })),
    };
  }
  const writers = m.steps().filter(isWriter).map((s) => s.at);
  return {
    fx, T, atRefusal, holderEndedAt, per, writers,
    approvalsRecorded: fx.record(APPROVER).filter((e) => e.kind === 'approval').map((e) => e.at),
    runs: runsLine(fx),
  };
}

// ---------------------------------------------------------------- sorted while another ticket has the place
//
// ✏ 2026-10-13 (phase 60 verification), for PRD-05.R1 clause 1. One place. Ticket 13, a feature,
// is picked up and its runner starts sorting, which takes the place for `sortMs`. Ticket 12 is put
// on the forge then, asks to start a step, and is refused: it waits for its turn. When sorting
// ends, the place is given to ticket 12, whose runner starts a step that ends after `holdMs`. Ticket
// 13's runner, woken by the end of sorting, has never asked for a place and been refused, so it is
// not in line. It starts the interview ("clarification"), the next step of the default order; and
// again whenever it is woken with a place given. Returns what ticket 13's runner was told when it
// woke after sorting, the ledger's view of ticket 13 at that moment, and what became of the
// interview it chose.
// On the build from just before phase 60 the brief said, at that wake, "The project's place: given
// to fixture#12/1. This ticket waits for its turn." while the ticket was not in line.
export async function sortedWhileTaken({ cli, sortMs = 8000, holdMs = 10000, timeoutMs = 120000 }) {
  const fx = fixture({ projects: { fixture: { places: 1 } }, issues: { fixture: { [B]: { title: 'Add a count of open to-dos', createdAt: '2026-09-02T10:00:00.000Z' } } }, cli });
  let addedA = false, atSorted = null;
  const m = await model({
    runner: (c) => {
      if (c.turn > 0) return say();
      const t = tk(c), w = whyOf(c);
      if (t === B) {
        if (w.includes('picked up')) return act('start_step', { stage: 'triage', instructions: 'sort it', reason: 'probe' });
        if (w.includes('sorting the request ended')) {
          atSorted ??= { brief: c.brief, run: fx.run(B), runs: runsLine(fx) };
          return act('start_step', { stage: 'clarification', instructions: 'ask what is needed', reason: 'probe: the next step of the default order' });
        }
        if (/place/i.test(w) && /free/i.test(w)) return act('start_step', { stage: 'clarification', instructions: 'ask what is needed', reason: 'probe: the next step of the default order' });
        return say();
      }
      if (t === A) return w.includes('picked up') || (/place/i.test(w) && /free/i.test(w)) ? act('start_step', { stage: 'planning', instructions: 'probe: plan it', reason: 'probe', skipReason: 'probe' }) : say();
      return say();
    },
    step: (c) => {
      if (c.turn > 0) return say('done');
      const stage = (c.brief.match(/Timone-Stage: (\S+)/) || [])[1];
      if (stage === 'triage') return { delayMs: sortMs, blocks: [{ type: 'text', text: 'sorted: a feature' }] };
      if (stage === 'planning') return { delayMs: holdMs, blocks: [{ type: 'text', text: 'done' }] };
      return { hang: true };
    },
  });
  let afterRefusal = null;
  await daemon(fx, m, {
    until: () => {
      if (!addedA && started(fx, B).length) { addedA = true; addTicket(fx, A, { title: 'The other ticket', createdAt: '2026-09-01T10:00:00.000Z' }); }
      if (!afterRefusal && atSorted && refusals(fx, B).length) afterRefusal = { run: fx.run(B), runs: runsLine(fx) };
      return fx.record(B).some((e) => e.kind === 'step-started' && e.stage === 'clarification');
    },
    timeoutMs, settleMs: 1500,
  });
  await m.stop();
  const interview = decisions(fx, B).filter((e) => atSorted && e.at >= fx.record(B).find((x) => x.kind === 'step-ended' && x.stage === 'triage')?.at);
  return {
    fx, atSorted,
    placeLine: (atSorted?.brief.split('\n').find((l) => /The project's place/i.test(l)) ?? '').trim(),
    interviewTries: interview.map((e) => ({ at: e.at, detail: e.detail ?? 'accepted' })),
    interviewStarted: fx.record(B).filter((e) => e.kind === 'step-started' && e.stage === 'clarification').map((e) => e.at),
    tells: fx.record(B).filter(isPlaceWake).map((e) => e.at),
    otherStarted: started(fx, A).map((e) => e.at),
    runs: runsLine(fx),
    afterRefusal,
  };
}
