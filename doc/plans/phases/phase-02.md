# Phase 02: Stage Skills at the Root — the Document Trio

> **Status:** Planned. Breakdown approved by fvermaut on 2026-07-19.

> **Companion phases:** [Phase 01](phase-01.md) (process spec, manifest, workspace sync — complete). Governing decision: [ADR-0007](../../adr/0007-sessions-at-timone-root.md) — sessions run at the timone root; skills resolve a target project.

## Requirements

> **PRD:** [prd-01-process-layer.md](../../specs/prd/prd-01-process-layer.md) — criteria in [prd-01-process-layer.criteria.md](../../specs/prd/prd-01-process-layer.criteria.md)

| ID         | Priority | Requirement (one line)                                                  |
| ---------- | -------- | ----------------------------------------------------------------------- |
| PRD-01.R4  | MUST     | Skills invocable from timone-root sessions; target-project resolution; client repos stay clean |
| PRD-01.R7  | MUST     | Grill skill — requirements interview, generalized                        |
| PRD-01.R8  | MUST     | PRD skill — two-file pair with stable IDs                                |
| PRD-01.R9  | MUST     | ADR skill — three-part test, supersede flow                              |
| PRD-01.R19 | SHOULD   | Domain glossary maintenance (inside the grill skill)                     |

## Goal Description

Phase 01 gave Timone its written process and workspace. This phase makes the first three stages *runnable*: the document trio — grill (requirements discovery), PRD (requirements), ADR (architecture) — as timone project-level skills under `.claude/skills/`, all following one targeting convention: the session lives at the timone root, the skill resolves which managed project it operates on (explicit in human prompts, implicit from events later), validates it against `timone.yaml`, and touches only `projects/<name>/…`.

These three are chosen first because they are pure-document skills with no runtime dependencies — they exercise the targeting convention, the process spec, and the artifact conventions end-to-end without needing the execute/verify machinery.

No code is written in this phase, so no seams under test are declared; validation is checklist- and dry-run-based. The first TDD workout comes with the daemon/execute work.

---

## Context & Prerequisites

- **Phase 01** — process spec (`process.md`), manifest loader, `workspace sync`; completion report at [reports/phase-01-complete.md](reports/phase-01-complete.md).
- **Source material:** `tmp/skills/poc-grill-me/SKILL.md` and `tmp/skills/poc-to-prd/SKILL.md` (behavioral lineage — de-PoC them; the other `tmp/skills/*` are off-limits). `process.md` stages 2–4 are the normative spec.

---

## Sub-phases

### Sub-phase 02a: Skill conventions & targeting

**[NEW FILE]** `.claude/skills/README.md`

The authoring conventions every `timone-*` skill follows:

- **Target-project resolution (the convention from ADR-0007):** accept the project name in the invocation argument; if absent, list manifest projects and ask. Validate against `timone.yaml`; abort with a clear message if unknown or not cloned (suggest `workspace sync`). All subsequent paths are `projects/<name>/…`.
- Frontmatter rules (name `timone-<stage>`, description with trigger phrases, argument-hint naming the target project).
- Each skill states which process stage it owns and defers to `process.md` on conflict.
- No client-specific content, ever; artifact paths per the process spec's conventions section.

#### Agent Validation Steps

- [ ] README covers: targeting resolution, frontmatter rules, process-spec deference, artifact conventions
- [ ] The resolution steps are copy-pasteable into any skill without adaptation

---

### Sub-phase 02b: Root session context — `CLAUDE.md`

**[NEW FILE]** `CLAUDE.md` (timone repo root)

> Sub-phase 02a must be complete before starting this sub-phase.

Standing context for every session at the timone root: what Timone is (one paragraph), pointer to `process.md` as the process authority, the manifest + `projects/` layout, the target-project convention, and the rule that client repos receive only process artifacts (`doc/`, `CONTEXT.md`) — never harness files.

#### Agent Validation Steps

- [ ] Under one page; links resolve; consistent with ADR-0007 and the skills README

---

### Sub-phase 02c: `timone-grill` skill

**[NEW FILE]** `.claude/skills/timone-grill/SKILL.md`

> Sub-phase 02a must be complete before starting this sub-phase.

Port `poc-grill-me`, generalized per `process.md` stage 2: target-project resolution instead of the hardcoded PoC list; one question at a time with a recommended answer; codebase-answerable questions answered from `projects/<name>` code; conclusion = decisions summary + risks + handoff suggestion to `timone-prd`. Adds **glossary maintenance (R19)**: challenge terms conflicting with `projects/<name>/CONTEXT.md`, sharpen fuzzy terms, write resolved terms immediately (create the file lazily; glossary only, no implementation detail).

#### Agent Validation Steps

- [ ] Frontmatter + targeting per 02a conventions; no PoC/customer residue
- [ ] Covers all R7 criterion elements and the R19 glossary behaviors
- [ ] **Human dry-run:** run against a scratch managed project; interview behaves per R7, glossary updates land in the scratch `CONTEXT.md`

---

### Sub-phase 02d: `timone-prd` skill

**[NEW FILE]** `.claude/skills/timone-prd/SKILL.md`

> Sub-phase 02a must be complete before starting this sub-phase.

Port `poc-to-prd` per `process.md` stage 3: two-file pair under `projects/<name>/doc/specs/prd/`, stable `PRD-NN.R<k>` IDs, MUSTs need Given/When/Then + verification hint, requirement list approved before files are written, lazy one-page product overview (confirmed before saving). Include the baseline hook: user-facing functionality gets accessibility acceptance criteria (R20 linkage — the register template gains an accessibility prompt).

#### Agent Validation Steps

- [ ] Frontmatter + targeting per 02a; templates match the process spec's artifact conventions
- [ ] Strictness rules present (MUST testability, stable-ID rules, approval-before-write)
- [ ] Accessibility-criteria prompt present for user-facing requirements
- [ ] **Human dry-run:** produce a PRD pair on the scratch project from a mock grill conclusion; inspect against R8

---

### Sub-phase 02e: `timone-adr` skill

**[NEW FILE]** `.claude/skills/timone-adr/SKILL.md`

> Sub-phase 02a must be complete before starting this sub-phase.

New skill per `process.md` stage 4: three-part significance test (hard to reverse / surprising without context / real trade-off — all three or no ADR); Status/Date/Context/Decision/Consequences format; next-number allocation under `projects/<name>/doc/adr/`; supersede flow (new record, old status flipped with cross-link, history never edited); the standalone-at-decision-time rule stated explicitly.

#### Agent Validation Steps

- [ ] Frontmatter + targeting per 02a; three-part test is the gate, with a "no ADR" outcome
- [ ] **Dry-run:** create one ADR then supersede it in the scratch project; both files correct per R9

---

### Sub-phase 02f: End-to-end targeting check (R4)

> Sub-phases 02c, 02d, 02e must be complete before starting this sub-phase.

From a fresh session at the timone root, against a scratch managed project (local fixture repo declared in a test manifest, cloned via `workspace sync`):

1. Invoke each of the three skills naming the target project — each resolves and operates on `projects/<scratch>/…` only.
2. Invoke one skill *without* naming a project — it asks instead of guessing.
3. Invoke one with an unknown project name — clear abort message.
4. Commit the produced artifacts in the scratch repo; `git log --stat` shows only `doc/…` and `CONTEXT.md` paths.

#### Agent Validation Steps

- [ ] All four checks pass; evidence (transcript excerpts + `git log --stat` output) recorded in the phase completion report

---

### Sub-phase 02g: Documentation

**[MODIFY]** `README.md`

> All prior sub-phases must be complete before starting this sub-phase.

Add a "Working with Timone" section: sessions run at the root, the three skills and their stages, target-project convention, pointer to `.claude/skills/README.md`. Update Status.

#### Agent Validation Steps

- [ ] Documented invocations match the actual skills; links resolve

---

## Dependency graph

```
02a → (none)        conventions & targeting
02b → 02a           root CLAUDE.md
02c → 02a           timone-grill
02d → 02a           timone-prd
02e → 02a           timone-adr
02f → 02c, 02d, 02e end-to-end R4 check
02g → 02b, 02f      docs last
```

02c/02d/02e share zero files and may run in parallel after 02a.
