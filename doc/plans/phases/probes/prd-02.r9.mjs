// Probe for PRD-02.R9 — Status visibility.
// Stage 7 artifact, authored 2026-10-06 (phase 54 verification, timone#186) from the register
// alone. Runs the built daemon and the built `timone status` through _rig.mjs (fake forge, fake
// model). Needs `npm run build` first. Nothing reaches GitHub or a real model.
//
// The register's criterion, verbatim:
//   `timone status` lists every managed project with its active ticket, current stage, and any
//   gate waiting for human input, in one glance.
//
// It is one sentence. This probe labels its parts in the register's own words:
//   part 1 — lists every managed project
//   part 2 — with its active ticket, current stage
//   part 3 — and any gate waiting for human input (a run the runner parked with a question)
//   part 4 — a gate waiting for human input is the only thing named as waiting: a finished run
//            is not a gate waiting for human input, so it is never named, even when the
//            initiative its ticket belongs to has steps left that cannot start
//   part 5 — in one glance: with a waiting run and finished runs side by side, the closing line
//            names exactly the waiting ticket, once
//
// How the states are made, as the built app was seen to make them: an initiative is a map ticket
// (`timone:map`) whose step tickets are its children; step 2 is blocked by step 1 and step 3 by
// step 2. The runner ends step 1's run at once (`end_run`, ticket left open), so the ledger holds
// a `done` run and the daemon's picture of an initiative with three steps, none done, and none
// that can start. A question is a runner `post` whose last line asks something; the run is then
// `parked` with that ask as its wait. An active run is a step that does not end.
//
// Break legs.
//   1: the same check against the real output with one project's line taken out.
//   2: the same check against `timone status` on the same fixture before the daemon ran.
//   3: the same ledger with the parked run rewritten to `done` (its wait removed), run through
//      the built `timone status`; the ticket must then not be named.
//   4 and 5: the same ledger through the build of main just before phase 54 (the merge-base of
//      timone/186), which named the finished run #51.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fixture, model, daemon, act, say, clause, assert, finish } from './_rig.mjs';
import { statusAfterQuestion } from './_questions.mjs';
import { oldBuild } from './_old-build.mjs';

const REAL_ONLY = process.env.PROBE_REAL_ONLY === '1';
export const BEFORE_PHASE_54 = 'becd1968b2306bd8e12f94e347608e849cb42482';
const whyOf = (c) => c.brief.split('## The ticket')[0];
const closing = (out) => out.trim().split('\n').filter(Boolean).at(-1) ?? '';
const named = (line) => [...line.matchAll(/#(\d+)/g)].map((m) => Number(m[1]));

function status(fx, statePath, cli) {
  try {
    return execFileSync(process.execPath, [cli ?? fx.cliPath, 'status', '--manifest', fx.manifest, '--state', statePath], { cwd: fx.dir, env: fx.env(), stdio: ['ignore', 'pipe', 'pipe'] }).toString();
  } catch (e) {
    return `${(e.stdout ?? '').toString()}${(e.stderr ?? '').toString()}`;
  }
}

// An initiative with a finished step-1 run and steps left that cannot start.
async function finishedInitiative() {
  const fx = fixture({
    projects: { fixture: { places: 3 } },
    issues: { fixture: {
      50: { title: 'The whole request', labels: ['timone', 'timone:map'], body: '- #51\n- #52\n- #53\n', createdAt: '2026-09-01T10:00:00.000Z' },
      51: { title: 'Step 1', body: 'Step 1 of 3 of #50', createdAt: '2026-09-01T10:01:00.000Z' },
      52: { title: 'Step 2', body: 'Step 2 of 3 of #50', createdAt: '2026-09-01T10:02:00.000Z' },
      53: { title: 'Step 3', body: 'Step 3 of 3 of #50', createdAt: '2026-09-01T10:03:00.000Z' },
    } },
  });
  fx.editForge((f) => { for (const n of [51, 52, 53]) f.issues[n].parent = 50; f.issues[52].blockedBy = [51]; f.issues[53].blockedBy = [52]; });
  const m = await model({ runner: (c) => (c.turn === 0 && /picked up/.test(whyOf(c)) ? act('end_run', { reason: 'probe: the work is done', closeTicket: false }) : say()), step: () => say('done') });
  await daemon(fx, m, { timeoutMs: 40000, until: (f) => {
    const s = f.state();
    return s.runs.some((r) => r.ticket === 51 && r.status === 'done') && Object.values(s.initiatives ?? {}).some((i) => i.initiative === 50);
  }, settleMs: 3000 });
  await m.stop();
  return fx;
}

// Two projects; one has a step building that does not end.
async function activeTwoProjects() {
  const fx = fixture({ projects: { alpha: {}, beta: {} }, issues: { alpha: { 7: {} } } });
  const before = fx.cli(['status', '--manifest', fx.manifest, '--state', fx.statePath]);
  const m = await model({ runner: (c) => (c.turn === 0 && /picked up/.test(whyOf(c)) ? act('start_step', { stage: 'execution', instructions: 'probe: build', reason: 'probe', skipReason: 'probe: verifier fixture' }) : say()), step: () => ({ hang: true }) });
  let during = null;
  await daemon(fx, m, { timeoutMs: 60000, until: (f) => {
    if (f.record(7).some((e) => e.kind === 'step-started')) { during = f.cli(['status', '--manifest', f.manifest, '--state', f.statePath]); return true; }
    return false;
  } });
  await m.stop();
  return { fx, before: `${before.out}${before.err}`, during: during ? `${during.out}${during.err}` : '(the step never started)' };
}

const [fin, act2, q] = await Promise.all([
  finishedInitiative(),
  activeTwoProjects(),
  statusAfterQuestion({ ask: 'say which colour you want, red or blue.' }),
]);
const old = REAL_ONLY ? null : oldBuild(BEFORE_PHASE_54);

// A ledger with the parked question run beside the finished initiative's runs.
const finState = fin.state();
const qState = q.fx.state();
const together = path.join(fin.dir, 'together.json');
fs.writeFileSync(together, JSON.stringify({ ...finState, runs: [...finState.runs, ...qState.runs.map((r) => ({ ...r }))] }, null, 1));
// The parked run rewritten to done, for part 3's break leg.
const doneInstead = path.join(q.fx.dir, 'done-instead.json');
fs.writeFileSync(doneInstead, JSON.stringify({ ...qState, runs: qState.runs.map((r) => { const { wait, ...rest } = r; return r.ticket === 12 ? { ...rest, status: 'done' } : r; }) }, null, 1));

console.log('--- observed: timone status, two projects, one building\n' + act2.during);
console.log('--- observed: timone status, a run parked with a question\n' + q.status);
console.log('--- observed: timone status, a finished step run, its initiative with steps left that cannot start');
console.log('    ledger runs: ' + finState.runs.map((r) => `${r.id} ${r.status}`).join(', ') + '; initiatives: ' + JSON.stringify(Object.values(finState.initiatives ?? {}).map(({ initiative, steps, done }) => ({ initiative, steps, done }))));
const finOut = status(fin, fin.statePath);
console.log(finOut);
const togetherOut = status(fin, together);
console.log('--- observed: timone status, the parked question run and the finished runs in one ledger\n' + togetherOut);

const PROJECTS = ['alpha', 'beta'];
const listsEvery = (out) => {
  const lines = out.split('\n');
  for (const p of PROJECTS) assert(lines.some((l) => l.startsWith(`${p} `)), `no line for project ${p}:\n${out}`);
};
await clause('PRD-02.R9 part 1', 'lists every managed project', {
  broken: () => listsEvery(act2.during.split('\n').filter((l) => !l.startsWith('beta ')).join('\n')),
  correct: () => listsEvery(act2.during),
});

const activeShown = (out) => {
  const line = out.split('\n').find((l) => l.startsWith('alpha ')) ?? '';
  assert(/#7\b/.test(line), `alpha's line does not name its active ticket #7: "${line}"`);
  assert(/\((building|execution)\)/.test(line), `alpha's line does not name the current stage: "${line}"`);
};
await clause('PRD-02.R9 part 2', 'with its active ticket, current stage', {
  broken: () => activeShown(act2.before),
  correct: () => activeShown(act2.during),
});

const waitingNamed = (out) => {
  const last = closing(out);
  assert(/What I need from you:/.test(last), `the last line is not the closing line: "${last}"`);
  assert(named(last).includes(12), `the closing line does not name #12, which waits on a question: "${last}"`);
  const line = out.split('\n').find((l) => l.startsWith('fixture ')) ?? '';
  assert(/#12\b/.test(line) && /waiting/.test(line), `the project's line does not show #12 waiting: "${line}"`);
};
await clause('PRD-02.R9 part 3', 'and any gate waiting for human input — a run parked with a question is named, on its project\'s line and in the closing line', {
  broken: () => waitingNamed(status(q.fx, doneInstead)),
  correct: () => waitingNamed(q.status),
});

const noFinishedNamed = (out) => {
  const last = closing(out);
  assert(/What I need from you:/.test(last), `the last line is not the closing line: "${last}"`);
  const doneTickets = finState.runs.filter((r) => r.status === 'done').map((r) => r.ticket);
  assert(doneTickets.length > 0, 'the fixture holds no finished run, so it proves nothing');
  const wrong = named(last).filter((n) => doneTickets.includes(n));
  assert(wrong.length === 0, `the closing line names finished run(s) #${wrong.join(', #')}: "${last}"`);
  assert(/nothing/i.test(last), `the closing line does not say nothing is waiting: "${last}"`);
};
await clause('PRD-02.R9 part 4', 'a finished run is not a gate waiting for human input: it is never named, even when its initiative has steps left that cannot start', {
  broken: () => noFinishedNamed(status(fin, fin.statePath, old)),
  correct: () => noFinishedNamed(finOut),
});

const exactlyWaiting = (out) => {
  const last = closing(out);
  const ns = named(last);
  assert(ns.length === 1 && ns[0] === 12, `the closing line should name exactly #12, once; it names [${ns.join(', ')}]: "${last}"`);
};
await clause('PRD-02.R9 part 5', 'in one glance: with a waiting run and finished runs side by side, the closing line names exactly the waiting ticket, once', {
  broken: () => exactlyWaiting(status(fin, together, old)),
  correct: () => exactlyWaiting(togetherOut),
});

for (const f of [fin, act2.fx, q.fx]) try { f.cleanup?.(); } catch {}
finish('PRD-02.R9');
