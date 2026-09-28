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

Not run yet.
