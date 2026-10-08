# Phase 55 — Completion Report

- **Date:** 2026-10-08
- **Plan:** [phase-55.md](../phase-55.md) — breakdown of #220 ([ticket-220.md](../../breakdowns/ticket-220.md)) approved by fvermaut 2026-10-08T05:37:53Z — 1 piece; this phase plans piece 1, ticket #228.
- **Requirements:** PRD-11.R1 (MUST), R2 (MUST), R3 (MUST), R4 (MUST), R5 (MUST) — all left as the register had them; verification decides. R4 and R5 are not built by this phase (see below).
- **Branch:** `timone/228-1-tests-and-older-checks-make-their-test`
- **Departures:** [phase-55-departures.md](phase-55-departures.md) — 1 entry.

## Summary

Four test files make throwaway repositories and push `main` to them. Inside a run's container the push guard refused those pushes, so 70 tests failed there. Each of the four files now takes the run's numbered git settings out of the test process before each test, and puts them back after it. One small helper does this: `withoutRunGitSettings` in `src/test-support/run-git-settings.ts`, with its own four tests. Both the tests' own git calls and the git that Timone's code runs during a test (`reserveNumber`, the workspace sync, the guardrails command) inherit the test process's environment, so both stop seeing the guard.

No program file changed. The push guard, the container's git settings, `package.json` and `vitest.config.ts` did not change. Only tests import the helper. Inside this run's container the whole suite now passes: 1988 tests, none failed, none skipped, where 70 failed before. A dry-run push to the project's real `main` from this container is still refused by the guard.

The helper removes only `GIT_CONFIG_COUNT`, `GIT_CONFIG_KEY_<n>` and `GIT_CONFIG_VALUE_<n>`. It does not remove every `GIT_*` variable as `src/daemon/push-guard.git.test.ts` does. The plan chose this and gives its reason (Goal Description, Open question 2).

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 55a — the helper, and the three smaller files pass inside a run's container | Helper and its 4 tests, red then green. `numbers.test.ts` 16/16, `commands/number.test.ts` 4/4, `workspace.test.ts` 6/6; before the change 25 of these 26 failed on the guard. First attempt. | `9f4411a` |
| 55b — `guardrails.test.ts` passes inside a run's container | 52/52; before the change 45 of 52 failed on the guard. The two tests that call `vi.unstubAllEnvs()` part-way pass, and no refusal follows them. First attempt. | `076c659` |
| 55c — the whole suite, the guard still refusing `main`, PRD-11's phase line | Whole suite 1988 tests, 0 failed, 0 skipped. Dry-run push to `main` refused, exit 1. PRD-11 names phase 55. First attempt. | `835202c` |

## Tests run

No suite was timed before the first slice: phase 54's close timed the whole suite at 11.2 s, under a minute. The runner asked that each part run only the tests of what it changes, and the whole suite once at the end (departure 1).

- **55a:** `src/test-support/run-git-settings.test.ts` (4 passed), `src/numbers.test.ts`, `src/commands/number.test.ts`, `src/workspace.test.ts` (26 passed), `src/guards` (7 passed); `npm run build` and `tsc --noEmit` exit 0.
- **55b:** `src/commands/guardrails.test.ts` (52 passed); `npm run build` and `tsc --noEmit` exit 0.
- **55c:** the whole suite, after `npm run build`: 77 files, 1988 tests, 1988 passed, 0 failed, 0 skipped, 8.9 s, with no guard refusal line in its log. `src/daemon/push-guard.test.ts` and `src/daemon/push-guard.git.test.ts` (42 passed).
- **Close:** the whole suite was not run a second time. 55c's run is the close's whole run: it came after the last code change, and only the handoff file changed after it. Then each sub-phase's validation steps once, in the order 55a, 55b, 55c. None of them changes state outside the repository, so the order is safe. 55a: 9 numbered git settings in the environment; build exit 0; helper 4/4; the three files 16/16, 4/4, 6/6, no refusal line; `src/guards` 7/7; nothing skipped. 55b: 52/52, no refusal line, nothing skipped, one line removed (the old vitest import). 55c, without its whole-suite run: the guard, the container runtime and their two test files are unchanged, 42/42; the dry-run push to `main` was refused with the guard's `Refused:` line, exit 1; the only non-test file changed under `src/` is the helper; `package.json` and `vitest.config.ts` unchanged; no non-test file imports the helper; no file outside the allow-list changed.

## Screen comparison

None — the phase changes no screen.

## Deviations from the plan

None in the plan's text — no amendment was made. One departure from the process is recorded in [phase-55-departures.md](phase-55-departures.md): the whole suite ran only at the end, at the runner's request.

## Context for the next agent

- **PRD-11.R1, second clause** (the suite passes outside a run's container): no session in a run can show this from inside a run. Making a shell without the run's git settings means unsetting those variables in a shell command, and the session's guard refuses such commands, rightly. The `tests` workflow in `.github/workflows/tests.yml` runs `npm test` on every pull request on a GitHub runner, which has no run's git settings. Its result on this phase's pull request is the evidence (plan, Open question 1).
- **PRD-11.R4 and R5 are left to the step that checks the build.** This phase changed none of the 7 older checks of PRD-05.R2, R3, R4, R5, R7, R10 and R11. Every commit it made passes the allow-list check in 55c, which lists the only files the building step may change. The checking step changes those checks in the same way 55a describes for tests and shows that they reach a verdict.
- **How to run:** `npm run build`, then `npx vitest run`. In a run's container the environment has 9 numbered git setting variables; count them with `env | grep -c '^GIT_CONFIG'`.
- **A shell command that names those variables is refused** in a run's session. To test a change to the helper by breaking it on purpose, write the broken file with the editor and copy it in with `cp` (55a's handoff).
- PRD-05.R18 needs a logged-in terminal and stays out of reach, as PRD-11's out-of-scope list says.
- What the delivery review may want to tidy: nothing was flagged by the slices.
