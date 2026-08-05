# ADR-0015: The work branch belongs to the driving unit of work

- **Status:** accepted
- **Date:** 2026-08-05
- **Source:** grill session of 2026-08-05, prompted by a contradiction the [phase 13](../plans/phases/phase-13.md) plan flagged before requesting approval

## Context

`process.md` stage 6 says a work branch is **one per phase**, named `phase-NN-<slug>`, cut from the project's default branch (or stacked on the previous phase's unmerged branch). The rule dates from the hand-run era: a human invoked execution against a phase file, and the phase was the only unit of work in sight.

Phase 12 then gave the daemon path a different shape, as [PRD-02](../specs/prd/prd-02-inversion-of-control.md) R4 requires: a run claims `timone/<n>-<slug>` at the requirements stage and commits the PRD pair and the phase file there. R7 completes the arc — *"a pull request exists from the work branch referencing the ticket"*. So on the ticket path the branch pre-exists execution, named for a ticket, carrying the approved artifacts; on the hand-run path the branch is cut *by* execution, named for a phase. Both rules live in approved artifacts, and nothing said which one a daemon-spawned execution session should obey.

This is the failure class [ADR-0014](0014-artifact-first-gates.md) closed for gate ordering: two instructions that disagree don't fail loudly — they make consecutive sessions unpredictable, each obeying whichever text it read. This time the contradiction was caught at planning rather than by a live failure, and grilled before phase 13 was approved.

The alternatives considered:

- **Ticket branches everywhere.** One rule, but Timone-self phases and ticketless chores have no ticket to name a branch after, so the rule would need an artificial anchor invented per case.
- **Execution cuts `phase-NN-<slug>` off the ticket branch.** Preserves stage 6's letter, but divorces the code from the requirements and plan commits it implements, makes the PR head a second branch, and creates a merge-order question nobody needs.
- **The driving unit owns the branch** (chosen).

## Decision

**A work branch belongs to the unit of work that drives it, and execution never cuts a new branch when an approved plan already lives on one.**

- **Ticket-driven work** owns its `timone/<n>-<slug>` branch from the moment the requirements stage claims it until the pull request merges or closes. Requirements, plan, code, reports and the PR head are all that one branch. The requirements and plan commits execution finds there are what it *expects* — never "divergent commits" to refuse over.
- **Hand-run work with no driving ticket** — Timone-self phases, pre-daemon managed-project phases — keeps one branch per phase, named `phase-NN-<slug>`, cut from the default branch.
- **The stacking rule survives only on the hand-run path.** On the ticket path it is structurally unreachable: a run holds its project until its PR reaches a terminal state, so the next ticket's branch always cuts from a default branch that already contains (or has declined) the previous work.
- Stage 6's refusal rule is restated as intent rather than mechanism: execution refuses a dirty tree, and refuses a branch carrying commits that are neither the driving unit's own artifacts nor its resume trace.

**Deliberately deferred:** a ticket that grows into multiple phases. Today one ticket yields one phase file; when that stops being true, this ADR is where the serial-phases-on-one-branch question gets taken up.

## Consequences

- The pull request's head is the branch carrying the requirements it implements — the reviewer sees intent, plan and code as one history, which is what R7 was written to produce.
- `process.md` stage 6 and `timone-execute` are amended to carry the two-path rule; PRD-02.R7 stands as written.
- The daemon's execution prompt names the run's branch explicitly, and the skill's rule now agrees with it — instruction and skill can no longer be read opposite ways.
- Branch names surface in PRs, reports and `timone status`, so reversing this later means a superseding ADR, not an edit.
- Two naming schemes continue to exist, one per path. Accepted: the schemes anchor to genuinely different things, and inventing a fake ticket or a fake phase number to unify them would trade a visible seam for a lie.
