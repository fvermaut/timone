# Phase 47 — Departures

> One dated entry per departure from the plan or the requirements, appended, never rewritten. Format per `process.md` stage 6.

## 2026-10-04 — timone#201, execution

**Kind:** plan step
**Agreed:** At the end of each sub-phase, run the tests the change can affect, and every suite that takes under a minute, whole. The project's one vitest suite took 3.4 s at phase 46's close, so it counts as under a minute.
**Did instead:** Each sub-phase ran its own validation commands and the test files its change can affect. The whole suite ran once, at the close.
**Why:** The runner's instructions for this step asked for exactly this: "run only the tests of what you change; run the whole test suite once at the end". Phase 46 did the same, for the same reason.

## 2026-10-04 — timone#201, execution (47a)

**Kind:** plan step
**Agreed:** In 47a, the tests of `src/runner/driver.ts` change only where they built a `queued` run.
**Did instead:** Three tests in the driver's "project was busy (40u)" describe built no `queued` run but relied on a run just picked up holding the project. Their setup now gives the other run a running step. What they expect did not change.
**Why:** ADR-0063 D1 says a run just picked up takes no place, so those tests could not pass with their old setup. 47c rewrites that describe anyway.

## 2026-10-04 — timone#201, execution (47a)

**Kind:** plan step
**Agreed:** 47c says that after a wake whose `start_step` was refused for want of a place, `giveBack` is called when the place is given to the run, and the run "stays waiting".
**Did instead:** `giveBack` takes the place back and gives it to the next waiting run, and the run does not wait any more.
**Why:** With one place, a run that gave its place back and still waited would come first again and be given the same place at once. ADR-0063 D3 says a place given and not used goes to the next run.

## 2026-10-04 — timone#201, execution (47b)

**Kind:** check not run
**Agreed:** Every test of the code a sub-phase changes passes at its end.
**Did instead:** 47b was committed with one test failing in `src/runner/driver.test.ts`: "wakes it again after a new refusal, once the project is free again", in the "project was busy (40u)" describe. 47c replaces that describe.
**Why:** The test has a third run start a step at the moment the freed place is given to the refused run. ADR-0063 D3 says the ledger must refuse that, and it now does. The file is 47c's, not 47b's, so 47b may not change it.

## 2026-10-04 — timone#201, execution (47c)

**Kind:** plan step
**Agreed:** 47c changes `driver.ts`, `session.ts`, `brief.ts`, `daemon.ts` and their tests, with cases 1–7.
**Did instead:** The plan was amended in place (✏ 2026-10-04 under 47c). It grants one test in `src/daemon/poll.test.ts` and adds cases 8 and 9. First attempt: the slice's work passed cases 1–7, but a test in `poll.test.ts` that wrote a refusal by hand failed and kept the old words "The project is free now", so the validation grep failed; the file was not granted. It also found that a place given to a held ticket, or to a ticket over its spending limit, was never used and never given back, and that a place given later in the same wake as a refused try was handed on although the refusal promised a wake. Second attempt, with the grant and the two cases: all green.
**Why:** The failing test could not be fixed without its file. The two gaps would leave the project's one place taken, so no other step of the project starts. ADR-0063 D3 says a place given and not used goes to the next run.

## 2026-10-04 — timone#201, execution (47c)

**Kind:** check not run
**Agreed:** `npm run replay` passes (PRD-05.R18's replay set).
**Did instead:** It ran and every case failed with "Not logged in · Please run /login": the runner's sessions need a Claude login, and the build's container has none. No recorded replay case uses the old words "The project is free now"; the offline `src/runner/replay/harness.test.ts` passes. The replay set must be run where a login exists, before merge.
**Why:** The container has no Claude login for the sessions the replay starts.

## 2026-10-04 — timone#201, execution (47c)

**Kind:** plan step
**Agreed:** `daemon.ts` calls `store.regivePlaces()` once after `RunStore.open`, before the first cycle. The brief's place is filled from `placeHolders` and `waitingForPlace`. A failed or stopped runner session gives back a place given to the run.
**Did instead:** `regivePlaces()` is called inside the daemon's state lock in `runDaemon`, just before the first cycle. The brief reads `placeHolders` and the run's own place only. A session in which a try was refused for want of a place keeps the run's turn and any place given to it later, even when the session failed or was stopped. In case 8, the next waiting run is given the place in the same tick and woken on the next tick.
**Why:** Before the lock, a second `timone daemon` that the lock then refuses would re-give the places of the daemon that runs. The four wordings need nothing from `waitingForPlace`. A run refused for want of a place was told it will be woken when a place is given; handing that place on would break the promise. `tick` walks the runs it read at its start.

## 2026-10-04 — timone#201, execution (47d)

**Kind:** plan step
**Agreed:** 47d's cases 1–6; case 3 (which branch counts for the ticket) under the poll seam's list.
**Did instead:** One test was added at the declared `pollProject` seam for the forge failure the plan's prose asks for, which no case listed. Case 3 is tested at the adapter seam, where the branch rule lives. An adopted run is not counted in the cycle's `pickedUp` list. The new forge call does not refuse a full page of 200 open pull requests, as the ticket listings do; a ticket whose pull request falls off that page would be picked up as new work. An adopted step ticket does not get the hold label a pickup puts on a step ticket; its live run already stops a second pickup.
**Why:** The forge failure is behaviour the plan asks for, so it needs a test at a declared seam. The branch filter belongs to the adapter. The full page and the hold label were left as the plan wrote them, and are raised as questions on the pull request.

## 2026-10-04 — timone#201, execution (47e)

**Kind:** plan step
**Agreed:** Case 5 runs "the same three" through the `claim-takeover` request road; `findTakeover` loses every sentence that blamed another run of the project.
**Did instead:** Case 5 runs cases 1–3 through the request road; case 4 is tested through the command only. `findTakeover` needed no change: 47a had already removed its only such sentence, the queue message. Two of case 5's tests were written together before either ran; both passed on arrival, and each has its own failing mutation on record.
**Why:** "The same three" reads as cases 1–3. The second point is a fact of the code as 47a left it. The third is recorded so the trace is honest.

## 2026-10-04 — timone#201, execution (47g)

**Kind:** plan step
**Agreed:** The `process.md` stage 6 sentence "becomes" the new words; the charting instructions' "Mode 2 item 5" is amended.
**Did instead:** In `process.md` and in the charting instructions, the new words come first with a dated marker, and the old words are kept struck through after "The words before that date, kept as history:", as `process.md` already does once. The item amended is item 5 of "Closing the effort", the only item that says a map holds its project. It also gains one line: do not write in the route summary that other work on the project will stop.
**Why:** Old text is kept, not deleted. The plan named the wrong section for the item. Without the added line, the old instruction to write that the queue stopped would still be partly in force.
