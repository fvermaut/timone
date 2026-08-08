# Phase 16 — complete

> Closes [phase 16](../phase-16.md), the sixth phase of [PRD-02](../../../specs/prd/prd-02-inversion-of-control.md). Governing decision: [ADR-0021](../../../adr/0021-previews-are-reconciled-behind-an-adapter-seam.md). **Live gate signed off by fvermaut on 2026-08-08**; its evidence is [phase-16-live-gate.md](phase-16-live-gate.md).

> **The exit is [phase 17](../phase-17.md)** — planned since 2026-08-08, parked behind this phase, and now the thing to seek approval for.

## What closed

| ID | Priority | Requirement | Outcome |
| --- | --- | --- | --- |
| PRD-02.R8 | MUST | Docker preview per pull request | **verified**, with three gaps recorded on the requirement |
| PRD-02.R12 | SHOULD | Preview teardown | **verified**, both clauses |
| PRD-02.R11 | MUST | PR feedback loop | **stays `draft`** — the preview clause was not reached, and is now named on the requirement |

**Docker previews stopped being displaced.** They were phase 13's recorded next action, were displaced by phase 14, again by phase 15, and were about to share a phase with the liveness fix. [The phase 15 completion report](phase-15-complete.md) required that a third displacement restate the cost. There was no third displacement.

## What was built

Six slices, five of them touching code, in `c3674ba`, `9b808f6`, `6b8979b`, `bf3b003` and this report's commit.

- **16a — R8's criterion stopped presupposing a stage.** Both clauses now name a state a reviewer reaches rather than a mechanism that reaches it, and both go red against code with no previews at all. The same fault, found the same way, that [15d](../phase-15.md) fixed in R18. Correcting the *second* clause as well as the first was 16a's own call: leaving one mechanism-shaped precondition beside a corrected one would have re-created the fault at the next reading.
- **16b — the seam and the Docker adapter.** `ensure(project, pr, headSha)` / `release(project, pr)` per ADR-0021, with `Preview` carrying state, URL and reason. The Docker implementation drives a compose project and a detached git worktree per pull request, over an injected `CommandRunner` — which moved to its own module now that it has a second user, since a Docker adapter importing its subprocess seam from the GitHub adapter would couple two implementations that share nothing.
- **16c — reconciliation.** The poll loop brings every open Timone pull request on a bound project into line with the commit under review, and the pull request carries one preview comment that is *revised* rather than repeated.
- **16d — teardown.** A merged or closed pull request's preview is released in the same cycle that observes it, once per ending. Reopening needs no code of its own.
- **16e — the live gate.** Below.
- **16f — this report, the register, and `STATUS.md`.**

## Decisions that turned out to matter

- **Reading the port instead of allocating one.** `APP_PORT=0`, `POSTGRES_PORT=0`, and `docker compose port` reports what Docker chose. No allocation scheme, no registry, no collisions — and `scratch-app` needed no change, because its compose file already interpolated both. The accepted cost showed up exactly as predicted at the gate: the address moves when the stack is rebuilt, which is why the comment is edited in place rather than the URL being promised constant. **fvermaut was told this at approval and again at the gate, and did not object.**
- **The comment is a standing fact, not an event.** Everything else Timone says on a pull request is *this happened, then that did*, and appending is the honest record of an event. A preview is "this pull request is running here", whose truth changes. That is why the ticketing seam gained a ninth capability — a deliberate widening, with its reasoning on the call itself. Without it, a per-cycle reconciler would bury a client's pull request within the hour.
- **The adapter remembers per process and the ledger persists.** One preview, two places that could disagree, so only one of them is authoritative for the loop. A cold process re-converges once, harmlessly, because every operation is idempotent — which is better than two ledgers that can differ.
- **A failed commit is not retried at the same commit.** A broken build does not build differently a minute later; pushing a fix changes the commit and retries naturally. Watched working at the gate: `C` failed, `D` recovered with no intervention.

## What the gate found

**Phase 14 found six defects this way against 532 green tests. Phase 15 found an instrument that lied in the reassuring direction. This gate found four, against 581 — and none of the four was reachable by a unit test.**

1. **A failed preview told a reviewer `Dockerfile:74`.** True, one line, worthless. Docker leads with build progress and a source excerpt and puts its summary last; the reason was taking the first line. Only a real build could have produced this — every unit test fed the adapter an error whose first line was the interesting one, because that is what someone writing the test naturally invents.
2. **Timone's own `npm test` went red on the pilot's Playwright specs.** Previews check client source out at `.timone/previews/`, a **second** place client code lives inside the timone root; `vitest.config.ts` excluded `projects/**`, with a comment explaining exactly why, and knew nothing about the new one. This would have broken every future run of Timone's own tests, and no test could have caught it: the fault was in the thing that decides which tests exist.
3. **Teardown left 1.5 GB per pull request on the host, forever.** Containers, volumes and worktrees were removed; **built images were not**, and nobody had thought of them — 16d's checklist named the three that had occurred to someone. Found during the post-gate clean-up, by inspecting `docker images` after the sign-off rather than treating the sign-off as the end. **Its first fix did not work and reported success**: `docker compose down --rmi local`, the documented way, silently skips build-only services because compose fills in a default `image` name during normalisation and then treats it as custom. No error, no image, no signal. Removing them explicitly does work, and that was confirmed by looking at the host after a real teardown rather than at the flag's documentation.
4. **A failure reason was about to publish this laptop's absolute paths onto a client's public pull request.** Caught *before* the daemon ever ran, by driving the adapter against real Docker rather than a fake — which is the cheapest version of the same lesson.

## What this phase deliberately did not close

- **The liveness fix and the two clocks (R17, R18)** — [phase 17](../phase-17.md), on fvermaut's split of 2026-08-08. **The overnight prohibition therefore stands, unchanged and now for longer:** do not leave `timone daemon` running unattended overnight on a laptop that sleeps. This phase's own gate had to work around it by being driven attended, and **phase 16 earns no right to strike the warning — only phase 17's gate does.**
- **Phone review, and a preview reachable while the machine sleeps.** Recorded on R8 rather than implied away.
- **R11's preview clause.** Named on the requirement; the next real ticket that reaches delivery and receives a review comment closes it for free.
- **A preview on a pipeline-opened pull request.** The gate's fixture was opened by hand, on fvermaut's call, to avoid re-running stages 1–8 at the cost of a full pipeline run. Closes on the same next ticket.
- **The two-daemon ledger hazard** on `.timone/state.json` — and this phase widened it slightly, by adding `previews` to what two daemons would clobber. Named, not fixed.
- **A managed-platform adapter.** ADR-0021 makes it an implementation rather than a redesign, which was the point of deciding the seam now.
- **Preview authentication**, which no adapter staying on the host owes; **preview resource bounds**, which R10 keeps at roughly one per project today; **sub-agent output tokens obtained honestly**; the **frozen output-token counter**, unexplained since 14g and addressed by neither phase; a **`setup` skill**; the **real bot identity**; the **Slack adapter**; `scratch-app` #4, #10 and #13, all exactly where phase 15 left them.

## Open questions carried out of this phase

- **Does the changing port grate in practice?** Flagged to fvermaut at approval and again at sign-off, and not objected to either time. It stops being a question the moment an adapter mints stable URLs, which is a managed platform's job.
- **Nothing else new.** The list phase 15 handed over is unchanged.

## The habit this phase earned

**Drive the real thing before the gate, not at it.** The adapter was pointed at real Docker out of band, before the daemon was ever started — and that alone caught the leaked-paths defect and proved an argument vector no fake could have checked. The two defects that survived to the gate were both about what a *human* would see (a useless failure message; a broken `npm test`), not about whether the mechanism worked.

That is the complement to [15a's lesson](phase-15-clock-investigation.md) and 16's own: **look for an existing record before building anything**, then **run the real thing before you ask anyone to look at it.** Between them they turn a gate from a discovery exercise into a confirmation.

**And a coda the phase earned twice over: a sign-off is not the end of looking.** The 1.5 GB leak was found *after* fvermaut had signed off, during clean-up, and its first fix reported success while doing nothing at all. Both halves are the same habit phases 14 and 15 wrote down — **verify the instrument before believing its output** — applied to a command-line flag rather than to a clock. A flag that prints no error is not a flag that worked.
