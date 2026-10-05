# Phase 50 — Completion Report

- **Date:** 2026-10-05
- **Plan:** [phase-50.md](../phase-50.md) — piece 4 of the [list of pieces for #197](../../breakdowns/ticket-197.md), approved by fvermaut 2026-10-04T06:34:53Z — 6 pieces
- **Requirements:** PRD-07.R7 (MUST) — `draft`; PRD-07.R14 (MUST) — `draft`. Execution does not change them; the check sets them.
- **Branch:** `timone/202-4-the-update-after-a-merge`
- **Departures:** [`phase-50-departures.md`](phase-50-departures.md) — 3 entries: the test rhythm the runner asked for; the real replay not run (no model login in this container); the guard test granted to 50c at the close.

## Summary

An open pull request whose branch falls behind the default branch is now noticed. On every cycle, for each run with an open pull request, no step running and no hold, code asks GitHub how far the branch is behind and what the default branch's head is. When it is behind, the runner is woken once for that head (50a). The runner has a new step, `update`, and a rule that says to start it when told the branch is behind. The step takes a place like every step, is not asked of the planner, and may run the check scripts as the check does (50b).

The update session follows new written instructions, `.claude/skills/timone-update/SKILL.md` (50e). It merges the default branch in, never rebases, and asks `node dist/cli.js update-checks <project> --before <commit>` (50c) which three test sets to run: the project's whole test suite, the check scripts of its own plan, and those of each plan that arrived on the default branch. It hands each conflict and failing test to a fresh fix context, at most two test fixes, and appends one entry to `doc/plans/phases/reports/phase-NN-update.md`. After every step, code reads the newest entry and writes a section at the top of the pull request, above the departures (50d). A missing or failed test set makes the section say the work does not pass, whatever the entry's result line says. `process.md`, the delivery instructions, `CONTEXT.md` and PRD-07 describe this (50f).

Most of the weight is in 50a (when to ask, once per head) and 50d (the section code writes, which no session can change). The update itself is instructions, watched only in the live gate.

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 50a — a pull request behind the default branch wakes its runner, once per head | landed; cases 1–8; first try | `409c117` |
| 50b — `update` is a step the runner starts | landed; cases 1–6; dry replay 20 of 20; real replay not run (departure 2) | `a8ea03b` |
| 50c — `update-checks` names the three test sets | landed; cases 1–7; one fix at the close for the git-users guard (departure 3) | `e421f26`, fix `611b26f` |
| 50d — the update's record becomes the section at the top of the pull request | landed; cases 1–8; departures tests unchanged | `ebcd9c7` |
| 50e — the update's instructions | landed; record form identical to the plan and to what code reads | `1ff0939` |
| 50f — process.md, delivery instructions, CONTEXT.md, PRD-07 | landed; no `Status:` line changed | `cea51e3` |

## Tests run

No suite was timed before the first slice: phase 49's close timed the whole suite at 3.9 s, under a minute. The whole suite was still run once before the first slice, as a starting point: 73 files, 1852 tests, all passed. The runner asked that each slice run only the tests of what it changes, and the whole suite once at the end (departure 1). `npm run replay` was tried once before the first slice and failed on every case with "Not logged in" (departure 2).

- **50a:** `src/runner/driver.test.ts`, `src/adapters/` (221); then `src/runner/actions.test.ts`, `src/runner/replay/harness.test.ts`, `src/runner/facts.test.ts`, `src/planner/`, `src/commands/daemon.test.ts`, `takeover.test.ts`, `src/daemon/chunk-zero.test.ts`, `hooks.test.ts`, `poll.test.ts` (410). Pass.
- **50b:** `src/daemon/`, `src/runner/` (1259); `npm run replay -- --dry` 20 of 20; `src/guards/checkouts.test.ts`, `src/commands/`, `src/planner/`, `src/cli.test.ts`, `src/process-text.test.ts` (323). Pass.
- **50c:** `src/update-checks.test.ts`, `src/update-checks.git.test.ts`, `src/cli.test.ts` (16); `src/merge-rules.git.test.ts` (6). Pass. It did not run `src/guards/checkouts.test.ts`, which failed at the close.
- **50d:** `src/runner/` (232); `src/commands/daemon.test.ts`, `src/daemon/poll.test.ts`, `src/planner/`, `src/commands/takeover.test.ts`, `src/daemon/chunk-zero.test.ts`, `hooks.test.ts` (326). Pass.
- **50e:** `src/daemon/prompts.test.ts` (228); `src/process-text.test.ts`, `src/planner/plan-files.test.ts`, `src/daemon/hooks.test.ts` with it (351). Pass.
- **50f:** `src/process-text.test.ts`, `src/planner/plan-files.test.ts`, `src/daemon/prompts.test.ts` (275). Pass.
- **Close:** the whole suite once, after `npm run build`: first run 76 files, 1908 tests, **1 failed** — `src/guards/checkouts.test.ts`, "performs git only where somebody said so": `commands/update-checks.ts` runs git and was not on the guard's list. The plan was amended to grant that file to 50c, a fresh fix context added the entry (`611b26f`), and the whole suite ran again: **76 files, 1908 tests, all passed, 5.8 s.** Then every sub-phase's validation steps once, in the order 50a to 50f; none resets shared state, so written order was safe: `tsc --noEmit` exit 0; 50a 223; 50b 1267 and dry replay 20 of 20; 50c 16 and `update-checks no-such-project` exit 2; 50d 232, `departures.ts` and its test unchanged; 50e skill present, `update-checks` named 7 times, every `rebase` line forbids it, prompts 228; 50f `ADR-0066` in all three files, `phase-50` in PRD-07, no `Status:` line changed. No file of the phase contains a probe folder's path (counted against `PROBE_DIRECTORIES`: 0).

## Screen comparison

None — the phase changes no screen. (The section at the top of a pull request is GitHub text.)

## Deviations from the plan

- ✏ 2026-10-05 (build, timone#202) — 50c's file list gains `src/guards/checkouts.test.ts`, because the whole suite failed on the guard that lists every source file that runs git. Departure 3.
- ✏ 2026-10-05 (build, timone#202) — the phase file gains *Questions that came up while building, and the choice made*: a project with no test command always reads as not passing; a branch already level ends as "not what the run says"; how a check script is found by name was not checked against the real files; a forge failure while reading the update record skips the departures write too.
- The real replay set was not run (departure 2). The dry run passed every case, the new one included.

Everything the plan called for landed.

## Context for the next agent

- **Build and test:** `npm run build`, then `npx vitest run` (the whole suite, about 6 s). `npm run replay -- --dry` checks the replay wiring with no model; `npm run replay` needs a model login.
- **Try the command:** at the Timone root, `node dist/cli.js update-checks <project> [--before <commit>] [--json]`. Run it before the merge, or after it with `--before`.
- **Checks owed** (the plan's *What this phase owes before delivery*): the regression set it names; and a live gate for PRD-07.R7 and R14 on scratch-app, never ivtrends, which needs the daemon on the operator's machine and rides to the pull request as an unticked check. The real `npm run replay` also rides there.
- **Known and not resolved:**
  - The four questions in the phase file, for the person reviewing.
  - The git-users guard in `src/guards/checkouts.test.ts` did not see that `update-checks` resolves a project's path: its pattern `resolve(...\.path)` stops at the `)` of `process.cwd()`. The file runs only read-only git, so this is a gap in the guard, not a fault in the command.
  - `src/runner/replay/harness.test.ts`'s top comment still says nineteen cases; there are twenty.
  - Refactors left for review: `aheadOfDefault` and `behindDefault` repeat the same compare call; `withUpdate` repeats `withDepartures` with other markers; the probe guard capitalises a stage name inline.
