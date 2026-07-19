# Phase 06: Planning — `timone-plan`

> **Status:** Complete — see [reports/phase-06-complete.md](reports/phase-06-complete.md). Dry-run gate passed by fvermaut 2026-07-19.

> **Companion phases:** [Phase 02](phase-02.md) (skill authoring conventions — the mandatory target-project resolution preamble), [Phase 05](phase-05.md) (the spec-first-then-skill ordering this phase reuses, and the stage-1 routing table that sends chores here). Governing decision: [ADR-0007](../../adr/0007-sessions-at-timone-root.md) — sessions run at the timone root; the skill resolves a target project and writes only under `projects/<name>/`.

## Requirements

> **PRD:** [prd-01-process-layer.md](../../specs/prd/prd-01-process-layer.md) — criteria in [prd-01-process-layer.criteria.md](../../specs/prd/prd-01-process-layer.criteria.md)

| ID         | Priority | Requirement (one line)                                                                                                             |
| ---------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| PRD-01.R10 | MUST     | Plan skill: phase file with vertical-slice sub-phases, dependencies, file markers, runnable validation commands, declared seams under test; requirements listed at phase level; human approves the breakdown before the file is written; ADR gate fires on undocumented significant decisions |

No un-anchored enabler work in this phase — R10 is pure-document, like phase 02 and phase 03. No code is written, so no seams under test are declared at sub-phase level; validation is checklist- and dry-run-based.

## Goal Description

Planning is stage 5 — the hinge between "what" (PRD) and "how, done" (execution). It converts an approved PRD, or a triaged chore, into a phase file whose sub-phases are thin vertical slices, each independently executable by a fresh-context sub-agent. Its output is the direct input to stage 6, so the phase file's quality ceiling *is* the execution's quality ceiling: sub-phases that don't declare seams under test cannot drive the TDD loop (R16), and validation steps that aren't copy-pasteable commands cannot gate a sub-agent handoff.

**The bootstrap.** Phases 01–05 were planned by hand at the timone root. That five-file corpus is this skill's reference material — the skill's inlined template is a distillation of what phase-05.md already does, which the corpus analysis identified as the most mature example. Per fvermaut's decision at planning time, **`timone-plan` is scoped to managed projects only** (standard target-project resolution preamble, like the other five stage skills); it does *not* gain a meta scope for Timone's own phases. Timone's phases stay hand-written. The dual-scope alternative — the `timone-handover` precedent, which would have let us plan phase 07 with the skill itself — was considered and declined: consistency with the other stage skills wins over the dogfooding convenience, and a meta scope would put timone-internal paths inside a skill that is otherwise strictly `projects/<name>/`-bound.

**Approval-gate representation (decided 2026-07-19, with fvermaut):** the `> **Status:**` blockquote is written at file creation and carries the phase's whole lifecycle — `Awaiting approval.` → `Approved for execution by <who> <date>.` → `Complete — see reports/phase-NN-complete.md`. Today the gate has no in-file trace at all; it exists only retroactively as a line in the completion report, which makes "was this breakdown ever approved?" unanswerable from the artifact. One field covering all three states was chosen over a dedicated `## Approval` section (more explicit, but adds a section to every phase file and diverges from the five existing ones) and over leaving the gate conversational (zero churn, but no audit trail). This is a conventions amendment to `process.md`, not an ADR: it passed the significance test's trade-off part but not *hard to reverse* — same reasoning as phase 05's triage-record convention. **This file adopts the convention already**, as its own first demonstration.

Note the ordering rule inherited from phase 05: the spec is normative and the skill restates it, so the `process.md` amendment (06a) lands **before** the skill is written (06b).

## Context & Prerequisites

- **Phase 02** — `.claude/skills/README.md` conventions: frontmatter rules, the mandatory six-step target-project resolution preamble (copy it verbatim), and the `doc/`-only commit constraint.
- **Phase 05** — `.claude/skills/timone-triage/SKILL.md` routes `chore / technical enabler → timone-plan, un-anchored`. That routing already names this skill; 06b makes it real. `timone-triage` also models the house style this skill should match (routing table, inline template, closing section).
- **`process.md`** — stage 5's note is normative: vertical slices, docs last / seed data second-to-last, requirements map at phase level, seams under test declared at planning time, prefactoring first, expand–contract for wide mechanical refactors, PRD anchoring, and the ADR gate.
- **Reference corpus** — `doc/plans/phases/phase-01.md` … `phase-05.md` plus `reports/`. `phase-05.md` is the most mature example and the basis for the inlined template; `phase-03.md` contributes the `> ✏ Refined <date>:` in-file amendment marker.
- **Fixtures** — `scratch-app` has a full PRD pair (`prd-01-todo-list.md` + `.criteria.md`), `CONTEXT.md`, and `doc/adr/0001-*`, so it is the only fixture that can exercise the happy path. `scratch-app-2` has ADRs and a triage record but **no PRD** — the negative case. `scratch-existing` has a triage record (`001-migrate-todo-controller-to-typescript.md`) that is a chore *and* a wide mechanical refactor — it exercises un-anchored stamping and expand–contract in one run.

## Sub-phases

### Sub-phase 06a: process-spec amendment — phase-file required elements + Status lifecycle

**[MODIFY]** `process.md` — two touches, both in the stage-5 material: (1) the stage-5 note gains a compact statement of what a phase file must carry (requirements table at phase level; per sub-phase: file markers, dependency statement, declared seams under test for code slices, copy-pasteable validation commands); (2) the phase-file `Status` lifecycle is stated normatively — written at creation as `Awaiting approval`, flipped to `Approved for execution by <who> <date>` at the stage-5 gate, then to `Complete — see <report>` at phase close. The stages-at-a-glance row for stage 5 gains nothing; its gate wording already covers the human approval.

Keep `process.md` thin: it states the *required elements and the gate*, not the document layout. The full fenced section template lives in the skill (06b) — the same division already used for PRDs, where `process.md` carries the ID rules and `timone-prd` carries the templates.

> No dependency on other sub-phases.

#### Agent Validation Steps

- [ ] Stage-5 note states the required elements of a phase file and the three-state `Status` lifecycle
- [ ] `process.md` gained no document-layout/section template (that belongs in the skill)
- [ ] No other stage's text altered; the artifact-conventions tree is unchanged (`doc/plans/phases/phase-NN.md` is already there)

---

### Sub-phase 06b: `timone-plan` skill

**[NEW FILE]** `.claude/skills/timone-plan/SKILL.md`

> Sub-phase 06a must be complete before starting this sub-phase (spec wins; skill restates it).

Per `process.md` stage 5, with the standard target-project resolution preamble from `.claude/skills/README.md` — **managed projects only**, no meta scope. Input: a PRD reference, a set of requirement IDs, a triage record, or a free-form description of the work to plan. The skill:

1. **Reads what exists** before planning anything: the project's `doc/specs/prd/*.criteria.md` (for the requirement IDs and their statuses), `doc/adr/`, `CONTEXT.md`, `doc/standards.md`, and prior `doc/plans/phases/` — both for numbering and for the house patterns already established in *that* project.
2. **Fires the ADR gate.** If the planned work implies a significant undocumented technical decision, it **stops**, states the decision and why it clears the significance test, and routes to `timone-adr` — no phase file is written. This is a terminal outcome, like triage's "no ADR" outcome; the skill does not plan around the gap or record the decision inline.
3. **Fires the anchoring gate.** Feature work with no PRD coverage → stop and route to `timone-grill` / `timone-prd`; do not invent requirement IDs. Chore/enabler work → proceed, but the un-anchored stamp is explicit and needs human agreement in the same gate as the breakdown.
4. **Cuts the phase into thin vertical slices** per the stage-5 rules: schema → API → UI, never layer-by-layer; prefactoring first when it makes the change easy; wide mechanical refactors sequenced expand–contract (add new form beside old → migrate call sites in batches → delete old form) as the sanctioned exception to vertical slicing; docs last, seed data second-to-last. Each sub-phase must be independently executable by a fresh-context sub-agent.
5. **Declares seams under test** per code-carrying sub-phase — the public boundaries tests will observe behaviour at, named with the red-green cases, agreed at planning time because stage 6 writes tests *only* at declared seams. Sub-phases with no code say so explicitly rather than omitting the field silently.
6. **Presents the breakdown and iterates until approved.** The stage gate is explicit: the human approves the breakdown **before** any file is written. Only then write the file, with `> **Status:** Awaiting approval.` replaced by the approval stamp per 06a.
7. **Writes** `projects/<name>/doc/plans/phases/phase-NN.md` — `NN` allocated by scanning the directory for the highest existing number, zero-padded to two digits, never reused. Commit as a `doc/` process artifact.

The skill carries the full phase-file template inline as a fenced markdown block (house style — no bundled reference files), distilled from `phase-05.md`: title, Status blockquote, companion-phases blockquote, `## Requirements` (PRD pointer + ID table + optional un-anchored stamp), `## Goal Description`, `## Context & Prerequisites`, `## Sub-phases` (per-slice: heading, `**[NEW FILE]**`/`**[MODIFY]**` file markers with inline change description, dependency blockquote, seams-under-test line, `#### Agent Validation Steps` = fenced bash + `- [ ]` assertions), `## Dependency graph`. It also documents the `> ✏ Refined <date>:` marker for mid-phase amendments (phase-03 precedent) — plans are amended in place, never silently rewritten.

Closing: report the phase number and path, the requirement IDs covered (or the un-anchored stamp), the slice count, and the next invocation — `timone-plan` plans; it never starts execution.

#### Agent Validation Steps

- [ ] Frontmatter + targeting per `.claude/skills/README.md` (`argument-hint` starts with `<project-name>`, then the PRD ref / requirement IDs / work description)
- [ ] Stage-5 rules restated with no variants: vertical slices, prefactoring, expand–contract, docs last, seed data second-to-last, phase-level requirement mapping
- [ ] ADR gate and anchoring gate are both **terminal** outcomes that write no file, each naming the skill to route to
- [ ] Approval-before-write is stated as the gate, not as a suggestion
- [ ] Inline template carries every section of the 06a required-elements list, including the `Status` lifecycle and per-sub-phase seams
- [ ] Phase numbering: scan-highest-then-increment, zero-padded to two, never reused

---

### Sub-phase 06c: Dry-run — four planning requests

> Sub-phases 06a and 06b must be complete before starting this sub-phase.

From a fresh timone-root session, per R10's verification hint (plan a small feature; then a feature implying a stack choice, to confirm the ADR gate fires). Four fresh-context runs:

1. **Happy path — feature with PRD coverage** on `scratch-app`: plan a small increment of the existing todo-list PRD (e.g. "let users reorder todos by drag and drop"). Expect: requirement IDs quoted from `prd-01-todo-list.criteria.md` at phase level, vertical slices (persistence → API → UI, not layer-by-layer), declared seams with red-green cases, copy-pasteable validation commands, docs-last ordering, and the breakdown presented for approval **before** the file appeared.
2. **ADR gate** on `scratch-app`: plan work implying an undocumented significant decision (e.g. "make the todo list collaborative in real time" — implies a transport choice, websockets vs SSE vs polling, that no ADR covers). Expect: the skill **stops**, names the decision, routes to `timone-adr`, and writes **no** phase file.
3. **Anchoring gate** on `scratch-app-2`: plan a feature there — it has ADRs and a triage record but no PRD. Expect: stop and route to `timone-grill`/`timone-prd`; no invented requirement IDs, no phase file.
4. **Chore, un-anchored + expand–contract** on `scratch-existing`: plan from the existing triage record `doc/triage/001-migrate-todo-controller-to-typescript.md`. Expect: explicit un-anchored stamp with human agreement sought at the gate, and the wide mechanical refactor sequenced expand–contract rather than forced into vertical slices.

Then: `git log --stat` in the touched scratch repos — only `doc/…` paths, no harness files; and confirm the two gate runs (2, 3) left no phase file behind.

#### Agent Validation Steps

- [ ] Run 1 produces a phase file matching the 06a required elements; approval was sought before the write, visibly, in the transcript
- [ ] Runs 2 and 3 are terminal: no phase file written, correct routing named in each
- [ ] Run 4 stamps un-anchored and sequences expand–contract, not vertical slices
- [ ] Validation commands in the produced plans are actually copy-pasteable against the fixture (spot-check by running one)
- [ ] Only `doc/…` paths committed in the fixture repos
- [ ] **Human gate:** fvermaut reviews the produced phase files and the two gate transcripts before this sub-phase is marked done

---

### Sub-phase 06d: Documentation

**[MODIFY]** `README.md`
**[MODIFY]** `doc/specs/prd/prd-01-process-layer.criteria.md` — flip R10 to `verified` once 06c's gate passes.

> All prior sub-phases must be complete before starting this sub-phase.

Add `/timone-plan <project-name> <prd-ref | requirement-ids | work description>` to the "Working with Timone" command list; update Status.

#### Agent Validation Steps

- [ ] Documented invocation matches actual behavior; links resolve
- [ ] R10 status flipped only after the 06c human gate passed

## Dependency graph

```
06a → (none)      process.md: phase-file required elements + Status lifecycle (spec first)
06b → 06a         timone-plan skill
06c → 06a, 06b    dry-run: 4 runs (happy path, ADR gate, anchoring gate, chore), human gate
06d → 06c         docs last + R10 → verified
```
