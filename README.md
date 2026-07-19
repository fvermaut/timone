# Timone

*Il timone* — the helm. A meta-project for agentic software development: Timone owns the agent harness and enforces one written engineering process across independent projects, inverting control so agents run the show and humans steer through tickets, pull requests, and preview deployments.

## Layout

- `doc/specs/product-overview.md` — why Timone exists, goals in priority order, MVP success definition
- `doc/specs/prd/` — requirements: PRD-01 (the process layer — a skill per lifecycle stage) and PRD-02 (inversion of control — the daemon-driven loop)
- `doc/plans/phases/` — executable phase plans
- `projects/` *(gitignored)* — managed project repos, declared in `timone.yaml` and materialized by `timone workspace sync`

## Status

Pre-implementation: founding specs written, phase 1 (process spec + workspace foundations) planned.
