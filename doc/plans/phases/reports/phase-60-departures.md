# Phase 60 — Departures

> One entry per departure from the plan or the requirements, appended in order, never rewritten.

## 2026-10-13 — timone#248, build

**Kind:** plan step
**Agreed:** 60a's validation ran the checks written for PRD-07 R2 and R3, and checked that they left no process running.
**Did instead:** the two runs and their two checkboxes moved to verification. 60a's validation builds the code instead.
**Why:** those checks are what verification runs against the build, and the build may not read or use them. The plan named them in the wrong step.

## 2026-10-13 — verification

- **What could not be checked:** PRD-05.R1 clause 1, the runner's own choice: whether a real model, woken after sorting a plain feature, starts the interview. Phase 60 changed what the runner is told in that state when another ticket holds the project's place. It used to say "This ticket waits for its turn.", which was not true. It now says the ticket is not in line, and that a refused try puts it in line.
- **Why:** it needs a real model, and no case of the replay is a plain feature just sorted, with or without another ticket holding the place. The replay passed 24 of 24 on this build ([phase-60-replay.md](phase-60-replay.md), run 2), but none of its cases is this state.
- **What was checked instead:** what code does, by the check script `prd-05.r1.mjs`: what the runner is told, and that the interview it chooses waits for a place and then starts. That check went red on the build from just before phase 60.
- **What would close it:** a replay case for a feature just sorted while another ticket holds the place. That is a new row in PRD-05.R18's table, which fvermaut approves. See [phase-60-verification.md](phase-60-verification.md).
