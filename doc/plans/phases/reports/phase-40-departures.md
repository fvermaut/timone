# Phase 40 — Departures record

> One dated entry per departure, appended as it happens, never rewritten. Format per `.claude/skills/timone-execute/SKILL.md`, "The departures record".

## 2026-09-27 — timone#165, planning

**Kind:** requirement amended

**Agreed:** [PRD-05.R12](../../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md) said the 15-minute summary gives "the commands the step ran since the last check, the time taken and the cost".

**Did instead:** The summary gives the commands, the time taken and the output so far. The step's cost is recorded when the step ends. The criterion is amended in place with a dated marker.

**Why:** A session reports `total_cost_usd` only in its final `result` message (`SessionProgress.observe`, `src/daemon/progress.ts`). While it runs, the stream carries output token counts and no cost. A cost worked out from a price list would be a guess presented as a fact.

## 2026-09-27 — timone#165, planning

**Kind:** requirement read narrowly

**Agreed:** [PRD-05.R8](../../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md) says that at the limit "no session starts", and that a named person's "continue", "in any wording that means it", allows another $150.

**Did instead:** At the limit, no step session and no runner session starts. The named person's reply is read by a one-turn check with no tools and no actions — the same kind of call as the ask check (`src/daemon/consult.ts`) — which only answers whether the reply means go on. Code then records the raise and wakes the runner.

**Why:** Reading "go on" in any wording needs a model, and the runner is exactly the session R8 keeps from starting. The check costs a fraction of a cent, can do nothing but answer yes or no, and its answer is acted on by code. Recorded so the reader of R8 sees the one model call that still happens at the limit.

## 2026-09-27 — timone#165, execution

**Kind:** plan step

**Agreed:** Sub-phase 40d said the in-process runtime (`agentSdkRuntime`) would take messages while a step runs, through streaming input, under the same rule as the box.

**Did instead:** The in-process runtime is left as it is. It starts an interactive request as it starts any other and offers no `send`; the runner's `messageStep` refuses on it. The plan is amended in place.

**Why:** The plan declared no seam and no red-green case for that change, so it could not be built test-first as written. The daemon runs the container runtime unless `--runtime in-process` is given, and the steps the runner starts run in the box, where 40d does build the message mode.

## 2026-09-27 — timone#165, execution

**Kind:** plan step

**Agreed:** Sub-phase 40b said `setPullRequestBody` passes the body on standard input, `gh pr edit --body-file -`.

**Did instead:** The body is written to a temporary file, passed as `gh pr edit --body-file <path>`, and the file is removed afterwards, whether the call succeeded or not. The plan is amended in place.

**Why:** The `CommandRunner` the adapter runs `gh` through has no way to pass standard input (`CommandOptions` holds only `cwd`, `env`, `repository` and `timeoutMs`). Widening it would also widen the credential wrapper that every forge call goes through, for one method. A temporary file needs no change outside the adapter.

## 2026-09-27 — timone#165, execution

**Kind:** plan step

**Agreed:** Sub-phase 40f built the brief and the facts, and could run in parallel with 40d and 40e. Nothing in the plan said where a ticket's kind is worked out from its labels.

**Did instead:** 40f also adds `ticketKindOf(labels, context)` to `src/runner/order.ts`, with a test in a new `src/runner/order.test.ts`. 40e now waits for 40f. The plan and its dependency graph are amended in place.

**Why:** The brief needs the kind to show the default order, and the runner's actions need it to tell whether a step is a departure. One function beside `defaultOrder` keeps both reading the same answer.

## 2026-09-27 — timone#165, execution

**Kind:** check not run

**Agreed:** Sub-phase 40d's validation ran a protocol probe against the real model: two user messages into `claude -p --input-format stream-json`, two model answers out.

**Did instead:** The probe ran, and gave two `result` messages, but both were login errors: the command-line tool is not logged in from the build's sandbox, and running it outside the sandbox was refused, so the build did not try again another way. The same shape in the box image, with no token, replayed both messages and gave two results. That confirms the protocol the end rule rests on, but not a model's answer, and not that a message joining a turn during a tool call is replayed. Both checks move to the watched run on scratch-app (40l), which the plan amends to say so. The slice is committed with the checkbox unmet.

**Why:** The probe needs the operator's own logged-in terminal, and a second attempt from the same sandbox would fail the same way. If a message that joins a running turn were not replayed, the box would keep its stdin open after the last `result` until stopped, and the runner's `stopStep` or the ticket's limit would be the only way out — which is why it is worth watching once for real.

## 2026-09-27 — timone#165, execution

**Kind:** plan step

**Agreed:** Sub-phase 40e said `mergeChunkZero` refuses unless the ticket's run record holds an `approval` entry for the list of pieces, and that "the current daemon's path supplies its approval the same way".

**Did instead:** `mergeChunkZero` takes the approval as a required argument, `{ by, at }`. The runner's path passes it only from the record's `approval` entry, and its `recordApproval` action refuses before any merge when there is none. The current daemon passes the approval it read from the person's reply. `src/daemon/session.ts` is granted to 40e for that one call site, and case (6) is reworded to test both.

**Why:** The current daemon keeps no run record, so it could not supply the approval "the same way" without writing records it never reads, and `session.ts` was not in the slice's file list. A required argument makes a merge with no approval impossible to write on either path, which is what R3 asks of every merge path.

## 2026-09-27 — timone#165, execution

**Kind:** plan step

**Agreed:** The amended 40e granted `src/daemon/session.ts` for "one call site": `recordApproval` passing the gate's approval to `mergeChunkZero`.

**Did instead:** Two call sites changed. The spawner also keeps a private `mergeChunkZero` delegator, which `session.test.ts` reaches by name; it would not compile without the approval, so it now takes the approval and passes it on. No test file changed. The plan is amended in place. `attemptMerge`, the lower-level merge the delegators use, stays exported for the same tests and takes no approval; nothing in the runner calls it. It is listed for the delivery review as the one merge path the compiler does not guard.

**Why:** The plan's "one call site" counted the wrong number of callers. The second is the same spawner path and carries the same approval, so the guard is unchanged in strength.

## 2026-09-27 — timone#165, execution

**Kind:** plan step

**Agreed:** Sub-phase 40g added the wait kind `runner` and said "every exhaustive switch over the wait kind the compiler reports" in `cta.ts`, `status.ts`, `takeover.ts` and `retry.ts` would be changed, with no test of its own.

**Did instead:** Those files read the wait kind with `if` chains, so the compiler named none of them. The changes were made as the plan and the orchestrator's notes ask — `status` prints "waiting: <on>", `takeover` treats `runner` as an escalation, `retry` refuses with the plan's sentence, and `cta.ts` has a `runner` arm that asks for nothing — each checked by a scratch script, not a test. Their tests move to 40h (`takeover`, `retry`) and 40i (`status`, including the side effect that the status line's last sentence does not count a runner wait). `package.json` gains `@modelcontextprotocol/sdk` 1.30.0 as a development dependency: 40g's test drives the real tool server through an MCP client, and the package was only present because the agent library depends on it.

**Why:** A behaviour change with no test is a plan defect under the undeclared-seams rule. The cheapest honest fix is to give the tests to the slices that already own those files' seams, rather than let 40g edit test files it was not granted.

## 2026-09-27 — timone#165, execution

**Kind:** check not run

**Agreed:** Sub-phase 40j's validation runs `npm run replay`, which wakes the real runner on each of the nineteen recorded cases, three times each.

**Did instead:** The build writes the harness, the cases and the harness's own tests. The replay itself is moved to a human gate: the operator runs it once from his own logged-in terminal before delivery, and its output goes to `reports/phase-40-replay.md`. The plan is amended in place.

**Why:** The build's sandbox has no model login: `claude auth status` reports `loggedIn: false`, no `CLAUDE_CODE_OAUTH_TOKEN` or API key is set, and 40d's probe failed on login for the same reason. Every call to the real model — the replay, 40d's owed probe, the watched run — needs the operator's terminal.

## 2026-09-27 — timone#165, execution

**Kind:** plan step

**Agreed:** The plan had no slice for how a step ticket's hold label is read. 40g's brief reads `timone:held` on any ticket as a person's hold.

**Did instead:** A new sub-phase, 40n, makes the brief show a step ticket as not held when the label is the machine's own claim. 40l now waits for it. The plan and its dependency graph are amended in place.

**Why:** On a step ticket the label is put on by the machine at pickup (ADR-0044 D7); 40h found this and made the driver read it that way. Left as it was, the brief would tell the runner every step ticket is held, and a runner told that may do nothing — every piece of a split initiative would stall. Known gap left open: the runner's own `setHold` on a step ticket changes nothing about wakes, since the label there is already the claim.

## 2026-09-27 — timone#165, execution

**Kind:** plan step

**Agreed:** The plan had no slice for when an approval may be recorded, beyond "a named person's own comment" (40e), or for the end of a step the daemon was stopped under.

**Did instead:** A new sub-phase, 40o: `recordApproval` refuses a comment written before the step that produced what it approves ended; and a run taken back after a daemon stop gets a `step-ended` (`stoppedBy: "daemon"`) for the step that was running. 40l now waits for it. The plan and its dependency graph are amended in place.

**Why:** 40j's cases showed both. On scratch-app#37, once the requirements exist, "approve them yourself in my name" — a named person's comment — would be accepted as the approval, so PRD-05.R7 would hold only because the runner's rules say so; requiring the comment to come after the document makes it hold in code. On #140, the record kept a step "running" that nothing was running, and the brief showed exactly that to the runner.

## 2026-09-27 — timone#165, execution

**Kind:** plan step

**Agreed:** Sub-phase 40o's tests were to be new cases only.

**Did instead:** Three cases 40e wrote earlier in this phase — they record an approval of the list of pieces — have fixtures with no `breakdown` step at all, and the new rule rightly refuses an approval of something the run never produced. Their fixtures gain one earlier successful `breakdown` `step-ended` entry. No assertion of theirs changes. The plan is amended in place.

**Why:** The rule is the point of the slice (an approval must come after what it approves), and those fixtures described a situation the rule now forbids. They are this phase's own tests, written two slices earlier, not tests the rest of the daemon relies on. The alternative — accept an approval when no step of that stage exists — would let a comment written before any requirements existed be recorded as their approval.

## 2026-09-28 — timone#165, execution

**Kind:** plan step

**Agreed:** Sub-phase 40j: "The cases themselves are the specification: when a case fails, the runner's brief or rules are what change, never the case."

**Did instead:** The first real replay passed 13 of 19. A new sub-phase, 40p, changes the runner's rules for four of the six failures (#108, #111, #159, #110). For the other two it changes a case: #120's fixture gains the note the terminal session left when it ended without clearing the stop, and #104's matcher accepts `breakdown` as well as `planning`. No case's expected action is weakened.

**Why:** #120's fixture left out a fact of the moment it names — in the real incident the terminal session ended with a note saying it could not clear the stop — so the runner could not know the key was still missing, and trying the build again was a fair reading of what it was shown. #104's table row says "start planning", and for a feature, planning begins with the list of pieces (`process.md` stage 5); the runner went there, posted the departure, and the matcher read "planning" as the `planning` step only. Changing the rules to make the runner jump past the list of pieces would have taught it to break the written order.

## 2026-09-28 — timone#165, execution

**Kind:** plan step

**Agreed:** 40p gave #120's ticket "the note the terminal session left when it ended without clearing the stop (the box still has no key; only fvermaut can add it)".

**Did instead:** The note is rewritten. It now says the terminal session could not clear the stop, and — as the real #120's ticket did — it points at the same `timone takeover` command again. The case's matcher, run, record and events do not change. The case is replayed alone from the operator's terminal (run 3).

**Why:** The note as 40p wrote it asked for the key itself. The ticket's newest message then already said what was needed, the runner rightly did nothing (run 2, three tries of three), and the case tested nothing. The real #120's fault was a ticket whose newest word pointed at a command that could not help; the runner has to replace that with what is actually needed, and the case must show it that state.

## 2026-09-28 — timone#165, execution

**Kind:** plan step

**Agreed:** PRD-05.R18's row for #120: "Not offer the same command again. Say what is actually needed." The case's matcher read it as: post a comment that asks the person for something.

**Did instead:** A new sub-phase, 40q. The runner's rules gain ADR-0024's rule — the ticket's newest message says truthfully what it needs now, and a stale one is replaced. The #120 matcher passes a new comment that does not offer the command and either asks for what is needed or goes with a step the runner starts. Doing nothing, or offering the command again, still fails.

**Why:** Replay run 3 showed two tries carrying on without the missing key and listing the live check for the pull request — which is what ADR-0056 and ADR-0059 D1 say, and what 40p's own rule taught. A matcher that demands a stop contradicts the process the runner follows. The third try did nothing, which is the real #120 fault, and nothing in the runner's rules forbade it; ADR-0024's rule does. This is the third change to #120's case in this phase. Each one is recorded with its reason, and none of them lets doing nothing pass.

## 2026-09-28 — timone#165, execution

**Kind:** plan step

**Agreed:** The plan had the runner end a run through `endRun`, refused only when the branch held commits and no open pull request existed (PRD-05.R4, 40e), and a brief rule reading "End a run only when its pull request is open, or when nothing was changed."

**Did instead:** A new sub-phase, 40r: `endRun` refuses while the run's pull request is open; the brief says a run waits on its pull request and ends when it is merged or closed; `startStep` records the step in the ledger; the departure list says a shared reason once.

**Why:** The watched run's first attempt, on scratch-app#60: the runner ended the run as soon as pull request #61 opened, exactly as the rule allowed. A change asked for on the pull request would then have reached nobody, and the ticket — still open and marked — was picked up again as new work on the next cycle, and would have been every cycle after without the hold the machine put on it. R4's "ends at a pull request" was meant as *reaches* one; the rule and the check read it as *may stop at* one. The two smaller faults were seen on the same run.

## 2026-09-28 — timone#165, execution

**Kind:** plan step

**Agreed:** The plan had no slice for closing an initiative's map when its last piece merges on a runner project, for the wait text after a wake that posts nothing, or for what the runner knows about a key missing in the box.

**Did instead:** A new sub-phase, 40s, covers all three. The operator runs the full replay once more after it (run 5).

**Why:** The watched run's second attempt left map #62 open after its only piece merged — the current daemon closes a map in `concludeStep`, and the runner's path never reaches that code — and showed a run waiting on "the runner to look at what the step did" while it really waited on the person's answer. Replay run 4 passed #120 two tries of three; the likely reason is that the runner cannot rule out a terminal session as the way a key is added, and Timone knows it is not (ADR-0045). Without the map fix, every split feature on ivtrends would leave its map open.

## 2026-09-28 — timone#165, execution

**Kind:** plan step

**Agreed:** Sub-phase 40s granted `src/daemon/poll.ts` "only to export what the map-closing code needs".

**Did instead:** The map-closing half of `concludeStep` was moved, unchanged, into a new exported function, `closeInitiativeIfDone`, which `concludeStep` now calls and the runner's `endRun` calls too. `poll.test.ts` passes unchanged (230 of 230). The import it needs makes a third import cycle (poll → cta → runner/session → runner/actions → poll); no module in it reads another's names while loading, checked by loading each of the six first.

**Why:** Exporting `concludeStep` as it stood would also have posted "Merged — this step is done." on the piece and closed it, which the runner already does itself. Splitting it was the only way to reuse the map-closing code without a second copy of it, which the plan forbade.

## 2026-09-28 — timone#165, execution

**Kind:** requirement amended

**Agreed:** [PRD-05.R4](../../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md): a run whose branch holds commits not on the default branch ends at a pull request; the one exception is a named person's `timone cancel`.

**Did instead:** R4 gains a second exception: a named person's plain-words request on the ticket to stop the work for good, cited by the runner and checked by code. A new sub-phase, 40t, builds it. The criterion is amended in place with a dated marker.

**Why:** Replay run 5, case #115: the person had written "Stop working on this one. I will fix it by hand." and later "Fixed by hand in pull request #55, which is merged." The runner started nothing and tried to end the run, and code refused, because only a terminal command could end it. That is the terminal-only way out PRD-05.R9 was written to remove — R9 lists "stop" among the plain words that must move a run — and the run would have held its project, blocking every other ticket, until someone typed the command.

## 2026-09-29 — timone#165, verification

**Kind:** requirement amended

**Agreed:** [PRD-05.R2](../../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md) said the runner's tools are exactly seven actions: start a step, send a running step a message, stop a step, post on the ticket or the pull request, set or clear the hold, file or update a Timone issue, and end the run.

**Did instead:** The runner also has `record_approval`. It records that a named person approved the requirements or the list of pieces, and names that person's comment. R2 is amended in place with a dated marker. ADR-0060 D4 lists the same seven actions and is not changed here.

**Why:** Verification found this tool on the runner's list, and R2 did not name it. R3's third clause merges chunk zero once a named person's approval is recorded, and the record must name the comment it came from. R7's second clause asks the same of every approval. Only the runner can judge that the words of a comment are an approval. Code checks the rest: the comment exists, a named person wrote it, and it was written after the thing it approves. Without this action no approval could be recorded, and chunk zero could never be merged on a project the runner drives. The action edits no file, runs no command and pushes nothing. The one merge that can follow it, of chunk zero, is done by code, and only from the approval in the record (R3).

## 2026-09-29 — timone#165, verification

**Kind:** check not run
**Agreed:** PRD-05.R18: the replay of the recorded failures on the real model, three tries per case. With it, the runner's own choices in R1, R6, R7 and R17, and the wording check in R8.
**Did instead:** Not run. Reported BLOCKED in [phase-40-verification.md](phase-40-verification.md). The last real run on record is run 5 (18 of 19, on the build before 40t). Both verification fix loops changed the runner's actions and brief, so run 6 is owed on `55a617a` or later, from a logged-in terminal (`npm run --silent replay`), with its result on the pull request.
**Why:** The verifying sandbox has no model login (`claude auth status`: not logged in). A scripted model would test the script, not the runner.

## 2026-09-29 — timone#165, verification

**Kind:** workaround
**Agreed:** Verification observes the deliverable in its production form: steps in the box, against the real forge, with a real model.
**Did instead:** The probes ran the built daemon (`dist/`) with steps in-process, against a fake forge, a local stand-in for GitHub's token call, and a fake model service answered by each probe ([_rig.mjs](../probes/_rig.mjs)). The runner itself runs in the daemon process in both runtimes.
**Why:** A boxed step clones from the real forge, GitHub must not be touched by a verification, and every session needs a model login the sandbox does not have.

## 2026-09-29 — timone#165, execution (after verification)

**Kind:** plan step

**Agreed:** Phase 40 closed at `4cfb031` and was verified at `0f433ef`. The verification report listed nine things "found outside the verdicts" for the pull request's review.

**Did instead:** fvermaut chose "fix first". A new sub-phase, 40u, fixes items 1–5: a run refused as busy is woken when the project frees; a cancel on a runner project holds the ticket and reports its success truly; the brief finds the list of pieces under its real name; the one-turn check runs with no tools; the first brief shows no departures. Items 7 and 8 are filed as Timone issues; items 6 and 9 are the verification report's own to carry. A fresh check re-runs the probes afterwards.

**Why:** Items 1–3 would break the first real use on scratch-app: a second ticket stalls, a cancelled ticket starts again by itself, and tickets 1 to 9 lose their list of pieces. Items 4 and 5 cost a line each: a check handed a person's words must not hold a shell, and a brief that reports nine departures before anything ran misleads the runner's first choice.

## 2026-09-29 — timone#165, execution (after delivery)

**Kind:** plan step

**Agreed:** Phase 40 was delivered as pull request #173 at `865fb36`, with two code reviews listed on it for the person's judgement.

**Did instead:** fvermaut chose "fix first". Four new sub-phases, 40v–40y, fix the four Spec review findings named to him as the ones that matter most (1, 2, 3 and 6), and Standards finding 1, which makes the pull request say the same untrue thing as Spec finding 1 by a second path. The other findings stay listed on the pull request. A fresh check re-runs the probes afterwards, and the pull request is delivered again.

**Why:** Each of the four breaks a MUST of PRD-05 on a path the watched run did not reach: a run that records an approval is listed as out of order (R5); a failed run on a runner project has no way out except a terminal command (R9, R16); a closed pull request lets a run drop unmerged work (R4); a build on ivtrends holds up scratch-app's runner (R15).

## 2026-09-29 — timone#165, execution (after delivery)

**Kind:** plan step

**Agreed:** Sub-phase 40w changed `src/runner/actions.ts` and `src/runner/brief.ts` so that a pull request closed without merging does not let a run end while its branch holds work.

**Did instead:** `src/runner/tools.ts` is granted to 40w as a follow-up. The `end_run` action's description and its `stopCommentAt` field's description are brought in line with the code. The plan is amended in place.

**Why:** The runner reads those descriptions as part of its instructions. They still said a closed pull request ends the run, and offered the stop comment only for a run with no pull request. The code refuses such a call anyway, so the cost was one refused call, but the runner's instructions must not say the opposite of what the code does.

## 2026-09-29 — timone#165, execution (after replay run 6)

**Kind:** plan step

**Agreed:** PRD-05.R18: the runner chooses the table's action on each of three tries, for every case. The phase's rule since 40j: when a case fails, the runner's rules change, never the case.

**Did instead:** A new sub-phase, 40z, adds one sentence to the runner's rule on a missing key: its comment does not write the takeover command, not even to say that it will not help. The case is not changed. The replay is run once more (run 7).

**Why:** Replay run 6 passed 18 of 19. #120 passed two tries of three: one try's new comment wrote `timone takeover`, most likely to say that a terminal session cannot add the key. The case counts any comment that writes the command as the real #120 fault, on purpose, because a person who reads a command runs it.
