# PRD-03 Acceptance Criteria — A run ends at its pull request

> Formal register for [prd-03-a-run-ends-at-its-pull-request.md](prd-03-a-run-ends-at-its-pull-request.md).
> Maintained by: timone-prd (creation), timone-verify (status),
> timone-prd (revisions). Requirement IDs are stable — never renumber.

## R1 — The build has one ending: a pull request

> ✏ 2026-09-07: the [phase-35 live gate](../../plans/phases/reports/phase-35-live-gate.md) watched this on the scratch-app fixture. Clause 1 (adapt and carry on, no stop, reach a PR) passed, seen organically four times. Clause 2 (failing tests still open a PR) was never triggered — no run's own work failed — but delivery was watched opening a pull request with the test suite red (scratch-app#58, failures named), and the refuse-not-on-red mechanism is unit-tested in phase 35; the own-tests-red case remains owed a direct sighting. Clause 3 was found to **diverge**: the daemon parks the ticket and asks the human rather than re-entering the rejection on its own.
>
> ✏ 2026-09-07, decided by fvermaut ([timone#111](https://github.com/fvermaut/timone/issues/111)): clause 3 is **reworded to the stop-and-ask that exists**, rather than changing the code to re-enter automatically. The reworded clause matches what the gate observed, so it passes. R1 moves to `verified` on clauses 1 and 3; clause 2's own-tests-red case is the one thin spot, resting on the unit test and the partial sighting above.

> ✏ 2026-09-12 ([ADR-0055](../../adr/0055-a-universal-claim-is-not-established-by-watching.md) D2, via [timone#129](https://github.com/fvermaut/timone/issues/129)): **back to `draft`.** Nothing about this requirement changed and nothing observed on 2026-09-07 is withdrawn. What changed is that a status may no longer outrun its own notes, and the note directly above says clause 2's own-tests-red case "remains owed a direct sighting". A requirement carrying a clause nobody has seen hold is not established, and reading `verified` said it was.

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** live
- **Last live gate:** [phase-35-live-gate.md](../../plans/phases/reports/phase-35-live-gate.md) — 2026-09-07, clause 1 PASS, clause 3 PASS (reworded to observed behaviour), clause 2 mechanism unit-tested + delivery seen opening on a red suite, own-tests-red case owed a direct sighting
- **Depends-on:** `src/daemon/, .claude/skills/timone-execute/, .claude/skills/timone-verify/, .claude/skills/timone-deliver/`
- **Criteria:**
    - GIVEN a run past its last human agreement (an approved list of pieces, or a chore's triage record)
      WHEN any later step hits something it cannot do as written — a wrong plan step, a contradicted requirement, a check it cannot run, a needed workaround
      THEN it records the departure, adapts, and carries on; the run posts no question, enters no waiting state, and reaches a pull request
    - GIVEN build retries are exhausted and tests are still failing
      WHEN the run continues
      THEN the pull request still opens, and its body says first-thing that the work does not pass its own tests
    - GIVEN a pull request from a run is closed without merging
      WHEN the next poll cycle completes
      THEN nothing further is committed to that branch and the requirements on the default branch are unchanged, and the run stops rather than restarting on its own: the ticket is marked held and a comment asks the human which of three things the close meant — the work is unwanted (close the ticket), it should be built again from scratch (remove the held label), or the close was a mistake (reopen and merge the pull request by hand)
- **Verification hint:** on the fixture project, drive one run into a plan contradiction and one into exhausted retries; watch both reach a pull request with no waiting state in `timone status` and no question on the ticket. Close one PR unmerged and watch the ticket park with the held label and a comment offering those three choices — no new commits on the closed branch, and the default branch's requirements unchanged.

## R2 — The pull request opens on what was bent

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** live
- **Last live gate:** never
- **Depends-on:** `src/daemon/, .claude/skills/timone-deliver/`
- **Criteria:**
    - GIVEN a run in which anything departed from what was agreed — a plan amendment, a requirement amendment, a check not run, a workaround, a failing state
      WHEN its pull request opens
      THEN the body's first section lists every departure, each naming what was agreed, what was done instead, and why
    - GIVEN a run in which nothing departed
      WHEN its pull request opens
      THEN the body's first section says so explicitly rather than being absent
- **Verification hint:** read the PR bodies produced by R1's two driven runs: the departure section must be the first content in both, and a clean fixture run's PR must open with the explicit "nothing was bent" statement.

## R3 — Mid-build amendments carry their marks

> ✏ Revised 2026-09-06 by fvermaut (interactive session, ticket [timone#105](https://github.com/fvermaut/timone/issues/105)): `Verify-via` changed from `api` to `live`. The criterion describes what an agent does while building; its only dependencies are two instruction files with no code behind them, and its own hint presupposes a driven run. Both verification passes found it unverifiable from a terminal — the account is in [phase-35-verification.md](../../plans/phases/reports/phase-35-verification.md). Clauses unchanged.

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** live
- **Last live gate:** [phase-35-live-gate.md](../../plans/phases/reports/phase-35-live-gate.md) — 2026-09-07, PASS (watched in scratch-app#53 and #56: dated amendments naming the run, original wording readable, merged amendments stand and closed ones died with the branch)
- **Depends-on:** `.claude/skills/timone-execute/, .claude/skills/timone-verify/`
- **Criteria:**
    - GIVEN a build step that amends the plan or the requirements it is building against
      WHEN the amendment is made
      THEN it is committed on the work branch with a dated marker naming the run that made it, and the original wording stays readable in place
    - GIVEN the pull request is merged
      THEN the amendments land with it and stand ratified; GIVEN it is closed unmerged, THEN the amendments die with the branch and the requirements on the default branch are unchanged
- **Verification hint:** inspect the work branch after a driven amendment: the plan or register diff must show a dated marker naming the run. Diff the default branch before and after a rejected PR: requirement files identical.

## R4 — A screen is shown at the pull request, not before

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** live
- **Last live gate:** never
- **Depends-on:** `src/daemon/, .claude/skills/timone-deliver/`
- **Criteria:**
    - GIVEN a completed run that built or substantially changed a user-facing screen
      WHEN delivery runs
      THEN the pull request opens without any prior human viewing of the screen, and its body carries first-thing — alongside R2's departures — the preview address and the built-versus-reference comparison
- **Verification hint:** drive a fixture run with a screen change end to end; confirm no viewing request appears anywhere on the ticket before the PR exists, and the PR body opens with the preview link and the comparison.

## R5 — No question without the power to act on its answer

> ✏ 2026-09-12 ([ADR-0055](../../adr/0055-a-universal-claim-is-not-established-by-watching.md) D1, via [timone#129](https://github.com/fvermaut/timone/issues/129)): **back to `draft`, and this one was falsified in the field.** On [ivtrends#90](https://github.com/fvermaut/ivtrends/issues/90) a typed reply of `aprrove` was redirected to a command, which is the exact FAIL this criterion's hint names. The live gate below was not careless — it watched many rounds and every one of them held. The claim is a universal, and watching establishes the paths it walks: nobody typed a misspelling. [ADR-0054](../../adr/0054-an-ask-check-stands-in-front-of-every-question-put-to-a-person.md) built the repair, and this stays `draft` until a check that can go red stands behind it, per D1.

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** live
- **Last live gate:** [phase-35-live-gate.md](../../plans/phases/reports/phase-35-live-gate.md) — 2026-09-07, PASS (watched across many rounds on scratch-app#50 and #51: every typed reply moved the work; two granted unusual answers — a scope trim and a removed behaviour — and both were acted on; no reply was redirected to a command)
- **Depends-on:** `src/daemon/, .claude/skills/`
- **Criteria:**
    - GIVEN a ticket waiting on a question the process asked
      WHEN the human posts a typed reply
      THEN the next cycle acts on it — the work moves, or the one bounded clarifying round runs — and at no point is the human told their reply cannot be acted on or redirected to a command instead
- **Verification hint:** answer a waiting fixture ticket in writing, including with an answer that grants something unusual (a waiver, a scope trim); the reply must move the work. Any "run this command" response to a typed answer is a FAIL.
