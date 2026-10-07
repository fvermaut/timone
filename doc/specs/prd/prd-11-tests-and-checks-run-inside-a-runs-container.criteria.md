# PRD-11 Acceptance Criteria — Tests and checks run inside a run's container

> Formal register for [prd-11-tests-and-checks-run-inside-a-runs-container.md](prd-11-tests-and-checks-run-inside-a-runs-container.md).
> Maintained by: timone-prd (creation), timone-verify (status),
> timone-prd (revisions). Requirement IDs are stable — never renumber.

In this register, **a run's container** is a shell whose environment carries the git settings a run's container sets: `core.hooksPath` pointing at the push guard, set through the environment as [`installPushGuard`](../../../src/daemon/push-guard.ts) returns it, with the run's own branch named. A run's real container is one; a shell on any machine given that environment is another, and is how these criteria can be checked outside a run. **The run's git settings** are those environment variables. **A throwaway repository** is a git repository a test or a check makes for itself under the system's temporary folder. **The older checks** are the scripts in the `probes` folder under `doc/plans/phases`, which only the step that checks a build reads and runs.

## R1 — The whole test suite passes inside a run's container

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN a run's container, on the build of this change
      WHEN `npm run build && npx vitest run` is run in the project
      THEN no test fails, and no test output holds the guard's `Refused: this run may push only to` line
    - GIVEN the same build, in a shell with no run's git settings
      WHEN the same command is run
      THEN no test fails
    - GIVEN the four files that failed on #219: `src/commands/guardrails.test.ts`, `src/numbers.test.ts`, `src/workspace.test.ts`, `src/commands/number.test.ts`
      WHEN their tests are counted before and after the change
      THEN no test was removed or skipped to make the suite pass
- **Falsified-by:** the suite itself, run in a run's container: on `main` at `64f705b` it fails 70 tests in those four files, each on the guard's refusal.
- **Verification hint:** inside a run's container, run the suite as above. Outside one, build the environment with `installPushGuard` from `dist/daemon/push-guard.js`, as [`src/daemon/push-guard.git.test.ts`](../../../src/daemon/push-guard.git.test.ts) does, and run the suite under it. Compare the four files' test names with `main`.

## R2 — Timone's own code, called by a test, pushes to the throwaway repository

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN a test that calls Timone's own code, and that code runs git itself on a throwaway repository (for example `reserveNumber` in `src/numbers.ts`, or the workspace sync in `src/workspace.ts`)
      WHEN the test runs inside a run's container
      THEN the code's own pushes reach the throwaway repository, and the test passes
    - GIVEN the change for this ticket
      WHEN its diff is read
      THEN the way the test makes this work is in test files or test set-up only: no program file under `src/` that is not a test starts running git without the run's git settings
- **Verification hint:** `npx vitest run src/numbers.test.ts src/workspace.test.ts src/commands/number.test.ts` in a run's container. `git diff --name-only origin/main...HEAD -- src` should name test files and test helpers only, or program files whose change does not touch the environment their git runs with.

## R3 — The guard still refuses a push to the project's real main

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN a run's container, on the build of this change, in the project's real checkout
      WHEN a session runs `git push --dry-run origin HEAD:main`
      THEN git refuses it with the guard's `Refused:` line, and exits non-zero (a dry run sends nothing, and git runs the `pre-push` hook for it)
    - GIVEN the same container
      WHEN a session runs Timone's own code for real, outside a test, and that code pushes
      THEN the push goes through the guard as before this change
    - GIVEN the change for this ticket
      WHEN its diff is read
      THEN it does not change `src/daemon/push-guard.ts` or the git settings set by `src/daemon/container-runtime.ts`
- **Falsified-by:** the tests in `src/daemon/push-guard.git.test.ts` and `src/daemon/push-guard.test.ts`, which must pass unchanged.
- **Verification hint:** the dry-run push above, run in the project checkout inside a run's container. `git diff origin/main...HEAD -- src/daemon/push-guard.ts src/daemon/container-runtime.ts` prints nothing.

## R4 — The 7 older checks run inside a run's container

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN a run's container, on the build of this change
      WHEN the older checks of PRD-05.R2, R3, R4, R5, R7, R10 and R11 are run, real runs only
      THEN each one reaches PASS or FAIL, and none stops on the guard's refusal of a push to a throwaway repository
    - GIVEN the same checks in a shell with no run's git settings
      WHEN they are run
      THEN each gives the same verdict as inside the container
- **Falsified-by:** the same checks on `main` at `64f705b`, which stop BLOCKED on the guard ([check report of #219](../../plans/phases/reports/phase-52-verification.md), section *Regression*).
- **Verification hint:** run the regression set as the check report of #219 ran it (its *Environment* and *Regression* sections give the command and `PROBE_REAL_ONLY=1`), and read each of the seven's verdicts.

## R5 — Only the checking step changes the older checks

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN the pull request for this ticket
      WHEN its commits are listed with their `Timone-Stage:` trailers
      THEN every commit that changes one of the older checks names the stage that checks a build (`verification`)
      AND no commit made by the stage that builds (`execution`) changes one
- **Verification hint:** on the pull request's branch, list `origin/main..HEAD` with each commit's `Timone-Stage` trailer and the files it changes, and look at the commits that change the older checks' folder.
