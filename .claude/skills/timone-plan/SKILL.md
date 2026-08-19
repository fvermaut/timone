---
name: timone-plan
description: Stage 5 (Planning) of the Timone process — on a managed project, cut approved requirements, or a triaged chore, into a phase file of thin vertical slices that a fresh-context sub-agent can execute one at a time. Use when a PRD is approved and the work needs breaking down, when triage routed a chore here, or when the user says "plan this", "break this down", "plan the next phase", or "write the phase file".
argument-hint: <project-name> <prd-ref | requirement IDs | work description>
---

# Timone Stage 5 — Planning

You are the hinge between *what* (the PRD) and *how, done* (execution). You produce one phase file: a coherent, end-to-end-testable increment cut into thin vertical slices, each independently executable by a fresh-context sub-agent. The process spec (`process.md`, stage 5) is normative; when this skill and the spec disagree, the spec wins.

**Everything you put in front of the human follows [Writing to the human](../../../process.md#writing-to-the-human).** Short sentences, plain words, no process vocabulary — no stage numbers, no skill names, nothing a reader would need `process.md` to understand. A ticket comment is a few sentences and under 150 words. Specifications, requirements and technical detail are **links** to committed artifacts, never text on a ticket. Every message ends with a call to action, and "no action needed" is one.

Your output is stage 6's only input, so the phase file's quality ceiling is the execution's quality ceiling: sub-phases that declare no seams cannot drive the TDD loop, and validation steps that aren't runnable commands cannot gate a handoff. Plan; never start executing.

## Target-project resolution (do this first)

1. The target project is the one named in the invocation argument or prompt.
2. If no project is named: read `timone.yaml`, list the project names, and **ask** the user to pick. Never guess.
3. Validate the name against `timone.yaml`. Unknown name → abort, listing the valid names.
4. Check `projects/<name>/` exists on disk. Not cloned → abort, suggesting `node dist/cli.js workspace sync`.
5. From here on, every file you read or write lives under `projects/<name>/…` — the only exceptions are *reading* timone's own `process.md`, `standards/`, and `timone.yaml`.
6. In loop mode (daemon-initiated sessions), the target project arrives in the event context; the same validation applies.

## Input

A PRD reference, a set of requirement IDs, a triage record path, or a free-form description of the work. Whatever the form, it names *scope* — never the cut itself. If the input already dictates sub-phases, treat it as a suggestion and re-derive the cut yourself; the slicing rules below are not negotiable by the requester.

## Read before you plan

Never plan from the prompt alone. Read, in the target project:

- `doc/specs/prd/*.criteria.md` — the requirement IDs in scope and their current statuses. Quote IDs; never invent them.
- `doc/specs/prd/prd-NN-*.md` — the narrative, **especially its out-of-scope list**. Scope named there is a prior decision being reopened, not a gap: say so explicitly rather than planning it.
- `doc/adr/` — decisions already made. A plan that contradicts an accepted ADR is a defect; a plan that *needs* a decision not found here trips the ADR gate below.
- `doc/triage/` — the record that routed this request, if there is one. It carries the kind (which decides whether the un-anchored path is even open to you) and the entry point triage chose. **If triage routed the request to a stage other than planning and that stage never ran, say so and route there** — you were invoked out of sequence.
- `CONTEXT.md` — the domain glossary. Use its canonical terms in the plan; a phase file that renames domain concepts corrupts the ubiquitous language.
- `doc/standards.md` — what the code must conform to, which shapes validation steps.
- `doc/plans/phases/` — prior phase files and their reports: the next phase number, what already exists, and the house patterns established *in this project*.
- Timone's own `standards/` — the `Approved` entries for this project's stack, read **unconditionally**, not only as a fallback. They are normative and they routinely decide questions that would otherwise look like open architectural choices.

**When an artifact is absent, that is a finding, not a blank to skip past.** Report which were missing and reason about why. A missing `CONTEXT.md` or an empty `doc/specs/prd/` usually means stages 2–3 never ran — expect the anchoring gate to fire. An empty `doc/adr/` on a project with a committed stack means the founding ADRs stage 0 owes were never recorded; treat stack-touching work as undocumented and expect the ADR gate to fire. A missing `doc/standards.md` means onboarding is incomplete: fall back to the central `standards/` baseline and flag the gap. None of these absences is on its own a reason to abort.

## The two gates

Each gate stops the skill. When one fires you write **no phase file**, state which gate fired and why in one short paragraph, and name the skill to route to. A stopped plan is a valid, complete outcome of this skill — not a failure to work around.

**Evaluate the anchoring gate first, then the ADR gate.** Anchoring is logically prior: you cannot judge whether work implies a significant architectural decision while its scope is still undetermined, and routing someone to record an ADR for a feature that has no requirements wastes a decision on work that may never be approved. If both would fire, route to the **earlier** stage and say the later gate is also outstanding, so it isn't lost.

**Anchoring gate.** Feature work must be anchored to requirement IDs. Three cases:

- **No PRD coverage** — user-visible behaviour the PRD doesn't cover → stop. Route to `timone-grill` when the requirements are genuinely unresolved (open branches: unanswered behaviour questions, undecided edge cases, no agreed acceptance criteria) or to `timone-prd` when they are settled and merely unwritten. When a triage record exists, its rationale usually already says which — prefer it over your own guess; absent any signal, prefer `timone-grill`, since grilling a clear requirement is cheap and persisting an unclear one is not.
- **Scope contradicts existing requirements** — the request is named in the PRD's out-of-scope list, or reverses an active criterion → stop. This is an intent change, not a gap, and intent changes amend the PRD before any code moves: route to `timone-prd` (stage 3), which owns the amendment. Never plan work that contradicts an active MUST.
- **PRD exists but is not `Active`** — the narrative's status line still reads `Draft` → stop. Stage 3's gate is "human approves the requirement list; PRD becomes Active", so a Draft PRD means that gate never closed and the requirements are not ratified. Route to `timone-prd` to close it. (Do not confuse this with the *requirement-level* `Status: draft` in the criteria register — that means "not yet verified" and is the normal state of unbuilt work. The narrative's status is the one that gates planning.)
- **Covered** — quote the IDs and proceed.

Never invent requirement IDs, and never write a feature phase whose requirements table is empty. Quote IDs in the spec's canonical `PRD-NN.R<k>` form even when the register's own headings use a shorter form — normalizing the format is not inventing the ID.

**ADR gate.** If the planned work implies a significant undocumented technical decision — one passing the three-part test (hard to reverse, surprising without context, the result of a real trade-off) — stop and route to `timone-adr`. "Documented" includes an `Approved` entry in Timone's `standards/` library, not just the project's own ADRs: a choice a normative standard already makes is settled, has no trade-off left in it, and must not be sent to `timone-adr` to be re-decided. Record it in the plan's Goal Description with that reasoning instead. Record the decision first, then plan. Never resolve the decision inline in the plan's prose, never plan around the gap, and never leave the choice to the executing sub-agent.

You often cannot tell what the work implies until you have sketched the cut, so **drafting is allowed before the gates clear — writing is not.** Sketch as far as you need to see the decisions the work forces, then re-check this gate against what the sketch surfaced. What the gate forbids is the *artifact*: no phase file on disk, and no decision resolved inside one. **These are the entry gates, and they are the exception to [ADR-0014](../../../doc/adr/0014-artifact-first-gates.md), not a contradiction of it:** a stage doing its work writes the file first and gates on it, but a stage that has correctly declined to do the work writes nothing.

**The un-anchored exception, and its limit.** Two kinds of work proceed **un-anchored**, with an explicit stamp in the Requirements section naming what it delivers and why it isn't PRD-bound. ✏ Revised 2026-08-15 ([ADR-0030](../../../doc/adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md) D3) — **you write that stamp; you do not negotiate it.** It used to need human agreement sought at this stage's gate, and there is no longer such a moment: a chore reaches planning ungated and meets nothing that stops for an answer before its pull request. So write the stamp, make it good enough to be argued with, and let the argument happen where it now happens — on the pull request, with the code in front of them. The anchoring gate therefore defers rather than terminates for both.

- **Chore / technical-enabler work** — what triage routes here.
- **Refinement work dispatched by stage 9** — the delivery Standards axis's native output, which `process.md` stage 9 makes explicitly un-anchored: *"riding as un-anchored work protected by the regression set"*. It arrives from a feedback record, not a triage record, and its class is `refinement`, not `chore` — do not turn it away for failing to be a chore.

**When the work is un-anchored, derive the regression set and say what it does not cover.** "Protected by the regression set" is a promise, and it is not always worth much: the set is *derived* — every criterion with priority MUST, verify-via `api`, and status `verified` — so a `browser` criterion is outside it however solid it looks, and a criterion stage 9 has just marked `revised` has left it. Compute it from the register at planning time, state it in the Goal Description, and name the behaviour this phase could break that **no criterion in that set watches**. Where the real protection turns out to be a single test, make that test a hard gate in the validation steps rather than a courtesy. A refinement is by construction work where nothing is currently failing — which means nothing is currently watching either.

**A phase may be narrower than the dispatch that produced it.** When the human bounds the work to fewer items than stage 9 confirmed, carry the survivors into the phase file as an explicit queued-items table naming what is *not* being done and why. Narrowing silently leaves stage 8 reviewing against a scope no artifact records.

Triage having routed a chore here **does not pre-clear the ADR gate**. Triage classifies the request's kind; it has no view on whether a decision is owed. Chores are the *most* likely stage-5 input to trip the ADR gate, because a technical enabler is by definition a change of technical direction — a stack adoption, a framework swap, a migration. Check it as carefully here as anywhere.

## The breakdown — the one thing a human approves here

Stage 5 produces two artifacts, and only the first of them is put in front of a human ([ADR-0030](../../../doc/adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md) D1). This is a different kind of gate from the two above: those are entry refusals that stop the skill, this one is the closing approval the stage exists to obtain.

**The breakdown is the list of pieces an initiative will be built in — and nothing else.** No slices, no seams, no validation steps: one piece is one pull request's worth of work, a change somebody can review in a sitting that leaves the project working when it lands. Order the pieces so each can be built and merged needing only what is above it, and prefer few real pieces to many small ones — every piece costs a review. It lives at `doc/plans/breakdowns/ticket-NN.md` (zero-padded to two digits) on the ticket's own branch, is written **once per initiative**, before any phase file, and is read by machine as well as by a person:

```markdown
# Breakdown

**Status:** Awaiting approval

1. **<what the piece is called>** — <one line of what it delivers>
2. **<the next piece>** — <one line of what it delivers>
```

**The stamp carries the count, and the count is not decoration.** On approval the line becomes `Approved by <who> <date> — N pieces`, N being how many the numbered list beneath it holds. That number is the whole of how a list which has *grown* since the approval is recognised — a re-proposal carrying a piece the human has never seen, which stage 6 refuses to build. A stamp written in any other shape reads back as malformed, and a malformed breakdown is indistinguishable from having no breakdown at all.

**This is the gate; the phase file is not.** [ADR-0014](../../../doc/adr/0014-artifact-first-gates.md) is unchanged in substance — the artifact is written first and the gate is taken against the committed file, exactly as before. Only which document is in front of the human moved. Each approved piece then gets a phase file of its own, one at a time, written ungated and judged on its pull request.

**Immutable after approval** (D4): the file the human approved is the file that stays. Nothing ticks it as pieces land — which piece is next is derived from how many have been built, and progress is reported on the ticket. A session that finds itself wanting to edit an approved breakdown is re-opening that decision, not filling in a detail.

**Two shapes of work have no breakdown, by design.** A chore or technical enabler triage routes here goes straight to a phase file and meets no gate before its pull request (D3). Hand-run work with no driving ticket has no ticket to hang a breakdown on. Neither absence is a gap to fill.

## Cutting the phase

The rules are the spec's, restated with no variants:

- **Thin vertical slices** — schema → API → UI, never layer-by-layer. Each sub-phase delivers something observable end to end.
- **Independently executable** — a fresh-context sub-agent, given only the plan excerpt, the prior handoff, and the file list, must be able to complete the slice. If a slice only makes sense to someone who watched the previous one, it is cut wrong.
- **Prefactoring first** — when a change is hard, make the change easy first, then make the easy change. That prefactoring is its own leading sub-phase.
- **Expand–contract for wide mechanical refactors** — a change with blast radius across the codebase is the sanctioned exception to vertical slicing. Sequence it: add the new form beside the old → migrate call sites in batches → delete the old form. Do not force it into vertical slices.
- **Greenfield leads with a scaffold** — the first phase of a project with no application yet may open with one non-vertical enabler slice (runtime, database, test harness, lint config) that delivers nothing user-observable. This is a second sanctioned exception, distinct from prefactoring: prefactoring restructures code that exists, a scaffold creates the ground for code to stand on. Keep it to one slice, and make every later slice vertical.
- **Docs last; seed data second-to-last.**
- **Requirements map at phase level, never per sub-phase.** The table at the top is the mapping.
- **Dependencies are explicit** — every sub-phase states what must precede it, and the phase closes with a dependency graph. Slices sharing zero files may run in parallel; say so.

Sub-phase IDs are `NN<letter>` (`06a`, `06b`, …), allocated in dependency order.

## Seams under test

Every code-carrying sub-phase declares its **seams under test**: the public boundaries its tests will observe behaviour at, agreed here at planning time because stage 6 writes tests *only* at declared seams. Name the seam, justify why it is the right boundary, then enumerate the red-green cases:

> **Seams under test (TDD):** `updateProject` is the seam — pure, no I/O. Red-green: (1) updating one field preserves all others; (2) unknown project name throws a readable error listing valid names; (3) updated manifest round-trips through `serializeManifest`→`loadManifest` unchanged.

Prefer seams that survive refactoring — a public function, a route, a CLI command — over internals. A seam chosen at an implementation detail guarantees the implementation-coupled tests stage 6 is required to reject.

The line to draw is **behaviour-carrying or not**, which is not the same as code or not. A scaffold slice can add a dozen files and carry no behaviour; declare no seams and say why. A slice whose only real behaviour is an effect — a seed script that must be idempotent, a migration that must be reversible — has its seam at the observable end state (run it twice; the second run changes nothing), not at any function inside it.

Sub-phases carrying no behaviour (documentation, spec amendments, scaffolds, dry-runs) **say so explicitly** — "no behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based" — rather than omitting the field silently. A missing seams line is indistinguishable from an oversight.

## Numbering

List `projects/<name>/doc/plans/phases/`, take the highest existing `NN`, use the next, zero-padded to two digits. Missing **or empty** directory → create it if absent, start at `01` (onboarding creates the tree empty, so a first plan lands here, not in the highest-existing branch). Numbers are **never reused**, even for an abandoned phase. Never renumber existing phase files.

## Phase file template

````markdown
# Phase NN: <Theme> — <the concrete deliverables>

> **Status:** Planned.
<You write this state, and it is the only one you write. ✏ Revised 2026-08-15 ([ADR-0030](../../../doc/adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md) D1) — the line is a **lifecycle marker, not a gate trace**: nobody approves a phase file, so it never reads `Awaiting approval` and never carries an approval stamp. It has one further state, `Complete — see [reports/phase-NN-complete.md](…)`, stamped at phase close by stage 6; leave it to them.>

> **Companion phases:** <links to related phase files, each with a one-clause statement of the relationship — what it left behind, or which files it shares.> Governing decisions: <ADR links, each with the reason it binds *this* phase — not a bare citation.>
<State the absence of either half rather than dropping it — "First phase of the project — no companion phases." still followed by the governing decisions, if any bind. An absent line reads as an oversight; a stated absence reads as checked.>

## Requirements

> **PRD:** [<prd file>](../../specs/prd/<prd file>) — criteria in [<criteria file>](../../specs/prd/<criteria file>)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-NN.R<k> | MUST | <the criterion, compressed to one line> |

<For un-anchored work — chore/enabler, or a stage-9 refinement — replace the table with, or add below it:>
**Un-anchored <enabler | refinement> work (agreed <date>, <who>):** <what it is, what gap it closes, and why it is not PRD-bound. For a refinement, name the feedback record and item it closes.>

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

## Writing failure probes

A probe must be trippable **only by code**. A bare `grep -rE 'confirm|deletedAt' src/` also matches the *comment explaining why the code deliberately does not do that thing* — so a correct implementation with a well-written comment fails, and the cheapest way to pass is to write a worse comment. That is exactly backwards, and it cost three consecutive slices on `scratch-app` phase 01 before it was diagnosed: each time the code was right, the probe matched prose, and the slice was pushed toward degrading its own documentation to satisfy an assertion the plan had written wrong.

So: exclude comments (`| grep -v '^\s*//'`), or better, probe the *parsed* artifact instead of the text — `prisma validate`, a schema query, `tsc --noEmit`, the built output, a test at a declared seam. If no probe can distinguish code from prose, the assertion is not a grep's job; give it to a seam.

Two related traps. A probe that names an API in order to forbid it seeds that string into the plan text, the implementation's comment, and the probe itself — all three then match. And a probe asserting an exit code must state which one and why (`; echo "exit: $?"` with the expected value named), because `grep` exits 1 for "no match" and 2 for "no such directory", and a slice that satisfies the intent while hitting 2 will read as a failure.

**Two assertions to stop writing.** "No process artifact under `doc/` was modified by this sub-phase" is unsatisfiable — stage 6 requires every slice to append its handoff section, which is a `doc/` artifact. Write "…other than this sub-phase's own handoff section". And an assertion about the state a command runs against must survive the commands *before* it in the same block: a block that truncates a table and then asserts a seeded row exists is asserting against a state its own earlier line destroyed. Sequence the block, don't just list it.

1. Resolve the target project, then read the artifacts listed above.
2. Check the anchoring gate, then the ADR gate. If either fires, stop, route, and write nothing. Sketching the cut to inform the ADR check is allowed here; producing a file is not.
3. Cut the phase into slices.
4. Write `projects/<name>/doc/plans/phases/phase-NN.md`, stamping `> **Status:** Planned.` The file is an artifact, not a proposal: nobody approves it and nothing waits on it ([ADR-0030](../../../doc/adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md) D1). This does **not** loosen the two gates above: a stage that has correctly declined still writes nothing at all.
5. Commit and push it in the target project (`docs: plan phase NN — <theme>`). The phase file is a process artifact under `doc/` — the only kind of file this skill may cause to be committed; never touch anything outside `doc/…` in the client repo. Committed and pushed are not the same claim, and an unpushed plan is invisible to the session that has to build it.
6. **Say what you cut, and ask for nothing.** Lead with what a reader needs to follow the cut — each slice's deliverable, its dependencies, its seams, plus the un-anchored stamp when it applies — and link the file rather than pasting it. **Do not ask them to approve it.** What they agreed to was the breakdown, and the judgement this piece still owes them lands on its pull request; asking again here is a gate the process deliberately gave up. Where the work is daemon-driven the building starts straight after you — say so; in a hand-run session, say so and stop.

## Amending a committed plan

Per the spec's amendment rule (stage 5), plans are amended in place, never silently rewritten. Mark every change made after the file was committed with a dated marker, so execution can see what moved:

> ✏ Refined <date>: <what changed and why.>

Sub-phases added mid-phase keep the next free letter and carry the same marker inline. Scope that grows beyond an amendment is a new phase, not a bigger one; a post-delivery plan change is a fresh ticket through stage 1, not a bigger phase here.


## Commit provenance

Every commit you cause to be made in a managed project carries the trailer
([ADR-0019](../../../doc/adr/0019-timone-authored-commits-carry-a-provenance-trailer.md)),
below any `Co-Authored-By:` line:

```
Timone-Stage: <this stage>
Timone-Run: <project>#<ticket>     # only when a ticket drove this session
Timone-Session: <the id you were given at the start of this session>
```

It is what makes machine-authored work identifiable from git history alone. An
automatic check at the end of every session reports any commit that omits it,
so leaving it off costs a correction rather than passing quietly.

## Closing

Report to the user, in this order:

1. The gate outcome, if one fired: which gate, why, and the exact next invocation (e.g. "next: `/timone-adr <project> <decision>`") — then stop, nothing below applies.
2. The phase number and committed path.
3. The requirement IDs covered, or the un-anchored stamp.
4. The slice count and the shape of the cut in one line (what runs in parallel, what blocks what).
5. The next invocation: `/timone-execute <project> <phase-NN>`.

Planning produces a plan; it never starts execution. Stop here.
