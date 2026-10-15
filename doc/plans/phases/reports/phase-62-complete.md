# Phase 62 — Completion Report

- **Date:** 2026-10-15
- **Plan:** [phase-62.md](../phase-62.md) — no list of pieces: a bug ([timone#254](https://github.com/fvermaut/timone/issues/254)), classified on the ticket itself, and the whole fix is one piece. No triage record was committed for it; the plan says so and anchors on PRD-05.R9.
- **Requirements:** PRD-05.R9 (MUST) — `draft`, unchanged; PRD-05.R10 (MUST) — unchanged. Verification decides each.
- **Branch:** `timone/254-a-comment-on-a-map-ticket-gets-no-answer`
- **Departures:** [phase-62-departures.md](phase-62-departures.md) — 1 entry.

## Summary

A named person who writes on a map ticket now gets one reply. The reply says the ticket is not read any more, and lists each open step ticket by number and title as the place to write; with no open step it says to open a new ticket. The words are fixed in `mapTicketReply` (`src/runner/comments.ts`). No runner session is woken and no run is opened on the map.

The work is in `RunnerDriver.tick` (`src/runner/driver.ts`). After it looks at the runs, it looks at each map ticket of the cycle that has no live run. It reads the map's run record and its `seen` mark for the ticket thread; with no mark, it reads from the machine's newest comment on the thread. The new comments are marked read **before** the reply is posted, so a reply that fails is not tried again and a reply is never posted twice. Comments by the machine and by people not named for the project are marked read and get no reply. The poll's survey of initiatives (`src/daemon/poll.ts`) now hands each map whose steps it read, with those steps, to the driver; a map whose listing failed gets nothing that cycle. The poll still opens no run on a map ticket.

The glossary entry **Map ticket** in `CONTEXT.md` now says what a comment there gets.

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 62a — a named person's comment on a map ticket gets one reply | Landed first try. Nine driver cases, three text cases, two poll cases; cases 2, 3 and 8 (the reply is posted once) pass. | `e7758d6` |
| 62b — the glossary says what a comment on a map ticket gets | Landed first try. | `cc758fb` |

## Tests run

No suite was timed before the first slice: phase 61's close timed the whole suite at 9.5 s, so it takes under a minute. At the runner's request, each sub-phase ran only the tests of the files it changed, and the whole suite ran once at the close (departures entry 1).

**Known before any change, in this container:** the whole suite on `main` (`ed8312b`) fails 101 tests in 13 files: `src/commands/guardrails.test.ts` (45), `src/numbers.test.ts` (16), `src/cli.test.ts` (7), `src/workspace.test.ts` (6), `src/daemon/push-guard.test.ts` (6), `src/merge-rules.git.test.ts` (5), `src/commands/number.test.ts` (3), `src/daemon/push-guard.git.test.ts` (3), `src/update-checks.git.test.ts` (3), `src/commands/guardrails.guard-command.test.ts` (2), `src/daemon/container-runtime.test.ts` (2), `src/daemon/session.test.ts` (2), `src/daemon/register.test.ts` (1). Most are git-fixture tests whose push to `main` of a temporary remote is refused by this container's push guard. Phase 61 saw 71 in its container. None is in a file this phase changed.

- **62a:** `src/runner/comments.test.ts`, `src/runner/driver.test.ts`, `src/daemon/poll.test.ts` — 173 of 173; the "a comment on a map ticket" block 9 of 9; `tsc` exit 0.
- **62b:** no test run: the sub-phase changes no code.
- **Close:** the whole suite once: 78 files, 2800 tests, 2699 passed, 101 failed — the same 101 tests, by name, as on `main` — 7.9 s. Then each sub-phase's checks once, in the order 62a, 62b; neither changes anything outside the repository. 62a: the three files 173 of 173, the block 9 of 9 (exit 0), `tsc` exit 0, the `MAP_LABEL` skip still at `src/daemon/poll.ts:1156`, `src/runner/brief.ts` unchanged against `main` (exit 0). 62b: `timone#254` found in `CONTEXT.md` (exit 0); `git diff --stat main -- CONTEXT.md` shows one line changed — the entry's line was extended, and none of its words was removed.

## Screen comparison

None — the phase changes no screen.

## Deviations from the plan

- The whole suite was not run at the end of 62a; it ran once at the close, at the runner's request (departures entry 1).
- The plan did not give the last line of the reply when no step is open. It reads: "**What I need from you:** nothing on this ticket. To get an answer, open a new ticket."
- Case 5's live run on #7 is a parked run waiting for the planner, which holds it. With a plain parked run, that run's own look reads the comment and wakes the runner for #7, which the plan's checks forbid and which would let the case pass without the live-run check.

## Context for the next agent

- Run the tests with `npx vitest run src/runner/comments.test.ts src/runner/driver.test.ts src/daemon/poll.test.ts`; the driver cases are in the `describe("a comment on a map ticket", …)` block.
- **PRD-05.R9 is `live`.** A live sighting is a named person writing on a scratch-app map ticket and seeing one reply within one cycle. Per ADR-0059 it rides to the pull request if only fvermaut can run it. R9 says "the runner wakes and either acts or answers"; here code answers without a runner session. The plan's decision (1) records why; verification should note this reading in R9's evidence.
- **PRD-05.R10** is the criterion that matters most in the regression set: the new code reads comments and must drop the machine's own and those of people not named.
- Once live, the first cycle posts one late reply on ivtrends#217 to the 16:39Z question, pointing at its open step tickets.
- Each cycle now reads the comment thread of every open map ticket, one extra read per map per cycle. The reply itself is a machine comment, so the next cycle moves the `seen` mark past it and posts nothing.
- Treating a comment on a map ticket as a new request is left for a later ticket.
- Refactor noted for delivery: `newComments` finds the newest comment with a `reduce`, and the new `answerMap` uses a new helper `newestOf`; one could use the other.
