# Phase 49 — Verification Report

- **Date:** 2026-10-05
- **Phase:** [phase-49.md](../phase-49.md) — stamped `Complete`, completion report [phase-49-complete.md](phase-49-complete.md)
- **Scope:** PRD-07.R2, R4, R5, R6, R12 (all MUST), as the phase file's header and the completion report's requirements line both name them.
- **Live gate owed:** yes — PRD-07.R5 (`live`), whose `Depends-on` (`src/runner/, src/daemon/`) this phase's diff touches.
- **Regression set (derived):** PRD-01.R2; PRD-05.R2, R3, R4, R5, R7, R10, R11, R18; PRD-07.R1, R3, R9, R10, R13; PRD-08.R1, R2, R4, R5 — 18 criteria, MUST + `api` + `verified` at this branch's HEAD, narrowed by `Depends-on` (two removed, see *Regression*).
- **Branch:** `timone/203-5-two-places-and-the-planner` @ `fd11e9c` when the pass began; fix commits `e705481` and `074ec45` added on it in this pass. Its merge-base with `main` is `55cddb4`, `main`'s head, so phases 44, 45, 47 and 48 and their verification commits are all in its ancestry; nothing was merged in.

## Environment

Timone is a command-line program, so there is no server to stand up. Its production form is the compiled `dist/cli.js`: `npm run build` (the completion report's run instructions) after the install that was already done. Every probe runs that build — the daemon (`daemon --runtime in-process`), `status`, `takeover` and the git hooks — in a throwaway folder against a fake GitHub (`_fake-gh.cjs` on `PATH`, backed by a JSON file and a local bare git remote) and a fake model service on 127.0.0.1, through `doc/plans/phases/probes/_rig.mjs`. Nothing reached GitHub or a real model. `npm run build` was run again after each fix commit before any probe ran.

Order: the regression probes, real runs only, in parallel; the claimed probes, each with its break run; the regression probes again with their break runs (the shared instruments changed, below); fix 1; every probe in scope again, real runs only; fix 2; every probe in scope again, real runs only, with PRD-07.R2 doing its break run for its new label; then the build-health smoke.

**The shared instruments changed in this pass, and why.** The first real run of the regression set had 7 probes failing and 1 running out of time. The cause was the instruments, not the app, and it was established by watching the built daemon, not by reading code: since this phase, a build's first `start_step` is answered *"Refused: The planner has not decided yet whether this ticket may be built now …"*, and the decision comes from a new model session that the fake model did not answer (its tools: `mcp__planner__let_build`, `hold`, `pass_to_runner`, `read_plan`). Four changes, each marked `✏ 2026-10-05` in its file:

- `_rig.mjs`: the fake model now recognises a planner session and, unless a probe plans one, answers `let_build` for the ticket in its brief; and, unless a probe sets `noBuildRetry`, a `start_step` that the planner's gate refused is tried once more on the wake that says the planner let the ticket build — what a runner taking the refusal at its word does. The fixture's project clone now has `origin/HEAD`, as any clone of a non-empty remote has: the push guard of this phase refuses a work branch's first push from a clone without it (the completion report's known limits), and the old fixture cloned an empty remote. `places` can be written into a fixture's `timone.yaml`.
- `_places.mjs`: the planner's gate refusal is not counted as a refusal for want of a place; the one-place fixtures now write `places: 1`, since the default is now 2; the freed-place fixture holds its first step 20 s instead of 9 s, because each waiting ticket now passes the planner first. Two helpers were added (`manyAsk`, `afterStepAsks`).
- `_steps.mjs`: the box-script helper waits past the planner's gate refusal.
- `_fake-gh.cjs`: each `blocked by` entry now carries its state and URL, as GitHub's does — the built daemon refused the list without them (*"gh returned an unexpected shape (…blockedBy.nodes.0.state…)"*); and `failCalls` makes a chosen call fail as GitHub failing would.

Because every regression probe's instrument changed, every regression probe then did its break run as well as its real run (*Probes*).

- **Build-health smoke**, run once at the end and not as evidence: `npm run build && npx tsc --noEmit && npx vitest run` — `tsc` exit 0; **73 test files, 1852 tests passed**, 4.87 s. **Smoke failures:** none. No failing test, so nothing to mark old or new. The report on `main` it would have been compared with is `doc/plans/phases/reports/phase-48-verification.md`, whose smoke also passed whole (its line 18).
- No contradiction between the smoke and any probe.

## Independence declaration

Read: `process.md` (its stage table, by search), Timone's `timone.yaml`; the register `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md` whole and the field lines (priority, status, channel, `Depends-on`) of every other register under `doc/specs/prd/`; the PRD narrative `prd-07-several-tickets-of-one-project-at-once.md`; `doc/plans/phases/phase-49.md`, lines 1–30; the completion report `phase-49-complete.md` whole; `README.md`, `CONTEXT.md`, `STATUS.md` (the project has no `doc/standards.md`); the probe directory `doc/plans/phases/probes/`; the headings of `phase-49-departures.md` and the verification entry of `phase-48-departures.md` on `main`, for the entry format; `git diff --name-only 55cddb4 HEAD` (the phase's changed file names), `git show --name-only --format=` of each fix commit, and `git log --oneline` of the branch (commit subjects).

**Read beyond the rule, declared:**

- `phase-49.md` lines 1–30 include the *Goal Description*, beyond the status line, requirements header and *Screens changed* line. It names functions (`PLACES_PER_PROJECT`, `nextStep`) and says what ADR-0065 decides. No verdict rests on it: every probe was written from the register's clauses and from what the built daemon was seen to do.
- In `phase-48-verification.md` on `main` I meant to read only the smoke line (line 18). The search also printed its section headings and its lines 14, 18, 19, 25, 120, 140 and 151, which say the same three checks (PRD-05.R2 clause 2b, R7's real-runner clause, R18) were BLOCKED there for the same reasons. No verdict below rests on them.
- Each fix context returned a note with its SHA. I read both notes. Fix 2's note says that an accepted decision record, ADR-0063 D2, says the opposite of PRD-07.R2 clause 6 (*Questions for the human*, 1). I did not open the ADR.

The runner's instructions for this step named the plan, ADR-0065 and the PRD as what to check against. The plan's sub-phase bodies and ADR-0065 were not read: this check works from the register alone, and both are build intent.

Not read: handoffs, diffs, source, the committed test suite, ADRs. No implementation source was read. All criterion evidence below comes from verifier-authored probes, run from `doc/plans/phases/probes/` or written this pass. PRD-07.R12's probe reads the documents its clauses name (`process.md`, ADR-0026, the PRD-02, PRD-03 and PRD-05 texts), because those texts are what that criterion is about.

## Verdict summary

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-07.R2 | MUST | api | PASS — clause 6 failed first, fixed in loop 2 | 2 |
| PRD-07.R4 | MUST | api | PASS — clauses 1 and 4 failed first, fixed in loop 1 | 1 |
| PRD-07.R5 | MUST | live | LIVE-GATE — never gated; this phase owes one | — |
| PRD-07.R6 | MUST | api | PASS | 0 |
| PRD-07.R12 | MUST | api | PASS | 0 |
| PRD-01.R2 | MUST | api | PASS (regression) | 0 |
| PRD-05.R2 | MUST | api | PASS (regression); clause 2b BLOCKED | 0 |
| PRD-05.R3 | MUST | api | PASS (regression) | 0 |
| PRD-05.R4 | MUST | api | PASS (regression) | 0 |
| PRD-05.R5 | MUST | api | PASS (regression) | 0 |
| PRD-05.R7 | MUST | api | PASS (regression); its real-runner clause BLOCKED | 0 |
| PRD-05.R10 | MUST | api | PASS (regression) | 0 |
| PRD-05.R11 | MUST | api | PASS (regression) | 0 |
| PRD-05.R18 | MUST | api | BLOCKED — the replay needs a model login | 0 |
| PRD-07.R1 | MUST | api | PASS (regression) | 0 |
| PRD-07.R3 | MUST | api | PASS (regression) | 0 |
| PRD-07.R9 | MUST | api | PASS (regression) | 0 |
| PRD-07.R10 | MUST | api | PASS (regression) | 0 |
| PRD-07.R13 | MUST | api | PASS (regression) | 0 |
| PRD-08.R1 | MUST | api | PASS (regression) | 0 |
| PRD-08.R2 | MUST | api | PASS (regression) | 0 |
| PRD-08.R4 | MUST | api | PASS (regression) | 0 |
| PRD-08.R5 | MUST | api | PASS (regression) | 0 |

The gate: every claimed MUST criterion is PASS or LIVE-GATE, within 2 loops; no regression. PRD-05.R18 is BLOCKED, which observed nothing and is not a regression; it is carried forward.

## Evidence

### PRD-07.R2 — PASS (after fix 2)

Probe [`prd-07.r2.mjs`](../probes/prd-07.r2.mjs), amended this pass: clauses 1 and 2 judged for the first time, clause 3 at N = 2, clause 4's second half with two places, and a new label for clause 6. Final run, `node doc/plans/phases/probes/prd-07.r2.mjs` (break run, then real run), after fix 2:

```
=== PRD-07.R2 clause 1 — a project whose entry in timone.yaml sets no limit: when its places are counted, it has 2
    break leg: RED (as required) — 1 steps started, not 2 (places: 1: #31 started, #32 refused, #33 refused; …)
    green leg: PASS — (no places line: #31 started, #32 started, #33 refused; steps running at the end: #31, #32)
    (the third ticket was refused with: "Refused: No place is free on fixture: run fixture#31/1 has a step running. This ticket now waits for its turn, …")
=== PRD-07.R2 clause 2 — … a limit of N: when its places are counted, it has N (N = 3 and N = 1)
    break leg: RED (as required) — 2 steps started, not 3 (no places line: …)
    green leg: PASS — (places: 3: #31, #32, #33 started, #34 refused; running: #31, #32, #33) (places: 1: #31 started, #32 refused, #33 refused)
=== PRD-07.R2 clause 3 (N = 2) — 2 places and steps of 2 different tickets running: another ticket's step does not start, and it waits for its turn
    break leg: RED (as required) — the third ticket's step started while both places were taken (places: 3: …)
    green leg: PASS — (the third ticket in the ledger: parked {…,"waitingSince":"2026-10-05T09:59:03.854Z"})
=== PRD-07.R2 clause 4 (two places) — one of two places taken: another ticket's step starts, while the other step keeps running
    break leg: RED (as required) — the first two tickets' steps did not both start (places: 1: …)
    green leg: PASS — (steps started at: #31 09:58:59, #32 09:59:01; both running at the end: 31, 32)
=== PRD-07.R2 clause 3 (building | sorting the request | delivering) — one place, a step running: … refused, and waits     PASS ×3, each break leg RED
=== PRD-07.R2 clause 4 — one place, none taken: a step starts                                                              PASS, break leg RED
=== PRD-07.R2 clause 5 (waiting for a person | waiting for a merge, with only an open pull request | waiting for its turn)  PASS ×3, each break leg RED
=== PRD-07.R2 clause 6 (runner session | takeover session)                                                                 PASS ×2, each break leg RED
=== PRD-07.R2 clause 6 (runner session after a step) — a runner session … woken by the end of that ticket's step: … it takes no place
    break leg: RED (as required) — a refusal names the first ticket as taking the place: "Refused: No place is free on fixture: the place is given to run fixture#12/1. …"
    green leg: PASS — (the first ticket's step ended 09:59:15.176; its runner session still open when the second ticket was answered at 09:59:21.368: true; the second ticket was refused: []; its step started: true; the first ticket's place: {"priority":false,"openedAt":"2026-09-01T10:00:00.000Z"})
--- PRD-07.R2: PASS (14 clause labels, 14 passing)
```

**The failure, before fix 2.** After fix 1, the real run of clause 5 (*waiting for a merge, with only an open pull request*) failed once: *"the ledger shows the first ticket taking a place: parked {…,"givenAt":"2026-10-05T09:45:00.759Z"}"*. Watching the ledger every 250 ms showed why. When a ticket's step ends, the place is given back to that same ticket (`notice: place given … run fixture#12/1`, `givenAt` set). It keeps the place for as long as its runner session runs, and it is freed only when that session ends. The probe's snapshot had landed in that window. A fixture holding that runner session open (`afterStepAsks`) then showed that another ticket is turned away during it. With `places: 1`, #12's step ended at 09:51:32.832, and its runner session was still open. #13's `start_step` at 09:51:38.862 was answered *"Refused: No place is free on fixture: the place is given to run fixture#12/1. This ticket now waits for its turn …"*. That is against clause 6, *"a runner session running for a ticket … THEN neither takes a place"*. The build before this phase (`55cddb4`) does the same, so the fault is not new in this phase. It is in a criterion this phase claims. The brief, fix `074ec45` and re-verify are under *Fix-loop accounting*. The new label's break leg runs the build at `e705481` (before fix 2), and it goes red there with the same refusal.

### PRD-07.R4 — PASS (after fix 1)

Probe [`prd-07.r4.mjs`](../probes/prd-07.r4.mjs), written this pass. The fixture is an initiative: map #50, step 1 (#51) closed, steps 2 and 3 (#52, #53) each blocked by #51, step 4 (#54) blocked by #52 and #53, and `places: 3`. A merge is played as GitHub plays it: the step ticket closes. First run, with its break runs, before any fix:

```
=== PRD-07.R4 clause 1 — … whose pull request is not merged: its build would start, and it does not start, and it waits for the merge
    break leg: RED (as required) — step 4 (#54) started while what it needs was merged: …
    green leg: PASS
    (steps 2 and 3 unmerged: #52 building since 09:31:32; #53 building since 09:31:34; #54 not picked up)
    (step 2 merged, step 3 not: … #54 not picked up)
    (both merged: … #54 building since 09:32:08)
=== PRD-07.R4 clause 1 (the list of steps cannot be read) — … while GitHub fails the call that lists the initiative's steps: … it does not start
    break leg: RED (as required)
    green leg: FAIL — step 4 (#54) started while steps 2 and 3 were both unmerged and the list of steps could not be read: #52 building since 09:31:32; #53 building since 09:31:34; #54 building since 09:31:37
=== PRD-07.R4 clause 3 — steps 2 and 3 open and blocked by nothing open: … both build at the same time
    break leg: RED (as required) — steps 2 and 3 are not both building: #52 building since 09:32:09; #53 picked up, parked, not building (the build before phase 49)
    green leg: PASS — (#52 building since 09:31:32; #53 building since 09:31:34; #54 not picked up)
=== PRD-07.R4 clause 4 — a step ticket blocked by another step ticket that is still open: … does not start
    break leg: RED (as required) — step 4 (#54), blocked by nothing open, started
    green leg: PASS
=== PRD-07.R4 clause 4 (the list of steps cannot be read)
    break leg: RED (as required)
    green leg: FAIL — step 4 (#54), blocked by #52 and #53, both open, started: …
=== PRD-07.R4 clause 2 (cut from another ticket's branch) — … when it is created (its first push), it is refused, and never reaches the remote
    break leg: RED (as required) — the push … went through: * [new branch] HEAD -> timone/12-add-a-count-of-open-to-dos PUSH_EXIT=0 (the build before phase 49)
    green leg: PASS — (what the step session saw: Refused: this branch carries work of timone/11-other-work that is not on the default branch yet. Cut the work branch from the default branch, and keep only this ticket's commits on it. … PUSH_EXIT=1)
=== PRD-07.R4 clause 2 (cut from the default branch) — … it reaches the remote, cut from main
    break leg: RED (as required) — the work branch on the remote is not cut from main (contains timone/11-other-work: true)
    green leg: PASS
--- PRD-07.R4: FAIL (7 clause labels, 5 passing)
```

The failing case is a transient GitHub failure. GitHub fails one call, `gh issue list --state all --json …,blockedBy,parent`, and answers the others. The daemon then printed *"could not read the steps of #50"* and picked up #52, #53 and #54 as ordinary tickets. The planner was shown *"## What this ticket is blocked by — Nothing that is known."* for #54, and #54 started building. The build before this phase does the same: #54 was picked up, and was stopped only for want of a place. The brief, fix `e705481` and re-verify are under *Fix-loop accounting*. The real runs after fix 1 and after fix 2 both print `--- PRD-07.R4: PASS (7 clause labels, 7 passing)`. With the steps list failing, *"#52 not picked up; #53 not picked up; #54 not picked up"*: since fix 1, nothing of the project is picked up on such a cycle.

A scratch run, not a probe, also tried a branch cut from another ticket's branch fetched under a private name (`git fetch origin refs/heads/timone/11-other-work:refs/probe/other`). The push was refused with the same words.

### PRD-07.R6 — PASS

Probe [`prd-07.r6.mjs`](../probes/prd-07.r6.mjs), written this pass. The planner's judgement is played by the probe's fake model. What is checked is everything code does around it. `node doc/plans/phases/probes/prd-07.r6.mjs`:

```
=== PRD-07.R6 clause 1 — the planner holds a ticket back: … a comment on that ticket, in plain words, names the ticket it waits for and gives the reason
    break leg: RED (as required) — no comment on the ticket names the ticket it waits for (#70) … (ticket #70, which was let build)
    green leg: PASS
    (the comment: "… **This ticket waits for #70 before it is built.** Both change src/count.ts in the same lines. I will look again when #70 is merged or closed. **What I need from you:** nothing. If it should be built now anyway, say so here.")
=== PRD-07.R6 clause 2 — a named person writes … that it should build now: the planner lets it build when a place is free, and says on the ticket that it does so on that comment
    break leg: RED (as required) — the planner did not let the held ticket build: ["hold"] (the state before the operator wrote)
    green leg: PASS
    (two places — the comment: "… **I am building this ticket now, on probe-operator's comment.** It starts as soon as a place on the project is free. …"; the build started 09:35:28, the operator wrote at 09:35:24)
    (one place — the other ticket's step ended at 09:35:32; the held ticket's build started at 09:35:34; refused before that: ["Refused: The planner has not decided yet …","Refused: No place is free on fixture: run fixture#70/1 has a …"])
=== PRD-07.R6 clause 3 — someone not named for the project writes the same: nothing changes
    break leg: RED (as required) — across the operator's comment: a new planner decision was recorded: …"onComment":{"by":"probe-operator",…}
    green leg: PASS — (planner sessions while the stranger's comment stood: 0)
=== PRD-07.R6 clause 3 (the planner cites the stranger's comment) — the planner answers that it builds on the comment of someone not named for the project: nothing changes
    break leg: RED (as required) — the held ticket was let build: … (the fixture where it cites the operator)
    green leg: PASS — (the planner was answered: […, "Refused: The comment at 2026-10-05T09:35:12Z is by probe-stranger, who is not named for this project. Only a named person can have a ticket built before the planner would let it."]; the ticket's decision at the end: {"kind":"hold",…,"waitsFor":[70]})
--- PRD-07.R6: PASS (4 clause labels, 4 passing)
```

Real runs after fix 1 and after fix 2: `PASS (4 clause labels, 4 passing, real run only)`.

### PRD-07.R12 — PASS

Probe [`prd-07.r12.mjs`](../probes/prd-07.r12.mjs), from the directory. A label was added this pass for the two places phase 47 left to this piece. Its break leg reads the same files at `55cddb4`, just before this phase. `node doc/plans/phases/probes/prd-07.r12.mjs`:

```
=== PRD-07.R12 clause 2 (for what piece 5 changes) — PRD-02.R22 clause 1 and PRD-05.R15 clause 2 are read: each carries a dated note naming the requirement of this PRD that changes it
    break leg: RED (as required) — PRD-02.R22 clause 1 carries no dated note naming a requirement of PRD-07 / PRD-05.R15 clause 2 carries no dated note …
    green leg: PASS
    (PRD-02.R22 clause 1: "> ✏ 2026-10-05 — changed by [PRD-07.R4](…) ([ADR-0065](…)): every step ticket that is open, unblocked, unheld…")
    (PRD-05.R15 clause 2: "> ✏ 2026-10-05 — this clause is replaced by [PRD-07.R2](…) ([ADR-0065](…)). Two ticket…")
--- PRD-07.R12: PASS (5 clause labels, 5 passing)
```

Clauses 1, 3 and 4, and clause 2 for its first three places, pass as they did in phase 47, each break leg red on the files before phase 47. The completion report notes that the register's 2026-10-04 note under R12 was stale. It is struck through below a new dated note (*Register changes*).

### PRD-07.R5 — LIVE-GATE

No probe and no script, per the channel. See *Live gates*.

### Regression — 17 PASS, 1 BLOCKED

Each regression probe, from the directory and unchanged in its clauses, ran three times: a real run first, then its break run and real run after the instrument changes, then a real run after each fix. The second column is the break-run pass. The third is the last real run, after fix 2:

| ID | break run + real run | last real run (after fix 2) |
| --- | --- | --- |
| PRD-01.R2 | PASS, 5 of 5 | PASS, 5 of 5 |
| PRD-05.R2 | PASS, 3 of 4, 1 blocked | PASS, 3 of 4, 1 blocked |
| PRD-05.R3 | PASS, 19 of 19 | PASS, 19 of 19 |
| PRD-05.R4 | PASS, 6 of 6 | PASS, 6 of 6 |
| PRD-05.R5 | PASS, 6 of 6 | PASS, 6 of 6 |
| PRD-05.R7 | PASS, 3 of 4, 1 blocked | PASS, 3 of 4, 1 blocked |
| PRD-05.R10 | PASS, 4 of 4 | PASS, 4 of 4 |
| PRD-05.R11 | PASS, 12 of 12 | PASS, 12 of 12 |
| PRD-05.R18 | BLOCKED, 3 of 3 blocked | BLOCKED, 3 of 3 blocked |
| PRD-07.R1 | PASS, 5 of 5 | PASS, 5 of 5 |
| PRD-07.R3 | PASS, 5 of 5 | PASS, 5 of 5 |
| PRD-07.R9 | PASS, 4 of 4 | PASS, 4 of 4 |
| PRD-07.R10 | PASS, 5 of 5 | PASS, 5 of 5 |
| PRD-07.R13 | PASS, 4 of 4 | PASS, 4 of 4 |
| PRD-08.R1 | PASS, 3 of 3 | PASS, 3 of 3 |
| PRD-08.R2 | PASS, 2 of 2 | PASS, 2 of 2 |
| PRD-08.R4 | PASS, 2 of 2 | PASS, 2 of 2 |
| PRD-08.R5 | PASS, 1 of 1 | PASS, 1 of 1 |

The blocked clauses, each in the probe's own words: PRD-05.R2 clause 2b — *"GitHub could not be read from here (gh)."* PRD-05.R7's real-runner clause and all of PRD-05.R18 — *"the newest recorded replay is older than this build … A new replay on this build is owed (`npm run --silent replay`, from a logged-in terminal)."* This container has no model login.

The first real run, before the instrument changes, had PRD-05.R2, R3, R4, R5 and PRD-07.R1, R3, R10, R13 failing, and PRD-05.R11 out of time at 1500 s. Every failure read *"Refused: The planner has not decided yet …"*, or showed a setup state never reached because of it. PRD-07.R3's *"the place went to #21, not #22"* came from the second place: the fixture assumed one, and #22 started at once in the second place. PRD-07.R10's came from the missing `origin/HEAD` (*"Timone's push guard could not judge this push … refs/remotes/origin/HEAD is not a symbolic ref"*). These are the instrument faults described under *Environment*. They are not regressions: on the corrected instruments, every one of these probes passes with its break run red.

## HUMAN-CHECK scripts

None. No criterion in scope is on the `human` channel, and the completion report carries no HUMAN-CHECK forward.

## Live gates

- **PRD-07.R5** — `Last live gate: never`. **This phase owes a fresh one**: its diff touches `src/runner/` and `src/daemon/`. What a person must do, from the register's hint and the completion report: on scratch-app, never ivtrends, have the machine write three test tickets, two whose plans change most of the same files and one that changes none of them. Watch the planner let one of the first two and the third build at the same time, and hold the other with a comment naming the ticket it waits for. Merge or close the first, and watch the held one decided again with its plan not rewritten. Clause 1's code part, *"the build does not start without"* a planner decision, was seen in every probe run of this pass as the refusal quoted under *Environment*. It is not a live gate.

## Regression

The derived set's results are in the table under *Evidence*: 17 PASS, PRD-05.R18 BLOCKED. Nothing regressed.

What the narrowing removed (this phase's diff touches none of these prefixes):

- **PRD-01.R3** — `Depends-on: src/commands/workspace.ts, src/git.ts`.
- **PRD-06.R5** — `Depends-on: src/adapters/credentials.ts, src/daemon/container-runtime.ts`.

Kept because they declare no `Depends-on`: PRD-05.R2, R3, R4, R5, R7, R10, R11, R18 and PRD-08.R5. Kept by a touched prefix: PRD-01.R2 (`src/manifest.ts`), PRD-07.R1, R3, R9, R10, R13 (`src/daemon/…`, `src/runner/…`, `.claude/skills/timone-plan/`, `src/commands/takeover.ts`), PRD-08.R1, R2, R4 (`src/adapters/`, `src/manifest.ts`, `src/runner/actions.ts`).

## Probes

**22 probes ran. 21 proven able to fail this pass, 0 not.** PRD-05.R18's probe did no break run: all three of its clauses were BLOCKED, so it judged nothing.

- Written this pass (first check of the criterion): **PRD-07.R4**, **PRD-07.R6**. Each did its break run, every label red, then its real run.
- Amended this pass, to close gaps between the register's clauses and the labels printed: **PRD-07.R2** (clauses 1 and 2 were printed but not judged; clause 3 at N = 2 and clause 4's second half were not seen; clause 6 for the runner session after a step was not covered — 14 labels now for 6 clauses), and **PRD-07.R12** (clause 2's two places for this piece). Both did their break runs, every label red.
- Run from the directory, unchanged in their clauses, with their instruments changed: the 18 regression probes. Each did a break run this pass, because its result was in doubt once the shared rig changed. Every label went red on its break leg, except the BLOCKED ones.
- **Probes that ran without a break run** (real runs only): in the first regression run, all 18 regression probes; after fix 1, all 22 probes; after fix 2, every probe but PRD-07.R2 — PRD-01.R2, PRD-05.R2, R3, R4, R5, R7, R10, R11, R18, PRD-07.R1, R3, R4, R6, R9, R10, R12, R13, PRD-08.R1, R2, R4, R5.
- No probe has a clause with no break step.
- Clause coverage: every claimed criterion's register clauses now each have at least one label (R2 6 → 14 labels, R4 4 → 7, R6 3 → 4, R12 4 → 5).

The runner `run.mjs` already does real runs only by default (`--with-break` for both). It was not changed. It derives the whole unnarrowed set, so this pass ran the 18 narrowed probes by name, in parallel, with `PROBE_REAL_ONLY=1`.

## Fix-loop accounting

**2 of 2 loops consumed.**

**Loop 1 — PRD-07.R4, clauses 1 and 4.** Brief, as given to a fresh fix context:

> ## Defect brief — PRD-07.R4, loop 1
> - **Criterion:** clause 1, "GIVEN a ticket that needs another ticket's work, and that ticket's pull request is not merged / WHEN the first ticket's build would start / THEN it does not start, and it waits for the merge"; clause 4, "GIVEN a step ticket blocked by another step ticket that is still open / WHEN the daemon reads the project / THEN the blocked step does not start".
> - **Expected (per the register):** a step blocked by an open step is never started, including on a cycle where GitHub fails one of the calls the daemon makes to read the project.
> - **Observed:** with GitHub failing only `gh issue list … --state all --json …,blockedBy,parent`, the daemon printed "could not read the steps of #50", picked up #52, #53 and #54, showed the planner "What this ticket is blocked by — Nothing that is known." for #54, and #54's building step started while #52 and #53 were open. The build before this phase (55cddb4) also picked #54 up.
> - **Reproduction:** the initiative fixture of `prd-07.r4.mjs`, with `failCalls` on that call.
> - **Evidence:** #54's record: `… planner-decision: build | … | step-started: execution`; ledger: `fixture#52/1 active; fixture#53/1 active; fixture#54/1 active`.
> - **Constraint:** commit as `fix: verify 49 — PRD-07.R4 a blocked step is not picked up when its steps cannot be read` on `timone/203-5-two-places-and-the-planner`; follow the code's conventions; change nothing the brief does not require.

Fix commit: **`e705481`** (`src/daemon/poll.ts`, `src/daemon/poll.test.ts`). `poll.ts` is the daemon's read of every project, and every daemon-driven criterion rests on it, so every probe in scope was run again, real runs only: 21 PASS, PRD-05.R18 BLOCKED, and PRD-07.R2 FAIL on one label. That label is clause 5, *waiting for a merge*; its cause is loop 2. PRD-07.R4: 7 of 7. Not run again: none.

**Loop 2 — PRD-07.R2, clause 6.** Brief, as given to a second fresh fix context:

> ## Defect brief — PRD-07.R2, loop 2
> - **Criterion:** clause 6, "GIVEN a runner session running for a ticket, or a takeover session open in a person's own terminal / WHEN the project's places are counted / THEN neither takes a place".
> - **Expected (per the register):** while a ticket's runner session runs, including the one its own step's end wakes, the ticket takes no place, and another ticket's step is not refused because of it.
> - **Observed:** `places: 1`. #12's step ended at 09:51:32.832; `notice: place given … run fixture#12/1`, ledger `givenAt` set; #12's runner session still open. #13's `start_step` at 09:51:38.862: "Refused: No place is free on fixture: the place is given to run fixture#12/1. This ticket now waits for its turn …". The build before this phase does the same.
> - **Reproduction:** `afterStepAsks()` in `_places.mjs`.
> - **Evidence:** the two run records and the ledger, as quoted under *Evidence*.
> - **Constraint:** commit as `fix: verify 49 — PRD-07.R2 a runner session after a step takes no place`; every other rule of places unchanged; change nothing the brief does not require.

Fix commit: **`074ec45`** (`src/daemon/runs.ts`, `src/daemon/runs.test.ts`, `src/runner/driver.ts`, `src/runner/driver.test.ts`). `runs.ts` is the place ledger, which many criteria rest on, so every probe in scope was run again: PRD-07.R2 with its break run (14 of 14, its new label red on the build at `e705481`), the 21 others real runs only. 21 PASS, PRD-05.R18 BLOCKED. Not run again: none. The fix context's note says the change goes against ADR-0063 D2 (*Questions for the human*, 1).

No run of the whole probe set follows the last fix beyond this narrowed one, which covered every probe in scope. The whole test suite ran once, after both fixes (*Environment*).

## Figures on the preview's data

No screen changed in this phase: the phase file's *Screens changed* line reads "none", and Timone draws no screen.

## Questions for the human

1. **A ticket whose step just ended no longer keeps its place while its runner decides the next step. The requirement says so; an accepted decision record says the opposite.** PRD-07.R2 clause 6 says: *"GIVEN a runner session running for a ticket … THEN neither takes a place"*, and `CONTEXT.md` says a place is not taken by *"a runner session"*. The build, as phase 47 left it, gave the freed place back to the ticket whose step just ended, for the length of its runner session. During that time another ticket's build was refused (*Evidence*, PRD-07.R2). The fix in this branch (`074ec45`) follows the requirement. When it made the fix, the fix context reported that ADR-0063, point D2, decides the old behaviour: a run whose step has just ended waits with its own order, and keeps the place when it comes first. The ADR was not changed. Which should stand? If the requirement: ADR-0063 needs a dated note. If the ADR: R2 clause 6 needs a revision, and `074ec45` should be reverted. What changes in practice: a ticket with several steps in a row can now lose the place between two steps to a ticket that is waiting.
2. **A `blocked by` relation on an ordinary ticket is not read.** PRD-07.R4 clause 1 says a ticket that *"needs another ticket's work"* does not build while that work is unmerged. The register's hint names the steps of an initiative and GitHub's `blocked by`, and that case passes. For an ordinary marked ticket that a person marked on GitHub as blocked by another open ticket with an open pull request, the daemon never asks GitHub for the relation. The planner is shown *"What this ticket is blocked by — Nothing that is known."*, and a planner that lets it build is obeyed (a scratch run, not a probe). Whether that ticket needs the other one is then left to the planner reading the two plans: that is R5's watched run. Should such a relation stop the build, as it does for a step? If yes, it is a new requirement or a revision of R4.

## Register changes

In `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md`:

- **PRD-07.R2** `draft` → `verified`, with a dated note naming this report and its probe. The stale part of the 2026-10-04 note ("Clause 4 was seen only as far as one place allows … status stays `draft`") is struck through, as history. ADR-0055: the block's `Falsified-by` line names its checks, and the probe proved each label able to fail.
- **PRD-07.R4** `draft` → `verified`, with a dated note. ADR-0055: clause 2's *"never from another ticket's branch"* is a universal claim. The block's `Falsified-by` line names a check that reads the base of every work branch a run creates, and the probe's clause 2 labels went red on the build before this phase.
- **PRD-07.R6** `draft` → `verified`, with a dated note.
- **PRD-07.R12** `draft` → `verified`, with a dated note. The stale sentence of the 2026-10-04 note is struck through.
- **PRD-07.R5** unchanged (`draft`, `live`).
- Regression set: no change. All PASS or BLOCKED.

## Carried forward

- **PRD-05.R18** (all three clauses), **PRD-05.R7**'s real-runner clause and **PRD-05.R2** clause 2b are BLOCKED. The replay needs a Claude login, and the probe for 2b needs to read GitHub; this container has neither. What a person must do: run `npm run --silent replay` from a logged-in terminal on this branch before merging, and commit its record on the branch. Recorded in [`phase-49-departures.md`](phase-49-departures.md).
- **PRD-07.R5**'s live gate is owed (*Live gates*). It is recorded in the departures record and carried to the pull request.
