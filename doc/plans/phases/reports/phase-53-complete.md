# Phase 53 — Completion Report

- **Date:** 2026-10-05
- **Plan:** [phase-53.md](../phase-53.md) — piece 2 of the [list of pieces for #213](../../breakdowns/ticket-213.md), approved by fvermaut 2026-10-05 — 2 pieces
- **Requirements:** PRD-09.R1 (MUST), PRD-09.R2 (MUST), PRD-09.R3 (MUST), PRD-09.R5 clause 1 (MUST) — each `draft` in the register, as execution leaves it. R1's `Falsified-by:` now names its tests.
- **Branch:** `timone/218-2-every-question-names-the-command`
- **Departures:** [`phase-53-departures.md`](phase-53-departures.md) — 3 entries.

## Summary

Every question the machine asks now says the person can answer in writing or in their terminal, and names `timone takeover <project>#<n>` in code formatting. The sentence is built in one place, `twoWaysToAnswer` in `src/channels/terminal.ts`, and `withTwoWaysToAnswer` puts it on its own line just above the last `**What I need from you:**` line. That last line is never changed, so `askedFor`, the run's wait and `timone status` read the same words as before. `isQuestion` in `src/daemon/outcomes.ts` decides what counts as a question: the closing line asks for something that is not "nothing".

The four ways a question is written are all covered. The two notices code writes (the spending limit and the list of pieces that could not be acted on) carry the sentence. The runner's `post` action adds it to every question, on the ticket and on the pull request, always with the ticket's number. A new field, `leaveOutTakeover`, names the three cases that leave it out (a missing key, a misspelled approval word, a terminal session that did not settle things); a body that names the command in one of those cases, or names the wrong command, is refused. Each step's instructions carry the finished sentence word for word, and the delivery step ends a pull request's *Questions for you* section with it. A takeover session is told not to write the command.

The written rules say the same: `process.md` under *Writing to the human*, the runner's instructions in `src/runner/brief.ts`, and twelve step instructions (the update step has no such line and was left as it is). Two new replay cases watch the runner: a pull request closed with no reason, and the word `aprovd` on a list of pieces.

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 53a — The sentence, and the two questions code writes | Landed first try. Two existing tests that compare the whole limit notice gained the sentence line; the plan's check was amended (departure 2). `namesACommand` narrowed to allow exactly the takeover command. | `2944b6f` |
| 53b — The runner's questions carry the command, and the runner names the three exceptions | Landed first try. No existing test changed. Replay 22 of 22. | `219118a` |
| 53c — Each step is told the sentence word for word | Landed first try. No existing test changed. | `ec56fd8` |
| 53d — The written rules say the same | Landed first try. No code; checklist validation. | `b7e6822` |

## Tests run

No suite was timed before the first slice: phase 51's close timed the whole suite at 8.1 s, under a minute. The runner asked that each part run only the tests of what it changes, and the whole suite once at the end (departure 1). Before the first slice, `tsc --noEmit` exit 0 and `npm run replay -- --dry` 20 of 20.

- **53a:** its five files (243 passed); then 23 test files of code that imports the changed files — `src/commands/{daemon,takeover,status,record}.test.ts`, `src/daemon/prompts.test.ts`, everything under `src/planner/` and `src/runner/` (659 passed); replay 20 of 20.
- **53b:** its three files (134 passed); then 24 files — all of `src/runner/` and `src/planner/`, `src/daemon/poll.test.ts`, `src/daemon/prompts.test.ts`, `src/commands/{daemon,takeover,record,status}.test.ts` (793 passed); replay 22 of 22.
- **53c:** `src/daemon/prompts.test.ts` (255 passed); then, after `npm run build`, `src/commands/{takeover,daemon}.test.ts`, `src/daemon/{session,step-session,container-runtime,poll}.test.ts` and every file under `src/runner/` and `src/planner/` (633 passed); replay 22 of 22.
- **53d:** the four grep checks; the 8 test files that read `process.md`, the skills or the PRD files (441 passed). Its last validation command, the whole suite, is the close's run below.
- **Close:** after `npm run build`, the whole suite once: 76 files, 1984 tests, 1914 passed, **70 failed**, 8.9 s. Every failure is in `src/commands/guardrails.test.ts`, `src/numbers.test.ts`, `src/workspace.test.ts` or `src/commands/number.test.ts`, each a push to `main` that this container refuses; the same 70 fail on `origin/main` (departure 3). Then every sub-phase's validation steps once, in the order 53a to 53d; none touches state outside the repository, so that order is safe: `tsc --noEmit` exit 0; 53a, five files, 254 passed; 53b, three files, 134 passed, replay 22 of 22; 53c, 255 passed; 53d, the process.md line found, only `timone-update` lacks the command, `phase-53` in PRD-09, no `Status:` line changed. `README.md` and `timone.example.yaml` are untouched. No line the phase added contains a check-script folder's path.

## Screen comparison

None — the phase changes no screen.

## Deviations from the plan

- 53a's second check is amended in place (`✏ 2026-10-05 (build, timone#218)`): two existing tests that compare the whole limit notice word for word gained the sentence line, because case 4 requires that notice to change (departure 2).
- Each part ran only the tests its change could affect, and the whole suite ran once at the close, as the runner asked (departure 1). 53d's whole-suite command is that close run.
- The whole suite does not pass in this container: 70 push tests fail here and on `origin/main` alike (departure 3).

## Context for the next agent

- **Run:** `npm ci` is done; `npm run build`, then `npx vitest run` for the suite (the 70 push tests above fail inside this kind of container); `npm run replay -- --dry` for the replay cases with no model.
- **Live gate owed** (the plan's *What this phase owes before delivery*): on scratch-app with the daemon running, see one question posted by the runner and one posted by a step, each with the sentence and the exact command; copy the command into a terminal and see the session open. It rides to the pull request as an unticked check.
- **Real replay not run:** the two new replay cases pass with the scripted right calls only; a replay with the model costs money and was not run.
- **Known open observations, not resolved:**
  - A runner post that holds the right command and also a wrong one is posted; no requirement covers it.
  - In the delivery instructions, a question carried from an earlier step goes in the departures section, and that section now ends with the sentence; the delivery prompt names only *Questions for you*. A pull request with questions in both sections could show the sentence twice. No requirement limits how often it appears.
  - The header of `src/runner/replay/cases.ts` says "five other cases" and `src/runner/replay/harness.test.ts` says "nineteen cases"; both were out of date before this phase.
  - Refactoring left for the delivery review: the new limit-notice test in `src/daemon/poll.test.ts` largely repeats the updated whole-notice test beside it; `post` now has three refusals in a row that a small helper could shorten.
