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
