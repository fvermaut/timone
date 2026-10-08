// Probe for PRD-10.R7 — `timone stage` does not claim a step in a container.
// Stage 7 artifact, authored 2026-10-08 (phase 57 verification) from the register alone.
//
// Register criterion (verbatim): In a container session, `timone stage verification` says that the
// container's step decides what the guard does, names that step, and does not say that the session is
// now the checking step. A person's session gets the same sentences as today.
//
// Labelled as two clauses, one per sentence of the criterion.
//   1. In a container session (container steps execution, verification, remediation and planning) the
//      output says the container's step decides, names that step, and does not say the session "is now"
//      the checking step.
//   2. In a person's session, `timone stage <s>` for verification, execution, planning and none prints
//      exactly what the build before phase 57 printed ("today" when the register was written).
//
// Break legs: clause 1, the build before phase 57 (c718880), which says "is now the checking step" in a
// container too. Clause 2: the old build prints the same for a person, so the break is the same command
// run with a container's environment, whose output must then differ from today's.
import { execFileSync } from 'node:child_process';
import { clause, finish, assert, REAL_ONLY, CLI } from './_lib.mjs';
import { oldBuild } from './_old-build.mjs';
import { root, sessionEnv } from './_guard-step.mjs';

const BEFORE_PHASE_57 = 'c718880c2b9a1901c0b4e46df6c02b380333f235';
const OLD = REAL_ONLY ? null : oldBuild(BEFORE_PHASE_57);

function stage(cli, s, sess) {
  const r = root();
  try {
    const out = execFileSync(process.execPath, [cli, 'stage', s, '--session', 'sess-1', '--root', r.dir], { encoding: 'utf8', env: sessionEnv(sess), stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out: out.trim() };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}`.trim() };
  }
}

const STEPS = ['execution', 'verification', 'remediation', 'planning'];
const c1 = (cli) => STEPS.map((step) => {
  const { out } = stage(cli, 'verification', { box: true, step });
  assert(new RegExp(`\\b${step}\\b`).test(out), `container step ${step}: the output does not name the step: "${out}"`);
  assert(/container/i.test(out) && /decides/i.test(out), `container step ${step}: the output does not say the container's step decides: "${out}"`);
  assert(!/is now the checking step|is now (running )?verification/i.test(out), `container step ${step}: the output says the session is now the checking step: "${out}"`);
  return `${step}: "${out}"`;
});
clause('R7 clause 1', "in a container, `timone stage verification` says the container's step decides, names it, and does not claim the checking step", {
  broken: () => c1(OLD),
  correct: () => { for (const l of c1(CLI)) console.log(`    ${l}`); },
});

// "Today" is the build before phase 57. Its output is computed even on a real run, because clause 2
// compares with it.
const TODAY = () => OLD ?? oldBuild(BEFORE_PHASE_57);
const ASKED = ['verification', 'execution', 'planning', 'none'];
const c2 = (sessNow) => ASKED.map((s) => {
  const now = stage(CLI, s, sessNow);
  const then = stage(TODAY(), s, { box: false });
  assert(now.out === then.out && now.code === then.code, `stage ${s}: now (exit ${now.code}) "${now.out}" — today (exit ${then.code}) "${then.out}"`);
  return `${s}: "${now.out}"`;
});
clause('R7 clause 2', "in a person's session, `timone stage` prints the same sentences as before phase 57", {
  broken: () => c2({ box: true, step: 'execution' }),
  correct: () => { for (const l of c2({ box: false })) console.log(`    ${l}`); },
});

finish('PRD-10.R7');
