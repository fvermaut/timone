# Phase 44 — Delivery Report

- **Date:** 2026-10-04
- **Phase:** [phase-44.md](../phase-44.md) — `Complete`, verified in [phase-44-verification.md](phase-44-verification.md)
- **Branch:** `timone/199-1-numbered-files-never-take-the-same-num` @ `aa65bb5`
- **Base:** `main` — the project's default branch. The branch was cut from `main` at `2b68cbb`; it is not stacked.
- **Pull request:** opened against this report, from this branch into `main`. Its address is on [timone#199](https://github.com/fvermaut/timone/issues/199).
- **Screen:** no user-facing screen in this phase (the phase file's `Screens changed: none`) — [ADR-0052](../../../adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md), [ADR-0057](../../../adr/0057-every-screen-a-phase-changes-is-looked-at-and-its-figures-read-on-the-preview-data.md)
- **Questions for the human:** none in the verification report. Two questions reach the pull request from earlier steps: the new entry in the list of files allowed to run git (from the build), and the replay that could not run here (from the check). Both are in *Notes* and at the top of the pull request.
- **Departures:** [phase-44-departures.md](phase-44-departures.md) — 5 entries (4 from the build, 1 from the check).

## Scope

[timone#199](https://github.com/fvermaut/timone/issues/199), piece 1 of the [breakdown for #197](../../breakdowns/ticket-197.md). The phase claims [PRD-07.R8](../../../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md) (MUST), clause 1 only: two tickets of one project worked at the same time never give a phase file, an ADR or a triage record the same number. Clauses 2 and 3 are piece 2; R8 stays `draft`. The decision is [ADR-0062](../../../adr/0062-a-numbered-file-takes-its-number-by-reserving-it-on-the-projects-remote.md). It delivers four parts:

1. 44a — `node dist/cli.js number <project> <kind>` reserves the next number on the project's remote and prints it. Kinds: `phase`, `adr`, `triage`, `prd`.
2. 44b — a run's push guard lets it create a reservation, and nothing more.
3. 44c — the build and the check find their plan as the phase file their branch added, not the highest number.
4. 44d — the five skills that number files, and `process.md`, use the command.

## How to try it

### Against the preview

Timone has no preview configured for pull requests (`timone.yaml` has no `preview` binding for it). Use the local steps.

### On a local checkout

Setup is in the project's [README.md](../../../../README.md). Then, on this branch:

1. `npm run build`, then `npx vitest run`. Expected: 61 files, 1609 tests pass.
2. `npx vitest run src/numbers.test.ts src/commands/number.test.ts`. Expected: all pass, including the test where five clones ask for a number at the same time and get five different numbers.
3. `node dist/cli.js number timone chapter; echo "exit: $?"`. Expected: one sentence naming `phase, adr, triage, prd`, and exit 1.
4. A run may create a reservation. Run:
   `printf 'refs/timone/numbers/phase/45 %s refs/timone/numbers/phase/45 %s\n' 1111111111111111111111111111111111111111 0000000000000000000000000000000000000000 | node dist/cli.js guardrails pre-push --branch timone/7-x; echo "exit: $?"`
   Expected: exit 0.
5. A run may not move a reservation, and still may not push to `main`. Run the same line with the last value `2222222222222222222222222222222222222222`, then again with both refs `refs/heads/main`. Expected: both refused, exit 1.
6. The check's own test, with six sessions at once against temporary repositories: the command is in [phase-44-verification.md](phase-44-verification.md), under *Evidence → PRD-07.R8*. Expected: exit 0; clause 1 PASS, clauses 2 and 3 BLOCKED (not built yet).
7. The replay against the real model, which could not run here: `npm run --silent replay`, from a terminal logged in to Claude (about $2.50).

**Do not run `number` against the real remote to try it.** A reservation there is permanent ([ADR-0062](../../../adr/0062-a-numbered-file-takes-its-number-by-reserving-it-on-the-projects-remote.md) D4).

## Verification outcome

From [phase-44-verification.md](phase-44-verification.md). 0 of 2 fix loops consumed.

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-07.R8 (clause 1) | MUST | api | PASS | 0 |
| PRD-05.R2 | MUST | api | PASS (clause 2b BLOCKED, as before) | 0 |
| PRD-05.R3 | MUST | api | PASS | 0 |
| PRD-05.R4 | MUST | api | PASS | 0 |
| PRD-05.R5 | MUST | api | PASS | 0 |
| PRD-05.R7 | MUST | api | PASS (clause 1, the runner, BLOCKED) | 0 |
| PRD-05.R10 | MUST | api | PASS | 0 |
| PRD-05.R11 | MUST | api | PASS | 0 |
| PRD-05.R18 | MUST | api | BLOCKED | 0 |

### Outstanding for the human

- [ ] PRD-05.R18, and the runner clause of PRD-05.R7 — the replay against the real model could not run here (no model login): run `npm run --silent replay` on this branch from a logged-in terminal (about $2.50) before merging.
- [ ] PRD-05.R2 clause 2b — needs a read of GitHub; it was BLOCKED here as on the last check.
- [ ] Live gates owed: PRD-01.R5, R8, R10, R15 and PRD-02.R1, R2, R4, R8 — the diff touches what they depend on. The list and the last gate of each are in [phase-44-verification.md](phase-44-verification.md) § Live gates. The same watched run is the only way to learn whether GitHub accepts a push to `refs/timone/numbers/…` from a box's App token.

No HUMAN-CHECK scripts: no criterion in scope is on the `human` channel.

## Standards review — phase 44

- **Read:** the diff `git diff 2b68cbb...aa65bb5 -- src .claude process.md`; `src/numbers.ts`, `src/commands/number.ts`, `src/daemon/push-guard.ts`, `src/daemon/push-guard.test.ts`, `src/daemon/prompts.ts`, `src/process-text.test.ts`, `src/guards/checkouts.test.ts`, the five changed `SKILL.md` files and `process.md` (as hunks); for context `src/git.ts` and `src/daemon/hooks.ts` (their git runners); `standards/code-smells.md`, `standards/typescript.md` and `standards/testing.md` (all Approved); `tsconfig.json` and `package.json`. `doc/standards.md` does not exist in this project, so `code-smells.md` and the stack entries are the only reference. The only tooling is `tsc` in strict mode. There is no ESLint, Prettier or Biome config.
- **Diff:** `2b68cbb...aa65bb5`: 18 files, +962/−22
- **Findings:** 4

### 1. The layout of the reservation ref is written in four places across two modules (Duplicated code)

- **Where:** `src/numbers.ts:143–145`, `src/numbers.ts:150–156`, `src/daemon/push-guard.ts:33–35`
- **What:** `reservationRef` builds `` `refs/timone/numbers/${kind}/${number}` ``. Eight lines lower, `numbersReserved` does not call it. It writes the prefix again as a glob, `` `refs/timone/numbers/${kind}/*` ``, and a third time as a regex, `/\trefs\/timone\/numbers\/([a-z]+)\/(\d+)$/`. That regex then checks that the kind it captured equals `kind`, which the glob already guaranteed. `push-guard.ts` writes the same layout a fourth time: `` `^refs/timone/numbers/(${NUMBER_KINDS.join("|")})/\\d+$` ``.
- **Why it matters:** this breaks the rule of three for Duplicated code, and the copies are one duplicated decision. If the ref namespace changes, all four copies must change together. If the guard's copy is missed, reservations get refused at push time.
- **Suggested remediation:** export the prefix, or a builder and matcher for reservation refs, from `numbers.ts`. Have `numbersReserved` and `push-guard.ts` use it. Drop the redundant kind check. Not applied here.

### 2. `numbers.ts` adds another private git runner next to `src/git.ts` (Duplicated code)

- **Where:** `src/numbers.ts:44–90`
- **What:** the diff adds `runGit` and `git(dir, args, input)`. The second one throws `` `git ${args.join(" ")} failed: ${gitWords(result)}` ``. `src/git.ts:18` already has a private `runGit` that throws the same message (`` `git ${args.join(" ")} failed: ${reason}` ``), with the same choice of stderr first, then stdout. `src/daemon/hooks.ts:925` has another one. The new copy has a real reason to exist: it needs stdin for `commit-tree -F -` and a result that does not throw for `push`. But the throwing wrapper and its error wording copy `git.ts`.
- **Why it matters:** Duplicated code. This is at least the third git runner in `src`. How a failed git command is reported is now decided in several places that can drift apart.
- **Suggested remediation:** move a git runner that accepts stdin and has a non-throwing variant into `src/git.ts`, and have `numbers.ts` import it. Not applied here.

### 3. `reserveNumber`'s `note` option has no caller outside the tests (Speculative generality)

- **Where:** `src/numbers.ts:234`, `src/numbers.ts:243`
- **What:** `options: { note?: string } = {}` is passed only in `src/numbers.test.ts:205–206` (`{ note: "for timone/1-x" }`). The only production caller, `src/commands/number.ts:61`, calls `reserveNumber(dir, kind)`. The CLI exposes no `--note` flag, so `defaultNote()` always supplies the value in real use.
- **Why it matters:** Speculative generality. It is a parameter with no production caller and no requirement behind it.
- **Suggested remediation:** remove the option and always use `defaultNote()`. If the test needs a fixed note, set `TIMONE_RUN_BRANCH` there with `vi.stubEnv`. Not applied here.

### 4. A second import line from `vitest` in the same test file (Inconsistent vocabulary, minor)

- **Where:** `src/daemon/push-guard.test.ts:6–7`
- **What:** `import { afterEach, describe, expect, it } from "vitest";` is followed by a new line, `import { vi } from "vitest";`.
- **Why it matters:** this is a small consistency point. The project has no lint config to catch a duplicate import, so the tools will not report it. The rest of the codebase imports from a module on one line.
- **Suggested remediation:** add `vi` to the existing import. Not applied here.

## Spec review — phase 44

- **Read:** `git diff 2b68cbb...aa65bb5 -- src .claude process.md doc/specs`; `src/numbers.ts`, `src/commands/number.ts`, `src/daemon/push-guard.ts`, `src/daemon/prompts.ts` (the changed hunks); the new tests in `src/numbers.test.ts`, `src/process-text.test.ts` and `src/daemon/prompts.test.ts`; `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.md` (R8 paragraph and "What this changes"); `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md`; `doc/plans/phases/phase-44.md` lines 1–18. I also searched with `git grep` for any other numbering or "newest/highest phase" wording in `src`, `.claude`, `process.md`, and read short parts of `src/runner/facts.ts` and `src/daemon/breakdown.ts` to confirm the runner already reads "the phase file the branch added".
- **Diff:** `2b68cbb...aa65bb5` — 18 files, +962/−22
- **Findings:** 2

The core of PRD-07.R8 clause 1 is built and matches the criterion:
- `reserveNumber` takes the highest number from every remote branch, from the folder on disk and from the reservations already made. It then takes the next number by creating a ref on the remote. That ref can be created only once.
- The push guard allows a run to create a reservation ref and nothing more. The default branch stays closed, as PRD-05.R3 requires.
- The plan, ADR, onboard and triage skills now use the command, and so does `process.md`.
- A test has five clones ask for a number at the same time, for each of phase, ADR and triage. This is the test R8's Falsified-by line asks for.
- The PRD kind goes beyond R8's list. The verification hint ("every document numbered by taking the next free number") covers it, so I do not count it as scope creep.
- The register change only adds a dated partial-evidence note and keeps R8 at `draft`. The phase header says to do exactly that.

### 1. The verify skill still picks "the report with the highest phase number" as the latest one — PRD-07.R8 (clause 1, the consequence the phase claims to handle in 44c)

- **Where:** `.claude/skills/timone-verify/SKILL.md:39`
- **What:** The verify skill still says to read "the *Environment* section of the latest verification report on the default branch … the report there with the highest phase number (`doc/plans/phases/reports/phase-MM-verification.md`)". Slice 44c changed the execution and verification prompts so they no longer equate "newest" with "highest number". This skill line was not changed.
- **Why it matters:** Under PRD-07.R8 clause 1, two tickets now reserve numbers when they plan, not when they merge. Example: ticket A reserves 45 and ticket B reserves 46. B merges first, then A. The highest-numbered report on the default branch is now 46, but the latest is 45. The smoke-failure baseline would then come from an older report, so a new smoke failure could be marked as old. The phase header says 44c handles the consequence of this change on "the newest phase file". This line has the same problem and was missed.
- **Suggested remediation:** Pick the report most recently merged to the default branch, for example by the commit that last added a `phase-*-verification.md` on it, instead of by the highest number. Add `timone-verify` to the "never says newest/highest" text check. Not applied here.

### 2. `process.md` states the rule for every numbered file, but the command covers only four kinds — PRD-07.R8

- **Where:** `process.md:94`
- **What:** The new paragraph says "**A file whose name carries a number takes the number from a command.** Phase files, ADRs, triage records and PRDs carry a number … A number is never taken by counting the files in a folder." The same file's layout block still lists other numbered files: `feedback/NNN-<slug>.md` at line 90 and `wayfinder/NN-<slug>/…`. `timone-wayfind` also writes `tickets/NNN-<slug>.md`. `NUMBER_KINDS` in `src/numbers.ts:12` has no kind for any of these, so a session writing one cannot follow the rule as stated.
- **Why it matters:** R8 clause 1 covers only phase files, ADRs and triage records, so this does not break the criterion. But the normative text now states a general rule that the build cannot satisfy. A session writing a feedback record or a non-GitHub wayfinder ticket gets two instructions that contradict each other.
- **Suggested remediation:** Limit the sentence to the four kinds the command serves and say that the other numbered files keep their current rule. Or add those kinds to `NUMBER_KINDS` in a later piece. Not applied here.

## Notes

- **Question from the build, for the reviewer.** The test `src/guards/checkouts.test.ts` keeps a short list of files allowed to run git or reach into `projects/`. This phase adds `src/numbers.ts` (runs git) and `src/commands/number.ts` (resolves a project folder), each with its reason. The build took this as decided by ADR-0062. Is that acceptable? (First entry of [phase-44-departures.md](phase-44-departures.md).)
- **The replay was not run.** The runner asked that it be listed as not run and that the reviewer run it before merging. It is the first unticked item under *Outstanding for the human*.
- **Known gaps the build left, not fixed** (from [phase-44-complete.md](phase-44-complete.md)): a project folder that does not exist gives git's unclear `spawn git ENOENT`; `doc/feedback/` is numbered but has no kind (no skill writes it); the guard's folder pattern misses `resolve(process.cwd(), x.path)` written in one call.
- Both reviews ran in separate contexts, at the same time, on the range `2b68cbb...aa65bb5`. Neither read the other's report or the verification report.
