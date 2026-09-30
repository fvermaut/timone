# Phase 40 — Watched run on scratch-app

> **Status:** run three times. The first attempt (2026-09-28) found four faults, fixed in 40r; the second (2026-09-28) passed, with R9's pull-request clause unseen. The third (2026-09-30, [timone#175](https://github.com/fvermaut/timone/issues/175)) ran on the merged code with nobody watching but the machine: it saw R9 whole, R15's one-at-a-time clause, R13's stop and R12's 15-minute check, and found two new faults. See the last section.
> **Plan:** [phase-40.md](../phase-40.md), sub-phase 40l. **Ticket:** [timone#165](https://github.com/fvermaut/timone/issues/165).

## What it checks

The criteria below are `live`: only a real daemon, a real box and a real forge can show them.

| Criterion | What is watched |
| --- | --- |
| [PRD-05.R9](../../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md) | A comment in plain words, with a spelling mistake, moves the run. A comment on the pull request asking for a change gets a reply there before the change starts. |
| PRD-05.R12 | A check arrives 15 minutes into a step, with the commands the step ran. |
| PRD-05.R13 | The runner sends a running step a message; the step's transcript shows it replayed (`"isReplay":true`), and the step then ends by itself. |
| PRD-05.R15 | While a step runs, `observedAt` in the ledger keeps moving, and a named person's comment on the ticket is read within one polling cycle. |
| PRD-05.R5, R6 | A step skipped with a reason is posted on the ticket before the next step starts, and listed at the top of the pull request. |
| 40d's owed probe | Two stream-json messages into the real CLI give two answers from the model. |

**One change from the plan, recorded here:** R15's second project. The only other scratch repository (`scratch-app-2`) is a local fixture with no GitHub tickets, and ivtrends is a live project, so it is not used for a test. A second ticket on scratch-app would wait in the queue while the first one works. R15 is therefore watched as the daemon still reading tickets while a step runs (the fault #148 measured), and the two-project form rests on 40h's test (`pollOnce` case 3).

## How it runs

It runs from the branch's own copy (`projects/timone`), with its own settings file (`.timone/live-gate.yaml`, scratch-app only, driven by the runner), and its own ledger and records in `projects/timone/.timone/`. The daemon run from `main` is not touched, but **it must not be running at the same time**, because it also reads scratch-app's tickets.

Every model call needs the operator's own logged-in terminal: the build's sandbox has none.

**Steps for fvermaut, in `~/dev/timone/projects/timone`, from your own terminal:**

1. Stop the daemon run from `main`, if it is running.
2. The probe, about a minute and a few cents:

   ```bash
   printf '%s\n%s\n' \
     '{"type":"user","message":{"role":"user","content":[{"type":"text","text":"Reply with the single word one."}]}}' \
     '{"type":"user","message":{"role":"user","content":[{"type":"text","text":"Reply with the single word two."}]}}' \
     | claude -p --input-format stream-json --output-format stream-json --verbose --replay-user-messages --model claude-haiku-4-5 \
     | grep -E '"type":"result"' | head -c 600
   ```

   Two `result` lines, with `"is_error":false` and the words `one` and `two`.
3. The watched run: `npm run build && node dist/cli.js daemon --manifest .timone/live-gate.yaml`. Leave it running and say so. Check its first line: the model login it names must be the lasting token.
4. The machine then opens the test ticket below on scratch-app and writes the comments, as fvermaut, marked as machine-typed.
5. When the machine says the run is over, stop the daemon (Ctrl-C).

**Cost.** The probe costs a few cents. The run takes one small change to a pull request, and the ticket's limit caps it at $150; a build session costs $36 on average.

## The test ticket (machine-typed)

**Title:** Trim the spaces around a to-do's title when it is saved

**Body:**

> When I add a to-do with spaces before or after its title, the spaces are kept, and the list looks uneven. Trim them when the to-do is saved. A title that is only spaces should be refused, as an empty title is today.
>
> This is a small change: it can go straight to building, with no separate plan.
>
> *Machine-typed on fvermaut's behalf, for the watched run of Timone phase 40.*

**Labels:** `timone`, `triage:chore`.

**Comments the machine writes, as fvermaut, at the moments named:**

- When the build step has run for a few minutes: *"While you are at it, also turn a run of spaces inside the title into one space."* — the runner should wake within one cycle (R15), and may send the running step a message (R13).
- If a step stops on something a word settles: *"tyr again"* — the runner should read it as "try again" (R9).
- When the pull request is open: *"plase also add a test for a title that is only spaces"* on the pull request — the runner should reply on the pull request first, then start the change (R9).

## Result

### 40d's probe — passed, 2026-09-28

Run by fvermaut from his own terminal, in `~/dev/timone`, with the command in step 2 above writing to `/tmp/probe.jsonl`. The first attempt printed only the start of the first answer, because the command given cut the output at 600 characters; the second attempt printed:

```
$ grep -c '"isReplay":true' /tmp/probe.jsonl
2
$ grep '"type":"result"' /tmp/probe.jsonl | grep -o '"is_error":[a-z]*\|"result":"[^"]*"'
"is_error":false
"result":"one"
"is_error":false
"result":"two"
```

Both messages were taken and replayed, and each got its own answer from the model. The first attempt's result line showed a real turn (`"stop_reason":"end_turn"`, 44 output tokens, $0.0233). This settles what 40d could not check from the build's sandbox: the operator's login reaches the model, and the CLI takes stream-json messages on its input, replays each one, and answers each. Still owed, and part of the watched run: a message sent while a step is inside a tool call is replayed, and the step then ends by itself (R13).

### The watched run — first attempt, 2026-09-28, [scratch-app#60](https://github.com/fvermaut/scratch-app/issues/60): stopped on a fault it found

fvermaut started the daemon from `projects/timone` at 08:57 UTC (its first line: "Model login: a lasting token, from this daemon's environment."). The machine opened #60 at 08:58 with the label `timone` only. The whole attempt cost about $8.30: building $3.25, checking $3.19, delivering $1.50, and seven runner wakes at about $0.06 each.

| Time (UTC) | What happened | Shows |
| --- | --- | --- |
| 08:58:21 | The daemon picked #60 up and posted its "Picked this up" note. | — |
| 08:58:22 | The runner woke: "A new ticket was picked up." | R1 |
| 08:58:42 | The ticket got "**I am skipping 7 steps.** I am going straight to building…", with the reason, and "No approval was recorded." | **R6** |
| 08:59:11 | The build step started — 29 seconds after the notice. | **R6**, R1 |
| 08:59:16 | The runner replaced the "Picked this up" note, which was no longer true. | 40q's rule |
| 09:00:25 | `observedAt` moved while the build ran (it last moved at 08:59:22). | **R15** |
| 09:04:02 | The machine wrote, as fvermaut: "While you are at it, also turn a run of spaces inside the title into one space." | — |
| 09:04:40 | The runner woke on it, 38 seconds later, with the build still running. | **R15**, **R9** |
| 09:04:51 | The runner sent the running build a message with the request, and replied on the ticket. | **R13** |
| 09:06:24 | The build's transcript shows the message taken, `"isReplay":true`, in the middle of its work. | **R13** |
| 09:12:39 | The build ended by itself, 12 seconds after its closing comment, the message included in its work. | **R13**, 40d |
| 09:13:21 | The checking step started; it ended by itself at 09:26:37. | R1 |
| 09:27:19 | The delivering step started; pull request [#61](https://github.com/fvermaut/scratch-app/pull/61) opened. | R1 |
| 09:30:20 | Delivering ended. The pull request's description opens with the departure list, between its markers, written by code; delivery's own text follows below it. | **R5** |
| 09:30:39 | **The runner ended the run**, because the pull request was open. | fault |
| 09:30:59 | The ticket, still open and marked, was picked up again as a new run; the "Picked this up" note was posted a second time. | fault |
| 09:31:17 | The second run's runner judged it a fault in Timone and tried to file an issue — refused, because the watched run's settings name no `timone` project — then corrected the ticket's newest note twice and ended its run. | R17 (judgement), 40q's rule |
| 09:31:44 | The machine put `timone:held` on #60, so the daemon would not start a third run. | — |

**What it showed working:** R5, R6, R13 (the message, its replay, and the step ending by itself), R15 (the ledger's time and a comment read during a step), and R9's first half (a plain-words request moved the run).

**What it did not show:** R12 — every step finished in under 15 minutes (13, 13 and 3), so no 15-minute check fell due. R9's second half — a change asked for on the pull request — could not be tried, because the run had already ended.

**Faults found:**

1. **The runner ends a run when its pull request opens.** The brief says "End a run only when its pull request is open, or when nothing was changed", which reads as permission; PRD-05.R4's "ends at a pull request" has the same looseness. A run must wait on its pull request — answer its review, and end when it is merged or closed — as the current daemon's runs do.
2. **A run ended while its ticket is open and marked is picked up again as new work,** every cycle, until something stops it. Fault 1 is how this attempt reached it.
3. **The ledger never learns the runner's step:** a run showed `stage: null` while building. `startStep` does not record the stage, so `timone status` cannot say what is running.
4. **The departure list repeats a shared reason** under each of the seven steps it applies to; one line naming the seven, with the reason once, would read far better.

The fixes are slice 40r. A second attempt, on a fresh ticket, follows them.

### The watched run — second attempt, 2026-09-28, [scratch-app#62](https://github.com/fvermaut/scratch-app/issues/62) and its piece [#63](https://github.com/fvermaut/scratch-app/issues/63): passed, with two things unseen

fvermaut restarted the daemon on the code with 40r at 12:37 UTC. The machine opened #62 with the label `timone` only and no invitation to skip anything. The run cost about $25: the initiative's own steps about $4 (#62), the piece about $19 (#63: planning $1.82, building $8.67, checking $5.80, delivering $2.42), and runner wakes at about $0.05 each.

| Time (UTC) | What happened | Shows |
| --- | --- | --- |
| 12:39:26 | Sorting started, as the default order says; `timone status` read "#62 (sorting the request) — working on it now … — $0.07 of $150.00 spent". | R1, 40r (the ledger knows the step), 40i |
| 12:41:38 | The questions step asked four questions, each with a suggested answer. | R1 |
| 12:42:30 → 12:43:49 | The machine answered, as fvermaut, "yes to al"; the runner woke 34 s later, read it as agreement to all four, and started writing the requirements. | **R9** (plain words with a spelling mistake) |
| 12:47:39 | The runner asked for the approval of the requirements. | R1 |
| 12:53:25 → 12:54:44 | **fvermaut himself** replied "approve"; the runner recorded the approval citing that comment, and the step that writes it into the file ran. | **R7** |
| 12:55:53 → 12:57:16 | The list of pieces was written (one piece), and its approval asked for. | R1 |
| 13:00:32 → 13:03:08 | **fvermaut himself** replied "approve"; after the recording step, code merged the requirements and the list into scratch-app's `main` (`70c43c2`), recording "the list of pieces was approved by fvermaut, in the comment at 2026-09-28T13:00:32Z", and opened the piece as #63. #62 became its map; no run was opened on it again. | **R3** |
| 13:04:37 | On #63 the runner started preparing the work; it did not read the machine's own `timone:held` claim as a hold. | 40n |
| 13:26:01 | **A 15-minute check** woke the runner, 15 min 41 s into the build. It sent the build a message: run only the related tests while working (it had run whole suites more than twice). | **R12**, **R13**, 40p's rule |
| 13:41:33, 14:06:49, 14:22:03 | Further 15-minute checks; the runner rightly did nothing. | **R12** |
| 13:50:42 | The build ended by itself, the runner's message taken (`"isReplay":true`). | **R13** |
| 14:25:29 → 14:30:35 | Delivering opened pull request [#64](https://github.com/fvermaut/scratch-app/pull/64). **The runner kept the run open**, waiting on it. | 40r |
| 14:39:38 → 14:39:58 | **fvermaut merged #64.** The driver saw it 4 s later; the runner replaced the ticket's stale "please review" note, ended the run, and #63 was closed. | 40r, R4 |

**Seen working live across the two attempts:** R3, R5, R6, R7, R9 (plain words, with a spelling mistake, on the ticket), R12, R13, R15, and 40r's fix.

**Not seen live:** R9's clause about a change asked for **on the pull request** — the first attempt's run had ended, and on the second the pull request was merged before one was written. It rests on 40h's test and the replay's #147 case (three tries of three).

**Found:**

1. **The map ticket stays open after its last piece merges.** #62 is still open. The current daemon closes an initiative when its last step closes (`concludeStep` in `poll.ts`); the runner's path does not.
2. **The ledger's wait can be stale.** After the questions step posted its questions and the runner posted nothing, the run waited on "the runner to look at what the step did" instead of on the person's answer, so `timone status` would say the wrong thing.
3. **The whole-suite rule is blunt.** At the 15-minute check the runner messaged the build for running whole suites more than twice, which the rule says; but one of those runs was a baseline before any change, which is good practice.

The first two are small fixes; the third is a judgement worth watching.

### The watched run — third attempt, planned 2026-09-29, on the code after 40z

The first two attempts ran before 40s–40z changed the runner. This attempt runs on `23b9186` or later, and aims at what the first two did not see.

| Criterion | What this attempt watches | How |
| --- | --- | --- |
| PRD-05.R15, clause 2 | Two tickets on scratch-app, marked together: only one runs at a time, and the second starts when the first frees the project ("The project is free now."). | Tickets A and B below, opened within one minute. |
| PRD-05.R13, clause 2 | The runner stops a running step: the box session ends, its pushed commits stay on the branch, and the record says who stopped it and why. | The first comment on A, written while A's build runs. |
| PRD-05.R9, clause 2 | "go back to planning", with a spelling mistake, is done. | The same comment. |
| PRD-05.R9, clause 3 | A change asked for on the pull request gets a reply there before the session that makes it starts. | The comment on A's pull request. |
| PRD-05.R12, clause 2 | A 15-minute check with a summary written by code. | Seen when a step runs longer than 15 minutes; `timone record` shows the check. |
| PRD-05.R12, clause 1; R9, clause 1 | A comment wakes the runner within one polling cycle. | Every comment above; the daemon's log gives the times. |

**Not watched in this attempt, and why:**

- **R15, clause 1** (a comment on another project while a step runs) needs a second project with GitHub tickets. The only other one is ivtrends, which is a live project and is not used for tests. It rests on the check after 40y, which timed it in the rig (2.1 seconds, against 87.3 before 40y).
- **R12, clause 1, "a step fails" and "a step is silent past its limit".** A failing step cannot be caused on purpose without breaking something real. The silence limit is not built (Spec review, finding 7).

**Steps for fvermaut, in `~/dev/timone/projects/timone`, from your own terminal:**

1. Check that no other Timone daemon is running. The one run from `main` also reads scratch-app's tickets.
2. `npm run build && node dist/cli.js daemon --manifest .timone/live-gate.yaml`. Leave it running and say so. Check its first line: the model login it names must be the lasting token.
3. The machine then opens tickets A and B on scratch-app and writes the comments, as fvermaut, each marked as machine-typed.
4. When the machine says the run is over, stop the daemon (Ctrl-C).

**Cost.** Two small changes, each capped at $150 by its ticket's limit. A build session has cost $9 to $36.

#### The test tickets (machine-typed)

**Ticket A — title:** Trim the spaces around a to-do's title when it is edited

> A to-do's title is trimmed when it is added, but not when it is edited. When I edit a title and leave spaces before or after it, the spaces are kept. Trim them when an edited title is saved. A title that is only spaces should be refused, as it is when adding.
>
> *Machine-typed on fvermaut's behalf, for the third watched run of Timone phase 40.*

**Ticket B — title:** Show how many to-dos are left

> Under the list, show how many to-dos are not done yet, for example "3 left". When none are left, show "Nothing left".
>
> *Machine-typed on fvermaut's behalf, for the third watched run of Timone phase 40.*

**Labels on both:** `timone`, `triage:chore`.

**Comments the machine writes, as fvermaut, at the moments named:**

- On A, a few minutes after its build starts: *"stop the build and go bakc to planning: an edited title must also keep its old value when it is refused, not become empty"* — the runner should stop the build step (R13) and start preparing the work again (R9).
- On A's pull request, once it is open: *"plase also add a test for an edited title that is only spaces"* — the runner should reply on the pull request first, then start the change (R9).
- B needs no comment. It should start only after A's run has ended or freed the project (R15).

### The watched run — third attempt, 2026-09-30, [timone#175](https://github.com/fvermaut/timone/issues/175): result

fvermaut started the daemon from `projects/timone` at 06:10:55 UTC, on `4110602` (the merge of #173). Its first line: "Model login: a lasting token, from this daemon's environment. Runs of any length are covered." It warned that it was one commit behind `main`; that commit (`e04b774`) changes only `STATUS.md`. The machine then ran everything else alone, as fvermaut asked: it wrote every ticket and comment, each marked as machine-typed, and stopped the daemon at the end.

**The two tickets in the plan were wrong.** Ticket A asked to trim an *edited* title, but the app has no way to edit a title. Ticket B asked to show how many to-dos are left, but the app already shows "N left". Both would have needed fvermaut's approval of new requirements, so neither could reach a pull request without him. The machine closed both (#65, #66) and opened two real chores in their place. Both were raised by the Standards review of scratch-app's phase 12 and never filed:

- **A, [scratch-app#67](https://github.com/fvermaut/scratch-app/issues/67):** handle each reason a new title is refused by name (finding 2).
- **B, [scratch-app#68](https://github.com/fvermaut/scratch-app/issues/68):** remove the 59 null checks the to-do service tests no longer need (finding 3).

B got the project first (see "Found", item 4), so the comments the plan wrote for A went to whichever ticket was building. The pull request the machine closed was B's; A's is left open for fvermaut.

#### The wrong pair, #65 and #66

| Time (UTC) | What happened | Shows |
| --- | --- | --- |
| 06:11:23 | #65 opened, with the labels `timone` and `triage:chore`. Picked up at 06:12:02. | — |
| 06:12:10 | #66 opened. At 06:13:08 it was put in the queue: "This one is in the queue." | R15 |
| 06:12:41 → 06:13:32 | Sorting on #65 found that the app cannot edit a title, so the ticket asks for a feature. It changed the label to `triage:feature` and said questions come next. | a good judgement |
| 06:13:53 | #65's runner tried to start the questions step and was refused: "Project scratch-app already has a session for run scratch-app#66/1 (picked-up) — one session per project at a time". #66 had left the queue while #65 paused between steps. | **R15**, clause 2 |
| 06:15:15 → 06:18:45 | Sorting, then questions, on #66. | — |
| 06:18:45 | #65's runner woke on "The project is free now.", the second #66's questions step ended. | **R15**, clause 2 |
| 06:19:03 | The machine closed #65 and #66, as fvermaut, saying why. #65's questions step was running. | — |
| 06:19:49 → 06:20:01 | #65's runner woke on the comment and the close, 46 s later, and stopped the running step: "fvermaut closed the ticket … so there is no reason to ask questions." The record: the step ended, stopped by the runner. Both runs then ended, with nothing changed. | **R13**, clause 2; **R9**, clause 1 |

#### B, #68, and its pull request #69

| Time (UTC) | What happened | Shows |
| --- | --- | --- |
| 06:20:35, 06:20:58 | A (#67) and B (#68) opened, 23 s apart. | — |
| 06:22:27 | A had been sorted as a small technical job. Its runner tried to start preparing the work and was refused: B held the project, having left the queue while A paused after sorting. A said so on its ticket: "Waiting for another ticket." | **R15**, clause 2 |
| 06:23:54 → 06:33:57 | On B: sorting, preparing the work, building. The build pushed its commit and closed its phase in under 3 minutes. | R1 |
| 06:33:56 | The machine wrote on B, as fvermaut: "stop the build and go bakc to planning: the plan should also look at the browser tests under `tests/e2e` …". The build ended by itself one second later. | — |
| 06:34:13 | The runner answered on the ticket: the build had already finished, so there was nothing to stop, the pushed changes stay, and it was going back to the plan. | **R9**, clause 2 |
| 06:34:47 → 06:54:41 | Preparing the work again, now with the browser tests; building; checking; delivering. Pull request [#69](https://github.com/fvermaut/scratch-app/pull/69) opened. | R1 |
| 06:55:12 | The machine wrote on #69, as fvermaut: "plase also add one line above `createdTodo` saying it never returns an empty value …". | — |
| 06:56:07 → 06:56:52 | The runner woke 55 s later. At 06:56:19 it replied on the pull request: "I am making this change now." The build step started at 06:56:52, 33 s after the reply. | **R9**, clause 3 |
| 06:57:38 | The change was pushed. At 06:57:56 the runner replaced its reply on the pull request, which was no longer true. | — |
| 06:59:15 | The machine closed #69 without merging, saying it was a test. The runner woke 6 s later. | — |
| 06:59:36 | The runner did not end the run. It asked on the ticket for a stop "from a comment on this ticket. The comment on the pull request does not count." B kept the project. | fault 2 |
| 07:40:07 | The machine wrote the stop on the ticket. It had missed the request for 40 minutes, because it was watching for A's build only. The run ended 17 s later, as cancelled. | R9 |

#### A, #67

| Time (UTC) | What happened | Shows |
| --- | --- | --- |
| 07:41:13 | A's runner woke on "The project is free now.", 79 minutes after it was refused. | **R15**, clause 2 |
| 07:41:55 → 07:46:23 | Preparing the work. | — |
| 07:47:02 | The build started. | — |
| 07:48:06 | The machine wrote on A, as fvermaut: "stop the build now. The plan should also build the number in the refusal message from `TITLE_MAX_LENGTH` … Plan that, then build again." | — |
| 07:48:35 → 07:48:46 | The runner woke 29 s later and stopped the build: "fvermaut asked to stop the build now so the plan can be changed first." The box session ended ("cancelled, so its session is being ended"). The record: the step ended, stopped by the runner, with that reason. The plan's commit stayed on the branch; the build had pushed nothing yet. | **R13**, clause 2 |
| 07:49:38 | Preparing the work started again, with the new scope. | **R9**, clause 2 |
| 07:49:39 | The runner also asked fvermaut to add `DIRECT_URL` to the daemon's settings file, saying the build could not run the tests without it. That was wrong: the stopped build had set the value in its own shell, as its plan said, and had applied the migrations and passed the type check. B had built twice the same way. At 07:55:23, when planning ended, the runner held the build for it. | fault 1 |
| 07:55:57 | The machine answered, as fvermaut, with that evidence. The runner woke 62 s later, started the build at 07:57:46, and corrected its own comment. | R9, clause 1 |
| 07:57:46 → 08:06:46 | Building, on the new plan. | R1 |
| 08:07:30 | Checking started. | — |
| 08:22:36 | **A 15-minute check** woke the runner, 15 min 6 s into the check. Its brief, written by code, listed every command the step had run, cut to one line each, and when the step last wrote (5 s before). The runner left the step alone and posted nothing: "It's making progress … Nothing shows it ran the whole suite more than twice." | **R12**, clause 2 |
| 08:27:05 → 08:30:58 | Checking ended; delivering opened pull request [#70](https://github.com/fvermaut/scratch-app/pull/70). Its description opens with the departure list, then a question for fvermaut: with JavaScript turned off, the built app shows a blank page after any add, on `main` too. | R5 |
| 08:31:56 | The machine stopped the daemon (SIGTERM), with no step running. It exited cleanly. A's run waits on #70. | — |

**Seen working in this attempt:**

- **R9, all three clauses.** Every comment moved the run or got an answer. A request to go back to planning, with a spelling mistake, was done. A change asked for on the pull request got a reply there 33 s before the session that made it.
- **R13, clause 2**, on a questions step (#65) and on a build (#67): the runner stopped the step, the box session ended, and the record says it was the runner and why.
- **R15, clause 2.** Two refusals ("one session per project at a time") and two wakes on "The project is free now.". No two steps of scratch-app ran at the same time all morning.
- **R12, clause 2**, in part: a check at 15 minutes, with the commands listed by code.
- **R12, clause 1, for comments and step ends.** The runner woke between 3 and 62 seconds after each comment, and within 5 seconds of each step's end. The polling cycle is 60 seconds.

**Not seen:**

- **R13, clause 2, "its pushed commits stay on the branch".** The build was stopped before it had pushed anything. The plan's commit stayed.
- **R12, clause 2, "the output so far".** The summary lists commands, not their output. This is already in [#176](https://github.com/fvermaut/timone/issues/176).
- **R12, clause 1, a step that fails or goes silent**, and **R15, clause 1** (a second project), as the plan said.

**Found:**

1. **The runner held a build for a setting it did not need.** After it stopped A's build, it read that build's session, told fvermaut the build "cannot run the tests" without `DIRECT_URL`, and held the next build until someone answered. The build had set the value in its own shell, as its plan said. The run moved on only when a comment said so. Filed as [#177](https://github.com/fvermaut/timone/issues/177).
2. **A stop written when closing a pull request is not taken.** The runner asks for it again on the ticket, and the run keeps the project until then. Here A waited 40 more minutes. The code does this on purpose (40w); the second question is still one too many. Filed as [#178](https://github.com/fvermaut/timone/issues/178).
3. **A stopped step's cost is recorded as $0.** A's stopped build ran 1 min 40 s. Already in [#176](https://github.com/fvermaut/timone/issues/176); now seen live.
4. **Smaller things**, filed together as [#179](https://github.com/fvermaut/timone/issues/179):
   - The queue hands the project to the next ticket whenever the running ticket pauses between steps. B overtook A, although A was opened first and sorted first.
   - The departure lists on #69 and #70 say "ran out of order. No reason given." The runner gave its reason when it started the step (fvermaut asked), but the list reads reasons only from departure entries.
   - The comment that asked to go back to planning woke the runner twice: first inside the wake for the build's end, where it acted on it, then again at 06:34:51 as a new event. The second wake cost $0.04 and did nothing.
   - While A waited for B, `timone status` said "#67 (sorting the request) — waiting: nothing." It did not say A waited for #68.
   - The check's brief said "There are no open Timone issues labelled bug". There are many; this daemon's settings name no Timone project, so it could not read them.
5. **Not new, noted.** Sorting and status-file commits went straight to scratch-app's `main` three times (`570f682`, `78db7e8`, `99dbc31`), as the skills say. ADR-0060 D2 says nothing reaches a default branch without a person's yes. [#85](https://github.com/fvermaut/timone/issues/85) is the open issue.

**Cost.** About $22: the wrong pair $1.53 (#65 $0.57, #66 $0.96), B $9.45, A $11.08. Of that, $1.89 was the runner deciding what to do next.
