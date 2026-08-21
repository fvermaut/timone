# ADR-0044: A run belongs to a step ticket, and the assignee is what holds it

> **✏ 2026-08-21 — the second half of this title is wrong, and is kept.** A **label** holds a step, not the assignee: a GitHub App's bot cannot be assigned to an issue, tested every way once the App existed (see **D3**). The filename and title are left alone because they are linked from ADR-0040, ADR-0042, phase 29 and phase 30, and a link that rots is a worse defect than a title that needs one line of correction. **Read D3 before acting on anything here.**

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

> # ✏ SUPERSEDED 2026-08-21 — the mechanism does not exist. A **label** holds the step.
>
> **A GitHub App's bot cannot be assigned to an issue.** Not through the new path, not through the old one, not by anybody's token. Tested end to end against `fvermaut/scratch-app` once the App existed ([scratch-app#41](https://github.com/fvermaut/scratch-app/issues/41), which carries the transcript):
>
> | Attempt | Result |
> | --- | --- |
> | `replaceActorsForAssignable`, installation token | *"Assigning agents is not supported with GitHub App installation tokens. Use a user token instead."* |
> | `replaceActorsForAssignable`, fvermaut's user token | *"Bot does not have access to the repository."* |
> | REST `POST /issues/41/assignees` with `timone-agent[bot]` | **403 Forbidden** |
> | `suggestedActors(capabilities: [CAN_BE_ASSIGNED])` | `fvermaut` alone, from either token |
>
> `assignedActors`, `replaceActorsForAssignable` and `Bot` in the `Assignee` union all exist — which is why the schema read that preceded this looked encouraging — but that path is **reserved for GitHub's own registered coding agents**. It is not open to an ordinary App. The schema being satisfiable is not the same as the operation being permitted, and this is the case that taught it.
>
> **So the fallback wins: a label holds a stopped step**, exactly the alternative this ADR's own Context recorded and fvermaut passed over on 2026-08-21. He chose the assignee over it knowing the trade, and the trade turned out not to be available; no fresh ruling was sought because there is only one option left standing.
>
> **What the label changes, and what it does not.** The frontier becomes *open, unblocked, not held* — where **held** means carrying the hold label. Everything else in this ADR stands: D1, D2, D4, D5 and D6 never depended on the mechanism, only on there being one.
>
> **One property is kept deliberately, and it is worth the extra clause.** The assignee's nicest side-effect was that a human assigning themselves took a step off the machine's list. A label does not do that on its own — so the rule reads the **assignees as well**: a step assigned to a person is claimed by that person and the machine leaves it alone. Humans can be assignees; only bots cannot. So the machine holds by label, a person holds by assignment, and both are visible on the ticket.
>
> **D7 gets easier, not harder.** Releasing a claim was a `replaceActorsForAssignable` with an empty list, and the open question was whether the GitHub interface would even offer a human that control for a bot. It does not arise: removing a label is an ordinary thing a person can do in two clicks, on every GitHub view, and there is nothing to verify.
>
> **And fvermaut's reordering of 2026-08-21 loses its stated reason.** He moved the account ahead of phase 29 *because* the assignee needed a distinct identity to be legible. A label needs no identity at all, so phase 29 no longer depends on the App. The reordering is moot rather than wrong — the App was created the same day, in about twenty minutes — and what phase 29 waits on is now nothing.
>
> The paragraphs below stand as the record of the decision that was taken and the reasoning behind it.

The frontier is the first child that is **open, unblocked and unassigned** — wayfinding's rule, unchanged (`.claude/skills/timone-wayfind/SKILL.md:143`, where the assignee already *is* the claim). The machine **assigns itself when it claims a step**, and **stays assigned after a cancel**. The assignment is what stops the step being retaken while it waits for the human; retrying it, or closing it, is what clears the wait.

The cost is not small and is not deferrable. This needs Timone to have its own forge account ([ADR-0042](0042-timone-acts-under-its-own-identity.md)). On a borrowed account there is one name on the tracker, and *the machine is building this*, *the machine stopped and is waiting for you* and *the human is looking at this* all render identically — so the field this decision loads cannot carry the load.

**fvermaut ruled on 2026-08-21 that the account is therefore made before phase 29 is built**, reordering the work he had set on 2026-08-20. Phase 30 already recorded the account as its own first blocker; this decision makes phase 29 wait on it too.

> **✏ Refined 2026-08-21 — the decision is unchanged; what "assigned" means on the wire is not what this ADR assumed.** Later the same day fvermaut ruled that Timone's identity is a **GitHub App**, not a second account ([ADR-0042](0042-timone-acts-under-its-own-identity.md), as amended), so the thing that claims a step is a **bot**, `timone-agent[bot]`. A bot can be an assignee — but only through GitHub's newer field, and the older one is blind to it. Verified against `fvermaut/scratch-app` on 2026-08-21:
>
> - **`Issue.assignees` is typed `UserConnection`** — users only. **A bot assignee does not appear in it at all.**
> - **`Issue.assignedActors` is typed `AssigneeConnection`**, and its `Assignee` union has possible types `Bot`, `Mannequin`, `Organization`, `User`. That is the field that can see the claim.
> - **The mutation is `replaceActorsForAssignable`.** `addAssigneesToAssignable` and `removeAssigneesFromAssignable` are the older user-only pair.
> - **`gh issue list --json` cannot ask for it.** Its field list offers `assignees` and never `assignedActors` — verified by running it. **So the frontier query reads `assignedActors` through GraphQL, not through the `gh issue list --json` path phase 29's plan currently assumes.**
>
> **State the failure mode plainly, because it is silent and it destroys work.** A frontier query that reads `assignees` sees **no claim on a step the machine is holding**. The step therefore looks open, unblocked and unassigned; the daemon takes it up; and it rebuilds work that was deliberately stopped. Every guarantee this decision makes — a cancel stops the step, a dropped step stays dropped — evaporates, and nothing anywhere reports an error.
>
> **Unproven, and it must be tested before code depends on it.** Only the schema was inspected. The field, the union and the mutation exist and are queryable; **nothing has actually been assigned to a bot**, because proving it needs an installed App. If it turns out a bot cannot hold a claim on an issue, D3 needs a different mechanism entirely — and the label this ADR's alternatives already rejected is where that conversation restarts. **Install the App, assign it to one issue, read it back through `assignedActors`, and only then write the query.**

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

### D7 — The way back out of a dropped step is letting go of the claim, not reviving the run

> Added 2026-08-21, in the same session, once D2 and D3 were found to have closed the only door the ledger leaves open. It completes D2's call to action, whose "retry" half had no mechanism behind it.

D2 says a cancelled step's ticket carries a call to action with two ways on. The *close* half needs nothing. The *retry* half collides with a decision already in the code: **a cancelled run is a dead end by construction.** `runs.ts:108` gives `cancelled` an empty transition list, under fvermaut's ruling of 2026-08-15 — *"a run that should never have existed must not be one keystroke from restarting"* — and `RunStore.retry` refuses one in a sentence written to be read by a person (`runs.ts:878-886`).

That ruling always named a way back, and it is not reviving the run: *"a ticket that deserves another go gets a fresh chunk from `register`, because cancellation settles this one."* It worked because settledness freed the ticket. **D2 and D3 close exactly that door** — the step stays open, stays assigned, and an assigned step is never taken up.

**So the claim is what is released, and the step is taken afresh.** The human unassigns the step ticket. The frontier then sees it open, unblocked and unassigned, and `register` opens a **new** run for it. The cancelled run stays dead and stays in the ledger as the record that the work was dropped once; nothing revives it.

Both rulings survive intact, and this is the same instruction the refusal message already gives — *"reopen the ticket and mark it for me, and I'll start it afresh on my next pass"* — with *mark it* replaced by *unassign it*, because under D3 the claim now does the job the mark used to do.

**The cost, and it is a real one:** this is the only act in the system with no `timone` command behind it. Everything else done to a run is typed. Releasing a claim is a click on the tracker. Accepted on the ground that the human is already on that ticket reading why the step stopped, which is where the call to action put them — but a `timone` verb for it is the obvious first thing to add if it grates.

**What this forbids:** `timone retry` must **not** gain a `cancelled → picked-up` edge. A slice that finds the CTA naming a command the ledger refuses must fix the CTA's wording, never the transition table.

> # ✏ SUPERSEDED 2026-08-21 — removing a label, and there is no open question left
>
> D3's amendment above records that a bot cannot be assigned at all, so there is no assignment to release. **Releasing the claim is removing the hold label**, which a person does in two clicks in any GitHub view. The worry recorded below — whether GitHub's interface would offer a human the control to unassign a bot — **does not arise**, and the `timone` verb this decision called optional stays optional.
>
> The block below is kept as the record of the mechanism that was designed before the bot-assignment test was run.

> **✏ Refined 2026-08-21 — releasing the claim is the same GraphQL path D3 now takes, and one half of it is an open question.** Under [ADR-0042](0042-timone-acts-under-its-own-identity.md) as amended the claim is held by a bot, so it lives in `assignedActors` and not in `assignees`. Releasing it is therefore **`replaceActorsForAssignable` with an empty actor list**, not `removeAssigneesFromAssignable` — the older mutation is user-only and has no bot to remove. The input schema admits it: `actorIds` and `actorLogins` are both plain lists, so "replace with nothing" is expressible. Verified on the schema, 2026-08-21.
>
> **Open question, not resolved here: can fvermaut do it by hand, in the GitHub UI, for a bot assignee?** D7 rests on that gesture — it is the *only* act in the system with no `timone` command behind it, and this ADR accepted that cost on the understanding that a click on the tracker would do it. Whether the issue page's assignee control offers a bot the same unassign affordance it offers a user was **not** confirmed; it cannot be, without an installed App to look at. Two things follow if it turns out he cannot: D7 loses its mechanism, and the `timone` verb this decision calls *"the obvious first thing to add if it grates"* stops being optional. **Check it in the same sitting that proves the assignment works.**

## Consequences

- **The ~~machine account~~ machine identity moves to the front of the queue.** [ADR-0042](0042-timone-acts-under-its-own-identity.md)'s account was already blocker (a) on phase 30 — it blocks 30a and, through it, 30b, 30c and 30d, plus the live checks in 30k and 30l. D3 adds phase 29 to that list. It is an hour of fvermaut's time and it now gates both phases; nothing in code substitutes for it.
  - **✏ Refined 2026-08-21:** the hour is spent creating and **installing a GitHub App**, not creating an account and inviting it. The gate is unchanged and so is its position; only the gesture is different, and it is a shorter one — no mailbox, no invitations, and the short-lived per-repository credential comes for free rather than being scoped by hand.
- **[`CONTEXT.md`](../../CONTEXT.md) owes two terms and one correction.** There is no glossary entry for a **step ticket** or a **map ticket**, and both are now load-bearing vocabulary. Worse, the existing **Breakdown** entry is false where it says which piece is next is *"derived every time it is asked, from the approved list and the count of chunks that finished"* — ADR-0040 removed that derivation and this ADR builds on its removal.
- **The tracker gains assignments the human did not make.** Every claimed step carries the machine's name, and a cancelled one keeps it until the human acts. The mirror of that is deliberate: **a human who assigns themselves to a step takes it off the machine's list.** It is the same claim rule wayfinding has used across fifteen tickets, now applied to the build.
- **`timone status` gains a cached field, and therefore a staleness window.** The ledger starts holding a picture of the tracker rather than only a record of runs. That is a new class of thing to keep correct, and a new way to be wrong — a cycle that fails to write the field leaves status confidently reporting yesterday.
- **The shrinking-list asymmetry is unresolved.** D4 records it rather than fixing it. A breakdown that grows re-gates; one that shrinks does not. Whoever revisits this is answering an open question, not correcting an oversight.
- **Phase 29's plan must be amended before it executes.** Its four blockers are answered here, but the slices they hold up — 29a, 29b, 29c, 29d, 29e and 29f — still carry the wording written before the answers existed, and 29f's validation block is explicitly marked provisional pending D5. The plan is corrected first; the phase runs second.
- **`timone retry` and `timone cancel` change what they take, and `STATUS.md` currently tells fvermaut otherwise.** The commands he has been given name the initiative. Every place that prints one has to print a step number instead, and the first of those places is status itself.
