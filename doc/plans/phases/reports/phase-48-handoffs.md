# Phase 48 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 48a — The merge rule for `STATUS.md` and for a register

**Built.** `mergeFile(kind, sides, options)` takes the base, current and other versions of one file and returns `{ text, clean, problems }`. It runs `git merge-file -p --diff3 --marker-size=40` on three files in a temporary folder, which it removes. It touches no repository. When git merges cleanly, it returns git's text. When git reports conflicts, it decides each conflict block:

- Each side's changes are found against the block's base with a line-level longest common subsequence.
- Changes that do not overlap are both applied. A change both sides made the same way is applied once.
- Where changes overlap, the other side's version comes first, then the current side's version.
- In `STATUS.md`, a blank line goes between the two versions when neither has one at that edge. When more than one `**Last updated:**` line is left, only the one with the later date stays. If a date cannot be read, the other side's line stays.
- In a register, when the same `- **<Field>:**` name comes from both sides in one block and one section, the other side's line stays and the current side's line is removed. A dated note under the section heading, below the notes already there, quotes both lines.
- In a register, two `## R<k>` headings with the same number make `clean` false, with one problem sentence per number.

The module also exports `MergeKind`, `MERGE_KINDS`, `isMergeKind`, `MergeSides` and `MergeResult`. A git exit code below 0 or above 127 (git's error exit is 255) throws with git's own words.

**Files touched.**

- `src/merge-rules.ts` — created.
- `src/merge-rules.test.ts` — created. 23 tests, all through `mergeFile`.
- `doc/plans/phases/reports/phase-48-handoffs.md` — created.

**Decisions taken inside the slice.**

- **PLAN PROBLEM — case 3 and case 11 contradict each other.** Case 11 says every line a side added is in the text, for cases 2 to 9. Case 3 says the text has the `**Last updated:**` line once, with the later date. So the older date line, which one side added, cannot be in the text. I did the closest faithful thing: the case 11 check for case 3 names the older date line as removed on purpose and does not count it. All other lines are checked. The plan should say that case 11 makes an exception for case 3, as it already does for case 8.
- **Case 5 needed more than the plan's rule.** git splits an item that both sides rewrote into one conflict block per paragraph. Each paragraph then got "other, then current" on its own, so the two versions were mixed line by line. The fix is limited to `STATUS.md`: (a) conflict blocks with only blank lines between them are read as one block; (b) inside a block, two ranges both sides changed with only blank base lines between them become one range. Each side's version of the item then stays whole.
- **The field rule only counts lines in the same section.** The plan says "within one resolved block". In case 10 both new `## R15` sections are in one block, and their `Status` and `Priority` lines were treated as a clash. A line from the other side clashes with a line from the current side only when no `## ` heading falls between them.
- **No note when both sides hold the same field line.** When the two field lines are identical, the current side's copy is removed and no note is written. A note would say "it had X. X stands."
- **The `## R<k>` check runs only when git reported a conflict.** The plan says "exit 0 means clean: return its output", and case 1 says clean is then true. So two `R15` headings that git merges without a conflict are not reported. In practice both sides add new sections at the end of the file, and git reports that as a conflict, which case 10 shows.
- **The final newline follows git's output.** The merged text ends with a newline when git's output does.
- **What I would refactor, later.** `mergeFile` holds the kind-specific steps in two `if (kind === …)` branches. Two rule objects, one per kind, would read better. The order of the rules also matters in one place. In `STATUS.md`, if a paragraph next to the `**Last updated:**` line is rewritten on both sides, the two become one range, and removing the older date line can leave an extra blank line or move the date below the other side's paragraph. No case covers it. The real `STATUS.md` has a `---` line after the date, which keeps the date apart from the items.

**Validation evidence.**

Red-green trace. Each test was written, run, and seen to fail before the code that passes it:

- Case 1 (both kinds): red, `Failed to load url ./merge-rules.js … Does the file exist?`. Then green with the first `mergeFile`: it runs `git merge-file` and returns git's output, with `clean` true when the exit code is 0.
- Case 2, against that git-only `mergeFile`: red, `"clean": false` and the text holds `<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< current … ======================================== … >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> other` around the two new items.
- Case 3 (later date on the current side), git-only: red, `"clean": false`, text holds `<<<…< current` / `**Last updated:** 2026-10-04.` / `|||…| base` / `**Last updated:** 2026-10-01.` / `===…=` / `**Last updated:** 2026-10-03.` / `>>>…> other`.
- Case 3 (later date on the other side), git-only: red, the same shape with `2026-10-02.` on the current side and `2026-10-05.` on the other side.
- Case 4, git-only: red, `"clean": false`, the text holds `**What I need from you:** nothing.` twice inside the markers (base and other) next to the changed line.
- Case 8 (Status), git-only: red, `"clean": false`, no note under the heading, and the text holds `- **Status:** verified`, `- **Status:** draft` and `- **Status:** blocked` inside the markers.
- Case 8 (Last live gate), git-only: red, the same shape with the two `- **Last live gate:**` values, and no note under `## R2 — Second`.
- Cases 2, 3, 4 and 8: green, all six tests at once, after the resolution was written.
- Case 5: red, the two versions were mixed line by line (`rebuilt there`, `rebuilt here`, `a merge`, `a review`). Still red after the in-block range rule, because git puts each paragraph in its own block. Green after blocks split only by blank lines were read as one.
- Case 6: green at first run. The overlap rule from cases 2 to 5 already keeps both notes. The test also checks R1 holds exactly one `- **Status:**` line.
- Case 7: green at first run, for the same reason.
- Case 9: green at first run. git does report a conflict here (checked by hand: the note and the changed line are in one block). The note is an insertion before the changed range, so the two do not overlap.
- Case 10: red, `"clean": true`, `"problems": []`, and two notes were wrongly written under the first `## R15` while the current side's `Priority` and `Status` lines were removed. Green after the field rule was limited to one section and the `## R<k>` check was added.
- Case 11: 10 rows (cases 2, 3 twice, 4, 5, 6, 7, 8 twice, 9). Green at first run, since the code was already written. To show the check is not empty, I broke the code twice by hand and put it back: (a) dropping the current side's version made rows 2, 3 (current later), 5, 6 and 7 fail; (b) leaving the current value out of the case 8 note made both case 8 rows fail.

Validation commands, run at the end of the slice:

```
$ npx vitest run src/merge-rules.test.ts
 Test Files  1 passed (1)
      Tests  23 passed (23)

$ npm run type-check
> tsc --noEmit
(no output, exit 0)

$ git diff --name-only main... -- src | grep -v '^src/merge-rules' ; echo "exit: $?"
exit: 1

$ git status --short src
?? src/merge-rules.test.ts
?? src/merge-rules.ts
```

The new files are not committed yet, so `git diff` does not list them. `git status` shows that the only changes under `src/` are the two new files.

Result per assertion:

1. Cases 2, 3, 4 and 8 shown red first against a `mergeFile` that returns git's output with its conflict markers: **met** (trace above).
2. Case 11 passes for every case it names: **met**, with the case 3 exception described under "PLAN PROBLEM".
3. The full suite passes: **not run in this slice**, as the runner said. It runs once at the close of the phase. In the slice only `npx vitest run src/merge-rules.test.ts` and `npm run type-check` were run.

**What 48b must know.**

- Import from `./merge-rules.js`: `mergeFile`, `isMergeKind`, `MERGE_KINDS`, `type MergeKind`.
- `mergeFile` throws when git itself fails. A conflict it could not decide is not a throw: `clean` is false and `problems` has the sentences. `text` is always filled, also when `clean` is false.
- `options.today` is only used for the register note. Without it, the date is today in UTC.

## 48b — The command git calls, how to switch it on, and the proof with real git

**Built.**

- `timone merge-file <kind> <base> <current> <other> [path]`. It reads the three files, calls `mergeFile`, and writes the result into `<current>`. Each problem goes to stderr, with `<path>: ` in front when a path is given. It exits 0 when the result is clean and 1 when it is not. An unknown kind exits 2 with one sentence and writes nothing. The kind is checked before any file is read.
- `MERGE_RULE_PATHS`, `mergeRulesConfig` and `installMergeRules` in `src/merge-rules.ts`. `installMergeRules(dir, { cli })` creates `dir`, writes `<dir>/attributes`, and returns the environment that makes git use the file and the two drivers. Nothing is written into the project.
- `timone guardrails install-merge-rules --dir <path>`, built the same way as `install-push-guard`. It prints nothing when it works. When it fails, it prints one line starting `guardrails install-merge-rules:` and exits 1.
- `src/cli.ts` registers `merge-file`.

**Files touched.**

- `src/commands/merge-file.ts` — created.
- `src/commands/merge-file.test.ts` — created. 3 tests: case 7 (two tests) and the first part of case 8.
- `src/merge-rules.ts` — `MERGE_RULE_PATHS`, `mergeRulesConfig` and `installMergeRules` added at the end. One private helper, `driverName`.
- `src/merge-rules.git.test.ts` — created. 6 tests: cases 1 and 2 (one `it.each`), then cases 3, 4, 5 and 6.
- `src/commands/guardrails.ts` — `install-merge-rules` added after `install-push-guard`.
- `src/commands/guardrails.test.ts` — one `describe` added at the end, with 2 tests for the second part of case 8.
- `src/cli.ts` — one import and one `registerMergeFileCommand(program)` call.
- `doc/plans/phases/reports/phase-48-handoffs.md` — this section.

**Decisions taken inside the slice.**

- **The second part of case 8 is in `guardrails.test.ts`, not in `merge-file.test.ts`.** The plan puts cases 7 and 8 in `merge-file.test.ts`. But the second part tests the `guardrails` command, so it is tested through `registerGuardrailsCommand` in the guardrails test file. The runner's brief allowed this file.
- **The command was written whole for case 1.** It got the problem lines, the exit 1 and the exit 2 at that point. So cases 5, 7 and the first part of case 8 passed on their first run. To show that those tests can fail, I broke the command by hand and then put it back. The trace below lists each change and what failed.
- **The git tests drop every `GIT_*` variable from this process's environment.** Then they add `HOME` and `XDG_CONFIG_HOME` inside the temporary folder, and `GIT_CONFIG_NOSYSTEM=1`. So the `GIT_AUTHOR_*`, `GIT_COMMITTER_*`, `GIT_EDITOR` and any `GIT_CONFIG_COUNT` set in the environment cannot reach a case. Case 3 runs git with exactly that environment. `user.name` and `user.email` are set in the seed repository and in the clone.
- **How the tests are set up.** A seed repository stands for the people who push. It pushes `main`, `a` and `b` to a bare repository, which stands for the forge, and then lands `a` on `main` with `git merge --squash` and a commit, or with `git merge --no-ff`. A fresh clone with `b` checked out runs `git merge --no-edit origin/main`.
- **Case 6 reads the note's date with a pattern.** The command takes no date, so the note carries today's date in UTC. The test checks that the note names `blocked` (the work branch's value) and says `verified` stands.
- **A failure inside the command is not caught.** If a file cannot be read, or `git merge-file` itself fails, `mergeFile` throws. Node then prints the error and exits 1, and git treats that as a conflict in the file. No case covers this, so I added no code for it.
- **What I would refactor, later.** The driver line does not quote the CLI path: `node <cli> merge-file …`, as the plan writes it. A path with a space in it would break the driver. The path in the box is `/workspace/timone/dist/cli.js`, which has no space. git quotes `%O`, `%A`, `%B` and `%P` itself. The capture helper (`console.log`/`console.error` swapped, `exitOverride`) is now copied in `number.test.ts`, `merge-file.test.ts` and `guardrails.test.ts`. One shared test helper would be better.

**Validation evidence.**

Red-green trace:

- Case 1, step 1 (red, neither `installMergeRules` nor the command existed). The test ran the merge with an empty environment, written in place of the `installMergeRules` call:
  ```
  Auto-merging STATUS.md
  CONFLICT (content): Merge conflict in STATUS.md
  Auto-merging doc/specs/prd/prd-01-x.criteria.md
  CONFLICT (content): Merge conflict in doc/specs/prd/prd-01-x.criteria.md
  Automatic merge failed; fix conflicts and then commit the result.
  - "status": 0,  - "unmerged": "",
  + "status": 1,  + "unmerged": "STATUS.md\ndoc/specs/prd/prd-01-x.criteria.md\n",
  ```
- Case 1, step 2 (red). The test called `installMergeRules`: `TypeError: (0 , installMergeRules) is not a function`.
- Case 1, step 3 (red). `installMergeRules` was added, but the command was not there yet. git called the driver and stopped on both files again: the same two `CONFLICT (content)` lines, `"status": 1`, both files unmerged, and `error: unknown command 'merge-file'` twice.
- Case 1, step 4 (green). After `merge-file.ts`, the line in `cli.ts` and `npm run build`: `✓ … when a landed as a squash commit`.
- Case 2: green on the first run (`it.each` now holds `squash` and `merge`). This case uses the same driver. Only the history is different.
- Case 3: the first run was red because my hand-written expected value was wrong. I had written the register before `STATUS.md`, but git lists `STATUS.md` first. After I fixed the expected value, it was green. This case adds no code. It is the check that cases 1 and 2 test something.
- Case 4: green on the first run. To show it can fail, I ran a throwaway copy of the test. That copy switched the rules on in the clone's `.git/config` and `.git/info/attributes`, instead of through the environment. The merge still exited 0, but the test failed with `expected false to be true`, the `.git/config` check. The copy was deleted.
- Case 5: green on the first run. Changes made by hand and then put back: (a) without `exitCode = 1` → `expected +0 to be 1`; (b) without the path in front of the problem → `expected 'Auto-merging doc/specs/prd/prd-01-x.c…' to contain 'doc/specs/prd/prd-01-x.criteria.md: R…'`.
- Case 6: green on the first run. The rule from 48a already does this.
- Case 7 (two tests) and case 8, first part: green on the first run. Changes made by hand and then put back, one at a time: (A) no write into `<current>` → the clean-merge test failed; (B) no `exitCode = 1` → the R15 test failed; (C) exit 1 in place of 2 for an unknown kind → the unknown-kind test failed.
- Case 8, second part (red): `error: unknown command 'install-merge-rules'` in both tests. Green after the command was added to `guardrails.ts`.

Validation commands, run at the end of the slice:

```
$ npm run build
> tsc
(exit 0)

$ npx vitest run src/merge-rules.test.ts src/merge-rules.git.test.ts src/commands/merge-file.test.ts src/commands/guardrails.test.ts src/cli.test.ts
 ✓ src/commands/merge-file.test.ts (3 tests)
 ✓ src/merge-rules.test.ts (23 tests)
 ✓ src/cli.test.ts (6 tests)
 ✓ src/merge-rules.git.test.ts (6 tests)
 ✓ src/commands/guardrails.test.ts (50 tests)
 Test Files  5 passed (5)
      Tests  88 passed (88)

$ npm run type-check
> tsc --noEmit
(exit 0)

$ node dist/cli.js merge-file --help; echo "exit: $?"
Usage: timone merge-file [options] <kind> <base> <current> <other> [path]
…
exit: 0

$ node dist/cli.js merge-file chapter /dev/null /dev/null /dev/null; echo "exit: $?"
"chapter" is not a kind of file this merge knows; the kinds are: status, register.
exit: 2

$ d=$(mktemp -d) && node dist/cli.js guardrails install-merge-rules --dir "$d"; echo "exit: $?"; cat "$d/attributes"
exit: 0
/STATUS.md merge=timone-status
doc/specs/prd/*.criteria.md merge=timone-register

$ git ls-files | grep -c '\.gitattributes$'; echo "exit: $?"
0
exit: 1
```

Result per assertion:

1. Case 1 is shown red first, with `git merge` stopping on both files, before `installMergeRules` and the command existed: **met** (step 1 above). Step 3 shows it again, after `installMergeRules` was added and before the command existed.
2. Case 3 passes: without the environment the same merge exits 1 and lists both files as unmerged: **met**.
3. The full suite passes: **not run in this slice**, as the runner said. It runs once at the close of the phase.

Tests run at the end of the slice, by file: `src/merge-rules.test.ts`, `src/merge-rules.git.test.ts`, `src/commands/merge-file.test.ts`, `src/commands/guardrails.test.ts`, `src/cli.test.ts`.

**What 48c must know.**

- `mergeRulesConfig({ cli, dir })` returns these three pairs, in this order. `dir` goes through `path.join`:
  ```
  core.attributesFile          <dir>/attributes
  merge.timone-status.driver   node <cli> merge-file status %O %A %B %P
  merge.timone-register.driver node <cli> merge-file register %O %A %B %P
  ```
- `installMergeRules` resolves `dir` to an absolute path and numbers its keys from 0: `GIT_CONFIG_COUNT=3`, `GIT_CONFIG_KEY_0=core.attributesFile`, `GIT_CONFIG_KEY_1=merge.timone-status.driver`, `GIT_CONFIG_KEY_2=merge.timone-register.driver`, each with its `GIT_CONFIG_VALUE_n`.
- **The box already exports `GIT_CONFIG_COUNT=1` with `core.hooksPath` at index 0.** The two sets of settings must go into one export: `GIT_CONFIG_COUNT=4`, with the hooks path at index 0 and the three merge settings at 1 to 3, or in another order. Exporting the environment from `installMergeRules` as it is would replace the hooks path at index 0 and switch the push guard off. The driver values hold spaces and `%`, so they must be quoted in the shell line.
- `timone guardrails install-merge-rules --dir <path>` writes only `<path>/attributes`. It prints nothing when it works. It uses the CLI it runs from as the driver (`fileURLToPath(new URL("../cli.js", import.meta.url))`), which in the box is `/workspace/timone/dist/cli.js`. When it fails, it prints one line starting `guardrails install-merge-rules:` and exits 1.
- git needs `node` on its `PATH` to run the driver.
