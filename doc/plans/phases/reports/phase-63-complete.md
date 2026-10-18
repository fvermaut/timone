# Phase 63 — Completion Report

- **Date:** 2026-10-18
- **Plan:** [phase-63.md](../phase-63.md) — no list of pieces: a chore, worked by hand in a terminal session fvermaut started ("fix timone#209"). No daemon run drove it.
- **Requirements:** un-anchored chore work, as the plan's stamp says. No requirement is claimed, and no status in a register was changed.
- **Branch:** `timone/209-a-step-that-asks-for-approval-ends-its-c`
- **Departures:** [`phase-63-departures.md`](phase-63-departures.md) — 1 entry: 63a's last check leaves out the register test that already fails on `main`.

## Summary

The requirements step and the step that works out the pieces are now told to ask for the approval themselves. Each step's comment links the file on the branch and ends with a fixed line: `**What I need from you:** read the requirements and reply "approved", or say what to change.`, or the same with "the list of pieces". The old paragraph, which said the machinery posts the approval request after the step's comment, is gone from both prompts. Nothing has posted that request since ADR-0060, so steps that obeyed it ended with "nothing" while the run waited, and the runner had to correct them each time (timone#209).

One exception is described in words: when the runner's instructions for the step say it skipped the approval, nobody is asked, and the comment ends with "nothing". The exact sentences the skills look for (`SKIPPED_REQUIREMENTS_APPROVAL`, `SKIPPED_PIECES_APPROVAL`) are not copied into the step's own text, and a test keeps it so.

The change is one shared private block, `approvalAskBlock`, in `src/daemon/prompts.ts`, used by both prompts, and 20 tests at `stagePrompt`. The runner's rules (`src/runner/brief.ts`) are unchanged; its rule to correct a false newest comment stays as the safety net.

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 63a — the two step prompts ask for the approval in their own comment | Built in one attempt. 10 of the 20 new tests fail on the old prompts and all 20 pass on the new ones. One plan step amended (departure 1). | `0a9701c` |

## Tests run

No suite was timed before the slice: phase 62's close timed the whole suite at 7.9 s in its container, and a baseline run here, before any change, took 22 s, so it takes under a minute and runs whole.

**Known before any change, on this Mac:** the whole suite on the branch as planned (`0a31fb5`, `main` plus the plan) fails 1 test: `src/daemon/register.test.ts > this repository's own registers > claim nothing they have not established` (PRD-07 R3, timone#250).

- **63a:** `src/daemon/prompts.test.ts` 275 of 275; `src/daemon`, `src/runner` and `src/commands/takeover.test.ts` without the register test, 2115 of 2115; the whole suite once, 2819 of 2820, the same one failure; `tsc` exit 0.
- **Close:** the whole suite once: 78 files, 2820 tests, 2819 passed, 1 failed — the known register test — in 22 s. Then 63a's checks once (nothing in them changes anything outside the repository): `prompts.test.ts` 275 of 275 (exit 0), `tsc` exit 0, `grep "posts the approval request"` no line (exit 1, as expected), the three folders without the register test 2115 of 2115 (exit 0). The orchestrator also ran the new block against the old `prompts.ts` (stashed): 10 failed, 10 passed, matching the handoff.

## Screen comparison

None — the phase changes no screen.

## Deviations from the plan

- `✏ 2026-10-18 (build, timone#209)` in 63a's validation block: the last check leaves out `src/daemon/register.test.ts`, which fails on `main` before this phase and reads a register, not a prompt. Recorded in the departures file.

Everything else landed as planned.

## Context for the next agent

- Run the tests with `npx vitest run src/daemon/prompts.test.ts`; the new block is `describe("the step that writes a file for approval asks for it (timone#209)")`. The whole suite is `npx vitest run`; expect the one known register failure.
- **The live gate the plan names is owed:** PRD-02.R4 is `live` and depends on `src/daemon/`. What would show it: a requirements step on a scratch-app ticket whose own comment links the requirements and ends with the approval line, and no second comment from the runner after it. Only fvermaut can run it with the daemon, so it rides to the pull request.
- **Not watched by any test:** that a step's model follows the new paragraph. Only a live step shows that. After the merge, the next requirements step and the next step that works out the pieces, on any project, are the evidence #209 waits for.
- Run timone#209/1 is still parked in the daemon's ledger since 2026-10-07, with no branch. A permission check refused to cancel it from this session. When the pull request merges and the ticket closes, the daemon drops the run on its own.
