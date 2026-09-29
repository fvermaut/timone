# Phase 40 — Delivery Report

- **Date:** 2026-09-29
- **Phase:** [phase-40.md](../phase-40.md) — `Complete`, verified in [phase-40-verification.md](phase-40-verification.md) (first check at `0f433ef`, re-check after 40u at `a21ac5f`)
- **Branch:** `timone/165-the-runner-beside-the-current-daemon` @ `a21ac5f`
- **Base:** `main` — the project's default branch. The branch was cut from `main` at `0a905f3`, after [#163](https://github.com/fvermaut/timone/pull/163) merged the decision and the requirements. `main` has since gained `489bcdf` ([#170](https://github.com/fvermaut/timone/pull/170)); the branch merges with it without a conflict (`git merge-tree`).
- **Pull request:** opened against this report, after it was committed. GitHub lists it on ticket [#165](https://github.com/fvermaut/timone/issues/165).
- **Screen:** no user-facing screen in this phase. The phase file says `Screens changed: none`; the runner writes on tickets and pull requests, which GitHub draws. The screen check was skipped for that reason.
- **Questions for the human:** none, as the verification report says.
- **Departures:** [phase-40-departures.md](phase-40-departures.md) — 24 entries.

## Scope

The first of the two pieces in [ticket-164.md](../../breakdowns/ticket-164.md), ticket [#165](https://github.com/fvermaut/timone/issues/165): the runner, the rules code keeps around it, and scratch-app switched to it. It claims PRD-05.R1 to R19 in [the register](../../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md). R11 is in part: `timone retry` stays in the code, because ivtrends still runs on the current daemon, and refuses on a runner project. Deleting it, with R20, is [#166](https://github.com/fvermaut/timone/issues/166)'s. ivtrends and timone stay on the current daemon.

## How to try it

### Against the preview

Timone has no preview for pull requests (no `bindings.preview` in `timone.yaml`). Use the steps on your own machine.

### On a local checkout

Setup is in [README.md](../../../../README.md). Then, in `~/dev/timone/projects/timone`:

1. `git fetch && git switch timone/165-the-runner-beside-the-current-daemon && npm install && npm run build` — the build ends with no error.
2. `npx tsc --noEmit; echo "exit: $?"` — `exit: 0`.
3. `npx vitest run` — 1,950 of 1,950 tests pass, in 56 files (1,713 before this phase).
4. `npm run --silent replay -- --dry; echo "exit: $?"` — 19 of 19 cases pass, `exit: 0`. This uses a script in place of the model and costs nothing.
5. `node dist/cli.js projects list; echo "exit: $?"` — the three projects are listed and `exit: 0`: `timone.yaml`, with its new `operator: fvermaut` and scratch-app's `driver: runner`, still loads.
6. `node dist/cli.js record scratch-app#63` — the record of the second watched run. You should see four steps (preparing the work, building, checking the result, delivering), each with its times and cost; seven decisions, each with its reason, among them one message sent to the running build ("The step has run the whole test suite more than twice since the last check"); "Steps left out of the default order: None."; and "This ticket has spent $19.25 of the $150.00 it may spend". The record exists only in this checkout, where the watched run ran.
7. **Costs money, needs your logged-in terminal:** `npm run --silent replay` — the nineteen recorded failures, three tries each, on the real model. About $2.50. Expect 19 of 19. This is replay run 6, which is owed (below). Add its output to [phase-40-replay.md](phase-40-replay.md).
8. **The watched run, owed:** the steps are in [phase-40-live-gate.md](phase-40-live-gate.md) § How it runs. Stop the daemon run from `main` first; it reads scratch-app's tickets too.

## Verification outcome

Verified in [phase-40-verification.md](phase-40-verification.md): the first check ran 2 of 2 fix loops; the re-check after 40u used none and changed no verdict.

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

"BLOCKED" marks a clause that needs a real model: the checks had no model login.

### Outstanding for the human

- [ ] PRD-05.R18 — replay run 6 owed, on `044231f` or later: step 7 above, from your terminal. The runner's own choices in R1, R6, R7 and R17, and the wording check in R8, rest on it too.
- [ ] PRD-05.R9, R12, R13, R15 — live gate owed, on `044231f` or later: run it as [phase-40-live-gate.md](phase-40-live-gate.md) § How it runs says, and commit its report, before merging. Not yet seen: a change asked for on the pull request (R9), a step failing or silent past its limit (R12), the runner stopping a step (R13), and two tickets on one project (R15). The four blocks have no `Last live gate:` line yet; the gate adds them.
- [ ] PRD-05.R2 — the register was amended during the first check: the runner has an eighth action, `record_approval`. It needs your yes. ADR-0060 D4 still lists seven.
- [ ] PRD-05.R8 — read narrowly: at the limit, the reply is read by a one-turn check with no tools and no actions. Confirm that reading.
- [ ] PRD-05.R4 and R12 — amended during the build (R4: a named person's plain-words stop also ends a run with no pull request; R12: a running step's cost is known only when it ends). Both are in the departures.

## Standards review — phase 40

- **Read:** the diff `origin/main...a21ac5f` for the non-process files, and the current content of those files at a21ac5f. Also `/Users/fvermaut/dev/timone/standards/code-smells.md`, `/Users/fvermaut/dev/timone/standards/README.md`, `/Users/fvermaut/dev/timone/standards/typescript.md` (Approved 2026-07-19), `/Users/fvermaut/dev/timone/standards/testing.md` (Approved 2026-07-24), `/Users/fvermaut/dev/timone/projects/timone/tsconfig.json` and `/Users/fvermaut/dev/timone/projects/timone/package.json`. To check import cycles I read the merge base's `src/` (0a905f3), unpacked into scratch. I did not read `project-structure.md`: its rules are for Next.js app folders, and Timone is a Node CLI. (Findings 1–11 were written first, against `code-smells.md`; the brief had wrongly said `typescript.md` and `testing.md` were not approved. Findings 12–16 were added after those two entries were read.)
- **Diff:** `origin/main...a21ac5f` — 72 files, +18304/−471
- **Findings:** 16

### 1. A run record that cannot be read is treated as an empty one, and the pull request is then told the default order was followed — error handling that hides a fault

- **Where:** `src/runner/driver.ts:896–900`, with `src/runner/departures.ts:164–167`. Also `src/runner/actions.ts:549–583`.
- **What:** `afterStep` does `const entries = read.ok ? read.value : [];` and then calls `rewriteDepartures(runId, entries)`. With no entries, `departuresOf` returns `[]` and `departureSection([])` writes "The default order was followed." That text replaces the block in the pull request description, including an honest list written after an earlier step. In `actions.ts`, `recordedApprovalOfPieces` returns `undefined` when the read fails. `closeChunkZero` then records the reason "the run record holds no approval of the list of pieces for this run", which is not what happened.
- **Why it matters:** This is error handling that hides a fault. It also goes against `record.ts`'s own rule: "A bad line fails the whole read … skipping a line would quietly drop a cost or hide a step". The departures list is one of the checks that rule protects.
- **Suggested remediation:** When the read fails, skip the description rewrite and log it, as `endInterruptedSteps` already does. In `closeChunkZero`, keep "could not read" apart from "no approval". — not applied here

### 2. Two new runtime import cycles, where the merge base had none — hidden coupling (inappropriate intimacy)

- **Where:** `src/daemon/cta.ts:21` → `src/runner/session.ts:23–28` → `src/runner/actions.ts:32` → `src/daemon/poll.ts:62–66` → `cta.ts`. And `src/daemon/session.ts` ↔ `src/daemon/step-session.ts:4–14` and ↔ `src/daemon/chunk-zero.ts:13–15`.
- **What:** `cta.ts`, described as pure, imports `RUNNER_DEFAULT_WAIT` from `runner/session.ts`. `runner/actions.ts` imports `closeInitiativeIfDone` from the 3400-line `poll.ts`. Both new daemon modules import `waitOf`, `failedComment` and `mergeMessage` back from `session.ts`. Each has a comment saying this is "safe only because nothing here reads these names while the modules load". I checked non-type imports with a script: two cycles now, none at 0a905f3.
- **Why it matters:** Inappropriate intimacy: modules import each other's internals. The code stays correct only while nobody uses one of these names at load time, and no tool checks that.
- **Suggested remediation:** Move `RUNNER_DEFAULT_WAIT` to `runs.ts`, beside `CARRY_ON_WAIT`. Give `closeInitiativeIfDone` its own small module, as was done for `chunk-zero.ts`. Move `waitOf`, `failedComment` and `mergeMessage` into a module that imports nothing back. — not applied here

### 3. `driver.ts` keeps its own copies of limit and wait logic from `actions.ts` and `session.ts` — duplicated code

- **Where:** `src/runner/driver.ts:142`, `316–323`, `573–601` and `609–619`; `src/runner/actions.ts:320`, `336–343` and `469–491`; `src/runner/session.ts:148–157`.
- **What:** `const LIMIT_NOTICE = "limit"` is defined twice, and the driver's comment says it must be "the word the runner's actions write". `toldOfLimit` is the same function in both files. The limit-notice block appears twice: compute spent and allowance, find the order, post `limitNotice`, write `limit-reached` and `notice`. `parkForRunner` in the driver and `putOnRunnersWait` in the session are the same function, apart from one optional argument.
- **Why it matters:** This is duplicated code. The two copies are only kept in step by comments. If one side changes the notice word, the ticket is told about its limit twice.
- **Suggested remediation:** Put one `noticeLimitOnce(...)` and one `parkOnRunnersWait(...)` in a shared runner module, and call it from both places. — not applied here

### 4. The same record queries are written out again in four files — duplicated code / feature envy

- **Where:** "this run's entries": `order.ts:176`, `departures.ts:116`, `brief.ts:237–239`, `actions.ts:254` and `355`. "the run left this step out": `order.ts:190–191`, `actions.ts:259–260`, `277`, `358–360`, `departures.ts:131`. "told since the last reset": `actions.ts:336`, `driver.ts:316`, `session.ts:891`.
- **What:** Each one is written out inline, for example `entries.filter((entry) => "runId" in entry && entry.runId === runId)` and `entry.kind === "departure" && entry.skipped.includes(step.id)`.
- **Why it matters:** This is duplicated code, far past the rule of three. The functions reach into `RecordEntry[]` to compute things the record module could answer itself (feature envy). The standard counts a repeated one-liner as a duplicated decision.
- **Suggested remediation:** Add `entriesOfRun`, `departedFrom(step)` and similar named queries to `runner/record.ts`, and use them everywhere. — not applied here

### 5. "Is this project driven by the runner" and other runner decisions are restated instead of named once — shotgun surgery

- **Where:** `drivenByRunner` is defined twice, in `src/daemon/poll.ts:1158–1161` and `src/commands/takeover.ts:1030–1033`. It is restated inline in `retry.ts:213`, `cancel.ts:78` and `304`, and `status.ts:213`. "Project not in the manifest, so throw" appears in `actions.ts:327–333`, `session.ts:205–210` and `driver.ts:837–843`. `run.wait?.kind === "escalation" || run.wait?.kind === "runner"` appears at `takeover.ts:255`, `718` and `933`. The approval union `"requirements" | "pieces"` appears in `order.ts:35`, `record.ts:108`, `tools.ts:104–106` and `prompts.ts:881`, and the compiler does not link these copies.
- **What:** Each is one line. Each was added separately in each file.
- **Why it matters:** This is shotgun surgery and a duplicated decision. A third driver, or a third kind of approval, would mean hunting for every copy.
- **Suggested remediation:** Export `drivenByRunner(manifest, project)` and a lookup that throws from `manifest.ts`. Name the takeover test once, for example `opensWithoutStage(wait)`. Derive the zod enums and the prompt's type from one `APPROVALS` constant. — not applied here

### 6. `TicketContext.isRemediation` is never set to true — dead code

- **Where:** `src/runner/order.ts:209–212` and `238`; `src/runner/driver.ts:221` and `388`.
- **What:** Every production caller builds `{ isStep: …, isRemediation: false }`. Only `order.test.ts` passes `true`. So in production `ticketKindOf` can never return `"remediation"`, and the remediation order in `defaultOrder` is never used. The comment on `TicketContext` says "the caller, which knows where the run came from, says so", but no caller does.
- **Why it matters:** This is dead code: a flag never set to its other value. `tsc` cannot see it.
- **Suggested remediation:** Wire the flag from where a run answers a review, or remove the flag and the remediation branch until something needs them. — not applied here

### 7. `runnerActions` is one function of about 700 lines — long function / large module

- **Where:** `src/runner/actions.ts:380–1079`. The `startStep` body is at `703–813`. The `endRun` body is at `983–1077`.
- **What:** A single factory holds more than ten inner helpers and the nine action bodies. `endRun` has a long bold comment in front of each section. The file also holds the running-steps registry, the skip calculation, the wording tables, the limit refusal, chunk-zero closing and map closing.
- **Why it matters:** Long function: a body with a comment introducing each section is the signal the standard names. Large module: these parts share no single reason to change.
- **Suggested remediation:** Split out the rule checks (`skippedBy`, limit, approval timing) and the chunk-zero and map closing into their own modules. Make each action a named function that takes a small context. — not applied here

### 8. The "required approval" guard on `mergeChunkZero` is an unused parameter, and it is already bypassed — speculative generality / middle man

- **Where:** `src/daemon/chunk-zero.ts:82–89` and `117–140`; `src/daemon/session.ts:2281–2300`; `src/daemon/session.test.ts:4993–5000` (and the two cases after it).
- **What:** The parameter is `_approval: ChunkZeroApproval // Required and not read`, and the comment says "the check is the compiler's". `attemptMerge` is exported with no approval, "only for the spawner's delegator … nothing else may call it". The spawner keeps two private methods that only pass calls on, "because `session.test.ts` reaches these two private methods by name". Those tests call `mergeChunkZero(run, project)` with two arguments, through `as unknown as`, so the compiler check never runs there.
- **Why it matters:** Speculative generality: a parameter and an export that exist for one purpose, the tests. Middle man: methods that only pass the call on. The guard the comment promises is not really there.
- **Suggested remediation:** Point those tests at `chunk-zero.ts` directly and delete the pass-through methods. Stop exporting `attemptMerge`. Either use the approval, for example in the merge message, or say plainly that it is only a marker. — not applied here

### 9. The brief's list of departures is a copy of the pull request's list, and the copy has already drifted — duplicated code / comment as deodorant

- **Where:** `src/runner/brief.ts:261–285`; `src/runner/departures.ts:232–258`; `src/commands/record.ts:194–201`.
- **What:** `departedHow` is `whatHappened` word for word. The "No reason given." / "Reason: …" text is written three times. The brief's comment says "the runner sees the list a person will read". The pull request's version groups steps that share a reason and puts "**Not checked.**" first; the brief's version does neither.
- **Why it matters:** Duplicated code, with the rule of three passed for the reason text. The comment says the two lists are the same when they are not.
- **Suggested remediation:** Have the brief call `departureSection`, or export shared line builders from `departures.ts` and fix the comment. — not applied here

### 10. Small helpers are copied into each new file — duplicated code / inconsistent vocabulary

- **Where:** `oneLine(error)` is new in `runner/actions.ts:374`, `runner/session.ts:630`, `runner/driver.ts:276`, `runner/replay/recording.ts:579`, `daemon/chunk-zero.ts:278` and `daemon/step-session.ts:204`, and inline in `commands/cancel.ts:89–90`. Five copies already existed. `capitalised` is in `departures.ts:245`, `actions.ts:369` and `commands/record.ts:266`. `usd` is in `comments.ts:110`, `brief.ts:457` and `commands/record.ts:261`, and inline in `actions.ts:495` and `status.ts:228`. The record path is built in `runner/record.ts:143–145` and again by hand in `commands/record.ts:53`.
- **What:** Identical bodies. Two of the `oneLine` copies drop the `?? message` fallback. `brief.ts:452` defines another `oneLine` that takes a string and strips a full stop: same name, different job.
- **Why it matters:** Duplicated code, plus inconsistent vocabulary: one name used for two different jobs.
- **Suggested remediation:** Add one small text-helpers module (`firstLineOf(error)`, `capitalised`, `usd`) and export the record path from `runner/record.ts`. Rename the brief's helper. — not applied here

### 11. Stopping a step logs "cancelled", including when the runner stopped it — misleading message

- **Where:** `src/daemon/step-session.ts:66–76` and `194`; `src/runner/actions.ts:828–837`.
- **What:** `stopSession` logs `stop <run> — cancelled, so its session is being ended`, and the doc comment says "because the run was cancelled". The diff moved this into `StepSession` "because the runner stops sessions too", and `stop_step` now uses it on runs that were not cancelled.
- **Why it matters:** Uncommunicative name: the daemon log reports a cancellation that did not happen.
- **Suggested remediation:** Let the caller give the reason, or use a neutral line such as "its session is being ended". — not applied here

Earlier findings that also break one of `typescript.md` or `testing.md`:

- Finding 5 also breaks typescript.md, *Boundaries*: "never a hand-written twin". `Approval` in `order.ts:35` is written by hand beside the `z.enum` in `record.ts:108`.
- Finding 6 also breaks typescript.md, *Type design*: "States are discriminated unions, never flag combinations". `TicketContext` is two booleans, and a precedence rule decides what they mean together.
- Finding 8 also breaks testing.md, *What a good test is*: "public interface of a declared seam, never internal wiring". `session.test.ts` reaches the spawner's private methods through `as unknown as`.

### 12. How a step ended is stored as a flag plus optional fields, and `stoppedBy` is a free string — type design

- **Rule:** typescript.md, *Type design*: "States are discriminated unions, never flag combinations. Tag with a literal `kind`/`status` field, not `isLoading` + `error?` + `data?`."
- **Where:** `src/runner/record.ts:80–90` (`step-ended`) and `52–60` (`runner-ended`); `src/runner/actions.ts:194`; `src/runner/driver.ts:188` and `196–215`; `src/commands/record.ts:118–122`.
- **What:** A step's end is `ok: z.boolean()`, `error: z.string().optional()` and `stoppedBy: z.string().optional()`. The schema allows `ok: true` together with `stoppedBy: "runner"`. `stoppedBy` has two meaningful values: `STOPPED_BY_RUNNER = "runner"`, defined in `actions.ts`, and `STOPPED_BY_DAEMON = "daemon"`, defined privately in `driver.ts`. Each reader decides the order of checks for itself: `stepEndedEvent` and `commands/record.ts` look at `stoppedBy` first, while `standingOf` and `recordApproval` look only at `ok`.
- **Why it matters:** This record is a lasting file (`.timone/records/*.jsonl`). A flag-shaped entry is cheap to fix before merge and costly once records exist. A tagged union would make the compiler check every reader.
- **Suggested remediation:** Use `outcome: { kind: "succeeded" } | { kind: "failed"; error } | { kind: "stopped"; by: "runner" | "daemon" }`, or at least `stoppedBy: z.enum(["runner", "daemon"])` with its values defined in `record.ts`. — not applied here

### 13. Types written by hand beside the zod schemas they copy — boundaries

- **Rule:** typescript.md, *Boundaries*: "The schema is the type: derive with `z.infer<typeof Schema>`, never a hand-written twin interface."
- **Where:** `src/daemon/runs.ts:221` and `753`; `src/daemon/pipeline.ts:655`; `src/runner/driver.ts:196–201`.
- **What:** The diff adds `"runner"` in two separate places: to the `runSchema` wait-kind `z.enum([...])` and to the hand-written `ParkOptions.kind` union. `resolvableBy` gets a third spelling, `WaitKind | "runner" | undefined`. In the driver, `StepEnding { ok; error?; stoppedBy? }` is a hand-written copy of three fields of the `step-ended` schema entry.
- **Why it matters:** Each new wait kind or record field has to be added in several places, and nothing links the copies.
- **Suggested remediation:** Derive `ParkOptions["kind"]` from the run schema, for example `NonNullable<Run["wait"]>["kind"]`. Derive `StepEnding` as `Pick<Extract<RecordEntry, { kind: "step-ended" }>, "ok" | "error" | "stoppedBy">`. — not applied here

### 14. The SDK's message content is read with `as` casts instead of a schema — boundaries

- **Rule:** typescript.md, *Boundaries*: "All external data … enters as `unknown` and passes through a zod schema … `as` is banned as a parsing tool". *Traps*: "`as` is legitimate in exactly three places".
- **Where:** `src/daemon/progress.ts:272–287` (`toolUseNames`).
- **What:** `(block as { type?: unknown }).type === "tool_use"`, then `typeof (block as { name?: unknown }).name === "string"`, then `const { name, input } = block as { name: string; input?: unknown };`. The comment says the content "arrived as text" from the box. It copies the older `toolResultIds` beside it. The runner's own session does this correctly, with zod schemas for the same SDK messages (`src/runner/session.ts:405–437`).
- **Why it matters:** These are the diff's own new lines, and they use a pattern the approved entry bans. The same diff shows the right way elsewhere.
- **Suggested remediation:** Use one small zod schema for a `tool_use` block, and `safeParse` each block. — not applied here

### 15. The driver turns a result into a throw, and the loop above catches it — errors and results

- **Rule:** typescript.md, *Errors and results*: "Expected failures return, bugs throw … `throw` is for programmer errors and unrecoverable states, caught only at process/request boundaries — never woven through business logic."
- **Where:** `src/runner/driver.ts:417–418`, caught at `389–393`.
- **What:** `readRecord` returns `{ ok: false, error }` for a broken record, which is an expected failure. `look` turns it into `throw new Error(read.error.message)`, and `tick` catches it and turns it back into an error line.
- **Why it matters:** An expected failure goes through a throw and a catch inside business logic. The same `catch` also swallows real bugs from `look`, so the two cannot be told apart.
- **Suggested remediation:** Have `look` return the error line, or push it onto `errors` directly, and keep the `catch` for real faults. — not applied here

### 16. A test waits with a bare 20 ms sleep before checking that nothing happened — flake posture

- **Rule:** testing.md, *Flake posture*: "Never use bare sleeps to wait for asynchronous responses".
- **Where:** `src/runner/session.test.ts:421`.
- **What:** `await new Promise((resolve) => setTimeout(resolve, 20)); expect(runner.started).toHaveLength(1);`. The same file uses `vi.useFakeTimers()` and `vi.waitFor` elsewhere.
- **Why it matters:** The check depends on real time. On a slow machine a wrongly started second wake could come after the 20 ms, and the test would still pass.
- **Suggested remediation:** Drop the sleep and rely on the later checks (`runner.at.most` is 1, and the woke entries). Or drain pending promises with fake timers before asserting. — not applied here

## Spec review — phase 40

- **Read:** `doc/specs/prd/prd-05-a-runner-decides-each-step.md`; `doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md` (at a21ac5f, plus its own diff: the diff marks R2, R3, R4, R5, R10 and R19 `verified`, and changes three criteria: R2's tool list gains "record an approval" (at verification), R4 gains a clause letting a named person's "stop" end a run (at build, 40t), and R12's summary drops "the cost" for "the output so far" (at planning)); `doc/plans/phases/phase-40.md` from the top through the end of "## Requirements"; the non-process diff `origin/main...a21ac5f`. I also ran one throwaway script, kept in the scratchpad, against `departuresOf` to confirm finding 1.
- **Diff:** `origin/main...a21ac5f` — 72 files, +18304/−471
- **Findings:** 10

### 1. After a recorded approval of the requirements, the run shows as having left the default order — PRD-05.R5

- **Where:** `src/runner/actions.ts:911–959`, `src/runner/departures.ts:116–151`
- **What:** `recordApproval` first writes the `approval` entry, then starts the session that writes the approval into the file. That session is recorded as a `step-started` at stage `requirements` (`watchStep(stage, …)` with `stage = APPROVED_STAGE[what]`). `departuresOf` sees a step with a lower index start after a step with a higher one, and marks it `late`. I ran a feature run that followed the order exactly: triage, clarification, requirements, approval, breakdown, approval, planning, build, check, delivery. The output was `[["out-of-order","requirements"],["out-of-order","breakdown"]]`, and the section said "Writing down what it needs and working out the pieces: ran out of order. No reason given."
- **Why it matters:** R5 clause 3 says a run with no departures shows "the default order was followed". That cannot hold for a run that recorded an approval. The same false line reaches the brief on every later wake ("Departures so far…"), so the runner is told it left the order without a reason. It also reaches the pull request of a one-piece initiative, where the requirements were approved and the approval of the list of pieces was skipped.
- **Suggested remediation:** keep the approval-writing session out of the order count. Tag its `step-started` entry (for example `purpose: "approval-record"`) and skip it in `stepIndexOf`, `skippedBy` and `stepState`. Add a `departuresOf` test for a feature run with both approvals recorded. — not applied here

### 2. A failed run on a runner project is a dead end, and every message points the wrong way — PRD-05.R9, PRD-05.R11, PRD-05.R16

- **Where:** `src/runner/driver.ts:273` and `386–387`; `src/commands/retry.ts:202–203`; `src/daemon/chunk-zero.ts:106–113`; `src/runner/actions.ts:586–590`; `src/daemon/session.ts:638–639`; `src/daemon/runs.ts:1001–1003`
- **What:** On a runner project, `mergeChunkZero` and `openStepTickets` can still call `store.fail`. The driver looks only at `UNSETTLED = ["picked-up","active","parked"]`, so nothing wakes the runner on a `failed` run. `register` treats a failed run as live, so no new run opens either. `timone retry` refuses and says "Write on the ticket instead". The ticket gets `failedComment`, which says "the standing note below has the command". Runner projects have no standing note, and that command refuses.
- **Why it matters:** R9 clause 1 says a named person's comment on a run "of any kind, in any state" wakes the runner. R11 sends the person to the ticket, where nothing answers. The only ways out are `timone cancel` or `timone takeover`, which is the kind of terminal-only repair the PRD's first goal and R16 clause 3 rule out.
- **Suggested remediation:** on runner projects, do not fail the run. Park it on the runner's wait with the merge failure as an event (as `reclaimed` does). Or add `failed` to what the driver wakes on. Give runner projects a failure comment that does not point at a standing note. — not applied here

### 3. One project's work still holds up the others while any project stays on the daemon — PRD-05.R15

- **Where:** `src/daemon/poll.ts:766–779` and `1772`; `src/daemon/session.ts:2463–2473`
- **What:** The poll loop still runs `await pollProject(...)` one project after another. For a daemon project, `pollProject` awaits `spawner.spawn`, and `watch` awaits `session.completed` for the whole session. The runner path returns at once (`poll.ts:1718`), but the loop only reaches it after the daemon project's session ends. `timone.yaml` puts scratch-app on the runner and leaves ivtrends and timone on the daemon.
- **Why it matters:** R15 clause 1 says: given a step running on one project, a named person's comment on another project wakes "that project's runner within one polling cycle, and does not wait for the first project's step to end". In the mixed setup R19 creates, a build on ivtrends delays scratch-app's runner by the length of that build. This is #148 again.
- **Suggested remediation:** stop awaiting the daemon's own sessions inside the cycle (track them as the runner's `pending` set does). Or poll runner projects on their own loop. Add a test with one daemon project mid-session and one runner project. — not applied here

### 4. The spending count leaves out real sessions, and the record leaves out some reasons — PRD-05.R8, PRD-05.R14

- **Where:** `src/runner/actions.ts:664–677`; `src/daemon/container-runtime.ts` (the `stop` path, `destroy`); `src/runner/driver.ts:628–646` and `770–779`; `src/runner/session.ts:243–264`
- **What:** `step-ended` records `costUsd: summary?.costUsd ?? 0`. The summary comes only from the CLI's final `result` message. A step the runner stops (`docker rm -f`), a step cut off by `timone cancel`, and a step lost when the daemon stops all record $0. Separately, at the limit, `askToGoOn` calls `consult` once for each named person's reply. That is a model session started over the limit, and its cost is never written anywhere. The record has no reason at all for a wake where the runner decides to do nothing: only `woke` and `runner-ended` are written, and the runner's final text (`result.result`) is dropped.
- **Why it matters:** R8 clause 1 counts every session "the runner's own sessions included", and its Falsified-by fails if "any session starts" at the limit. A runner that stops a costly step, which is the #110 case of R13, gets that spend back for free. R14 clause 2 says the record holds "every step … with its cost" and "every decision of the runner and its reason".
- **Suggested remediation:** when there is no `result`, estimate a stopped step's cost from the token counts `SessionProgress` already has, and mark it as an estimate. Record the consult's cost, or check the limit before asking. Write the runner's closing text as a `decision` entry when the wake made no call. — not applied here

### 5. The daemon's merge and approval path still accepts anyone's comment — PRD-05.R3, PRD-05.R7

- **Where:** `src/daemon/session.ts:2231–2237`; `src/daemon/chunk-zero.ts:82–89`; `src/daemon/gates.ts:56` (not changed by the diff)
- **What:** `mergeChunkZero` now needs an approval argument, but it is "required and not read". The daemon path builds that argument from `readGateDecision`, which skips only `fromTimone` comments. `namedPeople` and `isNamedPerson` are used only under `src/runner/`.
- **Why it matters:** R7's Falsified-by asks "every path that writes an approval" to refuse without a named person's comment. R3's goal ("nothing reaches a default branch without a yes from a named person", which outranks the others) is written for any project. ivtrends and timone (a public repository) are still daemon projects, and there anyone who is not Timone can approve chunk zero into the default branch. The R10 criteria are runner-only, so this may be out of scope. If so, the register should say so.
- **Suggested remediation:** filter gate replies by `namedPeople` on the daemon path too. Or narrow R3 and R7 to runner projects in the register until #166. — not applied here

### 6. A closed, unmerged pull request lets a run with unmerged work end — PRD-05.R4

- **Where:** `src/runner/actions.ts:1011–1042`
- **What:** The refusal applies only when `ahead > 0 && found === undefined`. When the branch's pull request was closed without merging, `found` is defined, so `end_run` ends the run with no named person's comment, even though the branch is ahead.
- **Why it matters:** R4 clause 1 says code refuses when the branch has commits not on the default branch and there is "no open pull request". Its Falsified-by counts commits "not in an open pull request". The amended clause 3 allows an end with no pull request only after a named person's comment asking to stop.
- **Suggested remediation:** refuse on `found?.state === "closed"` as for no pull request, unless `stopCommentAt` is given. Or amend R4 to allow a closed pull request, since closing it may count as a person's no. — not applied here

### 7. The 15-minute summary and the silence wake are only partly built — PRD-05.R12

- **Where:** `src/runner/brief.ts:405–420`; `src/runner/session.ts:606–627`; `src/runner/driver.ts:548–557`
- **What:** The running-step section shows the tool calls, the start time, when the step last wrote, and a token count. It shows none of the step's text output. The driver wakes a running step only on the fixed 15-minute check. No step has a silence limit, and crossing one wakes nothing. Silence is shown only as `silentSince` at the next check.
- **Why it matters:** clause 2 (as amended) asks for "the commands … the time taken, and the output so far". A token count is not the output: the runner cannot see a failing test or a question the step printed. Clause 1 lists "a step is silent for longer than its limit" as its own wake event, within one polling cycle.
- **Suggested remediation:** keep the last few lines of the step's assistant text in `SessionProgress` and show them, capped to one page. Define a silence limit per step, and have `look` raise a silence event when it is passed. — not applied here

### 8. Retries and the events behind them are lost if the daemon restarts — PRD-05.R16, PRD-05.R9

- **Where:** `src/runner/driver.ts:656–675` and `688–715`; `src/runner/session.ts:777–783`
- **What:** `newComments` writes the `seen` marks, and `deliver` writes the notices, before the wake runs. The wake's retries and the 15-minute timer live only in memory (`RunWakes.later`). If the daemon restarts during an outage, the next daemon finds nothing new and never wakes the run. A new ticket whose first wake failed is already parked, and because a `woke` entry was written, it also loses `NEW_TICKET_EVENT`.
- **Why it matters:** R16 clause 2 says code "keeps trying every 15 minutes". R9 clause 1 says a named person's comment makes the runner act or answer. After a restart, both the tries and the comment are dropped with no notice, and the ticket waits until someone writes again.
- **Suggested remediation:** mark events as read only after a wake that ran to its end (`runner-ended ok`). Or, on start-up, wake any runner run whose last `runner-ended` failed. — not applied here

### 9. Nothing makes the replay run when the runner's instructions change, and one case checks less than the table asks — PRD-05.R18

- **Where:** `.github/workflows/tests.yml` (unchanged); `.claude/skills/timone-deliver/SKILL.md`; `src/runner/replay/cases.ts:2521–2526`
- **What:** No workflow, skill step or check runs `npm run replay` and puts the result on the pull request when `brief.ts` `SYSTEM` or the tool descriptions change. The ivtrends#1 case accepts an immediate restart of the step. Its own comment says "the runner has no tool that waits", and the driver wakes the runner at once when a step ends.
- **Why it matters:** clause 2 needs "the replay set is run, and its result is on the pull request" for any change to the runner's instructions. The table row for ivtrends#1 asks to "start it again after a wait". Neither the code nor the case gives that wait.
- **Suggested remediation:** add a delivery rule, or a CI check that fails when the runner's instruction files changed and no replay result is attached. Either add a wait before the runner is woken after a failure that looks like a model-service error, or change the table row. — not applied here

### 10. Behaviour no requirement asked for — scope, bears on PRD-05.R11

- **Where:** `src/commands/cancel.ts:72–97` and `300–312`; `src/daemon/poll.ts:1005–1014` and `1590–1620`; `src/daemon/consult.ts:61–71`
- **What:** On a runner project, `timone cancel` now puts the hold label on the ticket, and the poll has a new "held since listing" check. Before, a cancelled ticket was simply picked up again. The ask check's `consult` now runs with `tools: []` and `settingSources: []`, which also changes the daemon path used by every project.
- **Why it matters:** R11 clause 1 asks only that the run stops, its session stops, and the project is free. Holding the ticket changes what a person must do afterwards (take the label off), and no requirement or amended criterion records it. The consult change looks like a needed safety fix, but it sits outside PRD-05.
- **Suggested remediation:** record the hold-on-cancel as a criterion (R11) or as a decision the operator approves. List the consult fix separately on the pull request, or split it into its own issue. — not applied here

## Notes

- **The two reviews ran as separate sessions,** each with its own read list; neither read the other, or the verification report. The Standards review ran in two passes: the first brief wrongly said `typescript.md` and `testing.md` were not approved, so findings 12–16 were added once they were read.
- **Steps ran in-process in both checks,** not in the box, and against a fake forge and a fake model. The runner itself runs inside the daemon in both runtimes. The watched runs used the box and the real forge.
- **Found by the checks, not fixed here:** a cancel writes nothing on the ticket, only the `timone:held` label; the takeover session's instructions are still the old ones on a runner project ([#171](https://github.com/fvermaut/timone/issues/171)); comments are told apart by their time alone ([#172](https://github.com/fvermaut/timone/issues/172)).
- **Known limits, from the completion report:** three import cycles in `src/daemon/` and `src/runner/`, safe because no module reads another's names while loading; `attemptMerge` in `src/daemon/chunk-zero.ts` stays exported and takes no approval, for the spawner's tests, and nothing in the runner calls it; a ticket's own text reaches the runner whoever wrote it; one wake right after a daemon restart can still show a step ticket as held; the whole-suite rule at a 15-minute check counts a first baseline run; `timone record` does not say a run stopped by a person's comment was cancelled; a comment in `src/runner/driver.ts` still describes the hold as a way to wait.
- **Test leftovers on scratch-app:** pull request #61, ticket #60 (held), and map #62. They are closed only on the operator's word.
- **Next:** #166 deletes the current daemon's fixed order and `timone retry`, once ivtrends has moved.

## Delivered again — 2026-09-29, iteration 2

- **Branch:** `timone/165-the-runner-beside-the-current-daemon` @ `adde9f4`
- **Pull request:** [#173](https://github.com/fvermaut/timone/pull/173), the same one. Its description is refreshed.
- **Departures:** [phase-40-departures.md](phase-40-departures.md) — 26 entries now. The two new ones are the four fixes, and one file added to the second fix.

### What changed since the first delivery

The first delivery was at `865fb36`. fvermaut chose to fix the worst review findings before merging. Four sub-phases fixed them, each built test first by a session that saw only its part of the plan:

- **40v** (`320a331`) — the session that records an approval no longer makes the pull request say a step "ran out of order" (Spec finding 1). A record that cannot be read no longer makes it say "The default order was followed." (Standards finding 1).
- **40w** (`68b08b9`, `3dee1dc`) — a pull request closed without merging no longer lets a run end while its branch holds work. It ends on a merge, or on a named person's stop on the ticket (Spec finding 6). The `end_run` description was brought in line (plan amended, `c319cd1`).
- **40x** (`dd7e5c9`) — on a runner project, a failed merge of the list of pieces, or step tickets that do not open, no longer fail the run. The run waits, one plain comment is posted, and the runner is woken (Spec finding 2).
- **40y** (`47f1332`) — the runner's projects are polled first, and on a clock of their own while a current-daemon project's session runs (Spec finding 3).

Plan amendments: `40690aa`, `c319cd1`. Completion report updated: `f94081f`. Checks after the fixes: `npx tsc --noEmit` exit 0; `npx vitest run` 1,977 of 1,977 in 57 files; `npm run --silent replay -- --dry` 19 of 19.

**The code changed, so both reviews were run again,** each in a fresh session, each reading only its own earlier findings. Standards: 22 findings stand — the 16 earlier ones (4 of them changed) and 6 new. Spec: 9 stand — of the 10 earlier ones, 2 are gone (2 and 6), 2 changed (1 and 3), 6 stand, and there are 2 new.

### Verification outcome after the fixes

A third check ran after 40y, at `f94081f`, by a session that watched none of the building ([phase-40-verification.md](phase-40-verification.md) § Re-check after 40y, commit `adde9f4`). All 16 probes pass, each proven able to fail. It added one label to the R4 probe (a pull request closed without merging) and one to the R5 probe (a feature with both approvals recorded). Each of the four fixes behaves differently on the build before it and on the current build. For example, a runner project's comment was acted on 2.1 seconds after it was written while a current-daemon step ran, against 87.3 seconds before. No verdict changed, and the register did not change. The verdict table above stands.

### Outstanding for the human, now

- [ ] PRD-05.R18 — replay run 6 owed, now on `47f1332` or later: 40w changed the runner's rules again. The runner's own choices in R1, R6, R7 and R17, and the wording check in R8, rest on it too.
- [ ] PRD-05.R9, R12, R13, R15 — live gate owed, on `f94081f` or later, as [phase-40-live-gate.md](phase-40-live-gate.md) § How it runs says. For R15 it should include two tickets on one project, and a comment on scratch-app while an ivtrends step runs. **R15's hint measures the `observedAt` stamp, which still stands still while a current-daemon step runs.** Time the runner's wake instead, or the check will call R15 failed when it is not. Both the Spec review (finding 12) and the check found this.
- [ ] PRD-05.R2 — the eighth action, `record_approval`, needs your yes.
- [ ] PRD-05.R8 — the narrow reading (a one-turn check with no tools reads your reply at the limit) needs your confirmation.
- [ ] PRD-05.R4 and R12 — the amendments made during the build, in the departures.

### Worth knowing before you merge

- **After a failed merge of the list of pieces, trying again needs a second approval** (Spec finding 11). The run no longer fails, but the runner cannot name the first approval again, so it has to ask you to approve the same list once more.
- **`timone takeover` on a runner project still waits for a current-daemon step to end** (Spec finding 12). Only a comment gets through at once.
- **A plain "stop for good" that leaves the ticket open is taken up again as a new run a second later,** unless the runner puts the hold on it, as its rules tell it to. A cancel holds the ticket by itself (the check, found outside the verdicts, item 1).
- **When the run record cannot be read, nothing on the ticket or the pull request says so,** and the daemon logs the same error every cycle (the check, item 3).
- When the step tickets cannot be opened, the comment quotes the failed `gh` command, and the runner's event line reads badly (the check, item 2).
- When a session that records an approval ends, the runner is told "The step writing down what it needs ended" (40v's handoff; Spec finding 1, what is left).
- A session run by hand that marks itself as a step with `timone stage` from a project's copy writes the mark where the guard never reads it. Filed as [timone#174](https://github.com/fvermaut/timone/issues/174).

### Standards review — phase 40 (second delivery)

- **Read:** the diff `origin/main...f94081f` for the non-process files, and the fixes diff `a21ac5f...f94081f`. The current content of the files involved: `src/runner/{actions,driver,record,brief,departures,order,comments,tools,session,session.test}.ts`, `src/daemon/{poll,chunk-zero,chunk-zero.test,session,session.test,step-session,progress,runs,pipeline,cta}.ts`, `src/commands/{record,takeover,cancel,status,retry}.ts` (the last three by grep only). Also `/Users/fvermaut/dev/timone/standards/code-smells.md`, `typescript.md`, `testing.md` and `README.md`, the project's `tsconfig.json` and `package.json` scripts, and my previous review. I re-ran the import-cycle check with a scratch script.
- **Diff:** `origin/main...f94081f` — 73 files, +19634/−474
- **Findings:** 22 (all 16 earlier findings are carried, 4 of them changed, plus 6 new)

#### Earlier findings

- 1. changed — The driver part is fixed: an unread record no longer rewrites the description (`driver.ts:941–989`). The `actions.ts` part still stands: in `actions.ts:594–605` and `633–642`, a failed read still turns into "the run record holds no approval of the list of pieces". Also `driver.ts:951` and `957` still pass `entries ?? []`. So after a failed read, the runner is not told of a pieces failure, and the log line only mentions the departures.
- 2. still stands — I re-ran the check and found the same two runtime cycles. The first: `cta.ts:21` → `runner/session.ts` → `runner/actions.ts:33` → `daemon/poll.ts` → `cta.ts`. The second: `daemon/session.ts:74–81` ↔ `step-session.ts:4–14` and ↔ `chunk-zero.ts:13–15`.
- 3. still stands — `driver.ts:147`, `330–337`, `610–637` and `645–654`; `actions.ts:324`, `340–346` and `514–536`; `session.ts:148–157`.
- 4. changed (smaller) — 40v added one named query, `startsAStep` (`record.ts:159–163`), and uses it in five places. Two other queries are still written out inline. "This run's entries" is at `actions.ts:258` and `400`, `departures.ts:118`, `order.ts:178` and `brief.ts:237–239`. "The run left this step out" is at `actions.ts:264`, `281` and `404`, `departures.ts:133` and `order.ts:193`.
- 5. still stands, with more copies — `poll.ts:801–802` adds two more inline `driverOf(config) === "runner"` tests, beside the two `drivenByRunner` copies (`poll.ts:1258`, `takeover.ts:1031`). `record.ts:40` now names the approval enum once inside that file. But `order.ts:35` `Approval` is still a hand-written twin, and 40v's `records?: Approval` (`actions.ts:724`) passes one into the other.
- 6. still stands — `order.ts:205–213` and `240`; `driver.ts:235` and `424`.
- 7. still stands, and grew — `runnerActions` is now `actions.ts:425–1168`, about 745 lines. `startStep` is at `776–886`, `recordApproval` at `942–1041` and `endRun` at `1058–1166`.
- 8. changed — The unused `_approval` parameter moved to `tryMergeChunkZero` (`chunk-zero.ts:121–128`). `mergeChunkZero` now passes it on without reading it. A new `@ts-expect-error` test (`chunk-zero.test.ts:207–216`) shows that the parameter is required. Three parts are unchanged. `session.test.ts:4993–5063` still calls the private `mergeChunkZero(run, project)` with two arguments, through `as unknown as`. The pass-through methods are still at `session.ts:2282–2300`. `attemptMerge` is still exported (`chunk-zero.ts:147–150`).
- 9. still stands — `brief.ts:264–290` (`departedHow` at 276); `departures.ts:235–261`; `commands/record.ts:207`.
- 10. still stands — `oneLine`: `actions.ts:419`, `driver.ts:290`, `session.ts:630`, `chunk-zero.ts:305` and `step-session.ts:204`, plus `brief.ts:467` doing a different job. `capitalised`: `actions.ts:414`, `departures.ts:247` and `commands/record.ts:273`. `usd`: `comments.ts:147`, `brief.ts:472` and `commands/record.ts:268`. The record path: `record.ts:166–167` and `commands/record.ts:53`.
- 11. still stands — `step-session.ts:66–76` and `194`.
- 12. still stands — `record.ts:89–98` and `57–63`; `actions.ts:196`; `driver.ts:193` and `202–215`.
- 13. still stands — `runs.ts:221` and `753`; `pipeline.ts:655`; `driver.ts:202–206`.
- 14. still stands — `progress.ts:272–287`.
- 15. still stands — `driver.ts:454`, caught at `425–429`.
- 16. still stands — `runner/session.test.ts:421`.

#### New findings

#### 17. The pieces failure is stored as free text in a notice's `about` field, and read back by matching the start of the text — primitive obsession

- **Where:** `src/runner/actions.ts:349–388` and `613–616`; `src/runner/driver.ts:358–376`; `src/runner/record.ts:141–145`.
- **What:** `piecesFailedAbout` writes `` `${PIECES_FAILED_NOTICE}, run ${runId}: ${piecesFailureText(failure)}` ``. `piecesFailureIn` reads it back with `about.startsWith(start) ? about.slice(start.length) : undefined`, and the driver calls it for every notice. The run id, the kind of failure and the error text all go into one string. The typed `PiecesFailure` union exists, but it is turned into a string before it is stored. The `notice` schema has only `about: z.string()`.
- **Why it matters:** Primitive obsession: a string carries a domain meaning (which run, and what failed). It also goes against typescript.md, *Boundaries*: "The schema is the type". The record is a lasting file, and its schema cannot check this entry. The driver depends on the exact wording of a start text defined in another module.
- **Suggested remediation:** Add a record entry kind, for example `{ kind: "pieces-not-acted-on", runId, failed: "merge" | "tickets", conflict?, said }`, and derive its type from the zod schema. The driver matches on the kind, and turns it into words only when it tells the runner. — not applied here

#### 18. A session that records an approval is marked by an optional field on `step-started`, not by its own kind — type design

- **Where:** `src/runner/record.ts:73–86` and `150–163`; `src/runner/brief.ts:307–319`; `src/commands/record.ts:105–115`; `src/runner/departures.ts:70`; `src/runner/driver.ts:798`.
- **What:** `step-started` now means two things, told apart by whether `records` is present. The matching `step-ended` entry has no mark. So `brief.ts` joins back by session id: `entry.kind === "step-started" && entry.records !== undefined ? [entry.sessionId] : []`, then `!recording.has(entry.sessionId)`. The same test is written three ways: `startsAStep`, `entry.records !== undefined` (`brief.ts:309`) and `started.records === undefined` (`commands/record.ts:113`). `departures.ts:70` and `driver.ts:798` still test `kind === "step-started"` directly. They are right today, but only because a recording session never has a building stage. The 40v fix had to change seven places that read the record.
- **Why it matters:** typescript.md, *Type design*: "States are discriminated unions, never flag combinations." When an optional field is the tag, a reader that forgets it is wrong with no warning. That is the fault 40v fixed. The fix was also many one-line edits on one theme, which is shotgun surgery.
- **Suggested remediation:** Give the recording session its own entry kinds, so the compiler makes every reader decide. Or at least put `records` on the end entry as well, and export one `recordingSessions(entries)` query from `record.ts`. — not applied here

#### 19. `watchStep` now takes five positional parameters, and only one caller sets the last two, always together — long parameter list

- **Where:** `src/runner/actions.ts:719–725`; calls at `881` and `1024–1033`.
- **What:** `(stage, session, instructions, afterwards?, records?)`. `recordApproval` passes `what === "pieces" ? async (result) => {…} : undefined, what`. `startStep` passes the first three only.
- **Why it matters:** Long parameter list: "Four or more parameters". The two optional parameters at the end belong to one case, recording an approval, so they are one concept with no name (a data clump). `records` also changes what the written entry means, which makes it a flag parameter.
- **Suggested remediation:** Pass an options object `{ afterwards, records }`. Or add a `watchRecording(what, session, …)` that calls a shared core. — not applied here

#### 20. The runner projects' timer is a copy of the cancellation watch — duplicated code (second copy)

- **Where:** `src/daemon/poll.ts:813–890` (`RunnerTurns`, `turnRunnerProjects`), compared with `poll.ts:974–1056` (`CancelWatch`, `watchForCancellations`). The per-project body is at `771–792` and `855–866`.
- **What:** Both functions have the same parts: a guard so only one run happens at a time, an async block that runs at once, `try { await turning } finally { turning = undefined }`, `setInterval` with `handle.unref?.()`, and a `stop()` that clears the timer and awaits. The comment says "Built as {@link watchForCancellations} is". `interface RunnerTurns { stop(): Promise<void> }` is a copy of `CancelWatch`. The turn body also repeats three things: building `{ name, repoUrl: config.repo_url }`, the `` `${name}: ${oneLine(error)}` `` error line from `turn` a few lines above, and `deps.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_SECONDS * 1000`, which `pollProjects` has already worked out.
- **Why it matters:** Duplicated code. The reference calls a second copy tolerable, so this is a suspicion only. But the parts that must stay the same in both (never reject, `unref`, await on stop) are kept in line only by a comment.
- **Suggested remediation:** Write one `everyInterval(ms, job): { stop(): Promise<void> }` helper and use it in both places. Pass in the interval that `pollProjects` already worked out. — not applied here

#### 21. `rewriteDepartures` does two jobs, and an `undefined` record turns one of them off — flag parameter

- **Where:** `src/runner/driver.ts:961–1000` (in particular `973–976` and `989`); caller at `934–958`.
- **What:** The parameter is `entries: readonly RecordEntry[] | undefined`. When it is undefined, the function only records the pull request number in the ledger, then stops at `if (entries === undefined) return;`. Its name says it rewrites the departures, and the doc comment has to explain what undefined does. The caller then uses `entries ?? []` twice more.
- **Why it matters:** Flag parameter: "two functions wearing one name". Here undefined is the switch.
- **Suggested remediation:** Split it into `followPullRequest(run)` and `rewriteDepartures(run, entries)`, and call the second only when the read succeeded. — not applied here

#### 22. `tryMergeChunkZero` returns the refusal, or undefined when it succeeds — errors and results

- **Where:** `src/daemon/chunk-zero.ts:113–142`; callers at `chunk-zero.ts:104–105` and `src/runner/actions.ts:645–653`.
- **What:** It returns `Promise<ChunkZeroRefusal | undefined>`, and the doc says "Returns the refusal, or undefined when the branch is on the default branch now". Callers write `if (refusal === undefined) return true;`. `openStepTickets` beside it has the same shape, with a failure string or undefined.
- **Why it matters:** typescript.md, *Errors and results*: a fallible external call "returns `{ ok: true, value } | { ok: false, error }`". Here success is the lack of a value. That reads backwards, and it differs from `readRecord` in the same diff.
- **Suggested remediation:** Return `{ ok: true } | { ok: false, error: ChunkZeroRefusal }`, and change `openStepTickets` the same way. — not applied here

### Spec review — phase 40 (second delivery)

- **Read:** my previous review; `doc/specs/prd/prd-05-a-runner-decides-each-step.md` and `doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md` at f94081f (neither changed since a21ac5f); `doc/plans/phases/phase-40.md` from the top through the end of "## Requirements"; the non-process diff `origin/main...f94081f` (stat) and `a21ac5f...f94081f` (in full). I also read the current content of the files the fixes touch or call, all of which are in the diff: `src/runner/{actions,driver,brief,record,departures,order,comments,tools}.ts`, `src/commands/{record,takeover}.ts`, `src/daemon/{chunk-zero,poll}.ts`, and short parts of `src/daemon/runs.ts` (witness), `src/daemon/requests.ts` (wait limit) and `src/daemon/pipeline.ts` (stage labels).
- **Diff:** `origin/main...f94081f`: 73 files, +19634/−474
- **Findings:** 9 standing (7 carried, 2 new). What is left of finding 3 is counted once, as finding 12.

#### Earlier findings

- 1. changed: the count of steps against the order, the list of departures, the brief's order section and `timone record` now all leave out the session that writes an approval into its file (40v). Two things are left. The wake after that session still tells the runner "The step <writing down what it needs> ended: it succeeded." (`src/runner/driver.ts:213–220`, `956`). And the check in `record_approval` still counts that session (see 11).
- 2. gone: no runner path fails a run any more. A failed merge, or tickets that did not open, now leave the run on the runner's wait with a note in the record. The comment on the ticket names no command. What is left, how to try again, is finding 11.
- 3. changed: a comment on a runner project now wakes its runner while a daemon project's session holds the cycle (40y). Left: `timone takeover` and the end of a terminal session still wait for the next cycle. See 12.
- 4. still stands: the fixes do not touch cost recording. A stopped step still records $0, the consult at the limit is not counted, and a wake that decides nothing leaves no reason in the record.
- 5. still stands: `mergeChunkZero` now passes its approval on to `tryMergeChunkZero`, which still does not read it. The daemon path still accepts a reply from anyone.
- 6. gone: a pull request closed without merging, on a branch that is ahead, now makes `end_run` refuse unless a named person's stop comment is named. The tool description and the runner's instructions say the same.
- 7. still stands: the 15-minute summary still shows no output from the step, and nothing wakes the runner when a step goes silent.
- 8. still stands: marks and notices are still written before the wake, and the retries still live only in memory.
- 9. still stands. 40w also changed the runner's instructions again: a new line in `SYSTEM` for a closed pull request that gives no reason, and a new `end_run` description. So R18 clause 2 applies to this pull request itself. From what I may read, I cannot tell whether the replay was run on this build.
- 10. still stands: the hold that `timone cancel` puts on the ticket, and the consult change, are still not recorded in any requirement.

#### New findings

#### 11. After a failed merge of the list of pieces, the run stays open but nothing can try again with the approval already given — PRD-05.R9, PRD-05.R3

- **Where:** `src/runner/actions.ts:963–971` and `304–311`; `src/runner/driver.ts:227`; `src/runner/comments.ts:127–144`; `src/runner/brief.ts:112–175`
- **What:** After 40x, the runner is woken with "The list of pieces was approved, but … The run was not ended." The merge and the ticket opening only run after the session that `record_approval` starts. To try again, the runner would call `record_approval` again. That call refuses the original approval comment. The check takes the latest successful `step-ended` at stage `breakdown`, and that is now the approval-writing session's own end. 40v tagged that session in the record, but did not change this check. The refusal then says "Ask the person to approve the list of pieces now that it is written." No instruction, tool description, event text or replay case tells the runner that recording the approval again is how to try again. No test covers a merge that fails once and then succeeds.
- **Why it matters:** R9 clause 2 says that when a named person writes "try again" on a stuck ticket, the runner does it or says why it will not. R3 clause 3 says that once the list is approved, chunk zero is merged as today. Here, a person who fixed the clash is asked to approve, a second time, a list they already approved. The new `approval` entry would then name their "try again" comment, not the comment that gave the approval (R7 clause 2).
- **Suggested remediation:** leave sessions that carry `records` out of the `finished` check, as 40v does elsewhere, so the original approval can be named again. Or let code retry chunk zero on a later wake when a recorded approval has not been acted on. Say in the event text how to try again. Add a test where the merge fails and then succeeds after a named person's reply. — not applied here

#### 12. While a daemon project's session runs, `timone takeover` on a runner project still waits for it — PRD-05.R15, PRD-05.R11

- **Where:** `src/daemon/poll.ts:804`, `819–839` (the comment "Requests other than a cancel, such as `timone takeover`, are not read here"); `src/daemon/poll.ts:715`; `src/commands/takeover.ts:683–703`, `777–780`; `src/daemon/runs.ts:1579–1601`
- **What:** 40y gives runner projects a turn on a clock of their own while a daemon project holds the cycle. That turn reads comments and wakes the runner. It does not read `claim-takeover` or `release-takeover` requests, which are only read at the start of a cycle. So on scratch-app, while ivtrends builds, `timone takeover` waits 150 seconds and gives up: "a cycle takes as long as whatever it is running". A terminal session that ends in that time does not wake the runner until the ivtrends session ends. Also, `observedAt` is still written only at the start of a cycle.
- **Why it matters:** R15 clause 1, as written (a comment), now holds. But R15 says "one project's work no longer holds up the others". R11 clause 2 says a takeover opens a session and the runner wakes when it ends. In the mixed setup that R19 creates, both still wait on another project's session. R15's verification hint measures `observedAt` "while a session runs". That stamp still stops moving, so a live check done the way the register says would fail, even though comments now work.
- **Suggested remediation:** read the takeover requests of runner projects in the same clock turn, or read all requests on the cancel clock. Change R15's hint to measure the wake itself. Or record in R15 that this phase covers only comments. — not applied here
