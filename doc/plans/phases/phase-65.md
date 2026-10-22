# Phase 65: GitHub's squash merges are no longer blamed on a session — the commit check excuses every commit GitHub's servers built, whatever its parent count

> **Status:** Complete — see [reports/phase-65-complete.md](reports/phase-65-complete.md).

> **Companion phases:** none edits the same lines. The carve-out was added outside a phase file, in commit `0df9d93` ("fix: the provenance check stops reporting what nobody can fix"), and `isPlatformMerge` has not changed since. [Phase 64](phase-64.md) changed `checkRegisterClaims` in the same file, `src/daemon/hooks.ts`, a hundred lines below; it does not touch `checkProvenance` or `isPlatformMerge`. Governing decisions: [ADR-0019](../../adr/0019-timone-authored-commits-carry-a-provenance-trailer.md), because it is the rule `checkProvenance` enforces — every commit a session makes carries a `Timone-Stage:` trailer — and a commit no session made is outside it; [ADR-0027](../../adr/0027-a-guardrail-finding-is-addressed-to-the-session-that-caused-it.md), because a finding goes first to the session that caused it, so a false one costs an innocent session a round and asks it to rewrite published history.

> **Screens changed:** none — the change is in a check that runs at the end of a session; no slice changes anything a person sees on a screen Timone draws.

## Requirements

> **PRD:** [prd-02-inversion-of-control.md](../../specs/prd/prd-02-inversion-of-control.md) — criteria in [prd-02-inversion-of-control.criteria.md](../../specs/prd/prd-02-inversion-of-control.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-02.R15 | SHOULD | Post-session guardrail hooks report commits **made during the session** without a `Timone-Stage` trailer (clause 1), and stay silent for a clean session of either kind (clause 5). |

A squash merge GitHub made is not a commit made during the session, so reporting it breaks clause 1's scope and clause 5's silence. This phase claims those two clauses for this one false finding only. R15 stays `draft`: its own note lists what must be seen live before it can be `verified`, and this phase does not supply that.

## Goal Description

**What is wrong.** [timone#90](https://github.com/fvermaut/timone/issues/90): `isPlatformMerge` in `src/daemon/hooks.ts` excuses a commit only when it has more than one parent **and** its committer is `noreply@github.com`. GitHub's **Merge** button makes a two-parent commit when it merges, and a **one-parent** commit when it squashes. This repository squash-merges every pull request, so every merge is reported as a commit "made in this session" that "says nothing about where it came from", and the session is told to amend it — which would mean force-pushing `main`. The same fault was reported twice more: [#101](https://github.com/fvermaut/timone/issues/101) (sessions that only branched from `main` or moved onto `origin/main` were blamed for `308e75a`, `a55f81c`, `8e6c78e`, `332813f`) and [#231](https://github.com/fvermaut/timone/issues/231) (a session that ran `git pull --ff-only` was blamed for 11 squash merges, each with one parent and GitHub as committer). The ticket's author asked for #101 and #231 to close with this one.

**What this phase builds.** `isPlatformMerge` returns true when, and only when, `commit.committerEmail === "noreply@github.com"`. The parent-count clause goes. The committer carries the whole argument: `noreply@github.com` means GitHub's servers built the commit object, so no session could have put a trailer on it. A merge a session makes on its own machine has the session's committer, so it is still reported — the narrowness the old docblock wanted survives on the committer alone. The docblock is rewritten to say this, and to name the squash merge as the shape this repository uses. A unit test feeds the check a one-parent commit with GitHub as committer and expects silence; a test on real git reproduces #231: a commit built with GitHub as committer lands on the remote's `main`, the session's checkout pulls it, and the end-of-session check says nothing about it.

**What #101 and #231 asked for that this change does not give.** Checked at planning time, and stated here so the pull request can be judged on it:

1. **#231's second clause** — "or one that was on the remote before the session's own pull, is not reported" — is **not** covered for commits that GitHub did not build. If a person pushes a commit without a trailer straight to `main` from their own machine, and a session later pulls it, the session is still blamed. All 11 commits #231 lists, and all 5 #101 lists, were built by GitHub, so every commit actually seen is covered. Closing the rest is not a small change: `onDefaultBranch` is read when the session ends, so it is true both for a commit the session pulled and for one it wrote and pushed to `main` itself, and for a commit with no trailers there is nothing left to tell those two apart. Excusing every untrailed commit on `main` would also excuse a session that pushed an untrailed commit to `main` — the very finding the rule exists for. That is a trade-off with a real cost, and nobody has decided it; this phase does not decide it either. Sub-phase 65a pins today's answer with a test, so the limit is visible and a later change to it is deliberate.
2. **#101's first finding** — a squash merge buries the trailers of the squashed commits in the middle of its message, where git does not read them, so `main`'s history loses its provenance for every squash-merged pull request — is **not** fixed. This phase stops the check from *blaming* sessions for that; it does not restore the trailers on `main`. [ADR-0019](../../adr/0019-timone-authored-commits-carry-a-provenance-trailer.md)'s consequences say a squash merge "composes trailers from the squashed commits into one message" and that it does not lose provenance; what #101 observed contradicts that sentence. The ticket's author decided on 2026-10-07 that #101 closes with this ticket, so this is recorded here and not planned.
3. **#101's second finding** — "it should not attribute a commit to a session whose id is not in that commit" — is covered for every commit #101 names, because all of them were built by GitHub. The general rule (a commit naming **no** session is attributed to the session checking) is R15's recorded, deliberate limit of 2026-08-08 and is unchanged.

**Decisions taken here that did not reach an ADR.** (1) **The committer test is an exact match on `noreply@github.com`, not a suffix match.** A box session commits as `319428833+timone-agent[bot]@users.noreply.github.com`, and a person's GitHub address has the same `users.noreply.github.com` ending; both are made on a machine a session runs on, and both must stay reported. A test pins this. (2) **Any commit GitHub's servers built is excused, not only merges** — a squash, a merge commit, a rebase merge, and a file edited in GitHub's web page all have GitHub as committer and none could be stamped by a session. The ticket's author argued exactly this ("whatever its parent count"). The name `isPlatformMerge` is kept, so the diff stays one line plus its comment; the docblock says what it covers. (3) **`parentCount` stays on `CommitEvidence` and stays collected.** After this change no rule reads it. Removing it would mean editing the two existing tests the runner asked to keep, for no change in behaviour; its doc comment says no rule reads it since timone#90. Each of these is a few lines, undone by an edit, and the ticket settled the substance, so none passes the "hard to reverse" part of the test. **One residual, recorded:** a commit a session creates through GitHub's own API (not by `git push`) could carry GitHub as committer and would now be excused. Timone's runs do not create commits that way (`src/daemon/forge-guard.ts` refuses such calls aimed at the default branch, and the runs push with `git`), and such a commit only reaches this check if the session then fetches it.

**Regression set and what no criterion watches.** The diff touches `src/daemon/hooks.ts`, `src/daemon/hooks.test.ts` and `src/commands/guardrails.test.ts`. Derived from the register at planning time (MUST, `api`, `verified`, narrowed by `Depends-on`; a criterion with no `Depends-on` is always in): PRD-05.R2, R3, R4, R5, R7, R10, R11, R18; PRD-07.R4, R6, R9; PRD-08.R5; PRD-09.R2, R4, R5; PRD-10.R2, R3, R4, R5, R6. Verification derives it again from the register as it stands then. The `live` criteria that are `verified` and name `src/daemon/` (PRD-02.R1 ticket pickup, R2 target resolution, R4 PRD gate, R8 previews) name the whole folder; none of them exercises the provenance rule, so no live gate is owed. **What no criterion watches:** that the rule still fires on a commit a session made without a trailer, including a merge it made itself and a commit made with a `users.noreply.github.com` address. No criterion in the set reads the provenance rule. The existing tests "flags a commit that says nothing about where it came from", "still flags a merge a session made itself" and "flags a commit that carries no trailer at all" (real git), and 65a's new case for the bot's address, are therefore a hard gate.

**No triage record.** The ticket was classified as a bug on the ticket itself (comments of 2026-10-07 and 2026-10-22), and no file under `doc/triage/` was committed for it. No list of pieces exists for it on any branch either; it is one change, planned here as one piece. The runner's instructions for this step restate the classification and the scope; this plan follows them.

## Context & Prerequisites

- **`src/daemon/hooks.ts`** — `CommitEvidence` (lines ~28–59): `committerEmail?` with a doc comment naming "a merge the GitHub merge button made", and `parentCount?` ("Two or more means a merge"). `isPlatformMerge` (lines ~615–636) with its docblock, which sits **between** `checkProvenance`'s own docblock and `checkProvenance` itself; leave that order as it is. `checkProvenance` (line ~638) calls `isPlatformMerge(commit)` after the trailer test; that call does not change. `commitsOn` (line ~1145) already reads the committer with `%ce` and the parents with `%P`, so the real-git case needs no collection change.
- **`src/daemon/hooks.test.ts`** — `describe("checkProvenance")` (line ~1166). Helpers: `cleanEvidence()`, `projectRepo(evidence)`. Existing cases kept unedited, in particular "ignores a merge the GitHub merge button made" (two parents, GitHub committer) and "still flags a merge a session made itself" (two parents, `someone@example.com`).
- **`src/commands/guardrails.test.ts`** — real-git fixtures: `workspace()` builds a timone root and a clone of a bare remote at `projects/scratch-app` (the remote is `git -C <projectDir> remote get-url origin`); `bracket(root, sessionId, store, work)` takes the baseline, runs `work`, and stops twice, returning what was `printed` and the `first` stop's `returned` violations; `git(dir, ...args)` runs git with this process's environment. `describe("the provenance trailer, read back off real commits")` (line ~874) holds the two real-git provenance cases; new cases go in this block.
- **The box's git environment.** Inside a run's container `GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_*`/`GIT_CONFIG_VALUE_*` install a push guard, and `GIT_COMMITTER_EMAIL`/`GIT_AUTHOR_EMAIL` are set to the bot's address. With them in place, 45 of `guardrails.test.ts`'s cases fail on `main` because the fixture's `git push origin main` is refused (that is [#220](https://github.com/fvermaut/timone/issues/220)'s ground, not this phase's). Checked at planning time on `main` (`c5f0fc8`): with every `GIT_*` variable removed from the command's environment, `src/daemon/hooks.test.ts` and `src/commands/guardrails.test.ts` pass, 200 of 200. The validation steps below run them that way. Because `GIT_COMMITTER_EMAIL` may be set in the environment, the new real-git cases must set the committer **explicitly** for every commit whose committer they depend on, through the `env` of that one git call.
- **The runner's instruction:** run only the tests of the hooks while working — these two files.

## Sub-phases

### Sub-phase 65a: A commit GitHub built is excused whatever its parent count, and the check no longer blames a session for a squash merge it only pulled

**[MODIFY]** `src/daemon/hooks.ts`:
- `isPlatformMerge` body becomes `return commit.committerEmail === "noreply@github.com";`.
- Rewrite its docblock. It must say, in this order: a commit GitHub's servers built — the Merge button's merge commit, its **squash merge** (one parent, the shape this repository uses), a rebase merge, or a file edited on GitHub's web page — has `noreply@github.com` as committer; nothing can satisfy the rule for it, because no session made it and stamping it means force-pushing the branch it landed on (keep the existing sentence about rewriting published history, and the one about training a reader to ignore the check); the committer alone decides — a merge or any other commit a session makes on its own machine has the session's committer and is still reported, and so does a `…@users.noreply.github.com` address, which is a person's or a bot's, not GitHub's servers'. Add one dated line: `✏ 2026-10-22 (timone#90): the parent-count clause is gone. It excused GitHub's merge commits and missed its squash merges, which have one parent and are how every pull request here lands (#101, #231).`
- Doc comment of `CommitEvidence.committerEmail`: replace "on a merge the GitHub merge button made" with "on any commit GitHub's servers built, such as a squash merge". Doc comment of `parentCount`: keep "Two or more means a merge." and add "No rule reads it since timone#90."

**[MODIFY]** `src/daemon/hooks.test.ts` — new cases inside `describe("checkProvenance")`, existing cases unedited.

**[MODIFY]** `src/commands/guardrails.test.ts` — new cases inside `describe("the provenance trailer, read back off real commits")`, existing cases unedited. A small local helper may be added in that block (for example `gitAs(dir, committer, ...args)`, which runs git with `GIT_COMMITTER_NAME` and `GIT_COMMITTER_EMAIL` set in its `env` on top of `process.env`).

**Seams under test (TDD):** Two seams. `checkProvenance(evidence)` is the seam for the rule: it is exported, pure, and is what every rule test in `hooks.test.ts` already observes; `isPlatformMerge` is private and is not tested directly. The `Stop` hook's `runCheck`, driven through the existing `bracket` fixture on real git, is the seam for #231's sequence, because the fault there runs through collection (`collectRepo` sees local `main` move past its baseline tip) and through the committer read off `git log`, which no pure test covers. Red-green:

1. *(`checkProvenance`, the ticket's case)* One commit on `main`, `parentCount: 1`, `committerEmail: "noreply@github.com"`, `trailers: []` → `checkProvenance` returns `[]`. **Red before the code change.**
2. *(`checkProvenance`)* The same commit with no `parentCount` at all (evidence built before the field existed) → `[]`. Red before the change.
3. *(`checkProvenance`, the narrowness)* Two commits, each one parent and no trailers, committers `319428833+timone-agent[bot]@users.noreply.github.com` and `43007270+fvermaut@users.noreply.github.com` → one `provenance` violation whose detail names both shas. Green before and after; it fails if the match is ever loosened to an ending.
4. *(`checkProvenance`)* A list holding an untrailed one-parent GitHub commit and an untrailed one-parent commit by `someone@example.com` → the violation's summary says `1 commit(s)` and its detail names only the second sha.
5. *(real git, #231's sequence)* `bracket` with a work step that: makes a second clone of the project's remote (in the test's temp directory, standing for GitHub), commits one file there with committer `GitHub <noreply@github.com>` and the subject `Something (#12)` and no trailer, pushes it to the remote's `main`, then runs `git pull -q --ff-only` in `projectDir`. Expect: the first stop's `returned` holds no violation with `rule === "provenance"`, and `printed` does not contain `where they came from`. Also assert, inside the test, that the pulled commit has exactly one parent (`git rev-list --parents -n 1 HEAD` gives two words), so the case cannot pass by testing a merge. **Red before the code change.**
6. *(real git, the limit kept on purpose)* The same sequence, but the commit in the second clone has committer `Someone <someone@example.com>` — a person pushing straight to `main` from their own machine. Expect `printed` to contain `where they came from` and the commit's short sha. A comment above the case says this is the part of #231 this phase does not cover, and why (the paragraph "What #101 and #231 asked for" in `doc/plans/phases/phase-65.md`, point 1). Green before and after.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
cd projects/timone

# The tests of the hooks, with the box's git settings removed from this command
# only (see Context: the box's push guard otherwise refuses the fixture's pushes).
env $(env | grep -oE '^GIT_[A-Z0-9_]+' | sed 's/^/-u /') \
  npx vitest run src/daemon/hooks.test.ts src/commands/guardrails.test.ts; echo "exit: $?"
# expected: exit: 0

npx tsc --noEmit; echo "exit: $?"
# expected: exit: 0

# The new cases are there and named (counts the test titles, not prose):
npx vitest list src/daemon/hooks.test.ts src/commands/guardrails.test.ts 2>/dev/null \
  | grep -ciE 'squash|one parent|github'
# expected: more than 2 — on main (c5f0fc8) this prints 2, from two existing cases
# in hooks.test.ts ("ignores a merge the GitHub merge button made" and "reads the
# trailers GitHub's squash split into two paragraphs"); each new case whose title
# names GitHub, a squash or one parent adds one

# The parent count is no longer part of the rule — checked by the tests above,
# not by a grep: case 1 and case 5 are red if the clause comes back.
```

- [ ] Cases 1, 2 and 5 were seen **red** before the change to `isPlatformMerge` and green after; the handoff quotes the failing assertion for each.
- [ ] Cases 3, 4 and 6 are green, and the handoff says so; case 3 is shown red-capable by changing the match to `endsWith("noreply.github.com")` for one run and seeing it fail, then putting the exact match back.
- [ ] Every test that existed in the two files before this sub-phase is unedited and passes (`git diff origin/main -- src/daemon/hooks.test.ts src/commands/guardrails.test.ts` shows only added lines).
- [ ] `git diff origin/main --stat` lists `src/daemon/hooks.ts`, `src/daemon/hooks.test.ts`, `src/commands/guardrails.test.ts`, and under `doc/` only this phase's own handoff section.
- [ ] The docblock of `isPlatformMerge` names the squash merge, says the committer alone decides, says a `users.noreply.github.com` address is still reported, and carries the dated line for timone#90.

---

## Dependency graph

```
65a → (none)        excuse every commit GitHub built, whatever its parent count; tests for a one-parent GitHub commit, and for #231's pull on real git
```

One sub-phase, because the change is one line of behaviour and its tests; nothing in it can be built or reviewed apart from the rest. No documentation slice: the docblock is the documentation this rule has, and the register note for PRD-02.R15 belongs to the checking step.
