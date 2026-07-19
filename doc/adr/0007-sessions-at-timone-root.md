# ADR-0007: Agent sessions run at the timone root; skills resolve a target project

- **Status:** accepted
- **Date:** 2026-07-19

## Context

Stage skills must reach agent sessions without ever being committed to client repos (PRD-01.R4). The original assumption was that sessions run inside `projects/<name>`, which forces delivery machinery (symlinks, user-level installs, or SDK injection) to make skills visible there. fvermaut corrected the model: sessions — interactive and daemon-spawned alike — run from the timone repo root; most will be initiated by loop events, human prompts are the exception.

## Decision

All agent sessions run from the timone root. Stage skills are ordinary timone project-level skills under `.claude/skills/`, versioned with timone — no delivery mechanism at all. Every stage skill resolves a **target project**: named explicitly in a human-initiated prompt, or carried implicitly by the triggering event (a ticket belongs to a project via the manifest) in loop mode. The skill validates the target against `timone.yaml` and operates exclusively on `projects/<name>/…` paths.

## Consequences

- Zero skill-delivery machinery; skills update with a git pull of timone.
- Cross-client isolation is no longer enforced by the working directory: it becomes a convention (skills touch only the target project's tree), to be hardened later with daemon-level per-session file-access scoping (PRD-02).
- PRD-01.R4 and PRD-02.R2 are revised: the criterion is target-project resolution + clean client repos, not per-project cwd.
- Every stage skill's interface includes target-project resolution from day one.
