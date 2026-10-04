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
// Phase 47 claims R2 "except the number of places (clauses 1 and 2, which stay with piece 5)";
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
import { secondAsks, assertNotRefused, said, freedPlace, before47, A, B, runsLine } from './_places.mjs';
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

console.log('=== PRD-07.R2 clause 1 — a project whose entry in timone.yaml sets no limit: when its places are counted, it has 2');
console.log('    NOT CLAIMED by phase 47 (piece 5 adds the number). Seen, not judged: the fixture sets no limit, and a second ticket\'s step');
console.log(`    was refused while one step ran — the project has one place on this build. ("${running.bRefused[0] ?? 'no refusal'}")`);
console.log('=== PRD-07.R2 clause 2 — a project whose entry in timone.yaml sets a limit of N: when its places are counted, it has N');
console.log('    NOT CLAIMED by phase 47 (piece 5 adds the setting in timone.yaml). Not run.');

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
console.log('    (its second half, "while the other steps keep running", needs two places: with one, no other step can run. Not seen.)');

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

for (const r of [idle, running, prOpen, asks, runningTriage, runningDelivery, runner, takeover, turn, turnOld]) r?.fx.cleanup();
finish('PRD-07.R2');
