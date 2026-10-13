# Phase 61: The update joins check-script conflicts — it finds ivtrends' check scripts and tests, joins a check script both sides changed, and an update that could not finish its merge ends as failed

> **Status:** Planned.

> **Companion phases:** [phase 50](phase-50.md) built the update (ADR-0066): `src/update-checks.ts`, `node dist/cli.js update-checks`, `src/runner/update-section.ts`, the update's skill and the runner's rule for it; every slice here changes one of those. [Phase 48](phase-48.md) built Timone's own merge rule for `STATUS.md` and the registers (ADR-0064), which the update keeps using unchanged. [Phase 57](phase-57.md) taught the guard which step runs in a container (PRD-10), which is why the update may already open the check scripts there. Governing decisions: [ADR-0068](../../adr/0068-the-update-joins-a-conflict-in-a-check-script-itself-and-a-merge-it-could-not-finish-is-a-step-that-failed.md), recorded for this phase, because it is the decision being built: the update session joins check-script conflicts itself, the record says how, and an update that did not bring the branch level ends as failed; [ADR-0066](../../adr/0066-the-update-is-a-step-the-runner-starts-when-an-open-pull-request-falls-behind.md), because everything else about the update stands as it says; [ADR-0048](../../adr/0048-a-verification-probe-is-kept-proved-able-to-fail-and-hidden-from-the-builder.md) D4, because the builder of this phase is kept out of the probe folders by the guard, which shapes how every test here names that folder; [ADR-0061](../../adr/0061-a-check-script-proves-itself-once-and-a-fix-re-runs-what-it-can-affect.md) D1, because a joined script does a real run only.

> **Screens changed:** none — the update's command line, its record, the runner's record and rules, and the update's instructions; no slice changes anything a person sees.

## Requirements

> **PRD:** [prd-07-several-tickets-of-one-project-at-once.md](../../specs/prd/prd-07-several-tickets-of-one-project-at-once.md) — criteria in [prd-07-several-tickets-of-one-project-at-once.criteria.md](../../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md); [prd-05-a-runner-decides-each-step.md](../../specs/prd/prd-05-a-runner-decides-each-step.md) — criteria in [prd-05-a-runner-decides-each-step.criteria.md](../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-07.R7 | MUST | After a merge, every other open pull request is brought level: the machine fixes any conflict, runs the whole test suite and both tickets' check scripts, and says on the pull request what changed and whether the work passes. |
| PRD-05.R18 | MUST | A change to the runner's rules is proposed with the replay run, and its result on the pull request (clause 2). |

Bugs: [timone#234](https://github.com/fvermaut/timone/issues/234) (the update stops on a check script both sides changed, and reports "succeeded") and [timone#235](https://github.com/fvermaut/timone/issues/235) (on ivtrends the update finds no check script and no test command), folded together by fvermaut on 2026-10-13: [triage 004](../../triage/004-the-update-joins-check-script-conflicts.md).

## Goal Description

**#234.** Eight times between 2026-10-08 and 2026-10-13, on ivtrends #175, #176, #194, #197 and #201, the update stopped its merge because main and the branch had both changed a check script. ADR-0066 D4 told the update session never to edit anything, and told its fix context never to open the probe folders, so nothing could join the file. The update aborted the merge, the branch stayed behind, and the step was reported as "succeeded" because the session itself ended cleanly. Three were joined by hand in takeovers ([phase-60-update.md on ivtrends#175's branch](https://github.com/fvermaut/ivtrends/blob/timone/175-2-the-board-s-settings-menu-the-title-in/doc/plans/phases/reports/phase-60-update.md), Update 2, and [phase-64-update.md on ivtrends#176's branch](https://github.com/fvermaut/ivtrends/blob/timone/176-3-no-long-text-on-the-board/doc/plans/phases/reports/phase-64-update.md), Update 2, are the two worked examples of a correct join). fvermaut decided on 2026-10-13 that the update session joins check-script conflicts itself and keeps every check from both sides; [ADR-0068](../../adr/0068-the-update-joins-a-conflict-in-a-check-script-itself-and-a-merge-it-could-not-finish-is-a-step-that-failed.md) records it, with the three shapes of conflict and what the join does for each. This phase builds what code can do for that — a command that says which conflicted files are check scripts, a record line for the join, and a step ending that tells the truth — and rewrites the update's instructions so the session does the join.

**#235.** `checkScriptOf` in `src/update-checks.ts` finds a check script only when it is named `prd-18.r12.<ext>`, as Timone names its own. ivtrends writes `prd-18-r12.<ext>`, so on ivtrends the update never runs a check script, and a joined script would never be run. `updateChecks` reads only `scripts.test`; ivtrends has `test:unit`, `test:integration` and `test:e2e` and no `test`, so every ivtrends update writes "the project has no test command" and ends as not passing, even when every suite passed (ivtrends#196, 2026-10-12). Without this fix the join of #234 would be built and never run on the project it was built for. That is why fvermaut put both in one piece of work.

**Decisions taken here that did not reach an ADR.** (1) **When a project has no `scripts.test`, its test commands are its `test:<name>` scripts**, in the order `package.json` lists them, each run as `npm run test:<name>`, leaving out any script whose name has a `watch` part (`test:watch`, `test:unit:watch`), since that one never ends. A project with `scripts.test` keeps exactly that one command. This is one function and easy to change, and it is what ivtrends' own updates already ran by hand, so it fails the "hard to reverse" part of the test. (2) **A check script's file name may separate the PRD number from the requirement with a dot or a dash** (`prd-18.r12` or `prd-18-r12`). This reads a naming the project already uses; it decides nothing. (3) **Every conflicted file under either probe folder is the session's to join**, whether or not its name is a requirement's: a shared helper in that folder is kept from the fix context as much as a check is. That follows ADR-0068 D1 and ADR-0066 D4 together. (4) **The join does not pin commits.** ADR-0068 D1 says so: a check keeps how it finds what it compares with, a pin both sides already share is kept once, and no pin is added. The problem that pinning would solve — after the merge, "where the branch left main" is main itself, so the checks of the work that arrived compare that work with itself — is [timone#240](https://github.com/fvermaut/timone/issues/240), and triage 004 leaves it out. **How a joined script is run after the merge:** exactly as any other check script in the update, real run only, under both tickets' sets when both claim its requirement; a part of it from the work that arrived meets #240's fault as every arrived check does today.

**The real replay is owed before the pull request.** Sub-phase 61d changes one of the runner's rules (what to do when an update failed), so PRD-05.R18 clause 2 asks for the replay set to run and its result to go on the pull request. It needs a model login and costs about $3.

**Regression set and what no criterion watches.** The diff touches `src/update-checks.ts`, `src/commands/`, `src/daemon/probeGuard.ts`, `src/adapters/`, `src/runner/`, `.claude/skills/` and `process.md`; verification derives the set from the register, narrowed by `Depends-on`. **PRD-07.R7 is `live` and depends on `src/runner/, src/daemon/, .claude/skills/`, all touched here, so this phase owes a live gate before delivery**: an update on scratch-app where both sides changed one check script. Per ADR-0059 it rides to the pull request if only fvermaut can run it. **What no test watches:** the join itself is done by the update session following its instructions — whether it keeps every check, and picks the stricter of two versions, is a judgement no unit test can make. The git test in 61b proves the line between check scripts and other files and that a joined merge finishes; only the live gate shows a session joining one.

## Context & Prerequisites

- **The probe folders, and how to name them.** `PROBE_DIRECTORIES` in `src/daemon/probeGuard.ts` holds the two folders. **The builder of this phase is refused, by the guard, any tool call whose input names one of them** — a file path, a shell command, a search. So: never write either folder's path as text, in code, in a test, in a doc or in a validation command. Tests build paths with `posix.join(PROBE_DIRECTORIES[0], name)`, as `src/update-checks.git.test.ts` already does (`probe(name)` helper, line ~31). Docs say "the probe folder", as the update's skill already does.
- **`src/update-checks.ts`** — `claimedRequirements`, `checkScriptOf` (dotted names only), `RunGit`, `PlanChecks`, `UpdateChecks` (with `testCommand: string | undefined`), `updateChecks(git, { defaultBranch, before })`.
- **`src/commands/update-checks.ts`** — the `update-checks <project> [--before] [--json]` command. Line ~77 prints "The project has no test command: there is no scripts.test in its package.json." or "The project's tests: <command>". It is the model for the new `update-conflicts` command (how it finds the project's checkout, runs git, and exits 2 with one sentence).
- **`src/update-checks.test.ts`, `src/update-checks.git.test.ts`** — the pure tests and the git-fixture tests (a bare remote, a seed clone, a work clone; `commit`, `mustGit`, `PACKAGE_JSON`). Extend these; do not build a second fixture.
- **`src/runner/update-section.ts`** — `latestUpdate(recordText)` reads the newest `## Update` entry into `UpdateEntry`; `updateSection(entry, defaultBranch)` writes the pull request's block; `withUpdate`. The heading is `## Update <k> — <ISO time>`, written by the session.
- **`src/runner/actions.ts`** — `start` (around line 800–865) writes the `step-started` entry and, in `ended`, the `step-ended` entry with `ok: outcome.ok` and `error`. The driver's `afterStep` and `unreadStepEnd` (`src/runner/driver.ts`, around lines 955 and 1090–1120) read that entry back with `lastStepEnded` and build `stepEndedEvent(stage, ended)`: "The step … ended: it succeeded." or "… it failed: <why>." So the record entry is the single place the step's outcome is decided.
- **`src/runner/driver.ts` `updateOf`** (around line 1189) finds the branch's one phase file with `filesAddedOnBranch(adapter, project, defaultBranch, branch, PHASES)` (from `src/runner/facts.ts`) and reads `${PHASES}/reports/<phase>-update.md` with `adapter.readFile`.
- **The forge.** `TicketingAdapter.behindDefault(project, branch)` in `src/adapters/ticketing.ts` (line ~423), built in `src/adapters/github-tickets.ts` (line ~582) on `gh api repos/<slug>/compare/<default>...<branch>`, 404 → undefined. Fakes that implement it: `src/adapters/ticketing.stubs.ts`, `src/runner/replay/recording.ts`, `src/runner/actions.test.ts` (~line 117), `src/runner/driver.test.ts` (~line 1318).
- **`src/runner/brief.ts`** — the runner's rules, `SYSTEM`, line ~178: the update bullet ("When it ends, start nothing more for it …").
- **`.claude/skills/timone-update/SKILL.md`** — the update's instructions. Today it says the session never changes code, never opens the probe folder, and hands every conflict to the fix context (intro, *What you never read*, step 3, *The fix context's brief*).
- **`process.md`** — two places: the update paragraph (*The update — while a pull request is open*, "It does not fix code itself. A conflict or a failing test goes to a fresh fix context"), and the probe rule in stage 7 ("only stage 7 writes there"). **`.claude/skills/timone-verify/SKILL.md`** line ~43 repeats "only this stage writes there".
- **Probes this phase must keep passing** are whichever the register's regression set names for these paths; the builder never opens them.

## Sub-phases

### Sub-phase 61a: The update finds check scripts named with a dash, and runs a project's `test:` scripts when it has no `test`

**[MODIFY]** `src/update-checks.ts` —
- `checkScriptOf(id, files)` also matches a file whose name without extension is the lowercased ID with the dot replaced by a dash (`PRD-18.R12` → `prd-18-r12`). When both forms exist, the dotted one wins. Still only files directly in `PROBE_DIRECTORIES[0]`; still not `prd-18-r120`.
- Add `export function requirementOfCheckScript(path: string): string | undefined` — the inverse: for a file directly in either probe folder whose name is `prd-<n>.r<k>` or `prd-<n>-r<k>` plus an extension, the ID `PRD-<n>.R<k>`; otherwise undefined. 61b uses it.
- Replace `testCommand: string | undefined` in `UpdateChecks` with `testCommands: string[]`: `["npm test"]` when `package.json` has `scripts.test`; otherwise `npm run <name>` for each script whose name starts with `test:` and has no `watch` part (split on `:`), in the order the file lists them; otherwise `[]`. No `package.json` → `[]`.

**[MODIFY]** `src/commands/update-checks.ts` — print "The project's tests: npm run test:unit, then npm run test:integration, then npm run test:e2e." (one command: "The project's tests: npm test."). With none: "The project has no test command: its package.json has no scripts.test and no test: script." `--json` carries `testCommands`.

**[MODIFY]** `src/update-checks.test.ts`, `src/update-checks.git.test.ts`, and the command's test if it has one — the cases below.

**Seams under test (TDD):** `checkScriptOf` and `requirementOfCheckScript` (pure), and `updateChecks` on the git fixture, for the test commands and the dashed scripts read from a real repository. Red-green: (1) `checkScriptOf("PRD-18.R12", [probe("prd-18-r12.mjs")])` returns that path; (2) with both `prd-18.r12.mjs` and `prd-18-r12.mjs` it returns the dotted one; (3) `prd-18-r120.mjs` and a dashed file in a sub-folder are not matched; (4) `requirementOfCheckScript` gives `PRD-18.R12` for both forms in `PROBE_DIRECTORIES[0]` and for a file in `PROBE_DIRECTORIES[1]`, and undefined for a helper file (`_shared.mjs`), for a file outside both folders, and for one in a sub-folder; (5) on the git fixture, a `package.json` with `test:unit`, `test:integration`, `test:watch` and `test:e2e` and no `test` gives `testCommands` `["npm run test:unit", "npm run test:integration", "npm run test:e2e"]`; (6) a `package.json` with `test` and `test:unit` gives `["npm test"]`; (7) one with neither gives `[]`; (8) a branch whose plan claims `PRD-18.R12` with the script committed as `prd-18-r12.mjs` lists that script under the plan; (9) the existing cases stay green, with `testCommand` read as `testCommands`.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
npx vitest run src/update-checks.test.ts src/update-checks.git.test.ts src/commands
npx tsc --noEmit; echo "exit: $?"   # expect 0
grep -rn "testCommand\b" src --include=*.ts | grep -v '^\s*//' ; echo "exit: $?"   # expect 1: no reader of the old field is left
```

- [ ] Every case above is red before the change and green after, and the handoff shows both runs.
- [ ] No file and no command in this sub-phase names a probe folder as text; paths come from `PROBE_DIRECTORIES`.

---

### Sub-phase 61b: A command says which conflicted files are check scripts the update joins, and which go to the fix context

**[MODIFY]** `src/update-checks.ts` — add

```ts
export interface MergeConflicts {
  /** Files left in conflict under a probe folder: the update session joins these itself (ADR-0068 D1). */
  checkScripts: { path: string; id?: string }[];
  /** Every other file left in conflict: these go to the fresh fix context. */
  others: string[];
}
export function mergeConflicts(git: RunGit): MergeConflicts
```

It reads `git diff --name-only --diff-filter=U`, puts each path under either probe folder into `checkScripts` with `requirementOfCheckScript(path)` as its `id` when it has one, and every other path into `others`, each list in git's order.

**[NEW FILE]** `src/commands/update-conflicts.ts` — `timone update-conflicts <project> [--json]`, registered beside `update-checks` in the CLI. It runs `mergeConflicts` in the project's checkout and prints:

```
Check scripts left in conflict — join these yourself, keeping every check from both sides:
- PRD-18.R12: <path>
- (no requirement): <path>
Other files left in conflict — give these to the fix context:
- src/x.ts
```

with "none" under a heading that has no file. When no merge is in progress (`git rev-parse -q --verify MERGE_HEAD` fails) it exits 2 with one sentence: "No merge is in progress in <project>: there is nothing to join." Mirror `src/commands/update-checks.ts` for finding the checkout and the exit codes.

**[MODIFY]** `src/daemon/probeGuard.ts` — the comment on `CHECKING_STAGES` and the allow reason: the update runs the checks **and joins one a merge left in conflict** (ADR-0068 D1); its fix context is still kept out by its brief. Update `src/daemon/probeGuard.test.ts` only if it asserts the old reason word for word. The decision itself (allow for `update`) does not change.

**[MODIFY]** `src/update-checks.git.test.ts` — the cases below, on the existing fixture.

**[MODIFY]** `src/guards/checkouts.test.ts` — ✏ 2026-10-13 (build, timone#234): add `commands/update-conflicts.ts` to `GIT_USERS`, beside `commands/update-checks.ts`, saying what it runs git on. That test lists every source file that runs git, and the new command runs git, so without the entry the whole suite fails one test. The plan did not list the file; phase 50 added `update-checks` there the same way.

**Seams under test (TDD):** `mergeConflicts`, on the git fixture with a real merge of `origin/main` into the work branch — the boundary the update session will call through the command; and the command's output and exit code. Red-green: (1) **both sides changed one check script**: the base has a check script for `PRD-07.R7` with one check; main adds a second check, the branch adds a third, both at the end of the file; the branch also changes one line of `src/a.ts` that main changed too. After `git merge --no-edit origin/main` fails, `mergeConflicts` gives `checkScripts: [{ path: <the script>, id: "PRD-07.R7" }]` and `others: ["src/a.ts"]`; (2) continuing that merge as the update will: the test writes the script with all three checks (the join) and `src/a.ts` with either side, `git add`s both and `git commit --no-edit`; the merge is finished (`MERGE_HEAD` gone), `mergeConflicts` gives two empty lists, the joined script holds all three checks, and `updateChecks(git, { defaultBranch: "main", before })` lists that script under both the branch's plan and the plan that arrived when both claim `PRD-07.R7`; (3) **both sides added a whole script** named with a dash, `prd-23-r8.mjs`, with nothing in common (git: added by both): listed under `checkScripts` with `id: "PRD-23.R8"`; (4) a conflicted helper file in the probe folder is listed under `checkScripts` with no `id`, never under `others`; (5) a conflict in a file under `PROBE_DIRECTORIES[1]` is listed under `checkScripts`; (6) a merge with no conflict left gives two empty lists; (7) the command, with no merge in progress, exits 2 with its sentence; with case (1)'s merge in progress it prints the two headings with the files under each.

> Sub-phase 61a must be complete before starting this sub-phase (it uses `requirementOfCheckScript`, and both change `src/update-checks.ts` and its git test).

#### Agent Validation Steps

```bash
npx vitest run src/update-checks.test.ts src/update-checks.git.test.ts src/daemon/probeGuard.test.ts src/commands
npx tsc --noEmit; echo "exit: $?"   # expect 0
npm run --silent build && node dist/cli.js update-conflicts timone; echo "exit: $?"   # expect 2: no merge is in progress here
```

> ✏ 2026-10-13 (build, timone#234): the command finds the project's checkout at `projects/<name>` under the folder it runs in, as `update-checks` does, so the third line is run from the Timone root, as `node projects/timone/dist/cli.js update-conflicts timone`. Run from inside the project, it exits 2 with "The project \"timone\" is not checked out at …" instead.

- [ ] Case (1) is the test for an update where both sides changed one check script, and it is red before `mergeConflicts` exists.
- [ ] Red→green evidence for every case is in the handoff.
- [ ] The guard still allows `update` and still refuses `execution` and `remediation`: `probeGuard.test.ts` passes unchanged apart from the reason text.

---

### Sub-phase 61c: The record says which check scripts were joined, and when the entry was written

**[MODIFY]** `src/runner/update-section.ts` —
- `UpdateEntry` gains `at: string | undefined` — the ISO time from the heading `## Update <k> — <ISO time>`, when it parses as a date — and `checkScriptsJoined: string | undefined` — the value of a new field line `- **Check scripts joined:** none | <ID>: <how>; <ID>: <how>`. An entry with no such line (every entry written before this phase) reads it as undefined, and nothing else changes for it.
- `updateSection` adds, after the "What had to change" line, one line when the field is present and not `none`: "Check scripts joined: <value>." When it is `none` or absent, no line. The field never decides whether the work passes.

**[MODIFY]** `src/runner/update-section.test.ts` — the cases below.

**Seams under test (TDD):** `latestUpdate` and `updateSection`, both pure. Red-green: (1) an entry with heading `## Update 3 — 2026-10-13T12:38:51Z` reads `at` as that time; a heading with no time, or with text that is not a date, reads `at` undefined; (2) `Check scripts joined: PRD-17.R3: kept the version that fails wherever the other would; PRD-18.R12: kept both sides' checks` is read whole; (3) the section of that entry has the line "Check scripts joined: PRD-17.R3: …; PRD-18.R12: kept both sides' checks." under "What had to change", and its pass or fail heading is the same as without the line; (4) `none` and a missing line both give no line in the section; (5) an entry from before this phase (no field) gives exactly the section it gave before — the existing cases stay green.

> No dependency on other sub-phases. It may run beside 61a and 61b: it shares no file with them.

#### Agent Validation Steps

```bash
npx vitest run src/runner/update-section.test.ts src/runner/driver.test.ts
npx tsc --noEmit; echo "exit: $?"   # expect 0
```

- [ ] Red→green evidence for every case is in the handoff.
- [ ] `src/runner/driver.test.ts` passes unchanged: the pull request's block for an old entry is the same.

---

### Sub-phase 61d: An update that did not bring the branch level ends as failed, and the runner asks a person

**[MODIFY]** `src/adapters/ticketing.ts`, `src/adapters/github-tickets.ts` — add `branchHolds(project, branch, commit): Promise<boolean | undefined>`: whether `branch` holds `commit`, through `gh api repos/<slug>/compare/<commit>...<branch> --jq .behind_by` — true when it is 0. A 404 (unknown commit or branch) → undefined, any other error thrown, as `behindDefault` does. Implement it in every fake that implements `behindDefault`: `src/adapters/ticketing.stubs.ts` (answers true), `src/runner/replay/recording.ts`, `src/runner/actions.test.ts`, `src/runner/driver.test.ts`.

**[MODIFY]** `src/runner/facts.ts` — add `newestUpdateEntry(adapter, project, branch): Promise<UpdateEntry | undefined>`, moved out of `driver.ts`'s `updateOf`: the branch's one added phase file, its `<phase>-update.md`, `latestUpdate` of it. `updateOf` in `src/runner/driver.ts` calls it and keeps its behaviour.

**[MODIFY]** `src/runner/update-section.ts` — add the pure rule:

```ts
/** Why an update step that ended cleanly did not do its work, or undefined when it did (ADR-0068 D4). */
export function unfinishedUpdate(facts: {
  entry: UpdateEntry | undefined;   // the newest entry on the branch after the step
  startedAt: string;                // when the step started
  holds: boolean | undefined;       // whether the branch holds the entry's `Level with` commit
  behind: number | undefined;       // how far the branch is behind the default branch now
  defaultBranch: string;
}): string | undefined
```

The entry is **new** when its `at` is not before `startedAt`. New entry, `holds` true → undefined (done, whatever its `Result`). New entry, `holds` false → "the merge of <default> at <sha> was not finished: <the entry's failure, when it gives one>". No new entry, `behind` 0 → undefined (there was nothing to bring in). No new entry, `behind` > 0 → "it wrote no record entry, and the branch is still <n> commit(s) behind <default>". `holds` or `behind` undefined where it is needed → undefined: an answer the forge did not give never turns a step into a failure. The `<sha>` is the commit in the entry's `Level with:` value (`main at 9b1e0d2`).

**[MODIFY]** `src/runner/actions.ts` — in `ended`, **before** the `step-ended` entry is written, when `stage === "update"` and `outcome.ok`: read `newestUpdateEntry`, ask `branchHolds` for the entry's commit when there is a new entry, or `behindDefault` when there is not, and call `unfinishedUpdate`. A reason → write the entry with `ok: false` and that reason as `error`. Any error on the way is logged and the entry is written as the session ended. Every other stage, and an update whose session already failed, is written exactly as today and never asks the forge.

**[MODIFY]** `src/runner/brief.ts` — the update bullet of `SYSTEM` becomes: "When you are told that the ticket's branch is behind the default branch, and no step is running, start the update. Start it even while the pull request waits for review. When it succeeded, start nothing more for it: the top of the pull request says what a person needs to know. When it failed, the branch is still behind: say on the ticket in plain words what stopped it, and ask a named person to bring the branch level. Do not start the update again until you are told the default branch moved again. When it moves again, you are told again." Update `src/runner/brief.test.ts` where it holds the old words.

**[MODIFY]** `src/runner/update-section.test.ts`, `src/runner/actions.test.ts`, `src/runner/driver.test.ts`, `src/adapters/github-tickets.test.ts` — the cases below.

**Seams under test (TDD):** `unfinishedUpdate` (pure); `branchHolds` on `GitHubTicketingAdapter` with a scripted `run`, as `behindDefault`'s tests do; and the step's end through `runnerActions(...).startStep` on the existing fake world, observed in the record's `step-ended` entry and in the event the driver gives the runner. Red-green: (1) `unfinishedUpdate`: new entry and `holds` true → undefined, also when the entry's result is "does not pass" for a failing test; (2) new entry, `holds` false, result "does not pass — main could not be merged in: …" → a reason naming `main at <sha>` and that failure; (3) only an entry older than `startedAt` and `behind` 0 → undefined; (4) no entry and `behind` 3 → "it wrote no record entry, and the branch is still 3 commits behind main"; (5) `holds` undefined or `behind` undefined → undefined; (6) `branchHolds`: `behind_by` 0 → true, 4 → false, a 404 → undefined, a 500 → throws; (7) through `startStep("update")` with a session that ends ok, a record entry written after the start saying `main at abc1234`, and a forge where the branch does not hold `abc1234`: the record's `step-ended` has `ok: false` and the reason, and the runner is woken with "The step … ended: it failed: the merge of main at abc1234 was not finished …"; (8) the same with the forge saying it holds it → `ok: true`, "it succeeded"; (9) an `execution` step ending ok never calls `branchHolds` or `behindDefault`; (10) the forge throwing → `ok: true`, and the error is logged; (11) the brief's rules hold the new update bullet; (12) the dry replay passes every case.

> Sub-phase 61c must be complete before starting this sub-phase (it reads `UpdateEntry.at`, and both change `src/runner/update-section.ts`).

#### Agent Validation Steps

```bash
npx vitest run src/runner src/adapters
npx tsc --noEmit; echo "exit: $?"   # expect 0
npm run --silent replay -- --dry; echo "exit: $?"   # expect 0
```

- [ ] Red→green evidence for every case is in the handoff.
- [ ] The dry replay passes every case.
- [ ] **Human gate:** the real replay (`npm run replay`, every case, three tries each, on the model) runs on this branch after 61d, and its output goes into `doc/plans/phases/reports/phase-61-replay.md` as run 1 (PRD-05.R18 clause 2). It needs a model login and costs about $3. If no login is available where the build runs, record that in the completion report and the departures record, so that it rides to the pull request; fvermaut then runs it from his own terminal: `cd ~/dev/timone/projects/timone && npm run build && npm run replay 2>&1 | tee ~/dev/timone/.timone/replay-61.txt`.

---

### Sub-phase 61e: The update's instructions, `process.md` and the check's instructions say the update joins check scripts

**[MODIFY]** `.claude/skills/timone-update/SKILL.md` —
- **Intro:** the session never changes code with its own hands, **except** that it joins a check script a merge left in conflict (ADR-0068). Link ADR-0068 beside ADR-0066.
- **What you never read:** the probe folder's scripts are still run, never printed or listed; the one exception is a check script `update-conflicts` names as left in conflict, which the session opens to join it, and only that file.
- **Step 3**, after a merge that leaves conflicts: run `node dist/cli.js update-conflicts <name>` at the Timone root. **Join every check script it lists, yourself**, by the rules of ADR-0068 D1: keep every check from both sides; when both sides changed the same check in two ways, keep the one that fails wherever the other would; when both sides wrote a whole script, put both in one, each as its own part, keeping every clause; keep how each check finds what it compares with, keep a pin both sides share once, and add none; when you cannot tell which of two versions is stricter, do not guess — abort the merge as this step already says, and write in the entry which check and why. `git add` each joined script. Then, when other files are listed, give only those to the fix context (unchanged brief), which finishes the merge commit; when none are, finish the merge commit yourself with `git commit --no-edit` and the trailers. A join is not counted as one of the two fixes, and a joined script does a real run only, never a break run.
- **Step 4.1:** run every command `update-checks` lists as the project's tests, one after another; the whole suite passes only when each passes; the one line gives each suite's count.
- **The record entry:** add `- **Check scripts joined:** none | <ID>: <how>; …` after `Code changed:` in the form and in the filled-in example, with how to fill it: one plain sentence per joined script, by requirement ID, never its path. Change the `Whole test suite:` "none" wording to "the project has no test command" only when `update-checks` lists none.
- **Closing:** say that code reads the branch after the step, and an update whose merge was not finished is recorded as a step that failed; the session still ends with its ordinary ending.

**[MODIFY]** `process.md` — the update paragraph (*The update — while a pull request is open*): a dated ✏ 2026-10-13 ([ADR-0068](doc/adr/0068-the-update-joins-a-conflict-in-a-check-script-itself-and-a-merge-it-could-not-finish-is-a-step-that-failed.md)) marked change: the update joins a conflict in a check script itself, keeping every check from both sides; every other conflict and every failing test still go to a fresh fix context; an update that did not bring the branch level is recorded as a step that failed, and the runner asks a person. The stage 7 probe rule ("only stage 7 writes there"): a marked note that the update's join is the one other writer, and that it writes no new check (ADR-0068 D3). Strike nothing; add the ✏ text beside the old.

**[MODIFY]** `.claude/skills/timone-verify/SKILL.md` — line ~43, "only this stage writes there": add the same exception, marked and dated, in one sentence.

**[MODIFY]** `CONTEXT.md` — the **Update** entry: one clause, that it joins a check script both sides changed itself. Only if the entry does not already cover it.

**[MODIFY]** any other file the search below finds still saying the update never opens or never edits a check script, outside ADRs (ADRs are never edited; ADR-0066's status line already points at ADR-0068) and outside reports and old phase files.

No behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based.

> Sub-phases 61a, 61b, 61c and 61d must be complete before starting this sub-phase (the instructions name the `update-conflicts` command, the `testCommands` output, the `Check scripts joined:` line and the failed-step rule).

#### Agent Validation Steps

```bash
grep -n "update-conflicts\|Check scripts joined\|ADR-0068" .claude/skills/timone-update/SKILL.md      # each appears
grep -n "ADR-0068" process.md .claude/skills/timone-verify/SKILL.md                                    # both files
grep -rn -i "never edits code itself\|does not fix code itself\|never change code with your own hands" process.md .claude CONTEXT.md manual; echo "exit: $?"   # every hit is followed in the same paragraph by the ADR-0068 exception
npx vitest run src/daemon/prompts.test.ts src/update-checks.git.test.ts
```

- [ ] The update's instructions say, in one place, the five join rules of ADR-0068 D1, word for word in meaning.
- [ ] The fix context's brief is unchanged: it still says never to open the folder the check keeps its scripts in.
- [ ] No file this sub-phase changed writes a probe folder's path as text.
- [ ] The record entry form and its filled-in example both carry `Check scripts joined:`, in the form `latestUpdate` reads (61c).
- [ ] No process artifact under `doc/` was changed by this sub-phase other than its own handoff section.

## Dependency graph

```
61a → (none)        the update finds dashed check scripts and the test: scripts (#235)
61b → 61a           a command sorts conflicted files into check scripts and the rest; the both-sides test
61c → (none)        the record carries the joined scripts and the entry's time (may run beside 61a/61b)
61d → 61c           an update that did not bring the branch level ends as failed; the runner asks a person; replay
61e → 61a, 61b, 61c, 61d   the update's instructions, process.md and the check's instructions
```
