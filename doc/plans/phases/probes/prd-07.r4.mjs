// Probe for PRD-07.R4 — Nothing is built on top of an open pull request.
// Stage 7 artifact, authored 2026-10-05 (phase 49) from the register alone. Runs the built
// daemon through _rig.mjs and _steps.mjs (fake forge, fake model, in-process steps). Needs
// `npm run build` first. Nothing reaches GitHub or a real model.
//
// Register clauses (verbatim):
//   1. GIVEN a ticket that needs another ticket's work, and that ticket's pull request is not merged
//      WHEN the first ticket's build would start
//      THEN it does not start, and it waits for the merge
//   2. GIVEN any work branch a run creates
//      WHEN it is created
//      THEN it is cut from the project's default branch, never from another ticket's branch
//   3. GIVEN an initiative whose step tickets 2 and 3 are both open and blocked by nothing open
//      WHEN the project has a free place for each and the planner lets both build
//      THEN both build at the same time
//   4. GIVEN a step ticket blocked by another step ticket that is still open
//      WHEN the daemon reads the project
//      THEN the blocked step does not start
//
// "Needs another ticket's work" is read as the register's hint reads it: a step ticket declares
// what it waits for with GitHub's `blocked by` relation, and a step ticket closes when its pull
// request merges. The fixture is an initiative: map ticket #50 (`timone:map`), step 1 (#51,
// closed: merged), steps 2 and 3 (#52, #53, each blocked by #51), and step 4 (#54, blocked by
// #52 and #53). Each step's runner starts a building step that does not end; the planner (the
// rig's default) lets each ticket build. The merge of a step is played as GitHub plays it: the
// step ticket is closed. What the built daemon was seen to do, and what this reads: it lists the
// steps of a map with `gh issue list --state all --json …,blockedBy,parent`, and picks up a step
// as a run (`pickup fixture#N/1`); a started step is a `step-started` entry in the run record.
//
// Clause 2 is seen where a branch is made: a step session (the built daemon's in-process step)
// cuts the run's work branch and pushes it, either from main or from another ticket's work
// branch that is on the remote and not merged.
//
// The case "the list of steps cannot be read": the same initiative, with GitHub failing the one
// call that lists the steps (`f.failCalls` in _fake-gh.cjs) and every other call answered.
// A transient GitHub failure on one call is the situation; the clauses do not except it.
//
// Break legs. 1 and 4: the same checks on a fixture where step 4 is blocked only by step 1,
// which is closed, so it may start. 2 (refused): the build from just before phase 49, which let
// such a push through. 2 (cut from main): the same check on the branch the older build accepted.
// 3: the build from just before phase 49, where only the first eligible step is taken up.
import { fixture, model, daemon, act, say, sleep, clause, assert, finish } from './_rig.mjs';
import { stepSession, BR } from './_steps.mjs';
import { oldBuild } from './_old-build.mjs';

const REAL_ONLY = process.env.PROBE_REAL_ONLY === '1';
export const BEFORE_PHASE_49 = '55cddb4820ea9965313972e1848fe29a21f5a2f0';
const STEPS = [52, 53, 54];
const START = act('start_step', { stage: 'execution', instructions: 'probe: build this piece', reason: 'probe', skipReason: 'probe: verifier fixture' });
const started = (fx, n) => fx.record(n).filter((e) => e.kind === 'step-started');
const hasRun = (fx, n) => fx.state().runs.some((r) => r.ticket === n);
const snap = (fx) => Object.fromEntries(STEPS.map((n) => [n, { run: hasRun(fx, n), started: started(fx, n).map((e) => e.at), status: fx.run(n)?.status }]));
const line = (s) => STEPS.map((n) => `#${n} ${s[n].started.length ? `building since ${s[n].started[0].slice(11, 19)}` : s[n].run ? `picked up, ${s[n].status}, not building` : 'not picked up'}`).join('; ');

// opts: cli (an older build), places, failSteps (GitHub fails the steps listing), step4BlockedBy,
// merges (close #52 then #53 once both build).
async function initiative({ cli, places = 3, failSteps = false, step4BlockedBy = [52, 53], merges = false, watchMs = 14000 }) {
  const fx = fixture({
    cli,
    projects: { fixture: cli ? {} : { places } },
    issues: { fixture: {
      50: { title: 'The whole request', labels: ['timone', 'timone:map'], body: '- #51\n- #52\n- #53\n- #54\n', createdAt: '2026-09-01T10:00:00.000Z' },
      51: { title: 'Step 1', body: 'Step 1 of 4 of #50', state: 'CLOSED', createdAt: '2026-09-01T10:01:00.000Z' },
      52: { title: 'Step 2', body: 'Step 2 of 4 of #50', createdAt: '2026-09-01T10:02:00.000Z' },
      53: { title: 'Step 3', body: 'Step 3 of 4 of #50', createdAt: '2026-09-01T10:03:00.000Z' },
      54: { title: 'Step 4', body: 'Step 4 of 4 of #50', createdAt: '2026-09-01T10:04:00.000Z' },
    } },
  });
  fx.editForge((f) => {
    for (const n of [51, 52, 53, 54]) f.issues[n].parent = 50;
    f.issues[52].blockedBy = [51];
    f.issues[53].blockedBy = [51];
    f.issues[54].blockedBy = step4BlockedBy;
    if (failSteps) f.failCalls = ['issue list .*--state all'];
  });
  const m = await model({ runner: (c) => (c.turn === 0 && c.brief.split('## The ticket')[0].includes('picked up') ? START : say()), step: () => ({ hang: true }) });
  const out = { fx, snaps: {} };
  let phase = 0, t = 0;
  await daemon(fx, m, {
    timeoutMs: 120000,
    until: () => {
      const both = started(fx, 52).length && started(fx, 53).length;
      if (phase === 0 && (both || (!t && (t = Date.now()) && false) || (t && Date.now() - t > 30000))) { phase = 1; t = Date.now(); }
      if (phase === 1 && Date.now() - t > watchMs) {
        out.snaps.whileOpen = snap(fx);
        if (!merges) return true;
        fx.editForge((f) => { f.issues[52].state = 'CLOSED'; f.issues[52].closedAt = new Date().toISOString(); });
        phase = 2; t = Date.now();
      }
      if (phase === 2 && Date.now() - t > watchMs) {
        out.snaps.oneMerged = snap(fx);
        fx.editForge((f) => { f.issues[53].state = 'CLOSED'; f.issues[53].closedAt = new Date().toISOString(); });
        phase = 3; t = Date.now();
      }
      if (phase === 3 && (started(fx, 54).length || Date.now() - t > 40000)) { out.snaps.bothMerged = snap(fx); return true; }
      return false;
    },
  });
  out.snaps.end = snap(fx);
  await m.stop();
  return out;
}

const [main, failing, unblocked] = await Promise.all([
  initiative({ merges: true }),
  initiative({ failSteps: true }),
  initiative({ step4BlockedBy: [51] }),
]);
const old = REAL_ONLY ? null : await initiative({ cli: oldBuild(BEFORE_PHASE_49), watchMs: 10000 });

// Clause 1: step 4 does not start while #52's or #53's pull request is unmerged, and it starts
// once both are merged.
function step4Waits(s, what) {
  assert(!s[54].started.length, `step 4 (#54) started while ${what}: ${line(s)}`);
}
await clause('PRD-07.R4 clause 1', 'a ticket that needs another ticket\'s work, whose pull request is not merged: its build would start, and it does not start, and it waits for the merge', {
  broken: async () => step4Waits(unblocked.snaps.whileOpen, 'what it needs was merged'),
  correct: async () => {
    step4Waits(main.snaps.whileOpen, 'steps 2 and 3 were both unmerged');
    step4Waits(main.snaps.oneMerged, 'step 3 was still unmerged');
    assert(main.snaps.bothMerged?.[54].started.length, `step 4 did not start once steps 2 and 3 were both merged: ${line(main.snaps.bothMerged ?? main.snaps.end)}`);
  },
});
console.log(`    (steps 2 and 3 unmerged: ${line(main.snaps.whileOpen)})`);
console.log(`    (step 2 merged, step 3 not: ${line(main.snaps.oneMerged)})`);
console.log(`    (both merged: ${line(main.snaps.bothMerged)})`);
await clause('PRD-07.R4 clause 1 (the list of steps cannot be read)', 'the same, while GitHub fails the call that lists the initiative\'s steps: step 4\'s build would start, and it does not start', {
  broken: async () => step4Waits(unblocked.snaps.whileOpen, 'what it needs was merged'),
  correct: async () => step4Waits(failing.snaps.whileOpen, 'steps 2 and 3 were both unmerged and the list of steps could not be read'),
});
console.log(`    (GitHub failing the steps list: ${line(failing.snaps.whileOpen)})`);

// Clause 3: steps 2 and 3 build at the same time.
function bothBuild(s) {
  assert(s[52].started.length && s[53].started.length, `steps 2 and 3 are not both building: ${line(s)}`);
  assert(s[52].status === 'active' && s[53].status === 'active', `steps 2 and 3 are not both running at once: ${line(s)} (${s[52].status}, ${s[53].status})`);
}
await clause('PRD-07.R4 clause 3', 'an initiative whose step tickets 2 and 3 are both open and blocked by nothing open: the project has a free place for each and the planner lets both build, and both build at the same time', {
  broken: async () => bothBuild(old.snaps.whileOpen),
  correct: async () => bothBuild(main.snaps.whileOpen),
});
console.log(`    (${line(main.snaps.whileOpen)})`);
if (old) console.log(`    (break leg, the build before phase 49: ${line(old.snaps.whileOpen)})`);

// Clause 4: the blocked step does not start; it is not even picked up.
function blockedNotStarted(s, what) {
  assert(!s[54].started.length, `step 4 (#54), blocked by ${what}, started: ${line(s)}`);
}
await clause('PRD-07.R4 clause 4', 'a step ticket blocked by another step ticket that is still open: the daemon reads the project, and the blocked step does not start', {
  broken: async () => blockedNotStarted(unblocked.snaps.whileOpen, 'nothing open'),
  correct: async () => { blockedNotStarted(main.snaps.whileOpen, '#52 and #53, both open'); blockedNotStarted(main.snaps.oneMerged, '#53, open'); assert(!main.snaps.whileOpen[54].run, `step 4 was picked up as a run: ${line(main.snaps.whileOpen)}`); },
});
console.log(`    (break-leg fixture, step 4 blocked only by closed #51: ${line(unblocked.snaps.whileOpen)})`);
await clause('PRD-07.R4 clause 4 (the list of steps cannot be read)', 'the same, while GitHub fails the call that lists the initiative\'s steps: the blocked step does not start', {
  broken: async () => blockedNotStarted(unblocked.snaps.whileOpen, 'nothing open'),
  correct: async () => { blockedNotStarted(failing.snaps.whileOpen, '#52 and #53, both open'); assert(!failing.snaps.whileOpen[54].run, `step 4 was picked up as a run while the list of steps could not be read: ${line(failing.snaps.whileOpen)}`); },
});

for (const r of [main, failing, unblocked, old]) r?.fx.cleanup();

// Clause 2: a work branch is cut from the default branch. The step session cuts the run's
// branch (BR, ticket 12's) and pushes it: from main, or from ticket 11's unmerged work branch.
const OTHER = 'timone/11-other-work';
const pushFrom = (base) => (fx) => {
  fx.pushBranch(OTHER, { 'src/other.ts': 'export const other = 1;\n' }, 'ticket 11: its own unmerged work');
  return [`cd projects/fixture && git fetch -q origin && git checkout -q -B ${BR} ${base} && printf 'export const count = 1;\\n' > count.ts && git add -A && git -c user.email=p@example.invalid -c user.name=p commit -qm 'the build' && git push origin HEAD:refs/heads/${BR} 2>&1; echo "PUSH_EXIT=$?"`];
};
const branchRun = async (base, cli) => {
  const r = await stepSession({ cli, commands: pushFrom(base) });
  const remote = r.fx.remoteHead(BR);
  const mainHead = r.fx.remoteHead('main');
  const otherHead = r.fx.remoteHead(OTHER);
  let containsOther = false, baseIsMain = false;
  if (remote) {
    const G = (...a) => { try { return execGit(r.fx, ...a); } catch { return null; } };
    containsOther = G('merge-base', '--is-ancestor', otherHead, remote) !== null;
    baseIsMain = (G('merge-base', remote, mainHead) ?? '').trim() === mainHead && !containsOther;
  }
  const res = { out: r.outs[0] ?? '', remote, containsOther, baseIsMain };
  r.fx.cleanup();
  return res;
};
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const execGit = (fx, ...a) => execFileSync('git', ['--git-dir', path.join(fx.dir, 'remote', 'fixture.git'), ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const [fromOther, fromMain] = await Promise.all([branchRun(`origin/${OTHER}`), branchRun('origin/main')]);
const fromOtherOld = REAL_ONLY ? null : await branchRun(`origin/${OTHER}`, oldBuild(BEFORE_PHASE_49));
function refused(r) {
  assert(!/PUSH_EXIT=0/.test(r.out), `the push of a work branch cut from ${OTHER} went through: ${r.out.replace(/\s+/g, ' ').slice(0, 300)}`);
  assert(!r.remote, `the branch reached the remote: ${r.remote}`);
  assert(r.out.includes(OTHER) || r.out.includes('11'), `the refusal does not name the other ticket's branch: ${r.out.replace(/\s+/g, ' ').slice(0, 400)}`);
}
function cutFromMain(r) {
  assert(/PUSH_EXIT=0/.test(r.out) && r.remote, `the work branch cut from main did not reach the remote: ${r.out.replace(/\s+/g, ' ').slice(0, 300)}`);
  assert(r.baseIsMain && !r.containsOther, `the work branch on the remote is not cut from main (contains ${OTHER}: ${r.containsOther})`);
}
await clause('PRD-07.R4 clause 2 (cut from another ticket\'s branch)', 'a work branch a run creates from another ticket\'s unmerged branch: when it is created (its first push), it is refused, and never reaches the remote', {
  broken: async () => refused(fromOtherOld),
  correct: async () => refused(fromOther),
});
console.log(`    (what the step session saw: ${fromOther.out.replace(/\s+/g, ' ').slice(0, 500)})`);
if (fromOtherOld) console.log(`    (break leg, the build before phase 49: ${fromOtherOld.out.replace(/\s+/g, ' ').slice(0, 200)})`);
await clause('PRD-07.R4 clause 2 (cut from the default branch)', 'a work branch a run creates from the default branch: when it is created, it reaches the remote, cut from main', {
  broken: async () => cutFromMain(fromOtherOld),
  correct: async () => cutFromMain(fromMain),
});
console.log(`    (what the step session saw: ${fromMain.out.replace(/\s+/g, ' ').slice(0, 200)})`);

finish('PRD-07.R4');
