# Phase 07: Implementation — `timone-execute` + the TDD loop

> **Status:** Approved for execution by fvermaut 2026-07-24.

> **Companion phases:** [Phase 02](phase-02.md) (skill authoring conventions — the mandatory target-project resolution preamble, and the artifact rule this phase has to reconcile), [Phase 05](phase-05.md) (the spec-first-then-skill ordering this phase reuses), [Phase 06](phase-06.md) (`timone-plan` — its output is this phase's only input, and its dry-run left the phase file 07c executes). Governing decisions: [ADR-0007](../../adr/0007-sessions-at-timone-root.md) (sessions run at the timone root; the skill resolves a target project and works only inside `projects/<name>/`), [ADR-0009](../../adr/0009-cli-first-agent-tooling-mcp-for-the-gap.md) (CLI-first tooling — 07c is the first time a Timone skill actually *runs* the official scaffolding CLIs the standards entries now name, rather than describing them).

## Requirements

> **PRD:** [prd-01-process-layer.md](../../specs/prd/prd-01-process-layer.md) — criteria in [prd-01-process-layer.criteria.md](../../specs/prd/prd-01-process-layer.criteria.md)

| ID         | Priority | Requirement (one line)                                                                                                                                     |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PRD-01.R11 | MUST     | Execute skill: sub-phases run in dependency order via fresh sub-agent contexts with handoff notes; each sub-phase's validation steps pass before the next starts; a completion report is written under `doc/plans/phases/reports/` |
| PRD-01.R16 | MUST     | TDD implementation loop: tests written only at declared seams, each run failing (red) before the implementation that makes it pass (green), one slice at a time; refactoring deferred to delivery review; full suite once at sub-phase end |

No un-anchored enabler work in this phase. R11 and R16 are grouped because R16 has no delivery vehicle of its own — it is the inner loop of the skill R11 asks for, and splitting them would ship an orchestrator with no implementation discipline.

## Goal Description

Phase 06 closed the planning stage: `timone-plan` produces phase files with declared seams, dependency statements and copy-pasteable validation commands, and one such file — `projects/scratch-app/doc/plans/phases/phase-01.md`, six slices, approved, unexecuted — has been sitting as a fixture ever since. This phase builds the consumer. Stage 6 is where Timone stops producing documents about work and starts producing work: the orchestrator walks a phase file in dependency order, hands each slice to a fresh context that knows only what the plan told it, gates every transition on the slice's own validation steps, and closes the phase with a completion report. R16 lives inside that loop as the discipline each sub-agent runs under.

**Four spec gaps close first (07a).** The read pass found stage 6 underspecified in ways the skill cannot paper over. (1) **Branch and commit conventions are referenced but never defined** — R13 requires that they "match the process spec", `process.md` stage 6 says "code on a work branch" and stage 8 says "follows branch/commit conventions", and no line anywhere says what they are; execute is the stage that creates the branch, so it owns the gap. (2) **`.claude/skills/README.md` forbids what this skill must do** — its artifact rule says the only files a skill may cause to be committed in a target project are process artifacts under `doc/` and `CONTEXT.md`, which was true of the six document-producing skills and is false of this one. Note that PRD-01.R4's *criterion* is fine as written: it forbids skill and harness files, not application code. This is a conventions-doc defect, not a requirement change — no PRD amendment. (3) **Handoff notes have no home** — the spec names them as a stage-6 artifact and R11's verification hint says to inspect them, but the artifact-conventions tree has no path for them. (4) **The completion report has no defined required elements** — six exist in Timone's own repo as de facto precedent, specified nowhere.

**Conventions decided at the gate (2026-07-24, with fvermaut).** Handoff notes are appended to a single `doc/plans/phases/reports/phase-NN-handoffs.md`, one section per sub-phase, committed with that sub-phase's commit — auditable, survives session death (which the PRD-02 daemon will need), and costs one file per phase rather than one per slice. Work branches are one per phase, `phase-NN-<slug>`, cut from the project's default branch, with one commit per sub-phase made only *after* its validation passes, messaged `<type>: NNx — <deliverable>`; the point is that `git log` alone answers which slices actually landed. Both passed the significance test's trade-off part but not *hard to reverse*, so both are `process.md` amendments rather than ADRs — the same reasoning that kept phase 05's triage-record convention and phase 06's `Status` lifecycle out of the ADR log.

**How the skill talks about sub-agents, and why that isn't an ADR either.** The skill specifies the *contract* — what a fresh context receives (the plan excerpt, the prior handoff, the file list, `doc/standards.md`, the declared seams) and what it returns (a handoff note plus validation evidence) — and names a concrete spawning mechanism only as an example. The alternative was to write the harness's mechanism into the skill directly, which reads more concretely but binds stage 6 to one runtime; PRD-02's daemon will spawn these contexts through the Agent SDK ([ADR-0002](../../adr/0002-typescript-claude-agent-sdk.md)), and a contract-shaped skill survives that substitution unedited. Real trade-off, but nothing hard to reverse and nothing surprising given ADR-0009's framing, so it is recorded here rather than sent to `timone-adr`.

**Why the dry-run is the full six slices.** R11's verification hint asks only for "a two-sub-phase plan", and 07c executes all six of `scratch-app` phase-01 anyway. The reason is phase 08: R12 requires "a project with a criteria register and a runnable app", and no fixture has an app at all. A full run leaves a working Next.js + PostgreSQL todo list behind, which is the input the verify skill needs and would otherwise have to be built as unplanned prerequisite work. It also puts the newly-amended standards entries under real load — 01a scaffolds through `create-next-app` per ADR-0009 rather than hand-writing config, which nothing has yet exercised.

## Context & Prerequisites

- **Phase 02** — `.claude/skills/README.md`: frontmatter rules, the mandatory six-step target-project resolution preamble (copy it verbatim), and the artifact rule that 07a amends.
- **Phase 06** — `.claude/skills/timone-plan/SKILL.md` defines the phase-file template this skill consumes: the `Status` blockquote (whose `Approved for execution` stamp is this skill's entry gate and whose `Complete` state this skill writes), per-sub-phase file markers, dependency statements, declared seams, and validation blocks. The two skills must agree field for field; where they don't, `process.md` decides.
- **`process.md` stage 6** — normative: fresh context per sub-phase carrying only the relevant plan excerpt, prior handoff and file list; sequential by default, parallel only for slices sharing zero files; TDD red-before-green at declared seams; the three rejected anti-patterns; refactoring deferred to delivery; type-check regularly, single test files during the loop, full suite at the end; a sub-phase is complete only when its validation checklist passes; max 2 retries then escalate.
- **`standards/testing.md`** (`Approved 2026-07-19`) — seam selection, mocking discipline, pyramid posture (Vitest + Playwright) and flake posture. The skill restates the *loop*; it must not restate this entry's content, which reaches sessions through the standards library.
- **Standards entries the dry-run will exercise** — `nextjs`, `prisma-postgresql`, `docker-compose-local`, `testing`, and the accessibility baseline. Their 2026-07-20 amendments — the scaffolding commands 01a will run, and the `next-devtools` / `playwright` MCP adoptions — are approved and normative.
  > ✏ Refined 2026-07-24: this bullet previously flagged five entries as `pending approval` and named settling them as a precondition for 07c. fvermaut approved all six amended entries the same day; the precondition is discharged, and the scaffolding commands 01a runs are now binding rather than provisional.
- **The fixture plan** — `projects/scratch-app/doc/plans/phases/phase-01.md`: 276 lines, six slices (01a scaffold → 01b create/list → 01c toggle/delete → 01d verification harness → 01e seed → 01f docs), seams declared at two levels, validation blocks containing deliberate failure probes. `scratch-app` is doc-only today (`CONTEXT.md`, `README.md`, `doc/`), so 01a starts from nothing.
- **Local prerequisites for 07c** — Docker (for the PostgreSQL service 01a stands up) and Node. The fixture repos are local bare repos under `tmp/fixtures/*.git`, so nothing is pushed to a remote and the `gh` path is not exercised here.

## Sub-phases

### Sub-phase 07a: process-spec amendment — stage-6 required elements, branch/commit conventions, handoff home

**[MODIFY]** `process.md` — four touches, all in stage-6 material plus one line in the artifact-conventions tree:
1. **Work branch and commits** — one branch per phase, `phase-NN-<slug>`, cut from the project's default branch; execution refuses to start on a dirty working tree or on an existing branch of that name carrying divergent commits. One commit per sub-phase, made only after that sub-phase's validation passes, messaged `<type>: NNx — <deliverable>`.
2. **Handoff notes** — required contents (what the slice built, files touched, decisions taken inside the slice, validation evidence including the red-green trace, and anything the next slice must know) and their home: appended to `doc/plans/phases/reports/phase-NN-handoffs.md`, one section per sub-phase, committed with that sub-phase's commit.
3. **Completion report required elements** — date, plan link with its approval trace, the requirement IDs delivered and their resulting statuses, a per-sub-phase outcome table with commit SHAs, deviations from the plan, and context for the next agent.
4. **Escalation, made concrete** — after two failed attempts at a sub-phase's validation, execution stops, does not start any dependent sub-phase, and reports the failing validation step with both attempts. Because commits happen only after validation passes, the branch is left at the last passing sub-phase and the failing work stays uncommitted in the working tree; the escalation says so rather than leaving the state to inference. Also stated: a phase file not stamped `Approved for execution` is not executable.
5. **Artifact conventions tree** — add `plans/phases/reports/phase-NN-handoffs.md`.

**[MODIFY]** `.claude/skills/README.md` — reconcile the artifact rule with a code-writing skill: document stages commit process artifacts under `doc/` and `CONTEXT.md`; stage 6 additionally commits the application code and project tooling its plan calls for. What stays forbidden in every case is skill files, harness config and timone internals — which is what PRD-01.R4 actually says.

Keep `process.md` thin, per the division phases 05 and 06 established: it states the required elements and the gate, never the document layout. The handoff-note and completion-report *templates* live in the skill (07b).

**Seams under test (TDD):** no behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
grep -n "phase-NN-<slug>\|phase-NN-handoffs" process.md; echo "exit: $?"
grep -c "Awaiting approval" process.md
git -C . diff --stat
```

- [ ] Stage-6 note states branch/commit conventions, handoff contents + home, completion-report required elements, and concrete escalation semantics
- [ ] The artifact-conventions tree lists `plans/phases/reports/phase-NN-handoffs.md`
- [ ] `process.md` gained no handoff-note or completion-report *template* (those belong to the skill)
- [ ] `.claude/skills/README.md`'s artifact rule permits stage-6 code commits and still forbids skill/harness/timone-internal files, matching R4's wording
- [ ] No other stage's text altered; stage 5's `Status` lifecycle wording is untouched
- [ ] No PRD amendment was made — R4's criterion needed none

---

### Sub-phase 07b: `timone-execute` skill

**[NEW FILE]** `.claude/skills/timone-execute/SKILL.md`

**Seams under test (TDD):** no behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based, with the real test deferred to 07c.

> Sub-phase 07a must be complete before starting this sub-phase (spec wins; the skill restates it).

Per `process.md` stage 6, with the standard target-project resolution preamble from `.claude/skills/README.md` — managed projects only. Input: a project name plus a phase reference (`phase-07`, or a path). The skill:

1. **Reads before executing** — the phase file and its `Status` stamp; any existing `phase-NN-handoffs.md` (a partially-executed phase is resumed, not restarted); `doc/standards.md`; `CONTEXT.md` for the canonical domain terms the code must use; the ADRs the plan cites; the criteria register for the IDs the phase claims; and Timone's own `standards/` `Approved` entries for the project's stack.
2. **Fires its gates**, each terminal, each naming where to route:
   - Phase file not stamped `Approved for execution` → refuse; route to the human, or to `timone-plan` if the file needs re-approval after an amendment.
   - A code-carrying sub-phase with no declared seams → refuse; route to `timone-plan` for an in-place `✏ Refined` amendment. Stage 6 writes tests only at declared seams, so an undeclared slice is unexecutable, not a licence to improvise.
   - Reality contradicts the plan mid-execution → stop and amend the plan through `timone-plan`'s amendment rule; never deviate silently and never resolve a plan-level question inside a slice.
3. **Sets up the work branch** per 07a, refusing a dirty tree or a divergent same-named branch.
4. **Walks the sub-phases in dependency order** — sequential by default; parallel only where the plan's dependency graph and file markers prove zero file overlap. Each sub-phase gets a **fresh context** carrying exactly: the plan excerpt for that slice, the accumulated handoff file, the file list, `doc/standards.md`, and the declared seams. Nothing else — context the plan didn't grant is context the plan can't be held to.
5. **Runs the TDD loop inside each slice (R16)** — a failing test at a declared seam first, run and seen red, then the smallest implementation that turns it green, one red-green case at a time. No tests outside declared seams. The three anti-patterns are rejected by name: implementation-coupled tests (break on refactor with no behaviour change), tautological assertions (expected value recomputed the code's way), horizontal slicing (all tests written up front, verifying imagined behaviour). Refactoring is deferred to the delivery review. Type-check regularly, run single test files during the loop, the full suite once at sub-phase end.
6. **Gates the transition** — the sub-phase's own validation block runs, including its deliberate failure probes; every assertion must pass before the next slice starts. Failure → at most two attempts, then escalate per 07a.
7. **Writes the handoff** — appends this slice's section to `phase-NN-handoffs.md` and commits it with the slice's code, in one commit per 07a's convention.
8. **Closes the phase** — writes `doc/plans/phases/reports/phase-NN-complete.md` and flips the phase file's `Status` to `Complete — see [reports/phase-NN-complete.md](…)`.

The skill carries two inline fenced templates (house style — no bundled reference files): the **handoff-note section** (slice ID, what was built, files touched, decisions taken, red-green evidence, validation outcome, what the next slice must know) and the **completion report** (the 07a required elements, distilled from Timone's own six reports under `doc/plans/phases/reports/`).

Closing: report the phase, the branch, the per-sub-phase outcomes with commits, the report path, and the next invocation — `/timone-verify <project>`. Note explicitly in the skill that `timone-verify` does not exist yet (phase 08); execution names the next stage regardless, as the other skills do. `timone-execute` implements; it never verifies its own work and never opens a PR.

#### Agent Validation Steps

```bash
head -6 .claude/skills/timone-execute/SKILL.md
grep -n "Awaiting approval\|declared seams\|red\b" .claude/skills/timone-execute/SKILL.md | head -20
grep -c "timone-verify" .claude/skills/timone-execute/SKILL.md
```

- [ ] Frontmatter + targeting per `.claude/skills/README.md` (`argument-hint` starts with `<project-name>`, then the phase reference)
- [ ] Stage-6 rules restated with no variants: dependency order, fresh context per slice with a named input set, sequential-by-default, red-before-green at declared seams, the three anti-patterns by name, refactoring deferred, full suite at slice end
- [ ] All three gates are terminal, write no code, and name the skill or human to route to
- [ ] The sub-agent contract is stated as inputs/outputs, with no runtime-specific mechanism written in as a requirement
- [ ] Both inline templates present; the completion-report template carries every 07a required element
- [ ] Branch/commit/handoff behaviour matches 07a exactly — no invented variants
- [ ] The `Status` → `Complete` flip and the report path match `timone-plan`'s template field for field

---

### Sub-phase 07c: Dry-run — three runs against the fixtures

**Seams under test (TDD):** this sub-phase writes no Timone code; its "seam" is the observable end state of each run, asserted below. The application code produced inside run 1 is itself built TDD by the skill under test — that is the run's primary evidence, not a property of this sub-phase.

> Sub-phases 07a and 07b must be complete before starting this sub-phase.

From fresh timone-root sessions:

1. **Happy path — execute `scratch-app` phase-01 end to end**, all six slices. Expect: a `phase-01-<slug>` branch; one commit per sub-phase in dependency order; `phase-01-handoffs.md` accumulating a section per slice; red-before-green evidence visible in each handoff (not just a final green suite); every validation block run, failure probes included; a completion report; and the phase file's `Status` flipped to `Complete`. The end state is a runnable todo app — start it and load it, since a green suite is not a running app.
2. **Failure path** — a hand-authored two-slice plan in `scratch-existing` whose second slice carries an unsatisfiable validation step. Expect: slice one commits normally; slice two attempts twice, then escalation that names the failing step and both attempts; no third attempt; no dependent work started; the branch left at slice one with the failed work uncommitted, and the escalation saying so.

   > ✏ Refined 2026-07-24: **this expectation was wrong, and the runs proved it.** Two attempts at run 2 both terminated at a gate before any slice was dispatched — correctly. A *plan-level* defect is visible at read time by construction, so the pre-flight feasibility check this dry-run added (07c round 1) now catches an unsatisfiable validation block before a branch is cut. Gate-3-at-pre-flight is the better outcome and the one to expect from a planted plan defect; escalation is not reachable that way. Escalation is for *implementation* failure, so it is tested separately: run 4 below. The fixture also moved from `scratch-app-2` (docs-only, so slice one could not commit anything real) to `scratch-existing`, which has a working Express repo.

4. **Escalation** — after run 1 leaves `scratch-app` a running Next.js + PostgreSQL app, an appended slice whose validation requires the database container, run with Docker stopped. The failure is environmental, invisible at read time, and no implementation within the slice's file list can fix it. Expect: two attempts, then escalation naming the failing step and both attempts; the branch left at the last passing sub-phase with the failed work uncommitted, and the escalation saying so.
   > ✏ Refined 2026-07-24: added, per the correction above.
3. **Approval gate** — a plan file stamped `Awaiting approval`. Expect: refusal, no branch created, no code written, correct routing named.

Then: `git log --stat` in the touched fixture repos — no skill files, no harness config, no timone internals (R4 regression, now that a skill commits code for the first time).

#### Agent Validation Steps

```bash
git -C projects/scratch-app log --oneline --stat | head -60
git -C projects/scratch-app branch --show-current
sed -n '1,5p' projects/scratch-app/doc/plans/phases/phase-01.md
ls projects/scratch-app/doc/plans/phases/reports/
# Failure probe: no skill, harness or timone-internal file may appear in a fixture's history
git -C projects/scratch-app log --stat | grep -E "\.claude/|timone\.yaml|^ src/" ; echo "exit: $? (1 = clean, as required)"
git -C projects/scratch-app-2 log --oneline | head -10
git -C projects/scratch-app-2 branch --show-current
```

- [ ] Run 1: six commits, one per sub-phase, in dependency order, each after its validation passed
- [ ] Run 1: `phase-01-handoffs.md` has six sections, each carrying red-green evidence and files touched
- [ ] Run 1: completion report exists with every 07a required element; phase file `Status` reads `Complete`
- [ ] Run 1: the app actually runs and serves the todo list — loaded, not merely built
- [ ] Run 2: exactly two attempts, then escalation naming the failing step; no dependent sub-phase started; branch state matches what the escalation claims
- [ ] Run 3: terminal refusal — no branch, no code, correct routing named
- [ ] `git log --stat` in every touched fixture shows no skill, harness or timone-internal files
- [ ] Defects found are fixed in `timone-execute` (and in `process.md` when the spec is what was wrong, never by bending the skill around it)
- [ ] **Human gate:** fvermaut reviews the produced app, the handoff chain, the completion report, and the two non-happy-path transcripts before this sub-phase is marked done — this gate is also R16's evidence, whose verify-via is `human`

---

### Sub-phase 07d: Documentation

**[MODIFY]** `README.md` — add `/timone-execute <project-name> <phase-NN>` to the "Working with Timone" command list; update the Status paragraph.
**[MODIFY]** `doc/specs/prd/prd-01-process-layer.criteria.md` — flip R11 and R16 to `verified` once 07c's human gate passes.

**Seams under test (TDD):** no behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based.

> All prior sub-phases must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
grep -n "timone-execute" README.md
grep -n -A3 "^## R11\|^## R16" doc/specs/prd/prd-01-process-layer.criteria.md
```

- [ ] Documented invocation matches actual behavior; links resolve
- [ ] R11 and R16 flipped only after the 07c human gate passed
- [ ] The Status paragraph names what remains: verify, deliver, improve (R12–R14, R17)

## Dependency graph

```
07a → (none)      process.md: stage-6 required elements, branch/commit, handoff home; skills-README reconciliation (spec first)
07b → 07a         timone-execute skill
07c → 07a, 07b    dry-run: 3 runs (full 6-slice execution, failure/escalation, approval gate), human gate
07d → 07c         docs last + R11/R16 → verified
```
