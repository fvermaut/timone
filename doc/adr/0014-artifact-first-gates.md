# ADR-0014: Gated stages write their artifact first, then gate on it

- **Status:** accepted
- **Date:** 2026-08-05
- **Source:** grill session of 2026-08-05, prompted by a false gate found during [phase 12](../plans/phases/phase-12.md)'s 12g live proof

## Context

Stages 3 (Requirements) and 5 (Planning) each end in a human approval. Until now the process put the approval **before** the artifact existed: `process.md` stage 3's gate reads *"Human approves the requirement list **before** files are written"*, and both `timone-prd` and `timone-plan` implement that literally — presenting the list or the breakdown in conversation, and writing files only once the human says yes.

[PRD-02](../specs/prd/prd-02-inversion-of-control.md) then specified the opposite for the daemon-driven loop. R4: *"the PRD pair is committed on a branch, a summary comment linking to it is posted on the issue, and the pipeline waits for approval"*. R5 says the phase file is gated *"exactly like R4"*. Both were approved without anyone noticing they contradicted the stage gates they implement.

**The contradiction was not theoretical, and it failed in the worst available way.** In phase 12's live proof on `scratch-app` #6, two consecutive daemon sessions resolved it differently: the requirements session followed the phase's prompt and committed the PRD pair; the planning session followed its skill, wrote nothing, and reported success. The daemon — which checked only the session's exit code — then posted an approval request for a plan that did not exist, linking a directory containing no plan. A reply of `approve` would have advanced the pipeline past a step nobody had done.

Two things were wrong, and only one of them is this ADR's subject. That the daemon could open a gate over nothing was a straightforward defect, fixed by checking that the work branch actually moved. That two sessions could reasonably reach opposite conclusions is a process defect, and it is the one that needed deciding.

**What the rule was protecting turned out to be nothing anyone had chosen.** The obvious candidate risk is anchoring: a finished-looking document is harder to argue with than a list of proposals, so writing first might bias the human toward accepting. The rule was not written for that reason — it was written for hand-run sessions where the human was in the room, and the asynchronous case simply never arose. The single piece of live evidence points the other way: on the same ticket, the human read a committed PRD and rejected a substantial part of it in one line, and the stage redid it.

The alternatives considered:

- **Present, then write on approval** (today's spec). No unapproved artifact ever exists. Costs two human waits per stage instead of one, and what the human approves is prose rather than the register — so the approved thing and the written thing are different objects, which sits badly with [ADR-0006](0006-specs-in-repo-single-source-of-truth.md).
- **Split by path** — interactive presents first, the daemon writes first. Fits each context, but leaves every gated skill with two modes to keep in step. The accidental version of exactly that split is what produced the false gate.
- **Write on a branch, then gate** (chosen).

A note on how uneven the existing wording was: stage 3's *gate* states the ordering outright, but stage 5's gate says only *"Human approves the breakdown"*, and the spec's own Status lifecycle explicitly admits `Awaiting approval` for "a plan file that exists without approval". `timone-plan`'s "never `Awaiting approval` — approval precedes the write" was therefore already **stricter than the spec it implements**.

## Decision

**Every gated stage writes its artifact on a work branch first, stamped as unapproved, and gates on the artifact itself.** One rule, both stages, both paths — the daemon's and a human-invoked session's.

- The PRD pair is written with the narrative's status `Draft`; the phase file is written stamped `Awaiting approval`.
- The approval is then requested against the committed artifact — a ticket reply for daemon-driven work ([ADR-0012](0012-conversation-channels.md)), the conversation itself for a hand-run session.
- On approval the artifact records it: the PRD becomes `Active`, the phase file becomes `Approved for execution by <who> <date>`. That write is the gate's trace, and it happens in the repository, not only in a thread.
- A change request re-enters the same stage, which rewrites the artifact in place.

**Requirement IDs become permanent at approval, not at first write.** Before the gate closes, a rejected draft is renumbered freely on rewrite; from the moment it is approved, `process.md`'s "stable forever, never renumbered, never reused" applies unchanged. Nothing was ratified before the gate, so there is nothing for stability to protect.

**Unchanged:** the entry gates that make a stage refuse outright — stage 5's anchoring and ADR gates — still produce **no artifact at all**. "Write first" governs a stage that is doing its work, not one that has correctly declined to.

## Consequences

- The human reviews the real criteria register or the real phase file, not a summary of it. For a register whose entire value is precision, this is the substantive gain.
- One human wait per gated stage instead of two, and the asynchronous loop needs no special case.
- Both skills have one behaviour rather than two, so there is no interactive/daemon split to drift.
- **A branch can now carry an artifact nobody approved.** Acceptable because such a branch is never merged and never the base of work: stage 5 already refuses to plan against a `Draft` PRD, and stage 6 already refuses a phase file not stamped `Approved for execution`. The existing entry gates carry this weight without modification.
- **Diffs between two pre-approval drafts are harder to read**, since `R5` may mean different things across them. Accepted: the alternative is a register that accumulates tombstones for requirements that never existed.
- **Anchoring bias is accepted as a residual risk**, on one data point. If the human starts finding they correct wording where they would once have questioned substance, this ADR is what to revisit.
- `process.md` stage 3's gate, stage 5's Status lifecycle note, the "Stable requirement IDs" section, and both skills are amended to match. PRD-02.R4 and R5 stand as written.
- The PRD written on `scratch-app` #6 before this decision carries `R5`–`R9` as deprecated blocks for requirements that were never ratified. It is left alone: it has since been approved, and from approval its IDs are stable — tombstones included. It is the last register that will look like that.
