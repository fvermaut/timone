# Phase 65 — Delivery Report

- **Date:** 2026-10-22
- **Phase:** [phase-65.md](../phase-65.md) — `Complete`, verified in [phase-65-verification.md](phase-65-verification.md)
- **Branch:** `timone/90-the-platform-merge-carve-out-misses-squa-chunk-2` @ `9811280`
- **Base:** `main` — the project's default branch. The branch was cut from `main` at `c5f0fc8`, which is still `main`'s tip.
- **Pull request:** opened against this report; its address is in the comment on [timone#90](https://github.com/fvermaut/timone/issues/90).
- **Screen:** no user-facing screen in this phase. The phase file's `Screens changed` line says none, so the screen check was skipped — [ADR-0052](../../../adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md), [ADR-0057](../../../adr/0057-every-screen-a-phase-changes-is-looked-at-and-its-figures-read-on-the-preview-data.md)
- **Questions for the human:** 1, quoted from the verification report: a session that gives its own commit GitHub's committer address (`noreply@github.com`) is not reported. Is that acceptable?
- **Departures:** `phase-65-departures.md` — 2 entries (one from the build, one from the check).

## Scope

[timone#90](https://github.com/fvermaut/timone/issues/90). The end-of-session check stops reporting a commit that GitHub's servers built, whatever its number of parents. A squash merge, which is how every pull request here lands, is no longer blamed on a session that only pulled it. A merge or squash a session makes on its own machine is still reported. Claims PRD-02.R15 (SHOULD), clauses 1 and 5, for this one case; R15 stays `draft`. It also covers what #101 and #231 report. fvermaut asked that #101 closes with #90.

Left out on purpose, as the plan says: an untrailed commit a person pushes straight to `main` is still blamed on a session that pulls it; and squash merges still hide the squashed commits' trailers in `main`'s history.

## How to try it

### Against the preview

This project has no preview configured for pull requests. Use the local steps.

### On a local checkout

Set up the checkout as [README.md](../../../../README.md) says. Then:

1. Run the tests of the check. The command removes any `GIT_*` settings of the shell for this one command:
   `env $(env | grep -oE '^GIT_[A-Z0-9_]+' | sed 's/^/-u /') npx vitest run src/daemon/hooks.test.ts src/commands/guardrails.test.ts`
   You should see 206 of 206 pass. Among them: "checkProvenance ignores a squash merge GitHub built, which has one parent", and "says nothing about a squash merge GitHub built, with one parent, that the session only pulled" (the case of #231, on real git).
2. Run the check from outside, on the built program: `npm run build`, then `PROBE_REAL_ONLY=1 node doc/plans/phases/probes/prd-02.r15.mjs`.
   You should see `--- PRD-02.R15: PASS (7 clause labels, 7 passing, real run only)`.
3. After merging, at the end of the next session that pulls `main`: the check should no longer list the merge commit of this pull request as a commit that "says nothing about where it came from".

## Verification outcome

Quoted from [phase-65-verification.md](phase-65-verification.md). 0 of 2 fix loops consumed.

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-02.R15 (clauses 1 and 5, the claimed case) | SHOULD | api | PASS | 0 |
| PRD-05.R2 | MUST | api | PASS (1 of 4 parts BLOCKED) — no regression | 0 |
| PRD-05.R3 | MUST | api | PASS — no regression | 0 |
| PRD-05.R4 | MUST | api | PASS — no regression | 0 |
| PRD-05.R5 | MUST | api | PASS — no regression | 0 |
| PRD-05.R7 | MUST | api | PASS (1 of 4 parts BLOCKED) — no regression | 0 |
| PRD-05.R10 | MUST | api | PASS — no regression | 0 |
| PRD-05.R11 | MUST | api | PASS — no regression | 0 |
| PRD-05.R18 | MUST | api | PASS (5 of 8 parts BLOCKED) — no regression | 0 |
| PRD-07.R4 | MUST | api | PASS — no regression | 0 |
| PRD-07.R6 | MUST | api | PASS — no regression | 0 |
| PRD-07.R9 | MUST | api | PASS — no regression | 0 |
| PRD-08.R5 | MUST | api | PASS — no regression | 0 |
| PRD-09.R2 | MUST | api | PASS — no regression | 0 |
| PRD-09.R4 | MUST | api | PASS — no regression | 0 |
| PRD-09.R5 | MUST | api | PASS — no regression | 0 |
| PRD-10.R2 | MUST | api | PASS — no regression | 0 |
| PRD-10.R3 | MUST | api | PASS — no regression | 0 |
| PRD-10.R4 | MUST | api | PASS — no regression | 0 |
| PRD-10.R5 | MUST | api | PASS — no regression | 0 |
| PRD-10.R6 | MUST | api | PASS — no regression | 0 |

No HUMAN-CHECK scripts and no live gate are owed.

### Outstanding for the human

- [ ] The 2 new tests on real git (`src/commands/guardrails.test.ts`) were not seen to fail without the fix: this container refuses their push to a test repository's `main`. The check from outside covers the same behaviour and failed on the build before the fix. Run step 1 above on your own machine.
- [ ] 7 parts of older checks were not run: PRD-05.R2 clause 2b needs a GitHub login that can read scratch-app; PRD-05.R7 clause 1 (runner) and PRD-05.R18 clauses 1a, 1b, 1c, 2a and 2b need a replay against the real model on this build (`npm run --silent replay`, from a terminal signed in to Claude).

## Standards review — phase 65

- **Read:** `git diff c5f0fc8...9811280` for `src/daemon/hooks.ts`, `src/daemon/hooks.test.ts` and `src/commands/guardrails.test.ts`; the surrounding code in `src/daemon/hooks.ts` (lines 600–670 and 1160–1185) and `src/daemon/hooks.test.ts` (lines 1195–1240); timone's `standards/code-smells.md`, `standards/typescript.md`, `standards/testing.md`; `tsconfig.json`; `package.json`. The project has no lint or format config and no `doc/standards.md`. `doc/plans/phases/probes/prd-02.r15.mjs` was **not** reviewed: the session's guard refused the read, because only the checking step may open the probes folder.
- **Diff:** `c5f0fc8...9811280` — 11 files, +969/−21 (subject: the 4 non-process files, of which 3 were reviewed)
- **Findings:** 2

### 1. `isPlatformMerge` now matches commits that are not merges — Uncommunicative name

- **Where:** `src/daemon/hooks.ts:619–644`
- **What:** The diff widens the function to `return commit.committerEmail === "noreply@github.com";`. Its new doc comment says it covers "the Merge button's merge commit, its **squash merge** …, a rebase merge, or a file edited on GitHub's web page". A file edited on GitHub's web page is not a merge. The doc comment at `CommitEvidence.committerEmail` (line 37) also says "any commit GitHub's servers built". The name still says "merge".
- **Why it matters:** Uncommunicative name. A reader must read the body or the doc comment to learn what the name really covers. The call site `if (isPlatformMerge(commit)) continue;` (line 658) reads as "skip merges", which is now wrong.
- **Suggested remediation:** Rename it to something like `isBuiltByGitHub` or `isPlatformCommit`. — not applied here

### 2. `parentCount` is still collected, but nothing reads it — Dead code

- **Where:** `src/daemon/hooks.ts:41–45`, with the code that fills it at `src/daemon/hooks.ts:1176`
- **What:** The diff removes the only reader (`(commit.parentCount ?? 0) > 1`). It then documents the field as "No rule reads it since timone#90." The collector still parses parents for every commit: `parentCount: parents.trim() === "" ? 0 : parents.trim().split(/\s+/).length`. The tests still set the field in six fixtures. The type checker cannot see this, because the field is optional and is written.
- **Why it matters:** Dead code. The field is computed and carried, and no caller uses it. The comment explains why the field is unused instead of removing it, which is the comment-as-deodorant signal.
- **Suggested remediation:** Remove the field, the parents part of the `git log` format, and the test fixtures that set it. Or, if it is kept on purpose, say what reads it. — not applied here

## Spec review — phase 65

- **Read:** the diff for `src/daemon/hooks.ts`, `src/daemon/hooks.test.ts`, `src/commands/guardrails.test.ts` and `doc/specs/prd/prd-02-inversion-of-control.criteria.md`; `doc/specs/prd/prd-02-inversion-of-control.md` (R15 lines); the R15 section of the criteria file; `doc/plans/phases/phase-65.md` (header, requirements, goal, context, sub-phase 65a); issue fvermaut/timone#90. `doc/plans/phases/probes/prd-02.r15.mjs` was **not** read: the session's guard refused access to the probes folder. Nothing in this review covers the probe.
- **Diff:** `c5f0fc8...9811280` — 11 files, +969/−21
- **Findings:** 1

### 1. A session can avoid the check by setting GitHub as its committer — PRD-02.R15 (clause 1)

- **Where:** `src/daemon/hooks.ts:642–644`
- **What:** `isPlatformMerge` is now `return commit.committerEmail === "noreply@github.com";`. The committer address is the only test. A session that commits with `GIT_COMMITTER_EMAIL=noreply@github.com` and no trailer is excused. The phase file records this risk only for commits made through GitHub's API. The new register note records the wider case: "a commit the session makes itself with the committer `noreply@github.com` is not reported; the report asks whether that is acceptable."
- **Why it matters:** PRD-02.R15 clause 1 says every commit made during the session without a `Timone-Stage` trailer is reported. Issue #90 asked for exactly this committer-only rule ("whatever its parent count"), so the diff matches the ticket. But the limit it leaves against clause 1 is still an open question for the human. It is not a settled decision.
- **Suggested remediation:** fvermaut decides whether this limit is acceptable. If it is not, a follow-up could also require that the commit was already on the remote's default branch when the session started. If it is, R15 should record it as a deliberate limit, as it did with the 2026-08-08 limit. — not applied here

Everything else matches what was asked: the parent-count clause is gone and the committer match is exact; local merges are still reported ("still flags a merge a session made itself" is kept unedited); the one-parent GitHub commit #90 asked for is tested twice, as a unit case and on real git; the extra tests for `users.noreply.github.com` and for "a person pushed to main" pin existing behaviour and are declared in the phase file, so they are not scope creep; the register gets one dated note on R15, status stays `draft`.

## Notes

- Neither review could read the verification probe `doc/plans/phases/probes/prd-02.r15.mjs` (+267 lines), because the session's guard opens the probes folder only to the checking step. It is a test instrument, not part of the program, but no review looked at it.
- The pull request names #101 as closing with this ticket, as fvermaut asked on #90. It names #231 as covered by this fix without a closing word, because no person has said to close it.
