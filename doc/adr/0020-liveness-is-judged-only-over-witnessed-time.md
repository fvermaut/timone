# ADR-0020: Liveness is judged only over time a daemon witnessed

- **Status:** accepted
- **Date:** 2026-08-08
- **Source:** [phase 15's 15a finding](../plans/phases/reports/phase-15-clock-investigation.md), on the two defects [phase 14's live gate](../plans/phases/reports/phase-14-live-gate.md) left unrouted; supersedes [ADR-0017](0017-a-runs-liveness-is-its-heartbeat.md)

## Context

[ADR-0017](0017-a-runs-liveness-is-its-heartbeat.md) settled that a run proves itself alive by the progress ticker's stamp, and that a `heartbeatAt` older than four intervals is *evidence* its daemon died — as against the startup sweep's *assumption* that every `active` run is a corpse. That reasoning stands and is not what changed. What it did not anticipate is that **the tick can stop for a reason that has nothing to do with the run's health**, and that when it does, the silence is indistinguishable from a corpse's.

Phase 14's live gate measured the consequence; phase 15's 15a explained it. A `setInterval` cannot fire while its process is not being scheduled, and on a laptop running macOS `Maintenance Sleep` that is most of the night: `pmset -g log` over one overnight window records **146 suspensions, median 889s, and 113 of them longer than the 120-second staleness threshold**. The overnight planning session on `scratch-app` #13 crossed the threshold **17 times, once for 16 minutes**, while alive and producing work throughout. It survived only because the gate was driving `--once` cycles by hand and no poll loop ran beside it. Under a continuously running daemon, **a healthy run would have been killed and its branch abandoned seventeen times in one night** — the exact failure ADR-0017 exists to prevent, arriving through the mechanism ADR-0017 chose.

The same measurement explained the second defect, and the two are one finding. **There are two clocks.** The tick computes elapsed as `Date.now() - startedAt`, wall clock, which advances while the machine is suspended. The SDK's `duration_ms`, which the closing line reports, excludes suspended time. At ~45s awake per ~15m49s sleep cycle, that session's 4h13m of wall clock gives roughly 19 minutes awake, against a reported `duration_ms` of **19m30s**. Neither number is wrong and neither is a different unit. They are wall time and awake time, presented under one name.

The alternatives, all five stated in 15a and none chosen there because choosing was this record's job:

- **Raise the staleness threshold** past the longest expected suspension. Honest about nothing: the observed maximum is 932s and a closed lid sleeps for hours, so it does not close the hole — it only moves it, and it delays every *real* reclaim by the same amount. Trades a false positive for a slow true positive without eliminating either.
- **Tick from a sleep-excluding clock** so both numbers agree. This is a display change and only a display change: `heartbeatAt` is persisted and read by other processes, and a monotonic reading is meaningless outside the process that took it, so the ledger's clock cannot follow. It leaves R18 untouched while appearing to have addressed it — which is worse than leaving it visibly open. It also declares the SDK's clock the true one, and 15a established that clock's behaviour from observation rather than from source.
- **Stamp `heartbeatAt` on message arrival** rather than on the timer. Attractive — a run producing messages is alive by definition — but it splits the tick's two jobs that ADR-0017 deliberately joined, it makes a genuinely quiet-but-healthy stage look dead, and **it still races on wake**: the poll loop and the session resume together, and nothing guarantees the first post-sleep message beats the first post-sleep poll.
- **Wake-aware staleness** — the poll loop consults the operating system's sleep record and discounts suspended time. Directly correct on the machine that produced the evidence, and macOS-only: it puts a platform shell-out on the path that decides whether to destroy work.
- **The daemon witnessing its own absence** (chosen).

The deciding fact is that **the daemon is suspended by the same sleep that silences the run**. Its poll loop is a `setTimeout` in its own process, so the gap is measurable from inside without asking the operating system anything. ADR-0017's principle was that staleness must be evidence rather than assumption; the flaw was never the principle but an unstated premise underneath it — that somebody was listening for the whole interval. Nobody was, and the daemon can prove that about itself.

## Decision

**Staleness is judged only over time a daemon can vouch for having watched.**

- **The ledger records when a daemon last observed the world.** A poll cycle stamps `observedAt` on the state file. It is a property of the daemon's attention, not of any run, so it lives at the top level of the state alongside `runs` — optional, so existing state files load unchanged.
- **An unwitnessed gap suspends judgement rather than triggering it.** When the interval since `observedAt` far exceeds the poll interval, no daemon was watching across it: the machine slept, the process was starved, or the daemon was simply not running. Every `active` and `picked-up` run is granted one fresh staleness window, and **nothing is reclaimed on that cycle**. A run still silent when the next cycle finds the daemon demonstrably awake throughout is reclaimed exactly as it is today.
- **The heartbeat's meaning narrows and its mechanism does not.** The progress tick still stamps `heartbeatAt`, one tick still does two jobs, and `--progress-interval` still sets both cadences. What changes is the reading: a stale heartbeat is evidence of death **only when the observer was present to miss it**. Silence nobody was listening for is not evidence of anything.
- **The tick and the closing line each say which clock they mean.** The tick keeps wall clock and the closing line keeps `duration_ms`, and the two are labelled for what they measure. Both numbers are correct; the defect was the shared name. No clock is declared the true one, because 15a established neither is wrong — and on an overnight run, wall time is the number the human actually wants.
- **`duration_api_ms` is not read.** It is a distinct field and not a nested total — on a control run it *exceeded* `duration_ms` — so nothing may treat one as bounding the other.

## Consequences

- **R18's false-positive path closes without an operating-system dependency** and without a second clock. The reclaim path stays pure arithmetic over the ledger's own timestamps, which is what keeps it testable.
- **A genuinely dead run's reclaim is delayed by one staleness window after each wake or daemon restart** — about two minutes at the default interval. Accepted deliberately: the cost of a late reclaim is a project held two minutes longer, and the cost of an early one is a live agent's work destroyed. They are not comparable.
- **`observedAt` must be persisted, not held in memory.** Every live gate and every test drives `--once`, a fresh process per cycle; an in-memory witness would be absent in exactly the mode used to prove the behaviour, and the fix would be unverifiable where it matters most.
- **The daemon-restart case is now explicit rather than incidental.** A daemon starting after any long absence finds an ancient `observedAt` and grants the grace window before reclaiming. This is the right behaviour and it is also slower than the old one: a run genuinely orphaned by a crash waits one extra window. The startup sweep ADR-0017 rejected would have been faster and wrong for the same reason it was rejected then.
- **Two daemons remain unsafe, and this ADR narrows nothing there.** They still clobber each other's state last-write-wins, and `observedAt` is now one more field they can clobber — a second daemon's fresh stamp can mask a first daemon's absence. The hazard is unchanged in kind and stays open.
- **Reclaim is still not recovery.** ADR-0017's conservatism carries over intact: a reclaimed run is failed with a plain reason and `timone retry` is the way back. 15a sharpened rather than weakened the case for it.
- **The operational warning is lifted only when this lands and is gated.** Until then, `timone daemon` must not be left running unattended overnight on a laptop that sleeps.
- **The frozen token counter is untouched and stays open.** #13's session held at 4.7k output tokens for four hours with no sub-agents in play. 15a decoupled it from the clock deliberately; nothing here explains it, and nothing here should be read as having.
