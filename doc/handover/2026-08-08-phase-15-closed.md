# Handover — Timone — 2026-08-08

> Prior handover: [2026-08-08-phase-14-closed.md](2026-08-08-phase-14-closed.md). Its "Exact next action" — *answer the scope question, then plan accordingly* — **is what this session did**: fvermaut chose **defects before previews**, and phase 15 is the result. Same date, second session.

## Snapshot

**Phase 15 is closed.** Seven commits, `405cbde`..`b81ad24`, all pushed; `main` level with `origin/main`, tree clean, **539 tests green** (up from 532), `type-check` clean. Of the three defects [phase 14's gate](../plans/phases/reports/phase-14-live-gate.md) left unrouted, **two are fixed and the third is explained but deliberately not fixed**. The register moves **R15 → `verified`**; **R17 and R18 stay `draft` and the register says plainly that the fix is phase 16's**, so nobody reads this phase as having closed them. **Docker previews are displaced a second time**, to phase 16. **Nothing is in flight and nothing is blocked** — the next move is Timone's own, not fvermaut's.

## Done this session

- **[Phase 15 planned and approved](../plans/phases/phase-15.md)** — hand-run, as all Timone-self phases are. Its first section states the phase's own limit up front: two defects fixed, one measured only, **because the tick fix trips the ADR gate**.
- **15b — the attribution defect is fixed** (`568962a`). The filter went at the evidence boundary, so one change corrects all four rules; the unpushed half needed the same filter by its own route.
- **15c — `timone retry` clears the dead attempt's flags** (`c32242d`).
- **[15a — the clock finding](../plans/phases/reports/phase-15-clock-investigation.md)** (`ff2750d`). **The single most load-bearing artifact of this phase.**
- **15d — R18's middle criterion reworded** (`0c23baa`), sequenced after 15a on purpose.
- **[15e — the live gate](../plans/phases/reports/phase-15-live-gate.md)** (`58ba6f0`), signed off by fvermaut.
- **[The completion report](../plans/phases/reports/phase-15-complete.md)**, **[the criteria register](../specs/prd/prd-02-inversion-of-control.criteria.md)** and **[STATUS.md](../../STATUS.md)** (`b81ad24`).
- **A public correction posted on `scratch-app` #11**, on fvermaut's decision — beneath the original rather than replacing it.

## In flight / blocked

- **Nothing.** Phase 16 is not started and needs no input to start.
- **`scratch-app` #10 and #13 still `failed`, #4 still parked at triage** — untouched, exactly as the prior handover left them. The gate's fixture ticket #14 was closed and its run removed from the ledger.

## Decisions made this session

- **Defects before previews** — fvermaut, 2026-08-08. Previews are now phase 16, their **second** displacement; the completion report says they should not be displaced a third time without the cost being restated.
- **The tick fix was deliberately not planned**, because every candidate changes what [ADR-0017](../adr/0017-a-runs-liveness-is-its-heartbeat.md) means by *a run's liveness is its heartbeat*. **The ADR gate fires, and the decision cannot be recorded until something measures the mechanism** — which is what 15a is for. 15a therefore states five options with their trade-offs and **explicitly declines to choose**.
- **The two tick defects are now *decoupled*, reversing the prior handover's instruction to route them as one.** The clock is fully explained without the token counter, so they must no longer be assumed to share a fix merely because they were found together. **This supersedes the prior handover on that point.**
- **The attribution fix keeps a limit rather than engineering around it**: an untrailed commit is still attributed to whoever checks. Now a test, a comment *and* a live observation, so a later tidy-up cannot remove it silently.
- **Both flags on `scratch-app` #11 cleared**, because #11 was re-armed and under 15c a re-armed run carries no flags — clearing puts the ledger in the state the fixed code would have produced.
- **The false accusation was corrected in place, not deleted** — fvermaut's call. The record of the mistake stays legible.

## Exact next action

**Record the ADR, then plan phase 16 — in that order.**

1. **`timone-adr` on Timone itself**, carrying [15a's finding](../plans/phases/reports/phase-15-clock-investigation.md) and its five options. This most likely **supersedes or amends [ADR-0017](../adr/0017-a-runs-liveness-is-its-heartbeat.md)** rather than standing beside it.
2. **`timone-plan` on Timone by hand** for phase 16: the clock/heartbeat fix **and** Docker previews.

**Do not let an executing agent pick the option.** One of the five — a monotonic tick so both numbers agree — is the obvious-looking choice and **would make R18 worse**: a monotonic heartbeat makes a suspended run look recently alive to a poll loop still comparing against wall clock. That trap is the reason the gate exists.

**Timone's own planning stays hand-run** (`/timone-plan` targets managed projects only), and **`/timone-improve` is not the route for Timone's own defects.**

**The operational warning stands, unchanged and for the same reason:** do not leave `timone daemon` running unattended overnight on a laptop that sleeps. 15a measured that hazard to 113 occurrences in one night; it did not remove it.

## Open questions

- **Which of 15a's five options is right?** — resolved by `timone-adr` plus fvermaut's approval. **This is the only thing standing between here and phase 16.**
- **Why did the token counter freeze at 4.7k for four hours while replies advanced 8→22?** — 5.8× under-reporting on a stage that spawned **no** sub-agents, so the fan-out story does not cover it. **No longer answered by the clock investigation**, which is the change from the prior handover. Needs its own.
- **Should `duration_api_ms` be used at all?** New. It is unread today and now known **not** to bound `duration_ms` — on a control run the API figure *exceeded* the total. Phase 16 should decide deliberately rather than by omission.
- **Can sub-agent output tokens be obtained honestly?** Unchanged — the obvious fallback is the source 14b rejected for under-reporting ~30×.
- Carried unchanged: the real bot identity (needs a credential); one conversation medium behind the R14 seam; the deferred PRD-01 list (R23, R24); `scratch-app`'s screen-reader HUMAN-CHECK; the **two-daemon ledger hazard**; **reclaim-without-recovery** conservatism, sharpened again by 15a.
- **Closed by this session:** whether the guardrails can be trusted on a client's ticket (yes, gated); whether the clocks' divergence is real (yes, and both numbers are correct); whether the two tick defects are one problem (**no**).

## A habit this phase earned

**14g's habit fired again, in the opposite direction — and that direction is harder to catch.** The first instrument for the clock question was a `SIGSTOP` of the process tree. It was verified before use (both processes confirmed in state `T`) and reproduced the defect's signature exactly — one tick where eighteen should have fired. It then reported that `duration_ms` tracked wall clock straight through the freeze, which reads as a **clean refutation of the sleep hypothesis**. It is not one: `SIGSTOP` stops scheduling, not the system counters, so a freeze cannot distinguish a sleep-excluding clock from a sleep-including one.

14g's instrument fabricated a **defect**; this one fabricated a **clean bill of health** — and nobody investigates a result that says there is nothing to investigate.

**And the instrument that finally worked was not an experiment at all.** macOS already logs every sleep. `pmset -g log` was free, needed no suspend, covered 146 events rather than one, and was contemporaneous with the session that produced the divergence. **Look for an existing record before building a rig.**
