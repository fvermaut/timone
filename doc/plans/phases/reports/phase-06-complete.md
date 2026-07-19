# Phase 06 — Completion Report

- **Date:** 2026-07-19
- **Plan:** [phase-06.md](../phase-06.md) — breakdown approved by fvermaut before execution
- **Requirements:** PRD-01.R10 (MUST) — `verified`

## Summary

Stage 5 now has a skill. `timone-plan` (190 lines) reads a project's specs, ADRs, triage records, glossary, standards and prior phases; fires two gates in a defined order; cuts the work into thin vertical slices with declared seams; seeks approval **before** writing; then commits the phase file. Two `process.md` amendments landed first, since the spec is normative and the skill restates it.

The dry-run was the phase's centre of gravity: five fresh-context sub-agent runs found **fifteen** distinct skill defects, all fixed. Four of the five runs terminated at a gate, and in every case correctly — three because the scope genuinely conflicted with the project's own artifacts, which is exactly what the gates exist to catch.

## Sub-phase outcomes

| Sub-phase | Outcome | Commits |
| --- | --- | --- |
| 06a — `process.md`: phase-file required elements + Status lifecycle | Done; one-line change to the stage-5 note | `cd27dcc`, amended by `43da2f9` |
| 06b — `timone-plan` skill | Done; one contradiction found by a fresh-context conformance review before any dry-run | `5762e5f`, `43da2f9` |
| 06c — dry-run, 5 runs | Done; 15 defects found and fixed, human gate passed by fvermaut | `5e445ce` |
| 06d — docs + R10 → `verified` | Done | this commit |

## Dry-run evidence (06c)

| Run | Project | Scope | Outcome |
| --- | --- | --- | --- |
| 1 | scratch-app | drag-and-drop reordering | **Anchoring gate** — named verbatim in PRD-01's out-of-scope list, and reverses R4's insertion-order MUST. No file written. |
| 2 | — | *(folded into run 1; the ADR gate fired in runs 4 and 5's analysis instead)* | — |
| 3 | scratch-app-2 | password reset by email | **Anchoring gate** — `doc/specs/prd/` empty; routed to `timone-grill`, matching the triage record's own entry point. No file written. |
| 4 | scratch-existing | TypeScript migration (from triage 001) | **ADR gate** — adopting TypeScript contradicts a stated non-goal and the user-confirmed observed-stack resolution. No file written. |
| 5 | scratch-app | first implementation phase of the todo list | **Phase file written** — 276 lines, 6 slices, committed as `a538e45` in the fixture repo. |

Run 5 is R10's positive evidence: `projects/scratch-app/doc/plans/phases/phase-01.md` carries phase-level requirement IDs (PRD-01.R1–R7), per-sub-phase file markers, dependency statements, declared seams with red-green cases at two levels, and copy-pasteable validation commands including deliberate failure probes. The breakdown was presented and approved before the write (a stand-in approver, since sub-agents have no human).

Runs 1, 3 and 4 are R10's second criterion: the gates stop the skill and route, writing nothing.

## Defects found by the dry-run (all fixed)

**Round 1 — from runs 1, 3, 4:**

1. **No gate precedence.** All three runs flagged it independently; each resolved it by judgment. Anchoring is now evaluated first — architectural significance can't be judged on undetermined scope.
2. **`doc/triage/` missing from the read list.** It carries the request's kind (deciding whether the un-anchored path is open) and triage's chosen entry point. Two runs found it only by initiative.
3. **The PRD narrative's out-of-scope list missing from the read list.** Run 1's single strongest piece of evidence lived in a file the skill never told it to read.
4. **No route for scope contradicting an active requirement.** The gate handled absence only. This is an intent change → `timone-improve` (stage 9).
5. **No guidance for absent artifacts.** Four of five reads came back empty in run 4. Absence is now a finding to reason about, with the likely gate consequence named per artifact.
6. **ADR-gate timing paradox** — the gate asked what work "implies" one step before the cut that reveals it. Sketching is now explicitly allowed; only the artifact is forbidden.
7. **"Both gates terminal" contradicted the chore path**, whose un-anchored stamp is approved at workflow step 4. Reconciled — and stated that triage routing a chore here does *not* pre-clear the ADR gate, since chores are the likeliest stage-5 input to trip it.
8. **Numbering had no branch for an existing-but-empty directory** — exactly what onboarding leaves behind.
9. **`grill` vs `prd` split had no criterion.** Now: prefer the triage record's rationale; absent any signal, prefer grill.

**Round 2 — from run 5 (the happy path):**

10. **`standards/` was only a fallback.** An `Approved` standard (`nextjs.md`) is what decided the ADR gate — a less thorough agent would have routed to `timone-adr` to re-decide a settled question. Now an unconditional read, and a choice a normative standard already makes does not trip the gate.
11. **A `Draft` PRD passed the anchoring gate.** Stage 3's gate *is* "PRD becomes Active", so `Draft` means it never closed. Fourth anchoring case added, explicitly distinguished from the requirement-level `Status: draft` (which means "not yet verified" and is normal for unbuilt work).
12. **Greenfield had no sanctioned non-vertical leading slice.** A scaffold is not prefactoring — prefactoring restructures code that exists. Named as a second exception to vertical slicing, capped at one slice.
13. **Seams were split on code / no-code.** The real line is behaviour-carrying: a scaffold adds many files and no behaviour; an effect-only slice (idempotent seed) is seamed at the observable end state, not at any function.
14. **Requirement-ID format** — registers head their blocks `## R1`, the spec mandates `PRD-NN.R<k>`. Normalizing is now explicitly not "inventing".
15. **Directory creation before approval** was unspecified. A directory is not a plan; allowed during the read pass.

Also caught, before any dry-run, by a fresh-context conformance review of 06b: the `Status` lifecycle as written in 06a said the file carries `Awaiting approval` *when written*, but R10 requires approval **before** the write — making that state unreachable. `process.md` was corrected rather than the skill bent around it.

## Fixture defects found and fixed

The dry-run doubled as a fixture audit — both found by sub-agents reasoning about their inputs, neither previously known:

- **`scratch-app`'s PRD-01 was `Status: Draft`.** The stage-3 gate closed at authoring time but the status line was never flipped. Fixed (`86ffca9` in the fixture repo). Under the fixed skill this now correctly blocks planning.
- **`scratch-existing`'s `doc/standards.md` was stale** — it claimed `timone.yaml` still recorded `typescript, nextjs` and that no CLI command existed to fix it. Phase 05 shipped `projects update` and corrected the tag. Fixed (`9e06f1b`), with a `✏ Refined` marker per the amendment rule this phase added.

## Observations left open (flagged at the gate, not resolved)

- **Official scaffolding is absent from every standards entry.** `create-next-app` is mentioned nowhere, which is why run 5's leading slice hand-wrote `package.json`, `tsconfig.json`, `next.config.ts`, and `eslint.config.mjs`. fvermaut raised this at the gate: framework scaffolding should go through the official generator, across all stacks. Standards-library work (R18/R20), deliberately **not** folded into this phase.
- **MCP servers per stack.** `standards/shadcn.md` names the shadcn MCP server for agent sessions; no other entry does, and there is no general rule. Raised by fvermaut at the same gate. Two halves: which MCP pairs with which stack entry (standards content), and how MCP servers reach a session including daemon-triggered ones (architectural — collides with PRD-02's open skill-delivery question). Routed to a grill session, not decided here.
- **The bootstrap does not close.** Per fvermaut's scope decision at planning, `timone-plan` is managed-projects-only, so Timone's own phases stay hand-written. Phase 07 will be planned by hand.

## Context for next agent

Six stage skills exist: onboard, triage, grill, prd, adr, plan. Remaining PRD-01 lifecycle scope: **R11** (execute — the bigger lift, real orchestration over fresh-context sub-agents, and the first phase that consumes a `timone-plan` output for real), then R12 (verify), R13 (deliver), R14 (improve), plus R16 (TDD loop, inside execute) and R17 (two-axis delivery review, inside deliver).

`projects/scratch-app/doc/plans/phases/phase-01.md` is a real, approved, unexecuted phase file — the natural input for exercising R11 when it arrives.
