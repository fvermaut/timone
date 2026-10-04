# Phase 45 — Delivery Report

- **Date:** 2026-10-04
- **Phase:** [phase-45.md](../phase-45.md) — `Complete`, verified in [phase-45-verification.md](phase-45-verification.md)
- **Branch:** `timone/204-6-the-list-of-pieces-shows-what-is-built` @ `af3b65c`
- **Base:** `main` — the project's default branch. The branch was cut from `main` at `b01ff59` (phase 44 merged), which is still `main`'s head. No stacking.
- **Pull request:** opened against this report from the branch above; its address is in the ticket comment on #204.
- **Screen:** no user-facing screen in this phase (`Screens changed: none` in the phase file; the completion report's *Screen comparison* says the same) — [ADR-0052](../../../adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md), [ADR-0057](../../../adr/0057-every-screen-a-phase-changes-is-looked-at-and-its-figures-read-on-the-preview-data.md)
- **Questions for the human:** 2. The verification report's section says none from the check itself, and carries two from the completion report so the pull request asks them. The runner asked for both on the pull request.
- **Departures:** [`phase-45-departures.md`](phase-45-departures.md) — 3 entries.

## Scope

Piece 6 of the [list of pieces for #197](../../breakdowns/ticket-197.md), driven by ticket #204. It claims [PRD-07.R10](../../../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md) (MUST) and PRD-07.R11 (SHOULD).

Each piece in a list of pieces can carry a `Needs:` line. From those lines the machine says the order in words, for example "1, then 2 and 3 together, then 4". A piece with no line needs the piece above it, as before. When the list is approved, each step ticket is blocked by exactly the steps its piece needs, not by the step above it. A new command, `timone breakdown <project> <ticket>`, prints the order, and refuses a list whose `**Order:**` line is missing or says another order. The session that writes a list is told to write the `Needs:` lines and the `**Order:**` line and to run the command. The planning skill and `process.md` say the same, and add R11's preference for fewer waits and fewer shared files.

## How to try it

### Against the preview

This project has no preview configured for pull requests (`timone.yaml` gives `timone` no `bindings.preview`). Use the local steps.

### On a local checkout

Setup is in the project's [`README.md`](../../../../README.md). Then, from the timone root with this branch checked out in `projects/timone`:

1. `cd projects/timone && npm run build && npx vitest run` — the build must come first. Expect 62 test files, 1647 tests passed.
2. From the timone root: `node projects/timone/dist/cli.js breakdown timone 197 --manifest timone.yaml` — expect `1 and 2 together, then 3, then 4 and 5 together. 6 needs none of the others.` and exit 0.
3. `node projects/timone/dist/cli.js breakdown timone 103 --manifest timone.yaml` — an older list with no `**Order:**` line. Expect exit 1 and one sentence naming the `**Order:**` line to add.
4. In a copy of a list, change the `**Order:**` line to another order and run the command on it — expect exit 1 and a sentence that quotes both orders and gives the right line.

## Verification outcome

Verified in [phase-45-verification.md](phase-45-verification.md) — 0 of 2 fix loops consumed.

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-07.R10 | MUST | api | PASS | 0 |
| PRD-07.R11 | SHOULD | human | HUMAN-CHECK | 0 |
| PRD-05.R2 | MUST | api | PASS (regression; clause 2b BLOCKED) | 0 |
| PRD-05.R3 | MUST | api | PASS (regression) | 0 |
| PRD-05.R4 | MUST | api | PASS (regression) | 0 |
| PRD-05.R5 | MUST | api | PASS (regression) | 0 |
| PRD-05.R7 | MUST | api | PASS (regression; clause 1 (runner) BLOCKED) | 0 |
| PRD-05.R10 | MUST | api | PASS (regression) | 0 |
| PRD-05.R11 | MUST | api | PASS (regression) | 0 |
| PRD-05.R18 | MUST | api | **BLOCKED** (regression) | 0 |

The check's closing gate was not met only because PRD-05.R18 is BLOCKED: it needs a replay against the real model on this build, and the container had no model login. Nothing wrong was observed.

### Outstanding for the human

- [ ] PRD-05.R18 (all clauses) and PRD-05.R7 clause 1 (runner) — the replay against the real model, not run: `npm run --silent replay` on this branch, from a terminal logged in to Claude. Commit its record on the branch.
- [ ] Live gate owed for PRD-01.R10, PRD-02.R1, R2, R4 and R8 — the watched run on scratch-app, not run: a list whose pieces 2 and 3 can be built at the same time, approved, with its step tickets' relations read on GitHub. See [phase-45-verification.md](phase-45-verification.md) § Live gates. Commit its report before merging.
- [ ] PRD-07.R11 — whether the next list of pieces avoids needless waits, not run: HUMAN-CHECK script in [phase-45-verification.md](phase-45-verification.md) § HUMAN-CHECK scripts. It can only be run after merging, on the next list written.
- [ ] PRD-05.R2 clause 2b — needs a GitHub login that can read `fvermaut/scratch-app`; not run here.

## Standards review — phase 45

- **Read:** `/workspace/timone/standards/code-smells.md`, `/workspace/timone/standards/typescript.md`, `/workspace/timone/standards/testing.md`; the diff of `.claude/skills/timone-plan/SKILL.md`, `process.md`, `src/cli.ts`, `src/commands/breakdown.ts`, `src/commands/breakdown.test.ts`, `src/daemon/breakdown.ts`, `src/daemon/breakdown.test.ts`, `src/daemon/chunk-zero.ts`, `src/daemon/chunk-zero.test.ts`, `src/daemon/prompts.ts`, `src/daemon/prompts.test.ts`; for context, `src/commands/number.ts`, `src/adapters/ticketing.ts` (`dependencySchema`), and grep results across `src/commands/` and `src/daemon/`
- **Diff:** `origin/main...af3b65c` — 20 files, +2640/−27
- **Findings:** 3

### 1. `chunk-zero.ts` now builds a GitHub issue URL itself and imports a helper from the GitHub adapter — Inappropriate intimacy

- **Where:** `src/daemon/chunk-zero.ts:1` and `src/daemon/chunk-zero.ts:263–271`
- **What:** Apart from this change, the module talks to the forge only through `TicketingAdapter` and `TicketingProject` from `../adapters/ticketing.js`. The diff adds `import { repoSlug } from "../adapters/github-tickets.js";` and, in `isStepOf`, writes `` const own = `https://github.com/${repoSlug(project.repoUrl)}/issues/${number}`; `` followed by `return dependency.url.toLowerCase() === own.toLowerCase();`. So the daemon now knows how GitHub shapes its issue URLs, and that GitHub ignores letter case in owner and repository names.
- **Why it matters:** This is Inappropriate intimacy: one module uses another's internals, and the boundary is in the wrong place. The question "is this dependency an issue of this project's own repository?" is about the forge, and the adapter is the layer that knows the forge. If another ticketing binding is added, or GitHub changes its URL shape, this file has to change too, even though it never claims to be GitHub-specific.
- **Suggested remediation:** Put the answer on the adapter. Either add a method such as `isOwnIssue(project, dependency, number)` to `TicketingAdapter`, or have the adapter set a field on `Dependency` saying whether it is in the same repository. Then remove the `github-tickets.js` import from `chunk-zero.ts`. Not applied here.

### 2. The new command copies the "load the manifest, then find the project" block word for word — Duplicated code

- **Where:** `src/commands/breakdown.ts:33–51`, the same as `src/commands/number.ts:37–55`
- **What:** The block `let manifest: Manifest; try { manifest = loadManifest(options.manifest); } catch (error) { … console.error(message); process.exitCode = 1; return; }` and then `const config = manifest.projects[project]; if (config === undefined) { … "I don't know a project called "${project}"; the projects I know are: ${known}." … }` appear in both files, character for character. The same decision, with a slightly different sentence, also appears in `src/commands/cancel.ts` (twice) and `src/commands/takeover.ts`. This diff adds the fifth copy.
- **Why it matters:** This is Duplicated code under the rule of three: a fifth copy is past the point where one function costs less than the copies. The sentences have already drifted apart ("the projects I know are" against "I look after"). The next command will copy one of the versions.
- **Suggested remediation:** Pull out one helper in `src/commands/`, for example `projectFromManifest(manifestPath, project)`, that returns the project's config or reports the error and sets the exit code. Call it from `breakdown.ts`, `number.ts`, `cancel.ts` and `takeover.ts`. Not applied here.

### 3. `orderInWords` is exported for a second caller that does not exist, and its comment says it does — Speculative generality

- **Where:** `src/daemon/breakdown.ts:440–446`
- **What:** The comment says: "Exported on its own because the ticket and the step tickets say the same order, and must say it the same way." In the diff its only caller is `orderOf` in the same file (`words: orderInWords(needs)`). `chunk-zero.ts` uses `order.words` from `orderOf`, the step tickets do not say the order at all, and no test imports it.
- **Why it matters:** This is Speculative generality: an export with exactly one caller, inside its own module, and nothing that requires it. The comment also states a reason that is false in this code. That is a smaller case of Comment as deodorant: the comment gives a justification the code does not support.
- **Suggested remediation:** Make `orderInWords` a private function in the module and drop the sentence about why it is exported. Export it again only when a second caller actually needs it. Not applied here.

## Spec review — phase 45

- **Read:** `doc/plans/phases/phase-45.md` (lines 1–19), `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.md` (lines on R10/R11), `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md` (R10, R11 and the diff to it), `doc/plans/breakdowns/ticket-197.md`, and the diff of `.claude/skills/timone-plan/SKILL.md`, `process.md`, `src/cli.ts`, `src/commands/breakdown.ts`, `src/daemon/breakdown.ts`, `src/daemon/chunk-zero.ts`, `src/daemon/prompts.ts`. For context: `src/adapters/ticketing.ts` (the `blockedBy` field only).
- **Diff:** `origin/main...af3b65c` — 20 files, +2640/−27
- **Findings:** 1

### 1. Nothing checks the `**Order:**` line after the list is committed. The person can approve one order while the step tickets follow another. — PRD-07.R10

- **Where:** `src/daemon/chunk-zero.ts:170–181`; `src/daemon/breakdown.ts:571–606`; `src/daemon/prompts.ts:1113–1118`
- **What:** `checkOrderLine` compares the hand-written `**Order:**` line with the `Needs:` lines. Only the `breakdown` CLI command calls it, and the writing session is asked to run that command: "**Before you commit it, run `node dist/cli.js breakdown …`.**". When the step tickets are opened after approval, `openStepTickets` calls only `orderOf(read.breakdown)`, which reads the `Needs:` lines. It never reads the `**Order:**` line. Suppose a session skips the command, or edits the list after running it, and commits an `**Order:**` line that disagrees with the `Needs:` lines. The person approves the file showing that line. The step tickets are then blocked as the `Needs:` lines say, and nothing reports the difference. The initiative map writes `Order: ${order.words}`, which is computed from the `Needs:` lines, so the ticket can show a different order from the approved file.
- **Why it matters:** PRD-07.R10 asks that the step tickets are "blocked by each other exactly as that order says", meaning the order shown for approval. The diff makes that agreement depend on the session following an instruction. No code enforces it at approval or when the tickets open.
- **Suggested remediation:** in `openStepTickets`, call `checkOrderLine` on the approved text instead of only `orderOf`. If it reports a problem, open no step tickets and return the reason, the same way an unreadable `Needs:` line is handled now. A similar check where the approval is recorded would catch the mismatch before chunk zero merges. Not applied here.

## Notes

- **The two reviews were run in separate fresh contexts.** Neither read the other's report, and neither read the verification report, the completion report or the check's own scripts.
- **The two questions for the review**, from the completion report, are on the pull request under *Questions for you*.
- **Once merged,** the timone root must be built again for a list-writing session to find `node dist/cli.js breakdown …` there (completion report, *Context for the next agent*).
- **Pieces 3 and 5 of #197** are likely to change `src/daemon/prompts.ts`, `process.md` and the planning skill too; whichever merges second will need bringing level with the first (phase file, *Companion phases*).
