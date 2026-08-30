# ADR-0046: A pull request closed without merging holds its ticket and asks

- **Status:** accepted
- **Date:** 2026-08-30
- **Source:** fvermaut's ruling of 2026-08-30, taken after an accidental close cost a piece of work and started a run nobody wanted
- **Amends:** the unmerged half of `concludeReview` in [`src/daemon/poll.ts`](../../src/daemon/poll.ts). It **corrects the code toward** [ADR-0040](0040-one-step-is-one-ticket-and-doneness-is-a-fact-about-a-ticket.md), which already says a step ticket closes when its pull request *merges*, and reverses nothing that ADR decided
- **Standing:** [ADR-0044](0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) D2 and D7 (the hold is a label, and only a human takes it off), [ADR-0024](0024-every-open-ticket-answers-for-itself.md)

## Context

When a run was parked waiting on its pull request and that pull request reached a terminal state, the daemon did one of two things. A merged pull request closed the ticket and let the initiative move to its next step. **A pull request closed without merging did the same** — it posted *"treating this work as declined and closing this ticket with it"* and closed the ticket as `not-planned`. The frontier then found the next step open and unheld, and started it.

That reads a close by hand as a verdict. It is not one. On 2026-08-30, `ivtrends` pull request #48 — a finished piece of work, verified, waiting to be read — was closed by GitHub because another pull request's body contained the words *"this does not fix #48"*. GitHub matches `fix` followed by a number and does not read the sentence around it. From the merge to a run nobody wanted, the whole sequence took 129 seconds:

| time (UTC) | what happened |
| --- | --- |
| 13:45:25 | pull request #49 merged |
| 13:45:26 | GitHub closed #48 |
| 13:46:08 | the daemon closed ticket #34, calling the work declined |
| 13:47:34 | the daemon picked up ticket #35 and began the next piece |

Nothing in that chain was a decision anybody made. Repairing it took reopening a pull request, reopening a ticket, cancelling a run, and stopping a container by hand because [the cancel could not be applied while the run was going](https://github.com/fvermaut/timone/issues/69).

A close by hand is ambiguous by nature. It can mean the work was wrong. It can mean somebody clicked the wrong button, or that a machine read a sentence as an instruction. The daemon cannot tell those apart, and it was choosing the most destructive reading of the three — and then acting on it twice, once by closing and once by advancing.

Alternatives considered:

- **Keep closing, and rely on the human to reopen.** This is what the old comment told them to do. Rejected: by the time anybody reads the comment the next step is already running, so the instruction arrives after the cost it was meant to prevent.
- **Ask before closing, and wait for an answer on the ticket.** Rejected as more machinery than the problem needs. The ticket staying open *is* the question; a second waiting state would need its own resume path and its own way of going stale.
- **Distinguish an accidental close from a deliberate one.** Rejected: nothing in the forge records intent. GitHub reports the same event for both, so any rule would be guessing.

## Decision

**D1 — A pull request closed without merging does not close its ticket.** The ticket stays open. The run itself still ends: `store.complete` runs before this branch either way, the project is freed, and anything queued behind it is promoted. What ends is the run, not the ticket's life.

**D2 — The ticket gains the hold, and the hold is what stops everything else.** `timone:held` is applied — after `ensureLabel`, never applied and hoped for. A held step is not the frontier (`nextStep` skips it), so no successor starts. Nothing here removes a hold: taking it off is the human's half of the rule (ADR-0044 D7).

**D3 — The registration loop passes over any held ticket, not only a held step.** Without this, a held ticket that is nobody's step — a chore, anything run by hand — would be registered afresh on the next cycle and rebuilt, which is the loop that closing the ticket used to prevent. The hold now means one thing everywhere: *do not pick this up*.

**D4 — The comment asks, and names all three ways out.** Reopen the pull request if the close was a mistake; close the ticket if the work is not wanted; remove the hold label to have the work done again from scratch. It says plainly that nothing is running and that the branch is untouched. It no longer claims the work was declined, because nobody said so.

## Consequences

**A ticket whose pull request was closed sits open until a person acts.** That is the point, and it is also the cost: the tracker will carry open held tickets that nothing is working. They are visible, they say what they need, and an initiative with one of them makes no further progress until it is answered — which is the correct behaviour when the last thing that happened cannot be interpreted.

**Deliberately rejecting work now takes two actions instead of one:** close the pull request, then close the ticket. The comment says so. One extra click is the price of not treating every accidental close as a decision.

**The old behaviour is recoverable from git if this proves wrong.** It was four lines.
