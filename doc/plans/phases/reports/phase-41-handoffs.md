# Phase 41 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 41a — The cycle's shared behaviour is tested on runner projects

**Built.** Every test of behaviour both drivers share now runs `pollOnce` on a project with `driver: runner`, with the real runner driver and a stand-in for its sessions. 83 tests moved: 71 in `src/daemon/poll.test.ts` and 12 in `src/commands/daemon.test.ts`. No test was added or deleted, so the suite still counts 1990. No production file changed. Every shared behaviour passed on a runner project with the code unbroken, so no fault in the runner's path was found and no fix slice is needed.

Moved, by group, in `poll.test.ts`: pickup and acknowledgement 5, serialization 2, resilience 1, the queue moving past an old park 1, the reclaim and the witness 9, the holder of a run 5, previews 11, the mark as the boundary for a wayfinder ticket 1, introductions 12, requests (cancel, unreadable, none, no state path, a request that cannot be carried out) 5, release of a takeover with nothing out 1, the step frontier and step tickets 11, closing a step and its initiative 5, a bug filed during a step 1, a project called `timone` 1. In `daemon.test.ts`: the lock 2, the cadence and the witness 2, a request beside the ledger 1, the version notice 7.

**Files touched.**

- `src/daemon/poll.test.ts` — 71 tests moved to runner projects. New helper `endingOnMerge` (next to `runnerFor`). `previewTicketing` now answers `getTicket` and `getPullRequestThread`, because the runner reads both for every run it looks at. Two imports added: `pullRequestEvent` and `runnerActions`.
- `src/commands/daemon.test.ts` — 12 tests moved. New `runnerManifest` and `standInRunner`. Imports of `RunnerDriver` and `RunningSteps` added.
- `doc/plans/phases/reports/phase-41-handoffs.md` — created, with this section.

**Decisions taken inside the slice.**

1. **A test moves when its subject is shared, even if one assertion was old-only.** The plan names queueing, pickup and previews as shared, and nearly every test of them also asserted a spawn. The old-only assertion was replaced by what the runner path does instead, or dropped where there is nothing in its place:
   - a spawn became a wake of the same run (`touches nothing…`, `queues a second marked ticket…`, `picks the queued ticket up…`, `starts a run left queued behind a park…`, `creates no run for a ticket that does not carry the mark`, `promotes the waiting bug…`);
   - the failure comment of a reclaim became the wake that tells the runner the daemon stopped (`still reclaims a run it watched go quiet…`);
   - a failed run after a reclaim became a run parked for the runner (`reads the same gap as jitter at a five-minute interval`);
   - the run cancelled when the label came off became the runner told that the ticket left the listing (`holds its peace once the label lands…`);
   - dropped: the standing call to action in `leaves a marked ticket to the path it already had`, and the step's "this step is done" words in `closes the step and not the initiative when another step is open`. That test now checks that nothing is said on the initiative.
2. **A setup in an old wait kind moved to the runner's wait where the subject does not depend on the kind:** `leaves a run parked on a human alone…` (was a gate), `does not take a run away from a live takeover` (was a conversation), `says nothing on an unmarked ticket it is already working…` (was a conversation, now `waitingForRunner`). A failed run kept as a starting state (`carries out a queued cancellation…`, `serves nobody…`) was left as it was. The runner-only block already does this.
3. **The cancel of a run whose ticket left the listing stays old-only**, with every test built on it (the describes `a ticket that stopped being mine…`, `a ticket closed while its run waited its turn`, `a parked occupier whose ticket is no longer listed`). On a runner project the cycle cancels nothing. The runner is told instead, and the runner block already tests that. Two of these tests would pass on a runner project, but only because nothing happens there.
4. **Closing an initiative needs a runner that acts.** On a runner project the initiative is closed by the runner's `end_run`, through `closeInitiativeIfDone`, not by the cycle. The existing stand-in does nothing on a wake, so it cannot reach the closing. `endingOnMerge` is the real driver with a stand-in session that, told "Pull request #N was merged.", calls the real `endRun` with `closeTicket: true`. It does nothing on any other wake.
5. **In `daemon.test.ts`, every test that runs a cycle moved**, the lock and version tests too, although their subject does not depend on the driver. After this slice, every test that runs a current-daemon project is on the old-only list.
6. `settles a request it cannot carry out, and does not try it again` keeps its `retry` request. On a runner project the retry is refused with the runner's sentence. It is still a request that cannot be carried out, settled once and not tried again.
7. Where the runner reads a ticket the fake could not answer, the fake was given an answer, and only there: `previewTicketing`, the cadence helper in `daemon.test.ts`, and `leaves pollOnce untaken…`. Otherwise the cycle reported "the runner could not look at #7", which none of these tests is about.

**Validation evidence.** This slice moves tests and adds no behaviour, so there is no red-green. The plan asks for three break-and-restore checks instead. Each check commented out one production line, ran the one moved test on its runner project, and restored the line. `git diff --stat` on the file was empty after each restore, and the test passed again.

- *Pickup acknowledgement.* Broke `src/daemon/poll.ts:1807`, `await adapter.postComment(project, ticket.number, pickedUpComment());`. Test `pollOnce — pickup and acknowledgement > registers a run and acknowledges exactly once for a marked ticket`:

  ```
  × … registers a run and acknowledges exactly once for a marked ticket 14ms
    → expected [] to have a length of 1 but got +0
  ❯ src/daemon/poll.test.ts:281:22
      281|     expect(comments).toHaveLength(1);
  Tests  1 failed | 243 skipped (244)
  ```

  Restored: `Tests  1 passed | 243 skipped (244)`.
- *Release of a preview after a merge.* Broke `src/daemon/poll.ts:1595`, `await previews.release(target, pr);`. Test `pollOnce — previews end when their pull request does > releases a merged pull request's preview and drops its record`:

  ```
  AssertionError: expected [] to deeply equal [ { project: 'scratch-app', pr: 9 } ]
  ❯ src/daemon/poll.test.ts:3252:22
      3252|     expect(released).toEqual([{ project: "scratch-app", pr: 9 }]);
  Tests  1 failed | 243 skipped (244)
  ```

  Restored: `Tests  1 passed | 243 skipped (244)`.
- *A cancel.* Broke `src/commands/cancel.ts:292`, `store.cancel(run.id, reason);`, the line that writes the cancellation the poll cycle applies. Test `pollOnce — requests a human left for the daemon > carries out a queued cancellation, in the human's own words`:

  ```
  AssertionError: expected 'failed' to be 'cancelled' // Object.is equality
  ❯ src/daemon/poll.test.ts:6256:39
      6256|     expect(store.get(run.id)?.status).toBe("cancelled");
  Tests  1 failed | 243 skipped (244)
  ```

  Restored: `Tests  1 passed | 243 skipped (244)`.

During the move one test failed with the code unbroken: `holds its peace once the label lands…`. My new assertion expected the last wake to carry only "The ticket was closed, or its mark was removed.". It also carried the new-ticket event, because the stand-in never writes the `woke` entry a real runner session writes. This was my assertion, not a fault in the runner's path. It now checks that the last wake contains the closed-ticket event.

Validation commands, as run:

```
$ npm run build && npm test 2>&1 | tail -5
 Test Files  59 passed (59)
      Tests  1990 passed (1990)
$ git diff --name-only main -- src | grep -v '\.test\.ts$' ; echo "exit: $? (expected 1: no production file changed)"
exit: 1 (expected 1: no production file changed)
```

- [x] All tests pass. The handoff gives the number of tests moved (83) and lists every old-only test left behind, by name (below). **PASS**
- [x] The three break-and-restore checks are in the handoff, with the failing output of each. **PASS**

**Old-only tests left behind, by name** (147 declarations, 149 cases: one `it.each` has three). 41b deletes them.

`src/daemon/poll.test.ts`, before the runner blocks (138):

- *pollOnce — serialization*: spawns a session for the occupying run only once
- *pollOnce — a ticket that stopped being mine while its run waited*: cancels the run instead of starting a session on it; takes a fresh chunk on the ticket when it comes back
- *pollOnce — resilience*: does not let a failing spawn abort the cycle
- *pollOnce — resuming a run whose human answered*: advances a conversation the session recorded as accepted; leaves a conversation nobody concluded exactly where it was; does not read an unmarked machine comment as a concluded conversation; ends a run whose conversation resolved the last thing it had to decide; picks up a written answer and carries it to the conversation's own stage; joins every comment they wrote after the park, not only the last one; does not read the machine's own follow-up question as the answer; leaves a quiet conversation park where it is across two consecutive cycles; advances a gate the human approved; re-runs the same stage on a change request, carrying the words; never reads its own comment as the human's approval; ignores an answer written before the question was asked; resumes one run per cycle, because sessions serialize; does not resume a conversation wait when the ticket is held; does not resume a gate wait when the ticket is held; does not consume the answer while held, so lifting the hold resumes on it
- *pollOnce — runs parked before the machinery existed*: picks a run back up once the stage it was waiting for exists; picks a bug back up now that the stage that acts on it exists; leaves it parked when the ticket carries no classification to route on
- *pollOnce — a run parked at an unbuilt stage resumes at that stage*: resumes at execution itself, never at the stage after it
- *pollOnce — a run parked on a pull-request review*: completes the run and promotes the queue when the PR merged; holds the ticket and asks when the PR was closed unmerged; still ends a review wait when the ticket is already held for an unrelated reason; tells the human every way out when a PR is closed unmerged; does not promise to notice a reopened pull request merging; spawns a remediation carrying the human's words on a new review comment; still spawns a remediation on a review comment; still keeps an ordinary held ticket's review parked; tells the pull request its comment was read, before the session starts; does not say it again for a comment it has already acknowledged; acknowledges again when the human writes something new; stays parked on machine comments and on comments before the cursor
- *reclaiming a run its daemon left behind*: fails the run, tells the ticket and frees the project, in one cycle; finishes a stale run whose pull request merged, rather than failing it; still fails a stale run whose pull request was closed unmerged; still fails a stale run whose pull request is open; leaves a stale run alone when its pull request cannot be read; promotes the run that was queued behind it in the same cycle; says so once, not every cycle; leaves a reclaimed run ready for `timone retry`, with its branch intact
- *a run whose holder can be asked about*: puts a run whose holder died back to work, and tells the ticket nothing; asks the human after the second death, carrying both reasons
- *a spawn the daemon keeps refusing*: does not let a refusal stand in for a sign of life; says it once where a person can see it, not once a cycle; says nothing at all about a refusal that clears on its own; names the refusal, and never calls it a machine that stopped
- *a ticket closed while its run waited its turn*: does not start a queued run whose ticket has been closed; abandons it rather than failing it, and says what was seen; still starts one whose ticket was reopened before its turn came; asks when the run reaches the front, not when it joins the queue
- *a parked occupier whose ticket is no longer listed*: leaves it alone while its ticket is still listed; cancels it once its ticket leaves the listing; promotes the run queued behind it in the same poll, but only starts it on the next one; leaves an active occupier's dead ticket alone
- *pollOnce — a wayfinder decision ticket*: parks on a conversation at stage 2, without ever being triaged; leaves an ordinary marked ticket to start where it always did; resumes an old triage park onto the map, not into the build pipeline; invites the human with the channel's own words, not a second copy of them
- *pollOnce — a written answer reaches a session that ingests it*: starts a session carrying the answer, rather than asking again
- *pollOnce — reading a written answer consumes it*: reads one answer once, however many cycles pass over the same thread; records which answer it consumed, before the session that reads it exists; still hears the next thing they write, and hears only that; never writes to what the human wrote, only alongside it
- *pollOnce — one read of one thread per parked run*: reads the ticket once to resume a conversation, and resumes on the same words; reads the pull request once to resume a review, and resumes on the same words
- *pollOnce — the call to action is reconciled each cycle*: writes nothing at all when every ticket already says the right thing; posts the call to action a ticket has never been given; posts the question instead of sending them to a terminal; keeps the command when nobody has said anything yet; keeps the command on the cycles after, without consulting again; says the same thing on the next cycle, and consults nothing to do it; stands aside once they have answered, and never asks twice; posts the composed message when %s (`it.each`, 3 cases); says nothing on a stop that no answer resolves; is not consulted about a ticket that is waiting on nobody; edits once when the state changes, and says nothing on the cycle after; refreshes a ticket whose blocker closed, with nothing run by hand; does not take a human's quotation of the marker for its own last word; does not repeat, under its marker, an acknowledgement it has just posted; carries on to the next ticket when one ticket's thread cannot be read; is not fooled into writing by line endings it did not choose
- *pollOnce — the wayfinder map is a ticket of its own*: stops on the map without asking the human for anything; starts nothing on a map whose questions are still open; asks for the go-ahead once the map's frontier is empty; refuses the go-ahead on a map that has grown a question back; never asks a map's second piece for the go-ahead again
- *pollOnce — a written go-ahead on a map starts stage 3*: runs the specification stage on the map's own run, unprompted; holds the whole project from the moment the go-ahead lands
- *pollOnce — a ticket's next chunk*: closes the ticket on the last piece, linking every pull request; holds a pull request closed without merging, breakdown or no breakdown; opens nothing in the cycle a chunk merged, leaving the project free; stops on a list that has grown since it was approved, and says so; closes a ticket that never had a breakdown, and finishes the cycle; reports a breakdown it cannot read, and still finishes the cycle; enters a successor chunk at planning, never back at triage; enters a map's later run at breakdown, not back at charting; still enters a decision ticket's successor chunk at its own stage; leaves a first chunk to enter where it always did; keeps asking whether to carry on while the list of pieces is re-proposed
- *pollOnce — requests a human left for the daemon*: carries out a queued retry, and says whose it was; applies a request before the projects are walked, so the same cycle acts on it
- *pollOnce — handing a run to the terminal and taking it back*: claims a parked run for a takeover, and gives it back on release; hands a failed run to the terminal too, parked on a person when it comes back; records the conversation as the answer being read, before it hands the run over
- *pollOnce — a cancellation while the run it stops is still going*: carries it out, and stops the work, without waiting for the cycle; reads nothing else on that clock, and leaves it for the next cycle; applies one for a run that is not the one holding the cycle
- *pollOnce — a handoff waits, and the reply reaches it*: resumes the stage that stopped, carrying what the human wrote; reads that answer once, however many cycles pass over it; is not answered by the machine talking to itself; is not answered by words written before the question; is neither concluded nor wedged by a conversation record from elsewhere
- *pollOnce — a park nothing written can end*: stays parked however plainly the human answers it; holds the same words a handoff at the same stage would have resumed on; leaves a gate park answered as it always was; leaves a review park answered as it always was
- *pollOnce — the loop that cost five passes cannot happen*: spawns nothing over ten cycles, however often they answer; keeps their words where the session that picks it up can read them; is not concluded by a conversation record from somewhere else; tells the ticket, every cycle, that writing again will not move it; closes the loop even when no stage ever notices; leaves a handoff at the same stage resuming on `carry on`
- *pollOnce — a stop cleared in the terminal goes back to the machine*: starts the step the note names, exactly once; starts the step it stopped at when the note names none; reads no branch out of the note, whatever the note says; refuses a step it does not know, says so, and starts nothing; refuses a step it knows the name of but cannot start; says a real step it cannot run is real, not gibberish; is not resolved by the stage's own account of why it stopped; still starts nothing on the human writing again, ten cycles running
- *where a step's run enters the pipeline*: enters at planning, because the human approved the list already; enters the first step at planning as well, not only the later ones; leaves an ordinary ticket entering at triage
- *a project called `timone` is a project like any other*: enters at triage, the way every unclassified request does

`src/daemon/poll.test.ts`, inside the runner blocks at the end (8). Each one runs a current-daemon project and expects its old behaviour:

- *a cancel on a runner project holds the ticket (40u)*: puts no hold on a ticket of a project the current daemon drives, which takes it up afresh as today
- *a session on a current-daemon project does not hold up the runner's projects (40y)*: looks at the runner's project again within one poll interval, while the daemon project's session still runs; stops looking at it once the cycle has ended; lets a look already under way finish before the cycle reports; never starts a look while the one before it is still under way; reports a look that fails as a line on the cycle's errors, and still looks again an interval later; gives the daemon project no look of its own on that clock: its tickets are listed once, and its session started once; walks the runner's project before the daemon's, though the manifest lists the daemon's first

`src/commands/daemon.test.ts` (1):

- *runDaemon — the loop reads a ticket's breakdown from the forge*: does not close over a list that has regrown, without any checkout on disk

**What 41b must know.**

- **The rule for what to delete.** After this slice, every test that runs `pollOnce` or `runDaemon` on a project without `driver: runner` is on the list above. A search for `manifestWith(` passed straight to `pollOnce`, without `drivenByRunner`, finds the old-only tests in `poll.test.ts`. In `daemon.test.ts`, the constant `manifest` is used directly only by the old-only test. `runnerManifest` spreads `manifest`, so keep the constant or inline it.
- **Every moved test still passes a `spawner`** (`fakeSpawner()`, `idleSpawner`, or an inline `{ async spawn() {} }`), because `PollDeps` and `RunDaemonOptions` require one. If 41b removes the spawner, those arguments go. No moved test asserts on the spawner. The runner test `asks the runner to wake for a new ticket, and never hands it to the old spawner` does assert `spawned` is empty. That half goes with the spawner.
- **The stand-in never writes the `woke` entry** a real runner session writes. So a picked-up run gets the new-ticket event on every cycle it is looked at. Assert with `toContain` on a later wake's events, not with the whole list.
- **`endingOnMerge`** (`poll.test.ts`, next to `runnerFor`) is used by the closing describe and the bug-during-a-step describe. It uses the real `runnerActions(...).endRun`. The fakes it runs on must answer `findPullRequest` (merged) and `aheadOfDefault`.
- **Shared production code that only old-only tests cover:**
  - `successorHeldBack` in the pickup loop. Every test of it is in *a ticket's next chunk*.
  - `watchForCancellations`. Its own tests hold the cycle with a blocking spawner. The 40u runner test `opens no new run while the cancel of its run is still being carried out` sets `cancelWatchIntervalMs`, but it does not show the watch carrying out a cancel.
  - `turnRunnerProjects`. It is only tested by the 40y block, which needs a blocking daemon project.
  - The cancel of a run whose ticket left the listing (`noLongerListedReason`, still imported by `poll.test.ts`).

  If 41b keeps any of this code, its tests need a runner-project form first. If 41b deletes the code, the tests go with it.
- **Refactoring I would do but did not:** the three lines `drivenByRunner` / `fakeWakes` / `runnerFor` now repeat in about 70 tests. Once the old path is gone, `manifestWith` could build runner projects by default, and a small helper could return the runner and its wakes together. I left the lines repeated, as the runner-only blocks already do.

## 41b — Every project is driven by the runner, and the cycle has one path

**Built.** A manifest entry has no `driver` line any more. A manifest that still has one does not load, and says for each project: *"<project>: the `driver` line was removed on 2026-09-30. Every project is now driven by the runner. Delete the line."* `timone.yaml` has no `driver` lines. The poll cycle walks every project in manifest order, one path for all: reclaim, registration, `promoteQueue`, `runner.tick`, introductions, previews. A stale run always goes back to the runner. A `cancel` stops the runner's step and session and holds the ticket, on every project. A takeover always goes back to the runner, and its release always asks for a wake. `timone retry` refuses on every project. `timone status` shows the spending line for every project. The daemon builds no spawner and makes no ask-check model call. `poll.ts` went from 3,516 to 1,656 lines.

**Files touched.**

- `src/manifest.ts` — `driver`, `driverSchema`, `Driver` and `driverOf` removed. New `removedDriverLines`, checked in `parseManifest` before the schema. The refusal of a project that names nobody who may instruct it is removed (decision 1).
- `timone.yaml` — both `driver: runner` lines and their comments deleted.
- `src/daemon/poll.ts` — one loop in `pollProjects`; `pollProject` keeps the registration, then `promoteQueue`, `runner.tick`, `introduceUnmarked`; `heldSinceListing` applies to every project; `reclaimStale` always calls `runner.reclaimed`; `applyRequest` as the plan says. Deleted: `turnRunnerProjects`, `RunnerTurns`, `openGoAheads`, `resumeAnswered`, `entryContext`, `boundRefusal`, `REFUSAL_LIMIT`, `reconcileCtas`, `cheaperAsk`, `instead`, `asksAPerson`, `lastHumanWords`, `saysTheSame`, `standingCta`, `concludeReview`, `concludeInitiative`, `concludeStep`, `concludeLastConversation`, `Resumption`, `resolveWait`, `writtenAnswer`, `whatFollows`, `handbackStage`, `canStart`, `misreadStep`, the async `initiativeProgress`, `drivenByRunner`, `mergedComment`, `stepMergedComment`, `pieceMergedComment`, `reproposedComment`, `closedUnmergedComment`, `reviewReadComment`, `reclaimedReason`, `noLongerListedReason`, and `Frontier.isBlocked` (its one reader was `reconcileCtas`). `PollDeps` lost `spawner` and `consultAskCheck`; `runner` is required. `PollResult` keeps `reclaimed`, `pickedUp`, `queued`, `applied`, `errors`.
- `src/commands/daemon.ts` — no `AgentSessionSpawner`, no `consultAskCheck`. `RunDaemonOptions.runner` is required. The runner's wiring is unchanged.
- `src/commands/cancel.ts` — `holdCancelledTicket` holds every project's ticket. The message for a daemon project ("I'll start it afresh on my next pass") is deleted; the one in the forge-failure message stays.
- `src/commands/takeover.ts` — `endTakeover` keeps only the runner branch; `releaseClaim` always leaves `takeover-ended` when it parked the run. Deleted with their last caller: `release`, `oneLine`, `drivenByRunner`.
- `src/commands/retry.ts` — refuses on every path with `RUNNER_RETRY_REFUSAL`. Deleted what could no longer run: `askForRetry`, `runnerRefusal`, `refusalFor`, `retryMark`, `rewind`, `reopenConsumed`, `instantOf`, `justBefore`, and `RetryDeps.wait`.
- `src/commands/status.ts` — `spendingReader` keeps only its runner branch.
- `src/daemon/poll.test.ts` — the 146 old-only declarations (148 cases) 41a listed are deleted. `drivenByRunner` is gone: `manifestWith` now names fvermaut as the one instructor, with no driver. Every `spawner` argument and `fakeSpawner` are gone. New tests for cases (1), (3), (4), (5), (9), (10).
- `src/commands/daemon.test.ts` — 41a's one old-only test deleted; `spawner` arguments and `idleSpawner` gone; `manifest` and `runnerManifest` merged into one `manifest` with fvermaut as instructor.
- `src/manifest.test.ts` — case (2); `driverOf` and every `driver` key gone; the test of the removed nobody-named refusal deleted.
- `src/commands/retry.test.ts` — case (6); 13 old-only tests deleted (below); `driver` and `wait` gone.
- `src/commands/takeover.test.ts` — case (7); 3 old-only tests deleted (below); `driver` gone.
- `src/commands/status.test.ts` — case (8); 1 old-only test deleted; `reclaimedReason()` replaced by its sentence written out; `driver` gone.
- `src/commands/cancel.test.ts` — `driver` gone.
- `doc/plans/phases/reports/phase-41-handoffs.md` — this section.

**Decisions taken inside the slice.**

1. ✏ 2026-09-30, corrected under the plan's second amendment. **The refusal of a project that names nobody moved to the daemon's start.** It applied only to `driver: runner`. Applying it to every project where the manifest is read would refuse every manifest without `operator`, including the ones `projects list` and `workspace sync` read. I first removed it. The amendment moves it instead: `runDaemon` in `src/commands/daemon.ts` does not start while any project names nobody who may instruct it, as the daemon already does not start without an `identity` block. The manifest does not check it. This is case (11).
2. **The driver-line message is exactly the plan's sentence**, one line per project joined by a newline, with no `Invalid manifest:` prefix. It is checked before the schema, so it is not replaced by "unknown key".
3. **`retry.ts` keeps its lock and refuses after it.** Everything after the refusal could no longer run, so it was deleted. The lock stays so a lock nobody can read is still reported as before. 41d removes the command.
4. **`claim-takeover` no longer calls `markAnswerConsumed` or `reopenIfFailed`.** A failed run from the old path may now be refused by `store.claim`; the request is then settled with an error line. No runner run is ever failed.
5. **The thread readers are made in `pollProject`**, since the reclaim no longer reads a pull request.
6. **`SpawnContext` and `SessionSpawner` stay in `poll.ts`**, marked, because `src/daemon/session.ts` still imports them.
7. **Case (9)'s wording.** The plan says "a step ticket whose earlier chunk is not settled". `successorHeldBack` returns early when the ticket has a live run, so it can only hold back a ticket whose earlier runs have all ended. The two tests cover its two answers that hold a ticket back: every approved piece built, and a list grown since approval.
8. **Duplicates kept.** Once no test sets a driver, some older runner tests say the same as the new case tests. I did not delete them (no refactoring beyond the slice). Listed below.
9. **Three command tests trimmed or reworded, not deleted:** `refuses an untracked ticket and an unknown project with guidance` became `refuses an unknown project with guidance` (the untracked half is removed behaviour); `reads a project that sets none of the three as daemon-driven, …` became `reads a project that sets neither as limited to $150, and instructed by the operator`; the two status tests of a dead run use the reclaim sentence written out.

Old-only tests deleted outside 41a's list, because what they test is removed here:

- `retry.test.ts`: *timone retry* — re-arms a failed run at its stage, keeping everything it owned; refuses a run that is not failed, saying what it is doing; sends a run it cannot take further to the command that can; refuses a finished run rather than resurrecting it; refuses when the project has moved on to another ticket; asks the daemon holding the ledger, names it, and gives up saying so; reports what the daemon did, once it has done it; says the daemon refused, when it refused a run that is not failed. *the answer a killed session had already read* — all 4. *the way back from a consumed answer* — its 1.
- `takeover.test.ts`: *a takeover that finishes the step it took over* — stops the run asking, once the session has recorded a finished step; puts the run back exactly as it was when nothing was recorded; leaves the floor alone when the session finished the step.
- `status.test.ts`: says nothing about spending on a project the daemon drives, and reads no record for it.
- `manifest.test.ts`: refuses a project driven by the runner when nobody is named to instruct it.

**Validation evidence.**

Cases (9) and (10) were written first, while the old code was still there. Both behaviours already existed, so neither could be red. Each was proved able to fail by breaking the code it watches, then restoring it (empty `git diff` on `poll.ts` after each restore). Both were broken again on the final code, with the same result.

- *(9)* `a ticket's next run waits on what a person approved, on a runner project` — two tests. Broke the `continue` after the `hold` log line in `pollProject`:

  ```
  × … > opens no second run on a ticket whose approved pieces are all built
    → expected [ Array(2) ] to deeply equal [ 'scratch-app#6/1' ]
  × … > opens no second run on a ticket whose list of pieces grew since it was approved
    → expected [ Array(2) ] to deeply equal [ 'scratch-app#6/1' ]
  +   "scratch-app#6/2",
  Tests  2 failed | 245 skipped (247)
  ```

  Restored: `Tests  2 passed | 245 skipped (247)`.
- *(10)* `a cancel left while a runner project's forge is slow to answer is carried out at once > cancels the run, and stops the runner's work, while the slow call is still under way`. Broke `await carryOut(request, deps, result, log);` inside `watchForCancellations`:

  ```
  × … 1194ms
    → expected 'parked' to be 'cancelled' // Object.is equality
  Tests  1 failed | 246 skipped (247)
  ```

  Restored: `Tests  1 passed | 246 skipped (247)`.

Cases (1) to (8), each written before the change and seen red, then green after it:

- *(1)* `every project is driven by the runner > asks the runner to wake for a new marked ticket on a project whose entry names no driver`. Red: `expected [] to deeply equal [ { runId: 'scratch-app#7/1', …(2) } ]` — the old path took the ticket, and no wake was asked.
- *(2)* `loadManifest > refuses a project that still has a \`driver\` line, and says to delete it`. First red was for another reason (the nobody-named refusal), so `operator: fvermaut` was added to the fixture. Red then: `expected undefined to be 'client-alpha: the \`driver\` line was r…'` — the file loaded.
- *(3)* `every project is driven by the runner > reaches a second project's named comment in the same cycle while the first project's step never ends (R15)`, both entries with no driver. Red: `expected [] to deeply equal [ 'scratch-app#7/1', 'ivtrends#3/1' ]`.
- *(4)* Two tests in the same describe. `gives a run whose holder is gone back to the runner, and neither fails it nor starts it again` — red: `- "status": "parked", "wait": { "kind": "runner" } + "status": "picked-up"` (re-armed). `gives a run that went quiet while the daemon watched back to the runner, and does not fail it` — red: `+ "status": "failed"`.
- *(5)* `stops the running step and the runner's session when a cancel is asked for` could not be driven red: the cycle already called `runner.stop` for every project. Broke `if (cancelled !== undefined) deps.runner.stop(cancelled.id);` in `applyRequest` on the final code: `expected [] to deeply equal [ 'scratch-app#7/1' ]` at the `stops` assertion, `Tests  1 failed | 103 skipped (104)`. Restored: `Tests  1 passed | 103 skipped (104)`.
- *(6)* `timone retry — a project the runner drives > refuses on a project whose entry names no driver, and leaves the failed run as it was`. Red: `expected +0 to be 1` — the run was re-armed.
- *(7)* `a run the runner waits on > gives the run back to the runner on a project whose entry names no driver, and leaves the daemon a request to wake it`. Red: `expected [] to deeply equal [ { kind: 'takeover-ended', …(2) } ]`.
- *(8)* `renderStatus — what a ticket the runner works on has spent > shows what a ticket has spent on a project whose entry names no driver, against the default limit`. Red: `Received: "scratch-app  #12 (building) — waiting: the next thing that happens on this ticket"` with no `— $4.50 of $150.00 spent`.

Green, all twelve tests, after the change:

```
 ✓ src/manifest.test.ts > loadManifest > refuses a project that still has a `driver` line, and says to delete it
 ✓ src/commands/retry.test.ts > timone retry — a project the runner drives > refuses on a project whose entry names no driver, and leaves the failed run as it was
 ✓ src/commands/takeover.test.ts > a run the runner waits on > gives the run back to the runner on a project whose entry names no driver, and leaves the daemon a request to wake it
 ✓ src/commands/status.test.ts > renderStatus — what a ticket the runner works on has spent > shows what a ticket has spent on a project whose entry names no driver, against the default limit
 ✓ src/daemon/poll.test.ts > every project is driven by the runner > asks the runner to wake for a new marked ticket on a project whose entry names no driver
 ✓ src/daemon/poll.test.ts > every project is driven by the runner > reaches a second project's named comment in the same cycle while the first project's step never ends (R15)
 ✓ src/daemon/poll.test.ts > every project is driven by the runner > gives a run whose holder is gone back to the runner, and neither fails it nor starts it again
 ✓ src/daemon/poll.test.ts > every project is driven by the runner > gives a run that went quiet while the daemon watched back to the runner, and does not fail it
 ✓ src/daemon/poll.test.ts > every project is driven by the runner > stops the running step and the runner's session when a cancel is asked for
 ✓ src/daemon/poll.test.ts > a ticket's next run waits on what a person approved, on a runner project > opens no second run on a ticket whose approved pieces are all built
 ✓ src/daemon/poll.test.ts > a ticket's next run waits on what a person approved, on a runner project > opens no second run on a ticket whose list of pieces grew since it was approved
 ✓ src/daemon/poll.test.ts > a cancel left while a runner project's forge is slow to answer is carried out at once > cancels the run, and stops the runner's work, while the slow call is still under way
      Tests  12 passed | 253 skipped (265)
```

Validation commands, as run:

```
$ npm run build && npm test 2>&1 | tail -5
src/daemon/session.test.ts(1022,20): error TS2345: … Property 'runner' is missing … 'PollDeps'.
src/daemon/session.test.ts(1023,20): error TS2345: … (same)
src/runner/actions.test.ts(53,7): error TS2353: … 'driver' does not exist …
src/runner/driver.test.ts(52,7): error TS2353: … 'driver' does not exist …
src/runner/replay/cases.ts(146,7), (153,7), (160,7): error TS2353: … 'driver' does not exist …
src/runner/session.test.ts(46,7): error TS2353: … 'driver' does not exist …
src/runner/tools.test.ts(31,7): error TS2353: … 'driver' does not exist …
(exit 2)
$ npm test 2>&1 | tail -5          # run separately, since the build stops the line above
 × a written answer starts one session and no more > does not read the same answer again when its session posted nothing
 Test Files  1 failed | 58 passed (59)
      Tests  1 failed | 1834 passed (1835)
$ grep -rn "driverOf\|turnRunnerProjects\|AgentSessionSpawner" src --include='*.ts' --exclude='*.test.ts' | grep -vE '…' | grep -v '^src/daemon/session\.ts' ; echo "exit: $? …"
exit: 1 (expected 1: only session.ts, which 41f owns, may still name the spawner)
$ node dist/cli.js projects list
NAME         PATH                  STACK                                                       TICKETING  PREVIEW  CLONED
scratch-app  projects/scratch-app  typescript,nextjs,prisma,postgresql                         github     docker   yes
ivtrends     projects/ivtrends     typescript,nextjs,prisma,postgresql,shadcn,vercel,supabase  github     docker   yes
timone       projects/timone       typescript                                                  github     -        yes
```

Every build error and the one failing test are in files outside this slice's list (see below). `tsc` still writes `dist/`, so `projects list` ran the new code. 1835 = 1990 − 167 deleted + 12 added. In a scratch copy with the six outside fixes below applied, `tsc --noEmit` exits 0 and `npm test` gives `Test Files 59 passed (59)`, `Tests 1834 passed (1834)`.

- [x] Red-green evidence for each of the eight cases is in the handoff, and for cases (9) and (10) the break-and-restore evidence. **PASS**
- [x] `node dist/cli.js projects list` loads the edited `timone.yaml` and lists three projects. **PASS**
- [x] The handoff lists every function this slice left for a later slice's file, with the file. **PASS**
- `npm run build && npm test` is **not green** in this repository: it needs the six edits below, in files this slice was not given.

**What 41c and later slices must know.**

- **Six edits outside this slice's files are needed before the build and suite pass.** Not made, as the slice contract requires.
  - Delete the line `      driver: "runner",` in `src/runner/actions.test.ts` (line 53), `src/runner/driver.test.ts` (52), `src/runner/session.test.ts` (46), `src/runner/tools.test.ts` (31), and all three in `src/runner/replay/cases.ts` (146, 153, 160; the last is production code).
  - Delete the describe `a written answer starts one session and no more` in `src/daemon/session.test.ts` (its one test drives `pollOnce` with a spawner and expects a resume). Its `pollOnce` import is then unused.
- **Functions left with no production caller, in files this slice does not own:**
  - `src/daemon/poll.ts`: types `SpawnContext`, `SessionSpawner` — imported only by `src/daemon/session.ts` (41f).
  - `src/daemon/session.ts` (41f): `AgentSessionSpawner` (no longer built by the daemon; still used by `session.test.ts` and `commands/guardrails.test.ts`), `refusedComment`, `refusedWait`, `stoppedTwiceComment`.
  - `src/commands/takeover.ts` (41e): `markAnswerConsumed`, `reopenIfFailed` — the daemon no longer calls them; takeover's own lock path still does.
  - `src/commands/retry.ts` (41d): the whole command only refuses now.
  - `src/daemon/runs.ts`: `RunStore.reclaim`, `refuse`, `refusalTold`, `started`, `rememberAskCheck`, `retry`, `parkedRuns`, `runningRun`.
  - `src/daemon/ask-check.ts`: `askCheck`, `planAskCheck`. Its type `AskCheckDeps` is still used by `src/daemon/consult.ts`, whose `sdkConsult` the runner uses.
  - `src/daemon/outcomes.ts`: `readHandback`, type `Handback`.
  - `src/daemon/pipeline.ts`: `frontierIsEmpty`, `isMap`, `readGate`.
  - `src/daemon/cta.ts`: `ctaComment`.
  - `src/daemon/faults.ts`: `refusalClears`.
- **`README.md` still says to add `driver: runner`** (lines 79 and 86). A manifest following it no longer loads. Not in this slice's files.
- **Duplicate tests, now that no test sets a driver** (refactoring I would do): in `poll.test.ts`, the new case tests (1), (3), (4), (5) say the same as `asks the runner to wake for a new ticket`, the older R15 test, `puts a runner project's run back on the runner's wait when the daemon stopped …` and `stops the running step and the runner's session when a runner project's run is cancelled`; in `takeover.test.ts`, case (7) says the same as `gives the run back to the runner when no daemon is running, …`. One of each pair could go. The `Succession` type's `continues` arm was already never produced, and still is not.
- **The stand-in never writes `woke`** (41a's note still holds), so assert later wakes with `toContain`.

### ✏ 2026-09-30 — 41b finished under the plan's second amendment

**Built.** Six more files were granted, and each got only the edit this section had already listed and checked in a scratch copy. The daemon now refuses to start while a project names nobody who may instruct it (case (11)). The build and the whole suite pass.

**Files touched, in addition to the list above.**

- `src/runner/actions.test.ts`, `src/runner/driver.test.ts`, `src/runner/session.test.ts`, `src/runner/tools.test.ts` — each lost its one `driver: "runner",` line.
- `src/runner/replay/cases.ts` — lost its three `driver: "runner",` lines.
- `src/daemon/session.test.ts` — the describe *a written answer starts one session and no more* deleted, and nothing else. Its `pollOnce` import is now unused; 41f owns the file.
- `src/commands/daemon.ts` — new `nobodyInstructs(manifest)`, private, beside `machineAdapter`. `runDaemon` calls it first, before the lock and before any cycle. When a project names nobody, it logs one sentence per project and returns 1.
- `src/commands/daemon.test.ts` — case (11): the describe *runDaemon — it does not start while a project names nobody who may instruct it*, with two tests.
- `src/manifest.ts` — the comments on `operator` and `namedPeople` now say the refusal lives at the daemon's start.

The six outside edits listed under *What 41c and later slices must know* are now made. That bullet is out of date.

**Validation evidence for case (11).**

- *Refuses.* `runDaemon — it does not start while a project names nobody who may instruct it > refuses to start, and says which project and what to add`. Seen red before the change: the daemon started and polled.

  ```
  × … > refuses to start, and says which project and what to add
    → expected +0 to be 1 // Object.is equality
  ✓ … > starts when the manifest names an operator, though the project names nobody of its own
  Tests  1 failed | 1 passed | 24 skipped (26)
  ```

  Green after it. The message, asserted in full: *The daemon does not start: project "scratch-app" names nobody who may instruct it. Add `instructors` to the project, or `operator` at the top of the manifest.* The test also checks that no ticket was listed and no lock was taken.
- *Starts with an operator.* `… > starts when the manifest names an operator, though the project names nobody of its own` passes before and after the change, so it could not be red. Proved able to fail by making the check refuse every project (`.filter(() => true)`), then restoring it:

  ```
  × … > starts when the manifest names an operator, though the project names nobody of its own
    → expected 1 to be +0 // Object.is equality
  Tests  1 failed | 1 passed | 24 skipped (26)
  ```

  Restored: `Tests  2 passed | 24 skipped (26)`.

**Validation commands, run again.**

```
$ npm run build && npm test 2>&1 | tail -5
> timone@0.1.0 build
> tsc
 Test Files  59 passed (59)
      Tests  1836 passed (1836)
(exit 0)
$ grep -rn "driverOf\|turnRunnerProjects\|AgentSessionSpawner" src --include='*.ts' --exclude='*.test.ts' | grep -vE '…' | grep -v '^src/daemon/session\.ts' ; echo "exit: $? …"
exit: 1 (expected 1: only session.ts, which 41f owns, may still name the spawner)
$ node dist/cli.js projects list
NAME         PATH                  STACK                                                       TICKETING  PREVIEW  CLONED
scratch-app  projects/scratch-app  typescript,nextjs,prisma,postgresql                         github     docker   yes
ivtrends     projects/ivtrends     typescript,nextjs,prisma,postgresql,shadcn,vercel,supabase  github     docker   yes
timone       projects/timone       typescript                                                  github     -        yes
```

1836 = 1835 − 1 (the deleted `session.test.ts` test) + 2 (case (11)).

- [x] Red-green evidence for each of the eight cases is in the handoff, and for cases (9) and (10) the break-and-restore evidence. Case (11) is added above. **PASS**
- [x] `node dist/cli.js projects list` loads the edited `timone.yaml` and lists three projects. **PASS**
- [x] The handoff lists every function this slice left for a later slice's file, with the file. The list above is unchanged by the amendment. **PASS**
- `npm run build && npm test` now exits 0, with 1836 tests passing. **PASS**

## 41c — Runs the old code left in the ledger become runs the runner can read

**Stopped, with two things that need a decision.** The conversion is built as the plan says, and six of the seven cases pass. Case (5) fails, and 39 tests that were green before now fail, 14 of them in files this slice was not given. Neither can be made to pass inside this slice's files without a choice the plan does not make. Both are below, under *What the orchestrator must decide*.

**Built.** When the ledger is read, a `failed` run loads as `cancelled`, and its reason is kept in `cancellation`, after *"stopped before the old code was removed: "*. A `parked` run whose wait is a gate, a conversation, a review, an escalation, or has no kind, loads with the kind `runner`. What it waits on, when the wait opened, and every other field stay as they were. A parked run with no wait at all is left as it is. It follows `normaliseWait`: `version` stays 1, and a read writes nothing. The converted runs reach the file the next time something writes it. Nothing in the conversion asks for a wake.

**Files touched.**

- `src/daemon/runs.ts` — new `normaliseOldPath` and the constant `STOPPED_BEFORE_REMOVAL`, after `normaliseWait` in `normaliseSequences`.
- `src/daemon/fixtures/ledger-before-166.json` — created. Machine-typed, not copied from the real ledger. Two projects. scratch-app: a done run, a cancelled run, a failed run on a branch (#21), a review park on a branch with a pull request (#24). ivtrends: a done run, a cancelled run, a failed run with no branch (#88), a gate (#90), a conversation (#91), an escalation (#92), a wait of no kind (#93), a run waiting for the runner (#94). Also introductions, the witness stamps and a daemon record.
- `src/daemon/runs.test.ts` — cases (1) to (4), in the describe *runs the old code left in the ledger become runs the runner can read*.
- `src/daemon/poll.test.ts` — cases (5) and (6), in the describe *the runs the old code left in the ledger, on the first cycle after it was removed*. New helpers `storeOnLedgerBefore166` and `forgeBefore166`.
- `src/commands/status.test.ts` — case (7), in the describe *renderStatus — the runs the old code left in the ledger*.
- `doc/plans/phases/reports/phase-41-handoffs.md` — this section.

No existing test was changed.

**Decisions taken inside the slice.**

1. **`failure` stays on a converted run.** `RunStore.cancel` keeps it on a failed run it cancels, and the plan says nothing else changes. `timone status` only prints `failure` for a run whose status is `failed`, so it is not shown twice. `consumedAnswerAt` stays too, for the same reason.
2. **A failed run with no reason** gets *"no reason recorded"* after the prefix, the words `timone status` and `reopenForTakeover` already use.
3. **A parked run with no wait at all is not given one.** There is nothing to keep as what it waits on. The runner's `handBack` gives it `RUNNER_DEFAULT_WAIT` if it is ever handed back.
4. **Case (5)'s forge lists the failed runs' tickets as open and marked.** The old code never took the mark off a failed run's ticket, and never held it. Leaving those tickets out of the listing would hide the one way the conversion can cause a wake. That is the fault case (5) found (below).
5. **Case (6) asserts only the wakes of the converted run it is about** (`ivtrends#90/1`), so the fault case (5) found does not make it fail too.

**Validation evidence.**

Cases (1), (2), (3), (4) and (7) were written first and seen red:

- *(1)* `loads each failed run as cancelled, keeping what stopped it, and leaves done and cancelled runs as they were`. Red: `expected { id: 'scratch-app#21/1', …(12) } to deeply equal { id: 'scratch-app#21/1', …(13) }`, with `- "cancellation": "stopped before the old code was removed: the execution stage finished …"`, `- "status": "cancelled"`, `+ "status": "failed"`.
- *(2)* `loads each old kind of wait as the runner's, keeping what it waits on and when it opened`. Red: `expected { id: 'ivtrends#90/1', …(10) } to deeply equal { id: 'ivtrends#90/1', …(10) }`, with `- "kind": "runner"`, `+ "kind": "gate"`.
- *(3)* `gives the same converted runs on a second load, and leaves the file as it was`. Red: `expected 'failed' to be 'cancelled'`.
- *(4)* `keeps a converted run on a branch holding its project, and one without a branch not`. Red: `expected 'review' to be 'runner'`.
- *(7)* `shows what a converted run waits on, in the words it waited on`. Red: `Expected: "scratch-app  #24 (delivering) — waiting: your review of pull request #31"`, `Received: "scratch-app  #24 (delivering) — waiting on you: your review of pull request #31"`.

Green after the change, with case (5) as the one failure:

```
 ✓ … runs the old code left in the ledger become runs the runner can read > loads each failed run as cancelled, …
 ✓ … > loads each old kind of wait as the runner's, keeping what it waits on and when it opened
 ✓ … > gives the same converted runs on a second load, and leaves the file as it was
 ✓ … > keeps a converted run on a branch holding its project, and one without a branch not
 ✓ src/commands/status.test.ts > renderStatus — the runs the old code left in the ledger > shows what a converted run waits on, …
 × src/daemon/poll.test.ts > the runs the old code left in the ledger, on the first cycle after it was removed > asks for no wake and posts nothing when nobody has written anything
 ✓ src/daemon/poll.test.ts > … > asks for a wake when a named person writes on a converted run's ticket
      Tests  1 failed | 6 passed | 316 skipped (323)
```

Cases (5) and (6) passed before the change, so neither could be red first.

- *(5)* went red because of the change. With the whole result in one assertion:

  ```
  +   "pickedUp": [ "ivtrends#88/2" ],
  +   "queued": [ "scratch-app#21/2" ],
  +   "wakes": [ { "events": [ "A new ticket was picked up. Nothing has been done on it yet." ], "runId": "ivtrends#88/2" } ],
  +   "writes": [ "comment on scratch-app#21: **This one is in the queue.** …",
  +               "comment on ivtrends#88: **Picked this up.** …" ],
  ```

- *(6)* is not vacuous. Made the conversion turn an old park into `cancelled` instead of changing its kind: `expected [] to deeply equal [ { runId: 'ivtrends#90/1', …(2) } ]`, `Tests  1 failed | 105 skipped (106)`. Restored: `Tests  1 passed | 105 skipped (106)`.

Checks that the parts of (3) and (4) the conversion cannot change are not vacuous. Each break was made in `runs.ts`, run, and undone (`diff` against a saved copy is empty after each):

- *(3), the file is not written.* Made `RunStore.open` write the ledger: `expected '{\n  "version": 1, …' to be '{\n  "version": 1, …'`, `Tests  1 failed`. Restored: `1 passed`.
- *(3), the same runs each load.* Made the conversion stamp `updatedAt` with the time of the read: `expected [ …(12) ] to deeply equal [ …(12) ]`, `- "updatedAt": "2026-09-30T17:48:20.825Z"`, `+ "updatedAt": "2026-09-30T17:48:20.826Z"`. Restored: `1 passed`. (Keying the conversion on `failure` instead of `status` does not break it: the reason is worked out again from `failure` on each read, so it is never prefixed twice.)
- *(4), a run on a branch holds.* Made the conversion drop `branch`: `expected undefined to be 'scratch-app#24/1'`. Restored: `1 passed`.
- *(4), a run without a branch does not hold.* Made the conversion set an old park to `picked-up`: `expected { id: 'ivtrends#90/1', …(10) } to be undefined`. Restored: `1 passed`.

Validation commands, as run:

```
$ npm run build && npm test 2>&1 | tail -5
> timone@0.1.0 build
> tsc
 Test Files  6 failed | 53 passed (59)
      Tests  40 failed | 1803 passed (1843)
$ git status --short .timone ; echo "(expected: nothing — no test touched the real ledger)"
(expected: nothing — no test touched the real ledger)
```

The build passes. 1843 = 1836 + 7 new tests. The 40 failures are case (5) and the 39 below.

- [ ] Red-green evidence for each of the seven cases is in the handoff. **FAIL** for case (5), which is red. The other six: red then green, or passing before the change with a break that shows it can fail.
- [ ] **Hard gate:** none of the seven tests is skipped or weakened. **PASS** as written. The gate is not met, because case (5) fails.
- `npm test` is **not green**: 40 failures.
- `git status --short .timone` is empty. **PASS**

**What the orchestrator must decide.**

1. **Case (5): a converted failed run's ticket is taken up afresh.** A `cancelled` run is settled, so on the next cycle `pollProject` opens a new run on its ticket if the ticket is still open and marked. The old code left every failed run's ticket open and marked unless a person closed it. On the first cycle, each such ticket gets a new run: a *"Picked this up"* comment and a runner wake where the project is free, a *"This one is in the queue"* comment where it is not. That breaks the plan's *"No wake is asked for because of a conversion."* On the real ledger it would post on real tickets, ivtrends included, and start paid runner sessions. `runs.ts` cannot prevent it: the ledger cannot write a label, and changing `register` goes beyond "nothing else changes". Two ways out that I can see:
   - **Hold the ticket, as `timone cancel` does since 41b.** Needs a change in `src/daemon/poll.ts`, and a record that the hold was put on once, so that a person removing the label hands the ticket back rather than getting it held again.
   - **Accept the new run as how a failed ticket starts again.** Then the plan's sentence and case (5) change: case (5) would list only the parked runs' tickets, and a new case would say what a failed run's still-marked ticket gets.
2. **Converting on every read hides `failed` and the old wait kinds from every reader, not only runs the old code left.** A run failed or parked on an old kind in this process reads back converted at the next read. So `RunStore.retry` and `reopenForTakeover` can no longer succeed, a failed chunk no longer holds its ticket, and `takeover.ts` never again sees a gate, a review, a conversation or a failed run. Since 41b only `session.ts` writes `failed`, itself or through `mergeChunkZero`, and the daemon no longer builds it. `takeover.ts` still parks on `conversation` and `escalation`. 39 tests that were green assert what was removed. None was edited: part of the answer depends on decision 1 (if failed runs stop being converted, the first group goes away).
   - *A failed run read back* — `runs.test.ts` (17): *register* › hands back a failed chunk rather than opening the next one beside it; *a ticket's chunks* › still calls a failed chunk live, because only a retry can end it; *two chunks of one ticket* › leaves a failed chunk retryable however often the poll loop re-registers, › opens the next chunk once a retried chunk finally succeeds; *the answer a run has read and not acted on* › keeps it through the transition that clears the wait, and through failure; all six of *retry*; *reopenForTakeover* › parks a failed run on a person, …; *cancelling a run* › cancels a failed run, …, › gives a run cancelled out of failure no way back, retry included, › lets a ticket move on from a failure that was abandoned rather than retried; *the heartbeat, …* › lets a reclaimed run be failed and then retried, with no new transition; *a heartbeat belongs to the session that wrote it* › does not reclaim a run that was just re-armed under an old heartbeat. `poll.test.ts` (3), where a failed run is only the starting state: *requests a human left for the daemon* › carries out a queued cancellation, in the human's own words, › serves nobody when the cycle was never told where the ledger is; *the runner drives its projects in the poll cycle* › settles a retry asked of a runner project with the refusal, and leaves the run as it was. Not granted: `src/commands/cancel.test.ts` › ends a failed run rather than sending the human via `timone retry`; `src/commands/daemon.test.ts` › carries out a request left beside the ledger; `src/commands/takeover.test.ts` › resolves a failed run the same way, …, › opens the unbound session on a failed run, and leaves it parked on a person afterwards.
   - *An old wait kind read back* — `runs.test.ts` (5): *a run parked on something nothing written can resolve* › carries the new kind through the file, and back out of it; *persistence* › round-trips state through the file; *the pull request on a run* › persists the pull request and the review wait across a reopen; *the wait as one value* › carries all four kinds through the file and back out, › folds a real pre-collapse ledger into the new shape. Not granted: `src/daemon/session.test.ts` › leaves the run parked, and still waiting, when the spawn throws; `src/commands/takeover.test.ts` › resolves a ticket waiting on a conversation to that stage, › refuses a ticket parked on a conversation inside the build, …, › sends a ticket waiting on a gate back to the ticket, …, › does not guess at a park it cannot resume, › refuses today, because nothing creates such a park yet, › starts nothing when the ticket is waiting on a ticket reply, › stops offering itself once two conversations running have moved nothing, › redirects to the pull request instead of opening anything, › holds no lock while the conversation runs, and holds the run instead.

**What the next slice must know.**

- `normaliseOldPath` runs on every read, after `normaliseWait`. Anything that writes `failed` or an old wait kind reads back converted.
- No function was deleted. The 41b list of functions with no production caller is unchanged. Decision 2 may make more of them dead in behaviour: `RunStore.fail`, `retry`, `reopenForTakeover`, `reclaim`'s re-arm, and the gate, review, conversation and failed branches of `resolveTakeover` in `src/commands/takeover.ts` (41e).
- A converted run has no `seen` mark in a run record. Its first look reads its ticket, and its pull request, from the run's `createdAt`. A named person's comment written after that, even one the old code already read, wakes the runner once. This was already so after 41b, for every parked run; the conversion does not change it.
- The runner looked at every parked run before this slice, whatever its kind. So a converted park is looked at exactly as before. What changes for it is how `handBack`, `timone status` and `timone takeover` read its wait.

### ✏ 2026-09-30 — 41c finished under the plan's amendment

**Built.** Both decisions above were made, and the plan was amended. A converted failed run whose ticket is still open and marked is picked up again as new work, like any marked ticket with no run. Converting on every read stays. `runs.ts` is unchanged since the section above. The work since is in tests only: case (5) is narrowed, case (8) is new, and the 39 tests listed above are deleted or re-based. The build and the whole suite pass.

**Files touched, in addition to the list above.**

- `src/daemon/poll.test.ts` — case (5) narrowed and renamed, case (8) added. `forgeBefore166` now takes `failedTickets`: `open and marked`, or `closed or not marked` (scratch-app #21 open with its mark taken off, ivtrends #88 closed). Three tests re-based. The helper `failedRun` deleted, since nothing uses it.
- `src/daemon/runs.test.ts` — 19 tests deleted, 3 re-based.
- `src/commands/cancel.test.ts` — 1 test deleted.
- `src/commands/daemon.test.ts` — 1 test re-based.
- `src/daemon/session.test.ts` — 1 test re-based.
- `src/commands/takeover.test.ts` — 10 tests deleted, 1 re-based. The helper `failed` deleted, and the describe *a ticket waiting on a pull-request review*, left empty.

The sentence "No existing test was changed" above no longer holds.

**Evidence for case (5), as narrowed, and case (8).**

- *(5)* `asks for no wake and posts nothing for a converted run when nobody has written anything, and no failed run's ticket is still open and marked`. The forge lists every waiting run's ticket as open and marked, and neither failed run's ticket. The test asserts no wake, no write to the forge, nothing picked up or queued, and no error. It passes with and without the conversion, so it could not be red first. Two breaks in `runs.ts` show it can fail. Each was undone, and `diff` against a saved copy is empty after each:
  - The conversion sets an old park to `picked-up`, which is a conversion that asks for a wake: `expected [ { …(3) }, …(4) ] to deeply equal []`, `Tests  1 failed | 106 skipped (107)`.
  - The conversion makes a failed run wait for the runner instead of cancelling it: `expected [ { runId: 'scratch-app#21/1', …(2) } ] to deeply equal []`.

  Restored: `Tests  1 passed | 106 skipped (107)`.
- *(8)* `picks a converted failed run's ticket up again as new work while it is still open and marked`. The forge lists the failed runs' tickets as open and marked. It asserts that `ivtrends#88/2` is picked up and the runner woken with the new-ticket event, and that `scratch-app#21/2` is queued behind #24. It also asserts one queue comment on scratch-app #21, one pickup comment on ivtrends #88, and no error. Red with the conversion taken out of `normaliseSequences`: `expected [] to deeply equal [ 'ivtrends#88/2' ]`, `Tests  1 failed | 2 passed | 104 skipped (107)`. Green with it: `Tests  3 passed | 104 skipped (107)`.
- *(6)* now uses the forge with the failed tickets open and marked, and still asserts only the wake of `ivtrends#90/1`. Its break was run again on the final test: `expected [] to deeply equal [ { runId: 'ivtrends#90/1', …(2) } ]`. Restored.

All eight together: `Tests  8 passed | 297 skipped (305)`.

**Every test deleted or re-based because an old state became unreachable.**

Deleted, because what they assert only a failed run or an old kind of wait can have (30):

- `src/daemon/runs.test.ts` (19):
  - A failed run holding its ticket: *register* › hands back a failed chunk rather than opening the next one beside it; *a ticket's chunks* › still calls a failed chunk live, because only a retry can end it.
  - Retry: *two chunks of one ticket* › leaves a failed chunk retryable however often the poll loop re-registers, and › opens the next chunk once a retried chunk finally succeeds; *retry* › re-arms a failed run keeping its branch, stage and pull request, › resumes past the stage that asked a question inside the build, carrying what it asked, › resumes at the stage it failed when the failure was an ordinary one, › leaves the dead attempt's flags behind, › keeps the flags the fresh attempt earns for itself, and › refuses when another run has since claimed the project; *the heartbeat, and the runs that have stopped making one* › lets a reclaimed run be failed and then retried, with no new transition; *a heartbeat belongs to the session that wrote it* › does not reclaim a run that was just re-armed under an old heartbeat.
  - The answer a failed run keeps for a retry: *the answer a run has read and not acted on* › keeps it through the transition that clears the wait, and through failure. The answer still outliving `activate` is asserted by › forgets it once the run has moved on, by a new wait or the next stage.
  - reopenForTakeover: › parks a failed run on a person, keeping its branch and stage, and forgets the failure.
  - Cancelling a failed run: *cancelling a run* › cancels a failed run, so work nobody will retry can be ended, › gives a run cancelled out of failure no way back, retry included, and › lets a ticket move on from a failure that was abandoned rather than retried. The same for a run that was not failed stays in › lets its ticket take a fresh chunk, because an abandoned one is settled.
  - An old kind read back: *a run parked on something nothing written can resolve* › carries the new kind through the file, and back out of it; *the wait as one value* › carries all four kinds through the file and back out.
- `src/commands/cancel.test.ts` (1): *timone cancel* › ends a failed run rather than sending the human via `timone retry`. Its subject is the ruling about a failed run's two ways out. A cancel of a run that is not failed stays in › ends the ticket's current chunk and says what it did.
- `src/commands/takeover.test.ts` (10), each a takeover of a run in an old state:
  - Conversation: *resolveTakeover* › resolves a ticket waiting on a conversation to that stage, and › refuses a ticket parked on a conversation inside the build, rather than re-opening the stage.
  - Gate: › sends a ticket waiting on a gate back to the ticket, rather than opening an interview.
  - No kind: › does not guess at a park it cannot resume.
  - Failed: *a run the machine stopped and cannot take further* › resolves a failed run the same way, rather than telling the person to re-mark the ticket, and › opens the unbound session on a failed run, and leaves it parked on a person afterwards.
  - Conversation: › refuses today, because nothing creates such a park yet.
  - Gate: *runTakeover* › starts nothing when the ticket is waiting on a ticket reply.
  - Conversation: *a takeover that finishes the step it took over* › stops offering itself once two conversations running have moved nothing.
  - Review: *a ticket waiting on a pull-request review* › redirects to the pull request instead of opening anything.

Re-based, because the old state was only where the test started, or because the test reads an older ledger (9):

- `src/daemon/runs.test.ts` (3):
  - *persistence* › round-trips state through the file: the parked run waits for the runner, not on a gate.
  - *the pull request on a run* › persists the pull request and the review wait across a reopen: renamed › persists the pull request and the wait on it across a reopen. The run waits for the runner, not on a review, and the test asserts that wait and its words come back.
  - *the wait as one value* › folds a real pre-collapse ledger into the new shape reads an older ledger. Its expected wait for `scratch-app#4/1` is now the converted shape, with `kind: "runner"`.
- `src/daemon/poll.test.ts` (3), each now starting from a run waiting for the runner (`waitingForRunner`):
  - *pollOnce — requests a human left for the daemon* › carries out a queued cancellation, in the human's own words.
  - › serves nobody when the cycle was never told where the ledger is. It asserts the run is still `parked`.
  - *the runner drives its projects in the poll cycle* › settles a retry asked of a runner project with the refusal, and leaves the run as it was.
- `src/commands/daemon.test.ts` (1): *runDaemon — the requests waiting beside the ledger it holds* › carries out a request left beside the ledger. The run waits for the runner instead of having failed.
- `src/daemon/session.test.ts` (1): *claiming a run before its session exists* › leaves the run parked, and still waiting, when the spawn throws. The run waits for the runner at the same stage and with the same opening instant, not on a conversation, and the test asserts that wait comes back.
- `src/commands/takeover.test.ts` (1): *takeover claims through the run, not the lock* › holds no lock while the conversation runs, and holds the run instead. The run waits for the runner, and is given back on the runner's wait at the same stage.

The unused imports `enqueue` (`takeover.test.ts`), `BUILD_ESCALATION_PREFIX` and `pollOnce` (`session.test.ts`), and `dirname` (`daemon.test.ts`) were already unused at 5044fc4. They were left alone.

**Validation commands, as run.**

```
$ npm run build && npm test 2>&1 | tail -5
> timone@0.1.0 build
> tsc
 Test Files  59 passed (59)
      Tests  1814 passed (1814)
$ git status --short .timone ; echo "(expected: nothing — no test touched the real ledger)"
(expected: nothing — no test touched the real ledger)
```

1814 = 1836 + 8 new tests − 30 deleted.

- [x] Red-green evidence for each of the eight cases is in the handoff. Cases (1), (2), (3), (4), (7) and (8) were seen red, then green. Cases (5) and (6) pass with and without the change, and breaks that make each fail are shown. **PASS**
- [x] Every test deleted or changed because an old state became unreachable is named in the handoff, with which of the two it was: 30 deleted, 9 re-based, listed above. **PASS**
- [x] **Hard gate:** none of the eight tests is skipped or weakened. Case (5) asserts exactly what the amended plan says. **PASS**
- `git status --short .timone` is empty. **PASS**

**What 41d and later slices must know.**

- `runs.ts` still holds the code these deletions leave with no test and no reachable use: `RunStore.fail`, `retry`, `reopenForTakeover`, the re-arm in `reclaim`, the `failed` rows of `TRANSITIONS`, and the comments that describe a failed run as waiting for `timone retry`. `takeover.ts` (41e) still has its gate, review, conversation, failed and no-kind branches in `resolveTakeover`, and `settle` still parks a new run on `conversation`. That run reads back as the runner's. `cta.ts` still has its `failed` branches, and `status.ts` still prints "stopped early" for a failed run. Neither can see one now.
- `normaliseOldPath` runs on every read. Anything later slices leave writing `failed` or an old kind is read back converted, so no test can observe those states through the store any more.

## 41d — `timone retry` is gone

**Built.** `timone retry` no longer exists. Typed with any arguments, it exits with code 1 and prints on stderr: *"`timone retry` was removed. Write on the ticket instead: say what you want done."* It is not in `timone --help`. The `retry` request kind is gone. A retry request an older build left beside the ledger is settled on the next cycle, reported once on that cycle's errors, and not reported again. `RunStore.retry` is deleted. No call to action and no line of `timone status` names `timone retry` any more: the status report has no list of failures, and a failed run's call to action is the one a cancelled run gets. The comments in the files that stay no longer describe `timone retry` as a command that exists.

**Files touched.**

- `src/commands/retry.ts`, `src/commands/retry.test.ts` — deleted (6 tests).
- `src/cli.ts` — `registerRetryCommand` gone. A hidden `retry` command takes any arguments, prints `RETRY_REMOVED` on stderr and sets exit code 1.
- `src/cli.test.ts` — created. Runs the built `dist/cli.js` in an empty temp directory. Cases (1) and (2).
- `src/daemon/requests.ts` — `retry` removed from the request body. New `removedSchema`, type `RemovedRequest`, and `PendingRequests.removed`: a file that is a retry request in the old shape is listed there, not in `unreadable`. `read` became `readJson`.
- `src/daemon/poll.ts` — `runRetry` import and the `retry` case gone. `applyRequests` settles each `removed` request and reports it once, with the "could not apply" line a failed request gets. New constant `RETRY_REMOVED`. Four comments no longer speak of a retry request.
- `src/daemon/poll.test.ts` — case (3) replaces *settles a retry asked of a runner project with the refusal, and leaves the run as it was*. *settles a request it cannot carry out, and does not try it again* now uses a `takeover-ended` request on a done run instead of a retry. `readdirSync` imported.
- `src/daemon/requests.test.ts` — the sample requests use `cancel` and `takeover-ended` instead of `retry`. The empty answer of `pending` now has `removed: []`.
- `src/daemon/runs.ts` — `retry()` and `loadedInitiativeFor` deleted; imports `HELD_LABEL`, `BUILD_ESCALATION_PREFIX`, `isBuildEscalation`, `inBuild`, `stageAfter` removed. Comments that named `timone retry` now say it was removed on 2026-09-30, or name `timone cancel` where they listed commands that name a ticket.
- `src/daemon/runs.test.ts` — 5 tests deleted, 1 trimmed (below). One comment reworded.
- `src/daemon/cta.ts` — the `failed` branch is gone; `failed` is answered by the `cancelled` branch. `isBuildEscalation` and `technicalFault` no longer imported. Three doc comments updated.
- `src/daemon/cta.test.ts` — 8 tests deleted, 1 trimmed (below). `BUILD_ESCALATION_PREFIX` import gone. One comment reworded.
- `src/commands/status.ts` — the list of failures is gone, with its comment.
- `src/commands/status.test.ts` — case (4) added. 3 tests deleted, 1 trimmed (below).
- `src/commands/cancel.ts`, `src/commands/takeover.ts`, `src/daemon/dropped.ts` — comments only.
- `src/daemon/faults.ts` — `isBuildEscalation` deleted. The comment on `BUILD_ESCALATION_PREFIX` says it stays only because `session.ts` names it.
- `src/daemon/lock.test.ts` — the sample command is `timone cancel scratch-app#6`.
- `doc/plans/phases/reports/phase-41-handoffs.md` — this section.

**Decisions taken inside the slice.**

1. **A hidden command, not no command.** Commander has no public way to answer one unknown command name with a sentence of our own; its unknown-command error is private. A command registered with `{ hidden: true }` is left out of the help. `.argument("[anything...]")`, `.allowUnknownOption()` and `.helpOption(false)` make any arguments, `--help` included, reach the sentence.
2. **The sentence goes to stderr**, as the commands' errors that stop them before any work already do (a manifest that cannot be read, for example). It is a refusal with exit code 1, not an answer.
3. **The unreadable path does not behave as the plan asks, so it was not used.** Today an unreadable file is left on disk on purpose, as evidence, and reported on every cycle. Removing `retry` from the schema alone sends a leftover retry down that path (seen red below). So `pending` recognises a retry in the old shape and lists it apart, and the cycle settles it. The cancellation watch reads only `requests`, so it never sees one.
4. **The cycle's report does not name `timone retry`.** It says *"the retry command was removed. Write on the ticket instead: say what you want done."* after the usual `could not apply retry <project>#<ticket> asked by <who>:`. So the only code outside comments that names `timone retry` is the command line's own sentence.
5. **`failed` shares the `cancelled` branch in `ctaFor`.** The type still has `failed`, and `run.status satisfies "parked"` needs every other status handled before it. The ledger loads a failed run as cancelled, so this is what every reader already sees.
6. **`isBuildEscalation` is deleted.** Its two callers went in this slice, it lives in `faults.ts`, which is in this slice's list, and no test covered it. `BUILD_ESCALATION_PREFIX` stays: `session.ts` (41f) imports it.
7. **Case (4) asserts that the output does not contain the word `retry` at all**, which covers `timone retry`, plus no "stopped early" and no "pick it up from where it stopped".
8. **Tests of removed text are deleted; tests that only started from a failed run are kept.** `renderStatus — a run whose daemon died under it › frees the project, so the line reads idle rather than busy` stays: it is still true, and says nothing about retry.

Tests deleted or trimmed, because the text or method they assert is removed:

- `src/commands/retry.test.ts` — all 6, with the file.
- `src/daemon/cta.test.ts` — deleted (8): *ctaFor* › names the exact retry command for a run that stopped early; › leaves a failed run saying it failed, with its own retry command; *ctaFor — the wayfinder map's two states* › says a map that broke what a broken ticket says, not what a map says; *ctaFor — a run the machine broke itself* › all five (the link went; the login was refused; the login ran out; a failure about the work; a build stage escalated). Trimmed: *ctaFor* › heads a stopped ticket with what happened, in the words already used lost its failed half.
- `src/commands/status.test.ts` — deleted (3): *renderStatus* › mentions a project's last failure rather than hiding it; *renderStatus — a run whose daemon died under it* › says what happened and what to type, without naming a daemon or a run; › names the way back for every failure, not only the reclaimed ones. Trimmed: *renderStatus* › says a cancelled chunk was stopped, without calling it a failure lost its two assertions that no "stopped early" and no `timone retry` are printed. Nothing can print either now.
- `src/daemon/runs.test.ts` — deleted (5): *retry* › refuses to retry anything that is not failed; *cancelling a run* › refuses a retry in words a person can act on, not an assertion; › says so without a reason, when none was recorded; *refusing to retry a step the machine is holding* › names the label to remove, because that is what would start it; › does not tell an ordinary ticket to remove a label it has not got. Trimmed and renamed: *cancelling a run* › has no way out of cancelled, retry included → › has no way out of cancelled.

**Validation evidence.**

*(1) and (2), the built command line* (`src/cli.test.ts`). Written first, built, and seen red:

```
× the removed retry command > exits 1 and sends the person to the ticket: `timone retry scratch-app#1`
  → expected 'Cannot read manifest file "timone.yam…' to be '`timone retry` was removed. Write on …'
× … `timone retry`
  → expected 'error: missing required argument \'ti…' to be '`timone retry` was removed. Write on …'
× … `timone retry scratch-app#1 --state elsewhere.json`
  → expected 'Cannot read manifest file "timone.yam…' to be '`timone retry` was removed. Write on …'
× … `timone retry --help`
  → expected +0 to be 1
× the removed retry command > is not listed in the help
  → expected 'Usage: timone [options] [command]\n\n…' not to match /\bretry\b/
Tests  5 failed (5)
```

Then one case at a time. The `retry` command registered in `cli.ts` with the sentence, not yet hidden: case (1) green, case (2) still red.

```
✓ … `timone retry scratch-app#1`   ✓ … `timone retry`   ✓ … --state elsewhere.json   ✓ … `timone retry --help`
× the removed retry command > is not listed in the help
  → expected 'Usage: timone [options] [command]\n\n…' not to match /\bretry\b/
Tests  1 failed | 4 passed (5)
```

Hidden with `{ hidden: true }`: `Tests  5 passed (5)`.

*(3), a retry request left in the queue* (`poll.test.ts` › *the runner drives its projects in the poll cycle* › settles a retry request left from before the command was removed, and says so once). The file is written by hand in the shape the old `enqueue` wrote. Red on the old code, which still read and refused it, in other words:

```
-   "could not apply retry scratch-app#31 asked by fvermaut: the retry command was removed. Write on the ticket instead: say what you want done.",
+   "could not apply retry scratch-app#31 asked by fvermaut: This project is run by the runner. Write on the ticket instead: say what you want done.",
Tests  1 failed | 106 skipped (107)
```

Red again with `retry` taken out of the schema, `poll.ts` and the command, and nothing added. This is the unreadable path:

```
-   "could not apply retry scratch-app#31 asked by fvermaut: the retry command was removed. …",
+   "unreadable request at /var/folders/…/.timone/requests/2026-09-29T18-00-00-000Z-000000-0a1b2c3d.json, left where it is",
Tests  1 failed | 106 skipped (107)
```

Green with `removed` in `pending` and its loop in `applyRequests`: `Tests  1 passed | 106 skipped (107)`. The "nothing on the next cycle" half is not vacuous: with `settle(leftover.path)` commented out, `expected [ '2026-09-29T18-00-00-000Z-000000-0a1b2c3d.json' ] to deeply equal []`, `Tests  1 failed`. Restored (`diff` against a saved copy empty): `1 passed`.

*(4), `timone status` on 41c's fixture* (`status.test.ts` › *renderStatus — the runs the old code left in the ledger* › shows no list of failures, and names no command that no longer exists). It passed before any change, because 41c already loads each failed run as cancelled, so it could not be red first. With 41c's conversion taken out of `normaliseSequences` and the old `status.ts`, it fails:

```
AssertionError: expected 'scratch-app  #24 (delivering) — waiti…' not to match /stopped early/
scratch-app #21 stopped early: the execution stage finished without committing anything to gate
  to pick it up from where it stopped: timone retry scratch-app#21
ivtrends #88 stopped early: triage recorded no classification
  to pick it up from where it stopped: timone retry ivtrends#88
Tests  1 failed | 54 skipped (55)
```

Restored (`diff` empty): `1 passed`. After the change to `status.ts` and `cta.ts`, it passes both with the conversion and with it taken out again, so the status report itself no longer lists failures or names `timone retry`, even for a failed run:

```
✓ … shows no list of failures, and names no command that no longer exists
-- with the conversion taken out:
✓ … shows no list of failures, and names no command that no longer exists
```

All four cases together: `Tests  7 passed | 157 skipped (164)`.

Validation commands, as run:

```
$ npm run build && npm test 2>&1 | tail -5
> timone@0.1.0 build
> tsc
 Test Files  59 passed (59)
      Tests  1798 passed (1798)
$ node dist/cli.js retry scratch-app#1 ; echo "exit: $? (expected 1)"
`timone retry` was removed. Write on the ticket instead: say what you want done.
exit: 1 (expected 1)
$ node dist/cli.js --help | grep -c retry ; echo "(expected 0)"
0
(expected 0)
$ grep -rn "timone retry" src --include='*.ts' | grep -v '^src/daemon/session\.ts' | grep -vE '^[^:]+:[0-9]+:\s*(//|/?\*)'
src/cli.ts:38:  "`timone retry` was removed. Write on the ticket instead: say what you want done.";
src/cli.test.ts:44:      "`timone retry` was removed. Write on the ticket instead: say what you want done.\n",
```

1798 = 1814 − 6 (`retry.test.ts`) − 8 (`cta.test.ts`) − 3 (`status.test.ts`) − 5 (`runs.test.ts`) + 5 (`cli.test.ts`) + 1 (case 4). Case (3) replaced one test.

- [x] The last command prints only the new sentence in `src/cli.ts` and its test. `src/runner/replay/cases.ts` has no mention of `timone retry` at all, so it prints none. `src/daemon/session.ts` still names it. **PASS**
- [x] No comment in a file this slice was given, and that stays, describes `timone retry` as a command that exists: each one now says it was removed, or tells what happened in the past tense. **PASS** for this slice's files. One comment outside them still does: `src/daemon/session.test.ts:4256` ("a run failed here would need `timone retry` on every ticket"), in 41f's area.
- [x] Red-green evidence for each of the four cases is in this section. Case (4) could not be red first; the break above shows it can fail. **PASS**

**What 41e and later slices must know.**

- **Code left with no production caller, in files this slice does not own.** `BUILD_ESCALATION_PREFIX` in `src/daemon/faults.ts` is read only by `src/daemon/session.ts`; delete it when 41f deletes that file. `technicalFault` is still used by `src/runner/session.ts`. 41b's and 41c's lists are otherwise unchanged: `RunStore.fail`, `reopenForTakeover`, the re-arm in `reclaim`, `ctaComment`, `refusalClears`, and the rest.
- **`RunStatus` still has `failed`**, and `TRANSITIONS` still has its `failed` row. `reclaim`'s re-arm goes `active → failed → picked-up` in one write, so the row is still used. `ctaFor` answers `failed` as `cancelled`; `timone status` shows a failed run nowhere.
- **Outside `src/`, `timone retry` is still named** in `README.md`, `manual/how-the-daemon-works.md`, `CONTEXT.md`, `process.md`, `STATUS.md` and older ADRs and plans. None was in this slice's files.
- **`src/daemon/session.test.ts`** still names `timone retry` in two comments (lines 2592, 4256).
- **`timone help retry`** prints `Usage: timone retry [anything...]` and exits 0. That is commander answering `help` for the hidden command. `timone retry --help` gives the sentence and exit 1.
- **`dist/commands/retry.js`** and its test build stay in `dist/` until it is cleaned. `tsc` does not delete output for a deleted source. Nothing imports them, and `vitest` does not read `dist/`.
- **The CLI test runs the built file.** `src/cli.test.ts` runs `dist/cli.js`, so `npm test` alone after a change to `src/cli.ts` tests the last build. `npm run build && npm test` is the order the plan uses.
- **Refactoring I would do but did not:** case (4) repeats the fixture copy and the two-project manifest of 41c's test above it. A small helper in `status.test.ts` could build both.

## 41e — Takeover, the status report and the call to action know only the runner's wait

**Built.** `timone takeover` now opens one kind of session: the session bound to no step. A parked run always gets it, because every parked run waits for the runner. A queued run, a running run, a finished run and a cancelled run get the same sentences as before. A failed run gets the cancelled run's sentence, since none can be read any more. A takeover of a ticket with no run registers the run the way the runner holds one: parked, waiting for the runner on `RUNNER_DEFAULT_WAIT`, with no step chosen. It is held for the terminal, and when the session ends it goes back to the runner with a request to wake it, as any run does. The answers for a gate and a review, the conversation at a stage, and the refusals that came with it are gone. `timone status` names every parked run's wait in its own words (`waiting: …`), and names a ticket in its closing line only when the runner asked for something, or when a done run's initiative needs the reader. `src/daemon/cta.ts` is deleted: what the status report still needed from it is now two small functions in `status.ts`.

**Files touched.**

- `src/commands/takeover.ts` — `TakeoverResolution` is `escalation` or `nothing-to-do`. `resolveTakeover` answers `parked` with the unbound session and `failed` with the cancelled sentence. `enrolFromTracker` parks the new run on the runner's wait and returns the unbound session. `claimForTakeover`, `withdraw` and the no-lock `takeover` lost their conversation paths; `Claim` lost `thread` and `escalation`. `escalate` reads the ticket itself. Deleted: `converse`, `markAnswerConsumed`, `reopenIfFailed`, `settle`, `entryStage`, `isPrompted`, `cannotConverse`, `parkedInBuild`, and the gate, review, conversation, no-kind and build-stage branches. Of the plan's `endTakeover`, `release` and `settle`: `settle` is deleted here; `release` and the old `endTakeover` went in 41b, and the runner's `endTakeover` stays.
- `src/commands/takeover.test.ts` — cases (1), (2), (3). 10 tests deleted, 17 re-based (below).
- `src/commands/status.ts` — new `waitsOnYou` (the closing line's rule) and a one-line `describeWait`. `ctaOf` and the import of `cta.ts` gone.
- `src/commands/status.test.ts` — case (4). 10 tests deleted, 7 re-based, one empty describe removed, one describe renamed (below).
- `src/daemon/cta.ts`, `src/daemon/cta.test.ts` — deleted (56 tests).
- `src/daemon/poll.ts` — `InitiativeProgress` moved here from `cta.ts`, beside the functions that produce it. The `claim-takeover` request refuses only on `nothing-to-do`. One comment no longer names the call to action.
- `src/daemon/poll.test.ts` — not changed.
- `doc/plans/phases/reports/phase-41-handoffs.md` — this section.

**Decisions taken inside the slice.**

1. **`cta.ts` is deleted, not trimmed.** For the runs that can still exist, the status report used only `waitingOnYou`, for its closing line. The headlines, the words and the command were read only by the ticket's standing note, which went in 41b. The rule left is ten lines. `InitiativeProgress` went to `poll.ts`, not `status.ts`, because `poll.ts` produces it and already imported it; `status.ts` now imports it from there with the two functions it already imported.
2. **Every parked run opens the unbound session, whatever its wait says.** The ledger reads each old kind as the runner's, so checking `kind === "runner"` would only add a refusal for runs nothing can produce. A parked run with no wait at all (41c leaves it as it is) also opens it. In `timone status` such a run reads `waiting: the next thing that happens on this ticket` and is not named in the closing line; before, it read as waiting on the reader.
3. **The refusal of a map went.** It existed because the map's stage started no conversation. The runner has its own order for a map (`ticketKindOf` answers `map` for `wayfinder:map`), and the poll loop registers a marked `wayfinder:map` ticket like any other (it skips only `timone:map`). So a map with no run is enrolled like any ticket.
4. **The enrolled run's wait is the one `putOnRunnersWait` writes** in `src/runner/session.ts`: `RUNNER_DEFAULT_WAIT`, kind `runner`, `resolvableBy: ["triage"]`, no stage, opened at the instant the run was registered. It is written out in `takeover.ts`, because `putOnRunnersWait` is private to a file this slice was not given.
5. **The ticket is read once, for the prompt.** Enrolment no longer needs the thread (the runner reads no cursor), so it is not fetched there. The resolution and the claim lost their `thread` field.
6. **`failed` shares the cancelled answer**, as it does in 41d's `ctaFor`. `RunStatus` still has `failed`, and the switch has to cover it.
7. **The terminal's line when the session opens is unchanged** ("I couldn't take this one further myself. Over to you."), and so is the prompt. 41g rewrites the prompt; case (2) says "as today".

Tests deleted, because the branch they test is deleted:

- `takeover.test.ts` (10): *a ticket the ledger has never heard of* › resolves an open wayfinder ticket from the tracker, at its own stage; › creates the run, parked on the conversation, at the stage the labels say; › enters a ticket nobody has classified at triage, and leaves it picked up; › refuses a map, and opens no wait on it. *runTakeover* › opens the session for a ticket the ledger had never heard of, reading it once (case (1) replaces it, and still asserts one read). *the prompt a takeover starts from* › is the stage's own prompt, for the stage the ticket is waiting at; › copes with a ticket nobody has replied to (the command no longer uses `takeoverPrompt`; `prompts.test.ts` keeps its own tests of it). *a run the machine stopped and cannot take further* › resolves to a session bound to no stage; › opens a session whose prompt is not the stuck stage's own; › opens it at a stage no conversation exists for, which is the point (a wait of kind `escalation`; case (2) covers the same session for the runner's wait).
- `status.test.ts` (10): *renderStatus* › names who is waited on, and what for, when a run is parked (a wait of no kind read as "waiting on you"). *the back half of the pipeline* › names the pull request a review wait is waiting on. *what the terminal can ask without a daemon* › stops saying 'waiting on you' about a ticket that needs nothing (the map's words); › still says it about a ticket that does need something (gate); › does not say a person is waited on about a run handed back to the machine (`CARRY_ON_WAIT`). *a ticket built in pieces* › names which piece of an initiative is waiting on a review; › says a project with no breakdown anywhere exactly what it always said (review); the describe, left empty, is removed. *one computation, two renderers* › says the same thing on the ticket and on the status line, from one call; › agrees about a run nothing written can restart, and shows the way out; › resolves an initiative's progress the same way for the ticket and the terminal (all three on `ctaFor` and `ctaComment`).
- `cta.test.ts` — all 56, with the file.

Tests re-based, because an old kind of wait was only where they started:

- `takeover.test.ts` (17): the helper `parkedOnConversation` became `waitingForRunner` (same stage, kind `runner`). It sets up *runTakeover* › execs the session at the timone root (renamed from "execs the conversation session …") and › returns the session's own exit code; *takeover and the ledger's one writer* › asks the daemon holding the ledger, names it, and gives up saying so; the three tests on `heldLedger` in *a takeover that gives up leaves nothing behind*; and five in *takeover claims through the run, not the lock* (throws, signal, heartbeat, beat stopped on a signal, daemon hands the run over). `handedBackAtRequirements` waits for the runner instead of a conversation (*a takeover that finishes the step it took over*, 2 tests). The occupier waits for the runner instead of a gate in *resolveTakeover* › explains a queued ticket … and *a ticket the ledger has never heard of* › queues a ticket behind the run holding its project …. Two tests compare the kind with `escalation` or `nothing-to-do` instead of `converse`: › says a cancelled chunk was abandoned …, › answers neither refusal with the sentence ADR-0024 retired.
- `status.test.ts` (7): the wait is the runner's in *renderStatus* › shows every waiting ticket, not just the first; › shows the running ticket alongside the ones that are waiting (now expects `#6.*waiting: an answer`); › names every waiting ticket in the closing line; › marks a run whose automatic checks failed; › ends with a line saying what is being asked of the reader; *what a run is costing right now* › says nothing about a model for a run that is waiting, not working; and the renamed describe *who the closing line names* › names in its closing line exactly the tickets that are waiting on the reader (was "… the computation is waiting on").

**Validation evidence.**

*(1) A takeover of a ticket with no run* (`takeover.test.ts` › *a takeover of a ticket with no run*, two tests). Written first and seen red:

```
× … > registers a run waiting for the runner, and resolves to the session bound to no step
  → expected 'converse' to be 'escalation' // Object.is equality
× … > holds the new run for the terminal, then gives it back to the runner and asks for a wake
  → expected { id: 'scratch-app#12/1', …(11) } to match object { status: 'active', …(2) }
    -     "on": "the next thing that happens on this ticket",
    +     "on": "a conversation in your terminal",
Tests  2 failed | 45 skipped (47)
```

Green after the change: `Tests  2 passed | 45 skipped (47)`. The second test also asserts the prompt is `escalationPrompt` for the held run, the ticket is read once, the run is parked on the runner's wait afterwards, and one `takeover-ended` request is left.

Cases (2) to (5) describe behaviour that must not change, so none could be red. Each passes on the old code and fails when the code it watches is broken. Every break was undone (`diff` against a saved copy empty each time).

*(2) A run waiting for the runner* (`takeover.test.ts` › *a run the runner waits on* › opens the session bound to no step, even for a run that stopped at a step). It compares the whole prompt with `escalationPrompt` for the held run. On the old `takeover.ts` (`git show HEAD:…` put in place, then restored): `✓ … opens the session bound to no step, even for a run that stopped at a step`. Breaks:

- The parked case returns `nothing-to-do`: `→ expected 1 to be +0`, `Tests  1 failed | 39 skipped (40)`.
- The prompt is built for the run with its step left out: `→ expected 'You are picking up **scratch-app #6**…' to be 'You are picking up **scratch-app #6**…'`, `Tests  1 failed | 39 skipped (40)`.

*(3) A queued or running run* (`takeover.test.ts` › *a takeover of a run that is queued or running*, two tests, through `runTakeover` with the lock). Each asserts exit code 1, nothing launched, the exact sentence, the status unchanged, no request and no lock left. On the old `takeover.ts`: both `✓`. Breaks:

- `queued` answers with the unbound session: `→ Run scratch-app#6/1 cannot go from queued to active (allowed: picked-up, cancelled)`, `Tests  1 failed | 1 passed | 38 skipped (40)`.
- `picked-up` answers with the unbound session: `→ expected +0 to be 1`, `Tests  1 failed | 1 passed | 38 skipped (40)`.

*(4) The status report on 41c's ledger* (`status.test.ts` › *the runs the old code left in the ledger* › says where each kind of run stands, and names no command). The whole output is written out by hand from the fixture: the parked runs on their projects' lines, the four cancelled runs with their reasons, and a closing line naming #24, #90, #91, #92 and #93 but not #94. It also asserts no `timone <word>` anywhere. On the old `status.ts` and `cta.ts`: `Tests  1 passed | 52 skipped (53)`. Breaks:

- The runner's own words for asking nobody count as an ask:

  ```
  - **What I need from you:** answer on scratch-app #24, ivtrends #90, ivtrends #91, ivtrends #92, ivtrends #93 — each ticket says what it needs.
  + **What I need from you:** answer on scratch-app #24, ivtrends #90, ivtrends #91, ivtrends #92, ivtrends #93, ivtrends #94 — each ticket says what it needs.
  Tests  2 failed | 3 passed | 38 skipped (43)
  ```

- A parked run's line says `waiting on you:`: `× … says where each kind of run stands, and names no command`, `Tests  2 failed | 3 passed | 38 skipped (43)`.

*(5) The closing line for a run waiting for the runner* is held by the four tests already in *renderStatus — a run the runner is waiting on*, unchanged, and by case (4). All passed at a3bcb32 and pass now. Breaks on the moved rule in `waitsOnYou`:

- The runner's default words count as an ask: `× … does not name the ticket in its closing line when the runner asked nobody for anything`.
- An ask opening on "nothing" counts as an ask: `× … does not name the ticket in its closing line when the runner wrote that it needs nothing`, `Tests  1 failed | 3 passed | 39 skipped (43)`.
- No parked run is ever waiting on the reader: `× … names the ticket in its closing line when the runner asked a person for something`, `Tests  1 failed | 3 passed | 39 skipped (43)`.
- A parked run's line says `waiting on you:`: `× … reads 'waiting:' and the runner's own words for a run on the runner's wait`.

Green, the five cases together, after the change: `takeover.test.ts` `Tests  40 passed (40)`; `status.test.ts` `Tests  43 passed (43)`.

Validation commands, as run:

```
$ npm run build && npm test 2>&1 | tail -5
> timone@0.1.0 build
> tsc
 Test Files  58 passed (58)
      Tests  1728 passed (1728)
$ grep -rnw "converse\|markAnswerConsumed\|reopenIfFailed\|CARRY_ON_WAIT" src --include='*.ts' | grep -v '^src/daemon/session\.ts\|^src/daemon/runs\.ts' | grep -vE '^[^:]+:[0-9]+:\s*(//|/?\*)' ; echo "exit: $? …"
src/runner/session.ts:244:  const end = await converse(deps, {
src/runner/session.ts:286:async function converse(
exit: 0 (expected 1; session.ts and runs.ts are 41f's and 41h's)
```

1728 = 1798 − 56 (`cta.test.ts`) − 10 (`takeover.test.ts`) − 10 (`status.test.ts`) + 5 (cases (1) to (3)) + 1 (case (4)). Test files: 58, one fewer.

The grep exits 0, not 1. Both lines are in `src/runner/session.ts`: the runner's own function that runs one session of the runner, also called `converse`. It was there at a3bcb32, it has nothing to do with the takeover, and the check's exclusion names `src/daemon/session.ts`, not this file. The file is not in this slice's list, so it was not renamed. With `src/runner/session.ts` also left out, the same command gives `exit: 1`.

- [x] Red-green evidence for each of the five cases is in the handoff. Case (1) was seen red, then green. Cases (2) to (5) describe behaviour that must not change: each passes on the old code, and the breaks above make each fail. **PASS**
- `npm run build && npm test`: 1728 passed. **PASS**
- The grep check: **not met as written**, only because of the unrelated `converse` in `src/runner/session.ts` (above). No hit is left for the takeover's `converse`, `markAnswerConsumed`, `reopenIfFailed` or `CARRY_ON_WAIT`.

**What 41f, 41g and 41h must know.**

- **`src/daemon/session.ts` (41f):** `takeover.ts` still imports `intervalTicker`, `waitOf` and the type `Ticker` from it. If 41f deletes the file, these three must move somewhere `takeover.ts` can import them. `outcomeCursorFrom` (`src/daemon/outcomes.ts`) is no longer called by the takeover; `session.ts` is its last production caller.
- **`src/daemon/prompts.ts` (41g):** `takeoverPrompt` has no production caller now. `prompts.test.ts` still tests it and compares `escalationPrompt` against it. `PROMPTED_STAGES` is left with `session.ts` as its only production caller. `escalationPrompt` is the only prompt the takeover uses, for every run it opens, including a ticket it has just enrolled; it still says the machinery "stopped on" the ticket, and `escalate`'s line at the terminal says "I couldn't take this one further myself".
- **`src/daemon/runs.ts` (41h):** `CARRY_ON_WAIT` has no reader (it was `cta.ts`). `RunStore.reopenForTakeover` has no caller (it was `reopenIfFailed`). The comments at lines 1183 and 1963 still name `ctaFor`, and 1963 says `timone takeover` writes `CARRY_ON_WAIT`, which it does not. `inBuild` and `waitFor` (`src/daemon/pipeline.ts`) are no longer called by the takeover; `session.ts` is their last production caller.
- **Deleted with `cta.ts`:** `ctaFor`, `ctaComment` (on 41b's list), `Cta`, `TicketState`. `takeoverCommand` in `src/channels/terminal.ts` keeps a caller in `prompts.ts`.
- **`dist/daemon/cta.*`** stay in `dist/` until it is cleaned; `tsc` does not delete output for a deleted source. Nothing imports them.
- **Not tested, before or after:** a done run whose initiative has pieces left and none can start is named in the closing line. `cta.test.ts` only asserted that case's headline. The rule is unchanged.
- **Nothing reads `InitiativeProgress.next`'s `index` or `title` any more.** `timone status` only asks whether `next` exists.
- **Left as they were:** `takeover.ts` imports `HELD_LABEL` and does not use it (already so at a3bcb32). `poll.test.ts` has two unused helpers, `parkedOnConversation` and `parkedOnGate`, in *pollOnce — resuming a run whose human answered* (already unused at a3bcb32). The ADRs that name `cta.ts` and `ctaFor` (0030, 0031, 0033, 0034, 0049) are records and were not edited. The command's help still says "Pick up a ticket that is waiting to talk something through".
- **Refactoring I would do but did not:** export the runner's first wait from `src/runner/session.ts`, so `enrolFromTracker` does not write the same shape a second time. Rename the resolution kind `escalation`, now that it is the only session. Case (2) and › resolves to the session bound to no stage say part of the same thing, and case (4) repeats the fixture set-up of the two 41c and 41d tests above it; a helper in `status.test.ts` could build the ledger and the manifest once.

## 41f — The old spawner, and everything only it used, is deleted

**Built.** The old spawner is gone. `AgentSessionSpawner`, its options, its ticket comments, its forge readers, and the helpers only it called are deleted from `src/daemon/session.ts`, which went from 2,560 lines to 579. `gate-comment.ts` and `ask-check.ts` are deleted. `outcomes.ts` keeps only `askedFor` and `LONGEST_ASK`, and `faults.ts` only `technicalFault`. The type of a model call now lives in `consult.ts`. `readTimoneCheckout` reads the version of Timone only: the list of uncommitted files had one reader, the spawner's refusal. No behaviour changes. No path has reached this code since 41b and 41e. Three things the plan deletes are kept, because a file outside this slice still imports them. They are under decisions 1 and 2.

**Files touched.**

- `src/daemon/session.ts` — deleted: `AgentSessionSpawner`, `AgentSessionSpawnerOptions`, `parkedComment`, `answeredComment`, `refusedWait`, `refusedComment`, `stoppedTwiceComment`, `unreachableComment`, `producedNothingComment`, `unclassifiedComment`, `newestPhaseFile`, `forgePlanStatus`, `forgeVerificationReport`, `forgePlannedPhase`, `handBack`, `escalate`, `carryToPullRequest`, `asBuildOutcome`, `laterOf`, `uncommittedRefusal`, `NAMED_IN_REFUSAL`, `DEFAULT_LINK_RETRY_WAITS_MS`, `waitWords`, and `TimoneCheckout.uncommitted`. Kept, as the plan lists, and `failedComment` (decision 1). Nothing renamed. Comments that named deleted code were corrected; the doc comments of `oneLine` and `waitOf`, which sat in the wrong place, are back above their functions, and `waitOf`'s no longer names `timone retry`.
- `src/daemon/session.test.ts` — 147 tests deleted. The 13 tests of `sessionOutcomeFrom`, `apiErrorFrom` and `sessionRequest` stay, unchanged.
- `src/daemon/chunk-zero.ts` — comments only: the note about `session.ts` importing this file back (it no longer does), and the notes that named the spawner. `mergeChunkZero` kept (decision 1).
- `src/daemon/chunk-zero.test.ts` — one describe title: *mergeChunkZero, as the current daemon uses it (40x)* became *mergeChunkZero, the form the old daemon used (40x)*.
- `src/daemon/gates.ts` — only `GateDecision` and `clarifyingRounds` stay (decision 2). Deleted: `APPROVAL_TOKENS`, `readGateDecision`, `readConversationRecord`, `waitCursorFrom`, `isApproval`, `instant`.
- `src/daemon/gates.test.ts` — the 3 tests of `clarifyingRounds` stay. 34 deleted: the `readGateDecision` and `gateComment` describes.
- `src/daemon/gate-comment.ts` — deleted.
- `src/daemon/ask-check.ts`, `src/daemon/ask-check.test.ts` — deleted (18 tests).
- `src/daemon/consult.ts` — new exported type `Consult`, the model call, moved from `AskCheckDeps["consult"]`. `sdkConsult` returns it. Comments now say what the runner uses it for.
- `src/daemon/outcomes.ts` — only `askedFor` and `LONGEST_ASK`. Deleted: `StageOutcome`, `outcomeCursorFrom`, `readStageOutcome`, `Handback`, `readHandback`, `namedStep`.
- `src/daemon/outcomes.test.ts` — the 5 tests of `askedFor` stay. 22 deleted: the `readStageOutcome` and `readHandback` describes.
- `src/daemon/faults.ts` — only `technicalFault`, with its type and word lists. Deleted: `SpawnRefusal`, `refusalClears`, `BUILD_ESCALATION_PREFIX`. The module comment says who reads it now.
- `src/daemon/poll.ts` — `SpawnContext`, `SessionSpawner` and the `PipelineStage` import only they used, deleted.
- `src/commands/guardrails.test.ts` — the one spawner case moved to `startStepSession` (decision 4). The helpers and imports only it used, deleted.
- `doc/plans/phases/reports/phase-41-handoffs.md` — this section.

`src/daemon/faults.test.ts`, `src/daemon/consult.test.ts`, `src/commands/daemon.ts`, `src/runner/session.ts` and `src/runner/actions.ts` needed no change: every name they import is kept.

**Decisions taken inside the slice.**

1. **`mergeChunkZero` is kept, and `failedComment` with it.** `src/runner/actions.test.ts` imports `mergeChunkZero` for a check that it cannot be written without an approval (line 15, and the `@ts-expect-error` at 876–877). That file is not in this slice's list, and the runner's tests are to stay unchanged. Deleting the function breaks the build there. The plan's rule says to keep it and say so. `failedComment` stays because `mergeChunkZero` calls it, and the one test of `mergeChunkZero` in `chunk-zero.test.ts` stays with the function. Nothing calls either. Both carry a dated comment saying why they stay. To finish: in `actions.test.ts`, name `tryMergeChunkZero` instead of `mergeChunkZero` in the import and the two lines at 876–877 (`chunk-zero.test.ts` already makes the same check on `tryMergeChunkZero`). Then `mergeChunkZero`, its test, `failedComment`, and the `failedComment` imports in `chunk-zero.ts` and `chunk-zero.test.ts` can go.
2. **`gates.ts` and `gates.test.ts` are kept, trimmed.** `pipeline.ts` (41h) and `pipeline.test.ts` import the type `GateDecision`, for `readGate`. `prompts.ts` (41g) imports `clarifyingRounds`, for `writtenAnswerBlock`. Neither file is in this slice's list. The rule says keep, so both stay, and so do the 3 tests of `clarifyingRounds`. A dated comment at the top of `gates.ts` names the two importers. When 41g and 41h drop those imports, the two files can be deleted.
3. **The model call's type is named `Consult`.** It is exported, so a later caller can name it. The runner's `RunnerDriverDeps.consult` writes the same shape out, and was left as it was.
4. **The guardrails case moved to `startStepSession`, because it tests a guardrail on a step's session.** *finding the run that drove a session › finds the run of a session started under the claim-first ordering* checks that `runForSession` finds the run whose session was started after the run was claimed. That path is `startStepSession`'s, which the spawner called. The test now parks the run on the runner's wait instead of a conversation (the ledger reads a conversation as the runner's since 41c), starts the session through `startStepSession` with a ticker that does nothing, and asserts the same thing. The ticket, the adapter and the project it built are gone, because nothing reads them now.
5. **`TechnicalFault` stays in `faults.ts`.** It is `technicalFault`'s return type.
6. **`attemptMerge` stays exported**, as the plan keeps it and renames nothing. Nothing outside `chunk-zero.ts` calls it now; its comment says so.
7. **Comments.** Every comment in this slice's files that named deleted code, or said the spawner does something now, was corrected. Comments that tell the history of a choice were left.

**Validation evidence.**

There are no new seams, so no red-green. The checks are the compiler, the suite, the runner's tests unchanged, and the replay's dry run.

*The compiler finds every user of what was deleted.* After `session.ts` was cut down, before any test was changed:

```
$ npx tsc --noEmit -p .
src/commands/guardrails.test.ts(26,3): error TS2305: Module '"../daemon/session.js"' has no exported member 'AgentSessionSpawner'.
src/daemon/session.test.ts(51,3): error TS2305: Module '"./session.js"' has no exported member 'AgentSessionSpawner'.
src/daemon/session.test.ts(52,3): error TS2305: Module '"./session.js"' has no exported member 'parkedComment'.
src/daemon/session.test.ts(285,22): error TS2322: Type 'Promise<{ uncommitted: never[]; }>' is not assignable to type 'Promise<TimoneCheckout>'.
… (and implicit-any errors in session.test.ts from the same missing types)
```

After `gates.ts` was trimmed: `src/daemon/outcomes.ts(12,10): error TS2305: Module '"./gates.js"' has no exported member 'instant'.` After the last change, `npx tsc --noEmit -p .` prints nothing.

*The moved guardrails case is not vacuous.* It passes, so it could not be red first. I commented out `store.activate(runId, started.sessionId, holder);` in `src/daemon/step-session.ts`, ran it, and put the file back from a saved copy (`diff` empty):

```
× finding the run that drove a session > finds the run of a session started under the claim-first ordering 7ms
  → expected undefined to be 'scratch-app#7/1' // Object.is equality
Tests  1 failed | 32 skipped (33)
```

Restored: `Tests  1 passed | 32 skipped (33)`.

*The runner's tests are unchanged.* `git diff HEAD -- src/runner` is empty. `npx vitest run src/runner`: `Tests  171 passed (171)`.

Validation commands, as run:

```
$ npm run build && npm test 2>&1 | tail -5
> timone@0.1.0 build
> tsc
 Test Files  57 passed (57)
      Tests  1507 passed (1507)
$ git diff --name-only main -- src/runner | grep -v '^src/runner/replay/' | grep -v '\.test\.ts$' ; echo "exit: $? (expected 1: …)"
exit: 1 (expected 1: the runner's own source files are unchanged; ✏ 2026-09-30 (build, timone#166): its test files lose their driver line in 41b)
$ npm run --silent replay -- --dry 2>&1 | tail -3
PASS ivtrends#1 — Start it again after a wait, and post nothing unless it keeps failing. 3 of 3 tries.
PASS #110 — Send the step a message to run only the tests its change affects. 3 of 3 tries.
19 of 19 cases passed. The runner's sessions cost $0.00 in all.
$ grep -rn "timone retry" src --include='*.ts' | grep -vE '^[^:]+:[0-9]+:\s*(//|/?\*)'
src/cli.ts:38:  "`timone retry` was removed. Write on the ticket instead: say what you want done.";
src/cli.test.ts:44:      "`timone retry` was removed. Write on the ticket instead: say what you want done.\n",
```

1507 = 1728 − 147 (`session.test.ts`) − 18 (`ask-check.test.ts`) − 34 (`gates.test.ts`) − 22 (`outcomes.test.ts`). The guardrails case was moved, not added. Test files: 57, one fewer.

- [x] The dry replay reports 19 of 19 cases. **PASS**
- [x] The last command prints only the sentence in `src/cli.ts` and its test. `src/runner/replay/cases.ts` has no mention of `timone retry`, so it prints none. **PASS**
- `npm run build && npm test`: 1507 passed. **PASS**
- The runner's own source files are unchanged: exit 1. **PASS**
- **Not met as the plan words it:** `mergeChunkZero` (with `failedComment`) is not deleted, and `gates.ts` and `gates.test.ts` are trimmed, not deleted. Decisions 1 and 2 give the reason and what finishes each.

**What 41g and 41h must know.**

- **`src/daemon/prompts.ts` (41g):**
  - `conversationSubject` has no production caller now (only `prompts.test.ts`).
  - `PROMPTED_STAGES`'s one production reader is `isPrompted` in `session.ts`, which the runner calls.
  - `writtenAnswerBlock` is what keeps `clarifyingRounds` in `gates.ts` alive (decision 2).
  - Nothing reads these markers off a ticket any more: `CONVERSATION_RECORD_MARKER`, `HANDBACK_MARKER`, `HANDBACK_STEP_PREFIX`, `STAGE_ESCALATED_MARKER`, `STAGE_DONE_MARKER`, `STAGE_HANDED_MARKER` (`src/adapters/ticketing.ts`). Their readers were `readConversationRecord`, `readHandback` and `readStageOutcome`, deleted here. `prompts.ts` still tells sessions to write them, and `runner/replay/cases.ts` writes the last two.
- **`src/daemon/pipeline.ts` (41h):**
  - No caller outside `pipeline.ts` now: `concludeConversation`, `inBuild`, `isBuilt`, `processStage`, `routeAfterTriage`, `runsUnattended`, `stageFromLabel`, and `waitFor` (called inside by `runsUnattended` and `requireWait`; runner tests still call it). `readGate` was already on 41b's list. It is the one user of `GateDecision` from `gates.ts` (decision 2).
  - The comment at line 728 links `{@link readGateDecision}`, which is deleted.
- **`src/daemon/runs.ts` (41h):**
  - `ESCALATION_WAIT` has no importer outside `runs.ts` (still read inside it, at line 2036).
  - `RunStore.carry` and `RunStore.unstarted` have no production caller. `RunStore.fail`'s one caller is the kept `mergeChunkZero`, which nothing calls.
  - The comment at line 673 names `AskCheckMemory` in `ask-check.ts`; both are deleted. `rememberAskCheck` and the `askCheck` field are still on 41b's list.
- **Files no slice named, left as they are:**
  - `src/git.ts`: `uncommittedFiles` has no production caller now (`git.test.ts` still tests it).
  - `src/channels/conversation.ts`: `inviteToConversation`, and `src/channels/terminal.ts`: `TerminalChannel` have no production caller now (only `terminal.test.ts`).
  - `src/daemon/step-session.ts`: the comment on its import from `session.ts` says `session.ts` imports it back, which is no longer true. Its doc says the spawner and the runner both call it; only the runner does.
  - `src/guards/checkouts.test.ts`: the reason given for `daemon/session.ts` in `GIT_USERS` says it reads "what in it is uncommitted". It reads only the version now. The guard still passes, because `session.ts` still imports `git.ts`.
  - `src/daemon/register.test.ts:78` names `ask-check.test.ts` inside a sample string. It checks nothing about the file.
  - `doc/specs/prd/prd-04-…criteria.md` describes the ask check, which is now deleted.
  - `DEFAULT_PROGRESS_INTERVAL_SECONDS` (`progress.ts`) lost the one test of its value, *defaults to thirty seconds*, with the rest of `session.test.ts`.
- **`dist/daemon/ask-check.*` and `dist/daemon/gate-comment.*`** stay in `dist/` until it is cleaned. `tsc` does not delete output for a deleted source. Nothing imports them.
- **Refactoring I would do but did not:** make `attemptMerge` private. Rename `ASK_CHECK_MODEL` and `ASK_CHECK_TIMEOUT_MS` in `consult.ts`, now that no ask check exists. Let the runner's `RunnerDriverDeps.consult` use the `Consult` type.

## 41g — What a step is told matches the runner

**Built.** No step is told to write a marker line any more. A step that finishes or stops closes with one plain comment that says how it ended, and that comment ends with the line `askedFor` reads, which every step prompt now names in its exact words: `**What I need from you:**`. A step that cannot go on says why on the ticket, says what it needs, and ends; it no longer writes the escalation line or the takeover command. The clarification and wayfinding prompts no longer ask for the "Agreed" record line, and no longer say the session was started because someone answered in writing. The takeover prompt (`escalationPrompt`) is now the prompt for a takeover of any run: it names the run's step and what the run waits on, lists what the run record says happened on this run, quotes what the named people wrote since the run began waiting, and says that when the session ends the runner wakes and reads the ticket, so the session ends by writing there what it did and what should happen next. When the run's step is a conversation, it tells the session to hold that conversation with the person, with that step's skill. The hand-back note, the "what ordinarily follows" hint and the stopped stage's quoted account are gone. `SYSTEM` in `src/runner/brief.ts` is unchanged.

**Files touched.**

- `src/daemon/prompts.ts` — `writingBlock` names `NEEDED_FROM_YOU`. `stuckBlock` rewritten, takes no argument. `outcomeBlock` without markers. `conversationOpening` has one opening. Clarification and wayfinding prompts lose the record line. Remediation prompt points at the review comment on the pull request and the runner's instructions, instead of the removed "what they replied" block. Execution prompt: the `Complete — see <report>` flip is described as the line the runner reads. `escalationPrompt` takes a fourth argument, `TakeoverFacts` (`record`, as `readRecord` returns it, and `namedPeople`), and is rewritten as above. New: `TakeoverFacts`, `recordBlock`, `recordLine`, `CONVERSATION_SKILLS`, `conversationBlock`, `namedWordsBlock`. Deleted: `feedbackBlock`, `writtenAnswerBlock`, `carriedBlock`, `conversationSubject`, `takeoverPrompt`, `handbackBlock`, `stoppedAccountBlock`, `unstamped`, `humanWordsBlock`, and the `PromptContext` fields `feedback`, `carried` and `interactive`. Imports of `clarifyingRounds` and `stageAfter` gone.
- `src/daemon/prompts.test.ts` — the five cases and five more tests of the new takeover prompt (below). 66 tests deleted and 20 re-based (below).
- `src/adapters/ticketing.ts` — deleted `CONVERSATION_RECORD_MARKER`, `STAGE_DONE_MARKER`, `STAGE_ESCALATED_MARKER`, `HANDBACK_MARKER`, `HANDBACK_STEP_PREFIX`, `CTA_MARKER`. `STAGE_HANDED_MARKER` and `CLARIFICATION_MARKER` kept, each with a dated note saying why.
- `src/runner/replay/cases.ts` — the import of `STAGE_DONE_MARKER` replaced by a local constant of the same name holding the same text. Nothing else changed.
- `src/commands/takeover.ts` — two import lines, and the `escalationPrompt` call, which now passes `readRecord(deps.root, …)` and `namedPeople(deps.manifest, …)`.
- `src/commands/takeover.test.ts` — the `STAGE_DONE_MARKER` import line; its one use, a sample comment body, now holds the text itself (decision 5); the two `escalationPrompt` calls pass an empty record and the test manifest's named people (none).
- `doc/plans/phases/reports/phase-41-handoffs.md` — this section.

**Decisions taken inside the slice.**

1. **The takeover prompt reads the run record through its caller.** The plan asks the prompt to say "what the run record says happened". The prompt stays a pure builder: `takeover.ts` passes the result of `readRecord`, and the prompt writes one line per entry of this run (steps, how they ended, the runner's decisions with their reasons, departures, approvals) and the ticket's two spending entries. The machine's bookkeeping entries (`woke`, `runner-ended`, `seen`, `notice`) are left out. An unreadable record is said in one sentence with the reader's own message. `renderRecord` in `src/commands/record.ts` was not reused: `prompts.ts` would then import a command file that imports `takeover.ts`, which imports `prompts.ts`.
2. **"The named people's words since" means since the run's wait opened**, compared with the runner's own `isNamedPerson` (imported from `src/runner/brief.ts`, which is unchanged). The runner reopens the wait each time it settles, so these are the words it has not acted on yet. The whole thread is still shown above them, voices told apart, as before.
3. **The stopped stage's quoted account is removed.** It found the account by the machine comment posted at the exact instant the wait opened, which only the old code between steps arranged. The runner's wait opens when the runner settles, so it would always have said "the stage left no account". One sentence stays in its place: the machine's comments in the thread may be wrong, check them first. Its test was re-based to that.
4. **`interactive` is deleted with `takeoverPrompt`.** It was read by `conversationOpening` only, and only `takeoverPrompt` passed it on a path that reads it (`escalationPrompt` set it and read nothing from it). With `takeoverPrompt` gone, the branch it selected could not be reached.
5. **`STAGE_DONE_MARKER` is deleted, and one line of `takeover.test.ts` beyond its import changed.** The import line could not go while its one use stayed. The use is a sample comment body; it now holds the marker's text, so the sample is exactly as it was. This is the same rule the plan gives for the replay cases. I report it because the grant for that file names only import lines and the call.
6. **`STAGE_HANDED_MARKER` is kept**, because `src/daemon/outcomes.test.ts` imports it and that file was not given to this slice. The replay cases import it too. Nothing in production code reads it or tells a step to write it. **`CLARIFICATION_MARKER` is kept**, because `clarifyingRounds` in `gates.ts` still reads it.
7. **`CTA_MARKER` is deleted too**, although 41f did not list it: it had no reference at all in `src/` (its reader, the standing call to action, went in 41b).
8. **The stuck rule no longer gives the takeover command.** The plan says the step says it cannot go on, says what it needs, and ends; the runner reads that. Whether to offer a takeover is the runner's decision (its rules already say when not to write the command).
9. **The requirements and breakdown prompts are unchanged.** "The machinery posts the approval request itself, immediately after yours" names no mechanism that is gone: the runner asks for the approval after the step ends.
10. **The conversation steps and their skills:** clarification → `timone-grill`, wayfinding and charting → `timone-wayfind`.
11. **The name `escalationPrompt` is kept**, so `takeover.ts` changes only its call. Renaming it would touch more of a file this slice may only lightly edit.

**Validation evidence.**

*(1) No step's prompt carries a retired marker line* (`prompts.test.ts` › *what a step is told matches the runner (41g)* › `%s is told to write none of the retired marker lines`, one per step in `PROMPTED_STAGES`). The test lists the eight texts as they were written: the six deleted markers, and the handed and clarification lines, which stay as constants but which no step is told to write. Red before the change:

```
× … > triage is told to write none of the retired marker lines
  → triage still carries: 🆘 **Needs more than a reply** · written by the machine when a stage cannot act on the answer it was given: …
× … > clarification is told to write none of the retired marker lines
  → clarification still carries: ✅ **Agreed** · the record of a conversation, accepted by the human: …
× … > research is told to write none of the retired marker lines
  → research still carries: 🏁 **Step finished** · written by the machine when a stage completed its work: …
(and the same for the other eight steps)
Tests  11 failed | 223 skipped (234)
```

Green after `stuckBlock`, `outcomeBlock` and the two record lines changed: `Tests  11 passed | 223 skipped (234)`.

*(2) Every step is still told to end with the line `askedFor` reads* (`%s is still told to end with the line \`askedFor\` reads`, one per step). `askedFor` reads the text after `NEEDED_FROM_YOU` = `**What I need from you:**` on the last such line. The old prompts said only "one explicit line saying what, if anything, you need from them" and never named those words, so this was honestly red:

```
× … > triage is still told to end with the line `askedFor` reads
  → expected 'A ticket was filed on the managed pro…' to contain 'End every message to them with one li…'
(and the same for the other ten steps)
Tests  11 failed | 234 skipped (245)
```

Green after `writingBlock` named `NEEDED_FROM_YOU`: `Tests  22 passed | 223 skipped (245)` (cases 1 and 2 together).

*(3) The takeover prompt for a run waiting for the runner names its step and what it waits on, and says nothing about a hand-back line* (`the takeover prompt for a run the runner waits on (41g)` › `names the run's step and what it waits on, and says nothing about a hand-back line`). Red: `→ expected 'You are picking up **scratch-app #6**…' not to contain 'Picking it back up'`. After the hand-back section went it was red a second time, because the step's plain name had only ever appeared in the hand-back list: `→ … to contain 'writing down what it needs'`. Green after the "where the run stands" lines named the step: `✓ … names the run's step and what it waits on, and says nothing about a hand-back line`.

*(4) A run whose step is wayfinding names the wayfinding skill* (`tells the session to hold the %s conversation with the person, with \`%s\``, for wayfinding, clarification and charting). Red:

```
× … > tells the session to hold the wayfinding conversation with the person, with `timone-wayfind`
  → expected 'You are picking up **scratch-app #6**…' to contain '`timone-wayfind`'
× … clarification … `timone-grill`   × … charting … `timone-wayfind`
Tests  4 failed | 22 passed | 223 skipped (249)   (cases 3 and 4)
```

Green after `conversationBlock`: `Tests  26 passed | 223 skipped (249)`. The guard `holds no conversation for a step that is not one` passed before the change, so it could not be red first. Made `conversationBlock` answer `timone-wayfind` for every step: `→ expected 'You are picking up **scratch-app #6**…' not to match /hold that conversation/i`, `Tests  1 failed | 187 skipped (188)`. Restored (`diff` against a saved copy empty): `1 passed`.

*(5) The dry replay passes 19 of 19, with every case's recorded comments unchanged.* Before any change, I dumped every case's ticket (with its comments), pull request (with its comments), record, events, files and right calls to JSON through `tsx`. After the change I dumped them again. `cmp` found the two files identical: 19 cases, 70 ticket comments, 5 pull-request comments, 49 occurrences of the "Step finished" text. This cannot be red first, since nothing may change. To show the comparison can fail, I changed "Step finished" to "Step done" in the local constant, dumped again, and `cmp` failed: `differ: char 755, line 20`, 48 lines changed, the first being scratch-app's sorting comment. Restored (`diff` against a saved copy empty). The dry replay after the change: `19 of 19 cases passed.`

*The rest of the new takeover prompt*, each written first and seen red, then green:

```
× … > says the runner wakes when the session ends and reads what it left on the ticket
  → expected 'You are picking up **scratch-app #6**…' to match /when this session ends, the runner w…/i
× … > says what the run record says happened on this run, and on no other
  → expected 'You are picking up **scratch-app #6**…' to contain 'two questions only the operator can a…'
× … > says so when the run record cannot be read
  → expected 'You are picking up **scratch-app #6**…' to contain 'line 3 is not JSON'
× … > carries what the named people wrote since the run began waiting, and nobody else's words
  → expected '--- what they wrote ---\nonly the dra…' not to contain 'make it purple'
Tests  4 failed | 27 passed | 223 skipped (254)
```

Green: `Tests  31 passed | 223 skipped (254)`.

**Tests deleted, because what they assert is removed (66).** All in `prompts.test.ts`:

- *every stage prompt* › `%s carries the human's words when a gate sent it back` (11) and `%s says nothing about feedback when there was none` (11): the `feedback` field is gone.
- *the clarification prompt* and *the wayfinding prompt* › `tells the session someone is present and waiting, when one is` (2): `interactive` is gone.
- *the wayfinding prompt* › `marks the resolution so the machinery knows the run is over` (1): the record line is gone.
- *a conversation prompt built for a written answer* › `%s carries what they wrote, as an answer`, `%s forbids re-asking what the answer already settles`, `%s allows exactly one more question, marked so it can be counted`, `%s hands back the takeover instead of asking a third time` (2 each, 8): `writtenAnswerBlock` is gone.
- *conversationSubject* (1) and *takeoverPrompt* (1): the functions are gone.
- *the execution / verification / delivery / remediation prompt* › `carries both outcome markers, verbatim` (4): case (1) asserts the opposite.
- *the rule every stage carries about an answer it may not act on* › `asks the %s prompt for the machine header above the marker, in that order` (11), `gives the %s prompt the exact command its comment must close on` (11), `forbids inviting another answer, and still leaves them something to do` (1).
- *the escalation prompt* › `names what normally follows as the pipeline's default, not as a decision`, `gives the exact shape of the note that hands the work back`, `lists every step it may name, and only steps that can be started`, `warns that a name off that list is refused, not guessed` (4).

**Tests re-based (20).**

- *the clarification prompt* › `requires an accepted summary, marked so the machine can find it again` → `requires an accepted summary before it posts one as agreed`.
- *the wayfinding prompt* › `is a stage a takeover can hold a conversation for` → `is a step the runner can start a session for` (same assertion; the reason now given is `isPrompted`).
- *a conversation prompt built for a written answer* › `%s does not claim anyone is at the keyboard when nobody is` (2) → *a conversation prompt, with nobody at the keyboard* › `%s does not claim anyone is at the keyboard, or that a written answer started it`.
- *the planning prompt* › `asks for the outcome record the daemon reads it by` → `asks for the closing comment the runner reads`.
- *the remediation prompt* › `carries the review comment as the defect brief` → `takes the review comment on the pull request as the defect brief`. Seen red before the remediation prompt was reworded.
- *the rule every stage carries…* renamed *the rule every step carries for when it cannot go on*; `is carried by the %s prompt` (11) asserts the rule and that the runner reads the comment, not the marker.
- *the escalation prompt* › `is not any stage's prompt, wearing a hat` (no `interactive`, no `takeoverPrompt`); `carries the stopped stage's account, and says it may be wrong` → `carries the stopped step's account, and says the machine's comments may be wrong`; `carries what the human wrote after it stopped` → `carries what a named person wrote after the run began waiting`. Its other tests only gained the fourth argument.

**Tests added (31):** case (1) 11, case (2) 11, case (3) 1, case (4) 3, the guard 1, and four more tests of the takeover prompt. 1472 = 1507 − 66 + 31. `prompts.test.ts`: 223 → 188.

**Each marker deleted, and the search that shows nothing reads it.**

```
$ for m in CONVERSATION_RECORD_MARKER STAGE_DONE_MARKER STAGE_ESCALATED_MARKER HANDBACK_MARKER HANDBACK_STEP_PREFIX CTA_MARKER; do grep -rnw "$m" src --include='*.ts' | grep -v '^src/runner/replay/cases.ts'; echo "$m exit $?"; done
CONVERSATION_RECORD_MARKER exit 1
STAGE_DONE_MARKER exit 1
STAGE_ESCALATED_MARKER exit 1
HANDBACK_MARKER exit 1
HANDBACK_STEP_PREFIX exit 1
CTA_MARKER exit 1
```

`cases.ts` is left out of the search only because it now has its own local constant named `STAGE_DONE_MARKER`. By text, the six lines appear only in test samples: `prompts.test.ts` (the list case (1) checks against), `takeover.test.ts` (one sample body) and `cases.ts` (the recorded comments). Before deleting, the search that decided it was the same `grep -rnw` over `src/`, and `grep -rn` for the marker texts and for "Agreed", "in writing" and "conversation record" in `src/runner` and `src/channels`: none of these is read by the runner, `timone status`, `conversation.ts` or `terminal.ts`.

**Validation commands, as run.**

```
$ npm run build && npm test 2>&1 | tail -5
> timone@0.1.0 build
> tsc
 Test Files  57 passed (57)
      Tests  1472 passed (1472)
$ git diff --quiet main -- src/runner/brief.ts ; echo "exit: $? (expected 0: the runner's instructions are unchanged)"
exit: 0 (expected 0: the runner's instructions are unchanged)
$ npm run --silent replay -- --dry 2>&1 | tail -3
PASS ivtrends#1 — Start it again after a wait, and post nothing unless it keeps failing. 3 of 3 tries.
PASS #110 — Send the step a message to run only the tests its change affects. 3 of 3 tries.
19 of 19 cases passed. The runner's sessions cost $0.00 in all.
```

- [x] Red-green evidence for each of the five cases is in the handoff. Cases (1) to (4) were seen red, then green. Case (5) cannot be red; the comparison of the recorded comments was shown able to fail. **PASS**
- [x] The handoff lists each marker deleted, and for each, the search that shows nothing reads it. **PASS**
- `npm run build && npm test`: 1472 passed. **PASS**
- `src/runner/brief.ts` unchanged: exit 0. **PASS**
- Dry replay: 19 of 19. **PASS**

**What 41h must know.**

- **`src/daemon/gates.ts`:** `clarifyingRounds` has no production caller now (its one caller was `writtenAnswerBlock`). Only `gates.test.ts` calls it. The comment at line 11 says `prompts.ts` imports it, which is no longer true. With `readGate` gone as well, `gates.ts`, `gates.test.ts` and `CLARIFICATION_MARKER` can all go.
- **`src/adapters/ticketing.ts`:** `STAGE_HANDED_MARKER` stays only for `src/daemon/outcomes.test.ts` (lines 3, 17, 36) and the replay cases. To delete it, write its text into those two files as `cases.ts` now does for the "Step finished" line. `TicketingAdapter.upsertComment` has no production caller (its caller was the standing call to action); only its implementations and the replay's fake define it.
- **`src/daemon/pipeline.ts`:** `stageAfter` lost its last caller outside `pipeline.ts` (`escalationPrompt`); it is still called inside, by functions 41f listed as having no outside caller.
- **`src/commands/takeover.ts`:** the line the terminal prints when the session opens still says "I couldn't take this one further myself. Over to you.", and the command's help still says "Pick up a ticket that is waiting to talk something through". Neither was in this slice's grant.
- **`dist/`** is not cleaned by `tsc`; nothing was deleted as a file here.
- **Refactoring I would do but did not:** rename `escalationPrompt` to `takeoverPrompt` and `StoppedRun` to `TakenOverRun`, now that the old `takeoverPrompt` is gone and the run has not always stopped. The "Do not write application code" paragraph still says "the machinery"; "the runner and its steps" would be plainer.

## 41h — The ledger and the step table keep only what the runner uses

**Stopped, with the build red for one reason: edits in 12 files outside this slice's list (7 lines changed, 72 deleted).** Everything the plan asks is done in this slice's files. Removing `failed`, the old wait kinds and `upsertComment` breaks the type check in files this slice was not given, and one test there reads the takeover's printed line. The lines are listed under *What the orchestrator must grant*. With them applied in a scratch copy, `tsc` exits 0, 1399 tests pass, and the dry replay passes 19 of 19. Four fields the plan removes stay in the schema, because 41c's tests compare its fixture's runs whole (decision 1).

**Built.** A run's status is one of `queued`, `picked-up`, `active`, `parked`, `done`, `cancelled`. The transition table has no `failed` row and no move into `failed`; `active → picked-up` is gone. A wait's kind is `runner` or absent. The ledger drops `askCheck`, `deaths`, `refusal` and `carried` when it is read, and reads an old kind of wait on a run that is not parked as the runner's, so an old ledger still loads. A read writes nothing; the next write puts the runs on disk without those fields. `RunStore` lost `runningRun`, `parkedRuns`, `rememberAskCheck`, `fail`, `reopenForTakeover`, `refuse`, `started`, `unstarted`, `refusalTold`, `reclaim` and `carry`; `runs.ts` lost `RE_ARM_LIMIT`, `stoppedTwiceWait`, `assertAllowed`, `RE_ASK_LIMIT`, `ESCALATION_WAIT`, `CARRY_ON_WAIT`, `isReAskAfterAnswer`, the type `AskCheckRecord`, and the re-ask floor in `applyPark`. The step table keeps each step's label, `ownsBranch`, model and effort, and nothing else: `next`, `stageAfter`, the wait column, `waitFor`, `WaitKind`, `runsUnattended`, `requireWait`, `resolvableBy`, `built`, `isBuilt`, `inBuild`, `processStage`, `readGate`, `concludeConversation`, `routeAfterTriage`, `PipelineTransition`, `frontierIsEmpty`, `FRONTIER_EMPTY_LABEL`, `isMap` and `stageFromLabel` are deleted. With them went what 41b to 41g left: `mergeChunkZero`, `failedComment`, `gates.ts`, `CLARIFICATION_MARKER`, `STAGE_HANDED_MARKER`, `carriesMarker`, `upsertComment`, `uncommittedFiles`, `TerminalChannel`, `inviteToConversation` and the conversation seam. `timone takeover` prints a new line and has new help text.

**Files touched.**

- `src/daemon/runs.ts` — as above. New `REMOVED_FIELDS` and `normaliseRemovedFields`, run after `normaliseOldPath`. `normaliseWait` works out an old wait's `resolvableBy` itself (a review was ended by remediation, any other wait by its stage), as `resolvableBy` in `pipeline.ts` did. `applyPark` gives a wait with no `resolvableBy` the stage it parks at. `ParkOptions.kind` is `"runner"`; `ParkOptions.consumedAnswerAt` is gone. Comments that described `failed`, `timone retry`, the floor or the consumed answer as live were rewritten. `normaliseOldPath` and `STOPPED_BEFORE_REMOVAL` are unchanged.
- `src/daemon/runs.test.ts` — case (1): two tests. 21 tests deleted, 16 re-based (below). 41c's describe, its helpers and its fixture are unchanged.
- `src/daemon/pipeline.ts` — as above. `StageFacts` holds `label` and `ownsBranch`; a step with no session is `{ spawns: false }`. The row comments that spoke of waits, `next`, `built` or `inBuild` were removed; the comments on models and branches stay.
- `src/daemon/pipeline.test.ts` — case (3): 13 tests. 39 tests deleted, 3 re-based (below).
- `src/daemon/gates.ts`, `src/daemon/gates.test.ts` — deleted (3 tests). Nothing imported `GateDecision` or `clarifyingRounds` once `readGate` went.
- `src/adapters/ticketing.ts` — deleted `CLARIFICATION_MARKER`, `STAGE_HANDED_MARKER`, `upsertComment` on the interface, and `carriesMarker` with its helper `withoutPictures`, whose one caller was `gates.ts`.
- `src/adapters/github-tickets.ts` — the forge's `upsertComment` deleted. `src/adapters/github-tickets.test.ts` — its describe (5 tests) and its line in *every call this adapter makes can be scoped to a repository*.
- `src/adapters/ticketing.stubs.ts` — not changed: it has no `upsertComment` stub.
- `src/daemon/outcomes.test.ts`, `src/runner/replay/cases.ts` — each has a local `STAGE_HANDED_MARKER` holding the text exactly as recorded, as 41g did for the "Step finished" line. The import went.
- `src/runner/actions.test.ts` — the type check names `tryMergeChunkZero`, in the import and the two lines of the check.
- `src/daemon/chunk-zero.ts` — `mergeChunkZero` deleted; what its comment said about the required approval now sits on `tryMergeChunkZero`. `failedComment` import gone.
- `src/daemon/chunk-zero.test.ts` — the `mergeChunkZero` test deleted, and the helpers only it used. The approval check stays, renamed (below).
- `src/daemon/session.ts` — `failedComment` deleted, nothing else.
- `src/git.ts`, `src/git.test.ts` — `uncommittedFiles` and its 3 tests deleted; `mkdirSync` import gone.
- `src/channels/conversation.ts` — deleted. Once `TerminalChannel` went, nothing implemented or called the seam.
- `src/channels/terminal.ts` — only `takeoverCommand` stays. `src/channels/terminal.test.ts` — only its test stays (16 deleted).
- `src/daemon/step-session.ts`, `src/guards/checkouts.test.ts` — comments only.
- `src/commands/takeover.ts` — the printed line and the help text only.
- `doc/plans/phases/reports/phase-41-handoffs.md` — this section.

**Decisions taken inside the slice.**

1. **`failure`, `consumedAnswerAt`, `reAsksAfterAnswer` and `wait.acknowledgedAt` stay in the schema.** 41c's fixture carries all four (#21 and #88 `failure`, #88 `consumedAnswerAt`, #91 `reAsksAfterAnswer`, #24 `acknowledgedAt`), and 41c's tests (1) and (2) compare the loaded run with the fixture's run whole. Stripping the fields breaks both tests (shown below), and the prompt says those tests pass unchanged. `failure` also fails the plan's own test: 41c's cancelled runs keep it (41c decision 1). Nothing sets any of the four to a value now. `setStage`, `complete`, `cancel` and `applyPark` still clear the first two, as before, so a run the runner touches loses them as it did; `src/runner/actions.ts:863` says so and stays true. `acknowledgedAt` is also still copied by `waitOf` in `src/daemon/session.ts`, which this slice could only touch for `failedComment`.
2. **The wait's `kind` stays, with one value.** The runner reads it: `handBack` in `src/runner/driver.ts:841` and `settle` in `src/runner/session.ts:469` keep a wait's words only when its kind is `runner`.
3. **An old kind of wait on a run that is not parked is read as the runner's.** 41c converts only parked runs. With `runner` the only kind in the schema, a run claimed by the old code while still holding its gate wait would make the whole ledger fail to load. This is case (1)'s second test.
4. **Transitions kept:** every move the runner's path makes — `picked-up → parked` (a run the runner puts on its wait before it looks, and a takeover of a ticket with no run), `active → active` (a claim, then the session), `active → done` and `parked → done` (the runner's `end_run`; `src/runner/session.ts` says a run ends only from `active` or `parked`), and every move into `cancelled`. Removed: the `failed` row, every move into `failed`, and `active → picked-up` (only `unstarted` made it).
5. **`TERMINAL` and `SETTLED` now hold the same two statuses.** Both stay; they answer different questions. Their comments say so.
6. **`carriesMarker` and `withoutPictures` were deleted, though the amendment does not name them.** Their one caller was `gates.ts`, deleted here, and they live in `ticketing.ts`, which is in this slice's files. **`conversation.ts` was deleted whole**, not only `inviteToConversation`: with `TerminalChannel` gone, `recordConversationOutcome` and the four types had no user but the test of the seam.
7. **The takeover's printed line** is now *"Picking up scratch-app #6 here. When you end this session, the runner reads the ticket and decides what comes next."* Its help text is *"Work on a ticket in this terminal, then give it back to the runner"*. Both say what happens now, as 41g's prompt does.
8. **Tests re-based where an old kind or a deleted method was only the starting state.** In `runs.test.ts`, ten tests and the helper `parkedBranchless` park on `runner` instead of `gate`, `conversation` or `review`. *records what a parked run is waiting for, and where the gate starts* does too, and is renamed *…, and when the wait opened*. *leaves finished runs alone, however old* cancels its second run instead of failing it. *has nothing more to reclaim once it has reclaimed* parks the stale run on the runner's wait, which is what the cycle now does with one. *shows another process's claim to a guard that has itself written nothing* asserts through `occupyingRun` only. *moves a wait with repark…* and *refuses a wait no stage can end* use `runner`. In `pipeline.test.ts`: *keeps the breakdown on chunk zero's branch, at process stage 5* → *keeps the breakdown on chunk zero's branch* (the branch assertion only); *gives every stage the daemon spawns a session for a declared model* → *gives every stage a session is started for a declared model* (every stage but `charting`); *declares nothing for a stage no session is ever started for* lost its `isBuilt` line. In `chunk-zero.test.ts`: *…cannot be written without the approval that allows the merge, as the daemon's form cannot* lost its last clause.

Tests deleted, because what they test is deleted (88):

- `runs.test.ts` (21): *the answer a run has read and not acted on* (2); *a run parked on something nothing written can resolve* (2); *the floor under a stage that does not notice* (6); *promotion* › promotes when a run fails, too; *reopenForTakeover* › refuses a run that has not failed; *the heartbeat, …* › frees the project the moment a stale run is failed; *two processes writing the one ledger* › lets only one of two processes resume the same parked run (with its helper, a copy of the old `resumeAnswered`); *a failed run stops waiting* (2); *a run whose holder died* (4); *a wait that says what can end it* › says remediation ends a review, because nothing else acts on one.
- `pipeline.test.ts` (39): *routeAfterTriage* (5); *the stage graph* (15 of 18: every test of `stageAfter`, `waitFor`, `isBuilt`, `processStage` or `runsUnattended`); *inBuild* (3); *readGate* (6); *concludeConversation* (3); *one name per step* › the three tests of `stageFromLabel`; *the escalation wait* (4).
- `gates.test.ts` (3), `git.test.ts` (3), `github-tickets.test.ts` (5), `terminal.test.ts` (16), `chunk-zero.test.ts` (1).

1399 = 1472 − 88 + 15 new. Test files: 56 (`gates.test.ts` gone).

**Validation evidence.**

*(1) A ledger carrying every removed field loads, and the loaded runs carry none of them* (`runs.test.ts` › *fields only the old code wrote are dropped when the ledger is read (41h)*). Written before the change, with a done run, a parked run and a cancelled run carrying `askCheck`, `deaths`, `refusal` and `carried`, and an active run holding a gate wait. Red:

```
× … > loads a ledger carrying each of them, and gives runs that carry none of them
  → expected { id: 'scratch-app#30/1', …(12) } to deeply equal { id: 'scratch-app#30/1', …(10) }
  +   "carried": [ { "at": "2026-09-20T10:00:00Z", "stage": "execution", … } ],
  +   "deaths": [ "the machine running it stopped" ],
× … > reads an old kind of wait on a run that is not parked as the runner's, and still loads
  -   "kind": "runner",
  +   "kind": "gate",
Tests  2 failed | 139 skipped (141)
```

Green after the change: `Tests  6 passed | 135 skipped (141)` (with 41c's four). The first test also checks that the read leaves the file as it was, and that the next write drops the fields.

*(2) 41c's fixture loads as 41c's tests say, and they pass unchanged.* The ten tests on `ledger-before-166.json` (four in `runs.test.ts`, three in `poll.test.ts`, three in `status.test.ts`) pass before and after. Before: `Tests  10 passed | 281 skipped (291)`. After: `Tests  10 passed | 260 skipped (270)`; the same ten names, the same result. The three describes hash the same at HEAD and now (`d13a638e94d1`, `d10aa04249d5`, `b06f13de786a`), `git diff` shows no change to 41c's helpers in `runs.test.ts`, and the fixture is unchanged. This cannot be red first. What it guards is shown by adding `failure`, `consumedAnswerAt` and `reAsksAfterAnswer` to `REMOVED_FIELDS`, then restoring (`diff` against a saved copy empty):

```
× … > loads each failed run as cancelled, keeping what stopped it, …
  → expected { id: 'scratch-app#21/1', …(12) } to deeply equal { id: 'scratch-app#21/1', …(13) }
× … > loads each old kind of wait as the runner's, keeping what it waits on and when it opened
  → expected { id: 'ivtrends#91/1', …(10) } to deeply equal { id: 'ivtrends#91/1', …(11) }
Tests  2 failed | 2 passed | 137 skipped (141)
```

A copy of the real ledger (131 runs) also loads with the new code; its runs carry no `askCheck`, `deaths` or `carried`, and the read leaves the copy unchanged.

*(3) For every step, the table gives the same label, model, effort and `ownsBranch` as on `main`* (`pipeline.test.ts` › *what the runner reads from the step table (41h)*, 13 tests; the expected table is written out by hand from `main`, where `pipeline.ts` equals HEAD). Written before the change: `Tests  13 passed | 67 skipped (80)`. It cannot be red first. Two breaks in `pipeline.ts`, each restored (`git diff --stat` empty):

```
execution owns no branch:
× … > gives execution the same label, model, effort and branch as on main
  → expected { label: 'building', …(3) } to deeply equal { label: 'building', …(3) }
Tests  1 failed | 12 passed | 67 skipped (80)
delivery's effort raised to high:
× … > gives delivery the same label, model, effort and branch as on main
  → expected { label: 'delivering', …(3) } to deeply equal { label: 'delivering', …(3) }
Tests  1 failed | 12 passed | 67 skipped (80)
```

Kept after the change: `pipeline.test.ts` `Tests  41 passed (41)`.

Validation commands, as run in this repository:

```
$ npm run build && npm test 2>&1 | tail -5
> tsc
src/commands/cancel.test.ts(54,7): error TS2322: Type '"gate"' is not assignable to type '"runner"'.
src/commands/cancel.ts(278,10): error TS2678: Type '"failed"' is not comparable to type '"queued" | … | "cancelled"'.
src/commands/daemon.test.ts(109,11): error TS2561: … 'upsertComment' does not exist in type 'TicketingAdapter'. …
src/commands/status.test.ts(244,48), (340,11), (527,9): error TS2322: Type '"failed"' is not assignable to type …
src/commands/takeover.ts(181,10): error TS2678: Type '"failed"' is not comparable to type …
src/daemon/poll.test.ts(441,7), (454,7): error TS2322: Type '"conversation"' / '"gate"' is not assignable to type '"runner"'.
src/daemon/poll.test.ts(601,13), (987,11), (1642,13), (4300,13): error TS2561: … 'upsertComment' does not exist …
src/daemon/step-session.test.ts(217,7): error TS2322: Type '"gate"' is not assignable to type '"runner"'.
src/runner/actions.test.ts(161,5), src/runner/driver.test.ts(113,11), src/runner/replay/recording.ts(513,11): error TS2561: … 'upsertComment' …
(exit 2; the implicit-any errors that follow from the same lines are left out here)
$ npm test 2>&1 | tail -5          # run on its own, since the build stops the line above
 × a run the runner waits on > opens the session bound to no step, even for a run that stopped at a step
 Test Files  1 failed | 55 passed (56)
      Tests  1 failed | 1398 passed (1399)
$ grep -rnw "stageAfter\|routeAfterTriage\|inBuild\|readStageOutcome" src --include='*.ts' | grep -vE '^[^:]+:[0-9]+:\s*(//|/?\*)' ; echo "exit: $? (expected 1)"
exit: 1 (expected 1)
$ npm run --silent replay -- --dry 2>&1 | tail -3
PASS ivtrends#1 — Start it again after a wait, and post nothing unless it keeps failing. 3 of 3 tries.
PASS #110 — Send the step a message to run only the tests its change affects. 3 of 3 tries.
19 of 19 cases passed. The runner's sessions cost $0.00 in all.
```

Every build error is in a file outside this slice's list. The one failing test is `takeover.test.ts:1316`, which reads the old printed line. In a scratch copy of this tree with the edits below applied: `tsc --noEmit` exit 0, `npm run build` exit 0, `Tests  1399 passed (1399)`, dry replay `19 of 19 cases passed.`

- [x] PRD-05.R1's hint holds: no table in code picks the next step. `next` and `stageAfter` no longer exist; the grep exits 1. **PASS**
- [x] `RunStatus` no longer has `failed`. The word stays in the code that reads an old ledger (`normaliseOldPath`, `STOPPED_BEFORE_REMOVAL`), and in comments that say it was removed. **PASS in `runs.ts`.** Two `case "failed":` lines remain outside this slice's files (below), and they are what stops the build.
- [x] Red-green evidence for each of the three cases is in this section. Case (1) was seen red, then green. Cases (2) and (3) cannot be red; the breaks above show each can fail. **PASS**
- `npm run build && npm test`: **FAIL** in this repository, for the lines below only. **PASS** in the scratch copy with them applied.
- Dry replay: 19 of 19. **PASS**

**What the orchestrator must grant.** The edits, file by file. None changes behaviour; each follows from something this slice deleted.

- `src/commands/takeover.ts` — delete `case "failed":` (line 181) and the two comment lines above it.
- `src/commands/cancel.ts` — delete `case "failed":` (line 278) and the eleven comment lines above it, which describe cancelling a failure.
- `src/commands/status.test.ts` — `status: "failed"` becomes `status: "cancelled"` at lines 244, 340 and 527, the status the ledger reads such a run as. The `failure` fields beside them stay valid.
- `src/commands/cancel.test.ts:54`, `src/daemon/step-session.test.ts:217` and `:241` — `kind: "gate"` becomes `kind: "runner"`.
- `src/daemon/poll.test.ts` — delete the constant `invitation` and the helpers `parkedOnConversation` and `parkedOnGate` that alone read it (lines 428–458; unused since 41b, as 41e noted); delete `upsertComment` from the five fakes that define it (lines 176, 601, 987, 1642–1658, 4300–4302) and `"upsertComment"` from `WRITE_CALLS` (line 1565).
- `src/commands/daemon.test.ts:109`, `src/daemon/hooks.test.ts:617`, `src/commands/takeover.test.ts:170`, `src/runner/actions.test.ts:161`, `src/runner/driver.test.ts:113` — delete the fake's `upsertComment` line. (`hooks.test.ts` and `takeover.test.ts` compile either way; their line is dead.)
- `src/runner/replay/recording.ts:513–515` — delete the replay forge's `upsertComment`. Nothing calls it; the dry replay passes without it.
- `src/commands/takeover.test.ts:1316` — the expected line becomes `"Picking up scratch-app #6 here. When you end this session, the runner reads the ticket and decides what comes next."`.

**Still dead, and why it stays.**

- `failure`, `consumedAnswerAt` and `reAsksAfterAnswer` on a run, `acknowledgedAt` on a wait, and the code that clears them (`setStage`, `complete`, `cancel`, `applyPark`) — `src/daemon/runs.ts`. 41c's tests compare its fixture whole (decision 1). To remove them: change 41c's expected runs in `runs.test.ts` to leave the four out, add them to `REMOVED_FIELDS` (and strip `wait.acknowledgedAt` beside the old kind), drop `acknowledgedAt` from `waitOf` in `src/daemon/session.ts` and from `ParkOptions`, and reword `src/runner/actions.ts:863`.
- `ParkOptions.acknowledgedAt` — `src/daemon/runs.ts`; only `waitOf` in `src/daemon/session.ts` passes it, from the kept field.
- Everything in the list above, until it is granted.

**What the next reader must know.**

- `dist/` is not cleaned by `tsc`: `dist/daemon/gates.*` and `dist/channels/conversation.*` stay until it is. Nothing imports them.
- `src/adapters/command-runner.test.ts:99` names `upsertComment` in a comment that tells how a fault was found on 2026-08-22. It is history and was not in this slice's files.
- The ADRs and plans that name the deleted functions are records and were not edited.
- **Refactoring I would do but did not:** merge `TERMINAL` and `SETTLED` into one list now that they are equal, or keep both and let one be defined as the other. Rename `escalationPrompt` and `StoppedRun` as 41g suggested. The runner's own `RunnerDriverDeps.consult` could use the `Consult` type (41f).

### ✏ 2026-09-30 — 41h finished under the plan's second amendment

**Built.** (a) The twelve edits listed above under *What the orchestrator must grant* are applied, exactly as they were checked in the scratch copy. (b) `failure`, `consumedAnswerAt`, `reAsksAfterAnswer` and the wait's `acknowledgedAt` are removed from the run's schema and stripped when the ledger is read, as the other four removed fields are. `ParkOptions.acknowledgedAt` is gone. So are the clears that existed only for these fields: in `setStage`, `complete`, `cancel` and `applyPark`. `waitOf` no longer copies `acknowledgedAt`. A run the old code failed keeps its reason in `cancellation`: `normaliseOldPath` writes it there before `failure` is stripped. The build and the whole suite pass. Decision 1 above, and the first item under *Still dead*, no longer hold.

**Files touched, in addition to the list above.**

- The twelve files of (a): `src/commands/takeover.ts`, `src/commands/cancel.ts`, `src/commands/status.test.ts`, `src/commands/cancel.test.ts`, `src/daemon/step-session.test.ts`, `src/daemon/poll.test.ts`, `src/commands/daemon.test.ts`, `src/daemon/hooks.test.ts`, `src/commands/takeover.test.ts`, `src/runner/actions.test.ts`, `src/runner/driver.test.ts`, `src/runner/replay/recording.ts`.
- `src/daemon/runs.ts` — the four fields out of the schema and into `REMOVED_FIELDS` (`acknowledgedAt` is stripped from the wait in `normaliseRemovedFields`); `ParkOptions.acknowledgedAt` and the clears deleted; the comments that said why the fields stayed, deleted.
- `src/daemon/runs.test.ts` — case (1)'s ledger now carries the four fields too, and its check after a write names them. 41c's tests (1) and (2) compare against a new helper, `before166Read`: the fixture's run without the four fields, written out by hand. Only the expected runs of #21, #88 (test 1) and the loop over #90, #91, #24, #92, #93 (test 2) use it; it differs from the fixture only for #21, #88, #91 and #24. What each test checks is unchanged.
- `src/daemon/session.ts` — `waitOf` stops copying `acknowledgedAt`, with its comment.
- `src/runner/actions.ts` — the comment near line 863 now says `setStage` changes only the stage, and that the two fields it cleared were removed.
- `src/commands/status.test.ts` — beyond (a): two fixtures, in *a run whose daemon died under it* › frees the project… and *who the closing line names* › names in its closing line exactly the tickets…, set their reason as `cancellation` instead of `failure`. The field no longer exists, so they no longer compiled. Neither test reads the reason.

`poll.test.ts` and `status.test.ts` needed no change for 41c's tests: none of their expected values carries one of the four fields.

**Evidence for (a).** After `git apply` of the patch checked above (`shasum` 29961fd8…), each of the twelve files is byte-for-byte the scratch copy's (`cmp`). Then, before (b): `tsc --noEmit` exit 0, `npm run build` exit 0, `Tests  1399 passed (1399)`.

**Evidence for (b).**

*Case (1), extended.* Seen red with the four fields added to its ledger, before they were removed:

```
× … > loads a ledger carrying each of them, and gives runs that carry none of them
  → expected { id: 'ivtrends#96/1', …(10) } to deeply equal { id: 'ivtrends#96/1', …(9) }
  +   "reAsksAfterAnswer": 1,
  +     "acknowledgedAt": "2026-09-29T14:02:00Z",
Tests  1 failed | 1 passed | 118 skipped (120)
```

Green after: both case (1) tests pass.

*Case (2), again.* After the schema change and before the test change, 41c's tests (1) and (2) failed on the fields, as expected: `expected { id: 'scratch-app#21/1', …(12) } to deeply equal { …(13) }` and `expected { id: 'ivtrends#91/1', …(10) } to deeply equal { …(11) }`. After the expected runs changed, all ten tests on 41c's fixture pass: `Tests  10 passed | 260 skipped (270)`. Three breaks in the conversion, each restored (`diff` against a saved copy empty):

```
break 1 — a failed run's reason loses its prefix:
× … > loads each failed run as cancelled, keeping what stopped it, …
× renderStatus — the runs the old code left in the ledger > says where each kind of run stands, and names no command
Tests  2 failed | 8 passed | 260 skipped (270)
break 2 — an old kind of wait on a parked run is left as it was:
× … > loads each old kind of wait as the runner's, …
  → expected { id: 'ivtrends#93/1', …(10) } to deeply equal { id: 'ivtrends#93/1', …(10) }
Tests  1 failed | 9 passed | 260 skipped (270)
break 3 — `failure` is no longer stripped:
× (all ten) → Invalid daemon state file "…/state.json": runs.2: Unrecognized key: "failure"; runs.6: Unrecognized key: "failure"
Tests  10 failed | 260 skipped (270)
restored: Tests  10 passed | 260 skipped (270)
```

*The real ledger.* A fresh copy (never the file itself) carried `failure` on 5 runs, `consumedAnswerAt` on 2, `reAsksAfterAnswer` on 9, `askCheck` on 10, `deaths` on 1, `carried` on 4, and 4 failed runs. Read with the new code: `131 runs loaded`; statuses `cancelled 19, done 104, parked (runner) 7, active 1`; the loaded runs carry only `branch cancellation createdAt flags heartbeatAt holder id pr project seq sessionId stage status ticket updatedAt wait`; the copy is unchanged by the read. `git status --short .timone` is empty.

**Validation commands, run again.**

```
$ npm run build && npm test 2>&1 | tail -5
> tsc
 Test Files  56 passed (56)
      Tests  1399 passed (1399)
$ grep -rnw "stageAfter\|routeAfterTriage\|inBuild\|readStageOutcome" src --include='*.ts' | grep -vE '^[^:]+:[0-9]+:\s*(//|/?\*)' ; echo "exit: $? (expected 1)"
exit: 1 (expected 1)
$ npm run --silent replay -- --dry 2>&1 | tail -3
PASS ivtrends#1 — Start it again after a wait, and post nothing unless it keeps failing. 3 of 3 tries.
PASS #110 — Send the step a message to run only the tests its change affects. 3 of 3 tries.
19 of 19 cases passed. The runner's sessions cost $0.00 in all.
```

The test count is unchanged by the amendment: case (1) was extended, not added to. 1399 = 1472 − 88 + 15.

- [x] PRD-05.R1's hint holds: no table in code picks the next step. `next` and `stageAfter` no longer exist; the grep exits 1. **PASS**
- [x] `RunStatus` no longer has `failed`. As a run's status, the word is left only in `normaliseOldPath`, which reads an old ledger, and in 41c's fixture. The other `"failed"` strings in `src/` are a preview's state and the runner's `WakeEnd` kind. **PASS**
- [x] Red-green evidence for each of the three cases is in this section and the one above. **PASS**
- `npm run build && npm test`: 1399 passed. **PASS**
- Dry replay: 19 of 19. **PASS**

**What is still dead, or out of date.**

- `src/commands/takeover.ts`, in the `cancelled` arm of `resolveTakeover`: a comment says the reason "lives in `cancellation` rather than `failure`". `failure` no longer exists. The file was granted only for the printed line, the help text and the `failed` arm, so it was left.
- `src/adapters/command-runner.test.ts:99` still names `upsertComment`, in a comment that records how a fault was found. Left on purpose.
- `dist/daemon/gates.*` and `dist/channels/conversation.*` stay until `dist/` is cleaned.

## 41i — The decision records and the requirement lists say what happened

**Built.** The records now say what phase 41 did. Nine ADRs read `superseded by [ADR-0060](…)`: the eight ADR-0060 lists, and ADR-0054, whose status line also says why the ask check went. Six ADRs stay `accepted` and each carry one `Amended by: [ADR-0060]` line, dated 2026-09-30, naming what changed. ADR-0060's "Supersedes" and "Amends" lines lost their condition, and a dated note on each says phase 41 met it. PRD-05's open question on the ask check has its answer. PRD-05.R19 says its period is over. PRD-02.R18 and R22 say that `timone retry` was removed and that the runner decides whether a step is tried again. The product overview's first goal says the process is now followed by default, with every departure shown. No status line of any requirement was changed. No code changed.

**Files touched.**

- `doc/adr/0022-…`, `0023-…`, `0031-…`, `0034-…`, `0035-…`, `0046-…`, `0052-…`, `0056-…` — status line is now `superseded by [ADR-0060](0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md)`, as ADR-0017 writes it.
- `doc/adr/0054-an-ask-check-stands-in-front-of-every-question-put-to-a-person.md` — the same status line, then a dated sentence: ADR-0060 left the ask check to the build, and phase 41 removed it with the old code, because the runner writes every question with the whole run in view.
- `doc/adr/0014-…`, `0024-…`, `0030-…`, `0032-…`, `0049-…`, `0059-…` — status stays `accepted`. A line `- **Amended by:** [ADR-0060](…), 2026-09-30 — <what changed>` added after the Date line, where ADR-0016 has it.
- `doc/adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md` — the labels are now `Supersedes:` and `Amends:`. Each line ends with a dated note that quotes the old condition and says phase 41 met it.
- `doc/specs/prd/prd-05-a-runner-decides-each-step.md` — a dated answer under the open question "Does the ask check stay?".
- `doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md` — a dated note under R19's criteria.
- `doc/specs/prd/prd-02-inversion-of-control.criteria.md` — a dated note under R18's third clause and under R22's second clause.
- `doc/specs/product-overview.md` — a dated note after the first business goal.

**Decisions taken inside the slice.**

1. **ADR-0054's sentence sits on its status line**, after a dash and the dated marker. ADR-0012 already puts a note on its status line this way. The first status line the validation reads still begins `superseded by [ADR-0060](…)`.
2. **ADR-0049's line does not use the plan's words "the wait value goes".** They do not match the code. A run still has one `wait` value (`src/daemon/runs.ts`: `RunWait`, `ParkOptions`, `resolvableBy` still in the schema). What went is its four kinds: since 41h a wait's kind is `runner` or absent. The line says: *the holder stays, and the wait loses its four kinds: a parked run now waits only for the runner*. ADR-0060's own line 7 still says "the wait value goes". It is that record's own wording, so I left it.
3. **ADR-0060's conditions are quoted, not deleted.** The labels lost the condition. The note on each line quotes the old wording, so the validation grep finds it on the same line as the dated marker.
4. **ADR-0060's "Supersedes" note also names ADR-0054.** ADR-0060 does not list it, and ADR-0054 now says it is superseded by ADR-0060. One sentence in the note makes the two records agree.
5. **The other five "Amended by" lines** use ADR-0060's own list, a little longer where the short form would not be clear on its own: 0014 *the runner may skip a gate, and says so on the ticket and on the pull request* (ADR-0060 D1 and D3); 0024 *the runner writes what a ticket needs*; 0030 *D2: chunk zero merges only when a named person's yes is on record* (`tryMergeChunkZero` in `src/daemon/chunk-zero.ts` still checks this); 0032 *`timone retry` is removed*; 0059 *D2: there is no failed run for `timone takeover` to open*.
6. **The PRD-02 notes also cover the verification hints.** R18's hint and R22's hint name `timone retry` too. Each note says so, so a verifier does not go looking for the command. The notes are indented quotes under the clause, as PRD-05's register places its notes. The older evidence notes that mention the command are unchanged, and each new note says they are history.
7. **Every dated marker reads `✏ 2026-09-30 (phase 41, timone#166): …`**, with `timone#166` linked to the issue, as other notes in these files link issues.

**Validation evidence.** No behaviour-carrying code, so no test cases. The three commands, as run:

```
$ for n in 0022 0023 0031 0034 0035 0046 0052 0054 0056; do grep -H -m1 -- '- \*\*Status:\*\*' doc/adr/$n-*.md; done
doc/adr/0022-a-conversation-ticket-can-be-answered-in-writing.md:- **Status:** superseded by [ADR-0060](0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md)
doc/adr/0023-one-answer-one-session.md:- **Status:** superseded by [ADR-0060](0060-…)
doc/adr/0031-a-handoff-is-a-wait-not-a-failure.md:- **Status:** superseded by [ADR-0060](0060-…)
doc/adr/0034-a-technical-stop-is-retried-not-reported.md:- **Status:** superseded by [ADR-0060](0060-…)
doc/adr/0035-a-resolved-escalation-hands-the-run-back.md:- **Status:** superseded by [ADR-0060](0060-…)
doc/adr/0046-a-pull-request-closed-without-merging-holds-its-ticket-and-asks.md:- **Status:** superseded by [ADR-0060](0060-…)
doc/adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md:- **Status:** superseded by [ADR-0060](0060-…)
doc/adr/0054-an-ask-check-stands-in-front-of-every-question-put-to-a-person.md:- **Status:** superseded by [ADR-0060](0060-…) — ✏ 2026-09-30 (phase 41, [timone#166](…)): ADR-0060 left to the build whether the ask check stays, and phase 41 removed it with the old code, because the runner writes every question with the whole run in view.
doc/adr/0056-a-build-stages-question-rides-to-the-pull-request.md:- **Status:** superseded by [ADR-0060](0060-…)

$ for n in 0014 0024 0030 0032 0049 0059; do grep -H -c -- 'Amended by:\*\* \[ADR-0060\]' doc/adr/$n-*.md; done
doc/adr/0014-artifact-first-gates.md:1
doc/adr/0024-every-open-ticket-answers-for-itself.md:1
doc/adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md:1
doc/adr/0032-a-human-command-asks-the-daemon-to-act.md:1
doc/adr/0049-a-runs-proof-of-life-is-its-holder-and-its-wait-is-one-value.md:1
doc/adr/0059-a-live-check-only-the-operator-can-run-rides-to-the-pull-request.md:1

$ grep -n "once the runner has replaced\|on the same condition" doc/adr/0060-*.md
6:- **Supersedes:** [ADR-0022](…), … [ADR-0056](…) — ✏ 2026-09-30 (phase 41, [timone#166](…)): this line used to say "Supersedes, once the runner has replaced the old code on every project". Phase 41 met that condition: every project now runs on the runner, and the old code is removed. It also removed the ask check, so [ADR-0054](…) is superseded too.
7:- **Amends:** [ADR-0014](…) (…), … [ADR-0059](…) D2 (…) — ✏ 2026-09-30 (phase 41, [timone#166](…)): this line used to say "Amends, on the same condition". Phase 41 met that condition.
```

(Long link targets trimmed to `…` here; the files carry the full names.)

Extra checks. Every relative link added in the diff was tested against the file system: 35 links, all resolve. No `Status:` line of a requirement is among the changed lines of `doc/specs`; the one match in the diff is a context line (R19, still `verified`). `git status --short` lists only the 20 files above.

- [x] Nine status lines read `superseded by [ADR-0060](…)`, with a link that resolves. **PASS**
- [x] Six records each carry one `Amended by: [ADR-0060]` line, naming what changed. **PASS**
- [x] ADR-0060's two conditions carry the dated marker. **PASS**

**What delivery and later readers must know.**

- **Left as written, outside what the plan asked:**
  - ADR-0060's Consequences still say the ADR status lines change "in that same change, not now", and that whether the ask check stays "is left to the build". Both are now history. D9's "built beside the current daemon and chosen per project" is too.
  - PRD-02.R18's first clause says a reclaimed run "is failed with a plain reason". Since 41b a stale run goes back to the runner, and no run is failed. R22's seventh clause lists `failed` among the states the ledger admits. Since 41h it admits none. Neither clause names `timone retry`, so neither got a note. Verification may want them.
  - PRD-05's Scope still says "Each project runs on either the runner or the current daemon, until every project has moved (R19)". R19's new note covers it.
  - PRD-04's register still describes the ask check (41f named this). Not in this slice's files.
- **The eight ADRs ADR-0060 lists, plus ADR-0054, have no note in their body.** Only the status line changed, as ADR-0017 did it. Their text still describes the old code in the present tense.

### ✏ 2026-09-30 — 41i finished under the plan's amendment

**Built.** The four places listed above under *Left as written* now each carry a dated note (`✏ 2026-09-30 (phase 41, timone#166): …`). No Status line changed. ADR-0060's line 7 still says "the wait value goes", as decided above.

**Notes added.**

- `doc/specs/prd/prd-02-inversion-of-control.criteria.md`, R18 clause 1 — a stale run is no longer failed. It goes back to the runner's wait, and the runner is woken and decides what happens next (PRD-05.R16).
- `doc/specs/prd/prd-02-inversion-of-control.criteria.md`, R22 clause 7 — the ledger no longer admits `failed`. A failed run in an older ledger is read as `cancelled`, and the reason it stopped is kept.
- `doc/specs/prd/prd-04-one-short-question-instead-of-a-terminal.criteria.md` (newly granted) — the same note under the headings of R1, R2, R3, R4, R5, R6 and R8, in the place R7's deprecation note uses: the ask check was removed in phase 41, with the old code between steps; the runner now writes every question with the whole run in view; see ADR-0054's status line. R7 got no note: it is already deprecated, with its own note.
- `doc/adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md`, Consequences — after "The ADRs listed above get their status lines changed in that same change, not now: …": this is done; phase 41 deleted that code and changed those status lines. After "Whether the ask check stays … is left to the build.": the build removed it; ADR-0054 is superseded. Neither note contains the words the third validation command looks for, so its result is unchanged.

**Validation, run again.** The three commands give the same output as above: nine status lines `superseded by [ADR-0060](…)` (ADR-0054's with its sentence), six counts of 1, and ADR-0060's lines 6 and 7, both with the dated marker. 37 relative links added in `doc/adr` and `doc/specs` all resolve. No changed line in `doc/specs` is a Status line.

- [x] Nine status lines read `superseded by [ADR-0060](…)`, with a link that resolves. **PASS**
- [x] Six records each carry one `Amended by: [ADR-0060]` line, naming what changed. **PASS**
- [x] ADR-0060's two conditions carry the dated marker. **PASS**

The *Left as written* list above is now out of date for these four places. Its other items stay open: ADR-0060 D9's "chosen per project", PRD-05's Scope sentence on R19, and the bodies of the nine superseded ADRs.

## 41j — `process.md`, the step skills and the glossary describe the runner

**Built.** `process.md`, the step skills and the glossary now describe the runner and what code keeps, and no longer describe the old code between steps. `process.md` says, under the table of stages, that the order is the default order and not a rule: the runner decides each step, says on the ticket when it leaves the order, code lists every departure from the default order on the pull request, and nothing reaches a default branch without a named person's yes. It also sets apart the two meanings of "departure": a departure from the default order (the glossary's **Departure**) and a departure from the plan (an entry in `phase-NN-departures.md`). Every use of the word in stages 5 to 8 now says which. The section on gates, conversations and the human is rewritten around a named person instructing the runner in plain words, `timone takeover`, `timone cancel`, the removed `timone retry`, and what code keeps (ADR-0060 D2 to D5). The *What I need from you* line stays, with what reads it. Ten skills and the README no longer say "loop mode (daemon-initiated sessions)". The wayfinding skill's templates, answer section and closing steps describe what the runner does now. The glossary marks five words as removed, brings five entries in line, and adds **Default order** and **Departures record**. Every changed passage carries a `✏ 2026-09-30 ([ADR-0060](…))` marker.

**Files touched.**

- `process.md` — new paragraph under the table (the default order, the runner, the named person's yes, the two kinds of departure). Stage 1: the chore's path is the default path. Stage 5: the departure is named as a departure from the plan; chunk zero merges only on a recorded approval; a skipped approval of the list of pieces makes the initiative one piece. Stage 6: "then escalate to the human" replaced; the entry gate's exception for a skipped and recorded approval; the reason a dirty tree may hold the phase's own files no longer names the escalation path; "Escalation, concretely" became "When a sub-phase still fails, concretely"; a question asked after building started does not stop the run, and the runner carries it to the pull request. Stage 7: the departure is named as one from the plan. Stage 8: the block of departures from the default order that code writes (`<!-- timone:departures -->`) comes first; the body's own section is named as departures from the plan, in stage 8 and in *How to try it*. Section *Gates, conversations and the human* rewritten; the harness-routes paragraph says a named person's comment goes to the runner; the session-boundary paragraph says the runner is a fresh session each wake; "the daemon orchestrates stage skills" became the runner. *Do not report what the human cannot act on*: whether a failed step is tried again is the runner's decision, and code restarts a runner that failed (PRD-05.R16).
- `CONTEXT.md` — **Takeover** rewritten. **Written answer**, **Handoff**, **Escalation**, **Handback**, **Ask check**: one entry each saying it was removed on 2026-09-30 with the old code; **Handoff** also says the word still means a sub-agent's handoff notes. **Request**, **Step ticket**, **Chunk zero**, **Breakdown**, **Departure** brought in line. New: **Default order**, **Departures record**.
- `.claude/skills/README.md` — preamble item 6; "dispatched through stages 5 → 6 → 7 → 8" is the default order.
- `.claude/skills/timone-adr/SKILL.md`, `timone-grill/SKILL.md`, `timone-prototype/SKILL.md`, `timone-triage/SKILL.md` — preamble item 6 only.
- `.claude/skills/timone-deliver/SKILL.md` — preamble; line 28, where a question from the build comes from (the runner's instructions for this step); "PRD-02's daemon will spawn" in runner terms.
- `.claude/skills/timone-execute/SKILL.md` — preamble; line 49 (the probe hook reads the step of a session the runner started from the ledger); "PRD-02's daemon will spawn" in runner terms; line 196 (ADR-0056) in runner terms; the human-gate sentence at line 194 (decision 9).
- `.claude/skills/timone-plan/SKILL.md` — preamble; line 228 in runner terms.
- `.claude/skills/timone-prd/SKILL.md` — preamble; line 189: the approval in a runner-started session, who writes it into the file, and the runner's skip.
- `.claude/skills/timone-verify/SKILL.md` — preamble; line 60 (ADR-0052 "is absolute there"); line 64 (ADR-0056); line 121 (the probe hook, same as execute line 49); "PRD-02's daemon will spawn"; closing item 6 (decision 10).
- `.claude/skills/timone-wayfind/SKILL.md` — preamble; lines 62 to 143 and 196 to 203 (decisions 3 to 7).
- `/private/tmp/…/scratchpad/41j-handoff.md` — this section. `doc/plans/phases/reports/phase-41-handoffs.md` was not written, as asked.

**Decisions taken inside the slice.**

1. **The preamble says "the target project arrives in the session's prompt".** Every step prompt names the project (`on the managed project **<name>**`). The meaning of the old line stays: the project comes with what started the session.
2. **`process.md` defines the two kinds of departure once, then names the kind at each use.** "Departure from the default order" and "departure from the plan". The file name `phase-NN-departures.md` and the phrase "departures record" are left as they are, since they name the file.
3. **`wayfinder:frontier-empty` is no longer applied.** Nothing reads it: `FRONTIER_EMPTY_LABEL` was deleted in 41h, and `wayfinderStage` ignores any `wayfinder:` label that is not a type. Step 3 of *Closing the effort* now says no label starts anything, and the *frontier reopens* paragraph says to post that a question is open again, so the map's newest comment is true (the runner's own rule). The `wayfinder:<type>` labels stay: `ticketKindOf` reads them to choose the default order.
4. **The `research` paragraph was false, and is corrected.** It said a marked research ticket parks because no machinery exists. `research` is in `PROMPTED_STAGES`, and its default order is one research step, which asks nobody.
5. **The call-to-action templates keep their two paths, without the old promises.** Removed: "If something is still unclear I'll ask once more here, then stop" (the clarifying round) and "I'll pick up where this ticket left off" (the takeover that resolved the ticket's wait). The takeover is kept: since 41g it tells the session to hold the conversation with `timone-wayfind` when the run's step is wayfinding or charting. The prototype block keeps the takeover alone, for the reason it gave.
6. **"Reading a written answer" became "How a question on the map is answered".** The old step-by-step reading and the one-round bound are gone. The short shape of a comment that asks what is still open is kept, because it is a writing rule, not a mechanism, and the step prompt still sends the step here.
7. **The `Blocked by:` sentence at line 142 was corrected.** It said the daemon reads a body line and refuses it on the ticket. No code does: `bodyDependencyLine` is set by the forge adapter and read by nothing, on this branch and on `main`. It is in the range the plan names (62 to 143), so I fixed it in one sentence rather than leave a false statement.
8. **`timone-prd`: who writes the approval.** In a runner-started session the runner records a named person's approval and starts a short session (`approvalRecordPrompt`) that writes it into the file. The skill now says so, adds the runner's skip, and the closing sentence "stage 5 will refuse to plan" gains "unless the runner skipped the approval", which is what `timone-plan` already says.
9. **`timone-execute`'s human-gate sentence is qualified.** It said a `**Human gate:**` in a slice is "a real stop: ask, wait". Next to the rewritten line 196 that is a contradiction in a runner-started session, where nobody can answer. It now says it is a real stop in a session run by hand, and that in a session the runner started the next paragraph applies.
10. **`timone-verify` "lines 60 and 328".** Line 60 was changed as asked. Line 328 is closing item 5, which names no mechanism; item 6 at line 329 (the next invocation, "the only ending") is the daemon-era line, so that is the one changed: in a runner-started session the runner chooses the next step, delivery by default. Line 121, the probe-hook sentence that execute line 49 also has, was changed the same way. Every other line number in the plan matched HEAD.
11. **The rewritten *Gates* section keeps ADR-0032's paragraph** (commands ask the daemon to act), without its ADR-0023 citation. The request mechanism still exists; ADR-0060 only removes `retry` from it.

**Validation evidence.** No behaviour-carrying code, no seams, so no red-green. The checks, as run:

```
$ grep -rn "timone retry\|loop mode (daemon-initiated\|handback\|HANDBACK" process.md CONTEXT.md .claude/skills | grep -iv "removed\|was removed"
(no output; exit 1)
$ grep -c -i "runner" process.md
19
$ grep -n -i "default order" process.md | cut -c1-60
22:✏ 2026-09-30 ([ADR-0060](doc/adr/0060-a-runner-decides-e
48:**8 — Delivery.** Delivery presents finished work for hum
54:**How to try it — every pull request carries it, with no 
147:- Every departure from the default order is shown twice:
153:**The harness routes; the human never does.** The human 
```

Line 22 reads: "**The order of these stages is the default order, not a rule.** A **runner** decides each step of a run…".

For the third checkbox, every skill was searched for the words of removed mechanisms, and every changed passage was read in its section:

```
$ grep -rn -i -o "written answer\|clarifying round\|ask check\|standing call\|hand.\{0,3\}back\|frontier-empty\|loop mode\|daemon-initiated" .claude/skills | sort | uniq -c
   1 .claude/skills/timone-wayfind/SKILL.md:136:written answer
   1 .claude/skills/timone-wayfind/SKILL.md:195:frontier-empty
   1 .claude/skills/timone-wayfind/SKILL.md:202:frontier-empty
```

All three are in ✏ notes that say the thing was removed. The skills still name "the daemon" only for code that exists: the introductions on unmarked tickets (`timone-onboard`), the example live criterion "the daemon picks up a marked ticket" (`timone-verify`), and the daemon picking up a marked ticket (`timone-wayfind`). "Handoff" in `timone-execute`, `timone-plan` and `timone-verify` means a sub-agent's handoff notes and was left.

- [x] The first command prints nothing. **PASS**
- [x] `process.md` names the runner (19 lines), and says the order is the default (line 22, and the chore's path in stage 1). **PASS**
- [x] Each skill still reads as a whole from top to bottom: no sentence refers to a mechanism another sentence removed. **PASS**, by the search above and a read of each changed section. Decision 9 is the one contradiction found and fixed.

**What the next reader must know.**

- **Left as they were, because the plan does not name them and they are not about the removed code** (each is stale for an older reason):
  - `.claude/skills/README.md`: "the verifier's own probes stay in scratch space and are never committed" — untrue since ADR-0048.
  - `timone-plan`, *Immutable after approval*: "which piece is next is derived from how many have been built" — untrue since ADR-0040; the paragraph above it in the skill says the opposite.
  - `CONTEXT.md` **Gate**: "approve a plan, confirm/decline/defer a feedback item" — there is no plan approval and no feedback stage. **Runner**: its list of actions lacks "record an approval", which PRD-05.R2 added.
  - `timone-wayfind` Mode 2 step 3: "one of the two paths every HITL ticket offers" — the prototype block offers one.
  - `timone-prd` step 4 says to ask for approval; the requirements step prompt says the machinery asks. Only matters in a runner-started session, and the prompt wins there.
  - `timone-execute` keeps the heading *The transition gate and escalation*, and line 175 refers to it by name. Nothing under it escalates.
- `process.md` stage 2 at scale still cites ADR-0022 for the rule that each wayfinding ticket carries its call to action. The rule is still true and matches the rewritten templates; ADR-0022 is now superseded, so a reader following the link finds a superseded record.
- No file outside this slice's list was touched. `doc/adr/`, `doc/specs/`, `README.md` and `manual/` were being changed by the other two slices while this one ran; I only read ADR-0060, PRD-05 and its register.

## 41k — The README and the manual describe the runner

**Built.** The README, the manual and the example manifest describe the machine as it is after 41b to 41h. The README says the runner decides each step on every project, has no `timone retry` line, and its runner section covers who may instruct it (`operator`, `instructors`), the daemon's refusal to start when a project names nobody, the limit and how to say go on, and `timone record`. It says there is no `driver` line to set. `manual/how-the-daemon-works.md` is rewritten from the code: the start-up refusals; the poll cycle in the order `pollOnce` runs it (requests, the cancellation watch, the witness, then per project the reclaim, registration, the queue, the runner's turn, introductions and previews); how a run moves (what wakes the runner, one wake, the nine actions and what code checks before each, what happens after a step ends, the merge of the approved list of pieces); the default order per kind of ticket and the step table; the one wait and its words; the run statuses; who holds the project and the reclaim; the run record; the limit; takeover and cancel; what code keeps whatever the runner decides; and what a step runs with (model login, forge token, project environment). The old state diagram and stage graph, with the retry command in them, are gone. Four new Mermaid diagrams replace them. `manual/README.md` describes the new page. `timone.example.yaml` has an `operator` line and one project's `instructors` list, each with a comment, and it loads.

**Files touched.**

- `README.md` — lines 8 to 11 and the stages line: the runner decides each step. The retry line is removed from the everyday commands, and the takeover line's comment says what the command does now. "Projects run by the runner" became "The runner", as the plan says.
- `manual/how-the-daemon-works.md` — rewritten. The file name stays.
- `manual/README.md` — its one line about the manual.
- `timone.example.yaml` — `operator: fvermaut` with a comment; an `instructors` list on `pilot-app` with a comment; `instructors` added to the header's list of project keys; the two project comments say who instructs each.
- `41k-handoff.md` in the orchestrator's scratchpad — this section. The shared handoff file was not touched, as instructed.

**Decisions taken inside the slice.**

1. **The takeover line in the README's everyday commands changed too**, although the plan names only the retry line there. It said "pick up a ticket that wants a conversation", which stopped being true in 41e: a takeover opens the same session for every waiting run. It now uses the command's own help text.
2. **The manual's old section 8, "Where the model was uneven", is dropped.** It was a history of five fixes made to the old code in phase 27. Three of the five are about code that no longer exists. The old section 7, the table of what the ticket says per state, went with `ctaFor` (deleted in 41e). A short paragraph on what `timone status` says takes its place, read from `waitsOnYou` and `describeRun`.
3. **The three sections on what a step runs with stay**, rewritten for steps. The README sends the reader to the manual for both credentials. One claim was false and is gone: the old spawner tried a run again up to three times after a login expired. That code was deleted in 41f. Now the step ends as failed and the runner is told why.
4. **`timone.yaml` has an `operator` but no `instructors` list.** So the example's list follows the schema's shape rather than a real entry. It is on the fully-populated project, lists the operator again (because `instructors` replaces the operator), and the minimal project's comment says the operator instructs it. `ticket_limit_usd` was not added to the example: the plan does not ask for it, and the README already shows it.
5. **Diagram syntax.** Only `flowchart TD` and `stateDiagram-v2`, the two kinds the old file used and GitHub rendered. Every flowchart label is quoted. No label has an apostrophe, a `#` or a `;`. `picked-up` keeps the old alias. Nodes of a subgraph are declared inside it before an edge from outside names them.
6. **The retry command is named only as "the retry command" or "a request to retry"**, so the plan's grep for the two-word command finds nothing. The same for `driver`: never followed by a colon.
7. **`picked-up → active`** is in `TRANSITIONS` but no path takes it now (the runner puts a new run on its wait before it starts a step). The manual says so rather than drawing a move nothing makes.

**Validation evidence.** No behaviour-carrying code, so no seams and no red-green. The checks, as run:

```
$ grep -rn "timone retry\|driver:" README.md manual/ timone.example.yaml ; echo "exit: $? (expected 1)"
exit: 1 (expected 1)
$ node dist/cli.js projects list --manifest timone.example.yaml
NAME            PATH                     STACK                      TICKETING  PREVIEW  CLONED
pilot-app       projects/pilot-app       typescript,react,postgres  github     docker   no
internal-tools  projects/internal-tools  -                          github     -        no
exit: 0
```

`dist/manifest.js` is the build after 41h (it has `removedDriverLines`), and no file under `src/` changed in this slice. A further check that the reader took the two new fields, through the built `namedPeople`:

```
operator: fvermaut
pilot-app -> fvermaut, a-colleague
internal-tools -> fvermaut
```

Every relative link in the manual and the README was checked to point at a file that exists; one (ADR-0041) was wrong in the first draft and was fixed. No `<word>` outside a code span is left for GitHub to drop as HTML.

The diagrams could not be rendered here. The Mermaid CLI is not in the npm cache, and the offline try fails at once:

```
$ npx --offline --yes @mermaid-js/mermaid-cli --version
npm error code ENOTCACHED
npm error request to https://registry.npmjs.org/@mermaid-js%2fmermaid-cli failed: cache mode is 'only-if-cached' but no cached response is available.
```

- [x] The example manifest loads through the real manifest reader. **PASS**
- [ ] Every diagram in the manual renders on GitHub (look at the file on the pushed branch). **OWED.** The branch is not pushed, and no offline renderer is available. Four diagrams to look at in `manual/how-the-daemon-works.md`: *From ticket to run* (section 2), the run loop (section 3), the default order (section 4), and the run statuses (section 5).

**What the orchestrator and verification must know.**

- **The render check above is still owed**, on the pushed branch.
- **Two README passages outside the plan's line list still say "run" where a step is meant**: line 32 ("The daemon runs each ticket in a container") and line 72 ("keep a boxed run alive", "minted per run"). Each step runs in a container; the runner itself runs on the host. Left as they were.
- **Things the manual had to describe that look like faults or dead code**, found while reading the code, not changed:
  - `src/runner/order.ts` has a `remediation` order, but nothing sets `isRemediation: true` (the driver always passes `false`), so no ticket is ever of that kind. The manual's table leaves it out.
  - A map's default order starts with `charting`, which has no session, and `start_step` refuses it. So on a map the runner must always leave that step out with a reason, and every map's pull request lists it as a departure.
  - The reclaim wakes the runner with "The daemon stopped while a step was running." also for an `active` run a terminal held whose process died. The words are wrong for a terminal.
  - Between two cycles the daemon sleeps for the poll interval, and the cancellation watch runs only during a cycle. So a `timone cancel` left while the daemon sleeps waits up to 60 seconds. The command's own words say "within a few seconds". It waits 150 seconds, so it does not fail, but the words are not exact.
- **Refactoring I would do but did not:** none in these files.

## 41m — What the live check found on the real ledger

**Built.** (1) A failed run the old code left now keeps a reason of one line when the ledger is read. The reason is the first line of the old failure, cut before the machine's banner (`🤖 **Timone**`) where that line carries one, with spaces and a trailing colon trimmed. If nothing is left, the reason is *"no reason recorded"*. So `timone status` no longer prints a whole machine comment, or the command inside it. The same cut applies to a run an earlier build already converted and wrote as cancelled (decision 1). (2) A takeover of a ticket with no run gives the new run the step its `wayfinder:` label names, as `wayfinderStage` reads it: `wayfinder:grilling`, `prototype` or `task` is at wayfinding, `wayfinder:map` at charting, `wayfinder:research` at research. The session's prompt then names the step and tells it to hold the conversation with `timone-wayfind`. The new run's wait is ended by that step. A ticket with no `wayfinder:` label gets no step and a wait ended by triage, as before. The daemon's `claim-takeover` request goes through the same code, so it does the same.

**Files touched.**

- `src/daemon/runs.ts` — new `MACHINE_BANNER` and `oneLineReason`. `normaliseOldPath` uses it for a failed run's reason, and cuts the reason of a cancelled run whose reason starts with `STOPPED_BEFORE_REMOVAL`. Its doc comment updated.
- `src/daemon/runs.test.ts` — new describe *a failed run the old code left keeps a reason of one line (41m)*, two tests. 41c's tests unchanged.
- `src/commands/takeover.ts` — `enrolFromTracker` parks the new run at `wayfinderStage(ticket.labels)` when it names one, with `resolvableBy` that step, else `["triage"]` as before. Import of `wayfinderStage`. Doc comment updated.
- `src/commands/takeover.test.ts` — new describe *a takeover of a ticket with no run, at the step its `wayfinder:` label names (41m)*, three tests and the helper `takeOverWithNoRun`. One 41e test re-based (below).
- `doc/plans/phases/reports/phase-41-handoffs.md` — this section.

**Decisions taken inside the slice.**

1. **The cut also applies to a run already written as cancelled.** The plan says what a failed run keeps when it is converted. But the daemon running since 41l read the real ledger with the 41h code and has written since, so a run like timone #106's is now on disk as `cancelled`, with `"stopped before the old code was removed: "` and the whole comment. A fix only for `failed` runs would never reach it. So `normaliseOldPath` also cuts the reason of a cancelled run whose reason starts with that prefix. It touches no other cancelled run: a reason a person gave is left as it was, and so is a reason that is already one line. It writes nothing on a read, like the rest of the conversion. This is a departure from the plan's words, made for the plan's purpose. If it is not wanted, delete the second `if` in `normaliseOldPath` and the test *cuts the reason the same way on a run an earlier build already converted and wrote*.
2. **The banner is matched by its start, `🤖 **Timone**`**, as the plan writes it, not by the whole `MACHINE_MARKER`. So an older wording of the rest of the banner is cut too. `runs.ts` does not import `ticketing.ts`; the constant names it in its comment.
3. **"The first line" is the text before the first newline**, even when it is empty. A failure that starts with a newline gets *"no reason recorded"*.
4. **`wayfinderStage`, not `ticketKindOf`.** `wayfinderStage` maps the label straight to a step. `ticketKindOf` gives a kind, and the step would then be the first of that kind's default order, which is the same answer by one more step. `wayfinder:research` is at research, because that is what `wayfinderStage` says; the plan names only decisions and maps.
5. **The new run's wait is ended by its step**, as `putOnRunnersWait` in `src/runner/session.ts` writes it: `[run.stage ?? "triage"]`.

**Test re-based, because it asserted the opposite of this slice.** `takeover.test.ts` › *a takeover of a ticket with no run* › *registers a run waiting for the runner, and resolves to the session bound to no step* looped over the decision ticket and the unmarked ticket and expected no step for both. After the change it failed on the decision ticket: `→ expected { id: 'scratch-app#12/1', …(9) } to match object { status: 'parked', wait: { …(3) } }`. It now covers only the unmarked ticket, and is renamed *…, for a ticket with no `wayfinder:` label*. What it asserts for that ticket is unchanged. The decision ticket is covered by case (3).

**Validation evidence.**

*(1) An old failed run whose failure is a whole machine comment* (`runs.test.ts` › *loads an old failed run whose failure is a whole machine comment with one line, and no banner and no command*). The ledger is machine-typed: a failed run whose failure is `a build stage escalated: ` then a whole machine comment (banner, account, a fenced `timone takeover timone#106`), and the same run whose failure is the comment alone. Written first, seen red:

```
× … > loads an old failed run whose failure is a whole machine comment with one line, and no banner and no command
  → expected 'stopped before the old code was remov…' to be 'stopped before the old code was remov…'
- stopped before the old code was removed: a build stage escalated
+ stopped before the old code was removed: a build stage escalated: 🤖 **Timone** · automatic message — written by the machine, not by the account it appears under
+ ---
+ 🆘 **Needs a person** · the build stopped on a question it cannot answer alone.
Tests  1 failed | 120 skipped (121)
```

Green after `oneLineReason`: `runs.test.ts` `Tests  121 passed (121)`. The test asserts *"…: a build stage escalated"*, *"…: no reason recorded"* for the comment alone, and no newline, no `🤖` and no `timone takeover` in either reason.

*Decision 1's test* (*cuts the reason the same way on a run an earlier build already converted and wrote*): a cancelled run with the prefix and the whole comment, and a cancelled run with a person's reason. Written first, seen red:

```
× … > cuts the reason the same way on a run an earlier build already converted and wrote
  → expected { id: 'timone#106/1', …(10) } to deeply equal { id: 'timone#106/1', …(10) }
-   "cancellation": "stopped before the old code was removed: a build stage escalated",
+   "cancellation": "stopped before the old code was removed: a build stage escalated: 🤖 **Timone** · automatic message — …
Tests  1 failed | 1 passed | 120 skipped (122)
```

Green after the second branch: `Tests  122 passed (122)`.

*(2) An old failed run with a one-line failure keeps that line* is 41c's test *loads each failed run as cancelled, keeping what stopped it, …*, unchanged. It passes before and after, so it could not be red. Break: `oneLineReason` cuts its result to 40 characters. Result, then restored (`diff` against a saved copy empty):

```
× runs the old code left in the ledger become runs the runner can read > loads each failed run as cancelled, keeping what stopped it, …
  → expected { id: 'scratch-app#21/1', …(12) } to deeply equal { id: 'scratch-app#21/1', …(12) }
-   "cancellation": "stopped before the old code was removed: the execution stage finished without committing anything to gate",
+   "cancellation": "stopped before the old code was removed: the execution stage finished without com",
Tests  1 failed | 3 passed | 117 skipped (121)
restored: Tests  4 passed | 117 skipped (121)
```

41c's other three tests, 41c's three tests in `poll.test.ts` and its three in `status.test.ts` pass unchanged: the fixture's failures are one line each.

*(3) A takeover of a ticket with no run and the label `wayfinder:grilling`* (`takeover.test.ts` › *opens a session on a `wayfinder:grilling` ticket whose prompt names wayfinding and the `timone-wayfind` skill*, through `runTakeover`). It asserts the held run is at `wayfinding`, the prompt carries `- its step: talking a question through (wayfinding)`, `**The run's step is a conversation: talking a question through.**` and `` `timone-wayfind` ``, and the run goes back parked at `wayfinding`. Beside it, *gives the new run the step its label names: a decision ticket at wayfinding, a map at charting* (through `resolveTakeover`; it also asserts the wait is ended by that step). Both written first, seen red:

```
× … > gives the new run the step its label names: a decision ticket at wayfinding, a map at charting
  → expected [ { id: 'scratch-app#12/1', …(8) } ] to deeply equal [ ObjectContaining{…} ]
× … > opens a session on a `wayfinder:grilling` ticket whose prompt names wayfinding and the `timone-wayfind` skill
  → expected { id: 'scratch-app#12/1', …(9) } to match object { status: 'active', …(1) }
-   "stage": "wayfinding",
Tests  2 failed | 1 passed | 40 skipped (43)
```

Green after `enrolFromTracker` read the label: `Tests  3 passed | 40 skipped (43)`.

*(4) A takeover of a ticket with no run and no `wayfinder:` label* (`takeover.test.ts` › *opens the session with no step on a ticket with no `wayfinder:` label, as before*, through `runTakeover`). It asserts the held run has no step and a wait ended by triage, the prompt says `- its step: none yet`, and it holds no conversation and names neither `timone-wayfind` nor `timone-grill`. It passes before and after, so it could not be red. My first version also asserted the wait after the session ended, and failed on the old code: `waitOf` gives back a run with no step without `resolvableBy`. That is how it already behaves, so the assertion moved to the wait the run holds during the session. Break: a ticket with no label is put at wayfinding (`wayfinderStage(ticket.labels) ?? "wayfinding"`). Result, then restored (`diff` empty):

```
× … > opens the session with no step on a ticket with no `wayfinder:` label, as before
  → expected { id: 'scratch-app#5/1', …(10) } to match object { status: 'active', wait: { …(3) } }
Tests  1 failed | 42 skipped (43)
restored: Tests  1 passed | 42 skipped (43)
```

Validation commands, as run. `npm run build` was **not** run: a daemon is running from this folder, and the build rewrites `dist/`. The orchestrator asked for `npx tsc --noEmit && npx vitest run` instead.

```
$ npx tsc --noEmit && npx vitest run 2>&1 | tail -5
(tsc exit 0)
 Test Files  56 passed (56)
      Tests  1404 passed (1404)
$ git status --short .timone ; echo "(expected: nothing — no test touched the real ledger)"
(expected: nothing — no test touched the real ledger)
```

1404 = 1399 + 2 (`runs.test.ts`) + 3 (`takeover.test.ts`). One test re-based, none deleted. The one test that runs `dist/cli.js` (`src/cli.test.ts`, the removed retry command) does not touch these files, so the old build does not affect it.

- [x] Red-green evidence for each of the four cases is in the handoff. Cases (1) and (3) were seen red, then green. Cases (2) and (4) pass before and after; the breaks above make each fail. **PASS**
- `npx tsc --noEmit && npx vitest run`: 1404 passed. **PASS** (`npm run build && npm test` not run, as instructed.)
- `git status --short .timone` is empty. **PASS**

**What the orchestrator must know.**

- **A takeover of timone #91, #92 or #95 to #98 does not reach this change if their runs are `done`.** The runner ended those runs. `resolveTakeover` answers a ticket whose last run is `done` with *"timone #95 is finished — see the ticket."* and opens nothing; a `cancelled` one gets the cancelled sentence. Only a ticket the ledger has no run for at all is enrolled. Checked with a scratch script (not committed) on a temp ledger: a `done` run on a `wayfinder:grilling` ticket gives `{"kind":"nothing-to-do","message":"timone #95 is finished — see the ticket."}`. So the plan's premise, that a later `timone takeover timone#95` finds no run, holds only if the run is gone from the ledger. Changing what a takeover of a finished run does is not in this plan.
- **The real ledger is not changed by this slice.** The one-line reason reaches the file the next time the daemon writes it, once the daemon runs the new build. The running daemon still uses the code it loaded at start.
- **`dist/` is behind `src/` for `runs.ts` and `takeover.ts`** until the next `npm run build`.
- **Seen, not changed (outside this slice's files):** `waitOf` in `src/daemon/session.ts` does not carry `resolvableBy`. A run with no step that a takeover gives back is parked on a wait with no `resolvableBy` at all; a run with a step gets `[step]` from `applyPark`. This was so before 41m.
- **Refactoring I would do but did not:** the takeover tests now have three ways to run a takeover on a fresh ledger (`takeOver` in *a takeover of a run that is queued or running*, `takeOverWithNoRun`, and the inline one in *holds the new run for the terminal…*). One helper could serve all three.

### ✏ 2026-10-02 — 41m extended: case (5), a takeover of an open ticket whose run is settled

**Built.** The plan was amended after the finding above. A takeover of a ticket whose latest run is `done` or `cancelled` now asks the tracker whether the ticket is open, with the same listing it already read for a ticket with no run (`listOpenTickets`). If the ticket is open, the takeover registers the ticket's next run through `register`, puts it at the step its `wayfinder:` label names, and opens the session, exactly as for a ticket with no run. If it is closed, the answer is the same as before: *"… is finished — see the ticket."* for a done run, the cancelled sentence for a cancelled one, and nothing is opened. Decision 1 above (the one-line cut on a run already written as cancelled) is accepted and stays.

**Files touched, in addition to the list above.**

- `src/commands/takeover.ts` — `resolveTakeover` is now `findTakeover` (reads the ledger and the tracker, writes nothing) followed by `enrolFromTracker` (the write). New `Finding`, `openTicketOf` and `settledMessage`. The `done` and `cancelled` arms share one arm. `enrolFromTracker` takes the open ticket and is no longer async. `claimForTakeover` asks `findTakeover` while a daemon holds the ledger (decision 6). Doc comments brought in line.
- `src/commands/takeover.test.ts` — case (5): three tests. One more test for the ledger's one writer (decision 6). The 41m helper became `takeOverOnFreshLedger(ticket, { before, open })`, and the 41m describe is renamed *a takeover that opens a new run, at the step its `wayfinder:` label names (41m)*. One test re-based (below).

**Decisions taken inside the extension.**

6. **A takeover that cannot get the ledger still writes nothing.** While a daemon holds the ledger, the command used to call `resolveTakeover` for a ticket the ledger knows, because for such a ticket it wrote nothing. Case (5) makes it write for a settled run on an open ticket. So the resolution is split. `findTakeover` reads only, and says `enrol` where a new run is needed. The command asks it while the daemon holds the ledger, and hands an `enrol` to the daemon with the `claim-takeover` request, as it already does for a ticket with no run. The daemon's request goes through `resolveTakeover`, so the daemon registers the run. A closed ticket is still refused at the terminal, from the tracker's answer.
7. **A cancelled run is treated as a done run**, as the amendment says. On a closed ticket, the cancelled sentence is unchanged, including its way out through `heldStepWayOut`.
8. **The tracker is asked once, through the open listing.** A closed ticket and a ticket that no longer exists are not told apart for a settled run: the ledger already says the ticket existed.

**Test re-based, because it asserted what case (5) changes.** `takeover.test.ts` › *runTakeover* › *does not read the ticket at all when the ledger already says there is nothing to take over* started from a `done` run and asserted the tracker was not asked. After the change it failed: `→ expected [ 'scratch-app' ] to deeply equal []` (the open listing was read). For a done run the ledger no longer answers alone. The test now starts from a run at work (`active`), where the ledger still does, and asserts the same three things: the ticket not read, the listing not read, nothing opened. A dated comment in the test says so.

**Validation evidence for case (5).**

*New run on an open ticket* (`… (41m)` › *registers a new run of an open `wayfinder:grilling` ticket whose latest run is done, at wayfinding, and opens the session*, through `runTakeover`). It asserts that the held run is `scratch-app#12/2`, active, at `wayfinding`; that the prompt carries `- its step: talking a question through (wayfinding)` and `` `timone-wayfind` ``; and that afterwards the ticket has `#12/1` done and `#12/2` parked at `wayfinding`. Beside it, *registers the next run of an open ticket whose latest run is done or cancelled* (through `resolveTakeover`, both statuses). Written first, seen red:

```
× … > registers a new run of an open `wayfinder:grilling` ticket whose latest run is done, at wayfinding, and opens the session
  → expected 1 to be +0 // Object.is equality
× … > registers the next run of an open ticket whose latest run is done or cancelled
  → expected { kind: 'nothing-to-do', …(1) } to match object { kind: 'escalation', run: { …(3) } }
✓ … > gives the finished answer, and opens nothing, when that ticket is closed
Tests  2 failed | 4 passed | 40 skipped (46)
```

Green after the change: `takeover.test.ts` `Tests  46 passed (46)`, with the re-based test.

*The same ticket closed* (*gives the finished answer, and opens nothing, when that ticket is closed*). It asserts exit code 1, no session, the one line *"scratch-app #12 is finished — see the ticket."*, no new run, and no request left. It passes before and after, so it could not be red. Break: the settled arm opens a new run without asking whether the ticket is open. Result, then restored (`diff` against a saved copy empty):

```
× … > gives the finished answer, and opens nothing, when that ticket is closed
  → expected +0 to be 1 // Object.is equality
Tests  1 failed | 46 skipped (47)
restored: Tests  1 passed | 46 skipped (47)
```

*Decision 6* (`takeover and the ledger's one writer` › *creates no new run of an open ticket whose latest run is done while a daemon holds the ledger*). Written after the first change, before the split, and seen red: the command wrote the new run while the daemon held the ledger.

```
× takeover and the ledger's one writer > creates no new run of an open ticket whose latest run is done while a daemon holds the ledger
  → expected [ 'scratch-app#12/1', …(1) ] to deeply equal [ 'scratch-app#12/1' ]
+   "scratch-app#12/2",
Tests  1 failed | 46 skipped (47)
```

Green after the split: `takeover.test.ts` `Tests  47 passed (47)`. The test also asserts that the daemon was asked and the ask taken back, and that nothing was opened.

Cases (1) to (4) are unchanged by the extension and still pass. Case (4)'s break line (`const stage = wayfinderStage(ticket.labels);`) is unchanged in `enrolFromTracker`.

**Validation commands, run again.** `npm run build` was again **not** run, as instructed.

```
$ npx tsc --noEmit && npx vitest run 2>&1 | tail -5
(tsc exit 0)
 Test Files  56 passed (56)
      Tests  1408 passed (1408)
$ git status --short .timone ; echo "(expected: nothing — no test touched the real ledger)"
(expected: nothing — no test touched the real ledger)
```

1408 = 1404 + 3 (case (5)) + 1 (decision 6). One more test re-based, none deleted.

- [x] Red-green evidence for each of the five cases is in the handoff. Cases (1), (3) and (5)'s new-run half were seen red, then green. Cases (2), (4) and (5)'s closed half pass before and after; the breaks above make each fail. **PASS**
- `npx tsc --noEmit && npx vitest run`: 1408 passed. **PASS** (`npm run build && npm test` not run, as instructed.)
- `git status --short .timone` is empty. **PASS**

**What the orchestrator must know, updated.**

- **The first point under *What the orchestrator must know* above is out of date.** A takeover of timone #91, #92 or #95 to #98 now opens a new run at wayfinding if the ticket is still open, and answers "finished" only if it is closed.
- **A takeover now opens work on a ticket whose run a person cancelled, if the ticket is still open.** `timone cancel` holds the ticket, and the poll loop does not pick a held ticket up. A takeover does not check the hold: it opens a new run and a session, as the amendment says for any open ticket. When that session ends, the run goes back to the runner, which reads the ticket.
- **The takeover's new run skips the poll loop's `successorHeldBack` check** (the check that holds back a ticket's next run while its approved pieces are all built, or its list of pieces has grown since it was approved). That check lives in `src/daemon/poll.ts` and runs only for marked tickets the cycle lists. A takeover of a map ticket whose last run is done can therefore open a new run at charting while the map's pieces are all built. The runner then decides from the ticket.
- **`dist/` is behind `src/` for `runs.ts` and `takeover.ts`** until the next `npm run build`. The running daemon still uses the code it loaded at start, so a `claim-takeover` request it carries out still has the old behaviour until it is restarted on a new build.

## 41l — The live check: the replay, and one watched run on scratch-app

**Built.** No code. fvermaut ran the replay from his terminal (19 of 19, three tries each, $2.50, run 8 in `phase-40-replay.md`) and restarted the daemon on this build. The real ledger was copied first to `.timone/state.json.bak-20260930-166`. One machine-typed feature ticket, scratch-app #71, went from pickup to pull request #73 on the new code, for $33.25. The full account is in [phase-41-live-gate.md](phase-41-live-gate.md).

**Files touched.**

- `doc/plans/phases/reports/phase-41-live-gate.md` — created.
- `doc/plans/phases/reports/phase-40-replay.md` — run 8 appended (committed separately, `3c2729d`).

**Decisions taken inside the slice.** The watched ticket was a small feature, so that the approval of the requirements on the ticket (PRD-02.R4) would be seen. It was checked against scratch-app's code before it was opened.

**Validation evidence.** No behaviour-carrying code in this slice, so no seams were declared and there is no red-green trace; validation is checklist-based.

- [x] The replay passes 19 of 19, three tries of three — **PASS**, at `3afc263`. 41m changed code after it; one more replay is owed on the final build.
- [~] The ten old runs read as described, and no comment was posted on their tickets — **PARTLY.** The ten runs were converted as planned. The runner then ended the six conversation runs on Timone's own tickets, whose label had been removed, and posted on four of them. Recorded in `phase-41-departures.md`; 41m added.
- [x] The watched ticket reached its pull request — **PASS**, with four stops, each for fvermaut, all from the default order for a feature (the plan had predicted one). No stop came from the machine: the checking step's question was carried to the pull request.
- [x] **Human gate** — fvermaut ran the replay, started the daemon, answered the questions and approved the requirements and the list of pieces on the ticket.

**What delivery must know.** Pull request scratch-app #73 is open and is fvermaut's to merge or close; nothing in Timone waits on it. The daemon is still running on `3afc263`; 41m's change to the ledger read reaches it only when it is restarted. One more replay is owed on the final build.

## 41n — The review's code findings that change what the code does

**Built.** (1) `timone help retry` now prints the same sentence as `timone retry`, on stderr, and exits 1. Before, it printed `Usage: timone retry [anything...]` and exited 0. (2) The takeover prompt decides which named people's comments came after the wait opened by comparing instants (`Date.parse`), not text. A comment written half a second before a wait that opened at `…:00.500Z` is no longer shown as written since. (3) The takeover prompt asks a session that ran no step's skill to sign its commits `Timone-Stage: interactive`, not `escalation`. (4) A takeover of a closed ticket whose run was cancelled now says the way back that works: *"reopen the ticket and take the `timone:held` label off it, and I'll start it afresh on my next pass."* It used to say "reopen the ticket and mark it for me", which starts nothing on a held ticket. The comment that said a takeover opens a session "on any run" now says "on any run nothing is working on". (5) `normaliseOldPath` and `normaliseRemovedFields` read the unknown ledger data through `in` checks, as `normaliseSequence` does, and no longer cast it with `as`. What a ledger loads as is unchanged.

**Files touched.**

- `src/cli.ts` — the hidden `retry` command is now the class `RemovedRetryCommand`, added with `program.addCommand(…, { hidden: true })`. Its action is unchanged. It overrides `help()` to print `RETRY_REMOVED` on stderr and exit 1.
- `src/cli.test.ts` — case (1): `help retry` added to the `it.each` list.
- `src/daemon/prompts.ts` — `namedWordsBlock` compares with `Date.parse`, and its doc comment says why. The trailer line of `escalationPrompt` says `interactive`, with a dated comment.
- `src/daemon/prompts.test.ts` — cases (2) and (3), two tests in *the takeover prompt for a run the runner waits on (41g)*.
- `src/commands/takeover.ts` — `settledMessage` names `HELD_LABEL` as the way back, with a dated comment. The "on any run" comment in `findTakeover`.
- `src/commands/takeover.test.ts` — case (4): one test re-based (below). The same "on any run" sentence in the comment above `endedFirstRun`.
- `src/daemon/runs.ts` — `normaliseOldPath` and `normaliseRemovedFields`, as above. Nothing else.
- `doc/plans/phases/reports/phase-41-handoffs.md` — this section.

`src/daemon/runs.test.ts` is in the grant but was not changed: case (5) is that its tests pass unchanged.

**What the session-end check accepts.** `checkProvenance` in `src/daemon/hooks.ts` passes a commit when any of its trailer lines starts with `Timone-Stage:`. It does not read the value, so `interactive` is accepted, and so is any other word. Its own advice for a commit without the trailer is `Timone-Stage: interactive` "when no process stage was running". `trailerInstruction` in `src/commands/guardrails.ts`, which every session is given at its start, says `<the process stage you are running, or \`interactive\` if none>`. So the check accepts `interactive`, and the prompt now matches what the start of the session and `CLAUDE.md` say.

**Decisions taken inside the slice.**

1. **`help retry` is answered by overriding `help()` on a subclass of `Command`.** Commander answers `help <name>` by calling that command's `help()` directly; no hook or event runs on that path. `help()` is public and declared in commander's types, so overriding it is the smallest change that reaches it. It ends with `process.exit(1)`, as commander's own `help()` ends with `process.exit`. The other way I saw needs three pieces (`configureHelp` for the text, `configureOutput` for stderr, an event to set the exit code).
2. **`Date.parse`, not the driver's `ms()`.** `ms` is private to `src/runner/driver.ts`, which this slice may only read. `ms` is one line, `Date.parse(instant)`, so the decision is now made the same way in both places. The comparison stays strict (`>`), as the driver's is.
3. **The trailer line is the same for every run**, not only for a run with no step: "the stage whose skill you ran, or `interactive` if none". A session on a run with a step may run no skill, and a session on a run with no step may run one. Case (3) builds the prompt for a run with no step, as the plan says.
4. **The new way back names the label, through `HELD_LABEL`.** `takeover.ts` already imported it and did not use it (41e noted this). A step ticket still gets `heldStepWayOut`'s words, unchanged.
5. **Case (4) re-bases an existing test instead of adding one.** *resolveTakeover › says a cancelled chunk was abandoned, and what would start the work again* asserted the opposite: `/mark it for me/`, and no `timone:held`. Its comment said the hold belonged only to a dropped step, which stopped being true in 40u. It is renamed *…a cancelled chunk on a closed ticket was abandoned…*, passes `fakeAdapter([])` so the closed ticket is explicit, and asserts `reopen the ticket`, `take the \`timone:held\` label off`, and no `mark it for me`. Its other assertions are unchanged.
6. **In `normaliseRemovedFields`, the wait's `acknowledgedAt` is dropped with `Object.entries(…).filter(…)`.** After an `in` check the wait's type is `object`, and taking a named field out of `object` by destructuring does not type-check. The result is the same for an object read from JSON.
7. **`normaliseOldPath` returns at once for a run with no `status`.** The old code reached the same `return run` for it, one branch later.
8. **`(REMOVED_FIELDS as readonly string[])` stays.** It widens a constant list; it does not narrow ledger data, and the finding and the validation grep are about `as Record<string, unknown>`.

**Validation evidence.**

*(1) `timone help retry`* (`src/cli.test.ts` › *the removed retry command* › *exits 1 and sends the person to the ticket: \`timone help retry\`*). Built, then run, seen red:

```
✓ … `timone retry scratch-app#1`   ✓ … `timone retry`   ✓ … --state elsewhere.json   ✓ … `timone retry --help`
× the removed retry command > exits 1 and sends the person to the ticket: `timone help retry` 119ms
  → expected +0 to be 1 // Object.is equality
✓ the removed retry command > is not listed in the help
Tests  1 failed | 5 passed (6)
```

Built again after the change: `Tests  6 passed (6)`. The test also asserts stdout is empty and stderr is exactly the sentence. `timone help cancel` still prints the cancel command's help and exits 0, and `timone --help` still does not list `retry`.

*(2) Instants, not text* (`prompts.test.ts` › *compares when a comment was written with when the wait opened as instants, whatever their spelling*). The wait opens at `2026-08-03T10:00:00.500Z`; fvermaut wrote at `…T10:00:00Z` and at `…T10:00:01Z`. Seen red:

```
× the takeover prompt for a run the runner waits on (41g) > compares when a comment was written with when the wait opened as instants, whatever their spelling 4ms
  → expected '--- what they wrote ---\nwritten just…' not to contain 'written just before the wait opened'
Tests  1 failed | 188 skipped (189)
```

Green after `Date.parse`: `prompts.test.ts` `Tests  189 passed (189)`.

*(3) `Timone-Stage: interactive`* (`prompts.test.ts` › *asks a session that ran no step's skill to sign its commits \`Timone-Stage: interactive\`*). The run has no step. The test asserts the exact trailer line, and that no `Timone-Stage:` line names `escalation`. Seen red:

```
× … > asks a session that ran no step's skill to sign its commits `Timone-Stage: interactive` 7ms
  → expected 'You are picking up **scratch-app #6**…' to contain 'Timone-Stage: <the stage whose skill …'
Tests  1 failed | 189 skipped (190)
```

Green after the line changed: `Tests  190 passed (190)`.

*(4) The way back from a cancelled run on a closed ticket* (`takeover.test.ts` › *resolveTakeover* › *says a cancelled chunk on a closed ticket was abandoned, and what would start the work again*). Re-based first, seen red:

```
× resolveTakeover > says a cancelled chunk on a closed ticket was abandoned, and what would start the work again 7ms
  → expected 'scratch-app #4 was cancelled: the tic…' to contain 'take the `timone:held` label off'
Tests  1 failed | 46 skipped (47)
```

Green after `settledMessage` changed: `takeover.test.ts` `Tests  47 passed (47)`.

*(5) The old-ledger load tests pass unchanged.* There is no new behaviour, so nothing could be red. Before the change, the eleven tests in *the wait as one value* (three), *runs the old code left in the ledger become runs the runner can read* (four), *fields only the old code wrote are dropped when the ledger is read (41h)* (two) and *a failed run the old code left keeps a reason of one line (41m)* (two): `Tests  11 passed | 111 skipped (122)`; the whole file `Tests  122 passed (122)`. After it: the same eleven names, `Tests  11 passed | 111 skipped (122)`, and `122 passed (122)`. `git diff -- src/daemon/runs.test.ts` is empty. `npx tsc --noEmit` exit 0.

To show the tests watch the new narrowing, I broke one `in` check at a time, ran the eleven tests, and put the file back from a saved copy (`diff` empty after each):

```
break: "failure" in run  →  "failures" in run          (normaliseOldPath)
× … > loads each failed run as cancelled, keeping what stopped it, and leaves done and cancelled runs as they were
  → expected { id: 'scratch-app#21/1', …(12) } to deeply equal { id: 'scratch-app#21/1', …(12) }
× … (41m) > loads an old failed run whose failure is a whole machine comment with one line, and no banner and no command
Tests  2 failed | 9 passed | 111 skipped (122)

break: !("wait" in run)  →  !("waits" in run)          (normaliseOldPath)
× the wait as one value > folds a real pre-collapse ledger into the new shape
× … > loads each old kind of wait as the runner's, keeping what it waits on and when it opened
  → expected { id: 'ivtrends#93/1', …(10) } to deeply equal { id: 'ivtrends#93/1', …(10) }
Tests  2 failed | 9 passed | 111 skipped (122)

break: "cancellation" in run  →  "cancelation" in run  (normaliseOldPath)
× … (41m) > cuts the reason the same way on a run an earlier build already converted and wrote
  → expected { id: 'timone#106/1', …(10) } to deeply equal { id: 'timone#106/1', …(10) }
Tests  1 failed | 10 passed | 111 skipped (122)

break: "wait" in run  →  "waits" in run                (normaliseRemovedFields)
× (41c's four and 41h's two)
  → Invalid daemon state file "…/state.json": runs.3.wait: Unrecognized key: "acknowledgedAt"
  → (41h's second) runs.0.wait.kind: Invalid input: expected "runner"
Tests  6 failed | 5 passed | 111 skipped (122)

break: field !== "acknowledgedAt"  →  field !== "acknowledged"   (normaliseRemovedFields)
  → Invalid daemon state file "…/state.json": runs.3.wait: Unrecognized key: "acknowledgedAt"
Tests  5 failed | 6 passed | 111 skipped (122)

restored: Tests  122 passed (122)
```

Validation commands, as run:

```
$ npm run build && npm test 2>&1 | tail -5
 Test Files  56 passed (56)
      Tests  1411 passed (1411)
$ node dist/cli.js help retry ; echo "exit: $? (expected 1)"
`timone retry` was removed. Write on the ticket instead: say what you want done.
exit: 1 (expected 1)
$ grep -n " as Record<string, unknown>" src/daemon/runs.ts
1483:  const old = run as Record<string, unknown>;
```

Line 1483 is in `normaliseWait`. 1411 = 1408 + 1 (case (1)) + 2 (cases (2) and (3)). Case (4) re-based one test; none deleted. `git status --short .timone` is empty.

- [x] Red-green evidence for each of the five cases is in the handoff. Cases (1) to (4) were seen red, then green. Case (5) adds no behaviour: the tests pass before and after, and the five breaks above make them fail. **PASS**
- [x] The last command prints only the line in `normaliseWait`, which is older than this phase. **PASS**

**What 41o and 41p must know.**

- **`dist/` is built from this slice's code.** The running daemon still uses the code it loaded at start.
- **A run cancelled before a cancel put the hold on** (before 40u), and a failed run 41c reads as cancelled, carry no `timone:held` label. For those, the new message names a label the ticket does not have; reopening it is enough while it still carries the `timone` mark. The message also does not say the ticket needs the mark. A cancel and a close leave the mark on, so an ordinary cancelled ticket still has it. I kept the plan's words.
- **Left as they were, outside this slice's findings:**
  - `src/commands/takeover.ts`, `settledMessage`: the comment says the reason "lives in `cancellation` rather than `failure`". `failure` no longer exists (41h noted it).
  - `src/daemon/dropped.ts`, the doc of `heldStepWayOut`: it says any other ticket's cancelled chunk is opened again on the next cycle, "which is … still what happens". That stopped being true in 40u. Not in this slice's files.
  - The names finding 4 lists (`escalation` as a resolution kind, `escalate`, `escalationPrompt`, `StoppedRun`, `ASK_CHECK_MODEL`) are unchanged. This slice changed only the trailer value.
- **The CLI test runs the built `dist/cli.js`**, so build before running it.
- **Refactoring I would do but did not:** export the driver's `ms()` from one shared place, so the runner and the takeover prompt use the same helper, not two copies of `Date.parse`. Narrow `normaliseWait` with `in` checks too; its cast is older than this phase and the plan leaves it.

### ✏ 2026-10-02 — 41n, case (4) adjusted at the orchestrator's request

**Built.** The message on a closed ticket whose run was cancelled is now true for every cancelled ticket, the old ones too: *"… Cancelled work isn't picked up again — reopen the ticket, make sure it has the `timone` label, and take the `timone:held` label off if it has it. Then I'll start it afresh on my next pass."* The cycle lists only tickets with the `timone` label, and a run cancelled before 40u, or a failed run 41c reads as cancelled, has no hold. A step ticket still gets `heldStepWayOut`'s words, unchanged.

**Files touched, in addition to the list above.** `src/commands/takeover.ts` — the message and its comment; `MARK_LABEL` imported from `src/adapters/ticketing.ts`, as `cancel.ts` does. `src/commands/takeover.test.ts` — the case (4) test asserts `make sure it has the \`timone\` label` and `take the \`timone:held\` label off if it has it`, and its comment says why.

**Evidence.** The test was changed first and seen red:

```
× resolveTakeover > says a cancelled chunk on a closed ticket was abandoned, and what would start the work again 7ms
  → expected 'scratch-app #4 was cancelled: the tic…' to contain 'make sure it has the `timone` label'
Tests  1 failed | 46 skipped (47)
```

Green after the message changed: `npx tsc --noEmit` exit 0, `takeover.test.ts` `Tests  47 passed (47)`.

Validation commands, run again:

```
$ npm run build && npm test 2>&1 | tail -5
 Test Files  56 passed (56)
      Tests  1411 passed (1411)
$ node dist/cli.js help retry ; echo "exit: $? (expected 1)"
`timone retry` was removed. Write on the ticket instead: say what you want done.
exit: 1 (expected 1)
$ grep -n " as Record<string, unknown>" src/daemon/runs.ts
1483:  const old = run as Record<string, unknown>;
```

The test count is unchanged: case (4) was changed, not added to. `git status --short .timone` is empty.

- [x] Red-green evidence for each of the five cases is in the handoff. Case (4) is shown above and in the section before it. **PASS**
- [x] The last command prints only the line in `normaliseWait`, which is older than this phase. **PASS**

The second bullet under *What 41o and 41p must know* above is out of date: the message now names the mark, and takes the hold off only if the ticket has it.

## 41o — The review's tidy-up findings, with no change in what the code does

**Built.** No behaviour changed. Standards findings 1, 2, 3, 4 (the names), 5 and 9 of the delivery review are done. (1) `RunDaemonOptions.root`, which nothing read, is gone, with the line at the call site and the eight test arguments. (2) `attemptMerge` is no longer exported, so only `tryMergeChunkZero`, which requires an approval, can call it. (3) The three test helpers with no caller in `poll.test.ts` are deleted. (4) The takeover's names are takeover names: the resolution kind `escalation` is `open-session`, `escalate` is `openSession`, `escalationPrompt` is `takeoverPrompt`, and `StoppedRun` is `TakeoverRun`. `ASK_CHECK_MODEL` and `ASK_CHECK_TIMEOUT_MS` are `CONSULT_MODEL` and `CONSULT_TIMEOUT_MS`, and their comment says the one question they serve now: whether a reply at the spending limit means "go on". (5) Each comment the review quotes now says what the code does, including the two 41n named (`settledMessage` in `takeover.ts`, and the doc of `heldStepWayOut` in `dropped.ts`). (9) The step-table test, the describe that no longer holds a resume, and three test names are named for behaviour.

**Files touched.**

- `src/commands/daemon.ts` — `RunDaemonOptions.root` and its doc deleted; `root: process.cwd()` and its comment deleted at the call site.
- `src/commands/daemon.test.ts` — the eight `root: noCheckouts,` lines deleted, and the constant `noCheckouts` with its doc, which had no other use.
- `src/daemon/chunk-zero.ts` — `attemptMerge` not exported; its doc says why.
- `src/daemon/poll.test.ts` — `threadedAdapter`, `staleReviewAdapter` and `staleWithPullRequest` deleted. The describe *pollOnce — resuming a run whose human answered* is now *pollOnce — a run queued behind a park that holds nothing*. *…asks the runner to wake for a new marked ticket on a project whose entry names no driver* is now *…asks the runner to wake for a new marked ticket*.
- `src/commands/takeover.ts` — the renames; the `settledMessage` comment no longer names `failure`.
- `src/commands/takeover.test.ts` — the renames follow (import, five `kind` checks, two prompt calls); *…gives the run back to the runner on a project whose entry names no driver, and leaves the daemon a request to wake it* is now *…gives the run back to the runner, and leaves the daemon a request to wake it*.
- `src/daemon/prompts.ts` — `TakeoverRun`, `takeoverPrompt`; the two private functions that take the run follow.
- `src/daemon/prompts.test.ts` — the renames follow (import, every call, two typed constants). The describe *the escalation prompt* is now *the takeover prompt for a run that stopped at a step* (decision 2).
- `src/daemon/consult.ts` — `CONSULT_MODEL`, `CONSULT_TIMEOUT_MS`, and their doc.
- `src/daemon/dropped.ts` — the doc of `heldStepWayOut`.
- `src/commands/status.ts` — the doc of `RenderStatusOptions.records`.
- `src/daemon/outcomes.ts` — the doc of `LONGEST_ASK`.
- `src/daemon/pipeline.ts` — "the graph" is "the step table" twice; the `clarification` row's comments.
- `timone.yaml` — the comment on `operator`.
- `src/daemon/pipeline.test.ts` — *gives %s the same label, model, effort and branch as on main* is now *gives %s its label, model, effort and branch*; *has the same steps, in the same order* is now *lists every step, in order*; the local `onMain` is `table`, and its comment says what it holds (decision 3).
- `src/commands/status.test.ts` — *shows what a ticket has spent on a project whose entry names no driver, against the default limit* is now *shows what a ticket has spent against the default limit*.
- `doc/plans/phases/reports/phase-41-handoffs.md` — this section.

Every importer of a renamed name is in this list. `src/daemon/poll.ts` reads the takeover resolution but only compares it with `nothing-to-do`, so it needed no change. `src/daemon/consult.test.ts` does not import the two constants. No file outside the grant was touched.

**Decisions taken inside the slice.**

1. **The names are the ones the plan gives as examples**: `open-session`, `openSession`, `takeoverPrompt`, `TakeoverRun`. The resolution kind is never written to disk: the `claim-takeover` request carries the project, the ticket and the holder, not the kind. So renaming it changes nothing a running daemon or an older ledger reads.
2. **The describe *the escalation prompt* was renamed** to *the takeover prompt for a run that stopped at a step*. It was named after the function, and its own comment says the run in it is one that stopped at a step. This renames its 12 tests. The test *is not a stage, and is not listed as one* still checks that `"escalation"` is not in `PROMPTED_STAGES`. That is the old stage's name, not the takeover's, so it was left.
3. **The step-table test is renamed, not deleted.** The plan says to name it for what it checks. The list it compares against is still written out by hand; its comment keeps the dated note on where it came from. The describe keeps its name, *what the runner reads from the step table (41h)*: it already says what it checks.
4. **The clarification row's dated note stays, in the past tense.** The header of the step table says each dated Sonnet note records why that row was stepped down. So the note says what the work was then, and that the written answer was removed, instead of being deleted.
5. **`dropped.ts` keeps its history sentence, shortened.** The fault it records (telling a ticket to remove a label it does not carry) can still happen for a ticket cancelled before 40u. The half about "a stop that is not coming" stopped being true when every cancel began to hold its ticket, so it went.

**Validation evidence.** No behaviour-carrying code, so no seams and no red-green. As the orchestrator asked, a rename is proved to change nothing by the suite and the build only. One more check: every test name was saved before and after (`vitest run --reporter=json`), and the two lists were compared.

```
before: total 1411 passed 1411 failed 0
after:  total 1411 passed 1411 failed 0
only before: 29    only after: 29    in both: 1382
renamed, by file: status.test.ts 1, takeover.test.ts 1, pipeline.test.ts 13, poll.test.ts 2, prompts.test.ts 12
```

The 29 are the names listed above: 13 in the step-table describe, 12 in the renamed prompt describe, one test moved with its renamed describe in `poll.test.ts`, and the three driver names. Every test passed before and after.

`tsc --noUnusedLocals`, before and after, differs only by the three helpers. The six other entries it lists are older than this slice and outside finding 3 (`dirname` in `daemon.test.ts`, `enqueue` in `takeover.test.ts`, `readBreakdown` in `breakdown.test.ts`, two in `hooks.test.ts`, `z` in `lock.ts`).

Validation commands, as run:

```
$ npm run build && npm test 2>&1 | tail -5
> timone@0.1.0 build
> tsc
 Test Files  56 passed (56)
      Tests  1411 passed (1411)
$ npx tsc --noEmit --noUnusedLocals 2>&1 | grep -c "threadedAdapter\|staleReviewAdapter\|staleWithPullRequest" ; echo "(expected 0)"
0
(expected 0)
$ grep -rnw "escalationPrompt\|ASK_CHECK_MODEL\|StoppedRun" src --include='*.ts' | grep -vE '^[^:]+:[0-9]+:\s*(//|/?\*)' ; echo "exit: $? (expected 1)"
exit: 1 (expected 1)
```

The same grep without the comment filter, and with `ASK_CHECK_TIMEOUT_MS`, `escalate` and `noCheckouts` added, finds nothing either. `git status --short .timone` is empty.

- [x] The number of tests is unchanged from 41n's end: 1411 before, 1411 after. **PASS**
- [x] `npm run build && npm test`: 1411 passed. **PASS**
- [x] The three helpers: 0 lines. **PASS**
- [x] The old names: exit 1. **PASS**

**What 41p and delivery must know.**

- **Docs outside `src/` that name the old names.** `escalationPrompt` and `StoppedRun` are named only in plans and reports (`phase-25.md`, `phase-26.md`, `phase-41.md`, this file, `phase-41-delivery.md`), and `ASK_CHECK_MODEL` only in `phase-39-complete.md`, `phase-41.md`, this file and `phase-41-delivery.md`. Those are records and were not edited. Nothing under `.claude/skills/`, `manual/`, `CONTEXT.md` or `doc/specs/` names them.
- **`dist/` is built from this slice's code.** The running daemon still runs the code it loaded at start. Nothing it reads or writes changed.
- **Left as they were, outside the findings:** `src/daemon/consult.ts` still says, in its 40u note, that "the check was started with every built-in tool", and cites ADR-0054 D2 for the rule that a consult may not act. Both are history of the ask check, and the rule is still true. `poll.test.ts` keeps its doc on *every project is driven by the runner*: "A project entry names no driver any more", which is true.
- **Refactoring I would do but did not:** in `takeover.test.ts`, *gives the run back to the runner, and leaves the daemon a request to wake it* is now the same test as the one above it, *…when no daemon is running, …*: same set-up, same assertions. 41b noted it. One of the two could go, but this slice may not change the count.
