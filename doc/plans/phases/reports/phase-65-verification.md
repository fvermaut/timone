# Phase 65 — Verification Report

- **Date:** 2026-10-22
- **Phase:** [phase-65.md](../phase-65.md) — stamped `Complete`, completion report [phase-65-complete.md](phase-65-complete.md)
- **Scope:** PRD-02.R15 (SHOULD, `api`, `draft`), clauses 1 and 5, for one case: commits GitHub's servers built, which a session only pulled ([timone#90](https://github.com/fvermaut/timone/issues/90), with #101 and #231).
- **Live gate owed:** no. No criterion in scope is on the `live` channel.
- **Regression set (derived):** 32 criteria are MUST + `api` + `verified` at this HEAD; 20 remain after narrowing (listed under *Regression*).
- **Branch:** `timone/90-the-platform-merge-carve-out-misses-squa-chunk-2` @ `b80076c749b140b3ae7b0b63f0ac96b65a353f4c`. It is cut from `main` at `c5f0fc8`, which holds phase 64's verification, so nothing was merged in first.

## Environment

- Timone is a command-line program with no server. `npm run build` built `dist/` at `b80076c`. Every check runs the built `dist/cli.js`: the `guardrails baseline` hook at session start and the `guardrails check` hook at session end, in a throwaway folder with a local bare remote.
- The break runs of the new R15 labels use the build of `c5f0fc8` (main just before phase 65), made outside the tree by `_old-build.mjs` from `git archive` and compiled. No source of it was read.
- This container sets `GIT_COMMITTER_NAME` and `GIT_COMMITTER_EMAIL` in the environment, and these beat `git -c user.email`. Every commit the R15 check script makes therefore sets its author and committer in the environment of that one git command. Each label then reads the commits back (`git log --format=%P%x09%ce`) and fails as an instrument fault if a commit's parent count or committer is not the one asked for.
- **Build-health smoke**, run once at the end, not as evidence: `npx vitest run` at `b80076c`: 78 test files, 2835 tests, **2763 passed, 72 failed**, 8.4 s.
- **Smoke failures**, compared with `doc/plans/phases/reports/phase-64-verification.md` on `main` (`c5f0fc8`), lines 17–24. That list holds 70 tests, all failing on the container's push refusal: `src/commands/guardrails.test.ts` 45, `src/numbers.test.ts` 16, `src/workspace.test.ts` 6, `src/commands/number.test.ts` 3. Here:
  - `src/numbers.test.ts` 16, `src/workspace.test.ts` 6, `src/commands/number.test.ts` 3, and 45 in `src/commands/guardrails.test.ts`: **old** (the same files and counts as that list);
  - `src/commands/guardrails.test.ts > the provenance trailer, read back off real commits > says nothing about a squash merge GitHub built, with one parent, that the session only pulled`: **new**;
  - `src/commands/guardrails.test.ts > the provenance trailer, read back off real commits > still flags an untrailed commit a person pushed to main, when the session only pulled it`: **new**.

  All 72 failure messages hold `Refused: this run may push only to \`timone/90-the-platform-merge-carve-out-misses-squa-chunk-2\``, counted from the JSON report (72 of 72). They fail while setting up their own test repositories, before any assertion about Timone runs. The two new ones are tests this phase added; they push to a test repository's `main`, so they cannot run in this container. This pass's list, for the next pass: the 72 above.
- **Smoke against check scripts:** no alarm. The first new failing test is about the behaviour the label "clause 5, GitHub squash merges pulled" passes. It does not contradict it: it never reached its assertion. That label did its break run this pass and went red on the build of `c5f0fc8`.
- **The two changed test files, run as the runner asked, not as evidence.** `npx vitest run src/daemon/hooks.test.ts src/commands/guardrails.test.ts` at `b80076c`: 206 tests, 159 passed, 47 failed, all 47 on the push refusal. Then once more with only `src/daemon/hooks.ts` replaced by `main`'s copy (`git show main:src/daemon/hooks.ts`, written to the file without being read, then restored with `git checkout --`): 156 passed, 50 failed. The three that changed, all in `hooks.test.ts`, pass with the fix and fail without it:
  - `checkProvenance ignores a squash merge GitHub built, which has one parent`
  - `checkProvenance ignores a commit GitHub built when its evidence has no parent count`
  - `checkProvenance counts only the session's own commit when it sits beside a one-parent commit GitHub built`

  The test of #231 on real git (`guardrails.test.ts`, named above) could not run in this container either way, so it was not seen to fail without the fix. The R15 label "clause 5, GitHub squash merges pulled" covers the same behaviour on the built program, and it went red on the build before the fix.
- **The two test files remove no line.** `git diff --numstat main...HEAD -- src/` prints line counts only: `guardrails.test.ts` +107 −0, `hooks.test.ts` +91 −0, `hooks.ts` +27 −19. No existing test line was changed or removed.

## Independence declaration

Read: `doc/specs/prd/prd-02-inversion-of-control.criteria.md` (R15's block, lines 284–331, and the Priority, Status, Verify-via and Depends-on fields of every block in every register, printed by a script); `doc/plans/phases/phase-65.md` lines 1–30 (Status line, Screens changed line, the requirements header, and the first lines of the goal description, which name #90, #101 and #231 and the two cases the phase leaves out; I stopped there, before the sub-phases); `doc/plans/phases/reports/phase-65-complete.md`, whole; `doc/plans/phases/reports/phase-65-departures.md`, its heading lines only, to append an entry; `STATUS.md`; `package.json` scripts; the probe directory's shared helpers (`_lib.mjs`, `_rig.mjs`, `_steps.mjs`, `_old-build.mjs`, `_register-session.mjs`, `run.mjs`) and `prd-02.r15.mjs`; on `main`, by `git show`: `doc/plans/phases/reports/phase-64-verification.md`, first the lines holding a heading or the word "smoke" (which also showed its section headings and one line of its probe section), then lines 17–24, its smoke line and list; and the heading lines of `phase-64-departures.md`. Name lists: `git diff --name-only main...HEAD` and `git diff --numstat main...HEAD -- src/`. Test names from the suite's own JSON report.

Not read: handoffs, diffs, source, the committed test suite, ADRs. No implementation source was read; all criterion evidence below comes from verifier-authored probes, run from `doc/plans/phases/probes/` or written this pass.

**Not checked here, because it needs reading code:** whether the comment above the carve-out in `src/daemon/hooks.ts` states the new rule, and whether the setup step that the departures record lists for the two real-git tests is justified. Both are for the code review on the pull request. What this pass can say about the second is above: no existing test line was changed.

## Verdict summary

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

**Gate:** met. No MUST criterion is claimed. Every part of the 20 standing criteria that could run here passed, so there is no regression. 7 parts could not run here; they need a GitHub login or a replay against the real model, as in phases 63 and 64. Zero fix loops.

## Evidence

### PRD-02.R15 — PASS for the claimed case (stays `draft`)

Run: `PROBE_REAL_ONLY=1 PROBE_BREAK_FOR='<the six new labels>' node doc/plans/phases/probes/prd-02.r15.mjs` — the six new labels do their break run, then their real run; phase 64's label does its real run only. Exit 0, `--- PRD-02.R15: PASS (7 clause labels, 7 passing, real run only)`.

Each label runs one session from outside: the `SessionStart` hook, then what the session does in the project's clone, then its work put on the remote, then the `Stop` hook. "Silent" means exit 0 and no output. "Reported" means a non-zero exit and output that names the commit's short id and the `Timone-Stage` trailer. A GitHub-built commit is made in a second clone outside the timone root, with committer `GitHub <noreply@github.com>`, and landed on the remote's `main` after the session's baseline.

**Clause 5** — *"GIVEN a clean session of either kind WHEN the hooks run THEN they stay silent"*

- `=== PRD-02.R15 clause 5` (phase 64's case, PRD-07.R3 committed and pushed): real run only — PASS.
- `=== PRD-02.R15 clause 5, GitHub squash merges pulled` — a person's session on `main` runs `git pull --ff-only` and receives three one-parent commits GitHub built, with no trailer, as in #231.
  - break run, on the build of `c5f0fc8`: **RED** — `the hooks spoke on a clean session (exit 2): … ⚠️ 3 commit(s) made in this session say nothing about where they came from … fixture 1ccb3c6 on main - fixture b6395c1 on main - fixture f3fc4bf on main`.
  - real run, on `b80076c`: **PASS** — silent.
- `=== PRD-02.R15 clause 5, run branched from a main GitHub moved` — a run (in the ledger, on its work branch) pulls `main` after GitHub squash-merged three pull requests, cuts its work branch from it, commits with its own trailer and puts the branch on the remote, as in #101.
  - break run, on the build of `c5f0fc8`: **RED** — `guardrails handed 1 finding(s) back to fixture#12/1 … ⚠️ 3 commit(s) made in this session say nothing about where they came from`.
  - real run: **PASS** — silent.
- `=== PRD-02.R15 clause 5, GitHub two-parent merge pulled` — a person's session pulls a two-parent merge commit GitHub built. The pull request's own commits carry other sessions' trailers.
  - The build before the fix was already silent here, so the break step changes the one fact the clause rests on: the same merge, pulled the same way, with a person as committer. The plan keeps that case reported on purpose. Break run: **RED** — `⚠️ 1 commit(s) made in this session say nothing about where they came from … fixture 104cec3 on main`.
  - real run: **PASS** — silent.

**Clause 1** — *"GIVEN any agent session at the timone root completes, whether the daemon spawned it or a human started it WHEN the guardrail hooks run THEN violations of the deterministic rules — … and commits made without a `Timone-Stage` trailer — are reported loudly"*. Each label runs a person's session on `main` and a run's session on its work branch; both must report.

- `=== PRD-02.R15 clause 1, a session's own two-parent merge` — the session merges a branch on its own machine with `--no-ff`: two parents, the session as committer, no trailer.
  - break run (the same merge, with GitHub as committer): **RED** — `person session, the same merge with GitHub as committer: the hooks did not report commit f5033f4 (exit 0): (no output)`.
  - real run: **PASS** — reported, in both kinds of session.
- `=== PRD-02.R15 clause 1, a session's own one-parent squash` — the session runs `git merge --squash` and commits: one parent, the session as committer, no trailer.
  - break run (GitHub as committer): **RED** — `the hooks did not report commit 7d17d93 (exit 0): (no output)`.
  - real run: **PASS** — reported, in both kinds of session.
- `=== PRD-02.R15 clause 1, a person's users.noreply.github.com address` — an untrailed commit whose committer is `12345+someone@users.noreply.github.com`.
  - break run (committer exactly `noreply@github.com`): **RED** — `the hooks did not report commit 72c625a (exit 0): (no output)`.
  - real run: **PASS** — reported, in both kinds of session.

**What the break runs of clause 1 also show.** A commit the session makes itself, with no trailer, is not reported when its committer address is `noreply@github.com`. Clause 1's words cover such a commit. The phase does not claim this case, and the build before it already behaved this way for a two-parent merge. See *Questions for the human*.

**Not checked:** clauses 2, 3 and 4 (a first finding handed back with nothing recorded, a run flagged, a person's session journalled). This phase does not claim them. R15's own note of 2026-08-14 says they owe a live observation.

**Not covered by this phase, as its plan says:** an untrailed commit a person pushes straight to `main` is still reported against a session that later pulls it; and a squash merge still hides the squashed commits' trailers in `main`'s history. Neither was checked here; the runner asked that both stay out.

### The 20 standing criteria — no regression

Run: `node doc/plans/phases/probes/run.mjs --regression --jobs=6 --only=<the 20 IDs below>`. Real runs only. 4 min 24 s. `20 passing, 0 failing, 0 blocked, 0 with no probe.` 116 parts printed; 109 passed, 7 BLOCKED, none failed.

- PRD-05.R2: `PASS (4 clause labels, 3 passing, 1 blocked)` — BLOCKED: clause 2b, `GitHub could not be read from here (gh)`.
- PRD-05.R3: `PASS (19 clause labels, 19 passing)`.
- PRD-05.R4: `PASS (6 clause labels, 6 passing)`.
- PRD-05.R5: `PASS (6 clause labels, 6 passing)`.
- PRD-05.R7: `PASS (4 clause labels, 3 passing, 1 blocked)` — BLOCKED: clause 1 (runner), `needs a real model: replay case scratch-app#37 is its instrument, and the newest recorded replay is older than this build`.
- PRD-05.R10: `PASS (6 clause labels, 6 passing)`.
- PRD-05.R11: `PASS (12 clause labels, 12 passing)`.
- PRD-05.R18: `PASS (8 clause labels, 3 passing, 5 blocked)` — BLOCKED: clauses 1a, 1b, 1c, 2a and 2b, `the recorded replay is older than this build … A new replay on this build is owed (npm run --silent replay, from a terminal with a model login)`.
- PRD-07.R4: `PASS (7 clause labels, 7 passing)`.
- PRD-07.R6: `PASS (4 clause labels, 4 passing)`.
- PRD-07.R9: `PASS (4 clause labels, 4 passing)`.
- PRD-08.R5: `PASS (1 clause labels, 1 passing)`.
- PRD-09.R2: `PASS (4 clause labels, 4 passing)`.
- PRD-09.R4: `PASS (8 clause labels, 8 passing)`.
- PRD-09.R5: `PASS (7 clause labels, 7 passing)`.
- PRD-10.R2: `PASS (6 clause labels, 6 passing)`.
- PRD-10.R3: `PASS (3 clause labels, 3 passing)`.
- PRD-10.R4: `PASS (2 clause labels, 2 passing)`.
- PRD-10.R5: `PASS (3 clause labels, 3 passing)`.
- PRD-10.R6: `PASS (2 clause labels, 2 passing)`.

## HUMAN-CHECK scripts

None. No criterion in scope is on the `human` channel, and the completion report carries no HUMAN-CHECK forward.

## Live gates

No criterion in scope is on the `live` channel.

## Regression

The derived set at `b80076c` is 32 criteria. The phase changes `src/daemon/hooks.ts`, `src/daemon/hooks.test.ts`, `src/commands/guardrails.test.ts`, and under `doc/` only its own phase files.

Kept, 20, all PASS above (none observed wrong):

- with no `Depends-on` line, so always in scope: PRD-05.R2, PRD-05.R3, PRD-05.R4, PRD-05.R5, PRD-05.R7, PRD-05.R10, PRD-05.R11, PRD-05.R18, PRD-08.R5, PRD-09.R2, PRD-09.R4, PRD-09.R5, PRD-10.R2, PRD-10.R3, PRD-10.R4, PRD-10.R5, PRD-10.R6;
- with `src/daemon/` in `Depends-on`: PRD-07.R4, PRD-07.R6, PRD-07.R9.

Narrowed out, 12 — none of their prefixes is touched:

- PRD-01.R2 — `src/manifest.ts, src/commands/projects.ts`
- PRD-01.R3 — `src/commands/workspace.ts, src/git.ts`
- PRD-06.R5 — `src/adapters/credentials.ts`, `src/daemon/container-runtime.ts`
- PRD-07.R1 — `src/daemon/runs.ts, src/runner/`
- PRD-07.R2 — `src/daemon/runs.ts, src/runner/, src/manifest.ts`
- PRD-07.R3 — `src/daemon/runs.ts, src/runner/driver.ts`
- PRD-07.R10 — `.claude/skills/timone-plan/, src/adapters/github-tickets.ts, src/runner/`
- PRD-07.R12 — `process.md, doc/adr/, doc/specs/prd/, src/daemon/runs.ts`
- PRD-07.R13 — `src/commands/takeover.ts, src/daemon/runs.ts`
- PRD-08.R1 — `src/daemon/chunk-zero.ts, src/adapters/, src/manifest.ts`
- PRD-08.R2 — `src/runner/actions.ts, src/adapters/, src/manifest.ts`
- PRD-08.R4 — `src/daemon/chunk-zero.ts, src/runner/actions.ts, src/adapters/`

## Probes

**21 probes proven able to fail, 0 not.**

- `prd-02.r15.mjs` — extended this pass with six labels, the first check of clauses 1 and 5 for this case. All six did their break run and went red, then green. Phase 64's label ran real run only; it went red on `ba699d2` in phase 64's pass. A helper `session()` in the file runs one session from outside; GitHub's side is a clone outside the timone root, because a folder inside the root is the session's own change outside `projects/<target>/` (the first run put it inside, and the run session was correctly reported for it; fixed in the instrument before any verdict).
- Ran **without a break run** this pass, each proven able to fail by an earlier pass: PRD-05.R2, PRD-05.R3, PRD-05.R4, PRD-05.R5, PRD-05.R7, PRD-05.R10, PRD-05.R11, PRD-05.R18, PRD-07.R4, PRD-07.R6, PRD-07.R9, PRD-08.R5, PRD-09.R2, PRD-09.R4, PRD-09.R5, PRD-10.R2, PRD-10.R3, PRD-10.R4, PRD-10.R5, PRD-10.R6, and PRD-02.R15's phase-64 label. None is `revised`, and the smoke contradicts none of them.
- **Clause coverage.** R15 has five clauses. Before this pass its probe printed a label for clause 5 only. It now prints labels for clauses 1 and 5. Clauses 2, 3 and 4 have no label: this phase does not claim them, and they owe a live observation.

## Fix-loop accounting

0 of 2 — the initial pass was clean.

## Figures on the preview's data

No screen changed in this phase.

## Questions for the human

1. **A session that gives its own commit GitHub's committer address is not reported.** The check now excuses every commit whose committer is exactly `noreply@github.com`, whatever its shape. Only GitHub's servers normally use that address. But a session can set it on a commit it makes itself, and then that commit is not reported, even with no trailer. The break runs of the three clause-1 labels above show it: the same commits, with that address, gave no output. Clause 1 says a commit made without a trailer is reported, so its words cover this case. The phase does not claim it, and the build before it was already silent on such a commit with two parents. Telling a GitHub-built commit from a copy would need something the register does not choose, for example GitHub's signature on the commit. Is it acceptable that the committer address alone decides?

## Register changes

- PRD-02.R15: no status change; it stays `draft`. A dated marker records that clauses 1 and 5 were checked for this case, and why the status stays: clauses 2 to 4 are not checked, and the live observation its 2026-08-14 note lists is still owed.

## Carried forward

7 parts of three standing criteria are BLOCKED: PRD-05.R2 clause 2b (needs a GitHub login that can read scratch-app), PRD-05.R7 clause 1 (runner) and PRD-05.R18 clauses 1a, 1b, 1c, 2a, 2b (need the replay against the real model on this build: `npm run --silent replay`, from a terminal signed in to Claude). Nothing was observed wrong. Recorded in [`phase-65-departures.md`](phase-65-departures.md).
