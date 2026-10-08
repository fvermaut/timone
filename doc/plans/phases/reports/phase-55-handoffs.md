# Phase 55 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 55a — The helper, and the three smaller files pass inside a run's container

**Built.** A test-only helper, `withoutRunGitSettings(env = process.env)`. It deletes every `GIT_CONFIG_COUNT`, `GIT_CONFIG_KEY_<digits>` and `GIT_CONFIG_VALUE_<digits>` from `env` and returns a function that puts each one back with its exact value. Nothing else in `env` is touched. `src/numbers.test.ts`, `src/commands/number.test.ts` and `src/workspace.test.ts` now call it in a top-level `beforeEach` and call the restore function first in their top-level `afterEach`. Inside a run's container their 26 tests now pass; before the change 25 failed on the push guard.

**Files touched.**

- `src/test-support/run-git-settings.ts` — created. The helper and its doc comment (why it exists, PRD-11; tests only; runs no git, builds no path; why it edits the object and does not use `vi.stubEnv`). It imports nothing.
- `src/test-support/run-git-settings.test.ts` — created. Four cases, (a) to (d), each on a plain object.
- `src/numbers.test.ts` — imports `beforeEach` and the helper; adds `restoreRunGitSettings` and the `beforeEach` with a short comment; `afterEach` calls `restoreRunGitSettings()` first.
- `src/commands/number.test.ts` — the same change. `restoreRunGitSettings()` runs before the existing `process.chdir(startedIn)`.
- `src/workspace.test.ts` — the same change.
- `doc/plans/phases/reports/phase-55-handoffs.md` — created, with this section.

**Decisions taken inside the slice.**

- The match is one regular expression, `^GIT_CONFIG_(COUNT|KEY_\d+|VALUE_\d+)$`. It is anchored at both ends, so `GIT_CONFIG_NOSYSTEM`, `GIT_CONFIGURE` and names such as `GIT_CONFIG_KEY_` (no digits) are left alone.
- The helper removes numbered settings whether or not `GIT_CONFIG_COUNT` is set (case (d)). It does not read the count.
- The new block sits just before the existing `afterEach` in each file, after the file's `tempDirs` / `startedIn` constants, so the file's top-level state stays together.
- The test cases use realistic setting names and values (`core.hooksPath`, a run branch) in plain objects only. `process.env` is never touched by the helper's tests.

**Validation evidence.**

Environment: this is a run's container. `env | grep -c '^GIT_CONFIG'` printed `9` before and after the work. HEAD is the run branch `timone/228-1-...`; `git diff --name-only origin/main -- src` was empty before the change, so the red run is the code on `main`.

*Seam (2), red, before any change:*

```
npx vitest run src/numbers.test.ts src/commands/number.test.ts src/workspace.test.ts --reporter=json ...
exit: 1
total 26 passed 1 failed 25
numbers.test.ts 16 0
workspace.test.ts 6 0
commands/number.test.ts 4 1
grep -c 'Refused: this run may push only to' → 19
Refused: this run may push only to `timone/228-1-tests-and-older-checks-make-their-test`, and this push goes to `refs/heads/main`. ...
```

*Seam (1), red-green per case:*

- (a) Test written first. Red: `Error: Cannot find module './run-git-settings.js' imported from '.../src/test-support/run-git-settings.test.ts'`, `Test Files 1 failed`. Then the smallest helper (delete the matches, return an empty function). Green: `Tests 1 passed (1)`.
- (b) Test added. Red against that helper: `× ... puts back each removed setting with its exact value, and leaves alone a variable added since` — `expected { GIT_AUTHOR_NAME: 'bot', …(2) } to deeply equal { GIT_CONFIG_COUNT: '2', …(7) }`; the diff showed the five settings missing. Then the restore was written. Green: `Tests 2 passed (2)`.
- (c) Test added. Green on arrival: the helper from (a) already matched only the numbered names. Mutation to show it is not empty: the pattern changed to `/^GIT_/`. Red: `× ... changes nothing outside a run, where none of the settings are set` — `expected { HOME: '/home/bot', PATH: '/bin' } to deeply equal { GIT_AUTHOR_NAME: 'bot', …(2) }`. Reverted: `Tests 3 passed (3)`.
- (d) Test added. Green on arrival: the anchored pattern from (a) already handled it. Mutation 1, pattern `/^GIT_CONFIG/`. Red: `expected {} to deeply equal { GIT_CONFIG_NOSYSTEM: '1', …(1) }`. Mutation 2, return early when the count is not set. Red: `expected { …(4) } to deeply equal { GIT_CONFIG_NOSYSTEM: '1', …(1) }`. Reverted: `Tests 4 passed (4)`.

*Validation commands, as run after the change:*

```
env | grep -c '^GIT_CONFIG'                                  → 9
npm run build; echo "exit: $?"                               → exit: 0
npx vitest run src/test-support/run-git-settings.test.ts     → 4 passed, exit: 0
npx vitest run <three files> --reporter=json ...             → exit: 0
  numbers.test.ts 16 16
  workspace.test.ts 6 6
  commands/number.test.ts 4 4
grep -c 'Refused: this run may push only to' /tmp/55a.log    → 0, exit: 1
npx vitest run src/guards                                    → 1 file, 7 passed, exit: 0
git diff origin/main -- <three files> | grep skip/todo/only  → no output, exit: 1
git diff --name-only origin/main -- src | grep -v '\.test\.ts$' → no output, exit: 1
git diff --name-only origin/main | grep -vE '<allow-list>'   → no output, exit: 1
git status --porcelain --untracked-files=all
   M src/commands/number.test.ts
   M src/numbers.test.ts
   M src/workspace.test.ts
  ?? src/test-support/run-git-settings.test.ts
  ?? src/test-support/run-git-settings.ts
  (plus this handoff file once written)
non-test src files, tracked or untracked                     → only src/test-support/run-git-settings.ts
status paths outside the allow-list                          → none, exit: 1
grep vitest|child_process|execFile|spawn|"git"|projects/|node:path in the helper → none, exit: 1
npx tsc --noEmit                                             → exit: 0
```

The `git diff --name-only origin/main` checks do not list untracked files, so `git status --porcelain` was checked against the same list. The only non-test file under `src/` is the new helper.

*Checkboxes:*

- [x] The helper's four cases went red before the helper existed and green after, shown above. (a) and (b) went red on the real failure; (c) and (d) were green on arrival and each was shown to fail under a mutation.
- [x] The three files' red run in this container (25 failures of 26) and the green run (26 of 26) are both above, with the count of numbered git settings (9).
- [x] The three files hold 26 tests, all passing: the same count as on `main` (16 + 4 + 6).
- [x] No program file under `src/` other than the new helper changed, and the helper neither spawns git nor imports vitest. `src/guards` passes with no new exemption.

*Tests run at the end of the slice:*

- `src/test-support/run-git-settings.test.ts` — 4 of 4 passed.
- `src/numbers.test.ts` — 16 of 16 passed.
- `src/commands/number.test.ts` — 4 of 4 passed.
- `src/workspace.test.ts` — 6 of 6 passed.
- `src/guards` (`checkouts.test.ts`) — 7 of 7 passed.
- `npx tsc --noEmit` — exit 0. The whole suite was not run, as the runner of this step asked.

**What 55b must know.**

- Import path from a file in `src/`: `./test-support/run-git-settings.js`; from `src/<folder>/`: `../test-support/run-git-settings.js`.
- In this container the guard on shell commands refuses any command whose text names a numbered git setting variable. Mutations or scripts that need that name must go through a file written with the editor, then copied in with `cp`.
- `npm run build` compiles the helper and its test into `dist/test-support/`. `dist/` is not tracked, so nothing shows in `git status`.

## 55b — `guardrails.test.ts` passes inside a run's container

**Built.** `src/commands/guardrails.test.ts` now runs each test without the run's git settings, in the same way as the three files of 55a. It imports `beforeEach` and `withoutRunGitSettings`, adds `restoreRunGitSettings` and a top-level `beforeEach` with a short comment, and calls `restoreRunGitSettings()` first in the existing top-level `afterEach`. Inside a run's container the file's 52 tests now pass; before the change 45 failed on the push guard.

**Files touched.**

- `src/commands/guardrails.test.ts` — `beforeEach` added to the vitest import; the helper imported just after the imports from `./guardrails.js`; `restoreRunGitSettings` and the commented `beforeEach` placed after the `tempDirs` constant; `restoreRunGitSettings()` as the first line of the top-level `afterEach`. The `git` helper, `prePushOutsideGit` and the `guardOnBash` cases are unchanged.
- `doc/plans/phases/reports/phase-55-handoffs.md` — this section appended.

**Decisions taken inside the slice.**

- The block is the same as in `src/commands/number.test.ts`, with the same doc comment on `restoreRunGitSettings`. Only the comment at `beforeEach` is worded for this file: "The tests push to throwaway bare repositories."
- `prePushOutsideGit` calls `vi.unstubAllEnvs()` halfway through a test. That call puts back only the variables stubbed with `vi.stubEnv` (`GIT_CEILING_DIRECTORIES`, `GIT_DIR`). The helper edits `process.env` directly and does not use `vi.stubEnv`, so the run's settings stay removed until `afterEach`. Nothing was changed for this; the green run below confirms it.

**Validation evidence.**

Environment: a run's container. `env | grep -c '^GIT_CONFIG'` printed `9`. `git diff --name-only origin/main -- src/commands/guardrails.test.ts` was empty before the change, so the red run is the file as on `main`.

*Red, before the change:*

```
npm run build                                                → exit: 0
npx vitest run src/commands/guardrails.test.ts --reporter=json --outputFile=/tmp/55b-red.json > /tmp/55b-red.log 2>&1
exit: 1
commands/guardrails.test.ts  total 52  passed 7  failed 45
grep -c 'Refused: this run may push only to' /tmp/55b-red.log → 45
```

The 7 that passed on red push nothing: the two hook-payload cases, one "finding the run" case, the two `prePushOutsideGit` cases and the two `install-merge-rules` cases.

*Green, after the change (the plan's validation commands):*

```
env | grep -c '^GIT_CONFIG'                                  → 9
npm run build; echo "exit: $?"                               → exit: 0
npx vitest run src/commands/guardrails.test.ts --reporter=json --outputFile=/tmp/55b.json > /tmp/55b.log 2>&1
                                                             → exit: 0
node -e '...'                                                → commands/guardrails.test.ts 52 52
grep -c 'Refused: this run may push only to' /tmp/55b.log    → 0, exit: 1
git diff origin/main -- <file> | grep skip/todo/only         → no output, exit: 1
git diff origin/main -- <file> | grep -c '^-[^-]'            → 1, exit: 0
   (the removed line is the old vitest import)
git status --porcelain --untracked-files=all                 →  M src/commands/guardrails.test.ts
   (plus this handoff file once written)
npx tsc --noEmit                                             → exit: 0
```

*The `prePushOutsideGit` / `vi.unstubAllEnvs()` check:*

- Tests that use `prePushOutsideGit`, both in `guardrails pre-push, on the first push of a work branch (PRD-07.R4)`:
  - `does not ask git about a push of a branch the remote already has` — passed.
  - `asks git on the first push, and refuses the push when git cannot answer` — passed.
- These are tests 29 and 30 of 52 in run order. The 22 tests after them all passed, starting with `a session the daemon drove asks the session first, then flags the run — and posts on no ticket`, which pushes to a throwaway repository.
- `grep -c 'Refused' /tmp/55b.log` → `0`. No line of any refusal appears in the log, so no line appears after these tests. The run's settings were not put back halfway through a test.

*Checkboxes:*

- [x] The red run on `main` in this container (45 of 52 failing, 45 refusal lines) and the green run (52 of 52, 0 refusal lines) are both above.
- [x] The file holds 52 tests, all passing: the same count as on `main` (52 on red).
- [x] The diff to this file adds the import, the `beforeEach` and the restore call, and removes nothing but the old vitest import line (one removed line).

*Tests run at the end of the slice:*

- `src/commands/guardrails.test.ts` — 52 of 52 passed.
- `npx tsc --noEmit` — exit 0. The whole suite was not run, as the runner of this step asked.

**What 55c must know.**

- The block copies cleanly into a file that already has a top-level `afterEach`: add `beforeEach` to the vitest import, import the helper from `../test-support/run-git-settings.js` (from `src/<folder>/`), and call the restore first in `afterEach`.
- A file that uses `vi.stubEnv` / `vi.unstubAllEnvs()` needs no extra care. `vi.unstubAllEnvs()` does not bring back the run's settings, because the helper does not go through `vi.stubEnv`.
- `/tmp/55b.log` with the JSON reporter holds only git's stderr and the "JSON report written" line, so a `grep -c 'Refused'` on it is a fair count of refusals.
