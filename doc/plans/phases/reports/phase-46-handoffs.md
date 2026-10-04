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

## 46c — The charting instructions name the project's people on every ticket they open

**Built.** The charting instructions now tell the session to name the project's people on every ticket it opens: the map and each decision ticket. A new subsection, *Every ticket names the project's people*, carries the marker `✏ 2026-10-04 (PRD-08 R3)`. It says why the line is needed (the machine's account opens the tickets, so GitHub tells nobody), where the people are found (`timone.yaml`: the project's `instructors` when it lists any, otherwise the top-level `operator`), what the line is and where it goes (after the closing block, as the last line of the body), that it is plain text and never inside backticks or a code block, that nobody is assigned for this and the **Claiming:** rule does not change, and that a ticket opens without the line when the file names nobody. The map's body template ends with the line. Mode 1 steps 3 and 4 and Mode 2 step 5 each tell the session to add it and link to the subsection, with the same dated marker.

**Files touched.**

- `.claude/skills/timone-wayfind/SKILL.md` — new subsection `### Every ticket names the project's people`, after *Every ticket carries its own CTA* and before *How a question on the map is answered*; the line added to the map body template after the `**What I need from you:**` line; Mode 1 steps 3 and 4 and Mode 2 step 5 amended. No rule removed.

**Decisions taken inside the slice.**

- The subsection sits under `### Tickets`, after the section on the closing block, because the line goes right after that block.
- In prose the line is quoted in backticks, and the next paragraph says that in the ticket body it is plain text. The map template shows it as plain text inside the template's fence, as the skill shows every body template.
- Two short sentences the plan did not spell out: "When you rewrite the map's closing line later, keep this line at the end" (otherwise the rewrite when the effort closes could drop it), and "On the markdown fallback there is no GitHub ticket, so there is no line either."

**Validation evidence.** No behaviour-carrying code in this slice, so no seams were declared and there is no red-green trace; validation is checklist-based.

```
$ grep -n "Named so that GitHub tells them about this ticket and every comment on it" .claude/skills/timone-wayfind/SKILL.md
61:Named so that GitHub tells them about this ticket and every comment on it: @<each login>
142:**The line.** End the body with a blank line, then one line: the words `Named so that GitHub tells them about this ticket and every comment on it:`, ...
$ grep -n "instructors" .claude/skills/timone-wayfind/SKILL.md; echo "exit: $?"
140:**Where the people are found.** Read `timone.yaml`. Use the project's `instructors` when it lists any. Otherwise use the top-level `operator`. ...
exit: 0
$ grep -n "operator" .claude/skills/timone-wayfind/SKILL.md; echo "exit: $?"
140:(same line)
exit: 0
$ npx vitest run src/process-text.test.ts
 Test Files  1 passed (1)
      Tests  41 passed (41)
```

- [x] Mode 1 steps 3 and 4 and Mode 2 step 5 each tell the session to name the people — pass; each links to the subsection.
- [x] The subsection says where the people are found, that the names are plain text, that nobody is assigned, and what to do when the file names nobody — pass.
- [x] The wording matches `NAMED_LINE_START` in `src/daemon/people.ts` word for word — pass. Checked by the orchestrator after 46a landed: the constant is `"Named so that GitHub tells them about this ticket and every comment on it:"`, the same words as lines 61 and 142.
- [x] The amendment is marked with its date and PRD-08 R3; no other rule of the skill is changed — pass; the `Claiming:` rule is untouched.
- [x] The text follows *Writing to the human* — pass: short sentences, plain words.

Tests run at slice end: `src/process-text.test.ts` only (the slice changes no code). This slice ran in parallel with 46a: no shared files, and neither touches anything outside the working tree.

**What 46b must know.** The skill quotes the line word for word. If the wording in `src/daemon/people.ts` ever changes, this skill must change with it.

## 46b — An issue the runner files on Timone names the people of the `timone` project

**Built.** When the runner files an issue on Timone, the body it sends is now `withPeopleNamed(body, namedPeople(deps.manifest, "timone"))`. So the issue names the people of the `timone` project: its `instructors` when it lists any, otherwise the operator. It never names the people of the project the run is on. When the manifest names nobody, the body is sent exactly as the runner wrote it. The title and the one `bug` label do not change. `commentTimoneIssue` does not change.

**Files touched.**

- `src/runner/actions.ts` — one import (`withPeopleNamed` from `../daemon/people.js`); in `fileTimoneIssue`, the `body` sent to `createIssue` goes through `withPeopleNamed`. Nothing else.
- `src/runner/actions.test.ts` — `world()` takes a second, optional argument, `manifest`, with `MANIFEST` as its default (one line of its doc comment says so); the exact body in "files a Timone issue on the timone project, labelled bug" now ends with the names line; five new tests (cases 1–5) right after it. `MANIFEST` is unchanged.
- `src/adapters/github-tickets.test.ts` — two assertions added at the end of "opens an issue with each label as its own argument, and answers its number" (case 6). Its input and its existing assertion are unchanged.
- `doc/plans/phases/reports/phase-46-handoffs.md` — this section.

**Decisions taken inside the slice.**

- **`world()` gained a `manifest` argument.** Cases 2–4 need a different manifest, and `world()` always used `MANIFEST`. The default keeps every other test as it was. Each different manifest is built from `MANIFEST` with spread: case 2 adds `instructors: ["client-person"]` to `scratch-app`, case 3 adds `instructors: ["alice"]` to `timone`, case 4 is `{ projects: { ...MANIFEST.projects } }` (no operator, no instructors).
- **The other `fileTimoneIssue` tests had no exact body.** "writes no approval, whatever the runner does…" and "writes down each thing the runner tried…" call it but check only the record, so they did not change.
- **Cases 2 and 3 went green on arrival in the TDD order.** The plan prescribes the one line, and that line already reads the `timone` project, so after case 1 there was no smaller honest step left. To show they are not vacuous, each was run against the code before the change (red) and against a mutation that makes the wrong choice the case guards against (red). See below.
- **Case 6 keeps the test's input unchanged**, as 46a did for its guard. The body `"The check stopped because the forge refused a call."` has no names; the added assertion checks that the value after `--body` is that body. The adapter passes any body through as given.
- **Mutation tooling.** Each probe was a temporary edit, undone straight after the run by copying back a saved copy of the file (`/tmp/46b-actions.ts`, `/tmp/46b-gh.ts`, `/tmp/46b-ght.ts`). `git diff --stat` after each one showed only this slice's changes.

Refactor I would do but did not: none in this slice.

**Validation evidence.**

Every red/green run below was `npx vitest run src/runner/actions.test.ts -t "Timone issue"` (or `-t` with the test's own name), or `npx vitest run src/adapters/github-tickets.test.ts -t "opens an issue with each label"`.

1. *"names the operator on a Timone issue when the timone project lists no instructors, under the runner's own words (R2)"* — `MANIFEST` (operator `fvermaut`, `timone` with no instructors). Written together with the update to *"files a Timone issue on the timone project, labelled bug"*, whose expected body is now the literal `"Seen on scratch-app #12 at 2026-09-27T11:40:00Z, in session 3f1c9a52.\n\n" + "Named so that GitHub tells them about this ticket and every comment on it: @fvermaut"`. Red, both:
   ```
   × files a Timone issue on the timone project, labelled bug
     → expected [ { project: { …(2) }, …(3) } ] to deeply equal [ { project: { …(2) }, …(3) } ]
   × names the operator on a Timone issue when the timone project lists no instructors, under the runner's own words (R2)
     → expected 'Seen on scratch-app #12, in session 3…' to contain '@fvermaut'
   ```
   Green after `body: withPeopleNamed(body, namedPeople(deps.manifest, "timone"))` and the import: `Tests  2 passed | 51 skipped (53)`.
2. *"names the timone project's people on a Timone issue, never those of the project the run is on (R2)"* — **green on arrival** (the line from case 1 already reads `timone`). Against the code before the change (`git show HEAD:src/runner/actions.ts`): red, `→ expected 'Seen on scratch-app #12, in session 3…' to contain '@fvermaut'`. Probe: read the run's own project, `namedPeople(deps.manifest, deps.project.name)` → red, same message (only this test fails). Restored → `Tests  3 passed`.
3. *"names the timone project's instructors on a Timone issue, and not the operator they replace"* — **green on arrival**, for the same reason. Against the code before the change: red, `→ expected 'Seen on scratch-app #12, in session 3…' to contain '@alice'`. Probe: name the operator alone, `deps.manifest.operator === undefined ? [] : [deps.manifest.operator]` → red, same message (only this test fails). Restored → `Tests  4 passed`.
4. *"files a Timone issue with the runner's body as it is when the manifest names nobody (R5)"* — checks `result.ok` is `true` and the body is exactly `"Seen on scratch-app #12, in session 3f1c9a52."`. **Cannot go red honestly**: the code before the change sends the body unchanged (green there too), and after the change `withPeopleNamed` returns it unchanged when nobody is named. Probe: add the line always, with whatever names there are (`` `${body}\n\nNamed so that … on it: ${…join(" ")}` ``) → `× … names nobody (R5) → expected 'Seen on scratch-app #12, in session 3…' to be 'Seen on scratch-app #12, in session 3…' // Object.is equality`. Restored → `Tests  5 passed`.
5. **Guard, green before and after.** *"keeps a Timone issue's title and its one label, bug, when it names people"* — green on the code before the change and after it. Probe: `labels: [TIMONE_BUG_LABEL, "timone"]` → `→ expected [ 'bug', 'timone' ] to deeply equal [ 'bug' ]`. Restored → green.
6. **Guard, green before and after.** In *"opens an issue with each label as its own argument, and answers its number"*, two added lines: `expect(calls[0].args[calls[0].args.indexOf("--body") + 1]).toBe("The check stopped because the forge refused a call.")` and `expect(calls[0].args).not.toContain("--assignee")`. Green on arrival. Probe: add `"--assignee", "@me"` to the argv in `createIssue` → the existing whole-argv `toEqual` fails first (`expected [ 'issue', 'create', '--repo', …(11) ] to deeply equal [ … …(9) ]`). Second probe, with that `toEqual` also removed for the run: `→ expected [ 'issue', 'create', '--repo', …(11) ] to not include '--assignee'`. Both files restored → green.

Validation commands, as run from `projects/timone`:

```
$ npx vitest run src/runner/actions.test.ts src/adapters/github-tickets.test.ts src/daemon/people.test.ts
 ✓ src/daemon/people.test.ts (5 tests)
 ✓ src/adapters/github-tickets.test.ts (80 tests)
 ✓ src/runner/actions.test.ts (57 tests)
 Test Files  3 passed (3)
      Tests  142 passed (142)

$ npm run type-check; echo "exit: $?"
> tsc --noEmit
exit: 0

$ git diff src/runner/ | grep -n "commentTimoneIssue\|comment_timone_issue\|issueComments"; echo "exit: $?"
exit: 1
```

`npm test` was **not run**: the person running this build asked that only the tests of what changes run while working, and that the whole suite run once at the phase close, by the orchestrator. It is deferred to the phase close.

- [x] Cases 1–4 were red before the change and are green after it — pass for 1, 2 and 3: each is red against the code before the change (shown above); 1 was the TDD red, 2 and 3 were green on arrival in the TDD order and each was also shown red by a mutation probe. **Case 4 could not be red before the change**: the code before the change already sends the body unchanged, which is exactly what case 4 asks. It was proven not vacuous by a mutation probe. All four are green after.
- [x] Cases 5 and 6 are green before and after; both are guards — pass, each with a mutation probe.
- [x] `commentTimoneIssue` and its tests are unchanged — pass: the diff has no line of it (grep exit 1).
- [ ] The whole suite passes — **deferred to the phase close** (see above).

Tests run at slice end: `src/runner/actions.test.ts`, `src/adapters/github-tickets.test.ts`, `src/daemon/people.test.ts`.

**What delivery must know.**

- The runner's Timone issues now end with the names line, so the issue's last line is no longer the runner's own last line. A runner prompt or a check that reads the end of a Timone issue body would see the names line there. No test in the three files read the end of that body apart from the one exact-body test updated here.
- `fileTimoneIssue` names the people of the project called `timone`, the same project `timoneProject()` files on. If that name ever changes, both must change together.
- A comment on a Timone issue (`commentTimoneIssue`) names nobody, as PRD-08 puts comments out of scope.
