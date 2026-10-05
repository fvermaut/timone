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
