# Phase 41 — Departures

> Every departure from the plan or the requirements during phase 41, one dated entry each, never rewritten.

## 2026-09-30 — timone#166, execution

**Kind:** plan step
**Agreed:** 41b deletes the tests 41a left on the current daemon's path, and keeps `successorHeldBack` and `watchForCancellations`.
**Did instead:** 41b first gives those two pieces of kept code a test each on a runner project, as its new cases (9) and (10), then deletes the old-only tests.
**Why:** 41a found that every test of those two pieces runs on the old path. Deleting them as planned would have left code the runner relies on with no test at all.
