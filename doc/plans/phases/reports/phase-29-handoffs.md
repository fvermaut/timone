# Phase 29 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

> **Branch.** `phase-29-one-step-one-ticket`, cut from `phase-30-work-in-a-box` rather than from `main`. The phase-29 plan's own amendments — the four rulings and everything after them — live on the phase-30 branch and nowhere else, so a branch cut from `main` would have been executing a plan it could not read. Phase 29 depends on nothing in phase 30's code, and phase 30's three slices are unreviewed, which is why this is its own branch rather than more commits on that one.

> **Timone runs its own phases by hand.** `/timone-execute` operates on managed projects and Timone is not one, so there are no sub-agents here: each slice is built in the session, in the order the dependency graph gives.

## 29a — The frontier query: which step is next, from tickets

**Built.** `nextStep` is a pure, offline function in the new `src/daemon/steps.ts`. Given an initiative's step tickets it returns the first that is **open, unblocked, unheld and unclaimed**, or `undefined` — which is the signal to close the initiative. `HELD_LABEL` is named here, once, and every other mention in the phase points at it.

Nothing calls it yet. It is the rule on its own, which is what makes it testable without a tracker.

**Files touched.**

- `src/daemon/steps.ts` — **new.** `HELD_LABEL` and `nextStep`.
- `src/daemon/steps.test.ts` — **new.** Nine cases.
- `src/adapters/ticketing.ts` — `Step` and `Dependency` live here rather than in `steps.ts`; see the decision below. (Committed with 29b, which is the slice that owns this file.)

**Decisions taken inside the slice.**

- **`Step` belongs to the port, not to the daemon.** The plan puts `Step` in 29a and the reading of it in 29b, which reads as though the type were the daemon's. It is not: `src/adapters/` imports nothing from `src/daemon/` anywhere in the tree, and inverting that for one type would be the first exception. `stepSchema` therefore sits beside `ticketSchema` in `src/adapters/ticketing.ts`, and `steps.ts` imports it. `HELD_LABEL` stays in `steps.ts` — the adapter reports labels and has no opinion about which one holds a step.
- **A dependency carries its own state rather than a number to resolve.** Forced by 29b's reading of gh's real output; the reasoning is under 29b, because that is where it was found. `nextStep` therefore has no set of open numbers and no lookup, and the cycle case (7) falls out for free rather than needing a guard: two steps that block each other each carry an open dependency, both are skipped, and the call returns `undefined` without walking anything.
- **Eligibility is four conditions and the plan names four.** `dependenciesIncomplete` is the ninth case and is not in the plan's seven — again, found in 29b.
- **No special case for the machine's own name.** The function reads `HELD_LABEL` as a constant and asks whether `assignees` is empty. It knows no login, compares against no identity, and cannot be made to behave differently for the bot than for a person. The plan forbids the special case and there was no temptation to add one, because there is no identity in scope to compare against.

**Validation evidence.**

`npm run build && npx vitest run src/daemon/steps.test.ts` — **9 passed**.

Red first, in two goes. Cases (1) through (8) were written against a `nextStep` that threw `not implemented`, and all eight were seen failing before the body was written:

```
× takes the first when every step is open and none is blocked
× takes the second when the first is closed
× skips a step whose dependency is still open, even when it sorts first
× takes a step whose dependency is closed
× skips an open step the machine is holding
× skips an open step a person has taken
× returns undefined when every step is closed
× returns undefined on a dependency cycle rather than looping
Tests  8 failed (8)
```

Case (9), added later from 29b's finding, was proved red by deleting its own clause from the implemented function and re-running: `× skips a step whose dependency list came back incomplete`, `1 failed | 8 passed`. The clause was restored and all nine pass.

**The plan's checks, answered.**

- **All eight cases seen failing first** — yes, the trace above. Nine, with the one the plan did not know about.
- **(5a) and (5b) both present and both red first** — yes, and they are the fifth and sixth lines of the trace. They are separate `it` blocks reading separate fields; an implementation that read only `labels` or only `assignees` fails one of them.
- **Case (7) asserted with a real cycle, not a comment** — yes: two steps, each declaring the other open. The function has no loop to hang in, which the test confirms rather than assumes.

**What this slice does not prove.** That the frontier is *reached* — nothing calls `nextStep`. And a step the machine is holding still blocks steps that depend on it, because it is open; the plan does not say whether a dropped step should hold its dependents back, and this slice does not decide it. Flagged for 29d.

## 29b — Reading an initiative's step tickets

**Built.** `listSteps(project, initiative)` joins the ticketing port and the GitHub adapter: the children of one initiative, **open and closed alike**, in the order its approved breakdown put them. One `gh issue list --json` call. No GraphQL.

**Files touched.**

- `src/adapters/ticketing.ts` — added `dependencySchema`, `stepSchema`, their inferred types, and `listSteps` on the port.
- `src/adapters/github-tickets.ts` — added `ghDependencySchema`, `ghStepSchema`, `STEP_FIELDS`, `BODY_DEPENDENCY_LINE`, `toStep` and the `listSteps` method.
- `src/adapters/github-tickets.test.ts` — added `ghStep`, `ghDependency` and a ten-case `describe("listSteps")`.
- Eleven stub adapters across `poll.test.ts`, `session.test.ts`, `hooks.test.ts`, `daemon.test.ts`, `guardrails.test.ts`, `retry.test.ts` and `takeover.test.ts` gained a `listSteps`.

**Two corrections to the plan, both found by reading `gh`'s real output before writing a fixture.**

The plan is emphatic that fixtures carry gh's real shape. Getting it meant creating a throwaway parent and child on `fvermaut/scratch-app` — #42 and #43, both now closed, with the transcript on #42. Two things came out of it that the plan did not know, and both change the design rather than decorating it.

- **A dependency does not say which repository it is in.** #43 was blocked by `scratch-app#42` *and* `timone#8`. `--json blockedBy` returned them as the bare numbers `42` and `8`; only the `url` distinguishes them. **An implementation that resolved a dependency by number against the initiative's steps would have matched `timone#8` to `scratch-app#8`** — a real, unrelated issue — and answered confidently with the wrong state. Every node carries its own `state` in the same response, so `Dependency` carries `open` and no number is ever looked up. This is why 29a's cycle case needs no guard.
- **A dependency list can be counted without being handed over.** `blockedBy` is `{nodes, totalCount}`. When the count exceeds the nodes, the step waits on something nobody can name. It reads as **blocked, never as free** — a step that should have been held back and was not is the failure mode ADR-0040 names as the one to watch. That is `dependenciesIncomplete`, and 29a's ninth case.

Recorded shapes, verified 2026-08-21: `parent` is `{id, number, state, title, url}` or `null`; `state` is `OPEN`/`CLOSED`; `assignees` elements carry `login`; `labels` was already in `LIST_FIELDS`.

**Decisions taken inside the slice.**

- **The children are filtered here, not by gh.** `gh issue list` has no `--parent` filter — verified. So the listing asks for the repository's issues with `parent` among the fields and keeps those whose parent is the initiative.
- **Order is by number ascending, and the slice says why.** The plan asks for "the breakdown's order". 29c opens one ticket per step in the order the human approved, so ascending number *is* that order. gh answers newest-first, which would run an initiative backwards — which is what the plan's case (1) is really guarding, and the test uses out-of-order input to prove it.
- **`closed` is not requested, though gh offers it.** `state` already says it. Two fields for one fact are two chances to disagree.
- **The truncation refusal is repeated, not shared.** `listIssues` refuses a page-limited list; so does this. The message differs because the consequence differs — choosing a step from a truncated list picks the wrong step, rather than merely missing a ticket.
- **The body line is matched whole and never parsed.** `BODY_DEPENDENCY_LINE` captures the line verbatim so the machine can quote it back. Nothing extracts the numbers, because nothing acts on them (ADR-0044 D6).
- **`noUnmarkedTickets` became `noOtherListings`** in `poll.test.ts`. It now stubs two listings rather than one, and its old name would have been describing half of itself.

**Validation evidence.**

`npm run build && npx vitest run src/adapters/github-tickets.test.ts` — **39 passed**, of which ten are this slice's. All ten were seen red first, against a port that had no `listSteps`: `TypeError: (intermediate value).listSteps is not a function`, ten times.

Full suite: **1157 tests, 1156 green.** The one failure is `guardrails.test.ts > resolves the session id against the ledger`, timing out at 20s — the known flake, [timone#8](https://github.com/fvermaut/timone/issues/8). It passes on its own (23/23) and it failed the same way before this branch existed.

**The plan's checks, answered.**

- **All six cases red first** — yes, and four more besides: the argument vector, a closed child, a cross-repository dependency, and no network.
- **No `gh api graphql` in this slice** — `grep -n "graphql" src/adapters/github-tickets.ts` returns nothing.
- **`LIST_FIELDS` widened, and the code reads both `labels` and `assignees`** — `STEP_FIELDS` extends `LIST_FIELDS` with `state,assignees,blockedBy,parent`; `labels` was already there. `toStep` reads both fields, and cases (5) and (6) fail separately if either is dropped.
- **No test reaches the network** — every call goes through `fakeRunner`, which throws on an unexpected call. Asserted explicitly.
- **A non-zero test count** — 39, read from the run, not inferred from the colour.

**What this slice does not prove.** That anything calls `listSteps`; that an initiative's children exist to be listed (29c opens them); and that the `Blocked by:` line, once reported, is actually said on the ticket — this slice carries the line, and a later slice must speak it.

## 29c — Approval opens one ticket per step, idempotently

**Built.** `openStepTickets` runs inside `recordApproval` (`src/daemon/session.ts`), immediately after `mergeChunkZero` returns true — the point the code's own comment calls *"one gesture with two effects"*. It reads the approved breakdown off the project's default branch, opens one ticket per chunk as a child of the initiative, chains each to the one before it as GitHub's native relation, and rewrites the initiative's ticket into a map of its children.

**It is TypeScript and it is not in the prompt.** The plan is emphatic and it was right to be: idempotence is this slice's whole deliverable, and idempotence cannot be *asserted* about a spawned model told "create only what is missing". `approvalRecordPrompt` is untouched.

**Files touched.**

- `src/adapters/ticketing.ts` — four writes join the port: `createStep`, `blockStep`, `setTicketBody`, `ensureLabel`.
- `src/adapters/github-tickets.ts` — their implementations.
- `src/adapters/github-tickets.test.ts` — eight cases for them.
- `src/adapters/ticketing.stubs.ts` — **new.** `noStepWrites` and `noSteps`.
- `src/daemon/steps.ts` — `HELD_LABEL_DESCRIPTION`, beside the label it describes.
- `src/daemon/session.ts` — `breakdownSource` option; `openStepTickets`; the `stepTitle`, `stepBody` and `initiativeMap` helpers; the `recordApproval` wiring.
- `src/daemon/session.test.ts` — `trackerWithSteps`, `approvedBreakdown`, and an eight-case `describe`.
- Twenty-nine stub sites across seven files gained `...noStepWrites`.

**The finding that changed the slice: the breakdown artifact has no dependency field.**

The plan says each created ticket carries "its declared dependencies", and blocker D's ruling makes a dependency the native relation. But `Chunk` is `{title, delivers}` and `CHUNK_LINE` (`breakdown.ts:61`) parses `N. **title** — delivers`. **There is nowhere in the format for a chunk to declare anything.** Two honest readings, and the slice took the conservative one:

- **The approved order *is* the dependency.** Step N waits for step N−1. That reproduces exactly what the system does today — ADR-0029's *a chunk advances only on success*, one at a time, in order — with no notation invented and no artifact format changed, which would be stage 3 or stage 5 work done inside a slice.
- **It is better than the status quo in one specific way**, which is why it does not merely preserve behaviour: the chain is now a **visible, editable relation on the tracker**. fvermaut can delete one `blockedBy` edge on any GitHub screen and the two steps run in parallel. Nothing before this could express that at all.

**The alternative — widening the breakdown format to carry dependencies — is not taken here and is worth someone's ruling.** It is the difference between a fourteen-step initiative that is always a chain and one whose shape the breakdown can describe. Nothing in phase 29 needs it.

**Decisions taken inside the slice.**

- **A step ticket is titled `N. <chunk title>`, and that is what a re-run matches on.** The plan hedges at "the initiative and the step's position". Position breaks the moment a human opens a child by hand; a bare title breaks on two chunks named the same. The number makes it exact, and it reads correctly on the tracker beside the breakdown's own numbering.
- **The chain is written only for a ticket this run opened.** A step that already existed already carries its relation, and writing it again is the second `blockedBy` edge case (2) forbids.
- **29c owns the hold label's creation, and says so in the code.** The plan allows either 29c or 29d and warns that both assuming the other is a defect that shows up as a claim silently not applied. It is here, at the first moment anything touches the tracker for this initiative.
- **`openStepTickets` answers rather than throws.** A tracker that fell over on the seventh create leaves six real tickets; taking the run down would turn a partial success into a failed initiative. The failure is loud in the log and the next cycle opens the rest — which is exactly case (3).
- **`createStep` sets the parent in the same call as the create.** An initiative's children are found *by* their parent, so a step that failed to be linked is invisible to the frontier while perfectly visible to a human — the worst of both.
- **`ensureLabel` swallows "already exists" and nothing else.** Any other failure travels: swallowing a 403 would turn a claim that is never applied into silence, which is the failure mode this phase watches for.
- **`ticketing.stubs.ts` is new, and its members throw.** The port grew twice in one session and eleven hand-rolled stubs paid for it each time. A silent no-op stub would let a test that *should* have opened a step pass having opened none, which is the one thing this slice cannot afford.
- **The map links its children by number.** `1. #51 — …` renders on GitHub as a live link carrying the step's title and whether it is closed, so the map shows progress without anything keeping a tally up to date.

**Validation evidence.**

`npm run build && npx vitest run src/daemon/session.test.ts` — **128 passed**, eight of them this slice's. `npx vitest run src/adapters/github-tickets.test.ts` — **47 passed**, eight of them this slice's. Both red first.

**Case (2) demonstrated red against a version without the guard**, as the plan requires — by mutation rather than by assertion. Replacing `byTitle.get(title)` with `undefined` and re-running the block:

```
✓ opens one ticket per chunk, in the breakdown's order
× opens nothing at all when it runs again
× opens exactly the missing ones after a partial failure
✓ chains each step to the one before it, as the native relation
✓ rewrites the initiative's body into a map of its steps
✓ opens every step unheld and unassigned
✓ makes sure the hold label exists before anything can apply it
✓ opens nothing when the breakdown cannot be read
```

Two red, six green — so those two are the cases carrying the idempotence, and the other six would pass against an implementation that opens fourteen more tickets every cycle.

Full suite: **1173 tests, 1169 green.**

**The plan's checks, answered.**

- **Red→green for all five, case (2) red against a version without the guard** — yes, and eight rather than five: the two claim halves and the unreadable breakdown are extra.
- **No test creates a real issue on any repository** — every adapter in these tests is a fake; the GitHub adapter's own tests go through `fakeRunner`, which throws on an unexpected call.
- **A non-zero test count** — 128 and 47, read from the runs.

**What this slice does not prove.** That anything reads the tickets it opens — 29d is the frontier's first consumer. That the hold label is ever *applied* — 29d's act. And it has never run against real GitHub: `createStep`'s argument vector is asserted, and `gh issue create --parent` was verified by hand on `scratch-app` #42/#43, but no live approval has opened a real set of step tickets. **That is 29h's job and it is the one that matters**, because this is the slice whose mistakes cannot be undone by re-running.

**A note on the suite, filed rather than carried.** Five tests now fail intermittently on a full run — all 20s timeouts, all shelling out to git, all passing alone, and all failing identically with this branch's changes stashed. Reported on [timone#8](https://github.com/fvermaut/timone/issues/8) with the counts from three runs. It is not this phase's doing and this phase cannot avoid tripping over it.

## 29d — The daemon takes the next step ticket

**Built.** The frontier decides which step gets a run. `surveyInitiatives` (`src/daemon/poll.ts`) runs once per project per cycle, before the ticket loop, and reads each initiative's step tickets with **one** query that does three jobs: it tells a step ticket from an ordinary one, it chooses the step to take, and — as a side effect, never a second call — it writes the cached picture `timone status` renders from.

**Files touched.**

- `src/daemon/steps.ts` — `MAP_LABEL`, `MAP_LABEL_DESCRIPTION`; `HELD_LABEL_DESCRIPTION` corrected.
- `src/daemon/runs.ts` — `initiativeRecordSchema`, the `initiatives` map on the state, `rememberInitiative`, `initiativeFor`, `initiativeKey`.
- `src/daemon/poll.ts` — `Frontier`, `surveyInitiatives`, the two skips and the claim in the ticket loop, `progressOfPicture`, `initiativeProgress`'s new first branch, `entryContext`'s successor test.
- `src/daemon/cta.ts` — `InitiativeProgress` stands alone.
- `src/daemon/session.ts` — 29c applies `MAP_LABEL`, last.
- `src/commands/status.ts` — `pictures` on `RenderStatusOptions`, threaded to `progressReader`; the CLI supplies it from the store.
- `runs.test.ts` (+6), `poll.test.ts` (+12), `session.test.ts` (+3).

**The finding, and it is the dangerous kind: `entryContext` routed on `run.seq > 1`.**

The plan predicted this one and it was worse than it reads. `entryContext` (`poll.ts`) used `run.seq > 1` to mean *a later piece of a list the human has already approved* — which routes the run to `planning` instead of triage. **A step's run is always `seq` 1**, because the step is its own ticket and hosts one run. So the test now answers **no for every step there is**: all fourteen pieces of a fourteen-step initiative would have entered at triage and re-interviewed the human about a list they approved before any of the tickets existed.

Being a step *is* being a successor now — the first one included, since the approval that opened it came before it. The sequence test is kept beside it for a ledger written before any of this. Two red-green cases, and a third asserting an ordinary ticket still enters at triage.

**Decisions taken inside the slice.**

- **`MAP_LABEL` is how the initiative stays out of the loop**, rather than "has children". The loop already holds every marked ticket's labels, so reading it costs nothing and adds no call; and it is **visible** — a human can see on the tracker which ticket is the map. The alternative, calling `listSteps` for every marked ticket to find out, is a query per ticket per cycle to answer a question a label answers for free.
- **29c applies it last, after every step exists.** A map with no children is a ticket nothing will ever pick up: the daemon skips it as a map and there is nothing else to take. Proved by mutation — moving the `applyLabel` above the creation loop turns exactly that case red and leaves the other two green.
- **The hold is applied at claim, and `HELD_LABEL_DESCRIPTION` was wrong.** It said *"Timone stopped this step"*, which describes only the cancel case. The label goes on the moment the step is taken, so the description now says so and still says how to hand the step back.
- **The picture carries `nextTitle`.** The renderer needs the next step's name and the ledger is the only thing it may read, so the one field it needs travels with the number. `next.index` is derived from the step's position in `steps`, not stored — one fact, one place.
- **`surveyInitiatives` never throws.** A tracker that cannot list one initiative's children leaves that initiative alone for a cycle with a line in the errors. Taking the project's whole turn down over it would stop every other ticket on it.
- **`initiativeProgress` gained a branch rather than a rewrite.** With a picture it answers from the tracker; without one it counts runs exactly as before. That second path is not dead code — it is every chore, everything run by hand, and every ledger written before this daemon started.
- **`InitiativeProgress` stops extending `ChunkProgress`.** Same three fields, different fact: they meant *chunks counted out of the ledger* and now mean *step tickets read off the tracker*. Inheriting would tie it to a type 29g deletes.

**Validation evidence.**

`npm run build && npx vitest run src/daemon/poll.test.ts` — **161 passed**, twelve of them this slice's, all red first. `src/daemon/runs.test.ts` — **126 passed**, six this slice's, all red first. `src/daemon/session.test.ts` — **131 passed**, three this slice's, both mutations catching the right case.

The four cases the plan asks for, and what they became:

1. *steps 1–2 closed → step 3 next* — **"opens a run on the first step that is not done"**, asserted on the ledger's runs, not on a comment.
2. *a cancelled run against an open step leaves that step next* — **"leaves a held step alone and takes the next one instead"**. The mechanism changed with blocker B's ruling: it is the hold label, not a count that excludes `cancelled`.
3. *a failed run still opens no new step and `timone retry` re-arms in place* — **unchanged and still passing**, because `isSettled` and `register`'s guard were not touched. R22 clause 2 does not move.
4. *every step closed → none* — **"opens nothing when every step is closed"**.

Plus eight the plan did not list: the map never gets a run; fourteen steps do not become fourteen runs; a person's takeover is respected; a blocked step is skipped whatever its position; the claim is applied; no assignee is ever written; the picture is written; and an ordinary marked ticket is untouched.

Full suite: **1196 tests, 1191 green.** The five failures are the known timeout flakes on [timone#8](https://github.com/fvermaut/timone/issues/8).

**The plan's checks, answered.**

- **All four red→green; case (3) run against the pre-change behaviour** — cases 1, 2 and 4 were written and seen red. Case (3) is the regression guard and was **not** rewritten: it is the existing suite, which passes unchanged, which is the stronger form of what the check asks for.
- **Every ledger test builds a real ledger in a temp directory; the repository's own `.timone/state.json` is never opened** — `statePath()` in `runs.test.ts` and `newStore()` in `poll.test.ts`, both `mkdtempSync` under `tmpdir()`.

**What this slice does not prove.** That a step's run ever *finishes* — closing is 29e, and `concludeInitiative` still closes `run.ticket`, which is now a step ticket rather than the initiative. **Between this slice and 29e the closing behaviour is wrong**, and deliberately so: a merged step's pull request will close the step and post the initiative's closing comment on the step ticket. It is one slice's gap on an unmerged branch, and 29e is the slice that owns it.

And nothing here has run against real GitHub.

## 29e — Closing: the step, then the initiative

**Built.** `concludeStep` (`src/daemon/poll.ts`) splits the merge path in two: a merged pull request closes **its step ticket**, with words about that step, and the initiative closes only when no step of it is open — with a comment naming what was actually delivered. `concludeInitiative` keeps its old body whole for a ticket that is nobody's step.

**Files touched.**

- `src/daemon/poll.ts` — `stepMergedComment`, `initiativeClosedComment`, `concludeStep`, and the branch at the head of `concludeInitiative`.
- `src/daemon/poll.test.ts` — a five-case `describe`.

**Decisions taken inside the slice.**

- **The tracker is asked again at close time.** The cached picture was taken by this cycle's own survey, *before* this step closed, so it cannot answer *is anything still open?*. That is one `listSteps` on the merge path — rare, and never in front of a waiting human, which is the only place ADR-0044 D5 forbids a call. Reusing the stale picture would close an initiative one step early on the cycle its last-but-one step merged.
- **Built versus dropped is read off the ledger, in the form the plan names.** A step whose run is `done` *and* carries a pull request was built; a step closed without one was dropped. `concludeInitiative` is only ever reached from `pr.state === "merged"`, so a `done` run with a `pr` is a merged pull request. No label, no comment convention, nothing for the human to remember.
- **The branch is on the picture, not on the ticket's labels.** A step ticket carries the plain mark and nothing that says *I am a step* — that is the map ticket's label, and the step does not have it. `store.initiativeFor` is the ledger's own answer and costs nothing.
- **`concludeInitiative`'s old body is untouched.** It is not dead: a chore, anything run by hand, and any ledger written before this daemon started all still go through it.

**Validation evidence.**

`npm run build && npx vitest run src/daemon/poll.test.ts` — **166 passed**, five of them this slice's.

**Case (1) needed strengthening, and the reason is worth recording.** As first written — *"closes the step and not the initiative"* — it passed against the **old** code too, because the old code closed `run.ticket`, which under 29d *is* the step. The close was the same; what differed was what got said. The old path posted `mergedComment` on it — *"this ticket's journey ends here"* — telling the human the whole initiative was over, on one piece of it. So the case now asserts the words as well as the number, and that half is what discriminates.

Mutating the split away — restoring the pre-29e single close — gives:

```
× closes the step and not the initiative when another step is open
× closes the initiative when its last step closes
✓ does not close the initiative when an earlier step is still open
× closes with the count delivered when a step was dropped
✓ leaves an ordinary ticket's closing untouched
```

Three discriminate; the control stays green, which is what the control is for. Case (3) is a guard rather than a discriminator — the old code could not close an initiative at all, so nothing about it could get case (3) wrong — and it is kept because the *new* code can.

Full suite: **1201 tests, 1196 green**, the five being the known flakes on [timone#8](https://github.com/fvermaut/timone/issues/8).

**The plan's checks, answered.**

- **All four red→green** — five, and each seen failing.
- **Case (3) asserted with a step last in file order and still open** — yes: step 52 merges while 51 is open, and the initiative stays open.
- **Case (4) asserts the closing comment's words** — yes: `"1 of 2"` and `"dropped"`, read out of the comment posted on the map ticket, not merely that it closed.
- **A non-zero test count** — 166.
- **No test closes a real issue on any repository** — every close goes to a recording fake.

**What this slice does not prove.** That any of it has run against real GitHub. **29d's deliberate gap is now closed**, so the branch is coherent again: a step is opened, claimed, built, closed, and its initiative closes after the last one.
