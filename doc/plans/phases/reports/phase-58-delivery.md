# Phase 58 — Delivery Report

- **Date:** 2026-10-10
- **Phase:** [phase-58.md](../phase-58.md) — `Complete`, verified in [phase-58-verification.md](phase-58-verification.md)
- **Branch:** `timone/238-a-long-command-is-not-a-hung-step` @ `938891f`
- **Base:** `main` — the project's default branch. The branch was cut from `main` at `ee4e2e8`, which holds phase 57 (#233).
- **Pull request:** opened against this report; its address is on [timone#238](https://github.com/fvermaut/timone/issues/238) and [timone#242](https://github.com/fvermaut/timone/issues/242).
- **Screen:** no user-facing screen in this phase. The phase file's *Screens changed* line says none, so the screen gate was skipped.
- **Questions for the human:** none from the screens. The verification report carries one decision only a person can make (replay case #132), filed as [timone#244](https://github.com/fvermaut/timone/issues/244) and listed under *Outstanding for the human*.
- **Departures:** [`phase-58-departures.md`](phase-58-departures.md) — 3 entries: two plan steps changed during the build, and one requirement not met at the check.

## Scope

This phase was worked by hand in a terminal session that fvermaut asked for on 2026-10-10, for two bugs seen on ivtrends#178: [timone#238](https://github.com/fvermaut/timone/issues/238) and [timone#242](https://github.com/fvermaut/timone/issues/242). There is no list of pieces: two bugs, one pull request. It claims PRD-05.R12, PRD-05.R13, PRD-05.R18 (register [prd-05](../../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md)) and PRD-03.R1 (register [prd-03](../../../specs/prd/prd-03-a-run-ends-at-its-pull-request.criteria.md)), all MUST.

The clone made before every step now fetches one commit, no file contents up front, and only the files at the top of the repository. On ivtrends that clone took 2 min 17 s and was killed at 90 s, so no step could start; with the new flags it takes 2.5 s. At each 15-minute check, the runner's report now names every call still running, when it started and how many minutes ago. The runner's rules gain one line: a running command is not silence; leave the step alone unless one command has run more than two hours. The replay gains two cases from #238.

## How to try it

### Against the preview

Timone has no preview configured for pull requests. Use the steps on a local checkout below.

### On a local checkout

1. Set up the clone as [README.md](../../../../README.md) says. Then check out `timone/238-a-long-command-is-not-a-hung-step` and run `npm ci && npm run build`.
2. `npx vitest run src/daemon/services.test.ts` — 25 tests pass. One of them clones a real repository with the new flags and shows that a file in a subfolder is not fetched, while the two top-level files the step needs are.
3. `npx vitest run src/daemon/progress.test.ts src/runner/brief.test.ts src/runner/session.test.ts` — 109 tests pass. They cover the 15-minute check report: a command with no result yet is listed as still running, with its start time and how many minutes ago; with none running, the report says `No command is running now.`
4. `npm run replay -- --dry` — 24 of 24 cases pass. This checks that every case is wired up; it does not call the model.
5. Optional, needs a model login and costs money: `npm run replay -- --case 238` runs the two new cases on the model, three tries each. You should see both pass: the step inside a 35-minute test command is left running, and the command that has run almost four hours gets a message or a stop. `npm run replay -- --case 132` shows the one failing case: the runner asks whether "aproved" meant approve.
6. After the merge, the update of the Timone folder and a restart of the daemon: on ivtrends#178, the next step starts (the clone before it no longer times out), and a checking step that runs a long test command is not stopped at its 15-minute check.

## Verification outcome

Verified in [phase-58-verification.md](phase-58-verification.md) — 1 of 2 fix loops consumed. The gate is not met: one regression, PRD-05.R18, not resolved.

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-05.R12 | MUST | live | LIVE-GATE | 0 |
| PRD-05.R13 | MUST | live | LIVE-GATE | 0 |
| PRD-05.R18 | MUST | api | REGRESSION | 1 |
| PRD-03.R1 | MUST | live | LIVE-GATE | 0 |
| PRD-05.R2, R3, R4, R5, R7, R10, R11 | MUST | api | PASS | 0 |
| PRD-07.R1, R2, R4, R6, R9, R10 | MUST | api | PASS | 0 |
| PRD-08.R5 | MUST | api | PASS | 0 |
| PRD-09.R2, R4, R5 | MUST | api | PASS | 0 |
| PRD-10.R2, R3, R4, R5, R6 | MUST | api | PASS | 0 |

### Outstanding for the human

- [ ] PRD-05.R18 — replay case #132 fails 0 of 3 because PRD-05.R18's table and PRD-04.R1 clause 1 ask for opposite things on a misspelled approval word. Choose which one changes ([timone#244](https://github.com/fvermaut/timone/issues/244); [phase-58-verification.md](phase-58-verification.md) § Carried forward), then run the real replay again from your own terminal: `cd ~/dev/timone/projects/timone && npm run build && npm run replay 2>&1 | tee ~/dev/timone/.timone/replay-58b.txt`.
- [ ] PRD-05.R12, PRD-05.R13 — live sighting owed: on ivtrends#178 after this merges, its next checking step runs through a long test command and is not stopped. What to watch is in [phase-58-verification.md](phase-58-verification.md) § Live gates.
- [ ] PRD-03.R1 — live sighting owed: every ivtrends step starts again. Same section.

## Standards review — phase 58

- **Read:** `git diff origin/main...938891f -- src`; `standards/code-smells.md`; `package.json`; `tsconfig.json`. There is no ESLint, Prettier or Biome config in the project, and no `doc/standards.md`. For line numbers and context I also read these subject files at `938891f`: `src/runner/replay/cases.ts`, `src/runner/replay/recording.ts`, `src/daemon/progress.ts`, `src/runner/brief.ts`, `src/runner/session.ts`, `src/daemon/services.ts`. One grep reached outside the subject: it looked for an existing check-interval constant and found `src/runner/driver.ts:264`.
- **Diff:** `origin/main...938891f`: 11 files under `src/`, +907/−45
- **Findings:** 4

### 1. The replay's timing values are written as bare numbers, and one of them already has a named constant — Magic number or string

- **Where:** `src/runner/replay/cases.ts:373–375`; `src/runner/replay/recording.ts:394–396`
- **What:** The new `checksUntil` steps back through time with `at -= 15 * 60 * 1000`. Its comment calls these "the 15-minute checks". The value is the runner's check interval, and `src/runner/driver.ts:264` already exports it as `RUNNER_CHECK_INTERVAL_MS = 15 * 60_000`. `cases.ts` already imports from `../driver.js`, so the constant costs no new import. In `progressOf`, `for (let seconds = 30; started + seconds * 1000 <= Date.parse(now); seconds += 30)` writes the SDK's 30-second heartbeat interval twice in one line. The same fact appears again in the brief's text ("prints a short sign every 30 seconds").
- **Why it matters:** These are magic numbers: literals with domain meaning written at the place they are used. If the check interval changes in `driver.ts`, the replay records keep making 15-minute checks without any error, and the two #238 cases would no longer show the timing they claim to show.
- **Suggested remediation:** Use `RUNNER_CHECK_INTERVAL_MS` in `checksUntil`. Give the heartbeat interval a named constant in `recording.ts`. Not applied here.

### 2. The replay's tool-call id is built three times in one function — Duplicated code

- **Where:** `src/runner/replay/recording.ts:388`, `:400`, `:416`
- **What:** `progressOf` now builds `` `toolu_replay_${index}` `` three times. Line 388 builds it for the `tool_use` id, line 400 for the heartbeat's `tool_use_id`, and line 416 for the `tool_result`'s `tool_use_id`. Two of the three copies are new in this diff. The feature depends on all three being equal: `SessionProgress` opens a call by the first id and closes it by the third.
- **Why it matters:** This is duplicated code at the third copy (the rule of three). The repeated one-liner is one decision written three times. If one copy changes, the replay shows a call as running forever, and no test fails.
- **Suggested remediation:** Compute `const id = \`toolu_replay_${index}\`` once at the top of the loop body. Moving the heartbeat block (lines 393–408) into its own named function would also shorten `progressOf`. It is now 61 lines, against 7 to 12 lines for the functions around it. Not applied here.

### 3. `since` names a call's start time, next to `since` as the check moment and `startedAt` as the step's start — Inconsistent vocabulary

- **Where:** `src/daemon/progress.ts:61`, `:252`, `:266–269`; `src/runner/brief.ts:48`, `:519`; `src/runner/session.ts:701`, `:712`, `:719`
- **What:** The new field `running: { name: string; since: string }[]` stores when each call started. In `activitySince`, the local `const since = Date.parse(instant)` (the moment the runner looked) sits three lines above the new `since: new Date(call.at).toISOString()` (when a call started). `activityOf` repeats the pattern: `const since = checkSince ?? step.startedAt` is the check moment, and `running: seen.running` carries a different `since` per call. In the same `StepActivity` type, the step's own start time is `startedAt`, and the brief has to rename the field when it prints it: `` `started at ${call.since}` ``. `activityOf` also now uses `running` for two things: its parameter `running: RunningSteps` (the running steps) and the new property `running` (the open calls). The same field shape is declared twice, in `Activity` and in `StepActivity`.
- **Why it matters:** This is inconsistent vocabulary. One concept (when something started) has two names, `startedAt` and `since`. One name, `since`, means two things in the same function. A reader has to read the function body to know which time a `since` holds.
- **Suggested remediation:** Rename the call's field to `startedAt`, and declare the `{ name, startedAt }` shape once as a named type that both `Activity` and `StepActivity` use. Not applied here.

### 4. `shallow` now holds a sparse, contents-on-demand clone, not only a shallow one — Uncommunicative name

- **Where:** `src/daemon/services.ts:198–205` (used at `:226`, `:231`, `:238`)
- **What:** The array named `shallow` now holds `"--depth", "1", "--filter=blob:none", "--sparse"`. The comment above it says the property that matters is the new one: "only the files at the top of the repository". At the three call sites, `[...shallow, remote, source]` reads as a shallow clone only.
- **Why it matters:** The name was accurate before this diff and now describes one option out of three. Someone who later reads a file below the top of the repository from this clone (for example a compose `include:`) has no hint at the call site that the file will not be there. That is an uncommunicative name.
- **Suggested remediation:** Rename the array to say what the clone holds, for example `topLevelCloneArgs`. Not applied here.

## Spec review — phase 58

- **Read:** `git diff origin/main...938891f -- src` (the 11 files), plus the current content of `src/daemon/progress.ts`, `src/daemon/services.ts`, `src/runner/brief.ts`, `src/runner/session.ts`, `src/runner/session.test.ts`, `src/runner/replay/recording.ts` and `src/runner/replay/cases.ts` at `938891f`; `doc/specs/prd/prd-05-a-runner-decides-each-step.md`; `doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md` (R12, R13, R18, and its diff); `doc/specs/prd/prd-03-a-run-ends-at-its-pull-request.md`; `doc/specs/prd/prd-03-a-run-ends-at-its-pull-request.criteria.md` (R1); `doc/plans/phases/phase-58.md` lines 1–8 and the `## Requirements` section only.
- **Diff:** `origin/main...938891f`: 11 files under `src/`, +907/−45
- **Findings:** 4

### 1. The new "leave it alone" rule overrides the #110 rule, and the #110 replay case cannot show this. PRD-05.R13, PRD-05.R18

- **Where:** `src/runner/brief.ts:173` and `src/runner/brief.ts:194`; `src/runner/replay/recording.ts:411`
- **What:** The new rule says: "Leave the step alone while one command runs, unless that one command has run for more than two hours". The older rule at line 194 says that when the step "has run the whole test suite … more than twice since the last check, send it a message". A step that keeps running the whole suite is usually in the middle of one more suite run when the check comes. Read literally, the new rule then tells the runner to send nothing. The replay does not test this overlap. `progressOf` gives the last call its result "at its own time" (`at = Date.parse(step.tools[index + 1]?.at ?? use.at)`). So in the #110 case, the suite run started at 11:57:30 shows as finished at the 11:59:30 wake. That case's own suite runs take about 2.5 minutes, so in reality that run would still be going. The harness test confirms the replay shows "No command is running now." for #110.
- **Why it matters:** PRD-05.R13 clause 1 and the #110 row of the PRD-05.R18 table require the runner to send this step a message. The changed rules make that less likely in the usual real case, and the replay would not notice.
- **Suggested remediation:** Make the new rule give way to the #110 rule, for example: "a message is not a stop; the whole-suite rule still applies". Then add, or change, a replay case in which the seventh suite run is still running at the check. — not applied here

### 2. A sub-agent's call is reported as a running command, so a sub-agent that works for more than two hours reads like a hung command. PRD-05.R13

- **Where:** `src/daemon/progress.ts:152–155`; `src/runner/brief.ts:173`, `src/runner/brief.ts:508–523`
- **What:** `openCalls` records every `tool_use`, including the `Agent` call that runs a sub-agent. The report prints it as "Still running: Agent(…), started at …, N minutes ago". The sub-agent's own current command is printed as a second "Still running:" line (see the brief test with `Agent(Check the due dates)`). The rule makes an exception only for "that one command" running "for more than two hours". It does not say that an `Agent` line covers many commands that start and end. A sub-agent that builds one slice for more than two hours, while its own calls keep finishing, is shown in the same way as one command that hangs.
- **Why it matters:** The phase claims PRD-05.R13 because the runner "must be able to tell a step that works from one that hangs". The two-hour rule cannot tell these two apart.
- **Suggested remediation:** Either list sub-agent calls apart from commands (for example "A sub-agent is working: …"), or have the rule apply the two-hour limit only to a call that has no newer calls inside it. Add a brief test or a replay case for a sub-agent that runs for a long time and is working. — not applied here

### 3. The sparse clone assumes compose reads only the two top-level files. Compose can read files further down. PRD-03.R1

- **Where:** `src/daemon/services.ts:190–205`, used at `src/daemon/services.ts:294` and after
- **What:** The comment says "This clone is read for two files, the compose file and `.env.example`, and both sit at the top", and the clone now adds `--filter=blob:none` and `--sparse`. But it is `docker compose` that reads the clone, using `config --services`, then `up`, then `down`, with `cwd: source`. Compose also reads any file the compose file names: an `env_file:`, an `include:` or `extends:` file, or a bind-mounted folder such as a database start-up script folder. With `--sparse`, none of these exist on disk if they sit in a subfolder. A missing `env_file` makes compose fail. A missing bind-mount source is created as an empty folder, so the database starts without its scripts and reports nothing. The real-git test only checks a compose file that names nothing outside the top level.
- **Why it matters:** PRD-03.R1 is claimed for "a step that cannot start cannot reach one". The change fixes the clone time, but a project whose compose file points into a subfolder could now fail to start, or start with services set up wrong.
- **Suggested remediation:** Add to the sparse set the folders that the compose file names, or fall back to a full checkout when `docker compose config` names a path below the top. Add a test with an `env_file` or a bind mount in a subfolder. — not applied here

### 4. The R18 table does not list the two #238 cases, so the R18 verdict says nothing about them. PRD-05.R18

- **Where:** `doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md:337–373`; `src/runner/replay/cases.ts:2690`, `src/runner/replay/cases.ts:2819`
- **What:** The diff adds `aLongTestCommandAtACheck` and `aCommandThatHangsAtACheck` to `CASES`. Clause 1 of R18 binds only "each case in the table below", and the table still ends at the #110 row. The new evidence line counts "the other 18 cases of the table" and does not say whether the two #238 cases passed their three tries.
- **Why it matters:** The phase claims PRD-05.R18 so that its rule change is checked by replay. As the register is written, the two cases built for that check could fail without changing R18's status.
- **Suggested remediation:** Add the two #238 rows to the R18 table. Also make the evidence line state their result. The same applies to the other cases outside the table. — not applied here

## Notes

- **#132 is older than this phase.** The runner was told to ask about a misspelled approval word on 2026-10-05 (phase 53). The real replay had last run on 2026-09-28. Phase 58's change to the rules is about a running command, and #132's moment has no step running. The decision is filed as [timone#244](https://github.com/fvermaut/timone/issues/244).
- **Spec finding 3 is the known limit** the completion report names: a compose file that reads something below the top folder would not find it in this clone. No managed project does that today.
- **One sentence of the verification commit message is slightly wrong.** `938891f` says four check scripts were fixed; three were, and PRD-07.R9 was not. The verification report is correct.
- **Not in this phase:** [timone#243](https://github.com/fvermaut/timone/issues/243) (nothing wakes the runner after its own session fails), and a stopped step's cost recorded as $0. ivtrends#178 needs a comment after the merge to wake its runner.
- The daemon runs the code of the Timone folder itself, not of `projects/timone`. After the merge, that folder must be updated and rebuilt, and the daemon restarted.
