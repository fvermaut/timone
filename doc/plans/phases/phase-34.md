# Phase 34: A parked occupier is cancelled the same way a picked-up one is

> **Status:** Planned.

> **Companion phases:** none — first phase to touch this part of the registration cycle since [phase 22](phase-22.md)'s 22b wrote it. Governing decision: [ADR-0026](../../adr/0026-a-ticket-is-a-conversation-a-run-is-a-chunk.md) — the chunk, not the ticket, holds the project, which is why a parked run can hold one at all and why cancelling it is what frees the queue behind it.

## Requirements

> **PRD:** [prd-02-inversion-of-control.md](../../specs/prd/prd-02-inversion-of-control.md)
> — criteria in [prd-02-inversion-of-control.criteria.md](../../specs/prd/prd-02-inversion-of-control.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-02.R22 (clause 7) | MUST | A ticket closed, or unmarked, while a run for it stands in the ledger is cancelled on the next poll, whatever state that run is in |

Clause 7 names no run status — "a run for it stands in the ledger" covers whatever the ledger admits, which clause 6 spells out as "queued, parked, active or failed". [Triage 002](../../triage/002-parked-occupier-outlives-closed-ticket.md) reads the built code against that wording: the registration cycle already does this for a `picked-up` occupier (`poll.ts:1536-1560`), and a `parked` occupier — a run waiting on a conversation or a review, holding its project because it owns a work branch (`runs.ts:689-693`, `runs.ts:1938-1941`) — never reaches the check. That is the gap [timone#99](https://github.com/fvermaut/timone/issues/99) saw live: ticket #39's run sat `parked` after its pull request merged and its ticket closed, and nothing cancelled it, so #91 and #92 queued behind a dead run until a human ran `timone cancel` by hand.

## Goal Description

This is a one-file bug fix against an already-agreed requirement, not new design. The registration cycle in `pollProject` (`src/daemon/poll.ts`) reads the project's occupier once per cycle and decides what to do with it: `store.promoteQueue` runs first, then `store.occupyingRun` reads whichever run now holds the project — `picked-up`, `active`, or `parked` while it owns a branch, per `holdsProject` (`runs.ts:1938-1941`). Today only the `picked-up` branch is checked against the cycle's ticket listing; a `parked` occupier is read but never compared against it, so a ticket closing under a parked run is invisible to this check for as long as the run stays parked — which, per the ticket, can be indefinitely, because nothing else resolves a conversation park that nobody comments on.

The fix extends the existing check to a `parked` occupier: when its ticket is no longer in the cycle's listing, cancel it exactly as a `picked-up` occupier in the same position is cancelled — same `noLongerListedReason()`, same `store.cancel`, no session spawned. An `active` occupier is deliberately left alone, as it already is today: a session is running, there is nothing to spawn, and pulling the ledger out from under a live process is a different problem this phase does not touch. A `parked` occupier whose ticket is still listed is also left alone here — resolving its wait is `resumeAnswered`'s job, which already ran earlier in the same cycle (`poll.ts:1529`), and this check only ever fires after it.

This does not clear the ADR bar. The change is easily reversible (one conditional), unsurprising (the register already states the behaviour for every ledger status, and the code is what lags it), and there is no trade-off between competing designs — the only question was which existing mechanism to extend, and clause 7's own wording answers it. No ADR is written for it.

One sub-phase carries the whole of this phase: one condition in one function, and the seam that exercises it is the same `pollOnce` entry point every other test in `poll.test.ts` already drives.

## Context & Prerequisites

- **`src/daemon/poll.ts:1531-1560`** — the registration-cycle check this phase edits. `store.promoteQueue(project.name)` runs, then `const occupier = store.occupyingRun(project.name)`, then `if (occupier !== undefined && occupier.status === "picked-up")` branches into cancel-if-ticket-gone or spawn. The `else` (spawn) branch, and the comment block explaining "before the spawn, never after it", stay exactly as they are — only the condition that decides which occupier statuses get the ticket-gone check widens.
- **`src/daemon/runs.ts:1938-1941`** — `holdsProject`, which is what `occupyingRun` filters by: `RUNNING.includes(run.status)` (`picked-up`, `active`) or `run.status === "parked" && run.branch !== undefined`. This is the exhaustive list of statuses `occupier` can ever hold in the code this phase touches — there is no fourth case to handle.
- **`src/daemon/poll.ts:544-548`** — `noLongerListedReason()`, already generic across statuses; no change needed.
- **`src/daemon/poll.ts:2000`** (`resumeAnswered`) — runs earlier in the same cycle (`poll.ts:1529`, before `promoteQueue`) and is where a parked run's wait is resolved when its ticket is still open. This phase's check runs after it and only ever fires once that path has already found nothing to resume the run into.
- **`src/daemon/poll.test.ts:2412-2480`** (`describe("a ticket closed while its run waited its turn"`) — the existing test group and helper (`queuedBehind`) covering the `picked-up`-occupier and queued-run cases; the new tests for a `parked` occupier are a sibling group in the same file, reusing `newStore`, `fakeAdapter`, `fakeSpawner` and `noLongerListedReason` already imported there.
- **`doc/triage/002-parked-occupier-outlives-closed-ticket.md`** — the routing record; read for the exact code paths it names and the wording of clause 7 it quotes.

## Sub-phases

### Sub-phase 34a: A parked occupier's closed ticket is cancelled, not left holding the queue

**[MODIFY]** `src/daemon/poll.ts` — widen the registration-cycle check at `poll.ts:1536` so a `parked` occupier is compared against the cycle's ticket listing exactly as a `picked-up` one is, and cancelled the same way when its ticket is gone. `active` is left out of the widened condition, unchanged from today. One correct shape (not the only one — pick whichever reads clearest against the existing comment block, which stays):

```ts
const occupier = store.occupyingRun(project.name);
if (occupier !== undefined && occupier.status !== "active") {
  if (!tickets.some((candidate) => candidate.number === occupier.ticket)) {
    const reason = noLongerListedReason();
    store.cancel(occupier.id, reason);
    result.cancelled.push(occupier.id);
    log(`cancel ${occupier.id} — ${reason}`);
  } else if (occupier.status === "picked-up") {
    // existing spawn branch, unchanged
  }
}
```

**[MODIFY]** `src/daemon/poll.test.ts` — add the red-green cases below as a sibling `describe` near the existing `"a ticket closed while its run waited its turn"` group (`poll.test.ts:2412`).

**Seams under test (TDD):** `pollOnce` is the seam — the same public entry point every test in this file drives, and the one the ticket's own acceptance language ("no session is spawned for it, asserted on the spawn itself") points at. Red-green:

1. A `parked` occupier holding its project — registered, `activate`d, `claimBranch`ed, then `park`ed, the same sequence `poll.test.ts:6034`'s `escalated` helper already builds for an escalation wait — whose ticket is **still** in the cycle's marked-open listing: after a poll, the run's status is unchanged (`parked`), nothing is cancelled, and the fake spawner records no call for it. Guards the legitimate wait (ADR-0031/ADR-0033/ADR-0046) against regression. (Note: `poll.test.ts:960-994`'s legacy fixture is a parked run with **no** branch — it does not hold its project at all, per `holdsProject`, and is the wrong shape for this case; it is cited here only to flag the distinction, not as a pattern to copy.)
2. The same parked, branch-holding occupier, whose ticket is **not** in the cycle's listing (closed or unmarked): after a poll, the run's status is `cancelled`, its `cancellation` equals `noLongerListedReason()`, and the fake spawner is never called for it.
3. A second ticket queued behind that same parked occupier: `store.cancel` settles the chunk it lands on (ADR-0029), and settling a chunk is one of the two events `RunStore.transition` promotes the queue head on — so the moment the cancel above lands, in the *same* poll, the queued run's own status already reads `picked-up`, not `queued`. What does not happen in that same poll is a spawn for it: this check read `occupier` before the cancel ran and never re-reads it, so nothing is asked to start until a **later** poll finds that same run already `picked-up` and spawns it. Net effect matches [timone#99](https://github.com/fvermaut/timone/issues/99)'s report by hand (`timone cancel`, then the next cycle started #91) — nothing spawns early — but the run's own status in the ledger moves a full poll sooner than that reads, and the case is written against the status, not just the spawn.
4. An `active` occupier whose ticket is no longer listed: unchanged from today — no cancellation, no spawn attempt, confirming the widened condition did not reach the status this phase deliberately leaves alone.

> ✏ **Corrected 2026-09-05, after building stopped over case 3.** It first said the queued run "is still `queued`" right after the cancel, in the same poll, and only becomes `picked-up` on the next one. That is wrong: `store.cancel` settles the chunk (ADR-0029), and settling is one of the two events `RunStore.transition` promotes the queue head on — so the queued run already reads `picked-up` in the *same* poll the cancel runs in. What still waits for the next poll is the spawn, not the promotion, because this check reads `occupier` before the cancel and never re-reads it. Case 3 above is corrected to assert the status change where it actually happens.

> No dependency on other sub-phases — the only sub-phase in this phase.

#### Agent Validation Steps

```bash
cd /workspace/timone/projects/timone
npx vitest run src/daemon/poll.test.ts; echo "exit: $?"
npm run type-check; echo "exit: $?"
npm test; echo "exit: $?"
```

- [ ] The four red-green cases above are present in `poll.test.ts` and each was seen red before the `poll.ts` change and green after — recorded in the handoff, not just a final green run.
- [ ] `npm run type-check` exits 0.
- [ ] The full suite (`npm test`) is green, with no case that constructs a `parked`-with-branch occupier elsewhere in `poll.test.ts` or `runs.test.ts` newly failing.
- [ ] `git grep -n 'occupier.status === "picked-up"' src/daemon/poll.ts` no longer matches the registration-cycle check at the old line (it still may match unrelated code elsewhere, if any — read each hit rather than asserting zero).
- [ ] **Human gate:** none — this is a bug fix against an already-agreed MUST clause; the judgement it owes lands on its pull request.

## Dependency graph

```
34a → (none)   the whole of this phase — one condition, one file, one test group
```
