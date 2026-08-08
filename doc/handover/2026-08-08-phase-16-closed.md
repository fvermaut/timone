# Handover — Timone — 2026-08-08

> Prior handover: [2026-08-08-phase-16-approved.md](2026-08-08-phase-16-approved.md). Its "Exact next action" — *execute phase 16, starting with 16a or 16b* — **is what this session did, all six slices including the live gate**. Same date, fourth session.

## Snapshot

**Phase 16 is complete and signed off; phase 17 is approved and not started.** Previews are real: an open Timone PR on a bound project carries one comment with a URL serving that branch's current commit, refreshed per poll cycle, torn down when the PR ends. Six commits, `c3674ba`..`6e1b0de`, all pushed; `main` level with `origin/main`, **584 tests green**, `type-check` clean, working tree clean, Docker host clean. **The next move is Timone's**: execute [phase 17](../plans/phases/phase-17.md), which fvermaut approved minutes after signing off phase 16.

## Done this session

- **[Phase 16 complete](../plans/phases/reports/phase-16-complete.md)** — all six sub-phases. **[R8](../specs/prd/prd-02-inversion-of-control.criteria.md) and R12 `verified`**, each carrying what the evidence does *not* cover; R11 stays `draft` with its outstanding clause named.
- **[16e's live gate](../plans/phases/reports/phase-16-live-gate.md)** — signed off by fvermaut. Read this before phase 17's gate: it is the first gate run against a *continuously running* daemon rather than `--once` cycles.
- **Four defects found, none reachable by a unit test.** All fixed, all in the reports. The fourth is the one to internalise — see Decisions.
- **[Phase 17 approved](../plans/phases/phase-17.md)**, and re-checked against `main` first as that plan required of itself. **Confirmed, not amended** — the re-check's findings are recorded in the plan's second blockquote.
- **[STATUS.md](../../STATUS.md) rewritten for phase 16** — the overnight warning survived, deliberately, with a paragraph saying why it may not be struck yet.

## In flight / blocked

- **Nothing is blocked.** Phase 17 needs no further input to start.
- **`scratch-app` #4 still parked at triage; #10 and #13 still `failed`** — untouched, exactly as the last three handovers left them.
- **`projects/scratch-app` sits on `timone/13-…`**, where this session found it and put it back.

## Decisions made this session

- **fvermaut chose a hand-opened fixture PR over a full pipeline run** for 16e, rather than spend ~$27 re-proving phases 11–13 to reach the thing phase 16 built. **The gap is on R8 and closes free** on the next real ticket that reaches delivery — as does R11's last clause.
- **The ticketing seam gained a ninth capability**, `upsertPullRequestComment`. Deliberate widening: a preview is a *standing fact whose truth changes*, not an event, and appending it per cycle would bury a client's PR. Reasoning is on the call itself in `src/adapters/ticketing.ts`.
- **`PullRequest` now carries `headSha`**, read from the tracker rather than a local clone — a clone that has not fetched would have the reconciler chasing a commit nobody is looking at.
- **A failed preview is not retried at the same commit.** A broken build does not build differently a minute later; a new commit retries naturally. Watched working at the gate.
- **The fourth defect is the one worth carrying forward: `docker compose down --rmi local` silently does nothing and reports success.** Teardown was leaving 1.5 GB per PR on the host. **A flag that prints no error is not a flag that worked** — this is [15a's instrument lesson](../plans/phases/reports/phase-15-clock-investigation.md) in a third key, and it was found only because the host was inspected *after* the sign-off.

## Exact next action

**Execute [phase 17](../plans/phases/phase-17.md), starting with 17a or 17b** (independent; 17a is the slice that lifts the overnight prohibition, so do not sequence it last).

**Timone's own execution stays hand-run** — `/timone-execute` targets managed projects only.

**Four things an executing agent will otherwise get wrong:**

1. **The ADR-0017 citations in `src/` are now this phase's to update** — `progress.ts`, `runs.ts`, `poll.ts`, `commands/daemon.ts`. Phase 16 was forbidden from touching them; 17a's checklist requires every one of them to name ADR-0020.
2. **`stateSchema` has a third top-level key since phase 16 (`previews`).** 17a adds `observedAt` and `observingSince` beside it. All three optional, `version` stays `1`.
3. **Assert that a genuinely dead run is *still* reclaimed BEFORE writing any skip test.** A fix that merely stopped reclaiming would pass 17c step 1 and be catastrophic. This is 15e's discipline and the plan makes it a gate item.
4. **`duration_api_ms` stays unread**, deliberately — on a control run it *exceeded* `duration_ms`, so nothing may treat one as bounding the other.

**17c cannot be run without fvermaut**, and not merely for a sign-off: the test is letting the laptop actually suspend with real work in flight. Schedule it with him; do not simulate it.

**The operational prohibition stands until 17c's evidence** — not until 17a merges. A code change is not evidence.

## Open questions

- **Why did the token counter freeze at 4.7k for four hours while replies advanced 8→22?** Unchanged. 5.8× under-reporting on a stage that spawned **no** sub-agents, so the fan-out story does not cover it. **It is why R17 may not close even in phase 17** — the plan says so explicitly, and 17d must not flip R17 on the clock alone.
- **Can sub-agent output tokens be obtained honestly?** Unchanged — the obvious fallback is the source 14b rejected for under-reporting ~30×.
- **Does a preview's changing port grate in practice?** Raised at approval and again at sign-off; not objected to either time. It dissolves when an adapter mints stable URLs, which is a managed platform's job.
- **Is reclaim-without-recovery too conservative?** Phase 17 makes unattended overnight runs survivable, which makes this question live for the first time rather than academic. Still not settled there.
- Carried unchanged: the real bot identity (needs a credential); one conversation medium behind the R14 seam; the deferred PRD-01 list (R23, R24); `scratch-app`'s screen-reader HUMAN-CHECK; the **two-daemon ledger hazard**, which phase 16 widened by one key and phase 17 widens by two more.
- **Closed by this session:** whether previews work (yes, watched); whether teardown is complete (it was not — images); whether R8's criterion could go red (it can now).

## A habit this session earned

**Run the real thing before you ask anyone to look at it — and keep looking after they say yes.**

The adapter was pointed at real Docker *before* the daemon was ever started, out of band. That alone caught a defect that would have published this laptop's absolute paths onto a client's public PR, and proved an argument vector no fake could check. The two defects that survived to the gate were both about what a **human** would see — a useless failure message, a broken `npm test` — not about whether the mechanism worked.

Then the fourth arrived *after* the sign-off, during clean-up, and its own first fix reported success while doing nothing. **A gate is not over when the human says yes**, and the previous phases' lesson — verify the instrument before believing its output — applies to a command-line flag exactly as it did to a clock.
