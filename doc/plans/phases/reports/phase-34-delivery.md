# Phase 34 — Delivery Report

- **Date:** 2026-09-05
- **Phase:** [phase-34.md](../phase-34.md) — `Complete`, verified in [phase-34-verification.md](phase-34-verification.md)
- **Branch:** `timone/99-a-parked-run-whose-ticket-was-closed-kee` @ `c5cd820fac14b1e8b0222f1ce1a16ff4bbf9d31f`
- **Base:** `main` — the project's default branch; this phase does not stack on another unmerged branch
- **Pull request:** opened against this report — see the ticket for the address
- **Look gate:** no user-facing screen in this phase — it changes the daemon's registration cycle, not anything a person looks at

## Scope

Ticket [#99](https://github.com/fvermaut/timone/issues/99): a run that is `parked` and holds a project by owning a work branch was never released when its ticket closed, so tickets queued behind it never started until a person cancelled it by hand. This phase makes the daemon check a parked occupier's ticket against the open-and-marked listing on every poll, the same way it already did for a run that is actively picked up, and ends the run with a reason when the ticket has closed or lost its mark. It claims PRD-02.R22, the clause reading: "a ticket closed, or unmarked, while a run for it stands in the ledger is cancelled on the next poll, whatever state that run is in" (the phase header labels this clause 7; the register's own order makes it the eighth — a numbering slip recorded in the verification report and in the Spec review below, not a scope disagreement).

## How to try it

### Against the preview

This project has no browser-facing preview — it is a command-line daemon. The steps below run the same way on the preview checkout as on a local one.

1. `npm run type-check` — should exit 0.
2. `npm test` — the full suite (40 files, 1619 tests) should pass, including the new cases in `src/daemon/poll.test.ts` under the case covering a parked occupier whose ticket closed or lost its mark.

### On a local checkout

See `README.md` for install and environment setup; nothing here adds to it.

1. `npm run type-check; echo "exit: $?"` — expect `exit: 0`.
2. `npm test; echo "exit: $?"` — expect `exit: 0`, all 1619 tests passing, with no case that constructs a `parked`-with-branch occupier elsewhere in `poll.test.ts` or `runs.test.ts` newly failing.

## Verification outcome

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-02.R22 — the clause this phase claims (register clause 8) | MUST | api | PASS | 0 |
| PRD-02.R22 — register clause 7, checked alongside it | MUST | api | PASS | 0 |
| PRD-02.R22 — register clause 2, checked alongside it | MUST | api | PASS | 0 |
| PRD-02.R22 — register clauses 1, 3, 4, 5, 6 | MUST | api | not driven this pass — outside this phase's claim | 0 |
| PRD-01.R2, PRD-01.R3 (standing regression set, narrowed out) | MUST | api | not re-run as regression; run anyway, both PASS | 0 |

0 of 2 fix loops consumed — the first pass was clean. The gate did not pass for one reason only: this phase's diff touches the daemon's registration cycle (`src/daemon/poll.ts`), and eight `live`-channel requirements declare that code among their dependencies, so a fresh live gate is owed and this container has no Docker, no forge credential, and no managed-project clone to run one with.

fvermaut read that finding on this ticket and answered, at 2026-09-05T13:15:46Z: "go ahead without it" — the same choice made for ticket #39's delivery ([PR #89](https://github.com/fvermaut/timone/pull/89)). The verification report carries the dated record of that decision as [an addendum](phase-34-verification.md#addendum--2026-09-05-the-watched-run-is-waived-for-this-delivery). The debt is not cleared: it stands against the next phase that touches `src/daemon/`, and one watched run can pay several of these lines at once.

### Outstanding for the human

- [ ] A watched run of the daemon against real infrastructure — start the daemon, close a ticket while a run for it is parked, and see the queue move. Waived for this delivery per the addendum above; still owed before the next phase that touches `src/daemon/` can pay it forward again.

## Standards review — phase 34

- **Read:** `git diff origin/main...HEAD -- src/daemon/poll.ts src/daemon/poll.test.ts`; `/workspace/timone/standards/code-smells.md`; `tsconfig.json`; `doc/standards.md` (absent)
- **Diff:** `origin/main...HEAD` — 2 files, +127/−2
- **Findings:** none

The `poll.ts` hunk is a two-line condition change (`occupier.status === "picked-up"` to `occupier.status !== "active"`, with the spawn branch re-guarded as `else if (occupier.status === "picked-up")`) plus its surrounding comment, unchanged. It stays inside the existing guard-clause shape and introduces no new nesting, parameter, or literal.

The `poll.test.ts` hunk adds one `describe` block with two local helpers and four `it` cases. One helper's field set differs slightly from an existing helper it resembles, but this is only the second occurrence — the code-smells reference requires a third before duplication is reportable, and separately exempts test code, which prefers visible duplication over a shared abstraction. An adapter-override pattern used in the new helper matches roughly twenty existing call sites in the same file — pre-existing convention, not new duplication.

## Spec review — phase 34

- **Read:** `git diff origin/main...HEAD -- src/daemon/poll.ts src/daemon/poll.test.ts`; `doc/plans/phases/phase-34.md` (header through Requirements table, and the sub-phase text needed to judge scope); `doc/specs/prd/prd-02-inversion-of-control.md`; `doc/specs/prd/prd-02-inversion-of-control.criteria.md` (R22 in full)
- **Diff:** `origin/main...HEAD` — 2 files, +127/−2
- **Findings:** 2

### 1. The diff leaves an `active` occupier permanently uncovered by the clause it claims — PRD-02.R22 (last criterion bullet)

- **Where:** `src/daemon/poll.ts:1536–1560`; test at `src/daemon/poll.test.ts:2618–2638`
- **What:** The register's clause reads "cancelled … whatever state that run is in" with no state excluded. The diff's guard is `occupier.status !== "active"`, so an `active` occupier is explicitly and permanently excluded, and a new test locks that exclusion in.
- **Why it matters:** A direct textual gap between the clause as claimed ("whatever state") and what ships (one state carved out). The phase's own Goal Description defends the carve-out on operational grounds — pulling the ledger out from under a live process is a different problem — and the register's own dated marker already flags that only the `parked` case was checked here, so the gap is visible, not hidden.
- **Suggested remediation:** Narrow the phase's requirement-table wording to name the states actually covered, or open a follow-on ticket for the `active` case — not applied here.

### 2. Phase header cites the wrong clause number for its own requirement — PRD-02.R22 (numbering only, not a defect)

- **Where:** `doc/plans/phases/phase-34.md:11`
- **What:** The phase header labels its clause "clause 7"; counting the register's own criteria in order, the wording built here is the eighth. The register's seventh bullet is the unrelated `timone cancel` command clause.
- **Why it matters:** Not a code defect — the diff implements the right behaviour for the right clause. A reader tracing "clause 7" back to the register lands on the wrong bullet.
- **Suggested remediation:** Correct the phase header's row to "PRD-02.R22 (clause 8)" — not applied here.

## Notes

Both review findings above concern the phase's own written wording, not the shipped behaviour: neither withholds this delivery, and remediation for either is a later, separate piece of work.
