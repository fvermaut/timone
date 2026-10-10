# Phase 58 — Departures

> One dated entry per departure from the plan or the requirements, appended, never rewritten.

## 2026-10-10 — timone#238, build

**Kind:** plan step
**Agreed:** 58a case 3 clones a local repository "with the real `execCommandRunner`".
**Did instead:** the test's runner passes `git` calls to the real `execCommandRunner` and records every other command without running it. The test reads the clone's folder before `bringUpServices` removes it.
**Why:** with the real runner for every command, `bringUpServices` goes on to start the compose stack in Docker. A unit test must not do that, and the case is about the clone only.
