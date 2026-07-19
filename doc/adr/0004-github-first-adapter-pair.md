# ADR-0004: GitHub + GitHub Issues as the first platform adapter pair

- **Status:** accepted
- **Date:** 2026-07-19
- **Source:** grill session of 2026-07-19

## Context

Platform bindings (git host, ticketing, previews) are per-project adapters. The first implemented pair defines the MVP. Client work will eventually need GitLab + Jira; Linear was considered for its agent-friendly API.

## Decision

The first adapter pair is GitHub for code hosting and GitHub Issues for ticketing, with pull requests as the review surface. GitLab and Jira adapters follow after the loop is proven.

## Consequences

- One API and one token to integrate; `gh` CLI available everywhere; the issue → branch → PR → comment loop is native.
- The adapter seams (ticketing, git host) must still be real interfaces from day one, or the GitLab/Jira ports will be rewrites.
- The pilot project must live on GitHub.
