# ADR-0035: A resolved escalation hands the run back

- **Status:** accepted
- **Date:** 2026-08-19
- **Source:** [timone#30](https://github.com/fvermaut/timone/issues/30), filed from [phase 25's live gate](../plans/phases/reports/phase-25-live-gate.md), and fvermaut's rulings of 2026-08-19 across three questions — every one of them taken with the recommendation
- **Completes:** [ADR-0033](0033-a-stage-that-cannot-act-on-an-answer-escalates.md), which settles how a person **enters** an escalation and is silent on what ends one
- **Standing:** [ADR-0024](0024-every-open-ticket-answers-for-itself.md) (the ticket is the record and the surface), [ADR-0022](0022-a-conversation-ticket-can-be-answered-in-writing.md) and [ADR-0023](0023-one-answer-one-session.md) (how a written record moves a run), [ADR-0032](0032-a-human-command-asks-the-daemon-to-act.md) (the daemon is the ledger's only writer), [ADR-0026](0026-a-ticket-is-a-conversation-a-run-is-a-chunk.md)

## Context

**Phase 25 built the way into an escalation and no way out of it.** A run that stops because it cannot act on an answer parks on a wait nothing written resolves; the ticket hands the human `timone takeover`; the session that opens is bound to no stage and holds the authority the stage lacked. That much was observed working on `scratch-app` [#37](https://github.com/fvermaut/scratch-app/issues/37) on 2026-08-18: it refused to sign fvermaut's name to a document he had not read, wrote the document, took his approval in person, and recorded it publicly on the ticket.

**Then two things happened, and they are one thing.**

**The session carried on and built.** Having got the approval it wrote a phase plan and began implementing, in the terminal, unattended by anything. Everything the loop provides was absent while it did: one job per project, a cost per step, a stage's own provenance on each commit, the ticket as the surface, the gates between steps, and a fresh context checking what an earlier one built. fvermaut watched it happen and named it as wrong.

**And the run was stranded.** `releaseClaim` gives a claimed run back to *the wait it was holding* (`waitOf`), so an escalation park is restored as an escalation park — same kind, same stage, same standing note saying *"I can't take this one further myself"* — on a ticket whose work is now approved and under way. The daemon never resumes that kind of wait, by design. Nothing in the system can say *this is resolved, carry on from here*: `timone retry` refuses a parked run, and `timone cancel` throws the whole chunk away.

**Neither is fixable alone.** Tell the session to stop at unblocking and the run is stranded exactly as it is now. Give the run a way back and the session still has no reason to take it rather than carry on. The rule and the road are one decision.

**This is the ordering lesson of phase 25 itself, one level up.** That phase is built on *the escape must exist before anything can need it* — and it built the escape for the human while leaving the run without one. It was written that way because ADR-0033 D6 settles the entry and says nothing about the exit, and the plan followed the ADR.

## Decision

### D1 — The unbound session unblocks, and never builds

Its job ends where the blockage does. It may do what clears the stop: take the human's decision, write or correct the process artifacts that decision needs — requirements, a decision record, a reworded promise, a correction to what the record says — and commit them with the account [ADR-0033](0033-a-stage-that-cannot-act-on-an-answer-escalates.md) D5 already obliges.

**It does not write application code, and it does not open a pull request.** Building belongs to the loop, where the work arrives one piece at a time, each piece costs a visible amount, each commit carries the stage that made it, and a context that did not build it checks it. A terminal session that runs to a pull request buys speed by spending every one of those.

**The line is *artifacts, not code*.** It was chosen over the two neighbours: letting the session judge for itself keeps today's behaviour and today's fault; sending even the artifacts back through the loop means two sessions to do what one session with the human present has already done, and re-asks him what he has just answered.

### D2 — It hands back through the ticket, not through a command

It closes with one comment carrying a handback marker, exactly as every other kind of session closes with a marker the daemon reads. The daemon picks it up on its next pass and carries the run on.

**No new command**, though one was considered and would act immediately rather than on the next cycle. The comment wins on three counts: the ticket stays the record of what happened, the daemon stays the ledger's only writer ([ADR-0032](0032-a-human-command-asks-the-daemon-to-act.md)) with no lock dance from a session, and it is the mechanism this system already has for a session telling the machinery how it ended.

### D3 — The comment names where to carry on, in the words a person already reads

The session names the step, because it is the only thing that knows what it just did. On `scratch-app` #37 that is *building*: the requirements, the decision and the list of pieces are written and approved, and restarting at requirements would rewrite what a person has just agreed.

**In the plain words `timone status` already uses for a step** — *building*, *checking the result*, *delivering* — not an internal name. That map becomes one map, in one place, and this is the second surface to need it.

**An unrecognised name is refused, never guessed.** The run stays stopped and the ticket says the machine did not understand its own note. Guessing here starts a session at the wrong step, on a branch carrying half-built work.

**Naming nothing means the step it stopped at**, which is the honest default: a stop cleared without anything being written is a stop the same step can now get past.

### D4 — Only the machine's own record resolves it

[ADR-0033](0033-a-stage-that-cannot-act-on-an-answer-escalates.md)'s refusal stands untouched: a human writing another answer on the ticket still resolves nothing, because the stage that stopped had already read their words and was right about them. What ends the wait is the record of a session that a person and the machine went through together — the same shape as a conversation record ([ADR-0022](0022-a-conversation-ticket-can-be-answered-in-writing.md)), and read the same way: the machine's own comment, after the wait's cursor, never a human's copy of it.

## Consequences

- **`timone takeover` on a stopped run becomes a round trip rather than a one-way door.** The human is in it for as long as the decision takes, and not for as long as the work takes.
- **A stop can still end the whole ticket.** Where the right answer is that nothing should be built, `timone cancel` already ends the chunk and says why; nothing new is needed for it.
- **The run must learn the branch it is handed back onto.** The #37 session cut one and the ledger never heard of it, which is why nothing was blocked and also why nothing could be carried on. How that is established is the plan's, and it is named here so it cannot be forgotten: it is computed the way the pipeline names a branch, never trusted from the comment.
- **A session that ignores D1 is invisible to the machinery.** Nothing can stop a terminal session writing code; what the machinery can do is refuse to carry on from a handback that claims a step the work has not reached, and leave the evidence on the ticket. This is a rule with a prompt behind it and no enforcement, exactly as D2's trigger rule in ADR-0033 is, and for the same reason.
- **R3's revision holds** ([PRD-02.R3](../specs/prd/prd-02-inversion-of-control.criteria.md#r3--async-clarification-via-a-conversation)): a written answer still does not resume this class of stop. What is added is a second machine record that does.

## What this does not decide

- **What the escalation session is told to write.** D1 draws the boundary; which artifacts a given stop needs is a judgement made in the session with the human present.
- **Whether the loop should verify what the escalation session wrote.** It carries on at the named step and the ordinary gates apply from there. Whether an artifact written outside the loop deserves its own check is a question for stage 9, on evidence nobody has yet.
- **Anything about a stop with no ticket.** As with ADR-0033, hand-run work has no surface for any of this.
