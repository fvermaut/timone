# Phase 46 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 46a — A ticket opened for a piece names the project's people

**Built.** A new pure function, `withPeopleNamed(body, people)` in `src/daemon/people.ts`, adds a last line to a ticket body: a blank line, then `Named so that GitHub tells them about this ticket and every comment on it: @a @b`. It trims each login, strips leading `@` characters, drops empty ones and repeats, and keeps the order. With nobody left, it returns the body unchanged, so the body has no `@` in it. Trailing newlines of the body are removed before the blank line. The added text has no backtick. `openStepTickets` now takes the project's named people as a fourth argument and passes every new step ticket's body through `withPeopleNamed`. A step found by its title is still neither opened again nor edited. The runner's `closeChunkZero` passes `namedPeople(deps.manifest, deps.project.name)`.

**Files touched.**

- `src/daemon/people.ts` — created: `NAMED_LINE_START`, `withPeopleNamed`, with a doc comment that gives the reason (ADR-0042, PRD-08).
- `src/daemon/people.test.ts` — created: cases 1–4, plus one extra test for the trailing newlines (see below).
- `src/daemon/chunk-zero.ts` — `openStepTickets` gains `people: readonly string[]`; the `createStep` body is `withPeopleNamed(stepBody(…), people)`; the doc comment names the parameter and PRD-08 R1; one import.
- `src/runner/actions.ts` — the `openStepTickets` call in `closeChunkZero` passes `namedPeople(deps.manifest, deps.project.name)`. Nothing else.
- `src/daemon/chunk-zero.test.ts` — `fakeForge()` also keeps each step body under its title (`stepBodies: Map<string, string>`); a `THREE_PIECES` list; the nine existing calls of `openStepTickets` gain `[]`; a new `describe` with cases 5–9. No existing assertion changed.
- `src/adapters/github-tickets.test.ts` — one added line in the no-assignee test (case 10).
- `doc/plans/phases/reports/phase-46-handoffs.md` — this file.

**Decisions taken inside the slice.**

- **The existing `openStepTickets` tests pass `[]` as the people.** With nobody named, their step bodies are exactly as before, so they stay about their own subject (relations, idempotence, order in words).
- **The trailing-newline rule has its own test.** The plan states it in the contract of `withPeopleNamed` but no numbered case covers it. I added one test, "puts exactly one blank line under a body that ends with newlines", so the code was not written without a test. `stepBody` today ends with no newline, so this changes nothing on the step path.
- **Case 9's "no recorded call assigns anyone".** The fake records only the writes it implements; any other adapter write comes from the stubs, which throw, and then `openStepTickets` returns a failure. So the test lists every write the first run made and checks that each is one of: a step opened, a relation, a label created, the initiative's body, the map label on #7. A hold label on a step, or any new kind of write, makes it fail (probe B below).
- **Case 10 keeps the test's input unchanged.** The plan says to add an assertion that the argv carries the body "names included". The test's body is `"does the thing"`, which has no names. Changing it would change the guard test, and the plan and the orchestrator both say to keep it unchanged. So the added assertion checks that the value right after `--body` is `"does the thing"`. The adapter passes the body through as given, so a body with names reaches `gh` the same way. If the verifier wants names in that body, the input literal has to change; I did not do that.
- **Mutation tooling.** Each probe was a temporary edit of the source file, copied back from a saved copy straight after the run.

Refactor I would do but did not: none in this slice.

**Validation evidence.**

Every red/green run below was `npx vitest run src/daemon/people.test.ts` or `npx vitest run src/daemon/chunk-zero.test.ts`.

1. *"names each named person with @, after a blank line under the body"* — red, first with `Cannot find module './people.js'`, then with a stub that returned the body: `AssertionError: expected 'Body.' to be 'Body.\n\nNamed so that GitHub tells t…'`. The expected value is the literal string from the plan. Green after the line was added.
2. *"leaves the body as it is, with no @ in it, when nobody is named (R5)"* (`[]`, `["", "  "]`, `["@"]`) — red: `expected 'Body.\n\nNamed so that GitHub tells t…' to be 'Body.'`. Green after trimming, stripping `@`, dropping empty logins, and returning the body when none are left.
3. *"names each person once and with one @, however their login was written"* — red on the repeat (`["alice", "alice"]`, line 25): `expected 'Body.\n\nNamed so that GitHub tells t…' to be 'Body.\n\nNamed so that GitHub tells t…'`. The `@alice` / ` bob ` half was already green, because stripping `@` and trimming came with case 2 (`["@"]` needed it). Green after repeats were dropped (`new Set`).
4. *"writes no backtick in the line it adds, so GitHub reads the names as plain text"* — **cannot go red honestly**: nothing so far wrote a backtick. Green on arrival. Probe: wrap each name in backticks → this test fails (`expected '\n\nNamed so that GitHub tells them a…' not to contain '`'`), with cases 1 and 3. Reverted → green.
   - Extra: *"puts exactly one blank line under a body that ends with newlines"* — red: `expected 'Body.\n\n\n\nNamed so that GitHub tel…' to be 'Body.\n\nNamed so that GitHub tells t…'`. Green after `body.replace(/\n+$/, "")`.
5. *"names the one named person on each of the three step tickets (R1)"* — red: `AssertionError: expected 'a task can be written down\n\nPart of…' to contain '@fvermaut'` (chunk-zero.test.ts:378). Green after `openStepTickets` took `people` and called `withPeopleNamed`. (The nine existing calls then crashed with `could not open the step tickets: Cann…` until they were given `[]`.)
6. *"names every named person on every step ticket when there are two (R1)"* — **cannot go red honestly** after case 5: the code already passes the whole list. Green on arrival. Probe: pass `people.slice(0, 1)` → `expected 'a task can be written down\n\nPart of…' to contain '@bob'`. Reverted → green.
7. *"opens nothing and edits no step ticket's body on a re-run, so nobody is named twice (R1)"* — **cannot go red honestly**: the function never edited a found step. Green on arrival. Probe: add `setTicketBody` for each step found by title → `expected [ 'body of #11', 'body of #12', …(2) ] to deeply equal [ 'body of #7' ]`. Reverted → green.
8. *"opens the step tickets with no name and no @ in them when nobody is named (R5)"* — the three expected bodies are written out literally (`a task can be written down\n\nPart of #7. The full list is in \`doc/plans/breakdowns/ticket-07.md\`.` and so on). **Cannot go red honestly**: the guard in `withPeopleNamed` came with case 2. Green on arrival. Probe: remove `if (logins.length === 0) return body;` → `expected { …(3) } to deeply equal { …(3) }`. Reverted → green.
9. *"leaves piece 1's step ticket free to be taken, with nobody assigned and nothing held (R4)"* — **cannot go red honestly**: nothing assigns or holds a step today. Green on arrival. Probe A: make step 1 wait for the last step → `expected undefined to be 11` (and six existing relation tests fail). Probe B: put the hold label on each opened step → `expected [ 'label timone:held on #11', …(2) ] to deeply equal []`. Both reverted → green.
10. **Guard, not a red-green case.** The test "creates a step carrying neither the hold label nor an assignee" is unchanged; one line was added after its two assertions: `expect(calls[0].args[calls[0].args.indexOf("--body") + 1]).toBe("does the thing");`. Green.

Validation commands, as run from `projects/timone`:

```
$ npx vitest run src/daemon/people.test.ts src/daemon/chunk-zero.test.ts src/adapters/github-tickets.test.ts src/daemon/breakdown.test.ts src/daemon/steps.test.ts src/runner/actions.test.ts
 ✓ src/daemon/steps.test.ts (13 tests)
 ✓ src/daemon/people.test.ts (5 tests)
 ✓ src/daemon/breakdown.test.ts (37 tests)
 ✓ src/adapters/github-tickets.test.ts (80 tests)
 ✓ src/daemon/chunk-zero.test.ts (14 tests)
 ✓ src/runner/actions.test.ts (52 tests)
 Test Files  6 passed (6)
      Tests  201 passed (201)

$ npm run type-check; echo "exit: $?"
> tsc --noEmit
exit: 0

$ grep -rn --include='*.ts' -e '--assignee' src | grep -v '\.test\.ts:' | grep -v '^\S*:\s*//' | grep -v '^\S*:\s*\*'; echo "exit: $?"
exit: 1
```

Type-check probe: with `src/runner/actions.ts` put back to its committed form, `tsc --noEmit` fails with `src/runner/actions.ts(654,27): error TS2554: Expected 4 arguments, but got 3.` Restored → exit 0.

`npm test` was **not run**: the person running this build asked that only the tests of what changes run while working, and that the whole suite run once at the phase close, by the orchestrator. It is deferred to the phase close.

- [x] Cases 1–9 green after the change. Red shown for 1, 2, 3, 5 (and the extra test). Cases 4, 6, 7, 8 and 9 could not go red honestly; each was proven not vacuous by a mutation probe, shown above.
- [x] The no-assignee test for `createStep` is unchanged and green; case 10 is a guard, with one added assertion.
- [x] `openStepTickets` has no caller that omits the people: `npm run type-check` exits 0.
- [ ] The whole suite passes — **deferred to the phase close** (see above). The existing idempotence and `Needs:` relation tests in `src/daemon/chunk-zero.test.ts` are unchanged apart from the added `[]` argument, and green.

Tests run at slice end: `src/daemon/people.test.ts`, `src/daemon/chunk-zero.test.ts`, `src/adapters/github-tickets.test.ts`, `src/daemon/breakdown.test.ts`, `src/daemon/steps.test.ts`, `src/runner/actions.test.ts`.

**What 46b must know.**

- `withPeopleNamed` and `NAMED_LINE_START` are exported from `src/daemon/people.ts`. Any other ticket the machine opens can pass its body through it.
- During this slice, `.claude/skills/timone-wayfind/SKILL.md` showed as modified in the working tree (a "Named so that GitHub tells them…" line added to the map template). This slice did not make that change and did not touch the file.
