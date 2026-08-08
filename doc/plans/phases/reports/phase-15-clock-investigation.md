# Phase 15 — 15a: what the two clocks measure

> Closes [sub-phase 15a](../phase-15.md) of phase 15. **A finding, not a fix.** The mechanism is established and the options for phase 16 are stated with their trade-offs; **none is chosen** — that is `timone-adr`'s to record and fvermaut's to approve.

## The answer

**There are two clocks and they measure different things.**

- **The daemon's tick** computes elapsed as `Date.now() - startedAt` ([`progress.ts:163`](../../../../src/daemon/progress.ts)) — **wall clock, which advances while the machine is suspended.**
- **The SDK's `duration_ms`** — the number the closing line reports — **excludes suspended time.**

They agree exactly on a machine that stays awake, and diverge by precisely the suspended time on one that does not. That is the whole of the R17 clock defect, and it is also the cause of the R18 hazard.

## The decisive evidence is the operating system's own record

The strongest evidence needs no experiment at all: **macOS logs every sleep, and the pattern matches the tick pattern exactly.**

`pmset -g log` over 2026-08-07→08 — the window in which #13's planning session produced the 13× divergence:

| | |
| --- | --- |
| sleep events | **146** |
| median duration | **889s** (14m49s) |
| maximum | **932s** (15m32s) |
| **exceeding the 2-minute staleness threshold** | **113 of 146** |
| total time suspended | **23h** |

The machine runs **`Maintenance Sleep` on a ~15m49s cycle**: it sleeps for ~904s and wakes for ~45s, over and over, all night. The gate report described the tick pattern independently, before any of this was looked at, as *"pairs of ticks 30 seconds apart, separated by gaps of ~15m15s, ~15m33s, ~15m28s, ~15m."* **That is the same cycle, seen from the other side** — the tick fires once or twice in each brief wake window and cannot fire at all in between.

**And the arithmetic closes it.** At ~45s awake per ~15m49s cycle, a session spanning **4h13m** of wall clock is awake for roughly **19 minutes**. That session's `duration_ms` was **19m30s**. The SDK's number is not wrong and it is not a different unit — **it is the session's awake time**, and the tick's number is its wall-clock time.

## The instrument that failed, and why it is recorded

The first instrument was a **`SIGSTOP` of the whole process tree** — freeze parent and child, hold, `SIGCONT`, compare. It was chosen because it needs no real suspend, and it was verified before its output was believed: both processes were confirmed in state `T`, and it reproduced the defect's tick signature exactly — **one tick where eighteen should have fired**, a 92-second gap in a 5-second cadence.

Its result was that **`duration_ms` (93,648ms) tracked wall clock (94,805ms) straight through the freeze** — which reads as a clean refutation of the sleep hypothesis, and would have gone into the record as one.

**It is not a refutation, because the instrument cannot see the axis in question.** `SIGSTOP` stops a process being *scheduled*; it does not stop the system counters. `mach_absolute_time` advances across a `SIGSTOP` and historically stops across a system sleep, so a freeze test cannot tell a sleep-excluding clock from a sleep-including one — the two behave identically under it. **The correct conclusion from the freeze is about the tick, not the SDK:** it independently confirms that `setInterval` does not fire while the process is not running, and that wall-clock elapsed keeps advancing across it.

This is [the habit phase 14 earned](phase-14-complete.md) firing a second time, and it is recorded because the false negative was entirely convincing: verified instrument, clean numbers, wrong question.

**A second measurement narrowly avoided the same trap.** Node's own monotonic clock (`process.hrtime.bigint()`) was compared against wall-clock time since boot and agreed to within an hour over 658 hours — suggesting monotonic timing includes suspended time. It does, *in Node*; but `duration_ms` is not computed in Node. It comes from the SDK's compiled `darwin-arm64` binary, a different runtime with its own clock. macOS exposes both counters and they differ substantially on this machine — `kern.monotonicclock_usecs` reports two values in a **2.36× ratio**. A sleep-excluding clock exists, is available, and diverges by roughly what is observed.

## A second finding, unlooked for

**`duration_ms` and `duration_api_ms` are distinct fields and are not nested totals.** `SDKResultMessage` carries both; the daemon reads only `duration_ms`. On the control run `duration_api_ms` (**6,834ms**) was *larger* than `duration_ms` (**5,873ms**) — so `duration_api_ms` is not a subset of the session's duration and cannot be treated as "the API part of the total". Whatever phase 16 does, it should not assume one bounds the other.

## What this settles, and what it does not

**Settled — and note the first item needs none of the SDK-clock reasoning:**

- **R18's hazard is confirmed outright.** ADR-0017 stamps `heartbeatAt` only when the tick fires, and staleness is four intervals — 120 seconds. The OS log shows **113 suspensions longer than that in a single overnight window.** A continuously running daemon would have reclaimed healthy runs on every one of them. This rests on the OS log and the freeze test, both of which are direct measurements of the tick; it does not depend on what the SDK's clock does.
- **The tick's elapsed time is wall clock and the SDK's is awake time.** The `pmset` cadence matches the observed tick pattern, and the awake-time arithmetic matches `duration_ms` to within a minute on the session with the largest divergence.
- **The two are one mechanism, as the gate suspected** — but not in the way it guessed. It is not that the tick's arithmetic is wrong; both numbers are correct measurements of different quantities, presented under one name.

**Not settled:**

- **The frozen token counter is still unexplained.** #13's planning session held at 4.7k output tokens for four hours while its replies counter advanced 8→22 — fourteen main-thread messages carrying no measurable output. Suspension is a plausible cause (a dropped connection on wake, with `includePartialMessages` stream events not replayed while final `assistant` messages are) but **nothing here measures it**, and the two halves should no longer be assumed to share a fix simply because they share a cause. The clock half is now explained without reference to the token half.
- **The exact clock the SDK binary calls** was not read out of the binary. The mechanism is established from behaviour and the OS log rather than from source.

## Options for phase 16 — stated, not chosen

Each changes what [ADR-0017](../../../adr/0017-a-runs-liveness-is-its-heartbeat.md) means by *a run's liveness is its heartbeat*, which is why this document stops here.

| option | what it fixes | what it costs |
| --- | --- | --- |
| **Report both numbers** — tick shows wall clock, closing line keeps `duration_ms`, each labelled | The two-dialects problem, honestly: nothing is hidden and no clock is chosen | Does nothing for R18 — the heartbeat still misses ticks while suspended |
| **Tick from a sleep-excluding clock** so both numbers agree | The display divergence | **Makes R18 worse.** A monotonic heartbeat would show a suspended run as recently alive, which is true of the process and false of the wall clock the poll loop compares against |
| **Wake-aware staleness** — the poll loop consults the OS's sleep record and discounts suspended time before judging a run stale | R18 directly, and leaves R17 a display question | Platform-specific; puts an OS dependency into the reclaim path |
| **Stamp `heartbeatAt` on message arrival** rather than on the timer | R18 without a clock at all — a run that is producing messages is alive by definition | Separates the tick's two jobs, which ADR-0017 deliberately joined; a genuinely quiet-but-healthy stage would stop stamping |
| **Raise the threshold** past the longest expected suspension | Nothing, honestly — the observed maximum is 932s and a longer sleep is always possible | Delays every real reclaim by the same amount; trades a false positive for a slow true positive |

**Whatever lands must come with R18's middle criterion reworded** (15d), in terms that say *healthy runs are never reclaimed* without presupposing the mechanism — the current wording lets the sleep case slip through its own precondition.

## The instrument, kept

The probe and the freeze harness are in the session scratchpad rather than the repository: they carry a hardcoded absolute path to the SDK and a hardcoded model, and they cost money to run. What is worth keeping is the method, and it is recorded above — **the OS's own sleep log is a better instrument than any experiment**, it is free, it needs no suspend, and it was the only one of the three that could actually see the phenomenon.
