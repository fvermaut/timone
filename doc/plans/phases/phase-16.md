# Phase 16: the clock that judges a run, and a preview you can click

> **Status:** **Awaiting approval.** Hand-planned 2026-08-08, as all Timone-self phases are (`/timone-plan` targets managed projects only); the plan skill's shape rules — thin vertical slices, declared seams, per-slice validation — are followed, not the instrument. Approval is gated on this file per [ADR-0014](../../adr/0014-artifact-first-gates.md).

> **Sixth phase of [PRD-02](../../specs/prd/prd-02-inversion-of-control.md).** Governing decisions: **[ADR-0020](../../adr/0020-liveness-is-judged-only-over-witnessed-time.md)** (liveness is judged only over witnessed time — supersedes ADR-0017) and **[ADR-0021](../../adr/0021-previews-are-reconciled-behind-an-adapter-seam.md)** (previews are reconciled behind an adapter seam — extends [ADR-0005](../../adr/0005-docker-previews-on-own-host.md)). Standing: [ADR-0007](../../adr/0007-sessions-at-timone-root.md), [ADR-0014](../../adr/0014-artifact-first-gates.md), [ADR-0019](../../adr/0019-timone-authored-commits-carry-a-provenance-trailer.md).

## The honest scope of this phase, stated first

**This phase carries two independent halves**, and it is larger than any phase so far. Saying that up front is the point of this section.

- **The liveness half (16a–16b, R17/R18)** — small, fully specified by ADR-0020, and it **removes an operational warning that has stood since phase 14**: today `timone daemon` cannot be left running unattended overnight without a healthy run being killed. Nothing else in the backlog buys back a standing prohibition.
- **The preview half (16c–16f, R8/R12/R11)** — most of the work, and mostly new files. Docker previews were phase 13's recorded next action, were displaced by phase 14, displaced again by phase 15, and **this is the phase that stops displacing them.**

**If this phase overruns, the preview half is what gets cut, not the liveness half.** That is decided here rather than discovered at the gate: an operational prohibition outranks a convenience, and a fourth displacement is cheaper than shipping a half-built preview adapter. Should that happen, the completion report restates the cost — **it would be the third displacement** — as [the phase 15 completion report](reports/phase-15-complete.md) required.

**Two entry gates fired before this plan was written and both are discharged.** The tick fix tripped the ADR gate, which [15a](reports/phase-15-clock-investigation.md) measured and ADR-0020 records. The preview half tripped it too — PRD-02 deferred the exposure model with *"settle when building R8"* — and the grill of 2026-08-08 settled it as ADR-0021. **No slice below resolves an open decision**; that is what those two documents are for.

## Requirements

> **PRD:** [prd-02-inversion-of-control.md](../../specs/prd/prd-02-inversion-of-control.md) — criteria in [prd-02-inversion-of-control.criteria.md](../../specs/prd/prd-02-inversion-of-control.criteria.md)

| ID | Priority | Requirement (one line) | This phase |
| --- | --- | --- | --- |
| PRD-02.R18 | MUST | A run orphaned by a crashed daemon is reclaimed, reported and its project freed | **closes** — 16a implements ADR-0020; the false-positive path is what held it |
| PRD-02.R17 | SHOULD | The daemon shows progress while a session runs, and its authoritative cost when it ends | **closes on the clock half only** — see the limit below |
| PRD-02.R8 | MUST | Docker preview per pull request | **closes** — 16c–16e |
| PRD-02.R12 | SHOULD | Preview teardown | **closes** — 16f |
| PRD-02.R11 | MUST | PR feedback loop | **closes only if the gate reaches its preview clause** — three of four clauses were observed at 13h; the fourth needs a review comment carried through *with* a preview refreshing. If the gate does not get there, it stays `draft` and says why |

**R17's limit, stated now so the completion report is not where it is discovered.** R17 failed at 14g on **two** numbers: the clock and the output-token counter. This phase fixes the clock, because [15a](reports/phase-15-clock-investigation.md) explained it and ADR-0020 decides it. **The frozen token counter is not fixed here and is not explained anywhere** — #13's planning session held at 4.7k output tokens for four hours with no sub-agents in play, and 15a deliberately decoupled it from the clock rather than assuming a shared cause. **R17 therefore closes only if 16g's gate can show the token counter accurate on the sessions it observes; otherwise it stays `draft` with the token half named as the remainder.** Nobody should read this phase as having closed R17 by fixing the clock alone.

Deliberately **not** this phase: the Slack adapter; a real bot identity (still needs a credential from fvermaut); the **two-daemon ledger hazard** on `.timone/state.json`, untouched since phase 14 and untouched again; **whether reclaim-without-recovery is too conservative** for unattended runs; **sub-agent output tokens obtained honestly**; a **`setup` skill**; preview **authentication**, which no adapter that stays on the host owes ([ADR-0021](../../adr/0021-previews-are-reconciled-behind-an-adapter-seam.md)); `scratch-app` #4, #10 and #13, all of which stay exactly where phase 15 left them.

## Goal Description

The daemon stops killing healthy work, and a pull request becomes something you can click rather than read.

Today a `setInterval` cannot fire while its process is not scheduled, so on a laptop that suspends — this one, 146 times in one measured night, 113 of them longer than the two-minute staleness threshold — a perfectly healthy session goes silent and looks exactly like a corpse. A continuously running daemon would have reclaimed a live run and abandoned its branch on every one of those. After 16a, **staleness is judged only across time a daemon can vouch for having watched**, and the standing prohibition on overnight runs is lifted. After 16b, the two numbers that disagreed by 13× each say which quantity they measure, because [15a](reports/phase-15-clock-investigation.md) established that both were correct and only their shared name was wrong. And after 16c–16f, every open Timone pull request on a bound project carries a URL that serves that branch's current commit, refreshes when the branch moves, and disappears when the PR ends.

**Load-bearing decisions, fixed here so slices don't re-litigate them:**

- **The witness is two fields on the state, not a flag on each run.** `observedAt` is when a poll cycle last ran; `observingSince` is the start of the current unbroken watch. A cycle finding a normal gap carries `observingSince` forward; a cycle finding a large gap resets it to now. **A run may be reclaimed only when `now - observingSince >= staleAfterMs`** — the daemon has been continuously present for at least as long as the window it is about to judge. This is ADR-0020's "one fresh staleness window" expressed exactly, and it is better than granting the window by touching runs: **rewriting each run's `heartbeatAt` on wake would be recording a heartbeat that never happened**, and `heartbeatAt` is evidence, not bookkeeping.
- **A gap is unwitnessed when it exceeds twice the poll interval.** One missed cycle is scheduler jitter; two is evidence the process was not running. Named constant, with that sentence as its comment.
- **An absent `observedAt` counts as unwitnessed.** A first-ever run, or a state file written by an older daemon, has no witness — so it grants the window rather than reclaiming. Conservative in the only safe direction: a late reclaim costs a project two minutes, an early one costs an agent's work.
- **The witness fields are top-level on the state, and `stateSchema` is a `z.strictObject`.** Both optional, so `version` stays `1` and every existing state file loads unchanged. They describe the *daemon's attention*, which is not a property of any run.
- **The two clocks are labelled, not reconciled.** The tick keeps `Date.now()` and prints `… elapsed`; the closing line keeps the SDK's `duration_ms` and prints `… working`. Both are correct measurements of different quantities (15a), so the fix is a word, not arithmetic. `duration_api_ms` stays unread — it is **not** a nested total, and on a control run it exceeded `duration_ms`.
- **The preview seam is `ensure(project, pr, headSha)` and `release(project, pr)`**, per ADR-0021. `ensure` returns state **and URL**; the URL belongs to the adapter. Nothing outside an adapter knows an addressing scheme.
- **The adapter reads the port rather than allocating one.** The stack is brought up with `APP_PORT=0` and `POSTGRES_PORT=0`, so Docker assigns free host ports, and `docker compose port app 3000` reports what was assigned. **There is no allocation scheme to collide, and `scratch-app` needs no change** — its `compose.yaml` already interpolates both with defaults.
- **One compose project per PR, and a git worktree per PR.** `docker compose -p <project>-pr-<n>` gives distinct container names and volume prefixes (which is what `compose.yaml`'s header was written for). The source comes from `git -C projects/<name> worktree add .timone/previews/<project>/pr-<n> <sha>` — **under the timone root, never inside the client's working tree**, which is R2's rule about harness files.
- **Seeding is a compose profile, not an npm script.** If the project's compose file declares a `seed` service, the adapter runs that profile after migrations; otherwise the preview comes up empty. The adapter asks compose, never `package.json`, so it stays project-type-agnostic. **`scratch-app` declares no `seed` service today, so its previews come up empty — which is the "empty if absent" case working, not a gap.**
- **The adapter takes an injected `CommandRunner`**, exactly as `GitHubTicketingAdapter` does, so every test asserts the argument vector and nothing shells out.
- **A failed preview never blocks delivery** (ADR-0021). It is reported on the PR and the pipeline continues.
- **Previews are not a pipeline stage.** `PIPELINE_STAGES` gains no member and no run enters a preview state; reconciliation happens in the poll loop for every open Timone PR on a bound project. R8's criterion presupposes otherwise and is corrected in 16c — **the same fault 15d fixed in R18, found the same way.**
- **The operational warning stands until 16g's gate observes the fix**, not until 16a merges. A code change is not evidence.

## Context & Prerequisites

- Phase 15 closed 2026-08-08 with R15 `verified` and R17/R18 held at `draft`. **539 tests green**, `type-check` clean, `main` level with `origin/main` at `de389d6`.
- **[ADR-0020](../../adr/0020-liveness-is-judged-only-over-witnessed-time.md) supersedes [ADR-0017](../../adr/0017-a-runs-liveness-is-its-heartbeat.md)**, whose status line is flipped and whose body is untouched. Code comments still cite ADR-0017 in `progress.ts`, `runs.ts`, `poll.ts` and `commands/daemon.ts`; **updating those citations is 16a's job**, not a later tidy-up.
- **The evidence this phase acts on is gathered and is not to be re-gathered.** [15a](reports/phase-15-clock-investigation.md) carries the `pmset` measurements, the awake-time arithmetic, the failed `SIGSTOP` instrument and why it failed. Slices read it; they do not repeat it.
- **`scratch-app`'s `compose.yaml` was written for this** and needs no change: `app` profile, interpolated host ports, prefixed volumes, a `migrate` job gated on successful exit, a healthcheck on `app` that answers "ready to look at".
- **`manifest.ts` already carries `preview: z.literal("docker").optional()`** — the binding slot exists and is unset for `scratch-app`. Setting it is 16e's.
- **`src/adapters/` holds the seam precedent**: an interface in `ticketing.ts`, a GitHub implementation beside it, `CommandRunner` injected. The preview adapter is its sibling and follows it.
- **No preview code exists anywhere in `src/`** — the three matches for "preview" are manifest schema and a comment.
- **A live PR is needed for 16g and none is open.** The gate files its own fixture ticket rather than reusing `scratch-app` #13, which sits `failed`; carrying that is a `scratch-app` decision, not this phase's.

## Sub-phases

### Sub-phase 16a: the daemon judges only time it watched (R18)

**[MODIFY]** `src/daemon/runs.ts`, `runs.test.ts` — `stateSchema` gains optional top-level `observedAt` and `observingSince`; `RunStore` gains `witness(now, unwitnessedAfterMs)` returning whether the daemon may judge, and persisting both fields. `staleRuns` is unchanged — it answers "which runs are quiet", which is still the right question.
**[MODIFY]** `src/daemon/poll.ts`, `poll.test.ts` — `pollOnce` takes the witness once per cycle, **before any project is reclaimed**, and `reclaimStale` skips entirely when the daemon may not yet judge, logging that it is doing so.
**[MODIFY]** `src/commands/daemon.ts` — pass the poll interval through so the unwitnessed threshold derives from it; update the ADR-0017 citation to ADR-0020.
**[MODIFY]** `src/daemon/progress.ts` — the `DEFAULT_PROGRESS_INTERVAL_SECONDS` comment cites ADR-0020 and states the new rule.

**Seams under test (TDD):** a run quiet past the threshold, with the daemon continuously present, is still reclaimed — **the property a fix like this most easily destroys**; the same run, after a gap exceeding twice the poll interval, is **not** reclaimed on that cycle; it **is** reclaimed once the daemon has been present for a full staleness window afterwards, which is the "delayed, not disabled" property; a state file with no `observedAt` grants the window rather than reclaiming; a normal cycle carries `observingSince` forward rather than resetting it, asserted across three consecutive cycles; the witness is taken once per cycle even with several projects in the manifest, so project two is not judged by a witness project one refreshed; an existing state file with neither field loads and `version` stays `1`.

> No dependency on other sub-phases. Sequenced first: it is the slice that lifts the operational prohibition, and it is the one that must survive if the phase is cut.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/runs.test.ts src/daemon/poll.test.ts src/commands/daemon.test.ts
npm run type-check
npm test
```

- [ ] A genuinely dead run is still reclaimed when the daemon was present throughout — asserted before any skip test
- [ ] The skip is proven **temporary**, not permanent: reclaim fires on a later cycle
- [ ] No run's `heartbeatAt` is written by the reclaim path
- [ ] An old state file loads unchanged, `version` still `1`
- [ ] Every ADR-0017 citation in `src/` now names ADR-0020

---

### Sub-phase 16b: each clock says which one it is (R17)

**[MODIFY]** `src/daemon/progress.ts`, `progress.test.ts` — `tickLine` prints elapsed as `… elapsed`; `closingLine` prints duration as `… working`. The `ProgressSnapshot.elapsedMs` and `SessionSummary.durationMs` docs state which quantity each is and cite 15a's measurement.

**No arithmetic changes.** If this slice finds itself computing a duration differently, it has left its scope — 15a established that both numbers are already correct.

**Seams under test (TDD):** the tick line carries `elapsed` and the closing line carries `working`, asserted as rendered strings; the existing duration formatting (`9s`, `4m12s`, `1h04m`) is unchanged, so the labels are additive; `duration_api_ms` is read nowhere, asserted by a test over the result-message handler that a session reporting a large `duration_api_ms` and a small `duration_ms` summarises with the small one.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/progress.test.ts
npm run type-check
```

- [ ] Both labels present and distinguishable in one glance
- [ ] Duration formatting unchanged — the diff is words, not maths
- [ ] `duration_api_ms` proven unread rather than assumed unread

---

### Sub-phase 16c: R8's criterion stops presupposing a stage

**[MODIFY]** `doc/specs/prd/prd-02-inversion-of-control.criteria.md` — R8's first criterion reads *"WHEN the preview stage runs"*, and under [ADR-0021](../../adr/0021-previews-are-reconciled-behind-an-adapter-seam.md) there is no preview stage: reconciliation happens in the poll loop and `PIPELINE_STAGES` gains no member. The criterion is rewritten to name **a state the world reaches**, not a mechanism that reaches it, and must be able to go red. The old wording and why it was inadequate stay in the annotation.

**This is a specification correction, not an intent change** — R8 has always asked for a running, reachable preview per PR. It is here for the same reason 15d existed: a criterion that presupposes a mechanism cannot go red when that mechanism is absent.

**Seams under test (TDD):** none — no behaviour-carrying code.

> Sequenced before the preview build so the slices below are written against a criterion that means what it says.

#### Agent Validation Steps

```bash
grep -n "preview stage runs" doc/specs/prd/prd-02-inversion-of-control.criteria.md   # expect no match
```

- [ ] The new criterion names no mechanism — not a stage, not a poll cycle, not Docker
- [ ] It can go red against today's code, where no preview exists at all
- [ ] The old wording survives in the annotation

---

### Sub-phase 16d: the preview seam and the Docker adapter (R8)

**[NEW FILE]** `src/adapters/preview.ts` — `PreviewAdapter` with `ensure(project, pr, headSha): Promise<Preview>` and `release(project, pr): Promise<void>`; `Preview` carries `state` (`ready | building | failed`), `url` when ready, and `reason` when failed. Zod schemas beside the types, as `ticketing.ts` does.
**[NEW FILE]** `src/adapters/docker-preview.ts`, `docker-preview.test.ts` — the Docker implementation over an injected `CommandRunner`: worktree add at `headSha`, `docker compose -p <project>-pr-<n>` up with the `app` profile and `APP_PORT=0`/`POSTGRES_PORT=0`, the `seed` profile when the compose file declares one, readiness from the `app` healthcheck, and the URL from `docker compose port app 3000`.

**Seams under test (TDD):** the argument vector for a first `ensure` — worktree, compose project name, both ports zeroed, `app` profile — asserted verbatim, because it is the whole contract with Docker; `ensure` at a **new** `headSha` replaces the stack rather than adding one, and the worktree moves to the new sha; `ensure` at an **unchanged** sha on a ready preview does nothing and returns the same URL, which is what makes per-cycle reconciliation cheap; the URL is **read** from `docker compose port` and never computed, asserted by returning an unexpected port from the fake and seeing it in the URL; a project whose compose file declares no `seed` service comes up without it and is `ready`, not `failed`; a stack whose healthcheck never passes returns `failed` with a reason and **does not throw**; `release` tears down with volumes and removes the worktree, and is idempotent against a preview that is already gone.

> No dependency on other sub-phases. Independent of 16a and 16b in every file it touches.

#### Agent Validation Steps

```bash
npx vitest run src/adapters/docker-preview.test.ts
npm run type-check
npm test
```

- [ ] Nothing shells out in tests — every docker and git call goes through the fake runner
- [ ] The unchanged-sha path is proven a no-op, not merely fast
- [ ] A failed preview is a returned value, never an exception
- [ ] No file is written inside `projects/<name>/` by the adapter

---

### Sub-phase 16e: previews reconcile every cycle and land on the PR (R8, R11)

**[MODIFY]** `src/daemon/poll.ts`, `poll.test.ts` — for each project whose manifest carries a preview binding, reconcile every open Timone PR against its head sha and record the result on the state.
**[MODIFY]** `src/daemon/runs.ts`, `runs.test.ts` — a top-level `previews` record keyed by project and PR number, holding the last known sha, state and URL. Top-level for the same reason the witness fields are: a preview outlives the run that opened it.
**[MODIFY]** `src/adapters/ticketing.ts` — a `PREVIEW_MARKER` beside the existing markers, so the preview comment is identifiable and updated rather than duplicated.
**[MODIFY]** `timone.yaml` — `scratch-app` gains `preview: docker`.

**Seams under test (TDD):** a project with no preview binding is not reconciled at all, and no docker command is issued for it; the URL comment is posted **once** and updated in place when the URL changes, never duplicated across cycles — the failure mode a per-cycle reconciler creates; a PR whose head sha has not moved produces no comment and no docker work; a preview that comes back `failed` posts its reason on the PR and **the cycle continues to the next project**, so a broken build never blocks delivery; a preview adapter that throws is caught into `result.errors` like any other adapter failure, leaving the rest of the cycle intact.

> Sub-phase 16d must be complete. 16c should be complete, so this is built against the corrected criterion.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/poll.test.ts src/daemon/runs.test.ts
npm run type-check
npm test
```

- [ ] An unbound project issues zero docker commands
- [ ] The comment is idempotent across at least three simulated cycles
- [ ] A failed preview is reported and non-blocking, asserted by the cycle's later work still happening

---

### Sub-phase 16f: previews end when their pull request does (R12)

**[MODIFY]** `src/daemon/poll.ts`, `poll.test.ts` — a PR that is merged or closed is `release`d and its record dropped, within the same cycle that observes the state change.

**Seams under test (TDD):** a merged PR's stack is released on the next cycle and its record removed; a closed-not-merged PR likewise; **a reopened PR gets a preview again with no special path**, which is reconciliation's own property and R12's second clause for free; release is called once, not on every subsequent cycle, so a closed PR does not generate work forever; a release that fails is reported and does not wedge the cycle.

> Sub-phases 16d and 16e must be complete.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/poll.test.ts
npm run type-check
```

- [ ] Reopening needs no code of its own — assert it, don't implement it
- [ ] Release happens once per PR ending, not per cycle

---

### Sub-phase 16g: live gate — a sleeping laptop, and a URL that opens

**[NO CODE.]** A live run, and the human gate.

1. **The prohibition, tested by breaking it deliberately.** With a real run active and the daemon running **continuously** (not `--once`), let the machine suspend — the thing forbidden since phase 14. Expect: no reclaim, the run alive on wake, and the daemon's log showing it declined to judge. **This is the evidence that lifts the warning and the only evidence that can.**
2. **Reclaim still fires.** In the same pass, kill a daemon mid-session while the machine is awake throughout, and confirm the run is reclaimed, its ticket commented, its project freed, and `timone retry` re-arms it. **A fix that merely stopped reclaiming would pass step 1 and be catastrophic** — this is 15e's discipline applied to a new mechanism.
3. **The two clocks, read side by side** on a session that spans a suspend: the tick's `elapsed` and the closing line's `working`, differing, each legible as what it is.
4. **The token counter, measured not assumed** — on the same sessions, against `modelUsage`. R17 closes only if this holds; if it does not, the token half is recorded and R17 stays `draft`.
5. **A preview, opened in a browser.** File a fixture ticket, carry it to a pull request, and open the posted URL. Then push a visible change to the branch and confirm the preview serves it within a cycle.
6. **Teardown.** Close the PR; confirm the stack and its volumes are gone within one cycle and the worktree is removed. Reopen it and confirm the preview returns.
7. **R11's preview clause, if the gate reaches it** — a review comment carried through remediation with the preview refreshing. If it is not reached, R11 stays `draft` and the report says which clause is outstanding.

**Seams under test (TDD):** none — this is the live gate, and its whole point is evidence no unit test can reach. Phase 14 found six defects this way against 532 green tests; phase 15 found the instrument that lied.

> Sub-phases 16a, 16b, 16e and 16f must be complete.

#### Agent Validation Steps

```bash
node dist/cli.js daemon --progress-interval 30
node dist/cli.js status
docker ps --filter "name=scratch-app-pr-"
pmset -g log | grep -c "Entering Sleep"
```

- [ ] Steps 1–7 each observed, evidence captured for the completion report
- [ ] The reclaim path shown still **firing**, not merely quiet
- [ ] Every instrument verified before its output is believed — [the habit phases 14 and 15 both earned](reports/phase-15-clock-investigation.md), which has now produced one fabricated defect and one fabricated clean bill of health
- [ ] **Human gate:** fvermaut confirms the overnight prohibition may be lifted, and that a preview URL is worth opening

---

### Sub-phase 16h: documentation, register, and the route out

**[MODIFY]** `doc/specs/prd/prd-02-inversion-of-control.criteria.md` — R18 to `verified` on 16g's two-direction evidence; R8 and R12 on steps 5–6; R17 **only if step 4 holds**, otherwise `draft` naming the token half; R11 per step 7. **The phone-review gap is recorded on R8** rather than left implied by an unqualified `verified` ([ADR-0021](../../adr/0021-previews-are-reconciled-behind-an-adapter-seam.md)).
**[MODIFY]** `STATUS.md` — phase 16 in plain language, and **the overnight warning struck only if step 1 passed**.
**[NEW FILE]** `doc/plans/phases/reports/phase-16-complete.md` — what closed, what did not, and the next phase's scope.
**[NEW FILE]** `doc/plans/phases/reports/phase-16-live-gate.md` — the gate's evidence.

**Seams under test (TDD):** none — no behaviour-carrying code.

> All prior sub-phases must be complete.

#### Agent Validation Steps

```bash
grep -n "overnight" STATUS.md
grep -n -A3 "^## R17" doc/specs/prd/prd-02-inversion-of-control.criteria.md
```

- [ ] R17 does not flip on the clock alone — the token half is named either way
- [ ] R8 carries the phone-review limit explicitly
- [ ] The overnight warning is struck only against step 1's evidence, never against a merged diff

## Dependency graph

```
16a → (none)          the daemon judges only time it watched (R18)
16b → (none)          each clock says which one it is (R17)
16c → (none)          R8's criterion stops presupposing a stage
16d → (none)          the preview seam and the Docker adapter (R8)
16e → 16d, 16c        previews reconcile every cycle and land on the PR (R8, R11)
16f → 16d, 16e        previews end when their PR does (R12)
16g → 16a, 16b, 16e, 16f    live gate
16h → all prior       docs, register, reports
```

16a, 16b, 16c and 16d are mutually independent and may run in any order or together. 16a is listed first because it is the slice that must survive if the phase is cut, and 16d is the long pole of the preview half.

## What this phase deliberately does not close

- **The frozen output-token counter.** Unexplained since 14g, decoupled from the clock by 15a, and not addressed here. It is why R17 may not close.
- **The two-daemon ledger hazard** on `.timone/state.json` — and 16e adds `previews` to what two daemons would clobber, so the hazard is now marginally wider. Named, not fixed.
- **Whether reclaim-without-recovery is too conservative** for genuinely unattended runs. 16a makes unattended runs survivable, which makes this question live rather than academic for the first time.
- **Preview authentication and phone review.** No adapter here leaves the host, so neither is owed ([ADR-0021](../../adr/0021-previews-are-reconciled-behind-an-adapter-seam.md)). Both arrive with a managed-platform adapter or an always-on host.
- **A managed-platform preview adapter.** ADR-0021 makes it an implementation rather than a redesign; it is not this phase's.
- **Sub-agent output tokens obtained honestly**, the `setup` skill, the real bot identity, and the Slack adapter — all carried forward unchanged.
