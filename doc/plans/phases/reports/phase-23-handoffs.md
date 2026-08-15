# Phase 23 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 23a — The breakdown artifact

**Built.** `src/daemon/breakdown.ts` — a daemon module that reads, parses and renders a breakdown: the markdown list of chunks an initiative will be built in, at `doc/plans/breakdowns/ticket-NN.md` in a managed project's checkout ([ADR-0028](../../../adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md) D1). It answers four questions and writes nothing: what the file says (`parseBreakdown` / `renderBreakdown`, mutual inverses), where the file is (`breakdownPath`, the only place the path is spelled), what is in it on disk (`readBreakdown`, which returns `ok` / `absent` / `malformed` and **never throws**), which chunk is next given how many the ledger has settled (`chunkProgress`), and whether the list has grown since the human approved it (`isReproposal`).

**Nothing is wired to it.** No other file in `src/` learns the path, per the slice's own grant — `git grep -n "breakdowns/" -- src` outside the two new files returns nothing.

**[ADR-0030](../../../adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md) D4 is respected literally: the module has no writer.** There is no function that stamps, ticks or otherwise edits a breakdown. `renderBreakdown` exists solely as `parseBreakdown`'s inverse, so the round-trip is assertable; it takes a whole `ParsedBreakdown` and returns a string, and nothing in this slice puts a string on disk.

**Files touched.**
- `src/daemon/breakdown.ts` — created.
- `src/daemon/breakdown.test.ts` — created; 12 tests.
- `doc/plans/phases/reports/phase-23-handoffs.md` — created (this file, with its header — 23a is the first slice).

**Decisions taken inside the slice.**

1. **The file's concrete markdown shape**, which the plan described but did not spell:

   ```markdown
   # Breakdown

   **Status:** Approved by fvermaut 2026-08-15 — 3 pieces

   1. **The ledger learns chunks** — a run carries its sequence number.
   2. **The next chunk opens** — a merged pull request opens the next one.
   3. **The ticket closes** — the last merge closes the conversation.
   ```

   The `Status:` line is matched with optional markdown emphasis (`**Status:**`, `__Status:__`, bare `Status:`) and the chunk lines with either an em dash or a hyphen as the title/delivers separator, because the file is written by a stage session and read by the poll loop — tolerating the two spellings a writer might reach for is cheaper than a project stalling on a dash. The stamp itself is **not** tolerant: anything that is neither `Awaiting approval` (case-insensitive) nor `Approved by <who> <date> — N pieces` is `malformed` with a reason quoting what it actually read.

2. **`ParsedBreakdown` carries no ticket number**, so the heading is the fixed string `# Breakdown` and the parser ignores it entirely. The filename carries the ticket's identity and `breakdownPath` is the only place that is spelled; putting the number in the body too would create a second copy that can disagree with the path, and would add a malformed class the plan did not declare.

3. **`ticket-NN.md` is zero-padded to two digits** — `ticket-07.md`, `ticket-23.md`, `ticket-123.md`. Consistent with `doc/plans/phases/phase-01.md` next door and `doc/triage/001-…`, so `doc/plans/` reads as one convention. **This is the slice's one real hazard for later slices — see below.**

4. **`chunkProgress` clamps `done` at both ends** (`Math.min(Math.max(doneChunks, 0), total)`). Clamping at `total` is the plan's; clamping at 0 is mine, because a negative count would otherwise produce a `next.index` of 0 or less — a nonsense chunk number handed to a caller that will put it in front of a human. Both clamps answer rather than throw, which is what a per-cycle reader needs.

5. **`isReproposal` is `chunks.length > stamp.pieces`, strictly.** A list *shorter* than its stamp is not called a re-proposal: that is a breakdown that lost a chunk, a different event, and naming it here would let a later caller re-gate on the wrong thing. An `Awaiting approval` breakdown is `false` — nothing approved, nothing re-proposed.

6. **`readBreakdown` returns the full joined path on every arm**, not the repo-relative one, so a log line or a ticket comment can name the file on a machine the reader is not sitting at (the house rule that errors name the file they came from). An unreadable-but-present file (permissions, a directory in its place) is reported as `malformed` carrying the OS reason, for the same never-throw reason as the rest.

**Validation evidence.**

Baseline before the slice: **859 tests / 24 files**, `npm run type-check` exit 0.

Red → green, in execution order:

| Case (as the plan declares it) | Red — the failure actually seen | Green |
|---|---|---|
| Round-trip, `Awaiting approval`, three chunks | `Cannot find module './breakdown.js'` — neither function existed | ✅ |
| Round-trip, `Approved by fvermaut 2026-08-15 — 3 pieces`, preserving who/date/count | **Mutation probe** (the approved arm was already written): dropped `${stamp.at}` from `renderStamp` → `AssertionError: expected { kind: "malformed", reason: 'unreadable \`Status:\` line "Approved by fvermaut — 3 pieces" …' } to deeply equal { kind: "approved", by: "fvermaut", at: "2026-08-15", pieces: 3 }`. Reverted. | ✅ |
| `chunkProgress(b, 1)` answers chunk 2 | `TypeError: (0 , chunkProgress) is not a function` | ✅ |
| `chunkProgress(b, 3)` answers `next: undefined` | **Mutation probe**: removed the `next === undefined` guard so a progress record always carries a `next` → the exhausted case failed, the `done: 1` case stayed green. Reverted. | ✅ |
| `doneChunks` larger than the list is clamped, not thrown | **Mutation probe**: dropped `Math.min(…, total)` → `AssertionError: expected { total: 3, done: 7 } to deeply equal { total: 3, done: 3 }`, with the other four progress/round-trip tests still green. Reverted. | ✅ |
| Re-proposal: 2-over-3 true, 3-over-3 false, awaiting false | `TypeError: (0 , isReproposal) is not a function` — all three arms red at once | ✅ |
| Absent file answers, malformed-no-list and malformed-no-status answer with a readable reason | `TypeError: (0 , readBreakdown) is not a function` — all four arms red at once; the absent case reported as `expected [Function] to not throw an error but 'TypeError: … readBreakdown is not a function' was thrown`, which is the assertion the excerpt asks for doing its job | ✅ |

**Three cases could not honestly be driven red** and were verified by mutation instead, marked above: the approved round-trip and both `chunkProgress` edge answers. In each case the implementation that turned the *previous* case green already covered them; the probe mutated the implementation, the assertion failed for the stated reason, and the mutation was reverted.

Excerpt's validation commands, run at the end:

- `npm test -- src/daemon/breakdown.test.ts` → **12 passed (1 file)**.
- `npm run type-check` → **exit 0**, no output.
- `npm test` → **871 passed, 25 files** (was 859 / 24).

Checkboxes:

- ✅ **PASS** — `readBreakdown` against a temp directory containing no `doc/` at all returns `{ kind: "absent", path }`, asserted with `expect(() => readBreakdown(dir, TICKET)).not.toThrow()` **around the call itself** (`breakdown.test.ts`, "answers rather than throwing when the project has no doc/ at all"), followed by a separate `toEqual` on the returned answer.
- ✅ **PASS** — the re-proposal pair is asserted both ways: a stamp naming 2 pieces over a 3-chunk list is `true`, the same list under a stamp naming 3 is `false`, plus an `Awaiting approval` third case.
- ✅ **PASS** — `git grep -n "breakdowns/" -- src ':!src/daemon/breakdown.ts' ':!src/daemon/breakdown.test.ts'` returns nothing (exit 1, no output). Nothing is wired.
- ✅ **PASS** — full suite green and the count went **up**: 859 → 871 tests, 24 → 25 files.

**What 23b must know.**

1. **The path spelling is the one thing that can silently break this.** `breakdownPath(7)` is `doc/plans/breakdowns/ticket-07.md`, zero-padded. The writer of the artifact is a **prompt**, not this module, so nothing type-checks the two against each other: if a later slice tells the breakdown-stage session the path in prose and that prose says `ticket-7.md`, `readBreakdown` will answer `absent` for ever and the poll loop will conclude the initiative has no breakdown. **Whatever slice writes the breakdown prompt must interpolate `breakdownPath(ticket)` into it rather than restating the path**, and if you disagree with the padding, change it here — it is one function — rather than in the prompt.

2. **There is no writer, and adding one is re-opening D4.** The module cannot stamp a breakdown `Approved`. The approval stamp is written by the same mechanism every other artifact's is — the approval-record session (`prompts.ts`'s `APPROVAL_RECORD`) — which needs a `breakdown` row saying what the stamp reads, **including the `— N pieces` count**, because that count is what `isReproposal` compares against. A stamp written without it parses as `malformed` and the whole file becomes unreadable. That row is not in this slice.

3. **`parseBreakdown`'s malformed arm is discriminated by `kind`, and `ParsedBreakdown` deliberately has no `kind` field** — that is the signature the plan fixed. So callers narrow with `"kind" in parsed`, which is what `readBreakdown` does. It works and it is type-safe, but it is the one place a reader has to look twice. **If a future slice is free to change the signature**, the refactor I would make is to tag the success arm too (`{ kind: "ok"; breakdown }`) so the union discriminates on one field like every other state in the codebase (`standards/typescript.md`: states are discriminated unions). I left it alone because the plan named the signature.

4. **`chunkProgress` takes a count, not a ledger.** It is deliberately ignorant of `RunStore` — the caller asks the ledger how many of the ticket's chunks have **settled `done`** and passes the number. Note the word: `runs.ts` distinguishes `TERMINAL` from `SETTLED`, and `cancelled` is settled but not done. Which of those two the caller counts is 23f's decision and this module has no opinion; it will clamp whatever it is given.

5. **`renderBreakdown` is not dead code and should not be deleted as such.** It exists so the round-trip is assertable, and it is what a later slice would use if a breakdown ever needs to be produced programmatically. Today its only caller is the test.

## 23b — `breakdown` becomes a pipeline stage

**Built.** `breakdown` is a stage of its own between `requirements` and `planning` ([ADR-0030](../../../adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md) D1). It declares `processStage: 5`, `waits: "gate"`, `ownsBranch: true`, `built: true`, `next: "planning"`, on `claude-opus-5` / `high`. `requirements.next` is now `breakdown`, and **`planning` moved from `waits: "gate"` to `waits: "none"`** — it keeps its branch, its model and its `next: "execution"`, and it no longer stops for anybody. The gated set is exactly `["requirements", "breakdown"]`.

**Files touched.** `src/daemon/pipeline.ts`, `src/daemon/session.ts`, `src/daemon/gate-comment.ts`, `src/daemon/prompts.ts`, `src/commands/status.ts`; tests in `pipeline.test.ts`, `cta.test.ts`, `prompts.test.ts`, `session.test.ts`, `status.test.ts`, `poll.test.ts`.

### The two traps, and which one the compiler catches

**The compiler catches `stageBody`.** `PROMPTED_STAGES` gaining `"breakdown"` with no `case "breakdown"` in `stageBody`'s switch is a build failure — the function returns `string` and the switch has no `default`. Seen red before the case was written: `src/daemon/prompts.ts(328,4): error TS2366: Function lacks ending return statement and return type does not include 'undefined'.` You may lean on this one; it fires at `npm run type-check`.

**The compiler does not catch `GATED`.** `GATED` in `gate-comment.ts` and `STAGE_LABELS` in `status.ts` are both `Partial<Record<PipelineStage, …>>`. A gated stage with no `GATED` row is not a type error, not a build failure and not a test failure: `gateCommentFor` answers `undefined`, `openGate` reads `if (comment !== undefined)`, posts nothing, and **parks the run on the gate anyway** — so the run waits for ever for an answer to a question nobody was asked, and every surface reports it as normally waiting. The red was seen exactly that way: `breakdown gates, but has nothing to put in front of the human`, with `npm run build` and `npm run type-check` both clean at the time. The guard is `session.test.ts`'s *"gives every stage that gates something to put in front of the human"*, which **derives** the gated set from `PIPELINE_STAGES` rather than spot-checking `breakdown`. **Do not turn that into a literal list.**

`STAGE_LABELS` is the same silence with a smaller cost: an unlabelled stage falls back to its own name. `breakdown` got a row anyway — bare "breakdown" on a status line reads as *something broke*, not as work in progress. It now reads `working out the pieces`.

### The trap the cut did not name: `afterStage`'s fall-through

**Moving `planning` to `waits: "none"` was a live regression, and it type-checked.** `afterStage` dispatches on `waitFor(stage)`, then on the stage by name, and its final fall-through assumed the only remaining wait-free stage was `triage`: it reads a `triage:<kind>` label off the ticket and routes on it. A finished planning session landed there and got triage's judgement applied to it — three different wrong answers depending on the label:

- `triage:feature` → back to **`clarification`**, re-opening an interview the human had already had;
- `triage:chore` → back to **`planning`**, which is `spawn`'s `for(;;)` with no bound — **an unbounded loop of paid sessions**;
- no `triage:` label → the run failed on *"triage recorded no classification"*.

**This was not a theoretical red.** With `planning` wait-free and no fix, `npx vitest run src/daemon/session.test.ts` did not report a failure — it spun for **258 seconds and died on `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory`**, 4094 MB, taking the worker with it. The existing chore-driven tests were the ones that hit it.

**The fix** is a `planning` branch immediately before the fall-through, using `afterWorkStage` exactly as `execution` and `verification` do, with **`producedWork` as the artifact witness**:

```ts
if (stage === "planning") {
  return this.afterWorkStage(run, project, stage, outcome, async () => ({
    ok: producedWork,
    observed: producedWork
      ? "the branch carries what it planned"
      : "nothing was committed to the branch",
  }));
}
```

`producedWork` is the branch-tip comparison R5's history records being installed after the daemon once believed a session's exit code alone. It is doing more work at this stage than at any other: with the gate gone, **nothing else stands between an empty branch and a build session**. Four tests hold it, on a ticket carrying each of the three labels above plus one with the witness false.

**The fall-through now carries a comment saying it is a fall-through** — every future wait-free stage inherits triage's judgement silently, and it type-checks whatever reaches it.

### Decisions taken inside the slice

1. **`prompts.ts` imports `breakdownPath` from `breakdown.ts`.** The excerpt says *"23b does not import `breakdown.ts`"* and then gives the reason that argues for importing — *"two slices spelling that path independently is how they drift"*. The reason won: `breakdownPrompt` interpolates `breakdownPath(ticket.number)`, so the prompt says `doc/plans/breakdowns/ticket-07.md` because that module says so. Restating it in prose would have made `readBreakdown` answer `absent` for ever the first time somebody typed `ticket-7.md`. **See "what is wrong in the excerpt" below.**

2. **`APPROVAL_RECORD`'s values became `(ticket) => ({artifact, what})`** rather than flat objects. The breakdown's artifact is a path carrying the ticket's own number, and `breakdownPath` is the only place that path may be spelled — a flat string could not reach it. The `breakdown` row tells the session to write `Approved by <who> <date> — N pieces`, **counting the pieces**, because `parseBreakdown` accepts no other shape and `isReproposal` compares that count against the length of the list. Two tests hold it: one on the prompt's words, one driving the shape through 23a's own `renderBreakdown` → `parseBreakdown` round trip, so it survives a rewording.

3. **`planning`'s `APPROVAL_RECORD` row was left in place**, though ADR-0030's consequences say it goes. It is now unreachable — no approval is recorded for a stage that never gates — but the phase file's `Status:` line is still what `timone-execute` gate 1 refuses to start without. Deleting this half before the skill's half moves would leave every phase file unstamped and every build refusing to start. **Whichever slice changes `timone-execute` gate 1 removes this row in the same commit.** `planningPrompt`'s `Awaiting approval` instruction is left standing for the same reason.

4. **`requirements`'s `onApproval` wording changed** from *"come back with a plan"* to *"break the work up and come back with the pieces"*. Not in the excerpt's markers, but it is inside a granted file and it had become false: approving the specification now advances to `breakdown`, and a CTA describing a consequence that no longer happens is the class of defect gate comments exist to avoid.

5. **The breakdown prompt spells the file's markdown out in a fenced block.** It stands alone because no skill describes a breakdown until 23e, and the shape is not decoration — anything `parseBreakdown` does not recognise is `malformed`, which is indistinguishable from *no breakdown at all*. Both shapes it dictates (`Awaiting approval`, and the approval-record row's stamp) were verified end-to-end against 23a's parser.

### Tests corrected

**On the plan's expected list.** `pipeline.test.ts`'s gated-set assertion (now `["requirements", "breakdown"]`, still derived from `PIPELINE_STAGES`) and its model table and `runsUnattended` rows; `cta.test.ts`'s `WAIT_AT` (gains `breakdown: "gate"`, flips `planning` to `undefined`); `session.test.ts`'s `gateCommentFor("planning", …)` pair — the "one gate mechanism for both stages" assertion is now **derived from the graph** rather than naming its two stages, and "links the plan where the plan actually lives" became "links the list of pieces where the breakdown actually lives"; and the three chore-driven gate tests, re-pointed at `requirements` (below).

**Not on the list, all caused by the same graph change.** Six more, named here because the next stage-adding slice will hit them too:

- `pipeline.test.ts` *"runs clarification → requirements → planning → execution"* and *"waits … on a gate at both write stages"* — the excerpt's own "Red" for the graph case, so expected in substance if not by line.
- `pipeline.test.ts` *"advances a waiting run exactly one stage on approval"* (`readGate("planning", …)` now **throws**) and *"never advances on a change request, at either gated stage"* (same throw). The latter is now derived from `waitFor` instead of written out.
- `session.test.ts` *"parks awaiting the building that is not built, and says so"* — re-pointed at `breakdown`, which is now the stage that stops for an answer.
- **`poll.test.ts` *"advances a gate the human approved"*** — approving `requirements` now hands `{stage: "breakdown"}` to the spawner. **`poll.test.ts` is in no slice's file grant in this phase**; it is the fourth file the graph reaches.

The three chore-driven gate tests (`refuses to gate when the stage cut a branch and committed nothing`, `gates normally…`, `still judges an existing branch…`) were **re-pointed from `planning` to `requirements`, not weakened**. They test the 2026-08-07 defect where `headBefore` was undefined because the branch did not exist; the original comment calls that "the first stage to own a branch", which *is* `requirements`. Driving them at `planning` was only ever the shortest route to a stage that both gated and owned a branch, and ADR-0030 D3 removed a chore's every gate on purpose.

**One test added for D3 rather than corrected:** the chore case asserts no comment anywhere in the run contains the approval CTA — a chore now meets no gate at all, which is a ruling and not an oversight.

### Validation evidence

| Command | Result |
|---|---|
| `npm run type-check` | **exit 0**, no output |
| `npm test -- pipeline cta prompts session` | **323 passed (4 files)** |
| `npm test` | **890 passed, 1 failed (891 / 25 files)** — see below |
| `npm run build` | **exit 0** |
| `node dist/cli.js status --state <copy>` | **exit 0**, rendered clean; live ledger byte-identical afterwards |

Checkboxes:

- ✅ **PASS** — `npm run type-check` was seen red on the missing `stageBody` case before it was written: `src/daemon/prompts.ts(328,4): error TS2366`.
- ✅ **PASS** — the gated-set assertion reads `["requirements", "breakdown"]` and the set is `PIPELINE_STAGES.filter(s => waitFor(s) === "gate")`, not a literal compared to a literal.
- ✅ **PASS** — `session.test.ts` asserts `gateCommentFor` is defined for **every** stage whose `waitFor` is `"gate"`, computed from `PIPELINE_STAGES`. Seen red on `breakdown` with the build and the type-check both clean.
- ✅ **PASS** — `node dist/cli.js status` was run against a **copy** (`--state <copy>`); `.timone/state.json` was never written and is unchanged.
- ✅ **PASS** — this section names which trap the compiler catches and which it does not, in those words.

### ⚠ The one open failure, and it is not this slice's logic

`src/commands/guardrails.test.ts > finding the run that drove a session > resolves the session id against the ledger` **times out at 5000 ms** in the full suite. It is not a logic regression:

- it **passes** running `guardrails.test.ts` alone (23 tests, 38 s);
- the whole suite **passes 891/891 under `npx vitest run --testTimeout=20000`**;
- it fails **3 runs out of 3** at the default timeout on this branch, and **0 out of 1** at the 23a baseline.

The cause is load. That test calls a `workspace()` fixture that shells out to real `git` about eight times (`init`, `config`×2, `add`, `commit`, remote init, push…) inside a 5000 ms budget, in a file that spends 38 s in subprocesses. This slice added 20 tests, which was enough to push it over. **Nothing in `guardrails.test.ts` touches anything this slice changed, and it is in no slice's file grant, so it was left alone.** The fix belongs to whoever owns that file: give the git-shelling fixtures an explicit per-test timeout, or set `testTimeout` in `vitest.config`. **It will bite every subsequent slice in this phase**, since each adds tests.

### What 23c onward must know

1. **`poll.test.ts` is reached by the graph and is in nobody's grant.** Add it to the file markers of any slice that touches `PIPELINE_STAGES`, `STAGES` or a `next`. It was the one file outside the four the plan enumerated.
2. **`readGate` throws on an ungated stage.** `requireWait` is loud by design, so any test naming `planning` and a gate now fails with `Stage planning waits on nothing, not on a gate` rather than with a wrong value. That is the good failure mode; do not soften it.
3. **The merge is not built.** ADR-0030 D2 — approving the breakdown merges chunk zero into the default branch without a pull request — is **not in this slice**. Approving `breakdown` today records the stamp and advances to `planning`; nothing merges, and `src/git.ts` still has no merge-into-another-branch primitive. Chunk 1 therefore cuts from a default branch that does **not** yet carry the specification.
4. **`breakdown` inherits chunk zero's branch, it does not cut one.** `claimBranch` returns early when the run already has a branch, so `ownsBranch: true` costs nothing and keeps the project held across the gate (ADR-0028 D2). Verified by the re-pointed gate tests, which claim a branch at `requirements` and see `breakdown` reuse it.
5. **Nothing yet reads a breakdown off disk.** `readBreakdown`, `chunkProgress` and `isReproposal` still have no caller in `src/` outside their own tests. The stage writes the file and the gate opens over it; the poll loop learning to read it is 23f's.
6. **`process.md` and `.claude/skills/timone-triage/SKILL.md` still describe a chore as meeting the plan gate**, and `.claude/skills/timone-execute/SKILL.md` gate 1 still refuses a phase file not stamped `Approved for execution`. ADR-0030's consequences require all three to move **in this phase**. Under D1 every per-chunk phase file is exactly what gate 1 refuses, so **execution would refuse every chunk** until that slice lands.

## 23c — A chore is deliberately ungated

**Built: nothing under `src/` that runs.** This slice changes no production file, and that is the slice, not a shortfall. `routeAfterTriage`'s `case "chore"` still returns `{ kind: "advance", stage: "planning" }`, untouched; 23b made `planning` wait-free, so a chore has met no gate since 23b landed. What was missing was that **nothing proved it and two documents still described the old route.** The deliverable is proof and record: two tests, and the two sentences that would otherwise let a future reader treat the loss as a bug.

**The ruling, so it is on the record where 23i can quote it.** On **2026-08-15** fvermaut was asked, in plain words and with a preview of what would land on a GitHub ticket, whether a small chore — *bump the linter* — should put a plan in front of him first, or just get built with his judgement on the pull request. **He chose *just build it*.** He was shown the risk in the same breath — **nothing stops a misread chore before the work happens** — and accepted it. So a chore runs **triage → planning → execution → a pull request with no human gate at any point**, and merging that pull request is where his judgement now lands. Merging is still his act, so nothing ships unreviewed; what he gave up is being asked *before* something small is built. **This is a gate a chore had and lost on purpose.** It is not a regression, not a fix and not an improvement, and the alternative was real: ADR-0030 D3 names it — routing chores through `breakdown` keeps a gate, and a one-chunk breakdown ("one piece — do the thing") would have read naturally enough, at the cost of a gate on every chore including the ones where the answer is obviously yes.

**Files touched.**
- `src/daemon/pipeline.test.ts` — the chore arm of `routeAfterTriage` keeps its expected value and gains the property.
- `src/daemon/session.test.ts` — a new block, `a chore meets no gate on the way to its pull request`: the walk and its control, +2 tests.
- `process.md` — stage 1's routing sentence only (line 27). **Stage 5's row, stage 5's `Status` lifecycle and stage 6's entry gate are untouched** — they are 23e's, and two slices editing one file is why these do not run in parallel.
- `.claude/skills/timone-triage/SKILL.md` — the routing table's chore row only (line 45).
- `doc/plans/phases/reports/phase-23-handoffs.md` — this section.

**Decisions taken inside the slice.**

1. **The gate probe matches `gateCommentFor`'s own rendering, and derives its stage list from the graph.** `gateMarkers(stage)` renders the real comment and takes two lines out of it — the stage's headline and the `**What I need from you:**` CTA — and `gatesPostedIn(bodies)` reports *which* gates a walk posted rather than how many. Two consequences worth keeping: a re-wording of a gate comment moves the probe with it instead of leaving it silently matching nothing, and a failure reads `expected [ 'planning' ] to deeply equal []` — it names the gate it found. The gated set is `PIPELINE_STAGES.filter(waitFor === "gate")`, so a third gated stage is covered the day it exists, exactly as 23b's own derived assertion is. **Do not turn either into a literal list.**

2. **`gateMarkers` throws for a gated stage `GATED` has no row for.** That is 23b's uncatchable trap arriving from a second direction, and it is deliberate: a walk that could not build a marker for a stage must fail loudly rather than conclude the stage posted nothing.

3. **The walk's fake session reads its stage off the ledger.** `walkingRuntime` asks `store.get(runId)?.stage` — which is where `spawn` writes the stage *before* the session starts — and plays triage, a conversation or a work stage accordingly. One `spawn` crosses three stages here, and a fake answering the same way at each of them could not tell triage from planning. It dispatches on `waitFor(stage) === "conversation"` rather than on the name `clarification`, for the same reason as above.

4. **The chore walk stops at `execution`, by giving the spawner a `planStatusProbe` that answers `undefined`.** There is no checkout to read a phase file's `Status:` line out of, so execution ends the run there. That is the excerpt's own "the run ends at `execution`", and it keeps the test hermetic — `headProbe` is stubbed too, so no `git` subprocess is spawned for a `/root/projects/scratch-app` that does not exist. The failure comment execution then posts is *not* a gate comment, which is one more body the probe has to walk past.

5. **The zero-gate assertion is written first in its test.** It is the subject; the route assertions (three sessions, the third one the build, the run ending at `execution`) corroborate it. Ordering matters here because under the mutation probe below the walk *parks* at planning and starts one session fewer — with the count asserted first, the failure would have named the session count and not the gate.

6. **`with human agreement at planning time` was struck from the triage skill's chore row.** It was the clause that most directly implied the gate this slice records the loss of: with stage 5 no longer stopping, there is no moment at which that agreement is collected. The un-anchored *stamp* rule itself is stage 5's and stays as it is — this removed only the restatement inside the row I was granted.

**Validation evidence.**

Baseline before the slice: **891 tests / 25 files**, `npm run type-check` exit 0.

**No case could honestly be driven red, and every one is recorded with the mutation that proves it is not vacuous** — the behaviour was true the moment 23b landed, so a red here would have had to be fabricated.

| Case (as the plan declares it) | Green on arrival | The mutation that proves it live |
|---|---|---|
| A chore's route reaches no gated stage — the property | ✅ | `planning` → `waits: "gate"` in `pipeline.ts` → `AssertionError: expected 'gate' to be 'none'`. Reverted. |
| …and the value, so nothing satisfies the property by re-routing the chore | ✅ | `case "chore"` → `stage: "feedback"` → `AssertionError: expected { kind: 'advance', stage: 'feedback' } to deeply equal { kind: 'advance', stage: 'planning' }`. Reverted. |
| Nothing else moved — feature → `clarification`, bug → `feedback`, question finishes with a reason | ✅ (three existing tests in the same `describe`, kept rather than duplicated) | `case "feature"` → `stage: "planning"` → *sends a feature to the clarification conversation* failed, the other four passed. Reverted. |
| A chore reaches its pull request with no gate comment anywhere | ✅ | `planning` → `waits: "gate"` **plus** a `planning` row in `GATED` → `AssertionError: expected [ 'planning' ] to deeply equal []`. Reverted. |
| The negative control: a feature gets exactly one gate comment, at `requirements` | ✅ | `openGate`'s `postComment` disabled → `AssertionError: expected [] to deeply equal [ 'requirements' ]`. Reverted. |

The fourth row's mutation needed both halves: gating `planning` alone made the test fail on `planning gates but renders no comment to match on` — decision 2 doing its job, but not the evidence the assertion is about.

Excerpt's validation commands, run at the end:

- `npm test -- src/daemon/pipeline.test.ts src/daemon/session.test.ts` → **147 passed (2 files)**.
- `npm run type-check` → **exit 0**, no output.
- `npm test` → **893 passed, 25 files** (was 891 / 25).
- `git diff --stat -- src/` → `src/daemon/pipeline.test.ts | 21 ++++--` and `src/daemon/session.test.ts | 151 +++…` — **two files, both `*.test.ts`**.
- `grep -n -i "chore" process.md .claude/skills/timone-triage/SKILL.md` → both routing entries now carry *"a chore meets no gate before its pull request"*.

Checkboxes:

- ✅ **PASS** — `git diff --stat -- src/` lists only `*.test.ts`. No production file was edited; every mutation above was reverted with `git checkout` and the working tree carries none of them.
- ✅ **PASS** — the chore walk asserts `gatesPostedIn(...)` is `[]` over the collected comment bodies, and the feature control in the same block asserts it is `["requirements"]`. Both were seen failing under the mutations in the table, so neither is passing against an adapter that collects nothing; the chore walk also asserts `comments.length > 0`.
- ✅ **PASS** — `process.md` stage 1 and the triage skill's routing table both say it, in each file's own voice.
- ✅ **PASS** — `git diff -U0 process.md` reports one hunk, `@@ -27 +27 @@`. Stage 5's paragraph (line 37) and stage 6's (line 39) are byte-identical; the skill's diff is one hunk at line 45.
- ✅ **PASS** — the ruling, its date, the risk he was shown and accepted, and the pull request as where his judgement now lands are recorded above, for 23i to quote.

**⚠ 23b's guardrails timeout did not reproduce.** `src/commands/guardrails.test.ts > resolves the session id against the ledger` passed in the full run (893/893 at the default timeout, 48.6 s). It is a load flake, and this slice added only two fast tests; treat 23b's warning as still standing rather than as fixed.

**What 23d onward must know.**

1. **`process.md` now says something stage 5's own paragraph still contradicts, on purpose, and 23e closes it.** Stage 1 says a chore meets no gate; stage 5's `Status` lifecycle still calls its `Awaiting approval` → `Approved for execution` flip *"the written trace of this stage's gate"*, and stage 6's entry gate still refuses an unstamped phase file. Both were out of this slice's grant. **Until 23e lands, `process.md` describes a gate at stage 5 that the daemon no longer opens** — the same split 23b's note 6 flagged, now with one of its two halves closed.
2. **The same transient split reaches the triage skill's neighbour rule.** The chore row no longer says the un-anchored stamp is agreed "at planning time"; stage 5's PRD-anchoring sentence in `process.md` still says "with human agreement". Whichever slice rewrites that sentence should decide where that agreement now happens — the breakdown gate is the only human touch a chore-shaped initiative has left, and a chore does not reach it.
3. **`gatesPostedIn` is the thing to reuse, not to copy.** Any later slice asserting a route's silence — chunk zero's merge, a re-proposal, the second chunk — should call it rather than write another `not.toMatch(/approve/)`. It lives in `session.test.ts`'s 23c block; promote it to a file-level helper the first time a second block needs it.
4. **23b's weaker chore assertion is still in place and was deliberately left.** `session.test.ts`'s *"advances a chore to execution instead of spawning planning for ever"* closes with `not.toMatch(/single word \`approve\`/)`. It is a `planning`-only sample of what 23c now walks end to end; it costs nothing, it guards a different regression (the unbounded loop), and deleting it would have been this slice editing 23b's test for tidiness.

## 23d — Chunk zero merges on approval

**Built.** [ADR-0030](../../../adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md) D2 has a home. Approving the `breakdown` gate now records the stamp, and **then** merges chunk zero's branch into the project's default branch and pushes it — no pull request. 23b's note 3 is closed: chunk 1 no longer cuts from a default branch that does not carry the specification.

**Files touched.** `src/git.ts`, `src/daemon/session.ts`, `src/daemon/prompts.ts`, `doc/adr/0015-branch-per-driving-unit.md`; tests in `src/daemon/session.test.ts` and `src/daemon/prompts.test.ts`.

### The one new write path, and what it deliberately is not

`git.ts` gains exactly one export:

```ts
export type MergeOutcome =
  | { merged: true; into: string }
  | { merged: false; reason: string };

export async function mergeIntoDefault(dir: string, branch: string): Promise<MergeOutcome>
```

It refuses a dirty tree, fetches, checks out the default branch, **fast-forwards it onto its upstream**, merges `branch`, and pushes. What it cannot do, and no later slice should quietly teach it to: it takes no message and authors no content, so **it cannot commit** anything but the merge git makes; **there is no push primitive** — the push is the merge's own publication of the branch it just moved, unreachable except by having merged; and it can move **no branch but the default one**, with nothing but `branch`'s own commits. `commit` and `push` still appear nowhere else in the module.

**The fast-forward is not in the plan's list and is load-bearing.** The excerpt says *fetch, checkout, merge, push*, which would fetch for no reason and then merge into however stale the checkout's default branch happened to be. Every chunk's pull request merges **on the remote**, so a checkout that has not pulled since is behind by exactly those merges — and the push at the end would be rejected as non-fast-forward. `fastForward` already existed for this; it throws on a genuinely diverged default branch, which the caller turns into a failed run.

**A merge that will not go through comes back as a result, and the tree is left as it was found.** On failure the module asks whether `MERGE_HEAD` exists before running `merge --abort`, rather than aborting and swallowing "there is no merge to abort" — verified against a real repository: after a conflict, `isClean` is true and `git status --porcelain` is empty.

**One shared function changed, and it had to.** `runGit`'s error message now falls back to the process's **stdout** when stderr is empty. A conflicted `git merge` writes `CONFLICT (content): Merge conflict in <path>` to **stdout** and leaves stderr blank, so without this the reason on the ticket read `Command failed: git merge --no-edit -- <branch>` — a refusal that names nothing, which defeats the point of returning a result. Every other caller is unaffected except where its reason was that same empty string.

### The call site, and the two things about it that are the slice

`recordApproval` gains three lines at its end; `mergeChunkZero` and `attemptMerge` are private to the spawner, and `mergeProbe` joins `repoProbe`/`headProbe`/`planStatusProbe`/`verificationReportProbe` as an injectable option defaulting to `git.ts`.

1. **Guarded on `approval.stage === "breakdown"`, and on nothing else.** There is one `if`, at one call site. No gate but the breakdown's can reach the merge.
2. **After the stamp, never before.** The merge sits *below* the `if (!outcome.ok) … return false` that judges the recording session, so a recording session that failed leaves the merge uncalled. A branch merged before its approval was recorded would be work on a default branch with nothing saying what authorised it.
3. **A failed merge fails the run, comments the reason, and returns `false`** — which is `spawn`'s existing early return, so `planning` never starts. It reuses `failedComment` and `store.fail`, the same shape as a failed approval record.

### Red-green trace

| Case | Evidence |
|---|---|
| Merge fires for `breakdown`, once, with the run's branch | **Red seen**: `expected [] to deeply equal [ { branch, repoDir } ]` |
| Merge fires for **no other gate** (`requirements` → zero calls) | Green on arrival — vacuous before the code existed. **Mutation probe**: merge made unconditional → `expected [ {…} ] to have a length of +0 but got 1`. Reverted. |
| Order: a failed recording session leaves the merge **uncalled** | Green on arrival. **Mutation probe**: merge moved above the `outcome.ok` check → same length assertion fails with 1. Reverted. |
| A failed merge fails the run, puts the reason on the ticket, and does not advance | Green on arrival. **Mutation probe**: `mergeChunkZero`'s result discarded (`return true`) → `Error: Run scratch-app#7/1 cannot go from failed to active` — the run tried to start `planning`. Reverted. |
| The delivery prompt still forbids merging a pull request | **Red seen**: `expected 'Present the finished work…' to match /never merge (the \|this )?pull request/i` |

**Three of the five were green on arrival and are recorded as such.** "No merge happened" is vacuously true before a merge exists, and reordering the writing does not change that; the mutation probes above are what prove each one is not passing on a technicality. Every mutation was reverted, and the working tree carries none of them.

### `git.ts` is not unit-tested, per the excerpt — so it was proven by hand

The excerpt rules that `git.ts` gets no test file and the seam the daemon depends on is the injected one, which is what the tests above use. That leaves the primitive itself unproven by the suite, so it was exercised **once, by a throwaway script in the scratchpad against a real temporary repository** (a bare origin, a clone, a chunk-zero branch) and the script deleted:

- a clean merge → `{ merged: true, into: 'main' }`, the checkout left on `main`, and `origin/main` verified to carry `doc/plans/breakdowns/ticket-07.md`;
- a dirty tree → `{ merged: false, reason: 'the working tree at … has uncommitted changes' }`, nothing fetched, nothing merged;
- a real conflict → `{ merged: false, reason: '… CONFLICT (content): Merge conflict in README.md' }`, tree clean afterwards, no merge in progress;
- a branch that does not exist → `{ merged: false, reason: '… not something we can merge' }`.

**If a later slice does add `src/git.test.ts`, those four are the cases.**

### The delivery prompt, narrowed rather than dropped

Before: `**Never merge** — merging is the human's act, and the pull request exists to let them take it.`
After: **`**Never merge the pull request** — merging it is the human's act, and the pull request exists to let them take it.`**

The instruction keeps its whole force over the thing it was written about. `prompts.test.ts`'s assertion was tightened from `/never merge/i` to a pull-request-specific pattern, so a future rewording back to a blanket rule fails.

### Validation evidence

| Command | Result |
|---|---|
| `npm test -- src/daemon/session.test.ts src/daemon/prompts.test.ts` | **246 passed (2 files)** |
| `npm run type-check` | **exit 0**, no output |
| `npm test` | **897 passed, 25 files**, 47.9 s |
| `npm run build` | **exit 0** |
| `git -C projects/scratch-app status --porcelain && … branch --show-current` | **empty**, then `main` |

Checkboxes:

- ✅ **PASS** — the requirements case asserts `expect(calls).toHaveLength(0)` on the injected function, not a different call, and was seen failing at `got 1` under an unconditional merge.
- ✅ **PASS** — the failed-merge case asserts `status === "failed"` **and** `requests` has length 1 **and** the stage is not `planning`. Under the swallow mutation it failed on the run trying to activate for `planning`.
- ✅ **PASS** — `projects/scratch-app` reports nothing and sits on `main`. No test touches a real repository; the one script that did built its own in `$TMPDIR` and removed it.
- ✅ **PASS** — [ADR-0015](../../../adr/0015-branch-per-driving-unit.md) carries a dated `✏ Amendment 2026-08-15` naming chunk zero as the exception to its ticket-path sentence and explaining that the merge is what keeps its stacking clause true. It cites [ADR-0030](../../../adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md) D2 rather than restating it, and it is the only `doc/` artifact this slice touched besides this section.
- ✅ **PASS** — `.timone/state.json` was never written; nothing in this slice runs the CLI.

### What is wrong in the excerpt

1. **The `fetch` in the primitive's step list does nothing without a fast-forward.** Fetching updates `origin/<default>` and leaves the local default branch exactly as stale as it was, so the merge described would go into a stale branch and the push would be rejected. Resolved by adding `fastForward` after the checkout — an existing export, no new behaviour class.
2. **"It returns a result rather than throwing on a merge conflict" under-specifies the other refusals.** A dirty tree is also a refusal the caller must put on a ticket, and a checkout or push git rejects is not. Resolved by returning results for the two the caller can explain and letting the rest throw as the module always has — with the *caller* catching, so nothing escapes into the poll loop either way.
3. **The order the excerpt gives for the guard is looser than the ADR's.** It says the merge goes "after the recording session has committed and pushed the stamp and returned `true`", which is what was built; the ADR's own consequence about a merge with no record is the reason, and it is worth reading before anyone refactors `recordApproval`.

### What 23e onward must know

1. **The daemon can now write to a default branch, from exactly one place.** `mergeIntoDefault` has one caller and one guard. A slice that wants a commit, a push, or a merge from anywhere else is re-opening [ADR-0030](../../../adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md) D2 and D4, not filling in a detail — D4 in particular refused exactly this for ticking the breakdown.
2. **A chunk-zero merge leaves the checkout on the default branch.** `mergeIntoDefault` does not restore the branch it was on, on either path. Nothing downstream cares today — `claimBranch` checks the run's branch out for the next stage — but a slice that starts reading the checkout's `currentBranch` after an approval should know.
3. **`runGit`'s error text now prefers stdout when stderr is empty.** Any test asserting on a git failure message from any caller in `git.ts` is reading a slightly better string than before.
4. **23b's note 3 is closed; its notes 5 and 6 are not.** Nothing still reads a breakdown off disk in `src/` (23f), and `process.md` stage 5/6 plus `timone-execute` gate 1 still describe the old stamp-gated phase file (23e).

## 23e — A phase file gates nothing

**Built.** The per-chunk phase file stopped being a gate and became an artifact. Nobody is asked to approve one, nothing refuses to build without a stamp on one, and no prompt writes a stamp for an approval the machinery will never request. 23b's note 6 and 23d's note 4 are closed. **The exit stamp is untouched:** `session.ts:919`'s `/^Complete\b/` is byte-identical to `HEAD` and still judged live by a mutation probe (below).

**Files touched.** `src/daemon/prompts.ts`, `process.md`, `.claude/skills/timone-plan/SKILL.md`, `.claude/skills/timone-execute/SKILL.md`; tests in `src/daemon/prompts.test.ts` and `src/daemon/session.test.ts`. **`src/daemon/session.ts` was not modified** — `git diff --stat src/daemon/session.ts` is empty.

### The distinction this slice turns on, restated where the next reader will look

**Only the *entry* gate was retired. The phase file keeps its `Status` line and keeps its final state.** `session.ts:919` tests the newest phase file's `Status:` line with `/^Complete\b/` as execution's artifact witness, and `executionPrompt`'s closing instruction to flip the line to `Complete — see <report>` is what makes that line exist. Both survive verbatim, and the test that asserts the retirement asserts the survival **in the same case**, four lines apart in the prompt, because that is exactly where too much gets deleted. What went is the birth stamp (`Awaiting approval`), the approval stamp (`Approved for execution by <who> <date>`), and every sentence making either a precondition for building.

### The pair 23b deferred, landed together

`planningPrompt`'s `Awaiting approval` instruction and `APPROVAL_RECORD`'s `planning` row are gone **in the same commit as `timone-execute`'s gate 1**, which is the order 23b's decision 3 named: removing either half first would have left every phase file unstamped and every build refusing to start.

- **`planningPrompt`** now says the phase file is *"an artifact, not a proposal: nobody is asked to approve it and nothing waits on it"*, still commits **and pushes** it, and closes with *"ask them for nothing"* instead of *"the machinery posts the approval request itself"* — a sentence that had become false the moment 23b made `planning` wait-free, and the same class of defect as 23b's decision 4.
- **`executionPrompt`** stops calling the phase file's `Status:` line *"the authority on whether you may build it"*. It keeps a refusal, but a different one: **no phase file on the branch at all** stops the session, because *"planning one yourself is building something nobody agreed to."*
- **`APPROVAL_RECORD.planning` is deleted, not left unreachable.** A comment stands where the row was saying why the pair had to move together.

**The prompt no longer instructs a birth stamp of any kind, deliberately.** `> **Status:** Planned.` lives in `timone-plan`'s template, where the document layout belongs (`process.md` stage 5: *"the document layout … belongs to the plan skill, not to this spec"*). Nothing machine-read depends on the line before phase close, and re-adding a stamp instruction to the prompt is how the retired one would grow back.

### `timone-execute` gate 1, in full

Renamed **1 — Agreement gate**. It keys on the breakdown, keeps both routing destinations, and — the part the excerpt does not name — **says what happens when there is no breakdown at all**, which is not an edge case but two whole classes of work:

> **1 — Agreement gate.** ✏ Revised 2026-08-15 ([ADR-0030] D1). **What execution refuses to start without is agreement, and what carries agreement is the breakdown — the list of pieces an initiative is being built in, at `doc/plans/breakdowns/ticket-NN.md` — not the phase file.** So for ticket-driven work: read that file, and build only when its `Status` line reads `Approved by <who> <date> — N pieces` **and** the piece this phase plans is one the list names. A breakdown still stamped `Awaiting approval` is not executable; neither is an approved one whose numbered list has since grown past the count in its own stamp, because the piece you were handed may be one nobody has seen. Route to the **human** when no breakdown was ever approved — re-planning cannot manufacture a missing approval — and to **`timone-plan`** when a re-proposal is what left the approval stale. Never execute "just the pieces that were approved" out of a list under re-proposal.
>
> **Two shapes of work have no breakdown by design, and their gate is not this one.** A chore or technical enabler triage routed to planning meets no gate before its pull request ([ADR-0030] D3), and hand-run work with no driving ticket was agreed by the human who invoked you. Both build; neither is refused for an absent breakdown. What still refuses is an initiative that *has* a driving ticket and no approved breakdown — there the absence means stage 5's gate never closed, and that routes to the human.
>
> **The phase file's `Status` line is not this gate and no longer stands in for it.** It is a lifecycle marker: stage 5 writes it `Planned`, and the only state this stage writes on it is `Complete — see <report>` at phase close. **A phase file carrying no approval stamp is the normal state, not a refusal** — every piece's plan is written that way — so never read one as permission, never treat a stamp left on an older file as this gate's answer, and never stamp a file yourself.

**The second paragraph is a correction to the excerpt, not an embellishment.** Gate 1 keyed purely on "the chunk is listed in an `Approved` breakdown" would refuse **every chore** — ADR-0030 D3 routes a chore triage → planning → execution and it never sees a breakdown — reintroducing the *"execution would refuse every chunk"* bug the slice exists to fix, in a new costume. It would also refuse every hand-run phase, Timone's own included.

### The un-anchored stamp: where the agreement went

`process.md` stage 5 said the un-anchored stamp needs *"human agreement"*, and `timone-plan` said it was *"sought at the same gate as the breakdown itself"* — a moment that does not occur, since D3 routes a chore straight to planning, ungated. Resolved consistently with D3: **the agreement moves to the pull request.** The exact new wording, in `process.md`:

> **PRD anchoring:** feature phases list the requirement IDs they deliver; technical/enabler phases are explicitly stamped un-anchored, naming what they deliver and why they are not PRD-bound. ✏ Revised 2026-08-15 ([ADR-0030] D3) — **that stamp is written, not agreed in advance.** It used to need human agreement sought at this stage's gate; a chore reaches planning ungated and meets nothing that stops for an answer before its pull request, so there is no longer a moment at which that agreement could be collected. The judgement moves to the pull request, where the stamp sits in front of the human alongside the code it justifies.

and in `timone-plan`:

> ✏ Revised 2026-08-15 ([ADR-0030] D3) — **you write that stamp; you do not negotiate it.** It used to need human agreement sought at this stage's gate, and there is no longer such a moment: a chore reaches planning ungated and meets nothing that stops for an answer before its pull request. So write the stamp, make it good enough to be argued with, and let the argument happen where it now happens — on the pull request, with the code in front of them.

### The three sentences 23c left disagreeing, now agreeing

All three of `process.md` stage 5's row, stage 5's Status-lifecycle text and stage 6's Entry gate now say the same thing: **the breakdown is what is approved, the phase file gates nothing, and the phase file's `Status` line is a lifecycle marker whose only stage-6 state is `Complete — see <report>`.** Stage 5 additionally gained a definition of the breakdown artifact, because the table row now names `doc/plans/breakdowns/ticket-NN.md` and a spec that names a path it never defines is worse than one that omits it.

Two further sentences in the same paragraphs had to move with them or they would have contradicted the revision inside one line:

- **Stage 5 `Amendments`** — *"an approved plan is amended in place … every change made after approval"* → *"a committed plan … every change made after it was committed"*. There is no approval to date changes from.
- **Stage 5 `Re-approval`** — the whole rule reverted a file to `Awaiting approval`, resurrecting the retired stamp. Recast: a phase file carries no approval, so an amendment voids nothing; what *can* go stale is the breakdown, and a list that gained a piece since its stamp is a re-proposal the human must approve again.

### Decisions taken inside the slice

1. **The phase file's birth state is `Planned`.** The plan says the file *keeps* a `Status` line, so it needs a state at birth; `Awaiting approval` is retired and a bare or absent line would make the `Complete` flip look like an invention. `Planned` says what is true and cannot be confused with a gate. Two states now: `Planned` → `Complete — see <report>`.
2. **`session.test.ts` was edited, and it is in no slice's grant in this phase.** Two of its tests asserted the retired instructions and the excerpt's own validation command runs the file, so it had to move. This is 23b's note 1 arriving from a second direction — **add `session.test.ts` to the file markers of any slice touching `prompts.ts`'s stage prompts or `APPROVAL_RECORD`.**
3. **The `recording an approval in the artifact` block was re-pointed from `planning` to `breakdown`**, with `mergeProbe` stubbed. `planning` opens no gate and has no `APPROVAL_RECORD` row, so a run parked on a planning gate is a state the pipeline can no longer reach — the block was testing `recordApproval`'s mechanism through a door that no longer exists. `breakdown → planning` is the graph-correct pair; the stub keeps the block about the record rather than about 23d's merge, which has its own block.
4. **The word *breakdown* had two meanings inside `timone-plan` and one of them was struck.** The skill used it in the old sense — the cut into sub-phases — in its Input section and its workflow step 3. Both were reworded ("the cut itself", "cut the phase into slices"), because ADR-0028 gave the word a specific artifact and a skill using it both ways teaches the wrong one.
5. **The breakdown section is titled *"the one thing a human approves here"*, not *"this stage's one gate"*.** The skill already has a section called "The two gates" meaning entry refusals; a second heading calling something "the gate" would have made three gates of two kinds. The section says which kind it is in its first paragraph.

### Validation evidence

Baseline: **897 tests / 25 files**, `npm run type-check` exit 0.

| Case (as the excerpt declares it) | Red — the failure actually seen | Green |
|---|---|---|
| Planning writes an artifact, not a gate | `AssertionError: expected 'Plan the work for ticket #6 …' not to match /awaiting approval/i` | ✅ |
| …and it still commits **and pushes** the phase file | Green on arrival. **Mutation probe**: dropped `and push it` from the prompt → `expected '…' to match /push it/i`. Reverted. | ✅ |
| Execution does not consult the stamp for permission | `AssertionError: expected 'Build what was planned for ticket #6 …' not to match /authority on whether you may/i` | ✅ |
| …and the `Complete` flip instruction is still present (same test) | asserted alongside the above, `toContain("Complete — see <report>")` | ✅ |
| No approval record exists for a phase file | `AssertionError: expected '**Every commit you make in this sessi…' not to contain 'Approved for execution'` | ✅ |
| **The exit stamp still works** (not an excerpt case — checkbox 2, proven rather than remembered) | **Mutation probe**: `/^Complete\b/` → `/^Xomplete\b/` in `session.ts:919` → *"advances to verification when the plan flipped and the session said done"* failed with `expected 1 to be greater than or equal to 2` — the run never reached the verification session. Reverted; `git diff --stat src/daemon/session.ts` is empty. | ✅ |

**The skill and `process.md` edits carry no behaviour and are validated by checklist**, as the excerpt states — nothing in `src/` reads either file.

Excerpt's validation commands, run at the end:

- `npm test -- src/daemon/prompts.test.ts src/daemon/session.test.ts` → **249 passed (2 files)**.
- `npm run type-check` → **exit 0**, no output.
- `npm test` → **900 passed, 25 files**, 49.1 s (was 897 / 25).
- `grep -n "Approved for execution" .claude/skills/timone-execute/SKILL.md .claude/skills/timone-plan/SKILL.md process.md` → **no output, exit 1**. Not one surviving hit in any of the three, historical or otherwise.
- `grep -rn "breakdown" process.md .claude/skills/timone-plan/SKILL.md` → the skill's new section, its template note and its un-anchored revision; `process.md`'s stage-5 row, its breakdown paragraph and stage 6's entry gate.

Checkboxes:

- ✅ **PASS** — the first `grep` returns nothing at all, so there is no surviving sentence making `Approved for execution` a precondition and no historical hit to explain either. Three further sentences carrying the retired rule were removed while the grep was being satisfied honestly: `timone-execute`'s frontmatter trigger (*"Use when a phase file is stamped `Approved for execution`"* — a trigger that can never fire again), its phase-close step 2 (*"the approval trace the line carried … copy it into the report's **Plan** line"* — a trace a phase file no longer has; it now names the approved breakdown, or says there is none), and its read-list bullet (*"starting with its `Status` line — that stamp is the entry gate below"*, which would have contradicted gate 1 twenty lines later). The read list gains the breakdown, since gate 1 cannot be checked without reading it.
- ✅ **PASS** — `git grep -n "Complete — see" src/ && git grep -n '\^Complete' src/daemon/session.ts` → exit 0, finding `prompts.ts:585` (the flip instruction), `session.ts:919` (the check) and four `planStatusProbe` fixtures. Asserted from the source, and the check proven live by the mutation probe above.
- ✅ **PASS** — stage 5's row, stage 5's Status-lifecycle text and stage 6's Entry gate all three now say the breakdown is what is approved and the phase file's `Status` line gates nothing.
- ✅ **PASS** — full suite green, 900/900, and no artifact under `doc/` was modified other than this handoff section.

### What is wrong or missing in the excerpt

1. **Gate 1 keyed only on an approved breakdown refuses every chore, and every hand-run phase.** The excerpt's routing has two destinations and neither covers the case where a breakdown *correctly* does not exist. ADR-0030 D3 is explicit that a chore never reaches the breakdown, so a gate demanding one would refuse the exact class of work D3 was written to let through unattended. Resolved by naming the two no-breakdown shapes in gate 1 itself and in `process.md` stage 6.
2. **`src/daemon/session.test.ts` is not in the excerpt's `[MODIFY]` markers, but its validation command runs it and two of its tests assert the retired instructions.** Same shape as 23b's note 1 about `poll.test.ts`.
3. **The excerpt does not say what the phase file's `Status` line reads at birth** while requiring it to keep one. `Planned` was chosen here (decision 1); a later slice disagreeing should change `timone-plan`'s template, which is the one place it is written.
4. **The excerpt says `process.md` stage 5's *"table row"* needs its gate column revised, but the artifact column needed it too.** The gate column now says the human approves the breakdown, which named a path the table did not list and the stage note did not define.

### What is left contradicting, and is nobody's slice yet

1. **`process.md` stage 9's confirmation gate still says the plan gate exists.** Line 71: *"stage 5's approval still answers 'is this breakdown executable?' for whatever plan work the confirmation dispatches — collapsing the two would let a feedback conversation silently approve a plan nobody has read."* There is no stage-5 approval of a plan any more, and the word *breakdown* in that sentence carries the pre-ADR-0028 meaning, so it now reads as though it were about the new artifact. **It was left alone deliberately** — it is in stage 9's paragraph, outside every marker this slice was given, and rewriting it changes what stage 9 must obtain before dispatching. Suggested replacement, for whoever owns it: *"stage 5's gate still answers 'is this the right list of pieces?' for whatever plan work the confirmation dispatches"*, or a plain statement that dispatched plan work is judged on its pull request.
2. **`process.md` stage 9 and `timone-improve` both promise *"re-approval semantics"* for the plan-patch vehicle** (`process.md:63`, `timone-improve/SKILL.md:100` and `:110`). Stage 5's re-approval rule now applies to the breakdown, not to a phase file, so *plan patch* inherits nothing to re-approve. Same reason for leaving it: outside the markers, and it is stage 9's meaning to decide.
3. **`process.md` stage 6's completion-report elements still ask for *"a link to the plan with its approval trace"*.** `timone-execute`'s own step 2 was corrected to name the approved breakdown instead; the spec sentence is loose enough to be satisfied by that reading, so it was left rather than widened.
4. **`timone-plan`'s workflow list has no heading.** Steps 1–6 sit directly under the "Writing failure probes" section with no `## Workflow` above them. Pre-existing, unrelated, and not touched.

### What 23f onward must know

1. **`APPROVAL_RECORD` now has exactly two rows, `requirements` and `breakdown`,** and the fallback for a stage with no row is asserted (`prompts.test.ts`, *"has no record to write for a phase file, and falls back harmlessly"*) rather than assumed. It is a `Partial` record: a *gated* stage added without a row would silently tell its recording session to *"record the approval"* in *"the artifact this stage produced"*, which is not a refusal, just useless.
2. **Nothing in `src/` yet checks the breakdown before a build.** Gate 1 is a skill instruction, and the skill is what a session follows — the daemon does not read `readBreakdown` at any point on the path to `execution`. 23a's `readBreakdown` / `chunkProgress` / `isReproposal` still have no caller in `src/` outside their own tests. **The re-proposal refusal is therefore prose-enforced only, today.**
3. **`planStatus` is now consulted for exactly one thing:** whether the newest phase file reads `Complete`. There is no other state the machinery reads off that line, so a slice tempted to give it a third meaning is adding a gate, not a status.
