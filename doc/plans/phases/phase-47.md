# Phase 47: The project is free when the pull request opens — places in the ledger, one ticket told when a place frees, an open pull request never picked up again, a takeover that takes no place, and the old rule struck where it is written

> **Status:** Planned.

> **Companion phases:** [phase 44](phase-44.md) — piece 1 of the same list, merged; it gave this phase and ADR-0063 their numbers through `number`. [phase 45](phase-45.md) — piece 6, merged; it last changed `openStepTickets` and the `Needs:` relations that keep step tickets of one initiative waiting for each other, which this phase relies on and does not change. [phase 40](phase-40.md) — built the runner, its driver and the 40u wake "The project is free now", which 47c replaces. [phase 41](phase-41.md) — last changed `src/commands/takeover.ts` and wrote PRD-05.R11's clause 2 refusal, which 47e removes. Piece 2 of the list ([#200](https://github.com/fvermaut/timone/issues/200), `STATUS.md` and the registers) has no phase file yet; this piece's ticket declares it needs piece 2, and the two share no source file, so this one can be built first — see the Goal Description. Governing decisions: [ADR-0063](../../adr/0063-a-ticket-takes-a-place-only-while-one-of-its-steps-runs.md) — recorded while planning this phase; D1–D3 are 47a to 47c, D4 is 47d, D5 is 47e, D6 is 47g. [ADR-0026](../../adr/0026-a-ticket-is-a-conversation-a-run-is-a-chunk.md) — its rule "the chunk holds the project" is the one replaced; the rest stands. [ADR-0041](../../adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md) — each run has its own clone, which is why two work branches of one project no longer collide. [ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) — the hold label and the `blocked by` relation still decide which step ticket may be picked up; nothing here changes the frontier. [ADR-0049](../../adr/0049-a-runs-proof-of-life-is-its-holder-and-its-wait-is-one-value.md) — a run's holder and its wait; a takeover's holder is what 47e marks. [ADR-0060](../../adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md) — the runner decides each step and is told facts by code; the place it holds is one more fact. [ADR-0051](../../adr/0051-timone-verifies-itself-by-live-gate-and-a-regression-set-is-narrowed-by-what-it-depends-on.md) D4 and [ADR-0059](../../adr/0059-a-live-check-only-the-operator-can-run-rides-to-the-pull-request.md) — decide which checks this phase owes, below. [ADR-0050](../../adr/0050-timone-becomes-a-managed-project-once-the-run-path-is-fixed.md) D5 — this project is Timone, so `process.md` and the skills are its source and are committed here.

> **Screens changed:** none — no slice changes anything a person sees on a screen Timone draws. (`timone status` is terminal text; ticket comments are GitHub text.)

## Requirements

> **PRD:** [prd-07-several-tickets-of-one-project-at-once.md](../../specs/prd/prd-07-several-tickets-of-one-project-at-once.md) — criteria in [prd-07-several-tickets-of-one-project-at-once.criteria.md](../../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-07.R1 | MUST | A ticket with an open pull request, or waiting for a person on its own work branch, never causes another ticket's step to be refused; its run still wakes on merge, close and review |
| PRD-07.R2 | MUST | **Except the number of places** (clauses 1 and 2, which stay with piece 5): with every place taken a further step waits for its turn; with a place free it starts; a ticket waiting for a person, a merge or its turn, or with only an open pull request, takes no place; a runner session and a takeover take none |
| PRD-07.R3 | MUST | A freed place goes to one ticket, `priority:high` first, then the oldest; only that ticket is told, its step is not refused for want of a place, and a place it does not use goes to the next ([#184](https://github.com/fvermaut/timone/issues/184)) |
| PRD-07.R9 | MUST | A marked ticket whose pull request from an earlier run is open is not picked up as new work, and the run that owns that pull request wakes on it with facts naming the pull request and its branch ([#181](https://github.com/fvermaut/timone/issues/181)) |
| PRD-07.R12 | MUST | **For what this piece changes:** PRD-02.R10, PRD-02.R22 clause 6, PRD-05.R11 clause 2, PRD-03's out-of-scope line, ADR-0026 and `process.md` stage 6 each say the old rule is replaced. PRD-02.R22 clause 1 and PRD-05.R15 clause 2 stay with piece 5 |
| PRD-07.R13 | MUST | A takeover is not refused because another ticket of the project has a step running, a work branch or an open pull request; it is still refused on a ticket whose own step the machine is working on |

This is piece 3 of the [list of pieces for #197](../breakdowns/ticket-197.md), approved by fvermaut on 2026-10-04T06:34:53Z with six pieces.

## Goal Description

Today a run holds its project from the moment it owns a work branch until its pull request merges (`holdsProject` in `src/daemon/runs.ts`), so one pull request waiting for review stops every other ticket of the project. Waiting for the project happens in two ways that do not know about each other: a ticket picked up while the project is held is written `queued` and promoted by the ledger, and a run whose step was refused is woken by the runner's driver with "The project is free now" — every such run at once. Three runs of this project were woken that way at 15:47 on 4 October and all three were refused (#184). Separately, a ticket whose run left the ledger while its pull request stayed open is picked up as new work and knows nothing of that pull request (#181).

[ADR-0063](../../adr/0063-a-ticket-takes-a-place-only-while-one-of-its-steps-runs.md), recorded while planning this phase, decides how. A **place** (the word PRD-07's register defines) is taken only by a running step, or by a place the ledger has given to one waiting run and that run has not yet used. A run refused a step for want of a place is written down as waiting, with its ticket's `priority:high` label and creation time. Whenever a place frees, the ledger gives it to one waiting run in the same write, and only that run is woken. A run whose step just ended is among the waiting until its runner has decided, so it keeps the place when it comes first. The pickup asks the forge for an open pull request of the ticket before opening a new run, and takes it over when there is one. A takeover is marked in the ledger and takes no place. Every project keeps **one** place until piece 5 adds the number in `timone.yaml`, so one ticket still builds at a time.

These items are one piece because each needs the others to be safe: freeing the project at the pull request without the single-ticket wake makes #184 worse, and without the pickup check more tickets reach the #181 state. The old rule is struck in the same pull request (R12), or it comes back.

**Piece 2 (#200) is not built yet, and this phase does not need it.** The list says this piece needs pieces 1 and 2. Piece 1 is merged. Piece 2 changes how `STATUS.md` and the requirement registers are brought level after a merge; this phase changes neither that code nor those files' handling. What piece 2 protects against — two open pull requests of one project that both changed `STATUS.md` or one register — becomes possible once this phase merges. So **this phase's pull request should merge after #200's**, or the person merging the second of the two resolves those files by hand. The building does not wait for it.

**Decisions taken at planning, below the ADR bar.** Each was checked against the three-part test; none is hard to reverse, since each is local to one file and covered by tests at a public seam.

- **The ledger keeps the place on the run.** `Run` gains `place?: { priority: boolean; openedAt: string; waitingSince?: string; givenAt?: string }` and `takenOver?: true`. Both are optional, so every older ledger loads unchanged. `place.priority` and `place.openedAt` are written when the run asks for a place; `waitingSince` means it waits; `givenAt` means the place is given to it.
- **`queued` leaves `RunStatus`.** An older ledger's `queued` run is read as `picked-up` by a new normalisation in the load path, beside `normaliseSequences`; the zod enum stops accepting `queued` after normalisation. Every `case "queued"` in `takeover.ts`, `cancel.ts`, `status.ts`, and the queued comment in `poll.ts`, goes with it.
- **One constant, `PLACES_PER_PROJECT = 1`, exported from `src/daemon/runs.ts`.** Piece 5 replaces it with the manifest's number; nothing else reads a count.
- **The words the runner is woken with:** `PLACE_GIVEN_EVENT = "A place on the project is free for this ticket now. A step you start will not be refused for want of one."` It replaces `PROJECT_FREE_EVENT` in `src/runner/driver.ts`.
- **The refusal words**, from the action, so the runner reads why it waits: `No place is free on <project>: <who holds it>. This ticket now waits for its turn, and you are woken when a place is given to it.` `<who holds it>` names the run id (`run timone#203/1 has a step running`, or `the place is given to run timone#203/1`). The run id stays in the sentence because `timone record` and a person reading the record find the other run by it.
- **The runner is told the place as a fact** in its brief (one line in *Facts about the work*: free, given to this ticket, or taken by which ticket's step), and one rule is added to its instructions: a step needs the project's place; do not post that work has started until a step has started. This is what stops the "started", then "correction" pair that #184 and the comments on #200, #201 and #202 show.
- **"Oldest" is the ticket's `createdAt` on the forge**, as R3's hint says, with the ticket number as the tie-break.
- **The pickup's question to the forge is one new adapter method**, `findOpenPullRequestOfTicket(project, ticket)`: `gh pr list --state open --json number,title,url,state,headRefOid,headRefName`, filtered to a head branch that is `timone/<n>` or starts with `timone/<n>-`. It is asked only when `register` would open a new run, never for a ticket with a live run, so it costs one call per pickup, not one per cycle.
- **An adopted run is opened parked**, at stage `delivery`, with branch and pull request set and the wait `{ on: "pull request #<pr>, opened before this run", kind: "runner", resolvableBy: ["delivery"] }`. No pickup comment is posted: the ticket's thread already has the pull request.
- **No migration of live runs.** A run parked on a branch in today's ledger simply stops holding the project when this code is loaded.

**What this phase owes before delivery** (ADR-0051 D4). The diff touches `src/daemon/runs.ts`, `src/daemon/poll.ts`, `src/daemon/step-session.ts`, `src/runner/actions.ts`, `src/runner/driver.ts`, `src/runner/session.ts`, `src/runner/brief.ts`, `src/commands/takeover.ts`, `src/commands/cancel.ts`, `src/commands/status.ts`, `src/commands/daemon.ts`, `src/adapters/ticketing.ts`, `src/adapters/github-tickets.ts`, `process.md`, `.claude/skills/timone-wayfind/SKILL.md`, and documents under `doc/`. The regression set is: PRD-05 R2, R3, R4, R5, R7, R10, R11 and R18 and PRD-08 R5 (no `Depends-on`, so always in scope); PRD-07.R10 (`src/runner/`, `src/adapters/github-tickets.ts`); PRD-08 R1, R2 and R4 (`src/adapters/`, `src/runner/actions.ts`). **PRD-05.R11 is changed by this phase** (clause 2, by R13): its old half is struck in 47g, and its probe `prd-05.r11.mjs` tests the refusal this phase removes, so verification must amend that probe; the builder may not read it. The `live` criteria PRD-02 R1, R2, R4 and R8 depend on `src/daemon/`, and PRD-05 R9, R12 and R15 declare nothing, so **a live gate is owed**: on scratch-app, never ivtrends, two marked tickets, the first left with an open pull request, the second must build while it is open, and a third ticket refused a step must be the only one woken when the place frees. The daemon runs on the operator's machine, so by ADR-0059 this rides to the pull request as an unticked check. **What no criterion watches:** that a run still ends only on a merged pull request or a named person's stop (`endRun`), that the reclaim of a dead run still frees what it held, and that a step ticket blocked by an open step ticket is still not picked up. The existing tests of those — `endRun` in `src/runner/actions.test.ts`, the stale-run tests in `src/daemon/runs.test.ts` and `src/daemon/poll.test.ts`, and the frontier tests in `src/daemon/steps.test.ts` — are a hard gate in every slice, not a courtesy.

**What is not done here.** The number of places in `timone.yaml`, the planner, "every unblocked step may build", and PRD-02.R22 clause 1 and PRD-05.R15 clause 2 are piece 5. The update after a merge is piece 4. Box names that collide (#73) are out of scope in PRD-07. Requirement statuses stay `draft`; verification sets them.

## Context & Prerequisites

- **`src/daemon/runs.ts`** — `RunStatus` (with `queued`); `RUNNING = ["picked-up", "active"]` (also used by `staleRuns` and `src/commands/status.ts`; its meaning there, "a session is running or about to", does not change); `holdsProject(run)` (running, or parked with a branch); `RunStore.register` (writes `queued` when `loadedOccupyingRun` finds a holder); `claim(id, holder)` (parked → active, refuses a live holder of another token); `activate`; `park`; `repark`; `claimBranch` (refuses while another run holds the project); `complete`; `cancel`; `promoteQueue` / `promoteHead`; `occupyingRun` / `loadedOccupyingRun` / `loadedRunningRun`; `queue` / `queuePosition`; the private `transition` that throws `one session per project at a time` and `one work branch at a time`; `normaliseSequences` and friends in the load path (`readState`, around line 1697).
- **`src/daemon/runs.test.ts`** — `newStore()`, `statePath()`; the describes "the one-active-run invariant" (line 210), "the holds-the-project rule" (line 250) and "promotion" (line 433) encode the rule PRD-02.R10 states and this phase replaces. They are rewritten, not deleted: each case that asserted a refusal now asserts what ADR-0063 says, and the handoff names each one changed.
- **`src/daemon/step-session.ts`** — `startStepSession`: claims a parked run with a `timone daemon <runId>` holder, then `activate`s it; on a failed start, parks it again on its old wait.
- **`src/runner/actions.ts`** — `runnerActions(deps, run)`; `stepBlocked` (a step of this run running, or the limit); `branchFor` (claims the branch, turns the claim's error into "The project is busy, so no step can start: …"); `startStep` (reads the ticket with `deps.adapter.getTicket`, which carries `labels` and `createdAt`); `endRun` (unchanged).
- **`src/runner/driver.ts`** — `PROJECT_FREE_EVENT`; `look()` (the 40u block around line 500); `busyRefusal` and `projectFreeFor`; `afterStep` (parks the run after a step and asks for a wake); `handBack` / `terminalEnded`; `noticed(entries, about)` and `notices`.
- **`src/runner/session.ts`** — `wakeRunner`: parks a `picked-up` run on the runner's wait before the session; writes `woke` and `runner-ended`; calls `settle` after an `ended` session.
- **`src/runner/brief.ts`** — `SYSTEM` (the runner's rules) and `factsSection(facts)`; `buildBrief(input)` is pure.
- **`src/daemon/poll.ts`** — `pollProject`: the pickup loop (`store.occupyingRun`, `store.register`, `queuedComment`, `pickedUpComment`), then `store.promoteQueue`, then `runner.tick`; the `claim-takeover` request handler around line 708 calls `store.claim(resolution.run.id, body.holder)`.
- **`src/commands/takeover.ts`** — `findTakeover` (`case "queued"`, `case "picked-up"/"active"`: "I'm working on … right now"); `claimForTakeover` calls `store.claim(resolution.run.id, hold)`; `queuedMessage`.
- **`src/commands/status.ts`** — `describeProject` lists running, parked and queued runs. **`src/commands/cancel.ts`** — a `case "queued"`. **`src/commands/daemon.ts`** — opens the store with `RunStore.open(statePath)` around line 627.
- **`src/adapters/ticketing.ts`** — the `TicketingAdapter` port, `PullRequest` (`number`, `title`, `url`, `state`, `headSha`). **`src/adapters/github-tickets.ts`** — `PR_FIELDS`, `ghPullSchema`, `toPullRequest`, `findPullRequest(project, branch)`. Fakes of the port live in several test files and in `src/runner/replay/recording.ts`; `tsc --noEmit` finds every one that must gain the new method.
- **`src/daemon/prompts.ts`** — `workBranch(ticket, seq)`: `timone/<n>-<slug>`, plus `-chunk-<seq>` from the second chunk. Not changed.
- **Standards.** This project has no `doc/standards.md`; the central `standards/typescript.md`, `standards/testing.md` and `standards/code-smells.md` apply: TypeScript strict, vitest, tests at public seams, no test that reaches into a private field. No screen, so no accessibility work.

## Sub-phases

### Sub-phase 47a: The ledger gives places — a running step or a given place takes one, and a freed place goes to one waiting run in order

**[MODIFY]** `src/daemon/runs.ts`:
- `RunStatus` loses `queued`; `TRANSITIONS` loses its row; a new `normaliseQueued` in the load path reads a raw `"queued"` as `"picked-up"` before validation, idempotent, with a doc comment naming ADR-0063 D2.
- `runSchema` gains `place` and `takenOver` as in the Goal Description, both optional, each with a doc comment.
- `export const PLACES_PER_PROJECT = 1`.
- A private predicate `takesPlace(run)`: `(run.status === "active" && run.takenOver !== true) || run.place?.givenAt !== undefined`. `holdsProject` is deleted.
- `register` always writes `picked-up`.
- New public methods, each re-reading the file as the others do:
  - `askPlace(id, order: { priority: boolean; openedAt: string }): { ok: true } | { ok: false; holder: Run }` — writes `place.priority` and `place.openedAt`. Answers `ok` when the place is given to this run, or when fewer than `PLACES_PER_PROJECT` runs take a place and none is given to another run. Otherwise sets `place.waitingSince` (kept if already set) and answers the run that takes the place.
  - `giveBack(id)` — clears `place.givenAt` and gives the place again.
  - `leaveTurn(id)` — clears `place.waitingSince` and `place.givenAt`, and gives the place again.
  - `regivePlaces()` — for every run with `place.givenAt` that is not `active`: clears `givenAt`, keeps or sets `waitingSince`; then gives places on every project. Called once at daemon start (47c).
  - `waitingForPlace(project): Run[]` — the waiting runs, in the order they will be given a place.
  - `placeHolders(project): Run[]` — the runs that take a place now.
- A private `givePlaces(project)`: while fewer than `PLACES_PER_PROJECT` runs take a place and a run waits, give it to the first by `place.priority` (true first), then `place.openedAt` (earliest), then ticket number (lowest): set `givenAt` to now, clear `waitingSince`. It runs inside the same mutation as the change that freed the place.
- `transition`: entering `active` is refused, with an `Error` subclass `NoPlaceError` (exported, carrying the holder's run id in its message), when the run is not `takenOver`, the place is not given to it, and `PLACES_PER_PROJECT` runs already take one. Entering `active` clears `place.givenAt` and `place.waitingSince` (the step now takes the place itself). The old "one session per project" and "one work branch" refusals are deleted.
- Leaving `active` for `parked`, when the run was taking a place (not `takenOver`): set `place.waitingSince` to now when the run has `place.priority` recorded (D2 — a run whose step just ended waits until its runner decides), then `givePlaces`. `complete` and `cancel`: clear `place` and `takenOver`, then `givePlaces`. Any move out of `active` clears `takenOver`.
- `claim(id, holder, options?: { takeover?: boolean })` — with `takeover: true` sets `takenOver: true` before the transition, so no place is asked. Without it, as today.
- `claimBranch` keeps only the setter: it no longer refuses because another run owns a branch.
- `promoteQueue`, `promoteHead`, `queue`, `queuePosition`, `occupyingRun`, `loadedOccupyingRun`, `loadedRunningRun` are deleted, with their callers moved to `placeHolders` / `waitingForPlace` or removed. The class doc comment's "Two rules, not one" is rewritten to the place rule, naming ADR-0063.

**[MODIFY]** `src/daemon/runs.test.ts` — the three describes named in Context are rewritten to the place rule; new cases below.

**[MODIFY]** `src/daemon/poll.ts` — only what the type change forces: the `queued` branch of the pickup and `queuedComment` go (every pickup posts `pickedUpComment`); `store.promoteQueue(project.name)` goes. **[MODIFY]** `src/daemon/poll.test.ts` — cases asserting a queued comment or a promotion are rewritten: the second ticket is picked up, not queued.

**[MODIFY]** `src/commands/takeover.ts`, `src/commands/cancel.ts`, `src/commands/status.ts`, `src/runner/driver.ts`, `src/runner/session.ts` — only what the type change and the deleted methods force: `case "queued"` branches and `queuedMessage` go; `driver.ts`'s `projectFreeFor` reads `placeHolders` for now (47c replaces the whole block); `status.ts` stops reading `queued` (47f adds the waiting list). Their tests change only where they built a `queued` run.

**Seams under test (TDD):** `RunStore`'s public methods over a temporary state file are the seam — it is the one writer of the ledger and the rule lives there (its own doc comment says why: a rule about a shared resource that lives in the caller is one the next caller will not know). Red-green:
1. Run A parked with a branch and `pr` set; run B of the same project: B's `askPlace` answers ok and B's step can be `claim`ed and `activate`d (R1 clause 1). Same with A parked on a wait for a person and a branch (R1 clause 2).
2. A `register` while another run of the project is `active` writes `picked-up`, never `queued`.
3. A ledger file holding a `queued` run loads, and the run reads `picked-up`; loading twice changes nothing.
4. With A active, B's `askPlace` answers not ok naming A, and B's `waitingForPlace` entry exists; `activate`/`claim` of B throws `NoPlaceError` whose message names A's run id.
5. With A active and B and C waiting, C labelled priority: when A parks, the place is given to C, not B, in that same write; `askPlace` for B still answers not ok naming C; C's `claim` succeeds. Without the label, the earlier `openedAt` wins; equal `openedAt`, the lower ticket number wins (R3 clauses 1, 2).
6. A given place that is given back (`giveBack`) goes to the next in order; `leaveTurn` on the given run does the same and the run is no longer in `waitingForPlace` (R3 clause 4).
7. A run whose step ends (active → parked) while nobody else waits is given the place itself; while an older run waits, the older one is given it and the ended run waits behind it.
8. A run `claim`ed with `{ takeover: true }` while another run is active becomes active, and `placeHolders` does not list it; B's `askPlace` still answers ok when nothing else takes a place (R2 clause 6, R13).
9. `regivePlaces` takes back a given, unused place and gives it again by order; an active run is untouched.
10. `complete` and `cancel` of the run taking the place give it to the first waiting run.
11. `claimBranch` on B while A owns a branch and is parked succeeds.
12. The stale-run, reclaim and holder cases already in the file stay green unchanged.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"   # expected 0
npx vitest run src/daemon/runs.test.ts src/daemon/poll.test.ts src/daemon/steps.test.ts src/commands/ src/runner/driver.test.ts src/runner/session.test.ts; echo "exit: $?"   # expected 0
# The old rule is gone from code, comments excluded; grep exits 1 when nothing matches
grep -rnE "holdsProject|promoteQueue|queuePosition|one work branch at a time" src --include=*.ts | grep -vE '^\S+:[0-9]+:\s*(//|\*)'; echo "exit: $? (expected 1)"
```

- [ ] Cases 1–12 above pass, with the red run of each new case recorded in the handoff.
- [ ] The handoff lists every pre-existing test whose assertion changed, with the old assertion and the requirement that replaced it (PRD-02.R10 → PRD-07 R1/R2/R3).
- [ ] No `queued` value is written anywhere: `grep -rn '"queued"' src --include=*.ts | grep -v test` shows only the normalisation.

---

### Sub-phase 47b: A step asks for a place, and a refused step leaves its run waiting for its turn

**[MODIFY]** `src/runner/actions.ts`:
- In `startStep`, after `stepBlocked` and before `branchFor`: read the ticket (already read there), call `deps.store.askPlace(run.id, { priority: ticket.labels.includes(PRIORITY_LABEL), openedAt: ticket.createdAt })`. Not ok → refuse with the sentence in the Goal Description, naming the holder's run id and whether its step runs or the place is given to it. Nothing else is written; no branch is claimed.
- `PRIORITY_LABEL = "priority:high"`: no constant exists under `src/` today; add it in `src/daemon/steps.ts`, beside `HELD_LABEL`, and export it.
- `branchFor` no longer catches a "busy" refusal: `claimBranch` cannot refuse for that any more. Its doc comment is corrected.
- A `NoPlaceError` thrown by `deps.startStep` (a place taken between the ask and the start) is answered with the same refusal sentence. The ledger's transition throws before it writes anything, so the action calls `askPlace` once more to write that the run waits; the stage put back by the existing `catch` stays as it is.

**[MODIFY]** `src/daemon/step-session.ts` — no change to the flow; the doc comment on "Only a parked run is claimed here" is corrected (a `picked-up` run no longer takes a slot). If `claim` throws `NoPlaceError`, the error reaches the caller unchanged and the run stays parked on its wait.

**[MODIFY]** `src/runner/actions.test.ts` — cases below.

**Seams under test (TDD):** `runnerActions(deps, run).startStep` with a real `RunStore` on a temporary file and the fake adapter and fake `startStep` the file already uses — the action is what the runner calls, and its refusal text is what the runner reads. Red-green:
1. Another run of the project active: `startStep` answers `{ ok: false }` with a sentence that starts `No place is free on` and names that run's id; `deps.startStep` was not called; the run has no branch claimed; the store lists the run in `waitingForPlace` with `priority` and `openedAt` taken from the ticket.
2. Another run parked with a branch and an open pull request, nothing active: `startStep` starts the step (R1).
3. The place given to this run: `startStep` starts the step, and the run is no longer waiting (R3 clause 3).
4. The place given to another run: refused, naming that run, with "the place is given to".
5. The ticket labelled `priority:high`: the recorded order has `priority: true`.
6. `endRun`, the limit refusal and the skip-reason refusal behave as before (existing cases, unchanged, green).

> Sub-phase 47a must be complete before starting this sub-phase (`askPlace`, `NoPlaceError`).

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"   # expected 0
npx vitest run src/runner/actions.test.ts src/daemon/step-session.test.ts src/daemon/runs.test.ts; echo "exit: $?"   # expected 0
grep -rn "The project is busy" src --include=*.ts | grep -vE '^\S+:[0-9]+:\s*(//|\*)'; echo "exit: $? (expected 1)"
```

- [ ] Cases 1–6 pass, with red runs recorded.
- [ ] The refusal sentence in a test matches the Goal Description's words exactly.

---

### Sub-phase 47c: Only the run given a place is woken, and a place it does not use goes to the next

**[MODIFY]** `src/runner/driver.ts`:
- `PROJECT_FREE_EVENT`, `busyRefusal`, `projectFreeFor` and `namedRunIds` (if nothing else uses it) are deleted; `PLACE_GIVEN_EVENT` is added with the Goal Description's words.
- In `look()`, in place of the 40u block: when `run.place?.givenAt` is set and no step of the run is running, push `PLACE_GIVEN_EVENT` once per given place, noticed as `place given at <givenAt>, run <id>`.
- In `afterStep`, after `parkForRunner`: when the store now shows the place given to this run, write that notice, so the after-step wake is the only wake for it.

**[MODIFY]** `src/runner/session.ts` — in `wakeRunner`, after the session: read the run. When the session `ended`, no step of the run is running, and the run is still not `active`: when this wake recorded a `start_step` decision refused for want of a place, call `store.giveBack(id)` if the place is given to it (it stays waiting); otherwise call `store.leaveTurn(id)`. When the session `failed` or was `stopped`: `giveBack(id)` only if the place is given to it. A run that is `done` or `cancelled` needs nothing (the ledger cleared it).

**[MODIFY]** `src/runner/brief.ts` — one line in `factsSection`, from a new `place` field of the brief's input: `- The project's place: given to this ticket — a step you start now will not be refused.` / `free.` / `taken: <run id> has a step running.` / `given to <run id>. This ticket waits for its turn.` And one rule in `SYSTEM`, under *How you act*: `- A step needs the project's place. When the place is taken, starting a step is refused and the ticket waits for its turn; you are woken when a place is given to it. Do not say on the ticket that the work has started until a step has started.` The caller that builds the brief input (in `session.ts`) fills `place` from `placeHolders` and `waitingForPlace`.

**[MODIFY]** `src/commands/daemon.ts` — call `store.regivePlaces()` once after `RunStore.open`, before the first cycle.

**[MODIFY]** `src/runner/driver.test.ts` — the describe "a run refused a step because its project was busy (40u)" is rewritten to the given place; **[MODIFY]** `src/runner/session.test.ts`, `src/runner/brief.test.ts` — cases below.

**Seams under test (TDD):** `RunnerDriver.tick` with the file's `fakeWakes()` and a real `RunStore` is the seam for who is woken — the wakes it asks for are exactly what reaches a runner. `wakeRunner` with a fake runner session is the seam for giving back. `buildBrief` is pure. Red-green:
1. Runs B and C both refused a step while A is active; A's step ends: one tick asks for a wake of exactly one of B and C, the one first by order, with `PLACE_GIVEN_EVENT`; the other is not woken (R3 clause 3, #184).
2. A second tick with nothing changed asks for no wake (the notice holds).
3. The woken run's runner session ends with no step started: the place is given to the other run, and the next tick wakes that one (R3 clause 4).
4. A run whose step just ended and was given the place itself is woken once, with the step's end, not a second time with `PLACE_GIVEN_EVENT`.
5. A run waiting for a person on its own branch, with an open pull request, is not woken when a place frees; it is woken on its pull request's merge as before (R1 clause 3).
6. `buildBrief` with each of the four place states writes the matching line; the `SYSTEM` text carries the new rule.
7. After a simulated restart (`regivePlaces` on a ledger with a given place and no wake in flight), the next tick wakes the first waiting run.

✏ 2026-10-04 (build, timone#201): three cases added and one file granted. The first try of this slice showed that a place could be given and then never used or given back, so the project's one place stays taken and no other step starts. (a) In `look()`, a run given the place that this tick will not wake for it — its ticket is held, or it is over its spending limit — gives the place back (`store.giveBack`), so it goes to the next waiting run. (b) In `wakeRunner`, a place given to the run *after* this wake's refused `start_step` (the holder's step ended during the wake) is not given back: the run keeps it and the next tick wakes it with `PLACE_GIVEN_EVENT`, as its refusal promised. **[MODIFY]** `src/daemon/poll.test.ts` — only the test "a runner refused a step because its project was busy is woken once it is free (40u)", which wrote a refusal by hand and expected the old words: it is rewritten to the given place, or deleted when case 1 covers it.
8. A run given the place whose ticket is held (not a step ticket) is not woken, and the place goes to the next waiting run in the same tick; the same for a run over its spending limit.
9. A run whose `start_step` was refused in this wake, and that was given the place later in the same wake, keeps the place when the wake ends, and the next tick wakes it with `PLACE_GIVEN_EVENT`.

> Sub-phases 47a and 47b must be complete before starting this sub-phase (the store methods, and the refused `start_step` decision this reads).

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"   # expected 0
npx vitest run src/runner/ src/daemon/runs.test.ts; echo "exit: $?"   # expected 0
npm run replay; echo "exit: $?"   # expected 0 — PRD-05.R18's replay set
grep -rn "PROJECT_FREE_EVENT\|The project is free now" src --include=*.ts | grep -vE '^\S+:[0-9]+:\s*(//|\*)'; echo "exit: $? (expected 1)"
```

- [ ] Cases 1–7 pass, with red runs recorded.
- [ ] The replay set passes unchanged; if a recorded case expected the old event's words, the handoff says which and why it changed.

---

### Sub-phase 47d: A ticket with an open pull request is taken over, not picked up as new work

**[MODIFY]** `src/adapters/ticketing.ts` — the port gains `findOpenPullRequestOfTicket(project, ticket: number): Promise<{ pullRequest: PullRequest; branch: string } | undefined>`, with a doc comment: the head branch is `timone/<ticket>` or starts with `timone/<ticket>-`; the newest open one wins; it throws on a forge failure, never answers undefined for one.

**[MODIFY]** `src/adapters/github-tickets.ts` — implements it with one `gh pr list --repo <slug> --state open --json <PR_FIELDS>,headRefName --limit <pageLimit>`; `ghPullSchema` gains an optional `headRefName` (or a second schema for this call). **[MODIFY]** every fake of the port that `tsc` names, and `src/runner/replay/recording.ts`, gain the method (answering undefined unless a test sets one).

**[MODIFY]** `src/daemon/runs.ts` — `adopt(project, ticket, { branch, pr }): Run` opens the ticket's next chunk directly as `parked` at stage `delivery`, with `branch`, `pr` and the wait from the Goal Description. It refuses when the ticket has a live run.

**[MODIFY]** `src/daemon/poll.ts` — in `pollProject`, before `store.register`: when `store.liveRunForTicket` is undefined, ask `adapter.findOpenPullRequestOfTicket`; when it finds one, `store.adopt(...)`, log `adopt  <run id> — pull request #<n> is open`, post nothing, and `continue`. A forge failure there is logged as an error for this ticket and the ticket is skipped this cycle (it is not picked up blind).

**[MODIFY]** `src/daemon/poll.test.ts`, `src/adapters/github-tickets.test.ts` (or `github-pulls.test.ts`), `src/daemon/runs.test.ts` — cases below.

**Seams under test (TDD):** `pollProject` through the file's existing poll entry with the fake forge — the pickup is what #181 got wrong; `GitHubTicketingAdapter` with `fakeRunner` for the `gh` argv and the branch filter; `RunStore.adopt`. Red-green:
1. A marked ticket #67 with no run in the ledger and an open pull request #70 from `timone/67-some-title`: one cycle opens a run that is `parked`, has `branch: "timone/67-some-title"` and `pr: 70`, posts no comment, and asks for no `NEW_TICKET_EVENT` wake (R9 clause 1, #181).
2. That run is woken when #70 merges, and its brief's facts name the branch and the pull request (R9 clause 2; use the driver's existing merge path).
3. A pull request from `timone/670-other` does not count for ticket #67; one from `timone/67` does.
4. No open pull request: the ticket is picked up as before, with `pickedUpComment`.
5. A ticket with a live run: the forge is not asked.
6. The adapter sends `gh pr list … --state open` and filters by head branch; a `gh` failure throws.

> Sub-phases 47a and 47c must be complete before starting this sub-phase: 47a changed `runs.ts` and the pickup loop, and the fakes of the adapter port this slice extends include ones in `src/runner/` test files that 47c changes.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"   # expected 0
npx vitest run src/daemon/poll.test.ts src/daemon/runs.test.ts src/adapters/; echo "exit: $?"   # expected 0
```

- [ ] Cases 1–6 pass, with red runs recorded.
- [ ] The scratch-app#67 case is named in the test's title, so a reader finds #181 from the test.

---

### Sub-phase 47e: A takeover takes no place and is not refused because of another ticket

**[MODIFY]** `src/commands/takeover.ts` — `claimForTakeover` calls `store.claim(id, hold, { takeover: true })`. `findTakeover` keeps its refusal for a `picked-up` or `active` run of the same ticket (R13 clause 3); every sentence that blamed another run of the project goes. The comment above the heartbeat ("the run's *status* is what holds the project …") is corrected: a takeover takes no place (ADR-0063 D5).

**[MODIFY]** `src/daemon/poll.ts` — the `claim-takeover` request handler (around line 708) calls `store.claim(…, body.holder, { takeover: true })`.

**[MODIFY]** `src/commands/takeover.test.ts`, `src/daemon/poll.test.ts` — cases below.

**Seams under test (TDD):** the takeover command's exported entry (as the file's tests already drive it, with a temporary ledger and the lock free), and the daemon's request handler for the lock-held road. Red-green:
1. Ticket B has a parked run, ticket A of the same project has a step running: the takeover of B claims it; B is `active` and `takenOver`; A is untouched (R13 clause 1).
2. A has no step running but owns a branch and an open pull request: the takeover of B succeeds (R13 clause 2).
3. B's own step is running: the takeover is refused with today's words (R13 clause 3).
4. While B is taken over, a third ticket's step may start (R2 clause 6).
5. The same three through the `claim-takeover` request road.

> Sub-phase 47a must be complete before starting this sub-phase. It touches `src/daemon/poll.ts`, so it runs after 47d.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"   # expected 0
npx vitest run src/commands/takeover.test.ts src/daemon/poll.test.ts src/daemon/runs.test.ts; echo "exit: $?"   # expected 0
```

- [ ] Cases 1–5 pass, with red runs recorded.
- [ ] The handoff names PRD-05.R11's probe as one verification must amend; the builder does not open it.

---

### Sub-phase 47f: `timone status` says which tickets wait for a place, in their order

**[MODIFY]** `src/commands/status.ts` — `describeProject` adds, after the runs, `waiting for a place: #12, then #9` from `store.waitingForPlace(project)` (or the run list it is given, ordered the same way — use the store's order, not a second sort). A run given the place reads `the place is given to #12`. Nothing is shown when nobody waits. **[MODIFY]** `src/commands/status.test.ts` — cases below.

**Seams under test (TDD):** the status renderer's exported function, with runs built in a temporary ledger. Red-green: (1) two waiting runs show in the store's order, the `priority:high` one first; (2) a given place is named; (3) no waiting run, no line.

> Sub-phase 47a must be complete before starting this sub-phase. It shares no file with 47b–47e and may run beside them.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"   # expected 0
npx vitest run src/commands/status.test.ts; echo "exit: $?"   # expected 0
```

- [ ] Cases 1–3 pass, with red runs recorded.

---

### Sub-phase 47g: The old rule is struck where it is written

No behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based.

**[MODIFY]** `doc/specs/prd/prd-02-inversion-of-control.criteria.md` — R10 gets a dated note (`✏ 2026-10-04 — replaced by PRD-07 R1, R2 and R3 ([ADR-0063](…))`) under its heading; R22 clause 6 gets a dated note naming PRD-07.R1. Nothing is deleted. **[MODIFY]** `doc/specs/prd/prd-02-inversion-of-control.md` — the sentence "Work per project is serialized …" and the bold "The chunk holds the project, not the ticket" each get a dated note naming PRD-07 and ADR-0063.
**[MODIFY]** `doc/specs/prd/prd-03-a-run-ends-at-its-pull-request.md` — the out-of-scope line on how a project is held gets a dated note: reversed by PRD-07.R1. The sentence "Each stop also holds the project" gets the same note.
**[MODIFY]** `doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md` — R11 clause 2: a dated note that the refusal while another run of the project works or holds a work branch is replaced by PRD-07.R13, and that the refusal on a run the machine is working on stays. R15's verification hint: a dated note that "The project is free now" became `PLACE_GIVEN_EVENT`'s words with this phase (clause 2 itself is piece 5's).
**[MODIFY]** `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.md` — the sentence "A decision record that replaces the rule of ADR-0026 … is still to be written" gets a dated note pointing at ADR-0063.
**[MODIFY]** `process.md` — stage 6, the parenthesis "stacking arises only on this path — a ticket-driven run holds its project until its PR reaches a terminal state, so the next ticket's branch always cuts from a current default branch" becomes, with a dated ✏ marker naming ADR-0063: stacking arises only on this path; a ticket-driven run's branch is always cut from the default branch, and a ticket that needs another ticket's work waits for that ticket's pull request to merge.
**[MODIFY]** `.claude/skills/timone-wayfind/SKILL.md` — Mode 2 item 5 ("the map holds its whole project … the queue stopped") is amended with a dated marker: a map's run takes the project's place only while one of its steps runs (ADR-0063); other tickets of the project are not stopped by it.
**[MODIFY]** `CONTEXT.md` — a **Place** entry, in the words of PRD-07's register: one of a project's slots for a running step; taken while a step runs or while the place is given to a waiting ticket; and the **Chunk** entry's "its own place in the queue" gets a dated note that there is no queue any more.

> Sub-phases 47a–47f must be complete before starting this sub-phase (the notes describe what the code now does, and quote its words).

#### Agent Validation Steps

```bash
grep -n "ADR-0063" doc/specs/prd/prd-02-inversion-of-control.criteria.md doc/specs/prd/prd-02-inversion-of-control.md doc/specs/prd/prd-03-a-run-ends-at-its-pull-request.md doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.md process.md .claude/skills/timone-wayfind/SKILL.md CONTEXT.md; echo "exit: $? (expected 0, every file listed at least once)"
grep -n "holds its project until its PR reaches a terminal state" process.md | grep -v "~~"; echo "exit: $? (expected 1 — struck or rewritten)"
```

- [ ] Every place R12 names for this piece carries a dated note naming the PRD-07 requirement that changes it.
- [ ] PRD-02.R22 clause 1 and PRD-05.R15 clause 2 are untouched (piece 5's).
- [ ] No requirement's `Status:` line changed.
- [ ] Plain words in every note: no metaphor, no process jargon.

## Dependency graph

```
47a → (none)          the ledger's places: the rule, the order, the given place, queued gone
47b → 47a             a step asks for a place; a refused one waits its turn
47c → 47a, 47b        only the run given a place is woken; an unused place moves on; the runner is told
47d → 47a, 47c        an open pull request is taken over at pickup, not picked up as new work
47e → 47a, 47d        a takeover takes no place (after 47d: both change src/daemon/poll.ts)
47f → 47a             timone status lists who waits for a place
47g → 47a–47f         the old rule struck in the requirements, ADR notes, process.md, the charting skill, CONTEXT.md
```

47b → 47c → 47d → 47e is one chain. 47f shares no file with it and may run beside it once 47a is done; commits are still made one at a time, because every slice appends to `phase-47-handoffs.md`.
