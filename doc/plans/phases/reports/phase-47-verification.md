# Phase 47 — Verification Report

- **Date:** 2026-10-04
- **Phase:** [phase-47.md](../phase-47.md) — stamped `Complete`, completion report [phase-47-complete.md](phase-47-complete.md)
- **Scope:** PRD-07.R1, PRD-07.R2 (clauses 3 to 6; clauses 1 and 2, the number of places, stay with piece 5), PRD-07.R3, PRD-07.R9, PRD-07.R12 (for what this piece changes: PRD-02.R10, PRD-02.R22 clause 6, PRD-05.R11 clause 2, PRD-03's out-of-scope line, ADR-0026, `process.md` stage 6), PRD-07.R13. The completion report's requirements line names the same set.
- **Live gate owed:** no criterion in this scope is on the `live` channel. The completion report says a watched run on scratch-app is owed before delivery; see *Live gates*.
- **Regression set (derived):** PRD-05.R2, R3, R4, R5, R7, R10, R11, R18; PRD-07.R10; PRD-08.R1, R2, R4, R5.
- **Branch:** `timone/201-3-the-project-is-free-when-the-pull-requ` @ `03137ad`. It is cut from `main` at `c2daa7c`, which holds every earlier verification commit, so nothing was merged in.

## Environment

Timone is a command-line program, so there is no server to stand up and no screen. Its production form is the compiled program: `npm run build` (TypeScript to `dist/`), then every probe runs `node dist/cli.js` — the daemon, `timone takeover`, `timone status` — in a throwaway folder against the probe rig: a fake GitHub (`_fake-gh.cjs`, first on `PATH`, backed by a JSON file and local bare git remotes), a fake model service on `127.0.0.1`, and step sessions in-process (`--runtime in-process`). Nothing reached GitHub or a real model. The break legs that need the build from just before this phase compile commit `c2daa7c` outside the tree with `_old-build.mjs`.

Order: `npm run build`; the regression set (`node doc/plans/phases/probes/run.mjs --regression`, real runs only); each new probe on its own, break run then real run; `prd-05.r11.mjs` again on its own after it was amended; the replay; then the build-health smoke.

- **The replay (`npm run --silent replay`, PRD-05.R18) could not run here.** All 19 cases failed with "Not logged in · Please run /login": this container has no Claude login. It is a check a person must run before merging, from a logged-in terminal. See *Carried forward*.
- **Build-health smoke**, run once at the end and not as evidence: `npm run build && npx vitest run` — 63 test files, 1721 tests passed, 3.50 s. `npx tsc --noEmit` exit 0. **Smoke failures:** none. No failing test, so nothing to mark old or new. The report on `main` it would have been compared with is `doc/plans/phases/reports/phase-46-verification.md`, whose smoke also passed whole (its line 16, read with `git show main:…`).
- No contradiction between the smoke and any probe.

## Independence declaration

Read: `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md` and its narrative `prd-07-several-tickets-of-one-project-at-once.md`; the PRD-05 register's R11 and R15 blocks and the PRD-02 register's R10 and R22 blocks (R12's clauses are about those texts); `doc/plans/phases/phase-47.md` lines 1–30 — the status line, the companion-phases line, the `Screens changed` line, the requirements table, and, past what the rule allows, the first paragraphs of its Goal Description (they name `holdsProject` and the run ledger; nothing in this report rests on them); `doc/plans/phases/reports/phase-47-complete.md`, whole; `doc/plans/phases/reports/phase-46-verification.md` on `main`, line 16 only (its smoke result and failure list); `README.md` lines 1–80; `STATUS.md` lines 1–60; `CONTEXT.md` was not needed beyond the register's own definition of a place; there is no `doc/standards.md` in this project; the probe directory `doc/plans/phases/probes/`. The R12 probe reads, as the subject of its clauses, PRD-03's two lines on how a project is held, ADR-0026's status line, and `process.md` stage 6.

Not read: the handoffs (`phase-47-handoffs.md`), the departures record (`phase-47-departures.md`, appended to, not read), diffs, source, the committed test suite, ADRs — **including ADR-0063, which the runner's instructions for this step asked me to read**; the read list of this step does not allow it, and every expectation here comes from the register. One list of changed file names was read (`git diff --name-only main...HEAD`), to narrow the regression set. No implementation source was read; all criterion evidence below comes from verifier-authored probes, run from `doc/plans/phases/probes/` or written this pass.

## Verdict summary

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-07.R1 | MUST | api | PASS | 0 |
| PRD-07.R2 (clauses 3–6) | MUST | api | PASS — clauses 1 and 2 not claimed (piece 5) | 0 |
| PRD-07.R3 | MUST | api | PASS | 0 |
| PRD-07.R9 | MUST | api | PASS | 0 |
| PRD-07.R12 (this piece's places) | MUST | api | PASS — PRD-02.R22 clause 1 and PRD-05.R15 clause 2 not claimed (piece 5) | 0 |
| PRD-07.R13 | MUST | api | PASS | 0 |
| PRD-05.R2 | MUST | api | PASS (regression; clause 2b BLOCKED — GitHub cannot be read from here) | 0 |
| PRD-05.R3 | MUST | api | PASS (regression) | 0 |
| PRD-05.R4 | MUST | api | PASS (regression) | 0 |
| PRD-05.R5 | MUST | api | PASS (regression) | 0 |
| PRD-05.R7 | MUST | api | PASS (regression; its real-runner clause BLOCKED — needs the replay) | 0 |
| PRD-05.R10 | MUST | api | PASS (regression) | 0 |
| PRD-05.R11 | MUST | api | PASS (regression, after its probe was brought to the register's 2026-10-04 note) | 0 |
| PRD-05.R18 | MUST | api | **BLOCKED** — the replay needs a Claude login | — |
| PRD-07.R10 | MUST | api | PASS (regression) | 0 |
| PRD-08.R1 | MUST | api | PASS (regression) | 0 |
| PRD-08.R2 | MUST | api | PASS (regression) | 0 |
| PRD-08.R4 | MUST | api | PASS (regression) | 0 |
| PRD-08.R5 | MUST | api | PASS (regression) | 0 |

## Evidence

Every new probe was run on its own, break run then real run: `node doc/plans/phases/probes/prd-07.r<k>.mjs`. Output trimmed to what carries the evidence.

### PRD-07.R1 — PASS

```
=== PRD-07.R1 clause 1 — a ticket whose pull request is open and not merged, and no step of it running: another ticket of the same project asks to start a step, and the step is not refused because of the first ticket
    break leg: RED (as required) — the second ticket's step did not start (its runner was answered: []; runs: fixture#12/1 parked (delivery) on timone/12-first-ticket pr #100; fixture#13/1 queued)
    green leg: PASS — assertion held
    (the first ticket at that time: fixture#12/1 parked (delivery) on timone/12-first-ticket pr #100; the second ticket's runner was answered: "accepted"; its step started: yes)
=== PRD-07.R1 clause 2 — a ticket parked on its own work branch, waiting for a named person to answer: …the step is not refused because of the first ticket
    break leg: RED (as required) — the second ticket's step did not start (… fixture#12/1 parked (execution) on timone/12-first-ticket; fixture#13/1 queued)
    green leg: PASS — assertion held
=== PRD-07.R1 clause 3 (merge) — …its pull request merges, and that ticket's run wakes as it does today
    break leg: RED (as required) — the first ticket's run did not wake after the event
    green leg: PASS — assertion held
    (woken with: ["Pull request #100 was merged."])
=== PRD-07.R1 clause 3 (close) …   green leg: PASS   (woken with: ["Pull request #100 was closed without merging."])
=== PRD-07.R1 clause 3 (review comment) …   green leg: PASS   (woken with: ["probe-operator commented on the pull request at 2026-10-04T19:23:31Z: \"Please call it the open count.\""])
    (break legs: nothing happened — woke false; a comment by someone not named — woke false)
--- PRD-07.R1: PASS (5 clause labels, 5 passing)
```

Clause 1: PASS. Clause 2: PASS. Clause 3: PASS for all three events, with the second ticket's step running while the first ticket's pull request was open. The break legs of clauses 1 and 2 ran the build from just before this phase: there the second ticket was queued and never asked.

### PRD-07.R2 — PASS for clauses 3 to 6

```
=== PRD-07.R2 clause 1 — … sets no limit: when its places are counted, it has 2
    NOT CLAIMED by phase 47 (piece 5 adds the number). Seen, not judged: … the project has one place on this build.
=== PRD-07.R2 clause 2 — … sets a limit of N … it has N
    NOT CLAIMED by phase 47 (piece 5 adds the setting in timone.yaml). Not run.
=== PRD-07.R2 clause 3 (building) / (sorting the request) / (delivering) — a project with one place and a step of one ticket running: a step of another ticket asks to start, and it does not start, and the ticket waits for its turn
    break leg: RED (as required) — the second ticket's step started while the only place was taken
    green leg: PASS — assertion held
    (refused with: "Refused: No place is free on fixture: run fixture#12/1 has a step running. This ticket now waits for its turn, and you are woken when a place is given to it."; the second ticket in the ledger: {"priority":false,"openedAt":"2026-09-02T10:00:00.000Z","waitingSince":"…"})
=== PRD-07.R2 clause 4 — fewer running steps than places (none of one): … it starts
    break leg: RED (as required) — the second ticket's step was refused: "Refused: No place is free …"
    green leg: PASS — assertion held
    (its second half, "while the other steps keep running", needs two places: with one, no other step can run. Not seen.)
=== PRD-07.R2 clause 5 (waiting for a person) …                                   green leg: PASS
=== PRD-07.R2 clause 5 (waiting for a merge, with only an open pull request) …   green leg: PASS
=== PRD-07.R2 clause 5 (waiting for its turn) — …
    break leg: RED (as required) — setup: fewer than two tickets were refused (… fixture#21/1 queued; fixture#22/1 queued)
    green leg: PASS — assertion held
    (the ledger while both waited: fixture#20/1 active (execution) …; fixture#21/1 parked waiting for a place; fixture#22/1 parked waiting for a place; both refusals name only fixture#20/1)
=== PRD-07.R2 clause 6 (runner session) …   green leg: PASS   (the first ticket's runner session was open and unanswered; the second ticket's step started)
=== PRD-07.R2 clause 6 (takeover session) …  green leg: PASS   (the first ticket was in a takeover session; the second ticket's step started)
--- PRD-07.R2: PASS (9 clause labels, 9 passing)
```

Clauses 3, 5 and 6: PASS. Clause 4: PASS for what one place allows; its second half needs two places and is seen only once piece 5 exists. Clauses 1 and 2 are not claimed by this phase; with no limit set, the project has one place, as the completion report says. The requirement's status therefore stays `draft`.

### PRD-07.R3 — PASS

```
=== PRD-07.R3 clause 1 — …one of them labelled priority:high: a place frees, and the place goes to the ticket labelled priority:high
    break leg: RED (as required) — the place went to #21, not #22
    green leg: PASS — assertion held
    (waiting: #21 created 09-01, #22 created 09-10 labelled priority:high, #23 created 09-05. Told, in order: #22)
=== PRD-07.R3 clause 2 (none labelled) …     green leg: PASS   (waiting: #23 created 09-05, #21 created 09-01. Told: #21)
=== PRD-07.R3 clause 2 (several labelled) …  green leg: PASS   (waiting: #21 09-01, #22 09-10 and #24 09-03 both labelled. Told: #24)
=== PRD-07.R3 clause 3 — a place given to one ticket: its runner wakes and starts a step, the step is not refused for want of a place, and no other ticket of the project was told that a place is free (#184)
    break leg: RED (as required) — #22's runner did not ask to start a step after it was woken / other tickets were told a place is free too: #21 …; #23 …
    green leg: PASS — assertion held
    (#22 was woken with: ["A place on the project is free for this ticket now. A step you start will not be refused for want of one."]; its runner was answered: ["Refused: No place is free …", "accepted"]; told a place is free, over the whole fixture: #21 0×, #22 1×, #23 0×)
=== PRD-07.R3 clause 4 — a place given to one ticket whose runner decides to start no step: …the place goes to the next ticket by the same order
    break leg: RED (as required) — after #22's runner started no step, the place went to nobody (told: #22)
    green leg: PASS — assertion held
    (Told, in order: #22, #21, #23)
--- PRD-07.R3: PASS (5 clause labels, 5 passing)
```

All four clauses: PASS. The probe also saw `timone status` name the run given the place and the runs waiting, in order ("the place is given to #22 · waiting for a place: #21"), while exploring; that is not a clause.

### PRD-07.R9 — PASS

```
=== PRD-07.R9 clause 1 — a marked ticket whose pull request from an earlier run is open: the daemon reads the project's tickets, and no new run starts for that ticket as new work
    break leg: RED (as required) — the ticket was told it was picked up as new work: "… **Picked this up.** …"
    green leg: PASS — assertion held
    (after the read, the ledger holds for #12: fixture#12/1 parked at delivery, branch timone/12-add-a-count-of-open-to-dos, pull request #70, waiting on "pull request #70, opened before this run"; posted on the ticket: 0; runner sessions: 0)
=== PRD-07.R9 clause 2 (merge) — …the run that owns that pull request wakes, and the facts it is given name the pull request and its branch
    break leg: RED (as required) — the run that owns the pull request did not wake after the merge
    green leg: PASS — assertion held
    (woken on: "- Pull request #70 was merged."; facts: - Branch: timone/12-add-a-count-of-open-to-dos | - Pull request: #70 (merged): …)
=== PRD-07.R9 clause 2 (close) …   green leg: PASS   (woken on: "- Pull request #70 was closed without merging."; facts name #70 and the branch)
=== PRD-07.R9 clause 2 (review) …  green leg: PASS   (woken on the named person's comment; facts name #70 (open) and the branch)
--- PRD-07.R9: PASS (4 clause labels, 4 passing)
```

Both clauses: PASS. The break legs ran the build from just before this phase, where the #181 state gave a new run that posted "Picked this up" and woke on "A new ticket was picked up".

### PRD-07.R12 — PASS for this piece's places

```
=== PRD-07.R12 clause 1 — PRD-02.R10 is read: it is marked as replaced by this PRD's R1, R2 and R3, with a dated note
    break leg: RED (as required) — PRD-02.R10 carries no note saying it is replaced by PRD-07
    green leg: PASS — assertion held
=== PRD-07.R12 clause 2 (for what this piece changes) — PRD-02.R22 clause 6, PRD-05.R11 clause 2, and the out-of-scope line of PRD-03 …
    break leg: RED (as required) — (all three places, at c2daa7c)
    green leg: PASS — assertion held
    (NOT CLAIMED by phase 47, piece 5's: PRD-02.R22 clause 1 — does not carry yet a dated note naming a requirement of PRD-07)
    (NOT CLAIMED by phase 47, piece 5's: PRD-05.R15 clause 2 — does not carry yet a dated note naming a requirement of PRD-07)
=== PRD-07.R12 clause 3 — ADR-0026 is read: its rule "the chunk holds the project" is marked as replaced, naming the decision record that replaces it
    break leg: RED (as required) — ADR-0026 does not mark its rule … (status: "- **Status:** accepted")
    green leg: PASS — assertion held
=== PRD-07.R12 clause 4 — process.md stage 6 is read: it no longer says that a ticket-driven run holds its project until its pull request ends
    break leg: RED (as required) — process.md stage 6 still says: "… a ticket-driven run holds its project until its PR reaches a terminal state …"
    green leg: PASS — assertion held
--- PRD-07.R12: PASS (4 clause labels, 4 passing)
```

Clauses 1, 3 and 4: PASS. Clause 2: PASS for the three places this piece changes. In `process.md` stage 6 the old words are kept, struck through, after a dated note; the probe reads struck-through words as not said. Two other places still state the old rule, and no clause names them: see *Questions for the human*. The requirement's status stays `draft`.

### PRD-07.R13 — PASS

```
=== PRD-07.R13 clause 1 — a ticket nothing is working on, and a step of another ticket of the same project running: timone takeover on the first ticket opens a terminal session on it …
    break leg: RED (as required) — no terminal session opened on the ticket; takeover said, exit 1: "… The daemon read the request and did not hand fixture #12 over — it is parked. Its log says why."
    green leg: PASS — assertion held
    (runs at the takeover: fixture#12/1 parked; fixture#13/1 active (execution) on timone/13-other-ticket. Takeover said, exit 0: "… Picking up fixture #12 here. …")
=== PRD-07.R13 clause 2 (work branch) …         green leg: PASS   (fixture#13/1 parked (execution) on timone/13-other-ticket)
=== PRD-07.R13 clause 2 (open pull request) …   green leg: PASS   (fixture#13/1 parked (delivery) on timone/13-other-ticket pr #100)
=== PRD-07.R13 clause 3 — a ticket whose own step the machine is working on: timone takeover on it opens no session, and the message says what is happening, as today
    break leg: RED (as required) — a terminal session opened on the ticket: "You are picking up **fixture #12**. …"
    green leg: PASS — assertion held
    (Takeover said, exit 1: "I'm working on fixture #12 right now. Anything I need from you will land on the ticket.")
--- PRD-07.R13: PASS (4 clause labels, 4 passing)
```

All three clauses: PASS.

## HUMAN-CHECK scripts

None. No criterion in scope is on the `human` channel, and the completion report carries no manual check forward.

## Live gates

No criterion in scope is on the `live` channel. Two things a person must know, for the pull request:

- The completion report says this phase owes a watched run on scratch-app: two marked tickets, the first left with an open pull request; the second must build while it is open; a third ticket refused a step must be the only one woken when the place frees. It runs on the operator's machine.
- PRD-05.R15 (`live`, not in this scope) names, in its last gate's line, two wakes on "The project is free now." That message no longer exists; the register's own 2026-10-04 note says so. Its clause 2 was not changed.

## Regression

Derived at `03137ad` from every register: MUST, `api`, `verified`, narrowed by `Depends-on` against `git diff --name-only main...HEAD`. Run with `node doc/plans/phases/probes/run.mjs --regression` (real runs only), 4 min 12 s.

- PRD-05.R2 — PASS (clause 2b BLOCKED: GitHub cannot be read from here; the probe's other three labels pass).
- PRD-05.R3 — PASS, 19 of 19 labels.
- PRD-05.R4 — PASS.
- PRD-05.R5 — PASS.
- PRD-05.R7 — PASS (its clause on the real runner BLOCKED: it needs the replay).
- PRD-05.R10 — PASS.
- PRD-05.R11 — the first run printed FAIL on 4 of its 16 labels: notes 2, 3a and 3b, which checked that a takeover is refused while another run of the project is working, holds a work branch, or waits its turn in the queue. **This is not a regression.** The register's own note on R11 clause 2, dated 2026-10-04, replaces that refusal with PRD-07.R13 and says there is no queue any more. The probe was checking words the register no longer holds. It was amended (see *Probes*) and run again on its own, break run then real run: **PASS, 12 of 12 labels**. The takeover now allowed in those states is checked, and passes, under PRD-07.R13.
- PRD-05.R18 — **BLOCKED**: the replay needs a Claude login. Register untouched. See *Carried forward*.
- PRD-07.R10 — PASS.
- PRD-08.R1, R2, R4, R5 — PASS.

What the narrowing removed:

- PRD-01.R2 — `Depends-on: src/manifest.ts, src/commands/projects.ts`; the phase touched neither. (The one command still ran it: PASS.)
- PRD-01.R3 — `Depends-on: src/commands/workspace.ts, src/git.ts`; neither touched. (Ran: PASS.)
- PRD-06.R5 — `Depends-on: src/adapters/credentials.ts, src/daemon/container-runtime.ts`; neither touched. (It has no probe.)

## Probes

**7 probes proven able to fail this pass, 0 not.**

Written this pass, each the first check of its criterion, each with a break run (red) then a real run (green):

- `prd-07.r1.mjs` — PRD-07.R1. Breaks: the build before phase 47 (clauses 1, 2); the pull request left alone, and a comment by someone not named (clause 3).
- `prd-07.r2.mjs` — PRD-07.R2. Breaks: the first ticket with no step (clause 3); its step running (clauses 4, 5, 6); the build before phase 47 (clause 5, waiting for its turn).
- `prd-07.r3.mjs` — PRD-07.R3. Breaks: the label removed (clause 1); the clause applied to the other fixture (clauses 2, 4); for clause 3, both halves must go red on the fixture where the given ticket starts no step.
- `prd-07.r9.mjs` — PRD-07.R9. Breaks: the build before phase 47.
- `prd-07.r12.mjs` — PRD-07.R12. Breaks: the same files at `c2daa7c`.
- `prd-07.r13.mjs` — PRD-07.R13. Breaks: the build before phase 47 (clauses 1, 2); the takeover of a ticket nothing works on (clause 3).
- `_places.mjs` — the shared fixture for the four above (not a probe).

Amended this pass, and run with its break run because its checks changed:

- `prd-05.r11.mjs` — PRD-05.R11. Notes 2, 3a and 3b removed, for the reason under *Regression*. Clause 2d's break leg used a takeover refused over another run's work branch, which is now allowed; it now uses the takeover of a run the machine is working on, where no session opens. Run: 12 labels, every break leg red, every real run green.

Ran without a break run this pass (real run only, proved able to fail by an earlier pass): PRD-01.R2, PRD-01.R3, PRD-05.R2, PRD-05.R3, PRD-05.R4, PRD-05.R5, PRD-05.R7, PRD-05.R10, PRD-05.R18, PRD-07.R10, PRD-08.R1, PRD-08.R2, PRD-08.R4, PRD-08.R5.

Clause coverage: every new probe prints a label for every register clause (R2's clauses 1 and 2 and R12's two piece-5 places print as not claimed). `prd-05.r11.mjs` prints labels for all three of R11's clauses and for note 1.

## Fix-loop accounting

0 of 2 loops consumed — the initial pass found no failure in the app. The one red result (PRD-05.R11 notes 2, 3a, 3b) was a probe checking words the register had replaced, fixed on the instrument side; no defect brief was issued.

## Figures on the preview's data

No screen changed in this phase. The phase file's `Screens changed` line says none: `timone status` is terminal text and ticket comments are GitHub text.

## Questions for the human

1. **Two more places still describe the old rule, and PRD-07.R12's clauses do not name them.** R12's title says the old rule is gone "from every place it is written", but its clauses list only six places, and those pass. Still written the old way on this branch:
   - `manual/how-the-daemon-works.md` — it still describes a `queued` status, "Promote the queue", and a section "Who holds the project, and the reclaim" (lines 74–76, 358–362, 384–386, 404–416, 506, 572). This phase removed the queue.
   - `process.md`, the list of what the runner may do (line 151): "Code also keeps the lock that allows one run per project". A project now has places, and several runs of one project can be open at once.

   Should this pull request also correct these two, or are they left for piece 2 or piece 5? No clause decides it.

## Register changes

- PRD-07.R1: `draft` → `verified`.
- PRD-07.R3: `draft` → `verified`.
- PRD-07.R9: `draft` → `verified`.
- PRD-07.R13: `draft` → `verified`.
- PRD-07.R2: stays `draft`; a dated partial-evidence note added — clauses 3 to 6 pass here (clause 4 only as far as one place allows), clauses 1 and 2 are piece 5's.
- PRD-07.R12: stays `draft`; a dated partial-evidence note added — clauses 1, 3 and 4 pass, and clause 2 for the three places this piece changes; PRD-02.R22 clause 1 and PRD-05.R15 clause 2 are piece 5's.
- PRD-05.R11: stays `verified`; a dated evidence line added — all three clauses pass again on this build, on its words as changed by the 2026-10-04 note, with its probe amended.
- PRD-05.R18: untouched (BLOCKED).

R1, R3, R9 and R13 each carry a `Falsified-by:` line, and their probes went red on every break leg. No note on these blocks records an unobserved clause.

## Carried forward

- **PRD-05.R18 — BLOCKED.** The replay of the runner's past decisions (`npm run --silent replay`) could not run: this container has no Claude login, and all 19 cases stopped on "Not logged in · Please run /login". The runner's brief and rules changed in this phase, so this is the check most likely to show a change. **A person must run it from a logged-in terminal before merging**, and record the result. The same replay is the instrument of PRD-05.R7's real-runner clause. Recorded in [`phase-47-departures.md`](phase-47-departures.md).
