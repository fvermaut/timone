# Phase 35 — Completion Report

- **Date:** 2026-09-05
- **Plan:** [phase-35.md](../phase-35.md) — breakdown approved by fvermaut 2026-09-05T15:47:09Z — 2 pieces (this phase builds piece 1)
- **Requirements:** PRD-03.R1 (MUST) — draft, `Verify-via: live`, not flipped by this phase (execution never writes the register); PRD-03.R3 (MUST) — draft, `Verify-via: api`, not flipped by this phase; PRD-03.R5 (MUST) — draft, `Verify-via: live`, not flipped by this phase. All three stay `draft` until the live gate this phase itself says it owes (see below) has run.
- **Branch:** `timone/105-1-the-run-carries-on-instead-of-stopping`
- **Departures:** [phase-35-departures.md](phase-35-departures.md) — 1 entry.

## Summary

This phase implements [ADR-0052](../../adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md) mechanically across the daemon and the three build-stage skills: from a run's last human agreement to its pull request, `execution`, `verification` and `delivery` no longer stop, ask, or park. Five sub-phases, each depending only on what the plan declared, landed in order.

The daemon (35a) gained a pure `inBuild(stage)` fact on the stage graph and a branch in `afterStage`'s escalated-outcome dispatch: an escalation inside `execution`, `verification` or `delivery` now fails the run instead of parking it on a person, and `timone status`'s CTA for a failed run recognises the new failure-reason prefix and reports it as the machine's own defect. Every other stage — `requirements`, `breakdown`, `remediation`, every discovery stage — keeps ADR-0033's park-and-wait behaviour unchanged, confirmed by a regression-guard test. The daemon-mechanical detectors (`RunStore.reclaim()`, `boundRefusal()`) were confirmed untouched — they call `store.park()` directly and never pass through the escalated-outcome branch this phase modified.

The three build-stage skills (35b, 35c, 35d) each gained the same shape: a stage that used to stop and route to a human or another stage now records what happened — a plan or requirement it amended, a check it could not run, a workaround it applied, an exhausted retry — as one dated entry in a new per-phase file, `phase-NN-departures.md`, and carries on to its own ordinary completion. `timone-execute` gained direct authority to amend the phase file or the requirements register itself, in place, with a dated marker naming the run, rather than routing to `timone-plan` and stopping. `timone-verify`'s environment gate and fix-loop exhaustion both record and continue instead of stopping. `timone-deliver`'s verification gate no longer refuses on a failed or BLOCKED register; it still refuses on a missing verification report or an owed-and-unrun live gate, and its look gate (a separate, still-live refusal named R4 in PRD-03 and explicitly out of scope for this phase) is untouched.

`process.md` (35e) — the single normative definition every stage skill is supposed to implement — was brought into agreement with all four prior sub-phases: its stage 6, 7 and 8 notes no longer describe the old stop-and-route behaviour, its "Gates, conversations and the human" section states the build-phase carve-out directly by name, and its artifact-conventions list documents the new departures-record file.

One departure was recorded during the phase itself (see below): sub-phase 35b's four named edits left three further passages in the same skill file describing pre-ADR-0052 behaviour, found and fixed in place before that sub-phase's commit, using the very authority the sub-phase had just written into the file.

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 35a — The daemon can tell a build stage from any other, and a stray escalation from one is a failure, not a park | Landed first attempt; full daemon suite green (1179 tests, 21 files) | `cfbaa2b` |
| 35b — Execution amends the plan and the register itself, records what it bent, and never stops for it | Landed first attempt; one departure recorded and fixed in-slice (see Deviations) | `0d4db3b` |
| 35c — Verification records what it could not check or could not fix, and hands the run to delivery anyway | Landed first attempt | `99aa6c0` |
| 35d — Delivery opens the pull request on a failed or blocked phase instead of refusing it | Landed first attempt; one routing decision resolved by the orchestrator (see Deviations) | `f9ede7d` |
| 35e — `process.md` describes the build that no longer stops | Landed first attempt; one consistency fix beyond the plan's four literal bullets (see Deviations) | `6deba00` |

## Deviations from the plan

- **35b:** three passages in `.claude/skills/timone-execute/SKILL.md`, outside the four exactly-named edits, still described the pre-ADR-0052 stop-and-park behaviour after those four edits landed (the resume-logic note on an uncommitted handoff section, the matching "what dirty means" sentence, and the Closing section's report-order list). Fixed in place by the orchestrator before the sub-phase's commit, using the amendment authority the sub-phase itself had just written into the file, and recorded as the phase's one departures-record entry — see [phase-35-departures.md](phase-35-departures.md).
- **35d:** the plan's own validation checklist and its prose instruction were only jointly satisfiable by routing the surviving live-gate-owed clause somewhere other than its old "file it as a ticket for stage 1" wording. The orchestrator resolved this by directing it to "route to the human" — a phrase already used elsewhere in the same file for exactly this kind of situation — rather than leaving an ambiguity for the sub-agent to guess at.
- **35e:** one edit beyond the plan's four literal bullets — a consistency fix renaming `process.md`'s "a handed-to-the-human section" (in stage 7's list of a verification report's required elements) to "a carried-forward section, pointing at the departures record", matching the rename 35c already made to the same concept in `timone-verify/SKILL.md`'s own report template. Not applying it would have left `process.md` describing an artifact element under a name the skill it normatively describes no longer uses.
- Otherwise: the phase executed as planned, in dependency order, with no other departure from what the plan named.

## Context for the next agent

**How to check this without re-deriving it:** `npm run build` (tsc) and `npx vitest run src/daemon` (1179 tests, 21 files) are the daemon-side evidence for 35a; every other sub-phase is documentation-only and its own checklist (quoted in its handoff section) is the evidence. `doc/plans/phases/reports/phase-35-handoffs.md` carries all five sub-phases' full validation transcripts, including the red-green trace for 35a's TDD loop.

**This phase owes a live gate before delivery.** PRD-03.R1, R3 and R5 are all `Verify-via: live`; their criteria stay `draft` until a live gate has driven a real run through a plan contradiction and through exhausted retries and watched both reach a pull request with no waiting state — that gate is stage 8's to schedule, not this phase's to run, and PRD-03's own criteria register already says so. Verification can check the daemon's own unit-level behaviour (already done, above) but cannot itself discharge R1/R3/R5.

**What this phase deliberately did not touch:** R2 (the pull request body's own "opens on what was bent" section) and R4 (the screen-at-the-pull-request reversal) are ticket-103's second breakdown piece, not built here. The departures record this phase introduces is what that piece will read from to compose the pull request's opening section — this phase only had to make sure nothing that happens gets lost before that piece can read it.

**A transient environment fault occurred mid-phase and self-resolved.** After committing 35d, `git push` failed twice with an invalid GitHub credential (confirmed via direct API calls returning 401 "Bad credentials", with no working alternate credential path — no SSH key, no valid `GITHUB_TOKEN`). A bounded retry (ten attempts over roughly four minutes) did not clear it; a final retry roughly ten minutes after the first failure succeeded, and the branch has been in sync with `origin` since. This is not a departure from the plan — it is an infrastructure fact about the container this session ran in, noted here only because a reader checking commit timestamps against push timestamps would otherwise find a gap unexplained.
