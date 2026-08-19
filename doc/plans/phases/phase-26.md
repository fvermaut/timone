# Phase 26: a resolved escalation hands the run back

> **Status:** Planned. **Approved for execution by fvermaut on 2026-08-19**, as written and without amendment.

> **The defect [timone#30](https://github.com/fvermaut/timone/issues/30)**, found by [phase 25's live gate](reports/phase-25-live-gate.md). Governing decision: **[ADR-0035](../../adr/0035-a-resolved-escalation-hands-the-run-back.md)** — `accepted`, on fvermaut's rulings of 2026-08-19 across three questions. Standing: [ADR-0033](../../adr/0033-a-stage-that-cannot-act-on-an-answer-escalates.md) (completed here), [ADR-0024](../../adr/0024-every-open-ticket-answers-for-itself.md), [ADR-0022](../../adr/0022-a-conversation-ticket-can-be-answered-in-writing.md), [ADR-0032](../../adr/0032-a-human-command-asks-the-daemon-to-act.md), [ADR-0019](../../adr/0019-timone-authored-commits-carry-a-provenance-trailer.md).

## Why this phase exists, and why it is next

**`scratch-app` [#37](https://github.com/fvermaut/scratch-app/issues/37) is stranded right now, and it is stranded by a session that did everything right.** Opened by `timone takeover` on 2026-08-18, it refused to sign fvermaut's name to a document he had not read, wrote the document, took his approval in person, recorded it publicly, and started building. Two faults came out of that one session, and they are the same fault:

- **It carried on and built**, in a terminal, unattended — spending the serialisation, the cost per step, the per-stage provenance, the gates and the fresh-context check that the loop exists to give.
- **The run was left stopped for ever.** `releaseClaim` restores *the wait the run was holding*, so an escalation park comes back as an escalation park, on a ticket whose work is approved and under way. Nothing can say *this is resolved, carry on from here*: `timone retry` refuses a parked run, `timone cancel` throws the chunk away.

**Neither is fixable alone**, which is why this is one phase. A rule that says *stop at unblocking* strands the run exactly as it is now. A road back that nothing is told to take leaves the session building.

**It is phase 25's own ordering lesson, one level up.** That phase is built on *the escape must exist before anything can need it*, and it built the human's escape while leaving the run without one — because [ADR-0033](../../adr/0033-a-stage-that-cannot-act-on-an-answer-escalates.md) D6 settles the entry and is silent on the exit, and the plan followed the ADR. Nobody who read it caught it. **That is the argument for doing it next rather than queuing it:** every escalation the machinery now produces correctly is a run that leaves the loop for good.

## Requirements

> **PRD:** [prd-02-inversion-of-control.md](../../specs/prd/prd-02-inversion-of-control.md) — criteria in [prd-02-inversion-of-control.criteria.md](../../specs/prd/prd-02-inversion-of-control.criteria.md)

| ID | Priority | Requirement (one line) | This phase |
| --- | --- | --- | --- |
| [PRD-02.R3](../../specs/prd/prd-02-inversion-of-control.criteria.md#r3--async-clarification-via-a-conversation) | MUST | Async clarification via a conversation | **marker only** — its 2026-08-18 revision holds: a human's written answer still resolves nothing here. What is added is a second *machine* record that does, read exactly as a conversation record is |
| [PRD-02.R21](../../specs/prd/prd-02-inversion-of-control.criteria.md#r21--every-open-ticket-answers-for-itself) | MUST | Every open ticket answers for itself | **evidence, not new wording** — a ticket whose standing note says *"I can't take this one further myself"* over work that is approved and building is clause 1 broken in substance a third time |
| [PRD-02.R10](../../specs/prd/prd-02-inversion-of-control.criteria.md#r10--serialized-work-per-project) | SHOULD | Serialized work per project | **marker only** — a run handed back at a branch-owning step starts holding its project again, by the rule that already exists |
| [PRD-02.R13](../../specs/prd/prd-02-inversion-of-control.criteria.md#r13--harness-owned-routing) | MUST | Harness-owned routing | **unchanged** — the session names the step in the machine's own plain words; the human still names nothing |

**Nothing normative is written before approval.** Every marker is applied by **26e** and is set out there in full.

**The requirement owed since 25g is still owed and is still not written here.** Escalation has no criterion of its own; this phase gives that missing criterion a second half to describe, and the wording stays fvermaut's to commission.

Deliberately **not** this phase:

- **Enforcing D1.** Nothing can stop a terminal session writing code. What the machinery gets is a rule in a prompt and a refusal to carry on from a handback that names a step the work has not reached — the same shape as ADR-0033 D2's trigger rule, and named as such rather than pretended otherwise.
- **Checking what the escalation session wrote.** The run carries on at the named step and the ordinary gates apply from there. Whether an artifact written outside the loop deserves its own check is stage 9's, on evidence nobody has.
- **A `timone handback` command.** ADR-0035 D2 considered it and chose the ticket. **If it is ever wanted, 26b and 26c gain a caller and nothing else moves** — recorded so the door stays cheap, not as an invitation.
- **`ivtrends`.** The gate runs on `scratch-app`, as ruled three times.

## Goal Description

A person and the machine clear a stop together in the terminal, and the work goes back into the loop at the step it should — with the ticket saying so, and nobody typing a second command.

**Load-bearing, so the build does not drift into something easier:**

- **The reader lands before the writer.** Nothing may tell a session to write a handback until the daemon acts on one. This is the lesson this phase exists to apply, and getting it wrong here produces a session that writes a note nothing reads, on a run that stays stopped — the present bug with more words on the ticket.
- **A step the machine does not recognise is refused, never guessed.** Guessing starts a session at the wrong step on a branch of half-built work. The refusal says on the ticket that the machine did not understand its own note.
- **Only the machine's own record resolves it.** ADR-0033's refusal is untouched: a human writing again still starts nothing. A human's copy of the marker is not a record, exactly as with a gate.
- **The branch is computed, never trusted.** `claimBranch` already derives the name from the ticket and the chunk. A handback that carried a branch name would let a comment redirect the work.
- **"Handback" is a ledger word and never a ticket word.** [process.md](../../../process.md)'s writing rule binds every surface a person reads.
- **The daemon stays the ledger's only writer** ([ADR-0032](../../adr/0032-a-human-command-asks-the-daemon-to-act.md)). The escalation session writes a comment and nothing else.

## Context & Prerequisites

- **`main` is the working branch**, as for phases 15–25. `main` is at `7409a25`, clean, pushed.
- **1063 tests green across 27 files** at `7409a25`; type-check clean. The command is **`npm run type-check` — note the hyphen.**
- `npm run build` before any `node dist/cli.js`. **The daemon must be restarted after any slice whose behaviour is to be observed** — this has bitten seven times.
- **A live daemon holds `.timone/state.json`. Never point a mutating command at it.** Phase 25's gate ran against a copy with `--state` and a manifest naming `scratch-app` alone; do the same.
- **`scratch-app` #37 is the fixture and it is already in the state the gate needs.** Its run is parked on an escalation in **phase 25's gate ledger copy**, its branch carries approved requirements, a decision record, a breakdown and a phase plan, and the ticket carries fvermaut's approval. **Do not tidy it up.** If it is lost, reproducing it costs a fresh ticket and about $1.
- **`STAGE_LABELS` in [`status.ts`](../../../src/commands/status.ts) is partial** — five stages of thirteen — and 26a is where it stops being a private detail of one command.
- **`readConversationRecord` ([`gates.ts:83`](../../../src/daemon/gates.ts)) is the shape to copy**, not to extend: the machine's own comment, after a cursor, never a human's.

## Sub-phases

### 26a — One name per step, in one place

**[MODIFY]** [`src/daemon/pipeline.ts`](../../../src/daemon/pipeline.ts) — a plain-words name for **every** stage, with `stageLabel(stage)` and `stageFromLabel(label)`.
**[MODIFY]** [`src/commands/status.ts`](../../../src/commands/status.ts) — its private `STAGE_LABELS` becomes a reader of that map.
**[MODIFY]** `src/daemon/pipeline.test.ts`, `src/commands/status.test.ts`.

**Why it is a slice and not a line in the next one.** A name a machine reads back has to be unique and total; `STAGE_LABELS` is neither — it names five stages and leaves eight to fall back on their internal spelling. A second surface reading that map is what makes the gaps matter.

**The words are the ones already shipped** for the five that have them (*building*, *checking the result*, *delivering*, *acting on your review*, *working out the pieces*). The eight new ones are written here and are the phase's only new vocabulary aimed at a person.

**Seams under test (TDD):** the two pure functions. Red-green cases:

- **Every stage has a name.** Green: iterate `PIPELINE_STAGES`, assert a non-empty label for each — a loop, so a stage added later cannot quietly miss one.
- **Names round-trip and are unique.** Green: `stageFromLabel(stageLabel(s)) === s` for every stage; the set of labels has as many members as the set of stages.
- **An unknown name yields nothing.** Green: `stageFromLabel("whatever")` is `undefined`, and so is the empty string.
- **`timone status` says exactly what it said before.** Green: its existing line assertions pass unmodified.

#### Agent Validation Steps

```bash
npm test -- src/daemon/pipeline.test.ts src/commands/status.test.ts
npm run type-check
npm test
```

- [ ] The coverage test iterates `PIPELINE_STAGES` rather than listing stages
- [ ] Uniqueness is asserted, not assumed
- [ ] `git grep -n "STAGE_LABELS" src/` — one definition, and it is not in `status.ts`

### 26b — The note, and the reader that understands it

**[NEW MARKER]** [`src/adapters/ticketing.ts`](../../../src/adapters/ticketing.ts) — a handback marker beside `STAGE_ESCALATED_MARKER`, carrying the same *written by the machine* framing.
**[MODIFY]** [`src/daemon/outcomes.ts`](../../../src/daemon/outcomes.ts) — `readHandback(thread, cursor)`, returning the step named, *no step named*, or *a name I do not know* as three distinct answers.
**[MODIFY]** `src/daemon/outcomes.test.ts`.

**Three answers, not two, and that is the whole of the slice's design.** *Nothing here* leaves the run stopped and says nothing. *A name I do not know* leaves the run stopped and has something to say. Collapsing them makes the refusal indistinguishable from silence, and 26c cannot then tell the human why nothing happened.

**Nothing writes one in this slice.** No prompt mentions it, no run resumes on it.

**Seams under test (TDD):** `readHandback` over fixture threads. Red-green cases:

- **A machine note naming a step reads as that step.** Green: the marker, a step named in 26a's words, and the stage comes back.
- **A human's copy of the marker is not a note.** Green: same body, `fromTimone: false` → nothing. The gate trap, asserted for the new marker rather than assumed from its neighbours.
- **A note before the cursor is not this stop's note.** Green: at or before → nothing.
- **A name nobody defined is refused, and says which.** Green: *"carrying on at: whatever"* → the unknown answer, carrying `whatever` so the ticket can quote it.
- **No step named is its own answer.** Green: the marker alone → *named nothing*, distinct from *nothing here*.
- **The escalation marker is not a handback.** Green: a comment carrying `STAGE_ESCALATED_MARKER` after the cursor reads as nothing here — the stage's own account must never resolve its own stop.

#### Agent Validation Steps

```bash
npm test -- src/daemon/outcomes.test.ts
npm run type-check
npm test
```

- [ ] The three answers are distinguishable by a caller, asserted as three
- [ ] The human-copy refusal is asserted for this marker by name
- [ ] A stage's own escalation comment is asserted not to resolve it

### 26c — The loop carries on, or says it could not

**[MODIFY]** [`src/daemon/poll.ts`](../../../src/daemon/poll.ts) — `resolveWait`'s `escalation` branch reads the handback: a step named resumes there, nothing named resumes at the stopped step, a name it does not know leaves the run parked.
**[MODIFY]** [`src/daemon/cta.ts`](../../../src/daemon/cta.ts) — what the ticket says when the machine did not understand its own note.
**[MODIFY]** `src/daemon/poll.test.ts`, `src/daemon/cta.test.ts`.

**The branch is claimed by the machinery that already claims it.** `claimBranch` ([`session.ts:1462`](../../../src/daemon/session.ts)) fires on entering a stage that owns one and computes `workBranch(ticket, seq)`. A run handed back at `execution` therefore lands on the branch the pipeline would have named — which on #37 is the branch the escalation session actually used. **A slice that carries a branch name in the comment has let a comment redirect the work.**

**The refusal's words**, bound by [process.md](../../../process.md)'s writing rule: the machine left itself a note it cannot read, that is its own fault, and the way out is the same command as before. No step names, no marker text, no vocabulary from this plan.

**Seams under test (TDD):** `pollOnce` over an injected store and a fake thread; `ctaFor` over run fixtures. Red-green cases:

- **A handback naming a step starts that step, once.** Red: the run stays parked for ever. Green: one session at the named step, the wait cleared, and a second cycle starts nothing.
- **A handback naming nothing starts the step that stopped.** Green: asserted at the stage it parked at, not at the one after.
- **A run handed back at a branch-owning step gets its branch.** Green: the branch is `workBranch`'s, and it is not read from the comment — asserted by putting a different name in the comment and finding it ignored.
- **The human's words still start nothing.** Green: ten cycles with the human answering after the stop, no handback note → zero sessions. **25f's own test, re-run here**, because this slice is where that guarantee could be lost.
- **A name the machine does not know leaves it parked and says so.** Green: the run stays escalated, the ticket's standing line says the machine did not understand its own note and names the command, and no session starts.
- **A stage's own escalation comment does not resolve its stop.** Green: end to end through `pollOnce`, not only in the reader.

> 26a and 26b must be complete.

#### Agent Validation Steps

```bash
npm test -- src/daemon/poll.test.ts src/daemon/cta.test.ts
npm run type-check
npm test
```

- [ ] The branch assertion proves the comment's name is *ignored*, not merely absent
- [ ] 25f's ten-cycle zero-spawn test passes unmodified
- [ ] The refusal CTA contains none of `handback`, `escalat`, `stage`, `park`, `marker`

### 26d — The session is told where its job ends

**[MODIFY]** [`src/daemon/prompts.ts`](../../../src/daemon/prompts.ts) — `escalationPrompt` gains ADR-0035 D1's bound and D2/D3's closing shape.
**[MODIFY]** `src/daemon/prompts.test.ts`.

**This is the slice that changes what a session does, and it lands last for that reason.** Run before 26c it produces a note nothing reads.

**What it must say**, and each clause is there because #37 did the opposite:

- **Unblock, then stop.** Clear what is in the way — take the decision, write or correct the artifacts it needs, commit the account already owed — and **do not write application code, do not open a pull request**. Say why in the prompt's own voice: the loop gives one piece at a time, a cost per step, a stage on every commit, gates, and a fresh context that checks what an earlier one built; a terminal session buys speed by spending all five.
- **Close with the handback note**, in the exact shape 26b reads, naming the step in 26a's words — with the list of names it may use, since a name outside that list is refused.
- **Name the step by what is now true**, not by where it stopped: on #37 the requirements were written and approved, so *building* is the honest answer and *the step it stopped at* would rewrite what a person had just agreed.
- **Where nothing should be built at all**, `timone cancel` ends the chunk and is the right ending — named so the session does not invent one.

**The comment carrying the handback is the same comment that ends the conversation with the human**, and the writing rule binds it: the marker is machine bookkeeping under the header, and everything a person reads is plain.

**Seams under test (TDD):** `escalationPrompt` as a pure function. Red-green cases:

- **The bound is stated, both halves.** Green: the prompt forbids application code and a pull request in as many words, and gives the reason rather than only the rule.
- **The closing note's shape is exact.** Green: the marker string, the header rule above it, and the list of step names — asserted against `stageLabel` for every stage, so a stage added later cannot leave the prompt naming a name the reader rejects.
- **It says an unknown name is refused.** Green: a session that invents a step must know it will be refused rather than guessed at.
- **`timone cancel` is named as the other ending.** Green: the exact command.
- **It is still not a stage prompt.** Green: 25b's identity assertion, re-run unmodified.

> 26c must be complete.

#### Agent Validation Steps

```bash
npm test -- src/daemon/prompts.test.ts
npm run type-check
npm run build
npm test
```

- [ ] The step-name list is generated from `stageLabel`, not typed out
- [ ] 25b's identity assertion passes unmodified
- [ ] The prompt says why building is out of bounds, not only that it is

### 26e — The register and the narrative

**[MODIFY]** [`doc/specs/prd/prd-02-inversion-of-control.criteria.md`](../../specs/prd/prd-02-inversion-of-control.criteria.md) — dated markers on R3, R21, R10; R13 a line; the owed requirement's note extended.
**[MODIFY]** [`STATUS.md`](../../../STATUS.md), [`CONTEXT.md`](../../../CONTEXT.md).

**R3 keeps its `revised` status and gains a marker.** Its 2026-08-18 revision said a written answer no longer reaches this class of stop; that stays exactly true. What is added is a *machine* record that does — the same shape as the conversation record the criterion has always had. **A criterion already `revised` does not become more revised**; the marker records that the class of thing that can end the stop grew by one, and that its evidence is still owed.

**R21 gets a marker and does not move.** A ticket saying *"I can't take this one further myself"* over work that is approved and building is clause 1 broken in substance a third time — after a command that could not be run (phase 23) and an answer that could not work (phase 25). Three findings of one clause, three fixes, and still no verification: that is what the marker says.

**R10 gets a marker only.** A run handed back at a branch-owning step holds its project again, by the rule that already exists.

**`CONTEXT.md` gains the round trip** beside **Escalation**: what ends one, and that it ends by the machine's own record rather than by anything a person writes.

> 26a–26d must be complete. **Nothing normative is written before this slice.**

#### Agent Validation Steps

```bash
npm run type-check
npm test
git diff --stat
```

- [ ] R3's status is still `revised` and the marker says why it is not a new revision
- [ ] R21 carries a marker and its status has **not** moved
- [ ] No new criterion was written for escalation or for the handback
- [ ] `git diff` touches no file under `src/`

### 26f — The live gate

**No files.** Observation on `scratch-app`, with a restarted daemon, written up whatever the outcome.

**The fixture already exists and is in exactly the right state:** [#37](https://github.com/fvermaut/scratch-app/issues/37), stranded on an escalation park in phase 25's gate ledger copy, with approved requirements and a decision record on its branch. **Reaching this state again costs a fresh ticket, an answer and about $1**, so the gate runs against it rather than recreating it.

**The steps, each an observation and not a hope:**

1. **A takeover unblocks and stops.** Run `timone takeover` on the fixture, work the stop through, and watch the session **not** build: it closes with the note and stops.
2. **The ticket reads as a round trip.** The comment says what was settled and what happens next, in plain words, with no note of the machinery leaking into it.
3. **The next cycle carries the work on.** The daemon starts a session at the named step, on the branch the pipeline names, with no second command typed.
4. **The standing note stops saying it is stuck.** Read the ticket: it says what is happening now.
5. **A note it cannot read is refused out loud.** Post a handback naming a step that does not exist, and confirm the run stays stopped and the ticket says the machine did not understand its own note.
6. **The human's words still start nothing.** Answer the stopped ticket in writing; confirm zero sessions across several cycles. Phase 25's guarantee, re-driven, because this phase's risk is over-reach into it.
7. **The work reaches a pull request through the loop**, one piece at a time, each step on the ticket — which is the whole reason building was taken away from the terminal.

```bash
node dist/cli.js daemon --once --manifest <gate>/timone.yaml --state <gate>/state.json
node dist/cli.js status --state <gate>/state.json
gh issue view 37 --repo fvermaut/scratch-app --comments
```

- [ ] Steps 1–7 each observed, with timestamps and costs captured
- [ ] `.timone/state.json` hand-edited **zero** times, and the live file untouched
- [ ] The gate report is written to `doc/plans/phases/reports/phase-26-live-gate.md` whatever the outcome, including any step not reached
- [ ] **Human gate — fvermaut answers one question:** you cleared a stop in your terminal and walked away. Did the work carry on without you, and did the ticket tell you it had?

## Dependency graph

```
26a → (none)          one name per step
26b → 26a             the note, and its reader
26c → 26a, 26b        the loop carries on, or says it could not
26d → 26c             the session is told where its job ends
26e → 26a–26d         the register
26f → 26e             the live gate
```

**Strictly linear, and the one ordering that must not be relaxed is 26c before 26d.** Reversed, a session is told to write a note nothing reads, on a run that stays stopped — the present bug with more words on the ticket, and harder to see because the session looks like it worked. **This is the same reversal phase 25 got right and this phase exists because ADR-0033 got wrong one level up.**

## Safe stopping point

**26a–26d is the shippable increment**, and if this phase has to be reduced mid-flight it reduces after 26d: the road exists, the session is told to take it, and the register catches up later.

**Stopping before 26d is not safe** and this is a refusal rather than a recommendation: 26a–26c alone is a reader with nothing to read, and every escalation the machinery produces still leaves the loop for good.

## What this phase does not prove

- **That a session obeys D1.** The bound is a rule in a prompt with nothing enforcing it, exactly as ADR-0033 D2's trigger rule is. What can be observed is one session on one fixture.
- **That the step a session names is the right one.** It is a judgement made with the human present, and the machinery can only refuse a name it does not know — not a name that is wrong.
- **That handing back works from every step.** The fixture exercises one path (a stop at the conversation step, handed back to building). Twelve others are untested live.
- **That the artifacts an escalation session wrote are good enough to build from.** The loop carries on and its ordinary gates apply; whether work written outside the loop needs its own check is a question this phase deliberately leaves open.
- **That a lost ledger keeps any of it.** As with every state this system holds, a reset file loses the run and the ticket is picked up afresh.
