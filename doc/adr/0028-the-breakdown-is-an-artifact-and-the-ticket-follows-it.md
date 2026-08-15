# ADR-0028: The breakdown is an artifact, and the ticket's life follows it

- **Status:** accepted
- **Date:** 2026-08-14
- **Source:** fvermaut's approval of [phase 22](../plans/phases/phase-22.md) on 2026-08-14T21:58:15Z, which put the five questions below and settled them together
- **Extends:** [ADR-0026](0026-a-ticket-is-a-conversation-a-run-is-a-chunk.md), which split the ticket from the run and closed leaving these questions open "deliberately, and not to be inferred from this record"

## Context

[ADR-0026](0026-a-ticket-is-a-conversation-a-run-is-a-chunk.md) made a ticket a durable conversation and a run one chunk of work, and it named what it had *not* decided: when a ticket is allowed to close; what its thread says while a chunk is building and between chunks; whether a chunk's pull-request review lands on the ticket or stays on the pull request. It also created a new output for the planning stage — a breakdown of a specification into chunks, proposed for one approval — without saying **what a breakdown is**: a file, or a field in the ledger.

Those questions cannot be deferred past the first line of code, because they decide where the machine reads the answer to *"is there a next chunk?"* from. This record answers them. It does not re-argue [ADR-0026](0026-a-ticket-is-a-conversation-a-run-is-a-chunk.md); it takes the shape that decision fixed and finishes it.

## Decision

**D1 — The breakdown is a committed artifact, not a ledger record.** It is `doc/plans/breakdowns/ticket-NN.md` in the project repo, written by the planning stage, stamped `Awaiting approval` → `Approved`, with the readable list of chunks and the call to action posted as a ticket comment.

[ADR-0014](0014-artifact-first-gates.md) requires that the human approve the artifact rather than a paraphrase of it, and [ADR-0006](0006-specs-in-repo-single-source-of-truth.md) puts the truth in the repository. The ledger therefore stays runs-only: there is no second copy of the approved shape that can drift from the first.

**The cost, named:** answering *"is there a next chunk?"* means reading a file in a checkout rather than a field in `state.json`, so `timone status` and the poll loop both pay a read they do not pay today.

**D2 — The requirements stage and the breakdown share one branch — chunk zero — and approving the breakdown merges it.**

It lands the specification *and* the plan of work on the default branch before any code, so every subsequent chunk cuts from a current default branch — the rule [ADR-0015](0015-branch-per-driving-unit.md) already relies on — and between chunks the breakdown is readable from the default branch with no branch guessing. **Approving the breakdown is one gesture with two effects, and is not a third touch:** the rhythm [ADR-0026](0026-a-ticket-is-a-conversation-a-run-is-a-chunk.md) chose stays "the breakdown once, then each pull request".

**D3 — A ticket closes when its last chunk's pull request merges**, with a closing comment linking every pull request the initiative produced. A breakdown that gains a chunk mid-flight is a re-proposal and re-gates; the ticket does not close under it.

This makes a ticket's life derivable rather than declared, and it is the one moment at which the conversation is genuinely over.

**D4 — The thread says where the initiative stands, between chunks as well as during them.** R21's per-cycle reconciliation of the call to action reads the breakdown as well as the live run: *"building piece 2 of 4"* while one runs, *"piece 3 of 4 is next — nothing needed from you"* between them, and the review call to action while a pull request waits.

Without this, a ticket between chunks has no live run and R21's reconciliation would say *nothing is happening* — a stale line of exactly the class R21 exists to abolish.

**D5 — A chunk's review stays on its pull request; a one-line result lands on the ticket.** [ADR-0016](0016-review-remediation-rides-the-verify-fix-shape.md) is unchanged.

Review comments are about code and belong beside it. The ticket stays the initiative's single view without becoming its diff.

## Consequences

- **The planning stage gains a second artifact and a second gate shape.** A breakdown is not a phase file: it is the list of chunks an initiative will be built in, approved once, and each chunk then yields a phase file of its own with no gate of its own.
- **Two readers acquire a checkout dependency.** `timone status` and the poll loop must read `doc/plans/breakdowns/ticket-NN.md` to know whether an initiative has a next chunk. That is D1's named cost, paid deliberately for having one copy of the approved shape rather than two.
- **A ticket with no live run is no longer a ticket with nothing to say.** Between chunks is now a state the call to action must render, which is the first time the reconciler has had to speak about something other than a run.
- **The ledger cannot answer "is this initiative finished?" on its own**, and is not asked to. What it answers is "is a chunk live, and which one" — see `liveRunForTicket` and `runsForTicket` — and the breakdown answers the rest.
- **What does not change:** [ADR-0016](0016-review-remediation-rides-the-verify-fix-shape.md), the two answer paths, gate parsing, and the rule that the ticket is the sole write-path for gate decisions ([ADR-0012](0012-conversation-channels.md)).
