# ADR-0059: A live check only the operator can run rides to the pull request

- **Status:** accepted
- **Date:** 2026-09-25
- **Source:** fvermaut, on [ivtrends#126](https://github.com/fvermaut/ivtrends/issues/126), 2026-09-25: *"ivtrends#126 is stuck, takeover and retry are not working"*. He agreed to both decisions below in the same session.
- **Amends:** [ADR-0051](0051-timone-verifies-itself-by-live-gate-and-a-regression-set-is-narrowed-by-what-it-depends-on.md) D3 and [ADR-0052](0052-a-run-that-enters-the-build-ends-at-its-pull-request.md), which kept an owed live gate as a refusal at delivery.

## Context

A `live` criterion is checked by a supervised run against real infrastructure. [PRD-09.R16](https://github.com/fvermaut/ivtrends/blob/main/doc/specs/prd/prd-09-the-ibkr-import.criteria.md) on ivtrends is one: one fetch from the operator's own IBKR account, with the operator watching. Only the operator can run it, because it needs their login and token.

ADR-0052 removed every refusal at delivery except two: a missing report, and a live gate the phase owes and has not run. On ivtrends #126 the second one made a loop:

1. Delivery found R16's live gate owed, refused, and asked the operator to run `timone takeover ivtrends#126`.
2. The daemon expects delivery to end with an open pull request ([ADR-0056](0056-a-build-stages-question-rides-to-the-pull-request.md)). There was none, so it marked the run failed.
3. `timone takeover` refused a failed run and said "re-mark the ticket".
4. `timone retry` ran delivery again, which refused again for the same reason.

This happened twice in one day. Neither command could get past a check that only the operator can do, and the ticket offered no other way.

## Decision

**D1 — An owed live gate does not stop delivery.** Delivery opens the pull request and puts each owed live gate on it as an unticked item: the criterion, and where its steps are written. This is how an unperformed HUMAN-CHECK is already carried. The criterion stays `draft`. Merging is the operator's yes, and the pull request is where the operator already is. Every live gate needs a person watching it, so the rule covers every live gate, not only ones that need an account.

**D2 — `timone takeover` opens a failed run.** A failed run is changed to a run waiting on a person, with what stopped it as the thing it waits on, and the takeover opens the session bound to no stage ([ADR-0033](0033-a-stage-that-cannot-act-on-an-answer-escalates.md)). The run keeps its branch and stage. When the session ends, the run is handed back as any stopped run is ([ADR-0035](0035-a-resolved-escalation-hands-the-run-back.md)). The command the ticket offers now works, whatever state the run is in. `timone retry` stays as it was.

## Consequences

- Delivery's only refusals about the work are a missing report and a changed screen with no comparison ([ADR-0057](0057-every-screen-a-phase-changes-is-looked-at-and-its-figures-read-on-the-preview-data.md)).
- A pull request can open with a live gate not yet run. The item on the pull request says so. The person who merges decides whether to run it first.
- A run can move from `failed` to `parked`, but only through `timone takeover`.
- `ivtrends` #126 was unblocked by hand the same day: the operator's fetch had already happened, and the comparison was recorded as [phase-43-live-gate.md](https://github.com/fvermaut/ivtrends/blob/timone/126-5-ready-for-the-real-account/doc/plans/phases/reports/phase-43-live-gate.md).
