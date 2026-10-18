# Phase 64 — Departures

> One dated entry per departure from the plan or the requirements, appended, never rewritten. Format per `process.md` stage 6.

## 2026-10-18 — timone#250, build

**Kind:** plan step
**Agreed:** cases 3, 4, 6 and 9 already pass before the change, as guards that the fix does not stop the check firing.
**Did instead:** case 6 failed in the run before the change. The test was kept as the plan declares it.
**Why:** case 6 reads the fault's `remedy`, a field that does not exist before the change, so it fails for the same reason as case 5. The guard part of it, that the rule still fires as `watched-only`, is covered by the existing test "flags a universal closed by watching alone", which passed in that run.

## 2026-10-18 — timone#250, build

**Kind:** check not run
**Agreed:** `npx vitest run` over the whole suite exits 0.
**Did instead:** in this container it exits 1, with 70 failed and 2759 passed after `npm run build`. Without the change, 71 fail: the same 70 and `this repository's own registers`, which this phase fixes.
**Why:** this container refuses every `git push … main`, also the pushes the tests make into their own temporary repositories (`guardrails.test.ts`, `numbers.test.ts`, `workspace.test.ts`, `commands/number.test.ts`). The whole suite has to be run once on a machine without that refusal.

## 2026-10-18 — timone#250, verification

- **What could not be checked here.** Parts of three older checks were BLOCKED in this container, and nothing they check failed: PRD-05.R2 clause 2b needs a GitHub login that can read scratch-app's pull requests; PRD-05.R7 clause 1 (runner) and PRD-05.R18 clauses 1a, 1b, 1c, 2a and 2b need a replay of the runner on this build against the real model (`npm run --silent replay`, from a terminal with a model login). Every other part of all 20 older checks passed.
- **The 70 tests the container refuses** fail on the container's refusal of a push to `main` inside their own test repositories, as the completion report says. They should be run once on a machine that does not refuse that push.
- Evidence: [phase-64-verification.md](phase-64-verification.md), *Evidence* and *Carried forward*.
