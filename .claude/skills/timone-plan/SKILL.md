---
name: timone-plan
description: Stage 5 (Planning) of the Timone process — on a managed project, cut approved requirements, or a triaged chore, into a phase file of thin vertical slices that a fresh-context sub-agent can execute one at a time. Use when a PRD is approved and the work needs breaking down, when triage routed a chore here, or when the user says "plan this", "break this down", "plan the next phase", or "write the phase file".
argument-hint: <project-name> <prd-ref | requirement IDs | work description>
---

# Timone Stage 5 — Planning

You are the hinge between *what* (the PRD) and *how, done* (execution). You produce one phase file: a coherent, end-to-end-testable increment cut into thin vertical slices, each independently executable by a fresh-context sub-agent. The process spec (`process.md`, stage 5) is normative; when this skill and the spec disagree, the spec wins.

Your output is stage 6's only input, so the phase file's quality ceiling is the execution's quality ceiling: sub-phases that declare no seams cannot drive the TDD loop, and validation steps that aren't runnable commands cannot gate a handoff. Plan; never start executing.

## Target-project resolution (do this first)

1. The target project is the one named in the invocation argument or prompt.
2. If no project is named: read `timone.yaml`, list the project names, and **ask** the user to pick. Never guess.
3. Validate the name against `timone.yaml`. Unknown name → abort, listing the valid names.
4. Check `projects/<name>/` exists on disk. Not cloned → abort, suggesting `node dist/cli.js workspace sync`.
5. From here on, every file you read or write lives under `projects/<name>/…` — the only exceptions are *reading* timone's own `process.md`, `standards/`, and `timone.yaml`.
6. In loop mode (daemon-initiated sessions), the target project arrives in the event context; the same validation applies.

## Input

A PRD reference, a set of requirement IDs, a triage record path, or a free-form description of the work. Whatever the form, it names *scope* — never a breakdown. If the input already dictates sub-phases, treat it as a suggestion and re-derive the cut yourself; the slicing rules below are not negotiable by the requester.

## Read before you plan

Never plan from the prompt alone. Read, in the target project:

- `doc/specs/prd/*.criteria.md` — the requirement IDs in scope and their current statuses. Quote IDs; never invent them.
- `doc/adr/` — decisions already made. A plan that contradicts an accepted ADR is a defect; a plan that *needs* a decision not found here trips the ADR gate below.
- `CONTEXT.md` — the domain glossary. Use its canonical terms in the plan; a phase file that renames domain concepts corrupts the ubiquitous language.
- `doc/standards.md` — what the code must conform to, which shapes validation steps.
- `doc/plans/phases/` — prior phase files and their reports: the next phase number, what already exists, and the house patterns established *in this project*.

## The two gates — both terminal

Each gate stops the skill. When one fires you write **no phase file**, state which gate fired and why in one short paragraph, and name the skill to route to. A stopped plan is a valid, complete outcome of this skill — not a failure to work around.

**ADR gate.** If the planned work implies a significant undocumented technical decision — one passing the three-part test (hard to reverse, surprising without context, the result of a real trade-off) — stop and route to `timone-adr`. Record the decision first, then plan. Never resolve the decision inline in the plan's prose, never plan around the gap, and never leave the choice to the executing sub-agent.

**Anchoring gate.** Feature work must be anchored to requirement IDs. If the scope is user-visible behaviour with no PRD coverage, stop and route to `timone-grill` (requirements unclear) or `timone-prd` (requirements clear but unpersisted). Never invent requirement IDs, and never write a feature phase whose requirements table is empty.

Chore / technical-enabler work — what triage routes here — is the sanctioned exception: it proceeds **un-anchored**, with an explicit stamp in the Requirements section naming what it enables and why it isn't PRD-bound. The stamp needs human agreement, which is sought at the same gate as the breakdown itself.

## Cutting the phase

The rules are the spec's, restated with no variants:

- **Thin vertical slices** — schema → API → UI, never layer-by-layer. Each sub-phase delivers something observable end to end.
- **Independently executable** — a fresh-context sub-agent, given only the plan excerpt, the prior handoff, and the file list, must be able to complete the slice. If a slice only makes sense to someone who watched the previous one, it is cut wrong.
- **Prefactoring first** — when a change is hard, make the change easy first, then make the easy change. That prefactoring is its own leading sub-phase.
- **Expand–contract for wide mechanical refactors** — a change with blast radius across the codebase is the sanctioned exception to vertical slicing. Sequence it: add the new form beside the old → migrate call sites in batches → delete the old form. Do not force it into vertical slices.
- **Docs last; seed data second-to-last.**
- **Requirements map at phase level, never per sub-phase.** The table at the top is the mapping.
- **Dependencies are explicit** — every sub-phase states what must precede it, and the phase closes with a dependency graph. Slices sharing zero files may run in parallel; say so.

Sub-phase IDs are `NN<letter>` (`06a`, `06b`, …), allocated in dependency order.

## Seams under test

Every code-carrying sub-phase declares its **seams under test**: the public boundaries its tests will observe behaviour at, agreed here at planning time because stage 6 writes tests *only* at declared seams. Name the seam, justify why it is the right boundary, then enumerate the red-green cases:

> **Seams under test (TDD):** `updateProject` is the seam — pure, no I/O. Red-green: (1) updating one field preserves all others; (2) unknown project name throws a readable error listing valid names; (3) updated manifest round-trips through `serializeManifest`→`loadManifest` unchanged.

Prefer seams that survive refactoring — a public function, a route, a CLI command — over internals. A seam chosen at an implementation detail guarantees the implementation-coupled tests stage 6 is required to reject.

Sub-phases carrying no code (documentation, spec amendments, dry-runs) **say so explicitly** — "no code in this sub-phase, so no seams are declared; validation is checklist-based" — rather than omitting the field silently. A missing seams line is indistinguishable from an oversight.

## Numbering

List `projects/<name>/doc/plans/phases/`, take the highest existing `NN`, use the next, zero-padded to two digits. Missing directory → create it, start at `01`. Numbers are **never reused**, even for an abandoned phase. Never renumber existing phase files.

## Phase file template

````markdown
# Phase NN: <Theme> — <the concrete deliverables>

> **Status:** Approved for execution by <who> <date>.
<You write this state, never `Awaiting approval` — approval precedes the write. The line has a third state, `Complete — see [reports/phase-NN-complete.md](…)`, stamped at phase close by stage 6; leave it to them.>

> **Companion phases:** <links to related phase files, each with a one-clause statement of the relationship — what it left behind, or which files it shares.> Governing decisions: <ADR links, each with the reason it binds *this* phase — not a bare citation.>

## Requirements

> **PRD:** [<prd file>](../../specs/prd/<prd file>) — criteria in [<criteria file>](../../specs/prd/<criteria file>)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-NN.R<k> | MUST | <the criterion, compressed to one line> |

<For chore/enabler work only — replace the table with, or add below it:>
**Un-anchored enabler work (agreed <date>):** <what it is, what gap it closes, and why it is not PRD-bound. Name the human who agreed.>

## Goal Description

<Two to four paragraphs: what the prior phase left, why *these* items are grouped into one phase, and why now. Record here any decision taken during planning that did not clear the ADR bar — state the significance-test reasoning that kept it out of an ADR, so the omission is deliberate and legible rather than an oversight.>

## Context & Prerequisites

- **<Prior phase>** — <the exact files it produced that this phase touches.>
- **`<spec or standard>`** — <what it constrains here.>
- **<Existing state / fixtures>** — <what is already in place, including known-bad state this phase must work around or fix.>

## Sub-phases

### Sub-phase NNa: <the deliverable, not the activity>

**[NEW FILE]** `<path>` — <what it contains>
**[MODIFY]** `<path>` — <the change, specific enough that a fresh-context agent needs no further discovery>

**Seams under test (TDD):** <seam + red-green cases — or the explicit no-code statement.>

> <Dependency statement: "No dependency on other sub-phases." or "Sub-phase NNa must be complete before starting this sub-phase (<reason>).">

<Prose or bullets specifying the behaviour precisely enough to hand off. Inline signatures, schemas, or command shapes where the exact form matters.>

#### Agent Validation Steps

```bash
<copy-pasteable commands, including deliberate failure probes with `; echo "exit: $?"`>
```

- [ ] <Observable assertion, not "it works">
- [ ] <For TDD slices: red→green evidence in the handoff, not just a final green run>
- [ ] **Human gate:** <who reviews what, for slices that need it>

---

<repeat per sub-phase; documentation last>

## Dependency graph

```
NNa → (none)        <one-clause purpose>
NNb → NNa           <one-clause purpose>
NNc → NNa, NNb      <one-clause purpose>
```
````

## Workflow

1. Resolve the target project, then read the artifacts listed above.
2. Check both gates. If either fires, stop, route, and write nothing.
3. Cut the phase and draft the breakdown.
4. **Present the breakdown to the user and iterate until approved.** The stage gate is explicit: the human approves the breakdown **before** any file is written. Present the sub-phase list with each slice's deliverable, its dependencies, and its seams — enough to judge the cut — plus the un-anchored stamp when it applies. Do not write the file to "show" the plan; the file appearing before approval defeats the gate.
5. Write `projects/<name>/doc/plans/phases/phase-NN.md`, stamping `> **Status:** Approved for execution by <who> <date>.`
6. Commit it in the target project (`docs: plan phase NN — <theme>`). The phase file is a process artifact under `doc/` — the only kind of file this skill may cause to be committed; never touch anything outside `doc/…` in the client repo.

## Amending an approved plan

Plans are amended in place, never silently rewritten. Mark every change made after approval with a dated marker, so execution can see what moved:

> ✏ Refined <date>: <what changed and why.>

Sub-phases added mid-phase keep the next free letter and carry the same marker inline. Scope that grows beyond an amendment is a new phase, not a bigger one.

## Closing

Report to the user, in this order:

1. The gate outcome, if one fired: which gate, why, and the exact next invocation (e.g. "next: `/timone-adr <project> <decision>`") — then stop, nothing below applies.
2. The phase number and committed path.
3. The requirement IDs covered, or the un-anchored stamp.
4. The slice count and the shape of the cut in one line (what runs in parallel, what blocks what).
5. The next invocation: `/timone-execute <project> <phase-NN>`.

Planning produces a plan; it never starts execution. Stop here.
