# Phase 40 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6. 40a and 40c ran in parallel; 40c finished first and is committed first.

## 40c — the run record, the default order, the departures and the limit

**Built.** The run record is a zod-checked JSONL file per ticket at `.timone/records/<project>/<ticket>.jsonl`, with an append function and a reader that returns a result. A bad line returns an error naming its line number (from 1); a missing file reads as an empty list. There is a written default order for each of the nine ticket kinds. `departuresOf` works out each step of the order that did not run, or ran out of order, and takes the runner's reason from the latest `departure` entry that names the step. `departureSection` writes the pull request's block between two HTML-comment markers, with a skipped check as its first line, "The default order was followed." when there are none, and "No reason given." for a missing reason. The limit is counted per ticket: `spentOn` adds every step and runner cost across all runs, `allowanceOf` gives base × (1 + number of raises), and `isOverLimit` is true once spent ≥ allowance.

**Files touched.**

- `src/runner/record.ts` — created
- `src/runner/order.ts` — created
- `src/runner/departures.ts` — created
- `src/runner/limit.ts` — created
- `src/runner/record.test.ts` — created
- `src/runner/departures.test.ts` — created
- `src/runner/limit.test.ts` — created

**Decisions taken inside the slice.**

- **An order step is a union.** A stage step `{id, label, stage, check?: true}` or an approval step `{id, label, approval}`. It still reads as the plan's `{id, label, stage?, check?, approval?}`, but a step with both a stage and an approval cannot be written.
- **Step ids** are the stage names, plus `"requirements-approval"` and `"pieces-approval"`. Labels come from `stageLabel`; the approvals read "your approval of the requirements" and "your approval of the list of pieces".
- **Re-runs.** Only the first time a step ran decides whether it was out of order, so building again after the check (a fix round) is not a departure.
- **Reasons.** A blank reason renders as "No reason given.", the same as a missing one.
- **Record errors.** `appendEntry` parses the entry first and throws on a bad one (a caller's bug); file errors throw, as the ledger's writes do. `readRecord` returns `{ ok: false, error: { line, message } }` for a line that is not JSON or fails the schema.
- **Limit base** is a required argument: the caller passes the project's limit or `DEFAULT_LIMIT_USD`, so no path can forget a project's own limit.
- **Loose fields.** `at` is a plain string, as in `runs.ts`. `woke.events` is `string[]`. `decision.action` and `step-ended.stoppedBy` are free strings, owned by later slices. `departure.skipped` is a non-empty array of step ids.
- **Section layout.** Start marker; the check line when the check was skipped; a blank line; **"Steps that did not follow the default order:"** with one bullet per other departure; end marker. On GitHub the marker is hidden, so the check line is the first line a person reads.

**Validation evidence.** Red before green, one case at a time, at the declared seams:

- (9) "reads an appended entry back equal to what was written" — red `Cannot find module './record.js'`, then green.
- (8) "names the line number when a line does not match the entry schema" — red: a `ZodError` was thrown instead of returned; then green.
- Extra (orchestrator's design note): "reads a ticket with no record yet as an empty list" — red `ENOENT`, then green.
- (1) "opens with a line saying the work was not checked, with the runner's reason, when the check did not run" — red `Cannot find module './departures.js'`, then green.
- (2) "lists the interview and the approval of the requirements, each with the runner's reason, when neither ran" — red: the bullet was missing; then green.
- (3) "says the default order was followed when every step ran in order" — red: empty block; then green.
- (4) "still lists a departure the runner gave no reason for" — red: it printed "Reason: undefined"; then green.
- Extra (the plan's text for `departuresOf`): "lists a step that ran only after a later step had already run as out of order" — red, then green.
- Extra: "does not list building again after the check as a departure" — green on arrival (the guard was written with the out-of-order change). Mutation check: removing the `reached.has(index)` guard makes it fail with `expected [ { kind: 'out-of-order', …(2) } ] to deeply equal []`; restored, it passes.
- (5) "adds the cost of every step and every runner session, across two runs of the ticket" (0.75 + 12.5 + 1 + 30.25 = 44.5) — red `Cannot find module './limit.js'`, then green.
- (6) "puts a ticket over its limit at $150 spent, but not at $149.50" and "allows $300 once a named person has said continue" — red `is not a function` each, then green.
- (7) "uses a project's own limit of $80 in place of $150" — green on arrival, because `allowanceOf` takes `base`. Mutation check: replacing `base` with `DEFAULT_LIMIT_USD` inside it fails the test; restored, it passes.

```
$ npx tsc --noEmit; echo "exit: $?"
exit: 0
$ npx vitest run src/runner/; echo "exit: $?"
 Test Files  3 passed (3)
      Tests  13 passed (13)
exit: 0
```

The full suite showed 6 failures, all in `src/daemon/session.test.ts`, which 40a was editing at the same moment. Nothing outside `src/runner/` imports this slice's files, so it cannot cause them.

- [x] `departureSection` output for case (1):

```
<!-- timone:departures -->
**Not checked.** No session other than the one that built this work checked it. Reason: The change only fixes a spelling mistake in the README.
<!-- /timone:departures -->
```

- [x] Red→green evidence is above.

**What 40d/40e must know.**

- `record.ts`: `recordEntrySchema` (zod discriminated union on `kind`); `RecordEntry = z.infer<…>`. Every entry has `at: string`; `runId` is on woke, runner-ended, decision, step-started, step-ended, departure and approval. `appendEntry(dir, project, ticket, entry): void` — `dir` is the Timone root, the caller supplies `at`. `readRecord(dir, project, ticket)` → `{ok: true, value} | {ok: false, error: {line, message}}`.
- `order.ts`: `TICKET_KINDS`, `TicketKind`, `Approval = "requirements" | "pieces"`, `OrderStep`, `defaultOrder(kind)`. The ids a `departure.skipped` must use are the stage names plus `"requirements-approval"` and `"pieces-approval"`.
- `departures.ts`: `DEPARTURES_START`, `DEPARTURES_END`, `Departure`, `departuresOf(entries, runId, order)` (judges only steps before the furthest reached), `departureSection(departures)` (no trailing newline; must sit at the top of a body to be its first line).
- `limit.ts`: `DEFAULT_LIMIT_USD = 150`, `spentOn`, `allowanceOf(entries, base)`, `isOverLimit(entries, base)`. The manifest's per-project limit is 40b's.

## 40a — one step session, started and watched outside the spawner

**Built.** `startStepSession(deps, input)` in `src/daemon/step-session.ts` is now the one place a session is started and watched. It takes a hold, claims the run if it is parked, calls `runtime.start`, activates the run with the session id and holder, logs the "session started" line, then starts the ticker; each tick stamps the heartbeat and logs a progress line; when the session ends the ticker stops and the cost line is logged. A start that throws on a parked run puts it back on its wait and rethrows. It returns `StepSession { sessionId; completed: Promise<StepResult>; progress?; stop(); send? }` with `StepResult = { outcome; summary? }`. `mergeChunkZero`, `openStepTickets` and their helpers moved to `src/daemon/chunk-zero.ts` with explicit dependencies and unchanged behaviour. `AgentSessionSpawner` calls both modules, and the daemon's log output is identical, line order included.

**Files touched.**

- `src/daemon/step-session.ts` — created.
- `src/daemon/step-session.test.ts` — created, the five declared cases.
- `src/daemon/chunk-zero.ts` — created: `mergeChunkZero`, `attemptMerge`, `openStepTickets`, and the helpers `stepTitle`, `stepBody`, `initiativeMap`, moved word for word with `this.options`/`this.log` turned into `deps`.
- `src/daemon/session.ts` — `startClaimed` calls `startStepSession`; `watch` only keeps the `running` map; `stop(runId)` is `this.running.get(runId)?.stop()`; `recordApproval` calls the chunk-zero functions; the moved code and its unused imports are gone.

**Decisions taken inside the slice.**

1. **`announce?: (sessionId) => string` on the input.** The "session started" line (and the approval path's `record … approved …` line) must be logged after activation and before the first tick, or the real ticker, which ticks at once, prints a `work` line first. A scratch script run against `HEAD` and against the working tree gave identical output on both paths. No existing test guards this line.
2. **`stop()` is always present**, and the three stop log lines moved into it with the same text and order, so the spawner still tells a runtime that cannot stop from one that can.
3. **`ticker`, `progressIntervalMs` and `log` are required deps**, so `step-session.ts` does not import `intervalTicker` from `session.ts`. The holder command stays `timone daemon <runId>`.
4. **`send?` is declared and no runtime provides it yet** (40d's).
5. **Chunk-zero contracts are unchanged.** `attemptMerge(deps, project, branch)` is exported too, because `session.test.ts` reaches the spawner's private `mergeChunkZero` and `attemptMerge` by name; those two stay as one-line private delegators.
6. **Two import cycles, the first in the codebase:** `session.ts` ↔ `step-session.ts` (for `waitOf`) and `session.ts` ↔ `chunk-zero.ts` (for `failedComment`, `mergeMessage`). Safe, because no name is read while the modules load; each new module was loaded first and called to check. To remove them later: move `waitOf` and `mergeMessage` out of `session.ts` with re-exports. Left for the delivery review, as refactoring is.
7. **One difference not reachable in practice:** a throw from the first tick now surfaces inside the start, where the spawner's first-attempt catch would put an active run back to picked-up. `heartbeat` throws only for an unknown run id, and the run was activated just before.

**Validation evidence.** The five cases, each red first:

1. "activates the run with the runtime's session id, held by this process" — red `Error: not built`, then green.
2. "stamps the run's heartbeat on every tick of the ticker it was given" — red `the ticker was never started`, then green.
3. "finishes with how the session ended and what it cost" — red: summary with `costUsd: 1.87` missing; then green.
4. "ends the runtime's session when it is told to stop" — red `expected +0 to be 1`, then green.
5. "puts a parked run back on the same wait when its session fails to start" — also reads the status while the start is in flight. Red `expected 'parked' to be 'active'` (no claim), then red `expected 'active' to be 'parked'` (claim alone), then green with the re-park.

The delegation turned six existing `session.test.ts` tests red (tick lines, cost line, ticker stop, heartbeat during a wait, cancel with a runtime that cannot stop); all six went green once the tick lines, cost line, ticker stop and stop lines moved. The chunk-zero move cannot go red first, so it was mutated and restored: dropping `store.fail` in `mergeChunkZero` failed 3 tests; dropping the map label in `openStepTickets` failed 1; bypassing the adapter in `attemptMerge` failed 1; restored, 161/161 pass and the diff is clean.

```
$ npx tsc --noEmit; echo "exit: $?"
exit: 0
$ npx vitest run src/daemon/step-session.test.ts
 Tests  5 passed (5)
$ npx vitest run src/daemon/session.test.ts src/daemon/poll.test.ts
 Tests  372 passed (372)
$ git diff --stat origin/main -- src/daemon/session.test.ts src/daemon/poll.test.ts
(no output)
$ npx vitest run
 Test Files  46 passed (46)
      Tests  1731 passed (1731)
```

- [x] `session.test.ts` and `poll.test.ts` pass with no line changed.
- [x] Red→green evidence for the five cases is above.

**What 40b must know.**

- `startStepSession` needs `{ store, runtime, progressIntervalMs, ticker, log }`, all required: pass `intervalTicker` from `session.ts` and `DEFAULT_PROGRESS_INTERVAL_SECONDS * 1000`. Input `{ runId, request, label, announce? }`.
- Only a parked run is re-parked on a start failure; a picked-up or active run is left for the caller.
- `completed` settles after the ticker has stopped and the cost line is logged.
- `stop()` logs "cancelled, so its session is being ended" and never throws.
- `mergeChunkZero(deps, run, project)` returns `true`, or fails the run, posts `failedComment` and returns `false`. `openStepTickets(deps, run, project)` returns a failure sentence or `undefined`; the caller fails or completes the run.
- Do not remove the spawner's private `mergeChunkZero` and `attemptMerge` while `session.test.ts` must stay unchanged.
