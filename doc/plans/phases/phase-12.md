# Phase 12: Gates, conversations and takeover

> **Status:** Approved for execution by fvermaut 2026-08-03. Hand-planned 2026-08-03, as all Timone-self phases are (`/timone-plan` targets managed projects only); the plan skill's shape rules — thin vertical slices, declared seams, per-slice validation — are followed, not the instrument.

> **Second phase of [PRD-02](../../specs/prd/prd-02-inversion-of-control.md).** Governing decisions: [ADR-0012](../../adr/0012-conversation-channels.md) (gates on tickets, conversations on channels — this phase *is* that ADR), [ADR-0013](../../adr/0013-stateless-session-reentry.md) (every human wait is a session boundary), [ADR-0009](../../adr/0009-cli-first-agent-tooling-mcp-for-the-gap.md) (CLI-first), [ADR-0007](../../adr/0007-sessions-at-timone-root.md) (sessions at the timone root), [ADR-0004](../../adr/0004-github-first-adapter-pair.md) (the channel seam must be real from day one). Builds directly on [phase 11](phase-11.md), whose runs all park exactly where this phase picks them up.

## Requirements

> **PRD:** [prd-02-inversion-of-control.md](../../specs/prd/prd-02-inversion-of-control.md) — criteria in [prd-02-inversion-of-control.criteria.md](../../specs/prd/prd-02-inversion-of-control.criteria.md)

| ID         | Priority | Requirement (one line) |
| ---------- | -------- | ---------------------- |
| PRD-02.R14 | MUST     | Conversation-channel seam with terminal takeover; the human names no skill |
| PRD-02.R3  | MUST     | Async clarification via a conversation; ticket carries the CTA and the accepted outcome |
| PRD-02.R4  | MUST     | PRD committed on a branch, summarized on the ticket, gated on an approval reply |
| PRD-02.R5  | MUST     | Phase file committed on the branch, referenced on the ticket, gated identically |
| PRD-02.R13 | MUST     | *(completing)* the interactive half — a raw terminal request routes through triage |

Deliberately **not** this phase: R6/R7 (execution, verification, pull request — phase 13), R11 (PR feedback loop — phase 13), R8/R12 (previews — phase 14), Slack as a second channel implementation (its own phase, behind the seam this one builds). **A real bot identity** (GitHub App, `timone[bot]`) is not here either: it needs credentials from fvermaut and is its own slice, and phase 11's marker holds until it lands.

## Goal Description

A ticket goes from *classified* to *a plan approved and ready to build*, with every human moment happening in the medium that suits it: one-off decisions answered as ticket replies, multi-turn interviews held in a terminal the human opens with a command the ticket hands them. No session is held open across a wait — each resumption is a fresh session rebuilding itself from the artifacts and the thread. At the end of the phase, `scratch-app` has a ticket whose PRD and phase file are committed, approved, and parked at the point where phase 13's execution begins.

**Load-bearing decisions, fixed here so slices don't re-litigate them:**

- **A gate reply is recognised by shape, not by sentiment.** The gate comment tells the human exactly what to type; a human comment whose first line matches an approval token (`approve`, `approved`, `yes`, `go ahead`, `lgtm`) is an approval, and **any other human comment is a change request** that loops the stage with that text as its input. Guessing at intent is how a gate silently approves something. Only comments **after** the gate comment count (cursor stored on the run), and only comments where `fromTimone` is false — phase 11's marker is what makes that possible, and it is the reason the marker was load-bearing rather than cosmetic.
- **What holds a project, restated.** ✏ **Decided by fvermaut at approval (2026-08-03): the branch-based rule, changing phase 11's.** Under phase 11 any parked run held its project, so `scratch-app` froze behind one unanswered ticket. From this phase on: **one *running session* per project at all times** (unchanged — sessions serialize), but **a parked run holds the project only once it owns a work branch**. Triage and clarification touch no repo, so several tickets may sit parked awaiting answers at once; from the requirements stage onward a run owns a branch and holds the project until it reaches a terminal state. The rejected alternative — everything parked holds the project — was simpler but froze a project on one unanswered question.
- **Takeover spawns an interactive session, not a daemon one.** `timone takeover <project>#<ticket>` resolves what the ticket waits on, builds the prompt, and execs the `claude` CLI with stdio inherited so the human converses in their own terminal (ADR-0009: CLI-first). The daemon's Agent SDK path is for unattended work; a conversation by definition is not that.
- **The channel seam is real from day one** (ADR-0004's discipline, and ADR-0012 says so outright): `ConversationChannel` — open a conversation for project/ticket/stage, and conclude it with an outcome. Terminal is the first implementation and the universal fallback; a fake channel in tests is the second implementation that proves the seam, per R14's own verification hint.
- **Resumption is a router, not a memory.** A fresh session is handed: the project, the ticket with its thread (voices separated), the stage it is resuming, and the artifacts on the branch. Nothing else. If that is not enough to continue, the artifact is what is deficient — which is ADR-0006 made load-bearing.
- **The daemon orchestrates stage skills; it never reimplements them.** 12d/12e/12f spawn sessions that invoke `timone-grill`, `timone-prd` and `timone-plan`. Where a skill and this phase disagree about a gate, the skill gets corrected — `process.md` decides.

## Context & Prerequisites

- Phase 11 shipped `src/adapters/ticketing.ts` (four capabilities, `fromTimone` per comment), `src/daemon/runs.ts` (run ledger + queue), `poll.ts`, `session.ts` (spawner + `agentSdkRuntime`), `hooks.ts` (guardrails), `src/commands/{daemon,status}.ts`. 116 tests green; `npm test` and `npm run type-check` clean on `main`.
- **`scratch-app` is currently frozen**: `#4` parked, `#6` queued behind it. Both are real triaged tickets and are this phase's natural first inputs — `#6` ("typing in the box is fiddly on my phone", classified `triage:feature`) is a good clarification candidate.
- The stage skills this phase drives already exist and are exercised: `timone-grill`, `timone-prd`, `timone-plan`.
- **Housekeeping, not a slice:** `scratch-app-2` and `scratch-existing` declare local fixture paths as `repo_url`, so every poll logs two adapter refusals. ✏ **Decided by fvermaut at approval (2026-08-03): they leave the manifest** rather than the poll loop learning to skip them. Folded into 12b; any test that depended on them as manifest fixtures moves to its own fixture.

## Sub-phases

### Sub-phase 12a: reading gate decisions off the ticket

**[NEW FILE]** `src/daemon/gates.ts` — `readGateDecision(thread, cursor)`: the first human comment after `cursor` becomes `approve` or `change-request` (carrying its text); Timone's own comments are skipped by `fromTimone`, never by author.
**[NEW FILE]** `src/daemon/gates.test.ts`
**[NEW FILE]** `src/daemon/gate-comment.ts` — the gate comment builder: what is being approved, a link to the artifact, and a CTA naming exactly what to type.

**Seams under test (TDD):** decision reading over fabricated threads — approval tokens in each accepted spelling and casing; a comment that is neither (→ change request carrying its text); **a Timone comment that contains the word "approve" is not a decision** (the trap phase 11's marker exists to close); comments before the cursor ignored; an empty thread yielding no decision; multiple replies resolving to the first human one.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/gates.test.ts
npm run type-check
```

- [ ] A machine comment can never be read as a human decision (shown red first)
- [ ] Anything not recognised as approval is a change request, never a silent approval
- [ ] The gate comment ends with a CTA stating the literal word to reply

---

### Sub-phase 12b: the pipeline state machine

**[NEW FILE]** `src/daemon/pipeline.ts` — the stage graph: what follows triage per classification, what each stage waits on (`gate` / `conversation` / nothing), and what a decision does to a waiting run (advance / re-run with feedback).
**[NEW FILE]** `src/daemon/pipeline.test.ts`
**[MODIFY]** `src/daemon/runs.ts` — runs gain `stage`, `waitingKind`, `gateCursor`, `branch`; the holds-the-project rule per the decision above.
**[MODIFY]** `src/daemon/runs.test.ts` — the rule's new cases.
**[MODIFY]** `timone.yaml` — the two fixture projects leave the manifest (housekeeping decision above).
**[MODIFY]** `src/commands/status.ts`, `status.test.ts` — ✏ **Refined 2026-08-03:** a defect the rule change itself creates. `timone status` rendered *one* busy run per project (`runs.find`), which was correct while everything parked held the project. With several tickets able to wait at once it would show one and hide the rest — exactly what this command exists to prevent. Scope-reducing correction of a defect execution found, so the approval stamp stands.

**Seams under test (TDD):** the graph as pure transitions — a `feature` classification routes to clarification, a `chore` straight to planning, a `question` terminates; an approval advances a waiting run exactly one stage; a change request re-enters the *same* stage carrying the feedback; a run without a branch does not hold its project while parked, and holds it from the moment it has one; two branchless runs may park side by side while only one session runs.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/pipeline.test.ts src/daemon/runs.test.ts
npm run type-check
```

- [ ] Routing per classification matches `process.md` stage 1, clause for clause
- [ ] A change request never advances the pipeline
- [ ] The holds-the-project rule is enforced by the store, not by callers

---

### Sub-phase 12c: the conversation seam and `timone takeover`

**[NEW FILE]** `src/channels/conversation.ts` — `ConversationChannel`: `open(project, ticket, stage)` → the CTA to post; `conclude(outcome)` → what lands on the ticket.
**[NEW FILE]** `src/channels/terminal.ts` — the terminal implementation: a CTA carrying the exact `timone takeover <project>#<ticket>` command.
**[NEW FILE]** `src/channels/terminal.test.ts`
**[NEW FILE]** `src/commands/takeover.ts` — resolve what the ticket waits on from the ledger and the thread, build the prompt, exec `claude` with stdio inherited.
**[NEW FILE]** `src/commands/takeover.test.ts`
**[MODIFY]** `src/cli.ts` — register the command.

**Seams under test (TDD):** CTA construction (the command is copy-pasteable and names project and ticket); resolution — a ticket waiting on a conversation yields that stage's prompt, a ticket waiting on a gate says "answer on the ticket instead" rather than opening an interview, an unknown or idle ticket refuses with guidance; the exec call's construction with the process launcher faked; **a second channel implementation (a fake) drives the same seam unchanged**, which is R14's third clause.

> Sub-phase 12b must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
npx vitest run src/channels src/commands/takeover.test.ts
npm run type-check
node dist/cli.js takeover --help
```

- [ ] The human types one command and names no skill and no stage
- [ ] A fake channel satisfies the seam with no change to callers
- [ ] Takeover on a ticket that is not waiting explains what it *is* doing

---

### Sub-phase 12d: clarification conversations, end to end (R3, R14)

**[MODIFY]** `src/daemon/session.ts` — per-stage prompt construction; the clarification prompt re-enters statelessly from artifacts + thread.
**[MODIFY]** `src/daemon/poll.ts` — the resume path: a waiting run whose gate reply has arrived, or whose conversation concluded, advances.
**[NEW FILE]** `src/daemon/prompts.ts` + `prompts.test.ts` — prompts as data, one per stage, so their rules are assertable.

**Seams under test (TDD):** prompt construction per stage — the clarification prompt carries the ticket, the thread with voices separated, the classification and the instruction to open a conversation, never a pre-supposed answer; the concluding write posts the accepted summary to the ticket; a conversation that ends without acceptance leaves the run waiting rather than advancing.

> Sub-phases 12a, 12b and 12c must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/prompts.test.ts src/daemon/poll.test.ts
npm run type-check
```

- [ ] Every prompt re-entering after a wait rebuilds from artifacts and thread only
- [ ] An unaccepted conversation never advances the pipeline
- [ ] The accepted outcome lands on the ticket, transcripts nowhere

---

### Sub-phase 12e: the PRD gate (R4)

**[MODIFY]** `src/daemon/prompts.ts` — the requirements-stage prompt: run `timone-prd` on a work branch, commit and push, post a summary comment with the artifact link and the gate CTA.
**[MODIFY]** `src/daemon/pipeline.ts` — the gate wiring for this stage.

**Seams under test (TDD):** the run gains its branch at this stage and therefore starts holding the project; the gate comment links the committed artifact; an approval advances to planning; a change request re-runs the requirements stage carrying the human's words; the guardrails' unpushed check is what catches a stage that committed and did not push.

> ✏ **Refined 2026-08-03 — a conflict execution found, flagged not resolved.** `process.md` stage 3 gates on *"human approves the requirement list **before** files are written"*; [PRD-02.R4](../../specs/prd/prd-02-inversion-of-control.criteria.md) says the PRD pair *"is committed on a branch, a summary comment linking to it is posted, and the pipeline waits for approval"* — commit first, then gate. Both are approved artifacts and they disagree. **Built to R4**, since it is the later and more specific decision, made for exactly this async context: on a work branch nobody merges, writing first costs nothing, and the human then reviews the real criteria register instead of a paraphrase of it. **Not resolved here.** Correcting `process.md` is a meta-level process change and gets a grill session first; until then the divergence is written down rather than smoothed over. Carried to the completion report and the open questions.

> Sub-phases 12a–12d must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
npx vitest run src/daemon
npm run type-check
```

- [ ] The gate comment links an artifact that is actually pushed
- [ ] A change request loops the same stage, never the next one
- [ ] The run holds its project from the moment it owns a branch

---

### Sub-phase 12f: the plan gate (R5)

**[MODIFY]** `src/daemon/prompts.ts`, `src/daemon/pipeline.ts` — the planning stage, gated identically; on approval the run parks awaiting phase 13's execution, saying so on the ticket.

**Seams under test (TDD):** the planning stage reuses 12e's gate mechanism rather than a second copy of it (asserted by construction, not by comment); the approved phase file carries the stamp `timone-plan` writes; the terminal park names what it waits for.

> Sub-phase 12e must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
npx vitest run src/daemon
npm run type-check
```

- [ ] One gate mechanism, two stages — no duplicated approval logic
- [ ] The end-of-phase park states plainly that building is not yet built

---

### Sub-phase 12g: live proof on the pilot

**Seams under test (TDD):** no Timone code — the seam is the observable end state of the live run.

> All prior sub-phases must be complete before starting this sub-phase.

Against `projects/scratch-app`, `--once` per step so every transition is inspectable:

1. **R3/R14:** resume `#6` (already classified `triage:feature`). Expect: a ticket comment whose CTA is a copy-pasteable `timone takeover` command, `timone status` showing a waiting gate, and no further stage running. Run the command; hold the interview to acceptance; expect the accepted summary on the ticket and status transitioning waiting → running.
2. **R4:** the requirements stage commits the PRD pair on a branch and posts a summary with the gate CTA. Reply with a **change request** first — expect the stage to re-run carrying those words, not to advance. Then approve — expect advancement.
3. **R5:** the same round-trip on the phase file.
4. **The gate trap:** confirm a Timone comment containing the word "approve" is not read as approval — the machine must not be able to approve its own work.
5. **R13's second clause:** in a terminal session at the timone root, state a raw request about a managed project and confirm it routes through triage without a skill being named. This closes the clause phase 11 left unproven and costs one prompt.
6. **The holds-the-project rule:** with `#6` mid-pipeline and holding a branch, mark a third ticket and confirm it queues; before any branch exists, confirm two tickets can park side by side.

Then `git log --stat` on scratch-app: no harness files, no timone internals.

#### Agent Validation Steps

```bash
node dist/cli.js daemon --once
node dist/cli.js status
node dist/cli.js takeover scratch-app#6
gh issue view 6 --repo fvermaut/scratch-app --json comments
git -C projects/scratch-app log --stat | grep -cE "\.claude/|timone\.yaml"   # expect 0
```

- [ ] Steps 1–6 each observed, evidence captured for the completion report
- [ ] No surface required fvermaut to name a stage or a skill at any point
- [ ] **Human gate:** fvermaut confirms the interview felt like a conversation rather than a form, and that the gate replies did what he expected

---

### Sub-phase 12h: documentation and close

**[MODIFY]** `README.md` — `timone takeover`; how a gate reply is written.
**[MODIFY]** `doc/specs/prd/prd-02-inversion-of-control.criteria.md` — after 12g's gate: R3, R4, R5, R14 as warranted; **R13 flipped only if step 5 was actually observed**.
**[MODIFY]** `STATUS.md`, and `doc/plans/phases/phase-11.md`'s holds-the-project note if the rule changed.
**[NEW FILE]** `doc/plans/phases/reports/phase-12-complete.md`

**Seams under test (TDD):** no behaviour-carrying code; validation is checklist-based.

> All prior sub-phases must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
grep -n "takeover" README.md | head
grep -n "Status:\*\* verified" doc/specs/prd/prd-02-inversion-of-control.criteria.md
```

- [ ] Register flips only where 12g produced evidence, with limits written in rather than implied
- [ ] `STATUS.md` names phase 13 as next and says the pilot starts after it

## Dependency graph

```
12a → (none)        gate decisions read off the ticket thread
12b → (none)        pipeline state machine + the holds-the-project rule
12c → 12b           conversation seam + `timone takeover`
12d → 12a,12b,12c   clarification end to end (R3, R14)
12e → 12a–12d       the PRD gate (R4)
12f → 12e           the plan gate (R5) — same mechanism, second stage
12g → all prior     live proof on scratch-app, human gate
12h → 12g           docs last + register flips
```
