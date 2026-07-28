# Phase 09 — Verification Report (R21, R22)

- **Date:** 2026-07-28
- **Phase:** [phase-09.md](../phase-09.md) — sub-phase 09f
- **Scope:** PRD-01.**R21** (handover skill) and PRD-01.**R22** (human-readable status artifact). R13 and R17 are evidenced by 09e's dry run and its human gate, recorded there rather than here.
- **Repository:** Timone's own. Both requirements are about Timone's artifacts, not a managed project's.

## Verdict summary

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-01.R21 | SHOULD | human | **PASS** | 0 |
| PRD-01.R22 | MUST | human | **PASS after 2 fix loops** — final sign-off is fvermaut's, per the requirement's own hint | 2 |

## Independence declaration

This pass has an acknowledged independence problem and it is recorded rather than glossed: **the session running it also wrote several of the artifacts under test**, including both `STATUS.md` files. For R22 that is disqualifying for a self-assessment, so the requirement's own verification hint was used as the instrument instead — *"hand the file to someone who has never read `process.md`"*. Two **fresh naive-reader contexts** were given the two `STATUS.md` files and nothing else, forbidden to read any other file or to fill gaps from general knowledge, and asked what happens next, who has to do it, and which terms they could not decode. Neither was told what had changed between them. Their reports are the evidence below.

R21's checks are mechanical (file existence, section presence, git history) and independence does not bear on them.

## R21 — Handover skill: **PASS**

Both clauses hold.

**Clause 1 — a dated handover doc per scope, covering done / in flight / decisions / exact next action, pointing at artifacts rather than restating them.**

Meta scope, `doc/handover/` in this repository — five files:

| File | Sections | Artifact links |
| --- | --- | --- |
| `2026-07-19-founding-phases-01-04.md` | all six | 10 |
| `2026-07-19-phase-05-triage.md` | all six | 2 |
| `2026-07-20-phase-06-plan-and-mcp.md` | all six | 3 |
| `2026-07-25-phase-07-execute-skill.md` | all six | 2 |
| `2026-07-28-phase-08-verify-skill.md` | all six | 4 |

Every file carries the same six headings — Snapshot, Done this session, In flight / blocked, Decisions made this session, **Exact next action**, Open questions — which covers the clause's four required elements with two to spare. Project scope is also exercised: `doc/handover/2026-07-25-phase-01-and-02-executed.md` on `scratch-app`'s `phase-02-latency-smoke-check` branch. The clause is a disjunction (meta **or** project), so either alone would satisfy it; both exist.

**Clause 2 — the prior file is never deleted or overwritten, and the newest is clear by filename date.**

`git log` shows **exactly one commit per handover file** — none has ever been modified after creation. `git log --diff-filter=D` over both handover directories returns nothing: none has ever been deleted. Filenames are ISO-dated, so the newest sorts last.

## R22 — Human-readable status artifact: **PASS after 2 fix loops**

**The initial pass failed**, on the first and third criteria. Both fix loops are recorded because what they found is more useful than the verdict.

### Loop 1 — the two files contradicted each other, and both leaked jargon

The first naive reader's headline finding was not a wording problem:

> "the two files disagree about whether the delivery step exists. Timone says the pull-request stage 'doesn't exist yet' and is 'the next skill'; scratch-app says pull request #1 is open, dated two days after Timone's own header date, with exactly the two reviews Timone describes as unbuilt."

**This session created that contradiction.** 09e updated the managed project's `STATUS.md` as each run finished, while Timone's own was scheduled for 09g under the docs-last convention — leaving a live window in which the two halves of the picture disagreed. R22's own premise is that a stage leaving this file stale has not finished, so the window is a genuine finding against the sequencing, not just against the file.

It also found: stale counts inside Timone's file (`seven stage skills` in *Done* while *Just finished* announced the eighth; "two stages still have no skill" above a three-row table; "17 verified" alongside "two more now verified", irreconcilable from the file alone); four repository-less `doc/plans/phases/reports/…` paths, two of which pointed at a **different repository**; sentences written for someone who had been in the room ("the two contradicting rules are reconciled" — which two is never said); the file's central word, **skill**, never defined; and in the project's file, two **bare commit hashes**, an unnamed standards document, and "regressed" and "probe" used without gloss.

**Fixed:** Timone's `STATUS.md` rewritten in full — counts reconciled against the register (17 of 24, with the four pending named), a default-repository rule declared in the banner, every unnamed referent named, `skill` / `branch` / `merging` / `pull request` / `verified` glossed, and the contradiction resolved by bringing the file current instead of waiting for 09g. The project's file had its hashes, unnamed documents and unglossed terms replaced.

### Loop 2 — the status file is branch-local, and no branch had the whole picture

The second naive reader confirmed loop 1's fixes and found what they had masked:

> "Timone says there are **two pieces of work** on that repository; the repository's own file describes **one** … Read as the complete accounts they both present themselves as, they cannot both be true."

The cause is structural, not editorial. `STATUS.md` is version-controlled, so it is **per branch**:

| Branch | Mentions PR #2 | Status file present |
| --- | --- | --- |
| `main` | — | **no copy at all** |
| `phase-01-to-do-list-vertical` | no | yes |
| `phase-02-latency-smoke-check` | yes | yes |

The PR #2 update had been written on the phase-02 branch; the clone was checked out on phase-01; the reader saw the phase-01 copy. **A file written for the human that answers differently depending on what is checked out is broken for its purpose** — and the default branch, the one a human would most naturally open, has no copy at all.

**Fixed:** the phase-01 copy now carries the whole project — both PRs, the speed-limit decision, the stale standards line — with an explicit note that the file is stored per branch and that this copy covers the project rather than its own branch's slice. Remaining bare terms in both files were glossed (`the rulebook` → named as `process.md`, `the handover writer`, `no-opt-out tier`, `HUMAN-CHECK scripts`, `Next.js`, and the unstated "seven steps = phase 1" relationship), and both jargon keys were pruned of entries defining words their document never uses.

### What remains, and why this stops here

Two loops is the bound the process sets, and it is spent. Two items are recorded rather than fixed:

1. **The branch-local property itself is unresolved.** The fix makes each copy self-sufficient; it does not stop two branches drifting apart again, and it does not put a copy on `main`. A durable answer — whether `STATUS.md` belongs only on the default branch, or whether every stage that writes it must reconcile siblings — is a decision, not an edit, and it belongs to fvermaut and stage 9.
2. **Docs-last sequencing on Timone's own phases reopens the contradiction window** every time. 09f's remediation closed this instance by bringing Timone's file current mid-phase, ahead of 09g.

**The verdict is PASS, and the sign-off is not this pass's to give.** R22 is `Verify-via: human` and its hint names the test precisely: hand the file to a reader who has never read `process.md` and ask what happens next and who has to do it. Two proxy readers were used because this session could not be its own naive reader; both improved verdicts across the loops, and the second still answered "no" to the no-unglossed-jargon criterion on a pedantic reading. Iterating a third time would risk tuning the file to the proxy rather than to the reader it is for. **fvermaut answers the question, and that answer is the evidence.**

## Register changes

**None written by this pass.** R21 and R22 flip in 09g, together with R13 and R17, and only after fvermaut's gates — this report is the evidence they will be flipped against.

## Handed to the human

- **Answer R22's own test question from `STATUS.md` alone** — what happens next, and who has to do it. That is 09f's gate.
- **Decide the branch-local question** for `STATUS.md` (item 1 above). Repository: this one, and every managed project.
