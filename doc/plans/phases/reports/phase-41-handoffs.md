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
