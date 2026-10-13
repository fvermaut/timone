# Phase 60: A ticket refused a place waits in line — recording an approval asks for a place, and the brief says whether the ticket is in line

> **Status:** Planned.

> **Companion phases:** [phase 47](phase-47.md) built places and the line for them (ADR-0063), including `askPlace`, `leaveTurn`, the `refusedForPlace` watch in `src/runner/session.ts` and the place line of the brief; this phase changes those. [Phase 49](phase-49.md) added the number of places and the planner, and verified PRD-07.R2 with [`prd-07.r2.mjs`](probes/prd-07.r2.mjs). [Phase 59](phase-59.md) is the last run of the real replay (run 3, 2026-10-11). Governing decisions: [ADR-0063](../../adr/0063-a-ticket-takes-a-place-only-while-one-of-its-steps-runs.md), because D2 says a run refused for want of a place waits for its turn, and both faults break that; [ADR-0065](../../adr/0065-the-planner-is-a-session-of-its-own-asked-when-a-build-would-start.md) D2, because the build asks the planner before the place, which is why the brief's planner line matters here; [ADR-0060](../../adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md), because the runner chooses each step from the brief, so a false line in the brief is a wrong choice.

> **Screens changed:** none — the runner's actions and its brief; no slice changes anything a person sees.

## Requirements

> **PRD:** [prd-07-several-tickets-of-one-project-at-once.md](../../specs/prd/prd-07-several-tickets-of-one-project-at-once.md) — criteria in [prd-07-several-tickets-of-one-project-at-once.criteria.md](../../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md); [prd-05-a-runner-decides-each-step.md](../../specs/prd/prd-05-a-runner-decides-each-step.md) — criteria in [prd-05-a-runner-decides-each-step.criteria.md](../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-07.R2 | MUST | With every place taken, a step of another ticket that asks to start does not start, and the ticket waits for its turn (clause 3). |
| PRD-07.R3 | MUST | A freed place goes to one waiting ticket, and its next step is not refused for want of a place. |
| PRD-05.R1 | MUST | When the runner wakes, it starts the next step of the default order (clause 1). |
| PRD-05.R18 | MUST | A change to the runner's brief is proposed with the replay run, and its result on the pull request (clause 2). |

Bugs: [timone#248](https://github.com/fvermaut/timone/issues/248) and [timone#249](https://github.com/fvermaut/timone/issues/249), triaged as bugs on 2026-10-13. Both were found on ivtrends on 2026-10-12, where four tickets stood still for up to three days.

## Goal Description

**#248.** Recording an approval starts a short session that writes the approval into its file. That session takes a place like a step, but `recordApproval` in `src/runner/actions.ts` calls `deps.startStep` without `deps.store.askPlace`. When every place is taken, the ledger refuses the session (`NoPlaceError`), the run is never written as waiting (`place.waitingSince` stays empty), and the wake ends with `leaveTurn`, because the session in `src/runner/session.ts` counts a refusal for want of a place only from `start_step`. Nothing wakes the ticket again. ivtrends#182 and #189 stood still this way from 2026-10-09 until a comment woke them on 2026-10-13. This breaks PRD-07.R2 clause 3 and R3.

**#249.** When another run was given the last place, `placeOf` in `src/runner/session.ts` gives `given-to`, and `placeText` in `src/runner/brief.ts` always adds "This ticket waits for its turn." It does not look at the run's own `place.waitingSince`. Since the change of 2026-10-05 (a run whose step has just ended does not wait for a place), that sentence is false after every step that ends while another run holds a given place. On ivtrends#197 and #201, planning ended, the brief said the ticket waited, and the runner started nothing and expected to be woken. Nothing woke them. The brief also said "The planner: not asked yet.", and the runner read that as a second reason to wait, though starting the build is what asks the planner. This breaks PRD-05.R1 clause 1.

The two fixes are grouped because they are the same promise of ADR-0063 D2 — a ticket refused a place waits in line, and is woken when a place is given to it — broken in two places, and because both touch `src/runner/session.ts`. They go in one pull request.

**Decisions that did not reach an ADR.** (1) `recordApproval` asks for the place **before** it writes the approval in the record, as `start_step` asks before it claims the branch: a refused try writes nothing, and the runner records the approval when it is woken with the place. Recording first would show the approval as given in the brief's order while the file still says it waits for one, and the runner could then go on without writing it. This follows ADR-0063 D2 and is easy to reverse, so it is not an ADR. (2) The brief's place line keeps its four kinds, and the two kinds where another run holds the place say whether this ticket is in line. This makes a fact true; it decides nothing new. (3) No replay case is added for #248 or #249: a new case is a new row in PRD-05.R18's table, which is a change of requirements that fvermaut approves. The existing replay is run, as R18 clause 2 asks for any change to the brief.

**Regression set and what no criterion watches.** The diff touches `src/runner/actions.ts`, `src/runner/session.ts` and `src/runner/brief.ts`; verification derives the set from the register (`src/runner/` is in the `Depends-on` of most of PRD-07 and of PRD-08 R1 and R2). PRD-07.R2 and R3 have probes ([`prd-07.r2.mjs`](probes/prd-07.r2.mjs), [`prd-07.r3.mjs`](probes/prd-07.r3.mjs)) that must still pass. **What no criterion watches:** that the runner, told truthfully that its ticket is not in line, then tries the step. The brief now says so; whether the model acts on it is seen only on a live ticket. The `live` criteria of PRD-07 that depend on `src/runner/` (R5, R7, R14) stay `draft` and are not claimed here. **The real replay is owed before the pull request** (R18 clause 2): it needs a model login and costs about $3.

## Context & Prerequisites

- **`src/runner/actions.ts`** — `startStep` (around line 880–1010) is the model: it builds `turn = { priority: ticket.labels.includes(PRIORITY_LABEL), openedAt: ticket.createdAt }`, calls `deps.store.askPlace(run.id, turn)` after every other rule, returns `noPlace(place.holder)` when refused, and on a `NoPlaceError` thrown by `deps.startStep` asks once more. `noPlace` (around line 560) gives the refusal "No place is free on <project>: … This ticket now waits for its turn, and you are woken when a place is given to it." `recordApproval` (around line 1088–1190) has none of this.
- **`src/runner/session.ts`** — `wakeRunner` wraps `actions.startStep` in `watched` (around line 240) to set `refusedForPlace` when a refusal starts with `noPlaceRefusal(project)`. `freePlace` (around line 312) then keeps the run's turn. `placeOf` (around line 620) computes the place fact.
- **`src/runner/brief.ts`** — `PlaceFact` (around line 73), `placeText` and `plannerText` (around line 436–462).
- **`src/daemon/runs.ts`** — `askPlace`, `leaveTurn`, `giveBack`, `waitingForPlace`, `placeHolders`. Not changed.
- **Tests that hold the current words** — `src/runner/brief.test.ts` ("the project's place, as the runner is told it"), `src/runner/session.test.ts` ("a place on the project after a wake"), and `placeWorld` and `noPlace` in `src/runner/actions.test.ts`, which make a ledger that refuses a session for want of a place as the daemon's does.
- **The real replay** needs a model login. fvermaut's lasting token is exported in his `~/.zshrc`; `zsh -i -c` gets it, as in phase 59. If that is refused, fvermaut runs it from his own terminal.

## Sub-phases

### Sub-phase 60a: Recording an approval asks for a place, and a refusal leaves the ticket in line

**[MODIFY]** `src/runner/actions.ts` — in `recordApproval`, after `stepBlocked` and **before** the `approval` entry is written: build `turn` from `ticket` (the thread `namedPersonsComment` returned) as `startStep` does, call `deps.store.askPlace(run.id, turn)`, and return `noPlace(place.holder)` when it is refused. In the `catch` around `deps.startStep`: when the error is a `NoPlaceError`, ask for the place once more and return `noPlace(again.holder)` when refused, as `startStep` does. Because the approval entry is now written before the session starts but after the place is granted, a refusal in the `catch` for any other reason keeps today's words ("The approval is written down, but the step that writes it into the file did not start: …"). Update the comment above the session request to say the session asks for a place like a step (ADR-0063 D2, #248).

**[MODIFY]** `src/runner/session.ts` — in `wakeRunner`, wrap `actions.recordApproval` in `watched` as `startStep` is, so a refusal that starts with `noPlaceRefusal(project)` sets `refusedForPlace`. Update the comment on `refusedForPlace` and on `freePlace` to name both actions.

**[MODIFY]** `src/runner/actions.test.ts`, `src/runner/session.test.ts` — the cases below.

**Seams under test (TDD):** two public seams. `runnerActions(...).recordApproval`, on the `placeWorld` ledger that refuses a session for want of a place as the daemon does; and `wakeRunner`, with a scripted runner that calls `record_approval`, for what the wake leaves in the ledger. Red-green: (1) with the project's one place taken by another run's step, `recordApproval` is refused with `noPlace("run scratch-app#…/1 has a step running")`, and the run is in `store.waitingForPlace(project)`; (2) that refused try writes no `approval` entry in the record and starts no session; (3) with a place given to the run, `recordApproval` starts the approval session and is not refused, and the run takes the place; (4) a place taken between the ask and the start (`beforeClaim`) gives the same refusal and leaves the run waiting; (5) through `wakeRunner`: a wake whose `record_approval` is refused for want of a place ends with the run still in `waitingForPlace`, behind no one it was not behind before; (6) the existing cases of `recordApproval` (free place, R7 rules, the chunk-zero close) stay green.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
npx vitest run src/runner/actions.test.ts src/runner/session.test.ts
npx tsc --noEmit
npx vitest run src/daemon/runs.test.ts
npm run --silent build
```

> ✏ 2026-10-13 (build, timone#248): the two runs of the PRD-07 R2 and R3 checks moved to verification. They are the checks verification runs against the build, and the build may not use them; the plan put them here by mistake. Their two checkboxes went with them.

- [ ] Cases (1), (2) and (5) failed before the change to `actions.ts` and `session.ts` (red, in the handoff), and pass after.
- [ ] A refused `recordApproval` leaves no `approval` entry and no session.
- [ ] `npm run build` ends with exit 0.

---

### Sub-phase 60b: The brief says whether this ticket is in line, and that starting the build asks the planner

**[MODIFY]** `src/runner/brief.ts` — `PlaceFact`'s `taken` and `given-to` kinds get `waiting: boolean`. `placeText`:
- `taken`, waiting: `taken: <run> has a step running. This ticket waits for its turn.`
- `taken`, not waiting: `taken: <run> has a step running. This ticket is not in line for it: a step you try now is refused, and the refusal puts the ticket in line.`
- `given-to`, waiting: `given to <run>. This ticket waits for its turn.`
- `given-to`, not waiting: `given to <run>. This ticket is not in line for it: a step you try now is refused, and the refusal puts the ticket in line.`
- `given` and `free` are unchanged.

`plannerText`'s `not-asked` becomes `not asked yet. Starting the build asks it.`

**[MODIFY]** `src/runner/session.ts` — `placeOf` sets `waiting` from the run's own `place.waitingSince` as the ledger holds it now (`deps.store.get(run.id)`). Update its doc comment.

**[MODIFY]** `src/runner/brief.test.ts`, `src/runner/session.test.ts` — the cases below. The rule under *How you act* ("A step needs the project's place. …") does not change.

**Seams under test (TDD):** `buildBrief` for the words, and `wakeRunner` for the fact as the ledger gives it. Red-green: (1) `buildBrief` with `{ kind: "given-to", to, waiting: false }` gives the not-in-line line, and the prompt does not contain "This ticket waits for its turn."; (2) the same with `waiting: true` gives the waits line; (3) the two `taken` lines likewise; (4) `buildBrief` with the planner not asked gives "- The planner: not asked yet. Starting the build asks it."; (5) through `wakeRunner`: a run that never asked for a place, while another run of the project was given the last place, is told the not-in-line line — the case of ivtrends#201; (6) a run whose try was refused (`askPlace` refused) is told the waits line; (7) the existing case "tells the runner in its brief who takes the project's place" is updated to the new `taken` words and stays green.

> Sub-phase 60a must be complete before starting this sub-phase (both change `src/runner/session.ts` and `src/runner/session.test.ts`).

#### Agent Validation Steps

```bash
npx vitest run src/runner/brief.test.ts src/runner/session.test.ts
npx tsc --noEmit
grep -n "This ticket waits for its turn" src/runner/brief.ts | grep -v '^\s*[0-9]*:\s*//\|^\s*[0-9]*:\s*\*'; echo "exit: $? (0 expected: the sentence is still used, for a waiting ticket)"
npm run --silent replay -- --dry
npx vitest run
```

- [ ] Cases (1), (5) and (4) failed before the change (red, in the handoff), and pass after.
- [ ] The dry replay passes every case.
- [ ] The whole suite passes.
- [ ] **Human gate:** the real replay (`npm run replay`, every case, three tries each, on the model) runs on this branch after 60b, and its output goes into `doc/plans/phases/reports/phase-60-replay.md` as run 1. Run it through `zsh -i -c` to use fvermaut's lasting token, or fvermaut runs it from his own terminal: `cd ~/dev/timone/projects/timone && npm run build && npm run replay 2>&1 | tee ~/dev/timone/.timone/replay-60.txt`.

---

### Sub-phase 60c: ADR-0063 says that recording an approval asks for a place, and that the brief says whether a ticket is in line

**[MODIFY]** `doc/adr/0063-a-ticket-takes-a-place-only-while-one-of-its-steps-runs.md` — a dated note (`✏ <date>`) under D2: the session that writes an approval into its file asks for a place like a step, and a refused try writes nothing and leaves the ticket in line (#248); the runner's brief says whether the ticket is in line, since a run whose step has just ended does not wait (the change of 2026-10-05) (#249).

No behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based.

> Sub-phases 60a and 60b must be complete before starting this sub-phase (the note describes what they built).

#### Agent Validation Steps

```bash
grep -n "#248\|#249" doc/adr/0063-a-ticket-takes-a-place-only-while-one-of-its-steps-runs.md; echo "exit: $? (0 expected)"
git diff --stat main -- doc/adr/
```

- [ ] The note is under D2, dated, and names both issues.
- [ ] No other part of the ADR changed, other than this note.

## Dependency graph

```
60a → (none)        recording an approval asks for a place; a refusal leaves the ticket in line
60b → 60a           the brief says whether the ticket is in line, and that the build asks the planner; then the real replay
60c → 60a, 60b      a dated note on ADR-0063 D2
```
