# Phase 54 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 54a — The closing line never names a finished run

**Built.** The last line of `timone status` names a ticket only when one of its runs is parked and the runner asked for something. A done run is never named, whatever initiative picture is in the ledger. `timone status` no longer reads a list of pieces from a checkout, so it no longer reaches git or a folder under `projects/`. The project's own line is unchanged.

**Files touched.**

- `src/commands/status.ts` — `waitsOnYou(run)` keeps only its parked arm and no longer takes the render context. Its doc comment says a done run waits on nobody and why (ADR-0060, ADR-0065 D6, old pictures stay in the ledger), with a `✏ 2026-10-06 (#186)` note. Removed: `checkoutOf`, `progressReader`, `RenderContext.progressOf`, the `root` and `breakdownSource` options, the `root:` the command passed, and the imports only they used (`join`, `fromDefaultBranch`, `SyncBreakdownSource`, `initiativeProgressSync`, `progressOf`, `InitiativeProgress`). The comment above the closing-line `waiting` block is rewritten: it no longer says done runs can wait; it keeps the dedupe by ticket because the ledger can still hold more than one parked run of one ticket.
- `src/commands/status.test.ts` — four new cases in a new `describe("renderStatus — a finished run is never named (#186)")`. The old test "names a ticket once in its closing line however many pieces it has had" is replaced by case 5 ("… however many runs it has had"). Removed `breakdownIn`, `rootWith`, `breakdown`, and the imports only they used (`writeFileSync`, `breakdownPath`, `fromWorkingTree`, `SyncBreakdownSource`).
- `src/guards/checkouts.test.ts` — `EXEMPT["commands/status.ts"]` deleted. The comment above `GIT_USERS["git.ts"]` no longer says `status.ts` reaches git through `fromDefaultBranch`; it keeps the general rule and adds a dated note. `GIT_USERS["daemon/breakdown.ts"]` is left for 54b.

**Decisions taken inside the slice.**

- Cases 1-4 share one picture (`#7`, steps 51-53, 2 done, no `next`) and a small `closingLine` helper, inside their own `describe`. Case 3 copies the ledger fixture inline, as the three tests at "the runs the old code left in the ledger" do, so it reads top to bottom.
- `waitsOnYou` lost its `context` parameter, since the parked arm never used it. Leaving it would have been an unused parameter.
- The removed comment "One reader for the whole render, so a ticket's list of pieces is read once …" above `livenessOf` was about `progressReader` and went with it.
- The `EXEMPT` doc comment ("three of the four are things phase 30 promises to keep") was already out of date before this slice. The plan did not name it, so it is left as is.

**Validation evidence.**

Red-green trace. Cases 1-5 were written first, with `status.ts` unchanged, and run:

```
$ npx vitest run src/commands/status.test.ts --no-color
 FAIL  … a finished run is never named (#186) > names nobody for the finished steps of an initiative with steps left
Expected: "**What I need from you:** nothing — nothing is waiting on you right now."
Received: "**What I need from you:** answer on scratch-app #51, scratch-app #52 — each ticket says what it needs."
 FAIL  … a finished run is never named (#186) > names nobody for a finished run on the map ticket itself
Expected: "**What I need from you:** nothing — nothing is waiting on you right now."
Received: "**What I need from you:** answer on scratch-app #7 — each ticket says what it needs."
 FAIL  … a finished run is never named (#186) > names only the parked runs that asked, in a real ledger beside old pictures
Expected: "**What I need from you:** answer on scratch-app #24, ivtrends #90, ivtrends #91, ivtrends #92, ivtrends #93 — each ticket says what it needs."
Received: "**What I need from you:** answer on scratch-app #12, scratch-app #24, ivtrends #60, ivtrends #90, ivtrends #91, ivtrends #92, ivtrends #93 — each ticket says what it needs."
 FAIL  … a finished run is never named (#186) > still names a parked step whose run asked for something, beside finished ones
Expected: "**What I need from you:** answer on scratch-app #53 — each ticket says what it needs."
Received: "**What I need from you:** answer on scratch-app #51, scratch-app #52, scratch-app #53 — each ticket says what it needs."
 ✓ … who the closing line names > names a ticket once in its closing line however many runs it has had
      Tests  4 failed | 50 passed (54)
```

Case 4 was red before the change, not green as the plan says. On today's code it names #53, but it also names the done runs #51 and #52, because the picture beside them has steps left and no `next`. The plan's expected line says "#53 and only it", so the old code cannot pass it. The part that matters, that #53 is named, held before and holds after. Case 5 was green before, as planned.

After the change to `status.ts`, all five are green:

```
 ✓ … who the closing line names > names a ticket once in its closing line however many runs it has had
 ✓ … who the closing line names > names in its closing line exactly the tickets that are waiting on the reader
 ✓ … a finished run is never named (#186) > names nobody for the finished steps of an initiative with steps left
 ✓ … a finished run is never named (#186) > names nobody for a finished run on the map ticket itself
 ✓ … a finished run is never named (#186) > names only the parked runs that asked, in a real ledger beside old pictures
 ✓ … a finished run is never named (#186) > still names a parked step whose run asked for something, beside finished ones
 ✓ which step of an initiative is live > names the live step, its initiative and how many there are
 ✓ which step of an initiative is live > says what is next when an initiative is between steps
 ✓ which step of an initiative is live > says an initiative is waiting when no step is eligible
 ✓ which step of an initiative is live > says nothing about an initiative whose steps are all done
 ✓ which step of an initiative is live > leaves a project with no initiative reading as before
```

The validation block, as run:

```
$ npx vitest run src/commands/status.test.ts src/guards/checkouts.test.ts src/daemon/breakdown.test.ts
 Test Files  3 passed (3)
      Tests  98 passed (98)

$ npx tsc --noEmit; echo "exit: $?"
exit: 0

$ awk '/^function waitsOnYou/,/^}/' src/commands/status.ts | grep -v '^\s*//' | grep -v '^\s*\*' | grep -c 'done'; echo "exit: $?"
0
exit: 1

$ grep -nE 'progressReader|breakdownSource|checkoutOf|initiativeProgressSync|fromDefaultBranch' src/commands/status.ts | grep -v '^\S*:\s*//' ; echo "exit: $?"
exit: 1
```

`npx vitest run` (the whole suite) was not run here. The runner's instruction for this step is to run only the tests of what changed; the whole suite runs once, at the phase's close.

- [x] Cases 1, 2 and 3 were red before the change to `status.ts` and are green after; both runs are shown above.
- [x] Case 4 is green after the change. It was red before, for the reason given above: the old code also named the done runs beside it.
- [x] The tests under "which step of an initiative is live" pass and were not edited. There are five of them, not four.
- [x] `src/guards/checkouts.test.ts` passes with `commands/status.ts` gone from `EXEMPT`.
- [ ] The whole suite passes: left to the phase's close, as the runner said. `tsc --noEmit` exits 0.

Tests run at the slice's end:

- `src/commands/status.test.ts` — 54 passed.
- `src/guards/checkouts.test.ts` and `src/daemon/breakdown.test.ts` — passed (98 in total with the file above).
- `src/planner/plan-files.test.ts` (names `src/commands/status.ts` as a path) — 4 passed.
- `src/cli.test.ts` (runs `dist/cli.js`, which imports `status.ts`) — 7 passed, after `npx tsc` built `dist/`. Without a build all 7 fail with "Cannot find module dist/cli.js". `dist/` is gitignored and was removed again after the run.
- `npx tsc --noEmit` — exit 0.

**What 54b must know.**

- Nothing in `src` outside `daemon/poll.ts`, `daemon/breakdown.ts` and their tests now uses `fromDefaultBranch`, `initiativeProgressSync`, `progressOf` or `InitiativeProgress`. `status.ts` imports nothing from `daemon/breakdown.ts` or `daemon/poll.ts`.
- `GIT_USERS["daemon/breakdown.ts"]` in `src/guards/checkouts.test.ts` still says "`fromDefaultBranch`, the on-disk source `timone status` builds", which is no longer true. The new comment above `GIT_USERS["git.ts"]` names `fromDefaultBranch` in a dated note about the past; if 54b deletes that function, that note can stay as it is.
- `src/daemon/poll.test.ts` still has its own `breakdownSource` helpers and a comment naming `checkoutOf`; this slice did not touch them.
