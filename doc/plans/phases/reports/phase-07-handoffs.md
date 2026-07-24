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
