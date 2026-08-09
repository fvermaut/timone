# ADR-0022: A ticket waiting on a conversation can be answered in writing

- **Status:** accepted
- **Date:** 2026-08-09
- **Source:** grill session of 2026-08-09, prompted by six unanswerable tickets on `ivtrends`
- **Amends:** [ADR-0012](0012-conversation-channels.md), whose conversation bullet this extends; [ADR-0010](0010-wayfinder-discovery-maps.md)'s tickets are the class that exposed the gap

## Context

[ADR-0012](0012-conversation-channels.md) split human interaction in two and gave each its own medium: **gates** are single decisions answered on the ticket, **conversations** are multi-turn interviews that run on a conversation channel — a chat application, or the universal fallback, a terminal takeover. The reasoning was sound and is not in dispute: a grilling interview is fifteen questions asked one at a time, and run as comment ping-pong it is slow and miserable. fvermaut named that as the part of PRD-02 he was unconvinced by, and the split is what answered him.

Two things happened afterwards that the split did not anticipate.

**Wayfinding produces a different shape of conversation.** [ADR-0010](0010-wayfinder-discovery-maps.md) charts a large discovery effort as a map of **decision tickets**, each holding **one sharp question** and sized to one session. That is not the fifteen-turn interview ADR-0012 was protecting against. It is a conversation in *kind* — the answer may need a back-and-forth — but a gate in *shape*: one question, in writing, in front of the human, on a ticket they are already reading. Forcing a terminal takeover to answer "IV Rank, over a 252-day lookback" makes the human open a shell to type six words.

**And those tickets carried no call to action at all.** `timone-wayfind` creates them straight through `gh`, outside the daemon's conversation machinery, so none of `src/channels/terminal.ts`'s CTA-writing applies to them. Observed 2026-08-09 on `ivtrends`: six open `wayfinder:grilling` tickets, each a well-formed question with no instruction of any kind, and:

```
$ node dist/cli.js takeover ivtrends#5
I'm not working on ivtrends #5. Add the `timone` label to that ticket and I'll pick it up.
```

`resolveTakeover` resolves only from the daemon's run ledger, and `grep -rn wayfinder src/` returns nothing — the daemon does not know these tickets exist. So the human had a map they could read, questions they could understand, and no way to answer either. That is a straight violation of `process.md`'s rule that every message to a human ends with a CTA, and it is what prompted this decision rather than a wish for symmetry.

**Alternatives considered:**

- **Takeover only, ADR-0012 as written.** Honest to the split, and it is what the process already says. It also means the shortest possible answer costs a context switch, and it leaves the observed friction exactly where it was found.
- **Unbounded comment ping-pong.** Maximum flexibility; reopens precisely what ADR-0012 closed, and the failure is gradual rather than obvious — a thread that was going to be one exchange becomes eleven.
- **A wayfinder-only affordance.** Narrower, and defensible on the one-sharp-question argument. Rejected because two kinds of ticket would then behave differently and the human would have to know which kind they were looking at — which `process.md`'s "the harness routes, the human never does" forbids in as many words.
- **Two paths on every conversation ticket, with a bound** (chosen).

## Decision

**Every ticket waiting on a conversation names two ways to answer it: write the answer on the ticket, or run the takeover.** The choice is the human's and needs no explanation from them; both paths reach the same session and produce the same record.

- **The written path is real, not a courtesy.** A written answer is **picked up by the daemon**, which watches conversation-waiting tickets — the `wayfinder:*` classes included — and spawns the session that ingests it. Writing the answer causes something to happen; a path that only worked when someone independently ran a command would be a suggestion, not a path.
- **One clarifying round, then escalate.** If the written answer settles the question, the session resolves the ticket and that is the end of it. If it is partial or ambiguous, the session posts **what is still open** as a comment and waits once more. If the next answer still does not settle it, the session stops asking in writing and says the rest needs the takeover. The bound is what keeps the written path from becoming the thread ADR-0012 rejected: it degrades toward the terminal, which is where the conversation was heading anyway.
- **The wording follows the ticket type, because the types are not the same shape.** A `grilling` or `task` ticket offers both paths. A `prototype` ticket offers the takeover alone — there is nothing to react to until the prototype is built, so a written answer has no object. A `research` ticket asks the human for nothing and says so, which is what `process.md` already requires of a message that asks nothing.
- **A human comment after the machine's question is the answer.** The machine's own comments carry `MACHINE_MARKER`; anything else on a waiting ticket, authored by the human, is an answer to what the ticket is waiting on. No new syntax, no keyword, nothing for the human to remember — consistent with gate replies, which are read the same way.
- **What survives is unchanged.** The resolution comment on the ticket, an ADR at decision time when the answer passes stage 4's test, and the destination artifact in the repo. A written answer is not a transcript and not an artifact; nothing may cite the thread any more than it may cite an interview.

**ADR-0012 stands in substance.** The conversation channel is still where a conversation *runs*, the terminal is still the universal fallback, gates are still answered on the ticket and nowhere else. What changes is that a ticket is now also a place a conversation can be **answered** — one bullet widened, not a split reversed.

## Consequences

- **The daemon gains a watched class it did not have.** Wayfinder decision tickets are created by an interactive skill and have never had a ledger run; making the written path real means the daemon must recognise and park on them. That is new work, and it is [phase 18](../plans/phases/phase-18.md).
- **`timone takeover` must resolve a ticket with no run behind it**, from the tracker rather than the ledger. Until it does, any takeover CTA written onto a wayfinder ticket is an instruction the human cannot follow — so the CTA and the resolution ship together, or the CTA is a second lie replacing the first.
- **PRD-02 moves:** R3 is `revised` — its conversation clause gains the written path — and a new criterion covers wayfinder decision tickets participating in the loop at all. R3 leaves the regression set until stage 7 re-verifies it, which is what marking it means.
- **A written answer is a worse answer, sometimes.** No follow-up in the moment, no reading of the room, no chance to notice the human hesitating over a word. Accepted: the one-clarifying-round rule is the backstop, and the human chose the path knowing both existed.
- **The escalation judgement is the residual risk.** "Partial or ambiguous" is a call the session makes, and it will sometimes be made wrong. It fails toward the terminal, which costs a context switch and nothing else; the opposite failure — resolving a ticket on an answer that did not actually settle it — is caught by the resolution comment being posted where the human reads it before anything downstream restates it.
- `process.md` gains the second path in its conversations section and in stage 2's at-scale paragraph; `timone-wayfind` gains a ticket-body template carrying the per-type CTA and the rule for ingesting a written answer; `src/channels/terminal.ts`'s invitation gains the written path, so the daemon's own conversation parks say the same thing as a wayfinder ticket.
