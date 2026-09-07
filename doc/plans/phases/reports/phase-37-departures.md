# Phase 37 — Departures record

> One dated entry per departure, appended as it happens, never rewritten. Format per `.claude/skills/timone-execute/SKILL.md`, "The departures record".

## 2026-09-07 — timone#115, delivery

**Kind:** check not run

**Agreed:** PRD-03.R1 is `Verify-via: live` and its `Depends-on` line lists `src/daemon/`; this phase's diff changes `src/daemon/poll.ts`, so a fresh watched run was owed before the pull request could open. The verification report ([phase-37-verification.md](phase-37-verification.md), "Live gates") records the debt: one watched run that puts a ticket on hold and shows the parked run staying put.

**Did instead:** The watched run was not driven. fvermaut decided in an interactive session on 2026-09-07 ("open the PR without it, by hand") to open the pull request without it — the same choice he made on ticket #106. The decision is recorded here and the pull request opens carrying it. PRD-03.R1 stays `verified` on its existing evidence, its `Last live gate:` field is unchanged, and the watched run remains owed after the merge: the next change touching `src/daemon/` owes it again, and this fix has still never been seen working on a real daemon.

**Why:** Only the human may decide to ship without the watched run, and he did, in writing. Recording the decision and carrying on to the pull request is what [ADR-0052](../../../adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md) requires of a run inside the build. The stop that asked for this decision — instead of recording the owed run and opening the pull request — is the fault tracked on [timone#117](https://github.com/fvermaut/timone/issues/117), where this occurrence is recorded as its second sighting.
