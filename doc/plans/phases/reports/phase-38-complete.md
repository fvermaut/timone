# Phase 38 — Completion Report

- **Date:** 2026-09-11
- **Plan:** [phase-38.md](../phase-38.md) — a standalone bug fix, not part of a breakdown ([ADR-0030](../../../adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md) D3).
- **Requirements:** PRD-03.R1 (MUST), PRD-03.R5 (MUST). Neither status is changed here — both say in writing that only a watched run can settle them.
- **Branch:** `timone/122-the-takeover-does-not-fix-the-thing-it-w`
- **Tickets:** [timone#122](https://github.com/fvermaut/timone/issues/122), closing [#117](https://github.com/fvermaut/timone/issues/117), [#108](https://github.com/fvermaut/timone/issues/108) and [#120](https://github.com/fvermaut/timone/issues/120).
- **Departures:** one, on how the work was run rather than on what was built — see below.

## Summary

`ivtrends` #88 showed one experience with three faults behind it. The checking step stopped mid-build and asked a question. The ticket said to run `timone takeover ivtrends#88`. That command re-ran the checking step from the start, the step could not act, and it posted the same refusal. Nothing was written into the ledger, so the ticket went on offering the same command, without limit.

Three fixes, each closing one of them.

**A build stage that hands back is filed as a fault, not parked.** Since [ADR-0052](../../../adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md), nothing between the approved list of pieces and the pull request may stop on a person. The escalation marker was already treated that way; the hand-back marker was not, and it is the one a session reaches for more often. Both now take the same path in `afterWorkStage` and `afterDelivery`. Outside the build nothing changes — planning, remediation and research still park on a hand-back.

**A takeover never opens a conversation at a build stage.** After the first fix, nothing can create that park. A ledger written by older code still holds some, so `resolveTakeover` refuses them, says why the state should not exist, and ends on `timone cancel` — a way out that is not the command that just failed.

**A conversation that moves nothing counts as an answer read.** The re-ask floor in `applyPark` already stops the daemon asking the same question forever, but it needs `Run.consumedAnswerAt`, and nothing on the takeover path ever set it. Both paths that claim a run for a takeover — the command's own, under the ledger lock, and the one the daemon serves when it holds the lock — now set it before the claim. A second stuck takeover at the same stage trips the existing limit and the wait becomes an escalation, which `resolveTakeover` already opens a different way.

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 38a — A build stage's hand-back is filed, not parked | As planned. Three tests that asserted the old behaviour now assert the new one. | `92799fb` |
| 38b — A takeover never re-opens a build stage | As planned, plus the fixture rename the plan called for. | `2990eee` |
| 38c — A stuck takeover stops offering itself | As planned, on both claim paths. Four new tests. | `6c95f9b` |

Every fix was written red first: each new or rewritten test was run against the unmodified code and seen to fail, then seen to pass. 1632 tests pass on the branch, up from 1628; `npm run build` is clean.

## Deviations from the plan

**The phase was built in a terminal session, not by the daemon.** The daemon planned it and then died before building it — the ticket carries its own account of that. fvermaut decided on 2026-09-11 to stop running Timone's runs against Timone itself for now and to work this ticket by hand. What was built follows the plan as written, sub-phase by sub-phase, with the same seams and the same red-green evidence. What is missing is the part of the process the daemon provides: no fresh-context sub-agent per slice, and no verification or delivery stage of their own.

## Context for the next agent

- `npx vitest run` from the repository root runs the whole suite (1632). The three touched files are `src/daemon/session.ts`, `src/commands/takeover.ts` and `src/daemon/poll.ts`.
- `markAnswerConsumed` is exported from `src/commands/takeover.ts` because `poll.ts` serves the same claim on the daemon's behalf. Any third path that claims a run for a conversation must call it too, before the claim — `repark` refuses a run that is not parked.
- PRD-03.R1 and R5 stay unproven. Both need a watched run, and neither has had one. This phase does not change that and does not claim to.
- One thing is untested by anything here: what a ticket now says when a build stage hands back. `ctaFor` reads the build-escalation prefix and renders the same words it already renders for an escalation — "I asked a question inside the build that I had no business asking, so I stopped", with a `timone retry` command. Those words were written for the escalation marker and were not re-read for this one.
