# Phase 50 — Verification Report

- **Date:** 2026-10-05
- **Phase:** [phase-50.md](../phase-50.md) — stamped `Complete`, completion report [phase-50-complete.md](phase-50-complete.md)
- **Scope:** PRD-07.R7 (MUST, `live`), PRD-07.R14 (MUST, `live`). The completion report's requirements line names the same two.
- **Live gate owed:** yes — PRD-07.R7 and PRD-07.R14. This phase's changes touch `src/runner/`, `src/daemon/` and `.claude/skills/`, which both declare in `Depends-on`.
- **Regression set (derived):** 20 criteria — PRD-05.R2, R3, R4, R5, R7, R10, R11, R18; PRD-07.R1, R2, R3, R4, R6, R9, R10, R12; PRD-08.R1, R2, R4, R5. Four were narrowed out (see *Regression*).
- **Branch:** `timone/202-4-the-update-after-a-merge` @ `bedc5ea`. It is level with `origin/main` (`1630843`, phase 49 merged as #215), so nothing was merged in first.

## Environment

- No server: Timone is a command-line program and a daemon. `npm run build` (exit 0), then every probe drives the built `dist/cli.js` through the probes' own rig (`_rig.mjs`, a fake `gh` and a fake model), as earlier passes did.
- Order: the regression set, real runs only, in parallel; the four failing probes again alone; the shared fake GitHub fixed (below); PRD-07.R1 and R9 with their break runs; PRD-07.R2 and R6 alone; the regression set again in parallel; PRD-07.R6 fixed (below); the regression set a third time in parallel; PRD-07.R6 with its break run; the build-health smoke last. Probes leave no shared state, so the order mattered only for load: the parallel run is the slow, crowded case, and it is where R6's race showed.
- **The real replay (`npm run --silent replay`) was tried and could not run:** every case failed with "Not logged in · Please run /login". This container has no model login. `npm run replay -- --dry` ran: 20 of 20 cases passed, the new `#202` case ("Start the update, and ask nobody for anything") included. The dry run checks the wiring only, never the model's choice.
- **Build-health smoke**, run once at the end and not as evidence: `npm run build && npx tsc --noEmit && npx vitest run` — `tsc` exit 0; **76 test files, 1908 tests passed**, 4.13 s. **Smoke failures:** none, so nothing to mark old or new. Compared with `doc/plans/phases/reports/phase-49-verification.md` on `main` (line 25), whose smoke also passed whole.
- No contradiction between the smoke and any probe.

## Independence declaration

Read: `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md` and its PRD narrative; the `Depends-on`, `Priority`, `Status`, `Verify-via` and `Last live gate` fields of every other register (by script); `phase-50.md`'s status line, companion line, *Requirements* header and *Screens changed* line; `reports/phase-50-complete.md` whole; `reports/phase-50-departures.md` (its headings and first two entries, to append to it); in `phase-49-verification.md` on `main`, the smoke line (line 25); `CONTEXT.md` line 32; the lines of the branch's `process.md` and `.claude/skills/timone-deliver/SKILL.md` that name the update; the top of `STATUS.md`; `timone.yaml`; `package.json`'s scripts; the probe directory. File-name lists only: `git diff --name-only 1630843 HEAD`.

Not read: handoffs, diffs, source, the committed test suite, ADRs.

**Read by mistake, declared:**
- In `phase-50.md`, a `grep` for the header lines also printed lines 24, 35, 156 and 170 (the opening of the *Goal Description*, the description of the `update-checks` command, one function signature, and one line of a slice's test seam). No verdict below rests on them: the claimed criteria are `live`, and the regression probes were written by earlier passes.
- In `phase-49-verification.md` on `main`, the same kind of `grep` printed its section headings and lines 14, 26 and 35. They say the same three checks (PRD-05.R2 clause 2b, PRD-05.R7's real-runner clause, PRD-05.R18) were BLOCKED there. No verdict below rests on them.

**Not opened, though the runner's instructions named them:** ADR-0066 and the phase file's section *Questions that came up while building, and the choice made*. This check may not read ADRs or the plan's body. The four choices are judged below from the completion report's one-line summary of each, the register, and what the built program did.

All criterion evidence comes from verifier-authored probes run from `doc/plans/phases/probes/`.

## Verdict summary

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

**The gate is not met, for one reason only:** PRD-05.R18 is BLOCKED — the replay on the real model needs a model login this container does not have. Every other MUST criterion is PASS or LIVE-GATE. No regression. No fix loop used. A BLOCKED check observed nothing, so it is not a regression; it is carried to the pull request (see *Carried forward*).

## Evidence

### PRD-07.R7 — LIVE-GATE

`live`, `Last live gate: never`. This phase owes the first gate: the watched run on scratch-app the register's hint describes. No probe and no script were written for it.

**What was seen without the live gate — not evidence, and not a verdict.** The completion report says to try the new command. I did, at a Timone root, as the update runs it:

- On the real repository, branch as it is: `node projects/timone/dist/cli.js update-checks timone` printed the test command (`vitest run --passWithNoTests`), this branch's plan `phase-50.md` with PRD-07.R7 and R14 each "no check script", and "No plan arrived on main since HEAD". With `--json`, the same three sets as fields.
- In a scratch copy under `/tmp`: a branch cut from `55cddb4` (before phase 49 merged), with a made-up plan naming PRD-07.R1, R13 and R1 again. Before merging: its own plan listed `prd-07.r1.mjs` and `prd-07.r13.mjs` (R1 once); arrived, "with pull request #215, `phase-49.md`": `prd-07.r2.mjs`, `r4`, `r6`, `r12`, and "PRD-07.R5: no check script". After merging, `--before <the branch's old tip>` printed the same; without `--before` it no longer listed phase 49. (In that copy the clone's default branch was the source's checked-out branch, so phase 50 also showed as arrived; that came from my setup.)

That is the R7 clause 2 test-set list working on real files. Whether the update session runs those sets, fixes, and writes the section at the top is for the live gate.

### PRD-07.R14 — LIVE-GATE

`live`, `Last live gate: never`. This phase owes the first gate, in the same watched run as R7.

The trigger is code. The regression probes PRD-07.R1 and R9 drive the built daemon with an open pull request, so they saw it ask GitHub, on every cycle, `repos/<slug>/compare/main...<branch> --jq '{behind: .behind_by, defaultHead: .base_commit.sha}'` (from their `gh.log`). Whether an update starts on a pull request that opens behind, and does not start on one that opens level, is for the live gate.

### Regression — 19 PASS, 1 BLOCKED

`node doc/plans/phases/probes/run.mjs --regression`, third run, after the two instrument fixes below: `22 passing, 0 failing, 1 blocked, 1 with no probe` over the 24 the runner derives (it does not narrow). For the 20 in scope:

- PASS: PRD-05.R2 (clause 2b BLOCKED: "GitHub could not be read from here (gh)" — the token in this container cannot read `fvermaut/scratch-app`; `gh api repos/fvermaut/scratch-app/pulls/1/commits` answered 404), R3, R4, R5, R7 (the real-runner clause BLOCKED: its instrument is a recorded replay older than this build), R10, R11; PRD-07.R1, R2, R3, R4, R6, R9, R10, R12; PRD-08.R1, R2, R4, R5.
- BLOCKED: PRD-05.R18 — all three clauses: "the recorded replay judged here is older than this build … A new replay on this build is owed". The replay could not run here (see *Environment*).

**The first run had four failures. None was the app's fault.**

1. **PRD-07.R1 clause 3 (review comment) and PRD-07.R9 clause 2 (review)** failed, and failed again alone: the run did not wake on a named person's review comment. The daemon's log said why: `the runner could not look at #12: comparing timone/12-… with main on probe-owner/fixture: gh returned an unexpected shape (behind: … received undefined; defaultHead: … received undefined)`. The new build asks the compare call for `behind_by` and `base_commit.sha`. The probes' fake GitHub (`_fake-gh.cjs`) answered only `ahead_by` and `status`, whatever was asked. Real GitHub's compare answer has both fields. **The instrument was wrong.** Fixed: the fake now answers with `ahead_by`, `behind_by`, `base_commit.sha` and `status`, worked out from the bare remote, and runs any other `--jq` through `jq`. Then R1 and R9 passed alone, and passed with their break runs: every leg went red on the break and green on the build (output below).
2. **PRD-07.R2 clause 6 (runner session after a step)** failed once, on its setup: "the first ticket's runner session after its step was not open when the second ticket was answered". That is the probe's precondition not met, not a verdict. It passed alone and in both later parallel runs.
3. **PRD-07.R6 clause 3** passed alone, then failed in the second parallel run: "across the stranger's comment: something new was written on the ticket", and the new thing was the planner's own hold comment. Decisions, notices, builds and the held state had not changed. The probe took its "before the stranger" snapshot as soon as the hold was recorded, before the hold comment was posted; under load the comment landed after the snapshot. **A race in the instrument.** Fixed: the snapshot now waits until the hold is recorded and its comment is on the ticket, which is what "a held ticket" means. Then R6 passed in the third parallel run, and with its break run, alone.

R1 and R9 with their break runs (`node doc/plans/phases/probes/prd-07.r1.mjs`, `…/prd-07.r9.mjs`, no `PROBE_REAL_ONLY`):

```
--- PRD-07.R1: PASS (5 clause labels, 5 passing)
    break leg: RED (as required) — the first ticket's run did not wake after the event …   [clause 3, review]
--- PRD-07.R9: PASS (4 clause labels, 4 passing)
    break leg: RED (as required) — the run that owns the pull request did not wake after the review (fixture#12/1 parked)
    green leg: PASS — assertion held   [every clause]
```

R6 with its break run:

```
=== PRD-07.R6 clause 3 — a held ticket: someone not named for the project writes the same, and nothing changes
    break leg: RED (as required) — across the operator's comment: a new planner decision was recorded …
    green leg: PASS — assertion held
--- PRD-07.R6: PASS (4 clause labels, 4 passing)
```

**An observation, not a FAIL.** Since the look at an open pull request now also asks GitHub how far it is behind, **a failure of that one call stops the whole look.** I checked it with a scratch script on the same rig (`/tmp`, not committed), making the fake fail every compare call:

```
event=review compare fails=false: woke=true
event=merge  compare fails=true:  woke=true
event=review compare fails=true:  woke=false
while failing: woke=false
after GitHub answers again: woke=true; names the comment: true
```

While GitHub fails the compare call, a named person's review comment on an open pull request does not wake its run. Merges and closes still do. When GitHub answers again, the comment is picked up and named. So it is a delay, not a loss, as long as the failure is brief. No register clause says how soon a run wakes, so this is not a FAIL of PRD-07.R1 clause 3 or R9 clause 2. It is the same kind of thing as the build's fourth question (below), and the person reviewing should know it.

## The four choices the build made

The runner asked whether each holds. Judged from the completion report's line for each, the register, and what ran; the plan's own text on them was not opened (see *Independence declaration*).

1. **"A project with no test command always reads as not passing."** It holds. R7 clause 2 asks the update to run the project's whole test suite. With none, that cannot be done, and saying "passes" would claim a test that never ran. The cost: every update on such a project will say at the top that the work does not pass. On Timone the command finds `vitest run --passWithNoTests`, so Timone is not affected.
2. **"A branch already level ends as 'not what the run says'."** Not contradicted. The register is silent on an update that finds nothing to merge. R14 clause 3 only says no update starts on a pull request that opens level, and that is the trigger, which is for the live gate. Marking the odd case for a person, not as a success, is the safe side. I could not see more than that one line.
3. **"How a check script is found by name was not checked against the real files."** It holds, now checked. On the real repository the command found `prd-07.r2.mjs`, `r4`, `r6`, `r12`, `r1` and `r13` by their names, and said "no check script" for PRD-07.R5, R7 and R14, which have none because they are `live`. A repeated ID was listed once.
4. **"A forge failure while reading the update record skips the departures write too."** It holds only if the failure is brief. It lets a failure in the new part stop an older one: PRD-05.R5, code lists every departure on the pull request. The same pattern is in the observation above, where a failing compare call holds back a review comment. Both catch up at the next try. If the pull request then sits waiting for review with no further step, a skipped departures write may not be retried. Writing the two blocks apart would remove that.

## HUMAN-CHECK scripts

None. No criterion in scope is on the `human` channel.

## Live gates

- **PRD-07.R7** — last live gate: never. **This phase owes a fresh one**: its changes touch `src/runner/`, `src/daemon/` and `.claude/skills/`.
- **PRD-07.R14** — last live gate: never. **This phase owes a fresh one**, for the same reason, in the same watched run.

Other `live` criteria whose declared dependencies these changes touch, outside this phase's scope, for the person planning the next watched run: PRD-07.R5; PRD-01.R4, R13, R17; PRD-02.R1, R2, R4, R6, R7, R8, R13; PRD-03.R1, R2, R4, R5; PRD-06.R1 to R4 (by `process.md`).

## Regression

The derived set's results (third run):

- PRD-05.R2 — PASS (clause 2b BLOCKED, GitHub token) · R3 — PASS · R4 — PASS · R5 — PASS · R7 — PASS (real-runner clause BLOCKED, no replay on this build) · R10 — PASS · R11 — PASS · R18 — BLOCKED (no model login)
- PRD-07.R1 — PASS · R2 — PASS · R3 — PASS · R4 — PASS · R6 — PASS · R9 — PASS · R10 — PASS · R12 — PASS
- PRD-08.R1 — PASS · R2 — PASS · R4 — PASS · R5 — PASS

Nine of the 20 (PRD-05.R2, R3, R4, R5, R7, R10, R11, R18 and PRD-08.R5) carry no `Depends-on` and are always in scope.

What the narrowing removed, with the prefixes that removed it (the phase changes none of them):

- PRD-01.R2 — `src/manifest.ts`, `src/commands/projects.ts`
- PRD-01.R3 — `src/commands/workspace.ts`, `src/git.ts`
- PRD-06.R5 — `src/adapters/credentials.ts`, `src/daemon/container-runtime.ts`
- PRD-07.R13 — `src/commands/takeover.ts`, `src/daemon/runs.ts`

`run.mjs` does not narrow, so it ran these four too: PRD-01.R2, R3 and PRD-07.R13 passed, and PRD-06.R5 has no probe. They are not counted.

## Probes

**3 probes proven able to fail this pass** (PRD-07.R1, R6 and R9: every break leg red, every real leg green). The other 17 in scope were proven by earlier passes. **0 without a break step.** No probe was written new: both claimed criteria are `live`.

- **Changed this pass, both shared or existing instruments:**
  - `_fake-gh.cjs` — the compare call now answers `behind_by` and `base_commit.sha` as GitHub does, and applies any `--jq`. Why: the build's new call got an answer GitHub never gives (see *Regression*). Every probe that drives the daemon with an open pull request uses it; R1 and R9, whose results were in doubt, did their break runs.
  - `prd-07.r6.mjs` — the "held" snapshot waits for the hold comment. Why: a race under load (see *Regression*). It did its break run.
- **Real run only this pass, each proved able to fail by an earlier pass:** PRD-05.R2, R3, R4, R5, R7, R10, R11, R18; PRD-07.R2, R3, R4, R10, R12; PRD-08.R1, R2, R4, R5.
- **Clause coverage:** for all 20, the register's clause count matches the clause numbers the probe printed (for example PRD-07.R2: 6 and 1–6; PRD-05.R5: 4 and 1–4). No gap.

## Fix-loop accounting

0 of 2 — no FAIL or REGRESSION survived the instrument fixes, so no defect brief was written and no fix commit was made. Both instrument faults were in this stage's own files, fixed here, and committed with this report.

## Figures on the preview's data

No screen changed in this phase (`Screens changed: none`). Timone has no screen it draws.

## Questions for the human

None.

## Register changes

None. PRD-07.R7 and R14 are `live`: this stage never changes a `live` status, and both stay `draft` until their watched run. Every regression criterion entered `verified` and stays so; a BLOCKED one observed nothing, so it changes nothing.

## Carried forward

- **PRD-05.R18 — BLOCKED.** The replay on the real model could not run: no model login here. It is owed on this build from a logged-in terminal: `npm run --silent replay`. The same blocks PRD-05.R7's real-runner clause.
- **PRD-05.R2 clause 2b — BLOCKED.** This container's GitHub token cannot read `fvermaut/scratch-app`.
- **PRD-07.R7 and R14 — live gate owed**, on scratch-app, never ivtrends.

The departures record has the entry: [`phase-50-departures.md`](phase-50-departures.md), "timone#202, verification".
