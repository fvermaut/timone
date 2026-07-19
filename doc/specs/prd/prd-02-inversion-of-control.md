# PRD-02: Inversion of Control — Ticket to Pull Request with Preview

> **Status:** Active
> **Project:** timone — see [product-overview.md](../product-overview.md)
> **Criteria register:** [prd-02-inversion-of-control.criteria.md](prd-02-inversion-of-control.criteria.md)
> **Depends on:** [PRD-01 — The Process Layer](prd-01-process-layer.md) (the stage skills this loop orchestrates)
> **Phases:** none yet

## Problem

With the process layer in place (PRD-01), every lifecycle stage is runnable — but a human still launches each stage in a terminal and answers gates synchronously. That caps throughput at one attended session and couples all progress to my availability.

This PRD inverts the control flow: a ticket filed on a managed GitHub project is carried by agents through the PRD-01 stages — triage, clarification, requirements, planning, execution, verification, delivery — pausing only at human gates expressed as ticket or PR comments, and landing as a pull request with a live Docker preview. Production deployment and maintenance remain manual.

## Goals

- Prove the inverted loop end-to-end on the development side: my input reduced to asynchronous comment replies, reviewable from anywhere.
- Keep the process identical whether a stage is launched by me or by the daemon — the daemon orchestrates PRD-01 skills, it does not reimplement them.
- Establish the daemon + adapter foundations (GitHub, GitHub Issues, Docker previews) that later platforms plug into.

## Scope

### In scope

**The daemon and the trigger.** A daemon on my own hardware polls the ticketing system of every managed project and picks up tickets marked for Timone (R1). Each pipeline stage runs as an agent session spawned by the daemon, confined to the target project's folder with Timone's skills injected (R2). Work per project is serialized: one active ticket at a time, the rest visibly queued (R10). A status command shows each project's active ticket, stage, and any gate waiting on me (R9).

**Human gates as comments.** The clarification stage posts its interview questions as ticket comments and resumes when I reply (R3). The PRD pair is committed on a branch and gated on my approval via ticket comment (R4); the phase plan likewise (R5). Execution then runs with sub-phase validation and fresh-context verification, reporting failures to the ticket (R6).

**Delivery surface.** Completed work lands as a pull request referencing the ticket with the verification outcome (R7). The daemon builds and serves a Docker preview of the PR and posts its URL on the PR (R8); previews refresh on new commits and are torn down when the PR closes (R12). My review comments on the PR are triaged by the improve skill, acted on, and answered in-thread, with the preview updated (R11).

### Out of scope

- Production deployment on merge; any post-merge lifecycle.
- GitLab/Jira adapters, PaaS previews, external spec stores — adapter seams only.
- Webhook or CI-based triggering — the MVP polls from the local daemon.
- Parallel tickets on one project (worktrees); cross-project shared state.
- Notifications beyond native GitHub ones.
- Budget/cost controls and metrics dashboards.

## Open Questions

- **Session continuity across gates:** resume the same Agent SDK session after days-long gate waits, or re-enter statelessly (fresh session reads artifacts + comment thread)? Leaning stateless re-entry.
- **Ticket marking convention:** label (`timone`), bot-account assignee, or both — settle when building R1.
- **Preview exposure:** localhost-only vs reverse proxy with public hostnames (`pr-N.project.domain`) — decides whether reviews work from a phone; settle when building R8.
