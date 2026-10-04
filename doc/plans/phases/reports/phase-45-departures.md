# Phase 45 — Departures

> One dated entry per departure from the plan or the requirements, appended, never rewritten. Format per `process.md` stage 6.

## 2026-10-04 — timone#204, execution

**Kind:** plan step
**Agreed:** 45b creates `src/daemon/chunk-zero.test.ts` as a **[NEW FILE]**.
**Did instead:** the file already exists, with one type-level test of `tryMergeChunkZero`. The phase file now marks it **[MODIFY]**; the existing test stays and 45b's cases are added beside it.
**Why:** a new file cannot be created where one already is, and replacing it would delete a test that guards PRD-05 R3.

## 2026-10-04 — timone#204, execution

**Kind:** check not run
**Agreed:** the whole test suite takes about 4 seconds, so under the build rules each sub-phase runs it whole at its end.
**Did instead:** after 45b, the person running the build asked that no slice run the whole suite again: each slice runs only the tests of the files it changes and of the code that uses them, and the whole suite runs once, at the close. 45a and 45b had each run it once at their end (and 45b's slice once more); 45c, 45d and 45e do not.
**Why:** an instruction from the person running the build, given while 45b was being checked.
