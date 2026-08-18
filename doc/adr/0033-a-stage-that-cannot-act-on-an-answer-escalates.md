# ADR-0033: A stage that cannot act on an answer escalates

- **Status:** accepted
- **Date:** 2026-08-18
- **Source:** fvermaut's rulings of 2026-08-18, in the grill session on [timone#28](https://github.com/fvermaut/timone/issues/28) — four questions, each answered against a recommendation
- **Extends:** [ADR-0031](0031-a-handoff-is-a-wait-not-a-failure.md), whose conversation park assumed the stage that asks a question is a stage that can act on the answer
- **Bounds:** [ADR-0022](0022-a-conversation-ticket-can-be-answered-in-writing.md), whose two answer paths stay as they are at every other wait; [ADR-0023](0023-one-answer-one-session.md), whose cursor and consumed-answer marker are reused rather than changed; [ADR-0032](0032-a-human-command-asks-the-daemon-to-act.md), which is why the command this adds can be run at all

## Context

`ivtrends` [#1](https://github.com/fvermaut/ivtrends/issues/1), piece 4, was verified **five times** between 2026-08-18 02:00 and 14:58. Every pass reached the same place: the software behaves, and one written promise — PRD-01.R1's *"a GICS sector per symbol"* — cannot hold, because one of the two index feeds publishes a different classification and no feed the piece owns supplies the missing one. Each pass asked the human what to do. The human answered four times, ending *"How many times do I need to say YES?? Just go ahead to delivery now!"*, and each answer started the same check again.

**The stage was not confused, and this is the finding that shapes the decision.** From pass two onward the verification session said, unprompted and correctly:

> You said to reword the promises. That has not been done yet, and I cannot do it myself — I check the software against the promises, so if I also rewrote them the check would prove nothing.

Pass five went further and proved a sixth pass could not change the answer. The human's words *were* delivered to the stage — `resolveWait`'s conversation branch (`src/daemon/poll.ts:1919`) re-enters the same stage carrying them as `PromptContext.feedback` (`src/daemon/prompts.ts:41`) — and were read, understood, and correctly judged unactionable. **Judgement was never the scarce resource. Authority was.**

**What the stage lacked was a slot to put the judgement in.** `PipelineTransition` (`src/daemon/pipeline.ts:373`) offers `advance` / `repeat` / `wait` / `finish`. A stage may hold the baton or pass it to `STAGES[stage].next`, and verification's `next` is `delivery`. There is no outcome meaning *"this run is at the wrong stage"*, so the conclusion could only leave the session as prose on a ticket, where nothing reads it.

**The stage it named does not exist in the daemon.** `feedback` is `built: false` (`src/daemon/pipeline.ts:364`), and nothing routes verification there in any case. `process.md` stage 7 already prescribes the outcome — at loop exhaustion *"the work goes to the human via stage 9"* — so the harness diverged from its own normative spec rather than lacking a rule.

**ADR-0031 is where the assumption sits.** It made a handoff a `conversation` park on this stated reasoning, quoted in `handBack` (`src/daemon/session.ts:472`): *"`resolveWait` re-enters the same stage carrying the human's words for that kind, which is exactly what a stage that asked a question needs — it is the one that has to judge whether the answer settles anything."* True, and it presumes judging and acting are the same power. ADR-0031's consequences named *"a park nobody answers"* as its residual risk. This is the opposite case: a park the human answers, into a stage with no power to use the answer.

**The escape hatch existed and was neither advertised nor sufficient.** `resolveTakeover` (`src/commands/takeover.ts`) returns `converse` for exactly this shape — parked, conversation wait, verification in `PROMPTED_STAGES` — so `timone takeover ivtrends#1` would have opened a session. It was never offered: the takeover line comes from `TerminalChannel` (`src/channels/terminal.ts`), which only *conversation* stages open, while a work stage asking for help posts `STAGE_HANDED_MARKER` (`src/adapters/ticketing.ts:66`) in its own words and bypasses the channel. And it would not have helped, because `takeoverPrompt` (`src/daemon/prompts.ts:1083`) calls `stagePrompt(stage, …)`: **a takeover inherits the stuck stage** and would have told the human the same thing in person.

**Nothing counts re-entries.** No field on the run records how many times a stage has been re-entered on the human's words, so the loop had no ceiling. Five passes ran at `model: "claude-opus-5"`, `effort: "xhigh"` (`src/daemon/pipeline.ts:330`).

**Alternatives considered, for where the judgement goes:**

- **A judgement layer that reads the thread and re-routes the run.** The shape first proposed. Rejected on the evidence above: five sessions read the thread and reached the right conclusion, so a sixth reader adds nothing. It also makes the run's path a matter of opinion, which trades a loud, expensive loop for a silently skipped gate — a strictly worse failure because nobody notices it.
- **Fix only the advertising** — offer the takeover on a work-stage handoff. Cheapest by far, and it fails: the takeover inherits the stuck stage.
- **Escalation as a typed stage outcome, offered to the human in the call to action** (chosen). The stage's constraints are untouched; what changes is that the constraint becomes reportable.

**Alternatives considered, for what detects it:**

- **The stage declares it, alone.** Rejected: the rule would live in ten stage prompts, which is ten chances to forget, and forgetting is what cost five passes.
- **A mechanical check, alone.** Rejected: it cannot fire before the second pass and cannot say *why*, so the human is told a count instead of a reason.
- **Both, declaration primary** (chosen).

**Alternatives considered, for what the escalation session runs as:**

- **Bound to the stage the stuck stage names.** Every rule keeps applying and the audit trail is a stage's own artifact. Rejected twice over: it needs stage 9 built into the daemon before it works at all, and it obeys a diagnosis from the context least equipped to make one — a verifier may not read source, ADRs or diffs, and this one told the human to reword *both* failing promises when only one needed new words (PRD-01.R21 needed piece 5 to exist, not a rewording).
- **Unbound** (chosen).

## Decision

**A stage that is given an answer it may not act on escalates. It does not ask again.**

**D1 — Escalation is a fourth stage outcome.** `PipelineTransition` gains `{ kind: "escalate"; reason: string; owed?: PipelineStage }`. This loosens no stage's constraints: verification still may not rewrite a promise it checks against, and that prohibition is the reason the outcome is needed. Escalation is how a constrained stage *reports* the constraint, not permission to cross it.

**D2 — The trigger is a rule, not a mood.** A stage escalates when **it was given an answer and acting on that answer is outside what the stage may do**. Explicitly not "this is hard" and not "I need a human": pass one asking the human to choose was *correct* behaviour, and a stage that has asked nothing yet has nothing to escalate. The dead end begins at the first answer that cannot be used.

**D3 — Two detectors, declaration primary, and the call to action says which fired.**

- **The stage declares it**, per D2, in its prompt's outcome vocabulary. This fires on the first unusable answer and carries a reason in the stage's own words.
- **A mechanical floor catches a stage that does not.** It needs no new detection: `applyPark` (`src/daemon/runs.ts:1202`) is already the one site holding both facts, because `consumedAnswerAt` (`src/daemon/runs.ts:189`) is present exactly while an answer has been consumed and not yet acted on, and is dropped by the very park that re-asks. A run parked on a `conversation` wait at the same stage while carrying that marker has consumed an answer and produced another question. A counter on the run records consecutive occurrences and is reset by `setStage`, which is what real progress looks like; the second occurrence escalates.
- The call to action names which detector fired, so a stage that noticed is distinguishable from one that had to be caught.

**D4 — An escalation park is a wait that words do not resolve.** A new `waitingKind: "escalation"`. `resolveWait` never re-enters the stuck stage from it. Words written after the cursor are **recorded and carried into the escalation session** — never discarded, never acted on by the stage that could not act on them. This is the one wait where ADR-0022's written path does not apply, and the reason is exact: the written path exists so the stage that asked can judge the answer, and this park is the declaration that judging it changes nothing.

**D5 — The escalation session is unbound.** It gets no stage prompt. It receives the ticket thread, the run's ledger entry, and the stuck stage's `reason` and `owed` stage **as input it may overrule**, plus the authority to invoke whichever stage skill actually fits and to depart from a skill's default where the case demands it. **It is obliged to commit a record** naming what it did, and naming and justifying any default it departed from. The record is the whole of the audit, which is what the next point costs.

**D6 — The human triggers it, from the call to action.** `ctaFor` (`src/daemon/cta.ts`) already carries a `command` slot that `ctaComment` renders as a copy-pasteable line. An escalation park fills it, and the comment says plainly that **answering on the ticket will not move this** — the one thing a reader of the previous five comments could not have known.

## Consequences

- **The unbound session is constrained by nothing but the person and the model in it.** This is the accepted cost of D5 and the reason D5 obliges a record. It is not hypothetical: unblocking `ivtrends` #1 by hand required contradicting stage 9's own rule that PRD amendments land on the default branch, because `main`'s copy of the register was 92 lines behind the branch carrying the five verdicts and amending it would have forked the file. A bound session following the rule would have got that wrong; nothing but the written record makes the departure reviewable.
- **Stage 9 does not have to be built for this to work,** which is the point of D5. `feedback: built: false` stays true and stops being a dead end.
- **`process.md` is unchanged.** Stage 7 already routes loop exhaustion to the human via stage 9; escalation is the harness finally implementing what the spec prescribes. Nothing here adds a stage or moves a gate.
- **An escalation park holds its project**, exactly as ADR-0031's handoff park does and for the same reason: it is the ticket's live business, waiting on a person. The escape is `timone cancel`, runnable because of ADR-0032.
- **A stage that never declares costs one extra pass.** The floor cannot fire before a second park, so the worst case under D3 is two passes rather than one — against five, and against unbounded.
- **The floor is only as good as `consumedAnswerAt`.** A run parked by a daemon predating that field carries none, so the mechanical detector does not fire for it; those runs behave exactly as they do today, and the declaration path still covers them.
- **Migration-free, at `version: 1`.** The counter is a new optional field whose absence means zero, per the ledger's standing convention. The new `waitingKind` member is the one forward-incompatibility: a state file written after this change and read by a daemon built before it fails the enum. Runs already parked as `conversation` are untouched and read as they always did.
- **The residual risk is a stage that escalates too readily.** D2's rule is checkable but it is still applied by a model, and an over-eager stage summons a person who was not needed. That failure is visible and cheap — a call to action the human declines — where the failure it replaces was invisible and cost five passes at the most expensive setting the pipeline has.
