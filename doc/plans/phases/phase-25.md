# Phase 25: a stage that cannot act on an answer escalates

> **Status:** **Closed 2026-08-19.** Built and gated — see [reports/phase-25-complete.md](reports/phase-25-complete.md) and [reports/phase-25-live-gate.md](reports/phase-25-live-gate.md). [timone#28](https://github.com/fvermaut/timone/issues/28) is closed. Five of 25h's seven steps were observed and its human question answered `yes`; **the mechanical floor and the blocking cost were never observed live** and are the debt this phase leaves. Approved for execution by fvermaut on 2026-08-18, as written and without amendment.

> **The defect [timone#28](https://github.com/fvermaut/timone/issues/28).** Governing decision: **[ADR-0033](../../adr/0033-a-stage-that-cannot-act-on-an-answer-escalates.md)** — a stage that cannot act on an answer escalates — `accepted`, on fvermaut's rulings of 2026-08-18 across four questions, each answered against a recommendation. Standing: [ADR-0031](../../adr/0031-a-handoff-is-a-wait-not-a-failure.md) (extended here), [ADR-0022](../../adr/0022-a-conversation-ticket-can-be-answered-in-writing.md), [ADR-0023](../../adr/0023-one-answer-one-session.md), [ADR-0032](../../adr/0032-a-human-command-asks-the-daemon-to-act.md), [ADR-0024](../../adr/0024-every-open-ticket-answers-for-itself.md), [ADR-0019](../../adr/0019-timone-authored-commits-carry-a-provenance-trailer.md).

## Why this phase exists, and why it is next

**`ivtrends` [#1](https://github.com/fvermaut/ivtrends/issues/1) was verified five times, at `claude-opus-5` / `xhigh`, and asked the human the same question every time.** He answered four times, ending *"How many times do I need to say YES?? Just go ahead to delivery now!"* Each answer re-entered the same stage, which re-measured the same thing and re-asked.

**The stage was never confused, and that is the finding this whole phase turns on.** From pass two onward the session said, unprompted: *"I cannot do it myself — I check the software against the promises, so if I also rewrote them the check would prove nothing."* The judgement was correct, complete, and had nowhere to go: `PipelineTransition` ([`pipeline.ts:373`](../../../src/daemon/pipeline.ts)) offers `advance` / `repeat` / `wait` / `finish`, and verification's `next` is `delivery`. **Judgement was never the scarce resource. Authority was.** A slice that adds a reader, a classifier or a router has misread the defect.

**This is phase 24's own failure recurring one state over, which is why it is next rather than queued.** [ADR-0031](../../adr/0031-a-handoff-is-a-wait-not-a-failure.md) fixed a ticket whose call to action named a command that could not be run. This is a ticket whose call to action named an *answer* that could not work — five times, each one costing a full pass. [R21](../../specs/prd/prd-02-inversion-of-control.criteria.md#r21--every-open-ticket-answers-for-itself)'s clause 1 is broken in exactly the way its 2026-08-16 marker describes: satisfied in the letter, impossible in the substance. And [R3](../../specs/prd/prd-02-inversion-of-control.criteria.md#r3--async-clarification-via-a-conversation)'s third clause already forbids it in as many words — *"it posts only the remainder, once, before handing back the takeover"* — for conversation stages alone. **The principle is in the register; the machinery exists at one stage kind and not the other.**

**It is also the cheapest fix in the backlog per pound of waste avoided.** Five passes at the pipeline's most expensive setting, on one piece of one ticket, none of which could have changed the answer — pass five proved that itself.

## Requirements

> **PRD:** [prd-02-inversion-of-control.md](../../specs/prd/prd-02-inversion-of-control.md) — criteria in [prd-02-inversion-of-control.criteria.md](../../specs/prd/prd-02-inversion-of-control.criteria.md)

| ID | Priority | Requirement (one line) | This phase |
| --- | --- | --- | --- |
| [PRD-02.R21](../../specs/prd/prd-02-inversion-of-control.criteria.md#r21--every-open-ticket-answers-for-itself) | MUST | Every open ticket answers for itself | **evidence, not new wording** — clause 1 broken in substance again, by a CTA naming an answer that could not work |
| [PRD-02.R3](../../specs/prd/prd-02-inversion-of-control.criteria.md#r3--async-clarification-via-a-conversation) | MUST | Async clarification via a conversation | **narrowed** — ADR-0031 widened the written path to every handoff; ADR-0033 takes back the one class where writing cannot help |
| [PRD-02.R10](../../specs/prd/prd-02-inversion-of-control.criteria.md#r10--serialized-work-per-project) | SHOULD | Serialized work per project | **marker only** — an escalation park holds its project, which is the class ADR-0031's revision already covers |
| [PRD-02.R13](../../specs/prd/prd-02-inversion-of-control.criteria.md#r13--harness-owned-routing) | MUST | Harness-owned routing | **unchanged, and worth recording** — the unbound session invoking the skill that fits is clause 2's contract applied to a stuck run |

**Nothing normative is written before approval.** R3's revision and R21's and R10's markers are applied by **25g** and are set out there in full. If this phase is amended, nothing has to be unwound.

**A requirement for escalation itself is owed and is not written here.** ADR-0033 is a decision, not a criterion, and inventing a MUST inside a plan file is stage 3's job taken by the wrong hand. 25g records the debt; the wording is fvermaut's to commission.

Deliberately **not** this phase:

- **Building the `feedback` stage into the daemon.** `feedback: built: false` ([`pipeline.ts:364`](../../../src/daemon/pipeline.ts)) stays true. **That is the point of the unbound session**, and a slice that starts wiring stage 9 has left the plan and doubled its size.
- **Any change to what a stage may do.** Verification still may not rewrite a promise it checks against. Escalation is how the constraint gets *reported*, never a loosening of it.
- **Re-routing by machine.** ADR-0033 considered and rejected it: it trades a loud, expensive loop for a silently skipped gate.
- **`ivtrends` #1.** It is being unblocked by hand in another session, and it is not a fixture. The live gate runs on `scratch-app`, as ruled twice.
- **The words a handed-back message uses** — [timone#4](https://github.com/fvermaut/timone/issues/4)'s neighbourhood, untouched.

## Goal Description

A stage that is handed an answer it may not act on says so once, and the ticket tells you plainly that writing again will not help — and hands you the one command that will.

**Load-bearing, so the build does not drift into something easier:**

- **The escape exists before anything can need it.** Nothing may create an escalation park until the command that resolves one runs. This is [ADR-0031](../../adr/0031-a-handoff-is-a-wait-not-a-failure.md)'s ordering lesson, restated because breaking it here produces a *worse* bug than the one being fixed: a park that holds its project with no way out at all.
- **"Escalation" is a ledger word and never a ticket word.** [process.md](../../../process.md)'s writing rule binds every surface a human reads: the ticket says *"I can't take this further myself"* and what to run, never a stage number, never the word escalate. A slice whose CTA leaks the vocabulary has failed its own validation.
- **Words are never discarded.** An escalation park does not re-enter the stuck stage, and it does not throw away what the human wrote. The words are carried into the escalation session. Refusing to act on an answer and losing it are different things, and only one of them is the decision.
- **The floor reads `consumedAnswerAt`; it never writes it.** [ADR-0023](../../adr/0023-one-answer-one-session.md)'s marker keeps its exact meaning. A slice that repurposes it, or extends its lifetime to make counting easier, has broken the consume-on-read contract phase 19 was built to fix.
- **A real failure is still a failure.** A stage that ends with no outcome still fails, still posts `failedComment`, and is still what `timone retry` exists for. Only the answer-that-cannot-be-used branch is new.
- **The daemon stays the ledger's only writer.** [ADR-0032](../../adr/0032-a-human-command-asks-the-daemon-to-act.md)'s request queue is how the new command acts. A slice with two processes writing `state.json` has misread it.

## The one choice, settled at approval

**Settled 2026-08-18: `timone takeover` is reused, and no `timone escalate` command is added.** fvermaut approved this plan as written, which is what decides it — the section is kept rather than deleted so a building session reads the reasoning instead of reopening the question.

ADR-0033 D6 says the human triggers the escalation from the call to action; it does not say through which command.

The case for reuse: `resolveTakeover` ([`takeover.ts`](../../../src/commands/takeover.ts)) already switches on `waitingKind` and already has an `answer-on-ticket` branch for the kinds it cannot hold a conversation for, so an `escalation` branch is where the code already asks the question. The human has used the command before, the README documents it, and [R14](../../specs/prd/prd-02-inversion-of-control.criteria.md#r14--conversation-channel-seam-with-terminal-takeover) clause 2 already frames takeover as *"it determines what the ticket is waiting on"* — an escalation park is one more thing to determine.

The case against: takeover today means *hold the conversation this stage opened*, and an escalation is explicitly not that — the session opens unbound, which is a different act behind the same word.

**Were a separate command ever preferred after all, 25b splits into two files and nothing else in the plan moves** — recorded so the door stays cheap to reopen, not as an invitation to reopen it.

## Context & Prerequisites

- **`main` is the working branch**, as for phases 15–24. `main` is at `d6699c4`, clean, pushed.
- **973 tests green across 26 files at `d6699c4`**, type-check clean. The command is **`npm run type-check` — note the hyphen. There is no `typecheck` script**, and assuming one cost a session an hour on 2026-08-14.
- `npm run build` before any `node dist/cli.js`. A stale `dist/` has produced a confusing result more than once.
- **The daemon must be restarted after any slice whose behaviour is to be observed.** A running daemon keeps the code it started with. This has now bitten seven times.
- **A live daemon holds `.timone/state.json`.** **Never point a mutating command at that file.** Copy it and use `--state <copy>`, as every slice of phases 22–24 did.
- **`applyPark` ([`runs.ts:1202`](../../../src/daemon/runs.ts)) is where the floor lives**, and the reason is already written in the code above it: a wait is written whole, so *"every other park clears"* the consumed marker. The incoming `run.consumedAnswerAt` is therefore readable at exactly one instant, in exactly one function, before it is dropped. No new detection mechanism is needed and none may be added.
- **`resolveTakeover` already returns `converse` for a `conversation` park at any stage in `PROMPTED_STAGES`** ([`prompts.ts:16`](../../../src/daemon/prompts.ts)), which is why `timone takeover ivtrends#1` would have opened a session — and `takeoverPrompt` ([`prompts.ts:1083`](../../../src/daemon/prompts.ts)) calls `stagePrompt(stage, …)`, which is why it would not have helped. Both facts are load-bearing for 25b.

## Sub-phases

### 25a — The wait nothing written can resolve

**[MODIFY]** [`src/daemon/pipeline.ts`](../../../src/daemon/pipeline.ts) — `PipelineTransition` gains `{ kind: "escalate"; reason: string; owed?: PipelineStage }`; `WaitKind` gains `"escalation"`.
**[MODIFY]** [`src/daemon/runs.ts`](../../../src/daemon/runs.ts) — the run schema's `waitingKind` enum and `ParkOptions.kind` gain `"escalation"`.
**[MODIFY]** [`src/daemon/poll.ts`](../../../src/daemon/poll.ts) — `resolveWait` ([`:1919`](../../../src/daemon/poll.ts)) returns `undefined` for an `escalation` wait, and the branch carries the reason in a comment rather than in prose here.
**[MODIFY]** `src/daemon/pipeline.test.ts`, `src/daemon/runs.test.ts`, `src/daemon/poll.test.ts`.

**The kind and the refusal land together, deliberately.** The refusal *is* the definition: a kind that exists for one slice while written words still resume it is the defect with a new name on it. Splitting them is the one reordering this slice forbids.

**Nothing creates an escalation park in this slice.** No stage reports the outcome, no floor fires, no CTA renders it. That is what makes the slice independently landable and its validation honest.

**Watch the exhaustiveness tripwires, and count the sites before starting.** The codebase leans on them — a fifth request kind breaks at compile time rather than being ignored at runtime. At `d6699c4`, `git grep -n "waitingKind ===\|waitFor(" src/ | grep -v '\.test\.'` returns **22 sites across five files**: [`cta.ts`](../../../src/daemon/cta.ts), [`poll.ts`](../../../src/daemon/poll.ts), [`pipeline.ts`](../../../src/daemon/pipeline.ts), [`session.ts`](../../../src/daemon/session.ts) and [`takeover.ts`](../../../src/commands/takeover.ts). Every one gets read; a `default` that swallows the new kind is how this reappears in six months, and `takeover.ts` is the site where swallowing it silently produces the wedged project 25b exists to prevent.

**Seams under test (TDD):** the exported functions over an injected store and a fake thread. Red-green cases:

- **Written words do not resolve an escalation park.** Red: `resolveWait` returns the stuck stage with the human's words. Green: with a non-machine comment after the cursor, it returns `undefined` — the run stays parked, nothing is spawned. Asserted at the same stage that broke on `ivtrends` #1 (`verification`), because a test at `clarification` would pass an implementation that only special-cased conversation stages.
- **The other three kinds are untouched.** Green: a `gate`, a `conversation` and a `review` park each resolve exactly as they do today, asserted by name in the same file. This is precisely where too much gets changed.
- **The run schema round-trips the new kind.** Green: a state file carrying `waitingKind: "escalation"` loads, and one written before this change loads unchanged at `version: 1`.
- **`ParkOptions` still clears the consumed marker.** Green: parking with `kind: "escalation"` and no `consumedAnswerAt` leaves the run carrying none — the existing contract, asserted here because 25e is about to read it.

#### Agent Validation Steps

```bash
npm test -- src/daemon/pipeline.test.ts src/daemon/runs.test.ts src/daemon/poll.test.ts
npm run type-check
npm test
```

- [ ] The refusal is asserted at `verification`, not only at a conversation stage
- [ ] All three other wait kinds are asserted by name in this slice's tests
- [ ] `git grep -n "WaitKind" src/` — every switch over it has an explicit `escalation` branch, and none was closed with `default`
- [ ] 973 tests still green, plus this slice's

### 25b — The way out, before there is anything to get out of

**[MODIFY]** [`src/commands/takeover.ts`](../../../src/commands/takeover.ts) — `resolveTakeover` gains an `escalation` branch resolving to an **unbound** session; `runTakeover` launches it.
**[MODIFY]** [`src/daemon/prompts.ts`](../../../src/daemon/prompts.ts) — a new `escalationPrompt(project, run, thread)`, **not** a member of `PROMPTED_STAGES` and **not** routed through `stagePrompt`.
**[MODIFY]** `src/commands/takeover.test.ts`, `src/daemon/prompts.test.ts`.

**This slice is the escape hatch and it lands before 25d can create anything that needs it.** Run today it refuses cleanly, because no escalation park exists yet; that refusal is one of its tests.

**The prompt is the whole of D5 and is the one place a reviewer should look hardest.** It carries: the ticket thread, the run's ledger entry, the stuck stage's `reason` and `owed` stage **explicitly marked as input the session may overrule**, and the human's words if any arrived after the cursor. It grants authority to invoke whichever stage skill fits and to depart from a skill's default where the case demands it. **It obliges a committed record** naming what was done and justifying any departure. It must say, in as many words, that the diagnosis it carries was written by a stage that may not read source, ADRs or diffs — because on `ivtrends` #1 that diagnosis told the human to reword *both* failing promises when only one needed new words.

**It must not be a stage prompt wearing a hat.** If a fresh context could mistake it for one, the slice has produced the bound session ADR-0033 rejected.

**Seams under test (TDD):** `resolveTakeover` over an injected store, and `escalationPrompt` as a pure function. Red-green cases:

- **An escalation park resolves to an unbound session.** Red: it resolves to `converse` at the stuck stage. Green: the resolution carries no `PipelineStage` to run as, and the prompt built for it is not `stagePrompt`'s output for any stage — asserted by identity against `stagePrompt(stage, …)` for the stuck stage, not by substring.
- **The prompt marks the diagnosis overrulable.** Green: the reason appears, and so does the sentence saying it may be wrong and why. A prompt that carries the reason as an instruction is the bound session by another route.
- **The words are carried.** Green: comments written after the cursor appear in the prompt. Red: they are dropped because the park refused to resume on them.
- **No escalation park, no session.** Green: run against a `conversation` park it still returns `converse` at that stage; against a `gate` or `review` park, `answer-on-ticket`; against nothing, the existing refusals, each by its own sentence.
- **The record obligation is stated.** Green: the prompt names the record it owes. This is the only audit D5 has, so its absence is a failure and not a nit.

> 25a must be complete.

#### Agent Validation Steps

```bash
npm test -- src/commands/takeover.test.ts src/daemon/prompts.test.ts
npm run type-check
npm run build
npm test
```

- [ ] The unbound assertion is by identity against `stagePrompt`, not a substring match
- [ ] All four pre-existing `resolveTakeover` refusals still asserted by name
- [ ] `git grep -n "PROMPTED_STAGES" src/` — the escalation prompt is not in it
- [ ] The prompt says the carried diagnosis may be wrong, and says why

### 25c — What the ticket says, and what it stops promising

**[MODIFY]** [`src/daemon/cta.ts`](../../../src/daemon/cta.ts) — an `escalation` branch in `ctaFor`, filling the existing `command` slot.
**[MODIFY]** `src/daemon/cta.test.ts`.

**The words are the deliverable here, and they are bound by [process.md](../../../process.md)'s writing rule.** Short sentences, common words, no process vocabulary. The headline says the machine cannot take this further itself. The body says **writing another answer will not move this** — the one thing a reader of the previous five comments could not have known. Then the command, and what running it will do.

**It names which detector fired**, per D3, in plain words: a stage that said so itself reads differently from one that had to be caught, and the second case is worth an apology.

**One computation, two surfaces, unchanged.** `ctaComment` renders what `ctaFor` computes and `timone status` reads the same value ([ADR-0024](../../adr/0024-every-open-ticket-answers-for-itself.md)), so this slice must not add a second opinion in either.

**Seams under test (TDD):** `ctaFor` over run fixtures, and `ctaComment` over its output. Red-green cases:

- **An escalation park gets its own CTA, carrying the command.** Red: it falls through to the generic parked branch and offers nothing. Green: headline, the *writing will not help* sentence, and the command.
- **No process vocabulary reaches the ticket.** Green: the rendered comment contains none of `escalat`, `stage`, `park`, `ledger`, `waitingKind` — asserted as a list, because this is the rule most easily lost to a hurried edit.
- **`timone status` and the ticket agree.** Green: both read the same computed CTA for the same run, which is R21 clause 8 and already has a test to extend rather than duplicate.
- **The detector shows.** Green: a declared escalation and a floor-caught one produce different words.
- **Every other parked shape is untouched.** Green: a `conversation` park still offers the takeover; a `charting` park still says what it says; a wait-less park still reads *"That's as far as I can take this one for now."*

> 25b must be complete — the CTA may not advertise a command that does not run. **This ordering is not a preference.** Reversed, the ticket hands the human a line that fails, which is [timone#1](https://github.com/fvermaut/timone/issues/1) rebuilt.

#### Agent Validation Steps

```bash
npm test -- src/daemon/cta.test.ts src/commands/status.test.ts
npm run type-check
npm test
```

- [ ] The forbidden-vocabulary assertion is a list, and it includes `escalat`
- [ ] The *writing will not help* sentence is asserted, not merely present
- [ ] All four other parked branches asserted by name in this slice's tests

### 25d — A stage says it cannot use the answer

**[NEW MARKER]** [`src/adapters/ticketing.ts`](../../../src/adapters/ticketing.ts) — an escalation marker beside `STAGE_HANDED_MARKER` ([`:66`](../../../src/adapters/ticketing.ts)), carrying the same *written by the machine* framing.
**[MODIFY]** [`src/daemon/outcomes.ts`](../../../src/daemon/outcomes.ts) — `readStageOutcome` ([`:37`](../../../src/daemon/outcomes.ts)) reads it, above the handed marker.
**[MODIFY]** [`src/daemon/session.ts`](../../../src/daemon/session.ts) — the escalate outcome parks with `kind: "escalation"`, the stopping stage, and `waitCursor` set to **the escalation comment's own `createdAt`**, as `handBack` ([`:472`](../../../src/daemon/session.ts)) already does for a handoff.
**[MODIFY]** [`src/daemon/prompts.ts`](../../../src/daemon/prompts.ts) — every stage prompt learns **D2's rule**.
**[MODIFY]** `src/daemon/outcomes.test.ts`, `src/daemon/session.test.ts`, `src/daemon/prompts.test.ts`.

**D2's rule goes in the shared obligations, not per stage.** `stagePrompt` already appends the checkout and provenance blocks to every stage for exactly this reason — *"a per-stage copy is a per-stage chance to forget it"* — and ten copies of the trigger rule is ten chances to get it subtly different. The rule, in the prompt's own voice: **you were given an answer, and acting on it is outside what this stage may do**. With the counter-example beside it, because it is what stops over-firing: a stage that has asked nothing yet, or that simply finds the work hard, has nothing to escalate.

**The marker is read above the handed marker**, because an escalation is a handoff that has additionally given up on being answered. A comment carrying both must resolve as an escalation, and the ordering is what guarantees it rather than the stage remembering not to write both.

**Seams under test (TDD):** `readStageOutcome` over fixture threads, `session.ts`'s `after*` methods over an injected store, `stagePrompt` as a pure function. Red-green cases:

- **An escalation comment parks with the escalation kind and the right cursor.** Red: it reads as a handoff and parks on `conversation`. Green: `kind: "escalation"`, the stopping stage, and `waitCursor` equal to **the fixture comment's own timestamp** — asserted against the fixture, never against a clock, which is the same trap 24e names.
- **Both markers on one comment resolve as an escalation.** Green: precedence asserted directly.
- **The other endings are untouched.** Green: no outcome → `failed` with `failedComment`; a plain handoff → `conversation` park; done with an artifact → next stage; done without one → `failed`. By name, in the same file.
- **No `failedComment` on this path.** Red: the ticket gets *"Something went wrong"* under the session's own explanation.
- **Every prompted stage carries D2's rule.** Green: iterate `PROMPTED_STAGES` and assert the rule appears in each — a loop, not ten assertions, so a stage added later cannot quietly miss it.

> 25a, 25b **and** 25c must be complete. This is the first slice that can create an escalation park, so both the command and the ticket's words must already be real.

#### Agent Validation Steps

```bash
npm test -- src/daemon/outcomes.test.ts src/daemon/session.test.ts src/daemon/prompts.test.ts
npm run type-check
npm test
```

- [ ] The cursor is asserted against the fixture comment's timestamp
- [ ] Marker precedence is asserted, not left to the stages' good manners
- [ ] The D2 coverage test iterates `PROMPTED_STAGES` rather than listing stages
- [ ] All four non-escalation endings asserted by name

### 25e — The floor, for a stage that does not notice

**[MODIFY]** [`src/daemon/runs.ts`](../../../src/daemon/runs.ts) — a counter field on the run schema (optional, absence means zero, `version: 1` unchanged), incremented inside `applyPark` ([`:1202`](../../../src/daemon/runs.ts)), reset by `setStage`.
**[MODIFY]** `src/daemon/runs.test.ts`.

**The condition, exactly.** Inside `applyPark`, **before** `run.consumedAnswerAt` is overwritten: the incoming run carries a consumed marker, the new wait's kind is `conversation`, and `options.stage` is the stage the run is already at. That is a run which consumed an answer and produced another question at the same stage — the definition, computed from state the function already holds. **The second consecutive occurrence escalates**: the park is written as `kind: "escalation"` instead, with the counter recorded so 25c's CTA can say it was caught rather than declared.

**Why here and nowhere else.** `applyPark` is the single site holding both facts, and the comment above it already explains why the marker is transient. A detector anywhere else would need the marker's lifetime extended, which the load-bearing list forbids.

**`setStage` is the reset, because a stage moving is what progress looks like.** Resetting on any park would never accumulate; resetting on nothing would escalate a run that was legitimately re-asked months apart.

**Seams under test (TDD):** `RunStore` against a temp state file, with a frozen clock. Red-green cases:

- **Two consumed-and-re-asked parks at the same stage escalate the second.** Red: the second park is another `conversation` wait and the loop continues. Green: `waitingKind: "escalation"`, counter at 2.
- **A park with no consumed marker never counts.** Green: an ordinary first park, and a hundred of them, leave the counter at zero. This is the discrimination that matters: a stage that asks a question it has not yet been answered is behaving correctly.
- **A different stage resets it.** Green: consumed park at `execution`, then `setStage("verification")`, then a consumed park there → still `conversation`, counter at 1.
- **A `review` or `gate` park does not count.** Green: only the conversation kind, since only it re-enters the same stage.
- **A run from before the field loads and behaves.** Green: no counter present → treated as zero, first consumed re-ask counts as one, nothing throws.
- **The marker's own lifetime is unchanged.** Green: `consumedAnswerAt` is still cleared by every park that does not carry one — the existing assertion, re-run here to prove this slice did not extend it.

> 25d must be complete.

#### Agent Validation Steps

```bash
npm test -- src/daemon/runs.test.ts
npm run type-check
npm test
```

- [ ] The no-marker case asserts zero after **many** parks, not one
- [ ] `consumedAnswerAt`'s existing lifetime test passes unmodified
- [ ] The counter is optional in the schema and a pre-field state file loads

### 25f — End to end, through the loop

**[MODIFY]** [`src/daemon/poll.test.ts`](../../../src/daemon/poll.test.ts) — the proof through `pollOnce`.
**[MODIFY]** [`src/daemon/poll.ts`](../../../src/daemon/poll.ts) — **only if a case below proves it necessary.** The expectation is no production diff: 25a already refuses to resume, 25d already parks, 25e already escalates. **A slice that ends with no production diff has succeeded**, and the grant exists so a real gap gets closed rather than worked around.

**The hazard this slice exists to prove absent.** A `conversation` park is checked by `concludeLastConversation` before resuming, and that reads any machine comment carrying `CONVERSATION_RECORD_MARKER` after the cursor. An escalation park must never be concluded that way — it would mark the run `done` and close a ticket whose work is unfinished and whose question is unanswered. 24f asserted this for handoffs; the new kind needs its own assertion rather than inheriting the reasoning.

**Red-green cases:**

- **The five-pass loop cannot happen.** The defect as a test: a run parked at `verification` on an escalation wait, a human comment after the cursor, ten cycles → `spawn` called **zero** times. Ten, not one, because the fault was a loop.
- **The floor closes it without a stage noticing.** A run at `verification` on a `conversation` park with a consumed marker, answered twice → the second cycle parks it as an escalation and the third spawns nothing. This is the `ivtrends` #1 sequence with the declaration removed.
- **A stage that declares closes it on the first answer.** One cycle, one escalation park, no second pass.
- **A conversation record does not conclude an escalation.** Green: a machine comment carrying `CONVERSATION_RECORD_MARKER` after the cursor leaves the run parked. **If this goes red, the fix is in `poll.ts` and it is inside this slice's grant.**
- **The words survive.** Green: the comments written after the cursor are still readable off the thread for the escalation session — nothing consumed them, nothing cleared them.
- **The rest of the loop is unmoved.** Green: a `conversation` handoff still resumes on `carry on` — 24f's own test, re-run here, because this phase's whole risk is over-reach into the path phase 24 built.

> 25d and 25e must be complete.

#### Agent Validation Steps

```bash
npm test -- src/daemon/poll.test.ts
npm run type-check
npm test
```

- [ ] The zero-spawn assertion runs **ten** cycles
- [ ] 24f's `carry on` test passes unmodified
- [ ] If `poll.ts` changed, the handoff says which case forced it

### 25g — The register and the narrative

**[MODIFY]** [`doc/specs/prd/prd-02-inversion-of-control.criteria.md`](../../specs/prd/prd-02-inversion-of-control.criteria.md) — R3 `verified` → `revised` with a dated marker; dated markers on R21 and R10; the owed requirement recorded.
**[MODIFY]** [`STATUS.md`](../../../STATUS.md), [`CONTEXT.md`](../../../CONTEXT.md) if the vocabulary needs it.

**R3 is narrowed, and it costs its verification.** ADR-0031 widened ADR-0022's written path to every handoff; ADR-0033 takes back the one class where writing cannot help. R3's third clause promises a written answer is picked up and acted on; for an escalation park that is now deliberately false. **A criterion whose text changes has no evidence until it is re-checked**, so `revised` is the honest status and it leaves the derived regression set until a stage-7 pass returns it.

**R21 is not reworded.** The criterion was right and the machinery was not — the same sentence its 2026-08-16 marker already carries. The marker records that clause 1 broke in substance a second time, on a CTA naming an answer rather than a command, and that this does not move the status: **a defect found and fixed is not a verification.**

**R10 gets a marker only.** An escalation park holds its project exactly as ADR-0031's handoff park does; the revision covering that class is already written.

**R13 is untouched and gets a line**, because the alignment is worth recording rather than rediscovering: the unbound session invoking whichever skill fits *is* clause 2's contract, applied to a stuck run instead of a raw request.

**The owed requirement is recorded, not written.** Escalation has no criterion of its own. 25g says so, names ADR-0033 as its source, and leaves the wording to be commissioned — inventing a MUST here would be stage 3's work done by the wrong hand, and it would arrive unverifiable.

> 25a–25f must be complete. **Nothing normative is written before this slice**, so an amendment to this plan unwinds nothing.

#### Agent Validation Steps

```bash
npm run type-check
npm test
git diff --stat
```

- [ ] R3's status is `revised` and the marker says why its evidence is stale
- [ ] R21 carries a marker and its status has **not** moved
- [ ] No new criterion was written for escalation
- [ ] `git diff` touches no file under `src/`

### 25h — The live gate

**No files.** Observation on `scratch-app`, with a restarted daemon, written up whatever the outcome.

**`ivtrends` is not the fixture.** Ruled twice, and restated because this gate deliberately stalls a run and because `ivtrends` #1 is being unblocked by hand elsewhere.

**The steps, each an observation and not a hope:**

1. **A stage declares, and the ticket says the right thing.** Drive a run to a stop where the answer cannot be used, and read the ticket: it says writing again will not help, and carries a command.
2. **The command runs, and opens something that is not the stuck stage.** Confirm from the session's own behaviour, not from the code.
3. **The unbound session leaves its record.** Read it. Does it name what it did, and justify any default it departed from?
4. **The floor catches a stage that does not declare.** Force the sequence with a stage that stays silent; confirm the second answer escalates rather than re-asking, and that the ticket says it was caught.
5. **Ten cycles, zero spawns.** Leave an escalation park up and watch the log. The waste this phase exists to stop is measured, not assumed.
6. **`carry on` still works.** Phase 24's own path, re-driven, because this phase's risk is over-reach into it.
7. **The blocking cost.** Queue a second ticket behind an escalation park, confirm it waits, then resolve the escalation and confirm the queued ticket is promoted.

```bash
node dist/cli.js daemon --once
node dist/cli.js status
gh issue view <n> --repo fvermaut/scratch-app --comments
cat .timone/state.json
```

- [ ] Steps 1–7 each observed, with timestamps and costs captured
- [ ] `.timone/state.json` hand-edited **zero** times across the whole gate
- [ ] The gate report is written to `doc/plans/phases/reports/phase-25-live-gate.md` whatever the outcome, including any step not reached
- [ ] **Human gate — fvermaut answers one question:** handed a stop the machine cannot resolve, did the ticket tell you the truth about it the first time? This phase exists because it told him the same untruth five times.

## Dependency graph

```
25a → (none)          the wait nothing written can resolve
25b → 25a             the way out
25c → 25b             what the ticket says
25d → 25a, 25b, 25c   a stage declares it
25e → 25d             the floor
25f → 25d, 25e        end to end
25g → 25a–25f         the register
25h → 25g             the live gate
```

**There is no parallel pair here.** 25b and 25c look independent — different files, zero overlap — and they are not: the CTA must not advertise a command until the command runs.

**25d depends on all three before it, and that is the ordering that must not be relaxed.** It is the tempting reorder, because 25d is the fix and the rest is scaffolding. Built early, it creates a park that holds its project, offers no command, and cannot be resumed by anything. **That is strictly worse than the bug being fixed:** five expensive passes become one wedged project. The escape first, always — the same lesson, in the same place, as phase 24.

## Safe stopping point

**25a–25d form a coherent shippable increment, and if this phase has to be reduced mid-flight it reduces *there*.**

After 25d: a stage that recognises the dead end says so once, the ticket tells the truth about it and hands over a command that works, and the command opens a session that can actually resolve it. [timone#28](https://github.com/fvermaut/timone/issues/28) closes for every stage that notices.

**What stopping there costs, named:** the floor is absent, so a stage that does not recognise the dead end still re-asks — today's behaviour, and no worse. R3's revision still lands at 25g; R21's marker shrinks to describing a partial fix.

**Stopping before 25c is not safe** and this is the one line in this plan that is a refusal rather than a recommendation: 25a–25b alone is dead code, and 25a plus 25d in either order is a wedged project.

## What this phase does not prove

- **That a stage reliably recognises D2's trigger.** One fixture exercises one or two stages; the rule is appended to ten prompts and its reliability is a property of ten different jobs. The floor exists because this cannot be proven, not because it can.
- **That the unbound session does the right thing.** This is ADR-0033 D5's accepted cost and the gate can only read one record. Whether an unbound session is trustworthy across many stuck runs is not a question eight steps can settle.
- **That a stage does not escalate too readily.** The over-firing failure mode is invisible to a gate that only drives stops which genuinely need escalating. A run summoning a person who was not needed costs a declined CTA and would be found by use, not here.
- **That the words read well to someone who has not been told what any of this is.** 25c asserts the vocabulary is absent; it cannot assert the sentence lands. That is step 1's human question and one person's answer on one ticket.
- **That the counter survives a reset state file.** As with phase 20's introduction ledger, a lost state file re-arms the floor. It adds no new class of failure and is recorded so a later reader does not mistake it for drift.
- **Anything about a stuck run with no ticket.** Hand-run work has no CTA surface, so the escalation reaches nobody. Out of scope, and unproven either way.
