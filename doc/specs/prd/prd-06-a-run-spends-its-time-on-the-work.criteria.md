# PRD-06 Acceptance Criteria — A run spends its time on the work, not on repeats

> Formal register for [prd-06-a-run-spends-its-time-on-the-work.md](prd-06-a-run-spends-its-time-on-the-work.md).
> Maintained by: timone-prd (creation), timone-verify (status),
> timone-prd (revisions). Requirement IDs are stable — never renumber.
>
> Words used here, as in [CONTEXT.md](../../../CONTEXT.md): a **probe** is a check script the checking step writes for one criterion and keeps under `doc/plans/phases/probes/`. Its **break run** is the run with the thing it checks broken on purpose, where it must fail; its **real run** is the run on the build as it is, where it must pass. The **build-health smoke** is the one run of the project's own test suite a check may make. A **fix commit** is the commit a fix context returns inside the checking step's fix loop.
>
> No requirement here puts anything on a screen that Timone draws, so no accessibility criteria apply.

## R1 — A probe does its break run only when it is new, rewritten, or in doubt

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** live
- **Last live gate:** never
- **Depends-on:** `.claude/skills/timone-verify/`, `process.md`
- **Criteria:**
    - GIVEN a phase whose regression set holds probes written by earlier checks, and a criterion of the phase that has no probe yet
      WHEN the checking step runs its first pass
      THEN the new probe runs its break run (red) and then its real run (green)
      AND every earlier probe whose criterion is not `revised` runs its real run only
      AND the report names, by criterion ID, every probe that ran without a break run
    - GIVEN a criterion whose status is `revised`
      WHEN the checking step runs
      THEN its probe is written again from the register and runs its break run, then its real run
    - GIVEN a probe whose real run passes behaviour the build-health smoke fails, or fails behaviour the smoke passes
      WHEN the pass is about to conclude
      THEN that probe's break run is done first, and the pass does not conclude until it is
    - GIVEN a fix commit, and a probe that already did its break run earlier in the same check
      WHEN the probe runs again after the fix
      THEN it runs its real run only
- **Verification hint:** on the scratch-app fixture, run one check on a phase that adds one criterion while the regression set holds earlier probes. Read the report's probe section: the new probe shows red then green; the earlier ones show one green each; the list of probes run without a break run names exactly the earlier ones. Then mark one earlier criterion `revised` and run again.

## R2 — After a fix, only the probes that failed and those the fix can affect run again

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** live
- **Last live gate:** never
- **Depends-on:** `.claude/skills/timone-verify/`, `process.md`
- **Criteria:**
    - GIVEN a pass with at least one FAIL, and the fix commit that answers it
      WHEN the checking step checks again
      THEN it runs every probe that failed, and every probe whose criterion the fix commit's changed files can affect
      AND it judges which criteria those are from the names of the files the fix commit changed and from the criteria's `Depends-on` lines, and never reads the fix commit's contents
      AND the report lists every probe in scope that was not run again, each with the reason
    - GIVEN a fix commit that changes a file many criteria rest on, such as a database schema, a shared layout or a configuration file
      WHEN the checking step checks again
      THEN every probe in scope runs again
    - GIVEN the probes run again after the last fix all pass
      WHEN the checking step concludes
      THEN no further run of the whole probe set follows
- **Verification hint:** on the scratch-app fixture, plant a fault one criterion's probe catches, let the fix loop answer it with a fix commit that touches one file, and read the report's re-check section. It names the probes run again and lists the rest with a reason. Read the fix context's handoff to confirm the checker received only the SHA, and the session record to confirm the checker ran `git show --stat` or `--name-only` on it and nothing that prints contents.

## R3 — Old failures in the project's own tests are told apart from the last report, never by building the default branch

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** live
- **Last live gate:** never
- **Depends-on:** `.claude/skills/timone-verify/`, `process.md`
- **Criteria:**
    - GIVEN a build-health smoke with failing tests, and a previous check report on the default branch that lists the smoke's failures
      WHEN the checking step reports the smoke
      THEN each failing test is marked old when that list names it and new when it does not
      AND the report names the previous report it compared with
      AND no build or test run of the default branch is made for the comparison
    - GIVEN a build-health smoke with failing tests and no earlier list of smoke failures
      WHEN the checking step reports the smoke
      THEN it reports the failures without marking them old or new, and says there was no list to compare with
- **Verification hint:** on the scratch-app fixture, leave one failing test on the default branch and record it in a check report, then run a check on a phase that adds a second failing test. Read the report: one old, one new, the earlier report named. Search the session record for a checkout, build or test run of the default branch: there is none.

## R4 — Each part of a build runs the tests its change can affect, and everything runs whole once at the end

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** live
- **Last live gate:** never
- **Depends-on:** `.claude/skills/timone-execute/`, `process.md`
- **Criteria:**
    - GIVEN a phase file with several sub-phases
      WHEN the build runs one sub-phase
      THEN at its end it runs the tests its change can affect and every suite that takes under a minute, and not the other suites whole
      AND its own validation steps pass before the next sub-phase starts
      AND the earlier sub-phases' validation steps do not run again
    - GIVEN the last sub-phase of the phase is done
      WHEN the build closes the phase
      THEN every suite of the project runs whole once, and every sub-phase's validation steps run once more, before the completion report is written
    - GIVEN a phase that was built
      WHEN its completion report is read
      THEN it lists, for each sub-phase, which tests and suites it ran
- **Verification hint:** on the scratch-app fixture, build a phase of three sub-phases. Read the completion report: each sub-phase lists a subset of the browser suite and the whole unit suite; the close lists every suite run whole once. Count the whole browser suite runs in the session record: one.

## R5 — A box never holds a GitHub token that runs out before its next one arrives

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** api
- **Depends-on:** `src/adapters/credentials.ts`, `src/daemon/container-runtime.ts`
- **Falsified-by:** a test in `src/daemon/container-runtime.test.ts` that, on a fake clock, gives the token cache a token with less life left than the refresh interval, starts a box and refreshes it, and fails if the box is handed that token
- **Criteria:**
    - GIVEN the machine's token cache holds a token for a repository with less life left than the box refresh interval plus a margin of at least 10 minutes
      WHEN a box for that repository is started, or its token is refreshed
      THEN a new token is made, and the cached one is not handed to the box
    - GIVEN any token the machine hands a box
      WHEN it is handed over
      THEN it has more life left than the time until the box's next refresh, plus at least 10 minutes
    - GIVEN a token used by the machine itself, outside any box
      WHEN it is taken from the cache
      THEN the cache reuses it as it does today, until 5 minutes of life are left
- **Verification hint:** `npx vitest run src/adapters/credentials.test.ts src/daemon/container-runtime.test.ts`. Then make the falsifying test go red on purpose: hand the box the cached token regardless of its life, and the test must fail.
- ✏ 2026-10-03 — **verified on the builder's test, by fvermaut's decision.** He decided on 2026-10-03, in the terminal ([comment on #193](https://github.com/fvermaut/timone/pull/193#issuecomment-5966801325)), that this criterion is accepted on the test its `Falsified-by` line names, `"a box is never handed a token that dies before its next refresh"`. [Phase 42's verification, iteration 2](../../plans/phases/reports/phase-42-verification.md#iteration-2--after-42d-to-42f-and-fvermauts-decision-on-prd-06r5) ran that test by name: it passed.
