# Phase 66 — Verification Report

- **Date:** 2026-10-22
- **Phase:** [phase-66.md](../phase-66.md) — stamped `Complete`, completion report [phase-66-complete.md](phase-66-complete.md)
- **Scope:** PRD-02.R23, clause 1, on the words "created for that run and destroyed when it ends" (the phase's claim). The runner's instructions split this into four points; each is checked below.
- **Live gate owed:** no criterion in scope is on the `live` channel. A check on a real machine with docker is owed before merge, from the plan; it is not run here (see *Not run here*).
- **Regression set (derived):** 21 criteria after narrowing — PRD-05.R2, R3, R4, R5, R7, R10, R11, R18; PRD-06.R5; PRD-07.R4, R6, R9; PRD-08.R5; PRD-09.R2, R4, R5; PRD-10.R2, R3, R4, R5, R6.
- **Branch:** `timone/73-a-box-could-not-start-because-a-name-fro-chunk-2` @ `e01cbe8`. Not stacked: its merge base with `main` is `main` itself (`c5f0fc8`).

## Environment

- **Built:** `npm run build` (`tsc`), exit 0, at `e01cbe8`. Timone has no server to stand up; every check runs the built `dist/cli.js` as a daemon in a throwaway folder.
- **How the daemon's containers were observed.** There is no docker in this container. The new check script runs the built daemon with `--runtime container` and a stand-in `docker` program first on `PATH`. The stand-in starts nothing. It keeps a list of containers in a file, as docker does: `docker run --name N` adds N, and gives docker's own "Conflict. The container name "/N" is already in use" message when N is on the list; `docker rm -f` takes a name or an id off the list, after a delay the check sets; `docker ps` prints the list in the format asked for. It writes down every call with its time and the process that made it. A box either answers as a finished session would, or keeps running until it is removed.
- **Build-health smoke**, run once at the end, not as evidence: `npx vitest run` at `e01cbe8`: 79 test files, 2867 tests, **2797 passed, 70 failed**.
- **Smoke failures**, compared with `doc/plans/phases/reports/phase-64-verification.md` on `main` (`c5f0fc8`), lines 17–24. That list is 70 tests in four files, each failing on this container's refusal of a push to `main`. Here the 70 failures are in the same four files with the same counts — `src/commands/guardrails.test.ts` 45, `src/numbers.test.ts` 16, `src/workspace.test.ts` 6, `src/commands/number.test.ts` 3 — and all 70 failure messages hold the push refusal (`Refused: this run may push only to timone/73-a-box-could-not-start-because-a-name-fro-chunk-2`, counted from the JSON report). By that list, all 70 are **old**. None is new. This pass's list, for the next pass: the same 70 tests in these four files, each failing on the push refusal.
- **Smoke against check scripts:** no alarm. No failing test is about box names, box removal, signals or the start-up removal. The four changed test files pass whole: `npx vitest run src/daemon/leftover-boxes.test.ts src/daemon/container-runtime.test.ts src/commands/daemon.test.ts src/daemon/step-session.test.ts` — 177 of 177.

## Independence declaration

Read: `doc/specs/prd/prd-02-inversion-of-control.criteria.md` (R23's block, and the line numbers of its `Last live gate:` lines); every register's Priority, Status, Verify-via and Depends-on fields, printed by a script, and PRD-06.R5's block in `prd-06-a-run-spends-its-time-on-the-work.criteria.md`; `doc/plans/phases/phase-66.md` lines 1–30 — the Status line, the companion note, the Screens changed line, the requirements header, and, past the header, the first part of the Goal Description (the ticket's five causes and the four things the phase builds). That last part is more than the allowed list gives; I stopped there and read no sub-phase; `doc/plans/phases/reports/phase-66-complete.md`, whole; `doc/plans/phases/reports/phase-66-departures.md`, its first 10 lines, for its format; `STATUS.md`; `CONTEXT.md` and `README.md`, searched for the word "preview" and for "container" or "box"; the built CLI's `--help`; the probe directory's shared helpers (`_lib.mjs`, `_rig.mjs`, `_steps.mjs`, `_old-build.mjs`, `run.mjs`, and `prd-10.r1.mjs` for its stand-in docker); on `main`, by `git show`: `reports/phase-64-verification.md`, first a list of its heading lines and lines holding "smoke" (this also showed its section names), then lines 17–24, its smoke line and list. The list of this phase's changed file names, by `git diff --name-only main...HEAD`. `doc/standards.md` does not exist in this project.

Not read: handoffs, diffs, source, the committed test suite, ADRs. No implementation source was read. All criterion evidence below comes from verifier-authored check scripts in `doc/plans/phases/probes/`, one of them written this pass. PRD-06.R5 is the one exception, and it is the owner's: on 2026-10-03 fvermaut accepted it on one named test of the suite (its register block says so), and that test was run by name, not read.

## Verdict summary

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-02.R23 (clause 1, claimed) | MUST | api | PASS | 0 |
| PRD-05.R2 | MUST | api | PASS (regression) | 0 |
| PRD-05.R3 | MUST | api | PASS (regression) | 0 |
| PRD-05.R4 | MUST | api | PASS (regression) | 0 |
| PRD-05.R5 | MUST | api | PASS (regression) | 0 |
| PRD-05.R7 | MUST | api | PASS (regression) | 0 |
| PRD-05.R10 | MUST | api | PASS (regression) | 0 |
| PRD-05.R11 | MUST | api | PASS (regression) | 0 |
| PRD-05.R18 | MUST | api | PASS (regression) | 0 |
| PRD-06.R5 | MUST | api | PASS (regression, on the named test) | 0 |
| PRD-07.R4 | MUST | api | PASS (regression) | 0 |
| PRD-07.R6 | MUST | api | PASS (regression) | 0 |
| PRD-07.R9 | MUST | api | PASS (regression) | 0 |
| PRD-08.R5 | MUST | api | PASS (regression) | 0 |
| PRD-09.R2 | MUST | api | PASS (regression) | 0 |
| PRD-09.R4 | MUST | api | PASS (regression) | 0 |
| PRD-09.R5 | MUST | api | PASS (regression) | 0 |
| PRD-10.R2 | MUST | api | PASS (regression) | 0 |
| PRD-10.R3 | MUST | api | PASS (regression) | 0 |
| PRD-10.R4 | MUST | api | PASS (regression) | 0 |
| PRD-10.R5 | MUST | api | PASS (regression) | 0 |
| PRD-10.R6 | MUST | api | PASS (regression) | 0 |

The gate is met: every MUST criterion in scope passes, no regression, no fix loop used.

## Evidence

### PRD-02.R23 — PASS (clause 1, for the claimed words)

Clause 1, verbatim: *"GIVEN a marked ticket on a managed project WHEN the daemon spawns the session for it THEN that session's work happens inside a container created for that run and destroyed when it ends, whose content came from cloning timone and the target project from their git remotes, with no path from fvermaut's filesystem mounted into it."*

Check script: `doc/plans/phases/probes/prd-02.r23.mjs`, written this pass. Run with both legs: `PROBE_TMP=/tmp/probe-tmp node doc/plans/phases/probes/prd-02.r23.mjs` — exit 0, 78 s. The break legs run the same scenes on a build of `main` before this phase (`c5f0fc8`, built by `_old-build.mjs` outside the tree). Output, trimmed:

```
    daemon 1: "timone-fixture-12-1-requirements-40286611" (ledger: run fixture#12/1, step requirements)
    daemon 2: "timone-fixture-12-1-requirements-62f6afe1" (ledger: run fixture#12/1, step requirements)
    the part that is not the run's: "40286611", about 32 bits
=== R23 clause 1 (a) — a box is named after its run — project, ticket, run number, step — plus a random part, so two daemons never ask docker for the same name
    break leg: RED (as required) — the box "timone-fixture-1" does not carry its run's ticket (12), step (requirements)
    green leg: PASS — assertion held
    box "timone-fixture-12-1-requirements-bb7d7c7a": removal took 3011 ms; the record at its end held: seen, woke, departure, step-started, decision, runner-ended, seen
    the record afterwards: seen, woke, departure, step-started, decision, runner-ended, seen, step-ended, woke, step-started, decision, runner-ended
=== R23 clause 1 (b) — the end of a box waits for docker to remove it: the session counts as ended only after the removal has finished
    break leg: RED (as required) — the session counted as ended before docker had removed its box: the record held "step-ended" when the 3-second removal finished (record at removal start: seen, woke, departure, step-started, decision, step-ended)
    green leg: PASS — assertion held
    refused names: timone-fixture-12-1-requirements-fe437fa1, …-bb2fa22a, … (12 in all); still on docker's list afterwards; removals made: none
=== R23 clause 1 (c) — a start docker refused because the name was taken removes nothing: the container that holds the name is left alone
    break leg: RED (as required) — after docker refused the name, the daemon removed the container that held it: timone-fixture-1, timone-fixture-2, … timone-fixture-12
    green leg: PASS — assertion held
    SIGINT: box "timone-fixture-12-1-requirements-e3976e94" removed; exit 130; log line: stopped: removed 1 box(es) still running: timone-fixture-12-1-requirements-e3976e94
    SIGTERM: box "timone-fixture-12-1-requirements-1dc8ad0d" removed; exit 143; log line: stopped: removed 1 box(es) still running: timone-fixture-12-1-requirements-1dc8ad0d
=== R23 clause 1 (d) — on SIGINT or SIGTERM the daemon removes the boxes still running and names them in its log
    break leg: RED (as required) — SIGINT: the daemon exited without removing its running box "timone-fixture-1" (removals: none)
    green leg: PASS — assertion held
    A's box "timone-fixture-12-1-requirements-9dda1cb1", ledger label: timone.ledger
    B removed: timone-fixture-12-1-requirements-9dda1cb1, timone-fixture-4
    B's log: removed 2 box(es) left by an earlier daemon: timone-fixture-12-1-requirements-9dda1cb1, timone-fixture-4
    kept: timone-fixture-12-1-requirements-0badc0de, fixture-pr-12-web-1, timone-preview-fixture-12, timone-fixture-pr-12, fixture-db-1, postgres
    C: exit 1; said: … timone daemon (pid 27078) is already working this ledger — … so this one stops rather than becoming a second writer.
=== R23 clause 1 (e) — a starting daemon removes the boxes an earlier daemon of the same ledger left, and old-style box names, says so in its log, and leaves previews, services and other ledgers' boxes alone; a daemon refused by the lock removes nothing
    break leg: RED (as required) — daemon B did not remove A's leftover box "timone-fixture-1" (B's removals: none)
    green leg: PASS — assertion held
    1 docker run call(s); none carries -v, --volume or a bind --mount of a host path
=== R23 clause 1 (f) — no path from the host's filesystem is mounted into the box
    break leg: RED (as required) — a host path is mounted: /Users/fvermaut:/workspace/home
    green leg: PASS — assertion held
=== R23 clause 2 … clause 6
    BLOCKED — not claimed by phase 66; needs a real daemon-driven run, real containers or the real forge
--- PRD-02.R23: PASS (11 clause labels, 6 passing, 5 blocked)
```

The runner's four points, each against what was seen:

1. **Box names come from the run plus a random part, not a counter.** (a) Two daemons in fresh roots each started the first box of their life for the same run: `timone-fixture-12-1-requirements-<8 hex>`, with project, ticket, run number and step as the ledger records them, and different random parts. The build before this phase asked for `timone-fixture-1` both times. **PASS.**
2. **The end of a box waits for docker's removal; a start refused for a name conflict removes nothing.** (b) With a 3-second `docker rm`, the record had no `step-ended` entry when the removal finished; it came after. The old build wrote `step-ended` before the removal had even started. (c) With every `docker run` refused for a taken name, the daemon removed nothing, and every container holding a refused name was still on docker's list at the end. The old build removed each one. **PASS.**
3. **SIGINT and SIGTERM remove running boxes and log their names.** (d) For each signal, the daemon removed its running box, logged `stopped: removed 1 box(es) still running: <name>`, and exited (130 and 143). The old build exited and left the box. **PASS.**
4. **Daemon start removes leftovers of an earlier daemon, logs them, and leaves previews alone.** (e) Daemon A was killed with SIGKILL while its box ran. Daemon B, on the same ledger, removed A's box and the old-style `timone-fixture-4`, and logged both. It kept a box labelled with another ledger, three preview-shaped containers and two service containers. A third daemon, refused by the lock, removed nothing. The old build removed nothing at start. **PASS.**

**What (e) cannot show.** How the build names a real preview was not looked up: that would mean reading source. The check planted three likely shapes (`fixture-pr-12-web-1` with compose labels, `timone-preview-fixture-12`, `timone-fixture-pr-12`). A real preview with another shape is not covered here; the real-machine check below covers it. The stand-in prints an empty string for `{{.Label "timone.ledger"}}` on a container without that label; the completion report says the build relies on docker doing the same, and only real docker can confirm it.

**Seen along the way, not a fault against the register.** In (c), a step whose every start is refused is started again by the runner on each cycle: 12 refused starts in about 30 seconds, each recorded as a failed step. The register says nothing about how often a refused step is retried, so this is recorded, not judged.

### Standing regression set

`PROBE_TMP=/tmp/probe-tmp node doc/plans/phases/probes/run.mjs --regression --jobs=5 --only=<the 21 IDs above>` — exit 0, 4 min 32 s:

```
20 passing, 0 failing, 0 blocked, 1 with no probe.
```

The one with no check script is PRD-06.R5. Its register block says fvermaut accepted it on 2026-10-03 on the test its `Falsified-by:` line names. Run by name: `npx vitest run src/daemon/container-runtime.test.ts -t "a box is never handed a token that dies before its next refresh"` — 1 passed, 125 skipped. **PASS.**

### Not run here

**The check on a real machine with docker**, which the plan's "Live check owed" section sets out, needs a person and a machine with docker. It was not run. It is owed before merge. It does not stop this check, as the runner's instructions say. A script for it, written from the register and the runner's four points, is under *HUMAN-CHECK scripts*.

## HUMAN-CHECK scripts

### HUMAN-CHECK — PRD-02.R23, clause 1 on real docker (owed before merge)

- **Setup.** On a machine with docker, check out this branch in the timone root, `npm run build`, and have one marked ticket on `scratch-app`. Note the state file the daemon uses (`--state`, or the default).
- **Steps.**
  1. Start the daemon in container mode. When the ticket's step has started, run `docker ps --format '{{.Names}}'`. Write down the box's name.
  2. Press Ctrl-C in the daemon's terminal. Read its last lines. Run `docker ps -a --format '{{.Names}}'`.
  3. Start the daemon again. When its box runs, stop the daemon with `kill -9 <pid>`. Run `docker ps -a --format '{{.Names}}\t{{.Label "timone.ledger"}}'`.
  4. Start the daemon again. Read its first lines. Run `docker ps -a --format '{{.Names}}'`. If a preview of any project is running, note its container names before and after.
  5. Run `docker run -d --name probe-nolabel alpine sleep 60`, then `docker ps -a --filter name=probe-nolabel --format '[{{.Label "timone.ledger"}}]'`, then `docker rm -f probe-nolabel`.
- **Expected.**
  1. The name has the form `timone-scratch-app-<ticket>-<run number>-<step>-<8 hex characters>`.
  2. The daemon's log says it removed the box and names it; the name is gone from the list.
  3. The box is still listed, and its `timone.ledger` label is the state file's path.
  4. The daemon's log says it removed that box, by name; the name is gone; every preview container is still there.
  5. The output is `[]`: an empty label for a container that has none.
- **Record.** The result goes in this report's next iteration. If all five hold, add a dated marker on R23's block naming that iteration.

## Live gates

No criterion in scope is on the `live` channel. (R23 is `api`; the real-docker check above is a plan item, not a `live` criterion.)

## Regression

21 criteria are in the derived set (MUST, `api`, `verified`, narrowed by `Depends-on` against this phase's changed files: `src/commands/daemon.ts`, `src/daemon/container-runtime.ts`, `src/daemon/leftover-boxes.ts`, `src/daemon/session.ts`, `src/daemon/step-session.ts`, their tests, and this phase's files under `doc/plans/phases/`). All 21 pass:

- No `Depends-on` line, so always in scope: PRD-05.R2, R3, R4, R5, R7, R10, R11, R18; PRD-08.R5; PRD-09.R2, R4, R5; PRD-10.R2, R3, R4, R5, R6 — PASS.
- `src/daemon/container-runtime.ts`: PRD-06.R5 — PASS (named test).
- `src/daemon/`: PRD-07.R4, PRD-07.R6, PRD-07.R9 — PASS.

What the narrowing removed (11), with the prefixes that did not match:

- PRD-01.R2 — `src/manifest.ts`, `src/commands/projects.ts`
- PRD-01.R3 — `src/commands/workspace.ts`, `src/git.ts`
- PRD-07.R1 — `src/daemon/runs.ts`, `src/runner/`
- PRD-07.R2 — `src/daemon/runs.ts`, `src/runner/`, `src/manifest.ts`
- PRD-07.R3 — `src/daemon/runs.ts`, `src/runner/driver.ts`
- PRD-07.R10 — `.claude/skills/timone-plan/`, `src/adapters/github-tickets.ts`, `src/runner/`
- PRD-07.R12 — `process.md`, `doc/adr/`, `doc/specs/prd/`, `src/daemon/runs.ts`
- PRD-07.R13 — `src/commands/takeover.ts`, `src/daemon/runs.ts`
- PRD-08.R1 — `src/daemon/chunk-zero.ts`, `src/adapters/`, `src/manifest.ts`
- PRD-08.R2 — `src/runner/actions.ts`, `src/adapters/`, `src/manifest.ts`
- PRD-08.R4 — `src/daemon/chunk-zero.ts`, `src/runner/actions.ts`, `src/adapters/`

## Probes

**6 probe labels proven able to fail this pass, 0 not.** One check script was written this pass:

- `prd-02.r23.mjs` — PRD-02.R23, first check of the criterion. Six labels for clause 1, (a) to (f); each went red on the old build (or, for (f), on arguments with a host path added) and green on this build. Clauses 2 to 6 are printed as BLOCKED labels: this phase does not claim them, and they need a real daemon-driven run, real docker or the real forge. So the script prints a label for each of R23's six clauses, and there is no gap.

Ran without a break run this pass (real run only), each proven able to fail by an earlier pass, none `revised`, none in doubt from the smoke: PRD-05.R2, PRD-05.R3, PRD-05.R4, PRD-05.R5, PRD-05.R7, PRD-05.R10, PRD-05.R11, PRD-05.R18, PRD-07.R4, PRD-07.R6, PRD-07.R9, PRD-08.R5, PRD-09.R2, PRD-09.R4, PRD-09.R5, PRD-10.R2, PRD-10.R3, PRD-10.R4, PRD-10.R5, PRD-10.R6. PRD-06.R5 has no check script; it is accepted on a named test, by the owner's decision.

## Fix-loop accounting

0 of 2 — the initial pass was clean.

## Figures on the preview's data

No screen changed in this phase (the phase file's `Screens changed` line: none).

## Questions for the human

None.

## Register changes

- PRD-02.R23: **no status change**; it stays `draft`. Clauses 2 to 6 were not checked here, and the block's own notes record parts not yet watched under a real run. One dated marker is added under its Status, linking this report: clause 1's words "created for that run and destroyed when it ends" passed against a stand-in docker, and the real-docker check is owed.
