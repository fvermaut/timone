# Phase 36 — Departures record

> One dated entry per departure, appended as it happens, never rewritten. Format per `.claude/skills/timone-execute/SKILL.md`, "The departures record".

## 2026-09-07 — timone#106, verification

**Kind:** check not run

**Agreed:** PRD-03.R2 and PRD-03.R4 are both `Verify-via: live`, and this phase's diff touches a declared dependency (`.claude/skills/timone-deliver/SKILL.md`), so a fresh watched delivery was owed before either could be observed. The verification report ([phase-36-verification.md](phase-36-verification.md), "Carried forward") states what that run must show. Neither criterion has ever been watched: both stand at `Last live gate: never`.

**Did instead:** The watched run was not driven. fvermaut decided on [ticket #106](https://github.com/fvermaut/timone/issues/106) on 2026-09-07 ("go ahead without it") to open the pull request without it. The verification stage could not act on that reply and stopped twice; the decision is recorded here by hand instead, in the takeover the stage asked for. PRD-03.R2 and PRD-03.R4 stay `draft`, their `Last live gate:` fields stay `never`, and the watched delivery remains owed after the merge — nothing about the criteria themselves is changed by this entry.

**Why:** Only the human may decide to ship without the watched run, and he did, in writing, on the ticket. Recording the decision and carrying on to the pull request is what [ADR-0052](../../../adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md) requires of a run inside the build; the stops it caused instead are filed as [timone#116](https://github.com/fvermaut/timone/issues/116) and [timone#117](https://github.com/fvermaut/timone/issues/117).
