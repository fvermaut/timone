# Handover — Timone — 2026-08-21

> Prior handover: [2026-08-20-the-look-survives-and-one-step-one-ticket.md](2026-08-20-the-look-survives-and-one-step-one-ticket.md)

## Snapshot

Phase 29 was asked for and **never started** — a pre-flight read of the plan against the code found four questions only fvermaut could answer, two of which would have broken working behaviour if built as written. He was grilled through all four on 2026-08-21 and ruled on them, plus three consequences and one collision with a ruling of his own from 15 August. Phase 30 delivered **three of twelve slices** (30e, 30f, 30g); the rest is blocked on the machine identity, which now **exists** — a GitHub App, created and tested the same day. One of the five rulings turned out to be impossible and fell back to its recorded alternative, at a cost of twenty minutes because the test ran before any code.

Everything lives on `phase-30-work-in-a-box`, thirteen commits, **pushed, unmerged, no pull request**. `STATUS.md` is on `main` as well, identical, so the merge is a no-op for that file.

**Phase 29 now waits on nothing. Phase 30 waits on one five-minute read.**

## Done this session

- **Phase 29 pre-flight, and the refusal to start** — nine blockers and sixteen contradicted statements, all amended in place into [phase-29.md](../plans/phases/phase-29.md) with dated markers.
- **Phase 30 pre-flight** — same treatment in [phase-30.md](../plans/phases/phase-30.md).
- **Three phase-30 slices built and gated**, handoffs in [phase-30-handoffs.md](../plans/phases/reports/phase-30-handoffs.md):
  - **30e** — `SessionRequest` gains an optional workspace; no behaviour change, `session.test.ts` +91/−0.
  - **30f** — the version pin and the dirty-checkout refusal. **Live from this branch.**
  - **30g** — the base image; `Dockerfile`, `.dockerignore`, `docker/image-check.mjs`.
- **The suite is 1138 green across 28 files**, from 1124 at session start.
- **[ADR-0044](../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md)** written — seven decisions. **Read its D3 first: the ADR's own title is wrong** and says so at the top.
- **[ADR-0040](../adr/0040-one-step-is-one-ticket-and-doneness-is-a-fact-about-a-ticket.md) corrected in three places** — D3's premise, D3's cancelled-step sentence, D4's closed-means-done.
- **[ADR-0042](../adr/0042-timone-acts-under-its-own-identity.md) reshaped** — the identity is a GitHub App, installed rather than invited.
- **The App exists and works.** `Timone Agent`, slug `timone-agent`, App ID **4670926**, installation **155426497**, key at `.timone/timone-agent.2026-08-21.private-key.pem` (gitignored, `chmod 600`). Permissions: `contents:write`, `issues:write`, `metadata:read`, `pull_requests:write` — Actions, Workflows, Administration and Members deliberately withheld.
- **Five defects filed**, four still open — [#47](https://github.com/fvermaut/timone/issues/47) no `gh` timeout, [#48](https://github.com/fvermaut/timone/issues/48) no retry, [#49](https://github.com/fvermaut/timone/issues/49) a slow cycle read as an absent daemon, [#50](https://github.com/fvermaut/timone/issues/50) a failed connection read as a missing branch. [#51](https://github.com/fvermaut/timone/issues/51) ruled and closed. A likely cause for the flake added to [#8](https://github.com/fvermaut/timone/issues/8).

## In flight / blocked

- **Phase 29 — planned, amended, not started, and blocked by nothing.** Every blocker is discharged. It gained a new slice **29j** (the call to action on a dropped step) which nothing had built.
- **Phase 30 — 30e, 30f, 30g done; 30a–30d and 30h–30l not started.** The only human gate left is **R23's wording**, still stamped *awaiting his confirmation* in [prd-02-inversion-of-control.criteria.md](../specs/prd/prd-02-inversion-of-control.criteria.md). Nine slices sit behind it. 30a is otherwise unblocked now the App exists.
- **The dirty-checkout refusal is live on the branch.** Once it merges, a daemon started on an uncommitted timone tree spawns nothing and says why **in its log, not on a ticket**. Expect "the daemon does nothing" to be the first symptom.
- **`ivtrends` — still idle, unmarked, no code.** Untouched this session.

## Decisions made this session

All seven are in [ADR-0044](../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md); not re-explained here.

- **D1** a run belongs to the step ticket — `timone retry <project>#<step>`.
- **D2** `timone cancel` drops the work; the step stops and gets a call to action.
- **D3** ~~the assignee holds it~~ — **superseded the same day: a label, `timone:held`.**
- **D4** a dropped step does not stop the initiative closing; built-versus-dropped is inferred from whether a pull request merged.
- **D5** `timone status` reads a cached picture, refreshed each cycle.
- **D6** dependencies are GitHub's native `blockedBy`; a written `Blocked by:` line is read and refused, never ignored.
- **D7** the way back out of a dropped step is releasing the claim — now *removing the label*.
- **Settledness survives**; only the counting goes. ADR-0040 D3's premise was false in the same way its #41 citation was.
- **The identity is a GitHub App**, not a second account — [ADR-0042](../adr/0042-timone-acts-under-its-own-identity.md), as amended.

**The one worth knowing about if you read nothing else:** a GitHub App's bot **cannot be an issue assignee**, by any route. Tested every way on [scratch-app#41](https://github.com/fvermaut/scratch-app/issues/41), which carries the transcript. `assignedActors`, `replaceActorsForAssignable` and `Bot` in the `Assignee` union all exist — that path is reserved for GitHub's own registered coding agents. **The schema being satisfiable is not the same as the operation being permitted**, and this is the case that taught it.

## Exact next action

**`/timone-execute` is for managed projects and Timone is not one**, so phase 29 is hand-run, slice by slice, as Timone's own phases always are.

Start at **29a and 29b** — they are parallel again now that the dependency notation is settled, and both depend on nothing. Then 29c → 29d → (29e, 29f) → (29g ∥ 29j) → 29h → 29i.

Read before starting, in this order: [phase-29.md](../plans/phases/phase-29.md)'s blockers section (all resolved, but it is the record of *why* the plan says what it says), then [ADR-0044](../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) **D3 first**, then the slice.

**Two things the amended plan pins down that a fresh reader should not re-litigate:** the hold is `timone:held` and eligibility is *open, unblocked, not held, not assigned to a person* — either claim read without the other lets a stopped step be retaken. And 29g is now roughly half the slice it was: it deletes the **counting** only, and an assertion proves `isSettled` and its use at `runs.ts:593` **survive**.

Branch: continue on `phase-30-work-in-a-box`, or cut `phase-29-<slug>` from it and say so in the completion report — the phase-30 slices are unreviewed, and phase 29 does not depend on them.

## Open questions

- **R23's wording** — fvermaut confirms. Nine phase-30 slices behind it. Five minutes.
- **Who creates the `timone:held` label** — falls between 29c and 29d; either is fine, one of them must own it, and both assuming the other did it shows up as a claim silently not applied.
- **Blocker (d), CI** — the App has no Workflows permission by design, so "30d creates a workflow" is now either fvermaut committing it by hand or widening the one grant most worth withholding. Recorded in phase 30; unresolved.
- **A shrinking breakdown passes no gate** — a list that *grows* after approval re-gates; one that loses a step, which D4 now makes possible, does not. The closing comment makes it visible after the fact. Worth revisiting before `ivtrends` restarts.
- **Three older rules** carried forward unanswered from the prior handover — see `STATUS.md`.
