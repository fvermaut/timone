# Phase 51 — Departures

> One entry per departure, appended in order, never rewritten. Format per `process.md` stage 6.

## 2026-10-05 — timone#217, build

**Kind:** plan step
**Agreed:** At the end of each sub-phase, run the tests the change can affect and every suite that takes under a minute, whole. The whole suite took 5.8 s in phase 50's close, so it would run whole at the end of every sub-phase.
**Did instead:** Each sub-phase ran only the tests of the files it changed and of the code that uses them. The whole suite ran once before the first sub-phase, after `npm run build` (76 files, 1908 tests, all passed, 7.3 s), and runs once at the close.
**Why:** The runner's instructions for this step asked for exactly this: run only the tests of what you change while working, and the whole suite once at the end.

## 2026-10-05 — timone#217, build

**Kind:** plan step
**Agreed:** 51a changes one existing test, the `poll.test.ts` case that expected a takeover of a running run to be refused. Every other existing case of the four test files passes unchanged.
**Did instead:** Two more existing cases in `src/commands/takeover.test.ts` changed. "resolveTakeover > says what it is doing instead when the ticket is being worked on" expected the "I'm working on … right now" answer for a running run; it now checks case 7's answer, that the takeover waits for the step. The cancelled-ticket case only had its type check widened, because the answer gained a third kind; its assertions are the same.
**Why:** Case 7 of the plan asks for the opposite of the first test, so both cannot hold. The plan named only the `poll.test.ts` case and missed this one.
