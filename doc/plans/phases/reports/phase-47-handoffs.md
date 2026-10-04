# Phase 47 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 47a — The ledger gives places — a running step or a given place takes one, and a freed place goes to one waiting run in order

**Built.** The run ledger (`RunStore`) now keeps the place rule of ADR-0063 D1–D3. A run takes a place on its project while it is `active` and not held by a person's terminal, or while a place is given to it (`place.givenAt`). A work branch, an open pull request, a wait for a person and a run just picked up take no place. A project has `PLACES_PER_PROJECT = 1` place. A move into `active` is refused with the new `NoPlaceError` when the run is not taken over, no place is given to it, and other runs already take every place. The message names the run that takes the place: `No place is free on scratch-app: run scratch-app#7/1 has a step running.` or `… the place is given to run scratch-app#7/1.` A run asks with `askPlace(id, { priority, openedAt })`; a refused run waits (`place.waitingSince`). Whenever a transition, `giveBack`, `leaveTurn` or `regivePlaces` frees a place, the ledger gives it in the same write to the first waiting run: `priority` true first, then the earliest `openedAt`, then the lowest ticket number. A run whose step ends (`active → parked`) and that has asked for a place before waits again with its own order, so it keeps the place when it comes first. `complete` and `cancel` clear `place`. `claim(id, holder, { takeover: true })` marks the run `takenOver`, takes no place, and is not refused for want of one; any move out of `active` clears the mark. `register` always writes `picked-up`. A `queued` run in an older ledger is read as `picked-up` (`normaliseQueued`). `claimBranch` is a plain setter. The old queue (`queue`, `queuePosition`, `promoteQueue`, `promoteHead`), `occupyingRun`, `loadedOccupyingRun`, `loadedRunningRun` and `holdsProject` are deleted. Every pickup now posts the "Picked this up" comment.

**Files touched.**

- `src/daemon/runs.ts` — `RunStatus` and the zod enum lose `queued`; `TRANSITIONS` loses its row; `normaliseQueued` added to the load path; `place` and `takenOver` added to `runSchema`; `PLACES_PER_PROJECT`, `NoPlaceError`; private `takesPlace`, `byPlaceOrder`, `whoTakesThePlace`, `placeTakenFrom`, `givePlaces`, `loadedWaitingForPlace`; public `askPlace`, `giveBack`, `leaveTurn`, `regivePlaces`, `waitingForPlace`, `placeHolders`; `transition` keeps the place rule; `claim` takes `{ takeover }`; `complete`/`cancel` clear `place`; `claimBranch` is a setter; the deleted methods are gone; `TERMINAL` is gone (only `promoteHead` read it); the class doc comment states the place rule and names ADR-0063; other doc comments that described the old rule are updated.
- `src/daemon/runs.test.ts` — new describe "places on a project (ADR-0063)" with cases 1–11; the three describes of the old rule rewritten and renamed ("one step at a time on a project with one place", "what takes a place on a project", "giving a freed place"); other tests that called a deleted method rewritten (list below).
- `src/daemon/poll.ts` — `queuedComment` and the `queued` branch of the pickup go; `PollResult.queued` goes; `store.promoteQueue` goes.
- `src/daemon/poll.test.ts` — cases that asserted a queued run, a queue comment, a promotion or `result.queued` rewritten (list below).
- `src/commands/takeover.ts` — `case "queued"`, the queued check in `enrolFromTracker`, and `queuedMessage` go.
- `src/commands/takeover.test.ts` — three tests that built a queued run rewritten.
- `src/commands/cancel.ts` — `case "queued"` goes.
- `src/commands/status.ts` — `describeProject` stops reading `queued`; two doc comments updated.
- `src/commands/status.test.ts` — one test that built a `queued` run rewritten.
- `src/runner/driver.ts` — `projectFreeFor` reads `placeHolders`; two doc comments updated.
- `src/runner/driver.test.ts` — in the 40u describe, #13's run (and #14's) has a step running at setup (see the departure below).
- `src/runner/session.ts` — two comments that spoke of a queued run.
- `doc/plans/phases/reports/phase-47-handoffs.md` — this file.

**Decisions taken inside the slice.**

- **The count leaves out the run itself.** `askPlace` and the refusal in `transition` count the *other* runs that take a place. Otherwise `activate` after `claim` (the `startStepSession` path: `active → active`) would refuse a run because of its own step.
- **When the place is given to another run, that run is the one named.** `placeTakenFrom` answers the run given the place first, then the first run with a step running. With one place the two cannot both exist.
- **`askPlace` that answers ok leaves `waitingSince` as it is.** Entering `active` clears it. A run that is ok and then starts no step is the runner's to clear with `leaveTurn`.
- **`giveBack` does not put the run back in the waiting list.** If it did, the run would come first again and get the place straight back, and `giveBack` would do nothing. So for a run given the place, `giveBack` and `leaveTurn` do the same thing; they differ only for a run that waits and has no place given (`giveBack` leaves it waiting, `leaveTurn` stops its wait).
- **`givePlaces` runs at the end of every transition**, not only on moves out of `active` and into `done`/`cancelled`. It gives only a free place to a waiting run, so on other moves it does nothing. This is simpler and cannot miss a move that frees a place (for example a takeover claim on a run whose place was given).
- **Order of `openedAt` is compared with `Date.parse`.** An unreadable time falls through to the ticket number.
- **The `NoPlaceError` message is the first sentence of the refusal words in the plan.** The second sentence ("This ticket now waits for its turn, …") belongs to the runner's action, which 47b writes.
- **`PollResult.queued` is removed.** Nothing wrote it any more and only `poll.test.ts` read it. Both files are in this slice.
- **`takeover.ts` and the `claim-takeover` handler in `poll.ts` still call `claim` without `{ takeover: true }`.** The excerpt changes only the `queued` branches there. So a takeover while another ticket's step runs is still refused (now with `NoPlaceError`). A later slice must pass the option to deliver D5.
- **Mutations** were temporary edits of `src/daemon/runs.ts`, copied back from a saved copy straight after the run.

Refactor I would do but did not: the place logic (`takesPlace`, `byPlaceOrder`, `placeTakenFrom`, `givePlaces`) could live in its own small module beside `runs.ts`, which is now over 1,800 lines; the test helper `waitingForAPlace` is written twice in `runs.test.ts` (two describes); `src/commands/status.ts` keeps its own copy of `RUNNING`.

**Validation evidence.**

Every red/green run was `npx vitest run src/daemon/runs.test.ts -t <name>`.

1. *"lets another ticket's step start while a run waits on its open pull request (R1 clause 1)"* and *"… while a run on a branch waits for a person (R1 clause 2)"* — red: `Error: Run scratch-app#8/1 cannot go from queued to parked (allowed: picked-up, cancelled)`. Green after `register` wrote `picked-up`, `askPlace` was added, and the "one work branch" refusal was deleted. Deleting `holdsProject` then broke `claimBranch` (`ReferenceError: holdsProject is not defined`), so `claimBranch` became a setter here.
2. *"picks a ticket up while another ticket's step runs, and writes it picked up (D2)"* — **could not go red honestly**: `register` already wrote `picked-up` after case 1. Mutation: `register` writes `queued` when another run holds the project → `AssertionError: expected 'queued' to be 'picked-up'`. Reverted → green.
3. *"reads a queued run an older ledger holds as picked up, and the same on every load (D2)"* — red: `AssertionError: expected 'queued' to be 'picked-up'`. Green after `normaliseQueued`. The test also checks that two loads give the same runs and that the file's bytes are unchanged.
4. *"refuses a place while another ticket's step runs, naming that run, and writes that the run waits"* — red: `AssertionError: expected true to be false`. Green after `NoPlaceError`, `placeTakenFrom`, `waitingForPlace`, `placeHolders` and the refusal in `transition`.
5. *"gives the freed place to the ticket labelled priority:high, in the write that freed it (R3 clause 1)"* — red: `expected undefined to be defined` (the place read back from a fresh store over the same file). *"… opened first on the forge, not the one picked up first (R3 clause 2)"* — red: `expected [] to deeply equal [ 'scratch-app#9/1' ]`. *"… the lower ticket number when both were opened at once (R3 clause 2)"* — red: `expected [] to deeply equal [ 'scratch-app#8/1' ]`. Green after `givePlaces` was called inside `transition`.
6. *"gives a place given back to the next run in order (R3 clause 4)"* — red: `TypeError: store.giveBack is not a function`. *"gives the place of a run that leaves its turn to the next run, and the run stops waiting (R3 clause 4)"* and *"stops a run that leaves its turn before a place is given to it from waiting"* — red: `TypeError: store.leaveTurn is not a function`. Green after both methods.
   - Extra: *"uses a given place when the run's step starts, so the step takes the place itself"* — red: `AssertionError: expected '2026-08-02T10:09:00Z' to be undefined`. Green after entering `active` cleared `givenAt` and `waitingSince`.
7. *"gives the place back to a run whose step just ended when nobody else waits (D2)"* and *"gives the place to an older waiting ticket when a step ends, and the ended run waits behind it (D2)"* — red: `expected [] to deeply equal [ 'scratch-app#7/1' ]` (both). Green after `active → parked` set `waitingSince` on a run that took a place and has `place` recorded.
8. *"lets a takeover hold a run while another ticket's step runs, and the takeover takes no place (R2 clause 6, R13)"* — red: `NoPlaceError: No place is free on scratch-app: run scratch-app#7/1 has a step running.` A first try that set `takenOver` on the run before calling `transition` stayed red, because `transition` re-reads the file; the mark is now passed into `transition`. Green then. *"stops marking a run taken over once it leaves active"* — **could not go red honestly** (nothing set the mark before). Mutation: remove the line that clears `takenOver` → `AssertionError: expected true to be undefined`. Reverted → green.
9. *"takes back a place given and not used when the daemon starts, and gives it again by order (D3)"* — red: `TypeError: store.regivePlaces is not a function`. Green after `regivePlaces`. Mutation for "an active run is untouched": make `regivePlaces` act on every run with a `place` → `AssertionError: expected { id: 'ivtrends#3/1', …(9) } to deeply equal { id: 'ivtrends#3/1', …(10) }`. Reverted → green. (Removing only the `status === "active"` guard does not fail the test, because entering `active` already clears `givenAt`.)
10. *"gives the place to the next waiting run when the run it was given to is cancelled"* — red: `AssertionError: expected { priority: false, …(2) } to be undefined`. Green after `complete` and `cancel` cleared `place`. *"gives the place to the first waiting run when the run with a step running completes"* — **could not go red honestly** (`givePlaces` already ran in every transition). Mutation: remove the `givePlaces` call from `transition` → `expected [] to deeply equal [ 'scratch-app#8/1' ]`. Reverted → green.
11. *"lets a run claim a branch while another run of the project owns one and is parked (D1)"* — **could not go red honestly**: `claimBranch` became a setter in case 1. Mutation: put back a refusal when another run is parked on a branch → `Error: MUTATED: run scratch-app#7/1 already holds it`. Reverted → green.
12. The stale-run, reclaim and holder tests in `runs.test.ts` ("the heartbeat, and the runs that have stopped making one", "a heartbeat belongs to the session that wrote it", "who is holding a run", "the witness …") and in `poll.test.ts` ("reclaiming a run its daemon left behind" and the others), and every test in `src/daemon/steps.test.ts`, were not edited and pass.

*Pre-existing tests whose assertion changed* (old assertion → new assertion → requirement). Every one asserted PRD-02.R10's rule, unless the line says otherwise.

`src/daemon/runs.test.ts`:

- register › "activates a pickup on an idle project" — `occupyingRun` is #7 → `placeHolders` is empty → PRD-07 R2 clause 5.
- register › "queues a pickup on a busy project", now "picks up a second ticket of a project beside the first, rather than queueing it" — status `queued`, `queue` [8], position 1 → `picked-up`, `placeHolders` and `waitingForPlace` empty → PRD-07 R2 clause 5 (ADR-0063 D2).
- two chunks › "hands back the live chunk rather than opening a second beside it" — the line `occupyingRun` is #7/1 removed; the rest unchanged → PRD-07 R1 clause 2.
- two chunks › "queues a ticket's next chunk behind another ticket's work", now "picks up a ticket's next chunk while another ticket's run owns a branch" — `queued`, `queue` [#7/2] → id #7/2, `picked-up` → PRD-07 R1 clause 2.
- one-active-run › "refuses to activate a run while another occupies the project", now "… while another run's step takes the place" — throws `/scratch-app/` → throws `NoPlaceError` with the exact message naming #7/1 → PRD-07 R2 clause 3.
- one-active-run › "refuses transitions the lifecycle does not allow" — parking a queued run throws `/queued/` → parking a done run throws `/cannot go from done to parked/` → ADR-0063 D2 (no `queued`; lifecycle, not a place requirement).
- one-active-run › "keeps a parked run holding its project once it owns a branch", now "lets another ticket's step start while a parked run owns a branch" — `occupyingRun` #7, second `queued` → `placeHolders` empty, second `picked-up` and activates → PRD-07 R1 clause 2.
- holds-the-project › "lets a branchless parked run go, …" — `occupyingRun` undefined → `placeHolders` empty → PRD-07 R2 clause 5.
- holds-the-project › "starts holding the project the moment a run claims a branch", now "takes no place when a parked run claims a branch" — `occupyingRun` is the run, second `queued` → `placeHolders` empty, second `picked-up` → PRD-07 R1 clause 2, R2 clause 5.
- holds-the-project › "parks several branchless runs side by side" — `queue` empty → `waitingForPlace` empty → PRD-07 R2 clause 5.
- holds-the-project › "still runs one session at a time, …", now "still runs one step at a time, …" — third run `queued` → `picked-up`; the refusal naming #8 kept → PRD-07 R2 clause 3.
- holds-the-project › "frees the session slot when a branchless run parks", now "gives the place to the waiting run when a branchless run's step ends" — second `queued` → `picked-up` → second is the one place holder → PRD-07 R3.
- holds-the-project › "does not promote the queue behind a run that parked holding a branch", now "gives the place to the waiting run when a run on a branch parks" — second stays `queued`, #7 holds → second is given the place → PRD-07 R1 clause 2, R3.
- holds-the-project › "promotes the queue when a branch-holding run finally ends", now "gives the place to the waiting run when a run on a branch ends with its step running" — second `queued` → `picked-up` → second is given the place → PRD-07 R3.
- holds-the-project › "enforces the rule in the store rather than trusting its callers" — `claimBranch` throws `/scratch-app#8/` → `claimBranch` succeeds and `claim` throws `/scratch-app#8/` → PRD-07 R1, R2 clause 3 (ADR-0063 D1).
- holds-the-project › "refuses to resume a parked run while another holds the project on a branch", now "resumes a parked run while another run waits on its own branch" — throws `/scratch-app#8.*timone\/8-export/` → becomes `active` → PRD-07 R1 clause 2.
- holds-the-project › "promotes a run left queued behind a park that no longer holds anything", now "reads a run an older ledger queued behind a park on a branch as picked up, free to start" — `promoteQueue` answers #6 → the raw `queued` run reads `picked-up`, no place holder, and it activates → ADR-0063 D2, PRD-07 R1.
- holds-the-project › "promotes nothing while the project is held", now "gives no place while a run's step takes it" — `promoteQueue` answers #7, second `queued` → `placeHolders` [#7], `waitingForPlace` [#8] → PRD-07 R2 clause 3.
- promotion › "promotes the head of the queue when a run completes", now "gives the place to the first waiting run when a run completes" — `occupyingRun` #8, `queue` [9] → `placeHolders` [8], `waitingForPlace` [9] → PRD-07 R3 clause 2.
- promotion › "promotes in pickup order, not ticket order", now "gives the place by when the ticket was opened, not by pickup order" — #12 by pickup order → #12 by `openedAt`, picked up after #3 → PRD-07 R3 clause 2.
- promotion › "leaves the project idle when nothing is queued", now "… when nothing waits" — `occupyingRun` undefined, `queue` empty → `placeHolders` and `waitingForPlace` empty → PRD-07 R3.
- persistence › "round-trips state through the file" — `occupyingRun` parked, `queue` [8] → `placeHolders` empty, #8 `picked-up` → PRD-07 R1 clause 2.
- persistence › "starts empty when no state file exists yet" and "reads a ledger written before runs had chunk numbers" — `occupyingRun` undefined → `placeHolders` empty (same meaning, deleted method).
- the pull request on a run › "holds the project while parked on a review, and frees it on completion", now "frees the project while parked on a review, so another ticket's step starts (PRD-07 R1)" — second `queued` until the merge → second `picked-up` and activates while the pull request waits → PRD-07 R1 clause 1.
- cancelling › "cancels a queued run, recording why", now "cancels a run picked up while another ticket's step runs, recording why" — name only; assertions unchanged.
- cancelling › "frees the project for whatever was queued behind it", now "gives the place to the run waiting for it when the run with a step running is cancelled" — second `queued` → `picked-up`, holds → second is given the place → PRD-07 R3.
- two processes › "shows another process's claim to a guard that has itself written nothing" — `occupyingRun` undefined, then the run → `placeHolders` empty, then [the run] (ADR-0023 unchanged) → PRD-07 R2.
- old code › "gives the same converted runs on a second load, …" — calls `placeHolders` in place of `occupyingRun` (a read; no assertion changed).
- old code › "keeps a converted run on a branch holding its project, and one without a branch not", now "lets no converted run take a place, on a branch or not" — #24 holds scratch-app → no place holder on either project; #24's wait is still the runner's → PRD-07 R1 clause 1.

`src/daemon/poll.test.ts`:

- "registers a run and acknowledges exactly once for a marked ticket" — `occupyingRun` #7 → #7 is `picked-up` (deleted method).
- serialization › "queues a second marked ticket and says so in its acknowledgement", now (describe "two tickets of one project") "picks a second marked ticket up beside the first, and says it is picked up" — `queue` [8], `result.queued`, comment matches `/queue/` and `#7`, only #7 woken → `pickedUp` [#7, #8], the comment is `pickedUpComment()`, both woken → PRD-07 R2 clause 5 (ADR-0063 D2).
- serialization › "picks the queued ticket up on a later cycle, once the first is done", now "wakes the second ticket's runner on the first cycle, without waiting for the first to be done" — #8 woken only after #7 is done → #8 woken in the first cycle → ADR-0063 D2.
- resilience › "carries on with the other projects when one fails" — `occupyingRun("beta")` #2 → beta's runs are [#2] (deleted method).
- "starts a run left queued behind a park that no longer holds anything" — the loaded run is `queued` → `picked-up` → ADR-0063 D2.
- "promotes the waiting bug, and opens the next step behind it", now (describe "a bug filed during a step and the next step are both picked up") "wakes the waiting bug, and opens the next step beside it" — step 52 not woken and `queued` → woken and `picked-up` → PRD-02.R22 clause 6 (struck by ADR-0063 D6) → PRD-07 R2, R3.
- "a project called `timone`" › "registers a run and picks it up" — `occupyingRun` #39 → #39 is `picked-up` (deleted method).
- the limit test ("… over its limit …", line ~3178) — `occupyingRun` undefined → `placeHolders` empty (deleted method).
- 40u › "wakes the refused run once, when the other ticket's run has finished and its ticket closed" — #8 `picked-up` held the project, refusal text "one session per project" → #8 has a step running at setup, refusal text `No place is free on scratch-app: run … has a step running.`; the expected wakes are unchanged → PRD-07 R2 clause 5.
- old code, first cycle › "asks for no wake and posts nothing …" — the line `result.queued` is empty removed (field removed).
- old code, first cycle › "picks a converted failed run's ticket up again …" — `pickedUp` [ivtrends], `queued` [scratch-app#21/2], a queue comment → `pickedUp` [scratch-app#21/2, ivtrends#88/2], both woken, both "Picked this up" → PRD-07 R1 clause 1.

`src/commands/takeover.test.ts`:

- "explains a queued ticket rather than starting it out of turn", now "says it is working on a ticket picked up while another run is parked on its branch" — message `/queue/` → `/working on .* right now/` (the answer for every picked-up run) → ADR-0063 D2.
- "queues a ticket behind the run holding its project, rather than opening a second session", now "opens a session on a new ticket while another run is parked on its branch" — `nothing-to-do` `/queue/`, status `queued` → `open-session`, status `parked` → PRD-07 R13, R1 clause 2.
- "starts nothing for a queued run, says it is in the queue, and leaves it queued", now "starts nothing for a run picked up while another run is parked on its branch, and says it is being worked on" — the queue sentence, status `queued` → "I'm working on scratch-app #6 right now. …", status `picked-up` → ADR-0063 D2. The describe is renamed "a takeover of a run that is picked up or running".

`src/commands/status.test.ts`:

- "shows how many tickets are queued behind the active one", now "names the tickets picked up beside the active one, and no queue" — `/2 queued/`, `#8`, `#9` → `#8`, `#9`, no `queued` → ADR-0063 D2 (47f adds the waiting list).

`src/runner/driver.test.ts`:

- 40u describe (three tests: "… when the run that held the project's session ends", "… parks without a branch", "wakes it again after a new refusal …") — #13's (and #14's) run was `picked-up` and held the project's one session → it has a step running (`active`) at setup; the `store.activate(second…)` lines before `complete` go. Expected wakes unchanged → PRD-07 R2 clause 5. See the departure note under 47b.

*Validation commands* (from `projects/timone`):

```
$ npx tsc --noEmit; echo "exit: $?"
exit: 0

$ npx vitest run src/daemon/runs.test.ts src/daemon/poll.test.ts src/daemon/steps.test.ts src/commands/ src/runner/driver.test.ts src/runner/session.test.ts; echo "exit: $?"
 Test Files  16 passed (16)
      Tests  504 passed (504)
exit: 0

$ grep -rnE "holdsProject|promoteQueue|queuePosition|one work branch at a time" src --include=*.ts | grep -vE '^\S+:[0-9]+:\s*(//|\*)'; echo "exit: $? (expected 1)"
exit: 1 (expected 1)

$ grep -rn '"queued"' src --include=*.ts | grep -v test
src/daemon/runs.ts:1814:  if (!("status" in run) || run.status !== "queued") return run;
```

The names `holdsProject`, `promoteQueue`, `queuePosition`, `occupyingRun`, `promoteHead`, `loadedRunningRun`, "one work branch at a time" and "one session per project" do not appear anywhere in `src`, comments included.

Checkboxes of the excerpt:

- [x] Cases 1–12 pass, with the red run of each new case recorded above (cases 2, 11, and one test each of 8 and 10, could not go red honestly; each has a mutation that fails it).
- [x] The list of every pre-existing test whose assertion changed, with the old assertion and the requirement that replaced it, is above.
- [x] No `queued` value is written anywhere: the grep shows only the normalisation.

*Test files run at the end*, all passing (30 files, 797 tests): `src/commands/` (all), `src/daemon/chunk-zero.test.ts`, `src/daemon/hooks.test.ts`, `src/daemon/lock.test.ts`, `src/daemon/poll.test.ts`, `src/daemon/runs.test.ts`, `src/daemon/step-session.test.ts`, `src/daemon/steps.test.ts`, `src/daemon/pipeline.test.ts`, `src/runner/` (all, including `actions.test.ts`, `tools.test.ts`, `driver.test.ts`, `session.test.ts`, `replay/harness.test.ts`). These are every test file that imports `daemon/runs` or uses `RunStore`, plus `pipeline.test.ts`.

**What 47b must know.**

- `askPlace` does not look at the run's status. Call it before `claim`. On `{ ok: false, holder }` the run now waits; the refusal words of the plan can be built from `holder` (or from `NoPlaceError`'s message, which is their first sentence).
- A run whose step ends (`active → parked`) waits again by itself if it has ever asked for a place. So the runner side must call `leaveTurn` when a wake ends with no step started and no try refused, and `giveBack` when a given place was not used. Nothing calls `askPlace`, `giveBack`, `leaveTurn` or `regivePlaces` in production yet; `regivePlaces` is for daemon start (47c).
- `claimBranch` never refuses any more, so the catch in `branchFor` (`src/runner/actions.ts`) that says "The project is busy, so no step can start" can now only see other errors. Today a busy project is refused at `claim` in `startStepSession`, with `NoPlaceError`.
- A run just picked up no longer blocks another run's step. `staleRuns` still reads `RUNNING` (`picked-up`, `active`), unchanged.
- `takeover.ts` and the `claim-takeover` handler in `poll.ts` (around line 690) do not pass `{ takeover: true }` yet.
- Departure for the orchestrator to record: the excerpt says the tests of `driver.ts` change "only where they built a `queued` run". Three tests in its 40u describe built no queued run, but relied on a `picked-up` run holding the project's one session, which ADR-0063 D1 removes. They could not pass unchanged, so their setup now gives the other run a step running. Their expected wakes did not change.

## 47b — A step asks for a place, and a refused step leaves its run waiting for its turn

**Built.** `startStep` in `src/runner/actions.ts` now asks the ledger for a place before a step starts. It calls `askPlace(run.id, { priority, openedAt })` with `priority` true when the ticket carries `priority:high` and `openedAt` the ticket's `createdAt`. When no place is free, the action refuses with the plan's words, for example: `No place is free on scratch-app: run scratch-app#7/1 has a step running. This ticket now waits for its turn, and you are woken when a place is given to it.` The ledger writes that the run waits; no branch is claimed, no comment is posted, the stage is not changed, and no step starts. When `deps.startStep` throws `NoPlaceError` (another run took the place between the ask and the start), the action asks for a place once more, which writes that the run waits, and gives the same refusal. The stage is put back by the existing `catch`. `branchFor` no longer catches a refusal, since `claimBranch` cannot refuse; it now returns the branch name or undefined. `PRIORITY_LABEL = "priority:high"` is exported from `src/daemon/steps.ts`, beside `HELD_LABEL`.

**Files touched.**

- `src/runner/actions.ts` — `askPlace` in `startStep`; the private `noPlace` refusal; the `NoPlaceError` answer in the `catch` around `deps.startStep`; `branchFor` simplified and its doc comment corrected; "The project is busy" is gone.
- `src/runner/actions.test.ts` — new describe "a step asks for a place on the project (ADR-0063 D2)", with six tests and the helpers `noPlace`, `choreTicket`, `placeWorld`, `stepRunning` and `PLANNING`. No existing test changed.
- `src/daemon/steps.ts` — `PRIORITY_LABEL` added and exported.
- `src/daemon/step-session.ts` — doc comment only: a `picked-up` run no longer takes a slot, and a `NoPlaceError` from `claim` reaches the caller unchanged with the run still parked.
- `doc/plans/phases/reports/phase-47-handoffs.md` — this section.

**Decisions taken inside the slice.**

- **The ask comes after the skip-reason refusal, just before `branchFor`.** The plan says "after `stepBlocked` and before `branchFor`". The skip-reason check sits between the two. Asking after it means a try refused for a missing reason does not make the run wait. It is still before `branchFor`, the departure comment and `setStage`, so a refused try writes nothing else.
- **The first sentence of the refusal is `NoPlaceError`'s message.** The action builds a `NoPlaceError` for the holder and adds the second sentence. This keeps one place in the code that words "who takes the place" (`whoTakesThePlace` in `runs.ts`, which is private).
- **In the `NoPlaceError` path, the refusal names the holder from the second `askPlace`.** If that second ask answers ok (the place freed in the meantime), the run does not wait. The action then gives the old answer, `The step did not start: …`, because "this ticket now waits" would not be true.
- **The approval session (`recordApproval`) does not ask for a place.** The excerpt changes only `startStep`. A `NoPlaceError` there gives the existing "The approval is written down, but the step that writes it into the file did not start: …" refusal.
- **`placeWorld` in the test file uses a step starter that claims and activates the run as `startStepSession` does.** Without it, a test could not show that a run given the place starts its step and stops waiting, and could not make a place be taken between the ask and the start.

Refactor I would do but did not: export a function from `runs.ts` that words the holder (today `whoTakesThePlace`, private), so `noPlace` does not build an error only for its message. The two test worlds `world` and `stageWatchingWorld` and the new `placeWorld` repeat the same `runnerActions` deps; one builder with options would do.

**Validation evidence.**

Every red/green run was `npx vitest run src/runner/actions.test.ts -t "asks for a place"`.

1. *"refuses a step while another ticket's step runs, naming that run, and writes that the run waits"* — red: `"refused": "The step did not start: No place is free on scratch-app: run scratch-app#7/1 has a step running."` (expected the full plan sentence). Green after `askPlace` and `noPlace` (with `priority: false` at that point).
2. *"starts a step while another ticket's run waits on its open pull request, with no step running (R1)"* — **passed on arrival** (47a made `claimBranch` a setter; the ask only counts places). Mutation in `actions.ts`: refuse when another run of the project owns a branch → `AssertionError: expected false to be true`. Reverted → green.
3. *"starts a step when the place is given to this run, and the run no longer waits (R3 clause 3)"* — **passed on arrival** (`askPlace` answers ok for a run given the place). Mutation: refuse when `placeHolders` of the project is not empty → `AssertionError: expected false to be true`. Reverted → green.
4. *"refuses a step while the place is given to another run, naming that run"* — **passed on arrival** (the words come from `NoPlaceError`). Mutation: always word the holder as "has a step running" → `AssertionError: expected { ok: false, …(1) } to deeply equal { ok: false, …(1) }`. Reverted → green.
5. *"writes the order of a ticket labelled priority:high as first, when its step is refused"* — red: `expected { priority: false, …(2) } to match object { priority: true, …(1) }`. Green after `PRIORITY_LABEL` was added to `steps.ts` and read in `startStep`.
6. `endRun`, the limit refusal and the skip-reason refusal: every existing test in `actions.test.ts` is unchanged and green (57 tests).
- Extra, for the plan's `NoPlaceError` bullet: *"refuses a step whose place was taken between the ask and the start, in the same words, and writes that the run waits"* — red: `"refused": "The step did not start: No place is free on scratch-app: run scratch-app#7/1 has a step running."`. Green after the `NoPlaceError` answer in the `catch`. The test also checks that the stage is put back and the run stays parked.

Mutations were temporary edits of `src/runner/actions.ts`, copied back from a saved copy straight after the run.

*Validation commands* (from `projects/timone`):

```
$ npx tsc --noEmit; echo "exit: $?"
exit: 0

$ npx vitest run src/runner/actions.test.ts src/daemon/step-session.test.ts src/daemon/runs.test.ts; echo "exit: $?"
 Test Files  3 passed (3)
      Tests  210 passed (210)
exit: 0

$ grep -rn "The project is busy" src --include=*.ts | grep -vE '^\S+:[0-9]+:\s*(//|\*)'; echo "exit: $? (expected 1)"
exit: 1 (expected 1)
```

Checkboxes of the excerpt:

- [x] Cases 1–6 pass, with red runs recorded (cases 2, 3 and 4 passed on arrival; each has a mutation that fails it).
- [x] The refusal sentence in a test matches the Goal Description's words exactly (`noPlace` in the test file, compared with `toEqual`).

*Test files run at the end* (every test file of code that imports `runner/actions`, `daemon/steps` or `daemon/step-session`, plus all of `src/runner/`, `src/commands/` and `src/daemon/`):

- `src/daemon/` (27 files, 975 tests): all pass.
- `src/commands/` (11 files) and `src/runner/` except `driver.test.ts`: all pass.
- **`src/runner/driver.test.ts`: 1 failed, 10 passed.** The failing test is "RunnerDriver — a run refused a step because its project was busy (40u) › wakes it again after a new refusal, once the project is free again": `NoPlaceError: No place is free on scratch-app: the place is given to run scratch-app#12/1.` at `store.activate` of #14, line 611 of the test. It passes with the action as it was at HEAD. Cause: #12's refused try now writes that it waits, so when #13 completes the ledger gives the place to #12 (ADR-0063 D3). The test's next line makes a third run, #14, start a step "meanwhile", which the ledger now refuses, as D3 intends. The test is in `driver.test.ts`, which is not in this slice's files, so it was not changed. 47c rewrites the 40u describe.

**What 47c must know.**

- `driver.test.ts` has one failing test, named above. Its setup can no longer happen under D3. 47c's rewrite of the 40u describe must replace it.
- A refused `startStep` now leaves the run in `waitingForPlace`, and the ledger gives it the place as soon as one frees. Nothing wakes it yet: the driver still sends "The project is free now." from `projectFreeFor`, and that is 47c's to replace with `PLACE_GIVEN_EVENT` for the one run given the place.
- Every `startStep` that reaches the ask writes `place` on the run, also when the step starts. So when that step ends (`active → parked`) the run waits again by itself (47a). The runner side must call `leaveTurn` when a wake ends with no step started and no try refused, and `giveBack` when a given place was not used. Nothing calls them yet.
- `startStepSession` claims only a parked run. For a `picked-up` run, the place check happens in `activate`, after `runtime.start` has already started the session. A `NoPlaceError` there would leave a session running for a run the ledger did not mark active. In practice the runner's wake parks a `picked-up` run first, and the action asks before it starts, so this needs a race. It is not changed here (the excerpt says no change to the flow).
- `recordApproval` does not ask for a place before its session.

## 47c — Only the run given a place is woken, and a place it does not use goes to the next

**Built.** The driver no longer tells every refused run "The project is free now." It wakes a run only when the ledger has given it a place and no step of it runs, with `PLACE_GIVEN_EVENT` ("A place on the project is free for this ticket now. A step you start will not be refused for want of one."), once per given place (notice `place given at <givenAt>, run <id>`). After a step ends, when the ledger gives the place back to that same run, the driver writes that notice at once, so the run is woken only with the step's end. A run given the place that the tick will not wake for it — its ticket is held (not a step ticket), or it is over its spending limit — gives the place back in that tick, so the place goes to the next waiting run, who is woken on the next tick. After a runner session, `wakeRunner` lets go of a place not used: a session that ended with no step started and no try refused for want of a place calls `leaveTurn`; a session that failed or was stopped, with no try refused, calls `giveBack` only when the place is given to the run. A run whose try was refused for want of a place in the wake keeps its turn: it waits, and a place given to it later in the same wake stays given, so the next tick wakes it with `PLACE_GIVEN_EVENT`. The brief has one new line under *Facts about the work*, `- The project's place: …`, in the four wordings of the plan, and one new rule under *How you act*. The daemon calls `store.regivePlaces()` once before its first cycle.

**Files touched.**

- `src/runner/driver.ts` — `PROJECT_FREE_EVENT`, `busyRefusal`, `projectFreeFor`, `namedRunIds` and `START_STEP` deleted (nothing else used them), with the `PLACES_PER_PROJECT` and `RunnerToolName` imports; `PLACE_GIVEN_EVENT` and the private `placeGivenNotice` added; the 40u block in `look()` replaced; `look()` gives back a place given to a run that is held or over its limit (`overLimit` is now read once, before the hold check); `afterStep` writes the notice after `parkForRunner`; its doc comment says why.
- `src/runner/session.ts` — `wakeRunner` watches `startStep` for a refusal for want of a place, and calls the new private `freePlace` after the session (a refused try keeps the run's place and turn); private `noPlaceRefusal` and `placeOf`; `briefFor` fills `place`.
- `src/runner/brief.ts` — exported type `PlaceFact`; `BriefInput.place`; the line in `factsSection` (private `placeText`); the rule in `SYSTEM`.
- `src/commands/daemon.ts` — `options.store.regivePlaces()` in `runDaemon`, inside the lock, before `poll`.
- `src/runner/driver.test.ts` — the 40u describe replaced by "a place on the project is given to one waiting run (ADR-0063 D3)": cases 1–5 and 7, case 8 (two tests: held, over the limit), plus the old "does not wake a run refused for another reason" test kept in the new world; a helper `endsAtOnce` (a quiet runner session) at the top of the file; `threeRuns` and `threeChores` take the ticket numbers to hold; `HELD_LABEL` imported.
- `src/runner/session.test.ts` — new describe "a place on the project after a wake (ADR-0063 D2, D3)" with five tests, one of them case 9; the scripted runner's `calls` play gained an optional `afterCalls`.
- `src/runner/brief.test.ts` — `briefInput` gives `place: { kind: "free" }`; new describe "the project's place, as the runner is told it (ADR-0063)" with three tests.
- `src/daemon/poll.test.ts` — only the test "wakes the refused run once, when the other ticket's run has finished and its ticket closed": #7 now asks the ledger for a place with `store.askPlace` while #8's step runs (no refusal written by hand), and the expected wake carries `PLACE_GIVEN_EVENT`'s words. Its describe is renamed "… is woken once a place is given to it (40u)". The `root` it no longer needs is not destructured.
- `doc/plans/phases/reports/phase-47-handoffs.md` — this section.

**Decisions taken inside the slice.**

- **`regivePlaces` is called inside the state lock in `runDaemon`, not right after `RunStore.open` in the command's action.** Both are "after `RunStore.open`, before the first cycle". Before the lock, a second `timone daemon` that the lock then refuses would already have taken back and given again the places of the daemon that is running. The lock's own comment says a refused start touches nothing of the ledger. Production always passes `statePath`, so the lock path is always taken.
- **A refusal for want of a place is found by watching the `startStep` action in the wake**, as the wake already watches `post`: its refusal starts with `No place is free on <project>:` (the ledger's `NoPlaceError` words). The record holds the same text after `Refused: `. Watching the action avoids re-reading the record. The variant "The step did not start: No place …" (second ask answered ok) does not match, which is right: that run does not wait.
- **The brief's place reads `placeHolders` and the run's own `place` only.** `waitingForPlace` was not needed for the four wordings. When the place is taken by the run's own running step (a 15-minute check), the line says `taken: <own run id> has a step running.`, which is true.
- **`freePlace` acts only on a run that is `picked-up` or `parked` and has no step running.** A `done` or `cancelled` run is left alone (the ledger cleared its place).
- **The new rule sits right after "You never merge."** under *How you act*.
- **A place given back by a held or over-limit run is told to the next run on the next tick, not the same one.** `tick` walks the runs it read from the ledger at its start, so the next run's copy does not show the place yet (or it was already looked at). Re-reading every run in the loop would be a change to `tick` the plan did not ask for. Case 8's tests say so: no wake in the first tick, the place is the next run's, and the next tick wakes it.
- **At the limit, `PLACE_GIVEN_EVENT` is not pushed into the events.** The place is given back in the same look, so a "go on" reply that wakes the runner in that tick must not tell it of a place it no longer has.
- **A try refused for want of a place keeps the run's place after a failed or stopped session too.** The amendment (b) does not limit itself to a session that ended. The refusal told the runner it would be woken when a place is given, and the next tick does that. Since `askPlace` never refuses a run a place is given to, a place given *before* the refusal cannot exist; so the refused branch of `freePlace` is a plain `return`, with no time comparison.
- **The poll test was rewritten, not deleted.** Driver case 1 shows the same wake at `RunnerDriver.tick`, but this test goes through `pollOnce`, and the other run ends by `complete` with its ticket no longer listed — the path phase 40's verification saw. Rewriting it cost a few lines.
- **In two places I wrote two tests before the first run** (brief: the line and the rule; session: the giveBack after a refusal, since replaced by case 9, and after a failure). Each was seen red on its own line of that run, recorded below.

Refactor I would do but did not: `parkForRunner` (driver) and `putOnRunnersWait` (session) are the same function twice. Three doc comments still say a run "holds the project" (`atLimit` and `handBack` in `driver.ts`, `settle` in `session.ts`); they describe the rule ADR-0063 replaced. The test worlds in `driver.test.ts` (`threeRuns`, `builtChore`, the 40x world) each build their own `RunnerDriver`; one builder would do.

**Validation evidence.**

Every red/green run was `npx vitest run <file> -t "<name>"`.

1. *"wakes only the first waiting run by order when the step that took the place ends, and tells it the place is given (R3 clause 3, #184)"* (`driver.test.ts`) — red: the one wake, of `scratch-app#13/1`, carried `"The project is free now."` where `"A place on the project is free for this ticket now. …"` was expected. Green after the new block in `look()`.
2. *"asks for no wake on a second tick when nothing has changed, since the run was told of its place"* — **passed on arrival** (the notice came with case 1). Mutation: drop the `noticed` check in the new block → `AssertionError: expected [ { …(3) }, { …(3) } ] to have a length of 1 but got 2`. Reverted → green.
3. *"gives the place to the next waiting run when the run given it ends its runner's wake with no step started, and the next tick wakes that run (R3 clause 4)"* (`driver.test.ts`, with the real `wakeRunner` and a quiet session) — red: `AssertionError: expected [ { runId: 'scratch-app#13/1', …(2) } ] to deeply equal [ { …(3) }, { …(3) } ]`. Green after `leaveTurn` in `wakeRunner`. At the `wakeRunner` seam (`session.test.ts`):
   - *"gives the place to the next waiting run when the wake of the run given it ends with no step started, and the run waits no more (R3 clause 4)"* — **passed on arrival** (same code). Mutation: remove the `leaveTurn` call → `expected [ 'scratch-app#12/1' ] to deeply equal [ 'scratch-app#13/1' ]`. Reverted → green.
   - *"leaves a run waiting for its turn when its try to start a step in the wake was refused for want of a place"* — red: `expected [ 'scratch-app#13/1' ] to deeply equal [ 'scratch-app#12/1', …(1) ]`. Green after the refusal was watched.
   - *"gives the place to the next waiting run when the wake of the run given it fails"* — red: `expected [ 'scratch-app#12/1' ] to deeply equal [ 'scratch-app#13/1' ]`. Green after the `giveBack` branch. (The first attempt had a second test here that expected a place given after a refused try to go back; case 9 below replaced it.)
4. *"wakes a run whose step just ended and kept the place once, with the step's end, and not again for the place"* — red: a second wake of `scratch-app#13/1` with `PLACE_GIVEN_EVENT` (`expected [ { …(3) }, { …(3) } ] to deeply equal [ { runId: 'scratch-app#13/1', …(2) } ]`). Green after the notice in `afterStep`.
5. *"does not wake a run waiting for a person on its own branch with an open pull request when a place frees, and wakes it on the merge (R1 clause 3)"* — **passed on arrival** (the run left its turn, so the ledger gives it nothing). Mutation: in `look()`, treat any run with a `place` as given → `AssertionError: expected [ { runId: 'scratch-app#14/1', …(2) } ] to deeply equal []`. Reverted → green.
6. `brief.test.ts`: *"writes one line under the facts for each state of the place"* — red: `expected undefined to be '- The project's place: given to this…'`; *"puts the line under Facts about the work"* — red: `expected '## Facts about the work\n\n- Default …' to contain '- The project's place: free.'`; *"has a rule under How you act: …"* — red: `expected '' to be '- A step needs the project's place. …'`. Green after the `brief.ts` change. The caller, at the `wakeRunner` seam: *"tells the runner in its brief who takes the project's place, or that it is given to this ticket"* — red: `expected [] to deeply equal [ …(2) ]` (with no `place`, building the brief threw, so no session started). Green after `placeOf`.
7. *"wakes the first waiting run again after a restart, which takes back the place given before it and gives it again (D3)"* — **passed on arrival**. Mutation: the notice without the time (`place given, run <id>`) → `expected [ { runId: 'scratch-app#13/1', …(2) } ] to deeply equal [ { …(3) }, { …(3) } ]`. Reverted → green.
8. *"does not wake a run given the place whose ticket is held, and gives the place to the next waiting run in the same tick"* — red: `AssertionError: expected [ 'scratch-app#13/1' ] to deeply equal [ 'scratch-app#14/1' ]`. Green after `look()` gave back a held run's place. *"does not wake a run given the place that is over its spending limit, and gives the place to the next waiting run in the same tick"* — red: `AssertionError: expected [ 'scratch-app#13/1' ] to deeply equal [ 'scratch-app#14/1' ]`. Green after the same give-back read `overLimit`. Both also check that the next tick wakes #14 with `PLACE_GIVEN_EVENT`.
9. *"lets a run keep a place given to it after its try was refused in the same wake, so it is woken for it next (ADR-0063 D3)"* (`session.test.ts`, the first attempt's test rewritten) — red: `AssertionError: expected [ 'scratch-app#13/1' ] to deeply equal [ 'scratch-app#12/1' ]`. Green after `freePlace` returned on a refused try. The test checks the run still has `givenAt` and #13 still waits. That the next tick then wakes it is the code of case 1 (a given place with no notice wakes its run); it is not shown again at `RunnerDriver.tick`, because a runner session that calls `start_step` needs the scripted runner of `session.test.ts`.
- The rewritten `poll.test.ts` test — the first attempt's version of it failed against this slice's code: `AssertionError: expected [] to deeply equal [ { runId: 'scratch-app#7/1', …(2) } ]`. The rewritten test **passed on arrival** (the driver code already existed). Mutation: in `look()`, never push `PLACE_GIVEN_EVENT` → `AssertionError: expected [] to deeply equal [ { runId: 'scratch-app#7/1', …(2) } ]`. Reverted → green.

Mutations were temporary edits of `driver.ts` or `session.ts`, copied back from a saved copy straight after the run.

*Validation commands* (from `projects/timone`, second attempt):

```
$ npx tsc --noEmit; echo "exit: $?"
exit: 0

$ npx vitest run src/runner/ src/daemon/runs.test.ts; echo "exit: $?"
 Test Files  12 passed (12)
      Tests  340 passed (340)
exit: 0

$ npm run replay; echo "exit: $?"
FAIL ... (every case) the runner's session failed: Claude Code returned an error result: Not logged in · Please run /login.
0 of 19 cases passed. The runner's sessions cost $0.00 in all.
exit: 1

$ grep -rn "PROJECT_FREE_EVENT\|The project is free now" src --include=*.ts | grep -vE '^\S+:[0-9]+:\s*(//|\*)'; echo "exit: $? (expected 1)"
exit: 1 (expected 1)
```

Checkboxes of the excerpt:

- [x] Cases 1–7 pass, with red runs recorded (cases 2, 5 and 7, and one `wakeRunner` test of case 3, passed on arrival; each has a mutation that fails it). Cases 8 and 9, added by the amendment, pass, each seen red first.
- [ ] The replay set passes unchanged — **check not run**: no Claude login in this container, so every case fails before the runner answers (as before this slice). No recorded case expected the old words: `grep` for "The project is free now", `PROJECT_FREE_EVENT`, "free now" and "project is busy" under `src/runner/replay/` finds nothing. `src/runner/replay/harness.test.ts` (offline) passes.

*Test files run at the end*: `src/runner/` (all 11 files, including `replay/harness.test.ts`) and `src/daemon/runs.test.ts`: 340 tests, all pass. `src/daemon/` and `src/commands/` (38 files, 1186 tests, including `poll.test.ts` and `commands/daemon.test.ts`), run after `npm run build` (several guard tests need `dist/cli.js`): all pass. `dist/` was not there before and is not ignored by git, so it was removed again.

**What 47d must know.**

- `regivePlaces` runs once inside the daemon's lock in `runDaemon`, before the first cycle, not in the command's action.
- A place given back by a held or over-limit run reaches the next waiting run in the same tick, but that run is woken on the next tick.
- A wake for a held run on a named person's words still happens, but the place is gone by then: a `start_step` in that wake is refused and the run waits again.

## 47d — A ticket with an open pull request is taken over, not picked up as new work

**Built.** Before the pickup opens a new run for a marked ticket that has no live run, it asks the forge for an open pull request from a branch of that ticket (`timone/<n>`, or a branch that starts with `timone/<n>-`). When one is open, the ledger opens the ticket's next chunk as `parked` at stage `delivery`, with the branch, the pull request and the wait `pull request #<pr>, opened before this run` (kind `runner`, ended by `delivery`). Nothing is posted, no new-ticket wake is asked, and the log says `adopt  <run id> — pull request #<n> is open`. The run then wakes on its pull request as any run with one does, and its brief's facts name the branch and the pull request. When the forge fails to answer, the ticket is skipped for this cycle with one line in the cycle's errors; the other tickets are still picked up. A ticket with a live run is not asked about.

**Files touched.**

- `src/adapters/ticketing.ts` — the port gains `findOpenPullRequestOfTicket(project, ticket)`, with the doc comment the plan asks for.
- `src/adapters/github-tickets.ts` — implements it with one `gh pr list --repo <slug> --state open --json number,title,url,state,headRefOid,headRefName --limit <pageLimit>`; `ghPullSchema` gains an optional `headRefName`; a new `isBranchOfTicket(branch, ticket)` holds the branch rule. The newest open one (highest number) wins.
- `src/daemon/runs.ts` — `RunStore.adopt(project, ticket, { branch, pr })`; refuses with an error naming the live run.
- `src/daemon/poll.ts` — the check in `pollProject`, before `store.register`.
- `src/adapters/github-pulls.test.ts`, `src/daemon/runs.test.ts`, `src/daemon/poll.test.ts` — the cases below. `poll.test.ts` also gains three helpers: `pullRequest70`, `withOpenPullRequests` and `briefedRunner` (the real driver over real `RunnerSessions`, whose session writes down its prompt and ends).
- Fakes of the port that `tsc` named, each given only the new method, answering undefined: `src/commands/daemon.test.ts`, `src/commands/takeover.test.ts`, `src/daemon/chunk-zero.test.ts`, `src/daemon/hooks.test.ts`, `src/daemon/poll.test.ts` (`noPullRequests`, `previewTicketing`, and the adapter of the introduction tests), `src/runner/actions.test.ts`, `src/runner/driver.test.ts`, `src/runner/replay/recording.ts`.

**Decisions taken inside the slice.**

- The adapter cases are in `src/adapters/github-pulls.test.ts`, beside `findPullRequest`'s, as the excerpt allows.
- Case 3 (the branch rule) is tested at the adapter seam, where the rule lives. The poll tests use a fake forge that already answers per ticket.
- An adopted run is not added to the cycle's `pickedUp` list: it is not a pickup, and that list is what the daemon reports as picked up.
- The adopted run has no `wait.opened`. The plan's wait has none, and the driver reads comments as new from the run's `createdAt`, so older comments on the pull request do not wake it.
- The forge failure is caught around the adapter call only. A failure in `store.adopt` (which can only be a live run, and the code checked for one just before) is not caught here; it would end the project's turn as any ledger error does.
- One case beyond the six: the forge-failure test (case 6b below). The excerpt asks for that behaviour in `poll.ts` and lists no case for it; the test is at the declared `pollProject` seam.
- Not done: when the open pull requests fill the page (`--limit`, 200 by default), the ticket's one could be missing from the list, and the ticket would be picked up as new work. `listIssues` refuses a full page; this method does not, because the plan does not ask for it. It is one `if` if the orchestrator wants it.
- Refactor I would do but did not: `register` and `adopt` build the new run with the same eight lines; a private helper that builds the next chunk of a ticket would hold them once.

**Validation evidence.**

Red-green, per case:

1. `poll.test.ts` › "scratch-app#67, with no run and pull request #70 open from timone/67-some-title: one cycle opens a parked run on that branch and pull request, posts nothing, and asks for no new-ticket wake (#181)" — red: `AssertionError: expected [ { id: 'scratch-app#67/1', …(7) } ] to deeply equal [ ObjectContaining{…} ]` (the run was `picked-up`). Green after the check in `pollProject`.
   `runs.test.ts` › "opens the ticket's next chunk parked at delivery, with the branch, the pull request and the wait for the runner" — red: `TypeError: store.adopt is not a function`. Green after `adopt`.
2. `poll.test.ts` › "wakes the run that took over scratch-app#67 when pull request #70 merges, and its brief's facts name the branch and the pull request (#181)" — could not go red honestly: case 1's code already makes it true. Mutation 1, `adopt` without `pr`: `AssertionError: expected [] to have a length of 1 but got +0`. Mutation 2, `adopt` without `branch`: `AssertionError: expected '\n\n- Default branch: main\n- Branch:…' to contain '- Branch: timone/67-some-title'`. Both reverted from a saved copy; green.
3. `github-pulls.test.ts` › "counts a pull request from timone/67 for ticket #67, and not one from timone/670-other" — red: `AssertionError: expected undefined to be 'timone/67' // Object.is equality` (the first filter took only `timone/67-…`). Green after `isBranchOfTicket`. The `670` half was already true; mutation `branch?.startsWith(own)`: `AssertionError: expected { …(2) } to be undefined`. Reverted; green.
4. `poll.test.ts` › "picks scratch-app#67 up as before, with the pickup comment, when no pull request of it is open" — could not go red honestly (the behaviour from before). Mutation `if (open === undefined) continue;`: `AssertionError: expected undefined to be 'picked-up' // Object.is equality`. Reverted; green.
5. `poll.test.ts` › "does not ask the forge about scratch-app#67 while a run of it is live" — could not go red honestly (case 1's code checks the live run). Mutation `… === undefined || true`: `AssertionError: expected [ 67 ] to deeply equal []`. Reverted; green.
   `runs.test.ts` › "refuses a ticket that has a live run, and leaves the ledger as it was" — written after `adopt` already refused. Mutation `if (live !== undefined && false)`: `AssertionError: expected [Function] to throw an error`. Reverted; green.
6. `github-pulls.test.ts` › "asks gh for the open pull requests and answers the one from a branch of the ticket, with its branch" — red: `TypeError: adapter.findOpenPullRequestOfTicket is not a function`. Green after the method.
   `github-pulls.test.ts` › "throws when gh fails, rather than answering that no pull request is open" — could not go red honestly (a failing `gh` already threw). Mutation `.catch(() => "[]")` on the `gh` call: `AssertionError: promise resolved "undefined" instead of rejecting`. Reverted; green.
   6b. `poll.test.ts` › "skips scratch-app#67 for this cycle, with an error, when the forge cannot say whether a pull request of it is open, and still picks up the next ticket" — red: `AssertionError: expected [] to deeply equal [ 68 ]` (the failure ended the project's turn). Green after the `try`/`catch`.

The validation block, as written:

```
$ npx tsc --noEmit; echo "exit: $?"
exit: 0
$ npx vitest run src/daemon/poll.test.ts src/daemon/runs.test.ts src/adapters/; echo "exit: $?"
 Test Files  8 passed (8)
      Tests  445 passed (445)
exit: 0
```

- [x] Cases 1–6 pass, with red runs recorded — yes; where a case could not go red, a mutation's failure is recorded instead.
- [x] The scratch-app#67 case is named in the test's title — yes: the describe is "a marked ticket whose pull request is open is taken over, not picked up as new work (#181)", and case 1's title starts "scratch-app#67, … (#181)".

Test files run at the end, after `npm run build` (then `rm -rf dist`): every test file under `src/adapters`, `src/commands`, `src/daemon`, `src/runner` and `src/*.test.ts` — 61 files, 1703 tests, all passed, exit 0. That covers the test files of every changed file and of every file that imports one.

**What 47e must know.**

- An adopted step ticket is not given the hold label that a pickup puts on a step ticket (the plan says post nothing and continue). Its run is live, so it is not picked up again; whether the frontier should see it as claimed is not decided here.
- `takeover.ts` and `cancel.ts` can now meet a ticket whose live run was opened by `adopt`: `parked`, stage `delivery`, with a branch and a pull request, and never `picked-up` or `active` before.

## 47e — A takeover takes no place and is not refused because of another ticket

**Built.** A takeover now claims its run with `store.claim(id, hold, { takeover: true })` on both roads: the command with the lock free (`claimForTakeover` in `takeover.ts`), and the daemon's `claim-takeover` request handler (`poll.ts`). The run is `active` and marked `takenOver`, takes no place on the project, and is not refused because another ticket of the project has a step running, owns a work branch, or has an open pull request. Another ticket's step may start while a ticket is taken over. A takeover of a ticket whose own step is running is still refused, with the same words as before ("I'm working on scratch-app #6 right now. Anything I need from you will land on the ticket."). The comment above the heartbeat in `runTakeover` no longer says the run's status holds the project's one-session slot; it says a taken-over run takes no place (ADR-0063 D5).

**Files touched.**

- `src/commands/takeover.ts` — `claimForTakeover` passes `{ takeover: true }`; the comment above the heartbeat corrected.
- `src/daemon/poll.ts` — the `claim-takeover` handler passes `{ takeover: true }`, with one comment line saying why.
- `src/commands/takeover.test.ts` — new describe "a takeover takes no place on its project (ADR-0063 D5)", four tests (cases 1–4), with local helpers `ledger`, `waitingSix` and `takeOver`. No existing test changed.
- `src/daemon/poll.test.ts` — three tests (case 5) added to the describe "pollOnce — handing a run to the terminal and taking it back". No existing test changed.
- `doc/plans/phases/reports/phase-47-handoffs.md` — this section.

**Decisions taken inside the slice.**

- **`findTakeover` needed no change.** Its refusal for a `picked-up` or `active` run of the same ticket stays. No sentence in it blamed another run of the project any more: 47a had already removed `queuedMessage` and the `queued` cases. The plan's "every sentence that blamed another run goes" was therefore already true.
- **"The same three" of case 5 are cases 1, 2 and 3.** Case 4 (a third ticket's step starts while one is taken over) is shown at the command seam only. The request road writes the same `takenOver` mark through the same `claim`.
- **Case 4 starts the third ticket's step as `startStepSession` does**, with `askPlace`, `claim` and `activate` on the store, inside the terminal session. Starting a real step session would need the runtime, which is not at this seam.
- **In the poll tests, a run with a step running also has an entry in `RunningSteps`**, as the existing 15-minute-check test does. Without it the run would look like one a terminal holds, and the case would not be "a step running".
- **Two poll tests (clauses 2 and 3) were written together before their first run.** Both passed on arrival; each has its own mutation below.

Refactor I would do but did not: `takeover.test.ts` now has two describes with their own `ledger()` and `takeOver()` helpers; one pair at the top of the file would do. In `poll.test.ts` the `RunningSteps` entry for a step that never ends is written out four times; a small helper would hold it.

**Validation evidence.**

Every red/green run was `npx vitest run <file> -t "<name>"`. Mutations were temporary edits of `takeover.ts` or `poll.ts`, copied back from a saved copy straight after the run.

1. `takeover.test.ts` › *"takes over a ticket while another ticket of the project has a step running, and leaves that step alone (R13 clause 1)"* — red: `NoPlaceError: No place is free on scratch-app: run scratch-app#4/1 has a step running.` Green after `claimForTakeover` passed `{ takeover: true }`.
2. *"takes over a ticket while another ticket of the project owns a branch and an open pull request, with no step running (R13 clause 2)"* — **passed on arrival** (47a: a branch and a pull request take no place). Mutation: `claimForTakeover` throws when another run of the project owns a branch → `Error: MUTATED: run scratch-app#4/1 owns a branch`. Reverted → green.
3. *"refuses the takeover of a ticket whose own step is running, in the words it always used (R13 clause 3)"* — **passed on arrival** (the refusal is today's). Mutation: in `findTakeover`, an `active` run resolves to `open-session` → `AssertionError: expected +0 to be 1` (the terminal session was launched). Reverted → green.
4. *"lets a third ticket's step start while a ticket is taken over (R2 clause 6)"* — **could not go red honestly** (case 1's change already makes it true). Mutation: remove `{ takeover: true }` from `claimForTakeover` → `NoPlaceError: No place is free on scratch-app: run scratch-app#6/1 has a step running.` Reverted → green.
5. `poll.test.ts`:
   - *"hands a ticket to the terminal while another ticket of the project has a step running, and leaves that step alone (R13 clause 1)"* — red: `AssertionError: expected [] to deeply equal [ 'claim-takeover scratch-app#6' ]`; the cycle's error was `could not apply claim-takeover scratch-app#6 asked by pid …: No place is free on scratch-app: run scratch-app#4/1 has a step running.` Green after the handler passed `{ takeover: true }`.
   - *"hands a ticket to the terminal while another ticket of the project owns a branch and an open pull request, with no step running (R13 clause 2)"* — **passed on arrival**. Mutation: the handler throws when another run of the project owns a branch → `expected [] to deeply equal [ 'claim-takeover scratch-app#6' ]`. Reverted → green.
   - *"refuses to hand over a ticket whose own step is running, in the words the command uses (R13 clause 3)"* — **passed on arrival**. Mutation: on `nothing-to-do`, the handler claims the ticket's latest run anyway → `expected [ 'claim-takeover scratch-app#6' ] to deeply equal []`. Reverted → green.

*Validation commands* (from `projects/timone`):

```
$ npx tsc --noEmit; echo "exit: $?"
exit: 0

$ npx vitest run src/commands/takeover.test.ts src/daemon/poll.test.ts src/daemon/runs.test.ts; echo "exit: $?"
 Test Files  3 passed (3)
      Tests  310 passed (310)
exit: 0
```

Checkboxes of the excerpt:

- [x] Cases 1–5 pass, with red runs recorded (cases 2, 3 and 4, and clauses 2 and 3 of case 5, passed on arrival; each has a mutation that fails it, recorded above).
- [x] The handoff names PRD-05.R11's probe as one verification must amend; the builder does not open it — see below. It was not opened.

*Test files run at the end*, after `npm run build` (then `rm -rf dist`): every test file under `src/commands`, `src/daemon`, `src/runner` and `src/*.test.ts` — 55 files, 1521 tests, all passed, exit 0. That covers the test files of `takeover.ts` and `poll.ts` and of every file that imports them (`cli.ts`, `commands/daemon.ts`, `commands/status.ts`, `runner/actions.ts`, `daemon/hooks.test.ts`).

**What 47f must know.**

- **Verification must amend PRD-05.R11's probe** (`prd-05.r11.mjs`, owned by verification). Its clause 2 refusal — a takeover refused because another ticket of the project holds it — is gone after this slice, so the probe tests a refusal that no longer happens. The builder did not open the probe.
- A taken-over run is `active` with `takenOver: true` and takes no place. `placeHolders` does not list it; `staleRuns` and anything that reads `RUNNING` still see it as running. `timone status` should not show a taken-over run as taking the project's place.

## 47f — `timone status` says which tickets wait for a place, in their order

**Built.** Each project's line in `timone status` now says, after its runs, which ticket a place is given to (`the place is given to #12`) and which tickets wait for a place, in the order the ledger will give it (`waiting for a place: #12, then #9`). The order is the ledger's own: the command passes `store.waitingForPlace(project)` to the renderer, and the renderer does not sort. When no ticket waits and no place is given, the line says nothing about a place.

**Files touched.**

- `src/commands/status.ts` — new option `waitingForPlace` on `RenderStatusOptions` (and the matching field on the private `RenderContext`); `describeProject` adds the two parts after the runs; the command passes `(project) => store.waitingForPlace(project)`; one dated note on `describeProject`'s doc comment.
- `src/commands/status.test.ts` — new describe "renderStatus — the tickets that wait for a place (ADR-0063)", three tests (cases 1–3), with local helpers `ledger`, `stepRunning`, `asksForAPlace`, `scratchLine`. No existing test changed.
- `doc/plans/phases/reports/phase-47-handoffs.md` — this section.

**Decisions taken inside the slice.**

- **The renderer takes the waiting list as an option, `waitingForPlace?: (project) => readonly Run[]`**, beside `pictures`, rather than a `RunStore`. `renderStatus` takes plain runs and readers today, so it stays a pure function of what it is given. Absent means nothing is said about waiting, as with the other options.
- **The given place is read off the run list**, from `place.givenAt` on the project's runs, not from `placeHolders`. A given place needs no order, and the run list is already there. A run with a step running is not named as holding the place: its own phrase already says it is working, and a taken-over run (47e) takes no place, so it must not be named as holding one.
- **The two parts come after the run phrases and before the initiative parts**: the given place first, then the waiting list. With several runs given a place (piece 5), each is named in its own part.
- The waiting list is joined with `, then `, so three tickets read `#12, then #9, then #4`.

Refactor I would do but did not: `status.ts` still keeps its own copy of `RUNNING`; the test helpers `asksForAPlace` and `stepRunning` repeat `waitingForAPlace` from `runs.test.ts`, and a shared test helper for a ledger with places would serve both files.

**Validation evidence.**

Every red/green run was `npx vitest run src/commands/status.test.ts -t "<name>"`.

1. *"names the tickets waiting for a place after the runs, in the order they get it, priority:high first"* — red: `AssertionError: expected 'scratch-app  #7 — working on it now  …' to match / {2}· {2}waiting for a place: #12, th…/`. Green after `describeProject` added the waiting part from `context.waitingForPlace`. The test is not tautological: #9 was opened first and has the lower number, so any second sort by ticket or by opening time would put #9 first; only the ledger's `priority:high` rule puts #12 first.
2. *"names the ticket the place is given to, and no longer counts it as waiting"* — red: `AssertionError: expected 'scratch-app  #9 (sorting the request)…' to match / {2}· {2}the place is given to #12 {2…/`. Green after `describeProject` named each run with `place.givenAt`.
3. *"says nothing about a place when no ticket waits for one"* — red: `AssertionError: expected 'scratch-app  #7 — working on it now  …' not to match /place/` (case 1's smallest code always added the part, even empty). Green after the part was added only when the list is not empty.

*Validation commands* (from `projects/timone`):

```
$ npx tsc --noEmit; echo "exit: $?"
exit: 0

$ npx vitest run src/commands/status.test.ts; echo "exit: $?"
 ✓ src/commands/status.test.ts (46 tests) 13ms
 Test Files  1 passed (1)
      Tests  46 passed (46)
exit: 0
```

Checkboxes of the excerpt:

- [x] Cases 1–3 pass, with red runs recorded — yes; each of the three was seen red first, above.

*Test files run at the end*, after `npm run build` (then `rm -rf dist`, which was not there before): every test file under `src/commands` (11 files, including `status.test.ts`), `src/guards/checkouts.test.ts` and `src/cli.test.ts` (the two other files that import `status.ts`) — 13 files, 231 tests, all passed, exit 0.

**What 47g must know.**

- `timone status` no longer shows a queue and now shows the waiting list, so ADR-0063's last consequence ("It shows the runs waiting for a place, in the order they will get it") is true in the code. Any document 47g edits that describes the status line's queue can point at this.
- The command's wiring (`waitingForPlace: (project) => store.waitingForPlace(project)` in `registerStatusCommand`) is not covered by a test: the declared seam is the renderer. It is one line.
