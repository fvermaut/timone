# Phase 48: STATUS.md and the requirement registers stop conflicting — the merge rule, the command git calls, and the box that switches it on

> **Status:** Complete — see [reports/phase-48-complete.md](reports/phase-48-complete.md).

> **Companion phases:** [phase 43](phase-43.md) — built the push guard and the way the box switches it on through git's environment (`installPushGuard` in `src/daemon/push-guard.ts`, the `export GIT_CONFIG_COUNT=1 …` line of `boxScript` in `src/daemon/container-runtime.ts`); 48c widens that one export line and follows the same pattern. [phase 44](phase-44.md) — piece 1 of the same list, merged; it delivered R8 clause 1 and gave this phase and ADR-0064 their numbers through `number`. [phase 47](phase-47.md) — piece 3, merged; it lets several pull requests of one project be open at once, which is what makes these conflicts happen; it changes none of the files this phase changes except `STATUS.md`. Governing decisions: [ADR-0064](../../adr/0064-status-md-and-the-registers-are-merged-by-timones-own-rule-in-the-box.md) — recorded while planning this phase; it decides the rule, where it is switched on, and that a branch is brought level by a merge; [ADR-0041](../../adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md) — every run is in its own box, so the box is where the rule must be switched on; [ADR-0050](../../adr/0050-timone-becomes-a-managed-project-once-the-run-path-is-fixed.md) D5 — this is Timone's own repository, so `src/` and `process.md` are committed like any other file; [ADR-0051](../../adr/0051-timone-verifies-itself-by-live-gate-and-a-regression-set-is-narrowed-by-what-it-depends-on.md) D4 — decides which checks this phase owes, below.

> **Screens changed:** none — no slice changes anything a person sees.

## Requirements

> **PRD:** [prd-07-several-tickets-of-one-project-at-once.md](../../specs/prd/prd-07-several-tickets-of-one-project-at-once.md) — criteria in [prd-07-several-tickets-of-one-project-at-once.criteria.md](../../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-07.R8 | MUST | Clauses 2 and 3: when one of two open pull requests that both changed `STATUS.md` or the same requirement register merges, bringing the other level needs no person for either file, and nothing either side wrote is lost |

Clause 1 (numbers) was delivered by [phase 44](phase-44.md). With this phase all three clauses are built; verification sets the status.

## Goal Description

Piece 3 ([phase 47](phase-47.md)) lets a project have several open pull requests at once. Almost every one of them changes `STATUS.md`, and most change a requirement register. When one merges and the next is brought level with the default branch, git stops on both files almost every time: two branches each added an item after the same last item, or a note under the same requirement. The list of pieces puts this before the update after a merge ([ticket-197.md](../breakdowns/ticket-197.md), piece 2), because that update (piece 4) would otherwise stop on these files at nearly every merge.

[ADR-0064](../../adr/0064-status-md-and-the-registers-are-merged-by-timones-own-rule-in-the-box.md) records the choice, made at planning because the plan could not be written without it. Timone gets its own merge command for the two kinds of file, which git calls as a merge driver. Where both sides changed the same place, both are kept, the default branch's lines first. `STATUS.md` keeps one `**Last updated:**` line, with the later date. In a register, a one-value field (`- **Status:**` and the like) that both sides changed keeps the default branch's value, and the branch's line becomes a dated note. Two `## R<k>` headings with the same number are refused. The box switches the rule on through git's environment, as it does the push guard, so nothing is written into the project. **Checked at planning with git 2.43:** a driver set only through `GIT_CONFIG_COUNT` and `core.attributesFile`, with no file in the repository, is called by both `git merge` and `git rebase`, and the merge then completes with exit 0.

**The cut.** 48a is the rule itself, at a seam that needs no repository: three texts in, one text out. 48b is the command git calls, the function that says how to switch it on, and the end-to-end test that is R8's falsifier: two branches with real git, one lands on `main`, the other is brought level with no conflict and keeps every line. 48c switches it on in the box. 48d is the documentation. 48a must come first; 48b needs it; 48c needs 48b's function; 48d needs all three.

**Decisions taken at planning, below the ADR bar.** Each was checked against the three-part test.

- **Names.** The command is `merge-file <kind> <base> <current> <other> [path]`, kinds `status` and `register`. The drivers are `timone-status` and `timone-register`. The box's folder for the attributes file is `$HOME/.timone/git-merge`. All are names changed in one place: not hard to reverse.
- **The rule starts from `git merge-file --diff3` with a long conflict marker** (`--marker-size=40`), and parses its conflict blocks. A long marker cannot be mistaken for a line of `STATUS.md` or a register. Writing a three-way merge in TypeScript instead would be more code to get wrong, with no gain.
- **Inside one conflict block, the rule merges again at the line level** before it keeps both sides. Git reports a conflict when two changes only touch neighbouring lines. Keeping both whole sides of such a block would write the unchanged lines twice. So each side's changes are compared with the block's base lines, changes that do not overlap are both applied, and only changes to the same base lines keep both versions. This is what "keep both" has to mean for no line to appear twice by accident.
- **The note written for a field both sides changed** reads: `> ✏ <date> — when this branch was brought level with the default branch, it had \`<the branch's line>\`. The default branch's \`<the kept line>\` stands.` It goes directly under the requirement's heading, below any notes already there. The date is the day of the merge, in UTC.
- **A box that cannot install the rule stops**, with exit 79, as one that cannot install the push guard does. The install only writes one small file after Timone has been built, so a failure means the box is broken.
- **The rule is switched on in the box only**, not in the daemon's own sessions on the host (`agentSdkRuntime` in `src/daemon/session.ts`). Every run is in a box since ADR-0041; ADR-0064 says so.

**What this phase owes before delivery** (ADR-0051 D4). The diff touches `src/daemon/container-runtime.ts`, `src/commands/guardrails.ts`, `src/cli.ts`, new files under `src/`, `process.md` and `STATUS.md`. Among `verified` MUST criteria, the `api` ones whose `Depends-on` this touches are [PRD-06.R5](../../specs/prd/prd-06-a-run-spends-its-time-on-the-work.criteria.md) (`src/daemon/container-runtime.ts`) and [PRD-07.R9](../../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md#r9--a-ticket-with-an-open-pull-request-keeps-its-run-and-is-not-picked-up-again) (`src/daemon/`). The `live` ones are [PRD-02](../../specs/prd/prd-02-inversion-of-control.criteria.md) R1, R2, R4 and R8 (`src/daemon/`, and R2 also `src/commands/guardrails.ts`), so **a live gate is owed before delivery**. Since [ADR-0059](../../adr/0059-a-live-check-only-the-operator-can-run-rides-to-the-pull-request.md) it rides to the pull request. A live gate also gives the one fact no test here can: that the box's own git, in the real image, calls the driver.

**What no check in that set watches.** No criterion watches the box script's git environment as a whole. If 48c gets the export line wrong, git ignores what it cannot read and the push guard could be switched off without any test failing. So 48c's case 4, which runs the generated export line in a real shell and reads `core.hooksPath` back, is a hard gate, not a courtesy.

**What is not done here.** The update after a merge is piece 4: this phase gives it a merge that does not stop on these files, and ADR-0064 D3 binds it to merge rather than rebase. A person who merges on their own machine or in GitHub's web page still sees git's own conflict. Other files many tickets change, such as `CONTEXT.md`, are not covered: R8 names only these two. Two `STATUS.md` items both labelled `1h` stay as two items with one label.

## Context & Prerequisites

- **[phase 43](phase-43.md)** — `src/daemon/push-guard.ts`: `installPushGuard(dir, { workBranch?, cli })` writes hooks and returns `{ GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "core.hooksPath", GIT_CONFIG_VALUE_0: <dir> }`. `src/commands/guardrails.ts` (:527-549): `guardrails install-push-guard --dir <path> [--branch <name>]`, which passes `cli: fileURLToPath(new URL("../cli.js", import.meta.url))` and prints one line starting `guardrails install-push-guard:` on failure. Copy this shape for `install-merge-rules`.
- **`src/daemon/container-runtime.ts`** — `PUSH_GUARD_DIR = "$HOME/.timone/git-hooks"` (:250). `boxScript` (:423-686) ends: Timone's `npm ci` and `npm run build`, the project's install, `guardrails install-push-guard … || { …; exit 79; }`, then the hand-written line `export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0="${PUSH_GUARD_DIR}"` (:657), then `exec claude`. The Timone CLI in the box is `${WORKSPACE}/timone/dist/cli.js`, that is `/workspace/timone/dist/cli.js`.
- **`src/daemon/container-runtime.test.ts`** — `PUSH_GUARD_LINES` (:2083-2092) writes the box's guard lines out by hand, its last entry being the export line; the test "is switched on for every git the session runs" (:2134-2142) looks for that exact line. Both change in 48c, and the change must be named in the handoff.
- **`src/cli.ts`** — `buildProgram` registers one `register…Command(program)` per file under `src/commands/`. No test imports `src/cli.ts` (it parses `process.argv` when loaded); a command's seam is its `register…Command` on a fresh `Command`, as `src/commands/number.test.ts` does.
- **`src/numbers.ts` and `src/numbers.test.ts`** — the house pattern for a module at `src/` root that runs real git against temporary repositories (`mkdtempSync`, a bare repository standing for the forge, `afterEach` removing them). Tests that run the CLI as a box does use the built `dist/cli.js` (`push-guard.test.ts` :139), so `npm run build` comes before them.
- **The two kinds of file.** `STATUS.md` sits at a project's root; its line `**Last updated:** 2026-10-04.` near the top changes on almost every write; items are bold-numbered paragraphs, each followed by a `**What I need from you:** …` paragraph. A register is `doc/specs/prd/*.criteria.md`: sections `## R<k> — <title>`, dated notes `> ✏ <date> — …` directly under the heading, then field lines `- **Priority:**`, `- **Status:**`, `- **Verify-via:**`, `- **Last live gate:**`, `- **Falsified-by:**`, `- **Depends-on:**`, then `- **Criteria:**` with indented clauses, then `- **Verification hint:**`.
- **How GitHub merges here.** Pull requests are squash-merged (`feat: phase 47 — … (#212)`), so the merged branch's commits are not ancestors of `main`. The tests cover both a squash and a merge commit.
- **Git in the box** is the image's git; the push guard already relies on `GIT_CONFIG_COUNT` (git 2.31 or later). This container has git 2.43.
- **Standards.** This project has no `doc/standards.md`, which is a gap onboarding left; the central `standards/typescript.md`, `standards/testing.md` and `standards/code-smells.md` apply: TypeScript strict, vitest, tests at public seams, no test that reaches into a private field.

## Sub-phases

### Sub-phase 48a: The merge rule for `STATUS.md` and for a register

**[NEW FILE]** `src/merge-rules.ts` — `type MergeKind = "status" | "register"`, `MERGE_KINDS`, `isMergeKind`, and `mergeFile(kind, sides, options)`:

```ts
export interface MergeSides { base: string; current: string; other: string }
export interface MergeResult {
  text: string;          // what goes into the current side's file
  clean: boolean;        // true when every part was decided
  problems: string[];    // one plain sentence per part that was not
}
export function mergeFile(
  kind: MergeKind,
  sides: MergeSides,
  options?: { today?: string },   // YYYY-MM-DD, for the note; defaults to today in UTC
): Promise<MergeResult>;
```

**[NEW FILE]** `src/merge-rules.test.ts` — the cases below.

**[MODIFY]** `src/guards/checkouts.test.ts` — list `merge-rules.ts` in `GIT_USERS`, with the reason it runs git. ✏ 2026-10-04 (build, timone#200): added at the close. The whole suite failed in "performs git only where somebody said so, and said what on", which requires every source file that runs git to be listed there with its reason. `mergeFile` runs `git merge-file` on temporary files it makes itself, and the plan granted this file to no slice.

**Seams under test (TDD):** `mergeFile` is the seam: three texts in, one result out. It shells out to `git merge-file` on temporary files, which it removes, and touches no repository. That boundary survives any change to how the conflict blocks are resolved inside. Red-green:

1. Both kinds: when git merges cleanly, the text is git's result, `clean` is true and `problems` is empty.
2. `status`: both sides add a different item after the same last item. Both items are in the text, the other side's first, with one blank line between them. `clean` is true.
3. `status`: both sides change the `**Last updated:**` line. The text has that line once, with the later date. The same holds when the later date is on the current side and when it is on the other side.
4. `status`: one side changes a line and the other side adds a line right after it, so git reports a conflict. The text holds the changed line once and the added line once, and no line of the base appears twice.
5. `status`: both sides rewrite the same item differently. Both versions are in the text, the other side's first.
6. `register`: both sides add a `> ✏` note under the same `## R<k>` heading. Both notes are kept, and that section still holds exactly one `- **Status:**` line.
7. `register`: both sides add a clause at the end of the same `- **Criteria:**` list. Both clauses are kept.
8. `register`: both sides change the same requirement's `- **Status:**` line to different values. The section holds one Status line, with the other side's value. Directly under the heading, below any notes already there, is the note `> ✏ <today> — when this branch was brought level with the default branch, it had \`- **Status:** <current value>\`. The default branch's \`- **Status:** <other value>\` stands.` `clean` is true. The same rule holds for any `- **<Field>:** <value>` line, shown with `- **Last live gate:**`.
9. `register`: one side changes `- **Status:**` and the other adds a note on the line before it. The text has the changed Status line once and the note once.
10. `register`: both sides add a section `## R15 — …`. `clean` is false, `problems` has one sentence naming R15, and the text still holds both sections.
11. No line is lost: for each of cases 2 to 9, every line that the current side or the other side has and the base does not is in the text. In case 8 the current side's field line counts as kept when it is quoted in the note. ✏ 2026-10-04 (build, timone#200): in case 3 the older `**Last updated:**` line is replaced by the later one by design, so it is the one added line case 11 does not look for there. Case 3 and case 11 could not both hold as written.

> No dependency on other sub-phases.

How it works, precisely enough to build:

- Run `git merge-file -p --diff3 --marker-size=40 -L current -L base -L other <current> <base> <other>` on three temporary files. Exit 0 means clean: return its output. Exit above 0 means that many conflict blocks; a negative exit or a signal is an error, thrown with git's own words.
- Parse the output into plain lines and conflict blocks, each with its `current`, `base` and `other` lines, using the 40-character markers.
- Resolve each block. Compare `current` with `base` and `other` with `base` (a line-level longest common subsequence is enough at this size) to get each side's changes as ranges of base lines with their replacement. Apply both sides' changes where they do not overlap. A change both sides made the same way is applied once. Where they overlap, the result for the overlapping range is the other side's version, then the current side's version. In `status`, put a blank line between the two versions when neither has one at that edge.
- `status` then: if the resolved text of a block holds more than one `**Last updated:**` line, keep only the one with the later date (ISO dates compare as text); if a date cannot be read, keep the other side's line.
- `register` then: within one resolved block, if the same `- **<Field>:**` name appears twice, keep the other side's line where it stands, and remove the current side's line. Write the note of case 8 under the heading of the section that holds the field. A section is the lines from one `## ` heading to the next.
- `register` last, over the whole text: two `## R<k>` headings with the same `k` make `clean` false, with the problem `R<k> is taken on both sides of this merge, and requirement numbers are cited, so it is not renumbered. A person must choose.`

#### Agent Validation Steps

```bash
cd projects/timone   # the project's checkout, wherever the build runs it
npx vitest run src/merge-rules.test.ts
npm run type-check
git diff --name-only main... -- src | grep -v '^src/merge-rules' ; echo "exit: $?"   # nothing else under src/ changed; exit: 1
npm test
```

- [ ] The handoff shows cases 2, 3, 4 and 8 failing first (red) against a `mergeFile` that returns git's output with its conflict markers.
- [ ] Case 11 passes for every case it names.
- [ ] The full suite passes.

---

### Sub-phase 48b: The command git calls, how to switch it on, and the proof with real git

**[NEW FILE]** `src/commands/merge-file.ts` — `registerMergeFileCommand(program)`: `merge-file <kind> <base> <current> <other> [path]`. It reads the three files, calls `mergeFile` (48a), writes `text` into `<current>`, prints each problem on stderr prefixed with the path when one is given, and exits 0 when `clean`, 1 otherwise. An unknown kind exits 2 with one sentence naming `status` and `register`, and writes nothing. Git treats any exit above 0 as a conflict in that file.

**[NEW FILE]** `src/commands/merge-file.test.ts` — the command's own cases (7 and 8 below).

**[MODIFY]** `src/merge-rules.ts` — add:

```ts
/** The paths each rule applies to, as git attribute patterns relative to the repository root. */
export const MERGE_RULE_PATHS: Readonly<Record<MergeKind, string>> = {
  status: "/STATUS.md",
  register: "doc/specs/prd/*.criteria.md",
};
/** The git settings that switch both rules on: core.attributesFile and one driver per kind. */
export function mergeRulesConfig(options: { cli: string; dir: string }): ReadonlyArray<readonly [string, string]>;
/** Write `<dir>/attributes` and return the environment (GIT_CONFIG_COUNT, KEY_n, VALUE_n) that makes git use it. */
export function installMergeRules(dir: string, options: { cli: string }): Record<string, string>;
```

`mergeRulesConfig` returns, in this order: `core.attributesFile` = `<dir>/attributes`; `merge.timone-status.driver` = `node <cli> merge-file status %O %A %B %P`; `merge.timone-register.driver` = `node <cli> merge-file register %O %A %B %P`. The attributes file holds one line per kind: `/STATUS.md merge=timone-status` and `doc/specs/prd/*.criteria.md merge=timone-register`.

**[MODIFY]** `src/commands/guardrails.ts` — add `guardrails install-merge-rules --dir <path>`, shaped as `install-push-guard`: it calls `installMergeRules(options.dir, { cli: fileURLToPath(new URL("../cli.js", import.meta.url)) })`, prints nothing on success, and on failure prints one line starting `guardrails install-merge-rules:` and exits 1.

**[MODIFY]** `src/cli.ts` — import and call `registerMergeFileCommand(program)` in `buildProgram`.

**[NEW FILE]** `src/merge-rules.git.test.ts` — cases 1 to 6, with real git and the built CLI (`dist/cli.js`, as `push-guard.test.ts` uses it).

**Seams under test (TDD):** the seam is git itself: `git merge` in a clone whose environment is exactly what `installMergeRules` returns, with the built command as the driver. That is how a box will merge, and R8's falsifier is written at this boundary. The command's own seam is `registerMergeFileCommand` on a fresh `Command`. Red-green:

1. **R8's falsifier, squash.** A bare repository stands for the forge. Its `main` holds a `STATUS.md` with a `**Last updated:**` line and two items, and a register `doc/specs/prd/prd-01-x.criteria.md` with sections R1 and R2. Branches `a` and `b` are cut from it. Each adds a different item after the last item of `STATUS.md` and changes `**Last updated:**`, and each adds a different `> ✏` note under R2 of the register. `a` also adds a clause at the end of R1's criteria list, and so does `b`. `a` lands on `main` as one squash commit. In a clone on `b`, with the environment from `installMergeRules`, `git merge --no-edit origin/main` exits 0. `git diff --name-only --diff-filter=U` prints nothing. Every line `a` or `b` added is in both files, `STATUS.md` holds one `**Last updated:**` line, and R2 holds one `- **Status:**` line.
2. The same as case 1, with `a` landed on `main` as a merge commit.
3. **The test is not empty.** The same as case 1 without the environment: `git merge` exits 1, and both files are listed as unmerged.
4. **Nothing is written into the project.** After case 1, the clone holds no `.gitattributes`, `.git/config` is byte for byte what it was before the merge, `.git/info/attributes` does not exist, and `git status --porcelain` prints nothing.
5. Both branches add a section `## R3 — …` to the register. `git merge` exits 1, the register is listed as unmerged, and git's output names R3.
6. Both branches change R2's `- **Status:**` to different values. `git merge` exits 0. R2 holds `main`'s value and the note naming `b`'s value.
7. The command: `merge-file register <base> <current> <other> doc/specs/prd/x.criteria.md` on three files whose merge is case 10 of 48a exits 1, and its stderr names the path and R15. On three files that merge cleanly it exits 0 and `<current>` holds the result.
8. `merge-file chapter a b c` exits 2 with one sentence naming `status` and `register`, and `a`, `b` and `c` are unchanged. `guardrails install-merge-rules --dir <tmp>` exits 0 and writes `<tmp>/attributes` with the two lines above; with `--dir` pointing below a regular file it exits 1 and prints one line starting `guardrails install-merge-rules:`.

> Sub-phase 48a must be complete before starting this sub-phase (the command calls `mergeFile`).

Every git command in these tests runs with `GIT_CONFIG_NOSYSTEM=1`, a `HOME` inside the temporary directory, and `user.name` and `user.email` set in the clone, as `push-guard.test.ts` does, so the machine's own git settings cannot make a case pass or fail.

#### Agent Validation Steps

```bash
cd projects/timone
npm run build
npx vitest run src/merge-rules.test.ts src/merge-rules.git.test.ts src/commands/merge-file.test.ts src/commands/guardrails.test.ts
npm run type-check
node dist/cli.js merge-file --help; echo "exit: $?"                    # names <kind> <base> <current> <other> [path]; exit: 0
node dist/cli.js merge-file chapter /dev/null /dev/null /dev/null; echo "exit: $?"   # one sentence naming status and register; exit: 2
d=$(mktemp -d) && node dist/cli.js guardrails install-merge-rules --dir "$d"; echo "exit: $?"; cat "$d/attributes"   # exit: 0, then the two lines
git ls-files | grep -c '\.gitattributes$'; echo "exit: $?"            # 0 — the project gains no attributes file; exit: 1
npm test
```

- [ ] The handoff shows case 1 failing first (red), with `git merge` stopping on both files, before `installMergeRules` and the command exist.
- [ ] Case 3 passes: without the environment the same merge stops on both files.
- [ ] The full suite passes.

---

### Sub-phase 48c: The box switches the rule on for every git the session runs

**[MODIFY]** `src/daemon/container-runtime.ts` — add `const MERGE_RULES_DIR = "$HOME/.timone/git-merge";` beside `PUSH_GUARD_DIR`. In `boxScript`, right after the push guard's install block and before the export line, add the install, in the same shape as the guard's:

```sh
node /workspace/timone/dist/cli.js guardrails install-merge-rules --dir "$HOME/.timone/git-merge" > /tmp/timone-merge-rules.log 2>&1 || {
  echo "could not set up the rule that merges STATUS.md and the requirement registers without a person. Refusing to work without it. It said: $(timone_reason /tmp/timone-merge-rules.log)" >&2
  exit 79
}
```

Replace the hand-written export line with one built by a small function in this file from two lists: `[["core.hooksPath", PUSH_GUARD_DIR]]` and `mergeRulesConfig({ cli: \`${WORKSPACE}/timone/dist/cli.js\`, dir: MERGE_RULES_DIR })` (48b). It writes `export GIT_CONFIG_COUNT=<n>` and each `GIT_CONFIG_KEY_<i>=<key>` and `GIT_CONFIG_VALUE_<i>="<value>"`, with `<n>` the number of pairs. Each value is in double quotes so `$HOME` is expanded and a value with spaces stays one word. No value may hold `"`, `` ` `` or `\`; the function throws if one does, because then the line would mean something else to the shell. `core.hooksPath` stays index 0.

**[MODIFY]** `src/daemon/container-runtime.test.ts` — `PUSH_GUARD_LINES`'s last entry and the test "is switched on for every git the session runs" change from the one-setting line to the new line. Name this change in the handoff: it changes what an existing test expects, because the line it pins now carries four settings. Add a `describe("the merge rule in a boxed run")` with the cases below.

**Seams under test (TDD):** `containerRuntime(...).start(request)` with the fake container these tests already use, reading the script it hands to `docker run`. That is the boundary the box is built from. Case 4 also runs the generated line in a real shell, because what matters is what the shell makes of it. Red-green:

1. The install of the merge rules comes after Timone's `npm run build` and the push guard's install, and before `exec claude`.
2. The script stops with exit 79 when the install fails: the install line is followed by `|| {`, the sentence above, and `exit 79`.
3. The export line comes after the install and before `exec claude`, starts `export GIT_CONFIG_COUNT=4`, and has `core.hooksPath` at index 0, then `core.attributesFile`, `merge.timone-status.driver` and `merge.timone-register.driver`.
4. **Hard gate.** The export line, run as `sh -c '<line>; git config --get core.hooksPath; git config --get core.attributesFile; git config --get merge.timone-status.driver; git config --get merge.timone-register.driver'` with `HOME` set to a temporary directory and `GIT_CONFIG_NOSYSTEM=1`, prints `<home>/.timone/git-hooks`, `<home>/.timone/git-merge/attributes`, `node /workspace/timone/dist/cli.js merge-file status %O %A %B %P` and the same for `register`, one per line.
5. A box with no work branch gets the same install and the same export line: the rule does not depend on the branch.
6. The export function throws on a value holding `"`.

> Sub-phase 48b must be complete before starting this sub-phase (`mergeRulesConfig` and `guardrails install-merge-rules`).

#### Agent Validation Steps

```bash
cd projects/timone
npm run build
npx vitest run src/daemon/container-runtime.test.ts
grep -n 'GIT_CONFIG_COUNT=1 ' src/daemon/container-runtime.ts | grep -v '^\s*[0-9]*:\s*//'; echo "exit: $?"   # the one-setting line is gone from the code; exit: 1
npm run type-check
npm test
```

- [ ] The handoff shows cases 1, 3 and 4 failing first (red) against the unchanged `boxScript`.
- [ ] Case 4 passes: the shell reads all four settings back, the push guard's among them.
- [ ] The handoff names the changed expectation in `PUSH_GUARD_LINES` and in "is switched on for every git the session runs", and no other existing test's expectation changed.
- [ ] The full suite passes.

---

### Sub-phase 48d: What the process says about these two files

**[MODIFY]** `process.md` — in **Status reporting**, after the paragraph marked ✏ Revised 2026-10-03, add one dated paragraph (✏ 2026-10-04, ADR-0064): when a run's branch is brought level with the default branch in a box, `STATUS.md` and the requirement registers are merged by Timone's own rule, which keeps what both sides wrote; a branch is brought level by merging the default branch into it, never by rebasing.

**[MODIFY]** `STATUS.md` — one item for this pull request, in the shape of the items already there: what it changes for fvermaut (a pull request brought level no longer stops on `STATUS.md` or a register), the branch and the pull request, and what is needed from him.

**Seams under test (TDD):** no behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based.

> Sub-phases 48a, 48b and 48c must be complete before starting this sub-phase (the paragraph describes what they built).

#### Agent Validation Steps

```bash
cd projects/timone
grep -n 'ADR-0064' process.md; echo "exit: $?"                          # one line, in Status reporting; exit: 0
git diff --stat main... -- process.md                                    # one paragraph added, no line removed
npm test
```

- [ ] The paragraph names ADR-0064 and says the branch is merged, not rebased.
- [ ] No line of `process.md` was removed.
- [ ] The `STATUS.md` item names which repository it belongs to (Timone), the branch, and the pull request.

## Dependency graph

```
48a → (none)        the rule: three texts in, one text out
48b → 48a           the command git calls, how to switch it on, and R8's test with real git
48c → 48b           the box switches it on for every git the session runs
48d → 48a, 48b, 48c process.md and STATUS.md
```

Nothing runs in parallel: each part needs the one before it.
