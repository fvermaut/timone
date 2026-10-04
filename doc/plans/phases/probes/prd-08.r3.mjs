// Probe for PRD-08.R3 — The instructions for charting a large piece of work name the project's
// people on every ticket.
//
// Stage 7 artifact, written 2026-10-04 for phase 46's verification, from the criteria register
// alone. The register says this requirement is about the instructions, so the instructions are
// what is read: `.claude/skills/timone-wayfind/SKILL.md`, the file R3 names.
//
// Register criteria (verbatim): the instructions in `.claude/skills/timone-wayfind/SKILL.md` tell
// the session to name the people of the project in the body of every ticket it opens: the map
// ticket and each decision ticket. They say where the session finds those people (`timone.yaml`,
// `instructors` or else `operator`).
//
// Read as three labels:
//   a  the step that creates the map ticket says to end its body with the line that names the
//      project's people, and the map's body template carries that line;
//   b  every step that creates decision tickets (charting, and tending the map) says each one
//      ends with that line;
//   c  the instructions say where the people are found: `timone.yaml`, the project's
//      `instructors`, otherwise the `operator`.
// And one more check on a: the line the instructions give starts with the same words the built
// code writes on the tickets it opens (seen by calling the built opening with one person), so a
// person reading a ticket sees one line whoever opened it. The register does not ask for the same
// words; this is printed, and asserted only as part of label a's "the line" being a real one.
//
// Break step: the same file at the branch's merge-base (the build before this phase), read with
// `git show <sha>:<path>`. It says nothing about naming people, so every label must go red.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { clause, assert, finish, REPO_ROOT } from './_rig.mjs';
import { BEFORE_PHASE_46 } from './_people.mjs';

const FILE = '.claude/skills/timone-wayfind/SKILL.md';
const now = fs.readFileSync(path.join(REPO_ROOT, FILE), 'utf8');
const before = execFileSync('git', ['-C', REPO_ROOT, 'show', `${BEFORE_PHASE_46}:${FILE}`], { encoding: 'utf8' });

// The line the built code writes, seen by calling the opening with one person.
const { openStepTickets } = await import(path.join(REPO_ROOT, 'dist', 'daemon', 'chunk-zero.js'));
let codeLine = '';
await openStepTickets({
  adapter: new Proxy({}, { get: (_, k) => (typeof k === 'symbol' || k === 'then' ? undefined : async (...a) => { if (k === 'createStep') codeLine ||= a.at(-1).body.trim().split('\n').at(-1); return k.startsWith('list') ? [] : 1; }) }),
  breakdownSource: async () => '# Breakdown\n\n**Status:** Approved by someone 2026-10-04 — 1 piece\n\n1. **Piece 1: one** — do it. Delivers PRD-01.R1.\n   - Needs: nothing.\n\n**Order:** 1.\n\n---\n\nThe list.\n',
  log: () => {},
}, { id: 'r', ticket: 12 }, { name: 'client' }, ['someone']);
const LINE = codeLine.replace(/\s*@someone\s*$/, '');

const steps = (text) => text.split('\n').filter((l) => /^\d+\.\s/.test(l));
const sayLine = (s) => /names? the project's people|Named so that GitHub tells them/.test(s);

const a = (text) => {
  const create = steps(text).find((l) => /\*\*Create the map\*\*/.test(l));
  assert(create, 'no step creates the map');
  assert(sayLine(create), `the step that creates the map does not say to name the project's people: ${create}`);
  const tpl = text.split('```')[1] ?? '';
  assert(tpl.includes('@<each login>'), 'the map\'s body template does not carry the line that names the people');
  assert(LINE && text.includes(LINE), `the instructions do not give the line the code writes ("${LINE}")`);
};
const b = (text) => {
  const create = steps(text).filter((l) => /\*\*(Create the tickets[^*]*|Tend the map)\*\*/.test(l));
  assert(create.length === 2, `steps that create decision tickets found: ${create.length}`);
  for (const l of create) assert(sayLine(l), `a step that creates decision tickets does not say to name the project's people: ${l.slice(0, 120)}`);
  assert(/every ticket you open: the map and each decision ticket/i.test(text), 'the instructions do not say every ticket, the map and each decision ticket');
};
const c = (text) => {
  const where = text.split('\n').find((l) => /Where the people are found/.test(l));
  assert(where, 'the instructions do not say where the people are found');
  for (const w of ['timone.yaml', 'instructors', 'operator']) assert(where.includes(w), `"where the people are found" does not name ${w}: ${where}`);
  assert(/instructors`? when it lists any\. Otherwise use the top-level `?operator/.test(where), `the order "instructors, otherwise operator" is not said: ${where}`);
};

await clause('PRD-08.R3 label a', 'the step that creates the map ticket says to end it with the line naming the project\'s people, and the map template carries it', {
  broken: async () => a(before),
  correct: async () => { console.log(`    code writes: "${codeLine}"`); a(now); },
});
await clause('PRD-08.R3 label b', 'each step that creates decision tickets says each ends with the line naming the project\'s people', {
  broken: async () => b(before),
  correct: async () => { for (const l of steps(now).filter((x) => /Create the map|Create the tickets|Tend the map/.test(x))) console.log(`    ${l.slice(0, 200)}…`); b(now); },
});
await clause('PRD-08.R3 label c', 'the instructions say where the people are found: timone.yaml, instructors, else operator', {
  broken: async () => c(before),
  correct: async () => { console.log(`    ${now.split('\n').find((l) => /Where the people are found/.test(l))}`); c(now); },
});

finish('PRD-08.R3');
