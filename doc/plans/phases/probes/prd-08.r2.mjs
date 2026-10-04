// Probe for PRD-08.R2 — An issue the runner files on Timone names the people of the `timone` project.
//
// Stage 7 artifact, written 2026-10-04 for phase 46's verification, from the criteria register
// alone. No source, no diff, no test suite and no handoff note was read. The built daemon runs on
// the fake forge with a fake model; the fake runner calls the `file_timone_issue` action on its
// first wake, and the issue is read back from the Timone repository on the forge.
//
// Register clauses (verbatim):
//   1. GIVEN `operator: fvermaut`, and a `timone` project that lists no `instructors`
//      WHEN the runner files a Timone issue with a body that names nobody
//      THEN the body of the issue opened on the Timone repository contains `@fvermaut`
//      AND the name is added by code, whatever words the runner wrote
//   2. GIVEN a run on a client project whose entry lists `instructors: [client-person]`
//      WHEN the runner files a Timone issue about a fault it saw on that run
//      THEN the body names the people of the `timone` project
//      AND it does not contain `@client-person`
//
// "Whatever words the runner wrote" is read with two bodies: one that names nobody, and one that
// writes `@fvermaut` only inside backticks, where GitHub notifies nobody. A name counts only in
// plain text.
//
// Break steps:
//   1  the build before this phase (main at the branch's merge-base): it adds no name.
//   2  the `timone` project lists `instructors: [client-person]`, so its people are the client's
//      person: the body then names @client-person and not @fvermaut, and both checks must go red.
//
// Needs `npm run build` first. Nothing reaches GitHub or a real model.
import { clause, assert, finish, CLI } from './_rig.mjs';
import { fileTimoneIssue, oldCli, namesInPlainText } from './_people.mjs';

const BODIES = ['PROBE-R08: what was seen, naming nobody.', 'PROBE-R08: the runner wrote `@fvermaut` here, but only inside code.'];

// ---------------------------------------------------------------- clause 1

async function clauseOne(cli) {
  const out = [];
  for (const body of BODIES) {
    const r = await fileTimoneIssue({ cli, projects: { fixture: {}, timone: {} }, body });
    out.push({ body, filed: r.filed });
    r.fx.cleanup();
  }
  return out;
}
const assertNamed = (out) => {
  for (const { body, filed } of out) {
    assert(filed.length === 1, `the runner's words ${JSON.stringify(body)} filed ${filed.length} issues`);
    assert(filed[0].body.startsWith(body), `the runner's words are not the start of the issue: ${JSON.stringify(filed[0].body)}`);
    assert(namesInPlainText(filed[0].body).has('fvermaut'), `the issue filed with ${JSON.stringify(body)} does not name @fvermaut in plain text: ${JSON.stringify(filed[0].body)}`);
  }
};
await clause('PRD-08.R2 clause 1', 'operator fvermaut and a timone project with no instructors: a Timone issue whose words name nobody is opened containing @fvermaut, added by code whatever the words', {
  broken: async () => assertNamed(await clauseOne(oldCli())),
  correct: async () => {
    const out = await clauseOne(CLI);
    for (const { filed } of out) console.log(`    filed on probe-owner/timone: ${JSON.stringify(filed[0]?.body)}`);
    assertNamed(out);
  },
});

// ---------------------------------------------------------------- clause 2

async function clauseTwo(timoneInstructors) {
  const r = await fileTimoneIssue({
    cli: CLI,
    projects: { fixture: { instructors: ['client-person'] }, timone: timoneInstructors ? { instructors: timoneInstructors } : {} },
    author: 'client-person',
    body: BODIES[0],
  });
  r.fx.cleanup();
  return r;
}
const assertTimonePeople = (r) => {
  assert(r.filed.length === 1, `issues filed on the Timone repository: ${r.filed.length}`);
  const named = namesInPlainText(r.filed[0].body);
  assert(named.has('fvermaut'), `the issue does not name the timone project's people (@fvermaut): ${JSON.stringify(r.filed[0].body)}`);
  assert(!r.filed[0].body.includes('@client-person'), `the issue contains @client-person: ${JSON.stringify(r.filed[0].body)}`);
  const onClient = r.creates.filter((g) => !g.argv.includes('probe-owner/timone'));
  assert(onClient.length === 0, `an issue was opened somewhere other than the Timone repository: ${onClient.map((g) => g.argv.join(' ')).join(' | ')}`);
};
await clause('PRD-08.R2 clause 2', 'a run on a client project with instructors [client-person]: the Timone issue names the timone project\'s people and does not contain @client-person', {
  broken: async () => assertTimonePeople(await clauseTwo(['client-person'])),
  correct: async () => {
    const r = await clauseTwo(null);
    console.log(`    filed on probe-owner/timone: ${JSON.stringify(r.filed[0]?.body)}`);
    assertTimonePeople(r);
  },
});

finish('PRD-08.R2');
