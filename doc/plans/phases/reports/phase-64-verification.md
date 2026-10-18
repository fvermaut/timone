# Phase 64 — Verification Report

- **Date:** 2026-10-18
- **Phase:** [phase-64.md](../phase-64.md) — stamped `Complete — see reports/phase-64-complete.md`, completion report [phase-64-complete.md](phase-64-complete.md)
- **Scope:** PRD-02.R15 (SHOULD, `api`), clause 5 only, for the one false finding the phase names: a clean session whose work holds PRD-07.R3's note as the register has it. The completion report's requirements line says the same.
- **Live gate owed:** no. No criterion in scope is on the `live` channel.
- **Regression set (derived):** 32 criteria are MUST + `api` + `verified` at this HEAD. Narrowed by `Depends-on` against this phase's changed files, 20 remain: PRD-05.R2, R3, R4, R5, R7, R10, R11, R18; PRD-07.R4, R6, R9; PRD-08.R5; PRD-09.R2, R4, R5; PRD-10.R2, R3, R4, R5, R6.
- **Branch:** `timone/250-the-verified-status-check-reads-was-neve` @ `6d80fb2`. Its base is `ba699d2`, the tip of `main` when this pass started, so nothing had to be merged in.
- **The runner's instructions** for this step asked for three things to be confirmed. They are checked by [`phase-64-requested.mjs`](../probes/phase-64-requested.mjs) and the R15 probe, and reported under *Evidence*. They are not register clauses and do not count in the verdict table.

## Environment

- Timone is a command-line program, so there is no server to stand up. `npm run build` (`tsc`, exit 0) at `6d80fb2`, then every check ran the built `dist/cli.js`. The session-end check was run as a session runs it: `guardrails baseline`, then a commit, then `guardrails check`, each with a hook payload on standard input, in a throwaway timone root with one managed project and a local bare remote.
- This container refuses every `git push` that is not to this run's work branch, also inside throwaway repositories. The checks put a commit on their throwaway remote with a `git fetch` run in the remote instead, which leaves the same state a push leaves. Nothing was switched off.
- The break legs ran the build of `ba699d2` (the base of this branch), compiled outside the tree by `_old-build.mjs` into `/tmp/timone-probe-builds/`.
- **Changed-file tests**, run once while working, as the runner asked, not as evidence: `npx vitest run src/daemon/register.test.ts src/daemon/hooks.test.ts`: 2 files, 96 of 96 passed.
- **Build-health smoke**, run once at the end, not as evidence: `npx vitest run` at `6d80fb2`: 78 test files, 2829 tests, **2759 passed, 70 failed**, 9.4 s.
- **Smoke failures**, compared with `doc/plans/phases/reports/phase-63-verification.md` on `main` (`ba699d2`), lines 15–19. Its smoke had 1 failure, named: `src/daemon/register.test.ts > this repository's own registers > claim nothing they have not established`. That test **passes** here. The same lines say that the other 70 tests on phase 62's list failed there because that container refused their pushes to a local fixture's `main`. Here, by that list, all 70 failures are **new** to phase 63's list, and every one is that same push refusal:
  - `src/commands/guardrails.test.ts` — 45 tests;
  - `src/numbers.test.ts` — 16 tests (`reserveNumber > …`);
  - `src/workspace.test.ts` — 6 tests (`syncWorkspace > …`);
  - `src/commands/number.test.ts` — 3 tests (`timone number > …`).

  Every one of the 70 failure messages holds `Command failed: git push … main` and this container's words `Refused: this run may push only to timone/250-the-verified-status-check-reads-was-neve` (counted from the JSON report, 70 of 70). They fail while setting up their own test repositories, before any assertion about Timone runs. The completion report counts the same 70 in the same four files. **I did not run the suite without the change**: these rules forbid building or running the default branch to compare. The comparison is with phase 63's list above, which names the one test this phase was written to fix, and says the 70 are the container's push refusal. Nothing in this smoke counts against the fix. This pass's list, for the next pass: the 70 tests in the four files above, each failing on the push refusal. The full names are in the suite's output: `npx vitest run src/commands/guardrails.test.ts src/numbers.test.ts src/workspace.test.ts src/commands/number.test.ts`.
- **Smoke against check scripts:** no alarm. Some failing tests in `guardrails.test.ts` are about the session-end check (for example "a session a human drove > says nothing when the session behaved"), which is the behaviour the R15 probe passes. They do not contradict it: they never reached their assertions, because their setup push was refused. The probe's own break run, done this pass, shows it can fail: it went red on the build of `ba699d2`.

## Independence declaration

Read: `doc/specs/prd/prd-02-inversion-of-control.criteria.md` (R15's block, and the list of every block's Priority, Status, Verify-via and Depends-on fields); `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md` (R3's block, which the claimed case is about); `doc/plans/phases/phase-64.md` lines 1–20 (Status line, Screens changed line, the requirements header; I stopped at the next heading); `doc/plans/phases/reports/phase-64-complete.md`, whole; `doc/plans/phases/reports/phase-64-departures.md`, its three heading lines only, to append an entry in the same form; `STATUS.md`; the project's `.claude/settings.json` (the hook commands) and `package.json` scripts; the built CLI's `--help`; the probe directory's shared helpers (`_lib.mjs`, `_rig.mjs`, `_steps.mjs`, `_old-build.mjs`, `run.mjs`, part of `prd-05.r3.mjs`, and `prd-05.r2.mjs` around its BLOCKED line); on `main`, by `git show`: `reports/phase-63-verification.md`. I first printed every line holding a heading or the word "smoke". This also showed its verdict headings (for example "PRD-05.R7 — BLOCKED in part") and the line numbers of its other sections. Then I printed lines 15–19, its smoke line and list. The list of this phase's changed file names, by `git diff --name-only origin/main...HEAD`.

Not read: handoffs, diffs, source, the committed test suite, ADRs. No implementation source was read; all criterion evidence below comes from verifier-authored probes, run from `doc/plans/phases/probes/` or written this pass. The runner's instructions name `src/daemon/register.ts` and `src/daemon/hooks.ts`; neither was opened. What they do was observed from the built hooks' output only. `CONTEXT.md` and `README.md` were not needed and not read. This project has no `doc/standards.md`.

## Verdict summary

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-02.R15 (clause 5, the claimed case) | SHOULD | api | PASS | 0 |
| PRD-05.R2 | MUST | api | BLOCKED in part — 3 clause labels PASS, clause 2b BLOCKED | 0 |
| PRD-05.R3 | MUST | api | PASS | 0 |
| PRD-05.R4 | MUST | api | PASS | 0 |
| PRD-05.R5 | MUST | api | PASS | 0 |
| PRD-05.R7 | MUST | api | BLOCKED in part — 3 clause labels PASS, clause 1 (runner) BLOCKED | 0 |
| PRD-05.R10 | MUST | api | PASS | 0 |
| PRD-05.R11 | MUST | api | PASS | 0 |
| PRD-05.R18 | MUST | api | BLOCKED in part — 3 clause labels PASS, 5 BLOCKED | 0 |
| PRD-07.R4 | MUST | api | PASS | 0 |
| PRD-07.R6 | MUST | api | PASS | 0 |
| PRD-07.R9 | MUST | api | PASS | 0 |
| PRD-08.R5 | MUST | api | PASS | 0 |
| PRD-09.R2 | MUST | api | PASS | 0 |
| PRD-09.R4 | MUST | api | PASS | 0 |
| PRD-09.R5 | MUST | api | PASS | 0 |
| PRD-10.R2 | MUST | api | PASS | 0 |
| PRD-10.R3 | MUST | api | PASS | 0 |
| PRD-10.R4 | MUST | api | PASS | 0 |
| PRD-10.R5 | MUST | api | PASS | 0 |
| PRD-10.R6 | MUST | api | PASS | 0 |

**The gate is not met, and only because of BLOCKED parts.** No check failed and there is no regression. Three standing criteria have parts that cannot run in this container: they need a real model, or a GitHub login that can read scratch-app's pull requests. Every part that could run passed.

## Evidence

### PRD-02.R15 — PASS (clause 5, for the claimed case)

Probe [`prd-02.r15.mjs`](../probes/prd-02.r15.mjs), written this pass, run on its own with its break leg:

```
$ node doc/plans/phases/probes/prd-02.r15.mjs
=== PRD-02.R15 clause 5 — GIVEN a clean session of either kind WHEN the hooks run THEN they stay silent — a session that commits and pushes PRD-07.R3 as the register has it ("that ticket was never woken")
    break leg: RED (as required) — person session, whole PRD-07 register: the hooks spoke on a clean session (exit 2): guardrails handed 1 finding(s) back to this session An automatic check found something wrong with this session's work: ⚠️ fixture: doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md marks 1 requirement(s) verified on more than it established A requirement is verified when something stands behind it. These say more than that: - R3 is marked verified, and its own notes
    green leg: PASS — assertion held
--- PRD-02.R15: PASS (1 clause labels, 1 passing)
```

The real leg ran four sessions on this build: a person's session and a run's session (a run in the ledger, on its work branch), each committing either the whole PRD-07 register as it stands on this branch or R3's block alone, and each putting the commit on the remote. All four: exit 0, nothing printed. On the build of `ba699d2` the first of them was handed the finding back, quoting `was never`. **PASS** for the case the phase claims. Clauses 1–4 were not checked: the phase does not claim them.

### The runner's three points (not register clauses)

1. **The real PRD-07.R3 note gives no finding.** This is the R15 probe above: no finding, from either kind of session, with the whole register file or R3 alone. Confirmed.
2. **"never seen", "never observed", "never triggered" are still flagged.** [`phase-64-requested.mjs`](../probes/phase-64-requested.mjs) part 2: a verified block whose note holds each phrase, with and without a `Falsified-by:` line (six sessions), is handed back every time, and the finding quotes the phrase. Break leg: the same notes on a `draft` block; the check said nothing, so the assertion went red. Confirmed.
3. **Each finding has its own advice, and the never-seen one no longer asks for `Falsified-by:`.** Part 3: one register with two findings, R1 (a note saying `never observed`) and R2 (a claim with "never" on the `live` channel, no `Falsified-by:` line). Each finding prints its own advice under it:
   - R1: "Either put the status back to `draft`, or, once that clause has been seen to hold, say so in the note in place of the words quoted."
   - R2: "Either put the status back to `draft`, or name what would go red if it stopped holding in a `- **Falsified-by:**` line."

   Break leg, on the build of `ba699d2`: R1 had no advice of its own; the one advice line, printed once for the whole list, offered the `Falsified-by:` line. Red, as required. Confirmed.

```
$ node doc/plans/phases/probes/phase-64-requested.mjs
=== phase 64 part 2 — a verified requirement whose note says "never seen", "never observed" or "never triggered" is still flagged, with or without a Falsified-by line, and the finding quotes the words
    break leg: RED (as required) — a verified block whose note says "never seen" was not flagged with the words quoted (exit 0): (silent)
    green leg: PASS — assertion held
=== phase 64 part 3 — each finding carries its own advice under it; the never-seen finding says to go back to draft or change the note and asks for no Falsified-by line; the watched-only finding still offers one
    break leg: RED (as required) — a finding has no advice of its own under it: R1 "", R2 "Either put the status back to `draft`, or name what would go red if it stopped holding in a `- **Falsified-by:**` line."
    green leg: PASS — assertion held
--- phase 64 (requested): PASS (2 clause labels, 2 passing)
```

### Standing regression set

`node doc/plans/phases/probes/run.mjs --regression --only=<the 20 IDs above> --jobs=4`, real runs only, 5 min 24 s, exit 0. The verdict table it printed:

```
| PRD-05.R2  | PASS      | R2 — The runner acts only through the actions code gives it
| PRD-05.R3  | PASS      | R3 — Nothing reaches a default branch without a yes from a named person
| PRD-05.R4  | PASS      | R4 — A run that changed the project's files ends at a pull request
| PRD-05.R5  | PASS      | R5 — Code lists every departure on the pull request, and a skipped check comes first
| PRD-05.R7  | PASS      | R7 — The runner never records an approval nobody gave
| PRD-05.R10 | PASS      | R10 — Only named people can instruct the runner
| PRD-05.R11 | PASS      | R11 — `takeover` and `cancel` stay, and `retry` goes
| PRD-05.R18 | PASS      | R18 — The runner passes a replay of the recorded failures
| PRD-07.R4  | PASS      | R4 — Nothing is built on top of an open pull request
| PRD-07.R6  | PASS      | R6 — A held ticket says what it waits for, and a named person can overrule
| PRD-07.R9  | PASS      | R9 — A ticket with an open pull request keeps its run and is not picked up again
| PRD-08.R5  | PASS      | R5 — When the file names nobody, the ticket still opens
| PRD-09.R2  | PASS      | R2 — The command can be copied and run as it stands
| PRD-09.R4  | PASS      | R4 — A takeover typed while a step is running waits for it, then opens
| PRD-09.R5  | PASS      | R5 — The written rules say the same as the machine does
| PRD-10.R2  | PASS      | R2 — In a container with no run in the ledger, the guard judges by the container's step
| PRD-10.R3  | PASS      | R3 — In a container the guard never asks
| PRD-10.R4  | PASS      | R4 — Text that only names a check-script folder is not judged
| PRD-10.R5  | PASS      | R5 — A real read, list, run or write of a check script is still judged
| PRD-10.R6  | PASS      | R6 — A test runs the guard command as a container session runs it
```

The runner's table reads PASS for a probe whose decided labels all pass, even when some labels are BLOCKED. Per label, from its output:

- **PRD-05.R2** — `--- PRD-05.R2: PASS (4 clause labels, 3 passing, 1 blocked)`. Clause 2b: `BLOCKED — GitHub could not be read from here (gh).` It reads the commits of scratch-app's pull requests, and the GitHub login in this container cannot read them.
- **PRD-05.R7** — `(4 clause labels, 3 passing, 1 blocked)`. Clause 1 (runner): `BLOCKED — needs a real model: replay case scratch-app#37 is its instrument, and the newest recorded replay is older than this build`.
- **PRD-05.R18** — `(8 clause labels, 3 passing, 5 blocked)`. Clauses 1a, 1b, 1c, 2a, 2b: `BLOCKED — the recorded replay is older than this build … A new replay on this build is owed (npm run --silent replay, from a terminal with a model login).` Clauses 1d, 1e, 1f pass.
- Every other criterion: every label PASS. Label counts as printed: PRD-05.R3 19, R4 6, R5 6, R10 6, R11 12; PRD-07.R4 7, R6 4, R9 4; PRD-08.R5 1; PRD-09.R2 4, R4 8, R5 7; PRD-10.R2 6, R3 3, R4 2, R5 3, R6 2.

## HUMAN-CHECK scripts

None. No criterion in scope is on the `human` channel, and the completion report carries none forward.

## Live gates

No criterion in scope is on the `live` channel.

## Regression

The derived set's 20 criteria ran: 17 PASS on every label; PRD-05.R2, R7 and R18 PASS on every label that could run, and BLOCKED in part (see *Evidence*). No regression.

What the narrowing removed. This phase's changed files are `src/daemon/hooks.ts`, `src/daemon/register.ts`, their two test files, and four files under `doc/plans/phases/`. None of them is under these prefixes:

- PRD-01.R2 — `src/manifest.ts, src/commands/projects.ts`
- PRD-01.R3 — `src/commands/workspace.ts, src/git.ts`
- PRD-06.R5 — `src/adapters/credentials.ts`, `src/daemon/container-runtime.ts`
- PRD-07.R1 — `src/daemon/runs.ts, src/runner/`
- PRD-07.R2 — `src/daemon/runs.ts, src/runner/, src/manifest.ts`
- PRD-07.R3 — `src/daemon/runs.ts, src/runner/driver.ts`
- PRD-07.R10 — `.claude/skills/timone-plan/, src/adapters/github-tickets.ts, src/runner/`
- PRD-07.R12 — `process.md, doc/adr/, doc/specs/prd/, src/daemon/runs.ts` (no register changed in this phase)
- PRD-07.R13 — `src/commands/takeover.ts, src/daemon/runs.ts`
- PRD-08.R1 — `src/daemon/chunk-zero.ts, src/adapters/, src/manifest.ts`
- PRD-08.R2 — `src/runner/actions.ts, src/adapters/, src/manifest.ts`
- PRD-08.R4 — `src/daemon/chunk-zero.ts, src/runner/actions.ts, src/adapters/`

Kept by a prefix this phase touches: PRD-07.R4, R6, R9 (each names `src/daemon/`). The other 17 carry no `Depends-on` line, so they are always in.

## Probes

**22 probes proven able to fail, 0 not.** Two were written this pass and did their break run, red then green, with one helper file:

- [`prd-02.r15.mjs`](../probes/prd-02.r15.mjs) — PRD-02.R15, the first check of this criterion. Break: the build of `ba699d2`. Red, then green. It prints one label, clause 5. The register has five clauses: clauses 1–4 have no label, because this phase does not claim them. A later pass that checks them adds their labels to this file.
- [`phase-64-requested.mjs`](../probes/phase-64-requested.mjs) — the runner's points 2 and 3, not a criterion. Break runs as described under *Evidence*. Red, then green on both labels.
- [`_register-session.mjs`](../probes/_register-session.mjs) — a helper both of them use (one session, its commit, and the Stop hook's output). It is not a probe on its own.

The 20 probes of the standing set ran from the directory, **real run only, without a break run**: PRD-05.R2, PRD-05.R3, PRD-05.R4, PRD-05.R5, PRD-05.R7, PRD-05.R10, PRD-05.R11, PRD-05.R18, PRD-07.R4, PRD-07.R6, PRD-07.R9, PRD-08.R5, PRD-09.R2, PRD-09.R4, PRD-09.R5, PRD-10.R2, PRD-10.R3, PRD-10.R4, PRD-10.R5, PRD-10.R6. Each was proven able to fail by an earlier pass. None is `revised`, and the smoke contradicts none of them, so none was owed a break run.

Clause coverage: no register changed in this phase, so no clause was added to any criterion of the standing set since the last pass. The label counts are listed under *Evidence*.

## Fix-loop accounting

0 of 2 — the initial pass was clean. Nothing failed; the BLOCKED parts consume no loop.

## Figures on the preview's data

No screen changed in this phase. The phase file says: "Screens changed: none".

## Questions for the human

None.

## Register changes

- PRD-02.R15: status stays `draft`. A dated marker was added: clause 5 checked for the claimed case, linking this report and the probe. Clauses 1–4 were not checked, and the note on R15 says what is still owed.
- No other status changed. The standing set was `verified` and stays so; its BLOCKED parts observed nothing.

## Carried forward

- **PRD-05.R2 clause 2b** — BLOCKED: the GitHub login in this container cannot read scratch-app's pull requests. Run `node doc/plans/phases/probes/prd-05.r2.mjs` with a GitHub login that can read them.
- **PRD-05.R7 clause 1 (runner)** and **PRD-05.R18 clauses 1a, 1b, 1c, 2a, 2b** — BLOCKED: they need a replay of the runner on this build against the real model (`npm run --silent replay`, from a terminal with a model login).
- **The 70 tests the container refuses** — they should be run once on a machine that does not refuse a push to `main`, as the completion report says.

One entry for these is in [`phase-64-departures.md`](phase-64-departures.md).
