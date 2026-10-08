# Phase 57 — Completion Report

- **Date:** 2026-10-08
- **Plan:** [phase-57.md](../phase-57.md) — breakdown [ticket-87.md](../../breakdowns/ticket-87.md) approved by fvermaut 2026-10-08 — 2 pieces; this phase is piece 2.
- **Requirements:** PRD-10.R1 (MUST), R2 (MUST), R3 (MUST), R6 (MUST), R7 (SHOULD) — all still `draft` in the register; verification decides. R8 (`live`, SHOULD) is not built here: it is observed on the next supervised run.
- **Branch:** `timone/230-2-each-container-knows-its-step-and-the`
- **Departures:** [`phase-57-departures.md`](phase-57-departures.md) — 2 entries, both test assertions the plan said would not change.

## Summary

Every session the runner starts now names its step. The request carries a required `stage`, the runner fills it in at both places it starts a session (the step session and the session that records an approval), and the container puts it in its environment as `TIMONE_RUN_STAGE`, forwarded by name next to `TIMONE_RUN_PROJECT`. A project's environment file may not set it.

The guard reads that step when the ledger has no run for the session. The ledger still wins when it has one. In a container the declaration made with `timone stage` is not read, so a builder cannot declare itself the checker. In a container the guard never asks: a step that neither builds nor checks, and a missing, empty or unknown step, is refused with one fixed reason. A person's session on the host is unchanged. A new test file, `src/commands/guardrails.guard-command.test.ts`, starts the built guard command itself with an empty ledger and a container's environment, as #87 asks.

`timone stage` in a container now says that the container's step decides and that the declaration changes nothing; it still writes the declaration and exits 0. The three skills that said "the ledger already knows its step" now say where the step comes from in a container, and PRD-10's header names phases 56 and 57.

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 57a — a container carries the name of its step | Landed first attempt. Two assertions of `session.test.ts` changed (departure 1). | `48a9e25` |
| 57b — in a container the guard judges by the container's step, and never asks | Landed first attempt. Phase 56's `KINDS` line changed too (departure 2). | `93e2625` |
| 57c — `timone stage` says the truth in a container | Landed first attempt. | `6283592` |
| 57d — the skills say where a runner-started session's step comes from | Landed first attempt. | `652c6ce` |

## Tests run

No suite was timed before the first slice: phase 56's close timed the whole suite at 12.0 s, under a minute. A first whole run after `npm run build`, before any change: 76 files, 70 tests failed, all in the four files of #220.

- **57a:** `src/runner/actions.test.ts`, `src/daemon/container-runtime.test.ts`, `src/daemon/run-env.test.ts`, `src/daemon/session.test.ts`, `src/daemon/step-session.test.ts` (232 passed); the whole suite (70 failed, the same #220 set).
- **57b:** `src/commands/guardrails.test.ts` (new block and phase 56's block), `src/commands/guardrails.guard-command.test.ts`, `src/daemon/probeGuard.test.ts`, `src/commands/stage.test.ts`; the whole suite (70 failed, the same #220 set). After 57b the person running the work asked that the whole suite run only once, at the end, so 57c and 57d ran only the tests of what they changed.
- **57c:** `src/commands/stage.test.ts` (8 passed). No other test file uses the stage command.
- **57d:** `src/process-text.test.ts` (43 passed).
- **Close:** after `npm run build`, the whole suite once: 77 files, 2725 tests, 2655 passed, **70 failed**, 11.9 s. The failures are in `src/commands/guardrails.test.ts` (45), `src/numbers.test.ts` (16), `src/workspace.test.ts` (6) and `src/commands/number.test.ts` (3) — the same 70 as before the phase (#220). Then each sub-phase's validation steps once, 57a, 57b, 57c, 57d; each uses only fresh temporary folders, so the order is safe. 57a: 232 passed, both `sessionRequest({` calls carry `stage`, the exact-arguments test differs from `main` by the one `-e TIMONE_RUN_STAGE` pair and its marker. 57b: 71 passed in the `-t "PRD-10"` run with the command test; `probeGuard.test.ts` and `stage.test.ts` 687 passed, `probeGuard.test.ts` unchanged from `main`; the guard command by hand, step `planning`, empty ledger, answers `deny`. 57c: both hand runs print the planned sentences and exit 0. 57d: the old sentence is gone (grep exit 1), the PRD header names both phases, `process-text.test.ts` 43 passed.

## Screen comparison

None — the phase changes no screen.

## Deviations from the plan

Two, both recorded in [`phase-57-departures.md`](phase-57-departures.md) and marked in the phase file with `✏ 2026-10-08 (build, timone#230)`:

1. 57a: two assertions of `src/daemon/session.test.ts` check a request's exact shape, so they now include `stage`.
2. 57b: phase 56's `KINDS` line changed as well as its two named rows, because it is what joins them.

Smaller choices made inside the slices are in the handoffs: the new test block in `guardrails.test.ts` loads `PIPELINE_STAGES` with an `await import` just above it, so that the file's top is untouched for #228; `timone stage` throws if the guard ever answers "ask" in a container, a line no input can reach; the skills write `node dist/cli.js stage`, the form their paragraphs already use.

## Context for the next agent

- Build with `npm run build`, then `npx vitest run`. The 70 failures in the four files of #220 are expected in a container until #228 lands.
- Every test that starts the built command must remove `TIMONE_RUN_PROJECT`, `TIMONE_RUN_BRANCH` and `TIMONE_RUN_STAGE` from its child's environment first; the new command test does.
- Known open: R8 needs a supervised run in a real container. The live gate the plan names (PRD-02's `live` criteria, because `src/daemon/` changed) is owed before delivery.
- `containerStep` treats a session as a container's when either `TIMONE_RUN_PROJECT` or `TIMONE_RUN_STAGE` is set. A person's session in a container with no step is refused a real read of a check script (phase 56's "a person, in a container" row now expects `deny`).
