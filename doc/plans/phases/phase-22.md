# Phase 22: a ticket is a conversation, a run is a chunk

> **Status:** Complete — see [reports/phase-22-complete.md](reports/phase-22-complete.md). Delivered as 22a and 22b only; 22c–22f were cut unbuilt by fvermaut 2026-08-15 and are re-planned as their own phase.

> **Eleventh phase of [PRD-02](../../specs/prd/prd-02-inversion-of-control.md), and the deepest change to the ledger since the daemon was built.** Governing decision: **[ADR-0026](../../adr/0026-a-ticket-is-a-conversation-a-run-is-a-chunk.md)** (a ticket is a durable conversation; a run is one chunk of work), accepted 2026-08-14 on fvermaut's four rulings. Standing: [ADR-0012](../../adr/0012-conversation-channels.md), [ADR-0014](../../adr/0014-artifact-first-gates.md), [ADR-0015](../../adr/0015-branch-per-driving-unit.md), [ADR-0019](../../adr/0019-timone-authored-commits-carry-a-provenance-trailer.md), [ADR-0024](../../adr/0024-every-open-ticket-answers-for-itself.md).

## Why this phase exists, and why it is next

**`run.id` is literally `` `${project}#${ticket}` `` ([`runs.ts:947`](../../../src/daemon/runs.ts)), and `register` is idempotent on it ([`runs.ts:453`](../../../src/daemon/runs.ts)).** A ticket that has ever had a run can never have another. [ADR-0026](../../adr/0026-a-ticket-is-a-conversation-a-run-is-a-chunk.md) ended that identity on paper and nothing has been built.

**It is next because fvermaut asked for it before `ivtrends` #1 is picked up**, on 2026-08-14, and because two findings it closes are already blocking the phase in front of it. [Phase 21's own prerequisites](phase-21.md#context--prerequisites) say the ledger must be clear of residue before its gate starts, and [phase 20's gate findings 8 and 9](reports/phase-20-live-gate.md) are why it is not: a queued run promotes onto a closed ticket and spawns a paid session, and no command ends a run, so clearing residue still means hand-editing `.timone/state.json`. The backup file `.timone/state.json.bak-20260814` is sitting in the workspace as evidence of the last time.

**Two things the ADR warned about turn out to be free, and are recorded here so no slice spends effort on them.** The `Timone-Run:` trailer is built from `project.name` and `ticket.number` directly ([`prompts.ts:165`](../../../src/daemon/prompts.ts)) and **is never parsed anywhere** — no constant, no reader, write-only provenance for `git log --grep`. A ticket-shaped trailer stays correct under a chunked ledger and needs no change. And guardrail attribution resolves session → run on `run.sessionId` ([`guardrails.ts:135`](../../../src/commands/guardrails.ts)), not on the ticket, so it survives the split untouched.

## Requirements

> **PRD:** [prd-02-inversion-of-control.md](../../specs/prd/prd-02-inversion-of-control.md) — criteria in [prd-02-inversion-of-control.criteria.md](../../specs/prd/prd-02-inversion-of-control.criteria.md)

| ID | Priority | Requirement (one line) | This phase |
| --- | --- | --- | --- |
| PRD-02.R22 | MUST | A ticket hosts a sequence of chunks | **added and closed**, if 22f's gate is obtained |
| PRD-02.R5 | MUST | Plan gate on the ticket | **revised** — the per-chunk plan gate is retired, so its `verified` sign-off lapses |
| PRD-02.R10 | SHOULD | Serialized work per project | **revised** — the chunk holds the project, not the ticket, so its `verified` sign-off lapses |

**Nothing normative is written before approval.** R22's proposed text and the exact revisions to R5 and R10 are set out below and applied by 22e. If this phase is amended, nothing has to be unwound.

Deliberately **not** this phase: **parallel chunks on one project** — [PRD-02's out-of-scope list](../../specs/prd/prd-02-inversion-of-control.md#out-of-scope) rules out worktrees and this phase does not reopen it, so a project still runs one chunk at a time; **the attribution defect** (an uncommitted change carries no trailer); the frozen output-token counter; `timone status` understanding "blocked by".

## The five decisions this phase asks you to make

[ADR-0026](../../adr/0026-a-ticket-is-a-conversation-a-run-is-a-chunk.md) closes with four questions left open *"deliberately, and not to be inferred from this record"*. One of them it answers itself — existing runs are each a ticket with exactly one chunk and are already conformant. The other three, plus the storage question the build cannot avoid, are proposed here. **Approving this phase is the ruling**, and 22a's first act is to write them up as ADR-0028 with that date on it.

**D1 — The breakdown is a committed artifact, not a ledger record.** `doc/plans/breakdowns/ticket-NN.md` in the project repo, written by the planning stage, stamped `Awaiting approval` → `Approved`, with the readable list and the CTA posted as a ticket comment. **Why:** [ADR-0014](../../adr/0014-artifact-first-gates.md) — the human approves the artifact, never a paraphrase of it — and [ADR-0006](../../adr/0006-specs-in-repo-single-source-of-truth.md)'s rule that the repo holds the truth. The ledger stays runs-only, so there is no second copy of the approved shape that can drift from it. **The cost, named:** answering *"is there a next chunk?"* means reading a file in a checkout rather than a field in `state.json`, so `timone status` and the poll loop both pay a read they do not pay today.

**D2 — Chunk zero, and it merges on the breakdown's approval.** The requirements stage and the breakdown share one branch, and approving the breakdown merges it. **Why:** it lands the specification and the plan of work on the default branch before any code, so every subsequent chunk cuts from a current default branch — which is the rule [ADR-0015](../../adr/0015-branch-per-driving-unit.md) already relies on — and between chunks the breakdown is readable from the default branch with no branch guessing. **Approving the breakdown is one gesture with two effects and is not a third touch**: the rhythm stays *"the breakdown once, then each pull request"*, exactly as ruled.

**D3 — A ticket closes when its last chunk's pull request merges** — with a closing comment linking every pull request the initiative produced. A breakdown that gains a chunk mid-flight is a re-proposal and re-gates; the ticket does not close under it. **Why:** it makes the ticket's life derivable rather than declared, and it is the one moment at which the conversation is genuinely over.

**D4 — The thread says where the initiative stands, between chunks as well as during them.** [R21](../../specs/prd/prd-02-inversion-of-control.criteria.md#r21--every-open-ticket-answers-for-itself)'s per-cycle CTA reconciliation reads the breakdown as well as the live run: *"building piece 2 of 4"* while one runs, *"piece 3 of 4 is next — nothing needed from you"* between them, and the review CTA while a pull request waits. **Why:** without this, a ticket between chunks has no live run and R21's reconciliation would say *nothing is happening* — which would be a stale line of exactly the class R21 exists to abolish.

**D5 — A chunk's review stays on its pull request; a one-line result lands on the ticket.** [ADR-0016](../../adr/0016-review-remediation-rides-the-verify-fix-shape.md) is unchanged. **Why:** review comments are about code and belong beside it; the ticket stays the initiative's single view without becoming its diff.

## Goal Description

A ticket can host more than one run, a run can be ended, and a specification is broken into pieces you approve once and then judge one pull request at a time.

**Load-bearing, so the build does not drift into something easier:**

- **`register` stops being idempotent by ticket and becomes idempotent by *live* run.** That is the whole identity change and everything else follows it.
- **A run can reach a terminal state by command.** Not `fail` wearing a different label — `fail` means the work broke and `retry` re-arms from it. A run that should never have existed needs an exit that is not a failure.
- **Promotion re-reads the ticket.** Finding 8 is not a race; `promoteHead` ([`runs.ts:926`](../../../src/daemon/runs.ts)) consults the ledger and nothing else, by construction.
- **The human never types a chunk number.** `timone takeover ivtrends#1` and `timone retry ivtrends#1` keep working exactly as they read today. The sequence is the machine's business.
- **A phase file stops being a gate and stays an artifact.** Retiring the per-chunk plan gate does not mean retiring the plan.

## Context & Prerequisites

- **`main` is the working branch**, as for phases 15–21. `main` is at `a484d34`, clean, pushed.
- **818 tests green across 23 files at `a484d34`**, type-check clean (`npm run type-check` — note the hyphen; there is no `typecheck` script and assuming one cost a session an hour on 2026-08-14).
- **The daemon must be restarted after each slice that changes code**, before any observation of that slice. A running daemon keeps the code it started with. This has bitten four times.
- **Phase 21 is written, `Awaiting approval`, and is deliberately behind this one** — its gate creates fixture runs, and 22b is what lets it clean up after itself.

## Sub-phases

### 22a — ADR-0028, and the ledger identity

**[NEW FILE]** `doc/adr/0028-...md` — the five decisions above, dated on the approval of this phase.
**[MODIFY]** [`src/daemon/runs.ts`](../../../src/daemon/runs.ts) — `runId(project, ticket, seq)` returns `` `${project}#${ticket}/${seq}` ``; `runSchema` gains `seq`; `register` returns the ticket's live run when one exists and otherwise opens the next sequence number; `liveRunForTicket` and `runsForTicket` join the read surface; `readState` normalises an id with no `/` to sequence 1 on load, idempotently.
**[MODIFY]** [`src/daemon/poll.ts`](../../../src/daemon/poll.ts) (`:712`, `:813`, `:877`), [`src/commands/retry.ts`](../../../src/commands/retry.ts) (`:82`), [`src/commands/takeover.ts`](../../../src/commands/takeover.ts) (`:129`) — each asks *"the run for this ticket"* today and must ask *"the live one"*.

**`parseTarget` ([`takeover.ts:84`](../../../src/commands/takeover.ts)), `takeoverCommand` ([`terminal.ts:15`](../../../src/channels/terminal.ts)) and the retry CTA ([`cta.ts:119`](../../../src/daemon/cta.ts)) keep speaking `<project>#<ticket>` and are not touched.** [`prompts.ts:165`](../../../src/daemon/prompts.ts) is not touched either, per the opening.

> **✏ Refined 2026-08-15** — three corrections, made during execution on fvermaut's explicit ruling that the phase proceeds under its existing stamp. Nothing new is built; all three are forced consequences of what was already approved.
>
> **A chunk advances only on success.** The checkbox below says *"a ticket with a terminal run accepts a second run"*, and `failed` is terminal — so as first written, a failed chunk would be succeeded by a fresh one on the next poll cycle and `timone retry` would be refused by the one-session guard. That contradicts this phase's own load-bearing rule that *"`fail` means the work broke and `retry` re-arms from it"* and that `timone retry ivtrends#1` keeps working exactly as it reads today. **Ruled by fvermaut 2026-08-15: a failed chunk keeps holding its ticket until it is retried or cancelled.** A chunk is *settled* — and the ticket moves on — only when it is `done`, or `cancelled` once 22b lands. `TERMINAL` is unchanged and still frees the project for the next queued ticket; settledness is a separate, narrower idea. Recorded as **ADR-0029**, which 22a writes.
>
> **[MODIFY]** `src/commands/status.test.ts`, `src/daemon/cta.test.ts` — `Run` literals in test helpers predate `seq` and fail `npm run type-check`, which is a command in 22a's own validation block. 22a cannot pass its gate without them.
>
> **[MODIFY]** `src/daemon/poll.test.ts`, `src/daemon/session.test.ts`, `src/commands/retry.test.ts`, `src/commands/takeover.test.ts`, `src/commands/guardrails.test.ts`, `src/commands/daemon.test.ts` — 98 assertions across six files hard-code the old `project#ticket` id. The plan granted no slice the job of moving them, so the phase could never have closed. Mechanical: id literals gain `/1`, `Run` literals gain `seq`. No assertion's *meaning* changes; any that cannot be preserved is a finding, not a licence to weaken it.

**Seams under test (TDD):** `runId` and the id format; `register` opening run 2 after run 1 is terminal and returning run 1 while it lives; `liveRunForTicket` with zero, one and several runs; the load-time normalisation on a real pre-chunk `state.json` fixture; the occupancy rules still holding across two runs of the same ticket.

#### Agent Validation Steps

```bash
npm test -- src/daemon/runs.test.ts
npm run type-check
```

- [ ] A ticket with a terminal run accepts a second run; a ticket with a live run does not
- [ ] A pre-chunk state file loads, normalises to sequence 1, and re-loading it changes nothing
- [ ] `git grep -n "runId(" src/` shows no caller left passing two arguments

### 22b — A run can end, and nothing starts on a closed ticket

**[MODIFY]** [`src/daemon/runs.ts`](../../../src/daemon/runs.ts) — a `cancelled` terminal status with an empty transition list, reachable from `queued`, `picked-up`, `active` and `parked`; `cancel(id, reason)`. **`cancelled` is deliberately not `failed`:** `failed` means the work broke, `retry` re-arms from it ([`runs.ts:639`](../../../src/daemon/runs.ts)), and a run that should never have existed must not be one keystroke from restarting.
**[NEW FILE]** `src/commands/cancel.ts` + test — `timone cancel <project>#<ticket> [--reason <text>]`, cancelling that ticket's live run and saying what it did.
**[MODIFY]** [`src/cli.ts`](../../../src/cli.ts) — register the command.
**[MODIFY]** [`src/daemon/poll.ts`](../../../src/daemon/poll.ts) — before spawning a `picked-up` run, confirm the ticket is still open; cancel the run with a reason naming the closure when it is not. **In the poll loop, not the store** — `promoteHead` cannot reach the tracker and should not learn how.
**[MODIFY]** [`src/commands/status.ts`](../../../src/commands/status.ts) — render `cancelled`.

> **✏ Refined 2026-08-15** — made during execution on fvermaut's ruling, under the existing stamp. Both are forced consequences of adding a status to the union.
>
> **[MODIFY]** [`src/daemon/cta.ts`](../../../src/daemon/cta.ts) — `cta.ts:134` carries a deliberate exhaustiveness tripwire (`run.status satisfies "parked"`) which becomes a **hard compile error** the moment `cancelled` joins `RunStatus`. Without this grant 22b cannot build, so its own validation command `node dist/cli.js cancel …` cannot run. The file is already inside this phase's scope (22d modifies it); this moves it earlier. Scope is the `cancelled` branch only.
>
> **A failed run can be cancelled too.** As written, `cancelled` was reachable from `queued`, `picked-up`, `active` and `parked` only — so clearing a failed run still meant `timone retry` followed by `timone cancel`, with a window in between where the daemon could pick the run up and spend money on a fixture somebody was trying to delete. That leaves [finding 9](reports/phase-20-live-gate.md) half-closed, and the live ledger holds two failed runs (`scratch-app#10`, `#13`) that are exactly this residue — the residue [phase 21](phase-21.md#context--prerequisites) needs cleared before its gate. **Ruled by fvermaut 2026-08-15: `failed → cancelled` joins the transition list**, so one command ends a run whatever state it is in. `done` stays terminal with no exit; finished work is not abandoned, and a new ticket is the way to reopen it.
>
> **Unmarking a ticket cancels the run about to start on it.** This falls out of the closed-ticket reading above — the daemon sees only the marked-and-open set, so absence covers *closed* and *unmarked* alike and the two cannot be told apart without adapter changes no slice here is granted. **Confirmed by fvermaut 2026-08-15 as wanted, not merely tolerated:** peeling the label is how work is called off without closing the ticket, nothing is spawned, and re-marking starts a fresh chunk. The comment must keep saying what was observed — no longer open and marked — and never assert a closure that was not read.
>
> **[MODIFY]** [`src/commands/takeover.ts`](../../../src/commands/takeover.ts) — added 2026-08-15 after 22b was built, on the same forced-consequence reasoning as `cta.ts`. `takeoverCommand`'s `switch (run.status)` carries no `default`, so unlike `cta.ts` it does **not** break the build — a cancelled run silently falls past `case "parked": break;` into the parked branch and answers `"… is parked, but not on anything I can pick up in a conversation: no reason recorded"`. It is not parked, and the reason **is** recorded. Scope is one `case "cancelled":` arm. A tripwire that compiles is worse than one that does not, which is worth remembering the next time a status joins the union.
>
> **A closed ticket is one absent from the marked-and-open set.** The slice is told to *"confirm the ticket is still open"*, but `Ticket` carries no open/closed field anywhere ([`ticketing.ts:129`](../../../src/adapters/ticketing.ts)) and `listIssues` hard-codes `--state open` ([`github-tickets.ts:263`](../../../src/adapters/github-tickets.ts)) — so there is no way to ask the question directly without changing adapters this slice is not granted. What is free: `pollProject` already holds the marked-and-open list, so a closed ticket shows up as **absence from it**. That satisfies every assertion including [22f step 3](#22f--the-live-gate), and it is self-healing — `cancelled` is settled, so a reopened ticket takes a fresh chunk from `register`. The reason posted must say what was actually observed (no longer open and marked), not assert a closure that was not read.

**Seams under test (TDD):** every non-terminal status cancels and no terminal one does; `cancelled` has no exit, `retry` refuses it; the poll loop cancels rather than spawns on a ticket closed while queued; a ticket whose only run is cancelled accepts a new run, which is 22a meeting 22b.

#### Agent Validation Steps

```bash
npm test -- src/daemon/runs.test.ts src/commands/cancel.test.ts src/daemon/poll.test.ts
node dist/cli.js cancel scratch-app#999 2>&1 || true
```

- [ ] `timone retry` on a cancelled run refuses with a sentence, not a stack trace
- [ ] The poll loop's closed-ticket check fires **before** a session is spawned, asserted on the spawn call and not on a log line
- [ ] `.timone/state.json` needs no hand-edit to clear a fixture run — the whole point

> ## ✂ Cut 2026-08-15 — 22c, 22d, 22e and 22f are not built, and are not this phase's any more
>
> **Ruled by fvermaut 2026-08-15, on the finding below.** This is a **reduction in scope**, so the `Approved for execution` stamp stands: what remains is a strict subset of what was approved, and [the dependency section](#dependency-graph) already said *"22a and 22b alone are worth landing even if the rest is amended"*. They were, and they are.
>
> **Why 22c could not be executed as planned.** It grants five files. Moving the gate touches at least nine more, and three of those are decisions rather than edits:
>
> - **The gate lives in [`prompts.ts`](../../../src/daemon/prompts.ts), which is not granted.** `planningPrompt` (`:896`) instructs the agent to stamp `Awaiting approval`; `executionPrompt` (`:561`) says the phase file's own `Status:` line *"is the authority on whether you may build it"*; `APPROVAL_RECORD` (`:607`) names the phase file as the artifact the approval flips. Retiring the per-chunk gate means rewriting all three.
> - **D2 has no home.** *"Approving the breakdown merges chunk zero"* is new daemon behaviour — something must perform a merge on approval — and no granted file merges anything.
> - **The pipeline's shape is ambiguous in the plan itself.** D1 says the breakdown is written by the planning stage; D2 says it shares a branch with requirements; the file markers say the gate *after* `requirements` opens on it. That reads as either a **new `breakdown` stage** — needing `PROMPTED_STAGES`, a `stageBody` case, a prompt, a `GATED` row, and breaking two deliberately-exhaustive tests ([`pipeline.test.ts:403`](../../../src/daemon/pipeline.test.ts), [`cta.test.ts:327`](../../../src/daemon/cta.test.ts)) — or **the existing requirements gate changing its artifact while `planning` stops gating**. Those are different builds, and a slice context holds strictly less than the planner did, so it must not be the one to choose.
>
> **And one the machine noticed about itself:** 22c would make a phase file gate nothing, while [`timone-execute`'s own gate 1](../../../.claude/skills/timone-execute/SKILL.md) refuses any phase file not stamped `Approved for execution`. Those contradict, and that skill is not granted either.
>
> **D1–D5 and [ADR-0028](../../adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md) stand.** Nothing about the decisions was wrong; the plan for building them was. The breakdown is re-planned as its own phase, with the gate machinery scoped up front.
>
> **What this costs, named:** [PRD-02.R22](../../specs/prd/prd-02-inversion-of-control.criteria.md) is **not** added and not closed, and R5 and R10 keep their `verified` sign-off — the retirement that would have lapsed them is not built. 22e's register work belongs to whichever phase lands the breakdown. The sections below are kept verbatim, unbuilt, as that phase's raw material.

### 22c — The breakdown, and the gate that moves onto it

**[NEW FILE]** `src/daemon/breakdown.ts` + test — reading and writing `doc/plans/breakdowns/ticket-NN.md`: the ordered chunks, which are done, which is next.
**[MODIFY]** [`.claude/skills/timone-plan/SKILL.md`](../../../.claude/skills/timone-plan/SKILL.md) — after an approved specification, propose the shape as a breakdown on the chunk-zero branch (D1, D2); per chunk, write the phase file as today but **stamped and unGated**.
**[MODIFY]** [`process.md`](../../../process.md) stage 5 — the breakdown is stage 5's first output and its only gate; the per-chunk plan is an artifact, not a gate.
**[MODIFY]** [`src/daemon/pipeline.ts`](../../../src/daemon/pipeline.ts), [`src/daemon/gates.ts`](../../../src/daemon/gates.ts) — the gate after `requirements` opens on the breakdown; approving it merges chunk zero (D2).

**Gate parsing is unchanged** — [ADR-0012](../../adr/0012-conversation-channels.md) stands, the ticket remains the sole write-path, `approve` reads exactly as it does today.

**Seams under test (TDD):** a breakdown round-trips; a breakdown with a chunk added is detected as a re-proposal; the gate opens on the breakdown's existence and not on the session's exit code — the defect [R5's own history](../../specs/prd/prd-02-inversion-of-control.criteria.md#r5--plan-gate-on-the-ticket) records, which must not be reintroduced by moving the gate; a per-chunk phase file gates nothing.

> 22a must be complete.

#### Agent Validation Steps

```bash
npm test -- src/daemon/breakdown.test.ts src/daemon/gates.test.ts
grep -n "breakdown" process.md
```

- [ ] The gate refuses to open over a breakdown that was never written
- [ ] A phase file stamped `Awaiting approval` no longer parks a run

### 22d — Chunk succession, and what the ticket says between chunks

**[MODIFY]** [`src/daemon/poll.ts`](../../../src/daemon/poll.ts) — on a chunk's pull request merging, mark the chunk done in the breakdown; open run N+1 at planning if a chunk remains; close the ticket with a linking comment if none does (D3).
**[MODIFY]** [`src/daemon/cta.ts`](../../../src/daemon/cta.ts) — the CTA derives from the breakdown as well as the live run: building piece *n* of *N*, piece *n* next with nothing needed, or the review CTA (D4).
**[MODIFY]** [`src/commands/status.ts`](../../../src/commands/status.ts) — the same computation, one renderer each, as [R21 clause 8](../../specs/prd/prd-02-inversion-of-control.criteria.md#r21--every-open-ticket-answers-for-itself) requires.

**The project frees between chunks** — which is R10's revision, and is already how the store behaves: a parked run holds its project only once it owns a work branch ([`runs.ts:327`](../../../src/daemon/runs.ts)). A chunk that has merged and been superseded holds nothing.

**Seams under test (TDD):** the last chunk merging closes the ticket and a non-last one does not; a queued bug promotes in the window between two chunks; `timone status` and the ticket agree between chunks as well as during one.

> 22b and 22c must be complete.

#### Agent Validation Steps

```bash
npm test -- src/daemon/poll.test.ts src/daemon/cta.test.ts src/commands/status.test.ts
```

- [ ] A bug filed mid-initiative starts between chunks rather than after all of them — the point of the rule
- [ ] No open ticket is ever left with a CTA saying nothing is happening while chunks remain

### 22e — The register, the narrative, and status

**[MODIFY]** `doc/specs/prd/prd-02-inversion-of-control.criteria.md`:

- **R22 added** — *A ticket hosts a sequence of chunks.* Priority MUST, status `draft`, verify-via `api`. Criteria: a ticket whose run is terminal accepts a further run; a specification's chunks are proposed once and approved in one gesture; a per-chunk phase file gates nothing; a chunk's pull request merging starts the next chunk or closes the ticket; the project is free between chunks and a queued ticket takes its turn there; a run can be ended by command and nothing starts on a closed ticket.
- **R5 revised** — the per-chunk plan gate is retired and the gate moves to the breakdown. Status `verified` → `revised`, with a dated marker naming this phase. **Its 2026-08-05 evidence stands as history and stops counting**, exactly as R15's did on 2026-08-14.
- **R10 revised** — *the chunk* holds the project, not the ticket. Status `verified` → `revised`, same treatment. Its wording *"started only when the active run reaches a terminal state"* is what moves.

**[MODIFY]** `doc/specs/prd/prd-02-inversion-of-control.md` — an in-scope paragraph for the chunked ledger, in the voice of the others.
**[MODIFY]** [`STATUS.md`](../../../STATUS.md) — plain language: a job can be stopped now; nothing starts on a ticket you have closed; and a big piece of work is agreed once as a list and then arrives a piece at a time. The verified count corrected in both directions.

> 22a–22d must be complete.

#### Agent Validation Steps

```bash
grep -n -A6 "^## R22" doc/specs/prd/prd-02-inversion-of-control.criteria.md
grep -n -A3 "^## R5 \|^## R10 " doc/specs/prd/prd-02-inversion-of-control.criteria.md
```

- [ ] R5 and R10 read `revised`, each with a dated marker naming this phase
- [ ] The count in `STATUS.md` matches the register — it will go **down** before it goes up, and must say so

### 22f — The live gate

**[NO CODE.]** Every step on `scratch-app`. **Not `ivtrends`** — ruled on twice, and this phase changes the machinery that would drive it.

1. **A ticket hosts two chunks.** A fixture specification broken into two pieces, approved once, and both built. Expect: two branches, two pull requests, both on one ticket's thread, and the ticket closing on the second merge (D3).
2. **The window between chunks is real.** File a second marked ticket while piece 1's pull request is open. Expect: it starts **between** the chunks rather than after both — R10's revision, and the thing the rule was bought for.
3. **Nothing starts on a closed ticket.** Queue a run, close its ticket, let the project free. Expect: the run is **cancelled with a reason**, no session spawned, nothing paid for. This is finding 8, reproduced deliberately and expected to fail to reproduce.
4. **A run can be ended.** `timone cancel` on a live fixture run, and `.timone/state.json` untouched by hand afterwards. Finding 9.
5. **The thread between chunks.** Read the ticket with `gh issue view` between the two chunks and confirm it says which piece is next and that nothing is needed — not silence, and not a stale line about a run that has finished (D4).
6. **The plan is not a gate.** Confirm a per-chunk phase file is committed and that no gate opens on it, by reading the ticket thread — **not** by the absence of a call in a test.

**Seams under test (TDD):** none — this is the live gate. Phase 14 found six defects this way against 532 green tests; phase 20's gate found ten against 792, three of which no test could have seen.

> 22a–22e must be complete, and the daemon restarted after 22e.

#### Agent Validation Steps

```bash
node dist/cli.js daemon --once
node dist/cli.js status
gh issue view <n> --repo fvermaut/scratch-app --comments
cat .timone/state.json
```

- [ ] Steps 1–6 each observed with timestamps captured for the gate report
- [ ] Step 3 asserted on the spawn **not happening**, from the ledger and the cost, not from a log line
- [ ] `.timone/state.json` hand-edited **zero** times across the whole gate — if it is edited once, 22b did not land
- [ ] **Human gate:** fvermaut judges step 1 — whether being asked once for the shape and then judging two pull requests is the rhythm he ruled for

## Dependency graph

```
22a → (none)          ADR-0028, and the ledger identity
22b → 22a             a run can end, and nothing starts on a closed ticket
22c → 22a             the breakdown, and the gate that moves onto it
22d → 22b, 22c        chunk succession, and what the ticket says between chunks
22e → 22a–22d         the register, the narrative, and status
22f → 22e             the live gate
```

**22b and 22c are independent of each other** and are the phase's only parallel pair — they share no files. **22a and 22b alone are worth landing** even if the rest is amended: they close findings 8 and 9 and unblock [phase 21](phase-21.md).

## What this phase does not prove

- **That the rhythm is right at real size.** A two-chunk fixture is not a five-chunk milestone. Whether approving a shape once and then judging pull requests one at a time is enough oversight is a claim one initiative cannot make, and the honest answer arrives on `ivtrends`.
- **That a breakdown survives contact with a specification that changes.** Step 1 approves a shape and builds it. A shape that turns out wrong halfway — the case D3 calls a re-proposal — is designed for and not exercised.
- **Anything about parallel chunks.** One chunk at a time per project, unchanged, out of scope.
- **That the read cost of D1 is acceptable.** Reading the breakdown from a checkout every cycle is a cost this phase introduces and does not measure.
