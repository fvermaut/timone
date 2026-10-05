# Phase 51: A takeover waits for the running step — `timone takeover` typed while a step of its ticket runs says which step it waits for, waits for it to end, and opens the session before the runner starts anything else

> **Status:** Complete — see [reports/phase-51-complete.md](reports/phase-51-complete.md).

> **Companion phases:** [phase 47](phase-47.md) — built the place rule and the `takenOver` mark (ADR-0063 D5) that a waiting terminal's claim reuses, and changed the takeover's refusals for other tickets of the project (PRD-07.R13). [phase 41](phase-41.md) — rebuilt `timone takeover` on the runner: the request to the daemon, the claim for the terminal's holder, and the hand back that wakes the runner (PRD-05.R11). [phase 50](phase-50.md) — the last change to `afterStep` in `src/runner/driver.ts`, which this phase changes again. Piece 2 of the same list ([#213](https://github.com/fvermaut/timone/issues/213)) will make every question name the command; it needs this phase and shares none of its code. Governing decisions: [ADR-0067](../../adr/0067-a-takeover-typed-while-a-step-runs-is-written-on-the-run-and-takes-it-when-the-step-ends.md) — recorded while planning this phase; D1 is 51a's ledger field and 51b's second-terminal rule, D2 is 51a's hand-over and 51b's dead-terminal rule, D3 is 51a's wait and 51b's Ctrl-C, D4 is 51d. [ADR-0049](../../adr/0049-a-runs-proof-of-life-is-its-holder-and-its-wait-is-one-value.md) D1–D3 — a run's holder is its proof of life, asked of the holder's process; D3's bounded wait still covers the daemon reading the request. [ADR-0032](../../adr/0032-a-human-command-asks-the-daemon-to-act.md) and [ADR-0023](../../adr/0023-one-answer-one-session.md) — the daemon is the ledger's only writer and settles every request on the cycle that reads it; nothing here leaves a request on disk. [ADR-0060](../../adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md) — only the runner moves a run on; a terminal session ends by waking it. [ADR-0063](../../adr/0063-a-ticket-takes-a-place-only-while-one-of-its-steps-runs.md) D5 — a person's terminal takes no place. [ADR-0048](../../adr/0048-a-verification-probe-is-kept-proved-able-to-fail-and-hidden-from-the-builder.md) D4 — the builder never opens the probe folders. [ADR-0050](../../adr/0050-timone-becomes-a-managed-project-once-the-run-path-is-fixed.md) D5 — this project is Timone, so `process.md` and `README.md` are its source and are committed here.

> **Screens changed:** none — no slice changes anything a person sees on a screen Timone draws. (The waiting line is printed in a terminal.)

## Requirements

> **PRD:** [prd-09-a-question-names-the-command-that-answers-it-in-a-terminal.md](../../specs/prd/prd-09-a-question-names-the-command-that-answers-it-in-a-terminal.md) — criteria in [prd-09-a-question-names-the-command-that-answers-it-in-a-terminal.criteria.md](../../specs/prd/prd-09-a-question-names-the-command-that-answers-it-in-a-terminal.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-09.R4 | MUST | A takeover typed while a step of its ticket runs does not refuse; it says in one sentence which step it waits for and that Ctrl-C stops the wait; when the step ends the session opens and the runner starts nothing on the ticket in between; Ctrl-C leaves the run as if the command had never been typed; with no daemon running it says so and does not wait |
| PRD-09.R5 | MUST | *For the takeover paragraph only:* `process.md`'s paragraph on `timone takeover` says a takeover typed while a step runs waits for it, then opens; no written rule says a takeover refuses while a step of its own ticket runs |

This is piece 1 of the [list of pieces for #213](../breakdowns/ticket-213.md), approved by fvermaut on 2026-10-05 with two pieces. R5's rules on asking, and R1–R3, are piece 2's.

## Goal Description

Today `findTakeover` in `src/commands/takeover.ts` answers *"I'm working on <project> #<n> right now"* for a run that is `active`, and opens nothing. A question is often posted by a step that is still ending, so a person who copies the takeover command from it the moment it appears is refused. Piece 2 is about to put that command in every question, and `process.md` forbids naming a command the machine would refuse. This phase removes the refusal for a running step, and nothing else about the takeover.

[ADR-0067](../../adr/0067-a-takeover-typed-while-a-step-runs-is-written-on-the-run-and-takes-it-when-the-step-ends.md), recorded while planning this phase, decides how. The command asks the daemon as it does today. The daemon writes the terminal's holder on the run as **the terminal that waits for the step**, and settles the request. When the step ends, `afterStep` in the driver puts the run on its after-step wait and claims it for that terminal in the same synchronous code, and asks for no runner wake. The terminal, which has been watching the ledger, sees its own claim and opens the session. When the session ends, the runner is woken as for every takeover, and is told the step's end with the session's end. Ctrl-C needs no write: the step's end finds the terminal's process gone, and wakes the runner as if nobody had waited.

**Decisions taken at planning, below the ADR bar.** Each was checked against the three-part test; each is local to one or two files, covered by tests at a public seam, and easy to change.

- **The ledger field** is `waitingTerminal: holderSchema.optional()` on the run schema in `src/daemon/runs.ts`, beside `takenOver`, with a doc comment naming ADR-0067 D1. It is cleared in `transition()` whenever the run leaves `active` (beside the line that clears `takenOver`) and by `claim()`.
- **The store's methods.** `waitForStep(id, holder): Run` writes the field; it throws when the run is not `active`, when the run is held by a person's terminal (`takenOver`), or when another waiter's process is not `gone` and its token differs (message below). A waiter whose process is `gone` is replaced. `liveWaiter(id): Holder | undefined` returns the waiter when its process is not `gone`; a `gone` one is cleared and `undefined` is returned. Liveness is the store's own `livenessOf`, so a waiter on another machine (`unknown`) counts as alive, as `claim()` counts a holder.
- **The resolution kind.** `TakeoverResolution` gains `{ kind: "wait-for-step"; run: Run; step: string }`, `step` being `stageLabel(run.stage)` from `src/daemon/pipeline.ts`, or `"the step that is running"` when the run has no stage. `findTakeover` returns it for an `active` run that is not `takenOver`. A `picked-up` run keeps today's answer: no step runs on it yet, and the runner has not looked at it.
- **The sentences**, printed by the command (`name` is `<project> #<n>`):
  - waiting: `Waiting for the step running on ${name} (${step}) to end, then I'll open the session here — press Ctrl-C to stop waiting, and nothing changes.`
  - stopped by Ctrl-C: `Stopped waiting. Nothing changed on ${name}.` Exit code 130.
  - no daemon: `A step shows as running on ${name} (${step}), but no daemon is running, so it cannot end and I won't wait for it. Start the daemon with \`timone daemon\`; it gives the run back to the runner, and then you can run this again.` Exit code 1.
  - the daemon stopped during the wait: `The daemon stopped, so the step on ${name} cannot end. I've stopped waiting, and nothing changed.` Exit code 1.
  - the run moved some other way during the wait (cancelled, ended, or parked with no claim for this terminal): `${name} moved on while I waited: it is now ${status}. I've stopped waiting, and nothing changed.` Exit code 1.
  - another terminal already waits: `Another terminal is already waiting for the step on ${name}: ${command} (pid ${pid}).` Exit code 1.
  - a run a person's terminal holds: `${name} is open in another terminal: ${command} (pid ${pid}). Only one session can hold a ticket at a time.` Exit code 1. (Today such a run is answered "I'm working on … right now", which is not true of it, and would be the last refusal on `active` to say a step runs.)
- **How the terminal watches.** After the request is settled (the 150 s bound of ADR-0049 D3 is unchanged for that part), the command reads the run. Claimed with its own holder token: open, as today. Carrying its own token as `waitingTerminal`: print the waiting sentence once, then look every `deps.wait.intervalMs` (default `WATCH_INTERVAL_MS`, 1 s) with `deps.wait.sleep`, with no bound. On each look it also asks the ledger lock with `acquireStateLock`: if this terminal gets the lock, no daemon holds the ledger — it releases it at once and stops waiting with the "daemon stopped" sentence. Any other answer from the lock means it keeps waiting.
- **Ctrl-C during the wait** is a `SIGINT` / `SIGTERM` handler installed only while waiting, which ends the wait loop (the loop takes a stop signal; it does not exit the process from inside the handler). After it stops, the command looks once for a claim with its own token, as `withdraw` does. A claim found is given back with a `release-takeover` request whose `outcome` is `"abandoned"` — that value already exists in the request schema and is not yet read. Then the stopped sentence.
- **What the runner is told.** `RunnerDriver.terminalEnded(run)` keeps waking with `TAKEOVER_ENDED_EVENT`. When the run it hands back is still on the after-step wait (`wait.on === AFTER_STEP_WAIT`, so the runner never looked at that step's end), the wake carries `stepEndedEvent(stage, ended)` and the pieces failures, rebuilt from the record with `lastStepEnded` and `piecesFailuresAfter` exactly as `afterStep` builds them, **before** `TAKEOVER_ENDED_EVENT`. A new `RunnerDriver.takeoverAbandoned(run)` does the same with no `TAKEOVER_ENDED_EVENT`: no session was opened, so the runner is told only what it would have been told had nobody waited. `applyRequest` in `src/daemon/poll.ts` calls it for `outcome: "abandoned"`.
- **The runner's refusal** (ADR-0067 D4). `startStep` in `src/runner/actions.ts` refuses when the run, read fresh from the store, is `active` and `takenOver`: `A person has this ticket open in a terminal. Start nothing until the terminal session ends; you are woken then.` Checked first in `stepBlocked`, so `start_step` and the approval's own step both meet it.

**What this phase owes before delivery** (ADR-0051 D4). The diff touches `src/daemon/runs.ts`, `src/daemon/poll.ts`, `src/commands/takeover.ts`, `src/runner/driver.ts`, `src/runner/actions.ts`, their tests, `process.md`, `README.md`, `CONTEXT.md`, and documents under `doc/`.

- **The regression set**, computed from the registers on 2026-10-05 (MUST, `api`, `verified`, and a `Depends-on` this diff touches or none): PRD-05 R2, R3, R4, R5, R7, R10, R11 and R18, and PRD-08.R5 (no `Depends-on`, so always in scope); PRD-07 R1, R2, R3, R4, R6, R9, R10, R12 and R13 (`src/daemon/runs.ts`, `src/runner/`, `src/daemon/`, `src/commands/takeover.ts`, `process.md`); PRD-08 R2 and R4 (`src/runner/actions.ts`).
- **PRD-05.R11's probe is expected to go red on one check.** It checks that a takeover of a run the machine is working on opens no session. PRD-05.R11's note of 2026-10-05 and PRD-09.R4's *Falsified-by* line say that check is replaced by one that the takeover waits and then opens. The probe is verification's (ADR-0048); the builder does not open it. Verification replaces that check, and must not read its going red as this phase breaking R11.
- **A live gate is owed.** The `live` criteria PRD-02 R1, R2, R4 and R8 depend on `src/daemon/`, which this diff touches. By ADR-0059 it rides to the pull request as an unticked check: on scratch-app, with the daemon running, type `timone takeover scratch-app#<n>` while a step of that ticket runs; see the waiting sentence, see the session open when the step ends, and see in the ticket's record that no step started between the step's end and the session's end. Then once more, pressing Ctrl-C before the step ends, and see the runner woken with the step's end as usual.
- **What no criterion watches.** That a takeover of a `parked` run still opens at once, with the bounded wait and the withdraw of ADR-0049 D3; that a step's end with no waiting terminal still wakes the runner exactly once; that a run cancelled while a terminal waits stays cancelled. The existing tests of those are a hard gate in every slice that touches their files: `src/commands/takeover.test.ts`, `src/daemon/poll.test.ts`, `src/runner/driver.test.ts`, `src/daemon/runs.test.ts`.

**What is not done here.** Questions do not yet name the command (piece 2). `timone status` does not show that a terminal waits; nothing requires it. A `picked-up` run keeps its answer. What a session does once open is unchanged (PRD-09, *Out of scope*). Requirement statuses stay `draft`; verification sets them.

## Context & Prerequisites

- **The probe folders are closed to the builder of this phase.** No file this phase writes may contain a probe folder's path as literal text, and no slice opens one. PRD-05.R11's probe is named here only as "PRD-05.R11's probe".
- **`src/commands/takeover.ts`** — `findTakeover` (~160) answers per status; `resolveTakeover` (~140) is what the daemon calls too (`applyRequest`, `claim-takeover`, in `src/daemon/poll.ts` ~680). `claimForTakeover` (~453) has the three roads: lock free → resolve and claim; a live daemon holds it → `findTakeover` for known runs, then `enqueue` a `claim-takeover` request with this terminal's `takeHold` holder, `waitUntilSettled`, `withdraw` on timeout, then read the run. `runTakeover` (~365) installs the heartbeat and the signal handlers **after** the claim; `releaseClaim` (~684) gives back either directly (`takeover-ended` request) or through a `release-takeover` request (`outcome: "ended"`). `openSession` (~739) prints "Picking up …" and launches `claude`.
- **`src/daemon/requests.ts`** — `release-takeover`'s `outcome` is `"ended" | "abandoned"`; nothing writes `"abandoned"` yet. `WATCH_INTERVAL_MS` is 1 s and not exported; export it if the command needs it. No new request kind is needed.
- **`src/daemon/poll.ts`** — `applyRequest` (~639): `claim-takeover` calls `resolveTakeover` and then `store.claim(…, body.holder, { takeover: true })`; `release-takeover` calls `deps.runner.terminalEnded(run)`. Every request is settled by `carryOut` whether or not it applied; that stays.
- **`src/daemon/runs.ts`** — the run schema (~110–320) is a `strictObject`; `takenOver` (~228) is the model for the new field. `claim()` (~858) refuses a live holder with another token (`heldRunMessage`, ~1613). `transition()` (~1468) clears `takenOver` when the run leaves `active`. `park()` clears the holder (`applyPark`, ~1638). `livenessOf` is injected in `RunStore.open(…, { livenessOf })`, which is how the tests fake a process being gone.
- **`src/runner/driver.ts`** — `afterStep` (~1045): `parkForRunner(run, AFTER_STEP_WAIT, stage)`, then the description, then `ask(...)` with `stepEndedEvent` and `piecesFailedEvent`. `handBack` (~944) and `terminalEnded` (~930). `look()` (~500) already leaves alone an `active` run with no step of this daemon running, so a run a terminal holds is not woken by the cycle.
- **`src/runner/actions.ts`** — `stepBlocked` (~574), used by `startStep` (~825) before anything is written. `watchStep` (~760) writes `step-ended`, deletes the run from `running`, then calls `deps.stepEnded`.
- **Tests that already cover the neighbourhood:** `src/commands/takeover.test.ts` (resolution, the daemon road with a fake holder and injected `wait.sleep`, withdraw), `src/daemon/poll.test.ts` (~2165, a `claim-takeover` refused for a running run — this assertion changes), `src/runner/driver.test.ts` ("RunnerDriver — when a step ends", ~245), `src/runner/actions.test.ts`, `src/daemon/runs.test.ts`.
- **Standards.** This project has no `doc/standards.md`; the central `standards/typescript.md`, `standards/testing.md` and `standards/code-smells.md` apply: TypeScript strict, vitest, tests at public seams, no test that reaches into a private field. No screen, so no accessibility work.

## Sub-phases

### Sub-phase 51a: A takeover typed while a step runs waits, and opens the session when the step ends, before the runner is woken

**[MODIFY]** `src/daemon/runs.ts` — the `waitingTerminal` field, cleared on leaving `active` and by `claim()`; `waitForStep(id, holder)` (for now: refuses a run that is not `active`, or is `takenOver`); `liveWaiter(id)` (for now: returns the field). The liveness rules of both are 51b's.
**[MODIFY]** `src/commands/takeover.ts` — the `wait-for-step` resolution kind from `findTakeover` for an `active` run not `takenOver`. In `claimForTakeover`'s daemon road: a `wait-for-step` finding no longer refuses; the request is enqueued as today; after it is settled, a run carrying this terminal's token as `waitingTerminal` prints the waiting sentence and enters the watch loop (Goal Description) until the run is claimed with this terminal's token. The lock-free road's answer for a running step is 51c's; until then it returns the `wait-for-step` finding as a refusal with today's words, so behaviour there is unchanged.
**[MODIFY]** `src/daemon/poll.ts` — `claim-takeover`: a `wait-for-step` resolution calls `store.waitForStep(run.id, body.holder)` and logs `${target} waits for the step to end, for the terminal.`; returns 0.
**[MODIFY]** `src/runner/driver.ts` — `afterStep`: read `store.liveWaiter(runId)` before `parkForRunner`; after the park, with no `await` in between, when there was a waiter, `store.claim(runId, waiter, { takeover: true })`, log `runner ${runId} — the step ended and the run goes to the terminal that waited for it`, and skip the `ask`. The description is still brought up to date. A claim that throws is logged and the runner is woken as before. `terminalEnded`: when the run is still on `AFTER_STEP_WAIT`, the wake carries the step's end and the pieces failures before `TAKEOVER_ENDED_EVENT` (Goal Description).
**[MODIFY]** `src/daemon/runs.test.ts`, `src/commands/takeover.test.ts`, `src/daemon/poll.test.ts`, `src/runner/driver.test.ts` — cases below. The `poll.test.ts` case at ~2165 that expects a `claim-takeover` of a running run to be refused with "I'm working on …" now expects it applied and the waiter written.

**Seams under test (TDD):** `RunStore`'s public methods with a temporary state file — the ledger is where the waiting terminal lives, and a round trip through the file is what the daemon and the terminal share. `RunnerDriver.stepEnded(runId, stage, result)` with the fake sessions the file already uses — the public boundary where "the runner is not woken" is seen. `runTakeover(raw, deps)` with a live fake daemon holding the lock, injected `wait.sleep`, and a fake launcher — the command's own boundary, where the sentence and the opening are seen. Red-green:
1. `waitForStep` on an `active` run writes the holder, and it survives `RunStore.open` of the same file. On a `parked` run it throws. `claim()` and `park()` both clear it.
2. A step ends on a run with a waiting terminal: after `stepEnded`, the run is `active`, `takenOver`, held by the waiter's holder, on the after-step wait; the fake sessions record **no** wake; `waitingTerminal` is absent.
3. The same with no waiting terminal: the runner is woken once with the step's end, as today (the existing case at ~664 stays green).
4. After case 2, `terminalEnded(run)`: one wake whose events are the step's end, then `TAKEOVER_ENDED_EVENT`. A run already re-parked by the runner on another wait gets `TAKEOVER_ENDED_EVENT` only.
5. `applyRequest` for `claim-takeover` on an `active` run not `takenOver`: returns 0, writes the request's holder as `waitingTerminal`, settles the request.
6. `runTakeover` with a fake daemon that applies the request and, a few sleeps later, ends the step through the driver: the log holds the waiting sentence exactly once, naming the step's label; the launcher is called once, after the claim; the runner's fake sessions record no wake between the step's end and the launcher's call; after the session ends, the `release-takeover` request is written. (R4 clauses 1 and 2, its verification hint.)
7. `findTakeover` / `resolveTakeover` on an `active` run: `wait-for-step` with `step` equal to the stage's label; on a `picked-up` run: today's "I'm working on …" answer.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"   # expected 0
npx vitest run src/daemon/runs.test.ts src/commands/takeover.test.ts src/daemon/poll.test.ts src/runner/driver.test.ts; echo "exit: $?"   # expected 0
```

- [ ] Cases 1–7 pass, with each one's red run recorded in the handoff before its green run.
- [ ] Every other existing case of the four files passes unchanged (hard gate: what no criterion watches), apart from the one `poll.test.ts` case named above, whose change is listed in the handoff.

---

### Sub-phase 51b: Stopping the wait changes nothing, and one terminal waits at a time

**[MODIFY]** `src/daemon/runs.ts` — `waitForStep` refuses while another waiter's process is not `gone` and its token differs (the "another terminal" sentence), and replaces a `gone` one. `liveWaiter` clears a `gone` waiter and returns `undefined`.
**[MODIFY]** `src/commands/takeover.ts` — while waiting, `SIGINT` and `SIGTERM` end the watch loop; then one look for a claim with this terminal's token; a claim found is given back through `releaseClaim` with a new `outcome` parameter set to `"abandoned"`, which reaches the daemon as a `release-takeover` request with that outcome. (If the daemon stopped in the same second and this terminal gets the lock, `releaseClaim`'s direct road parks the run as today, and the next daemon is told a session ended. That case is rare and harmless, and not worth a new request kind.) Then the stopped sentence and exit code 130. The handlers are removed when the wait ends, before `runTakeover` installs its own.
**[MODIFY]** `src/daemon/poll.ts` — `release-takeover` with `outcome: "abandoned"` calls `deps.runner.takeoverAbandoned(run)`.
**[MODIFY]** `src/runner/driver.ts` — `takeoverAbandoned(run)`: as `terminalEnded`, without `TAKEOVER_ENDED_EVENT`.
**[MODIFY]** the four test files — cases below.

**Seams under test (TDD):** the same three as 51a, plus `applyRequest` through the poll's public cycle as `poll.test.ts` drives it. Red-green:
1. A waiting terminal whose process is `gone` (injected `livenessOf`) when the step ends: the run is parked for the runner, the runner is woken once with the step's end exactly as case 51a.3, and `waitingTerminal` is cleared (R4 clause 3).
2. `waitForStep` with a second holder while the first is `alive`: throws with the "another terminal" sentence; the field still holds the first. With the first `gone`: the second replaces it.
3. `runTakeover` stopped during the wait (the test triggers the stop through the same seam the handler uses): the stopped sentence is logged, the exit code is 130, the launcher is never called, and no request is left on disk.
4. Stopped just after the claim landed: a `release-takeover` request with `outcome: "abandoned"` is written; applying it wakes the runner once with the step's end and **without** `TAKEOVER_ENDED_EVENT`; the run is parked for the runner as if nobody had waited.
5. A second `timone takeover` of the same ticket while the first waits: refused with the "another terminal" sentence, exit 1, the first terminal's wait is untouched.

> Sub-phase 51a must be complete before starting this sub-phase (it adds the field, the resolution kind and the wait loop this slice stops).

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"   # expected 0
npx vitest run src/daemon/runs.test.ts src/commands/takeover.test.ts src/daemon/poll.test.ts src/runner/driver.test.ts; echo "exit: $?"   # expected 0
```

- [ ] Cases 1–5 pass, with red runs recorded in the handoff.
- [ ] Every existing case of the four files passes unchanged (hard gate).

---

### Sub-phase 51c: When no step can end, the takeover says so and does not wait

**[MODIFY]** `src/commands/takeover.ts` — the lock-free road (no daemon): a `wait-for-step` finding prints the "no daemon" sentence and returns 1, writing nothing. The watch loop: the lock check on each look (Goal Description) ends the wait with the "daemon stopped" sentence; a run that is no longer `active` with this terminal as waiter, and not claimed for it, ends the wait with the "moved on" sentence. A run that is `active` and `takenOver` is answered with the "open in another terminal" sentence on both roads, instead of "I'm working on …".
**[MODIFY]** `src/commands/takeover.test.ts` — cases below.

**Seams under test (TDD):** `runTakeover(raw, deps)` and `resolveTakeover(target, deps)` — the command's own boundary. Red-green:
1. No daemon (the test's state lock is free), the run `active` at stage `planning`: the log is exactly the "no daemon" sentence with the stage's label; exit 1; the run is unchanged in the file; the launcher is not called (R4 clause 4).
2. Waiting, then the fake daemon's lock holder goes away (the next `acquireStateLock` succeeds): the "daemon stopped" sentence, exit 1, the lock is not left held, the launcher is not called.
3. Waiting, then the run is cancelled by the fake daemon: the "moved on" sentence naming `cancelled`, exit 1.
4. An `active`, `takenOver` run held by another live holder: the "open in another terminal" sentence naming that holder's command and pid, on the lock-free road and on the daemon road; no request is left on disk.

> Sub-phases 51a and 51b must be complete before starting this sub-phase (it changes the same functions of `src/commands/takeover.ts`, and its cases run inside the wait loop they built).

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"   # expected 0
npx vitest run src/commands/takeover.test.ts src/daemon/poll.test.ts; echo "exit: $?"   # expected 0
grep -n "working on .* right now" src/commands/takeover.ts | grep -v '^\s*[0-9]*:\s*//'; echo "exit: $? (expected 0: the sentence stays, for a picked-up run only)"
```

- [ ] Cases 1–4 pass, with red runs recorded in the handoff.
- [ ] The "I'm working on …" sentence is reachable only for a `picked-up` run (a test shows it, and none shows it for `active`).

---

### Sub-phase 51d: The runner starts no step on a run a person's terminal holds

**[MODIFY]** `src/runner/actions.ts` — `stepBlocked` first reads the run from the store; when it is `active` and `takenOver`, it refuses with the sentence in the Goal Description. Nothing is written before the refusal except the decision entry `decided` already writes.
**[MODIFY]** `src/runner/actions.test.ts` — cases below.

**Seams under test (TDD):** the runner's actions as `actions.test.ts` builds them — `start_step` is the one way the runner starts a step. Red-green:
1. A run claimed for a terminal (`claim(…, holder, { takeover: true })`) after a wake began: `start_step` is refused with that sentence; `deps.startStep` is never called; the run's stage, place and status are unchanged; the record holds the refused decision.
2. The same run after it is parked again: `start_step` starts the step as before.

> No dependency on other sub-phases. It shares no file with 51a–51c and may run beside them.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"   # expected 0
npx vitest run src/runner/actions.test.ts; echo "exit: $?"   # expected 0
```

- [ ] Cases 1–2 pass, with red runs recorded in the handoff.
- [ ] Every existing case of `actions.test.ts` passes unchanged (hard gate: PRD-07 R1–R3, PRD-08 R2 and R4 are watched there).

---

### Sub-phase 51e: The written rules say that a takeover waits for a running step

No behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based.

**[MODIFY]** `process.md` — the paragraph that starts **`timone takeover <project>#<n>`** (~147) gains one dated sentence (`✏ 2026-10-05 ([ADR-0067](doc/adr/0067-a-takeover-typed-while-a-step-runs-is-written-on-the-run-and-takes-it-when-the-step-ends.md))`): typed while a step of the ticket runs, it says which step it waits for, waits for the step to end, and then opens the session before the runner starts anything else on the ticket; Ctrl-C stops the wait and changes nothing; with no daemon running, it says so and does not wait. The paragraph that starts *"Every command a ticket names can be run while the daemon is running"* is not changed.
**[MODIFY]** `README.md` — the sentence under **How you talk to it** (~91) that a takeover "opens a terminal session on a ticket nothing is working on right now" says instead that it opens one on the ticket, and that typed while a step runs it waits for the step to end first.
**[MODIFY]** `CONTEXT.md` — the **Takeover** entry gains the same rule in one dated sentence.
**[MODIFY]** `doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md` — under R11's note of 2026-10-05, one dated line: built in [phase 51](../../plans/phases/phase-51.md); the refusal on a run whose step is running is gone. No clause and no status line changes.
**[MODIFY]** `doc/specs/prd/prd-09-a-question-names-the-command-that-answers-it-in-a-terminal.criteria.md` — R4's `Falsified-by:` line names the tests from 51a case 6 and 51b case 1 by file and test name, each seen to fail first, and keeps the sentence that PRD-05.R11's probe check is replaced by verification. No status line changes.
**[MODIFY]** `doc/specs/prd/prd-09-a-question-names-the-command-that-answers-it-in-a-terminal.md` — the `Phases:` line reads `[phase 51](../../plans/phases/phase-51.md) (piece 1, #217)`.

> Sub-phases 51a–51d must be complete before starting this sub-phase (the words describe what the code now does).

#### Agent Validation Steps

```bash
grep -n "ADR-0067" process.md CONTEXT.md; echo "exit: $? (expected 0, both files listed)"
grep -n "nothing is working on right now" README.md; echo "exit: $? (expected 1: the sentence is gone)"
grep -n "phase-51" doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md doc/specs/prd/prd-09-a-question-names-the-command-that-answers-it-in-a-terminal.md; echo "exit: $? (expected 0)"
git diff -U0 origin/main -- doc/specs/prd/ | grep -E '^[-+]- \*\*Status:\*\*'; echo "exit: $? (expected 1: no status line changed)"
npx vitest run; echo "exit: $?"   # expected 0, the whole suite
```

- [ ] No line in `process.md`, `README.md`, `CONTEXT.md` or the step skills says that a takeover refuses while a step of its own ticket runs (R5, takeover part).
- [ ] Plain words in every note: no metaphor, no process jargon.

## Dependency graph

```
51a → (none)          the waiting terminal on the run, the hand-over at the step's end, the wait and the opening
51b → 51a             Ctrl-C changes nothing; a gone terminal is dropped at the step's end; one terminal waits at a time
51c → 51a, 51b        no daemon, a daemon that stops, a run that moves, a run another terminal holds
51d → (none)          the runner's start_step refuses a run a terminal holds; may run beside 51a–51c
51e → 51a–51d         process.md, README.md, CONTEXT.md, PRD-05.R11's note, PRD-09.R4's Falsified-by and phase list
```
