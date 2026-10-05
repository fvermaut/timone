# Phase 53: Every question names the command — each question the machine asks on a ticket or a pull request carries `timone takeover <project>#<n>` and says both ways to answer, except in three cases

> **Status:** Planned.

> **Companion phases:** [phase 51](phase-51.md) — piece 1 of the same list; it made a takeover typed while a step runs wait instead of refusing, so the command this phase puts in every question is one the machine no longer refuses. It shares no code with this phase. Governing decisions: [ADR-0067](../../adr/0067-a-takeover-typed-while-a-step-runs-is-written-on-the-run-and-takes-it-when-the-step-ends.md) — why naming the command in a fresh question is now allowed. [ADR-0032](../../adr/0032-a-human-command-asks-the-daemon-to-act.md) — no message may name a command the machine would refuse; that rule stays. [ADR-0056](../../adr/0056-a-build-stages-question-rides-to-the-pull-request.md) — a build's question is carried to the pull request, which is why the pull request's description is one of the places a question is written. [ADR-0060](../../adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md) — the runner posts through its `post` action, which is where code can add the command. [ADR-0048](../../adr/0048-a-verification-probe-is-kept-proved-able-to-fail-and-hidden-from-the-builder.md) D4 — the builder never opens the probe folders. [ADR-0050](../../adr/0050-timone-becomes-a-managed-project-once-the-run-path-is-fixed.md) D5 — this project is Timone, so `process.md` and `.claude/skills/` are its source and are committed here. [ADR-0051](../../adr/0051-timone-verifies-itself-by-live-gate-and-a-regression-set-is-narrowed-by-what-it-depends-on.md) D4 and [ADR-0059](../../adr/0059-a-live-check-only-the-operator-can-run-rides-to-the-pull-request.md) — the regression set and the live gate below.

> **Screens changed:** none — no slice changes a screen Timone draws. (The messages are read on GitHub.)

## Requirements

> **PRD:** [prd-09-a-question-names-the-command-that-answers-it-in-a-terminal.md](../../specs/prd/prd-09-a-question-names-the-command-that-answers-it-in-a-terminal.md) (its *In scope*, lines 28–36) — criteria in [prd-09-a-question-names-the-command-that-answers-it-in-a-terminal.criteria.md](../../specs/prd/prd-09-a-question-names-the-command-that-answers-it-in-a-terminal.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-09.R1 | MUST | Every question, on the ticket or the pull request, posted by the runner, a step, or code, contains the command with the ticket's number, and says the person can answer in writing or by running it (criteria lines 9–26) |
| PRD-09.R2 | MUST | The command is in code formatting with nothing else inside, has the real project name and ticket number, and `timone status` still shows what the question asks (lines 28–42) |
| PRD-09.R3 | MUST | No `timone takeover` at all in a request for a missing key, in the question whether a misspelled word meant approve, and in a question after a terminal session that did not settle things (lines 44–59) |
| PRD-09.R5 | MUST | *Clause 1 only:* `process.md`, the runner's instructions in `src/runner/brief.ts` and the step skills say that a question names the command, with the three cases left out (lines 86–98; clauses 2 and 3 were phase 51's) |

This is piece 2 of the [list of pieces for #213](../breakdowns/ticket-213.md), approved by fvermaut on 2026-10-05 with two pieces.

## Goal Description

Nothing the machine writes names the takeover command today, apart from the takeover session's own instructions. Questions are written in four ways: code builds two of them (`limitNotice` and `piecesFailedNotice` in `src/runner/comments.ts`); the runner writes its own through `post` in `src/runner/actions.ts`; a step writes its own from its session, following `src/daemon/prompts.ts` and the skills; and the delivery step writes a carried question into the pull request's *Questions for you* section. This phase reaches all four, and the written rules, in one pull request, as the list of pieces asks.

**Decisions taken at planning, below the ADR bar.** Each is local to one or two files, covered by tests at a public seam, and easy to change, so none is hard to reverse.

- **One sentence, built in one place.** `twoWaysToAnswer(project, ticket)` in `src/channels/terminal.ts`, beside `takeoverCommand`, returns exactly: ``You can answer here in writing, or in your terminal by running `timone takeover <project>#<n>`.`` It is put on its own line, **above** the last line that starts with `**What I need from you:**`, with a blank line between. That last line is not touched, so `askedFor` reads the same words and `LONGEST_ASK` is never reached (R2 clause 2). On the pull request the number is the ticket's.
- **What counts as a question, in code.** `isQuestion(body)` in `src/daemon/outcomes.ts`: the text after the last `**What I need from you:**`, to the end of that line, trimmed, is not empty and does not start with "nothing" (case-insensitive). This is the register's definition. It has no length limit, unlike `askedFor`.
- **Code adds the sentence to the runner's questions; the runner names the exception.** The `post` tool gains an optional field `leaveOutTakeover: "missing-key" | "approval-word" | "terminal-did-not-settle-it"`. Without it, a question is posted with the sentence added (unless the body already holds the exact command). With it, a body holding `timone takeover` is refused. A body holding `timone takeover` with another project or number is refused, naming the right command. The other way round — the runner writes the command and code refuses a question without it — was weighed and not chosen: R1 is a MUST, and code that adds the line cannot forget it, while each exception is a choice only the runner can see.
- **A step is told the sentence word for word.** The step's prompt knows the project and the ticket, so it carries the finished sentence, with no placeholder to fill in. Code cannot fix a step's comment after it is posted, because it cannot tell a missing-key request from another question; so steps are covered by their instructions and by verification reading them (the criteria register's verification hint says so).
- **A takeover session's own comments leave the command out.** It is posted at the end of a terminal session, which is the third case of R3, and the person has just used the command.
- **The pieces-failed notice now names one command.** Its comment and the `namesACommand` test in `src/runner/driver.test.ts` (~988) said it names no command. R1 names this notice. The test is narrowed to allow exactly the takeover command, and the doc comment says why.

**What this phase owes before delivery** (ADR-0051 D4). The diff touches `src/channels/terminal.ts`, `src/daemon/outcomes.ts`, `src/daemon/prompts.ts`, `src/runner/` (`comments.ts`, `actions.ts`, `tools.ts`, `driver.ts`, `brief.ts`, `replay/cases.ts`), their tests, `process.md`, every skill under `.claude/skills/`, and documents under `doc/`.

- **The regression set**, computed from the registers on 2026-10-05 (MUST, `api`, `verified`, and a `Depends-on` this diff touches or none): PRD-05 R2, R3, R4, R5, R7, R10, R11, R18; PRD-08.R5; PRD-09.R4 (no `Depends-on`); PRD-07 R1, R2, R3, R4, R6, R9, R10, R12 (`src/runner/`, `src/daemon/`, `process.md`, the planning skill); PRD-08 R2 and R4 (`src/runner/actions.ts`).
- **A live gate is owed.** `live` criteria PRD-01 R5, R8, R10, R11, R12, R15 and PRD-03.R3 depend on skills this phase edits, and PRD-02 R1, R2, R4, R8 on `src/daemon/`. By ADR-0059 it rides to the pull request as an unticked check: on scratch-app, with the daemon running, see one question posted by the runner and one posted by a step, each with the sentence and the exact command; copy the command into a terminal and see the session open.
- **What no criterion watches**: that a message asking for nothing is left exactly as it was; that a comment with no `**What I need from you:**` line is still refused; that the run's wait is still read from the last line. The existing tests of those are a hard gate: `src/runner/actions.test.ts`, `src/runner/driver.test.ts`, `src/runner/session.test.ts`, `src/daemon/outcomes.test.ts`, `src/daemon/poll.test.ts`.

**What is not done here.** The request to review and merge a pull request, messages that ask for nothing, and decision-ticket bodies on a map are out of scope (PRD-09, *Out of scope*). Requirement statuses stay `draft`; verification sets them.

## Context & Prerequisites

- **The probe folders are closed to the builder.** No file this phase writes contains a probe folder's path, and no slice opens one.
- **`src/runner/comments.ts`** — `limitNotice` (~66) ends with a question; `piecesFailedNotice` (~127) ends with a question. Neither takes the project or ticket. Callers: `limitRefusal` in `src/runner/actions.ts` (~627), the pieces failure in `actions.ts` (~678), `atLimit` in `src/runner/driver.ts` (~696). All have `deps.project.name` and `run.ticket`. The other builders (`departureNotice`, `piecesApprovedNotice`, `modelUnreachableNotice` in `session.ts`, `holdComment` and `letBuildComment` in `src/planner/actions.ts`, the comments in `src/daemon/poll.ts`) ask for nothing and do not change.
- **`src/runner/actions.ts`** — `post` (~1009) checks `asksSomething` (~229), then posts on the ticket or on the open pull request. Its input schema is `postInput` in `src/runner/tools.ts` (~83).
- **`src/runner/brief.ts`** — the missing-key rule (~182) already forbids the command; the *Writing to a person* section (~203) ends with the closing-line rule. `brief.test.ts` checks the missing-key rule (~588–611, `not.toContain("timone takeover")`).
- **`src/daemon/prompts.ts`** — `writingBlock()` (~134) is shared by every step prompt and by `takeoverPrompt` (~1309); it takes no arguments today. `deliveryPrompt` (~429) says what goes in the pull request's first section. `PromptContext` has `project.name` and `ticket.number`.
- **`src/runner/replay/`** — `cases.ts`: `postCall` (~506) builds a `post` call; case #120 (`aTerminalSessionThatClearedNothing`, ~1741) fails on any comment holding `timone takeover`, and its right call (~1885) posts a missing-key question; `aPullRequestClosedWithAReview` (~1344) and `theOneWordThatSettlesIt` (~2016) are the models for the two new cases. `npm run replay -- --dry` plays each case's right calls through the real actions with no model.
- **Standards.** No `doc/standards.md`; the central `standards/typescript.md`, `standards/testing.md` and `standards/code-smells.md` apply: TypeScript strict, vitest, tests at public seams.

## Sub-phases

### Sub-phase 53a: The sentence, and the two questions code writes

**[MODIFY]** `src/channels/terminal.ts` — `twoWaysToAnswer(project, ticket)` and `withTwoWaysToAnswer(body, project, ticket)`: when `isQuestion(body)` and the body does not hold the exact command, insert the sentence and a blank line at the start of the line holding the last `**What I need from you:**`; otherwise return the body unchanged.
**[MODIFY]** `src/daemon/outcomes.ts` — `isQuestion(body)`.
**[MODIFY]** `src/runner/comments.ts` — `limitNotice` and `piecesFailedNotice` take `{ project, ticket }` and return their text through `withTwoWaysToAnswer`. Update `piecesFailedNotice`'s doc comment.
**[MODIFY]** `src/runner/actions.ts`, `src/runner/driver.ts` — pass `deps.project.name` and `run.ticket` at the three call sites.
**[MODIFY]** `src/channels/terminal.test.ts`, `src/daemon/outcomes.test.ts`, `src/runner/actions.test.ts`, `src/runner/driver.test.ts`, `src/daemon/poll.test.ts` — cases below; `namesACommand` (~988) allows exactly `` `timone takeover <project>#<n>` `` and still rejects any other command or a standing note.

**Seams under test (TDD):** `withTwoWaysToAnswer` and `isQuestion` are pure. The notices are seen where they are posted: `runnerActions` and `RunnerDriver` with the fake adapters their test files already use. Red-green:
1. `withTwoWaysToAnswer` on a question: the result contains `` `timone takeover scratch-app#66` `` exactly once, matching ``/`timone takeover scratch-app#66`/``, and the sentence sits on the line just above the last `**What I need from you:**` line; `askedFor` of the result equals `askedFor` of the input (R2).
2. On a body whose last line says "nothing", or "nothing. If you want … say so here.": returned unchanged. On a body already holding the exact command: unchanged.
3. `isQuestion`: true for an ask; false for "nothing", for no marker, for an empty marker line; true for an ask longer than 300 characters.
4. The spending limit notice posted by `limitRefusal` and by `atLimit` holds the command with the run's ticket number and the sentence; its last line is as before (R1 clause 3).
5. The pieces-failed notice holds the command and the sentence; `namesACommand` stays false for it.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"   # expected 0
npx vitest run src/channels/terminal.test.ts src/daemon/outcomes.test.ts src/runner/actions.test.ts src/runner/driver.test.ts src/daemon/poll.test.ts; echo "exit: $?"   # expected 0
```

- [ ] Cases 1–5 pass, each one's red run recorded in the handoff before its green run.
- [ ] Every other existing case of those files passes unchanged (hard gate), apart from `namesACommand`, whose change is listed in the handoff. ✏ 2026-10-05 (build, timone#218): also apart from the two cases that compare the whole limit notice word for word (`actions.test.ts`, "says on the ticket where the work stands when the limit is reached: what is done, and what comes next"; `poll.test.ts`, "tells the ticket once that it spent its limit, frees the project, and wakes nothing, for a new run of a ticket over its limit"). Case 4 requires that notice to change, so they gain the sentence line and nothing else; the handoff lists them.

---

### Sub-phase 53b: The runner's questions carry the command, and the runner names the three exceptions

**[MODIFY]** `src/runner/tools.ts` — `postInput` gains `leaveOutTakeover` (optional enum, three values), described in one sentence each.
**[MODIFY]** `src/runner/actions.ts` — `post`, after the closing-line check: a body holding `timone takeover` is refused when `leaveOutTakeover` is set (`This question leaves the takeover command out. Remove it, and post again.`), or when it does not hold the exact command for this ticket (`The takeover command for this ticket is \`timone takeover <project>#<n>\`. Use that one, or leave it out.`). Otherwise, without the field, the body goes through `withTwoWaysToAnswer(body, deps.project.name, run.ticket)` — the ticket's number on the pull request as well.
**[MODIFY]** `src/runner/brief.ts` — *Writing to a person* gains one rule: a question names `timone takeover` with this ticket; `post` adds the sentence, so do not write it; set `leaveOutTakeover` for a missing key, for asking whether a misspelled word meant approve, and for a question after a terminal session that did not settle things. The missing-key rule (~182) says to set `leaveOutTakeover: "missing-key"`, and keeps not naming the command.
**[MODIFY]** `src/runner/replay/cases.ts` — `postCall` takes an optional `leaveOutTakeover`. Case #120's right call sets `"missing-key"`. Two new cases, added to `CASES`: **a pull request closed with no reason** (model: `aPullRequestClosedWithAReview`, with no review or comment) — the judge passes when a ticket post asks whether to do the work again or stop and holds `` `timone takeover <project>#<ticket>` `` with the ticket's number exactly once; **a misspelled approval word** (model: `theOneWordThatSettlesIt`, the word `aprovd` on the list of pieces) — the judge passes when the approval is recorded with nothing asked, or a question is asked; it fails on any post holding `timone takeover`. Its right call asks with `leaveOutTakeover: "approval-word"`.
**[MODIFY]** `src/runner/actions.test.ts`, `src/runner/brief.test.ts` — cases below.

**Seams under test (TDD):** the `post` action as `runnerActions` exposes it, with the recording adapter of `actions.test.ts` (~410) — the runner's only way to post. The brief's text through the helpers of `brief.test.ts`. The replay cases through `npm run replay -- --dry`. Red-green:
1. `post` on the ticket with a question and no field: the posted body holds the sentence and `` `timone takeover <project>#<ticket>` ``; its last line is the one given.
2. `post` on the pull request: the command carries the run's ticket number, not the pull request's (R1 clause 2).
3. `post` with each of the three field values and a body without the command: posted unchanged. With a body holding `timone takeover`: refused, nothing posted (R3).
4. `post` of a body naming `timone takeover other#9`: refused with the right command named; nothing posted.
5. `post` of a body asking nothing: posted unchanged.
6. The brief holds the new rule and names the three field values; the missing-key rule names `missing-key` and still does not contain `timone takeover` (R5 clause 1, R3).
7. `npm run replay -- --dry`: case #120's right call, run before its field is added, fails its judge (the sentence is added); with the field, it passes. Both new cases pass with their right calls.

> Sub-phase 53a must be complete before starting this sub-phase (it uses `withTwoWaysToAnswer` and `isQuestion`).

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"   # expected 0
npx vitest run src/runner/actions.test.ts src/runner/brief.test.ts src/runner/replay/harness.test.ts; echo "exit: $?"   # expected 0
npm run replay -- --dry; echo "exit: $?"   # expected 0, every case passes, the two new ones included
```

- [ ] Cases 1–7 pass, with red runs recorded in the handoff.
- [ ] Every existing case of `actions.test.ts` passes unchanged (hard gate: PRD-07 R1–R3, PRD-08 R2 and R4 are watched there).

---

### Sub-phase 53c: Each step is told the sentence word for word

**[MODIFY]** `src/daemon/prompts.ts` — `writingBlock(context)` gains, after the closing-line rule: when a comment asks them for something, put this sentence on its own line just above that last line, word for word — the finished `twoWaysToAnswer(context.project.name, context.ticket.number)` — and leave it out, with no `timone takeover` anywhere in the comment, when asking for a missing key or secret, when asking whether a misspelled word meant approve, or when a terminal session on this ticket has just ended without settling what you ask. All step prompts pass their context. `takeoverPrompt` uses a form without the sentence that says: do not write the takeover command in what you post here; the person has just used it. `deliveryPrompt` adds: when the pull request's *Questions for you* section holds a question, end that section with the same sentence, with this ticket's number.
**[MODIFY]** `src/daemon/prompts.test.ts` — cases below.

**Seams under test (TDD):** `stagePrompt(stage, context)` and `takeoverPrompt(...)`, the exported builders — what a step reads. Red-green:
1. For every prompted stage, with project `scratch-app` and ticket 66: the prompt holds `` `timone takeover scratch-app#66` `` and the sentence, and names the three cases.
2. No prompt holds `<project>` or `<n>` next to `timone takeover` (R2: no placeholder).
3. The delivery prompt says the *Questions for you* section ends with the sentence.
4. `takeoverPrompt`'s text tells the session not to write the takeover command in what it posts, and does not hold the sentence. Its existing line naming the command it was opened by stays.

> Sub-phase 53a must be complete before starting this sub-phase (it uses `twoWaysToAnswer`). It shares no file with 53b and may run beside it.

#### Agent Validation Steps

```bash
npx tsc --noEmit; echo "exit: $?"   # expected 0
npx vitest run src/daemon/prompts.test.ts; echo "exit: $?"   # expected 0
```

- [ ] Cases 1–4 pass, with red runs recorded in the handoff.
- [ ] Every existing case of `prompts.test.ts` passes unchanged.

---

### Sub-phase 53d: The written rules say the same

No behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based.

**[MODIFY]** `process.md` — under *Writing to the human*, one dated paragraph (`✏ 2026-10-05 ([PRD-09](doc/specs/prd/prd-09-a-question-names-the-command-that-answers-it-in-a-terminal.md))`): **a question names the command that answers it in a terminal** — the sentence above the last line, with the ticket's number, on the pull request too; and the three cases that leave it out, each with its reason. The paragraph that starts **Every message ends with the line *What I need from you:*** gets one dated sentence pointing to it. The paragraph that starts *"Every command a ticket names can be run while the daemon is running"* is not changed.
**[MODIFY]** `.claude/skills/*/SKILL.md` — in every skill's line that ends *Every message ends with a call to action, and "no action needed" is one.* (twelve skills; `timone-update` has no such line and is left as it is), add one sentence: a question also names `timone takeover <project>#<n>` and says both ways to answer, except in the three cases, as *Writing to the human* says. `timone-triage`'s comment template shows the sentence above the closing line. `timone-deliver`'s *Questions for you* template, and its paragraph on a question carried from an earlier step, say the section ends with the sentence. `timone-wayfind`'s *A comment that asks what is still open* gains the sentence before the CTA.
**[MODIFY]** `doc/specs/prd/prd-09-a-question-names-the-command-that-answers-it-in-a-terminal.criteria.md` — R1's `Falsified-by:` names, by file and test name, the tests of 53a cases 4–5, 53b cases 1–3, and the two new replay cases, each seen to fail first. No status line changes.
**[MODIFY]** `doc/specs/prd/prd-09-a-question-names-the-command-that-answers-it-in-a-terminal.md` — the `Phases:` line adds `[phase 53](../../plans/phases/phase-53.md) (piece 2, #218)`.

> Sub-phases 53a–53c must be complete before starting this sub-phase (the words describe what the code now does).

#### Agent Validation Steps

```bash
grep -n "a question names the command" process.md; echo "exit: $? (expected 0)"
grep -L "timone takeover <project>#<n>" .claude/skills/*/SKILL.md   # expected: prints only .claude/skills/timone-update/SKILL.md
grep -n "phase-53" doc/specs/prd/prd-09-a-question-names-the-command-that-answers-it-in-a-terminal.md; echo "exit: $? (expected 0)"
git diff -U0 origin/main -- doc/specs/prd/ | grep -E '^[-+]- \*\*Status:\*\*'; echo "exit: $? (expected 1: no status line changed)"
npx vitest run; echo "exit: $?"   # expected 0, the whole suite
```

- [ ] `process.md`, `src/runner/brief.ts` and every skill say a question names the command, and name the three cases (R5 clause 1).
- [ ] Plain words in every added line: no metaphor, no process jargon.

## Dependency graph

```
53a → (none)        the sentence, isQuestion, and the two notices code writes
53b → 53a           the runner's post adds it, the three exceptions, the brief, the replay cases
53c → 53a           each step's instructions carry the sentence; may run beside 53b
53d → 53a–53c       process.md, the skills, PRD-09's Falsified-by and phase list
```
