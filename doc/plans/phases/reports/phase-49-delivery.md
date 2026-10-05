# Phase 49 — Delivery Report

- **Date:** 2026-10-05
- **Phase:** [phase-49.md](../phase-49.md) — `Complete`, verified in [phase-49-verification.md](phase-49-verification.md)
- **Branch:** `timone/203-5-two-places-and-the-planner` @ `4a87cb1`
- **Base:** `main` — the project's default branch. The branch's merge-base with `main` is `55cddb4`, `main`'s head, so nothing else is stacked under it.
- **Pull request:** opened against this report, from the branch above to `main`. Its address is posted on [#203](https://github.com/fvermaut/timone/issues/203).
- **Screen:** no user-facing screen in this phase — the phase file's `Screens changed` line reads *none* (`timone status` is terminal text; ticket comments are GitHub text) — [ADR-0052](../../../adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md), [ADR-0057](../../../adr/0057-every-screen-a-phase-changes-is-looked-at-and-its-figures-read-on-the-preview-data.md)
- **Questions for the human:** 2, quoted from the verification report's section of that name. The runner's instructions for this step asked that the first, the fix against ADR-0063, be put on the pull request.
- **Departures:** `phase-49-departures.md` — 9 entries: 6 from the build, 3 from the check.

## Scope

Piece 5 of the [list of pieces for #197](../../breakdowns/ticket-197.md), driven by [#203](https://github.com/fvermaut/timone/issues/203). It claims PRD-07.R2, R4, R5, R6 and R12 (all MUST), in the [criteria register](../../../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md).

- Each project has the number of places `places` sets in `timone.yaml`, and 2 when it sets none (49a).
- The daemon picks up every open, unblocked, unheld and unclaimed step of a request, not only the first (49b).
- The first push of a work branch that carries a commit of another `origin/timone/*` branch is refused, naming that branch (49c).
- A build does not start until the planner has decided (49d). The planner is a session of its own ([ADR-0065](../../../adr/0065-the-planner-is-a-session-of-its-own-asked-when-a-build-would-start.md)). Code gives it the facts; it answers let build, hold, or pass to the runner; code checks the answer and writes the hold comment, naming each ticket waited for (49e). One planner session per project at a time; a held ticket is asked about again when nothing it waits for is building or open; a named person's comment on a waiting ticket goes to the planner (49f).
- `timone status` names what the planner is deciding and holding (49g).
- The old rules carry dated notes naming ADR-0065: PRD-02.R22 clause 1, PRD-05.R15 clause 2, `process.md`, the planning instructions and `CONTEXT.md` (49h).

## How to try it

### Against the preview

This project has no preview configured for pull requests (`timone.yaml` sets no `bindings.preview` for `timone`). Use the local steps below.

### On a local checkout

Setup is in the project's [README.md](../../../../README.md). Then, on this branch:

1. `npm install && npm run build && npx vitest run` — expect 73 files, 1851 tests, all passed.
2. `npx vitest run src/manifest.test.ts src/daemon/runs.test.ts src/runner/session.test.ts src/commands/` — the places from `timone.yaml`, 2 by default. Expect exit 0.
3. `npx vitest run src/daemon/steps.test.ts src/daemon/poll.test.ts` — every unblocked step is picked up, and none when GitHub fails to list the steps. Expect exit 0.
4. `npx vitest run src/daemon/push-guard.test.ts src/daemon/push-guard.git.test.ts src/commands/guardrails.test.ts` — a branch carrying another ticket's commits is refused at its first push. Expect exit 0.
5. `npx vitest run src/planner/ src/runner/ src/daemon/` — the planner's facts, answers, comments and loop, and the refusal to build without its decision. Expect exit 0.
6. `npx vitest run src/commands/status.test.ts` — `timone status` names what the planner holds. Expect exit 0.
7. `grep -n "ADR-0065" doc/specs/prd/prd-02-inversion-of-control.criteria.md doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md process.md .claude/skills/timone-plan/SKILL.md CONTEXT.md` — each file is listed at least once.
8. The checks only you can run are under *Outstanding for the human*.

## Verification outcome

Verified in [phase-49-verification.md](phase-49-verification.md) — **2 of 2 fix loops consumed.** Two faults found and fixed on the branch: `e705481` (PRD-07.R4) and `074ec45` (PRD-07.R2).

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-07.R2 | MUST | api | PASS — clause 6 failed first, fixed in loop 2 | 2 |
| PRD-07.R4 | MUST | api | PASS — clauses 1 and 4 failed first, fixed in loop 1 | 1 |
| PRD-07.R5 | MUST | live | LIVE-GATE — never gated; this phase owes one | — |
| PRD-07.R6 | MUST | api | PASS | 0 |
| PRD-07.R12 | MUST | api | PASS | 0 |
| PRD-01.R2 | MUST | api | PASS (regression) | 0 |
| PRD-05.R2 | MUST | api | PASS (regression); clause 2b BLOCKED | 0 |
| PRD-05.R3 | MUST | api | PASS (regression) | 0 |
| PRD-05.R4 | MUST | api | PASS (regression) | 0 |
| PRD-05.R5 | MUST | api | PASS (regression) | 0 |
| PRD-05.R7 | MUST | api | PASS (regression); its real-runner clause BLOCKED | 0 |
| PRD-05.R10 | MUST | api | PASS (regression) | 0 |
| PRD-05.R11 | MUST | api | PASS (regression) | 0 |
| PRD-05.R18 | MUST | api | BLOCKED — the replay needs a model login | 0 |
| PRD-07.R1 | MUST | api | PASS (regression) | 0 |
| PRD-07.R3 | MUST | api | PASS (regression) | 0 |
| PRD-07.R9 | MUST | api | PASS (regression) | 0 |
| PRD-07.R10 | MUST | api | PASS (regression) | 0 |
| PRD-07.R13 | MUST | api | PASS (regression) | 0 |
| PRD-08.R1 | MUST | api | PASS (regression) | 0 |
| PRD-08.R2 | MUST | api | PASS (regression) | 0 |
| PRD-08.R4 | MUST | api | PASS (regression) | 0 |
| PRD-08.R5 | MUST | api | PASS (regression) | 0 |

### Outstanding for the human

- [ ] PRD-07.R5 — live gate owed: on scratch-app, never ivtrends, three test tickets — two whose plans change most of the same files, one that changes none of them. Watch the planner let one of the first two and the third build at once, and hold the other with a comment naming the ticket it waits for. Merge or close the first and watch the held one decided again. Steps in [phase-49-verification.md](phase-49-verification.md) § Live gates. Commit its report before merging.
- [ ] PRD-05.R18 (and PRD-05.R7's real-runner clause) — the replay: `npm run --silent replay` from a logged-in terminal on this branch, and commit its record on the branch before merging. [phase-49-verification.md](phase-49-verification.md) § Carried forward.
- [ ] The two machine-only checks named in [phase-49-complete.md](phase-49-complete.md) § Context for the next agent: `npm run replay` (PRD-05.R18, the same as above) and PRD-07.R5's live check on scratch-app (the same as the first item).
- [ ] PRD-05.R2 clause 2b — its check could not read GitHub from the container. It needs a machine that can.
- [ ] Question 1 — the fix `074ec45` against ADR-0063 D2: which should stand.
- [ ] Question 2 — whether a `blocked by` relation on an ordinary ticket should stop its build.

No HUMAN-CHECK scripts: no criterion in scope is on the `human` channel.

## Standards review — phase 49

- **Read:** the diff of `src/` and `.claude/` (`git diff main...timone/203-5-two-places-and-the-planner -- src .claude`); for context, the current `src/planner/*.ts`, `src/runner/session.ts`, `src/runner/driver.ts`, `src/runner/brief.ts`, `src/runner/comments.ts`, `src/runner/tools.ts` and `src/daemon/runs.ts`; `/workspace/timone/standards/typescript.md`, `/workspace/timone/standards/testing.md`, `/workspace/timone/standards/project-structure.md`, `/workspace/timone/standards/code-smells.md`; `tsconfig.json` and `package.json` scripts. The project has no lint or format config. Its only tool is `tsc --strict`.
- **Diff:** `main...timone/203-5-two-places-and-the-planner` — 76 files, +7166/−258 for the whole range. This review covered only the 55 files under `src` and `.claude` (+5099/−223).
- **Findings:** 9

### 1. The planner's session copies how the runner's session ends — Duplicated code

- **Where:** `src/planner/session.ts:105–214`, against `src/runner/session.ts:342–495` and `:723`
- **What:** `converse` repeats the runner's query loop line for line: `assistantMessage.safeParse` → `apiErrorFrom`, `resultMessage.safeParse`, and the `catch` that returns `retry: technicalFault(text) !== "credentials"`. `REACHED_A_CAP`, `failureOf`, both zod schemas, `ResultMessage`, `tookTooLong` and `oneLine` are copied word for word. They even share the same comment, "As for the runner".
- **Why it matters:** this is Duplicated code. Two copies of the rule "how a failed SDK session is judged, and whether it is retried" will drift apart. The next fix to `failureOf` will reach only one of them.
- **Suggested remediation:** move the result reading and the failure-and-retry judgement into one shared module, for example under `src/daemon/`. Both sessions would call it. Not applied here.

### 2. The rule "this ticket is building" is written twice — Duplicated code

- **Where:** `src/planner/driver.ts:63–68` and `:250–265`; `src/planner/facts.ts:90–95` and `:151–167`
- **What:** `const BUILDING_STAGES = ["execution","verification","delivery","remediation"]` is declared in both files. Both also restate `letBuild = …decision?.kind === "build" && pr === undefined` and `active = status === "active" && … BUILDING_STAGES.includes(stage)`, after the same open-pull-request check. The doc comment in `driver.ts` says "The planner's facts read 'building' the same way". That sentence admits the copy.
- **Why it matters:** this is Duplicated code. A third `BUILDING_STAGES` already exists in `src/runner/departures.ts:56` with a different meaning (`["execution","remediation"]`). That is also Inconsistent vocabulary: one name holds two different lists.
- **Suggested remediation:** write one exported `isBuilding(run, cycle)` (or a state function) in `planner/facts.ts` and use it from `stillWaits`. Give it a name that does not clash with the one in `departures.ts`. Not applied here.

### 3. The planner's decision is a set of optional fields, not a tagged union — Type design (typescript.md)

- **Where:** `src/daemon/runs.ts:244–257`, `src/runner/record.ts:70–80`. The `?? []` uses are at `src/runner/actions.ts:563`, `src/runner/session.ts:644`, `src/commands/status.ts:445` and `src/planner/driver.ts:251`.
- **What:** `decision: { kind: z.enum(["build","hold"]), reason, waitsFor?: …, onComment?: … }`. `waitsFor` only means something when the kind is `hold`, but the type allows it on `build` and allows a `hold` without it. Every reader therefore writes `decision.waitsFor ?? []`, four times. The state "not asked / deciding / held / let build" is also read from `askedAt?` + `decision?`, in three places: `waitsForPlanner`, `RunStore.waitingForPlanner` and `plannerOf`.
- **Why it matters:** this breaks the Approved rule in typescript.md: "States are discriminated unions, never flag combinations". The `?? []` hides a hold that has nothing to wait for, which should not be possible.
- **Suggested remediation:** use `z.discriminatedUnion("kind", [build{…, onComment?}, hold{…, waitsFor: nonempty}])` in both schemas. Derive the planner state in one function and reuse it. Not applied here.

### 4. "One planner session per project" is enforced in two places — Duplicated code

- **Where:** `src/planner/driver.ts:127` and `:154` (`deciding` map); `src/planner/session.ts:237` and `:245` (`busy` set)
- **What:** `PlannerDriver.tick` returns early when `this.deciding.has(project.name)`. `PlannerSessions.decide` refuses again when `this.busy.has(run.project)`. Both comments cite the same rule (D1).
- **Why it matters:** this is Duplicated code, here a decision written twice. Neither class is the single owner of the rule, so a reader cannot tell which guard actually holds.
- **Suggested remediation:** keep one guard, most likely the driver's, and remove the other or reduce it to an assertion. Not applied here.

### 5. `runner/` and `planner/` import each other — Inappropriate intimacy

- **Where:** `src/runner/driver.ts:20–21` imports `planner/actions` and `planner/driver`. `src/planner/driver.ts:6–9`, `src/planner/facts.ts:9–10`, `src/planner/actions.ts:8–11`, `src/planner/tools.ts:9` and `src/planner/session.ts:8` import from `runner/`.
- **What:** `planner/driver.ts` imports `type RunnerCycle` from `runner/driver.ts`, which imports `plannerReadComment` and `waitsForPlanner` back from `planner/driver.ts`. The planner also reaches into runner internals that this diff only now exported for it: `attempt`, `filesAddedOnBranch`, `PHASES`, `namedPersonsComment`, `untilMergedOrClosed`, `RUNNER_MODEL` and `RUNNER_RETRY_WAITS_MS`.
- **Why it matters:** this is Inappropriate intimacy, and it goes against project-structure.md's "Unidirectional dependencies" rule (features never import from another feature; shared code gets promoted). That rule is Approved but written for feature folders. It applies here by analogy.
- **Suggested remediation:** move the code both sides use (record notices, the forge-fact helpers, the named-comment lookup, the model settings) into a shared module. After that, only one direction of import remains. Not applied here.

### 6. Small helpers copied from the runner into the planner — Duplicated code

- **Where:**
  - `src/planner/driver.ts:102–110` (`noticed`, `ms`), against `src/runner/driver.ts:328` and `:345`
  - `src/planner/driver.ts:118` and `src/planner/session.ts:212` (`oneLine`), against about ten existing copies, e.g. `src/runner/driver.ts:322`
  - `src/planner/tools.ts:97` (`answer`), against `src/runner/tools.ts:166`
  - `src/planner/brief.ts:139` (`quoted`), against `src/runner/brief.ts:609`
  - `src/planner/actions.ts:61` (`sentence`), against `src/runner/comments.ts:158`
- **What:** these are identical bodies. `factLine` and `listOrNone` in `planner/brief.ts:129–136` are near-copies of `runner/brief.ts:455–464`, differing only in the separator and the leading `- `.
- **Why it matters:** this is Duplicated code under the rule of three. `oneLine` is far past three copies, and this diff adds two more.
- **Suggested remediation:** export the existing helpers, or move them to a small shared util, and import them. Not applied here.

### 7. How to end a sentence is decided four ways — Duplicated code

- **Where:** `src/planner/actions.ts:61–64`, `src/runner/driver.ts:299`, `src/runner/actions.ts:564`, `src/planner/brief.ts:20`
- **What:** one site uses `sentence()`, which adds a full stop. Another inlines `${/[.!?]$/.test(why) ? "" : "."}`. Two others use `.trim().replace(/\.$/, "")`, which removes the full stop before adding one again.
- **Why it matters:** this is Duplicated code, here a repeated one-liner. It is also a decision about the planner's reason text spelled differently at each site. The `replace` form handles only `.`, not `!` or `?`.
- **Suggested remediation:** export one `sentence()` and one `clause()` (no final stop) from `runner/comments.ts` and use them at all four sites. Not applied here.

### 8. "Live run" is spelled out by hand instead of using `isSettled` — Duplicated code

- **Where:** `src/planner/driver.ts:85` and `:254`, `src/planner/facts.ts:122`; the existing helper is `src/daemon/runs.ts:73`
- **What:** `run.status === "done" || run.status === "cancelled"` appears three times. `runs.ts` already has `isSettled`, which this diff's own `waitingForPlanner` and `heldByPlanner` use, but it is not exported.
- **Why it matters:** this is Duplicated code. A new final status would be missed at these three sites.
- **Suggested remediation:** export `isSettled` and use it. Not applied here.

### 9. The same store-opening line is changed in six commands — Shotgun surgery

- **Where:** `src/commands/cancel.ts:339`, `daemon.ts:642`, `guardrails.ts:524` and `:658`, `status.ts:636`, `takeover.ts:832`
- **What:** `RunStore.open(statePath)` became `RunStore.open(statePath, { placesOf: placesIn(manifest) })` at each call site.
- **Why it matters:** this is Shotgun surgery, and also a repeated one-liner (Duplicated code). The rule "a store knows its project's places" has no home. The next command that opens the store can forget it and quietly fall back to `DEFAULT_PLACES`.
- **Suggested remediation:** add one constructor, e.g. `RunStore.openFor(statePath, manifest)`, and call it from the commands. Not applied here.

The tests and the `.claude/skills/timone-plan/SKILL.md` change had no findings.

## Spec review — phase 49

- **Read:** `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.md`, `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md` (header, R2–R6, R12), `doc/plans/phases/phase-49.md` (requirements header, goal, sub-phases 49a–49h), `doc/adr/0065-the-planner-is-a-session-of-its-own-asked-when-a-build-would-start.md`, `doc/adr/0063-a-ticket-takes-a-place-only-while-one-of-its-steps-runs.md` (the D1–D3 lines that matter here), and the diff of src/, `.claude/skills/timone-plan/SKILL.md`, `process.md`, `CONTEXT.md`, and the PRD-02, PRD-05 and PRD-07 notes. Branch files were read with `git show`.
- **Diff:** `main...timone/203-5-two-places-and-the-planner` — 76 files, +7166/−258
- **Findings:** 3

### 1. A run whose step ends no longer waits for a place, which changes ADR-0063 D2, and ADR-0063 does not say so — PRD-07.R2

- **Where:** `src/daemon/runs.ts:1497–1500`; `src/runner/driver.ts:981–986` (the `afterStep` place notice was removed)
- **What:** The verification fix `074ec45` deleted the rule that a run whose step has just ended waits for a place with its own order and keeps the place when it comes first. The new comment says: "a run whose step has just ended does not wait for a place, and none is given to it: the runner session it wakes takes no place (PRD-07.R2 clause 6)". ADR-0063 D2 still describes the old rule as decided, and so do its consequences ("A given place can sit unused for one runner session"). ADR-0063 is not touched in the diff. The phase file says that, for ADR-0063, "this phase changes only how many there are".
- **Why it matters:** The change does make PRD-07.R2 clause 6 true: a runner session takes no place. But it reverses a recorded decision without a record, and it goes past the scope the phase declared. One effect: a run whose step ends can now lose the next step to any other run that asks first. ADR-0063 D2 said that rule was there to stop exactly that race.
- **Suggested remediation:** Add a dated note to ADR-0063 D2 (or record a superseding ADR) that names PRD-07.R2 clause 6 and `074ec45`. List it as a departure in the pull request. — not applied here

### 2. A hold can name a ticket that the re-ask rule never treats as "still waiting", so the ticket is held and asked about again on every cycle — PRD-07.R5 clause 4, PRD-07.R6 clause 1

- **Where:** `src/planner/actions.ts:109–112` and `:169–185`; `src/planner/driver.ts:144–150` and `:250–264`
- **What:** `hold` accepts any ticket in `shown`. That set includes every entry of `facts.blockers`, closed blockers too. But `stillWaits` only looks at live runs in the ledger that are building or have an open pull request. Two cases fail:
  - A hold that names a blocker which has no live run (closed, never picked up, or its run was cancelled while the ticket stays open).
  - The same for a planner ruling that a ticket needs a blocker's unmerged work.

  In both cases `stillWaits` returns false on the next tick, `reaskPlanner` clears the hold, and a new session runs. That session can hold again, which posts a new hold comment.
- **Why it matters:** R5 clause 4 says the planner decides again *when the pull request it waits for merges or closes*. Here it decides again every cycle while that pull request is still open or not yet made. Each session costs up to $2 against the ticket's limit, and each repeated hold posts the same comment on the ticket again (R6 clause 1 asks for one plain comment). This case is narrow, because a blocked step is normally not picked up. A `Needs:` relation added after pickup, or a blocker whose run was cancelled, reaches it.
- **Suggested remediation:** Make `stillWaits` count an open blocker ticket from `cycle.blockedBy` as still waited for. Or make `hold` refuse a ticket that `stillWaits` would not see. — not applied here

### 3. A let-build decision outlives a new plan, so a re-planned build starts on a decision taken before its plan — PRD-07.R5 clause 1

- **Where:** `src/runner/actions.ts:547–549`; `src/daemon/runs.ts` (`decidePlanner`, `reaskPlanner`: nothing clears a `build` decision)
- **What:** `plannerRefusal` returns early on `decision?.kind === "build"`, and a `build` decision stays on the run for its whole life. Take a run that is let build, then goes back to planning and commits a new phase file, then starts `execution` again. That build is not asked about again, and the planner never saw the new plan's files. ADR-0065 D2 accepts "asked for once per run".
- **Why it matters:** R5 clause 1 says a let-build decision is "recorded after its plan was committed". With a second plan, the decision that lets the build start was taken before that plan.
- **Suggested remediation:** Clear the planner's decision when a planning step ends with a new plan. Or have the person who merges confirm that ADR-0065 D2 deliberately narrows R5 clause 1, and add a dated note to R5. — not applied here

The rest matches the criteria and ADR-0065:
- the `places` key with 2 as the default;
- every eligible step is picked up;
- the push guard checks the first push of a work branch;
- the planner is asked only for `execution`;
- the planner's facts, tools and code-written comments;
- a named person's comment is routed to the planner;
- `timone status` shows the planner's line;
- the R12 notes on PRD-02.R22 and PRD-05.R15, plus the `process.md`, `SKILL.md` and `CONTEXT.md` text.

The register changes are verification's status flips and dated notes. R5 stays `draft`, waiting for its live gate.

## Notes

- **The Standards review ran twice.** Its first prompt named the check's own scripts as part of its subject. A guard keeps those scripts away from anything outside the check, so the first attempt read nothing. The second attempt reviewed `src/` and `.claude/` only. The check's scripts in this diff were not reviewed against the project's conventions.
- **No project in `timone.yaml` sets `places`**, so after merging every project, ivtrends included, gets two places. The completion report leaves to the person merging whether to set `places: 1` on ivtrends until the live check on scratch-app has passed.
- **Piece 4 of #197** ([#202](https://github.com/fvermaut/timone/issues/202)) may be built at the same time and touches `src/runner/` and `src/daemon/` too. Whichever of the two pull requests merges second may need bringing level by hand.
- **A stale note:** the 2026-10-04 note under PRD-07.R12 in the register said PRD-02.R22 clause 1 and PRD-05.R15 clause 2 were not changed yet. The check struck the stale sentence through.
