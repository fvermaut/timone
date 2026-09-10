# Phase 38: The build never parks, a takeover never reopens a park that shouldn't exist, and a stuck takeover stops offering itself

> **Status:** Planned.

> **Companion phases:** First phase to touch this exact fault; no prior phase built the code this one corrects. Governing decisions: [ADR-0052](../../adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md) — the rule this phase closes the last gap in: from the approved list of pieces to the pull request, a run never parks on a person, and an escalation inside the build is a fault to file, not a wait to serve. [ADR-0033](../../adr/0033-a-stage-that-cannot-act-on-an-answer-escalates.md) — the re-ask floor this phase extends to the takeover path, unchanged in substance.

## Requirements

> **PRD:** [prd-03-a-run-ends-at-its-pull-request.md](../../specs/prd/prd-03-a-run-ends-at-its-pull-request.md) — criteria in [prd-03-a-run-ends-at-its-pull-request.criteria.md](../../specs/prd/prd-03-a-run-ends-at-its-pull-request.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-03.R1 | MUST | From the last human agreement to the pull request, a run never parks and never posts a question — it adapts and carries on, or it fails as a fault to retry. |
| PRD-03.R5 | MUST | A question the process still asks must be one a typed reply — or, on the takeover path, a live conversation — can actually resolve; an answer or an engagement that cannot move the work must never be offered again without limit. |

This is a bug: [timone#122](https://github.com/fvermaut/timone/issues/122), filed after `ivtrends` #88 showed both requirements broken by the same experience. Fixing it also closes [#117](https://github.com/fvermaut/timone/issues/117), [#108](https://github.com/fvermaut/timone/issues/108) and [#120](https://github.com/fvermaut/timone/issues/120) — three sightings of the same two gaps, not three separate defects.

## Goal Description

`ivtrends` #88's checking step stopped mid-build to ask whether to build piece 2 first or re-cut two requirements. Under ADR-0052 that should be impossible — nothing between the approved list of pieces and the pull request may park on a person — and the machinery already half-enforces it: when a build-stage session posts an *escalation* (`STAGE_ESCALATED_MARKER`), `afterStage` in `src/daemon/session.ts` already files it as a failure via `failBuildEscalation`, never a park. What it does not catch is the sibling marker, `STAGE_HANDED_MARKER` — a plain hand-back. `afterWorkStage` (used by `execution` and `verification`) and `afterDelivery` (used by `delivery`) both route a hand-back straight to `handBack`, which parks the run on a conversation wait regardless of which stage sent it. Three of the pipeline's own existing tests currently assert this as correct behaviour — they were written before ADR-0052 and never updated. This is fault one, filed as #117.

Because the run ends up genuinely parked on a conversation at a build stage, the second gap follows from the first: `resolveTakeover` in `src/commands/takeover.ts` reads `run.wait.kind` and, on `conversation`, opens whatever stage the wait names — `execution`, `verification` and `delivery` are all in `PROMPTED_STAGES`, so it opens them like any other conversation. Fixing the first gap stops this specific park from ever being created again, which is most of what #108 asks for. What it does not do is stop `resolveTakeover` from reopening one if it somehow exists anyway — a ledger written by an older build, a future regression in a different stage. `resolveTakeover` has no opinion today on whether the stage it is about to open a conversation for is one the build rules forbid parking at all, and it should.

The third gap is independent of the other two and survives them both: nothing on the takeover path ever sets `Run.consumedAnswerAt`, so `applyPark`'s existing re-ask floor — the mechanism that already stops the *daemon's* own resumption path from asking the same question forever — never sees a takeover coming. `endTakeover` reads what a takeover's session recorded and, on anything other than `advanced`, calls `releaseClaim`, which reparks the run on exactly the wait it had, cursor and all, via `waitOf(run)`. `waitOf` never carries a `consumedAnswerAt`, so the run goes back into `applyPark` looking exactly as it did before the human spent a live conversation on it — nothing distinguishes "never asked" from "asked and answered, live, and still stuck". A second takeover of the same stuck ticket does the same thing at the same cost, without limit, which is the second half of what #88 actually showed. This is fault three, filed as #120.

The fix mirrors a pattern the daemon's own resumption path already uses (`poll.ts`, around the `resolution.consumed` repark before `deps.spawner.spawn`): mark `consumedAnswerAt` on the run before the conversation session starts, so that when the session ends without advancing and the run reparks on the same stage with the same wait kind, `isReAskAfterAnswer` recognises it exactly as it would a written reply that changed nothing. Two consecutive stuck takeovers at the same stage then convert the wait to `kind: "escalation"` by the existing `RE_ASK_LIMIT` machinery — no new counting logic, just feeding the takeover path into the one that already exists. `resolveTakeover` already treats an `escalation` wait differently from a `conversation` one (`kind: "escalation"`, opened via `escalate()` rather than `converse()`), so this alone is what gives a second stuck takeover "a different way out", exactly as the ticket asks for — no new user-facing text is required for that part.

No undocumented significant decision is implied by any of this: all three fixes wire existing, already-decided machinery (`failBuildEscalation`, `inBuild`, `applyPark`'s re-ask floor) to two call sites and one dispatch branch each that were never wired to it. Nothing here chooses new behaviour; it closes gaps in behaviour ADR-0052 and ADR-0033 already specify.

## Context & Prerequisites

- **`src/daemon/session.ts`** — `afterWorkStage` (execution, verification), `afterDelivery` (delivery), `failBuildEscalation`, `handBack`, `inBuild` (imported from `pipeline.ts`), `waitOf`. The `escalated`-outcome branch in `afterStage` (around the top of that method) already does, for `STAGE_ESCALATED_MARKER`, exactly what this phase's first slice does for `STAGE_HANDED_MARKER` — read it as the reference shape.
- **`src/daemon/pipeline.ts`** — `inBuild(stage)`, already returns `true` for `execution`, `verification`, `delivery` and `false` for everything else including `remediation`. Nothing here changes.
- **`src/daemon/faults.ts`** — `BUILD_ESCALATION_PREFIX`, `isBuildEscalation`. `ctaFor` (`src/daemon/cta.ts`, around line 303) already renders a build-escalation failure as "I asked a question inside the build that I had no business asking, so I stopped" with a `timone retry` command — this wording already fits a hand-back as well as an escalation, so `cta.ts` needs no change.
- **`src/commands/takeover.ts`** — `resolveTakeover`, `claimForTakeover`, `endTakeover`, `releaseClaim`, `converse`. `PROMPTED_STAGES` (from `prompts.ts`) currently includes all three build stages; that list is not being narrowed — a build stage is still a stage a session can be *told about* by `escalate()`'s unbound prompt, it is only `converse()`'s ordinary conversation-open that must never reach one again.
- **`src/daemon/runs.ts`** — `RunStore.repark`, `applyPark`, `isReAskAfterAnswer`, `Run.consumedAnswerAt`, `Run.reAsksAfterAnswer`, `RE_ASK_LIMIT` (currently `2`). `repark` throws unless `run.status === "parked"` — it must be called before `store.claim(...)` transitions the run to `active`, exactly as `poll.ts` already orders its own repark-then-spawn.
- **`src/daemon/poll.ts`** — the `claim-takeover` request handler (around line 931–952) claims a run on the daemon's behalf when a takeover is asking a busy daemon to hand one over; it calls `resolveTakeover` and then `store.claim(...)` exactly like `claimForTakeover`'s own direct-lock branch, and needs the same repark-before-claim addition, not a separate mechanism.
- **Known now-stale fixtures** — `src/daemon/session.test.ts` has three tests (`the execution stage` describe block, `the verification stage` describe block, `the delivery stage` describe block) that currently assert a hand-back at a build stage parks the run — this is the bug being fixed, encoded as a passing test. `src/commands/takeover.test.ts`'s `handedBackAtExecution` fixture (in the `"a takeover that finishes the step it took over"` describe block) parks a run at `execution` on a conversation wait to test `endTakeover`'s generic restore/finish/moved-under-it behaviour — once the first two slices land, that state can never occur for a build stage, so the fixture must move to a stage the build rules do not touch (`requirements` fits the shape and is already `PROMPTED_STAGES`) without weakening what it actually tests.

## Sub-phases

### Sub-phase 38a: A build stage that hands back is a fault to file, not a wait to serve

**[MODIFY]** `src/daemon/session.ts` — `afterWorkStage`'s `outcome?.kind === "handed-to-human"` branch, and `afterDelivery`'s identical branch: when `inBuild(stage)`, call `failBuildEscalation(store, run.id, stage, outcome, this.log.bind(this))` instead of `handBack(...)`; when not, keep calling `handBack(...)` exactly as today. `failBuildEscalation` already exists and is already used for the `escalated` outcome inside `afterStage`'s top-level branch — this slice is wiring the second marker into the same, already-built sink, not writing new failure machinery.

**[MODIFY]** `src/daemon/session.test.ts` — rewrite the three tests that currently assert a build-stage hand-back parks the run, so they assert it fails instead:
- `describe("the execution stage")`, `it("waits, rather than failing, when the session handed the work to a person", ...)` — rename to reflect the new behaviour (e.g. "fails the run rather than parking it, when the session hands the work to a person") and assert `run?.status === "failed"`, `run?.failure` starting with the build-escalation prefix and containing the session's own words, `run?.wait` undefined, and that nothing new is posted (`comments` still length 1 — the session's own comment is the whole report). Use the adjacent `it("fails the run rather than parking it, when it cannot use the answer it was given", ...)` in the verification block as the shape to match.
- `describe("the verification stage")`, `it("stops without advancing when the gate did not pass", ...)` — same rewrite; this is the exact scenario `ivtrends` #88 hit (`STAGE_HANDED_MARKER`, "Two criteria still fail after both loops").
- `describe("the delivery stage")`, `it("stops quietly when the session handed the delivery to a person", ...)` — same rewrite.

**Seams under test (TDD):** `AgentSessionSpawner.spawn`, driven through the existing `checkingRuntime` / `buildingRuntime` / `deliveringRuntime` fixtures already in this file — the same seam the three tests being rewritten already use. Red-green:
1. Red: run the three rewritten assertions against the unmodified code — they fail (status is `parked`, not `failed`).
2. Green: after the `afterWorkStage`/`afterDelivery` change, all three pass.
3. Green (regression): the existing `it("stops quietly when the planning session handed the work to a person", ...)` test (planning is not `inBuild`) and the `remediation` describe block's hand-back test continue to pass unchanged — a non-build stage's hand-back still parks.
4. Green (regression): the existing `escalated`-outcome tests for execution/verification/delivery (already asserting `failed` with the build-escalation prefix) continue to pass unchanged.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/session.test.ts; echo "exit: $?"
npm run build; echo "exit: $?"
```

- [ ] The three rewritten tests pass, asserting `status === "failed"`, a build-escalation-prefixed `failure`, no `wait`, and exactly one comment.
- [ ] The planning and remediation hand-back tests, and the existing escalated-outcome build-stage tests, still pass unchanged.
- [ ] `npm run build` exits 0 (typechecks).
- [ ] Handoff records the red→green evidence: the three tests' failing output against the unmodified branch, then passing after the fix.

---

### Sub-phase 38b: A takeover never reopens a conversation at a stage the build forbids one at

**[MODIFY]** `src/commands/takeover.ts` — `resolveTakeover`: immediately before the final `return { kind: "converse", run, stage: run.stage };` (the `run.wait?.kind === "conversation"` branch), add a check: when `inBuild(run.stage)` is true, return `{ kind: "nothing-to-do", message: ... }` instead — plain words, naming the ticket, saying this state should never exist inside the build and that running the command again will not change that (mirroring the register-if-you-see-this tone of `cannotConverse`, not inviting a repeat). Import `inBuild` from `../daemon/pipeline.js`.

**[MODIFY]** `src/commands/takeover.test.ts` — two changes:
- Add a new test in the `describe("resolveTakeover")` block: a run parked with `kind: "conversation"` at `stage: "execution"` (or `"verification"`/`"delivery"`) resolves to `nothing-to-do`, not `converse` — construct the fixture the same way `parkedOnConversation` does, but at a build stage instead of `clarification`.
- `handedBackAtExecution` (in `describe("a takeover that finishes the step it took over")`) parks a run at `execution` to test `endTakeover`'s generic finish/restore/moved-under-it behaviour. After this slice (and 38a), that exact state can no longer arise for a build stage, and `resolveTakeover` now refuses it before `endTakeover` is ever reached — so its four callers would stop exercising what they are meant to test. Rename it (e.g. `handedBackAtRequirements`) and change `stage: "execution"` to `stage: "requirements"` throughout; leave every assertion in the four tests that use it unchanged — they test the restore mechanism itself, which does not care which stage it is restoring.

**Seams under test (TDD):** `resolveTakeover`, directly — the same seam its existing seven tests already use. Red-green:
1. Red: the new build-stage test fails against unmodified code (`resolveTakeover` returns `converse`, not `nothing-to-do`).
2. Green: after the `inBuild` guard, it passes.
3. Green (regression): the existing `it("resolves a ticket waiting on a conversation to that stage", ...)` test (a non-build stage) still returns `converse`.
4. Green (regression): the four `endTakeover` tests using the renamed fixture still pass at `requirements`, proving the rename did not change what they assert.

> Sub-phase 38a must be complete before starting this sub-phase (its Goal Description explains why the state this slice guards against, and the fixture rename it requires, only make sense once 38a has shipped — without it, `handedBackAtExecution` still describes a state the running code can genuinely reach).

#### Agent Validation Steps

```bash
npx vitest run src/commands/takeover.test.ts; echo "exit: $?"
npm run build; echo "exit: $?"
```

- [ ] The new build-stage `resolveTakeover` test passes, returning `nothing-to-do` with a message naming the ticket and not inviting a repeat of the command.
- [ ] The existing non-build-stage `resolveTakeover` conversation test is unchanged and still passes.
- [ ] The four renamed-fixture `endTakeover` tests still pass, at `requirements` instead of `execution`, with every existing assertion intact.
- [ ] `npm run build` exits 0.
- [ ] Handoff records the red→green evidence for the new test.

---

### Sub-phase 38c: A takeover that ends up stuck twice at the same stage stops offering itself as the way out

**[MODIFY]** `src/commands/takeover.ts` — mark the run's `consumedAnswerAt` before a genuine conversation claim starts, so a takeover that ends without advancing feeds `applyPark`'s existing re-ask floor exactly as a written ticket reply already does. Concretely: in `claimForTakeover`'s direct-lock-acquired branch, for the `resolution.kind === "converse"` case only (not `"escalation"`) — immediately before `store.claim(resolution.run.id, hold)` — call `store.repark(resolution.run.id, { ...waitOf(resolution.run), consumedAnswerAt: resolution.run.wait?.opened ?? resolution.run.updatedAt })`. `repark` requires `status === "parked"`, which the run still is at that point (the claim has not happened yet) — this must stay ordered before the claim, not after, or `repark` throws.

**[MODIFY]** `src/daemon/poll.ts` — the `claim-takeover` request handler (around line 931–952): the same repark-before-claim, for `resolution.kind === "converse"` only, immediately before `store.claim(resolution.run.id, body.holder)`. This is the daemon-mediated claim path a takeover falls back to when a live daemon holds the ledger lock; it must mark the same way the direct-lock path does; a fix in only one of the two paths leaves the other silently un-fixed.

**Seams under test (TDD):** `runTakeover` end to end (direct-lock path, via `takeover.test.ts`'s existing `ledger()`/`trackerSaying()` fixtures) and `applyRequest`'s `claim-takeover` case end to end (via `poll.test.ts`'s existing `claim-takeover` fixture around line 5842). Red-green:
1. Red: drive one run through two consecutive takeovers at the same conversation-waiting stage, neither of which the session advances (each ends with `STAGE_HANDED_MARKER` or `STAGE_ESCALATED_MARKER`, same as before) — against unmodified code, the run is still parked on `kind: "conversation"` after the second takeover, offering the same command a third time.
2. Green: after the fix, the same two-takeover sequence leaves the run parked with `wait.kind === "escalation"` (the existing `RE_ASK_LIMIT` conversion) rather than `conversation` — a third `resolveTakeover` call now returns `{ kind: "escalation", ... }`, which opens `escalate()`, not `converse()`.
3. Green: a single takeover whose session *does* advance (`STAGE_DONE_MARKER`) is unaffected — `run.consumedAnswerAt` ends up cleared exactly as it does today (via `endTakeover`'s `CARRY_ON_WAIT` park, which — like `releaseClaim` — parks through `waitOf`-shaped options carrying no `consumedAnswerAt`), and `reAsksAfterAnswer` stays at its prior value; the existing `it("stops the run asking, once the session has recorded a finished step", ...)` test passes unchanged.
4. Green: the `poll.test.ts` `claim-takeover` test, extended or a sibling added, shows the same repark happens on that path before the claim.

> Sub-phase 38b must be complete before starting this sub-phase — it touches `claimForTakeover` in the same file 38b just modified (the `inBuild` guard sits earlier in the same function's call chain, in `resolveTakeover`), and this slice's fixtures assume that guard already exists so that every conversation claim reaching this new code is one the build rules already allow.

#### Agent Validation Steps

```bash
npx vitest run src/commands/takeover.test.ts src/daemon/poll.test.ts; echo "exit: $?"
npm run build; echo "exit: $?"
npx vitest run; echo "exit: $?"
```

- [ ] Two consecutive stuck takeovers at the same stage convert the wait to `kind: "escalation"`, verified by driving `runTakeover` twice against the same store and reading `store.get(...)` after each.
- [ ] A third `resolveTakeover` call against that same run returns `{ kind: "escalation" }`.
- [ ] A single advancing takeover is unaffected — existing "stops the run asking" test passes unchanged.
- [ ] The `claim-takeover` poll path exhibits the same marking, verified in `poll.test.ts`.
- [ ] `npm run build` exits 0.
- [ ] The full suite (`npx vitest run`) passes, not just the two touched files — this phase reaches into shared re-ask machinery (`applyPark`) that other stages' tests also exercise.
- [ ] Handoff records the red→green evidence for the two-takeover escalation scenario.

---

## Dependency graph

```
38a → (none)        the build never parks on a hand-back, closing #117
38b → 38a            a takeover never reopens the park 38a just made impossible, closing #108
38c → 38b            a takeover stuck twice offers a different way out, closing #120
```
