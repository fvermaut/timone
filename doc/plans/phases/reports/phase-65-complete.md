# Phase 65 — Completion Report

- **Date:** 2026-10-22
- **Plan:** [phase-65.md](../phase-65.md) — no list of pieces: a bug ([timone#90](https://github.com/fvermaut/timone/issues/90)), classified on the ticket itself, and the whole fix is one piece. No triage record was committed for it; the plan says so and anchors on PRD-02.R15.
- **Requirements:** PRD-02.R15 (SHOULD), clauses 1 and 5, for this one false finding — `draft` in the register, untouched by this step.
- **Branch:** `timone/90-the-platform-merge-carve-out-misses-squa-chunk-2`
- **Departures:** [`phase-65-departures.md`](phase-65-departures.md) — 1 entry.

## Summary

The end-of-session check no longer reports a commit that GitHub's servers built. `isPlatformMerge` in `src/daemon/hooks.ts` now asks one thing: is the committer exactly `noreply@github.com`. The old rule also asked for two or more parents. That excused GitHub's merge commits and missed its squash merges, which have one parent. This repository squash-merges every pull request, so every merge was reported (#90, #101, #231).

A merge a session makes on its own machine is still reported, because its committer is the session's. A commit by a `…@users.noreply.github.com` address is still reported, because the match is exact. A test pins each.

A test on real git repeats #231: a one-parent commit with GitHub as committer lands on the remote's `main`, the session pulls it with `git pull --ff-only`, and the check says nothing. A second test pins the limit the plan keeps on purpose: an untrailed commit a person pushed to `main` from their own machine is still blamed on the session that pulls it.

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 65a — a commit GitHub built is excused whatever its parent count | Landed on the first attempt. Cases 1, 2 and 5 seen red, then green. Cases 3, 4 and 6 green; case 3 shown able to fail with a suffix match. One departure: a branch setup step in the two real-git cases. | `88ca559` |

## Tests run

No suite was timed before the slice: phase 64's close timed the whole suite at 13 s, so it takes under a minute.

**Known in this container:** it refuses every `git push … main`, also the pushes the tests make into their own temporary repositories. The slice's checks therefore run with every `GIT_*` variable removed from the command, as the plan says. `dist/` was built with `npm run build` before the whole suite.

- **65a:** `src/daemon/hooks.test.ts` and `src/commands/guardrails.test.ts`, the tests the change can affect, 206 of 206; `tsc` exit 0. The runner asked for only the tests of what changes while working, so the whole suite was left to the close.
- **Close:** the whole suite once, as the container sets it: 78 files, 2835 tests, 2763 passed, 72 failed, in 9.5 s. All 72 are the push refusal: `guardrails.test.ts` 47 (the 45 phase 64 saw, plus this phase's two new real-git cases, which also push), `numbers.test.ts` 16, `workspace.test.ts` 6, `commands/number.test.ts` 3. The same run with every `GIT_*` variable removed: 2835 of 2835 passed, in 4.5 s. Then 65a's checks once (none changes anything outside the repository): the two files 206 of 206 (exit 0); `tsc` exit 0; the title count prints 7 (more than 2); the two test files' diff against `origin/main` removes no line; `git diff origin/main --stat` lists `hooks.ts`, the two test files, and under `doc/` only this phase's files.

## Screen comparison

None — the phase changes no screen.

## Deviations from the plan

One, recorded in [`phase-65-departures.md`](phase-65-departures.md). Cases 5 and 6 run `git checkout -q -B main origin/main` in the project's clone before the baseline. The test fixture leaves its clone on git's default branch name with no upstream, so `git pull --ff-only` had nothing to pull. The fixture itself is not changed. Nothing else departed from the plan.

The project has no `doc/standards.md`; the slice followed Timone's central `standards/testing.md`.

## Context for the next agent

- Run the two files with the container's git settings removed: `env $(env | grep -oE '^GIT_[A-Z0-9_]+' | sed 's/^/-u /') npx vitest run src/daemon/hooks.test.ts src/commands/guardrails.test.ts`.
- The rule must still fire on a commit a session made without a trailer. No criterion watches that. The tests that do are "flags a commit that says nothing about where it came from", "still flags a merge a session made itself", "still flags a commit by a users.noreply.github.com address, which is a person's or a bot's" (`hooks.test.ts`) and "flags a commit that carries no trailer at all", "still flags an untrailed commit a person pushed to main, when the session only pulled it" (`guardrails.test.ts`).
- Not covered, as the plan says: an untrailed commit a person pushes straight to `main` is still blamed on a session that pulls it; and squash merges still bury the squashed commits' trailers in `main`'s history (#101's first finding).
- `parentCount` is still collected and no rule reads it.
