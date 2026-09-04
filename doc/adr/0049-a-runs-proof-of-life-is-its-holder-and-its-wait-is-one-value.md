# ADR-0049: A run's proof of life is its holder, and its wait is one value

- **Status:** accepted
- **Date:** 2026-09-04
- **Source:** the grooming of 2026-09-03, which read all forty open issues at once. Seven of them are one fault: [timone#78](https://github.com/fvermaut/timone/issues/78), [#76](https://github.com/fvermaut/timone/issues/76), [#75](https://github.com/fvermaut/timone/issues/75), [#63](https://github.com/fvermaut/timone/issues/63), [#27](https://github.com/fvermaut/timone/issues/27), [#12](https://github.com/fvermaut/timone/issues/12), [#11](https://github.com/fvermaut/timone/issues/11)
- **Extends:** [ADR-0025](0025-a-lock-holders-proof-of-life-is-its-process.md) — a lock already has a named holder and is judged by asking its process. This gives a run the same thing, for the same reason
- **Amends:** [ADR-0020](0020-liveness-is-judged-only-over-witnessed-time.md) for runs. Witnessed time stays the rule where no holder is recorded, which is every run written before this
- **Standing:** [ADR-0023](0023-one-answer-one-session.md), unchanged — the daemon is still the ledger's only writer

## Context

**The ledger already has a state machine, and it governs one field out of twenty.**

A run record carries `id`, `project`, `ticket`, `seq`, `status`, `stage`, `waitingOn`, `waitingKind`, `waitCursor`, `reAsksAfterAnswer`, `consumedAnswerAt`, `branch`, `pr`, `sessionId`, `heartbeatAt`, `failure`, `cancellation`, `flags`, `createdAt`, `updatedAt`. Only `status` has a `TRANSITIONS` table, and that table is good: every move is checked and the reasoning is written down beside it.

The other nineteen fields are set and cleared by whichever method happens to touch them. Several exist only because a bug needed somewhere to live. `consumedAnswerAt` was added because `waitCursor` could not carry a fact and a retry re-asked a question the human had already answered. `reAsksAfterAnswer` was added because the ticket's wording needed a number. Their comments are incident reports.

**Two things are missing outright.**

*A run has no holder.* [#78](https://github.com/fvermaut/timone/issues/78) says it in one line: *"a claim records no owner"*. `RunStore.claim` writes `active` and nothing about who asked. So a second `timone takeover` is refused with a sentence about work nobody is doing, and the only thing that ends a claim nobody holds is the dead-run sweep two minutes later.

The lock beside it does not have this problem. `.timone/state.json.lock` holds a token, a command, a pid, a since and an observedAt, and ADR-0025 judges the holder by asking whether that process is alive. The shape is proven and it is one file away.

*A wait does not say what can resolve it.* [#76](https://github.com/fvermaut/timone/issues/76) is a run parked with a `conversation` wait at `execution`, whose own wait is `none`. Nothing can ever answer it. `ivtrends` #58 sat finished, pushed and unreachable, and the ticket asked the human for an answer no answer would satisfy. `handBack` writes `kind: "conversation"` whatever stage it is at, so every work stage can reach the same dead end.

**What it costs, in observed runs.** `daemon.log` covers twelve sessions and $185.40. One step ticket, `ivtrends#24`, took nine of those sessions and $131.82, with three handbacks. Each of the seven issues above ends the same way in the record: the human fixes it by hand and pays for a stage to run a second time.

**Liveness is guessed from a clock.** The sweep judges a run by the later of `heartbeatAt` and `updatedAt`. [#75](https://github.com/fvermaut/timone/issues/75) shows what that buys: a spawn the daemon refused eighty times kept stamping `updatedAt`, so the run looked alive because the daemon kept failing to start it — 83 minutes against a two-minute threshold. When it was finally reclaimed the ticket was told *"the machine running it stopped before the work was finished"*. Nothing had stopped.

## Alternatives considered

**Fix the seven one at a time.** This is what has been happening, and it is what produced nineteen ungoverned fields: a new bug adds a field rather than a transition. Rejected because the next combination nobody enumerated is already being written.

**Make the whole record a discriminated union**, so `waitCursor` on a running run does not compile. Strongest, and genuinely the right end state. Rejected for now: every reader in `poll.ts`, `session.ts`, `status.ts` and `takeover.ts` changes at once, while the machine is in daily use building a client project. Decided by fvermaut on 2026-09-04 over this and over the holder-only option.

**Holder only**, leaving the wait fields alone. Rejected because it fixes four of the seven and leaves [#76](https://github.com/fvermaut/timone/issues/76) and [#27](https://github.com/fvermaut/timone/issues/27) to be patched separately — which is the habit this ADR exists to stop.

## Decision

### D1 — A run records its holder, in the lock's shape

A held run carries a holder: a token for this particular hold, the command that took it (`timone daemon` or `timone takeover`), the process id, when it was taken, and when it last showed it was there. This is `LockHolder`'s shape and it is deliberately the same one, so there is a single idea of what holding something means.

A run with no holder is not held. That is a legitimate state — queued, parked, or finished — and it is also what every run written before this ADR looks like.

### D2 — Liveness is a question about the holder's process, not about a clock

The dead-run sweep asks whether the holder's process is alive, as `acquireStateLock` already does. A live holder is never reclaimed, however quiet it is. This is ADR-0025's argument applied where it was always needed: `heartbeatAt` and `updatedAt` measure whether something wrote recently, which is a different question from whether anybody is there.

**ADR-0020 still binds where there is no holder.** A run with no holder record is judged by witnessed time exactly as today, so a laptop that slept still cannot throw away healthy work.

### D3 — A holder that gives up withdraws its claim

`timone takeover` waits a bounded time for the daemon to hand the run over. When that bound passes it must remove its own request before it exits. Today it leaves the file on disk, the daemon applies it minutes later, and the run is handed to a terminal that has gone — which is [#78](https://github.com/fvermaut/timone/issues/78)'s first half, and the reason a ticket then answers with a refusal that is not true.

The bound itself is also wrong and is corrected with it: the daemon sleeps its poll interval **after** a cycle, so a request left just after one cycle read the queue waits the rest of that cycle plus a full interval. The bound must cover that, or say honestly that it cannot.

### D4 — A dead holder is re-armed once, then parks

A run whose holder's process is provably gone is re-armed at the stage it died in and allowed to go again. If the second attempt also dies, it parks on the human carrying both reasons.

This follows [ADR-0034](0034-a-technical-stop-is-retried-not-reported.md): a machine that broke is not the ticket's business while the machine still has a way through. Terminal `failed` on the first death is what makes [#27](https://github.com/fvermaut/timone/issues/27), [#63](https://github.com/fvermaut/timone/issues/63) and [#78](https://github.com/fvermaut/timone/issues/78) each end in a hand fix.

**A refusal is not a death, and must not be reported as one.** A spawn the daemon cannot satisfy — a missing workspace, a stage with no prompt — is bounded separately: after N consecutive refusals of the same run for the same reason it is said where a human can see it, with the reason that actually happened. `reclaimedReason()` may not be used for it.

### D5 — The five wait fields become one value, and it names what can resolve it

`waitingOn`, `waitingKind`, `waitCursor`, `reAsksAfterAnswer` and `consumedAnswerAt` collapse into a single optional `wait`:

```
wait?: {
  kind: "conversation" | "escalation" | "review",
  opened: string,
  answerConsumed?: string,
  reAsks: number,
  resolvableBy: PipelineStage[],
}
```

`resolvableBy` is the new part and it is what [#76](https://github.com/fvermaut/timone/issues/76) needs: the wait carries the stages that can end it, rather than the reader deriving that from a table the writer never consulted.

### D6 — A wait no stage can resolve cannot be written

`handBack` must name a stage that appears in `resolvableBy`, and the store refuses a `wait` whose `resolvableBy` is empty. The dead end in [#76](https://github.com/fvermaut/timone/issues/76) stops being reachable rather than being detected.

**A takeover that finishes the step it took over reads what it recorded.** Ending a takeover consults the ticket from the claim's cursor, the same way the spawner does, instead of restoring the old wait blindly. A takeover that changes nothing in the ledger says so at the terminal rather than ending silently.

### D7 — A broken run is answerable on the ticket

A run that failed carries a wait like any other, so an answer written on the ticket re-arms it. This is what [#27](https://github.com/fvermaut/timone/issues/27) asks for and it removes the standing lie: three places tell the human to re-mark a broken ticket, and re-marking a broken ticket does nothing. Until D7 is built, those sentences say what is true instead.

## Consequences

**Four fields go and one arrives, and the record gets smaller.** Twenty fields become sixteen. Every reader of `run.waitCursor`, `run.waitingKind`, `run.waitingOn`, `run.reAsksAfterAnswer` and `run.consumedAnswerAt` changes — `poll.ts`, `session.ts`, `status.ts`, `takeover.ts`, `cta.ts` and `retry.ts`. Old ledgers are normalised on load, as `normaliseSequences` already does for `seq`.

**A run can now be held by something that is not a daemon session**, and that is the point. `timone takeover` becomes a first-class holder rather than a claim that borrows `active` and hopes.

**Liveness stops being free.** Asking whether a pid is alive is a syscall per stale candidate rather than a comparison, and it is wrong across machines — a holder on another host cannot be asked. Timone runs one daemon on one machine, which is why ADR-0025 could make the same trade for locks. If that ever stops being true, this is the decision to revisit.

**Re-arming once costs money that failing did not.** A run that died with nothing worth saving is now paid for twice before it reaches the human. Accepted deliberately: the alternative is what happens today, where every death costs a `timone retry` and a second run anyway, plus the human's attention to type it.

**This does not touch the criteria register.** [#62](https://github.com/fvermaut/timone/issues/62) — a requirement whose code was deliberately removed reading `failed`, with no way back — is a different artifact and needs its own decision. It stays open and is not covered here.
