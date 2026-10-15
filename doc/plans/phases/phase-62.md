# Phase 62: A comment on a map ticket gets an answer — a named person who writes on a map ticket gets one reply, saying the ticket is not read and linking its open step tickets

> **Status:** Planned.

> **Companion phases:** [phase 40](phase-40.md) and [phase 41](phase-41.md) built the runner (ADR-0060): `src/runner/driver.ts` with its `seen` marks and `newComments`, `src/runner/comments.ts` with the notices code writes, and the map run that ends once its step tickets open (`closeChunkZero` in `src/runner/actions.ts`). This phase reads the same record and the same marks, and adds one notice beside the others. [Phase 29](phase-29.md) built step tickets and the map ticket (ADR-0040): the `timone:map` label, `listSteps`, and the poll's survey of initiatives (`surveyInitiatives` in `src/daemon/poll.ts`), which this phase widens to hand each map's steps on. Governing decisions: [ADR-0060](../../adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md), because R9 and R10 come from it, and because it is where a notice a person must always get is written by code and not by the runner; [ADR-0040](../../adr/0040-one-step-is-one-ticket-and-doneness-is-a-fact-about-a-ticket.md), because the map ticket is "a list of links to its step tickets and nothing else" and its work lives on those tickets — the reply points there and opens no run on the map; [ADR-0024](../../adr/0024-every-open-ticket-answers-for-itself.md), because it sets the house rule this reply follows: the record decides that something is said once, and it is written before the comment is posted.

> **Screens changed:** none — the change is in the daemon's poll and the runner's driver, and in one comment the machine posts on a ticket; no slice changes anything a person sees on a screen.

## Requirements

> **PRD:** [prd-05-a-runner-decides-each-step.md](../../specs/prd/prd-05-a-runner-decides-each-step.md) — criteria in [prd-05-a-runner-decides-each-step.criteria.md](../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-05.R9 | MUST | In a run of any kind and any state, when a named person comments on its ticket, the machine acts or answers on the ticket (clause 1). |
| PRD-05.R10 | MUST | A comment by someone not named for the project, or by Timone itself, is never treated as an instruction (clauses 1 and 3). |

Bug: [timone#254](https://github.com/fvermaut/timone/issues/254) — on ivtrends#217, on 2026-10-15, fvermaut wrote a question on a map ticket at 16:39Z and nothing answered it. It was classified as a bug on the ticket itself; no triage record was committed for it (a finding, not a stop: the classification and its reason are on #254's thread, and they are enough to anchor this plan on R9).

## Goal Description

**What is wrong.** A map ticket is read by nobody once its step tickets open. The poll skips every ticket with the `timone:map` label (`src/daemon/poll.ts`, the `MAP_LABEL` line in `pollProject`), so no run is ever opened on it. The map's own run is ended by `closeChunkZero` (`src/runner/actions.ts`, `deps.store.complete(run.id)`) once the step tickets are open. The runner's driver looks only at runs that are not finished (`RunnerDriver.tick`, the `UNSETTLED` check). So a named person who writes on the map afterwards gets no reply at all. PRD-05.R9 clause 1 says a run in any state gets an answer. The map's run is a run in a finished state, so this is a bug against an active requirement, not new scope.

**What this phase builds.** When a named person writes on an open map ticket that no live run is reading, the machine posts **one** reply. The reply says this ticket is not read any more, that its comment will not be acted on, and where to write instead: each open step ticket, linked by number with its title, or a new ticket for a new request. Several comments written between two cycles get one reply between them. The machine's own comments, and comments by someone not named for the project, never get a reply (R10), so the reply can never answer itself. Each reply is decided from the ticket's run record, with the same `seen` mark the runner already keeps for the `ticket` thread, and the mark is written **before** the reply is posted: a post that fails leaves one comment unanswered and one error line, never a second reply on the next cycle (ADR-0024's reasoning). Because the mark is the one the runner kept while the map's run was live, the reply takes over exactly where the runner stopped reading: nothing the runner already read is answered twice, and nothing written after it is missed. A map whose record has no `seen` mark for the ticket thread counts from the machine's newest comment on the thread (on a map ticket that is the notice that the list of pieces was approved).

**Decisions taken here that did not reach an ADR.** (1) **The reply is written by code, with fixed words, and wakes no runner session.** A runner session on a finished map run could start steps on the map — the very thing the poll's skip exists to prevent — and costs money for a reply whose words never change. It follows the pattern ADR-0060 already set in `src/runner/comments.ts`: what a person must always be told is fixed in code. It is one function and one call, easy to replace by a runner wake later, so it fails the "hard to reverse" part of the test. (2) **Treating the comment as a new request is left for a later ticket.** Telling a question about one piece from a new request needs a judgement, and opening a ticket on a person's behalf is an action the runner does not have today (R2); both would need a decision of their own. The reply tells the person to open a new ticket instead, which is what was done by hand for ivtrends#217. (3) **The reply asks nothing to be answered on the map ticket, so it does not name the takeover command** (PRD-09 R1 applies to a question). A takeover on a map ticket has nothing to take over.

**Does a requirement or ADR line change?** No requirement changes. R9 clause 1 says "the runner wakes and either acts or answers on the ticket"; here code answers without a runner session. What the person is owed — an answer on the ticket — is what they get, and decision (1) above records why code gives it. Verification should note this reading in R9's evidence. No ADR line changes: ADR-0040's map is still links and nothing else, and no run is opened on it. The glossary's **Map ticket** entry in `CONTEXT.md` says "No run is ever opened on it"; sub-phase 62b adds, as a marked amendment, what now happens to a comment written there.

**No change to the runner's rules.** Nothing in `src/runner/brief.ts` changes, so PRD-05.R18 clause 2 (the replay run for a change to the runner's rules) does not apply.

**Regression set and what no criterion watches.** The diff touches `src/runner/driver.ts`, `src/runner/comments.ts` and `src/daemon/poll.ts`; verification derives the set from the register (MUST, `api`, `verified`, narrowed by `Depends-on`). **PRD-05.R10 is in it and matters most here**: the new code reads comments, and must drop every comment by someone not named and every comment the machine wrote. **PRD-05.R9 is `live` and `draft`**, and has no `Depends-on` line. The driver tests in 62a show the reply; a live sighting is a named person writing on a scratch-app map ticket and seeing one reply within a cycle. Per [ADR-0059](../../adr/0059-a-live-check-only-the-operator-can-run-rides-to-the-pull-request.md) it rides to the pull request if only fvermaut can run it. **What no criterion watches:** that a reply is posted once and only once per new comment. No register clause says so; the driver tests (2), (3) and (8) of 62a are the whole protection, so they are a hard gate in 62a's validation, not a courtesy.

**Expected once the fix is live.** ivtrends#217's comment of 16:39Z is after the runner's last `seen` mark on that ticket, so the first cycle after the fix gets one reply on #217, pointing at its open step tickets. The question was already moved by hand, so the reply is late but correct; nothing else is done with it.

## Context & Prerequisites

- **`src/runner/driver.ts`** — `RunnerCycle` (line ~96: `tickets`, `isStep`, `threads`); `RunnerDriver.tick` (line ~474) loops over the project's runs and skips any run whose status is not in `UNSETTLED` (`picked-up`, `active`, `parked`); `look` reads the record with `readRecord(this.deps.root, project.name, run.ticket)`; `newComments` (line ~801) is the model to follow: it reads `seenUntil(entries, "ticket")`, filters to comments after it, appends one `seen` entry (`appendEntry(..., { kind: "seen", at, thread: "ticket", until: newest.createdAt })`), and keeps only comments with `!comment.fromTimone && isNamedPerson(people, comment.author)`, with `people = namedPeople(this.deps.manifest, project.name)`. `seenUntil` and `noticed` are private helpers in the same file — reuse them, do not copy them.
- **`src/runner/comments.ts`** — the notices code writes: `departureNotice`, `limitNotice`, `piecesApprovedNotice`, `piecesFailedNotice`, `joined`. Every notice ends with a line that starts with `NEEDED_FROM_YOU` (from `src/adapters/ticketing.ts`). `postComment` adds the machine's header line itself (`MACHINE_MARKER`); a notice never writes it.
- **`src/daemon/poll.ts`** — `pollProject` (line ~1121): lists the marked tickets, calls `surveyInitiatives`, loops the tickets (`if (ticket.labels.includes(MAP_LABEL)) continue;` — this line stays), then builds `const cycle = { tickets, isStep: frontier.isStep, blockedBy: frontier.blockedBy, threads }` and calls `runner.tick(project, config, cycle)` and then the planner's tick with the same cycle. `surveyInitiatives` (line ~1031) already reads each map's steps once per cycle with `adapter.listSteps(project, map.number)`; a map whose listing failed sets `complete = false` and is skipped. `Frontier` is the interface at line ~1001.
- **`src/adapters/ticketing.ts`** — `Step` (`number`, `title`, `state: "open" | "closed"`, …), `TicketThread.comments` (`author`, `body`, `createdAt`, `fromTimone`), `postComment`.
- **`src/daemon/runs.ts`** — `store.liveRunForTicket(project, ticket)` returns the ticket's run that is not settled, or undefined. A map ticket with a live run is the runner's to read (its comments go through `look`), so the new code leaves it alone.
- **Tests.** `src/runner/driver.test.ts` builds `RunnerCycle` objects in three places (around lines 551, 1130 and 1346) with fake threads; extend its fakes, do not build a second harness. `src/daemon/poll.test.ts` has the `"the frontier decides which step is taken"` block (line ~2251) with `initiative(...)` and `trackerFor(...)` helpers for a map with step tickets, and `runnerFor(...)` (line ~3110) which gives a driver a temp `root`. `src/planner/driver.test.ts` and `src/planner/facts.test.ts` also build cycles; whether they need the new field depends on the planner's own cycle type, and `tsc` will say.

## Sub-phases

### Sub-phase 62a: A named person's comment on a map ticket gets one reply that links the open step tickets

**[MODIFY]** `src/runner/comments.ts` — add `export function mapTicketReply(openSteps: readonly { number: number; title: string }[]): string`. With open steps:

```
**This ticket is not read any more.** Its work was split into smaller tickets, and each of them is read on its own:

- #51 — <title>
- #52 — <title>

Nothing will be done with a comment written here. If it is about one of those pieces, write it again on that ticket. If it is a new request, open a new ticket.

**What I need from you:** nothing on this ticket. To get an answer, write on one of the tickets above, or open a new ticket.
```

With no open step: the first paragraph says "**This ticket is not read any more.** Every piece of its work is finished or was dropped." and the advice is only "If it is a new request, open a new ticket." The last line uses `NEEDED_FROM_YOU`. No takeover sentence (Goal Description, decision 3). Plain words only.

**[MODIFY]** `src/runner/driver.ts` —
- `RunnerCycle` gains `maps: readonly { number: number; steps: readonly Step[] }[]` — the map tickets of this cycle whose steps were read, each with its steps. Required, not optional, so `tsc` finds every place a cycle is built.
- `tick` — after the loop over runs, for each `map` of `cycle.maps` whose ticket has no live run (`this.deps.store.liveRunForTicket(project.name, map.number) === undefined`), call a new private `answerMap(project, map, cycle)`, inside its own `try`, pushing `${project.name}: could not answer on map #${map.number}: ${oneLine(error)}` to `errors` on failure. One map's failure does not stop the others.
- `answerMap` — read the record (`readRecord`; when it cannot be read, throw, as `look` does: answering without the marks could reply twice). Read the thread with `cycle.threads(map.number).ticket()`. `since` is `seenUntil(entries, "ticket")`; when there is none, the `createdAt` of the newest comment with `fromTimone`; when there is none of those either, nothing is answered and only the mark is written. Take the comments after `since`. If there are none, return. Append one `seen` entry for the `ticket` thread up to the newest of them — **before** posting. Then, if at least one of them is by a named person and not `fromTimone`, post `mapTicketReply(open steps)` once with `this.deps.adapter.postComment(project, map.number, …)`. Open steps are `map.steps` with `state === "open"`, in the order the listing gave them. The runner is not woken, and nothing else is written to the record.

**[MODIFY]** `src/daemon/poll.ts` — `Frontier` gains `maps: { number: number; steps: readonly Step[] }[]`, filled in `surveyInitiatives` with every map whose `listSteps` succeeded (not the ones whose listing failed). `pollProject` passes `maps: frontier.maps` in the cycle it hands to `runner.tick` and to the planner. The `MAP_LABEL` skip in the pickup loop is unchanged: still no run on a map.

**[MODIFY]** the test files that build a `RunnerCycle` (`src/runner/driver.test.ts`, and any other that `tsc` names) — add `maps: []` where a test has no map.

**[NEW FILE]** `src/runner/comments.test.ts` — the text cases below.

**[MODIFY]** `src/runner/driver.test.ts`, `src/daemon/poll.test.ts` — the cases below.

**Seams under test (TDD):** three public boundaries. `mapTicketReply` is pure, so its words are tested directly. `RunnerDriver.tick` is the seam for the behaviour: it is where comments are read and marked today, and the record and the fake adapter's posted comments are observable from outside it. `pollOnce` is the seam for the wiring only — that the survey's maps reach the driver — so it gets one case, not a copy of the driver's.

Red-green, `mapTicketReply` (`src/runner/comments.test.ts`): (t1) with steps #51 "1. Piece one" and #52 "2. Piece two", the text contains `#51 — 1. Piece one` and `#52 — 2. Piece two` on their own lines, says the ticket is not read, and its last line starts with `NEEDED_FROM_YOU`; (t2) with no steps, it names no `#` number and says to open a new ticket; (t3) neither text contains `timone takeover`.

Red-green, `RunnerDriver.tick` (`src/runner/driver.test.ts`, in one `describe("a comment on a map ticket", …)` block, so the validation filter below finds them), each with a map #7 whose run is `done`, steps #51 open, #52 closed, #53 open, and a record holding a `seen` mark for `ticket` at T0:
1. A named person's comment at T1 > T0 → exactly one `postComment` on #7, whose body lists #51 and #53 and not #52; no wake is asked for; the record's newest `seen` mark for `ticket` is T1.
2. The same tick run a second time with the same thread → no new `postComment`. **(hard gate)**
3. Two named comments at T1 and T2 → one `postComment` in total. **(hard gate)**
4. Only a comment with `fromTimone: true` after T0 → no `postComment`; the mark still moves to its time. And only a comment by a login not named for the project → no `postComment`; the mark still moves (R10).
5. The map ticket has a live run (status `parked`) → the map path posts nothing on #7 (the run's own `look` handles the ticket as it does today; assert that the reply text is never posted).
6. No `seen` mark in the record, a machine comment at T1, a named comment at T0 < T1 and another at T2 > T1 → one reply, and the mark is T2. With only the T0 comment → no reply.
7. Every step closed → one reply, the no-step text.
8. `postComment` throws → `tick` returns one error line naming map #7, the `seen` mark is already written, and the next tick with a working adapter posts nothing. **(hard gate)**
9. A record that cannot be read → an error line, and no `postComment`.

Red-green, `pollOnce` (`src/daemon/poll.test.ts`, in the `"the frontier decides which step is taken"` block, using `initiative(...)`, `trackerFor(...)` and `runnerFor(...)`): (p1) a map ticket #7 with a named person's comment after the machine's last comment, its steps listed → one comment posted on #7 that names the open step tickets, and still no run registered for #7; (p2) the same, but `listSteps` throws → nothing posted on #7 this cycle.

> No dependency on other sub-phases.

Write each case red first, on the code as it is, and keep the red runs for the handoff. Cases 1 and p1 fail today because nothing reads the map ticket at all.

#### Agent Validation Steps

```bash
npx vitest run src/runner/comments.test.ts src/runner/driver.test.ts src/daemon/poll.test.ts
npx vitest run -t "a comment on a map ticket" src/runner/driver.test.ts; echo "exit: $?"   # expect 0, with 9 tests run: cases 2, 3 and 8 are among them and must pass
npx tsc --noEmit; echo "exit: $?"   # expect 0: every place a RunnerCycle is built carries maps
npm test; echo "exit: $?"   # expect 0: the whole suite
grep -n "if (ticket.labels.includes(MAP_LABEL)) continue;" src/daemon/poll.ts; echo "exit: $?"   # expect 0: the poll still opens no run on a map
```

- [ ] Every case above was red before the change and is green after; the handoff shows both runs.
- [ ] Cases 2, 3 and 8 pass. They are the only thing that shows the reply is posted once; a phase where any of them is skipped or weakened does not close.
- [ ] The `seen` entry is appended before `postComment` is called (case 8 shows it).
- [ ] No runner session is started for a map ticket: in cases 1–9 the fake sessions record no wake for #7.
- [ ] `src/runner/brief.ts` is unchanged (`git diff --quiet main -- src/runner/brief.ts; echo "exit: $?"` gives 0), so no replay run is owed.

---

### Sub-phase 62b: The glossary says what happens to a comment written on a map ticket

**[MODIFY]** `CONTEXT.md` — under **Map ticket**, add a marked line: `✏ 2026-10-15 ([timone#254](https://github.com/fvermaut/timone/issues/254)): a named person who writes on it gets one reply from the machine. The reply says the ticket is not read any more, and links its open step tickets as the place to write. Nothing else is done with the comment.` Keep the existing words as they are.

**Seams under test (TDD):** no behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based.

> Sub-phase 62a must be complete before starting this sub-phase (the glossary describes what 62a built).

#### Agent Validation Steps

```bash
grep -n "timone#254" CONTEXT.md; echo "exit: $?"   # expect 0
git diff --stat main -- CONTEXT.md   # one file, a few added lines, nothing removed
```

- [ ] The **Map ticket** entry still says no run is ever opened on it, and now also says what a comment there gets.
- [ ] Plain words; no stage names or process words.

## Dependency graph

```
62a → (none)   the reply: the text, the driver reading the map's comments, and the poll handing it the maps
62b → 62a      the glossary entry for a map ticket says what a comment there gets
```
