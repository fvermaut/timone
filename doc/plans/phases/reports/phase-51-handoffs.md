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
