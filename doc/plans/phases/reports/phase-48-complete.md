# Phase 48 — Completion Report

- **Date:** 2026-10-04
- **Plan:** [phase-48.md](../phase-48.md) — piece 2 of the [list of pieces for #197](../../breakdowns/ticket-197.md), approved by fvermaut 2026-10-04T06:34:53Z — 6 pieces
- **Requirements:** PRD-07.R8 (MUST), clauses 2 and 3 — still `draft` in the register; verification sets it.
- **Branch:** `timone/200-2-status-md-and-the-requirement-register`
- **Departures:** [`phase-48-departures.md`](phase-48-departures.md) — 4 entries.

## Summary

When a work branch is brought level with the default branch in a box, git no longer stops on `STATUS.md` or on a requirement register. Git hands both kinds of file to `timone merge-file`, which keeps what both sides wrote, as [ADR-0064](../../../adr/0064-status-md-and-the-registers-are-merged-by-timones-own-rule-in-the-box.md) decides. Where both sides changed the same place, the default branch's lines come first, then the branch's. `STATUS.md` keeps one `**Last updated:**` line, with the later date. In a register, a one-value field both sides changed keeps the default branch's value, and the branch's line becomes a dated note under that requirement. Two `## R<k>` headings with the same number make the command exit 1, so git reports a conflict a person decides.

The centre of the work is `mergeFile` in `src/merge-rules.ts` (48a). It starts from `git merge-file --diff3` with 40-character markers, and inside each conflict block merges again line by line, so that changes to neighbouring lines are both applied and no unchanged line is written twice. 48b added the command git calls (`src/commands/merge-file.ts`), `installMergeRules` and `mergeRulesConfig`, `guardrails install-merge-rules`, and the test with real git that is R8's falsifier: two branches, one lands on `main` as a squash or as a merge commit, the other is merged level with exit 0, no unmerged file, and every added line kept. Without the environment the same merge stops on both files, and nothing is written into the clone.

48c makes the box install the rule after the push guard, stop with exit 79 if it cannot, and export one git environment line with four settings: `core.hooksPath` first (the push guard), then `core.attributesFile` and the two drivers. A test runs that line in a real shell and reads all four settings back. 48d added one paragraph to `process.md` and the item for this pull request to `STATUS.md`.

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 48a — the merge rule | landed; the plan's case 11 amended for case 3 (departure 2); one guard-test entry added at the close (departure 4) | `ea0b51d`, `8f56cf4` |
| 48b — the command git calls and the test with real git | landed | `2f14390` |
| 48c — the box switches the rule on | landed; `PUSH_GUARD_LINES` also gained the install lines (departure 3) | `1646aa2` |
| 48d — `process.md` and `STATUS.md` | landed | `b7b376b` |

## Tests run

No suite was timed before the first slice: phase 47's close gives the whole suite 3.4 s, so it counts as under a minute. The runner's instructions for this step asked that each slice run only the tests of what it changes, and the whole suite once at the end (departure 1). The person also asked for this during the build. `npm run build` was run before the test files that run `dist/cli.js`. Before the first slice, the whole suite was run twice to see the starting state: without `dist/` 16 tests failed, with `dist/` built all 1721 passed.

- **48a:** `src/merge-rules.test.ts` (23 tests), type check: pass.
- **48b:** `src/merge-rules.test.ts`, `src/merge-rules.git.test.ts`, `src/commands/merge-file.test.ts`, `src/commands/guardrails.test.ts`, `src/cli.test.ts` (88 tests), type check: pass.
- **48c:** `src/daemon/container-runtime.test.ts` (107 tests), then with `src/daemon/push-guard.test.ts` and `src/merge-rules.git.test.ts` (149 tests), type check: pass.
- **48d:** `src/process-text.test.ts` (41 tests): pass.
- **Close:** the whole suite once, `npx vitest run`: 66 files, 1761 tests, 1 failure, 3.5 s. The failure was `src/guards/checkouts.test.ts`, "performs git only where somebody said so, and said what on": `merge-rules.ts` runs git and was not listed. Fixed in `8f56cf4` after a plan amendment (departure 4); then the whole suite again: 66 files, 1761 tests, all pass, 3.4 s. Then every sub-phase's validation steps once, in order 48a to 48d (none changes state outside temporary folders): 48a 23 tests, type check exit 0; 48b 82 tests, `--help` names the arguments with exit 0, an unknown kind exits 2 with the sentence naming `status` and `register`, `install-merge-rules` exits 0 and writes the two lines, the project has no `.gitattributes` (exit 1); 48c 107 tests, the one-setting export line is gone (exit 1); 48d `process.md` names ADR-0064 once, two lines added, none removed. 48a's check "nothing else under `src/` changed" is superseded: 48b and 48c change other files under `src/` by the plan's own file lists, and `src/guards/checkouts.test.ts` is 48a's by amendment. All pass.

## Screen comparison

None — the phase changes no screen.

## Deviations from the plan

Four, all in [`phase-48-departures.md`](phase-48-departures.md):

1. The slices did not run the whole suite at their end; it ran once at the close, as the runner asked.
2. ✏ 2026-10-04 (build, timone#200) at 48a case 11: case 3 replaces the older `**Last updated:**` line by design, so case 11 does not look for that one line. The two cases contradicted each other.
3. 48c: `PUSH_GUARD_LINES` in `container-runtime.test.ts` also gained the five install lines, because the test that checks the whole script reads that list.
4. ✏ 2026-10-04 (build, timone#200) in 48a's file list: `src/guards/checkouts.test.ts` lists `merge-rules.ts` among the files that run git.

## Context for the next agent

- Run the suite with `npm run build && npx vitest run` from the project root (some tests run `dist/cli.js`).
- **A live gate is owed before delivery** (plan, *What this phase owes before delivery*): PRD-02 R1, R2, R4 and R8 depend on `src/daemon/` and `src/commands/guardrails.ts`. It is also the only check that shows the box's own git, in the real image, calls the driver and that the push guard still works with four settings. It runs on the operator's machine, and rides to the pull request.
- The `api` regression set owed: PRD-06.R5 and PRD-07.R9.
- Known open points, for the pull request:
  - The check for two `## R<k>` headings with the same number runs only when git reported a conflict. Two such sections that git merges cleanly (one added at the end, one in the middle) are not reported. ADR-0064 D1 speaks of "git's conflict", so this reading was kept; should the check run on every merge?
  - In `STATUS.md`, if the paragraph next to the `**Last updated:**` line is rewritten on both sides, removing the older date can leave an extra blank line. No case covers it; the real `STATUS.md` has a `---` line after the date.
  - The driver line does not quote the CLI path. The box's path has no space, so it works there.
  - `STATUS.md` item 1h says the pull request "opens next"; delivery should put its number in.
