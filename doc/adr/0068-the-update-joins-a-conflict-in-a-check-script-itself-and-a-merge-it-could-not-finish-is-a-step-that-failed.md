# ADR-0068: The update joins a conflict in a check script itself, and an update that could not finish its merge is a step that failed

- **Status:** accepted
- **Date:** 2026-10-13
- **Source:** [timone#234](https://github.com/fvermaut/timone/issues/234), with [timone#235](https://github.com/fvermaut/timone/issues/235) folded in. D1 to D3 were decided by fvermaut in the terminal on 2026-10-13, in the takeover session of ivtrends#201, and are written down in [triage 004](../triage/004-the-update-joins-check-script-conflicts.md). D4 was decided while planning the fix, from what the ticket asks.
- **Requirements:** [PRD-07](../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md) R7
- **Amends:** [ADR-0066](0066-the-update-is-a-step-the-runner-starts-when-an-open-pull-request-falls-behind.md) D4, for check scripts only (D1 to D3 here), and D2's "when the update ends, the runner does nothing more", for an update that failed (D4 here). The rest of ADR-0066 stands.
- **Standing:** [ADR-0048](0048-a-verification-probe-is-kept-proved-able-to-fail-and-hidden-from-the-builder.md) D4 — a builder never reads the check scripts; [ADR-0061](0061-a-check-script-proves-itself-once-and-a-fix-re-runs-what-it-can-affect.md) D1 — a check script does its break run only when it is new or rewritten

## Context

ADR-0066 D4 says the update session "never edits code itself". Every conflict goes to a fresh fix context, told never to open the folder that holds the check scripts. That works for code. It does not work for a check script: when the default branch and the branch both changed one, the only context that may join it is told not to open it. The update then stops the merge, the branch stays behind, and a person has to join the files by hand.

This happened eight times on five ivtrends tickets between 2026-10-08 and 2026-10-13: #175, #176, #194 (twice), #197 (twice) and #201 (twice). Three were finished by hand in a takeover. Each time the step was reported as "succeeded", because the session itself ended without an error. The conflicts came in three shapes ([triage 004](../triage/004-the-update-joins-check-script-conflicts.md)): each side added its own checks to one script; both sides fixed the same check in two ways; two pieces each wrote a whole script for a requirement they share.

The guard already lets the update open the check scripts: `update` is in `CHECKING_STAGES` in `src/daemon/probeGuard.ts`, because the update runs them. What stops the join is only the wording in the update's instructions, in ADR-0066 and in `process.md`.

Alternatives fvermaut was shown, and did not pick:

- **A second fresh helper that may open only the check scripts.** It would keep the update session's hands off every file. Rejected: the update session already reads the check scripts to run them, so a second context hides nothing from anyone, and it costs one more context on every such merge.
- **A full check step after the update, which rewrites the check scripts.** Rejected: that is the cost of a whole check on every merge, the alternative ADR-0066 already turned down, and the update would still stop first.
- **Leave it to a person**, as today. Rejected: it has happened eight times in five days, and PRD-07 says the machine fixes any conflict.

For D4, the alternatives were:

- **Trust the session's own ending**, as today. Rejected: the session ends cleanly when it aborts the merge, so the runner is told "succeeded" about a branch that is still behind.
- **A new field in the record entry that says whether the merge finished.** Rejected as the only signal: the entry is written by the same session, and a session that wrote no entry, or an old entry, would read as done.
- **Ask the forge whether the branch holds the commit the update set out to bring in.** Chosen, below: it is a fact about the branch, read by code.

## Decision

### D1 — The update session joins a conflict in a check script with its own hands, and only that

**When a merge leaves a conflict in a file under a probe folder, the update session joins that file itself.** It does not hand it to a fix context. The rules for the join:

- **Keep every check from both sides.** When each side added its own checks, the joined script has all of them.
- **When both sides changed the same check in two ways, keep the one that fails wherever the other would.** That is the stricter of the two.
- **When both sides wrote a whole script for the same requirement**, git shows the file as added on both sides. The joined script holds both, each as its own part, and keeps every clause of both.
- **Keep how each check finds what it compares with.** Where both sides pin the same commit, keep that pin once. The join does not add a pin where a side had none: what a check compares with after a merge is [timone#240](https://github.com/fvermaut/timone/issues/240), and it is not decided here.
- **When it cannot tell which of two versions is stricter, it does not guess.** It stops the merge, as before, and the record says which check and why.

**A conflict in any other file still goes to a fresh fix context**, with the brief ADR-0066 D4 gives it, which keeps it away from the probe folders. Nothing changes for that context. When both kinds of conflict are left, the session joins the check scripts first, and the fix context resolves the rest and finishes the merge commit.

**Code draws the line between the two kinds of file**, so that every update draws it the same way: a command lists the files left in conflict, each check script with its requirement, and the other files apart.

### D2 — The record says which check scripts were joined and how

The update's record entry gets one more line, `Check scripts joined:`, with `none`, or each joined script's requirement ID and one plain sentence on how it was joined. Code puts that line on the pull request with the rest of the entry. The entry still never names a check script's path.

### D3 — The probe folder has one more writer: the update's join

`process.md` says only the check writes the probe folder. That stays true for writing a check: the update never writes a new check, never changes what a check asserts beyond choosing the stricter of two versions, and never rewrites a script for a `revised` requirement. A joined script is not new: each part of it was proved able to fail when it was written. So it runs as every other check script runs in an update, real run only (ADR-0061 D1), and does no break run.

### D4 — An update that did not bring the branch level is a step that failed

**When the update step ends, code asks the forge whether the branch now holds the commit of the default branch that the update's newest record entry says it brought in.** The step counts as done when the newest entry was written by this step and the branch holds that commit. It also counts as done when the step wrote no entry and the branch is not behind the default branch: the update found nothing to bring in. Otherwise its end is recorded as failed, with the reason in plain words: the merge was not finished, or the step wrote no entry and the branch is still behind. A merge that finished and a test that still fails is not a failed step: the work is marked as not passing on the pull request, as ADR-0066 D4 says. The runner is told the step failed, not that it succeeded.

When an update failed, the runner says so on the ticket, says what stopped it, and asks a person to bring the branch level. When the default branch moves again, the runner is told again, as before (ADR-0066 D1).

## Consequences

- **The update session now edits files in the probe folder.** It already read them. A builder still never sees them: the fix context's brief is unchanged, and so is the guard.
- **The judgement "which version is stricter" is the session's.** A wrong judgement keeps a weaker check. The record names every joined script and how, so a person can see it on the pull request.
- **A joined check that compares with "where the branch left the default branch"** compares, after the merge, with the default branch itself. For the work that arrived, that is the fault in #240. The update runs the joined script as it runs any other, and that fault stays open until #240 is fixed.
- **One more call to the forge after every update step.** It is the same compare the poll already makes.
- **An update can now fail without an error from the session.** The runner's rules and the ticket comment say what to do then. A person is asked only when the update stopped, which with D1 is only when it could not tell which check is stricter.
