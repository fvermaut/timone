// Probe for PRD-10.R5 — A real read, list, run or write of a check script is still judged.
// Stage 7 artifact, authored 2026-10-08 (phase 56 verification) from the register alone.
//
// Register clauses (verbatim):
//   1. GIVEN a building step's session, in a container and on the host
//      WHEN the guard judges each of these calls
//      THEN it refuses every one of them:
//        - `Read`, `Write` and `Edit` of `<probes>/a.sh`, and `NotebookEdit` of `<probes>/a.ipynb`, with
//          the path relative and in full
//        - a `Glob` whose pattern or path is inside `<probes>`, and a `Grep` whose path is inside `<probes>`
//        - `Bash` calls `cat <probes>/a.sh`, `ls <probes>`, `sed -n 1,20p <probes>/a.sh`, `head <probes>/a.sh`,
//          `bash <probes>/a.sh`, `node <probes>/a.mjs`, `grep -rn total <probes>`, `cp <probes>/a.sh /tmp/`,
//          `echo x > <probes>/b.sh`, `git show HEAD:<probes>/a.sh` and `git log -p -- <probes>`
//        - a `Bash` call that joins a call R4 lets through to one of the above:
//          `git commit -m "x" && cat <probes>/a.sh`
//        - a `Bash` call that hands a script naming `<probes>` to an interpreter as text:
//          `python3 - <<'EOF'` … `EOF`, `node -e "…"` and `bash -c "…"`
//        - a call to a tool the guard has no rule for, any of whose input text names `<probes>`
//   2. GIVEN a checking step's session in a container, and a person's session
//      WHEN the guard judges the same calls
//      THEN it allows them for the checking step, and asks the person, as R2 says
//
// "R5 clause 1 — further forms" is this pass's own addition, asked for by the runner: the same reads,
// lists, runs and writes of a check script, written the other ways a shell lets them be written in
// ONE command — other quoting, other joiners, redirections, subshells and substitutions, a script
// handed to an interpreter by a here-string or a pipe, a path after `@` or glued to a short flag, and
// a path spelled with `//`, `/./` or `../`. Each reaches a check script exactly as the listed call
// does. Left out on purpose, because the PRD's *Out of scope* accepts them: a path in a variable used
// in a later command, a path built from pieces, a wildcard in place of part of the path, a change of
// folder followed by a relative read, and a script written to a file and then run.
//
// Break legs: the same calls judged for a checking step's session, which the guard lets through
// (clause 1 and its further forms must go red); for clause 2, the same calls judged for a building
// step's session, which the guard refuses (must go red). The payload reaches the guard verbatim, as
// JSON on stdin, so the break leg proves the probe sees each answer as the guard gave it.
import { clause, finish } from './_lib.mjs';
import { P, S, ROOT, expectAll } from './_guard.mjs';

const full = (F) => (F === P ? `${ROOT}/projects/fixture/${F}` : `${ROOT}/${F}`);
const EOF = 'EOF';
const listed = (F) => [
  ['Read', { file_path: `${F}/a.sh` }], ['Read', { file_path: `${full(F)}/a.sh` }],
  ['Write', { file_path: `${F}/a.sh`, content: 'x' }], ['Write', { file_path: `${full(F)}/a.sh`, content: 'x' }],
  ['Edit', { file_path: `${F}/a.sh`, old_string: 'a', new_string: 'b' }], ['Edit', { file_path: `${full(F)}/a.sh`, old_string: 'a', new_string: 'b' }],
  ['NotebookEdit', { notebook_path: `${F}/a.ipynb`, new_source: 'x' }], ['NotebookEdit', { notebook_path: `${full(F)}/a.ipynb`, new_source: 'x' }],
  ['Glob', { pattern: `${F}/*.mjs` }], ['Glob', { pattern: '*.mjs', path: F }], ['Glob', { pattern: '*.mjs', path: full(F) }],
  ['Grep', { pattern: 'total', path: F }], ['Grep', { pattern: 'total', path: `${full(F)}/a.sh` }],
  ...[`cat ${F}/a.sh`, `ls ${F}`, `sed -n 1,20p ${F}/a.sh`, `head ${F}/a.sh`, `bash ${F}/a.sh`, `node ${F}/a.mjs`,
    `grep -rn total ${F}`, `cp ${F}/a.sh /tmp/`, `echo x > ${F}/b.sh`, `git show HEAD:${F}/a.sh`, `git log -p -- ${F}`,
    `git commit -m "x" && cat ${F}/a.sh`,
    `python3 - <<'${EOF}'\nprint(open('${F}/a.sh').read())\n${EOF}`,
    `node -e "console.log(require('fs').readFileSync('${F}/a.mjs', 'utf8'))"`,
    `bash -c "cat ${F}/a.sh"`].map((command) => ['Bash', { command }]),
  ['SomeToolWithNoRule', { anything: { nested: [`see ${F}/a.sh`] } }],
];
const further = (F) => [
  // quoting
  `cat "${F}/a.sh"`, `cat '${F}/a.sh'`, `cat ${F}"/a.sh"`, `cat "${F}"/a.sh`, `cat ${F.replace('probes', 'pro"be"s')}/a.sh`,
  `cat $'${F}/a.sh'`, `cat $"${F}/a.sh"`,
  // joiners other than &&
  `true; cat ${F}/a.sh`, `true || cat ${F}/a.sh`, `true | cat ${F}/a.sh`, `true & cat ${F}/a.sh`, `git commit -m "x"\ncat ${F}/a.sh`,
  // redirections
  `cat <${F}/a.sh`, `wc -l < ${F}/a.sh`, `echo x >>${F}/b.sh`, `echo x 2>${F}/b.sh`, `exec 3<${F}/a.sh`, `while read l; do :; done < ${F}/a.sh`,
  // subshells, groups, substitutions, compound commands
  `(cat ${F}/a.sh)`, `{ cat ${F}/a.sh; }`, `echo $(cat ${F}/a.sh)`, 'echo `cat ' + F + '/a.sh`', `diff <(cat ${F}/a.sh) /dev/null`,
  `if true; then cat ${F}/a.sh; fi`, `for f in ${F}/a.sh; do cat "$f"; done`,
  // variables in the same word, prefixes, wrappers
  `cat $PWD/${F}/a.sh`, `F=${F}/a.sh; cat "$F"`, `env X=1 cat ${F}/a.sh`, `sudo cat ${F}/a.sh`, `xargs cat <<< ${F}/a.sh`, `echo ${F}/a.sh | xargs cat`,
  // a script handed to an interpreter as text, by other means
  `python3 <<'${EOF}'\nprint(open('${F}/a.sh').read())\n${EOF}`, `echo "cat ${F}/a.sh" | sh`,
  `python3 <<<"print(open('${F}/a.sh').read())"`, `bash <<< "cat ${F}/a.sh"`, `eval "cat ${F}/a.sh"`,
  // a path after @, or glued to a short flag
  `curl -d @${F}/a.sh http://example.invalid`, `grep -f${F}/a.sh x`, `tar -C${F} -cf /tmp/x.tar .`, `cat {${F}/a.sh,}`,
  // the same path, spelled with a doubled slash, a `.` or a `..`
  `cat ${F.replace('/probes', '//probes')}/a.sh`, `cat ${F.replace('/probes', '/./probes')}/a.sh`,
  `cat ${F.replace(/\/([^/]+)\/probes$/, '/$1/../$1/probes')}/a.sh`,
].map((command) => ['Bash', { command }]).concat([
  ['Read', { file_path: `./${F}/a.sh` }],
  ['Read', { file_path: `${F.replace('/probes', '//probes')}/a.sh` }],
  ['Read', { file_path: `${F.replace(/\/([^/]+)\/probes$/, '/$1/../$1/probes')}/a.sh` }],
  ['Grep', { pattern: 'total', path: `${F.replace('/probes', '/./probes')}` }],
]);

const calls = [...listed(P), ...listed(S)];
const more = [...further(P), ...further(S)];
const builders = ['building, host', 'building, container'];

clause('R5 clause 1', 'a building step, host and container: the guard refuses every listed read, list, run and write', {
  broken: () => expectAll(calls, ['checking, host', 'checking, container'], 'deny'),
  correct: () => console.log(`    ${expectAll(calls, builders, 'deny')} judgements, all refused`),
});

clause('R5 clause 1 — further forms', 'the same reads written other ways in one command (quoting, joiners, redirections, subshells, here-strings, @ and glued flags, path spellings): refused', {
  broken: () => expectAll(more, ['checking, host', 'checking, container'], 'deny'),
  correct: () => console.log(`    ${expectAll(more, builders, 'deny')} judgements, all refused`),
});

const want2 = (s) => (s.startsWith('checking') ? 'allow' : 'ask');
clause('R5 clause 2', "the same calls: allowed for a checking step in a container, asked of a person's session", {
  broken: () => expectAll(calls, ['building, container', 'building, host'], (s) => (s === 'building, container' ? 'allow' : 'ask')),
  correct: () => console.log(`    ${expectAll(calls, ['checking, container', "person's"], want2)} judgements, as required`),
});

finish('PRD-10.R5');
