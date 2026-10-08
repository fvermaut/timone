// Probe for PRD-10.R2 — In a container with no run in the ledger, the guard judges by the container's step.
// Stage 7 artifact, authored 2026-10-08 (phase 57 verification) from the register alone.
//
// Register clauses (verbatim):
//   1. GIVEN an empty ledger and a container session whose step is `verification`
//      WHEN the guard judges a `Write` of `<probes>/prd-10.r1.mjs`, and then a `Bash` call `node <probes>/prd-10.r1.mjs`
//      THEN it allows both, and asks nothing
//   2. GIVEN the same, with the step `update`
//      WHEN the guard judges a `Read` of `<probes>/prd-10.r1.mjs`
//      THEN it allows it
//   3. GIVEN an empty ledger and a container session whose step is `execution`, and then `remediation`
//      WHEN the guard judges a `Read` of `<probes>/prd-10.r1.mjs`
//      THEN it refuses it, with the reason it gives a building step on the host today
//   4. GIVEN an empty ledger, a container session whose step is `execution`, and a declaration in
//      `.timone/declared-stages.json` that the session runs `verification`
//      WHEN the guard judges a `Read` of `<probes>/prd-10.r1.mjs`
//      THEN it refuses it
//   5. GIVEN a ledger with a run for the session whose stage is `execution`, and a container step `verification`
//      WHEN the guard judges a `Read` of `<probes>/prd-10.r1.mjs`
//      THEN it refuses it: the ledger wins
//   6. GIVEN an empty ledger and a person's session
//      WHEN the guard judges a `Read` of `<probes>/prd-10.r1.mjs`, first with no declaration and then
//      with a declaration of `verification`
//      THEN it asks, and then it allows, as it does today (#169)
//
// Every call is made for both folders, with the path relative and in full. The declaration is made
// with the built `timone stage` command, run as a person, so the probe never writes its file by hand.
//
// Break legs. Clauses 1-4: the same calls judged by the guard as built on main just before phase 57
// (c718880), which never read the container's step: it asks in clauses 1-3, and lets the declaration
// win in clause 4. Clause 5: the old build refuses too (the ledger won there as well), so the break is
// the ledger losing its run: the same call with the run removed, which a guard that let the container's
// step beat the ledger would answer the same way. Clause 6: the old build behaves the same (the clause
// says "as it does today"), so the break is the person's session given a container's environment.
import { clause, finish, assert, REAL_ONLY } from './_lib.mjs';
import { oldBuild } from './_old-build.mjs';
import { root, declare, guard, expect, readOf, writeOf, runCall, ALL_FORMS } from './_guard-step.mjs';

const BEFORE_PHASE_57 = 'c718880c2b9a1901c0b4e46df6c02b380333f235';
const OLD = REAL_ONLY ? null : oldBuild(BEFORE_PHASE_57);
const box = (step, extra = {}) => ({ box: true, step, ...extra });
const each = (mk, sess, cli) => ALL_FORMS.map((F) => { const [tool, input] = mk(F); return { label: `${sess.step ?? 'person'}:`, tool, input, ...sess, cli }; });

// 1
const c1 = (cli) => { const r = root(); return expect(r, [...each(writeOf, box('verification'), cli), ...each(runCall, box('verification'), cli)], 'allow').length; };
clause('R2 clause 1', 'empty ledger, container step verification: a Write and a run of a check script are both allowed, nothing asked', {
  broken: () => c1(OLD),
  correct: () => console.log(`    ${c1()} judgements (Write and Bash node, 2 folders × relative/full), all allow`),
});

// 2
const c2 = (cli) => { const r = root(); return expect(r, each(readOf, box('update'), cli), 'allow').length; };
clause('R2 clause 2', 'empty ledger, container step update: a Read of a check script is allowed', {
  broken: () => c2(OLD),
  correct: () => console.log(`    ${c2()} judgements, all allow`),
});

// 3 — the host's reason for a building step: a run in the ledger, no container environment.
const hostBuilderReason = (cli) => guard(root({ ledger: { sid: 'b-1', stage: 'execution' } }), { sid: 'b-1', box: false, tool: 'Read', input: { file_path: `${ALL_FORMS[0]}/prd-10.r1.mjs` }, cli });
const c3 = (cli) => {
  const host = hostBuilderReason(cli);
  assert(host.decision === 'deny', `the host's building step was not refused (${host.decision}); no reason to compare with`);
  const r = root();
  const got = [...expect(r, each(readOf, box('execution'), cli), 'deny'), ...expect(r, each(readOf, box('remediation'), cli), 'deny')];
  const other = got.filter((a) => a.reason !== host.reason);
  assert(other.length === 0, `${other.length} refusals give another reason than the host's building step: "${other[0]?.reason.slice(0, 160)}"`);
  return { n: got.length, reason: host.reason };
};
clause('R2 clause 3', 'empty ledger, container step execution, then remediation: a Read is refused, with the reason a building step gets on the host', {
  broken: () => c3(OLD),
  correct: () => {
    const { n, reason } = c3();
    console.log(`    ${n} judgements, all deny, each with the host builder's reason: "${reason.slice(0, 120)}…"`);
    const old = OLD ? hostBuilderReason(OLD).reason : null;
    if (old !== null) console.log(`    the host builder's reason is ${old === reason ? 'the same as' : 'DIFFERENT from'} the reason the build before phase 57 gave`);
  },
});

// 4 — the declaration is made, and shown to be in force (a person's session with that id is let through).
const c4 = (cli) => {
  const r = root();
  declare(r, 'sess-1', 'verification');
  const inForce = guard(r, { sid: 'sess-1', box: false, tool: 'Read', input: { file_path: `${ALL_FORMS[0]}/prd-10.r1.mjs` }, cli });
  assert(inForce.decision === 'allow', `instrument: the declaration is not in force for a person's session (${inForce.decision})`);
  return expect(r, each(readOf, box('execution', { sid: 'sess-1' }), cli), 'deny').length;
};
clause('R2 clause 4', 'empty ledger, container step execution, and a declaration of verification: a Read is refused', {
  broken: () => c4(OLD),
  correct: () => console.log(`    the declaration is in force for a person's session with the same id; in the container, ${c4()} judgements, all deny`),
});

// 5
const c5 = (ledger) => { const r = root(ledger ? { ledger: { sid: 'sess-1', stage: 'execution' } } : {}); return expect(r, each(readOf, box('verification', { sid: 'sess-1' })), 'deny').length; };
clause('R2 clause 5', 'a ledger run with stage execution, container step verification: a Read is refused — the ledger wins', {
  broken: () => c5(false),
  correct: () => console.log(`    ${c5(true)} judgements, all deny`),
});

// 6
const c6 = (asBox) => {
  const r = root();
  const sess = asBox ? box(undefined, { sid: 'sess-1' }) : { box: false, sid: 'sess-1' };
  const before = expect(r, each(readOf, sess), 'ask').length;
  declare(r, 'sess-1', 'verification');
  const after = expect(r, each(readOf, sess), 'allow').length;
  return { before, after };
};
clause('R2 clause 6', "empty ledger, a person's session: a Read is asked about, then allowed once verification is declared", {
  broken: () => c6(true),
  correct: () => { const { before, after } = c6(false); console.log(`    no declaration: ${before} judgements, all ask; declared verification: ${after} judgements, all allow`); },
});

finish('PRD-10.R2');
