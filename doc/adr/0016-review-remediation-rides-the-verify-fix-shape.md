# ADR-0016: Review remediation rides the verify-fix shape

- **Status:** accepted
- **Date:** 2026-08-05
- **Source:** grill session of 2026-08-05, prompted by a contradiction the [phase 13](../plans/phases/phase-13.md) plan flagged before requesting approval

## Context

`process.md` stage 9 holds two protections around feedback: **the confirmation gate** (stage 9 proposes per item; the human confirms, declines or defers before anything moves) and **the no-code rule** (stage 9 never commits application code — every code remediation dispatches through a stage-5 vehicle, then stages 6 → 7 → 8; for a phase whose PR is open, that means a plan amendment whose scope-growing form voids the approval stamp and requires the human to re-approve).

[PRD-02](../specs/prd/prd-02-inversion-of-control.md) R11 then specifies the review loop: a human review comment requesting a change on an open Timone PR is picked up, and a feedback session *"applies the change on the PR branch or asks for clarification"* and replies in-thread. Taken with stage 9's letter, honoring one review comment would require: the machine proposing the change back to the human for confirmation, a plan amendment, and — since the amendment grows scope — the human re-approving a plan, all to authorize the change the human themselves just requested in writing. Both texts are approved artifacts; two sessions could obey either. This is the [ADR-0014](0014-artifact-first-gates.md) failure class again, caught at planning and grilled before phase 13's approval.

**The process already contains the precedent that resolves it.** Stage 7's verify-fix loop commits code on the branch with no plan vehicle and no re-approval: a defect brief → a fresh fix context → `fix: verify NN — <criterion> <slug>` → a full re-verify. Nobody considers those commits unauthorized, because the invariant the ceremony protects — *nothing lands unverified and unreviewed* — is carried by the re-verify and the re-delivery, not by the paperwork.

The alternatives considered:

- **Full stage-9 ceremony per review comment.** Every review round-trip becomes two or three; the human confirms their own requests and re-approves plans for changes they dictated. Trains rubber-stamping, which is how gates die.
- **The feedback session commits the fix itself.** Cheapest, but it puts unreviewed, unverified code on a PR and repeals the stage-9 rule outright.
- **The verify-fix shape, human-initiated** (chosen).

## Decision

**A concrete change-requesting review comment on an open Timone PR is confirmed intake, and its remediation rides the verify-fix shape.**

- **The comment is its own confirmation.** The confirmation gate exists to stop the machine acting on its own diagnosis; here diagnosis and remediation are both the human's words. A comment requiring *inference* — vague dissatisfaction, several possible readings, scope beyond the PR's claim — gets a clarifying or proposing reply in-thread and **no commit**: that is the propose-then-confirm gate re-emerging exactly where it protects something.
- **The comment is the defect brief.** A fresh fix context applies it and commits `fix: review — <slug>` on the PR branch; stage 7 re-verifies in full; stage 8 refreshes the same PR as an iteration; a threaded reply closes the loop. No plan amendment, no stamp re-approval, no feedback record — the commits, the verification and delivery reports' iteration sections, and the PR thread are the record, exactly as they are for a verify-fix.
- **The boundary is testable, not vibes:** a fix that can be made without touching the PRD pair or the criteria register is a remediation; one that would move a requirement is **intent**, and stage 9 proper takes it — proposal, confirmation gate, feedback record, PRD amendment, dispatched verification, all as written.
- **Cycles are unbounded** because each one is human-initiated: a bound exists to stop a machine looping, and here the human is the loop.

**Stage 9's rules stand unamended in substance:** stage 9 still never commits application code (the fix context commits, as stage 7's fix contexts always have), still never acts on its own diagnosis, and still owns everything that crosses the intent boundary.

## Consequences

- One review comment costs one round-trip: the human writes the change, the machine makes it, verifies it, refreshes the PR and replies. R11 stands as written.
- Nothing lands on the PR unverified — the invariant stage 9's ceremony protects survives, carried by the mandatory re-verify and re-delivery instead of by paperwork.
- **The boundary judgment is the residual risk:** a session misreading an intent-moving comment as a mere remediation lands a change no PRD amendment covers. The full re-verify is the backstop — a fix that breaks a criterion fails the pass — and phase 13's live proof tests both sides of the boundary deliberately. If misjudgments show up in practice, this ADR is what to revisit.
- `process.md` stage 9 gains the carve-out; `timone-improve` is amended so review-comment intakes route past it; the daemon's remediation prompt (phase 13) implements the brief → fix → re-verify → re-deliver cycle.
- The plan file no longer reflects post-review fixes, exactly as it never reflected verify-fixes. Accepted: the plan records what was planned; the reports record what happened.
