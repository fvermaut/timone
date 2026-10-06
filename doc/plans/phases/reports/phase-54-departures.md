# Phase 54 — Departures

> One dated entry per departure from the plan or the requirements, appended, never rewritten. Format per `process.md` stage 6.

## 2026-10-06 — timone#186, execution

**Kind:** plan step
**Agreed:** At the end of each sub-phase, run the tests the change can affect and every suite that takes under a minute, whole. The project's one suite (vitest) took 8.9 s at phase 53's close, so it would run whole at the end of every sub-phase. Sub-phase 54a's and 54b's validation blocks each end on the whole suite.
**Did instead:** Each sub-phase ran only the tests of the files it changed and of the code that uses them. The whole suite ran once, at the close.
**Why:** The runner's instructions for this step said: "While you work, run only the tests of what you change. Run the whole test suite once, at the end."

## 2026-10-06 — timone#186, execution

**Kind:** plan step
**Agreed:** Sub-phase 54a's case 4, the control: a parked run on #53 that asked, beside done runs on #51 and #52 and a picture with steps left and no `next`, names `scratch-app #53` and only it, "green before and after".
**Did instead:** The case was red before the change and green after. The plan's case and its checkbox are amended in place.
**Why:** Today's code also names the done runs #51 and #52 in that state, which is the fault this phase fixes, so the expected line cannot hold before the change. The part the case protects, that #53 is named, held before and after.
