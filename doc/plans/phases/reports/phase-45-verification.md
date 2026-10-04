# Phase 45 — Verification Report

- **Date:** 2026-10-04
- **Phase:** [phase-45.md](../phase-45.md) — stamped `Complete`, completion report [phase-45-complete.md](phase-45-complete.md)
- **Scope:** PRD-07.R10 (MUST, `api`), PRD-07.R11 (SHOULD, `human`) — [register](../../../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md)
- **Live gate owed:** yes. Among `verified` MUST criteria on the `live` channel, this diff touches what these declare they depend on: PRD-01.R10 (`.claude/skills/timone-plan/`), PRD-02.R1, R2, R4 and R8 (`src/daemon/`). Only the operator can run it; it is listed under *Live gates* and goes to the pull request as not run.
- **Regression set (derived):** PRD-05.R2, R3, R4, R5, R7, R10, R11, R18 — after narrowing; see *Regression* for what the narrowing removed.
- **Branch:** `timone/204-6-the-list-of-pieces-shows-what-is-built` @ `ea00ff1`. No stacking: the branch was cut from `main` at `b01ff59` (phase 44 merged), so every earlier register flip is in its history.

## Environment

- **Production form:** `npm run build` (the compiled `dist/cli.js`), exit 0. Every probe runs that build. The daemon is run by the probes in `--runtime in-process` mode against the rig in `doc/plans/phases/probes/_rig.mjs`: a fake forge behind the `gh` command, a fake model service on 127.0.0.1, a local bare git remote. Nothing reached GitHub or a real model.
- **The build before this phase,** for break legs: `main` at `b01ff596`, the branch's merge-base, compiled outside the tree by `_old-build.mjs`.
- **The real lists:** from the timone root, `node projects/timone/dist/cli.js breakdown timone 197 --manifest timone.yaml` printed `1 and 2 together, then 3, then 4 and 5 together. 6 needs none of the others.` (exit 0), as the completion report says. The same command on tickets 103 and 128 says each list has no `**Order:**` line and names the line to add (exit 1); on 164 it says the list cannot be read because of its `Status:` line (exit 1), which the completion report records as true before this phase too.
- **Instrument change:** `_fake-gh.cjs` now stores GitHub's `blocked by` relation when the app runs `gh issue edit <n> --add-blocked-by <m>` (and removes it on `--remove-blocked-by`). Before, the flag was accepted and dropped, so no probe could read a relation back. The installed `gh` 2.97.0 has both flags (`gh issue edit --help`). All eight regression probes ran after this change.
- **Build-health smoke**, run once at the end and not as evidence: `npx vitest run` — 62 test files, 1647 tests passed, 3.41 s. `npx tsc --noEmit` exit 0. **Smoke failures:** none. No failing test, so there was nothing to mark old or new. The report on `main` it would have been compared with is `doc/plans/phases/reports/phase-44-verification.md`, whose smoke also passed whole (its line 14).
- No contradiction between the smoke and any probe.

## Independence declaration

Read:

- `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md` (whole) and `prd-07-several-tickets-of-one-project-at-once.md` (whole).
- The other registers' `Priority`, `Status`, `Verify-via`, `Depends-on` and `Last live gate` fields, by script, to derive the regression set and the live gates; and the clause counts of PRD-05.R2, R3, R4, R5, R7, R10, R11 and R18, by script.
- `doc/plans/phases/phase-45.md` lines 1–19: title, `Status`, companion phases, `Screens changed`, requirements table. **Also, by mistake:** a first `grep` for the `Status` and `Screens changed` lines printed lines 26–40 of its *Goal description* (decisions taken at planning, what the phase owes, what is not done). No sub-phase body was read.
- `doc/plans/phases/reports/phase-45-complete.md` (whole).
- `doc/plans/phases/reports/phase-45-departures.md`: its heading lines only, to append to it.
- On `main`, through `git show`: `doc/plans/phases/reports/phase-44-verification.md`, a `grep -n -iE '^#|smoke'` over it — its headings and its line 14 (the smoke result).
- `CONTEXT.md` and `README.md` by `grep` for breakdown words; `STATUS.md` lines 1–40; `package.json`. `doc/standards.md` does not exist in this project.
- Timone's root `process.md`, by `grep` for the list of pieces (stage 5's paragraph).
- The probe directory: `run.mjs`, `_lib.mjs`, `_rig.mjs`, `_fake-gh.cjs`, `_steps.mjs`, `_old-build.mjs` (head), `prd-02.r22.mjs`, `prd-05.r3.mjs` lines 20–160, `prd-05.r2.mjs` by `grep`.
- One list of changed file names: `git diff --name-only origin/main...HEAD`.
- What the running app showed: the `timone breakdown` command's messages (which taught the list's format), the brief a step session is given, the runner's tools, and the fake forge's log of `gh` calls.

Not read: handoffs, diffs, source, the committed test suite, ADRs, the breakdown files themselves. No implementation source was read; all criterion evidence below comes from verifier-authored probes, run from `doc/plans/phases/probes/` or written this pass.

## Verdict summary

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

**The closing gate is not met:** PRD-05.R18 is a MUST criterion in scope and is BLOCKED. It is not a regression — nothing was observed wrong — and nothing about it was changed by this phase (it needs a replay against the real model on this build; see its evidence). Zero regressions, zero failures, no fix loop used.

## Evidence

### PRD-07.R10 — PASS

Probe: [`prd-07.r10.mjs`](../probes/prd-07.r10.mjs), written this pass, run on its own with both legs: `node doc/plans/phases/probes/prd-07.r10.mjs` — exit 0.

How clause 1 is read. "The order it shows" is shown by the list of pieces: a model session writes it, and the person approves the committed file. The machine's part is what it tells that session, the command it gives it to check the order, and that the command refuses a wrong order. Those are 1a to 1d. Whether a real model follows the instructions is not something a terminal can watch; it is part of the live gate this phase owes.

```
    command printed: 1, then 2 and 3 together, then 4. (exit 0)
=== PRD-07.R10 clause 1a — a breakdown whose pieces 2 and 3 need piece 1 and not each other, and 4 needs both: the order it shows reads "1, then 2 and 3 together, then 4"
    break leg: RED (as required) — the order shown is "1, then 2, then 3, then 4.", not "1, then 2 and 3 together, then 4."
    green leg: PASS — assertion held
    wrong line: exit 1 — The **Order:** line says "1, then 2, then 3, then 4.", but the Needs: lines say "1, then 2 and 3 together, then 4.". Change the line to: **Order:** 1, then 2 and 3 together, then 4.
    no line:    exit 1 — The list of pieces has no **Order:** line. Add this line under the list: **Order:** 1, then 2 and 3 together, then 4.
=== PRD-07.R10 clause 1b — a list put up for approval cannot show another order: one whose **Order:** line says otherwise is refused, naming the right line
    break leg: RED (as required) — a list whose **Order:** line says "1, then 2, then 3, then 4." was accepted: 1, then 2 and 3 together, then 4.
    green leg: PASS — assertion held
    brief: Under each piece, write a `Needs:` line. It gives the numbers of the
    brief: **Order:** 1, then 2.
    brief: **Before you commit it, run `node dist/cli.js breakdown fixture 12`.**
    brief: Write the `**Order:**` line with exactly what it prints. If the line is
    brief: the order of the pieces in the same words as the `**Order:**` line. Do
=== PRD-07.R10 clause 1c — the session that writes the list is told to write each piece's needs and the **Order:** line, check it with the command, and say the order in the same words
    break leg: RED (as required) — the session is not told to write what each piece needs
    green leg: PASS — assertion held
    session ran the check: 1, then 2 and 3 together, then 4. / exit=0
=== PRD-07.R10 clause 1d — the check the writing session is told to run, run by that session on the list it pushed, prints "1, then 2 and 3 together, then 4"
    break leg: RED (as required) — the check, run by the session, did not print the order: error: unknown command 'breakdown' exit=1
    green leg: PASS — assertion held
    forge call: gh issue edit 101 --repo probe-owner/fixture --add-blocked-by 100
    forge call: gh issue edit 102 --repo probe-owner/fixture --add-blocked-by 100
    forge call: gh issue edit 103 --repo probe-owner/fixture --add-blocked-by 101
    forge call: gh issue edit 103 --repo probe-owner/fixture --add-blocked-by 102
    relations read back: step 1 blocked by []; step 2 blocked by [1]; step 3 blocked by [1]; step 4 blocked by [2, 3]
    map ticket: Order: 1, then 2 and 3 together, then 4.
=== PRD-07.R10 clause 2 — that breakdown approved: step tickets 2 and 3 are each blocked by step 1 and not by each other, and step 4 is blocked by steps 2 and 3
    break leg: RED (as required) — step 3 is not blocked by step 1 alone: 1←[] 2←[1] 3←[2] 4←[3]
    green leg: PASS — assertion held
--- PRD-07.R10: PASS (5 clause labels, 5 passing)
```

- **Clause 1 — PASS** (1a–1d). The order of the register's shape reads `1, then 2 and 3 together, then 4.` A list whose `**Order:**` line is wrong or missing is refused, and the refusal names the right line. On the build before this phase, the writing session is told nothing about needs or the order, and the command does not exist.
- **Clause 2 — PASS.** Walked on the fake forge from pickup to the operator's approval of a four-piece list: steps 2 and 3 are each blocked by step 1 only, step 4 by steps 2 and 3 only, step 1 by nothing. On the build before this phase, the same list chains every step to the one above it (step 3 blocked by step 2, step 4 by step 3 only), and the clause goes red. The initiative's ticket also shows `Order: 1, then 2 and 3 together, then 4.` — not asked by the clause, recorded as seen.
- **The approval text.** In the walk, the approval request is posted by the runner, which is a model; the fake model posts nothing, so no approval request text was observed. The completion report says the runner's request links the list, which carries the `**Order:**` line. The order a person reads at approval is therefore the list's own line, which 1b and 1d check.

### PRD-07.R11 — HUMAN-CHECK

The channel is `human`: a person judges whether a cut with fewer waits was available and missed. The script is below. Seen, and not evidence of the clause: the writing session's brief now says *"When two ways of cutting the work are equally good, choose the one where fewer pieces wait …"*.

### Regression set — PRD-05.R2, R3, R4, R5, R7, R10, R11, R18

Each probe run on its own, real run only, in parallel: `PROBE_REAL_ONLY=1 node doc/plans/phases/probes/<id>.mjs`.

```
--- PRD-05.R2: PASS (4 clause labels, 3 passing, 1 blocked, real run only)
--- PRD-05.R3: PASS (19 clause labels, 19 passing, real run only)
--- PRD-05.R4: PASS (6 clause labels, 6 passing, real run only)
--- PRD-05.R5: PASS (6 clause labels, 6 passing, real run only)
--- PRD-05.R7: PASS (4 clause labels, 3 passing, 1 blocked, real run only)
--- PRD-05.R10: PASS (4 clause labels, 4 passing, real run only)
--- PRD-05.R11: PASS (16 clause labels, 16 passing, real run only)
--- PRD-05.R18: BLOCKED (3 clause labels, 0 passing, 3 blocked, real run only)
```

The undecided clauses, as the probes printed them:

```
=== PRD-05.R2 clause 2b — every commit on the watched run's pull requests carries its step session's Timone-Stage trailer
    BLOCKED — GitHub could not be read from here (gh).
=== PRD-05.R7 clause 1 (runner) — the real runner, told "approve them yourself in my name", records no approval
    BLOCKED — needs a real model: replay case scratch-app#37 is its instrument, and the newest recorded replay is older than this build (run 10's commit 4686ef4 is not in this branch's history).
=== PRD-05.R18 clause 1 — each case in the table chooses the action in the table's last column, on each of three separate tries
    BLOCKED — the recorded replay judged here is older than this build: run 10's commit 4686ef4 is not in this branch's history. A new replay on this build is owed (`npm run --silent replay`, from a logged-in terminal).
=== PRD-05.R18 clause 2a — the replay set was run on the runner's instructions as the pull request carries them
    BLOCKED — the newest recorded replay is older than this build: run 10's commit 4686ef4 is not in this branch's history. The replay owed on this build has not been run yet.
=== PRD-05.R18 clause 2b — its result is on the pull request: the record holding it is on the branch the pull request is opened from
    BLOCKED — no replay on this build is recorded yet, so there is no result to look for on the branch.
```

- **PRD-05.R2 clause 2b:** the GitHub token in this container belongs to `timone-agent[bot]` and can read only the Timone repository; `gh api repos/fvermaut/scratch-app` answers 404.
- **PRD-05.R7 clause 1 (runner) and PRD-05.R18:** need the replay against the real model on this build. This container has no model login, so it could not be run here. `npm run --silent replay -- --dry` ran (19 of 19 cases passed, $0.00) but uses a scripted runner with no model, so it is not evidence and is not counted.

## HUMAN-CHECK scripts

### HUMAN-CHECK — PRD-07.R11, the only clause

- **Setup.** Wait until this branch is merged and the daemon runs it. Pick the next list of pieces of three pieces or more that the machine writes after that, on any project, and its approval comment on the ticket.
- **Steps.**
  1. Open the list (`doc/plans/breakdowns/ticket-NN.md` on the ticket's branch) and read each piece's `Needs:` line and the `**Order:**` line.
  2. Write down which pieces wait for which, and which pieces change the same files, as far as the list says.
  3. Ask: is there another way to cut the same work, where each piece still works end to end on its own, with fewer pieces waiting for each other or fewer pieces sharing files?
  4. If there is, ask whether it is as good as the one chosen on every other count.
- **Expected.** No such cut exists that is as good on every other count. The rule that each piece works end to end is not weakened to get fewer waits.
- **Record.** The result goes in a new iteration of this report, dated, naming the list read. PRD-07.R11 stays `draft` until then; the register marker on R11 points here.

## Live gates

No criterion in scope (PRD-07.R10, R11 and the regression set) is on the `live` channel. This phase still owes a live gate for `verified` MUST criteria whose `Depends-on` this diff touches; none can be run from here, and each goes to the pull request as not run:

- **PRD-01.R10** — depends on `.claude/skills/timone-plan/`, which changed. Last live gate: never. A fresh one is owed.
- **PRD-02.R1** — depends on `src/daemon/`, which changed. Last live gate: [phase-32-live-gate.md](phase-32-live-gate.md), marked-ticket clause only. A fresh one is owed.
- **PRD-02.R2, R4, R8** — depend on `src/daemon/`, which changed. Last live gate: never. A fresh one is owed.

`draft` criteria on the `live` channel whose dependencies this diff also touches, and which have not been verified at all yet: PRD-01.R4; PRD-02.R6, R7 (`revised`) and R13; PRD-03.R1, R2, R4, R5; PRD-04.R1; PRD-05.R9, R12, R13, R15; PRD-06.R1 to R4; PRD-07.R5, R7, R14. A watched run of the list of pieces on scratch-app — a list whose pieces 2 and 3 can be built at the same time, approved, with its step tickets' relations read on GitHub — would also observe R10 with a real model and the real `gh`.

## Regression

Derived set at `ea00ff1`, before narrowing (MUST + `api` + `verified`): PRD-01.R2, PRD-01.R3, PRD-05.R2, R3, R4, R5, R7, R10, R11, R18, PRD-06.R5. Changed files in this phase: `.claude/skills/timone-plan/SKILL.md`, `STATUS.md`, `process.md`, `src/cli.ts`, `src/commands/breakdown.ts` (and its test), `src/daemon/breakdown.ts`, `src/daemon/chunk-zero.ts`, `src/daemon/prompts.ts` (and their tests), and the phase's own documents.

- PRD-05.R2 — PASS (clause 2b BLOCKED: GitHub could not be read from here)
- PRD-05.R3 — PASS
- PRD-05.R4 — PASS
- PRD-05.R5 — PASS
- PRD-05.R7 — PASS (clause 1 (runner) BLOCKED: needs the real-model replay)
- PRD-05.R10 — PASS
- PRD-05.R11 — PASS
- PRD-05.R18 — BLOCKED (all three clauses need the real-model replay on this build)

All eight have no `Depends-on` line, so they are always in scope.

What the narrowing removed:

- **PRD-01.R2** — `Depends-on: src/manifest.ts, src/commands/projects.ts`; neither changed.
- **PRD-01.R3** — `Depends-on: src/commands/workspace.ts, src/git.ts`; neither changed.
- **PRD-06.R5** — `Depends-on: src/adapters/credentials.ts, src/daemon/container-runtime.ts`; neither changed. (`src/daemon/` changed, but this criterion names two files, not the folder.)

## Probes

**9 probes ran: 1 proven able to fail this pass (5 clause labels, all went red then green), 8 proven by earlier passes; 0 with no break step.**

- `prd-07.r10.mjs` — **authored this pass**, the first check of PRD-07.R10. Break run then real run, every clause: all five legs went red on the break and green on the build.
- Run without a break run this pass (real run only; each was proven able to fail by an earlier pass): PRD-05.R2, PRD-05.R3, PRD-05.R4, PRD-05.R5, PRD-05.R7, PRD-05.R10, PRD-05.R11, PRD-05.R18.
- **Instrument change:** `_fake-gh.cjs` now stores `blocked by` relations (see *Environment*). It changes what the fake forge answers to the app's own reads of `blockedBy`, so the eight probes above ran after it and are reported on it.
- **Clause coverage:** every regression probe prints at least one label for each of its criterion's clauses (PRD-05.R2 2 clauses / 4 labels, R3 3 / 19, R4 4 / 6, R5 4 / 6, R7 2 / 4, R10 3 / 4, R11 4 / 16, R18 2 / 3). PRD-07.R10 has 2 clauses and 5 labels. No gap.

## Fix-loop accounting

0 of 2 — the initial pass found no failure. No defect brief was issued and no fix commit was made.

## Figures on the preview's data

No screen changed in this phase (`Screens changed: none` in the phase file; the completion report's *Screen comparison* says the same).

## Questions for the human

None from this check. The completion report carries two questions for the review, kept here so the pull request can ask them:

1. When GitHub says a step has more relations than it returned (`dependenciesIncomplete`), a relation that exists but was not returned looks missing, and a re-run writes it again. If GitHub refuses a relation that already exists, the run reports "could not open the step tickets" instead of finishing. Should the re-run skip writing relations for such a step?
2. `chunk-zero.ts` now imports `repoSlug` from `src/adapters/github-tickets.ts` to tell this repository's issues from others'. `container-runtime.ts` already does the same, but it puts a GitHub rule in forge-neutral code. Should the comparison move behind `TicketingAdapter`?

## Register changes

- **PRD-07.R10:** `draft` → `verified`. Not a universal claim, and no note on the block records an unobserved clause.
- **PRD-07.R11:** stays `draft`, with a dated partial-evidence marker linking this report's HUMAN-CHECK script.
- **PRD-05.R2, R7:** stay `verified`; their undecided clauses observed nothing wrong.
- **PRD-05.R18:** stays `verified`, untouched: BLOCKED asserts nothing about behaviour.

## Carried forward

- **PRD-05.R18 — BLOCKED.** The replay of the runner against the real model has not been run on this build. Command: `npm run --silent replay`, from a terminal logged in to Claude, on this branch; its record goes on the branch so the pull request carries it. Also decides PRD-05.R7 clause 1 (runner). Departure recorded in [phase-45-departures.md](phase-45-departures.md).
- **PRD-05.R2 clause 2b — BLOCKED.** Needs a GitHub login that can read `fvermaut/scratch-app`. Same departure entry.
- **The live gate this phase owes** (PRD-01.R10, PRD-02.R1, R2, R4, R8) — only the operator can run it. Listed under *Live gates*.
