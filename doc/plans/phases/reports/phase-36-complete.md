# Phase 36 — Completion Report

- **Date:** 2026-09-07
- **Plan:** [phase-36.md](../phase-36.md) — breakdown approved by fvermaut 2026-09-05T15:47:09Z — 2 pieces (this phase builds piece 2)
- **Requirements:** PRD-03.R2 (MUST) — `draft`, `Verify-via: live`, not flipped by this phase (execution never writes the register — this phase still owes a live gate before delivery, per the phase file's own note); PRD-03.R4 (MUST) — `draft`, `Verify-via: live`, not flipped by this phase, same live-gate obligation.
- **Branch:** `timone/106-2-the-pull-request-carries-the-judgement`
- **Departures:** *none — the phase executed as planned.*

## Summary

This phase implements the second half of [ADR-0052](../../adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md): the pull request's body now opens on what was bent, and — when the phase carries a screen — on that screen's comparison and preview address, instead of waiting for a human to look at the screen before the pull request can exist at all.

Sub-phase 36a rewrote `.claude/skills/timone-deliver/SKILL.md`'s gate 4. It was a blocking look gate that stood the app up, showed the human the built screen next to its reference, and refused to open a pull request until they said yes. It is now called "The screen" and asks nobody anything: its one remaining refusal fires only when a phase's completion report carries no shell-slice comparison at all — a missing artifact, not a judgement to make. Otherwise it reads the shell slice's recorded difference list and reference straight from the completion report and carries both into the pull request body. The delivery report's `Look gate:` field became a `Screen:` field, and the pull request body template gained two new opening sections, `## Departures` and `## The screen`, placed before `## Scope` — ahead of everything else in the body — with the screen section ending on "No prior viewing: merging this pull request is the yes." The workflow's numbered step list was updated to compose both sections before the delivery report is committed.

Sub-phase 36b brought `process.md`'s stage 8 note into agreement with what 36a built: the sentence describing the old pre-PR viewing gate is gone, replaced by a description of the two opening sections and which requirement each satisfies (PRD-03.R2 for departures, PRD-03.R4 for the screen), and the "Gate order" sentence now names "the screen gate" and states its one surviving refusal. The "How to try it" paragraph gained a clause noting these two sections precede its steps in the body's final order.

Both sub-phases carried no behaviour-carrying code — they are process-instruction and template text — so validation throughout was checklist-based: grep assertions plus hand diff-review, all run and confirmed by both slices and re-confirmed at phase close. Neither slice needed a retry, and neither triggered gate 2 or gate 3, so nothing was recorded on a departures file — none exists for this phase.

The ticket's third clause — closing a pull request without merging bringing the work back as a fresh request — needed no work here. It reads that way in the ticket only because the breakdown predates phase 35, which had already built the stop-and-ask mechanism that clause turned out to describe; the phase file recorded this before building started, and nothing in this phase touches `poll.ts` or `dropped.ts`.

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 36a — The pull request body opens on departures and, when there is a screen, its comparison | Landed first attempt; all seven validation greps and both diff-review checkboxes passed | `0f97f5e` |
| 36b — `process.md` describes the pull request that carries the judgement | Landed first attempt; all three validation greps and both diff-review checkboxes passed | `11bc767` |

## Deviations from the plan

None — the phase executed as planned. One in-slice judgement call is worth naming: sub-phase 36a removed the SKILL.md paragraph beginning "This does not reverse the HUMAN-CHECK rule below," which contrasted the old blocking look gate's judgement against a HUMAN-CHECK's deferred evidence. Once gate 4 stopped performing that judgement, the paragraph asserted something no longer true, so it was deleted rather than edited in place — reasoned through and recorded in the sub-phase's own handoff section, not a plan contradiction.

## Context for the next agent

Both requirements this phase claims — PRD-03.R2 and PRD-03.R4 — are `Verify-via: live` and stay `draft`. The phase file states plainly that this phase owes a live gate before delivery: one real delivery, carrying a screen and at least one departure, watched to confirm the pull request body opens with both new sections first-thing, before `## Scope`. `src/daemon/` is untouched by this phase, but the dependency list for both criteria names `.claude/skills/timone-deliver/` (which this phase did change) as an OR-path, so the live-gate obligation is real per [ADR-0051](../../adr/0051-timone-verifies-itself-by-live-gate-and-a-regression-set-is-narrowed-by-what-it-depends-on.md) D4.

To run the app: there is no application code in this phase — the changed files are `.claude/skills/timone-deliver/SKILL.md` and `process.md`, both prose. There is no test suite to run for this phase's own diff; the validation evidence is the grep output and diff review recorded in each sub-phase's handoff section, [phase-36-handoffs.md](phase-36-handoffs.md).

No HUMAN-CHECK items are carried forward from this phase.
