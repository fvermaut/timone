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
