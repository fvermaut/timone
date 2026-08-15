# Phase 23: the breakdown is a stage, and a phase file gates nothing

> **Status:** Approved for execution by fvermaut 2026-08-15.

> **Twelfth phase of [PRD-02](../../specs/prd/prd-02-inversion-of-control.md), and the half [phase 22](phase-22.md) could not build.** Governing decision: **[ADR-0030](../../adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md)** — the breakdown is a pipeline stage of its own, and chunk zero merges without a pull request. **That record is `accepted`, on fvermaut's rulings of 2026-08-15**, put to him as three plain-language questions about what he would see on a ticket rather than about the mechanism: he chose **two approvals** rather than one combined (D1's gate, and the answer that rules out a third touch at D2), **just build it** for a small chore (D3), and **leave the list of pieces alone** once approved (D4). All four decisions are normative here; this phase implements them and settles none of them. Standing: [ADR-0026](../../adr/0026-a-ticket-is-a-conversation-a-run-is-a-chunk.md), [ADR-0028](../../adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md), [ADR-0029](../../adr/0029-a-chunk-advances-only-on-success.md), [ADR-0012](../../adr/0012-conversation-channels.md), [ADR-0014](../../adr/0014-artifact-first-gates.md), [ADR-0015](../../adr/0015-branch-per-driving-unit.md), [ADR-0016](../../adr/0016-review-remediation-rides-the-verify-fix-shape.md), [ADR-0019](../../adr/0019-timone-authored-commits-carry-a-provenance-trailer.md).

## Why this phase exists, and why it is next

**Phase 22 built the ledger and cut the shaping.** 22a and 22b landed chunked run ids, settledness and `timone cancel`; 22c, 22d, 22e and 22f were [cut unbuilt on 2026-08-15](phase-22.md#-cut-2026-08-15--22c-22d-22e-and-22f-are-not-built-and-are-not-this-phases-any-more) and are kept verbatim in that file as this phase's raw material. The cut names three reasons and two of them were **questions the plan could not answer from inside a slice**: whether the breakdown is a new stage or a re-pointed `requirements` gate, and what performs the merge D2 asks for. [ADR-0030](../../adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md) answers both, up front, so no slice here has to choose.

**The third reason was a file list, and this plan is written against it.** 22c granted five files; the change reaches at least fourteen. Every one of them is named below, with the mechanism that makes it necessary — [the completion report](reports/phase-22-complete.md) records that 22a needed **two attempts** and 22b needed **two extensions**, all four for want of files the plan never granted, and that is the failure this plan is shaped to avoid.

**It is next because [R22](../../specs/prd/prd-02-inversion-of-control.criteria.md#r22--a-ticket-hosts-a-sequence-of-chunks) is now persisted and half of it is unbuildable-against.** R22's own marker of 2026-08-15 says so in terms: clauses 1, 2, 7 and 8 have machinery; **clauses 3 to 6 have no machinery at all**. A register entry naming behaviour nothing implements is the state this project treats as a debt, not a plan.

**And because the contradiction the machine found about itself is live right now.** [`timone-execute`'s gate 1](../../../.claude/skills/timone-execute/SKILL.md) refuses any phase file not stamped `Approved for execution`, naming *"a file with no `Status` line at all"* as covered. Under ADR-0030 every per-chunk phase file is exactly that. Until 23e lands, the skill and the decision disagree — which is why 23e is inside this phase and not after it.

## Requirements

> **PRD:** [prd-02-inversion-of-control.md](../../specs/prd/prd-02-inversion-of-control.md) — criteria in [prd-02-inversion-of-control.criteria.md](../../specs/prd/prd-02-inversion-of-control.criteria.md)

| ID | Priority | Requirement (one line) | This phase |
| --- | --- | --- | --- |
| [PRD-02.R22](../../specs/prd/prd-02-inversion-of-control.criteria.md#r22--a-ticket-hosts-a-sequence-of-chunks) | MUST | A ticket hosts a sequence of chunks | **clauses 3–6 built**, and the whole requirement offered for verification if 23i's gate is obtained |
| [PRD-02.R5](../../specs/prd/prd-02-inversion-of-control.criteria.md#r5--plan-gate-on-the-ticket) | MUST | Plan gate on the ticket | **revised** — the per-chunk plan gate is retired, so its `verified` sign-off lapses |
| [PRD-02.R10](../../specs/prd/prd-02-inversion-of-control.criteria.md#r10--serialized-work-per-project) | SHOULD | Serialized work per project | **revised** — the chunk holds the project, not the ticket, so its `verified` sign-off lapses |

**R22's clauses 1, 2, 7 and 8 already have machinery** and this phase builds nothing for them: settledness and the failed-chunk hold ([ADR-0029](../../adr/0029-a-chunk-advances-only-on-success.md)), `timone cancel`, and the closed-or-unmarked check in the poll loop all landed in phase 22. **Clauses 3, 4, 5 and 6 are this phase's** — the breakdown and its single gate (23a–23d), a phase file that gates nothing (23e), chunk succession and the ticket's closing (23f), and the window between chunks (23f, 23g). They are watched at 23i.

**Nothing normative is written before approval.** R5's and R10's revisions are applied by 23h and are set out there in full. If this phase is amended, nothing has to be unwound.

Deliberately **not** this phase: **parallel chunks on one project** — [PRD-02's out-of-scope list](../../specs/prd/prd-02-inversion-of-control.md#out-of-scope) rules out worktrees and this phase does not reopen it; **the attribution defect** (an uncommitted change carries no trailer); the frozen output-token counter; `timone status` understanding "blocked by"; and **adding exhaustiveness tripwires to the remaining bare switches**, which [phase 22's report](reports/phase-22-complete.md) leaves unclaimed and which this phase only pays where a slice's own change reaches one.

## Goal Description

A specification is broken into pieces once, you approve that once, and then you judge one pull request at a time — and the per-chunk plan is a document you can read rather than a gate you have to answer.

**Load-bearing, so the build does not drift into something easier:**

- **`breakdown` is a stage, not a re-labelled gate.** [ADR-0030](../../adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md)'s D1 rejects re-pointing the `requirements` gate on two counts, and the argument is the shape of the graph: a stage declares exactly one `waits` value ([`pipeline.ts:181`](../../../src/daemon/pipeline.ts)) and one `planning` doing both jobs would have to be gated on its first visit and ungated afterwards.
- **A phase file stops being a gate and stays an artifact.** Retiring the per-chunk plan gate does not mean retiring the plan, and it does not mean retiring the `Status` line: the **exit** stamp survives untouched. 23e says exactly which half goes.
- **The human never types a chunk number, and never types the word "breakdown".** `timone takeover ivtrends#1`, `timone retry ivtrends#1` and `timone cancel ivtrends#1` read today exactly as they did before phase 22 and are not touched here.
- **Two approvals for a whole initiative is the point, and it is the risk.** After this, a five-chunk milestone is approved twice up front — the specification, then the list of pieces — and judged five times as pull requests. fvermaut chose the second approval over one combined answer, so each is about one thing. [ADR-0030](../../adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md) says this is where that choice stops being cheap to reverse. 23i's human gate is where fvermaut says whether it is the rhythm he ruled for.
- **The daemon acquires the ability to merge, in exactly one place.** Chunk zero, on the breakdown's approval, and nowhere else. The blanket instruction that forbids it acquires a scope in the same slice that breaks it — a rule the machine itself now breaks in one place is a rule the next reader will not trust.

## Context & Prerequisites

- **`main` is the working branch**, as for phases 15–22. `main` is at `19f13e0`, clean, pushed.
- **859 tests green across 24 files at `19f13e0`**, type-check clean. The command is **`npm run type-check` — note the hyphen. There is no `typecheck` script**, and assuming one cost a session an hour on 2026-08-14.
- `npm run build` before any `node dist/cli.js`. A stale `dist/` has produced a confusing result more than once.
- **The daemon must be restarted after any slice whose behaviour is to be observed.** A running daemon keeps the code it started with. This has now bitten five times.
- **A live daemon currently holds `.timone/state.json`** — it holds the lock and writes `observedAt` every cycle. **Never point a mutating command at that file.** Copy it and use `--state <copy>`, as every slice of phase 22 did. The live ledger holds 26 runs, of which two are failed (`scratch-app#10/1`, `#13/1`) and one is parked; clearing them is [phase 21](phase-21.md)'s inside its own gate, not this phase's.
- **[Phase 21](phase-21.md) is still `Awaiting approval` and is independent of this one.** It shares no files: its only code slice is 21b's register and `STATUS.md` edits, which touch different requirement entries (R15) than 23h does (R5, R10, R22). If both land, whichever runs second re-reads the count rather than assuming it.
- **A flake was seen once and not reproduced** ([phase 22's report](reports/phase-22-complete.md)): one full-suite run in eight returned a single failure. The suite's only wall-clock-sensitive tests are the real-`git` ones in `guardrails.test.ts`. A single red run that goes green on re-run is a note in the handoff, not a slice failure — a second red run at the same test is.

> **✏ Refined 2026-08-15 — a latent suite flake was diagnosed during 23b and fixed at the root, outside any slice's grant.**
>
> `guardrails.test.ts`'s *"resolves the session id against the ledger"* began failing on every full run once 23b added twenty tests, while passing alone. It is not a logic break: a class of tests here drives **real git** on purpose — building actual repositories and shelling out a dozen times per case, because the rules they check are rules about git and a fake would prove nothing — and vitest's 5s default is not sized for it under a parallel run.
>
> **This is the flake [phase 22's completion report](reports/phase-22-complete.md) recorded as "seen once and not reproduced", one run in eight with its name lost to a `tail`.** 23b's added load turned it deterministic, which is how it was finally identified.
>
> **[MODIFY]** `vitest.config.ts` — `testTimeout: 20_000`, with the reasoning in place. Granted to no slice and taken as orchestrator-level repository maintenance, because a red suite makes every later slice unable to tell its own breakage from inherited breakage. Verified by three consecutive full runs at 891 green. Nothing in production waits on git for five seconds; this admits a real-git fixture is I/O bound and gives it room.

## Sub-phases

### 23a — The breakdown artifact

**[NEW FILE]** `src/daemon/breakdown.ts` — reading, parsing and rendering `doc/plans/breakdowns/ticket-NN.md`.
**[NEW FILE]** `src/daemon/breakdown.test.ts`.

**No pipeline changes at all.** This slice adds a module and wires nothing to it. Nothing else in `src/` learns the path in this slice, which is what makes it independently landable and what makes its own validation meaningful.

**What the artifact is.** A committed markdown file in the *project* repo at `doc/plans/breakdowns/ticket-NN.md` ([ADR-0028](../../adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md) D1): a `Status` line and an ordered list of chunks, each a title and one line of what it delivers. The stamp has two states — `Awaiting approval`, and `Approved by <who> <date> — N pieces`.

**The piece count in the stamp is load-bearing and is this slice's one design choice, so it is stated rather than discovered.** It is what makes a **re-proposal** detectable from the artifact alone: a file whose list is longer than the count its own approval stamp names has gained a chunk since the human read it, which is exactly [ADR-0028](../../adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md) D3's case. Detecting it by comparing against the ledger instead would put the answer in a second place that can drift from the artifact, which is the fault D1 chose the committed file to avoid.

**Doneness is derived, not written into the file — this is [ADR-0030](../../adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md)'s D4 and it is ruled, not proposed.** It is a deliberate departure from R22 clause 5's literal wording — the clause says *"the merged chunk is marked done in the breakdown"*. Marking it there means the **poll loop** editing, committing and pushing a file on a client's default branch, and the daemon has never committed or pushed anything anywhere — `src/git.ts` exports no such primitive and no slice here can honestly grant one to the poll loop without inventing a whole write path. What is free and equally true: the ledger already knows how many of a ticket's chunks have settled `done`, so *which chunk is next* is a computation over the file's ordered list and that count. The breakdown therefore **stays immutable after approval**, which is a better fit for [ADR-0014](../../adr/0014-artifact-first-gates.md) than a file the machine edits behind the human's back — an approved artifact that mutates is one the human's approval no longer describes. **The cost, named:** a reader of the file alone cannot see progress; they see it on the ticket, where 23g puts it. **fvermaut was asked on 2026-08-15 whether the list should tick itself as pieces land, and was told the alternative meant Timone writing to a repo's default branch on its own; he ruled for the immutable file and progress on the ticket.** No slice here re-opens it.

**The module's surface**, so a fresh context does not invent one:

- `breakdownPath(ticket: number): string` — `doc/plans/breakdowns/ticket-NN.md`, and the only place that path is spelled.
- `parseBreakdown(text: string): ParsedBreakdown | { kind: "malformed"; reason: string }` — pure, no I/O.
- `renderBreakdown(b): string` — the inverse, so the round-trip is assertable.
- `readBreakdown(repoDir: string, ticket: number): BreakdownRead` — `{ kind: "ok", … } | { kind: "absent", path } | { kind: "malformed", path, reason }`. **It returns an answer; it never throws.**
- `chunkProgress(b, doneChunks: number): { total: number; done: number; next?: { index: number; title: string } }` — the one computation 23f and 23g both read.
- `isReproposal(b): boolean` — the stamp's count against the list's length.

**Seams under test (TDD):** `parseBreakdown`, `renderBreakdown`, `readBreakdown`, `chunkProgress` and `isReproposal`, all exported from `src/daemon/breakdown.ts`. Red-green cases:

- **Round-trip.** Red: `parseBreakdown(renderBreakdown(b))` returns nothing equal to `b` because neither function exists. Green: it does, for a three-chunk `Awaiting approval` breakdown **and** for an `Approved by fvermaut 2026-08-15 — 3 pieces` one, with the who, the date and the count preserved.
- **Done/next resolution.** Red: `chunkProgress(b, 1)` on a three-chunk breakdown does not answer chunk 2. Green: it answers `{ total: 3, done: 1, next: { index: 2, title: … } }`; at `doneChunks: 3` it answers `next: undefined`, which is the "close the ticket" signal 23f reads. A `doneChunks` larger than the list is clamped and still answers `next: undefined` rather than throwing.
- **Re-proposal detection.** Red: a stamp naming 2 pieces over a 3-item list answers `false`. Green: it answers `true`, and a stamp naming 3 over a 3-item list answers `false`. An `Awaiting approval` breakdown answers `false` — nothing has been approved, so nothing has been re-proposed.
- **An absent or malformed file answers readably.** Red: `readBreakdown` on a directory with no `doc/plans/breakdowns/` throws `ENOENT`. Green: it returns `{ kind: "absent", path }` with the path in it. A file with a `Status` line and no list, and a file with a list and no `Status` line, both return `{ kind: "malformed" }` with a reason a human can read — because 23f asks this question every cycle and an exception there takes a whole project's poll turn down.

**Fixtures build their own directory** per [standards/testing.md](../../../standards/testing.md)'s no-shared-seed rule; `guardrails.test.ts` is the in-repo precedent for real-filesystem work in this suite.

> No dependencies. 23a is the first slice and can start immediately.

#### Agent Validation Steps

```bash
npm test -- src/daemon/breakdown.test.ts
npm run type-check
npm test
```

- [ ] `readBreakdown` against a temp directory containing no `doc/` at all returns an `absent` answer, asserted with `expect(() => …).not.toThrow()` **around the call itself**, not around a wrapper that catches for it
- [ ] A breakdown whose stamp names fewer pieces than it lists answers `re-proposal`; one whose counts agree does not — both asserted, since only the pair proves the comparison is happening
- [ ] `git grep -n "breakdowns/" -- src ':!src/daemon/breakdown.ts' ':!src/daemon/breakdown.test.ts'` returns nothing — 23a is a module, and a slice that has already wired it has done 23b's job inside 23a's grant
- [ ] The full suite is green and the count has gone **up** from 859, not sideways

### 23b — `breakdown` becomes a pipeline stage

**[MODIFY]** [`src/daemon/pipeline.ts`](../../../src/daemon/pipeline.ts) — `"breakdown"` joins `PIPELINE_STAGES` ([`:66`](../../../src/daemon/pipeline.ts)) between `requirements` and `planning`; a `breakdown` row joins `STAGES` ([`:181`](../../../src/daemon/pipeline.ts)) declaring `processStage: 5`, `waits: "gate"`, `ownsBranch: true`, `built: true`, `next: "planning"`, with a model and effort; `requirements`'s `next` ([`:280`](../../../src/daemon/pipeline.ts)) becomes `"breakdown"`; `planning`'s row ([`:282`](../../../src/daemon/pipeline.ts)) moves from `waits: "gate"` to `waits: "none"`, keeping `ownsBranch: true` and `next: "execution"`.
**[MODIFY]** [`src/daemon/session.ts`](../../../src/daemon/session.ts) — **`afterStage` ([`:883`](../../../src/daemon/session.ts)) gains a `planning` branch.** See the second trap below; without it this slice is a live regression rather than a feature.
**[MODIFY]** [`src/daemon/gate-comment.ts`](../../../src/daemon/gate-comment.ts) — a `breakdown` row joins `GATED` ([`:87`](../../../src/daemon/gate-comment.ts)); `planning`'s row ([`:96`](../../../src/daemon/gate-comment.ts)) is removed.
**[MODIFY]** [`src/daemon/prompts.ts`](../../../src/daemon/prompts.ts) — `"breakdown"` joins `PROMPTED_STAGES` ([`:15`](../../../src/daemon/prompts.ts)); a `case "breakdown"` joins `stageBody`'s switch ([`:324`](../../../src/daemon/prompts.ts)); a new `breakdownPrompt` beside `planningPrompt` ([`:876`](../../../src/daemon/prompts.ts)); a `breakdown` row joins `APPROVAL_RECORD` ([`:599`](../../../src/daemon/prompts.ts)).
**[MODIFY]** [`src/commands/status.ts`](../../../src/commands/status.ts) — a `breakdown` row in `STAGE_LABELS` ([`:19`](../../../src/commands/status.ts)).
**[MODIFY]** [`src/daemon/pipeline.test.ts`](../../../src/daemon/pipeline.test.ts) — the gated-set assertion ([`:405`](../../../src/daemon/pipeline.test.ts)) and the every-unattended-stage-declares-a-model loop ([`:326`](../../../src/daemon/pipeline.test.ts)); also `runsUnattended("planning")` ([`:265`](../../../src/daemon/pipeline.test.ts)) and the written-out model table ([`:276`](../../../src/daemon/pipeline.test.ts)), which gains a `breakdown` pair.
**[MODIFY]** [`src/daemon/cta.test.ts`](../../../src/daemon/cta.test.ts) — the `WAIT_AT` table ([`:327`](../../../src/daemon/cta.test.ts)) gains `breakdown: "gate"` and flips `planning` to `undefined`; the key-set assertion at [`:348`](../../../src/daemon/cta.test.ts) is what makes the omission impossible.
**[MODIFY]** [`src/daemon/session.test.ts`](../../../src/daemon/session.test.ts) — `gateCommentFor("planning", …)` is asserted at [`:1330`](../../../src/daemon/session.test.ts) and [`:1341`](../../../src/daemon/session.test.ts) and goes red the moment `planning`'s `GATED` row is removed; plus the new assertions below. **Three more go red and are named here so they are not a surprise:** [`:2605`](../../../src/daemon/session.test.ts), [`:2636`](../../../src/daemon/session.test.ts) and [`:2660`](../../../src/daemon/session.test.ts) all drive `planning` on a `triage:chore` ticket and assert gate behaviour — `:2636` that the last comment contains `"approve"`, `:2656` that the run is `parked`. They encode the gate this slice retires, so they are corrected, not weakened. **Phase 22 failed twice on exactly this**, a type or graph change reaching tests the plan had not enumerated; enumerating them is the cheap half of the fix.
**[MODIFY]** [`src/daemon/prompts.test.ts`](../../../src/daemon/prompts.test.ts) — **scoped to whatever the new prompt fails.** Nine `it.each(PROMPTED_STAGES)` obligations ([`:82`](../../../src/daemon/prompts.test.ts) onward) run against every member automatically; `breakdownPrompt` satisfies them by composing the same shared blocks the others do (`ticketBlock`, `feedbackBlock`, `reentryBlock`, `writingBlock`), so this file may need no edit at all. It is granted because "may need no edit" is precisely what phase 22 assumed twice and was wrong about twice.

**Two traps, and they behave oppositely. Say which is which in the handoff, because the next person to add a stage will read it.**

- **`GATED` and `STAGE_LABELS` are `Partial<Record<PipelineStage, …>>`, so a gated stage with no `GATED` row posts no gate comment and does not fail the build.** `openGate` ([`session.ts:1128`](../../../src/daemon/session.ts)) reads `if (comment !== undefined)` and then parks the run on a gate regardless — so the run waits for an approval to a question nobody was asked, silently, for ever. **This is the slice's most important assertion and the compiler will not make it for you:** a test that derives the gated set from `PIPELINE_STAGES` and asserts `gateCommentFor` is defined for every member of it. Write that test, not a spot-check on `breakdown`.
- **`stageBody`'s switch ([`prompts.ts:324`](../../../src/daemon/prompts.ts)) has no `default` and the function returns `string`, so a new `PROMPTED_STAGES` member without a case *is* a compile error** (TS2366) under `strict`. That one you may lean on: it fires at `npm run type-check`, which is in this slice's own validation block.

**And the trap the cut did not name, which is why `session.ts` is granted.** `afterStage` ([`session.ts:883`](../../../src/daemon/session.ts)) dispatches on `waitFor(stage)` and then on the stage by name, and its **final fall-through assumes the only remaining wait-free stage is `triage`** ([`:941`](../../../src/daemon/session.ts)): it reads a classification off the ticket's labels and routes it. Move `planning` to `waits: "none"` without touching this and a finished planning session on a `triage:feature` ticket routes **back to `clarification`**, on a `triage:chore` ticket routes **back to `planning`** — an unbounded loop that spends money every cycle — and on a ticket with no `triage:` label at all fails the run with *"triage recorded no classification"*. **What to add:** a `planning` branch immediately before the fall-through, using `afterWorkStage` ([`:675`](../../../src/daemon/session.ts)) exactly as `execution` and `verification` do, with `producedWork` as the artifact witness. `producedWork` is already a parameter of `afterStage` and is the branch-tip comparison [R5's own history](../../specs/prd/prd-02-inversion-of-control.criteria.md#r5--plan-gate-on-the-ticket) records being installed after the daemon once gated on a session's exit code — **using it here is what stops that defect from being reintroduced by an ungated stage**, and `afterWorkStage` returns `stageAfter("planning")` on success, which is `execution`.

**What `breakdownPrompt` says, since no skill describes the breakdown until 23e.** It is written to stand alone for exactly that reason: the branch (chunk zero, already claimed by `requirements`), the approved PRD pair on it as the thing being broken up, the path from `breakdownPath`, the ordered list with one chunk per pull-request-sized piece, the `Awaiting approval` stamp, a plain-words ticket comment describing the shape, and **an explicit instruction not to ask for approval** — the machinery posts the gate comment itself, immediately after, exactly as `planningPrompt` ([`:903`](../../../src/daemon/prompts.ts)) already says.

**`breakdown` inherits chunk zero's branch rather than cutting one.** `claimBranch` ([`session.ts:1086`](../../../src/daemon/session.ts)) returns early when the run already has a branch, so `ownsBranch: true` on `breakdown` costs nothing and keeps the project held across the gate — which is what [ADR-0028](../../adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md) D2 means by requirements and the breakdown sharing one branch.

**Seams under test (TDD):** `waitFor`, `stageAfter`, `runsUnattended` and `modelFor` in `pipeline.ts`; `gateCommentFor` in `gate-comment.ts`; `stagePrompt` in `prompts.ts`; `afterStage`'s observable effect through the spawner in `session.test.ts`. Red-green cases:

- **The graph.** Red: `stageAfter("requirements")` is `"planning"` and `waitFor("planning")` is `"gate"`. Green: `stageAfter("requirements") === "breakdown"`, `stageAfter("breakdown") === "planning"`, `waitFor("breakdown") === "gate"`, `waitFor("planning") === "none"`.
- **The gated set, exactly.** Red: `PIPELINE_STAGES.filter(s => waitFor(s) === "gate")` is `["requirements", "planning"]`. Green: `["requirements", "breakdown"]`, with `readGate` advancing each to its own `stageAfter` — the "one mechanism for both gated stages" property [`pipeline.test.ts:401`](../../../src/daemon/pipeline.test.ts) exists to hold.
- **No gated stage is silently commentless.** Red: with `breakdown` gated and no `GATED` row, a derived-set test finds `gateCommentFor("breakdown", …) === undefined` while the build and the type-check are both clean — that red is the whole point, and it must be seen. Green: every gated stage has a comment, and `gateCommentFor("planning", …)` is now `undefined` because `planning` is not gated.
- **A finished planning session advances to execution and does not re-route.** Red: with `planning` wait-free and no branch in `afterStage`, a spawner test on a `triage:feature` ticket ends the run at `clarification`. Green: it advances to `execution`. A second case with `producedWork` false fails the run with a reason naming the branch not moving, and does **not** advance — the artifact witness, asserted going both ways.
- **Every built unattended stage declares a model.** [`pipeline.test.ts:325`](../../../src/daemon/pipeline.test.ts) is already this loop and goes red the moment `breakdown` joins without one.

> 23a must be complete. 23b does not import `breakdown.ts` — the dependency is ordering, not code: 23b's prompt names the path `breakdownPath` owns, and two slices spelling that path independently is how they drift.

#### Agent Validation Steps

```bash
npm run type-check
npm test -- src/daemon/pipeline.test.ts src/daemon/cta.test.ts src/daemon/prompts.test.ts src/daemon/session.test.ts
npm test
npm run build
node dist/cli.js status
```

- [ ] `npm run type-check` was seen **red** on the missing `stageBody` case before it was written — the compiler-enforced trap, demonstrated rather than assumed
- [ ] The gated-set assertion reads `["requirements", "breakdown"]` and is derived from `PIPELINE_STAGES`, not written as a literal list of two strings compared to another literal
- [ ] A test asserts `gateCommentFor` is defined for **every** stage whose `waitFor` is `"gate"`, computed from `PIPELINE_STAGES` — so the next gated stage cannot ship commentless
- [ ] `node dist/cli.js status` runs clean against a **copy** of the ledger (`--state <copy>`), never `.timone/state.json`
- [ ] The handoff names which of the two traps the compiler catches and which it does not, in those words

### 23c — A chore is deliberately ungated

**[MODIFY]** [`src/daemon/pipeline.test.ts`](../../../src/daemon/pipeline.test.ts) — the chore arm of `routeAfterTriage` ([`:100`](../../../src/daemon/pipeline.test.ts)) keeps its expected value and gains the property assertion below.
**[MODIFY]** [`src/daemon/session.test.ts`](../../../src/daemon/session.test.ts) — the walk that proves no gate comment is posted anywhere on a chore's route.
**[MODIFY]** [`process.md`](../../../process.md) — stage 1's routing sentence ([`:27`](../../../process.md)), which routes *"chore/technical enabler → stage 5, unanchored"* and, with stage 5's gate retired by 23e, would leave every reader to infer a gate that no longer exists.
**[MODIFY]** [`.claude/skills/timone-triage/SKILL.md`](../../../.claude/skills/timone-triage/SKILL.md) — the routing table's chore row ([`:45`](../../../.claude/skills/timone-triage/SKILL.md)), the same correction in that file's voice.

**There is no production edit in this slice, and that is stated rather than papered over.** `routeAfterTriage`'s `case "chore"` ([`pipeline.ts:420`](../../../src/daemon/pipeline.ts), in the switch at [`:416`](../../../src/daemon/pipeline.ts)) returns `{ kind: "advance", stage: "planning" }` and **stays exactly as it is**; 23b has already made `planning` ungated. So the behaviour is true the moment 23b lands, and nothing under `src/` needs to change for it. What is missing is that **nothing proves it and two documents still describe the old route** — proof and record are the whole deliverable, and inventing a code change to make the slice look like the others would be dishonest about what it does.

**What was ruled, and when.** This was 23c's open question and it is closed: on **2026-08-15** fvermaut was asked whether a small chore — *bump the linter* — should put a plan in front of him first or just get built, with his judgement on the pull request. **He chose *just build it*.** He was shown the risk in the same breath — **nothing stops a misread chore before the work happens** — and accepted it. The alternative was genuine and is named in [ADR-0030](../../adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md)'s D3 with its cost: routing chores through `breakdown` keeps a gate, and a one-chunk breakdown ("one piece — do the thing") would have read naturally enough, but it costs a gate on every chore including the ones where the answer is obviously yes. **A chore therefore runs triage → planning → execution → a pull request with no human gate at any point**, and merging that pull request is where his judgement now lands.

**This is a gate a chore has today, lost on purpose.** The slice is not a regression fix and must not be written as one. The documents it corrects are the ones that would otherwise let a future reader treat the loss as a bug and "restore" it.

**Seams under test (TDD):** `routeAfterTriage` in `pipeline.ts`, and the spawner's observable comment stream in `session.test.ts`. **This slice modifies no file under `src/` except test files, so it carries no production behaviour of its own** — the seams are 23b's, observed here to prove what 23b made true. `process.md` and the triage skill carry no behaviour and are validated by checklist. That is the sanctioned statement, said rather than omitted. Red-green cases:

- **A chore's route reaches no gated stage.** Red (before 23b): `waitFor(routeAfterTriage("chore").stage)` is `"gate"`. Green: it is `"none"` — asserted as the property, **and** separately that `routeAfterTriage("chore")` still returns `{ kind: "advance", stage: "planning" }`, so nothing can satisfy the property later by quietly re-routing the chore somewhere else.
- **Nothing else moved.** `feature` still goes to `clarification`, `bug` to `feedback`, `question` still finishes with its reason — asserted in the same block, because a switch nobody edits is still a switch somebody will.
- **A chore reaches its pull request with no gate comment anywhere.** Red: walking a `triage:chore` ticket triage → planning → execution through the spawner posts an approval request. Green: across the whole walk **zero** comments carrying the gate call to action are posted — asserted against the collected comments on the fake adapter, matched on `gateCommentFor`'s own rendered wording, **not** on a log line and **not** on the absence of a `parked` status alone. The run ends at `execution`.
- **The negative control, in the same file.** A `triage:feature` ticket walked the same way **does** get exactly one gate comment, at `requirements`. Without it, a probe that collects nothing would report a clean chore route and prove nothing at all.

> 23b must be complete — before it, `planning` is still gated and every assertion here is false. 23c makes no code change 23b could conflict with, but it asserts 23b's behaviour, so it cannot precede it.

#### Agent Validation Steps

```bash
npm test -- src/daemon/pipeline.test.ts src/daemon/session.test.ts
npm run type-check
npm test
git diff --stat -- src/
grep -n -i "chore" process.md .claude/skills/timone-triage/SKILL.md
```

- [ ] `git diff --stat -- src/` for this slice lists **only** `*.test.ts` files — a production edit here is a slice inventing work it was told it does not have
- [ ] The no-gate-comment assertion is a **count of zero** over the collected comments, and the feature-ticket control in the same file asserts **one** — either alone passes against an adapter that collects nothing
- [ ] `process.md` stage 1 and `timone-triage`'s routing table **both** say a chore meets no gate before its pull request; one of the two saying it is the state this slice exists to end
- [ ] Neither document edit reaches `process.md` stage 5 or stage 6 — those lines are 23e's, and two slices editing one file is why these two do not run in parallel
- [ ] The handoff records that fvermaut ruled on 2026-08-15 that a chore is just built, that he was shown the risk and accepted it, and that his judgement is the pull request — so 23i's report can say the gate was lost on purpose

### 23d — Chunk zero merges on approval

**[MODIFY]** [`src/git.ts`](../../../src/git.ts) — a merge primitive. **This is the daemon's first write to any branch other than the one it is standing on.** The module exports `clone`, `isGitRepo`, `isClean`, `currentBranch`, `defaultBranch`, `fetch` and `fastForward` and nothing else, and its only `git merge` is `merge --ff-only @{u}` at [`:104`](../../../src/git.ts), which pulls a branch onto its own upstream. What to add: `mergeIntoDefault(dir, branch)` — refuse on a dirty tree (`isClean`), `fetch`, check out the default branch (`defaultBranch`), merge `branch`, push. It returns a result rather than throwing on a merge conflict, because the caller has to put the reason on a ticket.
**[MODIFY]** [`src/daemon/session.ts`](../../../src/daemon/session.ts) — a `mergeProbe`-style injectable option beside `repoProbe`, `headProbe`, `planStatusProbe` and `verificationReportProbe` ([`:181`](../../../src/daemon/session.ts) onward), defaulting to `git.ts`'s implementation; and the call site in `recordApproval` ([`:1036`](../../../src/daemon/session.ts)), **after** the recording session has committed and pushed the stamp and returned `true`, **before** `spawn` ([`:469`](../../../src/daemon/session.ts)) advances the run. Guarded on `approval.stage === "breakdown"`. A failed merge fails the run with the reason on the ticket, exactly as a failed approval record does at [`:1063`](../../../src/daemon/session.ts).
**[MODIFY]** [`src/daemon/prompts.ts`](../../../src/daemon/prompts.ts) — the delivery prompt's `"**Never merge** — merging is the human's act"` ([`:429`](../../../src/daemon/prompts.ts)) is narrowed to say what it has always meant: never merge **a chunk's pull request**. The instruction keeps its force for the thing it was written about and stops being a blanket rule the machine itself breaks.
**[MODIFY]** [`src/daemon/session.test.ts`](../../../src/daemon/session.test.ts), [`src/daemon/prompts.test.ts`](../../../src/daemon/prompts.test.ts).
**[MODIFY]** [`doc/adr/0015-branch-per-driving-unit.md`](../../adr/0015-branch-per-driving-unit.md) — the exception, **written in rather than left to inference**. Its ticket-path sentence at [`:25`](../../adr/0015-branch-per-driving-unit.md) says ticket-driven work owns its branch *"until the pull request merges or closes"*; chunk zero is the first branch whose life ends somewhere else. Its stacking clause at [`:27`](../../adr/0015-branch-per-driving-unit.md) reasons that the next branch *"always cuts from a default branch that already contains (or has declined) the previous work"* — which chunk zero's merge is what keeps true for chunk 1. A dated amendment marker, in that file's own voice, saying both.

**Why it is not a pull request**, so no slice re-argues it: [ADR-0028](../../adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md) D2 and [ADR-0030](../../adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md) D2 both say the rhythm is *"the breakdown once, then each pull request"*, and a chunk-zero pull request is the third touch — the human approving the breakdown and then being asked to merge the thing they just approved. There is nothing for a review to do: chunk zero carries the PRD pair and the breakdown, both of which the human has just read at the gate.

**No pull request is opened, so nothing tears one down.** Chunk zero has no preview, no delivery report and no `run.pr`, and nothing in `reconcilePreviews` or `releasePreview` is touched — they key on a recorded pull request, and there is not one.

**Seams under test (TDD):** `recordApproval`'s observable effect through the spawner, with the merge injected; `deliveryPrompt` through `stagePrompt`. `git.ts` itself is not unit-tested and gets no test file — there is no `src/git.test.ts` in the suite, the module is a thin shell-out, and the seam the daemon actually depends on is the injected one. Red-green cases:

- **The merge is attempted for the breakdown gate and for nothing else.** Red: no merge is attempted anywhere. Green: approving at `breakdown` calls the injected merge exactly once with the run's branch; approving at `requirements` calls it **zero** times — asserted on the injected function, not on a log line.
- **Order: the stamp is committed before the merge is attempted.** Red: the two happen in either order. Green: a recording session that returns `false` (failed) leaves the merge **uncalled** — asserted as a count of zero, which is the only ordering assertion that cannot be faked by a comment.
- **A merge that fails fails the run and says why.** Red: a rejected merge is swallowed and the run advances to `planning` on a default branch with no specification on it. Green: the run is `failed`, a ticket comment carries the merge's own reason, and the run does **not** advance — because chunk 1 must never cut from a default branch that does not carry the breakdown.
- **The never-merge instruction still forbids what it was written for.** Red: the delivery prompt no longer says anything about merging. Green: it still refuses a pull-request merge in words, and the assertion probes the *prompt string* rather than a comment about it.

> 23b must be complete — the merge is guarded on a stage that does not exist before it. Independent of 23c.

#### Agent Validation Steps

```bash
npm test -- src/daemon/session.test.ts src/daemon/prompts.test.ts
npm run type-check
npm test
npm run build
git -C projects/scratch-app status --porcelain && git -C projects/scratch-app branch --show-current
```

- [ ] The merge-for-requirements case asserts **zero** calls, not "a different call" — a guard that fires for the wrong stage is the failure mode here
- [ ] The failed-merge case asserts the run's status **and** that the next stage was not entered; either alone passes against a half-built guard
- [ ] The last command shows `projects/scratch-app` clean and on its default branch — if a test ran a real merge against the fixture checkout, that is a defect in the test, not a passing slice
- [ ] [ADR-0015](../../adr/0015-branch-per-driving-unit.md) carries a dated amendment naming chunk zero as the exception, and it is the only process artifact under `doc/` this slice touches other than this sub-phase's own handoff section

### 23e — A phase file gates nothing

**[MODIFY]** [`src/daemon/prompts.ts`](../../../src/daemon/prompts.ts) — `planningPrompt` ([`:876`](../../../src/daemon/prompts.ts)) stops instructing the `Awaiting approval` stamp ([`:897`](../../../src/daemon/prompts.ts)) and instructs the phase file as an artifact committed and pushed on the chunk's branch; `executionPrompt` ([`:546`](../../../src/daemon/prompts.ts)) stops saying the phase file's own `Status:` line *"is the authority on whether you may build it"* ([`:562`](../../../src/daemon/prompts.ts)); `APPROVAL_RECORD`'s `planning` row ([`:606`](../../../src/daemon/prompts.ts)) is removed.
**[MODIFY]** [`.claude/skills/timone-plan/SKILL.md`](../../../.claude/skills/timone-plan/SKILL.md) — the `Awaiting approval` stamp in the template ([`:107`–`:108`](../../../.claude/skills/timone-plan/SKILL.md)), the write step ([`:183`](../../../.claude/skills/timone-plan/SKILL.md)) and the ask-for-approval step ([`:185`](../../../.claude/skills/timone-plan/SKILL.md)); **plus a breakdown section** — what the artifact is, where it lives, that it carries the piece count in its stamp, and that it is stage 5's one gate. This is the skill catching up with what 23b's prompt already drives.
**[MODIFY]** [`.claude/skills/timone-execute/SKILL.md`](../../../.claude/skills/timone-execute/SKILL.md) — **gate 1 ([`:54`](../../../.claude/skills/timone-execute/SKILL.md)) refuses any phase file not stamped `Approved for execution`, naming a file with no `Status` line at all as covered. That is the contradiction [ADR-0030](../../adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md) names, and this is where it is resolved.** Gate 1 stops keying on the phase file's stamp and keys on the chunk being listed in an `Approved` breakdown. Its routing keeps both destinations: the **human** where no breakdown was ever approved, `timone-plan` where a re-proposal left the approval stale.
**[MODIFY]** [`process.md`](../../../process.md) — stage 5's table row ([`:15`](../../../process.md)), whose gate column still reads *"Phase file written `Awaiting approval` … then human approves the committed file"*; stage 5's `Status lifecycle` paragraph ([`:37`](../../../process.md)); and stage 6's **Entry gate** sentence ([`:39`](../../../process.md)), which carries the identical rule and would otherwise be left contradicting the two artifacts above.
**[MODIFY]** [`src/daemon/prompts.test.ts`](../../../src/daemon/prompts.test.ts) — whatever asserts the retired instructions.

**Be precise about what replaces the entry gate, because a slice that removes too much breaks execution's completion judgement.** The phase file **keeps** a `Status` line and it **keeps** its final state: `Complete — see <report>`. [`session.ts:910`](../../../src/daemon/session.ts) tests that line with `/^Complete\b/` as execution's artifact witness, and **that check is unchanged and no slice here touches it**. `executionPrompt`'s closing instruction to flip the line to `Complete` is likewise unchanged — it is *"half of how the machinery reads your outcome"* and removing it would leave every chunk failing its own outcome check. **The *exit* stamp survives; only the *entry* gate is retired.** What goes is the birth stamp, the approval stamp, and every sentence that makes either of them a precondition for building.

**[ADR-0014](../../adr/0014-artifact-first-gates.md) is unchanged in substance and this slice must say so where it edits.** "Write first, then gate" still holds — it now gates a different artifact. The breakdown is written before it is approved, and the human approves the committed file. Nothing about the order moved; only which document is in front of them.

**Gate parsing is untouched.** [ADR-0012](../../adr/0012-conversation-channels.md) stands, the ticket is still the sole write-path for a gate decision, and `readGateDecision` reads exactly as it does today.

**Seams under test (TDD):** `stagePrompt("planning", …)` and `stagePrompt("execution", …)` in `prompts.ts`; `approvalRecordPrompt` for the removed row. The skill and `process.md` edits carry no behaviour and are validated by checklist — stated here rather than left silent. Red-green cases:

- **Planning writes an artifact, not a gate.** Red: the planning prompt contains `Awaiting approval`. Green: it does not, and it still instructs committing **and pushing** the phase file — the second half asserted too, because a prompt that drops the push is a phase file the next stage cannot read.
- **Execution does not consult the stamp for permission.** Red: the execution prompt claims the `Status:` line is the authority on whether it may build. Green: that sentence is gone **and** the `Complete` flip instruction is still present — both asserted, in one test, because they live four lines apart and this is exactly where too much gets deleted.
- **No approval record exists for a phase file.** Red: `approvalRecordPrompt({ stage: "planning", … })` names the phase file and its `Approved for execution` stamp. Green: `planning` has no `APPROVAL_RECORD` row, and the prompt falls back to its generic wording — which is unreachable in practice, since `planning` is no longer gated, and is asserted so the fallback is known to be harmless rather than assumed to be.

> 23b must be complete; 23c and 23d are independent of it. 23e is the last slice that can be built without the poll loop, and [the safe stopping point](#safe-stopping-point) is immediately after it.

#### Agent Validation Steps

```bash
npm test -- src/daemon/prompts.test.ts src/daemon/session.test.ts
npm run type-check
npm test
grep -n "Approved for execution" .claude/skills/timone-execute/SKILL.md .claude/skills/timone-plan/SKILL.md process.md
grep -rn "breakdown" process.md .claude/skills/timone-plan/SKILL.md | head
```

- [ ] The first `grep` shows **no** surviving sentence making `Approved for execution` a precondition for building; any hit that remains is historical prose naming the retired rule, and the handoff says which
- [ ] `git grep -n "Complete — see" src/ && git grep -n '\^Complete' src/daemon/session.ts` still finds execution's outcome check — the exit stamp is intact, asserted from the source rather than remembered
- [ ] `process.md` stage 5's row, stage 5's Status-lifecycle paragraph and stage 6's Entry-gate sentence **all three** say the same thing about what gates a build; two out of three is the state this slice exists to end
- [ ] The full suite is green and no process artifact under `doc/` was modified other than this sub-phase's own handoff section

### 23f — Chunk succession

**[MODIFY]** [`src/daemon/poll.ts`](../../../src/daemon/poll.ts) — `concludeReview` ([`:1192`](../../../src/daemon/poll.ts)) stops closing the ticket unconditionally: on a **merged** pull request it reads the breakdown, and closes the ticket **only when no chunk remains**, with a comment linking every pull request the initiative produced ([ADR-0028](../../adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md) D3). `entryContext` ([`:993`](../../../src/daemon/poll.ts)) routes a successor chunk — a run with `seq > 1` and no stage — to `planning` rather than letting the spawner default it to `triage`. `PollDeps` ([`:81`](../../../src/daemon/poll.ts)) gains the way to reach a project's checkout: **it has no `root` today**, which is why this is a grant and not an assumption.
**[MODIFY]** [`src/commands/daemon.ts`](../../../src/commands/daemon.ts) — wire whatever `PollDeps` gained.
**[MODIFY]** [`src/daemon/prompts.ts`](../../../src/daemon/prompts.ts) — `workBranch` ([`:661`](../../../src/daemon/prompts.ts)) takes the chunk's sequence. **Without this every chunk of a ticket gets the same branch name**: `claimBranch` ([`session.ts:1089`](../../../src/daemon/session.ts)) computes it from the ticket alone, so chunk 2 would claim `timone/<n>-<slug>` — already merged and closed — and open a pull request against itself. Seq 1 must render **exactly** as today (`timone/<n>-<slug>`), so every existing branch, ledger entry and test literal survives; seq > 1 takes a distinct suffix. The `timone/` prefix is unchanged, which is what keeps the branch-placement guardrail ([`hooks.ts:86`](../../../src/daemon/hooks.ts)) correct.
**[MODIFY]** [`src/daemon/session.ts`](../../../src/daemon/session.ts) — `claimBranch` passes the run's `seq`.
**[MODIFY]** [`src/daemon/poll.test.ts`](../../../src/daemon/poll.test.ts), [`src/commands/daemon.test.ts`](../../../src/commands/daemon.test.ts), [`src/daemon/session.test.ts`](../../../src/daemon/session.test.ts), [`src/daemon/prompts.test.ts`](../../../src/daemon/prompts.test.ts), [`src/daemon/hooks.test.ts`](../../../src/daemon/hooks.test.ts) — `hooks.test.ts:165` documents the branch-naming rule in a comment and is granted so the comment can be corrected rather than left lying.

**Succession rides the registration loop that already exists, and this is the slice's central mechanism — get it wrong and R22 clause 6 fails silently.** `pollProject` calls `store.register(project.name, ticket.number)` for **every** marked ticket, **every cycle** ([`poll.ts:630`](../../../src/daemon/poll.ts)). `register` ([`runs.ts:617`](../../../src/daemon/runs.ts)) returns the live chunk when one exists and otherwise opens the next sequence number, `queued` when the project is held and `picked-up` when it is free. So the chain is already built:

1. Chunk N's pull request merges. `concludeReview` calls `store.complete(run.id)`, which runs `promoteHead` ([`runs.ts:1128`](../../../src/daemon/runs.ts)) — **a bug queued during chunk N is promoted right here**, in the same call, before anything registers chunk N+1.
2. `concludeReview` reads the breakdown. A chunk remains → the ticket stays open and marked. None remains → the ticket closes, as today, and nothing further registers.
3. The **next** cycle's registration loop finds the ticket still listed, and `register` opens chunk N+1 — `queued` behind the promoted bug, or `picked-up` if nothing was waiting.
4. `entryContext` gives the new chunk `planning`, and the spawner takes it from there.

**That ordering is what R22 clause 6 buys**, and it is why succession must **not** be a direct `register` call inside `concludeReview` before `complete` has promoted the queue: register first and chunk N+1 takes the project ahead of a ticket that has been waiting, which is the exact starvation ADR-0026 split the ledger to end.

**A re-proposed breakdown does not close the ticket.** `isReproposal` (23a) is read at step 2: a breakdown that gained a chunk since its approval has chunks the human has not approved, so the ticket stays open and no successor chunk starts. What happens next is a human's — this slice does not re-open the gate automatically, because re-gating on a file the machine noticed changing is a decision nobody has made. **It says so on the ticket** rather than going quiet.

**The closing comment links every pull request.** The ledger holds them: `runsForTicket` ([`runs.ts:476`](../../../src/daemon/runs.ts)) returns the ticket's chunks in sequence order and each carries its own `run.pr`.

**Marking a chunk done is derived, not written** — see [23a](#23a--the-breakdown-artifact) for the reasoning and the cost. `concludeReview` counts the ticket's `done` chunks from the ledger and asks `chunkProgress`.

**Seams under test (TDD):** `pollOnce`/`pollProject` through the poll loop's injected store, adapter and spawner (as `poll.test.ts` already drives them); `entryContext`'s observable effect on which stage the spawner is handed; `workBranch` in `prompts.ts`. Red-green cases:

- **The last chunk closes the ticket; a non-last one does not.** Red: `concludeReview` closes the ticket on every merge. Green: with a two-chunk breakdown and chunk 1's pull request merged, `closeTicket` is called **zero** times and the ticket keeps its mark; with chunk 2 merged, it is called once with `"completed"` and the comment contains **both** pull-request numbers. A closed-unmerged pull request still closes the ticket `"not-planned"`, unchanged.
- **A queued bug promotes in the window between two chunks.** Red: chunk 2 takes the project and the bug waits behind it. Green: after chunk 1 merges, the queued bug is `picked-up` and chunk 2 is `queued` behind it — asserted on the ledger's statuses, and on `spawn` being called for the bug's run and not for chunk 2's.
- **A successor chunk enters at planning, not triage.** Red: chunk 2 is spawned with no stage and the spawner defaults it to `triage`, re-triaging a ticket triage already classified. Green: the spawn context names `planning`. Chunk 1 with no stage is **unchanged** and still enters at `triage` — asserted, because the discriminator is the sequence number and an over-broad rule would break every first chunk.
- **A re-proposed breakdown does not close the ticket.** Red: a breakdown listing three chunks under a stamp naming two closes the ticket after the second merge, because the count matched what was approved. Green: `closeTicket` is called zero times, no successor chunk is registered, and a comment is posted saying the list has grown since it was approved.
- **Each chunk gets its own branch.** Red: `workBranch` for seq 2 equals `workBranch` for seq 1. Green: they differ, seq 1 is byte-for-byte what it renders today (asserted against a literal, so a "harmless" reformatting cannot slip through), and both start `timone/`.
- **An absent breakdown does not take the project's poll turn down.** Red: a merged pull request on a ticket whose breakdown was never written throws, and the cycle's remaining work for that project is skipped. Green: the cycle records a readable error, closes the ticket as it does today, and the rest of the project's turn still runs.

> 23a, 23b and 23e must be complete. 23e is the dependency that matters and is easy to get backwards: a successor chunk entering at `planning` would be **gated** without it, so chunk 2 would sit waiting for an approval the rhythm says nobody owes.

#### Agent Validation Steps

```bash
npm test -- src/daemon/poll.test.ts src/commands/daemon.test.ts src/daemon/session.test.ts src/daemon/prompts.test.ts src/daemon/hooks.test.ts
npm run type-check
npm test
npm run build
cp .timone/state.json /tmp/timone-23f.json && node dist/cli.js status --state /tmp/timone-23f.json
```

- [ ] The window test asserts the **bug's** run was spawned and chunk 2's was not — asserted on the spawner, not on the order of two log lines
- [ ] `closeTicket` is asserted as a **call count of zero** for the non-last chunk; "was called with something else" would pass against a broken guard
- [ ] The seq-1 branch name is asserted against a literal string, so 26 existing ledger entries and every branch on the fixture keep resolving
- [ ] The last command runs against `/tmp/timone-23f.json` and `.timone/state.json` is byte-identical afterwards (`git status --porcelain .timone/` clean, or `md5` compared before and after)

### 23g — What the ticket says between chunks

**[MODIFY]** [`src/daemon/cta.ts`](../../../src/daemon/cta.ts) — `TicketState` ([`:24`](../../../src/daemon/cta.ts)) gains the initiative's progress as **a plain value** (`{ done, total, next? }`), computed by the caller. `cta.ts` stays pure and learns no filesystem path — it sits beside `gate-comment.ts` *because* it is pure, and a module that reads a checkout is not. `ctaFor` ([`:73`](../../../src/daemon/cta.ts)) uses it in three states.
**[MODIFY]** [`src/commands/status.ts`](../../../src/commands/status.ts) — `ctaOf` ([`:71`](../../../src/commands/status.ts)) supplies the same value. It already loads the manifest and resolves paths, and `ProjectConfig.path` ([`manifest.ts:17`](../../../src/manifest.ts)) is where the checkout is.
**[MODIFY]** [`src/daemon/poll.ts`](../../../src/daemon/poll.ts) — `ctaBody` ([`:940`](../../../src/daemon/poll.ts)) supplies it too, through whatever `PollDeps` gained in 23f.
**[MODIFY]** [`src/daemon/cta.test.ts`](../../../src/daemon/cta.test.ts), [`src/commands/status.test.ts`](../../../src/commands/status.test.ts), [`src/daemon/poll.test.ts`](../../../src/daemon/poll.test.ts).

**The three states** ([ADR-0028](../../adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md) D4):

- **While a chunk runs** — *"building piece 2 of 4"*, and what it needs from the human is nothing.
- **Between chunks** — *"piece 3 of 4 is next — nothing needed from you"*. **This is the state R21 exists for.** Between chunks the ticket has no live run at all, and `ctaFor`'s existing answer for a ticket with no run is *"add the `timone` label"* — a lie on a ticket that is mid-initiative and already labelled. Left alone, the per-cycle reconciliation would write that lie onto every ticket between every pair of chunks.
- **While a pull request waits** — the review CTA, unchanged. It already reads *"your review of pull request #N"* ([`cta.ts:139`](../../../src/daemon/cta.ts)) and only gains the piece count.

**One computation, one renderer each** — [R21 clause 8](../../specs/prd/prd-02-inversion-of-control.criteria.md#r21--every-open-ticket-answers-for-itself) requires `timone status` and the ticket to agree, and the way that is kept true is `ctaFor` deciding once. **Both surfaces must resolve the progress value the same way**; two callers computing it differently is R21's original defect wearing a new costume, and this slice's last checkbox is what catches it.

**The differs-from-last guard is what keeps this quiet.** `reconcileCtas` ([`poll.ts:893`](../../../src/daemon/poll.ts)) compares the rendered body and writes only on a change, so a ticket sitting between chunks for an hour gets one comment edit and not sixty. Nothing here relaxes it.

**Seams under test (TDD):** `ctaFor` in `cta.ts`; `renderStatus` in `status.ts`; `ctaBody` through the poll loop. Red-green cases:

- **Between chunks, the ticket does not ask for a label.** Red: a ticket whose chunks 1 of 3 are done and which has no live run renders *"add the `timone` label to this ticket"*. Green: it renders *piece 2 of 3 is next* and needs nothing from the human — and `waitingOnYou` is **false**, asserted separately, because the sentence and the flag are two facts and `timone status`'s closing line reads the flag.
- **While a chunk runs, the piece is named.** Red: an active run on a three-chunk initiative says only that it is working on it. Green: it names *piece 2 of 3*. A run on a ticket with **no** breakdown renders exactly what it renders today — asserted against the current string, since most tickets have no breakdown and this slice must not change them.
- **The review CTA survives.** Red: adding progress swallows the pull-request number. Green: a review-parked chunk still names `#N` and now also names the piece.
- **The two surfaces agree between chunks.** Red: `timone status` renders one sentence and `ctaBody` renders another for the same state. Green: the same state produces the same `needFromYou` on both — asserted by feeding one state to both renderers in one test, which is how [R21 clause 8](../../specs/prd/prd-02-inversion-of-control.criteria.md#r21--every-open-ticket-answers-for-itself) is checkable at all.

> 23a and 23f must be complete. 23f is where `PollDeps` learns to reach a checkout, and 23g is the second consumer of it.

#### Agent Validation Steps

```bash
npm test -- src/daemon/cta.test.ts src/commands/status.test.ts src/daemon/poll.test.ts
npm run type-check
npm test
npm run build
node dist/cli.js status --state /tmp/timone-23f.json
```

- [ ] No CTA on a ticket with chunks remaining says nothing is happening, and none asks for a label already on the ticket
- [ ] A ticket with **no** breakdown renders byte-for-byte what it rendered before this slice — asserted against the literal strings, since that is nearly every ticket in the live ledger
- [ ] One test feeds a single state to `ctaFor` via both `status.ts`'s path and `poll.ts`'s and asserts the two agree — R21 clause 8, asserted rather than intended
- [ ] `node dist/cli.js status` still runs against a ledger whose projects have no `doc/plans/breakdowns/` directory at all

> **✏ Refined 2026-08-15 — 23h gains four sentences 23e left contradicting, found by that slice and outside every marker in the phase.**
>
> Retiring the phase file's entry gate left four places still describing it, each in a file 23e was not granted. They are documentation, they carry no behaviour, and 23h is the phase's documentation slice, so they land there rather than in a slice of their own.
>
> **[MODIFY]** [`process.md`](../../../process.md) — stage 9's confirmation gate (`:71`) still asserts that stage 5's approval asks *"is this breakdown executable?"*, using **breakdown** in its pre-[ADR-0028](../../adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md) sense of "the cut into slices", which now names a different artifact entirely; the plan-patch vehicle (`:63`) promises "re-approval semantics" for a plan that no longer has an approval to re-take; and stage 6's completion-report element still requires *"a link to the plan with its approval trace"*, a trace a phase file no longer carries.
> **[MODIFY]** [`.claude/skills/timone-improve/SKILL.md`](../../../.claude/skills/timone-improve/SKILL.md) (`:100`, `:110`) — the same re-approval promise, in that skill's voice.
>
> **The word *breakdown* is the trap here.** [ADR-0028](../../adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md) gave it a specific meaning — the committed list of chunks an initiative is built in — but the process documents used it loosely for "the cut into slices" long before that. 23h must read each occurrence and decide which sense was meant, not sweep the word.

### 23h — The register, the narrative, and status

**[MODIFY]** [`doc/specs/prd/prd-02-inversion-of-control.criteria.md`](../../specs/prd/prd-02-inversion-of-control.criteria.md):

- **[R5](../../specs/prd/prd-02-inversion-of-control.criteria.md#r5--plan-gate-on-the-ticket) revised** — `verified` → `revised`, with a dated marker naming this phase. Its criterion at [`:97`](../../specs/prd/prd-02-inversion-of-control.criteria.md) — *"WHEN the planning stage runs THEN the phase file is committed on the branch, referenced in a ticket comment, and gated on approval exactly like R4"* — is what moves: the artifact the gate opens over becomes the breakdown, and the per-chunk phase file is committed and referenced but **not** gated. **Its 2026-08-05 evidence stands as history and stops counting**, exactly as R15's did on 2026-08-14. Both of its existing markers stay: the second one records the live failure that taught this project the difference between gating on an exit code and gating on an artifact, and that lesson is not what changed.
- **[R10](../../specs/prd/prd-02-inversion-of-control.criteria.md#r10--serialized-work-per-project) revised** — `verified` → `revised`, same treatment. Its wording *"started only when the active run reaches a terminal state"* ([`:161`](../../specs/prd/prd-02-inversion-of-control.criteria.md)) is what moves: **the chunk holds the project, not the ticket**, so a queued ticket starts when the active *chunk* settles — which is the window between chunks, not the end of the whole initiative. Its three markers stand as history.
- **[R22](../../specs/prd/prd-02-inversion-of-control.criteria.md#r22--a-ticket-hosts-a-sequence-of-chunks)** — a dated marker recording that clauses 3–6 now have machinery, replacing the *"unbuildable-against rather than failing"* note its 2026-08-15 marker carries. **The status stays `draft`.** Only stage 7 writes a verdict, and this phase's live gate is evidence for a verifier, not a verdict.

**[MODIFY]** [`doc/specs/prd/prd-02-inversion-of-control.md`](../../specs/prd/prd-02-inversion-of-control.md) — an in-scope paragraph for the breakdown and the chunked rhythm, in the voice of the others.
**[MODIFY]** [`STATUS.md`](../../../STATUS.md) — plain language, in fvermaut's second person: a big piece of work is agreed once as a list of pieces, and then arrives a piece at a time, each as its own thing to look at; and the per-piece plan is now something you can read rather than something you have to answer. **The count goes down before it goes up and must say so.** The file currently reads *"twenty-one entries, of which sixteen are verified"* and *"Five are outstanding"* ([`STATUS.md:17`](../../../STATUS.md)); the register now holds **twenty-two** entries, and after this slice **fourteen** are verified and **eight** are outstanding. The existing strikethrough convention is how the corrections are shown.

**This sub-phase carries no behaviour-carrying code — no file under `src/` is modified — so it declares no seams under test, and its validation is checklist-based.** That is the sanctioned statement, said rather than omitted.

**Why the count drops.** Two requirements lose their sign-off because their *wording* changed, not because anything broke. That is the rule [`STATUS.md`](../../../STATUS.md) has always claimed — change the promise, lose the tick until somebody re-watches it — and it has now been applied to Timone itself three times. Saying it plainly is the point of the slice; a count that quietly falls is the thing that makes the file untrustworthy.

**Seams under test (TDD):** none — this sub-phase carries no behaviour.

> 23a–23g must be complete. Writing a `revised` marker for machinery that did not land is the failure phase 22 avoided by cutting 22e with its dependencies.

#### Agent Validation Steps

```bash
grep -n -A4 "^## R5 " doc/specs/prd/prd-02-inversion-of-control.criteria.md
grep -n -A4 "^## R10 " doc/specs/prd/prd-02-inversion-of-control.criteria.md
grep -n -A4 "^## R22 " doc/specs/prd/prd-02-inversion-of-control.criteria.md
grep -c "Status:\*\* verified" doc/specs/prd/prd-02-inversion-of-control.criteria.md
grep -n "entries, of which" STATUS.md
npm test
```

- [ ] R5 and R10 both read `revised`, each with a dated marker naming **phase 23** and stating which words moved
- [ ] The fourth command prints `14` — the register counted, not the count remembered
- [ ] `STATUS.md` says twenty-two entries, fourteen verified, eight outstanding, and says **in words** that the number went down and why
- [ ] R22's status is still `draft` — this slice writes no verdict, because no verifier has checked anything
- [ ] The suite is still green: this slice touches no code, and a red suite here means an earlier slice left something behind

### 23i — The live gate

**[NO CODE.]** Every step on `scratch-app`. **Not `ivtrends`** — ruled on twice, and this phase changes the machinery that would drive it.

**Steps 1–6 are [22f](phase-22.md#22f--the-live-gate)'s, which were written and never run. Step 7 is new and is [ADR-0030](../../adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md) D2's.**

1. **A ticket hosts two chunks.** A fixture specification broken into two pieces, approved once, and both built. Expect: two branches with **distinct names**, two pull requests, both on one ticket's thread, and the ticket closing on the second merge (D3). *R22 clauses 3, 4 and 5.*
2. **The window between chunks is real.** File a second marked ticket while piece 1's pull request is open. Expect: it starts **between** the chunks rather than after both — R10's revision, and the thing the rule was bought for. *R22 clause 6.*
3. **Nothing starts on a closed ticket.** Queue a run, close its ticket, let the project free. Expect: the run is **cancelled with a reason**, no session spawned, nothing paid for. [Finding 8](reports/phase-20-live-gate.md), reproduced deliberately and expected to fail to reproduce. *R22 clause 8 — built in phase 22 and never watched.*
4. **A run can be ended.** `timone cancel` on a live fixture run, and `.timone/state.json` untouched by hand afterwards. [Finding 9](reports/phase-20-live-gate.md). *R22 clause 7 — same.*
5. **The thread between chunks.** Read the ticket with `gh issue view` between the two chunks and confirm it says which piece is next and that nothing is needed — **not silence, and not a stale line about a run that has finished** (D4).
6. **The plan is not a gate.** Confirm a per-chunk phase file is committed and that no gate opens on it, **by reading the ticket thread** — not by the absence of a call in a test. Between the breakdown's approval and the chunk's pull request the thread carries no gate at all.
7. **Chunk zero merges, with no pull request.** After the single `approve` on the breakdown, and before piece 1 starts: confirm on `scratch-app`'s **default branch** that the PRD pair and `doc/plans/breakdowns/ticket-NN.md` are both there and the breakdown is stamped `Approved`; that **no pull request was ever opened** for chunk zero (`gh pr list --state all` shows two, not three); and that piece 1's branch was cut from a default branch that already carries them. Then the failure side, which is the half that is easy to skip: **arrange a merge that cannot succeed** — leave the checkout dirty, or put a conflicting commit on the default branch — and confirm the run **fails with the merge's own reason on the ticket** rather than advancing to a `planning` stage with nothing to plan against.

**A chore, ungated, watched once.** Mark a small fixture chore and confirm it runs triage → planning → execution to a pull request with **nothing on the thread asking for an answer** — the ruled shape (D3), observed rather than assumed from a test. Record what the thread looks like either way: fvermaut ruled on 2026-08-15 without having seen one, and this is the evidence that ruling was made without.

**Seams under test (TDD): none — this is the live gate**, and that is stated rather than omitted. [Phase 14](phase-14.md) found six defects this way against 532 green tests; [phase 20's gate](reports/phase-20-live-gate.md) found ten against 792, three of which no test could have seen.

> 23a–23h must be complete, **and the daemon restarted at or after 23h's commit.** A daemon started before 23b keeps the old stage graph, so a gate driven against it measures the machinery this phase replaced. Confirm the restart before step 1, not after a confusing result.

#### Agent Validation Steps

```bash
npm run build
node dist/cli.js daemon --once
node dist/cli.js status
gh issue view <n> --repo fvermaut/scratch-app --comments
gh pr list --repo fvermaut/scratch-app --state all
git -C projects/scratch-app log --oneline origin/main -10
cat .timone/state.json
```

- [ ] Steps 1–7 each observed, with timestamps captured for the gate report
- [ ] Step 3 asserted on the spawn **not happening**, from the ledger and the cost, not from a log line
- [ ] Step 7's failure half performed, not just its success half — a merge that cannot fail has not been shown to fail safely
- [ ] `.timone/state.json` hand-edited **zero** times across the whole gate; if it is edited once, phase 22's 22b did not land and that is a finding about the earlier phase
- [ ] The gate report is written to `doc/plans/phases/reports/phase-23-live-gate.md` whatever the outcome, including the steps that could not be reached
- [ ] **Human gate:** fvermaut judges step 1 — whether being asked **once** for the shape and then judging pull requests **one at a time** is the rhythm he ruled for, with two real pull requests in front of him

## Dependency graph

```
23a → (none)          the breakdown artifact
23b → 23a             breakdown becomes a pipeline stage
23c → 23b             a chore is deliberately ungated
23d → 23b             chunk zero merges on approval
23e → 23b             a phase file gates nothing
23f → 23a, 23b, 23e   chunk succession
23g → 23a, 23f        what the ticket says between chunks
23h → 23a–23g         the register, the narrative, and status
23i → 23h             the live gate
```

**23c, 23d and 23e all depend only on 23b, and none of the three is parallel to another.** They share two files. `prompts.ts`: 23d narrows the delivery instruction, 23e rewrites the planning and execution ones, 23c does not touch it. `process.md`: **23c corrects stage 1's chore routing, 23e corrects stage 5's row, stage 5's Status-lifecycle paragraph and stage 6's entry gate** — different regions of one file, which is still one file. Per [process.md](../../../process.md) stage 6's "parallel only for slices sharing zero files", **run 23c, 23d and 23e sequentially.** 23c is genuinely parallel to 23d, if a parallel pair is wanted at all.

**Two dependencies are easy to get backwards and are stated so nobody has to re-derive them.** 23f depends on **23e**, not merely on 23b: a successor chunk entering `planning` while `planning` is still gated would park waiting for an approval the rhythm says nobody owes. And 23g depends on **23f**, because 23f is where `PollDeps` learns how to reach a project's checkout at all.

## Safe stopping point

**23a–23e form a coherent shippable increment, and if this phase has to be reduced mid-flight it reduces *there* rather than anywhere.**

After 23e: the breakdown exists as an artifact, `breakdown` is a stage with its own gate, a chore is ungated on purpose and both the process spec and the triage skill say so, chunk zero merges on approval so the default branch carries the specification, and a phase file gates nothing — with `timone-execute`, `timone-plan` and `process.md` all agreeing about that. **Nothing in 23a–23e depends on the poll loop**, so the daemon's cycle is untouched and a single-chunk initiative behaves end to end exactly as it does today, one gate earlier and one gate lighter.

**What stopping there costs, named:** R22's clauses 5 and 6 stay unbuilt — a merged chunk would still close its ticket, so a multi-chunk initiative is not yet possible; R5 and R10 keep their `verified` sign-off, because the retirement that lapses them is only half-built without the succession; and nothing is watched live. That is a smaller, honest increment, not a broken one.

**This section exists because it worked once already.** [Phase 22's own dependency section](phase-22.md#dependency-graph) said in advance that *"22a and 22b alone are worth landing even if the rest is amended"*, and when the phase was reduced on 2026-08-15 that sentence is what made the reduction a scope cut that kept its stamp rather than an improvisation. **A plan that has not said which prefix stands alone cannot be reduced safely**, because the decision then gets made by whoever is holding the least context.

## What this phase does not prove

> **✏ Refined 2026-08-15 — `timone status` still prints `idle` for a project between chunks.** Found by 23g and left standing deliberately. `describeProject` lists only running, parked and queued runs, so a project whose initiative is mid-flight but between two chunks appears idle. **This is not a disagreement of the kind [R21 clause 8](../../specs/prd/prd-02-inversion-of-control.criteria.md#r21--every-open-ticket-answers-for-itself) forbids** — both surfaces say nothing is needed from the human, and both derive that from `initiativeProgress` — but it is the one place [ADR-0028](../../adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md)'s D4, *"the thread says where the initiative stands"*, has no terminal counterpart. Fixing it is code in a slice that declares itself documentation-only, so it is **left for [23i](#23i--the-live-gate) to observe with a real initiative in front of it** and for fvermaut to judge there. If it reads badly at the gate it is a follow-up phase, not an amendment to this one.



- **That the rhythm is right at real size.** A two-chunk fixture is not a five-chunk milestone. Whether approving a shape once and then judging pull requests one at a time is enough oversight is a claim one initiative cannot make, and the honest answer arrives on `ivtrends`. [ADR-0030](../../adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md) says this is where that choice stops being cheap to reverse; this phase does not make it cheap again.
- **That a breakdown survives contact with a specification that changes.** 23f detects a re-proposal and refuses to close the ticket on one; **it does not re-open the gate**, and no step of 23i exercises a shape that turns out wrong halfway. What a human does with a re-proposal is undecided and is deliberately left so.
- **That derived doneness reads well over a long initiative.** The question of *whether* it is what fvermaut wants is settled: he ruled on **2026-08-15** that the list of pieces stays exactly as he approved it and progress is shown on the ticket ([ADR-0030](../../adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md) D4), against the alternative of a self-ticking file that would have Timone writing to a repo's default branch on its own. [R22 clause 5](../../specs/prd/prd-02-inversion-of-control.criteria.md#r22--a-ticket-hosts-a-sequence-of-chunks)'s literal *"marked done in the breakdown"* bends to that, and 23h records it. What a two-chunk fixture cannot show is whether *"piece 3 of 4 is next"* on a ticket is enough to follow an initiative that has been running for a fortnight.
- **Anything about parallel chunks.** One chunk at a time per project, unchanged, out of scope.
- **That the read cost of [ADR-0028](../../adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md) D1 is acceptable.** Reading a breakdown out of a checkout on every cycle, for every ticket with chunks, is a cost this phase introduces and does not measure.
- **That merging without a pull request is safe on a repository with branch protection.** `scratch-app` has none. A client repository that requires a pull request for its default branch would reject chunk zero's merge outright, and the failure would be discovered on the first real initiative rather than here.
- **Anything about a repository with other contributors.** Two solo repositories cannot show what one gate for a whole initiative looks like to somebody who did not approve it.
