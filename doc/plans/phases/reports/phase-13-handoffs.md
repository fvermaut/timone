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

## 13c — the execution stage (R6, first half)

**Built.** The daemon can now run stage 6 unattended. `PROMPTED_STAGES` gained `execution`; its prompt stays on the run's branch (ADR-0015 cited in the prompt itself), makes the phase file's own `Status:` stamp the authority on whether building may start, and closes with exactly one ticket comment carrying one of the two outcome markers. After the session, the daemon judges the stage by its two witnesses — the outcome comment and the phase file's status read off the branch (`gitPlanStatus`, behind the `planStatusProbe` seam) — and only the honest pair advances to verification. A handed-to-human outcome fails the run without daemon commentary (the session's comment is the report); every mismatched pair fails it loudly as a wiring defect.

**Files touched.**

- `src/daemon/prompts.ts` — `executionPrompt`, plus `outcomeBlock` (shared by 13d/13e's prompts).
- `src/daemon/outcomes.ts` — `outcomeCursorFrom` (newest comment as the session starts).
- `src/daemon/session.ts` — `planStatusProbe` seam + `gitPlanStatus`; `runStage` reads the outcome; `afterWorkStage` (the two-witness judgment, shared shape for 13d); `planStatus`.
- `src/daemon/pipeline.ts` — `execution.built` → true.
- `src/daemon/poll.ts` — the resume-semantics fix below.
- Tests: `prompts.test.ts`, `session.test.ts` (new describe + the reworked approval-ordering test), `poll.test.ts` (new describe), `pipeline.test.ts` (flip).

**Decisions taken inside the slice.**

- **A defect found while wiring, worth the slice's weight: the resume path would have skipped execution entirely.** Phase 11's parks recorded the stage that had already *run* (triage — resume reads what follows off the labels); 12f's park at execution recorded the stage that *could not run*. The old resume asked "what follows?" for both — harmless while `stageAfter(execution)` was undefined, but the moment 13b gave execution a successor, resuming `scratch-app` #6 would have started **verification on code nobody wrote**. `resolveWait` now distinguishes the two vintages: a non-triage kind-less park resumes at its own stage once built. Pinned by a test named for the trap.
- *The outcome cursor is the newest comment of any author at session start* (`outcomeCursorFrom`), not the machine-comment cursor gates use — an outcome must be newer than everything already said, and only machine comments can be outcomes anyway.
- *On handed-to-human the daemon posts nothing* — the session's closing comment is R6's required failure report, and a second daemon comment would say the same thing with less detail.
- *`gitPlanStatus` reads the newest `phase-NN.md`* on the branch (lexical sort — zero-padded numbers), and parses the first line containing `Status:` — verified against the live format on `scratch-app`'s branch (`> **Status:** Approved for execution by fvermaut 2026-08-05T18:02:22Z.`).

**Validation evidence.** Red first: 4 prompt tests (no execution prompt), 5 session tests (no outcome judgment), 1 poll test (the resume trap — it computed `verification`), 1 reworked phase-12 test. Green after:

```
$ npm test              → 15 files, 370 tests passed
$ npm run type-check    → clean
```

Checklist: only the artifact-and-marker pair advances ✓ (four combinations asserted, one advances); the escalation comment names the failing slice and both attempts — instructed by the prompt, asserted as marker presence, live evidence at 13h ✓; the prompt names the run's branch and the amended skill agrees ✓.

**What the next sub-phase must know.** 13d reuses `afterWorkStage` with a report-exists artifact check and must add `verification` to `PROMPTED_STAGES` — note the every-prompt `it.each` tests assert `ticketBlock` presence, and the verification prompt deliberately withholds the thread, so those tests need a threaded-stages subset rather than blanket `PROMPTED_STAGES`.

## 13d — the verification stage (R6, second half)

**Built.** The daemon runs stage 7 as a fresh session whose prompt is the one prompt built **without** `ticketBlock`: no ticket text, no thread, an explicit instruction not to go looking, and the statement of why the context is empty. It names only the project, ticket number and branch; the register on the branch is the authority. The daemon judges it by `afterWorkStage` with the report's existence as the artifact witness (`gitVerificationReport`, behind `verificationReportProbe`): done + report advances to delivery; handed-to-human (gate failed, loops spent) fails the run with the session's own comment as R6's report; mismatches fail loudly.

**Files touched.**

- `src/daemon/prompts.ts` — `verificationPrompt`; `PROMPTED_STAGES` gained `verification`.
- `src/daemon/session.ts` — `verificationReportProbe` seam + `gitVerificationReport` (resolves "newest phase" identically to `gitPlanStatus`, so the two witnesses always discuss the same phase); the verification branch of `afterStage`.
- `src/daemon/pipeline.ts` — `verification.built` → true.
- Tests: `prompts.test.ts` (the `THREADED_STAGES` split + the independence block), `session.test.ts` (new describe; 13c's advance test now asserts the hand-off into the verification prompt, since the park it previously expected no longer exists), `pipeline.test.ts` (flip).

**Decisions taken inside the slice.**

- *Independence is asserted, not reviewed:* the every-prompt `it.each` blocks split into `THREADED_STAGES` (all but verification) and a dedicated block asserting the verification prompt contains neither the ticket body, title, nor any thread text. The prompt also tells the session **not** to read the ticket — withholding without forbidding would leave a curious session one `gh issue view` from contaminated context.
- *The prompt keeps `feedbackBlock`* even though nothing sends verification back with human words today — the block renders empty when unused, and the uniform shape keeps the shared prompt tests honest.
- *The artifact witness is existence, not content.* The daemon never parses the report's verdicts — the session's outcome marker carries pass/fail, and a daemon that read verdict tables would be reimplementing stage 7's judgment (the skill owns it). Existence is what distinguishes "checked and reported" from "said done over nothing", which is all the 12f rule requires.

**Validation evidence.** Red first: 4 prompt tests (no verification prompt), 3 session tests (no verification judgment). Green after:

```
$ npm test              → 15 files, 383 tests passed
$ npm run type-check    → clean
```

Checklist: the verification prompt withholds the thread — shown by assertion ✓; a failed pass never advances, its evidence on the ticket via the session's handed comment ✓; the daemon reads outcomes, never writes a report or register ✓ (no write path exists in the daemon).

**What the next sub-phase must know.** 13e's artifact witness is the PR via `findPullRequest` — not a branch probe — and must call `store.recordPullRequest` before parking on `review` so status and the poll loop can name it. The delivery park needs a wait cursor over the *PR thread* (13a's `getPullRequestThread`), not the ticket thread.

## 13e — the delivery stage (R7)

**Built.** The daemon runs stage 8 unattended and parks the run on its pull request. The delivery prompt drives the skill to the letter — entry gates, two-axis review, delivery report committed before the PR opens, PR from the run's branch referencing the ticket, cross-links both ways, never merging. The daemon's artifact witness is **the pull request itself**, asked of the tracker via 13a's `findPullRequest` (a branch probe cannot prove a PR exists): done marker + an *open* PR parks the run on `review` with `recordPullRequest` and a cursor at the PR thread's newest comment; anything else fails loudly, and handed-to-human fails quietly with the session's comment as the report. `timone takeover` on a review park redirects to the PR by number.

**Files touched.**

- `src/daemon/prompts.ts` — `deliveryPrompt`; `PROMPTED_STAGES` gained `delivery`.
- `src/daemon/session.ts` — `afterDelivery` (PR-as-artifact judgment, the park, the cursor).
- `src/commands/takeover.ts` — the review-park redirect.
- `src/daemon/pipeline.ts` — `delivery.built` → true; the whole back half now runs.
- Tests: `prompts.test.ts`, `session.test.ts` (new describe; 13d's advance test rolled forward to assert the hand-off into the delivery prompt), `takeover.test.ts`, `pipeline.test.ts`.

**Decisions taken inside the slice.**

- *The park's cursor is the PR thread's newest comment at park time* (empty-string floor when the thread is bare — `instant("")` sorts before everything, so every later comment counts). Only what the human says after the park can wake the run.
- *An open PR is required, not just any PR* — `findPullRequest` returning a closed or merged PR at delivery time is not a deliverable under review, and parking on it would wait on a surface nobody will visit.
- *The daemon posts no park comment of its own* — the session's closing comment already links the PR and says what happens next; the ledger's `waitingOn` carries the pointer for `timone status`.

**Validation evidence.** Red first: 4 prompt tests, 3 session tests, 1 takeover test. Green after:

```
$ npm test              → 15 files, 399 tests passed
$ npm run type-check    → clean
```

Checklist: the PR is the artifact checked — a moved branch tip is not enough ✓ (no branch probe in `afterDelivery` at all); the parked run knows its PR and `timone status` says it ✓ (13b's rendering + `recordPullRequest`); takeover redirects to the PR rather than opening anything ✓.

**What the next sub-phase must know.** 13f resolves the review park in `poll.ts`: `run.waitingKind === "review"` with `run.pr` set, reading the PR thread via `getPullRequestThread` — merged → `complete` (queue promotes), closed → `complete` with a declined note on the ticket, a human comment past `waitCursor` → the remediation cycle. The remediation prompt should reuse `feedbackBlock`'s shape but with the review comment(s) as the words, and re-delivery must find the *same* PR — `findPullRequest` already prefers open PRs, and the PR number on the run is the check.
