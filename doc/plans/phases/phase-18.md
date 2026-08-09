# Phase 18: a ticket you can just answer

> **Status:** **Awaiting approval.** Written 2026-08-09 immediately after the grill that produced [ADR-0022](../../adr/0022-a-conversation-ticket-can-be-answered-in-writing.md), so the decision does not evaporate between the conversation and the plan. Hand-planned, as all Timone-self phases are. Approval is gated on this file per [ADR-0014](../../adr/0014-artifact-first-gates.md).

> **Eighth phase of [PRD-02](../../specs/prd/prd-02-inversion-of-control.md).** Governing decision: **[ADR-0022](../../adr/0022-a-conversation-ticket-can-be-answered-in-writing.md)**, which amends [ADR-0012](../../adr/0012-conversation-channels.md). Standing: [ADR-0007](../../adr/0007-sessions-at-timone-root.md), [ADR-0010](../../adr/0010-wayfinder-discovery-maps.md), [ADR-0013](../../adr/0013-stateless-session-reentry.md), [ADR-0014](../../adr/0014-artifact-first-gates.md), [ADR-0019](../../adr/0019-timone-authored-commits-carry-a-provenance-trailer.md).

## Why this phase exists

On 2026-08-09 `ivtrends` held six open `wayfinder:grilling` tickets. Each was a well-formed question. None told the human what to do about it, and the command they would have needed refused:

```
$ node dist/cli.js takeover ivtrends#5
I'm not working on ivtrends #5. Add the `timone` label to that ticket and I'll pick it up.
```

`timone-wayfind` creates its tickets straight through `gh`, outside the daemon's conversation machinery, so none of `src/channels/terminal.ts`'s CTA-writing reached them and no run ever entered the ledger. `grep -rn wayfinder src/` returns nothing: the daemon does not know this class of ticket exists. A stage-2 map was therefore something the human could **read** and could not **answer** — the exact inverse of what stage 2 at scale is for.

The doc half of the fix landed with the grill on 2026-08-09: `process.md`, `timone-wayfind` and PRD-02 now say what a waiting ticket must offer. **This phase is what makes those words true.** Until it lands, the skill is under instruction to write the written-answer path alone and say the talk-it-through option is not wired up — because a CTA naming a command that refuses is the same defect in a better disguise.

## Requirements

> **PRD:** [prd-02-inversion-of-control.md](../../specs/prd/prd-02-inversion-of-control.md) — criteria in [prd-02-inversion-of-control.criteria.md](../../specs/prd/prd-02-inversion-of-control.criteria.md)

| ID | Priority | Requirement (one line) | This phase |
| --- | --- | --- | --- |
| PRD-02.R20 | MUST | Wayfinder decision tickets participate in the loop — CTA, takeover, written pickup | **closes** — the whole of it |
| PRD-02.R3 | MUST | Async clarification via a conversation | **returns to `verified`** — set `revised` on 2026-08-09 by ADR-0022's added clause; this phase implements that clause and stage 7 re-verifies the requirement whole |

**R3's re-entry is not a formality.** It was `verified` on evidence gathered at [phase 12](phase-12.md)'s gate against the takeover path only. The written path has never been observed, and a requirement's status is the weakest of its clauses' outcomes, so the pass re-checks the two old clauses as well as the new one.

Deliberately **not** this phase: the Slack channel behind the same seam; a written-answer path for **gates** (they already have one — a gate reply *is* writing on the ticket, and nothing about that changes); retrofitting CTAs onto the six live `ivtrends` tickets, which is a one-command chore once 18b exists and is not worth a slice; the frozen output-token counter, still R17's remainder and still unexplained.

## Goal Description

A ticket that is waiting on you says so, and you can answer it without leaving the page.

**Load-bearing decisions, fixed here so slices don't re-litigate them:**

- **Wayfinder tickets join the marked set rather than growing a second watched set.** `listMarkedTickets` filters on `MARK_LABEL`; a wayfinder ticket gets that label *at creation, by the skill that creates it*, plus its existing `wayfinder:<type>` label. The pipeline then recognises the wayfinder class from that second label and routes it to stage 2's at-scale mode instead of triage. **The alternative — a parallel listing keyed on `wayfinder:*` — was rejected** because it would duplicate pickup, serialization ([R10](../../specs/prd/prd-02-inversion-of-control.criteria.md), one run per project) and the ledger, and would leave `timone takeover` needing a tracker-resolution path it does not need if a run exists. One watched set, one pickup rule, one ledger.
- **The map ticket is never marked.** It is an index, not work. Marking it would create a run for a ticket nothing can resolve.
- **The ADR gate was considered for that choice and does not fire.** It is a label and a routing branch — cheap to reverse — and it is the obvious reading of R10 and R14 rather than a surprise. If approval disagrees, that disagreement *is* the trade-off and the decision earns its own ADR before 18b starts.
- **A human comment after the machine's question is the answer, with no keyword.** `isMachineComment` already separates the machine's own comments; the newest non-machine comment posted after the park is the answer. Nothing new for the human to remember, and identical to how a gate reply is read.
- **The clarifying round is counted on the ticket, not in the ledger.** How many times the machine has asked is derivable from the thread — machine comments carrying the clarification marker — and a ledger counter would be a second copy of a fact the thread already holds. **One clarifying round**: ask once, and if the next answer still does not settle it, hand back the takeover.
- **Escalation is the session's judgement, and it fails toward the terminal.** No slice tries to make "settled" mechanically decidable. What the slices guarantee is the *bound* — that a second unsettled answer produces a takeover CTA rather than a third question.
- **The invitation is one copy, used twice.** `TerminalChannel.open` writes the daemon's conversation park; the wayfind skill writes the same block into a ticket body. They must not drift, so 18a is what both refer to and the skill's template is checked against it at 18d.

## Context & Prerequisites

- **[Phase 17](phase-17.md) is complete** and its witness fields are top-level on the state; this phase adds no state fields, so the two do not touch.
- **The doc half is already committed** (2026-08-09): `process.md`'s conversations section and stage-2 at-scale paragraph, `timone-wayfind`'s CTA templates and written-answer rules, ADR-0022, and PRD-02's R3 revision plus R20. Slices implement those words; they do not re-decide them.
- **`MACHINE_MARKER`, `CONVERSATION_RECORD_MARKER` and `isMachineComment`** already exist in `src/adapters/ticketing.ts` and are what the answer-detection is built from. No new marker unless a slice can say why the existing ones cannot carry it.
- **`resolveTakeover` resolves from the ledger** (`src/commands/takeover.ts:85`) and its refusal paths were verified live at phase 12's gate. Those refusals stay; a wayfinder ticket stops reaching them because it acquires a run, not because a branch is added for it.
- **The daemon must be attended for the gate.** Phase 17 lifted the overnight prohibition, so this is a convenience now rather than a constraint.

## Sub-phases

### 18a: the invitation offers both paths

**[MODIFY]** `src/channels/terminal.ts` — `open()` gains the written-answer path beside the takeover, and the CTA names both. `conclude()`'s unfinished branch gains it too: a conversation abandoned halfway can be finished in writing.

**[MODIFY]** `src/channels/terminal.test.ts`

**Dependencies:** none — this slice is the copy every later one points at.

**Seams under test:** the opened conversation's comment carries both the copy-pasteable command *and* an explicit invitation to answer in the thread; the CTA line names both and prefers neither; the unfinished-conversation comment offers both; `waitingOn` still describes a conversation, since what the ticket waits on has not changed.

**Validation:**

```bash
npx vitest run src/channels
npm run type-check
```

Assertions: every existing terminal-channel test passes unchanged except those asserting the CTA's exact wording; no test asserts that the takeover is the *only* instruction.

### 18b: a wayfinder ticket is a ticket the daemon knows

**[MODIFY]** `src/daemon/pipeline.ts` — the wayfinder class: a marked ticket carrying `wayfinder:<type>` enters at stage 2's at-scale mode, not triage. `research` resolves unattended; `grilling`, `prototype` and `task` park on a conversation.

**[MODIFY]** `src/daemon/poll.ts` — `whatFollows` consults the wayfinder label before the triage classification, so a wayfinder ticket is never triaged as a fresh request.

**[MODIFY]** `src/daemon/prompts.ts` — the stage-2 at-scale prompt: work *this* ticket on its map, per `timone-wayfind`, one ticket per session.

**[MODIFY]** `.claude/skills/timone-wayfind/SKILL.md` — ticket creation applies `MARK_LABEL` beside `wayfinder:<type>`, never to the map; the CTA templates lose the "if the resolution path does not exist" hedge, because after this slice it does.

**[MODIFY]** `src/daemon/pipeline.test.ts`, `src/daemon/poll.test.ts`, `src/daemon/prompts.test.ts`

**Dependencies:** 18a (the park's comment is 18a's).

**Seams under test:** a marked `wayfinder:grilling` ticket produces a run that parks on a conversation without ever being triaged; a marked `wayfinder:research` ticket runs unattended; an unmarked wayfinder ticket produces nothing (R1's negative clause, unchanged); a marked ticket with no wayfinder label still triages exactly as before; `timone takeover <project>#<n>` on the parked wayfinder ticket resolves and spawns — the refusal paths verified at phase 12 are re-asserted untouched.

**Validation:**

```bash
npx vitest run src/daemon src/commands/takeover.test.ts
npm run type-check
node dist/cli.js takeover --help
```

Assertions: the wayfinder run's ledger entry names stage 2 and `waitingKind: "conversation"`; no existing triage test changes behaviour.

### 18c: a written answer moves the ticket

**[MODIFY]** `src/daemon/poll.ts` — a run parked on a conversation whose thread has gained a non-machine comment since the park resumes: the answer is picked up and the session spawned. This is the mechanism gate replies already use, applied to a conversation park.

**[MODIFY]** `src/daemon/prompts.ts` — the conversation prompt carries the written answer, instructs the session to resolve from it without re-asking what was answered, and states the bound: post only what is still open, once; if the next answer still does not settle it, hand back the takeover command and change nothing else.

**[MODIFY]** `src/daemon/poll.test.ts`, `src/daemon/prompts.test.ts`

**Dependencies:** 18b.

**Seams under test:** a conversation park with no new comment stays parked across cycles (it must not re-fire — the same idempotency R1 already demands); one non-machine comment resumes it exactly once; the machine's own follow-up question does **not** resume it; a second unsettled round produces a takeover CTA and no third question; a `CONVERSATION_RECORD_MARKER` comment still closes the conversation as it does today.

**Validation:**

```bash
npx vitest run src/daemon
npm test
npm run type-check
```

Assertions: the full suite is green; the parked-and-quiet case is asserted across two consecutive cycles, not one.

### 18d: the words the human reads

**[MODIFY]** `README.md` — the back-and-forth section says there are two ways to answer, and that wayfinder tickets are watched like any other.

**[MODIFY]** `STATUS.md` — what changed, in plain language, on the default branch per the status-reporting convention.

**Dependencies:** 18a–18c. Docs last.

**Seams under test:** none — no code. Stated rather than omitted.

**Validation:**

```bash
grep -n "answer" README.md | head
npm test
```

Assertions: the skill's CTA template and `TerminalChannel.open`'s comment say the same thing in the same words; any drift found here is a defect in 18a, not a wording preference.

### 18e: the live gate

Not a code slice. Run against `ivtrends`, whose six open grilling tickets are the real thing this phase was written for.

1. Retrofit the CTA onto the six open tickets (one command, using 18b's labelling).
2. Answer one **in writing**, completely. Expect: the daemon picks it up unprompted, the session resolves the ticket, closes it, and the gist lands on the map — with no terminal involved at any point.
3. Answer another **partially**. Expect: exactly one follow-up comment carrying only what is still open. Answer that unsatisfyingly too. Expect: a takeover CTA and no third question.
4. Run `timone takeover ivtrends#<n>` on a third. Expect: it resolves and opens the interview — the command that refused on 2026-08-09.
5. Leave a fourth untouched across two poll cycles. Expect: nothing said twice.

**Step 3 is the discriminating one** and is run deliberately, because a change that simply picked up written answers would pass steps 2 and 4 and still let a thread run forever.

## Definition of done

- [ ] R20's three clauses observed live on `ivtrends`, not only in tests
- [ ] R3 re-verified whole — the two phase-12 clauses as well as the written one
- [ ] The six live `ivtrends` tickets carry their CTAs
- [ ] `npm test` and `npm run type-check` clean; no existing triage or gate behaviour changed
- [ ] `STATUS.md` says, in plain language, that a ticket can now just be answered
