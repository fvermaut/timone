# Phase 56 — Completion Report

- **Date:** 2026-10-08
- **Plan:** [phase-56.md](../phase-56.md) — the list of pieces in [ticket-87.md](../../breakdowns/ticket-87.md), `Approved by fvermaut 2026-10-08 — 2 pieces`; this phase is piece 1.
- **Requirements:** PRD-10.R4 (MUST) — `draft` in the register, untouched; PRD-10.R5 (MUST) — `draft`, untouched. Verification decides both.
- **Branch:** `timone/229-1-the-guard-judges-only-real-reads-and-w`
- **Departures:** [`phase-56-departures.md`](phase-56-departures.md) — 1 entry: the whole suite ran once at the close, not at the end of each sub-phase, as the runner asked.

## Summary

The probe guard now judges a tool call by what it opens, not by every word it carries. The guard is told the tool's name. `Read`, `Write`, `Edit` and `NotebookEdit` are judged by the file they open; `Glob` and `Grep` by the folder they search, and a `Grep` pattern is text; a prompt to a helper (`Agent`, `Task`) is not judged. A tool with no rule, or a call whose tool is not known, is still judged by all of its input text.

Most of the work is in 56b: a small reader, `src/daemon/shell-words.ts`, splits a `Bash` command into its commands, words, here-document bodies and substitutions. A word is judged when a check folder's path starts it, or follows `/`, `:` or `=` in it. So a commit message, ticket or pull request text, and a here-document written into another file pass, and a real `cat`, `ls`, `cp`, run, redirection or `git show` of a check script is still judged, also when joined to a command that passes. A command that hands code to an interpreter as text, and a command the reader cannot read to the end, are judged by all of their text, as before.

The three refused calls of #192 — a helper's prompt, an edit of the phase file, and the commit that names the shared folder — now pass for every kind of session, on the host and in a container. `timone stage` says the same sentences; it now asks the guard about a `Read` of a check script.

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 56a — the file tools, the search tools and a helper's prompt are judged by what they open | Landed first attempt. Cases 1 and 5 red before, green after; cases 2, 3, 4 and 6 green before and after. | `24f87c4` |
| 56b — a shell command is judged by the words that reach the folders | Landed first attempt. Cases 1 and 7 red before, green after; cases 2 to 6 and 8 green before and after. | `d8e53c5` |

## Tests run

No suite was timed before the first slice: phase 54's close timed the whole suite at 11.2 s, under a minute. A first whole run before any change, after `npm run build`, gave the known state: 4 files, 70 tests failed, all #220.

- **56a:** `src/daemon/probeGuard.test.ts` (163 passed), `src/commands/stage.test.ts` (3 passed), `src/commands/guardrails.test.ts` whole (25 passed, 45 failed — every failure the #220 push refusal, as before), `src/update-checks.test.ts` (2), `src/update-checks.git.test.ts` (7), `src/guards/checkouts.test.ts` (7); `tsc --noEmit` exit 0.
- **56b:** `src/daemon/probeGuard.test.ts` (403 passed), `src/commands/stage.test.ts` (3 passed), `src/commands/guardrails.test.ts` whole (37 passed, 45 failed, the same #220 failures), `src/update-checks.test.ts`, `src/update-checks.git.test.ts`, `src/guards/checkouts.test.ts` (all passed); `tsc --noEmit` exit 0.
- **Close:** after `npm run build`, the whole suite once: 76 files, 2398 tests, 2328 passed, **70 failed**, 12.0 s. Every failure is in `src/commands/guardrails.test.ts` (45), `src/numbers.test.ts` (16), `src/workspace.test.ts` (6) or `src/commands/number.test.ts` (3) — the same 70 as before the phase (#220). Then each sub-phase's validation steps once, 56a then 56b; neither touches state outside the repository except a fresh temporary ledger each, so the order is safe. 56a: `tsc` exit 0; 406 passed; 30 passed in the `-t` run; the guard command prints nothing for the helper's prompt and asks about the read. 56b: `shell-words` imported only by `probeGuard.ts`; the guard command prints nothing for #192's commit and asks about the joined read; no failing file outside the four of #220. No added line in the diff names a check folder (981 added lines checked with a script that reads `PROBE_DIRECTORIES`).

## Screen comparison

None — the phase changes no screen. The guard answers a hook on stdout.

## Deviations from the plan

One, recorded in the departures file: the last validation command of each sub-phase (the whole suite) ran once, at the close, at the runner's request; each sub-phase ran the test files its change can affect instead. The plan's text was not amended.

## Context for the next agent

- Run: `npm run build`, then `npx vitest run`. In a run's container, 70 failures in the four files of #220 are expected until #220 merges.
- The session that built this was itself under the old guard, so no tool call, helper prompt or commit message in the build names a check folder. A verifier is under the same old guard until this phase is deployed in Timone's own root.
- Choices taken inside 56b, listed in its handoff: shell keywords (`{ ! if then elif else do while until`) are skipped when finding the program; bunched short flags holding `c`, `e` or `p` (`bash -lc`, `perl -ne`) count as code given as text; `deno eval` does too. These lean towards judging.
- Known costs the plan accepted, seen in 56b's hand tests: `grep -rn "<folder>" src` and a flag value that begins with the path are judged, because the word begins with the path once quotes are removed. A `case` pattern and a here-document opened inside a group make the command unreadable, so it is judged by all of its text. None of these lets a real read through.
- The `substitutions` field of the reader's result is filled as the plan specifies, but the guard does not read it; the commands inside a substitution are read and judged as commands of their own.
- Piece 2 of the list changes the container row with no run in 56a's `runGuard` tests: it is `ask` today and must become a refusal there. The expected value comes from the `SESSIONS` table of that block.
- Refactoring left for review: the `SESSIONS` / `everySession` helpers are written twice in `probeGuard.test.ts`, once per new block.
