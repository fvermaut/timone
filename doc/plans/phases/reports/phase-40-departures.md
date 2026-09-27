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
