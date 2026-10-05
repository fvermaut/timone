# Phase 51 — Delivery Report

- **Date:** 2026-10-05
- **Phase:** [phase-51.md](../phase-51.md) — `Complete`, verified in [phase-51-verification.md](phase-51-verification.md)
- **Branch:** `timone/217-1-a-takeover-waits-for-the-running-step` @ `383a23b` (the work; this report is the next commit)
- **Base:** `main` — the project's default branch. The branch was cut from `e16cb71` on `main`. `main` has gained one commit since (`9f0786c`, a change to `timone.yaml`); the diff range uses the merge-base, so it shows only this phase's work.
- **Pull request:** opened against this report, from this branch; its address is posted on ticket #217.
- **Screen:** no user-facing screen in this phase — the phase file's `Screens changed` line says none. The waiting sentence is printed in a terminal.
- **Questions for the human:** 1, quoted from the verification report (below, under *Questions for the human*).
- **Departures:** [`phase-51-departures.md`](phase-51-departures.md) — 8 entries: 4 from the build, 4 from the check.

## Scope

Piece 1 of the [list of pieces for #213](../../breakdowns/ticket-213.md), driven by ticket [#217](https://github.com/fvermaut/timone/issues/217). It claims [PRD-09.R4](../../../specs/prd/prd-09-a-question-names-the-command-that-answers-it-in-a-terminal.criteria.md) (MUST) whole, and PRD-09.R5 (MUST) for the takeover paragraph only (its clauses 2 and 3; clause 1 is piece 2's).

`timone takeover` typed while a step of its ticket runs no longer refuses. It says which step it waits for and that Ctrl-C stops the wait. When the step ends, the run is handed to that terminal and the session opens; the runner starts nothing else on the ticket in between. Ctrl-C leaves the run as it was. Only one terminal waits at a time. With no daemon running, the command says no step can end and does not wait. The runner refuses to start a step while a person's terminal holds the run. `process.md`, the README, `CONTEXT.md` and the requirements say the same. How it works is decided in [ADR-0067](../../../adr/0067-a-takeover-typed-while-a-step-runs-is-written-on-the-run-and-takes-it-when-the-step-ends.md).

## How to try it

### Against the preview

This project has no preview configured for pull requests. Use the local steps.

### On a local checkout

Set up as the project's [README](../../../../README.md) says (`npm install`, `npm run build`, `npm link`). Then, on this branch:

1. `npx tsc --noEmit` — exit 0.
2. `npx vitest run src/daemon/runs.test.ts src/commands/takeover.test.ts src/daemon/poll.test.ts src/runner/driver.test.ts src/runner/actions.test.ts` — all pass. These hold the new cases: the wait, the hand-over, Ctrl-C, one waiter at a time, no daemon, and no step while a terminal holds the run.
3. `npm run --silent replay`, from a terminal logged in to Claude — expect 20 of 20. This was not run in the container (no model login).
4. The watched run, on scratch-app, with the daemon running: type `timone takeover scratch-app#<n>` while a step of that ticket runs. You should see one sentence naming the step it waits for and saying Ctrl-C stops the wait. When the step ends, the session opens here, and the ticket's record shows no step started between the step's end and the session's end. Then once more, pressing Ctrl-C before the step ends: the command says nothing changed, and the runner is woken with the step's end as usual.
5. With the daemon stopped, type the same command on a run that shows a step running: it says no daemon is running, so the step cannot end, and exits without waiting.

## Verification outcome

From [phase-51-verification.md](phase-51-verification.md), 0 of 2 fix loops consumed:

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-09.R4 | MUST | api | PASS | 0 |
| PRD-09.R5 (clauses 2, 3) | MUST | api | PASS | 0 |
| PRD-05.R2 | MUST | api | PASS (clause 2b BLOCKED) | 0 |
| PRD-05.R3 | MUST | api | PASS | 0 |
| PRD-05.R4 | MUST | api | PASS | 0 |
| PRD-05.R5 | MUST | api | PASS | 0 |
| PRD-05.R7 | MUST | api | PASS (the real-runner clause BLOCKED) | 0 |
| PRD-05.R10 | MUST | api | PASS | 0 |
| PRD-05.R11 | MUST | api | PASS | 0 |
| PRD-05.R18 | MUST | api | **BLOCKED** | 0 |
| PRD-07.R1 | MUST | api | PASS | 0 |
| PRD-07.R2 | MUST | api | PASS | 0 |
| PRD-07.R3 | MUST | api | PASS | 0 |
| PRD-07.R4 | MUST | api | PASS | 0 |
| PRD-07.R6 | MUST | api | PASS | 0 |
| PRD-07.R9 | MUST | api | PASS | 0 |
| PRD-07.R10 | MUST | api | PASS | 0 |
| PRD-07.R12 | MUST | api | PASS | 0 |
| PRD-07.R13 | MUST | api | PASS (clause 3 read with PRD-09.R4 — see the question below) | 0 |
| PRD-08.R2 | MUST | api | PASS | 0 |
| PRD-08.R4 | MUST | api | PASS | 0 |
| PRD-08.R5 | MUST | api | PASS | 0 |

The check's gate was not met only because PRD-05.R18 is BLOCKED. No fault was found in the program.

### Outstanding for the human

- [ ] PRD-05.R18 — the replay of past mistakes against the real model was not run: `npm run --silent replay` gave 0 of 20, every case "Not logged in". Run it on this branch from a terminal logged in to Claude before merging; expect 20 of 20. (The free scripted replay, `--dry`, passed 20 of 20; it is not the evidence.) PRD-05.R7's real-runner clause waits on the same run.
- [ ] 70 older tests did not run where they can pass. They fail in the container because it refuses pushes to `main` inside the tests' throwaway repositories (Timone issue #220): 45 in `src/commands/guardrails.test.ts`, 16 in `src/numbers.test.ts`, 6 in `src/workspace.test.ts`, 3 in `src/commands/number.test.ts`. The build reports the same 70 fail on `main` in the container; the check confirmed only that each fails on the push refusal. Run `npx vitest run` on your own machine.
- [ ] Live gate owed — the watched run on scratch-app (step 4 above). Its steps are written in [phase-51.md](../phase-51.md), *What this phase owes before delivery*. The other `live` criteria this diff touches are listed in [phase-51-verification.md](phase-51-verification.md) § Live gates.

### Questions for the human

1. **Should PRD-07.R13 clause 3 be reworded?** In [`prd-07-several-tickets-of-one-project-at-once.criteria.md`](../../../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md), lines 287–291, it still says that a takeover of a ticket whose own step runs opens no session and says what is happening "as today". "As today" meant the old refusal, which PRD-09.R4 replaces. PRD-05.R11 has a note saying so; PRD-07.R13 does not. The check read clause 3 with PRD-09.R4 (no session opens *while* the step runs), and that holds. A useful answer is "yes, change the words" or the words you want.

### Open points from the build

From [phase-51-complete.md](phase-51-complete.md), found while building and left open:

1. After the daemon settles the request, the command opens the session for any `active` run without checking that the claim carries this terminal's token. If another terminal took the run in the moment before the daemon read this one's request, this terminal could open a second session on it.
2. While a person's terminal holds a run, the runner refuses to start a step, but it can still post and end the run. A run held by a terminal whose process is gone is refused until the daemon gives it back.
3. R4's *Verification hint* in the PRD-09 register still describes the code before this phase.
4. Ctrl-C before the daemon has read the request still ends the process the old way, with no message of its own. The run is still unchanged.

## Standards review — phase 51

- **Read:** the diff `e16cb71...383a23b` for `src/commands/takeover.ts`, `src/commands/takeover.test.ts`, `src/daemon/poll.ts`, `src/daemon/poll.test.ts`, `src/daemon/requests.ts`, `src/daemon/runs.ts`, `src/daemon/runs.test.ts`, `src/runner/actions.ts`, `src/runner/actions.test.ts`, `src/runner/driver.ts`, `src/runner/driver.test.ts`, `README.md`, `CONTEXT.md` and `process.md`. Also parts of `src/commands/takeover.ts`, `src/runner/driver.ts`, `src/daemon/runs.ts` and `src/daemon/requests.ts` at `383a23b` for context, plus Timone's `standards/code-smells.md`, `tsconfig.json` and `package.json`. The project has no `doc/standards.md` file, so `code-smells.md` is the only reference used.
- **Diff:** `e16cb71...383a23b` — 14 files, +1515/−69
- **Findings:** 3

### 1. A comment says "the same write", but the code makes two writes — Comment contradicts code

- **Where:** `src/runner/driver.ts:1086–1091`
- **What:**
  ```ts
  // ✏ 2026-10-05 (ADR-0067 D2): a terminal waits for this step. The run is
  // handed to it in the same write as the park, with no await in between,
  // so no runner woken meanwhile can start another step on it.
  const waiter = this.deps.store.liveWaiter(runId);
  this.parkForRunner(run, AFTER_STEP_WAIT, stage);
  const handed = waiter !== undefined && this.handToWaiter(runId, waiter);
  ```
  `parkForRunner` saves the run once. `handToWaiter` then calls `store.claim`, which saves it again. That is two writes. The new code in `src/commands/takeover.ts` (`watchForHandOver`) says so itself: "The step's end parks the run, then claims it for this terminal: two writes, and this process can read the ledger between them." The two comments disagree. The claim the comment makes ("no await in between", so no runner in this process can start another step) is true. The words "the same write" are not.
- **Why it matters:** a comment that contradicts the code (in `code-smells.md` terms, a misleading comment). A reader who trusts "the same write" would not expect another process to see the in-between state. The terminal side has code that handles exactly that state.
- **Suggested remediation:** say "in the next write after the park, with no await in between" — not applied here.

### 2. A third copy of the default `sleep` function — Duplicated code

- **Where:** `src/commands/takeover.ts:723–724` (new). The earlier copies are at `src/commands/takeover.ts:845–846` and `src/daemon/requests.ts:288–289`.
- **What:** the new `watchForHandOver` adds:
  ```ts
  const sleep =
    deps.wait?.sleep ?? ((ms: number) => new Promise((done) => setTimeout(done, ms)));
  ```
  The same line is already in `withdraw` and in `waitUntilSettled` in `requests.ts`. This diff makes it the third copy. The same diff also exports `WATCH_INTERVAL_MS` from `requests.ts` just so `takeover.ts` can rebuild the same interval default.
- **Why it matters:** duplicated code. The third copy is the rule-of-three point where pulling out one shared function costs less than keeping the copies.
- **Suggested remediation:** export a default sleep (or a `sleepOf(wait)` helper) from `src/daemon/requests.ts`, next to `WaitOptions`, and use it at all three places — not applied here.

### 3. A message is kept in one function in one file and typed out again in another — Duplicated code

- **Where:** `src/daemon/poll.ts:700–705` and `src/commands/takeover.ts:249–255`
- **What:** the diff adds `workingOnMessage` to `takeover.ts`:
  ```ts
  `I'm working on ${target.project} #${target.ticket} right now. ` +
  "Anything I need from you will land on the ticket."
  ```
  The new `wait-for-step` branch in `poll.ts` types the same sentence out again:
  ```ts
  `I'm working on ${body.project} #${body.ticket} right now. ` +
    "Anything I need from you will land on the ticket.",
  ```
  For the other new refusal, the same diff exports `anotherWaiterMessage` from `runs.ts`, "so the store refuses in these words, and the command prints them". This message gets no such treatment.
- **Why it matters:** duplicated code. Two copies is tolerable by the rule of three. But this is text the person sees, the two copies must stay the same, and the diff shares the other message and not this one.
- **Suggested remediation:** export the sentence from one module and call it from both `poll.ts` and `takeover.ts` — not applied here.

## Spec review — phase 51

- **Read:** the diff for `src/commands/takeover.ts`, `src/daemon/poll.ts`, `src/daemon/requests.ts`, `src/daemon/runs.ts`, `src/runner/actions.ts`, `src/runner/driver.ts`, `README.md`, `CONTEXT.md`, `process.md` (test files were counted but not read in full); the liveness lines of `src/daemon/runs.ts` and `src/daemon/holder.ts` at HEAD; `doc/specs/prd/prd-09-a-question-names-the-command-that-answers-it-in-a-terminal.md` and `.criteria.md`; the diff to `doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md` and `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md`, and R11 and R13 in those files at HEAD; `doc/plans/phases/phase-51.md` up to `## Goal Description`.
- **Diff:** `e16cb71...383a23b` — 14 files, +1515/−69 (subject files)
- **Findings:** 3

### 1. PRD-07.R13 clause 3 still says a takeover of a ticket whose own step runs opens no session "as today" — PRD-07.R13, PRD-09.R4

- **Where:** `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md:287–291`
- **What:** The clause still reads "GIVEN a ticket whose own step the machine is working on … THEN no session opens, and the message says what is happening, as today". The diff adds only an Evidence line. That line reads the clause through PRD-09.R4 and leaves "whether clause 3's words should change" as an open question. The status stays `verified`. PRD-05.R11 has a dated note under its clause saying PRD-09.R4 replaces the refusal. PRD-07.R13 has no such note under the clause itself.
- **Why it matters:** PRD-09.R4 clause 2 says that once the step ends, the session opens. Read as written, PRD-07.R13 clause 3 now contradicts the build, but the register still marks it `verified`.
- **Suggested remediation:** Add a dated note under PRD-07.R13 clause 3, or reword the clause, so it points to PRD-09.R4 (waits, then opens), as PRD-05.R11 already does. — not applied here

### 2. Ctrl-C during the wait leaves the terminal written on the run; a terminal on another host can then be handed the run after it has left — PRD-09.R4 clause 3

- **Where:** `src/commands/takeover.ts:687–692`; `src/daemon/runs.ts:929–936`; `src/runner/driver.ts:1089–1106`
- **What:** In the `stopped` case, the command checks once whether the run was already handed over, then exits. It does not remove `waitingTerminal` from the run. When the step ends, `liveWaiter` drops the waiter only if `livenessOf(waiter) === "gone"`. A holder whose `host` differs from the daemon's host is `unknown`, and `unknown` counts as alive. In that case `handToWaiter` claims the run with `takeover: true`, and `afterStep` returns at `if (handed) return;` without waking the runner. `stepBlocked` then refuses every step with "A person has this ticket open in a terminal". Nothing gives the run back, because an `unknown` holder is never reclaimed.
- **Why it matters:** PRD-09.R4 clause 3: "WHEN the person stops it before the step ends THEN the run is the same as if the command had never been typed, and the runner carries on as it would have." When the terminal and the daemon see different host names (for example, a daemon in a container), the run stops until `timone cancel` is run. Even on one host, the ledger keeps a field the command wrote until the step ends.
- **Suggested remediation:** On Ctrl-C, send a request that clears `waitingTerminal` for this token (the daemon is the only writer). Or make `liveWaiter` treat `unknown` as gone for a waiter, since a waiter holds nothing. Add a test where the waiter's liveness is `unknown` and Ctrl-C is pressed before the step ends. — not applied here

### 3. The message for a run held by another terminal changed, which is outside PRD-09.R4 — PRD-09.R4 (scope)

- **Where:** `src/commands/takeover.ts:200–204`, `241–247`
- **What:** An `active` run with `takenOver === true` used to get "I'm working on … right now". It now gets "`<project> #<n>` is open in another terminal: `<command>` (pid `<pid>`). Only one session can hold a ticket at a time." PRD-09.R4 covers a run whose step is running. It says nothing about a run that a person's terminal already holds.
- **Why it matters:** This is a visible change to what the command says, and no PRD-09 criterion claims it. It is small. It follows from ADR-0067 D4, and it fits better now that a waiting terminal can be handed a run. But no criterion covers it.
- **Suggested remediation:** Name this message in a criterion: a clause on PRD-09.R4, or a note on PRD-05.R11 or PRD-07.R13. Otherwise list it as a departure in the delivery notes. — not applied here

## Notes

- The two reviews were run separately, each without the other's report and without the verification report. Their findings are listed apart on purpose.
- The Spec review's finding 2 was read against the code at `383a23b` while writing this report, and the code is as the review says: on Ctrl-C the terminal stays written on the run (`src/commands/takeover.ts`, the `stopped` case), and `liveWaiter` in `src/daemon/runs.ts` keeps a waiter whose liveness is `unknown`. The fault shows only when the terminal and the daemon see different host names. The check's probes ran both on one machine, so they could not see it. Nothing was changed here; a fix belongs in a new ticket.
- `main` moved one commit ahead of this branch's base after the branch was cut (`9f0786c`, `timone.yaml`). The branch was not rebased; bringing it level is a separate step.
- Nothing in this report merges anything. Merging is the human's act.
