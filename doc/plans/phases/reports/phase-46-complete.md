# Phase 46 — Completion Report

- **Date:** 2026-10-04
- **Plan:** [phase-46.md](../phase-46.md) — breakdown [ticket-207.md](../../breakdowns/ticket-207.md) approved by fvermaut 2026-10-04T13:41:15Z — 1 piece; this phase is that piece.
- **Requirements:** PRD-08.R1 (MUST), R2 (MUST), R3 (SHOULD), R4 (MUST), R5 (MUST), R6 (MUST) — all `draft` in the register as execution leaves them. Verification sets their status. R6 is a live check only fvermaut can run; it was not run here.
- **Branch:** `timone/210-1-every-ticket-the-machine-opens-names-t`
- **Departures:** [phase-46-departures.md](phase-46-departures.md) — 5 entries.

## Summary

Every ticket the machine opens for a piece of an approved list now ends with one line that names the project's people with `@`: `Named so that GitHub tells them about this ticket and every comment on it: @fvermaut`. The line is written by one pure function, `withPeopleNamed` in `src/daemon/people.ts`. It cleans each login, drops empty ones and repeats, and returns the body unchanged when nobody is left, so no lone `@` is ever written. `openStepTickets` in `src/daemon/chunk-zero.ts` takes the people as a required fourth argument, and its one caller passes `namedPeople` for the run's project. A step ticket that already exists is still neither opened again nor edited.

The issues the runner files on Timone use the same function with the people of the `timone` project, never those of the project the run is on. Nobody is assigned on either path, and tests in `src/adapters/github-tickets.test.ts` check that neither `gh` command carries `--assignee`. The charting instructions in `.claude/skills/timone-wayfind/SKILL.md` now tell the session to end every ticket it opens with the same line, word for word, and say where to find the people.

No adapter source file and nothing in `src/manifest.ts` changed.

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 46a — a ticket opened for a piece names the project's people | Landed first attempt. Cases 4, 6–9 green on arrival, shown not empty by breaking the code (departure 2). Case 10's body names nobody (departure 3). | `b86d171` |
| 46c — the charting instructions name the project's people on every ticket they open | Landed first attempt; ran in parallel with 46a (no shared file, no state outside the working tree). | `54d6620` |
| 46b — an issue the runner files on Timone names the people of the `timone` project | Landed first attempt. Cases 2–4 green on arrival, shown not empty by breaking the code (departure 4). | `f1151fd` |

## Tests run

The whole suite took 3.8 s at phase 45's close, so it counts as under a minute. The runner's instructions for this step asked that each slice run only the tests of what it changes, and the whole suite once at the end (departure 1). `npm run build` was run before the first slice, because `src/cli.test.ts` runs `dist/cli.js`.

- **46a:** `src/daemon/people.test.ts`, `src/daemon/chunk-zero.test.ts`, `src/adapters/github-tickets.test.ts`, `src/daemon/breakdown.test.ts`, `src/daemon/steps.test.ts`, `src/runner/actions.test.ts` (201 passed); type check exit 0; the `--assignee` grep, exit 1 as expected.
- **46c:** `src/process-text.test.ts` (41 passed); the three greps.
- **46b:** `src/runner/actions.test.ts`, `src/adapters/github-tickets.test.ts`, `src/daemon/people.test.ts` (142 passed); type check exit 0.
- **Close:** `npm run build`, exit 0; the whole suite once, 63 files, 1662 tests passed, 3.4 s; `npm run type-check`, exit 0. Then the validation of 46a, 46b and 46c once each, in that order (none changes state outside the repository): 46a, 6 files, 206 passed, grep exit 1; 46b, 3 files, 142 passed, `commentTimoneIssue` not in the diff; 46c, the line found twice in the skill, `instructors` and `operator` found, `src/process-text.test.ts` 41 passed. All passed.

## Screen comparison

None — the phase changes no screen.

## Deviations from the plan

No amendment was made to the phase file. Five departures are recorded in [phase-46-departures.md](phase-46-departures.md):

1. Slices did not run `npm test` each; the whole suite ran once at the close, as the runner asked.
2. 46a cases 4, 6, 7, 8 and 9 were green when written; each was shown to fail against deliberately broken code.
3. 46a case 10: the existing test was kept unchanged, so the body it checks after `--body` names nobody.
4. 46b cases 2, 3 and 4 were green when written; each was shown to fail against deliberately broken code.
5. PRD-08.R6, the live check of fvermaut's notifications, was not run.

Two things a slice added beyond the plan's numbered cases: a test in `src/daemon/people.test.ts` that trailing newlines are removed before the line (the plan's own description of `withPeopleNamed` asks for it), and two sentences in the skill — keep the line at the end when the map's closing line is rewritten, and no line on the markdown fallback.

## Context for the next agent

- Run `npm run build` before `npm test`: `src/cli.test.ts` runs `dist/cli.js`.
- R1, R2, R4 and R5 are `api` criteria: the tests in `src/daemon/people.test.ts`, `src/daemon/chunk-zero.test.ts`, `src/runner/actions.test.ts` and `src/adapters/github-tickets.test.ts` drive them. R3 is read in `.claude/skills/timone-wayfind/SKILL.md`.
- **HUMAN-CHECK, carried to the pull request:** PRD-08.R6 — on scratch-app, never on ivtrends, fvermaut checks that a ticket the machine opened, and a later comment on it, show in fvermaut's GitHub notifications. It stays `draft` until then. The plan says this also stands as the live gate the phase owes for PRD-02 R1, R2, R4 and R8, which depend on `src/daemon/`.
- Hard gates the plan named, all green at the close: `src/daemon/chunk-zero.test.ts` and `src/daemon/breakdown.test.ts` (PRD-07.R10), and the idempotence and Timone-issue title and label tests in `src/daemon/chunk-zero.test.ts` and `src/runner/actions.test.ts`.
