# Phase 46: Every ticket the machine opens names the project's people — step tickets, Timone issues, and the charting instructions

> **Status:** Complete — see [reports/phase-46-complete.md](reports/phase-46-complete.md).

> **Companion phases:** [phase 45](phase-45.md) — merged; it was the last change to `openStepTickets` in `src/daemon/chunk-zero.ts` (the `Needs:` relations), whose loop this phase changes again at the one line that builds a step's body. [phase 44](phase-44.md) — merged; it gave this phase its number through `node dist/cli.js number`. Governing decisions: [ADR-0042](../../adr/0042-timone-acts-under-its-own-identity.md) — the machine opens tickets as `timone-agent[bot]`, which is why nobody follows them and why this phase exists. [ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) — an assignee means a person holds a ticket, so this phase names people and never assigns them (R4). [ADR-0040](../../adr/0040-one-step-is-one-ticket-and-doneness-is-a-fact-about-a-ticket.md) — a step ticket carries its piece's one line and a link to the list; this phase adds the names to that body and changes nothing else about it. [ADR-0060](../../adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md) D6 — the named people of a project are its `instructors`, or else the `operator`, which is what `namedPeople` returns. [ADR-0050](../../adr/0050-timone-becomes-a-managed-project-once-the-run-path-is-fixed.md) D5 — this project is Timone, so the charting skill under `.claude/skills/` is its source and is committed here. [ADR-0051](../../adr/0051-timone-verifies-itself-by-live-gate-and-a-regression-set-is-narrowed-by-what-it-depends-on.md) D4 and [ADR-0059](../../adr/0059-a-live-check-only-the-operator-can-run-rides-to-the-pull-request.md) — decide which checks this phase owes, below.

> **Screens changed:** none — no slice changes anything a person sees on a screen Timone draws. (The names appear in GitHub ticket text.)

## Requirements

> **PRD:** [prd-08-a-ticket-the-machine-opens-names-its-people.md](../../specs/prd/prd-08-a-ticket-the-machine-opens-names-its-people.md) — criteria in [prd-08-a-ticket-the-machine-opens-names-its-people.criteria.md](../../specs/prd/prd-08-a-ticket-the-machine-opens-names-its-people.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-08.R1 | MUST | A ticket opened for a piece of an approved list names the project's people in its body; a ticket that already exists is not opened again and its body is not changed |
| PRD-08.R2 | MUST | An issue the runner files on Timone names the people of the `timone` project, added by code, and never the people of the project where the fault was seen |
| PRD-08.R3 | SHOULD | The charting instructions tell the session to name the project's people on the map ticket and on every decision ticket, and say where to find them |
| PRD-08.R4 | MUST | Nobody is assigned because of this: no `--assignee`, and a step ticket that names a person can still be chosen as the next step |
| PRD-08.R5 | MUST | When `namedPeople` gives nobody, the ticket opens as before, with no `@`-name added and no lone `@` |
| PRD-08.R6 | MUST | On a live run on scratch-app, fvermaut is notified of a ticket the machine opened and of a comment on it later |

This is the only piece of the [list of pieces for #207](../breakdowns/ticket-207.md). It needs nothing.

## Goal Description

The machine opens tickets as `timone-agent[bot]` (ADR-0042). Nobody follows a ticket the bot opened, so GitHub tells nobody about it or about any comment on it later. fvermaut asked for this to change on [#207](https://github.com/fvermaut/timone/issues/207). GitHub cannot add a watcher for someone else; naming a person with `@` in the ticket's text subscribes them. The requirements chose naming over assigning, because an assigned ticket means a person holds it and the machine would stop working on it (ADR-0044).

Code opens tickets in two places: `openStepTickets` in `src/daemon/chunk-zero.ts`, one ticket per piece when a list is approved, and the runner's `fileTimoneIssue` action in `src/runner/actions.ts`, which files a fault in Timone on Timone's own repository. A session opens tickets in a third place, by its own `gh` command, when it charts a large piece of work (`.claude/skills/timone-wayfind/SKILL.md`). This phase adds one pure function that writes the names into a ticket body, makes both code paths call it, and changes the charting instructions to say the same thing in words. The two code paths share that function, which is why the list made this one piece.

**The requirements were approved by a person.** PRD-08's status line reads `Active — approved by fvermaut on 2026-10-04T13:20:05Z`, and the list of pieces carries fvermaut's approval of 2026-10-04T13:41:15Z with one piece. The runner's instructions for this step also say it skipped both approvals and recorded that it did; the committed files show the approvals were given, and the list has one piece in either reading, so the plan is the same.

**Decisions taken at planning, below the ADR bar.** Each was checked against the three-part test (hard to reverse, surprising without context, a real trade-off). None is hard to reverse: each is a few lines in one function, and a ticket's text can be written differently next time.

- **One pure function, `withPeopleNamed(body, people)`, in a new file `src/daemon/people.ts`.** `src/runner/actions.ts` already imports from `src/daemon/` (`chunk-zero.ts`, `steps.ts`), so the runner reaching into `src/daemon/` adds no new direction of import. It does not go in `src/manifest.ts`, which reads configuration and writes no ticket text; `namedPeople` stays there and is called by each caller.
- **The names go on a line of their own at the end of the body, after a blank line:** `Named so that GitHub tells them about this ticket and every comment on it: @alice @bob`. The PRD leaves the words to the build; they are fixed here so the executing session does not choose. The same words fit a step ticket and a Timone issue, which is why they do not say "this project". **The names are plain text, never inside backticks or a code block**, because GitHub sends no notification for a name inside code.
- **The line is always added, even when the body already names someone.** R2 says the name is added by code "whatever words the runner wrote"; checking the body for names first would make the result depend on those words. A person named twice is notified once.
- **Each login is cleaned before it is written:** surrounding spaces removed, any `@` already in front of it removed (a login written `@alice` in `timone.yaml` would otherwise become `@@alice`, which notifies nobody), and a login that is then empty is dropped. With no login left, the body comes back exactly as given (R5). The manifest already refuses an empty `operator` or `instructors` entry, so this is a guard, not a path in use.
- **`openStepTickets` takes the people as a fourth, required parameter**, not as a field of `ChunkZeroDeps`. `ChunkZeroDeps` is shared with `tryMergeChunkZero`, which opens nothing; a required parameter makes the compiler refuse a caller that forgets it. Its one caller, `closeChunkZero` in `src/runner/actions.ts`, passes `namedPeople(deps.manifest, deps.project.name)`.
- **A Timone issue names the people of the `timone` project**, `namedPeople(deps.manifest, "timone")`, the same entry `timoneProject` already reads for the repository. The project the run is on plays no part.
- **No change to the adapter.** `createStep` and `createIssue` in `src/adapters/github-tickets.ts` already pass the body through and carry no `--assignee`, and the `TicketingAdapter` port has no method that assigns. R4 is held by tests that say so, so a later change that adds an assignee fails a test.
- **The charting instructions name people by reading `timone.yaml`.** A session that opens tickets with `gh` cannot call the function; the skill tells it to read the project's `instructors`, or else the top-level `operator`, and to end every ticket body it opens with the same line. This is R3, and it is a SHOULD because code cannot check each session.

**What this phase owes before delivery.** ADR-0051 D4 narrows the checks to criteria whose `Depends-on` this phase touches. This phase changes `src/daemon/chunk-zero.ts`, a new `src/daemon/people.ts`, `src/runner/actions.ts`, tests under `src/adapters/`, and `.claude/skills/timone-wayfind/SKILL.md`; it does not change `src/manifest.ts` or any adapter source file. Among `verified` MUST criteria: the `api` one [PRD-07.R10](../../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md) depends on `src/runner/` and `src/adapters/github-tickets.ts`, so its tests (`src/daemon/chunk-zero.test.ts`, `src/daemon/breakdown.test.ts`) are a hard gate; the `live` ones PRD-02 R1, R2, R4 and R8 depend on `src/daemon/`, and PRD-08.R6 is itself `live`. So **a live gate is owed before delivery**: R6's watched run on scratch-app, never on ivtrends, which also exercises the daemon path PRD-02 R1 watches. R6 needs fvermaut's own notifications, which only fvermaut can read, so by ADR-0059 it rides to the pull request as an unticked item and R6 stays `draft` until then. **What no criterion watches:** that opening step tickets stays idempotent — a re-run opens nothing twice and rewrites no step's body — and that the runner's Timone issue keeps its title and its `bug` label. The existing tests of those in `src/daemon/chunk-zero.test.ts` and `src/runner/actions.test.ts` are a hard gate in every slice that touches `src/`, not a courtesy.

**What is not done here** (PRD-08's out-of-scope list). Tickets opened before this change are not edited. Pull requests the machine opens are not changed. Comments the machine posts are not changed. Nothing is added to `timone.yaml`. `process.md` and the planning skill are not changed: they say what a step ticket carries, and that stays true with a line added. R1 to R6 stay `draft` after this phase; verification sets their status.

## Context & Prerequisites

- **`src/manifest.ts`** — `namedPeople(manifest, name): string[]`: the project's `instructors` when set, else `[operator]`, else `[]`. Not changed.
- **`src/daemon/chunk-zero.ts`** — `openStepTickets(deps, run, project)`: reads the list, lists existing steps by title, calls `adapter.createStep(project, run.ticket, { title, body: stepBody(chunk, run.ticket, read.path) })` only for a title not already there, writes the `blocked by` relations, rewrites the initiative's body (`initiativeMap`) and labels it. Returns a sentence on failure and never throws. `stepBody` is private to the file.
- **`src/runner/actions.ts`** — `runnerActions(deps, run)`; `closeChunkZero` (around line 632) builds `chunkZero: ChunkZeroDeps` and calls `openStepTickets(chunkZero, current(), deps.project)`; `fileTimoneIssue` (around line 1047) calls `deps.adapter.createIssue(timone, { title, body, labels: [TIMONE_BUG_LABEL] })`, where `timone = timoneProject(deps.manifest)`. `namedPeople` is already imported there.
- **`src/daemon/chunk-zero.test.ts`** — `fakeForge()` records `calls` (`open #N "title"`, relations, labels) and `bodies` (initiative bodies from `setTicketBody`), but not the body given to `createStep`; `depsFor(adapter, list)`; fixtures `PROJECT`, `RUN`, `R10_LIST`.
- **`src/runner/actions.test.ts`** — `world()`, `MANIFEST` (`operator: "fvermaut"`, projects `scratch-app` and `timone`, neither with `instructors`), `TIMONE_REPO`. The test "files a Timone issue on the timone project, labelled bug" asserts the exact body sent, and **must be updated** to the body with the names line; the tests around lines 1042 and 1058 call `fileTimoneIssue` too and are checked for exact bodies.
- **`src/adapters/github-tickets.test.ts`** — `fakeRunner` records each `gh` argv; existing `createStep` tests around line 777 and a `createIssue` test around line 1439.
- **`src/daemon/steps.ts`** — `nextStep(steps)`: the first step that is open, has no hold label, no assignee, and no open dependency. It reads no body.
- **`.claude/skills/timone-wayfind/SKILL.md`** — the map body template (`## The map`), `### Tickets`, *Every ticket carries its own CTA*, Mode 1 steps 3 and 4 (create the map, create the tickets), Mode 2 step 5 (create newly surfaced tickets).
- **Standards.** This project has no `doc/standards.md` — a gap onboarding left; the central `standards/typescript.md`, `standards/testing.md` and `standards/code-smells.md` apply: TypeScript strict, vitest, tests at public seams. No screen, so no accessibility work.

## Sub-phases

### Sub-phase 46a: A ticket opened for a piece names the project's people

**[NEW FILE]** `src/daemon/people.ts` — exports:
- `NAMED_LINE_START = "Named so that GitHub tells them about this ticket and every comment on it:"`
- `withPeopleNamed(body: string, people: readonly string[]): string` — pure. Cleans each login (trim, strip leading `@` characters, drop empty), keeps their order, and drops a repeat of the same login. With none left, returns `body` unchanged. Otherwise returns `body` with any trailing newlines removed, then a blank line, then `${NAMED_LINE_START} @a @b`. No backticks anywhere in the added text. A doc comment says why: GitHub notifies a person named with `@` in plain text, and the machine's tickets have no follower otherwise (ADR-0042, PRD-08).

**[NEW FILE]** `src/daemon/people.test.ts` — the cases below.

**[MODIFY]** `src/daemon/chunk-zero.ts` — `openStepTickets(deps, run, project, people: readonly string[])`; the `createStep` call's body becomes `withPeopleNamed(stepBody(chunk, run.ticket, read.path), people)`. The doc comment names the new parameter and PRD-08.R1. Nothing else in the function changes: a step found by title is still neither re-opened nor edited.

**[MODIFY]** `src/runner/actions.ts` — in `closeChunkZero`, pass `namedPeople(deps.manifest, deps.project.name)` as the fourth argument.

**[MODIFY]** `src/daemon/chunk-zero.test.ts` — `fakeForge()` also records each step body passed to `createStep` (for example `stepBodies: Map<string, string>` keyed by title); existing calls of `openStepTickets` gain a people argument; new tests below.

**[MODIFY]** `src/adapters/github-tickets.test.ts` — one assertion, below.

**Seams under test (TDD):** `withPeopleNamed` is the seam for the wording and the guards — pure, no I/O. `openStepTickets` driven with the fake forge is the seam for R1, R4 and R5 on this path — it is the public function the runner calls, and the body handed to `createStep` is exactly what reaches GitHub. `GitHubTicketingAdapter.createStep` driven with `fakeRunner` is the seam for the `gh` argv. Red-green:
1. `withPeopleNamed("Body.", ["alice", "bob"])` returns `"Body.\n\n" + NAMED_LINE_START + " @alice @bob"`.
2. `withPeopleNamed("Body.", [])` returns `"Body."` exactly; so do `["", "  "]` and `["@"]` — the result contains no `@` (R5).
3. `withPeopleNamed("Body.", ["@alice", " bob "])` names `@alice` and `@bob`, never `@@alice`; `["alice", "alice"]` names `@alice` once.
4. The added line contains no backtick.
5. `openStepTickets` with a list of three pieces and people `["fvermaut"]`: each of the three bodies given to `createStep` contains `@fvermaut`, and still starts with the piece's own line and carries `Part of #<initiative>` (R1 clause 1).
6. Same with people `["alice", "bob"]`: every body contains `@alice` and `@bob` (R1 clause 2, its Falsified-by test).
7. A re-run where the fake's `listSteps` already returns the three titles: no `createStep` call, and no `setTicketBody` call for any step number — only the initiative's own body is written (R1 clause 3).
8. People `[]`: three tickets open, bodies identical to what `stepBody` gives today and containing no `@` (R5).
9. After a first run, `nextStep` over the steps as the fake lists them (no assignees, no hold label) returns piece 1's ticket, and no recorded call assigns anyone (R4 clause 2).
10. R4 clause 1 on this path is already guarded: the test "creates a step carrying neither the hold label nor an assignee" in `src/adapters/github-tickets.test.ts` asserts the `createStep` argv has no `--assignee`. Keep it unchanged; add only an assertion there that the argv carries the body it was given, names included, right after `--body`.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
cd projects/timone
npx vitest run src/daemon/people.test.ts src/daemon/chunk-zero.test.ts src/adapters/github-tickets.test.ts src/daemon/breakdown.test.ts src/daemon/steps.test.ts src/runner/actions.test.ts
npm run type-check; echo "exit: $?"   # expected 0: every caller passes the people
# Failure probe: no code outside tests in src/ writes --assignee. Comment lines excluded.
# Expected output: only "exit: 1" (grep found no match). Checked at planning against today's code: exit 1.
grep -rn --include='*.ts' -e '--assignee' src | grep -v '\.test\.ts:' | grep -v '^\S*:\s*//' | grep -v '^\S*:\s*\*'; echo "exit: $?"
npm test
```

- [ ] Cases 1–9 were red before the change and are green after it; the handoff shows the red run.
- [ ] The existing no-assignee test for `createStep` is unchanged and green; the handoff says case 10 is a guard, not a red-green case.
- [ ] `openStepTickets` has no caller left that omits the people (`npm run type-check` exits 0).
- [ ] The whole suite passes; the existing idempotence and `Needs:` relation tests in `src/daemon/chunk-zero.test.ts` are unchanged apart from the added argument.

---

### Sub-phase 46b: An issue the runner files on Timone names the people of the `timone` project

**[MODIFY]** `src/runner/actions.ts` — `fileTimoneIssue` sends `body: withPeopleNamed(body, namedPeople(deps.manifest, "timone"))`. Title and the `bug` label are unchanged. `commentTimoneIssue` is not changed (PRD-08 out of scope: comments).

**[MODIFY]** `src/runner/actions.test.ts` — update the exact body in "files a Timone issue on the timone project, labelled bug" to the body followed by the names line; check the other `fileTimoneIssue` tests for exact bodies and update them the same way; add the tests below. A test needing a different manifest builds it from `MANIFEST` with spread, without changing `MANIFEST` itself.

**Seams under test (TDD):** `runnerActions(deps, run).fileTimoneIssue` with the test file's fake forge is the seam — it is the action the runner's tool calls, and `forge.issues` holds exactly what reached `createIssue`. `GitHubTicketingAdapter.createIssue` with `fakeRunner` for the argv. Red-green:
1. `operator: "fvermaut"`, `timone` with no `instructors`, a body naming nobody: the issue's body contains `@fvermaut` and still starts with the runner's own words (R2 clause 1, its Falsified-by test).
2. The run is on `scratch-app` with `instructors: ["client-person"]`, `timone` with none: the body contains `@fvermaut` and does not contain `@client-person` (R2 clause 2).
3. `timone` with `instructors: ["alice"]`: the body names `@alice` and not `@fvermaut`.
4. A manifest with no `operator` and no `instructors`: the issue is filed, `result.ok` is true, and its body equals the runner's body exactly (R5).
5. The issue keeps its title and its only label, `bug`.
6. Characterization, green from the start and kept as a guard: in `src/adapters/github-tickets.test.ts`, the argv `createIssue` sends carries the body it was given and contains no `--assignee` (R4 clause 1). No such assertion exists for `createIssue` today; the test "opens an issue with each label as its own argument, and answers its number" is the place for it.

> Sub-phase 46a must be complete before starting this sub-phase (it uses `withPeopleNamed` from `src/daemon/people.ts`, and both change `src/runner/actions.ts`).

#### Agent Validation Steps

```bash
cd projects/timone
npx vitest run src/runner/actions.test.ts src/adapters/github-tickets.test.ts src/daemon/people.test.ts
npm run type-check; echo "exit: $?"   # expected 0
npm test
```

- [ ] Cases 1–4 were red before the change and are green after it; the handoff shows the red run.
- [ ] Cases 5 and 6 are green before and after, and the handoff says they are guards.
- [ ] `commentTimoneIssue` and its tests are unchanged.
- [ ] The whole suite passes.

---

### Sub-phase 46c: The charting instructions name the project's people on every ticket they open

**[MODIFY]** `.claude/skills/timone-wayfind/SKILL.md` — a marked amendment (`✏ 2026-10-04 ([PRD-08](../../../doc/specs/prd/prd-08-a-ticket-the-machine-opens-names-its-people.md) R3)`):
- A short subsection under `## The map` or `### Tickets`, titled for what it says (for example **Every ticket names the project's people**): the bot opens these tickets, so nobody follows them unless named. Read `timone.yaml`: the project's `instructors` when it lists any, and otherwise the top-level `operator`. End the body of every ticket you open — the map and each decision ticket — with a blank line and `Named so that GitHub tells them about this ticket and every comment on it: @<login> …`, the same line the code writes. Plain text, never inside backticks or a code block, because GitHub notifies nobody named inside code. Never assign anyone for this; an assignee means a person holds the ticket (ADR-0044). When the file names nobody, open the ticket without the line.
- The map body template carries the line, after the closing `**What I need from you:**` line's block, written as `Named so that GitHub tells them about this ticket and every comment on it: @<each login>`.
- Mode 1 step 3 (create the map), Mode 1 step 4 (create the tickets) and Mode 2 step 5 (create newly surfaced tickets) each say to add the line, pointing at the subsection.
- The `Claiming:` rule (the session assigns a ticket to itself) is not changed; the subsection says naming is not claiming.

**Seams under test (TDD):** no behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based. A session that opens tickets with `gh` cannot be checked by code each time, which is why R3 is a SHOULD about the instructions.

> No dependency on other sub-phases. It shares no file with 46a or 46b and may run in parallel with them; it uses the wording fixed in this plan, not the code.

#### Agent Validation Steps

```bash
cd projects/timone
grep -n "Named so that GitHub tells them about this ticket and every comment on it" .claude/skills/timone-wayfind/SKILL.md   # expected: the subsection, the map template, and no fewer than two lines
grep -n "instructors" .claude/skills/timone-wayfind/SKILL.md; echo "exit: $?"   # expected 0: it says where the people are found
grep -n "operator" .claude/skills/timone-wayfind/SKILL.md; echo "exit: $?"      # expected 0
npx vitest run src/process-text.test.ts   # the process-text checks still pass on the edited skill
```

- [ ] Mode 1 steps 3 and 4 and Mode 2 step 5 each tell the session to name the people.
- [ ] The subsection says where the people are found, that the names are plain text, that nobody is assigned for this, and what to do when the file names nobody.
- [ ] The wording of the line matches `NAMED_LINE_START` in `src/daemon/people.ts` (once 46a has landed) word for word.
- [ ] The amendment is marked with its date and PRD-08 R3; no other rule of the skill is changed.
- [ ] The text follows *Writing to the human*: short sentences, plain words.

---

## Dependency graph

```
46a → (none)        the names line, and step tickets carry it (R1, R4, R5)
46b → 46a           Timone issues carry the timone project's names (R2, R4, R5)
46c → (none)        the charting instructions say the same (R3); shares no file with 46a or 46b, may run in parallel
```

R6 is not a slice: it is the live gate owed before delivery, run by fvermaut on scratch-app, and it rides to the pull request (ADR-0059).
