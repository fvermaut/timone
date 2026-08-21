# ADR-0040: One step is one ticket, and doneness is a fact about a ticket rather than a count

- **Status:** accepted
- **Date:** 2026-08-20
- **Source:** fvermaut's ruling of 2026-08-20 — *"I also want to change the behaviour of the breakdown, and have 1 step = 1 ticket (otherwise the wayfinding ticket becomes unmanageable)"* — and the two decisions taken in the session that followed
- **Supersedes:** [ADR-0029](0029-a-chunk-advances-only-on-success.md) entirely — settledness, and the statuses that confer it, exist only to serve a count this decision removes
- **Amends:** [ADR-0028](0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md) D3 and D4; [ADR-0030](0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md) D4's derived-doneness half. **D1 and D2 of both stand untouched** — the breakdown is still a committed artifact and still the one thing the human approves
- ~~**Closes:** [timone#41](https://github.com/fvermaut/timone/issues/41)~~ — **struck 2026-08-20: #41 was not a real defect.** See the correction below.
- **Standing:** [ADR-0014](0014-artifact-first-gates.md), [ADR-0006](0006-specs-in-repo-single-source-of-truth.md), [ADR-0015](0015-branch-per-driving-unit.md)

## ✏ Correction, 2026-08-20 — one of the two reasons given below was false

**The count model was not broken.** This ADR was written citing [timone#41](https://github.com/fvermaut/timone/issues/41), which reported that the daemon believed `ivtrends`' board was already built. It did not. That report simulated the pointer with `SETTLED` (`done` + `cancelled`); the function that actually computes it — `initiativeProgress` in `poll.ts`, *"the single function `timone status` and the ticket both resolve the progress value through"* — counts `done` alone, and carries a comment saying precisely why: *"a cancelled chunk delivered nothing, so the piece it was opened for is still the piece to come."* Measured against the real breakdown and the real ledger, it answered **piece 5 — The board**, which was correct. `SETTLED` serves `register`, which answers a different question: whether the ticket's current chunk is still open.

**What survives, and it is the reason this decision was taken:** the 73-comment thread. That is measured, it is what fvermaut asked to fix, and nothing about it depended on the count.

**What changes below:** the third paragraph of Context, and D3's claim to close #41 by construction. Deleting settledness is still right, on a narrower and honest ground — under one ticket per step there is no count for it to feed, so its only consumer goes away. It is not a repair of a bug, because there was no bug.

Nothing in D1, D2 or D4 depended on the false premise.

## Context

**One ticket carried fourteen pieces, and it stopped being readable.** `ivtrends` [#1](https://github.com/fvermaut/ivtrends/issues/1) holds **73 comments**, 24 of them on a single day. Every plan, every progress note, every gate and every delivery for the whole of Milestone 1 landed in one thread. Finding what the machine currently wants means scrolling past a fortnight of finished business — and fvermaut judges a ticket by its newest message, so a thread that long is a thread whose instruction is lost.

**The shape that works was already in the process, on the other half of the lifecycle.** The same initiative's *discovery* ran as a wayfinder map: ticket #1 with one child per question, `#5` through `#16`, each carrying its own conversation and closing when its question was answered. Those tickets ran about three comments each and were easy to follow. Nothing was ever wrong with the model — it was simply never applied to the build.

**And the count model looked as though it had a second, quieter cost — see the correction above; it did not.** Because all chunks hung off one ticket, "which piece is next" had to be *derived*, and it was derived by counting settled runs in the ledger. On `ivtrends` #1 that count says five pieces are settled; four have shipped. Run 2 was cancelled and its work restarted as run 3, `cancelled` settles a chunk (ADR-0029), and so one piece was counted twice. The pointer has been silently one ahead ever since, and would have skipped the board entirely. Nothing in `timone status` shows the pointer, so three pieces went by before anyone looked.

That is not a bug in the arithmetic. It is what deriving a fact about *work* from a count of *runs* buys you: runs and pieces are not the same thing, and every place they diverge — a cancellation, a restart, a hand-opened chunk — the count drifts and nothing notices.

Alternatives considered:

- **Keep one ticket, and prune the thread.** Rejected: hiding comments does not make one thread carry fourteen independent pieces of business, and the count problem is untouched.
- **Drop the committed breakdown and let the tickets be the plan.** Considered seriously and rejected — it breaks [ADR-0014](0014-artifact-first-gates.md). What the human approved would live on a platform, be editable afterwards, and leave no trace in the repository; the piece count in the stamp exists precisely to catch a list that changed after approval.
- **Open each step's ticket only when it starts.** Keeps the tracker clean, and rejected because it puts the road somewhere the human does not look — close to the problem being solved, relocated.
- **Strict sequence: step N+1 opens when step N merges.** A real contender, simpler, and it would also have closed #41. Not taken because it makes the file's order load-bearing in a way it is not today and forbids two genuinely independent steps from ever being available at once.

## Decision

### D1 — Approving the breakdown opens one ticket per step

The breakdown stays exactly what ADR-0028 D1 and ADR-0030 D1 made it: a committed file, written once, stamped `Awaiting approval` → `Approved by <who> <date> — N pieces`, and **the one thing the human approves**. That gate does not move and its artifact does not change.

**On approval, the machine opens one ticket per step**, each a child of the initiative's ticket, each carrying that step's one-line description and a link to the breakdown. The file remains the plan and the source of truth for what the steps are and what order they sit in; the tickets are where the work, the conversation and the status live.

**The initiative's ticket becomes a map** — a list of links to its step tickets and nothing else, exactly as a wayfinder map is for its decision tickets. Progress is read by looking at which children are closed.

### D2 — The next step is the first open, unblocked, unassigned step ticket

This is wayfinding's frontier rule, applied to the build. **Doneness is a fact about a ticket**: closed is done, open is not. Nothing is counted, and there is no pointer to drift.

A step whose ticket declares a dependency on another open step is not eligible. Where two steps are independent, both are eligible, and the one-run-per-project rule decides which is actually taken — this decision creates no parallelism it does not already permit.

### D3 — Settledness is deleted, not reworked

> **✏ Corrected 2026-08-21 — this decision is wrong as written, and is superseded by [ADR-0044](0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) D-note. `SETTLED` and `isSettled` stay; only the *count* goes.**
>
> The paragraph below argues that settledness exists solely to advance a count, so removing the count removes the question. **That premise is false**, and this ADR's own correction section above says so in passing without noticing the contradiction: *"`SETTLED` serves `register`, which answers a different question."*
>
> The predicate has one real consumer and it is not a count. `isSettled` (`src/daemon/runs.ts:76`) is called by `loadedLiveRunForTicket` (`runs.ts:585-596`), which `register` (`runs.ts:639`) uses at `runs.ts:641` to refuse opening a second run while one is still live. `register`'s own docblock states the behaviour it buys: *"A failed chunk is unsettled, so it is handed back rather than succeeded — a chunk advances only on success, and `timone retry` is how a broken one recovers."* That is [PRD-02.R22](../specs/prd/prd-02-inversion-of-control.criteria.md#r22--a-ticket-hosts-a-sequence-of-chunks) clause 2, which [phase 29](../plans/phases/phase-29.md) is required not to regress.
>
> Deleting the predicate as written gives one of two outcomes, both defects: failed work stops being retryable in place, or a second run opens beside the failure and the one-session guard then refuses the retry — the exact fault [ADR-0029](0029-a-chunk-advances-only-on-success.md) was written to prevent. Either way `timone retry` stops working, and `timone retry` is a command the human is told to type today.
>
> **This is the same mistake as the #41 citation corrected above**: a claim about what the code does, made without reading it, load-bearing for a deletion. It was caught by a pre-flight read on 2026-08-20 before any of phase 29 was built, filed as [timone#51](https://github.com/fvermaut/timone/issues/51), and ruled on by fvermaut on 2026-08-21 — **keep the predicate, delete only the counting.**
>
> What that leaves of this decision is intact and still right: `chunkProgress` and `ChunkProgress` go, because deriving *which piece is next* from an arithmetic over runs is what one-step-one-ticket replaces. The paragraph below stands as the record of the reasoning that was wrong.

ADR-0029 exists to answer *"is this ticket finished with this chunk?"* so that a count could advance. Under one ticket per step there is no count, so there is no question. **This is a removal of something made unnecessary, not the repair of a defect** — the count was working correctly (see the correction above). `SETTLED`, and the rule that `done` and `cancelled` confer it, go.

**`TERMINAL` stays and keeps its own job unchanged** — *"is this run's hold on the project over?"* — which was always the separate question ADR-0029 was careful to distinguish. A failed or cancelled run still frees its project.

**A cancelled step is one ticket that is still open.** It cannot be double-counted because there is nothing counting; it is simply the next eligible step again, which is what actually happened on `ivtrends` and what the ledger could not represent.

> **✏ Reversed 2026-08-21 by [ADR-0044](0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) D2.** *"Simply the next eligible step again"* means a cancel is undone on the next poll cycle — the human types `timone cancel`, and sixty seconds later the same step starts building again. `timone cancel` has meant *throw this work away* since it was built, and it is what the human is told to type to discard a job. The word keeps that meaning: a cancelled step's ticket stays open and is **not** taken up again, held by the assignee, with a call to action offering retry or close.

### D4 — A step ticket closes on its own merge; the initiative closes when its children do

ADR-0028 D3 said an initiative's ticket closes when its last chunk's pull request merges. Now: **a step ticket closes when its own pull request merges**, carrying that pull request as its closing link. **The initiative's ticket closes when every step ticket is closed**, with a closing comment linking them all.

A breakdown that gains a step after approval is still a re-proposal and still re-gates (ADR-0028 D3's surviving half); the newly approved list opens tickets for the steps that do not have one.

> **✏ Extended 2026-08-21 by [ADR-0044](0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) D4.** This clause says closed means done and stops there, so a step the human closed because they no longer wanted it would count as delivered and the initiative would close claiming every piece was built. It now closes saying what was actually delivered, and built-versus-dropped is **inferred** — closed with a merged pull request is built, closed without one is dropped — rather than asked for, since a plain Close is recorded by GitHub as *completed*. The asymmetry this exposes is recorded there and left open: a list that **grows** after approval re-gates, and a list that **shrinks** passes silently.

## Consequences

- **The tracker shows the whole road at once.** Fourteen tickets appear on approval. That is deliberate and it is the trade: clarity about what is coming, at the cost of a busier issue list. The initiative's map ticket is what makes it navigable.
- **`timone status` has to change**, and this is where the old model's real failure gets fixed. It must name the step ticket being worked and the ones remaining. #41's deepest finding was not the arithmetic but that **nothing ever displayed the pointer**, so a three-piece drift was invisible.
- **The daemon's `chunkProgress` and the settledness predicate come out.** `breakdown.ts` derives doneness by counting; that function's whole contract is replaced by a query over child tickets. This is a code change on Timone itself, not a documentation change, and it goes through Timone's own process as a phase rather than being edited in place.
- **Existing initiatives do not migrate themselves.** `ivtrends` #1 has 73 comments, a stale count and a parked run, and its build has been wound back to before the PRD. It gets re-cut under this decision from a clean start; there is no general migration path and none is owed, because it is the only initiative that ever ran the old model to depth.
- **A ticket per step costs API calls and noise on approval.** Fourteen creations in one gesture, and fourteen notifications. Accepted: it happens once per initiative, against a thread that was accumulating 24 comments a day.
- **Dependencies now have to be written down.** Under a strict count they were implicit in the order. A step ticket that should declare a dependency and does not will be picked up early, and the file's order is no longer a guarantee. This is the cost of D2's flexibility and the main thing to watch.
- **The wayfinder map and the build map become the same object**, differing only in what their children are — questions before, steps now. That is a simplification worth having, and it means the frontier rule has already been exercised across fifteen tickets before being trusted with a build.
