# Phase 51 — Completion Report

- **Date:** 2026-10-05
- **Plan:** [phase-51.md](../phase-51.md) — piece 1 of the [list of pieces for #213](../../breakdowns/ticket-213.md), approved by fvermaut 2026-10-05 — 2 pieces
- **Requirements:** PRD-09.R4 (MUST) — `draft`; PRD-09.R5 (MUST, the takeover paragraph only) — `draft`. Execution does not change them; the check sets them.
- **Branch:** `timone/217-1-a-takeover-waits-for-the-running-step`
- **Departures:** [`phase-51-departures.md`](phase-51-departures.md) — 4 entries: the test rhythm the runner asked for; two more existing tests changed in 51a; the "moved on" exit needs two looks in a row (51c); 70 tests that this container's push guard stops from passing (the close).

## Summary

`timone takeover` typed while a step of its ticket runs no longer refuses. With a daemon running, the command asks the daemon, which writes the terminal on the run as the one that waits for the step (51a). The command says which step it waits for and that Ctrl-C stops the wait. When the step ends, the driver parks the run and claims it for that terminal, and does not wake the runner. The terminal sees its claim and opens the session. When the session ends, the runner is woken and told of the step's end first, then of the session's end.

Ctrl-C ends the wait, not the process. If the step's end had just handed the run over, the claim is given back as `abandoned`, and the runner is told only of the step's end (51b). Only one terminal waits at a time; one whose process is gone is replaced, and dropped at the step's end. With no daemon, the command says no step can end and does not wait. A daemon that stops during the wait, or a run that moves some other way, ends the wait with a sentence that says which. A run another terminal holds is answered with that terminal's command and pid (51c). The runner refuses to start a step while a person's terminal holds the run (51d). `process.md`, the README, `CONTEXT.md` and the two PRDs say the same (51e).

Most of the weight is in `src/commands/takeover.ts`, the wait loop and its four ways out, and in `afterStep` in `src/runner/driver.ts`.

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 51a — a takeover typed while a step runs waits, and opens when the step ends | landed in an earlier session; cases 1–7; two more existing tests changed (departure 2) | `7c488f4` |
| 51b — stopping the wait changes nothing, and one terminal waits at a time | landed; cases 1–5; no existing test changed | `222281a` |
| 51c — when no step can end, the takeover says so and does not wait | landed; cases 1–4 and a fifth for the two-writes race (departure 3); two existing tests changed | `75da756` |
| 51d — the runner starts no step on a run a person's terminal holds | landed; cases 1–2; no existing test changed | `3c95d6d` |
| 51e — the written rules say that a takeover waits for a running step | landed; no `Status:` line changed | `5dc6247` |

## Tests run

No suite was timed before the first slice: phase 50's close timed the whole suite at 5.8 s, under a minute. The runner asked that each slice run only the tests of what it changes, and the whole suite once at the end (departure 1). This session resumed after 51a: before 51b, `tsc --noEmit` exit 0 and the four files of 51a plus `src/runner/actions.test.ts` passed (433).

- **51a:** see its handoff section: the four files (363), then 17 more test files (390). Pass.
- **51b:** the four files (370); then the 22 test files of code that uses the changed files: 444 passed, 45 failed, all in `src/commands/guardrails.test.ts` from the push guard (departure 4). `npm run build` was run, because `src/cli.test.ts` and `src/daemon/session.test.ts` need `dist/`.
- **51c:** `src/commands/takeover.test.ts`, `src/daemon/poll.test.ts` (181); `src/cli.test.ts`, `src/planner/plan-files.test.ts` (with poll, 131). Pass.
- **51d:** `src/runner/actions.test.ts` (72); 11 files of code that imports `actions.ts` (317). Pass.
- **51e:** no code; the whole suite, below.
- **Close:** the whole suite once: 76 files, 1932 tests, 1862 passed, **70 failed**, 8.1 s. Every failure is in `src/commands/guardrails.test.ts`, `src/numbers.test.ts`, `src/workspace.test.ts` or `src/commands/number.test.ts`, and each is a push to `main` that this container refuses. The same 70 fail on `origin/main` without this phase (departure 4). Then every sub-phase's validation steps once, in the order 51a to 51e; none touches state outside the repository, so that order is safe: `tsc --noEmit` exit 0; 51a and 51b, the four files, 375 passed; 51c, 181 passed, and "working on … right now" is left on one line, the `picked-up` answer; 51d, 72 passed; 51e, `ADR-0067` in `process.md` and `CONTEXT.md`, the old README sentence gone, `phase-51` in PRD-05's register and PRD-09, no `Status:` line changed. No line the phase added contains a probe folder's path.

## Screen comparison

None — the phase changes no screen. The waiting sentence is printed in a terminal.

## Deviations from the plan

See [`phase-51-departures.md`](phase-51-departures.md). No amendment was made to the phase file. In short:

- The runner's test rhythm (departure 1).
- 51a changed two more existing tests in `src/commands/takeover.test.ts` than the plan named (departure 2).
- 51c: a run counts as moved on only when two looks in a row see it so, with a fifth test; two existing tests that expected "I'm working on …" for a running step with no daemon now expect the "no daemon" sentence (departure 3).
- 51d: case 2 tries once while the terminal holds the run, then parks it and tries again, so a wrong implementation can fail it.
- 51e: the `process.md` note is five short sentences, not one, as other dated notes in that file are written.
- 70 tests fail in this container for a reason outside this phase (departure 4).

## Context for the next agent

- **Run:** `npm run build`, then `npx vitest run`. The tests of this phase are in `src/daemon/runs.test.ts`, `src/commands/takeover.test.ts`, `src/daemon/poll.test.ts`, `src/runner/driver.test.ts` and `src/runner/actions.test.ts`.
- **PRD-05.R11's probe** is expected to go red on its check that a takeover of a run the machine is working on opens no session. The plan says verification replaces that check with one that the takeover waits and then opens.
- **The live gate is owed** (plan, *What this phase owes before delivery*): on scratch-app with the daemon running, a takeover typed while a step runs; then again, with Ctrl-C before the step ends.
- **Open points for the person, found while building, not resolved:**
  - After the daemon settles the request, `claimForTakeover` in `src/commands/takeover.ts` still opens the session for any `active` run, without checking that the claim carries this terminal's token. 51a kept this so an existing test stays unchanged. If another terminal took the run in the short time before the daemon read this terminal's request, this terminal could open a second session on it (51a and 51c handoffs).
  - While a person's terminal holds a run, the runner refuses to start a step, but its other actions (`post`, `end_run`) still run. A run held by a terminal whose process is gone is refused until the daemon gives it back (51d handoff).
  - R4's *Verification hint* in the PRD-09 register still describes the code before this phase: only a `picked-up` run now gets "I'm working on … right now" (51e handoff).
  - Ctrl-C before the daemon has read the request still ends the process the old way (51b handoff).
