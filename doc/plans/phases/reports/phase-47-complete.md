# Phase 47 — Completion Report

- **Date:** 2026-10-04
- **Plan:** [phase-47.md](../phase-47.md) — piece 3 of the [list of pieces for #197](../../breakdowns/ticket-197.md), approved by fvermaut 2026-10-04T06:34:53Z — 6 pieces
- **Requirements:** PRD-07.R1, R2 (except the number of places), R3, R9, R12 (for what this piece changes), R13 — all MUST, all still `draft` in the register; verification sets them.
- **Branch:** `timone/201-3-the-project-is-free-when-the-pull-requ`
- **Departures:** [`phase-47-departures.md`](phase-47-departures.md) — 10 entries.

## Summary

A ticket now takes a place on its project only while one of its steps runs, or while a freed place is given to it ([ADR-0063](../../../adr/0063-a-ticket-takes-a-place-only-while-one-of-its-steps-runs.md)). A work branch, an open pull request, a wait for a person, a runner session and a takeover take no place. Every project still has one place, so one step runs at a time; but a ticket with an open pull request no longer stops the next ticket from building. The `queued` status and the queue are gone.

The centre of the work is the run ledger (`src/daemon/runs.ts`). A step that finds no place is refused and its run waits, with its ticket's `priority:high` label and creation time. When a place frees, the ledger gives it to one waiting run in the same write, and the runner's driver wakes only that run, with "A place on the project is free for this ticket now. …". A place given and not used — the runner's wake started no step, the ticket is held, or it is over its spending limit — goes to the next run. The daemon gives every given and unused place again when it starts. The runner's brief now says where the place is, and its rules tell it not to say work has started before a step has started (#184).

A marked ticket with no live run whose pull request is open is taken over at pickup: a run is opened parked at delivery on that branch and pull request, and nothing is posted (#181). A takeover is no longer refused because of another ticket. `timone status` names the run given the place and the runs waiting, in order. The old rule is struck, with dated notes, in PRD-02, PRD-03, PRD-05, PRD-07, `process.md`, the charting instructions and `CONTEXT.md`.

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 47a — the ledger gives places | landed; one departure (three driver tests' setup changed) | `98708a6` |
| 47b — a step asks for a place | landed; committed with one driver test failing, replaced in 47c (departure) | `47c3a3e` |
| 47c — only the run given a place is woken | landed on the second attempt, after a plan amendment granting one `poll.test.ts` test and adding cases 8 and 9; the replay set could not run (departure) | `699b313` |
| 47d — an open pull request is taken over at pickup | landed; one extra test for the forge failure | `d3a9458` |
| 47e — a takeover takes no place | landed | `9fed9bb` |
| 47f — `timone status` lists who waits | landed | `441600d` |
| 47g — the old rule struck where it is written | landed; old words kept struck through | `51305ba` |

## Tests run

The whole suite took 3.8 s at phase 46's close, so it counts as under a minute. The runner's instructions for this step asked that each slice run only the tests of what it changes, and the whole suite once at the end (departure 1). `npm run build` was run before the test files that run `dist/cli.js`, and `dist/` removed afterwards.

- **47a:** its validation block (16 files, 504 tests), then every test file that uses `RunStore` (30 files, 797 tests): all pass.
- **47b:** its validation block (210 tests), then `src/daemon/`, `src/commands/`, `src/runner/`: all pass except one test in `src/runner/driver.test.ts`, replaced by 47c (departure).
- **47c:** its validation block (12 files, 340 tests); `npm run replay` not run for want of a Claude login (departure); then `src/daemon/` and `src/commands/` (38 files, 1186 tests): all pass.
- **47d:** its validation block (8 files, 445 tests), then `src/adapters`, `src/commands`, `src/daemon`, `src/runner`, `src/*.test.ts` (61 files, 1703 tests): all pass.
- **47e:** its validation block (3 files, 310 tests), then `src/commands`, `src/daemon`, `src/runner`, `src/*.test.ts` (55 files, 1521 tests): all pass.
- **47f:** its validation block (46 tests), then `src/commands`, `src/guards/checkouts.test.ts`, `src/cli.test.ts` (13 files, 231 tests): all pass.
- **47g:** its two greps; then the 12 test files that read the documents (352 tests): all pass.
- **Close:** the whole suite once, `npx vitest run`: 63 files, 1721 tests, all pass, 3.4 s. Then every sub-phase's validation steps once, in order 47a to 47g (none resets shared state; all use temporary ledgers): type check exit 0; 47a 531 tests, both greps as expected; 47b 212 tests, grep exit 1; 47c 342 tests, grep exit 1; 47d 448 tests; 47e 310 tests; 47f 46 tests; 47g every file names ADR-0063, the `process.md` grep exit 1. All pass. `npm run replay` was not run at the close either, for the same reason.

## Screen comparison

None — the phase changes no screen.

## Deviations from the plan

- **✏ 2026-10-04 (build, timone#201), in 47c:** one test of `src/daemon/poll.test.ts` granted, and cases 8 and 9 added: a place given to a held ticket or one over its limit goes to the next run; a place given later in the same wake as a refused try is kept.
- Every other departure is in [`phase-47-departures.md`](phase-47-departures.md): the test rhythm the runner asked for; the 40u driver tests' setup (47a); `giveBack` does not keep a run waiting (47a); the failing test 47b left for 47c; where `regivePlaces` is called and what a refused try keeps (47c); the replay set not run (47c); 47d's extra test, its branch-rule seam, the full page and the hold label; 47e's case 5 scope; 47g's struck-through words and the charting section.

## Context for the next agent

- Run the suite with `npm run build && npx vitest run` from the project root (some tests run `dist/cli.js`).
- **The replay set (`npm run replay`, PRD-05.R18) must be run where a Claude login exists.** In the build's container every case failed with "Not logged in". The runner's brief and rules changed in 47c, so this is the check most likely to show a change.
- **PRD-05.R11's check script (`prd-05.r11.mjs`) tests the takeover refusal 47e removed.** Verification must amend it; the builder did not open it.
- **A live gate is owed** (plan, *What this phase owes before delivery*): on scratch-app, two marked tickets, the first left with an open pull request, the second must build while it is open, and a third ticket refused a step must be the only one woken when the place frees. It runs on the operator's machine.
- Questions for the pull request: should the new forge call refuse a full page of 200 open pull requests, as the ticket listings do (47d)? Should an adopted step ticket get the hold label a pickup puts on it (47d)? In case 8, the next waiting run is woken one tick later, not in the same tick (47c).
- This phase's pull request is best merged after #200's: two open pull requests of one project can now both change `STATUS.md` or a register.
