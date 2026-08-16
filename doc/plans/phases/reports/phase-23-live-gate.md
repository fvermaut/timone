# Phase 23 — Live gate report

- **Date:** 2026-08-15 → 2026-08-16
- **Plan:** [phase-23.md](../phase-23.md) — 23i
- **Fixture:** [`scratch-app` #31](https://github.com/fvermaut/scratch-app/issues/31) — *"can I put labels on my todos and then just see one label at a time?"*, machine-typed, filed as a fixture
- **Never `ivtrends`**, ruled twice. Verified before the daemon was restarted: its only open ticket carries `wayfinder:map` and **not** the pickup label, registration requires that label, and it was already introduced on 2026-08-14 — so nothing there could be picked up or even commented on.

## What this gate was for, and what it cost

**Phase 23 shipped 932 green tests. This gate found seven defects none of them could see**, three of which were fixed during the gate and four of which are open and tracked as [issues on this repository](https://github.com/fvermaut/timone/issues). That ratio is the argument for live gates and it is now the third time it has held: [phase 14](phase-14.md) found six against 532 green, [phase 20](reports/phase-20-live-gate.md) found ten against 792.

**$216.09 across 19 sessions**, over roughly eighteen hours, on a hotel connection that dropped **13 GitHub API calls** (`unexpected EOF`, `TLS handshake timeout`, `i/o timeout`) and caused reclaims. The per-stage breakdown is in [the closing section](#the-gate-completed); **execution is 59% of the bill**, and planning cost $30.73 across four sessions because three died and were re-run — two of those deaths were finding 3, not the network.

## Findings

### 1 — A stalled run is unreachable by the human it is waiting on. **OPEN, and the worst of the seven.** Tracked as [timone#1](https://github.com/fvermaut/timone/issues/1).

Piece 2's execution ran 2h39m, stopped, and handed back to fvermaut in its own words: *"just tell me here to carry on, and I will get the missing behaviour planned properly and built."* He replied `carry on`. **Nothing read it.**

Three separate faults compound into that:

- **A handed-back run is `failed`, and a failed run has no trigger.** Only `timone retry` re-arms it. But the session that handed back had just invited a reply, as though the reply were the trigger.

  **Checked, because the first draft of this finding overstated it:** the reply is *not* unread. When the run was eventually re-armed by hand, the spawn prompt carried the whole ticket thread — 91,425 characters, `carry on` among them — and the resuming session read the ticket four times. **The words are carried; they simply cannot start anything.** That is a narrower defect than "the machine ignores you" and a more awkward one: the human writes into a channel the machine reads faithfully and acts on never, so the failure is invisible from their side. Nothing distinguishes a reply that will be picked up from one that will sit there indefinitely.
- **The two messages on the ticket contradict each other.** The session's prose asks for a reply; the standing call to action, written by different machinery, says *"Something went wrong… `timone retry scratch-app#31`"*. Nothing reconciles a session's own words with the status box above them, and the human has no way to know which one the machine is actually listening to.
- **The command the status box names cannot run** — see finding 2.

So a stalled initiative is unreachable by the only person who can unstick it, and every path the ticket offers is a dead end. This defeats the point of [ADR-0012](../../adr/0012-conversation-channels.md)'s single write-path and of [R21](../../specs/prd/prd-02-inversion-of-control.criteria.md#r21--every-open-ticket-answers-for-itself) entirely: the ticket answers for itself, and its answer is wrong.

**Not phase 23's doing** — the handed-to-human path predates it — but phase 23 makes it reachable far more often, because a chunked initiative has many more stage boundaries to stall at.

### 2 — The daemon's ledger lock refuses every command the tickets advertise. **OPEN.** Tracked as [timone#2](https://github.com/fvermaut/timone/issues/2).

Measured directly, with the daemon running:

| Command | Result |
| --- | --- |
| `timone retry` | refused |
| `timone cancel` | refused |
| `timone takeover` | refused |
| `timone status` | works (read-only) |

> `timone daemon (pid 71729) is already working this ledger — it took it at 2026-08-15T16:36:11.415Z, so this one stops rather than becoming a second writer.`

The daemon takes the lock at startup and holds it for its whole life. Every call to action Timone writes names one of the three refused commands. **To act on any ticket you must stop the daemon, act, and start it again** — which is what this gate did, four times.

[ADR-0025](../../adr/0025-a-lock-holders-proof-of-life-is-its-process.md)'s own code anticipates the daemon being the usual holder and names it so an operator can act. What nobody joined up is that the tickets advertise commands the lock blocks. It also means **[finding 9 of phase 20](reports/phase-20-live-gate.md) is only half-closed in practice**: `timone cancel` exists, and cannot be run while the daemon is up.

**This needs a design decision, not a patch**, and it was deliberately not attempted at 2am. The shape of an answer is probably that a human command asks the daemon to act rather than writing the ledger itself — but that is stage 2's question, not this report's.

### 3 — Planning never reported finishing. **FIXED** (`760ca25`).

Two planning sessions died at $5.87 and $1.83, both with *"the planning stage ended without recording an outcome, and the branch carries what it planned"*. Both had done the work; the plan and an ADR were committed and pushed.

`afterStage` judges every wait-free working stage by reading an outcome record off the ticket, and `execution`, `verification` and `remediation` all carry the prompt block that asks their session for one. `planning` was **gated** until [ADR-0030](../../adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md) D1 made it wait-free this morning, so the approval reply had always been its signal. **23b moved the judgement and nobody moved the block.**

No unit test could have caught it: the tests inject the outcome. **It was diagnosed only because fvermaut asked "is it really building?" instead of taking the session's word for it** — the report had claimed progress that was not happening.

### 4 — An approved breakdown was unreadable, and would have closed its ticket. **FIXED** (`737fe80`). The most dangerous of the seven.

The approval-record session is handed the gate reply's ISO timestamp and writes it where the instruction says `<date>`, producing:

```
**Status:** Approved by fvermaut 2026-08-15T17:24:24Z — 2 pieces
```

The parser demanded a bare `YYYY-MM-DD` and called the whole file **malformed**. An unreadable breakdown logs an error and **closes its ticket** — deliberately, since the alternative is holding a ticket open on a file nothing can read.

**So merging piece 1 would have closed #31 with piece 2 never built.** An initiative silently truncated at half: precisely the failure [ADR-0026](../../adr/0026-a-ticket-is-a-conversation-a-run-is-a-chunk.md) exists to end, reintroduced by a date format.

It was caught only because the between-pieces call to action was missing its *"— that's piece 1 of 2"*, which led back to the parse. **The writer is a prompt and the reader is a regex, and nothing type-checks one against the other.** 23a flagged exactly this hazard for the file *path* and guarded it; nobody carried the thought to the stamp on the first line of the same file.

### 5 — The chunk-zero merge commit carried no provenance. **FIXED** (`476654d`).

23d gave the daemon its first ability to write to a project's default branch, and left the merge commit untrailed. `00d84c9` landed on `scratch-app`'s `main` saying nothing about where it came from, against [ADR-0019](../../adr/0019-timone-authored-commits-carry-a-provenance-trailer.md).

**Caught by the automatic guardrail check on this session's own work**, within hours of the machinery being written. `00d84c9` is left as it is: amending means force-pushing a merge commit on a published default branch, to correct a record now accurate for every future merge.

### 6 — Clarification asks for a conversation without saying what it wants. **OPEN, minor, pre-existing.** Tracked as [timone#3](https://github.com/fvermaut/timone/issues/3).

The first stop said *"there are a few things I want to check with you"* and did not say what they were. A real user would have to start a conversation to discover the questions. This gate got past it by guessing the obvious ones and answering pre-emptively.

### 7 — A handed-back message never says whether the fault is the app or the machine. **OPEN, and fvermaut found it, not the gate.** Tracked as [timone#4](https://github.com/fvermaut/timone/issues/4).

Reading [the message that stalled piece 2](https://github.com/fvermaut/scratch-app/issues/31#issuecomment-5307032400), his first question was: *"Is it a functional issue in the app? Or a problem with the run itself?"*

**That is the question a person needs answered in the first line, and the message answers it four sections down.** It opens *"the fifth part is a measuring step, and it found a real fault and stopped"* — machine-speak for *a test caught a bug in the app*. Everything in it is accurate and it hides nothing; it is ordered for a reader who already knows how the machinery is built.

The two things are separable and both are true here, which is exactly why they must be said separately and said first:

- **The app has a real defect.** Keyboard focus is silently thrown to the top of the page when a filter change removes the element you were on — worst on the empty-filter screen, where the *"Show everything"* button destroys itself by working.
- **The run stopped correctly, and that is not a fault at all.** Fixing it needs a file the slice was not granted, so escalating was right, and it skipped its second attempt on purpose because that attempt would have been byte-identical.

A reader who cannot tell those apart cannot tell a broken product from a working process. The fix is an ordering rule for the handed-back comment — *what is wrong, whose fault, what it costs you, what I need* — not more prose.

**This is also evidence for finding 1.** He read the message, understood it well enough to answer it, replied `carry on` — and was ignored. A message this careful is wasted when the reply path is dead.

## What was proven

Every claim phase 23 makes, observed on a real ticket rather than asserted by a test:

| Claim | Evidence |
| --- | --- |
| A ticket hosts a sequence of chunks | `scratch-app#31/1` and `#31/2` in the ledger |
| Each chunk gets its own branch | `timone/31-…-and-then-ju` and `…-chunk-2` |
| A failed chunk holds its ticket; retry recovers it in place | Four real crashes, four recoveries, same branch each time |
| The human never types a chunk number | Every command was `timone retry scratch-app#31` |
| Exactly two approvals, and never a third | `grep -c` on the thread returns **2** — the specification and the list |
| A per-chunk phase file gates nothing | `phase-06.md` committed stamped `Planned`; no approval request on the thread |
| Approving the list merges chunk zero, with no pull request | `00d84c9 Merge branch 'timone/31-…'`; newest PR before #32 was **#16, from Aug 8** |
| The stamp records what was approved | `Approved by fvermaut 2026-08-15T17:24:24Z — 2 pieces` on `main` |
| The thread names the piece | *"your review of pull request #32 — that's piece 1 of 2"* |
| A merged piece opens the next one, by itself | `next … piece 2 of 2` → `pickup scratch-app#31/2` → `planning` |
| The ticket does not close while pieces remain | Still `OPEN` after #32 merged |
| Between pieces the thread is not silent and not stale | *"Piece 2 of 2 is next. — nothing right now"* |
| A review comment is fixed on the live pull request, then re-verified | `41a49a1 fix: review — collapse runs of inner whitespace` → `006e6f2 docs: verify phase 06 — re-verify at the post-delivery review fix` |

**Two of those were fvermaut's idea, not the plan's.** Commenting on the pull request instead of merging it exercised the review→remediation→re-verify→re-deliver loop, which phase 23 changed the ground under and never tested. A Docker preview of the pull request also appeared unbidden and served the feature at `http://localhost:55019/`.

**The human gate is answered** — *"I can already tell you: yes I want 1 pull request per phase/breakdown-step"* — and is [recorded in the plan with its limit](../phase-23.md): he ruled on the design before any pull request existed, and only afterwards experienced the rhythm end to end.

## The gate completed

**Written mid-flight and finished afterwards: the initiative ran to the end.** Piece 2 — *"looking at one label at a time"* — was planned, built, verified and delivered as [PR #33](https://github.com/fvermaut/scratch-app/pull/33) (+6380 −41 across 25 files) **without a single further approval**; the thread's count of approval requests never moved off **2**. On merge, the ticket closed itself:

> **Merged — this one is done.** The work for this ticket went in over 2 pieces — pull requests #32 and #33.

**Final cost: $216.09 across 19 sessions.** Execution is $128.24 of it — **59%** — across three sessions.

| Stage | Sessions | Cost |
| --- | --- | --- |
| execution | 3 | $128.24 |
| planning | 4 | $30.73 |
| verification | 3 | $27.26 |
| delivery | 3 | $21.96 |
| remediation | 2 | $3.47 |
| breakdown | 1 | $3.09 |
| requirements | 1 | $1.10 |

**Piece 2 also stalled once, legitimately** — its verification found a real accessibility defect in the new filtering (keyboard focus silently thrown to the top of the page when a filter change removes the focused element), and the fix needed a file the slice was not granted. It escalated rather than widening its own permissions, and **deliberately skipped its second attempt** because that attempt would have been byte-identical. That is the execution stage's own discipline holding under live conditions, and it is the event that exposed findings 1 and 7.

## What this gate did not prove
- **A bug taking its turn between chunks.** Never staged — the window existed, twice, and nothing was queued in it. The mechanism is unit-proven and unobserved.
- **`timone cancel` and the closed-ticket check, live.** Both are unit-proven and neither was exercised here, because finding 2 makes `cancel` unrunnable while the daemon holds the lock.
- **That any of this is affordable at real size.** $180 for a two-piece fixture on a bad connection is not a number to plan a milestone against, but it is not nothing either. The two execution sessions are 61% of it.
- **That the rhythm holds at five pieces.** Two is not five, and the honest answer still arrives on `ivtrends`.
