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

> ✏ Revised 2026-08-09: the grill session of 2026-08-09 ([ADR-0022](../../adr/0022-a-conversation-ticket-can-be-answered-in-writing.md)) gave the waiting ticket a **second answer path beside the takeover** — the human may write the answer as a comment, the daemon picks it up, and one clarifying round is allowed before the session escalates to the terminal. The takeover clause below is unchanged; a clause is added, and the requirement re-enters verification on the new wording.

> ✏ Revised 2026-08-02: the grill session on the conversation medium ([ADR-0012](../../adr/0012-conversation-channels.md)) moved conversations off ticket-comment ping-pong — clarification is a conversation on the project's conversation channel, not a comment thread; the ticket records the CTA and the outcome.

- **Priority:** MUST
- **Status:** failed
    - ✏ 2026-08-11 **`failed` at [phase 18](../../plans/phases/phase-18.md)'s stage-7 pass** ([report](../../plans/phases/reports/phase-18-verification.md)). **Clauses 1 and 2 pass on real tickets** — six `ivtrends` parks carry the exact takeover command and `timone status` shows all six waiting; five more (#5–#9) concluded with substantive `✅ Agreed` records and their runs are `done`. **The added written-answer clause fails.** One written answer reproducibly spawns **two** agent sessions — distinct session ids in the daemon's log and in the ledger, two independently-written full resolutions ~30s apart, both closing the ticket, and the cycle ending `could not resume #NN: Run cannot go from done to done`. Reproduced 2 of 2 on `scratch-app` #21 and #22; on #22 a third session posted an account of the duplication itself. A requirement's status is the weakest of its clauses' outcomes. **Not a regression** — the failing clause is the one added 2026-08-09 and never verified. Stage 6's own completion report predicted the path: *"a double `getTicket` per cycle on the resume path"*.
    - ✏ 2026-08-11 **what is still unwitnessed, and it is no longer the mechanism.** Every clause has now been exercised, but every written answer so far — the gate's on 2026-08-09 and the verifier's on 2026-08-11 — was typed by a machine in a user's voice. Whether a *person* finds the clarifying question reasonable and the escalation timed right is the one judgement no pass has seen, and six live `ivtrends` tickets make it free to obtain. **It must wait for the duplication fix**, or it lands two machine replies on a real product decision.
    - ✏ 2026-08-09 **set `revised` by the amendment above, not by any observed failure.** The evidence below stands for the clauses it was gathered against; it says nothing about the written path, which no pass has seen. A requirement's status is the weakest of its clauses' outcomes, so it leaves the regression set until stage 7 re-verifies it whole.
    - ✏ 2026-08-05 verified by fvermaut at [phase 12](../../plans/phases/phase-12.md)'s 12g gate, on `scratch-app` [#6](https://github.com/fvermaut/scratch-app/issues/6). Clause by clause: **conversation opened** — the pipeline reached the clarification stage on its own and posted a CTA carrying a copy-pasteable `timone takeover scratch-app#6`, naming no stage and no skill; `timone status` showed it waiting, and a second poll cycle changed nothing, so the wait holds rather than re-firing. **Concluded and resumed** — fvermaut ran the command, held the interview to acceptance, and the accepted summary landed on the ticket carrying `CONVERSATION_RECORD_MARKER`; the next cycle read that record and advanced the run to the requirements stage. The summary the interview produced was substantive rather than a transcript: it split the request into two changes and said which one was not being built.
- **Verify-via:** api
- **Criteria:**
    - GIVEN a picked-up ticket with open questions
      WHEN the clarification stage runs
      THEN a conversation is opened on the project's conversation channel — for the terminal channel, a ticket comment carrying a CTA with the exact takeover command — `timone status` shows a waiting gate, and no further stage runs
    - GIVEN the conversation concludes with the human accepting the summary
      WHEN the session closes
      THEN the accepted outcome summary is posted on the ticket and the pipeline resumes incorporating it
    - GIVEN a ticket waiting on a conversation
      WHEN the human writes their answer as a ticket comment instead of taking over
      THEN the daemon picks that comment up, spawns the session for what the ticket was waiting on, and the session resolves it from the written answer without re-asking what was answered — and where the answer leaves something open, it posts only the remainder, once, before handing back the takeover
- **Verification hint:** file a deliberately vague ticket; take over via the posted CTA; run the interview to acceptance; watch the summary land on the ticket and status transition waiting → running. Then, on a second ticket, answer in writing instead: watch the daemon pick the comment up unprompted, and answer that one partially to see the single clarifying round and the escalation that follows it.

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
- **Status:** verified
    - ✏ 2026-08-08 **verified by fvermaut at [phase 16](../../plans/phases/phase-16.md)'s 16e gate**, against a real pull request on the pilot and a **continuously running, attended** daemon — not the `--once` cycles every previous gate used, because previews reconcile per cycle and `--once` cannot show a refresh happening by itself. Both clauses, clause by clause: **a URL that serves the current commit** — one cycle after the run was seeded, [`scratch-app#16`](https://github.com/fvermaut/scratch-app/pull/16) carried a comment giving `http://localhost:55006/`, which served the branch's own change (`Todos — gate A`, absent from `main`), with the worktree's `HEAD` confirmed equal to the pull request's `headRefOid` and the migration job exited `0` before `app` was called healthy; **the port read, not computed** — checked against `docker compose port` rather than an expectation, and across the gate Docker chose `55006`, `55007`, `55008` and `55010`, none of them the project's claimed block, the container's own port, or anything derivable from the pull-request number; **the new commit's build, with exactly one preview URL on the pull request** — a push produced `Todos — gate B` on `55007` within one cycle, the *same* comment revised in place, the old address dead. **The comment count stayed at 1 through every event of the gate**, including a failure and a recovery. Full evidence: [phase-16-live-gate.md](../../plans/phases/reports/phase-16-live-gate.md).
    - ✏ 2026-08-08 **what this `verified` does not cover, recorded here rather than left for a reader to infer** ([ADR-0021](../../adr/0021-previews-are-reconciled-behind-an-adapter-seam.md)). **Phone review is not delivered.** The first adapter serves `localhost`, so a preview is reachable at the machine and nowhere else — and phone review was the thing PRD-02's exposure question named as being at stake. **Nor is a preview reachable while the machine sleeps**: the host serving previews is the host running the daemon. Both arrive with a managed-platform adapter or an always-on host, neither of which is this phase's. **A third gap is procedural**: the gate's pull request was opened by hand and its run seeded, on fvermaut's call, rather than being carried there by the pipeline — so a preview has never been observed appearing on a pipeline-opened pull request. That closes at no cost on the next real ticket that reaches delivery.
    - ✏ 2026-08-08 **two-previews-at-once is proven of the mechanism, not of the loop.** Two stacks ran simultaneously against real Docker with four distinct ports and two distinct volumes — what `compose.yaml`'s header was written for, and what an allocation scheme would have broken. Through the daemon it could not be arranged: R10 serializes work per project and `claimBranch` refuses a second branch while one run holds the project, so one project cannot today have two runs with open pull requests. Not a defect; a ceiling, and it stops being free as projects are added.
    - ✏ 2026-08-08 **both criteria revised at [phase 16](../../plans/phases/phase-16.md)'s 16a.** This is a **specification correction, not an intent change**: R8 has always asked for a running, reachable preview per pull request. What failed was the wording's ability to go red. The old first clause read *"WHEN the **preview stage** runs"* and the old second *"WHEN the **preview refresh** runs"* — both presuppose a mechanism, and under [ADR-0021](../../adr/0021-previews-are-reconciled-behind-an-adapter-seam.md) the first of them **will not exist**: previews are reconciled by the poll loop, `PIPELINE_STAGES` gains no member, and no run enters a preview state. A criterion whose precondition never becomes true cannot fail, so the requirement read as satisfiable by something nobody built. **The replacements name a state the world reaches** — what a reviewer finds on the pull request — and no mechanism at all: not a stage, not a cycle, not Docker. Both **go red against today's code**, where no preview exists anywhere. This is the same fault, found the same way, that [15d](../../plans/phases/phase-15.md) fixed in R18; correcting the second clause as well as the first was 16a's own call, because leaving one mechanism-shaped precondition beside a corrected one would have re-created the fault at the next reading.
- **Verify-via:** api
- **Criteria:**
    - GIVEN an open Timone pull request on a project bound to previews
      WHEN a reviewer opens that pull request
      THEN it carries a URL, and that URL serves a running instance of the pull request's current commit
    - GIVEN a pull request whose branch has moved to a new commit since its preview URL was published
      WHEN the reviewer opens that URL again
      THEN what it serves is the new commit's build, and the pull request still carries exactly one preview URL
- **Verification hint:** open the URL the pull request carries and confirm what it serves matches the branch's head commit; push a visible change, re-open it, and confirm both that the change is there and that no second preview comment has appeared. `docker ps` and `docker compose port` are instruments for the first adapter, not part of the criterion.

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
    - ✏ 2026-08-08 **`draft` stands after [phase 16](../../plans/phases/phase-16.md), and the outstanding clause is named rather than left to be worked out: "the preview reflects the update".** The machinery it was waiting on now exists and R8 is verified — a preview *does* refresh within a poll cycle when a branch moves, watched at 16e. What has still never been observed is the two together: a human review comment carried through remediation **while** the preview refreshes onto the remediation commit. [16e](../../plans/phases/reports/phase-16-live-gate.md) did not reach it, because its fixture pull request was opened by hand rather than carried there by the pipeline, so no feedback session ran on it. **This is now cheap rather than blocked**: the next real ticket that reaches delivery and receives a review comment closes it, with no work of its own.
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
- **Status:** verified
    - ✏ 2026-08-08 **verified by fvermaut at [phase 16](../../plans/phases/phase-16.md)'s 16e gate.** Both clauses. **Stopped and removed within one poll cycle** — [`scratch-app#16`](https://github.com/fvermaut/scratch-app/pull/16) was closed, and the *same* cycle that observed it logged `preview scratch-app!16 released`; the result was then checked against Docker and git rather than against that log line: no container matching `scratch-app-pr-16`, the `scratch-app-pr-16_pgdata` **volume** gone, and the worktree gone from disk *and* deregistered from `git worktree list`. **Volumes and worktrees, not just containers** — the accumulation nobody notices until the disk fills. **Re-opening recreates it on demand** — reopening the pull request brought the preview back one cycle later on a fresh port, serving the branch's head. **No code handles reopening**: a reopened pull request is an open one with no preview recorded, which is what a new one is.
    - ✏ 2026-08-08 **"removed" meant less than it said, and that was found *after* the sign-off.** Containers, volumes and worktrees all went; **built images did not** — 1.5 GB per pull request, permanently, measured on the host during clean-up. 16d's checklist named the three kinds of residue somebody had thought of. **The obvious fix reported success while doing nothing**: `docker compose down --rmi local` silently skips build-only services, because compose fills in a default `image` name during config normalisation and then treats it as custom — no error, no image, no signal. The images are now removed explicitly, filtered on the compose project prefix so a pinned image (`postgres:17.5`) and other previews are out of reach, and the fix was confirmed by inspecting `docker images` after a real teardown rather than by reading the flag's documentation.
    - ✏ 2026-08-08 **release fires once per ending, not once per cycle** — `released` appears exactly once in the whole gate log, across every cycle between the close and the reopen. A merged or closed pull request stays that way forever, so releasing on its state alone would have made work for the rest of the daemon's life.
    - ✏ 2026-08-08 **a preview outliving its run was watched rather than argued.** After the close, run `scratch-app#15` is `done` — terminal — while the reopened preview is `ready` and recorded. That is why the ledger key is top-level rather than a field on a run.
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

> ✏ Revised 2026-08-06: [ADR-0018](../../adr/0018-the-session-bracket-belongs-to-the-hooks.md) moved the bracket out of the daemon's spawner and into `SessionStart`/`Stop` hooks, so the checks now cover **every session at the timone root** — the daemon's and fvermaut's own — rather than daemon-spawned sessions only. The criterion's opening clause widens accordingly, and a fourth rule joins the three: a commit made during the session without a `Timone-Stage` trailer ([ADR-0019](../../adr/0019-timone-authored-commits-carry-a-provenance-trailer.md)). The trigger was a live consequence, not tidiness: the stray `email-alerts` commit that blocked a build on 2026-08-06 came from an interactive session, and would have been caught at once had the existing rules been looking at it.

- **Priority:** SHOULD
- **Status:** verified
    - ✏ 2026-08-08 **verified by fvermaut at [phase 15](../../plans/phases/phase-15.md)'s 15e gate — the fourth criterion now holds on live evidence.** The attribution defect recorded below is fixed: the rules read the `Timone-Session:` trailer and exclude any commit whose trailer names a different session ([the 15e gate report](../../plans/phases/reports/phase-15-live-gate.md)). Observed with the daemon's baseline taken **first**, which is the condition that produced the defect. **A clean session of either kind now produces silence** — the innocent session's `Stop` hook gave no output, no ticket comment, no flag and no journal line. **And the silence was shown to mean something rather than assumed:** run against the same repository state and the same commit, the *author* session reported it by sha while the accused session stayed quiet. The other three criteria were re-observed in the same pass — a daemon violation posted on the ticket and flagged the run, naming **exactly one file** where 14g's comment named three it never touched; an interactive violation printed and journalled with no ticket comment. With three unpushed commits from three sessions in play the daemon session reported **1 file and 1 commit, not 3**, so the inflated count is measured rather than asserted. **The rules were deliberately shown still *firing*, not merely quiet** — a filter that silenced them would be indistinguishable from one that fixed them if the gate only checked for silence.
    - ✏ 2026-08-08 **one deliberate limit of the fix, recorded rather than engineered around.** A commit carrying **no** session trailer is still attributed to whichever session is checking. Such a commit is genuinely unattributable, and over-reporting a real violation is the safe direction; the duplicate provenance line therefore survives by necessity. Observed live at the 15e gate — of three unpushed commits, the two trailed to other sessions were excluded and the untrailed one was kept. It is a test, a comment and an observation, so a later tidy-up cannot remove it silently.
    - ✏ 2026-08-08 **the false accusation on `scratch-app` #11 was corrected publicly**, on fvermaut's decision, and the two flags it raised were cleared from the ledger. Clearing a local flag does not retract a comment on a client's ticket, so a correction naming the cause, the fix and its limit was posted beneath the original rather than the original being deleted — the record of the mistake stays legible.
    - ✏ 2026-08-08 **was `draft` after [phase 14](../../plans/phases/phase-14.md)'s 14g gate, though both session kinds were observed in one pass.** *(Superseded by the 15e entry above; kept because it is the evidence that condemned the rule.)* The re-observation the 2026-08-06 note asked for was obtained: a daemon violation with its loud ticket comment and flagged run, an interactive violation printed and journalled with no ticket comment, and a clean session of each kind falling silent — the silence half on three separate daemon sessions. **It does not flip because the fourth criterion failed on real evidence.** Execution session `82e4d50a` was clean with respect to path containment, and the hooks did not stay silent: they posted a loud comment on `scratch-app` #13's sibling ticket #11, under fvermaut's GitHub identity, naming **three files it never touched**, and flagged the run. The same rule wrote a false line into `.timone/sessions.jsonl` against interactive session `dd86be88`, which had violated nothing. The cause: the rules scope "this session's commits" by diffing against the session's `SessionStart` baseline and **never read the `Timone-Session:` trailer**, so with two sessions open at the timone root the one whose baseline is older is blamed for the other's commits. All three falsely-named commits carried the trailer that would have exonerated the session. Full account and proposed fix in [the 14g gate report](../../plans/phases/reports/phase-14-live-gate.md); routing decision in [the phase 14 completion report](../../plans/phases/reports/phase-14-complete.md).
    - ✏ 2026-08-06 **dropped from `verified` by the revision above, deliberately.** What was verified was the narrower requirement; widening the scope changes what the requirement claims, so the old evidence no longer settles it. The three original rules are unchanged in substance and their machinery is untouched — what must be re-observed is that the bracket still fires for a daemon session now that the spawner no longer calls it, and that it fires at all for an interactive one. Re-verification needs both session kinds in one pass.
    - ✏ 2026-08-03 verified by fvermaut at [phase 11](../../plans/phases/phase-11.md)'s 11g gate. Both clauses observed against `scratch-app`: a scripted session that committed and never pushed produced **one** loud ticket comment naming the branch and the commit, and the run was flagged in `timone status` (`⚠ 1 automatic check(s) failed`); the clean re-run immediately after, on the same ticket, posted **nothing** — silence asserted, not assumed. Hook failures flag a run but never crash the daemon, and the checks are pure functions over injected git evidence, so each rule can be shown red.
    - ✏ 2026-08-03 **known limit of the evidence.** Only the **unpushed** rule fired live. `STATUS.md` placement and path containment were shown capable of failing only in the test suite — by neutering each check in turn and confirming its violating fixtures went red (9 tests fell over). No live session has yet committed a file at all, so neither rule has met real evidence; phase 13's execution path is what will supply it.
    - ✏ 2026-08-06 **both remaining rules have now met real evidence**, at [phase 13](../../plans/phases/phase-13.md)'s 13h gate: sessions committed real files, `STATUS.md` landed only on the pilot's default branch (first-parent ancestry checked at the gate), and every touched path stayed inside the target project — the placement and containment checks passed against substance rather than absence. Neither has yet *fired* live, because no violation has occurred; their red sides still rest on the test suite, which is the acceptable remainder.
- **Verify-via:** api
- **Criteria:**
    - GIVEN any agent session at the timone root completes, whether the daemon spawned it or a human started it
      WHEN the guardrail hooks run
      THEN violations of the deterministic rules — commits left unpushed, `STATUS.md` written anywhere but the default branch, files touched outside `projects/<target>/` (process artifacts excepted per R2), and commits made without a `Timone-Stage` trailer — are reported loudly
    - GIVEN the completed session maps to a run in the ledger
      WHEN a violation is reported
      THEN it is posted on that run's ticket and the run is flagged in `timone status`
    - GIVEN the completed session maps to no run
      WHEN a violation is reported
      THEN it is printed plainly and appended to `.timone/sessions.jsonl`, since there is no ticket to carry it
    - GIVEN a clean session of either kind
      WHEN the hooks run
      THEN they stay silent
- **Verification hint:** force each violation twice — once in a scripted daemon session against the pilot repo, once in an interactive session at the timone root — confirming a loud ticket comment plus flagged status for the first and a printed violation plus a journal line for the second; confirm a clean run of each kind reports nothing.

## R16 — Each stage runs on a model and effort suited to its work

- **Priority:** SHOULD
- **Status:** verified
    - ✏ 2026-08-08 **verified at [phase 14](../../plans/phases/phase-14.md)'s 14g gate.** Every row of the declared table was observed from the daemon's own output — on both the opening `session` line and the closing `cost` line, the latter reporting what the finished session actually billed — across `scratch-app` #11 and #13: **triage on `claude-sonnet-5`, requirements on `claude-opus-5`, planning on `claude-opus-5`, execution on `claude-opus-5`, and the approval record on `claude-haiku-4-5`.** Nothing contradicted the table anywhere. The two clauses a live run cannot show are asserted at the seam in the suite: the request each stage hands the runtime, and that the Haiku-tier row sends no `effort` field at all (`expect("effort" in requests[0]).toBe(false)`). **Known limit of the evidence:** planning's row was observed on a session that then died on an upstream API error before committing its plan, so planning's *model* is proven on #13 and planning's *output* on #11 — the requirement is about the model, but a reader finding #13 `failed` should find the reason here. #13 was filed deliberately because #11 triaged as a **chore**, and a chore routes straight to planning, so requirements was never observable on it.
    - ✏ 2026-08-06 raised by fvermaut and settled at the grill of the same day. Daemon sessions ran on the runtime's default model with no effort set, so a triage read and a whole phase build were served identically. The mapping lives in the stage graph as data (`StageSpec`), not in `timone.yaml`: the graph already holds what a stage waits for and what follows it, and per-stage configuration in a per-project manifest is the wrong shape. **Explicitly no ADR** — it fails the significance gate's first part, being a one-line edit to reverse.
- **Verify-via:** api
- **Criteria:**
    - GIVEN a daemon-spawned session for a stage
      WHEN the session is started
      THEN the runtime is given that stage's declared model, and its declared reasoning effort when the model accepts one
    - GIVEN a stage whose declared model does not support the effort parameter
      WHEN the session is started
      THEN no effort is sent, rather than a value the API would reject
    - GIVEN the approval-recording session, which is not a pipeline stage
      WHEN it is started
      THEN it too carries a declared model rather than the runtime default
- **Verification hint:** assert the request the runtime seam receives for each stage against the declared table; confirm the Haiku-tier row sends no `effort` field at all; observe a live run's stages landing on the intended models.

## R17 — The daemon shows progress while a session runs

- **Priority:** SHOULD
- **Status:** draft
    - ✏ 2026-08-08 **stays `draft` after [phase 17](../../plans/phases/phase-17.md), with the clock half fixed and the token half named as the whole of the remainder.** The two clocks are now labelled rather than reconciled: the tick prints `4h13m elapsed` and the closing line `19m30s working` — 15a's own session, rendered — so the 13× divergence reads as wall time beside awake time, which is what it always was. No arithmetic changed; the three duration shapes are pinned independently of the labels. `duration_api_ms` is **proven** unread by a test whose fixture reports it larger than `duration_ms`, the surprising way round, because on a control run it genuinely was. **What keeps this `draft` is the output-token counter, and nothing else.** It froze at 4.7k for four hours on #13's planning session while replies advanced 8→22, with **no sub-agents in play**, so the fan-out story does not cover it; 15a decoupled it from the clock deliberately and phase 17 touched it not at all. **17c's step 5 — measuring it against `modelUsage` on a live session — was not run**, because that gate was deliberately run without buying an agent session; the clock half was provable from the ledger alone and the token half is not. It rides free on the next real ticket that reaches a long stage. **Nobody may read the clock fix as closing this requirement**, which [the plan said of itself](../../plans/phases/phase-17.md) before the work started.
    - ✏ 2026-08-08 **was `draft` after [phase 15](../../plans/phases/phase-15.md), which measured the cause and deliberately did not fix it — [the fix is phase 16's](../../plans/phases/reports/phase-15-clock-investigation.md), and nobody should read phase 15 as having closed this.** The clock half is now explained: **there are two clocks measuring different things.** The tick's elapsed is `Date.now()`, wall clock, which advances while the machine is suspended; the SDK's `duration_ms` is the session's **awake** time. Both numbers are correct and were presented under one name. The decisive evidence needed no experiment — macOS logs every sleep, and `pmset` over the overnight window shows `Maintenance Sleep` on a ~15m49s cycle: 146 events, median 889s, **113 of them longer than the 2-minute staleness threshold**. The gate had independently described the tick pattern as pairs 30s apart separated by ~15m gaps, which is the same cycle seen from the other side; and at ~45s awake per cycle, the session's 4h13m of wall clock gives ~19m of wake time against a `duration_ms` of **19m30s**. **The token half is explicitly left unexplained and decoupled** — the clock is now accounted for without it, so the two must no longer be assumed to share a fix merely because they were found together. Also recorded there: `duration_ms` and `duration_api_ms` are **not** nested totals (the API figure exceeded the total on a control run), so no fix may assume one bounds the other.
    - ✏ 2026-08-08 **was `draft` after [phase 14](../../plans/phases/phase-14.md)'s 14g gate: the tick fires, and two of the numbers it prints are wrong.** The third criterion is **proven at the byte level** — a pty capture and a file capture of tick-bearing output differ by exactly one carriage return per line and nothing else, zero escape bytes in either, so a redirected file is the same bytes plus nothing. The closing line's authority is also correct. What fails is the first criterion's accuracy. **Output tokens:** under-reported 3.2× on execution, 2.2× on delivery, ~1.04× on the two stages that spawn no sub-agents — and then **5.8× on #13's planning session, which displayed no sub-agent at all**, its replies counter advancing 8→22 while its token counter stayed frozen at 4.7k for four hours. **Elapsed time:** diverged from the SDK's `duration_ms` on four of five sessions, by up to 13×. **Route these as one investigation, not two fixes** — the fifth token measurement and the clock divergence come from the same session, and if suspension drops `message_delta` events while `assistant` messages survive, one mechanism explains both. Evidence in [the 14g gate report](../../plans/phases/reports/phase-14-live-gate.md).
    - ✏ 2026-08-06 raised by fvermaut and settled at the grill of the same day. Today there is total silence between `session started` and the next stage line, which for an execution session is many minutes in which a hung run and a working one are indistinguishable. Output is append-only rather than a repainting status line, because `log()` already fires mid-session (guardrail reports) and would shred a repainting line — and because append-only behaves identically in a terminal, a pipe and a log file.
    - ✏ 2026-08-06 **an accuracy constraint, recorded so it is not "fixed" into a wrong number later:** the live counter is cumulative **output** tokens. Summing per-turn `usage.input_tokens` would report input roughly N× the real prompt for an N-turn session, because every turn resends the whole conversation. Authoritative totals exist only on the final `result` message (`total_cost_usd`, `modelUsage`) and belong on the closing line.
- **Verify-via:** api
- **Criteria:**
    - GIVEN a daemon-spawned session that runs longer than the progress interval
      WHEN the interval elapses
      THEN a line is printed naming the run, the stage, elapsed time, turns taken, cumulative output tokens and the number of live sub-agents
    - GIVEN the session ends
      WHEN its result is read
      THEN one closing line reports the authoritative duration, turns, token usage and cost taken from the result message
    - GIVEN output is redirected to a file or a pipe
      WHEN progress is printed
      THEN it is the same append-only lines, with no cursor control and no interleaving damage to other log lines
- **Verification hint:** run a long stage with a short `--progress-interval` and confirm the tick; compare the closing line's cost against the same session's `total_cost_usd`; redirect to a file and confirm the content is identical to the terminal's.

## R18 — A run orphaned by a crashed daemon is reclaimed

- **Priority:** MUST
- **Status:** verified
    - ✏ 2026-08-08 **`verified` at [phase 17](../../plans/phases/phase-17.md)'s 17c gate, on evidence in both directions.** [ADR-0020](../../adr/0020-liveness-is-judged-only-over-witnessed-time.md) is implemented: the daemon stamps `observedAt` and `observingSince` on the ledger each cycle and may reclaim only where its unbroken watch is at least as long as the staleness window it is judging. **Third criterion, and the one that held this requirement `draft`:** a healthy run whose process was frozen for 150 seconds came back with a heartbeat **161s old against a 120s threshold** — stale by the ledger's own arithmetic, and dead under ADR-0017 — and was **not** reclaimed; the daemon logged that nothing had been watching and why. **First criterion, proven in the same pass and deliberately first:** with the machine awake throughout, a run last alive ten minutes earlier **was** reclaimed at 2m05s, failed with a plain reason, its project freed. **Third criterion:** `timone retry` re-armed it at `execution` with its branch intact. A never-reclaim mutant fails eight tests, so the catastrophic direction is guarded by more than an assertion. **Two limits, named rather than implied.** The gap was produced by a process freeze, not a machine suspend — an instrument [15a validated for exactly this axis](../../plans/phases/reports/phase-15-clock-investigation.md) while rejecting it for the SDK-clock question, and paired with 15a's independent `pmset` measurement that real sleep produces gaps of this shape; one lid-close closes the residual. And the **ticket comment** on reclaim was not exercised at this gate (the fixture repository deliberately does not exist), resting instead on unit tests and on [14g's real crash](../../plans/phases/reports/phase-14-live-gate.md), where it was observed. **A consequence worth reading:** on a laptop cycling ~45s awake per ~15m49s asleep, nearly every overnight cycle is an unwitnessed gap, so a genuinely dead run now waits until the machine is properly awake to be reclaimed. Conservative, deliberate, and a real change to what reclaim promises overnight. Evidence: [the 17c gate report](../../plans/phases/reports/phase-17-live-gate.md).
    - ✏ 2026-08-08 **was `draft` after [phase 14](../../plans/phases/phase-14.md)'s 14g gate, on a measured false-positive path rather than an open worry.** The first and third criteria are observed and correct: a run orphaned by a **real** crash — a stray process signalled every terminal mid-execution — was reclaimed on the next cycle, failed with a plain reason, its ticket commented and its project freed, with `timone status` naming `timone retry`; and `timone retry` re-armed it at the stage it stopped. The middle criterion is the problem. #13's planning session ran overnight across a sleeping laptop: it was alive throughout, and **17 of its 45 tick gaps exceeded the 2-minute staleness threshold, the largest by 8× (16 minutes)**, with ticks reaching 4h13m against a `duration_ms` of 19m30s. **A continuously running daemon would have reclaimed a healthy run seventeen times over**; it survived only because the gate drove `--once` cycles and no poll loop ran beside it. Step 3's false-positive check passed at 59m35s **because the machine stayed awake** — the threshold is safe against long work and unsafe against suspension, which are different claims.
    - ✏ 2026-08-08 **the hazard is now confirmed outright, and [phase 15](../../plans/phases/phase-15.md) deliberately did not fix it — [the fix is phase 16's](../../plans/phases/reports/phase-15-clock-investigation.md).** ADR-0017 stamps `heartbeatAt` only when the tick fires, and staleness is four intervals — 120 seconds. The operating system's own log shows **113 suspensions longer than that in a single overnight window**, on a ~15m49s `Maintenance Sleep` cycle. A continuously running daemon would have reclaimed healthy runs on every one of them. **This rests on direct measurements of the tick and on the OS log, not on any claim about the SDK's clock**: a verified process-tree freeze reproduced the signature exactly — one tick where eighteen should have fired. **The operational warning therefore stands until phase 16 lands:** do not leave `timone daemon` running unattended overnight on a laptop that sleeps.
    - ✏ 2026-08-08 **middle criterion revised at [phase 15](../../plans/phases/phase-15.md)'s 15d, and the requirement stays `draft`.** It now reads *"a run whose session is alive and its work progressing … left untouched, however long the session has been running, and whatever has happened to the host machine meanwhile"*. The revision is a **specification correction, not an intent change**: R18 has always meant that a live run is not killed: what failed was the wording's ability to go red. The old precondition — *"alive **and still stamping its heartbeat**"* — presupposed the mechanism, so a suspended session (alive, not stamping) fell outside the criterion entirely and the requirement read as satisfied by a run that would in fact have been reclaimed. The new wording names no mechanism — not sleep, not a clock, not a threshold — and **goes red on the overnight session 14g measured**, which is the property the old one lacked. [The 15a finding](../../plans/phases/reports/phase-15-clock-investigation.md) is what made it safe to write: the criterion could not be reworded without presupposing a mechanism while the mechanism was still a guess.
    - ✏ 2026-08-08 **the middle criterion's wording was inadequate, and this is why** *(superseded by the revision above, kept because the reasoning is the reason the requirement is still `draft`)*: It reads "a run whose session is alive **and still stamping its heartbeat**" — but a suspended session is not stamping, so the sleep case slips through the criterion's own precondition and the requirement can be read as satisfied by a run that would in fact be killed. The replacement must say *healthy runs are never reclaimed*, in terms that do not presuppose the mechanism. Recorded as a finding in its own right at [the phase 14 completion report](../../plans/phases/reports/phase-14-complete.md).
    - ✏ 2026-08-06 carried out of [phase 13](../../plans/phases/phase-13.md) as an open question — *"a crashed daemon has no recovery path"* — and settled at the grill of 2026-08-06 by [ADR-0017](../../adr/0017-a-runs-liveness-is-its-heartbeat.md). A process killed mid-session left its run `active` forever, holding its project against every other ticket, with `timone retry` refusing it by design. Detection is the R17 heartbeat rather than a startup sweep, so it stays correct when two daemons run; reclaim fails the run rather than resuming it, because a crash mid-stage can leave partial commits.
- **Verify-via:** api
- **Criteria:**
    - GIVEN a run whose daemon was killed mid-session
      WHEN a daemon polls and finds the run `active` or `picked-up` with a heartbeat older than the staleness threshold
      THEN the run is failed with a plain reason, the failure is posted on its ticket, its project is released and any queued run for that project is promoted
    - GIVEN a run whose session is alive and its work progressing
      WHEN any daemon polls
      THEN the run is left untouched — however long the session has been running, and whatever has happened to the host machine meanwhile
    - GIVEN a run reclaimed this way
      WHEN `timone retry` is invoked for it
      THEN it is re-armed at the stage it was reclaimed from, exactly as any other failed run
- **Verification hint:** kill a daemon mid-execution and confirm the next daemon reclaims the run, comments, and frees the project; run a long stage to completion and confirm no reclaim fires; confirm `timone retry` then re-arms the reclaimed run.

## R19 — Machine-authored commits are identifiable from git history

- **Priority:** SHOULD
- **Status:** verified
    - ✏ 2026-08-08 **verified at [phase 14](../../plans/phases/phase-14.md)'s 14g gate, on every clause.** The phase-05 range on `scratch-app` holds **thirteen machine-authored commits and thirteen complete trailers**, across five stages and five distinct sessions whose ids match the daemon's own log line for each stage — so `git log --grep=Timone-Stage` is a **complete** index of the machine's work rather than a partial one, which is what the requirement is actually about. No harness *file* appears in any diffstat across all history (the widened probe's three hits are commit-message prose naming `process.md` and `standards/testing.md`, written by execution when it amended its own plan). The interactive side holds in both directions: Timone's own commits carry the trailer with the session that made them, and fvermaut's deliberate `142edde "stray"` carries none — which is precisely why R15's provenance rule fired on it, closing the verification hint's third clause.
    - ✏ 2026-08-08 **the attribution defect is not a reason to hold this requirement down**, and the temptation to bundle them was resisted deliberately. R19 asks that the trailer be *written*; it was, on everything, without exception. That R15's rule fails to *read* it is R15's problem — and the trailer's completeness is what makes that defect fixable at all, since all three falsely-attributed commits carried the trailer that would have exonerated the session. Holding R19 down would penalise the one mechanism that worked.
    - ✏ 2026-08-06 settled at the grill of 2026-08-06 by [ADR-0019](../../adr/0019-timone-authored-commits-carry-a-provenance-trailer.md), extending the `MACHINE_MARKER` convention from ticket comments to commits. The trigger was a live consequence: a stray commit that blocked a build could only be attributed by reconstructing a session from memory. The existing `Co-Authored-By` line does not serve — it names the model, appears identically on machine- and human-driven work, and every Claude Code session anywhere emits it.
    - ✏ 2026-08-06 **enforcement is R15's, not this requirement's.** A convention binds only the sessions that follow it, and a human-driven session follows no skill; the `Timone-Stage` rule added to R15's hook is what makes it a fact rather than a hope.
- **Verify-via:** api
- **Criteria:**
    - GIVEN a commit made by any Timone session, in the timone repository or a managed project
      WHEN the commit message is read
      THEN it carries `Timone-Stage` and `Timone-Session` trailers, plus `Timone-Run` when a run drove it
    - GIVEN a session with no run in the ledger
      WHEN it commits
      THEN the trailer records the stage as `interactive` and carries no `Timone-Run` line, so the absence is a statement rather than an ambiguity
    - GIVEN a managed project's repository
      WHEN `git log --grep=Timone-Stage` is run from any clone
      THEN every machine-authored commit since the convention landed is listed, and no harness *file* has been added to the repository (R2 stands, narrowed to files)
- **Verification hint:** inspect the trailers on a daemon-driven phase's commits and on a deliberate interactive commit; confirm the R15 hook flags a commit made without one; confirm `git log --stat` still matches no harness path.

## R20 — Wayfinder decision tickets participate in the loop

> Added 2026-08-09 by [ADR-0022](../../adr/0022-a-conversation-ticket-can-be-answered-in-writing.md). A wayfinder map's decision tickets ([ADR-0010](../../adr/0010-wayfinder-discovery-maps.md)) are created by an interactive stage-2 session straight through `gh`, so they have never had a run in the ledger and the daemon has never known they exist. That was not a design choice — it is why `ivtrends` #5–#13 stood open on 2026-08-09 as questions with no instruction, and why `timone takeover ivtrends#5` refused. This requirement is what makes them first-class.

- **Priority:** MUST
- **Status:** failed
    - ✏ 2026-08-11 **`failed` at [phase 18](../../plans/phases/phase-18.md)'s stage-7 pass** ([report](../../plans/phases/reports/phase-18-verification.md)), on the second criterion, which is the one this requirement's own preamble is written around. Probed at its literal precondition: `scratch-app` #20, open, `wayfinder:grilling`, deliberately unmarked, **zero runs in the ledger** — `node dist/cli.js takeover scratch-app#20` answered *"I'm not working on scratch-app #20. Add the `timone` label…"* and exited 1. The criterion asks it to resolve **from the tracker** and spawn the stage-2 session; it refuses, with the same sentence the requirement exists to abolish. **This is a deliberate divergence, not an oversight** — phase 18's load-bearing decisions rejected the tracker-resolution path by name and rely on the wayfind skill marking tickets at creation instead. Whether the criterion is mechanism-shaped and wants the correction [R8](#r8--docker-preview-per-pull-request) and [R18](#r18--a-run-orphaned-by-a-crashed-daemon-is-reclaimed) both received, or the path is genuinely owed, is a specification decision for stage 9 rather than something a fix context may guess at. **The gate's control for this step did not hold:** it cites `scratch-app#20` refusing, but on 2026-08-09 that issue did not exist — it tested a missing ticket, not an unmarked wayfinder one. The conclusion survives the correction; it simply had not been tested. The spawn-and-re-enter half has still never been observed end to end — the gate called `resolveTakeover` directly, and the five `ivtrends` takeovers that did complete all had ledger runs, so none meets this clause's GIVEN.
    - ✏ 2026-08-11 **the first criterion is observed for one of the four ticket types it names.** `grilling` carries both paths verbatim on six real `ivtrends` tickets and two fixtures. `research` and `task` have no post-phase instance on either project. `prototype` exists only as `ivtrends` #11, which is *blocked* and so carries "nothing right now" rather than the takeover — outside the clause's "a human is expected to act on", therefore not a failure and not evidence either. All three arrive free with the next map charted. **A live contradiction found in the surface this clause governs:** `timone status` asks the human to *"answer on … ivtrends #11"* while #11's body says nothing is needed — the operator-visible cost of the gate's finding 2, that the daemon has no notion of blocking.
    - ✏ 2026-08-11 **the third criterion reaches its stated end state by a mechanism that is not sound.** The answer is picked up unprompted and the ticket resolved and closed with nothing run by hand — watched twice — but **two** sessions do it. See [R3](#r3--async-clarification-via-a-conversation)'s 2026-08-11 marker; it is the same defect and the same evidence.
- **Verify-via:** api
- **Criteria:**
    - GIVEN a wayfinder decision ticket a human is expected to act on
      WHEN its body is read
      THEN it carries a CTA worded for its type — both answer paths for `grilling` and `task`, the takeover alone for `prototype`, an explicit "nothing needed" for `research`
    - GIVEN a wayfinder ticket with no run in the ledger
      WHEN `timone takeover <project>#<n>` is run against it
      THEN it resolves what that ticket is waiting on from the tracker, spawns the stage-2 session for it, and the session re-enters from the map, the ticket and the repository alone ([ADR-0013](../../adr/0013-stateless-session-reentry.md))
    - GIVEN an open, claimed wayfinder ticket the human has answered in writing
      WHEN the daemon next polls the project
      THEN it picks the answer up and spawns the session that resolves the ticket, without the human running anything
- **Verification hint:** read a freshly charted map's tickets for their CTAs; run takeover against one with no ledger run and confirm it opens the right conversation; answer another in writing and confirm the daemon acts on the comment unprompted.
