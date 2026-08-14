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

## 20b — the ticket-side upsert

**Built.** The ticketing seam can now revise a standing statement on a **ticket** instead of repeating it. `upsertComment(project, number, marker, body)` replaces whatever Timone last said under `marker` by editing that comment; where it has never said it, it posts a fresh one. The GitHub implementation tells its own comment from the human's by the machine header alone — never by the author, who is the same account — so a human quoting the marker back into the thread is posted beside, never overwritten. **Nothing calls it yet**: 20c and 20d are its callers.

The seam's docblock is amended from *"Nine capabilities"* to *"Ten"*, and the widening carries its argument on the call, as that docblock demands. The argument is `upsertPullRequestComment`'s, **cited and deliberately not restated**: a CTA is the same kind of thing a preview is — a standing fact whose truth changes, reconciled every cycle — and appending it would fill a client's ticket with near-identical comments.

**Files touched.**

- `src/adapters/ticketing.ts` — `upsertComment` added to `TicketingAdapter`, between `postComment` and `applyLabel`. Its docblock names itself phase 20's widening, points at its twin for the edit-never-append argument and at ADR-0024 for why a CTA is that kind of statement, and states the identity rule implementations must follow. The interface's own docblock now says ten capabilities and *"the last two are phase 16's and phase 20's"*.
- `src/adapters/github-tickets.ts` — `GitHubTicketingAdapter.upsertComment` implemented: `gh issue view N --json comments`, find ours-and-marked, `PATCH repos/<slug>/issues/comments/<id>` or fall back to `postComment`. `ghCommentSchema.url`'s docblock corrected — it claimed `gh pr view` was the only place the numeric id surfaces, which is now false, and it records that GitHub serves both surfaces from one endpoint.
- `src/adapters/github-tickets.test.ts` — 5 tests added under `upsertComment`. Nothing existing was edited.

**Decisions taken inside the slice.**

- **It reads with `gh issue view`, not `gh pr view`.** Obvious, and a copy of the twin would have got it wrong silently — a fake runner returns canned JSON whatever the verb, so no other test in the file would have noticed. Pinned by a test of its own that fails when the verb is swapped.
- **It writes to the same REST endpoint as its twin.** `repos/<slug>/issues/comments/<id>` is not a shortcut: to GitHub a ticket comment and a pull request's conversation comment are one resource, which is why `#issuecomment-` addresses both and `commentDatabaseId` needed no change.
- **No `CTA_MARKER` is defined here.** Markers live in `ticketing.ts` beside their siblings, but a constant with no user is speculative and the plan gives the marker to 20c. **20c and 20d must define theirs in `src/adapters/ticketing.ts` — check your file grant covers it, and escalate before inventing a home for it elsewhere.**
- **A comment with no `url` throws rather than posting.** Same ruling as the twin, for a reason the twin's docblock states: posting is precisely the outcome editing exists to prevent, and here it would leave two calls to action on one ticket, one of them stale, with the machine's name on both.
- **The duplication with `upsertPullRequestComment` was left standing, deliberately.** The two methods now share a find-then-patch shape, and the identity predicate is a duplicated *decision* of the kind `standards/code-smells.md` calls out. Refactoring is deferred to the delivery review per stage 6; see below.

**Validation evidence.**

Red → green, one case at a time. Each red is the actual output; where the case could not be driven red by absence, it was driven red by the mutation that case exists to catch, which is the same proof.

1. **Marker found → the comment is edited.** Red: `TypeError: (intermediate value).upsertComment is not a function`. Green: the PATCH, asserted as a whole argument vector including the stamped body.
2. **Marker absent → a fresh comment is posted.** Driven red by stripping the fallback that case 1's green had brought in: `TypeError: Cannot read properties of undefined (reading 'args')` — the adapter made no second call at all. Restored → green.
3. **A non-Timone comment carrying the marker is not edited** — the discriminating case. The fixture is a comment under `fvermaut`, the same account Timone posts under, whose body opens with the marker and asks *"is this still what you need from me?"*; the machine header is the only thing it lacks. Driven red by the naive predicate — matching the marker alone, dropping `isMachineComment` — which produced `AssertionError: expected [ 'api', '--method', 'PATCH' ] to deeply equal [ 'issue', 'comment', '7' ]`: **the machine overwriting the human's own comment, caught.** Restored → green. The test also asserts exactly two calls and that no argument anywhere is `PATCH`, so a spurious edit cannot hide behind a post.
4. **A comment with no address is refused.** Driven red by the tempting wrong branch — posting instead of throwing: `AssertionError: expected [Function] to throw error matching /no url/ but got 'fake runner: unexpected call gh issue…'`. Restored → green.
5. **It reads the ticket's thread, not a pull request's.** Driven red by swapping the verb to `pr view`: `AssertionError: expected [ 'pr', 'view', '7' ] to deeply equal [ 'issue', 'view', '7' ]`. Restored → green.

Commands, as given:

- `npx vitest run src/adapters/github-tickets.test.ts` → **24 passed** (19 before, 5 added). With `github-pulls.test.ts` alongside: **46 passed**, so the twin is untouched.
- `npm test` → **727 passed, 22 files, 33.6s. Zero failures** — 722 baseline plus 5, and `guardrails.test.ts`'s known intermittent passed this run.
- `npm run type-check` → **clean**, after the conformance fix below. It failed first with 19 × `TS2741: Property 'upsertComment' is missing … but required in type 'TicketingAdapter'`, none of them in a file this slice originally held.

Per checkbox:

- **Marker found → the existing comment is edited, not added to** — **PASS** (case 1).
- **Marker absent → a fresh comment is posted** — **PASS** (case 2).
- **A non-Timone comment carrying the marker text is not edited** — **PASS** (case 3), proven by the mutation, not by the assertion alone.
- **The widening carries its reasoning on the call** — **PASS.** The docblock names the phase, cites the twin's argument rather than re-running it, cites ADR-0024 for why a CTA is that kind of fact, and the seam's capability count moved with it.

**What the widening cost, in full.** A tenth method on `TicketingAdapter` broke **19 conformance sites across 7 test files** — every hand-written fake that implements the seam: `src/daemon/poll.test.ts` (11: 105, 356, 850, 930, 980, 1568, 2142, 2205, 2343, 2479, 2529), `src/commands/retry.test.ts` (217, 490), `src/commands/guardrails.test.ts` (72, 235), `src/commands/takeover.test.ts` (108), `src/daemon/hooks.test.ts` (256), `src/daemon/session.test.ts` (156), `src/commands/daemon.test.ts` (58). **That is the seam's standing price for a capability, and it is recorded here so the next person to widen it can see the price before they pay it** — the interface's own docblock asks a widening to be deliberate, and a cost nobody wrote down is how a deliberate widening quietly becomes an incidental one.

The remedy was the mechanical one phase 16 used for the twin: `async upsertComment(): Promise<void> {},` beside the `upsertPullRequestComment` no-op already in each literal. **Twelve added lines closed nineteen sites**, because several literals take their pull-request surface from a shared spread (`noPullRequests` in `poll.test.ts`) — the fakes that centralize cost proportionally less than the ones that repeat themselves. Nothing else in those seven files was touched: no assertion changed, no recorder added, no tidying. (The escalation this slice originally raised was resolved by the orchestrator widening 20b's file grant for this purpose alone, recorded as an orchestrator decision; phase 20 carries no file markers, so no plan amendment was involved.)

**One of the twelve is a no-op where a recorder will be wanted — 20c's problem, flagged here.** `recordingAdapter` in `poll.test.ts` (~2345) is the instrument behind *"never writes to what the human wrote, only alongside it"*: it records every call and the test asserts against a `WRITES` list which now omits `upsertComment`. A silent no-op is correct today — nothing calls the method — but **the moment 20c reconciles CTAs through the poll loop, that test is blind to the very write it exists to police.** 20c must add `record("upsertComment", …)` there and `"upsertComment"` to `WRITES`, and it was left undone here only because adding a recorder was outside the conformance-fix grant.

**Refactoring noted, deferred to the delivery review** (nothing applied): `upsertComment` and `upsertPullRequestComment` are now the same algorithm twice — read the thread, find ours-carrying-the-marker, patch it by database id or post fresh — differing only in the read command and the post fallback. Two copies is the tolerable count, and the third would not be; more to the point the identity predicate is one decision written twice, and it is the decision that protects a human's comment from being overwritten. A private `upsertMarked(comments, marker, body, postFresh)` taking the two variable parts would leave one copy of it.

**What 20c and 20d must know.**

- **The signature.** `upsertComment(project: TicketingProject, number: number, marker: string, body: string): Promise<void>` on `TicketingAdapter`. Same argument order as `upsertPullRequestComment`; `number` is the ticket number.
- **What a marker must look like.** Any stable, unique line that appears **in the body you pass**, because that is the only reason the next cycle can find what this one wrote. Follow the siblings in `src/adapters/ticketing.ts`: an emoji, a bold label, a `·`, then a clause saying who wrote it and why. It must not be a substring of another marker, and once it ships it can never change — an edited marker orphans every comment already posted under the old one, and the next cycle posts a second CTA beside the first.
- **Do not stamp the body.** The adapter calls `stampMachineComment` on both paths. `ctaComment(cta)` from 20a carries no marker, so **prepend the marker to that body yourself** and pass the same string as `marker` — the header is the adapter's business, the marker is yours.
- **The differs-from-last guard is yours, not the adapter's.** `upsertComment` edits unconditionally: handed the same body twice it issues two identical PATCHes. It does not read what it is about to overwrite for comparison, so 20c must fetch the thread (`getTicket`) and compare against the last machine comment carrying the marker before calling. This is the guard ADR-0024 calls load-bearing; **the adapter will not enforce it for you.**
- **Two `gh` calls per invocation** — a view and a post-or-patch. On a project with many open tickets that is the cost 20c's cycle pays per ticket it decides to write; the differs-from-last guard needs a read anyway, so reuse it and do not read twice.
- **The failure modes to handle.** It throws on an unparseable or unexpected `gh` payload (message carries the raw text), and it throws `…with no url, so it cannot be edited` when the comment it must edit has no permalink. Both are per-ticket; a cycle reconciling many tickets must not let one ticket's throw abandon the rest.
- **`recordingAdapter` in `poll.test.ts` cannot see you yet.** Its `upsertComment` is a conformance no-op and `WRITES` does not list it, so the "never writes to what the human wrote" test would watch you write and report nothing. Fix that in the same slice that first calls the method.
- **20d's introduction is a different call.** It is posted exactly once and never revised, so it wants `postComment` with its own marker recorded, not `upsertComment` — reaching for the upsert would make it revisable, and an introduction that rewrites itself is not an introduction. Use `getTicket` and look for your marker to decide whether it has already happened.

## 20c — the CTA is reconciled each cycle

**Built.** Every ticket the poll loop sees now carries one standing statement of where it stands, and the daemon keeps it true instead of leaving it to whoever last touched the ticket. At the end of each project's turn in a cycle the loop asks `ctaFor` what each listed ticket needs, renders it with `ctaComment` under a new `CTA_MARKER`, and **calls `upsertComment` only where that body differs from the one already on the ticket**. A ticket whose blocker closed is brought up to date because a cycle ran — not because a session remembered it — and a cycle over tickets that have not moved touches nothing at all. The mark label still bounds what Timone *does*; this changes what it *says*.

Nothing about the two answer paths, gate parsing or what a resolution looks like changed, `wayfinding` still has no `next`, and there is still exactly one place deciding what a ticket needs.

**Files touched.**

- `src/adapters/ticketing.ts` — `CTA_MARKER` added beside `PREVIEW_MARKER`, whose *kind* of marker it is: an identity to find the last statement by, not just provenance. Nothing else in the file.
- `src/daemon/poll.ts` — `reconcileCtas` (the reconciliation and its guard), `ctaBody`, `standingCta`, `saysTheSame`; `threadReaders` hoists the per-run thread memo to one reader per ticket for the project's turn, so the reconciler reads what the resume path already read; `pollProject` collects the tickets it acknowledged this cycle and calls the reconciler last. `RunThreads`'s lifetime docblock amended to say what the sharing is now keyed by and why.
- `src/daemon/poll.test.ts` — 8 tests added under *"pollOnce — the call to action is reconciled each cycle"*, the zero-writes guard first. `recordingAdapter` now records `upsertComment` and `WRITES` lists it (20b's flagged debt, paid). One pre-existing test — *"tells a young watch apart from an absence"* — read its two log lines by index and now filters for them by content; the assertions are unchanged.

**Decisions taken inside the slice.**

- **The rendered body is the comparison key, and the ticket is where it is kept.** `ctaComment(ctaFor(state))` is pure, so a body equal to the one on the ticket *is* the statement that nothing changed. No ledger record was added — `runs.ts` is outside this slice's grant, and keeping the key on the surface a human reads means the ledger and the ticket cannot disagree about what was last said.
- **The guard reads by the same rule the upsert writes by**: ours (`fromTimone`), carrying the marker, **the first** such comment — `upsertComment`'s own `find`. A guard that judged differently would compare against one comment and edit another, finding a difference every cycle for ever. That is the storm wearing the costume of a fix, and it has a test with a mutation probe of its own.
- **The comparison is by words, not bytes** (`saysTheSame` normalises CRLF and trims). The guard fails *open*: if the tracker hands a body back in a shape it was not sent in, every cycle finds a difference and rewrites the comment silently. This is the one door through which the exact fault ADR-0024 names could still arrive, and closing it costs two lines. **It cannot be fully closed by a unit test — see what 20h must know.**
- **A ticket acknowledged this cycle does not also get its standing copy this cycle.** `pickedUpComment` and `queuedComment` end on the very line the CTA is made of, so posting it under a marker seconds later is two near-identical comments in one cycle — the thing the guard prevents everywhere else. The standing copy lands on the next cycle, by which time the run has usually moved on and it says something new.
- **The reconciler runs last in the project's turn**, after resume and spawn, so a run that resumed, failed or finished *during* the cycle says so on the same cycle rather than a minute later. Its state comes from the ledger read at that point; only the thread comes from the memo.
- **The per-ticket reader replaced the per-run one** rather than the reconciler fetching for itself. A second fetch would have undone 19d — proven, not assumed: swapping `threads(n).ticket()` for a direct `adapter.getTicket` fails *"reads the ticket once to resume a conversation"* with `expected 2 to be 1`. The memo is keyed by ticket, which is what keeps the staleness the old docblock warned about impossible: no run can be answered from another run's fetch.
- **Errors are per ticket.** One unreadable thread is reported into `result.errors` and the rest of the listing is still reconciled; letting it throw abandons the project's whole reconciliation (probed).
- **No `PollResult` field was added.** A CTA is not a run, and every field there is a run id. The daemon's log carries one `cta <project>#<n>` line per write, which is what 20h observes.

**Validation evidence.**

Red → green, one case at a time, with the guard first as the plan requires.

1. **The zero-writes guard — *"writes nothing at all when every ticket already says the right thing"*.** Written first, over a fixture whose thread already carries the comment the machine would have written (the marker plus a **hand-written** body for ADR-0024's `scratch-app` #13 failed run), so it holds without a happy path having run first. **It was green on arrival**, as it must be — before any reconciliation exists a cycle naturally writes nothing. Said plainly rather than manufactured, and proven non-vacuous by the mutation the plan warns about: dropping the differs check (`if (standingCta(thread) === …) continue;` → `void thread;`) makes it fail with the write itself in the diff —

   ````
   × writes nothing at all when every ticket already says the right thing
   AssertionError: expected [ { call: 'upsertComment', …(2) } ] to deeply equal []
   +     "body": "📌 **Where this stands** · what this ticket needs right now, kept up to date by the machine
   + **Something went wrong while I was working on this.**
   + ```
   + timone retry scratch-app#7
   + ```
   + **What I need from you:** run the command and I'll pick it up from where it stopped.",
   +     "call": "upsertComment",
   ````

   The same mutation fails **three** tests (the guard, the state-change case and the human-quotation case) and no others. Reverted.
2. **A ticket that has never been given one gets one.** Red: `expected [] to have a length of 1 but got +0`. Green: `reconcileCtas`. The body is asserted equal to `${CTA_MARKER}\n\n${FAILED_CTA}` — the marker leads, because that is what the next cycle finds it by.
3. **A state change produces exactly one edit, and the cycle after is silent.** Arrived green (the reconciler existed); driven red by the mutations it exists to catch — the unconditional upsert (above), and a guard that treats any existing CTA as unchanged, which produces `expected [] to have a length of 1 but got +0`.
4. **A ticket whose blocker closed is refreshed with nothing run by hand.** #8 queued behind #7, told *"This one is in the queue."*; #7 completes and leaves the listing; the next cycle produces **exactly one** write — #8's, now *"Picked this up."* — and #8's thread holds **one** comment carrying the marker, not two. Driven red by removing the reconciliation entirely (6 tests fail, this among them).
5. **A human's quotation of the marker is not taken for the machine's last word.** The thread carries a human comment quoting the CTA *and*, after it, the machine's own. Silent, correctly. Driven red by dropping `fromTimone` from `standingCta`: `expected [ { call: 'upsertComment', …(2) } ] to deeply equal []` — one PATCH per cycle, for ever, which is the fault in miniature.
6. **The acknowledgement is not repeated under the marker in the same cycle.** Cycle one writes exactly one `postComment`; cycle two writes exactly one `upsertComment`. Driven red by removing the skip: `expected [ { call: 'postComment', …(2) }, …(1) ] to have a length of 1 but got 2`.
7. **One unreadable thread does not abandon the rest.** `result.errors` names #7 and #8 still gets its CTA. Driven red by re-throwing: the error escapes to the project handler, `expected 'scratch-app: gh could not read issue 7' to match /#7/`, and #8 is never reached.
8. **Line endings it did not choose do not make it write.** Red before `saysTheSame` existed: `expected [ { call: 'upsertComment', …(2) } ] to deeply equal []` on a thread whose stored comment is the same words in CRLF. Green after.

**The recording instrument sees `upsertComment` — proven, not assumed.** `recordingAdapter`'s no-op became `record("upsertComment", number, marker, body)`, `WRITES` gained the entry, and *"never writes to what the human wrote, only alongside it"* now asserts the CTA write is among what it recorded. Putting the no-op back fails it: `AssertionError: expected [ 'postComment' ] to include 'upsertComment'`. Before this, that test would have watched the new write happen and reported nothing.

Commands, as given:

- `npx vitest run src/daemon/poll.test.ts` → **76 passed** (68 before, 8 added).
- `npm run type-check` → **clean**.
- `npm test` → **735 passed, 22 files, 34s. Zero failures** — 727 baseline plus 8, and `guardrails.test.ts`'s known intermittent passed this run.

Per checkbox:

- **A cycle over unchanged tickets performs ZERO writes, asserted before any happy path, by counting adapter calls** — **PASS.** It is the first test in the block, it counts calls on the seam, and the mutation probe above is what makes the count mean something.
- **A state change produces exactly one edit** — **PASS** (cases 3 and 4).
- **A third cycle is silent again** — **PASS** (case 3's fourth cycle, case 4's, and the guard case).
- **A ticket whose blocker closed has its CTA refreshed with nothing run by hand** — **PASS** (case 4): no command, no session, one cycle.
- **The recording instrument sees `upsertComment` — proven, not assumed** — **PASS**, by reverting the recorder and watching the assertion fail.
- **No second place decides what a ticket needs; `ctaFor` is the only source** — **PASS.** `reconcileCtas` contains no test of a run's status, stage or wait; its only decisions are *has this ticket just been acknowledged* and *does the body differ*. `ctaBody` is `CTA_MARKER` + `ctaComment(ctaFor(state))` and nothing else.

**Refactoring noted, deferred to the delivery review** (nothing applied): `reconcileCtas` takes seven parameters, which is the file's existing convention (`reclaimStale` takes six) and no better for it — the cycle's `project, deps, result, log` quartet is a context object waiting to be extracted, and doing it once for every function in the file is a change of a size that belongs to a review, not to a slice. And `standingCta` + `saysTheSame` express the same identity rule `github-tickets.ts`'s two upserts already express twice; a single exported *"is this the machine's comment under this marker"* predicate would leave one copy of the decision that protects a human's comment from being overwritten.

**A finding, not patched here.** A ticket whose run is `done` but which is still open and marked — a conversation concluded by `concludeLastConversation`, which completes the run without closing the ticket — now receives *"This one is finished. / nothing — file a new ticket for anything else."* That is honest and it is new; it is also the first time the loop says anything on such a ticket. If it should be closed rather than annotated, that is a change to the loop's ending, not to `ctaFor`.

**What 20d and 20h must know.**

- **Where to widen, 20d.** The reconciler walks the array `pollProject` got from `listMarkedTickets` and asks the ledger for each ticket's run. Widen that listing and every unmarked ticket gets its standing CTA for free — `ctaFor` already answers for a run-less ticket (*"I'm not working on this one. … add the `timone` label…"*), and `store.get` returning `undefined` is the normal case there, not an error. **Do not reconcile a ticket you have not listed**, and keep the acknowledged-skip: it is keyed on tickets `store.register` created this cycle.
- **Your introduction is a different comment, 20d, and its marker must not collide.** `standingCta` matches `comment.body.includes(CTA_MARKER)`, and `upsertComment` matches the same way, so an introduction whose marker *contains* `CTA_MARKER` as a substring would be found and edited by the reconciler — the introduction rewriting itself every time the CTA changes. Pick a marker that is not a substring of `CTA_MARKER` and does not contain it.
- **A ticket gets its acknowledgement on the cycle it is registered and its standing CTA on the next**, by the decision above. If 20d's introduction is posted on the first cycle an unmarked ticket is seen, decide deliberately whether the CTA joins it that same cycle or the next; the mechanism is the same `acknowledged` set.
- **How 20h observes the write volume.** The daemon prints exactly one line per CTA write: `cta    <project>#<n>`. Over a ten-minute idle run — no state changing, no ticket marked, no session started — `grep -c '^cta ' <daemon log>` **must be 0** once each ticket has settled. Cross-check it on the tracker rather than only in the log: take the CTA comment's id (`gh api repos/<slug>/issues/<n>/comments --jq '.[] | select(.body | contains("Where this stands")) | .id, .updated_at'`) and read `updated_at` again ten minutes later — **it must not have moved**. The log and the tracker disagreeing is the interesting outcome; check both, as phase 18's verification had to.
- **What makes it legitimately non-zero.** The **first** cycle after this ships: every open marked ticket has never carried a CTA under the marker, so each gets exactly one comment, once — that is the settling cycle, and the count must fall to zero on the next one. Then: a ticket marked during the run (acknowledgement on cycle N, CTA on N+1), a queue promotion, a run resuming, parking, failing or finishing, a session's stage moving. Each is **one** line for **one** ticket. Two lines for the same ticket on consecutive cycles with nothing else in the log between them is the fault, not jitter.
- **The one thing no unit test can close, and it is 20h's to close.** The guard compares what the tracker hands back against what the loop would post. `saysTheSame` absorbs CRLF and surrounding whitespace; **any other transformation GitHub applies to a comment body would turn the guard off silently and produce exactly the storm ADR-0024 names.** So the live gate's decisive observation is not the first cycle — which writes by design — but the **second** cycle over a settled ticket. If the second cycle rewrites, read the two bodies byte for byte before touching anything else.
- **The cost per cycle.** One `getTicket` per open listed ticket, plus `upsertComment`'s own read and write on the cycles it writes. A parked run still pays one read for its whole turn — the reconciler shares it — but the reconciler pays for every *other* listed ticket. On a project with a large open backlog that is the number 20d's widening multiplies, and it is worth measuring at the gate.
