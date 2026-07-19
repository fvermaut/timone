# Timone — Product Overview

> **Status:** Draft — pending confirmation
> **Source:** Naming/architecture conversation (`tmp/Naming Your AI Development Harness.pdf`) + grill-me session of 2026-07-19.

## Problem statement

As a freelance software developer, my throughput is capped by being the human in the middle of every step: I prompt agents interactively in a CLI, review their output live, and manually run/test/deploy the result. The agent tooling exists (Claude Code, mature process skills from client work), but the control flow is inverted the wrong way — agents wait for me, instead of me supervising agents.

Timone is the steering mechanism for the whole development ecosystem: a meta-project that owns the agent harness, enforces a solid lifecycle process (requirements → architecture → coding → testing → deployment → maintenance), and lets agents run the show while I intervene asynchronously through tickets, pull requests, and preview deployments — from anywhere, without a terminal.

## Target user

Me (fvermaut) — solo freelancer managing multiple independent projects (personal and client work, different git hosts, ticketing systems, and deployment targets per client).

## Business goals — in priority order

1. **Complete process coverage** (requirement #1): every stage of software engineering — intake, requirements, architecture, planning, implementation, verification, delivery, feedback, deployment, maintenance — is covered by an explicit Timone skill producing a defined artifact behind a defined gate. One written process, enforced identically on every project.
2. **Inversion of control**: agents run that process autonomously; my involvement reduces to decisions and reviews delivered through tickets, PRs, and previews.
3. **Client-ready**: artifacts (specs, PRs, previews) presentable to customers; client code and credentials stay isolated per project on my own infrastructure.

## Success definition (MVP)

Two milestones, in order:

1. **Process layer** ([PRD-01](prd/prd-01-process-layer.md)): on any managed project, every development-side stage of the lifecycle can be driven through a Timone skill invoked interactively — from onboarding the project to delivering a verified pull request — with each stage producing its artifact in the project repo.
2. **Inverted loop** ([PRD-02](prd/prd-02-inversion-of-control.md)): a ticket filed on a managed GitHub project is driven by agents through those same stages — surfacing for my input only as ticket/PR comments — and results in a reviewable pull request with a live Docker preview, without me opening a terminal.

## Architecture pillars (decided)

- Timone's repo holds only orchestration code, skills, and config; projects are independent git repos cloned under a gitignored `projects/` dir, declared in a `timone.yaml` manifest.
- A TypeScript daemon + CLI on my own hardware, built on the Claude Agent SDK, watches tickets/PRs and spawns project-scoped agent sessions with Timone's lifecycle skills injected (never committed to client repos).
- Platform bindings are per-project adapters: git host, ticketing, preview target, and (later) spec store.
- Requirements/specs in each project's repo are the **single source of truth**; tickets scope work and point into them.

## Non-goals (for now)

- Production deployment and the maintenance loop (dependency updates, production bug triage).
- GitLab, Jira, and PaaS preview adapters (planned next, not MVP).
- External/customer-shared spec stores.
- Multi-user or team scenarios — Timone serves one human.
- An explicit architecture-stage artifact (needs its own design later).
