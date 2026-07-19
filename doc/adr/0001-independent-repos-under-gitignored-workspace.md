# ADR-0001: Independent project repos under a gitignored workspace, declared in a manifest

- **Status:** accepted
- **Date:** 2026-07-19
- **Source:** naming/architecture conversation + grill session of 2026-07-19

## Context

Timone manages multiple projects belonging to different clients, each needing its own git history, permissions, and lifecycle. Options considered: git submodules (brittle, detached-HEAD traps, confuse agents), monorepo tooling like Nx/Turborepo (shared history and permission bleed across clients), or plain independent clones.

## Decision

Each managed project is an independent, vanilla git repository cloned under `projects/` at the Timone repo root. `projects/` is gitignored by Timone. The single source of truth for what belongs in the workspace is the `timone.yaml` manifest (repo URL, local path, stack, platform bindings per project); a `timone workspace sync` command materializes it.

## Consequences

- Timone's repo stays lightweight: orchestration code, skills, and config only; a fresh machine needs just clone + sync.
- Agents use normal git commands inside each project; sessions can be strictly confined to one project's folder, preventing cross-client leakage.
- Nothing links the repos at the git level — all cross-project knowledge must live in the manifest and Timone's own state.
