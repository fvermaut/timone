# Phase 40: The runner — an agent decides each step, beside the current daemon

> **Status:** Planned.

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
**[MODIFY]** `src/daemon/chunk-zero.ts` — `mergeChunkZero` refuses unless the ticket's record holds an `approval` entry for `pieces`. The current daemon's path supplies its approval the same way, so its behaviour does not change.
**[MODIFY]** `src/daemon/prompts.ts` — `runnerInstructionsBlock(instructions, skipped)`: the runner's instructions under their own heading, and — when an approval was skipped — the exact sentence *"The runner skipped the approval of <what>, and recorded that it did."* that 40k teaches the skills to read.
**[NEW FILE]** `src/runner/actions.test.ts`, `src/runner/tools.test.ts`

**Seams under test (TDD):** `runnerActions` over the stub adapter, a fake step starter and a temporary records directory — classical, no mocks of the unit's own collaborators. Red-green: (1) `RUNNER_TOOL_NAMES` equals the list of R2 exactly, and no name contains edit, write, shell, bash, push or merge; (2) a skip posts the departure notice before the step starts — asserted on the order of calls; (3) a skip with no reason is refused and nothing starts; (4) over the limit, `startStep` is refused twice and the limit notice is posted once; (5) `recordApproval` with a comment by a login not named is refused and records nothing; with a named login it records the approval and starts the approval step; (6) **R3 falsified**: `mergeChunkZero` with no `approval` entry refuses, and the fake forge's default branch has not moved; (7) **R4 falsified**: `endRun` with `aheadOfDefault` 2 and no open pull request is refused, and the run is not completed; with 0 it completes; (8) `post` without the call-to-action line is refused; (9) `fileTimoneIssue` creates the issue on the `timone` project with the label `bug`; (10) **R7 falsified**: no action writes an `approval` entry except `recordApproval`, and `recordApproval` writes one only for a named person's comment — asserted by driving every action once with a non-named comment in the thread and reading the record.

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

**Seams under test (TDD):** `pollOnce`, the seam the cycle is already tested at, with a fake wake; and `RunnerDriver` for the step-end bookkeeping. Red-green: (1) a new ticket on a runner project asks for a wake and the old spawner is never called; (2) every existing `poll.test.ts` case passes unchanged — the current daemon's projects behave as before; (3) **R15**: `pollOnce` resolves while a fake step never completes, and in that same cycle a second project's named comment asks for a wake; (4) a named person's comment asks for a wake; a comment by someone not named does not; (5) a `retry` request on a runner project is settled with the refusal and the run is unchanged; (6) a `cancel` request calls `driver.stop` and cancels the run; (7) a stale runner run is parked with kind `runner` and a wake is asked for, and the run is not failed; (8) a merged pull request asks for a wake carrying that fact; (9) on a held ticket a named comment wakes and nothing else does; (10) at the limit, a named "go on" comment with the check answering yes records `limit-raised` and wakes, and with no changes nothing; (11) a step that ended records its cost and rewrites the pull request's body with the departure section first and the rest of the body kept.

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

**Seams under test (TDD):** the command's pure render function over a record fixture. Red-green: (1) each step with its times and cost; (2) each decision with its reason; (3) the departures; (4) total against limit; (5) a ticket with no record gives a sentence saying so, and exit code 1.

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

- [ ] The replay's full output, and its total cost, are in the handoff.
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
40l → 40h, 40j            scratch-app moves; the watched run
40m → 40l                 README
```
