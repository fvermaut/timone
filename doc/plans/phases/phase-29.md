# Phase 29: One step, one ticket — the daemon stops counting runs

> **Status:** Planned.

> **Companion phases:** [phase-22](phase-22.md) — it built the ledger half of R22, `TERMINAL`, and the settledness predicate this phase removes. [phase-23](phase-23.md) — it built the breakdown artifact, its parser, the `breakdown` pipeline stage, the chunk-zero merge, and chunk succession; **this phase changes what 23f decided and leaves the rest standing**. [phase-27](phase-27.md) — the feedback path, retired by ADR-0036, whose routing this must not disturb.
>
> Governing decisions:
> [ADR-0040](../../adr/0040-one-step-is-one-ticket-and-doneness-is-a-fact-about-a-ticket.md) is the whole of this phase;
> [ADR-0028](../../adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md) D1 and D2 stand and constrain it — the committed file remains the gate;
> [ADR-0014](../../adr/0014-artifact-first-gates.md) is why the file is not replaced by the tickets;
> [ADR-0029](../../adr/0029-a-chunk-advances-only-on-success.md) is **superseded** and is what this phase deletes.

## Requirements

> **PRD:** [prd-02-inversion-of-control.md](../../specs/prd/prd-02-inversion-of-control.md)
> — criteria in [prd-02-inversion-of-control.criteria.md](../../specs/prd/prd-02-inversion-of-control.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-02.R22 | MUST | A ticket hosts a sequence of steps — amended 2026-08-20 so each step is its own ticket and the next one is chosen from the tickets, never counted from runs |

R22 is `draft` and has never been verified. Clauses **1, 3 and 5** were rewritten on 2026-08-20; clauses 2, 4, 6, 7 and 8 are unchanged and this phase must not regress them.

## Goal Description

`ivtrends` #1 holds 73 comments because one thread carried fourteen pieces of independent business. ADR-0040 splits it: approving the breakdown opens one ticket per step, the initiative's ticket becomes a map of those children, and the next step is chosen the way wayfinding already chooses its next question — the first open, unblocked, unassigned ticket.

**One thing this phase is not.** It is not a bug fix. The count model works: `initiativeProgress` counts `done` alone, deliberately and with a comment saying why, and measured against the real ledger it answered *piece 5 — The board*, correctly. [timone#41](https://github.com/fvermaut/timone/issues/41) said otherwise, was wrong, and is closed. **Settledness is being removed because its only consumer goes away, not because it misbehaved** — and that distinction matters here, because a slice that sets out to "fix" working code will change behaviour nobody asked it to change.

**The dangerous part is the ticket creation.** Opening fourteen issues is the first thing this system does that is loud, external and not undoable by re-running it. A retry that opens fourteen more is worse than a failure. Idempotence is therefore a property of slice 29c and is asserted, not assumed.

**The daemon runs against real projects while this is built.** `scratch-app` is the fixture ([live projects are not guinea pigs](../../adr/)); every live exercise runs there, and every ledger exercise runs against a copy driven by `--state`, never `.timone/state.json`.

## Context & Prerequisites

- **`src/daemon/breakdown.ts`** — `chunkProgress` (line 281) and `ChunkProgress` (256). `parseBreakdown`, the stamp and `isReproposal` all stay: the file and its gate are untouched.
- **`src/daemon/runs.ts`** — `SETTLED` (73), `isSettled` (76), its use in `register` (593). `TERMINAL` (45) **stays and is not to be conflated with it** — it answers whether a run's hold on its project is over, and a failed run must still free the project.
- **`src/daemon/poll.ts`** — `initiativeProgress` (1786) and the second call site (1884). Both currently count `done`.
- **`src/daemon/cta.ts`** — `InitiativeProgress` (43) extends `ChunkProgress`; the call-to-action text between steps reads from it.
- **`src/adapters/ticketing.ts`** — the GitHub seam. **Check first whether it can create an issue and set a parent**; if it cannot, 29c's first act is to add that, and this is the likeliest place the phase grows.
- **`src/commands/status.ts`** (or wherever `timone status` renders) — it must name the live step ticket and what remains.

## Sub-phases

### Sub-phase 29a: The frontier query — which step is next, from tickets

**[NEW FILE]** `src/daemon/steps.ts` — `nextStep(steps): Step | undefined`, pure. Given the initiative's step tickets — number, title, state, assignee, declared dependencies — return the first that is **open, unblocked and unassigned**. A step depending on an open step is not eligible.

**Seams under test (TDD):** `nextStep` is the seam — pure, no I/O. Red-green: (1) all open, none blocked → the first in order; (2) the first closed → the second; (3) a step whose dependency is open is skipped even when it sorts first; (4) a step whose dependency is **closed** is eligible; (5) an assigned open step is skipped; (6) every step closed → `undefined`, the close-the-initiative signal; (7) a dependency cycle does not hang — it returns `undefined` and says so, rather than looping.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
npm run build && npx vitest run src/daemon/steps.test.ts
```

- [ ] Red→green trace for all seven cases, each seen failing first
- [ ] Case (7) is asserted with a real cycle, not a comment claiming it cannot happen

---

### Sub-phase 29b: Reading an initiative's step tickets

**[MODIFY]** `src/adapters/ticketing.ts` — list the child tickets of an initiative and their state, assignee and declared dependencies.

**Seams under test (TDD):** the adapter function, against recorded fixtures rather than the network. Red-green: (1) children are returned in the breakdown's order, not the tracker's; (2) a child whose dependency line is absent is unblocked, not malformed; (3) an unreadable dependency reference is reported, never silently treated as unblocked — a step that should have been held back and was not is the failure mode ADR-0040 names as the one to watch.

> No dependency on 29a — different files — so 29a and 29b may run in parallel.

#### Agent Validation Steps

```bash
npm run build && npm test -- ticketing
```

- [ ] Red→green trace for all three cases
- [ ] No test in this slice reaches the network

---

### Sub-phase 29c: Approval opens one ticket per step — idempotently

**[MODIFY]** the breakdown approval path — on the reply that stamps `Approved` and merges chunk zero, open one ticket per step as a child of the initiative's ticket, each carrying its line, a link to the breakdown, and its declared dependencies. Rewrite the initiative's ticket body to be a map of its children.

**Idempotence is the deliverable, not a nicety.** Re-running approval, or a retry after a partial failure, must **not** open a second set. Match on the initiative and the step's position, and create only what is missing.

**Seams under test (TDD):** the creation function, against a fake ticketing adapter that records calls. Red-green: (1) fourteen steps on a clean initiative → fourteen creations, in order; (2) **running it again → zero creations**, seen failing first against a naive implementation; (3) a partial failure at step 7 then a re-run → exactly the missing seven; (4) each created ticket carries its dependency; (5) the initiative's body becomes a map linking all of them.

> Depends on 29b.

#### Agent Validation Steps

```bash
npm run build && npm test -- steps
```

- [ ] Red→green for all five, and case (2) demonstrated red against a version without the guard
- [ ] No test in this slice creates a real issue on any repository

---

### Sub-phase 29d: The daemon takes the next step ticket

**[MODIFY]** `src/daemon/poll.ts` — `initiativeProgress` and the second call site read step tickets through 29a/29b instead of counting runs. **[MODIFY]** `src/daemon/cta.ts` — `InitiativeProgress` stops extending `ChunkProgress`.

**Seams under test (TDD):** `initiativeProgress`, against ledger copies. Red-green: (1) an initiative with steps 1–2 closed reports step 3 next; (2) a cancelled run against an open step leaves that step next — the case ADR-0029's count handled by excluding `cancelled`, now handled by the ticket simply still being open; (3) a `failed` run still opens no new step and `timone retry` re-arms in place, R22 clause 2 unchanged; (4) an initiative with every step closed reports none.

> Depends on 29a, 29b.

#### Agent Validation Steps

```bash
npm run build && npm test -- poll
```

- [ ] All four red→green; case (3) is the regression guard on clause 2 and must be run against the pre-change behaviour too
- [ ] `--state` used throughout; `.timone/state.json` is never opened by a test

---

### Sub-phase 29e: Closing — the step, then the initiative

**[MODIFY]** the merged-pull-request path — a merged PR closes **its step ticket**, linking it. When no step ticket remains open, close the **initiative** with a comment linking every pull request.

**Seams under test (TDD):** red-green: (1) a merge closes the step ticket and not the initiative; (2) the last merge closes both; (3) an initiative with an open step is not closed even when the merged step was last in the file — order in the file is not the same as doneness.

> Depends on 29a, 29b, 29d.

---

### Sub-phase 29f: `timone status` shows which step is live

**[MODIFY]** the status renderer — name the live step ticket and how many remain.

**Seams under test (TDD):** the renderer, red-green on the two states: a live step, and an initiative between steps.

> Depends on 29d.

**This is the one thing #41 was right about, even though its defect was not real.** Nothing has ever *displayed* which step the daemon thinks is next; I misread the model for a day because the only way to see it was to run the function by hand. A wrong pointer would still be invisible after this phase without it.

---

### Sub-phase 29g: Delete settledness

**[MODIFY]** `src/daemon/runs.ts` — remove `SETTLED`, `isSettled` and its use in `register`. **[MODIFY]** `src/daemon/breakdown.ts` — remove `chunkProgress` and `ChunkProgress`.

**Deliberately last.** Everything above must be green first; deleting the old path before the new one carries the traffic is how a working system is broken on the way to a better one.

**`TERMINAL` stays.** It answers a different question and a failed run must still free its project.

**Seams under test (TDD):** no new behaviour — the seam is the existing suite staying green. Declare no new seams and say so.

> Depends on every preceding sub-phase.

#### Agent Validation Steps

```bash
npm run build && npm test
```

- [ ] The full suite is green
- [ ] `grep -rn "SETTLED\|isSettled\|chunkProgress" src --include="*.ts"` returns nothing; `echo "exit: $?"` reports **1**
- [ ] `grep -rn "TERMINAL" src --include="*.ts"` still returns its call sites — the deletion did not take the neighbour with it

---

### Sub-phase 29h: The live gate, on `scratch-app`

Break a fixture specification into three steps, approve the breakdown once, and read it end to end: three child tickets opened, the map ticket carrying links and nothing else, each step building on its own branch with its own pull request, each closing on its merge, the initiative closing on the last.

> Depends on every preceding sub-phase.

- [ ] **Human gate:** fvermaut reads the three tickets and the map, and says whether the thread is now followable — which is the entire point of ADR-0040 and the only thing no test can assert

---

### Sub-phase 29i: Close the phase

**[MODIFY]** `STATUS.md`, and the R22 marker with what was actually built.

## Dependency graph

```
29a → (none)              the frontier query, pure
29b → (none)              reading step tickets — parallel with 29a
29c → 29b                 approval opens the tickets, idempotently
29d → 29a, 29b            the daemon takes the next step ticket
29e → 29a, 29b, 29d       closing the step, then the initiative
29f → 29d                 status shows which step is live
29g → 29a…29f             delete settledness — deliberately last
29h → 29a…29g             the live gate on scratch-app
29i → 29a…29h             close
```
