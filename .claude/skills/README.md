# Timone Stage Skills — Authoring Conventions

Every skill in this directory implements exactly one stage of [the Timone process](../../process.md). The process spec is normative: when a skill and the spec disagree, the spec wins and the skill gets fixed. Skills contain no client-specific content, ever.

Sessions run at the **timone repo root** ([ADR-0007](../../doc/adr/0007-sessions-at-timone-root.md)); skills operate on a **target project** under `projects/<name>/`.

## Frontmatter rules

- `name`: `timone-<stage>` (e.g. `timone-grill`, `timone-prd`, `timone-adr`).
- `description`: states the owned stage, when to use it, and trigger phrases; mentions it applies to a managed project.
- `argument-hint`: starts with `<project-name>`, then the stage-specific input.

## Target-project resolution (required preamble — copy this behavior into every skill)

1. The target project is the one named in the invocation argument or prompt.
2. If no project is named: read `timone.yaml`, list the project names, and **ask** the user to pick. Never guess.
3. Validate the name against `timone.yaml`. Unknown name → abort, listing the valid names.
4. Check `projects/<name>/` exists on disk. Not cloned → abort, suggesting `node dist/cli.js workspace sync`.
5. From here on, every file the skill reads or writes lives under `projects/<name>/…` — the only exceptions are *reading* timone's own `process.md`, `standards/`, and `timone.yaml`.
6. In loop mode (daemon-initiated sessions), the target project arrives in the event context; the same validation applies.

## Artifact rules

- Artifact paths follow the process spec's conventions section (`projects/<name>/doc/specs/…`, `doc/adr/…`, `doc/plans/…`, `CONTEXT.md`).
- Document stages commit only process artifacts under `doc/`, plus `CONTEXT.md` and `STATUS.md` at the project root. Stage 6 (`timone-execute`) additionally commits the application code and project tooling its approved plan calls for — writing that code *is* the stage. Stage 7 (`timone-verify`) additionally commits the application-code fixes its bounded verify-fix loops produce, plus the verification report and the register status flips — the verifier's own probes stay in scratch space and are never committed. Stage 8 (`timone-deliver`) commits the delivery report and nothing else: it never commits application code, never merges and never writes the register, and the refactorings its Standards axis identifies are raised for stage 9 rather than applied. Stage 9 (`timone-improve`) commits the feedback record, PRD-pair amendments (including the register's `revised` / `DEPRECATED` intent transitions), record corrections to committed process artifacts, and `STATUS.md` — documents only: it never commits application code, never executes a plan and never writes a verdict status, because every code remediation it classifies is dispatched through stages 5 → 6 → 7 → 8. Forbidden in every case: skill files, harness config and timone internals never land in a client repo ([PRD-01.R4](../../doc/specs/prd/prd-01-process-layer.criteria.md)).
- **Every stage updates `STATUS.md`** before it finishes ([PRD-01.R22](../../doc/specs/prd/prd-01-process-layer.criteria.md)) — plain language for the human, always naming which repository an item belongs to. Never read it as a source of truth; it is a rendering of the PRD, phase files and reports, not an input to them.
- Stable requirement IDs, ADR numbering, and status lifecycles follow the process spec — skills restate the *behavior*, never invent variants.
