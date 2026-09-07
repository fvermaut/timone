# Phase 35: A run in the build records what it bends and carries on

> **Status:** Complete — see [reports/phase-35-complete.md](reports/phase-35-complete.md).

> **Companion phases:** none — first phase built against [PRD-03](../../specs/prd/prd-03-a-run-ends-at-its-pull-request.md). Piece 2 of the same initiative (the pull request's own body, the screen-at-PR reversal, and the closed-without-merging remediation flow) is a separate phase, not yet written, per [ticket-103's breakdown](../breakdowns/ticket-103.md). Governing decision: [ADR-0052](../../adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md) — the whole of this phase's shape; it also records why [ADR-0033](../../adr/0033-a-stage-that-cannot-act-on-an-answer-escalates.md) is superseded for the stages this phase touches and stands for every other stage unchanged.

## Requirements

> **PRD:** [prd-03-a-run-ends-at-its-pull-request.md](../../specs/prd/prd-03-a-run-ends-at-its-pull-request.md) — criteria in [prd-03-a-run-ends-at-its-pull-request.criteria.md](../../specs/prd/prd-03-a-run-ends-at-its-pull-request.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-03.R1 | MUST | The build has one ending: a pull request — no parking, no questions, departures recorded and the run carries on |
| PRD-03.R3 | MUST | Mid-build amendments to the plan or the requirements register carry a dated marker naming the run |
| PRD-03.R5 | MUST | No stage may ask a question the machinery cannot act on the answer to |

This phase does not touch **R2** (the pull request body's own "opens on what was bent" section, first-thing) or **R4** (the screen shown at the pull request instead of before). Both are ticket-103's second breakdown piece — reading what a departure record and a pull request already carry after this phase, and composing the PR body around it. Building that here would be building ahead of a piece nobody has cut yet.

## Goal Description

Ticket #99 stopped fvermaut three times on a one-file bug fix, and none of the stops bought judgement — the record is [ADR-0052](../../adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md)'s own context. The ruling: from the last human agreement to the pull request, a run never parks, never asks, and never waits. When a step in the build hits something it cannot do as written, it writes down what happened, adapts, and keeps going. The pull request is still the only place judgement lands — this phase makes the run reach it; a later phase makes the pull request say what happened on the way.

**"The build" is `execution`, `verification` and `delivery`** — the three stages [ADR-0052](../../adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md)'s consequences name, and the three whose stops the codebase can actually attribute to a stage choosing to ask rather than to the machinery failing. `planning` is deliberately left out: `pipeline.ts` already marks it ungated (`✏ Ungated since ADR-0030 D1`, `src/daemon/pipeline.ts:361-364`), the ADR/anchoring gates a plan session can still hit are `timone-plan`'s own entry refusals — not build-time discoveries — and neither ADR-0052 nor its consequences list mentions the plan skill. `remediation` is also left out: its own stop (a rejected pull request bringing the work back as a fresh request) is exactly R2's territory, named on the breakdown's second piece, and redesigning it here would be building ahead of that piece. Leaving both out is a plan-level decision recorded here, not something the phase works around — a queued item for whichever ticket touches `planning` or `remediation` next.

**What does not clear the ADR bar.** [ADR-0052](../../adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md) already records the significant decision — that a run never stops in the build, that amendment authority moves to whichever stage needs it, and that a stray escalation is a fault rather than a wait. Everything below is that decision's mechanical consequence: which file records a departure, which function tells a build stage from any other, and what a build-stage session that escalates anyway should do instead of waiting. None of these is hard to reverse, none is surprising once ADR-0052 is read, and none is a trade-off between designs the ADR left open — they are the one shape it already describes.

**This phase owes a live gate before delivery.** [PRD-03.R1](../../specs/prd/prd-03-a-run-ends-at-its-pull-request.criteria.md), R3 and R5 are all `Verify-via: live`, and their declared dependencies (`src/daemon/`, `.claude/skills/timone-execute/`, `.claude/skills/timone-verify/`, `.claude/skills/timone-deliver/`) are exactly what this phase's diff touches. A verification pass here can check the daemon's own unit-level behaviour, but the criteria themselves stay `draft` until a live gate has driven a real run through a plan contradiction and through exhausted retries and watched both reach a pull request with no waiting state — that gate is stage 8's to schedule, not this phase's to run.

**One new artifact carries every departure.** A build-stage session that hits a wrong plan step, a contradicted requirement, a check it cannot run, or a workaround now writes one dated, run-named entry to `doc/plans/phases/reports/phase-NN-departures.md` — created on the first departure, appended thereafter, one entry per event, never rewritten — the same convention `phase-NN-handoffs.md` already uses. This is the file a later piece (R2) reads to compose the pull request's opening section; this phase only has to make sure nothing that happens gets lost before that piece can read it. Plan and requirements-register amendments keep their existing in-place `✏` marker at the point of change (stage 5's convention, already built) — this phase's addition is that the marker now also names the run that made it, and that `timone-execute` and `timone-verify` are the ones now authorised to write it directly, in place, rather than routing to `timone-plan` and stopping to wait for it.

**A stray escalation is a fault, not a wait — but only inside the build.** Every stage still has a real "I was given an answer I cannot act on" failure mode (`escalate()`, `src/daemon/session.ts:1022-1036`), and the daemon still needs it for `requirements`, `breakdown`, and the discovery stages, where a genuine unanswerable-question stop can still occur and [ADR-0031](../../adr/0031-a-handoff-is-a-wait-not-a-failure.md) still governs it. Per ADR-0052, a build-stage session that escalates anyway is not a legitimate wait to serve — the question itself is the defect. The daemon-mechanical detectors (a dead holder reclaimed twice, a spawn refused repeatedly, the same conversation re-asked after an answer was consumed) are a different thing entirely — the machinery genuinely stuck, not a stage choosing to ask — and [ADR-0052](../../adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md) explicitly keeps that machinery as a last-resort guard. Only the stage-declared path changes.

## Context & Prerequisites

- **[ADR-0052](../../adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md)** — the decision this whole phase implements. Read it before touching anything; it names which refusals move and which stand.
- **`src/daemon/pipeline.ts:66-79`** (`PIPELINE_STAGES`), **`:98`** (`WaitKind`), **`:100-132`** (`StageFacts`), **`:215-437`** (the `STAGES` table), **`:588-590`** (`waitFor`), **`:620-627`** (`ownsBranch`/`isBuilt`) — the accessor pattern a new `inBuild` predicate follows exactly.
- **`src/daemon/session.ts:1022-1036`** (`escalate`), **`:1792-1811`** (`afterStage`'s escalated-outcome check, "before every other ending, and for every stage") — the single dispatch point this phase gives a build-stage branch.
- **`src/daemon/runs.ts:1070`** (`fail(id, reason): Run`), **`:33-40`** (`RunStatus`), **`:110-121`** (`TRANSITIONS`) — no new status is added; a build-stage escalation becomes an ordinary `failed` run with a distinguishing reason string.
- **`src/daemon/cta.ts:294-319`** — the `failed`-run branch, already distinguishing a machine-caused stop (`technicalFault`) from a generic one; this phase adds a third wording for "a build stage asked when it should not have."
- **`.claude/skills/timone-execute/SKILL.md`** — "The three gates" (Gate 2, Gate 3), "The transition gate and escalation" (the two-attempt failure stop), the shell-slice look check's failure path, the completion report's "Deviations from the plan" section.
- **`.claude/skills/timone-verify/SKILL.md`** — Gate 3 (environment/BLOCKED), the fix-loop-exhaustion paragraph, the verification report's "Handed to the human" section.
- **`.claude/skills/timone-deliver/SKILL.md`** — Gate 3 (verification gate)'s failed/BLOCKED refusal clause. Gate 1, Gate 2, Gate 4 (the look gate) and Gate 5 (platform) are untouched by this phase — Gate 4 explicitly, since it is R4's own territory, and Gate 5 because there is no pull request to reach at all without a GitHub host, which is a different fact from a departure the run can work around.
- **`process.md`** stage 6, stage 7 and stage 8 notes, and the "Artifact conventions" list — written last, once the other four slices have settled the actual shape.

## Sub-phases

### Sub-phase 35a: The daemon can tell a build stage from any other, and a stray escalation from one is a failure, not a park

**[MODIFY]** `src/daemon/pipeline.ts` — add `inBuild: boolean` to `StageFacts` (`:100-132`), set `true` for `execution`, `verification`, `delivery` and `false` for every other stage in the `STAGES` table (`:215-437`), and add `export function inBuild(stage: PipelineStage): boolean` beside `ownsBranch`/`isBuilt` (`:620-627`), returning `STAGES[stage].inBuild`.

**[MODIFY]** `src/daemon/session.ts` — in `afterStage` (`:1792-1811`), branch the `outcome?.kind === "escalated"` check on `inBuild(stage)`: when true, call a new function (e.g. `failBuildEscalation(store, run.id, stage, outcome, log)`) that calls `store.fail(run.id, ...)` with a reason string carrying a distinguishing prefix (e.g. `"a build stage escalated: "` followed by the escalation comment's text) instead of calling `escalate`; when false, `escalate` runs exactly as it does today. Update the surrounding comment, which currently cites ADR-0033 alone, to note the ADR-0052 carve-out for build stages.

**[MODIFY]** `src/daemon/cta.ts` — in the `failed`-run branch (`:294-319`), before falling through to `technicalFault`, recognise the new reason prefix and word it as a defect the machine caused by asking when it should not have — no waiting-on-you framing, `command: timone retry ...`, matching the existing shape of the `technicalFault` branches immediately above it.

**Seams under test (TDD):** `inBuild(stage)` — a pure function over `PipelineStage` — and `afterStage`'s escalated-outcome dispatch, exercised the way the rest of `session.test.ts` already drives `afterStage` (fake store, fake ticketing). Red-green:

1. `inBuild("execution")`, `inBuild("verification")`, `inBuild("delivery")` are `true`; `inBuild("planning")`, `inBuild("requirements")`, `inBuild("breakdown")`, `inBuild("remediation")`, and every discovery/triage stage are `false`.
2. A session at `execution` (or `verification`, or `delivery`) whose outcome is `{kind:"escalated", comment}` leaves the run `failed`, with no `wait` object set, and `run.failure` containing the escalation comment's text.
3. A session at `requirements` (or `breakdown`) whose outcome is `{kind:"escalated", comment}` still leaves the run `parked` with `wait.kind === "escalation"`, unchanged from today — a regression guard on the branch this slice adds.
4. `RunStore.reclaim()`'s dead-holder path and `boundRefusal()`'s repeated-refusal path still park a **build-stage** run with `kind: "escalation"` exactly as before — this slice's branch touches only the outcome-driven check in `afterStage`, not the daemon-mechanical detectors, and a test here is the guard that it stays that way.
5. `cta.ts`'s CTA for a `failed` run whose reason carries the new prefix reads as a defect report, not a question, and carries no "answer me" wording.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
npm run build && echo "build exit: $?"
npx vitest run src/daemon/pipeline.test.ts src/daemon/session.test.ts src/daemon/cta.test.ts
```

- [ ] `inBuild` is exhaustive over `PIPELINE_STAGES` (compiler enforces it via `Record<PipelineStage, StageSpec>`; a stage missing the field fails the build, not a test)
- [ ] Both legs of case 2 and case 3 above pass, red before green
- [ ] Case 4 passes unmodified against the existing `reclaim`/`boundRefusal` tests, confirming no daemon-mechanical path changed
- [ ] Full daemon test suite still green: `npx vitest run src/daemon`

---

### Sub-phase 35b: Execution amends the plan and the register itself, records what it bent, and never stops for it

**[MODIFY]** `.claude/skills/timone-execute/SKILL.md`:

- **Gate 2** (undeclared seams) and **Gate 3** (reality contradicts the plan): replace "route to `timone-plan` for an in-place amendment, then re-enter" with direct authority — the execute session amends the phase file (or the criteria register, for a contradicted requirement) itself, in place, with a dated marker naming the run — `✏ <date> (build, timone#<ticket>): <what changed and why>` — appends one entry to the phase's departures record (defined below), and continues the slice against the amended text. The existing sentence "If the contradiction implies a significant technical decision, that is `timone-adr`'s, recorded at decision time — never inside the code" already does not stop the run; keep it as written.
- **"The transition gate and escalation"**: replace "after two failed attempts, execution stops... hand to the human" with: after two failed attempts, record a departure entry (both attempts, the gap, what was done instead — proceeding with the sub-phase's best-effort state and naming the validation left unmet, or applying and openly recording a workaround), and continue to the sub-phase's dependents rather than stopping the rest of the phase.
- **The shell slice's look check**: an unresolved difference after bounded retries now funnels into the same updated failure handling above — recorded, not escalated — while the comparison mechanism itself and its wiring into the completion report (which deliver's look gate still reads) are untouched.
- **Completion report template**: add a required line pointing at the phase's departures record — "`phase-NN-departures.md` — N entries" or "no departures — the phase executed as planned," matching the existing "Deviations from the plan" section's own "None" convention rather than duplicating its content.

**[NEW FILE convention, documented here and reused by 35c/35d]** `doc/plans/phases/reports/phase-NN-departures.md` — created on the phase's first departure, appended thereafter, one dated entry per departure:

```markdown
## <date> — <run/ticket>, <stage>

**Kind:** plan step | requirement | check not run | workaround
**Agreed:** <what the plan or requirement said>
**Did instead:** <what happened>
**Why:** <the reason, one or two sentences>
```

**No behaviour-carrying code in this sub-phase** — it is a skill-instruction and template change; validation is checklist-based.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
grep -n "hand to the human\|route to \`timone-plan\`.*re-enter" .claude/skills/timone-execute/SKILL.md; echo "exit: $?"
grep -n "phase-NN-departures.md" .claude/skills/timone-execute/SKILL.md; echo "exit: $?"
```

- [ ] First grep exits 1 (the old stop-and-route wording for Gate 2/Gate 3 and the two-attempt hand-off is gone)
- [ ] Second grep exits 0 (the departures-record convention is documented, with its template)
- [ ] The sentence keeping `timone-adr` authority for a genuine significant decision is still present, unchanged
- [ ] The completion report template's new departures line is present alongside the existing "Deviations from the plan" section, not replacing it

---

### Sub-phase 35c: Verification records what it could not check or could not fix, and hands the run to delivery anyway

> Sub-phase 35b must be complete before starting this sub-phase (shares and extends the departures-record convention and template it defines).

**[MODIFY]** `.claude/skills/timone-verify/SKILL.md`:

- **Gate 3** (environment): replace "every in-scope criterion is BLOCKED... route to the human" with: record a departure (what could not be checked, and why), mark those criteria BLOCKED in the report exactly as today, and let the pass continue for whatever else can run — the stage still posts its ordinary completion, so the run proceeds rather than stopping.
- **The fix loop's exhaustion paragraph**: replace "the work goes to the human as a new ticket... stage 1 classifies" with: record a departure (the remaining failures, with evidence), keep the existing register-flip-to-`failed` behaviour — that is still true evidence — and post the ordinary completion so the run proceeds to delivery instead of filing anything new.
- **Report template**: the "Handed to the human" section is renamed to something naming what it now is — content that is carried forward rather than handed anywhere — and points at the phase's departures record for anything BLOCKED or failed, rather than describing a stop that no longer happens.
- Gate 1 (completion) and Gate 2 (register) are untouched: both fire before any checking starts, on a precondition missing entirely, not on something the build discovers mid-pass.

**No behaviour-carrying code in this sub-phase** — validation is checklist-based.

#### Agent Validation Steps

```bash
grep -n "route to the human\|goes to the human as a new ticket\|stage 1 classifies" .claude/skills/timone-verify/SKILL.md; echo "exit: $?"
grep -n "phase-NN-departures.md\|Handed to the human" .claude/skills/timone-verify/SKILL.md; echo "exit: $?"
```

- [ ] First grep exits 1 for the fix-loop-exhaustion and Gate 3 wording specifically (a human-facing routing phrase used elsewhere, e.g. for a genuinely-missing artifact at Gate 1/2, is not what this checks — read the match lines, don't just count them)
- [ ] Second grep shows the departures record referenced and the old "Handed to the human" heading replaced
- [ ] Gate 1 and Gate 2's wording is unchanged from before this sub-phase (diff review, not a probe — both are short, named sections)

---

### Sub-phase 35d: Delivery opens the pull request on a failed or blocked phase instead of refusing it

> Sub-phases 35b and 35c must be complete before starting this sub-phase (needs verification to actually finish and hand off rather than stop, and shares the departures-record convention).

**[MODIFY]** `.claude/skills/timone-deliver/SKILL.md` — **Gate 3** (verification gate): remove the clause refusing on "any MUST criterion neither PASS, HUMAN-CHECK nor LIVE-GATE, any unresolved regression, any register line reading `failed`, any BLOCKED verdict" — delivery now proceeds regardless, drawing the verification outcome table and the outstanding-items list from the verification report exactly as the existing "Verification outcome" / "Outstanding for the human" sections already do. Keep the two clauses that still refuse: no verification report at all (routes to `timone-verify` — a missing artifact, not a departure), and a live gate the phase owes and has not run (per [ADR-0052](../../adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md)'s consequences, only the failed-verification and unviewed-screen refusals are named as lost; the live-gate refusal is not one of them). Gate 4 (the look gate) and Gate 5 (platform) are untouched.

**[MODIFY]** the delivery report template — add a short "Departures" line pointing at the phase's departures record (count, or "none"), alongside the existing verification-outcome and standards/spec sections — a pointer only; the pull request body's own opening section reading from it is R2's job on the next piece.

**No behaviour-carrying code in this sub-phase** — validation is checklist-based.

#### Agent Validation Steps

```bash
grep -n "file it as a ticket for \*\*stage 1\*\*\|A failed pass has already spent its fix loops" .claude/skills/timone-deliver/SKILL.md; echo "exit: $?"
grep -n "phase-NN-departures.md" .claude/skills/timone-deliver/SKILL.md; echo "exit: $?"
```

- [ ] First grep exits 1 (the failed/BLOCKED refusal clause is gone)
- [ ] Second grep exits 0 (the departures pointer is documented in the delivery report template)
- [ ] Gate 4 and Gate 5's text is byte-identical to before this sub-phase (diff review)

---

### Sub-phase 35e: `process.md` describes the build that no longer stops

> Sub-phases 35a, 35b, 35c and 35d must be complete before starting this sub-phase — it documents the shape they built, not a shape being designed here.

**[MODIFY]** `process.md`:

- Stage 6 note: remove "after two failed attempts, execution stops... hand to the human"; describe the departure record and the run-carries-on behaviour, citing [ADR-0052](../../adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md).
- Stage 7 note: remove the fix-loop-exhaustion routing to a new ticket and the environment gate's human routing; describe the same record-and-continue shape.
- Stage 8 note: narrow the entry-gate description to match Gate 3's new scope (no report at all, or an owed live gate not run — still refuse; a failed or BLOCKED register — no longer refuses).
- "Gates, conversations and the human" section: add one short paragraph noting the build-phase carve-out — inside `execution`, `verification` and `delivery`, an escalation is a failure to retry, not a wait; [ADR-0031](../../adr/0031-a-handoff-is-a-wait-not-a-failure.md) and [ADR-0033](../../adr/0033-a-stage-that-cannot-act-on-an-answer-escalates.md)'s mechanical floor still govern every other stage exactly as before.
- "Artifact conventions" list: add `plans/phases/reports/phase-NN-departures.md` alongside `phase-NN-handoffs.md`, one line describing it the same way.

**No behaviour-carrying code in this sub-phase** — validation is checklist-based.

#### Agent Validation Steps

```bash
grep -n "goes to the human via stage 1\|hand to the human" process.md; echo "exit: $?"
grep -n "phase-NN-departures.md" process.md; echo "exit: $?"
```

- [ ] First grep's remaining matches (if any) are outside stage 6/7/8's notes — read the match lines; a hit elsewhere in the file (e.g. stage 9's retired note) is not this sub-phase's concern
- [ ] Second grep exits 0
- [ ] The new "Gates, conversations and the human" paragraph names ADR-0031 and ADR-0033 and states which stages each still governs

---

## Dependency graph

```
35a → (none)              daemon: inBuild predicate, escalation-to-failure branch, CTA wording
35b → (none)              execute: amendment authority, two-attempt continue, departures record + template
35c → 35b                 verify: BLOCKED and fix-loop exhaustion record and continue, same departures record
35d → 35b, 35c             deliver: Gate 3 stops refusing failed/BLOCKED, departures pointer in the report
35e → 35a, 35b, 35c, 35d   process.md describes the finished shape
```

35a and 35b share zero files and may run in parallel.
