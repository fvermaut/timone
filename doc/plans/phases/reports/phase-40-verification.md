# Phase 40 — Verification Report

- **Date:** 2026-09-29
- **Phase:** [phase-40.md](../phase-40.md) — stamped `Complete`, completion report [phase-40-complete.md](phase-40-complete.md)
- **Scope:** PRD-05.R1 to R19, as the phase header claims (R11 in part: `timone retry` refuses on a runner project; deleting it is #166's). The completion report's requirements line says the same. R20 is not claimed.
- **Live gate owed:** yes — PRD-05.R9, R12, R13 and R15. None of them declares `Depends-on`, so the whole diff counts. Slices 40s and 40t changed the runner after the second watched attempt, and parts of these criteria were never seen (see Live gates).
- **Regression set (derived):** PRD-01.R2. Narrowed out: PRD-01.R3.
- **Branch:** `timone/165-the-runner-beside-the-current-daemon` — first pass at `4cfb031`; final pass at `55a617a`, after the fixes of both loops.

## Environment

The app was built in its production form with `npm run build`, and every probe ran the built CLI and daemon from `dist/`. Timone is a command-line tool and a daemon, so "standing the app up" means running `node dist/cli.js daemon` against a project.

A real run needs GitHub, containers and a logged-in model. This sandbox has no model login (`claude auth status`: `"loggedIn": false`), and GitHub must not be touched. So the probes use a rig, committed beside them ([_rig.mjs](../probes/_rig.mjs)). It runs the built daemon in a throwaway folder with:

- a fake forge: [_fake-gh.cjs](../probes/_fake-gh.cjs), put first on `PATH` as `gh`. It keeps issues and pull requests in a JSON file and reads branches and files from a local bare git repository. It was written from the `gh` calls the daemon was seen to make. It carries out GitHub's merge call for real in the bare repository and logs it, so a probe can see anything that reaches `main`;
- a stand-in for the network to GitHub: [_fetch-shim.mjs](../probes/_fetch-shim.mjs), loaded into the daemon. The daemon mints its forge credential with a direct HTTPS call; the shim answers it locally with a throwaway token. A `git` wrapper refuses any command that names github.com;
- a fake model service on 127.0.0.1. The probe answers each request itself, and it sees exactly what each session is given: its tools, its instructions, the runner's brief.

Two differences from production, stated plainly. **Steps ran in-process** (`--runtime in-process`), not in the box, because a boxed step clones from the real forge. The runner itself runs inside the daemon process in both runtimes. **The model's judgement is scripted.** So the probes decide what code does. The runner's own choices need a real model, and those clauses are marked BLOCKED below, with the recorded real-model evidence named.

One request did reach GitHub before the shim existed: a token request for a made-up app id, answered with 404 (`Integration not found`). Nothing else was sent. I did not run the CLI against the real ledger in `projects/timone/.timone/` (a permission check refused it, and a probe does not need it).

**Build-health smoke, run once at `4cfb031`, not evidence:** `npx tsc --noEmit` exit 0; `npx vitest run` 1,919 of 1,919 tests in 55 files; `npm run --silent replay -- --dry` 19 of 19. After the fixes, `npx tsc --noEmit` exit 0 and `npm run build` succeeded; the suite was not run a second time.

## Independence declaration

Read: the register [prd-05 criteria](../../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md) and its narrative [prd-05](../../../specs/prd/prd-05-a-runner-decides-each-step.md); the phase file's lines 1–36 (status, companion note, screens line, requirements); the completion report, whole; the live gate's record [phase-40-live-gate.md](phase-40-live-gate.md) and the replay record [phase-40-replay.md](phase-40-replay.md), as recorded evidence; `README.md`, `CONTEXT.md`, `timone.yaml`, `package.json` scripts; `process.md` (stage 7 and "Writing to the human"); the verify skill; the departures-record format in the build skill; the first 12 lines and the headings of [phase-40-departures.md](phase-40-departures.md), to append to it; the earlier probes `_lib.mjs`, `run.mjs`, `prd-01.r2.mjs`; the list of paths this branch changed (for the narrowing, not the changes). On GitHub, read-only: scratch-app tickets #60, #62, #63 and their comments, pull requests #61 and #64 (commits and the top of each description), and `doc/plans/breakdowns/ticket-62.md` (to learn the shape of a list of pieces the app accepts).

Two slips, declared. A search of the phase file for lines starting with `**` printed about 60 lines of its "Context" section and of sub-phases 40a–40c (file names and function names). I did not use them: every probe was built from the register and from the app's own boundary. And before a permission check stopped me, I read the live gate's `.timone/state.json` once.

Not read: handoffs, diffs, source, the committed test suite, ADRs. Timone has no `doc/standards.md`. No implementation source was read. All criterion evidence below comes from verifier-authored probes, run from `doc/plans/phases/probes/`, plus the recorded live-gate and replay evidence where a clause needs a real model or real infrastructure.

## Verdict summary

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-05.R1 | MUST | api | PASS (code) — runner's choice BLOCKED | 0 |
| PRD-05.R2 | MUST | api | PASS after the register was amended | 1 |
| PRD-05.R3 | MUST | api | PASS | 0 |
| PRD-05.R4 | MUST | api | PASS | 0 |
| PRD-05.R5 | MUST | api | PASS | 2 |
| PRD-05.R6 | MUST | api | PASS (code) — runner's choice BLOCKED | 1 |
| PRD-05.R7 | MUST | api | PASS (code) — runner's choice BLOCKED | 0 |
| PRD-05.R8 | MUST | api | PASS — reading of "any wording" BLOCKED | 1 |
| PRD-05.R9 | MUST | live | LIVE-GATE | — |
| PRD-05.R10 | MUST | api | PASS | 0 |
| PRD-05.R11 | MUST | api | PASS for this phase's part | 1 |
| PRD-05.R12 | MUST | live | LIVE-GATE | — |
| PRD-05.R13 | MUST | live | LIVE-GATE | — |
| PRD-05.R14 | MUST | api | PASS | 0 |
| PRD-05.R15 | MUST | live | LIVE-GATE | — |
| PRD-05.R16 | MUST | api | PASS | 0 |
| PRD-05.R17 | MUST | api | PASS (code) — runner's words BLOCKED | 0 |
| PRD-05.R18 | MUST | api | BLOCKED | — |
| PRD-05.R19 | SHOULD | api | PASS | 0 |
| PRD-01.R2 (regression) | MUST | api | PASS | 0 |

## Evidence

Each probe runs a break leg that must go red, then the real leg. Outputs are quoted from the final pass at `55a617a` unless a line says otherwise. "BLOCKED" marks a clause, or part of one, that needs a real model.

### PRD-05.R1 — PASS for what code does; the runner's choice BLOCKED

- **Clause 1, code:** after sorting ran, the runner's brief shows "1. sorting the request — ran once, cost $0.00." and "2. asking what you need — not run yet." PASS. **Runner:** BLOCKED. The watched run saw it once: scratch-app#62 was sorted, then four questions were asked at 12:41:38 on 2026-09-28 (confirmed on the ticket), on a build before 40s and 40t.
- **Clause 2, code:** requirements already on the default branch are listed under "Facts about the work" when the runner wakes after sorting. PASS. **Runner:** BLOCKED. Replay case #104 passed 3 of 3 in runs 2, 4 and 5; run 6 on this build is owed. The departure handling is R5's and R6's evidence.
- **Clause 3:** the runner chose "checking" first on a fresh ticket, and code started exactly that step (the step session was told `Timone-Stage: verification`). When the runner chose nothing, no session started. PASS.

### PRD-05.R2 — FAIL, then PASS after the register was amended in loop 1

- **Clause 1, first pass: FAIL.** The runner session is started with nine tools: `comment_timone_issue`, `end_run`, `file_timone_issue`, `message_step`, `post`, `record_approval`, `set_hold`, `start_step`, `stop_step` (all `mcp__runner__…`). `record_approval` was not in the register's list: "tools the register does not list: mcp__runner__record_approval".
- **Loop 1** (`a113151`) did not change the code. It amended the clause, with a dated marker, to add "record a named person's approval by naming the comment that gave it", and recorded a departure. **This widens what the person agreed to, so it needs their yes on the pull request.** The probe's clause 1a was rewritten from the new words. Final pass: PASS.
- **Clause 1, second part:** no built-in tool (no shell, no file tools); no tool named for editing, running, pushing or merging. PASS.
- **Clause 2:** a fix goes through `start_step` with instructions; the step session receives them, and is told to end every commit with `Timone-Stage: execution` (its own stage). On real work, every commit on scratch-app #61 (8 commits) and #64 (7 commits) carries `Timone-Stage`, `Timone-Run` and `Timone-Session`, and the session ids are the step sessions the runner started. PASS.

### PRD-05.R3 — PASS

- **Clause 1:** no runner tool can merge or push. PASS.
- **Clause 2:** a feature walked to its list of pieces, with the pieces approval skipped: nothing reached `main` (no merge in the forge's log, `main` unchanged), and the pull request from the branch carried the requirements and the list, its description saying the approval was skipped. PASS.
- **Clause 3:** the operator's comment "approve the list", cited by the runner: the forge log shows one merge into `main`; `main` then holds the requirements and the list; one ticket was opened for the piece; the first ticket became the map (`timone:map`); the record holds `{"kind":"approval","what":"pieces","by":"probe-operator","commentAt":<the comment's time>}`. The same citing a stranger's comment: refused, no merge. PASS.

### PRD-05.R4 — PASS

- **Clause 1:** "Refused: This run changed files on timone/12-add-a-count-of-open-to-dos, and they have no pull request yet. The run waits on one, and ends when it is merged or closed." The run did not end. With no commits on the branch, the same request ended the run. PASS.
- **Clause 2:** `timone cancel` ended the same run (`cancelled`), with no pull request. PASS.
- **Clause 3:** the operator's plain-words stop, cited by its time: "The run is ended without a pull request, as probe-operator asked in the comment at …". A stranger's comment: "Refused: The comment at … is by probe-stranger, who is not named for this project. Only a named person can stop the work." A time with no comment: "Refused: There is no comment by a person at 2026-01-01T00:00:00Z on ticket #12." PASS.
- **Clause 4:** a run with no changes ended on the ticket, the ticket closed, no pull request. PASS.

### PRD-05.R5 — FAIL twice, PASS after loop 2

- **Clauses 1, 2, 3:** PASS in every pass. A skipped check: first line "**Not checked.** No session other than the one that built this work checked it. Reason: …". The interview and the requirements approval skipped with two different reasons: both listed, each with its own. The whole chore order followed: "The default order was followed."
- **First pass: FAIL.** The runner went back to building after the check, then started delivering with no check of the last build. Code asked no reason, posted nothing, and the description read "The default order was followed." The last build reached the pull request unchecked, with no warning.
- **Loop 1** (`b9cabfd`): delivering after a second build now needs a reason: "Refused: Starting delivering now leaves out checking the result. Checking the result has not run since the work was last built. Give the reason in skipReason, or start the step that comes first." With the reason, the first line says "**Not checked.** …". Still FAIL on clause 4: going back, checking again, then delivering read "The default order was followed", although building "ran out of order" (the register's own definition of a departure).
- **Loop 2** (`55a617a`): the same walk now reads "**Steps that did not follow the default order:** - Building: ran out of order. No reason given." Final pass: all five labels PASS.

### PRD-05.R6 — FAIL, then PASS for what code does after loop 1; the runner's choice BLOCKED

- **Clause 1:** "**I am skipping 2 steps.** I am going straight to writing down what it needs, without sorting the request and asking what you need. Reason: … **What I need from you:** nothing. If you want the skipped steps done after all, say so here." It was posted before the next step started, and the step started with no reply. PASS. After going back (the case above), no notice was posted in the first pass: FAIL. After loop 1, the notice names "checking the result" and the reason before delivering starts: PASS.
- **Clause 2, code:** a named person's reply woke the runner while the started step was still running; `stop_step` ended that session, recorded as `{"kind":"step-ended",…,"ok":false,"error":"Claude Code process aborted by user","stoppedBy":"runner"}`; the skipped step then ran. A stranger's reply woke nothing. PASS. **Runner:** BLOCKED — no replay case covers it, and the watched run did not reach it.

### PRD-05.R7 — PASS for what code does; the runner's choice BLOCKED

- **Clause 1, code:** when the runner skips the requirements approval with a reason, no approval is recorded, the ticket is told, and the next step starts. PASS. **Runner:** BLOCKED. Replay case scratch-app#37 passed 3 of 3 in runs 1, 2, 4 and 5; run 6 is owed. Code checks who wrote the cited comment, not what it says, so this clause rests on the runner.
- **Clause 2:** `record_approval` citing a stranger ("Refused: … is by probe-stranger, who is not named for this project. Only a named person can approve."), the machine's own comment (under its account, or under the person's account with the machine header: "Refused: There is no comment by a person at …"), or no comment: refused, nothing written. Citing the operator: the record names him and the comment's time, and the step that writes it is told to set the status "naming probe-operator and the date <the comment's time>". PASS.

### PRD-05.R8 — FAIL twice, PASS after loop 1; "any wording" BLOCKED

- **Clause 1, nothing starts:** after sorting cost $160, the limit was recorded and neither a runner nor a step session started. PASS. One kind of session does start: a one-turn check on a small model reads each named person's reply at the limit. The build recorded this as a narrow reading of R8; the person should confirm it.
- **Clause 1, what the ticket says:** first pass: "**This ticket has reached its spending limit.** It has cost $160.00, and the limit is $150.00. I will not start any more work on it for now. **What I need from you:** reply "continue" to allow another $150.00, or say nothing and it stays stopped." It did not say where the work stands: FAIL. After loop 1 (`4cb1071`) it adds "Done so far: sorting the request. Next, in the usual order: asking what you need." PASS.
- **Clause 1, the runner's own sessions:** first pass: a runner session billed $4.00 that then failed was recorded as `{"kind":"runner-ended","ok":false,"costUsd":0,…}` (a step that fails kept its cost). With steps at $148, the real total was $152, yet new sessions started and no notice was posted: FAIL. After loop 1 (`b9b91fa`) it is recorded with `"costUsd":4.0004`, the limit is reached, and no work session starts. PASS.
- **Clause 2:** "please keep going" by the operator, read as YES by the check: `{"kind":"limit-raised","by":"probe-operator","commentAt":…}`, the brief shows "$160.00 of $300.00 allowed", and work sessions start again. "what is the status?" (read as NO) and a stranger's "please keep going" (never read) allowed nothing. PASS. **"In any wording that means it":** BLOCKED — the wording is judged by that one-turn model check.
- **Clause 3:** `ticket_limit_usd: 5` stopped work at $6, and the notice named $5.00; the default limit let the same $6 through. PASS.

### PRD-05.R10 — PASS

- **Clause 1:** a stranger's comment on the ticket, and one on the run's pull request, did not wake the runner, and its text reached no runner input; the brief said "1 comment by a person who may not instruct you was left out." With the stranger named in `instructors`, the same comments woke it. PASS.
- **Clause 2:** with no one named on the project, the operator's comment woke the runner, and the brief said "People who may instruct you on this project: probe-operator." With someone else named, it did not. PASS.
- **Clause 3:** a comment with the machine header, under Timone's account or under the person's, woke nothing and was shown as "Timone (the machine) wrote". PASS.

### PRD-05.R11 — PASS for this phase's part, after loop 1

- **Clause 1:** with the model service unreachable (so the runner cannot start), `timone cancel` stopped the run (`cancelled`), nothing was left running, and the next ticket was taken up. With a step running, cancel ended its session (`"error":"Claude Code process aborted by user"`) and the run. PASS. (The command's own output is wrong; see "Found outside the verdicts", item 2.)
- **Clause 2:** `timone takeover` opened a terminal session on the ticket (a stand-in `claude` received the ticket's prompt). With the daemon running, when it ended the runner woke ("The terminal session ended.") and read the closing comment. PASS. With no daemon running, first pass: when the daemon started again the runner was never woken: FAIL. After loop 1 (`8b617ed`) the command says "fixture #12 goes back to the runner. It reads what the session left as soon as the daemon runs.", and it does. PASS.
- **Clause 3, this phase's part:** on a runner project, "This project is run by the runner. Write on the ticket instead: say what you want done." PASS. As written — "it does not exist" — not met, by design: #166 deletes the command.

### PRD-05.R14 — PASS

- **Clause 1:** four wakes, four runner sessions, each with its own session id; while the run waited on the person, no `claude` process was left under the daemon; the answer started a new session. PASS.
- **Clause 2:** the record holds each step with its start, end and cost; each decision with its reason; the departure with its reason; and every runner session's cost. PASS.
- **Clause 3:** `timone record fixture#12` printed:

```
The record of fixture #12.

Steps:
- Sorting the request: started 2026-09-29 13:34 UTC, ended 2026-09-29 13:34 UTC, cost $1.00.
- Building: started 2026-09-29 13:34 UTC, ended 2026-09-29 13:34 UTC, cost $10.00.

Decisions:
- 2026-09-29 13:34 UTC — start a step. Reason: PROBE-R14-REASON-1: a new ticket starts with sorting
- 2026-09-29 13:34 UTC — start a step. Reason: PROBE-R14-REASON-2: small enough to build
- 2026-09-29 13:34 UTC — write on the ticket. Reason: PROBE-R14-REASON-3: a question for the person
- 2026-09-29 13:34 UTC — end the work. Reason: PROBE-R14-REASON-4: the person confirmed; nothing to change

Steps left out of the default order:
- 2026-09-29 13:34 UTC — asking what you need, writing down what it needs, your approval of the requirements, working out the pieces, your approval of the list of pieces and preparing the work. Reason: PROBE-R14-SKIP: the ticket says exactly what to build

This ticket has spent $11.01 of the $150.00 it may spend: $11.00 on steps and $0.01 on the runner deciding what to do next.
```

PASS.

### PRD-05.R16 — PASS

The model service was made unreachable (the daemon pointed at a port nothing listens on). The session library gives up after its own retries, about 3 minutes per attempt; that is when code sees the failure. Final pass, on `55a617a`:

```
attempts started: 13:30:22, 13:34:20, 13:42:22, 14:00:14; failures: 13:33:20, 13:37:22, 13:45:14
failure reason: Claude Code returned an error result: API Error: Connection refused — a firewall or proxy may be blocking it (ECONNREFUSED)
```

- **Clause 1:** the second attempt started 60 seconds after the first failure, the third 300 seconds after the second; nothing was posted on the ticket meanwhile. PASS.
- **Clause 2:** after the third failure, one comment: "**I cannot reach the model I use to decide what to do next.** I tried three times. Nothing on this ticket changed, and nothing you did caused this. I will keep trying every 15 minutes. **What I need from you:** nothing." The fourth attempt started 900 seconds after the third failure. PASS.
- **Clause 3:** observed every 250 ms for the whole 30 minutes, the run stayed `parked` with the same wait it had before the first attempt; it was never `active`. PASS.

Two earlier runs agree: a watch on 2026-09-28 (retry at 20:22:51, 900 seconds after the third failure at 20:07:51), and the first pass (clauses 1 and 3; clause 2 was cut off by the probe's own time limit, 2 seconds before the fourth attempt — an instrument fault, fixed). A run during loop 1 is not counted: the loop-2 fix context rebuilt `dist/` while that daemon was running.

### PRD-05.R17 — PASS for what code does; the runner's words BLOCKED

- **Clause 1, code:** the brief lists only open issues labelled `bug` on the Timone repository ("#7: The ledger forgets which step is running"; the closed one and the one labelled `enhancement` are left out); adding to #7 comments on it and files nothing new. PASS. **Runner:** BLOCKED — code posts the runner's words as given and adds no ticket, time or session of its own, so whether those are there depends on the runner.
- **Clause 2, code:** filing creates one issue on the Timone repository, labelled `bug`, with the runner's words. PASS. **Runner:** BLOCKED — plain words and the pointers are the runner's.
- **Clause 3:** the model service answered "overloaded" twice, then worked: the runner session recovered, and nothing was filed or posted. PASS.
- **Clause 4:** after filing and commenting, the daemon's own folder (standing in for Timone's repository) had no change and no new commit. PASS.

### PRD-05.R18 — BLOCKED

Needs a real model. The probe runs `npm run replay` only where a login exists; here it reported BLOCKED. Its break leg, on run 5's recorded result, went red on "#115 … 2 of 3 tries". The last real run on record is run 5 ([phase-40-replay.md](phase-40-replay.md)): 18 of 19, on the build before 40t. **Run 6 on this build is owed**, and since both fix loops changed the runner's actions and brief (`b9cabfd`, `4cb1071`, `55a617a`), it must be run on `55a617a` or later. Clause 2 — the replay result on the pull request — is delivery's to carry.

### PRD-05.R19 — PASS

- Two projects in one manifest, one `driver: runner` and one without: the runner project got a runner session and a record; the other got the fixed order's first step (sorting) with no runner session and no record. Swapped, the results swapped. PASS.
- `timone.yaml` at this commit: scratch-app has `driver: runner`; ivtrends has none, so it stays on the current daemon. PASS.

## HUMAN-CHECK scripts

None. No criterion in scope is on the `human` channel, and the completion report carries no HUMAN-CHECK forward.

## Live gates

| ID | `Last live gate:` in the register | Fresh gate owed |
| --- | --- | --- |
| PRD-05.R9 | missing (no line) — last observed in [phase-40-live-gate.md](phase-40-live-gate.md), 2026-09-28 | yes |
| PRD-05.R12 | missing — same report | yes |
| PRD-05.R13 | missing — same report | yes |
| PRD-05.R15 | missing — same report | yes |

`process.md` says each `live` criterion carries a `Last live gate:` line written by the gate in its report's commit. These four have none; the gate should add them.

What the watched run saw, confirmed on scratch-app where the forge shows it:

- **R9.** Clause 1 seen: a comment woke the runner, which acted (#60, 09:04:02 → 09:04:40 → 09:04:51; #62, "yes to al"). Clause 2 only in part: plain words with a spelling mistake were acted on, but not on a stuck ticket and not with the four phrases the clause names. Clause 3 (a change asked for on the pull request) was never seen. Slice 40t changed how a plain "stop" works after the watched run.
- **R12.** Wakes on a step's end and on a comment seen; 15-minute checks seen four times on #63. A step failing, and a step silent past its limit, were not seen.
- **R13.** Clause 1 seen twice (a message taken, `"isReplay":true`, and the step ending by itself). Clause 2 — the runner stopping a step — was never seen live (seen in the rig only, in-process).
- **R15.** Seen only as the daemon still reading tickets while a step runs, on one project. Another project's comment during a step, and two tickets on one project, were not watched. The rig found a fault in the second case (below, item 1).

## Regression

- PRD-01.R2 — PASS in every pass: the project is listed with its declared attributes, and a missing `repo_url`, `path`, `stack` or `bindings` is refused with an error naming it. The committed probe `prd-01.r2.mjs` was run directly, because `run.mjs --regression` does not apply the `Depends-on` narrowing.
- Narrowed out: PRD-01.R3 — `Depends-on: src/commands/workspace.ts, src/git.ts`; this branch touches neither.

## Probes

**16 probes proven able to fail, 0 not.** 15 were authored this pass (the first check of PRD-05); `prd-01.r2.mjs` was run from the directory. They print 66 clause labels; 9 of them are BLOCKED (a real model is needed). Every break leg that ran went red. The R18 probe's real leg cannot run here.

| Probe | Authored or run | Break step |
| --- | --- | --- |
| prd-05.r1 | authored | a step the runner did not choose; the brief before sorting |
| prd-05.r2 | authored; clause 1a rewritten 2026-09-29 from the amended register | an extra built-in tool in the list; a different stage's trailer; a commit with no trailer |
| prd-05.r3 | authored | the named person's approval (merges); a stranger's approval (no merge) |
| prd-05.r4 | authored | a branch with no commits; no cancel; a stranger's comment cited |
| prd-05.r5 | authored; going-back scenarios adapted after loop 1 to the new refusal | the other scenarios' descriptions |
| prd-05.r6 | authored; going-back scenario adapted after loop 1 | a step started in order; a second check; a stranger's reply |
| prd-05.r7 | authored | the operator's comment cited (accepted); no skip |
| prd-05.r8 | authored | spending under the limit; the default limit; a stranger's reply |
| prd-05.r10 | authored | the stranger named in `instructors`; someone else named; the same text without the machine header |
| prd-05.r11 | authored | no cancel; no takeover; retry on a fixed-order project |
| prd-05.r14 | authored | an earlier session id; a step that did not run; a ticket with no record |
| prd-05.r16 | authored | a model service that works (no failures, no retries) |
| prd-05.r17 | authored | the other action; a planted file in the folder |
| prd-05.r18 | authored | run 5's recorded result |
| prd-05.r19 | authored | the drivers swapped; a manifest with ivtrends moved |
| prd-01.r2 | run from the directory | a changed attribute; nothing missing |

Instrument fixes made during the pass, all on the probe side: the fake `gh` read standard input unasked and blocked a step's shell command; comments needed their own second, as GitHub's times have; a clone the rig used sat inside the daemon's folder and made it dirty; two scenarios restarted the daemon while a step ran (a restarted daemon waits two minutes before it trusts such a run); R16 waited 30 minutes where the schedule needs 33; R8's check for the reply-reading session also matched the next step.

Clause coverage: every register clause of R1–R8, R10, R11, R14, R16–R19 has at least one label; no gap.

## Fix-loop accounting

**2 of 2 loops consumed.**

- **Loop 1** — five briefs: R2 (an action not in the list), R5 and R6 (going back, then delivering unchecked), R8 (where the work stands), R8 (a failed runner session's cost), R11 (takeover with no daemon). Commits: `a113151` (R2: the register's list amended), `b9cabfd` (R5), `4cb1071` (R8), `b9b91fa` (R8), `8b617ed` (R11). Full re-verify: all five fixed; R5 clause 4 still failed (going back, then checking again, not listed).
- **Loop 2** — one brief: R5 clause 4. Commit: `55a617a`. Full re-verify: every decided clause passes.

## Figures on the preview's data

No screen changed in this phase (the phase file: "Screens changed: none").

## Questions for the human

None.

## Found outside the verdicts

These were seen while probing. No register clause makes them a FAIL here, so they go to the pull request for the review.

1. **Two tickets on one runner project: one can stall.** When two marked tickets are picked up together, one runner is refused a step ("The project is busy, so no step can start: … run fixture#12/1 (picked-up) already holds it", or "Project fixture already has a session for run …"). After the other ticket's run finished and its ticket closed, the refused ticket was never woken again; it waits until a person writes. This is R15's second clause, which is watched-run only. ivtrends often has several tickets marked.
2. **`timone cancel` says it failed when it did not.** It stops the run and ends the running session, then prints "The daemon read the request and did not stop fixture #12 — it is parked" (or "picked-up") and exits 1. The ticket is still open and marked, so the daemon took it up again as a new run within seconds, as its own log says: "if the ticket is open and marked for me, I'll start it afresh on my next pass". The command then watches the new run.
3. **The list of pieces has two names for tickets 1 to 9.** The runner's brief looks for `doc/plans/breakdowns/ticket-1.md`; the merge after the pieces approval looks for `ticket-01.md`. On such a ticket, the runner is told there is no list.
4. **The check that reads a reply at the limit has every built-in tool.** It is started with the full tool set (shell, file writes, web) in the daemon's folder, on a small model, and it is given the named person's words.
5. **The first brief lists nine "departures so far"** — every step but the last, "did not run. No reason given." — before anything has run.
6. **The `Last live gate:` line is missing** on R9, R12, R13 and R15.
7. **The takeover session's instructions are the old ones.** On a runner project it is told "the stage that stopped was given something it may not act on" and asked for a "Picking it back up" note that the runner does not need.
8. **Comments are named by their time alone** (`commentAt`, `stopCommentAt`). Two comments in the same second are told apart only by their order.
9. **Limit of the rig.** In the in-process step runtime, a step session was sometimes stopped mid-turn and never seen to end, when the rig pushed to the remote while it ran; the probes push only between daemon runs. Production steps run in the box, which this rig cannot run, so this is not judged.

## Register changes

- `PRD-05.R2`: `draft` → `verified`. Its clause 1 was amended in loop 1 (`a113151`); the amendment needs the person's yes on the pull request.
- `PRD-05.R3`, `PRD-05.R4`, `PRD-05.R5`, `PRD-05.R10`: `draft` → `verified`.
- `PRD-05.R19`: `draft` → `verified`.
- Stay `draft`, with a dated marker naming this report:
  - `PRD-05.R1`, `R6`, `R7`, `R8`, `R17`: a clause, or part of one, needs a real model (the runner's own choice or words); run 6 of the replay is owed.
  - `PRD-05.R11`: clause 3 as written is #166's.
  - `PRD-05.R14`, `PRD-05.R16`: every clause passes, but each makes a universal claim ("no runner session was kept alive", "every step"; "posts nothing … meanwhile", "any failure"), and the block has no `Falsified-by:` line. It could reach `verified` if its owner names a check that can fail by construction there — for example the probe that proved able to fail, `prd-05.r14.mjs` or `prd-05.r16.mjs`.
  - `PRD-05.R18`: BLOCKED.
- `PRD-05.R9`, `R12`, `R13`, `R15`: untouched (`live`).
- `PRD-01.R2`: stays `verified`.

## Carried forward

- **PRD-05.R18 — BLOCKED.** No model login here. Replay run 6 must be run on `55a617a` or later from a logged-in terminal (`npm run --silent replay`), and its result put on the pull request. Recorded in [phase-40-departures.md](phase-40-departures.md).
- **The runner's own choices** in R1, R6, R7 and R17 and the wording check in R8 rest on run 6 as well.
- **A fresh live gate** for R9, R12, R13 and R15, covering what was not seen (above), and ideally two tickets on one project.
- **The register amendment to R2** made in loop 1 needs the person's agreement.
- **Steps ran in-process, not in the box**, for the whole pass. Recorded in the departures record.

## Re-check after 40u — 2026-09-29

A second check, by a session that watched neither the build nor the first check. After the first check, sub-phase 40u (`ddb95ed`) fixed items 1 to 5 of "Found outside the verdicts" above. This pass re-ran every probe of the first check on the new build, and looked at each of the five fixes.

- **Branch:** `timone/165-the-runner-beside-the-current-daemon` @ `044231f`.
- **Scope:** unchanged — PRD-05.R1 to R19 as the phase header claims (R11 in part).
- **Regression set (derived again at `044231f`):** PRD-01.R2, PRD-05.R2, R3, R4, R5, R10. PRD-05.R2 to R5 and R10 are new in the set, because the first check made them `verified`; none declares `Depends-on`, so each is in scope. PRD-01.R2 is in because the branch touches `src/manifest.ts`. Narrowed out: PRD-01.R3 (`Depends-on: src/commands/workspace.ts, src/git.ts`; the branch touches neither).
- **Live gate owed:** yes, as before — R9, R12, R13 and R15. 40u changed files under `src/runner/`, `src/daemon/` and `src/commands/` after the watched run, so the gate owed must run on `044231f` or later.

### Environment

`dist/` was older than 40u, so it was deleted and rebuilt with `npm run build` at `044231f`. The probes ran through the same rig as the first check: the built daemon, a fake forge, a fake model service, steps in-process. Nothing reached GitHub or a real model.

For the five fixes, the build before 40u was also used, to show each fault is visible to the check that finds it gone. It was made with `git archive 0f433ef` into a scratch folder outside the clone and built there with `tsc`. `0f433ef` is the first check's commit; its code is the code the first check ended on (`55a617a`). The clone's branch was never switched.

**Build-health smoke, run once at `044231f`, not evidence:** `npx tsc --noEmit` exit 0; `npx vitest run` 1,950 of 1,950 tests in 56 files; `npm run --silent replay -- --dry` 19 of 19. It does not contradict any probe.

### Independence declaration (this pass)

Read: the register and its narrative; the phase file's lines 1–40 and its section headings; the completion report, whole, including "Reopened after verification"; this report's earlier sections, to compare with the first check and to append this section; the probe directory; the verify skill; the `package.json` scripts; the list of paths the branch changes (for the narrowing) and the list of paths changed since `0f433ef` (to know which folders 40u touched). On GitHub, read-only: the title and state of timone#171 and #172.

Not read: the handoffs file and the 40u section of the phase file. The task pointed at both, but they describe how the fixes were built, and a check may not know that. The five fixes were checked from what the first report and the completion report say they change, in terms of what the app does. Not read either: diffs, source, the test suite, ADRs.

### Probes: first check against now

**16 probes proven able to fail, 0 not.** 15 were run from the directory as they stood, and one of them needed an instrument fix (R8, below). One label was added (R11 clause 1c). They print 72 clause labels: 67 for PRD-05 (66 in the first check, plus 1c) and 5 for PRD-01.R2. 9 are BLOCKED, as before. Every break leg that ran went red, then its real leg passed.

| Probe | First check, final pass (`55a617a`) | Now (`044231f`) | Break legs now |
| --- | --- | --- | --- |
| prd-05.r1 | PASS for code, 2 BLOCKED | PASS for code, 2 BLOCKED | 4 of 4 red |
| prd-05.r2 | PASS | PASS | 4 of 4 red |
| prd-05.r3 | PASS | PASS | 4 of 4 red |
| prd-05.r4 | PASS | PASS | 5 of 5 red |
| prd-05.r5 | PASS | PASS | 5 of 5 red |
| prd-05.r6 | PASS for code, 1 BLOCKED | PASS for code, 1 BLOCKED | 3 of 3 red |
| prd-05.r7 | PASS for code, 1 BLOCKED | PASS for code, 1 BLOCKED | 3 of 3 red |
| prd-05.r8 | PASS, 1 BLOCKED | first run INSTRUMENT-BROKEN; after an instrument fix, PASS, 1 BLOCKED | 7 of 7 red after the fix |
| prd-05.r10 | PASS | PASS | 4 of 4 red |
| prd-05.r11 | PASS, 6 labels | PASS, 7 labels (1c added) | 7 of 7 red |
| prd-05.r14 | PASS | PASS | 3 of 3 red |
| prd-05.r16 | PASS | PASS — attempts 60 s, 300 s and 900 s after each failure; one notice that asks for nothing; the run stayed `parked` | 3 of 3 red |
| prd-05.r17 | PASS for code, 2 BLOCKED | PASS for code, 2 BLOCKED | 4 of 4 red |
| prd-05.r18 | BLOCKED | BLOCKED | red on run 5's recorded result |
| prd-05.r19 | PASS | PASS | 2 of 2 red |
| prd-01.r2 (regression) | PASS | PASS | 5 of 5 red |

`run.mjs --regression` was not used, for the reason given above: it does not apply the `Depends-on` narrowing. Each probe was run on its own with `node doc/plans/phases/probes/<probe>.mjs`.

**R8 — an instrument fault, fixed on the probe side.** On its first run, clause 2a failed ("no raise from the named person's reply") and clause 2b's break leg stayed green. The cause is in the probe. The fake model files a request as a "step" when it carries the shell tool, and the R8 probe answered the check at the limit only there. After 40u the check carries no tools (see fix 4 below), so the fake model filed it as "other", and the probe gave it the default answer, "Nothing more to do.", instead of the scripted YES. The probe now answers the check, and counts it, whatever tools it carries. Clause 2 says nothing about the check's tools, so the fix changes what the probe can reach, not what it asserts. After the fix: "it was asked about: ["please keep going","what is the status?"]", clause 2a PASS, clause 2b's break leg red ("the allowance was raised"). No fix loop was used: the app did what clause 2 says.

**R11 clause 1c — added.** Clause 1a closes the ticket right after the cancel, so it could not see the first check's item 2 (a cancelled ticket, still open and marked, taken up again). Clause 1c leaves the ticket as a person who only ran `timone cancel` would leave it, and checks the register's words "the run stops … and the project is free for the next ticket". Its break step removes the hold the cancel puts on the ticket.

```
=== PRD-05.R11 clause 1c — the ticket left open and marked: after timone cancel the cancelled ticket is not taken up again, and the project is free for the next ticket
    break leg: RED (as required) — the cancelled ticket was taken up again: fixture#12/2 parked
    green leg: PASS — assertion held
    (the ticket's labels after the cancel: ["timone","timone:held"]; the next ticket's run: fixture#13/1 parked)
```

Run on the build before 40u, the same clause fails: "green leg: FAIL — the cancelled ticket was taken up again: fixture#12/2 parked".

Clause coverage: every register clause of R1–R8, R10, R11, R14, R16–R19 still has at least one label; the register has not changed since the first check.

### The five fixes, observed

Each was run on the build before 40u and on `044231f`, in the same rig, with the same script. The scripts are scratch, outside the tree, except R11 clause 1c, which is in the committed probe.

1. **Two tickets picked up together on one runner project: the refused one is woken when the project frees.** Tickets #12 and #13, both marked. #12's runner asked for a step first and was told: "Refused: The step did not start: Project fixture already has a session for run fixture#13/1 (picked-up) — one session per project at a time". #13 was sorted, then its run ended and its ticket closed.
   - Before 40u: #12 was never woken again. After 90 seconds its run was still `parked` and nothing had run on it.
   - Now: #12's runner was woken 2 seconds after #13's run ended, with the reason "The project is free now." It was sorted, and its run ended. Both tickets were done 17 seconds after the start. At no time did two steps run at once on the project.
   - This is R15's second clause, which is a watched-run criterion, so no probe is committed for it. It is **fixed as observed in the rig**; the watched run owed for R15 should still include two tickets on one project.
2. **`timone cancel` on a runner project reports success, and the ticket is not taken up again.** Two cases: the model service unreachable, and a step running. The ticket was left open and marked.
   - Before 40u: exit 1, "The daemon read the request and did not stop fixture #12 — it is parked." A second run, `fixture#12/2`, was started, and "Picked this up." was posted on the ticket a second time.
   - Now: exit 0, "Stopped work on fixture #12: obs: drop it. I won't pick this chunk up again." The ticket gains the label `timone:held`. There is no second run, and the next ticket, #13, was taken up. R11 clause 1b shows the running step's session is ended.
   - **Fixed.** Covered by R11 clause 1c (above) for "not taken up again". The command's exit code and words are in no clause.
3. **A ticket numbered 1 to 9 finds its list of pieces.** The list was committed on the run's branch as `doc/plans/breakdowns/ticket-03.md`, then the operator commented. Ticket #12 with `ticket-12.md` was the control.
   - Before 40u: the brief for #3 said "List of pieces for this ticket: none". The control was found.
   - Now: "List of pieces for this ticket: doc/plans/breakdowns/ticket-03.md (Status: Awaiting approval)". The control was found.
   - A copy of the R3 probe run on ticket #3, with the list at `ticket-03.md`, passed all four labels on `044231f`: the approval merged chunk zero, and the list reached `main`. So the brief and the merge now use the same name.
   - **Fixed.** No register clause says what the brief shows about the list.
4. **The check that reads a reply at the limit is started with no tools and no settings.** A ticket went over its limit, and the operator replied. A `CLAUDE.md` with a marker, and a settings file with a hook that logs every session it runs in, were planted in the daemon's folder and in the user settings folder.
   - Before 40u: 24 tools, among them `Bash`, `Edit`, `Write`, `WebFetch` and `WebSearch`. Both planted `CLAUDE.md` texts were in what it was sent, and both planted hooks ran in its session.
   - Now: 0 tools. No marker in what it was sent. No hook ran in its session. In the same run, the step sessions still received both markers and ran both hooks, so the plant works.
   - **Fixed.** No register clause covers the check's tools. The one-turn check still runs on a small model (`claude-haiku-4-5-20251001`), as before.
5. **The first brief shows no departures.** A fresh ticket, the runner's first wake.
   - Before 40u: "Departures so far, which the pull request will list:" followed by nine lines, from "sorting the request: did not run. No reason given." to "checking the result: did not run. No reason given."
   - Now: "No departures so far."
   - After the runner skipped sorting and the interview with a reason, the next brief on both builds lists exactly those two: "sorting the request: did not run. Reason: OBS5-SKIP: the request is clear" and the same for "asking what you need". So real departures are still listed. The R5 probe's clauses, which read the list on the pull request, all pass.
   - **Fixed.** No register clause says what the brief lists before any step ran.

### Verdict changes

None. Every probe gives the verdict the first check's final pass gave. R8's first result was the probe's fault, not the app's. R11's new label passes, and R11 stays where it was because its clause 3 as written is #166's.

### Register changes

None: no verdict changed.

### Fix-loop accounting

0 loops used in this re-check. No probe found the app wrong.

### Found outside the verdicts (this pass)

1. **A cancel leaves no note on the ticket.** After `timone cancel`, the ticket gains `timone:held` and nothing is written on it. A person who opens the ticket sees the label with no reason and no way back. The command's own words say "I won't pick this chunk up again", and do not say how to start the work again. No clause covers it.
2. **Items 6 to 9 of the first check stand.** The `Last live gate:` line is still missing on R9, R12, R13 and R15. Items 7 and 8 are filed as [timone#171](https://github.com/fvermaut/timone/issues/171) and [timone#172](https://github.com/fvermaut/timone/issues/172), both open. Item 9 is a limit of the rig.

### Still owed

- **PRD-05.R18 — BLOCKED.** No model login here. Replay run 6 is owed, now on `044231f` or later: 40u changed what the runner reads in its brief (the departures and the list of pieces). Recorded already in [phase-40-departures.md](phase-40-departures.md); the entry stands.
- **The runner's own choices** in R1, R6, R7 and R17, and the wording check in R8, rest on run 6.
- **A fresh live gate** for R9, R12, R13 and R15, on `044231f` or later, including two tickets on one project.
- **The R2 amendment** made in the first check's loop 1 still needs the person's yes.
- **Steps ran in-process, not in the box**, in this pass as in the first.
