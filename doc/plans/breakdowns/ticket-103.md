# Breakdown

**Status:** Awaiting approval

1. **The record of what changed on the way** — one file on the work branch where every step of the build writes down what it changed or could not do, each entry dated and naming the run that wrote it.
2. **Building and checking carry on instead of asking** — a plan step that turns out wrong, a requirement the built behaviour contradicts, a check that cannot run, and tests still failing after the retries are each written into that record and amended in place, and the run continues.
3. **The pull request always opens, and opens on that record** — delivery opens a pull request even when the work fails its own tests, the body starts with the list of what changed or an explicit line saying nothing did, and a screen is shown there with its preview address and its comparison against the reference rather than before.
4. **A stop inside the build is a fault, not a wait** — the machinery no longer parks a run between the agreement and the pull request; a step that stops anyway is reported as a defect against Timone, and the stops that remain only ask what a written reply can settle.
5. **A closed pull request comes back as a new request** — nothing further is committed to the rejected branch, and the rejection re-enters as a fresh request anchored on the pull request's discussion.
