# Phase 45 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 45a — Each piece says what it needs, and the order reads in plain words

**Built.** `parseBreakdown` now reads the indented `Needs:` line under each piece into `Chunk.needsLine`, verbatim, and changes nothing else: titles, descriptions, stamps and every `malformed` case are as before. `renderBreakdown` writes the line back as `   - Needs: <text>`, so the round trip keeps it. Two new pure exports read the order: `orderOf(breakdown)` returns `{ kind: "clear", needs, words }` or `{ kind: "unclear", reason }`, and `orderInWords(needs)` gives the wording alone. A missing line means "the piece above" (nothing for piece 1). A line naming the piece itself, a later piece, a number not in the list, or no number (other than "nothing"/"none…") is refused with a reason that names the piece and quotes the line. The committed #197 list reads "1 and 2 together, then 3, then 4 and 5 together. 6 needs none of the others."

**Files touched.**

- `src/daemon/breakdown.ts` — `Chunk.needsLine?`, the `NEEDS_LINE` pattern, `parseBreakdown` fills it, `renderBreakdown` writes it, new exports `PiecesOrder`, `orderOf`, `orderInWords`, and private helpers for reading a line, grouping, levels and wording.
- `src/daemon/breakdown.test.ts` — 15 new cases (cases (1)–(8) of the plan, plus two extras listed below). No existing test changed.
- `doc/plans/phases/reports/phase-45-handoffs.md` — this file.

**Decisions taken inside the slice.**

- **Where a `Needs:` line is looked for.** A list line (`-` or `*`) with at least one space of indentation, between a piece line and the next piece line. The label may be bold (`**Needs:**` or `__Needs:__`). Only the first such line under a piece counts. A `Needs:` line before the first piece belongs to nothing and is ignored. Leading and trailing spaces of the text are dropped; the rest is kept as written.
- **The key is left out, not set to `undefined`, when a piece has no line.** Callers that compare chunks with `toStrictEqual` see the same objects as before.
- **First sentence** = the text up to the first full stop followed by a space or the end of the line. With no such full stop, the whole line.
- **"nothing" / "none".** A first sentence that starts with the word "nothing" or "none" (any case) reads as `[]`, whatever follows it in that sentence. This follows the plan's words literally. A sentence such as "none except piece 2" would read as `[]`; nothing written so far looks like that.
- **Numbers.** Every run of digits in the first sentence, each once, ascending. 0 counts as "not in the list".
- **Order of the refusal checks**, when one line has several faults: no number, then a number not in the list, then the piece itself, then a later piece. Only the first fault found is reported, and only for the first unreadable line from the top.
- **Reason wording**, for example: `piece 2's Needs: line "piece 3." names piece 3, which comes after it — a piece can only need pieces above it`. The other three end "names piece 2 itself — …", "names piece 9, which is not in the list — the list has 3 pieces", and "names no piece — write the numbers of the pieces it needs, or \"nothing\"". The tests check the piece number and the quoted line. The not-in-the-list case also checks "not in the list", because otherwise its first implementation would have reported 9 as "a later piece".
- **A list of one piece reads "1."**, not "1 needs none of the others." There are no others to name. A one-piece group gets the "needs none of the others" sentence only when the list has more than one group. ticket-128.md is such a list. This needed its own test (extra case A below).
- **Sentences.** Each group gives one sentence ending in a full stop. Groups are joined by one space, in the order of their lowest piece. A group's "N waits only for …" sentences follow its own sentence, in piece order.
- **What "waits only for" names.** All of the piece's direct needs, listed as "2", "1 and 3", or "1, 2 and 3", including needs from levels lower than the one just before it.
- **Case (7) names the four files** instead of listing the directory, so a list committed later does not make the test fail or change what it checks.
- **Extra case B: a bold label.** The plan says the label may be bold, so I added one test at the `parseBreakdown` seam for it.

Refactor I would do but did not, because it is outside the slice: `breakdown.ts` has three blank lines before `isReproposal` (from before this slice). My new code sits after them, so they now come before `PiecesOrder`.

**Validation evidence.**

Each case was written alone and run with `npx vitest run src/daemon/breakdown.test.ts -t "<name>"`.

1. *"reads 2 and 3 needing 1, and 4 needing 2 and 3, as levels"* — red: `TypeError: (0 , orderOf) is not a function`. Green after `needsLine` parsing, `orderOf` and the level wording.
2. *"reads the committed list of ticket 197 as its writer wrote the order by hand"* — red: `"words"` expected `1 and 2 together, then 3, then 4 and 5 together. 6 needs none of the others.`, received `1, 2 and 6 together, then 3, then 4 and 5 together.` (`needs` already matched, which shows that piece 4's second sentence was not read). Green after the code that splits pieces into groups.
3. *"reads a list with no Needs: lines as each piece needing the one above"* — **passed on arrival**, because the default for a missing line went in with case 1 (more than the smallest step; I note it here). To show the test is not vacuous, I changed the default to `[]`. The test then failed: expected `1, then 2, then 3.`, received `1 needs none of the others. 2 needs none of the others. 3 needs none of the others.` I reverted the change and it was green again.
4. *"says what a piece waits for when it does not need the whole level before it"* — red: received `1, then 2 and 3 together, then 4.`, with the sentence `4 waits only for 2.` missing. Green after the "waits only for" sentence.
5. *"names three pieces on one level with commas and a last and"* — **passed on arrival** (the list wording came with case 1). To show the test is not vacuous, I changed `listed` to join with " and ". The test then failed: received `1, then 2 and 3 and 4 together.` I reverted the change and it was green again.
6. Four tests, each red, then green:
   - *"refuses a piece that needs itself"* — red: `expected 'clear' to be 'unclear'`. Green after the self check.
   - *"refuses a piece that needs a later piece"* — red: `expected 'clear' to be 'unclear'`. Green after the later-piece check.
   - *"refuses a piece that needs a number past the end of the list"* — red: `expected 'piece 2's Needs: line "piece 9." nam…' to contain 'not in the list'` (the later-piece check had caught it with the wrong reason). Green after the not-in-the-list check.
   - *"refuses a line that names no piece and does not say nothing or none"* — red: `expected 'clear' to be 'unclear'`. Green after the "nothing"/"none" reading and the no-number refusal.
7. *"reads ticket-103.md / ticket-128.md as before"*, *"refuses ticket-164.md for its Status: line, as before"*, *"reads ticket-197.md as before"* — **passed on arrival, which is the point of these tests**. Three checks:
   - I put the committed `HEAD` version of `breakdown.ts` back for one run: all 4 passed. The hand-written values are what the parser returned before this slice.
   - Mutation A (the description loses its final full stop): the 103, 128 and 197 tests failed.
   - Mutation B (the stamp accepts text after the count): the 164 test failed.
   - Both mutations were reverted, and all tests were green again.
8. *"keeps each piece's Needs: line, and leaves a piece without one without one"* (uses `toStrictEqual`) — red: the received value had no `needsLine` (two `- "needsLine"` lines in the diff). Green after `renderBreakdown` wrote the line.

Extra case A, *"reads a list of one piece as that piece alone, with no others to mention"* — red: expected `1.`, received `1 needs none of the others.` Green after the one-group exception.

Extra case B, *"reads a Needs: line whose label is in bold"* — passed on arrival (the pattern already allowed bold). With bold removed from `NEEDS_LINE` it failed; after the revert it was green.

Validation commands:

```
$ npx vitest run src/daemon/breakdown.test.ts
 Test Files  1 passed (1)
      Tests  31 passed (31)

$ npx vitest run src/daemon/poll.test.ts src/commands/status.test.ts src/daemon/steps.test.ts
 Test Files  3 passed (3)
      Tests  163 passed (163)

$ npm run type-check
> tsc --noEmit
(no output, exit 0)
```

- [x] Cases (1)–(8) pass. Each was seen failing first, or, where it passed on arrival (3, 5, 7), a change to the code made it fail; that run is recorded above.
- [x] `poll.test.ts`, `status.test.ts` and `steps.test.ts` pass unchanged (163 tests).
- [x] `parseBreakdown` returns `malformed` in exactly the cases it did before: all 16 tests that were in `breakdown.test.ts` before this slice pass unchanged, and ticket-164.md still gives the same `malformed` reason, letter for letter.

Tests run at slice end. The files this change can affect are `src/daemon/breakdown.test.ts`, `src/daemon/poll.test.ts`, `src/commands/status.test.ts` and `src/daemon/steps.test.ts`. All passed, as shown above. The whole suite:

```
$ npm run build && npx vitest run
 Test Files  61 passed (61)
      Tests  1625 passed (1625)
   Duration  3.44s
```

**What 45b must know.**

- **`ticket-164.md` does not parse today, and did not before this slice.** Its `Status:` line has a sentence after "— 2 pieces", so `parseBreakdown` returns `malformed`. The plan counts it among the three lists that "open the same relations as before". In fact it opens none through this code. Case (7) keeps it `malformed`, as it was.
- `orderInWords` expects a clear order: each piece needs only pieces above it. Call it with `orderOf`'s `needs`, or with needs you have checked yourself. It does not check them.
- `orderOf` reports only the first unreadable line from the top.
- A list of one piece reads "1." (see the decisions above).

## 45b — The step tickets wait for each other exactly as the order says

**Built.** `openStepTickets` reads the order with `orderOf` before it touches the forge. When the order is unclear it opens nothing, creates no label, writes no relation and no body, and returns `the list of pieces at <path> does not say clearly what each piece needs: <reason>, so no step tickets were opened`. When it is clear it opens the missing step tickets in list order, as before. Then, for every step, new or old, it writes a relation for each direct need that the step's `blockedBy` does not already hold. It never removes a relation. The chain through `previous` is gone. A list with no `Needs:` lines still gives the chain, because `orderOf` reads a missing line as "the piece above". The initiative's map now has the line `Order: <words>` after the list of steps.

**Files touched.**

- `src/daemon/chunk-zero.ts` — `orderOf` before the forge, the refusal for an unclear order, the relations written from the direct needs after all tickets are open, the private `isStepOf` (is this dependency our own issue N), and `initiativeMap` takes the order's words.
- `src/daemon/chunk-zero.test.ts` — a fake forge built from `ticketing.stubs.ts`, and cases (1)–(8). The existing `tryMergeChunkZero` type-level test is unchanged.
- `doc/plans/phases/reports/phase-45-handoffs.md` — this section.

**Decisions taken inside the slice.**

- **How "this project's repository" is recognised.** Nothing in `src/` compared a dependency's URL with a project before this slice (`steps.ts` reads only `open`). So I reused the one existing rule for a project's repository: `repoSlug(project.repoUrl)` from `src/adapters/github-tickets.ts`, which the daemon already imports in `container-runtime.ts`. A dependency is our issue N when its number is N **and** its URL equals `https://github.com/<owner>/<repo>/issues/N`, ignoring letter case (GitHub ignores case in owner and repository names). The rule is GitHub's, but so is the URL it reads: `dependencySchema.url` is filled from GitHub's `blockedBy`.
- **`repoSlug` is called only when a step already has a relation with the right number.** A project whose `repoUrl` is not a GitHub URL therefore still gets its first run. If `repoSlug` throws on a re-run, the error is caught and the run reports `could not open the step tickets: …`, as other forge failures are.
- **All tickets are opened first, then all relations are written**, piece by piece in list order, each piece's needs in ascending order. This follows the plan's "then, for every piece". A step that already existed and has all its relations gets no call.
- **The steps' current relations come from the one `listSteps` call made before any ticket is opened.** A step opened by this run is not in that answer, so it has no relations, as the orchestrator noted. No second `listSteps` call.
- **The unclear check runs before `ensureLabel`.** The plan says "before it touches the forge", and case (7) says "no label". The failure message reaches the ticket through the existing failure path in `actions.ts`, unchanged.
- **The `Order:` line has a blank line before it and one after it.** A line directly under a numbered item would be read by markdown as part of that item. Its numbers are the pieces' numbers, which are also the map's line numbers.
- **The fake records `ensureLabel` too**, so case (7) can check "no label" with `calls` equal to `[]`.

Refactors I would do but did not, because they are outside the slice: the comment on `ensureLabel` in `openStepTickets` still speaks of "29c" and "29d". `stepBody` could say what the step waits for in words, but the plan does not ask for it.

**Validation evidence.**

Each case was written alone and run with `npx vitest run src/daemon/chunk-zero.test.ts -t "<name>"`.

1. *"makes each step wait only for the steps its piece directly needs (R10)"* — red: expected `#12←#11, #13←#11, #14←#12, #14←#13`, received the chain `#12 waits for #11`, `#13 waits for #12`, `#14 waits for #13`. Green after `orderOf` and the relations from `needs`, with the `previous` chain deleted.
2. *"gives the committed list of ticket 197 the relations its Needs: lines say"* — **passed on arrival** (case 1's code covers it). To show it is not vacuous, I ran it against `HEAD`'s `chunk-zero.ts`. It failed: `expected [ '#12 waits for #11', …(4) ] to deeply equal [ '#13 waits for #11', …(3) ]`. I restored the new file and it was green again.
3. *"chains the steps one after the other, as before, when no piece has a Needs: line"* — **passed on arrival, which is the point of the case** ("the chain exactly as today"). It also passes against `HEAD`'s `chunk-zero.ts`, which shows the behaviour did not change. Mutation: `needs` forced to `[]`. It failed: `expected [] to deeply equal [ '#12 waits for #11', …(1) ]`. Reverted, green.
4. *"opens no ticket and writes no relation when run a second time on the same forge"* — red: `expected [ '#12 waits for #11', …(3) ] to deeply equal []`. Green after comparing each need with the step's `blockedBy` (by number at that point).
5. *"adds only the relation a step is missing when the steps already exist"* — **passed on arrival** (case 4's code covers it). Mutation: put back the old rule, "relations only for a ticket this run opened" (`if (blockedByOf.has(step.number)) continue;`). It failed: `expected [] to deeply equal [ '#14 waits for #13' ]`. Reverted, green.
6. *"still writes a relation when the step waits for an issue of another repository with the same number"* — red: `expected [] to deeply equal [ '#14 waits for #13' ]`. Green after `isStepOf` (number and URL).
7. *"opens nothing and says why when a Needs: line cannot be read"* — red: `expected [ 'label timone:held made', …(6) ] to deeply equal []`. Green after the refusal before the forge is touched. The sentence is checked for its start (`the list of pieces at doc/plans/breakdowns/ticket-07.md does not say clearly what each piece needs: `), for 45a's reason (`piece 2's Needs: line "piece 3." names piece 3, which comes after it`) and for its end (`, so no step tickets were opened`).
8. *"writes the order in words on the initiative's ticket, under the list of its steps"* — red: the received body lacked the line `Order: 1, then 2 and 3 together, then 4.` and the blank line after it. Green after `initiativeMap` took the order's words.

Validation commands:

```
$ npx vitest run src/daemon/chunk-zero.test.ts
 Test Files  1 passed (1)
      Tests  9 passed (9)

$ npx vitest run src/runner/actions.test.ts src/daemon/steps.test.ts
 Test Files  2 passed (2)
      Tests  65 passed (65)

$ npm run type-check
> tsc --noEmit
(no output, exit 0)

$ git diff --stat
 src/daemon/chunk-zero.test.ts | 326 +++++++++++++++++++++++++++++++++++++++++-
 src/daemon/chunk-zero.ts      |  76 ++++++++--
 2 files changed, 389 insertions(+), 13 deletions(-)
```

(The stat was taken before this section was appended. With it, the handoff file is the third file changed.)

- [x] Cases (1)–(8) pass. Each was seen failing first. Where one passed on arrival (2, 3, 5), a change to the code made it fail, and that run is recorded above.
- [x] `actions.test.ts` and `steps.test.ts` pass unchanged (65 tests).
- [x] `src/runner/actions.ts` is not modified: it is not in `git diff --stat`.

Tests run at slice end. The files this change can affect are `src/daemon/chunk-zero.test.ts`, `src/runner/actions.test.ts` and `src/daemon/steps.test.ts` (the only callers of `openStepTickets` are in `actions.ts`), all shown above. The whole suite:

```
$ npm run build && npx vitest run
 Test Files  61 passed (61)
      Tests  1633 passed (1633)
   Duration  5.67s
```

**What 45c must know.**

- The initiative's map now has an `Order: <words>` line between the list of steps and the line `The list was approved in …`. The words come from `orderOf(...).words`, the same function 45a wrote.
- When the order is unclear, `openStepTickets` returns its sentence before `ensureLabel`, so a run whose list has a bad `Needs:` line has opened nothing at all.
- A risk the plan does not cover: when GitHub reports more relations than it hands over (`dependenciesIncomplete: true`), a relation that exists but was not handed over looks missing and is written again. If GitHub refuses a relation that already exists, the run reports `could not open the step tickets: …` instead of finishing. Reading `dependenciesIncomplete` here, or making `blockStep` accept a relation that already exists, would close the gap. Neither is in this slice.

## 45c — A command that prints the order and refuses a list that says it wrongly

**Built.** A new pure export `checkOrderLine(text)` in `breakdown.ts` reads a list of pieces, works out its order with `orderOf`, finds the `**Order:**` line and compares the two. It returns `{ kind: "ok", words }` when they agree, or `{ kind: "problem", problem }` with one plain sentence: the file cannot be read, a `Needs:` line is unclear, there is no `**Order:**` line, or the line says another order. A new command `timone breakdown <project> <ticket> [--manifest timone.yaml]` reads the ticket's list from the project's working tree and prints the order in words (exit 0), or prints the problem on stderr (exit 1). It also prints a sentence and exits 1 for an unknown project or a ticket with no list.

**Files touched.**

- `src/daemon/breakdown.ts` — `ORDER_LINE` pattern, exported type `OrderLineCheck`, exported `checkOrderLine`, private `withoutFinalStop`. Nothing that was there before changed.
- `src/daemon/breakdown.test.ts` — one new `describe` with 6 cases (plan cases (1)–(5), plus one for a file that cannot be read). The import list gains `checkOrderLine`. No existing test changed.
- `src/commands/breakdown.ts` — new: `registerBreakdownCommand`.
- `src/commands/breakdown.test.ts` — new: 4 cases (plan cases (6), (7), (8) for an unknown project, (8) for a ticket with no list).
- `src/cli.ts` — imports and registers the command right after `registerNumberCommand`.
- `doc/plans/phases/reports/phase-45-handoffs.md` — this section.

**Decisions taken inside the slice.**

- **The four problem sentences**, exactly (`<words>` is `orderOf`'s words, which end with a full stop):
  - cannot be read: `The list of pieces cannot be read: <parser's reason>.`
  - unclear: `The list of pieces does not say clearly what each piece needs: <orderOf's reason>.` (the same phrase 45b uses on the ticket)
  - no line: `The list of pieces has no **Order:** line. Add this line under the list: **Order:** <words>`
  - another order: `The **Order:** line says "<what the line says>", but the Needs: lines say "<words>". Change the line to: **Order:** <words>`
  Each sentence ends with the exact line to write, so the session can copy it.
- **Which line counts.** The first line in the file that starts (after spaces) with `Order:`, bold optional (`**Order:**` or `__Order:__`). Its text is taken with the spaces at the ends removed. Order of checks: the file is read, then the `Needs:` lines, then the `Order:` line. So a list with both an unclear `Needs:` line and no `Order:` line reports the `Needs:` line.
- **Comparison.** Both sides lose the spaces at their ends and one final full stop, then must be equal letter for letter. Nothing else is forgiven (letter case, inner spaces, "and" against a comma).
- **An extra case for "cannot be read".** The plan lists the problem but no numbered case covers it, and strict TDD does not allow untested code.
- **The ticket argument is read with `Number(ticket)`.** A ticket that is not a number gives the path `ticket-NaN.md`, which is reported as "no list of pieces". The plan does not ask for a separate check, so I did not add one.
- **The "no list" sentence**: `Ticket <ticket> of <project> has no list of pieces: there is no file <breakdownPath> in <project path from the manifest>.`
- **A manifest that cannot be loaded** prints the loader's message and exits 1, copied from `number.ts`. Not tested, as in `number.test.ts`.
- **The command test needs no git.** The command reads the working tree only, so the test writes a plain folder under `projects/app`. A git clone, as `number.test.ts` makes, would add nothing.

Refactors I would do but did not, because they are outside the slice: the unknown-project sentence is now written in two commands (`number.ts`, `breakdown.ts`). The same is true of the "load the manifest or print the error" block. A small shared helper in `src/commands/` would remove both copies.

**Validation evidence.**

Each case was written alone and run with `npx vitest run <file> -t "<name>"`.

1. *"accepts an Order: line that says what the Needs: lines say"* — red: `TypeError: (0 , checkOrderLine) is not a function`. Green after a `checkOrderLine` that parses, calls `orderOf` and returns the words.
2. *"accepts the committed list of ticket 197, whose Order: line was written by hand"* — **passed on arrival** (case 1's code returns the words and did not yet compare the line). To show it is not vacuous, I changed the result to `words: ""`. It failed: `expected { kind: 'ok', words: '' } to deeply equal { kind: 'ok', …(1) }`. I reverted it, and it was green. After case 4 added the comparison, it still passed, which shows the hand-written line in `ticket-197.md` matches.
3. *"gives the exact Order: line to add when the list has none"* — red: `expected 'ok' to be 'problem'`. Green after looking for the line with `ORDER_LINE`.
4. *"quotes both orders when the Order: line says another one"* — red: `expected 'ok' to be 'problem'`. Green after the comparison, with `withoutFinalStop`.
5. *"gives the reason when a Needs: line cannot be read"* — red: `expected '' to contain 'piece 2\'s Needs: line "piece 3." nam…'`. Green after the unclear sentence.
   Extra: *"gives the reason when the file cannot be read as a list of pieces"* — red: `expected '' to contain 'no \`Status:\` line — a breakdown says …'`. Green after the "cannot be read" sentence.
6. *"prints the order in words, and exits 0, when the Order: line says it"* — red: `Cannot find module './breakdown.js'`. Green after the command's good-file path.
7. *"prints the problem on stderr, nothing on stdout, and exits 1, when the Order: line says another order"* — red: `expected { out: [], errors: [], …(1) } to deeply equal { out: [], …(2) }` (nothing printed). Green after printing the problem and setting the exit code to 1.
8. *"names the projects it knows, and exits 1, for a project it does not know"* — red: the same "nothing printed" diff. Green after the unknown-project sentence.
   *"says there is no list, and exits 1, for a ticket that has none"* — red: the same "nothing printed" diff. Green after the "no list" sentence.

Validation commands:

```
$ npx vitest run src/daemon/breakdown.test.ts src/commands/breakdown.test.ts
 Test Files  2 passed (2)
      Tests  41 passed (41)

$ npm run build
> timone@0.1.0 build
> tsc
(exit 0)

$ cd /workspace/timone
$ node projects/timone/dist/cli.js breakdown timone 197 --manifest timone.yaml; echo "exit: $?"
1 and 2 together, then 3, then 4 and 5 together. 6 needs none of the others.
exit: 0

$ node projects/timone/dist/cli.js breakdown timone 103 --manifest timone.yaml; echo "exit: $?"
The list of pieces has no **Order:** line. Add this line under the list: **Order:** 1, then 2.
exit: 1

$ node projects/timone/dist/cli.js breakdown nosuchproject 1 --manifest timone.yaml; echo "exit: $?"
I don't know a project called "nosuchproject"; the projects I know are: scratch-app, ivtrends, timone.
exit: 1
```

- [x] Cases (1)–(8) pass. Each was seen failing first, except case (2), which passed on arrival and was shown to fail under a change to the code (recorded above).
- [x] The first command prints `1 and 2 together, then 3, then 4 and 5 together. 6 needs none of the others.`
- [x] The second command's sentence gives the exact line to add: `**Order:** 1, then 2.`

Tests run at slice end, after `npm run build`:

```
$ npx vitest run src/daemon/breakdown.test.ts src/commands/breakdown.test.ts
 Test Files  2 passed (2)
      Tests  41 passed (41)
$ npx vitest run src/cli.test.ts
 Test Files  1 passed (1)
      Tests  6 passed (6)
$ npm run type-check
(no output, exit 0)
```

The whole suite was not run, at the request of the person running the build. The orchestrator runs it once at the end of the phase.

**What 45d must know.**

- Exports from `src/daemon/breakdown.ts`: `checkOrderLine(text: string): OrderLineCheck`, with `OrderLineCheck = { kind: "ok"; words: string } | { kind: "problem"; problem: string }`.
- The command a session runs, from the timone root: `node dist/cli.js breakdown <project> <ticket>` (`--manifest` defaults to `timone.yaml`). Exit 0 and one line on stdout, the order in words. Exit 1 and one sentence on stderr otherwise.
- The sentences a prompt or a test can match on: a good list prints only the words. A missing line prints `The list of pieces has no **Order:** line. Add this line under the list: **Order:** <words>`. A wrong line prints `The **Order:** line says "…", but the Needs: lines say "…". Change the line to: **Order:** <words>`. So in both cases the text after the last `**Order:** ` is the line to write. An unclear `Needs:` line starts `The list of pieces does not say clearly what each piece needs: `. An unreadable file starts `The list of pieces cannot be read: `. No list: `Ticket <n> of <project> has no list of pieces: …`.
- The command reads the **working tree** of the project's checkout (`fromWorkingTree`), so it checks what the session has just written, committed or not.
- The line is found anywhere in the file, the first one only. A list with two `Order:` lines is judged by the first.

## 45d — The session that writes a list writes the `Needs:` lines, the order, and runs the check

**Built.** The breakdown prompt now shows a list with a `Needs:` line under each piece and an `**Order:**` line under the list. It tells the session to write a `Needs:` line for every piece. It states the preference for fewer pieces waiting for each other and fewer pieces changing the same files, and says that each piece working end to end on its own comes first. Before the commit, the session runs `node dist/cli.js breakdown <project> <ticket>` (both values filled in from the run), writes the `**Order:**` line with what it prints, and fixes the list until the command ends without a problem. The closing comment says the order in the same words as the `**Order:**` line. "Order them so each can be built…" and "Prefer few real pieces to many small ones…" are unchanged.

**Files touched.**

- `src/daemon/prompts.ts` — inside `breakdownPrompt` only: one new paragraph after "Order them…", three new lines in the shape block, one new paragraph after the `Status:` paragraph, and one sentence added to the closing-comment paragraph. The JSDoc above the function is unchanged.
- `src/daemon/prompts.test.ts` — imports `checkOrderLine`; one new `describe` ("the breakdown prompt's list of pieces (45d)") with 4 cases. No existing test changed (the diff of this file removes no line).
- `doc/plans/phases/reports/phase-45-handoffs.md` — this section.

**Decisions taken inside the slice.**

- **How the session is not stuck by a missing `**Order:**` line.** The command refuses a list with no `**Order:**` line, and 45c's sentence for that case ends with the exact line to add. So the prompt says: if the line is missing or says another order, the command prints the line to write; write it and run the command again. The shown shape also already carries an `**Order:**` line, so a session that copies the shape starts with one.
- **The check paragraph sits after the `Status:` paragraph and starts "Before you commit it".** The commit instruction comes earlier in the prompt (it introduces the shape), so the words "before you commit it" put the check in the right place in time.
- **The command is written as `node dist/cli.js breakdown …`**, the same form the skills and `process.md` use for `node dist/cli.js number` (phase 44). No prompt in `prompts.ts` named a Timone command before this slice, so there was no form in that file to copy.
- **Case (1) checks the `Needs:` lines as well as the order.** A list without `Needs:` lines also reads "1, then 2." (each piece needs the one above), so `checkOrderLine` alone would pass with the `Needs:` lines missing. The test also reads `needsLine` from `parseBreakdown` and expects `["nothing.", "piece 1."]`. Placeholders `<…>` are all filled with the word "something".
- **An extra case for the closing comment.** The plan asks for it, but no numbered case covers it, and strict TDD does not allow untested text.
- **The `Needs:` sentence is pinned in case (3)**, since case (3) is the test of that paragraph.
- **One rewording after green.** The first wording of the `Needs:` sentence read "which pieces above it it needs". I changed the test literal first (red: `expected 'Break the work for ticket #6 on **scr…' to contain 'Under each piece, write a \`Needs:\` li…'`), then the prompt (green).

**Validation evidence.**

Each case was written alone and run with `npx vitest run src/daemon/prompts.test.ts -t "<name>"`.

1. *"shows a list the order check accepts, once its placeholders are filled in"* — red: `expected { kind: 'problem', …(1) } to deeply equal { kind: 'ok', words: '1, then 2.' }`, with the problem `The list of pieces has no **Order:** line. Add this line under the list: **Order:** 1, then 2.` Green after the two `Needs:` lines and the `**Order:**` line went into the shape. Mutation: with the two `Needs:` lines removed from the prompt, it failed with `expected [ undefined, undefined ] to deeply equal [ 'nothing.', 'piece 1.' ]`. Reverted, green.
2. *"names the check to run with this project's name and this ticket's number"* — red: `expected 'Break the work for ticket #6 on **scr…' to contain 'run \`node dist/cli.js breakdown scrat…'`. Green after the check paragraph. Expected literals: ``run `node dist/cli.js breakdown scratch-app 6` `` and ``Write the `**Order:**` line with exactly what it prints.``
3. *"prefers fewer pieces waiting for each other, but puts each piece working end to end first"* — red: `expected 'Break the work for ticket #6 on **scr…' to contain 'When two ways of cutting the work are…'`, then (after pinning the `Needs:` sentence too, still red) `… to contain 'Under each piece, its \`Needs:\` line s…'`. Green after the new paragraph. Red and green again for the rewording noted above.
   Extra: *"tells the closing comment to say the order in the words of the Order: line"* — red: `expected 'Break the work for ticket #6 on **scr…' to contain 'Say the order of the pieces in the sa…'`. Green after the sentence in the closing-comment paragraph.
4. Existing breakdown-prompt tests — unchanged and passing: `npx vitest run src/daemon/prompts.test.ts -t "breakdown"` gives `17 passed | 196 skipped` (the per-stage "breakdown" rows, "tells the breakdown's stamp to carry the count of pieces", "writes a stamp the breakdown parser actually accepts", and the new ones). `git diff src/daemon/prompts.test.ts` removes no line.

Validation commands:

```
$ npx vitest run src/daemon/prompts.test.ts src/daemon/breakdown.test.ts
 ✓ src/daemon/breakdown.test.ts (37 tests)
 ✓ src/daemon/prompts.test.ts (213 tests)
 Test Files  2 passed (2)
      Tests  250 passed (250)

$ npm run type-check
> tsc --noEmit
(no output, exit 0)

$ git diff -U0 src/daemon/prompts.ts | grep "^@@"
@@ -1088,0 +1089,6 @@ function breakdownPrompt(context: PromptContext): string {
@@ -1100,0 +1107 @@ function breakdownPrompt(context: PromptContext): string {
@@ -1101,0 +1109,3 @@ function breakdownPrompt(context: PromptContext): string {
@@ -1107,0 +1118,7 @@ function breakdownPrompt(context: PromptContext): string {
@@ -1110 +1127,2 @@ function breakdownPrompt(context: PromptContext): string {
```

- [x] Cases (1)–(4) pass. Cases (1), (2), (3) and the extra case were each seen failing first. Case (4) is the existing tests, passing unchanged.
- [x] No other prompt function in `prompts.ts` is changed: every hunk is inside `breakdownPrompt` (hunk headers above).

Tests run at slice end, by file: `src/daemon/prompts.test.ts` (213 passed), `src/daemon/breakdown.test.ts` (37 passed), `src/commands/takeover.test.ts` (47 passed; the only other test file that imports `prompts.ts`, and it imports `takeoverPrompt` only). `src/runner/replay/harness.test.ts`, `src/runner/actions.test.ts` and `src/daemon/session.test.ts` do not import `prompts.ts`, so they were not run. The whole suite was not run, at the request of the person running the build. The orchestrator runs it once at the end of the phase.

**What 45e must know.**

The shape block, exactly as the prompt now shows it:

```markdown
# Breakdown

**Status:** Awaiting approval

1. **<what the piece is called>** — <one line of what it delivers>
   - Needs: nothing.
2. **<the next piece>** — <one line of what it delivers>
   - Needs: piece 1.

**Order:** 1, then 2.
```

The `Needs:` and R11 paragraph, exactly (it follows "Order them so each can be built and merged on its own, needing only what is above it. Prefer few real pieces to many small ones: every piece costs a review."):

> Under each piece, write a `Needs:` line. It gives the numbers of the pieces above it that this piece needs, or says `nothing`. When two ways of cutting the work are equally good, choose the one where fewer pieces wait for each other and fewer pieces change the same files. But each piece must still work end to end on its own, and that comes first.

The check paragraph (with `<project>` and `<ticket>` filled in by the prompt):

> **Before you commit it, run `node dist/cli.js breakdown <project> <ticket>`.** It prints the order of the pieces, or says what is wrong with the list. Write the `**Order:**` line with exactly what it prints. If the line is missing or says another order, the command prints the line to write: write that line, and run the command again. Fix the list until the command prints the order and ends without a problem.

The sentence added to the closing comment: "Say the order of the pieces in the same words as the `**Order:**` line."
