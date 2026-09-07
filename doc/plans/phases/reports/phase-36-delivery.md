# Phase 36 — Delivery Report

- **Date:** 2026-09-07
- **Phase:** [phase-36.md](../phase-36.md) — `Complete`, verified in [phase-36-verification.md](phase-36-verification.md)
- **Branch:** `timone/106-2-the-pull-request-carries-the-judgement` @ `0a9e670`
- **Base:** `main` — the project's default branch. The branch was cut from it, and phase 35's merge (`a030f69`) is already in its ancestry, so nothing is stacked and no other pull request must merge first.
- **Pull request:** opened against this report — the URL is on [ticket #106](https://github.com/fvermaut/timone/issues/106) and in the session's closing message.
- **Screen:** no user-facing screen in this phase — [ADR-0052](../../../adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md)
- **Departures:** [`phase-36-departures.md`](phase-36-departures.md) — 1 entry (the owed watched run was skipped on fvermaut's written decision).

## Scope

This phase delivers PRD-03.R2 and PRD-03.R4 (both MUST, both `Verify-via: live`) — see the [criteria register](../../specs/prd/prd-03-a-run-ends-at-its-pull-request.criteria.md). Driving ticket: [timone#106](https://github.com/fvermaut/timone/issues/106), piece 2 of [timone#103](https://github.com/fvermaut/timone/issues/103). The diff's subject is two instruction files: `.claude/skills/timone-deliver/SKILL.md` (the pull-request body now opens on the departures list and, when there is a screen, on its comparison and preview address; the pre-pull-request viewing gate is gone) and `process.md` (stage 8's note describes the same).

## How to try it

### Against the preview

This project has no preview configured for pull requests — the change is instruction text, not a running app. Use the local steps.

### On a local checkout

Setup is the repository's own (`CONTEXT.md`); nothing extra is needed for this phase.

1. Check out `timone/106-2-the-pull-request-carries-the-judgement`.
2. Run the phase's own validation greps from the repo root. The old gate must be gone (both exit 1):
   `grep -n "does not get a pull request until the human has seen" .claude/skills/timone-deliver/SKILL.md`
   `grep -n "seen and approved by" .claude/skills/timone-deliver/SKILL.md`
3. The new sections must be present (all exit 0):
   `grep -n "^## Departures" .claude/skills/timone-deliver/SKILL.md`
   `grep -n "^## The screen" .claude/skills/timone-deliver/SKILL.md`
   `grep -n "posts its address in a comment on this pull request" .claude/skills/timone-deliver/SKILL.md`
4. `process.md` must describe the new order (exit 0): `grep -n "PRD-03.R2\|PRD-03.R4" process.md` — and the old viewing sentence must be gone (exit 1): `grep -n "does not get its pull request opened until the human has seen" process.md`.
5. Read the pull request delivering this phase: its body itself opens on `## Departures` — the format under review, applied to itself.

## Verification outcome

Quoted from [phase-36-verification.md](phase-36-verification.md); 0 of 2 fix loops consumed.

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-03.R2 | MUST | live | LIVE-GATE | 0 |
| PRD-03.R4 | MUST | live | LIVE-GATE | 0 |

The verification pass found nothing wrong: the build is clean and all 1624 automatic tests pass. Both criteria can only be observed by a watched run against a real daemon, and none has ever run — so the report's gate did not pass. fvermaut decided on [ticket #106](https://github.com/fvermaut/timone/issues/106) on 2026-09-07 to open the pull request without that run; the decision is recorded as this phase's one [departure](phase-36-departures.md). PRD-03.R2 and R4 stay `draft`, `Last live gate: never`, and the watched run stays owed after the merge.

No HUMAN-CHECK scripts are outstanding.

## Standards review — phase 36

- **Read:** the diff range `origin/main...HEAD` (hunks of the two subject files); `.claude/skills/timone-deliver/SKILL.md` (full current content); `process.md` (changed stage-8 hunks, plus a search of the whole file for stale "look gate" references — none remain); `standards/code-smells.md`; tool configuration (`package.json` scripts, repo root listing — no ESLint/Prettier/markdownlint config exists, so nothing here is tool-enforced; `doc/standards.md` does not exist)
- **Diff:** `origin/main...HEAD` — 7 files, +441/−13 (subject: 2 files)
- **Findings:** 2

### 1. The PR body template mandates figurative and elliptical wording in human-facing text — Writing to the human (plain English, no metaphors)

- **Where:** `.claude/skills/timone-deliver/SKILL.md:189` and `:201` (new PR-body template hunk)
- **What:** The template requires, when no departures file exists, `the sentence "Nothing was bent building this phase." verbatim`, and closes the screen section with `No prior viewing: merging this pull request is the yes.` Both land in the pull request body — human-facing text. "Bent" is figurative (nothing is physically bent), "the yes" is a nominalized fragment, and "No prior viewing" is elliptical. The same file already has the plain wording for the same fact: the delivery report header (line 117) says *"none — the phase executed as planned"*. So the two templates also state one fact in two different vocabularies.
- **Why it matters:** The repo's first rule (CLAUDE.md / `process.md` "Writing to the human"): plain English in pull requests, say what a thing is, never what it is like, for a non-native reader. Instruction files may use process vocabulary, but text the instruction orders written **verbatim into a PR** is human-facing output, not instruction. This is also an Inconsistent-vocabulary signal (one concept — "no departures" — under two phrasings within the diff).
- **Suggested remediation:** Replace the mandated PR sentences with the plain forms, e.g. "The phase was built exactly as planned." and "Nobody has seen this screen before this pull request. Merging it counts as approval." — not applied here

### 2. Workflow step 2 still calls the platform gate "gate 4" and never checks the renamed screen gate — internal consistency (stale cross-reference)

- **Where:** `.claude/skills/timone-deliver/SKILL.md:255`, against the gate definitions the diff rewrote at `:40–45` and the fixed order at `:28`
- **What:** The diff renames gate 4 to "**4 — The screen**" and gives it a new mechanical refusal (no shell-slice comparison in the completion report → route to `timone-execute`), and it rewrites the adjacent workflow steps 7–11. But workflow step 2 still reads `Check gate 2 (completion stamp), gate 3 (verification report and its gate), gate 4 (GitHub binding and 'gh'), **in that order**` — labelling the platform gate (which is gate 5) as gate 4, and omitting the screen gate from the checklist entirely. An operator following the workflow never performs the completion-report check the diff just introduced. The mislabel predates this diff (gate 4 was the look gate on `origin/main` too), but the diff touched both ends of the contradiction without closing it.
- **Why it matters:** The skill file is the executable instruction; its workflow list and its gate list now disagree about what gate 4 is, and the gate order the file declares fixed ("1 → 2 → 3 → 4 → 5") is not the order the workflow walks. Inconsistent vocabulary / one concept under two names, inside one file.
- **Suggested remediation:** Rewrite step 2 as "Check gate 2 (completion stamp), gate 3 (verification report and its gates), gate 4 (the screen — the shell-slice comparison exists in the completion report), gate 5 (GitHub binding and `gh`), in that order." — not applied here

## Spec review — phase 36

- **Read:** `.claude/skills/timone-deliver/SKILL.md` (diff + current), `process.md` (diff + current stage-8 text), `doc/specs/prd/prd-03-a-run-ends-at-its-pull-request.md`, `doc/specs/prd/prd-03-a-run-ends-at-its-pull-request.criteria.md`, `doc/plans/phases/phase-36.md` (requirements header, lines 1–25)
- **Diff:** `origin/main...HEAD` — 7 files, +441/−13 (subject: 2 files)
- **Findings:** 2

### 1. The PR body carries a promise of the preview address, not the address, and the register was not amended to match — PRD-03.R4

- **Where:** `.claude/skills/timone-deliver/SKILL.md:199`; `process.md:46`
- **What:** R4's criterion reads "its body carries first-thing — alongside R2's departures — the preview address and the built-versus-reference comparison", and its verification hint requires "the PR body opens with the preview link". The amended template's screen section instead instructs: `**Preview:** <… otherwise "building now — the machine posts its address in a comment on this pull request as soon as it is ready, usually within a few minutes.">` — the address lands in a later comment, never in the body. `process.md:46` quietly weakens the criterion while citing it: "plus the preview address — **or where it will appear** (PRD-03.R4)". The criteria register in this range is untouched: R4 still says "the preview address", with no dated revision marker. The phase file's own header (line 5) acknowledges the cause — ADR-0021 means the address cannot be known at PR-open time — but the requirement text was left as written.
- **Why it matters:** As instructed, no delivery can ever satisfy PRD-03.R4's clause or its hint literally; a live gate reading the register as written should FAIL it. Either the instructions omit something the criterion demands, or R4 needed a stage-3 revision ("or where it will appear") in this same range — writing the softened wording only into `process.md` puts the normative text and the register in contradiction.
- **Suggested remediation:** Revise R4 in the criteria register (dated ✏ marker, per the register's own rules) to the "address, or where it will appear" wording the instructions implement — or have the daemon edit the address into the body's Preview line when the build finishes — not applied here

### 2. A new delivery refusal (missing shell-slice comparison) that no claimed requirement asked for — PRD-03.R1 (unclaimed), scope creep against R2/R4

- **Where:** `.claude/skills/timone-deliver/SKILL.md:43`; `process.md:46` (last sentence)
- **What:** The rewritten gate 4 adds a refusal path that did not exist in this form before: "**A phase with a screen carries exactly one refusal here: no shell-slice comparison at all.** … Refuse, and route to **`timone-execute`**". Neither claimed requirement asks for a refusal: R4 asks that the PR open without prior viewing; R2 asks that the body list departures. Meanwhile PRD-03.R1 — MUST, `verified`, `Depends-on` including `.claude/skills/timone-deliver/`, which this diff touches — says a run past its agreement "records the departure, adapts, and carries on; the run posts no question, enters no waiting state, and reaches a pull request". A run whose shell comparison was never recorded now stops short of its pull request instead of listing the missing artifact as a departure (a "check not run" is exactly a departure kind phase 35 built).
- **Why it matters:** Scope creep against the phase's claimed set (R2, R4), and it sits in tension with R1's no-stop clause on a dependency R1 declares — the change could regress a `verified` MUST requirement this phase says it does not touch.
- **Suggested remediation:** Either drop the refusal and write the missing comparison into the PR's departures section as a check-not-run entry, or record the refusal as a deliberate carve-out with R1's owner amending that criterion to name it — not applied here

## Notes

- This delivery was made by hand, at the timone root, after the ticket's run stopped twice at the same point and its own way out (`timone takeover`) refused. Those two faults are filed as [timone#116](https://github.com/fvermaut/timone/issues/116) and [timone#117](https://github.com/fvermaut/timone/issues/117); the retry loop is recorded on #117.
- The owed watched run is not gone: it stays owed after the merge, and the next change touching `src/daemon/` or `.claude/skills/timone-deliver/` will owe it again — a single watched delivery could discharge this phase's two criteria and the four others the verification report names in its "Live gates" section.
