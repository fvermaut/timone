# Phase 61 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 61a — The update finds check scripts named with a dash, and runs a project's `test:` scripts when it has no `test`

**Built.** `checkScriptOf` now also finds a check script whose name has a dash for the ID's dot (`prd-18-r12.mjs` for `PRD-18.R12`). When both names are there, the dotted one wins. It still looks only directly in the project's probe folder. A new `requirementOfCheckScript(path)` reads the requirement ID back from a check script's path, in either probe folder. `UpdateChecks.testCommand` is replaced by `testCommands: string[]`: `["npm test"]` when `package.json` has `scripts.test`; otherwise `npm run <name>` for each `test:` script with no `watch` part, in file order; otherwise `[]`. `timone update-checks` prints the commands joined by ", then " and ending with a full stop, or the new sentence when there are none. `--json` carries `testCommands`, since it prints the result object as it is.

**Files touched.**

- `src/update-checks.ts` — `checkScriptOf` tries the dotted name, then the dashed one; new `CHECK_SCRIPT_NAME` and `requirementOfCheckScript`; new private `testCommandsOf`; `testCommand` replaced by `testCommands`.
- `src/commands/update-checks.ts` — the test-command block of the plain output, and one word of the doc comment ("test commands").
- `src/update-checks.test.ts` — cases 1–4 (five new tests).
- `src/update-checks.git.test.ts` — cases 5–8 (four new tests, one new fixture `levelWithScripts`), and case 9: the two existing test-command tests read `testCommands`, and the plain-output test expects the new sentence.
- `doc/plans/phases/reports/phase-61-handoffs.md` — created, with this section.

**Decisions taken inside the slice.**

- `requirementOfCheckScript` takes the extension as one dot-free part (`\.[^.]+$`). So `prd-18.r12.mjs` matches, and a file such as `prd-18.r12.test.mjs` does not. The plan says "plus an extension", in the singular.
- The folder test in `requirementOfCheckScript` compares the part of the path before the last `/` with each entry of `PROBE_DIRECTORIES` using `.some`, not with `as readonly string[]`, because the TypeScript standard bans `as` there.
- The plain line with commands ends with a full stop, as the plan's example sentence does: "The project's tests: npm test." The old line had none.
- The existing test "is undefined when package.json has no scripts.test" was renamed "is none when package.json has no scripts.test" and now expects `[]`. It now covers the same ground as case 7. I kept it, because the plan says the existing cases stay. The existing test "is the project's scripts.test" was renamed "is npm test when the project has a scripts.test".
- No test was added for "no `package.json` → `[]`". The plan states this behaviour but does not list it as a case. The code gives `[]` for it, since it reads no scripts.

**Validation evidence.** Paths in failure lines are written as `<probe folder>`.

- Case 1, `checkScriptOf > returns the file named by the lowercased ID with a dash for the dot`: red `AssertionError: expected undefined to be '<probe folder>/prd-18-r12.mjs'`. Green after the dashed name was added: 3 passed.
- Case 2, `checkScriptOf > returns the dotted name when both the dotted and the dashed name are there` (dashed file listed first): red `AssertionError: expected '<probe folder>/prd-18-r12.mjs' to be '<probe folder>/prd-18.r12.mjs'`. Green after the dotted name is tried first, then the dashed one: 4 passed.
- Case 3, `checkScriptOf > returns no dashed file whose name only starts with the ID, and none in a sub-folder`: green on arrival. Two mutations made it fail, and each was reverted. (a) A prefix match (`fileName.startsWith(wanted)`) gave `expected '<probe folder>/prd-18-r120.m…' to be undefined`. (b) Matching on the base name only (`file.slice(file.lastIndexOf("/") + 1)`) gave `expected '<probe folder>/old/prd-18-r1…' to be undefined`. Removing the `includes("/")` test alone did not make it fail: the name comparison already refuses a path with a sub-folder. So that check is redundant (see the next section).
- Case 4a, `requirementOfCheckScript > gives the requirement of a check script with the dotted or the dashed name, in either probe folder`: red `TypeError: (0 , requirementOfCheckScript) is not a function`. Green after a name-only match: 6 passed.
- Case 4b, `requirementOfCheckScript > gives nothing for a helper file, a file outside both probe folders, or a file in a sub-folder`: red `AssertionError: expected 'PRD-18.R12' to be undefined`. Green after the folder test: 7 passed.
- Case 5, `the project's test commands > are each test: script but the watch one, in the order package.json lists them, when it has no scripts.test`: red `AssertionError: expected undefined to deeply equal [ 'npm run test:unit', …(2) ]`. Green after `testCommandsOf`: 15 passed (both files).
- Case 6, `… > are npm test alone when package.json has scripts.test, even with test: scripts`: red `AssertionError: expected [ 'npm run test:unit' ] to deeply equal [ 'npm test' ]`. Green after the `scripts.test` rule: 9 passed (git file).
- Case 7, `… > are none when package.json has neither scripts.test nor a test: script`: green on arrival. A mutation that dropped the `test:` filter gave `expected [ 'npm run build', 'npm run lint' ] to deeply equal []` and was reverted.
- Case 8, `updateChecks on a branch whose check script has a dash for the dot > lists the dashed script under the plan's requirement`: green on arrival, because case 1 had already added the dashed name. A mutation back to the dotted name only (`return named(name);`) gave `AssertionError: expected { …(2) } to deeply equal { …(2) }` and was reverted.
- Case 9: the two existing test-command tests were moved to `testCommands` and passed while the old field still existed. The plain-output test was changed to expect "The project has no test command: its package.json has no scripts.test and no test: script." It was red against the old build: `expected 'The project has no test command: ther…' to be 'The project has no test command: its …'`. Then `testCommand` was removed, the command was changed, and `npm run build` was run. Green: 18 passed (both files).

Validation commands, as run:

```
$ npx vitest run src/update-checks.test.ts src/update-checks.git.test.ts src/commands
 ✓ src/update-checks.test.ts (7 tests)
 ✓ src/update-checks.git.test.ts (11 tests)
 ❯ src/commands/number.test.ts (4 tests | 3 failed)
 ❯ src/commands/guardrails.test.ts (121 tests | 45 failed)
 Test Files  2 failed | 13 passed (15)
      Tests  48 failed | 289 passed (337)
```
All 48 failures are the known push-guard failures ("Refused: this run may push only to `timone/234-…`"): 45 in `guardrails.test.ts` and 3 in `number.test.ts`. Both update-checks files pass in full. **Result: pass**, except for the known failures.

```
$ npx tsc --noEmit; echo "exit: $?"
exit: 0
```
**Result: pass.**

```
$ grep -rn "testCommand\b" src --include=*.ts | grep -v '^\s*//' ; echo "exit: $?"
exit: 1
```
**Result: pass.** No reader of the old field is left in `src`.

- [x] Every case above is red before the change and green after, and the handoff shows both runs. Cases 3, 7 and 8 were green on arrival. For each, a mutation that made it fail is recorded above.
- [x] No file and no command in this sub-phase names a probe folder as text. Tests build paths with `probe(name)` / `posix.join(PROBE_DIRECTORIES[i], …)`. The code uses `PROBE_DIRECTORIES`.

At slice end: `src/update-checks.test.ts` 7 passed, and `src/update-checks.git.test.ts` 11 passed. Whole suite (`npm test`): **77 files, 2761 tests: 2690 passed, 71 failed; 8.08 s.** Failing files: `guardrails.test.ts` 45, `numbers.test.ts` 16, `workspace.test.ts` 6, `number.test.ts` 3. All 70 fail on the push guard's refusal of `git push … main`. The other failure is `register.test.ts` 1 ("this repository's own registers > claim nothing they have not established"). This is the same list as before the phase. No failure is new.

**What 61b must know.**

- `requirementOfCheckScript(path)` takes a path from the repository's root, as git lists it, with `/` separators. It answers only for a file directly in one of the two `PROBE_DIRECTORIES` entries. A helper such as `_shared.mjs` gives undefined.
- `dist/` was rebuilt (`npm run build`) after the command changed. `src/update-checks.git.test.ts` runs the built `dist/cli.js`, so rebuild before running it after any command change.
- Not changed here, for a later sub-phase: `.claude/skills/timone-update/SKILL.md` (around line 86) still says to run "the project's test command" as `npm test` from `scripts.test`. The command now prints a list of commands. `doc/plans/phases/phase-50.md` and its handoff still describe `testCommand`. They are history and were left as they are.
- Refactor idea, not done: in `checkScriptOf`, the `!fileName.includes("/")` test cannot change the answer, because the name comparison already refuses a path with a sub-folder.

## 61b — A command says which conflicted files are check scripts the update joins, and which go to the fix context

**Built.** `mergeConflicts(git)` reads `git diff --name-only --diff-filter=U` and splits the files a merge left in conflict into two lists, each in git's order. `checkScripts` holds every file under either probe folder, with `id` from `requirementOfCheckScript` when the name gives one. `others` holds every other file. The new command `timone update-conflicts <project> [--json]` runs it in the project's checkout and prints the two lists under the plan's two headings, with "none" under an empty one. With no merge in progress it exits 2 with "No merge is in progress in <project>: there is nothing to join." The probe guard's comment on `CHECKING_STAGES` and its allow reason for the update now say the update also joins a check script that a merge left in conflict (ADR-0068 D1). The decision does not change: `update` and `verification` are allowed, `execution` and `remediation` are refused.

**Files touched.**

- `src/update-checks.ts` — new `MergeConflicts` and `mergeConflicts`.
- `src/commands/update-conflicts.ts` — created: the command.
- `src/cli.ts` — registers the command after `update-checks`.
- `src/daemon/probeGuard.ts` — the comment on `CHECKING_STAGES`; the allow reason for `update` (verification's reason is unchanged).
- `src/daemon/probeGuard.test.ts` — the expected reason for `update` in the table of judged calls. That table asserted the old reason word for word. Nothing else in the file changed.
- `src/guards/checkouts.test.ts` — `commands/update-conflicts.ts` added to `GIT_USERS`, beside `commands/update-checks.ts` (granted by the plan's ✏ 2026-10-13 amendment).
- `src/update-checks.git.test.ts` — cases 1–7 (eight new tests), two new fixtures (`bothChangedOneCheckScript`, `merging`) and a helper `checkScript`.
- `doc/plans/phases/reports/phase-61-handoffs.md` — this section.

**Decisions taken inside the slice.**

- Under an empty heading the command prints `none` on its own line, not `- none`, so it cannot be read as a file called "none". No case covers this line, since the plan lists none; it is not tested.
- `--json` prints the `MergeConflicts` object as it is, as `update-checks --json` does. No case covers it, as the plan lists none.
- The command tells "no merge" apart with `spawnSync("git", ["rev-parse", "-q", "--verify", "MERGE_HEAD"])` and its exit status. It does not catch an error from the throwing git port for this. Any other git failure goes through the port and exits 2 with git's own words.
- The command copies `gitIn` and the manifest lookup from `src/commands/update-checks.ts`. It does not import them, because exporting them would mean changing that file, which is not on this slice's list. This is the second copy (see the refactor idea below).
- The update's allow reason is its own sentence: "Update runs the checks kept in <the two probe folders>, and joins one that a merge left in conflict, so it may read them and edit them." Verification keeps the old sentence, because it does not join.
- The tests run every merge through the fixture's `mustGit`, which runs git with no `GIT_*` variable from this process. So the container's merge drivers and hooks cannot change what git leaves in conflict.
- Case 6 is "a merge whose conflict was joined and added, but not yet committed": `MERGE_HEAD` is still there and nothing is left in conflict. Case 2 already covers the finished merge.
- Case 2 checks that `MERGE_HEAD` is gone by looking for `.git/MERGE_HEAD` in the clone. Case 1's world has `main` land phase 49 as a squash commit naming pull request 230, so case 2 can check `pullRequest` too.

**Validation evidence.** Paths in failure lines are written as `<probe folder>`. All tests are in `src/update-checks.git.test.ts`.

- Case 1, `mergeConflicts while the update merges the default branch into the branch > lists a check script both sides changed, with its requirement, apart from the other files`: red `TypeError: (0 , mergeConflicts) is not a function`; the test's own `toThrow(/CONFLICT/)` on the merge passed first, so the merge did stop on a conflict. Green after `mergeConflicts`, which at that point looked only in the project's probe folder: 12 passed.
- Case 2, `… > lists nothing once the update joined the check script and finished the merge, and the joined script counts for both plans`: green on arrival. A mutation reading `git diff --name-only HEAD^1` (the files the merge brought) gave `AssertionError: expected { checkScripts: [ { …(2) } ], …(1) } to deeply equal { checkScripts: [], others: [] }` and was reverted.
- Case 3, `mergeConflicts on other conflicts in the probe folders > lists a script both sides added, named with a dash, with its requirement`: green on arrival; the test also checks that git said `CONFLICT (add/add)`. Two mutations each made it fail and were reverted. (a) `CHECK_SCRIPT_NAME` with only the dot gave `expected { …(2) } to deeply equal { checkScripts: [ { …(2) } ], …(1) }`. (b) Reading only `UU` lines of `git status --porcelain`, which leaves out an add/add conflict, gave `expected { checkScripts: [], others: [] } to deeply equal { checkScripts: [ { …(2) } ], …(1) }`.
- Case 4, `… > lists a helper file in the probe folder with the check scripts, with no requirement, never with the other files` (`toStrictEqual`, so an `id: undefined` would fail): green on arrival. Two mutations each made it fail and were reverted. (a) Deciding by `requirementOfCheckScript` alone put the helper in `others`: `expected { checkScripts: [], …(1) } to strictly equal { …(2) }`. (b) Always writing `id`, even when undefined: `expected { checkScripts: [ { …(2) } ], …(1) } to strictly equal { …(2) }`.
- Case 5, `… > lists a file in the other probe folder with the check scripts` (built with `posix.join(PROBE_DIRECTORIES[1], "contrast.mjs")`): red `AssertionError: expected { checkScripts: [], …(1) } to strictly equal { …(2) }`. Green after the test runs over both `PROBE_DIRECTORIES` entries: 16 passed.
- Case 6, `mergeConflicts once no conflict is left > gives two empty lists while the merge is still in progress`: green on arrival. A mutation reading `git diff --name-only HEAD` gave `expected { checkScripts: [], …(1) } to deeply equal { checkScripts: [], others: [] }` (and case 1 failed too) and was reverted.
- Case 7a, `the update-conflicts command > exits 2 with one sentence when no merge is in progress`: red `expected 'error: unknown command \'update-confl…' to be 'No merge is in progress in app: there…'`. Green after the command with only the no-merge path, registered, and `npm run build`: 18 passed.
- Case 7b, `… > prints the check scripts and the other files left in conflict under their headings`: red `expected '' to be 'Check scripts left in conflict — join…'`. Green after the plain output and `npm run build`: 19 passed.
- The guard's reason: after the reason changed, `probeGuard.test.ts` failed 26 tests, all for stage `update`, all on the reason text (`expected { permissionDecision: 'allow', …(1) } to deeply equal …`). Only the expected `update` entry of the `judged` table was changed. Then 679 passed.

Validation commands, as run (from `/workspace/timone/projects/timone` unless said):

```
$ npx vitest run src/update-checks.test.ts src/update-checks.git.test.ts src/daemon/probeGuard.test.ts src/commands
 ✓ src/daemon/probeGuard.test.ts (679 tests)
 ✓ src/update-checks.test.ts (7 tests)
 ✓ src/update-checks.git.test.ts (19 tests)
 ❯ src/commands/number.test.ts (4 tests | 3 failed)
 ❯ src/commands/guardrails.test.ts (121 tests | 45 failed)
 Test Files  2 failed | 14 passed (16)
      Tests  48 failed | 976 passed (1024)
```
All 48 failures are the known push-guard failures (`git push … main` refused: "Refused: this run may push only to `timone/234-…`"): 45 in `guardrails.test.ts`, 3 in `number.test.ts`. **Result: pass**, except for the known failures.

```
$ npx tsc --noEmit; echo "exit: $?"
exit: 0
```
**Result: pass.**

```
$ npm run --silent build && node dist/cli.js update-conflicts timone; echo "exit: $?"
The project "timone" is not checked out at /workspace/timone/projects/timone/projects/timone.
exit: 2
```
From the project folder the command cannot find the checkout: the manifest's path for `timone` is `projects/timone`, read from the folder the command runs in, as `update-checks` does. Run from the Timone root instead:
```
$ cd /workspace/timone && node projects/timone/dist/cli.js update-conflicts timone; echo "exit: $?"
No merge is in progress in timone: there is nothing to join.
exit: 2
```
**Result: pass**, from the Timone root.

- [x] Case (1) is the test for an update where both sides changed one check script, and it is red before `mergeConflicts` exists (`TypeError: (0 , mergeConflicts) is not a function`).
- [x] Red→green evidence for every case is above. Cases 2, 3, 4 and 6 were green on arrival; for each, a mutation that made it fail is recorded.
- [x] The guard still allows `update` and still refuses `execution` and `remediation`: `probeGuard.test.ts` passes (679), changed only in the expected reason text for `update`.

At slice end, before the amendment: `src/update-checks.test.ts` 7 passed, `src/update-checks.git.test.ts` 19 passed, `src/daemon/probeGuard.test.ts` 679 passed. The whole suite then had 72 failures: the 71 known ones, and `src/guards/checkouts.test.ts > the human's checkout is his alone > performs git only where somebody said so, and said what on` (`expected [ 'commands/update-conflicts.ts' ] to deeply equal []`). That test lists every source file that runs git, and the new command runs git.

**The plan was amended** (✏ 2026-10-13 under 61b in `phase-61.md`): it grants `src/guards/checkouts.test.ts`, and it runs the third validation line from the Timone root. The `GIT_USERS` entry for `commands/update-conflicts.ts` was added, saying it runs only `rev-parse -q --verify MERGE_HEAD` and `diff --name-only --diff-filter=U`. Then:

```
$ npx vitest run src/guards/checkouts.test.ts
 Test Files  1 passed (1)
      Tests  7 passed (7)
```
Whole suite (`npm test`): **77 files, 2769 tests: 2698 passed, 71 failed; 8.02 s.** Failing: `guardrails.test.ts` 45, `numbers.test.ts` 16, `workspace.test.ts` 6, `number.test.ts` 3 (all the push guard's refusal of `git push … main`), and `register.test.ts` 1 ("this repository's own registers"). This is exactly the known list. No failure is new.

**What 61c must know.**

- The command's checkout is `config.path` read from the folder it runs in, as for `update-checks`. In a session it must run from the Timone root, as `node dist/cli.js update-conflicts <project>` there.
- `dist/` was rebuilt after the command was added. The command tests in `src/update-checks.git.test.ts` run the built `dist/cli.js`.
- The guard's pattern list in `checkouts.test.ts` matches `execFileSync("git"` but not `spawnSync("git"`. The command uses both. It is caught today only through `execFileSync`. This is a gap in that guard, noted here and not changed.
- Refactor ideas, not done: `gitIn` and the manifest lookup are now the same in `commands/update-checks.ts` and `commands/update-conflicts.ts`; one shared helper would remove the copy. The module comment at the top of `src/update-checks.ts` still describes only the three test sets, not `mergeConflicts`.

## 61c — The record says which check scripts were joined, and when the entry was written

**Built.** `UpdateEntry` has two new fields. `at` is the time after the dash of the entry's heading, `## Update <k> — <ISO time>`, as written there, when `Date.parse` reads it as a date; otherwise undefined. `checkScriptsJoined` is the value of the field line `- **Check scripts joined:** ...`, read whole, or undefined when the entry has no such line. `updateSection` adds one line, "Check scripts joined: <value>.", with a blank line after it, right after the "What had to change" (or "No code had to change.") line, when the field is there and is not `none`. The field is not read by `failuresOf`, so it never decides whether the work passes. An entry with no such line gives the same section as before.

**Files touched.**

- `src/runner/update-section.ts` — `at` and `checkScriptsJoined` on `UpdateEntry`; new private `timeOf`; the new line in `updateSection`.
- `src/runner/update-section.test.ts` — a new `describe` with four tests (cases 1–4). The six existing tests are unchanged (case 5).
- `doc/plans/phases/reports/phase-61-handoffs.md` — this section.

**Decisions taken inside the slice.**

- The section line goes through the file's `sentence` helper: it adds a full stop only when the value does not already end with `.`, `!` or `?`. So a value that ends with a full stop does not get a second one. No test covers that, since the plan lists no such case.
- The line comes after the code line in both its forms ("What had to change: …" and "No code had to change."), followed by a blank line, as the code line is.
- `at` keeps the heading's text as written; it is not turned into a `Date` or rewritten. "Parses as a date" is `!Number.isNaN(Date.parse(time))`, as the plan words it. `Date.parse` is lenient: some text that is not an ISO time also reads as a date (for example a bare number). A stricter ISO pattern was not added, because the plan does not ask for one.
- Nothing reads `at` yet in this slice.

**Validation evidence.** All tests are in `src/runner/update-section.test.ts`, under `the update record's time and joined check scripts (ADR-0068)`.

- Case 1, `reads the time of an entry from its heading, and none when the heading has no time or a time that is not a date`: red `expected undefined to be '2026-10-13T12:38:51Z'`. Green after `timeOf`: 7 passed. The "not a date" part was shown not to be vacuous: a mutation returning the text with no date test gave `expected 'not a time' to be undefined`, and was reverted (7 passed again).
- Case 2, `reads the joined check scripts whole, with every requirement and how each was joined`: red `expected undefined to be 'PRD-17.R3: kept the version that fail…'`. Green after the field was read: 8 passed.
- Case 3, `says which check scripts were joined and how, under what had to change, and leaves the heading as it was` (the whole block, hand-written; and the same entry without the line keeps `### Brought level with main`): red `expected '<!-- timone:update -->\n### Brought l…' to be '<!-- timone:update -->\n### Brought l…'`. Green after the line was added for any value that is there: 9 passed.
- Case 4, `says nothing about joined check scripts when the record says none, or has no such line`: red on `none`, `expected true to be false`. Green after the `none` test: 10 passed. The "no such line" half was green on arrival. A mutation dropping the `!== undefined` test made it fail (`expected true to be false`), and the first existing test failed too; reverted, 10 passed.
- Case 5, the six existing tests: unchanged and green at every step above.

Validation commands, as run:

```
$ npx vitest run src/runner/update-section.test.ts src/runner/driver.test.ts
 ✓ src/runner/update-section.test.ts (10 tests)
 ✓ src/runner/driver.test.ts (34 tests)
 Test Files  2 passed (2)
      Tests  44 passed (44)
```
**Result: pass.**

```
$ npx tsc --noEmit; echo "exit: $?"
exit: 0
```
**Result: pass.**

- [x] Red→green evidence for every case is above. Case 4's "no such line" half and case 5 were green on arrival; the mutations that made them fail are recorded.
- [x] `src/runner/driver.test.ts` passes unchanged (34 passed; `git status` shows only the two `update-section` files changed). Its update block is built from an old entry with no `Check scripts joined:` line, and it is the same.

At slice end: `src/runner/update-section.test.ts` 10 passed, `src/runner/driver.test.ts` 34 passed. Whole suite (`npm test`): **77 files, 2773 tests: 2702 passed, 71 failed; 8.05 s.** Failing: `guardrails.test.ts` 45, `numbers.test.ts` 16, `workspace.test.ts` 6, `number.test.ts` 3 (all the push guard's refusal of `git push … main`), and `register.test.ts` 1 ("this repository's own registers > claim nothing they have not established"). This is exactly the known list. No failure is new.

**What the next slice must know.**

- `entry.at` is the heading's text, not a `Date`. Compare times with `Date.parse(entry.at)`. It is undefined for a heading with no time or with text that does not read as a date.
- The field label code reads is exactly `Check scripts joined` (capital C, the rest lower case). The update's instructions (`.claude/skills/timone-update/SKILL.md`, "The record entry") do not have that line yet; a later slice must add it in that exact form, inside the bold with the colon, for example `- **Check scripts joined:** none`.
- The value must be one line, as for every other field.

## 61d — An update that did not bring the branch level ends as failed, and the runner asks a person

**Built.** When an update step's session ends cleanly, the runner's actions now check, before they write the `step-ended` entry, whether the step really brought the branch level (ADR-0068 D4). They read the newest entry of the branch's update record. When that entry was written at or after the step's start, they ask the forge whether the branch holds the commit in its `Level with:` line. When there is no such new entry, they ask how far the branch is behind the default branch. The pure rule `unfinishedUpdate` turns those answers into a reason, or none. With a reason, the entry is written with `ok: false` and the reason as `error`, and the driver tells the runner "The step bringing the work up to date ended: it failed: <reason>." A forge that fails on the way is logged, and the step is written as its session ended. Every other stage, and an update whose session already failed, is written as before and asks the forge nothing. The port has a new call, `branchHolds(project, branch, commit)`, through `gh api repos/<slug>/compare/<commit>...<branch> --jq .behind_by`. `newestUpdateEntry` moved out of the driver's `updateOf` into `facts.ts`. The runner's rule for a branch behind the default branch now says what to do when the update failed.

**Files touched.**

- `src/adapters/ticketing.ts` — `branchHolds` on the port.
- `src/adapters/github-tickets.ts` — `branchHolds`: true when `behind_by` is 0, undefined on a 404, any other error thrown.
- `src/adapters/github-tickets.test.ts` — case 6 (three tests), and `branchHolds` added to the list in "names a repository in every argument vector it builds".
- `src/adapters/ticketing.stubs.ts` — `noRunnerCalls.branchHolds` answers true, with a comment saying why.
- `src/runner/replay/recording.ts` — the replay's forge answers `branchHolds` with true, as it answers "level" to `behindDefault`.
- `src/runner/facts.ts` — new `newestUpdateEntry(adapter, project, branch)`.
- `src/runner/driver.ts` — `updateOf` calls `newestUpdateEntry`, then reads the default branch's name for `updateSection`; the section is the same as before.
- `src/runner/update-section.ts` — new `unfinishedUpdate`, and two small exported helpers it and the actions share: `isNewSince(entry, startedAt)` and `levelWithCommit(entry)`.
- `src/runner/update-section.test.ts` — cases 1–5 (five tests).
- `src/runner/actions.ts` — `updateUnfinished`, called in `watchStep`'s `ended` for a clean update; the step's start time is kept in a local, used for the running step too; `afterwards` and `stepEnded` get the result with the outcome as written.
- `src/runner/actions.test.ts` — the fake forge answers `branchHolds` with true. No case here (see the decisions).
- `src/runner/driver.test.ts` — cases 7–10 (four tests) in a new `describe`, with a helper `updatingChore`.
- `src/runner/brief.ts` — the update bullet of `SYSTEM`, word for word as the plan gives it.
- `src/runner/brief.test.ts` — the existing update test now expects "When it succeeded, start nothing more for it: …"; a new test for the failed-update sentences (case 11).
- `doc/plans/phases/reports/phase-61-handoffs.md` — this section.

**Decisions taken inside the slice.**

- Case (4)'s "commit(s)": the reason says "1 commit" for one and "<n> commits" for more. Case 4's test checks both 3 and 1.
- An entry is new when `Date.parse(entry.at) >= Date.parse(startedAt)`. An entry with no readable time (`at` undefined) is never new, so the step is then judged by how far the branch is behind.
- The commit is the hex text after the last " at " of the `Level with:` value (`/ at ([0-9a-f]{7,40})$/`). A new entry whose `Level with:` names no such commit gets no forge question, so `holds` is undefined and the step is not made a failure.
- When the entry gives no failure (its result passes, or says "does not pass" with nothing after it), the reason is "the merge of main at <sha> was not finished", with no colon.
- `startedAt` is the clock reading when the actions write the running step. The `step-started` entry reads the clock once more, just before; both readings are taken in the same moment.
- `afterwards` and the driver's `stepEnded` are given the result with the outcome as written. So the driver's fallback, used only when the record cannot be read, tells the runner the same thing as the record. For any step but a failed check of an update, this is the same result as before.
- Cases 7–10 are in `driver.test.ts`, not `actions.test.ts`. They start the step through `runnerActions(driver.actionsFor(run), run).startStep`, as the existing driver tests do, so each test sees both the record's `step-ended` entry and the event the runner is woken with. The fake world of `actions.test.ts` has a stand-in for the driver and no wake, and its forge throws on `listFiles`. Case 9 lets the run build first (`store.decidePlanner(... "build" ...)`), because the build needs the planner's decision.
- Case 3's test gives `holds: false` with the old entry, so it checks that an old entry is not judged by whether the branch holds its commit. The actions never ask that question for an old entry.
- The log line for case 10 is: "runner <run> — whether the update brought the branch level could not be read, so its end is written as its session ended: <error>".

**Validation evidence.**

- Case 1, `update-section.test.ts > why an update step … > finds nothing wrong when the step wrote a new entry and the branch holds its commit, also when the work does not pass`: red `TypeError: (0 , unfinishedUpdate) is not a function`. Green after a stub that answers undefined: 11 passed.
- Case 2, `… > says the merge was not finished, naming the commit and the failure the entry gives, when the branch does not hold that commit`: red `AssertionError: expected undefined to be 'the merge of main at 9b1e0d2 was not …'`. Green after the `holds === false` branch and `levelWithCommit`: 12 passed.
- Case 3, `… > finds nothing wrong when the only entry is older than the step and the branch is level, whatever that old entry says`: red `AssertionError: expected 'the merge of main at 9b1e0d2 was not …' to be undefined`. Green after `isNewSince`: 13 passed.
- Case 4, `… > says the step wrote no entry and how far the branch is still behind, when there is no entry and the branch is behind`: red `AssertionError: expected undefined to be 'it wrote no record entry, and the bra…'`. Green after the `behind` branch: 14 passed.
- Case 5, `… > finds nothing wrong when the forge did not say whether the branch holds the commit, or how far it is behind`: green on arrival. Two mutations each made it fail, and each was reverted. (a) `if (holds === true) return undefined;` gave `expected 'the merge of main at 9b1e0d2 was not …' to be undefined`. (b) `if (behind === 0) return undefined;` gave `expected 'it wrote no record entry, and the bra…' to be undefined`. Then 15 passed.
- Case 6, `github-tickets.test.ts > the forge calls the runner needs > says a branch holds a commit when …`, `… > answers undefined when the compare knows neither the commit nor the branch`, `… > reports a failed compare other than a 404, and never renders it as an answer`: all three red `TypeError: adapter.branchHolds is not a function` (and the repository-scope test failed the same way once `branchHolds` was in its list). Green after `branchHolds`: 88 passed.
- Case 7, `driver.test.ts > RunnerDriver — an update step that ended cleanly but did not bring the branch level (ADR-0068 D4) > writes the step as failed, with why, and tells the runner so, when the branch does not hold the commit its new entry names`: red `AssertionError: expected [] to deeply equal [ Array(1) ]` (the forge was never asked). Green after `updateUnfinished` in `actions.ts`: 35 passed. The wake is "The step bringing the work up to date ended: it failed: the merge of main at abc1234 was not finished: main could not be merged in: the check script of PRD-07.R7 is left in conflict."
- Case 8, `… > writes the step as succeeded, and tells the runner so, when the branch holds the commit its new entry names`: green on arrival, from case 7's code. A mutation that turned the forge's answer round (`!(await deps.adapter.branchHolds(...))`) made it fail (`expected { kind: 'step-ended', …(7) } to match object { stage: 'update', ok: true, …(1) }`), and case 7 too; reverted, 36 passed.
- Case 9, `… > asks the forge nothing when a step other than the update ends cleanly`: green on arrival. A mutation dropping `stage === "update" &&` made it fail (`expected [ Array(1) ] to deeply equal []`), and also the existing test "does not ask about a run with a step running …"; reverted, 37 passed.
- Case 10, `… > writes the update as its session ended, and logs why, when the forge fails to say whether the branch holds the commit`: green on arrival. Two mutations each made it fail, and each was reverted. (a) A `catch` with no log: `expected [] to include 'runner scratch-app#12/1 — whether the…'`. (b) A `catch` that returns a reason: `expected { kind: 'step-ended', …(7) } to match object { stage: 'update', ok: true }`. Then 38 passed.
- Case 11, `brief.test.ts > the runner's rule for a branch behind the default branch (ADR-0066 D2) > starts the update when told …` (changed to "When it succeeded, …") and the new `… > says a failed update leaves the branch behind, asks a named person to bring it level, and is not started again until the default branch moves (ADR-0068 D4)`: both red, `expected '- When you are told that the ticket\'…' to contain 'When it succeeded, start nothing more…'` and `… to contain 'When it failed, the branch is still b…'`. Green after the bullet was changed: 56 passed.
- Case 12: the dry replay, below.
- The move of `newestUpdateEntry` was checked by the two existing tests of the update block in `driver.test.ts` ("puts the update block at the top …", "gives the body that the departures alone give …"). They passed unchanged before and after.

Validation commands, as run from `/workspace/timone/projects/timone`:

```
$ npx vitest run src/runner src/adapters
 ✓ src/adapters/github-tickets.test.ts (88 tests)
 ✓ src/runner/brief.test.ts (56 tests)
 ✓ src/runner/facts.test.ts (13 tests)
 ✓ src/runner/update-section.test.ts (15 tests)
 ✓ src/runner/actions.test.ts (91 tests)
 ✓ src/runner/driver.test.ts (38 tests)
 … (12 more files, all passed)
 Test Files  18 passed (18)
      Tests  486 passed (486)
```
**Result: pass.**

```
$ npx tsc --noEmit; echo "exit: $?"
exit: 0
```
**Result: pass.**

```
$ npm run --silent replay -- --dry; echo "exit: $?"
PASS #139 — Read planning as finished, and start the build. 3 of 3 tries.
…
PASS #202 — Start the update, and ask nobody for anything. 3 of 3 tries.
PASS #218 — Ask on the ticket whether to do the work again or to stop, and name the takeover command for the ticket once. 3 of 3 tries.
PASS #218 — Record the approval and ask nothing, or ask what the word meant. Do not name the takeover command. 3 of 3 tries.
24 of 24 cases passed. The runner's sessions cost $0.00 in all.
exit: 0
```
**Result: pass.** The replay runs from `src` through `tsx`.

- [x] Red→green evidence for every case is above. Cases 5, 8, 9 and 10 were green on arrival; for each, the mutation that made it fail is recorded.
- [x] The dry replay passes every case: 24 of 24.
- [ ] **Human gate**, the real replay on the model: left to the orchestrator. It was not run here.

At slice end: the 18 test files under `src/runner` and `src/adapters` were run, as above: 486 passed, none failed. The whole suite was not run, as the preamble asks.

**What 61e must know.**

- The runner's rule now tells it, after a failed update, to say on the ticket what stopped it and to ask a named person to bring the branch level, and not to start the update again until it is told that the default branch moved again. The update's instructions should match this: an update that stops a merge it could not finish fails the step when the record entry it writes names a commit the branch does not hold.
- The check reads the entry's `Level with:` line as `<default> at <sha>`, with the sha as 7 to 40 lower-case hex characters at the end of the line, and the time in the heading, `## Update <k> — <ISO time>`. An entry written before the step's start is ignored. The instructions must keep both in that form; otherwise the step is not made a failure.
- `dist/` was not rebuilt in this slice. No command changed.
- Refactor idea, not done: `updateUnfinished` in `actions.ts` and `updateOf` in `driver.ts` each ask `readBranches` twice, once inside `newestUpdateEntry` and once for the default branch's name. `newestUpdateEntry` could take the default branch's name, but the plan gives its signature without it.
