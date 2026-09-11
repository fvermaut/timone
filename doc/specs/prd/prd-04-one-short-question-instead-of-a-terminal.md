# PRD-04: One short question instead of a terminal session

> **Status:** Draft
> **Project:** timone — see [product-overview.md](../product-overview.md)
> **Criteria register:** [prd-04-one-short-question-instead-of-a-terminal.criteria.md](prd-04-one-short-question-instead-of-a-terminal.criteria.md)
> **Phases:** none yet

## Problem

On [ivtrends#90](https://github.com/fvermaut/ivtrends/issues/90) fvermaut replied `aprrove` to a request for approval. The machine read it, said on the ticket that it looked like a yes with a letter out of place, and then asked him to open a terminal session. He lost time to a spelling.

Nothing there was a mistake in judgement. The machine understood him. It had no cheap thing it was allowed to do. A stage handed words it cannot act on can redo its work or ask for a person, and there is nothing between those two. The same shape cost five verification passes on [ivtrends#1](https://github.com/fvermaut/ivtrends/issues/1), which ended with *"How many times do I need to say YES??"*

The rule that should have stopped this already exists. [ADR-0052](../../adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md) decided that a stage may only ask a question the machinery can act on the answer to, that a typed reply always moves the work, and that a run reaching a dead stop is a fault to file. The rule reached the process document and the skills. It never reached the code that reads a reply.

What was never settled is the third answer. A request for approval expects a yes or a list of changes. `aprrove` is neither, and the machinery has no outcome for neither — so it picked the most expensive one it had.

The decision taken from this is recorded in [ADR-0054](../../adr/0054-an-ask-check-stands-in-front-of-every-question-put-to-a-person.md). Source: the conversation of 2026-09-11 on [timone#128](https://github.com/fvermaut/timone/issues/128), four questions each answered against a recommendation.

## Goals

- A person is never sent to a terminal for something a one-word reply would settle.
- Nothing is ever approved that the person did not approve. This goal outranks the one above, and where they pull against each other this one wins.
- The number of messages asking a person for something does not go up.

## Scope

### In scope

An **ask check** stands in front of every message the machine sends a person asking for something. It reads what is about to be asked against what the machine already knows, and does one of two things: lets the message through untouched, or replaces it with one short question that would settle the matter (R1, R4).

Its limits are the point of it, and each one is checkable on its own. It cannot close a gate — only a reply matching a known approval word does that (R2). It cannot move work to another step (R3). It cannot decide that a person need not be asked at all (R4). It gets one question per ask, and if the answer still does not work it posts the message it was going to post in the first place (R5). It speaks only where a person was already going to be interrupted, so it can never add a message that would not otherwise exist (R6).

A ticket the machine has given up on can now be unstuck in writing, but only when the reply answers a question the ask check itself framed for that purpose. Any other comment on such a ticket still moves nothing (R7).

The question it writes is read by a person, so it follows the same writing rules as everything else the process says out loud (R8).

### Out of scope

- **Reviewing a pull request.** There is no cheap version of that ask, and the ask check leaves it alone.
- **Giving each work stage its own one-question branch.** The two conversation stages already have one. Extending it to the rest was considered and set aside: the stage has to run at full size to discover it holds a one-line question, which is the cost this work exists to avoid. It stays available if it is ever wanted.
- **Letting the ask check decide anything.** Named here because it is the obvious next step and it is refused: deciding is what [ADR-0033](../../adr/0033-a-stage-that-cannot-act-on-an-answer-escalates.md) turned down, and the failure it predicted — work passed that nobody passed — is one nobody would see happen.
- **Checking the rest of ADR-0052 against the code it governs.** That ADR's rules have now stopped one level short of the code twice in six days. Worth doing, too big to carry here, and filed on its own.

## Open Questions

None. Every branch was settled in the conversation of 2026-09-11.
