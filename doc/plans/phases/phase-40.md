# Phase 40: A stuck job unsticks in writing

> **Status:** Complete — see [reports/phase-40-complete.md](reports/phase-40-complete.md)

> **Companion phases:** [phase-39](phase-39.md), which built the ask check and left this requirement, and whose escalation guard this phase removes. Governing decisions: [ADR-0054](../../adr/0054-an-ask-check-stands-in-front-of-every-question-put-to-a-person.md) D5, which is what this builds; [ADR-0033](../../adr/0033-a-stage-that-cannot-act-on-an-answer-escalates.md), whose D5 unbound session is started here by other means and whose D4 reason is deliberately left standing; [ADR-0035](../../adr/0035-a-resolved-escalation-hands-the-run-back.md), which is still what ends the stop.

## Requirements

> **PRD:** [prd-04](../../specs/prd/prd-04-one-short-question-instead-of-a-terminal.md) — criteria in [prd-04 criteria](../../specs/prd/prd-04-one-short-question-instead-of-a-terminal.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-04.R7 | MUST | A written answer starts the unbound session, but only when it answers the ask check's own question |

## Goal Description

Phase 39 built the ask check and could not let it speak on a stop that no typed answer resolves. The reason was exact: a question there would have been answered into nothing, and the next cycle would have posted the very command the question stood in front of. So the check was gated off, and the report named this phase's work as what opens it.

Three things were missing and all three are small. The daemon had no way to run a session bound to no stage — `spawn` walks the pipeline and picks a prompt from a stage, and the unbound session existed only as a terminal command in `takeover.ts`. There was no rule for *which* written words may start one. And the run had nothing recording that an answer had been acted on.

One decision taken here did not reach the ADR bar. **The spent question is marked, not cleared.** Clearing it let the check ask again on the next cycle, and whether that new question then re-triggered on the *old* answer depended on which instant happened to be later — correctness resting on clock ordering. Marking is a one-field change, is not surprising once the re-ask is seen, and had no real alternative.

## Context & Prerequisites

- **`src/daemon/poll.ts`** — `cheaperAsk` carries phase 39's escalation guard, removed here; the resume walk is where the new trigger sits, ahead of `resolveWait`.
- **`src/daemon/session.ts`** — `runSession` and `attemptSession` take a stage only to write two log lines, which is what makes an unbound session cheap to add.
- **`escalationPrompt`** (`prompts.ts`) — already builds everything an unbound session is told. Only its trigger changes.
- **[ADR-0033](../../adr/0033-a-stage-that-cannot-act-on-an-answer-escalates.md) D4 stays true.** Words a person types still do not resolve this wait. What changes is that one specific answer — to a question the machine framed for the purpose — starts a session instead.

## Sub-phases

### Sub-phase 40a: the unbound session, and the one answer that starts it

**[MODIFY]** `src/daemon/session.ts` — `SessionLabel`, and `unstick` beside `spawn`
**[MODIFY]** `src/daemon/poll.ts` — `answerToOurQuestion`, the trigger, and the removal of the escalation guard
**[MODIFY]** `src/daemon/runs.ts` — `actedOn` on the run's ask-check record, and `spendAskCheck`
**[MODIFY]** `src/daemon/ask-check.ts` — a spent question is finished with its ask for good
**[MODIFY]** `src/daemon/poll.test.ts`, `src/daemon/ask-check.test.ts`

**Seams under test (TDD):** `answerToOurQuestion` and `planAskCheck` are the seams — both pure, and between them they hold the whole rule. Red-green: (1) an answer to the machine's own question starts one session carrying those words; (2) a comment on a stop where the machine asked nothing starts none; (3) a third cycle starts no second session; (4) a spent record stands the check aside for good. The spawner's side is exercised through the `unstick` seam on the fake, as every other session the loop starts is.

> Depends on phase 39's ask check, which is what frames the question this reads.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"
npx vitest run; echo "exit: $?"
```

- [x] Type-check clean, full suite green (1675 tests)
- [x] The phase-39 test that asserted silence on these stops is inverted, not deleted
- [x] A comment on a stop the machine never asked about starts nothing

## Dependency graph

```
40a → phase 39     the unbound session, and the one answer that starts it
```
