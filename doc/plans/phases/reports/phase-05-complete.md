# Phase 05 — Completion Report

- **Date:** 2026-07-19
- **Plan:** [phase-05.md](../phase-05.md) — breakdown approved by fvermaut before execution
- **Requirements:** PRD-01.R6 (triage skill) + un-anchored enabler `timone projects update` (agreed at planning)

## Sub-phase outcomes

| Sub-phase | Outcome | Commits |
|---|---|---|
| 05a `projects update` (TDD) | 6 red→green tests on the pure `updateProject` seam; suite 23/23; CLI validated incl. unknown-name and no-flag error paths | `c7c7d50` |
| 05b process-spec amendment | Stage-1 recording convention (GitHub comment+label vs `doc/triage/NNN-<slug>.md`, loud fallback) + conventions-tree entry | `398c7c9` |
| 05c `timone-triage` skill | Written per conventions; routing table restates stage 1 with no variants | `651f9be` (+ fixes below) |
| 05d dry-run | 4 fresh-context sub-agent runs + 2 real manifest corrections — see below. **Human gate passed (fvermaut, 2026-07-19)** | records in scratch repos |
| 05e docs | README: `/timone-triage` in command list, `projects update` under Getting started, Status updated | this commit |

## Dry-run evidence (05d)

Per R6's verification hint — three sample requests of different kinds, plus the fallback guard:

| Request | Project | Kind | Routed to | Record |
|---|---|---|---|---|
| password reset by email (free-form) | scratch-app-2 | feature | `timone-grill` (PRD fast path explicitly declined with named open requirements) | `doc/triage/001` @ `2163f6d` |
| completed todos reappear after reload (free-form) | scratch-app | bug | `timone-improve` (rationale cites PRD-01.R2 verbatim) | `doc/triage/001` @ `c0d64d3` |
| which database for persistence? (free-form) | scratch-app | question | none — answered from ADR-0001 (PostgreSQL via Prisma) | `doc/triage/002` @ `f2e75f3` |
| migrate todo controller to TS (issue #12, local remote) | scratch-existing | chore | `timone-plan`, un-anchored | `doc/triage/001` @ `f9b8e90` |

The issue-ref run exercised the guard: loud fallback announced verbatim ("Issue ref given, but `repo_url` is not GitHub — recording under `doc/triage/` instead"). The `gh` command sequence (comment → label create → add-label) was human-reviewed as HUMAN-CHECK since all fixtures have local remotes. `git log --stat` in all three scratch repos: triage commits touch exactly one `doc/triage/` file each; no harness files.

## Defects found by the dry-run (both fixed)

1. **`gh` fetch ran before the GitHub-hosted guard** — the skill's Input section ordered `gh issue view` unconditionally on any issue ref; a literal executor would have run `gh` against a local remote. Fixed: fetch now behind the same `repo_url` guard as recording (`92652fc`).
2. **Question records lost the answer** — the record template captured only "entry point: none — answered". Fixed: optional Answer section added to the template.

## `projects update` in real use

- `scratch-existing` stack corrected `typescript,nextjs` → `javascript,express` — the exact stale-tag gap from phase 04 that motivated the command.
- `scratch-app` stack corrected to add `prisma,postgresql` after the question run noticed the manifest contradicted the project's own ADR-0001.

## Observations left open (flagged at the gate, not resolved)

- The manifest's `ticketing: github` binding plays no role in the triage GitHub-path guard, which keys purely on `repo_url` — two agents independently flagged the ambiguity. Worth resolving when real GitHub-hosted projects arrive (likely alongside PRD-02).
- The skill classifies divergence from a *draft* PRD as a bug (per the letter of the definition); whether pre-delivery divergences should instead fold into pending implementation is unaddressed policy.
- The routing table names `doc/standards.md` first among question-answer sources, but not every project has one (scratch-app predates onboarding's standards step).
