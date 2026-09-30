# Phase 40: The runner — an agent decides each step, beside the current daemon

> **Status:** Complete — see [reports/phase-40-complete.md](reports/phase-40-complete.md).

> **Companion phases:** [phase 39](phase-39.md) left `src/daemon/consult.ts`, the one-turn model call with no tools, which this phase reuses to read a reply at the spending limit. [Phase 35](phase-35.md) left the departures record and the rule that a build never stops, which the runner's departures extend to the whole run. No phase shares a slice with this one. Governing decisions: [ADR-0060](../../adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md), which is what this phase builds; [ADR-0013](../../adr/0013-stateless-session-reentry.md), because each wake is a fresh session that works from a record; [ADR-0032](../../adr/0032-a-human-command-asks-the-daemon-to-act.md), because the runner's actions run inside the daemon process and so the daemon stays the ledger's only writer; [ADR-0041](../../adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md), because the steps the runner starts still run in the box; [ADR-0047](../../adr/0047-a-cancel-stops-the-work-it-cancels.md), because `timone cancel` must stop a runner's step and its session; [ADR-0030](../../adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md) D2 as amended by ADR-0060 D2, because chunk zero now merges only on a recorded yes; [ADR-0059](../../adr/0059-a-live-check-only-the-operator-can-run-rides-to-the-pull-request.md) D1, because the watched run this phase owes rides to the pull request if it cannot be run before it.

> **Screens changed:** none — no slice changes anything a person sees on a screen. The runner writes on tickets and pull requests, which GitHub draws.

## Requirements

> **PRD:** [prd-05](../../specs/prd/prd-05-a-runner-decides-each-step.md) — criteria in [prd-05 criteria](../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-05.R1 | MUST | The runner chooses each step, with the written order as its default |
| PRD-05.R2 | MUST | The runner acts only through the actions code gives it |
| PRD-05.R3 | MUST | Nothing reaches a default branch without a yes from a named person |
| PRD-05.R4 | MUST | A run that changed the project's files ends at a pull request |
| PRD-05.R5 | MUST | Code lists every departure on the pull request, and a skipped check comes first |
| PRD-05.R6 | MUST | A departure is posted on the ticket when it happens |
| PRD-05.R7 | MUST | The runner never records an approval nobody gave |
| PRD-05.R8 | MUST | Each ticket has a limit of $150 |
| PRD-05.R9 | MUST | Plain words from a named person move the run |
| PRD-05.R10 | MUST | Only named people can instruct the runner |
| PRD-05.R11 | MUST | `takeover` and `cancel` stay, and `retry` goes — **on runner projects only in this phase** |
| PRD-05.R12 | MUST | The runner wakes on events, and checks every 15 minutes while a step runs |
| PRD-05.R13 | MUST | The runner can send a running step a message, or stop it |
| PRD-05.R14 | MUST | Each wake is a fresh runner session, working from a run record kept by code |
| PRD-05.R15 | MUST | One project's work no longer holds up the others |
| PRD-05.R16 | MUST | A runner that fails is started again, and the run is not failed for it |
| PRD-05.R17 | MUST | A fault in Timone is filed, not fixed |
| PRD-05.R18 | MUST | The runner passes a replay of the recorded failures |
| PRD-05.R19 | SHOULD | Each project runs on the runner or on the current daemon, until every project has moved |

**PRD-05.R11 is split with the next piece.** `timone retry` stays in the code, because ivtrends still runs on the current daemon and needs it. In this phase `retry` refuses on a runner project and says to write on the ticket instead. Deleting the command is [#166](https://github.com/fvermaut/timone/issues/166)'s, with R20.

## Goal Description

Nothing of the runner exists yet. ADR-0060 and PRD-05 were merged on 2026-09-26 in [#163](https://github.com/fvermaut/timone/pull/163), with the list of pieces in [ticket-164.md](../breakdowns/ticket-164.md). This is the first piece: the runner, the rules code keeps around it, and scratch-app switched to it. It is one phase because fvermaut chose fewer, larger pull requests; the cost, named in the breakdown, is that this pull request is large. The slices are cut so that each one is still a working, tested change on its own, and the current daemon keeps working after every one of them: ivtrends runs on it throughout.

**Decisions taken while planning.** None of these reached the ADR bar. Each is reversible in code, sits inside a choice ADR-0060 already made, and is recorded here so the reader knows it was deliberate:

1. **The runner has no tool that reads.** R2 lists its actions exactly. So code gathers everything the runner needs — the ticket, the pull request, the branch's facts, the run record, the open Timone issues — into the text it is given each time it wakes (40f). A wake costs a little more text; no tool can read something code did not choose to show.
2. **Skipping the approval of the list of pieces means the initiative is built as one piece, on its own branch.** No step tickets open and nothing merges. The requirements, the list and the code reach the operator in one pull request, which is R3's "they reach the operator in a pull request". The alternatives — stacking every step's branch on an unmerged one, or a pull request for chunk zero that the steps wait on — were both more code for a rare case, and the second is a stop.
3. **At the limit, the reply is read by a one-turn check with no tools and no actions** — the same kind of call as the ask check (`src/daemon/consult.ts`), costing a fraction of a cent. R8 says no session starts at the limit, and a runner session is exactly what must not start; but someone has to read "go on" in any wording. Recorded as a departure in [phase-40-departures.md](reports/phase-40-departures.md).
4. **A comment is named by its author and its time.** `TicketComment` carries no id (`src/adapters/ticketing.ts`). R3, R7 and R8 need "the comment the approval came from", and the pair is unique on one thread.
5. **A running step's cost is only known when it ends.** The stream a session writes carries `total_cost_usd` only in its final `result`. The 15-minute summary therefore shows the commands, the time and the output so far, and the cost arrives with the step's end. R12 is amended at planning to say so, and the amendment is recorded as a departure.
6. **Only the steps the runner starts use the box's message mode.** Every other session starts exactly as today, so ivtrends is untouched by the change to the box (40d).
7. **The runner decides retries of its steps.** ADR-0034's ladder (60 s, then 5 min) stays on the current daemon's sessions and applies to the runner's own session (R16). It does not wrap the steps the runner starts: whether a failed step is worth another try is now the runner's judgement.
8. **A run on a runner project waits with a new wait kind, `runner`**: it waits for its runner to be woken by an event. The kinds the current daemon reads (`gate`, `conversation`, `review`, `escalation`) keep their meaning, and the compiler finds every place that must handle the new one.
9. **The run record is per ticket**, at `.timone/records/<project>/<ticket>.jsonl`, append-only, written only by the daemon. The limit counts every run of a ticket, so the ticket is the unit.

**What this phase owes before delivery.** R9, R12, R13 and R15 are `live`, and so is the whole point of R19. Sub-phase 40l is a watched run on scratch-app. It needs the operator to start the daemon from his own terminal, because the daemon's model login lives there. If it cannot be run before the pull request, the pull request opens with it listed as owed ([ADR-0059](../../adr/0059-a-live-check-only-the-operator-can-run-rides-to-the-pull-request.md) D1), and ivtrends does not move until it has been run (R19).

**A missing artifact.** Timone has no `doc/standards.md`: it became a managed project in ADR-0050 without an onboarding. This phase follows the central [standards/typescript.md](../../../standards/typescript.md) and [standards/testing.md](../../../standards/testing.md), both `Approved`: states are tagged unions, expected failures return a result, and every model output passes a zod schema before code acts on it.

## Context & Prerequisites

- **`src/daemon/poll.ts`** — `pollProject` (1506) is where a runner project leaves the current path, after the registration loop (1524–1584) and before `openGoAheads`, `resumeAnswered` and the pickup spawn, which all `await` a session inside the cycle (2327, 1625). `reclaimStale` (1167), `applyRequest` (954) and `watchForCancellations` (889) are the three other places a runner project needs its own branch.
- **`src/daemon/session.ts`** — `AgentSessionSpawner`. `startClaimed` (1701) and `watch` (2615) start and watch one session; `mergeChunkZero` (2404) and `openStepTickets` (2321) are private methods the runner needs; `agentSdkRuntime` (2663) is the in-process runtime. `SessionRequest` (202), `StartedSession` (304) and `SessionOutcome` (291, which carries no cost) are the runtime contract.
- **`src/daemon/container-runtime.ts`** — `dockerSpawn` (310) ignores stdin, `runArgs` (643) has no `-i`, and `boxScript` (349–554) pipes `$TIMONE_PROMPT` into `claude -p` (548–552). The installed CLI accepts `--input-format stream-json` (checked on the host with `claude --help`).
- **`src/daemon/progress.ts`** — `SessionProgress` reads cost only from the final `result`, and records no tool calls. `src/daemon/transcript.ts` holds the summariser that turns a tool call into `Bash(npm test)` (`SUMMARY_FIELD`, `summarise`).
- **`src/daemon/runs.ts`** — `RunStore`: `register`, `activate`, `park`, `complete`, `cancel`, `claimBranch`, `recordPullRequest`, `heartbeat`. The wait schema (200–250) and `applyPark` (2103, which refuses an empty `resolvableBy`).
- **`src/adapters/ticketing.ts`, `src/adapters/github-tickets.ts`** — the adapter has no label removal, no general issue creation, no pull-request body read or write, and no compare with the default branch. `TicketComment` is `{author, body, createdAt, fromTimone}`.
- **`src/manifest.ts`** — `projectConfigSchema` is strict; there is no operator login anywhere in the code. `timone.yaml` is tracked in this repository.
- **`src/daemon/prompts.ts`** — `stagePrompt` (398) builds a step's prompt; `approvalRecordPrompt` (826) builds the approval record's.
- **The agent library** — `@anthropic-ai/claude-agent-sdk` 0.3.280: `tools: []` removes every built-in tool; `createSdkMcpServer` with `tool(name, description, zodShape, handler)` gives the session our actions; `settingSources: []` keeps project settings and instructions out; `maxBudgetUsd` bounds one session.
- **Tests** — `src/daemon/poll.test.ts` tests the cycle at `pollOnce` with fakes (`fakeSpawner`, stub adapters in `src/adapters/ticketing.stubs.ts`); `src/daemon/container-runtime.test.ts` tests the box with a fake `ContainerSpawn`. Both are the seams this phase extends.

## Sub-phases

### Sub-phase 40a: one step session, started and watched outside the spawner

**[NEW FILE]** `src/daemon/step-session.ts` — `startStepSession(deps, input)`: what `startClaimed` and `watch` do today for one session. Take a hold, claim the run if it is parked, call `runtime.start`, `store.activate` with the session id and holder, stamp the heartbeat on a ticker, log the progress lines. Returns `StepSession { sessionId; completed: Promise<StepResult>; progress?: ProgressReader; stop(): void; send?(text: string): void }`, with `StepResult = { outcome: SessionOutcome; summary?: SessionSummary }`. A start that throws on a parked run puts it back on its wait and rethrows, as `startClaimed` does.
**[NEW FILE]** `src/daemon/step-session.test.ts`
**[NEW FILE]** `src/daemon/chunk-zero.ts` — `mergeChunkZero(deps, run, project)` and `openStepTickets(deps, run, project)`, moved out of `AgentSessionSpawner` with explicit dependencies (`store`, `adapter`, `breakdownSource`, `mergeProbe`), same behaviour.
**[MODIFY]** `src/daemon/session.ts` — `startClaimed` and `watch` delegate to `startStepSession`; `recordApproval` calls the moved chunk-zero functions. No behaviour changes.

**Seams under test (TDD):** `startStepSession` is the seam: the one place a session is started and watched, which both the current spawner and the runner will call. Red-green: (1) it activates the run with the runtime's session id and a holder; (2) it stamps a heartbeat on each tick of an injected ticker; (3) `completed` resolves with the outcome and the progress summary, cost included; (4) `stop()` calls the runtime session's `stop`; (5) a start that throws on a parked run leaves the run parked on the same wait. The move of the chunk-zero functions is behaviour-preserving, and the existing `src/daemon/session.test.ts` is its seam: it must pass unchanged.

> No dependency on other sub-phases.

This is prefactoring: it makes the runner's step starter a call instead of a copy. The existing session tests are the guard that the current daemon, which ivtrends runs on, did not move.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"                                   # expect 0
npx vitest run src/daemon/step-session.test.ts; echo "exit: $?"     # expect 0
npx vitest run src/daemon/session.test.ts src/daemon/poll.test.ts; echo "exit: $?"   # expect 0, no test edited
git diff --stat origin/main -- src/daemon/session.test.ts src/daemon/poll.test.ts   # expect no output
```

- [ ] `session.test.ts` and `poll.test.ts` pass with no line changed.
- [ ] Red→green evidence for the five cases in the handoff.

---

### Sub-phase 40b: who may instruct, which driver, the limit — and the forge calls the runner needs

**[MODIFY]** `src/manifest.ts` — top-level `operator?: string` (the operator's forge login). Per project: `driver?: "daemon" | "runner"`, `instructors?: string[]`, `ticket_limit_usd?: number` (positive). A project with `driver: runner` and neither `instructors` nor a top-level `operator` is refused with a sentence naming the project. Helpers: `driverOf(config)` (default `daemon`), `namedPeople(manifest, name)` (`instructors`, else `[operator]`), `ticketLimitOf(config)` (default 150).
**[MODIFY]** `src/adapters/ticketing.ts` — `TicketingAdapter` gains `removeLabel(p, number, label)`, `createIssue(p, {title, body, labels}) → number`, `getPullRequestBody(p, number) → string`, `setPullRequestBody(p, number, body)`, `aheadOfDefault(p, branch) → number | undefined` (commits on the branch that are not on the default branch; undefined when the branch does not exist).
**[MODIFY]** `src/adapters/github-tickets.ts` — the five methods through `gh`: `issue edit --remove-label`, `issue create --label`, `pr view --json body`, `pr edit --body-file -`, `api repos/<slug>/compare/<default>...<branch> --jq .ahead_by` (a 404 reads as undefined).
> ✏ 2026-09-27 (build, timone#165): `setPullRequestBody` writes the body to a temporary file and passes `pr edit --body-file <path>`, removing the file afterwards, whether the call succeeded or not. The `CommandRunner` the adapter uses cannot pass standard input, and widening it would also widen the credential wrapper every forge call goes through. Recorded in [phase-40-departures.md](reports/phase-40-departures.md).
**[MODIFY]** `src/adapters/ticketing.stubs.ts` and every test double of `TicketingAdapter` — the compiler lists them.
**[MODIFY]** `src/manifest.test.ts`, `src/adapters/github-tickets.test.ts`

**Seams under test (TDD):** `parseManifest` and the helpers, which are pure, and `GitHubTicketingAdapter` over a fake `CommandRunner`, which is how the adapter is already tested. Red-green: (1) `driver: runner` with no `operator` and no `instructors` is refused, and the message names the project; (2) defaults: driver `daemon`, limit 150, named people `[operator]`; (3) `instructors` replace the operator; (4) an unknown key is still refused; (5) each new adapter method issues the expected `gh` arguments and parses the answer; (6) `aheadOfDefault` answers undefined for a branch the forge does not know.

> Sub-phase 40a must be complete before starting this sub-phase (both edit test doubles that `session.test.ts` imports; running them together would collide).

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"                                                # expect 0
npx vitest run src/manifest.test.ts src/adapters/; echo "exit: $?"               # expect 0
node dist/cli.js projects list >/dev/null 2>&1 || npx tsx src/cli.ts projects list; echo "exit: $?"   # expect 0: today's timone.yaml still loads
```

- [ ] The real `timone.yaml` still parses unchanged.
- [ ] Red→green evidence in the handoff.

---

### Sub-phase 40c: the run record, the default order, the departures and the limit

**[NEW FILE]** `src/runner/record.ts` — the entry schema, a zod discriminated union on `kind`: `woke {runId, events}`, `runner-ended {runId, ok, costUsd, error?}`, `decision {runId, action, reason, detail?}`, `step-started {runId, stage, sessionId, instructions?}`, `step-ended {runId, stage, sessionId, ok, costUsd, error?, stoppedBy?}`, `departure {runId, skipped, reason?}`, `approval {runId, what, by, commentAt}`, `limit-reached {spentUsd}`, `limit-raised {by, commentAt}`, `seen {thread, until}`, `notice {about}`; every entry carries `at`. `appendEntry(dir, project, ticket, entry)` and `readRecord(dir, project, ticket)` returning a result. Path `.timone/records/<project>/<ticket>.jsonl`.
**[NEW FILE]** `src/runner/order.ts` — `defaultOrder(kind)`: the written order for a feature, a chore, a bug, a question, a decision ticket, a research ticket, a map, a step ticket and a remediation. Each step is `{id, label, stage?, check?, approval?}`, with `label` in the plain words a person reads (the same words as `stageLabel`), `check: true` on the verification step, and `approval: "requirements" | "pieces"` on the two approvals.
**[NEW FILE]** `src/runner/departures.ts` — `departuresOf(entries, runId, order)`: each step of the order that did not run, or ran out of order, with the reason from the matching `departure` entry. `departureSection(departures)`: the block the pull request carries, between two HTML-comment markers, with a skipped check as its first line, "The default order was followed." when there are none, and "no reason given" where a reason is missing.
**[NEW FILE]** `src/runner/limit.ts` — `spentOn(entries)` (every `step-ended` and `runner-ended` cost, across every run of the ticket), `allowanceOf(entries, base)` (base × (1 + the number of `limit-raised`)), `isOverLimit`.
**[NEW FILE]** `src/runner/record.test.ts`, `src/runner/departures.test.ts`, `src/runner/limit.test.ts`

**Seams under test (TDD):** the four modules' exports, all pure except the two file functions, which are tested against a temporary directory. Red-green, taken from R5 and R8: (1) a record where verification did not run gives a section whose first line says the work was not checked by a session that did not build it, with the reason; (2) interview and requirements approval missing are both listed with their reasons; (3) no departures gives "The default order was followed."; (4) a departure with no reason is still listed, as "no reason given"; (5) `spentOn` adds step and runner costs across two runs of one ticket; (6) at $150 spent the ticket is over; one raise makes the allowance $300; (7) a base of $80 from the manifest is used instead; (8) a line that fails the schema makes `readRecord` return an error naming the line number; (9) an appended entry reads back equal.

> No dependency on other sub-phases. New files only: it may run in parallel with 40a and 40b.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"                 # expect 0
npx vitest run src/runner/; echo "exit: $?"       # expect 0
```

- [ ] `departureSection` output for case (1) is quoted in the handoff.
- [ ] Red→green evidence in the handoff.

---

### Sub-phase 40d: the box can take a message while a step runs, and a step's activity can be summarised

**[MODIFY]** `src/daemon/session.ts` — `SessionRequest.interactive?: true`; `StartedSession.send?(text: string): void`. ~~`agentSdkRuntime`: an interactive request uses streaming input (a queue behind an `AsyncIterable<SDKUserMessage>`) under the same rule as the box below.~~
> ✏ 2026-09-27 (build, timone#165): `agentSdkRuntime` is left as it is. It starts an interactive request as it starts any other and offers no `send`, so the runner's `messageStep` refuses on it. No seam was declared for that change, the daemon runs the container runtime by default, and the runner's steps run in the box. Recorded in [phase-40-departures.md](reports/phase-40-departures.md).
**[MODIFY]** `src/daemon/container-runtime.ts` — for an interactive request only: `docker run -i`; `ContainerProcess` gains `write(line)` and `end()` over a piped stdin; the box script sends every setup command's input from `/dev/null` and ends in `exec claude -p --input-format stream-json --output-format stream-json …` with no `printf`; the daemon writes the first user message (`boxPreamble()` + prompt) as one stream-json line; `send()` writes another. **Stdin is ended when a `result` arrives and no message was sent after the turn that result closes**, so the session ends as it does today. A non-interactive request produces exactly today's arguments and script.
**[MODIFY]** `src/daemon/progress.ts` — `SessionProgress` also records each tool use with its time and the time of the last output of any kind; `activitySince(instant) → { tools: string[]; lastOutputAt?: string; outputTokens: number }`.
**[MODIFY]** `src/daemon/transcript.ts` — export the tool-use summariser (`summarise`) so progress and transcript say the same thing.
**[MODIFY]** `src/daemon/step-session.ts` — pass `send` through.
**[MODIFY]** `src/daemon/container-runtime.test.ts`, `src/daemon/progress.test.ts`

**Seams under test (TDD):** `containerRuntime(...).start` over a fake `ContainerSpawn`, which is how the box is already tested, and `SessionProgress`. Red-green: (1) an interactive request's arguments contain `-i`, its script contains `--input-format stream-json` and no `printf`, and the first line written to stdin is a user message holding the prompt; (2) `send("x")` writes a second user message; (3) after a `result` with nothing sent since, stdin is ended and `completed` resolves; (4) a message sent before the `result` keeps stdin open until the next `result`; (5) a non-interactive request's arguments and script equal today's — capture both strings from the current code before changing it, and assert against those captured values; (6) `activitySince` lists only the tool uses after the instant, as `Bash(npm test)`; (7) `lastOutputAt` moves on every stream event.

> Sub-phase 40a must be complete before starting this sub-phase (`send` is passed through `startStepSession`).

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"                                                          # expect 0
npx vitest run src/daemon/container-runtime.test.ts src/daemon/progress.test.ts src/daemon/session.test.ts; echo "exit: $?"   # expect 0
# Protocol probe against the real CLI: two user messages in, two results out.
printf '%s\n%s\n' \
  '{"type":"user","message":{"role":"user","content":[{"type":"text","text":"Reply with the single word one."}]}}' \
  '{"type":"user","message":{"role":"user","content":[{"type":"text","text":"Reply with the single word two."}]}}' \
  | claude -p --input-format stream-json --output-format stream-json --verbose --model claude-haiku-4-5 \
  | grep -c '"type":"result"'                                                               # expect 2
```

- [ ] The probe printed 2, and the handoff says which CLI version ran it (`claude --version`). If Docker and the model token are at hand, run the same probe in `timone-agent:latest` and say so.
- [ ] Red→green evidence in the handoff.

---

### Sub-phase 40e: the runner's actions, and the rules code keeps around them

**[NEW FILE]** `src/runner/actions.ts` — `runnerActions(deps, run)` with `deps = { store, adapter, manifest, recordsDir, steps (startStepSession, bound), clock, project }`. Each action appends a `decision` entry with its reason, and returns `{ ok: true; said: string } | { ok: false; refused: string }` in plain words for the runner to read:
  - `startStep({stage, instructions, reason, skipReason?})` — refuses when a step of this run is already running, when the ticket is over its limit (and code posts the limit notice once, recording `notice`), when the stage has no prompt, or when the ledger refuses (project busy). Works out whether the step skips steps of the default order; **a skip needs `skipReason`, and code posts the departure notice on the ticket before the step starts**, then records `departure`. Claims the branch for stages that own one. The prompt is `stagePrompt(...)` plus `runnerInstructionsBlock(...)`. The request is `interactive`. On the step's end, records `step-ended` with the summary's cost.
  - `messageStep({text, reason})`, `stopStep({reason})` — refuse when no step is running.
  - `post({where: "ticket" | "pull-request", body, reason})` — refuses a body without the `**What I need from you:**` line.
  - `setHold({on, reason})` — applies or removes `timone:held`.
  - `recordApproval({what: "requirements" | "pieces", commentAt, reason})` — the comment at `commentAt` must exist on the ticket and be written by a named person, or it refuses. Then it records `approval` and starts the approval-record session as a step. When that step succeeds for `pieces`, code merges chunk zero and opens the step tickets through `src/daemon/chunk-zero.ts`.
  - `fileTimoneIssue({title, body, reason})`, `commentTimoneIssue({number, body, reason})` — on the `timone` project of the manifest, with the label `bug`.
  - `endRun({reason, closeTicket})` — refuses when the branch has commits not on the default branch (`aheadOfDefault > 0`) and no open pull request; otherwise completes the run and closes the ticket if asked.
**[NEW FILE]** `src/runner/tools.ts` — `runnerToolServer(actions)`: `createSdkMcpServer` with one `tool()` per action and a zod input shape each; `RUNNER_TOOL_NAMES`, the exact list.
**[NEW FILE]** `src/runner/comments.ts` — the departure notice and the limit notice, in plain words, each ending with the call-to-action line.
**[MODIFY]** `src/daemon/chunk-zero.ts` — ~~`mergeChunkZero` refuses unless the ticket's record holds an `approval` entry for `pieces`. The current daemon's path supplies its approval the same way, so its behaviour does not change.~~
> ✏ 2026-09-27 (build, timone#165): `mergeChunkZero` takes the approval as a required argument, `{ by, at }`, and does nothing without it. The runner's path passes it only from the record's `approval` entry for `pieces`, and `recordApproval` refuses before any merge when there is none. The current daemon keeps no record, so it passes the approval it read from the person's reply — the one it already has. Recorded in [phase-40-departures.md](reports/phase-40-departures.md).
**[MODIFY]** `src/daemon/session.ts` — ✏ 2026-09-27 (build, timone#165): `recordApproval` passes the gate's approval to `mergeChunkZero` (✏ two call sites, found at build: `recordApproval`, and the spawner's private `mergeChunkZero` delegator that `session.test.ts` reaches by name, which now takes and passes the approval), and `workspaceFor` and `isPrompted` gain `export` so the runner's actions build a step's request the way the spawner does. Nothing else in the file changes.
**[MODIFY]** `src/daemon/prompts.ts` — `runnerInstructionsBlock(instructions, skipped)`: the runner's instructions under their own heading, and — when an approval was skipped — the exact sentence *"The runner skipped the approval of <what>, and recorded that it did."* that 40k teaches the skills to read.
**[NEW FILE]** `src/runner/actions.test.ts`, `src/runner/tools.test.ts`

**Seams under test (TDD):** `runnerActions` over the stub adapter, a fake step starter and a temporary records directory — classical, no mocks of the unit's own collaborators. Red-green: (1) `RUNNER_TOOL_NAMES` equals the list of R2 exactly, and no name contains edit, write, shell, bash, push or merge; (2) a skip posts the departure notice before the step starts — asserted on the order of calls; (3) a skip with no reason is refused and nothing starts; (4) over the limit, `startStep` is refused twice and the limit notice is posted once; (5) `recordApproval` with a comment by a login not named is refused and records nothing; with a named login it records the approval and starts the approval step; (6) **R3 falsified**: `recordApproval` for `pieces` with no `approval` entry in the record refuses and the fake forge's default branch has not moved, and `mergeChunkZero` cannot be called without an approval — a type error, checked by `tsc` on a `// @ts-expect-error` line in the test; (7) **R4 falsified**: `endRun` with `aheadOfDefault` 2 and no open pull request is refused, and the run is not completed; with 0 it completes; (8) `post` without the call-to-action line is refused; (9) `fileTimoneIssue` creates the issue on the `timone` project with the label `bug`; (10) **R7 falsified**: no action writes an `approval` entry except `recordApproval`, and `recordApproval` writes one only for a named person's comment — asserted by driving every action once with a non-named comment in the thread and reading the record.

> Sub-phases 40a, 40b, 40c and 40d must be complete before starting this sub-phase (it calls the step starter, the new adapter methods, the record and the interactive request). ✏ 2026-09-27 (build, timone#165): and 40f, for `ticketKindOf`.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"                                                         # expect 0
npx vitest run src/runner/ src/daemon/session.test.ts src/daemon/poll.test.ts; echo "exit: $?"   # expect 0
```

- [ ] The departure notice and the limit notice are quoted in the handoff, and read as plain English.
- [ ] Red→green evidence for the ten cases in the handoff.

---

### Sub-phase 40f: the brief — what the runner is given each time it wakes

**[NEW FILE]** `src/runner/facts.ts` — `gatherFacts(adapter, project, run)`: the branch, `aheadOfDefault`, the phase files on the branch and not on the default branch with their `Status:` lines, the verification and completion reports present, the requirement files' status lines, the breakdown's stamp, and the open pull request if there is one. Any adapter error makes that fact `unknown`; it never throws.
**[NEW FILE]** `src/runner/brief.ts` — `buildBrief(input) → { system: string; prompt: string }`. The input is the project, the run, the ticket thread, the pull-request thread, the named people, the record, the facts, the running step's activity, the events, the open Timone issues labelled `bug`, whether the ticket is held, and the limit. The **system** text is the runner's rules, in plain words: the written order is the default and may be left with a reason; a skipped step is said on the ticket; no approval is recorded that nobody gave; every message ends with the call-to-action line and follows Timone's rules for writing to a person; it acts only through its tools; a wake may end having done nothing when nothing is needed. The **prompt** lists, in this order: why it was woken, the ticket, the default order with the steps already run and their cost, the facts, the pull request, the running step, the limit, the open Timone issues.
**[NEW FILE]** `src/runner/facts.test.ts`, `src/runner/brief.test.ts`
**[MODIFY]** `src/runner/order.ts` — `ticketKindOf(labels, context) → TicketKind`: a ticket's kind read off its labels (`triage:<kind>`, `wayfinder:<type>`), with a step ticket and a remediation told apart by the caller's context. Its test goes in a new `src/runner/order.test.ts`.
> ✏ 2026-09-27 (build, timone#165): `ticketKindOf` added to this slice. Both the brief and the runner's actions (40e) need the ticket's kind to find its default order, and it belongs beside `defaultOrder`. 40e therefore now waits for 40f. Recorded in [phase-40-departures.md](reports/phase-40-departures.md).

**Seams under test (TDD):** `buildBrief`, pure, and `gatherFacts` over the stub adapter. Red-green: (1) **R10 falsified**: a comment by a login not named appears nowhere in the prompt — neither its text nor its author; (2) Timone's own comments appear, marked as Timone's; (3) the default order shows the steps already run, each with its cost; (4) the limit line shows spent and allowed; (5) the events come first; (6) the open Timone issues appear with their numbers; (7) `gatherFacts` lists a phase file present on the branch and absent from the default branch, with its `Status:` line; (8) an adapter that throws gives `unknown` for that fact and no throw; (9) `ticketKindOf` reads `triage:chore` as a chore, `wayfinder:map` as a map, `wayfinder:research` as research, the other wayfinder types as a decision ticket, and a step ticket as a step whatever its labels.

> Sub-phases 40b and 40c must be complete before starting this sub-phase. It may run in parallel with 40d. ✏ 2026-09-27 (build, timone#165): no longer in parallel with 40e, which now needs `ticketKindOf`.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"                       # expect 0
npx vitest run src/runner/brief.test.ts src/runner/facts.test.ts; echo "exit: $?"   # expect 0
```

- [ ] A full brief built from a realistic fixture is pasted in the handoff, so the next reader sees what the runner sees.
- [ ] Red→green evidence in the handoff.

---

### Sub-phase 40g: the runner session — one fresh session per wake, and what happens when it fails

**[NEW FILE]** `src/runner/session.ts` — `wakeRunner(deps, run, events)`: gathers the facts, builds the brief, and starts one session through an injected `runQuery` (the SDK's `query` in production) with: model `claude-opus-5-5`, effort `medium`, `tools: []`, `mcpServers: { runner: runnerToolServer(actions) }`, `allowedTools` set to the qualified runner tool names, `settingSources: []`, `cwd` an empty `.timone/runner/` directory, `maxTurns: 40`, `maxBudgetUsd: 5`, and an abort after 10 minutes. It records `woke`, then `runner-ended` with the result's cost. **One wake per run at a time**: a wake asked for while one runs is queued, with its events merged, and runs after. After a wake that started no step and did not end the run, the run is parked with wait kind `runner`, and `on` set to what the runner last asked for on the ticket (the text after the call-to-action line), or "the next thing that happens on this ticket". **When the session fails**: it is tried again after 60 s and then 5 min, posting nothing; after the third failure, code posts once that the machine cannot reach its model, asking the reader for nothing, and tries again every 15 min. The run's status and wait are never changed by a failure.
**[MODIFY]** `src/daemon/runs.ts` — wait kind `runner` in the schema.
**[MODIFY]** `src/daemon/pipeline.ts` — `resolvableBy` answers for `runner`.
**[MODIFY]** every exhaustive switch over the wait kind the compiler reports (`src/daemon/cta.ts`, `src/commands/status.ts`, `src/commands/takeover.ts`, `src/commands/retry.ts`). In `takeover.ts`, a `runner` wait opens the session bound to no stage, as an escalation does.
**[NEW FILE]** `src/runner/session.test.ts`
> ✏ 2026-09-27 (build, timone#165): the wait kind is read by `if` chains in `cta.ts`, `status.ts`, `takeover.ts` and `retry.ts`, not by exhaustive switches, so the compiler named none of them. The four changes were made as the plan asks, without tests at this slice's seam; their tests move to 40h (`takeover`, `retry`) and 40i (`status`, and what `cta.ts` makes the status line say). `package.json` gains `@modelcontextprotocol/sdk` as a development dependency, because this slice's test drives the real tool server through an MCP client. Recorded in [phase-40-departures.md](reports/phase-40-departures.md).

**Seams under test (TDD):** `wakeRunner` over an injected `runQuery` fake that plays a scripted list of tool calls against the real tool server. Red-green: (1) **R2 falsified**: the options handed to `runQuery` carry `tools: []`, exactly one MCP server, and `allowedTools` equal to the qualified runner names; (2) a wake that starts no step parks the run with kind `runner` and the runner's own ask as `on`; (3) `woke` and `runner-ended` with the cost are recorded; (4) a second wake asked for during the first runs after it, with both sets of events; (5) **R16**: `runQuery` failing twice then succeeding posts nothing and wakes three times, with waits of 60 s and 5 min on fake timers; failing three times posts the notice once, leaves the run's status and wait unchanged, and schedules the next try 15 min later.

> Sub-phases 40e and 40f must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"                                                  # expect 0
npx vitest run src/runner/ src/daemon/ src/commands/; echo "exit: $?"             # expect 0
```

- [ ] The unreachable-model notice is quoted in the handoff.
- [ ] Red→green evidence in the handoff.

---

### Sub-phase 40h: the runner drives its projects in the poll cycle

**[NEW FILE]** `src/runner/driver.ts` — `RunnerDriver.tick(project, config, threads)`, called once per cycle for each runner project. It finds the events of each unsettled run of the project and asks for wakes; **it never awaits a wake or a step** — both run as tracked promises, and `drain()` exists for tests and shutdown. Events:
  - a run `picked-up` and never woken → "a new ticket";
  - a named person's comment after the record's `seen` mark, on the ticket or on the run's pull request → the comment (only named people; a held ticket wakes on nothing else);
  - the run's pull request merged or closed, or its ticket closed → that fact;
  - a step that ended → records `step-ended`, records the pull request if one is open for the branch (`recordPullRequest`), rewrites the departure section at the top of the pull request's body, then wakes with "the step ended";
  - every 15 minutes while a step runs → a check, with `activitySince` of the last check and "silent since …" when no output came;
  - a ticket over its limit with a named person's comment after the limit notice → the one-turn check (`consult`) asks whether the comment means go on; yes records `limit-raised` and wakes; anything else changes nothing.
**[MODIFY]** `src/daemon/poll.ts` — `pollProject`: after the registration loop, a project whose `driverOf(config)` is `runner` goes to `driver.tick` and skips `openGoAheads`, `resumeAnswered`, the pickup spawn and `reconcileCtas`. `reclaimStale`: a stale run of a runner project is parked with kind `runner` and woken with "the daemon stopped while a step was running", never failed. `applyRequest`: `retry` on a runner project is settled with the refusal *"This project is run by the runner. Write on the ticket instead: say what you want done."*; `cancel` also calls `driver.stop(id)`, which stops the step's box and aborts the runner's session; `release-takeover` on a runner project parks with kind `runner` and wakes with "the terminal session ended".
**[MODIFY]** `src/commands/retry.ts` — the path with no daemon refuses the same way on a runner project.
**[MODIFY]** `src/commands/daemon.ts` — build the `RunnerDriver` (runtime, adapter, store, manifest, records directory, `sdkConsult()`) and pass it to the cycle; `drain` on shutdown.
**[NEW FILE]** `src/runner/driver.test.ts`
**[MODIFY]** `src/daemon/poll.test.ts` — new cases only.

**Seams under test (TDD):** `pollOnce`, the seam the cycle is already tested at, with a fake wake; and `RunnerDriver` for the step-end bookkeeping. Red-green: (1) a new ticket on a runner project asks for a wake and the old spawner is never called; (2) every existing `poll.test.ts` case passes unchanged — the current daemon's projects behave as before; (3) **R15**: `pollOnce` resolves while a fake step never completes, and in that same cycle a second project's named comment asks for a wake; (4) a named person's comment asks for a wake; a comment by someone not named does not; (5) a `retry` request on a runner project is settled with the refusal and the run is unchanged; (6) a `cancel` request calls `driver.stop` and cancels the run; (7) a stale runner run is parked with kind `runner` and a wake is asked for, and the run is not failed; (8) a merged pull request asks for a wake carrying that fact; (9) on a held ticket a named comment wakes and nothing else does; (10) at the limit, a named "go on" comment with the check answering yes records `limit-raised` and wakes, and with no changes nothing; (11) a step that ended records its cost and rewrites the pull request's body with the departure section first and the rest of the body kept; ✏ 2026-09-27 (build, timone#165), moved here from 40g: (12) `timone takeover` on a run waiting with kind `runner` opens the session bound to no stage, and its release parks the run with kind `runner` and asks for a wake — tested at `resolveTakeover` in `src/commands/takeover.test.ts` and at `pollOnce`; (13) `timone retry` on a runner project refuses with the plan's sentence on both paths, the one through the daemon and the one without it — tested in `src/commands/retry.test.ts` (new cases only).

> Sub-phase 40g must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"                     # expect 0
npx vitest run; echo "exit: $?"                       # expect 0 — the whole suite
git diff origin/main -- src/daemon/poll.test.ts | grep -c '^-[^-]'   # expect 0: no existing test line removed
```

- [ ] The whole suite passes, and no existing `poll.test.ts` line was removed.
- [ ] Red→green evidence for the eleven cases in the handoff.

---

### Sub-phase 40i: `timone record` — the record of a run, in plain words

**[NEW FILE]** `src/commands/record.ts` — `timone record <project>#<ticket>`: reads the ticket's record and prints each step with its start, end and cost, each decision with its reason, each departure, and the total spent against the limit. Read-only, takes no lock.
**[MODIFY]** `src/cli.ts` — register the command.
**[MODIFY]** `src/commands/status.ts` — a run with a `runner` wait reads "waiting: <on>", and a runner project's line shows spent and limit.
**[NEW FILE]** `src/commands/record.test.ts`

**Seams under test (TDD):** the command's pure render function over a record fixture. Red-green: (1) each step with its times and cost; (2) each decision with its reason; (3) the departures; (4) total against limit; (5) a ticket with no record gives a sentence saying so, and exit code 1; ✏ 2026-09-27 (build, timone#165), moved here from 40g: (6) `timone status` renders a run waiting with kind `runner` as "waiting: <on>", and its closing line counts that run as waiting on a person when `on` asks for something — the 40g arm in `cta.ts` made it say "nothing is waiting on you"; decide and test it in `src/commands/status.test.ts` (new cases only), with `src/daemon/cta.ts` granted for the fix.

> Sub-phase 40g must be complete before starting this sub-phase (`status.ts` is also changed there). May run in parallel with 40h, 40j and 40k.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"                            # expect 0
npx vitest run src/commands/record.test.ts src/commands/status.test.ts; echo "exit: $?"   # expect 0
npx tsx src/cli.ts record scratch-app#999999; echo "exit: $?"   # expect the no-record sentence and exit 1
```

- [ ] Red→green evidence in the handoff.

---

### Sub-phase 40j: the replay of the recorded failures

**[NEW FILE]** `src/runner/replay/cases.ts` — the nineteen cases of PRD-05.R18's table, each as a brief input (thread, record, facts, events) written to reproduce the moment it names, and the action the runner must choose, as a matcher over the recorded tool calls.
**[NEW FILE]** `src/runner/replay/harness.ts` — builds each brief with the real `buildBrief`, runs the real `wakeRunner` with fake actions that only record what is called, three tries per case; prints one line per case and exits 1 if any case failed.
**[NEW FILE]** `src/runner/replay/harness.test.ts` — the harness's own logic, with a fake `runQuery` and no model.
**[MODIFY]** `package.json` — `"replay": "tsx src/runner/replay/harness.ts"`.

**Seams under test (TDD):** the harness's `judgeCase`, pure. Red-green: (1) a case passes only when all three tries chose the expected action; (2) a try that errors counts as a failed try; (3) the printed line names the case's issue number. The cases themselves are the specification: when a case fails, the runner's brief or rules are what change, never the case — say so in the handoff for each fix.

> Sub-phase 40g must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"                                  # expect 0
npx vitest run src/runner/replay/; echo "exit: $?"                 # expect 0
npm run replay; echo "exit: $?"                                    # expect 0 — calls the real model; costs money
```

> ✏ 2026-09-27 (build, timone#165): the build's sandbox has no model login (`claude auth status` → `loggedIn: false`), so `npm run replay` cannot run there. The slice builds the harness, the cases and the harness's own tests; the replay itself is run once from the operator's logged-in terminal, before delivery, and its output is recorded in `reports/phase-40-replay.md`. Recorded in [phase-40-departures.md](reports/phase-40-departures.md).

- [ ] The replay's full output, and its total cost, are in the handoff. ✏ 2026-09-27: in `reports/phase-40-replay.md`, from the operator's run.
- [ ] **Human gate** (✏ 2026-09-27): fvermaut runs `npm run replay` in `projects/timone` from his own terminal, or decides it rides to the pull request as owed.
- [ ] Every fix made to pass a case is listed with the case it fixed.

---

### Sub-phase 40k: the step skills accept an approval the runner skipped

**[MODIFY]** `.claude/skills/timone-plan/SKILL.md` — the anchoring gate: a requirements file still marked `Draft` is not a stop when the step's instructions carry the sentence *"The runner skipped the approval of the requirements, and recorded that it did."*; plan against it and say so in the phase file.
**[MODIFY]** `.claude/skills/timone-execute/SKILL.md` — the entry gate: the same for *"… the approval of the list of pieces …"*; the initiative is then one piece on its own branch.
**[MODIFY]** `.claude/skills/timone-deliver/SKILL.md` — the block between the departure markers at the top of the pull request's body is written by code; delivery leaves it alone and writes below it.

No behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based. `process.md` is not changed here: describing the runner there is [#166](https://github.com/fvermaut/timone/issues/166)'s.

> Sub-phase 40e must be complete before starting this sub-phase (the sentences must match `runnerInstructionsBlock` word for word).

#### Agent Validation Steps

```bash
grep -c "The runner skipped the approval of" .claude/skills/timone-plan/SKILL.md .claude/skills/timone-execute/SKILL.md src/daemon/prompts.ts   # expect at least 1 in each
```

- [ ] Each skill's clause applies only when the sentence is present, so a session started by the current daemon reads the gate exactly as before.

---

### Sub-phase 40n: a step ticket's claim is not shown to the runner as a hold

> ✏ 2026-09-27 (build, timone#165): added at build. 40h found that on a step ticket the `timone:held` label is the machine's own claim, put on at pickup (ADR-0044 D7), and it made the driver read it that way. The brief (40g) still shows "Held." on every step ticket, and a runner told a ticket is held may do nothing — which would stall every piece of a split initiative. Recorded in [phase-40-departures.md](reports/phase-40-departures.md).

**[MODIFY]** `src/runner/session.ts` — the brief's `held` is true only when the ticket carries `timone:held` **and** is not a step ticket (`ticketContext.isStep`).
**[MODIFY]** `src/runner/session.test.ts` — new cases only.

**Seams under test (TDD):** `wakeRunner` over the injected `runQuery` fake, reading the prompt it was handed — the seam 40g already tests at. Red-green: (1) a step ticket carrying `timone:held` gives a prompt that says the ticket is not held; (2) a ticket that is not a step ticket and carries `timone:held` gives a prompt that says it is held.

> Sub-phase 40h must be complete before starting this sub-phase. Shares no file with 40i or 40j.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"                          # expect 0
npx vitest run src/runner/session.test.ts; echo "exit: $?"  # expect 0
```

- [ ] Red→green evidence in the handoff.

---

### Sub-phase 40o: an approval comes after what it approves, and an interrupted step gets its end

> ✏ 2026-09-27 (build, timone#165): added at build, from two moments 40j's cases showed. **scratch-app#37:** once the requirements are written, `recordApproval` would accept a named person's comment written *before* them — "approve them yourself in my name" — as their approval, so R7 would rest on the runner's rules alone. **#140:** after a daemon stop, the record holds a `step-started` with no `step-ended`, so the brief shows the step "running now" while no step runs. Recorded in [phase-40-departures.md](reports/phase-40-departures.md).

**[MODIFY]** `src/runner/actions.ts` — `recordApproval` refuses unless the comment was written after the last successful `step-ended` of the stage it approves, in this run: `requirements` for the requirements, `breakdown` for the list of pieces. With no such step, there is nothing to approve yet, and it refuses.
**[MODIFY]** `src/runner/driver.ts` — when a run comes back after a daemon stop (`reclaimed`), each `step-started` of that run with no matching `step-ended` gets one: `ok: false`, `costUsd: 0`, `error: "the daemon stopped while this step was running"`, `stoppedBy: "daemon"`. Then the run is handed back as today.
**[MODIFY]** `src/runner/actions.test.ts`, `src/runner/driver.test.ts` — new cases only. ✏ 2026-09-27 (build, timone#165): and, in `actions.test.ts`, the fixtures of the three 40e cases that record an approval of the list of pieces gain one earlier successful `breakdown` `step-ended` entry — so they state that the list was written before it was approved, which is what the new rule requires. No assertion of theirs changes.
**[MODIFY]** `src/runner/replay/cases.ts` — ✏ 2026-09-27 (build, timone#165): the #140 case's record gains the `step-ended` (`stoppedBy: "daemon"`) that a daemon now writes when it takes a run back, so the replay shows the runner the record as the system now leaves it. The case's matcher does not change.

**Seams under test (TDD):** `runnerActions`, and `RunnerDriver.reclaimed`, the seams 40e and 40h test at. Red-green: (1) **R7**: a named person's comment written before the requirements step ended is refused as an approval of the requirements, and nothing is recorded; (2) the same person's comment written after it ends is recorded; (3) an approval of the list of pieces with no successful `breakdown` step in the run is refused; (4) after `reclaimed`, the record holds a `step-ended` with `stoppedBy: "daemon"` for the step that was running, and none is added for a step that had already ended.

> Sub-phases 40h and 40j must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"                                                  # expect 0
npx vitest run src/runner/; echo "exit: $?"                                        # expect 0
npm run --silent replay -- --dry; echo "exit: $?"                                  # expect 0, 19 of 19
```

- [ ] Red→green evidence in the handoff.

---

### Sub-phase 40p: the runner's rules carry what the replay showed missing

> ✏ 2026-09-28 (build, timone#165): added at build, from the first real replay (13 of 19, [phase-40-replay.md](reports/phase-40-replay.md)). Four failures were rules the written process holds and the runner's brief did not; one was a fixture that left out part of its moment; one was a matcher that read the table more narrowly than the process. Recorded in [phase-40-departures.md](reports/phase-40-departures.md).

**[MODIFY]** `src/runner/brief.ts` — the system text gains a short section, *What the written process says when work stops*, in the brief's own plain words, each rule with the reason a person would give:
  - A step stopped because a written requirement is wrong, or contradicts another: start the step that writes the requirements, with the line and the fix in its instructions, then run the check again. Ask a person only when the right answer is a choice only they can make. (#108)
  - A pull request closed without merging, whose discussion says what was wrong: do the work again from that discussion, starting at the step it points to. Do not ask. (PRD-03.R1, #111)
  - A check only the operator can run does not stop delivery: start delivery again, and tell it to open the pull request and list the check as not run. (ADR-0059 D1, #159)
  - A question a step asked after the list of pieces was agreed rides to the pull request: carry on, and tell delivery to put the question there. (ADR-0056)
  - Do not put the hold on to wait for a person: after you ask, the run waits by itself. Put the hold on only when a named person asks you to stop the work. (#108, #159)
  - At a check, when the step has run the whole test suite more than twice since the last check, send it a message: run only the tests of what it changes while it works, and the whole suite once at the end. (process.md stage 6, #110)
**[MODIFY]** `src/runner/replay/cases.ts` — #120's ticket gains the note the terminal session left when it ended without clearing the stop (the box still has no key; only fvermaut can add it). #104's matcher accepts `breakdown` or `planning` as the start of planning. No other case changes.
**[MODIFY]** `src/runner/brief.test.ts` — new cases only.

**Seams under test (TDD):** `buildBrief`, pure — the system text states each rule. Red-green: one case per rule above, each asserting the rule's key words appear in `system`, red before the text is added. The behaviour itself is judged by the replay, which the operator runs again (human gate below).

> Sub-phase 40o must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"                          # expect 0
npx vitest run src/runner/; echo "exit: $?"                 # expect 0
npm run --silent replay -- --dry; echo "exit: $?"           # expect 0, 19 of 19
```

- [ ] Red→green evidence in the handoff.
- [ ] **Human gate:** fvermaut runs `npm run --silent replay` again from his own terminal; its output is added to `reports/phase-40-replay.md` as run 2.

> ✏ 2026-09-28 (build, timone#165): run 2 passed 18 of 19. #120's note, as 40p wrote it, asked for the key itself, which made doing nothing the right answer. The note is rewritten to match the real #120 — the terminal session could not clear the stop, and the note points at the same `timone takeover` command — and `npm run --silent replay -- --case 120` is run again from the operator's terminal as run 3.

---

### Sub-phase 40q: the ticket's newest message says what it needs now

> ✏ 2026-09-28 (build, timone#165): added at build, from replay run 3 ([phase-40-replay.md](reports/phase-40-replay.md)). On #120, two tries of three replaced the ticket's pointer to a useless command and carried on without the missing key, as ADR-0056 and ADR-0059 D1 say; one try did nothing and left the ticket pointing at the command — the real #120 fault. Recorded in [phase-40-departures.md](reports/phase-40-departures.md).

**[MODIFY]** `src/runner/brief.ts` — the system text gains the rule [ADR-0024](../../adr/0024-every-open-ticket-answers-for-itself.md) holds and the brief did not: the ticket's newest message must say truthfully what the ticket needs now. When the newest message is the machine's and is no longer true — it asks for something that is not needed, or offers a command that will not help — post one that is, even when there is nothing else to do.
**[MODIFY]** `src/runner/replay/cases.ts` — #120's matcher passes when the runner posts a new ticket comment that does not offer `timone takeover`, and that either asks for what is needed, or goes with a step it starts (carrying on, with the key listed for the pull request). Doing nothing still fails, and so does offering the command again. No other case changes.
**[MODIFY]** `src/runner/brief.test.ts` — new cases only.

**Seams under test (TDD):** `buildBrief`, pure — (1) the system text states the rule, red before it is added. The matcher change is proven on the dry run: the case's scripted right call still passes, and a scripted *do nothing* fails (run it once by hand and quote it in the handoff).

> Sub-phase 40p must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"                          # expect 0
npx vitest run src/runner/; echo "exit: $?"                 # expect 0
npm run --silent replay -- --dry; echo "exit: $?"           # expect 0, 19 of 19
```

- [ ] Red→green evidence in the handoff.
- [ ] **Human gate:** fvermaut runs `npm run --silent replay -- --case 120` from his own terminal (run 4); its output is added to `reports/phase-40-replay.md`.

---

### Sub-phase 40r: a run waits on its pull request, the ledger knows the step, and a shared reason is said once

> ✏ 2026-09-28 (build, timone#165): added at build, from the watched run's first attempt ([phase-40-live-gate.md](reports/phase-40-live-gate.md)). The runner ended the run when its pull request opened, so a change asked for there would have gone unanswered, and the still-open ticket was picked up again as new work. The ledger showed no step while the build ran. The departure list repeated one reason seven times. Recorded in [phase-40-departures.md](reports/phase-40-departures.md).

**[MODIFY]** `src/runner/actions.ts` — `endRun` refuses while the run's pull request is open: the run waits on it, answers its review, and ends when it is merged or closed. A merged or closed pull request, or a run that changed nothing, may end. `startStep` records the step in the ledger (`store.setStage`) before the step starts.
**[MODIFY]** `src/runner/brief.ts` — the rule "A run that changed the project's files ends at a pull request. End a run only when its pull request is open, or when nothing was changed." becomes: a run that changed files waits on its pull request; while it is open, answer its review and do not end the run; when it is merged, end the run and close the ticket; when it is closed without merging, follow the rule for that. A ticket left open and marked with no run is picked up again as new work, so end a finished run with the ticket closed.
**[MODIFY]** `src/runner/departures.ts` — departures that share one reason are listed as one line naming their steps, with the reason once. A skipped check stays the first line on its own.
**[MODIFY]** `src/runner/actions.test.ts`, `src/runner/brief.test.ts`, `src/runner/departures.test.ts` — new cases, and the existing `departureSection` cases' expected text where the grouping changes it.
> ✏ 2026-09-28 (build, timone#165), found while building this slice: **[MODIFY]** `src/runner/tools.ts` — the `end_run` tool's description still said "A run that changed files can end only once its pull request is open"; the runner reads it on every wake, so it says the new rule. **[MODIFY]** `src/runner/driver.ts` (and `src/runner/driver.test.ts`, new cases only) — when a step ends and the branch's open pull request is not the one the ledger holds (a pull request was closed and the redone work opened another), the ledger's pull request is updated, so its comments and its merge reach the runner. Case (5): a step that ends with a new open pull request on the branch updates the ledger's `pr` to it.

**Seams under test (TDD):** `runnerActions`, `buildBrief`, `departureSection`, and `RunnerDriver` for case (5). Red-green: (1) `endRun` with the run's pull request open is refused, and the run is not completed; with it merged, the run ends; (2) `startStep` leaves the ledger's `stage` set to the step's stage; (3) the system text says a run waits on its open pull request and ends when it is merged or closed, and no longer says a run may end when its pull request is open; (4) three departures sharing one reason give one line naming the three, with the reason once; a skipped check with the same reason is still its own first line.

> Sub-phase 40q must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"                          # expect 0
npx vitest run; echo "exit: $?"                             # expect 0
npm run --silent replay -- --dry; echo "exit: $?"           # expect 0, 19 of 19
```

- [ ] Red→green evidence in the handoff.

---

### Sub-phase 40s: a map closes with its last piece, the wait says what it waits on, and the runner knows where a key goes

> ✏ 2026-09-28 (build, timone#165): added at build, from the watched run's second attempt and replay run 4 ([phase-40-live-gate.md](reports/phase-40-live-gate.md), [phase-40-replay.md](reports/phase-40-replay.md)). Recorded in [phase-40-departures.md](reports/phase-40-departures.md).

**[MODIFY]** `src/runner/actions.ts` (or `src/runner/driver.ts`, whichever holds the end of a step ticket's run most simply) — when a step ticket's run ends because its pull request merged, and no step of its map is open any more, the map is closed with the same comment the current daemon posts (`initiativeClosedComment`), as `concludeStep` in `src/daemon/poll.ts` does. Reuse that code; do not write a second version of it.
**[MODIFY]** `src/runner/session.ts` — after a wake in which the runner posted nothing, the run's wait says what the ticket's newest machine comment asks for (`askedFor`), not "the runner to look at what the step did".
**[MODIFY]** `src/runner/brief.ts` — one rule: a key or secret missing in the box is added by the operator to the project's environment file beside the daemon (`.timone/env/<project>.env`), and the next step picks it up; a terminal session cannot add it. Ask for that, naming the key and the file.
**[MODIFY]** the matching test files — new cases only; `src/daemon/poll.ts` only to export what the map-closing code needs.

**Seams under test (TDD):** `runnerActions` or `RunnerDriver` (map closing), `wakeRunner` (the wait), `buildBrief` (the rule). Red-green: (1) the last open piece of a map ends after its merge, and the map is closed with the initiative-closed comment; a map with another piece still open is left open; (2) a wake that posts nothing, after a step whose comment asks a question, leaves the run waiting on that question's words; (3) the system text states where a missing key goes and that a terminal session cannot add it.

> Sub-phase 40r must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"                          # expect 0
npx vitest run; echo "exit: $?"                             # expect 0
npm run --silent replay -- --dry; echo "exit: $?"           # expect 0, 19 of 19
```

- [ ] Red→green evidence in the handoff.
- [ ] **Human gate:** fvermaut runs the full replay once more (run 5); its output is added to `reports/phase-40-replay.md`.

---

### Sub-phase 40t: a named person's plain "stop" can end a run that has no pull request

> ✏ 2026-09-28 (build, timone#165): added at build, from replay run 5 ([phase-40-replay.md](reports/phase-40-replay.md)): on #115 the runner was told the work was done by hand, tried to end the run, and was refused — only `timone cancel`, a terminal command, could end a run whose branch holds commits and no pull request. PRD-05.R4 is amended to allow a named person's plain words too. Recorded in [phase-40-departures.md](reports/phase-40-departures.md).

**[MODIFY]** `src/runner/actions.ts` — `endRun` takes an optional `stopCommentAt`. When the branch holds commits and no pull request would otherwise refuse, a comment at that time on the ticket, written by a named person (not the machine), lets the run end without a pull request: code checks the comment, then cancels the run with a reason naming the comment. The runner judges whether the words ask to stop for good; code checks only that the comment exists and is theirs, as it does for approvals. An open pull request still refuses (40r).
**[MODIFY]** `src/runner/tools.ts` — `end_run`'s input gains `stop_comment_at`, described in plain words.
**[MODIFY]** `src/runner/brief.ts` — one rule: when a named person asks you to stop the work for good (for example because they did it themselves), end the run and name their comment by its time; the machine then ends it without a pull request. Do not ask them to run a command.
**[MODIFY]** `src/runner/actions.test.ts`, `src/runner/tools.test.ts`, `src/runner/brief.test.ts` — new cases only.

**Seams under test (TDD):** `runnerActions`, `buildBrief`. Red-green: (1) a run whose branch holds commits and no pull request ends when `endRun` cites a named person's comment, and the run is cancelled with a reason naming it; (2) the same with a comment by someone not named, or by the machine, is refused and the run is unchanged; (3) without a comment it is refused as before; (4) with the run's pull request open it is still refused; (5) the system text states the rule.

> Sub-phase 40s must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"                          # expect 0
npx vitest run; echo "exit: $?"                             # expect 0
npm run --silent replay -- --dry; echo "exit: $?"           # expect 0, 19 of 19
```

- [ ] Red→green evidence in the handoff.
- [ ] **Human gate:** fvermaut runs the full replay once more (run 6), or it rides to the pull request as owed.

---

### Sub-phase 40u: five faults the check found outside its verdicts

> ✏ 2026-09-29 (build, timone#165): added after verification, at fvermaut's word ("fix first"), from [phase-40-verification.md](reports/phase-40-verification.md), "Found outside the verdicts", items 1–5. The phase reopens for this slice; its completion report gains a note, and a fresh check re-runs the probes afterwards. Recorded in [phase-40-departures.md](reports/phase-40-departures.md).

**[MODIFY]** `src/runner/driver.ts` — **(1)** a run whose `start_step` was refused because the project was busy is woken once the project is free again (its holder done, cancelled or parked without a branch), with the event "The project is free now." It is woken once per freeing, not every cycle.
**[MODIFY]** `src/daemon/poll.ts` and `src/commands/cancel.ts` — **(2)** a `cancel` on a runner project also puts `timone:held` on the ticket, so the still-open, still-marked ticket is not taken up again as new work (the dropped-step rule, ADR-0044, applied to a runner ticket); and the command judges its success by the run it cancelled, not by whatever run the ticket holds afterwards, so it no longer says it failed when it did not.
**[MODIFY]** `src/runner/facts.ts` — **(3)** the list of pieces is looked for under the same name the merge uses (`ticket-NN.md`, at least two digits), through the one function that builds that name.
**[MODIFY]** `src/daemon/consult.ts` — **(4)** the one-turn check runs with no tools at all (`tools: []`) and no project settings (`settingSources: []`); it is handed a person's words and must be able to do nothing but answer.
**[MODIFY]** `src/runner/brief.ts` — **(5)** "Departures so far" lists only departures that exist: before any step of this run has run, there are none.
> ✏ 2026-09-29 (build, timone#165), found while building this slice: **[MODIFY]** `src/runner/departures.ts` (+ `departures.test.ts`, new case) — the cause of (5) is `departuresOf` itself: with no step reached, `order.slice(0, -1)` returns every step but the last. It returns none when nothing has run.
**[MODIFY]** the matching test files — new cases only.

**Seams under test (TDD):** `RunnerDriver` and `pollOnce` for (1) and (2); the cancel command's report function for (2); `gatherFacts` for (3); `sdkConsult` with an injected query for (4); `buildBrief` for (5). Red-green: (1) two runs picked up together, one refused as busy; when the other ends, the refused one is woken with the event, once; (2) a cancel on a runner project leaves the ticket held and no new run registered on the next cycle, and the command reports success; on a daemon project the cancel behaves as today; (3) a ticket numbered 7 finds `doc/plans/breakdowns/ticket-07.md`; (4) the options handed to the query carry `tools: []` and `settingSources: []`; (5) a brief for a run with no step yet shows no departures.

> Sub-phases 40t and the verification's fix loops must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"                          # expect 0
npx vitest run; echo "exit: $?"                             # expect 0
npm run --silent replay -- --dry; echo "exit: $?"           # expect 0, 19 of 19
```

- [ ] Red→green evidence in the handoff.
- [ ] A fresh check re-runs the phase's probes on the result and adds a short section to the verification report.

---

### Sub-phase 40v: recording an approval is not a step out of order

> ✏ 2026-09-29 (build, timone#165): added after delivery, at fvermaut's word ("fix first"), from the Spec review in [phase-40-delivery.md](reports/phase-40-delivery.md), finding 1, and the Standards review, finding 1. Both make the pull request say something untrue about the order. The phase reopens for 40v–40y; a fresh check re-runs the probes afterwards, and the pull request is delivered again. Recorded in [phase-40-departures.md](reports/phase-40-departures.md).

**[MODIFY]** `src/runner/record.ts` — the `step-started` entry gains an optional `records` field: the approval (`requirements` or `pieces`) that the session writes into its file. The allowed values come from the same list the `approval` entry's `what` uses, not a second copy.
**[MODIFY]** `src/runner/actions.ts` — `recordApproval` writes `records: what` on the `step-started` entry of the session that writes the approval into the file (through `watchStep`, which gains an optional argument for it). In `skippedBy`, a session with `records` is not the start of a step of the order.
**[MODIFY]** `src/runner/departures.ts` — `stepIndexOf` and `deliveredUnchecked` ignore a `step-started` entry that has `records`. The approval step is already reached by the `approval` entry.
**[MODIFY]** `src/runner/order.ts` — `standingOf` does not show a session with `records` as the running step of the order.
**[MODIFY]** `src/runner/brief.ts` — a step's line ("ran once", "ran 2 times", "running now") does not count a session with `records`, nor the `step-ended` entry with the same session id.
**[MODIFY]** `src/commands/record.ts` — a session with `records` is shown as recording that approval, not as a second run of the step whose stage it has.
**[MODIFY]** `src/runner/driver.ts` — **(Standards finding 1)** when the ticket's record cannot be read after a step ends, the pull request's list of departures is left as it is, and the failure is logged. Today an unread record counts as an empty one, and "The default order was followed." replaces an honest list.
**[MODIFY]** the matching test files — new cases only.

**Seams under test (TDD):** `departuresOf` and `departureSection`, `standingOf`, `buildBrief`, the record command's text function, and `RunnerDriver` over a record that cannot be read — all pure or already driven with fakes. Red-green: (1) a feature run that followed the order exactly, with both approvals recorded and each followed by its recording session, has no departures, and its section says "The default order was followed."; (2) the same run with sorting left out lists sorting only; (3) while a recording session runs, `standingOf` names no running step of the order; (4) the brief shows "writing down what it needs" as run once, not twice; (5) `timone record` names the recording session as recording the approval; (6) after a step ends on a ticket whose record has a broken line, the pull request's description is not changed.

> Sub-phase 40u must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"                          # expect 0
npx vitest run; echo "exit: $?"                             # expect 0
npm run --silent replay -- --dry; echo "exit: $?"           # expect 0, 19 of 19
```

- [ ] Red→green evidence in the handoff.

---

### Sub-phase 40w: a pull request closed without merging does not let the run drop its work

> ✏ 2026-09-29 (build, timone#165): added after delivery, from the Spec review, finding 6 (PRD-05.R4). R4's first clause refuses to end a run whose branch holds work with no *open* pull request; a closed one is not open.

**[MODIFY]** `src/runner/actions.ts` — `endRun` refuses when the branch has commits not on the default branch and its pull request was closed without merging, exactly as when it has no pull request: it ends only on a named person's comment asking to stop (`stopCommentAt`, checked as today). The refusal says the pull request was closed without merging, and names the two ways the run can end: a new pull request that is merged, or a named person asking on the ticket to stop. A merged pull request still ends the run. A closed one on a branch with no commits ahead still ends it.
**[MODIFY]** `src/runner/brief.ts` — the rule for a pull request closed without merging gains: when no comment says why it was closed, ask on the ticket whether to do the work again or to stop, and do not end the run until a named person says to stop. The rule that a run waits on its pull request no longer says a closed one ends the run.
**[MODIFY]** the matching test files — new cases only. An existing case that expects a closed pull request to end a run whose branch is ahead is changed to expect the refusal, and the handoff names it.
> ✏ 2026-09-29 (build, timone#165), found while building this slice: **[MODIFY]** `src/runner/tools.ts` (+ its test file) — the `end_run` action's description, and its `stopCommentAt` field's, still told the runner that a closed pull request ends the run, and offered the stop comment only for a run with no pull request. They now say what the code does.

**Seams under test (TDD):** `runnerActions` over the fake adapter, as the existing `endRun` cases are; `buildBrief` for the rule text. Red-green: (1) branch ahead, pull request closed without merging, no stop comment: refused, the run stays; (2) the same with a named person's stop comment: the run is cancelled, as with no pull request; (3) the same with a stranger's comment: refused; (4) pull request merged, branch ahead: the run ends, as today; (5) pull request closed, branch not ahead: the run ends.

> Sub-phase 40v must be complete before starting this sub-phase (both change `actions.ts` and `brief.ts`).

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"                          # expect 0
npx vitest run; echo "exit: $?"                             # expect 0
npm run --silent replay -- --dry; echo "exit: $?"           # expect 0, 19 of 19
```

- [ ] Red→green evidence in the handoff.

---

### Sub-phase 40x: a runner project's run is never failed; a merge that fails wakes the runner

> ✏ 2026-09-29 (build, timone#165): added after delivery, from the Spec review, finding 2 (PRD-05.R9, R11, R16). On a runner project nothing wakes the runner for a failed run, `timone retry` refuses there, and the failure comment points at a standing note a runner project does not have.

**[MODIFY]** `src/daemon/chunk-zero.ts` — the merge of the approved list of pieces can be asked for without failing the run: a form that returns the reason it did not merge and writes nothing, beside the form the current daemon uses, which fails the run and posts `failedComment` exactly as today.
**[MODIFY]** `src/runner/actions.ts` — `closeChunkZero` uses the form that writes nothing. When the merge, or opening the step tickets, does not succeed, the run is **not** failed: it stays on the runner's wait, the record gets a `notice` naming what failed and why, the ticket gets one comment in plain words saying what failed and that a reply on the ticket is read, and the runner is woken with an event naming the failure.
**[MODIFY]** `src/runner/comments.ts` — that comment. It names no command and no standing note.
**[MODIFY]** `src/runner/driver.ts` — only as needed to deliver that event on the wake that follows the step's end.
**[MODIFY]** the matching test files — new cases only.

Before building, search every `store.fail` call for one a runner project's run can reach. `src/daemon/poll.ts`'s reclaim already hands a runner run back to the runner (40h); the spawner's calls in `session.ts` are the current daemon's. If another reachable call is found, it is changed the same way in this slice, and the handoff names it.

**Seams under test (TDD):** `runnerActions` with a fake adapter whose merge refuses (a conflict) and, separately, whose ticket creation throws; `mergeChunkZero`'s current-daemon form, whose existing tests must pass unchanged. Red-green: (1) on a runner project, an approval of the list of pieces whose merge conflicts leaves the run `parked` on the runner's wait, not `failed`; the record holds a notice naming the conflict; one comment is posted, with no command in it; the next wake's events name the failure; (2) the same when opening the step tickets fails; (3) the current daemon's `mergeChunkZero` still fails the run and posts `failedComment`.

> Sub-phase 40w must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"                          # expect 0
npx vitest run; echo "exit: $?"                             # expect 0
npm run --silent replay -- --dry; echo "exit: $?"           # expect 0, 19 of 19
grep -n "store.fail\|\.fail(" src/runner/*.ts | grep -v test   # expect no line
```

- [ ] Red→green evidence in the handoff.

---

### Sub-phase 40y: a step running on a current-daemon project does not hold up the runner's projects

> ✏ 2026-09-29 (build, timone#165): added after delivery, from the Spec review, finding 3 (PRD-05.R15). The poll cycle walks the projects one after another, and on a current-daemon project it waits for the whole session. So while ivtrends builds, scratch-app's runner is not woken. The current daemon's own path must not change: ivtrends runs on it.

**[MODIFY]** `src/daemon/poll.ts` —
- `pollProjects` walks the runner's projects first, then the current daemon's. Their turns never wait for a session, so they finish before any daemon project can block the cycle.
- While the rest of the cycle runs, the runner's projects get a turn of their own every poll interval, on a clock of their own, built the way `watchForCancellations` is: one look at a time, errors caught and reported as lines, the timer unref'd and stopped before the cycle reports. A turn is `pollProject` for each runner project. It does not reclaim and does not release previews: those stay once per cycle.
- A daemon project's turn is unchanged, and so is a manifest with no runner project.
**[MODIFY]** `src/daemon/poll.test.ts` — new cases only.

Human requests other than a cancel (`timone takeover`) are still carried out at the start of the next cycle. A cancel already has its own clock (ADR-0047). This limit is written in the handoff for the delivery report.

**Seams under test (TDD):** `pollOnce` with a fake spawner whose `spawn` does not resolve until the test releases it, fake timers, and a stub runner driver, as the existing `pollOnce` cases are built. Red-green: (1) a daemon project whose session is running, and a runner project: within one poll interval, the runner project's turn runs again (its `tick` is called a second time) while the daemon session is still running; (2) its turns stop when the cycle ends; (3) two turns never overlap; (4) with only daemon projects, the cycle behaves as today (the existing cases pass unchanged); (5) the runner's projects are walked before the daemon's in one cycle.

> Sub-phase 40x must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"                          # expect 0
npx vitest run; echo "exit: $?"                             # expect 0
npm run --silent replay -- --dry; echo "exit: $?"           # expect 0, 19 of 19
```

- [ ] Red→green evidence in the handoff.
- [ ] A fresh check re-runs the phase's probes on the result, after 40y, and adds a short section to the verification report.

---

### Sub-phase 40z: a comment about a missing key never writes the takeover command

> ✏ 2026-09-29 (build, timone#165): added after replay run 6 ([phase-40-replay.md](reports/phase-40-replay.md)). Case #120 passed two tries of three: one try wrote `timone takeover` in its new comment, most likely to say it cannot add the key. The case counts that as the fault on purpose, and the rule of this phase is that the runner's rules change, never the case (40j). Recorded in [phase-40-departures.md](reports/phase-40-departures.md).

**[MODIFY]** `src/runner/brief.ts` — the rule for a key or secret missing where a step runs gains: do not write the takeover command in that comment, not even to say that it will not help. A person who reads a command runs it.
**[MODIFY]** `src/runner/brief.test.ts` — new case only.

**Seams under test (TDD):** `buildBrief`, for the rule text. Red-green: (1) the brief's rule on a missing key says not to write the takeover command in the comment, even to say it will not help.

> Sub-phase 40y must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"                          # expect 0
npx vitest run; echo "exit: $?"                             # expect 0
npm run --silent replay -- --dry; echo "exit: $?"           # expect 0, 19 of 19
```

- [ ] Red→green evidence in the handoff.
- [ ] **Human gate:** fvermaut runs `npm run --silent replay` from his own terminal (run 7); its output is added to `reports/phase-40-replay.md`.

---

### Sub-phase 40l: scratch-app moves to the runner, and one watched run

**[MODIFY]** `timone.yaml` — top-level `operator: fvermaut`; `scratch-app` gains `driver: runner`. ivtrends and timone stay on the current daemon.
**[NEW FILE]** `doc/plans/phases/reports/phase-40-live-gate.md` — what was watched, and what was seen.

No behaviour-carrying code in this sub-phase, so no seams are declared; validation is the watched run. The ticket text is machine-typed, and says so.

The watched run needs the operator to start the daemon from his own terminal, where its model login lives, and a session that starts it stops it afterwards. On scratch-app, with one new ticket, it checks:

- **R9** — a comment in plain words ("try again", with a spelling mistake) moves the run; a comment on the pull request asking for a change gets a reply before the change starts;
- **R12** — a check arrives 15 minutes into a step, with the commands run;
- **R13** — the runner sends a running step a message, and the step's next turn shows it;
- **R15** — while a step runs on scratch-app, `observedAt` in `.timone/state.json` keeps moving, and a comment on an ivtrends ticket is read in that time;
- **R5, R6** — a departure is posted on the ticket when it happens and listed on the pull request.
- ✏ 2026-09-27 (build, timone#165) — **40d's owed probe**: from the operator's logged-in terminal, two stream-json messages into `claude -p --input-format stream-json --replay-user-messages` give two model answers; and during the watched run, a message the runner sends while the step is in a tool call is replayed (`"isReplay":true` in the step's transcript) and the step then ends by itself. See [phase-40-departures.md](reports/phase-40-departures.md).

If it cannot be run before the pull request, the pull request lists it as owed (ADR-0059 D1), the four criteria stay `draft`, and ivtrends does not move until it has been run.

> Sub-phases 40h and 40j must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
npx tsx src/cli.ts projects list; echo "exit: $?"      # expect 0, scratch-app shown
grep -n "driver: runner" timone.yaml                    # expect one line, under scratch-app
```

- [ ] **Human gate:** fvermaut starts the daemon for the watched run, or decides it rides to the pull request.
- [ ] The live-gate report records each check with its ticket comment or log line.

---

### Sub-phase 40m: the README says what a runner project is

**[MODIFY]** `README.md` — a short section: what a runner project is; how to switch a project (`driver: runner`); who may instruct it (`operator`, `instructors`); the limit and how to say go on; `timone record`; that `timone retry` refuses on a runner project.

No behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based.

> Sub-phase 40l must be complete before starting this sub-phase (the section describes what was watched working).

#### Agent Validation Steps

- [ ] The section follows Timone's rules for writing to a person: short sentences, plain words, no process vocabulary.

---

## Dependency graph

```
40a → (none)              one step session, started and watched outside the spawner
40b → 40a                 manifest fields and forge calls (shares test doubles with 40a)
40c → (none)              record, default order, departures, limit — parallel with 40a/40b
40d → 40a                 the box takes messages; activity summary
40e → 40a, 40b, 40c, 40d, 40f  the runner's actions and the rules around them  (✏ 2026-09-27: + 40f)
40f → 40b, 40c            the brief, and ticketKindOf — parallel with 40d
40g → 40e, 40f            the runner session, one per wake, and its failures
40h → 40g                 the driver in the poll cycle
40i → 40g                 timone record — parallel with 40h/40j/40k
40j → 40g                 the replay of recorded failures
40k → 40e                 the skills accept a skipped approval
40n → 40h                 a step ticket's claim is not shown as a hold  (✏ 2026-09-27: added at build)
40o → 40h, 40j            an approval comes after what it approves; an interrupted step gets its end  (✏ 2026-09-27: added at build)
40p → 40o                 the runner's rules carry what the replay showed missing  (✏ 2026-09-28: added at build)
40q → 40p                 the ticket's newest message says what it needs now  (✏ 2026-09-28: added at build)
40r → 40q                 a run waits on its pull request; the ledger knows the step; a shared reason once  (✏ 2026-09-28: added at build)
40s → 40r                 a map closes with its last piece; the wait says what it waits on; where a key goes  (✏ 2026-09-28: added at build)
40t → 40s                 a named person's plain "stop" can end a run with no pull request  (✏ 2026-09-28: added at build)
40u → 40t                 five faults the check found outside its verdicts  (✏ 2026-09-29: added after verification)
40v → 40u                 recording an approval is not a step out of order  (✏ 2026-09-29: added after delivery)
40w → 40v                 a pull request closed without merging does not let the run drop its work  (✏ 2026-09-29: added after delivery)
40x → 40w                 a runner project's run is never failed; a failed merge wakes the runner  (✏ 2026-09-29: added after delivery)
40y → 40x                 a current-daemon step does not hold up the runner's projects  (✏ 2026-09-29: added after delivery)
40z → 40y                 a comment about a missing key never writes the takeover command  (✏ 2026-09-29: added after replay run 6)
40l → 40h, 40j, 40n, 40o, 40q, 40r  scratch-app moves; the watched run
40m → 40l                 README
```
