# Phase 49 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 49a — Each project has the number of places `timone.yaml` sets, and 2 when it sets none

**Built.** A project entry in `timone.yaml` may set `places`, a whole number of 1 or more. A project that sets none has 2. The ledger (`RunStore`) is told the number per project when it is opened, and uses it both to refuse a place and to give freed places. Every command that opens the ledger tells it the number from the manifest it loads. The runner's brief says the place is `free` while fewer runs take a place than the project has. `PLACES_PER_PROJECT` is gone.

**Files touched.**

- `src/manifest.ts` — `places` on a project entry (`z.number().int().min(1, "must be 1 or more").optional()`, doc comment naming PRD-07.R2 and ADR-0065 D6); `DEFAULT_PLACES = 2`; `placesOf(config)`; `placesIn(manifest)`, which answers `placesOf` by project name and `DEFAULT_PLACES` for a project the manifest does not have.
- `src/daemon/runs.ts` — `PLACES_PER_PROJECT` deleted. `RunStoreOptions.placesOf` (default `() => DEFAULT_PLACES`), public `placesOf(project)`. `placeTakenFrom` and `givePlaces` read it. Doc comments corrected.
- `src/runner/session.ts` — `placeOf` reads `deps.store.placesOf(run.project)`.
- `src/commands/daemon.ts`, `cancel.ts`, `takeover.ts`, `status.ts` — `RunStore.open(statePath, { placesOf: placesIn(manifest) })`.
- `src/commands/guardrails.ts` — `check` loads the manifest once and passes `placesIn(manifest)`. `guard` passes `placesForGuard(...)`, a small local function that falls back to `DEFAULT_PLACES` when the manifest cannot be read. `guard`'s option type now names `manifest`, which `commonOptions` already declared.
- `src/manifest.test.ts`, `src/daemon/runs.test.ts`, `src/runner/session.test.ts` — the cases below.
- `src/commands/status.test.ts` (`ledger()`), `src/runner/actions.test.ts` (`placeWorld`), `src/runner/driver.test.ts` (`threeRuns`, and the store the restart case reopens), `src/daemon/poll.test.ts` (`newStore`) — each opens its store with `placesOf: () => 1`, case 3's change and nothing else. Granted by a plan amendment.

**Decisions taken inside the slice.**

- **`placesIn(manifest)` in `src/manifest.ts`.** The plan writes each opener as `placesOf: (name) => placesOf(<the project's config>)`. With `noUncheckedIndexedAccess` the config can be `undefined` (a run of a project removed from `timone.yaml`), so each lambda would need the same fallback. Six copies of it is the duplicated-code smell. One exported function holds the fallback instead; it is tested at the manifest seam. A project the manifest does not have gets `DEFAULT_PLACES`.
- **The guard does not fail on an unreadable manifest.** `guardrails guard` never loaded the manifest before, and it only reads the ledger. If loading it threw, the guard's catch would print an error and allow the tool call, so a broken `timone.yaml` would switch off the probe guard. `placesForGuard` gives `DEFAULT_PLACES` instead. `check` loads it as it already did.
- **`placeTakenFrom` no longer refuses only because a place is given to another run.** The old test was `taking < PLACES_PER_PROJECT && given === undefined`. A given run already counts in `taking`, so with one place the second test changed nothing. With two places it refused a run while the second place was free. It is now `taking < placesOf(project)`. An extra case at R2 clause 3 covers it (below). The run named in a refusal is still the one a place is given to, when there is one.
- **Phase 47's cases open their store with one place** through the shared helper: `newStore()` in `runs.test.ts` and `world()` in `session.test.ts` now pass `placesOf: () => 1` (`world(2)` for the new case). The cases are unchanged otherwise.
- **PLAN PROBLEM, resolved by a plan amendment granting the four files.** 14 existing tests in four files outside the first file list failed, because they opened a store with no `placesOf` and got 2 places. They are phase 47's one-place cases, exactly as case 3 describes: 2 in `src/commands/status.test.ts`, 4 in `src/runner/actions.test.ts`, 7 in `src/runner/driver.test.ts`, 1 in `src/daemon/poll.test.ts`. With `DEFAULT_PLACES` set to 1 for one run, all four files passed (240 of 240), so the default was the only cause. The amended plan grants the four files for this change only; each store helper now passes `placesOf: () => 1`, and the four files pass.

**Validation evidence.**

Per declared case (red line seen, then green):

1. `src/manifest.test.ts`, "how many places a project has (PRD-07.R2)":
   - "gives a project that sets no number 2 places (clause 1)" — red: `TypeError: (0 , placesOf) is not a function`; green.
   - "gives a project that sets 3 places 3 (clause 2)" — red: `Error: Invalid manifest: project "client-alpha": unknown key "places"`; green.
   - "refuses 0 places" — red: `AssertionError: expected [Function] to throw an error`; green. Message asserted exactly: `project "client-alpha": field "places": must be 1 or more`.
   - "refuses 1.5 places" — red: `AssertionError: expected [Function] to throw an error`; green.
   - `refuses "2" written as text` — true before code (a string is not a number to zod). Mutation: `z.coerce.number()` → `AssertionError: expected [Function] to throw an error`; reverted, green.
   - "answers each project's number by its name, and 2 for a project the manifest does not have" (`placesIn`) — red: `TypeError: (0 , placesIn) is not a function`; green.
2. `src/daemon/runs.test.ts`, "the number of places on a project (PRD-07.R2)" › "lets two runs of one project take a place when the store is told no number, and refuses a third naming one of them (clause 3)" — red: `AssertionError: expected { ok: false, holder: { …(11) } } to deeply equal { ok: true }`; green.
   Extra case, same describe: "lets a run take the second place while the first is given to another run (clause 3)" — red: `AssertionError: expected { ok: false, holder: { …(11) } } to deeply equal { ok: true }`; green after the `placeTakenFrom` change.
3. With the store's default at 2, 21 of phase 47's cases in `runs.test.ts` went red, e.g. "one step at a time on a project with one place › refuses to activate a run while another run's step takes the place" — `AssertionError: expected function to throw an error, but it didn't`. After `newStore()` passed `placesOf: () => 1`: 145 of 145 green. In `session.test.ts` the 5 cases of "a place on the project after a wake (ADR-0063 D2, D3)" went red the same way (e.g. `expected [] to deeply equal [ 'scratch-app#12/1' ]`) and green after `world()` passed one place.
4. "gives the place of a run that parks to the waiting run by its order, while the other run keeps its step (clause 4)" — green as soon as written (`givePlaces` already read the number). Mutation: `givePlaces` stops at `taking.length >= 1` → `AssertionError: expected undefined to be defined`; reverted, green.
5. "counts the places of each project on its own when two projects have different numbers" — green as soon as written. Mutation A, count every project's runs in `placeTakenFrom` → `expected { ok: false, … } to deeply equal { ok: true }`. Mutation B, read scratch-app's number for every project → `expected undefined to be 'ivtrends#1/1'`. Both reverted, green.
6. `src/runner/session.test.ts` › "tells the runner the place is free while one of the project's two places is taken (PRD-07.R2)" — red: received `- The project's place: taken: scratch-app#11/1 has a step running.`, expected `- The project's place: free.`; green after `placeOf` read `store.placesOf`.

The validation block, as run (after `npm run build`, and after the plan amendment):

```
$ npx tsc --noEmit; echo "exit: $?"
exit: 0

$ npx vitest run src/manifest.test.ts src/daemon/runs.test.ts src/runner/session.test.ts src/commands/; echo "exit: $?"
 Test Files  15 passed (15)
      Tests  450 passed (450)
exit: 0

$ grep -rn "PLACES_PER_PROJECT" src --include=*.ts | grep -vE '^\S+:[0-9]+:\s*(//|\*)'; echo "exit: $? (expected 1)"
exit: 1 (expected 1)

$ grep -rn "RunStore.open(" src/commands --include=*.ts | grep -v test.ts
src/commands/status.ts:580:        store = RunStore.open(statePath, { placesOf: placesIn(manifest) });
src/commands/cancel.ts:339:          store = RunStore.open(statePath, { placesOf: placesIn(manifest) });
src/commands/daemon.ts:631:        store = RunStore.open(statePath, { placesOf: placesIn(manifest) });
src/commands/guardrails.ts:473:        store: RunStore.open(statePath, { placesOf: placesForGuard(resolve(root, options.manifest)) }),
src/commands/guardrails.ts:605:        store: RunStore.open(statePath, { placesOf: placesIn(manifest) }),
src/commands/takeover.ts:832:          store = RunStore.open(statePath, { placesOf: placesIn(manifest) });

$ npx vitest run src/runner/actions.test.ts src/runner/driver.test.ts src/daemon/poll.test.ts; echo "exit: $?"
 Test Files  3 passed (3)
      Tests  194 passed (194)
exit: 0
```

- [x] Cases 1–6 pass, with the red run of each new case recorded above (cases 4 and 5 proved by mutation). **Pass.**
- [x] Every `RunStore.open` under `src/commands/` passes `placesOf`: `cancel.ts:339`, `guardrails.ts:473` (guard), `guardrails.ts:605` (check), `takeover.ts:832`, `daemon.ts:631`, `status.ts:580`. **Pass.**
- [x] The place-order and stale-run cases already in `runs.test.ts` stay green (148 of 148). **Pass.**

Test files run at the end, by name (after `npm run build`):

- `src/manifest.test.ts` — 53 passed.
- `src/daemon/runs.test.ts` — 148 passed.
- `src/runner/session.test.ts` — 26 passed.
- `src/commands/` — every file passed, `status.test.ts`, `cancel.test.ts`, `daemon.test.ts`, `guardrails.test.ts`, `projects.test.ts` and `takeover.test.ts` among them.
- `src/runner/actions.test.ts` (its `endRun` cases included), `src/runner/driver.test.ts`, `src/daemon/poll.test.ts` — 194 passed.
- `src/daemon/chunk-zero.test.ts`, `hooks.test.ts`, `lock.test.ts`, `step-session.test.ts`, `src/runner/tools.test.ts`, `src/workspace.test.ts`, `src/cli.test.ts`, `src/guards/checkouts.test.ts`, `src/runner/replay/harness.test.ts` — passed.
- Whole suite, once: 66 files, 1772 passed, 0 failed. `npm run replay` was not run (no model login in this container); `src/runner/replay/harness.test.ts` passed instead.

**What 49b must know.**

- `src/runner/replay/recording.ts` opens its store with no `placesOf`, so the replay now runs with 2 places. Its cases passed in the harness test.
- Wording not in this slice's files still speaks of one place: the runner's rule in `src/runner/brief.ts` line 134 ("A step needs the project's place…") and the fact label `- The project's place:`; `CONTEXT.md` **Place** ("Every project has one place until the number can be set in `timone.yaml`").
- `RunStore.placesOf(project)` is public and is what any later code should ask for the number.

## 49b — Every open, unblocked step of an initiative may be picked up

**Built.** The daemon now picks up every step ticket of an initiative that is open, not held, not taken by a person, and not blocked (by an open step or by a dependency list that came back incomplete). Before, it picked up only the first such step. A step blocked by a step that is still open is still not picked up. `timone status` still names one step as next: the first eligible one, as before.

**Files touched.**

- `src/daemon/steps.ts` — `nextStep(steps): Step | undefined` is replaced by `eligibleSteps(steps): Step[]`, every step meeting the four conditions, in the listing's order. The doc comment says why "the first" went (PRD-07.R4, ADR-0065 D6) and keeps what it said about cycles and incomplete dependency lists. The module comment now says "which steps".
- `src/daemon/poll.ts` — `Frontier.isNext` is renamed `isEligible`. `surveyInitiatives` adds every eligible step to the set; `rememberInitiative` still records the first eligible step as `next` and `nextTitle`. The comment above the frontier skip in `pollProject` is corrected (it said the skip stops fourteen steps becoming fourteen runs), and the comment on the hold skip no longer names `nextStep`.
- `src/daemon/steps.test.ts` — cases 1 and 2 added; the old `nextStep` cases renamed and rewritten against `eligibleSteps` (case 3).
- `src/daemon/poll.test.ts` — cases 4 and 5 added; two existing cases changed (see below).
- `src/daemon/chunk-zero.test.ts` — imports `eligibleSteps` in place of `nextStep`; the case "leaves piece 1's step ticket free to be taken, with nobody assigned and nothing held (R4)" now asserts `expect(eligibleSteps(steps).map((step) => step.number)).toContain(11)`. Nothing else. Granted by a plan amendment.

**Decisions taken inside the slice.**

- **Two existing poll cases encoded the old rule, and were changed so they keep their purpose.** "opens one run, not one per step" used fourteen unblocked steps; under the new rule all fourteen are eligible. Its fourteen steps now each wait for the one before, so the case still proves the mark alone does not decide. "a bug filed during a step and the next step are both picked up" had steps 51 and 52 with no blocker; step 52 would now be taken up in the first cycle, beside step 51. Step 52 now waits for step 51, and the fake tracker reports that blocker closed once step 51 is closed. Both carry a ✏ note saying why.
- **Case 5's test uses steps 3 and 4 as the two eligible ones** (step 1 closed, step 2 held), so `next` being the first eligible step is not the same as the first step in the list.
- Every old `nextStep` case was kept and renamed, not only the four the plan names, because each still checks one condition of the rule. "takes the first when every step is open" now expects all three.
- **PLAN PROBLEM, resolved by a plan amendment granting the file.** `src/daemon/chunk-zero.test.ts` also used `nextStep` (the import on line 26 and one assertion on line 446), and the plan did not list it. With `nextStep` gone, `tsc --noEmit` exited 2, the grep found those two lines, and the case "leaves piece 1's step ticket free to be taken, with nobody assigned and nothing held (R4)" failed with `TypeError: (0 , nextStep) is not a function`. The amended plan grants the file for this change only: the import now names `eligibleSteps`, and the case asserts that the numbers of `eligibleSteps(steps)` include 11.

**Validation evidence.**

Per declared case:

1. `steps.test.ts` › "eligibleSteps (PRD-07.R4, ADR-0065 D6)" › "makes steps 2 and 3 both eligible when each is blocked only by closed step 1 (clause 3)" — red: `TypeError: (0 , eligibleSteps) is not a function`; green once `eligibleSteps` filtered on the four conditions.
2. "leaves step 3 out while step 2, which blocks it, is open (clause 4)" — true as soon as written (the filter already had the open-blocker condition). Mutation: replace `!s.blockedBy.some((d) => d.open)` with `true` → `AssertionError: expected [ 2, 3 ] to deeply equal [ 2 ]`; reverted, green.
3. "eligibleSteps — the four conditions" (the old `nextStep` cases, renamed) — true before the rename, since `eligibleSteps` already existed. Mutations, each reverted:
   - hold condition removed → "leaves out an open step the machine is holding": `expected [ 11, 12 ] to deeply equal [ 12 ]`;
   - assignee condition removed → "leaves out an open step a person has taken": `expected [ 11, 12 ] to deeply equal [ 12 ]`;
   - incomplete-list condition removed → "leaves out a step whose dependency list came back incomplete": `expected [ 11, 12 ] to deeply equal [ 12 ]`;
   - open-blocker condition limited to numbers over 99 → "makes neither step eligible when two steps block each other, rather than looping": `expected [ 11, 12 ] to deeply equal []` (and the clause 4 case failed too).
4. `poll.test.ts` › "the frontier decides which step is taken" › "opens a run on each of steps 2 and 3 when both are eligible, and none on a step blocked by an open one" — red, with `poll.ts` still taking only the first eligible step: `AssertionError: expected [] to have a length of 1 but got +0`; green after `surveyInitiatives` added every eligible step.
5. "still names the first eligible step as next when two steps are eligible" — true as soon as written. Mutation: `const first = toTake[toTake.length - 1]` → `expected { project: 'alpha', …(7) } to match object { initiative: 7, …(4) }` with `next: 54, nextTitle: "4. Piece 4"` received; reverted, green.

After case 4's change, the two old-rule poll cases went red as expected: `AssertionError: expected [ Array(14) ] to deeply equal [ 51 ]` and `AssertionError: expected [ { id: 'alpha#52/1', …(7) } ] to deeply equal []`. Green after the changes described above.

The validation block, as run (after `npm run build`, and after the plan amendment):

```
$ npx tsc --noEmit; echo "exit: $?"
exit: 0

$ npx vitest run src/daemon/steps.test.ts src/daemon/poll.test.ts src/commands/status.test.ts; echo "exit: $?"
 Test Files  3 passed (3)
      Tests  178 passed (178)
exit: 0

$ grep -rn "nextStep" src --include=*.ts | grep -vE '^\S+:[0-9]+:\s*(//|\*)'; echo "exit: $? (expected 1)"
exit: 1 (expected 1)

$ npx vitest run src/daemon/chunk-zero.test.ts; echo "exit: $?"
 Test Files  1 passed (1)
      Tests  14 passed (14)
exit: 0
```

Before the amendment, `tsc` exited 2 and the grep found the two lines in `src/daemon/chunk-zero.test.ts`.

- [x] Cases 1–5 pass, with red runs recorded (cases 2, 3 and 5 proved by mutation). **Pass.**
- `tsc --noEmit` exits 0. **Pass.**
- grep finds no `nextStep` outside comments. **Pass.**

Test files run at the end, by name (after `npm run build`):

- `src/daemon/steps.test.ts` — 15 passed.
- `src/daemon/poll.test.ts` — 117 passed.
- `src/commands/` — 223 passed (`status.test.ts`, `daemon.test.ts`, `takeover.test.ts`, `cancel.test.ts`, `guardrails.test.ts` among them).
- `src/daemon/chunk-zero.test.ts` — 14 passed (after the plan amendment; before it, 13 passed and 1 failed with `TypeError: (0 , nextStep) is not a function`).
- `src/runner/actions.test.ts` (its `endRun` cases included) — 63 passed. `src/runner/driver.test.ts` — 16 passed. `src/runner/session.test.ts` — 26 passed. `src/runner/brief.test.ts` — 41 passed. `src/runner/tools.test.ts` — 4 passed.
- `src/daemon/hooks.test.ts` — 76 passed. `src/daemon/runs.test.ts` (place-order cases included) — 148 passed.
- `src/adapters/github-tickets.test.ts` — 80 passed. `src/guards/checkouts.test.ts` — 7 passed. `src/cli.test.ts` — 6 passed.
- `src/runner/replay/harness.test.ts` — 3 passed. `npm run replay` was not run (no model login in this container).

**What 49c must know.**

- In one cycle, every eligible step of an initiative is now registered as a run. Each registered step gets the claim label as before. Nothing yet stops two of them building at once beyond the project's places; the planner (49d onward) is what decides that.
- A breakdown's steps without `blocked by` relations now all start together. Step tickets opened by `openStepTickets` carry the waits the breakdown declares, so the order still holds when the breakdown writes it.

## 49c — A work branch that carries another ticket's unmerged commits is refused at its first push

**Built.** The first push of a run's work branch is refused when one of the branch's own commits (a commit the default branch does not have) is also on another `origin/timone/*` branch. The refusal names that branch: `Refused: this branch carries work of <branch> that is not on the default branch yet. Cut the work branch from the default branch, and keep only this ticket's commits on it.` A branch cut from the default branch pushes as before. A push of a branch the remote already has is not checked again. The rules that were there (the default branch refused, a reservation allowed, a step with no work branch pushes nothing) are unchanged, and they are checked first.

**Files touched.**

- `src/daemon/push-guard.ts` — `foreignCommits(own, containedBy, workBranch)`, pure, with its doc comment. `pushRefusal` takes an optional third argument, the list `foreignCommits` found (default `[]`); a non-empty list refuses a push the other rules allow.
- `src/commands/guardrails.ts` — `guardrails pre-push` calls `foreignOnFirstPush(updates, branch)`, a local function: only for the update whose `remoteRef` is the work branch and whose `remoteSha` is all zeros, it reads `git symbolic-ref --short refs/remotes/origin/HEAD`, lists `git rev-list <localSha> --not refs/remotes/origin/<default>`, asks `git branch -r --contains <sha>` for each, and returns what `foreignCommits` finds. Two small local helpers, `gitOutput` and `lines`.
- `src/daemon/push-guard.test.ts` — cases 1–3 (pure). The `remoteAndClone` fixture now runs `git remote set-head origin main` after its first push (see below).
- `src/daemon/push-guard.git.test.ts` (new) — cases 4 and 5, against a bare remote and a clone made by `git clone`, driven through `installPushGuard` and the built CLI.
- `src/commands/guardrails.test.ts` — two in-process cases of the command, run in a folder that is not a git repository (see below).

**Decisions taken inside the slice.**

- **A clone with no `origin/HEAD` refuses a work branch's first push.** The plan names `git symbolic-ref --short refs/remotes/origin/HEAD`. When it fails, the command throws, and `pre-push` refuses on any error, as it always has. A box's checkout and the daemon's own checkouts are made by `git clone`, which sets `origin/HEAD`, so this does not happen there. The old `remoteAndClone` fixture in `push-guard.test.ts` built its clone with `git init` and `git remote add`, so it had no `origin/HEAD`; three of its cases went red (`AssertionError: expected 1 to be +0` on the push to `timone/7-x`). I added one line to that fixture, `git remote set-head origin main`, with a comment saying a box's checkout is a clone. No assertion changed. I did not add a fallback (such as `git remote show origin`): the plan does not ask for one, and it would ask the network from inside a hook.
- **The branch is named without `origin/`** (`timone/12-other`), as case 2 words it. Several foreign branches are joined with " and ", each once. Each foreign commit is returned once, with the first other branch git lists for it.
- **The branch name in the refusal has no backticks**, so the sentence is the plan's words exactly. The older refusals in the same file do put branch names in backticks.
- **What `guardrails.test.ts` checks.** The command reads `process.stdin` and runs git in the current folder. The two cases stub `process.stdin`, `chdir` to a temporary folder that is not a repository (with `GIT_CEILING_DIRECTORIES` set to the temp root), and so can see whether git was asked: a push whose `remoteSha` is not zeros is allowed with nothing printed (case 5 at the command seam); a first push refuses with "could not judge this push", because git cannot answer there.
- **Not refactored:** `foreignOnFirstPush` writes `/^0+$/` again; `push-guard.ts` has the same regular expression as `NO_COMMIT`, which is not exported. Exporting it, or naming `{ sha: string; branch: string }` as a type, would remove the repeats. I left both, as the plan gives the signature inline.

**Validation evidence.**

Per declared case:

1. `push-guard.test.ts` › "a work branch that carries another ticket's unmerged commits (PRD-07.R4)" › "finds nothing, and lets the push go ahead, when no other branch has the branch's own commits (clause 2)" — red: `TypeError: (0 , foreignCommits) is not a function`; green.
2. "finds an own commit that origin/timone/12-other has, and refuses the push naming that branch" — red: `AssertionError: expected undefined to be 'Refused: this branch carries work of …' // Object.is equality`; green once `pushRefusal` read its third argument. The test asserts the whole sentence with `toBe`.
3. "does not count a commit that only the remote's copy of the work branch has" — red (the first `foreignCommits` counted every `origin/timone/` branch): `AssertionError: expected [ Array(1) ] to deeply equal []`; green once `origin/<workBranch>` was left out.
4. `push-guard.git.test.ts` › "a run's first push of its work branch, against real git (PRD-07.R4)":
   - "refuses a branch cut from another pushed timone/ branch, and names that branch" — red before the command change: `AssertionError: expected +0 not to be +0`; green after. It asserts the exact sentence in git's stderr, and that the remote has no `timone/7-x`.
   - "pushes a branch cut from origin/main" — green before the command change. Mutation: read the default branch with `symbolic-ref` without `--short` → `AssertionError: expected { status: 1, …(1) } to match object { status: +0 }` (and the refusal case failed with "could not judge"); reverted, green.
5. "does not check again a branch the remote already has" — green as written. Mutation: drop the all-zeros condition in `foreignOnFirstPush` → `AssertionError: expected { status: 1, …(1) } to match object { status: +0 }`; reverted, green.
   At the command seam, `guardrails.test.ts` › "guardrails pre-push, on the first push of a work branch (PRD-07.R4)":
   - "does not ask git about a push of a branch the remote already has" — green as written. Mutation: the same all-zeros condition dropped → `AssertionError: expected { …(2) } to deeply equal { errors: [], exitCode: undefined }`; reverted, green.
   - "asks git on the first push, and refuses the push when git cannot answer" — first run red on my own expectation (I wrote a full stop where the message has a comma); corrected to the command's words, green. Mutation: `foreignOnFirstPush` never asks git → `AssertionError: expected undefined to be 1`; reverted, green.
6. The existing push-guard cases: red after the command change on the fixture's missing `origin/HEAD` (three cases, `expected 1 to be +0`), green after the fixture line above. The default branch refused, a reservation allowed, the project's own hooks, the unreadable input: all green.

The validation block, as run (after `npm run build`):

```
$ npx tsc --noEmit; echo "exit: $?"
exit: 0

$ npx vitest run src/daemon/push-guard.test.ts src/daemon/push-guard.git.test.ts src/commands/guardrails.test.ts; echo "exit: $?"
 Test Files  3 passed (3)
      Tests  94 passed (94)
exit: 0
```

- [x] Cases 1–6 pass, with red runs recorded (cases 4's first half and 5 proved by mutation). **Pass.**
- [x] The refusal sentence in a test matches the words above exactly: `push-guard.test.ts` case 2 (`toBe`) and `push-guard.git.test.ts` case 4 (`toContain` on git's stderr). **Pass.**

Test files run at the end, by name (after `npm run build`):

- `src/daemon/push-guard.test.ts` — 41 passed. `src/daemon/push-guard.git.test.ts` — 3 passed. `src/commands/guardrails.test.ts` — 52 passed (94 for the three).
- `src/cli.test.ts` — 6, `src/daemon/session.test.ts` — 20, `src/daemon/container-runtime.test.ts` — 107, `src/daemon/hooks.test.ts` — 76, `src/daemon/forge-guard.test.ts` — 25, `src/merge-rules.git.test.ts` — 6: all passed (240).

**What 49d must know.**

- The check needs `refs/remotes/origin/HEAD` in the clone the push runs from. A clone without it refuses every first push of a work branch with "could not judge this push". Any new fixture that pushes through the guard must make its clone with `git clone`, or run `git remote set-head origin <default>`.
- The check only sees `origin/timone/*` branches the clone has fetched. A ticket branch that is on the forge but not fetched into the box is not seen.

## 49d — The build does not start without the planner's decision, and the ledger keeps that decision

**Built.** A runner's try to start the build (`start_step` at `execution`) is now refused while the ledger holds no planner's decision for the run, and the ledger writes that the run waits for the planner. A run the planner holds is refused, naming the tickets it waits for. A run the planner let build asks for a place as before. No other stage asks. The ledger keeps the decision on the run, and the run record can hold a planner's decision and the cost of a planner session, which counts on the ticket's limit. The runner's brief has a fact line for the planner and a rule under *How you act*.

**Files touched.**

- `src/daemon/runs.ts` — `planner` on `runSchema` (optional, doc comment naming ADR-0065 D2). Types `PlannerDecision` and `PlaceOrder` (the latter now also types `askPlace`'s `order`). New public methods `askPlanner(id, order)`, `decidePlanner(id, decision)`, `reaskPlanner(id)`, `waitingForPlanner(project)`, `heldByPlanner(project)`; private `byPlannerOrder`. `complete` and `cancel` are unchanged, so they keep `planner`.
- `src/runner/record.ts` — entries `planner-decision` and `planner-ended`.
- `src/runner/limit.ts` — `spentOn` adds `planner-ended` costs; doc comments say so.
- `src/runner/actions.ts` — `plannerRefusal(turn)`, asked in `startStep` for `execution` only, after `skippedBy` and before `askPlace`.
- `src/runner/brief.ts` — `PlannerFact`, `BriefInput.planner`, the fact line `- The planner: …`, the rule in `SYSTEM`, and exported `untilMergedOrClosed(tickets)`, which the refusal in `actions.ts` also uses.
- `src/runner/session.ts` — `plannerOf(run)` fills `planner` from the ledger's run.
- `src/runner/replay/recording.ts` — `placeRun` gives the case's run a let-build decision.
- `src/daemon/prompts.ts` — `recordLine` returns no line for `planner-decision` and `planner-ended`, beside `runner-ended`. Nothing else. Granted by a plan amendment (below).
- `src/daemon/runs.test.ts`, `src/runner/actions.test.ts`, `src/runner/brief.test.ts`, `src/runner/limit.test.ts`, `src/runner/record.test.ts` — the cases below. In `actions.test.ts`, `placeWorld` now also returns `wrote`, and two helpers `planningStarted` and `planningEnded` were added.

**Decisions taken inside the slice.**

- **The place order is recorded by `askPlanner`.** Its signature is `askPlanner(id, order: PlaceOrder)`, not `askPlanner(id)`: it writes `place.priority` and `place.openedAt` as `askPlace` does (the order is read from the ticket at each try, ADR-0063 D2), and sets `askedAt` only the first time. It does nothing at all when the run has a decision. A place with only those two fields takes no place and does not wait for one, so nothing else reads it differently. The one line that writes the order is now in `askPlace` and `askPlanner`; a third copy should become a helper.
- **The record's decision field is `decision`, not `kind`.** The Goal Description lists `kind` for `planner-decision`, but `kind` is the record's discriminator (`kind: "planner-decision"`). So the entry has `decision: "build" | "hold"`. The ledger's `planner.decision.kind` keeps the plan's name.
- **`PlannerFact` is a union tagged by `kind`** (`not-asked`, `deciding`, `holds` with `waitsFor` and `reason`, `let-build` with `at`), like `PlaceFact`, so `plannerText` ends with `satisfies never`. The plan wrote it as `not-asked | deciding | { holds; reason } | { letBuildAt }`.
- **Words.** Several tickets read `#7 and #9 are merged or closed` (one: `#7 is merged or closed`), in the refusal and in the fact line, through `untilMergedOrClosed`. The fact lines end with a full stop, like the place line, except the hold line, which ends with the planner's reason as given. The refusal takes a final full stop off the reason before adding its own. The rule reads: `- The build needs the planner's decision. The planner is another agent: it looks at what else on the project is being built. While it decides, or while it holds this ticket, do not start the build, and do not say on the ticket that the work has started.`
- **`reaskPlanner` on a run that is not held does nothing**, rather than throwing: the planner's loop may find the run decided by the time it acts.
- **`waitingForPlanner` and `heldByPlanner` list live runs only** (not `done`, not `cancelled`); a finished run keeps its decision as a record.
- **Existing case adapted in `actions.test.ts`:** "does not ask again for the reason of a step it already skipped with one" starts `execution` on a chore; it now gives the run a let-build decision first (✏ note in the test). It failed without it (`TypeError: Cannot read properties of undefined (reading 'end')`: no step started). No other case in a granted or ungranted file started `execution`.
- **PLAN PROBLEM, resolved by a plan amendment granting `src/daemon/prompts.ts`.** `recordLine` switches over every `RecordEntry` kind and ends with `entry satisfies never`, so with the two new entries `npx tsc --noEmit` exited 2: `src/daemon/prompts.ts(1435,7): error TS2322: Type '{ kind: "planner-decision"; …} | { kind: "planner-ended"; … }' is not assignable to type 'string[]'` and `(1435,20): error TS1360: … does not satisfy the expected type 'never'`. Vitest does not typecheck, so no test failed. The amended plan grants the file for this change only: `case "planner-decision":` and `case "planner-ended":` now sit with the cases that `return []`, beside `"runner-ended"`. `tsc` exits 0.

**Validation evidence.**

Per declared case (red line seen, then green, or mutation proof):

1. `actions.test.ts` › "the build waits for the planner's decision (PRD-07.R5, ADR-0065 D2)" › "refuses the build of a run with a committed plan and no decision, takes no place, and writes that it waits for the planner (clause 1)" — red: `AssertionError: expected { ok: true, …(1) } to deeply equal { ok: false, …(1) }` (received `Started building, in session session-1.`); green after `plannerRefusal`. Another ticket's step runs in this case, so "no place taken" is shown by the run not waiting for a place. Mutation: ask the planner after `askPlace` → `expected { ok: false, …(1) } to deeply equal { ok: false, …(1) }` (the place refusal came first); reverted, green.
2. "refuses the build of a run the planner holds, naming the ticket it waits for, and starts nothing" — green as written (the hold branch was written with case 1). Mutation: let any decision through → `expected { ok: true, …(1) } to deeply equal { ok: false, …(1) }`; reverted, green.
3. "starts the build of a run the planner let build, taking a place as any step does", and "refuses the build of a run the planner let build for want of a place, as before" — green as written. Mutation: drop the `build` early return → `expected false to be true` and `expected { ok: false, …(1) } to deeply equal { ok: false, …(1) }`; reverted, green.
4. "does not ask the planner before planning, checking, delivering or a remediation" — green as written. Mutation: ask for every stage → `planning: expected { ok: false, …(1) } to match object { ok: true }`; reverted, green.
5. `runs.test.ts` › "the planner's decision on a run (ADR-0065 D2)":
   - "keeps the time the planner was first asked when it is asked a second time" — red: `TypeError: store.askPlanner is not a function`; green.
   - "keeps a held run's decision as it was told, and stops counting it as waiting for the planner" — red: `TypeError: store.decidePlanner is not a function`; green.
   - "asks the planner again for a held run: the decision goes and the run waits for the planner" — red: `TypeError: store.reaskPlanner is not a function`; green.
   - "puts a ticket labelled priority:high first among the runs waiting for the planner, then the ticket opened first" — green as written. Mutation: sort by ticket number → `expected [ 'scratch-app#8/1', …(2) ] to deeply equal [ 'scratch-app#10/1', …(2) ]`; reverted, green.
   - "leaves the planner's decision on a run that is finished, and counts it no more" — green as written. Mutation: `heldByPlanner` counts settled runs → `expected [ { id: 'scratch-app#12/1', …(10) } ] to deeply equal []`; reverted, green.
6. "loads a ledger written before the planner existed unchanged, with no run waiting for it" — green as written. Mutation: `planner` not optional → `Invalid daemon state file "…": runs.0.planner: Invalid input: expected object, received undefined`; reverted, green.
7. `limit.test.ts` › "counts the $0.40 a planner session cost on the ticket it decided for (ADR-0065 D1)" — red: `AssertionError: expected 12.5 to be 12.9`; green. `record.test.ts` › "reads back the planner's hold and the cost of its session (ADR-0065 D2)" and "names the line number when a planner's decision has no reason" — written after the schema change, so green at once. Mutations: `reason` optional → `expected true to be false` on the malformed line; the entry renamed `planner-decided` → `ZodError` on the read-back case; reverted, green.
8. `brief.test.ts` › "the planner's decision, as the runner is told it (ADR-0065 D2)" › "writes one line under the facts for each state of the planner's decision" — red: `expected undefined to be '- The planner: not asked yet.'`; and "has a rule under How you act: …" — red: `expected '' to be '- The build needs the planner\'s deci…'`; both green.
9. Existing cases (`endRun`, the place refusal, the skip-reason refusal): unchanged and green, 68 of 68 in `actions.test.ts` with the one adaptation named above.

The validation block, as run (after the plan amendment, and after `npm run build`, which exited 0):

```
$ npx tsc --noEmit; echo "exit: $?"
exit: 0

$ npx vitest run src/daemon/runs.test.ts src/runner/; echo "exit: $?"
 Test Files  12 passed (12)
      Tests  363 passed (363)
exit: 0

$ npx vitest run src/runner/replay/; echo "exit: $?"   # in place of npm run replay
 Test Files  1 passed (1)
      Tests  3 passed (3)
exit: 0
```

Before the amendment, `tsc` exited 2 on the two `src/daemon/prompts.ts` lines quoted above, and `npm run build` printed the same errors.

- [x] `tsc --noEmit` exits 0. **Pass** (after the amendment).
- [x] Cases 1–9 pass, with red runs recorded (cases 2, 3, 4, 6 and parts of 5 and 7 proved by mutation). **Pass.**
- [x] The replay set: `npm run replay` was not run (no model login in this container); `src/runner/replay/` passed. No recorded case was changed; `placeRun` gives every case's run a let-build decision. **Pass, as far as it can be run here.**

Test files run at the end, by name (after `npm run build`):

- `src/daemon/runs.test.ts` — 154. `src/runner/actions.test.ts` — 68. `src/runner/brief.test.ts` — 43. `src/runner/limit.test.ts` — 5. `src/runner/record.test.ts` — 5. `src/runner/session.test.ts` — 26. `src/runner/driver.test.ts` — 16. `src/runner/tools.test.ts` — 4. `src/runner/replay/harness.test.ts` — 3. The rest of `src/runner/` (facts, order, departures) — 39. All passed (363).
- `src/daemon/prompts.test.ts` — 213 passed. `src/commands/` — 12 files, all passed (`status.test.ts` 46, `takeover.test.ts` 51, `guardrails.test.ts` 52, `daemon.test.ts` 26, `cancel.test.ts` 12, `record.test.ts` 14 among them).
- Before the amendment, the rest of `src/daemon/` (`poll.test.ts` among them), `src/cli.test.ts` and `src/workspace.test.ts` were also run, and passed.

**What 49e must know.**

- `askPlanner` takes the place order; `reaskPlanner(id)` keeps the order already on the run. `waitingForPlanner` gives the runs in the order the planner's loop should take them.
- A run is let build with `decidePlanner(id, { kind: "build", at, reason, onComment? })`; nothing wakes the runner yet. The record entry for a decision is `planner-decision` with `decision`, not `kind`.
- `untilMergedOrClosed(tickets)` in `src/runner/brief.ts` writes `#7 and #9 are merged or closed`; the hold comment the planner's code posts can use it.
- `recordLine` in `src/daemon/prompts.ts` writes no line for the two planner entries. A takeover prompt that should show the planner's decision needs a line there.

## 49e — The planner's facts, instructions and answers — everything but the session

**Built.** Everything a planner session needs except the session itself. `planFiles(text)` reads the files a plan names from its file markers. `gatherPlannerFacts` gathers, for the ticket being decided, its title, labels and plan (path, title, files, text), the tickets it is blocked by, every other ticket of the project that is building or has an open pull request (with its plan's files, and for an open pull request the files it changes), and the named person's comment that woke the planner. `buildPlannerBrief` writes the planner's rules and those facts. `plannerActions` gives the four actions the planner calls (`letBuild`, `hold`, `passToRunner`, `readPlan`), each checked, and `plannerToolServer` wraps them as the MCP server `planner`. The forge port has `listPullRequestFiles`.

**Files touched.**

- `src/planner/plan-files.ts` — new: `planFiles(text)`.
- `src/planner/facts.ts` — new: `gatherPlannerFacts(deps, run, cycle, comment?)`, types `PlannerFacts`, `OtherTicket`, `Plan`, `PlanFact`, `PlannerCycle`, `PlannerFactsDeps`, `PlannerFactsAdapter`.
- `src/planner/brief.ts` — new: `buildPlannerBrief(facts)`, and `planNotRead(ticket, why)`, the one sentence the brief and `readPlan` both use.
- `src/planner/actions.ts` — new: `plannerActions(deps, run, facts)`, `PlannerActions`, `PlannerActionDeps`, and `passedToRunner(at)`, the notice text (`passed to runner: comment at <at>`).
- `src/planner/tools.ts` — new: `plannerToolServer(actions)`, `plannerTools`, `PLANNER_SERVER_NAME = "planner"`, `PLANNER_TOOL_NAMES`, `qualifiedPlannerToolNames()`, and the four input schemas and types.
- `src/planner/plan-files.test.ts`, `facts.test.ts`, `brief.test.ts`, `actions.test.ts` — new: the cases below.
- `src/runner/facts.ts` — `addedOn` renamed `filesAddedOnBranch` and exported; its adapter parameter narrowed to `Pick<FactsAdapter, "listFiles">`. `PHASES` and `attempt` exported too, so the planner's facts do not copy them. No behaviour changed.
- `src/runner/actions.ts` — `namedPersonsComment` moved out of `runnerActions`'s closure to a top-level export, `namedPersonsComment(deps: NamedCommentDeps, ticket, commentAt, onlyNamed)`. Its two callers (`recordApproval`, `endRun`) pass `deps, run.ticket`. Words unchanged.
- `src/adapters/ticketing.ts` — `listPullRequestFiles(project, pr): Promise<string[]>` on the port, with its doc comment.
- `src/adapters/github-tickets.ts` — its implementation: `gh pr view <n> --repo <slug> --json files`, the `path` of each; a `gh` failure is thrown.
- `src/adapters/github-tickets.test.ts` — case 10's two cases; `listPullRequestFiles` added to the list in "every call this adapter makes can be scoped to a repository".
- The fakes `tsc` named, each given `listPullRequestFiles` answering `[]` and nothing else: `src/commands/daemon.test.ts`, `src/commands/takeover.test.ts`, `src/daemon/chunk-zero.test.ts`, `src/daemon/hooks.test.ts`, `src/daemon/poll.test.ts` (three fakes), `src/runner/actions.test.ts`, `src/runner/driver.test.ts`; and `src/runner/replay/recording.ts`.

**Decisions taken inside the slice.**

- **What counts as a path in `planFiles`.** Every code span after a marker on the same line, when it is written only in path characters and has a `/` or a known file ending (`.md`, `.ts`, `.tsx`, `.json`, `.yaml` and a few more). A marker quoted inside a code span is not a marker (phase 49's own Goal Description quotes them). A bare file name that is the last part of a path already listed is that file, not a new entry. Why, from phase 47's own text: its marker lines name `driver.ts`, `status.ts` and `session.ts` in their descriptions after the full paths; `process.md` and `CONTEXT.md` are real files at the root; `store.register` and `tsc` are code words. Phase 47 gives 32 paths. `github-pulls.test.ts`, named as an alternative "(or …)" with no full path, is kept.
- **The cycle.** `RunnerCycle` (what the runner's driver receives) has no blockers: the survey of initiatives keeps only `isStep` and `isEligible`. So `PlannerCycle = Pick<RunnerCycle, "threads"> & { blockedBy(ticket): readonly Dependency[] }`: the runner's thread reader, reused as it is, plus the survey's blockers. `blockedBy` is required, not optional, so `tsc` makes 49f supply it.
- **The comment that woke the planner** is a fourth, optional parameter of `gatherPlannerFacts`: `comment?: TicketComment`. Choosing it is the planner driver's job (49f). The facts carry it as given.
- **The run is read from the ledger** inside `gatherPlannerFacts` (`store.get(run.id) ?? run`), because a run handed in may be older than its branch. The first green run of case 2 failed on exactly this.
- **A ticket's plan** is the phase file its branch added directly under `doc/plans/phases`, through `filesAddedOnBranch`, as the runner's facts find phase files. No branch, or no file added: "Plan: none yet." More than one added: unknown, with the reason naming them. A forge failure: unknown, "the forge did not answer: …". A thread the cycle's reader cannot read is not caught: `gatherPlannerFacts` throws, and nothing is decided that cycle.
- **"Building"**: a live run of another ticket whose pull request is open (by the thread reader) counts as "open pull request", with the files from `listPullRequestFiles` (unknown when the forge fails). Otherwise it counts as building when it has a let-build decision and no `pr`, or is `active` at `execution`, `verification`, `delivery` or `remediation`.
- **One decision per session** is a flag in the actions' closure, set only by a decision that succeeded. `passToRunner` counts as that one decision, because the rules say to call exactly one of the three, once; it changes nothing in the ledger. `readPlan` is not a decision, and accepts the ticket being decided or any ticket in `others`.
- **The planner's tries are not written as `decision` entries**, unlike the runner's. Only a successful `letBuild` or `hold` writes `planner-decision`, and `passToRunner` writes its notice. The plan asked for nothing more.
- **Words.** The two comments are the excerpt's words, with `NEEDED_FROM_YOU` (bold, as every comment posted) as the last line, and go through `postComment`, which puts the 🤖 header on. The hold comment adds a full stop to the planner's reason when it has none. Refusals: `You decide for ticket #12 only, not for #7.`; `You have already decided for ticket #12 in this session. Decide only once.`; `Name at least one ticket this ticket waits for.`; `#9 is not a ticket you were shown as building, with an open pull request, or blocking this ticket. This ticket can wait only for one of those.`; a comment refused by `namedPersonsComment` ends `Only a named person can have a ticket built before the planner would let it.`; `No comment woke you, so there is no comment to pass to the runner.`; `The comment that woke you is the one at <a>, not one at <b>.`; `#9 is not a ticket you were shown, so you cannot read its plan.`; `#7 has no plan yet.`; `The plan of #7 could not be read: <why>.`
- **What I would refactor.** Small private helpers are copied because their files were not granted: `sentence` (from `src/runner/comments.ts`) in `planner/actions.ts`; `answer` (from `src/runner/tools.ts`) in `planner/tools.ts`; `quoted`, `listOrNone` and `factLine` (from `src/runner/brief.ts`) in `planner/brief.ts`. Each should become one export.

**Validation evidence.**

Per declared case (red line seen, then green, or mutation proof):

1. `plan-files.test.ts` › "finds every file phase 47 marks, once each, in the order the plan names them" — red: `Error: Failed to load url ./plan-files.js … Does the file exist?`; green. "does not take a path named in prose, on a line with no marker", "takes the files a [DELETE] marker names", "does not read a marker quoted in code as a marker" — green as written. Mutations, each reverted: every line read as marked → `expected [ 'src/daemon/runs.ts', …(1) ] to deeply equal [ 'src/runner/actions.ts' ]` (and the phase 47 case failed); `DELETE` taken out of the marker pattern → `expected [] to deeply equal [ 'src/commands/retry.ts', …(1) ]`; a marker anywhere in the line counted → `expected [ 'src/planner/plan-files.ts' ] to deeply equal []`; bare names not dropped → `expected [ 'src/daemon/runs.ts', …(34) ] to deeply equal [ 'src/daemon/runs.ts', …(31) ]`.
2. `facts.test.ts` › "lists a ticket building and a ticket with an open pull request, each with its files, and not one done or held" — red: `Error: Cannot find module './facts.js'`; then `expected { kind: 'known', value: undefined } to match object { kind: 'known', value: { …(3) } }` (the stale run, above); green. Mutations, each reverted: done runs not skipped → `expected [ { number: 7, …(3) }, …(2) ] to deeply equal [ { number: 7, …(3) }, …(1) ]`; a hold counted as building → the same; pull request files not read from the adapter → `expected [ { number: 7, …(3) }, …(1) ] to deeply equal [ { number: 7, …(3) }, …(1) ]` (C's files differ). Added: "tells an unreadable plan as a fact with its reason, and takes the blockers from the cycle's survey" — green as written; mutations: the plan's read not caught → `Error: gh api failed after 3 attempts: ECONNRESET`; blockers not read → `expected [] to deeply equal [ { number: 8, …(2) } ]`.
3. `actions.test.ts` › "posts one comment naming #7 and the reason, ending with what is needed, and writes the hold in the ledger and the record (clause 1)" — red: `Error: Cannot find module './actions.js'`; green.
4. "refuses a hold on a ticket the facts did not show, posts nothing and decides nothing" — red: `expected { ok: true, …(1) } to deeply equal { ok: false, …(1) }`; green. Added: "refuses a hold that names no ticket to wait for" — red, the same line; green. "holds a ticket for a ticket it is blocked by, though that one is not building" — green as written; mutation, blockers left out of what a hold may name → `expected false to be true`.
5. "lets the ticket build on a named person's comment, and the comment it posts names that person (clause 2)" — red: `TypeError: actions.letBuild is not a function`; green. Added: "posts nothing when it lets a ticket build on its own judgement" — green as written; mutation, always post → `expected [ { number: 12, …(1) } ] to deeply equal []`.
6. "refuses a comment by someone not named for the project, and leaves the hold as it was (clause 3)" and "refuses a comment the machine posted, even under a named person's login (clause 3)" — green as written (the check came with case 5). Mutation, `namedPersonsComment`'s refusal ignored → both `expected { ok: true, …(1) } to deeply equal { ok: false, …(1) }`; reverted.
7. "refuses a second decision in the same session, and keeps the first" and "refuses a decision for a ticket other than the one being decided" — red: both `expected { ok: true, …(1) } to deeply equal { ok: false, …(1) }`; green.
8. "writes that the comment was passed to the runner, and leaves the run waiting for a decision", with "refuses to pass a comment other than the one that woke the planner" and "refuses to pass a comment when none woke the planner" — red: `TypeError: actions.passToRunner is not a function`; green. `readPlan`'s four cases — red: `TypeError: actions.readPlan is not a function`; green.
9. `brief.test.ts` — four cases ("lists the ticket and each ticket building or with an open pull request, with their files", "says the comment that woke the planner, and who wrote it", "says when no comment woke the planner", "names the three tools that decide in its rules, and asks for exactly one, once") — red: `TypeError: (0 , buildPlannerBrief) is not a function`; green.
10. `github-tickets.test.ts` › "lists the paths of the files a pull request changes (ADR-0065 D3)" and "lets a forge failure travel when it lists a pull request's files, and never answers an empty list for it" — red: `TypeError: (intermediate value).listPullRequestFiles is not a function` (and `adapter.listPullRequestFiles is not a function` in the scope case); green. `tsc` then named the ten fakes listed above; with each given the method, it exits 0.

The validation block, as run (after `npm run build`, which exited 0):

```
$ npx tsc --noEmit; echo "exit: $?"
exit: 0

$ npx vitest run src/planner/ src/adapters/ src/runner/actions.test.ts src/runner/facts.test.ts; echo "exit: $?"
 Test Files  12 passed (12)
      Tests  299 passed (299)
exit: 0

$ grep -rn "function namedPersonsComment\|function addedOn\|function filesAddedOnBranch" src --include=*.ts | grep -v test.ts
src/runner/facts.ts:230:export async function filesAddedOnBranch(
src/runner/actions.ts:446:export async function namedPersonsComment(
```

- [x] Cases 1–10 pass, with red runs recorded (case 6, and the added cases noted, proved by mutation). **Pass.**
- [x] `namedPersonsComment` and `addedOn` each have one definition under `src/` (the latter as `filesAddedOnBranch`). **Pass.**

Test files run at the end, by name (after `npm run build`):

- `src/planner/` — `plan-files.test.ts` 4, `facts.test.ts` 2, `brief.test.ts` 4, `actions.test.ts` 17. `src/adapters/` — every file, `github-tickets.test.ts` 82 among them. With `src/runner/actions.test.ts` 68 and `src/runner/facts.test.ts` 13: 299 passed.
- `src/runner/` (every file, `replay/harness.test.ts` included, in place of `npm run replay`), `src/commands/daemon.test.ts` 26, `src/commands/takeover.test.ts` 51, `src/commands/record.test.ts` 14, `src/daemon/chunk-zero.test.ts` 14, `src/daemon/hooks.test.ts` 76, `src/daemon/poll.test.ts` 117: all passed (493 in the first 16 files, 14 in the last).

**What 49f must know.**

- `pollProject` builds `cycle = { tickets, isStep, threads }`. The planner needs `blockedBy(ticket)` on it too: the survey (`surveyInitiatives`) has each step's `blockedBy` in hand but keeps none of it. A ticket that is not a step answers `[]`.
- Call `gatherPlannerFacts({ store, adapter, project }, run, cycle, comment)` with the comment the driver chose (a named person's, already checked), or none. It throws only when the cycle's thread reader throws.
- Build `plannerActions(deps, run, facts)` once per session: the one-decision rule lives in it. `deps` is `{ store, adapter, manifest, project, root, clock }`. Give the session `plannerToolServer(actions)` and allow `qualifiedPlannerToolNames()`.
- The notice the runner's driver must look for is `passedToRunner(at)` from `src/planner/actions.ts`, written as a `notice` entry. The planner's driver writes its own `planner read comment at <at>` notice; nothing here writes it.
- `letBuild` and `hold` write `planner-decision`; neither wakes the runner. `plannerLetBuildEvent` and the `planner-ended` entry are 49f's.
