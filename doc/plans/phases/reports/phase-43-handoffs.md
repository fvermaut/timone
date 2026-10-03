# Phase 43 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 43a — A run's git push reaches its own work branch and nothing else

**Built.** A run's `git push` now reaches the run's own work branch and nothing else. A push to the default branch, to another branch, to a tag, or a delete of the work branch is refused, and the push as a whole does not happen. A step with no work branch may push nothing. The rule is checked by a `pre-push` hook. The hook is switched on through the environment (`GIT_CONFIG_COUNT`/`core.hooksPath`), so nothing is written into the project's checkout. The project's own hooks still run: the guard hands the same input to the project's own `pre-push` after it passes, and every other client-side hook is forwarded to the project's hook of the same name. The guard is switched on in both runtimes. The box installs it just before `claude` starts, and stops with `exit 79` if it cannot. The in-process runtime installs it in a fresh directory under `<cwd>/.timone/push-guard/` and removes it when the session ends. Both session starts in the runner tell the runtime which branch that is.

**Files touched.**

- `src/daemon/push-guard.ts` — created. `RefUpdate`, `pushRefusal` (pure), `parsePrePushInput` (throws on a line git would never write), `installPushGuard` (writes `pre-push` and 14 forwarders, mode 0755, returns the three `GIT_CONFIG_*` variables).
- `src/daemon/push-guard.test.ts` — created. Cases 1–5, plus one test for the `install-push-guard` command the box uses.
- `src/commands/guardrails.ts` — added `guardrails pre-push [--branch <name>]` (an internal error refuses the push, with a comment that says why) and `guardrails install-push-guard --dir <d> [--branch <b>]` (prints one line and exits 1 if it cannot write the hooks). The `baseline`, `guard` and `check` commands are unchanged: the diff on this file removes no line.
- `src/daemon/session.ts` — `SessionRequest.workBranch?: string`; `SessionRequestInput.workBranch?: string | undefined`, passed through by `sessionRequest` only when defined. `agentSdkRuntime` is now `agentSdkRuntimeWith(query)`. The new exported `agentSdkRuntimeWith(query: QueryFunction)` exists so a test can read the `query` options. `start` installs the guard and passes `env: { ...process.env, ...guardEnv }`, and removes the guard directory in a `finally` when the session's stream ends. The body was re-indented one level; `git diff -w` shows the real change.
- `src/daemon/container-runtime.ts` — `PUSH_GUARD_DIR = "$HOME/.timone/git-hooks"`. The box passes `TIMONE_RUN_BRANCH` (forwarded with `-e`) when the request has `workBranch`. `boxScript` adds the guard install (with `exit 79` on failure, output to `/tmp/timone-push-guard.log`, reason read by `timone_reason`) and the `export GIT_CONFIG_COUNT=1 …` line, after the project's install and immediately before `claude`.
- `src/daemon/container-runtime.test.ts` — case 6: new block "the guard on a boxed run's pushes". Two existing tests changed because the script changed on purpose. (1) "builds exactly today's arguments and script…" now expects the 40d script with the hand-written `PUSH_GUARD_LINES` inserted before the `claude` line. The 40d snapshot itself is left as it was. (2) "does not take the box down when they will not install" now reads the project-install part of the script only up to the guard. The guard comes after it and has its own `exit 79`.
- `src/daemon/session.test.ts` — case 7: block "the guard on an in-process session's pushes".
- `src/runner/actions.ts` — `workBranch: branch.name` on the step start, `workBranch: branch` on the approval-recording start.
- `src/runner/actions.test.ts` — case 8: block "the work branch a step's session is given".
- `doc/plans/phases/reports/phase-43-handoffs.md` — created, with this section.

**Decisions taken inside the slice.**

1. **The refusal text has one shape.** It is: "Refused: this run may push only to `X`, and this push goes to `refs/heads/main` [and deletes `…`]. Nothing reaches the project's default branch without a person's yes. Commit on `X` and push that." The plan's example called every refused ref "the project's default branch or another branch", which is wrong for a tag. So the text names each refused ref and what the push does to it.
2. **A push with no updates is allowed, even with no work branch.** "Every update is refused" means there is nothing to refuse when there are none.
3. **`parsePrePushInput` throws** rather than returning a result. Git never writes a malformed line, so one means the guard itself is broken. The command catches it and refuses. It accepts SHA-1 (40 hex) and SHA-256 (64 hex) names and skips blank lines. Any local ref token is accepted, because a delete sends `(delete)`.
4. **The guard's `pre-push` keeps git's input in a `mktemp` file** (removed on exit) so the project's own `pre-push` gets exactly the same bytes.
5. **The project's own hooks folder** is found by `git config --local --type=path --get core.hooksPath`, else `$(git rev-parse --git-common-dir)/hooks`. I checked that `--local` does not see the value set through `GIT_CONFIG_COUNT`. A relative path is used as-is from the hook's working folder. Git runs hooks at the top of the work tree, so this is "relative to the work tree", as the plan says, and it is git's own rule.
6. **The hook runs `node`, not an absolute node path**, as the plan says. If `node` or the CLI file is missing, the hook fails and the push is refused, so the guard fails closed.
7. **`install-push-guard` finds the CLI from its own module** (`new URL("../cli.js", import.meta.url)`). In the box that is `/workspace/timone/dist/cli.js`. It prints one line on failure, not a stack trace, because the box puts the first lines of its log on the ticket.
8. **Injecting `query`.** `session.test.ts` had no seam for the `query` options. I added `agentSdkRuntimeWith(query)` and kept `agentSdkRuntime` as `agentSdkRuntimeWith(query)`, so `daemon.ts` and its identity checks in `daemon.test.ts` are unchanged. `QueryFunction` is the narrow type the runtime uses: options in, `AsyncIterable<SDKMessage>` out.
9. **`workBranch` in `SessionRequestInput` accepts `undefined`**, as `effort` does, so `actions.ts` can pass `branch.name` (which is `string | undefined`) directly. `sessionRequest` drops an undefined value, so a step with no branch gets a request with no `workBranch` key.
10. **An extra test outside cases 1–8**: "is the same guard when installed through Timone's own command". The box installs through the CLI, and no case drove that command. It was seen red (`expected 1 to be +0`, the command did not exist) before the command was written.

*What I would refactor (not done).* The hook tests' `remoteAndClone` helper could later be shared with any other test that needs a bare remote. Reading stdin to text is now written twice in `guardrails.ts` (`readHookPayload` and `pre-push`); a small `readStdin()` could serve both. The forwarders call `git config` and `git rev-parse` each time, and `reference-transaction` runs on every ref change. That is a small cost per call, and it could be measured if it ever shows up. A forwarder would loop if a project set its local `core.hooksPath` to the guard's own folder. That is not a real case today; a check that `$own` is not the forwarder's own folder would close it.

**Validation evidence.**

*Case 1* — `pushRefusal` with a work branch (`push-guard.test.ts`, block "what a run may push", 7 tests). First run: module missing (`Error: Failed to load url ./push-guard.js … Does the file exist?`). Then with a stub that allows everything:

```
× what a run may push > refuses an update to the default branch
× what a run may push > refuses an update to another branch
× what a run may push > refuses an update to a tag
× what a run may push > refuses deleting the work branch
AssertionError: expected undefined to be defined
× what a run may push > refuses a push that carries one allowed update and one refused one
× what a run may push > never tells the reader to put anything on the default branch
AssertionError: expected '' to match /Commit on `timone…/7-x` and push that\.
Tests  6 failed | 1 passed (7)
```

Green: `✓ src/daemon/push-guard.test.ts (7 tests)`.

*Case 2* — no work branch (block "what a step with no work branch may push", 3 tests). Red:

```
× … refuses an update to the default branch, and says the step pushes nothing
× … refuses an update to a branch named like a run's, and says the step pushes nothing
× … refuses an update to a branch named undefined, and says the step pushes nothing
Received: "Refused: this run may push only to `undefined`, and this push goes to `refs/heads/main`. …"
Tests  3 failed | 7 passed (10)
```

The third test caught a real fault: before this case, a push to `refs/heads/undefined` was allowed when there was no work branch. Green: `Tests  10 passed (10)`.

*Case 3* — `"a run cannot push to the default branch"` (real git: bare remote, clone, `HOME` in a temp folder, `GIT_CONFIG_NOSYSTEM=1`, inherited `GIT_*` dropped, `user.name`/`user.email` set in the clone). Red: `TypeError: (0 , installPushGuard) is not a function` / `Tests  1 failed | 10 passed (11)`. Green after `npm run build`: `Tests  11 passed (11)`. Proof that it can fail: I changed the hook's `|| exit 1` to `|| exit 0`, rebuilt, and saw `× a run's git push, with the guard switched on > a run cannot push to the default branch` / `AssertionError: expected +0 not to be +0`. Then I reverted it, rebuilt, and saw `Tests  11 passed (11)`.

The same push run by hand, first with the guard's environment and then without it (temp `HOME`, `GIT_CONFIG_NOSYSTEM=1`):

```
remote main before: 9eeffe0cf8458b429f00e9bd7bd13ff6132d2bcb
--- with the guard's environment:
guard env: GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/tmp/t43-noguard-yT2Q/guard
Refused: this run may push only to `timone/7-x`, and this push goes to `refs/heads/main`. Nothing reaches the project's default branch without a person's yes. Commit on `timone/7-x` and push that.
error: failed to push some refs to '/tmp/t43-noguard-yT2Q/remote.git'
exit: 1
remote main after guarded push: 9eeffe0cf8458b429f00e9bd7bd13ff6132d2bcb
--- without the guard's environment:
To /tmp/t43-noguard-yT2Q/remote.git
   9eeffe0..525014c  HEAD -> main
exit: 0
remote main after unguarded push: 525014c80a88842d8f6730326868c615eac858a8
local HEAD: 525014c80a88842d8f6730326868c615eac858a8
```

Without the environment, the remote's `main` moved from `9eeffe0` to `525014c`.

*Case 4* — a clone whose local config sets `core.hooksPath` to `.githooks` (block "a project that keeps its own hooks, with the guard switched on", 5 tests). Red:

```
✓ … still refuses a push to the default branch
× … runs the project's own pre-push on an allowed push, with what git sent it   (ENOENT … marker)
× … runs the project's own pre-commit on a commit   (expected false to be true)
× … lets the project's own pre-commit stop a commit   (expected +0 not to be +0)
× … hands the project's own hook the arguments git gave it   (ENOENT … marker)
Tests  4 failed | 12 passed (16)
```

After the forwarders were added, one test still failed because my expected value was wrong: git sends the local ref as `HEAD` for `git push origin HEAD:…`. I fixed the expectation and the run was green: `Tests  16 passed (16)`. "Still refuses a push to the default branch" could not be driven red, because the guard already refused. To show it is not empty, I changed the guard's `pre-push` to run the project's own `pre-push` *instead of* the guard when one exists. Result: `× … still refuses a push to the default branch` / `AssertionError: expected +0 not to be +0`. I reverted it: `Tests  16 passed (16)`.

*Case 5* — `guardrails pre-push` exits 1 on input it cannot read (block "the guard's own command, when something is wrong"). This could not be driven red: the command, with its refuse-on-error `catch`, was written in case 3, which needed it. To show the test is not empty, I removed `process.exitCode = 1` from the `catch` and rebuilt. Result: `× … refuses the push when it is given input it cannot read` / `AssertionError: expected +0 to be 1`. I reverted it and rebuilt: `Tests  17 passed (17)`.

*Extra* — `install-push-guard` through the CLI (decision 10). Red: `AssertionError: expected 1 to be +0` / `Tests  1 failed | 1 passed | 16 skipped (18)`. Green: `Tests  18 passed (18)`. The command fails cleanly: `node dist/cli.js guardrails install-push-guard --dir /etc/passwd/x` printed `guardrails install-push-guard: ENOTDIR: not a directory, mkdir '/etc/passwd/x'` with `exit: 1`.

*Case 6* — the box (`container-runtime.test.ts`, block "the guard on a boxed run's pushes", 6 tests, plus the updated exact-script test). Red:

```
× a box that can take a message while a step runs > builds exactly today's arguments and script for a request that is not interactive
× the guard on a boxed run's pushes > is installed after the project's install and before the CLI starts   (expected -1 to be greater than 2055)
× the guard on a boxed run's pushes > is switched on for every git the session runs   (expected -1 to be greater than -1)
× the guard on a boxed run's pushes > names the work branch only when the box was given one
× the guard on a boxed run's pushes > stops the box when it cannot be installed, as a failed build of Timone does   (expected '' to contain 'exit 79')
× the guard on a boxed run's pushes > hands the box the run's work branch, by name
Tests  6 failed | 90 passed (96)
```

"Hands the box no work branch when the step has none" passed from the start. It is the negative half of a pair whose positive half was red. After the change, `does not take the box down when they will not install` failed, because the guard's `exit 79` now follows the project's install. I bounded that test's slice at the guard, and the run was green: `Tests  96 passed (96)`.

*Case 7* — `agentSdkRuntime`'s `query` options (`session.test.ts`, block "the guard on an in-process session's pushes", 3 tests). Red, first: `TypeError: (0 , agentSdkRuntimeWith) is not a function` (3 failed). After only the factory refactor, still red: `expected undefined to be '1'` and `expected undefined to be '/workspace/timone/projects/timone/nod…'` (`Tests  2 failed | 14 passed (16)`). Green: `Tests  16 passed (16)`. "Removes the guard's directory once the session is over" passed before the cleanup existed, because there was no directory to find. To show it is not empty, I replaced the `rmSync` with nothing and saw `AssertionError: expected true to be false`. I reverted it: `Tests  16 passed (16)`.

*Case 8* — both session starts in `actions.ts` (`actions.test.ts`, block "the work branch a step's session is given", 3 tests). `world()` answers no Timone version, and each test asserts `request.workspace` is undefined before it checks `workBranch`. Red:

```
× … is the run's branch, for a step that owns one, with no pinned Timone version
× … is the run's branch for the session that writes an approval into its file
AssertionError: expected undefined to be 'timone/12-a-due-date-on-each-task'
Tests  2 failed | 50 passed (52)
```

"Is absent for a step that owns no branch" passed from the start, as the negative half. Green: `Tests  68 passed (68)` (actions + session).

*The validation block:*

```
$ npm run build
> tsc
$ npx vitest run src/daemon/push-guard.test.ts src/daemon/container-runtime.test.ts src/daemon/session.test.ts src/runner/actions.test.ts
 Test Files  4 passed (4)
      Tests  182 passed (182)
$ printf 'not a ref line\n' | node dist/cli.js guardrails pre-push --branch timone/7-x; echo "exit: $?"
Refused: Timone's push guard could not judge this push, so it lets nothing through. not a line git writes to a pre-push hook: "not a ref line"
exit: 1
$ printf 'refs/heads/timone/7-x %s refs/heads/timone/7-x %s\n' 1111… 0000… | node dist/cli.js guardrails pre-push --branch timone/7-x; echo "exit: $?"
exit: 0
$ printf 'refs/heads/main %s refs/heads/main %s\n' 1111… 2222… | node dist/cli.js guardrails pre-push --branch timone/7-x; echo "exit: $?"
Refused: this run may push only to `timone/7-x`, and this push goes to `refs/heads/main`. Nothing reaches the project's default branch without a person's yes. Commit on `timone/7-x` and push that.
exit: 1
```

- [x] Cases 1–8 each seen red before green, recorded above. Cases 5 and the first test of case 4 could not honestly be driven red, and each was shown not to be empty by a code change, a failure, and a revert. Case 3's run without the guard is recorded above: the remote's `main` moved from `9eeffe0` to `525014c`. **Pass.**
- [x] The three probe commands gave exit 1, 0, 1 in that order. **Pass.**
- [x] No hook command other than `pre-push` changed its never-fail posture. `git diff src/commands/guardrails.ts` removes no line; `baseline`, `guard` and `check` are untouched. `install-push-guard` exits 1 on failure, but it is not a hook: the box runs it once and must stop when it fails. **Pass.**
- [x] Nothing under the person's home folder is written by the tests. Every git the tests run, and every CLI they start, has `HOME` set to a temp folder (git also gets `XDG_CONFIG_HOME` in it and `GIT_CONFIG_NOSYSTEM=1`). Checked by touching a marker file, then running the four test files, then `find "$HOME" -newer marker` (leaving out the agent's own `~/.claude`, `~/.npm`, `~/.cache`). Nothing was found. When I checked those three folders on their own, the only new files were npm's debug logs in `~/.npm/_logs/`. npm writes one for each `npm`/`npx` command I typed, including the `npx vitest` that started the tests, so they come from those commands and not from anything a test does. `~/.gitconfig` kept its time from before the slice started (`2026-10-03 13:05:40`). **Pass.**

*At slice end:* `npx tsc --noEmit` exit 0. Whole suite `npx vitest run`: `Test Files  57 passed (57)`, `Tests  1449 passed (1449)`, 3.8 s. That is 1 file and 30 tests more than 56/1419: 18 in `push-guard.test.ts`, 6 in container-runtime, 3 in session, 3 in actions.

**What 43b must know.**

- The hook tests need `dist/` built. They run `dist/cli.js` as the hook does, the same way `cli.test.ts` already does. A stale build gives stale results, so run `npm run build` before `vitest` after changing `push-guard.ts` or `guardrails.ts`.
- The guard's environment sets `GIT_CONFIG_COUNT=1`. Anything else that wants to add git config through `GIT_CONFIG_*` (in the box script or in `agentSdkRuntimeWith`'s `env`) must raise the count and use index 1 onwards, or it will replace the guard.
- In the box, `$HOME/.timone/git-hooks` holds the hooks and `/tmp/timone-push-guard.log` holds what the install said. The guard is installed after the project's install, so nothing the box runs before that is judged.
- `guardrails pre-push` reads stdin to the end itself; it does not use `readHookPayload`. If `forge-call` needs the same "an error refuses" posture, the `pre-push` action's `catch` is the model.
