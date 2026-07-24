# Phase 07 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 07a — process-spec amendment: stage-6 required elements, branch/commit conventions, handoff home

**Built.** Closed the four stage-6 spec gaps phase 07's goal description identified. `process.md`'s stage-6 note now states, in its own voice, the entry gate, the work-branch and commit conventions, the handoff-note contents and home, the completion report's required elements, and concrete escalation semantics. The artifact-conventions tree gained the handoff-note path. `.claude/skills/README.md`'s artifact rule was reconciled with a code-writing skill.

**Files touched.**

- `process.md` — stage-6 note extended (line 37); artifact-conventions tree gained one line after `plans/phases/reports/`.
- `.claude/skills/README.md` — second bullet of "Artifact rules" rewritten.
- `doc/plans/phases/reports/phase-07-handoffs.md` — this file (new).

**Decisions taken inside the slice.**

- *Append, never restructure.* Every existing sentence of the stage-6 note survives verbatim, including `Bounded retries (max 2 per sub-phase), then escalate to the human.` The concrete escalation extends that sentence rather than replacing it, so nothing that other artifacts already cite moved.
- *Named the completion report's path in the spec.* Stage 6 previously said "completion report" without a filename while stage 7 named `phase-NN-verification.md`. Since the required-elements amendment had to point somewhere, `doc/plans/phases/reports/phase-NN-complete.md` is now stated — matching the six existing reports in Timone's own repo and 07b's step 8.
- *Entry gate placed with the other pre-flight rules*, not folded into the escalation sentence where the plan listed it. Same wording, better adjacency: it reads immediately before the branch rules it gates.
- *Artifact tree carries the full path*, `plans/phases/reports/phase-NN-handoffs.md`, on its own line rather than nested under the existing `plans/phases/reports/` line. Nesting would have been prettier but would not have satisfied the plan's assertion that the tree "lists `plans/phases/reports/phase-NN-handoffs.md`" against a literal grep.
- *No PRD amendment.* PRD-01.R4's criterion reads "no commit produced in the target project contains skill or harness files (process artifacts under `doc/` and `CONTEXT.md` excepted)" — it forbids skill and harness files, not application code. The defect was only in `.claude/skills/README.md`, which had over-tightened the criterion into "the only files … are process artifacts". The amended bullet cites R4 so the two can't drift again.
- *This file's section format.* Fixed heading `## NNx — <sub-phase title>` followed by bolded lead-ins in a fixed order — **Built**, **Files touched**, **Decisions taken inside the slice**, **Validation evidence** (carrying the red-green trace), **What the next sub-phase must know**. Chosen because the order is exactly the required-contents list `process.md` now states, so 07b's inline template is a transcription of the spec sentence rather than a second, drifting source; because a fixed heading shape lets an appending agent locate the insertion point without parsing prose; and because bolded lead-ins over short blocks match the house voice used across `doc/plans/phases/reports/`. Slices carrying no code say so under **Validation evidence** rather than omitting the red-green trace silently — the same discipline stage 5 imposes on declared seams.

**Validation evidence.** No behaviour-carrying code in this slice, so no seams were declared and there is no red-green trace; validation is checklist-based, as the plan states.

```
$ grep -n "phase-NN-<slug>\|phase-NN-handoffs" process.md; echo "exit: $?"
37:...one branch per phase, named `phase-NN-<slug>`...appended to `doc/plans/phases/reports/phase-NN-handoffs.md`...
60:  plans/phases/reports/phase-NN-handoffs.md   stage-6 sub-agent handoff notes, one section per sub-phase
exit: 0

$ grep -c "Awaiting approval" process.md
1                       # unchanged — stage 5's Status lifecycle untouched

$ git -C . diff --stat
 .claude/skills/README.md | 2 +-
 process.md               | 3 ++-
 2 files changed, 3 insertions(+), 2 deletions(-)
```

All six plan assertions pass; `git diff` was read line by line to confirm no other stage's text moved.

**What 07b must know.** The five conventions below are now normative in `process.md` stage 6. Restate them with no variants — where the skill and the spec disagree, the spec wins and the skill gets fixed.

1. **Entry gate** — "a phase file not stamped `Approved for execution` is not executable — execution refuses and routes back to stage 5."
2. **Branch** — one branch per phase, named `phase-NN-<slug>`, cut from the project's default branch. Execution refuses to start on a dirty working tree, or on an existing branch of that name carrying divergent commits.
3. **Commits** — one commit per sub-phase, made only **after** that sub-phase's validation passes, messaged `` `<type>: NNx — <deliverable>` `` (em dash, lower-case conventional-commit type, sub-phase id as `NNx` e.g. `07a`).
4. **Handoff notes** — contents: what the slice built, files touched, decisions taken inside the slice, validation evidence including the red-green trace, anything the next slice must know. Home: `doc/plans/phases/reports/phase-NN-handoffs.md`, one section per sub-phase, committed with that sub-phase's commit. The skill's inline template should follow this file's section shape (see the decision above); appending to an existing file is how a partially-executed phase resumes.
5. **Completion report** — `doc/plans/phases/reports/phase-NN-complete.md`, required elements: date; link to the plan with its approval trace; the requirement IDs delivered and their resulting statuses; a per-sub-phase outcome table carrying commit SHAs; deviations from the plan; context for the next agent.
6. **Escalation** — after two failed attempts at a sub-phase's validation, execution stops, starts no dependent sub-phase, and reports the failing validation step with both attempts. The escalation must state the resulting repository state explicitly: the branch sits at the last passing sub-phase and the failing work is uncommitted in the working tree.

Also: `process.md` deliberately carries **no** handoff-note or completion-report template — the spec states required elements and gates only, per the division phases 05 and 06 established. Both templates are 07b's to write, inline in `SKILL.md` (house style, no bundled reference files). The skills-README artifact rule now permits stage-6 code commits, so `timone-execute` does not need to argue for that permission; it should still assert the R4 prohibition (no skill files, harness config or timone internals in a client repo) since 07c regression-tests it.

## 07b — `timone-execute` skill

**Built.** `.claude/skills/timone-execute/SKILL.md` (216 lines): stage 6's skill. It resolves a target project and a phase reference, reads the phase file and any accumulated handoff before touching anything, fires three terminal gates, cuts the work branch, walks the sub-phases in dependency order through fresh contexts under a stated input/output contract, runs the TDD loop at declared seams, gates each transition on the slice's own validation block, appends a handoff section and commits it with the slice's code, then closes the phase with a completion report and the `Status` flip. Two inline fenced templates — handoff-note section and completion report — carry the layouts `process.md` deliberately doesn't.

Section outline: frontmatter → intro → Target-project resolution → Input → Read before you execute → The three gates → The work branch and commits → The sub-agent contract → Walking the sub-phases → The TDD loop inside a slice (R16) → The transition gate and escalation → Handoff-note template → Closing the phase (Status flip + completion-report template) → Workflow → Closing.

**Files touched.**

- `.claude/skills/timone-execute/SKILL.md` — new (directory created).
- `doc/plans/phases/reports/phase-07-handoffs.md` — this section appended; 07a's section untouched.

**Decisions taken inside the slice.**

- *The phase-close commit is named, because 07a doesn't name it.* The spec's commit convention (`<type>: NNx — <deliverable>`) covers sub-phase commits only, and the completion report plus the `Status` flip are not a sub-phase. The skill messages that commit `docs: close phase NN — <theme>`, mirroring stage 5's `docs: plan phase NN — <theme>`, and says in the same breath that it carries no `NNx`. This is an extension into silence, not a variant of a stated rule — but it is the one place where the skill states a convention `process.md` does not, so 07c should confirm it reads right and 07d can promote it to the spec if fvermaut prefers.
- *The approval trace is preserved by moving it, not by keeping two lines.* `timone-plan`'s template says the `Status` line has three states, so the flip replaces `Approved for execution by <who> <date>` rather than appending. That would destroy the approval trace the completion report is required to carry, so the skill orders the two writes: copy `<who> <date>` into the report's **Plan** line first, then flip. This is why the required element reads "approved by <who> <date>" in the template.
- *Execution never writes a criterion `Status`.* 07a's required element is "the requirement IDs delivered and their resulting statuses", which could be read as licensing a register edit. `timone-prd`'s register spec assigns `verified`/`failed` to `timone-verify`, so the skill reports the status as the register reads when execution ends and states outright that execution does not flip it. Timone's own 07d flips R11/R16 by hand, which is a hand-run phase, not a counter-example.
- *Parallel slices are allowed to run concurrently but not to commit or append concurrently.* The plan permits parallelism where file markers prove zero overlap, and `scratch-app` phase-01 exercises it (01d ∥ 01e). Both would append to the same `phase-NN-handoffs.md`, which no file marker mentions, so the skill serializes the appends and the commits in dependency order. Without this the first real parallel run corrupts the handoff file.
- *The slice context does not commit; the orchestrator does.* Someone had to own the commit, and the gate owner is the only defensible choice — the commit is the assertion that validation passed. The contract's outputs are therefore a handoff section plus validation evidence, and "evidence that is missing, ambiguous, or doesn't cover an assertion counts as a failed attempt", so a slice can't buy a pass by asserting one.
- *`standards/testing.md` is pointed at, never restated.* The skill states the loop (red before green, the three anti-patterns by name, refactoring deferred, the rhythm) and explicitly tells the orchestrator not to restate seam selection, mocking or pyramid posture in the slice prompt — that content reaches the slice through the standards library, per the phase's Context & Prerequisites.
- *Gate 3 is scoped to the plan being unfollowable, not to the plan being improvable.* "Reality contradicts the plan" is easy to over-fire into "I'd have cut this differently". The skill enumerates the qualifying cases (a file the plan says exists doesn't, a declared seam isn't reachable, an assumed dependency is impossible, a validation command can't run) and routes decisions that turn out to be significant to `timone-adr` rather than into the code.

**Validation evidence.** No behaviour-carrying code in this slice, so no seams were declared and there is no red-green trace; validation is checklist-based, as the plan states.

```
$ head -6 .claude/skills/timone-execute/SKILL.md
---
name: timone-execute
description: Stage 6 (Implementation) of the Timone process — ... "execute phase NN", "implement the plan", ...
argument-hint: <project-name> <phase-ref: phase-NN or a path to the phase file>
---

$ grep -n "Awaiting approval\|declared seams\|red\b" .claude/skills/timone-execute/SKILL.md | head -20
# 20 hits across the description, the gates, the contract, the TDD loop and both templates;
# "Awaiting approval" appears in gate 1 (line 46).

$ grep -c "timone-verify" .claude/skills/timone-execute/SKILL.md
2

$ wc -l .claude/skills/timone-execute/SKILL.md
216
```

All seven plan assertions pass. Link targets were checked against the repo (`../../../doc/...` from a skill file, matching `timone-onboard`/`timone-grill`); the `Status` flip wording was diffed against `timone-plan/SKILL.md`'s template line 101 by reading it, not from memory.

**What 07c must know.**

- **Run 3 (approval gate) is the cheapest and should go first** — it must produce no branch and no code. Watch that the refusal names *which* route it chose (human vs `timone-plan`); the skill splits on "never approved" vs "amended after approval", and a run that conflates them is a defect.
- **Run 1 will hit the parallel-append rule at 01d/01e.** The fixture plan explicitly says they share zero files and may run in parallel. If the run serializes them anyway that's acceptable; if it runs them concurrently, check `phase-01-handoffs.md` has exactly one clean section each and the commits are still in dependency order.
- **01a is the likeliest place the skill is wrong.** It declares no seams, so gate 2 must *pass* it on the strength of its explicit no-behaviour statement — a run that refuses 01a has read the gate too literally. It also carries a human gate (`doc/standards.md` missing, port 5433) that must actually stop and ask, and it is where the "no tests outside declared seams" rule meets a slice whose validation is all shell commands.
- **The escalation run (run 2) tests a claim the skill makes about repository state**, not just its retry count: "the branch is left at the last passing sub-phase and the failing work is uncommitted in the working tree". Verify that literally with `git status` / `git log`, since nothing in the skill enforces it mechanically — it is a consequence of commit-after-validation that only holds if no slice commits early.
- **Most likely defects, in order:** (1) the phase-close commit message, invented here (see decisions above); (2) the read pass being heavy enough that the orchestrator skips parts of it under a long six-slice run — the skill has no "read receipt", so 07c should check the run actually read `CONTEXT.md` and the ADRs, since `scratch-app`'s ADR-0001 and glossary carry real constraints (no `user_id`, no `Task`/`Item` rename) that only bite if read; (3) the contract's "nothing else" being honoured in the letter but broken in spirit by an orchestrator that summarizes the phase into the slice prompt.
- **Resume is untested by the plan's three runs.** The skill treats an existing handoff file plus matching commits as the resume case and a mismatch as gate 3. If a run dies mid-phase for unrelated reasons, that is a free fourth data point — take it.
