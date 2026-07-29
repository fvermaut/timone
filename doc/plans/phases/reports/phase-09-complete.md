# Phase 09 — Completion Report

- **Date:** 2026-07-29
- **Phase:** [phase-09.md](../phase-09.md) — approved for execution by fvermaut 2026-07-28; 09b's, 09e's and 09f's gates passed by fvermaut 2026-07-29
- **Requirements delivered:** PRD-01.**R13**, **R17**, **R21**, **R22** — all four flipped `draft` → `verified` (17 of 24 → **21 of 24**)
- **Branch:** `main` — Timone's own phases are hand-planned and committed directly; the branch-per-phase rule governs managed projects

## Sub-phase outcomes

| Sub-phase | Deliverable | Commit | Outcome |
| --- | --- | --- | --- |
| 09a | `process.md` stage-8 expansion (nine decisions), stage-6 correction, third standards tier, skills-README reconciliation | `e25258d` | Complete |
| 09b | `standards/code-smells.md` + README tier | `92a5178`, approved `ff8a547` | Complete — approved by fvermaut after one amendment |
| 09c | `.claude/skills/timone-deliver/SKILL.md`; `timone-verify` Closing fix | `a148cec` | Complete |
| 09d | GitHub fixture: platform-refusal run, `gh` install, repo creation, manifest repoint | `5c8daf5` | Complete |
| 09e | Dry run — four runs against the fixtures, plus the 09d refusal | `da5c90a`, `4046b06` | Complete — three rounds of fixes |
| 09f | Verification of R21 and R22 | `8c9b9a1` | Complete — R21 clean, R22 passed after two fix loops |
| 09g | README, register flips, `STATUS.md`, this report | this commit | Complete |

## What was built

**Stage 8 is specified.** `process.md`'s one-paragraph note became nine decisions: the entry gate and its routing, an unperformed HUMAN-CHECK as non-blocking, the gate order (work before host), both review axes' read lists and their mutual and verification-report blindness, reports-never-block and reports-never-refactor, the committed delivery report, the PR's required elements including the requirements fallback for ticketless projects, the stacked-branch base rule, the GitHub-only terminal refusal, and re-delivery as update.

**`timone-deliver` exists** and has opened two real pull requests on `scratch-app`: [#1](https://github.com/fvermaut/scratch-app/pull/1) against `main`, [#2](https://github.com/fvermaut/scratch-app/pull/2) stacked on its parent branch. Both carry scope, the verification outcome, outstanding HUMAN-CHECKs as unticked items, and both review axes under distinct headings.

**The code-smell review reference exists** — `standards/code-smells.md`, twenty smells in five families, each stating the signal that identifies it *in a diff*. It occupies a new third library tier: applied by stage 8 to every project, overridable by a project's own standards. It could not be the mandatory baseline, which admits no exceptions, and could not be a stack entry, which is selected per project.

## Deviations from the plan

- **The plan's run-1 assertion was wrong and was amended in place.** It presumed all three of phase-01's deferred refactorings were Standards material; one is a behaviour concern that the Spec axis caught instead. Marked `✏ Refined 2026-07-28`.
- **Two prerequisites the phase-08 handover had not both caught** were closed inside this phase rather than before it: the code-smell reference (planned, 09b) and the absence of any GitHub remote or `gh` binary anywhere in the workspace (unplanned at handover time, handled by 09d).
- **09f's scope grew by one artefact.** Verifying R22 required fixing both `STATUS.md` files across two loops, not merely checking them.

## Defects found and fixed

Three rounds against `timone-deliver` and its reference. **Two of the three were rules that contradicted themselves** — the class of defect that produces no visible failure, because the agent silently obeys one half.

1. **`code-smells.md`'s Duplicated-code signal read "the same block"**, so a repeated one-liner did not trip it and `updateTag("todos")` restated across all three sibling actions went unreported. Fixed; a fresh Standards context then ranked exactly that finding first — the fix is proved, not asserted.
2. **The axes were told to read "the current content of the files the diff touches" and forbidden the verification report** — which is always in the range, because a phase commits its reports to its own branch. The inverse of the defect 08c round 3 found in `timone-verify`. The review subject is now the range's non-process files, and a read list outranks the diff's contents.
3. **Re-delivery re-reviewed its own delivery report**, forever: the rule re-ran the axes on any new commit, and the delivery report is a commit on the branch. Re-running is now tied to a change in the axis's subject.

Also fixed: `timone-verify`'s Closing prescribed `/timone-deliver <project>` with no phase reference — the identical defect 08c round 1 found in `timone-execute`, which would strand any project past its first phase.

## Findings worth carrying forward

- **The axes disagree with stage 7 on R6, and the disagreement was left standing.** Verification PASSed "the todo disappears immediately" against the running app; the Spec axis read the source and found the code concedes its primary path wedges, scheduling two timed refreshes with a comment admitting the first can lose the race. Both are true of what each looked at. Merging them would have erased the distinction that makes the second worth having.
- **A range-bounded review cannot always resolve a contradiction whose resolution lives in the base.** The Spec axis found a real contradiction in `scratch-app`'s `doc/standards.md` and resolved it the wrong way, because the commit settling it (`fa0da1c`) is in the base. It hedged correctly, and the delivery report records the correction as a deliverer's note without touching the verbatim report.
- **`STATUS.md` is branch-local, and that defeats its purpose.** Found by 09f's second naive reader. On `scratch-app` the default branch had no copy at all while the two open branches each carried a different one. Both copies were reconciled by hand; the property is unresolved and routed to fvermaut and stage 9.
- **Docs-last sequencing on Timone's own phases opens a window** in which the two `STATUS.md` files contradict each other. 09f closed this instance by bringing Timone's file current mid-phase.

## Context for the next agent

**Stage 9 (`timone-improve`) is the next phase and the last real gap** — stages 10 and 11 are deliberately post-MVP. It has an unusually good fixture waiting, and it should not be spent early: nine review findings (six Standards, three Spec) across two PRs, two open HUMAN-CHECKs (R7's screen-reader clause, phase 02's 2 ms budget), one stale `doc/standards.md` line, and the branch-local `STATUS.md` question — all genuine, none planted. Phase 08 could only be built because phase 07 left a runnable app behind; phase 10 inherits real post-delivery feedback the same way.

**Do not act on those findings by hand.** Stage 8 deliberately did not apply them, and stage 9 is the stage that decides intent-versus-implementation and executes remediation after confirmation.

**Fixture state.** `scratch-app` is now a private GitHub repository (`github.com/fvermaut/scratch-app`) with `main` plus both phase branches pushed; `scratch-app-2` and `scratch-existing` remain on local bare repos and are the standing non-GitHub cases. `gh` 2.96.0 is installed and authenticated as `fvermaut`.

> ✏ Amended 2026-07-29, after this report was written: **PR #1 was merged by fvermaut**, so `main` now carries the application. PR #2 was retargeted from the phase-01 branch to `main` and is still open, still carrying the 2 ms budget decision. A process change landed at the same time — **`STATUS.md` is written only on a project's default branch, never on a work branch** (`process.md` § Status reporting) — because every stage rewrites the whole file and two branches editing it collide on merge. `scratch-app` was already in that state and the collision fired on the attempt to merge PR #2; it was resolved by hand in favour of the main-line copy, and `git merge-tree` now reports the branch clean. The stage-7 and stage-8 skills carry the rule.

**Still barred from planning:** R24 (standards-drift detection) until a `timone-grill` session rewrites its criteria. R14 and R23 are plannable.
