# ADR-0043: The human's checkout is theirs alone; the machine's git work goes through the forge

- **Status:** accepted
- **Date:** 2026-08-20
- **Source:** fvermaut's answer of 2026-08-20 to *"does the machine keep any folder on your disk?"* — **"yes, never touch my disk"**
- **Amends:** [ADR-0001](0001-independent-repos-under-gitignored-workspace.md) — `projects/<name>/` continues to exist and continues to be materialised by `workspace sync`; it stops being where the machine works
- **Companions:** [ADR-0041](0041-a-run-happens-in-a-container-built-from-the-remotes.md), [ADR-0042](0042-timone-acts-under-its-own-identity.md)

## Context

**Boxing the agent does not fix the collision, and this was found by reading the code rather than by reasoning about it.** The daemon does its own git work in `projects/<name>/` too: it probes a branch's tip there (`gitBranchHead`, the default `repoProbe`), and it merges work into the default branch there (`mergeIntoDefault` in `git.ts`, the default `mergeProbe`). A merge checks a branch out.

So the folder has **two** machine users, not one. With every session boxed, a merge and a `git switch` still collide in the same folder — in a form that is harder to notice, because no agent is visibly running when it happens. A decision that stopped at [ADR-0041](0041-a-run-happens-in-a-container-built-from-the-remotes.md) would have shipped a promise it does not keep.

Alternatives considered:

- **Leave the daemon's git work where it is.** Least work, and rejected on the finding above: the stated problem survives.
- **Give the daemon a private checkout of its own, outside `projects/`.** Cheap — hours, not days — and genuinely on the path, since a container needs its own clone regardless. Rejected as the *end state* rather than as a step: a daemon that needs a local checkout is a daemon that needs a filesystem it owns, and the direction of travel is a daemon that needs neither. It survives in the phase as an early slice, not as the destination.

## Decision

### D1 — The daemon performs no git operation against the human's checkout

No fetch, no checkout, no merge, no read. `projects/<name>/` becomes fvermaut's copy: for reading code, for the sessions he opens himself, refreshed when he asks for it with `workspace sync`. Nothing the machine does can disturb it, and he may switch branches in it whenever he likes — which is the sentence this whole change exists to make true.

### D2 — Branch state is read from the forge

*"What is this branch's tip?"* becomes a forge query, behind the existing adapter seam, alongside every other question Timone already asks the forge. The `repoProbe` seam stays; its default implementation stops touching a disk.

### D3 — Merging is a forge operation

A pull request is merged through the forge. **The one merge that has no pull request** — chunk zero's, which [ADR-0030](0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md) D2 lands when the breakdown is approved — is likewise performed through the forge's merge call. It stays a merge with no pull request; only the hand performing it changes.

That case is the one to be careful with. It is the only place where work reaches the default branch without a human having looked at a diff, and rewriting how it happens is rewriting the most load-bearing unreviewed path in the system.

### D4 — `workspace sync` stays, and becomes unambiguously a human command

It exists to give fvermaut a copy to read. It is no longer a prerequisite for the machine to work, and nothing in the pipeline may come to depend on having been run.

## Consequences

- **The promise in [ADR-0041](0041-a-run-happens-in-a-container-built-from-the-remotes.md) becomes true.** These two decisions are one guarantee split across two objects, and neither delivers it alone.
- **The daemon can run without a project checkout at all**, which is precisely what makes it movable to a server later. That is a consequence, not the reason.
- **More forge calls, and more exposure to the forge being slow or down.** Timone already has three unfiled network defects — no timeout on `gh`, no retry on transport failure, and a slow cycle misread as an absent daemon — and this decision increases the traffic that meets them. **They should be filed and fixed alongside, not after.**
- **A merge conflict is now the forge's answer rather than git's.** The failure surface changes: a forge refusing to merge reports differently from a local merge that fails, and the pipeline's handling of a failed merge has to be re-checked against the new shape rather than assumed to carry over.
- **Skills that read the target project keep working unchanged**, because inside a container the project is still at `projects/<name>/`. This decision is invisible to every skill, and that is deliberate.
