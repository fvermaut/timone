# ADR-0054: An ask check stands in front of every question put to a person, and may only make it cheaper

- **Status:** accepted
- **Date:** 2026-09-11
- **Source:** fvermaut's rulings of 2026-09-11, in the grill session on [timone#128](https://github.com/fvermaut/timone/issues/128) — four questions, each answered against a recommendation
- **Extends:** [ADR-0052](0052-a-run-that-enters-the-build-ends-at-its-pull-request.md), which ruled that a typed reply always moves the work, and did not say what becomes of a reply that is neither of the two answers a gate expects
- **Bounds:** [ADR-0033](0033-a-stage-that-cannot-act-on-an-answer-escalates.md), whose escalation machinery ADR-0052 left standing as a last-resort guard; [ADR-0022](0022-a-conversation-ticket-can-be-answered-in-writing.md), whose one clarifying round is untouched

## Context

`ivtrends` [#90](https://github.com/fvermaut/ivtrends/issues/90). The reply to a request for approval was `aprrove`.

`readGateDecision` (`src/daemon/gates.ts:50`) matches five spellings; everything else is a change request carrying the human's own words. So the typo was classified as a rejection, and the requirements stage was re-entered with `feedbackBlock` (`src/daemon/prompts.ts:292`), which tells a stage *"they asked for a change… Do the stage again with that in hand."* The stage read it, said on the ticket that it looked like a yes with a letter out of place, and escalated — because redoing the work produces the identical document, and recording an approval is not a stage's to do.

Every step of that was correct under the rules as written. **The stage's judgement was never in doubt.** It published the right diagnosis and then asked for a terminal session, because a terminal session was the only move it had.

**This was already against the rules.** ADR-0052 decided that at the stops which remain, *"a stage may only ask a question the machinery can act on the answer to,"* that *"a typed reply always moves the work,"* and that a run entering escalation *"is a fault to file, never a wait to serve."* fvermaut typed a reply, the work did not move, and a run entered escalation. The rule existed; the code did not carry it. **This is the second time an ADR-0052 sentence stopped one level short of the code it governs** — the first was the three sentences missing from the verification skill, which stopped `ivtrends` #89 four days after that ADR was accepted.

What ADR-0052 did not settle is the **third answer**. A gate asks for approval, or for changes. `aprrove` is neither, and the machinery has no outcome for neither — so it produced the most expensive one available.

The same diagnosis rules out the obvious repair. ADR-0033 recorded five verification passes on `ivtrends` #1, each reading the thread and reaching the right conclusion, and concluded: *"Judgement was never the scarce resource. Authority was."* Adding a reader adds nothing. What is missing is a cheap action.

**Alternatives considered:**

- **A judgement layer that reads the reply and moves the run accordingly.** It would have read `aprrove` as approval and bothered nobody. Rejected, as ADR-0033 rejected it: it makes the run's path a matter of opinion, and trades a loud, expensive failure for a silent one — a gate passed that nobody passed, which nobody would notice.
- **Give every work stage the ask-once branch the conversation stages already have** (`writtenAnswerBlock`, `src/daemon/prompts.ts:239`). Rejected as the whole answer: the stage must run at full size to discover it holds a one-line question, so on #90 an `opus-5` / `xhigh` session would have been spent asking about a spelling. Kept available as a second measure if one is ever wanted.
- **Cover the replies only, and leave the stops that involve no reply.** Rejected by fvermaut. The complaint was how often the pipeline ends in a terminal command, and two of the rows that do — a stop no answer reaches, and the machine losing its own footing — involve no reply at all.
- **Let the ask check suppress an ask it judges unnecessary.** Rejected: suppressing is deciding, and deciding is the power that re-opens the paragraph above.

## Decision

**D1 — An ask check runs before the machine asks a person for anything.** It reads the message about to be posted against what the machine already knows. It has exactly two outcomes: let the message through untouched, or replace it with one short question that would settle the matter.

**D2 — Its only power is to make an ask cheaper. It never decides and it never routes.** It may not close a gate, may not move a run to another step, and may not suppress an ask. The answer to its question is read by the ordinary machinery: a reply of `yes` approves because `yes` is an approval token (`src/daemon/gates.ts:19`), never because a model formed a view about what someone meant. **This limit is the whole of the safety argument.** Loosening it — in code, or by prompt drift — re-opens exactly what ADR-0033 rejected, and the failure it predicted is invisible.

**D3 — It runs only where a person was already going to be asked.** It can never add a message that would not otherwise exist. Its worst case is one cheap round trip standing in for an expensive one.

**D4 — One question per ask.** If its question is answered and the answer still does not work, it does not ask again: it posts the message it was going to post in the first place. This budget is separate from ADR-0022's one clarifying round, so repairing a spelling never spends the round held for a real question.

**D5 — A written answer starts the unbound session, when it answers a question the ask check framed for that purpose.** ADR-0033 D6 required a person to type a command to start it; ADR-0052 had already ruled that a typed reply must move the work. Any other comment on such a ticket still moves nothing, so ADR-0033 D4's reason — the stuck stage cannot use the words, so handing them back changes nothing — stands untouched.

## Consequences

- **The cheapest repair in the system becomes available for the first time.** On #90 the whole exchange is *"You wrote `aprrove`. Did you mean approve?"* answered with one word, no stage spawned and no terminal session. Two incidents on record end this way instead: that one, and the five verification passes of `ivtrends` #1.
- **A model call is added in front of every message that asks a person for something.** It is small and it is paid only where a person was about to be interrupted, which is the cheapest place in the pipeline to spend anything.
- **D5 takes the person out of the room at an unbound session.** ADR-0033 D5 accepted that such a session *"is constrained by nothing but the person and the model in it"*, and starting it from a written answer leaves only the model. This is a real reduction in safety, accepted deliberately in exchange for the human's time. What holds it: the session is already obliged to commit a record naming what it did and any default it departed from, and it starts only on a question the machine itself framed, so it knows what the answer is an answer to.
- **The ask check is the rejected design wearing a leash, and the leash is prose.** D2 is a rule a model is asked to honour, and [timone#36](https://github.com/fvermaut/timone/issues/36) records what those are worth. Where the limit can be enforced by construction it must be — an ask check that is never handed the means to write a run's state cannot move one, whatever it concludes.
- **This closes a rollout gap, not only a defect.** ADR-0052's rule reached `process.md` and the skills and did not reach `gates.ts`. Any work carrying this decision checks the rest of that ADR's sentences against the code they govern, because two instances in six days is a pattern and not bad luck.
- **A gate that gets a third kind of answer is now a named thing.** Before this, a reply was an approval or a rejection by construction, and the register of what a human can say had no room for *I cannot tell*. Anything later reading replies inherits that third case.
