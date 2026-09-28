# Phase 40 — Watched run on scratch-app

> **Status:** not run yet. Owed before ivtrends moves to the runner (PRD-05.R19).
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

### The watched run — second attempt

Not run yet.
