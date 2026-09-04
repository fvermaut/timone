# Phase 32 — live gate

> **Plan:** [phase-32.md](../phase-32.md), sub-phase 32e · **Decision:** [ADR-0050](../../../adr/0050-timone-becomes-a-managed-project-once-the-run-path-is-fixed.md)
> **Run:** 2026-09-04, from 20:05 UTC, on **`timone` itself** — the first time Timone has been worked by Timone.

## How it was set up

A real `timone daemon`, on the real ledger, on the real manifest, in a container.

**The process table was cleared first, not just the ledger.** Phase 31's boxed
gate found that `--state` isolates the ledger and not the tracker: two daemons
polled one project at once and nothing collided by luck. That mistake costs
more here, because the project is Timone.

- The daemon fvermaut started at 20:52 local (pid 74396) was stopped with
  `SIGTERM` at **20:05:03 UTC**. `ps` finds no daemon process after it and
  `.timone/state.json.lock` is gone.
- **Nothing was in flight when it stopped.** `ivtrends#74` had parked on a
  conversation at 20:02:23, and no run in the ledger was `active` or
  `picked-up`. No work was killed.
- fvermaut was asked before it was stopped, and answered *"Run it now"*.

**The ticket.** [timone#39](https://github.com/fvermaut/timone/issues/39) —
the primary sources owed for the UI/UX baseline's craft rules — was given the
`timone` label. The label did not exist on this repository and was created
with it. D-1 chose this ticket first deliberately: documentation only, no
code, and it exercises the whole loop cheaply.

**The daemon.** `node dist/cli.js daemon` from `docs/phase-32-plan`, started
at **20:05:5x UTC**, on the default runtime, which is the container.

_(filled in as the run went)_
