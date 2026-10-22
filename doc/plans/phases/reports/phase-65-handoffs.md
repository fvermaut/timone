# Phase 65 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 65a — A commit GitHub built is excused whatever its parent count, and the check no longer blames a session for a squash merge it only pulled

**Built.** The provenance check now excuses any commit whose committer is exactly `noreply@github.com`, whatever its parent count. A squash merge built by GitHub, with one parent, is no longer reported. A session that pulls such a commit with `git pull --ff-only` is no longer blamed for it. A commit by a `…@users.noreply.github.com` address is still reported. An untrailed commit a person pushed to `main` from their own machine, and that a session then pulled, is still reported; a test now pins this limit.

**Files touched.**

- `src/daemon/hooks.ts` — `isPlatformMerge` now returns `commit.committerEmail === "noreply@github.com"`. Its docblock is rewritten in the order the plan gives, with the dated line for timone#90. The doc comments of `CommitEvidence.committerEmail` and `parentCount` are changed as the plan says. The order of the two docblocks above `checkProvenance` is unchanged.
- `src/daemon/hooks.test.ts` — four new cases at the end of `describe("checkProvenance")` (cases 1 to 4).
- `src/commands/guardrails.test.ts` — a local helper `gitAs(dir, committer, ...args)` at the top of `describe("the provenance trailer, read back off real commits")`, and two new cases in that block (cases 5 and 6).
- `doc/plans/phases/reports/phase-65-handoffs.md` — this file.

**Decisions taken inside the slice.**

- The `workspace()` fixture's clone is on git's default branch name (here `master`, because this box sets no `init.defaultBranch`), and that branch has no upstream. So `git pull -q --ff-only` failed with "no such ref was fetched". Cases 5 and 6 therefore run `git checkout -q -B main origin/main` in the project before the baseline is taken. This gives a local `main` that tracks `origin/main`, which is how a real checkout looks, and it is the branch the pull moves. It works whatever the default branch name is. The fixture itself is not changed.
- The "GitHub" clone and the person's clone are made with `git clone -q -b main` in the test's temp directory (`join(root, "..")`). I used `join(root, "..")` and not `dirname`, so the import line stays unchanged and the diff holds only added lines.
- Only the committer is set to GitHub or Someone, through `gitAs`. The author comes from the clone's `user.*` config. On a real squash merge the author is the pull request's author and the committer is GitHub, so this is the same shape.
- Cases 5 and 6 repeat their setup instead of sharing a helper. The testing standard prefers visible repetition in tests.

**Validation evidence.**

Red-green, case by case. All runs used `env $(env | grep -oE '^GIT_[A-Z0-9_]+' | sed 's/^/-u /') npx vitest run <file>`.

1. `checkProvenance > ignores a squash merge GitHub built, which has one parent`. Written first and run before the code change: **red**.
   ```
   × checkProvenance > ignores a squash merge GitHub built, which has one parent
     → expected [ { rule: 'provenance', …(2) } ] to deeply equal []
   + "- scratch-app ddd4444 on `main`",
   + "summary": "1 commit(s) made in this session say nothing about where they came from",
   ```
   Green after the change.
2. `checkProvenance > ignores a commit GitHub built when its evidence has no parent count`. Run before the code change: **red**.
   ```
   × checkProvenance > ignores a commit GitHub built when its evidence has no parent count
     → expected [ { rule: 'provenance', …(2) } ] to deeply equal []
   ```
   Green after the change.
3. `the provenance trailer, read back off real commits > says nothing about a squash merge GitHub built, with one parent, that the session only pulled`. Run before the code change: **red** on the intended assertion. The one-parent assertion above it passed, so the case does not test a merge.
   ```
   × ... says nothing about a squash merge GitHub built, with one parent, that the session only pulled
     → expected [ { rule: 'provenance', …(2) } ] to deeply equal []
   + "- scratch-app 70a1a5d on `main`",
   ❯ src/commands/guardrails.test.ts:978:67
     expect(first.returned.filter((v) => v.rule === "provenance")).toEq…
   ```
   (Its first run failed earlier, inside the work step, on `git pull` with no upstream. That was the fixture, not the rule. See the first decision above.)

   Then the one-line change to `isPlatformMerge`, its docblock and the two doc comments. Both files: 203 of 203 passed. Cases 1, 2 and 5 green.

4. Case 3, `checkProvenance > still flags a commit by a users.noreply.github.com address, which is a person's or a bot's`. Green when written. Mutation probe: I changed the match to `commit.committerEmail?.endsWith("noreply.github.com") ?? false` for one run, and it failed:
   ```
   × checkProvenance > still flags a commit by a users.noreply.github.com address, which is a person's or a bot's
     → expected [] to have a length of 1 but got +0
   ```
   I then put the exact match back (`return commit.committerEmail === "noreply@github.com";`, checked with `grep`).
5. Case 4, `checkProvenance > counts only the session's own commit when it sits beside a one-parent commit GitHub built`. Green when written. It was written after the code change. Against the old `hooks.ts` (set aside with `git stash` for one run) it fails, because the old code counts the GitHub commit too:
   ```
   → expected '2 commit(s) made in this session say …' to contain '1 commit(s)'
   ```
6. Case 6, `the provenance trailer, read back off real commits > still flags an untrailed commit a person pushed to main, when the session only pulled it`. Green when written, and green against the old `hooks.ts` in the same stashed run. That run had 4 failures out of 206: cases 1, 2, 4 and 5. Cases 3 and 6 passed.

Validation commands:

```
$ env $(env | grep -oE '^GIT_[A-Z0-9_]+' | sed 's/^/-u /') \
    npx vitest run src/daemon/hooks.test.ts src/commands/guardrails.test.ts; echo "exit: $?"
 Test Files  2 passed (2)
      Tests  206 passed (206)
exit: 0

$ npx tsc --noEmit; echo "exit: $?"
exit: 0

$ npx vitest list src/daemon/hooks.test.ts src/commands/guardrails.test.ts 2>/dev/null \
    | grep -ciE 'squash|one parent|github'
7
```

The count is 7. It was 2 before this slice, and the five new cases whose titles name GitHub, a squash or one parent add 5. Case 6's title names none of them.

```
$ git diff origin/main -- src/daemon/hooks.test.ts src/commands/guardrails.test.ts | grep -E '^-' | grep -vE '^---' | wc -l
0

$ git diff origin/main --stat
 doc/plans/phases/phase-65.md    | 109 +++
 src/commands/guardrails.test.ts | 107 +++
 src/daemon/hooks.test.ts        |  91 +++
 src/daemon/hooks.ts             |  46 ++--
```

The handoff file is new and not yet tracked, so it is not in this `--stat`. It shows up once the slice is committed.

Checkboxes:

- [x] Cases 1, 2 and 5 were seen red before the change and green after. The failing assertions are quoted above.
- [x] Cases 3, 4 and 6 are green. Case 3 failed under the `endsWith("noreply.github.com")` probe, and the exact match is back.
- [x] Every existing test in the two files is unedited and passes. The diff of the two test files has no removed lines.
- [x] `git diff origin/main --stat` lists `src/daemon/hooks.ts`, the two test files, and under `doc/` only the planning phase file and this handoff.
- [x] The `isPlatformMerge` docblock names the squash merge, says the committer alone decides, says a `users.noreply.github.com` address is still reported, and has the dated timone#90 line.

Tests run at the end of the slice: `src/daemon/hooks.test.ts` and `src/commands/guardrails.test.ts`, 206 of 206 passed. `npx tsc --noEmit` is clean.

**What delivery must know.**

- Case 4 was not seen red before the change in the order of work, because the plan put it after the change. It does fail against the old code (quoted above).
- Each run of the guardrails file prints "warning: You appear to have cloned an empty repository." That comes from the existing `workspace()` fixture, not from this slice.
- What I would refactor: cases 5 and 6 differ only in the committer and the expected outcome. A helper such as `pullOneCommitBy(committer)` could hold the shared steps. Also, the `checkout -B main origin/main` step could move into `workspace()`, but that would change a fixture every other test uses.
