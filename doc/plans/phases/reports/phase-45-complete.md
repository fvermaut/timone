# Phase 45 — Completion Report

- **Date:** 2026-10-04
- **Plan:** [phase-45.md](../phase-45.md) — piece 6 of the [list of pieces for #197](../../breakdowns/ticket-197.md), stamped `Approved by fvermaut 2026-10-04T06:34:53Z — 6 pieces`
- **Requirements:** PRD-07.R10 (MUST) — `draft`, untouched; PRD-07.R11 (SHOULD) — `draft`, untouched. Verification sets their status.
- **Branch:** `timone/204-6-the-list-of-pieces-shows-what-is-built`
- **Departures:** [`phase-45-departures.md`](phase-45-departures.md) — 2 entries.

## Summary

A list of pieces can now say what each piece needs. Each piece may carry a `Needs:` line; `orderOf` in `src/daemon/breakdown.ts` reads those lines into the direct needs of each piece and says the order in words, for example "1, then 2 and 3 together, then 4." A piece with no line needs the piece above it, so every list written before this phase means what it meant before. A line that cannot be read makes the order unclear, with a sentence naming the piece and quoting the line. `parseBreakdown` does not judge `Needs:` lines, so the poll loop and `timone status` read every committed list as before.

When a list is approved, `openStepTickets` in `src/daemon/chunk-zero.ts` now makes each step ticket blocked by exactly the steps its piece directly needs, instead of by the step above it. It adds only the relations a step is missing, on every run, and removes none; a relation to an issue of another repository with the same number does not count. A list whose order is unclear opens no ticket at all and says why. The initiative's ticket shows an `Order:` line.

The session that writes a list now writes the `Needs:` lines and the `**Order:**` line, and runs `node dist/cli.js breakdown <project> <ticket>` before it commits. That command (`src/commands/breakdown.ts`) prints the order, or exits 1 with one sentence when the `**Order:**` line is missing, says another order, or a `Needs:` line cannot be read. The planning skill and `process.md` say the same, and add PRD-07.R11's preference for fewer waits and fewer shared files, after the end-to-end rule.

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| — plan amendment | 45b's test file already existed; the phase file marks it **[MODIFY]** (departure 1) | `855911e` |
| 45a — each piece says what it needs, and the order reads in plain words | landed first try; 15 new cases in `breakdown.test.ts` | `383bcbd` |
| 45b — the step tickets wait for each other exactly as the order says | landed first try; 8 cases in `chunk-zero.test.ts`, the existing test kept | `d3883b3` |
| 45c — a command that prints the order and refuses a list that says it wrongly | landed first try; `checkOrderLine` and `timone breakdown` | `ff2db88` |
| 45d — the session that writes a list writes the `Needs:` lines, the order, and runs the check | landed first try; changes inside `breakdownPrompt` only | `feefdad` |
| 45e — the planning skill and `process.md` say the same | landed first try; `STATUS.md` item 1e | `7f69676` |

## Tests run

The whole suite took 3.7 s at phase 44's close, so it counts as under a minute. Before the first slice, it showed 16 failures in a copy that had never been built (`src/cli.test.ts` and the guard tests run `dist/cli.js`); after `npm run build` it passed, 61 files, 1609 tests. During 45b's check the person running the build asked that slices run only the tests of what they change, and the whole suite once at the end (departure 2).

- **45a:** `src/daemon/breakdown.test.ts`, `src/daemon/poll.test.ts`, `src/commands/status.test.ts`, `src/daemon/steps.test.ts`; type check; the whole suite once (61 files, 1625 passed).
- **45b:** `src/daemon/chunk-zero.test.ts`, `src/runner/actions.test.ts`, `src/daemon/steps.test.ts`; type check; the slice ran the whole suite once (61 files, 1633 passed) before the request above.
- **45c:** `src/daemon/breakdown.test.ts`, `src/commands/breakdown.test.ts`, `src/cli.test.ts`; build; type check.
- **45d:** `src/daemon/prompts.test.ts`, `src/daemon/breakdown.test.ts`, `src/commands/takeover.test.ts` (the only other file that imports `prompts.ts`); type check.
- **45e:** no tests; the slice changes no code. The grep checks only.
- **Close:** `npm run build`, exit 0; the whole suite once, 62 files, 1647 tests passed, 3.8 s; `npm run type-check`, exit 0. Then the validation of 45a, 45b, 45c, 45d and 45e once each, in that order (none changes state outside the repository): all passed. 45b: `src/runner/actions.ts` unchanged since the plan. 45c: the three commands gave exit 0 (printing `1 and 2 together, then 3, then 4 and 5 together. 6 needs none of the others.`), 1 (printing the line `**Order:** 1, then 2.` to add) and 1. 45d: both hunks of `prompts.ts` are inside `breakdownPrompt`. 45e: the greps matched in both files, and the skill's shape block is the same as the prompt's example.

## Screen comparison

None — the phase changes no screen.

## Deviations from the plan

- **45b's test file.** The plan marked `src/daemon/chunk-zero.test.ts` as new; it already existed with one type-level test of `tryMergeChunkZero`. Amended in place (`✏ 2026-10-04 (build, timone#204)`), the test kept. Departure 1.
- **Whole-suite runs.** At the person's request, 45c to 45e did not run the whole suite at their end; it ran once at the close. Departure 2.
- **`ticket-164.md` does not parse, and did not before.** The plan says it opens "the same relations as before". Its `Status:` line has a sentence after "— 2 pieces", so `parseBreakdown` returns `malformed` for it, before and after this phase; 45a's test checks the reason stays the same. Nothing in this phase changes that.
- **45e's place in `process.md`.** The amendment sits after the sentence about `TERMINAL`, not right after the ADR-0040 sentences, so that the existing "This retired settledness outright" still refers to what it referred to.

## Context for the next agent

- **Run:** `cd projects/timone && npm run build && npx vitest run`. The build must come first: `src/cli.test.ts` and the guard tests run `dist/cli.js`.
- **The command:** from the timone root, `node projects/timone/dist/cli.js breakdown timone 197 --manifest timone.yaml`.
- **A live gate is owed** (the plan, *What this phase owes before delivery*): PRD-01.R10 and PRD-02 R1, R2, R4 and R8 depend on files this phase changes. Only the operator can run it.
- **Questions for the pull request:**
  1. When GitHub says a step has more relations than it returned (`dependenciesIncomplete`), a relation that exists but was not returned looks missing, and a re-run writes it again. If GitHub refuses a relation that already exists, the run reports "could not open the step tickets" instead of finishing. Should the re-run skip writing relations for such a step?
  2. `chunk-zero.ts` now imports `repoSlug` from `src/adapters/github-tickets.ts` to tell this repository's issues from others'. `container-runtime.ts` already does the same, but it puts a GitHub rule in forge-neutral code. Should the comparison move behind `TicketingAdapter`?
- **Would refactor:** the manifest loading and the unknown-project sentence are now copied in `number.ts` and `breakdown.ts`. `timone breakdown timone abc` reports a missing `ticket-NaN.md` instead of saying the ticket is not a number.
- The breakdown prompt tells a session to run `node dist/cli.js breakdown …` at the timone root. That command exists there once this branch is merged and the root is built again.
