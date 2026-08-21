# Handover — Timone — 2026-08-21 (evening)

> Prior handover: [2026-08-21-the-app-exists-and-phase-29-waits-on-nothing.md](2026-08-21-the-app-exists-and-phase-29-waits-on-nothing.md)

## Snapshot

**Phase 29 is built, watched running, and merged.** All ten slices, [PR #52](https://github.com/fvermaut/timone/pull/52), on `main`. The live gate ran on `scratch-app`, found four faults, and all four are fixed. fvermaut read the four tickets it produced and said they made sense — the judgement 29h existed for.

The merge also brought **phase 30's first three slices** (30e, 30f, 30g) onto `main`, because the phase-29 branch was cut from `phase-30-work-in-a-box`. Both branches are deleted; `main` holds everything.

**1224 tests, 1219 green.** The five failures are [#8](https://github.com/fvermaut/timone/issues/8) and are not new.

**Nothing is blocked and nothing is waiting on fvermaut.** Phase 30 has nine slices left and 30a is the next one.

## Done this session

- **Phase 29, all ten slices** — [completion report](../plans/phases/reports/phase-29-complete.md), [slice-by-slice handoffs](../plans/phases/reports/phase-29-handoffs.md), [plan](../plans/phases/phase-29.md) marked Complete.
- **R23's wording confirmed by fvermaut** — the nine phase-30 slices behind it are released. Status stays `draft`; only stage 7 writes a verdict.
- **The live gate ran** on `scratch-app` [#45](https://github.com/fvermaut/scratch-app/issues/45)–[#48](https://github.com/fvermaut/scratch-app/issues/48). Four faults found, all fixed. Two were found by *reading what the machine wrote*, not by an assertion.
- **[PR #52](https://github.com/fvermaut/timone/pull/52) merged**; `phase-29-one-step-one-ticket` and `phase-30-work-in-a-box` both deleted.
- **`CONTEXT.md` gains four terms** — step ticket, map ticket, hold, dropped step. `Chunk` and `Breakdown` corrected.
- **[#8](https://github.com/fvermaut/timone/issues/8) updated** — it is five flaky tests now, not one, and the set varies per run.

## In flight / blocked

Nothing is in flight.

- **`scratch-app#4`** is stopped with its `timone` label removed. fvermaut cancelled it so the app was free for the gate. It will not restart by itself; `timone takeover scratch-app#4` is the way back in. Its analysis is intact on the ticket.
- **`scratch-app#45`–`#48`** are the gate's fixture and can be closed at any time. Nothing depends on them. `#46` carries `timone:held`.
- **`ivtrends`** — untouched this session. Still idle, still has no compose file, which phase 30 will make a hard requirement.

## Decisions made this session

- **The breakdown file has no dependency field, so the approved order *is* the dependency.** Each step waits for the one before it, written as GitHub's native `blocked by`. Nothing was invented and no artifact format changed. **Widening the format so a piece can declare a real dependency was not taken and is fvermaut's to ask for** — see the completion report.
- **`MAP_LABEL` (`timone:map`) was added** and is not in the plan. Something has to keep the daemon off the initiative's own ticket.
- **A dependency carries its own state**, not a number to resolve. `blocked by` returns bare numbers and admits other repositories, so `timone#8` and `scratch-app#8` are indistinguishable by number.
- **Settledness was kept.** ADR-0040 D3 ordered it deleted with the count; [ADR-0044](../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) corrects that. R22 clause 2 does not move.
- **`waitingOnYou` is false for a dropped step.** True was tried first and is wrong: `timone status` lists cancelled runs anyway, and the daemon cancels a run when its ticket is *closed*.

**Written down as a rule, because fvermaut called it out: [no metaphors](../../CLAUDE.md).** Say what a thing is, not what it is like. The drift happened while reporting work that had gone well.

## Exact next action

**Phase 30, slice 30a** — Timone's own identity and a credential scoped to one repository. It is the first unbuilt slice and four others depend on it.

The GitHub App already exists: `Timone Agent`, App ID **4670926**, installation **155426497**, key at `.timone/timone-agent.2026-08-21.private-key.pem` (gitignored, `chmod 600`). Permissions: `contents:write`, `issues:write`, `metadata:read`, `pull_requests:write`. **30a is the code that mints a token from it** — `credentials.ts` — not the human step, which is done.

Read [phase-30.md](../plans/phases/phase-30.md)'s blocker section first. **Blocker (d) is still open**: 30d wants a CI workflow, and the App has no Workflows permission by design. Either fvermaut commits that file by hand, or the grant is widened.

Timone's own phases are hand-run; `/timone-execute` is for managed projects.

## Open questions

- **Blocker (d), CI.** 30d creates a workflow file, and the App cannot. Human hand-commit, or widen the one permission most worth withholding. Unresolved. fvermaut decides.
- **Should the breakdown format carry real dependencies?** Today a job is always a chain. Nothing needs it yet. fvermaut decides.
- **Clause 5 of R22 has never fired live** — no step has closed on its merge, and no job has closed after its last step. Unit-proven, unwatched. Resolved by letting one job run end to end, which costs three full build/verify/deliver runs.
- **Three older rules carried forward, still unanswered** — see `STATUS.md`: the unlabelled-ticket contradiction, the 14 August give-up rule, and [#32](https://github.com/fvermaut/timone/issues/32), where triage can see work is further along and routes as if it were not.
