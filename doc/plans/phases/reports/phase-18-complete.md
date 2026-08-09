# Phase 18 — Completion Report

- **Date:** 2026-08-09
- **Plan:** [phase-18.md](../phase-18.md) — breakdown approved by fvermaut 2026-08-09, then re-approved by him twice the same day over two scope-growing amendments (18b's and 18c's), each of which reverted the stamp per stage 5's re-approval rule
- **Requirements:** PRD-02.R20 (MUST) — left `draft`; PRD-02.R3 (MUST) — left `revised`. Execution moves neither: both need stage 7, and R20's criteria are explicitly live-observable ones this phase has not yet observed.
- **Branch:** `main` — no phase branch, following every prior Timone-self phase (15, 16, 17 all committed directly). The skill's one-branch-per-phase rule is written for managed projects with a stage-8 pull request; Timone itself has no such flow, and a branch would sit unmerged with no reviewer. Recorded as a deliberate deviation rather than an omission.

## Summary

The phase set out to make a ticket that is waiting on you something you can actually answer. On 2026-08-09 `ivtrends` held nine open decision tickets, every one a well-formed question with no instruction, and `timone takeover ivtrends#5` refused them outright — the daemon had never been told that class of ticket existed. All four code slices landed and the machinery is built: the invitation offers both paths, a wayfinder ticket is a ticket the daemon knows, a written answer moves the ticket, and the human-facing docs say so.

**The phase's centre of gravity turned out to be nowhere near where the plan put it.** 18a went in as written. Then two slices in a row stopped at gate 3, and both were right to. 18b found that the ledger's lifecycle table refuses `picked-up → parked` — invisible until now, because every run had reached a conversation *through* triage, which activates it first, and a wayfinder ticket has no such predecessor. 18c found something larger: the spawner short-circuited **every** conversation stage into `openConversation`, so a run resumed with a written answer in hand re-posted the entire invitation at the person who had just answered — the precise failure ADR-0022 exists to prevent. Neither was diagnosed by reading; both were proven executably, against the real spawner and the real ledger, before anything was claimed. Each cost an amendment, a re-approval, and four added production files at 18c.

**What the phase has not done is see any of this work on a real ticket.** Every check is against fixtures. The 662 automatic checks say the mechanism behaves; they say nothing about whether a person's answer to a real question gets picked up and acted on. That is 18e, it is outstanding, and it needs fvermaut present — see below.

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 18a — the invitation offers both paths | Landed as planned. One module-private `invitationToAnswer`, used by `open()` and `conclude()`'s unfinished branch. Recorded a fence-indentation drift against the skill's template rather than fixing it on one side. | `273e6bf` |
| 18b — a wayfinder ticket is a ticket the daemon knows | **Escalated at gate 3, amended, re-approved, then landed.** The lifecycle now admits `picked-up → parked`; `runs.test.ts`'s guard re-pointed at `queued → parked`, not deleted. "`research` resolves unattended" withdrawn as unreachable and named as deferred. | `eaf20f5` |
| 18c — a written answer moves the ticket | **Escalated at gate 3, amended, re-approved, then landed** — one context stalled mid-slice and a fresh one finished from its uncommitted work. Gained `pipeline.ts`, `session.ts`, `ticketing.ts`, `gates.ts`. Four design questions settled by the amendment rather than inside the slice. | `62f69ea` |
| 18d — the words the human reads | Landed as planned. CTA-drift assertion judged **met**, mechanically: eight content lines each, zero word-level differences, indentation only. | `9db2017` |
| 18e — the live gate | **Not run.** Needs fvermaut present, and needs his permission to mark the nine `ivtrends` tickets. See below. | — |

Plan amendments: `f801203` (18b), `a21ef0d` (18c). Re-approvals: `6d4f50f`, `5f69f1c`.

## Deviations from the plan

- **Two scope-growing amendments, both at gate 3, both re-approved before work resumed.** They are recorded in full under their sub-phases in [phase-18.md](../phase-18.md) with `✏ Refined 2026-08-09` markers, and the reasoning is not repeated here.
- **"`research` resolves unattended" was withdrawn.** Reaching it needs `session.ts`'s `afterStage` to learn a third shape, which is larger than this phase's subject and is not something [R20](../../specs/prd/prd-02-inversion-of-control.criteria.md) asks for. A marked `wayfinder:research` ticket parks saying the machinery is not built — honest, and still not triage. The unattended path is named in the plan as deferred rather than dropped.
- **One load-bearing decision was overridden**, deliberately and in writing: every non-machine comment after the cursor joins to make the answer, not only the newest. The newest-only reading silently drops the first comment when someone answers and then adds a second thought.
- **No phase branch**, per the Branch line above.
- **One unidentified intermittent test failure**, seen once in eight full-suite runs during 18b's gate and never since. Its identity was not captured. Recorded in the handoff rather than explained away; stage 7 should treat it as an observation to watch, not a settled fact. The likeliest candidates are the guardrail tests, which drive real `git` in temporary repositories under parallel workers.

## Context for the next agent

**Running it.** `npm test` (662 across 20 files), `npm run type-check`, `npm run build` then `node dist/cli.js …`. Every prior slice's validation block was re-run at the close and all still pass: 18a's `npx vitest run src/channels` (16), 18b's `npx vitest run src/daemon src/commands/takeover.test.ts` (502) plus `takeover --help` against a freshly built `dist/`, 18c's `npx vitest run src/daemon` (481), 18d's `grep`/`npm test`.

**HUMAN-CHECK carried forward — 18e, the live gate, in full.** It is [phase-18.md](../phase-18.md)'s own five steps, and step 1 changed shape: the nine `ivtrends` tickets carry hand-written CTA blocks saying the takeover is unavailable, which is now false. Those blocks must be **replaced**, not appended to, or a ticket carries two sets of instructions disagreeing about reality.

**And a precondition 18d discovered that the plan did not anticipate: none of the nine tickets carries the `timone` mark.** 18b's routing therefore never fires on them and 18c's pickup never reads their comments — the machinery is built, live, and inert on precisely the tickets it was written for. Marking a ticket is what sets the machine going on it, so it is a permission rather than a chore; `STATUS.md` asks fvermaut for the word rather than taking it. **Marking them and replacing their bodies must happen together.**

**Known-open observations, flagged and not resolved** (all recorded in [phase-18-handoffs.md](phase-18-handoffs.md)):

- `waitingOn` still reads `"a conversation in your terminal"` for a park that can now be resolved in writing. Three slices have now noticed it; none was granted the file.
- The fence-indentation difference between `timone-wayfind`'s CTA template and `terminal.ts` — judged formatting, not drift, and left as it is.
- `afterStage` now takes seven positional parameters. Refactoring is stage 8's, not execution's.
- `CLARIFICATION_MARKER`'s human-facing wording has had no review pass.
- A double `getTicket` per cycle on the resume path.
- A resolved wayfinding run now completes rather than parking forever — new in 18c, and worth watching live, since it is the first transition that ends a run without a pull request.
