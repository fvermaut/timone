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
