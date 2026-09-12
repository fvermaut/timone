# Phase 40 — complete

**Date:** 2026-09-12
**Plan:** [phase-40.md](../phase-40.md)
**Agreed in:** no breakdown — this is the requirement [phase 39](phase-39.md) left, carried on [timone#132](https://github.com/fvermaut/timone/issues/132), and its own report named this work.

## Requirements

| ID | Status after this phase |
| -- | ----------------------- |
| PRD-04.R7 | built and covered; `live` — a supervised run is what makes it verified |

## Sub-phases

| Sub-phase | Commit | Outcome |
| --------- | ------ | ------- |
| 40a | `54a17c0` | The unbound session, the rule for which words start one, and the record that stops it starting twice. Four new tests, one inverted; full suite 1675 green. |

## Deviations

**One bug found while building, and it was mine from phase 39's design.** The plan was to clear the ask check's record once its answer had been acted on. Clearing it let the check consult again on the very next cycle, and whether that fresh question then re-triggered on the *old* answer depended on which timestamp happened to be later. It surfaced as a test asserting one session and getting two. The record is now marked `actedOn` and kept, which cannot do either.

**This phase stacks on [#129](https://github.com/fvermaut/timone/issues/129)'s branch rather than on the default branch.** Cut from the default branch its suite is red, on a fault that is neither this phase's nor its own: [#130](https://github.com/fvermaut/timone/pull/130) shipped the ask check's model call defaulted inside `runDaemon`, so any test building a daemon reaches a real model and times out. The fix is one line and it is in #129, which was written first. Stacking is the honest arrangement; merging #129 first is what it costs.

**No live gate has run.** Every test drives fakes, which is the right seam for the loop's decisions and says nothing about whether a real unbound session, started by nobody, does something sensible with a real answer. That is what PRD-04.R7's `live` channel means and it is still owed.

## For the next agent

- **The live gate is the next thing**, for R1, R7 and R8 together — one supervised run on the fixture covers all three: reply `aprrove` to an approval request, and answer a framed question on a stuck ticket.
- **The unbound session runs on `claude-opus-5` at `high` effort**, hardcoded in `unstick`. ADR-0033 D5 accepted that such a session is bound by nothing but the person and the model in it, and there is now no person — so the model is the whole of it.
- **`ASK_CHECK_MODEL` is still Haiku 4.5** and has never written a question anyone has read.
