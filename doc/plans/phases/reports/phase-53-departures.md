# Phase 53 — Departures

> One dated entry per departure from the plan or the requirements, appended, never rewritten. Format per `process.md` stage 6.

## 2026-10-05 — timone#218, execution

**Kind:** plan step
**Agreed:** At the end of each sub-phase, run the tests the change can affect and every suite that takes under a minute, whole. The project's one suite (vitest) took 8.1 s at phase 51's close, so it would run whole at the end of every sub-phase.
**Did instead:** Each sub-phase ran only the tests of the files it changed and of the code that uses them. The whole suite ran once, at the close.
**Why:** The runner's instructions for this step said: "While you work, run only the tests of what you change; run the whole test suite once at the end."

## 2026-10-05 — timone#218, execution

**Kind:** plan step
**Agreed:** Sub-phase 53a's second check: every existing case of its five test files passes unchanged, apart from the `namesACommand` helper.
**Did instead:** Two existing cases that compare the whole spending limit notice word for word, one in `src/runner/actions.test.ts` and one in `src/daemon/poll.test.ts`, gained the new sentence line, with that run's ticket number. Nothing else in them changed. The plan's check is amended in place.
**Why:** Case 4 of the same sub-phase, and PRD-09 R1, require that notice to carry the sentence. No correct build can leave a word-for-word copy of the old notice passing.

## 2026-10-05 — timone#218, execution

**Kind:** check not run
**Agreed:** At the close, the whole test suite passes.
**Did instead:** The whole suite ran once: 76 files, 1984 tests, 1914 passed, 70 failed. Every failure is in `src/commands/guardrails.test.ts` (45), `src/numbers.test.ts` (16), `src/workspace.test.ts` (6) or `src/commands/number.test.ts` (3). Each one is a test that pushes to a branch named `main` in a scratch repository, and this container refuses that push. The same four files, run on `origin/main` without this phase, fail the same 70 tests.
**Why:** The container's push guard lets this run push only to its own branch. These 70 tests cannot pass here, whatever the phase does; they need a run outside this container.
