# Phase 52 — Verification Report

- **Date:** 2026-10-05
- **Phase:** [phase-52.md](../phase-52.md) — stamped `Complete`, completion report [phase-52-complete.md](phase-52-complete.md)
- **Scope:** un-anchored (stamped 2026-10-05, the planning of #219: "documentation only … this phase claims none of them") — regression set only. No HUMAN-CHECK is carried forward by the completion report.
- **Live gate owed:** no — no `live` criterion declares a dependency this diff touches. Seven `live` criteria declare no `Depends-on` at all; they are listed under *Live gates*.
- **Regression set (derived):** PRD-05.R2, PRD-05.R3, PRD-05.R4, PRD-05.R5, PRD-05.R7, PRD-05.R10, PRD-05.R11, PRD-05.R18, PRD-08.R5 — nine criteria, all with no `Depends-on` line. Fifteen were narrowed out (see *Regression*).
- **Branch:** `timone/219-the-places-setting-is-not-documented` @ `8d48b84`. Not stacked on an unverified phase: the branch is cut from `main` @ `9f0786c`, and nothing was merged in.

## Environment

- This phase changes no program file. Its diff against `main` names `README.md`, `timone.example.yaml`, `doc/plans/phases/phase-52.md` and three phase-52 reports.
- Production form: `npm run build` (exit 0). There is no server to stand up: the program is a command line, and the probes drive `dist/` themselves.
- This run's container has a push guard: git's hooks folder is set to `/home/pwuser/.timone/git-hooks`, whose `pre-push` refuses every push that is not to `timone/219-the-places-setting-is-not-documented`, **including pushes to `main` of throw-away repositories under `/tmp`**. The guard was not switched off: it belongs to the container, not to the project, and getting round it is not this step's to do.
- Order: build; the nine regression probes, real runs only (`PROBE_REAL_ONLY=1`), in parallel; the documentation checks below; the build-health smoke last.
- **Build-health smoke**, run once at the end and not as evidence: `npx tsc --noEmit && npx vitest run`, with a read tracer loaded (`NODE_OPTIONS=--require /tmp/trace/preload.cjs`, described under *The documentation, read against the register*) — `tsc` exit 0; **76 test files, 1908 tests: 1838 passed, 70 failed in 4 files**, 8.87 s. Every one of the 70 fails on the guard: the log holds 70 `Command failed: git push … main` errors (45 `git push -q origin main`, 16 `git push --quiet origin main`, 6 `git push origin main`, 3 `git push --quiet  main`), each with the guard's `Refused: this run may push only to …` line, and no other error.
- **Smoke failures**, compared with `doc/plans/phases/reports/phase-50-verification.md` on `main` (line 15), whose smoke passed whole (1908 passed). So by the rule every failure below is **new**. They are new to this container, not to this change: the tracer saw no test open `README.md` or `timone.example.yaml` (see below), so the content of the two changed files cannot change any test's result. The `main` branch was not checked out, built or run to compare.
- new — `src/commands/guardrails.test.ts > a session a human drove > catches a project's work branch cut at the timone root — finding 11, on real git`
- new — `src/commands/guardrails.test.ts > a session a human drove > does not judge Timone's own work against a project it never had`
- new — `src/commands/guardrails.test.ts > a session a human drove > goes round exactly once, however many turns the session takes`
- new — `src/commands/guardrails.test.ts > a session a human drove > prints the finding and journals it, and posts on no ticket at all`
- new — `src/commands/guardrails.test.ts > a session a human drove > says nothing when the session behaved`
- new — `src/commands/guardrails.test.ts > a session the daemon drove > asks the session first, then flags the run — and posts on no ticket`
- new — `src/commands/guardrails.test.ts > a session the daemon drove > says nothing anywhere when the session behaved`
- new — `src/commands/guardrails.test.ts > a session the daemon drove > stops flagging once the session has fixed what it was told`
- new — `src/commands/guardrails.test.ts > a session with no baseline > says so rather than passing silently`
- new — `src/commands/guardrails.test.ts > commits another session made > are invisible to the STATUS.md placement rule`
- new — `src/commands/guardrails.test.ts > commits another session made > are invisible to the path-containment rule — the 14g accusation itself`
- new — `src/commands/guardrails.test.ts > commits another session made > are invisible to the provenance rule`
- new — `src/commands/guardrails.test.ts > commits another session made > are invisible to the unpushed rule, and do not inflate its count`
- new — `src/commands/guardrails.test.ts > commits another session made > are still judged when they name no session at all — the fix's known limit`
- new — `src/commands/guardrails.test.ts > finding the run that drove a session > finds nobody for a session no run ever claimed`
- new — `src/commands/guardrails.test.ts > finding the run that drove a session > resolves the session id against the ledger`
- new — `src/commands/guardrails.test.ts > guarding the probes in a session run by hand (#169) > goes by the ledger when the session has a run, whatever it declared`
- new — `src/commands/guardrails.test.ts > guarding the probes in a session run by hand (#169) > lets a session that declared the checking step through`
- new — `src/commands/guardrails.test.ts > guarding the probes in a session run by hand (#169) > refuses the probes to a session that declared a building step`
- new — `src/commands/guardrails.test.ts > guarding the probes in a session run by hand (#169) > still asks when the session has no run and declared no step`
- new — `src/commands/guardrails.test.ts > guarding the verifier's probes > asks when no run drove the session, because a human is at the keyboard`
- new — `src/commands/guardrails.test.ts > guarding the verifier's probes > lets the verification run that owns them through`
- new — `src/commands/guardrails.test.ts > guarding the verifier's probes > refuses a build run the probe directory`
- new — `src/commands/guardrails.test.ts > guarding the verifier's probes > says nothing about a tool call that touches no probe`
- new — `src/commands/guardrails.test.ts > switching off the guard on a run's pushes > refuses a run `GIT_CONFIG_COUNT=0 git push``
- new — `src/commands/guardrails.test.ts > switching off the guard on a run's pushes > refuses a run `git -c core.hooksPath=/tmp/h push``
- new — `src/commands/guardrails.test.ts > switching off the guard on a run's pushes > refuses a run `git push --no-verify origin x``
- new — `src/commands/guardrails.test.ts > switching off the guard on a run's pushes > says nothing about `GIT_CONFIG_COUNT=0 git push` in a person's own session`
- new — `src/commands/guardrails.test.ts > switching off the guard on a run's pushes > says nothing about `git -c core.hooksPath=/tmp/h push` in a person's own session`
- new — `src/commands/guardrails.test.ts > switching off the guard on a run's pushes > says nothing about `git commit --no-verify -m x` in a person's own session`
- new — `src/commands/guardrails.test.ts > switching off the guard on a run's pushes > says nothing about `git push --no-verify origin x` in a person's own session`
- new — `src/commands/guardrails.test.ts > switching off the guard on a run's pushes > says nothing about `git push origin timone/39-x` in a person's own session`
- new — `src/commands/guardrails.test.ts > switching off the guard on a run's pushes > says nothing to a run about `git commit --no-verify -m x``
- new — `src/commands/guardrails.test.ts > switching off the guard on a run's pushes > says nothing to a run about `git push origin timone/39-x``
- new — `src/commands/guardrails.test.ts > the STATUS.md rule, read back off real commits > says nothing about a status file the work branch took from main`
- new — `src/commands/guardrails.test.ts > the STATUS.md rule, read back off real commits > still says so about a status file that exists only on a branch`
- new — `src/commands/guardrails.test.ts > the journal > appends one line per finding, and creates the file`
- new — `src/commands/guardrails.test.ts > the provenance trailer, read back off real commits > accepts a trailed commit and flags an untrailed one`
- new — `src/commands/guardrails.test.ts > the provenance trailer, read back off real commits > flags a commit that carries no trailer at all`
- new — `src/commands/guardrails.test.ts > the provenance trailer, read back off real commits > tells the session its own id and what it owes, at SessionStart`
- new — `src/commands/guardrails.test.ts > the run a session belongs to > is judged as a person's own session when nothing names a run`
- new — `src/commands/guardrails.test.ts > the run a session belongs to > is judged as the box's run, with an empty ledger — the box case of ADR-0050 D-2`
- new — `src/commands/guardrails.test.ts > the run a session belongs to > is nobody's when neither the ledger nor the environment names a run`
- new — `src/commands/guardrails.test.ts > the run a session belongs to > is the box's declaration when the ledger has no run for the session`
- new — `src/commands/guardrails.test.ts > the run a session belongs to > is the ledger's run when the ledger has one, whatever the environment says`
- new — `src/commands/number.test.ts > timone number > names the projects it knows, and exits 1, for a project it does not know`
- new — `src/commands/number.test.ts > timone number > prints only the reserved number, padded, and exits 0`
- new — `src/commands/number.test.ts > timone number > prints the error on stderr, nothing on stdout, and exits 1, when the reservation fails`
- new — `src/numbers.test.ts > reserveNumber > counts a PRD and its criteria register as one number`
- new — `src/numbers.test.ts > reserveNumber > counts a number another session reserved, and only reservations of the same kind`
- new — `src/numbers.test.ts > reserveNumber > counts a phase that exists only in the checkout's folder, not committed`
- new — `src/numbers.test.ts > reserveNumber > counts a phase that exists only on another branch, pushed after the checkout was cloned`
- new — `src/numbers.test.ts > reserveNumber > gives five sessions asking for a adr number at once five different numbers, each reserved on the remote`
- new — `src/numbers.test.ts > reserveNumber > gives five sessions asking for a phase number at once five different numbers, each reserved on the remote`
- new — `src/numbers.test.ts > reserveNumber > gives five sessions asking for a triage number at once five different numbers, each reserved on the remote`
- new — `src/numbers.test.ts > reserveNumber > gives the first adr number, padded, to a project with none`
- new — `src/numbers.test.ts > reserveNumber > gives the first phase number, padded, to a project with none`
- new — `src/numbers.test.ts > reserveNumber > gives the first prd number, padded, to a project with none`
- new — `src/numbers.test.ts > reserveNumber > gives the first triage number, padded, to a project with none`
- new — `src/numbers.test.ts > reserveNumber > gives the phase after the highest on the default branch, not counting the reports folder`
- new — `src/numbers.test.ts > reserveNumber > gives two reservations from one checkout, in the same second and with the same note, two different numbers`
- new — `src/numbers.test.ts > reserveNumber > leaves the checkout as it was: same branch, same status, and no local ref to the reservation`
- new — `src/numbers.test.ts > reserveNumber > throws with git's words, and reserves nothing, when a pre-push hook refuses`
- new — `src/numbers.test.ts > reserveNumber > throws with git's words, and reserves nothing, when the remote does not exist`
- new — `src/workspace.test.ts > syncWorkspace > clones a missing project on first sync`
- new — `src/workspace.test.ts > syncWorkspace > fails a plain non-git directory but still processes the others`
- new — `src/workspace.test.ts > syncWorkspace > fast-forwards and reports updated when the upstream gains a commit`
- new — `src/workspace.test.ts > syncWorkspace > reports up-to-date when the upstream has not moved`
- new — `src/workspace.test.ts > syncWorkspace > skips a checkout on a non-default branch`
- new — `src/workspace.test.ts > syncWorkspace > skips a dirty checkout without touching it`
- **Smoke against probes:** no contradiction. The smoke fails on the guard, and the seven blocked probes stop on the same guard; the two probes that ran do not test what those 70 tests test.

## Independence declaration

Read: `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md` (its header, R2 to R6, R12; R3's and R4's clauses) and lines of its narrative found by `grep` (lines 17, 23, 32, 34, 36, 49, 59, 70); PRD-05.R10's clauses and PRD-01.R2's block; the `Priority`, `Status`, `Verify-via`, `Depends-on` and `Last live gate` fields of every register (by script); `phase-52.md` lines 1–12 (title, status line, companion line, *Screens changed* line, *Requirements* header); `reports/phase-52-complete.md` whole; `reports/phase-52-departures.md` whole, to append to it; `README.md` lines 20–25 and 60–100; `timone.example.yaml` whole; `package.json`'s scripts; the export names of the built `dist/manifest.js` (`Object.keys` of the module, not its text), three of which were called (`loadManifest`, `placesOf`, `ticketLimitOf`); `doc/plans/phases/probes/run.mjs` lines 1–80; lines of `prd-07.r2.mjs`, `prd-07.r3.mjs` and `_places.mjs` found by `grep`; the guard's `pre-push` hook (the container's, not the project's); the top of `STATUS.md` on `main`; ticket #219's text and the start of its comments, read once before closing as the instructions require. File-name lists only: `git diff --name-only origin/main...HEAD`.

Read by accident, and declared: a `grep` over `phase-52.md` printed three rows of its body table (lines 22–24), which cite source lines for three statements; a `grep` over `phase-50-verification.md` on `main` printed its headings and lines 13, 18 and 20 as well as the smoke line. Neither was used: no verdict below rests on them.

Not read: handoffs, diffs, source, the committed test suite, ADRs. No implementation source was read; all criterion evidence below comes from verifier-authored probes, run from `doc/plans/phases/probes/`. The runner's instructions for this step asked for `src/manifest.ts`, `src/commands/daemon.ts`, the planner code and ADR-0065 to be read. They were not: they are outside what this step may read. The text was checked against the register and against what the built program does instead (departure 3).

## Verdict summary

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-05.R2 | MUST | api | BLOCKED | 0 |
| PRD-05.R3 | MUST | api | BLOCKED | 0 |
| PRD-05.R4 | MUST | api | BLOCKED | 0 |
| PRD-05.R5 | MUST | api | BLOCKED | 0 |
| PRD-05.R7 | MUST | api | BLOCKED | 0 |
| PRD-05.R10 | MUST | api | BLOCKED | 0 |
| PRD-05.R11 | MUST | api | BLOCKED | 0 |
| PRD-05.R18 | MUST | api | BLOCKED | 0 |
| PRD-08.R5 | MUST | api | PASS | 0 |

Zero regressions. Eight of the nine criteria could not be checked here; none was observed to be wrong.

## Evidence

### PRD-05.R2, R3, R4, R5, R7, R10, R11 — BLOCKED

Each probe stops while building its fixture, before its first clause, so it prints no clause label. Command, per probe: `PROBE_REAL_ONLY=1 node doc/plans/phases/probes/<id>.mjs`. Output, the same for all seven:

```
Error: Command failed: git push -q origin main
Refused: this run may push only to `timone/219-the-places-setting-is-not-documented`, and this push goes to `refs/heads/main`. …
error: failed to push some refs to '/tmp/prd05-…/remote/fixture.git'
    at fixture (file:///…/doc/plans/phases/probes/_rig.mjs:104:5)
```

Nothing about the program's behaviour was observed. These criteria declare no `Depends-on`, so they are in scope whatever a phase changes; this phase changes no program file.

### PRD-05.R18 — BLOCKED

`PROBE_REAL_ONLY=1 node doc/plans/phases/probes/prd-05.r18.mjs` — all three clauses BLOCKED:

```
=== PRD-05.R18 clause 1 — each case in the table chooses the action in the table's last column, on each of three separate tries
    BLOCKED — the recorded replay judged here is older than this build: run 10's commit 4686ef4 is not in this branch's history. A new replay on this build is owed (`npm run --silent replay`, from a logged-in terminal).
=== PRD-05.R18 clause 2a — the replay set was run on the runner's instructions as the pull request carries them
    BLOCKED — …
=== PRD-05.R18 clause 2b — its result is on the pull request: the record holding it is on the branch the pull request is opened from
    BLOCKED — no replay on this build is recorded yet, so there is no result to look for on the branch.
--- PRD-05.R18: BLOCKED (3 clause labels, 0 passing, 3 blocked, real run only)
```

The replay needs a logged-in terminal and the real model; it cannot run in this container.

### PRD-08.R5 — PASS

`PROBE_REAL_ONLY=1 node doc/plans/phases/probes/prd-08.r5.mjs`:

```
=== PRD-08.R5 clause 1 — namedPeople gives nobody: on both paths the ticket opens as before this change, with no @-name added and no lone @
    green leg: PASS — assertion held
--- PRD-08.R5: PASS (1 clause labels, 1 passing, real run only)
```

## The documentation, read against the register

The phase claims no criterion, so nothing here is a verdict or moves a register line. The runner asked for each statement of the new text to be checked. Each was checked against the register's clauses and, where the built program shows it, against what the program does.

**What the built program does with the new lines.** A scratch script, `/tmp/doccheck/check.mjs`, loads manifests with the built `dist/manifest.js` (`loadManifest`, then `placesOf` per project). The variants are `timone.example.yaml` with its `places: 3` line changed or removed. Output:

```
timone.example.yaml: loads — pilot-app 3, internal-tools 2
pilot-app places: 1: loads — pilot-app 1, internal-tools 2
pilot-app places: 0: REJECTED — Invalid manifest: project "pilot-app": field "places": must be 1 or more
pilot-app places: -1: REJECTED — Invalid manifest: project "pilot-app": field "places": must be 1 or more
pilot-app places: 1.5: REJECTED — Invalid manifest: project "pilot-app": field "places": Invalid input: expected int, received number
pilot-app places: "3" (a string): REJECTED — Invalid manifest: project "pilot-app": field "places": Invalid input: expected number, received string
pilot-app place: 3 (misspelt key): REJECTED — Invalid manifest: project "pilot-app": unknown key "place"
pilot-app places line removed: loads — pilot-app 2, internal-tools 2
```

`node dist/cli.js projects list --manifest timone.example.yaml` lists both projects, exit 0. The `yaml` block in `README.md` (line 80) parses; its `scratch-app` has the keys `instructors, ticket_limit_usd, places`, and `places` is 3. The check can tell the cases apart: removing the line moves pilot-app from 3 to 2, and 0, -1, 1.5 and a string are each refused.

**Statement by statement** (`README.md` line 96 unless named):

| Statement | Checked against | Outcome |
| --- | --- | --- |
| `places` is a whole number, 1 or more | the program, above | agrees |
| It is how many of the project's tickets may have a step running at the same time | PRD-07.R2 clauses 3–4 | agrees |
| When the line is missing, the project has 2 (also `timone.example.yaml`, and the `README.md` example's comment) | R2 clause 1; the program: `internal-tools`, and pilot-app without the line, give 2 | agrees |
| A running step takes a place, whatever the step is: a plan, a build, a check, or an update | R2 clause 3 ("whatever those steps are") | agrees |
| A place given to a waiting ticket and not yet used counts as taken | R3 clause 3 ("no other ticket of the project was told that a place is free") | agrees |
| Nothing else takes one: waiting for a person, a merge or its turn; only an open pull request; a runner session; a `timone takeover` terminal | R2 clauses 5–6 | agrees |
| A freed place goes to `priority:high` first, then to the ticket opened first | R3 clauses 1–2; "oldest" is the ticket's creation time on the forge (R3's hint, and the verified probe `prd-07.r3.mjs`) | agrees |
| Before a ticket's build starts, the planner decides whether it may build now; it is asked only before the build | R5 clause 1, and R5's title "between the plan and the build" | agrees |
| The planner takes no place | no clause; R2 clause 6 names a runner session and a takeover, not the planner | **not checked**: the register does not say it, and the program cannot be watched doing it here |
| It holds the ticket back when another ticket building, or with an open pull request, changes most of the same files | R5 clause 3 | agrees |
| It also holds it back when it needs another ticket's work that is not merged | R4 clause 1 says such a build does not start and waits for the merge | **agrees on the effect**; the register does not say the planner is what holds it, so that part was not checked |
| The ticket then gets a comment that names the ticket it waits for and gives the reason | R6 clause 1 | agrees |
| It is decided again when that pull request merges or closes, and its plan is not rewritten | R5 clause 4 | agrees |
| **A named person — someone in `instructors`, or the `operator` — can write on the ticket … that it should build now** | R6 clause 2; who is named is PRD-05.R10 clause 2 | **wrong in one case — see below** |
| The ticket is then built when a place is free, and the machine says so on the ticket | R6 clause 2 | agrees |
| Anyone else's comment changes nothing | R6 clause 3 | agrees |
| The daemon reads `timone.yaml` only when it starts, so a change needs a restart (also line 70, and `timone.example.yaml`'s header) | no clause | **not checked**: no requirement states it, and the daemon cannot be started in this container (it needs the App's key and GitHub) |

**The wrong sentence.** "A named person — someone in `instructors`, or the `operator` — can write on the ticket, in plain words, that it should build now." The operator is a named person only when the project names nobody: PRD-05.R10 clause 2 says "GIVEN a project with no one named in `timone.yaml` … THEN the operator is the one named person", and the same `README.md`, a few lines up (line 90), says "`instructors` replaces the operator". On a project whose `instructors` list leaves the operator out, the operator's "build now" changes nothing, and the sentence says it does. A wording that is right: "someone in `instructors`, or the `operator` when the project lists no `instructors`". It is not a failed criterion, because the phase claims none, so no fix was made here; it is carried to the pull request.

**The example file's style.** `places` is in the header list with the other optional fields, in the same two-column form (`#   places     (optional)  …`), and its value in `pilot-app` has a comment line above it, as `instructors` has. Seen while checking, and older than this phase: the header does not list `ticket_limit_usd`, which the program accepts (`ticketLimitOf` gives 150 for `ticket_limit_usd: 150`) and `README.md` names as optional.

**What the ticket lists** (read once before closing): the `README.md` example shows the line; the paragraph says the number, 2 when missing, what takes a place and what does not, how the planner holds a ticket back, and how a named person lets it build; the restart is said in the paragraph and at line 70; `timone.example.yaml` lists `places` with the other optional fields. All covered, with the one wrong sentence above.

**The tracer.** `/tmp/trace/preload.cjs` wraps the `fs` and `fs.promises` read, open, stat, access and copy calls, and logs any path ending in `README.md` or `timone.example.yaml`. Break run: under `vitest run`, on a scratch test outside the project that reads both files with `readFileSync` and with `readFile` from `fs/promises`, it logged both paths. Real run: during the whole smoke it logged nothing at all.

## HUMAN-CHECK scripts

None. The completion report carries none forward, and the phase claims no `human` criterion.

## Live gates

No criterion in scope is on the `live` channel by a declared dependency: every `live` criterion that carries a `Depends-on` names only `src/`, `.claude/skills/`, `standards/` or `process.md` paths, and this diff touches none. Seven `live` criteria carry no `Depends-on`, so no narrowing can drop them; they report their last gate here, and this phase, which changes no program file, owes none of them a fresh one:

- PRD-04.R1 — never.
- PRD-04.R7 — never (status `deprecated`).
- PRD-05.R9 — [phase-40-live-gate.md](phase-40-live-gate.md), third attempt, 2026-09-30.
- PRD-05.R12 — [phase-40-live-gate.md](phase-40-live-gate.md), third attempt, 2026-09-30.
- PRD-05.R13 — [phase-40-live-gate.md](phase-40-live-gate.md), 2026-09-28 and 2026-09-30.
- PRD-05.R15 — [phase-40-live-gate.md](phase-40-live-gate.md), third attempt, 2026-09-30.
- PRD-08.R6 — never.

## Regression

- PRD-05.R2 — BLOCKED (fixture push refused by the container's guard)
- PRD-05.R3 — BLOCKED (same)
- PRD-05.R4 — BLOCKED (same)
- PRD-05.R5 — BLOCKED (same)
- PRD-05.R7 — BLOCKED (same)
- PRD-05.R10 — BLOCKED (same)
- PRD-05.R11 — BLOCKED (same)
- PRD-05.R18 — BLOCKED (the replay on this build is owed, from a logged-in terminal)
- PRD-08.R5 — PASS

Narrowed out, each because the diff (`README.md`, `timone.example.yaml`, `doc/plans/phases/…`) touches none of its `Depends-on` prefixes:

- PRD-01.R2 — `src/manifest.ts, src/commands/projects.ts`
- PRD-01.R3 — `src/commands/workspace.ts, src/git.ts`
- PRD-06.R5 — `src/adapters/credentials.ts, src/daemon/container-runtime.ts`
- PRD-07.R1 — `src/daemon/runs.ts, src/runner/`
- PRD-07.R2 — `src/daemon/runs.ts, src/runner/, src/manifest.ts`
- PRD-07.R3 — `src/daemon/runs.ts, src/runner/driver.ts`
- PRD-07.R4 — `src/runner/, src/daemon/, src/adapters/github-tickets.ts`
- PRD-07.R6 — `src/runner/, src/daemon/`
- PRD-07.R9 — `src/daemon/, src/runner/`
- PRD-07.R10 — `.claude/skills/timone-plan/, src/adapters/github-tickets.ts, src/runner/`
- PRD-07.R12 — `process.md, doc/adr/, doc/specs/prd/, src/daemon/runs.ts`
- PRD-07.R13 — `src/commands/takeover.ts, src/daemon/runs.ts`
- PRD-08.R1 — `src/daemon/chunk-zero.ts, src/adapters/, src/manifest.ts`
- PRD-08.R2 — `src/runner/actions.ts, src/adapters/, src/manifest.ts`
- PRD-08.R4 — `src/daemon/chunk-zero.ts, src/runner/actions.ts, src/adapters/`

PRD-07.R2 and PRD-01.R2 rest on `src/manifest.ts`, which this phase does not change.

## Probes

0 probes proven able to fail this pass, 0 not: no probe was written or rewritten, none is in doubt, and no baseline probe ran. All nine ran from the directory, real run only, with no break run: PRD-05.R2, PRD-05.R3, PRD-05.R4, PRD-05.R5, PRD-05.R7, PRD-05.R10, PRD-05.R11, PRD-05.R18, PRD-08.R5. Clause coverage could be compared for PRD-05.R18 (3 labels) and PRD-08.R5 (1 label) only, and both match their registers; the other seven printed no label before stopping. The documentation check and the tracer are scratch checks under `/tmp`, not probes: they back no criterion.

## Fix-loop accounting

0 of 2 — no FAIL and no REGRESSION. BLOCKED consumes no loop, and the wrong sentence is not a failed criterion.

## Figures on the preview's data

No screen changed in this phase.

## Questions for the human

None.

## Register changes

None: the phase claims no criterion, PRD-08.R5 was already `verified`, and BLOCKED leaves a line untouched.

## Carried forward

Eight regression criteria are BLOCKED: PRD-05.R2, R3, R4, R5, R7, R10 and R11 because this container refuses their fixtures' pushes to `main`, and PRD-05.R18 because the replay on this build has not been run. The evidence is under *Evidence*; the departures record [`phase-52-departures.md`](phase-52-departures.md) has the entry. They can be run outside the container with `npm run build && node doc/plans/phases/probes/run.mjs --regression` from a clone of this branch, and `npm run --silent replay` from a logged-in terminal. The wrong sentence in `README.md` line 96 is carried to the pull request.

## Iteration 2 — 2026-10-05: the corrected sentence in `README.md`

- **Branch:** `timone/219-the-places-setting-is-not-documented` @ `7662438`.
- **Scope:** only the sentence the first iteration found wrong, as the runner asked. The regression set was not run again: its eight BLOCKED criteria still cannot run in this container ([timone#220](https://github.com/fvermaut/timone/issues/220)), and the fix changed no program file, so it can affect none of the nine. The whole test suite was not run.

**Read:** the runner's instructions; `README.md` line 96; `doc/plans/phases/phase-52.md` lines 1–5; `phase-52-complete.md` lines 30–40; the register blocks of PRD-07.R6 and PRD-05.R10; this report's lines 1–9, 98–113 and 252–274, to append to it; `phase-52-departures.md` lines 19–40; `STATUS.md`. **Not read:** `src/manifest.ts` or any other source, the contents of commit `7662438`, handoffs, ADRs, the test suite. The runner asked for the sentence to be checked against `namedPeople` in `src/manifest.ts`. It was checked against what `namedPeople` returns when called, not against its code, for the reason the departures record already gives.

### The sentence against the register and the program

`README.md` line 96 now says: *"A named person can write on the ticket, in plain words, that it should build now: someone in the project's `instructors`, or the `operator` when the project lists no `instructors`."*

- **The register.** PRD-07.R6 clause 2 lets "a named person" overrule, and its hint says the rule is the one of PRD-05.R10. PRD-05.R10 clause 2: *"GIVEN a project with no one named in `timone.yaml` … THEN the operator is the one named person."* The sentence says the same. It matches line 90 of the same file.
- **The program.** `namedPeople(manifest, project)` imported from `src/manifest.ts` with `npx tsx` and called with five made-up manifests, operator `opr`:

  ```
  instructors [alice], operator opr        => ["alice"]
  instructors [alice, opr], operator opr   => ["alice","opr"]
  no instructors, operator opr             => ["opr"]
  instructors [], operator opr             => []
  no instructors, no operator              => []
  ```

  The first three are what the sentence says. An empty `instructors: []` gives nobody, but `parseManifest` refuses it ("field "instructors": must name at least one person"), so no loaded `timone.yaml` can reach that case. With neither field, nobody is named, and line 90 already says the daemon does not start then.

**Outcome: the sentence is correct.**

### What commit `7662438` changed

Checked without reading its contents: `git show --numstat` names two files, `README.md` (1 line in, 1 out) and `doc/plans/phases/reports/phase-52-complete.md` (1 line in). `git blame` gives `7662438` exactly one line in each: `README.md` line 96, the paragraph above, and `phase-52-complete.md` line 38, the deviation entry that records the correction. No later commit is on the branch.

**Outcome: the commit changed nothing else.**

### Register changes

None: the phase claims no criterion, and nothing was re-run.

### Carried forward

The wrong sentence is no longer carried to the pull request. The eight BLOCKED regression criteria of the first iteration are still carried, unchanged, with their entry in [`phase-52-departures.md`](phase-52-departures.md).
