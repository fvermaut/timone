# PRD-03: A run ends at its pull request

> **Status:** Draft
> **Project:** timone — see [product-overview.md](../product-overview.md)
> **Criteria register:** [prd-03-a-run-ends-at-its-pull-request.criteria.md](prd-03-a-run-ends-at-its-pull-request.criteria.md)
> **Phases:** none yet

## Problem

Machine-driven work stops on the human too often, and the stops carry no judgement worth having. Ticket [timone#99](https://github.com/fvermaut/timone/issues/99) is the record: three interventions on one small bug fix. The first was "go ahead" on a plan correction the machine had already decided was not a decision. The second was a request to waive a check the machine could not run. The third was the machine refusing the answer to its own question and demanding a terminal command instead. fvermaut's judgement of the episode, from the requirements interview of 2026-09-05: the interventions were "just to unblock and say yes go ahead, without even really understanding what was going on".

Each stop also holds the project: nothing else runs on it while a run waits for an answer. So a stop that buys no judgement costs twice — the human's attention and the queue's time.

The interview resolved the direction: stop stopping. The human's judgement is real in two places — agreeing to what will be built, and merging what was built. Everything between those two points should run in the dark, and everything the machine had to bend on the way should surface at the second point, the pull request, where the human already is.

## Goals

- A normal run touches the human exactly twice: agreeing to the work, and merging its pull request. Both are real decisions.
- The machine never judges whether its own work "stands". It shows everything, at the one place the human judges.
- The queue always moves: no run in the build ever sits waiting for a person.
- Every question the process still asks, at the stops that remain, is one a typed reply can resolve.

## Scope

### In scope

**One ending.** From the moment a run enters the build — after the last human agreement, which is the approved list of pieces, or the triage record for a chore — it has exactly one ending: a pull request (R1). It never parks, never posts a question, never waits. When a step hits something it cannot do as written — a plan step that turns out wrong, a requirement the built behaviour contradicts, a check its machine cannot run, a workaround it had to take — it writes the departure down, adapts, and carries on. Even a run whose tests are still failing after its retries opens its pull request, saying so first-thing.

**The pull request opens on what was bent.** The first thing the body says is what changed on the way and what could not be checked (R2): plan amendments, requirement amendments, checks not run, workarounds, a failing state if there is one — or that nothing was bent. Merging accepts every listed item. Closing the pull request without merging rejects the work whole: nothing is patched in place, and the rejection re-enters as a new request — remediation.

**Amendments carry their marks.** During the build, the machine may amend the plan and the requirements it is building against, on its own authority, on the work branch, each amendment dated and naming its run (R3). The merge ratifies them; a closed pull request discards them with its branch.

**A screen is shown at the pull request, not before.** Work that builds or changes a user-facing screen no longer waits for anyone to look at the screen before its pull request opens. The pull request carries the preview address and the built-versus-reference comparison first-thing, and merging is the "yes, I have seen it" (R4). This deliberately reverses the earlier rule that held the pull request back until the screen had been viewed.

**A question must be answerable.** At the stops that remain — the interviews, the requirements approval, the approval of the list of pieces — a stage may only ask a question the machinery can act on the answer to (R5). A typed reply always moves the work. Answering a reply with "run this command instead" is a defect.

### Out of scope

- **An agent that answers for the human.** Considered in the interview and rejected: it would rubber-stamp the one gate that matters. The fix is removing the stops, not automating the yes.
- **Draft pull requests as a third state.** A red run opens an ordinary pull request that says it is red.
- **Changing the agreements before the build.** Requirements approval and the approval of the list of pieces stay exactly as they are, takeover included.
- **Patching a rejected pull request in place.** Rejection is remediation — a fresh cycle — always.
- **Changing how a project is held.** One pull request in flight per project, the run holding it until merge or close, stays as it is (PRD-02.R10): the human's merge paces the pipeline, by design.

## Open Questions

None. The interview of 2026-09-05 resolved every branch, and the trade-offs accepted with it are recorded in the requirements below.
