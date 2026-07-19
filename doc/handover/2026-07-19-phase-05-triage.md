# Handover — Timone (meta) — 2026-07-19 (evening)

> Prior handover: [2026-07-19-founding-phases-01-04.md](2026-07-19-founding-phases-01-04.md) — everything up to the close of phase 04. This file covers only the session after it.

## Snapshot

Phase 05 is planned, executed, verified, and closed in this one session: the `timone-triage` skill (PRD-01.R6, now `verified`) plus the bundled `timone projects update` command. The dry-run — four fresh-context sub-agent runs — caught and fixed two real skill defects, and `projects update` got two real uses correcting stale manifest entries. Five stage skills now exist; the remaining PRD-01 lifecycle skills are plan, execute, verify, deliver, improve (R10–R14, plus R16/R17).

## Done this session

- **Phase 05 plan** (approved pre-execution) — [phase-05.md](../plans/phases/phase-05.md), commit `55a44d1`.
- **05a** — `timone projects update`, TDD on the pure `updateProject` seam — `c7c7d50`.
- **05b** — triage-record convention written into `process.md` (stage-1 notes + `doc/triage/` in the conventions tree) — `398c7c9`.
- **05c** — `.claude/skills/timone-triage/SKILL.md` — `651f9be`, plus two dry-run-driven fixes (`92652fc`, `ac343dc`).
- **05d** — dry-run (3 free-form requests + issue-ref fallback test), gate passed by fvermaut; full evidence in [reports/phase-05-complete.md](../plans/phases/reports/phase-05-complete.md).
- **05e + close** — README updated, R6 flipped to `verified` in the criteria register — `0af4fc1`.

## In flight / blocked

Nothing mid-execution — phase 05 closed cleanly; working tree clean except the deliberately local `timone.yaml`. Phase 06 has not been planned.

## Decisions made this session

- **Triage records are hybrid** (fvermaut, at planning): GitHub issue comment + `triage:<kind>` label when issue-backed *and* GitHub-hosted; otherwise a committed `doc/triage/NNN-<slug>.md`. Deliberately *not* an ADR — fails the hard-to-reverse part of the gate; recorded as the `process.md` amendment instead (`398c7c9`).
- **`projects update` bundled into phase 05** (fvermaut, at planning) as explicitly un-anchored enabler work — resolving the prior handover's first open question.
- **Manifest corrections applied**: `scratch-existing` → `javascript,express`; `scratch-app` → `+prisma,postgresql` (its manifest contradicted its own ADR-0001).

## Exact next action

Plan **phase 06 — the plan skill (PRD-01.R10)**: say "plan phase 06" (or "plan the plan skill") at the timone root. After it: execute (R11, the bigger lift — real orchestration code), then verify/deliver/improve (R12–R14). Note the mild bootstrap: phases so far were planned by hand; R10 turns that practice into a skill — the five existing hand-written phase files are its reference corpus.

## Open questions

- **`ticketing: github` binding vs `repo_url` guard** — the triage skill keys its GitHub path purely on `repo_url` matching `github.com`; the manifest's `ticketing` binding plays no role, and all fixtures have local remotes with `ticketing: github` declared. Two dry-run agents independently flagged the ambiguity. Resolve when the first real GitHub-hosted project arrives (or at PRD-02 time, when the daemon consumes bindings for real). fvermaut decides.
- **Draft-PRD divergence = bug?** — triage classifies divergence from a *draft* PRD as a bug (per the letter of the definition); whether pre-delivery divergence should instead fold into the pending implementation is unaddressed policy. fvermaut, whenever it first bites.
- **Carried from prior handover, still open:** skill-delivery into daemon sessions (PRD-02), and PRD-02's own three open questions (session continuity, ticket-marking, preview exposure).
