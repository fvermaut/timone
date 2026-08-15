# Phase 23 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 23a — The breakdown artifact

**Built.** `src/daemon/breakdown.ts` — a daemon module that reads, parses and renders a breakdown: the markdown list of chunks an initiative will be built in, at `doc/plans/breakdowns/ticket-NN.md` in a managed project's checkout ([ADR-0028](../../../adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md) D1). It answers four questions and writes nothing: what the file says (`parseBreakdown` / `renderBreakdown`, mutual inverses), where the file is (`breakdownPath`, the only place the path is spelled), what is in it on disk (`readBreakdown`, which returns `ok` / `absent` / `malformed` and **never throws**), which chunk is next given how many the ledger has settled (`chunkProgress`), and whether the list has grown since the human approved it (`isReproposal`).

**Nothing is wired to it.** No other file in `src/` learns the path, per the slice's own grant — `git grep -n "breakdowns/" -- src` outside the two new files returns nothing.

**[ADR-0030](../../../adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md) D4 is respected literally: the module has no writer.** There is no function that stamps, ticks or otherwise edits a breakdown. `renderBreakdown` exists solely as `parseBreakdown`'s inverse, so the round-trip is assertable; it takes a whole `ParsedBreakdown` and returns a string, and nothing in this slice puts a string on disk.

**Files touched.**
- `src/daemon/breakdown.ts` — created.
- `src/daemon/breakdown.test.ts` — created; 12 tests.
- `doc/plans/phases/reports/phase-23-handoffs.md` — created (this file, with its header — 23a is the first slice).

**Decisions taken inside the slice.**

1. **The file's concrete markdown shape**, which the plan described but did not spell:

   ```markdown
   # Breakdown

   **Status:** Approved by fvermaut 2026-08-15 — 3 pieces

   1. **The ledger learns chunks** — a run carries its sequence number.
   2. **The next chunk opens** — a merged pull request opens the next one.
   3. **The ticket closes** — the last merge closes the conversation.
   ```

   The `Status:` line is matched with optional markdown emphasis (`**Status:**`, `__Status:__`, bare `Status:`) and the chunk lines with either an em dash or a hyphen as the title/delivers separator, because the file is written by a stage session and read by the poll loop — tolerating the two spellings a writer might reach for is cheaper than a project stalling on a dash. The stamp itself is **not** tolerant: anything that is neither `Awaiting approval` (case-insensitive) nor `Approved by <who> <date> — N pieces` is `malformed` with a reason quoting what it actually read.

2. **`ParsedBreakdown` carries no ticket number**, so the heading is the fixed string `# Breakdown` and the parser ignores it entirely. The filename carries the ticket's identity and `breakdownPath` is the only place that is spelled; putting the number in the body too would create a second copy that can disagree with the path, and would add a malformed class the plan did not declare.

3. **`ticket-NN.md` is zero-padded to two digits** — `ticket-07.md`, `ticket-23.md`, `ticket-123.md`. Consistent with `doc/plans/phases/phase-01.md` next door and `doc/triage/001-…`, so `doc/plans/` reads as one convention. **This is the slice's one real hazard for later slices — see below.**

4. **`chunkProgress` clamps `done` at both ends** (`Math.min(Math.max(doneChunks, 0), total)`). Clamping at `total` is the plan's; clamping at 0 is mine, because a negative count would otherwise produce a `next.index` of 0 or less — a nonsense chunk number handed to a caller that will put it in front of a human. Both clamps answer rather than throw, which is what a per-cycle reader needs.

5. **`isReproposal` is `chunks.length > stamp.pieces`, strictly.** A list *shorter* than its stamp is not called a re-proposal: that is a breakdown that lost a chunk, a different event, and naming it here would let a later caller re-gate on the wrong thing. An `Awaiting approval` breakdown is `false` — nothing approved, nothing re-proposed.

6. **`readBreakdown` returns the full joined path on every arm**, not the repo-relative one, so a log line or a ticket comment can name the file on a machine the reader is not sitting at (the house rule that errors name the file they came from). An unreadable-but-present file (permissions, a directory in its place) is reported as `malformed` carrying the OS reason, for the same never-throw reason as the rest.

**Validation evidence.**

Baseline before the slice: **859 tests / 24 files**, `npm run type-check` exit 0.

Red → green, in execution order:

| Case (as the plan declares it) | Red — the failure actually seen | Green |
|---|---|---|
| Round-trip, `Awaiting approval`, three chunks | `Cannot find module './breakdown.js'` — neither function existed | ✅ |
| Round-trip, `Approved by fvermaut 2026-08-15 — 3 pieces`, preserving who/date/count | **Mutation probe** (the approved arm was already written): dropped `${stamp.at}` from `renderStamp` → `AssertionError: expected { kind: "malformed", reason: 'unreadable \`Status:\` line "Approved by fvermaut — 3 pieces" …' } to deeply equal { kind: "approved", by: "fvermaut", at: "2026-08-15", pieces: 3 }`. Reverted. | ✅ |
| `chunkProgress(b, 1)` answers chunk 2 | `TypeError: (0 , chunkProgress) is not a function` | ✅ |
| `chunkProgress(b, 3)` answers `next: undefined` | **Mutation probe**: removed the `next === undefined` guard so a progress record always carries a `next` → the exhausted case failed, the `done: 1` case stayed green. Reverted. | ✅ |
| `doneChunks` larger than the list is clamped, not thrown | **Mutation probe**: dropped `Math.min(…, total)` → `AssertionError: expected { total: 3, done: 7 } to deeply equal { total: 3, done: 3 }`, with the other four progress/round-trip tests still green. Reverted. | ✅ |
| Re-proposal: 2-over-3 true, 3-over-3 false, awaiting false | `TypeError: (0 , isReproposal) is not a function` — all three arms red at once | ✅ |
| Absent file answers, malformed-no-list and malformed-no-status answer with a readable reason | `TypeError: (0 , readBreakdown) is not a function` — all four arms red at once; the absent case reported as `expected [Function] to not throw an error but 'TypeError: … readBreakdown is not a function' was thrown`, which is the assertion the excerpt asks for doing its job | ✅ |

**Three cases could not honestly be driven red** and were verified by mutation instead, marked above: the approved round-trip and both `chunkProgress` edge answers. In each case the implementation that turned the *previous* case green already covered them; the probe mutated the implementation, the assertion failed for the stated reason, and the mutation was reverted.

Excerpt's validation commands, run at the end:

- `npm test -- src/daemon/breakdown.test.ts` → **12 passed (1 file)**.
- `npm run type-check` → **exit 0**, no output.
- `npm test` → **871 passed, 25 files** (was 859 / 24).

Checkboxes:

- ✅ **PASS** — `readBreakdown` against a temp directory containing no `doc/` at all returns `{ kind: "absent", path }`, asserted with `expect(() => readBreakdown(dir, TICKET)).not.toThrow()` **around the call itself** (`breakdown.test.ts`, "answers rather than throwing when the project has no doc/ at all"), followed by a separate `toEqual` on the returned answer.
- ✅ **PASS** — the re-proposal pair is asserted both ways: a stamp naming 2 pieces over a 3-chunk list is `true`, the same list under a stamp naming 3 is `false`, plus an `Awaiting approval` third case.
- ✅ **PASS** — `git grep -n "breakdowns/" -- src ':!src/daemon/breakdown.ts' ':!src/daemon/breakdown.test.ts'` returns nothing (exit 1, no output). Nothing is wired.
- ✅ **PASS** — full suite green and the count went **up**: 859 → 871 tests, 24 → 25 files.

**What 23b must know.**

1. **The path spelling is the one thing that can silently break this.** `breakdownPath(7)` is `doc/plans/breakdowns/ticket-07.md`, zero-padded. The writer of the artifact is a **prompt**, not this module, so nothing type-checks the two against each other: if a later slice tells the breakdown-stage session the path in prose and that prose says `ticket-7.md`, `readBreakdown` will answer `absent` for ever and the poll loop will conclude the initiative has no breakdown. **Whatever slice writes the breakdown prompt must interpolate `breakdownPath(ticket)` into it rather than restating the path**, and if you disagree with the padding, change it here — it is one function — rather than in the prompt.

2. **There is no writer, and adding one is re-opening D4.** The module cannot stamp a breakdown `Approved`. The approval stamp is written by the same mechanism every other artifact's is — the approval-record session (`prompts.ts`'s `APPROVAL_RECORD`) — which needs a `breakdown` row saying what the stamp reads, **including the `— N pieces` count**, because that count is what `isReproposal` compares against. A stamp written without it parses as `malformed` and the whole file becomes unreadable. That row is not in this slice.

3. **`parseBreakdown`'s malformed arm is discriminated by `kind`, and `ParsedBreakdown` deliberately has no `kind` field** — that is the signature the plan fixed. So callers narrow with `"kind" in parsed`, which is what `readBreakdown` does. It works and it is type-safe, but it is the one place a reader has to look twice. **If a future slice is free to change the signature**, the refactor I would make is to tag the success arm too (`{ kind: "ok"; breakdown }`) so the union discriminates on one field like every other state in the codebase (`standards/typescript.md`: states are discriminated unions). I left it alone because the plan named the signature.

4. **`chunkProgress` takes a count, not a ledger.** It is deliberately ignorant of `RunStore` — the caller asks the ledger how many of the ticket's chunks have **settled `done`** and passes the number. Note the word: `runs.ts` distinguishes `TERMINAL` from `SETTLED`, and `cancelled` is settled but not done. Which of those two the caller counts is 23f's decision and this module has no opinion; it will clamp whatever it is given.

5. **`renderBreakdown` is not dead code and should not be deleted as such.** It exists so the round-trip is assertable, and it is what a later slice would use if a breakdown ever needs to be produced programmatically. Today its only caller is the test.
