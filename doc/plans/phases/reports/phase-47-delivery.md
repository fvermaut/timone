# Phase 47 — Delivery Report

- **Date:** 2026-10-04
- **Phase:** [phase-47.md](../phase-47.md) — `Complete`, verified in [phase-47-verification.md](phase-47-verification.md)
- **Branch:** `timone/201-3-the-project-is-free-when-the-pull-requ` @ `d22ccbe` (before this report)
- **Base:** `main` — the project's default branch; the branch was cut from it (merge-base `c2daa7c`), not stacked. It is best merged after the pull request for [#200](https://github.com/fvermaut/timone/issues/200), which is not open yet: two open pull requests of one project can now both change `STATUS.md` or a register.
- **Pull request:** opened against this report, from the branch above to `main`; its address is posted on ticket #201.
- **Screen:** no user-facing screen in this phase — the phase file's `Screens changed` line says none. `timone status` is terminal text; ticket comments are GitHub text.
- **Questions for the human:** 1, quoted from the verification report's section of that name. The completion report and the departures record raise 3 more about the build; all 4 are carried in the pull request.
- **Departures:** [phase-47-departures.md](phase-47-departures.md) — 11 entries.

## Scope

A ticket takes a place on its project only while one of its steps runs, or while a freed place is given to it ([ADR-0063](../../../adr/0063-a-ticket-takes-a-place-only-while-one-of-its-steps-runs.md)). An open pull request, a wait for a person, a runner session and a takeover take no place. The project still has one place, so one step runs at a time, but a ticket with an open pull request no longer stops the next ticket from building. When the place frees, it goes to one waiting ticket, `priority:high` first, then the oldest, and only that ticket is woken. A marked ticket whose pull request is already open is followed, not picked up again as new work. A takeover is no longer refused because of another ticket. `timone status` lists the tickets that wait for the place. The old rule is struck, with dated notes, in PRD-02, PRD-03, PRD-05, ADR-0026, `process.md` and the charting instructions.

Claims PRD-07.R1, R2 (clauses 3 to 6; clauses 1 and 2, the number of places, are piece 5's), R3, R9, R12 (for the places this piece changes), R13 ([register](../../../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md)). Ticket: [#201](https://github.com/fvermaut/timone/issues/201), piece 3 of the list for [#197](https://github.com/fvermaut/timone/issues/197).

## How to try it

### Against the preview

Timone has no preview configured for pull requests (no `bindings.preview` in `timone.yaml`). Use the local steps below.

### On a local checkout

Install and build as the project's [README.md](../../../../README.md) says. Then, from the checkout of this branch:

1. `npm run build && npx vitest run` — 63 files, 1721 tests, all pass.
2. `npx tsc --noEmit; echo "exit: $?"` — prints `exit: 0`.
3. The checker's own scripts for PRD-07.R1, R2, R3, R9, R12 and R13 run the built daemon against a fake GitHub. Their commands are listed in [phase-47-verification.md](phase-47-verification.md) § Evidence. Each prints `PASS` for every claimed clause. What to look for: in R1, the second ticket's step starts while the first ticket's pull request #100 is open; in R3, the last line shows `#21 0×, #22 1×, #23 0×` — only one ticket was woken; in R9, nothing is posted on a ticket whose pull request is already open; in R13, `timone takeover` opens a session while another ticket of the project builds.
4. The replay against the real model (not run): `npm run --silent replay`, from a terminal logged in to Claude. Every case should pass.
5. The watched run on scratch-app (not run): two marked tickets, the first left with an open pull request. The second must build while that pull request is open. A third ticket refused a step must be the only one woken when the place frees.

## Verification outcome

Quoted from [phase-47-verification.md](phase-47-verification.md). Loops consumed: 0 of 2.

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

The verification gate did not pass in full: PRD-05.R18 is BLOCKED because the replay needs a Claude login, and the checking machine had none. Nothing was observed wrong. Whole suite: 63 files, 1721 tests passed; `tsc --noEmit` exit 0.

### Outstanding for the human

- [ ] PRD-05.R18 — the replay against the real model was **not run**: run `npm run --silent replay` from a terminal logged in to Claude, and record the result, before merging. The runner's brief and rules changed in this phase, so this is the check most likely to show a change.
- [ ] Live gate owed (phase file, *What this phase owes before delivery*; PRD-02 R1, R2, R4, R8 and PRD-05 R9, R12, R15 depend on what changed): the watched run on scratch-app in step 5 above. Run it, and commit its report, before merging.
- [ ] Answer the four questions below.

### Questions carried to the pull request

1. **From the verification report.** Two more places still describe the old rule, and PRD-07.R12's clauses do not name them: `manual/how-the-daemon-works.md` (a `queued` status, "Promote the queue", and the section "Who holds the project, and the reclaim"), and `process.md` line 151 ("Code also keeps the lock that allows one run per project"). Should this pull request also correct them, or are they left for piece 2 or piece 5?
2. **From the build (47d).** Should the new call that lists open pull requests refuse a full page of 200, as the ticket listings do? Today a ticket whose pull request falls off that page would be picked up as new work.
3. **From the build (47d).** Should a step ticket that is followed because its pull request is open get the hold label a pickup puts on it? Today its live run alone stops a second pickup.
4. **From the build (47c).** When a given place is not used, the next waiting ticket is woken one daemon tick later, not in the same tick. Is that delay acceptable?

## Standards review — phase 47

- **Read:** `git diff c2daa7c...HEAD -- src/` (all 27 files) and the current content of the touched lines in `src/daemon/runs.ts`, `src/runner/session.ts`, `src/runner/actions.ts`, `src/commands/status.ts`, `src/commands/takeover.ts`, `src/daemon/poll.ts`, `src/daemon/step-session.ts`. Also timone's `standards/code-smells.md`, `standards/typescript.md`, `standards/testing.md`, the project's `tsconfig.json` (`strict`, no lint or format config) and `package.json` (scripts: `tsc`, `vitest`). The project has no `doc/standards.md`.
- **Diff:** `c2daa7c...d22ccbe` — 27 files under `src/`, +2559/−653
- **Findings:** 3

### 1. The runner spots a "no place" refusal by matching the start of an error message — duplicated decision held as a magic string

- **Where:** `src/runner/session.ts:241–247` and `src/runner/session.ts:280–286`. These depend on `src/daemon/runs.ts:60–63` and `src/runner/actions.ts:485–490`.
- **What:** `runs.ts` writes the wording once: `` super(`No place is free on ${project}: ${whoTakesThePlace(holder)}.`) ``. `actions.ts` creates an error object only to read its text: `` `${new NoPlaceError(deps.project.name, holder).message} This ticket now waits…` ``. It then returns a plain `{ ok: false; refused: string }`. `session.ts` writes the same prefix a second time, `` return `No place is free on ${project}:`; ``, and checks for it with `result.refused.startsWith(noPlaceRefusal(actionDeps.project.name))`. Three modules share one sentence, and the only link between them is that its text matches.
- **Why it matters:** Duplicated code (a repeated one-liner is a duplicated decision), Magic string, and `typescript.md` "States are discriminated unions". Whether the refusal was for want of a place is a state, but it is carried as prose. If someone rewords the `NoPlaceError` message, `refusedForPlace` silently stays `false` and `freePlace` gives up the run's turn. No compiler error and no test failure in the sentence itself would warn them.
- **Suggested remediation:** Give the `startStep` refusal a tag, for example `{ ok: false; refused: string; reason: "no-place" | … }`, set in `noPlace`, and have `session.ts` check `reason`. Export a message function from `runs.ts` rather than building an error object only to read its `.message`. — not applied here

### 2. The rule for "who holds the place" is written twice, and the copy lives outside the ledger — duplicated code / inappropriate intimacy

- **Where:** `src/runner/session.ts:612–620` (`placeOf`), and `src/daemon/runs.ts:1397–1404` (`placeTakenFrom`).
- **What:** `runs.ts` decides: `const given = others.find((other) => other.place?.givenAt !== undefined); if (taking.length < PLACES_PER_PROJECT && given === undefined) return undefined; return given ?? taking[0];`. `session.ts` rebuilds the same decision from the outside, and to do it imports `PLACES_PER_PROJECT`: `const holder = holders.find((one) => one.place?.givenAt !== undefined) ?? holders[0]; if (holder === undefined || holders.length < PLACES_PER_PROJECT) return { kind: "free" };`. The two versions already differ. The ledger treats a place given to another run as blocking whatever the count is. The brief uses only the count. Separately, the test `place?.givenAt !== undefined` appears 11 times in non-test source, across `runs.ts`, `session.ts`, `driver.ts` and `status.ts:434`.
- **Why it matters:** Duplicated code (rule of three on a one-line decision), Inappropriate intimacy, and Feature envy. The `RunStore` doc comment says "a rule about a shared resource that lives in the caller is a rule the next caller will not know about". `placeOf` is exactly that kind of caller-side copy. Once `PLACES_PER_PROJECT` is read from `timone.yaml`, the two copies can give different answers about whether a place is free.
- **Suggested remediation:** Add a `RunStore` method that returns the place as one run sees it (given / free / taken by / given to), built on `placeTakenFrom`. `placeOf` would then only map it to `PlaceFact`. Add a small exported `isGivenPlace(run)` helper next to `takesPlace` for the repeated `givenAt` test. — not applied here

### 3. `claim` and `transition` take a `takeover` flag that turns the place rule off — flag parameter

- **Where:** `src/daemon/runs.ts:813–835` and `src/daemon/runs.ts:1347–1362`.
- **What:** `claim(id: string, holder?: Holder, options: { takeover?: boolean } = {})` passes `{ takeover: options.takeover === true }` on to `transition(…, options: { takeover?: boolean } = {})`. There it sets `run.takenOver = true` and skips the `NoPlaceError` check. Two callers pass `{ takeover: true }` (`src/commands/takeover.ts:487`, `src/daemon/poll.ts:690`). The one other caller (`src/daemon/step-session.ts:123`) does not.
- **Why it matters:** Flag parameter. A boolean switches what the function does: one call asks for a place, the other marks the run and does not ask. The generic `transition` now also carries a takeover-only concern. A future caller reading `claim(id, holder)` cannot tell that it is taking the place-checked path.
- **Suggested remediation:** Split it into two named entry points, for example `claim(id, holder)` and `claimForTakeover(id, holder)`. The second sets `takenOver` in its `apply` callback before a transition that skips the place check, so the flag no longer passes through `transition`. — not applied here

## Spec review — phase 47

- **Read:** the diff `c2daa7c...HEAD` for `src/` (runs.ts, poll.ts, session.ts, driver.ts, actions.ts, brief.ts, step-session.ts, steps.ts, takeover.ts, cancel.ts, daemon.ts, status.ts, github-tickets.ts, ticketing.ts, replay/recording.ts), `process.md`, `doc/adr/0026-…`, `.claude/skills/timone-wayfind/SKILL.md`, `CONTEXT.md`, and the changed lines of the PRD-02 pair, PRD-03, the PRD-05 criteria (R11, R15) and the PRD-07 pair. Also the D2 and consequence lines of `doc/adr/0063-…`, a few test names in `src/daemon/runs.test.ts` and `src/runner/session.test.ts`, and `phase-47.md` from the top through the end of the Requirements table. The checker's own scripts were not read: a guard refused the read. This review does not cover them.
- **Diff:** `c2daa7c...d22ccbe` — 52 files, +4876/−759
- **Findings:** 2

### 1. A ticket waiting for its turn loses the turn after any wake in which no step is tried — PRD-07.R2 (clause 3), PRD-07.R3

- **Where:** `src/runner/session.ts:305–317`, with `src/daemon/runs.ts:872–881`
- **What:** After every wake that ends normally, `freePlace` calls `if (end.kind === "ended") deps.store.leaveTurn(runId);`. The only exception is a wake in which a try to start a step was refused for want of a place. `leaveTurn` clears `place.waitingSince`, so the run leaves the waiting list. Example:
  1. Ticket B tries a step, is refused, and waits. B's runner was told "This ticket now waits for its turn, and you are woken when a place is given to it" (`actions.ts:489`).
  2. A person then comments on B. B's runner wakes.
  3. The brief says the place is "taken" or "given to …". The runner starts no step and posts that B waits.
  4. The wake ends, and `leaveTurn` takes B out of the waiting list.
  5. When the place frees, `givePlaces` finds nobody waiting. B is never told, and it stays stalled until something else wakes it.

  The tests cover a given place left unused (R3 clause 4) and a try refused in the same wake. No test covers a waiting run woken by something else.
- **Why it matters:** PRD-07.R2 clause 3 says that with every place taken, the ticket "waits for its turn". PRD-07.R3 says a freed place goes to the waiting ticket that is first in the order. Here a waiting ticket drops out of that order without a word, and the promise made to its runner is broken. ADR-0063 D2 says the same thing as the code ("When the runner's wake ends with no step started and no try refused, the run stops waiting"), so the gap is in the decision as well as in the code.
- **Suggested remediation:** Let a wake that ends with no step make the run leave its turn only when the place had been given to it. A run that was only waiting (`waitingSince` set, `givenAt` unset) keeps waiting. Or let the runner say that it gives up its turn. Add a test: a waiting run, woken by a comment, ends its wake with no try, and is still in `waitingForPlace` afterwards. — not applied here

### 2. After a step ends, the run keeps the place for the whole runner session that follows — PRD-07.R2 (clauses 5 and 6)

- **Where:** `src/daemon/runs.ts:1368–1388`, with `src/runner/driver.ts:893–914` (`afterStep`)
- **What:** `const stepEnds = run.status === "active" && run.takenOver !== true;` then `if (next === "parked" && stepEnds && run.place !== undefined) { run.place.waitingSince = this.now(); }`, and then `givePlaces`. A run whose step has just ended is put back on the waiting list. When nobody comes before it in the order, it is at once given the place (`givenAt`), and `takesPlace` counts that. The run keeps it while its runner session decides what to do next. ADR-0063 says so under its consequences: "A given place can sit unused for one runner session … No other step starts on the project meanwhile."
- **Why it matters:** PRD-07.R2 clause 6 says a runner session running for a ticket takes no place. Clause 5 says a ticket waiting for its turn takes none. In this design, the project's one place is in practice held through the runner session after each step, and another ticket's step is refused during that time. The ADR records this cost, but the criterion it claims to meet does not allow it. The register shows clauses 5 and 6 as passed.
- **Suggested remediation:** Either amend PRD-07.R2 clause 6, through the requirements stage, so it allows a place to be kept between a ticket's own steps. Or stop giving the place to the run whose step just ended, so the runner's next try competes like any other. Whichever is chosen, the register and ADR-0063 should agree. — not applied here

## Notes

- The standards review was started twice. A guard refused its first start because its read list named the checker's scripts; the second start read only `src/`, and its report is the one above. The spec review did not read those scripts either.
- Merge order: best after the pull request for #200 (piece 2 of the list), which is not open yet. The two share no source file; both may change `STATUS.md` or a register.
- Prerequisites absent where this was delivered: a Claude login (the replay) and the operator's machine (the watched run).
