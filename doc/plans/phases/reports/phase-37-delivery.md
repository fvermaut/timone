# Phase 37 — Delivery Report

- **Date:** 2026-09-07
- **Phase:** [phase-37.md](../phase-37.md) — `Complete`, verified in [phase-37-verification.md](phase-37-verification.md)
- **Branch:** `timone/115-daemon-resumes-a-parked-run-on-a-held-ti` @ `923849f` — code HEAD `ad00da4`; the departures record and this report sit on top of it
- **Base:** `main` — the project's default branch; the branch was cut from `origin/main` at `7b520be` and is not stacked on any unmerged phase
- **Pull request:** opened against this report immediately after it was committed; the URL is on [ticket timone#115](https://github.com/fvermaut/timone/issues/115) rather than here, so the branch does not gain a commit whose only content is a link
- **Screen:** no user-facing screen in this phase — the change is daemon code and its tests
- **Departures:** [phase-37-departures.md](phase-37-departures.md) — 1 entry: the watched run PRD-03.R1 owed was skipped on the human's written decision

## Scope

The phase claims one requirement: **PRD-03.R1, clause 3** — a held ticket's run stops rather than restarting on its own. The registration path already refused to start fresh work on a held ticket; the path that resumes a run already parked never read the hold at all, and on ticket timone#105 it restarted a held run. This phase adds the missing check to that resume path, ahead of the call that consumes the human's answer, so a held ticket's comment stays unread until the hold comes off. Driving ticket: [timone#115](https://github.com/fvermaut/timone/issues/115).

## How to try it

### Against the preview

This project has no preview configured for pull requests — use the local checkout steps.

### On a local checkout

Setup is the project's own: see [CONTEXT.md](../../../CONTEXT.md) / `README.md` for install. Then, from the checkout on this branch:

1. `npm run type-check` — exits 0.
2. `npx vitest run src/daemon/poll.test.ts` — 194 tests pass. The five new cases are in the `"pollOnce — resuming a run whose human answered"` block (a held ticket's parked run is not resumed, its answer is left unread, and lifting the hold lets the same answer resume it) and the `"pollOnce — a run parked on a pull-request review"` block (the path that ends a reviewed run is unaffected).
3. `npx vitest run src/daemon` — 1183 tests pass; nothing that used to work broke.

## Verification outcome

From [phase-37-verification.md](phase-37-verification.md) — 0 of 2 fix loops consumed:

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-03.R1 | MUST | live | LIVE-GATE — fresh gate owed | 0 |

No FAIL, no REGRESSION, no BLOCKED; the derived regression set was empty. The one open item was the owed watched run, and the departures record carries the human's decision to open the pull request without it.

No HUMAN-CHECK script is outstanding.

## Standards review — phase 37

- **Read:** `git diff origin/main...HEAD -- src/`; `src/daemon/poll.ts` (context around lines 1470–1510 and 2000–2110); `standards/code-smells.md`; `tsconfig.json`; `package.json` (scripts: `tsc --noEmit`, `vitest`; no ESLint or Prettier config exists in the repo). `doc/standards.md` does not exist — nothing project-local overrides the code-smell reference.
- **Diff:** `origin/main...HEAD` — 2 files (subject), +131/−3
- **Findings:** 1

### 1. Comment cross-references its sibling check by a hard-coded line number — Magic number or string

- **Where:** `src/daemon/poll.ts:2055–2056`
- **What:** The new guard's comment reads: `// A held ticket's parked run does not resume itself, the sibling of` / `// the registration-path check above (` `` `:1490` `` `)`. The referenced check (`if (ticket.labels.includes(HELD_LABEL)) continue;` at line 1490) sits roughly 570 lines above in a file of ~2900 lines that grows every phase; the reference happens to be correct only because this diff's own insertions landed below it. The file's established convention for cross-references is a named `{@link …}` (used at lines 169, 178, 184, 528, 669, 1354, and beside the referenced check itself, which points at `successorHeldBack` by name).
- **Why it matters:** Magic number or string — a bare literal carrying meaning inline at its use site. The line number will silently go stale on the next edit above it, leaving the comment pointing at unrelated code; it also breaks the file's own `{@link}` vocabulary for the same job.
- **Suggested remediation:** Replace `:1490` with a durable anchor — name the sibling check's surrounding context (e.g. "the registration-path refusal beside the `applyLabel` claim") or extract the shared `HELD_LABEL` test into a named predicate both sites call and `{@link}` it — not applied here.

## Spec review — phase 37

- **Read:** `doc/plans/phases/phase-37.md` (header, requirements, goal), `doc/specs/prd/prd-03-a-run-ends-at-its-pull-request.md`, `doc/specs/prd/prd-03-a-run-ends-at-its-pull-request.criteria.md`, `git diff origin/main...HEAD -- src/`, and the surrounding code in `src/daemon/poll.ts` (`resumeAnswered` at 2000–2105, the registration-path check at 1484–1490, the memoised thread reader at 2213–2244) and `src/daemon/poll.test.ts` (the two touched describe blocks)
- **Diff:** `origin/main...HEAD` — 2 files (subject), +131/−3
- **Findings:** 1

The guard itself is faithful to what the phase asked. It sits exactly where the phase's placement paragraph demands — after the review and conversation conclusion branches, before `resolveWait` (`src/daemon/poll.ts:2055–2062`) — so a held ticket's answer is left unread, and the delivered test "does not consume the answer while held, so lifting the hold resumes on it" proves that placement rather than assuming it. Neither conclusion branch is gated, as the phase's scope note requires, and the review-wait scope-guard test confirms `concludeReview` still ends a run on an already-held ticket. All five red-green cases from sub-phase 37a are present (case 2 is the pre-existing, untouched test at `poll.test.ts:578`; the `threadedAdapter`/`reviewAdapter` signature changes default to the old labels, so no existing fixture behaviour moved). The production diff is nine lines — guard plus comment — with no scope creep.

### 1. The criteria register carries no trace of clause 3's failure or this fix — PRD-03.R1

- **Where:** `doc/specs/prd/prd-03-a-run-ends-at-its-pull-request.criteria.md:9–16` (untouched by the range)
- **What:** The diff range changes `src/daemon/poll.ts`, `poll.test.ts` and files under `doc/plans/`, but not the criteria register. R1 still reads `Status: verified` with `Last live gate: phase-35-live-gate.md — 2026-09-07, … clause 3 PASS`, evidence the phase file itself says "watched clause 3's own mechanism (`concludeReview`) but never exercised this one". The register's own convention adds a dated ✏ note for events like this (it has two such notes on R1 already), and none was added for the witnessed clause-3 failure on the resume path or for this fix.
- **Why it matters:** PRD-03.R1 clause 3 — "the run stops rather than restarting on its own" — is the exact guarantee that failed live and that this phase repairs. The register is the formal record verification and planning read; as it stands, it asserts clause 3 verified on evidence that predates and does not cover the path just fixed. The phase leaves the *re-examination method* to verification, but the record of that re-examination (or of the gap) belongs in the register, and the range delivers none.
- **Suggested remediation:** add a dated ✏ note under R1 recording that clause 3 was seen to fail through the daemon's resume path (timone#115), that phase 37 closed the gap, and what evidence now backs the clause (this phase's unit tests, or a fresh live sighting if verification required one) — not applied here

## Notes

- This delivery was run by hand in an interactive session. The checking step had stopped to ask for the watched run instead of recording it as owed and carrying on; that stop is recorded as the second sighting on [timone#117](https://github.com/fvermaut/timone/issues/117), and the human's answer ("open the PR without it, by hand") is in the departures record.
- The watched run remains owed after the merge: this fix has never been seen working on a real daemon, and the next change touching `src/daemon/` owes the same run.
- Nothing is stacked; merge order is free.
