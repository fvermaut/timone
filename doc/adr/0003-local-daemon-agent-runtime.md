# ADR-0003: Local daemon as the agent runtime

- **Status:** accepted
- **Date:** 2026-07-19
- **Source:** grill session of 2026-07-19

## Context

Something must watch tickets/PRs and execute agent pipelines ("inversion of control"). Options: a daemon on fvermaut's own hardware; CI-native execution (e.g. GitHub Actions per project); Anthropic-hosted cloud agents; or staying human-launched.

## Decision

A Timone daemon runs on fvermaut's own hardware (Mac, later possibly a home server/VPS), polls the ticketing systems of managed projects, and spawns project-scoped agent sessions locally.

## Consequences

- Zero per-client cloud setup; all client credentials stay on owned machines; works with any git host.
- Polling, not webhooks: latency is bounded by the poll interval, and rate limits must be respected.
- Availability is tied to the machine being on; CI-based triggers can be added later per project without changing the process.
