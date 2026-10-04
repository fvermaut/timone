// Probe for PRD-08.R5 — When the file names nobody, the ticket still opens.
//
// Stage 7 artifact, written 2026-10-04 for phase 46's verification, from the criteria register
// alone. No source, no diff, no test suite and no handoff note was read.
//
// Register clause (verbatim):
//   GIVEN a project for which `namedPeople` returns an empty list
//   WHEN either path of R1 and R2 opens a ticket
//   THEN the ticket opens as it would have before this change
//   AND its body contains no `@`-name added by code, and no empty name such as a lone `@`
//
// The built daemon refuses to start when a project names nobody (seen: "The daemon does not start:
// project "fixture" names nobody who may instruct it."), so, as the register's hint says, each path
// is called directly in the built code (dist/), with a manifest that has no `operator` and no
// `instructors`, and a recording tracker in place of GitHub:
//   R1's path  `openStepTickets` in dist/daemon/chunk-zero.js, with the people `namedPeople` gives;
//   R2's path  the `fileTimoneIssue` action of `runnerActions` in dist/runner/actions.js.
// How to call them was learned by calling them with recording stand-ins and watching what they
// read and called — never from their source.
// "As it would have before this change" is read by making the same call in the build before this
// phase (main at the branch's merge-base, compiled by _old-build.mjs) and comparing what reaches
// the tracker, call for call.
//
// Break step: the same calls with a manifest whose `operator` is fvermaut, so `namedPeople` gives
// someone. Code then adds a name, the bodies differ from the old build's, and the check goes red.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { clause, assert, finish, CLI, REPO_ROOT } from './_rig.mjs';
import { oldCli, distOf } from './_people.mjs';

const YAML = (await import(path.join(REPO_ROOT, 'node_modules', 'yaml', 'dist', 'index.js'))).default;
const manifestText = (operator) => `${operator ? `operator: ${operator}\n` : ''}projects:\n` +
  ['timone', 'client'].map((n) => `  ${n}:\n    repo_url: https://github.com/probe-owner/${n}.git\n    path: projects/${n}\n    stack: [typescript]\n    bindings:\n      ticketing: github\n`).join('');
const LIST = '# Breakdown\n\n**Status:** Approved by fvermaut 2026-10-04 — 2 pieces\n\n' +
  '1. **Piece 1: the store** — keep the to-dos. Delivers PRD-01.R1.\n   - Needs: nothing.\n' +
  '2. **Piece 2: the count** — count the open ones. Delivers PRD-01.R2.\n   - Needs: piece 1.\n\n**Order:** 1, then 2.\n\n---\n\nThe list.\n';

// A tracker that records every call and answers as an empty GitHub would.
function tracker() {
  const calls = [];
  let next = 100;
  const adapter = new Proxy({}, {
    get: (_, k) => (typeof k === 'symbol' || k === 'then' ? undefined : async (...a) => {
      calls.push([k, ...a.map((x) => JSON.parse(JSON.stringify(x ?? null)))]);
      if (k === 'createStep') return next++;
      if (k === 'createIssue') return next++;
      if (k.startsWith('list')) return [];
      return undefined;
    }),
  });
  return { adapter, calls };
}

async function bothPaths(dist, operator) {
  const { parseManifest, namedPeople } = await import(path.join(dist, 'manifest.js'));
  const { openStepTickets } = await import(path.join(dist, 'daemon', 'chunk-zero.js'));
  const { runnerActions } = await import(path.join(dist, 'runner', 'actions.js'));
  const m = parseManifest(YAML.parse(manifestText(operator)));
  const project = { name: 'client', ...m.projects.client };
  const people = namedPeople(m, 'client');
  const steps = tracker();
  await openStepTickets({ adapter: steps.adapter, breakdownSource: async () => LIST, log: () => {} }, { id: 'run-1', ticket: 12 }, project, people);
  const issue = tracker();
  const root = fs.mkdtempSync(path.join(process.env.PROBE_TMP || os.tmpdir(), 'prd08r5-'));
  let returned;
  try {
    returned = await runnerActions({ manifest: m, adapter: issue.adapter, clock: () => '2026-10-04T12:00:00Z', root, project }, { id: 'run-1', ticket: 12 })
      .fileTimoneIssue({ title: 'PROBE-R08: a fault', body: 'PROBE-R08: what was seen.', reason: 'probe' });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
  return { people, timonePeople: namedPeople(m, 'timone'), steps: steps.calls, issue: issue.calls, returned };
}

const bodies = (calls) => calls.filter(([k]) => k === 'createStep' || k === 'createIssue').map((c) => c.at(-1).body);
const assertAsBefore = (now, before) => {
  const opened = now.steps.filter(([k]) => k === 'createStep').length;
  assert(opened === 2, `the opening opened ${opened} step tickets for a list of two pieces`);
  assert(now.issue.filter(([k]) => k === 'createIssue').length === 1, 'the Timone issue was not opened');
  for (const b of [...bodies(now.steps), ...bodies(now.issue)]) {
    assert(!/@/.test(b), `a body contains "@": ${JSON.stringify(b)}`);
  }
  assert(JSON.stringify(now.steps) === JSON.stringify(before.steps), `the opening's calls differ from the build before this change:\n now:    ${JSON.stringify(now.steps)}\n before: ${JSON.stringify(before.steps)}`);
  assert(JSON.stringify(now.issue) === JSON.stringify(before.issue), `the Timone issue's calls differ from the build before this change:\n now:    ${JSON.stringify(now.issue)}\n before: ${JSON.stringify(before.issue)}`);
};

const OLD = distOf(oldCli());
const NOW = distOf(CLI);
await clause('PRD-08.R5 clause 1', 'namedPeople gives nobody: on both paths the ticket opens as before this change, with no @-name added and no lone @', {
  broken: async () => assertAsBefore(await bothPaths(NOW, 'fvermaut'), await bothPaths(OLD, 'fvermaut')),
  correct: async () => {
    const now = await bothPaths(NOW, null);
    const before = await bothPaths(OLD, null);
    console.log(`    namedPeople: client ${JSON.stringify(now.people)}, timone ${JSON.stringify(now.timonePeople)}`);
    assert(now.people.length === 0 && now.timonePeople.length === 0, 'the GIVEN does not hold: namedPeople gives someone');
    for (const b of bodies(now.steps)) console.log(`    step ticket body: ${JSON.stringify(b)}`);
    for (const b of bodies(now.issue)) console.log(`    Timone issue body: ${JSON.stringify(b)}`);
    console.log(`    tracker calls, this build: ${now.steps.length + now.issue.length}; build before: ${before.steps.length + before.issue.length}; action returned: ${JSON.stringify(now.returned)}`);
    assertAsBefore(now, before);
  },
});

finish('PRD-08.R5');
