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
