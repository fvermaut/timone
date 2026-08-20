# ADR-0041: A run happens in a container built from the remotes, never in the human's checkout

- **Status:** accepted
- **Date:** 2026-08-20
- **Source:** fvermaut's request of 2026-08-20 — *"agents need to work in containers, instead of modifying the code on my local directory. It is unsafe, if I decide to switch branch (to check something) while an agent work, I would break it and create inconsistencies"* — and the seven answers given in the grill that followed, in particular *"I'm also doing this for security reasons, and as a first step towards running in the cloud"*
- **Amends:** [ADR-0003](0003-local-daemon-agent-runtime.md) — the daemon still runs on fvermaut's own hardware and still polls, but *"spawns project-scoped agent sessions locally"* becomes *spawns them in containers*. [ADR-0007](0007-sessions-at-timone-root.md) — a session still runs at **a** timone root, and that root now lives inside the container; target-project resolution and the `projects/<name>/…` path rule are untouched
- **Revisits:** PRD-02's recorded non-goal — *"Sandboxing beyond the R15 path-containment hook — sessions run unisolated on my hardware; accepted risk, recorded deliberately, to be revisited before the first real client project is managed."* **This is that revisit**, and it is taken early: no client project is managed yet
- **Companions:** [ADR-0042](0042-timone-acts-under-its-own-identity.md) — who the container is; [ADR-0043](0043-the-humans-checkout-is-theirs-alone.md) — what happens to the folder it stops using
- **Standing:** [ADR-0002](0002-typescript-claude-agent-sdk.md), [ADR-0005](0005-docker-previews-on-own-host.md), [ADR-0006](0006-specs-in-repo-single-source-of-truth.md), [ADR-0021](0021-previews-are-reconciled-behind-an-adapter-seam.md)

## Context

**One working tree has two users.** A daemon-spawned session runs in the daemon's own process, at the timone root, and edits `projects/<name>/` — the same folder fvermaut opens in an editor and switches branches in. Nothing separates them. A `git switch` during a build corrupts the run; a run's checkout moves the branch under the editor. The collision has not yet caused a loss, and it is one keystroke away at all times.

**Three reasons were given for fixing it, and they are not the same reason.** The folder collision is the immediate one. Isolation is the second: a session runs with `bypassPermissions` — deliberately, because no human is at the keyboard to answer a prompt — so the only thing standing between an agent and the rest of the machine is the R15 path-containment hook, which reports a stray *after* it has happened. The third is that a run which needs nothing from a particular laptop is a run that can be moved to a server, and that is the direction fvermaut wants.

Three facts found by reading the code shape the decision:

- **The daemon learns what a session did by reading the ticket, not the disk.** `readStageOutcome`, `readGateDecision` and `readConversationRecord` all parse comment threads. Putting a session behind a container wall breaks none of the daemon's bookkeeping.
- **There is already a one-method seam.** `SessionRuntime.start(request)` returns `{ sessionId, completed, progress }`. Where a session runs is one implementation of it.
- **The verify stage stands the application up itself** — it starts the server, brings the database up, seeds it and drives a browser. So the container is not "node and a copy of the code"; it has to be able to run the project for real. The daemon's own preview stacks are unaffected: they are driven from `poll.ts` through the preview adapter, on the host, and never from inside a session.

Alternatives considered:

- **A second working copy per run — a git worktree, not a container.** Fully solves the collision, costs about a day, and was put to fvermaut first. Rejected on his answer: it buys nothing for isolation and nothing for the cloud, and the collision was only one of three reasons.
- **One image holding node, the browsers and the database together.** Simpler to describe, and rejected: it means a bespoke image per project which drifts from how the application actually runs, so a verification pass inside it proves less than one run beside the real services.
- **Give the container the host's docker socket so the agent can run compose itself.** The shortcut every implementation of this reaches for. **Rejected explicitly, and named here so it is refused by citation rather than re-argued:** the docker socket is root on the host. Handing it to a `bypassPermissions` agent puts the agent back outside the box, and cancels the second of the three reasons.
- **Restricting the container's outbound network to GitHub, the registry and Anthropic.** Considered and rejected for now — see D4.

## Decision

### D1 — Every daemon-spawned session runs in a container it does not outlive

One container per run, created when the run starts and destroyed when it ends. Nothing from the host filesystem is mounted into it. It obtains its content by cloning from git remotes: timone, and the target project. Those remotes are the only source of truth, which is what makes the container disposable.

The layout inside the container is the layout ADR-0007 already fixed — a timone root with the target project at `projects/<name>/` — so no skill, prompt or path rule changes. What changes is whose disk that root is on.

### D2 — Timone is fetched at one exact version, pinned when the run starts

The container clones timone at **the commit the daemon itself is running**, not at whatever the default branch says at that moment. Two runs started an hour apart therefore follow identical rules, which is not true today.

**A daemon whose own checkout carries uncommitted changes refuses to spawn**, and says so. The alternative — running the pushed rules while the human reads different rules on screen — is the confusion this pin exists to prevent, and it is worse for being silent. The cost is accepted: a change to a skill must be pushed before any run can use it, on a branch if desired, with the daemon pointed at that branch.

### D3 — The agent's container gets services beside it, and no power over docker

The agent's container carries node, the toolchain and the browsers. Everything else the project needs to run — its database above all — is started **beside** it, from the compose file the project already commits for previews, on a private network the two share. The agent reaches the database by name.

**The agent's container receives no docker socket, no docker CLI and no ability to create containers.** Whatever a run needs standing up is stood up for it, by the daemon, before the session starts.

The cost is a real prerequisite: a project with no working compose file cannot be built by an agent at all. `ivtrends` does not have one today.

### D4 — Outbound network is open, and this is recorded as an accepted risk

The container may reach any address. It is not restricted to GitHub, the package registry and Anthropic.

The reasoning is fvermaut's — *"open, I just want to protect my machine"* — and it is sound: a box that must be allowed to push the code it is working on cannot be prevented from leaking that code by closing other doors. Restricting the network protects against a hostile *package*, not against the agent, and that is a different threat with a different fix. Recorded here so that a later session tightening it knows it is answering a new question rather than correcting an oversight.

### D5 — Sessions a human opens stay on the human's machine

`timone takeover`, and any session fvermaut starts himself, run on his hardware, on his copy, under his credentials. That is the whole point of them: they exist to do things the daemon may not, with a person present. They are outside this decision, and the R15 hooks continue to bracket them exactly as ADR-0018 requires.

## Consequences

- **The collision is gone by construction, for sessions.** Nothing a run does can touch the folder fvermaut has open. The daemon's *own* git work is a separate half of the same problem and is decided in [ADR-0043](0043-the-humans-checkout-is-theirs-alone.md); without that half, this one does not deliver what it promises.
- **The R15 path-containment hook changes meaning and must not be removed.** Inside a container it stops being the only wall and becomes the *inner* wall — the thing that catches a session writing outside its target project while still inside the box, which is a real mistake with real consequences in the artifacts. Defence in depth, deliberately kept.
- **`bypassPermissions` becomes defensible rather than merely accepted.** It was always the right call for an unattended session; it is now made against a boundary instead of against a laptop.
- **Every run pays a startup cost** — a clone, a dependency install, and the services coming up. Caching is an implementation concern for the phase; the shape of the answer is a prebuilt base image plus a per-project cache, and the trade it carries (runs on one project share a cache) is a phase-level decision, not this one.
- **A container that dies takes its working state with it.** Everything that matters is pushed or written on the ticket before a run ends, which is already true, and this decision makes it load-bearing rather than merely tidy.
- **This is the cloud step, not the cloud.** A run that needs only two git remotes, a credential and a network is a run that a server can perform. Nothing here moves the daemon off fvermaut's hardware, and ADR-0003 still stands on that point.
