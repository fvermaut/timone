# Phase 50 — Delivery Report

- **Date:** 2026-10-05
- **Phase:** [phase-50.md](../phase-50.md) — `Complete`, verified in [phase-50-verification.md](phase-50-verification.md)
- **Branch:** `timone/202-4-the-update-after-a-merge` @ `ce2e432`
- **Base:** `main` — the project's default branch. The branch was cut from `main` at `1630843` (phase 49, merged as #215) and is level with it.
- **Pull request:** opened against this report from the branch above; its address is in the comment on ticket #202.
- **Screen:** no user-facing screen in this phase (`Screens changed: none`; the section at the top of a pull request is GitHub text) — [ADR-0052](../../../adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md), [ADR-0057](../../../adr/0057-every-screen-a-phase-changes-is-looked-at-and-its-figures-read-on-the-preview-data.md)
- **Questions for the human:** none in the verification report. The runner asked that the four questions from the plan's section *Questions that came up while building, and the choice made* be put on the pull request; they are carried there under *Questions for you*.
- **Departures:** [`phase-50-departures.md`](phase-50-departures.md) — 4 entries.

## Scope

This phase delivers PRD-07.R7 and PRD-07.R14 of [PRD-07](../../../specs/prd/prd-07-several-tickets-of-one-project-at-once.md) ([criteria](../../../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md)). It is piece 4 of the [list of pieces for #197](../../breakdowns/ticket-197.md), driven by ticket #202. When an open pull request that a run owns falls behind the default branch — after another merge, or because it opened behind — the run is woken once for that head of the default branch. A new step, `update`, merges the default branch in, runs three test sets (the whole suite, the ticket's own check scripts, the check scripts of each plan that arrived), allows at most two fixes, and writes one entry to `phase-NN-update.md`. Code turns that entry into a section at the top of the pull request. Decision: [ADR-0066](../../../adr/0066-the-update-is-a-step-the-runner-starts-when-an-open-pull-request-falls-behind.md).

## How to try it

### Against the preview

Timone has no preview configured for pull requests (`timone.yaml` has no `bindings.preview` for it). Use the local steps.

### On a local checkout

Setup is in the project's [README.md](../../../../README.md), *Getting started*. Then, on this branch:

1. `npm run build && npx tsc --noEmit && npx vitest run` — `tsc` exits 0; 76 test files, 1908 tests pass.
2. `npm run replay -- --dry` — 20 of 20 cases pass, the new `#202` case ("Start the update, and ask nobody for anything") included. This checks the wiring only.
3. **Not yet run by anyone:** `npm run --silent replay`, from a terminal logged in to Claude. Expected: 20 of 20 cases pass. Say how many passed.
4. At the Timone root, with this branch built: `node projects/timone/dist/cli.js update-checks timone` — prints the test command (`vitest run --passWithNoTests`), this branch's plan `phase-50.md` with PRD-07.R7 and R14 each "no check script", and "No plan arrived on main since HEAD". Add `--json` to see the same three sets as fields.
5. `node dist/cli.js update-checks no-such-project; echo $?` — prints an error and exits 2.
6. **Not yet run by anyone — the watched run (PRD-07.R7, R14):** on scratch-app, never ivtrends, with the daemon on your machine: open two tickets that each reach a pull request, merge one, and watch the other. Expected: an `update` step starts on the other one, merges `main` in, runs the tests, and a section appears at the top of its pull request saying what had to change or that the work does not pass. Then open a pull request that is level with `main`: no update starts.

## Verification outcome

Verified in [phase-50-verification.md](phase-50-verification.md) — 0 of 2 fix loops consumed.

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-07.R7 | MUST | live | LIVE-GATE (owed) | 0 |
| PRD-07.R14 | MUST | live | LIVE-GATE (owed) | 0 |
| PRD-05.R2 | MUST | api | PASS (clause 2b BLOCKED) | 0 |
| PRD-05.R3 | MUST | api | PASS | 0 |
| PRD-05.R4 | MUST | api | PASS | 0 |
| PRD-05.R5 | MUST | api | PASS | 0 |
| PRD-05.R7 | MUST | api | PASS (real-runner clause BLOCKED) | 0 |
| PRD-05.R10 | MUST | api | PASS | 0 |
| PRD-05.R11 | MUST | api | PASS | 0 |
| PRD-05.R18 | MUST | api | BLOCKED | 0 |
| PRD-07.R1 | MUST | api | PASS | 0 |
| PRD-07.R2 | MUST | api | PASS | 0 |
| PRD-07.R3 | MUST | api | PASS | 0 |
| PRD-07.R4 | MUST | api | PASS | 0 |
| PRD-07.R6 | MUST | api | PASS | 0 |
| PRD-07.R9 | MUST | api | PASS | 0 |
| PRD-07.R10 | MUST | api | PASS | 0 |
| PRD-07.R12 | MUST | api | PASS | 0 |
| PRD-08.R1 | MUST | api | PASS | 0 |
| PRD-08.R2 | MUST | api | PASS | 0 |
| PRD-08.R4 | MUST | api | PASS | 0 |
| PRD-08.R5 | MUST | api | PASS | 0 |

The gate was not met for one reason only: PRD-05.R18 is BLOCKED, because the replay on the real model needs a model login the container did not have. No regression. Two faults were found in the check's own tools (`_fake-gh.cjs`, `prd-07.r6.mjs`) and fixed there; the program did not change.

**Known limit, from the verification report:** when GitHub fails to say how far a branch is behind, the look at that pull request stops. A named person's review comment then waits until GitHub answers again. Merges and closes are not affected, and the comment is picked up afterwards.

### Outstanding for the human

- [ ] PRD-05.R18 (and PRD-05.R7's real-runner clause) — NOT RUN: the replay of past runner decisions, `npm run --silent replay`, from a terminal logged in to Claude. Say how many of the 20 cases passed.
- [ ] PRD-07.R7 — live gate owed, NOT RUN: the watched run on scratch-app described in the [criteria register](../../../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md); commit its report before merging.
- [ ] PRD-07.R14 — live gate owed, NOT RUN: in the same watched run.
- [ ] PRD-05.R2 clause 2b — BLOCKED: the container's GitHub token could not read `fvermaut/scratch-app`.

## Standards review — phase 50

- **Read:** the diff `origin/main...HEAD` limited to `.claude/skills/README.md`, `.claude/skills/timone-deliver/SKILL.md`, `.claude/skills/timone-update/SKILL.md` (lines 1–60), `process.md`, and every file under `src/` in the range. For context also `src/runner/facts.ts` (the `PHASES` constant) and `src/daemon/probeGuard.ts` (`PROBE_DIRECTORIES`). Standards: `standards/typescript.md`, `standards/testing.md`, `standards/project-structure.md`, `standards/code-smells.md`. Tool configuration: `tsconfig.json` and `package.json`. There is no lint or format config.
- **Diff:** `origin/main...HEAD` — 41 files, +3210/−18
- **Findings:** 3

### 1. The "how far behind" answer has no name, and it is written out in five signatures — Data clumps / Primitive obsession

- **Where:** `src/adapters/ticketing.ts:423–426`, `src/adapters/github-tickets.ts:582–585`, `src/adapters/ticketing.stubs.ts:133`, `src/runner/replay/recording.ts:459`, `src/runner/driver.ts:636–647`
- **What:** The type `Promise<{ behind: number; defaultHead: string } | undefined>` is written out by hand in the interface, the GitHub adapter and the stub. The recording forge in `recording.ts` returns the same shape. The driver then widens it to `{ behind: number; defaultBranch: string; defaultHead: string }`. The adapter already reads the default branch name (`const { defaultBranch } = await this.readBranches(project);`, github-tickets.ts:588) but does not return it. So the driver asks for it a second time (`await this.deps.adapter.readBranches(project)`, driver.ts:647). `behindEvent(behind, defaultBranch, head)` at driver.ts:295 takes the same three fields as separate primitives.
- **Why it matters:** This is the code-smells.md signal for Data clumps: the same fields travel together through several signatures. They are one concept with no name. Because the default branch is not part of the answer, the caller has to put the concept back together with a second call.
- **Suggested remediation:** Name the type once in `ticketing.ts`, for example `BehindDefault`. Put `defaultBranch` in it, filled from the read the adapter already makes. Then have `behindEvent` and `behindNotice` take that value. This is not applied here.

### 2. Two rules for finding "the plan this branch added", and the phases folder hard-coded again — Duplicated code / Inconsistent vocabulary

- **Where:** `src/update-checks.ts:73`, `src/update-checks.ts:82–84`, `src/update-checks.ts:100`, `src/update-checks.ts:134`; `src/runner/driver.ts:1124–1128`
- **What:** The driver decides which plan a branch added through `filesAddedOnBranch(..., PHASES)`. When the branch added more than one phase file, it returns nothing: `if (phase === undefined || more.length > 0) return undefined;`. `update-checks.ts` makes the same decision a second way. It writes the folder itself (`"doc/plans/phases/"`, twice, plus the regex `/^doc\/plans\/phases\/phase-[^/]+\.md$/`) and takes the first file without checking for others: `addedPhases(git, \`${target}...${before}\`)[0]`. The driver also builds `` `${PHASES}/reports/${name}-update.md` `` by hand, while `facts.ts:90` keeps its own private `REPORTS` constant for the same folder.
- **Why it matters:** This is Duplicated code under code-smells.md: one decision is restated, and the two copies already differ. On a branch that added two phase files, the command that the update calls names a plan, while the driver says the branch has no update section. The folder path now has a third and fourth spelling next to `PHASES` and `numbers.ts`.
- **Suggested remediation:** Keep one rule for "the branch's own plan", including what to do when there is more than one. Import `PHASES` and a shared reports-folder constant in `update-checks.ts` and in the driver instead of writing out the strings again. This is not applied here.

### 3. The probe folder is picked by its position in a list — Magic number

- **Where:** `src/update-checks.ts:42`
- **What:** `const folder = \`${PROBE_DIRECTORIES[0]}/\`;`. `PROBE_DIRECTORIES` in `probeGuard.ts` is documented as "the two directories a builder may never open". Nothing in that list says that index 0 means "the project's own probes".
- **Why it matters:** This is Magic number or string under code-smells.md. The index carries domain meaning at the place it is used. If someone reorders the list, or adds an entry to the front, the check-script lookup moves to a different folder, and the type checker cannot see it.
- **Suggested remediation:** Export a named constant for the project's probe folder from `probeGuard.ts`, for example `PROJECT_PROBES`. Build `PROBE_DIRECTORIES` from that constant, and import it in `update-checks.ts`. This is not applied here.

## Spec review — phase 50

- **Read:** `doc/plans/phases/phase-50.md` (lines 1–19), `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.md` (the update passages), `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md` (R7, R14), the diff of `src/runner/driver.ts`, `src/runner/brief.ts`, `src/daemon/pipeline.ts`, `src/daemon/prompts.ts`, `src/daemon/probeGuard.ts`, `src/adapters/ticketing.ts`, `src/adapters/github-tickets.ts`, `src/cli.ts`, `src/runner/replay/recording.ts`, `.claude/skills/README.md`, `.claude/skills/timone-deliver/SKILL.md`, `process.md`, and the full current text of `src/update-checks.ts`, `src/commands/update-checks.ts`, `src/runner/update-section.ts`, `.claude/skills/timone-update/SKILL.md`
- **Diff:** `origin/main...HEAD` — 41 files, +3210/−18
- **Findings:** 2

### 1. An update that ends without an entry is never tried again for that head, and the pull request says nothing — PRD-07.R7, PRD-07.R14

- **Where:** `src/runner/brief.ts:166`; `src/runner/driver.ts:570–577`; `.claude/skills/timone-update/SKILL.md:197–204`
- **What:** The runner is told once for each head of the default branch: `behindNotice(defaultBranch, defaultHead, runId)` is checked with `noticed(entries, about)`. The brief then says: "When it ends, start nothing more for it: the top of the pull request says what a person needs to know." The skill has a second ending: "The branch or the pull request is not what the run says". It is used when the checkout is dirty or on the wrong branch, when `update-checks` exits 2, or when the push is refused. That ending commits no entry. The same happens when the session crashes or is stopped. In those cases the branch stays behind and `updateOf` finds no new entry, so the top of the pull request says nothing. The notice for that head is already written, so the runner is not told again until someone else merges.
- **Why it matters:** PRD-07.R7 clause 1 says the other pull request is brought level "as soon as a place is free". Clause 4 says the top of the pull request tells the person when the work does not pass. PRD-07.R14 clause 1 asks the same for a pull request that opens behind. Here the branch can stay behind with nothing at the top, and no person is told.
- **Suggested remediation:** Key the notice on the result, not on the head alone. One way: if the branch is still behind the same head after an update step ended without a new entry, tell the runner again, or write a section that says the update could not run. Also change the brief's "start nothing more" so it covers only an update that wrote its entry.

### 2. A branch that adds more than one phase file gets an update entry, but the pull request never shows it — PRD-07.R7

- **Where:** `src/update-checks.ts:134`; `src/runner/driver.ts:1124–1126`
- **What:** `update-checks` takes the first added phase file as the branch's own plan: `const ownPhase = addedPhases(git, \`${target}...${before}\`)[0];`. The skill uses that file's number for `phase-NN-update.md`. The driver drops the section when the branch adds more than one phase file: `if (phase === undefined || more.length > 0) return undefined;`. So in that case the update runs, writes and pushes its entry, but no section reaches the top of the pull request, including one that says "does not pass". The two pieces of code also choose the "own plan" by different rules: the first file found, against exactly one file.
- **Why it matters:** PRD-07.R7 clauses 3 and 4 require a short section at the top of the pull request. It must say what code changed for a conflict, or that the work does not pass and why. In this case the person sees neither. The check scripts of this ticket are also taken from only one of its plans, which bears on clause 2.
- **Suggested remediation:** Use one rule in both places. Either have `update-checks` refuse a branch with more than one added phase file, so the update ends in a way the person can see, or have both pieces read every added phase file and find the record file the same way.

## Notes

- The two reviews ran as separate fresh contexts. Neither read the other, and neither read the verification report. Their findings are listed apart and not ranked. Nothing was changed because of them: a fix goes through a new ticket.
- Standards finding 2 and Spec finding 2 touch the same code (`update-checks.ts:134` against `driver.ts:1124`) from two sides: one about how it is written, one about what the person sees.
- The completion report lists other refactors left for review: `aheadOfDefault` and `behindDefault` repeat the same compare call; `withUpdate` repeats `withDepartures`; `harness.test.ts`'s top comment still says nineteen cases.
