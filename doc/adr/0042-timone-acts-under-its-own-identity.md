# ADR-0042: Timone acts under its own identity, and a run's credential opens one repository

- **Status:** accepted
- **Date:** 2026-08-20
- **Source:** fvermaut's answer of 2026-08-20 to *"whose keys does the box get?"* — **"yes, its own identity"**
- **Closes:** [timone#19](https://github.com/fvermaut/timone/issues/19) — every message the machine writes appears under fvermaut's name
- **Companions:** [ADR-0041](0041-a-run-happens-in-a-container-built-from-the-remotes.md) — the box this credential is handed to; [ADR-0043](0043-the-humans-checkout-is-theirs-alone.md)
- **Standing:** [ADR-0004](0004-github-first-adapter-pair.md), [ADR-0019](0019-timone-authored-commits-carry-a-provenance-trailer.md)

## Context

**There are no credentials anywhere in this codebase.** Not one. `gh` is invoked as a bare binary and authenticates as whoever is logged in; git pushes with the host keychain; the agent SDK runs on the host's Claude login. Every access Timone has ever made has been fvermaut's own access, borrowed silently.

That was invisible while everything ran on one laptop. [ADR-0041](0041-a-run-happens-in-a-container-built-from-the-remotes.md) makes it a design question, because a container has none of it and something must put credentials in. **Whatever is put in is exactly what an agent can reach when it goes wrong**, so this is the decision that determines how much of the isolation is real.

Two consequences of borrowing are already visible. [timone#19](https://github.com/fvermaut/timone/issues/19) records the cosmetic one: every ticket comment the machine writes appears to come from fvermaut, so a thread gives no way to tell who said what — and the gate readers have to work around it with a `fromTimone` marker rather than an author. The substantive one has never been recorded: a session working on one project holds credentials for **every** repository fvermaut can reach, including clients.

Alternatives considered:

- **Copy fvermaut's credentials into each container.** Works on day one, needs no setup, and rejected: it puts the agent in a box and then hands it the key to the house. The blast radius of a bad run stays every repository he has access to, which is the thing the box was built to shrink.
- **One credential for the machine account, valid across all managed repositories.** The middle option, and rejected for the same reason at smaller scale: a run sent to work on one project has no business being able to push to another, and a per-run scope costs little once an account exists.

## Decision

### D1 — Timone has its own account on the forge

A separate identity, added only to the repositories declared in `timone.yaml`. It is what comments, what pushes, what opens pull requests, and what appears as the author of machine-authored commits.

The provenance trailer of [ADR-0019](0019-timone-authored-commits-carry-a-provenance-trailer.md) is **not** replaced by it. The trailer says *which stage and which session*; the account says *not a human*. Both are needed and neither is derivable from the other — and the trailer remains the mechanism, because a session fvermaut opens himself still commits under his own name and must still be identifiable as machine-driven work.

### D2 — A run's credential opens one repository and expires

The credential handed to a container is scoped to the single target project, and to nothing else. It is minted per run and is short-lived. The worst a run can do to the forge is push a bad branch to the project it was already sent to work on.

The daemon holds whatever mints it. **No long-lived credential capable of reaching more than one repository is ever placed inside a container.**

### D3 — fvermaut's credentials never enter a container

Not his forge login, not his SSH keys, not his keychain. A container that needs to reach something is given a scoped credential for that thing or it does not reach it.

### D4 — The Claude credential is a separate, smaller question, and is answered plainly

A container needs to authenticate to Anthropic. It gets a long-lived token minted from fvermaut's existing subscription, so nothing about billing changes.

**This is deliberately not solved the way D2 solves the forge.** The threat is different in kind: the token spends money and cannot touch a repository, and a run already knows the code it is working on. A cleverer arrangement is not worth building until spend is actually a control fvermaut wants — and PRD-02 records budget controls as a declined non-goal.

## Consequences

- **A one-time human prerequisite, and nothing works before it is done.** An account is created and invited to each managed repository. Roughly an hour, once, and it is the first thing the phase must ask for.
- **[timone#19](https://github.com/fvermaut/timone/issues/19) closes as a side effect**, and the `fromTimone` gate guard gets a real author to check rather than a marker convention. **The marker convention is not removed on that account** — a comment's author is a fact about the forge, and the gate rule that Timone can never decide its own gate is too important to re-found on one adapter's field. Author becomes the primary check; the marker stays as the fallback.
- **The provenance check has a new false-positive shape to watch.** It has already fired wrongly four times in one session over authorship it misread. A change of commit author touches exactly that machinery, and the phase that lands this must exercise it deliberately rather than discover it in the wild.
- **Client repositories will show a bot as a contributor.** Correct and wanted: the alternative is client history that claims fvermaut hand-wrote work he did not.
- **Nothing here makes the machine account safe by itself.** It is scoped, so a bad run is bounded — it is not prevented. The bound is the point.
