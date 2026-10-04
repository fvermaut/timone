// Probe for PRD-08.R1 — A ticket opened for a piece names the project's people.
//
// Stage 7 artifact, written 2026-10-04 for phase 46's verification, from the criteria register
// alone. No source, no diff, no test suite and no handoff note was read. The built daemon is run
// on the fake forge (_rig.mjs) and walks a ticket to an approved list of three pieces (_people.mjs);
// the step tickets it opens are read back from the forge.
//
// Register clauses (verbatim):
//   1. GIVEN a project whose entry in `timone.yaml` lists no `instructors`, and `operator: fvermaut`
//      at the top of the file / WHEN a named person approves a list of three pieces and the machine
//      opens the three tickets / THEN the body of each of the three tickets contains `@fvermaut`
//   2. GIVEN a project whose entry lists `instructors: [alice, bob]` / WHEN the machine opens a
//      ticket for one of its pieces / THEN the body contains `@alice` and `@bob`
//   3. GIVEN a ticket for a piece that already exists, so that a second run of the opening finds it
//      by its title / WHEN the opening runs again / THEN that ticket is not opened again and its
//      body is not changed
//
// A name counts only in plain text: GitHub notifies nobody named inside backticks.
//
// Break steps:
//   1, 2  the build before this phase (main at the branch's merge-base), compiled by _old-build.mjs.
//         Its step tickets name nobody, so both must go red there.
//   3     the existing ticket's title differs from the piece's by one word, so the opening does
//         not find it and opens the piece again: the "not opened again" check must go red.
//
// Needs `npm run build` first. Nothing reaches GitHub or a real model.
import { clause, assert, finish, CLI } from './_rig.mjs';
import { approvedWalk, oldCli, stepTitle, namesInPlainText, N } from './_people.mjs';

// ---------------------------------------------------------------- clause 1

const assertAllName = (r, logins) => {
  for (const k of [1, 2, 3]) {
    const s = r.steps(k);
    assert(s.length === 1, `step ticket ${k} was opened ${s.length} times`);
    const named = namesInPlainText(s[0].body);
    for (const l of logins) assert(named.has(l), `step ticket ${k} (#${s[0].number}) does not name @${l}: ${JSON.stringify(s[0].body)}`);
  }
};
const show = (r) => { for (const k of [1, 2, 3]) for (const s of r.steps(k)) console.log(`    #${s.number} "${s.title}" — last line: ${s.body.trim().split('\n').at(-1)}`); };

await clause('PRD-08.R1 clause 1', 'no instructors and operator fvermaut: a named person approves three pieces, and each of the three tickets the machine opens contains @fvermaut', {
  broken: async () => { const r = await approvedWalk({ cli: oldCli() }); try { assertAllName(r, ['fvermaut']); } finally { r.fx.cleanup(); } },
  correct: async () => {
    const r = await approvedWalk({ cli: CLI });
    try { show(r); assertAllName(r, ['fvermaut']); } finally { r.fx.cleanup(); }
  },
});

// ---------------------------------------------------------------- clause 2

await clause('PRD-08.R1 clause 2', 'instructors [alice, bob]: a ticket the machine opens for one of the pieces contains @alice and @bob', {
  broken: async () => { const r = await approvedWalk({ cli: oldCli(), instructors: ['alice', 'bob'], approver: 'alice' }); try { assertAllName(r, ['alice', 'bob']); } finally { r.fx.cleanup(); } },
  correct: async () => {
    const r = await approvedWalk({ cli: CLI, instructors: ['alice', 'bob'], approver: 'alice' });
    try { show(r); assertAllName(r, ['alice', 'bob']); } finally { r.fx.cleanup(); }
  },
});

// ---------------------------------------------------------------- clause 3
//
// The ticket for piece 2 is on the forge before the opening runs, as a first run that stopped part
// way would have left it: no `timone` mark yet (a marked one would be picked up as new work before
// the list is approved), a child of the ticket, and a body the opening did not write.

const SENTINEL = 'PROBE-R08-SENTINEL: this body was written before the opening ran again.';
const planted = (title) => (f) => {
  f.issues[50] = { number: 50, title, body: SENTINEL, labels: [], state: 'OPEN', author: 'probe-bot', createdAt: '2026-09-28T10:00:00.000Z', comments: [], parent: N };
};
const assertNotReopened = (r) => {
  const two = r.steps(2);
  assert(two.length === 1 && two[0].number === 50, `the piece-2 ticket exists ${two.length} times: ${two.map((i) => `#${i.number}`).join(', ')}`);
  assert(two[0].body === SENTINEL, `the existing ticket's body was changed to ${JSON.stringify(two[0].body)}`);
  const bodyEdits = r.fx.gh().filter((g) => g.argv[1] === 'edit' && g.argv[2] === '50' && (g.argv.includes('--body') || g.argv.includes('--body-file')));
  assert(bodyEdits.length === 0, `the opening edited #50's body: ${bodyEdits.map((g) => g.argv.join(' ')).join(' | ')}`);
  assert(r.steps(1).length === 1 && r.steps(3).length === 1, 'the other two pieces were not opened once each');
};
await clause('PRD-08.R1 clause 3', 'a ticket for a piece already exists and the opening finds it by its title: it is not opened again and its body is not changed', {
  broken: async () => { const r = await approvedWalk({ cli: CLI, plant: planted(`${stepTitle(2)} (old)`) }); try { assertNotReopened(r); } finally { r.fx.cleanup(); } },
  correct: async () => {
    const r = await approvedWalk({ cli: CLI, plant: planted(stepTitle(2)) });
    try {
      console.log(`    tickets created: ${r.creates.map((g) => `"${g.argv[g.argv.indexOf('--title') + 1]}"`).join(', ')}`);
      console.log(`    calls touching #50: ${r.fx.gh().filter((g) => g.argv[2] === '50').map((g) => `gh ${g.argv.join(' ')}`).join(' | ') || 'none'}`);
      console.log(`    #50 body after: ${JSON.stringify(r.steps(2)[0]?.body)}`);
      assertNotReopened(r);
    } finally { r.fx.cleanup(); }
  },
});

finish('PRD-08.R1');
