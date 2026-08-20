# ADR-0029: A chunk advances only on success

- **Status:** superseded by [ADR-0040](0040-one-step-is-one-ticket-and-doneness-is-a-fact-about-a-ticket.md)
- **Date:** 2026-08-15
- **Source:** fvermaut's ruling of 2026-08-15, put to him as the hazard slice 22a's handoff flagged: *a failed chunk keeps holding its ticket until it is retried or cancelled*
- **Extends:** [ADR-0026](0026-a-ticket-is-a-conversation-a-run-is-a-chunk.md), which made one ticket host a sequence of chunks without saying what moves a ticket from one chunk to the next
- **Supersedes:** nothing

## Context

[ADR-0026](0026-a-ticket-is-a-conversation-a-run-is-a-chunk.md) split the ticket from the run: a ticket is a durable conversation, a run is one chunk of work with its own branch and its own pull request, and one ticket hosts a sequence of chunks. [ADR-0028](0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md) then said where the *list* of chunks lives — a committed breakdown, not a ledger field.

Neither said **what makes the ticket move on**. Phase 22a had to pick something to build, and picked the ledger's existing idea of an ended run: `TERMINAL`, which is `done` and `failed`. `register` became idempotent on the ticket's chunk that was not terminal, so a ticket whose only chunk had ended in either state opened the next sequence number.

The build surfaced what that costs. **The poll loop calls `register` for every marked ticket on every cycle.** With `failed` counting as ended, the cycle after a chunk fails opens chunk *N+1* beside the failure. The project's one-session guard then belongs to the new chunk, and `timone retry <project>#<ticket>` — which re-arms the *failed* chunk in place, keeping its branch, stage and pull request — is refused. The observable symptom is a ticket that quietly grows a chunk a minute after a failure, and a retry command that has stopped working.

That is not a bug in `register`; it is an unmade decision about what a failure means to a ticket. The question was put to fvermaut and he ruled.

**Alternatives considered:**

- **The ticket moves on after a failure** (what 22a built). Cheapest — the ledger already has `TERMINAL` and no second concept is needed — and it has an honest reading: a chunk that died is over, and the initiative should not stall on it. **Rejected for what it costs:** it deletes `timone retry`. Recovery would have to become "abandon the dead chunk and rebuild the same work as chunk *N+1*", which throws away the branch, the stage and the pull request the failed attempt had already earned, re-does work the human may already have reviewed, and leaves the thread reading as though the initiative had five pieces when it had four and one crash. It also makes the failure invisible in the shape of the ticket: the chunk list stops describing the plan and starts describing the machine's bad days.
- **Keep the automatic succession and let `retry` displace the chunk opened over it.** Rejected: it makes the retry path a race against the poll loop it is trying to undo, and every retry becomes a two-step mutation of the ledger where one used to do.
- **A chunk advances only on success** (chosen).

## Decision

**A chunk advances only on success. A ticket moves to its next chunk when the current one is *settled*, and only `done` settles a chunk.**

- **What advancing means.** A ticket's chunks are a sequence, numbered from 1. *Advancing* is `register` opening the next sequence number for that ticket rather than handing back the chunk already open. Until the current chunk settles, every `register` on the ticket returns that chunk with `created: false` — which is exactly what makes the poll loop's per-cycle registration harmless.
- **`done` settles a chunk. `failed` does not.** A failed chunk is still its ticket's current business: it is what `timone retry` re-arms, in place, at the stage it died. **`cancelled` will settle a chunk too, when slice 22b introduces it** — an abandoned chunk is settled because nobody is going to retry it. Those two are the only ways a ticket is finished with a chunk: it succeeded, or it was called off.
- **Settledness is not `TERMINAL`, and `TERMINAL` is deliberately unchanged.** `TERMINAL` remains `["done", "failed"]` and keeps its one job: a run in it stops holding its project, so the next queued ticket is promoted. **A failed run must still free the project** — a dead session cannot freeze a project behind it, and a one-line bug filed elsewhere must not wait for a human to notice a crash. The two ideas answer different questions about the same status: `TERMINAL` asks *"is this run's hold on the project over?"*, settledness asks *"is this run's ticket finished with it?"*. `failed` answers yes to the first and no to the second, which is the whole of why they cannot be one predicate.

## Consequences

- **`timone retry <project>#<ticket>` keeps working exactly as it reads.** That is the point of the ruling. The ticket's most recent chunk after a failure is the failed one, so the command resolves to it, and no later chunk exists to be guarded against.
- **A failed chunk stalls its own ticket until a human acts.** This is accepted, and it is the trade the ruling makes: an initiative does not silently reorganise itself around a crash. The daemon already speaks about it — the failure call to action is rendered on the ticket, carrying the retry command — so the stall is visible rather than quiet.
- **`cancelled` acquires a second job before it exists.** Slice 22b's cancellation is not only "stop this chunk"; it is the *other* way a ticket gets past a chunk, and the only way past a failure the human does not want retried. It must therefore settle, or a ticket abandoned mid-failure would be unmovable.
- **The ledger carries two predicates over run status where it carried one**, and the next reader will assume the narrower one is a duplicate. It is commented at its definition for that reason. This is the cost of the distinction and it is paid in one file.
- **`seq` is still not an attempt count.** Retrying re-arms the same chunk and leaves `seq` alone: the same piece of work built again is the same piece of work. This decision reinforces that — a failure produces no new sequence number at all.
- **What does not change:** the project lock and its promotion rule, [ADR-0026](0026-a-ticket-is-a-conversation-a-run-is-a-chunk.md)'s one-chunk-holds-the-project rule, [ADR-0028](0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md)'s breakdown, and the human-facing vocabulary — a person still names a ticket, never a sequence.
