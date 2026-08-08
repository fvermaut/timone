# Phase 15 — completion report

> Closes [phase 15](../phase-15.md). The evidence is in [the 15e gate report](phase-15-live-gate.md) and [the 15a clock finding](phase-15-clock-investigation.md) and is not restated here — this report decides what it means, flips the register, and names the phase's exit.

## What it does now

The guardrails stop accusing the wrong session. Since [ADR-0018](../../../adr/0018-the-session-bracket-belongs-to-the-hooks.md) moved the bracket into the hooks, the rules scoped "this session's commits" by diffing against the session's own `SessionStart` baseline — which cannot separate two sessions sharing one repository, so the one whose baseline was older was blamed for the other's work. They now read the `Timone-Session:` trailer and exclude any commit belonging to a different session. `timone retry` re-arms a run without the dead attempt's flags. And the tick's clock divergence, which the phase deliberately did not fix, is no longer a hypothesis.

**The phase closes with one of its three requirements verified and two held, exactly as the plan said it would** — that limit was stated in the plan's first section rather than discovered at the end.

## Register decisions

| | requirement | before | after | why |
| --- | --- | --- | --- | --- |
| **R15** | post-session guardrail hooks | draft | **verified** | the fourth criterion now holds live, and the rules were shown still firing |
| **R17** | the daemon shows progress | draft | **draft** | measured, not fixed — the fix trips the ADR gate |
| **R18** | an orphaned run is reclaimed | draft | **draft** | criterion revised; the hazard is now confirmed rather than suspected |

### R15 → verified

What held it down was its **fourth** criterion — *a clean session of either kind produces silence* — failing on real evidence at 14g. That is the criterion 15e closed, and it closed on the condition that produced the defect: the daemon's baseline taken **first**, since the older baseline was what got blamed.

**The gate's design point is the one worth carrying forward.** Silence proves nothing on its own — a filter that silenced the rules would look identical to one that fixed them. So the gate ran the discriminator immediately after, against the same repository state and the same commit: **the author session reported it by sha while the accused session stayed quiet.** Then it provoked genuine violations from both sides and confirmed both still fire, both still report where they belong, and the daemon-side ticket comment named **exactly one file** where 14g's named three the session never touched. With three unpushed commits from three sessions in play, the daemon session reported 1 file and 1 commit — so the inflated count is measured rather than asserted.

**The limit is recorded rather than engineered around, and it is now observed as well as tested:** an untrailed commit is still attributed to whichever session checks. Such a commit is genuinely unattributable, and over-reporting a real violation is the safe direction.

### R17 and R18 stay draft — and the reason is a gate, not a shortfall

**The clock is explained.** There are two clocks measuring different things: the tick's elapsed is `Date.now()`, wall clock, which advances while the machine is suspended; `duration_ms` is the session's **awake** time. Both numbers are correct and were presented under one name.

**The decisive evidence needed no experiment at all.** macOS logs every sleep. Over the overnight window: 146 events, median 889s, on a ~15m49s `Maintenance Sleep` cycle — and the gate report had independently described the tick pattern as *pairs 30s apart separated by ~15m gaps*, which is the same cycle seen from the other side. At ~45s awake per cycle, the session's 4h13m of wall clock gives ~19 minutes awake, against a `duration_ms` of **19m30s**.

**R18's hazard is therefore confirmed outright**, and on evidence that does not depend on what the SDK's clock does: **113 suspensions past the 120-second staleness threshold in one night**, on a heartbeat that only stamps when the tick fires.

**Neither is fixed here because the fix trips the ADR gate.** Every candidate — a monotonic tick, wake-aware staleness, stamping liveness from message arrival, a larger threshold — changes what [ADR-0017](../../../adr/0017-a-runs-liveness-is-its-heartbeat.md) means by *a run's liveness is its heartbeat*. That passes the three-part significance test, so the decision is recorded before it is planned, not inside a plan file. **One of the options would make R18 worse in a way that is easy to miss** — a monotonic tick would make a suspended run look recently alive to a poll loop still comparing against wall clock — which is precisely why it is not being chosen by an executing agent.

### R18's criterion was inadequate, and is now revised

The middle criterion said *"alive **and still stamping its heartbeat**"*. A suspended session is alive and not stamping, so the sleep case slipped through the criterion's own precondition and the requirement read as satisfied by a run that would in fact have been reclaimed — **it could not go red on the very evidence that holds it down.** The replacement names no mechanism and does go red on it. Sequenced after 15a deliberately: the cheapest way to write a criterion that accidentally presupposes a mechanism is to write it while the mechanism is still a guess.

**A specification correction, not an intent change** — R18 has always meant that a live run is not killed. Which is why it was a slice here rather than a route to `timone-improve`.

## What the phase cost, and what it bought

**Nothing, in API terms, beyond a few cents of probe sessions.** No pipeline stage was run. That is worth stating next to phase 14's $27.06: the subject here was the hooks and the clocks, not the pipeline, and both were exercised through their real entry points against real git state, a real ledger and a real ticket.

**Two defects fixed, one explained, and 539 tests green** — up seven from phase 14's 532. As at 14g, **none of the new tests would have found the original defects**; they exist to stop them returning.

## A habit, applied and then earned again

Phase 14 earned *a measurement instrument gets verified before its output is believed*. Phase 15 applied it deliberately, and it fired a second time — **in the opposite direction.**

The first instrument for the clock question was a `SIGSTOP` of the process tree. It was verified before use (both processes confirmed in state `T`) and it reproduced the defect's signature exactly: **one tick where eighteen should have fired.** It then showed `duration_ms` tracking wall clock straight through the freeze — which reads as a clean refutation of the sleep hypothesis, and would have gone into the record as one.

**It is not a refutation, because the instrument cannot see the axis in question.** `SIGSTOP` stops a process being *scheduled*; it does not stop the system counters, so a freeze test cannot distinguish a sleep-excluding clock from a sleep-including one. A second measurement — Node's monotonic clock against wall clock since boot — nearly repeated the mistake, and fails for a related reason: `duration_ms` is not computed in Node.

**The generalisation worth keeping:** 14g's lesson was about an instrument that fabricated a defect. This one is about an instrument that fabricated a *clean bill of health*, which is harder to notice, because nobody investigates a result that says there is nothing to investigate. **And the instrument that finally worked was not an experiment at all** — the operating system's own sleep log was free, needed no suspend, and was the only one of the three that could see the phenomenon. Look for an existing record before building a rig.

## Deviations from the plan

- **15a was to be a controlled suspend experiment.** It became a process-tree freeze plus the OS log, because the suspend the plan imagined would have suspended the session running it. The OS log turned out to be stronger evidence than the planned experiment: it covers 146 events rather than one, and it is contemporaneous with the session that produced the divergence.
- **15e ran no LLM stage.** The plan's step 1 said "with a daemon session building"; the gate used a real run in the real ledger and the real guardrails CLI, without spending a pipeline stage. The subject of R15 is the hooks, and the hooks were exercised through their production entry point — but this is a deviation and is named rather than absorbed. What the gate does *not* re-prove is the pipeline end to end; phase 14's evidence stands and nothing here touches it.
- **A public correction was posted on `scratch-app` #11**, which the plan named as fvermaut's decision rather than the phase's. He took it on 2026-08-08: correct in place rather than delete, so the record of the mistake stays legible.

## What this phase deliberately did not close

- **R17 and R18** — phase 16, behind an ADR. Stated up front, not discovered.
- **The tick's token counter**, now **decoupled** from the clock. The clock is explained without it, so the two must no longer be assumed to share a fix merely because they were found together. The fifth measurement — 5.8× under-reporting on a stage that spawned no sub-agents, with the counter frozen at 4.7k for four hours while replies advanced 8→22 — remains unexplained.
- **The two-daemon ledger hazard** on `.timone/state.json` — untouched by phase 14 and untouched again.
- **Whether reclaim-without-recovery is too conservative** for unattended runs. 15a sharpens it — the machine most likely to run overnight is the one most likely to suspend — and does not settle it.
- **`duration_api_ms`** is unread and now known **not** to bound `duration_ms`. Whatever phase 16 does with the clocks should decide deliberately whether to use it.
- **The `setup` skill**, the real bot identity, `scratch-app` #4 / #10 / #13 — all carried forward unchanged.

## For the next agent

**The exit of this phase is a route to `timone-adr`**, carrying [15a's finding](phase-15-clock-investigation.md) and its five options with their trade-offs. That is a normal outcome of a gate, not a stalled plan. **Record the decision, then plan phase 16** — the clock/heartbeat fix and Docker previews, which have now been displaced twice and should not be displaced a third time without the cost being stated again.

**Timone's own planning stays hand-run** (`/timone-plan` targets managed projects only), and `/timone-improve` is not the route for Timone's own defects.

**The operational warning stands until phase 16 lands:** do not leave `timone daemon` running unattended overnight on a laptop that sleeps. 15a measured that hazard precisely; it did not remove it.
