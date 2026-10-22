# Phase 65 — Departures from the plan

> One dated entry per departure, appended, never rewritten. Format per `timone-execute`'s *The departures record*.

## 2026-10-22 — timone#90, execution

**Kind:** plan step
**Agreed:** Case 5 and case 6 of sub-phase 65a: the work step pushes a commit from a second clone to the remote's `main`, then runs `git pull -q --ff-only` in `projectDir`.
**Did instead:** Before the baseline is taken, both cases also run `git checkout -q -B main origin/main` in `projectDir`. The rest of the sequence is as planned.
**Why:** The `workspace()` fixture leaves its clone on git's default branch name (`master` in this container), with no upstream, so the pull fails with "no such ref was fetched". A real checkout is on `main` and tracks `origin/main`. The fixture itself is not changed, and the plan's file list is kept.
