# Phase 47 — Departures

> One dated entry per departure from the plan or the requirements, appended, never rewritten. Format per `process.md` stage 6.

## 2026-10-04 — timone#201, execution

**Kind:** plan step
**Agreed:** At the end of each sub-phase, run the tests the change can affect, and every suite that takes under a minute, whole. The project's one vitest suite took 3.4 s at phase 46's close, so it counts as under a minute.
**Did instead:** Each sub-phase ran its own validation commands and the test files its change can affect. The whole suite ran once, at the close.
**Why:** The runner's instructions for this step asked for exactly this: "run only the tests of what you change; run the whole test suite once at the end". Phase 46 did the same, for the same reason.

## 2026-10-04 — timone#201, execution (47a)

**Kind:** plan step
**Agreed:** In 47a, the tests of `src/runner/driver.ts` change only where they built a `queued` run.
**Did instead:** Three tests in the driver's "project was busy (40u)" describe built no `queued` run but relied on a run just picked up holding the project. Their setup now gives the other run a running step. What they expect did not change.
**Why:** ADR-0063 D1 says a run just picked up takes no place, so those tests could not pass with their old setup. 47c rewrites that describe anyway.

## 2026-10-04 — timone#201, execution (47a)

**Kind:** plan step
**Agreed:** 47c says that after a wake whose `start_step` was refused for want of a place, `giveBack` is called when the place is given to the run, and the run "stays waiting".
**Did instead:** `giveBack` takes the place back and gives it to the next waiting run, and the run does not wait any more.
**Why:** With one place, a run that gave its place back and still waited would come first again and be given the same place at once. ADR-0063 D3 says a place given and not used goes to the next run.
