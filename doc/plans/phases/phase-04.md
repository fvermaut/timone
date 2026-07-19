# Phase 04: Onboarding — `timone projects add` + `timone-onboard`

> **Status:** Complete — see [reports/phase-04-complete.md](reports/phase-04-complete.md) and [reports/phase-04-verification.md](reports/phase-04-verification.md).

> **Companion phases:** [Phase 01](phase-01.md) (CLI/manifest foundations), [Phase 02](phase-02.md) (skill conventions, document trio), [Phase 03](phase-03.md) (standards library — this phase is its first real consumer). Governing decision: [ADR-0008](../../adr/0008-manifest-writes-via-cli-command.md) — manifest writes go through a validated CLI command.

## Requirements

> **PRD:** [prd-01-process-layer.md](../../specs/prd/prd-01-process-layer.md) — criteria in [prd-01-process-layer.criteria.md](../../specs/prd/prd-01-process-layer.criteria.md)

| ID         | Priority | Requirement (one line)                                                        |
| ---------- | -------- | ------------------------------------------------------------------------------ |
| PRD-01.R5  | MUST     | Onboarding skill: manifest entry, doc tree, product overview + constraints, founding ADRs, standards artifact — all gated on human confirmation |
| PRD-01.R15 | MUST     | Thin per-project standards artifact (`doc/standards.md`); existing-codebase conventions observed, not imposed |

## Goal Description

The last foundational stage skill. Onboarding is what actually makes phases 02 and 03 useful together: it's the moment a project first gets a `CONTEXT.md`, a PRD folder, an ADR folder — and, new since this phase, a `doc/standards.md` selecting from the now-Approved central library. Two paths: **greenfield** (empty or near-empty repo, stack chosen fresh) and **existing codebase** (conventions observed from the code, conflicts with preferred standards flagged rather than silently overridden — the R15 second criterion).

This phase also stands up the first piece of the daemon-facing CLI surface: `timone projects add`, per ADR-0008. It's built test-first (the manifest-write function is a natural seam) since it's the first genuinely new *code* sub-phase since phase 01.

## Context & Prerequisites

- **Phase 01** — `src/manifest.ts` (zod schema, `loadManifest`), `src/commands/projects.ts` (existing `list` subcommand to extend), `src/cli.ts`.
- **Phase 02** — `.claude/skills/README.md` conventions (target-project resolution preamble); `timone-adr`'s ADR format is the reference for the founding-ADRs part of onboarding.
- **Phase 03** — `standards/README.md` is the index onboarding selects from; every entry is `Approved`.
- **Governing decision** — [ADR-0008](../../adr/0008-manifest-writes-via-cli-command.md).

## Sub-phases

### Sub-phase 04a: `timone projects add` CLI command

**[MODIFY]** `src/manifest.ts` — add `addProject(manifest, name, entry): Manifest` (pure function: validates the new entry against the existing per-project zod shape, rejects a duplicate name with a readable error) and `serializeManifest(manifest): string`.
**[MODIFY]** `src/commands/projects.ts` — add the `add` subcommand: `timone projects add <name> --repo <url> --path <path> --stack <comma-list> --ticketing github [--preview docker] [--manifest <path>]`. Reads the existing manifest (or starts empty if the file doesn't exist yet), calls `addProject`, writes the result back via `serializeManifest`.

**Seams under test (TDD):** `addProject` and `serializeManifest` are the seams — pure functions, no I/O. Red-green: (1) adding to an empty manifest produces a valid single-entry manifest; (2) adding a duplicate name throws a readable error; (3) adding an invalid entry (bad ticketing value) throws the same field-naming error style as `loadManifest`; (4) `serializeManifest` output round-trips through `loadManifest` unchanged.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
npm run type-check
npm test -- manifest
npm run build
node dist/cli.js projects add scratch-app-2 --repo /tmp/does-not-matter.git --path projects/scratch-app-2 --stack typescript,nextjs --ticketing github --manifest /tmp/test-add-manifest.yaml
node dist/cli.js projects list --manifest /tmp/test-add-manifest.yaml
```

- [ ] New unit tests pass (red→green evidence in the sub-agent handoff, not just a final green run)
- [ ] `projects add` then `projects list` round-trips correctly
- [ ] Duplicate-name add exits 1 with a readable error

---

### Sub-phase 04b: `timone-onboard` skill — greenfield path

**[NEW FILE]** `.claude/skills/timone-onboard/SKILL.md`

> Sub-phase 04a must be complete before starting this sub-phase.

Per `process.md` stage 0, greenfield path: gather the target repo (URL, local path under `projects/`), the intended stack, and project constraints (client policies, hosting, compliance, budget) through a short structured interview (not a full `timone-grill` session — a fixed checklist). Call `timone projects add` (04a) to register it, then `workspace sync` to clone it. Create the doc tree (`doc/specs/`, `doc/specs/prd/`, `doc/adr/`, `doc/plans/phases/`). Draft the one-page product overview (problem, users, goals, success definition, non-goals, constraints) and **present it for confirmation before saving** — do not write until confirmed. Record each stack choice as a founding ADR under `doc/adr/` following the `timone-adr` format (numbered from 0001, Context stating genuine alternatives).

#### Agent Validation Steps

- [ ] Frontmatter + targeting per `.claude/skills/README.md` conventions
- [ ] Calls out to `projects add` + `workspace sync` explicitly (not a hand-edit of `timone.yaml`)
- [ ] Product overview confirmation-before-write is explicit and blocking
- [ ] Founding-ADR format matches `timone-adr`'s Status/Date/Context/Decision/Consequences

---

### Sub-phase 04c: `timone-onboard` skill — standards artifact + existing-codebase path

**[MODIFY]** `.claude/skills/timone-onboard/SKILL.md`

> Sub-phase 04b must be complete before starting this sub-phase (same file).

Extend the skill with the R15 half:

- **Standards selection:** read `standards/README.md`; the baseline tier (accessibility, UI/UX) is included unconditionally; stack entries are selected by matching the chosen stack against the library's stack-entry scopes. Draft `projects/<name>/doc/standards.md`: baseline (no opt-out) + selected entries (referenced, not copied) + an empty "Deviations" section. Present for confirmation alongside the product overview (R5's combined gate).
- **Existing-codebase path:** when the target repo already has substantial code, before drafting `doc/standards.md`, scan for observable conventions (linter/formatter config, folder structure, existing test setup) and record them as-is under "Deviations" rather than silently overriding with library defaults; where an observed convention conflicts with a library entry, flag it explicitly and ask the user which wins — never silently pick one.

#### Agent Validation Steps

- [ ] `doc/standards.md` template includes baseline unconditionally + a Deviations section
- [ ] Existing-codebase branch explicitly asks on conflict rather than defaulting
- [ ] Both halves (04b + 04c) share one confirmation gate, not two separate prompts

---

### Sub-phase 04d: End-to-end onboarding dry-run (R5 + R15)

> Sub-phases 04a, 04b, 04c must be complete before starting this sub-phase.

From a fresh timone-root session:

1. **Greenfield onboarding** of a second scratch fixture (new local bare repo, e.g. `scratch-app-2`, empty). Full run: manifest entry, clone, doc tree, product overview (confirm), stack ADRs, `doc/standards.md` (confirm).
2. **Existing-codebase onboarding**: seed a third scratch fixture with a pre-existing `eslint.config.js` and a non-default folder layout before onboarding it; confirm the skill observes and records those rather than overwriting them, and flags at least one deliberate conflict for a decision.
3. `git log --stat` in both scratch repos: only `doc/…` paths (plus whatever pre-existed for the existing-codebase case) — no harness files.

#### Agent Validation Steps

- [ ] Both scratch projects appear correctly in `timone projects list`
- [ ] Both produce a confirmed product overview + `doc/standards.md` + founding ADRs
- [ ] Existing-codebase run demonstrably preserves pre-existing conventions and surfaces a conflict
- [ ] **Human gate:** fvermaut reviews both runs' artifacts before this sub-phase is marked done

---

### Sub-phase 04e: Documentation

**[MODIFY]** `README.md`

> All prior sub-phases must be complete before starting this sub-phase.

Add `/timone-onboard <project-name>` to the "Working with Timone" command list; document `timone projects add` under Getting Started; update Status.

#### Agent Validation Steps

- [ ] Documented commands match actual behavior; links resolve

## Dependency graph

```
04a → (none)         projects add CLI command (TDD)
04b → 04a             timone-onboard: greenfield path
04c → 04b             timone-onboard: standards + existing-codebase path (same file)
04d → 04a, 04b, 04c   end-to-end dry-run, human gate
04e → 04d             docs last
```
