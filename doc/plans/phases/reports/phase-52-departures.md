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

## 2026-10-05 — timone#219, verification

**Kind:** check not run
**Agreed:** every criterion in the regression set is run against the build.
**Did instead:** 8 of the 9 were BLOCKED. PRD-05.R2, R3, R4, R5, R7, R10 and R11 stop while building their fixtures: each pushes to `main` in a repository under `/tmp`, and this run's container refuses every push that is not to this ticket's branch. PRD-05.R18 needs a replay on this build, which only a logged-in terminal can run. PRD-08.R5 passed. The guard was not switched off.
**Why:** the guard belongs to the container, not to the project, and getting round it is not this step's to do. The phase changes two documents and no program file, so none of the eight can have been changed by it; they are left to run outside the container: `npm run build && node doc/plans/phases/probes/run.mjs --regression`, and `npm run --silent replay`. Evidence: [phase-52-verification.md](phase-52-verification.md).

## 2026-10-05 — timone#219, verification

**Kind:** instruction not followed
**Agreed:** the runner's instructions for the check asked for `src/manifest.ts`, `src/commands/daemon.ts`, the planner code and ADR-0065 to be read, and the new text checked against them.
**Did instead:** none of them was read. Each statement was checked against the requirements register and against what the built program does when it loads a manifest. One sentence was found wrong; two statements no requirement covers (the planner takes no place; a change to `timone.yaml` needs a restart) were left unchecked and are named in the report.
**Why:** the check reads no source code and no decision records, so that it tests what the program does and not what its builder meant. Reading them would have broken that.
