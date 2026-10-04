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
