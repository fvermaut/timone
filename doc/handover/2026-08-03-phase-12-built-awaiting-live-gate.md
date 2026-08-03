# Handover — Timone — 2026-08-03

> Prior handover: [2026-08-03-phase-11-closed-phase-12-awaiting-approval.md](2026-08-03-phase-11-closed-phase-12-awaiting-approval.md) — its "Exact next action" (fvermaut approves phase 12 and answers the holds-the-project question) is **done**; read this file instead.

## Snapshot

**Phase 12 is built through 12f, its documentation is written, and it stops at 12g's live gate — which needs fvermaut at a keyboard.** A classified ticket now walks itself from triage to a plan awaiting approval: a feature opens a terminal conversation, requirements and plan are each committed on a work branch and gated on a ticket reply, and an approval is written back into the artifact as its stamp. **The daemon half was watched working live on `scratch-app` #6**; everything requiring the human in the loop is unit-proven only. 312 tests green, `type-check` clean, tree clean, `main` at `42063fb` plus the docs commit. **No register line was flipped** — R3, R4, R5 and R14 carry dated partial-evidence notes instead.

## Done this session

- **fvermaut approved phase 12** and settled both open decisions: the **branch-based holds-the-project rule**, and the **two fixture projects leaving the manifest** (`473d769`).
- **12a–12f built**, one commit each: gate decisions read off the thread (`861135d`), the pipeline state machine and the new holds rule (`2ed535b`), the conversation seam and `timone takeover` (`e7eaccf`), clarification end to end (`b4f4534`), the PRD gate (`cb2538e`), the plan gate (`195c6f7`).
- **Three fixes outside the slice bodies**, each recorded as a dated `✏ Refined` amendment on the phase file: `timone status` showing every waiting ticket rather than the first (`00e9c0a`), and resuming the runs phase 11 parked (`42063fb`).
- **Live on `scratch-app`:** `#6` started by itself, was triaged, routed to clarification, and posted a CTA carrying a copy-pasteable `timone takeover scratch-app#6` naming no stage or skill. A second `--once` changed nothing. `#4` (a `triage:bug`) correctly stayed parked, since the stage that would act on it is phase 13's. Every `takeover` refusal path run against the real ledger. `git log --stat --all` on scratch-app matches no harness path.
- **Docs:** `README.md` (the two kinds of human moment, `takeover`), `STATUS.md` (the freeze is gone; the sign-off script is written out step by step), `phase-11.md` stamped superseded on its holds rule.

## In flight / blocked

- **12g is blocked on fvermaut** and is the whole of what remains before 12h can close the phase. The script is in `STATUS.md` under "Waiting on you" and in [phase-12.md](../plans/phases/phase-12.md) 12g.
- **`scratch-app` #6 is parked on the conversation**, `#4` parked with nothing built to receive it. Both are branchless, so **neither holds the project** — that is the new rule working, and the first half of 12g step 6 is therefore already observed.
- **No completion report yet.** `doc/plans/phases/reports/phase-12-complete.md` and the phase's `Status` flip are 12h's, after the gate.

## Decisions made this session

- **Holds-the-project: branch-based** (fvermaut, at approval). Sessions still serialize absolutely — one running session per project — but a parked run holds the project only once it owns a work branch. Enforced in `RunStore`, not in callers.
- **The daemon posts the gate comment, never the session that did the work.** The CTA must be worded exactly as the decision reader accepts it; a session inventing its own would eventually word it otherwise and leave the human answering a question nothing was listening for. The session writes the substance and is told explicitly not to ask for approval.
- **An approval is written back into the artifact by a short session of its own**, before the run moves on — the PRD becomes Active, the phase file gets its `Approved for execution by <who> <date>` stamp. Not appended to the next stage's prompt, because the next stage may not be built, and an approval that only lands when the following stage runs disappears whenever the pipeline stops. If the recording fails, the run fails.
- **`CONVERSATION_RECORD_MARKER`** — an accepted conversation's record carries a marker line beside the machine marker, so the daemon can recognise it without matching on prose. The clarification prompt instructs the session to write it; without it the ticket would wait forever on a conversation that already happened.
- **A stage the graph calls `built` but nothing can run is a lie the daemon acts on** — `requirements` and `planning` were held at `built: false` until 12e and 12f actually built them.
- **Deliberately not resolved:** `process.md` stage 3 gates *before* files are written; PRD-02.R4 says commit on a branch then gate. **Built to R4** — later, more specific, made for this context, and the human reviews the real register rather than a paraphrase. Correcting `process.md` is a meta-level change and gets a grill first. Recorded on the phase file and on R4.

## Exact next action

**fvermaut runs 12g's six steps** — about twenty minutes, written out in `STATUS.md` under "Waiting on you". In short: `node dist/cli.js takeover scratch-app#6` and hold the interview to acceptance; then `daemon --once`, **reply with a criticism rather than `approve`** and confirm the requirements stage re-runs with your words; then `approve` and confirm it advances to planning; confirm a Timone comment containing "approve" does nothing; in a fresh terminal session state a raw request about a managed project and confirm it routes through triage unprompted (this closes R13's second clause); and say whether the interview felt like a conversation or a form. **Then 12h closes the phase:** flip only the register lines 12g actually evidenced, write `phase-12-complete.md`, stamp the phase file `Complete`.

## Open questions

- **The `process.md` vs R4 gate-ordering conflict** — needs a grill session, not a patch.
- **The marker as a process-wide convention** — carried unchanged; interactive stage sessions still post unmarked comments.
- **A real bot identity** (GitHub App, `timone[bot]`) — still needs a credential from fvermaut. The marker is what exists until then.
- **Triage's finer routing is deliberately narrowed:** `process.md` lets triage send a clear-enough feature straight to requirements and recommend the at-scale discovery mode for a sprawling one, but a `triage:<kind>` label cannot carry a judgement, so the daemon always asks first. Written into `routeAfterTriage`'s doc comment.
- Carried unchanged: the deferred PRD-01 list (R23 onboarding repair, R24 standards-drift needing a grill, deployment/maintenance skills, `timone-wayfind`'s first use, never-fired give-up paths). `scratch-app`'s screen-reader HUMAN-CHECK and the guessed 2 ms latency budget remain open on that project.
