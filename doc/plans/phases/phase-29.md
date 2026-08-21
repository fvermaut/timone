# Phase 29: One step, one ticket — the daemon stops counting runs

> **Status:** In progress — **29a, 29b, 29c, 29d and 29e built** on `phase-29-one-step-one-ticket` (2026-08-21). **R23's wording was confirmed by fvermaut on 2026-08-21**, which releases phase 30's nine held slices — it gates nothing here. Handoffs in [phase-29-handoffs.md](reports/phase-29-handoffs.md).

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
> ~~**One thing is still open, and it stops the phase.** **Blocker 0** below — Timone's own forge account — is fvermaut's own reordering of 2026-08-21 and is the single thing standing between this plan and execution.~~ **Blocker G**, a gap found while folding the rulings in, was put to him in the same session and is **resolved** ([ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) D7).
>
> **✏ Superseded 2026-08-21 (later the same day) — nothing is open, and nothing stops the phase.** Blocker 0 is **resolved and moot at once**: the App exists, *and* phase 29 no longer needs it. A GitHub App's bot **cannot be assigned to an issue** — tested every way against `fvermaut/scratch-app` once the App existed — so a **label** holds a stopped step, not the assignee ([ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) D3, superseded block). A label needs no identity, so the reordering that put the account first loses its reason. **Every slice below is startable today.** See blocker 0 for both halves.

A pre-flight read of the code against this plan, on 2026-08-20 and before any slice started, found four questions this plan cannot answer for itself, and a number of statements it made that the code contradicts. The contradictions are amended in place below, each carrying its own `✏ Refined 2026-08-20:` marker; the original wording is kept and marked superseded so execution can see what moved. **The four blockers below are stated as questions and are deliberately left unanswered here** — each one changes either behaviour the requirements protect or a command the human types, and neither is a planner's call. Each is cross-referenced from the slice it holds up.

**✏ Refined 2026-08-21 — Blocker 0 — Timone has no account of its own, and this phase now waits on one. ~~NOT RESOLVED, and it is first.~~ ✏ Superseded 2026-08-21 (later the same day): RESOLVED, and moot — read the block at the end of this blocker before anything else in it.** The blocker did not exist on 2026-08-20 and is not a finding about the code: it is fvermaut's own reordering of the sequence, made on 2026-08-21 as a consequence of his ruling that **the assignee is what holds a step ineligible** (see blocker B's resolution, and [ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md)). The machine assigns itself when it claims a step and **stays assigned after a cancel**, which is how a dropped step stays stopped. That makes "assigned" carry three distinct meanings that must be told apart: *the machine is working on this*, *the machine dropped this and is holding it*, and *a human took it over*. **On a borrowed account they collapse into one**, because every assignment on the repository is fvermaut's — the signal the whole eligibility rule rests on cannot be read at all. So the account is made **before phase 29 is built**, not after it.

This is the same human prerequisite phase 30's slice **30a** is blocked on ([ADR-0042](../../adr/0042-timone-acts-under-its-own-identity.md), and phase 30's own blocker (a)): a forge account for Timone, invited to every repository in `timone.yaml`, and whatever mints a per-repository short-lived credential from it. It does not exist — nothing in `timone.yaml`, nothing in `src/manifest.ts`, nothing anywhere in `src/`. **There is no code substitute**; no fake, fixture or seam makes an assignment belong to an identity that has not been created. Roughly an hour of fvermaut's time.
> ~~**Open, for fvermaut — the only thing between this plan and execution.** Create the machine account and invite it to the managed repositories.~~ **Blocks the whole phase**, 29a included: 29a is pure and offline, but the rule it encodes is meaningless until the assignee can mean what blocker B's ruling needs it to mean. Phases 29 and 30 now share this one prerequisite, and one hour unblocks both.
>
> **✏ Refined 2026-08-21 (later the same day) — replacing the struck sentence: it is a GitHub App, and there is no invitation step.** **Open, for fvermaut — the only thing between this plan and execution: create the GitHub App and install it on the managed repositories**, selecting the repositories `timone.yaml` declares ([ADR-0042](../../adr/0042-timone-acts-under-its-own-identity.md), amended). No second account, no email alias, no collaborator invites. The identity that appears on the tracker is **`timone-agent[bot]`**, and the credential it mints is scoped to one repository and expires in an hour — which is what 30a's `credentials.ts` was going to have to build by hand.
>
> ~~**And one thing to do the moment it is installed, before any slice starts:** assign **`timone-agent[bot]`** to one issue on `scratch-app` and read it back. **That a bot can hold an assignment is unproven** — the schema supports it (`Issue.assignedActors`, an `Assignee` union admitting `Bot`, and the `replaceActorsForAssignable` mutation, all verified 2026-08-21) but nothing has been assigned. **This whole phase rests on it**, through blocker B's ruling 3 and [ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) D3. Ten minutes of checking, against a phase's worth of work built on an assumption.~~
>
> **✏ Superseded 2026-08-21 (later the same day) — the check was run, it failed, and blocker 0 falls in both directions at once. Everything above is kept as the record of a prerequisite that was real for about six hours.**
>
> **Half one — the App exists.** `timone-agent[bot]`, App ID **4670926**, installed on `fvermaut`'s selected repositories with `contents:write, issues:write, metadata:read, pull_requests:write`. The private key is at `.timone/timone-agent.2026-08-21.private-key.pem`. About twenty minutes, not the hour this file budgeted. **Blocker 0 is therefore discharged as a human prerequisite**, and phase 30's blocker (a) with it.
>
> **Half two — and this phase never needed it.** The ten-minute check above was run and **a GitHub App's bot cannot be assigned to an issue at all.** Every route refused, against `fvermaut/scratch-app` ([scratch-app#41](https://github.com/fvermaut/scratch-app/issues/41) carries the transcript and is now closed):
>
> | Attempt | Result |
> | --- | --- |
> | `replaceActorsForAssignable`, installation token | *"Assigning agents is not supported with GitHub App installation tokens. Use a user token instead."* |
> | `replaceActorsForAssignable`, fvermaut's user token | *"Bot does not have access to the repository."* |
> | REST `POST /repos/fvermaut/scratch-app/issues/41/assignees` with `timone-agent[bot]` | **403 Forbidden** |
> | `suggestedActors(capabilities: [CAN_BE_ASSIGNED])` | `fvermaut` alone, from either token |
>
> `assignedActors`, `replaceActorsForAssignable` and `Bot` in the `Assignee` union all exist — which is why the schema read that preceded this looked encouraging — but **that path is reserved for GitHub's own registered coding agents** and is not open to an ordinary App. A satisfiable schema is not a permitted operation, and this is the case that taught it.
>
> **So a label holds a stopped step, and the assignee does not.** That was the alternative [ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md)'s own Context recorded and fvermaut passed over on 2026-08-21; it is now the only option standing, so **no fresh ruling was sought and none is owed**. The frontier becomes **open, unblocked, not held** — *held* meaning carrying the hold label — and the rule reads the **assignees too**: a step assigned to a *person* is claimed by that person and the machine leaves it alone. Humans can be assignees; only bots cannot. The machine holds by label, a human holds by assignment, and both are visible on the ticket. The label is named once, in **29a**.
>
> **And this is why blocker 0 is moot as well as resolved.** fvermaut moved the App ahead of phase 29 *because* the assignee needed a distinct identity to be legible — three meanings of "assigned" collapsing into one name on a borrowed account, as the paragraph above argues at length. **A label needs no identity.** The reordering is moot rather than wrong, the App having been made the same day in twenty minutes, and **phase 29 now waits on nothing.**

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

> **✏ Resolved 2026-08-21 — [ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) D7. "Retry" means letting go of the claim, and `timone retry` is not touched.** fvermaut ruled that the human **unassigns the step ticket**; the frontier then sees it open, unblocked and unassigned, and `register` opens a **new** run for it. The cancelled run stays dead and stays in the ledger as the record that the work was dropped once. Both of his rulings survive whole — 2026-08-15's *"must not be one keystroke from restarting"*, and 2026-08-21's *"cancel drops the work"* — because nothing revives the dead run. It is the same instruction `runs.ts:886` already gives, with *mark it* replaced by *unassign it*, the claim having taken over the job the mark used to do under ruling 3.
>
> **`timone retry` must not gain a `cancelled → picked-up` edge**, and `runs.ts:108`'s empty transition list stands. A slice that finds a call to action naming a command the ledger refuses fixes the **wording**, never the transition table.
>
> **This moves one file into 29j's scope.** `runs.ts:886` was excluded from that slice because changing it was thought to mean changing what retry *does*. It does not: only its sentence is wrong, and the fix is *unassign it* in place of *mark it for me*. 29j now owns that string. **The transition table and `RunStore.retry`'s behaviour remain out of scope** — the slice changes what the refusal says, never that it refuses.
>
> **The cost fvermaut accepted:** this is the only act in the system with no `timone` command behind it. Releasing a claim is a click on the tracker. He is already on that ticket reading why the step stopped, which is where the call to action put him.
>
> **✏ Refined 2026-08-21 (later the same day) — the ruling stands whole; the gesture is removing a label.** Everywhere this resolution says *unassign the step ticket*, read **remove the `timone:held` label** — a bot cannot be an issue assignee, so the hold moved fields ([ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) D7, superseded block; the refusals are tabulated under blocker 0). **Nothing about D7's shape changes:** the dead run stays dead, `runs.ts:108`'s `cancelled: []` stands, `timone retry` gains no edge, and the frontier takes the step afresh once the hold is gone. **The accepted cost gets smaller**, which is rare enough to note: two clicks in any GitHub view, and the open question of whether the interface would even let a human unassign a bot does not arise.

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

> **✅ Built 2026-08-21.** `src/daemon/steps.ts`, nine cases, each seen red. Two things moved, both forced by 29b reading `gh`'s real output before a fixture was written, and both recorded in [phase-29-handoffs.md](reports/phase-29-handoffs.md):
>
> - **`Step` lives in `src/adapters/ticketing.ts`, not in `steps.ts`.** `src/adapters/` imports nothing from `src/daemon/` anywhere in the tree, and the type is the port's data model. `HELD_LABEL` stays in `steps.ts`, named once as this slice says.
> - **A dependency carries its own `open`, not a number to resolve.** `blockedBy` returns bare numbers and admits other repositories, so `timone#8` and `scratch-app#8` are indistinguishable by number — resolving by number matches a foreign dependency against a local step and answers with the wrong state. Each node carries its own `state` in the same response. Case (7)'s cycle then needs no guard at all.
> - **A ninth case the plan did not have: `dependenciesIncomplete`.** `blockedBy` is `{nodes, totalCount}`; when the count exceeds the nodes, the step waits on something nobody can name. Blocked, never free.

**[NEW FILE]** `src/daemon/steps.ts` — `nextStep(steps): Step | undefined`, pure. Given the initiative's step tickets — number, title, state, assignee, declared dependencies — return the first that is **open, unblocked and unassigned**. A step depending on an open step is not eligible.

**Seams under test (TDD):** `nextStep` is the seam — pure, no I/O. Red-green: (1) all open, none blocked → the first in order; (2) the first closed → the second; (3) a step whose dependency is open is skipped even when it sorts first; (4) a step whose dependency is **closed** is eligible; (5) an assigned open step is skipped; (6) every step closed → `undefined`, the close-the-initiative signal; (7) a dependency cycle does not hang — it returns `undefined` and says so, rather than looping.

**✏ Refined 2026-08-20 — this is new code, not a lift.** The Goal Description justifies `nextStep` as "the way wayfinding already chooses its next question", which reads as if there were a function to reuse. **There is not.** `frontierIsEmpty` (`pipeline.ts:57`) is a one-line label check and nothing more; the frontier rule itself is *executed by an agent* following the prose at `.claude/skills/timone-wayfind/SKILL.md:143`. Write `nextStep` from the rule as stated, and do not spend the slice hunting for an implementation to move.

**✏ Refined 2026-08-20 — case (2) has a hidden prerequisite.** "The first closed → the second" is only observable if closed children are visible at all, and today's listings hard-code `--state open` (`github-tickets.ts:263-264`). The pure function is unaffected; 29b is where this bites, and it is recorded there.

**✏ Refined 2026-08-21 — the two undefined words in this slice are now defined, and one of its seven cases changes weight.**
- **"declared dependencies" is GitHub's native `blockedBy`** (blocker D's ruling), and nothing else. `Step` carries the numbers that field gives, so cases (3) and (4) are about `blockedBy` entries being open or closed, and no body text is parsed anywhere in this file. A `Blocked by:` line is 29b's business — it is read and refused there, and never reaches `nextStep`.
- ~~**"unassigned" now includes *assigned to the machine itself*** (blocker B's ruling 3). Eligibility is **open + unblocked + unassigned**, and after a `timone cancel` the machine stays assigned to the step it dropped. `nextStep` needs no special case and must not grow one: it asks whether an assignee exists, not who it is.~~ **✏ Superseded 2026-08-21 (later the same day)** — the machine cannot be an assignee. See the block below.
- **Case (5) — "an assigned open step is skipped" — is load-bearing, not incidental.** It was written as an obvious guard against stepping on a human's work. It is now **the whole mechanism by which a cancelled step stays stopped**: nothing else holds a dropped step out of the frontier. ~~Assert it as the mechanism it is, with a step assigned to the machine as well as one assigned to a human, and say in the test's own words what it protects.~~ **✏ Refined 2026-08-21 (later the same day):** it is still load-bearing and it still carries the whole mechanism — but it **splits into two cases**, because the machine's hold and the human's claim now come from two different fields. See the block below. The other six cases stand unchanged.

~~**✏ Refined 2026-08-21 (later the same day) — "assignee" is a bot, and `Step` must be able to carry one.** fvermaut ruled that Timone's identity is a **GitHub App**, so the claim on a step is held by **`timone-agent[bot]`** and not by a user ([ADR-0042](../../adr/0042-timone-acts-under-its-own-identity.md) and [ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) D3, both amended 2026-08-21). This slice is pure and offline, so nothing in it queries anything — but the **type it is written against changes**, and getting that wrong here is what makes 29b's bug invisible.~~

- ~~**The `Step` type carries the claim, and the claim is an *actor*, not a user.** On the wire it comes from `Issue.assignedActors`, whose `Assignee` union admits `Bot`, `Mannequin`, `Organization` and `User` — **not** from `Issue.assignees`, which is typed `UserConnection` and cannot represent a bot at all. Verified against `fvermaut/scratch-app` on 2026-08-21. So `Step`'s assignee field is modelled as *an actor of any kind, or none*.~~
- ~~**"Unassigned" means "no actor in `assignedActors`".** It does not mean "no user". A step claimed by `timone-agent[bot]` is **assigned**, and `nextStep` skips it — which is the point of case (5) and the whole of how a dropped step stays dropped.~~
- ~~**`nextStep` still asks whether an assignee exists, never who it is**, exactly as the marker above says. The widening is in the type, not in the logic, and a special case for the bot is still forbidden.~~
- ~~**Not proven, and this slice must not read as though it were:** that a bot can actually hold an assignment end to end. Only the schema was inspected; nothing has been assigned, because that needs the App installed. If it cannot, case (5) has no mechanism behind it and D3 needs another one. See blocker 0.~~

**✏ Superseded 2026-08-21 (later the same day) — the last bullet above was the right worry and it came true. A bot cannot be an assignee at all, so `Step` carries a *label* and its *human* assignees.** The whole block above is kept because it is the exact shape of a design that was one query away from being written, and because the field it names is still the one an implementer's instinct will reach for. The test that killed it is under blocker 0: every assignment route refused, and that path is reserved for GitHub's own registered coding agents. A **label** holds a stopped step ([ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) D3, superseded block) — the alternative the ADR's own Context had already recorded, now the only one standing, so **this is a forced consequence and not a fresh ruling**.

- **The hold label is `timone:held`, and this is the one place it is named.** Every other mention in this phase points here. It is a **harness choice, not a ruling** — nobody was asked, because nothing about it changes what fvermaut sees beyond a word on a ticket, and it is trivially renamed by one constant if he dislikes it. Chosen to sit beside the two label families that exist: the bare `timone` mark (`MARK_LABEL`, `src/adapters/ticketing.ts:9`) and the wayfinder's `wayfinder:*` state labels, of which `wayfinder:frontier-empty` is the closest relative — a label that is *a machine-written state*, not a classification. **It does not collide with the mark:** `listMarkedTickets` filters on the exact label name `timone`, so a step carrying both `timone` and `timone:held` is marked and held at once, which is exactly what a dropped step is.
- **`Step` carries two fields where it used to carry one:** the labels it holds, and its **human** assignees. Both come from `gh issue list --json` — see 29b, where the GraphQL path this slice's superseded block forced is withdrawn.
- **Eligibility is: open, unblocked, not carrying `timone:held`, and not assigned to a person.** Four conditions, two of them about a claim, and **either one alone would let a stopped step be retaken** — the machine's hold if the labels are not read, a human's takeover if the assignees are not.
- **`nextStep` still asks whether a claim exists, never who made it.** The rule against a special case survives the change of mechanism: the function does not know the machine's name, does not compare a login to anything, and reads `timone:held` as a constant it is given.
- **Why the assignees are still read, deliberately.** The assignee's nicest property was that a human assigning themselves took a step off the machine's list. A label does not do that on its own, and losing it would mean a human who picks a step up has the machine start it underneath them. **Humans can be assignees; only bots cannot.** So the two halves are kept side by side, and each has its own case below.

**Case (5) splits into (5a) and (5b), and both are asserted.** They are numbered as a split rather than appended because they replace one case rather than adding to it:
- **(5a) an open step carrying `timone:held` is skipped** — the machine's own hold, and the whole of how a cancelled step stays stopped. Say in the test's own words what it protects.
- **(5b) an open step assigned to a person is skipped** — a human's takeover, unchanged in meaning from the original case (5) and now standing on its own field.

A run that asserts one of the two and passes has built half a rule that looks whole.

> No dependency on other sub-phases. **✏ Refined 2026-08-20:** still true for *code*, but the shape of `Step`'s "declared dependencies" field is **blocker D** — 29a and 29b must agree on one representation, so 29a is gated on that ruling even though it touches no shared file.
> **✏ Refined 2026-08-21:** blocker D is answered, so that gate is lifted and **29a and 29b are parallel again**. ~~What remains is **blocker 0** — the machine account — which gates this slice not through a file but through its meaning: the rule this pure function encodes cannot be read off a repository where every assignment belongs to fvermaut.~~
> **✏ Superseded 2026-08-21 (later the same day):** blocker 0 is discharged and moot both — a label carries no identity, so the rule is readable on any repository. **This slice depends on nothing and is startable now.**

#### Agent Validation Steps

```bash
npm run build && npx vitest run src/daemon/steps.test.ts
```

- [ ] ~~Red→green trace for all seven cases, each seen failing first~~ **✏ Refined 2026-08-21:** for all **eight** — case (5) is now (5a) held by `timone:held` and (5b) assigned to a person — each seen failing first
- [ ] **✏ Refined 2026-08-21:** (5a) and (5b) are **both** present and both seen red first. A suite with one of them is a suite that would pass against an implementation reading only one field, which is the exact half-built rule the split exists to catch
- [ ] Case (7) is asserted with a real cycle, not a comment claiming it cannot happen

---

### Sub-phase 29b: Reading an initiative's step tickets

> **✅ Built 2026-08-21.** `listSteps` on the port and the GitHub adapter; ten cases, all seen red. One `gh issue list --json` call and no GraphQL, exactly as the superseded block below predicts. Shapes were read off `fvermaut/scratch-app` #42/#43 (throwaway, closed, transcript on #42) rather than guessed: `parent` is `{id, number, state, title, url}` or `null`, `state` is `OPEN`/`CLOSED`, `assignees` elements carry `login`.
>
> **Two findings changed the design; both are folded into 29a above.** A dependency does not say which repository it is in, and a dependency list can be counted without being handed over. **`gh issue list` has no `--parent` filter** — verified — so the children are filtered here, and ordering is by number ascending, which is the breakdown's order because 29c opens them in it.
>
> **The cost the 2026-08-20 marker predicted was real:** widening the port broke eleven hand-rolled stub adapters across seven test files. `poll.test.ts`'s `noUnmarkedTickets` became `noOtherListings`, now that it stubs two listings.

**[MODIFY]** `src/adapters/ticketing.ts` — list the child tickets of an initiative and their state, assignee and declared dependencies.

**Seams under test (TDD):** the adapter function, against recorded fixtures rather than the network. Red-green: (1) children are returned in the breakdown's order, not the tracker's; (2) a child whose dependency line is absent is unblocked, not malformed; (3) an unreadable dependency reference is reported, never silently treated as unblocked — a step that should have been held back and was not is the failure mode ADR-0040 names as the one to watch.

**✏ Refined 2026-08-20 — this slice widens the ticket data model; it does not just add a call.** `ticketSchema` (`src/adapters/ticketing.ts:169`) is a `z.strictObject` carrying exactly `number, title, body, labels, url, author, createdAt` — **no `state`, no `assignees`, no `parent`** — and `LIST_FIELDS` (`src/adapters/github-tickets.ts:91`) asks GitHub for precisely those seven. A `Step` needs `state` and `assignee`, and neither exists in the process's ticket model today. Because the object is strict, adding a field is a deliberate schema change with every construction site to follow, and that is the real weight of this slice.

> ~~**✏ Refined 2026-08-21: the `state` half can come from `LIST_FIELDS`; the `assignee` half cannot.** Widening `LIST_FIELDS` gets `state`, `closed` and `parent`, all of which `gh issue list --json` serves. It **cannot** get the claim: the only assignee field `--json` offers is `assignees`, which is users-only and blind to a bot. See the block below — the assignee half of this slice is a GraphQL query, not a wider `--json` field list, and a slice that widens `LIST_FIELDS` and stops there has built exactly half of what it needs while looking finished.~~
>
> **✏ Superseded 2026-08-21 (later the same day) — the whole of this slice comes from `LIST_FIELDS` after all, and the reverted note is the good news.** A bot cannot be an assignee at all, so a **label** holds a stopped step and the assignees carry only humans ([ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) D3, superseded block; the test that forced it is under blocker 0). `assignees` being **users-only is now exactly right** rather than a trap — the field is asked to carry precisely what it can carry. So the widening is: `state`, `closed`, `parent`, `blockedBy` and `assignees`, plus `labels`, **which `LIST_FIELDS` already carries** (`src/adapters/github-tickets.ts:91`). One `--json` call, no GraphQL, and `ticketSchema`'s strict-object widening is the whole weight of the slice as the 2026-08-20 marker above says.

**✏ Refined 2026-08-20 — closed children are invisible today.** Both listings hard-code `--state open` at `github-tickets.ts:263-264`. **A closed child cannot be seen at all**, so 29a's red-green case (2) — "the first closed → the second" — has no data behind it until this changes. Widening the state filter for the child listing is part of this slice, not an afterthought.

**✏ Refined 2026-08-20 — what `gh` can actually do, verified on this machine against `fvermaut/scratch-app` on 2026-08-20.** Do not invent a mechanism; parent/child is **native** and needs no body-link convention:
- `gh issue create --parent <n>` creates a child and links it in **one** call;
- `gh issue edit <n> --parent / --add-sub-issue / --remove-parent / --remove-sub-issue` all exist;
- `gh issue list --json` accepts `parent`, ~~`assignees`~~, `state`, `closed`, `closedAt`, `blockedBy`, `blocking` — ~~**✏ Refined 2026-08-21: `assignees` is struck as a source for the claim.** It is still an offered field, and it is still users-only, which under a bot identity makes it the wrong one. Re-verified 2026-08-21 by running `gh issue list --json`: its field list offers `assignees` and **never** `assignedActors`;~~ **✏ Superseded 2026-08-21 (later the same day): `assignees` is un-struck and is the right field.** The re-verification stands — `--json` offers `assignees` and never `assignedActors` — but the conclusion drawn from it is reversed: since a bot cannot be an assignee, the machine's hold moves to a label and `assignees` is asked only for the humans it can actually hold. `labels` is already in `LIST_FIELDS` and needs no widening;
- the REST endpoint `repos/{owner}/{repo}/issues/{n}/sub_issues` is live (returns `[]` on a real issue);
- GraphQL exposes `issue.subIssues` and `issue.parent`.

**✏ Refined 2026-08-20 — "recorded fixtures" means hand-written `gh` JSON constants, not an HTTP layer.** There is no recording harness and none is to be built. The existing pattern is at `src/adapters/github-tickets.test.ts:29-45`: a `fakeRunner(...responses: string[])` returning `{ run, calls }`, which shifts one canned stdout per call and **throws on an unexpected extra call**; canned JSON is built by `ghIssue(overrides)` at `:48-59`, returning gh's real shape *including fields the adapter ignores*; the adapter is constructed per test as `new GitHubTicketingAdapter({ run })`; assertions are on the **verbatim argument vector**. Follow it exactly. The network is never reached.

**✏ Refined 2026-08-21 — blocker D is answered, and it gives this slice a fourth case it did not have.** Dependencies are read **natively**: `gh issue list --json blockedBy`, verified working on this machine on 2026-08-20 and listed among the capabilities above. There is no second format and no fallback parser — **nothing in this slice parses a `Blocked by:` body line into a dependency.**

> **✏ Superseded 2026-08-21 (later the same day) — the block below, its companion paragraph, its "Not proven" note and its fifth red-green case are all withdrawn. There is no GraphQL path in this slice.** A bot cannot be an assignee, so nothing this slice reads lives in `assignedActors` ([ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) D3, superseded block; the refusals are tabulated under blocker 0). What replaces it is written after the withdrawn material, so the reasoning stays visible — and it stays visible for a reason: **the silent-failure argument the block makes is still correct in shape**, it has simply moved fields. A slice that reads the assignees and forgets the labels sees no hold on a step the machine is holding, and rebuilds work that was deliberately stopped, with every call succeeding. That is the same bug, one field along.

~~**✏ Refined 2026-08-21 (later the same day) — the assignee is read through GraphQL, and this is the one place the phase can fail silently.** fvermaut ruled that Timone's identity is a **GitHub App**, so the claim on a step belongs to **`timone-agent[bot]`** ([ADR-0042](../../adr/0042-timone-acts-under-its-own-identity.md), amended). GitHub keeps bot assignees in a different field from user assignees, and the older field cannot see them. Verified against `fvermaut/scratch-app` on 2026-08-21:~~

- ~~**`Issue.assignees` is typed `UserConnection`** — users only. A bot assignee is **invisible** there. It does not error and it does not warn; it returns an empty list.~~
- ~~**`Issue.assignedActors` is typed `AssigneeConnection`**, and its `Assignee` union has possible types `Bot`, `Mannequin`, `Organization`, `User`. That is the field that carries the claim.~~
- ~~**The mutation is `replaceActorsForAssignable`.** `addAssigneesToAssignable` and `removeAssigneesFromAssignable` are the older user-only pair and are not used here.~~
- ~~**`gh issue list --json` cannot ask for `assignedActors`** — verified by running it; the field list offers `assignees` and nothing else assignee-shaped. **So the claim is read with `gh api graphql`, not through the `--json` path the rest of this slice is written around.** The prose above about `gh issue list --json` and the `LIST_FIELDS` widening stays correct for `state`, `closed`, `parent` and `blockedBy`, and is **wrong for the assignee**; those are two queries, not one.~~

~~**Why this is worth a paragraph of its own.** [ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) D3 makes the assignee the mechanism that holds a stopped step out of the frontier. An implementation that reads `assignees` sees **no claim on a step the machine is holding**. The step then looks open, unblocked and unassigned; the daemon takes it up; and it **rebuilds work that was deliberately stopped** — with no error anywhere, because every call succeeded. This slice is where that bug is either built or prevented.~~

~~**Not proven, and this slice must not assume it:** that a bot can hold an assignment end to end. Only the schema was inspected — the field, the union and the mutation exist and are queryable — and **nothing was assigned**, because that needs the App installed. **Assign `timone-agent[bot]` to one issue on `scratch-app` and read it back through `assignedActors` before writing the query**, not after. If it cannot hold a claim, D3 needs a different mechanism and this slice is not the place that discovers it.~~

**✏ Superseded 2026-08-21 (later the same day) — replacing all four struck blocks above: one `--json` call, two fields, and the silent failure has moved rather than gone away.** The last struck block asked for a check before the query was written. **The check was run and it failed**: a bot cannot be assigned to an issue by any route (blocker 0). So the mechanism is a **label**, and this slice reads:

- **`labels`, which `LIST_FIELDS` (`src/adapters/github-tickets.ts:91`) already asks for.** Nothing is widened for it. A step carrying **`timone:held`** — named once in 29a — is held by the machine.
- **`assignees`, which `gh issue list --json` serves and which is users-only.** That is now the right shape rather than the wrong one: only humans can be assignees, and a step assigned to a person is claimed by that person.

**Both are read, and reading one is the silent failure.** It is the same failure the struck paragraph describes, with the field changed: an implementation that reads the assignees and ignores the labels sees **no hold on a step the machine is holding**, so the step looks open, unblocked and free; the daemon takes it up; and it **rebuilds work that was deliberately stopped** — with no error anywhere, because every call succeeded. **This slice is still where that bug is either built or prevented.** The one thing that has got easier is the query: there is no second call, no `gh api graphql`, and no GraphQL fixture shape to invent.

**But the body line is refused out loud, not ignored, and that is new behaviour this slice owes.** Where a child's body carries a `Blocked by: #N` line, the adapter reports it, and the machine **says on the ticket** that it saw the line and that the native field is what it respects. The reason is the same one case (3) exists for: a step that should have been held back and was not is the failure mode ADR-0040 names as the one to watch, and a human who wrote the line in good faith — following `.claude/skills/timone-wayfind/SKILL.md:143`, which still offers it — would otherwise watch the machine walk straight past a dependency they thought they had declared. **Add a fourth red-green case: (4) a child whose body carries a `Blocked by:` line is reported as carrying one, and is *not* treated as blocked by it** — the report is the deliverable, and the eligibility answer still comes from `blockedBy` alone.

~~**✏ Refined 2026-08-21 — a fifth case, appended and not renumbered: (5) a step claimed by `timone-agent[bot]` reads as claimed.** Give the fixture a child whose claim is a **bot** actor, and assert that the `Step` this slice builds comes back **assigned**. This is not a variation on case (5) of 29a — it is the exact input for which a `gh issue list --json assignees` implementation returns an empty list and reports the step as free. **That is the case that silently rebuilds stopped work**, so it is asserted here, in the adapter, on a bot and not on a user. A companion assertion is cheap and worth having: the same fixture read through `assignees` alone shows nothing, which is the bug written down as a test.~~

**✏ Superseded 2026-08-21 (later the same day) — the fifth case keeps its number and its job, and changes its input: (5) a step carrying `timone:held` reads as held.** There is no bot to put in a fixture. Give the fixture a child whose `labels` include **`timone:held`** — beside the plain `timone` mark, which a step ticket also carries — and assert that the `Step` this slice builds comes back **held**. It remains the case that catches the silent rebuild: an implementation that reads the assignees alone returns an empty list for this fixture and reports the step as free. **A sixth case is worth the two lines** and is appended rather than folded in: **(6) a step assigned to a person reads as claimed by that person**, so that the two halves of the eligibility rule have one adapter case each and neither can be dropped without a red test.

> ~~No dependency on 29a — different files — so 29a and 29b may run in parallel.~~
> **✏ Refined 2026-08-20:** superseded. The file independence is real, but 29a and 29b must encode **the same** representation of a declared dependency, and no such representation is defined anywhere in `src/` — **blocker D**. **29a and 29b may not run in parallel until that is ruled on**, and 29b cannot start at all until then, because the ruling decides whether it reads `blockedBy` from `gh` or parses a `Blocked by:` body line.
> **✏ Refined 2026-08-21:** the 2026-08-20 wording above is itself superseded by the ruling it asked for. It reads `blockedBy` from `gh`. **29a and 29b are parallel again**, exactly as the original line said, and ~~the only thing holding either of them is **blocker 0**~~ — **✏ Superseded 2026-08-21 (later the same day): nothing holds either of them.** Blocker 0 is discharged and moot; a label needs no identity. **Both slices are startable now.**

#### Agent Validation Steps

```bash
npm run build && npx vitest run src/adapters/github-tickets.test.ts
```

> **✏ Refined 2026-08-20:** the command was `npm run build && npm test -- ticketing` and is superseded because **it is vacuous**. The filter matches no test file — the tests live in `src/adapters/github-tickets.test.ts`, and `src/adapters/ticketing.ts` is not a test file — and `vitest.config.ts:5` sets `passWithNoTests: true`, so the command prints "No test files found" and exits **0**. Verified by running it. The replacement names the file directly.

- [ ] Red→green trace for all three cases — **✏ Refined 2026-08-21:** for **all four**, the fourth being the `Blocked by:` body line read and reported rather than parsed — ~~**✏ Refined 2026-08-21 (later the same day): for all *five*.** The fifth is the step claimed by `timone-agent[bot]` reading as claimed, and it is the one to watch fail first against an `assignees`-based implementation~~ — **✏ Superseded 2026-08-21 (later the same day): for all *six*.** (5) is the step carrying `timone:held` reading as held, and it is the one to watch fail first against a labels-blind implementation; (6) is the step assigned to a person reading as claimed by that person
- [ ] ~~**✏ Refined 2026-08-21:** the claim is fetched with `gh api graphql` over `assignedActors`, and `grep -n "assignees" src/adapters/github-tickets.ts` shows no field feeding a `Step`'s assignee. Reading the claim from `--json assignees` is green-looking and wrong — see the marker in the slice above~~
- [ ] **✏ Superseded 2026-08-21 (later the same day), reversing the checkbox above:** there is **no `gh api graphql` call in this slice** — `grep -n "graphql" src/adapters/github-tickets.ts` returns nothing new. The hold and the human claim both come off one `gh issue list --json` call, and `--json assignees` is now the **right** source for the human half. What replaces the old check: `grep -n "LIST_FIELDS" -A6 src/adapters/github-tickets.ts` shows `labels` and `assignees` among the fields, and the code that builds a `Step` reads **both**
- [ ] No test in this slice reaches the network
- [ ] **✏ Refined 2026-08-20:** the run reports a **non-zero test count** — a green gate over zero tests is the exact failure this command replaces, so read the count, not the colour

---

### Sub-phase 29c: Approval opens one ticket per step — idempotently

> **✅ Built 2026-08-21.** `openStepTickets` in `src/daemon/session.ts`, wired into `recordApproval` after `mergeChunkZero`. Eight cases; case (2) proved red **by mutation** — deleting the guard turns (2) and (3) red and leaves the other six green. `approvalRecordPrompt` is untouched, as this slice insists.
>
> **One finding, and it is the plan's own assumption: the breakdown artifact has no dependency field.** `Chunk` is `{title, delivers}` and `CHUNK_LINE` (`breakdown.ts:61`) parses `N. **title** — delivers`; there is nowhere for a chunk to declare anything. **So the approved order is the dependency** — step N waits for step N−1, written as the native relation. That is exactly what ADR-0029's *a chunk advances only on success* did, with nothing invented and no artifact format changed, and it is strictly better in one way: the chain is now visible and editable on the tracker, so fvermaut can cut an edge and let two steps run in parallel. **Widening the breakdown format to carry real dependencies is the alternative, is not taken, and is nobody's call inside a slice** — see the handoff record.
>
> **29c takes the hold label's creation**, as this slice's own marker allows and 29d's does too. Said in the code, so neither slice can assume the other did it.
> **Matching for a re-run is the numbered title** — `7. The board` — not the position, which breaks when a human opens a child by hand.

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
- **Assignment happens at claim, not at creation.** Say it plainly, because the slice would otherwise be free to guess: **a step ticket is created unassigned.** Every step of a fourteen-step initiative assigned at creation would be ineligible from birth — the frontier query skips assigned steps (29a case 5), and nothing would ever be picked up. ~~The machine assigns **itself** at the moment it claims a step, which is 29d's act, and stays assigned after a `timone cancel`, which is how a dropped step stays stopped.~~ **✏ Refined 2026-08-21 (later the same day):** the machine cannot assign itself — a bot cannot be an issue assignee (blocker 0). It **applies the `timone:held` label** at the moment it claims a step, which is still 29d's act, and the label stays on after a `timone cancel`, which is how a dropped step stays stopped. This slice creates; it does not claim.

**✏ Refined 2026-08-21 (later the same day) — this slice owes the label's existence, and a created step ticket carries neither half of a claim.** Because the hold is a **label** rather than an assignee ([ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) D3, superseded block), something has to make sure the label exists before anything applies it, and this slice is the first place on the tracker that could.

- **Create `timone:held` on first use** — the label named once in 29a — **the way `timone-wayfind` already creates its own.** The precedent is `.claude/skills/timone-wayfind/SKILL.md:147` (*"creating the `wayfinder:*` labels on first use"*) and `:196`, which says the same thing again for `wayfinder:frontier-empty` because a state label nobody created is a state nobody can be in. **Creating a label that already exists is not an error to be avoided but a case to be handled** — `gh label create` fails on a duplicate, and this slice's whole subject is idempotence, so the create-or-ignore belongs with the rest of it.
- **A created step ticket carries neither the hold label nor an assignee.** It carries the `timone` mark, its parent, its `blockedBy` relations, its line and the link to the breakdown — and nothing that reads as a claim in either field. **Both halves matter and for the same reason:** a step born held is a step the frontier never returns, exactly as a step born assigned would be, and fourteen of them is an initiative that never starts.
- **Idempotence covers the label too.** Re-running approval creates the label zero more times and applies it zero times, and case (2) — *"running it again → zero creations"* — is asserted on the call vector, which now has one more kind of call in it to be absent from.
- **The natural place is not necessarily here.** Applying the label is 29d's act, so an implementer may reasonably put the create-or-ignore there instead, next to its only user. **Either is acceptable and one of them must happen** — what is not acceptable is both slices assuming the other did it, which is a defect that shows up as a claim silently not applied. Whichever slice takes it, say so in its completion note.

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

> **✅ Built 2026-08-21.** The frontier decides pickup: `surveyInitiatives` reads each initiative's steps once per cycle and does all three jobs with that one query — telling a step from an ordinary ticket, choosing the next one, and writing the cached picture. Twenty-one cases across three files.
>
> **The trap this slice's own correction warns about was avoided, and a worse one was found.** `entryContext` routed on `run.seq > 1` to mean *a later piece of an approved list*. **A step's run is always `seq` 1**, so that test answers no for every step there is — all fourteen would have entered at triage and re-interviewed the human about a list they had already approved. Being a step is what carries the fact now, the first one included. The plan named this consequence; it did not say that it breaks the *first* step as well as the later ones.
>
> **`MAP_LABEL` is new**, and is what keeps the daemon off the initiative's own ticket. A label rather than "has children" because the loop already holds every marked ticket's labels — so it costs no call — and because it is visible to a human reading the tracker. **29c applies it last**, after every step exists: a map with no children is a ticket nothing will ever pick up, proved by mutation.
>
> **`HELD_LABEL_DESCRIPTION` was wrong and is corrected.** It said *"Timone stopped this step"*, which is only the cancel case; the label goes on at claim.
>
> **Between this slice and 29e the closing behaviour is wrong, deliberately.** `concludeInitiative` still closes `run.ticket`, which is now a step. 29e owns it.

**[MODIFY]** `src/daemon/poll.ts` — ~~`initiativeProgress` and the second call site~~ read step tickets through 29a/29b instead of counting runs. **[MODIFY]** `src/daemon/cta.ts` — `InitiativeProgress` stops extending `ChunkProgress`.

**✏ Refined 2026-08-20 — "the second call site" names the wrong thing, and the mistake is the dangerous kind.** The marker is superseded by: **`initiativeProgress` (`poll.ts:1786`) *and* `successionOf` (`poll.ts:1856`)**, which are two different functions, both counting `done`.
- `initiativeProgress` has exactly two call sites — `poll.ts:1275` in `reconcileCtas` (`poll.ts:1234`) and `src/commands/status.ts:93` in `progressReader` (`status.ts:77`). It feeds **text**.
- `successionOf` counts `done` independently at `poll.ts:1884-1886` and calls `chunkProgress` at `poll.ts:1887`. It is what **actually decides what opens next and whether the ticket closes**. Its callers are `concludeInitiative` (`poll.ts:1708`) and `successorHeldBack` (`poll.ts:1928`).

**Say it plainly, because this is the trap the correction exists to prevent: a slice that rewrites only `initiativeProgress` changes the call-to-action text and leaves the daemon still counting runs everywhere it decides what to build next.** It would look done, read done, and be wrong in the one place the phase exists to fix.

**And it is not a like-for-like edit.** `successionOf` is **synchronous** today. A query over child tickets makes it async, and that propagates to **both** its callers — `concludeInitiative` and `successorHeldBack`. Budget the slice for that, not for a one-function rewrite.

**Seams under test (TDD):** `initiativeProgress`, against ledger copies. Red-green: (1) an initiative with steps 1–2 closed reports step 3 next; (2) a cancelled run against an open step leaves that step next — the case ADR-0029's count handled by excluding `cancelled`, now handled by the ticket simply still being open; (3) a `failed` run still opens no new step and `timone retry` re-arms in place, R22 clause 2 unchanged; (4) an initiative with every step closed reports none.

**✏ Refined 2026-08-21 — blocker B answered, and this slice gains a second deliverable it did not have.**
- **`run.ticket` becomes the step's number.** `runId` stays `project#ticket/seq` in shape, but the ticket in it is now a **step**, `seq` collapses to 1, and `entryContext` (`poll.ts:1382`) can no longer route on `run.seq > 1` to mean "a later piece of the same initiative" — that fact now lives in the step's position among its siblings, not in the run. **The map ticket must be kept out of `listMarkedTickets`**, or the daemon will open a run on the initiative itself alongside the runs on its children.
- ~~**The machine assigns itself when it claims the step**, in this slice, and does not unassign on a cancel.~~ **✏ Superseded 2026-08-21 (later the same day): the machine applies the `timone:held` label when it claims the step**, in this slice, and does not remove it on a cancel. A bot cannot be an issue assignee (blocker 0), so the hold is a label — named once in 29a, and created on first use by 29c or by this slice, whichever takes it. That single act is what holds a dropped step out of 29a's frontier; without it every ruling about dropping work is decoration. **The machine never writes an assignee at all**: the assignee field belongs to the human half of the rule and the machine only reads it.
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

> **✅ Built 2026-08-21.** `concludeStep` splits the merge path: the step's ticket closes with words about the step, and the initiative closes only when none of its steps is open. Five cases; mutating the split away turns three red and leaves the control green. **29d's deliberate gap is closed and the branch is coherent again.**
>
> **Case (1) as the plan words it does not discriminate, and had to be strengthened.** *"A merge closes the step ticket and not the initiative"* passed against the **old** code too — the old code closed `run.ticket`, which under 29d *is* the step. The close was identical; what differed was what got **said**: the old path posted the initiative's words, *"this ticket's journey ends here"*, on one piece of it. The case now asserts the comment, and that half is what does the work.
>
> **The tracker is asked again at close time, and it has to be.** The cached picture was taken by the same cycle's survey, before this step closed, so it cannot answer *is anything still open?*. Reusing it would close an initiative one step early. One call, on the merge path, never in front of a waiting human.

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

**The seam is `ctaFor` (`cta.ts:189`) and specifically its `cancelled` branch at `cta.ts:266-277`.** That branch says today, in full: *"I stopped work on this one." / "nothing — while this ticket is open and marked for me I'll start it afresh on my next pass."* **Ruling 2 makes both halves false.** The machine does not start it afresh; ~~the assignee it keeps (ruling 3)~~ **✏ Refined 2026-08-21 (later the same day): the `timone:held` label it leaves on** is exactly what holds the step out of 29a's frontier — a bot cannot be an assignee, so the hold is a label ([ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) D3, superseded block; the refusals are under blocker 0). **This changes every sentence this slice writes**, because the gesture the human is told to make is now removing a label rather than clearing an assignment. The branch's own code comment — *"cancelling settles the chunk (ADR-0029), so a ticket that is still open and marked simply takes a fresh one on the next cycle"* — is the superseded model written down, and it is what the slice replaces.

**The same false promise is on three other surfaces, and the ticket's surfaces must not disagree.** `cancel.ts:218` is what `timone cancel` prints in the terminal (*"if the ticket is open and marked for me, I'll start it afresh on my next pass"*), `takeover.ts:191` says it again on a takeover, and `runs.ts:886` is the refusal `timone retry` throws for a cancelled run.

> **✏ Refined 2026-08-21 — all four surfaces are this slice's, blocker G having been resolved** ([ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) D7). `runs.ts:886` was excluded on the belief that correcting it meant changing what retry *does*. It does not. Its sentence — *"reopen the ticket and mark it for me, and I'll start it afresh on my next pass"* — is right in shape and wrong in one clause: ~~under ruling 3 the claim does the job the mark used to do, so it becomes **unassign it**~~ — **✏ Superseded 2026-08-21 (later the same day): it becomes *remove the `timone:held` label*.** The claim still does the job the mark used to do; it is simply a different field, a bot being unassignable. **The slice changes what the refusal says and never that it refuses.** `runs.ts:108`'s `cancelled: []` is out of scope and stays exactly as it is; a slice that edits the transition table has misread this amendment.

> **✏ Refined 2026-08-21 (later the same day) — the substitution, stated once for all four sites this slice owns.** Everywhere the plan said *unassign the ticket*, the words the human reads are now **remove the `timone:held` label**. It applies at `cta.ts:273` (the standing call to action), `cancel.ts:218` (what `timone cancel` prints in the terminal), `takeover.ts:191` (the takeover) and `runs.ts:886` (the refusal `timone retry` throws). **Four sites, one sentence, and they must not disagree** — that is the whole reason all four are in one slice.
>
> **It also got easier for the reader, which is worth saying because it was a recorded cost.** [ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) D7 accepted that releasing a claim is a gesture on the tracker rather than a `timone` command, and left one worry open: whether GitHub's issue page would even offer a human the control to unassign a *bot*. **That question no longer arises.** Removing a label is two clicks in every GitHub view, on desktop and on the phone. The `timone` verb D7 called *"the obvious first thing to add if it grates"* stays optional, and nothing here needs verifying against the interface first.
>
> **Write the label name into the sentence.** *"Remove the `timone:held` label and I'll start it afresh"* names the thing the human is looking at; *"release the hold"* does not, and a call to action the reader cannot act on without a second lookup is the defect this slice exists to fix.

**Idempotence comes free here and must not be rebuilt.** `Cta` (`cta.ts:93`) is a value — `headline`, `needFromYou`, `waitingOnYou`, optional `command` — and `reconcileCtas` (`poll.ts:1234`) already renders it under `CTA_MARKER` (`cta.ts:141`) through `TicketingAdapter.upsertComment` (`ticketing.ts:317`) at `poll.ts:1284`, which **edits the comment it wrote last time instead of adding another**; `saysTheSame(standingCta(thread), …)` at `poll.ts:1283` skips the write entirely when nothing changed. **So this slice writes words, not a posting mechanism.** If a fake ticketing adapter appears in it, the slice has gone somewhere it does not belong.

**One small choice the slice owes, and must assert whichever way it goes:** `Cta.waitingOnYou`. Its docblock (`cta.ts:100-110`) says the flag means *waiting for the human to say something on it*, and is deliberately false for a run that stopped early — *"what it needs is a command rather than an answer"*. A dropped step is both: one way on is a command, the other is a gesture on the ticket. Read the docblock, pick one, and pin it in a test; do not leave it to whatever the branch above happens to return.

**Seams under test (TDD):** `ctaFor` — pure, no I/O, the same seam `cta.test.ts` already drives. Red-green:
1. **a cancelled run on an open step ticket gets the dropped call to action** — asserted on the exact strings, and it begins by watching the existing test at `cta.test.ts:111-132` fail, since it pins the old words verbatim;
2. **the call to action names both ways on** — asserted as two separate expectations, because a call to action that offers one of two ways on is precisely the failure this slice exists to prevent. **✏ Refined 2026-08-21:** neither way is a `timone` command, so `Cta.command` is **empty on this branch** and the test asserts that it is. Per [ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) D7 the two ways on are ~~*unassign the step ticket and I will start it afresh*~~ — **✏ Superseded 2026-08-21 (later the same day): *remove the `timone:held` label and I will start it afresh*** — and *close it and I will move on*, both gestures on the tracker. A slice that reaches for `timone retry <project>#<step>` here is naming a command the ledger refuses — that is the whole of blocker G, and D7 is why it is not the answer;
3. **a step that was never cancelled gets no such call to action** — one assertion per neighbouring branch: `failed` still gets the failure words and its own retry command (`cta.ts:250-262`), `done` still gets `betweenChunks` or `FINISHED`, and a run under way still gets *"Building …"*. Branch order in `ctaFor` is the only thing keeping them apart, and it is what this case guards;
4. **re-running the cycle does not post a second comment** — the same `TicketState` in gives a byte-identical body out, so `saysTheSame` skips and `upsertComment` edits. Assert the pure equality, `ctaComment(ctaFor(state))` twice, rather than faking an adapter: the upsert behaviour itself is `github-tickets.ts:340`'s and is tested there.

> Depends on **29d** — the call to action can only speak about a *step* once a run keys on one (ruling 1). ✏ **Refined 2026-08-21:** its dependency on **blocker G** is discharged, G being resolved by [ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) D7. **Independent of 29g**: different regions of `cta.ts`, so the two may run in parallel. **29h depends on this**, because the live gate reads this comment on a real ticket.

#### Agent Validation Steps

```bash
npm run build && npx vitest run src/daemon/cta.test.ts src/commands/cancel.test.ts src/commands/takeover.test.ts
```

> All three files exist today and all three hold tests, so the command is not vacuous — the failure `vitest.config.ts:5`'s `passWithNoTests: true` produced twice already in this plan cannot happen here.

- [ ] All four red→green, each seen failing first — case (1) begins by watching `cta.test.ts:111-132` fail against the old strings, and that failure is the proof the branch was reached
- [ ] The run reports a **non-zero test count** — read the count, not the colour
- [ ] ✏ **Refined 2026-08-21:** `grep -rn "mark it for me\|marked for me" src --include="*.ts"` returns nothing from `cta.ts:273`, `cancel.ts:218`, `takeover.ts:191` or `runs.ts:886` — under ruling 3 the claim does the job the mark used to do, and ~~all four now say *unassign*~~ **✏ Refined 2026-08-21 (later the same day): all four now say *remove the `timone:held` label***. Read the file names, not the exit code. The superseded form of this check looked for `"afresh on my next pass"` and excluded `runs.ts:886`; D7 brought that string into scope and the phrase itself survives at three of the four sites, so the old grep would pass while three surfaces still lied
- [ ] ✏ **Refined 2026-08-21 (later the same day) — the positive half of the check, which the line above cannot express.** `grep -rn "timone:held" src --include="*.ts"` returns **all four** of `cta.ts`, `cancel.ts`, `takeover.ts` and `runs.ts` — the absence grep proves only that the old words went, and a surface rewritten to say *"release the hold"* or *"unassign it"* would satisfy it while telling the human to do something they cannot do. Read the four file names
- [ ] ✏ **Refined 2026-08-21 (later the same day):** `grep -rn "unassign" src --include="*.ts"` returns nothing on these four files. The word was right for about six hours and is now an instruction with no gesture behind it, a bot never having been assignable
- [ ] `grep -n "cancelled: \[\]" src/daemon/runs.ts` **still returns line 108** — the transition table is out of scope and a slice that changed it has misread D7
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

> **✏ Superseded 2026-08-21 (later the same day):** the graph below is kept visible, as this file keeps everything it supersedes, because **edge 0 is discharged and moot at once** — the App exists, and a label needs no identity, so phase 29 never needed it. The final graph follows it, and it has **no edge to fvermaut at all**.

```
0   → fvermaut            Timone's own forge account (ADR-0042) — DOES NOT EXIST.
                          Not a code edge and not routable around: without it, "assigned"
                          cannot tell the machine's own hold apart from a human's, and
                          the eligibility rule the whole phase rests on is unreadable.
                          fvermaut's own reordering, 2026-08-21. Shared with phase 30's
                          30a — one hour unblocks both phases.
G   ✓ ANSWERED 2026-08-21  "retry" means unassigning the step so the frontier takes it
                          afresh; the dead run is never revived and `runs.ts:108` stands
                          (ADR-0044 D7). No longer an edge — 29j is free

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
29j → 29d                 the dropped step's call to action: unassign to restart, or
                          close and move on — G is answered (ADR-0044 D7), and
                          neither way out is a `timone` command
29h → 29a…29g, 29j        the live gate on scratch-app
29i → 29a…29h, 29j        close — STATUS.md, the R22 marker, CONTEXT.md, and the
                          wayfind skill's superseded `Blocked by:` fallback
```

**✏ Superseded 2026-08-21 (later the same day) — the final dependency graph. There is no edge to fvermaut on it.** Edge 0 fell twice over: the App was created and installed (App ID 4670926), *and* the test it existed to enable failed — a GitHub App's bot cannot be assigned to an issue, so a **label** holds a stopped step and no identity is needed to read the rule. **Every slice below is startable today**, and the two at the top depend on nothing at all.

```
0   ✓ DISCHARGED AND MOOT  The App exists — `timone-agent[bot]`, App ID 4670926,
    2026-08-21             installed on the selected repositories. AND phase 29 no
                           longer needs it: the hold is the `timone:held` LABEL, not
                           the assignee, because a bot cannot be assigned to an issue
                           (every route refused — see blocker 0; ADR-0044 D3 as
                           superseded). fvermaut's reordering of 2026-08-21 loses its
                           stated reason and is moot rather than wrong. Phase 30's
                           blocker (a) is discharged by the same act — see phase 30
G   ✓ ANSWERED 2026-08-21   "retry" means letting go of the hold so the frontier takes
                           the step afresh; the dead run is never revived and
                           `runs.ts:108` stands (ADR-0044 D7). The gesture is REMOVING
                           THE `timone:held` LABEL — two clicks, and the open question
                           of whether a human could unassign a bot does not arise

29a → (none)              the frontier query, pure. Names `timone:held` once, for the
                          whole phase. Eligibility: open, unblocked, NOT HELD by the
                          label, and NOT ASSIGNED to a person — four conditions, and
                          either claim alone would let a stopped step be retaken
29b → (none)              reading step tickets — ✓ parallel with 29a. ONE `gh issue
                          list --json` call: labels (already in LIST_FIELDS) and
                          assignees (users-only, which is now exactly right), plus
                          state, closed, parent, blockedBy. NO GraphQL path
29c → 29b                 approval opens the tickets and their `blockedBy` relations,
                          idempotently — created with NEITHER the hold label NOR an
                          assignee; creates `timone:held` on first use (or 29d does)
29d → 29a, 29b            the daemon takes the next step ticket, APPLIES `timone:held`,
                          and writes the cached picture to the ledger each cycle
                          — `initiativeProgress` AND `successionOf`, not one of them
29e → 29a, 29b, 29d       closing the step, then the initiative — which closes even
                          when a step was dropped, and says the count delivered
29f → 29d                 status names the live step from the LEDGER — no forge call,
                          render stays synchronous
29g → 29a…29f             delete the COUNTING — settledness stays; roughly half the
                          slice it was. Parallel with 29j: different regions of cta.ts
29j → 29d                 the dropped step's call to action: REMOVE THE LABEL to
                          restart, or close and move on — neither way out is a
                          `timone` command, and all four surfaces say the same words
29h → 29a…29g, 29j        the live gate on scratch-app
29i → 29a…29h, 29j        close — STATUS.md, the R22 marker, CONTEXT.md, and the
                          wayfind skill's superseded `Blocked by:` fallback
```

> **✏ Refined 2026-08-21 (later the same day) — edge 0 is unchanged in force and changed in kind.** It is a **GitHub App, installed**, not a forge account invited ([ADR-0042](../../adr/0042-timone-acts-under-its-own-identity.md), amended); still not a code edge, still not routable around, and still the same hour that unblocks phase 30's 30a. **A second, smaller edge hides inside it and is worth naming: that a bot can be an issue assignee at all is unproven.** The schema says yes — `Issue.assignedActors`, an `Assignee` union admitting `Bot`, and `replaceActorsForAssignable`, verified 2026-08-21 — but nothing has been assigned. Every slice below 0 inherits that, and **29b is where an implementation that gets it wrong would look green**: `gh issue list --json` has no `assignedActors`, so the claim is read through GraphQL or it is not read at all.
>
> **✏ Superseded 2026-08-21 (later the same day) — the smaller edge named above was the whole of it, and it broke the way it was warned it might.** A bot **cannot** be an issue assignee. The schema was satisfiable and the operation was not permitted — that path is reserved for GitHub's own registered coding agents (every refusal is tabulated under blocker 0). So the hold is the **`timone:held` label**, 29b reads one `gh issue list --json` call and no GraphQL, and **edge 0 is gone in both directions at once**: the App exists, and phase 29 does not need it. The graph above this note is superseded by the one below it. **The warning was worth writing even though its conclusion inverted** — it is why the ten-minute check was run before a slice was, rather than after.

- [ ] ~~**Human CTA:** rule on blockers **A, B, C and D** above — nothing in this phase starts until D is answered, and only 29a and 29b are unblocked by it alone~~
- [ ] **✏ Refined 2026-08-21 — Human CTA, replacing the one above, which is done.** A, B, C and D were all ruled on on 2026-08-21 and are recorded in [ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md). ~~**Create Timone's forge account and invite it to the managed repositories**~~ — **✏ Refined 2026-08-21 (later the same day): create Timone's GitHub App and install it on the managed repositories**, selecting the repositories `timone.yaml` declares. Installation replaces invitation; there is no second account and no email alias ([ADR-0042](../../adr/0042-timone-acts-under-its-own-identity.md), amended). **Then assign `timone-agent[bot]` to one issue on `scratch-app` and read it back** — that a bot can hold a claim is unproven, and the whole phase rests on it. About an hour, and it is the only thing between this plan and execution. It unblocks phase 30's 30a at the same time. **Blocker G was put to him in the same session and is answered**: "retry" means unassigning the step so the frontier takes it afresh, and `timone retry` is not touched ([ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) D7). **Nothing else in this plan is waiting on a decision.**
- [x] **✏ Superseded 2026-08-21 (later the same day) — the call to action above is done, and there is no replacement for it. Nothing in this plan is waiting on fvermaut.** Say it loudly, because this file has said the opposite all day: **there is no human gate on phase 29 until the live gate at 29h.**
  - **He did the hour, and it took twenty minutes.** The GitHub App exists and is installed — `timone-agent[bot]`, App ID **4670926**, on the selected repositories, with the private key under `.timone/`. That discharges blocker 0 here and blocker (a) on [phase 30](phase-30.md).
  - **He also ran the ten-minute check, and it came back no.** A GitHub App's bot **cannot be assigned to an issue** by any route (the four refusals are tabulated under blocker 0; the transcript is [scratch-app#41](https://github.com/fvermaut/scratch-app/issues/41)). So the hold is the **`timone:held` label**, per the alternative [ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md)'s own Context had already recorded. **This is a forced consequence, not a new decision, and no fresh ruling was sought** — there is one option left standing.
  - **And it means the hour was never needed for this phase.** A label carries no identity, so the eligibility rule is readable on any repository, borrowed account or not. The reordering that put the App first is **moot rather than wrong**.
  - **What is left is code.** 29a and 29b depend on nothing and can both start now, in parallel. **The next human gate is 29h**, where fvermaut reads three real tickets on `scratch-app` and says whether the thread is followable — which is the point of ADR-0040 and the one thing no test can assert.
  - **Nothing is open, and nothing needs a decision.** The label name is the harness's own choice (29a), rename-by-one-constant if he dislikes it.

**Human CTA: nothing to do — say "execute phase 29" when you want it built.**
