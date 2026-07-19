# Phase 01: Foundations — Process Spec & Workspace

> **Status:** Planned.

> First phase of the project — no companion phases. Timone itself is the target codebase (repo root, not a managed project).

## Requirements

> **PRD:** [prd-01-process-layer.md](../../specs/prd/prd-01-process-layer.md) — criteria in [prd-01-process-layer.criteria.md](../../specs/prd/prd-01-process-layer.criteria.md)

This phase delivers the following requirements (verified at phase level after execution):

| ID        | Priority | Requirement (one line)                                            |
| --------- | -------- | ----------------------------------------------------------------- |
| PRD-01.R1 | MUST     | Process specification document defining every lifecycle stage     |
| PRD-01.R2 | MUST     | `timone.yaml` manifest: declared projects loaded and validated    |
| PRD-01.R3 | MUST     | Workspace sync: clone missing projects, fast-forward clean clones |

## Goal Description

Everything in Timone hangs off two anchors: the written process (which every stage skill implements) and the workspace (which every stage skill operates in). This phase creates both, plus the TypeScript CLI skeleton they live in.

The process spec is deliberately written **before** any skill exists — skills conform to the spec, not the other way around. The workspace tooling is the first real code: manifest loading with strict validation, and a sync command that materializes `projects/` from the manifest without ever touching a dirty clone.

The founding decisions from the grill session are already recorded as standalone ADRs under `doc/adr/` (0001–0006); this phase consumes them as context — in particular [ADR-0002](../../adr/0002-typescript-claude-agent-sdk.md) (TypeScript + Agent SDK + supporting libraries), which the scaffold implements.

---

## Context & Prerequisites

### Phase Dependencies

None — first phase. The repo currently contains only `doc/specs/` and this plan.

### Key Files (current state)

| Area  | File(s)                                             |
| ----- | --------------------------------------------------- |
| Specs | `doc/specs/product-overview.md`, `doc/specs/prd/*`  |
| ADRs  | `doc/adr/0001`–`0006` (founding decisions)          |
| Repo  | `.gitignore` (already ignores `projects/`, `tmp/`)  |

---

## Sub-phases

### Sub-phase 01a: Process specification document

**[NEW FILE]** `doc/process.md`

Write the single written definition of the Timone process. One compact table plus a short section per stage. For **each** stage — Triage, Requirements Discovery (grill), Requirements (PRD), Architecture (ADR), Planning, Implementation, Verification, Delivery, Feedback (improve), Deployment, Maintenance, plus cross-cutting Onboarding — define:

- **Purpose** (one sentence)
- **Artifact produced** (file/location convention in the managed project's repo)
- **Closing gate** (what approval/check ends the stage)
- **Owning skill** (name it `timone-<stage>`; Deployment and Maintenance are marked *"stage defined — skill post-MVP"*)

Also include: the artifact conventions summary (`doc/specs/`, `doc/specs/prd/`, `doc/adr/`, `doc/plans/phases/` inside each managed project), the stable-requirement-ID rules, and the ADR conventions — significance rule of thumb (*a decision that constrains future phases or is expensive to reverse*), and that ADRs are **standalone artifacts written at decision time**, never scheduled as plan work (the existing `doc/adr/0001`–`0006` are the reference examples).

Source material: `doc/specs/prd/prd-01-process-layer.md` and the `poc-*` skills under `tmp/skills/` (read for behavior, do not copy customer specifics).

#### Agent Validation Steps

- [ ] Every stage listed in PRD-01.R1's criterion appears with all four fields (purpose, artifact, gate, owning skill)
- [ ] Deployment/Maintenance marked "stage defined — skill post-MVP"
- [ ] Stable-ID rules and ADR threshold present
- [ ] **Human gate:** present the spec to the user for review before marking this sub-phase complete (this is R1's verify-via: human)

---

### Sub-phase 01b: TypeScript CLI scaffold

**[NEW FILE]** `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/cli.ts`, `src/index.ts`

> No dependency on 01a. Implements the stack recorded in [ADR-0002](../../adr/0002-typescript-agent-sdk.md).

- `package.json`: name `timone`, `bin: { "timone": "dist/cli.js" }`, scripts: `build` (tsc), `type-check` (tsc --noEmit), `test` (vitest run), `dev`.
- `src/cli.ts`: commander program with `--version` and command registry; commands added in later sub-phases.
- Strict tsconfig (`strict: true`, NodeNext modules).

#### Agent Validation Steps

```bash
npm install
npm run type-check
npm run build
node dist/cli.js --version
npm test
```

- [ ] All commands exit 0
- [ ] `timone --help` lists the program description

---

### Sub-phase 01c: Manifest schema and loader

**[NEW FILE]** `src/manifest.ts`, `src/manifest.test.ts`, `timone.example.yaml`

> Sub-phase 01b must be complete before starting this sub-phase.

Zod schema for `timone.yaml`:

```yaml
projects:
  <name>:
    repo_url: string          # required
    path: string              # required, must start with "projects/"
    stack: string[]           # required, may be empty
    bindings:
      ticketing: "github"     # required; only "github" valid for now
      preview: "docker"|null  # optional
```

Loader: `loadManifest(path)` returns typed projects or throws a validation error **naming the offending field** (PRD-01.R2 criterion). Unknown keys rejected.

#### Agent Validation Steps

```bash
npm run type-check
npm test -- manifest
```

- [ ] Valid example manifest parses; every field accessible and typed
- [ ] Missing `repo_url` → error message contains the project name and the field name
- [ ] Test cases cover: valid, missing field, unknown binding value, path outside `projects/`

---

### Sub-phase 01d: `timone projects list` command

**[NEW FILE]** `src/commands/projects.ts` — **[MODIFY]** `src/cli.ts`

> Sub-phase 01c must be complete before starting this sub-phase.

`timone projects list`: table of managed projects (name, path, stack, bindings, cloned-yet?). Reads `timone.yaml` from the repo root (or `--manifest <path>`). Exit 1 with the loader's error message on invalid manifest.

#### Agent Validation Steps

```bash
npm run type-check && npm run build
node dist/cli.js projects list --manifest timone.example.yaml
node dist/cli.js projects list --manifest /tmp/broken.yaml; echo "exit: $?"
```

- [ ] Valid manifest → table with all declared projects
- [ ] Invalid manifest → non-zero exit, error names the field

---

### Sub-phase 01e: `timone workspace sync`

**[NEW FILE]** `src/commands/workspace.ts`, `src/git.ts`, `src/workspace.test.ts` — **[MODIFY]** `src/cli.ts`

> Sub-phase 01c must be complete before starting this sub-phase (01d not required).

For each manifest project: path absent → `git clone repo_url path`; path present and clean → fetch + fast-forward the default branch; path present and dirty (uncommitted changes or non-default branch) → **do not touch**, report as skipped. Summary line per project: `cloned | updated | up-to-date | skipped (dirty) | failed`. Integration tests use local bare-repo fixtures (no network).

#### Agent Validation Steps

```bash
npm run type-check
npm test -- workspace
# manual smoke against fixtures:
node dist/cli.js workspace sync --manifest <fixture-manifest>
node dist/cli.js workspace sync --manifest <fixture-manifest>   # second run: up-to-date
git status --porcelain   # at timone root: projects/ must not appear
```

- [ ] First run clones, second run reports up-to-date
- [ ] Dirty fixture clone is skipped and reported, contents untouched
- [ ] `projects/` invisible to timone's own git status

---

### Sub-phase 01f: Documentation

**[MODIFY]** `README.md`

> All prior sub-phases must be complete before starting this sub-phase.

Update README: install/build steps, `timone projects list` and `timone workspace sync` usage, pointer to `doc/process.md` and `timone.example.yaml`. Update the Status section.

#### Agent Validation Steps

```bash
npm run type-check
```

- [ ] Every documented command exists and its shown output matches reality
- [ ] README links to `doc/process.md` resolve

---

## Dependency graph

```
01a   → (none)      process spec (human-gated)
01b   → (none)      CLI scaffold (implements ADR-0002)
01c   → 01b         manifest loader
01d   → 01c         projects list
01e   → 01c         workspace sync
01f   → 01a, 01d, 01e    docs last
```
