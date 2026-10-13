# Phase 60 — Completion Report

- **Date:** 2026-10-13
- **Plan:** [phase-60.md](../phase-60.md) — no list of pieces: hand-run work on two bugs, [timone#248](https://github.com/fvermaut/timone/issues/248) and [timone#249](https://github.com/fvermaut/timone/issues/249), which fvermaut chose on 2026-10-13 to have fixed in this session, in one pull request.
- **Requirements:** PRD-07.R2 (MUST) — `verified`, unchanged; PRD-07.R3 (MUST) — `verified`, unchanged; PRD-05.R1 (MUST) — `draft`, unchanged; PRD-05.R18 (MUST) — `verified`, unchanged. Verification decides each.
- **Branch:** `timone/248-a-refused-ticket-waits-in-line`
- **Departures:** [phase-60-departures.md](phase-60-departures.md) — 1 entry.

## Summary

Two places where a ticket refused a place on its project was never put in line, so nothing woke it again. Both were seen on ivtrends on 2026-10-12, where four tickets stood still for up to three days.

60a makes the session that writes an approval into its file ask for a place before the approval is written, as a step does, and makes the runner's wake count that refusal as a refusal for want of a place. The ticket then stays in line and is woken when a place is given to it. 60b makes the runner's brief say "This ticket waits for its turn." only when the run really waits for a place; a run that never asked is told it is not in line and that a refused try puts it in line, and the planner line says that starting the build asks the planner. 60c adds a dated note to ADR-0063 D2, which also records that D2's second paragraph has not held since 2026-10-05.

The real replay ran on the model after 60b: 24 of 24 cases, each three tries of three, $2.93 ([phase-60-replay.md](phase-60-replay.md)).

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 60a — recording an approval asks for a place, and a refusal leaves the ticket in line | Landed on the first try. Five new cases at `recordApproval` and `wakeRunner`. The plan's two check runs moved to verification (departure 1). | `51bbcdb` |
| 60b — the brief says whether this ticket is in line, and that starting the build asks the planner | Landed on the first try. Five new cases, two updated. Human gate: the real replay, run 1, 24 of 24. | `3402ea7` |
| 60c — ADR-0063 note under D2 | Landed on the first try. Six lines added, none removed. | `9eb0878` |

## Tests run

No suite was timed before the first slice: phase 59's close timed the whole suite at 21.1 s, so it takes under a minute, and each slice ran it whole at its end.

- **60a:** `src/runner/actions.test.ts` and `src/runner/session.test.ts` (118 passed), `src/daemon/runs.test.ts` (161 passed), `npx tsc --noEmit` exit 0, `npm run build` exit 0; the whole suite, 2747 passed, 41.3 s on a machine with a load average of about 52.
- **60b:** `src/runner/brief.test.ts` and `src/runner/session.test.ts` (84 passed), `npx tsc --noEmit` exit 0, the dry replay 24 of 24; the whole suite, 2752 passed, 22.1 s.
- **60c:** no tests; the two checklist commands.
- **Close:** the whole suite once: 77 files, 2752 tests, all passed, 34.3 s. Then each sub-phase's validation steps once, in the order 60a, 60b, 60c, none of which changes state outside the repository: 60a — 120 passed in the two runner files (they include 60b's two new `session.test.ts` cases), 161 passed in `runs.test.ts`, `tsc` exit 0, build exit 0; 60b — 84 passed, the sentence still used at `brief.ts:463`, the dry replay 24 of 24; 60c — both issues named, six lines added under `doc/adr/`.
- **The real replay** (60b's human gate): 24 of 24, $2.93 — see [phase-60-replay.md](phase-60-replay.md).

## Screen comparison

None — the phase changes no screen.

## Deviations from the plan

- **The PRD-07 R2 and R3 check runs moved from 60a to verification** (`✏ 2026-10-13 (build, timone#248)` in the phase file; departure 1). They are the checks verification runs against the build, and the build may not use them.

## Context for the next agent

- **Verification owes the two PRD-07 check runs** (R2 and R3) that the plan first put in 60a. They need `npm run build` first.
- **An open point from 60a, kept as built:** when another run takes the place between the ask and the start (60a case (4), a rare race), the `approval` entry is already in the record while the file is not yet written. The refusal says only that the ticket waits for its turn. The orchestrator kept this: on 2026-10-13 ivtrends#182 was in exactly this state (the approval recorded on 2026-10-09, the file not written), and when woken the runner saw that the file still waited for approval and recorded it again. The ADR-0063 note says so in two sentences.
- **Deferred refactoring, for the delivery review:** `startStep` and `recordApproval` in `src/runner/actions.ts` repeat the same four parts (build `turn`, ask, refuse, ask again in the `catch`); the two wrappers in `watched` in `src/runner/session.ts` repeat the same refusal check.
- **What no criterion watches:** whether the model, told truthfully that its ticket is not in line, tries the step. The replay has no case for it; a new case would be a new row in PRD-05.R18, which fvermaut approves.
- **After merge,** the daemon runs from the host copy at `~/dev/timone`. It picks up the fix only after that copy is updated and built, and the daemon restarted from fvermaut's own terminal.
