# Phase 61 — Delivery Report

- **Date:** 2026-10-13
- **Phase:** [phase-61.md](../phase-61.md) — `Complete`, verified in [phase-61-verification.md](phase-61-verification.md)
- **Branch:** `timone/234-the-update-step-cannot-finish-a-merge-wh` @ `cce0925` (reviewed); this report is the next commit
- **Base:** `main` — the project's default branch. The branch was cut from `main` at `2f60802`.
- **Pull request:** opened against this report, after it was committed; its address is in the ticket comment that follows.
- **Screen:** no user-facing screen in this phase — the phase file's `Screens changed` line says none, so the screen gate was skipped — [ADR-0052](../../../adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md), [ADR-0057](../../../adr/0057-every-screen-a-phase-changes-is-looked-at-and-its-figures-read-on-the-preview-data.md)
- **Questions for the human:** none (the verification report's section says none).
- **Departures:** [phase-61-departures.md](phase-61-departures.md) — 5 entries. A sixth departure, recorded by the run and not in that file: sorting the request did not run, because fvermaut did it in a terminal session on ivtrends#201 ([triage 004](../../../triage/004-the-update-joins-check-script-conflicts.md)).

## Scope

Driving tickets: [timone#234](https://github.com/fvermaut/timone/issues/234), and [timone#235](https://github.com/fvermaut/timone/issues/235) folded into it by fvermaut on 2026-10-13. Requirements claimed: PRD-07.R7 (MUST) and PRD-05.R18 (MUST). Decision built: [ADR-0068](../../../adr/0068-the-update-joins-a-conflict-in-a-check-script-itself-and-a-merge-it-could-not-finish-is-a-step-that-failed.md).

The step that brings a branch level with `main` now joins a check script that both sides changed, itself, and keeps every check from both sides. A new command, `update-conflicts`, lists the files a merge left in conflict and says which are check scripts. The update's record says which check scripts were joined and how, and the top of the pull request shows it. An update that did not bring the branch level now ends as failed, and the runner's rule says to ask a named person. For #235: the update finds check scripts named with a dash (`prd-18-r12.mjs`), and runs each `test:` script of a project with no `test` script, leaving out watch scripts.

## How to try it

### Against the preview

Timone has no preview configured for pull requests (`timone.yaml` has no `bindings.preview` for it). Use the local steps.

### On a local checkout

Setup: [README.md](../../../../README.md), *Getting started*. Then, in `projects/timone`:

1. `npm run build && npx vitest run src/update-checks.test.ts src/update-checks.git.test.ts src/daemon/probeGuard.test.ts` — all pass. Among the titles: *lists a check script both sides changed, with its requirement, apart from the other files*.
2. From the Timone root: `node projects/timone/dist/cli.js update-conflicts timone; echo "exit: $?"` — prints "No merge is in progress in timone: there is nothing to join." and exits 2.
3. `npx vitest run src/runner/update-section.test.ts src/runner/driver.test.ts src/runner src/adapters` — all pass.
4. `npm run --silent replay -- --dry; echo "exit: $?"` — 24 of 24, exit 0.
5. **The paid replay (not run here):** `cd ~/dev/timone/projects/timone && npm run build && npm run replay 2>&1 | tee ~/dev/timone/.timone/replay-61.txt` — every case should pass; its output goes into `doc/plans/phases/reports/phase-61-replay.md` as run 1. It needs a model login and costs about $3.
6. **The watched update (not run here):** on scratch-app, open two pull requests that both change one check script, merge one, and watch the update on the other. It should join the script, keep every check from both sides, finish the merge, and write `Check scripts joined: …` at the top of the pull request.

## Verification outcome

From [phase-61-verification.md](phase-61-verification.md) — 1 of 2 fix loops consumed.

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-07.R7 | MUST | live | LIVE-GATE — owed a fresh gate | 0 |
| PRD-05.R18 | MUST | api | BLOCKED — clause 1 on the real model, and clause 2, need a replay on this build; the parts judged with a stand-in model pass | 0 |
| Regression set, 28 criteria | MUST | api | PASS on every part that could run; one part of PRD-05.R2, one of PRD-05.R7 and five of PRD-05.R18 BLOCKED | 0 |
| The runner's five parts (not register criteria) | — | api | PASS, after one fix: part 5 failed on the first run | 1 |

The fix of loop 1 is `0e94d4a`: `process.md` still said only the check writes and runs the check scripts.

### Outstanding for the human

- [ ] PRD-05.R18 — NOT RUN: the paid replay of the runner's rules on this build (step 5 above). This change alters one rule, so the test matters. Its output goes into `phase-61-replay.md` as run 1.
- [ ] PRD-07.R7 — NOT RUN: live gate owed. Run it as step 6 above (the plan's *Regression set* paragraph and the verification report's *Live gates* section), and commit its report, before merging.

## Standards review — phase 61

- **Read:** diff `origin/main...HEAD`, limited to `src/**`, `.claude/skills/timone-update/SKILL.md`, `.claude/skills/timone-verify/SKILL.md`, `process.md` and `doc/adr/0066-…md`; the added lines of ADR-0068 in the doc diff; `/workspace/timone/standards/code-smells.md`, `package.json`, `tsconfig.json`; for copies, `src/commands/breakdown.ts`, `src/commands/number.ts`, `src/commands/update-checks.ts`, `src/runner/facts.ts`. There is no `doc/standards.md` in this project, so the code-smell reference applies without project overrides. The tooling is `tsc` strict only; there is no linter and no formatter.
- **Diff:** `origin/main...HEAD` — 36 files, +2483/−63
- **Findings:** 3

### 1. The new command copies its whole setup from `update-checks` — Duplicated code

- **Where:** `src/commands/update-conflicts.ts:28–39` and `:58–70`. It copies `src/commands/update-checks.ts:29–40` and `:60–72`.
- **What:** Two things are copied word for word. First, the block that looks up the project: `const known = Object.keys(manifest.projects).join(", ") || "none"; throw new Error(\`I don't know a project called "${project}"; …\`)`, followed by `if (!existsSync(dir)) throw new Error(\`The project "${project}" is not checked out at ${dir}.\`)`. Second, the `gitIn(dir)` function, copied in full, doc comment included. The "unknown project" sentence was already in `breakdown.ts:45` and `number.ts:49`. This diff adds a fourth copy.
- **Why it matters:** This breaks the rule of three for duplicated code. If the wording or the lookup rule changes, there are four places to edit.
- **Suggested remediation:** Move "resolve a project's checked-out directory from the manifest" and `gitIn` into one shared module under `src/commands/`, and call it from both update commands. — not applied here

### 2. "Is the entry new, and what commit does it name" is decided twice — Duplicated code (repeated one-liner)

- **Where:** `src/runner/actions.ts:814–821` and `src/runner/update-section.ts:212–230`
- **What:** `updateUnfinished` computes `const isNew = entry !== undefined && isNewSince(entry, startedAt)` and `levelWithCommit(entry)` to choose which forge question to ask. It then passes the raw `entry` and `startedAt` to `unfinishedUpdate`, which runs `isNewSince(entry, startedAt)` and `levelWithCommit(entry)` again on the same values. Also, `readBranches` is called at line 814, and `newestUpdateEntry` calls it again inside.
- **Why it matters:** The same decision is written in two places. If the "new since" rule changes in one place and not the other, the forge gets asked one question while the answer is read as if the other had been asked.
- **Suggested remediation:** Compute `isNew` and the commit once, and pass them into `unfinishedUpdate`, or let `unfinishedUpdate` own the decision and return which question to ask. — not applied here

### 3. The rule for naming a check script is written twice, in two different forms — Duplicated code / Inconsistent vocabulary

- **Where:** `src/update-checks.ts:43–53` and `:57–64`
- **What:** `checkScriptOf` accepts the dash form with `named(name) ?? named(name.replace(".", "-"))`. It works for any ID and looks only in `PROBE_DIRECTORIES[0]`. `requirementOfCheckScript` uses a separate regex, `/^prd-(\d+)[.-]r(\d+)\.[^.]+$/`, which only matches `PRD-n.Rn` IDs but accepts either probe folder.
- **Why it matters:** One concept, "the file name of a requirement's check script", now has two definitions that disagree on which IDs are allowed and which folders count. A script can be found by one function and not recognised by the other.
- **Suggested remediation:** Define the file-name pattern and the probe folders once, and build both functions on it. — not applied here

The process and skill text read is plain and uses the same words throughout ("join", "check script", "update"). Nothing to report there.

## Spec review — phase 61

- **Read:** `doc/adr/0068-…-a-merge-it-could-not-finish-is-a-step-that-failed.md`; `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md` (R7, with the R14 line that points at R7) and the R7 paragraph of `prd-07-…md`; `doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md` (R18); `doc/plans/phases/phase-61.md` from the top through *Requirements*, and the Goal Description (a first read also showed *Context & Prerequisites* and the start of 61a and 61b; no finding rests on that text); the diff of `src/**` (non-test files, plus the names of the new tests), `.claude/skills/timone-update/SKILL.md` (whole, at head), `.claude/skills/timone-verify/SKILL.md`, `process.md`, `doc/adr/0066-…`.
- **Diff:** `origin/main...HEAD` — 36 files, +2483/−63
- **Findings:** 3

### 1. The diff carries no replay run, though the runner's rules changed — PRD-05.R18

- **Where:** `src/runner/brief.ts:178`
- **What:** The runner's update rule in `SYSTEM` changes from "When it ends, start nothing more for it" to "When it succeeded, start nothing more for it … When it failed, the branch is still behind: say on the ticket in plain words what stopped it, and ask a named person to bring the branch level. Do not start the update again until you are told the default branch moved again." No replay report for phase 61 is in the diff. No replay case was added either: `src/runner/replay/` changes only by 3 lines in `recording.ts`.
- **Why it matters:** PRD-05.R18 clause 2: "GIVEN a change to the runner's instructions WHEN the change is proposed THEN the replay set is run, and its result is on the pull request." Also, no case checks the new choice: post on the ticket and ask a person, rather than start the update again.
- **Suggested remediation:** Run the replay set at the head commit and put its result on the pull request. Consider adding a case where an update step failed. — not applied here

### 2. A new entry with no commit on its `Level with:` line counts as a finished update — PRD-07.R7 (ADR-0068 D4)

- **Where:** `src/runner/update-section.ts:227`, and `src/runner/actions.ts` `updateUnfinished` (the `holds` line)
- **What:** `const commit = isNew ? levelWithCommit(entry) : undefined;` then `holds = commit === undefined ? undefined : await …branchHolds(…)`, and in `unfinishedUpdate`: `if (holds !== false) return undefined;`. So when this step wrote a new entry but its `Level with:` line does not end in a commit (badly formed, or left out), the forge is never asked, and the step is recorded as succeeded even if the merge was aborted. The code comment says "An answer the forge did not give never makes a failure", but here the forge was never asked, and the fault is in the session's own entry.
- **Why it matters:** ADR-0068 D4: "The step counts as done when the newest entry was written by this step **and the branch holds that commit** … Otherwise its end is recorded as failed." PRD-07.R7 needs the runner not to be told "succeeded" about a branch that is still behind. A slightly wrong entry brings back the exact fault of #234.
- **Suggested remediation:** When the entry is new but names no commit, fall back to `behindDefault`, as the no-entry path already does, so a branch still behind ends as failed. Add a unit case in `update-section.test.ts`. — not applied here

### 3. The register records nothing for R7, and the live gate the phase owes is not in the diff — PRD-07.R7

- **Where:** `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md:160–167` (not changed by the diff)
- **What:** The diff touches neither criteria register. R7 still reads `Status: draft`, `Verify-via: live`, `Last live gate: never`. The phase file says this phase owes a live gate, and that the join itself, the main change of #234, is "a judgement no unit test can make".
- **Why it matters:** PRD-07.R7 is a MUST checked live. The core behaviour, the session joining a check script and keeping every check, has no recorded evidence in the diff.
- **Suggested remediation:** Run the live gate (an update on scratch-app where both sides changed one check script), carried to the pull request under ADR-0059, and record its outcome on R7. — not applied here

## Notes

- Spec findings 1 and 3 are the two items the pull request already lists as NOT RUN. Spec finding 2 is new: it is a gap in the very fault #234 is about, and it is worth deciding before merging.
- The verification report noticed two small things: `process.md` line 56 now says the same sentence twice in a row, and a scripted update that writes its entry in the same second as the step started is told "it wrote no record entry". Neither was fixed.
- In this container, 71 tests fail before and after the change (70 are refused pushes to temporary remotes; 1 is the register test on PRD-07.R3, already on `main`). Both reports list them.
- Pull request body avoids closing words before issue numbers; the runner closes #234 when the pull request is merged.
