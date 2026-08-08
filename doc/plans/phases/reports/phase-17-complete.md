# Phase 17 — completion report

> **[Phase 17](../phase-17.md), all four sub-phases.** Approved by fvermaut 2026-08-08; built and gated the same day, in the session immediately after phase 16 closed. Timone's own execution is hand-run — `/timone-execute` targets managed projects only.

## What closed

| ID | Status | What carried it |
| --- | --- | --- |
| PRD-02.R18 | **verified** | [17c's gate](phase-17-live-gate.md), evidence in both directions |
| PRD-02.R17 | **stays `draft`** | clock half fixed; **token half untouched and unexplained** |

**R17's outcome was written into the plan before the work started**, so it is not a disappointment discovered at the end. The plan said *"nobody should read this phase as closing R17 by fixing the clock alone"*, and it does not.

## The four sub-phases

**17a — the daemon judges only time it watched.** `stateSchema` gains optional top-level `observedAt` and `observingSince`; `version` stays `1` and every existing state file loads unchanged. `RunStore.witness()` runs once per cycle, before any project is looked at, and answers whether the daemon has been continuously present for at least as long as the staleness window it would judge. `reclaimStale` returns without touching anything when the answer is no. The unwitnessed threshold is twice the poll interval, which `commands/daemon.ts` now passes through rather than assuming.

**No run's `heartbeatAt` is written to grant the window.** That was the shortcut on offer and it is the one thing [ADR-0020](../../../adr/0020-liveness-is-judged-only-over-witnessed-time.md) forbids: the heartbeat is evidence, and rewriting it records a tick that never happened. A test asserts the reclaim path leaves it alone.

**17b — each clock says which one it is.** The tick prints `… elapsed`, the closing line `… working`. No arithmetic changed, and the duration shapes are pinned independently of the labels so a later slice that recomputed a duration would fail rather than drift. `duration_api_ms` is proven unread by a fixture that reports it *larger* than `duration_ms`.

**17c — the live gate.** [Its own report](phase-17-live-gate.md). Run autonomously at fvermaut's instruction after he pushed back on the gate as specified.

**17d — this report, the register, and STATUS.md.**

## What the phase did not build, and why the plan changed shape

**The gate as planned asked for the wrong thing, and the human said so.** It required scheduling an evening with fvermaut and a real pipeline run to put "real work in flight". His response — *"wtf man, this is overkill"* — was correct, and following the plan into it would have been the expensive kind of obedience.

**The load-bearing realisation: steps 1–3 read nothing but the ledger's own timestamps.** A seeded `active` run with a ticker stamping its heartbeat is indistinguishable, to the code under test, from a real session — because everything the reclaim path reads is in that record. So the whole R18 half of the gate cost nothing, needed no scheduling, and was run in twelve minutes. Only steps 4 and 5 genuinely need an agent session, and they are R17's, which was never closing here anyway.

**This is worth carrying forward as a planning lesson, not just an incident.** The plan bound an expensive precondition to a cheap test because it described the gate in terms of the *scenario* ("a real run in flight") rather than the *seam under test* ("the ledger's timestamps and the daemon's own cycle gaps"). A gate specified against the seam is usually far cheaper than one specified against the story, and no less honest.

## Defects found, and where

**Both were found by running the built binary, and neither was reachable by a test.**

1. **A log line that told an operator two different things in the same words.** Two `--once` cycles a tenth of a second apart printed *"nothing was watching for 0s"* — false twice over. Three distinct refusals had been collapsed into one message. Fixed in `3f7d7a7`; `Witness` now carries `watchedMs` and `unwitnessedGap`. **A line an operator knows to be nonsense is a line they stop reading**, and this is the line the gate turns on.
2. **The countdown looked stuck.** `1m` rendered for both 1m03s and 1m34s. Now `1m03s`, matching the progress line's own shape.

**Neither is a behaviour defect, and that is the point.** Every test asserted what the daemon *does*; both defects were in what it *says*. [Phase 16's fourth defect](phase-16-complete.md) was the same shape — a flag that reported success while doing nothing — and [15a's failed instrument](phase-15-clock-investigation.md) was the same shape again. **Three phases running, the thing the tests could not see was the thing a human would read.**

## Evidence, and what it does not cover

- **A never-reclaim mutant fails eight tests**, including every pre-existing reclaim test. A "fix" that merely stopped reclaiming — the catastrophic and silent failure this phase most easily invites — cannot pass.
- **605 tests green, `type-check` clean**, up from 584 at phase 16's close.
- **The freeze instrument was validated before its output was believed**, using 15a's own account of why it failed there and what it does establish. Third phase in a row that step mattered.

**Not covered, carried onto the requirements rather than buried here:**

- **No real macOS suspend has been observed.** The gap was a process freeze. 15a's `pmset` measurement supplies the other link independently, so the chain is two measurements rather than one measurement and one assumption — but one lid-close would close it outright.
- **The reclaim comment on a ticket** was not exercised at this gate; it rests on unit tests and 14g's real crash.
- **The frozen token counter.** Unexplained since 14g and untouched.
- **The two-daemon ledger hazard**, which this phase widens by two more clobberable keys. [ADR-0020](../../../adr/0020-liveness-is-judged-only-over-witnessed-time.md) says so outright.
- **Whether reclaim-without-recovery is too conservative.** This phase makes unattended overnight runs survivable, which makes the question live for the first time rather than academic. Still unsettled.

## The habit this phase earned

**Specify a gate against the seam, not against the story — and let the human's impatience be evidence.**

The plan's gate was expensive because it described a scenario rather than a mechanism. When fvermaut called it overkill, the useful response was not to defend it and not to abandon it, but to ask what the test actually reads. The answer was "two timestamps", and the evening, the pipeline run and the money all fell away without weakening a single claim.

**And the other half, unchanged from phase 16: run the real thing, and keep reading after it works.** Both defects here surfaced in the seconds after the mechanism was seen working correctly.
