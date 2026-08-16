# ADR-0031: A handoff is a wait, not a failure

- **Status:** accepted
- **Date:** 2026-08-16
- **Source:** fvermaut's ruling of 2026-08-16, in the grill session on [timone#1](https://github.com/fvermaut/timone/issues/1), from three options laid out with their trade-offs
- **Extends:** [ADR-0022](0022-a-conversation-ticket-can-be-answered-in-writing.md), whose written path gains the one class of stop that could not use it
- **Bounds:** [ADR-0029](0029-a-chunk-advances-only-on-success.md), whose settledness rules are untouched; what moves is the run's hold on its project

## Context

[Phase 23's live gate](../plans/phases/reports/phase-23-live-gate.md) stopped mid-initiative on `scratch-app` [#31](https://github.com/fvermaut/scratch-app/issues/31). The execution session ran 2h39m, stopped, and asked in its own words: *"just tell me here to carry on, and I will get the missing behaviour planned properly and built."* fvermaut replied `carry on`. **Nothing acted on it**, and nothing ever would have.

**The mechanism, read off the code rather than inferred.** Three sites in `src/daemon/session.ts` — `afterWorkStage:724`, `afterRemediation:764`, `afterDelivery:816` — handle a session that hands back by calling `store.fail(...)`. The reason string each of them writes is *"the … stage stopped and handed the work to you — see the ticket"*: the ledger records a **failure** whose own text says a **human is being waited on**. `ctaFor` (`src/daemon/cta.ts:215`) then renders `failed` with `waitingOnYou: false` and a `timone retry` command, so the ticket says *"Something went wrong"* directly beneath a session politely asking a question.

**The machinery the reply needed already existed, one state over.** `resumeAnsweredRuns` (`src/daemon/poll.ts:1153`) resumes every **parked** run whose human has answered, reading the answer straight off the ticket — ADR-0022's written path, built in [phase 18](../plans/phases/phase-18.md) and live since. `carry on` landed on a run in the single state that path does not watch.

**The words were carried; they could not start anything.** When the run was re-armed by hand, the spawn prompt carried the whole thread — 91,425 characters, `carry on` among them — and the resuming session read the ticket four times. That is the sharp form of this defect and it is worse than being ignored: the human writes into a channel the machine reads faithfully and acts on never, so from their side the failure is invisible. Nothing distinguishes a reply that will be picked up from one that will sit there for good.

**Alternatives considered:**

- **Keep `failed`, and make a reply re-arm it.** Preserves the slot-releasing behaviour below. Rejected: `failed` would then mean two things — a crash nobody can answer, and a question waiting on an answer — and two resume paths would have to be kept in step for one behaviour.
- **Keep `failed`, and fix only the words** — the session stops inviting a reply, the ticket names `timone retry` and nothing else. Cheapest, and honest about the machinery. Rejected: it answers a design fault with better prose, and it leans the whole path on the command [ADR-0032](0032-a-human-command-asks-the-daemon-to-act.md) exists because nobody could run.
- **A handoff is a park waiting on the human** (chosen).

## Decision

**A session that hands work back parks its run on the human; it does not fail it.** The three `store.fail` sites become parks, carrying `waitingKind: "conversation"` and a wait cursor at the handoff comment, so only what is said *after* the question can answer it.

- **The kind is reused, not invented.** `resolveWait` (`src/daemon/poll.ts:1751`) says what `conversation` means in as many words: *"everywhere else a written answer re-enters the same stage, because that stage has to judge whether the answer settles the question it asked."* That is exactly a handoff — the stage that stopped is the one that must weigh the reply. `concludeLastConversation` ends a run outright only where `concludeConversation` returns `finish`, i.e. at a stage nothing follows, so an execution handoff resumes rather than being closed out.
- **Both answer paths come with it, and that is the point.** A `conversation` park's CTA already offers the takeover beside the written reply — ADR-0022's two ways to answer, now available at the stop where the human is most likely to be needed.
- **The contradiction on the ticket closes as a consequence, not as a second fix.** The standing call to action is computed from the run's state, so a parked handoff reads *"This one is waiting on you"*. The session's prose asking for a reply and the status box above it stop disagreeing because they stop describing different states.
- **Nothing changes about what a real failure is.** A stage that ends without an outcome, or claims an artifact it did not produce, still fails, still posts `failedComment`, and is still the thing `timone retry` exists for.

## Consequences

- **An unanswered handoff holds its project.** `parked` is not in `TERMINAL` (`src/daemon/runs.ts:45`), so the run keeps the one-session slot and nothing queued behind it is promoted until the human replies. This is deliberate and it is a real cost: `failed` released the slot precisely so *"a dead session must not freeze the project behind it"*. A handoff is not a dead session — it is the ticket's live business, waiting on a person, exactly as a pull request awaiting review already waits and already holds. The escape is `timone cancel`, which [ADR-0032](0032-a-human-command-asks-the-daemon-to-act.md) makes runnable.
- **`timone retry` no longer applies to a handoff**, because retry re-arms failed runs and a handoff is not one. Nothing is lost: the reply resumes it, and the takeover forces it.
- **Settledness is untouched.** A parked chunk is unsettled, as a failed one was, so the ticket does not open its next piece beside a question it has not answered. [ADR-0029](0029-a-chunk-advances-only-on-success.md) needs no amendment.
- **The residual risk is a park nobody answers.** A handoff on a project with queued tickets blocks them for as long as the human is silent — where before it blocked nothing and was merely unreachable. The ticket says what it needs on every cycle, and `timone status` lists it as waiting on you, so the silence is visible rather than quiet. Trading an invisible dead end for a visible block is the trade being made here, and it is the same one ADR-0023 made when it chose a visible stall over a silent double-answer.
- **No migration.** A run already `failed` stays retryable and reads as it always did; the change applies to handoffs made from here.
- **PRD-02's R21 gains evidence rather than a clause.** *"Every open ticket answers for itself"* was violated by a ticket whose answer was wrong; nothing in the criterion needs rewording.
