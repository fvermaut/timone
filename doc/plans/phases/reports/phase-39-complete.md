# Phase 39 — complete

**Date:** 2026-09-11
**Plan:** [phase-39.md](../phase-39.md)
**Agreed in:** [the list of pieces for #128](../../breakdowns/ticket-128.md), approved by fvermaut on 2026-09-11 — one piece.

## Requirements

| ID | Status after this phase |
| -- | ----------------------- |
| PRD-04.R1 | built; `live` — needs a supervised run to be called verified |
| PRD-04.R2 | built and covered by tests |
| PRD-04.R3 | built and covered by tests |
| PRD-04.R4 | built and covered by tests |
| PRD-04.R5 | built and covered by tests |
| PRD-04.R6 | built and covered by tests |
| PRD-04.R7 | **not built** — see below |
| PRD-04.R8 | built; `human` — the wording is only judgeable on a real question |

## Sub-phases

| Sub-phase | Commit | Outcome |
| --------- | ------ | ------- |
| 39a | `96e9fd6` | The check, its ledger record, its one call site, and the real model call. 24 new tests; full suite 1657 green. |

## Deviations

**PRD-04.R7 was not built, and the check is silent where it would have applied.** A written answer starting the unbound session needs the daemon to run a session bound to no stage. It has no path for that: `SessionSpawner.spawn` takes a stage and picks a prompt from it, while the unbound session exists only as a terminal command in `takeover.ts`. Building that here would have meant a new spawn path, a new pipeline outcome and their interaction with the lock, in the same change as the check itself.

Leaving it undone is not neutral, and that is why the check is gated off escalations rather than left to speak there. Asking a question whose answer moves nothing would cost a reply and then post the original command anyway — worse than the message it replaced. The gate is one condition in `cheaperAsk` and the test that holds it names R7 as what opens it.

**The phase was planned and built in one session**, so the plan records the cut as made rather than as proposed. The single slice is honest: one seam, one call site.

## For the next agent

- **R7 is the next piece**, and it is a daemon change, not a check change. `cheaperAsk`'s escalation guard is the one line to remove, and the test at "says nothing on a stop that no answer resolves" is the one to invert.
- **The check has never run against a real model.** Every test drives a fake consult. R1 and R8 are `live` and `human` for that reason, and a supervised run is what they need — a real ticket, a real reply of `aprrove`, and a look at what comes back.
- **`ASK_CHECK_MODEL` is Haiku 4.5.** If the questions come back badly worded, that is the first thing to change, and `sdkConsult` takes the model as an option so it needs no code edit to try.
