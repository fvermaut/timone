---
name: timone-update
description: A step of an open pull request on a managed project, not a stage of its own — bring the pull request's branch level with the project's default branch after another pull request merged, or when the pull request opened behind it. It merges the default branch into the branch, runs the whole test suite and the check scripts of both tickets, hands a failure to a fresh fix context at most twice, and writes one record entry. The runner starts it when it is told the branch is behind; use it when a session's prompt points here, or when the user says "bring this pull request up to date" or "the branch is behind main".
argument-hint: <project-name> <ticket>
---

# Timone — Bringing an open pull request level with the default branch

Another pull request of the project merged, or this pull request opened behind the default branch. Your job is to bring this pull request's branch level with the default branch, find out whether the work still passes, and write down what you found. You merge, you run the tests and the check scripts, and you hand every fix to a fresh context. You never change code with your own hands, and you ask nobody anything. [ADR-0066](../../../doc/adr/0066-the-update-is-a-step-the-runner-starts-when-an-open-pull-request-falls-behind.md) is the decision behind this step; [ADR-0064](../../../doc/adr/0064-status-md-and-the-registers-are-merged-by-timones-own-rule-in-the-box.md) D3 is why it merges and never rebases.

**The record entry you write is read by a person**, because code copies it to the top of the pull request. Write it as [Writing to the human](../../../process.md#writing-to-the-human) says: short sentences, plain words, no process words, no metaphors.

## Target-project resolution (do this first)

1. The target project is the one named in the invocation argument or prompt.
2. If no project is named: read `timone.yaml`, list the project names, and **ask** the user to pick. Never guess.
3. Validate the name against `timone.yaml`. Unknown name → abort, listing the valid names.
4. Check `projects/<name>/` exists on disk. Not cloned → abort, suggesting `node dist/cli.js workspace sync`.
5. From here on, every file you read or write lives under `projects/<name>/…` — the only exceptions are *reading* timone's own `process.md`, `standards/`, and `timone.yaml`.
6. In a session the runner started, the target project arrives in the session's prompt; the same validation applies. ✏ 2026-09-30 ([ADR-0060](../../../doc/adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md))

## Input

A project name and the ticket whose pull request is behind. In a session the runner started, both come in the prompt, with the pull request's branch. You work on that branch and on no other.

Run every git command on the project with `git -C projects/<name> …`. Run Timone's own commands (`node dist/cli.js …`) at the Timone root.

**Before you start, check the branch.** The project's checkout must be on the pull request's branch, and its working tree must be clean. If it is on another branch, or it has changes nobody committed, change nothing: end with the ending for a branch that is not what the run says, and name what you found.

## What you read, and what you never read

**Read:**

- **The branch's own phase file** — the plan this ticket's work was built from. `update-checks` names it.
- **The phase files that arrived on the default branch** — `update-checks` names them. A fix context needs both plans, so you pass their paths on.
- **The record file**, `doc/plans/phases/reports/phase-NN-update.md`, if it exists. NN is the number of the branch's own phase file.
- **The project's standards**: `doc/standards.md` in the project when it has one, and Timone's own `standards/`.
- **How to run the app and the tests**: the project's `README.md`, its package manifest's scripts, and the run instructions in the completion report (`doc/plans/phases/reports/phase-NN-complete.md`), exactly as `timone-verify` reads them for the same purpose.

**Never read:**

- **Code diffs**: no `git diff` of contents, no `git show` of code, no `git log -p`. A list of changed file names is not a diff: `git show --name-only --format= <sha>` prints names only, and you may read that.
- **The contents of the probe folder the check uses (see `timone-verify`).** You *run* the check scripts it holds. You never open, print or list them. `update-checks` gives you each script's path, and you pass that path to the program that runs it.
- **What a fix context did, beyond what it returns**: never its transcript, never its diff.

**In a session run by hand, declare this step before you run the first check script.** A hook in front of every tool call keeps the check scripts away from builders, and a session run by hand has no step in the ledger. Run `node dist/cli.js stage update --session <your session id>` first, and `node dist/cli.js stage none --session <your session id>` at the end. The session start hook told you the id. A session the runner started does neither: the ledger knows its step or, in a container, the container does. In a container `node dist/cli.js stage` changes nothing ✏ 2026-10-08 ([PRD-10](../../../doc/specs/prd/prd-10-the-probe-guard-knows-the-step-in-a-container.md), phase 57).

## The procedure

Follow these steps in order.

### 1 — Read

Read what the list above allows, and nothing else.

### 2 — Fetch, note where the branch is, and ask which tests to run

1. `git -C projects/<name> fetch origin`.
2. Find the default branch's name: `git -C projects/<name> symbolic-ref --short refs/remotes/origin/HEAD` prints `origin/<default>`.
3. Note the branch's commit as `<before>`: `git -C projects/<name> rev-parse HEAD`.
4. If `origin/<default>` is already part of the branch (`git -C projects/<name> merge-base --is-ancestor origin/<default> HEAD` exits 0), there is nothing to bring level. Commit nothing and write no entry. End with the ending for a branch that is not what the run says, and say that the branch already holds `<default>` at its current commit.
5. At the Timone root, run `node dist/cli.js update-checks <name> --before <before>`, and keep its whole output. It names:
   - the project's test command, or says the project has none;
   - the branch's own phase file, and for each requirement that plan claims, its check script or "no check script";
   - each phase file that arrived on the default branch since `<before>`, with its pull request number when one was found, and the same list for each.

   Run it before the merge. If you run it after the merge, keep `--before <before>`: without it, the command finds that no plan arrived. If the command exits 2, it prints one sentence saying why. End with the ending for a branch that is not what the run says, and quote that sentence.

The output prints each check script's path. Never copy that path into the record entry, a commit message or anything a person reads.

### 3 — Merge the default branch into the branch

Run `git -C projects/<name> merge --no-edit origin/<default>`.

When it finishes with no conflict, add the trailers to the merge commit it made, which has not been pushed yet: `git -C projects/<name> commit --amend --no-edit --trailer "Timone-Stage: update" --trailer "Timone-Run: <name>#<ticket>" --trailer "Timone-Session: <your session id>"`.

- **Merge only.** Never rebase. Never force-push. Never use GitHub's "Update branch" (`gh pr update-branch`), and never merge the pull request.
- **`STATUS.md` and the requirement registers are merged by Timone's own rule**, which the box switches on (ADR-0064). Do not edit them by hand. A conflict the rule still leaves in one of them goes to the fix context, as any other conflict does.
- **A conflict left in any file goes to a fresh fix context.** List the files with `git -C projects/<name> diff --name-only --diff-filter=U`. Give the fix context the brief below. It resolves the conflict, finishes the merge commit, and returns the commit and two or three plain sentences. Keep those sentences for the record entry. **A conflict fix is not counted as one of the two fixes.**
- If the merge still is not finished when the fix context returns, do not finish it yourself. Run `git -C projects/<name> merge --abort`, so the branch is back at `<before>`. Run none of the test sets. Write the entry with every test set as `none — the merge could not be finished`, and the result `does not pass — <default> could not be merged in: <the files still in conflict>`. Then go to step 6.

### 4 — Run the three test sets

Run each set on the merged branch. Every run is a real run.

1. **The whole test suite, once.** Run the project's test command from the project's root, as `npm test` when the command comes from `package.json`'s `scripts.test`. When the app has to be running for the tests, start it as the completion report says. Keep the summary line the suite prints (how many passed and how many failed) and the names of the tests that failed.
2. **The check scripts of this ticket**: every script `update-checks` listed under the branch's own plan.
3. **The check scripts of the work that arrived**: every script it listed under each plan that arrived.

**Run each check script as the check runs one** (`timone-verify`, *The environment* and *The probes*):

- From the project's root, with the program its file's extension calls for (`node` for `.mjs` and `.js`), and the app started first in its production form when the script talks to a running app. Run the server in the background and wait for its port to answer before running the script; stop it when you are done.
- **Real run only** ([ADR-0061](../../../doc/adr/0061-a-check-script-proves-itself-once-and-a-fix-re-runs-what-it-can-affect.md) D1). Never do a script's break run, and never apply the step that breaks it on purpose.
- A script fails when it exits with a code other than 0, or when it prints that a clause failed. Keep the clause line it printed for each failure.
- **A requirement with no check script is written as such**: "no check script for <ID>". Never write a script for it, and never count it as passed or failed.

### 5 — Hand a failure to a fresh fix context — two fixes at most

When a test or a check script fails, give the failures to **one fresh fix context**, with the brief below. It is given everything that failed in this round at once, so that one round is one fix. It commits `fix: update — <slug>` on the branch, and returns the commit and a few plain sentences on what it changed and why. Keep the sentences for the entry. Never read its diff.

Then run again:

- everything that failed; and
- everything the fix's changed files can affect. Get the file names with `git -C projects/<name> show --name-only --format= <sha>`. A fix that changes any file outside `doc/` sends the whole test suite again. Compare the names with the requirements each check script checks. When you cannot tell whether the fix can affect a script, run it again.

**Two fixes at most, counted over the whole update.** Conflict fixes do not count; fixes for a failing test or script do. After the second fix, if anything still fails, stop fixing. That is a result to write down, not a reason to ask anyone.

### 6 — Append the entry, commit and push

Append one entry at the end of `doc/plans/phases/reports/phase-NN-update.md`, in the form below. When the file does not exist yet, create it with the line `# Phase NN — Updates`, one blank line, and then the entry. Then:

1. Commit only that file, as `docs: update NN — level with <default>`.
2. Push the branch: `git -C projects/<name> push origin <branch>`. That push carries the merge commit, every fix commit and the entry. Never force it. If the push is refused, end with the ending for a branch that is not what the run says, and quote what git said.

**Never write `STATUS.md`, never change a requirement's status in a register, and never edit the pull request's description.** Code reads the newest entry after the step and writes the section at the top of the pull request from it (ADR-0066 D5).

### 7 — Ask nobody anything

Nothing in this step waits for a person. A result that does not pass is written in the entry, and the person decides on the pull request. Do not post a comment that asks for anything.

## The record entry

**The form.** Copy it exactly. Every line, every label, the bold, the colon inside the bold, and the ` — ` (a space, an em dash, a space) between a word and its text:

```markdown
## Update <k> — <ISO time>

- **Level with:** <default> at <sha>
- **Arrived:** <phase MM (pull request #n)>, …
- **Whole test suite:** passed | failed — <one line>
- **Check scripts of this ticket:** passed — <IDs> | failed — <ID>: <one line> | none — <why>
- **Check scripts of the work that arrived:** the same three forms
- **Fixes:** 0 | 1 | 2
- **Code changed:** none | <plain sentences: what and why>
- **Result:** passes | does not pass — <the failure>
```

**How to fill each line:**

- **The heading.** `<k>` is the number of `## Update` headings already in the file, plus one. `<ISO time>` is now, in UTC: `date -u +%Y-%m-%dT%H:%M:%SZ`.
- **`Level with:`** the default branch's name, `at`, and the first 7 characters of the `origin/<default>` commit you merged, or tried to merge.
- **`Arrived:`** each plan that arrived, in the order `update-checks` printed them: `phase 51 (pull request #218)`, separated by `, `. Leave out the brackets when no pull request number was found. When no plan arrived, say what did in plain words, for example `3 commits with no plan`.
- **`Whole test suite:`** `passed` or `failed`, then ` — ` and one line: the count the suite printed, and for a failure the first test that failed. **When the project has no test command**, write `none — the project has no test command`. This is the only true line for that case. Code reads it as a suite that did not run, so the work does not pass, and the result says so (below).
- **`Check scripts of this ticket:`** and **`Check scripts of the work that arrived:`** one of three forms:
  - `passed — <IDs>`: every script passed. List the IDs, separated by `, `. Add any requirement with no script after a `; `, for example `passed — PRD-07.R7; no check script for PRD-07.R14`.
  - `failed — <ID>: <one line>`: at least one script still fails after the fixes. Give the clause line it printed. When more than one fails, separate them with `; `.
  - `none — <why>`: there was no script to run, for example `none — phase 51 claims no requirement`, `none — no requirement of this ticket has a check script`, or `none — no plan arrived`.
- **`Fixes:`** the number of fixes for a failing test or script: `0`, `1` or `2`. Conflict fixes are not counted.
- **`Code changed:`** `none`, exactly, when no fix context changed anything. Otherwise, plain sentences on what each fix context changed and why, conflict fixes included, taken from what they returned. No file paths of check scripts, no process words.
- **`Result:`** `passes` only when no set says `failed`, the whole test suite says `passed`, and the merge is finished. Otherwise `does not pass — <the failure>`, naming in plain words what fails or did not run, for example `does not pass — the test "keeps both lines" still fails after two fixes`, or `does not pass — the project has no test command, so the whole test suite could not run`.

**Every value is one line.** Code reads one line per field and drops the rest. Labels that differ by one letter, a hyphen in place of the em dash, or a line left out all make the section say the set did not run.

An entry, filled in:

```markdown
## Update 2 — 2026-10-06T09:30:00Z

- **Level with:** main at 9b1e0d2
- **Arrived:** phase 51 (pull request #218)
- **Whole test suite:** passed — 1270 tests passed
- **Check scripts of this ticket:** passed — PRD-07.R7, PRD-07.R14
- **Check scripts of the work that arrived:** none — phase 51 claims no requirement
- **Fixes:** 0
- **Code changed:** none
- **Result:** passes
```

## The fix context's brief

The fix context is a sub-agent you start from this session, with a brief and nothing of your own reasoning. It is not you: you never edit code. Give it this brief, filled in:

```markdown
## Fix brief — update of <project> #<ticket>, <conflict | fix 1 | fix 2>

- **What to fix:** <the files git left in conflict | the failing test's name, or the requirement ID and the clause line the check script printed>
- **What was seen:** <the failure output: the test runner's lines for the failure, or the clause line — never the check script's path or contents>
- **This ticket's plan:** <path of the branch's own phase file>
- **The plans that arrived:** <paths of the phase files that arrived on the default branch>
- **Standards:** `doc/standards.md` in the project, if it exists, and Timone's `standards/`
- **Never open the folder the check keeps its scripts in.** Do not read, list or run anything in it. Fix the code from the plans, the standards and the failure above.
- **Never** rebase, force-push, push, or use GitHub's "Update branch". Change nothing the brief does not need.
- **Commit:** <for a conflict: resolve the files, `git add` them, and finish the merge commit with `git commit --no-edit` plus the trailers | for a failure: one commit, `fix: update — <slug>`, with the trailers>. The trailers are: <the three trailer lines this session's prompt names, filled in>.
- **Return:** the commit's SHA, and two or three plain sentences on what you changed and why.
```

## Commit provenance

Every commit you cause to be made carries the trailer this session's prompt names ([ADR-0019](../../../doc/adr/0019-timone-authored-commits-carry-a-provenance-trailer.md)), below any `Co-Authored-By:` line. The merge commit, each fix commit and the entry's commit all carry it. In a session run by hand:

```
Timone-Stage: update
Timone-Run: <project>#<ticket>     # only when a ticket drove this session
Timone-Session: <the id you were given at the start of this session>
```

## Closing

End with one of the two endings the session's prompt gives:

- **Done**: the entry is committed and pushed, whatever its result. Follow it with the result in one sentence.
- **The branch or the pull request is not what the run says**: the checkout was on another branch or not clean, the branch already held the default branch, `update-checks` failed, or the push was refused. Follow it with what you found.

Nothing else follows. The runner starts no other step after this one, and nobody is asked anything.
