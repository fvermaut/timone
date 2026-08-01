# ADR-0011: Prototypes as throwaway reaction surfaces for discovery and PRD approval

- **Status:** accepted
- **Date:** 2026-08-01
- **Source:** grill session of 2026-08-01 — the "own decision" [ADR-0010](0010-wayfinder-discovery-maps.md) deferred

## Context

ADR-0010 adopted wayfinding but deferred the upstream `prototype` ticket type until Timone had a sanctioned prototyping convention. The human then surfaced a bigger need than the upstream shape: reading PRDs to approve them is tedious, and *reacting to a running artifact* is a friendlier validation surface — which also finally gives [ADR-0005](0005-docker-previews-on-own-host.md)'s Docker previews a pre-implementation caller. The risk that made the deferral: a prototype quietly becoming the implementation, bypassing stage 5 planning and stage 6's TDD-from-a-plan.

## Decision

Five branches resolved in the grill:

1. **Both uses, one convention.** Prototyping serves stage 2 at scale (a `prototype` ticket raising the fidelity of one open decision) *and* stage 3 (prototype-assisted PRD approval), sharing one definition of what a prototype is, where it lives, and how it dies.
2. **Lifecycle — throwaway branch, constitutionally unmergeable.** A prototype lives on `prototype/NN-<slug>` in the project repo so ADR-0005 previews can serve it clickable. It is never merged and never the base of a work branch — delivery refuses it, execution may not start from it, nothing is cherry-picked out of it. What survives is the human's *reaction*, recorded where the question lives; the branch is deleted when the effort it served closes.
3. **Stage-3 gate unchanged — prototype-assisted approval.** Approval still lands on the requirement list, never on the prototype, because a prototype systematically under-specifies (error paths, MUST/SHOULD priorities, non-UI requirements, accessibility criteria). The prototype is the reading aid: the agent maps what the human sees to requirement IDs, reactions edit the list, and every divergence between prototype and list is surfaced explicitly before approval is requested. Optional; offered when the work has a user-facing surface.
4. **Fidelity — cheapest artifact that answers the question**, from a static mock with fake data up to stubbed real-stack code only when the question demands it. Sized to one session; must be *experienceable* at a preview URL, never a screenshot. Prototypes are exempt from the accessibility baseline (they ship to nobody), but an approved inaccessible prototype waives nothing — the PRD's accessibility criteria stand.
5. **Ownership — `timone-prototype`**, a cross-cutting utility skill (the `timone-handover` shape, not a lifecycle stage), invoked by `timone-wayfind` and `timone-prd`, owning the lifecycle end to end: build, preview, capture reaction, delete.

This un-defers the `prototype` ticket type in `timone-wayfind`. ADR-0010 stands unedited — it explicitly anticipated this decision.

## Consequences

- The leak risk never fully dies: the fences are rules, and nothing yet *checks* that a work branch wasn't cut from a prototype branch — the same enforcement gap already noted for the `STATUS.md` branch rule.
- The preview path is asserted, not proven: ADR-0005's machinery has never served a prototype branch. First real use is the test.
- Whether daemon-driven sessions (PRD-02) can host a prototype reaction remotely — a HITL exchange over a preview URL plus ticket comments — is left to PRD-02's design.
- Stage-3 approvals gain an optional richer surface at the cost of building and then deleting an artifact; the one-session size bound is what keeps that trade honest.
