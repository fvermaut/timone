// Probe for PRD-07.R2 — Each project has a number of places, 2 unless `timone.yaml` says otherwise.
// Stage 7 artifact, authored 2026-10-04 (phase 47) from the register alone. Runs the built
// daemon through _places.mjs and _rig.mjs. Needs `npm run build` first.
//
// Register clauses (verbatim):
//   1. GIVEN a project whose entry in `timone.yaml` sets no limit WHEN its places are counted THEN it has 2
//   2. GIVEN a project whose entry in `timone.yaml` sets a limit of N WHEN its places are counted THEN it has N
//   3. GIVEN a project with N places and steps of N different tickets running, whatever those steps are
//      WHEN a step of another ticket of the project asks to start
//      THEN it does not start, and the ticket waits for its turn
//   4. GIVEN a project with fewer running steps than places
//      WHEN a step of a ticket of the project asks to start, and nothing else stops it
//      THEN it starts, while the other steps keep running
//   5. GIVEN a ticket waiting for a person, for a merge, or for its turn, or with only an open pull request
//      WHEN the project's places are counted
//      THEN that ticket takes none
//   6. GIVEN a runner session running for a ticket, or a takeover session open in a person's own terminal
//      WHEN the project's places are counted
//      THEN neither takes a place
//
// ✏ 2026-10-05 (phase 49 verification): phase 49 (piece 5) adds the number of places, `places` in
// timone.yaml (the key CONTEXT.md names), 2 when a project sets none. Clauses 1 and 2 are judged
// now, with _places.mjs's manyAsk(): several tickets picked up together, each starting a building
// step that does not end; "counted" is how many of those steps run at once, and whether the rest
// are refused for want of a place. Clause 3 is seen again with N = 2, and clause 4's second half
// ("while the other steps keep running") with two places. The one-place fixtures below now write
// `places: 1` into timone.yaml, so they are clause 3 and 5 and 6 at N = 1, as set by the project.
// Break legs of the new labels: 1 — the "has 2" check on a project that sets 1; 2 — the "has 3"
// check on a project that sets none; 3 (N = 2) — the same check on a project that sets 3, where
// the third ticket starts; 4 (two places) — the same check on a project that sets 1.
//
// (phase 47's words, kept:) Phase 47 claims R2 "except the number of places (clauses 1 and 2, which stay with piece 5)";
// every project keeps one place until then. Clauses 1 and 2 are printed, with what was seen,
// and not judged. With one place, N is 1, and clause 4's "while the other steps keep running"
// has no other step to keep: that half is seen only once a project has two places.
//
// "Counted" is read the one way a person can see it with one place: whether another ticket's
// step is refused while the ticket is in that state, what the refusal names as taking the place,
// and the ledger's place fields.
//
// Break legs. 3: the same fixture with the first ticket running no step (it did nothing), where
// nothing takes the place. 4 and 6: the same fixture with the first ticket's step running, where
// the place is taken. 5: each "takes none" check applied to the ticket whose step runs, which
// does take the place; for "waiting for its turn", the build from just before phase 47, where a
// ticket that found its project held was queued at pickup and never refused a step.
// Clause 3's break leg reuses the no-step fixture with its setup check told the step runs, so
// the leg exercises the outcome checks (refused, not started, waiting in the ledger) on a
// project where nothing takes the place.
import { secondAsks, assertNotRefused, said, freedPlace, manyAsk, afterStepAsks, before47, A, B, runsLine } from './_places.mjs';
import { oldBuild } from './_old-build.mjs';
import { clause, assert, finish } from './_rig.mjs';

const REAL_ONLY = process.env.PROBE_REAL_ONLY === '1';

const [idle, running, prOpen, asks] = await Promise.all([
  secondAsks({ state: 'idle' }),
  secondAsks({ state: 'step-running', aStage: 'execution' }),
  secondAsks({ state: 'pr-open' }),
  secondAsks({ state: 'asks-person' }),
]);
const [runningTriage, runningDelivery, runner, takeover] = await Promise.all([
  secondAsks({ state: 'step-running', aStage: 'triage' }),
  secondAsks({ state: 'step-running', aStage: 'delivery' }),
  secondAsks({ state: 'runner-running' }),
  secondAsks({ state: 'takeover' }),
]);
// Two tickets refused for want of a place while ticket 20's step runs.
const WAITERS = [{ n: 21, createdAt: '2026-09-01T10:00:00.000Z' }, { n: 22, createdAt: '2026-09-02T10:00:00.000Z' }];
const [turn, turnOld] = await Promise.all([
  freedPlace({ waiters: WAITERS, givenDoes: 'start' }),
  REAL_ONLY ? null : freedPlace({ waiters: WAITERS, givenDoes: 'start', cli: before47(), timeoutMs: 30000 }),
]);

const [byDefault, setOne, setThree] = await Promise.all([
  manyAsk({ places: undefined, count: 3 }),
  manyAsk({ places: 1, count: 3 }),
  manyAsk({ places: 3, count: 4 }),
]);
const counted = (r) => `${r.places === undefined ? 'no places line' : `places: ${r.places}`}: ${r.nums.map((n) => `#${n} ${r.per[n].started.length ? 'started' : r.per[n].refused.length ? 'refused' : 'neither'}`).join(', ')}; steps running at the end: ${r.running.map((n) => `#${n}`).join(', ') || 'none'}`;
// The project has N places: N of the tickets' steps run at once, and every other ticket's step is
// refused for want of a place.
function assertHas(r, n) {
  const st = r.nums.filter((t) => r.per[t].started.length);
  assert(st.length === n, `${st.length} steps started, not ${n} (${counted(r)})`);
  assert(r.running.length === n, `${r.running.length} steps were running together at the end, not ${n} (${counted(r)})`);
  for (const t of r.nums.filter((t) => !r.per[t].started.length)) assert(r.per[t].refused.some((d) => /place/i.test(d)), `#${t} was not refused for want of a place: ${JSON.stringify(r.per[t].refused)}`);
}
await clause('PRD-07.R2 clause 1', 'a project whose entry in timone.yaml sets no limit: when its places are counted, it has 2', {
  broken: async () => assertHas(setOne, 2),
  correct: async () => assertHas(byDefault, 2),
});
console.log(`    (${counted(byDefault)})`);
console.log(`    (the third ticket was refused with: "${byDefault.per[33]?.refused[0] ?? 'nothing'}")`);
await clause('PRD-07.R2 clause 2', 'a project whose entry in timone.yaml sets a limit of N: when its places are counted, it has N (N = 3 and N = 1)', {
  broken: async () => assertHas(byDefault, 3),
  correct: async () => { assertHas(setThree, 3); assertHas(setOne, 1); },
});
console.log(`    (${counted(setThree)})`);
console.log(`    (${counted(setOne)})`);
// Clause 3 at N = 2: the third ticket's step does not start, and that ticket waits for its turn.
function assertThirdWaits(r) {
  const third = r.nums[2];
  assert(r.running.length === 2, `setup: not two steps running (${counted(r)})`);
  assert(!r.per[third].started.length, `the third ticket's step started while both places were taken (${counted(r)})`);
  assert(r.per[third].refused.length > 0, `the third ticket's step was not refused (${counted(r)})`);
  const run = r.per[third].run;
  assert(run && run.status !== 'active' && run.place?.waitingSince, `the third ticket does not wait for its turn in the ledger: ${run?.status} ${JSON.stringify(run?.place)}`);
}
await clause('PRD-07.R2 clause 3 (N = 2)', 'a project with 2 places and steps of 2 different tickets running: a step of another ticket asks to start, and it does not start, and the ticket waits for its turn', {
  broken: async () => assertThirdWaits({ ...setThree, running: setThree.running.slice(0, 2) }),
  correct: async () => assertThirdWaits(byDefault),
});
console.log(`    (the third ticket in the ledger: ${byDefault.per[33]?.run?.status} ${JSON.stringify(byDefault.per[33]?.run?.place)})`);
// Clause 4 with two places: the second ticket's step starts while the first one's keeps running.
function assertStartsBeside(r) {
  const [a, b] = r.nums;
  assert(r.per[a].started.length && r.per[b].started.length, `the first two tickets' steps did not both start (${counted(r)})`);
  const later = r.per[a].started[0] < r.per[b].started[0] ? [a, b] : [b, a];
  assert(!r.per[later[0]].stepEnded && r.running.includes(later[0]), `the first step did not keep running after the second started (${counted(r)})`);
  assert(r.running.includes(later[1]), `the second step is not running (${counted(r)})`);
}
await clause('PRD-07.R2 clause 4 (two places)', 'a project with fewer running steps than places (one of two): a step of another ticket asks to start, and it starts, while the other step keeps running', {
  broken: async () => assertStartsBeside(setOne),
  correct: async () => assertStartsBeside(byDefault),
});
console.log(`    (steps started at: ${byDefault.nums.slice(0, 2).map((n) => `#${n} ${byDefault.per[n].started[0]?.slice(11, 19)}`).join(', ')}; both running at the end: ${byDefault.running.join(', ')})`);

function assertRefusedAndWaits(r) {
  assert(r.reachedA && r.atAsk?.aRun?.status === 'active', `setup: the first ticket's step is not running (${r.atAsk?.runs ?? runsLine(r.fx)})`);
  assert(r.added, 'setup: the second ticket was never put on the forge');
  assert(!r.bStarted, `the second ticket's step started while the only place was taken (${runsLine(r.fx)})`);
  assert(r.bRefused.length > 0, `the second ticket's step was not refused: ${JSON.stringify(r.bDecisions)}`);
  const b = r.fx.run(B);
  assert(b && b.status !== 'active' && b.place?.waitingSince, `the second ticket does not wait for its turn in the ledger: ${JSON.stringify(b?.place)} (${b?.status})`);
}
for (const [r, stage] of [[running, 'building'], [runningTriage, 'sorting the request'], [runningDelivery, 'delivering']]) {
  await clause(`PRD-07.R2 clause 3 (${stage})`, `a project with one place and a step of one ticket running (${stage}): a step of another ticket asks to start, and it does not start, and the ticket waits for its turn`, {
    broken: async () => assertRefusedAndWaits({ ...idle, atAsk: { ...idle.atAsk, aRun: { ...idle.atAsk?.aRun, status: 'active' } } }),
    correct: async () => assertRefusedAndWaits(r),
  });
  console.log(`    (refused with: "${r.bRefused[0] ?? 'nothing'}"; the second ticket in the ledger: ${JSON.stringify(r.fx.run(B)?.place)})`);
}

await clause('PRD-07.R2 clause 4', 'fewer running steps than places (none of one): a step of a ticket asks to start, nothing else stops it, and it starts', {
  broken: async () => assertNotRefused(running, assert),
  correct: async () => { assertNotRefused(idle, assert); assertNotRefused(prOpen, assert); },
});
console.log(`    (${said(idle)})`);
console.log('    (its second half, "while the other steps keep running", is seen with two places: clause 4 (two places) above.)');

// Clause 5.
function assertTakesNoPlace(r, why) {
  assert(r.reachedA, `setup: the first ticket never reached "${why}" (${runsLine(r.fx)})`);
  assert(!r.bRefused.some((d) => d.includes(`fixture#${A}/`)), `a refusal names the first ticket as taking the place: "${r.bRefused[0]}"`);
  assertNotRefused(r, assert);
  const a = r.atAsk?.aRun;
  assert(a && !a.place?.givenAt && a.status !== 'active', `the ledger shows the first ticket taking a place: ${a?.status} ${JSON.stringify(a?.place)}`);
}
await clause('PRD-07.R2 clause 5 (waiting for a person)', 'a ticket waiting for a person: when the project\'s places are counted, it takes none', {
  broken: async () => assertTakesNoPlace(running, 'a step running'),
  correct: async () => assertTakesNoPlace(asks, 'waiting for a person'),
});
console.log(`    (${said(asks)})`);
await clause('PRD-07.R2 clause 5 (waiting for a merge, with only an open pull request)', 'a ticket waiting for a merge, with only an open pull request: when the project\'s places are counted, it takes none', {
  broken: async () => assertTakesNoPlace(running, 'a step running'),
  correct: async () => assertTakesNoPlace(prOpen, 'an open pull request'),
});
console.log(`    (${said(prOpen)})`);
// Waiting for its turn: tickets 21 and 22 both refused while ticket 20's step runs. The later
// refusal must name only the ticket whose step runs, never the ticket already waiting; and the
// waiting tickets carry no given place in the ledger while they wait.
function assertWaitingTakesNone(r, holder) {
  const refs = r.nums.flatMap((n) => r.per[n].refused.map((x) => ({ n, ...x }))).sort((a, b) => (a.at < b.at ? -1 : 1));
  assert(refs.length >= 2, `setup: fewer than two tickets were refused (${r.runs})`);
  const [first, later] = refs;
  assert(later.detail.includes(`fixture#${holder}/`), `the later refusal does not name the run that takes the place: "${later.detail}"`);
  assert(!later.detail.includes(`fixture#${first.n}/`), `the later refusal names the ticket waiting for its turn as taking the place: "${later.detail}"`);
  assert(r.refusedAt && !/given the place/.test(r.refusedAt) && (r.refusedAt.match(/waiting for a place/g) ?? []).length >= 2, `the ledger while they waited: ${r.refusedAt}`);
}
await clause('PRD-07.R2 clause 5 (waiting for its turn)', 'a ticket waiting for its turn: when the project\'s places are counted, it takes none', {
  broken: async () => assertWaitingTakesNone(turnOld, 20),
  correct: async () => assertWaitingTakesNone(turn, 20),
});
console.log(`    (the ledger while both waited: ${turn.refusedAt}; refusals: ${turn.nums.map((n) => `#${n} "${turn.per[n].refused[0]?.detail}"`).join(' ')})`);

await clause('PRD-07.R2 clause 6 (runner session)', 'a runner session running for a ticket: when the project\'s places are counted, it takes no place', {
  broken: async () => assertNotRefused(running, assert),
  correct: async () => { assert(runner.m.runner().some((q) => q.brief.includes(`fixture #${A}`) && !q.answeredAt), 'setup: the first ticket\'s runner session was not open when the second ticket asked'); assertNotRefused(runner, assert); },
});
console.log(`    (${said(runner)})`);
await clause('PRD-07.R2 clause 6 (takeover session)', 'a takeover session open in a person\'s own terminal: when the project\'s places are counted, it takes no place', {
  broken: async () => assertNotRefused(running, assert),
  correct: async () => { assert(takeover.atAsk?.takeoverOpen, `setup: no takeover session was open on the first ticket (${takeover.atAsk?.runs})`); assertNotRefused(takeover, assert); },
});
console.log(`    (${said(takeover)})`);

// ✏ 2026-10-05 (phase 49 verification): clause 6 for the runner session a step's end wakes. The
// label above sees the runner session of a ticket just picked up, with no step before it. Here
// the first ticket's step has ended and its runner, woken by that end, is still deciding; the
// second ticket asks to start a step then. Break leg: the build at this branch's first fix
// commit (e705481, before the fix for this case), which was seen to refuse the second ticket
// with "the place is given to run fixture#12/1".
const FIX_LOOP_1 = 'e705481fbb80481735f378a4ea8a3188d07feaec';
const [afterStep, afterStepOld] = await Promise.all([
  afterStepAsks({}),
  REAL_ONLY ? null : afterStepAsks({ cli: oldBuild(FIX_LOOP_1) }),
]);
function assertRunnerAfterStepTakesNone(r) {
  assert(r.aStepEnded && r.aRunnerOpen, `setup: the first ticket's runner session after its step was not open when the second ticket was answered (step ended ${r.aStepEnded}, answered ${r.answeredAt}; ${r.runs})`);
  assert(!r.bRefused.some((d) => d.includes(`fixture#${A}/`)), `a refusal names the first ticket as taking the place: "${r.bRefused[0]}"`);
  assert(r.bStarted, `the second ticket's step did not start (${r.runs})`);
}
await clause('PRD-07.R2 clause 6 (runner session after a step)', 'a runner session running for a ticket, woken by the end of that ticket\'s step: when the project\'s places are counted, it takes no place', {
  broken: async () => assertRunnerAfterStepTakesNone(afterStepOld),
  correct: async () => assertRunnerAfterStepTakesNone(afterStep),
});
console.log(`    (the first ticket's step ended ${afterStep.aStepEnded?.slice(11, 23)}; its runner session still open when the second ticket was answered at ${afterStep.answeredAt?.slice(11, 23)}: ${afterStep.aRunnerOpen}; the second ticket was refused: ${JSON.stringify(afterStep.bRefused)}; its step started: ${afterStep.bStarted}; the first ticket's place: ${JSON.stringify(afterStep.aPlace)})`);

for (const r of [afterStep, afterStepOld]) r?.fx.cleanup();
for (const r of [idle, running, prOpen, asks, runningTriage, runningDelivery, runner, takeover, turn, turnOld, byDefault, setOne, setThree]) r?.fx.cleanup();
finish('PRD-07.R2');
