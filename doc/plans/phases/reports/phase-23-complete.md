# Phase 23 — Completion Report

- **Date:** 2026-08-15 → 2026-08-16
- **Plan:** [phase-23.md](../phase-23.md) — approved for execution by fvermaut 2026-08-15
- **Requirements:** PRD-02.R22 — built, **not verified** (stage 7 has not run); PRD-02.R5 and PRD-02.R10 — moved `verified` → `revised`
- **Branch:** `main` (as for phases 15–22), pushed
- **Live gate:** [phase-23-live-gate.md](phase-23-live-gate.md)

## Summary

**A ticket now arrives a piece at a time, and it was watched doing it.** The specification and the list of pieces are agreed in two approvals; each piece then yields one pull request and asks for nothing further; a merged piece opens the next; and the ticket closes itself when none remains. That is [ADR-0026](../../adr/0026-a-ticket-is-a-conversation-a-run-is-a-chunk.md)'s claim, [ADR-0030](../../adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md)'s mechanism, and it ran end to end on [`scratch-app` #31](https://github.com/fvermaut/scratch-app/issues/31) — two pieces, two pull requests, two approvals total, ticket closed by the machine.

**The phase's centre of gravity was not where the plan put it.** The plan expected the hard part to be the breakdown and the gate that moves onto it. Those landed close to as written. What actually cost the phase was **blast radius**: adding one stage to a graph reached `session.ts`'s fall-through (an unbounded paid loop on chores), `workBranch` (every chunk claiming one branch name), five exhaustive test tables, and — found only live — the outcome record that tells the daemon a wait-free stage has finished. Four of the nine slices needed grants the plan had not given them.

**Nine slices, all delivered.** The safe stopping point at 23a–23e was declared in advance and never needed; the phase ran to 23i.

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 23a — The breakdown artifact | Landed. Reads and writes `doc/plans/breakdowns/ticket-NN.md`; no writer past the initial render, per D4. Flagged the prompt-writes/code-reads hazard for the file path — the same hazard later bit the stamp. | `6f560ba` |
| — | Suite-wide flake fixed at the root: real-git fixtures need more than vitest's 5s. This is the flake [phase 22](phase-22-complete.md) recorded as "seen once and not reproduced". | `36255d5` |
| 23b — `breakdown` becomes a pipeline stage | Landed. New gated stage at `processStage: 5`; `planning` wait-free. Fixed the `afterStage` fall-through that would have looped a chore forever. Deferred two prompt edits to 23e deliberately. | `31b904f` |
| 23c — A chore is deliberately ungated | Landed. **No production edit** — the behaviour fell out of 23b. Its deliverable is proof (with a negative control) and two documents corrected. | `da8eef3` |
| 23d — Chunk zero merges on approval | Landed. The daemon's first write to a default branch, kept to one caller, one call site, one guard. Corrected the plan: `fetch` without a fast-forward would have been rejected non-fast-forward. | `56452dd` |
| 23e — A phase file gates nothing | Landed. Corrected the plan's gate 1, which as specified would have refused **every chore and every hand-run phase**. The exit stamp survives untouched. | `cc51a6d` |
| 23f — Chunk succession | Landed. The successor opens via the next cycle's registration loop, not from `concludeReview` — the ordering that keeps a queued bug's turn. Chunk 2's branch gains a suffix; chunk 1 renders byte-identically. | `e3742db` |
| 23g — What the ticket says between chunks | Landed. The call to action stops being computed from the last run and starts being computed from the initiative. Both surfaces go through one function, so they cannot drift. | `6660351` |
| 23h — The register, the narrative, and status | Landed. R5 and R10 to `revised`; the verified count **down** sixteen → fourteen, said in words. Refused the plan's wording for R10, correctly. | `a266b77` |
| 23i — The live gate | **Run to completion.** Seven defects found, three fixed mid-gate, four tracked. Human gate answered. | `c9ca376`, `45aba08`, `144a68b` |

## Deviations from the plan

**Five amendments, each with a dated `✏ Refined` marker**, made by the executing stage on fvermaut's standing ruling that the phase proceed under its stamp:

1. **`vitest.config.ts`** — outside every grant, taken as repository maintenance, because a red suite makes every later slice unable to tell its own breakage from inherited breakage.
2. **23c reversed** — fvermaut ruled a chore is just built, where the plan had it keeping a gate. Recorded as [ADR-0030](../../adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md) D3 with the risk he accepted.
3. **The breakdown is immutable after approval** — D4. Ticking it would mean the poll loop committing and pushing to a client's default branch, machinery that exists nowhere.
4. **23b gains `session.ts`** — for the fall-through regression the plan predicted and named.
5. **23h gains four sentences** left contradicting by 23e.

**Three fixes made outside any slice, during the live gate**, each committed on its own: the merge commit's provenance trailer (`476654d`), planning's outcome record (`760ca25`), and the breakdown stamp's date format (`737fe80`).

**One correction to a report after publication** (`144a68b`): finding 1's first draft said a handed-back run "listens for nothing", which overstated it — the reply *is* carried into the resuming session, it simply cannot trigger one. Corrected because fvermaut asked how the run was actually resumed.

## Context for the next agent

**How to run it.** `npm test` (932 tests, 25 files), `npm run type-check` — **note the hyphen**. `npm run build` before any `node dist/cli.js`. `vitest.config.ts` now sets `testTimeout: 20_000`; the real-git fixtures need it.

**A daemon may be running and holding the ledger lock.** While it is, `retry`, `cancel` and `takeover` are all refused — see the gate report's finding 2. To act on a ticket: stop the daemon, act, restart.

**Known-open, carried forward:**

- **Four tracked defects**, [issues 1–4 on this repository](https://github.com/fvermaut/timone/issues). Findings 1 and 2 are the same missing thing from two sides: a stalled run has no trigger a human can reach through the ticket, and the only trigger there is cannot run while the daemon holds the lock.
- **Nothing here has been verified by stage 7.** The live gate is evidence for a verifier, not a verdict. PRD-02.R22 stays `draft`.
- **A bug taking its turn between chunks was never observed.** The window existed twice and nothing was queued in it.
- **`timone cancel` and the closed-ticket check were never exercised live**, because finding 2 makes `cancel` unrunnable while the daemon is up. Both remain unit-proven only, and the live ledger still holds the residue phase 21 wants cleared.
- **R22 clause 5 no longer matches what was built** — recorded in the register with the replacement wording named, and assigned to stage 9.
- **Cost is a real constraint.** $216.09 for a two-piece fixture, 59% of it execution. A five-piece milestone on `ivtrends` is not a linear extrapolation, but it is not a small number either.
