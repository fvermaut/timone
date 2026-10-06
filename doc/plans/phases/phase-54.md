# Phase 54: `timone status` names only tickets that wait on a person — a finished run is never named in the closing line

> **Status:** Planned.

> **Companion phases:** [phase 51](phase-51.md), [phase 52](phase-52.md) and [phase 53](phase-53.md) — the last three merged; none touched `waitsOnYou` or the closing line. The rule this phase removes came from `ctaFor` in `src/daemon/cta.ts` and was moved into `src/commands/status.ts` on 2026-09-30, when the ticket's standing note went with the old daemon's path (the `✏ 2026-09-30` note on `waitsOnYou`). Governing decisions: [ADR-0060](../../adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md) — every wait a run is read with is now the runner's, and the runner says on the ticket when it asks a person; that is why a parked run with an ask is the one thing the closing line has left to name. [ADR-0028](../../adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md) D4 — says the *project's line* reports where an initiative stands between steps; this phase leaves that line alone and changes only the closing line. [ADR-0040](../../adr/0040-one-step-is-one-ticket-and-doneness-is-a-fact-about-a-ticket.md) and [ADR-0065](../../adr/0065-the-planner-is-a-session-of-its-own-asked-when-a-build-would-start.md) D6 — a step that is claimed or blocked is ordinary now, so "no step can start" is no sign that a person is wanted. [ADR-0050](../../adr/0050-timone-becomes-a-managed-project-once-the-run-path-is-fixed.md) D5 — this project is Timone, so `src/` is committed here.

> **Screens changed:** none — `timone status` prints to a terminal; no slice changes a screen Timone draws.

## Requirements

> **PRD:** [prd-02-inversion-of-control.md](../../specs/prd/prd-02-inversion-of-control.md) — criteria in [prd-02-inversion-of-control.criteria.md](../../specs/prd/prd-02-inversion-of-control.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-02.R9 | SHOULD | `timone status` lists every managed project with its active ticket, current stage, and any gate waiting for human input, in one glance. |

This is a bug against a requirement already `verified`: the closing line claims tickets wait for human input when they do not ([#186](https://github.com/fvermaut/timone/issues/186)). Nothing new is asked for, and the register is not changed.

## Goal Description

On 2026-10-02 `timone status` ended with *"What I need from you: answer on ivtrends #5, ivtrends #6, …"* — about 80 tickets, nearly all finished. Triage classified it as a bug on the ticket on 2026-10-06; no triage record was committed under `doc/triage/` for it. The fault is reproduced on `main` with three plain runs: done runs on `ivtrends` #4, #5 and #6, and an initiative picture `{ initiative: 4, steps: [5, 6, 7], done: 2 }` with no `next`, print `answer on ivtrends #5, ivtrends #6, ivtrends #4`.

**Why it happens.** `waitsOnYou` (`src/commands/status.ts:321-331`) names a `done` run when the initiative its ticket belongs to has steps left and none eligible (`progress.next === undefined && progress.done < progress.total`), or when its list of pieces has grown since approval (`progress.reproposed`). Both readings date from the old daemon, where a done chunk between two pieces was how an initiative waited on a person. Neither holds now. A step is "not eligible" when it is claimed, blocked by an open step, or held (`eligibleSteps`, `src/daemon/steps.ts:89-96`) — and with several steps building at once (ADR-0065 D6) that is the normal state of a live initiative. Worse, the picture is only refreshed while the map ticket is marked and open (`surveyInitiatives`, `src/daemon/poll.ts:1035-1083`); once it closes, the last picture stays in the ledger for ever, so every finished run of every old initiative is named on every call. A person who is asked something is asked by the runner, which parks the run with that ask as its wait (ADR-0060). The closing line already names those through the parked arm.

**The fix: a done run is never named.** `waitsOnYou` keeps only its parked arm. The regrown-list arm goes too, not only the arm the ticket names: a regrown list is re-proposed by a session the runner drives, and that session parks the run asking for approval, which the parked arm names; a done run beside an old regrown file is the same false claim as the one this ticket reports. With both arms gone, the per-ticket progress reader that fed them (`progressReader`, the `progressOf` field, the `root` and `breakdownSource` options, `checkoutOf`) has no caller in `status.ts`, and slice 54a removes it with the fix so the file does not keep a reader nothing uses. Slice 54b then deletes what that leaves without a caller outside tests in `src/daemon/poll.ts` and `src/daemon/breakdown.ts`. The project's own line — "#7 … nothing to take" between steps — is computed from `initiativesOf`, not from this reader, and does not change.

**No decision here clears the ADR bar.** Removing the two arms is undone by restoring six lines, so it is not hard to reverse; it follows from ADR-0060 and ADR-0065 rather than trading one thing against another; and it is what the ticket asks for in its own words, *"The closing line names only the tickets that wait on a person now."* The runner's instruction for this step says the same: *"A finished run must never be named."*

**Regression set.** Derived per ADR-0051 D4: MUST, `api`, `verified` criteria whose `Depends-on` this phase's diff touches. 54a touches `src/commands/status.ts`, `src/commands/status.test.ts` and `src/guards/checkouts.test.ts`; no such criterion depends on them. 54b touches `src/daemon/poll.ts` and `src/daemon/breakdown.ts`, which brings in the three whose `Depends-on` names all of `src/daemon/`: [PRD-07.R4](../../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md#r4--nothing-is-built-on-top-of-an-open-pull-request), [PRD-07.R6](../../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md#r6--a-held-ticket-says-what-it-waits-for-and-a-named-person-can-overrule) and [PRD-07.R9](../../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md#r9--a-ticket-with-an-open-pull-request-keeps-its-run-and-is-not-picked-up-again). 54b deletes only code that nothing outside tests calls, so none of them can change, and the whole suite is the gate. No `live` criterion depends on these files, so no live gate is owed. **What no criterion watches:** that a parked run *with* an ask is still named. PRD-02.R9 was verified on the old daemon's words. The control case in 54a's tests (case 4) is what protects it, and it is a hard gate.

`doc/standards.md` does not exist in this project; the central `standards/` baseline governs, and none of its entries bears on a terminal line. The code follows the house rules in `standards/` for TypeScript as the rest of `src/` does.

## Context & Prerequisites

- **`src/commands/status.ts`** — `waitsOnYou` (321-331) is the fault. `RenderContext.progressOf` (183), `progressReader` (200-238), the `root` (107-117) and `breakdownSource` (118-128) options, `checkoutOf` (28-39) and the imports of `fromDefaultBranch`, `SyncBreakdownSource`, `initiativeProgressSync`, `progressOf`, `InitiativeProgress` (6-21) exist only to feed it. The command passes `root: process.cwd()` (line 652). The closing-line block (about 574-586) dedupes by ticket and carries a comment about done runs being named.
- **`src/commands/status.test.ts`** — `breakdownIn` (22-33), `rootWith` (57-67) and the `breakdown` fixture builder exist for the regrown-list case. `"names a ticket once in its closing line however many pieces it has had"` (491-514) asserts the arm being removed. `"says where each kind of run stands, and names no command"` (1015-1075) copies `src/daemon/fixtures/ledger-before-166.json` into a temp folder; that ledger holds done runs `scratch-app` #12 and `ivtrends` #60, and parked runs #24, #90-#94.
- **`src/guards/checkouts.test.ts`** — `EXEMPT["commands/status.ts"]` (52-54) is there for `checkoutOf`; the test `"has no exemption for a file that has stopped needing one"` (269-290) fails once `status.ts` stops building a path under `projects/`, and the entry must then go. The comment above `GIT_USERS["git.ts"]` (94-97) and `GIT_USERS["daemon/breakdown.ts"]` (106-109) mention `timone status` reaching git through `fromDefaultBranch`.
- **`src/daemon/poll.ts`** — `InitiativeProgress` (1502-1511), `initiativeProgressSync` (1535-1542), `progressFrom` (1545-1560), `progressOf` (1562-1567), `progressOfPicture` (1569-1579): callers are only `status.ts`. The comment at 1480-1484 about `checkoutOf`. Imports of `readBreakdownSync` and `SyncBreakdownSource` at the top. `isReproposal` stays: `successionOf` uses it.
- **`src/daemon/breakdown.ts`** — `fromDefaultBranch` (200-235), `defaultBranchOf` (about 272-290) and `readBreakdownSync` (314-331): callers are only `status.ts`/`poll.ts`'s chain above and `breakdown.test.ts`. `SyncBreakdownSource` and `fromWorkingTree` stay: `src/commands/breakdown.ts`, `poll.test.ts` and `status.test.ts` use them.
- **Existing state** — 94 tests pass today in `status.test.ts`, `checkouts.test.ts` and `breakdown.test.ts` together.

## Sub-phases

### Sub-phase 54a: The closing line never names a finished run

**[MODIFY]** `src/commands/status.test.ts` — new failing cases first (below); replace the test at 491-514; remove `breakdownIn`, `rootWith` and any helper or import only they used.
**[MODIFY]** `src/commands/status.ts` — `waitsOnYou` keeps only its parked arm; remove `RenderContext.progressOf`, `progressReader`, the `root` and `breakdownSource` options, `checkoutOf`, the `root:` the command passes, and the imports nothing uses afterwards. Rewrite `waitsOnYou`'s doc comment to say a done run waits on nobody and why (the runner asks by parking, ADR-0060; an initiative with no eligible step is ordinary, ADR-0065 D6), with a dated `✏ 2026-10-06 (#186)` note. Rewrite the comment above the closing-line `waiting` block: it says done runs can be waiting, which is no longer true. Keep the dedupe by ticket — the ledger can still hold more than one parked run of one ticket from older code.
**[MODIFY]** `src/guards/checkouts.test.ts` — delete `EXEMPT["commands/status.ts"]`; fix the comment above `GIT_USERS["git.ts"]` so it no longer says `status.ts` reaches git through `fromDefaultBranch`. Leave `GIT_USERS["daemon/breakdown.ts"]` for 54b.

**Seams under test (TDD):** `renderStatus` is the seam — the function the command prints, pure given its options, and the one every existing closing-line test uses. The last line of its output is the observable. Red-green:

1. **The ticket's case.** Done runs on `scratch-app` #51 and #52, and a picture `{ project: "scratch-app", initiative: 7, steps: [51, 52, 53], done: 2 }` with no `next`, passed through `pictures` → the last line is `**What I need from you:** nothing — nothing is waiting on you right now.` Red today: it names #51 and #52.
2. **The map ticket's own done run.** A done run on `scratch-app` #7 (the initiative's number) with the same picture → the same "nothing" line. Red today.
3. **A real ledger with old pictures.** Copy `ledger-before-166.json` into a temp folder as the test at 1015 does, open it with `RunStore.open`, call `rememberInitiative` for `{ project: "ivtrends", initiative: 59, title: "old work", steps: [60, 62, 63], done: 1 }` and `{ project: "scratch-app", initiative: 11, title: "old work", steps: [12, 13], done: 1 }` (no `next`), and render with `pictures: (p) => store.initiativesFor(p)` → the last line is exactly `**What I need from you:** answer on scratch-app #24, ivtrends #90, ivtrends #91, ivtrends #92, ivtrends #93 — each ticket says what it needs.` — no #12, no #60. Red today.
4. **Control: a parked run that asked still is named.** A parked run on step `scratch-app` #53 with `wait: { kind: "runner", on: "your answer on the ticket" }`, beside done runs on #51 and #52 and the picture from case 1 → the last line names `scratch-app #53` and only it. Green before and after; it must stay green. ✏ 2026-10-06 (build, timone#186): it cannot be green before. Today's code names #51 and #52 too, because the picture beside them has steps left and no `next`, so a line that names #53 "and only it" fails on today's code. It was red before the change and is green after. What it protects, that #53 is named, held both before and after.
5. **Replaces 491-514.** Two done runs and one parked run (with an ask) on `scratch-app` #6 → `scratch-app #6` is named once. Green before and after.

> No dependency on other sub-phases.

Write cases 1-3 first and run them red; record the red output in the handoff. Then change `status.ts`. Do not touch `describeInitiative`, `stepOf` or anything that reads `initiativesOf`: the project's line between steps must read exactly as it does today, and the four tests in `describe("which step of an initiative is live")` (560-662) are its guard.

#### Agent Validation Steps

```bash
cd projects/timone
npx vitest run src/commands/status.test.ts src/guards/checkouts.test.ts src/daemon/breakdown.test.ts
npx tsc --noEmit; echo "exit: $?"          # expect 0
# The fix is in the code, not a comment: no done-run arm is left in waitsOnYou.
awk '/^function waitsOnYou/,/^}/' src/commands/status.ts | grep -v '^\s*//' | grep -v '^\s*\*' | grep -c 'done'; echo "exit: $?"   # expect 0 matches, exit 1
# status.ts no longer reads a list of pieces.
grep -nE 'progressReader|breakdownSource|checkoutOf|initiativeProgressSync|fromDefaultBranch' src/commands/status.ts | grep -v '^\S*:\s*//' ; echo "exit: $?"   # expect no lines, exit 1
npx vitest run; echo "exit: $?"             # expect 0
```

- [ ] Cases 1, 2 and 3 were red before the change to `status.ts` and are green after; the handoff shows both runs.
- [ ] Case 4 is green after the change, and stays green — this is the only test that protects a real ask being named. ✏ 2026-10-06 (build, timone#186): it was red before the change, since today's code also names #51 and #52 beside #53.
- [ ] The four tests under `"which step of an initiative is live"` pass unchanged. ✏ 2026-10-06 (build, timone#186): the block holds five tests, not four; all five are the guard.
- [ ] `src/guards/checkouts.test.ts` passes with `commands/status.ts` gone from `EXEMPT`.
- [ ] The whole suite passes; `tsc --noEmit` exits 0.

---

### Sub-phase 54b: Code that only fed the old rule is gone

**[MODIFY]** `src/daemon/poll.ts` — delete `InitiativeProgress`, `initiativeProgressSync`, `progressFrom`, `progressOf`, `progressOfPicture`, the imports only they used (`readBreakdownSync`, `SyncBreakdownSource`, and `isReproposal` only if `successionOf` no longer needs it — it does, so keep it), and the stale `checkoutOf` comment at about 1480-1484 (say in one line that `timone status` no longer reads a project's checkout for the list of pieces, #186).
**[MODIFY]** `src/daemon/breakdown.ts` — delete `fromDefaultBranch`, `defaultBranchOf` and `readBreakdownSync`, and the `execFileSync` import if nothing else uses it. Keep `SyncBreakdownSource`, `fromWorkingTree`, `readBreakdown`, `breakdownFrom`, `isReproposal`. Fix doc comments that still say a reader exists "for `timone status`".
**[MODIFY]** `src/daemon/breakdown.test.ts` — delete the tests of the three removed functions (around 185-320); keep every test of what stays. If a kept behaviour (absent file, unparseable file) was tested only through `readBreakdownSync`, move that case onto `readBreakdown` with `fromWorkingTree`, which reaches the same `breakdownFrom`.
**[MODIFY]** `src/guards/checkouts.test.ts` — if `breakdown.ts` no longer performs git, delete `GIT_USERS["daemon/breakdown.ts"]`; the test `"has no exemption for a file that has stopped needing one"` says so when it does not.
**[MODIFY]** `src/daemon/poll.test.ts`, `src/commands/status.test.ts` — the comments that say `checkoutOf` "used to supply" a path (about line 52 and line 26) are fixed or removed if their helper went in 54a.

**Seams under test (TDD):** no behaviour-carrying code in this sub-phase, so no seams are declared. It deletes code that has no caller outside tests after 54a; the compiler, the whole suite and the checkout guard are the validation.

> Sub-phase 54a must be complete before starting this sub-phase (until 54a lands, `status.ts` still calls everything this slice deletes).

Before deleting each function, confirm it has no caller left: `grep -rn '<name>' src --include=*.ts`. A caller outside `src/daemon/breakdown.test.ts`, `poll.ts`'s own chain, or this list means stop and say so in the handoff rather than delete it.

#### Agent Validation Steps

```bash
cd projects/timone
grep -rnE '\b(initiativeProgressSync|progressOfPicture|InitiativeProgress|readBreakdownSync|fromDefaultBranch|defaultBranchOf)\b' src --include=*.ts | grep -v 'src/daemon/hooks.ts'; echo "exit: $?"   # expect no lines, exit 1 (hooks.ts has its own unrelated defaultBranchOf)
grep -rn '\bprogressOf\b' src --include=*.ts | grep -v 'src/runner/replay/recording.ts'; echo "exit: $?"   # expect no lines, exit 1 (recording.ts has its own)
npx tsc --noEmit; echo "exit: $?"           # expect 0
npx vitest run src/guards/checkouts.test.ts src/daemon/breakdown.test.ts src/daemon/poll.test.ts src/commands/status.test.ts src/commands/breakdown.test.ts; echo "exit: $?"   # expect 0
npx vitest run; echo "exit: $?"             # expect 0 — the regression set (PRD-07.R4, R6, R9) rides on this
```

- [ ] None of the removed names is left in `src/`, other than the unrelated `defaultBranchOf` in `hooks.ts` and `progressOf` in `recording.ts`.
- [ ] `timone breakdown` (`src/commands/breakdown.ts`) still builds and its tests pass: it uses `fromWorkingTree`, which stays.
- [ ] The checkout guard passes, with `daemon/breakdown.ts` removed from `GIT_USERS` if it no longer runs git.
- [ ] The whole suite passes; `tsc --noEmit` exits 0.

## Dependency graph

```
54a → (none)   the closing line never names a done run; status.ts stops reading the list of pieces
54b → 54a      delete the progress reader and the default-branch reader that only 54a's old code called
```

The two share `src/guards/checkouts.test.ts` and `src/commands/status.test.ts`, so they run one after the other.
