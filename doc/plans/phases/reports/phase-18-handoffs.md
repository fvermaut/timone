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
