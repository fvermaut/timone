# Phase 20 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 20a — one computation, two renderers

**Built.** There is now exactly one place that decides what an open ticket needs from the human, and `timone status` reads it rather than deciding for itself. `ctaFor(state)` maps a ticket's state — its run or the absence of one, that run's status, stage, recorded wait and pull request, and the ticket's labels — to a `Cta`: a headline, the words that follow *"What I need from you:"*, whether the human is what it is waiting on, and the exact command when one moves it. `ctaComment(cta)` renders that onto a ticket. `timone status` renders the same value onto the terminal: its parked-run phrase, its failure block's command, and its closing line's list of tickets all come from `ctaFor` now. **The observable output of `timone status` is byte-identical to `main`'s across sixty-four rendered states** — this slice relocates a decision, it does not rewrite copy.

The contradiction R21's clause 8 forbids is now impossible rather than merely absent: the terminal and the ticket read one value, so they cannot disagree about what a ticket needs. Proven structurally, not by two strings happening to match — see the mutation probe below.

**Files touched.**

- `src/daemon/cta.ts` — created. `TicketState`, `Cta`, `ctaFor` (the computation), `ctaComment` (the ticket renderer).
- `src/daemon/cta.test.ts` — created. 25 tests: one per state, plus the whole stage graph as a table.
- `src/commands/status.ts` — `describeWait` now asks `ctaFor`; the failure block prints the CTA's command instead of building `timone retry <id>` itself; the closing line filters on the CTA's `waitingOnYou` instead of on `run.status === "parked"`. No other change.
- `src/commands/status.test.ts` — two tests added under *"one computation, two renderers"*. Nothing existing was edited: all 22 prior tests pass untouched, which is the "output unchanged" evidence.

**Decisions taken inside the slice.**

- **The file naming is right, and I would keep it.** `src/daemon/cta.ts` beside `gate-comment.ts` is where it belongs: `gate-comment.ts` is already a pure comment composer with no I/O and no adapter, and this is the same kind of thing one level up. `src/commands/status.ts` importing from `src/daemon/` is not new either — it already imports `modelFor` from `pipeline.js` and `Run` from `runs.js`. **No move is warranted; 20b–20f can write their file grants against these names.**
- **`ctaComment` lives in 20a, not 20c.** My checkbox demanded that the status line and the ticket body for one state be proven to come from one call, which is unprovable without a ticket-body renderer existing. It is a renderer — every word it emits comes off the `Cta` it is handed — so it does not put a second decision anywhere. 20c should call it and never compose a body of its own.
- **`timone status`'s wording did not change anywhere, including where it is arguably wrong.** Two states tempted me and I left both alone, deliberately, because the brief says nothing a human reads may change in this slice:
  - A run **parked at an unbuilt stage** is still listed as *"waiting on you: the next stage to be built"* and still named in the closing line's *"answer on …"*, even though nothing the human can type moves it. ADR-0024's own evidence table calls that line *truthful*, and the ticket now carries the identical words, so the two surfaces agree — which is what clause 8 asks. **Making it read "waiting:" and dropping it from the closing line is a copy change and belongs to a later slice or the delivery review**, not here.
  - A **failed** run has `waitingOnYou: false`, so the closing line still says *"nothing is waiting on you right now"* three lines under *"to pick it up from where it stopped: timone retry …"*. That is today's behaviour exactly. Flipping it to `true` would have changed the closing line, which the brief forbids. The field's docblock states the contract precisely so a later reader does not think it is an oversight.
- **`waitingOnYou: boolean` + `command?: string` rather than a discriminated union.** `standards/typescript.md` prefers unions over flag combinations, and a `CtaMove` union (`nothing` / `reply` / `reply-or-run` / `run`) is arguably the better shape. I did not build it because the two fields are genuinely independent facts — *who is waited on* and *whether anything they type moves it*, and a failed run is the state where they legitimately disagree — and because a five-variant union with one consumer is speculative generality at this size. **Listed under refactoring below.**
- **A marked ticket with no ledger run gets "nothing right now — I'll comment here when I do."** — the daemon is what moves it, on its next pass. An **unmarked** one gets *"add the `timone` label to this ticket and I'll pick it up."*, `MARK_LABEL` interpolated rather than spelled, echoing `takeover.ts`'s existing refusal wording. **Neither branch names `timone takeover`**, because 20g has not built tracker resolution yet and a CTA naming a command that refuses is worse than one naming none.
- **The retry command is built from `runId(project, ticket)`**, not from `run.id`. Identical for every run the store creates — `runId` is what makes them — and it means the command does not need a ledger row to be computed, which is what 20c will want for a ticket that has none.
- **No dependency on `pipeline.ts`.** I considered telling a park at a *built* stage from one at an unbuilt stage via `isBuilt`, so the built one could honestly say nothing is needed. It would have changed what a human reads, so it is not this slice's. Every branch keys on the run's own recorded fields instead.

**Validation evidence.**

Red → green, one case at a time. Each red is the actual failure output.

1. **A review wait names its pull request.** Red: `Cannot find module './cta.js'`. Green: `ctaFor` returns `your review of pull request #9`.
2. **A gated run's own words.** Red: `expected 'an answer' to be 'your answer on the ticket'`. Green: fall through to `run.waitingOn`.
3. **Nothing is asked while a session works.** Red: `expected 'an answer' to be 'nothing right now — I'll comment here when I do.'`. Green: the `picked-up`/`active` branch.
4. **A ticket blocked behind another on its project.** Red: `expected 'an answer' to be 'nothing right now — I'll comment here when I start.'`. Green: the `queued` branch.
5. **A run that stopped early names the exact retry command** (ADR-0024's `scratch-app` #13). Red: `expected undefined to be 'timone retry scratch-app#13'`. Green: the `failed` branch, plus `command` on `Cta`.
6. **A conversation park names the exact takeover command.** Red: `expected undefined to be 'timone takeover scratch-app#6'`. Green: `takeoverCommand` on the conversation branch.
7. **An unmarked ticket with no run is told what hands it over** (`scratch-app` #5). Red: `expected 'an answer' to be 'add the \`timone\` label to this ticket and I'll pick it up.'`. Green: the no-run branch, plus `labels` on `TicketState`.
8. **A marked ticket the daemon has yet to reach asks for nothing.** Red: `expected 'add the \`timone\` label…' to be 'nothing right now — I'll comment here when I do.'`. Green: the mark-label split.
9. **A finished ticket asks for nothing.** Red: `expected 'an answer' to be 'nothing — file a new ticket for anything else.'`. Green: the `done` branch. Load-bearing for output preservation: without it a finished run would have entered `timone status`'s closing line.
10. **A ticket parked at a stage nobody has built** (`scratch-app` #4). **Could not be driven red honestly** — the default branch already returns the run's recorded `waitingOn`, which for such a park is literally *"the next stage to be built"*. Said plainly rather than manufactured. Proven non-vacuous by two probes instead: forcing `needFromYou` to the `"an answer"` fallback produced `expected 'an answer' to be 'the next stage to be built'`, and offering the takeover command unconditionally produced `expected 'timone takeover scratch-app#4' to be undefined`. Both reverted.
11. **A headline in words the reader has already seen.** Red: `expected undefined to be 'That's as far as I can take this one…'`. Green: `headline` on `Cta`, one per branch.
12. **Every stage in the graph.** A hand-written table of each stage's wait kind — written out from `pipeline.ts` by reading it, never by calling `waitFor()` — asserting the CTA waits on the human, says something, and names the takeover **only** for a conversation. Arrived green; it is coverage rather than a driver, and it discriminates: keying the command on `stage === "clarification"` instead of on the wait kind produced `× says what a ticket parked at wayfinding is waiting for → expected undefined to be 'timone takeover scratch-app#42'`. A companion test asserts the table covers `PIPELINE_STAGES` exactly, so a new stage cannot slip past it.
13. **`ctaComment` opens with the headline, offers the command in a fenced block, and closes on the CTA line.** Red: `(0, ctaComment) is not a function`. Green.

**The "one call, not two" case, proven structurally.** The test hands **one** `ctaFor` result to both renderers and asserts each output contains that computed value — the expectation is the computation's own output, so it cannot pass by two literals agreeing. The proof it is not vacuous is a mutation probe run in three steps:

- With `status.ts` **not yet rewired**, mutating `ctaFor`'s review branch (`your review of` → `your look over`) made the test **fail**: `expected 'scratch-app  #6 (delivering) — waitin…' to contain 'your look over pull request #9'`. The terminal did not follow the computation — that is the two-computations state, caught.
- **With the mutation still in place**, rewiring `status.ts` made the test **pass**, and `timone status` itself printed `#6 (delivering) — waiting on you: your look over pull request #9`. One edit to the computation moved **both** outputs.
- Mutation reverted; all 49 tests in the two files green.

A second added test pins the closing line as a hand-written literal — `**What I need from you:** answer on scratch-app #6 — each ticket says what it needs.` — over a ledger holding a parked, an active and a failed run, so the list's membership rule is asserted against the string `timone status` prints today rather than against itself.

**Output-preservation evidence, beyond the suite.** `renderStatus` from `HEAD` and `renderStatus` after the rewire were run side by side over **16 ledgers × 4 option sets = 64 renders** — idle, active, active-at-execution, gate park, conversation park, review park with and without a PR number, park at an unbuilt stage, failed, reclaimed-failure, done, queue of three, flagged run, unknown project, two projects waiting at once, mixed failure-plus-park; each with and without `stateExists`, each with and without a clock. **Result: `IDENTICAL across 16 ledgers x 4 option sets`.**

Commands, as given:

- `npx vitest run src/daemon/cta.test.ts src/commands/status.test.ts` → **49 passed (2 files)**.
- `npm run type-check` → **clean**. (Its exhaustiveness guard was probed too: deleting the `failed` branch produces `error TS1360: Type '"failed" | "parked"' does not satisfy the expected type '"parked"'`.)
- `npm test` → **722 passed, 22 files, 34s. Zero failures** — including `guardrails.test.ts`'s known intermittent, which passed this run.

Per checkbox:

- **Every state in the stage graph is covered, including no-run, queued, failed, parked-at-an-unbuilt-stage, and blocked** — **PASS.** All eleven stages by table; no-run in both label states; queued (the blocked-behind-another case); failed; parked at an unbuilt stage; plus picked-up, active and done, which the list did not name but which `timone status` renders.
- **The status line and the ticket body for one state are proven to come from one call** — **PASS**, by the three-step mutation probe above, not by agreement.
- **`timone status` output is unchanged for the states it already handled correctly, asserted against the current strings** — **PASS.** All 22 pre-existing tests untouched and green, plus 64 byte-identical renders against `HEAD`.
- **No second place decides what a ticket needs** — **PASS.** `status.ts` no longer contains a `waitingOn` fallback, a `review`/`pr` special case, or a `timone retry` template; its only remaining decision is `ctaOf(run)`, which asks.

**Refactoring noted, deferred to the delivery review** (nothing applied): the `waitingOnYou` + `command?` pair could become a `CtaMove` discriminated union, per `standards/typescript.md`'s preference — worth revisiting once 20c and 20f have real consumers and the variants are known rather than guessed. And `ctaFor` is a run of eight guarded returns; if 20f adds the map's states it will want a `switch` on the run status with the parked branch extracted.

**What 20b and 20c must know.**

- **The shape you get.** `ctaFor(state: TicketState): Cta`, exported from `src/daemon/cta.ts`. `TicketState` is `{ project: string; ticket: number; run?: Run; labels?: readonly string[] }`. `Cta` is `{ headline: string; needFromYou: string; waitingOnYou: boolean; command?: string }`. It is pure — no clock, no I/O, no store — so a cycle can call it per ticket for free.
- **Do not recompute any of it.** Not the wording, not the command, not whether the human is waited on. If a CTA reads wrong on a ticket, fix `ctaFor`; both surfaces move together, which is the property this slice exists to create. **A `if (run.status === …)` in the poll loop deciding what to say has left 20c's scope.**
- **Post `ctaComment(cta)`, verbatim.** It already ends on the `**What I need from you:**` line, so append nothing after it. It carries **no marker** — deliberately, exactly as `gateComment` carries none: the ticketing adapter stamps what it posts, so 20c passes its `CTA_MARKER` to `upsertComment` rather than baking it into the body.
- **The differs-from-last guard has a cheap key.** `ctaComment(ctaFor(state))` is a deterministic pure function of the state, so the rendered body **is** the comparison key — comparing it against what was last posted needs no extra record, unlike the preview reconciler. Compare bodies, not `Cta` objects.
- **A ticket with no run gets a real CTA**, so 20c can reconcile onto unmarked tickets without special-casing them. Note the split: **marked and unregistered** asks for nothing (the daemon moves it); **unmarked** asks for the label. That second one is the CTA, and it is *not* 20d's one-time introduction — the introduction says what this repository is managed by and is recorded so it happens once; the CTA is the standing line and is reconciled every cycle. **Do not merge them.**
- **Nothing here names `timone takeover` for a ticket with no run.** When 20g lands tracker resolution, that becomes the honest CTA for the no-run states and `ctaFor`'s first branch is where it goes — one edit, and both surfaces follow.
