# Phase 50 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 50a — An open pull request whose branch falls behind the default branch wakes its runner, once for each new head

**Built.** On each tick, for a run whose pull request is open, whose branch is set, whose ticket is not held, and with no step of the run running, the driver asks the forge how far the branch is behind the default branch. When it is behind, the runner is woken with `behindEvent(n, default, head)`, and the notice `branch behind <default> at <sha>, run <id>` is written, so the run is told once for each head of the default branch. A new head tells it again. A held ticket is told once the hold comes off. A run with no pull request, or a merged or closed one, is not asked. A failed compare adds one line to `tick`'s errors, writes nothing for that run, and the other runs are still looked at. The GitHub adapter answers the question with one `gh api repos/<slug>/compare/<default>...<branch> --jq '{behind: .behind_by, defaultHead: .base_commit.sha}'` call, after one `readBranches` for the default branch's name. A 404 answers undefined; any other failure throws.

**Files touched.**

- `src/adapters/ticketing.ts` — the port gains `behindDefault(project, branch)`, with a doc comment naming ADR-0066 D1.
- `src/adapters/github-tickets.ts` — `behindDefault` implemented with the compare call, a zod schema for the `--jq` output, and the 404 read as undefined.
- `src/runner/driver.ts` — `behindEvent` and `behindNotice` exported beside `PLACE_GIVEN_EVENT`; a private `behindDefault` helper on `RunnerDriver`; `look()` asks it and pushes the event and the notice inside `if (!held)`, after the pull-request event.
- `src/adapters/ticketing.stubs.ts` — `noRunnerCalls` gains `behindDefault`, which answers `{ behind: 0, defaultHead: "4f2a9c1…" }`; its doc comment says why this one member answers instead of throwing.
- `src/runner/actions.test.ts` — its hand-written fake gains `behindDefault` answering level.
- `src/runner/replay/recording.ts` — the replay fake gains `behindDefault` answering level.
- `src/runner/driver.test.ts` — a new `describe` block (cases 1–7) with its own fixture `twoPullRequests`. No existing line changed.
- `src/adapters/github-tickets.test.ts` — three new cases (case 8), and `behindDefault` added to the list in "every call this adapter makes can be scoped to a repository".
- `doc/plans/phases/reports/phase-50-handoffs.md` — created.

**Decisions taken inside the slice.**

- **Where the driver gets the default branch's name.** The plan fixes the method's answer as `{ behind, defaultHead }`, with no name, but the event and the notice both carry the name. The driver calls `adapter.readBranches(project)` for it, and only when the branch is behind (`behind > 0`). A level branch costs one forge call per look, as the plan expects; a behind branch costs two. The signature in the plan is unchanged.
- **The compare is asked before any comment is marked read.** The plan puts the check inside `if (!held)`, after the pull-request event. `newComments` writes `seen` marks before that point, so a compare that failed there would mark a person's comment read and never tell it. The answer is fetched just after `held` is known, before `newComments`; the event and the notice are still pushed at the place the plan names. A failed compare therefore stops the look with nothing written.
- **The held ticket is not asked at all**, not only not told: the fetch is skipped when `held` is true, as the plan's "inside `if (!held)`" implies.
- **Words of the event.** `<n> commit(s)` is written as `1 commit` or `<n> commits`. The short sha is the first 7 characters. The notice carries the full sha.
- **The shared stub answers.** `noRunnerCalls` says every member throws. `behindDefault` answers level instead, because the driver now asks it on every look at an open pull request, and the existing driver tests use `forge()`, which spreads `noRunnerCalls`. A throw would have turned those tests into tick errors. Level tells the runner nothing, which is what those tests had before.
- **Test expectations are literal strings** of the plan's wording, not calls to `behindEvent`, so the expected value does not come from the code under test.

**Validation evidence.**

Case 8 was driven first, so that `tsc --noEmit` was clean during the driver work.

- **Case 8** — `github-tickets.test.ts`: "counts the commits the default branch has that a branch does not, and names the default branch's head, in one compare", "answers undefined when the compare does not know the branch", "reports a failed compare other than a 404, and never renders it as a missing branch". Red: all three `TypeError: (intermediate value).behindDefault is not a function` (3 failed). Green after the adapter method: 3 passed; whole file 85 passed.
- **Case 1** — "wakes the other open pull request's runner with how far its branch is behind when one pull request merges (R7 clause 1)". Red: the diff showed the merge wake for `scratch-app#12/1` and no wake for `scratch-app#13/1` (expected `The default branch main has moved on: this ticket's branch is 2 commits behind it (main is at abc1234). …`). Green after `behindEvent`, the helper, and the push in `look()` (no notice, no running check yet): driver.test.ts 21 passed.
- **Case 2** — "tells a run once for each head of the default branch: not again at the same head, again at a new one". Red: `expected [ { …(3) }, { …(3) } ] to have a length of 1 but got 2`. Green after `behindNotice` and the `noticed` check: 22 passed.
- **Case 3** — "tells a run whose pull request opened behind on the first tick, and tells nothing to one that opened level (R14 clauses 1 and 3)". It passed on its first run, because the `behind > 0` check came with case 1. Mutation: the check `answer.behind === 0` removed → `AssertionError: expected [ { …(3) }, { …(3) } ] to deeply equal [ { runId: 'scratch-app#12/1', …(2) } ]`. Reverted → passed.
- **Case 4** — "does not ask about a run with a step running, and tells it on the first tick after the step ends". Red: `AssertionError: expected [ …(2) ] to not include 'timone/12-fix-the-readme-spelling'`. Green after the `this.deps.running.has(run.id)` check: 24 passed.
- **Case 5** — "does not tell a held ticket that its branch is behind, and tells it once the hold comes off". It passed on its first run, because the push sat inside `if (!held)` from case 1. Mutation: the fetch made regardless of `held` and the push moved before `if (!held)` → `AssertionError: expected [ { runId: 'scratch-app#13/1', …(2) } ] to deeply equal []`. Reverted → 25 passed.
- **Case 6** — "asks nothing about a run with no pull request, or whose pull request is merged or closed". It passed on its first run (the open-state check came with case 1, and before any code existed nothing was asked at all). Mutation A: the guard changed to `pull === undefined` → `expected [ 'timone/13-fix-the-licence-year' ] to deeply equal []`. Mutation B: the guard on the pull request removed → `expected [ …(2) ] to deeply equal []`. Reverted → 26 passed.
- **Case 7** — "returns one error line naming the ticket when the compare fails, still looks at the other run, and notices nothing for the failed one". It passed on its first run: `tick`'s existing per-run catch writes the line. Mutation: `.catch(() => undefined)` on the adapter call → `AssertionError: expected [] to deeply equal [ Array(1) ]`. Reverted → 27 passed.

Validation block:

```
npx tsc --noEmit; echo "exit: $?"
exit: 0
npx vitest run src/runner/driver.test.ts src/adapters/; echo "exit: $?"
 Test Files  7 passed (7)
      Tests  221 passed (221)
exit: 0
```

- [x] Cases 1–8 pass, with red runs recorded in the handoff. Pass. Cases 3, 5, 6 and 7 could not be driven red honestly after case 1; each is shown not to be vacuous by a mutation above.
- [x] Every existing case of `driver.test.ts` passes unchanged. Pass. `git diff` of the file is additions only (one hunk after line 1205); the 20 existing cases pass.

Other test files that use code this slice changed (fakes edited, `noRunnerCalls` changed, or the driver used), run at the end: `src/runner/actions.test.ts` (68), `src/runner/replay/harness.test.ts` (3), `src/runner/facts.test.ts` (13), `src/planner/` (6 files, 40), `src/commands/daemon.test.ts` (26), `src/commands/takeover.test.ts` (51), `src/daemon/chunk-zero.test.ts` (14), `src/daemon/hooks.test.ts` (76), `src/daemon/poll.test.ts` (119). 14 files, 410 tests passed, exit 0.

**What 50d must know.**

- The event text is `behindEvent(n, default, head)` in `src/runner/driver.ts`. It ends with "Start the update: …", and the runner's rule in `SYSTEM` should match those words.
- The notice is per run and per head of the default branch. After an update levels the branch, the compare answers `behind: 0` and nothing is told. When the default branch moves again, the new head is a new notice.
- The driver does not check whether an update is already running beyond "no step of this run is running". A merge that lands while the update runs is told after that step ends, as ADR-0066 says.
- A behind branch costs two forge calls per look (`behindDefault`, then `readBranches` for the name). A level branch costs one.
- Deferred refactoring: `GitHubTicketingAdapter.aheadOfDefault` and `behindDefault` repeat the compare call and the 404 handling; one private compare helper would remove the copy.
- `noRunnerCalls.behindDefault` answers level. A test that wants a behind branch overrides `behindDefault` on its own fake, as the new `twoPullRequests` fixture does.

## 50b — `update` is a step the runner starts, with its own instructions and the check's access to the probe folders

**Built.** `update` is a stage of the pipeline, after `remediation`, with the row the plan fixes: `bringing the work up to date`, owns the branch, `claude-opus-5-5` at `high`. It has its own prompt: the ticket and re-entry blocks, the pull request's branch, the path of the update instructions, merge and never rebase, force-push or merge the pull request, the two endings, and the writing block; `stagePrompt` adds the shared blocks. The runner can start it through `start_step`: it is not asked of the planner, it takes a place as any step does, and it starts on the run's own branch. The probe guard allows `update` as it allows `verification`, and its reason names the stage. The runner's rules carry the plan's rule under *How you act*, just after the rule on a run that waits on its pull request. The replay set has a twentieth case, `#202`.

**Files touched.**

- `src/daemon/pipeline.ts` — `"update"` in `PIPELINE_STAGES`, and its `STAGES` row with a comment naming ADR-0066 D2.
- `src/daemon/prompts.ts` — `"update"` in `PROMPTED_STAGES`; `case "update"` in `stageBody`; `updatePrompt`, beside `remediationPrompt`.
- `src/daemon/probeGuard.ts` — `CHECKING_STAGES = ["verification", "update"]` replaces `OWNING_STAGE`; the allow reason is `<Stage> runs the checks kept in <folders>, so it may read them.`; the comment above the ask branch says "a stage that runs the checks". `BUILD_STAGES` is unchanged.
- `src/runner/brief.ts` — the rule, word for word from the plan, as one line under *How you act*.
- `src/runner/replay/cases.ts` — `anOpenPullRequestBehindTheDefaultBranch` (issue `#202`), imported `behindEvent`; "four other cases" became "five", and "The nineteen cases" became "The twenty cases".
- `src/daemon/pipeline.test.ts` — case 1; and the `update` row in the hand-written 41h table, which `Record<PipelineStage, …>` requires.
- `src/daemon/prompts.test.ts` — case 2 (4 tests). The existing `it.each(PROMPTED_STAGES)` / `THREADED_STAGES` cases now also run for `update` (11 more).
- `src/daemon/probeGuard.test.ts` — case 3, a new `describe` with its fixture built by `join(PROBE_DIRECTORIES[0], "PRD-07.R7.mjs")`. No existing line changed.
- `src/runner/actions.test.ts` — case 4, a new `describe` using the existing `placeWorld`.
- `src/runner/brief.test.ts` — case 5, a new `describe` using the existing `actRule`/`actRules`.

**Decisions taken inside the slice.**

- **`tsc --noEmit` named no other place.** After `update` joined `PIPELINE_STAGES` it was clean at once: the only `Record<PipelineStage, …>` is `STAGES` (and the test table); the other stage lists are lists, partial maps, or enums built from `PIPELINE_STAGES`. So `order.ts`, the `BUILDING_STAGES` lists and `START_AGAIN` are unchanged, as the plan decides. `timone stage`, the record and ledger schemas, and `start_step`'s enum accept `update` because they are built from `PIPELINE_STAGES`.
- **The plan's sentence on the update instructions is wrapped over two lines** in the prompt, as the other prompts wrap; the merge sentence is kept on one line, word for word.
- **The allow reason starts with the stage's name, capitalised** (`Verification …`, `Update …`). The old verification reason, `Verification owns <folders>.`, became the shared sentence. No existing test read that text.
- **The replay case's issue is `#202`**, the Timone ticket this phase builds, because the case replays no recorded failure. Its run is parked at `delivery` waiting on review, with an open pull request and no review comment; the matcher passes when a step at `update` started and no comment asks a person for anything.
- **Case 4 asserts `waitingForPlanner` is empty** to show that no planner decision was asked for, besides the step starting with none.

**Validation evidence.**

Order run: 1, 4 (red), 2 (which turned 4 green), 3, 5, 6.

- **Case 1** — `pipeline.test.ts` "owns the branch, runs on remediation's model and effort, and has a name a person reads". Red: `TypeError: Cannot read properties of undefined (reading 'ownsBranch')`. After the row, the 41h table cases failed as they should (`expected [ 'triage', 'clarification', …(11) ] to deeply equal [ 'triage', 'clarification', …(10) ]`; `gives update its label, model, effort and branch`: `expected { …(4) } to deeply equal undefined`) until the table got its `update` row. Green: 43 passed.
- **Case 4** — `actions.test.ts` "starts on the run's own branch, taking a place, with no planner decision asked" and "is refused for want of a place when every place is taken, as any step is". Red (after case 1, before case 2): both refused with `No session can be started for bringing the work up to date: it has no instructions of its own.` Green after case 2's code: 70 passed. Mutation: the planner check widened to `stage === "execution" || stage === "update"` → both failed (`expected { ok: false, …(1) } to match object { ok: true }`); reverted.
- **Case 2** — `prompts.test.ts` "the update prompt (ADR-0066 D2)". Red: 3 failed, e.g. `expected '\n\n**If you cannot go on, say so on …' to contain '**Stay on the branch `timone/6-typing…'`, the same for the instructions' path and the merge sentence. The fourth test (trailer and `git -C`) passed at red: `stagePrompt` adds the shared blocks to every stage's body, so it states a property that already held. Green: 228 passed.
- **Case 3** — `probeGuard.test.ts` "the probe guard and the update (ADR-0066 D4)". Red: `expected 'ask' to be 'allow'` (1 failed, 18 passed; the verification, deny and ask cases already held). Green: 19 passed. `git diff --numstat` of the file: 28 added, 0 removed.
- **Case 5** — `brief.test.ts` "the runner's rule for a branch behind the default branch (ADR-0066 D2)". Red: `expected '' to contain 'When you are told that the ticket\'s …'` and `expected -1 to be 11`. Green: 45 passed.
- **Case 6** — the new replay case. The code it needs was already in place when the case was written, so it was not driven red; two mutations show it is not empty. A: `update` taken out of `PROMPTED_STAGES` → `FAIL #202 — … 0 of 3 tries chose it. … Refused: No session can be started for bringing the work up to date …`, `19 of 20 cases passed`. B: a right call that posts on the ticket with `**What I need from you:** say whether I should bring it up to date.` → `FAIL #202`, `19 of 20 cases passed`. Both reverted → `20 of 20 cases passed`.

Validation block:

```
npx tsc --noEmit; echo "exit: $?"
exit: 0
npx vitest run src/daemon/ src/runner/; echo "exit: $?"
 Test Files  39 passed (39)
      Tests  1259 passed (1259)
exit: 0
npm run replay -- --dry; echo "exit: $?"
PASS #202 — Start the update, and ask nobody for anything. 3 of 3 tries.
20 of 20 cases passed. The runner's sessions cost $0.00 in all.
exit: 0
```

- [x] Cases 1–6 pass, with red runs recorded. Pass. Case 2's shared-block test and case 6 could not be driven red honestly; case 6 is shown not to be empty by two mutations, and case 4's planner part by one.
- [x] `probeGuard.test.ts`'s existing deny cases pass unchanged (hard gate). Pass: no existing line of the file changed, and all 19 cases pass.
- [ ] The real replay passes. **Not run.** This container has no model login, and the real replay fails with "Not logged in" on every case (recorded in `phase-50-departures.md`). No recorded case could be seen to change its choice.

Other test files that use code this slice changed, run at the end: `src/guards/checkouts.test.ts`, `src/commands/` (12 files, `stage.test.ts`, `status.test.ts` and `takeover.test.ts` among them), `src/planner/` (6 files), `src/cli.test.ts`, `src/process-text.test.ts`. 21 files, 323 tests passed, exit 0.

**What 50c must know.**

- `stagePrompt("update", …)` points the session at `.claude/skills/timone-update/SKILL.md`, which does not exist yet (50e writes it). Until then, a started update has no instructions to follow beyond its prompt.
- The prompt's "done" ending says "the record entry is committed and pushed, whatever the result". What that entry is, and the section at the top of the pull request, are for the skill to define.
- The probe guard now allows any session at `update` to read the probe folders, as at `verification`. The fix context the update hands a failure to is kept out only by its brief (ADR-0066 D4).
- The runner is told to start nothing after the update ends. Nothing in code stops a second update; the driver's notice per head (50a) is what keeps the runner from being told twice.
- `src/runner/replay/harness.test.ts`'s top comment still says "The nineteen cases"; it was not in this slice's files.
- Deferred refactoring: `probeGuardDecision` capitalises the stage name inline; `capitalised` is already written three times, privately (`actions.ts`, `departures.ts`, `commands/record.ts`). One shared helper would remove the copies.

## 50c — `update-checks` says which three test sets an update runs

**Built.** `timone update-checks <project> [--before <commit>] [--json]` prints the three test sets an update runs on the project's checked-out branch: the project's test command, the check scripts of the branch's own plan, and the check scripts of each plan that arrived on the default branch since `--before` (`HEAD` by default). `src/update-checks.ts` holds the pure parts `claimedRequirements` and `checkScriptOf`, and `updateChecks(git, { defaultBranch, before })`, which reads everything through a small git port. The command resolves `projects/<project>` from the manifest as `number` does, reads the default branch from `git symbolic-ref --short refs/remotes/origin/HEAD`, and exits 2 with one sentence on an unknown project, a missing checkout, or a git failure.

**Files touched.**

- `src/update-checks.ts` — new: `claimedRequirements`, `checkScriptOf`, `updateChecks`, and the types `RunGit`, `PlanChecks`, `UpdateChecks`.
- `src/commands/update-checks.ts` — new: `registerUpdateChecksCommand`, the git port over `execFileSync`, and the plain output.
- `src/cli.ts` — registers the command, after `merge-file`.
- `src/update-checks.test.ts` — new: cases 1 and 2.
- `src/update-checks.git.test.ts` — new: cases 3 to 6, against a real temporary repository with a bare `origin`, built as `merge-rules.git.test.ts` builds one. The clone sits at `projects/app` under the temp root, so case 6 can run the built command there with a `timone.yaml`.
- `src/cli.test.ts` — case 7, a new `describe`. No existing line changed except the `writeFileSync` import.

**Decisions taken inside the slice.**

- **Which pull request a plan arrived with.** The plan reads it from `git log --first-parent --format=%s <before>..origin/<default>`. Subjects alone cannot say which commit brought which plan when two arrived. So the same log also gets `--diff-merges=first-parent --diff-filter=A --name-only -- doc/plans/phases/`: each first-parent commit's subject comes with the phase files it added against its first parent. Both forms are read: a subject ending `(#<n>)` (a squash) and one starting `Merge pull request #<n>` (a merge commit). The merge-commit form has no case among 1–7; it was checked by hand in a scratch repository (a plan landed by `Merge pull request #214 from …` was named with pull request 214).
- **Where the test command is read.** `updateChecks` has only the git port, and the result carries `testCommand`. So it reads `package.json` with `git show <before>:package.json`, and only when `ls-tree` of `<before>` lists it; no `package.json` means no test command. It is the branch's own `package.json`, not the merged one. It is parsed with a zod schema; a `package.json` that is not JSON makes the command exit 2 with the parser's message.
- **The port is synchronous** (`(args) => string`), so `updateChecks` returns `UpdateChecks` as the plan writes it, not a promise. It throws on a failed git command; the command catches at the process boundary and exits 2 with `` `git <args>` failed in <dir>: <what git said> ``.
- **A phase file** is a path matching `doc/plans/phases/phase-<anything>.md` directly in that folder, so reports and check scripts are never taken for plans. When a branch adds more than one, the first in git's order is its own plan.
- **`phase` is the phase file's path** in the repository (`doc/plans/phases/phase-50.md`), so the skill can open it.
- **A check script's name** is the lowercased ID, a dot, and an extension with no further dot: `prd-07.r7.mjs` matches `PRD-07.R7`; `prd-07.r70.mjs`, a file in a subfolder, and a name with no extension do not.
- **`--manifest <path>`** is accepted, as `number` accepts it, with the same default `timone.yaml`.
- **A missing checkout** gets its own sentence (`The project "<p>" is not checked out at <dir>.`), because git's own message for a missing folder names git, not the folder.
- **The unknown-project sentence** is `number`'s sentence word for word; only the exit code differs (2, as the plan says).

**Validation evidence.** Order run: 1, 2, 3, 4, 5, 6, 7.

- **Case 1** — `update-checks.test.ts` "returns the IDs in the first column of the Requirements table, and none named only in prose". Red: first `Failed to load url ./update-checks.js`, then against a stub returning `[]`: `AssertionError: expected [] to deeply equal [ 'PRD-07.R7', 'PRD-07.R14' ]`. Green: 1 passed.
- **Case 2** — "returns the file directly in the probe folder named by the lowercased ID, and no file whose name only starts with it". Red against a stub returning `undefined`: `AssertionError: expected undefined to be '<the probe folder>/prd-07.r7.mjs'`. Green: 2 passed.
- **Case 3** — `update-checks.git.test.ts` "names the branch's own plan and the plan that arrived, with each requirement's check script and the pull request". Red against a stub: `AssertionError: expected undefined to deeply equal { …(2) }`. Green: 1 passed.
- **Case 4** — "gives the same answer as before the merge when told the branch's commit before it" and "finds no plan arrived when told nothing of the commit before the merge, and still answers". Both passed on their first run: the ranges built for case 3 already use `before`. Mutation A: the arrived range made `HEAD...origin/main` (ignoring `before`) → the first test failed with `AssertionError: expected [] to deeply equal [ { …(3) } ]`, case 3 still passed. Mutation B: the arrived range made `<before>~1...origin/main` → the second test failed with `AssertionError: expected [ { …(2) } ] to deeply equal []`. Both reverted → 3 passed.
- **Case 5** — "finds no plan arrived" on a level branch. Passed on its first run, for the same reason. Mutation: the arrived range made `origin/main~1...origin/main` → case 5 failed with `AssertionError: expected [ { …(2) } ] to deeply equal []` (and case 4's second test), case 3 still passed. A second mutation, the range without a merge base (`git diff origin/main`), failed every case 3–5. Reverted → 4 passed.
- **Case 6** — three tests under "the project's test command". "is the project's scripts.test" red: `AssertionError: expected undefined to be 'vitest run'`. "is said to be missing in the command's plain output" red: `expected 'error: unknown command \'update-check…' to be ''`. "is undefined when package.json has no scripts.test" passed at red, because the field did not exist yet; mutation: a fallback `"npm test"` → `AssertionError: expected 'npm test' to be undefined`, reverted. Green after `testCommand`, the command and its registration, and `npm run build`: 7 passed.
- **Case 7** — `cli.test.ts` "exits 2 on an unknown project, with a sentence naming the projects it knows". It could not be driven red honestly: the unknown-project branch came with the command in case 6, written in `number`'s shape. Mutation A: exit code 1 → `AssertionError: expected 1 to be 2`. Mutation B: the sentence without the list of projects → `AssertionError: expected 'I don\'t know a project called "no-su…' to be …`. Both reverted, rebuilt → 7 passed.

Validation block, run from `projects/timone` (Timone itself, which has a `timone.yaml`, so the third command reads a real manifest):

```
npx tsc --noEmit; echo "exit: $?"
exit: 0
npx vitest run src/update-checks.test.ts src/update-checks.git.test.ts src/cli.test.ts; echo "exit: $?"
 Test Files  3 passed (3)
      Tests  16 passed (16)
exit: 0
npm run build && node dist/cli.js update-checks no-such-project; echo "exit: $? (expected 2)"
I don't know a project called "no-such-project"; the projects I know are: scratch-app, ivtrends, timone.
exit: 2 (expected 2)
```

- [x] Cases 1–7 pass, with red runs recorded. Pass. Cases 4, 5, the "undefined" test of case 6, and case 7 could not be driven red honestly; each is shown not to be empty by a mutation above.
- [x] No file this slice wrote contains a probe folder's path as text: it is built from `PROBE_DIRECTORIES`. Pass. A `node` script imported `PROBE_DIRECTORIES` from `dist/daemon/probeGuard.js` and counted each value in the seven files this slice wrote or changed: `hits: 0`.

Other test files run: `src/merge-rules.git.test.ts` (it runs the built command line, which `cli.ts` now registers one more command in): 6 passed.

**What 50d must know.** Nothing in this slice touches the runner or the daemon. `src/update-checks.ts` exports `updateChecks` and the types if code ever needs the answer; today only the command uses it.

**What 50e must know** (the skill that quotes this command).

- The command line, run at the Timone root in the box: `node dist/cli.js update-checks <project> [--before <commit>] [--json]`. Run it **before** the merge with no `--before`; after the merge, pass `--before <the branch's commit before the merge>` for the same answer. With no `--before` after the merge, it still runs, but finds no plan arrived.
- Exit 0 with the answer on stdout. Exit 2 with one sentence on stderr for an unknown project (the sentence lists the projects), a missing checkout, or a failed git command (for example a `--before` git does not know).
- Plain output: blocks separated by one blank line. First the test command, then the branch's own plan, then one block per arrived plan, in git's order:

```
The project's tests: vitest run --passWithNoTests

This branch's plan, doc/plans/phases/phase-50.md:
  PRD-07.R7: <the probe folder>/prd-07.r7.mjs
  PRD-07.R14: no check script

Arrived on main with pull request #214, doc/plans/phases/phase-48.md:
  PRD-07.R3: no check script

Arrived on main with pull request #215, doc/plans/phases/phase-49.md:
  PRD-07.R5: <the probe folder>/prd-07.r5.mjs
  PRD-07.R6: <the probe folder>/prd-07.r6.mjs
```

  The real output prints the folder's path where this shows `<the probe folder>`; the skill must not repeat it in text. The other lines: `The project has no test command: there is no scripts.test in its package.json.`; `This branch adds no plan.`; `No plan arrived on <default> since <before>.`; `Arrived on <default>, <phase>:` when no pull request number was found; `  It claims no requirement.` under a plan whose table claims none.
- `testCommand` is the text of `scripts.test` (for example `vitest run`), not `npm test`; the skill decides how to run it.
- `--json` prints `{ testCommand?, own?, arrived: [{ phase, pullRequest?, checks: [{ id, script? }] }] }`; a missing value is left out, not `null`.
- Deferred refactoring: the git test's `forge()` copies most of `merge-rules.git.test.ts`'s `forge()`; a shared test helper would remove the copy. The command's `try` block does the manifest, the checkout check and git in one body; it could be split if it grows.

## 50d — The update's record becomes a section at the top of the pull request, above the departures

**Built.** `src/runner/update-section.ts` holds three pure functions. `latestUpdate(recordText)` reads the last `## Update` section of the record into its eight fields. A line that is missing, or not in a form it reads, is undefined. `updateSection(entry, defaultBranch)` writes the block between `<!-- timone:update -->` and `<!-- /timone:update -->`. Its heading is `### Brought level with <default>` only when all three test sets have a line and none says `failed`, and the `Result:` line does not say `does not pass`. Otherwise the heading is `### This work does not pass after being brought level with <default>`, and the first lines name the failure and each set that failed or did not run. `withUpdate(body, section)` takes out any earlier update block and puts this one first. In `src/runner/driver.ts`, `rewriteDepartures` is now `rewriteDescription`. After the departures are placed, it finds the one phase file the branch added (`filesAddedOnBranch(…, PHASES)`, as `planOf` does), reads `doc/plans/phases/reports/phase-NN-update.md` on the branch, and, when that file has an entry, puts the update block above the departures. It writes the body only when it changed.

**Files touched.**

- `src/runner/update-section.ts` — new: `UPDATE_START`, `UPDATE_END`, the types `UpdateEntry` and `TestSet`, `latestUpdate`, `updateSection`, `withUpdate`.
- `src/runner/update-section.test.ts` — new: cases 1, 2, 3, 4, 5 and 8.
- `src/runner/driver.ts` — imports `filesAddedOnBranch`, `PHASES` and the three functions; `rewriteDepartures` renamed `rewriteDescription`, with a ✏ paragraph on its doc comment; a new private `updateOf(project, branch)`.
- `src/runner/driver.test.ts` — a new `describe` at the end (cases 6 and 7) with its own helper `stepEndsOnUpdatedBranch`. Additions only: no existing line changed.

**Decisions taken inside the slice.**

- **The newest entry is the last `## Update` heading in the file**, because each update appends. The number after `Update` is not read.
- **A field line** is `- **<label>:** <value>`, one line. A value that runs onto a second line loses the second line.
- **The whole test suite reads only `passed` or `failed`**, as the plan's form says. A whole-suite line saying `none` is read as missing, so the section says the suite did not run and the work does not pass. The check-script sets read `passed`, `failed` or `none`; `none` counts as not failed.
- **A missing `Result:` line** does not stop the work passing when all three sets passed. The plan's rule is about the sets; the `Result:` line can only make it not pass. No case covers this.
- **Words of the section.** `What arrived on <default>: <the Arrived value>.`, then `What had to change: <the Code changed value>` or `No code had to change.`, then one list line per set: `- <name>: <word> — <detail>.`, or `- <name>: did not run.`. The names are `The whole test suite`, `The check scripts of this ticket`, `The check scripts of the work that arrived`. The failure lines are `It does not pass: <failure>.`, `<name> failed: <detail>.`, `<name> did not run.`. A full stop is added only when the text does not already end with one.
- **A set with no text after its word** is shown as the word alone (`- The whole test suite: passed.`), not `passed — .`. This was fixed while writing case 4 and has no case of its own.
- **`Level with:` and `Fixes:` are read but not shown.** The plan's list of the section's lines does not name them. They are on `UpdateEntry` for anything that later needs them.
- **The update section is looked up only when the record could be read**, as the departures are; with no readable record the description is not touched.
- **The default branch's name comes from `adapter.readBranches`**, once per step end. If any forge call for the update section fails, the whole description write is skipped and logged, as any failure in this method already was; the next step's end writes it again.
- **The record path** is `doc/plans/phases/reports/<phase file's name without .md>-update.md`, so `phase-50.md` gives `phase-50-update.md`.

**Validation evidence.**

Order run: 1, 2, 3, 4, 8, 5, 6, 7.

- **Case 1** — `update-section.test.ts` "says the work was brought level, after which pull request, and what code changed and why, when every set passed (R7 clause 3)". Red against a stub returning undefined: `Error: the record has no update entry`. Green after the parser and the passing section: 1 passed. The parser read all eight lines from the start, because case 1's entry has them all.
- **Case 2** — "says no code had to change when the record says none". Red: `AssertionError: expected [ '<!-- timone:update -->', …(10) ] to include 'No code had to change.'`. Green: 2 passed.
- **Case 3** — "says the work does not pass, and names the failure in its first lines, when the whole test suite still fails after two fixes (R7 clause 4)". Red: `AssertionError: expected [ '### Brought level with main', …(3) ] to deeply equal [ …(4) ]`. Green after `failuresOf` (result failure and failed sets): 3 passed.
- **Case 4** — "says the work does not pass, and names the set that did not run, when a set's line is missing and the result says passes (R7 clause 2)". Red: `AssertionError: expected [ '### Brought level with main', …(2) ] to deeply equal [ …(3) ]`. Green after a missing set counts as not run: 4 passed.
- **Case 8** — "shows only the newest entry when the record holds two". Red (the parser took the first `## Update`): `AssertionError: expected [ …(3) ] to deeply equal [ '### Brought level with main', …(2) ]`. Green after taking the last heading: 5 passed.
- **Case 5** — "puts the update block first, above the departures block and the text, and changes nothing when run again". Red against the stub that returned the body: `AssertionError: expected '<!-- timone:departures -->\nThe defau…' to be '<!-- timone:update -->\n### Brought l…'`. Green: 6 passed.
- **Case 6** — `driver.test.ts` "puts the update block at the top of the pull request, with the departures block and the delivery text after it, unchanged". Red: `AssertionError: expected [] to deeply equal [ Array(1) ]` (the departures were unchanged, so nothing was written). Green after `rewriteDescription` and `updateOf`: driver.test.ts 28 passed.
- **Case 7** — "gives the body that the departures alone give when the branch carries no update record, as before the update existed". It passed on its first run: the guard for a missing record came with case 6. Mutation: `latestUpdate(record ?? "## Update")` (a missing record read as an empty entry) → `AssertionError: expected [ Array(1) ] to deeply equal [ Array(1) ]`. Reverted → 29 passed.

Validation block:

```
npx tsc --noEmit; echo "exit: $?"
exit: 0
npx vitest run src/runner/; echo "exit: $?"
 Test Files  12 passed (12)
      Tests  232 passed (232)
exit: 0
```

- [x] Cases 1–8 pass, with red runs recorded. Pass. Case 7 could not be driven red honestly; the mutation above shows it is not empty.
- [x] `src/runner/departures.test.ts` passes unchanged (hard gate). Pass: `git diff --stat src/runner/departures.ts src/runner/departures.test.ts` prints nothing, and the file passes inside the `src/runner/` run. The 27 earlier cases of `driver.test.ts`, the departures cases among them, pass with no line changed.

Other test files that use the driver or the code it now calls, run at the end: `src/commands/daemon.test.ts`, `src/daemon/poll.test.ts`, `src/planner/` (6 files), `src/commands/takeover.test.ts`, `src/daemon/chunk-zero.test.ts`, `src/daemon/hooks.test.ts`. 11 files, 326 tests passed, exit 0.

A `node` script imported `PROBE_DIRECTORIES` from `dist/daemon/probeGuard.js` and counted each value in the five files this slice wrote or changed: `hits: 0`.

**What 50e must know.**

The skill must write each entry in exactly this form, appended at the end of `doc/plans/phases/reports/phase-NN-update.md` (NN as in the phase file the branch added):

```
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

- **The entry.** It starts at a line beginning `## Update`. It ends at the next line beginning `## ` or at the end of the file. The last such heading in the file is the newest; it is the only one shown.
- **Field lines.** Each is one line, `- **<label>:** <value>`, with the colon inside the bold. The labels must be exactly `Level with`, `Arrived`, `Whole test suite`, `Check scripts of this ticket`, `Check scripts of the work that arrived`, `Fixes`, `Code changed`, `Result`. A field with any other label is ignored. Order does not matter to the code, but keep the plan's order.
- **Test sets.** The value is a word, then optionally ` — ` (space, em dash, space) and one line of text. `Whole test suite` reads `passed` or `failed` only. The two check-script lines read `passed`, `failed` or `none`. Any other word, a hyphen in place of the em dash, or a missing line is read as "did not run", and the work does not pass.
- **`Result:`** reads `passes`, or `does not pass`, optionally followed by ` — <the failure>`. The failure text is shown as the first line under the heading. `does not pass` makes the work not pass even when every set passed.
- **`Code changed:`** `none`, exactly, gives "No code had to change."; any other text is shown after "What had to change:" on one line. Write what changed and why, in plain sentences.
- **`Arrived:`** is shown as written, after "What arrived on <default>:".
- **`Fixes:`** is read as a whole number; **`Level with:`** is read as text. Neither is shown today.
- Every value is shown on a pull request a person reads: plain English, no probe folder path, and no process words.

Deferred refactoring: `withUpdate` repeats `withDepartures`' body with other markers; one helper taking the two markers would serve both (it would touch `withDepartures` in `driver.ts`). `UpdateEntry.fixes` and `levelWith` have no reader yet.

## 50e — The update's instructions — merge, three test sets, two fixes by a fresh context, one record entry

**Built.** `.claude/skills/timone-update/SKILL.md` gives the update session its instructions. It has the frontmatter the skills README asks for, the target-project preamble, and the plan's seven steps in order: read the allowed list; fetch, note `<before>`, and run `node dist/cli.js update-checks <name> --before <before>` before the merge; `git merge --no-edit origin/<default>`, never rebase, force-push or GitHub's "Update branch"; run the whole test suite and each listed check script, real run only; hand failures to a fresh fix context, two fixes at most; append one entry in the plan's form, commit `docs: update NN — level with <default>` and push; ask nobody anything. It carries the fix context's brief, in the shape of `timone-verify`'s defect brief, and the two endings the update prompt gives. `.claude/skills/README.md` gains the one line the plan asks for.

**Files touched.**

- `.claude/skills/timone-update/SKILL.md` — new.
- `.claude/skills/README.md` — one dated line under the first paragraph: `timone-update` is not a stage of its own, it is a step of an open pull request, defined in `process.md` stage 8's note and started by the runner, and it commits a merge, fixes and its record on the run's branch.
- `doc/plans/phases/reports/phase-50-handoffs.md` — this section.

**Decisions taken inside the slice.**

- **A project with no test command.** The plan's form allows only `passed | failed` on the whole-suite line, and `latestUpdate` reads `none` as "did not run". `passed` and `failed` are both false when nothing ran. So the skill tells the session to write `- **Whole test suite:** none — the project has no test command` and `- **Result:** does not pass — the project has no test command, so the whole test suite could not run`. This is true, and code shows it as "The whole test suite did not run" under the heading that says the work does not pass. **No form is both true and read as a suite that ran.** The `none` word is outside the plan's two words for this line; the plan's own rule (a missing set reads as not passing) is what the section then shows.
- **How a check script is run.** `timone-verify` has no rule for one script, only the runner for the whole set. The skill says: from the project's root, with the program its extension calls for (`node` for `.mjs` and `.js`), the app started first when the script needs it, real run only, and a script fails on a non-zero exit or a clause it prints as failed. To start the app, the session may read the project's `README.md`, its package scripts and the completion report's run instructions, as `timone-verify` reads them. Plan step 1's read list does not name these; without them the session cannot run a script that needs the app.
- **One fix context per round**, given every failure of that round at once, so one round is one fix. Two failures handed separately would use both fixes at once.
- **What a fix can affect.** A fix that changes any file outside `doc/` sends the whole test suite again. Scripts are judged from the changed file names; when the session cannot tell, it runs the script again.
- **The merge commit carries the trailers.** `git merge --no-edit` writes no trailer, and the session-end check reports a commit without one. The skill keeps the plan's command and then adds the trailers with `git commit --amend --no-edit --trailer …` on the unpushed merge commit (checked in a scratch repository: the commit keeps both parents).
- **A merge the fix context could not finish** is aborted (`git merge --abort`). No set runs. The entry writes each set as `none — the merge could not be finished` and `Result: does not pass — <default> could not be merged in: <files>`. The entry is still committed and pushed.
- **A branch that already holds the default branch** (`git merge-base --is-ancestor` exits 0) gets no entry and no commit. The session ends with the prompt's ending for a branch that is not what the run says. The same ending is used for a dirty or wrong checkout, an `update-checks` exit 2, and a refused push.
- **A new record file** starts with the line `# Phase NN — Updates`. `latestUpdate` ignores it: it reads from `## Update`.
- **Lines the plan's form leaves open.** `Arrived:` with no pull request number drops the brackets; with no plan, it says what arrived in plain words. A requirement with no script is added after `; ` in the `passed` form (`passed — PRD-07.R7; no check script for PRD-07.R14`). Several failed scripts are separated by `; `.
- **A session run by hand** declares `node dist/cli.js stage update --session <id>` before the first script, as `timone-verify` does for its own step (50b made `stage` accept `update`).

**Validation evidence.** No behaviour-carrying code in this slice, so no seams were declared and there is no red-green trace; validation is checklist-based.

```
test -f .claude/skills/timone-update/SKILL.md; echo "exit: $? (expected 0)"
exit: 0 (expected 0)
grep -c "update-checks" .claude/skills/timone-update/SKILL.md
7
grep -n "rebase" .claude/skills/timone-update/SKILL.md
9:  … [ADR-0064](…) D3 is why it merges and never rebases.
77: - **Merge only.** Never rebase. Never force-push. …
182: - **Never** rebase, force-push, push, or use GitHub's "Update branch". …
npx vitest run src/daemon/prompts.test.ts; echo "exit: $?"
 Tests  228 passed (228)
exit: 0
```

Other tests that read skill files: `npx vitest run src/process-text.test.ts src/planner/plan-files.test.ts src/daemon/hooks.test.ts src/daemon/prompts.test.ts` — 4 files, 351 tests passed. No test checks skill frontmatter.

- [x] Every line of the record's form in the skill is the same as in the plan's Goal Description and in what `latestUpdate` reads. Pass. The heading from the plan's line 36 and the eight lines of lines 37–44 (backticks taken off) were written to one file, the first fenced block of the skill's *The record entry* to another, blank lines dropped; `diff` printed nothing: `IDENTICAL (9 lines)`. The skill's filled-in example is 50d's example. It was read by `latestUpdate` from `dist/runner/update-section.js`: every field came back (`wholeSuite: passed`, `ticketChecks: passed`, `arrivedChecks: none`, `fixes: 0`, `codeChanged: none`, `result: passes`), and `updateSection` gave `### Brought level with main`. The no-test-command entry gave `### This work does not pass after being brought level with main` with "The whole test suite did not run." A `passed — PRD-07.R7; no check script for PRD-07.R14` line and an `Arrived:` line with one plan lacking a number were shown as written.
- [x] The skill does not contain a probe folder's path as text. Pass. After `npm run build`, a `node` script imported `PROBE_DIRECTORIES` from `dist/daemon/probeGuard.js` (2 values) and counted each, with and without its trailing slash, in the three files this slice wrote: `hits: 0`. The skill names the folder only as "the probe folder the check uses (see `timone-verify`)" and, in the brief, "the folder the check keeps its scripts in". The session takes each script's path from `update-checks`' output.
- [x] Plain words; no metaphor. Pass, by reading: short sentences, no images or comparisons. The entry's guidance asks for plain sentences and no process words, and forbids copying a script's path into anything a person reads.

**What 50f must know.**

- The skill quotes `process.md` "stage 8's note" through the README line, but `process.md` has no such note yet. If 50f writes it, the README line becomes true as written.
- The skill writes `none` on the whole-suite line for a project with no test command, so such a project's update always shows as not passing. If that is not wanted, the plan's form and `latestUpdate` both have to change; the skill alone cannot fix it truthfully.
- The skill relies on the box switching on Timone's merge rule for `STATUS.md` and the registers. Outside a box, git's own merge applies, and a conflict in those files goes to the fix context like any other.
- GitHub's "Update branch" is forbidden by the skill's text only, as ADR-0066 accepts.

## 50f — The words that describe the update are written where the process and the glossary say what a pull request goes through

**Built.** `process.md` stage 8's note has a new dated paragraph, **The update — while a pull request is open**, placed after *How to try it* and before stage 9. It says what 50a–50e built: code tells the runner once for each new head of the default branch, whether the default branch moved past the branch or the pull request opened behind it; the runner starts `timone-update`, a step that takes a place, is not asked of the planner, and is in no default order; the update merges and never rebases, runs the three test sets (`update-checks` names the two sets of check scripts), never fixes code itself, makes at most two fixes for failing tests through a fresh fix context (conflict fixes not counted), and asks nobody anything; it appends one entry to `phase-NN-update.md`; code writes that entry at the top of the pull request between the update markers, above the departures block; delivery keeps the block first and unchanged; only pull requests a run owns are updated. The deliver skill, the glossary's **Update** entry and PRD-07's `Phases:` line each gain what the plan names.

**Files touched.**

- `process.md` — one dated paragraph in stage 8's note (`✏ 2026-10-05 ([ADR-0066](doc/adr/0066-…))`). The skills README line from 50e, which points at "`process.md` stage 8's note", is now true as written.
- `.claude/skills/timone-deliver/SKILL.md` — one dated sentence in the rule on the departures block (line 187): code also writes a block between `<!-- timone:update -->` and `<!-- /timone:update -->`; when it is there it comes first, above the departures block, and is kept unchanged in the same way. The link uses the file's `../../../doc/adr/` form.
- `CONTEXT.md` — the **Update** entry only: a dated note saying it is a step, so it takes a place; the runner starts it when told the branch is behind the default branch; it also runs when a pull request opens behind.
- `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.md` — the `Phases:` line gains `[phase 50](../../plans/phases/phase-50.md) (piece 4, #202)`, placed between piece 3 and piece 5.
- `doc/plans/phases/reports/phase-50-handoffs.md` — this section.

**Decisions taken inside the slice.**

- **Where the paragraph sits.** As its own paragraph at the end of stage 8's note, not inside the long first paragraph, which already carries four dated notes. It opens with a bold title, as *How to try it* does.
- **The fix count is written as the skill counts it**: at most two fixes for failing tests, conflict fixes not counted (ADR-0066 D4). The plan's line says "fixes at most twice"; the added clause keeps the note true to the skill.
- **Three facts the plan's line does not name were added**, each from ADR-0066 or the skill: the update is in no default order (D2), it asks nobody anything (D4), and a failed or missing test set makes the section say the work does not pass (D5, 50d). Each is one short sentence.
- **The deliver skill's sentence keeps "Where this skill says a section comes first, it means first below that block"** unchanged. With an update block present, the delivery's own sections still go below both blocks; the new sentence says the update block is above the departures block, so the order is clear.
- **The glossary note names no file, command or skill**, to keep process words out of it.

**Validation evidence.** No behaviour-carrying code in this slice, so no seams were declared and there is no red-green trace; validation is checklist-based.

```
grep -n "ADR-0066" process.md .claude/skills/timone-deliver/SKILL.md CONTEXT.md; echo "exit: $? (expected 0, each file listed at least once)"
CONTEXT.md:32:- **Update** — …
.claude/skills/timone-deliver/SKILL.md:187:- **The block between `<!-- timone:departures -->` …
process.md:56:**The update — while a pull request is open.** ✏ 2026-10-05 ([ADR-0066](…
exit: 0 (expected 0, each file listed at least once)
grep -n "phase-50" doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.md; echo "exit: $? (expected 0)"
7:> **Phases:** … [phase 50](../../plans/phases/phase-50.md) (piece 4, #202) …
exit: 0 (expected 0)
git diff -U0 -- doc/specs/ | grep -n "Status:" ; echo "(expected no output)"
(expected no output)
npx vitest run src/process-text.test.ts src/planner/plan-files.test.ts src/daemon/prompts.test.ts
 Test Files  3 passed (3)
      Tests  275 passed (275)
```

- [x] No requirement's `Status:` line changed. Pass: the `git diff` of `doc/specs/` holds no `Status:` line; the only change there is the `Phases:` line.
- [x] Plain words in every note: no metaphor, no process jargon. Pass, by reading: short sentences, no images or comparisons. The glossary note uses only glossary words (step, place, runner, default branch, pull request). The `process.md` paragraph and the skill sentence name the skill, the command and the markers, as the plan asks and as the text around them does.

A `node` script imported `PROBE_DIRECTORIES` from `dist/daemon/probeGuard.js` and counted each value in the lines this slice added to the four documents: `hits: 0`.

**What delivery must know.**

- 50e's open point is closed: `.claude/skills/README.md` points at "`process.md` stage 8's note" for `timone-update`, and that note now exists.
- The **Update** glossary entry still opens with "after another pull request of the same project merged"; the dated note adds the case of a pull request that opens behind. The opening sentence was left as written, as the other dated notes in the glossary leave theirs.
- 50e's point about a project with no test command still stands: such a project's update always shows as not passing. The words written here do not change that.
