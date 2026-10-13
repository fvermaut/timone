# Triage 004: the update step joins check-script conflicts, and finds ivtrends' check scripts and tests

- **Date:** 2026-10-13
- **Kind:** bug
- **Entry point:** timone-plan (stage 5), anchored on [PRD-07](../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md) R7
- **Source:** issue #234, with issue #235 folded in; decided by fvermaut in the takeover session of ivtrends#201 on 2026-10-13

## Request

Issue #234, *The update step cannot finish a merge when main and the branch both changed a check script*:

> On ivtrends#175 (run ivtrends#175/1, 2026-10-08, update step that ended about 11:37Z), the step that brings the branch up to date with main stopped the merge. Pull request ivtrends#183 (merged into main) and the branch of PR ivtrends#184 both changed the check scripts for PRD-18.R12 and PRD-18.R13. The update step is not allowed to open check scripts, so it could not join the two versions. It aborted the merge, even though the other three conflicts could be resolved. The step reported "succeeded". The runner may start nothing more after an update, so the only way on is a person merging by hand. Either the update step should be allowed to merge check-script conflicts where both sides are already-accepted versions, or there should be a defined next step that may do it. Record: doc/plans/phases/reports/phase-60-update.md on branch timone/175-2-the-board-s-settings-menu-the-title-in.

Issue #235, *On ivtrends the update step finds no check script and no test command*, folded into the same piece of work by fvermaut's decision 2 below:

> On ivtrends#175 (pull request ivtrends#184), on 2026-10-08, `node dist/cli.js update-checks ivtrends` said that no requirement of phase 60 or phase 63 has a check script, and that the project has no test command. Both answers are wrong for what an update needs.
>
> - ivtrends names its check scripts with a dash before the R, for example `prd-18-r12.mjs`. `checkScriptOf` in `src/update-checks.ts` looks only for a dot, `prd-18.r12.mjs`, which is how Timone names its own. So on ivtrends an update never runs a check script.
> - ivtrends has no `scripts.test`. It has `test:unit`, `test:integration` and `test:e2e`. So every update on ivtrends writes "none — the project has no test command" and ends as "does not pass", with no test run.

## What has been seen

The update stopped on a check-script conflict eight times, on five ivtrends tickets: #175, #176, #194 (twice), #197 (twice) and #201 (twice). Three of them, #175, #176 and #194, were finished by hand in a takeover. The comments on #234 list each one. The conflicts came in three shapes:

1. **Each side added its own checks to one script** (#175, #176). The join keeps both.
2. **Both sides fixed the same check in two different ways** (#194, then #201 again on the same script for PRD-17.R3). The join kept the version that fails wherever the other one would.
3. **Two pieces of one breakdown each wrote a whole script for a requirement they share** (#201: PRD-23.R8 and R9, shared by #201 and #202). git reports both files as added on both sides, and the two have no line in common. The join puts both into one script, each as its own part, and keeps every clause of both.

## fvermaut's decisions

Asked in the terminal on 2026-10-13, in the takeover session of ivtrends#201 (answered before 12:37Z). He first chose to fix Timone before finishing ivtrends#201's update, instead of having the session join the files by hand as on #175, #176 and #194. Then:

1. **Who joins a check-script conflict:** *"That same session."* The update session already opens the check scripts, because it runs them (the guard lets it: `update` is in `CHECKING_STAGES` in `src/daemon/probeGuard.ts`). From now on it also joins a conflict in a check script, and nothing else, with its own hands:
   - it keeps every check from both sides;
   - when both sides changed the same check in two ways, it keeps the one that fails wherever the other would;
   - when it cannot tell which one is stricter, it does not guess: it stops the merge, as today, and the record says which check and why;
   - the record entry says which check scripts it joined and how.

   A conflict in any other file still goes to a fresh fix context that never sees the check scripts. Nothing changes for that context.

   Options he was shown and did not pick: a second fresh helper that may open only the check scripts; a full check step after the update that rewrites them.
2. **#235 is fixed in the same piece of work:** *"Yes, together."* Without it, an update on ivtrends finds no check script and no test command. A joined check script would then never be run, and every ivtrends update says "does not pass" even when every test passes.
3. **Who builds it:** *"The machine."* This ticket is marked for the daemon, which plans, builds, checks and opens a pull request on Timone for fvermaut to merge.

## Rationale

A bug, not a feature. [PRD-07](../specs/prd/prd-07-several-tickets-of-one-project-at-once.md) already says what an update must do: "The machine fixes any conflict," and R7 clause 2 says that once the branch is level, the update runs the whole test suite and both tickets' check scripts. With a check-script conflict, the update never brings the branch level, so none of that happens; and on ivtrends, because of #235, it runs neither the test suites nor any check script even when the merge is clean. The product's required behaviour does not change, so no requirement has to be rewritten. What has to change is a decision: [ADR-0066](../adr/0066-the-update-is-a-step-the-runner-starts-when-an-open-pull-request-falls-behind.md) D4 says the update session "never edits code itself" and sends every conflict to a fix context told never to open the probe folders. Decision 1 above narrows that for check scripts only, so planning records it as an ADR that amends ADR-0066 D4, and changes `.claude/skills/timone-update/SKILL.md` and `process.md` to match. In `process.md` that is two places: the update paragraph ("It does not fix code itself. A conflict or a failing test goes to a fresh fix context"), and the probe rule of verification ("only stage 7 writes there"), which a join by the update now departs from. Every question that would have needed an interview is answered above, so the interview is skipped and the work goes straight to planning, anchored on PRD-07 R7.

Related, and left out of this piece: #240 (after an update, the check scripts of the work that arrived compare that work with itself). A joined script that compares with "the build before" meets the same fault, so the plan should say how a joined script is run after the merge.
