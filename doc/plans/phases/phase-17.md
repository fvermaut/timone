# Phase 17: the clock that judges a run

> **Status:** **Awaiting approval — and deliberately parked behind [phase 16](phase-16.md).** Planned 2026-08-08 at the moment of the split, so the decision does not evaporate between now and then. **Approval is not being sought yet**; it is sought when phase 16 closes. Hand-planned, as all Timone-self phases are.

> **Seventh phase of [PRD-02](../../specs/prd/prd-02-inversion-of-control.md).** Governing decision: **[ADR-0020](../../adr/0020-liveness-is-judged-only-over-witnessed-time.md)** (liveness is judged only over witnessed time), which supersedes [ADR-0017](../../adr/0017-a-runs-liveness-is-its-heartbeat.md). Standing: [ADR-0007](../../adr/0007-sessions-at-timone-root.md), [ADR-0014](../../adr/0014-artifact-first-gates.md), [ADR-0019](../../adr/0019-timone-authored-commits-carry-a-provenance-trailer.md).

## Why this is a separate phase, and why it is second

**fvermaut split it out on 2026-08-08** and took previews first, judging this half *"more a bug I can live with"* — with the measurement in hand, not in ignorance of it. That is a scoping decision and it is recorded here rather than argued with.

**What it costs while it waits, stated once.** The prohibition stands: `timone daemon` must not be left running unattended overnight on a laptop that sleeps. [15a](reports/phase-15-clock-investigation.md) measured **146 suspensions in one night, 113 of them longer than the two-minute staleness threshold**, and #13's overnight session crossed it **17 times while alive and working**. Under a continuously running daemon that is 17 healthy runs killed and 17 branches abandoned. **The hazard is bounded by the prohibition, not removed by it**, and the prohibition is only as good as remembering it at midnight.

**It also constrains phase 16's own gate**, which has to run a continuous daemon to prove per-cycle reconciliation and must therefore be driven attended. This phase is what lifts that condition.

**The ADR gate fired and is discharged.** [15a](reports/phase-15-clock-investigation.md) measured the mechanism and stated five options without choosing; the choice is [ADR-0020](../../adr/0020-liveness-is-judged-only-over-witnessed-time.md), made by fvermaut on 2026-08-08. **No slice below resolves an open decision** — and the option that looks obvious, a monotonic tick so both numbers agree, was considered and rejected: it is display-only and cannot follow into a persisted ledger that other processes read.

## Requirements

> **PRD:** [prd-02-inversion-of-control.md](../../specs/prd/prd-02-inversion-of-control.md) — criteria in [prd-02-inversion-of-control.criteria.md](../../specs/prd/prd-02-inversion-of-control.criteria.md)

| ID | Priority | Requirement (one line) | This phase |
| --- | --- | --- | --- |
| PRD-02.R18 | MUST | A run orphaned by a crashed daemon is reclaimed, reported and its project freed | **closes** — 17a implements ADR-0020; the false-positive path is what held it |
| PRD-02.R17 | SHOULD | The daemon shows progress while a session runs, and its authoritative cost when it ends | **closes on the clock half only** — see the limit below |

**R17's limit, stated now so the completion report is not where it is discovered.** R17 failed at 14g on **two** numbers: the clock and the output-token counter. This phase fixes the clock, because [15a](reports/phase-15-clock-investigation.md) explained it and ADR-0020 decides it. **The frozen token counter is not fixed here and is not explained anywhere** — #13's planning session held at 4.7k output tokens for four hours with **no sub-agents in play**, so the fan-out story does not cover it, and 15a deliberately decoupled it from the clock rather than assuming a shared cause. **R17 closes only if 17c's gate shows the token counter accurate on the sessions it observes; otherwise it stays `draft` with the token half named as the remainder.** Nobody should read this phase as closing R17 by fixing the clock alone.

Deliberately **not** this phase: the **two-daemon ledger hazard**, which ADR-0020 explicitly leaves untouched and marginally widens; **whether reclaim-without-recovery is too conservative** for unattended runs — this phase makes unattended runs survivable, which makes that question live rather than academic for the first time, and it is still not settled here; **sub-agent output tokens obtained honestly**; the Slack adapter; the real bot identity; a `setup` skill.

## Goal Description

The daemon stops killing healthy work.

A `setInterval` cannot fire while its process is not scheduled, so on a laptop that suspends, a perfectly healthy session goes silent and looks exactly like a corpse. [ADR-0017](../../adr/0017-a-runs-liveness-is-its-heartbeat.md) reasoned that a stale heartbeat is *evidence* a daemon died, as against a startup sweep's *assumption*; the reasoning was right and rested on an unstated premise — that somebody was listening for the whole interval. Nobody was. After this phase, **staleness is judged only across time a daemon can vouch for having watched**, and the daemon can prove that about itself because it is suspended by the same sleep that silences the run.

The second half is a word, not arithmetic. The tick's elapsed and the SDK's `duration_ms` diverged by 13× and **both were correct** — wall time and awake time, presented under one name. Each says which it is.

**Load-bearing decisions, fixed here so slices don't re-litigate them:**

- **The witness is two fields on the state, not a flag on each run.** `observedAt` is when a poll cycle last ran; `observingSince` is the start of the current unbroken watch. A cycle finding a normal gap carries `observingSince` forward; a cycle finding a large gap resets it to now. **A run may be reclaimed only when `now - observingSince >= staleAfterMs`** — the daemon has been continuously present for at least as long as the window it is about to judge.
- **This is why the window is not granted by touching runs.** ADR-0020 says every active run gets one fresh staleness window; `observingSince` delivers exactly that. **Rewriting each run's `heartbeatAt` on wake would record a heartbeat that never happened**, and `heartbeatAt` is evidence, not bookkeeping — the whole ADR turns on that distinction.
- **A gap is unwitnessed when it exceeds twice the poll interval.** One missed cycle is scheduler jitter; two is evidence the process was not running. Named constant, with that sentence as its comment.
- **An absent `observedAt` counts as unwitnessed.** A first-ever run, or a state file from an older daemon, has no witness — so it grants the window rather than reclaiming. Conservative in the only safe direction: a late reclaim costs a project two minutes, an early one costs an agent's work.
- **The witness fields are top-level on the state, and `stateSchema` is a `z.strictObject`.** Both optional, so `version` stays `1` and every existing state file loads unchanged. They describe the **daemon's attention**, which is not a property of any run.
- **The two clocks are labelled, not reconciled.** The tick keeps `Date.now()` and prints `… elapsed`; the closing line keeps `duration_ms` and prints `… working`. Both are correct measurements of different quantities, so the fix is a word. **If a slice finds itself computing a duration differently, it has left its scope.**
- **`duration_api_ms` stays unread.** It is **not** a nested total — on a control run it *exceeded* `duration_ms` — so nothing may treat one as bounding the other.
- **The ADR-0017 citations in `src/` are this phase's to update**, in `progress.ts`, `runs.ts`, `poll.ts` and `commands/daemon.ts`. Phase 16 was forbidden from touching them precisely so the code never claims a fix that does not exist.
- **The prohibition is lifted by 17c's evidence, not by 17a's merge.** A code change is not evidence.

## Context & Prerequisites

- **[Phase 16](phase-16.md) must have closed**, and this plan is re-checked against `main` before approval: 16c adds a top-level `previews` key to the same `stateSchema` this phase extends, so the two touch one file and phase 16 lands first.
- **The evidence this phase acts on is gathered and is not to be re-gathered.** [15a](reports/phase-15-clock-investigation.md) carries the `pmset` measurements, the awake-time arithmetic, the failed `SIGSTOP` instrument and why it failed. Slices read it; they do not repeat it.
- **[ADR-0020](../../adr/0020-liveness-is-judged-only-over-witnessed-time.md) supersedes [ADR-0017](../../adr/0017-a-runs-liveness-is-its-heartbeat.md)**, whose status line is already flipped and whose body is untouched. History is not edited.
- **The daemon's poll loop is a `setTimeout` in its own process** (`commands/daemon.ts`), which is what makes the gap measurable from inside without asking the operating system anything.
- **`--once` is a fresh process per cycle**, which is why the witness must be persisted rather than held in memory: every gate and every test uses that mode, and an in-memory witness would be absent exactly where the behaviour is proven.

## Sub-phases

### Sub-phase 17a: the daemon judges only time it watched (R18)

**[MODIFY]** `src/daemon/runs.ts`, `runs.test.ts` — `stateSchema` gains optional top-level `observedAt` and `observingSince`; `RunStore` gains a witness call returning whether the daemon may judge, and persisting both. `staleRuns` is unchanged — it answers "which runs are quiet", which is still the right question.
**[MODIFY]** `src/daemon/poll.ts`, `poll.test.ts` — `pollOnce` takes the witness once per cycle, **before any project is reclaimed**, and `reclaimStale` skips entirely when the daemon may not yet judge, logging that it is doing so.
**[MODIFY]** `src/commands/daemon.ts` — pass the poll interval through so the unwitnessed threshold derives from it; update the ADR-0017 citation.
**[MODIFY]** `src/daemon/progress.ts` — the `DEFAULT_PROGRESS_INTERVAL_SECONDS` comment cites ADR-0020 and states the new rule.

**Seams under test (TDD):** a run quiet past the threshold, with the daemon continuously present, is **still reclaimed** — the property a fix like this most easily destroys, and it is asserted **before** any skip test; the same run, after a gap exceeding twice the poll interval, is **not** reclaimed on that cycle; it **is** reclaimed once the daemon has been present for a full staleness window afterwards, which is the "delayed, not disabled" property; a state file with no `observedAt` grants the window rather than reclaiming; a normal cycle carries `observingSince` forward rather than resetting it, asserted across three consecutive cycles; the witness is taken **once per cycle** even with several projects in the manifest, so project two is not judged by a witness project one refreshed; an existing state file with neither field loads and `version` stays `1`.

> No dependency on other sub-phases. Sequenced first: it is the slice that lifts the prohibition.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/runs.test.ts src/daemon/poll.test.ts src/commands/daemon.test.ts
npm run type-check
npm test
```

- [ ] A genuinely dead run is still reclaimed when the daemon was present throughout — asserted before any skip test
- [ ] The skip is proven **temporary**, not permanent: reclaim fires on a later cycle
- [ ] No run's `heartbeatAt` is written by the reclaim path
- [ ] An old state file loads unchanged, `version` still `1`
- [ ] Every ADR-0017 citation in `src/` now names ADR-0020

---

### Sub-phase 17b: each clock says which one it is (R17)

**[MODIFY]** `src/daemon/progress.ts`, `progress.test.ts` — `tickLine` prints elapsed as `… elapsed`; `closingLine` prints duration as `… working`. The `ProgressSnapshot.elapsedMs` and `SessionSummary.durationMs` docs state which quantity each is and cite 15a's measurement.

**No arithmetic changes.**

**Seams under test (TDD):** the tick line carries `elapsed` and the closing line carries `working`, asserted as rendered strings; the existing duration formatting (`9s`, `4m12s`, `1h04m`) is unchanged, so the labels are additive; `duration_api_ms` is proven unread by a test over the result-message handler — a session reporting a large `duration_api_ms` and a small `duration_ms` summarises with the small one.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/progress.test.ts
npm run type-check
```

- [ ] Both labels present and distinguishable in one glance
- [ ] Duration formatting unchanged — the diff is words, not maths
- [ ] `duration_api_ms` proven unread rather than assumed unread

---

### Sub-phase 17c: live gate — a sleeping laptop

**[NO CODE.]** A live run, and the human gate.

1. **The prohibition, tested by breaking it deliberately.** With a real run active and the daemon running **continuously** (not `--once`), let the machine suspend — the thing forbidden since phase 14. Expect: no reclaim, the run alive on wake, and the daemon's log showing it declined to judge and why. **This is the evidence that lifts the warning and the only evidence that can.**
2. **Reclaim still fires.** In the same pass, kill a daemon mid-session with the machine awake throughout; confirm the run is reclaimed, its ticket commented, its project freed, and `timone retry` re-arms it. **A fix that merely stopped reclaiming would pass step 1 and be catastrophic** — this is 15e's discipline applied to a new mechanism, and it is not optional.
3. **The delay is bounded.** After a wake, confirm a genuinely dead run *is* reclaimed on a later cycle rather than never — the difference between deferring judgement and abandoning it.
4. **The two clocks, read side by side** on a session spanning a suspend: the tick's `elapsed` and the closing line's `working`, differing, each legible as what it is.
5. **The token counter, measured not assumed** — on the same sessions, against `modelUsage`. R17 closes only if this holds; otherwise the token half is recorded and R17 stays `draft`.

**Seams under test (TDD):** none — this is the live gate. Phase 14 found six defects this way against 532 green tests; phase 15 found an instrument that lied in the reassuring direction, which is the harder kind to catch.

> Sub-phases 17a and 17b must be complete.

#### Agent Validation Steps

```bash
node dist/cli.js daemon --progress-interval 30
node dist/cli.js status
pmset -g log | grep -c "Entering Sleep"
```

- [ ] Steps 1–5 each observed, evidence captured for the completion report
- [ ] The reclaim path shown still **firing**, not merely quiet
- [ ] Every instrument verified before its output is believed
- [ ] **Human gate:** fvermaut confirms the overnight prohibition may be lifted

---

### Sub-phase 17d: documentation, register, and the route out

**[MODIFY]** `doc/specs/prd/prd-02-inversion-of-control.criteria.md` — R18 `verified` on 17c's two-direction evidence; R17 **only if step 5 holds**, otherwise `draft` naming the token half.
**[MODIFY]** `STATUS.md` — phase 17 in plain language, and **the overnight warning struck only if step 1 passed**.
**[NEW FILE]** `doc/plans/phases/reports/phase-17-complete.md` and `reports/phase-17-live-gate.md`.

**Seams under test (TDD):** none.

> All prior sub-phases must be complete.

#### Agent Validation Steps

```bash
grep -n "overnight" STATUS.md
grep -n -A3 "^## R17" doc/specs/prd/prd-02-inversion-of-control.criteria.md
```

- [ ] R17 does not flip on the clock alone — the token half is named either way
- [ ] The overnight warning is struck only against step 1's evidence, never against a merged diff

## Dependency graph

```
17a → (none)       the daemon judges only time it watched (R18)
17b → (none)       each clock says which one it is (R17)
17c → 17a, 17b     live gate: a sleeping laptop
17d → all prior    docs, register, reports
```

17a and 17b are independent and may run in either order or together.

## What this phase deliberately does not close

- **The frozen output-token counter.** Unexplained since 14g, decoupled from the clock by [15a](reports/phase-15-clock-investigation.md). It is why R17 may not close.
- **The two-daemon ledger hazard** on `.timone/state.json`. ADR-0020 makes reclaim safe under suspension, not the ledger safe under concurrent writes, and the witness fields are two more things two daemons would clobber — a second daemon's fresh stamp can mask a first daemon's absence.
- **Whether reclaim-without-recovery is too conservative.** This phase makes unattended overnight runs survivable, which makes the question live for the first time rather than academic.
- **An always-on host**, which would fix both this and the preview reachability gap, and is not Timone's to acquire.
