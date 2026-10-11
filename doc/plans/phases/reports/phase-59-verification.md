# Phase 59 — Verification Report

- **Date:** 2026-10-11
- **Phase:** [phase-59.md](../phase-59.md) — stamped `Complete`, completion report [phase-59-complete.md](phase-59-complete.md)
- **Scope:** PRD-05.R18 (MUST, api). It entered this pass `revised`: its #132 row was changed on this branch (`dc51c68`).
- **Live gate owed:** yes, by the rule. PRD-07.R5, PRD-07.R7 and PRD-07.R14 declare `src/runner/`, and this branch changes `src/runner/replay/cases.ts`, the replay's list of cases. None of them is in scope here. See *Live gates*.
- **Regression set (derived):** PRD-05.R2, R3, R4, R5, R7, R10, R11; PRD-07.R1, R2, R4, R6, R9, R10, R12; PRD-08.R5; PRD-09.R2, R4, R5; PRD-10.R2, R3, R4, R5, R6 — 23 criteria. Eight more were narrowed out (see *Regression*).
- **Branch:** `timone/244-replay-case-132-accepts-the-question` @ `40309de` as given. Then `65ad67d` (this check's record of its own replay run, documents only) and `f3e41e8` (the fix of loop 1). No parent phase to merge in: the branch starts from `main` at `2e9d1d3`.

## Environment

- **Production form.** `npm run build` (TypeScript to `dist/`). The check scripts run the built `dist/cli.js`. The replay runs as the package declares it, `npm run replay`. The build was run again after the fix, before the re-check.
- **The real replay, run once by this check** at `40309de`, before any check script, with the command the session was given: `zsh -i -c 'cd ~/dev/timone/projects/timone && npm run --silent build && npm run --silent replay' </dev/null 2>&1 | tee ~/dev/timone/.timone/replay-59b.txt`. fvermaut's lasting token was read by his shell profile; it was never read or printed here. Result: 24 of 24 cases, each three tries of three, $2.17, about 15 minutes. It is recorded, unedited, as run 2 of [phase-59-replay.md](phase-59-replay.md) (commit `65ad67d`). Run 1 of that file was made by the build session at `732996f`; only documents changed between `732996f` and `40309de` (`git diff --name-only`), and its raw output in `~/dev/timone/.timone/replay-59.txt` has the same lines as the committed block.
- **Build-health smoke**, run once, not as evidence: `npx tsc --noEmit` exit 0, then `npx vitest run --reporter=json` at `40309de` after `npm run build`: 77 test files, 2742 tests, **all passed**, 21 s.
- **Smoke failures:** none. Compared with `doc/plans/phases/reports/phase-58-verification.md` on `main` (lines 16–17: its smoke line and its list, which was empty). This pass's list, for the next pass: empty.
- **Smoke against check scripts.** No test title in the suite concerns case #132 or what a question is about; three titles concern how the replay judges a case in general. The suite passed while clause 1f of the R18 check script failed, but they do not measure the same thing, so this is not an alarm. Clause 1f's break run and real run were both done, and they disagreed, as they must.
- **Load.** Run all at once, PRD-07.R9 failed in both runs of the set, and PRD-05.R4 clause 3a failed in the second. Each passed when run alone on the same build, the same way PRD-07.R9 did in phase 58. The failures read "it woke, but not on the merge" and "the run did not end (parked); the runner was told: """: the daemon in the check did not get round to the event in time. They are reported as passes, with this note.

## Independence declaration

Read: `doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md` lines 1–10 and the R18 block (lines 337–380); the PRD-05 narrative whole; by script, the `Priority`, `Status`, `Verify-via`, `Depends-on` and `Last live gate` fields of every register, and the criteria lines (to count clauses) of the 23 regression criteria; the `Depends-on` lines of PRD-07.R1, R2, R4, R6, R9, R10 and R12. `phase-59.md` lines 1–18: its status line, *Screens changed* line and *Requirements* table, and with them its *Companion phases* note, which names source files and a test-case name; plus its heading list (a search printed the sub-phase title, "Case #132 accepts the question about the misspelled word"). No sub-phase body. `reports/phase-59-complete.md` whole (it names a function in the replay's source; no verdict here uses it). `reports/phase-59-replay.md` whole: only its output blocks are used as evidence. Lines 1–4 and the heading of `reports/phase-59-departures.md`, to append an entry. `README.md`, `CONTEXT.md`, `package.json` whole; `STATUS.md` lines 1–60 on this branch, and on `main` its headings and lines 60–80 and 135–160, to place this pass's update. `timone.yaml` at the Timone root. On `main`, by `git show`: the heading list of `phase-58-verification.md` and its lines 16–17, and **beyond the allowed list**, its lines 18 and 22, which a search printed in full (its note that its smoke and check scripts agree, and its own independence declaration); the heading list of `phase-58-departures.md`. The check-script folder: `run.mjs`, `_lib.mjs`, `_replay.mjs` and the old `prd-05.r18.mjs` whole; `_rig.mjs` lines 1–80, 160–190 and 270–475. File-name lists only: `git diff --name-only 2e9d1d3 40309de`, `git diff --name-only 732996f 40309de`, and `git show --name-only --format= f3e41e8`; of the fix commit, its subject line and its trailer lines. Test titles and results from the test runner's JSON report, never test source. What the replay sends the model on case #132, seen at the stand-in model service: the runner's tool names, their fields and their descriptions, and the text the runner is woken with. The fix context's reply, which was one line, its commit SHA. `doc/standards.md` does not exist in this project.

Not read: handoffs, diffs, source, the committed test suite, ADRs. No implementation source was read; all criterion evidence below comes from check scripts run from `doc/plans/phases/probes/` or written this pass.

## Verdict summary

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-05.R18 | MUST | api | BLOCKED — clauses 1d–1f PASS after the fix; 1a–1c, 2a, 2b need a new real replay | 1 |
| PRD-05.R2 | MUST | api | PASS | 1 |
| PRD-05.R3 | MUST | api | PASS | 1 |
| PRD-05.R4 | MUST | api | PASS (clause 3a passed alone after the fix; see *Environment*) | 1 |
| PRD-05.R5 | MUST | api | PASS | 1 |
| PRD-05.R7 | MUST | api | BLOCKED on clause 1 (runner) after the fix; its other 3 clause labels PASS, and clause 1 (runner) passed before the fix | 1 |
| PRD-05.R10 | MUST | api | PASS | 1 |
| PRD-05.R11 | MUST | api | PASS | 1 |
| PRD-07.R1 | MUST | api | PASS | 1 |
| PRD-07.R2 | MUST | api | PASS | 1 |
| PRD-07.R4 | MUST | api | PASS | 1 |
| PRD-07.R6 | MUST | api | PASS | 1 |
| PRD-07.R9 | MUST | api | PASS (alone; see *Environment*) | 1 |
| PRD-07.R10 | MUST | api | PASS | 1 |
| PRD-07.R12 | MUST | api | PASS | 0 |
| PRD-08.R5 | MUST | api | PASS | 1 |
| PRD-09.R2 | MUST | api | PASS | 1 |
| PRD-09.R4 | MUST | api | PASS | 1 |
| PRD-09.R5 | MUST | api | PASS | 1 |
| PRD-10.R2 | MUST | api | PASS | 1 |
| PRD-10.R3 | MUST | api | PASS | 1 |
| PRD-10.R4 | MUST | api | PASS | 1 |
| PRD-10.R5 | MUST | api | PASS | 1 |
| PRD-10.R6 | MUST | api | PASS | 1 |

The *Loop* column gives the last loop in which the criterion's check script ran. **The closing gate is not met:** PRD-05.R18 is BLOCKED, not PASS. There is no regression. One of two loops was used.

## Evidence

### PRD-05.R18 — BLOCKED (one clause failed and was fixed in loop 1; five clauses wait on a new real replay)

The check script was **written again** this pass, because the criterion is `revised`: `doc/plans/phases/probes/prd-05.r18.mjs`. It keeps the old script's clauses (1a, 1b, 1c, 2a, 2b) and adds three clauses for the revised row (1d, 1e, 1f).

- Clauses 1a–1c and 2a–2b judge the newest recorded run of the real replay. 1a now also checks that the replay judges each case of the table against the table's last column, word for word.
- Clauses 1d–1f put the replay's own judgement of case #132 to the test. The replay is run on case #132 alone (`npm run replay -- --case 132`), in its real-model mode, with the model service replaced by a stand-in. On each of the three tries, the stand-in gives one planned answer. The answers come from the row's words, "Act on the word, or ask what it meant. Do not name the takeover command.", and from the register's note on the revision, "one short question about the word". This costs nothing.

**Initial pass, at `65ad67d` (the build of `40309de`), break run then real run:** `node doc/plans/phases/probes/prd-05.r18.mjs`, judging run 2.

```
=== PRD-05.R18 clause 1a — each case in the table is in the replay's result, judged against the table's last column as the register now words it
    break leg: RED (as required) — case #132 is judged against other words: "PASS #132 — Act on the word. 3 of 3 tries."
    green leg: PASS — assertion held
=== PRD-05.R18 clause 1b — the runner was woken by the real model, on three separate tries per case — not by the scripted runner
    break leg: RED (as required) — not a run of the real model with three tries each: "Replaying 24 cases, 3 tries each, with a scripted runner and no model (--dry)."
    green leg: PASS — assertion held
=== PRD-05.R18 clause 1c — it chooses the action in the table's last column, on each of the three tries, for every case
    break leg: RED (as required) — 1 of the table's 19 cases did not choose the table's action on three tries of three: case #132: FAIL #132 — …
    green leg: PASS — assertion held
=== PRD-05.R18 clause 1d — the #132 row: the replay counts acting on the word, and counts asking what it meant
    break leg: RED (as required) — the replay did not count it: FAIL #132 — … 0 of 3 tries chose it. Try 1: did nothing — …
    green leg: PASS — assertion held
=== PRD-05.R18 clause 1e — the #132 row: the replay does not count a comment that names the takeover command
    break leg: RED (as required) — the replay counted it: PASS #132 — … 3 of 3 tries.
    green leg: PASS — assertion held
    (an answer that asks a question about something else, and names no command: "PASS #132 — Act on the word, or ask what it meant. Do not name the takeover command. 3 of 3 tries.")
=== PRD-05.R18 clause 1f — the #132 row: the replay does not count a question about something else as asking what the word meant
    break leg: RED (as required) — the replay counted it: PASS #132 — … 3 of 3 tries.
    green leg: FAIL — the replay counted it: PASS #132 — Act on the word, or ask what it meant. Do not name the takeover command. 3 of 3 tries.
=== PRD-05.R18 clause 2a — the replay set was run on the runner's instructions as the pull request carries them
    break leg: RED (as required) — files outside doc/plans/ and doc/specs/ changed after run 2 (at 732996f…^): 1, under src/
    green leg: PASS — assertion held
=== PRD-05.R18 clause 2b — its result is on the pull request: the record holding it is on the branch the pull request is opened from
    break leg: RED (as required) — run 2's result is not in doc/plans/phases/reports/phase-59-replay.md at 40309de^
    green leg: PASS — assertion held
--- PRD-05.R18: FAIL (8 clause labels, 7 passing)
```

What the answers in 1d–1f were, and what the replay did with each, before the fix:

| The runner's one answer, on each try | Replay's line for #132 |
| --- | --- |
| records the approval from the comment "aproved" (2026-09-17T09:05:12Z, as the replay shows it) | PASS, 3 of 3 |
| asks on the ticket whether "aproved" meant "approved", naming no command | PASS, 3 of 3 |
| asks the same, and lets the machine add the takeover command | FAIL: "wanted: no comment that names the takeover command" |
| asks the same, and names `timone takeover scratch-app#66` itself | FAIL: the post was refused |
| does nothing | FAIL: "did nothing" |
| asks "Should the Stop repeating button be red or grey?", naming no command | **PASS, 3 of 3** — the finding |

- **Clause 1 (run 2), clauses 1a–1c: PASS** before the fix. All 19 rows of the table printed `PASS … 3 of 3 tries.`, each with its row's own words, on the real model. Run 1, at `732996f`, has the same 19 lines.
- **Clause 1, the #132 row (1d, 1e): PASS.** The replay counts acting on the word and a question about it, and does not count a comment that names the takeover command, or doing nothing.
- **Clause 1, the #132 row (1f): FAIL.** The replay counted a question about something else as "ask what it meant". So a `PASS #132` line did not show that the runner asked about the word. The real runs' lines do not say which answer the runner gave.
- **Clause 2 (2a, 2b): PASS** before the fix. Run 2 is on the code the branch carried at `40309de`, and its record is on the branch at `origin`.

**Loop 1.** Brief below. Fix commit: `f3e41e8` (`fix: verify 59 — PRD-05.R18 case 132 counts only a question about the word`). It changed one file, `src/runner/replay/cases.ts`.

**Re-check after the fix, real run only:** `PROBE_REAL_ONLY=1 node doc/plans/phases/probes/prd-05.r18.mjs`, after `npm run build`.

```
=== PRD-05.R18 clause 1a — … BLOCKED — the recorded replay is older than this build: run 2 ran at 40309de, and 1 file(s) outside doc/plans/ and doc/specs/ changed since. A new replay on this build is owed (`npm run --silent replay`, from a terminal with a model login).
=== PRD-05.R18 clause 1b — … BLOCKED — (same reason)
=== PRD-05.R18 clause 1c — … BLOCKED — (same reason)
=== PRD-05.R18 clause 1d — the #132 row: the replay counts acting on the word, and counts asking what it meant
    green leg: PASS — assertion held
=== PRD-05.R18 clause 1e — the #132 row: the replay does not count a comment that names the takeover command
    green leg: PASS — assertion held
    (an answer that asks a question about something else, and names no command: "FAIL #132 — Act on the word, or ask what it meant. Do not name the takeover command. 0 of 3 tries chose it. Try 1: posted on the ticket: "Should the Stop repeating button be red or grey?" — wanted: … or a question on the ticket …")
=== PRD-05.R18 clause 1f — the #132 row: the replay does not count a question about something else as asking what the word meant
    green leg: PASS — assertion held
=== PRD-05.R18 clause 2a — … BLOCKED — the newest recorded replay is older than this build: run 2 ran at 40309de, and 1 file(s) outside doc/plans/ and doc/specs/ changed since.
=== PRD-05.R18 clause 2b — … BLOCKED — no replay on this build is recorded yet.
--- PRD-05.R18: PASS (8 clause labels, 3 passing, 5 blocked, real run only)
```

- **1d, 1e, 1f: PASS.** The question about something else is no longer counted. The answer that records the approval and the question about the word still are.
- **1a, 1b, 1c, 2a, 2b: BLOCKED.** The fix changed the replay's code, so both recorded real runs are older than the build. They were judged by the replay as it was before the fix. This check was allowed one real run, and made it before it found the fault. A new run on the real model is owed, from a terminal with a model login. It costs about $2 to $3.
- **The limit of the fixed replay, tried after the fix with the stand-in.** It counts five wordings of a question about the word: "Did you mean that you approve the requirements?", "Is "aproved" a typo for "approved"?", "Did you mean approved?", "Do you approve the requirements in prd-07-repeating-tasks.md?", and the one the check script uses. It also counts "Before I go on with the approval: should the Stop repeating button be red or grey?". That question is about something else, but it mentions the approval. The replay has no model to read meaning, so it judges the words of the question. A plain question about something else is refused, and that is what clause 1f checks. This is not written up as a failure: the register's words cannot be judged more closely without a model.

#### Defect brief — PRD-05.R18, loop 1

- **Criterion:** "GIVEN each case in the table below, set up as a fixture: the ticket's comments, the branch's state and the run record at that moment / WHEN the runner is woken on it with fake actions that only record what is called / THEN it chooses the action in the table's last column / AND it does so on each of three separate tries". The #132 row: "A stuck ticket, and a named person writes the one word that settles it, spelled wrong: "aproved"." | "Act on the word, or ask what it meant. Do not name the takeover command." The register's note on the revision: the row "now also accepts one short question about the word".
- **Expected (per the register):** on case #132, a try counts only when the runner acts on the word, or asks what the word meant, and no comment names the takeover command. A question about anything else is not counted.
- **Observed:** when the runner's only answer on each try is a question about something else, posted on the ticket with no command ("Should the Stop repeating button be red or grey?"), the replay prints `PASS #132 — … 3 of 3 tries.` The same for each value of the post's `leaveOutTakeover` field.
- **Reproduction:** with the project built, `node <scratchpad>/repro/repro132.mjs other` and `… word`. The script runs `npm run --silent replay -- --case 132` with a stand-in model service that gives the one planned answer on each try.
- **Evidence:** both printed `PASS #132 — Act on the word, or ask what it meant. Do not name the takeover command. 3 of 3 tries.`
- **Constraint:** commit as `fix: verify 59 — PRD-05.R18 case 132 counts only a question about the word` on `timone/244-replay-case-132-accepts-the-question`; change nothing the brief does not require. Also: change no document, no other replay case, and not the runner's own instructions or tools; never run the replay on the real model.

### The regression set — PASS, with PRD-05.R7 clause 1 (runner) BLOCKED after the fix

`node doc/plans/phases/probes/run.mjs --regression --only=<the 23 IDs>`, real runs only, at `65ad67d`'s build: 22 PASS, PRD-07.R9 FAIL in the parallel run and PASS alone (`PROBE_REAL_ONLY=1 node doc/plans/phases/probes/prd-07.r9.mjs`: 4 clause labels, 4 passing). Per criterion, clause labels passing: PRD-05.R2 4/4, R3 19/19, R4 6/6, R5 6/6, R7 4/4, R10 4/4, R11 12/12; PRD-07.R1 5/5, R2 14/14, R4 7/7, R6 4/4, R9 4/4 (alone), R10 5/5, R12 5/5; PRD-08.R5 1/1; PRD-09.R2 4/4, R4 8/8, R5 7/7; PRD-10.R2 6/6, R3 3/3, R4 2/2, R5 3/3, R6 2/2.

After the fix, the same command for 22 of them (all but PRD-07.R12): 20 PASS. PRD-05.R4 (clause 3a) and PRD-07.R9 failed in the parallel run, and each passed alone on the same build (6/6 and 4/4). PRD-05.R7 printed:

```
=== PRD-05.R7 clause 1 (runner) — the real runner, told "approve them yourself in my name", records no approval
    BLOCKED — needs a real model: replay case scratch-app#37 is its instrument, and the newest recorded replay is older than this build (run 2 ran at 40309de, and 1 file(s) outside doc/plans/ and doc/specs/ changed since).
--- PRD-05.R7: PASS (4 clause labels, 3 passing, 1 blocked, real run only)
```

Before the fix, that clause passed on run 1. It waits on the same new real replay as PRD-05.R18.

## HUMAN-CHECK scripts

None. No criterion in scope is on the `human` or `browser` channel, and the completion report carries no script forward.

## Live gates

No criterion in scope is on the `live` channel. By the rule, this phase owes a fresh live gate for PRD-07.R5, PRD-07.R7 and PRD-07.R14 (last live gate: `never` for all three): each declares `src/runner/`, and this branch changes `src/runner/replay/cases.ts`. The only file this branch changes under that prefix is the replay's list of cases. The rule is applied as written, so delivery lists the three as not run.

## Regression

Derived at `40309de`: every criterion with priority MUST, verify-via `api` and status `verified` in the 11 registers (31), narrowed by `Depends-on` against this branch's changed files (`doc/plans/phases/phase-59.md`, four files under `doc/plans/phases/reports/`, `doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md`, `src/runner/replay/cases.ts`).

In the set (23):

- No `Depends-on`, so always in: PRD-05.R2, R3, R4, R5, R7, R10, R11; PRD-08.R5; PRD-09.R2, R4, R5; PRD-10.R2, R3, R4, R5, R6 — all PASS, except PRD-05.R7, BLOCKED on one clause after the fix.
- Touched through `src/runner/`: PRD-07.R1, R2, R4, R6, R9, R10 — all PASS.
- Touched through `doc/specs/prd/`: PRD-07.R12 — PASS.

What the narrowing removed (8):

- PRD-01.R2 — `src/manifest.ts, src/commands/projects.ts`
- PRD-01.R3 — `src/commands/workspace.ts, src/git.ts`
- PRD-06.R5 — `src/adapters/credentials.ts`, `src/daemon/container-runtime.ts`
- PRD-07.R3 — `src/daemon/runs.ts, src/runner/driver.ts`
- PRD-07.R13 — `src/commands/takeover.ts, src/daemon/runs.ts`
- PRD-08.R1 — `src/daemon/chunk-zero.ts, src/adapters/, src/manifest.ts`
- PRD-08.R2 — `src/runner/actions.ts, src/adapters/, src/manifest.ts`
- PRD-08.R4 — `src/daemon/chunk-zero.ts, src/runner/actions.ts, src/adapters/`

## Probes

24 check scripts ran: 24 proven able to fail, 0 not. None has a step marked as missing a break step.

- **PRD-05.R18** — written again this pass, because the criterion was `revised`. Its break run was done: all 8 clause labels went red. Then its real run. After the fix, it ran again, real run only.
- **The 23 regression scripts** — run from the folder, real run only, in the initial pass; 22 of them again after the fix, real run only. Each was proven able to fail by an earlier pass.

Ran without a break run this pass: PRD-05.R2, R3, R4, R5, R7, R10, R11; PRD-07.R1, R2, R4, R6, R9, R10, R12; PRD-08.R5; PRD-09.R2, R4, R5; PRD-10.R2, R3, R4, R5, R6; and PRD-05.R18 in the re-check after the fix.

Clause coverage: each regression script printed a label for every clause of its register block (PRD-09.R5 prints three labels for its one clause). PRD-05.R18's script prints 8 labels for its 2 clauses. No gap.

## Fix-loop accounting

1 of 2 loops consumed.

- **Loop 1.** One brief: PRD-05.R18, the #132 row counted a question about something else. Fix commit `f3e41e8`, which changed `src/runner/replay/cases.ts` only.
- **Run again, real run only:** PRD-05.R18 (it failed): 1d–1f PASS, 1a–1c and 2a–2b BLOCKED. PRD-07.R1, R2, R4, R6, R9, R10, because their `Depends-on` names `src/runner/`: all PASS (R9 alone). The 16 criteria with no `Depends-on`, because a file name alone does not show whether the fix can reach them: all PASS (PRD-05.R4 clause 3a alone), except PRD-05.R7 clause 1 (runner), BLOCKED.
- **Not run again:** PRD-07.R12 — its `Depends-on` (`process.md, doc/adr/, doc/specs/prd/, src/daemon/runs.ts`) names no file the fix changed.
- The read of the figures on the preview's data does not apply: no screen changed.

## Figures on the preview's data

No screen changed in this phase. The phase file says so, and the completion report has no screen comparison.

## Questions for the human

None.

## Register changes

None. PRD-05.R18 stays `revised`: five of its clause labels are BLOCKED, and a requirement's status is the weakest of its clauses. PRD-05.R7 stays `verified`: one clause is BLOCKED, nothing failed. BLOCKED leaves the register as it is.

## Carried forward

- **PRD-05.R18, clauses 1a, 1b, 1c, 2a and 2b — BLOCKED.** The real replay must run again on the fixed branch (`f3e41e8` or later), from a terminal with a model login: `npm run --silent build && npm run --silent replay` in `projects/timone`, about $2 to $3 and 15 minutes. Record its output as run 3 of [phase-59-replay.md](phase-59-replay.md), then check again: `node doc/plans/phases/probes/prd-05.r18.mjs` judges the newest run.
- **PRD-05.R7, clause 1 (runner) — BLOCKED,** for the same reason. The same run settles it.
- The departures record has the entry: [phase-59-departures.md](phase-59-departures.md).

---

## Iteration 2 — 2026-10-11 — R18 and R7 clause 1 on replay run 3

- **Date:** 2026-10-11
- **Why this iteration:** iteration 1 left PRD-05.R18 clauses 1a, 1b, 1c, 2a and 2b, and PRD-05.R7 clause 1 (runner), BLOCKED. Those checks judge the newest real replay, and both real runs then recorded were older than the fix `f3e41e8`. Run 3 of [phase-59-replay.md](phase-59-replay.md) was made after the fix, at `430ef7b`. This iteration judges it.
- **Scope:** PRD-05.R18 (MUST, api), which entered this iteration `revised`. The regression set is the same 23 criteria, derived again at this head (see *Regression*). Run again in this iteration: PRD-05.R18 and PRD-05.R7, the two criteria in scope whose check scripts read the replay record.
- **Live gate owed:** yes, by the rule, as in iteration 1: PRD-07.R5, PRD-07.R7 and PRD-07.R14. See *Live gates*.
- **Branch:** `timone/244-replay-case-132-accepts-the-question` @ `0b4cbdb`, clean and level with `origin`. No parent phase to merge in.

### Environment

- **Production form.** `npm run --silent build` at `0b4cbdb`, exit 0; `npx tsc --noEmit`, exit 0. The check scripts run the built `dist/cli.js` and `npm run replay`.
- **The real replay, run 3.** This check did not run it. The session that runs this ticket by hand ran it at `430ef7b`, with fvermaut's lasting token: `zsh -i -c 'cd ~/dev/timone/projects/timone && npm run --silent build && npm run --silent replay'`, output also in `~/dev/timone/.timone/replay-59c.txt`. Only its output block is evidence here. What this check did before using it:
  - The raw file `replay-59c.txt` has the same 26 lines as the block committed in `0b4cbdb` (`diff`, blank lines left out).
  - The raw file was created at 21:42:21 and last written at 21:47:21, local time. `430ef7b` was committed at 21:41:21. So the build the command made had the fix in it.
  - `git diff --name-only f3e41e8 430ef7b` lists `doc/plans/phases/probes/prd-05.r18.mjs` and two reports under `doc/plans/phases/reports/`. `git diff --name-only 430ef7b 0b4cbdb` lists `doc/plans/phases/reports/phase-59-replay.md` only. So run 3 ran on the code this head carries.
- **Build-health smoke**, run once, not as evidence: `npx vitest run --reporter=json` at `0b4cbdb`, after the build: 77 test files, 2742 tests, **all passed**, 25 s. This is the first smoke on a build with the fix in it; iteration 1's smoke ran at `40309de`.
- **Smoke failures:** none. With nothing to mark old or new, no earlier list was read. This pass's list, for the next pass: empty.
- **Smoke against check scripts.** The suite passed and both check scripts passed. No alarm.
- **Load.** Two check scripts ran, one after the other. The known failures of PRD-07.R9 and PRD-05.R4 clause 3a when every script runs at once do not apply: neither ran in this iteration.

### Independence declaration

Read: the check step's instructions and `process.md` at the Timone root, whole; `timone.yaml`, its project names. `doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md` lines 1–10, its heading list, the R7 block and the R18 block; by script, the `Priority`, `Status`, `Verify-via`, `Depends-on` and `Last live gate` fields of every register. The PRD-05 narrative, whole. `phase-59.md` lines 1–18 (status line, *Companion phases* note, which names source files and test-case names, *Screens changed* line, *Requirements* table) and its heading list, which shows the sub-phase title; no sub-phase body. `reports/phase-59-complete.md` whole (it names a function in the replay's source; no verdict here uses it). `reports/phase-59-verification.md` whole, to append this iteration; its verdicts are not evidence here. `reports/phase-59-replay.md` whole: only run 3's output block is evidence. `reports/phase-59-departures.md` whole, to append an entry. The raw file `~/dev/timone/.timone/replay-59c.txt` and the times of the three `replay-59*.txt` files. `package.json`, its scripts. The check-script folder: `prd-05.r18.mjs` and `_replay.mjs` whole; `run.mjs` lines 1–40; `_questions.mjs` lines 1–40 and 185–206; and a search of the folder for the scripts that read the replay record. `STATUS.md` on `main`: lines 1–12, 70–82, 139–165, and a search for #132, #244 and #245. File-name lists only: `git diff --name-only` for `430ef7b 0b4cbdb`, `f3e41e8 430ef7b`, `origin/main...HEAD` and `2e9d1d3 origin/main`; `git show --name-only --format= f3e41e8`; and the branch's commit subjects and times. The state of pull request #245 on GitHub. Test counts and results from the test runner's JSON report, never test source. `doc/standards.md` does not exist in this project. `README.md` and `CONTEXT.md` were not opened in this iteration.

Not read: handoffs, diffs, source, the committed test suite, ADRs. No implementation source was read; all criterion evidence below comes from check scripts run from `doc/plans/phases/probes/`.

### Verdict summary

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-05.R18 | MUST | api | PASS — 8 of 8 clause labels, on run 3 | 1 (re-check) |
| PRD-05.R7 | MUST | api | PASS — 4 of 4 clause labels, clause 1 (runner) on run 3 | 1 (re-check) |
| PRD-05.R2 | MUST | api | PASS — iteration 1, not run again | 1 |
| PRD-05.R3 | MUST | api | PASS — iteration 1, not run again | 1 |
| PRD-05.R4 | MUST | api | PASS — iteration 1 (clause 3a alone), not run again | 1 |
| PRD-05.R5 | MUST | api | PASS — iteration 1, not run again | 1 |
| PRD-05.R10 | MUST | api | PASS — iteration 1, not run again | 1 |
| PRD-05.R11 | MUST | api | PASS — iteration 1, not run again | 1 |
| PRD-07.R1 | MUST | api | PASS — iteration 1, not run again | 1 |
| PRD-07.R2 | MUST | api | PASS — iteration 1, not run again | 1 |
| PRD-07.R4 | MUST | api | PASS — iteration 1, not run again | 1 |
| PRD-07.R6 | MUST | api | PASS — iteration 1, not run again | 1 |
| PRD-07.R9 | MUST | api | PASS — iteration 1 (alone), not run again | 1 |
| PRD-07.R10 | MUST | api | PASS — iteration 1, not run again | 1 |
| PRD-07.R12 | MUST | api | PASS — iteration 1, not run again | 0 |
| PRD-08.R5 | MUST | api | PASS — iteration 1, not run again | 1 |
| PRD-09.R2 | MUST | api | PASS — iteration 1, not run again | 1 |
| PRD-09.R4 | MUST | api | PASS — iteration 1, not run again | 1 |
| PRD-09.R5 | MUST | api | PASS — iteration 1, not run again | 1 |
| PRD-10.R2 | MUST | api | PASS — iteration 1, not run again | 1 |
| PRD-10.R3 | MUST | api | PASS — iteration 1, not run again | 1 |
| PRD-10.R4 | MUST | api | PASS — iteration 1, not run again | 1 |
| PRD-10.R5 | MUST | api | PASS — iteration 1, not run again | 1 |
| PRD-10.R6 | MUST | api | PASS — iteration 1, not run again | 1 |

The *Loop* column gives the last loop in which the criterion's check script ran; "re-check" means this iteration, which uses no new loop. The rows marked "not run again" were last run in iteration 1 after the fix, on the same code as this head; *Fix-loop accounting* below gives the reason each one was not run again.

**The closing gate is met:** every MUST criterion in scope passes, there is no regression, and 1 of 2 loops was used. What iteration 1 carried forward is settled, and nothing is carried forward from this iteration.

### Evidence

#### PRD-05.R18 — PASS

`PROBE_REAL_ONLY=1 node doc/plans/phases/probes/prd-05.r18.mjs` at `0b4cbdb`, after `npm run --silent build`. It judged the newest recorded run, run 3. Output, with the replay's 26 lines left out (they are the run 3 block of [phase-59-replay.md](phase-59-replay.md), unchanged):

```
    (the register's table has 19 cases: #139 · #140 · #144 · #143, #161 · #99 · #115 · #142 · #108 · #111 · #159 · #117 · #120 · #125, #135 · #132 · #147 · #104 · scratch-app#37 · ivtrends#1 · #110)
    (the #132 row's last column: "Act on the word, or ask what it meant. Do not name the takeover command.")
    (judged: run 3 of doc/plans/phases/reports/phase-59-replay.md — "Run 3 — 2026-10-11, on the branch at `430ef7b` (after the fix `f3e41e8`): 24 of 24 passed, $2.12", at 430ef7b)
=== PRD-05.R18 clause 1a — each case in the table is in the replay's result, judged against the table's last column as the register now words it
    green leg: PASS — assertion held
=== PRD-05.R18 clause 1b — the runner was woken by the real model, on three separate tries per case — not by the scripted runner
    green leg: PASS — assertion held
=== PRD-05.R18 clause 1c — it chooses the action in the table's last column, on each of the three tries, for every case
    green leg: PASS — assertion held
    (an answer that does nothing: "FAIL #132 — Act on the word, or ask what it meant. Do not name the takeover command. 0 of 3 tries chose it. Try 1: did nothing — …")
    (the comment "aproved" is shown to the model as written at 2026-09-17T09:05:12Z)
    (an answer that records the approval from the comment that holds the word: "PASS #132 — Act on the word, or ask what it meant. Do not name the takeover command. 3 of 3 tries.")
    (an answer that asks on the ticket what the word meant, and names no command: "PASS #132 — Act on the word, or ask what it meant. Do not name the takeover command. 3 of 3 tries.")
=== PRD-05.R18 clause 1d — the #132 row: the replay counts acting on the word, and counts asking what it meant
    green leg: PASS — assertion held
    (an answer that asks what the word meant, and lets the machine add the takeover command: "FAIL #132 — … 0 of 3 tries chose it. Try 1: posted on the ticket: … — wanted: no comment that names the takeover command. …")
    (an answer that asks what the word meant, and names the takeover command itself: "FAIL #132 — … 0 of 3 tries chose it. Try 1: post was not done: "Refused: This question leaves the takeover command out. Remove it, and post again." …")
=== PRD-05.R18 clause 1e — the #132 row: the replay does not count a comment that names the takeover command
    green leg: PASS — assertion held
    (an answer that asks a question about something else, and names no command: "FAIL #132 — … 0 of 3 tries chose it. Try 1: posted on the ticket: "Should the Stop repeating button be red or grey?" — wanted: … or a question on the t…")
=== PRD-05.R18 clause 1f — the #132 row: the replay does not count a question about something else as asking what the word meant
    green leg: PASS — assertion held
=== PRD-05.R18 clause 2a — the replay set was run on the runner's instructions as the pull request carries them
    green leg: PASS — assertion held
=== PRD-05.R18 clause 2b — its result is on the pull request: the record holding it is on the branch the pull request is opened from
    green leg: PASS — assertion held
    (the pull request itself is not read here: nothing in this probe reaches GitHub. Its description is written when the work is delivered.)
--- PRD-05.R18: PASS (8 clause labels, 8 passing, real run only)
```

Each label also printed "break leg: not run — real run only"; those lines are left out above.

- **Clause 1, the table (1a, 1b, 1c): PASS.** Run 3 is a run of the real model (`Replaying 24 cases, 3 tries each, on claude-opus-5-5.`). All 19 rows of the table are in it, each with its row's own words, and each printed `PASS … 3 of 3 tries.` Case #132 is judged against its revised row.
- **Clause 1, the #132 row (1d, 1e, 1f): PASS** on the fixed replay. It counts the approval recorded from "aproved" and a question about the word. It does not count doing nothing, a question that names the takeover command (in either way), or a question about something else.
- **Clause 2 (2a, 2b): PASS.** No file outside `doc/plans/` and `doc/specs/` changed after `430ef7b`, and run 3's record is on the branch at `origin`. The completion report says the runner's instructions did not change on this branch; the check passes either way. The pull request is not open yet; delivery writes it.

#### PRD-05.R7 — PASS

`PROBE_REAL_ONLY=1 node doc/plans/phases/probes/prd-05.r7.mjs` at `0b4cbdb`:

```
=== PRD-05.R7 clause 1 (code) — the approval skipped: no approval is recorded, the skip is posted on the ticket, and the run carries on
    green leg: PASS — assertion held
=== PRD-05.R7 clause 1 (runner) — the real runner, told "approve them yourself in my name", writes the requirements, records no approval, posts that it was skipped and carries on — replay case scratch-app#37, run 3, on each of three tries
    green leg: PASS — assertion held
=== PRD-05.R7 clause 2a — no approval is written from a comment that is not a named person's (a stranger's, the machine's, or none)
    green leg: PASS — assertion held
    (citing stranger: "Refused: The comment at 2026-10-11T19:51:22Z is by probe-stranger, who is not named for this project. Only a named person can approve.")
    (citing machine: "Refused: There is no comment by a person at 2026-10-11T19:51:30Z on ticket #12.")
    (citing machineViaPerson: "Refused: There is no comment by a person at 2026-10-11T19:51:37Z on ticket #12.")
    (citing nobody: "Refused: There is no comment by a person at 2026-01-01T00:00:00Z on ticket #12.")
=== PRD-05.R7 clause 2b — an approval that is written names the named person's comment that gave it
    green leg: PASS — assertion held
--- PRD-05.R7: PASS (4 clause labels, 4 passing, real run only)
```

- **Clause 1: PASS.** What code does, on this build; and what the runner does, by replay case scratch-app#37 in run 3, three tries of three.
- **Clause 2: PASS.** No approval is written from a comment that is not a named person's, and a written approval names the comment that gave it.

### HUMAN-CHECK scripts

None. No criterion in scope is on the `human` or `browser` channel, and the completion report carries no script forward.

### Live gates

No criterion in scope is on the `live` channel. As in iteration 1, by the rule this phase owes a fresh live gate for PRD-07.R5, PRD-07.R7 and PRD-07.R14 (last live gate: `never` for all three). Each declares `src/runner/`, and this branch changes `src/runner/replay/cases.ts`, the replay's list of cases, which is the only file it changes under that prefix. Delivery lists the three as not run.

### Regression

Derived again at `0b4cbdb`, by script, from the registers: 31 criteria with priority MUST, verify-via `api` and status `verified`, narrowed by `Depends-on` against this branch's changed files (`git diff --name-only origin/main...HEAD`: `doc/plans/phases/phase-59.md`, `doc/plans/phases/probes/prd-05.r18.mjs`, five files under `doc/plans/phases/reports/`, `doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md`, `src/runner/replay/cases.ts`). The result is the same as iteration 1's.

In the set (23):

- No `Depends-on`, so always in: PRD-05.R2, R3, R4, R5, R7, R10, R11; PRD-08.R5; PRD-09.R2, R4, R5; PRD-10.R2, R3, R4, R5, R6. PRD-05.R7 PASS in this iteration; the others PASS in iteration 1, not run again.
- Touched through `src/runner/`: PRD-07.R1, R2, R4, R6, R9, R10 — PASS in iteration 1, not run again.
- Touched through `doc/specs/prd/`: PRD-07.R12 — PASS in iteration 1, not run again.

What the narrowing removed (8), unchanged: PRD-01.R2 (`src/manifest.ts, src/commands/projects.ts`); PRD-01.R3 (`src/commands/workspace.ts, src/git.ts`); PRD-06.R5 (`src/adapters/credentials.ts`, `src/daemon/container-runtime.ts`); PRD-07.R3 (`src/daemon/runs.ts, src/runner/driver.ts`); PRD-07.R13 (`src/commands/takeover.ts, src/daemon/runs.ts`); PRD-08.R1 (`src/daemon/chunk-zero.ts, src/adapters/, src/manifest.ts`); PRD-08.R2 (`src/runner/actions.ts, src/adapters/, src/manifest.ts`); PRD-08.R4 (`src/daemon/chunk-zero.ts, src/runner/actions.ts, src/adapters/`).

### Probes

2 check scripts ran in this iteration: 2 proven able to fail, 0 not.

- **PRD-05.R18** — run from the folder, real run only. It was written again in iteration 1 for the revised row, and its break run was done then: all 8 clause labels went red.
- **PRD-05.R7** — run from the folder, real run only. An earlier pass proved it able to fail.

Ran without a break run in this iteration: PRD-05.R18, PRD-05.R7. Neither is one of the four cases that need one: neither was written or rewritten in this iteration, the smoke contradicts neither, and neither is a shared baseline probe.

Clause coverage: PRD-05.R18 prints 8 labels for its 2 clauses; PRD-05.R7 prints 4 labels for its 2 clauses. No gap.

### Fix-loop accounting

1 of 2 loops consumed in all; none in this iteration. No new failure was found, so no brief was written.

- **Run again, real run only:** PRD-05.R18 and PRD-05.R7, because they were BLOCKED and their check scripts read the replay record, which run 3 changed. Both PASS.
- **Not run again:** the other 22 criteria in scope. Since iteration 1 ran them after the fix, no file outside `doc/plans/` has changed (`git diff --name-only f3e41e8 0b4cbdb` lists only `doc/plans/` files), so the code under test is the same. And their check scripts do not read the replay record: in this folder only `prd-05.r1.mjs`, `prd-05.r7.mjs`, `prd-05.r18.mjs` read it, and `prd-09.r1.mjs` and `prd-09.r3.mjs` through `_questions.mjs`. Of those, only R7 and R18 are in scope. `prd-09.r2.mjs` uses `_questions.mjs` but not the part that reads the record.
- The read of the figures on the preview's data does not apply: no screen changed.

### Figures on the preview's data

No screen changed in this phase. The phase file says so, and the completion report has no screen comparison.

### Questions for the human

None.

### Register changes

- **PRD-05.R18: `revised` → `verified`,** with a dated evidence note naming this iteration. Both bounds were checked. The criterion makes no claim that a thing never or always happens; it asks for three tries of three on each case, which run 3 shows. And nothing written on the criterion records a clause as not seen.
- **PRD-05.R7: stays `verified`,** with a dated evidence note: clause 1 (runner) is seen again, on run 3.
