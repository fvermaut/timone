# Breakdown

**Status:** Awaiting approval

1. **Tests and older checks make their test repositories without the run's git settings** — the whole test suite, and the 7 older checks that were blocked on #219, run inside a run's container and give a real answer, while the push guard stays as it is.
   - The four test files that failed on #219 (`src/commands/guardrails.test.ts`, `src/numbers.test.ts`, `src/workspace.test.ts`, `src/commands/number.test.ts`) run git without the run's git settings when they make and use their throwaway repositories, as `src/daemon/push-guard.git.test.ts` already does. No test is removed or skipped.
   - This covers the git that Timone's own code runs while a test calls it (`reserveNumber`, the workspace sync). It is done in the tests' set-up, not in program files, and not for the whole test run.
   - The push guard and the git settings of the container do not change. A push to the project's real `main` from a run's container is still refused.
   - The older checks of PRD-05.R2, R3, R4, R5, R7, R10 and R11 are changed by the step that checks the build, not by the step that builds. The step that builds changes test files only.
   - Delivers PRD-11 R1, R2, R3, R4 and R5.
   - Needs: nothing.

**Order:** 1.

**Why one piece:** the tests and the older checks fail for the same reason and are fixed the same way. The older checks can only be changed by the step that checks a build, and that step runs on this piece anyway, because it must show the 7 checks reach a verdict. A second piece for them alone would be a pull request with nothing for the building step to do.
