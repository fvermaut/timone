# Phase 22 — Completion Report

- **Date:** 2026-08-15
- **Plan:** [phase-22.md](../phase-22.md) — approved for execution by fvermaut 2026-08-14T21:58:15Z, reduced in scope by fvermaut 2026-08-15
- **Requirements:** PRD-02.R22 **not added and not closed**; PRD-02.R5 and PRD-02.R10 **keep their `verified` sign-off** — the retirement that would have lapsed them was not built
- **Branch:** `main` (as for phases 15–21), at `88c03df`, pushed

## Summary

**The phase delivered its ledger half and not its shaping half.** A ticket can now host a sequence of chunks, and a run can be ended by command — which is the identity change [ADR-0026](../../adr/0026-a-ticket-is-a-conversation-a-run-is-a-chunk.md) called for and nothing had built. The breakdown, the gate that was to move onto it, chunk succession and the live gate were **cut unbuilt** and are re-planned as their own phase. That split is not a retreat improvised at the end: [the plan's own dependency section](../phase-22.md#dependency-graph) said *"22a and 22b alone are worth landing even if the rest is amended: they close findings 8 and 9 and unblock phase 21"*, and that is exactly what happened.

**The centre of gravity turned out to be a distinction nobody had needed before.** `TERMINAL` had been doing two unrelated jobs since the daemon was built — freeing the project lock, and declaring a ticket finished. Under one-run-per-ticket those are indistinguishable, so nothing ever forced them apart. Chunking forces them apart: a failed chunk must free the project (so the next queued ticket starts) but must **not** let its own ticket advance, or `timone retry` would be racing a successor chunk for the same work. `TERMINAL` kept the lock job; **settledness** took the succession job. That was found by execution, not by planning, and is recorded as [ADR-0029](../../adr/0029-a-chunk-advances-only-on-success.md).

**Findings 8 and 9 from [phase 20's live gate](phase-20-live-gate.md) are closed, and they closed together as predicted.** Nothing starts on a ticket that is no longer open and marked, the check is asserted on the spawner rather than on a log line, and clearing a run no longer means hand-editing `.timone/state.json` — the whole point. [Phase 21](../phase-21.md)'s blocked prerequisite is therefore satisfied.

The suite went **818 → 859 green across 24 files**, type-check clean throughout. `.timone/state.json` was **never hand-edited and never modified**: it still holds its 26 original runs, and every live demonstration ran against a copy via `--state`.

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 22a — ADR-0028, and the ledger identity | Landed. Chunked run ids, `register` idempotent by live chunk, `liveRunForTicket`/`runsForTicket`, load-time normalisation of pre-chunk ids. Settledness added mid-slice on fvermaut's ruling; ADR-0029 written for it. 123 assertions across six suites moved to the new id format. **Two attempts** — the first failed its own `npm run type-check` and left 98 tests red, both for want of files the plan never granted. | `d48ce65` |
| 22b — A run can end, and nothing starts on a closed ticket | Landed. `cancelled` status and `timone cancel`; the poll loop cancels rather than spawns on a ticket no longer open and marked; `status`, `cta` and `takeover` each speak to it. Extended twice after the first return — the `takeover` arm, then `failed → cancelled` on fvermaut's ruling. Closes findings 8 and 9. | `88c03df` |
| 22c — The breakdown, and the gate that moves onto it | **Cut unbuilt** — gate 3. Under-granted by nine files, three of which are decisions rather than edits. | — |
| 22d — Chunk succession, and what the ticket says between chunks | **Cut unbuilt** — depends on 22c. | — |
| 22e — The register, the narrative, and status | **Cut unbuilt** — depends on 22a–22d. | — |
| 22f — The live gate | **Cut unbuilt** — depends on 22e. Its human gate was never reached. | — |

## Deviations from the plan

**Three amendments, all committed with dated `✏ Refined` markers** (`0d3bd84`, `e133f82`), made by the executing stage rather than routed to stage 5 — on fvermaut's explicit ruling of 2026-08-15 that the phase proceed under its existing stamp, taken with the alternative (stop and re-approve) in front of him.

1. **Settledness, and a chunk that advances only on success.** The plan asked for both *"a ticket with a terminal run accepts a second run"* and *"`retry` re-arms from failed"*. `failed` is terminal, so as written a failed chunk would have been succeeded on the next poll cycle and `timone retry` refused by the one-session guard — the plan contradicting itself, which is gate 3's own named case. Ruled by fvermaut: the failed chunk keeps its ticket. [ADR-0029](../../adr/0029-a-chunk-advances-only-on-success.md).
2. **Grants the plan was missing.** 22a gained `status.test.ts` and `cta.test.ts` (without them its own validation command could not pass) and the six files carrying 98 old-id assertions (which the plan assigned to nobody, so the phase could never have closed). 22b gained `cta.ts` (the `satisfies` tripwire makes `cancelled` a build break) and later `takeover.ts`.
3. **`failed → cancelled`, and unmarking.** Ruled by fvermaut: one command must end a run whatever state it is in, else finding 9 stays half-closed and the two failed runs in the live ledger — the residue phase 21 needs cleared — could only be removed by retrying them first, through a window the daemon polls. Separately confirmed that unmarking a ticket cancels the run about to start on it, as wanted rather than tolerated.

**A scope reduction, not an amendment.** 22c–22f were cut by fvermaut 2026-08-15. Per the re-approval rule a reduction keeps the stamp, so the phase closes against its original approval. The cut sections are kept verbatim in the plan as the next phase's raw material, with the reasoning recorded [in place](../phase-22.md#-cut-2026-08-15--22c-22d-22e-and-22f-are-not-built-and-are-not-this-phases-any-more).

**One test corrected under a behaviour change, named because it is a real one.** `poll.test.ts`'s *"holds its peace once the label lands…"* asserted `picked-up` after a ticket is unmarked; that now cancels. The test's actual subject — that the introduction is posted once — passes untouched.

## Context for the next agent

**How to run it.** `npm test` (859 tests, 24 files, ~42s), `npm run type-check` — **note the hyphen; there is no `typecheck` script**. `npm run build` before any `node dist/cli.js`.

**A live daemon is running** against `.timone/state.json` (it holds the lock and writes `observedAt` each cycle). Never point a mutating command at that file: copy it and use `--state <copy>`, as every slice here did.

**Known-open, carried forward:**

- **The live ledger still holds its residue** — 26 runs, of which 2 are failed (`scratch-app#10`, `#13`) and 1 parked. `timone cancel` can now clear all three without a hand-edit; nobody has, deliberately, because clearing them is [phase 21](../phase-21.md)'s to do inside its own gate.
- **A bare `switch` over a union is not exhaustiveness-checked.** `cta.ts`'s `satisfies` tripwire failed the build at the exact line when `RunStatus` widened; `takeover.ts`'s bare switch compiled clean, passed 856 tests, and shipped an untrue sentence until someone ran the command. Adding tripwires to the remaining switches is unclaimed work.
- **A flake was seen once and not reproduced** — one full-suite run in eight returned a single failure whose name was lost to a `tail`; the other seven were green, as were all subsequent runs. The suite's only wall-clock-sensitive tests are the real-`git` ones in `guardrails.test.ts`.
- **`guardrails.test.ts:563`** has a fixture trailer reading `Timone-Run: scratch-app#7`. It stays correct: [the plan established](../phase-22.md#why-this-phase-exists-and-why-it-is-next) that the trailer is built from project and ticket directly and is never parsed, so it is ticket-shaped by design and no slice should make it speak chunks.
- **Nothing was verified by stage 7 and nothing was observed live.** 22f was the phase's only live gate and it was cut, so every claim here rests on the suite and on demonstrations run against ledger copies.
