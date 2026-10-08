// Probe for PRD-10.R3 — In a container the guard never asks.
// Stage 7 artifact, authored 2026-10-08 (phase 57 verification) from the register alone.
//
// Register clauses (verbatim):
//   1. GIVEN an empty ledger and a container session whose step is any name in `PIPELINE_STAGES` that
//      is neither a building nor a checking step (for example `requirements`, `planning`, `delivery`)
//      WHEN the guard judges a `Read` of `<probes>/prd-10.r1.mjs`
//      THEN it refuses it, and the reason says in one or two plain sentences that only the checking
//      step uses these files and that nobody in a container can be asked
//   2. GIVEN an empty ledger and a container session whose step is missing, empty, or a name that is
//      not in `PIPELINE_STAGES`
//      WHEN the guard judges the same call
//      THEN it refuses it, with the same reason
//   3. GIVEN any container session, with any step or none, and any tool call
//      WHEN the guard judges it
//      THEN its answer is never "ask"
//
// PIPELINE_STAGES is read off the built module (dist/daemon/pipeline.js), not its source. A building
// step is execution or remediation, a checking step verification or update (the register's own
// definitions). Clause 1's reason is judged by its words: at most two sentences; it says "only" and
// names the checking step ("check"); it says the session is in a container and that nobody can be asked.
//
// Clause 3 is a universal claim. The probe takes "any" as: every name in PIPELINE_STAGES plus a
// missing, an empty and an unknown step; an empty ledger, and a ledger holding a run for the session in
// each of a building, a checking and another stage; and a spread of calls — real reads, writes, lists
// and runs of a check script (R5's forms), calls that only name the folders (R4's forms), and ordinary
// calls that touch neither. It cannot try every call there is; it is proved able to fail.
//
// Break legs: the same calls judged by the guard as built on main just before phase 57 (c718880),
// which asks in a container whenever the ledger has no run for the session.
import { clause, finish, assert, REAL_ONLY } from './_rig.mjs';
import { oldBuild } from './_old-build.mjs';
import { root, guardMany, expect, readOf, ALL_FORMS, P, S, PIPELINE_STAGES } from './_guard-step.mjs';

const BEFORE_PHASE_57 = 'c718880c2b9a1901c0b4e46df6c02b380333f235';
const OLD = REAL_ONLY ? null : oldBuild(BEFORE_PHASE_57);
const BUILDING = ['execution', 'remediation'];
const CHECKING = ['verification', 'update'];
const OTHER = PIPELINE_STAGES.filter((s) => !BUILDING.includes(s) && !CHECKING.includes(s));
const reads = (step, cli) => ALL_FORMS.map((F) => { const [tool, input] = readOf(F); return { label: `${step === undefined ? '<missing>' : JSON.stringify(step)}:`, tool, input, box: true, step, cli }; });

function plainReason(reason) {
  const sentences = reason.replace(/\b(e\.g|i\.e)\./g, '$1').split(/(?<=[.!?])\s+(?=[A-Z])/).filter((s) => s.trim());
  assert(sentences.length >= 1 && sentences.length <= 2, `the reason has ${sentences.length} sentences: "${reason}"`);
  assert(/\bonly\b/i.test(reason) && /check/i.test(reason), `the reason does not say only the checking step uses the files: "${reason}"`);
  assert(/container/i.test(reason) && /\b(ask|asked)\b/i.test(reason) && /\bnobody|no one|cannot\b/i.test(reason), `the reason does not say nobody in a container can be asked: "${reason}"`);
}

let REASON = null;
const c1 = (cli) => {
  const r = root();
  const got = OTHER.flatMap((st) => expect(r, reads(st, cli), 'deny'));
  const reasons = [...new Set(got.map((a) => a.reason))];
  assert(reasons.length === 1, `the refusals give ${reasons.length} different reasons`);
  plainReason(reasons[0]);
  return { n: got.length, reason: reasons[0] };
};
await clause('R3 clause 1', 'empty ledger, a container step that neither builds nor checks: a Read is refused, with a plain reason', {
  broken: () => c1(OLD),
  correct: () => {
    const { n, reason } = c1();
    REASON = reason;
    console.log(`    steps: ${OTHER.join(', ')}; ${n} judgements, all deny, one reason: "${reason}"`);
  },
});

const c2 = (cli, want) => {
  const r = root();
  const got = [undefined, '', 'frobnicate', 'Verification', 'verification '].flatMap((st) => expect(r, reads(st, cli), 'deny'));
  const other = got.filter((a) => a.reason !== want);
  assert(other.length === 0, `${other.length} refusals give another reason: "${other[0]?.reason}"`);
  return got.length;
};
await clause('R3 clause 2', 'empty ledger, a container step that is missing, empty or unknown: the same call is refused, with the same reason', {
  broken: () => c2(OLD, REASON ?? c1().reason),
  correct: () => console.log(`    steps: missing, "", "frobnicate", "Verification", "verification " (a space after); ${c2(undefined, REASON ?? c1().reason)} judgements, all deny with clause 1's reason`),
});

// Clause 3 — the spread of calls.
const calls = (F) => [
  ['Read', { file_path: `${F}/a.sh` }],
  ['Write', { file_path: `${F}/b.sh`, content: 'x' }],
  ['Edit', { file_path: `${F}/a.sh`, old_string: 'a', new_string: 'b' }],
  ['NotebookEdit', { notebook_path: `${F}/a.ipynb`, new_source: 'x' }],
  ['Glob', { pattern: `${F}/**/*.mjs` }],
  ['Grep', { pattern: 'total', path: F }],
  ['Bash', { command: `cat ${F}/a.sh` }],
  ['Bash', { command: `ls ${F}` }],
  ['Bash', { command: `node ${F}/a.mjs` }],
  ['Bash', { command: `python3 - <<'EOF'\nprint(open('${F}/a.sh').read())\nEOF` }],
  ['Agent', { description: 'a helper', prompt: `Do not open \`${F}\`.` }],
  ['Bash', { command: `git commit -m "docs: name ${F}"` }],
  ['SomeNewTool', { anything: `${F}/a.sh` }],
];
const ordinary = [
  ['Read', { file_path: 'src/cli.ts' }],
  ['Bash', { command: 'ls src' }],
  ['Write', { file_path: 'doc/notes.md', content: 'x' }],
];
const ALL_CALLS = [...calls(P), ...calls(S), ...ordinary];
const STEPS = [...PIPELINE_STAGES, undefined, '', 'frobnicate'];
const LEDGERS = [null, 'execution', 'verification', 'planning'];
const c3 = async (cli) => {
  const jobs = [];
  for (const ledger of LEDGERS) {
    const r = root(ledger ? { ledger: { sid: 'sess-1', stage: ledger } } : {});
    for (const step of STEPS) for (const [tool, input] of ALL_CALLS) jobs.push({ r, ledger, sid: 'sess-1', box: true, step, tool, input, cli });
  }
  const got = await guardMany(jobs);
  const asks = jobs.filter((j, i) => got[i].decision === 'ask').map((j) => `ledger ${j.ledger ?? 'empty'}, step ${j.step === undefined ? '<missing>' : JSON.stringify(j.step)}: ${j.tool} ${JSON.stringify(j.input).slice(0, 70)}`);
  assert(asks.length === 0, `${asks.length} of ${jobs.length} judgements asked: ${asks.slice(0, 4).join(' | ')}${asks.length > 4 ? ' …' : ''}`);
  return jobs.length;
};
await clause('R3 clause 3', 'any container session, any step or none, any call: the answer is never "ask"', {
  broken: () => c3(OLD),
  correct: async () => console.log(`    ${LEDGERS.length} ledgers × ${STEPS.length} steps × ${ALL_CALLS.length} calls = ${await c3()} judgements, none ask`),
});

finish('PRD-10.R3');
