# Phase 56 — Departures

> One dated entry per departure from the plan or the requirements, appended, never rewritten. Format per `process.md` stage 6.

## 2026-10-08 — timone#229, execution

**Kind:** check not run
**Agreed:** The last validation command of 56a and of 56b runs the whole suite at the end of each sub-phase.
**Did instead:** Each sub-phase ran the test files its change can affect: the guard's own tests, `stage.test.ts`, the whole of `guardrails.test.ts`, and every other test file that imports the files it changed. The whole suite ran once, at the close of the phase.
**Why:** The runner's instructions for this step said to run only the tests of the changed files while working, and the whole suite once at the end.

## 2026-10-08 — timone#229, verification

**Kind:** check not run
**Agreed:** Every criterion in scope is checked, including the standing regression set.
**Did instead:** PRD-05.R18 was not checked: all 3 of its clauses are BLOCKED. Clause 1 of PRD-05.R7 (the real runner) and clause 2b of PRD-05.R2 (reading GitHub) were not checked either; both criteria still pass on their other clauses. Every other criterion in scope passed.
**Why:** PRD-05.R18 needs a replay of the recorded failures on this build against the real model (`npm run --silent replay`, from a terminal signed in to the model). This container has no such sign-in and cannot read GitHub. See [phase-56-verification.md](phase-56-verification.md), *Regression* and *Carried forward*.
