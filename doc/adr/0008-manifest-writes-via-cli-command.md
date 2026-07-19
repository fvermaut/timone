# ADR-0008: Manifest writes go through a validated CLI command, not hand-edited YAML

- **Status:** accepted
- **Date:** 2026-07-19

## Context

The onboarding skill (PRD-01.R5) needs to register a new project in `timone.yaml`. Two genuine alternatives:

- **The skill edits `timone.yaml` directly** (via a text-edit tool), following the zod schema from memory. Simplest, no new code.
- **A CLI command (`timone projects add`) performs the write**, validated against the same zod schema `loadManifest` already uses, and is the only writer.

A hand-edited manifest risks silent drift from the schema (a typo in a binding value isn't caught until the next `loadManifest` call, possibly much later) and duplicates validation logic between "how a human/skill writes YAML" and "how the CLI reads it." It also doesn't generalize: PRD-02's daemon will eventually need to register projects non-interactively too, and would otherwise need its own YAML-writing logic.

## Decision

Manifest mutation goes exclusively through `timone projects add` (and future `remove`/`update` commands), which validates via the existing `src/manifest.ts` zod schema before writing. Skills — including `timone-onboard` — never hand-edit `timone.yaml`; they shell out to the CLI command. The command accepts flags for every schema field and rejects invalid input with the same field-naming error style as `loadManifest`.

## Consequences

- One validated code path for manifest writes, reused by interactive skills and (later) the daemon — no drift between writer and reader.
- The YAML serializer regenerates the file in canonical form; hand-written comments in a manifest a human has edited directly may not survive a subsequent `projects add` call. Acceptable: the manifest is generated config, not hand-authored prose, and `timone.example.yaml` remains the commented reference.
- Slightly more upfront work than a direct edit, paid back the first time a skill or the daemon needs to add a project without corrupting the file.
