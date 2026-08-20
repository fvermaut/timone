# ADR-0040: One step is one ticket, and doneness is a fact about a ticket rather than a count

- **Status:** accepted
- **Date:** 2026-08-20
- **Source:** fvermaut's ruling of 2026-08-20 — *"I also want to change the behaviour of the breakdown, and have 1 step = 1 ticket (otherwise the wayfinding ticket becomes unmanageable)"* — and the two decisions taken in the session that followed
- **Supersedes:** [ADR-0029](0029-a-chunk-advances-only-on-success.md) entirely — settledness, and the statuses that confer it, exist only to serve a count this decision removes
- **Amends:** [ADR-0028](0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md) D3 and D4; [ADR-0030](0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md) D4's derived-doneness half. **D1 and D2 of both stand untouched** — the breakdown is still a committed artifact and still the one thing the human approves
- **Closes:** [timone#41](https://github.com/fvermaut/timone/issues/41), by construction rather than by repair
- **Standing:** [ADR-0014](0014-artifact-first-gates.md), [ADR-0006](0006-specs-in-repo-single-source-of-truth.md), [ADR-0015](0015-branch-per-driving-unit.md)

## Context

**One ticket carried fourteen pieces, and it stopped being readable.** `ivtrends` [#1](https://github.com/fvermaut/ivtrends/issues/1) holds **73 comments**, 24 of them on a single day. Every plan, every progress note, every gate and every delivery for the whole of Milestone 1 landed in one thread. Finding what the machine currently wants means scrolling past a fortnight of finished business — and fvermaut judges a ticket by its newest message, so a thread that long is a thread whose instruction is lost.

**The shape that works was already in the process, on the other half of the lifecycle.** The same initiative's *discovery* ran as a wayfinder map: ticket #1 with one child per question, `#5` through `#16`, each carrying its own conversation and closing when its question was answered. Those tickets ran about three comments each and were easy to follow. Nothing was ever wrong with the model — it was simply never applied to the build.

**And the count model had a second, quieter cost.** Because all chunks hung off one ticket, "which piece is next" had to be *derived*, and it was derived by counting settled runs in the ledger. On `ivtrends` #1 that count says five pieces are settled; four have shipped. Run 2 was cancelled and its work restarted as run 3, `cancelled` settles a chunk (ADR-0029), and so one piece was counted twice. The pointer has been silently one ahead ever since, and would have skipped the board entirely. Nothing in `timone status` shows the pointer, so three pieces went by before anyone looked.

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

ADR-0029 exists to answer *"is this ticket finished with this chunk?"* so that a count could advance. There is no count, so there is no question. `SETTLED`, and the rule that `done` and `cancelled` confer it, go.

**`TERMINAL` stays and keeps its own job unchanged** — *"is this run's hold on the project over?"* — which was always the separate question ADR-0029 was careful to distinguish. A failed or cancelled run still frees its project.

**A cancelled step is one ticket that is still open.** It cannot be double-counted because there is nothing counting; it is simply the next eligible step again, which is what actually happened on `ivtrends` and what the ledger could not represent.

### D4 — A step ticket closes on its own merge; the initiative closes when its children do

ADR-0028 D3 said an initiative's ticket closes when its last chunk's pull request merges. Now: **a step ticket closes when its own pull request merges**, carrying that pull request as its closing link. **The initiative's ticket closes when every step ticket is closed**, with a closing comment linking them all.

A breakdown that gains a step after approval is still a re-proposal and still re-gates (ADR-0028 D3's surviving half); the newly approved list opens tickets for the steps that do not have one.

## Consequences

- **The tracker shows the whole road at once.** Fourteen tickets appear on approval. That is deliberate and it is the trade: clarity about what is coming, at the cost of a busier issue list. The initiative's map ticket is what makes it navigable.
- **`timone status` has to change**, and this is where the old model's real failure gets fixed. It must name the step ticket being worked and the ones remaining. #41's deepest finding was not the arithmetic but that **nothing ever displayed the pointer**, so a three-piece drift was invisible.
- **The daemon's `chunkProgress` and the settledness predicate come out.** `breakdown.ts` derives doneness by counting; that function's whole contract is replaced by a query over child tickets. This is a code change on Timone itself, not a documentation change, and it goes through Timone's own process as a phase rather than being edited in place.
- **Existing initiatives do not migrate themselves.** `ivtrends` #1 has 73 comments, a stale count and a parked run, and its build has been wound back to before the PRD. It gets re-cut under this decision from a clean start; there is no general migration path and none is owed, because it is the only initiative that ever ran the old model to depth.
- **A ticket per step costs API calls and noise on approval.** Fourteen creations in one gesture, and fourteen notifications. Accepted: it happens once per initiative, against a thread that was accumulating 24 comments a day.
- **Dependencies now have to be written down.** Under a strict count they were implicit in the order. A step ticket that should declare a dependency and does not will be picked up early, and the file's order is no longer a guarantee. This is the cost of D2's flexibility and the main thing to watch.
- **The wayfinder map and the build map become the same object**, differing only in what their children are — questions before, steps now. That is a simplification worth having, and it means the frontier rule has already been exercised across fifteen tickets before being trusted with a build.
