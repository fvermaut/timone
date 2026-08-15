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

**The daemon and the trigger.** A daemon on my own hardware polls the ticketing system of every managed project and picks up tickets marked for Timone (R1). Each pipeline stage runs as an agent session spawned by the daemon from the timone root, resolving its target project from the triggering event (R2, per ADR-0007). Work per project is serialized: one active ticket at a time, the rest visibly queued (R10). A status command shows each project's active ticket, stage, and any gate waiting on me (R9). Deterministic guardrail hooks check the rules agents most often silently break — pushed equals committed, `STATUS.md` on the default branch only, no files outside the target project, and every commit carrying its provenance trailer — and report violations loudly (R15). ✏ Revised 2026-08-06: those hooks bracket **every** session at the timone root, mine as well as the daemon's ([ADR-0018](../../adr/0018-the-session-bracket-belongs-to-the-hooks.md)) — a session I run myself is the one that broke a build, and it was unwatched only because the bracket lived in the daemon's own control flow.

**Sessions are accountable, and runs are observable enough to trust.** Each stage runs on a model and reasoning effort suited to its work rather than one default for everything (R16). While a session runs the daemon says so — elapsed time, turns, tokens and live sub-agents on a throttled line, and an authoritative cost when it ends (R17) — and that same tick is what proves the run alive, so a run orphaned by a crashed daemon is reclaimed, reported and freed instead of holding its project forever ([ADR-0017](../../adr/0017-a-runs-liveness-is-its-heartbeat.md), R18). Every commit a Timone session makes says which stage, run and session made it, so machine-authored work is identifiable from git history alone, in my repositories and my clients' ([ADR-0019](../../adr/0019-timone-authored-commits-carry-a-provenance-trailer.md), R19).

**The harness routes; the human never does.** The human is assumed to know nothing about the process. Every request — a ticket, a comment, a raw prompt in a terminal session — is classified and routed through triage by the harness; no surface ever requires the human to name a stage, a skill, or a process concept (R13). The same contract binds interactive sessions today and the daemon tomorrow.

**Gates and conversations** ([ADR-0012](../../adr/0012-conversation-channels.md)). Human interaction splits into two kinds. **Gates** — single decisions with one CTA — are ticket/PR replies, the sole write-path for decisions: the PRD pair is committed on a branch and gated on my approval via ticket comment (R4); the phase plan likewise (R5). **Conversations** — multi-turn interviews, clarification above all — run on a conversation channel behind a real adapter seam, with the terminal takeover (`timone takeover`) as first implementation and universal fallback, re-entering statelessly per [ADR-0013](../../adr/0013-stateless-session-reentry.md) (R3, R14); Slack follows behind the same seam, post-MVP. Execution then runs with sub-phase validation and fresh-context verification, reporting failures to the ticket (R6).

**The ticket is the interface, not one of two.** ✏ Added 2026-08-13 ([ADR-0024](../../adr/0024-every-open-ticket-answers-for-itself.md)). A wayfinder map's decision tickets are first-class participants in the loop rather than questions the daemon has never heard of (R20, per [ADR-0022](../../adr/0022-a-conversation-ticket-can-be-answered-in-writing.md)) — and above that, **every** open ticket on a managed project says what happens next and who acts, naming the daemon or the exact takeover command wherever one of them can move it, and naming what would unblock it where neither can (R21). Unmarked tickets are introduced to once so nothing filed sits silent; the wayfinder map becomes run-backed so an effort's closing hand-off to stage 3 happens where the human already is; `takeover` resolves any open ticket from the tracker rather than refusing what has no run; and the CTA is repaired each cycle rather than left to go stale, so what `timone status` says and what a ticket says cannot disagree.

**A ticket is a conversation; a run is a chunk of it.** ✏ Added 2026-08-15 ([ADR-0026](../../adr/0026-a-ticket-is-a-conversation-a-run-is-a-chunk.md), [ADR-0028](../../adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md), [ADR-0029](../../adr/0029-a-chunk-advances-only-on-success.md)). The ledger's founding identity — one ticket is one run, one branch, one pull request — ends: a ticket is the durable conversation an initiative lives in, and a run is one chunk of that work, so an initiative arrives a piece at a time in judgeable pull requests that all land in the one thread (R22). When the specification is approved the machine proposes the shape of the work as a committed breakdown, approved in a single gesture that is the one genuinely domain-level question — *is this the right shape* — and the per-chunk plan gate is retired in its favour: a chunk's phase file becomes an artifact rather than a gate (R5's own revision belongs to the phase that lands the breakdown). **The chunk holds the project, not the ticket**, so between one pull request merging and the next chunk starting the project is free and a bug filed mid-initiative takes its turn there rather than waiting weeks (R10 likewise moves with that phase); the thread says which piece is next while it does. A ticket closes when its last chunk's pull request merges. A chunk that *failed* is not finished business — it keeps its ticket until a human retries or cancels it, which is what stops an initiative silently reorganising itself around a crash — and any chunk can be ended by command, so clearing a run never means editing the ledger by hand. There is no such thing as an epic: a bug report is a ticket with one chunk and a milestone is a ticket with five, and the machine never needs the word.

**Delivery surface.** Completed work lands as a pull request referencing the ticket with the verification outcome (R7). The daemon builds and serves a Docker preview of the PR and posts its URL on the PR (R8); previews refresh on new commits and are torn down when the PR closes (R12). My review comments on the PR are triaged by the improve skill, acted on, and answered in-thread, with the preview updated (R11).

### Out of scope

- Production deployment on merge; any post-merge lifecycle.
- **The Slack conversation adapter** — a fast-follow behind the R14 seam, its specifics (app, events, threads, identity) decided in its own phase. GitLab/Jira adapters, PaaS previews, external spec stores — adapter seams only.
- Webhook or CI-based triggering — the MVP polls from the local daemon.
- Parallel tickets on one project (worktrees); cross-project shared state.
- Notifications beyond native GitHub ones — until the Slack adapter adds pings.
- Budget/cost controls, metrics dashboards, and **stored run records/observability** — considered at the 2026-08-02 grill and declined; transcripts live in informal daemon logs only, never citable. ✏ Narrowed 2026-08-06, so two approved texts do not disagree: R17's progress output and R18's `heartbeatAt` are **not** a reversal of this. What was declined, and stays declined, is *persisted, queryable, citable* run history — a metrics store, a dashboard, spend caps, transcripts an artifact may cite. What R17 adds is ephemeral terminal output, and what R18 adds is one liveness field the ledger needs to know whether a run is alive. The reported cost figure is information, not a control: nothing throttles or refuses a session on it. **`.timone/sessions.jsonl` sits closest to the line** — it persists — and is bounded by the same rule: it is machine state under the gitignored `.timone/`, never a process artifact, and no stage may cite it.
- **Sandboxing beyond the R15 path-containment hook** — sessions run unisolated on my hardware; accepted risk, recorded deliberately, to be revisited before the first real client project is managed.

## Open Questions

- **Ticket marking convention:** with routing harness-owned (R13), the mark is a *permission boundary* — which issues the daemon may touch — not a routing instruction. Label (`timone`) vs bot-account assignee: settle when building R1.
- **Preview exposure:** localhost-only vs reverse proxy with public hostnames (`pr-N.project.domain`) — decides whether reviews work from a phone; settle when building R8.

*Settled 2026-08-02:* session continuity — stateless re-entry everywhere, every human wait is a session boundary ([ADR-0013](../../adr/0013-stateless-session-reentry.md)).
