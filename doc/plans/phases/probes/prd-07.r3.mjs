// Probe for PRD-07.R3 — A freed place goes to one ticket: `priority:high` first, then the oldest.
// Stage 7 artifact, authored 2026-10-04 (phase 47) from the register alone. Runs the built
// daemon through _places.mjs and _rig.mjs. Needs `npm run build` first.
//
// Register clauses (verbatim):
//   1. GIVEN tickets waiting for a place on a project, one of them labelled `priority:high`
//      WHEN a place frees THEN the place goes to the ticket labelled `priority:high`
//   2. GIVEN tickets waiting for a place on a project, none labelled `priority:high`, or several
//      WHEN a place frees THEN the place goes to the oldest of them
//   3. GIVEN a place given to one ticket
//      WHEN its runner wakes and starts a step
//      THEN the step is not refused for want of a place
//      AND no other ticket of the project was told that a place is free (#184)
//   4. GIVEN a place given to one ticket whose runner decides to start no step
//      WHEN that runner session ends
//      THEN the place goes to the next ticket by the same order
//
// The fixture: ticket 20 (created 2026-09-20, not labelled) starts a step that ends after a few
// seconds; its runner then does nothing. While it runs, the waiting tickets arrive, and each
// one's step is refused for want of a place. "Oldest" is the ticket's creation time on the
// forge, as the register's hint says. "Told" is a wake of the ticket's runner whose event says
// a place, or the project, is free.
//
// Break legs. 1: the same tickets with no label, where the oldest is told instead. 2: the
// "oldest" check applied to clause 1's fixture, where a newer labelled ticket comes first.
// 3: clause 4's fixture, where the ticket given the place starts no step and a second ticket is
// told; both halves of the clause must go red there. 4: clause 3's fixture, where the ticket
// given the place starts a step and nobody else is told.
import { freedPlace, firstTold } from './_places.mjs';
import { clause, assert, finish } from './_rig.mjs';

const REAL_ONLY = process.env.PROBE_REAL_ONLY === '1';
const OLDEST = { n: 21, createdAt: '2026-09-01T10:00:00.000Z' };
const MIDDLE = { n: 23, createdAt: '2026-09-05T10:00:00.000Z' };
const HIGH = { n: 22, createdAt: '2026-09-10T10:00:00.000Z', priority: true };
const HIGH_OLD = { n: 24, createdAt: '2026-09-03T10:00:00.000Z', priority: true };

const [onePriority, nonePriority, twoPriority, passes] = await Promise.all([
  freedPlace({ waiters: [OLDEST, HIGH, MIDDLE], givenDoes: 'start' }),
  freedPlace({ waiters: [MIDDLE, OLDEST], givenDoes: 'start' }),
  freedPlace({ waiters: [OLDEST, HIGH, HIGH_OLD], givenDoes: 'start' }),
  freedPlace({ waiters: [OLDEST, HIGH, MIDDLE], givenDoes: 'nothing' }),
]);
const unlabelled = REAL_ONLY ? null : await freedPlace({ waiters: [OLDEST, { ...HIGH, priority: false }, MIDDLE], givenDoes: 'start' });

function assertAllWaited(r) {
  for (const n of r.nums) assert(r.per[n].refused.length > 0, `setup: ticket #${n} was not refused for want of a place, so it never waited (${r.runs})`);
  assert(r.stepEndedAt, 'setup: the first ticket\'s step never ended, so no place freed');
}
function assertGoesTo(r, n) {
  assertAllWaited(r);
  const told = firstTold(r);
  assert(told.length > 0, `no waiting ticket was told a place is free (${r.runs})`);
  assert(told[0].n === n, `the place went to #${told[0].n}, not #${n}`);
}
const order = (r) => firstTold(r).map((x) => `#${x.n} at ${x.at.slice(11, 19)}`).join(', ') || 'nobody';

await clause('PRD-07.R3 clause 1', 'tickets waiting for a place, one of them labelled priority:high: a place frees, and the place goes to the ticket labelled priority:high', {
  broken: async () => assertGoesTo(unlabelled, HIGH.n),
  correct: async () => assertGoesTo(onePriority, HIGH.n),
});
console.log(`    (waiting: #21 created 09-01, #22 created 09-10 labelled priority:high, #23 created 09-05. Told, in order: ${order(onePriority)})`);
if (unlabelled) console.log(`    (break leg, #22 not labelled: told ${order(unlabelled)})`);

await clause('PRD-07.R3 clause 2 (none labelled)', 'tickets waiting for a place, none labelled priority:high: a place frees, and the place goes to the oldest of them', {
  broken: async () => assertGoesTo(onePriority, OLDEST.n),
  correct: async () => assertGoesTo(nonePriority, OLDEST.n),
});
console.log(`    (waiting: #23 created 09-05 arrived first in the list, #21 created 09-01. Told: ${order(nonePriority)})`);
await clause('PRD-07.R3 clause 2 (several labelled)', 'tickets waiting for a place, several labelled priority:high: a place frees, and the place goes to the oldest of them', {
  broken: async () => assertGoesTo(twoPriority, HIGH.n),
  correct: async () => assertGoesTo(twoPriority, HIGH_OLD.n),
});
console.log(`    (waiting: #21 created 09-01, #22 created 09-10 and #24 created 09-03, both labelled. Told: ${order(twoPriority)})`);

function assertStepNotRefused(r, given) {
  assertAllWaited(r);
  const g = r.per[given];
  assert(g.tells.length > 0, `the ticket given the place (#${given}) was not woken for it`);
  const after = g.decisions.filter((d) => d.at >= g.tells[0]);
  assert(after.length > 0, `#${given}'s runner did not ask to start a step after it was woken`);
  const refused = after.find((d) => /^Refused/.test(d.detail));
  assert(!refused, `#${given}'s step was refused: "${refused?.detail}"`);
  assert(g.started.length > 0, `#${given}'s step did not start`);
}
function assertNoOtherTold(r, given) {
  assertAllWaited(r);
  const others = r.nums.filter((n) => n !== given && r.per[n].tells.length > 0);
  assert(others.length === 0, `other tickets were told a place is free too: ${others.map((n) => `#${n} at ${r.per[n].tells.join(', ')}`).join('; ')}`);
}
// The break leg goes red only when BOTH halves go red on clause 4's fixture, so each half is
// proved able to fail; if either half stays green there, the leg stays green and the clause
// reads INSTRUMENT-BROKEN.
function bothRed(r, given) {
  const errs = [];
  for (const f of [assertStepNotRefused, assertNoOtherTold]) { try { f(r, given); } catch (e) { errs.push(e.message); } }
  if (errs.length === 2) throw new Error(errs.join(' / '));
}
await clause('PRD-07.R3 clause 3', 'a place given to one ticket: its runner wakes and starts a step, the step is not refused for want of a place, and no other ticket of the project was told that a place is free (#184)', {
  broken: async () => bothRed(passes, HIGH.n),
  correct: async () => { for (const [r, n] of [[onePriority, HIGH.n], [nonePriority, OLDEST.n], [twoPriority, HIGH_OLD.n]]) { assertStepNotRefused(r, n); assertNoOtherTold(r, n); } },
});
console.log(`    (#22 was woken with: ${JSON.stringify(onePriority.per[HIGH.n].tellWords)}; its runner was answered: ${JSON.stringify(onePriority.per[HIGH.n].decisions.map((d) => d.detail))}; told a place is free, over the whole fixture: ${onePriority.nums.map((n) => `#${n} ${onePriority.per[n].tells.length}×`).join(', ')})`);

// The break leg skips the check that the given runner started no step, so it reaches the
// outcome check on a fixture where that runner did start one and nobody else was told.
function assertPassesOn(r, given, next, { breakLeg = false } = {}) {
  assertAllWaited(r);
  const told = firstTold(r);
  assert(told[0]?.n === given, `setup: the place went first to #${told[0]?.n}, not #${given}`);
  if (!breakLeg) assert(r.per[given].started.length === 0, `setup: #${given}'s runner started a step`);
  assert(told.length >= 2, `after #${given}'s runner started no step, the place went to nobody (told: ${order(r)})`);
  assert(told[1].n === next, `after #${given}, the place went to #${told[1].n}, not #${next}, the next by the same order`);
}
await clause('PRD-07.R3 clause 4', 'a place given to one ticket whose runner decides to start no step: that runner session ends, and the place goes to the next ticket by the same order', {
  broken: async () => assertPassesOn(onePriority, HIGH.n, OLDEST.n, { breakLeg: true }),
  correct: async () => assertPassesOn(passes, HIGH.n, OLDEST.n),
});
console.log(`    (waiting: #21 created 09-01, #22 labelled, #23 created 09-05; each runner given the place starts no step. Told, in order: ${order(passes)})`);

for (const r of [onePriority, nonePriority, twoPriority, passes, unlabelled]) r?.fx.cleanup();
finish('PRD-07.R3');
