# Phase 56 — Departures

> One dated entry per departure from the plan or the requirements, appended, never rewritten. Format per `process.md` stage 6.

## 2026-10-08 — timone#229, execution

**Kind:** check not run
**Agreed:** The last validation command of 56a and of 56b runs the whole suite at the end of each sub-phase.
**Did instead:** Each sub-phase ran the test files its change can affect: the guard's own tests, `stage.test.ts`, the whole of `guardrails.test.ts`, and every other test file that imports the files it changed. The whole suite ran once, at the close of the phase.
**Why:** The runner's instructions for this step said to run only the tests of the changed files while working, and the whole suite once at the end.
