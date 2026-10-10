# Phase 58 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 58a — A step's clone fetches only the top-level files

**Built.** Before a step starts, the daemon clones the project into `.timone/stacks/<name>` to read the compose file and `.env.example`. That clone now fetches one commit, no file contents until git checks a file out, and checks out only the files at the top of the repository. All three clone calls `bringUpServices` makes do this: the clone of the run's branch, the fallback to the default branch when that branch does not exist yet, and the clone made when the run names no branch. Against a real repository, the clone holds `compose.yaml` and `.env.example` and not a file under a subfolder, and the compose file is still found.

**Files touched.**

- `src/daemon/services.ts` — the `shallow` argument list is now `["clone", "--quiet", "--depth", "1", "--filter=blob:none", "--sparse"]`. The comment above it says the clone is read for two top-level files, and that a whole tree at depth 1 (ivtrends: 333 MB) did not fit in the runner's 90 seconds (#242).
- `src/daemon/services.test.ts` — four new tests: three with the recording runner (branch clone, fallback clone, no-branch clone), one with real git against a local bare repository. Imports added for the real-git test (`node:child_process`, `node:fs`, `node:os`, `node:path`, `node:url`, `afterEach`, `execCommandRunner`).

**Decisions taken inside the slice.**

1. All new tests were written and seen red before the one change. The plan makes a single argument list shared by every clone call, so one edit turns every case green at once. Turning them green one by one would need an in-between state the plan does not describe.
2. A fourth test covers the clone made when the run names no branch. It is a third clone call site in the code, and the first checkbox says "each clone call". Same seam, same style as case 2.
3. In case 3 the bare repository has `uploadpack.allowFilter=true`. GitHub honours a clone's filter; a local repository does not unless told to, and then git only warns and sends every file. With the setting, the test runs the same filtered clone the daemon runs against GitHub, and no "filtering not recognized" warning is printed.
4. In case 3 the run's branch, `timone/7-slow`, exists in the bare repository, so the ordinary branch clone is the one run for real. The fallback is covered by the recording-runner test.
5. In case 3 the clone is read when the first non-`git` command is recorded (the second option in the plan's note), by checking that three paths exist. The fixture's own git calls run with a home folder in the temp folder, no system config, no `GIT_*` variables, and `-c user.name/-c user.email` on the commit — the same idiom as `src/merge-rules.git.test.ts`. The clone itself goes through the real `execCommandRunner` with the process environment, as in production.

**Validation evidence.**

Red, before the change to `services.ts`:

- Case 1, `clones the branch with one commit and only the top-level files`: `× … → expected [ 'clone', '--quiet', '--depth', …(5) ] to include '--filter=blob:none'` (at `services.test.ts:361`).
- Case 2, `clones the default branch the same way when the run's branch does not exist yet`: `× … → expected [ 'clone', '--quiet', '--depth', …(3) ] to include '--filter=blob:none'`.
- Extra, `clones the default branch the same way when the run names no branch`: `× … → expected [ 'clone', '--quiet', '--depth', …(3) ] to include '--filter=blob:none'`.
- Case 3, `leaves only the top-level files on disk, and still finds the compose file`: `AssertionError: expected true to be false` at `expect(seen?.nested).toBe(false)` (`services.test.ts:565`). Every assertion before it passed: a stack was returned, the first non-git command was `docker compose`, the folder was under `<root>/.timone/stacks`, and both top-level files were present. Only the subfolder's file being present failed.

Green, after the change: `✓ src/daemon/services.test.ts (25 tests)` — all four new tests pass, and the 21 existing ones still pass.

Validation block, as run from `projects/timone`:

```
$ npx vitest run src/daemon/services.test.ts
 Test Files  1 passed (1)
      Tests  25 passed (25)
exit: 0
$ npx tsc --noEmit
exit: 0
$ grep -n '"--sparse"' src/daemon/services.ts | grep -v '^\s*//' ; echo "exit: $? (0 expected: the flag is in code)"
204:    "--sparse",
exit: 0 (0 expected: the flag is in code)
```

- [x] Each clone call `bringUpServices` makes carries `--depth 1`, `--filter=blob:none` and `--sparse`. **PASS** — the three recording-runner tests (branch clone, fallback, no branch) assert all three on each call.
- [x] The real-git test shows the subfolder's file absent and both top-level files present. **PASS** — `seen.compose` and `seen.env` true, `seen.nested` false.
- [x] Red→green evidence in the handoff: the new tests failed before the change. **PASS** — see the red lines above.

Whole suite: `npx vitest run` → `Test Files 77 passed (77)`, `Tests 2733 passed (2733)`. The count includes the other slice's tests in `src/daemon/progress.test.ts`, which were in the working tree at the time.

**What delivery must know.**

- The clone now holds only top-level files. A compose file that reads something below the top folder — a bind mount such as `./db/init:/docker-entrypoint-initdb.d`, an `env_file` in a subfolder, a build context in a subfolder — will find it missing, and docker may create an empty folder for a missing bind mount without an error. The plan's premise is that only the two top-level files are read. I did not check the managed projects' compose files, because they are outside this slice's folder. Worth a look before or at verification.
- The 333 MB figure is from the plan. This slice did not measure the new clone against ivtrends. That is a live check.
- `--sparse` needs git 2.25 or later on the machine that runs the daemon (the Mac has 2.50.1).

## 58b — The check report names the command still running, since when, and what its counts cover

**Built.** `SessionProgress` now remembers every tool call it has seen and has had no result for. A `user` message with a `tool_result` block ends the call of the same `tool_use_id`, on the main thread or inside a sub-agent. A `tool_progress` heartbeat moves the time of the last output and ends nothing. `activitySince` returns these calls as `running`, oldest first, whatever the moment asked about. The runner's report on a running step now says, in this order: the tools used since the last check; one `Still running: …` line per open call, or `No command is running now.`; `Tokens it wrote since the last check: N.`; when the step last printed something, and that a running command's 30-second sign counts there (or `It has printed nothing yet.`); the silent line as before. The runner's rules have a new rule just below the one on silence: a command that is still running is not silence, and a step is left alone while one command runs, unless that one command has run for more than two hours. `activityOf` passes the open calls into the brief, and `running: []` for a step whose runtime records nothing.

**Files touched.**

- `src/daemon/progress.ts` — `Activity.running`; a private `openCalls` map keyed by tool-use id; `toolUseNames` became `toolUsesIn`, which also returns the id; every `user` message's `tool_result` ids end their calls, and only a main-thread one still ends a sub-agent (`liveSubAgents` unchanged).
- `src/daemon/progress.test.ts` — `toolUse` takes an optional `{ id, parent }`, `toolResult` an optional `parent`, and both still work as before when these are left out; new describe "the tool calls still running" with cases 1–4.
- `src/runner/brief.ts` — `StepActivity.running`; `runningStepSection(activity, now)` with the new lines; `minutesAgo` helper; the new rule in `SYSTEM`; corrected comments on `lastOutputAt` and `outputTokens` (the count is since the last check).
- `src/runner/brief.test.ts` — the existing running-step test now holds the whole section in order, the new token line, and no "has written"; new tests for cases 5, 6, the singular minute, "printed nothing yet", and case 8.
- `src/runner/session.ts` — `activityOf` passes `seen.running`, and `running: []` when there is no `SessionProgress`; its comment says so.
- `src/runner/session.test.ts` — the existing "what the running step did since the last check" test now also expects the running call.

**Decisions taken inside the slice.**

- **Minutes are counted down** (`Math.floor`): a command that has run 35 min 40 s reads "35 minutes ago". This never overstates how long a command has run.
- **"1 minute ago", not "1 minutes ago".** The plan's line is `<N> minutes ago.` A call that started one minute before a wake would otherwise read as wrong English. I added one red-green test for it. Every other N follows the plan's wording exactly.
- **A `tool_use` block with no string id is listed among the tools but never as running.** It could never be matched to a result, so it would be shown as running for ever. Real SDK blocks always carry an id. This only keeps the defensive reading the file already does.
- **The running list is not filtered by the check time.** A command that started before the last check and still runs is listed. The plan says "the calls started and not ended"; case 1 tests this with a check time after the call started.

**Validation evidence.**

Red then green, per case, each run on its own test file:

1. `progress.test.ts` › "lists a call that has no result yet, with the time it was seen, though it started before the moment". Red: `AssertionError: expected undefined to deeply equal [ { …(2) } ]`. Green after adding `Activity.running` and `openCalls` (28 passed).
2. "drops a call once its result comes back on the main thread, and keeps the others". Red: `AssertionError: expected [ …(2) ] to deeply equal [ Array(1) ]`. Green after the main-thread `user` branch ended the call (29 passed).
3. "drops a sub-agent's call once its result comes back inside that sub-agent". Red: `AssertionError: expected [ { …(2) }, …(1) ] to deeply equal [ { …(2) } ]`. Green after every `user` message ended its calls, with `liveSubAgents` still ended only from the main thread (30 passed).
4. "takes a running command's heartbeat as output, and leaves the command running". **Passed on its first run**: `observe` already set the last output time for any message, and nothing reads `tool_progress`. To show the test can fail, I added a temporary branch that ended a call on its `tool_progress`. Red: `AssertionError: expected [] to deeply equal [ { …(2) } ]`. I then restored the file and the test passed again (31 passed).
5. `brief.test.ts` › "names each command still running, when it started, and how many minutes ago" (two calls, at 50 and 35 minutes). Red: `AssertionError: expected '## Why you were woken\n\nIt is now 20…' to contain 'Commands and tools it used since the …'`. Green after `StepActivity.running` and the `Still running:` lines (48 passed; the existing fixture gained `running: []`).
   - Through `activityOf`: `session.test.ts` › "tells the runner what the running step did since the last check, and since when it has been silent" now expects `Still running: Bash(npm test), started at 2026-09-27T11:40:00.000Z, 20 minutes ago.` Red: `TypeError: Cannot read properties of undefined (reading 'prompt')`. Because `activityOf` gave no `running`, the brief could not be built and the runner was never started. Green after `activityOf` passed `seen.running` (26 passed).
6. "says no command is running when every call it started has ended". Red: `AssertionError: expected '## Why you were woken\n\nIt is now 20…' to contain 'Commands and tools it used since the …'`. Green (49 passed).
7. The existing "shows what the running step has done since the last check, or says no step is running" now holds the whole section in order, and has no "has written". The new "says a step that has printed nothing yet has printed nothing, after its token count" was added with it. Both were red: `expected '…' to contain '## The running step\n\nA step is runn…'` and `expected '…' to contain 'No command is running now.\nTokens it…'`. Green after the token and printed lines (50 passed).
8. "leaves a step alone while one command runs, unless that command has run for more than two hours, in the rule just below the one on silence". Red: `AssertionError: expected '- A run that changed the project\'s f…' to be '- A command that is still running is …'`. Green after the rule was added to `SYSTEM` (51 passed).
- Extra: "says one minute, not one minutes, for a command that started a minute ago". Red: `expected '…' to contain 'Still running: Bash(npm test), starte…'`. Green (52 passed).

Validation block, as run:

```
$ npx vitest run src/daemon/progress.test.ts src/runner/brief.test.ts src/runner/session.test.ts
 ✓ src/daemon/progress.test.ts (31 tests)
 ✓ src/runner/brief.test.ts (52 tests)
 ✓ src/runner/session.test.ts (26 tests)
 Test Files  3 passed (3)
      Tests  109 passed (109)
$ npx tsc --noEmit
(no output, exit 0)
```

- [x] A call with no result is listed as still running with its start time; a call with a result is not. PASS (cases 1–3; through `activityOf` in the session test).
- [x] The report says `No command is running now.` when that is true, and the token count says it covers only the time since the last check. PASS (cases 6 and 7).
- [x] The runner's rules say a running command is not silence, with the two-hour line. PASS (case 8).
- [x] Red→green evidence in the handoff. PASS (above; case 4 green on first run, with a temporary change shown to turn it red).

Whole suite: `npx vitest run` → `Test Files 77 passed (77)`, `Tests 2738 passed (2738)`. No other test file expected the old token sentence. A search of `src/` found "has written N tokens" and "last wrote something" only in `brief.ts` and `brief.test.ts`.

**What 58c must know.**

- `Activity.running` is `{ name: string; since: string }[]`. `StepActivity.running` is the same, as `readonly`. `name` is the same as in `tools`: `Bash(<command>)`, with the command cut to 100 characters by `summarise`. `since` comes from `new Date(at).toISOString()`, so it has milliseconds: `2026-10-10T10:59:00.000Z`.
- A call leaves `running` only when a `user` message carries a `tool_result` block with the **same `tool_use_id`**. `parent_tool_use_id` may be `null` or a sub-agent's id. The replay's `progressOf` gives the calls the ids `toolu_replay_${index}`, so its results must use those ids. **Until 58c changes `progressOf`, every tool of every replay case shows as still running in the prompt.** No test checks this today, and the suite passes.
- The running list does not depend on `checkSince`.
- The lines as built, in order, after `Commands and tools it used since the last check: …`:
  - `Still running: <name>, started at <since>, <N> minutes ago.` (one line per open call, oldest first; `1 minute ago.` when N is 1), or `No command is running now.`
  - `Tokens it wrote since the last check: <N>.`
  - `It last printed something at <lastOutputAt>. A command that is still running prints a short sign every 30 seconds, and that counts here.` or `It has printed nothing yet.`
  - `It has been silent since <silentSince>.` (only when silent)
- N is the whole minutes, counted down, from `since` to the brief's `now`. In the replay, `now` is the case's wake time. For `aCommandThatHangsAtACheck` (21:20 → 01:13 the next day) that gives `233 minutes ago.`; for `aLongTestCommandAtACheck` (10:59 → 11:34) `35 minutes ago.`
- A main-thread `Agent(…)`/`Task(…)` call stays in `running` until its own result comes back on the main thread. While a sub-agent works, it is listed as still running.
- The new rule in `SYSTEM`, under "## How you act", just below the silence rule: `- A command that is still running is not silence. Tests and checks can take an hour. Leave the step alone while one command runs, unless that one command has run for more than two hours; then you may send it a message or stop it.`

## 58c — The replay holds both moments of #238 — a long test command, and one that hangs

**Built.** The replay now holds two more cases, just after the #110 case. Both are on ivtrends, on a step ticket whose build has ended and whose checking step runs, at a 15-minute check. In the first (ivtrends#178), the checking step is inside one browser test command that started 35 minutes ago; the runner must leave the step running, and a try passes when it neither stops the step nor starts one. Its right calls are none. In the second (ivtrends#177), one command has run for 233 minutes; the runner must send the step a message or stop it, and its right call is one stop. The replay's running steps now get a result for each tool call, so the runner is shown a call as ended once the next call came. Only a call the case marks `running` is shown as still running. Before this, every tool of the #110 case was shown as still running. A call marked `running` also sends the sign a real running command sends every 30 seconds, up to the wake. So the runner is shown the step as having printed something at the wake, and not as silent, as on ivtrends#178 and #177.

**Files touched.**

- `src/runner/replay/cases.ts` — `RunningStepAtMoment.tools` entries may carry `running?: true`. New helper `checksUntil(run, startedAt, last)`: the record of the 15-minute check wakes, one every 15 minutes counted back from the last check. New right-call helper `stopStepCall(reason)`. New cases `aLongTestCommandAtACheck()` and `aCommandThatHangsAtACheck()`, added to `CASES` after `aBuildThatRunsTheWholeSuiteAgain()`. The section heading now says twenty-four cases, and the file's opening comment says "seven other cases".
- `src/runner/replay/recording.ts` — `progressOf` feeds, for each tool not marked `running`, a main-thread `user` message with a `tool_result` of the same id (`toolu_replay_${index}`), at the time of the next tool, or at the tool's own time for the last one. For each tool marked `running`, it feeds a `tool_progress` message (`heartbeat: true`, `elapsed_time_seconds` 30, 60, …) every 30 seconds from the call's start up to the wake, at those times, after the step's other calls. The signs of all running calls are fed in the order of their times. The clock ends at `now`, as before.
- `src/runner/replay/harness.test.ts` — a fake `runQuery` that keeps the prompt, calls nothing and ends at once; three new tests (cases 1–3), and a fourth for the 30-second sign (the plan's ✏ 2026-10-10 note); the file's opening comment says it now also tests what the runner is shown at a case's moment (the old comment said "nineteen cases", which was out of date).

**Decisions taken inside the slice.**

- **The 30-second sign of a running call was decided by the orchestrator, not by this slice.** The first build followed the plan as written, and both new prompts said "It has been silent since <the command's start>". This slice reported it. The orchestrator then amended the plan (✏ 2026-10-10 under the `recording.ts` marker of 58c): a call marked `running` gets a `tool_progress` heartbeat every 30 seconds up to the wake, and the harness test checks that the long-command case's prompt last printed something within 30 seconds of the wake, with no "silent since" line. The orchestrator gave the message's fields. This slice made two small choices: the first sign comes 30 seconds after the call started (none at second 0), and a sign may fall on the wake itself ("up to the wake" is read as including it). In both cases this puts the last sign exactly at the wake, because both commands started a whole number of minutes before it.
- **Dates and tickets.** The plan gives the times of day only. The long-command case is on 2026-10-09 (ivtrends#178, step started 07:12, wake 11:34). The hang case runs from 2026-10-08 19:00 to 2026-10-09 01:13 (ivtrends#177). Both tickets are pieces 3 and 2 of a made-up initiative #170 ("Positions"), with made-up session ids. Nothing is copied from the real sessions.
- **The tools before the running command.** The plan says "used tools steadily". Each case lists 9 to 12 calls by hand (reads, `npm test`, `tsc`, single browser test files, the report written and edited), then the running call. The prompt shows none of them, because all came before the last check.
- **The record holds every 15-minute check wake** from the step's start to the last check (16 and 24 wakes), as the #110 case lists its two. They count in "Spent on this ticket" ($14.08 and $12.40). A small helper writes them, so they are not typed out 40 times.
- **Test 1 also checks there is exactly one `Still running:` line.** The checkbox says the long case's prompt "shows one". This made test 1 fail a second time after the case was added, until `progressOf` stopped giving the running call a result. That is the red that drove the `running` part of the change.
- **Order of the red-green cases: 2, then 1, then 3.** Test 2 (#110) drove the results in `progressOf`. Written first, test 1 would have turned green when the case was added, because then every call showed as running.
- **The new cases are found by their "happened" text**, word for word from the plan. Both cases have the issue `#238`, so the issue does not tell them apart.
- **The stop's reason** in the hang case's right call refers to the new two-hour rule: "One command, npx playwright test, has run since 21:20, almost four hours. That is more than two hours, so it has hung."

**Validation evidence.**

Red then green, per case, with `npx vitest run src/runner/replay/harness.test.ts`:

1. (2) "says no command is running when every call of the step has ended, and still lists the suite runs since the last check (#110)". Red: `AssertionError: expected '## Why you were woken\n\nIt is now 20…' to contain 'No command is running now.'`. The tools line passed; the prompt had 12 `Still running:` lines, one per tool. Green after `progressOf` fed a result for each tool (4 passed).
2. (1) "names the one browser test command still running, and since when, inside a long check (#238)". Red: `Error: No case of the replay says: "At a 15-minute check, the checking step is inside one browser test command that started 35 minutes ago."`. After the case and the `running` field were added, red again: `AssertionError: expected '## Why you were woken\n\nIt is now 20…' to contain 'Still running: Bash(npx playwright te…'`, because the running call got a result. Green after `progressOf` gave no result to a call marked `running` (5 passed).
3. (3) "holds both moments of #238 just after the #110 case: a long test command, and one that hangs". Red: `AssertionError: expected [ { issues: [ '#238' ], …(1) }, …(1) ] to deeply equal [ … ]`, the second slot holding the #202 case ("Another pull request of the project merged. …"). Green after the hang case was added (6 passed).
4. (✏ amendment) "shows a step inside a long command as printing its 30-second sign, not as silent (#238)". It reads the time from `It last printed something at <time>.`, and checks it is at or before the case's `now` and at most 30 seconds before it, and that the prompt has no `It has been silent since`. Red: `AssertionError: expected 2100000 to be less than or equal to 30000` (the last output was the command's start, 35 minutes before the wake). Green after `progressOf` fed the 30-second sign for each call marked `running` (7 passed).

The running-step section of the two new prompts, as built after the amendment. Neither has a "silent since" line. Before the amendment, each said `It last printed something at <the command's start>` and `It has been silent since <the command's start>.`

```
It is now 2026-10-09T11:34:00Z.
…
A step is running: checking the result. It started at 2026-10-09T07:12:00.000Z.
Commands and tools it used since the last check: none
Still running: Bash(npx playwright test e2e/positions-short-text.spec.ts), started at 2026-10-09T10:59:00.000Z, 35 minutes ago.
Tokens it wrote since the last check: 0.
It last printed something at 2026-10-09T11:34:00.000Z. A command that is still running prints a short sign every 30 seconds, and that counts here.

It is now 2026-10-09T01:13:00Z.
…
A step is running: checking the result. It started at 2026-10-08T19:00:00.000Z.
Commands and tools it used since the last check: none
Still running: Bash(npx playwright test), started at 2026-10-08T21:20:00.000Z, 233 minutes ago.
Tokens it wrote since the last check: 0.
It last printed something at 2026-10-09T01:13:00.000Z. A command that is still running prints a short sign every 30 seconds, and that counts here.
```

A check outside the suite (a script in the scratchpad, not committed), run before the amendment, which does not touch the judges: the long case's judge fails a try that stops the step ("wanted: the step not stopped"), and the hang case's judge fails a try that does nothing ("wanted: a message sent to the running step, or the step stopped"). Both pass a try that sends a message.

Validation block, as run from `projects/timone` after the amendment:

```
$ npx vitest run src/runner/replay/
 ✓ src/runner/replay/harness.test.ts (7 tests)
 Test Files  1 passed (1)
      Tests  7 passed (7)
exit: 0
$ npm run replay -- --dry
Replaying 24 cases, 3 tries each, with a scripted runner and no model (--dry).
PASS #139 — Read planning as finished, and start the build. 3 of 3 tries.
PASS #140 — Read planning as done, and start the build. 3 of 3 tries.
PASS #144 — Not wait on the person. Choose the next step. 3 of 3 tries.
PASS #143, #161 — Try the start again. If it keeps failing, say so on the ticket. 3 of 3 tries.
PASS #99 — End the run, and free the project. 3 of 3 tries.
PASS #115 — Start nothing on it. 3 of 3 tries.
PASS #142 — Clear the hold, then start the work. 3 of 3 tries.
PASS #108 — Start a session that corrects the requirements, then check again. 3 of 3 tries.
PASS #111 — Start again from that discussion, as PRD-03.R1 says. Do not ask. 3 of 3 tries.
PASS #159 — Open the pull request with that check listed as not run. 3 of 3 tries.
PASS #117 — List the skip as a departure, and carry on to the pull request. 3 of 3 tries.
PASS #120 — Not offer the same command again. Say what is actually needed. 3 of 3 tries.
PASS #125, #135 — Carry the question to the pull request, and open it. 3 of 3 tries.
PASS #132 — Act on the word. 3 of 3 tries.
PASS #147 — Say on the pull request that the change is being made, then start it. 3 of 3 tries.
PASS #104 — Skip the interview and start planning. Post the departure on the ticket. 3 of 3 tries.
PASS scratch-app#37 — Write the requirements. Record no approval. Post that the approval was skipped, and carry on. 3 of 3 tries.
PASS ivtrends#1 — Start it again after a wait, and post nothing unless it keeps failing. 3 of 3 tries.
PASS #110 — Send the step a message to run only the tests its change affects. 3 of 3 tries.
PASS #238 — Leave the step running. 3 of 3 tries.
PASS #238 — Send the step a message, or stop it. 3 of 3 tries.
PASS #202 — Start the update, and ask nobody for anything. 3 of 3 tries.
PASS #218 — Ask on the ticket whether to do the work again or to stop, and name the takeover command for the ticket once. 3 of 3 tries.
PASS #218 — Record the approval and ask nothing, or ask what the word meant. Do not name the takeover command. 3 of 3 tries.
24 of 24 cases passed. The runner's sessions cost $0.00 in all.
exit: 0
$ npx tsc --noEmit
(no output, exit 0)
$ npx vitest run
 Test Files  77 passed (77)
      Tests  2742 passed (2742)
exit: 0
```

- [x] The dry replay passes every case, the two new ones included. **PASS** — 24 of 24, both `#238` lines PASS 3 of 3.
- [x] The #110 case's prompt shows no command still running; the #238 long-command case's prompt shows one. **PASS** — tests (2) and (1); the #110 prompt has `No command is running now.` and no `Still running:`; the long case's has exactly one `Still running:` line.
- [x] The whole suite passes. **PASS** — 77 files, 2742 tests (2738 before this slice, plus the 4 new ones).
- [ ] **Human gate:** the real replay. Not run by this slice: the orchestrator runs the real replay.

**What delivery must know.**

- **The replay's running call now sends the 30-second sign up to the wake**, so both new prompts show "last printed" at the wake, with no "silent since" line, as on ivtrends#178 and #177. The two cases differ for the runner only in how long the one command has run: 35 minutes against 233 minutes. The rule from 58b (more than two hours) is what tells them apart.
- The brief says "Not held." for both new tickets, though they carry `timone:held`, as every step ticket does while its run lives. The #110 case shows the same. This is how the brief already reads a step ticket, and this slice did not change it.
- A `start_step` call while a step runs is refused by the actions, so the long case's "no step started" check cannot be made to fail through the scripted runner. Only its "not stopped" check was seen to fail.

### 58c — the human gate, as answered (added by the orchestrator, 2026-10-10)

The real replay could not run from this session: every try failed with "OAuth session expired and could not be refreshed", at $0.00. fvermaut ran `npm run replay` from his own terminal on the branch at `66a7af7`: 23 of 24 cases passed, $2.97. Both #238 cases passed three tries of three. #132 failed three of three; its cause is older than this phase (see [phase-58-replay.md](phase-58-replay.md)).
