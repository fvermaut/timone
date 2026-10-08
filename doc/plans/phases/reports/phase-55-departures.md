# Phase 55 — Departures

> One entry per departure from the plan or the process, appended in order, never rewritten.

## 2026-10-08 — timone#228, execution

**Kind:** plan step
**Agreed:** The process runs every suite that takes under a minute whole at the end of each sub-phase. Phase 54's close timed the whole suite at 11.2 s, so it would run whole after 55a and after 55b.
**Did instead:** Each sub-phase ran only the tests of the files it changed, plus `src/guards`, which 55a's plan names. The whole suite ran once, in 55c and at the close.
**Why:** The runner's instructions for this step asked for exactly that: run only the tests of the changed files while working, and the whole suite once at the end. Phase 54 did the same for the same reason.
