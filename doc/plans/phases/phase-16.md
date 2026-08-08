# Phase 16: a pull request you can click

> **Status:** **Awaiting approval.** Hand-planned 2026-08-08, as all Timone-self phases are (`/timone-plan` targets managed projects only); the plan skill's shape rules — thin vertical slices, declared seams, per-slice validation — are followed, not the instrument. Approval is gated on this file per [ADR-0014](../../adr/0014-artifact-first-gates.md).

> **Sixth phase of [PRD-02](../../specs/prd/prd-02-inversion-of-control.md).** Governing decision: **[ADR-0021](../../adr/0021-previews-are-reconciled-behind-an-adapter-seam.md)** (previews are reconciled behind an adapter seam), extending [ADR-0005](../../adr/0005-docker-previews-on-own-host.md). Standing: [ADR-0007](../../adr/0007-sessions-at-timone-root.md), [ADR-0014](../../adr/0014-artifact-first-gates.md), [ADR-0019](../../adr/0019-timone-authored-commits-carry-a-provenance-trailer.md).

> **This phase was split out of a larger one on fvermaut's decision, 2026-08-08.** The first plan carried previews *and* the liveness fix [ADR-0020](../../adr/0020-liveness-is-judged-only-over-witnessed-time.md) decides. fvermaut split them and took previews first, judging the liveness defect *"more a bug I can live with"*. The other half is [phase 17](phase-17.md), planned and parked.

## The honest scope of this phase, stated first

**Docker previews stop being displaced.** They were phase 13's recorded next action, were displaced by phase 14, again by phase 15, and were about to share a phase with the liveness fix. [The phase 15 completion report](reports/phase-15-complete.md) required that a third displacement restate the cost; **there is no third displacement — this phase is previews, and only previews.**

**What this costs, stated once and not repeated as a warning in every section.** The liveness fix moves to [phase 17](phase-17.md), so **the operational prohibition stands for the whole of this phase**: `timone daemon` must not be left running unattended overnight on a laptop that sleeps, because a healthy run would be reclaimed and its branch abandoned. fvermaut accepted that on 2026-08-08 with the measurement in hand — 113 suspensions past the staleness threshold in one night ([15a](reports/phase-15-clock-investigation.md)).

**And it lands on this phase's own gate, which is why it is here rather than in a footnote.** Previews reconcile *per poll cycle*, so proving R8 and R12 means running a daemon continuously rather than the `--once` cycles every previous gate used. **16e must therefore be driven attended** — at the machine, with the lid open — and it must say so in its evidence, because a preview proven under an attended daemon has not been proven under an unattended one. Phase 17 is what removes that condition.

**The ADR gate fired before this plan was written and is discharged.** PRD-02 deferred the preview exposure model with *"settle when building R8"*; the grill of 2026-08-08 settled it and [ADR-0021](../../adr/0021-previews-are-reconciled-behind-an-adapter-seam.md) records it. **No slice below resolves an open decision.**

## Requirements

> **PRD:** [prd-02-inversion-of-control.md](../../specs/prd/prd-02-inversion-of-control.md) — criteria in [prd-02-inversion-of-control.criteria.md](../../specs/prd/prd-02-inversion-of-control.criteria.md)

| ID | Priority | Requirement (one line) | This phase |
| --- | --- | --- | --- |
| PRD-02.R8 | MUST | Docker preview per pull request | **closes** — 16a–16c |
| PRD-02.R12 | SHOULD | Preview teardown | **closes** — 16d |
| PRD-02.R11 | MUST | PR feedback loop | **closes only if the gate reaches its preview clause** — three of four clauses were observed at 13h; the fourth needs a review comment carried through remediation *with* a preview refreshing. If the gate does not get there, it stays `draft` and the report names the outstanding clause |

**R8's limit, recorded now rather than discovered at verification.** The first adapter serves on `localhost`, on a laptop that suspends. R8 verifying proves a preview is built, addressed, refreshed on a new commit and removed on close. **It does not prove phone review, and it does not prove a preview reachable while the machine sleeps** — PRD-02's exposure question named phone review as the thing at stake, so an unqualified `verified` would imply something untrue. The gap goes on the requirement ([ADR-0021](../../adr/0021-previews-are-reconciled-behind-an-adapter-seam.md)).

Deliberately **not** this phase: **the liveness fix and the two clocks (R17, R18)** — [phase 17](phase-17.md), on fvermaut's split; the Slack adapter; a real bot identity (still needs a credential); the **two-daemon ledger hazard** on `.timone/state.json`, which 16c marginally widens by adding `previews` to what two daemons would clobber; **sub-agent output tokens obtained honestly**; a **`setup` skill**; preview **authentication**, which no adapter staying on the host owes; a **managed-platform adapter**, which ADR-0021 makes an implementation rather than a redesign; `scratch-app` #4, #10 and #13, all exactly where phase 15 left them.

## Goal Description

A pull request becomes something you can open rather than read.

Today a Timone PR carries scope, a verification outcome and two review reports, and nothing you can click. After this phase, every open Timone pull request on a bound project carries a URL that serves that branch's current commit, refreshes within a poll cycle when the branch moves, and disappears when the PR ends — with the containers, their volumes and the worktree removed rather than left to accumulate on the host.

Most of the mechanism already exists and is not in question. `scratch-app`'s `compose.yaml` was written for this from the start — *"Doubles as the definition the PR-preview adapter runs on our own host: no host-machine assumptions, no fixed per-container names (they break running two instances), every host port interpolated."* What is missing is the adapter that drives it and the reconciliation that calls the adapter.

**Load-bearing decisions, fixed here so slices don't re-litigate them:**

- **The seam is `ensure(project, pr, headSha)` and `release(project, pr)`**, per [ADR-0021](../../adr/0021-previews-are-reconciled-behind-an-adapter-seam.md). `ensure` returns state **and URL**; the URL belongs to the adapter. Nothing outside an adapter knows an addressing scheme, which is what lets a managed-platform adapter drop in later without touching the poll loop.
- **The adapter reads the port rather than allocating one.** The stack comes up with `APP_PORT=0` and `POSTGRES_PORT=0`, so Docker assigns free host ports, and `docker compose port app 3000` reports what was assigned. **There is no allocation scheme to collide, and `scratch-app` needs no change** — its compose file already interpolates both with defaults. The accepted cost: **a preview's port changes when its stack is rebuilt**, so the URL is not stable across a new commit. The PR comment is updated in place rather than the URL being promised constant.
- **One compose project per PR, and a git worktree per PR.** `docker compose -p <project>-pr-<n>` gives distinct container names and volume prefixes — what the compose header was written for. Source comes from `git -C projects/<name> worktree add .timone/previews/<project>/pr-<n> <sha>`: **under the timone root, never inside the client's working tree**, which is R2's rule about harness files.
- **Seeding is a compose profile, not an npm script.** If the project's compose file declares a `seed` service, the adapter runs that profile after migrations; otherwise the preview comes up empty. The adapter asks compose, never `package.json`, so it stays project-type-agnostic. **`scratch-app` declares no `seed` service today, so its previews come up empty — that is the "empty if absent" case working, not a gap.**
- **Real data is refused** ([ADR-0021](../../adr/0021-previews-are-reconciled-behind-an-adapter-seam.md)). No slice here may add a path that copies or restores from anything but a committed seed.
- **The adapter takes an injected `CommandRunner`**, exactly as `GitHubTicketingAdapter` does, so every test asserts the argument vector and nothing shells out.
- **A failed preview never blocks delivery.** The pull request is the deliverable; the preview is an aid to reviewing it. A failed `ensure` is a returned value that gets posted on the PR, never an exception and never a park.
- **Previews are not a pipeline stage.** `PIPELINE_STAGES` gains no member and no run enters a preview state; reconciliation happens in the poll loop for every open Timone PR on a bound project. R8's criterion presupposes otherwise and is corrected in 16a — **the same fault 15d fixed in R18, found the same way.**
- **A preview outlives the run that opened it**, so its record is top-level on the state rather than a field on a run: a delivered run parks on `review` and the PR keeps living after it.

## Context & Prerequisites

- Phase 15 closed 2026-08-08. **539 tests green**, `type-check` clean, `main` level with `origin/main` at `19c8d67`.
- **[ADR-0021](../../adr/0021-previews-are-reconciled-behind-an-adapter-seam.md) is the governing decision** and was recorded before this plan, from the grill of 2026-08-08.
- **[ADR-0020](../../adr/0020-liveness-is-judged-only-over-witnessed-time.md) is accepted and deliberately unimplemented** until [phase 17](phase-17.md). It supersedes ADR-0017, whose status line is flipped and whose body is untouched. **Code comments in `progress.ts`, `runs.ts`, `poll.ts` and `commands/daemon.ts` still cite ADR-0017, correctly** — they describe behaviour that has not changed yet. Updating them is phase 17's, not this phase's; **no slice here may "tidy" those citations**, which would make the code claim a fix that does not exist.
- **`scratch-app`'s `compose.yaml` needs no change**: `app` profile, interpolated host ports, prefixed volumes, a `migrate` job gated on successful exit, and a healthcheck on `app` that answers "ready to be looked at".
- **`manifest.ts` already carries `preview: z.literal("docker").optional()`** — the binding slot exists and is unset for `scratch-app`. Setting it is 16c's.
- **`src/adapters/` holds the seam precedent**: an interface in `ticketing.ts`, a GitHub implementation beside it, `CommandRunner` injected, PR types and `PR_STATES` already defined. The preview adapter is its sibling and follows it.
- **No preview code exists anywhere in `src/`** — the three matches for "preview" are manifest schema and a comment.
- **A live PR is needed for 16e and none is open.** The gate files its own fixture ticket rather than reusing `scratch-app` #13, which sits `failed`; carrying that is a `scratch-app` decision, not this phase's.
- **Docker must be running on the host** for 16e, and only for 16e. Every slice before it proves itself against an injected fake.

## Sub-phases

### Sub-phase 16a: R8's criterion stops presupposing a stage

**[MODIFY]** `doc/specs/prd/prd-02-inversion-of-control.criteria.md` — R8's first criterion reads *"WHEN the preview stage runs"*, and under [ADR-0021](../../adr/0021-previews-are-reconciled-behind-an-adapter-seam.md) there is no preview stage: reconciliation happens in the poll loop and `PIPELINE_STAGES` gains no member. The criterion is rewritten to name **a state the world reaches**, not a mechanism that reaches it, and must be able to go red. The old wording and why it was inadequate stay in the annotation.

**This is a specification correction, not an intent change** — R8 has always asked for a running, reachable preview per PR. It is here for the same reason 15d existed: a criterion that presupposes a mechanism cannot go red when that mechanism is absent, so the requirement would read as satisfiable by something nobody built.

**Seams under test (TDD):** none — no behaviour-carrying code.

> No dependency on other sub-phases. Sequenced first so everything below is built against a criterion that means what it says.

#### Agent Validation Steps

```bash
grep -n "preview stage runs" doc/specs/prd/prd-02-inversion-of-control.criteria.md   # expect no match
```

- [ ] The new criterion names no mechanism — not a stage, not a poll cycle, not Docker
- [ ] It can go red against today's code, where no preview exists at all
- [ ] The old wording survives in the annotation

---

### Sub-phase 16b: the preview seam and the Docker adapter (R8)

**[NEW FILE]** `src/adapters/preview.ts` — `PreviewAdapter` with `ensure(project, pr, headSha): Promise<Preview>` and `release(project, pr): Promise<void>`; `Preview` carries `state` (`ready | building | failed`), `url` when ready, and `reason` when failed. Zod schemas beside the types, as `ticketing.ts` does.
**[NEW FILE]** `src/adapters/docker-preview.ts`, `docker-preview.test.ts` — the Docker implementation over an injected `CommandRunner`: worktree add at `headSha`, `docker compose -p <project>-pr-<n>` up with the `app` profile and both ports zeroed, the `seed` profile when the compose file declares one, readiness from the `app` healthcheck, and the URL from `docker compose port app 3000`.

**Seams under test (TDD):** the argument vector for a first `ensure` — worktree, compose project name, both ports zeroed, `app` profile — asserted **verbatim**, because it is the entire contract with Docker and a wrong flag here is invisible until the live gate; `ensure` at a **new** `headSha` replaces the stack and moves the worktree, rather than adding a second one; `ensure` at an **unchanged** sha on a ready preview issues no docker work and returns the same URL — the property that makes per-cycle reconciliation cheap rather than a rebuild loop; the URL is **read**, never computed, asserted by returning an unexpected port from the fake and finding it in the URL; a project whose compose file declares no `seed` service comes up without it and is `ready`, not `failed`; a stack whose healthcheck never passes returns `failed` with a reason and **does not throw**; `release` tears down with volumes and removes the worktree, and is idempotent against a preview already gone.

> No dependency on other sub-phases. This is the long pole of the phase.

#### Agent Validation Steps

```bash
npx vitest run src/adapters/docker-preview.test.ts
npm run type-check
npm test
```

- [ ] Nothing shells out in tests — every docker and git call goes through the fake runner
- [ ] The unchanged-sha path is proven a **no-op**, not merely fast
- [ ] A failed preview is a returned value, never an exception
- [ ] No file is written inside `projects/<name>/` by the adapter
- [ ] No path copies or restores data from anywhere but a committed seed

---

### Sub-phase 16c: previews reconcile every cycle and land on the PR (R8, R11)

**[MODIFY]** `src/daemon/poll.ts`, `poll.test.ts` — for each project whose manifest carries a preview binding, reconcile every open Timone PR against its head sha and record the result.
**[MODIFY]** `src/daemon/runs.ts`, `runs.test.ts` — a top-level optional `previews` record keyed by project and PR number, holding the last known sha, state and URL. Top-level because a preview outlives its run; optional so `version` stays `1` and existing state files load unchanged.
**[MODIFY]** `src/adapters/ticketing.ts` — a `PREVIEW_MARKER` beside the existing markers, so the preview comment is identifiable and updated rather than duplicated.
**[MODIFY]** `timone.yaml` — `scratch-app` gains `preview: docker`.

**Seams under test (TDD):** a project with **no** preview binding is not reconciled at all and issues zero docker commands — the assertion that keeps previews opt-in; the URL comment is posted **once** and updated in place when the URL changes, never duplicated across cycles, asserted over at least three simulated cycles — **the failure mode a per-cycle reconciler creates, and the one that would spam a client's PR**; a PR whose head sha has not moved produces no comment and no docker work; a preview returning `failed` posts its reason on the PR and **the cycle continues to the next project**, so a broken build never blocks delivery; an adapter that throws is caught into `result.errors` like any other adapter failure, leaving the rest of the cycle intact; an existing state file with no `previews` key loads and `version` stays `1`.

> Sub-phase 16b must be complete. 16a should be complete.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/poll.test.ts src/daemon/runs.test.ts
npm run type-check
npm test
```

- [ ] An unbound project issues zero docker commands
- [ ] The comment is idempotent across at least three simulated cycles
- [ ] A failed preview is reported and non-blocking, asserted by the cycle's later work still happening
- [ ] An old state file loads unchanged, `version` still `1`

---

### Sub-phase 16d: previews end when their pull request does (R12)

**[MODIFY]** `src/daemon/poll.ts`, `poll.test.ts` — a PR that is merged or closed is `release`d and its record dropped, within the same cycle that observes the state change.

**Seams under test (TDD):** a merged PR's stack is released on the next cycle and its record removed; a closed-not-merged PR likewise; **a reopened PR gets a preview again with no code of its own** — reconciliation's own property and R12's second clause for free, so it is *asserted* rather than implemented; release happens **once** per PR ending rather than on every subsequent cycle, so a closed PR does not generate work forever; a release that fails is reported and does not wedge the cycle.

> Sub-phases 16b and 16c must be complete.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/poll.test.ts
npm run type-check
```

- [ ] Reopening needs no code of its own — assert it, don't implement it
- [ ] Release happens once per PR ending, not per cycle

---

### Sub-phase 16e: live gate — a URL that opens

**[NO CODE.]** A live run, and the human gate.

**Driven attended, with the lid open.** Previews reconcile per poll cycle, so this gate runs a *continuous* daemon rather than the `--once` cycles every previous gate used — and the liveness defect [phase 17](phase-17.md) fixes is still present, so an unattended run would reclaim healthy work. **The evidence must record that the daemon was attended**, because a preview proven under an attended daemon has not been proven under an unattended one.

1. **A preview exists and opens.** File a fixture ticket, carry it to a pull request, and open the URL posted on that PR in a browser. `docker ps` shows the stack under its per-PR compose project name.
2. **The port was read, not computed** — confirm the published port against `docker compose port` rather than against any expectation.
3. **It refreshes.** Push a visible change to the branch; confirm the preview serves it within one poll cycle and the PR comment is **updated in place, not duplicated**.
4. **Two previews coexist** if a second project or PR can be arranged — the property `compose.yaml`'s header was written for, and the one an allocation scheme would have broken. If it cannot be arranged, say so rather than implying it was checked.
5. **Teardown.** Close the PR; confirm within one cycle that the containers are gone, the **volumes** are gone, and the worktree under `.timone/previews/` is removed. Reopen it and confirm the preview returns.
6. **A failed preview is survivable.** Break the build deliberately on a branch; confirm the failure is posted on the PR, the run is not parked, and delivery is unaffected. **A preview adapter that could wedge the pipeline is worse than no preview adapter.**
7. **R11's preview clause, if the gate reaches it** — a review comment carried through remediation with the preview refreshing. If not reached, R11 stays `draft` and the report names the outstanding clause.

**Seams under test (TDD):** none — this is the live gate, and its whole point is evidence no unit test can reach. Phase 14 found six defects this way against 532 green tests; phase 15 found an instrument that lied in the reassuring direction.

> Sub-phases 16b, 16c and 16d must be complete.

#### Agent Validation Steps

```bash
node dist/cli.js daemon --interval 30        # attended, lid open
docker ps --filter "name=scratch-app-pr-"
docker volume ls | grep scratch-app-pr-
ls .timone/previews/scratch-app/
```

- [ ] Steps 1–7 each observed, evidence captured for the completion report
- [ ] The evidence states plainly that the daemon was **attended**, and why
- [ ] Every instrument verified before its output is believed — [the habit phases 14 and 15 both earned](reports/phase-15-clock-investigation.md), which has now produced one fabricated defect and one fabricated clean bill of health
- [ ] Volumes and worktrees confirmed gone, not just containers — the accumulation nobody notices until the disk fills
- [ ] **Human gate:** fvermaut confirms a preview URL is worth opening, and that a PR carrying one is better to review than a PR without

---

### Sub-phase 16f: documentation, register, and the route out

**[MODIFY]** `doc/specs/prd/prd-02-inversion-of-control.criteria.md` — R8 `verified` on steps 1–4, R12 on step 5, R11 per step 7. **The phone-review gap and the sleeping-host gap are recorded on R8** rather than left implied by an unqualified `verified` ([ADR-0021](../../adr/0021-previews-are-reconciled-behind-an-adapter-seam.md)).
**[MODIFY]** `STATUS.md` — phase 16 in plain language. **The overnight warning stays**, because this phase does not touch its cause; the entry says previews are here and the sleeping-laptop fix is next.
**[NEW FILE]** `doc/plans/phases/reports/phase-16-complete.md` — what closed, what did not, and the exit: **[phase 17](phase-17.md), already planned and awaiting approval**.
**[NEW FILE]** `doc/plans/phases/reports/phase-16-live-gate.md` — the gate's evidence.

**Seams under test (TDD):** none — no behaviour-carrying code.

> All prior sub-phases must be complete.

#### Agent Validation Steps

```bash
grep -n "overnight" STATUS.md
grep -n -A6 "^## R8" doc/specs/prd/prd-02-inversion-of-control.criteria.md
```

- [ ] R8 carries the phone-review and sleeping-host limits explicitly
- [ ] The overnight warning **survives** into `STATUS.md` — this phase earned no right to strike it
- [ ] The report names phase 17 as the exit

## Dependency graph

```
16a → (none)          R8's criterion stops presupposing a stage
16b → (none)          the preview seam and the Docker adapter (R8)
16c → 16b, 16a        previews reconcile every cycle and land on the PR (R8, R11)
16d → 16b, 16c        previews end when their PR does (R12)
16e → 16b, 16c, 16d   live gate: a URL that opens
16f → all prior       docs, register, reports
```

16a and 16b are independent and may run in either order or together. 16b is the long pole and everything downstream waits on it, so it should not be sequenced last among the two.

## What this phase deliberately does not close

- **The liveness fix and the two clocks (R17, R18).** [Phase 17](phase-17.md), on fvermaut's split of 2026-08-08. **The overnight prohibition therefore stands**, and this phase's own gate has to work around it.
- **The frozen output-token counter.** Unexplained since 14g, decoupled from the clock by [15a](reports/phase-15-clock-investigation.md), and not addressed in either phase.
- **The two-daemon ledger hazard** on `.timone/state.json` — and 16c widens it slightly by adding `previews` to what two daemons would clobber. Named, not fixed.
- **Preview authentication and phone review.** No adapter here leaves the host, so neither is owed. Both arrive with a managed-platform adapter or an always-on host.
- **A managed-platform preview adapter.** [ADR-0021](../../adr/0021-previews-are-reconciled-behind-an-adapter-seam.md) makes it an implementation rather than a redesign; it is not this phase's.
- **Preview resource bounds.** R10 serializes work per project, so the practical ceiling is roughly one preview per managed project — one today. This stops being free as projects are added, and teardown is what keeps it honest.
- **Sub-agent output tokens obtained honestly**, the `setup` skill, the real bot identity, and the Slack adapter — all carried forward unchanged.
