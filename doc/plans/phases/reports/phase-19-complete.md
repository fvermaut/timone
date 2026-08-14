# Phase 19 — Completion Report

- **Date:** 2026-08-14
- **Plan:** [phase-19.md](../phase-19.md) — breakdown approved by fvermaut 2026-08-11, then re-approved twice over two amendments that each reverted the stamp per stage 5's re-approval rule: 2026-08-13 ([ADR-0025](../../../adr/0025-a-lock-holders-proof-of-life-is-its-process.md)) and 2026-08-14 (19g)
- **Requirements:** PRD-02.R3 (MUST) — **`failed` → `verified`**, on [19e step 5](phase-19-live-gate.md#step-5--the-judgement-no-test-can-make)'s evidence and on nothing else. PRD-02.R20 (MUST) — **stays `failed`**; clause 3 is closed by this phase, clauses 1 and 2 are the named remainder.
- **Branch:** `main` — no phase branch, following every prior Timone-self phase (15–18 all committed directly). The skill's one-branch-per-phase rule is written for managed projects with a stage-8 pull request; Timone has no such flow, and a branch would sit unmerged with no reviewer. A deliberate deviation, recorded rather than omitted.
- **Tests:** 662 green at the phase's start, **695 green across 21 files** at 19g. Type-check clean throughout.

## Summary

One written answer bought two agent sessions. [Phase 18's stage-7 pass](phase-18-verification.md) reproduced it twice, both cycles ending on `Run … cannot go from done to done`, and the cost while it stood was a live restriction on a real project: [STATUS.md](../../../../STATUS.md) told fvermaut to talk the open `ivtrends` questions through rather than write on them, on the very path [ADR-0022](../../../adr/0022-a-conversation-ticket-can-be-answered-in-writing.md) existed to open.

[ADR-0023](../../../adr/0023-one-answer-one-session.md) named three stacked faults and a fourth needing no concurrency at all, and fvermaut chose all three mechanisms layered rather than the cheap one. They are built: the ledger has an exclusive lock and a second writer is refused by name (19a); a run is claimed before its session exists and the guards read the file rather than their memory (19b); reading an answer consumes it, and a resumed session that posts nothing no longer re-reads the answer it was resumed on (19c); and a parked run's decision is taken from one read of one thread instead of two (19d).

**The phase's two surprises both came from running things rather than reading them, and each cost an amendment and a re-approval.** 19a's reclaim design was **unbuildable as written** — it gated the reclaim on `RunStore.witness`, and `witness` ends in `persist()`, so consulting the evidence writes the file the lock protects. The live gate then failed step 3: `timone retry` did not give back an answer whose session had died, because `activate` clears the very field the rewind needed, so the human was asked the same question again over the top of his own answer. 19g closes that.

**The gate is the evidence, and it is fvermaut's own.** He answered fixture questions on `scratch-app` in his own words and judged what came back — the one judgement no test can make, unwitnessed since ADR-0022 was written. All five steps pass, at roughly $6, and **R3 closes on that and on nothing else** — not on a merged diff and not on 695 green tests, none of which could see either of the two faults the gate found.

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 19a — one writer, and it says who holds it | **Rebuilt onto [ADR-0025](../../../adr/0025-a-lock-holders-proof-of-life-is-its-process.md) after the original reclaim design proved unbuildable**, then landed. A refused process now writes nothing at all, which is asserted against the superseded implementation rather than argued. | `9f688e7` |
| 19b — the claim precedes the work | Landed as planned. `RunStore.claim` takes a run before its session exists and releases it if the spawn throws; the three poll-loop guards refresh from disk. | `e7338ff` |
| 19c — reading an answer consumes it | Landed as planned. The cursor advances as part of deciding to resume; `afterConversation` no longer reparks before the human's answer; `timone retry` rewinds. The single-process re-fire is proven fixed with no second process in the test. | `6f837d5` |
| 19d — one fetch per parked run per cycle | Landed as planned. One `getTicket` (or `getPullRequestThread`) per parked run per cycle, with the decisions measured byte-identical on both sides of the change. | `a3da51b` |
| 19g — the consumed answer survives the session that read it | **Added after the live gate failed step 3**, amended, re-approved, then landed. The run records the instant of the answer it read in a field `activate` does not touch, and `retry` winds back whichever state the run died in. | `2278a0c` |
| 19e — live gate | **Run, and it found the fault above.** Steps 1, 2, 4 and 5 passed on 2026-08-13; step 3 failed and passed on the 2026-08-14 re-run. Human gate obtained. | no commit — the evidence is [the live-gate report](phase-19-live-gate.md) |
| 19f — documentation, register, reports | This slice: R3 flipped on the gate's evidence, R20 held down with its remainder named, `STATUS.md` and `README.md` updated, both reports written. | this slice |

Plan amendments: `c846f20` (ADR-0025), `b011d68` (19g). Re-approvals: `2c7f04e`, `8bf0119`. The ADR itself is `8c65b34`.

## Deviations from the plan

- **✏ Refined 2026-08-13 — [ADR-0025](../../../adr/0025-a-lock-holders-proof-of-life-is-its-process.md), because 19a's reclaim design was unbuildable.** The plan gated the reclaim on `RunStore.witness` ([ADR-0020](../../../adr/0020-liveness-is-judged-only-over-witnessed-time.md)) — but `witness` ends in `persist()`, so *consulting* it **writes to the very file the lock protects**. Two faults followed, both reproduced at the real defaults rather than reasoned about: a refused process mutated the ledger it had just been refused, and **three refused `daemon --once` starts a minute apart accumulated enough "watch" to break a live daemon's lock** — this phase's own fault arriving as its fix, on the path 19e step 2 walks. fvermaut ruled from three options that **a lock holder's proof of life is its process**; the quiet window survives as a cheap first filter and stops being the authority. Plan amended, stamp reverted, re-approved the same day. Commits `8c65b34`, `c846f20`, `2c7f04e`.
- **✏ Amended 2026-08-14 — 19g added, because 19e step 3 failed live.** `timone retry` did not return an answer consumed by a session that died *after* being activated: `activate` clears `waitCursor`, so the rewind had nothing to wind back, fell through to the entry path, and re-posted the original invitation verbatim over the human's answer at 21:54:32Z against an answer written at 21:52:33Z. ADR-0023 traded *"a silent double-answer for a visible stall"* and undertook that `retry` rewinds the marker; a **silent re-ask** is not that trade. Plan amended, stamp reverted, re-approved. Commits `b011d68`, `8bf0119`.
- **No phase branch**, per the Branch line above.
- **19e's step 5 target is the fixture, not the real project** — recorded here because the plan itself records the rejected alternative. An earlier draft sited the human judgement on a live `ivtrends` question, on the reasoning that six already existed and were therefore free. fvermaut rejected that on 2026-08-11: *"it is free over there"* is the standing argument for polluting a real tracker, and the evidence closes because the **person** is real, not because the ticket is.

## What the phase did not close, and must not be read as closing

- **PRD-02.R20 stays `failed`**, exactly as the plan said it would. Clause 3 — a wayfinder decision ticket's written answer participating in the loop — is closed. **Clause 2** (`takeover` resolving a wayfinder ticket with no ledger run, from the tracker) was ruled on by fvermaut on 2026-08-13 and is built as part of [phase 20](../phase-20.md), not here; **its bite is unchanged meanwhile** — a repository onboarded before phase 18 has no `timone` label, marking there fails silently, and there is then no way in. **Clause 1's `prototype`, `research` and `task` branches remain unobserved**, and arrive free with the next map charted.
- **The hand-back on a human's answer.** At the gate the machine **resolved** a contradictory second answer instead of handing back. fvermaut judged it a pass; the bound's *purpose* held (no third question) and its *letter* did not. That is a specification question for stage 9, and it means the escalation itself is still witnessed only against a machine-authored answer. See [the live-gate report](phase-19-live-gate.md#step-5--the-judgement-no-test-can-make).
- **The six live-gate findings**, none fixed here — a running daemon executing stale in-memory code, the `resume` line printing after the session has finished, fixture decisions landing in a project's permanent record, phase 18's finding 3 reproduced a third time, the now-identified intermittent, and the crashed-daemon wedge for one staleness window.

## Context for the next agent

**Running it.** `npm test` (695 across 21 files), `npm run type-check`, `npm run build`, then `node dist/cli.js …`. Each slice's validation block is recorded in [phase-19-handoffs.md](phase-19-handoffs.md) with its red→green trace.

**One known intermittent, and it is no longer unidentified:** `src/commands/guardrails.test.ts > finding the run that drove a session > resolves the session id against the ledger` does real `git` work, runs in ~1.2s alone, and blows its 5000ms timeout under full-suite contention. Confirmed failing at `2c7f04e`, **before any phase-19 code existed**. A red run on that name is not a regression from this phase.

**The operator consequence that outlives this phase:** a `timone daemon` already running executes whatever code was in memory when it started. Phase 19 changes nothing for it until it is restarted, and at the gate that produced a session resolving a ticket on pre-phase-19 code and two `daemon --once` runs exiting 0 silently. This is in `STATUS.md` in plain words because it is the difference between the fix being live and appearing to be.

**Deferred to the delivery review** (refactoring is not stage 6's), carried out of the slices' own handoffs:

- `concludeReview` now takes six positional parameters — the fix is the cycle-context object 18c asked for on `afterStage`'s seven, and it would shorten `concludeLastConversation` and `reclaimStale` in the same move.
- The acquire-or-refuse body is duplicated across `daemon`, `takeover` and `retry`; a `lockedCommand` helper would hold it once.
- The refusal prose in `lock.ts`, `retry.ts`'s two rewind sentences and its thrice-spelled "start `timone daemon` if it isn't running" all want collecting.
- **`timone takeover` never claims the run it works** — it writes nothing to the ledger but `store.get`, so the run stays `parked` for the whole interactive session and only 19a's lock keeps the daemon out. **The claim-before-work rule therefore holds for the daemon alone**, and no document may overstate it as covering takeover.
