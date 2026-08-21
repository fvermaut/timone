# ADR-0044: A run belongs to a step ticket, and the assignee is what holds it

- **Status:** accepted
- **Date:** 2026-08-21
- **Source:** fvermaut's rulings in a grilling session of 2026-08-21, taken against the four blockers pre-flight raised on phase 29
- **Amends:** [ADR-0040](0040-one-step-is-one-ticket-and-doneness-is-a-fact-about-a-ticket.md) D2 (what makes a step eligible), D3 (see the separate correction being made to that ADR — settledness survives) and D4 (a dropped step). **ADR-0040 D1 stands untouched** — the breakdown is still the committed artifact and the one thing the human approves
- **Standing:** [ADR-0024](0024-every-open-ticket-answers-for-itself.md), [ADR-0026](0026-a-ticket-is-a-conversation-a-run-is-a-chunk.md), [ADR-0015](0015-branch-per-driving-unit.md), [ADR-0014](0014-artifact-first-gates.md)

## Context

[ADR-0040](0040-one-step-is-one-ticket-and-doneness-is-a-fact-about-a-ticket.md) decided that one step is one ticket, and that what happens next is read off the tickets rather than counted from runs. It did not say **what a run belongs to** once the steps are separate tickets, and four things that follow from that were left undefined. A pre-flight read of the code against phase 29's plan, on 2026-08-20 and before any slice started, found all four and refused to start the phase rather than guess. The record is in [`doc/plans/phases/phase-29.md`](../plans/phases/phase-29.md), under *Refined 2026-08-20 — blockers found at pre-flight*. This ADR answers them.

The four gaps, plainly:

- **Run identity.** A run is `{project, ticket, seq}` and its id is `project#ticket/seq`. Under one step per ticket, is `ticket` the step or the initiative? Four slices inherit the answer, and so does the command the human types.
- **What a cancel now means.** ADR-0040 D3 says a cancelled step "is simply the next eligible step again". If that is true, a cancel stops the work for one poll interval and then the machine starts it over.
- **What `timone status` reads.** Naming the live step from tickets makes the whole render path async and puts a forge call on a command whose value is that it answers instantly.
- **What a declared dependency is.** ADR-0040 says only that dependencies "have to be written down". The native GitHub relation and a `Blocked by: #N` body line are both in play, and nothing in `src/` parses the line.

Alternatives considered:

- **A run keeps belonging to the initiative.** Rejected: nothing then records which step a merged pull request finished, so the machine cannot close the right child, and `timone cancel` and `timone retry` cannot address a step at all.
- **A label carries the "cancelled and waiting for you" state.** Rejected in favour of the assignee — see D3. It is honestly the safer option if the machine account is delayed, because the assignee's meaning depends on that account existing and a label's does not.
- **The ledger decides eligibility.** Rejected: that is exactly what ADR-0040 was written to end. What is eligible must be readable off the tickets, or the drift comes back under a new name.
- **Refuse to close an initiative that dropped a step.** Rejected: it buys a second human decision at the end of every job in exchange for something a sentence in the closing comment says just as well.

## Decision

### D1 — A run belongs to a step ticket

`run.ticket` is the **step's** number, not the initiative's. `seq` collapses towards 1 for a step that is built once, and the map ticket is never itself a run's ticket. `timone retry <project>#<step>` and `timone cancel <project>#<step>` therefore address a step.

This is what makes the rest work: a merged pull request now records which step it finished, so the machine closes the right child, and a cancel or a retry has something smaller than the whole initiative to name.

The cost, stated honestly: **the human types a number they did not file and have not necessarily read.** The step tickets are opened by the machine on approval; the number fvermaut knows is the initiative's. That is a real regression in what a command asks of him, and D5 exists to fix it — status must name the step's number so it can be copied rather than looked up.

### D2 — `timone cancel` drops the work, and the step stops

A cancelled step's ticket **stays open** and is **not taken up again**. The machine writes a call to action on that ticket giving exactly two ways on: retry it, or close it and move on.

This **reverses** ADR-0040 D3's statement that a cancelled step "is simply the next eligible step again". Under that wording a cancel bought sixty seconds: the ticket is open, unblocked and unassigned, so the next cycle picks it up and starts the work over. That is not what the command has ever meant. `timone cancel` has printed *"I won't pick this chunk up again"* since it was built (`src/commands/cancel.ts:142-143`), and its own header calls a cancelled chunk finished business. **The word keeps the meaning it already had**; ADR-0040 changed it by accident, in a sentence about counting.

### D3 — The assignee is what holds a step ineligible

The frontier is the first child that is **open, unblocked and unassigned** — wayfinding's rule, unchanged (`.claude/skills/timone-wayfind/SKILL.md:143`, where the assignee already *is* the claim). The machine **assigns itself when it claims a step**, and **stays assigned after a cancel**. The assignment is what stops the step being retaken while it waits for the human; retrying it, or closing it, is what clears the wait.

The cost is not small and is not deferrable. This needs Timone to have its own forge account ([ADR-0042](0042-timone-acts-under-its-own-identity.md)). On a borrowed account there is one name on the tracker, and *the machine is building this*, *the machine stopped and is waiting for you* and *the human is looking at this* all render identically — so the field this decision loads cannot carry the load.

**fvermaut ruled on 2026-08-21 that the account is therefore made before phase 29 is built**, reordering the work he had set on 2026-08-20. Phase 30 already recorded the account as its own first blocker; this decision makes phase 29 wait on it too.

### D4 — A dropped step does not stop the initiative closing

When every child is closed, the initiative closes. Its closing comment says **what was actually delivered** — *"thirteen of fourteen; step 7 was dropped"* — rather than listing fourteen links and implying fourteen were built.

**Whether a step was built or dropped is inferred, never asked.** A step closed with a merged pull request was built; a step closed without one was dropped. Both facts are already the machine's — it opened the pull request and it read the merge — so this needs nothing from the human, and it cannot be misled by a plain Close, which GitHub records as *completed* by default and would otherwise be read as delivery.

What this leaves open, recorded rather than resolved: the approved list said fourteen and thirteen were built. **A list that shrinks after approval passes no gate**, where a list that grows is a re-proposal and re-gates ([ADR-0028](0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md) D3). That asymmetry is deliberate for now — the closing comment makes the shrinkage visible after the fact, which is weaker than a gate and is judged enough while no client project is running an initiative to depth.

### D5 — `timone status` reads a remembered picture, not a live one

Because D1 puts the step's number in the ledger, status names the live step **with no forge call at all**. The context around it — which initiative the step belongs to, how many steps remain — is written **to the ledger by the daemon on each cycle**, as a side effect of the query it already makes to decide eligibility. Status reads that.

So the render path stays synchronous, no ticketing adapter reaches `status.ts`, and the command keeps the property that is its whole value: it answers instantly.

The cost, stated: **the picture can be up to one poll interval old.** A child the human closes by hand still shows in the remaining count until the next cycle rewrites it — about a minute. Status is a report of what the daemon last saw, not a query of the tracker, and its wording should not pretend otherwise.

### D6 — A declared dependency is GitHub's native relation, and a written one is refused rather than ignored

`blockedBy` is the **single source of truth**. It was verified working on `fvermaut/scratch-app` on 2026-08-20, and `gh` both reads and writes it.

A `Blocked by: #N` line in a ticket body is **read, not acted on, and answered**: the machine says on the ticket that it saw the line, and that the native field is what it respects. Silently ignoring it is precisely the failure ADR-0040's consequences name as the one to watch — a step that should have been held back and was not — and a dependency that is written down, believed, and quietly discarded is worse than one never written.

`.claude/skills/timone-wayfind/SKILL.md:143` currently instructs agents to fall back to that body line where the tracker has no native relation. **The fallback stays correct for such a tracker, and its wording now needs revising for GitHub-hosted projects**, where there is no "unavailable" case to fall back from.

## Consequences

- **The machine account moves to the front of the queue.** [ADR-0042](0042-timone-acts-under-its-own-identity.md)'s account was already blocker (a) on phase 30 — it blocks 30a and, through it, 30b, 30c and 30d, plus the live checks in 30k and 30l. D3 adds phase 29 to that list. It is an hour of fvermaut's time and it now gates both phases; nothing in code substitutes for it.
- **[`CONTEXT.md`](../../CONTEXT.md) owes two terms and one correction.** There is no glossary entry for a **step ticket** or a **map ticket**, and both are now load-bearing vocabulary. Worse, the existing **Breakdown** entry is false where it says which piece is next is *"derived every time it is asked, from the approved list and the count of chunks that finished"* — ADR-0040 removed that derivation and this ADR builds on its removal.
- **The tracker gains assignments the human did not make.** Every claimed step carries the machine's name, and a cancelled one keeps it until the human acts. The mirror of that is deliberate: **a human who assigns themselves to a step takes it off the machine's list.** It is the same claim rule wayfinding has used across fifteen tickets, now applied to the build.
- **`timone status` gains a cached field, and therefore a staleness window.** The ledger starts holding a picture of the tracker rather than only a record of runs. That is a new class of thing to keep correct, and a new way to be wrong — a cycle that fails to write the field leaves status confidently reporting yesterday.
- **The shrinking-list asymmetry is unresolved.** D4 records it rather than fixing it. A breakdown that grows re-gates; one that shrinks does not. Whoever revisits this is answering an open question, not correcting an oversight.
- **Phase 29's plan must be amended before it executes.** Its four blockers are answered here, but the slices they hold up — 29a, 29b, 29c, 29d, 29e and 29f — still carry the wording written before the answers existed, and 29f's validation block is explicitly marked provisional pending D5. The plan is corrected first; the phase runs second.
- **`timone retry` and `timone cancel` change what they take, and `STATUS.md` currently tells fvermaut otherwise.** The commands he has been given name the initiative. Every place that prints one has to print a step number instead, and the first of those places is status itself.
