# Phase 44 — Verification Report

- **Date:** 2026-10-04
- **Phase:** [phase-44.md](../phase-44.md) — stamped `Complete`, completion report [phase-44-complete.md](phase-44-complete.md)
- **Scope:** PRD-07.R8, clause 1 only, as the phase file's requirements header claims (the completion report's requirements line says the same). Clauses 2 and 3 are piece 2 of the breakdown for #197 and are not built.
- **Live gate owed:** yes — PRD-01.R5, R8, R10, R15 and PRD-02.R1, R2, R4, R8 (all `verified`, `live`) declare dependencies this phase's diff touches. See *Live gates*.
- **Regression set (derived):** PRD-05.R2, R3, R4, R5, R7, R10, R11, R18 (8 of 11 MUST + api + verified criteria at this HEAD).
- **Branch:** `timone/199-1-numbered-files-never-take-the-same-num` @ `17fe3b2277e692919f2cd62e5278d1eb8c8bf9c9`. Not stacked: its merge-base with `main` is `2b68cbb`, which already carries phase 43's verification.

## Environment

- The app is a command line and a daemon; there is no server and no production/dev split. `npm run build` (exit 0) in `projects/timone`, from the dependencies installed before the session. Every probe runs the built `dist/cli.js`. Probes that start the daemon use the in-process runtime or the stand-in `docker` of `_steps.mjs`; the PRD-05.R3 box clauses ran the captured box script, which does its own `npm ci` and build of this repository (it reached the network this time).
- Every git remote is a local bare repository in a temporary folder. No reservation was ever made on a real remote (the completion report's gotcha: a reservation there is permanent).
- **Build-health smoke**, run once at the end and not as evidence: `npx vitest run` — 61 test files, 1609 tests passed, 3.3 s. `npx tsc --noEmit` exit 0. **Smoke failures:** none. No failing test, so there was nothing to mark old or new. The report on `main` this would have been compared with is `doc/plans/phases/reports/phase-43-verification.md`, whose smoke also passed whole (its line 16).
- No contradiction between the smoke and any probe.

## Independence declaration

Read:

- `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md` (whole); `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.md`, by a `grep` for R8 and "number" (lines 32, 36, 40); every `*.criteria.md` register through a script that reads only each block's Priority, Status, Verify-via, Depends-on and Last live gate fields, to derive the regression set and the live gates owed; `doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md` by a count of GIVEN lines per regression criterion.
- `doc/plans/phases/phase-44.md` lines 1–30. **This went past the allowed header**: lines 19–30 are the start of the *Goal Description* and of the planning decisions, which name the command, the ref the reservation uses, and that a reservation message carries a random line. The probe below asserts only what the register's clause says (no two numbers alike) and treats the ref name as nothing it checks; I state the over-read so a reader can weigh it. No sub-phase body was read.
- `doc/plans/phases/reports/phase-44-complete.md` (whole).
- `doc/plans/phases/reports/phase-44-departures.md`: its headings, lines 1–8 and its last five lines, for the format of an entry.
- On `main`, through `git show`: `doc/plans/phases/reports/phase-43-verification.md`, a `grep -n -iE '^#|smoke'` over it — its headings and its line 16 (the smoke result).
- `STATUS.md` lines 1–40; `README.md` and `CONTEXT.md` by a `grep` for "number" and "reserv" (two lines of `CONTEXT.md`, about step tickets and chunk zero). `doc/standards.md` does not exist in this project.
- The probe directory `doc/plans/phases/probes/`: `run.mjs`, `_lib.mjs`, `_rig.mjs` (lines 59–160 and 394–429), `_steps.mjs` (lines 1–75 and 76–191), `_old-build.mjs`, and the headers of `prd-01.r3.mjs` and `prd-05.r3.mjs`, plus `prd-05.r3.mjs` lines 160–200 and a `grep` over it, for the rig's use.
- The changed instruction texts `.claude/skills/timone-{plan,adr,onboard,triage,prd}/SKILL.md` and `process.md`, only at the lines that name the `number` command (a `grep`). These are what a session is told when it writes a numbered file, which is what clause 1 is about.
- One list of changed file names for the phase: `git diff --name-only 2b68cbb 17fe3b2`.

Not read: handoffs, diffs, source, the committed test suite, ADRs. No implementation source was read; all criterion evidence below comes from verifier-authored probes, run from `doc/plans/phases/probes/` or written this pass. The `number` command's `--help` and its error messages were read as the running app's output.

## Verdict summary

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-07.R8 (clause 1) | MUST | api | PASS | 0 |
| PRD-05.R2 | MUST | api | PASS (clause 2b BLOCKED, as before) | 0 |
| PRD-05.R3 | MUST | api | PASS | 0 |
| PRD-05.R4 | MUST | api | PASS | 0 |
| PRD-05.R5 | MUST | api | PASS | 0 |
| PRD-05.R7 | MUST | api | PASS (clause 1, the runner, BLOCKED) | 0 |
| PRD-05.R10 | MUST | api | PASS | 0 |
| PRD-05.R11 | MUST | api | PASS | 0 |
| PRD-05.R18 | MUST | api | BLOCKED | 0 |

The gate: every MUST criterion in scope is PASS except PRD-05.R18, which is BLOCKED — it could not run here, which asserts nothing about behaviour and is not a regression. Zero regressions. Zero fix loops.

## Evidence

### PRD-07.R8 — PASS (clause 1)

Probe [`prd-07.r8.mjs`](../probes/prd-07.r8.mjs), authored this pass, run with both legs: `node doc/plans/phases/probes/prd-07.r8.mjs` → exit 0. Clause 1 is checked in four parts. Each part was seen to fail on its break leg first.

- **(a) Six tickets at the same moment.** A bare remote whose `main` holds phase files 01, 02, 07, ADRs 0001, 0003, triage record 002. Six separate timone roots, each with its own clone, run `node dist/cli.js number fixture <kind>` at the same moment, for `phase`, `adr` and `triage`. Break leg: the same six sessions number the way the build before this phase told them to (list the folder, take the highest, use the next) — `two sessions took the same phase number: 8, 8, 8, 8, 8, 8` → RED. Real leg: `{"phase":[10,11,8,13,9,12],"adr":[5,6,9,8,4,7],"triage":[4,7,8,5,6,3]}` — all different, and none equal to a number a file on `main` already has → PASS.
- **(b) One after the other, first not merged.** One ticket takes a number, writes its file and pushes it on its own branch, unmerged. A second ticket starts later from a fresh clone of `main`, which does not hold that file, and takes a number. Break leg (folder count): `8, 8` → RED. Real leg: phase `[8,9]`, ADR `[4,5]`, triage `[3,4]` → PASS.
- **(c) Inside a run.** The built daemon starts a step session in a fixture root carrying the run's guard hooks; the step runs `number fixture phase` twice from the timone root. Break leg: the same with the guard of the build before this phase (`2b68cbb`): `Could not reserve phase 01: Refused: this run may push only to timone/12-add-a-count-of-open-to-dos, and this push goes to refs/timone/numbers/phase/01 …` → RED. Real leg: `01`, `02`, both exit 0 → PASS. This was the host form of a run. The box form was not run for this criterion; PRD-05.R3's box clauses below show the box's guard still refuses `main` and passes the work branch.
- **(d) The instructions.** The instructions for a phase file (`timone-plan`), an ADR (`timone-adr`, `timone-onboard`) and a triage record (`timone-triage`), with struck-through text removed, must name `number <name> <kind>` and must not tell the session to take the highest number in the folder; `process.md` must name the command. Break leg, the same check on the texts at `2b68cbb`: `timone-plan … still tells the session to count: List projects/<name>/doc/plans/phases/, take the highest existing NN, use the next …` → RED. Real leg → PASS. The lines as shipped, for example `timone-plan` line 140: *"Run `node dist/cli.js number <name> phase`. It reserves the next phase number on the project's remote and prints it … **If the command fails, stop and say so**"*; `timone-adr` line 39 and `timone-prd` line 44 add *"Never count the files in the folder instead."*

Clauses 2 and 3 print BLOCKED in the probe: not built yet.

**What this does not show.** Every remote here is a local bare repository. Whether GitHub accepts a push of a ref under `refs/timone/numbers/` from the App token a box holds is not observable from here; the completion report says the same. If GitHub refuses it, every session that numbers a file stops, as its instructions now say. This is listed under *Live gates*.

### Regression set — PRD-05.R2, R3, R4, R5, R7, R10, R11, R18

Each probe was run on its own, real run only, in parallel: `PROBE_REAL_ONLY=1 node doc/plans/phases/probes/prd-05.<id>.mjs` (293 s for all eight; `run.mjs --regression` was not used because it runs the unnarrowed set).

- **PRD-05.R2** — PASS: clauses 1a, 1b, 2a PASS. Clause 2b BLOCKED: `GitHub could not be read from here (gh)`.
- **PRD-05.R3** — PASS, 19 labels of 19, including the host and box push-guard clauses: in a step session and in a box, a push to `main`, to another branch, or a delete of the work branch is refused; the work branch takes the push; switching the guard off is refused. This is the criterion phase 44's change to the push guard could most easily break.
- **PRD-05.R4** — PASS, 6 of 6.
- **PRD-05.R5** — PASS, 6 of 6.
- **PRD-05.R7** — PASS: clause 1 (code), 2a, 2b PASS. Clause 1 (the runner) BLOCKED: `needs a real model: replay case scratch-app#37 … the newest recorded replay is older than this build (run 10's commit 4686ef4 is not in this branch's history)`.
- **PRD-05.R10** — PASS, 4 of 4.
- **PRD-05.R11** — PASS, 16 of 16.
- **PRD-05.R18** — BLOCKED, 3 of 3 labels: `the recorded replay judged here is older than this build … A new replay on this build is owed (npm run --silent replay, from a logged-in terminal)`.

## HUMAN-CHECK scripts

None. No criterion in scope is on the `human` channel, and the completion report carries no HUMAN-CHECK forward.

## Live gates

No criterion in scope is on the `live` channel. The phase's diff touches what these `verified` `live` criteria declare they depend on, so a fresh gate is owed for each:

- PRD-01.R5, R15 (`.claude/skills/timone-onboard/`) — last live gate: never.
- PRD-01.R8 (`.claude/skills/timone-prd/`) — last live gate: never.
- PRD-01.R10 (`.claude/skills/timone-plan/`) — last live gate: never.
- PRD-02.R1 (`src/daemon/`, `src/adapters/`) — last live gate: [phase-32-live-gate.md](phase-32-live-gate.md), 2026-09-04.
- PRD-02.R2, R4, R8 (`src/daemon/`) — last live gate: never.

The same watched run is the only way to learn whether GitHub accepts the reservation push from a box (see PRD-07.R8 above). Draft `live` criteria whose dependencies the diff also touches, none of them verified: PRD-01.R4, R9; PRD-02.R6, R7, R13; PRD-03.R1, R2, R4, R5; PRD-06.R1–R4; PRD-07.R5, R7, R14.

## Regression

- PRD-05.R2 — PASS (2b BLOCKED)
- PRD-05.R3 — PASS
- PRD-05.R4 — PASS
- PRD-05.R5 — PASS
- PRD-05.R7 — PASS (clause 1, the runner, BLOCKED)
- PRD-05.R10 — PASS
- PRD-05.R11 — PASS
- PRD-05.R18 — BLOCKED

All eight carry no `Depends-on` line, so they are always in scope. What the narrowing removed:

- PRD-01.R2 — `Depends-on: src/manifest.ts, src/commands/projects.ts`; the phase changed neither.
- PRD-01.R3 — `Depends-on: src/commands/workspace.ts, src/git.ts`; the phase changed neither.
- PRD-06.R5 — `Depends-on: src/adapters/credentials.ts, src/daemon/container-runtime.ts`; the phase changed neither.

## Probes

**4 probe parts proven able to fail this pass, 0 not.** PRD-07.R8 has 4 decided labels; all 4 went red on the break leg and green on the real leg. Its two BLOCKED labels (clauses 2 and 3) run nothing.

- `prd-07.r8.mjs` — authored this pass (first check of PRD-07.R8). Break runs: (a) and (b) number the old way, by folder; (c) uses the guard of the build at `2b68cbb`; (d) reads the instruction texts at `2b68cbb`. All red.
- Run without a break run this pass (each was proved able to fail by an earlier pass, and none was in doubt): PRD-05.R2, PRD-05.R3, PRD-05.R4, PRD-05.R5, PRD-05.R7, PRD-05.R10, PRD-05.R11, PRD-05.R18.
- Clause coverage: the register's GIVEN count per regression criterion (R2 2, R3 3, R4 4, R5 4, R7 2, R10 3, R11 3, R18 2) equals the clause numbers each probe printed. No gap. PRD-07.R8 prints all three of its clauses, two of them BLOCKED.
- `run.mjs` was not changed: it already does real runs only.

## Fix-loop accounting

0 of 2 — the initial pass was clean. No probe failed, so no defect brief was written.

## Figures on the preview's data

No screen changed in this phase (`Screens changed: none`).

## Questions for the human

None.

## Register changes

No `Status` flip. PRD-07.R8 stays `draft`: clause 1 passed, but clauses 2 and 3 are not built, and a requirement's status is the weakest of its clauses. A dated partial-evidence marker was written on its block, naming this report and its probe. The register is untouched for PRD-05.R18 (BLOCKED) and for every regression criterion that passed (already `verified`).

## Carried forward

- **PRD-05.R18** BLOCKED, and the runner clause of PRD-05.R7: they need a replay against the real model on this build (`npm run --silent replay`, from a logged-in terminal). PRD-05.R2 clause 2b needs GitHub to be read. Recorded in [phase-44-departures.md](phase-44-departures.md), the entry dated 2026-10-04 for verification.
- **PRD-07.R8 clauses 2 and 3** are not built (piece 2 of the breakdown for #197).
- **Live gates owed**, listed above, including whether GitHub accepts the reservation push from a box.
