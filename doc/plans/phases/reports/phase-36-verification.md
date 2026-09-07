# Phase 36 — Verification Report

- **Date:** 2026-09-07
- **Phase:** [phase-36.md](../phase-36.md) — stamped `Complete`, completion report [phase-36-complete.md](phase-36-complete.md)
- **Scope:** PRD-03.R2, PRD-03.R4 (both MUST, both `Verify-via: live`)
- **Live gate owed:** **yes** — both PRD-03.R2 and PRD-03.R4 declare `Depends-on: src/daemon/, .claude/skills/timone-deliver/`, and this phase's diff changes `.claude/skills/timone-deliver/SKILL.md`. A dependency list is read as OR across its comma-separated paths ([ADR-0051](../../../adr/0051-timone-verifies-itself-by-live-gate-and-a-regression-set-is-narrowed-by-what-it-depends-on.md) D4), so `src/daemon/` being untouched does not remove the obligation.
- **Regression set (derived):** empty after narrowing. See [Regression](#regression) for the derivation and the removals.
- **Branch:** `timone/106-2-the-pull-request-carries-the-judgement` @ `ec42d6baa4e2c6d9f6a78ebe0815915cf6c7a328` — working tree clean at pass start. No parent branch needed merging in: phase 35's verification commits are already in this branch's ancestry (`a030f69`, the merge of pull request #114), and the register read at this HEAD already carries phase 35's flips (PRD-03.R1, R3, R5 = `verified`).

## Environment

This phase carries no application code. Its diff is five files: `.claude/skills/timone-deliver/SKILL.md`, `process.md`, and three documents under `doc/plans/phases/`. There is no server to stand up and no page to load, so no production build and no runtime environment were required, and the environment gate did not fire.

Build-health smoke, run once and reported as exactly that — not criterion evidence:

```
npm run type-check   → tsc --noEmit, no output, exit 0
npm test             → vitest run --passWithNoTests
                       Test Files  40 passed (40)
                       Tests  1624 passed (1624)
```

The smoke is green. It contradicts none of this pass's outcomes, because this pass ran no probes for it to contradict.

## Independence declaration

Read, by path:

- `doc/specs/prd/prd-03-a-run-ends-at-its-pull-request.criteria.md` (whole), and the metadata lines only of `doc/specs/prd/prd-01-process-layer.criteria.md` and `doc/specs/prd/prd-02-inversion-of-control.criteria.md` — priority, status, verify-via and depends-on, for the regression derivation.
- `doc/plans/phases/phase-36.md` — lines 1 to 60.
- `doc/plans/phases/reports/phase-36-complete.md` (whole).
- `CONTEXT.md`, `STATUS.md`, `package.json`, and the committed file list of the verifier's own probe directory.

Not read: `phase-36-handoffs.md`, any diff or `git show` of content, any file under `src/`, the committed test suite, any ADR, and any prior verification report's body. No prior verification report's HUMAN-CHECK scripts section was opened, because the completion report states plainly that no HUMAN-CHECK items are carried forward from this phase.

**One declared contamination.** The read of `phase-36.md` was aimed at the `Status` line and the requirements header, and it overran into the opening bullets of sub-phase 36a, which describe intended edits to the delivery skill file. That is build detail this stage should not hold. It changed nothing here: this pass authored no probe, wrote no manual script, and rested no verdict on anything read from that file beyond the stamp and the claimed requirement IDs. It is recorded rather than hidden so a reader can weigh it.

No implementation source was read. There is no criterion evidence below drawn from anything other than the register's own `Last live gate:` fields, because every criterion in scope is on the `live` channel.

## Verdict summary

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-03.R2 | MUST | live | LIVE-GATE | 0 |
| PRD-03.R4 | MUST | live | LIVE-GATE | 0 |

**The gate does not pass.** Every MUST criterion in scope is LIVE-GATE and there are zero regressions, but both criteria owe a fresh live gate and no such gate has run. A phase that owes a fresh live gate does not pass until the gate has run and its report is committed — that is the one way a LIVE-GATE line stops a phase, and it is what stops this one.

## Evidence

### PRD-03.R2 — LIVE-GATE

`Verify-via: live`. This stage never performs a live gate, never authors a probe for one, never writes a manual script for one, and never flips its status. The deliverable is the record of what last observed it and whether a fresh observation is owed.

- **Last live gate, per the criterion's own field:** `never`. No run has ever watched this behaviour.
- **Fresh gate owed:** yes. Declared dependencies are `src/daemon/` and `.claude/skills/timone-deliver/`; this phase's diff touches `.claude/skills/timone-deliver/SKILL.md`.
- **Both clauses are unobserved.** The criterion asks that a pull request opening from a run with departures lists every one of them first, each naming what was agreed, what was done instead and why; and that a run with no departures says so explicitly rather than leaving the section out. Neither can be seen from a terminal — both need a real delivery to open a real pull request, and the body read as it lands.

### PRD-03.R4 — LIVE-GATE

Same channel, same treatment.

- **Last live gate, per the criterion's own field:** `never`.
- **Fresh gate owed:** yes. Same declared dependencies, same diff overlap.
- **The clause is unobserved.** It asks that a completed run which built or substantially changed a user-facing screen opens its pull request with no prior human viewing, and that the body carries the preview address and the built-versus-reference comparison first-thing, alongside the departures. Observing it needs a driven run that actually carries a screen.

The phase file and the completion report agree on what the gate must exercise: one real delivery, carrying a screen and at least one departure, so both sections are produced at once, and the body watched to confirm they precede `## Scope`.

## HUMAN-CHECK scripts

None. No criterion in scope is on the `human` channel, and the completion report carries no HUMAN-CHECK item forward from earlier phases.

A live gate is deliberately not written up here as a manual script. The two are different things: a `human` check is a person following steps, while a live gate is a machine run against real infrastructure with a person watching it. Writing a script for a live criterion would name the wrong performer.

## Live gates

| ID | Last live gate | Fresh gate owed by this phase |
| --- | --- | --- |
| PRD-03.R2 | never | yes — diff touches `.claude/skills/timone-deliver/` |
| PRD-03.R4 | never | yes — diff touches `.claude/skills/timone-deliver/` |

**One observation outside this pass's scope, offered so the gate can be planned once rather than twice.** Four other criteria name `.claude/skills/timone-deliver/` among their dependencies and are on the `live` channel: PRD-03.R1 (`verified`, last gated 2026-09-07), PRD-01.R13 (`revised`, never gated), PRD-01.R17 (`verified`, never gated) and PRD-02.R7 (`revised`, never gated). None of them enters this pass's scope — the standing regression set is `api` criteria by definition, and this phase claims neither — so nothing here asserts anything about them. They are named only because a single driven delivery would put all of them in front of a watcher at the same time.

## Regression

**The derived regression set is empty; nothing to re-run.**

Derivation, at this branch's HEAD, across all three registers: every criterion with priority MUST, `Verify-via: api`, and status `verified`. That is two criteria, both in PRD-01:

- PRD-01.R2 — Project manifest.
- PRD-01.R3 — Workspace sync.

No criterion in PRD-02 qualifies: every MUST criterion there on the `api` channel currently stands at `revised`, `draft` or `failed`, and every `verified` MUST criterion is on the `live` channel. No criterion in PRD-03 qualifies: all five are `live`.

**What the narrowing removed** — this phase's diff is `.claude/skills/timone-deliver/SKILL.md`, `process.md`, `doc/plans/phases/phase-36.md`, `doc/plans/phases/reports/phase-36-complete.md`, `doc/plans/phases/reports/phase-36-handoffs.md`. Nothing under `src/`.

| Dropped | `Depends-on` that dropped it | Touched by this diff? |
| --- | --- | --- |
| PRD-01.R2 | `src/manifest.ts, src/commands/projects.ts` | no |
| PRD-01.R3 | `src/commands/workspace.ts, src/git.ts` | no |

Both removals rest on the same fact: this phase changed no source file, so no declared dependency of either criterion can have moved. Their committed probes were therefore not run this pass.

## Probes

**0 probes run this pass; 0 authored; 0 proven able to fail, 0 not.**

No probe was run or written, and that is the correct outcome rather than a gap:

- Both criteria in the claimed set are on the `live` channel, where this stage is forbidden to author a probe.
- The derived regression set is empty, so none of the three probes committed by earlier passes was in scope.

Clause coverage: not applicable — no probe printed labels this pass, and no criterion in scope has a probe whose labels could be compared against a clause list.

## Fix-loop accounting

0 of 2 — the initial pass was clean. No FAIL and no REGRESSION was observed, so no defect brief was issued and no fix context was spawned. Both loops remain available to whatever pass follows the live gate.

## Register changes

**None.** Both criteria in scope are on the `live` channel, whose status this stage never flips, and the derived regression set is empty. PRD-03.R2 and PRD-03.R4 stay `draft`, and their `Last live gate:` fields stay `never` — only the gate that actually observes them may change either.

## Carried forward

Nothing is BLOCKED and nothing is `failed`, so nothing goes to a departures record and none exists for this phase.

What remains owed is the live gate itself: one supervised delivery, against real infrastructure, carrying a user-facing screen and at least one recorded departure, watched to confirm that the pull request body opens on `## Departures` and `## The screen` before `## Scope`, that every departure names what was agreed, what was done instead and why, that a run with nothing bent still gets an explicit statement rather than a missing section, and that no request to view the screen appears anywhere on the ticket before the pull request exists. Until that gate has run and its report is committed as `phase-36-live-gate.md`, PRD-03.R2 and PRD-03.R4 stay `draft` and this phase has not passed.
