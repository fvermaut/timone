# Phase 49 — Completion Report

- **Date:** 2026-10-05
- **Plan:** [phase-49.md](../phase-49.md) — piece 5 of the [list of pieces for #197](../../breakdowns/ticket-197.md), approved by fvermaut 2026-10-04T06:34:53Z — 6 pieces
- **Requirements:** PRD-07.R2, R4, R5, R6 and R12 (all MUST) — still `draft` in the register; verification sets them.
- **Branch:** `timone/203-5-two-places-and-the-planner`
- **Departures:** [`phase-49-departures.md`](phase-49-departures.md) — 6 entries.

## Summary

Each project now has the number of places its entry in `timone.yaml` sets with `places`, and 2 when it sets none (49a). The ledger is told the number by every command that opens it. The daemon picks up every step ticket of an initiative that is open, unblocked, unheld and unclaimed, not only the first (49b). The push guard refuses the first push of a work branch that carries a commit of another `origin/timone/*` branch, and names that branch (49c).

The centre of the phase is the planner ([ADR-0065](../../../adr/0065-the-planner-is-a-session-of-its-own-asked-when-a-build-would-start.md)). Starting the build is refused while the run has no decision of the planner, and the ledger then writes that the run waits for it (49d). Code gathers the facts — the ticket's plan files, the tickets building or with an open pull request and their files, the blockers, and the named person's comment that woke it — and the planner answers with one of `let_build`, `hold` or `pass_to_runner`, each checked by code (49e). Code writes the hold comment, naming each ticket waited for. The daemon runs at most one planner session per project, decides waiting tickets in the order places are given, asks again for a held ticket once nothing it waits for is building or open, and sends a named person's comment on a waiting ticket to the planner, not the runner (49f). A let-build decision wakes the runner once. Each session's cost is written into the ticket's record and counts on its limit.

`timone status` names what the planner is deciding and holding (49g). The old rules — PRD-02.R22 clause 1, PRD-05.R15 clause 2, `process.md` stages 5 and 6, the planning instructions and `CONTEXT.md` — carry dated notes naming ADR-0065 (49h). No project in `timone.yaml` sets `places`, so ivtrends gets two places too; whether it should be set to 1 until the live check on scratch-app has passed is the operator's choice when merging.

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 49a — places from `timone.yaml`, 2 by default | landed in an earlier try of this step; four test files granted by amendment (departure 3) | `bfabff8` |
| 49b — every open, unblocked step picked up | landed in an earlier try of this step; one test file granted by amendment (departure 4) | `bbaf511` |
| 49c — a branch carrying another ticket's commits refused at its first push | landed; a test listing the files that run git needed `guardrails.ts`, found by 49d's checks and fixed in its own commit (departure 5) | `b057587`, `e4e2bc5` |
| 49d — no build without the planner's decision | landed; `src/daemon/prompts.ts` granted by amendment (departure 6) | `bc665a8` |
| 49e — the planner's facts, instructions and answers | landed | `6bc7944` |
| 49f — the planner's sessions and loop | landed | `43ead4e` |
| 49g — `timone status` names what the planner holds | landed | `2bffc3d` |
| 49h — the old words changed where they are written | landed | `00e26ba` |

The earlier try of this step committed 49a and 49b and then stopped. This run checked both against their handoff sections and the plan, kept them, and started at 49c.

## Tests run

No suite was timed before the first slice of this run: the earlier try timed the whole suite at 3.8 s, under a minute. The runner's instructions for this step asked that each slice run only the tests of what it changes, and the whole suite once at the end (departure 1). `npm run build` was run before the test files that run `dist/cli.js`. `npm run replay` was not run at any point: this container has no model login (departure 2); `src/runner/replay/harness.test.ts` ran instead.

- **49a, 49b:** see their handoff sections (earlier try).
- **49c:** `src/daemon/push-guard.test.ts`, `src/daemon/push-guard.git.test.ts`, `src/commands/guardrails.test.ts` (94); also `src/cli.test.ts`, `src/daemon/session.test.ts`, `container-runtime.test.ts`, `hooks.test.ts`, `forge-guard.test.ts`, `src/merge-rules.git.test.ts` (240). Pass.
- **49d:** `src/daemon/runs.test.ts` and all of `src/runner/` (363); `src/guards/checkouts.test.ts`, `src/daemon/prompts.test.ts` and all of `src/commands/` (445); `src/daemon/`, `src/cli.test.ts`, `src/guards/`, `src/workspace.test.ts`. Pass, after the 49c fix.
- **49e:** `src/planner/`, `src/adapters/`, `src/runner/actions.test.ts`, `src/runner/facts.test.ts` (299); all of `src/runner/`, `src/commands/daemon.test.ts`, `takeover.test.ts`, `src/daemon/chunk-zero.test.ts`, `hooks.test.ts`, `poll.test.ts` (507). Pass.
- **49f:** `src/planner/`, `src/runner/`, `src/daemon/` (1265); its block also lists the whole suite: 73 files, 1847 tests. Pass.
- **49g:** `src/commands/status.test.ts` (50); `src/cli.test.ts`, `src/guards/checkouts.test.ts`, `src/planner/plan-files.test.ts` (17). Pass.
- **49h:** no behaviour; `src/process-text.test.ts` and `src/planner/plan-files.test.ts`, which read the changed documents (45). Pass.
- **Close:** every sub-phase's validation steps run once, in the order 49a to 49h — none resets shared state, so written order was safe — all pass: `tsc --noEmit` exit 0; 49a's tests 462; both greps exit 1; every `RunStore.open` under `src/commands/` passes `placesOf`; 49b 183; 49c 94; 49d 367; 49e 312, one definition each of `namedPersonsComment` and `filesAddedOnBranch`; 49f 1265; 49g 50; 49h's greps exit 0 and no `Status:` line changed. Then the whole suite once, after `npm run build`: **73 files, 1851 tests, all passed, 3.9 s.** The validation steps ran before the whole suite, the reverse of the written order; nothing changed between the two runs.

## Screen comparison

None — the phase changes no screen. (`timone status` is terminal text; ticket comments are GitHub text.)

## Deviations from the plan

- **Departure 1, check not run:** slices ran only the tests of what they changed, and the whole suite once at the close, as the runner's instructions asked.
- **Departure 2, check not run:** `npm run replay` (49d, 49f) cannot run without a model login. It is owed on the operator's machine.
- **Departures 3 and 4 (earlier try):** ✏ 2026-10-05 amendments granted 49a four test files and 49b `src/daemon/chunk-zero.test.ts`.
- **Departure 5:** ✏ 2026-10-05 amendment granting `src/guards/checkouts.test.ts` to 49c, committed as `fix: 49c — …` after 49c, because 49d's checks found it.
- **Departure 6:** ✏ 2026-10-05 amendment granting `src/daemon/prompts.ts` to 49d.
- **Choices inside slices that differ from the plan's letter**, each explained in its handoff section: `askPlanner(id, order)` takes the place order (the plan left this open); the `planner-decision` record entry names its field `decision`, not `kind`, because `kind` is the entry's type; `addedOn` is renamed `filesAddedOnBranch`; `gatherPlannerFacts` takes the waking comment as a fourth argument; the let-build event reads `The planner let this ticket be built now: <reason>` (the plan gives no words).

## Context for the next agent

- **Run:** `npm install`, `npm run build`, `npx vitest run`. `npm run replay` needs a model login.
- **Owed before merging, on the operator's machine:** `npm run replay` (PRD-05.R18), and PRD-07.R5's live check on scratch-app, never ivtrends: three test tickets — two whose plans change most of the same files, one that changes none of them — where the planner lets one of the first two and the third build at once, and holds the other with a comment naming the ticket it waits for.
- **PRD-07.R2's check script checks one place**; with this phase the default is two, so verification must amend it (the builder did not read it).
- **A stale note:** the 2026-10-04 note under PRD-07.R12 in the register still says PRD-02.R22 clause 1 and PRD-05.R15 clause 2 are "not changed yet (piece 5)". They are changed now (49h). The register was not in this phase's files.
- **Refactoring left for review**, all named in the handoffs: small helpers copied into `src/planner/` (`sentence`, `answer`, `quoted`, `listOrNone`, `factLine`); the rule for "building" written twice (`planner/facts.ts` and `planner/driver.ts`); the SDK message reading copied from `runner/session.ts` into `planner/session.ts`; the all-zeros test written twice for the push guard.
- **Known limits:** a planner session lost to a daemon restart is started again next cycle, but a comment it was reading stays marked read. After three failed tries to reach the model, nothing is posted on the ticket; the run waits and the next cycle tries again. The push guard sees only `origin/timone/*` branches the clone has fetched. A clone without `origin/HEAD` refuses every first push of a work branch; a box's `git clone` sets it.
- **What no criterion watches** (the plan's list): `endRun` in `src/runner/actions.test.ts`, the place-order cases in `src/daemon/runs.test.ts` and the frontier tests in `src/daemon/steps.test.ts` all pass.
