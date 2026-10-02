# ADR-0061: A check script proves itself once, and a fix re-runs what it can affect

- **Status:** accepted
- **Date:** 2026-10-02
- **Source:** the interview of 2026-10-02 in the terminal, on [timone#185](https://github.com/fvermaut/timone/issues/185) and [timone#110](https://github.com/fvermaut/timone/issues/110) together. fvermaut answered one question at a time, and took the recommended answer each time.
- **Amends:** [ADR-0048](0048-a-verification-probe-is-kept-proved-able-to-fail-and-hidden-from-the-builder.md) D2, which has every probe run its break leg on every run, and ADR-0048's rejection of a narrower re-check after a fix. [PRD-01.R16](../specs/prd/prd-01-process-layer.criteria.md#r16--tdd-implementation-loop), whose last clause ran the full suite at the end of every sub-phase, is revised with it.
- **Requirements:** [PRD-06](../specs/prd/prd-06-a-run-spends-its-time-on-the-work.md)

## Context

A ticket takes too long, and most of the time is commands, not the model. On 6 September one small build step on scratch-app took 68 minutes, 21 of them the model; about 22 were the whole browser suite, run at least 8 times, and 12.5 were a wait for a GitHub token ([#110](https://github.com/fvermaut/timone/issues/110)). On ivtrends the check costs most ([ivtrends triage 019](https://github.com/fvermaut/ivtrends/blob/main/doc/triage/019-checking-and-building-take-too-long.md)): phase 50 ran 67 standing probes and 6 new ones, each with its break leg and then as built, and the whole set again after the fix. Single probes took 1,098 s and 837 s.

Two of Timone's rules make those repeats:

- **ADR-0048 D2**: a probe's pass counts only after it has been seen to fail "in the same run", so every probe runs twice on every pass, including after each fix. Its reasons stand: a pass alone is not evidence ([timone#36](https://github.com/fvermaut/timone/issues/36)), and a probe whose selector stopped matching cannot be made to fail. What is not argued is why a probe already proved on an earlier pass must be proved again.
- **ADR-0048's rejected alternative** *"Weaken the full re-verify after a fix loop"* was rejected because *"once the set is one command, running all of it after every fix costs almost nothing."* With probes of 15 and 18 minutes, that is not true.

The building step repeats in the same way. Each sub-phase runs the full suite at its end, and after a sub-phase that changes shared state, every earlier sub-phase's validation runs again.

[ADR-0051](0051-timone-verifies-itself-by-live-gate-and-a-regression-set-is-narrowed-by-what-it-depends-on.md) D4 narrows the first pass by `Depends-on` lines, and says a rule inferred from a diff's paths "gets it wrong in both directions". That holds for a whole phase's diff, which can touch anything. A fix commit answers one written defect brief and usually changes a few files. The checker already reads the names of changed paths under D4, so reading the fix commit's names is not a new kind of read.

Alternatives considered:

- **Keep every rule as it is.** Rejected: the cost grows with every phase shipped, and the reason for the full re-run no longer holds.
- **The break run once per phase, for every probe.** Rejected: the first pass still runs every probe twice, which is most of the cost.
- **After a fix, the affected probes, then the whole set once more.** Rejected: with one fix, the usual case, it costs more than re-running the whole set once.
- **After a fix, the whole set, real run only.** The simplest, and it halves today's cost. Rejected for the narrower option, because the fix commit's file names are enough to choose, and every skip is listed.
- **Leave old and new test failures to the checker's judgement**, or do not compare them. Rejected: the checker's own choice on ivtrends was to rebuild and run the default branch every phase, and without a comparison the operator cannot tell a new failure from one that has stood for weeks.
- **The whole suite at the end of each sub-phase, without re-running earlier ones.** Rejected: a small saving, while the whole browser suite is the cost.
- **Cheaper models**: back to Sonnet as on 30 August, or Sonnet for building only. Rejected for now: the model was a third of the measured time, and the operator chose Opus 5.5 for every step on 23 September.

## Decision

### D1 — A probe does its break run only when it is new, rewritten, or in doubt

**A probe does its break run (it must fail) and then its real run (it must pass) when it is first written, when it is written again because its criterion is `revised`, and when its result is in doubt** — the instrument alarm that already exists, where the build-health smoke and a probe disagree. Every other run of a probe is its real run only. The report names every probe that ran without a break run.

ADR-0048 D2's rule that a pass counts only after the probe has been seen to fail stays. What changes is when: once in the probe's life, and again whenever its intent or its result is in question, rather than on every run.

### D2 — After a fix, the probes that failed and those the fix can affect run again

**After a fix commit, the checker runs every probe that failed, and every probe whose criterion the fix's changed files can affect.** It judges that from the names of the files the fix commit changed and from the criteria's `Depends-on` lines. It never reads the fix commit's contents. When the fix changed a file many criteria rest on, such as a database schema, a shared layout or a configuration file, every probe in scope runs again. The report lists every probe not run again, with the reason. No further run of the whole set follows the last fix.

### D3 — The first pass is unchanged

The first pass of a phase still runs every probe in the regression set, narrowed only as ADR-0051 D4 says. That full run on the build is what makes D2's narrower re-run safe.

### D4 — Old failures in the project's own tests are told apart from the last report

When the build-health smoke has failing tests, the checker marks each one old or new **by the list of smoke failures the last check report wrote down**. It never builds or runs the default branch just to compare. With no earlier list, it reports the failures unmarked and says so.

### D5 — Each sub-phase runs the tests its change can affect, and everything runs whole once at the end

**At the end of a sub-phase, the builder runs the tests its change can affect, and every suite that takes under a minute whole.** Its own validation steps still pass before the next sub-phase starts, but earlier sub-phases' validation does not run again. **When the last sub-phase is done, every suite runs whole once, and every sub-phase's validation steps run once more**, before the completion report. The completion report lists what each sub-phase ran.

### D6 — The models do not change

Every step stays on Opus 5.5. It is measured again once this decision is built.

## Consequences

- A check on ivtrends runs each standing probe once on the first pass instead of twice, and after a fix runs a few probes instead of all of them. A build runs the whole browser suite once per phase instead of once per sub-phase.
- **Accepted:** an old probe that has quietly stopped being able to fail is no longer caught by its break run. This matters most for probes that check that something is absent.
- **Accepted:** a fault a fix causes in a part the checker did not choose can reach the pull request. The report's list of probes not run again is how the operator sees what was not looked at.
- **Accepted:** a sub-phase that breaks an earlier one is found at the end of the build, not at once, so its fix may cost more.
- Every skip is written in the report, and the operator's approval of the pull request stays the final gate, as ADR-0060 has it.
- `process.md` stages 6 and 7, `timone-execute` and `timone-verify` change to match.
- The GitHub token wait in #110 is a fault, not part of this decision. It is fixed under [PRD-06.R5](../specs/prd/prd-06-a-run-spends-its-time-on-the-work.criteria.md#r5--a-box-never-holds-a-github-token-that-runs-out-before-its-next-one-arrives).
