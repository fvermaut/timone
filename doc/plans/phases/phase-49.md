# Phase 49: Two places and the planner — the number of places from `timone.yaml`, every unblocked step picked up, no branch cut from another ticket's, and a planner that decides from each plan which ticket may build

> **Status:** Complete — see [reports/phase-49-complete.md](reports/phase-49-complete.md).

> **Companion phases:** [phase 47](phase-47.md) — piece 3 of the same list, merged; it built the places in the ledger (`askPlace`, `givePlaces`, `placeHolders`, `waitingForPlace`) with `PLACES_PER_PROJECT = 1`, which 49a replaces, and it left PRD-02.R22 clause 1 and PRD-05.R15 clause 2 to this piece. [phase 44](phase-44.md) — piece 1, merged; this phase and ADR-0065 took their numbers through `number`, and 49c extends the push guard that phase 44 taught to allow reservations. [phase 45](phase-45.md) — piece 6, merged; the `Needs:` relations it writes are the `blocked by` relations 49b relies on. [phase 48](phase-48.md) — piece 2, merged; `STATUS.md` and the registers are brought level by it, so two tickets building at once no longer conflict there. Piece 4 ([#202](https://github.com/fvermaut/timone/issues/202), the update after a merge) has no phase file yet; the list lets it be built at the same time as this piece. It will touch `src/runner/` and `src/daemon/`; the two pull requests may need bringing level by hand, whichever merges second. Governing decisions: [ADR-0065](../../adr/0065-the-planner-is-a-session-of-its-own-asked-when-a-build-would-start.md) — recorded while planning this phase; D1 is 49f, D2 is 49d, D3 is 49e, D4 and D5 are 49f, D6 is 49a to 49c, D7 is 49h. [ADR-0063](../../adr/0063-a-ticket-takes-a-place-only-while-one-of-its-steps-runs.md) — how a place is taken and given; this phase changes only how many there are, and the planner uses the same order for who is decided first. [ADR-0060](../../adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md) — code tells facts, an agent judges, code checks; the planner follows the same shape, and its D6 is the rule for who may overrule. [ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) — the hold label and the `blocked by` relation decide which steps may be picked up; 49b keeps all four conditions and drops only "the first". [ADR-0041](../../adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md) — a box clones the default branch, which is why 49c can tell another ticket's commits apart. [ADR-0051](../../adr/0051-timone-verifies-itself-by-live-gate-and-a-regression-set-is-narrowed-by-what-it-depends-on.md) D4 and [ADR-0059](../../adr/0059-a-live-check-only-the-operator-can-run-rides-to-the-pull-request.md) — decide which checks this phase owes, below. [ADR-0050](../../adr/0050-timone-becomes-a-managed-project-once-the-run-path-is-fixed.md) D5 — this project is Timone, so `process.md` and the skills are its source and are committed here.

> **Screens changed:** none — no slice changes anything a person sees on a screen Timone draws. (`timone status` is terminal text; ticket comments are GitHub text.)

## Requirements

> **PRD:** [prd-07-several-tickets-of-one-project-at-once.md](../../specs/prd/prd-07-several-tickets-of-one-project-at-once.md) — criteria in [prd-07-several-tickets-of-one-project-at-once.criteria.md](../../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-07.R2 | MUST | **The number of places** (clauses 1 and 2): 2 when `timone.yaml` sets none, N when it sets N; and clauses 3 and 4 seen with more than one place |
| PRD-07.R4 | MUST | A ticket that needs another's unmerged work does not build; every work branch is cut from the default branch; two unblocked steps of one initiative build at once; a blocked step does not start |
| PRD-07.R5 | MUST | No build starts without a decision of the planner recorded after the plan was committed; a small overlap builds at once, a large one waits; a held ticket is decided again when what it waits for merges or closes, and its plan is not rewritten |
| PRD-07.R6 | MUST | A held ticket is told in plain words which ticket it waits for and why; a named person's comment can make it build, and the ticket is told so; anyone else's changes nothing |
| PRD-07.R12 | MUST | **For what this piece changes:** PRD-02.R22 clause 1 and PRD-05.R15 clause 2 carry a dated note naming the PRD-07 requirement that changes them |

This is piece 5 of the [list of pieces for #197](../breakdowns/ticket-197.md), approved by fvermaut on 2026-10-04T06:34:53Z with six pieces.

## Goal Description

Piece 3 left every project with **one** place (`PLACES_PER_PROJECT` in `src/daemon/runs.ts`), so one ticket of a project still builds at a time. The daemon also still picks up only the **first** open, unblocked step of an initiative (`nextStep` in `src/daemon/steps.ts`). Nothing decides whether two tickets that change the same files should build at once, because until now they never could. The list of pieces puts the second place and the planner in one piece for that reason: a second place without the planner lets two tickets that change the same files build at once on every project.

[ADR-0065](../../adr/0065-the-planner-is-a-session-of-its-own-asked-when-a-build-would-start.md), recorded while planning this phase, decides how the planner runs. It is a session of its own for one project, on the host like the runner, one at a time per project and one ticket per session. It is asked when a runner tries to start the build and the run has no decision yet: that try is refused, and the run waits for the planner. Code gives it the files each plan names, the files each open pull request changes, and which tickets are building; it judges, and answers `let_build`, `hold` or `pass_to_runner`. Code writes the hold comment, so the ticket waited for is always named. A held run is asked about again when nothing it waits for is still building or open. While a run waits for the planner, a named person's comment on its ticket goes to the planner, which can let it build on that comment; code checks the comment is a named person's. The planner takes no place, and its cost counts on the ticket it decided for.

The rest of the piece is small and code-only: `places` in `timone.yaml` (absent means 2), every unblocked step picked up, and the push guard refusing a work branch that carries another ticket's unmerged commits (R4 clause 2, which today rests only on the words of the step's prompt).

**Decisions taken at planning, below the ADR bar.** Each was checked against the three-part test; none is hard to reverse, since each is local to one or two files and covered by tests at a public seam.

- **The key is `places`**, a positive whole number on a project's entry. `DEFAULT_PLACES = 2` and `placesOf(config)` sit in `src/manifest.ts` beside `ticketLimitOf`. R2's hint leaves the name to the build.
- **`RunStore` is told the number per project**, through a new option `placesOf: (project: string) => number` on `RunStore.open`, defaulting to `DEFAULT_PLACES` for every project. Every opener outside tests that has the manifest passes it: `src/commands/daemon.ts`, `cancel.ts`, `takeover.ts`, `status.ts`, `guardrails.ts` (both). Each of them can free a place, and a freed place given by the wrong number is a step too many. `PLACES_PER_PROJECT` is deleted; `placeOf` in `src/runner/session.ts` asks the store (`store.placesOf(project)`).
- **The planner's decision lives on the run in the ledger**, as `planner?: { askedAt?: string; decision?: { kind: "build" | "hold"; at: string; reason: string; waitsFor?: number[]; onComment?: { by: string; at: string } } }`. Optional, so every older ledger loads unchanged. `askedAt` set and no `decision` means the run waits for a decision; `decision.kind === "hold"` means held; `decision.kind === "build"` means let build. The ledger is what the action and the planner's loop read. The run record gets two new entries for history and cost: `planner-decision` (`at`, `runId`, `kind`, `reason`, `waitsFor?`, `onComment?`) and `planner-ended` (`at`, `runId`, `ok`, `costUsd`, `error?`). `spentOn` in `src/runner/limit.ts` adds `planner-ended` costs.
- **Only `execution` asks for a decision.** The refusal words: `The planner has not decided yet whether this ticket may be built now: it looks at what else on <project> is being built. This ticket now waits for its decision, and you are woken when it has decided.` For a held run: `The planner holds this ticket until #<n> is merged or closed: <reason>. You are woken if that changes.` Asked before `askPlace`, so a run waiting for the planner does not also wait for a place.
- **The plan's files are read from its file markers**: every backticked path following `**[NEW FILE]**`, `**[MODIFY]**` or `**[DELETE]**` on a line, deduplicated, in order. One pure function, `planFiles(text)`, in `src/planner/plan-files.ts`. A ticket's plan is the phase file its branch added under `doc/plans/phases` (the same rule as `addedOn` in `src/runner/facts.ts`, which is moved to a shared export rather than copied; phase 44 says no code may take "the highest number on the branch").
- **The files a pull request changes** come from one new adapter method, `listPullRequestFiles(project, pr): Promise<string[]>`: `gh pr view <n> --repo <slug> --json files`, the `path` of each. It throws on a forge failure.
- **The planner's model and bounds** are the runner's model and effort, `maxTurns: 12`, `maxBudgetUsd: 2`, and the runner's 10-minute timeout. Its tools are an in-process MCP server named `planner`, built as `runnerToolServer` is: `let_build({ ticket, reason, commentAt? })`, `hold({ ticket, waitsFor: number[], reason })`, `pass_to_runner({ ticket, commentAt })`, `read_plan({ ticket })`.
- **The comments code posts**, each through the 🤖 header the runner's comments use, under 150 words:
  - hold: `**This ticket waits for #<n> before it is built.** <reason> I will look again when #<n> is merged or closed.` then `What I need from you: nothing. If it should be built now anyway, say so here.` (several tickets: `#<n> and #<m>`);
  - let build on a comment: `**I am building this ticket now, on <login>'s comment.** It starts as soon as a place on the project is free.` then `What I need from you: nothing.`
  - a plain `let_build` with no comment posts nothing: the runner's own step comments follow at once.
- **The runner is woken by the decision** with `plannerLetBuildEvent(reason, onComment?)`, once per decision, noticed as `planner let build at <at>, run <id>`. A hold does not wake it. Its brief gains one fact line (`- The planner: not asked yet / deciding / holds this ticket until #<n> is merged or closed: <reason> / let this ticket be built at <at>`) and one rule under *How you act*: the build needs the planner's decision; while it decides or holds, do not start the build and do not say on the ticket that the work has started.
- **A comment passed to the runner** is delivered as the comment event it would have been: the planner's `pass_to_runner` writes a notice `passed to runner: comment at <at>`, and the runner's driver delivers, for a run waiting for the planner, only comments so passed.
- **What "building" means in the facts**: another live run of the project (not `done`, not `cancelled`) with a let-build decision and no pull request, or `active` at `execution`, `verification`, `delivery` or `remediation`. **"Has an open pull request"**: a live run with `pr` set whose pull request the cycle's thread reader shows open. A held run is decided again when, for every ticket it waits for, neither is true.
- **The blockers in the facts** come from the cycle's survey of initiatives: a step ticket's `blockedBy`. An ordinary ticket has none known; the planner reads its plan when the plan says it needs another ticket's work.
- **The push guard's new check runs only on the first push of the work branch** (the remote has no such branch yet): `git rev-list <localSha> --not refs/remotes/origin/<default>` gives the branch's own commits, and a commit among them that `git branch -r --contains` finds on another `origin/timone/*` branch refuses the push. The default branch is `git symbolic-ref --short refs/remotes/origin/HEAD`. The pure part, `foreignCommits(own, containedBy)`, is in `src/daemon/push-guard.ts`; the git calls are in `guardrails pre-push`. A failure to run git refuses the push, as every error of that command already does.
- **`timone status`** adds one line per project when a run waits for the planner or is held: `planner: deciding #12; holds #9 until #7`.
- **ivtrends gets two places too, by the requirement's default.** This phase does not set `places` on any project in `timone.yaml`. Whether ivtrends should be set to 1 until the live gate on scratch-app has passed is the operator's call when merging; the pull request says so.

**What this phase owes before delivery** (ADR-0051 D4). The diff touches `src/manifest.ts`, `src/daemon/runs.ts`, `src/daemon/steps.ts`, `src/daemon/poll.ts`, `src/daemon/push-guard.ts`, `src/runner/actions.ts`, `src/runner/driver.ts`, `src/runner/session.ts`, `src/runner/brief.ts`, `src/runner/facts.ts`, `src/runner/record.ts`, `src/runner/limit.ts`, `src/runner/replay/recording.ts`, a new `src/planner/`, `src/adapters/ticketing.ts`, `src/adapters/github-tickets.ts`, `src/commands/daemon.ts`, `status.ts`, `cancel.ts`, `takeover.ts`, `guardrails.ts`, `process.md`, `.claude/skills/timone-plan/SKILL.md`, `CONTEXT.md`, and documents under `doc/`. The regression set is: PRD-01.R2 (`src/manifest.ts`); PRD-05 R2, R3, R4, R5, R7, R10, R11 and R18 and PRD-08.R5 (no `Depends-on`, so always in scope); PRD-07 R1, R3, R9, R10 and R13; PRD-08 R1, R2 and R4. **PRD-07.R2 is changed by this phase** (clauses 1 and 2 are built, clauses 3 and 4 now hold with two places); its probe `prd-07.r2.mjs` checks one place, so verification must amend that probe; the builder may not read it. **A live gate is owed**: PRD-07.R5 is this phase's own `live` criterion, and the `live` criteria PRD-02 R1, R2, R4 and R8 depend on `src/daemon/`, PRD-01.R10 on `.claude/skills/timone-plan/`, and PRD-05 R9, R12, R13 and R15 declare nothing. R5's hint names it: on scratch-app, never ivtrends, three test tickets the machine writes — two whose plans change most of the same files, one that changes none of them — and the planner must let one of the first two and the third build at once and hold the other, with a comment that names the ticket it waits for. The daemon runs on the operator's machine, so by ADR-0059 this rides to the pull request as an unticked check. **What no criterion watches:** that a run still ends only on a merged pull request or a named person's stop (`endRun`); that the order of a freed place (ADR-0063 D3) still holds with more than one place; that a held ticket (`timone:held`) and a ticket over its spending limit start no planner session; and that the replay set still chooses the steps it chose. The existing tests of those — `endRun` in `src/runner/actions.test.ts`, the place-order cases in `src/daemon/runs.test.ts`, the frontier tests in `src/daemon/steps.test.ts`, and `npm run replay` — are a hard gate in every slice that touches their files.

**What is not done here.** The update after a merge, and bringing a held ticket's branch level before its build, are piece 4 (R7, R14). A limit on pull requests waiting for a person, and a total limit across projects, are out of scope in PRD-07. Requirement statuses stay `draft`; verification sets them.

## Context & Prerequisites

- **`src/manifest.ts`** — `projectConfigSchema` (strict: an unknown key is refused, so `places` must be declared), `ticketLimitOf(config)` as the pattern for `placesOf`, `namedPeople(manifest, name)`.
- **`src/daemon/runs.ts`** — `PLACES_PER_PROJECT` (line 53, used at `placeTakenFrom` ~1397 and `givePlaces` ~1414); `RunStoreOptions` and `static open(path, options)` (~611); `askPlace`, `giveBack`, `leaveTurn`, `regivePlaces`, `waitingForPlace`, `placeHolders`; `runSchema` with `place?` and `takenOver?` as the pattern for an optional field that older ledgers lack; `liveRunForTicket`, `runsForTicket`.
- **`src/daemon/steps.ts`** — `nextStep(steps)`: the four conditions (open, not `timone:held`, no assignee, no open or incomplete blocker) and "the first". **`src/daemon/poll.ts`** — `surveyInitiatives` (~996) builds `Frontier { isStep, isNext }` and `store.rememberInitiative({ … next, nextTitle })`; `pollProject` (~1076) skips a step that is not next, then registers, then calls `runner.tick(project, config, { tickets, isStep, threads })`.
- **`src/daemon/push-guard.ts`** — `pushRefusal(updates, workBranch)` is pure; `RefUpdate` carries `localSha` and `remoteSha` (all zeros on the remote means the branch is new there). **`src/commands/guardrails.ts`** — `guardrails pre-push` (~475) reads stdin and calls `pushRefusal`; every error refuses the push.
- **`src/runner/actions.ts`** — `startStep` (~789): the stage check, `readTicketRecord`, `stepBlocked`, `skippedBy`, then `askPlace` (~820), then `branchFor`. `namedPersonsComment(commentAt, onlyNamed)` (~567) is the check D5 reuses: a non-Timone comment on the ticket with that exact `createdAt`, by a named person. `decided(...)` (~693) writes a `decision` entry for every action.
- **`src/runner/driver.ts`** — `look()` (~440–536): `newComments` (~684) filters by `isNamedPerson`; `PLACE_GIVEN_EVENT` and `placeGivenNotice` are the pattern for a once-per-decision event; the at-limit branch, where a comment goes to a consult and not the runner, is the pattern for a comment routed elsewhere.
- **`src/runner/session.ts`** — `wakeRunner` (~190), `converse` (~336: SDK `query` with an in-process MCP server, `tools: []`, `settingSources: []`, `cwd: runnerDirectory(root)`, budget, turns, timeout), `RunnerSessions` (~740: one wake per run at a time, retries when the model cannot be reached), `placeOf` (~612). **`src/runner/tools.ts`** — `runnerToolServer` (~243) and how a refusal returns `isError` with `Refused: …`. **`src/runner/brief.ts`** — `SYSTEM`, `factsSection`, `placeText` (~398), `isNamedPerson` (~121). **`src/runner/facts.ts`** — `addedOn` (~225). **`src/runner/comments.ts`** — `NEEDED_FROM_YOU`, `joined`, `departureNotice` as the shape of a comment. **`src/runner/record.ts`** — `recordEntrySchema` (~47), `appendEntry`, `readRecord`; records live at `.timone/records/<project>/<ticket>.jsonl`. **`src/runner/limit.ts`** — `spentOn` (~20).
- **`src/runner/replay/`** — `recording.ts` opens a `RunStore` per case; `cases.ts` has two cases (~602, ~694) judged on the runner choosing `execution` first. With 49d those tries would be refused, so the replay's ledger must hold a let-build decision for its runs.
- **`src/adapters/ticketing.ts`** — the `TicketingAdapter` port (`listFiles`, `readFile`, `findPullRequest`, `findOpenPullRequestOfTicket`); fakes of the port live in several test files and in `src/runner/replay/recording.ts`, and `tsc --noEmit` finds each one that must gain the new method. **`src/adapters/github-tickets.ts`** — `PR_FIELDS`, the `gh` call pattern.
- **`src/commands/daemon.ts`** — opens the store (~631), calls `regivePlaces` (~443), builds `RunnerSessions` (~706) and the driver; this is where the planner's sessions and driver are built and handed to the poll.
- **Standards.** This project has no `doc/standards.md`; the central `standards/typescript.md`, `standards/testing.md` and `standards/code-smells.md` apply: TypeScript strict, vitest, tests at public seams, no test that reaches into a private field. No screen, so no accessibility work.

## Sub-phases

### Sub-phase 49a: Each project has the number of places `timone.yaml` sets, and 2 when it sets none

**[MODIFY]** `src/manifest.ts` — `projectConfigSchema` gains `places: z.number().int().min(1, "must be 1 or more").optional()`, with a doc comment naming PRD-07.R2 and ADR-0065 D6; `export const DEFAULT_PLACES = 2`; `export function placesOf(config: ProjectConfig): number`.
**[MODIFY]** `src/daemon/runs.ts` — `PLACES_PER_PROJECT` is deleted. `RunStoreOptions` gains `placesOf?: (project: string) => number` (default: `() => DEFAULT_PLACES`); a public `placesOf(project)` answers it. `placeTakenFrom` and `givePlaces` read it. Doc comments that say "one place" are corrected.
**[MODIFY]** `src/runner/session.ts` — `placeOf` reads `deps.store.placesOf(run.project)`.
**[MODIFY]** `src/commands/daemon.ts`, `src/commands/cancel.ts`, `src/commands/takeover.ts`, `src/commands/status.ts`, `src/commands/guardrails.ts` — each `RunStore.open` passes `placesOf: (name) => placesOf(<the project's config>)` from the manifest it already loads (or loads it, where it does not).
**[MODIFY]** `src/manifest.test.ts`, `src/daemon/runs.test.ts`, `src/runner/session.test.ts` — cases below.
**[MODIFY]** `src/commands/status.test.ts`, `src/runner/actions.test.ts`, `src/runner/driver.test.ts`, `src/daemon/poll.test.ts` — their store helpers open with `placesOf: () => 1`, as case 3 says of phase 47's cases; nothing else in them changes. ✏ 2026-10-05 (build, timone#203): added. Phase 47's one-place cases also live in these four files, and 14 of them failed with two places by default; case 3 names the change but the file list left them out.

**Seams under test (TDD):** `parseManifest` / `placesOf` for the key; `RunStore`'s public methods over a temporary state file for the count, since the ledger is the one writer and the place rule lives there. Red-green:
1. A project entry without `places`: `placesOf` answers 2 (R2 clause 1). With `places: 3`: 3 (clause 2). `places: 0`, `places: 1.5` and `places: "2"` are refused with a message naming the key.
2. A store opened with no `placesOf`: two runs of one project each `askPlace` and both are answered ok; a third is refused naming one of them (R2 clause 3 with N = 2).
3. A store opened with `placesOf: () => 1`: the second run is refused, as phase 47's cases expect — those cases now open their store this way, unchanged otherwise.
4. Two places, two runs active, a third waiting: when one active run parks, the place goes to the waiting run by ADR-0063's order while the other keeps running (R2 clause 4).
5. Two projects with different counts in one store: each is counted on its own.
6. `placeOf` in the runner's brief says `free` while one of two places is taken.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"   # expected 0
npx vitest run src/manifest.test.ts src/daemon/runs.test.ts src/runner/session.test.ts src/commands/; echo "exit: $?"   # expected 0
# The constant is gone from code, comments excluded; grep exits 1 when nothing matches
grep -rn "PLACES_PER_PROJECT" src --include=*.ts | grep -vE '^\S+:[0-9]+:\s*(//|\*)'; echo "exit: $? (expected 1)"
# Every store the commands open is told the number (expected: each line shows placesOf)
grep -rn "RunStore.open(" src/commands --include=*.ts | grep -v test.ts
```

- [ ] Cases 1–6 pass, with the red run of each new case recorded in the handoff.
- [ ] Every `RunStore.open` under `src/commands/` passes `placesOf`; the handoff lists them.
- [ ] The place-order and stale-run cases already in `runs.test.ts` stay green.

---

### Sub-phase 49b: Every open, unblocked step of an initiative may be picked up

**[MODIFY]** `src/daemon/steps.ts` — `nextStep` becomes `eligibleSteps(steps): Step[]`, every step meeting the four conditions, in the listing's order; the doc comment says why "the first" went (PRD-07.R4, ADR-0065 D6) and keeps what it says about cycles and incomplete dependency lists.
**[MODIFY]** `src/daemon/poll.ts` — `surveyInitiatives` adds every eligible step to the `next` set (the field is renamed `isEligible`); `rememberInitiative` still records the first eligible step as `next`, so `timone status` reads as before. The comment above the skip in `pollProject` is corrected.
**[MODIFY]** `src/daemon/steps.test.ts`, `src/daemon/poll.test.ts` — cases below.
**[MODIFY]** `src/daemon/chunk-zero.test.ts` — its one use of `nextStep` (the case "leaves piece 1's step ticket free to be taken") asserts that `eligibleSteps` includes step 11 instead; nothing else changes. ✏ 2026-10-05 (build, timone#203): added. The file imports `nextStep`, so without it the type check fails and the grep below finds it.

**Seams under test (TDD):** `eligibleSteps` is pure; `pollProject` through the poll test file's existing entry with the fake forge is the seam for what is picked up. Red-green:
1. Steps 2 and 3 open, each blocked only by closed step 1: both are eligible (R4 clause 3).
2. Step 3 blocked by open step 2: only step 2 is eligible (R4 clause 4).
3. A held step, an assigned step, a step with an incomplete dependency list, and two steps blocking each other: none is eligible (existing cases, renamed).
4. One poll cycle over an initiative with steps 2 and 3 both eligible registers a run for each; a step blocked by an open step gets none.
5. `rememberInitiative` still names the first eligible step as `next`.

> No dependency on other sub-phases. It touches `src/daemon/poll.ts`, which 49f also changes, so it runs before 49f.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"   # expected 0
npx vitest run src/daemon/steps.test.ts src/daemon/poll.test.ts src/commands/status.test.ts; echo "exit: $?"   # expected 0
grep -rn "nextStep" src --include=*.ts | grep -vE '^\S+:[0-9]+:\s*(//|\*)'; echo "exit: $? (expected 1)"
```

- [ ] Cases 1–5 pass, with red runs recorded.

---

### Sub-phase 49c: A work branch that carries another ticket's unmerged commits is refused at its first push

**[MODIFY]** `src/daemon/push-guard.ts` — `export function foreignCommits(own: readonly string[], containedBy: (sha: string) => readonly string[], workBranch: string): { sha: string; branch: string }[]`: each of the branch's own commits that another `origin/timone/*` branch (not `origin/<workBranch>`) contains. `pushRefusal` gains an optional third argument, the list it found; a non-empty list refuses the push with: `Refused: this branch carries work of <branch> that is not on the default branch yet. Cut the work branch from the default branch, and keep only this ticket's commits on it.`
**[MODIFY]** `src/commands/guardrails.ts` — `guardrails pre-push`, only for an update whose `remoteRef` is the work branch and whose `remoteSha` is all zeros: reads the default branch (`git symbolic-ref --short refs/remotes/origin/HEAD`), lists the branch's own commits (`git rev-list <localSha> --not refs/remotes/origin/<default>`), asks `git branch -r --contains <sha>` for each, and passes `foreignCommits` to `pushRefusal`.
**[MODIFY]** `src/daemon/push-guard.test.ts`, `src/commands/guardrails.test.ts`; **[NEW FILE]** `src/daemon/push-guard.git.test.ts` — cases below, the second against real git repositories in a temporary folder, as `src/merge-rules.git.test.ts` does.
**[MODIFY]** `src/guards/checkouts.test.ts` — `GIT_USERS` gains `commands/guardrails.ts`, with the reason: `guardrails pre-push` asks git, read-only, about the clone the hook runs in. ✏ 2026-10-05 (build, timone#203): added. The test lists every file that runs git, and fails when one is missing; it was found by the next slice's checks, after 49c was committed, so the fix is its own commit.

**Seams under test (TDD):** `foreignCommits` and `pushRefusal` are pure; the `guardrails pre-push` command is the seam for the git half, driven with a bare remote and a clone on disk, because what matters is what git reports. Red-green:
1. Own commits that no other branch contains: nothing found; the push goes ahead (R4 clause 2).
2. One own commit that `origin/timone/12-other` contains: found, and `pushRefusal` refuses naming `timone/12-other`.
3. A commit that only `origin/<workBranch>` contains is not foreign.
4. Against real git: a branch cut from `origin/main` pushes; a branch cut from another pushed `timone/…` branch is refused at its first push, and the refusal names that branch.
5. A second push of a branch that already exists on the remote is not checked again (`remoteSha` not zeros).
6. The existing cases — the default branch refused, a reservation allowed — stay green.

> Sub-phase 49a must be complete before starting this sub-phase: both change `src/commands/guardrails.ts` (49a only its `RunStore.open` calls). It shares no file with 49b or 49d–49g, and may run beside them.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"   # expected 0
npx vitest run src/daemon/push-guard.test.ts src/daemon/push-guard.git.test.ts src/commands/guardrails.test.ts; echo "exit: $?"   # expected 0
```

- [ ] Cases 1–6 pass, with red runs recorded.
- [ ] The refusal sentence in a test matches the words above exactly.

---

### Sub-phase 49d: The build does not start without the planner's decision, and the ledger keeps that decision

**[MODIFY]** `src/daemon/runs.ts` — `runSchema` gains `planner` as in the Goal Description, optional, with a doc comment naming ADR-0065 D2. New public methods, each re-reading the file as the others do:
- `askPlanner(id): Run` — sets `planner.askedAt` when the run has no decision; does nothing when it has one or was already asked.
- `decidePlanner(id, decision): Run` — writes `planner.decision`; `askedAt` stays as the time it was asked. A new decision replaces the old one (a held run decided again).
- `reaskPlanner(id): Run` — for a held run: clears the decision and sets `askedAt` to now.
- `waitingForPlanner(project): Run[]` — live runs with `askedAt` and no decision, in ADR-0063's order (`place.priority`, then `place.openedAt`, then ticket number; a run with no `place` yet is ordered by ticket number after those that have one).
- `heldByPlanner(project): Run[]` — live runs whose decision is `hold`.
`complete` and `cancel` leave `planner` as it is (a record of what was decided).
**[MODIFY]** `src/runner/record.ts` — `recordEntrySchema` gains `planner-decision` and `planner-ended` as in the Goal Description. **[MODIFY]** `src/runner/limit.ts` — `spentOn` adds `planner-ended` costs.
**[MODIFY]** `src/runner/actions.ts` — in `startStep`, for `stage === "execution"` only, after `skippedBy` and before `askPlace`: no decision → `deps.store.askPlanner(run.id)` and refuse with the first sentence in the Goal Description; a `hold` → refuse with the second; `build` → go on. The ticket's place order (`priority`, `openedAt`) is written with `askPlace` as today, so `waitingForPlanner` can order by it: call `askPlace`'s order-writing half first, or record the order on `askPlanner` (the builder chooses; the handoff says which).
**[MODIFY]** `src/runner/brief.ts` — `BriefInput` gains `planner` (`not-asked` | `deciding` | `{ holds: number[]; reason }` | `{ letBuildAt }`); `factsSection` writes its line; `SYSTEM` gains the rule, both in the Goal Description's words. **[MODIFY]** `src/runner/session.ts` — fills `planner` from the run.
**[MODIFY]** `src/daemon/prompts.ts` — `recordLine` returns no line for the two new record entries, `planner-decision` and `planner-ended`, as it does for `runner-ended`. ✏ 2026-10-05 (build, timone#203): added. `recordLine` covers every kind of record entry and ends with `entry satisfies never`, so the two new kinds fail the type check without it.
**[MODIFY]** `src/runner/replay/recording.ts` — the store each case opens gives its run a let-build decision, so the replay cases that choose `execution` are judged on the choice, not on a refusal this phase adds.
**[MODIFY]** `src/daemon/runs.test.ts`, `src/runner/actions.test.ts`, `src/runner/brief.test.ts`, `src/runner/limit.test.ts`, `src/runner/record.test.ts` — cases below.

**Seams under test (TDD):** `runnerActions(deps, run).startStep` with a real `RunStore` on a temporary file and the fake adapter and fake `startStep` the file already uses — the action is what starts a build, and R5's hint says clause 1 is tested there. `RunStore` for the new methods; `buildBrief` is pure; `spentOn` is pure. Red-green:
1. A run with a committed plan and no decision: `startStep({ stage: "execution" })` answers `{ ok: false }` with the first refusal sentence; `deps.startStep` was not called; no place was taken; the run is in `waitingForPlanner` (R5 clause 1).
2. The same run held (`decidePlanner(id, { kind: "hold", waitsFor: [7], … })`): refused with the second sentence naming #7; nothing started.
3. The same run let build: the step starts, through `askPlace` as before.
4. `startStep({ stage: "planning" })`, `"verification"`, `"delivery"` and `"remediation"` with no decision: not refused for want of one.
5. `askPlanner` twice keeps the first `askedAt`; `reaskPlanner` on a held run clears the decision and the run is waiting again; `waitingForPlanner` orders a `priority:high` run first.
6. A ledger file written before this phase (no `planner` field) loads unchanged.
7. `spentOn` over a record with a `planner-ended` entry of $0.40 counts it; a record with a malformed `planner-decision` line is refused as other malformed lines are.
8. `buildBrief` writes each of the four planner lines, and `SYSTEM` carries the new rule.
9. `endRun`, the place refusal and the skip-reason refusal behave as before (existing cases, unchanged).

> Sub-phase 49a must be complete before starting this sub-phase (both change `src/daemon/runs.ts` and `src/runner/session.ts`).

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"   # expected 0
npx vitest run src/daemon/runs.test.ts src/runner/; echo "exit: $?"   # expected 0
npm run replay; echo "exit: $?"   # expected 0 — PRD-05.R18's replay set
```

- [ ] Cases 1–9 pass, with red runs recorded.
- [ ] The replay set passes; if a recorded case needed changing beyond the let-build decision, the handoff says which and why.

---

### Sub-phase 49e: The planner's facts, instructions and answers — everything but the session

**[NEW FILE]** `src/planner/plan-files.ts` — `planFiles(text: string): string[]`, as in the Goal Description.
**[MODIFY]** `src/runner/facts.ts` — `addedOn` is exported (renamed `filesAddedOnBranch` if the name reads better), unchanged in behaviour.
**[MODIFY]** `src/adapters/ticketing.ts`, `src/adapters/github-tickets.ts` — `listPullRequestFiles(project, pr)`. **[MODIFY]** every fake of the port that `tsc` names, and `src/runner/replay/recording.ts`, gain it (answering `[]` unless a test sets files).
**[NEW FILE]** `src/planner/facts.ts` — `gatherPlannerFacts(deps, run, cycle): Promise<PlannerFacts>`: the ticket (number, title, labels), its plan (path, title, `planFiles`), its blockers from the cycle's survey, every other ticket of the project that is building or has an open pull request (by the Goal Description's meaning) with its plan's files and, for an open pull request, `listPullRequestFiles`; and the named person's comment that woke it, if any. A plan that cannot be read is a fact ("the plan of #12 could not be read: <why>"), never a thrown error.
**[NEW FILE]** `src/planner/brief.ts` — pure `buildPlannerBrief(facts): { system: string; prompt: string }`. The system text says: you decide for one ticket whether it may be built now; compare the files its plan names with the files of each ticket building or with an open pull request; a small overlap may build at once, a large one waits, and you judge which, not by a count; a ticket that needs another ticket's work that is not merged waits for it; when a named person's comment woke you and says to build now, let it build citing the comment's time; when the comment is about something else, pass it to the runner; call exactly one of `let_build`, `hold`, `pass_to_runner`, once; write the reason in plain words for a person, one or two sentences, naming files by path.
**[NEW FILE]** `src/planner/actions.ts` — `plannerActions(deps, run, facts)` with `letBuild`, `hold`, `passToRunner`, `readPlan`. Each checks, writes and answers as the runner's actions do (`{ ok: true; said } | { ok: false; refused }`):
- every action refuses a `ticket` other than the one being decided, and a second decision in one session;
- `hold` refuses an empty `waitsFor`, and any ticket not among the facts' building, open-pull-request or blocker tickets; on success `decidePlanner`, a `planner-decision` entry, and the hold comment naming each ticket;
- `letBuild` with `commentAt` checks the comment as `namedPersonsComment` does (moved to a shared export from `src/runner/actions.ts`, not copied) and refuses otherwise; on success `decidePlanner` with `onComment`, the entry, and the on-a-comment notice; without `commentAt`, no comment;
- `passToRunner` refuses unless a comment at that time is the one in the facts; on success writes the notice `passed to runner: comment at <at>`, decides nothing;
- `readPlan` answers the plan text of the ticket decided or of a ticket in the facts, or refuses.
**[NEW FILE]** `src/planner/tools.ts` — `plannerToolServer(actions)`, built as `runnerToolServer` is. **[NEW FILE]** `src/planner/plan-files.test.ts`, `src/planner/facts.test.ts`, `src/planner/brief.test.ts`, `src/planner/actions.test.ts`; **[MODIFY]** `src/adapters/github-tickets.test.ts` — cases below.

**Seams under test (TDD):** `planFiles` and `buildPlannerBrief` are pure. `gatherPlannerFacts` with a real `RunStore` and the fake adapter. `plannerActions` with a real `RunStore`, a temporary record folder and the fake adapter — the actions are what the planner calls, and their checks are what R6's two code tests are about. `GitHubTicketingAdapter` with the file's `fakeRunner` for the `gh` argv. Red-green:
1. `planFiles` over phase 47's own text finds `src/daemon/runs.ts`, `src/runner/actions.ts` and the others once each, in order; a backticked path in prose without a marker is not taken; `[DELETE]` is taken.
2. `gatherPlannerFacts`: run B building (let build, no pull request) and run C with an open pull request are both listed with their files; run D `done` and run E held are not; C's pull request files come from `listPullRequestFiles`.
3. `hold({ ticket, waitsFor: [7], reason })` posts one comment whose text contains `#7` and the reason, ends with the `What I need from you:` line, and writes the decision in the ledger and the record (R6 clause 1).
4. `hold` naming a ticket not in the facts is refused; nothing is posted.
5. `letBuild({ commentAt })` on a named person's comment: decided `build` with `onComment`, and the comment posted names that person (R6 clause 2).
6. `letBuild({ commentAt })` on a comment by someone not named for the project, or on a comment the machine posted: refused, and the decision in the ledger is unchanged (R6 clause 3).
7. A second decision in one session is refused.
8. `passToRunner` writes the notice and leaves the run waiting.
9. `buildPlannerBrief` lists each ticket with its files, says the comment and who wrote it when there is one, and the system text names the three tools.
10. The adapter sends `gh pr view <n> --repo <slug> --json files` and answers the paths; a `gh` failure throws.

> Sub-phase 49d must be complete before starting this sub-phase (`decidePlanner`, the record entries, the ledger field).

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"   # expected 0
npx vitest run src/planner/ src/adapters/ src/runner/actions.test.ts src/runner/facts.test.ts; echo "exit: $?"   # expected 0
```

- [ ] Cases 1–10 pass, with red runs recorded.
- [ ] `namedPersonsComment` and `addedOn` each have one definition under `src/`: `grep -rn "function namedPersonsComment\|function addedOn\|function filesAddedOnBranch" src --include=*.ts | grep -v test.ts` shows one line each.

---

### Sub-phase 49f: The planner runs — one session per project, asked again when what a ticket waits for is gone, and a named person's comment on a waiting ticket goes to it

**[NEW FILE]** `src/planner/session.ts` — `decide(deps, run, facts)`: one SDK `query` with `buildPlannerBrief`, the `planner` MCP server, and the bounds in the Goal Description; writes `planner-ended` with its cost into the ticket's record, whatever the outcome. `PlannerSessions`: at most one session per project at a time; a session that ends with no decision leaves the run waiting, and the next cycle tries again; a model that cannot be reached is retried as `RunnerSessions` retries.
**[NEW FILE]** `src/planner/driver.ts` — `PlannerDriver.tick(project, config, cycle)`, called once per project per cycle:
- for every held run: when no ticket it waits for still has a build running or an open pull request (by the Goal Description's meaning, using the cycle's thread reader for pull request state), `reaskPlanner`;
- for every run waiting for the planner, or held, whose ticket has a named person's comment newer than `askedAt` (or the hold's `at`) that is not yet noticed by the planner and not passed: that run is decided next, with the comment in its facts; the comment is noticed as `planner read comment at <at>`;
- otherwise the first of `waitingForPlanner(project)`;
- skips a run whose ticket carries `timone:held` (not a step ticket's own claim, as `look()` reads it) or is over its spending limit;
- starts at most one session for the project, and none while one runs.
**[MODIFY]** `src/runner/driver.ts` — in `look()`: for a run waiting for the planner or held, named persons' comments are not delivered to the runner and not marked read, except those the planner passed (`passed to runner: comment at <at>`). A let-build decision not yet noticed is delivered once with `plannerLetBuildEvent`.
**[MODIFY]** `src/daemon/poll.ts` — `pollProject` calls `planner.tick(project, config, cycle)` after `runner.tick`, with the same cycle. `PollDeps` gains `planner?`.
**[MODIFY]** `src/commands/daemon.ts` — builds `PlannerSessions` and `PlannerDriver` beside the runner's, and passes the planner to the poll.
**[NEW FILE]** `src/planner/session.test.ts`, `src/planner/driver.test.ts`; **[MODIFY]** `src/runner/driver.test.ts`, `src/daemon/poll.test.ts` — cases below.

**Seams under test (TDD):** `PlannerDriver.tick` with a real `RunStore`, the fake forge and a fake `decide` is the seam for who is decided and when; `PlannerSessions` with a fake `runQuery` for one-at-a-time and the cost; `RunnerDriver.tick` with the file's `fakeWakes()` for what reaches the runner. Red-green:
1. Two runs of one project waiting for the planner: one tick starts one session, for the one first by order; a second tick while it runs starts none; after it ends, the next tick starts the other's.
2. Runs of two projects waiting: one session each, at the same time.
3. Run A held, waiting for #7 whose run has an open pull request: no re-ask. #7's pull request merges (the run ends) — or closes: the next tick re-asks A, and a session decides it (R5 clause 4); A's plan file is not touched.
4. A held run whose ticket gets a named person's comment: the next tick decides it with that comment in its facts; the runner is not woken by the comment.
5. The same with a comment by someone not named: no session starts, nothing changes (R6 clause 3).
6. The planner passes the comment: the next runner tick delivers it to the runner as a comment event.
7. A let-build decision: the next runner tick wakes the run once with `plannerLetBuildEvent`; a third tick does not wake it again.
8. A held ticket (`timone:held`, not a step) and a ticket over its limit: no session.
9. A session whose fake query costs $0.30 and decides nothing: a `planner-ended` entry of $0.30 is in the ticket's record, the run still waits, and the next cycle tries again.
10. A daemon restart (a new driver over the same ledger) with a run waiting: the next tick starts its session.

> Sub-phases 49b and 49e must be complete before starting this sub-phase (49b changed `src/daemon/poll.ts`; 49e is what the session calls).

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"   # expected 0
npx vitest run src/planner/ src/runner/ src/daemon/; echo "exit: $?"   # expected 0
npm run replay; echo "exit: $?"   # expected 0
```

- [ ] Cases 1–10 pass, with red runs recorded.
- [ ] The whole suite passes: `npx vitest run; echo "exit: $?"` (expected 0).

---

### Sub-phase 49g: `timone status` says which tickets the planner is deciding or holding

**[MODIFY]** `src/commands/status.ts` — `describeProject` adds, after the place line phase 47 added, `planner: deciding #12; holds #9 until #7` from `waitingForPlanner` and `heldByPlanner`; nothing when neither has a run. **[MODIFY]** `src/commands/status.test.ts` — cases below.

**Seams under test (TDD):** `renderStatus` with runs built in a temporary ledger. Red-green: (1) one run deciding and one held show in that line; (2) neither, no line; (3) a held run waiting for two tickets reads `until #7 and #8`.

> Sub-phase 49d must be complete before starting this sub-phase. It shares no file with 49e and 49f and may run beside them; it runs after 49a, which also changes `status.ts`.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"   # expected 0
npx vitest run src/commands/status.test.ts; echo "exit: $?"   # expected 0
```

- [ ] Cases 1–3 pass, with red runs recorded.

---

### Sub-phase 49h: The words that said one step at a time and one ticket at a time are changed where they are written

No behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based.

**[MODIFY]** `doc/specs/prd/prd-02-inversion-of-control.criteria.md` — R22 clause 1 gets a dated note: `✏ 2026-10-05 — changed by PRD-07.R4 ([ADR-0065](…)): every step ticket that is open, unblocked, unheld and unclaimed may be picked up, not only the first; the places and the planner decide which build.` Nothing is deleted.
**[MODIFY]** `doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md` — R15 clause 2 gets a dated note: replaced by PRD-07.R2 — two tickets of one project build at once, up to the project's places, as the planner allows. Clause 1 is untouched.
**[MODIFY]** `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.md` — the `Phases:` line names phase 49 beside the phases already there (or replaces "none yet" with the list of phases 44 to 49 that deliver PRD-07, if it still says that).
**[MODIFY]** `process.md` — stage 5's sentence "It is the first step ticket that is open, unblocked and unassigned" gets a dated ✏ note naming ADR-0065: every such step may be picked up; the project's places and the planner decide which build. Stage 6 gains one dated sentence: before a ticket's build starts, the planner — one agent per project — decides from its plan whether it builds now or waits for another ticket's pull request, says so on the ticket when it holds it back, and a named person can overrule it there.
**[MODIFY]** `.claude/skills/timone-plan/SKILL.md` — the bold line "Which step is next is the first step ticket that is open, unblocked and unassigned" gets the same dated note.
**[MODIFY]** `CONTEXT.md` — the **Place** entry says the number comes from `places` in `timone.yaml`, 2 when absent; the **Planner** entry gains when it decides (when a build would start) and that it takes no place.

> Sub-phases 49a–49g must be complete before starting this sub-phase (the notes describe what the code now does and quote its words).

#### Agent Validation Steps

```bash
grep -n "ADR-0065" doc/specs/prd/prd-02-inversion-of-control.criteria.md doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md process.md .claude/skills/timone-plan/SKILL.md CONTEXT.md; echo "exit: $? (expected 0, every file listed at least once)"
grep -n "phase-49" doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.md; echo "exit: $? (expected 0)"
```

- [ ] PRD-02.R22 clause 1 and PRD-05.R15 clause 2 each carry a dated note naming the PRD-07 requirement that changes them (R12).
- [ ] No requirement's `Status:` line changed.
- [ ] Plain words in every note: no metaphor, no process jargon.

## Dependency graph

```
49a → (none)          places from timone.yaml: the key, the store's count, every opener told
49b → (none)          every open, unblocked step picked up
49c → 49a             a branch carrying another ticket's unmerged commits refused at its first push
49d → 49a             the build refused without the planner's decision; the ledger and record keep it
49e → 49d             the planner's facts, instructions and checked answers
49f → 49b, 49e        the planner's sessions and loop; re-asked when what it waits for is gone; comments routed
49g → 49a, 49d        timone status names what the planner decides and holds
49h → 49a–49g         the old words changed in the requirements, process.md, the planning instructions, CONTEXT.md
```

49a and 49b share no file and may start together; 49c follows 49a (both change `guardrails.ts`) and may run beside everything after it. 49d → 49e → 49f is one chain; 49g may run beside 49e and 49f. Commits are still made one at a time, because every slice appends to `phase-49-handoffs.md`.
