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
