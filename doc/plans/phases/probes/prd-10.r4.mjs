// Probe for PRD-10.R4 — Text that only names a check-script folder is not judged.
// Stage 7 artifact, authored 2026-10-08 (phase 56 verification) from the register alone.
//
// Register clauses (verbatim):
//   1. GIVEN a building step's session, a checking step's session, and a person's session, on the
//      host and in a container
//      WHEN the guard judges each of these calls
//      THEN it is silent on every one of them:
//        - an `Agent` call whose prompt says "Do not open `<probes>`"
//        - an `Edit` of `doc/plans/phases/phase-42.md` whose new text names `<probes>/README.md`, and a
//          `Write` of that file whose content names it
//        - a `Bash` call `git commit -m "… <probes> …"`
//        - a `Bash` call `gh issue comment 87 --body "… <probes> …"`, and
//          `gh pr create --title "…" --body "… <probes> …"`
//        - a `Bash` call that writes text naming `<probes>` straight into a file outside the folders:
//          `cat >> doc/plans/phases/phase-42.md <<'EOF'` … `EOF`, and the same with `cat >` and with `tee`
//        - a `Grep` whose pattern is the folder's name and whose path is `src/`
//   2. GIVEN the three calls #192 records: the prompt telling a helper not to open the folders, the
//      edit of the phase file naming the shared folder's README, and the commit whose message names
//      that path
//      WHEN each is made, in the form R4's first clause lists for it, by a building step in a container
//      THEN none of them is refused
//
// A person's session is one with neither TIMONE_RUN_PROJECT nor a container step, so it is judged on
// the host only. Every call is made for each of the two folders.
//
// Break legs: the same calls, judged by the guard as built on main just before phase 56 (the
// merge-base f8b6fbf), which judged every string in a call and so refused or asked about all of them.
// That is the fault R4 exists to catch; the probe must go red on it.
import { clause, finish, REAL_ONLY } from './_lib.mjs';
import { oldBuild } from './_old-build.mjs';
import { P, S, SESSIONS, expectAll } from './_guard.mjs';

const BEFORE_PHASE_56 = 'f8b6fbff2ad9d03051737e2f8eeaf642fa922542';
const OLD = REAL_ONLY ? null : oldBuild(BEFORE_PHASE_56);
const EOF = 'EOF';

const textCalls = (F) => [
  ['Agent', { description: 'a helper', prompt: `Build the slice. Do not open \`${F}\`.` }],
  ['Edit', { file_path: 'doc/plans/phases/phase-42.md', old_string: 'x', new_string: `See ${F}/README.md for the rules.` }],
  ['Write', { file_path: 'doc/plans/phases/phase-42.md', content: `# Phase 42\n\nSee ${F}/README.md for the rules.\n` }],
  ['Bash', { command: `git commit -m "docs: the rules in ${F} are named here"` }],
  ['Bash', { command: `gh issue comment 87 --body "The checks live in ${F} and are not read."` }],
  ['Bash', { command: `gh pr create --title "Phase 42" --body "The checks live in ${F} and are not read."` }],
  ['Bash', { command: `cat >> doc/plans/phases/phase-42.md <<'${EOF}'\nSee ${F}/README.md.\n${EOF}` }],
  ['Bash', { command: `cat > doc/plans/phases/phase-42.md <<'${EOF}'\nSee ${F}/README.md.\n${EOF}` }],
  ['Bash', { command: `tee doc/plans/phases/phase-42.md <<'${EOF}'\nSee ${F}/README.md.\n${EOF}` }],
  ['Grep', { pattern: F, path: 'src/' }],
];
const calls1 = [...textCalls(P), ...textCalls(S)];
const all = Object.keys(SESSIONS);

clause('R4 clause 1', 'every session, host and container: the guard is silent on each call that only names the folders', {
  broken: () => expectAll(calls1, all, 'silent', OLD),
  correct: () => console.log(`    ${expectAll(calls1, all, 'silent')} judgements, all silent`),
});

// #192's three calls, in the forms clause 1 lists for them; the README named is the shared folder's.
const calls192 = [
  ['Agent', { description: 'a helper', prompt: `Do not open \`${P}\` or \`${S}\`.` }],
  ['Edit', { file_path: 'doc/plans/phases/phase-42.md', old_string: 'x', new_string: `The shared checks are described in ${S}/README.md.` }],
  ['Bash', { command: `git commit -m "docs: plan phase 42 — name ${S}/README.md"` }],
];
clause('R4 clause 2', "#192's three calls, made by a building step in a container: none is refused", {
  broken: () => expectAll(calls192, ['building, container'], 'silent', OLD),
  correct: () => console.log(`    ${expectAll(calls192, ['building, container'], 'silent')} calls, none refused (each silent)`),
});

finish('PRD-10.R4');
