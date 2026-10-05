# Phase 50 — Departures

> One entry per departure, appended in order, never rewritten. Format per `process.md` stage 6.

## 2026-10-05 — timone#202, build

**Kind:** plan step
**Agreed:** At the end of each sub-phase, run the tests the change can affect and every suite that takes under a minute, whole. The whole suite took 3.9 s in phase 49's close, so it would run whole at the end of every sub-phase.
**Did instead:** Each sub-phase ran only the tests of the files it changed and of the code that uses them. The whole suite ran once before the first sub-phase (73 files, 1852 tests, all passed) and runs once at the close.
**Why:** The runner's instructions for this step asked for exactly this: run only the tests for what you change while working, and the whole suite once at the end.

## 2026-10-05 — timone#202, build

**Kind:** check not run
**Agreed:** 50b's validation runs `npm run replay`, the replay set on the real model, and expects every case to pass, the new `update` case included.
**Did instead:** Before the first slice, `npm run replay` was run once: every case failed with "Not logged in · Please run /login", because this container has no model login. 50b runs `npm run replay -- --dry` and `src/runner/replay/harness.test.ts` instead. The real replay is left for the operator, and the pull request should list it as a check not run.
**Why:** The replay set asks a model for each case, and nothing in this container can log in to one. The same happened in phase 49.

## 2026-10-05 — timone#202, build

**Kind:** plan step
**Agreed:** 50c's files were `src/update-checks.ts`, `src/commands/update-checks.ts`, `src/cli.ts` and their tests. Its validation ran only those tests.
**Did instead:** At the close, the whole suite failed one test in `src/guards/checkouts.test.ts`. That test lists every source file allowed to run git, each with a reason, and `src/commands/update-checks.ts` runs git but was not on the list. The plan was amended to grant that test file to 50c, and a fresh fix context added the entry with its reason. The fix is its own commit.
**Why:** The guard exists so that no new file runs git without someone writing down why. The new command does run git, read-only, in the project's checkout from a session in the box, so the honest fix is the entry, not a change to the command.
