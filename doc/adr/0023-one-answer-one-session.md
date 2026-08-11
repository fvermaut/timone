# ADR-0023: One answer, one session

- **Status:** accepted
- **Date:** 2026-08-11
- **Source:** fvermaut's ruling of 2026-08-11 on the two failures found at [phase 18](../plans/phases/phase-18.md)'s stage-7 pass, from four options laid out with their trade-offs
- **Extends:** [ADR-0022](0022-a-conversation-ticket-can-be-answered-in-writing.md), whose written path this makes safe to use; [ADR-0020](0020-liveness-is-judged-only-over-witnessed-time.md), whose "two-daemon ledger hazard" this closes and which [phase 17](../plans/phases/phase-17.md) deliberately left open

## Context

[ADR-0022](0022-a-conversation-ticket-can-be-answered-in-writing.md) gave a waiting ticket a second answer path: the human writes their answer in the thread and the daemon picks it up. [Phase 18](../plans/phases/phase-18.md) built it. The stage-7 pass of 2026-08-11 ([report](../plans/phases/reports/phase-18-verification.md)) found that **one written answer reproducibly spawns two agent sessions**, ~30s apart, each working the question out from scratch, each posting a full `✅ Agreed` resolution, each closing the ticket — reproduced 2 of 2 on `scratch-app` #21 and #22, with distinct session ids in the daemon's log and in the ledger, and both cycles ending on `Run … cannot go from done to done`.

Both times the two answers happened to agree. That is luck. The clause exists so that a human who answers in writing is answered once; two sessions can reach two conclusions and write both down as settled, leaving the human to arbitrate — on `ivtrends`, on a real product decision.

**The mechanism, traced 2026-08-11 rather than inferred.** Three faults stack, and no single one of them is sufficient:

1. **Nothing enforces one writer.** There is no lock file and no PID file anywhere in `src/`. `RunStore.open` (`src/daemon/runs.ts:281`) reads the state file; `persist` (`:771`) is atomic per write, but every mutation is a read-modify-write, and `refresh`'s own docblock (`:686`) says in as many words that two writers of the same field still race. Two `timone daemon` processes, or a second `daemon --once` typed while the first is still blocked inside a session, both act on the same parked run.
2. **The claim is written after the work starts, not before.** On the resume path `runStage` builds the prompt and calls `runtime.start` (`src/daemon/session.ts:554`) — which awaits the session's first message — and only then calls `store.activate` (`:563`). `setStage` (`:465`) writes the stage without touching status. So from the decision to resume until `:563`, the ledger on disk still advertises the run as `parked` with an unanswered cursor, while a real session is already running and being billed.
3. **The guards answer from memory.** `occupyingRun`, `runningRun` and `parkedRuns` (`runs.ts:309,321,330`) never refresh from disk, so `resumeAnswered`'s guards (`src/daemon/poll.ts:639,642`) cannot see another process's claim even after it is written. The only true mutual exclusion is inside `transition` (`runs.ts:725`), which fires *after* the duplicate session exists and has been paid for.

**And one path needs no concurrency at all.** When a resumed conversation session posts no machine comment, `afterConversation` reparks with `waitCursorFrom(ticket)` (`session.ts:925`), which resolves to the *previous* invitation — still before the human's answer — so the next cycle picks the same comment up again. A single daemon, alone, re-fires.

**The safeguard the machine described to the human does not exist in the machine.** `timone-wayfind`'s claim rule (`SKILL.md:133` — "assign the ticket to yourself before any work; the assignee *is* the claim") is a rule for a session choosing from a frontier. A daemon-spawned session is handed one named ticket and never runs that check; the daemon does not fetch the assignee field at all (`src/adapters/github-tickets.ts:88`); and both sessions post as `fvermaut`, so "assigned to yourself" cannot distinguish them. It could not have arbitrated this and must not be cited as though it might.

**Alternatives considered:**

- **The lock alone.** Smallest change, removes the only thing currently able to trip faults 2 and 3, and would have made the reproduction stop. Rejected as the whole answer: it leaves two real faults in place behind a single door, including the single-process re-fire, which returns later looking like a new bug.
- **Claim-before-spawn alone.** Narrows the window from minutes to one file write. Rejected alone: two processes writing one JSON file is still a race in principle, so the fix would rest on a window rather than on a rule.
- **Consume-on-read alone.** Makes pickup idempotent regardless of process count and is the only one of the three that fixes the single-process re-fire. Rejected alone: it makes *this* wait idempotent while leaving the ledger unprotected for every other transition.
- **Teach the daemon to read the ticket's assignee** and arbitrate as the skill does. Rejected: it cannot arbitrate while every comment posts under one account, so it waits on the bot identity, which is separately tracked and needs a credential.
- **All three, layered** (chosen).

## Decision

**No two sessions may act on one answer.** Three mechanisms, at three different layers, none of them load-bearing alone.

- **One writer, enforced rather than assumed.** The state file gains an exclusive lock, taken by any process that mutates it. A second watcher refuses to start and says so in one plain sentence naming the holder — a refusal, never a silent wait or a second copy. **This binds `takeover` and `retry` as well as `daemon`**, because they spawn sessions too and were racing the daemon by the same three faults.
- **A run is claimed before its session exists.** The `parked → active` transition moves ahead of `runtime.start`. If the spawn then fails, the claim is released as part of the same failure path — a claim that outlives its session is the stuck-run fault [phase 14](../plans/phases/phase-14.md) closed, and reintroducing it is the specific way this decision can go wrong.
- **The guards read the file, not their memory.** The accessors the poll loop guards on refresh before answering. This is what makes the claim above mean anything across processes.
- **An answer is consumed at the moment it is read.** Deciding to resume on a written answer advances the wait cursor as part of that decision, so a second reader finds nothing outstanding. **The answer itself is never destroyed** — it is a comment on the ticket, permanent and public; only the machine's marker moves. **`timone retry` rewinds the marker** to before the answer, which is the route back when a session dies holding one.
- **What the human reads is unchanged.** None of this alters what a ticket says, what a resolution looks like, or either answer path. It is a decision about who is allowed to act, not about what the human does.

## Consequences

- **`daemon --once` becomes refusable, and that is the point.** Every gate and every live pass drives the daemon that way; from now on a second one, typed while the first is still inside a session, is turned away with the holder named. The operator loses a habit that was producing duplicate work and gains an error message that explains itself. **Tests that drive `pollOnce` directly are unaffected** — the lock is on the process, not on the function.
- **A crashed process must not leave the door locked.** A lock is a new way to wedge a project, which is the fault [phase 14](../plans/phases/phase-14.md) existed to remove. The lock must be reclaimable on the same evidence [ADR-0020](0020-liveness-is-judged-only-over-witnessed-time.md) already established — and it may not be reclaimed on witness the daemon cannot vouch for, or a sleeping laptop starts breaking locks.
- **Consuming an answer creates a window where it is read and not yet acted on.** If the session dies there, the ticket looks answered and nothing is working on it. The reclaim path reports it as it reports any stopped run, and `timone retry` rewinds. **This trades a silent double-answer for a visible stall**, deliberately: the human sees a stall, and does not see a contradiction.
- **PRD-02.R3's failing clause closes on this, and R20's clause 3 with it** — they failed on one defect. **R20's clause 2 is untouched and remains fvermaut's ruling to make**: the register requires `takeover` to resolve a wayfinder ticket from the tracker, and the build refuses by deliberate design.
- **The written path stays unsafe to use on `ivtrends` until this is built and its gate passes.** [STATUS.md](../../STATUS.md)'s instruction — talk the six open questions through rather than writing on the ticket — stands until then and is lifted by evidence, not by a merge.
- **The one judgement no pass has witnessed becomes obtainable, and it is obtained on the fixture.** Every written answer tested so far was typed by a machine in the human's voice. Whether a *person* finds the clarifying question reasonable and the escalation timed right is what this phase's gate is for — and **it closes because the person is real, not because the ticket is.** An earlier draft sited it on a live `ivtrends` question because six already existed and were therefore free; fvermaut rejected that on 2026-08-11, and the reasoning is recorded here because "it is free there" is the standing argument for polluting a real tracker. A fixture question fvermaut genuinely answers is full evidence.
- **Phase 17's deferred hazard is discharged.** [Phase 17](../plans/phases/phase-17.md) named the two-daemon ledger hazard as explicitly not closed, and noted that its own witness fields were two more things two daemons would clobber. They are covered by the same lock.
