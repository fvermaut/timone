# Phase 26 — Completion Report

- **Date:** 2026-08-19
- **Plan:** [phase-26.md](../phase-26.md) — approved for execution by fvermaut 2026-08-19, as written
- **Issue:** [timone#30](https://github.com/fvermaut/timone/issues/30)
- **Decision:** [ADR-0035](../../../adr/0035-a-resolved-escalation-hands-the-run-back.md)
- **Requirements:** PRD-02.R3, R21, R10, R13 **annotated, no status moved**; the owed requirement extended, still unwritten
- **Branch:** `main` (as for phases 15–25), at `7d79aa8`, pushed
- **Built:** 26a–26f. **26f is run in part** — see [the gate report](phase-26-live-gate.md).

## Summary

**A stop cleared in the terminal now goes back into the loop.** The session that clears it writes the words a decision needs and stops there; it closes with a note naming where the work carries on, in the plain words a person already reads; the daemon picks that up on its next pass, claims the branch and starts that step, with nothing typed. A name it cannot use is refused out loud, and the ticket quotes it back.

The suite went **1063 → 1096 green across 27 files**, type-check clean throughout. `.timone/state.json` was never read for a decision, never written, and never edited.

**The ordering the plan called load-bearing held.** The reader landed before the writer, so nothing ever wrote a note nothing could read.

**Two holes the plan did not name were found while building, and both are closed:** a step can be real and unstartable, and a refused note could not be corrected. Neither was visible from the plan; the first came out of writing the prompt's list of names, the second out of the live gate's own step 5.

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 26a — One name per step | Landed as planned, on the stage table rather than in a map beside it, so the compiler refuses a step without one. 7 tests. | `9b4092c` |
| 26b — The note and its reader | Landed as planned. Three answers, and the name returned unresolved so a refusal can quote it. 8 tests. | `11c5592` |
| 26c — The loop carries on | Landed as planned. What the ticket says is computed from the thread, not stored on the run. 10 tests. | `d964af1` |
| 26d — The session's bound | Landed, plus the unstartable-step refusal the plan did not foresee. 6 tests. | `d4b848f` |
| 26e — The register | Landed as planned. No file under `src/` touched, asserted. | `76e3373` |
| 26f — The live gate | **Run:** six of seven steps observed across two fixtures — steps 1 and 2 by fvermaut at his keyboard — one defect found and fixed, one more filed. Step 7 deliberately stopped. | `7d79aa8`, `<this>` |

## Deviations from the plan

**1 — A step can be real and unstartable, and the plan's refusal did not cover it.** 26d's list of names is generated from the stage table, and generating it exposed the gap: *looking something up* and *looking into what went wrong* are steps of this process with no session behind them. Naming one would have failed the run and put *"something went wrong"* on a ticket whose stop a person had just cleared. The loop now refuses both cases identically — a name nobody defined, and a name nothing can run — and the ticket quotes back whichever was written. It cost a helper in `poll.ts` and one test.

**2 — The newest note wins, decided during the gate.** 26b shipped `readStageOutcome`'s rule: the first note after the cursor. The gate's step 5 showed what that costs — a refused note is permanent, and the correction the ticket asks for can never be read. Changed with two tests, in the slice's own file, and re-observed live.

**3 — One status line changed wording.** `timone status` said `#7 (triage)` and now says `#7 (sorting the request)`. The plan's checklist expected the lines unmoved; they are unmoved for the five steps that already had names, and the eight that did not were printing the process's own vocabulary on the surface written for someone who knows none of it.

**4 — The plan's fixture spent itself before the gate ran.** #37 was to be handed back at *building*; the takeover opened on it the night before — with the prompt from before 26d — carried it to an open pull request instead. The gate ran on a fresh ticket. The old fixture is the clearest evidence for why 26d exists and no evidence at all that it works.

## What is now true, and what is only argued

**True, and tested:** every step has a plain name, unique and total; a handback note naming a startable step resumes the run there, once, claiming the branch the pipeline names; naming nothing resumes where it stopped; a name that is unknown or unstartable leaves the run stopped and puts the name on the ticket; the newest note wins in both directions; a human writing again still starts nothing; every stage prompt still carries phase 25's rule, and the escalation prompt now carries its bound, the note's shape, the list of names and the other honest ending.

**Observed live:** the round trip, the refusal, the ticket repairing itself, and ten quiet cycles' worth of the human answering into a stop.

**Observed once, by the person it was written for:** that a session obeys the bound. On `scratch-app` #40 fvermaut opened the stop himself, and the session took his yes, wrote the requirements and the decisions, built nothing, and handed back at *preparing the work* — naming #37 in its own note as the thing it was not going to repeat. His verdict: *"it stopped right"*. **It remains a rule in a prompt with nothing enforcing it**, exactly as ADR-0033 D2's trigger rule is, and one obedient session is not a rate.

## Handoff

- **Only step 7 is left**, and it is the expensive one: let a handed-back run go all the way to a pull request through the loop.
- **`npm run build` first, restart the daemon, and drive a copy of the ledger with `--state`** — a daemon started without the flag reads the live ledger and picks fixture tickets up as new work, which is how [timone#32](https://github.com/fvermaut/timone/issues/32) was found.
- **Never wrap `daemon --once` in a timeout while a session may spawn** — a limit around the cycle kills the session mid-work, which is how this gate lost a requirements run at 8m31s.
- **The fixtures are cleaned up.** Tickets #34–#37, #39 and #40 are closed and unmarked, pull request #38 is closed unmerged, the three fixture branches are deleted, and `projects/scratch-app` is back on `main` with a clean tree. The live ledger holds one cancelled run for #40 and nothing else from this work.
