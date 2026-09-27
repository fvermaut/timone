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
