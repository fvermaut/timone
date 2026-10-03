# Phase 43 — Delivery Report

- **Date:** 2026-10-03
- **Phase:** [phase-43.md](../phase-43.md) — `Complete`, verified in [phase-43-verification.md](phase-43-verification.md)
- **Branch:** `timone/85-a-boxed-run-pushed-status-md-straight-to` @ `bff839c`
- **Base:** `main` — the project's default branch. The branch was cut from `main` at `b495bb6`.
- **Pull request:** opened against this report, from this branch into `main`. Its address is on [timone#85](https://github.com/fvermaut/timone/issues/85).
- **Screen:** no user-facing screen in this phase (the phase file's `Screens changed: none`) — [ADR-0052](../../../adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md), [ADR-0057](../../../adr/0057-every-screen-a-phase-changes-is-looked-at-and-its-figures-read-on-the-preview-data.md)
- **Questions for the human:** 9, quoted from the verification report's section of that name. Q1–Q3 are the plan's open questions; 4–9 are what the check found.
- **Departures:** [phase-43-departures.md](phase-43-departures.md) — 4 entries.

## Scope

[timone#85](https://github.com/fvermaut/timone/issues/85). The phase claims [PRD-05.R3](../../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md#r3--nothing-reaches-a-default-branch-without-a-yes-from-a-named-person) (MUST): nothing reaches a default branch without a yes from a named person. It delivers five parts:

1. 43a — a run's `git push` reaches its own work branch and nothing else, on the host and in a box.
2. 43b — a run cannot merge, or write another branch, through `gh`.
3. 43c — inside a box, the checks know which run they belong to; commands that switch the push guard off are refused.
4. 43d — the status-file check reports a run's `STATUS.md` commit on `main`, and its words name the work branch.
5. 43e — `process.md`, three skills and the prompts of steps with no branch say where a run's status file goes.

## How to try it

### Against the preview

Timone has no preview configured for pull requests (`timone.yaml` has no `preview` binding for it). Use the local steps.

### On a local checkout

Setup is in the project's [README.md](../../../../README.md). Then, on this branch:

1. `npm run build`, then `npx vitest run`. Expected: 59 files, 1534 tests pass.
2. A push to `main` is refused. Run:
   `printf 'refs/heads/main %s refs/heads/main %s\n' 1111111111111111111111111111111111111111 2222222222222222222222222222222222222222 | node dist/cli.js guardrails pre-push --branch timone/7-x; echo "exit: $?"`
   Expected: exit 1, and the message names `timone/7-x` as the one branch allowed.
3. A push to the run's own branch passes. Run:
   `printf 'refs/heads/timone/7-x %s refs/heads/timone/7-x %s\n' 1111111111111111111111111111111111111111 0000000000000000000000000000000000000000 | node dist/cli.js guardrails pre-push --branch timone/7-x; echo "exit: $?"`
   Expected: exit 0.
4. A merge through `gh` is refused, a comment is not. Run:
   `node dist/cli.js guardrails forge-call --branch timone/7-x -- pr merge 12 --squash; echo "exit: $?"` — expected exit 1.
   `node dist/cli.js guardrails forge-call --branch timone/7-x -- issue comment 85 --body hi; echo "exit: $?"` — expected exit 0.
5. The full check for PRD-05.R3, about 16 minutes: the command is in [phase-43-verification.md](phase-43-verification.md), under *Evidence → PRD-05.R3*. Expected: `PRD-05.R3: PASS (19 clause labels, 19 passing)`.
6. The replay against the real model, which could not run here: `npm run --silent replay`, from a terminal logged in to Claude.

## Verification outcome

From [phase-43-verification.md](phase-43-verification.md). 0 of 2 fix loops consumed.

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-05.R3 | MUST | api | PASS — 3 of 3 clauses, and 16 of 16 checks on the step sessions | 0 |
| PRD-05.R2 | MUST | api | PASS — clause 2b BLOCKED (reads GitHub) | 0 |
| PRD-05.R4 | MUST | api | PASS | 0 |
| PRD-05.R5 | MUST | api | PASS | 0 |
| PRD-05.R7 | MUST | api | PASS — clause 1 (real runner) BLOCKED (needs a replay on this build) | 0 |
| PRD-05.R10 | MUST | api | PASS | 0 |
| PRD-05.R11 | MUST | api | PASS | 0 |
| PRD-05.R18 | MUST | api | BLOCKED — needs a replay against the real model on this build | 0 |
| PRD-06.R5 | MUST | api | PASS — on the builder's test, by fvermaut's decision (no verifier probe) | 0 |

### Outstanding for the human

- [ ] PRD-05.R18, PRD-05.R7 clause 1 — the replay against the real model was **not run**. It needs a logged-in terminal: `npm run --silent replay` on this branch, before merging.
- [ ] PRD-05.R2 clause 2b — not run: it reads GitHub, which could not be reached from the checking session.
- [ ] Known limit: a run that sets out to get round the guard can still push to `main` (`env -i git push …`, or a script file that sets `core.hooksPath`). The verification report shows both, under *What the guard does not stop*. Q1 asks whether to close this on GitHub itself.

No HUMAN-CHECK scripts and no live gate are owed.

## Standards review — phase 43

- **Read:** `git diff origin/main...HEAD -- src .claude/skills process.md`; `src/daemon/container-runtime.ts`, `src/daemon/push-guard.ts`, `src/daemon/hooks.ts`, `src/daemon/probeGuard.ts`, `src/commands/guardrails.ts` (searched at specific lines); `/workspace/timone/standards/code-smells.md`; `/workspace/timone/standards/README.md`; `/workspace/timone/standards/typescript.md`; the status lines of `/workspace/timone/standards/testing.md` and `/workspace/timone/standards/project-structure.md`; `package.json`; `tsconfig.json`. The project has no `doc/standards.md`, so no stack entry is formally selected for it and no project rule overrides the review reference. There is no ESLint or Prettier config. The only tool check is `tsc` with `strict`.
- **Diff:** `origin/main...HEAD` — 23 files reviewed, +2580/−108
- **Findings:** 3

### 1. The `gh` check and the hooks setting are written twice, once in the box script and once in `installPushGuard` — Duplicated code

- **Where:** `src/daemon/container-runtime.ts:478–492` and `:650–657`; `src/daemon/push-guard.ts:202–212` and `:221–225`
- **What:** The box script writes its own `gh` wrapper with `node …/dist/cli.js guardrails forge-call ${TIMONE_RUN_BRANCH:+--branch …} -- "$@" < /dev/null || exit 1`. `installPushGuard` writes a second `gh` with the same line: `node ${shellWord(options.cli)} guardrails forge-call${branch} -- "$@" < /dev/null || exit 1`. The box also runs `install-push-guard`, which writes that second `gh` into `bin/`, but the box never puts `bin/` on `PATH`. So in the box that file is written and never used. The box then writes `export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath …` by hand. That repeats the environment `installPushGuard` returns. The comment at `:640` says the command is used "so the box and the tests install the same hooks". That holds for the hooks, but not for the `gh` check or the environment.
- **Why it matters:** Duplicated code. This is a second copy, which the rule of three tolerates. But it is a copy of a security decision: a change to how `forge-call` is invoked has to be made in two places, and the tests only cover one of them.
- **Suggested remediation:** Have the box use the `gh` that `install-push-guard` writes (put `forgeGuardBin` on `PATH` and keep only the token-loading part in the box wrapper). Or have `install-push-guard` print the environment it sets, so the box does not repeat it. — not applied here

### 2. The "no work branch" and "a person's yes" refusal wording is repeated in four modules — Duplicated code (repeated one-liner)

- **Where:** `src/daemon/push-guard.ts:44–50` and `:64–67`; `src/daemon/forge-guard.ts:233–244`; `src/daemon/hooks.ts:255–262` and `:382–383`; `src/daemon/prompts.ts:159–165`
- **What:** "This step has no work branch, so it writes/pushes/commits nothing to the project…" is written separately in `push-guard.ts`, `forge-guard.ts`, `hooks.ts` (twice: `NO_WORK_BRANCH` and `unpushedOnDefaultBranch`) and `prompts.ts`. Each copy is worded a little differently. `"Nothing reaches the project's default branch without a person's yes. " + `Commit on \`${workBranch}\` and push that.`` appears in both `push-guard.ts` and `forge-guard.ts`. The comments themselves say the copies must match: "in the push guard's words" (`forge-guard.ts`), "It is the push guard's rule (`push-guard.ts`)" (`hooks.ts`).
- **Why it matters:** Duplicated code. The review reference counts a repeated one-liner as a duplicated decision. This one appears four or more times, which is past the rule of three. The text tells a session what to do next, so if one copy changes and the others do not, a run gets different instructions depending on which guard refused it.
- **Suggested remediation:** Put the shared sentences in one module (for example, next to `pushRefusal`) and import them in the forge guard, the Stop checks and the prompt. — not applied here

### 3. The push guard's decision uses a type named for the probe guard — Inconsistent vocabulary

- **Where:** `src/commands/guardrails.ts:21–24` and `:224`
- **What:** `function pushGuardDecision(deps: GuardDeps): ProbeGuardDecision | undefined`. The type is imported from `../daemon/probeGuard.js` so that `runGuard` can return either guard's answer. It is now the shape of any `PreToolUse` refusal, but its name still says it belongs to the probe guard.
- **Why it matters:** Inconsistent vocabulary and Uncommunicative name. A reader of `pushGuardDecision` has to open `probeGuard.ts` to learn that the type has nothing to do with probes.
- **Suggested remediation:** Rename the type to a neutral name, such as `PreToolUseDecision`, and move it to a place both guards share. — not applied here

## Spec review — phase 43

- **Read:** the diff for `src/`, `.claude/skills/` and `process.md`. Current content of `src/daemon/hooks.ts`, `src/daemon/push-guard.ts`, `src/daemon/forge-guard.ts`, `src/daemon/container-runtime.ts`, `src/daemon/session.ts`, `src/commands/guardrails.ts`, `src/runner/actions.ts` and `src/daemon/prompts.ts`, as needed. `doc/specs/prd/prd-05-a-runner-decides-each-step.md`, `doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md` and that file's diff. Lines 1–17 of `doc/plans/phases/phase-43.md`.
- **Diff:** `origin/main...HEAD`: 23 files reviewed, +2580/−108
- **Findings:** 2

The diff does what the three asks of the ticket and PRD-05.R3 call for:
- **Ask 1.** A `pre-push` hook is switched on through `GIT_CONFIG_*` in both the host runtime and the box. A `gh` wrapper refuses merges, ref writes and file writes to any branch but the run's own. Both refuse when they hit an error. Both runner call sites pass `workBranch`.
- **Ask 2.** `checkStatusPlacement` now reports a run's `STATUS.md` commit on the default branch. A box now declares its run (`TIMONE_RUN_PROJECT` and `TIMONE_RUN_BRANCH`), so its Stop check knows it is a run.
- **Ask 3.** The messages a run gets now name its work branch as the remedy. `main` appears only as "put the local `main` back to `origin/main`".

### 1. A step with no work branch is not told off for a status file on any `timone/…` branch — PRD-05.R3

- **Where:** `src/daemon/hooks.ts:330`, `src/daemon/hooks.ts:371–375`
- **What:** `isOwnWorkBranch(branch, undefined)` falls back to `branch.startsWith(WORK_BRANCH_PREFIX)`. The code passes `undefined` in two cases: when the evidence carries no branch name (older evidence), and when the run is known but the step owns no branch (`sessionRun` returns `{ project }`). In the second case, a triage or research step that commits `STATUS.md` on some `timone/x` branch is skipped without a word. The push guard will refuse that push ("this step has no work branch, so it pushes nothing"). So the Stop check and the guard disagree.
- **Why it matters:** ask 2 and PRD-05.R3. Under the new rule, the Stop check should tell a run where its work may go. For a step with no branch, it says nothing, and the session finds out only when its push is refused.
- **Suggested remediation:** when the run is known (`evidence.target` is set) and `workBranch` is undefined, treat no branch as the run's own and report with `NO_WORK_BRANCH`. Keep the prefix fallback only for evidence where the run is not known. — not applied here

### 2. `process.md` and three skills change where `STATUS.md` is written, a rule that belongs to another requirement — PRD-01.R22 (phase claims only PRD-05.R3)

- **Where:** `process.md:71–72`, `process.md:110`; `.claude/skills/timone-deliver/SKILL.md:262`; `.claude/skills/timone-verify/SKILL.md:307`; `.claude/skills/timone-wayfind/SKILL.md:167,178`
- **What:** the normative rule "It is written only on the project's default branch — never on a work branch" is struck through. In its place: "In a run, a step that owns a work branch writes `STATUS.md` on that branch". The new text also narrows "fvermaut's ruling of 2026-07-29, recorded in the evidence of PRD-01.R22" so that it holds only for sessions a person runs by hand. The phase header claims only PRD-05.R3 and says "The requirements are not changed."
- **Why it matters:** the change follows from PRD-05.R3. A run can no longer push to the default branch, so the old rule could not be kept. But it rewrites a written rule tied to PRD-01.R22 and to a human's ruling, inside a bug fix. It also brings in the trade-off the struck-through text was written to avoid: two open pull requests that both change `STATUS.md` will conflict. Under the old rule, that decision was the human's to make.
- **Suggested remediation:** in the pull request, ask fvermaut to confirm the narrowed ruling in so many words. Once they do, record it against PRD-01.R22 (an evidence note, or a small ADR). — not applied here

## Notes

- The two reviews ran as separate sessions. Neither read the other's report or the verification report.
- Both reviews looked at the 23 files under `src/`, `.claude/skills/` and `process.md`. The phase's own reports, check scripts and `STATUS.md` were not reviewed.
- The runner asked that the pull request list the replay as not run, state the known limit plainly, carry the plan's three open questions, and link the completion and verification reports. It does all four.
- `STATUS.md` is updated on this branch, not on `main`: this delivery is part of a run, and since this phase a run's push to `main` is refused. It reaches `main` with the pull request.
