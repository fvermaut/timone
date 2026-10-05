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
