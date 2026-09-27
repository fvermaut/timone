# Phase 40 — Departures record

> One dated entry per departure, appended as it happens, never rewritten. Format per `.claude/skills/timone-execute/SKILL.md`, "The departures record".

## 2026-09-27 — timone#165, planning

**Kind:** requirement amended

**Agreed:** [PRD-05.R12](../../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md) said the 15-minute summary gives "the commands the step ran since the last check, the time taken and the cost".

**Did instead:** The summary gives the commands, the time taken and the output so far. The step's cost is recorded when the step ends. The criterion is amended in place with a dated marker.

**Why:** A session reports `total_cost_usd` only in its final `result` message (`SessionProgress.observe`, `src/daemon/progress.ts`). While it runs, the stream carries output token counts and no cost. A cost worked out from a price list would be a guess presented as a fact.

## 2026-09-27 — timone#165, planning

**Kind:** requirement read narrowly

**Agreed:** [PRD-05.R8](../../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md) says that at the limit "no session starts", and that a named person's "continue", "in any wording that means it", allows another $150.

**Did instead:** At the limit, no step session and no runner session starts. The named person's reply is read by a one-turn check with no tools and no actions — the same kind of call as the ask check (`src/daemon/consult.ts`) — which only answers whether the reply means go on. Code then records the raise and wakes the runner.

**Why:** Reading "go on" in any wording needs a model, and the runner is exactly the session R8 keeps from starting. The check costs a fraction of a cent, can do nothing but answer yes or no, and its answer is acted on by code. Recorded so the reader of R8 sees the one model call that still happens at the limit.

## 2026-09-27 — timone#165, execution

**Kind:** plan step

**Agreed:** Sub-phase 40d said the in-process runtime (`agentSdkRuntime`) would take messages while a step runs, through streaming input, under the same rule as the box.

**Did instead:** The in-process runtime is left as it is. It starts an interactive request as it starts any other and offers no `send`; the runner's `messageStep` refuses on it. The plan is amended in place.

**Why:** The plan declared no seam and no red-green case for that change, so it could not be built test-first as written. The daemon runs the container runtime unless `--runtime in-process` is given, and the steps the runner starts run in the box, where 40d does build the message mode.

## 2026-09-27 — timone#165, execution

**Kind:** plan step

**Agreed:** Sub-phase 40b said `setPullRequestBody` passes the body on standard input, `gh pr edit --body-file -`.

**Did instead:** The body is written to a temporary file, passed as `gh pr edit --body-file <path>`, and the file is removed afterwards, whether the call succeeded or not. The plan is amended in place.

**Why:** The `CommandRunner` the adapter runs `gh` through has no way to pass standard input (`CommandOptions` holds only `cwd`, `env`, `repository` and `timeoutMs`). Widening it would also widen the credential wrapper that every forge call goes through, for one method. A temporary file needs no change outside the adapter.

## 2026-09-27 — timone#165, execution

**Kind:** plan step

**Agreed:** Sub-phase 40f built the brief and the facts, and could run in parallel with 40d and 40e. Nothing in the plan said where a ticket's kind is worked out from its labels.

**Did instead:** 40f also adds `ticketKindOf(labels, context)` to `src/runner/order.ts`, with a test in a new `src/runner/order.test.ts`. 40e now waits for 40f. The plan and its dependency graph are amended in place.

**Why:** The brief needs the kind to show the default order, and the runner's actions need it to tell whether a step is a departure. One function beside `defaultOrder` keeps both reading the same answer.

## 2026-09-27 — timone#165, execution

**Kind:** check not run

**Agreed:** Sub-phase 40d's validation ran a protocol probe against the real model: two user messages into `claude -p --input-format stream-json`, two model answers out.

**Did instead:** The probe ran, and gave two `result` messages, but both were login errors: the command-line tool is not logged in from the build's sandbox, and running it outside the sandbox was refused, so the build did not try again another way. The same shape in the box image, with no token, replayed both messages and gave two results. That confirms the protocol the end rule rests on, but not a model's answer, and not that a message joining a turn during a tool call is replayed. Both checks move to the watched run on scratch-app (40l), which the plan amends to say so. The slice is committed with the checkbox unmet.

**Why:** The probe needs the operator's own logged-in terminal, and a second attempt from the same sandbox would fail the same way. If a message that joins a running turn were not replayed, the box would keep its stdin open after the last `result` until stopped, and the runner's `stopStep` or the ticket's limit would be the only way out — which is why it is worth watching once for real.

## 2026-09-27 — timone#165, execution

**Kind:** plan step

**Agreed:** Sub-phase 40e said `mergeChunkZero` refuses unless the ticket's run record holds an `approval` entry for the list of pieces, and that "the current daemon's path supplies its approval the same way".

**Did instead:** `mergeChunkZero` takes the approval as a required argument, `{ by, at }`. The runner's path passes it only from the record's `approval` entry, and its `recordApproval` action refuses before any merge when there is none. The current daemon passes the approval it read from the person's reply. `src/daemon/session.ts` is granted to 40e for that one call site, and case (6) is reworded to test both.

**Why:** The current daemon keeps no run record, so it could not supply the approval "the same way" without writing records it never reads, and `session.ts` was not in the slice's file list. A required argument makes a merge with no approval impossible to write on either path, which is what R3 asks of every merge path.

## 2026-09-27 — timone#165, execution

**Kind:** plan step

**Agreed:** The amended 40e granted `src/daemon/session.ts` for "one call site": `recordApproval` passing the gate's approval to `mergeChunkZero`.

**Did instead:** Two call sites changed. The spawner also keeps a private `mergeChunkZero` delegator, which `session.test.ts` reaches by name; it would not compile without the approval, so it now takes the approval and passes it on. No test file changed. The plan is amended in place. `attemptMerge`, the lower-level merge the delegators use, stays exported for the same tests and takes no approval; nothing in the runner calls it. It is listed for the delivery review as the one merge path the compiler does not guard.

**Why:** The plan's "one call site" counted the wrong number of callers. The second is the same spawner path and carries the same approval, so the guard is unchanged in strength.

## 2026-09-27 — timone#165, execution

**Kind:** plan step

**Agreed:** Sub-phase 40g added the wait kind `runner` and said "every exhaustive switch over the wait kind the compiler reports" in `cta.ts`, `status.ts`, `takeover.ts` and `retry.ts` would be changed, with no test of its own.

**Did instead:** Those files read the wait kind with `if` chains, so the compiler named none of them. The changes were made as the plan and the orchestrator's notes ask — `status` prints "waiting: <on>", `takeover` treats `runner` as an escalation, `retry` refuses with the plan's sentence, and `cta.ts` has a `runner` arm that asks for nothing — each checked by a scratch script, not a test. Their tests move to 40h (`takeover`, `retry`) and 40i (`status`, including the side effect that the status line's last sentence does not count a runner wait). `package.json` gains `@modelcontextprotocol/sdk` 1.30.0 as a development dependency: 40g's test drives the real tool server through an MCP client, and the package was only present because the agent library depends on it.

**Why:** A behaviour change with no test is a plan defect under the undeclared-seams rule. The cheapest honest fix is to give the tests to the slices that already own those files' seams, rather than let 40g edit test files it was not granted.

## 2026-09-27 — timone#165, execution

**Kind:** check not run

**Agreed:** Sub-phase 40j's validation runs `npm run replay`, which wakes the real runner on each of the nineteen recorded cases, three times each.

**Did instead:** The build writes the harness, the cases and the harness's own tests. The replay itself is moved to a human gate: the operator runs it once from his own logged-in terminal before delivery, and its output goes to `reports/phase-40-replay.md`. The plan is amended in place.

**Why:** The build's sandbox has no model login: `claude auth status` reports `loggedIn: false`, no `CLAUDE_CODE_OAUTH_TOKEN` or API key is set, and 40d's probe failed on login for the same reason. Every call to the real model — the replay, 40d's owed probe, the watched run — needs the operator's terminal.
