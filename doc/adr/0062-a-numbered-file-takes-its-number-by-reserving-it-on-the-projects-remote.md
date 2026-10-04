# ADR-0062: A numbered file takes its number by reserving it on the project's remote

- **Status:** accepted
- **Date:** 2026-10-04
- **Source:** planning of [timone#199](https://github.com/fvermaut/timone/issues/199), piece 1 of [timone#197](https://github.com/fvermaut/timone/issues/197). The decision was made while planning that piece; the plan is [phase 44](../plans/phases/phase-44.md).
- **Requirements:** [PRD-07.R8](../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md#r8--files-almost-every-ticket-changes-never-stop-an-update), clause 1

## Context

Phase files, ADRs, triage records and PRDs are named by a number. Every skill that writes one says the same thing: list the folder, take the highest number, use the next. That is safe only while one session writes to a project at a time. [PRD-07](../specs/prd/prd-07-several-tickets-of-one-project-at-once.md) lets several tickets of one project be worked at the same time. Each run works in its own box with its own clone ([ADR-0041](0041-a-run-happens-in-a-container-built-from-the-remotes.md)), and cuts its branch from the default branch. Two runs that plan at the same time see the same folder and take the same number. R8 says they never may.

The only thing two boxes share is the project's remote. A session a person runs on their own machine shares it too, and shares nothing else with the daemon.

Alternatives considered:

- **Name the file after its ticket** (`phase-199.md`). No coordination at all. Rejected: a ticket can need several ADRs, a triage record exists exactly when there is no ticket, a session a person runs by hand has no ticket, and the numbers of every file already written would stop running in order.
- **The daemon hands out numbers** from a file under `.timone/`, behind a lock. Rejected: a session a person runs, and a takeover in their own terminal, never pass through the daemon, and the box has no way to ask the daemon anything in the middle of a session.
- **Look at every open branch and pull request, then take the next number.** Rejected as the whole answer: two sessions that look at the same moment still take the same number. It stays as one part of the answer, below, because it also sees a number a file took before this rule existed.
- **Let numbers collide, and rename the later file when it is brought level with the default branch.** Rejected: an ADR number is quoted in other files, in tickets and in pull requests before it merges, and a rename leaves all of those pointing at the wrong file.
- **Reserve through the forge's API** (`POST /repos/…/git/refs`). Works the same way as the choice below. Rejected for plain git: git works with any remote, and a test can run it against a bare repository on disk.

## Decision

### D1 — The number is reserved on the remote, by creating a ref there

**A session takes a number by creating the ref `refs/timone/numbers/<kind>/<number>` on the project's remote.** A git server creates a ref only if it does not exist yet, and it decides that under a lock, so of two sessions that try the same number at the same moment exactly one succeeds. The other tries the next number. A ref under `refs/timone/` is not a branch or a tag: it does not show in the forge's list of branches, and a clone does not fetch it.

The ref points at a commit made only for this purpose: an empty tree, no parent, and a message that says what was reserved and for whom. No two such commits are the same, so a push to a ref that already exists is never a fast-forward, and it fails.

### D2 — The first number tried is one above everything already taken

The number tried first is one above the highest of: the files of that kind on the default branch, the files of that kind on every branch of the remote, and the refs already reserved for that kind. The branches are read so that a file written before this rule existed, or by a session that did not follow it, still counts.

### D3 — One command does it, and no skill counts files any more

**`node dist/cli.js number <project> <kind>` reserves the number and prints it**, padded as that kind is padded: `phase` two digits, `adr` four, `triage` three, `prd` two. Every skill that numbers a file calls it, and none lists a folder to find a number. **If the command fails, the session stops and says so.** It never falls back to counting files, because that fallback is the fault this decision removes.

### D4 — A reserved number is never given back

A run that reserves a number and is then abandoned leaves a gap. Numbers are already never reused; a gap is the cost of never handing the same number to two sessions.

### D5 — A run's push guard lets it create a reservation, and nothing more

The push guard of [phase 43](../plans/phases/phase-43.md) lets a run push only to its own work branch. It now also lets any run **create** a ref under `refs/timone/numbers/`. It still refuses to move or delete one, and still refuses everything else. A step with no work branch may reserve too: that is harmless, and it keeps one rule for every step.

## Consequences

- Two runs never take the same number, and neither does a run and a person's own session, because they all go through the same remote.
- Taking a number needs the remote. A session that cannot reach it cannot write a numbered file until it can.
- The remote keeps one small ref and one small commit per number taken. Nothing ever cleans them up; they cost almost nothing.
- Numbers no longer follow the order in which pull requests merge. Phase 45 can merge before phase 44. So nothing may find "this branch's phase file" by taking the highest number on the branch; it is the phase file the branch added. The plan for this decision changes the two prompts that still say "the newest phase file".
- The forge must accept a push to a ref outside `refs/heads/` and `refs/tags/`. GitHub is expected to, for a GitHub App token with `contents: write`, but nothing in a test can show it. The first reservation on the real forge confirms it; if it is ever refused, the command says so and stops, by D3.
- A breakdown is named after its ticket and is not touched. A prototype branch is not touched either: creating a branch on the remote already fails when the name is taken.
