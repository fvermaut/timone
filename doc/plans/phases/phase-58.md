# Phase 58: A long command is not a hung step — the check report names the command still running, and a step's clone takes only the top-level files

> **Status:** Planned.

> **Companion phases:** [phase 40](phase-40.md) built the 15-minute check and its report (`src/runner/brief.ts` `runningStepSection`, `src/daemon/progress.ts` `activitySince`), and the replay set this phase adds two cases to (`src/runner/replay/cases.ts`). [Phase 57](phase-57.md) is the last merged phase; it shares no file with this one. Governing decisions: [ADR-0060](../../adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md) binds slices b and c — the runner decides from what code writes for it, so a report that says less than the truth makes it decide wrong, and a change to its rules is replayed (PRD-05.R18 clause 2). [ADR-0043](../../adr/0043-the-humans-checkout-is-theirs-alone.md) binds slice a — the clone lives in `.timone/stacks/`, never under `projects/`.

> **Screens changed:** none — the daemon's clone and the runner's report are not seen by a person; no slice changes anything a person sees.

## Requirements

> **PRD:** [prd-05-a-runner-decides-each-step.md](../../specs/prd/prd-05-a-runner-decides-each-step.md) — criteria in [prd-05-a-runner-decides-each-step.criteria.md](../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md); [prd-03-a-run-ends-at-its-pull-request.md](../../specs/prd/prd-03-a-run-ends-at-its-pull-request.md) — criteria in [prd-03-a-run-ends-at-its-pull-request.criteria.md](../../specs/prd/prd-03-a-run-ends-at-its-pull-request.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-05.R12 | MUST | At each 15-minute check the runner gets a summary written by code: the commands the step ran since the last check, the time taken, and the output so far. |
| PRD-05.R13 | MUST | The runner can send a running step a message, or stop it — and so must be able to tell a step that works from one that hangs. |
| PRD-05.R18 | MUST | The runner passes the replay of recorded failures, and a change to its rules is replayed before the pull request. |
| PRD-03.R1 | MUST | The build has one ending: a pull request. A step that cannot start cannot reach one. |

Both faults are bugs against these lines, filed as [#238](https://github.com/fvermaut/timone/issues/238) and [#242](https://github.com/fvermaut/timone/issues/242). Both were seen on ivtrends#178 on 2026-10-09 and 10.

## Goal Description

**#238.** On ivtrends#178 the runner stopped three checking steps that were working: 279, 180 and 220 tool calls. Each was stopped at a 15-minute check that fell inside one long test command, of 18, 24 and 35 minutes. While a command runs, a step makes no tool call and writes no token; it only sends a `tool_progress` message every 30 seconds, and that message sets "last wrote something". So the report said "no commands or tools since the last check", "has written 0 tokens" — a count since the last check that reads as a total — and a fresh "last wrote" time. Each time the runner read this as "nothing since the start" and stopped the step. The same report also came from two steps that did hang: ivtrends#176 waited on the model for hours, and on ivtrends#177 one command ran 3 h 53 min. The report cannot tell these apart today. This phase makes it say which command is still running and since when, and say what its counts cover. It also gives the runner one rule: a command that is running is not silence, and a step is left alone while one command runs, unless that command has run for over two hours.

**#242.** Before every step, `bringUpServices` clones the project's branch to read its compose file and `.env.example`, under the command runner's 90-second limit. ivtrends now holds about 180 MB of screenshots under `doc/plans/phases/`; the shallow clone takes 2 min 17 s on the Mac, so it is killed three times, and no step on ivtrends can start. The clone becomes `--depth 1 --filter=blob:none --sparse`: git fetches no file contents up front and checks out only the files at the top of the repository, which is where every accepted compose file name and `.env.example` live. Measured: 2.5 s.

**Decisions that did not reach an ADR.** The two-hour line is a number in the runner's rules, easy to change, and is chosen from the cases seen (35 minutes was real work, 3 h 53 min was a hang); it is not hard to reverse. The sparse checkout means a project whose compose file bind-mounts a file from a subfolder would not find it in this clone. No managed project does that today (ivtrends uses an inline `configs:` entry and a named volume; scratch-app and Timone commit no compose file), and the fix for such a project would be one more path in the sparse set. Easy to reverse, so not an ADR.

**What no criterion watches, and what is owed.** PRD-05.R12 and R13 and PRD-03.R1 are `live`. This phase touches what they depend on, so a live sighting is owed: the next checking step on ivtrends#178 runs through a long command without being stopped, and every ivtrends step starts. That is ivtrends#178 resuming its own work after this merges, not a gate run on it; verification lists it as not run. Not covered here: [#243](https://github.com/fvermaut/timone/issues/243) (nothing wakes the runner after its own session fails), and a stopped step's cost recorded as $0. Both stay open.

## Context & Prerequisites

- **Phase 40** — `src/daemon/progress.ts` (`SessionProgress`, `Activity`, `activitySince`), `src/runner/brief.ts` (`StepActivity`, `runningStepSection`, the rules in `SYSTEM`), `src/runner/session.ts` (`activityOf`), `src/runner/replay/cases.ts` and `recording.ts` (`RunningStepAtMoment`, `progressOf`, `runTry`).
- **`src/daemon/services.ts`** — `bringUpServices`, the `shallow` argument list, `COMPOSE_FILES.accepted`, `ENV_TEMPLATE`. Tests in `src/daemon/services.test.ts` inject the command runner and read its calls.
- **The stream** — the box's lines are parsed into SDK messages and fed to `SessionProgress.observe` (`src/daemon/container-runtime.ts`). A tool call is an `assistant` message with a `tool_use` block; its end is a `user` message with a `tool_result` block of the same id, on the main thread or, for a sub-agent's call, with `parent_tool_use_id` set. A running command sends `{"type":"tool_progress","tool_use_id":…,"tool_name":"Bash","elapsed_time_seconds":…,"heartbeat":true}` every 30 seconds.
- **Evidence** — the three sessions of ivtrends#178 are in the host's `.timone/sessions/` (`2e778383…`, `173fb27a…`, `e44d4dd6…`), and its record in `.timone/records/ivtrends/178.jsonl`. They are on fvermaut's machine, not in this repository; no test reads them.
- **No `doc/standards.md`** in this repository: Timone's own `standards/typescript.md` and `standards/testing.md` (both Approved) apply.

## Sub-phases

### Sub-phase 58a: A step's clone fetches only the top-level files

**[MODIFY]** `src/daemon/services.ts` — the `shallow` argument list becomes `["clone", "--quiet", "--depth", "1", "--filter=blob:none", "--sparse"]`, used by both the branch clone and the fallback. The comment above it says why: the clone is read for the compose file and `.env.example` only, both at the top of the repository, and a project's whole tree (ivtrends: 333 MB at depth 1) does not fit in the runner's 90 seconds (#242).
**[MODIFY]** `src/daemon/services.test.ts` — the cases below.

**Seams under test (TDD):** `bringUpServices`, with the command runner injected as the existing tests do, and once with the real `execCommandRunner` against a local repository. Red-green: (1) the branch clone carries `--filter=blob:none` and `--sparse` besides `--depth 1`; (2) so does the fallback clone after the branch is not found; (3) with the real runner and a local bare repository holding `compose.yaml`, `.env.example` and a file under a subfolder, the clone in `.timone/stacks/<name>` holds the two top-level files and not the subfolder's file, and the compose file is found (the run gets a stack, or the next command it runs is the compose call). Build the bare repository in a temporary folder with plain `git` calls; clone it by its `file://` URL.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/services.test.ts
npx tsc --noEmit
grep -n '"--sparse"' src/daemon/services.ts | grep -v '^\s*//' ; echo "exit: $? (0 expected: the flag is in code)"
```

- [ ] Each clone call `bringUpServices` makes carries `--depth 1`, `--filter=blob:none` and `--sparse`.
- [ ] The real-git test shows the subfolder's file absent and both top-level files present.
- [ ] Red→green evidence in the handoff: the new tests failed before the change.

---

### Sub-phase 58b: The check report names the command still running, since when, and what its counts cover

**[MODIFY]** `src/daemon/progress.ts` — `SessionProgress` keeps each tool call's id with its name and time. A `tool_result` block in any `user` message, main thread or sub-agent, ends the call of that id. `Activity` gains `running: { name: string; since: string }[]`: the calls started and not ended, oldest first, named as `tools` names them. A `tool_progress` message still sets `lastOutputAt` and ends nothing. `liveSubAgents` keeps its present behaviour.
**[MODIFY]** `src/runner/brief.ts` — `StepActivity` gains `running` (same shape). `runningStepSection` takes the brief's `now` and writes, in this order:
- `Commands and tools it used since the last check: …` (as today);
- one line per running call: `Still running: <name>, started at <since>, <N> minutes ago.`, or `No command is running now.` when there is none;
- `Tokens it wrote since the last check: <N>.` in place of `…and has written N tokens.`;
- `It last printed something at <lastOutputAt>. A command that is still running prints a short sign every 30 seconds, and that counts here.` (or `It has printed nothing yet.`);
- the `silent since` line as today.

In `SYSTEM`, the rule `When a running step repeats the same command without getting further, or is silent for a long time, you may send it a message or stop it.` gets a second sentence, as its own bullet just below it: `A command that is still running is not silence. Tests and checks can take an hour. Leave the step alone while one command runs, unless that one command has run for more than two hours; then you may send it a message or stop it.`
**[MODIFY]** `src/runner/session.ts` — `activityOf` passes `seen.running` into the `StepActivity`. A step whose runtime records nothing gets `running: []`.
**[MODIFY]** `src/daemon/progress.test.ts`, `src/runner/brief.test.ts`, `src/runner/session.test.ts` — the cases below, and any existing expectation of the old token sentence.

**Seams under test (TDD):** `SessionProgress.observe` + `activitySince` (pure; the clock is injected), and `buildBrief` (pure; its prompt is a string). Red-green: (1) a tool call with no result is in `running`, with the time it was seen; (2) once its `tool_result` arrives on the main thread, it is not; (3) a sub-agent's call (`parent_tool_use_id` set) ends with its result in a sub-agent `user` message; (4) a `tool_progress` heartbeat moves `lastOutputAt` and leaves the call running; (5) `buildBrief` with a running call prints `Still running: Bash(npx playwright test), started at <t>, 35 minutes ago.`; (6) with none, it prints `No command is running now.`; (7) the token line reads `since the last check`; (8) the rules in `system` hold the new sentence about a command that is still running. And through `activityOf` (via the existing session tests): a running step's activity carries the running call.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/progress.test.ts src/runner/brief.test.ts src/runner/session.test.ts
npx tsc --noEmit
```

- [ ] A call with no result is listed as still running with its start time; a call with a result is not.
- [ ] The report says `No command is running now.` when that is true, and the token count says it covers only the time since the last check.
- [ ] The runner's rules say a running command is not silence, with the two-hour line.
- [ ] Red→green evidence in the handoff.

---

### Sub-phase 58c: The replay holds both moments of #238 — a long test command, and one that hangs

**[MODIFY]** `src/runner/replay/cases.ts` — each entry of `RunningStepAtMoment.tools` may carry `running?: true`: no result had come for it at the moment. Two new cases, after `aBuildThatRunsTheWholeSuiteAgain()` in `CASES`, both on `ivtrends`, a step ticket whose build ended and whose checking step (`verification`) runs, at a 15-minute check (`events: [CHECK_EVENT]`, `checkSince` set):
- **`aLongTestCommandAtACheck()`** — issues `["#238"]`. The checking step started at 07:12; it used tools steadily until 10:59, when it started `Bash` with a browser test command (`npx playwright test e2e/positions-short-text.spec.ts`, `running: true`). Last check at 11:11, wake at 11:34. Happened: "At a 15-minute check, the checking step is inside one browser test command that started 35 minutes ago." Must do: "Leave the step running." Judge: no `step-stopped`, and no `step-started`. Right calls: none.
- **`aCommandThatHangsAtACheck()`** — issues `["#238"]` (the ivtrends#177 moment it records). The checking step started at 19:00; its last call, `Bash(npx playwright test)`, started at 21:20 with `running: true`; last check at 00:58, wake at 01:13. Happened: "At a 15-minute check, one command of the checking step has run for almost four hours." Must do: "Send the step a message, or stop it." Judge: a `step-messaged` or a `step-stopped`. Right calls: one stop.
**[MODIFY]** `src/runner/replay/recording.ts` — `progressOf` feeds, for each tool not marked `running`, a `user` message with its `tool_result` at the time of the next tool, or at its own time for the last one. A tool marked `running` gets no result.
**[MODIFY]** `src/runner/replay/harness.test.ts` — the cases below.

**Seams under test (TDD):** `runTry(moment, runQuery)` with a fake `runQuery` that keeps the prompt it was given and makes no call. Red-green: (1) for `aLongTestCommandAtACheck`, the prompt holds `Still running: Bash(npx playwright test e2e/positions-short-text.spec.ts), started at …`; (2) for `aBuildThatRunsTheWholeSuiteAgain` (#110), whose tools all ended, it holds `No command is running now.` and still lists the suite runs since the last check; (3) the two new cases are in `CASES`. Plus the dry replay, which plays each case's right calls through the real tools.

> Sub-phase 58b must be complete before starting this sub-phase (the prompt's running lines come from 58b).

#### Agent Validation Steps

```bash
npx vitest run src/runner/replay/
npm run replay -- --dry
npx tsc --noEmit
npx vitest run
```

- [ ] The dry replay passes every case, the two new ones included.
- [ ] The #110 case's prompt shows no command still running; the #238 long-command case's prompt shows one.
- [ ] The whole suite passes.
- [ ] **Human gate:** the real replay (`npm run replay`, every case, three tries each, on the model) runs before the pull request, as PRD-05.R18 clause 2 asks for a change to the runner's rules. Its output goes on the pull request. If this session cannot reach the model, fvermaut runs it from his own terminal.

---

No documentation slice: no glossary term, ADR or `process.md` line describes the report's wording or the clone's flags. The register's evidence lines are written at verification.

## Dependency graph

```
58a → (none)        the clone takes only the top-level files (#242)
58b → (none)        the report names the running command; the runner's rule (#238)
58c → 58b           the replay holds the long command and the hung one
```

58a and 58b share no file and may run in parallel.
