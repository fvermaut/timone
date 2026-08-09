# Phase 18: a ticket you can just answer

> **Status:** **Complete — all four code slices and all five gate steps. See [reports/phase-18-complete.md](reports/phase-18-complete.md) and [reports/phase-18-live-gate.md](reports/phase-18-live-gate.md).** Steps 1, 4 and 5 passed on real `ivtrends` tickets: three frontier tickets carry the real CTA, `timone takeover ivtrends#5` resolves where on 2026-08-09 it refused, and three quiet cycles said nothing twice. **Steps 2 and 3 — the written path, including the discriminating partial-answer case — passed later the same day on `scratch-app`, not on `ivtrends`**, because fvermaut declined to use a live project as a guinea pig and that is his call. What that substitution buys and what it does not is written into the gate report rather than glossed: the mechanism is observed live end to end, and the one thing still unwitnessed is whether a *person* would find the escalation fires at the right moment. Three `ivtrends` tickets were marked rather than nine for reasons the gate report gives. Approval trace, preserved: **Approved for execution by fvermaut 2026-08-09**, three times that day — once on the shape of the fix as written, then over each of the two ✏ Refined amendments that grew the scope (18b's and 18c's), the second taken as put including the four settled questions and the one that overrides a load-bearing decision. The line the last of those replaced: *Approved for execution by fvermaut 2026-08-09* — re-approved the same day over the first ✏ Refined amendment, which grew 18b's scope and reverted the stamp per the same rule. He approved the amendment as put: the two added files, the `picked-up → parked` lifecycle row with no ADR, and the withdrawal of unattended research. The first stamp, preserved: *Approved for execution by fvermaut 2026-08-09*, minutes after the file was written, in the same session — he approved on the shape of the fix rather than on a reading of the slices, and said so. **18a is built, validated and committed** (`273e6bf`) under that first approval. Written 2026-08-09 immediately after the grill that produced [ADR-0022](../../adr/0022-a-conversation-ticket-can-be-answered-in-writing.md), so the decision does not evaporate between the conversation and the plan. Hand-planned, as all Timone-self phases are. Approval was gated on this file per [ADR-0014](../../adr/0014-artifact-first-gates.md).

> **Executed by a different session.** fvermaut approved this and handed the build on; see [doc/handover/2026-08-09-phase-18-answerable-tickets.md](../../handover/2026-08-09-phase-18-answerable-tickets.md) for the state at handover.

> **18e's step 1 is already done and is not the build's to repeat.** The nine open `ivtrends` tickets were given their CTAs by hand on 2026-08-09, in the **written-path-only** form, because takeover does not resolve them until 18b lands. The gate step becomes: *replace* those hand-written blocks with the real per-type templates once 18b exists, and confirm the takeover line then works. See "The live tickets, as they stand" below.

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

Deliberately **not** this phase: the Slack channel behind the same seam; a written-answer path for **gates** (they already have one — a gate reply *is* writing on the ticket, and nothing about that changes); the frozen output-token counter, still R17's remainder and still unexplained.

## Goal Description

A ticket that is waiting on you says so, and you can answer it without leaving the page.

**Load-bearing decisions, fixed here so slices don't re-litigate them:**

- **Wayfinder tickets join the marked set rather than growing a second watched set.** `listMarkedTickets` filters on `MARK_LABEL`; a wayfinder ticket gets that label *at creation, by the skill that creates it*, plus its existing `wayfinder:<type>` label. The pipeline then recognises the wayfinder class from that second label and routes it to stage 2's at-scale mode instead of triage. **The alternative — a parallel listing keyed on `wayfinder:*` — was rejected** because it would duplicate pickup, serialization ([R10](../../specs/prd/prd-02-inversion-of-control.criteria.md), one run per project) and the ledger, and would leave `timone takeover` needing a tracker-resolution path it does not need if a run exists. One watched set, one pickup rule, one ledger.
- **The map ticket is never marked.** It is an index, not work. Marking it would create a run for a ticket nothing can resolve.
- **A run may park straight from `picked-up`** (✏ 2026-08-09, added by execution — the reasoning is under 18b, and it is the one thing that stops this phase working at all). A conversation park attaches no session, so requiring `active` first would mean minting a session id for a session nobody started.
- **The ADR gate was considered for that choice and does not fire.** It is a label and a routing branch — cheap to reverse — and it is the obvious reading of R10 and R14 rather than a surprise. If approval disagrees, that disagreement *is* the trade-off and the decision earns its own ADR before 18b starts.
- **A human comment after the machine's question is the answer, with no keyword.** `isMachineComment` already separates the machine's own comments; ~~the newest~~ **✏ 2026-08-09: every** non-machine comment posted after the park ~~is~~ **joins to make** the answer, as the review park already does — see 18c's note for why the newest-only reading drops a second thought silently. Nothing new for the human to remember, and identical to how a gate reply is read.
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

> **✏ Refined 2026-08-09, by execution, after the slice ran and stopped.** Two corrections, both discovered by building it rather than by reading it. **They grow the file list, so this phase's stamp reverted to `Awaiting approval`.**
>
> **1 — the ledger refuses the park this slice's whole point depends on.** `src/daemon/runs.ts`'s lifecycle table reads `"picked-up": ["active", "failed"]`: a run that has been picked up may become active or fail, and may **not** park. Today nothing notices, because every run reaches a conversation *through triage* — triage is wait-free, so `runStage` activates the run, and it is already `active` by the time `openConversation` parks it. A wayfinder ticket has no such predecessor: this slice exists to make it enter at stage 2 **instead of** triage, so it is still `picked-up` when `AgentSessionSpawner.stop` calls `store.park`, and the ledger throws `Run scratch-app#5 cannot go from picked-up to parked`. `poll` catches it as a spawn error, and the ticket is left picked-up with no stage and no invitation. Verified by probe: adding `parked` to that row made the slice behave exactly as the assertions below describe, with no other change anywhere, and left the suite green but for `runs.test.ts:97`, which asserts that refusal by name.
>
> **The fix is `picked-up → parked`, and it is the honest reading rather than a concession.** `active` means *a session is attached* — `activate` takes a session id. A conversation park attaches no session: what the run is waiting for is a **human**, and the session it needs does not exist yet and may never be spawned by the daemon at all. The transition table's own docblock already anticipates the case ("a branchless run parks, since that releases the session slot while holding nothing"). The alternative — activate before opening the conversation — was considered and rejected: it would mint a session id for a session nobody started, and `timone status` would report a run as running for as long as the human took to answer. `runs.test.ts:97` is re-pointed at a transition that stays illegal rather than deleted; the lifecycle must still refuse something.
>
> **No ADR.** One row of a table, reversible in a line, and the plain meaning of statuses the ledger already defines — the same reasoning that declined the gate for the wayfinder-label routing below. If approval disagrees, that disagreement is the trade-off and it earns its own ADR before 18b resumes.
>
> **2 — "`research` resolves unattended" is withdrawn as unreachable here, and the sentence is corrected below.** Getting there needs `src/daemon/session.ts`, whose `afterStage` ends in a fall-through that treats *any* remaining wait-free stage as triage and reads the classification off the ticket — so a new unattended stage-2 stage would finish its session and fail the run with "triage recorded no classification". That is a third shape for `afterStage` to learn, it is a larger change than this phase's subject, and **[R20](../../specs/prd/prd-02-inversion-of-control.criteria.md) does not ask for it**: its three criteria are the per-type CTA wording, takeover on a wayfinder ticket, and written pickup. None mentions the daemon running a research ticket unattended. So a marked `wayfinder:research` ticket parks saying that machinery is not built — true, and the same thing the daemon says of any unbuilt stage — and the unattended-research path is named here as deferred rather than quietly dropped. `session.ts` stays out of this phase's file list.

**[MODIFY]** `src/daemon/pipeline.ts` — the wayfinder class: a marked ticket carrying `wayfinder:<type>` enters at stage 2's at-scale mode, not triage. `grilling`, `prototype` and `task` park on a conversation; `research` parks as unbuilt machinery (✏ 2026-08-09 — was "resolves unattended"; see the note above).

**[MODIFY]** `src/daemon/runs.ts` — ✏ 2026-08-09. The lifecycle admits `picked-up → parked`, so a run that enters at a conversation stage can wait on the human without first pretending a session is attached to it.

**[MODIFY]** `src/daemon/runs.test.ts` — ✏ 2026-08-09. `refuses transitions the lifecycle does not allow` is re-pointed at a transition that is still illegal.

**[MODIFY]** `src/daemon/poll.ts` — `whatFollows` consults the wayfinder label before the triage classification, so a wayfinder ticket is never triaged as a fresh request.

**[MODIFY]** `src/daemon/prompts.ts` — the stage-2 at-scale prompt: work *this* ticket on its map, per `timone-wayfind`, one ticket per session.

**[MODIFY]** `.claude/skills/timone-wayfind/SKILL.md` — ticket creation applies `MARK_LABEL` beside `wayfinder:<type>`, never to the map; the CTA templates lose the "if the resolution path does not exist" hedge, because after this slice it does.

**[MODIFY]** `src/daemon/pipeline.test.ts`, `src/daemon/poll.test.ts`, `src/daemon/prompts.test.ts`

**Dependencies:** 18a (the park's comment is 18a's).

**Seams under test:** a marked `wayfinder:grilling` ticket produces a run that parks on a conversation without ever being triaged; a marked `wayfinder:research` ticket is not triaged either, and parks saying that machinery is not built (✏ 2026-08-09 — was "runs unattended"); an unmarked wayfinder ticket produces nothing (R1's negative clause, unchanged); a marked ticket with no wayfinder label still triages exactly as before; `timone takeover <project>#<n>` on the parked wayfinder ticket resolves and spawns — the refusal paths verified at phase 12 are re-asserted untouched.

**Validation:**

```bash
npx vitest run src/daemon src/commands/takeover.test.ts
npm run type-check
node dist/cli.js takeover --help
```

Assertions: the wayfinder run's ledger entry names stage 2 and `waitingKind: "conversation"`; no existing triage test changes behaviour.

### 18c: a written answer moves the ticket

> **✏ Refined 2026-08-09, by execution, after the slice proved the wall end-to-end.** **This grows the file list, so the phase's stamp reverted to `Awaiting approval` a second time.** It is a larger amendment than 18b's, and it is the one place this phase turns out to cost more than the plan thought.
>
> **The daemon cannot spawn a session for a stage that waits on a conversation, and this slice's whole subject is doing exactly that.** `session.ts:447` short-circuits unconditionally — `if (!runsUnattended(stage)) { await this.openConversation(...); return; }` — and `runsUnattended` is false for both `clarification` and `wayfinding`. So a run resumed with a written answer in hand does not ingest it: it **re-posts the entire invitation and re-parks**. Proven by pointing the real `AgentSessionSpawner` at the real ledger over a fake tracker, with a human comment sitting after the park cursor: no session starts, and the ticket receives the whole "Two ways to answer this" block again — the precise failure ADR-0022's written path exists to prevent, and a breach of this slice's own must-not-re-fire seam. The graph blocks it a second way: `UnspawnedStage` **forbids** a conversation-waiting stage from declaring a model, and `runStage` fails the run loudly without one.
>
> **The file list therefore gains four production files and their tests:**
>
> - `src/daemon/pipeline.ts` — `UnspawnedStage`'s `{ built: true; waits: "conversation" }` arm goes, and `SpawnedStage.waits` drops its `Exclude<WaitKind, "conversation">`. `clarification` and `wayfinding` declare a model. `runsUnattended` keeps its present meaning — it still answers "does the daemon start this stage *of its own accord*", which stays false — and the new path is a branch in the spawner on the answer's presence, not a redefinition of that function.
> - `src/daemon/session.ts` — three changes, not one. **(1)** `:447` becomes conditional: a spawn carrying a written answer falls through to `runStage`. **(2)** `afterStage` gains a conversation branch, or it falls into the triage-classification read and fails the run with "triage recorded no classification" — the identical trap 18b hit with `research`. Three endings to judge: settled → conclude; not settled → **re-park on a conversation with a fresh cursor**; handed back → the takeover. **(3)** that fresh cursor is what makes the resume once-only, and it must be written by whoever ran the session — `poll.ts` cannot write it for a session it did not run without owning the same fact twice.
> - `src/adapters/ticketing.ts` — one constant, `CLARIFICATION_MARKER`, beside its three siblings. The phase's own decision counts the clarifying round *on the ticket* by "machine comments carrying the clarification marker", and no such marker exists; the ledger alternative is closed off by that same decision.
> - `src/daemon/gates.ts` — a reader for it, beside `readConversationRecord`, which is where every other read-the-thread-for-an-answer function already lives.
> - Tests: `src/daemon/pipeline.test.ts`, `src/daemon/session.test.ts`, `src/daemon/gates.test.ts`, `src/adapters/github-tickets.test.ts` as each is touched.
>
> **Four questions the amendment settles, so the slice does not.**
>
> 1. **`clarification` and `wayfinding` run on `claude-opus-5` at `high`.** They cannot be spawned without a declaration, and this session judges whether a written answer settles a decision, resolves or re-asks on that judgement, and may write an ADR — the same class of work as requirements and planning, which carry the same pair. It is read only when the **daemon** spawns the ingest session; a human's `timone takeover` runs in their own CLI and is untouched by it.
> 2. **The clarification marker is a comment marker in `ticketing.ts`, read in `gates.ts`.** Its siblings are all there, and the thread is where the phase decided this fact lives.
> 3. **What ends a wayfinding run:** both conversation prompts instruct `CONVERSATION_RECORD_MARKER` on the resolution comment, and a `finish` transition **completes the run** rather than leaving it parked. This closes the question 18b deliberately deferred rather than inherit by accident. Without it a resolved wayfinder ticket's run parks forever: `stageAfter("wayfinding")` is undefined, so `concludeConversation` returns `finish`, and `resolveWait` returns `undefined`.
> 4. **All non-machine comments after the cursor are the answer, joined — ✏ this overrides the "newest comment" wording in this phase's load-bearing decisions.** The review park already joins them that way, and the failure the plan's literal reading produces is real and silent: a human who answers and then adds a second thought has the first one dropped without being told. Nothing is gained by preferring the newest, and a written answer is supposed to be read generously.
>
> **Still no ADR.** ADR-0022 already decided that the daemon picks a written answer up and spawns the session that ingests it; this is that decision's mechanism, and every choice above is a line or a constant. What grew is the plan's estimate of the work, not the decision behind it.

**[MODIFY]** `src/daemon/poll.ts` — a run parked on a conversation whose thread has gained a non-machine comment since the park resumes: the answer is picked up and the session spawned. This is the mechanism gate replies already use, applied to a conversation park.

**[MODIFY]** `src/daemon/pipeline.ts`, `src/daemon/session.ts`, `src/adapters/ticketing.ts`, `src/daemon/gates.ts` — ✏ 2026-08-09. What it takes for the daemon to spawn a conversation stage at all, per the note above.

**[MODIFY]** `src/daemon/prompts.ts` — the conversation prompt carries the written answer, instructs the session to resolve from it without re-asking what was answered, and states the bound: post only what is still open, once; if the next answer still does not settle it, hand back the takeover command and change nothing else.

**[MODIFY]** `src/daemon/poll.test.ts`, `src/daemon/prompts.test.ts`, and — ✏ 2026-08-09 — `src/daemon/pipeline.test.ts`, `src/daemon/session.test.ts`, `src/daemon/gates.test.ts`, `src/adapters/github-tickets.test.ts` as each is touched.

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

## The live tickets, as they stand

Done by hand on 2026-08-09, before the build, because leaving nine unanswerable tickets open across a session boundary was the whole complaint. **Read this before 18e; it changes what the gate has to do.**

`ivtrends` holds **eight `wayfinder:grilling` tickets, one `wayfinder:prototype`, one `wayfinder:map`** — not the six first reported here, which was a miscount corrected the same day. All nine non-map tickets now carry a CTA. **None is the real template**: takeover does not resolve them until 18b lands, so every block is written in the **written-path-only** form and says in as many words that the terminal option is not available yet.

The blocks are not uniform, because the tickets aren't:

| Tickets | State | What their CTA says |
|---|---|---|
| #5, #6, #9 | **frontier** — every blocker closed | Answer here; this one is ready. Names the one-clarifying-round bound. |
| #7, #8, #10, #12, #13 | blocked by an open ticket | Nothing needed yet, names its blockers **by title**, points at the three ready ones. |
| #11 | blocked, and a prototype | Nothing needed; explains it is something to look at, not to answer, and that a link arrives when there is something behind it. |

**A stale fact was corrected while doing it.** #5, #6 and #9 each still carried a `**Blocked by** the AlphaVantage capability research` line naming #2/#3/#4 — all three closed. Left alone, those lines would have sat directly above a CTA saying "nothing is blocking it". They are struck through with the resolution and what it constrains, not deleted.

**What 18e must therefore do:** *replace* these hand-written blocks with the per-type templates from `timone-wayfind` once 18b makes the takeover line true, and confirm it resolves. Not append — replace, or a ticket ends with two CTAs disagreeing about whether the terminal option exists.

**Noticed, not acted on** (recorded here so it is not lost, and not fixed because nobody asked): the ticket bodies refer to each other by bare number — `#8`, `#5`, `#2` — which `timone-wayfind`'s "refer by name" rule forbids in everything the human reads. It is pre-existing, it is not this phase's subject, and it is a one-pass fix whenever someone wants it.

### 18e: the live gate

Not a code slice. Run against `ivtrends`, whose open decision tickets are the real thing this phase was written for.

1. **Replace** the hand-written CTA blocks (above) with the real per-type templates, now that the takeover line is true.
2. Answer one **in writing**, completely. Expect: the daemon picks it up unprompted, the session resolves the ticket, closes it, and the gist lands on the map — with no terminal involved at any point.
3. Answer another **partially**. Expect: exactly one follow-up comment carrying only what is still open. Answer that unsatisfyingly too. Expect: a takeover CTA and no third question.
4. Run `timone takeover ivtrends#<n>` on a third. Expect: it resolves and opens the interview — the command that refused on 2026-08-09.
5. Leave a fourth untouched across two poll cycles. Expect: nothing said twice.

**Step 3 is the discriminating one** and is run deliberately, because a change that simply picked up written answers would pass steps 2 and 4 and still let a thread run forever.

## Definition of done

- [x] R20's three clauses observed live, not only in tests — ✏ clauses 1 and 2 on `ivtrends`, clause 3 (written pickup) on `scratch-app`, per the substitution the gate report explains
- [ ] R3 re-verified whole — the two phase-12 clauses as well as the written one. **Stage 7's to do, not the gate's**: the gate observed the behaviour, and a pass that did not watch the build must still check it against the register and flip the status
- [x] The live `ivtrends` tickets **that are ready to answer** carry the real per-type CTAs, the hand-written blocks replaced rather than joined — ✏ **amended 2026-08-09 on fvermaut's decision**, from "the nine" to the ready ones. The gate found that marking a *blocked* ticket makes the machine invite an answer its own body says is not wanted yet (finding 2). His reading, and the evidence agrees with it: a blocked ticket gets refreshed when its blocker resolves, so no hand-work is owed. Watched happening the same day — the session that resolved #5 struck through #7's `Blocked by` line, wrote what #5 settled, **replaced its "nothing needed yet" block with the real both-paths template**, and marked it; the daemon parked it a minute later with a working `timone takeover ivtrends#7`. **The gap that leaves is recorded below rather than closed here**
- [x] `npm test` and `npm run type-check` clean; no existing triage or gate behaviour changed
- [x] `STATUS.md` says, in plain language, that a ticket can now just be answered
