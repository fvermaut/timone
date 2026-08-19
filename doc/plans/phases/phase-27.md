# Phase 27: the five places the state machine did not close

> **Status:** **Complete 2026-08-19.** All six sub-phases built; 1134 tests pass, 13 of them new. Live-gated on `scratch-app` #4 — see [reports/phase-27-live-gate.md](reports/phase-27-live-gate.md). Every predicted step observed and none of the four falsifiers fired. **The second half found a real gap**: `feedback`'s `next` is `planning`, and an intent-layer diagnosis owes stage 3 first. The planning session escalated rather than planning against a criterion nobody had written, so nothing was built wrongly — but the routing is fvermaut's to settle. Written 2026-08-19 after [manual/how-the-daemon-works.md](../../../manual/how-the-daemon-works.md) drew the daemon's states in one place and five gaps became visible. Commissioned by fvermaut on 2026-08-19: *"don't file the bugs, fix them all"*.

> Standing decisions: [ADR-0010](../../adr/0010-wayfinder-discovery-maps.md), [ADR-0023](../../adr/0023-one-answer-one-session.md), [ADR-0026](../../adr/0026-a-ticket-is-a-conversation-a-run-is-a-chunk.md), [ADR-0028](../../adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md), [ADR-0030](../../adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md), [ADR-0035](../../adr/0035-a-resolved-escalation-hands-the-run-back.md).

## Why this phase exists

Nothing here was found by a failing test. All five came out of writing the state machine down: once the statuses, the stages and the waits are on one page, the places where the graph does not close are the ones you can see. Four are small. The first is not.

**A `bug` cannot be worked at all.** Stage 1 classifies four kinds of request. Three of them lead somewhere. The fourth — `bug` — routes to `feedback`, and `feedback` has never been built, so the run advances into it, parks on *"That's as far as I can take this one for now"*, and stays there for the life of the ledger. `scratch-app` [#4](https://github.com/fvermaut/scratch-app/issues/4) has been sitting in exactly that state, and `STATUS.md` lists it under *nothing you can do about it*. The same hole swallows a `wayfinder:research` ticket.

## Requirements

> **PRD:** [prd-02-inversion-of-control.md](../../specs/prd/prd-02-inversion-of-control.md) — criteria in [prd-02-inversion-of-control.criteria.md](../../specs/prd/prd-02-inversion-of-control.criteria.md)

| ID | Priority | Requirement (one line) | This phase |
| --- | --- | --- | --- |
| [PRD-02.R13](../../specs/prd/prd-02-inversion-of-control.criteria.md#r13--harness-owned-routing) | MUST | Harness-owned routing | **substance** — a classification that routes into a stage nothing can run is routing that does not route |
| [PRD-02.R21](../../specs/prd/prd-02-inversion-of-control.criteria.md#r21--every-open-ticket-answers-for-itself) | MUST | Every open ticket answers for itself | **substance** — 27e; a ticket that says the machine cannot read its own note when the note is perfectly readable answers for itself wrongly |
| [PRD-02.R22](../../specs/prd/prd-02-inversion-of-control.criteria.md#r22--a-ticket-hosts-a-sequence-of-chunks) | MUST | A ticket hosts a sequence of chunks | **substance** — 27c; which piece is next must not depend on what a session left checked out |

Deliberately **not** this phase:

- **Making stage 9's full diagnosis loop work end to end.** 27a builds the one road a `bug` needs: a diagnosis, committed, gated, dispatched to planning. The skill's wider intake — delivery reports, review threads, batch findings — is hand-run today and stays hand-run.
- **A live gate.** These are unit-level corrections to the graph. What earns a live gate is 27a, and it earns one on `scratch-app` [#4](https://github.com/fvermaut/scratch-app/issues/4) — which is the ticket that has been stuck, and is therefore the gate's own subject. That is a separate sitting.

## Goal Description

Every classification stage 1 can record leads to a stage that runs. Which piece is next is read from the branch the human approved, not from the working tree. A run that failed carries no wait it is not waiting on. And a ticket that could not use a handback note says which of the two things went wrong.

**Load-bearing:**

- **`feedback` writes a document and stops.** It diagnoses; it does not treat. The gate is what turns a diagnosis into work, exactly as the specification gate does.
- **`research` ends its own run.** Nothing follows it in the graph, on purpose — a research answer feeds a map, and advancing on one would write requirements off a single lookup.
- **The approved breakdown is the one on the default branch.** Before it merges there, a proposal exists and nothing may count pieces from it.

## Sub-phases

### 27a — `feedback` is built, so a bug goes somewhere

The stage gains a row that runs: `waits: gate`, `ownsBranch: true`, `next: planning`, Opus 5 at high effort. A prompt runs `timone-improve` against the ticket as its own feedback source, commits the record on the run's work branch, and pushes. The gate machinery then does what it already does for a specification.

**Validation:** a run classified `bug` reaches `feedback`, commits, and parks on a gate; approving it advances to `planning`; a change request re-enters `feedback` carrying the human's words; a stage that commits nothing fails rather than gating over an empty branch.

### 27b — `research` is built, and ends its own run

`waits: none`, `ownsBranch: false`, no `next`. `afterStage` gains a branch of its own: an outcome of *advanced* completes the run, a handoff parks it, no outcome fails it. Without that branch it falls through to triage's judgement and dies on *"triage recorded no classification"* — the fall-through the code already warns about.

**Validation:** a `wayfinder:research` ticket runs and its run reaches `done`; a session that records no outcome fails the run; the triage fall-through is not reached.

### 27c — the breakdown is read from the default branch

`readBreakdown` takes an explicit source. `fromWorkingTree` is what tests use. `fromDefaultBranch` — `git show <default>:<path>` — is what the poll loop and `timone status` use, so *which piece is next* no longer depends on which branch a session happened to leave checked out.

**Validation:** a breakdown on the default branch is read; the same file present only in the working tree is not; a directory that is not a git repository reads as *absent* rather than throwing on the poll loop.

### 27d — a failed run stops waiting

`fail()` clears the wait, as `cancel()` already does. Checked first: nothing reads a failed run's wait. `timone retry` rewinds from `consumedAnswerAt`, which `fail` does not touch and must not; the `waitCursor` fallback beside it is only ever reached on a **parked** run.

**Validation:** a failed run carries no `waitingKind` and no `waitCursor`; a failed run holding a consumed answer still rewinds to it on retry.

### 27e — a handback names a step that exists but cannot run

Two refusals were rendered as one. `misreadStep` becomes two answers: a name nobody defined, and a real step with no session behind it. The ticket says which — *"I don't know what that means"* for the first, and *"that's a real step, I just can't run it yet"* for the second.

**Validation:** a note naming nonsense reads as unknown; a note naming a real but unrunnable step reads as unbuilt; a note naming a runnable step still resumes the run.

### 27f — the glossary defines chunk zero

`CONTEXT.md` gains the term. Chunk zero is not a run: it is the specification-and-breakdown work carried by chunk 1 before that chunk builds its first piece. `seq` counts pieces, and chunk zero has no number.

**Validation:** the term is defined and matches the ledger.
