# Phase 50: The update after a merge — an open pull request that falls behind the default branch is noticed, brought level by an `update` step, tested on three sets, and says at its top what had to change

> **Status:** Complete — see [reports/phase-50-complete.md](reports/phase-50-complete.md).

> **Companion phases:** [phase 47](phase-47.md) — piece 3 of the same list, merged; it freed the project when a pull request opens, so several pull requests of one project are now open at once, and it built the places an update takes (`askPlace`). [phase 48](phase-48.md) — piece 2, merged; it installed Timone's merge rule for `STATUS.md` and the registers in every box (`installMergeRules`, `merge-file`), which the update relies on when it merges. [phase 49](phase-49.md) — piece 5, merged; it added the planner, which is not asked about an update, and `filesAddedOnBranch` / `planOf`, which this phase reuses to find a branch's own plan. [phase 44](phase-44.md) — piece 1, merged; this phase and ADR-0066 took their numbers through `number`. Governing decisions: [ADR-0066](../../adr/0066-the-update-is-a-step-the-runner-starts-when-an-open-pull-request-falls-behind.md) — recorded while planning this phase; D1 is 50a, D2 is 50b, D3 is 50a's choice of runs, D4 is 50b's probe access and 50c and 50e, D5 is 50d. [ADR-0064](../../adr/0064-status-md-and-the-registers-are-merged-by-timones-own-rule-in-the-box.md) D3 — a branch is brought level by merging the default branch into it, never by rebasing; 50e's instructions say so. [ADR-0063](../../adr/0063-a-ticket-takes-a-place-only-while-one-of-its-steps-runs.md) — an update is a step and takes a place, through the same `startStep` as every step. [ADR-0065](../../adr/0065-the-planner-is-a-session-of-its-own-asked-when-a-build-would-start.md) D2 — only `execution` asks the planner, so `update` must not. [ADR-0048](../../adr/0048-a-verification-probe-is-kept-proved-able-to-fail-and-hidden-from-the-builder.md) D4 — why the builder of this phase may never open the probe folders (see *Context*). [ADR-0060](../../adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md) — code tells the runner facts and the runner starts steps; the machine never merges. [ADR-0061](../../adr/0061-a-check-script-proves-itself-once-and-a-fix-re-runs-what-it-can-affect.md) D1 — a check script the update runs does its real run only. [ADR-0051](../../adr/0051-timone-verifies-itself-by-live-gate-and-a-regression-set-is-narrowed-by-what-it-depends-on.md) D4 and [ADR-0059](../../adr/0059-a-live-check-only-the-operator-can-run-rides-to-the-pull-request.md) — decide which checks this phase owes, below. [ADR-0050](../../adr/0050-timone-becomes-a-managed-project-once-the-run-path-is-fixed.md) D5 — this project is Timone, so `process.md` and the skills are its source and are committed here.

> **Screens changed:** none — no slice changes anything a person sees on a screen Timone draws. (The section at the top of a pull request is GitHub text.)

## Requirements

> **PRD:** [prd-07-several-tickets-of-one-project-at-once.md](../../specs/prd/prd-07-several-tickets-of-one-project-at-once.md) — criteria in [prd-07-several-tickets-of-one-project-at-once.criteria.md](../../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-07.R7 | MUST | After a merge, every other open pull request of the project is brought level as soon as a place is free; the whole test suite, its own ticket's check scripts and the merged ticket's check scripts run; code changed for a conflict is described at the top of the pull request; after two failed fixes the top says the work does not pass and the update stops; the default branch never moves and the work is kept |
| PRD-07.R14 | MUST | A pull request that opens behind the default branch is brought level at once, in the same way as after a merge; one that opens level is not |

This is piece 4 of the [list of pieces for #197](../breakdowns/ticket-197.md), approved by fvermaut on 2026-10-04T06:34:53Z with six pieces.

## Goal Description

Pieces 3 and 5 let several tickets of one project build at once and keep their pull requests open at once. Nothing yet brings one of those pull requests level when another merges. The daemon reads only each run's own pull request (`look()` in `src/runner/driver.ts`), so a merge reaches no other run, and the forge adapter cannot say how far a branch is behind the default branch. Until this phase, a person resolves the conflict on the pull request by hand (ADR-0063 and ADR-0065, *Consequences*).

[ADR-0066](../../adr/0066-the-update-is-a-step-the-runner-starts-when-an-open-pull-request-falls-behind.md), recorded while planning this phase, decides the shape. On every poll cycle, code asks the forge, for each run with an open pull request and no step running, how far its branch is behind the default branch and what the default branch's head is. When the branch is behind and the run has not been told of that head, its runner is woken once with that fact. One rule covers both requirements: a merge gives the default branch a new head (R7), and a pull request that opens behind is a run with an open pull request that is behind (R14). The runner starts a new step, `update`. The update session merges the default branch into the branch, gets the three test sets from one Timone command, runs them, and hands every conflict and failing test to a fresh fix context that never opens the probe folders. It allows two fixes at most. It appends an entry to `phase-NN-update.md`, and code puts a section built from that entry at the top of the pull request, above the departures. Only pull requests a run owns are updated: a person's own pull request has no ticket, no plan and no run.

**Decisions taken at planning, below the ADR bar.** Each was checked against the three-part test. None is hard to reverse: each is local to one or two files and covered by tests at a public seam.

- **The adapter method** is `behindDefault(project, branch): Promise<{ behind: number; defaultHead: string } | undefined>`. It makes one `gh api repos/<slug>/compare/<default>...<branch>` call, reading `.behind_by` and `.base_commit.sha` with `--jq`. It answers undefined on the 404 a missing branch gives, as `aheadOfDefault` does, and throws on any other failure.
- **The event and its notice.** `behindEvent(behind, defaultBranch, head)`: `The default branch <default> has moved on: this ticket's branch is <n> commit(s) behind it (<default> is at <short sha>). Start the update: it brings the branch level, fixes what that breaks, and tests it again.` The notice is `branch behind <default> at <sha>, run <id>`, so the run is told once per head.
- **When code looks.** The run is unsettled and has `pr` set, the cycle's thread reader shows that pull request open, no step of this run is running (`this.deps.running`), and the ticket is not held. The same conditions as every other fact: a held ticket is told once the hold comes off. An adapter failure adds one line to `tick`'s errors and notices nothing, so the next cycle asks again.
- **The stage row.** `update: { label: "bringing the work up to date", ownsBranch: true, model: "claude-opus-5-5", effort: "high" }`. It is the same pair as `remediation`, which is the nearest kind of work: changes on a live pull request.
- **The stage is in no default order** (`src/runner/order.ts` is unchanged). It is not in either `BUILDING_STAGES` list (`src/runner/departures.ts`, `src/planner/facts.ts`, `src/planner/driver.ts`) and not in `START_AGAIN`. The update does its own checking, and a run with an update running has an open pull request, which the planner already counts.
- **The probe guard** allows `update` as it allows `verification`: `OWNING_STAGE` becomes a list of two stages, `CHECKING_STAGES`, and the allow reason names the stage.
- **The runner's rule**, under *How you act* in `SYSTEM`: `When you are told that the ticket's branch is behind the default branch, and no step is running, start the update. Start it even while the pull request waits for review. When it ends, start nothing more for it: the top of the pull request says what a person needs to know. When the default branch moves again, you are told again.`
- **The command** is `node dist/cli.js update-checks <project> [--before <commit>] [--json]`, run at the Timone root in the box, against `projects/<project>`. It prints the three test sets: the project's test command (`scripts.test` in `package.json`, or a sentence saying there is none); the check scripts of the branch's own plan; and the check scripts of each plan that arrived on `origin/<default>` since `--before`, which is `HEAD` by default. That is why it runs **before** the merge. A plan's check scripts are found from its *Requirements* table: every `PRD-NN.R<k>` ID, and for each, the file in the project's probe folder whose name is the lowercased ID plus any extension. An ID with no such file is listed as having no check script. For each arrived plan, the command names the pull request when the merge commit's subject ends in `(#<n>)` or starts `Merge pull request #<n>`.
- **The record** is `doc/plans/phases/reports/phase-NN-update.md`, NN being the phase file the branch added. Each update appends one `## Update <k> — <ISO time>` section, holding these lines in this order:
  - `- **Level with:** <default> at <sha>`
  - `- **Arrived:** <phase MM (pull request #n)>, …`
  - `- **Whole test suite:** passed | failed — <one line>`
  - `- **Check scripts of this ticket:** passed — <IDs> | failed — <ID>: <one line> | none — <why>`
  - `- **Check scripts of the work that arrived:** the same three forms`
  - `- **Fixes:** 0 | 1 | 2`
  - `- **Code changed:** none | <plain sentences: what and why>`
  - `- **Result:** passes | does not pass — <the failure>`
- **The section** sits between `<!-- timone:update -->` and `<!-- /timone:update -->`, always first in the body, above the departures. Its heading is `### Brought level with <default>` when the result passes, and `### This work does not pass after being brought level with <default>` when it does not. Then come plain lines: after which pull requests, what code changed and why (or "No code had to change."), and the three test sets with their results. When the newest entry lacks a test-set line, or a set says `failed`, the section reads as not passing, and names the set that did not run or failed. Code never trusts a `Result: passes` line over a missing or failed set.
- **No `STATUS.md`** is written by the update (ADR-0066 D5).

**What this phase owes before delivery** (ADR-0051 D4). The diff touches `src/adapters/ticketing.ts`, `src/adapters/github-tickets.ts`, `src/runner/driver.ts`, `src/runner/brief.ts`, a new `src/runner/update-section.ts`, `src/runner/replay/cases.ts`, `src/daemon/pipeline.ts`, `src/daemon/prompts.ts`, `src/daemon/probeGuard.ts`, a new `src/update-checks.ts`, a new `src/commands/update-checks.ts`, `src/cli.ts`, the test fakes of the ticketing port, a new `.claude/skills/timone-update/`, `.claude/skills/README.md`, `.claude/skills/timone-deliver/SKILL.md`, `process.md`, `CONTEXT.md`, and documents under `doc/`.

- **The regression set**, computed from the registers on 2026-10-05: PRD-05 R2, R3, R4, R5, R7, R10, R11 and R18, and PRD-08.R5 (no `Depends-on`, so always in scope); PRD-07 R1, R2, R3, R4, R6, R9, R10 and R12 (`src/runner/`, `src/daemon/`, `src/adapters/github-tickets.ts`, `process.md`); PRD-08 R1, R2 and R4 (`src/adapters/`).
- **A live gate is owed.** PRD-07.R7 and R14 are this phase's own `live` criteria. The `live` criteria PRD-02 R1, R2, R4, R6, R7 and R8 depend on `src/daemon/`, PRD-03 R1 to R5 on `src/daemon/` and the skills, and PRD-05 R9, R12, R13 and R15 declare nothing. R7's and R14's hints name the gate: on scratch-app, never ivtrends, two test tickets the machine writes that change the same file in two different ways. A named person merges one pull request. The other is brought level, its three test sets run, and its top describes the fix. Then one test is made to fail on purpose, and the top says the work does not pass after two fixes. For R14, one ticket is still building when the other merges, and its pull request is brought level as soon as it opens. The daemon runs on the operator's machine, so by ADR-0059 this rides to the pull request as an unticked check.
- **What no criterion watches.** Four things:
  - that a run with no open pull request is not asked about at all (no compare call, no wake);
  - that the departures block keeps its content and its place directly under the update block, and that a body with no update record is left as it was apart from the departures;
  - that `remediation` and `execution` are still refused the probe folders;
  - that the replay set still chooses the steps it chose.

  The existing tests of those are a hard gate in every slice that touches their files: `src/runner/driver.test.ts`, `src/runner/departures.test.ts`, `src/daemon/probeGuard.test.ts` and `npm run replay`.

**What is not done here.** A person's own pull request is not brought level (ADR-0066 D3). The update does not flip register statuses and does not re-judge the phase: that is the check's job. Refusing GitHub's own "Update branch" call in the forge guard is left until it is seen used (ADR-0066, *Consequences*). Requirement statuses stay `draft`; verification sets them.

## Context & Prerequisites

- **The probe folders are closed to the builder of this phase.** The hook refuses any tool call by an `execution` or `remediation` session whose input contains a probe folder's path, and that includes the text of a file being written. So **no file this phase writes may contain that path as literal text.** Code imports `PROBE_DIRECTORIES` from `src/daemon/probeGuard.ts`. Tests build fixture paths with `join(PROBE_DIRECTORIES[0], …)` in a temporary repository. The new skill names the folder only as "the probe folder the check uses (see `timone-verify`)", and never prints its path. A slice that is refused for this has written the path; it must rewrite the text, never get around the hook.
- **`src/runner/driver.ts`** — `look()` (~473–560): `threads.pullRequest(run.pr)`, `noticed(entries, about)` (~345), the `events` / `notices` pattern, `PLACE_GIVEN_EVENT` / `placeGivenNotice` (~276) as the shape of a once-per-fact event; `held` and `overLimit`; `tick()` collects one error line per run. `rewriteDepartures` (~1025) runs after every step: it records the pull request, then `withDepartures(body, departureSection(...))` and `setPullRequestBody`.
- **`src/runner/departures.ts`** — `DEPARTURES_START` / `DEPARTURES_END`, `withDepartures`, `BUILDING_STAGES` (unchanged).
- **`src/runner/facts.ts`** — `PHASES`, `filesAddedOnBranch(adapter, project, defaultBranch, branch, directory)` (~230); **`src/planner/facts.ts`** — `planOf` (~173) uses it to find the one phase file a branch added.
- **`src/adapters/ticketing.ts`** — the `TicketingAdapter` port; `aheadOfDefault` (~403) is the pattern for `behindDefault`. **`src/adapters/github-tickets.ts`** — `aheadOfDefault` (~538): the compare call, `readBranches` for the default branch's name, 404 read as undefined. Fakes of the port live in several test files and in `src/runner/replay/recording.ts`; `tsc --noEmit` finds each one that must gain the method.
- **`src/daemon/pipeline.ts`** — `PIPELINE_STAGES` (~42), `STAGES` (~154): the compiler forces a row for a new stage. **`src/daemon/prompts.ts`** — `PROMPTED_STAGES` (~18), `stageBody` (~283), `remediationPrompt` (~324) as the nearest model for `updatePrompt`, `outcomeBlock`, `writingBlock`, `reentryBlock`, `ticketBlock`. `stagePrompt` appends the shared blocks. **`src/daemon/probeGuard.ts`** — `BUILD_STAGES`, `OWNING_STAGE`, `probeGuardDecision`. **`src/runner/brief.ts`** — `SYSTEM` (~151).
- **`src/runner/replay/cases.ts`** — the replay set (PRD-05.R18): each case is a moment, a matcher on what the runner's actions did, and the right calls for `--dry`. `pullRequestEvent` and `stepEndedEvent` are imported there; the new case imports `behindEvent`.
- **`src/merge-rules.ts`, `src/commands/merge-file.ts`, `src/cli.ts`** — the shape of a Timone command a box runs, and how it is registered. **`src/merge-rules.git.test.ts`** — the pattern for a test against a real temporary git repository.
- **`src/daemon/container-runtime.ts`** (~547, ~683–710) — the box clones the project, checks out `PROJECT_BRANCH`, and installs the push guard and the merge rules. Nothing there changes: the update's merge already uses Timone's rule, and its push goes to the run's own branch.
- **`.claude/skills/timone-verify/SKILL.md`** — *Red before green*, *The fix loop* and the fix context's brief: the update's instructions follow that shape, with real runs only and a fix context that returns a commit and a few sentences.
- **`.claude/skills/timone-deliver/SKILL.md`** (~187) — the rule that keeps the departures block first and unchanged when delivery refreshes a body; it gains the update block.
- **Standards.** This project has no `doc/standards.md`; the central `standards/typescript.md`, `standards/testing.md` and `standards/code-smells.md` apply: TypeScript strict, vitest, tests at public seams, no test that reaches into a private field. No screen, so no accessibility work.

## Sub-phases

### Sub-phase 50a: An open pull request whose branch falls behind the default branch wakes its runner, once for each new head

**[MODIFY]** `src/adapters/ticketing.ts` — the port gains `behindDefault(project, branch)` as in the Goal Description, with a doc comment naming ADR-0066 D1.
**[MODIFY]** `src/adapters/github-tickets.ts` — implements it with the compare call; one `readBranches` for the default branch's name, as `aheadOfDefault` does.
**[MODIFY]** `src/runner/driver.ts` — `behindEvent` and `behindNotice` exported beside `PLACE_GIVEN_EVENT`. In `look()`, inside `if (!held)`, after the pull-request event: when `pull?.state === "open"`, `run.branch` is set, and no step of this run is running, call `behindDefault`; when `behind > 0` and the notice is not yet in the record, push the event and the notice. `look()` already returns early for an `active` run with no step of this daemon, and that is unchanged.
**[MODIFY]** every fake of the port that `tsc --noEmit` names — the fake answers `{ behind: 0, defaultHead: "…" }` unless a test sets it.
**[MODIFY]** `src/runner/driver.test.ts`, `src/adapters/github-tickets.test.ts` — cases below.

**Seams under test (TDD):** `RunnerDriver.tick(project, config, cycle)` with the fake adapter, fake sessions and real `RunStore` the file already uses: it is the public boundary at which "a merge starts an update on the other pull request" is seen, and R7's *Falsified-by* names a fake forge. `GitHubTicketingAdapter.behindDefault` with the fake command runner the adapter tests already use. Red-green:
1. Two parked runs of one project, each with an open pull request. The first's pull request is merged, and the fake reports the second's branch behind by 2 at head `abc…`. After `tick`, the second run's wake carries `behindEvent(2, "main", "abc…")`, and the first's carries the merge event as before (R7 clause 1).
2. A second `tick` at the same head wakes nobody for it. A third with a new head `def…` wakes the second run again.
3. A run whose pull request has just opened behind (R14 clause 1) is told on the first `tick`. One that opened level (`behind: 0`) is not told, and nothing is noticed (R14 clause 3).
4. A run with a step running is not asked; once the step has ended, the next `tick` tells it.
5. A held ticket is not told; after the hold comes off, it is told.
6. A run with no pull request, or whose pull request is merged or closed, makes no `behindDefault` call.
7. `behindDefault` throws for one run: `tick` returns one error line naming the ticket, the other runs are still looked at, and nothing is noticed for the failed one.
8. The adapter: the `gh api …/compare/main...timone/7-x` call with the `--jq` reading both fields; a 404 answers undefined; another failure throws.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"   # expected 0
npx vitest run src/runner/driver.test.ts src/adapters/; echo "exit: $?"   # expected 0
```

- [ ] Cases 1–8 pass, with red runs recorded in the handoff.
- [ ] Every existing case of `driver.test.ts` passes unchanged (hard gate: what no criterion watches).

---

### Sub-phase 50b: `update` is a step the runner starts, with its own instructions and the check's access to the probe folders

**[MODIFY]** `src/daemon/pipeline.ts` — `"update"` is added to `PIPELINE_STAGES`, after `remediation`, with its `STAGES` row and a comment naming ADR-0066 D2, as in the Goal Description.
**[MODIFY]** `src/daemon/prompts.ts` — `"update"` is added to `PROMPTED_STAGES`; `stageBody` gains `case "update": return updatePrompt(context)`. `updatePrompt` follows `remediationPrompt`'s shape:
- the ticket block and the re-entry block;
- `**Stay on the branch <branch>**` — the pull request's head;
- `Bring this branch level with the default branch, by following the update instructions in .claude/skills/timone-update/SKILL.md to the letter.`;
- `Merge the default branch into the branch; never rebase, never force-push, and never merge the pull request.`;
- `outcomeBlock` with two endings. **Done:** the record entry is committed and pushed, whatever the result; follow it with the result in one sentence. **Stopped:** the branch or the pull request is not what the run says; follow it with what was found;
- `writingBlock()`.

Every other place that switches on a stage is found by `tsc --noEmit` and given the answer of the Goal Description.
**[MODIFY]** `src/daemon/probeGuard.ts` — `CHECKING_STAGES = ["verification", "update"]` replaces `OWNING_STAGE`; both are allowed, and the reason names which stage is allowed. `BUILD_STAGES` is unchanged.
**[MODIFY]** `src/runner/brief.ts` — `SYSTEM` gains the rule of the Goal Description, under *How you act*, after the rule on a run that waits on its pull request.
**[MODIFY]** `src/runner/replay/cases.ts` — one new case. A parked run whose pull request is open and has no review comment is woken by `behindEvent(3, "main", <sha>)`. The matcher passes when a step at `update` started, and when nothing asks a person for anything. The right call is `start_step({ stage: "update", … })`.
**[MODIFY]** `src/daemon/pipeline.test.ts`, `src/daemon/prompts.test.ts`, `src/daemon/probeGuard.test.ts`, `src/runner/brief.test.ts`, `src/runner/actions.test.ts` — cases below.

**Seams under test (TDD):** `stagePrompt("update", context)` — pure, and the only text the step starts from. `probeGuardDecision` — pure. `stageLabel`, `ownsBranch`, `modelFor` — the stage's public table. `runnerActions(deps, run).startStep({ stage: "update" })` in `src/runner/actions.test.ts` — the action every step goes through. The replay harness's `--dry` run for the new case. Red-green:
1. `ownsBranch("update")` is true, `modelFor` and `effortFor` answer the row, and `stageLabel` is `bringing the work up to date`.
2. `stagePrompt("update", …)` names the branch, names `.claude/skills/timone-update/SKILL.md`, says merge and never rebase, and carries the shared blocks (provenance, checkout).
3. `probeGuardDecision` with a probe path: `allow` at `update` and at `verification`, `deny` at `execution` and `remediation` (unchanged), `ask` with no stage (unchanged).
4. `startStep({ stage: "update" })` on a run with a branch and an open pull request, and no planner decision: it is not refused for want of one; it takes a place through `askPlace`; it starts on the run's own branch. With every place taken, it is refused for want of a place, as any step is.
5. `buildBrief`'s system text carries the new rule.
6. `npm run replay -- --dry` passes every case, the new one included.

> No dependency on other sub-phases. It shares no file with 50a.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"   # expected 0
npx vitest run src/daemon/ src/runner/; echo "exit: $?"   # expected 0
npm run replay -- --dry; echo "exit: $?"   # expected 0 — every case's right calls play through the real tools
npm run replay; echo "exit: $?"   # expected 0 — PRD-05.R18's replay set on the real model, the new case included
```

- [ ] Cases 1–6 pass, with red runs recorded.
- [ ] `probeGuard.test.ts`'s existing deny cases pass unchanged (hard gate).
- [ ] The real replay passes. If a recorded case changed its choice, the handoff says which case and what changed.

---

### Sub-phase 50c: `update-checks` says which three test sets an update runs

**[NEW FILE]** `src/update-checks.ts` — three parts:
- `claimedRequirements(phaseText): string[]` — pure. It returns every `PRD-NN.R<k>` in the first column of the *Requirements* table, in order, without repeats.
- `checkScriptOf(id, files): string | undefined` — pure. It returns the file in `files` that lies directly in `PROBE_DIRECTORIES[0]` and whose name, without its extension, is the lowercased ID.
- `updateChecks(git, { defaultBranch, before }): UpdateChecks` — `git` is a small port that runs a git command in the project and returns its output. It works in four steps:
  1. The branch's own plan is the phase file that `git diff --name-only --diff-filter=A origin/<default>...<before>` adds under `doc/plans/phases/`.
  2. The arrived plans are the phase files that `git diff --name-only --diff-filter=A <before>...origin/<default>` adds there.
  3. Each plan's text comes from `git show <ref>:<path>`. The files come from `git ls-tree -r --name-only` of both `<before>` and `origin/<default>`.
  4. Each arrived plan's pull request is read from `git log --first-parent --format=%s <before>..origin/<default>`.
- The result: `{ testCommand: string | undefined; own: PlanChecks | undefined; arrived: PlanChecks[] }`, where `PlanChecks = { phase: string; pullRequest?: number; checks: { id: string; script?: string }[] }`.

**[NEW FILE]** `src/commands/update-checks.ts` — `registerUpdateChecksCommand(program)`: `update-checks <project> [--before <commit>] [--json]`. It resolves `projects/<project>` from the manifest as `src/commands/number.ts` does, and reads the default branch from `git symbolic-ref --short refs/remotes/origin/HEAD`. `testCommand` comes from `scripts.test` in `package.json`; when there is no such script, the command prints a sentence saying so. The plain output is one block per set: the test command, then each ID with its script or `no check script`. It exits 2 with a readable sentence on an unknown project or a git failure.
**[MODIFY]** `src/cli.ts` — registers it.
**[MODIFY]** `src/guards/checkouts.test.ts` — `GIT_USERS` gains `commands/update-checks.ts`, with its reason: it runs read-only git in the project's checkout it is pointed at, from a session in the box, never from the daemon. ✏ 2026-10-05 (build, timone#202): added at the close. The whole suite failed on this guard, which lists every source file that runs git; the plan did not grant it to any slice. See `reports/phase-50-departures.md`.
**[NEW FILE]** `src/update-checks.test.ts`, `src/update-checks.git.test.ts` — cases below.

**Seams under test (TDD):** `claimedRequirements` and `checkScriptOf` are pure. `updateChecks` against a real temporary repository with a bare `origin`, as `src/merge-rules.git.test.ts` builds one: the observable end is the three sets the command prints, which is what R7 clause 2 asks the update to run. Red-green:
1. A plan whose table claims `PRD-07.R7` and `PRD-07.R14`, plus a `PRD-01.R4` mentioned only in prose: two IDs.
2. `checkScriptOf("PRD-07.R7", [<probe dir>/prd-07.r7.mjs, <probe dir>/prd-07.r70.mjs, other/prd-07.r7.mjs])` returns the first and only the first.
3. A branch that added `phase-50.md` claiming R7 and R14, an `origin/main` that has since gained `phase-49.md` claiming R5 and R6 through a commit `feat: phase 49 — … (#215)`, and probe files for R7, R5 and R6: `own` is phase 50 with R7 scripted and R14 without; `arrived` is phase 49, pull request 215, with both scripted.
4. The same after merging `origin/main` into the branch, with `--before` set to the branch's commit before the merge: the same answer. With no `--before` after the merge: `arrived` is empty, and the command still runs.
5. A branch that is level: `arrived` is empty.
6. A project with no `scripts.test`: `testCommand` is undefined, and the plain output says there is no test command.
7. An unknown project: exit 2, with a sentence naming the valid projects.

> No dependency on other sub-phases. It shares no file with 50a or 50b.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"   # expected 0
npx vitest run src/update-checks.test.ts src/update-checks.git.test.ts src/cli.test.ts; echo "exit: $?"   # expected 0
npm run build && node dist/cli.js update-checks no-such-project; echo "exit: $? (expected 2)"
```

- [ ] Cases 1–7 pass, with red runs recorded.
- [ ] No file this slice wrote contains a probe folder's path as text: it is built from `PROBE_DIRECTORIES`.

---

### Sub-phase 50d: The update's record becomes a section at the top of the pull request, above the departures

**[NEW FILE]** `src/runner/update-section.ts`:
- `UPDATE_START = "<!-- timone:update -->"` and `UPDATE_END = "<!-- /timone:update -->"`.
- `latestUpdate(recordText): UpdateEntry | undefined` — pure. It reads the newest `## Update` section into its fields. A field that is missing is undefined, never guessed.
- `updateSection(entry, defaultBranch): string` — pure. It writes the section of the Goal Description and decides "passes" only when the whole test suite and both check-script sets are present and none says `failed`.
- `withUpdate(body, section): string` — pure. It removes any earlier block and puts this one first.

**[MODIFY]** `src/runner/driver.ts` — `rewriteDepartures` becomes `rewriteDescription`. After the departures are placed, it finds the branch's phase with `filesAddedOnBranch(…, PHASES)`, as `planOf` does; with none, or more than one, there is no update section. It reads `doc/plans/phases/reports/phase-NN-update.md` on the branch through `adapter.readFile`. When the file has an entry, the body becomes `withUpdate(withDepartures(body, departures), updateSection(entry, defaultBranch))`. It writes the body only when it changed.
**[MODIFY]** `src/runner/driver.test.ts`; **[NEW FILE]** `src/runner/update-section.test.ts` — cases below.

**Seams under test (TDD):** the three pure functions; and `RunnerDriver`'s handling of a step's end, with the fake adapter holding a pull request body and the record file on the branch, as the departures cases already do. Red-green:
1. An entry with every line, `Code changed:` naming one file and why, and every set passed: the section's heading is `Brought level with main`, it names the arrived pull request and says what changed and why (R7 clause 3).
2. `Code changed: none` gives `No code had to change.`.
3. A `Result: does not pass — <failure>` entry with `Fixes: 2` and the whole test suite failed: the heading says the work does not pass, and the failure is named in the first lines (R7 clause 4).
4. An entry without the line for the check scripts of the work that arrived, and `Result: passes`: the section says that set did not run, and the heading says the work does not pass (R7 clause 2).
5. `withUpdate` on a body that has the departures block and text below it: the update block comes first, then the departures block, unchanged, then the text. Run twice: the second run changes nothing.
6. After an `update` step ends on a run whose branch carries `phase-50.md` and `reports/phase-50-update.md`: the pull request body starts with the update block, and the departures block and the delivery text follow unchanged.
7. After a step on a run with no update record: the body is what `withDepartures` alone gives, the same as before this phase (hard gate: existing departures cases unchanged).
8. Two entries in the record: only the newest is shown.

> Sub-phase 50a must be complete before starting this sub-phase (both change `src/runner/driver.ts` and `driver.test.ts`).

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"   # expected 0
npx vitest run src/runner/; echo "exit: $?"   # expected 0
```

- [ ] Cases 1–8 pass, with red runs recorded.
- [ ] `src/runner/departures.test.ts` passes unchanged (hard gate).

---

### Sub-phase 50e: The update's instructions — merge, three test sets, two fixes by a fresh context, one record entry

No behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based. The instructions are watched in R7's and R14's live gate.

**[NEW FILE]** `.claude/skills/timone-update/SKILL.md` — frontmatter as `.claude/skills/README.md` requires (`name: timone-update`; a description saying it brings an open pull request of a managed project level with its default branch after another pull request merged, or when it opened behind, and that the runner starts it; `argument-hint: <project-name> <ticket>`). The target-project preamble. Then the procedure, in order:
1. **Read** the branch's own phase file, the record file if it exists, and the project's standards. Never read code diffs or the probe folder's contents; *run* the scripts only.
2. `git fetch origin`. Note the branch's commit as `<before>`, then run `node dist/cli.js update-checks <project> --before <before>` at the Timone root and keep its output.
3. **Merge** `origin/<default>` into the branch (`git merge --no-edit`). Never rebase, never force-push, never use GitHub's "Update branch". `STATUS.md` and the registers are merged by Timone's rule. A conflict left in any file goes to a **fresh fix context**: a sub-agent given the conflicted files, both plans (own and arrived), and the standards, told never to open the probe folder (named only as "the folder the check keeps its scripts in"). It resolves the conflict and finishes the merge commit, and returns the commit and two or three plain sentences on what it changed and why. A conflict fix is not counted as one of the two fixes.
4. **Run the three sets**: the whole test suite once, and each listed check script, real run only (ADR-0061 D1), run as the check runs a script (`timone-verify`). A requirement with no script is written as such, never invented.
5. **A failing test or script** goes to a fresh fix context, with the failure output, the test or criterion name, and the same plans and standards. It commits `fix: update — <slug>` and returns the commit and a few sentences. Then run again what failed and what the fix's changed file names can affect (`git show --name-only --format=`). **Two fixes at most.** After the second, if anything still fails, stop fixing.
6. **Append the entry** to `doc/plans/phases/reports/phase-NN-update.md`, in the exact form the plan's Goal Description gives, which the skill copies. `Code changed:` says in plain words what each fix context changed and why, and `none` when nothing was. Commit it as `docs: update NN — level with <default>`, and push the branch. Never write `STATUS.md`, never change a register status, never edit the pull request body: code writes the section from the entry.
7. **Ask nobody anything.** A result that does not pass is said in the entry; the person decides on the pull request.

The commit trailers follow the session's prompt.
**[MODIFY]** `.claude/skills/README.md` — one line that says `timone-update` is not a stage of its own: it is a step of an open pull request, defined in `process.md` stage 8's note, and started by the runner. It commits a merge, fixes and its record on the run's branch.

> Sub-phases 50c and 50d must be complete before starting this sub-phase (the instructions quote the command's name and options and the record's form, both of which those slices fix).

#### Agent Validation Steps

```bash
test -f .claude/skills/timone-update/SKILL.md; echo "exit: $? (expected 0)"
grep -c "update-checks" .claude/skills/timone-update/SKILL.md   # expected 1 or more
grep -n "rebase" .claude/skills/timone-update/SKILL.md   # expected: only lines that forbid it
npx vitest run src/daemon/prompts.test.ts; echo "exit: $?"   # expected 0 — the prompt still names this file
```

- [ ] Every line of the record's form in the skill is the same as in this plan's Goal Description and in what `latestUpdate` reads (50d).
- [ ] The skill does not contain a probe folder's path as text.
- [ ] Plain words; no metaphor.

---

### Sub-phase 50f: The words that describe the update are written where the process and the glossary say what a pull request goes through

No behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based.

**[MODIFY]** `process.md` — stage 8's note gains one dated paragraph (`✏ 2026-10-05 ([ADR-0066](…))`). It says: while a pull request is open, when the default branch moves past its branch, or it opens behind, the runner starts the update (`timone-update`). The update merges the default branch in, runs the whole test suite and the check scripts of both tickets, fixes at most twice through a fresh context, and its section is written by code at the top of the pull request, above the departures. Only pull requests a run owns are updated.
**[MODIFY]** `.claude/skills/timone-deliver/SKILL.md` — the rule on the departures block (~187) gains a dated sentence: the block between `<!-- timone:update -->` and `<!-- /timone:update -->`, when present, comes first, above the departures block, and is kept unchanged in the same way.
**[MODIFY]** `CONTEXT.md` — the **Update** entry adds: it is a step, so it takes a place; the runner starts it when told the branch is behind the default branch; it also runs when a pull request opens behind.
**[MODIFY]** `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.md` — the `Phases:` line adds `[phase 50](../../plans/phases/phase-50.md) (piece 4, #202)`.

> Sub-phases 50a–50e must be complete before starting this sub-phase (the words describe what the code and the instructions now do).

#### Agent Validation Steps

```bash
grep -n "ADR-0066" process.md .claude/skills/timone-deliver/SKILL.md CONTEXT.md; echo "exit: $? (expected 0, each file listed at least once)"
grep -n "phase-50" doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.md; echo "exit: $? (expected 0)"
```

- [ ] No requirement's `Status:` line changed.
- [ ] Plain words in every note: no metaphor, no process jargon.

## Questions that came up while building, and the choice made

✏ 2026-10-05 (build, timone#202): the runner asked that questions be written here with the choice made, and the build carried on. Each is for the person who reviews the pull request.

1. **A project with no test command.** The record's line for the whole test suite allows only `passed` or `failed`, and code reads anything else as "did not run". **Choice:** the instructions write `none — the project has no test command`, and the result `does not pass`. Such a project's update always shows as not passing. Timone, ivtrends and scratch-app all have a test command today. *Question:* should a project with no test command count as passing on the other two sets?
2. **A branch that is already level when the update starts.** **Choice:** the update writes no entry and commits nothing, and ends with the ending for "the branch is not what the run says", saying it already holds the default branch. *Question:* is that ending right, or should it end as done with no entry?
3. **How a check script is found.** `update-checks` finds a requirement's check script by its file name: the lowercased ID plus an extension, as this plan says. The builder may not open the probe folder, so this was not checked against the real files. **Choice:** built as planned. The check should confirm that real check scripts are named this way.
4. **A forge failure while reading the update record.** **Choice (50d):** the whole description write for that step is skipped and logged, departures included; the next step's end writes it again. *Question:* should the departures still be written when only the update record could not be read?

## Dependency graph

```
50a → (none)          behind the default branch: the forge call, the event, told once per head
50b → (none)          the update stage: row, prompt, probe access, the runner's rule, a replay case
50c → (none)          update-checks: the three test sets from the branch and the default branch
50d → 50a             the record's newest entry becomes the section at the top of the pull request
50e → 50c, 50d        the update's instructions, quoting the command and the record's form
50f → 50a–50e         process.md, the delivery instructions, CONTEXT.md and PRD-07's phase list
```

50a, 50b and 50c share no file and may start together. 50d follows 50a, because both change `src/runner/driver.ts`. 50e waits for 50c and 50d. Commits are still made one at a time, because every slice appends to `phase-50-handoffs.md`.
