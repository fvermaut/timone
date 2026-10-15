# Phase 62 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 62a — A named person's comment on a map ticket gets one reply that links the open step tickets

**Built.** When a named person writes on a map ticket, the runner's driver now answers once. The answer says the ticket is not read any more and lists the step tickets that are still open, in the order the listing gave them. When no step ticket is open, it says every piece is finished or was dropped, and to open a new ticket. The comment is marked read in the run record before the answer is posted, so a failed post is not tried again. The runner is never woken for a map ticket. A map ticket with a live run on it is left to that run. A map whose step listing failed this cycle gets no answer this cycle. The poll still opens no run on a map ticket.

**Files touched.**

- `src/runner/comments.ts` — added `mapTicketReply(openSteps)`.
- `src/runner/comments.test.ts` — created; cases t1, t2, t3.
- `src/runner/driver.ts` — `RunnerCycle.maps` (required); `tick` answers each map with no live run, in its own `try`; new private `answerMap`; new private helper `newestOf`.
- `src/runner/driver.test.ts` — `maps: []` added to the three existing cycles; new block `describe("a comment on a map ticket", …)` with cases 1–9, built on the existing `forge` and `fakeWakes` fakes.
- `src/daemon/poll.ts` — `Frontier.maps`, filled in `surveyInitiatives` only for maps whose listing succeeded; the cycle passes `maps: frontier.maps` to the runner and the planner (same object).
- `src/daemon/poll.test.ts` — `trackerFor` takes an optional third argument (`comments` on the map ticket, `stepsFail`) and returns `posted`; cases p1 and p2 in "the frontier decides which step is taken".

No other file needed `maps: []`: `tsc` named only `poll.ts` and `driver.test.ts`. The planner's types did not need a change.

**Decisions taken inside the slice.**

- The no-step text ends with `**What I need from you:** nothing on this ticket. To get an answer, open a new ticket.` The plan gave the first paragraph and the advice line for this case but not the last line. "Write on one of the tickets above" makes no sense with no tickets listed, so it is left out.
- Case 5 uses a parked run on #7 that waits for the planner, and the planner holds it. Reason: a plain parked run's own look would mark the comment read and wake the runner for #7. That would break the rule "no wake for #7 in cases 1–9". It would also make the case pass even with no live-run check, because the map path would find the comment already marked. With the planner holding the run, the run's look leaves the comment unread and wakes nobody. So only the map path could post, and the live-run check is what stops it (seen red, below).
- Case 4 and case 6 each hold more than one situation in one test, so that the block has exactly nine tests, as the validation step expects. Case 6 also covers the third rule for `since`: no mark and no machine comment, so the comments are only marked read. The plan's "with only the T0 comment" can be read two ways (with or without the machine comment at T1), so both are tested.
- I added a private helper `newestOf` in `driver.ts`. `newComments` finds the newest comment its own way, with a `reduce`. I did not change `newComments`; see "What 62b must know".
- The record is read before the thread. A record that cannot be read throws, so the thread is not fetched.

**Validation evidence.**

Red runs: each case was written before its code and run alone. Then, at the end, every new test was run again against the three source files as they are at `HEAD` (`git show HEAD:<file>`, put back afterwards). Mutation probes were run on the finished code for cases that were green on arrival.

Text cases, `src/runner/comments.test.ts`:

- t1 — red: `TypeError: (0 , mapTicketReply) is not a function`. Green after adding the open-steps text.
- t2 — red: `AssertionError: expected '**This ticket is not read any more.**…' to contain 'Every piece of its work is finished o…'`. Green after adding the no-step text.
- t3 — green on arrival. Probe: added a line ``Or run `timone takeover scratch-app#7`.`` to the text → `AssertionError: expected '**This ticket is not read any more.**…' not to contain 'timone takeover'`. Reverted, green.
- On `HEAD` source: `Tests 3 failed (3)`.

Driver cases, `src/runner/driver.test.ts`, block "a comment on a map ticket":

1. Red: `AssertionError: expected [] to deeply equal [ 7 ]`. Green after `RunnerCycle.maps`, the loop in `tick` and `answerMap`.
2. **(hard gate)** Green on arrival. Probe: `seen` entry not written → `AssertionError: expected [ 7, 7 ] to deeply equal [ 7 ]`. Reverted, green.
3. **(hard gate)** Green on arrival. Probe: one post per named comment → `AssertionError: expected [ 7, 7 ] to deeply equal [ 7 ]`. Reverted, green.
4. Green on arrival. Probe A, `fromTimone` check removed → `expected [ { ticket: 7, …(1) } ] to deeply equal []`. Probe B, named-person check removed → the same failure on the stranger's map. Reverted, green.
5. Red: `AssertionError: expected [ { ticket: 7, …(1) } ] to deeply equal []`. Green after the `liveRunForTicket` check.
6. Red at first for the wrong reason: the test helper's default put the T0 mark back when `seenAt: undefined` was passed. Fixed the helper (`null` means no mark). Then red for the right reason: `AssertionError: expected [] to deeply equal [ 7 ]`. Green after the fallback to the machine's newest comment.
7. Green on arrival. Probe: every step listed, open or closed → `expected '**This ticket is not read any more.**…' to contain 'Every piece of its work is finished o…'` (and case 1 failed on `#52`). Reverted, green.
8. **(hard gate)** Red: `Error: the forge is down` (the tick threw). Green after the `try` around each map. Probe for the order: `seen` written after the post → `AssertionError: expected '2026-10-15T09:00:00Z' to be '2026-10-15T10:00:00Z'`. Reverted, green. This shows the mark is written before `postComment`.
9. Green on arrival: the throw on an unread record came with case 1's code, as the plan describes `answerMap`. Probe: an unread record counted as empty → `AssertionError: expected [] to deeply equal [ Array(1) ]`. Reverted, green.

- On `HEAD` source: `Tests 8 failed | 1 passed`. Cases 1–4 and 6–9 fail. Case 5 passes there, because it asserts that nothing is posted.

Poll cases, `src/daemon/poll.test.ts`:

- p1 — red on `HEAD` source: `AssertionError: expected [] to have a length of 1 but got +0`. Green after `Frontier.maps` and the cycle change.
- p2 — green on arrival. Probe: a map whose listing failed still handed over with no steps → `AssertionError: expected [ { project: 'alpha', …(2) } ] to deeply equal []`. Reverted, green.

Validation commands, as run on the final code:

```
$ npx vitest run src/runner/comments.test.ts src/runner/driver.test.ts src/daemon/poll.test.ts
 ✓ src/runner/comments.test.ts (3 tests)
 ✓ src/daemon/poll.test.ts (123 tests)
 ✓ src/runner/driver.test.ts (47 tests)
 Test Files  3 passed (3)
      Tests  173 passed (173)
$ npx vitest run -t "a comment on a map ticket" src/runner/driver.test.ts; echo "exit: $?"
 Test Files  1 passed (1)
      Tests  9 passed | 38 skipped (47)
exit: 0
$ npx tsc --noEmit; echo "exit: $?"
exit: 0
$ grep -n "if (ticket.labels.includes(MAP_LABEL)) continue;" src/daemon/poll.ts; echo "exit: $?"
1156:    if (ticket.labels.includes(MAP_LABEL)) continue;
exit: 0
$ git diff --quiet main -- src/runner/brief.ts; echo "exit: $?"
exit: 0
```

- [x] Every case was red before the change and is green after. Cases that were green on arrival (t3, 2, 3, 4, 7, 9, p2) have a mutation probe with its real failure, listed above. On `HEAD` source, every new test fails except case 5 and p2, which assert that nothing is posted.
- [x] Cases 2, 3 and 8 pass, and are not weakened.
- [x] The `seen` entry is appended before `postComment` (case 8, and its order probe).
- [x] No runner wake for #7: each of cases 1–9 asserts `wakes` is empty.
- [x] `src/runner/brief.ts` is unchanged (exit 0).

Test files run at slice end: `src/runner/comments.test.ts` (3 passed), `src/runner/driver.test.ts` (47 passed), `src/daemon/poll.test.ts` (123 passed). `npm test` was not run here. The operator asked that only the changed test files run during the slice; the orchestrator runs the whole suite once at the close.

**What 62b must know.**

- The map path and a run's own look use the same `seen` thread name, `ticket`, in the same record (`.timone/records/<project>/<map>.jsonl`). A run on a map ticket that marks comments read will also hide them from `answerMap`.
- `tick` answers maps only after the loop over runs, and only for maps with no live run.
- `answerMap` reads its own copy of the record. It does not share entries with `look`.
- Possible refactor, not done: `newComments` could use `newestOf` instead of its own `reduce`.

## 62b — The glossary says what happens to a comment written on a map ticket

**Built.** Added one marked line to the **Map ticket** entry in `CONTEXT.md`, saying what a named person's comment on it now gets: one reply from the machine saying the ticket is not read any more, with links to its open step tickets as the place to write instead. The entry still says no run is ever opened on the ticket. No code changed.

**Files touched.**

- `CONTEXT.md` — appended the marked line to the **Map ticket** entry.

**Decisions taken inside the slice.** Appended the amendment to the end of the entry's own line, the form most of the file's other marked amendments use (`Approval`, `Place`, `Chunk zero`), rather than an indented continuation. Kept the entry's existing words unchanged.

**Validation evidence.** No behaviour-carrying code in this slice, so no seams were declared and there is no red-green trace; validation is checklist-based. No test file was run: the slice changes no code.

```
$ grep -n "timone#254" CONTEXT.md; echo "exit: $?"
26:- **Map ticket** — the initiative's own ticket, once its pieces have been agreed. Its body is a list of links to its step tickets and nothing else, and it carries the `timone:map` label. No run is ever opened on it: the work belongs to the tickets it points at. ✏ 2026-10-15 ([timone#254](https://github.com/fvermaut/timone/issues/254)): a named person who writes on it gets one reply from the machine. The reply says the ticket is not read any more, and links its open step tickets as the place to write. Nothing else is done with the comment.
exit: 0
$ git diff --stat main -- CONTEXT.md
 CONTEXT.md | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```

- The **Map ticket** entry still says no run is ever opened on it, and now also says what a comment there gets: confirmed, both sentences stand in the same entry above.
- Plain words; no stage names or process words: confirmed, the added sentence uses only "named person", "machine", "reply", "ticket", "step tickets" — words already used elsewhere in the glossary.

**What delivery must know.** This slice is glossary text only. It records in words what 62a's code already does; nothing here changes behaviour or needs a live check.
