# ADR-0002: TypeScript with the Claude Agent SDK for the CLI and daemon

- **Status:** accepted
- **Date:** 2026-07-19
- **Source:** grill session of 2026-07-19 (library picks added at phase-01 planning)

## Context

Timone needs a CLI and a long-running daemon that spawn and supervise agent sessions. Options: TypeScript or Python, each with the Claude Agent SDK, or shelling out to headless `claude -p`. fvermaut's stack is TypeScript-centric (Next.js/NestJS/React client work).

## Decision

TypeScript (Node ≥ 22), using the Claude Agent SDK programmatically rather than shelling out to `claude -p` — structured control over system prompts, tools, permissions, hooks, session lifecycle, and streaming.

Supporting libraries (challengeable independently of the main decision): commander (CLI), zod (config validation), vitest (tests), npm (package manager).

## Consequences

- One language across harness and most managed projects; skills and harness evolve in the same ecosystem.
- Programmatic sessions enable the inversion-of-control loop (PRD-02): resuming/re-entering sessions on ticket replies, injecting skills at spawn time.
- We take a dependency on the Agent SDK's evolution; interactive Claude Code remains usable side-by-side for human-launched work.
