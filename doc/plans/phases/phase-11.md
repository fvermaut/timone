# Phase 11: The daemon — pickup, routing, serialization

> ✏ **Superseded 2026-08-03 by [phase 12](phase-12.md):** this phase's holds-the-project rule — *any* parked run holds its project — was changed at fvermaut's approval of phase 12. Sessions still serialize one per project, but a parked run now holds the project only from the moment it owns a work branch, so tickets waiting for an answer at triage or clarification no longer freeze everything behind them. Read this file's rule as history.

> **Status:** **Complete — see [phase-11-complete.md](reports/phase-11-complete.md).** Approved for execution by fvermaut 2026-08-02; 11g's live-proof gate passed by fvermaut 2026-08-03. Hand-planned 2026-08-02, as all Timone-self phases are (`/timone-plan` targets managed projects only); the plan skill's shape rules — thin vertical slices, declared seams, per-slice validation — are followed, not the instrument.

> **First phase of [PRD-02](../../specs/prd/prd-02-inversion-of-control.md).** Governing decisions: [ADR-0002](../../adr/0002-typescript-claude-agent-sdk.md) (TypeScript + Claude Agent SDK), [ADR-0003](../../adr/0003-local-daemon-agent-runtime.md) (daemon on own hardware, polling), [ADR-0004](../../adr/0004-github-first-adapter-pair.md) (GitHub-first; seams must be real interfaces from day one), [ADR-0007](../../adr/0007-sessions-at-timone-root.md) (sessions at the timone root, target project from the event), [ADR-0009](../../adr/0009-cli-first-agent-tooling-mcp-for-the-gap.md) (CLI-first — the ticketing adapter drives `gh`), [ADR-0012](../../adr/0012-conversation-channels.md) (gates vs conversations — this phase stops at the boundary where conversations begin), [ADR-0013](../../adr/0013-stateless-session-reentry.md) (every human wait is a session boundary).

## Requirements

> **PRD:** [prd-02-inversion-of-control.md](../../specs/prd/prd-02-inversion-of-control.md) — criteria in [prd-02-inversion-of-control.criteria.md](../../specs/prd/prd-02-inversion-of-control.criteria.md)

| ID         | Priority | Requirement (one line) |
| ---------- | -------- | ---------------------- |
| PRD-02.R1  | MUST     | Daemon polls managed projects' ticketing, picks up marked tickets, acknowledges on the issue, run appears in status |
| PRD-02.R2  | MUST     | Daemon-spawned sessions run from the timone root, resolve the target project from the event, touch only `projects/<X>/…` |
| PRD-02.R13 | MUST     | Harness-owned routing: every request is triaged by the harness; no surface requires the human to name a stage or skill |
| PRD-02.R9  | SHOULD   | `timone status`: every project's active ticket, stage, and waiting gate in one glance |
| PRD-02.R10 | SHOULD   | One active ticket per project; further marked tickets visibly queued |
| PRD-02.R15 | SHOULD   | Post-session guardrail hooks: unpushed commits, `STATUS.md` off the default branch, path containment — reported loudly |

Deliberately **not** this phase: R3/R14 (conversations, gates, takeover — phase 12), R4–R7 (pipeline stages beyond triage — phases 12–13), R8/R12 (previews — phase 14), R11 (PR feedback loop — phase 13). The pipeline this phase builds runs exactly one stage — triage — then parks the run with a comment saying what it is waiting for; that is the scope boundary, stated on the ticket rather than silently hit.

## Goal Description

The first executable slice of the inverted loop, end to end: a ticket filed in plain language on a managed GitHub project is noticed by a daemon on this machine, acknowledged, routed through triage by a spawned agent session that never asks the human to know anything about the process, and left parked — visibly, with its classification recorded on the ticket and its run visible in `timone status` — at the point where phase 12's gates and conversations will pick it up. A second marked ticket on the same project queues instead of running. After every spawned session, deterministic hooks check the three rules agents have been observed breaking silently.

**Load-bearing decisions, fixed here so slices don't re-litigate them:**

- **The ticketing adapter is a real interface from day one** (ADR-0004's consequence, R14's future needs): `TicketingAdapter` — list marked open tickets, read a ticket with its thread, post a comment, apply/read labels. The GitHub implementation drives `gh` (ADR-0009); tests drive a fake command runner, never the network.
- **The mark is a permission boundary, not a routing instruction** (R13 made it so): a `timone` label on the issue is what the daemon may touch — settling PRD-02's open question in its simplest form. No bot-account assignee; revisit only if label spoofing ever matters on a client repo.
- **Daemon state lives outside git:** `.timone/state.json` at the timone root, gitignored — runs, queue positions, last-seen cursors. One machine, one daemon (ADR-0003); no locking beyond a pid check.
- **Sessions are spawned via the Claude Agent SDK** (ADR-0002 — the dependency enters here), from the timone root, with the event context (project, ticket) injected; the session's instruction is to run triage on the ticket per R13, not to be told what the ticket "is".
- **The daemon is a foreground process** (`timone daemon`) for this phase — launchd/pm2 wrapping is operational polish, not a requirement.
- ✏ **Refined 2026-08-03 (defect found at 11g's gate, stamp retained):** **every machine-written ticket comment carries a marker line** (`MACHINE_MARKER`), and attribution is read from that marker, never from the author. Timone posts through the human's `gh` credentials, so without it the thread reads as though they wrote their own acknowledgements and their own verdicts — and a session reading the thread back cannot tell its own words from theirs. That last part is the load-bearing half: ADR-0012 makes ticket replies the decision write-path, so phase 12 would otherwise be able to read Timone's own comment as the human's approval. Three places hold it: the adapter stamps everything it posts (11a), the spawned session is instructed to stamp what it posts itself (11d), and `getTicket` returns `fromTimone` per comment so the prompt can separate the two voices (11a + 11d). **A real bot identity** (GitHub App, `timone[bot]`) is the proper fix and is deferred to its own slice — it needs credentials from the human. **Also deferred, and deliberately not done here:** making the marker a process-wide convention in `process.md` and the stage skills, so interactive sessions mark their comments too — a meta-level process change, which gets a grill first.

## Context & Prerequisites

- `gh` installed and authenticated; the pilot project is `projects/scratch-app` (GitHub-hosted, real PRs already flowing).
- `src/` today: `cli.ts`, `commands/`, `manifest.ts`, `workspace.ts`, `git.ts` — commander CLI, vitest co-located tests (`*.test.ts` beside sources), `npm test` / `npm run type-check` green on `main`.
- **No Agent SDK dependency exists yet** — 11d adds `@anthropic-ai/claude-agent-sdk`.
- `process.md` § "Gates, conversations and the human" (2026-08-02) and CLAUDE.md's routing rule are already in force for interactive sessions; this phase extends the same contract to the daemon path.

## Sub-phases

### Sub-phase 11a: the ticketing adapter — seam and GitHub implementation

**[NEW FILE]** `src/adapters/ticketing.ts` — the `TicketingAdapter` interface: `listMarkedTickets(project)`, `getTicket(project, n)` (body + comment thread), `postComment(project, n, body)`, label read/apply. Types only, zod-validated shapes.
**[NEW FILE]** `src/adapters/github-tickets.ts` — implementation over `gh issue …` / `gh api …` via an injected command runner.
**[NEW FILE]** `src/adapters/github-tickets.test.ts`

**Seams under test (TDD):** the `TicketingAdapter` contract observed through the GitHub implementation with a **fake command runner** — constructed `gh` invocations (repo, filters, label) and parsing of canned JSON responses, including: empty result, pagination boundary, a ticket whose body is plain naive language.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
npx vitest run src/adapters/github-tickets.test.ts
npm run type-check
```

- [ ] Interface exposes exactly the four capabilities; no GitHub type leaks through it
- [ ] All `gh` calls flow through the injected runner; tests never touch the network
- [ ] A malformed `gh` response fails loudly with the raw payload in the error
- [ ] ✏ Refined 2026-08-03: every posted comment is stamped as the machine's, and a stamped comment is not stamped twice
- [ ] ✏ Refined 2026-08-03: `fromTimone` separates Timone's comments from the human's when both carry the same author

---

### Sub-phase 11b: run state and the per-project queue

**[NEW FILE]** `src/daemon/runs.ts` — run lifecycle (`picked-up → active → parked | done | failed`) and the per-project queue: one active run, others `queued`, persisted to `.timone/state.json` atomically.
**[NEW FILE]** `src/daemon/runs.test.ts`
**[MODIFY]** `.gitignore` — add `.timone/`

**Seams under test (TDD):** the queue state machine as pure transitions — pickup on an idle project activates; pickup on a busy project queues; a run reaching a terminal state promotes the head of the queue; re-pickup of an already-tracked ticket is a no-op (idempotency); state round-trips through serialization.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/runs.test.ts
npm run type-check
git check-ignore .timone/state.json
```

- [ ] One active run per project is an invariant the store enforces, not a convention callers follow
- [ ] Same ticket picked up twice yields one run
- [ ] `.timone/` is ignored

---

### Sub-phase 11c: the poll loop — pickup and acknowledgement (R1, R10)

**[NEW FILE]** `src/daemon/poll.ts` — one poll cycle: for each `timone.yaml` project, list `timone`-labelled open tickets via the adapter, register unseen ones with the store, post the acknowledgement comment (with its queue position when queued), and hand active runs lacking a session to 11d's spawner.
**[NEW FILE]** `src/daemon/poll.test.ts`
**[NEW FILE]** `src/commands/daemon.ts` — `timone daemon [--interval <s>] [--once]`; `--once` runs a single cycle (the testing and live-proof workhorse).
**[MODIFY]** `src/cli.ts` — register the command.

**Seams under test (TDD):** one poll cycle against fake adapter + real store (temp state file) — a marked ticket creates a run and exactly one ack; an unmarked ticket creates nothing; a second cycle re-acks nothing (idempotency across cycles); a second marked ticket on a busy project registers as `queued` and its ack says so.

> Sub-phases 11a and 11b must be complete before starting this sub-phase. The 11d hand-off is behind an injected spawner interface, so 11c completes without 11d.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/poll.test.ts
npm run type-check
node dist/cli.js daemon --help
```

- [ ] Marked → run + one ack; unmarked → untouched; re-poll → silent (three tests, each shown red first)
- [ ] The ack comment ends with a CTA line (even if it is "no action needed — triage will follow")
- [ ] Poll errors on one project don't abort the cycle for the others

---

### Sub-phase 11d: session spawn and triage routing (R2, R13)

**[MODIFY]** `package.json` — add `@anthropic-ai/claude-agent-sdk`.
**[NEW FILE]** `src/daemon/session.ts` — the spawner: given an active run, launch an Agent SDK session **from the timone root** whose event context names the target project and ticket, instructed to run stage-1 triage on the ticket's raw text and record the classification per `process.md` (issue comment + `triage:<kind>` label); on session end, mark the run `parked` with a ticket comment naming what it waits for (phase 12's gates/conversations).
**[NEW FILE]** `src/daemon/session.test.ts`

**Seams under test (TDD):** spawn configuration construction with the SDK faked — cwd is the timone root; the prompt carries project + ticket number + the routing instruction and **not** a pre-classified kind (routing is the session's job, not the spawner's); the target is validated against `timone.yaml` before spawn; a session's exit flips the run state exactly once. Live behaviour is 11g's to prove, not this slice's.

> Sub-phases 11a–11c must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/session.test.ts
npm run type-check
npm ls @anthropic-ai/claude-agent-sdk
```

- [ ] Spawner refuses a project absent from `timone.yaml` (R2's validation clause)
- [ ] The prompt tells the session to classify — it never tells it the classification
- [ ] Run state transitions are driven by session lifecycle events, once each
- [ ] ✏ Refined 2026-08-03: the prompt instructs the session to mark the comments it posts, and labels each thread comment as the human's or Timone's own

---

### Sub-phase 11e: post-session guardrail hooks (R15)

**[NEW FILE]** `src/daemon/hooks.ts` — three deterministic checks run after every spawned session, each a pure function over injected git evidence: **unpushed** (`rev-list @{u}..` non-empty on any touched branch), **STATUS.md placement** (a commit touching `STATUS.md` on a non-default branch), **path containment** (commits or working-tree changes outside `projects/<target>/`, process artifacts excepted per R2). Violations → one loud ticket comment each + the run flagged in state.
**[NEW FILE]** `src/daemon/hooks.test.ts`

**Seams under test (TDD):** each check over fabricated git evidence — the violating and the clean case for all three; the reporter posts one comment per violation and nothing on a clean run.

> Sub-phase 11b must be complete (run flagging); 11d's spawner calls the hooks, wired when both exist.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/hooks.test.ts
npm run type-check
```

- [ ] Each of the three checks shown failing (red) on its violating fixture before passing
- [ ] A clean session posts nothing (silence is asserted, not assumed)
- [ ] Hook failures flag the run but never crash the daemon

---

### Sub-phase 11f: `timone status` (R9)

**[NEW FILE]** `src/commands/status.ts` — every managed project on one line: active ticket + stage, waiting-on-human gate if any, queue depth, hook flags. Reads `.timone/state.json` only; no network.
**[NEW FILE]** `src/commands/status.test.ts`
**[MODIFY]** `src/cli.ts` — register the command.

**Seams under test (TDD):** rendering over state fixtures — idle project, active run, parked-waiting run, queued tickets, hook-flagged run; and the empty state (daemon never run) degrading to a friendly line, not a crash.

> Sub-phase 11b must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
npx vitest run src/commands/status.test.ts
npm run type-check
node dist/cli.js status
```

- [ ] One glance answers: which ticket, which stage, who's waited on — per project
- [ ] Empty/absent state file yields guidance, not a stack trace

---

### Sub-phase 11g: live proof on the pilot

**Seams under test (TDD):** no Timone code — the seam is the observable end state of the live run, asserted below.

> All prior sub-phases must be complete before starting this sub-phase.

Against `projects/scratch-app`, with the daemon in `--once` mode per step so every transition is inspectable:

1. **R1 discrimination:** file one `timone`-labelled issue in deliberately naive language ("the page feels slow when I add many items") and one unlabelled issue; one poll cycle. Expect: a run + ack for the first, nothing for the second.
2. **R13/R2 routing:** let the spawned session triage the naive ticket. Expect: a classification comment with rationale + `triage:<kind>` label, no stage or skill named to the human, every touched file under `projects/scratch-app/…`, and the run parked with a comment naming what phase 12 will bring.
3. **R10 serialization:** file a second labelled ticket while the first run is active. Expect: queued, ack says so, `timone status` shows both.
4. **R15 violation:** force one hook violation in a scripted session (a commit left unpushed suffices). Expect: one loud ticket comment + flagged status. Then one clean re-run: silence.
5. **R9:** `timone status` output matches every state above at each step.

Then `git log --stat` on scratch-app: no harness files, no timone internals (the standing R2/PRD-01.R4 regression check).

#### Agent Validation Steps

```bash
node dist/cli.js daemon --once
node dist/cli.js status
cd projects/scratch-app && gh issue list --label timone --json number,labels,comments
git -C projects/scratch-app log --stat | grep -E "\.claude/|timone\.yaml"; echo "exit: $? (1 = clean, as required)"
```

- [ ] Steps 1–5 each observed with the expected end state, evidence captured for the completion report
- [ ] The naive ticket was never answered with process vocabulary requiring human process knowledge
- [ ] **Human gate:** fvermaut confirms the loop's first slice behaves — pickup, routing, queueing, hooks, status — and the ack/CTA wording reads right

---

### Sub-phase 11h: documentation

**[MODIFY]** `README.md` — `timone daemon` and `timone status` under "Working with Timone"; the `timone` label convention.
**[MODIFY]** `doc/specs/prd/prd-02-inversion-of-control.criteria.md` — after 11g's human gate: flip R1, R2, R13 as verified; R9, R10, R15 as warranted by the evidence.
**[MODIFY]** `STATUS.md` — Timone's own, per the every-stage obligation.

**Seams under test (TDD):** no behaviour-carrying code; validation is checklist-based.

> All prior sub-phases must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
grep -n "daemon\|status\|timone label" README.md | head
grep -n -B1 "verified" doc/specs/prd/prd-02-inversion-of-control.criteria.md | head -20
```

- [ ] Documented invocations match actual behaviour; links resolve
- [ ] Register flips only after 11g's human gate, only where evidence exists
- [ ] `STATUS.md` names phase 12 (gates + takeover) as next and says the pilot starts after phase 13

## Dependency graph

```
11a → (none)        ticketing adapter seam + gh implementation
11b → (none)        run state + per-project queue (.timone/, gitignored)
11c → 11a, 11b      poll loop: pickup + idempotent ack (R1, R10); spawner injected
11d → 11a–11c       Agent SDK enters; spawn at root + triage routing (R2, R13)
11e → 11b (+11d wiring)  guardrail hooks (R15)
11f → 11b           timone status (R9)
11g → all prior     live proof on scratch-app, human gate
11h → 11g           docs last + register flips
```
