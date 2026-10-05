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

## 2026-10-05 — timone#217, build

**Kind:** plan step
**Agreed:** 51c ends the wait with the "moved on" sentence when the run is no longer `active` with this terminal as waiter, and not claimed for it. Four cases.
**Did instead:** The run counts as moved on only when two looks in a row see it so. A fifth test, at the same seam (`runTakeover`), shows a run seen parked once and claimed on the next look opening the session. Two existing tests in `src/commands/takeover.test.ts` that expected "I'm working on … right now" for an `active` run with no daemon now expect the "no daemon" sentence, as case 1 requires.
**Why:** The step's end parks the run and then claims it for the terminal in two writes to the ledger file. The terminal is another process and can read between them. On one look it would say "moved on" and leave a claim that nobody opens, and the runner is not woken after a hand-over.

## 2026-10-05 — timone#217, build

**Kind:** check not run
**Agreed:** At the close, the whole suite runs once and passes (51e's validation: `npx vitest run`, exit 0).
**Did instead:** The whole suite ran once: 76 files, 1932 tests, 1862 passed, 70 failed, in four files — `src/commands/guardrails.test.ts` (45), `src/numbers.test.ts` (16), `src/workspace.test.ts` (6), `src/commands/number.test.ts` (3). Each of these tests pushes to `main` in a temporary repository, and this container's push guard refuses it ("Refused: this run may push only to `timone/217-…`"). The same four files fail the same 70 tests on `origin/main`, checked out apart, with none of this phase's changes. These 70 tests were not run in a place where they can pass.
**Why:** The container lets a run push only to its own branch, and the push guard also applies inside the tests' temporary repositories. Nothing this phase changed touches those four files or the code they test.
