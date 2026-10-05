# Phase 53 — Delivery Report

- **Date:** 2026-10-05
- **Phase:** [phase-53.md](../phase-53.md) — `Complete`, verified in [phase-53-verification.md](phase-53-verification.md)
- **Branch:** `timone/218-2-every-question-names-the-command` @ `7b251a2`
- **Base:** `main` — the project's default branch. The branch was cut from `main` at `3d7c360` and is not stacked.
- **Pull request:** opened against this report from the branch above; its address is in the ticket [#218](https://github.com/fvermaut/timone/issues/218).
- **Screen:** no user-facing screen in this phase (`Screens changed: none`; the messages are read on GitHub) — [ADR-0052](../../../adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md), [ADR-0057](../../../adr/0057-every-screen-a-phase-changes-is-looked-at-and-its-figures-read-on-the-preview-data.md)
- **Questions for the human:** none — the verification report's section of that name says none.
- **Departures:** [`phase-53-departures.md`](phase-53-departures.md) — 4 entries (3 from the build, 1 from the check).

## Scope

Piece 2 of the [list of pieces for #213](../../breakdowns/ticket-213.md), driven by ticket [#218](https://github.com/fvermaut/timone/issues/218). Claims PRD-09.R1, PRD-09.R2, PRD-09.R3 (MUST) and PRD-09.R5 clause 1 (MUST), in the [criteria register](../../../specs/prd/prd-09-a-question-names-the-command-that-answers-it-in-a-terminal.criteria.md). Every question the machine asks, on a ticket or a pull request, now carries the line "You can answer here in writing, or in your terminal by running `timone takeover <project>#<n>`." just above its last line, with the ticket's real number. It is left out in three cases: a request for a missing key, the question whether a misspelled word meant "approve", and a question after a terminal session that did not settle things. `process.md`, the runner's instructions and twelve step instructions say the same.

## How to try it

### Against the preview

This project has no preview configured for pull requests (`timone.yaml` gives `timone` no `preview` binding). Use the local steps.

### On a local checkout

Set up the project as its [README.md](../../../../README.md) says, then check out the branch `timone/218-2-every-question-names-the-command`.

1. `npm ci && npm run build && npx tsc --noEmit` — exit 0.
2. `npx vitest run src/channels/terminal.test.ts src/daemon/outcomes.test.ts src/runner/actions.test.ts src/runner/driver.test.ts src/runner/brief.test.ts src/daemon/prompts.test.ts src/daemon/poll.test.ts` — all pass.
3. `npm run --silent replay -- --dry` — prints 22 of 22 cases passed. This plays the scripted right answers, with no model.
4. `npm run --silent replay`, in a terminal logged in to the model — should print that all cases passed. This is the one check that shows what the real runner does in the three cases. It was not run (see below).
5. `npx vitest run` — the whole suite. In the build container 70 tests fail, all on a refused push to `main`; on your own machine all should pass.
6. To see a question as it reaches a ticket, read [phase-53-verification.md](phase-53-verification.md) § PRD-09.R1. It quotes one:
   > You can answer here in writing, or in your terminal by running `timone takeover fixture#12`.
   >
   > **What I need from you:** say red or blue (ticket).

## Verification outcome

From [phase-53-verification.md](phase-53-verification.md) — 0 of 2 fix loops consumed. No check failed and there is no regression.

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-09.R1 | MUST | api | BLOCKED in part — 7 of 8 checks PASS; the real runner's choice not observed | 0 |
| PRD-09.R2 | MUST | api | PASS | 0 |
| PRD-09.R3 | MUST | api | BLOCKED in part — 9 of 12 checks PASS; the real runner's choice not observed, once per clause | 0 |
| PRD-09.R5 | MUST | api | PASS (clause 1 this phase; clauses 2 and 3 re-run) | 0 |
| PRD-05.R2 | MUST | api | PASS (regression; clause 2b BLOCKED, as before: GitHub cannot be read from here) | 0 |
| PRD-05.R3 | MUST | api | PASS (regression) | 0 |
| PRD-05.R4 | MUST | api | PASS (regression) | 0 |
| PRD-05.R5 | MUST | api | PASS (regression) | 0 |
| PRD-05.R7 | MUST | api | PASS (regression; its real-runner clause BLOCKED: needs a real model) | 0 |
| PRD-05.R10 | MUST | api | PASS (regression) | 0 |
| PRD-05.R11 | MUST | api | PASS (regression) | 0 |
| PRD-05.R18 | MUST | api | BLOCKED (regression) — the recorded replay against the real model is older than this build | 0 |
| PRD-07.R1 | MUST | api | PASS (regression) | 0 |
| PRD-07.R2 | MUST | api | PASS (regression) | 0 |
| PRD-07.R3 | MUST | api | PASS (regression) | 0 |
| PRD-07.R4 | MUST | api | PASS (regression) | 0 |
| PRD-07.R6 | MUST | api | PASS (regression) | 0 |
| PRD-07.R9 | MUST | api | PASS (regression) | 0 |
| PRD-07.R10 | MUST | api | PASS (regression) | 0 |
| PRD-07.R12 | MUST | api | PASS (regression) | 0 |
| PRD-08.R2 | MUST | api | PASS (regression) | 0 |
| PRD-08.R4 | MUST | api | PASS (regression) | 0 |
| PRD-08.R5 | MUST | api | PASS (regression) | 0 |
| PRD-09.R4 | MUST | api | PASS (regression) | 0 |

### Outstanding for the human

- [ ] PRD-09.R1, PRD-09.R3, PRD-05.R18 — the replay with the real model was not run: `npm run --silent replay`, on this branch, in a logged-in terminal. It should print that all cases passed. Only it shows whether the runner leaves the command out for a missing key, a misspelled "approve" and after a terminal session, and keeps it otherwise.
- [ ] The whole test suite was not run outside the container: 70 tests fail there because it refuses pushes to `main` inside test repositories. They fail on `main` too (timone issue #220). Run `npx vitest run` on your own machine before merging.
- [ ] Live gate owed (by [ADR-0059](../../../adr/0059-a-live-check-only-the-operator-can-run-rides-to-the-pull-request.md)): on scratch-app with the daemon running, see one question posted by the runner and one posted by a step, each with the sentence and the exact command; copy the command into a terminal and see the session open. The criteria that owe a fresh live gate are listed in [phase-53-verification.md](phase-53-verification.md) § Live gates.

No HUMAN-CHECK scripts: no criterion in scope is on the `human` channel.

## Standards review — phase 53

- **Read:** `git diff origin/main...HEAD -- . ':!doc/plans' ':!doc/specs' ':!STATUS.md'` (all 29 files); for context, the current `src/daemon/outcomes.ts` (lines 1–59), `src/runner/actions.ts` (lines 215–254), `src/channels/terminal.ts` and `src/runner/tools.ts` (enum lines); `standards/code-smells.md`, `standards/typescript.md`, `standards/testing.md`; `tsconfig.json`, and the `package.json` scripts. The project has no `doc/standards.md`, so `code-smells.md` and the two stack entries apply with no project overrides. There is no ESLint or Prettier config. `tsc` runs in strict mode.
- **Diff:** `origin/main...HEAD` — 29 files (non-process), +993/−62
- **Findings:** 4

### 1. Three functions now read the closing line to decide whether a message asks something — Duplicated code

- **Where:** `src/daemon/outcomes.ts:54–59` (new), next to `src/daemon/outcomes.ts:33–43` and `src/runner/actions.ts:247–254`
- **What:** The new `isQuestion` repeats the parsing in `askedFor`, which sits a few lines above it in the same file:
  `const at = body.lastIndexOf(NEEDED_FROM_YOU); if (at === -1) return false; const asked = (body.slice(at + NEEDED_FROM_YOU.length).split("\n")[0] ?? "").trim();`
  `askedFor` does the same thing: `const at = body.lastIndexOf(NEEDED_FROM_YOU); ... body.slice(at + NEEDED_FROM_YOU.length).split("\n")[0]?.trim()`. A third reader, `asksSomething` in `actions.ts`, checks the same line by its own rule: any line, and "nothing" counts. The `post` action uses both rules on one body: `asksSomething` at line 1035, then `isQuestion` through `withTwoWaysToAnswer` at line 1062.
- **Why it matters:** Duplicated code, rule of three. This is three copies of one decision ("what does the closing line ask?"), each with slightly different rules. The next change to the closing line has to find all three.
- **Suggested remediation:** Add one exported function in `outcomes.ts` that returns the text of the last closing line. Build `askedFor` (with its length limit), `isQuestion` (with the "nothing" test) and the runner's check on top of it. — not applied here

### 2. Two different tests for "the body already holds this ticket's command", and a second copy of the command's words — Duplicated code / Magic string

- **Where:** `src/runner/actions.ts:223`, `src/runner/actions.ts:230–233`, `src/runner/actions.ts:1047–1063`, and `src/channels/terminal.ts:43`
- **What:** `actions.ts` adds `const TAKEOVER = "timone takeover";`. This repeats the start of the string that `takeoverCommand` builds in `terminal.ts` (`` `timone takeover ${project}#${ticket}` ``). Then two different tests decide whether the body holds the right command:
  - `holdsExactly(body, command)` is a regex with no backticks: `` new RegExp(`${escaped}(?!\\d)`) ``.
  - `withTwoWaysToAnswer` uses `` body.includes(`\`${takeoverCommand(project, ticket)}\``) ``, which needs backticks.

  A body that holds `timone takeover scratch-app#12` without backticks passes the runner's check. `withTwoWaysToAnswer` then does not see the command, so it adds the sentence, and the command is written twice.
- **Why it matters:** Duplicated code, because one decision has two definitions. Magic string, because the command's words are written out in a second module instead of coming from the one function that owns them.
- **Suggested remediation:** Move the test "does this body name the takeover command for this ticket" into `channels/terminal.ts`, next to `takeoverCommand`. Use that one test both in `post` and in `withTwoWaysToAnswer`, and build the prefix from the same source. — not applied here

### 3. The three cases that leave the command out are written in four places, with no shared constant — Duplicated code (repeated decision)

- **Where:** `src/runner/tools.ts:95–104`, `src/runner/brief.ts:182` and `src/runner/brief.ts:215`, `src/daemon/prompts.ts:149–152`
- **What:** The zod schema declares `.enum(["missing-key", "approval-word", "terminal-did-not-settle-it"])`. `brief.ts` then writes the same three values out by hand inside string literals: `'... by setting leaveOutTakeover: "missing-key" when ..., "approval-word" when ..., and "terminal-did-not-settle-it" when ...'`, and `set leaveOutTakeover to "missing-key".` `writingBlock` in `prompts.ts` describes the same three cases again in prose. The enum values are not exported, so if a value is renamed or added in `tools.ts`, nothing makes `brief.ts` follow.
- **Why it matters:** Duplicated code. This is the "repeated one-liner" case: the same list is restated in sibling places, and the copies are what a fourth case would miss.
- **Suggested remediation:** Export the values as an `as const` array from `tools.ts`. Build the `brief.ts` rule text from that array, so a change to the schema shows up in the brief. — not applied here

### 4. One rule added as the same sentence to 12 skill files — Shotgun surgery

- **Where:** `.claude/skills/*/SKILL.md:11` (timone-adr, -deliver, -execute, -grill, -handover, -onboard, -plan, -prd, -prototype, -triage, -verify, -wayfind)
- **What:** Each file gains the same appended text: "✏ 2026-10-05 ([PRD-09](…)): a question also names `timone takeover <project>#<n>`, with this project's name and this ticket's number, and says both ways to answer … except in the three cases that [Writing to the human](../../../process.md#writing-to-the-human) names." The same paragraph already links to `process.md#writing-to-the-human`, and this diff adds the full rule there.
- **Why it matters:** Shotgun surgery. One behaviour change is spread as identical small edits across 12 files. The paragraph it extends was already copied into every skill before this diff, so the diff extends an existing pattern; it did not start it.
- **Suggested remediation:** Keep the rule only in `process.md`'s "Writing to the human" section, which every skill already links to. If a skill really needs the rule written out, say it once in a shared place rather than 12 times. — not applied here

No test-quality findings. The new tests go through the public functions (`withTwoWaysToAnswer`, `isQuestion`, `actions.post`, `stagePrompt`, `takeoverPrompt`, `buildBrief`, `pollOnce`). Their expected strings are written out by hand, not computed the way the code computes them.

## Spec review — phase 53

- **Read:** `git diff origin/main...HEAD` on the non-process files (src/**, process.md, .claude/skills/**); the diff of `doc/specs/prd/prd-09-a-question-names-the-command-that-answers-it-in-a-terminal.criteria.md`; that register and `doc/specs/prd/prd-09-a-question-names-the-command-that-answers-it-in-a-terminal.md` in full; `doc/plans/phases/phase-53.md` lines 1–22; current content of `src/daemon/prompts.ts` (lines 462–510, 1279–1440), `src/daemon/poll.ts` (lines 1455–1490), `src/runner/actions.ts` (lines 920–945, 1190–1210, 1034–1075), `.claude/skills/timone-deliver/SKILL.md` (from a search); a search of `src/` for every place that posts a comment, every use of `What I need from you`, and "misspell".
- **Diff:** `origin/main...HEAD` — 29 files (non-process), +993/−62
- **Findings:** 3

The main paths are all in place:
- **Questions code writes:** the limit notice, on both of its paths (`src/runner/actions.ts` and `src/runner/driver.ts`), and the notice that the approved pieces could not be acted on. Every other message code writes ends in "nothing", so none of them is a question.
- **The runner's `post` action:** it adds the sentence on the ticket and on the pull request, and on the pull request it uses the ticket's number.
- **The three cases:** the runner marks each one with `leaveOutTakeover`.
- **What a step is told:** the sentence word for word, through `writingBlock`. The takeover session's prompt is told to leave the command out.
- **`timone status`:** the last line is not touched, because the sentence goes above it.
- **Written rules:** `process.md` and the twelve skills say it.

The three findings below are small gaps at the edges.

### 1. A question that already holds the command is posted without saying both ways to answer — PRD-09.R1

- **Where:** `src/channels/terminal.ts:42–43`
- **What:** `` if (!isQuestion(body) || body.includes(`\`${takeoverCommand(project, ticket)}\``)) return body; ``. When the runner's body already holds `` `timone takeover <project>#<n>` `` in backticks, for example "Run `timone takeover fixture#12` to look at it.", the sentence is not added. The `post` action at `src/runner/actions.ts:1054–1063` lets this body through, because `holdsExactly` passes. The brief says "Do not write it yourself", but no code enforces it.
- **Why it matters:** R1 clause 1: the question must contain the command "AND it says that the person can answer either by writing on the ticket or by running the command". On this path the second part is not ensured.
- **Suggested remediation:** test for the whole sentence, not only the command. Or refuse a body that names the command without the sentence, as the code already refuses a body that names the wrong command. — not applied here

### 2. The check for the right command passes a body that also holds a wrong one or a placeholder — PRD-09.R2

- **Where:** `src/runner/actions.ts:1054–1059` (with `holdsExactly` at `src/runner/actions.ts:230`)
- **What:** `if (body.includes(TAKEOVER) && !holdsExactly(body, command))` refuses only when the right command is missing. A body holding both `timone takeover fixture#12` and `timone takeover fixture#13`, or both the right command and `timone takeover <project>#<n>`, is posted.
- **Why it matters:** R2 clause 1: the command "holds no placeholder: the project's name and the ticket's number are the real ones". A wrong command or a placeholder can reach the ticket next to the right one.
- **Suggested remediation:** refuse when any `timone takeover …` in the body is not exactly the command for this run's ticket. — not applied here

### 3. The delivery step is told to add the sentence only to *Questions for you*, but a question carried from the build goes in the departures section — PRD-09.R1, PRD-09.R5

- **Where:** `src/daemon/prompts.ts:499–504`; `.claude/skills/timone-deliver/SKILL.md:28`
- **What:** The prompt says "When the pull request's *Questions for you* section holds a question, end that section with this sentence…". The skill (line 28) puts a question carried from the build "in the departures section, first section of the pull request body". That is the place that holds it. The skill does say to end that section with the sentence, using the `<project>#<n>` placeholder. The prompt, which carries the sentence already filled in, does not name that section. The prompt's line also does not repeat that the three cases of R3 leave the sentence out. Its `writingBlock` states those cases for "a comment", not for the pull request's description.
- **Why it matters:** R1 clause 2 covers a question "in the pull request's description". R5 clause 1 says each place that tells the machine how to ask must say that a question names the command. The prompt and the skill name different sections. On the carried-question path the sentence depends on the step filling in the placeholder by itself.
- **Suggested remediation:** have the delivery prompt name the departures section, as well as *Questions for you*, as a place that ends with the filled-in sentence. Say there that the three cases leave it out. — not applied here

## Notes

- Not stacked: the base is `main`, and no other pull request has to merge first. Phase 51 ([#222](https://github.com/fvermaut/timone/pull/222)) is already on `main`.
- The three changes from the plan recorded by the build are in [phase-53-departures.md](phase-53-departures.md): each part ran only its own tests, with the whole suite once at the end, as the runner asked; two tests that compare the whole spending limit message word for word gained the new line; and the whole suite does not pass in the container (70 push tests). The check added a fourth entry: the parts that need the real model were not run.
- The completion report lists open observations no requirement covers; Spec findings 2 and 3 above confirm two of them.
