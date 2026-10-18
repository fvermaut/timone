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
