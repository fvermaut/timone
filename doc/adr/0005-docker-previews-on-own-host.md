# ADR-0005: Docker previews on own infrastructure as the first preview adapter

- **Status:** accepted
- **Date:** 2026-07-19
- **Source:** grill session of 2026-07-19

## Context

Human validation of agent work happens on preview deployments of each PR. Options: PaaS-native previews (Vercel/Netlify — frontend-shaped projects only), per-project mixed adapters from day one, or Docker on owned infrastructure.

## Decision

The first preview adapter builds and runs each PR's stack as Docker containers on fvermaut's own host, addressable per PR (target shape: `pr-N.<project>.<domain>` behind a reverse proxy — exposure model still an open question in PRD-02).

## Consequences

- One adapter covers every project type, including backends and databases; client code never leaves owned infrastructure.
- Requires each managed project to be containerizable (a Dockerfile/compose file becomes an onboarding concern).
- Host resources bound the number of simultaneous previews; teardown on PR close matters.
