# Phase 13: the machine builds — execution, verification and the pull request

> **Status:** Approved for execution by fvermaut 2026-08-05. Hand-planned 2026-08-05, as all Timone-self phases are (`/timone-plan` targets managed projects only); the plan skill's shape rules — thin vertical slices, declared seams, per-slice validation — are followed, not the instrument. The two process contradictions it flagged were settled at a grill *before* this approval ([ADR-0015](../../adr/0015-branch-per-driving-unit.md), [ADR-0016](../../adr/0016-review-remediation-rides-the-verify-fix-shape.md)).

> **Third phase of [PRD-02](../../specs/prd/prd-02-inversion-of-control.md).** Governing decisions: [ADR-0015](../../adr/0015-branch-per-driving-unit.md) (the branch belongs to the driving unit) and [ADR-0016](../../adr/0016-review-remediation-rides-the-verify-fix-shape.md) (review remediation rides the verify-fix shape) — both from this phase's pre-approval grill of 2026-08-05; [ADR-0014](../../adr/0014-artifact-first-gates.md) (a stage writes its artifact, then is judged on it — this phase extends that rule from gates to outcomes), [ADR-0013](../../adr/0013-stateless-session-reentry.md) (every human wait is a session boundary), [ADR-0012](../../adr/0012-conversation-channels.md) (the ticket/PR thread is the one surface the loop reads), [ADR-0007](../../adr/0007-sessions-at-timone-root.md), [ADR-0004](../../adr/0004-github-first-adapter-pair.md) (the PR *is* stage 8's artifact), [ADR-0009](../../adr/0009-cli-first-agent-tooling-mcp-for-the-gap.md). Builds directly on [phase 12](phase-12.md), whose live run parked `scratch-app` #6 at exactly this phase's entry point.

## Requirements

> **PRD:** [prd-02-inversion-of-control.md](../../specs/prd/prd-02-inversion-of-control.md) — criteria in [prd-02-inversion-of-control.criteria.md](../../specs/prd/prd-02-inversion-of-control.criteria.md)

| ID         | Priority | Requirement (one line) |
| ---------- | -------- | ---------------------- |
| PRD-02.R6  | MUST     | Unattended execution with sub-phase validation and fresh-context verification, bounded fix loops, failures reported on the ticket |
| PRD-02.R7  | MUST     | Work lands as a pull request referencing the ticket, carrying scope and verification outcome, cross-linked both ways |
| PRD-02.R11 | MUST     | *(all but its last clause)* a human review comment on the PR is triaged, acted on or clarified, and answered in-thread |

**R11's closing clause — "the preview reflects the update" — cannot be verified before R8 exists**, so R11 stays `draft` at this phase's close whatever happens, with a partial-evidence marker naming what was and wasn't observed. Building the loop now and the preview next keeps each phase testable; the alternative (defer all of R11 to phase 14) was rejected because the loop's machinery is this phase's machinery — delivery, the parked-on-review wait, the remediation cycle — and phase 14 should be about Docker, not about re-opening the pipeline.

This phase also supplies live evidence three verified requirements are explicitly waiting on: **R2**'s path-containment clause (verified on a session that wrote no files — execution writes many), **R15**'s `STATUS.md`-placement and containment rules (never yet fired outside tests), and **R10**'s queue promotion (never observed live because no run had ever reached a terminal state).

Deliberately **not** this phase: R8/R12 (Docker previews — phase 14), and with them R11's preview clause; Slack (its own phase, behind the R14 seam); a real bot identity (needs a credential from fvermaut); the marker convention for interactive sessions (needs a grill); **the bug-ticket path into stage 9** — `scratch-app` #4 stays parked, because a ticket-borne stage 9 carries its own confirmation gate and dispatch machinery, which is not the same slice as R11's review loop and deserves its own phase.

## Goal Description

A ticket whose plan has been approved goes the rest of the way without anyone at the keyboard: the approved phase file is executed slice by slice, a context that did not watch the build verifies the result, and the work lands as a pull request the ticket links to — with the daemon pausing only for the human acts that remain: reviewing the PR and merging it. A review comment requesting a change is acted on and answered in-thread; a merge releases the project and promotes the queue. At the end of the phase, `scratch-app` #6 — "typing in the box is fiddly on my phone" — is a merged pull request that no one ever named a stage for.

**Load-bearing decisions, fixed here so slices don't re-litigate them:**

- **One branch from ticket to pull request.** The run's work branch — `timone/6-…`, claimed at the requirements stage — carries the PRD, the plan, the code, the reports, and becomes the PR head. ✏ Revised 2026-08-05: **settled by [ADR-0015](../../adr/0015-branch-per-driving-unit.md)** at the pre-approval grill — the branch belongs to the driving unit of work, and execution never cuts a new branch when an approved plan already lives on one; `process.md` stage 6 and `timone-execute` are amended to match, so the execution prompt's "stay on this branch" and the skill now say the same thing. The multi-phase-ticket case is deliberately deferred in the ADR.
- **A stage is judged by its artifact and its outcome record — never by an exit code alone.** 12g's false gate is the lesson. Each unattended stage closes by posting a ticket comment carrying a machine-readable **outcome marker** (`advanced` or `handed-to-human`, the `CONVERSATION_RECORD_MARKER` pattern), and the daemon cross-checks the artifact the stage owes before moving: execution — the phase file's `Status:` flipped to `Complete — see <report>` on the branch; verification — the verification report committed; delivery — **the pull request itself**, looked up through the adapter (per ADR-0004 the PR is the artifact; a branch tip cannot prove it). Marker and artifact disagreeing fails the run loudly.
- **The verification prompt carries no build context — not even the ticket thread.** The thread holds execution's own account of what it built, which is exactly what stage 7's independence excludes. The prompt names the project, the ticket number, the branch and the phase file, and instructs stage 7; the skill's closed read list does the rest. Statelessness (ADR-0013) makes fresh context free — this decision is about what the prompt *withholds*.
- **Failure is a loud stop with a supported way back.** The bounded loops live inside the skills (two attempts per sub-phase in stage 6, two verify-fix loops in stage 7); when they exhaust, the stage's `handed-to-human` outcome lands on the ticket with the evidence linked and the run fails. `timone retry` re-arms a failed run at the stage it failed — closing 12g's recorded gap, where `.timone/state.json` was hand-edited three times because no command existed.
- **After delivery, the run parks on the pull request** — a new wait kind, `review`, alongside `gate` and `conversation`. The PR thread is its one surface (ADR-0012). **Merged is the terminal state** that releases the project and promotes the queue; closed-unmerged is terminal too, recorded as declined and said plainly on the ticket. Until then the run holds the project — the branch-based rule, unchanged.
- **A change-requesting review comment is confirmed intake, and its remediation rides the verify-fix shape.** ✏ Revised 2026-08-05: **settled by [ADR-0016](../../adr/0016-review-remediation-rides-the-verify-fix-shape.md)** at the pre-approval grill. A concrete comment is its own confirmation (the gate exists to stop the machine acting on its own diagnosis; here both diagnosis and remediation are the human's words); the comment is the defect brief for a fresh fix context committing `fix: review — <slug>`, then re-verification, then the PR refreshed as an iteration — no plan amendment, no feedback record; nothing lands on the PR unverified, which is the invariant stage 9's ceremony protects. **The boundary is testable:** a fix touching neither the PRD pair nor the register is a remediation; one that would move a requirement is intent and takes stage 9's full path. Ambiguity routes to a clarifying reply in-thread, never to a guess. `process.md` stage 9 and `timone-improve` are amended to match.
- **The daemon orchestrates stage skills; it never reimplements them.** 13c/13d/13e spawn sessions that invoke `timone-execute`, `timone-verify` and `timone-deliver`. Where a skill and this phase disagree, the conflict is flagged to the human — never resolved by whichever session reads which instruction first (12f's lesson).
- **An accepted consequence, stated rather than hidden:** an execution session runs for as long as a phase takes to build, and the spawner awaits it, so a poll cycle containing one is a very long cycle. Serialization already guarantees nothing else wanted the slot. Watchdogs and budgets stay out of scope (PRD-02 declined observability at the 2026-08-02 grill).

## Context & Prerequisites

- Phase 12 shipped the gates, the conversation seam, `timone takeover`, and the artifact-existence check on gates. 318 tests green; `npm test` and `npm run type-check` clean on `main`.
- **`scratch-app` #6 is parked at execution**, holding branch `timone/6-typing-in-the-box-is-fiddly-on-my-phone` with an approved PRD pair and an approved five-slice `phase-04.md` — this phase's natural first input, sitting at its entry point.
- **`scratch-app` #4 is parked at triage** (`triage:bug`, holds no project) and stays parked — see "deliberately not".
- The stage skills this phase drives already exist and are exercised hand-run: `timone-execute`, `timone-verify`, `timone-deliver`. All three already write `STATUS.md` on the default branch and push what they commit, which is what R15's so-far-untested rules watch for.
- The guardrail hooks (R15) and the branch-tip probe (12f's fix) are in place; this phase gives both their first real work.

## Sub-phases

### Sub-phase 13a: the pull-request surface of the ticketing seam

**[MODIFY]** `src/adapters/ticketing.ts` — a deliberate widening of the seam: `findPullRequest(project, branch)` → number, URL and state (`open` / `merged` / `closed`) or undefined; `getPullRequestThread(project, number)` → the PR's conversation and review comments as one thread, oldest first, each comment carrying `fromTimone` derived from the marker exactly as ticket comments do; `postPullRequestComment(project, number, body, replyTo?)` — stamped with the machine marker, threading under `replyTo` when given.
**[MODIFY]** `src/adapters/github-tickets.ts` — the `gh`-based implementations.
**[NEW FILE]** the adapter tests for the new surface.

**Seams under test (TDD):** the widened interface over fabricated `gh` output — state mapping (merged beats closed; open is open); a review comment and an issue comment land in one thread in time order; `fromTimone` from the marker, never from the author; no PR for the branch is undefined, not an error; the posted comment carries the marker without the caller remembering it.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
npx vitest run src/adapters
npm run type-check
```

- [ ] The seam stays tracker-agnostic — nothing GitHub-shaped leaks into the types
- [ ] A machine PR comment can never read as a human one
- [ ] The widening is these three capabilities and no more

---

### Sub-phase 13b: the pipeline learns the back half

**[MODIFY]** `src/daemon/pipeline.ts` — `verification` (process stage 7) and `delivery` (process stage 8) join the graph: execution → verification → delivery, all three `built`, all three owning the branch; delivery waits on the new kind `review`.
**[MODIFY]** `src/daemon/runs.ts`, `runs.test.ts` — runs carry the PR number once one exists; a run parked on `review` reaches its terminal state on merge or close, which is what finally lets `promoteQueue` fire outside a unit test.
**[NEW FILE]** `src/daemon/outcomes.ts` + `outcomes.test.ts` — the stage-outcome marker (constant beside its siblings in `ticketing.ts`) and `readStageOutcome(thread, cursor)`: the first machine comment after the cursor carrying the marker yields `advanced` or `handed-to-human`; human comments never do.
**[MODIFY]** `src/commands/status.ts`, `status.test.ts` — the new stages and the review wait render plainly ("building", "checking the result", "waiting on your review of PR #N").

**Seams under test (TDD):** the graph as pure transitions — execution advances to verification advances to delivery; delivery waits on `review`; a human comment can never be a stage outcome (the mirror of 12a's trap: there, machines must not speak for humans; here, humans must not speak for the machine's bookkeeping); outcomes before the cursor are ignored; status output for each new state.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/pipeline.test.ts src/daemon/runs.test.ts src/daemon/outcomes.test.ts src/commands/status.test.ts
npm run type-check
```

- [ ] Stage numbers 6, 7, 8 map exactly to `process.md`'s stages
- [ ] A run parked on review holds its project until merge or close, and not after
- [ ] `timone status` explains every new state without process jargon

---

### Sub-phase 13c: the execution stage (R6, first half)

**[MODIFY]** `src/daemon/prompts.ts`, `prompts.test.ts` — the execution prompt: run stage 6 on the approved phase file, **on the run's branch, explicitly** (the one-branch decision above); the entry gate is the skill's own (an unstamped file refuses — the prompt never asserts approval, the artifact does); close by posting the outcome comment with the marker — what was built and where, or, on escalation, which sub-phase failed and both attempts, per stage 6's escalation shape.
**[MODIFY]** `src/daemon/session.ts` — after an execution session: read the phase file's `Status:` line off the branch (extending the 12f branch-tip probe to read one file); `Complete — see <report>` plus an `advanced` outcome moves to verification; `handed-to-human` fails the run with the reason already on the ticket; anything else — flipped file with no marker, marker with no flip, neither — fails the run loudly as the wiring defect it is.

**Seams under test (TDD):** prompt construction — carries the branch, the phase file path, the stay-on-this-branch instruction, the outcome-marker obligation, and never a claim that the plan is approved; outcome handling over faked probes — the four combinations of file-flip × marker, only one of which advances; an escalated run is `failed` with the sub-phase named.

> Sub-phase 13b must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/prompts.test.ts src/daemon/session.test.ts
npm run type-check
```

- [ ] Only the artifact-and-marker pair advances the run — never an exit code
- [ ] The escalation comment names the failing sub-phase and both attempts
- [ ] The prompt names the run's branch, and the skill's ADR-0015 rule agrees with it

---

### Sub-phase 13d: the verification stage (R6, second half)

**[MODIFY]** `src/daemon/prompts.ts`, `prompts.test.ts` — the verification prompt: project, ticket number, branch, phase file — **and no ticket thread, no classification, no account of the build** (the independence decision above); instructs stage 7, whose skill owns the closed read list, the channels, and the two bounded verify-fix loops; close with the outcome comment — the verdict table in plain words on `advanced`, the surviving failures with the report linked on `handed-to-human`.
**[MODIFY]** `src/daemon/session.ts` — after a verification session: the report's existence on the branch is the artifact check; `advanced` moves to delivery; `handed-to-human` fails the run — the loops are already spent, and R6 says the remainder lands on the ticket, which the outcome comment is.

**Seams under test (TDD):** the verification prompt is the one prompt built *without* `ticketBlock` — asserted directly, because independence by construction is this slice's whole point; report-exists × marker combinations, only one advancing; a `handed-to-human` verification leaves the register flips to the session (the daemon never writes a register) and the run `failed`.

> Sub-phases 13b and 13c must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/prompts.test.ts src/daemon/session.test.ts
npm run type-check
```

- [ ] The verification prompt withholds the thread — shown by assertion, not by review
- [ ] A failed pass never advances, and its evidence is on the ticket
- [ ] The daemon reads outcomes; it never writes a report or a register

---

### Sub-phase 13e: the delivery stage (R7)

**[MODIFY]** `src/daemon/prompts.ts`, `prompts.test.ts` — the delivery prompt: run stage 8 on the branch — the two-axis review, the committed delivery report, the pull request from the work branch referencing ticket `#N`, the verification outcome in its body, a ticket comment linking the PR; outcome marker as everywhere.
**[MODIFY]** `src/daemon/session.ts` — delivery's artifact check is `findPullRequest` (13a): an open PR for the branch. No PR fails the run — the 12f rule wearing stage 8's clothes. On success the run records the PR number and parks on `review`, with a cursor over the PR thread, and the park's `waitingOn` names the PR.
**[MODIFY]** `src/commands/takeover.ts`, `takeover.test.ts` — a ticket parked on review is told to answer on the pull request, exactly as a gate park is told to answer on the ticket.

**Seams under test (TDD):** the delivery prompt carries branch, ticket reference and the both-ways-linking obligation; no-PR fails loudly with the run failed; the park records PR number, wait kind and cursor; takeover on a review park refuses with the PR named.

> ✏ **Refined 2026-08-06 — a defect 13h found live, fixed here.** The first live delivery session launched its two review axes as *background* sub-agents and ended its turn "waiting to be notified" — but a daemon session ends when its turn does, so the reviews died with it and the stage produced nothing (the daemon's two-witness check failed the run correctly rather than parking on a review of nothing). Every unattended work prompt (execution, verification, delivery, remediation) now states outright that nothing survives the end of the turn and delegation must complete before the session finishes, with a prompt test pinning all four. Scope-reducing correction of a defect execution found; the approval stamp stands.

> Sub-phases 13a, 13b and 13d must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
npx vitest run src/daemon src/commands/takeover.test.ts
npm run type-check
```

- [ ] The pull request is the artifact checked — a moved branch tip is not enough
- [ ] The parked run knows its PR, and `timone status` says it
- [ ] Takeover redirects to the PR rather than opening anything

---

### Sub-phase 13f: the review loop on the pull request (R11, minus the preview)

**[MODIFY]** `src/daemon/poll.ts`, `poll.test.ts` — resolution for a run parked on `review`, reading the PR thread through 13a: **merged** → the run completes, the ticket hears it, the queue promotes; **closed unmerged** → the run completes as declined, said plainly; **a new human comment since the cursor** → the remediation cycle; machine comments and silence leave it parked.
**[MODIFY]** `src/daemon/prompts.ts`, `prompts.test.ts` — the remediation prompt: the review comment(s) verbatim, voices separated; triage the request per stage 9's layer question; a clear change is confirmed intake (the decision above) — apply it on the branch, then the cycle re-verifies and refreshes the PR; an ambiguous one gets a clarifying reply in-thread and changes nothing.
**[MODIFY]** `src/daemon/pipeline.ts`, `session.ts` — the cycle as pipeline stages: remediation re-enters execution-shaped work on the same branch, then verification (13d, regression protection), then delivery (13e), whose re-delivery is an **iteration of the existing PR** — the artifact check finds the same PR refreshed, never a second one — and the run re-parks on `review` with a fresh cursor.

**Seams under test (TDD):** merged/closed/comment/silence over fabricated PR threads, each to its transition; a machine comment on the PR never wakes the run (the marker earning its keep on a second surface); the remediation prompt distinguishes act from ask; the cycle's exit state is parked-on-review with the cursor advanced; re-delivery targets the same PR number.

> Sub-phases 13a–13e must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
npx vitest run src/daemon
npm run type-check
```

- [ ] Only a human wakes a parked review — never the machine's own comments
- [ ] Remediated work is re-verified before the PR refreshes — nothing lands unchecked
- [ ] One PR per run, forever — iterations refresh it, never fork it

---

### Sub-phase 13g: `timone retry` — the supported way back

**[NEW FILE]** `src/commands/retry.ts`, `retry.test.ts` — `timone retry <project>#<ticket>`: a failed run re-arms at the stage it failed, keeping its branch and history; anything else — a waiting run, a completed run, an unknown ticket — refuses with guidance saying what the ticket *is* doing (12c's refusal discipline).
**[MODIFY]** `src/daemon/runs.ts` — the re-arm transition, enforced by the store.
**[MODIFY]** `src/cli.ts` — register the command.

Un-anchored addition, carried with its rationale: 12g hand-edited `.timone/state.json` three times because no supported path existed, and 13h will force failures deliberately — doing that without a recovery command means planning to hand-edit state again.

> Sub-phase 13b must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
npx vitest run src/commands/retry.test.ts src/daemon/runs.test.ts
npm run type-check
node dist/cli.js retry --help
```

- [ ] Only a failed run re-arms — everything else refuses with specific guidance
- [ ] A re-armed run keeps its branch, its stage and its ticket history
- [ ] Nothing in 13h's steps requires editing the ledger by hand

---

### Sub-phase 13h: live proof on the pilot

**Seams under test (TDD):** no Timone code — the seam is the observable end state of the live run.

> All prior sub-phases must be complete before starting this sub-phase.

Against `projects/scratch-app`, `--once` per step so every transition is inspectable:

1. **R6, execution:** resume `#6` from its park. Expect: the approved `phase-04.md` executed slice by slice on `timone/6-…` — one commit per sub-phase, handoffs and a completion report, the `Status:` flip, and one outcome comment on the ticket; guardrails silent. This is the step that makes **R2's containment clause and R15's placement rules discriminating for the first time** — a session that writes real files, checked by `git log --stat`.
2. **Recovery:** kill one execution session mid-run (or use any natural failure). Expect a failed run saying so on the ticket, and `timone retry scratch-app#6` re-arming it — no ledger edit.
3. **R6, verification:** the next cycle spawns verification fresh. Expect the report committed on the branch, register statuses flipped by the session, one outcome comment. If any FAIL occurs naturally, watch the verify-fix loop run within its bound; if none does, the bound stays unit-proven and the register note says so.
4. **R7, delivery:** expect both review reports and the delivery report committed, a PR from `timone/6-…` referencing #6 with the verification outcome in its body, the ticket linking the PR, and `timone status` showing the run waiting on the PR by number.
5. **R11, the loop:** fvermaut leaves one small concrete change request as a PR review comment. Expect: a remediation commit on the branch, re-verification, the PR body refreshed (same PR), a threaded reply, and the run re-parked. Then one deliberately vague comment — expect a clarifying question in-thread and **no commit**.
6. **R10's live half:** before merging, mark a throwaway ticket so something is queued. Merge the PR (the human act). Expect the run to complete, the ticket to hear it, and the queued ticket to start — promotion observed outside a unit test at last.

Then `git log --stat` on scratch-app: no harness files, no timone internals, and `STATUS.md` only on the default branch.

#### Agent Validation Steps

```bash
node dist/cli.js daemon --once
node dist/cli.js status
node dist/cli.js retry scratch-app#6
gh pr view --repo fvermaut/scratch-app --json body,comments,state
git -C projects/scratch-app log --stat --all | grep -cE "\.claude/|timone\.yaml"   # expect 0
```

- [ ] Steps 1–6 each observed, evidence captured for the completion report
- [ ] No surface required fvermaut to name a stage or a skill at any point
- [ ] **Human gate:** fvermaut confirms the PR told him everything he needed to judge the work, and that the review loop did what his comments asked

---

### Sub-phase 13i: documentation and close

**[MODIFY]** `README.md` — `timone retry`; how the review loop reads a PR comment.
**[MODIFY]** `doc/specs/prd/prd-02-inversion-of-control.criteria.md` — after 13h's gate: R6 and R7 as warranted; **R11 stays `draft`** with a partial-evidence marker naming the unobserved preview clause; evidence-limit notes on R2, R10 and R15 updated where 13h supplied the missing live halves.
**[MODIFY]** `STATUS.md` — phase 14 (previews) named as next.
**[NEW FILE]** `doc/plans/phases/reports/phase-13-complete.md` — noting that the phase's two process contradictions were settled *before* approval ([ADR-0015](../../adr/0015-branch-per-driving-unit.md), [ADR-0016](../../adr/0016-review-remediation-rides-the-verify-fix-shape.md)) rather than flagged for later, and carrying ADR-0016's boundary-judgment risk to the open questions with whatever 13h's step 5 showed about it.

**Seams under test (TDD):** no behaviour-carrying code; validation is checklist-based.

> All prior sub-phases must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
grep -n "retry" README.md | head
grep -n "Status:\*\* verified" doc/specs/prd/prd-02-inversion-of-control.criteria.md
```

- [ ] Register flips only where 13h produced evidence, with limits written in rather than implied
- [ ] The report says the contradictions were settled pre-approval, and where

## Dependency graph

```
13a → (none)        PR surface of the ticketing seam
13b → (none)        pipeline back half + outcome marker + status rendering
13c → 13b           the execution stage (R6, first half)
13d → 13b,13c       the verification stage (R6, second half)
13e → 13a,13b,13d   the delivery stage (R7)
13f → 13a–13e       the review loop on the PR (R11, minus the preview)
13g → 13b           `timone retry` — recovery, un-anchored
13h → all prior     live proof on scratch-app, human gate
13i → 13h           docs last + register flips
```
