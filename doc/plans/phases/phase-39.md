# Phase 39: The ask check — one short question in place of an expensive one

> **Status:** Complete — see [reports/phase-39-complete.md](reports/phase-39-complete.md)

> **Companion phases:** none — this phase touches `cta.ts` and `poll.ts`, which phase 31 last changed, and shares no slice with it. Governing decisions: [ADR-0054](../../adr/0054-an-ask-check-stands-in-front-of-every-question-put-to-a-person.md), which is what this phase builds; [ADR-0052](../../adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md), whose rule that a question may only be asked where the machinery can act on the answer bounds where the check may speak; [ADR-0033](../../adr/0033-a-stage-that-cannot-act-on-an-answer-escalates.md), whose escalation park is the one ask left untouched.

## Requirements

> **PRD:** [prd-04](../../specs/prd/prd-04-one-short-question-instead-of-a-terminal.md) — criteria in [prd-04 criteria](../../specs/prd/prd-04-one-short-question-instead-of-a-terminal.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-04.R1 | MUST | A reply that is neither a yes nor a change request is met with one short question |
| PRD-04.R2 | MUST | Only a known approval word closes a gate |
| PRD-04.R3 | MUST | The check cannot move work to another step |
| PRD-04.R4 | MUST | A message it does not replace is posted unchanged, and it may never withhold one |
| PRD-04.R5 | MUST | One question per ask, and it does not spend the clarifying round |
| PRD-04.R6 | MUST | It speaks only where a person was already going to be asked |
| PRD-04.R8 | SHOULD | The question reads plainly and says what is needed |

**PRD-04.R7 is not in this phase.** A written answer starting the unbound session needs the daemon to run a session bound to no stage, which it has no path for: `spawn` takes a stage, and the unbound session exists only as a terminal command. That is its own piece of work. Until it lands, the check is silent on a stop that no answer resolves — see 39a.

## Goal Description

`ivtrends` #90 was answered `aprrove`. The gate reader matches five spellings and reads everything else as a change request, so the requirements stage was re-entered to redo work that would come out identical, saw that, and asked for a terminal session. It was right to refuse and it had nothing cheaper it was allowed to do.

The check is one slice because it is one seam: a function that turns a composed message into either itself or a shorter question, and one call site. Cutting it further would have produced a module nothing calls, then a call site — two reviews for one change.

One decision taken here did not reach the ADR bar and is recorded instead of raised: **the check reads both halves of a call to action as an ask.** `Cta.waitingOnYou` means *they must say something here* and `Cta.command` means *they must go and run this*; a run that stopped badly carries only the second, and it is the most expensive ask in the system. Reading only the first would have left the check silent exactly where it is worth most. This is reversible in one line, is not surprising once the two fields are read, and had no real alternative — so it fails all three parts of the significance test.

## Context & Prerequisites

- **`src/daemon/cta.ts`** — `ctaFor` computes what a ticket asks; unchanged by this phase, and its `Cta` is the value the check is gated on.
- **`src/daemon/poll.ts`** — `reconcileCtas` is the one place a person-directed message is composed and upserted. The check has exactly this one call site.
- **`src/daemon/gates.ts`** — `readGateDecision` and `APPROVAL_TOKENS` are untouched, deliberately: PRD-04.R2 is the claim that they stay the only thing that closes a gate.
- **The upsert, not append, of a call to action** — a standing fact reconciled every cycle. This is what forces the question to be remembered rather than recomputed.

## Sub-phases

### Sub-phase 39a: the check, and the one place it is consulted

**[NEW FILE]** `src/daemon/ask-check.ts` — the verdict type, the one-question budget, the prompt, and the strict read of what the model said
**[NEW FILE]** `src/daemon/ask-check.test.ts` — including the structural assertion that the module imports nothing
**[NEW FILE]** `src/daemon/consult.ts` — the model call: one turn, no tools, a timeout, and never a throw
**[MODIFY]** `src/daemon/runs.ts` — `askCheck` on the run, and `rememberAskCheck`, which stamps its own instant
**[MODIFY]** `src/daemon/poll.ts` — `cheaperAsk` and `asksAPerson` in `reconcileCtas`
**[MODIFY]** `src/daemon/poll.test.ts` — the loop's behaviour across cycles
**[MODIFY]** `src/commands/daemon.ts` — the real consult, injectable

**Seams under test (TDD):** `planAskCheck` and `readAskCheckAnswer` are the seams — both pure, both the whole of the safety argument, and neither needs a model to exercise. Red-green: (1) a question is reused while nobody has answered, so a cycle changes nothing; (2) a reply later than the question spends the budget; (3) an unrecognised answer reads as *post as composed*; (4) an empty or over-long question reads the same way; (5) the module's import list is empty. The loop is tested at `pollOnce` with a fake consult, which is the seam the daemon already tests at.

> No dependency on other sub-phases.

The check may speak only where `asksAPerson` is true and the run's wait is not an escalation. The second condition is not a limitation of the design — it is ADR-0052's own rule applied to the check itself, and PRD-04.R7 is what removes it.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"
npx vitest run; echo "exit: $?"
```

- [x] Type-check clean, full suite green (1657 tests)
- [x] The module's import list is empty, asserted on its own source
- [x] A second cycle over an unchanged ticket consults nothing and writes nothing
- [x] A consult that throws still posts the composed message

## Dependency graph

```
39a → (none)        the check, and the one place it is consulted
```
