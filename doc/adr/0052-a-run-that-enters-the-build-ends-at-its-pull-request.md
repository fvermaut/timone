# ADR-0052: A run that enters the build ends at its pull request

- **Status:** accepted
- **Date:** 2026-09-05
- **Source:** requirements interview of 2026-09-05, driven by [timone#99](https://github.com/fvermaut/timone/issues/99); persisted as [PRD-03](../specs/prd/prd-03-a-run-ends-at-its-pull-request.md)

## Context

Ticket #99 — a one-file bug fix — stopped on fvermaut three times, and none of the stops bought judgement. The first asked "go ahead?" on a plan correction the stage had itself classified as not a decision. The second asked him to waive a check the container could not run. The third refused his written waiver and demanded a terminal command, because the asking stage had no authority to act on the answer — the exact behaviour [ADR-0033](0033-a-stage-that-cannot-act-on-an-answer-escalates.md) prescribed. Each stop also held the project, so nothing else ran while a question of no value waited.

His verdict: the interventions were pure unblocking, "without even really understanding what was going on", and the process between agreement and merge should be invisible to humans.

Alternatives considered and rejected:

- **An automated agent answering the machine's questions.** Rejected: it rubber-stamps the one gate that matters, and #99's own subject — a run stuck because the machinery could not release itself — shows what self-answering machinery does. Remove the stops instead of automating the yes.
- **Two endings: a pull request when the work stands, terminate-with-report when it does not.** Rejected by fvermaut: it leaves the machine judging what "stands", and the machine cannot be trusted to tell a real blocker from plan-compliance noise. One ending only.
- **Draft pull requests for red runs.** Rejected: adds a state to track and gives the reviewer nothing an ordinary flagged PR does not.

## Decision

**From its last human agreement — the approved list of pieces, or a chore's triage record — to its pull request, a run never stops.** No parking, no questions, no waiting states in the build, verification or delivery. When a step cannot do what was written, it records the departure, adapts — **including amending the plan and the requirements register on its own authority, dated, naming the run** — and carries on.

**The pull request is the single decision point, and it opens on what was bent.** Its body's first section lists every departure — plan and requirement amendments, checks not run, workarounds, a failing state if there is one — or says explicitly that nothing was bent. Even a run whose tests still fail opens its pull request, saying so first-thing. Merging ratifies everything listed; closing rejects the work whole, and the rejection re-enters as a new request (remediation). Nothing is patched on a closed pull request's branch.

**The screen viewing moves into the pull request.** A phase carrying a user-facing screen opens its PR without a prior viewing; the PR carries the preview address and the built-versus-reference comparison first-thing, and merging is the yes. This reverses the delivery half of [ADR-0039](0039-the-look-is-gated-twice.md) — the execution half, the fresh-context comparison of shell against reference, stands untouched.

**At the stops that remain, a stage may only ask a question the machinery can act on the answer to.** A typed reply always moves the work. This supersedes [ADR-0033](0033-a-stage-that-cannot-act-on-an-answer-escalates.md): where it parked the run on a person, the question itself is now the defect. The escalation machinery may remain as a last-resort guard, but a run entering it is a fault to file, never a wait to serve. [ADR-0031](0031-a-handoff-is-a-wait-not-a-failure.md) stands for the stages before the build; inside the build its class is empty by rule.

## Consequences

- A normal run touches the human exactly twice — agreeing to the work, merging its pull request — and both are real decisions. Everything between runs dark.
- The queue always moves: no run in the build holds its project waiting for a person. The hold until the PR's merge or close stays (one PR in flight per project, PRD-02.R10); the human's merge paces the pipeline, by design.
- Costs accepted with the decision in front of fvermaut: a red run costs a glance at a PR that names its own failure; a wrong screen costs a full remediation cycle instead of a cheap early no; a mid-run requirement amendment ships already built, with remediation as the recovery.
- The verify stage loses its stop: exhausted fix loops flag the PR instead of ending the run. The deliver stage loses both refusals: it opens on failed verification and on unviewed screens.
- `process.md`, the execute, verify and deliver skills, and the daemon's run states must change to match; PRD-03's register is what verifies they did.
