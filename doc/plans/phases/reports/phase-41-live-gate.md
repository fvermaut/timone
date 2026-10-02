# Phase 41 — Live check

> 41l of [phase 41](../phase-41.md). Run on 2026-10-01 and 2026-10-02 on the build of `timone/166-the-old-code-between-steps-is-removed` at `3afc263`, with the daemon started by fvermaut from his own terminal.

## 1. The replay

fvermaut ran `npm run --silent replay` from his terminal at `3afc263`: **19 of 19 cases, three tries of three each, on the real model, $2.50.** Recorded as run 8 in [phase-40-replay.md](phase-40-replay.md). 41m changed `src/daemon/runs.ts` and `src/commands/takeover.ts` after it, so one more replay is owed on the final build.

## 2. The real ledger

The ledger was copied first to `.timone/state.json.bak-20260930-166`. The daemon was then restarted on this build (pid 86330, from 05:25 UTC on 2026-10-02).

**What held.** The four failed runs read as cancelled, each with what stopped it: scratch-app #10 and #48, timone #106 and #122. The six runs waiting in the old ways read as waiting for the runner, with their own words: timone #91, #92 and #95 to #98. Nothing was posted on the tickets of the four failed runs.

**What did not hold, and what was done.**

- **The runner ended the six converted conversation runs on Timone's own tickets** in its first cycle, and posted on four of them (#91, #92, #95, #98), for about $0.50. Their `timone` label had been removed on 2026-09-11, and the runner is told when a ticket leaves the listing. The plan had said no comment would appear; its test only covered marked tickets. Ending a run whose ticket is not marked is the runner following its rules, so it stays. 41m makes `timone takeover` on such a ticket open a new run at the step its `wayfinder:` label names.
- **timone #106's reason was a whole machine comment**, and `timone status` printed it, with a command to run. 41m cuts a converted run's reason to one line. After 41m: *"timone #106 was cancelled: stopped before the old code was removed: a build stage escalated"*.
- **`timone status` closes with about 80 finished tickets.** The code on `main` does the same on the same ledger, so this is older. Filed as [#186](https://github.com/fvermaut/timone/issues/186).
- **`timone status` says the daemon runs "an old copy"** when it runs a commit newer than the default branch. Older too. Filed as [#187](https://github.com/fvermaut/timone/issues/187).

## 3. One watched run on scratch-app

The ticket was typed by the machine and said so: [scratch-app #71](https://github.com/fvermaut/scratch-app/issues/71), *Remove every finished to-do at once*. Before it was opened, scratch-app's code was checked: it can delete one to-do at a time and has no way to remove the finished ones together.

| Time (UTC, 2026-10-02) | What happened |
|---|---|
| 05:28 | Picked up and acknowledged on #71. |
| 05:30 | Sorted as a feature, with its reasons and a link to what it read. |
| 05:32 | Three questions, each with a suggestion. fvermaut answered "yes to all" at 06:26. |
| 06:31 | Requirements written and linked, approval asked. fvermaut: "approved" at 06:55. |
| 06:57 | The approval recorded, naming fvermaut's comment by its time. |
| 06:59 | One piece. Approval asked at 07:00; fvermaut: "approved" at 07:38. |
| 07:40 | The requirements and the list merged to scratch-app's `main` after the recorded yes, and step ticket [#72](https://github.com/fvermaut/scratch-app/issues/72) opened. |
| 07:51 | Planning done: four slices. |
| 09:04 | Building done: $13.07. |
| 09:09 to 10:00 | The laptop's lid was closed, and the machine slept. The checking step paused with it. Not a fault. |
| 11:20 | Checking done: $9.63. It asked whether to go to review now or wait for #53 (the tab count, never merged). |
| 11:21 | The runner did not wait for an answer. It started delivery, told it to list the tab title and a VoiceOver listen as not checked, and posted on #72 that the question moves to the pull request. |
| 11:26 | [Pull request #73](https://github.com/fvermaut/scratch-app/pull/73) open, with the code-written departures section first ("The default order was followed."), the question next, and a preview. |

**What each promise needed, and what was seen.**

- **PRD-02.R1 — a marked ticket is picked up and acknowledged:** held, at 05:28.
- **PRD-02.R2 — steps run from the Timone root on the named project:** held. Every step ran in a box on scratch-app, and its commits are on scratch-app's branches only.
- **PRD-02.R4 — requirements are approved on the ticket, then planning follows:** held. The approval was recorded from fvermaut's own comment, and the list of pieces and planning followed.
- **PRD-02.R8 — the pull request carries a preview:** held. The comment names `http://localhost:55073/`, which answered 200, built from the pull request's latest commit `39d5a8b`.

**Stops.** The run stopped four times, each for fvermaut: the three questions, the requirements, the list of pieces. That is the default order for a feature. No stop came from the machine. The plan had predicted one stop; it did not count the questions and the list of pieces, which the default order asks for.

**Cost.** $33.25 for #71 and #72 together, the runner's own sessions included.

## 4. The daemon

fvermaut started it; it is still running at the end of this check, on `3afc263`. 41m's change to the ledger read reaches it only when it is restarted.
