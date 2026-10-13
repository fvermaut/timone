# Phase 60 — Delivery Report

- **Date:** 2026-10-13
- **Phase:** [phase-60.md](../phase-60.md) — `Complete`, verified in [phase-60-verification.md](phase-60-verification.md)
- **Branch:** `timone/248-a-refused-ticket-waits-in-line` @ `f5082f1`
- **Base:** `main` — the branch was cut from the project's default branch at `534b4dd`.
- **Pull request:** opened against this report; its address is in the session's closing and in `STATUS.md`.
- **Screen:** no user-facing screen in this phase — [ADR-0052](../../../adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md), [ADR-0057](../../../adr/0057-every-screen-a-phase-changes-is-looked-at-and-its-figures-read-on-the-preview-data.md)
- **Questions for the human:** none.
- **Departures:** [phase-60-departures.md](phase-60-departures.md) — 2 entries.

## Scope

The work for the bugs [timone#248](https://github.com/fvermaut/timone/issues/248) and [timone#249](https://github.com/fvermaut/timone/issues/249). Requirements claimed: PRD-07.R2 (clause 3), PRD-07.R3, PRD-05.R1 (clause 1) and PRD-05.R18 (clause 2), in [prd-07-several-tickets-of-one-project-at-once.criteria.md](../../../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md) and [prd-05-a-runner-decides-each-step.criteria.md](../../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md).

- Recording an approval now asks for a place on the project before the approval is written, as a step does. When no place is free, nothing is written and the ticket waits in line; it is woken when a place is given to it (#248).
- The runner's brief says "This ticket waits for its turn." only when the ticket really waits for a place. A ticket that never asked is told it is not in line. The planner line says that starting the build asks the planner (#249).
- ADR-0063 D2 has a dated note on both.

## How to try it

### Against the preview

Timone has no preview configured for pull requests (`timone.yaml` gives it no `preview` binding). Use the local steps.

### On a local checkout

Setup is in the project's [README.md](../../../../README.md) (`npm install`, `npm run build`, `npm link`).

1. `git checkout timone/248-a-refused-ticket-waits-in-line && npm install && npm run build` — the build ends with exit 0.
2. `npx vitest run src/runner/actions.test.ts src/runner/session.test.ts src/runner/brief.test.ts` — every test passes. The new ones are under "recording an approval asks for a place on the project (ADR-0063 D2, #248)" in `actions.test.ts`, and the place and planner lines in `brief.test.ts` and `session.test.ts`.
3. `npm run --silent replay -- --dry` — the last line reads "24 of 24 cases passed. The runner's sessions cost $0.00 in all."
4. From a terminal logged in to the model: `npm run --silent replay` — it costs about $2 to $3, and the last line should read "24 of 24 cases passed." It ran twice on this branch, both 24 of 24 ([phase-60-replay.md](phase-60-replay.md)).
5. After merging, on the daemon: update and build the Timone folder the daemon runs from, and restart the daemon from your own terminal. Then, on a project whose places are all taken, answer "approve" to a request: the ticket should say it waits for its turn, and the approval should be written into its file when a place frees, with no new comment from you.

## Verification outcome

From [phase-60-verification.md](phase-60-verification.md) — 0 of 2 fix loops consumed.

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-07.R2 | MUST | api | PASS | 0 |
| PRD-07.R3 | MUST | api | PASS | 0 |
| PRD-05.R1 | MUST | api | BLOCKED — clause 1, the runner's own choice, needs a real model and has no replay case. Every part code does passes, and so does the runner's choice in clause 2 | 0 |
| PRD-05.R18 | MUST | api | PASS | 0 |
| PRD-05.R2, R3, R4, R5, R7, R10, R11 | MUST | api | PASS (regression) | 0 |
| PRD-07.R1, R4, R6, R9, R10, R12 | MUST | api | PASS (regression) | 0 |
| PRD-08.R2, R4, R5 | MUST | api | PASS (regression) | 0 |
| PRD-09.R2, R4, R5 | MUST | api | PASS (regression) | 0 |
| PRD-10.R2, R3, R4, R5, R6 | MUST | api | PASS (regression) | 0 |

Zero regressions. The closing gate is not met in one part: PRD-05.R1 clause 1.

### Outstanding for the human

- [ ] PRD-05.R1 — clause 1, the runner's own choice after sorting while another ticket holds the place: no replay case covers it. A new case is a new row in PRD-05.R18's table, which needs your yes ([phase-60-verification.md](phase-60-verification.md) § Carried forward).
- [ ] PRD-07.R5 — live gate owed (never gated): its steps are the criterion's verification hint in the PRD-07 register; [phase-40-live-gate.md](phase-40-live-gate.md) shows the form of a live gate report.
- [ ] PRD-07.R7 — live gate owed (never gated), as above.
- [ ] PRD-07.R14 — live gate owed (never gated), as above.
- [ ] PRD-05.R9, R12, R13, R15 — live gate owed (last: [phase-40-live-gate.md](phase-40-live-gate.md)): their steps are each criterion's verification hint in the PRD-05 register.
- [ ] PRD-04.R1 and PRD-08.R6 — live gate owed (never gated): their steps are each criterion's verification hint in its register.

## Standards review — phase 60

- **Read:** the diff `git diff origin/main...timone/248-a-refused-ticket-waits-in-line -- src/`; the parts of the six files around it: `src/runner/actions.ts` (lines 500–590 and 865–1220), `src/runner/session.ts` (lines 215–336 and 620–660), `src/runner/brief.ts` (lines 430–495), `src/runner/brief.test.ts` (lines 828–890), `src/runner/actions.test.ts` (the `placeWorld` helper at 1853 and the new block), `src/runner/session.test.ts` (the new tests, through the diff); `standards/typescript.md`, `standards/testing.md`, `standards/project-structure.md`, `standards/code-smells.md`; `tsconfig.json`, `package.json`, `vitest.config.ts`. The project has no `doc/standards.md`, so the three `standards/` entries above stand in as its conventions. There is no lint or format config (no ESLint, Prettier or Biome). The only tool check is `tsc` in strict mode. `project-structure.md` describes Next.js feature folders. It does not apply to this CLI's `src/runner/` layout, and the diff moves no files.
- **Diff:** `origin/main...timone/248-a-refused-ticket-waits-in-line`: 6 files, +322/−24
- **Findings:** 2

### 1. The rule "a session that takes a place asks for one first" is now copied into a second action: Duplicated code

- **Where:** `src/runner/actions.ts:1142–1147` and `src/runner/actions.ts:1192–1195`, copying `src/runner/actions.ts:897–900`, `914–915` and `1001–1004`
- **What:** `recordApproval` now repeats `startStep`'s place handling, piece by piece: it builds the same place order (`const turn = { priority: ticket.labels.includes(PRIORITY_LABEL), openedAt: ticket.createdAt };`), asks the same way (`const place = deps.store.askPlace(run.id, turn); if (!place.ok) return noPlace(place.holder);`), and has the same catch branch (`if (error instanceof NoPlaceError) { const again = deps.store.askPlace(run.id, turn); if (!again.ok) return noPlace(again.holder); }`). The new comment says so itself: "as in `startStep`". Each copy has four parts that must stay the same: the order, the ask, the refusal, and the second ask.
- **Why it matters:** This is Duplicated code in `code-smells.md`, through its "repeated one-liner counts" rule. The same decision is restated in every sibling that starts a session. By the rule of three, a second copy is tolerable. It is reported because the fault this diff fixes (#248) is that rule's own example: `recordApproval` was the sibling that forgot to ask. A third action that starts a session would have to remember all four parts again. The copy also makes `recordApproval`, already one of the longest functions in the file, longer still (Long function).
- **Suggested remediation:** Move "ask for a place, start the session, ask again on `NoPlaceError`" into one helper inside `runnerActions`. It would take the ticket and a function that starts the session, and return either the session or the `noPlace` refusal. Both `startStep` and `recordApproval` would call it. Not applied here.

### 2. The wake tells a place refusal from other refusals by the first words of its text, and the diff copies that check: Primitive obsession

- **Where:** `src/runner/session.ts:255–261`, copying `src/runner/session.ts:248–254`; the prefix is at `src/runner/session.ts:298–300`
- **What:** The new wrapper is a line-for-line copy of the `startStep` wrapper: `if (!result.ok && result.refused.startsWith(noPlaceRefusal(actionDeps.project.name))) { refusedForPlace = true; }`. The kind of refusal is read back from free text. `actions.ts` builds that text from `new NoPlaceError(...).message`, but `noPlaceRefusal` types its first words out by hand (`` `No place is free on ${project}:` ``). If the error's wording changes, both checks stop matching. Nothing fails at compile time, and the run leaves its turn again: the same fault #248 fixes. The doc comments on `noPlace` (`actions.ts:555–560`) and `noPlaceRefusal` (`session.ts:294–297`) still say "the refusal of a step", but the diff's own comments now call this "a try", which covers an approval too.
- **Why it matters:** This is Primitive obsession in `code-smells.md`: a string carries a domain fact, the reason for the refusal. `typescript.md` ("States are discriminated unions"; "Expected failures return `{ ok: false, error }`") expects the failure's kind to be data the type checker can see, not text read back with `startsWith`. The pattern was already there for `startStep`. This diff adds a second reader of the prefix, so the two copies are Duplicated code as well.
- **Suggested remediation:** Give the refused arm of `ActionResult` a tag for a place refusal (for example `{ ok: false; refused: string; noPlace: true }`, or a `kind` field). One wrapper, or a small shared function, would then check the tag for both actions, and `noPlaceRefusal` could be removed. Change the two doc comments to say "a try" rather than "a step". Not applied here.

## Spec review — phase 60

- **Read:** `git diff origin/main...timone/248-a-refused-ticket-waits-in-line -- src/`; the six files around the changed parts (`src/runner/actions.ts`, `src/runner/actions.test.ts` including the `placeWorld` helper, `src/runner/brief.ts`, `src/runner/brief.test.ts`, `src/runner/session.ts`, `src/runner/session.test.ts`); `doc/plans/phases/phase-60.md` (header through `## Requirements` only); `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.md` and `.criteria.md`; `doc/specs/prd/prd-05-a-runner-decides-each-step.md` and `.criteria.md` (R1, R2, R3, R7, R18), plus the range's diff to both criteria files; `gh issue view 248` and `249` on fvermaut/timone, with their comments; `CONTEXT.md`. Outside the list: I also read parts of `src/daemon/runs.ts` (`askPlace`, `leaveTurn`, `givePlaces`, `askPlanner`) to check what `waitingSince` means. Neither finding depends on that file.
- **Diff:** `origin/main...timone/248-a-refused-ticket-waits-in-line` — 6 files, +322/−24
- **Findings:** 2

### 1. If the place is taken between the ask and the start, the approval is still written down, and the runner is not told — PRD-07.R3

- **Where:** `src/runner/actions.ts:1136–1201`
- **What:** The new ask comes before the write so that "a refused try writes nothing". The new comment explains why: "Written first, the brief would show the approval as given while its file still waits for it." But `write({ kind: "approval", … })` (1149–1156) still runs before `deps.startStep`. When `startStep` throws `NoPlaceError`, the catch now returns only `noPlace(again.holder)`: "No place is free on …: … This ticket now waits for its turn, and you are woken when a place is given to it." Before this change, the same case said: "The approval is written down, but the step that writes it into the file did not start: …". So the record holds the approval, the file does not, and the runner is no longer told. On the next wake, `stepState` (`src/runner/brief.ts:351–361`) shows the approval as "given by …, in the comment at …". That is the state the new comment says to avoid. The test at `src/runner/actions.test.ts:2101` checks the refusal words, `steps`, the status and the line, but never `record()`, so it does not see this.
- **Why it matters:** timone#248 expects: "When no place is free, the ticket waits in line and is woken when a place is given to it". The point is that the approval then reaches its file. PRD-07.R3 clause 3 says: "GIVEN a place given to one ticket WHEN its runner wakes and starts a step THEN the step is not refused for want of a place". In this case the runner wakes with the place, but its brief says the approval is already given. It may then never start the session that writes the approval into the file. That is the fault #248 names ("is never written"), in a narrow case.
- **Suggested remediation:** Write the approval entry only after `deps.startStep` returns. Or, in the `NoPlaceError` branch, keep the `noPlace` words first (so the watch in `session.ts` still counts the refusal) and add that the approval is written down and its file still waits for it. Add a `record()` check to the race test. — not applied here

### 2. The new "not in line" sentence is not true for the build while the planner has not decided — PRD-07.R5

- **Where:** `src/runner/brief.ts:461–465`, with the order of checks in `src/runner/actions.ts:905–915`
- **What:** For a ticket that is not in line, the brief now says: "a step you try now is refused, and the refusal puts the ticket in line." But for the build, `startStep` asks the planner first (`plannerRefusal`, 905–908) and returns before `askPlace` (914). With no planner decision, the build is refused by the planner ("This ticket now waits for its decision"), and that refusal does not put the ticket in line. This is the exact case of #249: planning has ended, and the same brief says "The planner: not asked yet. Starting the build asks it." The new test at `src/runner/session.test.ts:1144` wakes on "Planning committed and pushed its plan." and checks for this very line.
- **Why it matters:** PRD-07.R5 clause 1 says: "a decision of the planner to let it build was recorded after its plan was committed, and the build does not start without one". So for the build, the planner is asked before the place, and the sentence is wrong for the next step the brief offers. The phase header cites ADR-0060: a false line in the brief leads to a wrong choice. The end result is still right: the planner wakes the run when it decides, and the next try is refused for want of a place, which puts the ticket in line. So this is a wording fault of low weight. #249 asked only that the brief "says that a step must be started to take a turn".
- **Suggested remediation:** Use the weaker words #249 asked for. For example: "This ticket is not in line for it: it takes a turn only when it tries to start a step." Or name the planner case for the build. — not applied here

## Notes

- **On Spec finding 1.** The build saw this case and kept it on purpose; the completion report's *Context for the next agent* says why. On 2026-10-13 ivtrends#182 was in exactly this state (the approval in the record since 2026-10-09, the file not written), and when it was woken the runner saw that the file still waited for approval and recorded it again. The case needs another ticket to take the place in the short time between the ask and the start.
- **The fix reaches the daemon only after this merges** and the Timone folder the daemon runs from is updated, built, and the daemon restarted from your own terminal. Until then, a ticket can get stuck the same way, and a comment from you on it wakes it.
- **A false alarm from the session-end check** was filed as [timone#250](https://github.com/fvermaut/timone/issues/250): it read the words "was never woken", which describe the old build in PRD-07.R3's note of 2026-10-13, as a clause never seen to hold.
