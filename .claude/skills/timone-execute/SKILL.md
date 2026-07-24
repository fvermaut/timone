---
name: timone-execute
description: Stage 6 (Implementation) of the Timone process — on a managed project, execute an approved phase file: walk its sub-phases in dependency order through fresh-context sub-agents, run the TDD loop at the declared seams, gate every transition on the slice's own validation steps, and close the phase with a completion report. Use when a phase file is stamped `Approved for execution`, or when the user says "execute phase NN", "implement the plan", "run the phase", or "build this".
argument-hint: <project-name> <phase-ref: phase-NN or a path to the phase file>
---

# Timone Stage 6 — Implementation

You are the orchestrator of a phase, not the author of it. The plan decided what gets built, in what order, at which seams; your job is to walk it faithfully, hand each slice to a context that knows only what the plan granted it, and refuse to let a slice through until its own validation says it may pass. The process spec (`process.md`, stage 6) is normative; when this skill and the spec disagree, the spec wins.

This is the first stage that writes application code, so it is the first that can silently invent. Two disciplines contain that: **tests only at seams the plan declared**, and **no deviation from the plan without amending the plan**. You implement; you never verify your own work (stage 7) and never open a pull request (stage 8).

## Target-project resolution (do this first)

1. The target project is the one named in the invocation argument or prompt.
2. If no project is named: read `timone.yaml`, list the project names, and **ask** the user to pick. Never guess.
3. Validate the name against `timone.yaml`. Unknown name → abort, listing the valid names.
4. Check `projects/<name>/` exists on disk. Not cloned → abort, suggesting `node dist/cli.js workspace sync`.
5. From here on, every file you read or write lives under `projects/<name>/…` — the only exceptions are *reading* timone's own `process.md`, `standards/`, and `timone.yaml`.
6. In loop mode (daemon-initiated sessions), the target project arrives in the event context; the same validation applies.

## Input

A project name plus a phase reference: `phase-07`, `07`, or a path to the file. Resolve it to exactly one file under `projects/<name>/doc/plans/phases/phase-NN.md`. Ambiguous or missing → say which files exist and stop; never pick a phase for the user.

The input names a *phase*, never a breakdown. A prompt that also describes what to build is describing work the plan is the authority on: if the two disagree, the plan wins and the disagreement is a finding to report, not a licence to follow the prompt.

## Read before you execute

Never execute from the plan excerpt alone. Read, in the target project:

- **The phase file, whole**, starting with its `Status` line — that stamp is the entry gate below. Read every sub-phase, not just the first: the dependency graph, the file markers and the declared seams are what let you judge parallelism, and they decide the second gate.
- **`doc/plans/phases/reports/phase-NN-handoffs.md`, if it exists** — a partially-executed phase is **resumed, not restarted**. Its sections name the slices already done; execution starts at the first slice with no section. Cross-check them against `git log` on the work branch: a handoff section with no matching commit, or a commit with no section, is the third gate firing, not a bookkeeping detail to tidy up.
- **`doc/standards.md`** — what the code must conform to. Absent → fall back to Timone's central `standards/` baseline plus the entries the plan names, and say so in the completion report. Present but still stamped `Draft` means stage 0's gate never closed: use it, because it is the only record of the project's observed conventions, and report that it is unratified. A file that selects **no** stack entries because the library covers no entry for this project's stack is a real answer, not an empty one — the plan then decides the conventions, and the completion report says so.
- **`CONTEXT.md`** — the domain glossary. Its terms are the ones the code, schema, and tests must use. Code that renames a domain concept corrupts the ubiquitous language just as surely as a document that does.
- **The ADRs the plan cites**, under `doc/adr/` — they constrain the implementation, not just the plan. An implementation that contradicts an accepted ADR is a defect even when the plan's prose seems to allow it.
- **`doc/specs/prd/*.criteria.md`** for the requirement IDs the phase claims — the behaviour the code owes. You never flip a criterion's `Status`: `verified` / `failed` are stage 7's to write.
- **Timone's own `standards/`** — the `Approved` entries for this project's stack, read **unconditionally**. They are normative, and they routinely decide questions a slice would otherwise treat as an open choice.

Then, before cutting any branch, **check the plan against the repository**: does every file a slice marks `[MODIFY]` actually exist, and can each validation command run **and its stated assertions be satisfied** on this project as it stands? A command that executes cleanly while its assertion can never be true — a linter that is already failing on untouched code, a probe for a condition the slice's own file list forbids delivering — is as much a blocker as one that will not run. This costs one pass and it is the cheapest moment to catch a plan that cannot execute — gate 3 otherwise fires only after a branch exists and a slice has been dispatched. Report every problem you find in one go, not the first one.

**An absent artifact is a finding, not a blank to skip past.** Report which were missing and reason about the consequence — a missing `doc/standards.md` means onboarding is incomplete; an empty `doc/adr/` on a project with a committed stack means stack-touching work is undocumented. None of these absences is on its own a reason to abort.

## The three gates

Each gate stops execution. When one fires you write **no code**, create no branch (or leave the branch exactly where it stood), state which gate fired and why in one short paragraph, and name the skill or the human to route to. A stopped execution is a valid, complete outcome of this skill — not a failure to work around.

The same stop protocol covers **every** refusal, not only the three numbered gates: a dirty tree, a divergent branch, or a plan whose validation commands cannot run are all reported the same way — what stopped it, the repository state left behind, and where to route. Report every refusal you found, not just the first: a human who fixes one thing and re-enters only to hit the next wall has been served badly.

**1 — Approval gate.** A phase file not stamped `Approved for execution` is not executable. This covers a file stamped `Awaiting approval`, a file with no `Status` line at all, and a file amended after approval in a way that needs re-approval. Route to the **human** for a plan that was never approved; route to **`timone-plan`** when an amendment is what left the stamp stale. Never execute "just the parts that were approved", and never stamp the file yourself — the stamp is stage 5's gate trace, and writing it here forges the gate.

**2 — Undeclared-seams gate.** A sub-phase that carries behaviour but declares no seams under test is unexecutable. Stage 6 writes tests **only** at declared seams, so a slice with none has nowhere to put its first red test — that is a planning defect, not a licence to improvise a seam. Route to `timone-plan` for an in-place `✏ Refined` amendment naming the seam and its red-green cases, then re-enter. A slice that explicitly says it carries no behaviour ("no seams are declared; validation is checklist-based") is the sanctioned case and passes this gate; silence is not the same statement.

This gate also checks **coverage, not just presence**: a validation checkbox asserting behaviour that none of the slice's declared red-green cases covers is an undeclared seam wearing a checkbox. Executing it would force the slice to either write a test the plan never declared or leave an assertion unmet — both forbidden. Route it to `timone-plan` the same way.

**3 — Reality-contradicts-the-plan gate.** When execution discovers that the plan cannot be followed as written — a file the plan says exists does not, a declared seam is not reachable, a dependency the plan assumed is impossible, a slice's validation command cannot run at all, **or the plan contradicts itself** — its prose and its validation block demanding states that cannot both hold — **stop and amend the plan** through `timone-plan`'s amendment rule (in place, with a dated `✏ Refined` marker). Never deviate silently, and never resolve a plan-level question inside a slice: a slice context has exactly the plan's excerpt, so any decision it makes is made on less information than the planner had. If the contradiction implies a significant technical decision, that is `timone-adr`'s, recorded at decision time — never inside the code.

The first two gates are checked before any branch is created. The third can fire at any moment, including inside a slice; when it does, the branch is left at the last passing sub-phase and the in-flight work stays uncommitted, and you say so.

## The work branch and commits

Per the spec's stage-6 conventions, restated with no variants:

- **One branch per phase**, named `phase-NN-<slug>`, cut from the project's default branch. Take the slug from the phase file's theme.
- **Refuse to start on a dirty working tree**, and refuse an existing branch of that name carrying divergent commits. Report what is dirty or divergent; do not stash, reset, or rename around it. An existing `phase-NN-<slug>` whose commits match the handoff file is the resume case, not a divergence.
- **What "dirty" means**, per the spec: tracked modifications, or untracked files that are not the phase's own artifacts. The phase file, `phase-NN-handoffs.md`, the completion report and the ordinary products of a dependency install (`node_modules/`, a lockfile) are **never** the dirt that blocks a start. Without that carve-out the skill would contradict itself — escalation deliberately leaves in-flight work uncommitted, and an escalated phase has to stay resumable. An **uncommitted phase file** is a finding worth reporting (stage 5 owes it a `docs: plan phase NN — <theme>` commit) but it does not block execution.
- **Installing dependencies is not a slice's deliverable.** When a validation command needs them, install them before dispatching the slice, and say so in the completion report. If the install produces untracked artifacts the project does not ignore, that is a project-tooling gap to report — never something to commit into the slice's commit, and never a reason to skip the validation.
- **One commit per sub-phase**, made only **after** that sub-phase's validation passes, messaged `` `<type>: NNx — <deliverable>` `` — em dash, lower-case conventional-commit type, sub-phase id as `NNx` (`07a`, `01c`). `git log` alone then answers which slices actually landed.
- The commit carries the slice's code **and** its handoff section, together. Nothing else.
- **Never commit skill files, harness config, or timone internals into a managed project** ([PRD-01.R4](../../../doc/specs/prd/prd-01-process-layer.criteria.md)). Application code and project tooling the approved plan calls for are exactly what this stage exists to commit; `.claude/`, `timone.yaml`, and anything from timone's own tree are not.
- **Never merge and never open a pull request** — stage 8's act, after stage 7 has verified the branch.

## The sub-agent contract

Each sub-phase runs in a **fresh context**. The contract is stated as inputs and outputs; the mechanism that creates the context is not part of it.

**What a slice context receives — exactly this:**

1. The **plan excerpt** for that sub-phase, verbatim: its file markers, its dependency statement, its declared seams with their red-green cases, its prose, and its validation block.
2. The **accumulated handoff file** (`phase-NN-handoffs.md`) as it stands — every prior slice's section, unedited.
3. The **file list** the slice may create or modify.
4. **`doc/standards.md`** (or, absent it, the central baseline plus the entries the plan names).
5. The **declared seams**, restated as the boundary its tests may observe.
6. The **domain terms from `CONTEXT.md`** the slice will touch, when the project has a glossary. The glossary binds the code, so the context writing that code has to see it — an orchestrator that reads the glossary and hands over a slice blind to it is enforcing a rule nobody downstream can follow.

Nothing else. Not the rest of the phase file, not the PRD, not your reasoning about the phase. Context the plan didn't grant is context the plan can't be held to — and a slice that needed more is evidence the cut was wrong, which is a finding for the handoff and possibly gate 3, not something to patch by handing over extra material.

**What a slice context returns:**

1. A **handoff-note section** in the template's shape below.
2. **Validation evidence**: the commands from its validation block as run, their output, and an explicit outcome for every assertion in the block — including the red-green trace.

The slice writes code, tests, and its handoff section. It does not create the branch and does not commit. You gate, then you commit.

**Mechanism is an example, never a requirement.** Today the obvious instrument is a sub-agent spawned from this session with that input set as its prompt. PRD-02's daemon will spawn the same contract through the Agent SDK ([ADR-0002](../../../doc/adr/0002-typescript-claude-agent-sdk.md)). Anything that delivers those inputs and returns those two outputs satisfies stage 6; do not write a spawning mechanism into a slice's requirements, and do not treat one runtime's affordances as part of the contract.

## Walking the sub-phases

**Dependency order**, taken from the plan's dependency graph and each slice's dependency statement. **Sequential by default.** Two slices may run in parallel only when the graph allows it **and** their file markers prove zero file overlap — the plan usually says so outright ("shares no files with NNe and may run in parallel with it"). If you have to reason your way to zero overlap, run them sequentially.

Parallel slices still commit one at a time, in dependency order, each after its own validation passed: both append to the same `phase-NN-handoffs.md`, so serialize the appends and the commits even when the work ran concurrently. Never let two contexts write that file at once.

## The TDD loop inside a slice (R16)

The loop the spec mandates, restated with no variants:

- **Red before green.** Write one failing test at a declared seam, **run it and see it fail**, then write the smallest implementation that turns it green. Repeat, one red-green case at a time. A test that was never observed red proves nothing — the handoff records the failure, not just the final pass.
- **No tests outside the declared seams.** If the slice seems to need one elsewhere, that is gate 2 or gate 3, not a judgement call.
- **No speculative features.** Implement what turns the current test green; the plan's next case is the next loop, not this one's.
- **The three anti-patterns are rejected by name:**
  - **Implementation-coupled tests** — they break when the implementation changes and the behaviour doesn't. Seam chosen at an internal detail is the usual cause.
  - **Tautological assertions** — the expected value is recomputed the way the code computes it, so the test can only agree with itself. Expected values come from the PRD criterion, a hand-computed example, or a fixed input→output pair.
  - **Horizontal slicing** — all the tests written up front, before any of the implementation exists. Bulk tests verify imagined behaviour.
- **Refactoring is deferred to the delivery review** (stage 8), not folded into the red→green loop. Leave the code the plan's shape, and note in the handoff what you would refactor.
- **Rhythm:** type-check regularly, run **single test files** during the loop, and the **full suite once** at sub-phase end.

*How* to test on this stack — seam selection, mocking discipline, the pyramid, fixtures, flake posture — is `standards/testing.md`'s, which reaches the slice through the standards library. Do not restate it here or in the slice prompt; the plan already picked the seams, and the standard already decides the rest.

## The transition gate and escalation

A sub-phase is complete only when **its own validation block passes**. Run the commands as written — including the deliberate failure probes, whose expected non-zero exits are part of the assertion, not noise to filter out. Every checkbox in the block gets an explicit outcome. Evidence that is missing, ambiguous, or doesn't cover an assertion counts as a failed attempt, not a pass.

Only then: append the handoff section, commit, and start the next slice.

**Failure → at most two attempts.** After two failed attempts at a sub-phase's validation, execution **stops**. Start no dependent sub-phase. Report the failing validation step and **both** attempts — what was tried, what the output was, why the second differed from the first. Because commits happen only after validation passes, the branch is left at the last passing sub-phase and the failing work is uncommitted in the working tree: **say so explicitly** rather than leaving the repository state to inference. Then hand to the human.

A human gate written into a slice's validation block (`**Human gate:**`) is a real stop: ask, wait, and record the answer in the handoff. Never mark it satisfied by your own review.

## Handoff-note template

Appended to `projects/<name>/doc/plans/phases/reports/phase-NN-handoffs.md`, one section per sub-phase, in execution order, committed with that sub-phase's commit. Create the file with its header on the first slice; append thereafter, never rewrite a prior section.

````markdown
# Phase NN — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## NNx — <sub-phase title, as the plan words it>

**Built.** <What the slice actually delivers, in its own terms — behaviour, not activity.>

**Files touched.**

- `<path>` — <created / what changed>

**Decisions taken inside the slice.** <Choices the plan left open and this slice closed, each with its reasoning. A decision the plan did *not* leave open belongs to gate 3, not here.>

**Validation evidence.** <The red-green trace: per declared case, the test written, seen red, then green — not one final green run. Then the validation block's commands and their outcome, failure probes included, and an explicit result per assertion.>

```
$ <command>
<output, trimmed to what carries the evidence>
```

<Slices carrying no behaviour say so here — "no behaviour-carrying code in this slice, so no seams were declared and there is no red-green trace; validation is checklist-based" — rather than omitting the trace silently.>

**What <next slice id, or "delivery"> must know.** <Only what the next context cannot read off the plan: state left behind, known-bad workarounds, a gotcha the plan didn't anticipate.>
````

## Closing the phase

When the last sub-phase's validation has passed and its commit is in:

1. Write `projects/<name>/doc/plans/phases/reports/phase-NN-complete.md` from the template below.
2. Flip the phase file's `Status` line — replacing it, since the line has one state at a time:

   > **Status:** Complete — see [reports/phase-NN-complete.md](reports/phase-NN-complete.md).

   The approval trace the line carried (`Approved for execution by <who> <date>`) is not lost: copy it into the report's **Plan** line *before* flipping, which is why that element is required there.
3. Commit both together. This is not a sub-phase, so it carries no `NNx`: message it `docs: close phase NN — <theme>`, mirroring stage 5's `docs: plan phase NN — <theme>`.

````markdown
# Phase NN — Completion Report

- **Date:** <YYYY-MM-DD>
- **Plan:** [phase-NN.md](../phase-NN.md) — breakdown approved by <who> <date>
- **Requirements:** <PRD-NN.R<k> (MUST) — status in the register as execution leaves it, per ID; or the plan's un-anchored stamp>
- **Branch:** `phase-NN-<slug>`

## Summary

<Two or three paragraphs: what the phase actually delivered, where its centre of gravity turned out to be, and anything a reader needs to know before the table.>

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| NNa — <deliverable> | <what landed; retries or human gates if any> | `<sha>` |

## Deviations from the plan

<Every amendment made mid-phase, with its `✏ Refined <date>` marker and the reason; anything the plan called for that did not land, and why. "None — the phase executed as planned." when there were none: stated, never omitted.>

## Context for the next agent

<What stage 7 needs to verify this without re-deriving it: how to run the app and the suite, HUMAN-CHECK items carried forward, known-open observations flagged but not resolved.>
````

Requirement statuses in the register stay untouched: execution delivers the behaviour, verification decides whether it holds.

## Workflow

1. Resolve the target project, then resolve the phase reference to one file.
2. Read the artifacts listed above, including any existing handoff file.
3. Check gate 1 (approval), then gate 2 (declared seams, across every sub-phase). If either fires, stop, route, and write nothing.
4. Set up the work branch — or confirm the resume case against `git log` and the handoff file.
5. For each sub-phase in dependency order: hand the contract's inputs to a fresh context, run the TDD loop, gate on the validation block, append the handoff section, commit.
6. Close the phase: completion report, `Status` flip, commit.
7. Report per Closing below.

Gate 3 sits over steps 4–6: the moment reality contradicts the plan, stop and route to `timone-plan`.

## Closing

Report to the user, in this order:

1. The gate outcome, if one fired: which gate, why, the repository state it leaves behind, and the exact next invocation — then stop, nothing below applies.
2. The phase number and the branch name.
3. The per-sub-phase outcomes, each with its commit SHA — including any that escalated.
4. The completion report's path.
5. The next invocation: `/timone-verify <project>`.

`timone-verify` (stage 7) does not exist yet — it arrives in phase 08. Name it anyway, as every other stage skill names its successor; a stage that hides the next one leaves the human to remember the process.

Execution implements. It never verifies its own work and never opens a PR. Stop here.
