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

## 40b — who may instruct, which driver, the limit — and the forge calls the runner needs

**Built.** The manifest takes a top-level `operator` (the operator's forge login) and, per project, `driver` (`daemon` or `runner`), `instructors` (at least one login when present) and `ticket_limit_usd` (more than 0). A project with `driver: runner` and neither `instructors` nor `operator` is refused with `project "<name>": it is driven by the runner, but names nobody who may instruct it. Add "instructors" to the project, or "operator" at the top of the manifest.` Three helpers: `driverOf(config)` (default `daemon`), `namedPeople(manifest, name)` (the project's `instructors`, else `[operator]`, else `[]`), `ticketLimitOf(config)` (default `DEFAULT_LIMIT_USD` from `src/runner/limit.ts`). The ticketing port and the GitHub adapter gained the five planned calls: `removeLabel`, `createIssue`, `getPullRequestBody`, `setPullRequestBody`, `aheadOfDefault`. `setPullRequestBody` passes the body in a temporary file (`--body-file <path>`), not on stdin: the injected `CommandRunner` cannot pass stdin, and the orchestrator chose a file over widening it (the plan is amended under 40b, and the change is recorded in `phase-40-departures.md`).

**Files touched.**

- `src/manifest.ts` — the four keys, the refusal (a `superRefine` on the whole manifest), `Driver`, `driverOf`, `namedPeople`, `ticketLimitOf`.
- `src/manifest.test.ts` — one new `describe` with seven tests.
- `src/adapters/ticketing.ts` — five methods on `TicketingAdapter`, each with its reason.
- `src/adapters/github-tickets.ts` — the five methods; `createStep`'s url parsing moved into a private `createdIssueNumber` that `createIssue` shares (its error text is unchanged).
- `src/adapters/github-tickets.test.ts` — one new `describe` with nine tests; five lines added to the list in "names a repository in every argument vector it builds".
- `src/adapters/ticketing.stubs.ts` — `noRunnerCalls`: the five methods, each throwing.
- `src/commands/daemon.test.ts`, `guardrails.test.ts`, `retry.test.ts`, `takeover.test.ts`, `src/daemon/hooks.test.ts`, `poll.test.ts`, `session.test.ts` — only added lines: `noRunnerCalls,` in the stubs import and `...noRunnerCalls,` after each `...noMerges,` in the 29 doubles the compiler named. No line removed or changed (`git diff … | grep '^-'` is empty). `github-pulls.test.ts` needed nothing: it uses the real adapter.

**Decisions taken inside the slice.**

1. **`instructors: []` is refused** (`must name at least one person`), for any driver. An empty list would replace the operator with nobody, which is the refused case written another way.
2. **The refusal lives on the whole manifest**, because it needs the top-level `operator`. Its path is `["projects", name]`, so the existing formatter prints `project "<name>": …`. `addProject` and `updateProject` go through `parseManifest`, so they refuse it too.
3. **`ticket_limit_usd`** is any number above 0, not only whole dollars.
4. **`namedPeople` returns logins as written, in a new array.** For a name that is not a project it falls back to the operator; it does not throw.
5. **`createIssue` adds no label itself**, the mark included. Each label is its own `--label` argument.
6. **`aheadOfDefault`** makes two calls: `readBranches(p)` for the default branch's name, then `gh api repos/<slug>/compare/<default>...<branch> --jq .ahead_by` with `{ repository: slug }`. The answer goes through `z.number().int().nonnegative()`. Only `(HTTP 404)` reads as undefined; any other failure is thrown. The branch name is not URL-encoded: a read-only call on 2026-09-27 showed `compare/main...timone/165-the-runner-beside-the-current-daemon` answering `4`, and a missing branch failing with `gh: Not Found (HTTP 404)`.
7. **`noRunnerCalls` throws for the reads too**, unlike `noBranches` and `noFiles`. Nothing in the daemon calls these methods, so there is no earlier answer to keep.
8. **`setPullRequestBody`** makes a fresh directory with `mkdtemp(join(tmpdir(), "timone-pr-body-"))`, writes the body to `body.md` in it, runs `gh pr edit <n> --repo <slug> --body-file <path>`, and removes the directory in a `finally`. The write is inside the `try`, so a failed write removes the directory too. A refusal from the forge is thrown, as in the other methods. The body is not stamped with the machine marker: a description is not a comment.
9. **Three extra manifest tests and one extra adapter test** beyond the six cases, at the same seams, for things the plan names but no case covered: a project's own limit, a limit of 0, an empty `instructors`, and a dropped connection on the compare.

**Validation evidence.** Red before green, one test at a time:

- (1) "refuses a project driven by the runner when nobody is named to instruct it" — red: `Received: "Invalid manifest: project "client-alpha": unknown key "driver"`; green.
- (2) "reads a project that sets none of the three as daemon-driven, limited to $150, and instructed by the operator" — red: `TypeError: (0 , driverOf) is not a function`; green with each helper returning only its default.
- (3) "names only the project's own instructors when it has some, and not the operator beside them" — red: `expected [ 'fvermaut' ] to deeply equal [ 'alice-client', 'bob-client' ]`; green.
- (4) "refuses a misspelled list of instructors rather than falling back to the operator" — green on arrival, because the project schema was already strict. Mutation: `z.strictObject` → `z.object` for the project schema fails it with `expected [Function] to throw an error`; restored, it passes.
- Extra: "uses a project's own limit of $80 in place of $150" — red: `unknown key "ticket_limit_usd"`; green.
- Extra: "refuses a limit of $0, which would let no session start at all" — red: `expected [Function] to throw an error`; green (`field "ticket_limit_usd": must be more than 0`).
- Extra: "refuses an empty list of instructors, which names nobody in place of the operator" — red: `expected [Function] to throw an error`; green.
- (5) "takes a label off an issue" — red: `removeLabel is not a function`; green.
- (5) "opens an issue with each label as its own argument, and answers its number" — red: `createIssue is not a function`; green. `createStep`'s "refuses a create whose answer is not an issue url" still passes on the shared parser.
- (5) "reads a pull request's body as it stands on the forge" — red: `getPullRequestBody is not a function`; green.
- (5) "counts the commits on a branch that the default branch the forge names does not have" (default branch `trunk`) — red: `aheadOfDefault is not a function`; green.
- (6) "answers undefined for a branch the forge does not know, and does not call that an error" — red: the 404 was thrown, `… failed: gh: Not Found (HTTP 404)`; green with a catch that returned undefined for every failure.
- Extra: "reports a dropped connection, and never renders one as a missing branch" — red: `promise resolved "undefined" instead of rejecting`; green once only `(HTTP 404)` reads as undefined.
- (5) "hands gh the new description in a file that holds exactly the body" (the fake runner reads the file while the command runs; the body holds `` `$(date)` ``, quotes, and about 20 KB of lines) — red: `setPullRequestBody is not a function`; green with a method that wrote the file and ran `gh`, and removed nothing.
- (5, cleanup) "leaves no file behind once the description is replaced" — red: `expected true to be false` (the directory was still there); green with the directory removed after the call.
- (5, cleanup) "leaves no file behind when the forge refuses the edit, and lets the refusal travel" — red: `expected true to be false` (the refusal was thrown, and the directory stayed); green once the write and the call moved into a `try` and the removal into `finally`.
- The scoping test with the five new methods passed on arrival. Mutation: dropping `--repo` from `removeLabel` fails it with `unscoped:`; the same for `setPullRequestBody` fails it with `unscoped: pr edit 9 --body-file /var/folders/…/timone-pr-body-7mpM`; restored, it passes.
- The red runs before the `finally` existed left three `timone-pr-body-*` directories in the system temporary folder. They were removed, and after the full suite there are none.

```
$ npx tsc --noEmit; echo "exit: $?"
exit: 0
$ npx vitest run src/manifest.test.ts src/adapters/; echo "exit: $?"
 Test Files  7 passed (7)
      Tests  236 passed (236)
exit: 0
$ node dist/cli.js projects list >/dev/null 2>&1 || npx tsx src/cli.ts projects list; echo "exit: $?"
exit: 0
$ npx tsx src/cli.ts projects list                      # the working tree's code, not the old dist/
scratch-app  projects/scratch-app  …  github  docker  no
ivtrends     projects/ivtrends     …  github  docker  no
timone       projects/timone       typescript  github  -  no
$ npx tsx src/cli.ts projects list --manifest /Users/fvermaut/dev/timone/timone.yaml
(the same three rows; exit 0)
$ npx vitest run
 Test Files  46 passed (46)
      Tests  1747 passed (1747)
```

- [x] The real `timone.yaml` still parses unchanged: this checkout's and the harness root's, with the working tree's code; `git diff -- timone.yaml` is empty; the four "Timone is in its own manifest" tests pass.
- [x] Red→green evidence is above.

**What 40d/40e/40f must know.**

- **Manifest:** `operator?: string`; per project `driver?: "daemon" | "runner"`, `instructors?: string[]` (at least one), `ticket_limit_usd?: number` (above 0). `driverOf(config): Driver`, `namedPeople(manifest, name): string[]`, `ticketLimitOf(config): number`. Pass `ticketLimitOf(config)` as the `base` of `allowanceOf` and `isOverLimit`. `manifest.ts` now imports `DEFAULT_LIMIT_USD` from `src/runner/limit.ts`, which imports only a type.
- **Comparing logins is still to do.** GitHub logins are case-insensitive, and an App's login comes back with or without `[bot]` depending on the surface. `ticketing.ts` already handles the second inside `isFromTimone` (`sameLogin` and `bareLogin` are private).
- **Adapter:** `removeLabel(p, n, label)` throws on any `gh` failure (what `gh` does for a label the repository does not have was not checked). `createIssue(p, {title, body, labels}) → number` adds no label: pass `MARK_LABEL` when the issue is for the machine to work. `getPullRequestBody(p, n) → string`, verbatim. `setPullRequestBody(p, n, body)` replaces the whole description with `body`, verbatim and unstamped: read it first and keep what a person wrote. It writes one temporary file per call and always removes it. `aheadOfDefault(p, branch) → number | undefined`: `0` means the branch exists and holds nothing new; `undefined` means a 404; a dropped connection throws.
- **Any new hand-written `TicketingAdapter` double** must spread `noRunnerCalls` from `ticketing.stubs.ts`.
- `timone.example.yaml` does not show the new keys yet. It was not in this slice's files.
- `dist/` is an old build, so the first half of the third validation command runs old code. It passes because today's `timone.yaml` uses none of the new keys.
