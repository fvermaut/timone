# Phase 29: One step, one ticket — the daemon stops counting runs

> **Status:** Planned.

> **Companion phases:** [phase-22](phase-22.md) — it built the ledger half of R22, `TERMINAL`, and the settledness predicate this phase removes. [phase-23](phase-23.md) — it built the breakdown artifact, its parser, the `breakdown` pipeline stage, the chunk-zero merge, and chunk succession; **this phase changes what 23f decided and leaves the rest standing**. [phase-27](phase-27.md) — the feedback path, retired by ADR-0036, whose routing this must not disturb.
>
> Governing decisions:
> [ADR-0040](../../adr/0040-one-step-is-one-ticket-and-doneness-is-a-fact-about-a-ticket.md) is the whole of this phase;
> [ADR-0028](../../adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md) D1 and D2 stand and constrain it — the committed file remains the gate;
> [ADR-0014](../../adr/0014-artifact-first-gates.md) is why the file is not replaced by the tickets;
> [ADR-0029](../../adr/0029-a-chunk-advances-only-on-success.md) is **superseded** and is what this phase deletes.
>
> **✏ Refined 2026-08-21:** [ADR-0044 — *A run belongs to a step ticket, and the assignee is what holds it*](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) **now governs this phase alongside ADR-0040**, and where the two differ it wins. It records fvermaut's rulings of 2026-08-21 on all four pre-flight blockers and three consequences that fell out of them; it **corrects ADR-0040 D3** (settledness stays; only the counting goes) and **reverses ADR-0040's** *"a cancelled step is simply the next eligible step again"* (a cancelled step is dropped and stays stopped). [ADR-0042](../../adr/0042-timone-acts-under-its-own-identity.md) is now a **prerequisite** of this phase rather than a neighbour — see blocker 0.

## ✏ Refined 2026-08-20 — blockers found at pre-flight, all four ruled on 2026-08-21

> **✏ Refined 2026-08-21 — A, B, C and D are answered; this section is kept as the record of why the phase did not start on 2026-08-20.** fvermaut was grilled through all four blockers on 2026-08-21 and ruled on every one, plus three consequences that fell out of them. The rulings are recorded as [ADR-0044 — *A run belongs to a step ticket, and the assignee is what holds it*](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md). Each blocker below now carries a `✏ Resolved 2026-08-21:` line giving its ruling; **nothing is deleted** — the analysis under each one is why the question was asked, and it is what execution reads to understand the answer it got. Each ruling is also folded into the slices it changes, in place, under its own `✏ Refined 2026-08-21` marker.
>
> **Two things are still open, and one of them stops the phase.** **Blocker 0** below — Timone's own forge account — is fvermaut's own reordering of 2026-08-21 and is the single thing standing between this plan and execution. **Blocker G** is a new gap found while folding the rulings in, and it is deliberately *not* answered here.

A pre-flight read of the code against this plan, on 2026-08-20 and before any slice started, found four questions this plan cannot answer for itself, and a number of statements it made that the code contradicts. The contradictions are amended in place below, each carrying its own `✏ Refined 2026-08-20:` marker; the original wording is kept and marked superseded so execution can see what moved. **The four blockers below are stated as questions and are deliberately left unanswered here** — each one changes either behaviour the requirements protect or a command the human types, and neither is a planner's call. Each is cross-referenced from the slice it holds up.

**✏ Refined 2026-08-21 — Blocker 0 — Timone has no account of its own, and this phase now waits on one. NOT RESOLVED, and it is first.** The blocker did not exist on 2026-08-20 and is not a finding about the code: it is fvermaut's own reordering of the sequence, made on 2026-08-21 as a consequence of his ruling that **the assignee is what holds a step ineligible** (see blocker B's resolution, and [ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md)). The machine assigns itself when it claims a step and **stays assigned after a cancel**, which is how a dropped step stays stopped. That makes "assigned" carry three distinct meanings that must be told apart: *the machine is working on this*, *the machine dropped this and is holding it*, and *a human took it over*. **On a borrowed account they collapse into one**, because every assignment on the repository is fvermaut's — the signal the whole eligibility rule rests on cannot be read at all. So the account is made **before phase 29 is built**, not after it.

This is the same human prerequisite phase 30's slice **30a** is blocked on ([ADR-0042](../../adr/0042-timone-acts-under-its-own-identity.md), and phase 30's own blocker (a)): a forge account for Timone, invited to every repository in `timone.yaml`, and whatever mints a per-repository short-lived credential from it. It does not exist — nothing in `timone.yaml`, nothing in `src/manifest.ts`, nothing anywhere in `src/`. **There is no code substitute**; no fake, fixture or seam makes an assignment belong to an identity that has not been created. Roughly an hour of fvermaut's time.
> **Open, for fvermaut — the only thing between this plan and execution.** Create the machine account and invite it to the managed repositories. **Blocks the whole phase**, 29a included: 29a is pure and offline, but the rule it encodes is meaningless until the assignee can mean what blocker B's ruling needs it to mean. Phases 29 and 30 now share this one prerequisite, and one hour unblocks both.

**Blocker A — settledness has a live consumer, so 29g as written regresses R22 clause 2.** `isSettled` (`runs.ts:76`) has exactly one real use: `loadedLiveRunForTicket` (`runs.ts:585-596`), which `register` (`runs.ts:639`) calls at `runs.ts:641` to refuse a second run while one is still live. `register`'s own docblock (`runs.ts:620-637`) reads: *"A failed chunk is unsettled, so it is handed back rather than succeeded (ADR-0029): a chunk advances only on success, and `timone retry` is how a broken one recovers."* That is R22 clause 2 verbatim — the clause the Requirements section of this very file says must not regress, and the one 29d's red-green case (3) exists to guard. ADR-0040 D3 orders settledness deleted on the stated ground that *"under one ticket per step there is no count, so there is no question"*. But the question `register` asks is **not the count** — it is whether this ticket already has a live chunk, and ADR-0040's own correction section concedes exactly that: *"`SETTLED` serves `register`, which answers a different question."* **D3's premise is false in the same way its #41 citation was.** The phase cannot delete the predicate without putting a replacement in its place first.
> **Open question, for fvermaut:** is ADR-0040 D3 corrected — the predicate kept under its own name, the *count* alone deleted — or does the behaviour change? **Blocks 29g.** Filed as [timone#51](https://github.com/fvermaut/timone/issues/51), so it survives this plan.
>
> **✏ Resolved 2026-08-21 — settledness survives; only the counting goes.** D3 is corrected, not obeyed: `SETTLED` (`runs.ts:73`) and `isSettled` (`runs.ts:76`) are **kept under their own names**, and only `chunkProgress` / `ChunkProgress` and the counting of runs are deleted. The reason is the behaviour the predicate buys and nothing else: **a cancelled step stops, and a failed one is retryable in place** — which is exactly what the predicate provides to `register` (`runs.ts:639`). R22 clause 2 does not move. This is also fvermaut's ruling on [timone#51](https://github.com/fvermaut/timone/issues/51); ADR-0040 D3 is being corrected separately. See [ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md). **29g narrows sharply and is no longer blocked** — see its own marker.

**Blocker B — run identity is undecided, and four slices inherit it.** `runSchema` (`runs.ts:122-143`) is `{project, ticket, seq}`; `runId` is `project#ticket/seq` (`runs.ts:1209`); `timone retry <project>#<ticket>` addresses it; `runsForTicket` groups by it; `entryContext` (`poll.ts:1382`) routes on `run.seq > 1`. Under one step, one ticket, does a run key on the **step ticket** or on the **initiative**? If the step ticket: `seq` collapses to 1, the map ticket must be kept out of `listMarkedTickets`, and **`timone retry <project>#<ticket>` starts addressing a step number rather than the initiative number the human knows** — a command `STATUS.md` currently tells fvermaut to type. If the initiative: nothing records which step a merged pull request belonged to, and 29e cannot close "its step ticket". ADR-0040 is silent on it.
> **Open question, for fvermaut:** which ticket number is a run's identity? It is his because it changes what he types. **Blocks 29c, 29d, 29e and 29f** — every one of them inherits the answer.
>
> **✏ Resolved 2026-08-21 — a run belongs to the step ticket.** `run.ticket` is the **step's** number, and `timone retry <project>#<step>` and `timone cancel <project>#<step>` address a step rather than the initiative. Two consequences fvermaut ruled on with it: **`timone cancel` drops the work** — the step ticket stays open and is **not** taken up again, reversing ADR-0040's *"a cancelled step is simply the next eligible step again"* — and **the assignee is what holds it ineligible**: the machine assigns itself on claim and stays assigned after a cancel, chosen over a label. A dropped step therefore does not stop the initiative closing; it closes saying *"thirteen of fourteen; step 7 was dropped"*, and built-versus-dropped is **inferred, never asked** — closed with a merged pull request means built, closed without one means dropped. See [ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md). This lands in **29c, 29d, 29e, 29f, 29i** and in the new **29j**; it is also what makes blocker 0 first.

**Blocker C — `timone status` cannot reach a ticketing adapter.** `progressReader` (`status.ts:77`) and `renderStatus` (`status.ts:229`) are synchronous and take no adapter; `registerStatusCommand` (`status.ts:308`) constructs only a `RunStore`. Reading step tickets makes the whole render async and network-bound, and puts a `gh` call on the path of every `timone status` — a command whose value is that it answers instantly. The signature change runs `renderStatus` → `describeProject` (`status.ts:200`) → `describeRun` (`status.ts:165`) / `describeWait` (`status.ts:158`) → `ctaOf` (`status.ts:142`), and through 699 lines of `status.test.ts`. Neither 29d nor 29f mentions any of this. Three candidate answers, **none chosen here**: cache child state in the ledger and render from it; render from fields already on `run`; or accept the `gh` call and make status async.
> **Open question, for fvermaut:** which of the three? **Blocks 29f**, including the shape of its validation block.
>
> **✏ Resolved 2026-08-21 — `timone status` reads a cached picture, and makes no forge call at all.** The first of the three candidates. Because a run now keys on the step ticket (blocker B), **the ledger already holds the step number**, so status names the live step from the ledger alone. The surrounding context — which initiative, how many steps remain — is written to the ledger **by the daemon, each cycle, as a side effect of the eligibility query it already makes**, and status reads that. So the render stays synchronous and adapter-free, the answer stays instant, and the picture is at most one poll interval stale. The third candidate — accept the `gh` call and make the render async — is rejected: the value of `timone status` is that it answers immediately. See [ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md). **29f's validation block is no longer provisional**, and the signature change through `renderStatus` → `describeProject` → `describeRun` / `describeWait` → `ctaOf` does not happen.

**Blocker D — the dependency notation is undefined, and it breaks the parallelism the graph claims.** ADR-0040 says only "dependencies now have to be written down"; R22's rewritten clause 3 says "any step it depends on"; 29b's case (2) says "a child whose dependency **line** is absent" and case (3) "an unreadable dependency reference". The only convention written down anywhere is prose in a skill — `.claude/skills/timone-wayfind/SKILL.md:143`: *"use GitHub's native sub-issue and dependency relationships where `gh`/GraphQL supports them (verify once per repo); where unavailable, fall back loudly to a body line `Blocked by: #N, #M`"*. **Nothing in `src/` parses `Blocked by:`** — grep returns zero hits. `gh issue list --json blockedBy` is supported on this machine (see 29b), so the fallback may not be needed at all. But 29a is pure and offline and 29b talks to `gh`, and the two must agree on one representation before either can be written.
> **Open question, for fvermaut:** is a declared dependency the native GitHub relation, the `Blocked by:` body line, or both with a stated precedence? **Blocks 29b, and blocks the 29a ∥ 29b parallelism** — see the corrected dependency graph at the end of this file.
>
> **✏ Resolved 2026-08-21 — a dependency is GitHub's native `blockedBy`, and nothing else.** One representation, and it is the one `gh issue list --json blockedBy` already serves (verified on this machine 2026-08-20, recorded under 29b). **The `Blocked by:` body line is not a fallback and is not a second format** — but it is not silently ignored either: **it is read and refused.** Where the machine finds such a line in a body it **says so on the ticket** — that it saw the line, and that the native field is what it respects. Silence is the failure mode ADR-0040 names as the one to watch, and a step held back by a line nobody parses is exactly it. See [ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md). **29a and 29b agree on one shape and may run in parallel again**, as the original graph said; the reading-and-refusing is a **new behaviour 29b owes, with its own red-green case**. Note that the skill prose at `.claude/skills/timone-wayfind/SKILL.md:143` still offers the body line as a loud fallback — it now describes something the machine refuses, and 29i carries the correction.

**✏ Refined 2026-08-21 — Blocker G — "retry" is one of the two ways out of a dropped step, and it is the one the ledger refuses. NOT RESOLVED.** Found while folding ruling 2 into the plan, and deliberately not answered here. Ruling 2 has the machine write a call to action on a cancelled step offering **exactly two ways on: retry it, or close it and move on.** But **both roads out of a cancelled run are shut in the code today, and shut on purpose.** `RunStore.retry` throws for a cancelled run before it reaches any generic refusal (`runs.ts:878-886`), and the transition table forbids it outright — `cancelled: []` at `runs.ts:108`, under a comment that reads: *"A failure can be re-armed by `timone retry`, and a run that should never have existed must not be one keystroke from restarting. A ticket that deserves another go gets a **fresh chunk** from `register`, because cancellation settles this one."* That escape hatch is closed too: ruling 2 says the step is **not** taken up again, and ruling 3 keeps it assigned so the frontier query skips it. **A CTA that prints `timone retry <project>#<step>` would name a command that answers with a refusal.**

The wording is already false in four places and that much is *not* a question — it is a correction the new **29j** carries: `cta.ts:273` (the standing CTA), `runs.ts:886` (the refusal itself), `cancel.ts:218` (what `timone cancel` prints in the terminal) and `takeover.ts:191` all promise *"I'll start it afresh on my next pass"*, which ruling 2 reverses.
> **Open question, for fvermaut:** does `timone retry` gain the power to re-arm a cancelled step — a new `cancelled: ["picked-up"]` edge, reversing his own ruling of 2026-08-15 — or does "retry" on a dropped step mean **unassigning it** so the frontier query takes it as a fresh run, leaving the ledger's rule untouched? It is his because it is a command he types and a guard he put there. **Blocks 29j alone.** Nothing else in the phase depends on it.

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

**✏ Refined 2026-08-21 — the two undefined words in this slice are now defined, and one of its seven cases changes weight.**
- **"declared dependencies" is GitHub's native `blockedBy`** (blocker D's ruling), and nothing else. `Step` carries the numbers that field gives, so cases (3) and (4) are about `blockedBy` entries being open or closed, and no body text is parsed anywhere in this file. A `Blocked by:` line is 29b's business — it is read and refused there, and never reaches `nextStep`.
- **"unassigned" now includes *assigned to the machine itself*** (blocker B's ruling 3). Eligibility is **open + unblocked + unassigned**, and after a `timone cancel` the machine stays assigned to the step it dropped. `nextStep` needs no special case and must not grow one: it asks whether an assignee exists, not who it is.
- **Case (5) — "an assigned open step is skipped" — is load-bearing, not incidental.** It was written as an obvious guard against stepping on a human's work. It is now **the whole mechanism by which a cancelled step stays stopped**: nothing else holds a dropped step out of the frontier. Assert it as the mechanism it is, with a step assigned to the machine as well as one assigned to a human, and say in the test's own words what it protects. The other six cases stand unchanged.

> No dependency on other sub-phases. **✏ Refined 2026-08-20:** still true for *code*, but the shape of `Step`'s "declared dependencies" field is **blocker D** — 29a and 29b must agree on one representation, so 29a is gated on that ruling even though it touches no shared file.
> **✏ Refined 2026-08-21:** blocker D is answered, so that gate is lifted and **29a and 29b are parallel again**. What remains is **blocker 0** — the machine account — which gates this slice not through a file but through its meaning: the rule this pure function encodes cannot be read off a repository where every assignment belongs to fvermaut.

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

**✏ Refined 2026-08-21 — blocker D is answered, and it gives this slice a fourth case it did not have.** Dependencies are read **natively**: `gh issue list --json blockedBy`, verified working on this machine on 2026-08-20 and listed among the capabilities above. There is no second format and no fallback parser — **nothing in this slice parses a `Blocked by:` body line into a dependency.**

**But the body line is refused out loud, not ignored, and that is new behaviour this slice owes.** Where a child's body carries a `Blocked by: #N` line, the adapter reports it, and the machine **says on the ticket** that it saw the line and that the native field is what it respects. The reason is the same one case (3) exists for: a step that should have been held back and was not is the failure mode ADR-0040 names as the one to watch, and a human who wrote the line in good faith — following `.claude/skills/timone-wayfind/SKILL.md:143`, which still offers it — would otherwise watch the machine walk straight past a dependency they thought they had declared. **Add a fourth red-green case: (4) a child whose body carries a `Blocked by:` line is reported as carrying one, and is *not* treated as blocked by it** — the report is the deliverable, and the eligibility answer still comes from `blockedBy` alone.

> ~~No dependency on 29a — different files — so 29a and 29b may run in parallel.~~
> **✏ Refined 2026-08-20:** superseded. The file independence is real, but 29a and 29b must encode **the same** representation of a declared dependency, and no such representation is defined anywhere in `src/` — **blocker D**. **29a and 29b may not run in parallel until that is ruled on**, and 29b cannot start at all until then, because the ruling decides whether it reads `blockedBy` from `gh` or parses a `Blocked by:` body line.
> **✏ Refined 2026-08-21:** the 2026-08-20 wording above is itself superseded by the ruling it asked for. It reads `blockedBy` from `gh`. **29a and 29b are parallel again**, exactly as the original line said, and the only thing holding either of them is **blocker 0**.

#### Agent Validation Steps

```bash
npm run build && npx vitest run src/adapters/github-tickets.test.ts
```

> **✏ Refined 2026-08-20:** the command was `npm run build && npm test -- ticketing` and is superseded because **it is vacuous**. The filter matches no test file — the tests live in `src/adapters/github-tickets.test.ts`, and `src/adapters/ticketing.ts` is not a test file — and `vitest.config.ts:5` sets `passWithNoTests: true`, so the command prints "No test files found" and exits **0**. Verified by running it. The replacement names the file directly.

- [ ] Red→green trace for all three cases — **✏ Refined 2026-08-21:** for **all four**, the fourth being the `Blocked by:` body line read and reported rather than parsed
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

**✏ Refined 2026-08-21 — blocker B is answered, and it lands here as three concrete obligations.**
- **The run identity changes here.** A created step ticket **is** a run's identity: `run.ticket` is the step's number from now on. This slice is where the numbers a run will later carry are minted, so it is where the change becomes real — 29d, 29e and 29f only inherit it.
- **Set the native `blockedBy` relations, not only the parent.** The slice already says each created ticket "carries its dependency"; blocker D's ruling makes that a **native GitHub relation**, not a body line. `gh issue create --parent <n>` links the child to the map ticket in one call, and the dependency between two *children* is a second relation this slice must set once both exist. **Order matters:** a step's dependency cannot be set until the ticket it depends on has a number, so creation runs in breakdown order and the relations are applied after, or as each becomes resolvable. Red-green case (4) — "each created ticket carries its dependency" — is now an assertion about the **native relation on the wire**, in the verbatim argument vector, not about body text.
- **Assignment happens at claim, not at creation.** Say it plainly, because the slice would otherwise be free to guess: **a step ticket is created unassigned.** Every step of a fourteen-step initiative assigned at creation would be ineligible from birth — the frontier query skips assigned steps (29a case 5), and nothing would ever be picked up. The machine assigns **itself** at the moment it claims a step, which is 29d's act, and stays assigned after a `timone cancel`, which is how a dropped step stays stopped. This slice creates; it does not claim.

**Idempotence covers the relations too.** Re-running approval must not add a second `blockedBy` edge any more than it opens a second ticket. Case (2) — "running it again → zero creations" — extends to **zero relation writes**, and is asserted on the call vector.

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

**✏ Refined 2026-08-21 — blocker B answered, and this slice gains a second deliverable it did not have.**
- **`run.ticket` becomes the step's number.** `runId` stays `project#ticket/seq` in shape, but the ticket in it is now a **step**, `seq` collapses to 1, and `entryContext` (`poll.ts:1382`) can no longer route on `run.seq > 1` to mean "a later piece of the same initiative" — that fact now lives in the step's position among its siblings, not in the run. **The map ticket must be kept out of `listMarkedTickets`**, or the daemon will open a run on the initiative itself alongside the runs on its children.
- **The machine assigns itself when it claims the step**, in this slice, and does not unassign on a cancel. That single act is what holds a dropped step out of 29a's frontier; without it every ruling about dropping work is decoration.
- **New deliverable: the daemon writes the cached picture to the ledger each cycle** (blocker C's ruling). Which initiative a live step belongs to and how many steps remain are written **as a side effect of the eligibility query the daemon already makes** — the query is not run twice and no extra `gh` call is added. This is what 29f then reads, which is why 29f needs no adapter and stays synchronous. **It is this slice's job, not 29f's**, and a 29f that finds the ledger empty has nothing to render.
- **Red-green case (3) is unchanged and still required.** Blocker A's ruling keeps `isSettled` (`runs.ts:76`) and the guard in `register` (`runs.ts:639`), so a `failed` run still opens no new step and `timone retry` still re-arms in place. R22 clause 2 does not move, and the case that guards it does not move either.

> Depends on 29a, 29b. **✏ Refined 2026-08-20:** and on **blocker B** — whether a run keys on the step ticket or the initiative decides what `entryContext` (`poll.ts:1382`) routes on, since it routes on `run.seq > 1` today.
> **✏ Refined 2026-08-21:** blocker B is answered — it keys on the step ticket — so that edge is gone and the `entryContext` consequence is recorded above as work rather than as a question.

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

**✏ Refined 2026-08-21 — a dropped step does not stop the initiative closing, and this slice is where that is decided.** Blocker B's ruling gives it the ticket number it was missing, and adds a rule the original three cases do not cover.
- **"No step ticket remains open" is no longer the same as "every step was built."** A step can be closed because it was **dropped** — `timone cancel`, then the human closes it and moves on. The initiative still closes, and its closing comment **states the count actually delivered**: *"thirteen of fourteen; step 7 was dropped."* An initiative that refuses to close because one step was abandoned is a thread that never ends, which is the exact failure ADR-0040 exists to fix.
- **Built versus dropped is inferred, never asked.** The test is one fact and nothing else: **a closed step with a merged pull request was built; a closed step without one was dropped.** No label, no comment convention, no question to the human. The rule is worth stating twice because the tempting alternative — ask, or read a label — puts a gesture between the human and a thread that should simply finish.
- **A cancelled step is a fourth outcome the cases must cover.** The three red-green cases describe merge, last merge, and file order. Add: **(4) the last remaining step is closed with no merged pull request → the initiative closes, and its comment names the count delivered and the step dropped** — asserted on the comment's words, since the count is the whole point of the case. Case (3) is unchanged: an initiative with an open step is still not closed, whatever the file order says.

> Depends on 29a, 29b, 29d. **✏ Refined 2026-08-20:** and on **blocker B**. This slice says "a merged PR closes **its step ticket**" — but if a run keys on the initiative rather than the step, **nothing in the ledger records which step a merged pull request belonged to**, and the slice has no way to name the ticket it is meant to close.
> **✏ Refined 2026-08-21:** blocker B is answered — the run keys on the step — so the ledger names the ticket directly and that edge is gone.

#### Agent Validation Steps

> **✏ Refined 2026-08-20:** this slice had no `Agent Validation Steps` block, which process.md stage 5 requires of every sub-phase. Added:

```bash
npm run build && npx vitest run src/daemon/poll.test.ts
```

- [ ] All three red→green, each seen failing first — **✏ Refined 2026-08-21:** all **four**, the fourth being the dropped step that still lets the initiative close
- [ ] The run reports a **non-zero test count** — read the count, not the colour
- [ ] Case (3) is asserted with a step that is last in file order and still open, not with a comment claiming the case cannot arise
- [ ] **✏ Refined 2026-08-21:** case (4) asserts the **closing comment's words** — the count delivered and the step dropped — not merely that the initiative closed
- [ ] No test in this slice closes a real issue on any repository

---

### Sub-phase 29f: `timone status` shows which step is live

**[MODIFY]** the status renderer — name the live step ticket and how many remain.

**Seams under test (TDD):** the renderer, red-green on the two states: a live step, and an initiative between steps.

**✏ Refined 2026-08-21 — blockers B and C are both answered, and together they make this the small slice it originally looked like.** Status **makes no forge call**: the run's own `ticket` is the live step's number (blocker B), and the surrounding context — which initiative, how many steps remain — is in the ledger already, written there by the daemon each cycle as a side effect of the eligibility query it makes anyway (blocker C, and 29d's new deliverable). So `progressReader` (`status.ts:77`) and `renderStatus` (`status.ts:229`) **stay synchronous and hold no adapter**, the signature change through `describeProject` → `describeRun` / `describeWait` → `ctaOf` **does not happen**, and the 699 lines of `status.test.ts` are not disturbed. What the reader gets is at most one poll interval stale, and that is the trade fvermaut chose: an answer that is instant is the point of the command.

> Depends on 29d. **✏ Refined 2026-08-20:** and is **blocked by blocker C** — the renderer holds no ticketing adapter and is synchronous end to end, so "name the live step ticket" is a signature change through `renderStatus` → `describeProject` (`status.ts:200`) → `describeRun` (`status.ts:165`) / `describeWait` (`status.ts:158`) → `ctaOf` (`status.ts:142`), and through 699 lines of `status.test.ts`. **Also blocked by blocker B**, which decides which ticket number the renderer prints.
> **✏ Refined 2026-08-21:** both are answered, so both edges are gone. It depends on **29d** and on nothing else — and it depends on it hard: 29d is what puts the cached picture in the ledger, and there is nothing here to render until it does.

**This is the one thing #41 was right about, even though its defect was not real.** Nothing has ever *displayed* which step the daemon thinks is next; I misread the model for a day because the only way to see it was to run the function by hand. A wrong pointer would still be invisible after this phase without it.

#### Agent Validation Steps

> **✏ Refined 2026-08-20:** this slice had no `Agent Validation Steps` block, which process.md stage 5 requires of every sub-phase. The block below is **provisional and cannot be finalised until blocker C is answered** — if the ruling makes the render async and network-bound, this slice acquires adapter fakes and a second test file, and the block grows accordingly.
>
> **✏ Refined 2026-08-21: the block is no longer provisional and is finalised as written.** Blocker C's ruling keeps the render synchronous and forge-free, so the adapter fakes and the second test file this note anticipated are not needed. One command over one file is the whole gate.

```bash
npm run build && npx vitest run src/commands/status.test.ts
```

- [ ] Both states red→green: a live step, and an initiative between steps
- [ ] The run reports a **non-zero test count** — read the count, not the colour
- [ ] No test reaches the network, and none opens the repository's own `.timone/state.json`
- [ ] **✏ Refined 2026-08-21:** `progressReader` (`status.ts:77`) and `renderStatus` (`status.ts:229`) are **still synchronous and still take no adapter** after the change. An `async` on either, or a `TicketingAdapter` in either signature, means blocker C's ruling was not followed — read the signatures, not the test result

---

### Sub-phase 29g: ~~Delete settledness~~ — ✏ Refined 2026-08-21: delete the *counting*; settledness stays

~~**[MODIFY]** `src/daemon/runs.ts` — remove `SETTLED`, `isSettled` and its use in `register`.~~ **[MODIFY]** `src/daemon/breakdown.ts` — remove `chunkProgress` and `ChunkProgress`.

**✏ Refined 2026-08-21 — blocker A is answered, and this slice is now roughly half the size the plan gave it. Read this before the 2026-08-20 blast radius below, because most of that list no longer applies.** fvermaut's ruling: **`SETTLED` and `isSettled` are kept, under their own names.** ADR-0040 D3 is corrected rather than obeyed, and the ground is the behaviour, not the symbol: **a cancelled step stops and a failed one is retryable in place**, which is exactly what the predicate at `runs.ts:76` provides to `register` (`runs.ts:639`). Only `chunkProgress` / `ChunkProgress` and **the counting** are deleted. Concretely:
- **`src/daemon/runs.ts` is no longer modified by this slice at all.** `SETTLED` (`:73`), `isSettled` (`:76`) and its use at `:593` inside `loadedLiveRunForTicket` all stay, and so does `register`'s docblock stating R22 clause 2. The `TERMINAL` neighbour was never in scope and still is not.
- **The four `{@link isSettled}` docblock cross-references at `runs.ts:42,52,55,513` no longer dangle and need no repair.** They were a repair job created purely by the deletion; with the symbol kept, there is nothing to fix. Do not touch them.
- **`src/daemon/breakdown.ts`, `src/daemon/cta.ts` and `src/daemon/poll.ts` are the whole of the slice**: `ChunkProgress` and `chunkProgress` go, and the call sites that counted go with them.
- **The grep assertion has to change, and it is the part most likely to be got wrong.** The old one proved a symbol was *absent*. The new one must prove **two opposite things at once**: that the count is gone, **and** that `isSettled` and its use at `runs.ts:593` remain. A grep that still asserts `isSettled` returns nothing would now fail the slice for doing the right thing — see the rewritten checklist below.

**A slice that shrinks is a slice that can drift.** The temptation once `runs.ts` leaves the list is to widen the deletion back out on tidiness grounds. It is not a tidiness question: the predicate is load-bearing, `register` reads it every cycle, and R22 clause 2 is a requirement this phase's own Requirements section forbids regressing.

**✏ Refined 2026-08-20 — this slice is blocked, and the part that is blocked is `isSettled`.** `register` still uses the predicate to refuse a second live run on one ticket, and its docblock states R22 clause 2 word for word. **Deleting `isSettled` as written regresses a clause this phase's own Requirements section says must not regress.** See **blocker A** at the top of this file. The rest of the deletion — the *count* — is unaffected and stands. Do not start this slice on the strength of ADR-0040 D3 alone; D3's premise is false, and the ruling on what replaces the predicate is fvermaut's.

**Deliberately last.** Everything above must be green first; deleting the old path before the new one carries the traffic is how a working system is broken on the way to a better one.

**`TERMINAL` stays.** It answers a different question and a failed run must still free its project.

**✏ Refined 2026-08-20 — the full blast radius, so the deletion can be seen before it is started.** Measured 2026-08-20; work from this list rather than from grep alone.

> **✏ Refined 2026-08-21:** the list below is the blast radius of the *original* deletion and is kept whole so the narrowing can be seen. **Every `runs.ts` entry in it, and every `runs.test.ts` entry, is now out of scope** — blocker A's ruling keeps the predicate. What remains in scope is the `breakdown.ts`, `cta.ts` and `poll.ts` production entries, and the `breakdown.test.ts`, `cta.test.ts` and `status.test.ts` test entries.

*Production:*
- ~~`runs.ts:42,52,55` — docblock references; `:73` `SETTLED`; `:76-78` `isSettled`; `:513` docblock; `:593` **the only real use**, inside `loadedLiveRunForTicket` — the one blocker A holds.~~ **✏ Refined 2026-08-21: none of these are touched.** The predicate stays and the docblocks that reference it stay valid.
- `breakdown.ts:256` `ChunkProgress`, with fields at `:257`, `:259`, `:261`; `:281-290` `chunkProgress`.
- `cta.ts:18` import; `:33` docblock; `:43` `extends ChunkProgress`.
- `poll.ts:44` import; `:1803` call; `:1887` call.

*Tests:*
- `breakdown.test.ts:8,123,125,133,137` — **three tests are deleted along with the function**, not repaired.
- ~~`runs.test.ts:137,147,160,171,190,1231,1300`.~~ **✏ Refined 2026-08-21: out of scope — these test the predicate, which stays. Deleting them would delete the cover on R22 clause 2.**
- `cta.test.ts:212,238,259,302,326`.
- `status.test.ts:9,601,627`.

*`TERMINAL` survivors that must remain:* the declaration at `runs.ts:45` and the use at `runs.ts:1161`. ~~**Note the trap:** `runs.ts:42,52,55,513` are docblocks *inside `TERMINAL`'s own documentation* that cross-reference `{@link isSettled}` — so removing the symbol leaves **four dangling links to repair**, in the documentation of the neighbour this slice is under orders not to disturb.~~
> **✏ Refined 2026-08-21: the trap is gone.** `isSettled` is kept, so the four cross-references at `runs.ts:42,52,55,513` still point at a symbol that exists. **There is nothing to repair, and repairing them would be a change nobody asked for.**

**Seams under test (TDD):** no new behaviour — the seam is the existing suite staying green. Declare no new seams and say so.

> Depends on every preceding sub-phase. **✏ Refined 2026-08-20:** and on **blocker A**.
> **✏ Refined 2026-08-21:** blocker A is answered, so that edge is gone. It still runs last among the code slices, for the reason below. Independent of **29j** — the two touch different regions of `cta.ts` — so they may run in parallel.

#### Agent Validation Steps

```bash
npm run build && npm test
```

- [ ] The full suite is green — **✏ Refined 2026-08-20:** with one named exception. `src/commands/guardrails.test.ts:205` ("resolves the session id against the ledger") is the **known real-git flake** that `vitest.config.ts:5-23` documents at length; two consecutive full runs at pre-flight gave `1 failed | 1123 passed`, then `1124 passed`, with no change in between. **A failure of that single test is not a phase failure.** Re-run the suite; only a second failure, and only a *different* one, counts against the slice.
- [ ] ~~`grep -rn "SETTLED\|isSettled\|chunkProgress" src --include="*.ts"` returns nothing; `echo "exit: $?"` reports **1**~~
- [ ] ~~**✏ Refined 2026-08-20**, replacing the grep above, which **missed half its own target**: the pattern is case-sensitive and does not match `ChunkProgress`, a symbol this slice also deletes — so a partial deletion leaving `ChunkProgress` at `breakdown.ts:256` and `cta.ts:18,33,43` would have reported clean. Use: `grep -rn "SETTLED\|isSettled\|chunkProgress\|ChunkProgress" src --include="*.ts"` returns nothing; `echo "exit: $?"` reports **1**~~
- [ ] **✏ Refined 2026-08-21**, replacing both greps above, because blocker A's ruling **inverts half of what they asserted**. The assertion is now two-sided — the count is gone, *and* the predicate survives — and a single "returns nothing" grep can no longer express it:
  - `grep -rn "chunkProgress\|ChunkProgress" src --include="*.ts"` returns nothing; `echo "exit: $?"` reports **1** — the count is gone
  - `grep -rn "isSettled" src/daemon/runs.ts` **still returns its declaration and its use**, and the use is the one inside `loadedLiveRunForTicket` at `runs.ts:593` — read the lines, not the exit code, because a grep that finds only the declaration means the guard in `register` was quietly removed
  - `grep -rn "SETTLED" src/daemon/runs.ts` still returns the constant at `runs.ts:73`
  - **Both halves are gates.** A run that deletes the count *and* the predicate is a failed slice, not an over-achieving one: it regresses R22 clause 2, which this phase's Requirements section forbids
- [ ] `grep -rn "TERMINAL" src --include="*.ts"` still returns its call sites — the deletion did not take the neighbour with it
- [ ] ~~**✏ Refined 2026-08-20:** no `{@link isSettled}` remains — `grep -rn "isSettled" src --include="*.ts"` covers it, and the four docblock cross-references at `runs.ts:42,52,55,513` are the ones to repair, not to delete~~ **✏ Refined 2026-08-21: superseded and reversed.** `{@link isSettled}` **must remain** at `runs.ts:42,52,55,513`; the links do not dangle, and there is no repair to make

---

### ✏ Refined 2026-08-21 — Sub-phase 29j: a dropped step says how to get out of being dropped

**This sub-phase is new, added 2026-08-21, and takes the next free letter rather than a place in the alphabet** — it sits here, after 29g and before the live gate, because it is code the gate reads on a real ticket. Blocker B's ruling 2 says a `timone cancel` **drops the work**: the step ticket stays open, the machine does not take it up again, and **the machine writes a call to action on that ticket offering exactly two ways on — retry it, or close it and move on.** Nothing in this plan built that. Without it a dropped step is a ticket that sits open for ever with no instructions on it, which is the failure ADR-0040 set out to end.

**[MODIFY]** `src/daemon/cta.ts` — **[MODIFY]** `src/daemon/cta.test.ts` — **[MODIFY]** `src/commands/cancel.ts` — **[MODIFY]** `src/commands/cancel.test.ts` — **[MODIFY]** `src/commands/takeover.ts` — **[MODIFY]** `src/commands/takeover.test.ts`

**The seam is `ctaFor` (`cta.ts:189`) and specifically its `cancelled` branch at `cta.ts:266-277`.** That branch says today, in full: *"I stopped work on this one." / "nothing — while this ticket is open and marked for me I'll start it afresh on my next pass."* **Ruling 2 makes both halves false.** The machine does not start it afresh; the assignee it keeps (ruling 3) is exactly what holds the step out of 29a's frontier. The branch's own code comment — *"cancelling settles the chunk (ADR-0029), so a ticket that is still open and marked simply takes a fresh one on the next cycle"* — is the superseded model written down, and it is what the slice replaces.

**The same false promise is on three other surfaces, and the ticket's surfaces must not disagree.** `cancel.ts:218` is what `timone cancel` prints in the terminal (*"if the ticket is open and marked for me, I'll start it afresh on my next pass"*), `takeover.ts:191` says it again on a takeover, and `runs.ts:886` is the refusal `timone retry` throws for a cancelled run. **The first two are this slice's to correct**; `runs.ts:886` is not, because changing it means changing what retry *does*, which is **blocker G**.

**Idempotence comes free here and must not be rebuilt.** `Cta` (`cta.ts:93`) is a value — `headline`, `needFromYou`, `waitingOnYou`, optional `command` — and `reconcileCtas` (`poll.ts:1234`) already renders it under `CTA_MARKER` (`cta.ts:141`) through `TicketingAdapter.upsertComment` (`ticketing.ts:317`) at `poll.ts:1284`, which **edits the comment it wrote last time instead of adding another**; `saysTheSame(standingCta(thread), …)` at `poll.ts:1283` skips the write entirely when nothing changed. **So this slice writes words, not a posting mechanism.** If a fake ticketing adapter appears in it, the slice has gone somewhere it does not belong.

**One small choice the slice owes, and must assert whichever way it goes:** `Cta.waitingOnYou`. Its docblock (`cta.ts:100-110`) says the flag means *waiting for the human to say something on it*, and is deliberately false for a run that stopped early — *"what it needs is a command rather than an answer"*. A dropped step is both: one way on is a command, the other is a gesture on the ticket. Read the docblock, pick one, and pin it in a test; do not leave it to whatever the branch above happens to return.

**Seams under test (TDD):** `ctaFor` — pure, no I/O, the same seam `cta.test.ts` already drives. Red-green:
1. **a cancelled run on an open step ticket gets the dropped call to action** — asserted on the exact strings, and it begins by watching the existing test at `cta.test.ts:111-132` fail, since it pins the old words verbatim;
2. **the call to action names both ways on** — the retry command in `Cta.command`, and closing the step ticket in `needFromYou` — asserted as two separate expectations, because a call to action that offers one of two ways on is precisely the failure this slice exists to prevent;
3. **a step that was never cancelled gets no such call to action** — one assertion per neighbouring branch: `failed` still gets the failure words and its own retry command (`cta.ts:250-262`), `done` still gets `betweenChunks` or `FINISHED`, and a run under way still gets *"Building …"*. Branch order in `ctaFor` is the only thing keeping them apart, and it is what this case guards;
4. **re-running the cycle does not post a second comment** — the same `TicketState` in gives a byte-identical body out, so `saysTheSame` skips and `upsertComment` edits. Assert the pure equality, `ctaComment(ctaFor(state))` twice, rather than faking an adapter: the upsert behaviour itself is `github-tickets.ts:340`'s and is tested there.

> Depends on **29d** — the call to action can only speak about a *step* once a run keys on one (ruling 1) — and on **blocker G**, which decides whether the retry command it prints is one the ledger will honour. **Independent of 29g**: different regions of `cta.ts`, so the two may run in parallel. **29h depends on this**, because the live gate reads this comment on a real ticket.

#### Agent Validation Steps

```bash
npm run build && npx vitest run src/daemon/cta.test.ts src/commands/cancel.test.ts src/commands/takeover.test.ts
```

> All three files exist today and all three hold tests, so the command is not vacuous — the failure `vitest.config.ts:5`'s `passWithNoTests: true` produced twice already in this plan cannot happen here.

- [ ] All four red→green, each seen failing first — case (1) begins by watching `cta.test.ts:111-132` fail against the old strings, and that failure is the proof the branch was reached
- [ ] The run reports a **non-zero test count** — read the count, not the colour
- [ ] `grep -rn "afresh on my next pass" src --include="*.ts"` no longer returns `cta.ts:273`, `cancel.ts:218` or `takeover.ts:191` — the promise ruling 2 reverses is gone from every surface this slice owns. It **still returns `runs.ts:886`**, the retry refusal, which is blocker G's to rule on and not this slice's to touch. Read the file names, not the exit code
- [ ] No test in this slice constructs a ticketing adapter, fake or real, and none posts a comment on any repository

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

**✏ Refined 2026-08-21 — the rulings of 2026-08-21 add to what this slice owes, and two of the additions are things fvermaut himself types.**
- **`CONTEXT.md` owes two new terms, and they are named rather than implied**: **step ticket** (one step of an initiative, its own ticket, the thing a run now belongs to) and **map ticket** (the initiative's ticket, which after 29c is a list of links to its children and nothing else). The 2026-08-20 marker above already says a companion term is needed; this fixes which two, so the slice does not have to invent names at the end of a long phase.
- **`timone retry` and `timone cancel` now address a step**, not the initiative (ruling 1). `STATUS.md` currently tells fvermaut to type `timone retry <project>#<ticket>` with the initiative's number, and that instruction becomes wrong the day 29d lands. The manual and `STATUS.md` both describe the new form.
- **`timone cancel` drops the work** (ruling 2), and the docs must say so in the same plain words the ticket does: the step stops, its ticket stays open, the machine does not take it up again, and the two ways on are retry or close. The old promise — *"I'll start it afresh on my next pass"* — is gone from the product, so it must go from the documentation too.
- **A dropped step does not stop an initiative closing** (ruling 5): an initiative can finish *"thirteen of fourteen"*, and built-versus-dropped is inferred from whether a merged pull request exists. Nothing in the documentation prepares a reader for a count that is not the whole list.
- **`.claude/skills/timone-wayfind/SKILL.md:143` is now wrong** and is this slice's to correct. It tells an agent to *"fall back loudly to a body line `Blocked by: #N, #M`"* where the native relation is unavailable. Blocker D's ruling makes the native `blockedBy` field the **only** representation, and a body line something the machine reads and **refuses**. Left as it is, the skill instructs agents to write dependencies the daemon will announce it is ignoring.

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

> **✏ Refined 2026-08-21:** the graph below is **superseded** — kept visible, as this file keeps everything it supersedes — because **A, B, C and D are all answered** and none of them is an edge any more. The graph that replaces it follows.

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

**✏ Refined 2026-08-21 — corrected dependency graph, after the rulings.** Four edges to fvermaut are gone. **One unmet edge remains and it gates everything: the machine account.** It is not a code dependency and no slice can route around it — it is an hour of fvermaut's time, and it is the same hour phase 30's slice 30a is waiting for.

```
0   → fvermaut            Timone's own forge account (ADR-0042) — DOES NOT EXIST.
                          Not a code edge and not routable around: without it, "assigned"
                          cannot tell the machine's own hold apart from a human's, and
                          the eligibility rule the whole phase rests on is unreadable.
                          fvermaut's own reordering, 2026-08-21. Shared with phase 30's
                          30a — one hour unblocks both phases.
G   → fvermaut            what `timone retry` does to a dropped step, which the ledger
                          refuses today (`runs.ts:108`, `runs.ts:878-886`) — blocks 29j
                          ALONE, and holds up nothing else

29a → 0                   the frontier query, pure
29b → 0                   reading step tickets
                          ✓ parallel with 29a again — D is answered and they agree:
                          the dependency is GitHub's native `blockedBy`
29c → 29b                 approval opens the tickets and their `blockedBy` relations,
                          idempotently — created UNASSIGNED
29d → 29a, 29b            the daemon takes the next step ticket, assigns ITSELF, and
                          writes the cached picture to the ledger each cycle
                          — `initiativeProgress` AND `successionOf`, not one of them
29e → 29a, 29b, 29d       closing the step, then the initiative — which closes even
                          when a step was dropped, and says the count delivered
29f → 29d                 status names the live step from the LEDGER — no forge call,
                          render stays synchronous
29g → 29a…29f             delete the COUNTING — settledness stays; roughly half the
                          slice it was. Parallel with 29j: different regions of cta.ts
29j → G, 29d              the dropped step's call to action: retry, or close and move on
29h → 29a…29g, 29j        the live gate on scratch-app
29i → 29a…29h, 29j        close — STATUS.md, the R22 marker, CONTEXT.md, and the
                          wayfind skill's superseded `Blocked by:` fallback
```

- [ ] ~~**Human CTA:** rule on blockers **A, B, C and D** above — nothing in this phase starts until D is answered, and only 29a and 29b are unblocked by it alone~~
- [ ] **✏ Refined 2026-08-21 — Human CTA, replacing the one above, which is done.** A, B, C and D were all ruled on on 2026-08-21 and are recorded in [ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md). **Create Timone's forge account and invite it to the managed repositories** — about an hour, and it is the only thing between this plan and execution. It unblocks phase 30's 30a at the same time. Then, when 29j is reached, rule on **blocker G**: does `timone retry` re-arm a dropped step, or does "retry" mean unassigning it so the frontier takes it afresh?
