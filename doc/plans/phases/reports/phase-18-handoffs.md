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
