# Handover — Timone — 2026-08-02 (evening)

> Prior handover: [2026-08-02-phase-10-closed-prd-02-next.md](2026-08-02-phase-10-closed-prd-02-next.md) — its "Exact next action" (plan PRD-02's first phase by hand) is done, but the plan is **not yet approved**; read this file instead.

## Snapshot

The conversation-medium grill happened and fvermaut accepted its summary in full. PRD-02 is amended accordingly — gates and conversations are now distinct interaction kinds, the harness owns all routing, and three requirements were added (R13–R15) with R3 revised. Two ADRs record the decisions. `process.md` and `CLAUDE.md` carry the new rules, **already in force for interactive sessions**. Phase 11 — the daemon's pickup/routing/serialization slice — is hand-planned at [`phase-11.md`](../plans/phases/phase-11.md) and stamped **`Awaiting approval`**. Nothing is built; `package.json` still has no Agent SDK dependency. Tree clean, `main` pushed, commits `27eb89f`–`dde0535`.

## Done this session

- **Grill session (9 questions), summary accepted** — decisions recorded in [ADR-0012](../adr/0012-conversation-channels.md) and [ADR-0013](../adr/0013-stateless-session-reentry.md); glossary created at [`CONTEXT.md`](../../CONTEXT.md) (Timone's own — gate, conversation, channel, takeover, CTA).
- **PRD-02 amended** — [narrative](../specs/prd/prd-02-inversion-of-control.md) + [register](../specs/prd/prd-02-inversion-of-control.criteria.md): R3 `revised`, R13 (harness-owned routing), R14 (conversation seam + `timone takeover`), R15 (guardrail hooks); session-continuity open question settled; Slack/observability/sandboxing scoped out explicitly.
- **`process.md`** — "Gates and the human" → "Gates, conversations and the human" (the split, ticket-only decision write-path, routing rule, CTA rule, stateless re-entry). **`CLAUDE.md`** — routing + CTA rule for interactive sessions.
- **[`phase-11.md`](../plans/phases/phase-11.md) drafted**, `Awaiting approval` — sub-phases 11a–11h, live proof on `scratch-app`, `timone` label settled as a permission boundary.
- **`STATUS.md`** updated in fvermaut's terms, including the build order (11 → gates+takeover → execution→PR → *pilot starts* → previews → Slack).
- Also this session, before the grill: harness-coverage audit against the Google paper's six components (conversation only — conclusions absorbed into the PRD amendments: hooks in, observability declined, sandboxing an accepted risk).

## In flight / blocked

- **Phase 11 is blocked on fvermaut's approval** of [`phase-11.md`](../plans/phases/phase-11.md). Per stage 6's entry gate, an unstamped plan is not executable — nothing may be built until the stamp exists.

## Decisions made this session

All fvermaut, 2026-08-02, at the grill (each recorded where linked — do not re-derive):

- Gates vs conversations split; gates ticket-only; conversation-closing acceptance is in-conversation; summary-to-ticket, transcripts informal-only → [ADR-0012](../adr/0012-conversation-channels.md).
- Terminal takeover first, Slack fast-follow behind a **real seam built now**; `timone takeover` CLI verb → ADR-0012 + PRD-02.R14.
- Stateless re-entry everywhere → [ADR-0013](../adr/0013-stateless-session-reentry.md).
- Guardrail hooks **in** (R15); run records/observability **declined**; sandboxing stays convention + path hook, revisit before any real client project → PRD-02 scope.
- Pilot starts after phase 13 (execution→PR), previews knowingly behind it → PRD-02 / phase-11 non-goals.
- Human never names a stage or skill, every human-facing message ends with a CTA → `process.md`, `CLAUDE.md`, PRD-02.R13.

## Exact next action

**fvermaut reads [`phase-11.md`](../plans/phases/phase-11.md) and approves (or asks for changes).** On approval: flip its Status line to `Approved for execution by fvermaut <date>`, commit `docs: approve phase 11`, then execute sub-phases 11a onward — **by hand**, as all Timone-self phases are (`/timone-execute` targets managed projects only; the skill's shape — TDD at the declared seams, one commit per sub-phase `<type>: 11x — <deliverable>`, handoffs file — is followed without the instrument). Start with 11a and 11b; they are independent.

## Open questions

- **Phase-11 plan approval itself** — fvermaut; may come back with changes (the ack/CTA wording gate at 11g is deliberately his to judge).
- **Preview exposure** (localhost vs public hostnames) — settle when building R8, phase 14.
- Carried unchanged from the prior handover: `scratch-app` PR #3 (merge + screen-reader HUMAN-CHECK) and PR #2 (2 ms budget decision) wait on fvermaut; the deferred list (R23, R24-needs-grill, deployment/maintenance skills, `timone-wayfind` first use, never-fired give-up paths, merged-branch deletion) stands.
