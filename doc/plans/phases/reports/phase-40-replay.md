# Phase 40 — Replay of the recorded failures

> The runner woken three times on each of the nineteen cases of [PRD-05.R18](../../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md), over stand-ins for the forge, the ledger and the box ([harness](../../../../src/runner/replay/harness.ts)). Run by fvermaut from his own terminal: the build's sandbox has no model login.

## Run 1 — 2026-09-28: 13 of 19 passed, $2.42

```
Replaying 19 cases, 3 tries each, on claude-opus-5-5.
PASS #139 — Read planning as finished, and start the build. 3 of 3 tries.
PASS #140 — Read planning as done, and start the build. 3 of 3 tries.
PASS #144 — Not wait on the person. Choose the next step. 3 of 3 tries.
PASS #143, #161 — Try the start again. If it keeps failing, say so on the ticket. 3 of 3 tries.
PASS #99 — End the run, and free the project. 3 of 3 tries.
PASS #115 — Start nothing on it. 3 of 3 tries.
PASS #142 — Clear the hold, then start the work. 3 of 3 tries.
FAIL #108 — Start a session that corrects the requirements, then check again. 0 of 3 tries chose it. Try 1: posted on the ticket: "The check found one conflict. The second line of R4 in [prd-03-export.criteria.md](https://github.c…"; put the hold on; filed a Timone issue: "A step's "Needs a person" comment ends with "What I need from you: nothing"" — wanted: writing down what it needs (requirements) started first. Try 2: posted on the ticket: "The check found one conflict, and only you can settle it. The second line of R4 in [prd-03-export.c…"; put the hold on; filed a Timone issue: "A step that stops to ask a person reports success and asks for nothing" — wanted: writing down what it needs (requirements) started first. Try 3: posted on the ticket: "The check stopped on one line. The second line of R4 in [prd-03-export.criteria.md](https://github.…"; put the hold on; filed a Timone issue: "A "Needs a person" comment ends with "What I need from you: nothing"" — wanted: writing down what it needs (requirements) started first.
FAIL #111 — Start again from that discussion, as PRD-03.R1 says. Do not ask. 0 of 3 tries chose it. Try 1: posted on the ticket: "I saw your two comments on #61 and that you closed it. I am not sure what you want me to do next, s…" — wanted: a step started that does the work again from the review; and no comment that asks fvermaut for something. Try 2: posted on the ticket: "I saw your two comments. Then you closed pull request #61 without merging it. I can't tell from tha…" — wanted: a step started that does the work again from the review; and no comment that asks fvermaut for something. Try 3: posted on the ticket: "I saw your two points on the pull request: the chart must follow the filter too, and the date picke…" — wanted: a step started that does the work again from the review; and no comment that asks fvermaut for something.
FAIL #159 — Open the pull request with that check listed as not run. 0 of 3 tries chose it. Try 1: put the hold on — wanted: delivering (delivery) started again, to open the pull request. Try 2: did nothing — wanted: delivering (delivery) started again, to open the pull request. Try 3: filed a Timone issue: "Checking step says "nothing needed" when a person-only live check is owed, then delivery refuses" — wanted: delivering (delivery) started again, to open the pull request.
PASS #117 — List the skip as a departure, and carry on to the pull request. 3 of 3 tries.
FAIL #120 — Not offer the same command again. Say what is actually needed. 0 of 3 tries chose it. Try 1: started building (execution): "Resume the build of ivtrends#97 on branch timone/97-show-daily-closing-prices-on-the-chart. Plan: d…" — wanted: a comment on the ticket that asks for what is needed. Try 2: started building (execution): "Continue building ticket ivtrends#97 on branch timone/97-show-daily-closing-prices-on-the-chart, fo…" — wanted: a comment on the ticket that asks for what is needed. Try 3: started building (execution): "Resume the build of ivtrends#97 on branch timone/97-show-daily-closing-prices-on-the-chart. Follow …" — wanted: a comment on the ticket that asks for what is needed.
PASS #125, #135 — Carry the question to the pull request, and open it. 3 of 3 tries.
PASS #132 — Act on the word. 3 of 3 tries.
PASS #147 — Say on the pull request that the change is being made, then start it. 3 of 3 tries.
FAIL #104 — Skip the interview and start planning. Post the departure on the ticket. 0 of 3 tries chose it. Try 1: posted on the ticket: "**I am skipping 3 steps.** I am going straight to working out the pieces, without asking what you n…"; started working out the pieces (breakdown): "Work out the list of pieces for scratch-app #68: send a reminder the day before a task is due. The …"; posted on the ticket: "I will build from R3 in [prd-05-reminders.md](https://github.com/fvermaut/scratch-app/blob/main/doc…"; recorded a departure (clarification, requirements, requirements-approval) — wanted: preparing the work (planning) started. Try 2: posted on the ticket: "**I am skipping 3 steps.** I am going straight to working out the pieces, without asking what you n…"; started working out the pieces (breakdown): "Work out the pieces for ticket #68: build R3 of doc/specs/prd/prd-05-reminders.md (send a reminder …"; posted on the ticket: "R3 in [prd-05-reminders.md](https://github.com/fvermaut/scratch-app/blob/main/doc/specs/prd/prd-05-…"; recorded a departure (clarification, requirements, requirements-approval) — wanted: preparing the work (planning) started. Try 3: posted on the ticket: "**I am skipping 3 steps.** I am going straight to working out the pieces, without asking what you n…"; started working out the pieces (breakdown): "Work out the list of pieces for scratch-app #68: send a reminder the day before a task is due. The …"; posted on the ticket: "I will not ask questions or write new requirements. I will use R3 in [prd-05-reminders.md](https://…"; recorded a departure (clarification, requirements, requirements-approval) — wanted: preparing the work (planning) started.
PASS scratch-app#37 — Write the requirements. Record no approval. Post that the approval was skipped, and carry on. 3 of 3 tries.
PASS ivtrends#1 — Start it again after a wait, and post nothing unless it keeps failing. 3 of 3 tries.
FAIL #110 — Send the step a message to run only the tests its change affects. 0 of 3 tries chose it. Try 1: did nothing — wanted: a message sent to the running step. Try 2: did nothing — wanted: a message sent to the running step. Try 3: did nothing — wanted: a message sent to the running step.
13 of 19 cases passed. The runner's sessions cost $2.42 in all.
```

### What the six failures say

| Case | What the runner did | Why | What changes |
| --- | --- | --- | --- |
| #108 | Asked the person, put the hold on, filed a Timone issue. | The rules do not say that a wrong line in the requirements is corrected by the step that writes them, nor that the hold is not a way to wait. | The rules (40p). |
| #111 | Asked what to do next. | The rules do not carry PRD-03.R1: a pull request closed without merging, with a review saying what was wrong, is done again from that review. | The rules (40p). |
| #159 | Put the hold on, did nothing, or filed an issue. | The rules do not carry ADR-0059 D1: a check only the operator can run does not stop delivery; it is listed on the pull request as not run. | The rules (40p). |
| #120 | Started the build again. | The case left out part of the moment: in the real incident the terminal session ended with a note saying it could not clear the stop. Without it the runner cannot know the key is still missing, and trying again is a fair reading. | The case's fixture gains that note (40p); the matcher is unchanged. |
| #104 | Skipped to working out the pieces, with the departure posted. | Right by the written order: for a feature, planning begins with the list of pieces (process.md stage 5). The matcher read the table's "start planning" as the `planning` step only. | The matcher accepts `breakdown` or `planning` (40p). |
| #110 | Did nothing at the check. | The rule says the runner *may* message a step that repeats a command "without getting further", and the edits between the six suite runs looked like progress. The written process is plainer: single test files while working, the whole suite once at the end (process.md stage 6). | The rules (40p). |

Two of the six changes touch a case, against the plan's rule that a failing case changes the brief and not the case. Both are recorded in [phase-40-departures.md](phase-40-departures.md) with the reason: one fixture left out a fact of the moment it names, and one matcher read the table more narrowly than the process does. No case's expected action was weakened to make the runner pass.

## Run 2 — 2026-09-28, after 40p: 18 of 19 passed, $2.33

```
Replaying 19 cases, 3 tries each, on claude-opus-5-5.
PASS #139 — Read planning as finished, and start the build. 3 of 3 tries.
PASS #140 — Read planning as done, and start the build. 3 of 3 tries.
PASS #144 — Not wait on the person. Choose the next step. 3 of 3 tries.
PASS #143, #161 — Try the start again. If it keeps failing, say so on the ticket. 3 of 3 tries.
PASS #99 — End the run, and free the project. 3 of 3 tries.
PASS #115 — Start nothing on it. 3 of 3 tries.
PASS #142 — Clear the hold, then start the work. 3 of 3 tries.
PASS #108 — Start a session that corrects the requirements, then check again. 3 of 3 tries.
PASS #111 — Start again from that discussion, as PRD-03.R1 says. Do not ask. 3 of 3 tries.
PASS #159 — Open the pull request with that check listed as not run. 3 of 3 tries.
PASS #117 — List the skip as a departure, and carry on to the pull request. 3 of 3 tries.
FAIL #120 — Not offer the same command again. Say what is actually needed. 0 of 3 tries chose it. Try 1: did nothing — wanted: a comment on the ticket that asks for what is needed. Try 2: did nothing — wanted: a comment on the ticket that asks for what is needed. Try 3: did nothing — wanted: a comment on the ticket that asks for what is needed.
PASS #125, #135 — Carry the question to the pull request, and open it. 3 of 3 tries.
PASS #132 — Act on the word. 3 of 3 tries.
PASS #147 — Say on the pull request that the change is being made, then start it. 3 of 3 tries.
PASS #104 — Skip the interview and start planning. Post the departure on the ticket. 3 of 3 tries.
PASS scratch-app#37 — Write the requirements. Record no approval. Post that the approval was skipped, and carry on. 3 of 3 tries.
PASS ivtrends#1 — Start it again after a wait, and post nothing unless it keeps failing. 3 of 3 tries.
PASS #110 — Send the step a message to run only the tests its change affects. 3 of 3 tries.
18 of 19 cases passed. The runner's sessions cost $2.33 in all.
```

The four cases whose rules 40p added (#108, #111, #159, #110) and the case whose matcher it corrected (#104) all pass, three tries of three.

**#120 failed because of the case, and the case is changed again.** The note 40p added for the terminal session already asked for the key, so the ticket's newest message said what was needed, and the runner rightly did nothing: repeating the question would add nothing. That made the case test nothing. The real #120 ended differently: the terminal session posted that it could not clear the stop, and the ticket still pointed at the same `timone takeover` command. The note is rewritten to say that, so the runner must replace the pointer to the command with what is actually needed. Recorded in [phase-40-departures.md](phase-40-departures.md).
