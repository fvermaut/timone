# Phase 45 — Departures

> One dated entry per departure from the plan or the requirements, appended, never rewritten. Format per `process.md` stage 6.

## 2026-10-04 — timone#204, execution

**Kind:** plan step
**Agreed:** 45b creates `src/daemon/chunk-zero.test.ts` as a **[NEW FILE]**.
**Did instead:** the file already exists, with one type-level test of `tryMergeChunkZero`. The phase file now marks it **[MODIFY]**; the existing test stays and 45b's cases are added beside it.
**Why:** a new file cannot be created where one already is, and replacing it would delete a test that guards PRD-05 R3.
