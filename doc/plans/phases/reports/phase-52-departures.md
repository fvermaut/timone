# Phase 52 — Departures

> One entry per departure from the plan or the requirements, appended, never rewritten. Format per `process.md` stage 6.

## 2026-10-05 — timone#219, execution

**Kind:** plan step
**Agreed:** `internal-tools` keeps no `places` line, "and its existing comment says it has the default 2 places".
**Did instead:** the comment above `internal-tools` in `timone.example.yaml` gains the words that it has the default 2 places. The phase file is amended in place with a marker.
**Why:** the existing comment does not say so. It names the empty stack, the missing preview, the introductions and the instructors only, so the plan's sentence could only be made true by adding the words.

## 2026-10-05 — timone#219, execution

**Kind:** check not run
**Agreed:** the whole test suite runs once at the end of the slice and once at the close, and passes.
**Did instead:** the suite ran, and 70 of its 1908 tests failed in 4 files: `src/commands/guardrails.test.ts`, `src/numbers.test.ts`, `src/workspace.test.ts` and `src/commands/number.test.ts`. Each one pushes to `main` in a temporary repository, and this run's container refuses every push to `main`. With this phase's changes set aside (`git stash -u`), `src/numbers.test.ts` and `src/commands/number.test.ts` failed the same way, 19 of 20, so the change is not the cause. The guard was not switched off to run them.
**Why:** the guard belongs to the container, not to the project, and switching it off is not this step's to do. The phase changes only two documents and no test reads them, so these 70 tests are left to run outside the container.
