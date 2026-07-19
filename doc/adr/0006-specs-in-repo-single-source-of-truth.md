# ADR-0006: Specs live in the project repo as the single source of truth; tickets point into them

- **Status:** accepted
- **Date:** 2026-07-19
- **Source:** grill session of 2026-07-19

## Context

Requirements could live in the ticketing system, in Timone's repo, or in each project's repo. Stable requirement IDs, diffability, and branch-visibility of spec changes are load-bearing for the process (criteria registers drive verification).

## Decision

Each project's requirements and specifications (product overview, PRD pairs, criteria registers, ADRs, phase plans, reports) live in that project's own repo and are the **single source of truth**. Tickets exist to scope a unit of work and point into the specs — they never hold requirement detail themselves.

A per-project "spec store" adapter is foreseen so that projects whose specs must be shared with customers can later move them to an external documentation system; in-repo remains the default.

## Consequences

- Specs version, branch, and review with the code; agents find them in their working context without cross-repo wiring.
- Ticket bodies stay thin; discipline is needed to keep detail out of them.
- The future external-spec-store adapter must preserve stable IDs and machine-readable criteria, or verification breaks.
