# PRD-02 Acceptance Criteria — Inversion of Control

> Formal register for [prd-02-inversion-of-control.md](prd-02-inversion-of-control.md).
> Requirement IDs are stable — never renumber, never reuse, never delete.
> Depends on PRD-01: the stages orchestrated here are the PRD-01 skills.

## R1 — Ticket pickup

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN the daemon is running and a managed project has an open GitHub issue marked for Timone
      WHEN the next poll cycle completes
      THEN a pipeline run for that ticket appears in `timone status` and an acknowledgement comment is posted on the issue
    - GIVEN an unmarked issue
      WHEN polls run
      THEN no pipeline run is created for it
- **Verification hint:** create a marked and an unmarked issue on the pilot repo; observe status output and issue comments within one poll interval.

## R2 — Daemon-spawned sessions resolve a target project

> ✏ Revised 2026-07-20: [ADR-0007](../../adr/0007-sessions-at-timone-root.md) moved all sessions to the timone root, so the criterion is target-project resolution plus clean client repos, not per-project cwd. The ADR instructed this revision on 2026-07-19; PRD-01.R4 received it and this block was missed.

- **Priority:** MUST
- **Status:** revised
- **Verify-via:** api
- **Criteria:**
    - GIVEN a pipeline stage starts for project X
      WHEN the daemon spawns the agent session
      THEN the session runs from the timone root with the PRD-01 stage skills available, the target project X is carried in the event context and validated against `timone.yaml`, every file the session touches lies under `projects/X/…`, and no commit adds harness files to X's repo (process artifacts under `doc/` excepted)
- **Verification hint:** inspect session config/logs for cwd and the resolved target; `git log --stat` on produced branches, asserting only `doc/…` and `CONTEXT.md` paths.

## R3 — Async clarification gate

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN a picked-up ticket with open questions
      WHEN the clarification stage runs
      THEN the interview questions are posted as issue comments, `timone status` shows a waiting gate, and no further stage runs
    - GIVEN a human reply arrives on a waiting ticket
      WHEN the next poll cycle completes
      THEN the pipeline resumes incorporating the reply
- **Verification hint:** file a deliberately vague ticket; answer via comment; watch status transition waiting → running.

## R4 — PRD gate on the ticket

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN clarification concluded
      WHEN the requirements stage runs
      THEN the PRD pair is committed on a branch, a summary comment linking to it is posted on the issue, and the pipeline waits for approval
    - GIVEN an approval reply
      WHEN the next poll cycle completes
      THEN the pipeline advances to planning; a change-request reply loops the requirements stage with the feedback instead
- **Verification hint:** inspect the branch for the PRD pair; approve via comment and observe advancement.

## R5 — Plan gate on the ticket

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN an approved PRD
      WHEN the planning stage runs
      THEN the phase file is committed on the branch, referenced in a ticket comment, and gated on approval exactly like R4
- **Verification hint:** inspect the phase file on the branch; check the approval round-trip.

## R6 — Autonomous execution with verification

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN an approved phase plan
      WHEN execution runs unattended
      THEN sub-phase validation and the fresh-context verification of PRD-01 both run, with at most two verify-fix iterations before remaining failures are reported as a ticket comment
- **Verification hint:** run on the pilot ticket; inspect the verification report and criteria statuses; force a failure to see the bounded loop and ticket report.

## R7 — Pull request delivery

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN execution and verification completed
      WHEN the delivery stage runs
      THEN a pull request exists from the work branch referencing the ticket, its description summarizes scope and verification outcome, and the ticket links to the PR
- **Verification hint:** `gh pr view` on the pilot repo; check cross-links both ways.

## R8 — Docker preview per pull request

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN a Timone PR on a project with the Docker preview binding
      WHEN the preview stage runs
      THEN a container stack for the PR branch runs on the host, reachable at a per-PR URL posted as a PR comment
    - GIVEN a new commit on the PR branch
      WHEN the preview refresh runs
      THEN the preview serves the updated build
- **Verification hint:** `docker ps` filtered by PR identifier; `curl` the posted URL before and after pushing a visible change.

## R9 — Status visibility

- **Priority:** SHOULD
- **Status:** draft
- **Verify-via:** api
- **Criteria:** `timone status` lists every managed project with its active ticket, current stage, and any gate waiting for human input, in one glance.

## R10 — Serialized work per project

- **Priority:** SHOULD
- **Status:** draft
- **Verify-via:** api
- **Criteria:** while a project has an active pipeline run, additional marked tickets are visibly queued and started only when the active run reaches a terminal state.

## R11 — PR feedback loop

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN an open Timone PR receives a human review comment requesting a change
      WHEN the next poll cycle completes
      THEN a feedback session (the improve skill) triages it, applies the change on the PR branch or asks for clarification, replies on the review thread, and the preview reflects the update
- **Verification hint:** leave a small concrete review comment on the pilot PR; observe the commit, the threaded reply, and the refreshed preview.

## R12 — Preview teardown

- **Priority:** SHOULD
- **Status:** draft
- **Verify-via:** api
- **Criteria:** when a PR with a running preview is closed or merged, its stack is stopped and removed within one poll cycle; re-opening the PR recreates it on demand.
