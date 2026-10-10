# Phase 58 — Departures

> One dated entry per departure from the plan or the requirements, appended, never rewritten.

## 2026-10-10 — timone#238, build

**Kind:** plan step
**Agreed:** 58a case 3 clones a local repository "with the real `execCommandRunner`".
**Did instead:** the test's runner passes `git` calls to the real `execCommandRunner` and records every other command without running it. The test reads the clone's folder before `bringUpServices` removes it.
**Why:** with the real runner for every command, `bringUpServices` goes on to start the compose stack in Docker. A unit test must not do that, and the case is about the clone only.

## 2026-10-10 — timone#238, build

**Kind:** plan step
**Agreed:** 58c's `progressOf` gives a result to each tool not marked `running`, and nothing to a running one.
**Did instead:** a running tool also gets a `tool_progress` heartbeat every 30 seconds, from its start up to the wake.
**Why:** without it, both new cases told the runner the step "has been silent since" the command started. On ivtrends#178 and #177 the heartbeat kept "last printed" fresh, and no "silent since" line was shown. The slice found this and asked; a case must show the moment it names.
