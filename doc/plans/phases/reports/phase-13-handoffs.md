# Phase 13 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 13a — the pull-request surface of the ticketing seam

**Built.** The `TicketingAdapter` seam widened from four capabilities to seven: `findPullRequest(project, branch)` (state-mapped, liveliest-wins precedence, `undefined` when none), `getPullRequestThread(project, number)` (conversation comments, review summaries and inline review comments merged as one thread, oldest first, `fromTimone` per comment), and `postPullRequestComment(project, number, body, replyTo?)` (machine-stamped; threads under an inline comment's root when `replyTo` is given). Neutral types (`PullRequest`, `PullRequestComment`, `PullRequestThread`, `PR_STATES`) live in `ticketing.ts`; the `gh` implementations in `GitHubTicketingAdapter`.

**Files touched.**

- `src/adapters/ticketing.ts` — neutral PR types and the three interface methods; the seam's own comment updated from "four capabilities" to "seven", naming this the phase-13 deliberate widening.
- `src/adapters/github-tickets.ts` — `gh pr list --head` / `gh pr view` + `gh api --paginate pulls/N/comments` / `gh pr comment` + the REST replies endpoint.
- `src/adapters/github-pulls.test.ts` — new; 16 tests over the fake command runner.
- Five test files gained a `noPullRequests` stub spread into their inline adapter fakes (`poll.test.ts` ×3 fakes, `session.test.ts`, `hooks.test.ts`, `takeover.test.ts`) — the seam widening is a breaking interface change and every fake implements the interface honestly.

**Decisions taken inside the slice.**

- *One merged thread, not three surfaces.* GitHub splits PR talk across conversation comments, review summaries and inline review comments; the process reads "what did the human say since the cursor", so the adapter merges all three oldest-first and the distinction stays GitHub's business. Review summaries with empty bodies (bare verdicts, inline-only reviews) are dropped rather than surfaced as empty comments.
- *`replyTo` names the thread root.* Inline comments carry `replyTo = in_reply_to_id ?? id`, so replying to any comment in a thread targets the root — which is what GitHub's replies endpoint accepts. Conversation comments and review summaries carry no `replyTo`: GitHub's PR conversation is flat, and pretending otherwise would promise threading the tracker cannot do.
- *Liveliest PR wins.* When one branch has several PRs, precedence is open > merged > closed, newest first within a state — a stale closed PR must not hide the one under review (needed by 13e's artifact check and 13f's terminal states).
- *`pageLimit` reused* for `gh pr list` rather than a second option; same truncation-refusal rationale as issues.
- *The `noPullRequests` stub throws on `getPullRequestThread`* rather than returning an empty thread, so a test that unexpectedly exercises the PR path fails at the reach instead of passing on fabricated silence.

**Validation evidence.** Red first: the 16 new tests failed (`postPullRequestComment` / `findPullRequest` / `getPullRequestThread` do not exist) before the implementation. Green after:

```
$ npx vitest run src/adapters   → 2 files, 35 tests passed
$ npm run type-check            → clean (after extending the five fakes)
$ npm test                      → 14 files, 334 tests passed
```

Checklist: seam stays tracker-agnostic (nothing GitHub-shaped in `ticketing.ts` types) ✓; a machine PR comment can never read as human (marker-derived `fromTimone`, asserted against same-login comments) ✓; the widening is exactly three capabilities ✓.

**What the next sub-phase must know.** 13b needs no adapter work — but its `readStageOutcome` should live beside `readGateDecision` in `gates.ts` patterns, and the outcome marker constant belongs in `ticketing.ts` next to `CONVERSATION_RECORD_MARKER`. When 13e/13f need PR fakes with actual threads, extend the `noPullRequests` pattern locally rather than teaching every fake about PRs.

## 13b — the pipeline learns the back half

**Built.** The stage graph gained `verification` (process stage 7) and `delivery` (process stage 8): execution → verification → delivery, all three owning the branch; delivery waits on the new kind `review`, and nothing follows it in the graph — the PR's merge or close is a terminal event on the run, not a stage. Two outcome markers (`STAGE_DONE_MARKER`, `STAGE_HANDED_MARKER`) joined their siblings in `ticketing.ts`, read by the new `readStageOutcome(thread, cursor)`. Runs carry `pr`, park on `review`, and persist both. `timone status` renders the back half in plain words ("building", "checking the result") and names the pull request a review wait points at.

**Files touched.**

- `src/daemon/pipeline.ts` — three stages added to `PIPELINE_STAGES` and the graph; `WaitKind` gained `review`.
- `src/adapters/ticketing.ts` — the two stage-outcome marker constants.
- `src/daemon/outcomes.ts` + `outcomes.test.ts` — new; the third cursor-relative reader.
- `src/daemon/gates.ts` — `instant()` exported for the sibling reader.
- `src/daemon/runs.ts`, `runs.test.ts` — `pr` field, `review` wait kind, `recordPullRequest`.
- `src/commands/status.ts`, `status.test.ts` — `STAGE_LABELS` map and the review-wait phrase.

**Decisions taken inside the slice.**

- **`built` stays `false` for all three new stages.** The first full-suite run caught me flipping them in this slice: a phase-12 test rightly insists a stage the graph calls built but nothing can run is a lie the daemon acts on (an approval-recording run would have advanced into a promptless execution stage and failed). Each stage flips as the slice supplying its prompt lands — 13c, 13d, 13e — exactly as `requirements` and `planning` did in phase 12.
- *A comment carrying both outcome markers reads as handed-to-human* — the safe direction; a wrongly stopped pipeline costs a retry, a wrongly advanced one builds on nothing.
- *A human comment can never be a stage outcome*, whatever it quotes — the mirror of 12a's gate trap, asserted with a `fromTimone: false` comment containing the marker verbatim.
- *The review-wait status line reads the PR number off the ledger* (`run.pr`), not off the recorded `waitingOn` prose, so the pointer survives a terse park message.
- *Front-half stage names stay as they are* on status lines — they shipped under R9's sign-off; only the back half gets the plain-word map, since "execution" answers less than "building".

**Validation evidence.** Red first: 8 outcome tests failed on the missing module, 6 pipeline tests on the missing stages, 3 runs tests on the missing field/kind, 2 status tests on the raw stage names. Green after:

```
$ npm test              → 15 files, 352 tests passed
$ npm run type-check    → clean
```

Checklist: stages map to `process.md` 6/7/8 by assertion ✓; a run parked on review holds its project until `complete()` and the queue promotes then ✓; status explains every new state without process jargon (asserted `not.toMatch(/execution|verification/)`) ✓.

**What the next sub-phase must know.** 13c flips `execution.built` and must update the phase-12 session test that expects an approved plan to park at "not built yet" — that park disappears the moment execution runs for real. `readStageOutcome` needs the wait cursor captured *before* the stage session starts (the pre-session ticket state), not after, or the outcome comment itself lands behind the cursor.
