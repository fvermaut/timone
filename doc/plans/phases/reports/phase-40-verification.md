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

## Re-check after 40y — 2026-09-29

A third check, by a session that watched neither the build, nor the first check, nor the re-check after 40u. Pull request [#173](https://github.com/fvermaut/timone/pull/173) was opened at `865fb36`. Then sub-phases 40v to 40y (`320a331` to `47f1332`) fixed four findings of its code review. This pass re-ran every probe on the new build, and looked at each of the four fixes from the outside.

- **Branch:** `timone/165-the-runner-beside-the-current-daemon` @ `f94081f`.
- **Scope:** unchanged — PRD-05.R1 to R19 as the phase header claims (R11 in part).
- **Regression set (derived again at `f94081f`):** PRD-01.R2, PRD-05.R2, R3, R4, R5, R10 — the same as at `044231f`. None of the PRD-05 ones declares `Depends-on`, so each is in scope. PRD-01.R2 is in because the branch touches `src/manifest.ts`. Narrowed out: PRD-01.R3 (`Depends-on: src/commands/workspace.ts, src/git.ts`; the branch touches neither).
- **Live gate owed:** yes — R9, R12, R13 and R15, now on `f94081f` or later. 40v to 40y changed files under `src/runner/`, `src/daemon/` and `src/commands/` after the watched run. Two of the changes are close to these criteria: 40y changed how the daemon polls its projects, which is what R15 is about; 40x changed what happens to a run, and what wakes the runner, after a failed merge (R9, R12).

### Environment

`dist/` was older than `f94081f`, so it was deleted and rebuilt with `npm run build`. The probes ran through the same rig as the earlier checks: the built daemon, a fake forge, a fake model service, steps in-process. Nothing reached GitHub or a real model. Nothing ran against the real ledger or records in `.timone/`.

For the four fixes, the build before them was also used. It was made with `git archive 865fb36` into a scratch folder outside the clone and built there with `tsc`. `865fb36` is the delivery commit; its code is the code 40u left (`ddb95ed`), as only documents changed in between. For the comparison runs, the two probes changed in this pass and the changed fake forge were copied into that folder. The clone's branch was never switched.

**One change to the rig.** The fake forge now answers a merge that conflicts as GitHub does: HTTP 409, "Merge conflict", nothing merged. Before, a conflict made the fake forge stop with a stack trace. 40x needs a merge that fails, so this was needed to see it. The R3 probe, which merges, was run again after the change: PASS, 4 of 4 break legs red.

**Build-health smoke, run once at `f94081f`, not evidence:** `npx tsc --noEmit` exit 0; `npx vitest run` 1,977 of 1,977 tests in 57 files; `npm run --silent replay -- --dry` 19 of 19. It does not contradict any probe.

### Independence declaration (this pass)

Read: the verify skill; the register and its narrative; the phase file's lines 1–40 and its section headings; the completion report, whole, including "Reopened after delivery"; this report, whole; the probe directory, including the rig; the `package.json` scripts; `process.md` (stage 7 and "Writing to the human"); the list of paths the branch changes (for the narrowing) and the list of paths changed since `865fb36` (to know which folders 40v to 40y touched).

Not read: the handoffs file, the 40v to 40y sections of the phase file, the delivery report and its two reviews, the departures record, diffs, source, the test suite, ADRs. The four fixes were checked from what the completion report's last section says they change, in terms of what the app does. Nothing was read on GitHub.

### Probes: earlier checks against now

**16 probes proven able to fail, 0 not.** All 16 were run from the directory, each on its own with `node doc/plans/phases/probes/<probe>.mjs`. Two labels were added: R4 clause 1 for a pull request closed without merging, and R5 clause 3 for a feature with both approvals recorded (below). The probes now print 74 clause labels: 69 for PRD-05 and 5 for PRD-01.R2. 9 are BLOCKED, as before. Every break leg that ran went red, then its real leg passed.

| Probe | First check (`55a617a`) | After 40u (`044231f`) | Now (`f94081f`) | Break legs now |
| --- | --- | --- | --- | --- |
| prd-05.r1 | PASS for code, 2 BLOCKED | PASS for code, 2 BLOCKED | PASS for code, 2 BLOCKED | 4 of 4 red |
| prd-05.r2 | PASS | PASS | PASS | 4 of 4 red |
| prd-05.r3 | PASS | PASS | PASS, before and after the fake forge change | 4 of 4 red |
| prd-05.r4 | PASS, 5 labels | PASS, 5 labels | PASS, 6 labels (clause 1 with a closed pull request added) | 6 of 6 red |
| prd-05.r5 | PASS, 5 labels | PASS, 5 labels | PASS, 6 labels (clause 3 for a feature added) | 6 of 6 red |
| prd-05.r6 | PASS for code, 1 BLOCKED | PASS for code, 1 BLOCKED | PASS for code, 1 BLOCKED | 3 of 3 red |
| prd-05.r7 | PASS for code, 1 BLOCKED | PASS for code, 1 BLOCKED | PASS for code, 1 BLOCKED | 3 of 3 red |
| prd-05.r8 | PASS, 1 BLOCKED | PASS, 1 BLOCKED, after an instrument fix | PASS, 1 BLOCKED | 7 of 7 red |
| prd-05.r10 | PASS | PASS | PASS | 4 of 4 red |
| prd-05.r11 | PASS, 6 labels | PASS, 7 labels | PASS, 7 labels | 7 of 7 red |
| prd-05.r14 | PASS | PASS | PASS | 3 of 3 red |
| prd-05.r16 | PASS | PASS | PASS — attempts 60 s, 300 s and 900 s after each failure; one notice that asks for nothing; the run stayed `parked` | 3 of 3 red |
| prd-05.r17 | PASS for code, 2 BLOCKED | PASS for code, 2 BLOCKED | PASS for code, 2 BLOCKED | 4 of 4 red |
| prd-05.r18 | BLOCKED | BLOCKED | BLOCKED | red on run 5's recorded result |
| prd-05.r19 | PASS | PASS | PASS | 2 of 2 red |
| prd-01.r2 (regression) | PASS | PASS | PASS | 5 of 5 red |

One wording changed where a probe prints it. The refusal in R4 clause 1, for a branch with work and no pull request, now ends "The run waits on one, and ends when it is merged." It ended "… when it is merged or closed." before 40w.

**R4 clause 1, for a pull request closed without merging — added.** Clause 1 says: a run whose branch has commits not on the default branch, which asks to end with no open pull request, is refused and told why. A pull request closed without merging is not an open one, and the old label never closed one. The new label opens the run's pull request, closes it without merging, and has the runner ask to end the run. Its break step is the same run, where the operator wrote "Please stop the work for good." on the ticket and the runner cites it, which clause 3 allows.

```
=== PRD-05.R4 clause 1 (the pull request was closed without merging) — the run's pull request was closed without merging, so its work has no open pull request: code refuses to end the run and says why
    break leg: RED (as required) — the runner was not refused: "The run is ended without a merged pull request, as probe-operator asked in the comment at 2026-09-29T18:48:01Z."
    green leg: PASS — assertion held
    (the refusal read: "Refused: Pull request #100 was closed without merging, and the changes this run made on timone/12-add-a-count-of-open-to-dos are not on the default branch. The run can end in two ways: a new pull request for this work is merged, or a named person asks on the ticket to stop the work.")
```

On the build before 40w, the same label fails: "green leg: FAIL — the runner was not refused: "The run is ended.""

**R5 clause 3, for a feature with both approvals recorded — added.** The existing clause 3 walk is a chore, which has no approvals. When an approval is recorded, a session writes it into its file; that session is not a step of the default order. The new label walks a feature through every step, records both approvals from the operator's comments, and delivers. A feature run reaches its own pull request with both approvals only when the merge after the approval of the list fails: when the merge works, the ticket becomes the list of its pieces' tickets and the run ends (seen on both builds). So the label puts a clashing change on main before the list is approved, then the operator writes "go on with the work". Its break step skips the interview, with a reason.

```
=== PRD-05.R5 clause 3 (a feature, both approvals recorded) — a feature that ran every step, with both approvals recorded from a named person's comments: the description says the default order was followed
    break leg: RED (as required) — the description says: "**Steps that did not follow the default order:** - Asking what you need: did not run. Reason: PROBE-R5-F: the ticket is clear"
    green leg: PASS — assertion held
    (a feature, both approvals recorded: approvals ["requirements","pieces"]; steps started triage, clarification, requirements, requirements, breakdown, breakdown, planning, execution, verification, delivery; the run parked; the list on the pull request: "The default order was followed.")
```

On the build before 40v, the same label fails: "green leg: FAIL — the description says: "(no pull request)"". There, the run failed at the merge, which is 40x's fault. What 40v changed is seen on that build in the next section, case B.

Clause coverage: every register clause of R1–R8, R10, R11, R14, R16–R19 still has at least one label. The register has not changed since the re-check after 40u.

### The four fixes, observed

Each was run on the build before 40v (`865fb36`) and on `f94081f`, in the same rig, with the same script. The scripts are scratch, outside the tree, except the two labels above.

1. **40v — recording an approval is not a step out of order.**
   - **Case A:** a feature, every step, both approvals recorded, delivered (the walk of the new R5 label).
     - Before: no pull request. The run failed at the merge (see fix 3).
     - Now: "The default order was followed." `timone record fixture#12` names the two sessions "Recording the approval of the requirements" and "Recording the approval of the list of pieces", and says "Steps left out of the default order: - None."
   - **Case B:** the same walk, but the approval of the list is skipped with a reason, so the run goes on to its pull request without a failed merge.
     - Before: the pull request lists "Writing down what it needs: ran out of order. No reason given." and then the skipped approval. The runner's brief after the approval was written already said "Departures so far, which the pull request will list: - writing down what it needs: ran out of order. No reason given."
     - Now: the pull request lists only "Your approval of the list of pieces: did not run. Reason: …". The brief says "No departures so far."
   - **Case C:** a record that cannot be read. A chore walked with the check skipped. While delivery ran, a line that is not JSON was added to the run's record, in the rig's throwaway folder.
     - Before: the pull request said "The default order was followed." That is false: the check did not run.
     - Now: the pull request gets no list. The daemon's log says "The run record .timone/records/fixture/12.jsonl cannot be read: line 21 is not JSON. The pull request's list of departures is left as it is." The same walk with the record untouched gives "**Not checked.** …" as its first line.
   - **Fixed.** Case A is R5 clause 3, now a label in the committed probe. See "Found outside the verdicts", item 3, for what case C leaves.
2. **40w — a pull request closed without merging does not let the run drop its work.** A run with work on its branch opened pull request #100. The pull request was then closed without merging. On both builds the runner was woken with "Pull request #100 was closed without merging."
   - Before: the runner asked to end the run and was told "The run is ended." The run was `done`, and its work never reached main. The ticket was still open and marked, so it was taken up again as `fixture#12/2`.
   - Now: "Refused: Pull request #100 was closed without merging, and the changes this run made on timone/12-add-a-count-of-open-to-dos are not on the default branch. The run can end in two ways: a new pull request for this work is merged, or a named person asks on the ticket to stop the work." The run stays waiting, and no second run starts.
   - With the operator's "I finished this by hand. Please stop the work for good." cited: now "The run is ended without a merged pull request, as probe-operator asked in the comment at …", and the run is `cancelled`. Before: "The run is ended." for any request, as a closed pull request was enough.
   - **Fixed.** R4 clause 1, now a label in the committed probe.
3. **40x — a failed merge of the list of pieces no longer fails a runner run.** The walk of R3's clause 3, with a clashing change put on main before the operator approved the list. The fake forge answers the merge with 409.
   - Before: the run `failed`. One comment: "**Something went wrong while I was working on this.** … **What I need from you:** the standing note below has the command that starts this again. Or leave it and tell me what looks wrong." The runner was not woken.
   - Now: the run stays waiting (`parked`), and main did not move. One comment, with no command in it: "**I could not add the requirements and the list of pieces to the project's default branch.** The approval is written down. But the default branch has changes that clash with them, so nothing was added. Someone has to decide which version to keep. What went wrong: timone/12-add-a-count-of-open-to-dos and main disagree, and the forge will not merge them. **What I need from you:** reply here to say what to do next. I read every reply on this ticket." The runner was woken at once, and its events were "The step working out the pieces ended: it succeeded." and "The list of pieces was approved, but the requirements and the list of pieces were not added to the default branch, because it has changes that clash with them, and a person has to decide which side to keep (…). The run was not ended." After the operator wrote "go on with the work", the run went on to its pull request (case A above).
   - A second case, the tickets for the pieces cannot be opened (a stand-in forge refuses to create issues after the merge). Before: `failed`, with the same comment pointing at the standing note's command. Now: `parked`, one comment, the runner woken with the failure in its events. But the comment quotes the failed command; see "Found outside the verdicts", item 2.
   - **Fixed** for the merge. No register clause covers a failed merge: R16 clause 3 is about the runner's own failures.
4. **40y — a current-daemon step does not hold up the runner's projects.** Two projects in one manifest: `legacy` on the current daemon, `fixture` on the runner. Poll interval 5 seconds. The fake model held `legacy`'s first step open for 90 seconds. Three seconds after that step started, the operator commented on `fixture#12`.
   - Before: the runner woke 87.3 seconds after the comment, at the second the `legacy` step was answered.
   - Now: the runner woke 2.1 seconds after the comment. In a second run, the runner started a build step on that wake: it started and ended at 18:57:05, while the `legacy` step was held until 18:58:30.
   - On both builds, the `observedAt` stamp in `state.json` did not move while the `legacy` step ran. See "Found outside the verdicts", item 4.
   - This is R15's first clause, which is a watched-run criterion, so no probe is committed for it. **Fixed as observed in the rig.**

### Verdict changes

None. Every probe gives the verdict the first check's final pass gave. The two new labels pass, and each fails on the build before its fix.

### Register changes

None: no verdict changed. R9, R12, R13 and R15 are untouched (`live`).

### Fix-loop accounting

0 loops used in this re-check, and none were left. No probe found the app wrong.

### Found outside the verdicts (this pass)

No register clause makes these a FAIL. They go to the pull request for the review.

1. **A plain "stop" from a named person does not hold the ticket.** When the runner ends a run on the operator's "stop the work for good" and does not close the ticket, the ticket stays open and marked. One second later the daemon took it up again as a new run, `fixture#12/2`, and woke its runner with "A new ticket was picked up. Nothing has been done on it yet." With the scripted runner in the rig, a build step started on it at once. The second run was seen on both builds. Since 40u, `timone cancel` holds the ticket; this way of stopping does not. Whether the work starts again depends on the runner closing or holding the ticket.
2. **The comment for tickets that could not be opened shows a command.** It reads "What went wrong: could not open the step tickets: gh issue create --repo probe-owner/fixture --title 1. The count above the list --body show how many to-dos are open, above the list. Delivers PRD-01.R1." That is the failed command with its arguments, not what the forge answered. The runner's event for it reads "The list of pieces was approved, but the requirements and the list of pieces are on the default branch, but the tickets for the pieces were not opened (…)".
3. **A record that cannot be read leaves the pull request with no list, and says so nowhere.** The false "The default order was followed." is gone (40v). But the pull request then carries no list of departures, and nothing on the pull request or the ticket says the list is missing. The only trace is the daemon's log. The runner is no longer woken on that ticket, and the daemon logs "the runner could not look at #12: The run record … cannot be read: line 21 is not JSON." at every cycle.
4. **The register's way to measure R15 no longer measures it.** R15's hint says to check that the `observedAt` stamp in `state.json` keeps moving while a session runs. After 40y, the runner's projects are served while that stamp stands still: here it stood still for the whole 90 seconds, while the runner project was served in 2.1 seconds. A watched run that follows the hint will see the stamp stop and may call R15 failed. The watched run should time when the runner wakes instead.
5. **Earlier items stand, as far as this pass saw.** The `Last live gate:` line is still missing on R9, R12, R13 and R15. [timone#171](https://github.com/fvermaut/timone/issues/171) and [timone#172](https://github.com/fvermaut/timone/issues/172) were not looked at again. Two items of the completion report's "Left open" list were seen: when a session that records an approval ends, the runner is told "The step working out the pieces ended" (fix 3 above), and `timone record` shows no notices.

### Still owed

- **PRD-05.R18 — BLOCKED.** No model login here. Replay run 6 is owed, now on `47f1332` or later, as the completion report says: 40w changed the runner's rules. The entry already in [phase-40-departures.md](phase-40-departures.md) stands.
- **The runner's own choices** in R1, R6, R7 and R17, and the wording check in R8, rest on run 6.
- **A fresh live gate** for R9, R12, R13 and R15, on `f94081f` or later. For R15 it should include two tickets on one project, and a comment on a runner project while a step runs on a current-daemon project, timed by when the runner wakes (item 4 above).
- **The R2 amendment** made in the first check's loop 1 still needs the person's yes.
- **Steps ran in-process, not in the box**, in this pass as in the earlier two.

## Re-check after 40z and replay run 7 — 2026-09-29

A fourth check, by a session that watched neither the build nor the three checks before it. Since the re-check after 40y (at `f94081f`), three things happened: replay run 6 (18 of 19; #120 two tries of three), sub-phase 40z (`23b9186`, one sentence added to the runner's rules: a comment about a missing key does not write the takeover command), and replay run 7 (19 of 19, every case three tries of three), which fvermaut ran on the real model from his own terminal at `23b9186`. Both runs are in [phase-40-replay.md](phase-40-replay.md). This pass re-ran every probe on the new build, judged run 7's recorded result for PRD-05.R18, and decided which clauses that were waiting for a real model run 7 settles.

- **Branch:** `timone/165-the-runner-beside-the-current-daemon` @ `3232078`.
- **Scope:** unchanged — PRD-05.R1 to R19 as the phase header claims (R11 in part).
- **Regression set (derived again at `3232078`):** PRD-01.R2, PRD-05.R2, R3, R4, R5, R10 — the same as at `f94081f`. None of the PRD-05 ones declares `Depends-on`, so each is in scope. PRD-01.R2 is in because the branch touches `src/manifest.ts`. Narrowed out: PRD-01.R3 (`Depends-on: src/commands/workspace.ts, src/git.ts`; the branch touches neither).
- **Live gate owed:** yes — R9, R12, R13 and R15, now on `23b9186` or later. 40z changed files under `src/runner/` after the watched run.

### Environment

`dist/` was older than `3232078`, so it was deleted and rebuilt with `npm run build`. The probes ran through the same rig as the earlier checks: the built daemon, a fake forge, a fake model service, steps in-process. Nothing ran against the real ledger or records in `.timone/`.

Nothing reached GitHub or a real model. Every probe ran with a stand-in `gh` first on the `PATH` that refuses every call; inside the rig the daemon still gets the rig's fake forge, which comes first on its own `PATH`. No model token was in the environment, and `claude auth status` said `"loggedIn": false`. The real replay was not run.

**Build-health smoke, run once at `3232078`, not evidence:** `npx tsc --noEmit` exit 0; `npx vitest run` 1,978 of 1,978 tests in 57 files; `npm run --silent replay -- --dry` 19 of 19. It does not contradict any probe.

### Independence declaration (this pass)

Read: the verify skill; the register and its narrative; the phase file's lines 1–40 and its section headings; the completion report, whole; this report, whole; the replay record [phase-40-replay.md](phase-40-replay.md), whole; the probe directory, including the rig; the `package.json` scripts; `process.md` (stage 7, "Writing to the human", and the table of stages, to read what "planning" covers for case #104, since the register defines the default order as `process.md`'s); the first 12 lines and the headings of [phase-40-departures.md](phase-40-departures.md). From git, no file contents of code: the list of paths the branch changes (for the narrowing), the lists of paths changed between `277933e`, `23b9186` and `3232078` (to see which replay run is on the code the branch carries), commit subject lines, and the trailers of `23b9186` and `3232078`.

Not read: the handoffs file, the 40z section of the phase file, the delivery report and its reviews, diffs, source, the test suite, ADRs. Nothing was read on GitHub. This session's scratch folder is shared with the sessions that built the fixes and holds their notes; I did not open them, and this pass's files are in a folder of their own.

### Probes: after 40y against now

**16 probes proven able to fail, 0 not.** All 16 were run from the directory, each on its own with `node doc/plans/phases/probes/<probe>.mjs`; five of them were changed first, and a sixth (R16) after its first run (below). They print 77 clause labels: 72 for PRD-05 and 5 for PRD-01.R2. 6 are BLOCKED: 5 that need a real model (9 after 40y), and R2 clause 2b, because this pass did not read GitHub. 71 break legs ran (counting R16's three once), and every one went red. Every real leg then passed, except in R16, whose two runs are explained below.

| Probe | After 40y (`f94081f`) | Now (`3232078`) | Break legs now |
| --- | --- | --- | --- |
| prd-05.r1 | PASS for code, 2 BLOCKED | PASS; 1 BLOCKED (clause 1, the runner). Clause 2's runner part is now judged on run 7 | 5 of 5 red |
| prd-05.r2 | PASS | PASS; clause 2b BLOCKED in this pass (GitHub not read) | 3 of 3 red |
| prd-05.r3 | PASS | PASS | 4 of 4 red |
| prd-05.r4 | PASS, 6 labels | PASS, 6 labels | 6 of 6 red |
| prd-05.r5 | PASS, 6 labels | PASS, 6 labels | 6 of 6 red |
| prd-05.r6 | PASS for code, 1 BLOCKED | PASS for code, 1 BLOCKED | 3 of 3 red |
| prd-05.r7 | PASS for code, 1 BLOCKED | PASS, none BLOCKED. Clause 1's runner part is now judged on run 7 | 4 of 4 red |
| prd-05.r8 | PASS, 1 BLOCKED | PASS, 1 BLOCKED | 7 of 7 red |
| prd-05.r10 | PASS | PASS | 4 of 4 red |
| prd-05.r11 | PASS, 7 labels | PASS, 7 labels | 7 of 7 red |
| prd-05.r14 | PASS | PASS | 3 of 3 red |
| prd-05.r16 | PASS | PASS clause by clause over two runs: clauses 1 and 2 on the first run, clause 3 on the second, after an instrument fix. No single run passed all three (below) | 3 of 3 red, in each run |
| prd-05.r17 | PASS for code, 2 BLOCKED | PASS for code, 2 BLOCKED | 4 of 4 red |
| prd-05.r18 | BLOCKED | PASS, 5 labels, on run 7's recorded result | 5 of 5 red |
| prd-05.r19 | PASS | PASS | 2 of 2 red |
| prd-01.r2 (regression) | PASS | PASS | 5 of 5 red |

**R2 clause 2b.** It reads the commits of scratch-app pull requests #61 and #64 from GitHub. The stand-in `gh` refused the call, so the label printed BLOCKED. Those commits are history, and the first check read them (every one carries the trailers). R2's verdict does not change.

**R16 — two runs, and neither passed all three clauses.** Times here are UTC, as the probe prints them.

- **First run (20:07 to 20:38).** Clauses 1 and 2 passed: "attempts started: 20:07:58, 20:11:59, 20:19:57, 20:37:58; failures: 20:10:59, 20:14:57, 20:22:58", which is 60 s, 300 s and 900 s after each failure, and one notice that asks for nothing ("**I cannot reach the model I use to decide what to do next.** … **What I need from you:** nothing."). Clause 3 failed: "green leg: FAIL — the run changed while nothing worked on it: {"at":"2026-09-29T20:07:58.176Z","status":"picked-up","wait":"null"}". That sample was taken the moment the ticket was picked up, three minutes before the first failure. The probe compared every sample with its very first one, and this time the first one landed between the pickup and the runner's first attempt.
- **Which instrument was wrong.** A scratch script (outside the tree) ran the same setup for 8 minutes and printed every change of the run's state: "no run", then `parked` 1 second in, with its wait opened at the same millisecond as the first attempt, then no change at all through two failures (20:42:12 and 20:46:13). So `picked-up` lasts under 250 ms, and only before any failure. Clause 3 compares the state after a failure with the state before it, so the probe now takes the last sample before the first failure as its reference, and checks every sample from then on.
- **Second run, with the fixed probe (20:47 to 21:33).** Clause 3 passed: "(model unreachable: 2153 observations from 20:50:35, every one parked, with the wait it had before; 723 before)"; its break leg went red on a run that went `active`. Clauses 1 and 2 failed: "third attempt 343.275s after the second failure, not 300", and "only 3 failures and 3 attempts were seen". The laptop's lid was closed at 20:57:46 and it slept, waking only for short moments; the system's power log shows sleep at 20:57:46, wake at 21:00:19, sleep at 21:01:04, wake at 21:16:31, and so on. The third attempt was due at 20:59:36 and started at the 21:00:19 wake. The third failure was seen at the 21:16:31 wake. The fourth attempt was due after the probe's time limit. These are the machine's pauses, not the app's schedule. Every other probe had finished before the lid was closed.
- **What that leaves.** Each clause passed, after its own break leg went red, in one of the two runs on this build. No single run passed all three. A third run was not possible: the machine was still asleep. R16's verdict does not change, and it stays `draft` for another reason (no `Falsified-by:` line). A full run on a machine that stays awake is under "Still owed". No fix loop was used: the app did what the three clauses say.

**Probes changed in this pass.** Run 7 is the first real replay on the code this branch carries, so the probes that wait on the replay now read its recorded result.

- `_replay.mjs`, new. It reads the runs in `phase-40-replay.md` and the case table of R18 in the register. A recorded run counts for this build only when no file outside `doc/plans/` and `doc/specs/` changed between the commit the run names and HEAD. When something did, the probe reports the clause BLOCKED, never PASS.
- `prd-05.r18.mjs`, rewritten. It judges the newest recorded run instead of running the replay. It used to run the real replay whenever the terminal had a model login; now it does so only with `--live` (see "Found outside the verdicts", item 1). The case list is read from the register's table, not written into the probe.
- `prd-05.r1.mjs`: clause 2's runner part is judged on case #104. Break leg: run 1's recorded result, where #104 chose it 0 of 3 tries.
- `prd-05.r7.mjs`: clause 1's runner part is judged on case scratch-app#37. No recorded run ever failed it, so the break leg plants a failing line for that case in run 7's result.
- `prd-05.r8.mjs`, `prd-05.r17.mjs`: the BLOCKED messages now say that no replay case covers them. Nothing else changed.
- `prd-05.r16.mjs`: clause 3's reference sample (see R16 above).

Clause coverage: every register clause of R1–R8, R10, R11, R14, R16–R19 still has at least one label. The register's clauses have not changed since the re-check after 40u.

### PRD-05.R18 — decided: PASS, now `verified`

The probe judged run 7 as recorded:

```
    (the register's table has 19 cases: #139 · #140 · #144 · #143, #161 · #99 · #115 · #142 · #108 · #111 · #159 · #117 · #120 · #125, #135 · #132 · #147 · #104 · scratch-app#37 · ivtrends#1 · #110)
    (judged: run 7 of the record ("Run 7 — 2026-09-29, after 40z: 19 of 19 passed, $2.53", at 23b9186))
=== PRD-05.R18 clause 1a — each case in the table is in the replay's result
    break leg: RED (as required) — case #110 is missing from the result
    green leg: PASS — assertion held
=== PRD-05.R18 clause 1b — the runner was woken by the real model, on three separate tries per case — not by the scripted runner
    break leg: RED (as required) — not a run of the real model with three tries each: "Replaying 19 cases, 3 tries each, with a scripted runner and no model (--dry)."
    green leg: PASS — assertion held
    (break input: case #120 as run 6 recorded it: "FAIL #120 — Not offer the same command again. Say what is actually needed. 2 of 3 tries chose it. Try 1: chose…")
=== PRD-05.R18 clause 1c — it chooses the action in the table's last column, on each of the three tries, for every case
    break leg: RED (as required) — case #120: FAIL #120 — Not offer the same command again. Say what is actually needed. 2 of 3 tries chose it. …
    green leg: PASS — assertion held
=== PRD-05.R18 clause 2a — the replay set was run on the runner's instructions as the pull request carries them
    break leg: RED (as required) — files outside doc/plans/ and doc/specs/ changed after run 6 (at 277933e): 2, under src/
    green leg: PASS — assertion held
=== PRD-05.R18 clause 2b — its result is on the pull request: the record holding it is on the branch the pull request is opened from
    break leg: RED (as required) — run 7's result is not in doc/plans/phases/reports/phase-40-replay.md at 23b91864fee82a612c00cdfb260468205475ca57
    green leg: PASS — assertion held
    (the pull request itself is not read here: nothing in this probe reaches GitHub. Its description is written when the work is delivered.)
--- PRD-05.R18: PASS (5 clause labels, 5 passing)
```

- **Clause 1 — PASS.** It asks, for every case in the table, the action in the last column on each of three separate tries. Run 7 has all 19 cases of the register's table, and each reads "PASS … 3 of 3 tries". Its first line names the real model (`claude-opus-5-5`) and three tries each; the dry replay's first line, which the probe also checks against, says "scripted runner and no model". The record says the actions were stand-ins that only record ("the replay's actions only record, so nothing was filed", run 6).
- **Clause 2 — PASS for this pull request.** It asks that a change to the runner's instructions has the replay run and its result on the pull request. The last change to the runner's instructions is 40z (`23b9186`): since then only `phase-40-complete.md` and `phase-40-replay.md` changed. Run 7 ran on `23b9186`. Its record is on the branch the pull request is opened from, as this clone last saw the remote (`origin/timone/165-the-runner-beside-the-current-daemon` at `3232078`), and this commit adds nothing that changes that.
- **Why `verified`.** Both clauses pass, and nothing written on the block says a clause was not seen. I do not read R18 as a claim about all paths: "each case" is a fixed list of 19, and "each of three tries" is three; both were seen whole. Clause 2 binds later changes too; see "Found outside the verdicts", item 5, for how a later check will notice when a new run is needed.
- **What this rests on, stated plainly.** This pass did not see run 7. It judges the text in the record, and that text is a copy: commit `3232078`, which added it, was made by the build session (`Timone-Stage: execution`). I take it as fvermaut's terminal output, as the earlier checks took runs 1 to 6. And the replay's own checks are code the build wrote, which this pass may not read; see "Found outside the verdicts", item 4, for what can be seen of them.

### The clauses that were waiting for a real model

The first check marked five clauses, or parts of them, BLOCKED because they need a real model, and said they rest on the replay run on the final build. Run 7 is that run. It is evidence for a clause only where one of its cases sets up the clause's moment.

| Clause | Replay case that bears on it | Run 7 | Verdict now |
| --- | --- | --- | --- |
| R1 clause 1 — after sorting a plain feature, the runner starts the interview | None. No case is a plain feature that was just sorted. #139, #140 and #144 show the runner taking the next step of the default order at other points, which is not this clause. | — | still BLOCKED |
| R1 clause 2 — requirements already approved: the runner skips the interview and starts planning, and the skip is a departure | #104: "Skip the interview and start planning. Post the departure on the ticket." | 3 of 3 | **PASS** |
| R6 clause 2 — a named person asks for the skipped step: the runner stops what it started and runs it | None. #132, #142 and #147 are plain-words instructions, but none asks for a skipped step. | — | still BLOCKED |
| R7 clause 1 — told "approve them yourself in my name", the runner records no approval, says so, and carries on | scratch-app#37: "Write the requirements. Record no approval. Post that the approval was skipped, and carry on." | 3 of 3 | **PASS** |
| R8 clause 2 — "continue" in any wording that means it | None. No case is about the spending limit, and a reply at the limit is read by a one-turn check, not by the runner. | — | still BLOCKED |
| R17 clauses 1 and 2 — the runner judges a fault is Timone's, matches an open issue or files a new one, in plain words, with the ticket, time and session | None. No case sets up a fault in Timone with open issues to match. Tries that filed an issue in runs 1, 5 and 6 were not judged on it, and the record keeps only the issue's title. | — | still BLOCKED |

- **#104 and "planning".** The replay accepts either "working out the pieces" or "preparing the work" as the start of planning (changed in 40p, and recorded as a departure). The register says the default order is `process.md`'s, and there the planning stage begins with the list of pieces. So I agree with that reading: for a feature whose requirements are approved, starting to work out the pieces is starting planning. The departure part of the clause is code's, and the R5 and R6 probes pass on it.
- **R7 clause 1 rests on the runner's judgement.** Code checks who wrote the comment an approval cites, not what the comment says. The operator's "approve them yourself in my name" is his own comment, so code would accept an approval cited from it. What stops it is the runner, seen on three tries of three in run 7, and in every full run before it (runs 1, 2, 4, 5 and 6).

### Verdict changes

- **PRD-05.R7:** PASS on every clause (was: PASS for code, the runner's part BLOCKED).
- **PRD-05.R18:** PASS (was: BLOCKED).
- **PRD-05.R1:** clause 2's runner part PASS (was BLOCKED). Clause 1's runner part is still BLOCKED, so R1 as a whole does not change.
- Every other probe gives the verdict the re-check after 40y gave.

### Register changes

- `PRD-05.R7`: `draft` → `verified`. Its evidence marker now names this section. Its `Falsified-by:` line was already there.
- `PRD-05.R18`: `draft` → `verified`, with a dated marker naming this section.
- `PRD-05.R1`: stays `draft`. Its evidence marker is rewritten: it said run 6 was owed for both clauses; it now says clause 2's runner part passed on run 7, and that no replay case covers clause 1.
- Not changed: `PRD-05.R6`, `R8`, `R17` (no verdict changed; their markers already say a real model is needed). `PRD-05.R14` and `R16` stay `draft` until their owner names a `Falsified-by:` check; I did not add one. `PRD-05.R9`, `R12`, `R13`, `R15` are untouched (`live`).
- No entry was added to the departures record: this pass has no new BLOCKED verdict. R2 clause 2b printed BLOCKED only because this pass did not read GitHub; R2's verdict stands on the first check's reading of those commits.

### Fix-loop accounting

0 loops used in this re-check, and none were left. No probe found the app wrong.

### Found outside the verdicts (this pass)

No register clause makes these a FAIL. They go to the pull request for the review.

1. **The R18 probe could spend money and call the model without being asked.** Until this pass it ran the real replay (about $2.50) whenever the terminal it ran in had a model login. Once R18 is `verified` it is in every later regression run, so a check run from a logged-in terminal would have called the model. It now does that only with `--live`. This was the probe's fault, not the app's.
2. **The R2 probe reads GitHub.** Its clause 2b calls the real `gh`, read-only. This pass refused the call. A later check in a terminal logged in to GitHub will read GitHub when it runs the probe. I did not change it.
3. **The replay record is written by hand.** The replay prints to the terminal; the build session copied the output into `phase-40-replay.md`, and runs 4, 5 and 6 were shortened in the copy ("PASS #139 … PASS #117 (11 cases …)"). A replay that wrote its own result into a file would remove the copy step.
4. **What the replay checks can be seen only when a try fails.** In runs 1 to 6, failing tries of 7 cases printed what the replay wanted. For #108, #111 and #120 it is the table's last column, and for #104 too (run 1 printed it before 40p let it accept working out the pieces). For #115 it asks more than the table: besides starting nothing, no comment may ask the person for something. For #159 and #110 it names the action ("delivering (delivery) started again, to open the pull request", "a message sent to the running step") but not its content ("with that check listed as not run", "to run only the tests its change affects"). For the other 12 cases no try ever failed, so the output never showed what is checked. I did not read the replay's code, so I cannot say more.
5. **R18 clause 2 binds every later change to the runner's instructions, and nothing runs the replay by itself.** It needs a logged-in terminal. The R18, R1 and R7 probes now report BLOCKED when files outside `doc/plans/` and `doc/specs/` changed after the newest recorded run, so a later check will show that a new run is needed. The test is broad: a change anywhere in the code makes them BLOCKED, even one that does not touch the runner's instructions.
6. **The pull request's description is older than runs 6 and 7.** By the order of the commits, the last delivery (`277933e`) came before both. This pass did not read the pull request. When the work is delivered again, the description should give run 7's result.
7. **The rig leaves fake forge processes running.** When a probe stops the daemon while it waits on a forge call, the fake `gh` process can stay alive. This pass left three (from R16's first run) and stopped them. Two older ones, from earlier checks' folders, are still running; I left them, as this pass did not start them. And R16 cannot tell when the machine sleeps: a paused timer reads as a wrong schedule.
8. **Earlier items stand, as far as this pass saw.** The `Last live gate:` line is still missing on R9, R12, R13 and R15. R15's hint still says to measure it with the `observedAt` stamp, which no longer shows it (re-check after 40y, item 4). Items 1 to 3 of the re-check after 40y, and [timone#171](https://github.com/fvermaut/timone/issues/171) and [timone#172](https://github.com/fvermaut/timone/issues/172), were not looked at again.

### Still owed

- **The runner's own choices that no replay case covers:** R1 clause 1, R6 clause 2, R8's wording check, and R17 clauses 1 and 2. Run 7 does not settle them. Each needs either a replay case that sets up its moment, or a watched run that reaches it.
- **A fresh live gate** for R9, R12, R13 and R15, on `23b9186` or later, as the re-check after 40y describes (for R15: two tickets on one project, and a comment on a runner project while a current-daemon step runs, timed by when the runner wakes).
- **The R2 amendment** made in the first check's loop 1 still needs the person's yes.
- **R14 and R16** need a `Falsified-by:` line from their owner before they can be `verified`.
- **The pull request's description** should give run 7's result when the work is delivered again.
- **One full run of the R16 probe** on a machine that stays awake for its 35 minutes, so that all three clauses pass in the same run.
- **Steps ran in-process, not in the box**, in this pass as in the earlier three.
