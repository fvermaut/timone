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
