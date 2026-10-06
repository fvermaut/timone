# Phase 54 — Completion Report

- **Date:** 2026-10-06
- **Plan:** [phase-54.md](../phase-54.md) — no list of pieces. This is a bug that triage sent straight to a plan, on the ticket, on 2026-10-06; like a chore, it has no breakdown, and it is judged on its pull request. The runner started this step.
- **Requirements:** PRD-02.R9 (SHOULD) — `verified` in the register, unchanged. This phase fixes a bug against it; the register is not touched.
- **Branch:** `timone/186-timone-status-asks-you-to-answer-on-abou`
- **Departures:** [`phase-54-departures.md`](phase-54-departures.md) — 3 entries.

## Summary

The last line of `timone status` now names a ticket only when one of its runs is parked and the runner asked for something. A finished run is never named, whatever old initiative picture sits beside it in the ledger. That is what [#186](https://github.com/fvermaut/timone/issues/186) asked for: on 2026-10-02 the line named about 80 finished tickets.

The fix is in `waitsOnYou` in `src/commands/status.ts`, which kept only its parked arm. Both arms that named a done run went: "pieces are left and none can start" (the one the ticket reports) and "the list of pieces grew since it was approved". With them went the reader of a list of pieces that only they used. `timone status` now reads no checkout and runs no git. 54b then deleted that reader's code from `src/daemon/poll.ts` and `src/daemon/breakdown.ts`, which nothing outside tests called any more; `daemon/breakdown.ts` left the checkout guard's list of git users.

The project's own line ("#7 … nothing to take" between steps) is untouched. Its five tests pass unchanged.

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 54a — the closing line never names a finished run | Landed first time. Cases 1, 2, 3 red then green. Case 4 was red before the change, not green as the plan said; plan amended (departure 2). | `739e502` |
| 54b — code that only fed the old rule is gone | Landed first time. Four working-tree read cases moved onto `readBreakdown`; four tests of the deleted git reader went with it. | `0ccd1c2` |

## Tests run

No suite was timed before the first slice: phase 53's close timed the whole suite at 8.9 s, under a minute. The runner asked that each part run only the tests of what it changes, and the whole suite once at the end (departure 1).

- **54a:** `src/commands/status.test.ts`, `src/guards/checkouts.test.ts`, `src/daemon/breakdown.test.ts` (98 passed); `src/planner/plan-files.test.ts` (4 passed); `src/cli.test.ts` after a build (7 passed); `tsc --noEmit` exit 0.
- **54b:** `src/guards/checkouts.test.ts`, `src/daemon/breakdown.test.ts`, `src/daemon/poll.test.ts`, `src/commands/status.test.ts`, `src/commands/breakdown.test.ts` (219 passed); the other importers of `poll.ts` and `breakdown.ts` — `src/commands/daemon.test.ts`, `src/commands/takeover.test.ts`, `src/daemon/prompts.test.ts`, `src/runner/actions.test.ts`, `src/runner/driver.test.ts` (460 passed); `tsc --noEmit` exit 0.
- **Close:** after `npm run build`, the whole suite once: 76 files, 1984 tests, 1914 passed, **70 failed**, 11.2 s. Every failure is in `src/commands/guardrails.test.ts`, `src/numbers.test.ts`, `src/workspace.test.ts` or `src/commands/number.test.ts`, each a push to `main` that this container refuses; the same four files fail the same 70 tests on `origin/main` (departure 3). Then each sub-phase's validation steps once, 54a then 54b; neither touches state outside the repository, so the order is safe. 54a: three files, 94 passed (`breakdown.test.ts` lost four tests in 54b); `tsc --noEmit` exit 0; no `done` left in `waitsOnYou`; no reader names left in `status.ts`. 54b: no removed name left in `src/`; `progressOf` only in `recording.ts`; five files, 219 passed.

## Screen comparison

None — the phase changes no screen. `timone status` prints to a terminal.

## Deviations from the plan

- `✏ 2026-10-06 (build, timone#186)` on 54a's case 4 and its checkbox: the case cannot be green before the change, because today's code also names the done runs #51 and #52 beside #53. It was red before and green after; what it protects, that #53 is named, held throughout.
- `✏ 2026-10-06 (build, timone#186)` on 54a's checkbox about "the four tests" of the project's line: the block holds five, and all five pass unchanged.
- The whole suite ran once, at the close, not at each sub-phase's end, as the runner asked (departure 1).
- 54b reworded 54a's dated note in `src/guards/checkouts.test.ts` so it no longer names `fromDefaultBranch`: 54b's own validation grep matches comments too. It also removed two more imports of `poll.ts` (`BreakdownRead`, `InitiativeRecord`) that only the deleted code used.

## Context for the next agent

- Run the suite with `npm run build && npx vitest run` inside `projects/timone`. `src/cli.test.ts` needs `dist/` built first. In this container, the 70 tests that push to `main` fail on any branch.
- What to check: with a ledger holding done runs and an initiative picture with steps left and no `next`, the last line of `timone status` says nothing is waiting; a parked run whose wait asks something is still named, once per ticket.
- No `live` criterion depends on the changed files. The regression set (PRD-07.R4, R6, R9) rides on the whole suite, since 54b touched `src/daemon/`.
