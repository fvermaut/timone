# ADR-0042: Timone acts under its own identity, and a run's credential opens one repository

- **Status:** accepted
- **Date:** 2026-08-20
- **Source:** fvermaut's answer of 2026-08-20 to *"whose keys does the box get?"* — **"yes, its own identity"**
- **Closes:** [timone#19](https://github.com/fvermaut/timone/issues/19) — every message the machine writes appears under fvermaut's name
- **Companions:** [ADR-0041](0041-a-run-happens-in-a-container-built-from-the-remotes.md) — the box this credential is handed to; [ADR-0043](0043-the-humans-checkout-is-theirs-alone.md)
- **Standing:** [ADR-0004](0004-github-first-adapter-pair.md), [ADR-0019](0019-timone-authored-commits-carry-a-provenance-trailer.md)

## ✏ Refined 2026-08-21 — the identity is a GitHub App, and it is installed rather than invited

> **✏ Built and observed the same day.** The App exists: **Timone Agent**, slug `timone-agent`, App ID **4670926**, installation **155426497** on `fvermaut`, on selected repositories, granting exactly `contents:write`, `issues:write`, `metadata:read`, `pull_requests:write` — Actions, Workflows, Administration and Members all withheld. Two of [PRD-02.R23](../specs/prd/prd-02-inversion-of-control.criteria.md)'s clause-5 promises were **observed rather than argued** while testing something else:
>
> - **It acts as itself.** A throwaway issue opened with an installation token was authored by `timone-agent[bot]`, not by fvermaut ([scratch-app#41](https://github.com/fvermaut/scratch-app/issues/41)). This is the whole of D1, seen working.
> - **A credential opens one repository alone.** A token minted with `{"repositories":["scratch-app"]}` returns **HTTP 200** on `scratch-app` and **HTTP 404** on `ivtrends` — the second repository is *invisible* to it, not merely forbidden, which is a stronger result than the ADR asked for.
>
> **This is evidence for a verifier, not a verdict.** R23 stays `draft`: stage 7 writes verdicts, and nothing here was checked by a context that did not do the work. It is recorded so the next reader finds it instead of re-deriving it.
>
> **What the same test disproved** is in [ADR-0044](0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) D3: a bot **cannot be an issue assignee**, by any route, so the mechanism that ADR chose for holding a stopped step fell back to a label. Identity and scoping work; assignment does not.

**The decision below stands. Its shape changes.** Timone still acts as itself rather than borrowing fvermaut's login, and a run's credential still opens one repository and expires. What was assumed everywhere — *a second account on the forge, invited to each repository* — is superseded by a **GitHub App, installed on the repositories it works on**. fvermaut ruled this on 2026-08-21.

**Why the shape moved.** The account was going to be a second personal account holding a fine-grained token: long-lived, scoped by hand, and needing a mailbox of its own before it could exist at all. A GitHub App needs neither. It is created once, it is **installed** per repository rather than invited, and it mints **installation access tokens that expire after an hour and can be scoped to named repositories**. That is not an approximation of D2 — it is D2, handed over by the platform. Phase 30's slice 30a asks for "a short-lived credential for **one** repository"; an installation token is exactly that object, and the scope is a **parameter of the request** rather than a property of an account's memberships.

What changes, item by item:

- **No second account, and no email alias.** The one-time human prerequisite in the Consequences below is superseded: nothing is created that needs a mailbox.
- **Installation replaces invitation.** Access is granted by installing the App and selecting repositories — the same list `timone.yaml` declares. Adding a project later changes the installation's repository selection; it is not a collaborator invite.
- **The identity on the forge is `timone-agent[bot]`.** ✏ *2026-08-21: the slug `timone` was unavailable, so the App is `Timone Agent` / `timone-agent`.* That is what comments, what pushes, what opens pull requests and what authors machine-authored commits. Everything D1 says about the identity being *not a human* holds under that name, and it still does **not** replace the provenance trailer of [ADR-0019](0019-timone-authored-commits-carry-a-provenance-trailer.md).
- **The secret is a private key, and it lives outside version control.** The App's private key, and the installation tokens minted from it, belong under `.timone/` — already gitignored as daemon machine state (`.gitignore`, *"Daemon machine state … local state, never a process artifact"*). Two things follow and both matter: the key can never ride into a client repository, and it does not make timone's own checkout dirty, so it does not trip the refusal-to-spawn-on-a-dirty-checkout that phase 30's slice **30f** builds.
- **D2 is strengthened, not weakened.** A credential that expires in an hour and names one repository is a tighter bound than a hand-scoped token on a standing account — and it is *minted per run* rather than stored.

**✏ Superseded 2026-08-21, later the same day — it was tested, and it failed.** The paragraph below called the bot-assignment unproven and asked for exactly the test that was then run. **A GitHub App's bot cannot be assigned to an issue by any route** — installation token, user token, or the REST endpoint — and `suggestedActors(capabilities: [CAN_BE_ASSIGNED])` lists no bot. The schema admits it because that path belongs to GitHub's own registered coding agents. [ADR-0044](0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) D3 therefore falls back to a **label**, which is what it now records, and no phase moves — phase 29 stops needing this App at all, since a label needs no identity. **Nothing here was built on the assumption**, because the test came first; that was the point of writing the paragraph below rather than proceeding.

~~**One thing is unproven and must be tested before any code is built on it.** That an App's bot can actually be **assigned to an issue** end to end. Only the schema was inspected, against `fvermaut/scratch-app` on 2026-08-21: `Issue.assignedActors` exists, its `Assignee` union admits `Bot`, and the mutation `replaceActorsForAssignable` exists. **Nothing was assigned**, because proving it needs an installed App. [ADR-0044](0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) D3 makes the assignee the thing that holds a stopped step out of the frontier, so if a bot cannot hold a claim, that decision needs another mechanism and two phases move. **Install the App, assign it to one issue, and read it back — before a slice depends on it.**~~

## Context

**There are no credentials anywhere in this codebase.** Not one. `gh` is invoked as a bare binary and authenticates as whoever is logged in; git pushes with the host keychain; the agent SDK runs on the host's Claude login. Every access Timone has ever made has been fvermaut's own access, borrowed silently.

That was invisible while everything ran on one laptop. [ADR-0041](0041-a-run-happens-in-a-container-built-from-the-remotes.md) makes it a design question, because a container has none of it and something must put credentials in. **Whatever is put in is exactly what an agent can reach when it goes wrong**, so this is the decision that determines how much of the isolation is real.

Two consequences of borrowing are already visible. [timone#19](https://github.com/fvermaut/timone/issues/19) records the cosmetic one: every ticket comment the machine writes appears to come from fvermaut, so a thread gives no way to tell who said what — and the gate readers have to work around it with a `fromTimone` marker rather than an author. The substantive one has never been recorded: a session working on one project holds credentials for **every** repository fvermaut can reach, including clients.

Alternatives considered:

- **Copy fvermaut's credentials into each container.** Works on day one, needs no setup, and rejected: it puts the agent in a box and then hands it the key to the house. The blast radius of a bad run stays every repository he has access to, which is the thing the box was built to shrink.
- **One credential for the machine account, valid across all managed repositories.** The middle option, and rejected for the same reason at smaller scale: a run sent to work on one project has no business being able to push to another, and a per-run scope costs little once an account exists.
  - **✏ Refined 2026-08-21:** under the App shape it costs even less than that. Scoping a minted token to one repository is a field in the mint request, so the rejected middle option is not merely worse — it is *more* work than the option taken.

## Decision

### D1 — Timone has its own account on the forge

> **✏ Refined 2026-08-21:** ~~account~~ — the identity is a **GitHub App**, installed on the repositories rather than invited to them, and it appears as **`timone-agent[bot]`**. Everything else in D1 stands unchanged. See the amendment above.

A separate identity, ~~added only to~~ **installed only on** the repositories declared in `timone.yaml`. It is what comments, what pushes, what opens pull requests, and what appears as the author of machine-authored commits.

The provenance trailer of [ADR-0019](0019-timone-authored-commits-carry-a-provenance-trailer.md) is **not** replaced by it. The trailer says *which stage and which session*; the account says *not a human*. Both are needed and neither is derivable from the other — and the trailer remains the mechanism, because a session fvermaut opens himself still commits under his own name and must still be identifiable as machine-driven work.

### D2 — A run's credential opens one repository and expires

The credential handed to a container is scoped to the single target project, and to nothing else. It is minted per run and is short-lived. The worst a run can do to the forge is push a bad branch to the project it was already sent to work on.

The daemon holds whatever mints it. **No long-lived credential capable of reaching more than one repository is ever placed inside a container.**

> **✏ Refined 2026-08-21 — what mints it is now concrete.** The daemon holds the **App private key**; it signs a JWT with it, exchanges the JWT for an **installation access token scoped to the target repository**, and hands *that* to the container. The token expires in an hour, so "short-lived" is the platform's guarantee rather than ours to enforce. The private key stays on the host and never enters a box — it is the one long-lived secret in the system, and D3's rule about fvermaut's credentials applies to it word for word.

### D3 — fvermaut's credentials never enter a container

Not his forge login, not his SSH keys, not his keychain. A container that needs to reach something is given a scoped credential for that thing or it does not reach it.

### D4 — The Claude credential is a separate, smaller question, and is answered plainly

A container needs to authenticate to Anthropic. It gets a long-lived token minted from fvermaut's existing subscription, so nothing about billing changes.

**This is deliberately not solved the way D2 solves the forge.** The threat is different in kind: the token spends money and cannot touch a repository, and a run already knows the code it is working on. A cleverer arrangement is not worth building until spend is actually a control fvermaut wants — and PRD-02 records budget controls as a declined non-goal.

## Consequences

- **A one-time human prerequisite, and nothing works before it is done.** ~~An account is created and invited to each managed repository.~~ **✏ Refined 2026-08-21:** a **GitHub App is created and installed** on the managed repositories, its repository selection matching `timone.yaml`; its private key is downloaded once and placed under `.timone/`. No account, no mailbox, no invitations. Still roughly an hour, once, and still the first thing the phase must ask for.
- **[timone#19](https://github.com/fvermaut/timone/issues/19) closes as a side effect**, and the `fromTimone` gate guard gets a real author to check rather than a marker convention. **The marker convention is not removed on that account** — a comment's author is a fact about the forge, and the gate rule that Timone can never decide its own gate is too important to re-found on one adapter's field. Author becomes the primary check; the marker stays as the fallback.
- **The provenance check has a new false-positive shape to watch.** It has already fired wrongly four times in one session over authorship it misread. A change of commit author touches exactly that machinery, and the phase that lands this must exercise it deliberately rather than discover it in the wild.
- **Client repositories will show a bot as a contributor.** Correct and wanted: the alternative is client history that claims fvermaut hand-wrote work he did not.
- **Nothing here makes the ~~machine account~~ machine identity safe by itself.** It is scoped, so a bad run is bounded — it is not prevented. The bound is the point.
- **✏ Added 2026-08-21 — the App's own permissions are the ceiling for every run, and the account shape hid that question.** An App is installed with a named set of permissions, and membership no longer stands in for them: what the installation grants is exactly what a runaway agent has. **The set fvermaut was given at setup, and the reason for each:**

  | Permission | Level | Why it is needed |
  | --- | --- | --- |
  | Contents | Read and write | clone the repositories, push a work branch, perform the merges ADR-0043 D3 moves to the forge |
  | Issues | Read and write | the ticket thread, labels, the call to action, and the assignee that holds a step ([ADR-0044](0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) D3) |
  | Pull requests | Read and write | stage 8's artifact: open, comment, merge |
  | Metadata | Read-only | mandatory, granted implicitly |

  Everything else stays at *No access*. **Notably withheld:** Actions and Workflows — nothing in the process writes CI configuration, and a token that could rewrite `.github/workflows` could grant itself more on the next run; Administration; and Members.

  **This is a recommendation made by the harness on 2026-08-21, not a ruling fvermaut was grilled on**, and it is written here so the ceiling is visible rather than buried in an install screen nobody re-reads. It is changeable at any time in the App's settings, and widening it is a decision worth taking deliberately — a permission added to serve one slice is a permission every later run also holds.
