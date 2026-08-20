# Phase 29: One step, one ticket — the daemon stops counting runs

> **Status:** Planned.

> **Companion phases:** [phase-22](phase-22.md) — it built the ledger half of R22, `TERMINAL`, and the settledness predicate this phase removes. [phase-23](phase-23.md) — it built the breakdown artifact, its parser, the `breakdown` pipeline stage, the chunk-zero merge, and chunk succession; **this phase changes what 23f decided and leaves the rest standing**. [phase-27](phase-27.md) — the feedback path, retired by ADR-0036, whose routing this must not disturb.
>
> Governing decisions:
> [ADR-0040](../../adr/0040-one-step-is-one-ticket-and-doneness-is-a-fact-about-a-ticket.md) is the whole of this phase;
> [ADR-0028](../../adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md) D1 and D2 stand and constrain it — the committed file remains the gate;
> [ADR-0014](../../adr/0014-artifact-first-gates.md) is why the file is not replaced by the tickets;
> [ADR-0029](../../adr/0029-a-chunk-advances-only-on-success.md) is **superseded** and is what this phase deletes.

## ✏ Refined 2026-08-20 — blockers found at pre-flight

A pre-flight read of the code against this plan, on 2026-08-20 and before any slice started, found four questions this plan cannot answer for itself, and a number of statements it made that the code contradicts. The contradictions are amended in place below, each carrying its own `✏ Refined 2026-08-20:` marker; the original wording is kept and marked superseded so execution can see what moved. **The four blockers below are stated as questions and are deliberately left unanswered here** — each one changes either behaviour the requirements protect or a command the human types, and neither is a planner's call. Each is cross-referenced from the slice it holds up.

**Blocker A — settledness has a live consumer, so 29g as written regresses R22 clause 2.** `isSettled` (`runs.ts:76`) has exactly one real use: `loadedLiveRunForTicket` (`runs.ts:585-596`), which `register` (`runs.ts:639`) calls at `runs.ts:641` to refuse a second run while one is still live. `register`'s own docblock (`runs.ts:620-637`) reads: *"A failed chunk is unsettled, so it is handed back rather than succeeded (ADR-0029): a chunk advances only on success, and `timone retry` is how a broken one recovers."* That is R22 clause 2 verbatim — the clause the Requirements section of this very file says must not regress, and the one 29d's red-green case (3) exists to guard. ADR-0040 D3 orders settledness deleted on the stated ground that *"under one ticket per step there is no count, so there is no question"*. But the question `register` asks is **not the count** — it is whether this ticket already has a live chunk, and ADR-0040's own correction section concedes exactly that: *"`SETTLED` serves `register`, which answers a different question."* **D3's premise is false in the same way its #41 citation was.** The phase cannot delete the predicate without putting a replacement in its place first.
> **Open question, for fvermaut:** is ADR-0040 D3 corrected — the predicate kept under its own name, the *count* alone deleted — or does the behaviour change? **Blocks 29g.** Filed as [timone#51](https://github.com/fvermaut/timone/issues/51), so it survives this plan.

**Blocker B — run identity is undecided, and four slices inherit it.** `runSchema` (`runs.ts:122-143`) is `{project, ticket, seq}`; `runId` is `project#ticket/seq` (`runs.ts:1209`); `timone retry <project>#<ticket>` addresses it; `runsForTicket` groups by it; `entryContext` (`poll.ts:1382`) routes on `run.seq > 1`. Under one step, one ticket, does a run key on the **step ticket** or on the **initiative**? If the step ticket: `seq` collapses to 1, the map ticket must be kept out of `listMarkedTickets`, and **`timone retry <project>#<ticket>` starts addressing a step number rather than the initiative number the human knows** — a command `STATUS.md` currently tells fvermaut to type. If the initiative: nothing records which step a merged pull request belonged to, and 29e cannot close "its step ticket". ADR-0040 is silent on it.
> **Open question, for fvermaut:** which ticket number is a run's identity? It is his because it changes what he types. **Blocks 29c, 29d, 29e and 29f** — every one of them inherits the answer.

**Blocker C — `timone status` cannot reach a ticketing adapter.** `progressReader` (`status.ts:77`) and `renderStatus` (`status.ts:229`) are synchronous and take no adapter; `registerStatusCommand` (`status.ts:308`) constructs only a `RunStore`. Reading step tickets makes the whole render async and network-bound, and puts a `gh` call on the path of every `timone status` — a command whose value is that it answers instantly. The signature change runs `renderStatus` → `describeProject` (`status.ts:200`) → `describeRun` (`status.ts:165`) / `describeWait` (`status.ts:158`) → `ctaOf` (`status.ts:142`), and through 699 lines of `status.test.ts`. Neither 29d nor 29f mentions any of this. Three candidate answers, **none chosen here**: cache child state in the ledger and render from it; render from fields already on `run`; or accept the `gh` call and make status async.
> **Open question, for fvermaut:** which of the three? **Blocks 29f**, including the shape of its validation block.

**Blocker D — the dependency notation is undefined, and it breaks the parallelism the graph claims.** ADR-0040 says only "dependencies now have to be written down"; R22's rewritten clause 3 says "any step it depends on"; 29b's case (2) says "a child whose dependency **line** is absent" and case (3) "an unreadable dependency reference". The only convention written down anywhere is prose in a skill — `.claude/skills/timone-wayfind/SKILL.md:143`: *"use GitHub's native sub-issue and dependency relationships where `gh`/GraphQL supports them (verify once per repo); where unavailable, fall back loudly to a body line `Blocked by: #N, #M`"*. **Nothing in `src/` parses `Blocked by:`** — grep returns zero hits. `gh issue list --json blockedBy` is supported on this machine (see 29b), so the fallback may not be needed at all. But 29a is pure and offline and 29b talks to `gh`, and the two must agree on one representation before either can be written.
> **Open question, for fvermaut:** is a declared dependency the native GitHub relation, the `Blocked by:` body line, or both with a stated precedence? **Blocks 29b, and blocks the 29a ∥ 29b parallelism** — see the corrected dependency graph at the end of this file.

Two further pre-flight findings were **not** questions and are applied in place, not blocking: **(E)** 29a is new code and not a lift of anything — recorded in 29a; **(F)** 29e and 29f carried no `Agent Validation Steps` block, which process.md stage 5 requires — a block is added to each, with 29f's flagged as provisional until blocker C is answered.

## Requirements

> **PRD:** [prd-02-inversion-of-control.md](../../specs/prd/prd-02-inversion-of-control.md)
> — criteria in [prd-02-inversion-of-control.criteria.md](../../specs/prd/prd-02-inversion-of-control.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-02.R22 | MUST | A ticket hosts a sequence of steps — amended 2026-08-20 so each step is its own ticket and the next one is chosen from the tickets, never counted from runs |

R22 is `draft` and has never been verified. Clauses **1, 3 and 5** were rewritten on 2026-08-20; clauses 2, 4, 6, 7 and 8 are unchanged and this phase must not regress them.

## Goal Description

`ivtrends` #1 holds 73 comments because one thread carried fourteen pieces of independent business. ADR-0040 splits it: approving the breakdown opens one ticket per step, the initiative's ticket becomes a map of those children, and the next step is chosen the way wayfinding already chooses its next question — the first open, unblocked, unassigned ticket.

**One thing this phase is not.** It is not a bug fix. The count model works: `initiativeProgress` counts `done` alone, deliberately and with a comment saying why, and measured against the real ledger it answered *piece 5 — The board*, correctly. [timone#41](https://github.com/fvermaut/timone/issues/41) said otherwise, was wrong, and is closed. **Settledness is being removed because its only consumer goes away, not because it misbehaved** — and that distinction matters here, because a slice that sets out to "fix" working code will change behaviour nobody asked it to change.

**The dangerous part is the ticket creation.** Opening fourteen issues is the first thing this system does that is loud, external and not undoable by re-running it. A retry that opens fourteen more is worse than a failure. Idempotence is therefore a property of slice 29c and is asserted, not assumed.

**The daemon runs against real projects while this is built.** `scratch-app` is the fixture ([live projects are not guinea pigs](../../adr/)); every live exercise runs there, and every ledger exercise runs against a copy driven by `--state`, never `.timone/state.json`.

> **✏ Refined 2026-08-20:** the clause above naming `--state` as the mechanism for ledger exercises is **superseded for unit tests**, which is where the phase actually spends its ledger work. `--state` is a CLI flag only — `status.ts:319`, `daemon.ts:176`, `retry.ts:344`, `cancel.ts:239`, `takeover.ts:752`, `guardrails.ts:237` — and no test harness passes it. Daemon unit tests build a **real ledger in a temp directory** instead: `mkdtempSync(join(tmpdir(), "timone-poll-"))`, then `RunStore.open(join(dir, ".timone", "state.json"), { now: () => "2026-08-02T10:NN:00Z" })` with an injected monotone clock — the established pattern at `poll.test.ts:185-193` and `session.test.ts:63-77`. The **intent is unchanged and still binding**: the repository's own `.timone/state.json` is never opened by a test. `--state` remains the right mechanism for a hand-driven exercise of the CLI.

## Context & Prerequisites

- **`src/daemon/breakdown.ts`** — `chunkProgress` (line 281) and `ChunkProgress` (256). `parseBreakdown`, the stamp and `isReproposal` all stay: the file and its gate are untouched.
- **`src/daemon/runs.ts`** — `SETTLED` (73), `isSettled` (76), its use in `register` (593). `TERMINAL` (45) **stays and is not to be conflated with it** — it answers whether a run's hold on its project is over, and a failed run must still free the project.
- **`src/daemon/poll.ts`** — ~~`initiativeProgress` (1786) and the second call site (1884). Both currently count `done`.~~
  **✏ Refined 2026-08-20:** the wording above is wrong and is superseded. `initiativeProgress` (`poll.ts:1786`) has exactly **two** call sites, and line 1884 is neither of them: they are `poll.ts:1275` inside `reconcileCtas` (`poll.ts:1234`), and `src/commands/status.ts:93` inside `progressReader` (`status.ts:77`). Line 1884 sits inside **`successionOf`** (`poll.ts:1856`) — a *different* function, which counts `done` independently at `poll.ts:1884-1886` and calls `chunkProgress` at `poll.ts:1887`. Read it as: `initiativeProgress` feeds the **text**; `successionOf` decides **what opens next and whether the ticket closes**, and its callers are `concludeInitiative` (`poll.ts:1708`) and `successorHeldBack` (`poll.ts:1928`). Both functions count `done` and both are in scope for 29d.
- **`src/daemon/cta.ts`** — `InitiativeProgress` (43) extends `ChunkProgress`; the call-to-action text between steps reads from it.
- **`src/adapters/ticketing.ts`** — the GitHub seam. ~~**Check first whether it can create an issue and set a parent**; if it cannot, 29c's first act is to add that, and this is the likeliest place the phase grows.~~
  **✏ Refined 2026-08-20:** the check was run, so it is no longer 29c's first act — see 29b, which now carries the verified capability list and the data-model gap. The short of it: `gh` supports parent/child **natively**, and the adapter's own ticket model has no `state`, no `assignees` and no `parent` to put it in. The phase still grows here, and it grows in the **schema**, not only in the call list.
- **`src/commands/status.ts`** (or wherever `timone status` renders) — it must name the live step ticket and what remains. **✏ Refined 2026-08-20:** `progressReader` (`status.ts:77`) and `renderStatus` (`status.ts:229`) are **synchronous and hold no adapter**, and `registerStatusCommand` (`status.ts:308`) builds only a `RunStore` — so "name the live step ticket" is not a rendering change, it is a signature change down the whole render path. **See blocker C at the top of this file; 29f cannot start until it is answered.**

## Sub-phases

### Sub-phase 29a: The frontier query — which step is next, from tickets

**[NEW FILE]** `src/daemon/steps.ts` — `nextStep(steps): Step | undefined`, pure. Given the initiative's step tickets — number, title, state, assignee, declared dependencies — return the first that is **open, unblocked and unassigned**. A step depending on an open step is not eligible.

**Seams under test (TDD):** `nextStep` is the seam — pure, no I/O. Red-green: (1) all open, none blocked → the first in order; (2) the first closed → the second; (3) a step whose dependency is open is skipped even when it sorts first; (4) a step whose dependency is **closed** is eligible; (5) an assigned open step is skipped; (6) every step closed → `undefined`, the close-the-initiative signal; (7) a dependency cycle does not hang — it returns `undefined` and says so, rather than looping.

**✏ Refined 2026-08-20 — this is new code, not a lift.** The Goal Description justifies `nextStep` as "the way wayfinding already chooses its next question", which reads as if there were a function to reuse. **There is not.** `frontierIsEmpty` (`pipeline.ts:57`) is a one-line label check and nothing more; the frontier rule itself is *executed by an agent* following the prose at `.claude/skills/timone-wayfind/SKILL.md:143`. Write `nextStep` from the rule as stated, and do not spend the slice hunting for an implementation to move.

**✏ Refined 2026-08-20 — case (2) has a hidden prerequisite.** "The first closed → the second" is only observable if closed children are visible at all, and today's listings hard-code `--state open` (`github-tickets.ts:263-264`). The pure function is unaffected; 29b is where this bites, and it is recorded there.

> No dependency on other sub-phases. **✏ Refined 2026-08-20:** still true for *code*, but the shape of `Step`'s "declared dependencies" field is **blocker D** — 29a and 29b must agree on one representation, so 29a is gated on that ruling even though it touches no shared file.

#### Agent Validation Steps

```bash
npm run build && npx vitest run src/daemon/steps.test.ts
```

- [ ] Red→green trace for all seven cases, each seen failing first
- [ ] Case (7) is asserted with a real cycle, not a comment claiming it cannot happen

---

### Sub-phase 29b: Reading an initiative's step tickets

**[MODIFY]** `src/adapters/ticketing.ts` — list the child tickets of an initiative and their state, assignee and declared dependencies.

**Seams under test (TDD):** the adapter function, against recorded fixtures rather than the network. Red-green: (1) children are returned in the breakdown's order, not the tracker's; (2) a child whose dependency line is absent is unblocked, not malformed; (3) an unreadable dependency reference is reported, never silently treated as unblocked — a step that should have been held back and was not is the failure mode ADR-0040 names as the one to watch.

**✏ Refined 2026-08-20 — this slice widens the ticket data model; it does not just add a call.** `ticketSchema` (`src/adapters/ticketing.ts:169`) is a `z.strictObject` carrying exactly `number, title, body, labels, url, author, createdAt` — **no `state`, no `assignees`, no `parent`** — and `LIST_FIELDS` (`src/adapters/github-tickets.ts:91`) asks GitHub for precisely those seven. A `Step` needs `state` and `assignee`, and neither exists in the process's ticket model today. Because the object is strict, adding a field is a deliberate schema change with every construction site to follow, and that is the real weight of this slice.

**✏ Refined 2026-08-20 — closed children are invisible today.** Both listings hard-code `--state open` at `github-tickets.ts:263-264`. **A closed child cannot be seen at all**, so 29a's red-green case (2) — "the first closed → the second" — has no data behind it until this changes. Widening the state filter for the child listing is part of this slice, not an afterthought.

**✏ Refined 2026-08-20 — what `gh` can actually do, verified on this machine against `fvermaut/scratch-app` on 2026-08-20.** Do not invent a mechanism; parent/child is **native** and needs no body-link convention:
- `gh issue create --parent <n>` creates a child and links it in **one** call;
- `gh issue edit <n> --parent / --add-sub-issue / --remove-parent / --remove-sub-issue` all exist;
- `gh issue list --json` accepts `parent`, `assignees`, `state`, `closed`, `closedAt`, `blockedBy`, `blocking`;
- the REST endpoint `repos/{owner}/{repo}/issues/{n}/sub_issues` is live (returns `[]` on a real issue);
- GraphQL exposes `issue.subIssues` and `issue.parent`.

**✏ Refined 2026-08-20 — "recorded fixtures" means hand-written `gh` JSON constants, not an HTTP layer.** There is no recording harness and none is to be built. The existing pattern is at `src/adapters/github-tickets.test.ts:29-45`: a `fakeRunner(...responses: string[])` returning `{ run, calls }`, which shifts one canned stdout per call and **throws on an unexpected extra call**; canned JSON is built by `ghIssue(overrides)` at `:48-59`, returning gh's real shape *including fields the adapter ignores*; the adapter is constructed per test as `new GitHubTicketingAdapter({ run })`; assertions are on the **verbatim argument vector**. Follow it exactly. The network is never reached.

> ~~No dependency on 29a — different files — so 29a and 29b may run in parallel.~~
> **✏ Refined 2026-08-20:** superseded. The file independence is real, but 29a and 29b must encode **the same** representation of a declared dependency, and no such representation is defined anywhere in `src/` — **blocker D**. **29a and 29b may not run in parallel until that is ruled on**, and 29b cannot start at all until then, because the ruling decides whether it reads `blockedBy` from `gh` or parses a `Blocked by:` body line.

#### Agent Validation Steps

```bash
npm run build && npx vitest run src/adapters/github-tickets.test.ts
```

> **✏ Refined 2026-08-20:** the command was `npm run build && npm test -- ticketing` and is superseded because **it is vacuous**. The filter matches no test file — the tests live in `src/adapters/github-tickets.test.ts`, and `src/adapters/ticketing.ts` is not a test file — and `vitest.config.ts:5` sets `passWithNoTests: true`, so the command prints "No test files found" and exits **0**. Verified by running it. The replacement names the file directly.

- [ ] Red→green trace for all three cases
- [ ] No test in this slice reaches the network
- [ ] **✏ Refined 2026-08-20:** the run reports a **non-zero test count** — a green gate over zero tests is the exact failure this command replaces, so read the count, not the colour

---

### Sub-phase 29c: Approval opens one ticket per step — idempotently

**[MODIFY]** the breakdown approval path — on the reply that stamps `Approved` and merges chunk zero, open one ticket per step as a child of the initiative's ticket, each carrying its line, a link to the breakdown, and its declared dependencies. Rewrite the initiative's ticket body to be a map of its children.

**✏ Refined 2026-08-20 — the slice had no file markers, which process.md stage 5 requires.** They are:

**[MODIFY]** `src/daemon/session.ts` — **[MODIFY]** `src/daemon/session.test.ts`

The approval path resolves to `recordApproval` (`src/daemon/session.ts:1399`, body 1399–1437), which calls `mergeChunkZero` (`src/daemon/session.ts:1449`) from `session.ts:1435`. **The seam for opening the step tickets is `recordApproval` at `session.ts:1435`, immediately after `mergeChunkZero` returns true** — the point the code's own comment calls *"one gesture with two effects"*.

**The target is split between TypeScript and a spawned model session, and the split is load-bearing.** The `Approved` stamp itself is **not** written by TypeScript: it is written by a spawned Haiku session driven by `approvalRecordPrompt` (`src/daemon/prompts.ts:750`), with the breakdown-specific instruction at `APPROVAL_RECORD.breakdown` (`src/daemon/prompts.ts:722-732`). **Ticket creation is TypeScript in `recordApproval` and must never become an instruction added to `approvalRecordPrompt`.** Idempotence is this slice's deliverable, and idempotence cannot be *asserted* about a prompt — a model told "create only what is missing" is a hope, not a guard. If the temptation appears mid-slice, this line is the answer to it.

**Test precedent to extend, not invent.** `session.test.ts:1787` already has `describe("recording an approval in the artifact")`, with the helper `atBreakdownGate(store)` at `session.test.ts:1799` and a stubbed `mergeProbe` at `session.test.ts:1814`. `AgentSessionSpawner` already holds `adapter: TicketingAdapter` (`session.ts:190`), so the fake recording adapter this slice needs is reachable without a new seam.

**✏ Refined 2026-08-20 — blocker B lands here first.** Whether a created step ticket becomes a run's identity, or stays a child the initiative's run points at, is undecided. **See blocker B at the top of this file.**

**Idempotence is the deliverable, not a nicety.** Re-running approval, or a retry after a partial failure, must **not** open a second set. Match on the initiative and the step's position, and create only what is missing.

**Seams under test (TDD):** the creation function, against a fake ticketing adapter that records calls. Red-green: (1) fourteen steps on a clean initiative → fourteen creations, in order; (2) **running it again → zero creations**, seen failing first against a naive implementation; (3) a partial failure at step 7 then a re-run → exactly the missing seven; (4) each created ticket carries its dependency; (5) the initiative's body becomes a map linking all of them.

> Depends on 29b.

#### Agent Validation Steps

```bash
npm run build && npx vitest run src/daemon/session.test.ts
```

> **✏ Refined 2026-08-20:** the command was `npm run build && npm test -- steps` and is superseded because **it is vacuous, and would stay vacuous in a way that hides itself**. Today the filter matches no test file at all, and `vitest.config.ts:5` sets `passWithNoTests: true`, so it prints "No test files found" and exits **0**. Once 29a exists it matches `src/daemon/steps.test.ts` — meaning it would run **29a's** tests and report green, having never touched this slice. 29c's seam is in `src/daemon/session.ts` and its tests are in `src/daemon/session.test.ts`, which the old filter never matched.

- [ ] Red→green for all five, and case (2) demonstrated red against a version without the guard
- [ ] No test in this slice creates a real issue on any repository
- [ ] **✏ Refined 2026-08-20:** the run reports a **non-zero test count** — a green gate over zero tests is the exact failure this command replaces, so read the count, not the colour

---

### Sub-phase 29d: The daemon takes the next step ticket

**[MODIFY]** `src/daemon/poll.ts` — ~~`initiativeProgress` and the second call site~~ read step tickets through 29a/29b instead of counting runs. **[MODIFY]** `src/daemon/cta.ts` — `InitiativeProgress` stops extending `ChunkProgress`.

**✏ Refined 2026-08-20 — "the second call site" names the wrong thing, and the mistake is the dangerous kind.** The marker is superseded by: **`initiativeProgress` (`poll.ts:1786`) *and* `successionOf` (`poll.ts:1856`)**, which are two different functions, both counting `done`.
- `initiativeProgress` has exactly two call sites — `poll.ts:1275` in `reconcileCtas` (`poll.ts:1234`) and `src/commands/status.ts:93` in `progressReader` (`status.ts:77`). It feeds **text**.
- `successionOf` counts `done` independently at `poll.ts:1884-1886` and calls `chunkProgress` at `poll.ts:1887`. It is what **actually decides what opens next and whether the ticket closes**. Its callers are `concludeInitiative` (`poll.ts:1708`) and `successorHeldBack` (`poll.ts:1928`).

**Say it plainly, because this is the trap the correction exists to prevent: a slice that rewrites only `initiativeProgress` changes the call-to-action text and leaves the daemon still counting runs everywhere it decides what to build next.** It would look done, read done, and be wrong in the one place the phase exists to fix.

**And it is not a like-for-like edit.** `successionOf` is **synchronous** today. A query over child tickets makes it async, and that propagates to **both** its callers — `concludeInitiative` and `successorHeldBack`. Budget the slice for that, not for a one-function rewrite.

**Seams under test (TDD):** `initiativeProgress`, against ledger copies. Red-green: (1) an initiative with steps 1–2 closed reports step 3 next; (2) a cancelled run against an open step leaves that step next — the case ADR-0029's count handled by excluding `cancelled`, now handled by the ticket simply still being open; (3) a `failed` run still opens no new step and `timone retry` re-arms in place, R22 clause 2 unchanged; (4) an initiative with every step closed reports none.

> Depends on 29a, 29b. **✏ Refined 2026-08-20:** and on **blocker B** — whether a run keys on the step ticket or the initiative decides what `entryContext` (`poll.ts:1382`) routes on, since it routes on `run.seq > 1` today.

#### Agent Validation Steps

```bash
npm run build && npm test -- poll
```

- [ ] All four red→green; case (3) is the regression guard on clause 2 and must be run against the pre-change behaviour too
- [ ] ~~`--state` used throughout; `.timone/state.json` is never opened by a test~~
- [ ] **✏ Refined 2026-08-20**, replacing the line above, which asked for something no test harness does: every ledger test builds **a real ledger in a temp directory** — `mkdtempSync(join(tmpdir(), "timone-poll-"))`, then `RunStore.open(join(dir, ".timone", "state.json"), { now: () => "2026-08-02T10:NN:00Z" })` with an injected monotone clock, the pattern at `poll.test.ts:185-193` and `session.test.ts:63-77`. `--state` is a **CLI flag only** (`status.ts:319`, `daemon.ts:176`, `retry.ts:344`, `cancel.ts:239`, `takeover.ts:752`, `guardrails.ts:237`) and no test passes it. **The intent is unchanged and still gates the slice: the repository's own `.timone/state.json` is never opened by a test.**

---

### Sub-phase 29e: Closing — the step, then the initiative

**[MODIFY]** the merged-pull-request path — a merged PR closes **its step ticket**, linking it. When no step ticket remains open, close the **initiative** with a comment linking every pull request.

**Seams under test (TDD):** red-green: (1) a merge closes the step ticket and not the initiative; (2) the last merge closes both; (3) an initiative with an open step is not closed even when the merged step was last in the file — order in the file is not the same as doneness.

> Depends on 29a, 29b, 29d. **✏ Refined 2026-08-20:** and on **blocker B**. This slice says "a merged PR closes **its step ticket**" — but if a run keys on the initiative rather than the step, **nothing in the ledger records which step a merged pull request belonged to**, and the slice has no way to name the ticket it is meant to close.

#### Agent Validation Steps

> **✏ Refined 2026-08-20:** this slice had no `Agent Validation Steps` block, which process.md stage 5 requires of every sub-phase. Added:

```bash
npm run build && npx vitest run src/daemon/poll.test.ts
```

- [ ] All three red→green, each seen failing first
- [ ] The run reports a **non-zero test count** — read the count, not the colour
- [ ] Case (3) is asserted with a step that is last in file order and still open, not with a comment claiming the case cannot arise
- [ ] No test in this slice closes a real issue on any repository

---

### Sub-phase 29f: `timone status` shows which step is live

**[MODIFY]** the status renderer — name the live step ticket and how many remain.

**Seams under test (TDD):** the renderer, red-green on the two states: a live step, and an initiative between steps.

> Depends on 29d. **✏ Refined 2026-08-20:** and is **blocked by blocker C** — the renderer holds no ticketing adapter and is synchronous end to end, so "name the live step ticket" is a signature change through `renderStatus` → `describeProject` (`status.ts:200`) → `describeRun` (`status.ts:165`) / `describeWait` (`status.ts:158`) → `ctaOf` (`status.ts:142`), and through 699 lines of `status.test.ts`. **Also blocked by blocker B**, which decides which ticket number the renderer prints.

**This is the one thing #41 was right about, even though its defect was not real.** Nothing has ever *displayed* which step the daemon thinks is next; I misread the model for a day because the only way to see it was to run the function by hand. A wrong pointer would still be invisible after this phase without it.

#### Agent Validation Steps

> **✏ Refined 2026-08-20:** this slice had no `Agent Validation Steps` block, which process.md stage 5 requires of every sub-phase. The block below is **provisional and cannot be finalised until blocker C is answered** — if the ruling makes the render async and network-bound, this slice acquires adapter fakes and a second test file, and the block grows accordingly.

```bash
npm run build && npx vitest run src/commands/status.test.ts
```

- [ ] Both states red→green: a live step, and an initiative between steps
- [ ] The run reports a **non-zero test count** — read the count, not the colour
- [ ] No test reaches the network, and none opens the repository's own `.timone/state.json`

---

### Sub-phase 29g: Delete settledness

**[MODIFY]** `src/daemon/runs.ts` — remove `SETTLED`, `isSettled` and its use in `register`. **[MODIFY]** `src/daemon/breakdown.ts` — remove `chunkProgress` and `ChunkProgress`.

**✏ Refined 2026-08-20 — this slice is blocked, and the part that is blocked is `isSettled`.** `register` still uses the predicate to refuse a second live run on one ticket, and its docblock states R22 clause 2 word for word. **Deleting `isSettled` as written regresses a clause this phase's own Requirements section says must not regress.** See **blocker A** at the top of this file. The rest of the deletion — the *count* — is unaffected and stands. Do not start this slice on the strength of ADR-0040 D3 alone; D3's premise is false, and the ruling on what replaces the predicate is fvermaut's.

**Deliberately last.** Everything above must be green first; deleting the old path before the new one carries the traffic is how a working system is broken on the way to a better one.

**`TERMINAL` stays.** It answers a different question and a failed run must still free its project.

**✏ Refined 2026-08-20 — the full blast radius, so the deletion can be seen before it is started.** Measured 2026-08-20; work from this list rather than from grep alone.

*Production:*
- `runs.ts:42,52,55` — docblock references; `:73` `SETTLED`; `:76-78` `isSettled`; `:513` docblock; `:593` **the only real use**, inside `loadedLiveRunForTicket` — the one blocker A holds.
- `breakdown.ts:256` `ChunkProgress`, with fields at `:257`, `:259`, `:261`; `:281-290` `chunkProgress`.
- `cta.ts:18` import; `:33` docblock; `:43` `extends ChunkProgress`.
- `poll.ts:44` import; `:1803` call; `:1887` call.

*Tests:*
- `breakdown.test.ts:8,123,125,133,137` — **three tests are deleted along with the function**, not repaired.
- `runs.test.ts:137,147,160,171,190,1231,1300`.
- `cta.test.ts:212,238,259,302,326`.
- `status.test.ts:9,601,627`.

*`TERMINAL` survivors that must remain:* the declaration at `runs.ts:45` and the use at `runs.ts:1161`. **Note the trap:** `runs.ts:42,52,55,513` are docblocks *inside `TERMINAL`'s own documentation* that cross-reference `{@link isSettled}` — so removing the symbol leaves **four dangling links to repair**, in the documentation of the neighbour this slice is under orders not to disturb.

**Seams under test (TDD):** no new behaviour — the seam is the existing suite staying green. Declare no new seams and say so.

> Depends on every preceding sub-phase. **✏ Refined 2026-08-20:** and on **blocker A**.

#### Agent Validation Steps

```bash
npm run build && npm test
```

- [ ] The full suite is green — **✏ Refined 2026-08-20:** with one named exception. `src/commands/guardrails.test.ts:205` ("resolves the session id against the ledger") is the **known real-git flake** that `vitest.config.ts:5-23` documents at length; two consecutive full runs at pre-flight gave `1 failed | 1123 passed`, then `1124 passed`, with no change in between. **A failure of that single test is not a phase failure.** Re-run the suite; only a second failure, and only a *different* one, counts against the slice.
- [ ] ~~`grep -rn "SETTLED\|isSettled\|chunkProgress" src --include="*.ts"` returns nothing; `echo "exit: $?"` reports **1**~~
- [ ] **✏ Refined 2026-08-20**, replacing the grep above, which **missed half its own target**: the pattern is case-sensitive and does not match `ChunkProgress`, a symbol this slice also deletes — so a partial deletion leaving `ChunkProgress` at `breakdown.ts:256` and `cta.ts:18,33,43` would have reported clean. Use: `grep -rn "SETTLED\|isSettled\|chunkProgress\|ChunkProgress" src --include="*.ts"` returns nothing; `echo "exit: $?"` reports **1**
- [ ] `grep -rn "TERMINAL" src --include="*.ts"` still returns its call sites — the deletion did not take the neighbour with it
- [ ] **✏ Refined 2026-08-20:** no `{@link isSettled}` remains — `grep -rn "isSettled" src --include="*.ts"` covers it, and the four docblock cross-references at `runs.ts:42,52,55,513` are the ones to repair, not to delete

---

### Sub-phase 29h: The live gate, on `scratch-app`

Break a fixture specification into three steps, approve the breakdown once, and read it end to end: three child tickets opened, the map ticket carrying links and nothing else, each step building on its own branch with its own pull request, each closing on its merge, the initiative closing on the last.

> Depends on every preceding sub-phase.

- [ ] **Human gate:** fvermaut reads the three tickets and the map, and says whether the thread is now followable — which is the entire point of ADR-0040 and the only thing no test can assert

---

### Sub-phase 29i: Close the phase

**[MODIFY]** `STATUS.md`, and the R22 marker with what was actually built.

**✏ Refined 2026-08-20 — `CONTEXT.md` needs updating too, and the plan named only `STATUS.md` and the R22 marker.** **[MODIFY]** `CONTEXT.md`:
- its **`Breakdown`** entry still says *"which piece is next is derived every time it is asked, from the approved list and the count of chunks that finished"* — ADR-0040 makes that sentence **false**, and it is the exact model this phase deletes;
- its **`Chunk`** entry needs a companion term for a **step** and one for the **map ticket**, neither of which exists in the glossary today.

**The glossary binds the code.** A phase that changes the model and leaves `CONTEXT.md` describing the old one corrupts the ubiquitous language — every later session then reads the wrong definition and writes to it in good faith. This is not documentation tidying; it is part of the phase's deliverable.

## Dependency graph

> **✏ Refined 2026-08-20:** the graph below is superseded — kept visible so the change can be seen — because it claims a 29a ∥ 29b parallelism that **blocker D** removes, and because it records no blocker gating at all. The corrected graph follows it.

```
29a → (none)              the frontier query, pure
29b → (none)              reading step tickets — parallel with 29a
29c → 29b                 approval opens the tickets, idempotently
29d → 29a, 29b            the daemon takes the next step ticket
29e → 29a, 29b, 29d       closing the step, then the initiative
29f → 29d                 status shows which step is live
29g → 29a…29f             delete settledness — deliberately last
29h → 29a…29g             the live gate on scratch-app
29i → 29a…29h             close
```

**✏ Refined 2026-08-20 — corrected dependency graph.** A blocker is an edge like any other: a slice with an unanswered blocker does not start.

```
D   → fvermaut            what a declared dependency IS, on the wire and in `Step`
B   → fvermaut            does a run key on the step ticket, or on the initiative?
C   → fvermaut            how status reaches child state without a `gh` call on every render
A   → fvermaut            is ADR-0040 D3 corrected, or does `register`'s behaviour change?

29a → D                   the frontier query, pure — needs the `Step` dependency shape
29b → D                   reading step tickets — needs the same shape, and the same one
                          ✗ NOT parallel with 29a until D is answered: they must agree
29c → 29b, B              approval opens the tickets, idempotently
29d → 29a, 29b, B         the daemon takes the next step ticket
                          — `initiativeProgress` AND `successionOf`, not one of them
29e → 29a, 29b, 29d, B    closing the step, then the initiative
29f → 29d, B, C           status shows which step is live
29g → 29a…29f, A          delete settledness — deliberately last, and A decides how much
29h → 29a…29g             the live gate on scratch-app
29i → 29a…29h             close — STATUS.md, the R22 marker, and CONTEXT.md
```

- [ ] **Human CTA:** rule on blockers **A, B, C and D** above — nothing in this phase starts until D is answered, and only 29a and 29b are unblocked by it alone
