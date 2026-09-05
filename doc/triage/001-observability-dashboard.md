# Triage 001: observability dashboard and run traces

- **Date:** 2026-09-05
- **Kind:** feature
- **Entry point:** timone-grill (stage 2) — timone-wayfind (stage 2 at scale) recommended
- **Source:** free-form request

## Request

> observability dashboard: what is the frontier, what is timone working on, what tickets are open, which PRD are verified/draft, etc - in which stage of the process, etc. + logs of agent process, inspect chat traces, etc. (timone trace)
>
> build as a "module" (same level as projects, but part of the monorepo (same git project as timone), and can be managed with timone process and tools -> dogfooding way)
>
> I was imagining having a webapp deployed on vercel, that allows me to monitor the process on all my projects, without having to access the CLI/console. Plus also in the future do what all the local timone CLI is doing (retry, etc.) from remote, when the stages are running in the cloud.

## Rationale

This is a feature, not a chore: it is new user-visible behaviour — a web application fvermaut opens to watch and later steer all projects — not an internal enabler. It is not a bug (no documented behaviour promises a dashboard; `timone status` is the only view today) and not a question. It is too big for one interview: at least five decision areas are independent and unresolved — what the dashboard shows and reads (state ledger, tickets, registers), how runs emit traces worth inspecting (nothing structured exists today), how a "module" inside Timone's own repo is declared and managed by the process, how a Vercel-hosted app reads state that lives on a local machine, and what remote commands (retry, cancel, takeover) require in auth and transport. Several block each other — the trace format shapes the dashboard; the deployment answer shapes everything. That is the wayfinding shape: chart it as a map of decision tickets and resolve them one session at a time. The human decides whether to chart or to start with a single interview.
