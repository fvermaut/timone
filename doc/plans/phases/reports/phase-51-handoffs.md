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
