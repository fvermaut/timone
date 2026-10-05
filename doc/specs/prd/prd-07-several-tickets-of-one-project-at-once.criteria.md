# PRD-07 Acceptance Criteria — Several tickets of one project at the same time

> Formal register for [prd-07-several-tickets-of-one-project-at-once.md](prd-07-several-tickets-of-one-project-at-once.md).
> Maintained by: timone-prd (creation), timone-verify (status),
> timone-prd (revisions). Requirement IDs are stable — never renumber.
>
> Words used here, as [`CONTEXT.md`](../../../CONTEXT.md) defines them: the **planner** is the agent that looks at all the tickets of one project that are ready to be built and decides which can start building now and which must wait. The **update** is what the machine does to an open pull request after another pull request of the same project merged. A **place** is one of the project's slots for a running step (R2). A **named person** is someone listed for the project in `timone.yaml` as allowed to instruct its runner.
>
> No requirement here puts anything on a screen that Timone draws, so no accessibility criteria apply.
>
> The first watched run for every `live` criterion is on scratch-app, with test tickets the machine writes so that they overlap on purpose. Never on ivtrends.

## R1 — A ticket frees its project when its pull request opens

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** api
- **Falsified-by:** a test that gives the run store a project whose only other run has an open, unmerged pull request, or is waiting for a person, and fails if a second ticket of that project is refused a step for that reason
- **Depends-on:** `src/daemon/runs.ts, src/runner/`
- **Criteria:**
    - GIVEN a ticket whose pull request is open and not merged, and no step of it running
      WHEN another ticket of the same project asks to start a step
      THEN the step is not refused because of the first ticket
    - GIVEN a ticket parked on its own work branch, waiting for a named person to answer
      WHEN another ticket of the same project asks to start a step
      THEN the step is not refused because of the first ticket
    - GIVEN a ticket whose pull request is open
      WHEN its pull request merges, closes, or gets a review comment from a named person
      THEN that ticket's run wakes as it does today
- **Verification hint:** today `holdsProject` in `src/daemon/runs.ts` counts a run parked on a branch as holding the project, and `endRun` in `src/runner/actions.ts` ends a run only on the merge. Drive a copy of the ledger with `--state`, never the live file.

## R2 — Each project has a number of places, 2 unless `timone.yaml` says otherwise

> ✏ 2026-10-04 — partial evidence: clauses 3 to 6 passed in [phase-47-verification.md](../../plans/phases/reports/phase-47-verification.md), with its probe [`prd-07.r2.mjs`](../../plans/phases/probes/prd-07.r2.mjs). Clause 4 was seen only as far as one place allows: its words "while the other steps keep running" need two places. Clauses 1 and 2, the number of places, are not built yet (piece 5), so the status stays `draft`.

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Falsified-by:** a test that fills every place of a project and fails if any further step of that project starts; and a test that counts places while tickets wait for a person, for a merge, or for their turn, and fails if any of those is counted
- **Depends-on:** `src/daemon/runs.ts, src/runner/, src/manifest.ts`
- **Criteria:**
    - GIVEN a project whose entry in `timone.yaml` sets no limit
      WHEN its places are counted
      THEN it has 2
    - GIVEN a project whose entry in `timone.yaml` sets a limit of N
      WHEN its places are counted
      THEN it has N
    - GIVEN a project with N places and steps of N different tickets running, whatever those steps are
      WHEN a step of another ticket of the project asks to start
      THEN it does not start, and the ticket waits for its turn
    - GIVEN a project with fewer running steps than places
      WHEN a step of a ticket of the project asks to start, and nothing else stops it
      THEN it starts, while the other steps keep running
    - GIVEN a ticket waiting for a person, for a merge, or for its turn, or with only an open pull request
      WHEN the project's places are counted
      THEN that ticket takes none
    - GIVEN a runner session running for a ticket, or a takeover session open in a person's own terminal
      WHEN the project's places are counted
      THEN neither takes a place
- **Verification hint:** test it on the run store with fake steps. Two tickets of one project each start a step; a third is refused; the first step ends and the third may start. The key name in `timone.yaml` is the build's choice.

## R3 — A freed place goes to one ticket: `priority:high` first, then the oldest

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** api
- **Falsified-by:** a test with two tickets waiting for one place, which frees it and fails if both are woken, or if the woken one's step is refused for want of a place
- **Depends-on:** `src/daemon/runs.ts, src/runner/driver.ts`
- **Criteria:**
    - GIVEN tickets waiting for a place on a project, one of them labelled `priority:high`
      WHEN a place frees
      THEN the place goes to the ticket labelled `priority:high`
    - GIVEN tickets waiting for a place on a project, none labelled `priority:high`, or several
      WHEN a place frees
      THEN the place goes to the oldest of them
    - GIVEN a place given to one ticket
      WHEN its runner wakes and starts a step
      THEN the step is not refused for want of a place
      AND no other ticket of the project was told that a place is free ([#184](https://github.com/fvermaut/timone/issues/184))
    - GIVEN a place given to one ticket whose runner decides to start no step
      WHEN that runner session ends
      THEN the place goes to the next ticket by the same order
- **Verification hint:** this is [#184](https://github.com/fvermaut/timone/issues/184). Today `PROJECT_FREE_EVENT` in `src/runner/driver.ts` is sent to every run that was refused, whenever the project is free, so two runs can be told and only one can start. "Oldest" is the ticket's creation time on the forge, unless the build has a reason to choose another; it says so in its departures.

## R4 — Nothing is built on top of an open pull request

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Falsified-by:** a test that asks to start a build for a ticket that needs another ticket's unmerged work, and fails if it starts; and a test that reads the base of every work branch a run creates and fails if any is not the default branch
- **Depends-on:** `src/runner/, src/daemon/, src/adapters/github-tickets.ts`
- **Criteria:**
    - GIVEN a ticket that needs another ticket's work, and that ticket's pull request is not merged
      WHEN the first ticket's build would start
      THEN it does not start, and it waits for the merge
    - GIVEN any work branch a run creates
      WHEN it is created
      THEN it is cut from the project's default branch, never from another ticket's branch
    - GIVEN an initiative whose step tickets 2 and 3 are both open and blocked by nothing open
      WHEN the project has a free place for each and the planner lets both build
      THEN both build at the same time
    - GIVEN a step ticket blocked by another step ticket that is still open
      WHEN the daemon reads the project
      THEN the blocked step does not start
- **Verification hint:** step tickets already declare what they wait for with GitHub's `blocked by` (`blockStep` in `src/adapters/github-tickets.ts`), and a step ticket closes when its pull request merges. Clause 3 changes [PRD-02.R22](prd-02-inversion-of-control.criteria.md#r22--a-ticket-hosts-a-sequence-of-chunks) clause 1, which takes only the first eligible step.

## R5 — The planner decides, between the plan and the build, which tickets start building

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** live
- **Last live gate:** never
- **Falsified-by:** a test that asks to start a build for a ticket with no recorded decision of the planner, and fails if it starts
- **Depends-on:** `src/runner/, src/daemon/`
- **Criteria:**
    - GIVEN any ticket of a project
      WHEN its build would start
      THEN a decision of the planner to let it build was recorded after its plan was committed, and the build does not start without one
    - GIVEN a ticket whose plan was just committed, and another ticket of the same project building, whose plan lists files the first plan does not touch
      WHEN the planner decides
      THEN it lets the first ticket build at the same time
    - GIVEN a ticket whose plan was just committed, and another ticket's build or open pull request that changes most of the same files
      WHEN the planner decides
      THEN it holds the first ticket back until the other ticket's pull request merges or closes
    - GIVEN a held ticket
      WHEN the pull request it waits for merges or closes
      THEN the planner decides again
      AND the held ticket's plan is not rewritten
- **Verification hint:** on scratch-app, have the machine write three test tickets: two that change most of the same files, one that changes none of them. Watch the planner let one of the first two and the third build at the same time, and hold the other. The planner's judgement of "most" is not a number, so clauses 2 and 3 are watched, not tested. Clause 1 is the code part and is tested on the action that starts a build.

## R6 — A held ticket says what it waits for, and a named person can overrule

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Falsified-by:** a test in which the planner holds a ticket and fails if no comment on that ticket names the ticket it waits for; and a test that gives the planner a comment by someone not named for the project and fails if it changes a decision
- **Depends-on:** `src/runner/, src/daemon/`
- **Criteria:**
    - GIVEN the planner holds a ticket back
      WHEN it records the decision
      THEN a comment on that ticket, in plain words, names the ticket it waits for and gives the reason
    - GIVEN a held ticket
      WHEN a named person writes on it, in plain words, that it should build now
      THEN the planner lets it build when a place is free, and says on the ticket that it does so on that comment
    - GIVEN a held ticket
      WHEN someone not named for the project writes the same
      THEN nothing changes
- **Verification hint:** the rule for who may instruct is the one of [PRD-05.R10](prd-05-a-runner-decides-each-step.criteria.md#r10--only-named-people-can-instruct-the-runner). Whether the comment reads plainly is seen in R5's watched run.

## R7 — After a merge, every other open pull request of the project is updated

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** live
- **Last live gate:** never
- **Falsified-by:** a test that merges one of two open pull requests on a fake forge and fails if no update starts on the other; and a test that runs an update and fails if any of the three test sets below was not run
- **Depends-on:** `src/runner/, src/daemon/, .claude/skills/`
- **Criteria:**
    - GIVEN two open pull requests on one project
      WHEN one of them merges
      THEN an update starts on the other, as soon as a place is free
    - GIVEN an update
      WHEN it has brought the branch level with the default branch
      THEN it runs the project's whole test suite, the check scripts of the pull request's own ticket, and the check scripts of the ticket that just merged
    - GIVEN an update that had to change code to fix a conflict
      WHEN it ends
      THEN a short section at the top of the pull request says, in plain words, what was changed and why
    - GIVEN an update in which a test still fails after two fixes
      WHEN it ends
      THEN the top of the pull request says that the work does not pass, names the failure, and the update stops there for the person to decide
    - GIVEN any update
      WHEN it ends
      THEN the default branch has not moved because of it, and the work already done on the branch is kept rather than rebuilt
- **Verification hint:** on scratch-app, two test tickets that change the same file in two different ways, both with open pull requests. A named person merges one. Watch the update on the other: the branch is level with the default branch, the three test sets ran (the step's own record lists them), and the top of the pull request describes the fix. Then make one test fail on purpose and watch the pull request say so after two fixes.

## R8 — Files almost every ticket changes never stop an update

> ✏ 2026-10-04 — partial evidence: clauses 1, 2 and 3 passed in [phase-48-verification.md](../../plans/phases/reports/phase-48-verification.md), with its probe [`prd-07.r8.mjs`](../../plans/phases/probes/prd-07.r8.mjs), for `STATUS.md` and a register merged level in a box, squashed or by a merge commit. One case of clause 3 still needs a person: both pull requests add a new requirement with the same number. Clause 3 says no person; this register's header says never renumber. Which rule wins is open in that report's *Questions for the human*, so the status stays `draft`.

> ✏ 2026-10-04 — partial evidence: clause 1 passed in [phase-44-verification.md](../../plans/phases/reports/phase-44-verification.md), with its probe [`prd-07.r8.mjs`](../../plans/phases/probes/prd-07.r8.mjs). Clauses 2 and 3 are not built yet, so the status stays `draft`.

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Falsified-by:** a test in which two tickets of one project are planned at the same time and fails if their phase files, ADRs or triage records take the same number; and a test that merges one of two branches which both changed `STATUS.md` and the same requirement register, and fails if the update on the other needs a person for either file
- **Depends-on:** `src/, .claude/skills/, process.md`
- **Criteria:**
    - GIVEN two tickets of one project worked at the same time
      WHEN each writes a phase file, an ADR or a triage record
      THEN no two of them take the same number
    - GIVEN two open pull requests of one project that both changed `STATUS.md`
      WHEN one merges and the update runs on the other
      THEN the update completes without a person resolving `STATUS.md`, and `STATUS.md` on the branch keeps what both said
    - GIVEN two open pull requests of one project that both changed the same requirement register
      WHEN one merges and the update runs on the other
      THEN the update completes without a person resolving the register, and no line either one wrote is lost
- **Verification hint:** the handover names these files: `STATUS.md` (written on each run's own branch since #196), the requirement registers, and every document numbered by taking the next free number. Today two plans written at once would both take the next phase number. fvermaut set the order: this fault is fixed first, before tickets of one project run at the same time.

## R9 — A ticket with an open pull request keeps its run and is not picked up again

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** api
- **Falsified-by:** a test that gives the pickup a marked ticket whose pull request from an earlier run is open, and fails if a new run is started for it
- **Depends-on:** `src/daemon/, src/runner/`
- **Criteria:**
    - GIVEN a marked ticket whose pull request from an earlier run is open
      WHEN the daemon reads the project's tickets
      THEN no new run starts for that ticket as new work
    - GIVEN that ticket
      WHEN its pull request merges, closes, or gets a review comment from a named person
      THEN the run that owns that pull request wakes, and the facts it is given name the pull request and its branch
- **Verification hint:** this is [#181](https://github.com/fvermaut/timone/issues/181). On scratch-app#67 a new run started at 10:11:59Z on 30 September while pull request #70 from an earlier run was open, and its facts said "Branch: none yet". Replay that state on a copy of the ledger.

## R10 — The breakdown shows which pieces are built at the same time

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** api
- **Depends-on:** `.claude/skills/timone-plan/, src/adapters/github-tickets.ts, src/runner/`
- **Criteria:**
    - GIVEN a breakdown whose pieces 2 and 3 both need piece 1 and not each other, and piece 4 needs both
      WHEN it is put up for approval
      THEN the order it shows reads "1, then 2 and 3 together, then 4", in those plain words or words as plain
    - GIVEN that breakdown approved
      WHEN its step tickets are opened
      THEN step tickets 2 and 3 are each blocked by step 1 and not by each other, and step 4 is blocked by steps 2 and 3
- **Verification hint:** the step tickets' `blocked by` relations are read from the forge. Write a fixture breakdown with that shape and check the approval text and the relations it opens.

## R11 — The breakdown prefers pieces that can be built at the same time

> ✏ 2026-10-04 — partial evidence: [phase-45-verification.md](../../plans/phases/reports/phase-45-verification.md) issued the manual check for this criterion, in its *HUMAN-CHECK scripts* section. Nobody has performed it yet, so the status stays `draft`.

- **Priority:** SHOULD
- **Status:** draft
- **Verify-via:** human
- **Depends-on:** `.claude/skills/timone-plan/, process.md`
- **Criteria:** when two ways of cutting an initiative into pieces are equally good, the breakdown chooses the one where fewer pieces wait for each other and fewer pieces share files. The rule that each piece works end to end ([PRD-01.R25](prd-01-process-layer.criteria.md#r25--a-piece-is-a-thin-path-through-every-layer-and-names-only-what-it-finishes)) comes first and is not weakened.
- **Verification hint:** read the next breakdown of three pieces or more written after this lands, and its approval comment. A person judges whether a cut with fewer waits was available and missed.

## R12 — The old rule is gone from every place it is written

> ✏ 2026-10-04 — partial evidence: clauses 1, 3 and 4 passed in [phase-47-verification.md](../../plans/phases/reports/phase-47-verification.md), and clause 2 for PRD-02.R22 clause 6, PRD-05.R11 clause 2 and PRD-03's out-of-scope line, with its probe [`prd-07.r12.mjs`](../../plans/phases/probes/prd-07.r12.mjs). PRD-02.R22 clause 1 and PRD-05.R15 clause 2 are not changed yet (piece 5), so the status stays `draft`.

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Depends-on:** `process.md, doc/adr/, doc/specs/prd/, src/daemon/runs.ts`
- **Criteria:**
    - GIVEN the work for this PRD has merged
      WHEN [PRD-02.R10](prd-02-inversion-of-control.criteria.md#r10--serialized-work-per-project) is read
      THEN it is marked as replaced by this PRD's R1, R2 and R3, with a dated note
    - GIVEN the same
      WHEN [PRD-02.R22](prd-02-inversion-of-control.criteria.md#r22--a-ticket-hosts-a-sequence-of-chunks) clauses 1 and 6, [PRD-05.R15](prd-05-a-runner-decides-each-step.criteria.md#r15--one-projects-work-no-longer-holds-up-the-others) clause 2, [PRD-05.R11](prd-05-a-runner-decides-each-step.criteria.md#r11--takeover-and-cancel-stay-and-retry-goes) clause 2, and the out-of-scope line of [PRD-03](prd-03-a-run-ends-at-its-pull-request.md) on how a project is held are read
      THEN each carries a dated note naming the requirement of this PRD that changes it
    - GIVEN the same
      WHEN [ADR-0026](../../adr/0026-a-ticket-is-a-conversation-a-run-is-a-chunk.md) is read
      THEN its rule "the chunk holds the project" is marked as replaced, naming the decision record that replaces it
    - GIVEN the same
      WHEN `process.md` stage 6 is read
      THEN it no longer says that a ticket-driven run holds its project until its pull request ends
- **Verification hint:** the handover lists these places. The code part, `RunStore` in `src/daemon/runs.ts`, is covered by R1 and R2.

## R13 — A takeover is allowed while another ticket of the same project is building

> ✏ 2026-10-03 — added on fvermaut's answer on [timone#197](https://github.com/fvermaut/timone/issues/197): "no" to "Is a takeover still refused while another ticket of the same project is being built?"

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** api
- **Falsified-by:** a test that opens a takeover on a ticket nothing is working on, while a step of another ticket of the same project runs or another ticket holds a work branch, and fails if the takeover is refused for that reason
- **Depends-on:** `src/commands/takeover.ts, src/daemon/runs.ts`
- **Criteria:**
    - GIVEN a ticket nothing is working on, and a step of another ticket of the same project running
      WHEN a person runs `timone takeover <ticket>` on the first ticket
      THEN a terminal session opens on it, and it is not refused because of the other ticket
    - GIVEN a ticket nothing is working on, and another ticket of the same project holding a work branch or an open pull request
      WHEN a person runs `timone takeover <ticket>` on the first ticket
      THEN a terminal session opens on it, and it is not refused because of the other ticket
    - GIVEN a ticket whose own step the machine is working on
      WHEN a person runs `timone takeover <ticket>` on it
      THEN no session opens, and the message says what is happening, as today
- **Verification hint:** this replaces the part of [PRD-05.R11](prd-05-a-runner-decides-each-step.criteria.md#r11--takeover-and-cancel-stay-and-retry-goes) clause 2 that refuses a takeover while another run of the project is working or holds a work branch. Its probe, [`prd-05.r11.mjs`](../../plans/phases/probes/prd-05.r11.mjs), checks that refusal today and will have to change with it. The takeover takes no place (R2).

## R14 — A pull request that opens behind the default branch is brought level at once

> ✏ 2026-10-03 — added on fvermaut's answer on [timone#197](https://github.com/fvermaut/timone/issues/197): "yes" to "When a pull request opens and the default branch has moved on, should the machine bring it up to date at once?"

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** live
- **Last live gate:** never
- **Falsified-by:** a test on a fake forge that opens a pull request whose branch is behind the default branch, and fails if no update starts on it; and a test that opens one level with the default branch and fails if an update starts
- **Depends-on:** `src/runner/, src/daemon/, .claude/skills/`
- **Criteria:**
    - GIVEN a ticket still building when another pull request of the same project merges
      WHEN its own pull request opens, behind the default branch
      THEN an update starts on it at once, as soon as a place is free, without waiting for the next merge
    - GIVEN that update
      WHEN it runs
      THEN it does everything R7 asks of an update after a merge: it brings the branch level, fixes any conflict, runs the same three test sets, writes the same section at the top of the pull request, and stops for the person after two failed fixes
    - GIVEN a pull request that opens level with the default branch
      WHEN it opens
      THEN no update starts on it
- **Verification hint:** on scratch-app, in the same watched run as R7: two test tickets that change the same file, one built faster than the other. A named person merges the first pull request while the second ticket still builds. Watch the second pull request open and be brought level at once, before any further merge.
