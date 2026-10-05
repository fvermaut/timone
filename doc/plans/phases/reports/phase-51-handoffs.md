# Phase 51 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 51a — A takeover typed while a step runs waits, and opens the session when the step ends, before the runner is woken

**Built.** A takeover typed while a step of its ticket runs, with a daemon holding the ledger, is no longer refused. The command leaves its request as before. The daemon writes the terminal on the run as `waitingTerminal` and settles the request. The command prints the waiting sentence once, naming the step, and watches the ledger. When the step ends, the driver parks the run on its after-step wait and claims it for the waiting terminal in the same synchronous stretch, brings the pull request's description up to date, and does not wake the runner. The command then opens the session. When the session ends, the runner is woken with the step's end (and any failures after it), then "The terminal session ended.". With no daemon, a running step is still refused with today's words.

**Files touched.**

- `src/daemon/runs.ts` — `waitingTerminal: holderSchema.optional()` on the run schema, cleared in `transition()` when the run leaves `active` and by `claim()`. New `waitForStep(id, holder)`: refuses a run that is not `active` or is `takenOver`, else writes the field. New `liveWaiter(id)`: returns the field (liveness is 51b's).
- `src/commands/takeover.ts` — `TakeoverResolution` gains `{ kind: "wait-for-step"; run; step }`. `findTakeover` returns it for an `active` run that is not `takenOver`; `picked-up`, and `active` with `takenOver`, keep "I'm working on …". The lock-free road and `takeover()` (no state path) turn `wait-for-step` into today's words (`refusalOf`). The daemon road enqueues for it; after the request settles, a run carrying this terminal's token as `waitingTerminal` gets the waiting sentence and `waitForHandOver`, which looks every `deps.wait.intervalMs` (default `WATCH_INTERVAL_MS`) with `deps.wait.sleep`, with no bound, until the run is `active` with this terminal's token as holder.
- `src/daemon/poll.ts` — `claim-takeover`: a `wait-for-step` resolution calls `store.waitForStep(run.id, body.holder)`, logs `${target} waits for the step to end, for the terminal.`, returns 0.
- `src/runner/driver.ts` — `afterStep` reads `store.liveWaiter` before `parkForRunner`, then claims for the waiter right after the park (`handToWaiter`), logs `runner ${runId} — the step ended and the run goes to the terminal that waited for it`, updates the description, and skips the `ask`. A claim that throws is logged and the runner is woken as before. `terminalEnded` adds the step's end and the pieces failures (`unreadStepEnd`) before `TAKEOVER_ENDED_EVENT` when the run is still on `AFTER_STEP_WAIT`. `handBack` now takes a list of events.
- `src/daemon/requests.ts` — one line: `WATCH_INTERVAL_MS` is exported (the plan's context allows it).
- `src/daemon/runs.test.ts`, `src/runner/driver.test.ts`, `src/commands/takeover.test.ts`, `src/daemon/poll.test.ts` — the cases below.

**Decisions taken inside the slice.**

- `waitForStep`'s refusals say `Run <id> is <status>, so no step is running on it to wait for.` and `Run <id> is open in a person's terminal, so no step is running on it to wait for.` They reach a person only through the daemon's log ("could not apply …").
- A `claim-takeover` request with no `holder` (written by a build before holders) that finds a running step gets today's "I'm working on …" refusal: there is no terminal to write on the run.
- `active` with `takenOver` keeps "I'm working on …" in `findTakeover`. The goal's "open in another terminal" sentence has no case in 51a, so it is not built.
- After the request settles, the command checks for its own `waitingTerminal` first, then keeps today's check (`status === "active"` means handed over). The existing case "starts the conversation once the daemon has handed the run over" claims with no holder, so a stricter token check there would have changed it.
- In `terminalEnded`, a run on the after-step wait whose record has no `step-ended` for its stage gets `TAKEOVER_ENDED_EVENT` only (no fallback result exists there).

**Validation evidence.**

Case 1 — runs.test.ts, "a terminal that waits for the running step (ADR-0067 D1)": five tests ("writes the waiting terminal on a run whose step runs, and the ledger keeps it", "refuses … on a parked run", "refuses … on a run a person's terminal holds", "clears … when the run is claimed", "clears … when the run parks"). Red: `Tests 5 failed | 154 skipped` — `TypeError: store.waitForStep is not a function` (the two refusal tests: `expected [Function] to throw error including 'Run scratch-app#7/1 is parked, so no …' but got 'store.waitForStep is not a function'`). Green: `Tests 159 passed (159)`.

Case 7 — takeover.test.ts, "resolveTakeover > waits for the step that runs on the ticket, and names it". Red: `expected { kind: 'nothing-to-do', …(1) } to deeply equal { kind: 'wait-for-step', …(2) }`. Green: `Tests 52 passed (52)`. Second clause, "says it is working on a ticket just picked up, where no step runs yet", is today's behaviour and could not go red; mutation (picked-up returns `wait-for-step`) failed it and the existing picked-up case, then reverted.

Case 5 — poll.test.ts, "writes the asking terminal on a ticket whose own step is running, and leaves the step alone (R13 clause 3, ADR-0067 D1)". Red (after case 7, the daemon claimed the running run): `expected { id: 'scratch-app#6/1', …(10) } to match object { status: 'active', …(2) }` with `- "waitingTerminal": { … "token": "token-terminal-9100" }` missing. Green: `Tests 119 passed (119)`.

Case 2 — driver.test.ts, "RunnerDriver — a step ends on a run a terminal waits for (ADR-0067 D2) > hands the run to the waiting terminal, brings the description up to date, and wakes nobody". Red: `- "holder": { … "token-terminal-4213" }, - "status": "active", - "takenOver": true, + "status": "parked"`. Green: `Tests 30 passed (30)`.

Case 3 — the existing cases "records the step's cost, and rewrites …" and "wakes a run whose step just ended once, with the step's end, … (PRD-07.R2 clause 6)" stay green with no change. Could not go red; mutation (`if (handed || waiter === undefined) return;`) failed 7 driver cases including both, then reverted: `Tests 30 passed`.

Case 4 — driver.test.ts, "tells the runner of the step's end, then of the session's end, when the terminal session ends". Red: events were `["The terminal session ended."]`, expected `["The step building ended: it succeeded.", "The terminal session ended."]`. Green: `Tests 32 passed (32)`. Second clause, "tells the runner only of the session's end when the run was put on another wait meanwhile", is today's behaviour and could not go red; mutation (drop the `wait.on !== AFTER_STEP_WAIT` check) failed it, then reverted.

Case 6 — takeover.test.ts, "a takeover typed while the ticket's step runs (ADR-0067) > says which step it waits for, and opens the session when the step ends, before the runner is woken (PRD-09.R4 clauses 1 and 2)". Red: `expected [] to deeply equal [ "Waiting for the step running on scratch-app #6 (building) to end, then I'll open the session here — press Ctrl-C to stop waiting, and nothing changes." ]` (the command opened the session at once on the running run). Green: `Tests 53 passed (53)`.

Validation block:

```
npx tsc --noEmit; echo "exit: $?"            → exit: 0
npx vitest run src/daemon/runs.test.ts src/commands/takeover.test.ts src/daemon/poll.test.ts src/runner/driver.test.ts; echo "exit: $?"
  Test Files  4 passed (4)
       Tests  363 passed (363)
  exit: 0
```

- Checkbox 1 (cases 1–7 pass, each red recorded before its green): pass.
- Checkbox 2 (every other existing case unchanged, apart from poll.test.ts ~2165): pass. The named poll.test.ts change is the first item; the other two, both in `src/commands/takeover.test.ts`, the plan did not name:
  - poll.test.ts: "refuses to hand over a ticket whose own step is running, in the words the command uses (R13 clause 3)" became "writes the asking terminal on a ticket whose own step is running, and leaves the step alone (R13 clause 3, ADR-0067 D1)". The request now carries a holder, and the case expects it applied, settled, and the holder written as `waitingTerminal`, with the step's session left as it was.
  - takeover.test.ts "resolveTakeover > says what it is doing instead when the ticket is being worked on" asserted "working on … right now" for an `active` run through `resolveTakeover`. Case 7 requires the opposite, so it became the case 7 test above (marked ✏ in the file). The plan did not name this change.
  - takeover.test.ts line ~358 (cancelled-ticket case): `resolution.kind === "open-session" ? "" : resolution.message` no longer type-checks once the union has a third kind. It now reads `resolution.kind === "nothing-to-do" ? resolution.message : ""`. Same meaning, and the assertions did not change.

Other test files run at the end, all passing (`Test Files 17 passed (17)`, `Tests 390 passed (390)`, exit 0): `src/commands/cancel.test.ts`, `src/commands/daemon.test.ts`, `src/commands/guardrails.test.ts`, `src/commands/status.test.ts`, `src/daemon/chunk-zero.test.ts`, `src/daemon/hooks.test.ts`, `src/daemon/lock.test.ts`, `src/daemon/requests.test.ts`, `src/daemon/step-session.test.ts`, `src/planner/actions.test.ts`, `src/planner/driver.test.ts`, `src/planner/facts.test.ts`, `src/planner/session.test.ts`, `src/runner/actions.test.ts`, `src/runner/session.test.ts`, `src/runner/tools.test.ts`, `src/runner/replay/harness.test.ts`.

**What 51b must know.**

- `waitForHandOver` in `src/commands/takeover.ts` has one way out: the run claimed with this terminal's token. It has no lock check (the "daemon stopped" sentence), no "moved on" exit, and no Ctrl-C handler. Today, if the step's end does not hand the run over (the claim throws, or the run is cancelled), the command waits until the process is killed. The goal's other exits go in this loop.
- `liveWaiter` returns the field with no liveness check, and `waitForStep` does not refuse or replace another waiter.
- `afterStep` already logs a failed hand-over and wakes the runner, so a `liveWaiter` that clears a gone waiter and returns `undefined` needs no driver change.
- `terminalEnded` builds the step's end from the run's `stage` and the record. `takeoverAbandoned` can reuse `unreadStepEnd` (private in `RunnerDriver`) without the `TAKEOVER_ENDED_EVENT`.
- The waiting sentence already says "press Ctrl-C to stop waiting, and nothing changes". Until 51b, Ctrl-C during the wait kills the process with the default handler, and the waiter stays on the run.

## 51b — Stopping the wait changes nothing, and one terminal waits at a time

**Built.** One terminal waits for a step at a time. A second takeover of the same ticket is refused with "Another terminal is already waiting for the step on <project> #<n>: <command> (pid <pid>).", exit code 1, and the first terminal stays on the run. A waiting terminal whose process is gone is replaced by the next one, and is cleared when the step ends, so the runner is woken with the step's end as if nobody had waited. While a terminal waits, Ctrl-C (`SIGINT`) or `SIGTERM` stops the wait instead of killing the process. The command then looks once for a claim with its own token. A claim found is given back with a `release-takeover` request whose outcome is `abandoned`, and the daemon then wakes the runner with the step's end only, with no "The terminal session ended.". The command prints "Stopped waiting. Nothing changed on <project> #<n>." and exits with 130.

**Files touched.**

- `src/daemon/runs.ts` — `waitForStep` refuses while another waiter's process is not `gone` and its token differs, and replaces a `gone` one. `liveWaiter` clears a `gone` waiter, writes the ledger, and returns `undefined`. New exported `anotherWaiterMessage(run, waiter)`: the "another terminal" sentence, used by the store's refusal and by the command.
- `src/commands/takeover.ts` — `waitForHandOver` installs `SIGINT`/`SIGTERM` handlers that abort an `AbortController`, and removes them in a `finally` before it returns. The loop is now `watchForHandOver(target, hold, deps, stop)`, which returns the claimed run, or `undefined` when stopped. After a stop: one look with `claimedFor`, `releaseClaim(..., "abandoned")` for a claim found, the stopped sentence, exit 130. After the request settles, a run that is `active` and carries another terminal's `waitingTerminal` gets the "another terminal" sentence and exit 1. `releaseClaim` takes an `outcome` parameter (default `"ended"`). New `claimedFor` helper: the token check that `withdraw` and the watch loop both use.
- `src/daemon/poll.ts` — `release-takeover` with `outcome: "abandoned"` calls `deps.runner.takeoverAbandoned(run)`; `"ended"` calls `terminalEnded` as before.
- `src/runner/driver.ts` — new `takeoverAbandoned(run)`: `handBack` with `unreadStepEnd` only, no `TAKEOVER_ENDED_EVENT`.
- `src/daemon/runs.test.ts`, `src/runner/driver.test.ts`, `src/commands/takeover.test.ts`, `src/daemon/poll.test.ts` — the cases below. In `driver.test.ts`, the 51a helper `buildingChore` takes an optional `livenessOf` (default `"alive"`); no existing case changed.

**Decisions taken inside the slice.**

- The second terminal learns of the refusal from the ledger, not from the daemon's log. After its request settles, it finds the run still `active` with another terminal's token in `waitingTerminal`, and prints the sentence from that holder. It does not check before it asks: liveness is the store's judgement, and `liveWaiter` writes, which the command must not do without the lock.
- The sentence lives once, in `anotherWaiterMessage` in `runs.ts`. The store throws it, so the daemon's log says the same words.
- The stop is read after each sleep, so the claim check comes first in each look. A stop and a hand-over in the same look go to the stop: the person pressed Ctrl-C, so the claim is given back.
- The handlers use `process.on`, not `once`, so a second Ctrl-C during the same wait does not reach the default handler and kill the process mid-loop.
- `ReleaseOutcome` is derived from the request schema's type, so it cannot drift from it.
- `claimedFor` replaces the third copy of the "active, with this terminal's token" check (`withdraw`, the watch loop, the look after a stop).
- `liveWaiter` clears a `gone` waiter as the plan says, but no test sees the clear on its own: the park that follows in `afterStep` clears the field anyway. I did not add a store test for it.

**Validation evidence.**

Case 1 — `driver.test.ts`, "RunnerDriver — a step ends on a run a terminal waits for (ADR-0067 D2) > wakes the runner with the step's end, and clears the waiting terminal, when that terminal's process is gone (PRD-09.R4 clause 3, ADR-0067 D2)". Red: `Tests 1 failed | 32 skipped` — `- "status": "parked", + "status": "active"` (the run went to the gone terminal). Green: `Tests 33 passed (33)`.

Case 2 — `runs.test.ts`, "a terminal that waits for the running step (ADR-0067 D1) > refuses a second waiting terminal while the first one's process is alive, and keeps the first (ADR-0067 D1)". Red: `AssertionError: expected [Function] to throw an error`, `Tests 1 failed | 6 passed | 154 skipped`. Green: `Tests 161 passed (161)`. The second clause, "replaces a waiting terminal whose process is gone (ADR-0067 D1)", passed before any change, since `waitForStep` used to overwrite every time. Mutation (refuse whatever the liveness: `if (other !== undefined && other.token !== holder.token)`) failed it with `Another terminal is already waiting for the step on scratch-app #7: timone takeover scratch-app#7 (pid 4213).` (`Tests 1 failed | 160 passed`), then reverted: `Tests 161 passed (161)`.

Case 3 — `takeover.test.ts`, "a takeover typed while the ticket's step runs (ADR-0067) > stops waiting on Ctrl-C, says nothing changed, and leaves nothing behind (PRD-09.R4 clause 4, ADR-0067 D3)". The test emits `SIGINT` from inside the injected `sleep`, as the existing signal cases do, and its fake daemon throws after ten looks so a wait that does not stop fails fast. Red: `Error: the wait did not stop on Ctrl-C`, `Tests 1 failed | 53 skipped`. Green: `Tests 54 passed (54)`.

Case 4 — two tests.
- `takeover.test.ts`, "gives the run back as abandoned when Ctrl-C comes just after the step's end handed it over (ADR-0067 D3)". It passed on its first run, because case 3's implementation already held the look after the stop and the `abandoned` outcome. Two mutations, each reverted: the outcome left at `"ended"` failed it with `- "outcome": "abandoned", + "outcome": "ended"`; the look after the stop removed failed it with `expected [] to deeply equal [ { kind: 'release-takeover', …(3) } ]`. After revert: `Tests 55 passed (55)`.
- `poll.test.ts`, "pollOnce — handing a run to the terminal and taking it back > wakes the runner with the step's end only, as if nobody had waited, when the waiting terminal gives the run back unopened (ADR-0067 D3)". Red: the wake's events were `["The step building ended: it succeeded.", "The terminal session ended."]`, expected only the first. Green (poll and driver files together): `Tests 153 passed (153)`.

Case 5 — `takeover.test.ts`, "refuses a second takeover while another terminal waits for the step, and leaves that wait alone (ADR-0067 D1)". Red: `expected +0 to be 1` — the second terminal opened a session on the running run. Green: `Tests 56 passed (56)`.

Validation block:

```
npx tsc --noEmit; echo "exit: $?"            → exit: 0
npx vitest run src/daemon/runs.test.ts src/commands/takeover.test.ts src/daemon/poll.test.ts src/runner/driver.test.ts; echo "exit: $?"
  Test Files  4 passed (4)
       Tests  370 passed (370)
  exit: 0
```

- Checkbox 1 (cases 1–5 pass, with red runs recorded): pass. Two clauses could not go red (case 2's replace, case 4's request); each has a mutation recorded above.
- Checkbox 2 (every existing case of the four files passes unchanged): pass. No existing case changed.

Other test files run at the end (test files of every module that imports the four changed files): `src/cli.test.ts`, `src/commands/cancel.test.ts`, `src/commands/daemon.test.ts`, `src/commands/guardrails.test.ts`, `src/commands/record.test.ts`, `src/commands/status.test.ts`, `src/daemon/chunk-zero.test.ts`, `src/daemon/hooks.test.ts`, `src/daemon/lock.test.ts`, `src/daemon/requests.test.ts`, `src/daemon/session.test.ts`, `src/daemon/step-session.test.ts`, `src/planner/actions.test.ts`, `src/planner/driver.test.ts`, `src/planner/facts.test.ts`, `src/planner/session.test.ts`, `src/runner/actions.test.ts`, `src/runner/brief.test.ts`, `src/runner/facts.test.ts`, `src/runner/replay/harness.test.ts`, `src/runner/session.test.ts`, `src/runner/tools.test.ts`. Result: `Test Files 1 failed | 21 passed (22)`, `Tests 45 failed | 444 passed (489)`. All 45 failures are in `src/commands/guardrails.test.ts`, and they are not caused by this slice:
- With this slice's changes stashed, the same file failed the same 45 cases.
- Each one fails on a push in a temporary test repository, refused by this container's own push guard: "Refused: this run may push only to `timone/217-1-a-takeover-waits-for-the-running-step`, and this push goes to `refs/heads/main`."
- `dist/` was missing in this container, so `src/cli.test.ts` and `src/daemon/session.test.ts` failed at first, with the same failures with the changes stashed. I ran `npm run build` (`dist/` is gitignored), and both then passed.

**What 51c must know.**

- The wait loop is now `watchForHandOver(target, hold, deps, stop)` in `src/commands/takeover.ts`. It returns the claimed run, or `undefined` when Ctrl-C stopped it. 51c's two new exits (no live daemon holds the lock any more, and the run moved on) need a result type with more than these two answers. `waitForHandOver` turns the answer into a `Claim`, and it is the place to print 51c's sentences, after the handlers are taken off.
- The stop is checked after each sleep. A lock check or a "moved on" check added at the top of each look runs before the stop is seen.
- After the request settles, `claimForTakeover` checks in this order: this terminal's own `waitingTerminal` (wait), another terminal's `waitingTerminal` on an `active` run ("another terminal", exit 1), then `status !== "active"` (the "did not hand over" sentence), then a claim. An `active` run held by another terminal's session (`takenOver`, no `waitingTerminal`) still falls through to "claimed" here. `findTakeover` answers that case with "I'm working on …" before any request is left, so only a race reaches it today. The "open in another terminal" sentence goes in `findTakeover` (`active` and `takenOver`) and probably in this check too.
- Ctrl-C while the command waits for the daemon to read the request (`waitUntilSettled`) still ends the process with Node's default handler. Only the wait for the step has handlers.
- `takeoverAbandoned` wakes the runner with an empty list of events when the record has no end for the run's step. That cannot happen through the wait, since the step's end is written before the hand-over, but a later change could make it happen. A refactor I would make at the review: `terminalEnded` and `takeoverAbandoned` differ only by one event, so they could share a private helper.

## 51c — When no step can end, the takeover says so and does not wait

**Built.** With no daemon holding the ledger, a takeover of a run whose step runs is refused with the reason: "A step shows as running on <project> #<n> (<step>), but no daemon is running, so it cannot end and I won't wait for it. Start the daemon with `timone daemon`; it gives the run back to the runner, and then you can run this again." Exit code 1, and nothing is written. A terminal that waits for a step now stops in two more ways. On each look it asks the ledger lock; if it gets the lock, no daemon holds the ledger, so it gives the lock back at once and says "The daemon stopped, so the step on <project> #<n> cannot end. I've stopped waiting, and nothing changed." (exit 1). When the run is no longer `active` with this terminal as its waiter, and is not claimed for it, it says "<project> #<n> moved on while I waited: it is now <status>. I've stopped waiting, and nothing changed." (exit 1). A run that is `active` and `takenOver` is answered on both roads with "<project> #<n> is open in another terminal: <command> (pid <pid>). Only one session can hold a ticket at a time." (exit 1), before any request is left. "I'm working on … right now" is now said only for a `picked-up` run.

**Files touched.**

- `src/commands/takeover.ts` — `refusalOf` gives the "no daemon" sentence for `wait-for-step` (used by the lock-free road and by `takeover()` with no state path). `findTakeover` answers an `active`, `takenOver` run with the new `heldElsewhereMessage`. `watchForHandOver` returns a `WatchEnd` union (`handed`, `stopped`, `moved-on`, `daemon-stopped`), and `waitForHandOver` prints the sentence for each. New `noDaemonHolds(statePath)`: takes the lock and releases it, or says no. New `isClaimedFor(run, hold)`, which `claimedFor` now uses.
- `src/commands/takeover.test.ts` — five new cases (below) and two existing cases changed (below).

**Decisions taken inside the slice.**

- **A run counts as moved on only when two looks in a row see it so.** The step's end parks the run and then claims it for the terminal in two separate writes to the ledger file (`parkForRunner`, then `handToWaiter` in `src/runner/driver.ts`). The terminal is another process and can read the file between the two writes. It would then see a parked run with no waiter, say "moved on", and exit, and the claim would land for a terminal that had gone (the driver does not wake the runner after a hand-over). The plan did not see this. A test at the command's seam shows it ("does not count a run as moved on when it is seen between …").
- **Each look asks the lock first, then reads the ledger.** A daemon writes its claim while it holds the lock, so once this terminal gets the lock, any claim made for it is already on disk and is opened rather than left behind. No test at the seam can see this order: the fake daemon acts only inside the injected `sleep`, between looks.
- The lock check uses the same stale bound as the other takeover lock calls (four progress intervals). A daemon that stops cleanly is seen on the next look. A daemon that crashed is seen once its lock has gone quiet for two minutes and its process is gone, as `acquireStateLock` judges. An unreadable lock keeps the wait going, as the plan says ("any other answer").
- "Moved on" names the status of the ticket's latest run (`runsForTicket(...).at(-1)`), as `claimedFor` reads it, and "gone from the ledger" when there is none, as `endTakeover` does.
- The "daemon stopped" and "moved on" exits write nothing. The `waitingTerminal` the daemon wrote stays on the run; the step's end clears it (51b's `liveWaiter`) or the run leaving `active` does.
- An `active`, `takenOver` run with no holder (claimed by a build before holders) gets the sentence without the holder part: "<project> #<n> is open in another terminal. Only one session can hold a ticket at a time." The plan has no words for this case. The sentence does not check whether the holder's process is alive; the plan did not ask for it.
- `takeover()` (no state path, the resolution tests' shape) also gives the "no daemon" sentence, since it shares `refusalOf` and asks no daemon.

Existing cases changed (both in `src/commands/takeover.test.ts`, both marked ✏ in the file):

- "starts nothing for a run picked up or at work, says it is being worked on, and leaves it as it was" looped over `picked-up` and `active` and expected "I'm working on …" for both, on the lock-free road. Case 1 requires the "no daemon" sentence for `active`, so it is now "starts nothing for a run just picked up, says it is being worked on, and leaves it as it was", for `picked-up` only. Its assertions are otherwise the same. It is the test that shows the "working on" sentence is still given for a `picked-up` run.
- "refuses the takeover of a ticket whose own step is running, in the words it always used (R13 clause 3)" expected "I'm working on …" for an `active` run on the lock-free road. It is now "refuses the takeover of a ticket whose own step is running when no daemon runs, and says why (R13 clause 3)", and expects the "no daemon" sentence; the run has no stage, so the step reads "the step that is running" (51a's `runningStepOf`). The refusal, the exit code and the unchanged run are still asserted.

**Validation evidence.**

Case 1 — "a takeover typed while the ticket's step runs (ADR-0067) > says no daemon runs to end the step, waits for nothing, and writes nothing (PRD-09.R4 clause 4)". The run is `active` at `planning`, the lock is free, and the injected `sleep` throws. Red: `Tests 1 failed | 56 skipped (57)`, `- "A step shows as running on scratch-app #6 (preparing the work), but no daemon is running, …"`, `+ "I'm working on scratch-app #6 right now. Anything I need from you will land on the ticket."`. After the change, the two existing cases above failed (`Tests 2 failed | 55 passed (57)`); after they were changed: `Tests 57 passed (57)`.

Case 2 — "… > stops waiting, and says why, when the daemon stops during the wait (ADR-0067 D3)". The fake daemon releases its lock on its third look. Red: `Error: the wait went on after the daemon stopped`, `Tests 1 failed | 57 skipped (58)`. Green: `Tests 58 passed (58)`. It asserts exit 1, the sentence, no launcher call, no lock file left, no request left, and the run still `active` on the step's session.

Case 3 — "… > stops waiting, and names where the run went, when it is cancelled during the wait (ADR-0067 D3)". The fake daemon cancels the run on its third look. Red: `Error: the wait went on after the run was cancelled`, `Tests 1 failed | 58 skipped (59)`. Green: `Tests 59 passed (59)`.

Case 3, the write between park and claim — "… > does not count a run as moved on when it is seen between the step's end and its claim for the terminal (ADR-0067 D2)". The fake daemon parks the run on its third look and claims it for the terminal on its fourth. Red (with case 3's first implementation): `AssertionError: expected 1 to be +0`, `Tests 1 failed | 59 skipped (60)`. Green with the two-look rule: `Tests 60 passed (60)`; case 3 stays green.

Case 4 — "… > names the other terminal that holds the ticket, with or without a daemon, and asks the daemon nothing (ADR-0067 D4)". One test, two roads in a loop: lock free, and a fake daemon holding the lock; the injected `sleep` throws. Red (the no-daemon road comes first): `- "scratch-app #6 is open in another terminal: timone takeover scratch-app#6 (pid 7100). Only one session can hold a ticket at a time."`, `+ "I'm working on scratch-app #6 right now. …"`, `Tests 1 failed | 60 skipped (61)`. Green: `Tests 61 passed (61)`. Because the red run stopped at the first road, the daemon road was shown red by a probe: the old answer put back and the loop cut to `["daemon"]` gave `expected { road: 'daemon', code: 1, …(1) } to deeply equal …`, `Tests 1 failed | 60 skipped (61)`; both restored: `Tests 61 passed (61)`.

Validation block:

```
npx tsc --noEmit; echo "exit: $?"
  exit: 0
npx vitest run src/commands/takeover.test.ts src/daemon/poll.test.ts; echo "exit: $?"
  Test Files  2 passed (2)
       Tests  181 passed (181)
  exit: 0
grep -n "working on .* right now" src/commands/takeover.ts | grep -v '^\s*[0-9]*:\s*//'; echo "exit: $? …"
  252:    `I'm working on ${target.project} #${target.ticket} right now. ` +
  exit: 0
```

- Checkbox 1 (cases 1–4 pass, with red runs recorded): pass. Each case went red before its change.
- Checkbox 2 (the "I'm working on …" sentence is reachable only for a `picked-up` run; a test shows it, and none shows it for `active`): pass. `workingOnMessage` has one caller, the `picked-up` branch of `findTakeover`. Tests that show it: "resolveTakeover > says it is working on a ticket just picked up, where no step runs yet", "… picked up while another run is parked on its branch" (both in `resolveTakeover` and `runTakeover`), and the changed "starts nothing for a run just picked up, …". No test in `src/commands/takeover.test.ts` expects it for an `active` run; the reds of cases 1 and 4 are what the old answer for `active` gives.

Other test files run at the end (the files that import `src/commands/takeover.ts` are `src/cli.ts`, `src/daemon/poll.ts`, `src/planner/plan-files.test.ts`): `npx vitest run src/cli.test.ts src/planner/plan-files.test.ts src/daemon/poll.test.ts` gave `Test Files 3 passed (3)`, `Tests 131 passed (131)`. `src/commands/guardrails.test.ts` was not run.

**What 51d must know.**

- 51c made no change to the runner, the driver or the store. A run that is `active` and `takenOver` is still only refused by the takeover command; `start_step` in `src/runner/actions.ts` does not yet refuse it.
- `src/daemon/poll.ts` still has its own "I'm working on … right now" sentence, for a `claim-takeover` request with no holder that finds a running step (51a's decision). It reaches only the daemon's log. The checkbox's grep covers `src/commands/takeover.ts` only.
- One race is left in `claimForTakeover`, after the request settles: an `active` run that another terminal took between this terminal's `findTakeover` and the daemon's read of the request still falls through to "claimed", and this terminal would open a session on it. `findTakeover` refuses that run before any request is left, so only that short window reaches it. The plan did not ask for a check there, and none was added.

## 51d — The runner starts no step on a run a person's terminal holds

**Built.** `start_step` is refused when the run, read from the store at the moment of the try, is `active` and `takenOver`. The refusal says: "A person has this ticket open in a terminal. Start nothing until the terminal session ends; you are woken then." The check is the first one in `stepBlocked`, so the approval's own step (`recordApproval`) meets it too, before its `approval` entry is written. Nothing is written before the refusal except the decision entry `decided` writes. No place is asked, no branch is claimed, the stage is not set, and no step is started. Once the run is parked again, `start_step` starts the step as before.

**Files touched.**

- `src/runner/actions.ts` — new constant `TERMINAL_HOLDS_RUN`. `stepBlocked` reads `current()` first and returns the refusal for an `active`, `takenOver` run. Its comment says why the store is read and not the run the wake was given.
- `src/runner/actions.test.ts` — `placeWorld` returns a `record()` reader (the same one `world` has). New `TERMINAL_HOLDS` and `TERMINAL` (a holder with this test process's pid). New describe "the runner starts no step on a run a person's terminal holds (ADR-0067 D4)" with the two cases below. No existing case changed.

**Decisions taken inside the slice.**

- The cases use `placeWorld`: the run is parked when the actions are built, as a wake finds it, and its step starter claims and activates the run as `startStepSession` does. The claim for the terminal is made after the actions are built, which is "after a wake began".
- The check does not ask whether the terminal's process is alive. The plan asks only for `active` and `takenOver`. A run held by a gone terminal is still refused until the daemon gives it back.
- Case 2 also tries once while the terminal holds the run, then parks it and tries again with the same actions. Without that first try, no wrong implementation I could write made case 2 fail (see the mutations below).

**Validation evidence.**

Case 1 — "the runner starts no step on a run a person's terminal holds (ADR-0067 D4) > refuses a step on a run claimed for a terminal after the wake began, and changes nothing but the record". It asserts the refusal, no step started, the run still `active` and `takenOver` with the same stage and place and no branch, no comment, and a record of exactly the triage step and the refused `start_step` decision. Red:

```
AssertionError: expected { ok: true, …(1) } to deeply equal { ok: false, …(1) }
-   "ok": false,
-   "refused": "A person has this ticket open in a terminal. Start nothing until the terminal session ends; you are woken then.",
+   "ok": true,
+   "said": "Started preparing the work, in session session-1. You are woken when it ends.",
Tests  1 failed | 70 skipped (71)
```

Green: `Tests 71 passed (71)`.

Case 2 — "… > starts the step as before once the terminal session has ended and the run is parked again". This is today's behaviour, so it could not go red. With the new check turned off (`if (false && …)`), case 2 passed and case 1 failed (`Tests 1 failed | 1 passed | 70 skipped`). Mutations:

- Refuse when the run's `updatedAt` differs from the wake's run: both cases passed. The claim and the park land in the same millisecond, so the parked run looks untouched. This is why case 2 now tries once while the terminal holds the run.
- Read the run once and keep it (`heldOnce ??= current()`): case 2 failed with `expected { ok: false, …(1) } to match object { ok: true }`, `Tests 1 failed | 1 passed | 70 skipped (72)`. Reverted: `Tests 72 passed (72)`.

Validation block:

```
npx tsc --noEmit; echo "exit: $?"
  exit: 0
npx vitest run src/runner/actions.test.ts; echo "exit: $?"
  Test Files  1 passed (1)
       Tests  72 passed (72)
  exit: 0
```

- Checkbox 1 (cases 1–2 pass, with red runs recorded): pass. Case 1 went red before the change. Case 2 could not go red; the mutation above shows it is not empty.
- Checkbox 2 (every existing case of `actions.test.ts` passes unchanged): pass. No existing case changed. The only change to existing code in the test file is the `record()` reader added to `placeWorld`'s return.

Other test files run at the end (test files of the code that imports `src/runner/actions.ts`, and of the modules that use those): `npx vitest run src/commands/daemon.test.ts src/commands/record.test.ts src/commands/takeover.test.ts src/daemon/poll.test.ts src/planner/actions.test.ts src/planner/driver.test.ts src/planner/session.test.ts src/runner/driver.test.ts src/runner/session.test.ts src/runner/tools.test.ts src/runner/replay` gave `Test Files 11 passed (11)`, `Tests 317 passed (317)`. `src/commands/guardrails.test.ts` was not run (it fails in this container because of the push guard, as 51b recorded).

**What 51e must know.**

- The runner's refusal sentence is in `TERMINAL_HOLDS_RUN` in `src/runner/actions.ts`. It applies to `start_step` and to `record_approval`'s own step. The other actions (`post`, `end_run`, and the rest) are not refused while a terminal holds the run; the plan did not ask for that.
- The refusal is written in the ticket's record as a `decision` entry with `detail: "Refused: <sentence>"`, as every refused action is. It posts nothing on the ticket.
