# Phase 20: every open ticket answers for itself

> **Status:** Complete — see [reports/phase-20-complete.md](reports/phase-20-complete.md).

> **Re-checked against `main` at approval, as this plan required of itself.** `main` was at `1ce0900`, clean. **Nothing under `src/` or `.claude/` has changed since the trace this plan rests on** — the only commits since `990f969` are this plan and the STATUS.md update. Every file-and-line citation below is therefore as traced on 2026-08-13. **Nothing in this plan changes as a result** — it is confirmed, not amended.

> **⛔ Blocked by [phase 19](phase-19.md), which is approved and unbuilt. Approval of this plan does not lift that.** A session opening this file to execute it must confirm phase 19 is built and gated **before writing a line of 20a**, and stop if it is not. This is a sequencing constraint recorded in [ADR-0024](../../adr/0024-every-open-ticket-answers-for-itself.md), not a preference. Slice 20c makes the daemon write on tickets every cycle, over the same resume-and-write path phase 19 exists to make safe. Built first, it multiplies the double-answer defect from one answered ticket to every open one, on a timer. **Do not start this phase until phase 19's gate has passed.**

> **Ninth phase of [PRD-02](../../specs/prd/prd-02-inversion-of-control.md).** Governing decision: **[ADR-0024](../../adr/0024-every-open-ticket-answers-for-itself.md)** (every open ticket answers for itself), made by fvermaut on 2026-08-13 from six questions put one at a time. Standing: [ADR-0007](../../adr/0007-sessions-at-timone-root.md), [ADR-0010](../../adr/0010-wayfinder-discovery-maps.md) (amended by 0024), [ADR-0012](../../adr/0012-conversation-channels.md), [ADR-0013](../../adr/0013-stateless-session-reentry.md), [ADR-0014](../../adr/0014-artifact-first-gates.md), [ADR-0019](../../adr/0019-timone-authored-commits-carry-a-provenance-trailer.md), [ADR-0022](../../adr/0022-a-conversation-ticket-can-be-answered-in-writing.md), [ADR-0023](../../adr/0023-one-answer-one-session.md).

## Why this phase exists, and why it is next

On 2026-08-13 the `ivtrends` wayfinder map closed its last question and fvermaut replied on it — *"ok go ahead and write the spec."* Nothing happened. The map is deliberately unmarked so `listMarkedTickets` (`src/adapters/github-tickets.ts:234`) never lists it, and `wayfinding` declares no `next` (`src/daemon/pipeline.ts:173`), so a marked map would still have had nowhere to go. **The stage-2 → stage-3 handover is the only handover in the loop with no ticket-borne entry point**, and it is the one where a whole discovery effort becomes the specification everything downstream is built and checked against.

**Probed the same day, all four open tickets across both managed projects fail the invariant**, each differently — `ivtrends` #1 (no CTA, invisible, takeover refuses), `scratch-app` #4 (honest CTA, nothing can move it), `scratch-app` #5 (unlabelled, silent since 2026-08-03), `scratch-app` #13 (`timone status` offers `timone retry`, the ticket does not). The evidence table is in [ADR-0024](../../adr/0024-every-open-ticket-answers-for-itself.md)'s Context and is **not to be re-gathered**; it is a listing anyone can reproduce in one command.

**The ADR gate fired and is discharged.** Six questions, each with its alternatives and their trade-offs, were put to fvermaut on 2026-08-13 and answered. **No slice below resolves an open decision.**

## Requirements

> **PRD:** [prd-02-inversion-of-control.md](../../specs/prd/prd-02-inversion-of-control.md) — criteria in [prd-02-inversion-of-control.criteria.md](../../specs/prd/prd-02-inversion-of-control.criteria.md)

| ID | Priority | Requirement (one line) | This phase |
| --- | --- | --- | --- |
| PRD-02.R21 | MUST | Every open ticket answers for itself | **closes**, all eight criteria, if 20h's human gate is obtained |
| PRD-02.R20 | MUST | Wayfinder decision tickets participate in the loop | **clause 2 closes** (20g); clause 1's `research` and `task` branches close free at 20f's fixture map — see below |
| PRD-02.R1 | MUST | Ticket pickup | **re-verified, not amended** (20d) — on the clause that still discriminates |

**R20's remainder, stated now so the completion report is not where it is discovered.** Clause 2 closes at 20g: tracker resolution is built, and [the 2026-08-13 marker](../../specs/prd/prd-02-inversion-of-control.criteria.md#r20--wayfinder-decision-tickets-participate-in-the-loop) settled it as owed. Clause 3 closes with phase 19, not here. **Clause 1's `prototype` branch stays unobserved** unless 20f's fixture map happens to chart one — it is not worth manufacturing, and the honest word is unobserved rather than passed.

**R1 is re-verified rather than amended, and the distinction is load-bearing.** Its criterion forbids a *run* on an unmarked issue and has never forbidden a comment. 20d must assert the run-clause as a regression test; what stops being reproducible is the *evidence* clause ("0 comments"), which is why the register carries a marker rather than an edit.

Deliberately **not** this phase: **the frozen output-token counter** (R17's remainder, unexplained since 14g); **`timone status` understanding "blocked by another question"** — 20a makes status and the ticket agree, which is a different fault from either of them knowing about blocking; **the real bot identity**; the Slack adapter; a `setup` skill.

## Goal Description

Every open ticket says what happens next, and every one that can be moved names the thing that moves it.

Today a ticket's CTA is written once by whichever session last touched it, and `timone status` composes its own line separately from `run.waitingOn` (`src/commands/status.ts:68,161`). Nothing keeps the two honest, which is why the register already records `timone status` asking for an answer on `ivtrends` #11 while #11's body says nothing is needed. Nothing refreshes a CTA whose blocker has closed. Unmarked tickets are silent forever. The map cannot be answered. `takeover` refuses anything with no ledger run (`src/commands/takeover.ts:90`).

After this phase: one function computes a ticket's CTA and **both** surfaces render from it; the daemon reconciles that CTA onto the ticket each cycle, editing rather than appending, and only when it differs; an unmarked ticket is introduced to exactly once; the map is a run-backed ticket whose CTA flips when its frontier empties; and `takeover` creates a run from the tracker rather than refusing.

**Load-bearing decisions, fixed here so slices don't re-litigate them** (all from [ADR-0024](../../adr/0024-every-open-ticket-answers-for-itself.md)):

- **One computation, two renderers.** The CTA is computed once from the ticket's state and rendered onto both the ticket and `timone status`. **A slice that adds a second place deciding what a ticket needs has left its scope** — that duplication is the #11 contradiction's cause, and removing it is what closes clause 8 by construction rather than by a check.
- **Edit, never append.** `upsertPullRequestComment`'s docblock (`src/adapters/ticketing.ts:251`) already argues this exactly: a standing fact whose truth changes, reconciled every cycle, appended, would be *"a client's PR filling with near-identical comments"*. A CTA is that same kind of fact. The reasoning transfers to tickets verbatim and is not to be re-argued.
- **The differs-from-last guard is the way this goes wrong.** A cycle that upserts unconditionally is a comment edit per ticket per minute. It is asserted before any happy-path test in 20c.
- **Exactly-once is recorded, not inferred.** The introduction follows `releasePreview`'s precedent (`src/daemon/poll.ts:~527`): a record in the store is what makes something happen once rather than every cycle for the life of the daemon.
- **An unmarked ticket gets a comment and never a run.** The mark label stops bounding what Timone *says* and still bounds what it *does*.
- **The map is a fifth wayfinder kind with a stage of its own.** `wayfinding`'s "nothing follows" (`src/daemon/pipeline.ts:173`) must stay true for decision tickets — a PRD written off one answer is the fault that clause prevents. **A slice that gives `wayfinding` a `next` has left its scope.**
- **Marking at creation is kept.** Tracker resolution is added beside it, not instead of it: daemon pickup is built on the label.
- **Nothing about the two answer paths changes.** No new way to answer, no change to gate parsing, no change to what a resolution looks like.

## Context & Prerequisites

- **Phase 19 built and gated.** See the banner. Re-confirm at start rather than assume.
- **`main` is the working branch**, as for phases 15–19.
- **The ticketing seam is widened twice, deliberately.** Its docblock (`src/adapters/ticketing.ts:~190`) says anything beyond its capabilities is *"a deliberate widening of the seam, not an incidental one"*. 20b adds the ticket-side upsert; 20d adds open-ticket listing beyond the marked set. Both carry their reasoning on the call, as phase 16's did.
- **`resolveTakeover` is currently synchronous** and takes `Pick<TakeoverDeps, "manifest" | "store">` (`src/commands/takeover.ts:69`). 20g makes it async and gives it the adapter — a signature change with test impact across `src/commands/takeover.test.ts`.
- **662+ tests are green at `main`**, with one unidentified intermittent failure seen once in eight runs at phase 18. It is not this phase's to chase, and it is named so a red run is not mistaken for one of ours.

## Sub-phases

### 20a — One computation, two renderers

The spine. A pure function from a ticket's state — its run (or absence), stage, status, labels, and what it waits on — to its CTA: the headline, the "what I need from you" line, and the exact command when one applies. No I/O. `timone status` is rewired to render from it instead of composing from `run.waitingOn` (`src/commands/status.ts:68,161`).

**Validation:** unit tests over every state in the stage graph including no-run, queued, failed, parked-at-an-unbuilt-stage, and blocked; a test asserting the status line and the ticket body for the same state are generated from one call; `timone status` output unchanged for the states it already handled correctly.

### 20b — The ticket-side upsert

`upsertComment(project, ticket, marker, body)` on the ticketing seam, the twin of `upsertPullRequestComment`, with the GitHub implementation matching on a marker in a comment it wrote itself and posting fresh when it finds none.

**Validation:** adapter unit tests for both branches (marker found → edit; absent → post); a test that a non-Timone comment carrying the marker text is **not** edited.

### 20c — The CTA is reconciled each cycle

The poll loop computes each open ticket's CTA via 20a and upserts it under a `CTA_MARKER` **only when it differs from the one last posted**.

**Validation:** **the differs-guard first** — a cycle over unchanged tickets performs zero writes, asserted before any happy path; then a state change producing exactly one edit; then a third cycle silent again. A test that a ticket whose blocker closed has its CTA refreshed with nothing run by hand.

### 20d — See the unmarked, and introduce yourself once

Open-ticket listing beyond the marked set; one introduction comment per unmarked ticket, recorded in the store per `releasePreview`'s precedent.

**Validation:** an unmarked ticket receives exactly one comment across three cycles and **no run is created** (R1's surviving clause, as a regression test); a marked ticket is unaffected; the introduction names the label.

### 20e — The backlog switch

`projectConfigSchema` (`src/manifest.ts:~23`, a `strictObject`) gains the per-project introduction switch, **defaulting off**. Onboarding sets it deliberately.

**Validation:** a project with no switch set receives no introductions; one with it enabled does; the strict schema rejects an unknown key beside it.

### 20f — The map becomes first-class

A fifth wayfinder kind with its own stage whose `next` is `requirements`; `timone-wayfind` marks the map at creation and its closing writes the frontier-empty CTA; a comment agreeing starts stage 3 on the map's own run.

**Validation:** a map with open questions has a "nothing needed" CTA and starts nothing; the same map with all questions closed flips its CTA and a written "go ahead" starts stage 3; **`wayfinding` still has no `next`**, asserted directly; the map's run holds its project against a second ticket.

### 20g — Takeover resolves from the tracker

`resolveTakeover` becomes async, gains the adapter, and creates the run on demand for an open ticket with none. The refusal survives only for a ticket that does not exist or is closed.

**Validation:** takeover against an open ticket with no ledger run opens the right session; against a closed or absent one, the refusal still fires with its own sentence; the existing `takeover.test.ts` suite passes against the new signature. Closes R20 clause 2.

### 20h — The live gate, on the fixture

A live pass on `scratch-app`, **never on `ivtrends`** — fvermaut's standing rule, and the same siting ADR-0023 adopted after rejecting "it is free over there". Chart a small throwaway map on the fixture, close its questions, and have fvermaut answer the frontier-empty CTA in his own words. File an unmarked issue and confirm one comment and no run. Confirm `timone status` and every open ticket agree.

**Validation:** fvermaut confirms the eight R21 criteria against what he sees, and confirms the daemon's write volume over a ten-minute idle run is **zero**.

## What this phase does not prove

- **`ivtrends` #1 is not the gate.** It benefits afterwards as ordinary use. If the fixture pass leaves any doubt, the doubt is recorded rather than resolved on a real product ticket.
- **Whether the introduction is welcome on a repository with other contributors** is unobservable on two solo repositories. The default-off switch is the whole of the restraint, and this phase does not test it against anyone else's tracker.
