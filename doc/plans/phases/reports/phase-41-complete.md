# Phase 41 — Completion Report

- **Date:** 2026-10-02
- **Plan:** [phase-41.md](../phase-41.md) — breakdown [ticket-164.md](../../breakdowns/ticket-164.md), `Approved by fvermaut 2026-09-26 — 2 pieces`; this is piece 2, [#166](https://github.com/fvermaut/timone/issues/166).
- **Requirements:** PRD-05.R11 (MUST) — `draft`; PRD-05.R20 (SHOULD) — `draft`. Execution leaves both statuses as they are; verification decides.
- **Branch:** `timone/166-the-old-code-between-steps-is-removed`
- **Departures:** [phase-41-departures.md](phase-41-departures.md) — 15 entries.

## Summary

The old code between steps is gone. Every project in `timone.yaml` is now driven by the runner, and the `driver` line is removed: a manifest that still has one fails to load and says to delete it. The poll cycle has one path. The old spawner, the standing call to action and its ask check, the reading of a step's end from an exact line, the wait kinds other than the runner's, the `failed` status and `timone retry` are deleted. In `src/`, 62 files changed: about 5,600 lines added and 27,700 removed, most of them tests of the deleted code. The four largest old files went from about 11,000 lines to 4,235. 1,408 tests pass. The live check is in [phase-41-live-gate.md](phase-41-live-gate.md).

An older ledger still loads. A failed run is read as cancelled and keeps a one-line reason; a run waiting in an old way is read as waiting for the runner. The real ledger was converted this way when the daemon was restarted on this build.

`process.md`, the ten step skills, the glossary, the README and the manual now describe the runner. Nine decision records are marked superseded by ADR-0060 (the eight it lists, and ADR-0054, whose ask check went with the old code), and six carry an `Amended by` line.

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 41a — the cycle's shared behaviour is tested on runner projects | 83 tests moved, no production change | `811d633` |
| 41b — every project is driven by the runner, and the cycle has one path | built after two amendments (six more files; the nobody-named refusal moved to the daemon's start) | `5044fc4` |
| 41c — runs the old code left become runs the runner can read | built after two amendments (case 5 matched to the goal; tests of unreachable states removed) | `886bb90` |
| 41d — `timone retry` is gone | built as planned | `a3bcb32` |
| 41e — takeover, status and the call to action know only the runner's wait | built; one check amended (the runner's own `converse`) | `0b1689b` |
| 41f — the old spawner, and everything only it used, is deleted | built; three leftovers moved to 41h | `71f4362` |
| 41g — what a step is told matches the runner | built as planned | `9496170` |
| 41h — the ledger and the step table keep only what the runner uses | built after two amendments (leftovers of earlier slices; four dead fields) | `32ce17c` |
| 41i — the decision records and the requirement lists say what happened | built; four more notes added by amendment | `9617283` |
| 41j — `process.md`, the skills and the glossary describe the runner | built as planned | `3afc263` |
| 41k — the README and the manual describe the runner | built as planned; diagrams checked on GitHub | `f61186f` |
| 41l — the live check | replay 19 of 19; the real ledger converted; scratch-app #71 reached pull request #73 for $33.25, stopping only for fvermaut; found two faults, fixed in 41m — see [phase-41-live-gate.md](phase-41-live-gate.md) | — |
| 41m — what the live check found on the real ledger | added during 41l, built | `d82be1a` |
| 41n — the review's code findings that change behaviour | added after delivery, on fvermaut's answers on #189; built | `a30bdd4` |
| 41o — the review's tidy-up, no change in behaviour | built; 1,411 tests before and after, 29 test names changed | `a0fa4d7` |
| 41p — the skills, the manual, the glossary and PRD-05.R11's words | built; R11 clause 2 reworded on fvermaut's answer | `bcc18b1` |

## Screen comparison

None — the phase changes no screen.

## Deviations from the plan

Every one is an entry in [phase-41-departures.md](phase-41-departures.md), with its dated marker in the phase file. In short:

- 41b kept and tested two pieces of shared code on runner projects first; it was granted six more files; the refusal of a project nobody may instruct moved from the manifest to the daemon's start.
- 41c: a converted failed run whose ticket is still open and marked is picked up again as new work, as the goal said; tests of states the conversion makes unreachable were removed in 41c.
- 41e: one search check left out the runner's own `converse`.
- 41f: three things stayed until 41h, because other files still imported them.
- 41h: removing `failed` needed small edits in twelve more files; four dead fields were removed too.
- 41i: four more places got notes.
- 41l: on the real ledger, the runner ended the six converted conversation runs on Timone's own tickets (their label was removed on 2026-09-11) and posted on four of them, about $0.50. The plan had said no comment would appear. 41m was added to keep `timone takeover` working on those tickets, and to cut a converted run's reason to one line.

## Context for the next agent

- Build with `npm run build`, then `npm test`: some tests run the built `dist/cli.js`.
- `dist/` still holds the output of deleted files (`retry.js`, `cta.js`, `gates.js`, `ask-check.js`, `gate-comment.js`, `channels/conversation.js`). Nothing imports them. Clean `dist/` when no daemon is running from it.
- The replay was run on this build: 19 of 19, three tries each, $2.50, at `3afc263` (recorded in phase-40-replay.md as run 8). 41m changed code after it, in the takeover and the ledger read, neither of which the replay exercises.
- The checks for PRD-05.R11 and R19 test what this phase removed on purpose (`timone retry` refusing on a runner project; the `driver` line). Verification re-authors them.
- Older faults found on the way are filed: #186, #187, #188.

## ✏ 2026-10-02 — closed again after 41n to 41p

The phase was delivered as [pull request #189](https://github.com/fvermaut/timone/pull/189). Its two reviews found 12 things. fvermaut answered: fix them first, change PRD-05.R11's words rather than the code, and add a `Falsified-by` line to R11 and R20. 41n to 41p did the first two; the `Falsified-by` lines name verification's own checks, so the re-check writes them. 1,411 tests pass, and the dry replay passes 19 of 19. Code changed after replay run 9, so one more replay is owed on the final commit.
