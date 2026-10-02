# Phase 42 — Completion Report

- **Date:** 2026-10-02
- **Plan:** [phase-42.md](../phase-42.md) — no list-of-pieces file: fvermaut approved PRD-06 and ADR-0061 in the terminal on 2026-10-02 as one piece and one pull request (first entry of the departures record)
- **Requirements:** PRD-06.R1 (MUST) — `draft`; PRD-06.R2 (MUST) — `draft`; PRD-06.R3 (MUST) — `draft`; PRD-06.R4 (MUST) — `draft`; PRD-06.R5 (MUST) — `draft`; PRD-01.R16 (MUST) — `revised`
- **Branch:** `timone/185-a-run-spends-its-time-on-the-work`
- **Departures:** [`phase-42-departures.md`](phase-42-departures.md) — 4 entries.

## Summary

The phase delivers the two halves of [#110](https://github.com/fvermaut/timone/issues/110) and [#185](https://github.com/fvermaut/timone/issues/185) that are under Timone's control. In code: a box now asks the shared token cache for a token that outlives its own refresh interval by 15 minutes, so it can no longer be handed one that dies before the next refresh. The machine's own calls outside a box keep today's reuse. In text: the checking step does a probe's break run only when the probe is new, rewritten, in doubt, or a shared probe on a page it has never checked; after a fix it re-runs only the probes that failed and those the fix's changed file names can affect; it tells old smoke failures from new ones by the last report's list. The building step runs the tests a sub-phase's change can affect and the suites under a minute, and runs everything whole once at the close.

The centre of gravity is the text, because that is what a step session follows. Two gaps were found at the slice gates, not by the plan, and both were closed by amending the plan: a box's first token must follow the box's own refresh interval, and the one command that runs a project's probes must do real runs only, or the new rule saves nothing.

The shared probes' README still states the old rule. Only the checking step may write that folder, so the change is left to this phase's checking step (departures record, second entry).

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 42a — A box is never handed a token that dies before its next one | 6 tests added at the two declared seams, each seen red first or proved by mutation; one plan amendment from the gate (the box's own interval) | `7c0e175` |
| 42b — The checking step proves each probe once and re-runs only what a fix can affect | Rules rewritten in the checking skill and `process.md` stage 7; one plan amendment from the gate (the one-command run does real runs only); the shared README moved to the checking step | `a925bff` |
| 42c — Each building part runs the tests its change can affect, and everything runs whole once at the close | Rules rewritten in the building skill and `process.md` stage 6; the completion report gains a *Tests run* section | `d987bfb` |

## Tests run

This phase was built under the rules as they stood when it started, so each sub-phase ran the whole suite at its end. The suite is under a minute on this project.

- **Before the first slice:** the whole suite, 16 s. 6 tests in `src/cli.test.ts` failed because this working copy's built program predated the last merge; after `npm run build`, 1411 of 1411 passed. Not a fault of the code.
- **42a:** `src/adapters/credentials.test.ts`, `src/daemon/container-runtime.test.ts`, `src/adapters/command-runner.test.ts` (126 tests); type-check; the whole suite, 1417 passed.
- **42b:** no tests; text only. Its validation commands passed.
- **42c:** no tests; text only. Its validation commands passed.
- **Close:** `npm run build`, exit 0; the whole suite once, 56 files, 1417 tests passed, 16 s; `npx tsc --noEmit`, exit 0. Then the validation of 42a, 42b and 42c once each, in that order (none changes state outside the repository): all passed.

## Screen comparison

None — the phase changes no screen.

## Deviations from the plan

- ✏ 2026-10-02 (build, timone#185) — 42b no longer edits the shared probes' README. Only the checking step may write that folder (ADR-0048 D1), and the hook refuses it to a building session. The checking step of this phase owes that edit.
- ✏ 2026-10-02 (build, timone#185) — 42a: the box spawn asks for its own refresh interval plus the margin, not the default interval plus the margin.
- ✏ 2026-10-02 (build, timone#185) — 42b: the paragraph on running the whole set with one command now says that command does real runs only.
- Found on the way and filed, not fixed here: [#192](https://github.com/fvermaut/timone/issues/192), the probe guard refuses a prompt or a commit that only names a probe folder. The build skill's own instruction to name the folders in a slice's prompt cannot be followed while it stands.

## Context for the next agent

- Run the suite with `npm run build && npx vitest run --passWithNoTests` (about 16 s). The build matters: `src/cli.test.ts` runs the built program.
- **PRD-06.R5** is `api`. Its falsifying test is `"a box is never handed a token that dies before its next refresh"` in `src/daemon/container-runtime.test.ts`.
- **PRD-06.R1–R4** are `live`. Only a real check and a real build on the scratch-app fixture show a session following the new text. This phase touches what they depend on, so that watched run is owed; it rides to the pull request.
- **Owed by the checking step itself:** the shared probes' README (in the probe folder under `standards/baseline`, lines 30-39) still says a probe must be seen to fail on every build. It needs the rule of ADR-0061 D1, including the reading that a shared probe on a page it has never checked does its break run there.
- **PRD-01.R16** is `revised`, channel `human`: read a building session's handoffs for the new rhythm.
