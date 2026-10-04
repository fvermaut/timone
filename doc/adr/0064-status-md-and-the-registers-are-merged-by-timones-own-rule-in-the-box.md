# ADR-0064: `STATUS.md` and the requirement registers are merged by Timone's own rule, set up in the box

- **Status:** accepted
- **Date:** 2026-10-04
- **Source:** planning of [timone#200](https://github.com/fvermaut/timone/issues/200), piece 2 of [timone#197](https://github.com/fvermaut/timone/issues/197). The decision was made while planning that piece; the plan is [phase 48](../plans/phases/phase-48.md).
- **Requirements:** [PRD-07.R8](../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md#r8--files-almost-every-ticket-changes-never-stop-an-update), clauses 2 and 3

## Context

Almost every pull request changes `STATUS.md`, and most change a requirement register (`doc/specs/prd/*.criteria.md`). Since [ADR-0063](0063-a-ticket-takes-a-place-only-while-one-of-its-steps-runs.md), several pull requests of one project are open at the same time. When one merges, the others must be brought level with the default branch ([PRD-07.R7](../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md#r7--after-a-merge-every-other-open-pull-request-of-the-project-is-updated)). Git's own merge then stops on these two files almost every time, for reasons that are not real disagreements:

- In `STATUS.md`, two branches each add an item at the same place, after the last item, and each changes the `**Last updated:**` line.
- In a register, two branches each add a dated note under the same requirement, or a new clause at the end of the same list.

These are two people adding lines, and the right answer is to keep both. PRD-07.R8 asks that an update never needs a person because of these files, and that nothing either side wrote is lost.

A register has one more case. A line such as `- **Status:** draft` holds one value. When both sides change it to different values, keeping both lines would give the requirement two statuses.

Each run happens in its own box, built from the remotes ([ADR-0041](0041-a-run-happens-in-a-container-built-from-the-remotes.md)). A client repository receives only process artifacts (`doc/…`, `CONTEXT.md`), never a file of the harness.

Alternatives considered:

- **Git's built-in `union` rule, set for both files.** It keeps both sides of every conflict. Rejected: it keeps two `**Last updated:**` lines in `STATUS.md`, and two `Status:` lines in a register when both sides changed the status. The register would then say two things about one requirement, and nothing would notice.
- **Leave both files to the agent that brings the branch level.** No new code. Rejected: these files would conflict at nearly every update, so every pull request would carry a "what had to change" section about `STATUS.md`. An agent rewriting a long file by hand is also the most likely way for a line to be lost, and nothing would check that none was.
- **Commit a `.gitattributes` into each project.** Rejected: it is a harness file, and client repositories must not receive one. It would also do nothing without the merge command, which only exists where Timone is installed.
- **Split `STATUS.md` into one file per ticket**, and registers into one file per requirement. No merge would ever touch the same file. Rejected: `STATUS.md` is one page written for one person to read, and requirement registers are cited by file and anchor in every phase, report and pull request. Both changes are far larger than the fault.
- **Stop writing `STATUS.md` on work branches.** Rejected: it reverses [ADR-0060](0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md) D2 and [timone#85](https://github.com/fvermaut/timone/issues/85), which moved it onto the run's own branch so that a run never writes to the default branch.

## Decision

### D1 — Timone has its own merge rule for each of the two kinds of file

**`node dist/cli.js merge-file <kind> <base> <current> <other> <path>` merges one file three ways, as a git merge driver does**, and writes the result into `<current>`. `<kind>` is `status` or `register`. It starts from git's own line merge (`git merge-file`), so every part that git merges cleanly stays as git merged it. Only the parts where both sides changed the same lines are decided by the rule below.

- **Both kinds: where both sides changed the same place, both are kept.** The other side's lines come first, then the current side's. Nothing is dropped. In `STATUS.md`, a blank line is put between the two when neither has one, so two paragraphs stay two paragraphs.
- **`STATUS.md`: the `**Last updated:**` line is kept once**, with the later of the two dates.
- **Register: a field that holds one value is kept once.** A line of the form `- **<Field>:** <value>` that both sides changed to different values keeps the other side's value. The current side's line is not dropped: it is written as a dated note at the top of that requirement's section, saying what this branch had set and that the other value stands.
- **Register: a requirement number taken on both sides is refused.** If the merged file holds two `## R<k>` headings with the same `k`, the command leaves git's conflict in the file, says which number, and exits with 1. Both blocks are still in the file. Requirement numbers are cited, so this cannot be resolved by renumbering.

The command exits 0 when every part was decided, and 1 when any part was not. On 1, git reports a conflict in that file as for any other file.

### D2 — The box switches the rule on through the environment, and nothing is written into the project

**The box sets the rule up the way it sets up the push guard of [phase 43](../plans/phases/phase-43.md)**: through git's environment configuration (`GIT_CONFIG_COUNT`, `GIT_CONFIG_KEY_n`, `GIT_CONFIG_VALUE_n`). It sets `core.attributesFile` to a file Timone writes outside the project, which names `/STATUS.md` and `doc/specs/prd/*.criteria.md`, and it sets the two drivers to the command of D1. Every git command of the session, and of anything the session starts, uses them. The project's own files and its `.git/config` are not touched. A project that sets its own merge rule for these paths in its own `.gitattributes` keeps it, because git gives a project's own `.gitattributes` priority over `core.attributesFile`.

One function returns those settings, and both the box and the tests use it, so they cannot drift apart.

### D3 — A branch is brought level by merging the default branch into it

**The rule of D1 reads "the other side" as the default branch.** That is true when the default branch is merged into the work branch: the current side is the work branch, and the other side is the default branch. It is not true in a rebase, where the two sides swap. So a work branch is brought level by a merge, never by a rebase. The update after a merge (piece 4 of #197) is bound by this.

A merge also keeps the commits a person may already have read and commented on, needs no force push, and is what GitHub's own "Update branch" button does.

## Consequences

- An update no longer stops on `STATUS.md`. It stops on a register only when both sides took the same requirement number. Nothing either side wrote is lost: lines are kept, and a field value that does not stand is kept as a note.
- In `STATUS.md`, two sides that each rewrote the same item keep both versions, one after the other. The page then says one thing twice until the next step that writes `STATUS.md` tidies it. That is the cost of never dropping a line.
- When both sides changed the same field, the default branch's value stands because a named person merged it. The branch's own claim survives only as a note. The tests the update runs after the merge are what show whether the branch's claim still holds.
- The rule works only where Timone sets it up: in a box. A person who merges these files on their own machine, or GitHub's web editor, uses git's own merge and sees git's conflict. GitHub shows a pull request as in conflict until the box brings it level.
- Two branches that each add a requirement with the same number are still a conflict a person decides. Requirement numbers are not reserved the way phase and ADR numbers are ([ADR-0062](0062-a-numbered-file-takes-its-number-by-reserving-it-on-the-projects-remote.md)). New requirements are added rarely, and on an initiative's own branch, so this is left until it happens.
- Other files many tickets change, such as `CONTEXT.md` and, for Timone itself, `process.md`, are not covered. PRD-07.R8 names only `STATUS.md` and the registers.
