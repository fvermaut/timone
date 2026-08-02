# PRD-02: Inversion of Control — Ticket to Pull Request with Preview

> **Status:** Active
> **Project:** timone — see [product-overview.md](../product-overview.md)
> **Criteria register:** [prd-02-inversion-of-control.criteria.md](prd-02-inversion-of-control.criteria.md)
> **Depends on:** [PRD-01 — The Process Layer](prd-01-process-layer.md) (the stage skills this loop orchestrates)
> **Phases:** [phase-11](../../plans/phases/phase-11.md) (awaiting approval)
> ✏ Revised 2026-08-02 — grill session on the conversation medium ([ADR-0012](../../adr/0012-conversation-channels.md), [ADR-0013](../../adr/0013-stateless-session-reentry.md)): gates and conversations split into distinct interaction kinds, harness-owned routing added (R13), the conversation-channel seam with terminal takeover added (R14), post-session guardrail hooks added (R15), R3 revised, and the session-continuity open question settled.

## Problem

With the process layer in place (PRD-01), every lifecycle stage is runnable — but a human still launches each stage in a terminal and answers gates synchronously. That caps throughput at one attended session and couples all progress to my availability.

This PRD inverts the control flow: a ticket filed on a managed GitHub project is carried by agents through the PRD-01 stages — triage, clarification, requirements, planning, execution, verification, delivery — pausing only where a human is needed: **gates** expressed as ticket or PR comments, and **conversations** carried on a conversation channel (terminal takeover first, chat later — [ADR-0012](../../adr/0012-conversation-channels.md)) — and landing as a pull request with a live Docker preview. Production deployment and maintenance remain manual.

## Goals

- Prove the inverted loop end-to-end on the development side: my input reduced to asynchronous comment replies, reviewable from anywhere.
- Keep the process identical whether a stage is launched by me or by the daemon — the daemon orchestrates PRD-01 skills, it does not reimplement them.
- Establish the daemon + adapter foundations (GitHub, GitHub Issues, Docker previews) that later platforms plug into.

## Scope

### In scope

**The daemon and the trigger.** A daemon on my own hardware polls the ticketing system of every managed project and picks up tickets marked for Timone (R1). Each pipeline stage runs as an agent session spawned by the daemon from the timone root, resolving its target project from the triggering event (R2, per ADR-0007). Work per project is serialized: one active ticket at a time, the rest visibly queued (R10). A status command shows each project's active ticket, stage, and any gate waiting on me (R9). After each spawned session, deterministic guardrail hooks check the rules agents most often silently break — pushed equals committed, `STATUS.md` on the default branch only, no files outside the target project — and report violations loudly (R15).

**The harness routes; the human never does.** The human is assumed to know nothing about the process. Every request — a ticket, a comment, a raw prompt in a terminal session — is classified and routed through triage by the harness; no surface ever requires the human to name a stage, a skill, or a process concept (R13). The same contract binds interactive sessions today and the daemon tomorrow.

**Gates and conversations** ([ADR-0012](../../adr/0012-conversation-channels.md)). Human interaction splits into two kinds. **Gates** — single decisions with one CTA — are ticket/PR replies, the sole write-path for decisions: the PRD pair is committed on a branch and gated on my approval via ticket comment (R4); the phase plan likewise (R5). **Conversations** — multi-turn interviews, clarification above all — run on a conversation channel behind a real adapter seam, with the terminal takeover (`timone takeover`) as first implementation and universal fallback, re-entering statelessly per [ADR-0013](../../adr/0013-stateless-session-reentry.md) (R3, R14); Slack follows behind the same seam, post-MVP. Execution then runs with sub-phase validation and fresh-context verification, reporting failures to the ticket (R6).

**Delivery surface.** Completed work lands as a pull request referencing the ticket with the verification outcome (R7). The daemon builds and serves a Docker preview of the PR and posts its URL on the PR (R8); previews refresh on new commits and are torn down when the PR closes (R12). My review comments on the PR are triaged by the improve skill, acted on, and answered in-thread, with the preview updated (R11).

### Out of scope

- Production deployment on merge; any post-merge lifecycle.
- **The Slack conversation adapter** — a fast-follow behind the R14 seam, its specifics (app, events, threads, identity) decided in its own phase. GitLab/Jira adapters, PaaS previews, external spec stores — adapter seams only.
- Webhook or CI-based triggering — the MVP polls from the local daemon.
- Parallel tickets on one project (worktrees); cross-project shared state.
- Notifications beyond native GitHub ones — until the Slack adapter adds pings.
- Budget/cost controls, metrics dashboards, and **run records/observability** — considered at the 2026-08-02 grill and declined; transcripts live in informal daemon logs only, never citable.
- **Sandboxing beyond the R15 path-containment hook** — sessions run unisolated on my hardware; accepted risk, recorded deliberately, to be revisited before the first real client project is managed.

## Open Questions

- **Ticket marking convention:** with routing harness-owned (R13), the mark is a *permission boundary* — which issues the daemon may touch — not a routing instruction. Label (`timone`) vs bot-account assignee: settle when building R1.
- **Preview exposure:** localhost-only vs reverse proxy with public hostnames (`pr-N.project.domain`) — decides whether reviews work from a phone; settle when building R8.

*Settled 2026-08-02:* session continuity — stateless re-entry everywhere, every human wait is a session boundary ([ADR-0013](../../adr/0013-stateless-session-reentry.md)).
