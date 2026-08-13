# ADR-0025: A lock holder's proof of life is its process, not its witnessed time

- **Status:** accepted
- **Date:** 2026-08-13
- **Source:** fvermaut's ruling of 2026-08-13, taken mid-execution of [phase 19](../plans/phases/phase-19.md)'s sub-phase 19a, from three options laid out with their trade-offs
- **Amends:** [ADR-0023](0023-one-answer-one-session.md), whose "the lock is reclaimable on ADR-0020's evidence and no other" this replaces for the ledger lock alone
- **Bounds:** [ADR-0020](0020-liveness-is-judged-only-over-witnessed-time.md), which continues to govern **runs** unchanged and is no longer applied to the lock

## Context

[ADR-0023](0023-one-answer-one-session.md) gave the run ledger an exclusive lock and required that a crashed holder's lock be reclaimable "on the same evidence [ADR-0020](0020-liveness-is-judged-only-over-witnessed-time.md) already established — and it may not be reclaimed on witness the daemon cannot vouch for." [Phase 19](../plans/phases/phase-19.md)'s 19a built exactly that, and the build is what exposed the flaw: **ADR-0020's witness is not evidence a process can consult. It is evidence a process creates by writing.** `RunStore.witness` (`src/daemon/runs.ts:586`) ends in `this.persist()`.

Two consequences follow, both reproduced at the real defaults (60s poll interval, 2m staleness window) rather than reasoned about:

1. **A refused process writes to the ledger it was just refused.** Computing the witness needed to *ask for* the lock mutates `state.json` — the one file the lock exists to give a single writer.
2. **Repeated refusals manufacture the entitlement to break a live holder's lock.** The holding daemon stamps its liveness once per cycle, *after* `pollOnce` returns, so a daemon inside a session goes quiet for the session's whole length. A rival accumulates a continuous watch on every refused start:

```
10:00:00  holder acquires (pid 111), enters a session
10:00:30  rival mayJudge=false  watchedMs=30000   refused   lockPid=111
10:01:30  rival mayJudge=false  watchedMs=90000   refused   lockPid=111
10:02:30  rival mayJudge=true   watchedMs=150000  ACQUIRED  lockPid=222
```

Three `daemon --once` invocations a minute apart, and there are two writers on the ledger — which is the fault phase 19 exists to remove. [19e](../plans/phases/phase-19.md)'s step 2 runs precisely this scenario, so the live gate would have produced the original defect rather than caught it.

**The deeper error was applying ADR-0020's question to the wrong subject.** That ADR exists because a suspended laptop silences a run and its judge in the same breath, making *elapsed time* unreliable evidence about a run. The reasoning is sound and unchanged. But a lock holder is not a run: a suspended process still **exists**, and existence is not something sleep distorts. Asking "has enough witnessed time passed?" about a process is answering a question nobody needed to ask.

**Alternatives considered:**

- **Keep ADR-0020's witnessed time, and fix it in two places** — give the holder a keep-alive timer independent of its poll cycle so a daemon inside a session is never stale, and stop a refused process from stamping the shared witness. Consistent with [phase 17](../plans/phases/phase-17.md), and the smaller conceptual change. Rejected: a `daemon --once` run witnesses nothing *by construction*, so it could never reclaim, and a crashed daemon's lock would be recoverable only by a persistent daemon left running for the full window. Every live gate to date is driven with `--once`; the rule would have removed the route out to buy a property the process check gives for free.
- **No automatic reclaim at all** — a wedged lock cleared by an operator running `timone unlock`, which names the holder and asks for confirmation. Zero risk of two writers, ever. Rejected: it reintroduces the class of fault [phase 14](../plans/phases/phase-14.md) existed to remove, where a crashed process leaves a project stuck until a human notices.
- **The holder's process is the evidence** (chosen).

## Decision

**A lock holder is alive if and only if its process is.** The ledger lock is reclaimed when it has gone quiet past the staleness window **and** the process it names is gone. ADR-0020's witness is not consulted, not stamped, and not required on any path through lock acquisition.

- **The quiet window stays, as a cheap first filter** — a holder that touched its lock moments ago is not probed at all. It is no longer the *authority*; a stale lock whose process is alive is refused, and says so.
- **Identity is the pid together with what the lock records about the hold** — its `command` and its `since`. A pid alone is reusable; a pid that is running a different command, or one that started after the lock was taken, is not the holder.
- **`ADR-0020` is untouched for runs.** Judging a *run* dead still requires witnessed time, for exactly the reason phase 17 established. This ADR narrows where that rule is applied, and reverses none of it.
- **The lock is explicitly single-host**, which it already was — the lock file sits beside `state.json` on one laptop. Making the assumption explicit is a cost accepted, not a new constraint introduced.

## Consequences

- **The sleeping-laptop inversion stops being a hazard and becomes a non-question.** A suspended holder's process still exists, so it reads as alive and its lock is refused — the correct answer, reached without any reasoning about time.
- **`daemon --once` recovers a wedged project again**, which the witnessed-time rule would have taken away. This matters beyond convenience: it is how every live gate drives the daemon.
- **A refused process writes nothing.** Acquisition becomes a read plus, at most, an exclusive create — the refusal path no longer touches the ledger at all.
- **19a's committed shape changes and its seams change with it.** The reclaim tests move from "witness says the daemon may judge / a witness gap" to "the holder's process is gone / is alive". [Phase 19](../plans/phases/phase-19.md) is amended accordingly and returns to `Awaiting approval`, since the seams grew.
- **19e step 4 changes what it observes.** It becomes: kill the daemon holding the lock, confirm a fresh daemon reclaims and names whom it took it from; then confirm a *live* holder's lock is refused, which is now checkable directly instead of by manufacturing a witness gap.
- **Pid reuse is a residual risk, bounded rather than eliminated.** The OS would have to reissue the exact pid to a process whose recorded command matches, within the staleness window. Accepted; the alternative is a heartbeat file, which is the mechanism this ADR just removed for being more machinery than the question needs.
- **A cross-host lock would need a different mechanism.** Not a cost today — an always-on host is already recorded as out of scope in phase 19 — but it is the thing that would force this decision to be revisited.
