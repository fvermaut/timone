# Phase 58 — Completion Report

- **Date:** 2026-10-10
- **Plan:** [phase-58.md](../phase-58.md) — no breakdown: two bugs, worked by hand in a terminal session that fvermaut asked for ("yes", 2026-10-10), triaged on [#238](https://github.com/fvermaut/timone/issues/238) and [#242](https://github.com/fvermaut/timone/issues/242).
- **Requirements:** PRD-05.R12 (MUST) — draft; PRD-05.R13 (MUST) — draft; PRD-05.R18 (MUST) — verified; PRD-03.R1 (MUST) — draft. Statuses as execution leaves them; none was changed.
- **Branch:** `timone/238-a-long-command-is-not-a-hung-step`
- **Departures:** [phase-58-departures.md](phase-58-departures.md) — 2 entries.

## Summary

The clone made before every step now fetches one commit, no file contents up front, and only the files at the top of the repository (`--filter=blob:none --sparse`). On ivtrends that clone took 2 min 17 s and was killed at 90 s, so no step could start; measured with the same flags, it takes 2.5 s.

At each 15-minute check, the runner's report now names every call still running, when it started and how many minutes ago, says the token count covers only the time since the last check, and explains that a running command's 30-second sign keeps "last printed" recent. The runner's rules gain one line: a running command is not silence; leave the step alone unless one command has run more than two hours. On ivtrends#178 the runner had stopped three working checks because the old report read the same for a 35-minute test command and for a hang.

The replay gained two cases from #238: a checking step inside a 35-minute browser test command must be left running, and one whose command has run almost four hours must get a message or be stopped. The replay's running step now ends each finished call with its result, and a running call sends the 30-second sign a real one sends.

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 58a — a step's clone fetches only the top-level files | landed first try; case 3 amended before dispatch (real git only, no Docker) | `17fe3fe` |
| 58b — the check report names the command still running | landed first try | `56fbc3d` |
| 58c — the replay holds both moments of #238 | landed after one amendment (the 30-second sign for a running call), which the slice itself raised; human gate answered: real replay 23 of 24, both new cases 3 of 3 | `66a7af7` |

## Tests run

No suite was timed before the first slice: phase 57's close timed the whole suite at 11.9 s. A first whole run on this branch after `npm run build`, before any change: 77 files, 2725 tests, all passed, 21.1 s.

- **58a:** `src/daemon/services.test.ts` (25 passed); the whole suite (2733 passed, with 58b's work in progress in the tree).
- **58b:** `src/daemon/progress.test.ts`, `src/runner/brief.test.ts`, `src/runner/session.test.ts` (109 passed); the whole suite (2738 passed).
- **58c:** `src/runner/replay/` (7 passed); `npm run replay -- --dry` (24 of 24); the whole suite (2742 passed).
- **Close:** after `npm run build`, the whole suite once: 77 files, 2742 tests, all passed, 20.3 s. Then each sub-phase's validation steps once, in the order 58a, 58b, 58c (none changes state outside the repository): 58a 25 passed, the `--sparse` probe exit 0; 58b 109 passed; 58c 7 passed, dry replay 24 of 24; `npx tsc --noEmit` exit 0.
- **The real replay** (58c's human gate): run by fvermaut from his own terminal at `66a7af7`, 23 of 24, $2.97 — see [phase-58-replay.md](phase-58-replay.md).

## Screen comparison

None — the phase changes no screen.

## Deviations from the plan

- ✏ 2026-10-10, 58a case 3: the test's runner passes `git` to the real command runner and records every other command, so no compose stack starts in Docker.
- ✏ 2026-10-10, 58c: a running call in the replay also sends the 30-second sign, so the new cases show the moment they name (fresh "last printed", no "silent since").

Both are in [phase-58-departures.md](phase-58-departures.md).

## Context for the next agent

- Run the suite with `npm run build && npx vitest run` from `projects/timone`. The dry replay is `npm run replay -- --dry`; the real one needs a model login and costs about $3.
- **#132 fails on the real replay, three tries of three, and the cause is older than this phase.** Phase 53 let the runner ask whether a misspelled word meant approve; #132 wants the approval recorded. The real replay was not run after phases 50 and 53. Not fixed here.
- **Live, owed:** PRD-05.R12, R13 and PRD-03.R1 are `live`. The sighting is ivtrends#178 itself after this merges: its next step starts, and its next checking step runs through a long command without being stopped. Not a gate run on it: it is that ticket's own work going on.
- **Known limit of 58a:** a compose file that reads something below the top folder (a bind mount, an `env_file` or a build context in a subfolder) would not find it in this clone. No managed project does that today.
- Not in this phase: [#243](https://github.com/fvermaut/timone/issues/243) (nothing wakes the runner after its own session fails), and a stopped step's cost recorded as $0.
