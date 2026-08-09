# Phase 18 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 18a — the invitation offers both paths

**Built.** A ticket parked on a conversation now names two ways to answer it and prefers neither. `TerminalChannel.open`'s comment carries the copy-pasteable `timone takeover <project>#<n>` it always did, and beside it an explicit invitation to write the answer in the thread — including the promise that a partial answer is fine, that "I don't know, what do you suggest?" is a real answer, and that the machine will ask at most once more before handing back the takeover. The CTA that closes the comment names both paths and picks neither: *answer here, or run the command — whichever you prefer*. `conclude`'s unfinished branch gains the same block, so a conversation the human opened and walked away from can be finished in writing rather than only by re-running the command. `waitingOn` is untouched — what the ticket waits on is still a conversation, and only the ways of having it have grown.

**Files touched.**

- `src/channels/terminal.ts` — new module-private `invitationToAnswer(command)` returning the invitation block as lines, ending on the CTA. Called from `open()` and from `conclude()`'s `!accepted` branch, which is the plan's "one copy, used twice" made literal rather than a convention two call sites are trusted to keep. `open()` loses the two sentences that argued the terminal was the better medium ("This one needs a back-and-forth rather than a single answer, so it's better done in your terminal than in comments here") — they preferred a path, which ADR-0022 forbids. `conclude()`'s unfinished CTA loses `run \`<command>\` again` for the same reason. The class docblock records the second path and that both reach the same session.
- `src/channels/terminal.test.ts` — three tests added at the declared seams; one existing test rewritten (`ends with a CTA naming the command to run` → `ends with a CTA naming both paths and preferring neither`), which is a CTA-wording test and the only kind the plan permits changing. No test deleted.

**Decisions taken inside the slice.**

- **The invitation is a function, not a duplicated literal.** The plan fixed that the copy is one thing used twice but did not say how. A shared `invitationToAnswer` was chosen over two copies because `code-smells.md` treats a repeated block whose copies must not drift as a duplicated *decision*, and drift between `open` and `conclude` is exactly the failure 18d is scheduled to look for. It is module-private: nothing outside the file needs it yet, and an unused export would be speculative generality.
- **The code fence is not indented, and this is the one place the copy differs from the skill's template.** `timone-wayfind`'s template indents the fence two spaces so it nests inside the "Talk it through instead" bullet. The pre-existing test `expect(comment).toMatch(/```\ntimone takeover scratch-app#6\n```/)` requires a fence at column 0, and that test asserts copy-pasteability, not CTA wording — so it was not mine to change. The words are identical; only the indentation differs, and the rendered result is a bullet list followed by a standalone code block rather than a fence nested in the second bullet. **This is 18d's to reconcile, and it is a real choice, not an oversight:** either the skill's template drops the indentation to match, or the test is relaxed to accept an indented fence and both adopt the nested form. Do not "fix" one side without deciding which is right.
- **The upfront promise that the outcome lands on the ticket was kept, reworded, and moved.** `open()` used to end its prose with "When we're done, I'll write what we agreed back here." Placed after the new block it would have read as a dangling "either way"; dropped entirely it would have lost a real promise the human had. It is now one line before the block — "Whatever we settle, I'll write it back here." — outside the shared invitation, so it cannot be mistaken for template copy at 18d.
- **`waitingOn` left exactly as it was** (`"a conversation in your terminal"`). The plan's seam says what the ticket waits on has not changed, and the existing `/terminal/i` assertion is not a CTA-wording test. A test was added asserting it names a *conversation*, which is the seam the plan declared. Worth flagging for a later slice: the string still says "in your terminal" for a park that can now be resolved in writing, so the ledger's phrasing is marginally narrower than the behaviour. Not changed here, because changing it was outside what this slice was permitted to touch.

**Validation evidence.**

Baseline before any change — 13 tests, green:

```
$ npx vitest run src/channels
 ✓ src/channels/terminal.test.ts (13 tests) 2ms
 Test Files  1 passed (1)
      Tests  13 passed (13)
```

*Case 1 — the comment carries an explicit invitation to answer in the thread.* Test written first (`invites a written answer on the ticket, beside the command`), run, seen red:

```
$ npx vitest run src/channels
 FAIL  src/channels/terminal.test.ts > TerminalChannel.open > invites a written answer on the ticket, beside the command
AssertionError: expected '**I need to ask you a few things befor…' to match /two ways to answer/i
      Tests  1 failed | 13 passed (14)
```

Green with the smallest change that answers it — the invitation bullets replacing the terminal-preferring prose, the old CTA deliberately left alone so case 2 could still be driven red:

```
$ npx vitest run src/channels
 ✓ src/channels/terminal.test.ts (14 tests) 2ms
      Tests  14 passed (14)
```

*Case 2 — the CTA names both and prefers neither.* The existing CTA test rewritten, run, seen red against the old wording:

```
$ npx vitest run src/channels
 FAIL  src/channels/terminal.test.ts > TerminalChannel.open > ends with a CTA naming both paths and preferring neither
AssertionError: expected '**What I need from you:** run `timone…' to match /answer here/i
+ Received:
"**What I need from you:** run `timone takeover scratch-app#6` when you have a few minutes."
      Tests  1 failed | 13 passed (14)
```

Green after replacing the CTA line:

```
$ npx vitest run src/channels
      Tests  14 passed (14)
```

*Case 3 — the unfinished conversation offers both.* Test written, run, seen red:

```
$ npx vitest run src/channels
 FAIL  src/channels/terminal.test.ts > TerminalChannel.conclude > offers both paths again when the conversation was left unfinished
AssertionError: expected '**We didn't finish that conversation.…' to match /two ways to answer/i
+ Received:
"**We didn't finish that conversation.**

Nothing was settled, so I haven't changed anything or moved this on.

**What I need from you:** run `timone takeover scratch-app#6` again when you can pick it back up."
      Tests  1 failed | 14 passed (15)
```

Green by extracting `invitationToAnswer` and calling it from both branches — the point at which the copy became one thing:

```
$ npx vitest run src/channels
      Tests  15 passed (15)
```

*Case 4 — `waitingOn` still describes a conversation.* **This case could not honestly be driven red:** the string already contained the word, so the assertion was vacuously true before the test existed. Rather than fabricate a red, the test was proven non-vacuous by mutation — `waitingOn` temporarily changed to `"an answer in your terminal"`:

```
$ npx vitest run src/channels
 FAIL  src/channels/terminal.test.ts > TerminalChannel.open > still says the run waits on a conversation, whichever way it is answered
AssertionError: expected 'an answer in your terminal' to match /conversation/i
+ Received:
"an answer in your terminal"
      Tests  1 failed | 15 passed (16)
```

The mutation was then reverted. The test is a guard on a property the plan says must not change, and it does fail when the property does.

*The plan's validation block, run once at the end:*

```
$ npx vitest run src/channels
 ✓ src/channels/terminal.test.ts (16 tests) 2ms
 Test Files  1 passed (1)
      Tests  16 passed (16)

$ npm run type-check
> tsc --noEmit
(no output, exit 0)
```

Assertion 1 — *every existing terminal-channel test passes unchanged except those asserting the CTA's exact wording*: **met.** `git diff` on the test file shows three additions and exactly one modification, `ends with a CTA naming the command to run`, which asserted the CTA's exact wording. The other twelve pre-existing tests are byte-identical and green — including `asks the human to name no stage and no skill` (the new copy contains none of `stage `, `timone-`, `skill`, `clarification`), the fenced-command test, and both `conclude` tests that assert the command still appears.

Assertion 2 — *no test asserts that the takeover is the only instruction*: **met.** The only test that ever came close was the rewritten CTA test, whose old form required the CTA line to contain the command; nothing in the file now asserts the absence of the written path or the primacy of the command.

Beyond the block, the whole suite was run because `src/daemon/session.ts` instantiates `TerminalChannel` and could have carried a copy assertion — it does not:

```
$ npm test
 Test Files  20 passed (20)
      Tests  608 passed (608)
```

**What 18b must know.**

- The park comment 18b's pipeline posts is this one, unchanged — 18b should call `open()` and not compose its own copy.
- `takeoverCommand` is untouched, so `src/daemon/prompts.ts:604`'s use of it still behaves exactly as before.
- `invitationToAnswer` is module-private. If 18b or 18d needs the block from outside `terminal.ts`, exporting it is the right move and does not disturb anything here — but 18a deliberately did not export it on spec.
- The fence-indentation difference from the skill template (above) is the one known drift. It is 18d's decision, and 18b should not silently fix either side while editing `timone-wayfind/SKILL.md` for the label changes.

## 18b — a wayfinder ticket is a ticket the daemon knows

**Built.** A decision ticket off a wayfinder map is now a ticket the daemon recognises, picks up, and parks on a conversation — without ever triaging it as a fresh request. A marked ticket carrying `wayfinder:grilling`, `wayfinder:prototype` or `wayfinder:task` enters the pipeline at stage 2's at-scale mode instead of stage 1, opens the conversation through the same `TerminalChannel.open` invitation 18a wrote, and comes to rest in the ledger as `parked / waitingKind: "conversation" / stage: "wayfinding"` — which is precisely the state `resolveTakeover` converses on, so the `timone takeover <project>#<n>` line the skill writes onto a ticket is now an instruction the human can actually follow. `wayfinder:research` is recognised too and parks saying that machinery is not built, which is honest and is still not triage. The map itself is never marked and never becomes a run. An ordinary marked ticket is untouched: it is handed to the spawner with no entry context at all and triages exactly as before.

**Files touched.**

- `src/daemon/pipeline.ts` — two new stages. `wayfinding` (process stage 2, waits `conversation`, owns no branch, built, **nothing follows**) and `research` (process stage 2, waits `none`, owns no branch, **not built**). New exported `wayfinderStage(labels)` deriving the stage from the ticket's labels, over a module-private `WAYFINDER_TYPES` — ADR-0010's four types, with `map` deliberately absent.
- `src/daemon/poll.ts` — new module-private `entryContext(run, tickets)`: a run that has never reached a stage starts where its labels say, everything else gets `undefined`. `whatFollows` now consults the wayfinder label **before** the triage classification.
- `src/daemon/runs.ts` — `TRANSITIONS["picked-up"]` gains `"parked"` (the amendment; see below), with the reasoning recorded on the table's own docblock.
- `src/daemon/prompts.ts` — `wayfinding` added to `PROMPTED_STAGES`, and a new `wayfindingPrompt`.
- `.claude/skills/timone-wayfind/SKILL.md` — decision tickets are created with `timone` beside `wayfinder:<type>`; the map is never marked; the takeover hedge is replaced by a statement of how the path now works. Mode 1 step 4 names both labels.
- `src/daemon/pipeline.test.ts`, `poll.test.ts`, `prompts.test.ts` — additions only, no line changed or deleted. `runs.test.ts` — the lifecycle guard re-pointed (3 lines).

**The escalation, and the amendment it produced.** This slice stopped once, correctly. The plan's central behaviour was impossible as written: `runs.ts:42` declared `"picked-up": ["active", "failed"]`, so a run entering at a conversation stage — which is the whole point of the slice, since it skips triage and therefore never activates — could not park. `AgentSessionSpawner.stop` threw `Run scratch-app#5 cannot go from picked-up to parked (allowed: active, failed)`, and `runs.test.ts:97` asserted that refusal by name. Both files were outside the original grant, so the slice stopped and reported rather than patching them. The amendment (✏ 2026-08-09, re-approved by fvermaut) granted both and decided the design: `picked-up → parked` is the honest reading, because `active` means *a session is attached* — `activate` takes a session id — and a conversation park attaches none. Activate-before-conversation was rejected: it would mint an id for a session nobody started and `timone status` would call the run running for as long as the human took to answer. The guard at `runs.test.ts:97` was **re-pointed, not deleted**, onto `queued → parked`, which stays illegal — a run still queued behind another has not begun, so it cannot be waiting on anyone.

**Decisions taken inside the slice.**

- **`research` is declared and unbuilt, rather than left out.** The plan originally said research "resolves unattended"; it cannot, because `session.ts`'s `afterStage` ends in a fall-through assuming the only remaining wait-free stage is triage, and would fail a research run with "triage recorded no classification". `session.ts` was not in the grant, and teaching it a third shape is bigger than this phase. Declaring the stage anyway is what keeps a marked research ticket from being *triaged*: it parks and says the machinery is not built. The orchestrator accepted this and the plan now says so; the unattended path is deferred, not dropped.
- **The wayfinder type is never stored on the run.** `wayfinderStage` reads the labels every time. A copy in the ledger is a copy that can disagree with a label a human just changed, and this phase adds no state fields — phase 17's witness fields are untouched.
- **`whatFollows` reads the map before the classification.** The two labels genuinely coexist: a ticket triaged before anyone decided to chart it keeps its `triage:<kind>`. Routing on that would send a decision question off to have its requirements written, so what the ticket has *become* wins.
- **The wayfinding prompt does not instruct `CONVERSATION_RECORD_MARKER`.** `stageAfter("wayfinding")` is undefined, so `concludeConversation` returns `finish` and `resolveWait` returns undefined — the marker would fire nothing today. Left out rather than added on spec. **This is 18c's to decide** (see below).
- **`WAYFINDER_TYPES` is module-private.** Nothing outside `pipeline.ts` needs it; an unused export is the speculative generality `code-smells.md` names.
- **The skill gained a note that `research` tickets should be closed in the session that fires them**, because a marked, open research ticket would park with a comment contradicting its own "I'm resolving this one myself" CTA. Narrow edge, but the skill and the code now agree.

**Validation evidence.**

*Baseline.* The tree was **not** at the brief's stated 608 — it carried 622 tests across the four files 18b touches, an earlier attempt's uncommitted work. It was saved to `/tmp/18b-wip.patch` and reset to `HEAD`, recovering 608, so every red below is reproducible from the stated baseline.

*Case 1 — the graph knows a wayfinding stage.* Test written first, red:

```
TypeError: Cannot read properties of undefined (reading 'processStage')
 ❯ processStage src/daemon/pipeline.ts:314:24
```

Green with the `wayfinding` row alone — 39 passed.

*Case 2 — `wayfinderStage` reads the type off the labels.* Seven assertions written, all red:

```
× wayfinderStage > sends a grilling decision ticket to the wayfinding conversation
  → (0 , wayfinderStage) is not a function      [×7]
```

Green with `WAYFINDER_TYPES`, `wayfinderStage` and the `research` row — 46 passed.

*Case 2b — the research row.* **Could not honestly be driven red:** the row arrived as part of case 2's green, since `wayfinderStage` cannot return `"research"` unless the stage exists. Proved non-vacuous by mutation instead — `waits` flipped to `"conversation"`:

```
× leaves a research ticket unattended, and says plainly it is not built yet
  → expected 'conversation' to be 'none'
```

Mutation reverted; 47 passed.

*Case 3 — a marked `wayfinder:grilling` ticket parks on a conversation, never triaged.* Written against the **real** `AgentSessionSpawner` over a fake tracker and a runtime that throws if called — "it parks on a conversation" is a claim about the stage graph, the channel and the ledger together, and a fake spawner could only restate it. Red:

```
× parks on a conversation at stage 2, without ever being triaged
  → expected 'triage' to be 'wayfinding'
× invites the human with the channel's own words
  → expected '**Picked this up.**…' to match /two ways to answer/i
```

`entryContext` moved it to `expected undefined to be 'wayfinding'`, which exposed the lifecycle blocker and the escalation above. Green after the amendment:

```
{"id":"scratch-app#5","status":"parked","waitingOn":"a conversation in your terminal",
 "waitingKind":"conversation","stage":"wayfinding"}   errors: []
```

*Case 3b — the re-pointed lifecycle guard.* The table change made the old guard fail (`expected [Function] to throw an error`), as the amendment anticipated. Re-pointed onto `queued → parked` and proved non-vacuous by mutation — `queued: ["picked-up", "parked"]` reproduced `expected [Function] to throw an error`; reverted, 71 passed.

*Case 4 — an ordinary marked ticket starts where it always did.* Green on arrival (`entryContext` already existed), so proved by mutation — `entryContext` made to return `{ stage: "triage" }` for non-wayfinder tickets:

```
→ expected [ { stage: 'triage' } ] to deeply equal [ undefined ]
```

Reverted.

*Case 5 — an unmarked wayfinder ticket produces nothing.* **Genuinely vacuous, and no mutation can fix that**: the permission boundary lives in `listMarkedTickets`, which this slice does not touch, and no change inside `poll.ts` could make an unlisted ticket produce a run — which is exactly the property being guarded. Kept as a regression guard because it pins something the existing "touches nothing when no ticket carries the mark" does not: that a `wayfinder:` label buys **no exemption** from the mark. Stated plainly rather than dressed as a red.

*Case 6 — an old triage park resumes onto the map.* Red:

```
× resumes an old triage park onto the map, not into the build pipeline
  → expected [ { stage: 'clarification' } ] to deeply equal [ { stage: 'wayfinding' } ]
```

Green once `whatFollows` consulted the wayfinder label first — 56 passed.

*Case 7 — the at-scale prompt, and the takeover.* Four red:

```
→ expected [ 'triage', 'clarification', …(6) ] to include 'wayfinding'
→ expected '…' to match /at the keyboard/i
→ expected '…' to contain 'timone-wayfind'
→ expected '…' to match /close/i
```

Green with `PROMPTED_STAGES` + `wayfindingPrompt` — 113 passed, including the eight generic `it.each(PROMPTED_STAGES)` rules the new stage inherits by existing.

*The plan's validation block, run once at the end:*

```
$ npx vitest run src/daemon src/commands/takeover.test.ts
 Test Files  10 passed (10)
      Tests  476 passed (476)

$ npm run type-check
> tsc --noEmit
(no output, exit 0)

$ npm run build && node dist/cli.js takeover --help
Usage: timone takeover [options] <ticket>
Pick up a ticket that is waiting to talk something through
...
EXIT=0
```

`dist/` was rebuilt first, deliberately: the assertion is that the command still runs *with this slice's changes in it*, and running a stale binary would have asserted nothing.

Assertion 1 — *the wayfinder run's ledger entry names stage 2 and `waitingKind: "conversation"`*: **met.** `parks on a conversation at stage 2, without ever being triaged` asserts `stage === "wayfinding"`, `processStage("wayfinding") === 2`, `waitingKind === "conversation"`, `status === "parked"` and `branch === undefined`, against the real spawner and the real ledger.

Assertion 2 — *no existing triage test changes behaviour*: **met.** `git diff --numstat` on the three test files in the original grant is `63/0`, `164/0`, `31/0` — additions only, not one line changed or deleted. `runs.test.ts` is `11/3`, the three being the guard the amendment authorised re-pointing. Whole suite: **636 passed across 20 files**, from a 608 baseline.

> **✏ Added by the orchestrator at the gate, because the slice could not have seen it.** Re-running the block independently, the whole suite failed **one test on one run** and then passed seven consecutive times (636/636). The failure's identity was not captured — the summary had scrolled past the tail that was read — so it is recorded here as an unidentified intermittent rather than named or explained away. It was not in `src/daemon` or `src/commands/takeover.test.ts`, since 18b's own block was re-run green on its own several times. Nothing was changed on account of it. **Stage 7 should treat it as a known observation to watch, not as a settled fact**; the likeliest candidates are the guardrail tests, which drive real `git` in temporary repositories under parallel workers.

**What 18c must know.**

- **A resolved wayfinder run stays parked, and that is unfinished business.** `stageAfter("wayfinding")` is undefined, so `concludeConversation` returns `finish` and `resolveWait` returns `undefined` — the run never leaves `parked` even after the session posts its resolution and closes the ticket. Nothing breaks (a closed ticket leaves `listMarkedTickets`, so nothing re-registers), but the ledger accumulates parked runs for resolved tickets. Deciding what ends a wayfinding run — and whether `CONVERSATION_RECORD_MARKER` is what the daemon should read for it — is 18c's, and I deliberately did not instruct that marker in the prompt so 18c is not stuck with a convention chosen by accident.
- **The park cursor is `waitCursorFrom(after)`,** taken after the invitation is posted — so only comments *after* the machine's question can be the answer. That is exactly the seam a written answer has to be read against; it is already correct and needs no change.
- **`entryContext` only fires for a run with no recorded stage.** A run already parked at wayfinding resumes from the ledger, not the label, so 18c's written-answer pickup must go through `resolveWait`'s `waitingKind === "conversation"` branch, not through entry routing.
- **`timone status` renders a wayfinding run as `(wayfinding)`** — `STAGE_LABELS` has no entry and falls back to the raw stage name, same as triage and clarification. Not broken, but if the back half's stages earned a phrase, this one probably should too.
- **The fence-indentation drift 18a recorded is untouched.** I edited `SKILL.md` only where 18b required it and left both CTA template blocks byte-identical. Still 18d's to reconcile.

## 18c — a written answer moves the ticket

**Built.** A ticket parked on a conversation is now genuinely answerable in writing. A human comment posted after the park is picked up by the daemon, carried to the conversation's **own** stage as the human's words, and the daemon **starts a session for that stage** — which it could not do at all before this slice. That session is told, truthfully, that nobody is reading along; it is handed what they wrote as an *answer* rather than as a gate's change request; and it is bounded at **one clarifying round**, after which it hands back the takeover instead of typing at them a third time. Three endings are judged from the ticket: settled advances (or **completes** the run, at a stage nothing follows), unsettled re-parks on a conversation with a **fresh cursor** — which is what makes the resume once-only — and a handback is the same ledger state with different words on the ticket. The machine's own follow-up question can never be read as the answer, and a quiet park stays exactly where it is, cycle after cycle.

**The escalation that produced this slice, and the amendment it earned.** This slice stopped once before it was built, and was right to. A previous context proved end-to-end — real `AgentSessionSpawner`, real ledger, fake tracker, a human comment sitting past the park cursor — that `session.ts:447` short-circuited *unconditionally* (`if (!runsUnattended(stage)) { await this.openConversation(...); return; }`), so a run resumed with an answer in hand did not ingest it: it **re-posted the whole "Two ways to answer this" invitation and re-parked**, the precise failure ADR-0022's written path exists to prevent. The graph blocked it a second way — `UnspawnedStage` *forbade* a conversation-waiting stage from declaring a model, and `runStage` fails a run loudly without one. Four production files were needed that the plan had not granted, so the slice reported instead of quietly patching, the phase's stamp reverted to `Awaiting approval` a second time, and fvermaut re-approved an amendment that named the files **and settled four design questions** so this slice did not have to. Its uncommitted output — `poll.ts`'s `writtenAnswer`, four seam tests and one deliberately-red wall test (`starts a session carrying the answer, rather than asking again`) — was inherited and continued, not restarted. That red test is the executable statement of the wall, and turning it green is the centre of what follows.

**Files touched.**

- `src/daemon/pipeline.ts` (+33/−13) — `UnspawnedStage` loses its `{ built: true; waits: "conversation" }` arm and is now just `{ built: false }`; `SpawnedStage.waits` drops its `Exclude<WaitKind, "conversation">`. `clarification` and `wayfinding` each declare `claude-opus-5` / `high`. `runsUnattended` keeps its behaviour exactly and gains a docblock saying what it now answers: *does the daemon start this stage **of its own accord***.
- `src/daemon/session.ts` (+77/−3) — the three changes the amendment named. `spawn`'s short-circuit becomes `if (!runsUnattended(stage) && feedback === undefined)`. `afterStage` gains a conversation branch **before** the triage-classification fall-through, delegating to a new `afterConversation`. `runStage` now returns the `cursor` it started from, so the record and the outcome markers are read from one instant.
- `src/adapters/ticketing.ts` (+14/−0) — `CLARIFICATION_MARKER`, beside its five siblings.
- `src/daemon/gates.ts` (+24/−0) — `clarifyingRounds(thread)`, beside `readConversationRecord`.
- `src/daemon/prompts.ts` (+136/−16) — new module-private `conversationOpening(context)` and `writtenAnswerBlock(context)`; both conversation prompts rebuilt on them; `wayfindingPrompt` now instructs `CONVERSATION_RECORD_MARKER`. `PromptContext.feedback`'s docblock widened.
- `src/daemon/poll.ts` (+113/−7) — `writtenAnswer` reconciled to the amendment (joins, no longer newest-wins); new `concludeLastConversation` beside `concludeReview`.
- Tests: `poll.test.ts` (+250/−0, additions only), `session.test.ts` (+170/−0, additions only), `gates.test.ts` (+29/−1), `prompts.test.ts` (+106/−4), `pipeline.test.ts` (+27/−5). `src/adapters/github-tickets.test.ts` was granted and **not touched**: the marker needs no adapter change, since a comment carrying it starts with `MACHINE_MARKER` like every other machine comment and `isMachineComment` already answers for it.

**Decisions taken inside the slice.**

- **The written answer travels in `SpawnContext.feedback`, not a new field.** It is one fact — the human's words, handed to the stage that must act on them — and the two readings are told apart by *which stage* is being prompted, not by which field carried them. A gate stage frames it through `feedbackBlock` ("they asked for a change"); a conversation stage frames it through the new `writtenAnswerBlock` ("they answered"). A second field would have made the spawner's fall-through condition and the prompt's framing two facts free to disagree.
- **`writtenAnswerBlock` is a separate block from `feedbackBlock`, not a parameter on it.** A gate's feedback is a rejection of something the session produced; a written answer is a reply to a question the session asked. Rendering the second as the first would have the session apologise for a document nobody complained about, and the *bound* has no meaning at a gate.
- **The bound lives in the prompt, and that is the whole of what is guaranteed.** No code decides "settled" — the phase forbids it and ADR-0022 says the judgement is the session's. What is executable is the shape of the instruction: with no round spent, the prompt authorises exactly one marked question; with one spent, that authorisation is *gone* and the takeover command is in its place. `clarifyingRounds` reads the round off the thread, so the count and the comments a human is looking at cannot disagree.
- **`clarifyingRounds` is deliberately not cursor-relative**, unlike everything else in `gates.ts`. The others answer "has *this wait* been answered"; this answers "have I already asked again about this ticket". A fresh cursor is written on every re-park, so scoping the count to one would reset the bound on the very move that spends it.
- **"Not settled" and "handed back" are one ledger state and two comments.** Both re-park on a conversation; the difference is what the human reads. Distinguishing them in the ledger would require the daemon to decide which one happened, which is deciding "settled" — exactly what no slice may do.
- **The fresh cursor is written by the spawner, never by `poll.ts`.** Whoever ran the session owns the fact of when it finished; the poll loop cannot write it for a session it did not run without holding a second copy of it.
- **`concludeLastConversation` mirrors `concludeReview` rather than widening `resolveWait`.** Ending a run is not "what should this run do next", and `resumeAnswered` already carries one such pre-step for exactly this reason. It costs one extra `getTicket` per conversation-parked run per cycle — precisely the shape, and the cost, that `concludeReview` already has.
- **The takeover's opening was kept, not deleted.** `PromptContext.interactive` already existed and was already set by `takeoverPrompt`; it had simply never been read. The "at the keyboard" framing is true for a session a human opened and is preserved verbatim for that case.

**Two tests re-pointed, none deleted.**

- `pipeline.test.ts` → `declares nothing for a stage no session is ever started for` asserted `modelFor("clarification")` is undefined, on the reasoning that `spawn()` short-circuits before `runStage`. The amendment overturns that reasoning by name. Re-pointed onto `research` and `feedback`, where the property still holds, and the reason for the move recorded in the test.
- `prompts.test.ts` → `tells the session someone is present and waiting` (both conversation prompts) asserted `/at the keyboard/i` unconditionally. Re-pointed onto `{ ...context, interactive: true }`, which is when it is true. Both remain guards on real properties.

**Validation evidence.**

*Baseline.* 636 green across 20 files at `eaf20f5`, plus the inherited uncommitted work: 639 green + **1 red** (the wall test), type-check clean. Confirmed before touching anything:

```
$ npx vitest run src/daemon
 × pollOnce — a written answer reaches a session that ingests it > starts a session carrying the answer, rather than asking again
   → expected [] to have a length of 1 but got +0
      Tests  1 failed | 458 passed (459)
```

*Case 1 — every comment after the park joins to make the answer.* The amendment's fourth settled question, overriding the "newest comment" wording the inherited `writtenAnswer` was built to. Test written first, red:

```
$ npx vitest run src/daemon/poll.test.ts -t "joins every comment"
AssertionError: expected 'and only ever on the long ones' to contain 'it\'s the draft they lose'
      Tests  1 failed (61)
```

Green by replacing `.at(-1)` with the review park's own join (`\n\n---\n\n`) — 60 passed, the wall test still the only red.

*Case 2 — a conversation stage declares a model.* Red:

```
$ npx vitest run src/daemon/pipeline.test.ts -t "same pair as planning"
AssertionError: expected undefined to be 'claude-opus-5'
```

Green with the two rows and the `UnspawnedStage` change. This is where the old guard failed (`expected 'claude-opus-5' to be undefined`) and was re-pointed; 48 passed, `tsc --noEmit` clean — `pipeline.ts` expresses a finished thought again.

*Case 3 — the spawner runs the stage instead of re-inviting.* Red:

```
$ npx vitest run src/daemon/session.test.ts -t "ingesting a written answer"
× runs the conversation stage instead of re-inviting, when the answer is in hand
  → expected [] to have a length of 1 but got +0
```

The conditional at `:447` moved it on to a *different* red — the session now started, but an invitation was still posted, because `afterStage` fell through to the triage-classification read. That is the trap 18b predicted, arriving exactly where it said it would.

*Case 4 — `afterStage`'s conversation branch.* Three cases written, all red, and the third is the amendment's prediction verbatim:

```
× runs the conversation stage instead of re-inviting  → expected '**I need to ask you a few things…' not to match /two ways to answer/i
× advances a clarification the session recorded as agreed  → expected 'clarification' to be 'requirements'
× completes a wayfinding run once its one decision is recorded  → expected 'failed' to be 'done'
```

That `'failed'` is `triage recorded no classification` — a wayfinder ticket carries no `triage:` label, so the fall-through killed the run. Green with `afterConversation`: 85 passed, type-check clean.

*Case 4b — the fresh cursor.* `re-parks on the conversation, with a fresh cursor` **passed before the implementation**, via the wrong path: the classification read routed back to clarification and `openConversation` re-parked with a cursor that happened to match. Proved non-vacuous by mutation — `waitCursorFrom(ticket)` replaced by the session's own start cursor:

```
× re-parks on the conversation, with a fresh cursor, when nothing was settled
  → expected '2026-08-01T09:00:00Z' to be '2026-08-02T11:00:00Z'
```

Mutation reverted. Its sibling (`not.toMatch(/two ways to answer/i)`) is what pins that the re-park is not a re-invitation.

*Case 5 — the clarifying round, counted on the ticket.* Three assertions, red:

```
$ npx vitest run src/daemon/gates.test.ts
TypeError: (0 , clarifyingRounds) is not a function   [×3]
```

Green with `CLARIFICATION_MARKER` and `clarifyingRounds` — 37 passed.

*Case 6 — the prompts.* Eleven red at once (both conversation stages × five rules, plus the wayfinding record marker):

```
× the wayfinding prompt > marks the resolution so the machinery knows the run is over
  → expected '…' to contain '✅ **Agreed** · the record of a conver…'
× clarification/wayfinding does not claim anyone is at the keyboard when nobody is
  → expected '…' not to match /at the keyboard/i
× clarification/wayfinding carries what they wrote, as an answer
  → expected '…' not to match /asked for a change/i
× clarification/wayfinding forbids re-asking what the answer already settles
  → expected '…' to match /do not ask .*again|already answered/i
× clarification/wayfinding allows exactly one more question, marked so it can be counted
  → expected '…' to contain '❓ **Still open** · written by the mac…'
× clarification/wayfinding hands back the takeover instead of asking a third time
  → expected '…' to match /not ask (them )?again|no more questions|third/i
```

**Two assertions I had written were wrong, and were corrected rather than coded around** — both were mine, authored this turn and never green:

1. `toMatch(/nobody is at the keyboard|…/)` sat one line under `not.toMatch(/at the keyboard/i)` and could never both hold. Replaced with `/in writing/i` + `/comment/i`.
2. `not.toContain(CLARIFICATION_MARKER)` on the second-round prompt is unsatisfiable *and wrong*: the marker is in the prompt because the prompt renders the thread, which is how the round was counted in the first place. What must be gone is the **authorisation** to spend another, so it became `not.toMatch(/you may ask/i)`, with the reason on the test.

Green after `conversationOpening` + `writtenAnswerBlock` + the wayfinding record instruction — 124 passed. The bound's branch proved non-vacuous by mutation (`spent === 0` → `true`):

```
× clarification/wayfinding hands back the takeover instead of asking a third time
  → expected '…' to contain 'timone takeover scratch-app#6'
```

Reverted.

*Case 7 — a resolved wayfinding run ends.* The takeover's half of settled question 3. Red, and it is 18b's "parks forever" symptom exactly:

```
$ npx vitest run src/daemon/poll.test.ts -t "last thing it had to decide"
AssertionError: expected 'parked' to be 'done'
```

Green with `concludeLastConversation` — 481 passed in `src/daemon`.

*The plan's validation block, run at the end:*

```
$ npx vitest run src/daemon
 Test Files  9 passed (9)
      Tests  481 passed (481)

$ npm test
 Test Files  20 passed (20)
      Tests  662 passed (662)

$ npm run type-check
> tsc --noEmit
(no output, exit 0)
```

Assertion 1 — *the full suite is green*: **met.** 662 passed across 20 files, from a 636 baseline (+26), with the inherited red now green. Run twice end-to-end, 662/662 both times; 18b's unidentified intermittent did not reappear, which is evidence of nothing either way and is recorded as such.

Assertion 2 — *the parked-and-quiet case is asserted across two consecutive cycles, not one*: **met.** `leaves a quiet conversation park where it is across two consecutive cycles` (inherited, kept) calls `pollOnce` twice over the same deps and asserts on both results: `first.resumed` and `second.resumed` both empty, nothing spawned, **nothing posted**, the run still `parked`, and the cursor still the invitation's. The no-posting assertion is the one that would catch a re-invitation loop.

Beyond the block, `npm run build && node dist/cli.js takeover --help` was run against a freshly built `dist/` (exit 0), because both conversation prompts changed and `timone takeover` is the path that renders them for a human.

**What 18d must know.**

- **The fence-indentation drift is still untouched, and is still yours.** Nothing in `.claude/skills/` or `src/channels/terminal.ts` was edited by this slice. Note that `prompts.ts` now emits its *own* fenced takeover command in the second-round handback block — that is prompt text instructing a session, not channel copy, and it is deliberately at column 0. Do not sweep it into the template reconciliation without deciding it belongs there.
- **`CLARIFICATION_MARKER` is a sixth marker on the ticket surface** and a human will see it. Its wording (`❓ **Still open** · …`) got no more scrutiny than its siblings' did; if 18d is reviewing what a human actually reads, it is in scope.
- **`afterStage` now takes seven positional parameters, and that is one too many.** Refactoring was deferred per the stage's rules. The right move is to pass `runStage`'s result object through rather than spreading it — `(run, project, stage, result)` — which also stops the next slice from having to thread an eighth.
- **Two `getTicket` calls per conversation-parked run per cycle**, since `concludeLastConversation` and `resolveWait` each fetch. This exactly mirrors `concludeReview`/`resolveWait`'s existing double-fetch, so the fix is one refactor covering both, not a patch on the new one.
- **`waitingOn` still says "a conversation in your terminal"** on a re-park, carried forward from the original park. 18a flagged the same string as marginally narrower than the behaviour now that a park can be resolved in writing. This slice did not widen it — changing it was no more in scope here than there — but two slices have now noticed it, which is usually the point at which it should be decided rather than noticed a third time.
- **Nothing was added to the run state.** Phase 17's witness fields are untouched, and the clarifying round is counted on the thread, not in the ledger.

## 18d — the words the human reads

**Built.** The two documents a human actually reads now say what 18a–18c made true. `README.md`'s back-and-forth section states that a ticket waiting on you offers **two ways to answer and prefers neither**, that both reach the same session and produce the same record, that a written answer is read exactly as a gate reply is (any comment of yours after the question, no keyword) and need not be complete — and it carries the bound *with its reason*, which is the sentence ADR-0022 exists to justify: comment ping-pong was ruled out because the failure is gradual, so the written path degrades toward the terminal rather than growing a thread. A new paragraph says a map's decision tickets carry the same `timone` mark as everything else, are recognised as questions asked *of* the human rather than fresh requests, and park waiting — which is what makes `timone takeover <project>#<n>` work on them where it refused before — with the map itself never marked, and the `prototype` / `research` types named honestly as the two narrower cases. `STATUS.md` gets a new top entry saying the machine now does what this morning's instructions promised, what it has not yet proven, and one live consequence nobody had written down: **the nine `ivtrends` tickets this phase exists for do not carry the mark, so nothing picks their answers up yet.**

**Files touched.**

- `README.md` — the `### The two ways you get asked something` lead and its second bullet rewritten; two paragraphs added (the bound, and the map). No other section touched; the `Status` narrative was deliberately left alone, since this slice's grant is the back-and-forth section.
- `STATUS.md` — header `Last updated` parenthetical rewritten; new `## Just finished — you can answer by just writing back`; the previous top entry demoted to `## Before that — a ticket you can just answer` per the file's own convention; the phase-18 approval line under *Waiting on you* struck through and closed; a second ask added under the three trading-app questions.
- `doc/plans/phases/reports/phase-18-handoffs.md` — this section.

**Decisions taken inside the slice.**

- **The CTA-drift assertion is met, and the difference is recorded rather than glossed** (evidence below). Neither `SKILL.md` nor `terminal.ts` was edited, which is also what the grant allowed.
- **The README states the bound's *reason*, not just the bound.** ADR-0022's whole argument is that one clarifying round is what keeps the written path from becoming the thread ADR-0012 struck out. A README that says "you get asked once more" without saying why reads as an arbitrary limit and invites the next reader to relax it.
- **`prototype` and `research` are named in the README rather than swept under "watched like any other".** "Every conversation ticket offers both paths" is false for `prototype` by ADR-0022's own wording, and `research` asks the human for nothing. Two clauses cost less than a sentence a reader could catch out.
- **`STATUS.md` says the phase is built and *not* verified or signed off.** The file's convention distinguishes these consistently (phases 14–17 each name what was held back), and the phase has had no stage-7 pass. It also says the 662 checks are fixture-level and that no real question has been answered this way yet.
- **The unmarked `ivtrends` tickets are reported, not fixed.** Checked directly: `gh issue list` on `projects/ivtrends` returns nine open `wayfinder:*` tickets and the map, and **not one carries `timone`**. So 18b's routing never fires on them and 18c's written pickup never sees their comments — the machinery is live but inert on the exact tickets ADR-0022 was written about. Labelling them is outside this slice's grant and is a *permission* the human gives (README: "the `timone` label is a permission boundary"), so `STATUS.md` asks for the word rather than taking it. It also notes that the hand-written blocks in those bodies still say the takeover is unavailable, which is now false.
- **No stage numbers, skill names or process nouns entered either file.** ADR links stay, because both files already cite ADRs throughout and they are the reader's route to the reasoning.

**Validation evidence.**

**No behaviour-carrying code in this slice, so no seams were declared and there is no red-green trace; validation is checklist-based.** The plan's block, run as written:

```
$ grep -n "answer" README.md | head          # lines cut at 120 chars here; five matches, not truncated by head
74:- **A single decision — answered on the ticket.** When Timone wants approval, it posts what it wrote, links the artif
75:- **A back-and-forth — answered whichever way suits you.** When a step needs an interview rather than a single answer
77:**The written path is bounded at one more question, and the bound is the whole reason it is allowed.** Comment ping-p
79:**An idea too big for one sitting is charted as a map of questions — and those tickets are watched like any other.**
81:One session per project runs at a time, always. A parked ticket only blocks the others once it owns a work branch — s

$ npm test
 Test Files  20 passed (20)
      Tests  662 passed (662)
   Duration  33.07s
```

Type-check also run (not in the block, cheap): `npm run type-check` → no output, exit 0. Both match the stated baseline exactly — 662 across 20 files at `62f69ea` — so nothing outside these files broke, and 18b's unidentified intermittent did not reappear (evidence of nothing either way, recorded as such).

**The assertion — *the skill's CTA template and `TerminalChannel.open`'s comment say the same thing in the same words*: MET.** Judged mechanically rather than by eye: `SKILL.md`'s `grilling`/`task` template (lines 86–97) was extracted and compared line-by-line against the array `invitationToAnswer` returns, with `<project>#<n>` as the command.

```
skill lines: 12   channel lines: 12
~ line 5: INDENT ONLY  skill="  ```"
~ line 6: INDENT ONLY  skill="  timone takeover <project>#<n>"
~ line 7: INDENT ONLY  skill="  ```"
~ line 9: INDENT ONLY  skill="  You don't need to tell it anything else — it works out what this ticket is waiting for."

indent-only differences: 4
word differences: 0
```

Twelve lines each, in the same order. **Every difference is a leading two-space indent and nothing else**; strip it and the two are byte-identical, promise for promise — same "two ways", same "you don't need to answer every part", same *"I don't know, what do you suggest?"*, same one-more-round bound, same closing CTA. 18a's record is accurate and slightly understated: the nesting covers four lines, not just the fence — the fence, its content, its closing, and the follow-up sentence, all of which belong to the same nesting decision.

What each renders as: in the **skill's** form the code block and the "you don't need to tell it anything else" line are indented into the *Talk it through instead* bullet, so they render as that bullet's continuation — one two-item list with the command inside item two. In the **channel's** form the list ends at item two's colon and the fence and sentence are top-level blocks after it — the same two bullets, then a standalone code block. On GitHub both render a real fenced block with a copy button; the command is copy-pasteable in both, which is the property the pre-existing test guards. The difference is association and left margin, not words.

Therefore, per the slice's own instruction: **not a defect in 18a, and neither side was edited.** For whoever reconciles it later, the cheap options are unchanged — indent the channel's fence and relax `terminal.test.ts`'s `/```\ntimone takeover scratch-app#6\n```/` to tolerate leading spaces, or drop the skill's two spaces. Both are cosmetic; nothing downstream reads the indentation.

**What delivery must know.**

- **The docs describe built-but-unverified behaviour.** `STATUS.md` says so in as many words. If stage 7 finds the written path behaves otherwise, that entry is the thing to correct, not the README bullet.
- **The `ivtrends` mark gap is the phase's live loose end.** Nine open `wayfinder:*` tickets, none marked `timone` — so the very tickets ADR-0022 cites are still unreachable by the machinery this phase built. `STATUS.md` asks the human for the word; nothing else in the repo tracks it, and a delivery PR is a reasonable second place to say it. Marking them will also *add* a real invitation comment to each ticket while the hand-written block in each body still says the takeover is unavailable — the two would contradict for as long as the bodies are left alone, which is why the ask is phrased as "mark them **and** replace their blocks", one action.
- **The fence-indentation drift is judged and closed** (above). It is a formatting choice, recorded with what each renders as; it is not an open defect and needs no fix to ship.
- **Three items earlier slices flagged remain open and are not this slice's:** `waitingOn` still reads "a conversation in your terminal" for a park that can be answered in writing (flagged by 18a and 18c — noticed twice, so worth deciding rather than noticing a third time); `afterStage` takes seven positional parameters; `CLARIFICATION_MARKER`'s wording (`❓ **Still open** · …`) is a sixth marker a human will read and got no more scrutiny than its siblings. This slice read all three and touched none — every one lives in `src/`, which was not granted.
