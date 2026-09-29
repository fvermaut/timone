# Phase 40 — Completion Report

- **Date:** 2026-09-28
- **Plan:** [phase-40.md](../phase-40.md) — breakdown [ticket-164.md](../../breakdowns/ticket-164.md) approved by fvermaut 2026-09-26 — 2 pieces; this is piece 1, [#165](https://github.com/fvermaut/timone/issues/165).
- **Requirements:** PRD-05.R1–R19 (R11 in part: `timone retry` refuses on runner projects and is deleted by #166). Every status in the [register](../../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md) stays `draft`, as execution leaves it; verification decides. R4 and R12 were amended during the phase, with dated markers.
- **Branch:** `timone/165-the-runner-beside-the-current-daemon`
- **Departures:** [phase-40-departures.md](phase-40-departures.md) — 20 entries.

## Summary

The runner exists. On a project whose entry says `driver: runner`, the daemon no longer walks a fixed order of steps: after every event it wakes a fresh runner session, which reads a brief code wrote for it and decides what happens next, through nine actions code gives it and nothing else. Code keeps the rules the runner cannot break: nothing reaches a default branch without a named person's yes; a run that changed files waits on its pull request and ends when it is merged or closed, or when a named person asks in plain words to stop; every departure from the written order is posted on the ticket when it happens and listed first on the pull request; each ticket has a $150 limit; only named people's comments reach the runner. The box takes messages while a step runs, and the runner checks a running step every 15 minutes. The current daemon still drives ivtrends and timone, unchanged: every existing test passes, and none was edited except to add a stub method to a test double.

The centre of gravity moved during the phase. The plan put it in the machinery (40a–40h); the replay (40j) and the watched run (40l) moved it to the runner's rules. Five real replays — 13, 18, 18, 18, 18 of 19 — and two watched attempts on scratch-app found that the brief lacked rules the written process already holds (40p, 40q, 40s, 40t), and three faults in code nothing had exercised (40n, 40o, 40r). Each was fixed in a slice of its own, and each is recorded as a departure.

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 40a — one step session, started and watched outside the spawner | Landed; existing session and poll tests unchanged. Two import cycles, noted for review. | `aa544f6` |
| 40b — who may instruct, which driver, the limit, and the forge calls | Landed; `setPullRequestBody` through a temporary file (plan amended). | `3c770c8` |
| 40c — the run record, the default order, the departures and the limit | Landed. | `072e987` |
| 40d — the box can take a message while a step runs | Landed; the in-process runtime left without messages (plan amended); the real-model probe could not log in from the sandbox and passed later from the operator's terminal. | `52de116` |
| 40e — the runner's actions, and the rules code keeps around them | Landed; chunk zero's merge takes its approval as a required argument (plan amended). | `9d59204` |
| 40f — the brief the runner is given each time it wakes | Landed; `ticketKindOf` added here (plan amended). | `ba66aa8` |
| 40g — one fresh runner session per wake, and what happens when it fails | Landed; four untested changes' tests moved to 40h/40i (plan amended). | `d57894a` |
| 40h — the runner drives its projects in the poll cycle | Landed; 13 cases. | `1e07fa6` |
| 40i — `timone record` | Landed; the status line counts a runner run's ask. | `78c257c` |
| 40j — the replay of the recorded failures | Landed; the real replay moved to the operator's terminal (plan amended). | `65c22a8` |
| 40k — the step skills accept an approval the runner skipped | Landed. | `9d14c83` |
| 40l — scratch-app moves to the runner, and the watched run | `timone.yaml` switched; watched twice; human gates met by fvermaut. | `84e94c0` (+ report commits) |
| 40m — the README says what a runner project is | Landed. | `9e54251` |
| 40n — a step ticket's claim is not a hold | Added at build; landed. | `6fea159` |
| 40o — an approval comes after what it approves; a lost step gets its end | Added at build; landed. | `fdf54ec` |
| 40p — the runner's rules carry what the first replay showed missing | Added at build; landed, then #120's fixture corrected. | `cb390da`, `cb76db8` |
| 40q — the ticket's newest message says what it needs now | Added at build; landed. | `440bc66` |
| 40r — a run waits on its pull request; the ledger knows the step | Added at build, from the watched run's first attempt; landed. | `ad6a818` |
| 40s — a map closes with its last piece; the wait says what it waits on | Added at build, from the second attempt and replay run 4; landed. | `8b86d04` |
| 40t — a named person's plain "stop" can end a run with no pull request | Added at build, from replay run 5; landed; R4 amended. | `0849b90` |

At close: `npx tsc --noEmit` exits 0; `npx vitest run` passes 1,919 of 1,919 in 55 files (1,713 at the phase's start); `npm run --silent replay -- --dry` passes 19 of 19. Every slice's validation block is covered by these three: no slice's block ran anything outside them, except the live checks recorded below.

## Screen comparison

None — the phase changes no screen.

## Deviations from the plan

Twenty, each in [phase-40-departures.md](phase-40-departures.md) and each marked in place in the plan or the register. In short:

- **Plan steps changed at build (12):** the in-process runtime takes no messages (40d); a pull request's body goes through a temporary file (40b); `ticketKindOf` moved to 40f; chunk zero's merge needs its approval as an argument, with two callers in the spawner (40e); 40g's four untested changes got their tests later; the probe (40d) and the replay (40j) moved to the operator's terminal; `poll.ts` changed more than an export in 40s; the field `stopCommentAt` is camelCase (40t, noted in its commit).
- **Slices added at build (7):** 40n, 40o, 40p, 40q, 40r, 40s, 40t — each from a replay run or the watched run, each named in the plan's dependency graph.
- **Requirements amended (2):** R12 (a running step's cost is known only when it ends) and R4 (a named person's plain-words stop also ends a run without a pull request). R8 is read narrowly (the reply at the limit is read by a one-turn check).
- **Cases changed (3 changes, 2 cases):** #120's fixture twice and its matcher once, and #104's matcher once — each recorded with why; none lets doing nothing pass.
- **Test fixtures of this phase's own earlier tests (1):** three 40e fixtures gained the `breakdown` step the new approval rule needs (40o).

## Context for the next agent

**How to run.** `npm install`, then `npx tsc --noEmit`, `npx vitest run`, and `npm run --silent replay -- --dry` (free, 19 of 19). The real replay (`npm run --silent replay`) calls the model — about $2.50 for 57 sessions — and needs a logged-in terminal; the build's sandbox has none.

**Live evidence.** [phase-40-live-gate.md](phase-40-live-gate.md): R3, R5, R6, R7, R9 (plain words with a spelling mistake, on the ticket), R12, R13 and R15 seen on real tickets; 40d's owed probe passed. [phase-40-replay.md](phase-40-replay.md): five real runs. **Owed:** replay run 6 after 40t (run 5 was 18 of 19; #115 is what 40t fixed), and R9's clause about a change asked for on a pull request, which no live run reached.

**Known, left open for the review:**

- Three import cycles in `src/daemon/` and `src/runner/` (40a, 40s): safe, since no module reads another's names while loading.
- `attemptMerge` in `chunk-zero.ts` stays exported and takes no approval, for `session.test.ts`'s private delegators; nothing in the runner calls it.
- The ticket's own text reaches the runner whoever wrote it; whoever opened a ticket can edit its text after it was marked (40f).
- A wake asked for before the first cycle after a daemon restart gets an empty ticket context, so one wake can still show a step ticket as held (40n).
- The whole-suite rule at a 15-minute check is blunt: a baseline run before any change counts toward "more than twice" (live gate, second attempt).
- `timone record` does not say a run stopped by a named person's comment was cancelled; the replay's summary line does not call a cancelled run ended (40t).
- A comment in `driver.ts` still describes the hold as a way to wait for someone (40p).
- Test leftovers on scratch-app: pull request #61, ticket #60 (held), map #62 — their closing waits on the operator's word.

## Reopened after verification — 2026-09-29

The check ([phase-40-verification.md](phase-40-verification.md), at `0f433ef`) ran two fix loops of its own (`a113151`–`55a617a`) and listed nine things found outside its verdicts. fvermaut chose to fix the worst before the pull request. **Sub-phase 40u** (`ddb95ed`) fixed items 1–5: a run refused as busy is woken when the project frees; a cancel on a runner project holds the ticket and reports its success truly; the brief finds `ticket-NN.md`; the one-turn check at the limit has no tools; no departures before any step ran — fixed at its source in `departuresOf`. Items 7 and 8 are filed as [timone#171](https://github.com/fvermaut/timone/issues/171) and [timone#172](https://github.com/fvermaut/timone/issues/172). After 40u: 1,950 tests pass, the dry replay passes 19 of 19. A fresh check re-runs the probes next.
