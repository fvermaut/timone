# ADR-0021: Previews are reconciled against a commit, behind an adapter seam

- **Status:** accepted
- **Date:** 2026-08-08
- **Source:** grill session of 2026-08-08, settling the exposure question [PRD-02](../specs/prd/prd-02-inversion-of-control.md) deferred with *"settle when building R8"*; extends [ADR-0005](0005-docker-previews-on-own-host.md)

## Context

[ADR-0005](0005-docker-previews-on-own-host.md) chose Docker on our own host as **the first** preview adapter and left the address open — *"exposure model still an open question in PRD-02"*. PRD-02 named the open question precisely and said when to close it: *"Preview exposure: localhost-only vs reverse proxy with public hostnames — decides whether reviews work from a phone; settle when building R8."* Phase 16 is when R8 is built.

The grill changed the question rather than answering it. Asked where a preview stack actually runs, fvermaut answered **this laptop for now, with fully managed platforms such as Vercel as the destination**. That is consistent with what is already recorded — ADR-0005 says "first adapter", PRD-02 lists PaaS previews under non-goals as "adapter seams only" — but it converts the seam from a hypothetical into a thing a second implementation will actually stand on, which is what makes it worth deciding now rather than discovering later.

**Docker and a managed platform disagree about who owns a preview.** Under Docker, Timone owns the whole life: it builds the images, runs the stack, decides the address, replaces it when the branch moves, and removes it when the PR ends. Under Vercel the platform owns all of that — it observes the push and creates the deployment itself, and Timone's only role is to find out what exists for this PR's head commit. An interface shaped from the Docker side gives the later adapter a `teardown` that does nothing and a `build` that only waits: names that no longer describe what happens, in the one place two implementations must agree.

Much of the mechanism is already built and is not in question. `scratch-app`'s `compose.yaml` was written for this from the start — *"Doubles as the definition the PR-preview adapter runs on our own host: no host-machine assumptions, no fixed per-container names (they break running two instances), every host port interpolated."* The `app` profile brings the full stack up, host ports are interpolated so instances coexist, volumes are compose-project-name prefixed so they do not share a database, the `migrate` job is gated on successful exit, and `app` carries a healthcheck — so *"is this preview ready to be looked at"* is already answerable. `manifest.ts` already carries the binding slot, `preview: z.literal("docker").optional()`.

The alternatives considered for the seam:

- **Imperative — `up` / `refresh` / `down` / `urlFor`.** Shaped from what the first adapter genuinely does, and the most direct to read while there is only one. It is the shape that decays: the second adapter performs none of those verbs, and by the time that is visible the poll loop depends on them.
- **No seam yet.** Build Docker concretely and extract an interface when a second adapter actually arrives, on the sound general principle that a seam fitted to one real case and one imagined case often fits neither. Rejected because the imagined case is now a stated intention with a standards entry already written for it (`standards/vercel-supabase.md`), and because R8 and R12 would land coupled to Docker in the poll loop, making the extraction a later phase's work rather than a design choice.
- **Reconciliation** (chosen).

The deciding fact is that **the requirements are already written as reconciliation and nobody noticed.** R12 says a closed PR's stack is removed *"within one poll cycle"*; R8 says a new commit means the preview *"serves the updated build"*. Neither describes a command being issued — both describe a state the world is expected to reach. The daemon's poll loop is a reconciler already; previews are asking to be one too.

## Decision

**A preview is reconciled against a pull request's current commit by an adapter that owns everything about how.**

- **The seam is two calls.** `ensure(project, pr, headSha)` returns the preview's state and its URL, having made that state true; `release(project, pr)` gives up the preview for good. Docker satisfies `ensure` by running containers and reports the address it published; a managed-platform adapter satisfies it by asking the platform whether a deployment for that sha is ready and reporting the URL the platform minted. **Neither has to perform a verb it does not perform.**
- **The URL belongs to the adapter, not to Timone.** `ensure` returns it. Nothing outside the adapter needs an addressing scheme to agree on, and R8 asks only for *a* per-PR URL on the PR comment. This is what dissolves the exposure question rather than answering it: exposure is a property of an adapter, and a later adapter changes it without touching anything else.
- **Previews are not a pipeline stage.** They are reconciled by the poll loop for every open Timone PR on a bound project, which is why `PIPELINE_STAGES` gains no member and no run enters a preview state. R8's criterion says *"WHEN the preview stage runs"* and therefore presupposes a mechanism that will not exist — it is reworded in phase 16, the same correction 15d made to R18.
- **A preview never blocks delivery.** The pull request is the deliverable; the preview is an aid to reviewing it. An adapter reporting a failed preview posts that on the PR and the pipeline continues. A build that cannot come up is a thing to be told about, not a reason to withhold finished work.
- **The first adapter serves on `localhost`, one port per PR**, from the interpolated ports `compose.yaml` already exposes. It is the cheapest thing that satisfies R8, and it is deliberately transitional: reachable only at the machine, on a laptop that suspends most of the night. **Phone review is not delivered by this adapter and the record says so** rather than letting R8's verification imply it.
- **A preview's data is the project's committed seed, or nothing.** After migrations, the adapter runs the project's own seed if it has one — committed, reviewable in the PR, obviously fake — and otherwise leaves the schema empty. **Copies or snapshots of real data are refused outright**, so that "make previews realistic" never becomes the reason one appears.

## Consequences

- **The second adapter costs an implementation, not a redesign.** Moving to Vercel means writing an `ensure` that reads the platform's deployment status and a `release` that is honestly a no-op, plus a manifest value. The poll loop does not change.
- **`preview:` in the manifest becomes an enum rather than a literal** as soon as a second adapter lands, and stays optional — a project with no binding gets no previews and no errors.
- **R8 and R12 can be verified on this laptop, and what that proves is bounded.** They prove a preview is built, addressed, refreshed on a new commit and removed on close. They do not prove a preview is reachable while the machine sleeps, and they do not prove phone review. The gap is recorded on the requirements rather than left for a reader to infer from an unqualified `verified`.
- **The laptop is now doing two jobs whose failure modes differ.** It runs the daemon and hosts every preview, so a preview that is up is up only while fvermaut is at the machine — the same suspension [ADR-0020](0020-liveness-is-judged-only-over-witnessed-time.md) had to make the reclaim path survive. An always-on host would fix both and is not this phase's to acquire.
- **Host resources bound simultaneous previews**, as ADR-0005 said. R10 serializes work per project, so the practical ceiling is roughly one preview per managed project — one today. This stops being free as projects are added, and teardown is what keeps it honest.
- **Refusing real data is a decision that will be argued with**, most likely by a future project whose review genuinely needs populated state. Revisit this ADR when that project exists; do not let a slice decide it.
- **Nothing here settles authentication**, because nothing here is exposed to anyone. The first adapter that leaves the host owes that decision, and it is not this one.
