# Phase 44 — Completion Report

- **Date:** 2026-10-04
- **Plan:** [phase-44.md](../phase-44.md) — piece 1 of the [breakdown for #197](../../breakdowns/ticket-197.md), approved by fvermaut 2026-10-04T06:34:53Z — 6 pieces
- **Requirements:** PRD-07.R8 (MUST), clause 1 only — `draft` in the register, as execution leaves it. Clauses 2 and 3 are piece 2.
- **Branch:** `timone/199-1-numbered-files-never-take-the-same-num`
- **Departures:** [`phase-44-departures.md`](phase-44-departures.md) — 4 entries.

## Summary

`node dist/cli.js number <project> <kind>` now reserves the next number of a phase file, an ADR, a triage record or a PRD, and prints it ([ADR-0062](../../../adr/0062-a-numbered-file-takes-its-number-by-reserving-it-on-the-projects-remote.md)). It creates the ref `refs/timone/numbers/<kind>/<n>` on the project's remote. The remote creates a ref only once, so of several sessions trying the same number, one gets it and the others take the next. The test that five clones asking at once get five different numbers is R8's falsifier, in `src/numbers.test.ts`.

The run's push guard now lets any step create such a ref, and nothing else new: moving or deleting one is refused, and every earlier guard test passes unedited. The build and check prompts now find their plan as the phase file the branch added, not the newest one. The five instructions that number files, and `process.md`, now send a session to the command and say to stop if it fails.

The centre of the work was 44a. Its first attempt hit a guard test that refuses any unlisted file running git or reaching into `projects/`. The plan was amended to add the two new files to that guard's lists, each with its reason. **The person reviewing should confirm this new entry** (see *Context for the next agent*).

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 44a — `timone number` reserves a number that no other session can get | Landed on the second attempt, after the plan granted `src/guards/checkouts.test.ts`; case 7's checkbox and the command's test seam amended | `d449443` |
| 44b — a run's push guard lets it create a reservation, and nothing more | Landed first time; ran beside 44c | `e856df3` |
| 44c — the build and the check find their own phase file by what the branch added | Landed first time; ran beside 44b | `1be8474` |
| 44d — every skill that numbers a file takes its number from the command | Landed first time; its three cases were written together, all seen red | `4ffa6bf` |

## Tests run

The whole suite took 3.1 s at phase 43's close and 3.7 s in a run before the first slice (59 files, 1534 tests passed), so it is under a minute. After 44a, the person running the build asked that no slice run the whole suite again; from then on each slice ran only the tests named below (departure 4).

- **44a:** `src/numbers.test.ts`, `src/commands/number.test.ts`, `src/guards/checkouts.test.ts` (27 tests); type check; build; the whole suite three times, the last 61 files, 1554 passed.
- **44b:** `src/daemon/push-guard.test.ts`, `src/daemon/forge-guard.test.ts`, `src/numbers.test.ts` (77 tests); then `src/commands/guardrails.test.ts`, `src/daemon/hooks.test.ts`, `src/daemon/session.test.ts`, `src/daemon/container-runtime.test.ts`, `src/guards/checkouts.test.ts`, `src/commands/number.test.ts` (256 tests); type check.
- **44c:** `src/daemon/prompts.test.ts` (209 tests); then `src/runner/actions.test.ts`, `src/runner/replay/harness.test.ts`, `src/commands/takeover.test.ts`, `src/daemon/session.test.ts` (122 tests); type check.
- **44d:** `src/process-text.test.ts` (41 tests); type check.
- **Close:** `npm run build`, exit 0; the whole suite once, 61 files, 1609 tests passed, 3.7 s; `npm run type-check`, exit 0. Then the validation of 44a, 44b, 44c and 44d once each, in that order (none changes state outside the repository; the git tests use temporary folders): all passed. 44a's probes gave exit 0, 1, 1 and `ls-remote` printed 0. 44b's removed-line probe, against the plan commit `9c50c36`, gave exit 1, and its forge-guard probe printed 0. 44c's grep gave exit 1. 44d's grep counted 1, 1, 1, 1, 2, 1.

## Screen comparison

None — the phase changes no screen.

## Deviations from the plan

- ✏ 2026-10-04 (build, timone#199): 44a was granted `src/guards/checkouts.test.ts`, and `numbers.ts` and `commands/number.ts` are now listed in it with their reasons. The command spells its folder `resolve(cwd, config.path)` so the guard sees it.
- ✏ 2026-10-04 (build, timone#199): 44a case 7's checkbox now asks for red with no random line **and** no `*` check. Either safeguard alone keeps the case green, as the handoff shows.
- ✏ 2026-10-04 (build, timone#199): the command is tested through `registerNumberCommand` on a fresh `Command`, because importing `src/cli.ts` runs the command line.
- 44b added one row to case 2 that the plan did not list: a delete whose far side also reads as no commit. Without it, the `localSha` clause could be removed and no test would fail.
- 44d also struck a phrase the plan did not name: `timone-plan`'s reading list said the folder gives "the next phase number".
- Slices after 44a did not run the whole suite (departure 4).

## Context for the next agent

- **How to run.** `npm run build`, then `npm test`. The push-guard tests run the hook through `dist/cli.js`, so build first.
- **Never run the command against a real remote while checking.** A reservation on the real remote is permanent (ADR-0062 D4). Every test uses a bare repository in a temporary folder.
- **A live check is owed before delivery**, as the plan says: PRD-01.R10 and PRD-02 R1, R2, R4, R8 depend on files this phase changed. It is also the only way to learn whether GitHub accepts a push to `refs/timone/numbers/…` from the box's App token. If only the operator can run it, it goes to the pull request.
- **A question for the person who reviews the pull request.** The guard in `src/guards/checkouts.test.ts` keeps a short list of files allowed to run git or reach into `projects/`, and adding to it "means editing this file, which is the point". This phase adds `numbers.ts` and `commands/number.ts`. The build took that as decided by ADR-0062 (the command works in the project's checkout). The person should confirm it.
- **Known gaps, not fixed:** a project folder that does not exist gives git's unclear `spawn git ENOENT`; `doc/feedback/` is still a numbered folder the command does not know (no skill writes it); the triage GitHub path relies on the doc-record step's numbering sentence; the guard's folder pattern misses `resolve(process.cwd(), x.path)` written in one call.
- **R8 stays `draft`:** verification may record clause 1 as passing, but the register's status covers all three clauses.
