# Phase 29 — Complete

> **One step, one ticket.** Built and closed 2026-08-21, on `phase-29-one-step-one-ticket`. Slice-by-slice detail is in [phase-29-handoffs.md](phase-29-handoffs.md); this file is what the phase delivered, what it proved, and what it did not.

## What changed

A job used to be one ticket with a sequence of runs behind it, and *which piece is next* was counted from the ledger. `ivtrends#1` reached 73 comments because one thread carried fourteen pieces of separate business.

Now approving a breakdown opens **one ticket per piece**. The job's own ticket becomes a map: a list of links and nothing else. Which piece is next is read from those tickets — the first that is open, not waiting on another, not held by the machine, and not taken by a person.

Ten slices:

| Slice | What it does |
|---|---|
| 29a | The rule that picks the next step. Pure, no I/O. |
| 29b | Reading an initiative's step tickets off GitHub. |
| 29c | Approval opens one ticket per step, and does nothing twice. |
| 29d | The daemon takes the next step, holds it, and writes down what it saw. |
| 29e | A merge closes its step; the last one closes the job. |
| 29f | `timone status` names the live step. |
| 29g | The counting is deleted. Settledness is kept. |
| 29j | A dropped step says how to start it again. |
| 29h | The live gate on `scratch-app`. |
| 29i | Glossary, manual, skill and register. |

**1224 tests**, up from 1138 at the start of the phase.

## What was watched, on `scratch-app`

A three-piece breakdown was approved on [#45](https://github.com/fvermaut/scratch-app/issues/45). Then:

- Three step tickets opened — [#46](https://github.com/fvermaut/scratch-app/issues/46), [#47](https://github.com/fvermaut/scratch-app/issues/47), [#48](https://github.com/fvermaut/scratch-app/issues/48) — in the approved order, each a child of #45.
- Each waits for the one before it, using GitHub's own `blocked by` relation.
- #45's body became a list of links, and it took the `timone:map` label.
- The daemon took **#46** and no other. It put `timone:held` on it.
- `timone status` printed `#46 (step 1 of 3 of #45)`.

**fvermaut read the four tickets and said they made sense.** That was the gate's whole question, and no test can answer it.

## What the gate found

Four faults. All fixed.

1. **The hold label was refused by GitHub.** Its description was 111 characters; the limit is 100. GitHub answered `HTTP 422: Validation Failed` and named no field. **No step ticket was opened at all.**
2. **The initiative's own run carried on into planning.** It spent nine and a half minutes of Opus, $4.86, planning the whole job on a ticket meant to hold only links. This is why fault 1 was invisible.
3. **The map said "This one is finished."** with nothing built. No step was *eligible* — the first was held, the other two were waiting — and the code read that as no steps left.
4. **A waiting step said "I'll pick this up on my next pass."** #47 waits on #46. It was not going to.

**Faults 3 and 4 were found by reading what the machine wrote.** Nothing in the test suite checks whether a sentence is true.

Cost of the gate: about $5, of which $4.86 was fault 2.

## What this phase did not prove

- **A step has never closed on its merge, and an initiative has never closed after its last step.** fvermaut chose to stop the gate at the tickets, so nothing was built through to a merged pull request. 29e is unit-proven and unwatched. The same is true of an initiative closing "13 of 14" with a dropped step.
- **Nothing ran under the machine's own identity.** The GitHub App exists, but nothing in this phase used it; every comment and commit still appears under fvermaut's account. That is phase 30's `30a`.
- **The daemon was run with `--once`, never left running.** No cycle-after-cycle behaviour was observed.

## Decisions taken during the phase

Recorded here because they were made inside slices, not in an ADR.

- **The breakdown file has no dependency field**, and the format has no room for one. So the approved order *is* the dependency: each step waits for the one before it. Nothing was invented and no artifact format changed. A person can delete one `blocked by` link on GitHub to let two steps run side by side — which nothing could express before. Widening the format so a piece can say *"9 needs 4 first"* is the alternative, was not taken, and is fvermaut's to ask for.
- **`MAP_LABEL` was added** and is not in the plan. Something has to keep the daemon off the initiative's own ticket, and a label costs no extra call and is visible to a person reading the tracker.
- **A dependency carries its own state**, rather than a number to look up. `blocked by` returns bare numbers and admits other repositories, so `timone#8` and `scratch-app#8` are indistinguishable by number. Looking one up would have matched a foreign ticket and answered confidently with the wrong state.
- **Settledness was kept.** ADR-0040 D3 ordered it deleted with the count; ADR-0044 corrects that, because `register` uses it to answer a different question. R22 clause 2 does not move.

## Defects filed against Timone

None. All four faults were found and fixed in the same session, so nothing is owed. The record is in this file and in [phase-29-handoffs.md](phase-29-handoffs.md).

One existing defect was made worse and reported rather than fixed: [timone#8](https://github.com/fvermaut/timone/issues/8) is no longer one flaky test but five, all timeouts, all shelling out to git, and the set varies per run. It fails identically with this phase's changes stashed.
