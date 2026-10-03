# Phase 43 — Completion Report

- **Date:** 2026-10-03
- **Plan:** [phase-43.md](../phase-43.md) — no list of pieces: this is a bug, which goes from sorting straight to planning with no list of pieces to approve (`defaultOrder("bug")` in `src/runner/order.ts`, the same path as a chore). The person's judgement lands on the pull request.
- **Requirements:** [PRD-05.R3](../../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md#r3--nothing-reaches-a-default-branch-without-a-yes-from-a-named-person) (MUST) — left `verified` in the register, untouched; the checking step decides whether it still holds with the step sessions included.
- **Branch:** `timone/85-a-boxed-run-pushed-status-md-straight-to`
- **Departures:** [phase-43-departures.md](phase-43-departures.md) — 3 entries.

## Summary

A run can no longer push to anything but its own work branch. A git `pre-push` hook, switched on through git's environment so the project's own config cannot turn it off, refuses every other ref, a delete, and every push from a step that owns no branch. The box installs it before `claude` starts and stops if it cannot; the host-side session gets the same hook. The same rule covers `gh`: a merge, `repo sync`, and an API write that merges or moves a branch are refused, in the box's wrapper and on the host-side session's `PATH`. The daemon's own forge calls, the chunk-zero merge among them, are not touched.

The checks inside a box now know which run they belong to: the box passes `TIMONE_RUN_PROJECT` and `TIMONE_RUN_BRANCH`, and the checks read the ledger first and that declaration second. A run's `Bash` commands that would switch the guard off (`core.hooksPath`, `GIT_CONFIG_…`, `push --no-verify`) are refused. The status-file check now reports a run's `STATUS.md` commit on the default branch, and its words name the work branch as the place to move it — `518252a` from the ticket is replayed as a test. `process.md`, the checking, delivery and wayfinding skills, and the prompts of the four steps that own no branch now say where a run's status file goes.

The centre of gravity is 43a: the push guard is the only part that stops the fault rather than reporting it. What it does not stop is a session that sets out to get round it — the plan's open question Q1.

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 43a — a run's git push reaches its own work branch and nothing else | Landed, first attempt. `"a run cannot push to the default branch"` pushes through real git; without the guard's environment the remote's `main` moved. | `e8621d7` |
| 43b — a run cannot write to a branch or merge through the forge's API | Landed, first attempt. Two small changes from the plan's wording, amended and recorded (departure 1). | `80e1388` |
| 43c — the checks inside a box know which run they belong to | Landed. The slice found that a project's run environment file could set `TIMONE_RUN_BRANCH`; the plan was amended to grant `run-env.ts` and a case 7 was built (departure 2). | `46ebfcb` |
| 43d — the status-file check looks both ways, and names the work branch | Landed. Its grep check contradicted its own case 5; the check was amended (departure 3). | `8b675ce` |
| 43e — the written process says where a run's status file goes | Landed, first attempt. Found a gap outside the plan, added as open question Q3. | `09fd8a8` |

## Tests run

The whole suite took 16 s in phase 42's report and about 3 s here, so it is a suite under a minute and ran whole at the end of every sub-phase. Before the first slice: `npm run build`, then the whole suite, 56 files, 1419 tests passed.

- **43a:** `src/daemon/push-guard.test.ts`, `src/daemon/container-runtime.test.ts`, `src/daemon/session.test.ts`, `src/runner/actions.test.ts` (182 tests); type check; the whole suite, 1449 passed.
- **43b:** `src/daemon/forge-guard.test.ts`, `src/daemon/container-runtime.test.ts`, `src/daemon/session.test.ts` (145 tests); type check; the whole suite, 1482 passed.
- **43c:** `src/commands/guardrails.test.ts`, `src/daemon/container-runtime.test.ts`, `src/daemon/hooks.test.ts`, `src/daemon/run-env.test.ts` (225 tests); type check; the whole suite, 1500 passed.
- **43d:** `src/daemon/hooks.test.ts`, `src/commands/guardrails.test.ts` (124 tests); type check; the whole suite, 1511 passed.
- **43e:** `src/process-text.test.ts`, `src/daemon/prompts.test.ts` (213 tests); type check; the whole suite, 1534 passed.
- **Close:** `npm run build`, exit 0; the whole suite once, 59 files, 1534 tests passed, 3.1 s; `npx tsc --noEmit`, exit 0. Then the validation of 43a, 43b, 43c, 43d and 43e once each, in that order (none changes state outside the repository; the git tests use temporary folders): all passed — the 43a probes gave exit 1, 0, 1; the 43b probes 1, 0; `src/adapters/github-tickets.ts`, `src/daemon/probeGuard.ts` and `doc/specs/prd/` are unchanged against `origin/main`; 43d's amended grep counts 1 line.

## Screen comparison

None — the phase changes no screen.

## Deviations from the plan

- ✏ 2026-10-03 (build, timone#85) — 43b: the session's checking `gh` is in `<guard dir>/bin/`, and both `gh` wrappers run the check with `< /dev/null`. Departure 1.
- ✏ 2026-10-03 (build, timone#85) — 43c: `src/daemon/run-env.ts` and its test added to the slice, case 7: a project's run environment file may not set `TIMONE_RUN_BRANCH` or `TIMONE_RUN_PROJECT`. Departure 2.
- ✏ 2026-10-03 (build, timone#85) — 43d: the grep check now expects exactly one line (the finding for a person's own session), not none. Departure 3.
- ✏ 2026-10-03 (build, timone#85) — open question Q3 added to the plan: steps with no work branch are still told to record a decision record or update the glossary, and their push is now refused.
- Not changed, for the reader: `violationFeedback`'s closing line still lists "push the commits" among the ways to fix a finding. The plan said to change it only if a test showed it contradicting a rule's detail, and no case declared one. For a run's default-branch commit the rule's own detail now says the push will be refused and where the commit belongs.
- Not tested, and stated: the session-trailer test in 43d's `writtenInThisSession` means a run's `STATUS.md` commit on `main` that carries no `Timone-Session:` line and was already pushed is not reported by this rule. The trailer check reports the missing trailer, and since 43a the push is refused.

## Context for the next agent

- **How to run:** `npm run build` first (several tests run `dist/cli.js`), then `npx vitest run`. The push guard's tests use real git in temporary folders, with `HOME` set to a temporary folder.
- **The falsifying test for PRD-05.R3** is `"a run cannot push to the default branch"` in `src/daemon/push-guard.test.ts`.
- **No live check was possible here:** there is no docker in this container. A watched run on scratch-app being refused is still the strongest evidence, and only the operator can run one. The plan says so too.
- **Open questions for fvermaut, carried to the pull request:** Q1 (make it impossible on the forge too, with a second GitHub App), Q2 (mark PRD-01.R22's 2026-07-29 ruling), Q3 (where a step with no work branch puts a decision record or glossary change). All three are in the plan's Goal Description.
- **The hand-run session in this container declared its step** with `node dist/cli.js stage execution` at the Timone root. A runner-started session normally does not need to; in a box the ledger is empty ([timone#87](https://github.com/fvermaut/timone/issues/87)), so the probe guard would not otherwise have known the step.
- **Observed during this build, not part of it:** the box's forge token file, rewritten at 13:25 UTC, was refused by GitHub at 13:40 and 13:42 ("Bad credentials"). The one rewritten at 13:45 worked. Two pushes failed and were retried after it. Phase 42 promised a token outlives the next refresh; this looks like a fault in that, worth checking against the daemon's log.
