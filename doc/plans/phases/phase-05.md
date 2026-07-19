# Phase 05: Triage — `timone-triage` + `timone projects update`

> **Status:** In progress — breakdown approved by fvermaut 2026-07-19. Sub-phases 05a, 05b, 05c complete.

> **Companion phases:** [Phase 01](phase-01.md) (CLI/manifest foundations — `projects update` extends them), [Phase 02](phase-02.md) (skill conventions), [Phase 04](phase-04.md) (the `projects add` pattern this phase's CLI work mirrors). Governing decisions: [ADR-0004](../../adr/0004-github-first-adapters.md) (GitHub-first — the issue-backed triage path uses `gh` directly, no adapter layer), [ADR-0008](../../adr/0008-manifest-writes-via-cli-command.md) (manifest writes only via CLI — the reason `projects update` exists at all).

## Requirements

> **PRD:** [prd-01-process-layer.md](../../specs/prd/prd-01-process-layer.md) — criteria in [prd-01-process-layer.criteria.md](../../specs/prd/prd-01-process-layer.criteria.md)

| ID        | Priority | Requirement (one line)                                                                                                    |
| --------- | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| PRD-01.R6 | MUST     | Triage skill: classify an incoming request (feature / bug / chore / question), record the classification + process entry point + rationale |

**Un-anchored enabler work (agreed 2026-07-19):** `timone projects update` — manifest-correction CLI command. Surfaced as a gap during phase 04's existing-codebase dry-run (stale stack tag, no way to fix it without hand-editing, which ADR-0008 forbids). Explicitly stamped un-anchored per the process's PRD-anchoring rule; fvermaut approved bundling it here.

## Goal Description

Triage is stage 1 — the front door of the whole pipeline. Every incoming request (ticket text or free-form description) gets classified as feature / bug / chore / question and routed to its process entry point: feature → grill (or PRD directly if requirements are already clear), bug or post-delivery observation → improve, chore/technical enabler → plan (un-anchored), question → answered with no pipeline entry. The gate is that the classification is **recorded on the request** — which forces a decision this phase makes concrete:

**Triage-record convention (decided 2026-07-19, with fvermaut):** hybrid. When the request is a GitHub issue (URL or number given, and the project's repo is actually GitHub-hosted), the classification is recorded on the issue itself via `gh` — a comment carrying kind + entry point + rationale, plus a `triage:<kind>` label. Otherwise (free-form request, or non-GitHub remote) it is persisted as a small dated record at `projects/<name>/doc/triage/NNN-<slug>.md`. This passed the ADR significance test's trade-off part but not *hard to reverse* — so it is a process-spec conventions amendment (sub-phase 05b), not an ADR.

The bundled CLI work makes the manifest correctable: `timone projects update` mirrors `projects add` (phase 04a) — a pure-function seam plus a thin CLI wrapper, built TDD.

## Context & Prerequisites

- **Phase 01** — `src/manifest.ts` (zod schema, `loadManifest`, and since 04a `addProject`/`serializeManifest`), `src/commands/projects.ts` (existing `list` + `add` subcommands to extend), `src/cli.ts`.
- **Phase 02** — `.claude/skills/README.md` conventions (target-project resolution preamble is mandatory).
- **`process.md`** — stage 1's routing table is normative; the skill restates its behavior, never invents variants.
- **Fixtures** — `scratch-app`, `scratch-app-2`, `scratch-existing` are registered and cloned; all use *local* bare repos (`tmp/fixtures/*.git`), so the `gh` path cannot be exercised end-to-end — see 05d. `scratch-existing`'s stack tag is known-stale (the very gap that motivated `projects update`).

## Sub-phases

### Sub-phase 05a: `timone projects update` CLI command

**[MODIFY]** `src/manifest.ts` — add `updateProject(manifest, name, patch): Manifest` (pure function: unknown name → readable error listing valid names; patch fields validated against the existing per-project zod shape; only provided fields change, others preserved).
**[MODIFY]** `src/commands/projects.ts` — add the `update` subcommand: `timone projects update <name> [--repo <url>] [--path <path>] [--stack <comma-list>] [--ticketing github] [--preview docker] [--manifest <path>]`. At least one field flag required (no-op invocation exits 1 with usage). Reads the manifest, calls `updateProject`, writes back via the existing `serializeManifest`.

**Seams under test (TDD):** `updateProject` is the seam — pure, no I/O. Red-green: (1) updating one field preserves all others; (2) unknown project name throws a readable error listing valid names; (3) invalid patch value (bad ticketing) throws the same field-naming error style as `loadManifest`; (4) updated manifest round-trips through `serializeManifest`→`loadManifest` unchanged.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
npm run type-check
npm test -- manifest
npm run build
cp timone.yaml /tmp/test-update-manifest.yaml
node dist/cli.js projects update scratch-existing --stack typescript,nextjs,tailwind --manifest /tmp/test-update-manifest.yaml
node dist/cli.js projects list --manifest /tmp/test-update-manifest.yaml
node dist/cli.js projects update no-such-project --stack x --manifest /tmp/test-update-manifest.yaml; echo "exit: $?"
```

- [ ] New unit tests pass (red→green evidence in the sub-agent handoff, not just a final green run)
- [ ] Single-field update preserves every other field (visible in `projects list` output)
- [ ] Unknown-name update exits 1 with a readable error listing valid names
- [ ] Invocation with no field flags exits 1 with usage

---

### Sub-phase 05b: process-spec amendment — the triage-record convention

**[MODIFY]** `process.md` — two touches: (1) stage-1 notes gain the recording convention (GitHub-issue-backed → `gh` comment + `triage:<kind>` label; otherwise → `doc/triage/NNN-<slug>.md`, NNN zero-padded, allocated by scanning existing records); (2) the artifact-conventions tree gains the `doc/triage/` line with a one-phrase description ("stage-1 classification records for requests with no ticket home").

The spec is normative and the skill must follow it — so this lands **before** the skill is written.

> No dependency on other sub-phases.

#### Agent Validation Steps

- [ ] Stage-1 notes state both recording paths and when each applies
- [ ] Artifact-conventions tree includes `doc/triage/`
- [ ] No other stage's text altered

---

### Sub-phase 05c: `timone-triage` skill

**[NEW FILE]** `.claude/skills/timone-triage/SKILL.md`

> Sub-phase 05b must be complete before starting this sub-phase (spec wins; skill restates it).

Per `process.md` stage 1, with the standard target-project resolution preamble from `.claude/skills/README.md`. Input: a GitHub issue reference or free-form request text (from the argument or prompt). The skill:

1. Classifies the request: **feature / bug / chore / question**, with a one-paragraph rationale.
2. Determines the process entry point per the stage-1 routing table: feature → `timone-grill` (or `timone-prd` when requirements are already unambiguous — the skill must justify skipping grill in the rationale); bug or post-delivery observation → `timone-improve`; chore/technical enabler → `timone-plan`, un-anchored; question → answer it directly, no pipeline entry.
3. Records the classification per the 05b convention. GitHub path: only when an issue ref was given **and** the project's `repo_url` is a GitHub remote — comment with kind + entry point + rationale, add label `triage:<kind>` (create the label if missing). Otherwise: write `projects/<name>/doc/triage/NNN-<slug>.md` (date, verbatim request, kind, entry point, rationale) and commit it.
4. States the routing outcome to the user, naming the next skill to invoke — triage routes, it never starts the next stage itself.

Routed-to skills that don't exist yet (`timone-plan`, `timone-improve`) are still named as the entry point — the record is about the process, not about what's currently implemented.

#### Agent Validation Steps

- [ ] Frontmatter + targeting per `.claude/skills/README.md` conventions (`argument-hint` starts with `<project-name>`, then the request/issue ref)
- [ ] Routing table matches `process.md` stage 1 exactly — all four kinds, including the feature→prd fast path and question→no-pipeline
- [ ] GitHub path guarded on *both* issue-ref-given and GitHub-hosted `repo_url`; fallback is the doc record, never a silent skip
- [ ] Doc record is committed in the target project; only `doc/…` paths touched

---

### Sub-phase 05d: Dry-run — three requests + one manifest correction

> Sub-phases 05a, 05b, 05c must be complete before starting this sub-phase.

From a fresh timone-root session, per R6's verification hint (three sample requests of different kinds):

1. **Feature (free-form)** on `scratch-app-2`: e.g. "users should be able to reset their password by email" → expect kind=feature, entry point `timone-grill`, a committed `doc/triage/001-*.md`.
2. **Bug (free-form)** on `scratch-app`: e.g. "the projects list crashes when the manifest is empty" → expect kind=bug, entry point `timone-improve`, committed record.
3. **Question (free-form)** on `scratch-app`: e.g. "which auth library did we standardize on?" → expect kind=question, an actual answer (from `doc/standards.md`/ADRs), a record, and **no** pipeline entry.
4. **GitHub path by inspection:** fixtures have local remotes, so the `gh` branch cannot run end-to-end. Verify instead that the skill, given an issue ref against a local-remote project, correctly falls back to the doc record with an explicit note — and review the skill's `gh` command sequence manually for correctness (HUMAN-CHECK).
5. **Manifest correction (05a, real use):** `timone projects update scratch-existing --stack …` to fix the known-stale stack tag in the *real* `timone.yaml` — the exact gap from phase 04. Verify with `projects list`.
6. `git log --stat` in the touched scratch repos: only `doc/…` paths — no harness files.

#### Agent Validation Steps

- [ ] All three classifications and routings match the process spec; records committed
- [ ] Question run demonstrably answers from project artifacts rather than routing
- [ ] Issue-ref-against-local-remote falls back loudly, not silently
- [ ] `scratch-existing` stack tag corrected in the real manifest via the CLI
- [ ] **Human gate:** fvermaut reviews the three records + the `gh` command sequence before this sub-phase is marked done

---

### Sub-phase 05e: Documentation

**[MODIFY]** `README.md`

> All prior sub-phases must be complete before starting this sub-phase.

Add `/timone-triage <project-name> <request|issue-ref>` to the "Working with Timone" command list; document `timone projects update` next to `projects add`; update Status.

#### Agent Validation Steps

- [ ] Documented commands match actual behavior; links resolve

## Dependency graph

```
05a → (none)          projects update CLI command (TDD)
05b → (none)          process.md triage-record convention (spec first)
05c → 05b             timone-triage skill
05d → 05a, 05b, 05c   dry-run: three requests + manifest correction, human gate
05e → 05d             docs last
```
