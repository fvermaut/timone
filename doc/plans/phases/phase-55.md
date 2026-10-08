# Phase 55: Tests make their throwaway repositories without the run's git settings — the whole suite passes inside a run's container, and the push guard is unchanged

> **Status:** Complete — see [reports/phase-55-complete.md](reports/phase-55-complete.md).

> **Companion phases:** [phase 52](phase-52.md) — its build and check reports ([phase-52-complete.md](reports/phase-52-complete.md), [phase-52-verification.md](reports/phase-52-verification.md)) are where the 70 failing tests and the 7 blocked checks were first recorded. [phase 54](phase-54.md) — the last one merged; it touched none of the files below. No other open phase changes these four test files. Governing decisions: [ADR-0041](../../adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md) — a run happens in a container, and that container is where the push guard is switched on, so the container is where the suite must pass. [ADR-0048](../../adr/0048-a-verification-probe-is-kept-proved-able-to-fail-and-hidden-from-the-builder.md) — the older checks are hidden from the step that builds; this phase's building step does not read, name or change them (PRD-11.R5). [ADR-0051](../../adr/0051-timone-verifies-itself-by-live-gate-and-a-regression-set-is-narrowed-by-what-it-depends-on.md) D4 — how the regression set below is derived. [ADR-0050](../../adr/0050-timone-becomes-a-managed-project-once-the-run-path-is-fixed.md) D5 — this project is Timone, so `src/` is committed here.

> **Screens changed:** none — this phase changes tests only; nothing a person sees changes.

## Requirements

> **PRD:** [prd-11-tests-and-checks-run-inside-a-runs-container.md](../../specs/prd/prd-11-tests-and-checks-run-inside-a-runs-container.md) — criteria in [prd-11-tests-and-checks-run-inside-a-runs-container.criteria.md](../../specs/prd/prd-11-tests-and-checks-run-inside-a-runs-container.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-11.R1 | MUST | The whole test suite passes inside a run's container and outside one, with no test removed or skipped. |
| PRD-11.R2 | MUST | Timone's own code, called by a test, pushes to the throwaway repository; done in test files or test set-up only. |
| PRD-11.R3 | MUST | The guard still refuses a push to the project's real `main`; `push-guard.ts` and the container's git settings do not change. |
| PRD-11.R4 | MUST | The 7 older checks of PRD-05.R2, R3, R4, R5, R7, R10 and R11 reach PASS or FAIL inside a run's container. |
| PRD-11.R5 | MUST | Only the step that checks a build changes the older checks; the step that builds changes none. |

**R4 and R5 are not built by this phase's sub-phases.** The older checks belong to the step that checks a build, and only that step may change them ([ADR-0048](../../adr/0048-a-verification-probe-is-kept-proved-able-to-fail-and-hidden-from-the-builder.md), PRD-11.R5). This phase claims them because the piece claims them ([breakdown of #220](../breakdowns/ticket-220.md), piece 1). What the building step owes R4 is nothing; what it owes R5 is that no commit it makes touches the older checks, which every sub-phase below checks with an allow-list of the files it may change. The checking step changes the 7 checks in the same way 55a describes for tests, and shows that they reach a verdict.

## Goal Description

A run on a ticket works inside a container whose git has the push guard switched on through the environment: `GIT_CONFIG_COUNT`, then `GIT_CONFIG_KEY_<i>` and `GIT_CONFIG_VALUE_<i>`, with `core.hooksPath` at index 0 (`src/daemon/container-runtime.ts`, around line 706). In this run's own container there are four of them: the hooks path, the attributes file, and two merge drivers. The guard's `pre-push` refuses every push that is not to the run's own branch, and it does not look at which repository the push goes to. Four test files build throwaway repositories under the system's temporary folder and push `main` there. Inside a run's container those pushes are refused. **Measured on 2026-10-08 in this ticket's own container, on `main` at `64f705b`:** `npx vitest run` gives 1984 tests, 70 failed, all in `src/commands/guardrails.test.ts` (45 of 52), `src/numbers.test.ts` (16 of 16), `src/workspace.test.ts` (6 of 6) and `src/commands/number.test.ts` (3 of 4). The log holds the guard's `Refused: this run may push only to` line 64 times.

**The fix: each of the four files removes the run's git settings from its own test process before each test, and puts them back after it.** One small helper, `withoutRunGitSettings`, does the removing and returns the function that puts them back. Each file calls it in a `beforeEach` and calls what it returned in an `afterEach`. Because the settings are gone from `process.env` itself, both kinds of git the PRD names stop seeing the guard: the test's own `execFileSync("git", …)` calls, and the git that Timone's own code runs while the test calls it (`reserveNumber` in `src/numbers.ts`, `syncWorkspace` in `src/commands/workspace.ts`, the guardrails command code). Both inherit `process.env`. No program file changes, the guard does not change, and nothing is switched off for the whole run: not in `vitest.config.ts`, not in `package.json`, not in a vitest set-up file.

**Only the run's git settings are removed, not every `GIT_*` variable.** The breakdown says "as `src/daemon/push-guard.git.test.ts` already does". That file removes every `GIT_*` variable and moves `HOME`. This phase removes less on purpose. The PRD defines the run's git settings as exactly those numbered config variables. The container's `GIT_AUTHOR_*`, `GIT_COMMITTER_*` and `GIT_EDITOR` are not part of the guard, and the four files already set a commit identity on each repository they make, because CI has no global git identity (`.github/workflows/tests.yml`, its header). Removing more would change what the tests run with for no gain. The result is the same as in `push-guard.git.test.ts`: the guard never sees the test's pushes.

**Why a helper file, and why `process.env` rather than `vi.stubEnv`.** Four files need the same twelve lines, and one function gives one place to test it (55a's seam). The helper lives at `src/test-support/run-git-settings.ts`: imported only by tests, it runs no git, and it does not import vitest. PRD-11.R2's hint allows test helpers. It edits `process.env` directly and does not use `vi.stubEnv`, because `guardrails.test.ts` calls `vi.unstubAllEnvs()` in the middle of a test (`prePushOutsideGit`, around line 596). That would put back any variable removed with `vi.stubEnv` halfway through the test. `vi.unstubAllEnvs()` restores only what `vi.stubEnv` changed, so a variable deleted by plain code stays deleted until the helper's own restore function runs.

**No decision here passes the ADR test.** Removing a few environment variables in four test files is undone by deleting the lines. Nobody would be surprised by it: PRD-11 names this exact approach, and three test files already do a wider version of it. And it is not a real trade-off: the PRD's out-of-scope list rules out every other place the fix could go (the guard, the container's settings, the whole test run).

**Regression set.** Derived per ADR-0051 D4: MUST, `api`, `verified` criteria, narrowed to those whose `Depends-on` this phase's diff touches. The diff touches the four test files, the new helper and its test, PRD-11's narrative, and this phase's own files. No criterion with a `Depends-on` line names a prefix that covers them. `src/workspace.test.ts` is not under PRD-01.R3's `src/commands/workspace.ts` or `src/git.ts`. The criteria with no `Depends-on` are always in the set: **PRD-05.R2, R3, R4, R5, R7, R10, R11, R18, PRD-08.R5, PRD-09.R2, R4 and R5.** No program file changes, so none of them can change, but seven of them are the blocked checks this piece exists to free. PRD-05.R18 needs a logged-in terminal and stays out of reach, as PRD-11's out-of-scope list says. PRD-01.R4 is `live` and depends on `src/commands/`, which holds two of the test files. It is `draft`, so it is in no set, and no program code under `src/commands/` changes, so no live gate is owed.

**What no criterion watches, and what guards it instead.** (1) That the four files still test everything they tested before. A test that is quietly skipped, or a file that stops collecting tests, would make the suite green for the wrong reason. The per-file test counts in 55a and 55b are a hard gate: 52, 16, 6 and 4, the counts on `main` today, all passing. (2) That the guard is still on for everything that is not one of these tests. The dry-run push to the real `main` in 55c is a hard gate, together with `src/daemon/push-guard.test.ts` and `src/daemon/push-guard.git.test.ts` passing unchanged.

`doc/standards.md` does not exist in this project. The central `standards/` baseline governs, and none of its entries bears on test set-up. The code follows the TypeScript house rules the rest of `src/` follows.

## Context & Prerequisites

- **`src/commands/guardrails.test.ts`** (1222 lines, 52 tests) — its own `git` helper at line 51 runs `execFileSync("git", args, { cwd, encoding })` with no `env`, so it inherits `process.env`. A top-level `afterEach` at line 29 removes temp folders. `prePushOutsideGit` (around 560–600) calls `vi.stubEnv` and then `vi.unstubAllEnvs()` in its `finally`. The `switching off the guard on a run's pushes` block (around 500–555) and the `guardOnBash` cases pass an explicit `env` object to `runGuard`. They test the session guard's text matching, not git, and must keep passing unchanged. The 7 tests that pass in the container today must still pass.
- **`src/numbers.test.ts`** (256 lines, 16 tests) — `git` helper at line 27, `cloneOf` at line 43, a top-level `afterEach` at line 20. It calls `reserveNumber`, which pushes the reservation ref itself through `runGit` in `src/numbers.ts`. The guard allows a new reservation ref. What is refused is the fixture's own push of `main` to the bare repository.
- **`src/commands/number.test.ts`** (156 lines, 4 tests) — `git` helper at line 31, `timoneRoot` at line 59 pushes `main` from a seed repository. A top-level `afterEach` at line 20 restores the working folder and `process.exitCode`. The one test that passes today is the `cloned = false` case.
- **`src/workspace.test.ts`** (187 lines, 6 tests) — `git` helper at line 26, `makeFixture` around line 59 pushes `main` from a seed clone. A top-level `afterEach` at line 19. It calls `syncWorkspace` from `src/commands/workspace.ts`.
- **`src/guards/checkouts.test.ts`** — scans every non-test `.ts` file under `src/` for git calls and for paths under `projects/`. The new helper must do neither, or that test fails and asks for an exemption. It does neither: it only edits an environment object.
- **`src/daemon/push-guard.ts`, `src/daemon/container-runtime.ts`** — not changed (PRD-11.R3).
- **This ticket's container** — it is a run's container: its environment carries the four numbered git settings and `TIMONE_RUN_BRANCH=timone/228-1-tests-and-older-checks-make-their-test`. So a sub-phase that runs the suite here is running it inside a run's container, as R1 asks. The step that builds runs in a container of the same kind.
- **Two guards that refuse commands in a run's session**, which every validation step below is written around:
  - The session's push guard refuses any shell command whose text holds `GIT_CONFIG_` followed by anything, or `core.hooksPath`, or `push` with `--no-verify` (`switchesOffPushGuard`, `src/commands/guardrails.ts:215`). So no validation command below spells those variable names. File contents may hold them; the guard looks only at shell commands. **Do not try to get round it** with `env -u …` or a wrapper script. That would switch the guard off for the commands run under it, which is exactly what this ticket must not do.
  - The probe guard refuses a building session any command that names the older checks' folder. The allow-list checks below therefore list what may change, rather than naming what may not.

## Open questions

These do not stop the plan. Each is written down so the step that meets it is not surprised.

1. **No session in a run can make "a shell with no run's git settings".** R1's second clause and R4's second clause ask for one. The session guard refuses every command that unsets those variables (see above), and it is right to. For R1 the answer already exists: the `tests` workflow in `.github/workflows/tests.yml` runs `npm test` on every pull request on a GitHub runner, which has no run's git settings. Its result on this phase's pull request is the evidence for R1's second clause, and 55c names it. For R4's second clause, the checking step has to find its own evidence, or say it could not. One argument it could make: once a check makes its throwaway repositories without the run's git settings, its git sees the same settings inside and outside a container, so its verdict cannot depend on which one it runs in. This is the checking step's call, not this phase's.
2. **The breakdown says "as `push-guard.git.test.ts` already does"; this phase removes fewer variables than that file does.** The Goal Description gives the reason. If a reader takes the breakdown's words to mean "copy that file's code", this is a departure, and it is recorded here so the pull request can argue it.
3. **The dry-run push in 55c only runs the guard when `HEAD` has a commit `origin/main` lacks.** With nothing to send, git prints `Everything up-to-date`, exits 0 and runs no hook. This was seen while planning, on a branch with no commits yet. By 55c the branch carries this phase's commits, so the hook runs. The step reads the output and does not trust the exit code alone.

## Sub-phases

### Sub-phase 55a: The helper, and the three smaller files pass inside a run's container

**[NEW FILE]** `src/test-support/run-git-settings.ts` — exports `withoutRunGitSettings(env: NodeJS.ProcessEnv = process.env): () => void`. It deletes from `env` every variable named `GIT_CONFIG_COUNT`, `GIT_CONFIG_KEY_<digits>` or `GIT_CONFIG_VALUE_<digits>`, and returns a function that puts back each deleted variable with its exact value. Nothing else in `env` is touched. A doc comment says why it exists (a run's container switches the push guard on through these variables, and the guard refuses a test's push of `main` to its own throwaway repository; PRD-11), that it is for tests only, that it runs no git, and why it edits the object rather than using `vi.stubEnv` (the `vi.unstubAllEnvs()` reason in the Goal Description). It does not import vitest, does not spawn git, and builds no path.
**[NEW FILE]** `src/test-support/run-git-settings.test.ts` — the red-green cases below, each on a plain object passed as `env`, never on `process.env`.
**[MODIFY]** `src/numbers.test.ts`, `src/commands/number.test.ts`, `src/workspace.test.ts` — in each, import `withoutRunGitSettings` and add, at top level beside the existing `afterEach`:

```ts
/** Puts back the run's git settings this file's tests ran without (PRD-11). */
let restoreRunGitSettings: () => void = () => {};

beforeEach(() => {
  restoreRunGitSettings = withoutRunGitSettings();
});
```

and call `restoreRunGitSettings()` first in the existing top-level `afterEach`. Add `beforeEach` to the vitest import. One short comment at the `beforeEach`, in the file's own style, says why: the throwaway repositories here are pushed to, and in a run's container the run's push guard would refuse those pushes. Nothing else in these files changes. No test is removed, renamed, skipped or loosened.

**Seams under test (TDD):** two seams. (1) `withoutRunGitSettings` is a public function with no I/O, so it is its own seam. Red-green: (a) given `{ GIT_CONFIG_COUNT: "2", GIT_CONFIG_KEY_0, GIT_CONFIG_VALUE_0, GIT_CONFIG_KEY_1, GIT_CONFIG_VALUE_1, GIT_AUTHOR_NAME: "bot", PATH: "/bin" }`, after the call the five config variables are absent and `GIT_AUTHOR_NAME` and `PATH` are unchanged; (b) calling the returned function puts back each of the five with its exact value, and leaves alone a variable that was added after the first call; (c) given an object with none of them, as outside a run, the call and the restore change nothing; (d) a numbered `GIT_CONFIG_KEY_7` / `GIT_CONFIG_VALUE_7` with no `GIT_CONFIG_COUNT` is removed too, and `GIT_CONFIG_NOSYSTEM` and `GIT_CONFIGURE` (not numbered config variables) are left alone. (2) The three test files, run inside a run's container, are the behaviour seam for R1 and R2. Red: on `main` in this container, 25 of their 26 tests fail on the guard (recorded in the Goal Description; the build step re-runs it before changing them and copies the count into its handoff). Green: all 26 pass.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
cd projects/timone
# This is a run's container: the count of numbered git settings is above 0.
env | grep -c '^GIT_CONFIG'
npm run build; echo "exit: $?"                                   # expect 0
npx vitest run src/test-support/run-git-settings.test.ts; echo "exit: $?"   # expect 0
npx vitest run src/numbers.test.ts src/commands/number.test.ts src/workspace.test.ts \
  --reporter=json --outputFile=/tmp/55a.json > /tmp/55a.log 2>&1; echo "exit: $?"   # expect 0
node -e 'const r=require("/tmp/55a.json");for(const f of r.testResults){const a=f.assertionResults;console.log(f.name.split("/src/")[1],a.length,a.filter(x=>x.status==="passed").length)}'
# expect: numbers.test.ts 16 16, commands/number.test.ts 4 4, workspace.test.ts 6 6
grep -c 'Refused: this run may push only to' /tmp/55a.log; echo "exit: $?"  # expect 0 matches, exit 1
npx vitest run src/guards; echo "exit: $?"                          # expect 0: the helper needs no exemption
git diff origin/main -- src/numbers.test.ts src/commands/number.test.ts src/workspace.test.ts \
  | grep -E '^\+.*\b(it|describe|test)\.(skip|todo|only)\b'; echo "exit: $?"   # expect exit 1: nothing skipped
git diff --name-only origin/main -- src | grep -v '\.test\.ts$'; echo "exit: $?"
# expect exactly: src/test-support/run-git-settings.ts
git diff --name-only origin/main \
  | grep -vE '^(src/(numbers|workspace)\.test\.ts|src/commands/number\.test\.ts|src/test-support/run-git-settings(\.test)?\.ts|doc/plans/phases/phase-55\.md|doc/plans/phases/reports/phase-55-[a-z-]+\.md|STATUS\.md)$'; echo "exit: $?"
# expect exit 1: nothing outside this list changed
```

- [ ] The helper's four cases went red before the helper existed and green after, shown in the handoff.
- [ ] The three files' red run on `main` in this container (25 failures) and the green run (26 of 26) are both in the handoff, with the count of numbered git settings seen in the environment.
- [ ] The three files hold 26 tests, all passing: the same count as on `main`.
- [ ] No program file under `src/` other than the new helper changed, and the helper neither spawns git nor imports vitest.

---

### Sub-phase 55b: `guardrails.test.ts` passes inside a run's container

**[MODIFY]** `src/commands/guardrails.test.ts` — import `withoutRunGitSettings` from `../test-support/run-git-settings.js`, and add the same top-level `beforeEach` and restore as in 55a, with the restore called first in the existing top-level `afterEach` at line 29. Add `beforeEach` to the vitest import. Nothing else changes: not the `git` helper, not `prePushOutsideGit`, not the `guardOnBash` cases.

**Seams under test (TDD):** the file itself, run inside a run's container, is the seam. It drives real git and the guardrails command code, and that is where R1 and R2 are observed. No new test cases are written: the 52 that exist are the cases. Red: on `main` in this container, 45 of 52 fail on the guard. Green: 52 of 52 pass. One case needs a look, not only a count: a test that uses `prePushOutsideGit` calls `vi.unstubAllEnvs()` halfway. The step confirms from the green run that such a test still passes, and that no `Refused: this run may push only to` line appears after it. That shows the run's settings were not put back halfway through a test.

> Sub-phase 55a must be complete before starting this sub-phase (it creates the helper this file imports).

#### Agent Validation Steps

```bash
cd projects/timone
env | grep -c '^GIT_CONFIG'                                         # above 0: a run's container
npm run build; echo "exit: $?"                                      # expect 0
npx vitest run src/commands/guardrails.test.ts \
  --reporter=json --outputFile=/tmp/55b.json > /tmp/55b.log 2>&1; echo "exit: $?"   # expect 0
node -e 'const r=require("/tmp/55b.json");for(const f of r.testResults){const a=f.assertionResults;console.log(f.name.split("/src/")[1],a.length,a.filter(x=>x.status==="passed").length)}'
# expect: commands/guardrails.test.ts 52 52
grep -c 'Refused: this run may push only to' /tmp/55b.log; echo "exit: $?"  # expect 0 matches, exit 1
git diff origin/main -- src/commands/guardrails.test.ts \
  | grep -E '^\+.*\b(it|describe|test)\.(skip|todo|only)\b'; echo "exit: $?"   # expect exit 1
git diff origin/main -- src/commands/guardrails.test.ts | grep -c '^-[^-]'; echo "exit: $?"
# expect a count of 0 or 1 (at most the vitest import line is replaced); exit 1 when 0
```

- [ ] The red run on `main` in this container (45 of 52 failing) and the green run (52 of 52) are both in the handoff.
- [ ] The file holds 52 tests, all passing: the same count as on `main`.
- [ ] The diff to this file adds the import, the `beforeEach` and the restore call, and removes nothing but the old vitest import line.

---

### Sub-phase 55c: The whole suite in the container, the guard still refusing `main`, and PRD-11's phase line

**[MODIFY]** `doc/specs/prd/prd-11-tests-and-checks-run-inside-a-runs-container.md` — the `> **Phases:** none yet` line becomes `> **Phases:** [phase 55](../../plans/phases/phase-55.md) (piece 1, #228)`, in the form `prd-09`'s line uses.

**Seams under test (TDD):** no behaviour-carrying code in this sub-phase, so no seams are declared. It runs the whole-suite gate for R1 and the guard checks for R3, and changes one line of documentation. Validation is checklist-based.

> Sub-phases 55a and 55b must be complete before starting this sub-phase (the whole suite only passes once all four files are fixed).

#### Agent Validation Steps

```bash
cd projects/timone
env | grep -c '^GIT_CONFIG'                                         # above 0: a run's container
# R1 — the whole suite, inside a run's container.
npm run build && npx vitest run --reporter=json --outputFile=/tmp/55c.json > /tmp/55c.log 2>&1; echo "exit: $?"   # expect 0
node -e 'const r=require("/tmp/55c.json");console.log("total",r.numTotalTests,"failed",r.numFailedTests,"skipped",r.numPendingTests+r.numTodoTests)'
# expect: failed 0, skipped 0, total = 1984 + the helper's new tests
grep -c 'Refused: this run may push only to' /tmp/55c.log; echo "exit: $?"  # expect 0 matches, exit 1
# R3 — the guard and the container's settings are untouched, and their tests pass unchanged.
git diff --quiet origin/main -- src/daemon/push-guard.ts src/daemon/container-runtime.ts \
  src/daemon/push-guard.test.ts src/daemon/push-guard.git.test.ts; echo "exit: $?"   # expect 0
npx vitest run src/daemon/push-guard.test.ts src/daemon/push-guard.git.test.ts; echo "exit: $?"   # expect 0
# R3 — a push to the project's real main is still refused (a dry run sends nothing; the hook still runs).
git log --oneline origin/main..HEAD | head -3                       # must list at least one commit
git push --dry-run origin HEAD:main; echo "exit: $?"
# expect: the guard's "Refused: this run may push only to" line, and a non-zero exit
# R2 — nothing outside tests and the test helper changed under src/; nothing switches the guard off for the whole run.
git diff --name-only origin/main -- src | grep -v '\.test\.ts$'; echo "exit: $?"
# expect exactly: src/test-support/run-git-settings.ts
git diff --quiet origin/main -- package.json vitest.config.ts; echo "exit: $?"   # expect 0
grep -rln 'test-support/run-git-settings' src | grep -v '\.test\.ts$'; echo "exit: $?"
# expect exit 1: only tests import the helper
# The building step changed only these files.
git diff --name-only origin/main \
  | grep -vE '^(src/(numbers|workspace)\.test\.ts|src/commands/(number|guardrails)\.test\.ts|src/test-support/run-git-settings(\.test)?\.ts|doc/plans/phases/phase-55\.md|doc/plans/phases/reports/phase-55-[a-z-]+\.md|doc/specs/prd/prd-11-tests-and-checks-run-inside-a-runs-container\.md|STATUS\.md)$'; echo "exit: $?"
# expect exit 1
```

- [ ] The whole suite passes in this container: 0 failed, 0 skipped, and no guard refusal line in the log.
- [ ] The dry-run push to `main` was refused by the guard, with its `Refused:` line in the output, and exited non-zero. The output is copied into the handoff.
- [ ] `push-guard.ts`, `container-runtime.ts` and their two test files are unchanged, and those tests pass.
- [ ] The completion report says that R1's second clause (the suite outside a run's container) is shown by the `tests` workflow on the pull request, and why no session can show it from inside a run (Open question 1).
- [ ] The completion report says that R4 and R5 are left to the step that checks the build: this phase changed none of the older checks, and every commit it made passes the allow-list check above.

## Dependency graph

```
55a → (none)        the helper, and numbers / number / workspace tests pass in a run's container
55b → 55a           guardrails tests pass in a run's container
55c → 55a, 55b      the whole suite, the guard still refusing main, PRD-11's phase line
```

55a and 55b change different files, but 55b imports what 55a creates, so they run one after the other.
