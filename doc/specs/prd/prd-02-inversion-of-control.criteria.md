# PRD-02 Acceptance Criteria — Inversion of Control

> Formal register for [prd-02-inversion-of-control.md](prd-02-inversion-of-control.md).
> Requirement IDs are stable — never renumber, never reuse, never delete.
> Depends on PRD-01: the stages orchestrated here are the PRD-01 skills.

## R1 — Ticket pickup

- **Priority:** MUST
- **Status:** verified
    - ✏ 2026-08-03 verified by fvermaut at [phase 11](../../plans/phases/phase-11.md)'s 11g gate, against `scratch-app`. Both clauses are discriminating and were observed in the same cycle: [#4](https://github.com/fvermaut/scratch-app/issues/4) carried the `timone` label and produced a run plus exactly one acknowledgement comment; [#5](https://github.com/fvermaut/scratch-app/issues/5), filed in the same session without the label, ended the cycle with **0 comments and 0 labels**. `timone status` listed the run. A third cycle over the same tickets posted nothing and created nothing — idempotency across cycles, which the criterion does not demand but a poll loop cannot be trusted without.
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
- **Status:** verified
    - ✏ 2026-08-03 verified by fvermaut at [phase 11](../../plans/phases/phase-11.md)'s 11g gate. Clause by clause: **runs from the timone root** — the spawner's cwd is the root by construction and refuses to be anything else; live session `f8982c83` ran there; **stage skills available** — that session invoked stage 1 and produced a classification, which it could not have done otherwise; **target carried and validated** — the event context names the project and the spawner refuses one absent from `timone.yaml` (unit-proven on an undeclared target, live-resolved on `scratch-app`); **no harness files in the client repo** — `git log --stat` over `scratch-app`'s entire history matches no `.claude/` or `timone.yaml` path.
    - ✏ 2026-08-03 **known limit of the evidence.** The "every file the session touches lies under `projects/X/…`" clause was satisfied by a session that **wrote no files at all** — triage records itself as an issue comment, so containment held vacuously rather than being tested. The guardrail hook that would catch a straying session ran and reported clean, but on the same empty evidence. A session that actually writes into a project — phase 13's execution path — is what makes this clause discriminating.
    - ✏ 2026-08-06 **the vacuous clause is vacuous no longer.** [Phase 13](../../plans/phases/phase-13.md)'s execution, verification, delivery and remediation sessions wrote and committed real files across five slices, three reports and a review fix; every path lay under `projects/scratch-app/…`, the guardrails ran against actual evidence and stayed silent, and `git log --stat --all` on the pilot still matches no harness path. The limit above no longer applies.
- **Verify-via:** api
- **Criteria:**
    - GIVEN a pipeline stage starts for project X
      WHEN the daemon spawns the agent session
      THEN the session runs from the timone root with the PRD-01 stage skills available, the target project X is carried in the event context and validated against `timone.yaml`, every file the session touches lies under `projects/X/…`, and no commit adds harness files to X's repo (process artifacts under `doc/` excepted)
- **Verification hint:** inspect session config/logs for cwd and the resolved target; `git log --stat` on produced branches, asserting only `doc/…` and `CONTEXT.md` paths.

## R3 — Async clarification via a conversation

> ✏ Revised 2026-08-02: the grill session on the conversation medium ([ADR-0012](../../adr/0012-conversation-channels.md)) moved conversations off ticket-comment ping-pong — clarification is a conversation on the project's conversation channel, not a comment thread; the ticket records the CTA and the outcome.

- **Priority:** MUST
- **Status:** verified
    - ✏ 2026-08-05 verified by fvermaut at [phase 12](../../plans/phases/phase-12.md)'s 12g gate, on `scratch-app` [#6](https://github.com/fvermaut/scratch-app/issues/6). Clause by clause: **conversation opened** — the pipeline reached the clarification stage on its own and posted a CTA carrying a copy-pasteable `timone takeover scratch-app#6`, naming no stage and no skill; `timone status` showed it waiting, and a second poll cycle changed nothing, so the wait holds rather than re-firing. **Concluded and resumed** — fvermaut ran the command, held the interview to acceptance, and the accepted summary landed on the ticket carrying `CONVERSATION_RECORD_MARKER`; the next cycle read that record and advanced the run to the requirements stage. The summary the interview produced was substantive rather than a transcript: it split the request into two changes and said which one was not being built.
- **Verify-via:** api
- **Criteria:**
    - GIVEN a picked-up ticket with open questions
      WHEN the clarification stage runs
      THEN a conversation is opened on the project's conversation channel — for the terminal channel, a ticket comment carrying a CTA with the exact takeover command — `timone status` shows a waiting gate, and no further stage runs
    - GIVEN the conversation concludes with the human accepting the summary
      WHEN the session closes
      THEN the accepted outcome summary is posted on the ticket and the pipeline resumes incorporating it
- **Verification hint:** file a deliberately vague ticket; take over via the posted CTA; run the interview to acceptance; watch the summary land on the ticket and status transition waiting → running.

## R4 — PRD gate on the ticket

- **Priority:** MUST
- **Status:** verified
    - ✏ 2026-08-05 verified by fvermaut at [phase 12](../../plans/phases/phase-12.md)'s 12g gate, on `scratch-app` [#6](https://github.com/fvermaut/scratch-app/issues/6). **First clause** — the requirements stage claimed the branch `timone/6-typing-in-the-box-is-fiddly-on-my-phone`, committed and pushed the PRD pair to it, posted a plain-language summary, and the daemon posted the approval request linking the artifact on that branch; the run parked waiting. **Second clause, both directions and in that order** — fvermaut replied with a criticism first ("not sure about introducing the new edit button") and the next cycle re-ran the *same* stage carrying those words (commit `d8ff53d`, withdrawing what he questioned) rather than advancing; he then replied `approve` and the following cycle recorded the approval on the PRD (`4f00941`, status `Active`) and advanced to planning.
    - ✏ 2026-08-05 **the divergence recorded here on 2026-08-03 is resolved**, by the grill of 2026-08-05 and [ADR-0014](../../adr/0014-artifact-first-gates.md): every gated stage now writes its artifact first and gates on it, and `process.md` and both skills were amended to match. This criterion stands as written and is no longer in conflict with anything.
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
- **Status:** verified
    - ✏ 2026-08-05 verified by fvermaut at [phase 12](../../plans/phases/phase-12.md)'s 12g gate, on `scratch-app` [#6](https://github.com/fvermaut/scratch-app/issues/6). The planning stage committed `doc/plans/phases/phase-04.md` to the same branch stamped `Awaiting approval` (`9630fe3`), posted a summary, and was gated by the *same* mechanism as R4 — one code path, two stages, asserted by construction in the tests as well as observed here. fvermaut replied `approve`; the next cycle wrote that approval into the phase file as `Approved for execution by fvermaut 2026-08-05T18:02:22Z` (`e7a348c`) and parked the run at execution, saying plainly on the ticket that building is not built yet.
    - ✏ 2026-08-05 **the first attempt at this criterion failed live, and the failure is the reason it can now be trusted.** The planning session obeyed `timone-plan`'s then-current "approve before any file is written" rule, wrote nothing, and reported success — and the daemon posted an approval request for a plan that did not exist. Two defects: the daemon opened a gate on the session's exit code rather than on the artifact's existence (fixed — it now compares the work branch's tip and refuses to gate over nothing), and two skills contradicted this criterion (resolved by [ADR-0014](../../adr/0014-artifact-first-gates.md)). The verification above is of the re-run after both fixes.
- **Verify-via:** api
- **Criteria:**
    - GIVEN an approved PRD
      WHEN the planning stage runs
      THEN the phase file is committed on the branch, referenced in a ticket comment, and gated on approval exactly like R4
- **Verification hint:** inspect the phase file on the branch; check the approval round-trip.

## R6 — Autonomous execution with verification

- **Priority:** MUST
- **Status:** verified
    - ✏ 2026-08-06 verified by fvermaut at [phase 13](../../plans/phases/phase-13.md)'s 13h gate, on `scratch-app` [#6](https://github.com/fvermaut/scratch-app/issues/6). **Unattended execution with sub-phase validation** — the daemon resumed the parked run and one session built the approved five-slice `phase-04.md` on `timone/6-typing-in-the-box-is-fiddly-on-my-phone`: one commit per sub-phase after its own validation passed (`d424c6a`, `13c0836`, `53c2de8`, `7a909ae`, `6c712c7`), handoffs, the completion report, and the `Status:` flip the daemon reads as its artifact witness. **Fresh-context verification** — a separate session whose prompt deliberately carries neither the ticket's text nor its thread ran stage 7 and committed the report (`6e02f3b`); the pass was clean first time, 0 of 2 fix loops consumed, and the later review remediation triggered a second full pass (`18ea12f`), also clean. **Failures reported as ticket comments** — three stops landed as plain-language reports rather than silence: two pre-flight refusals over a stray commit another session had left on the branch, and a delivery that produced nothing; each was recovered with `timone retry`, and `.timone/state.json` was never edited by hand.
    - ✏ 2026-08-06 **known limit of the evidence.** The bounded verify-fix loop never fired — both live passes were clean on the first attempt — so "at most two verify-fix iterations" rests on the verify skill's own rule (exercised hand-run in phases 8–10) rather than a daemon-path observation. The failure-report clause was observed for refusals and a produced-nothing stage, not for loop exhaustion.
- **Verify-via:** api
- **Criteria:**
    - GIVEN an approved phase plan
      WHEN execution runs unattended
      THEN sub-phase validation and the fresh-context verification of PRD-01 both run, with at most two verify-fix iterations before remaining failures are reported as a ticket comment
- **Verification hint:** run on the pilot ticket; inspect the verification report and criteria statuses; force a failure to see the bounded loop and ticket report.

## R7 — Pull request delivery

- **Priority:** MUST
- **Status:** verified
    - ✏ 2026-08-06 verified by fvermaut at [phase 13](../../plans/phases/phase-13.md)'s 13h gate. [PR #9](https://github.com/fvermaut/scratch-app/pull/9) was opened by the delivery session **from the work branch**, referencing #6; its body carries the plain-language scope summary, the full verdict table with the one advisory HUMAN-CHECK as an unticked checklist item, and both review axes under separate headings (Spec quoting requirement IDs); the delivery report was committed on the branch (`14d5e24`) **before** the PR opened, and the ticket links the PR in plain words — cross-links both ways, as the criterion asks. The review remediation refreshed the *same* PR as iteration 2 (`a2419f1`) rather than forking a second one. fvermaut merged it, the run completed, and the ticket closed as completed.
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
- **Status:** verified
    - ✏ 2026-08-03 verified by fvermaut at [phase 11](../../plans/phases/phase-11.md)'s 11g gate. `timone status` was read at every transition of the live run and matched each one. The all-in-one-glance line at the end of the proof read: `scratch-app  #4 (triage) — waiting on you: the next stage to be built  ·  1 queued (#6)`, which answers all three of the criterion's questions — which ticket, which stage, who is waited on — plus queue depth. A run with a failed guardrail rendered `⚠ 1 automatic check(s) failed — see the ticket`. With no state file at all the command prints guidance naming `timone daemon`, not a stack trace.
- **Verify-via:** api
- **Criteria:** `timone status` lists every managed project with its active ticket, current stage, and any gate waiting for human input, in one glance.

## R10 — Serialized work per project

- **Priority:** SHOULD
- **Status:** verified
    - ✏ 2026-08-03 verified by fvermaut at [phase 11](../../plans/phases/phase-11.md)'s 11g gate. [#6](https://github.com/fvermaut/scratch-app/issues/6) was filed while `#4`'s run was active; the next cycle registered it as `queued`, posted an acknowledgement that names what it waits behind ("I'm already working on #4 … It's next in line"), and `timone status` showed both. No session was spawned for it. One active run per project is an invariant the run store enforces rather than a convention callers follow: activating a second run on a busy project throws.
    - ✏ 2026-08-03 **known limit of the evidence.** The "started only when the active run reaches a terminal state" half was **not** observed live — `#4` parks awaiting the stage phase 12 builds and has never reached a terminal state, so promotion never fired in the pilot. It is proven only by unit test (`src/daemon/runs.test.ts`: promotion on `done`, on `failed`, in pickup order, and not at all when the queue is empty). Live evidence arrives with phase 12, when runs can finish.
    - ✏ 2026-08-06 **the promotion half is now observed live**, at [phase 13](../../plans/phases/phase-13.md)'s 13h gate: ticket [#10](https://github.com/fvermaut/scratch-app/issues/10), filed as a labelled fixture and visibly queued behind #6's open pull request, started in the very cycle that saw the PR merge and completed the run — the first terminal state a live run has ever reached. The unit-only limit above no longer applies.
- **Verify-via:** api
- **Criteria:** while a project has an active pipeline run, additional marked tickets are visibly queued and started only when the active run reaches a terminal state.

## R11 — PR feedback loop

- **Priority:** MUST
- **Status:** draft
    - ✏ 2026-08-06 **three clauses of four observed at [phase 13](../../plans/phases/phase-13.md)'s 13h gate; `draft` stands only because the preview clause cannot yet be checked.** A concrete review comment ("derive the skeleton row height from the real row's classes instead of hard-coding 62px") was picked up on the next cycle and remediated per [ADR-0016](../../adr/0016-review-remediation-rides-the-verify-fix-shape.md): one commit `fix: review — derive-skeleton-row-height-from-row-classes` (`69760d9`) on the PR branch, a **full re-verification** (`18ea12f`), the same PR refreshed as iteration 2, and a plain-words reply on the PR naming the commit. A deliberately vague comment ("not sure about the spacing") produced a clarifying question naming the four concrete things "spacing" could mean — flagging that two of them are written agreements whose change would take the full path — and **no commit**, with the run re-parked directly. "The preview reflects the update" awaits R8's machinery (phase 14) and is the only unverified clause.
    - ✏ 2026-08-06 **a wording note, not a divergence:** the criterion's "(the improve skill)" parenthetical predates [ADR-0016](../../adr/0016-review-remediation-rides-the-verify-fix-shape.md), which routes concrete review comments past that skill's proposal table; the observed behaviour is the ADR's. Reconciling the parenthetical is a stage-9 record item when this requirement is next revised.
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

## R13 — Harness-owned routing

- **Priority:** MUST
- **Status:** verified
    - ✏ 2026-08-05 **second clause verified by fvermaut**, closing the requirement at [phase 12](../../plans/phases/phase-12.md)'s 12g gate. In a fresh interactive session at the timone root he stated a raw request about a managed project, naming no stage, skill or process concept; the session routed it through triage first and then invoked the stage that classification pointed at, by itself — both halves of the clause, as he confirmed when asked which he had actually watched.
    - ✏ 2026-08-05 **known limit of the evidence.** This clause is the one entry in this register verified from fvermaut's direct report of a session **no artifact captured**: an interactive session leaves no ticket comment, no label and no commit, so unlike the daemon path there is nothing to inspect afterwards. The evidence is his observation, recorded here as such rather than dressed up as an inspection. Making the interactive path leave its own trace — the marker convention that is still an open question — is what would let this be re-checked by anyone else.
    - ✏ 2026-08-03 **first clause verified; the requirement is not.** The daemon path was proven at [phase 11](../../plans/phases/phase-11.md)'s 11g gate: [#4](https://github.com/fvermaut/scratch-app/issues/4) was filed in deliberately naive language ("the page feels slow when I add many items"), and the spawned session classified it as a **bug** with a written rationale, applied `triage:bug`, and posted a comment that names no stage, no skill and no process concept — it even reasoned about *why* the call was close (no latency requirement exists, but "shows immediately" does) and connected the ticket to work already agreed on 2026-08-02. The spawner is structurally incapable of pre-classifying: its prompt carries the ticket's raw text and the literal string `triage:<kind>`, never a verdict, and a unit test asserts the absence.
    - ✏ 2026-08-03 **the second clause has no evidence.** "An interactive timone-root session routes a raw request through triage first" is in force in `CLAUDE.md` and `process.md` but has never been observed. Being written down is not evidence. It costs nothing to obtain — the next raw request fvermaut states in a terminal session either routes through triage without a skill being named, or it does not — but until that is watched and recorded, this requirement stays `draft`.
- **Verify-via:** api
- **Criteria:**
    - GIVEN a process-naive ticket on a managed project — plain language, naming no stage, skill, or process concept
      WHEN the daemon picks it up
      THEN triage classifies and routes it, the classification with rationale is posted on the ticket, and at no point does any surface require the human to name a stage or skill
    - GIVEN an interactive timone-root session receives a raw request concerning a managed project
      WHEN the session starts work
      THEN it routes the request through triage first and invokes the routed stage skill itself — the same contract as the daemon path
- **Verification hint:** file tickets written in deliberately naive language ("the button looks wrong on my phone"); inspect routing comments; in a terminal session, state a raw request and confirm triage fires without any skill being named.

## R14 — Conversation channel seam with terminal takeover

- **Priority:** MUST
- **Status:** verified
    - ✏ 2026-08-05 verified by fvermaut at [phase 12](../../plans/phases/phase-12.md)'s 12g gate. **Clause 1** — the opened conversation's ticket comment carries the copy-pasteable command in a fenced block (`scratch-app` #6). **Clause 2** — fvermaut ran `timone takeover scratch-app#6` with no other argument; it resolved what the ticket was waiting on from the ledger, spawned the clarification session itself, and that session re-entered from the artifacts and the thread alone. Its refusal paths were exercised live against the real ledger too: a park it cannot resume, an untracked ticket, an unknown project and a malformed target each refused with specific guidance, and a ticket waiting on a *gate* was told to answer on the ticket instead of being handed an interview. **Clause 3** — a fake channel drives `inviteToConversation` / `recordConversationOutcome` unchanged, which is the second implementation the hint asks for.
    - ✏ 2026-08-05 **known limit of the evidence.** Only one channel implementation exists in production — the terminal. The seam's second implementation is a test fake, which is what the verification hint accepts, but no second *medium* (Slack) has been built against it, so the claim is that the seam admits one, not that one has shipped.
    - ✏ 2026-08-03 **superseded by the entry above; kept for the record.** At the time: **two clauses of three have evidence; the middle one does not.** *Clause 1* observed live on `scratch-app` #6 — the opened conversation's ticket comment carries the copy-pasteable command in a fenced block. *Clause 3* is unit-proven: a fake channel drives `inviteToConversation` / `recordConversationOutcome` unchanged, which is the second implementation the hint asks for. *Clause 2* — takeover resolving a waiting ticket and spawning the right stage session — is only **half** observed: every refusal path was run live against the real ledger (a park it cannot resume, an untracked ticket, an unknown project, a malformed target, all with the right guidance), but the success path was not, since it hands the terminal to an interactive session. Left `draft`.
- **Verify-via:** api
- **Criteria:**
    - GIVEN a stage needs a conversation and the project's channel is the terminal
      WHEN the conversation is opened
      THEN the ticket receives a comment whose CTA carries a copy-pasteable `timone takeover <project>#<ticket>` command
    - GIVEN the takeover command runs
      WHEN the CLI resolves the ticket
      THEN it determines what the ticket is waiting on, spawns the correct stage session itself with the event context, and the session re-enters statelessly from the artifacts and the ticket thread ([ADR-0013](../../adr/0013-stateless-session-reentry.md)) — the human names no skill
    - GIVEN the channel implementation
      WHEN a second medium is added
      THEN it plugs in behind the same interface (open a conversation for project/ticket/stage, exchange turns, conclude with an outcome) without changes to the stages that use it
- **Verification hint:** run takeover on a ticket waiting on clarification; complete the conversation; inspect the seam for a second-implementation point (a fake channel in tests suffices as the second medium).

## R15 — Post-session guardrail hooks

- **Priority:** SHOULD
- **Status:** verified
    - ✏ 2026-08-03 verified by fvermaut at [phase 11](../../plans/phases/phase-11.md)'s 11g gate. Both clauses observed against `scratch-app`: a scripted session that committed and never pushed produced **one** loud ticket comment naming the branch and the commit, and the run was flagged in `timone status` (`⚠ 1 automatic check(s) failed`); the clean re-run immediately after, on the same ticket, posted **nothing** — silence asserted, not assumed. Hook failures flag a run but never crash the daemon, and the checks are pure functions over injected git evidence, so each rule can be shown red.
    - ✏ 2026-08-03 **known limit of the evidence.** Only the **unpushed** rule fired live. `STATUS.md` placement and path containment were shown capable of failing only in the test suite — by neutering each check in turn and confirming its violating fixtures went red (9 tests fell over). No live session has yet committed a file at all, so neither rule has met real evidence; phase 13's execution path is what will supply it.
    - ✏ 2026-08-06 **both remaining rules have now met real evidence**, at [phase 13](../../plans/phases/phase-13.md)'s 13h gate: sessions committed real files, `STATUS.md` landed only on the pilot's default branch (first-parent ancestry checked at the gate), and every touched path stayed inside the target project — the placement and containment checks passed against substance rather than absence. Neither has yet *fired* live, because no violation has occurred; their red sides still rest on the test suite, which is the acceptable remainder.
- **Verify-via:** api
- **Criteria:**
    - GIVEN a daemon-spawned stage session completes
      WHEN the guardrail hooks run
      THEN violations of the deterministic rules — commits left unpushed, `STATUS.md` written anywhere but the default branch, files touched outside `projects/<target>/` (process artifacts excepted per R2) — are posted loudly on the ticket and the run is flagged in `timone status`
    - GIVEN a clean session
      WHEN the hooks run
      THEN they stay silent
- **Verification hint:** force each violation in a scripted session against the pilot repo; confirm one loud ticket comment per violation and a flagged status; confirm a clean run posts nothing.
