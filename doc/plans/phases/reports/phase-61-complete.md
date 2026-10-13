# Phase 61 — Completion Report

- **Date:** 2026-10-13
- **Plan:** [phase-61.md](../phase-61.md) — no list of pieces: a bug ([timone#234](https://github.com/fvermaut/timone/issues/234), with [timone#235](https://github.com/fvermaut/timone/issues/235) folded in) that fvermaut settled in the terminal on 2026-10-13 and asked the machine to build, recorded in [triage 004](../../../triage/004-the-update-joins-check-script-conflicts.md). Triage sent it straight to planning, and the whole fix is one piece.
- **Requirements:** PRD-07.R7 (MUST) — `draft`, unchanged; PRD-05.R18 (MUST) — `verified`, unchanged. Verification decides each.
- **Branch:** `timone/234-the-update-step-cannot-finish-a-merge-wh`
- **Departures:** [phase-61-departures.md](phase-61-departures.md) — 4 entries.

## Summary

The update can now finish a merge where main and the branch both changed a check script. A new command, `timone update-conflicts <project>`, lists the files a merge left in conflict and says which are check scripts. The update's instructions now tell the session to join those itself, by the five rules of [ADR-0068](../../../adr/0068-the-update-joins-a-conflict-in-a-check-script-itself-and-a-merge-it-could-not-finish-is-a-step-that-failed.md) D1, and to give only the other files to the fix context. The record entry has a new `Check scripts joined:` line, and the pull request shows it.

An update that ends cleanly but did not bring the branch level is now recorded as a step that failed. When the step ends, code asks the forge whether the branch holds the commit the step's new record entry names; with no new entry, it asks how far the branch is behind. The runner is then told the step failed, and its rule says to tell the ticket what stopped it and ask a named person. A forge that does not answer never turns a step into a failure.

For #235, the update now finds ivtrends' check scripts, which use a dash (`prd-18-r12.mjs`), and runs each `test:` script of a project that has no `test` script, leaving out a watch script.

What no test watches: the join itself is a judgement the update session makes from its instructions. Only a live update shows a session joining one (see the last section).

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 61a — dashed check-script names, and the `test:` scripts | Landed first try. | `b0a26ab` |
| 61b — `update-conflicts` sorts conflicted files; the both-sides test | Landed after a plan amendment: the new command had to be added to the list in `src/guards/checkouts.test.ts` of files that run git, which the plan did not grant. Its third check runs from the Timone root. | `2056862` |
| 61c — the record's `Check scripts joined:` line and the entry's time | Landed first try. | `3983dbe` |
| 61d — an unfinished update ends as failed; the runner asks a person | Landed first try. Its human gate, the real replay on the model, was not run: this container has no model login (see below). | `2a5293e` |
| 61e — the update's instructions, `process.md`, the check's instructions, `CONTEXT.md` | Landed first try. | `7165257` |

## Tests run

No suite was timed before the first slice: phase 60's close timed the whole suite at 34.3 s, so it takes under a minute. 61a and 61b ran it whole at their end. From 61c on, at fvermaut's request during the build, each sub-phase ran only the tests of the files it changed and the tests its own checks name, and the whole suite ran once at the close (departures entry 3).

**Known before any change, in this container:** 71 tests fail. 70 are git-fixture tests whose `git push … main` to a temporary remote is refused by the container's push guard: 45 in `src/commands/guardrails.test.ts`, 16 in `src/numbers.test.ts`, 6 in `src/workspace.test.ts`, 3 in `src/commands/number.test.ts`. 1 is in `src/daemon/register.test.ts`: PRD-07.R3 is marked `verified` while its notes say a clause was never seen to hold. None of them is in a file this phase changed, and none was changed.

- **61a:** `src/update-checks.test.ts`, `src/update-checks.git.test.ts`, `src/commands` — the two update-checks files 18 of 18; `tsc` exit 0; the whole suite 2690 passed, 71 failed (the known ones), 8.1 s.
- **61b:** the same files plus `src/daemon/probeGuard.test.ts` and `src/guards/checkouts.test.ts`; `tsc` exit 0; the whole suite 2698 passed, 71 failed (the known ones), 8.0 s.
- **61c:** `src/runner/update-section.test.ts`, `src/runner/driver.test.ts` — 44 of 44; `tsc` exit 0. (It also ran the whole suite once, before the request arrived: 2702 passed, 71 failed.)
- **61d:** `src/runner`, `src/adapters` — 486 of 486; `tsc` exit 0; the dry replay 24 of 24.
- **61e:** `src/daemon/prompts.test.ts`, `src/update-checks.git.test.ts`, `src/process-text.test.ts` — 317 of 317.
- **Close:** the whole suite once: 77 files, 2786 tests, 2715 passed, 71 failed — exactly the known ones — 9.5 s. Then each sub-phase's checks once, in the order 61a, 61b, 61c, 61d, 61e; none changes anything outside the repository. 61a: 297 passed, 48 failed (the known ones in `src/commands`), `tsc` exit 0, no reader of `testCommand` left. 61b: 983 passed, 48 failed (the same), `update-conflicts timone` exit 2 with "No merge is in progress in timone: there is nothing to join." 61c: 53 passed. 61d: 486 passed, the dry replay 24 of 24. 61e: the three searches as expected, 274 passed.
- **The real replay** (61d's human gate): not run. `npm run replay -- --case 139` ended three times with "Not logged in · Please run /login", at $0.00. It rides to the pull request.

## Screen comparison

None — the phase changes no screen.

## Deviations from the plan

- **61b's file list** — ✏ 2026-10-13 (build, timone#234): `src/guards/checkouts.test.ts` was granted, to add `commands/update-conflicts.ts` to its list of files that run git. Without it the whole suite fails one test.
- **61b's third check** — ✏ 2026-10-13 (build, timone#234): run from the Timone root, because the command finds the project at `projects/<name>` under the folder it runs in.
- **Test rhythm** from 61c on, at fvermaut's request: see *Tests run*.
- **The real replay** was not run: no model login in this container.
- **ADR-0066 was not edited.** The runner's instructions for this step asked to change "the matching words in ADR-0066". The plan says ADRs are never edited, and ADR-0066's status line already says ADR-0068 amends D4 and D2. The plan was followed.

Each is in [phase-61-departures.md](phase-61-departures.md) except the last, which follows the plan.

## Context for the next agent

- **Run:** `npm run build`, then `npx vitest run`. Expect the 71 known failures in this kind of container, and no other. `node dist/cli.js update-conflicts <project>` runs from the Timone root.
- **The real replay is owed before the pull request** (PRD-05.R18 clause 2, because 61d changed the runner's update rule). fvermaut runs it: `cd ~/dev/timone/projects/timone && npm run build && npm run replay 2>&1 | tee ~/dev/timone/.timone/replay-61.txt`, and its output goes into `phase-61-replay.md` as run 1.
- **A live gate is owed** (PRD-07.R7 is `live` and depends on `src/runner/`, `src/daemon/`, `.claude/skills/`): an update on scratch-app where both sides changed one check script. Only that shows a session joining a script by the rules.
- **#240 stays open.** After a merge, a check that compares with "where the branch left main" compares with main itself. The update's instructions now say so, and say not to add a pin.
- **Refactor ideas from the handoffs:** `commands/update-checks.ts` and `commands/update-conflicts.ts` share a copy of `gitIn` and the manifest lookup; `newestUpdateEntry` and its caller in `actions.ts` both read the default branch from the forge; the git detector in `src/guards/checkouts.test.ts` matches `execFileSync("git"` but not `spawnSync("git"`.
