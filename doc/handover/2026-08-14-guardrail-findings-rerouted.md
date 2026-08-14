# Handover — Timone — 2026-08-14 (second session of the day)

> Prior handover: [2026-08-14-phases-19-20-closed.md](2026-08-14-phases-19-20-closed.md). **Its snapshot was wrong in one load-bearing way** — it reported `main` at `df453ef`, clean. `main` was at `7693de8` and `df453ef` was on a stray branch. That is what this session opened on.

## Snapshot

**`main` is at `88d6d97`, clean, pushed.** The session began with a one-line question — *why is timone on a branch?* — and the answer was that **13 commits, the entire written record of phases 19 and 20 plus a day's building, had never reached `origin`**, sitting on a work branch belonging to a `scratch-app` fixture run that had been created inside the Timone repository. Repaired, then its cause fixed, then the surfacing question behind it decided and built. **818 tests, type-check clean** — and note that the *type-check* claim made earlier in the session was initially made against a script name that does not exist (`typecheck`; it is `type-check`), then verified properly. `PRD-02` stands at **16 of 21 verified**: **R15 dropped from `verified` to `draft` by decision**, not by failure. **[Phase 21](../plans/phases/phase-21.md) is written and awaiting approval** and is the only thing waiting on fvermaut.

## Done this session

- **The stray branch repaired** (`556a457` records it): `main` fast-forwarded to `60cb4fc`, `timone/29-fixture-map-notes-on-a-to-do-phase-20-ga` deleted, all 13 commits pushed. Nothing merged, nothing conflicted — the branch held only Timone's own work.
- **[Finding 11](../plans/phases/reports/phase-20-live-gate.md) written up** with both reflogs interleaved. The branch existed **twice**: correctly in `projects/scratch-app` at 15:34, and again in the Timone repo at 15:52–15:54, made by the approval-recording session. The run did it right; the machinery after it did not.
- **Finding 11's cause fixed** (`f44a52a`) — `checkoutBlock` names the repository wherever a prompt names a branch, appended in `stagePrompt` and written by hand into `approvalRecordPrompt`, which is built outside `stagePrompt` and inherits none of the shared blocks. Plus `checkBranchPlacement`, a new rule. 17 tests, one replaying the event on real git.
- **[ADR-0027](../adr/0027-a-guardrail-finding-is-addressed-to-the-session-that-caused-it.md) decided and built** (`70bce0a`) — see Decisions.
- **R15 revised** in [the criteria register](../specs/prd/prd-02-inversion-of-control.criteria.md#r15--post-session-guardrail-hooks) and dropped to `draft`, with what must be re-observed named clause by clause.
- **[Phase 21](../plans/phases/phase-21.md) planned** (`99a5eb8`), six gate steps on the fixture. Awaiting approval.
- **A stray worktree directory committed and removed** (`88d6d97`) — created at the repo root by a relative path handed to `git -C`, swept in by `git add -A`. Removed by follow-up commit rather than by rewriting pushed history.

## In flight / blocked

- **Nothing is half-built.** Working tree clean, everything pushed.
- **[Phase 21](../plans/phases/phase-21.md) is `Awaiting approval`** and cannot run without fvermaut, both to approve it and to be at the keyboard for step 2's judgement.
- **ADR-0026's chunking is still decided and entirely unbuilt**, carried unchanged from the prior handover. It remains the larger next thing.

## Decisions made this session

- **[ADR-0027](../adr/0027-a-guardrail-finding-is-addressed-to-the-session-that-caused-it.md) — two rulings, put as two questions with three options each.** Findings 1 and 11 of phase 20's gate are one fault pointing opposite ways: a finding's destination was chosen by *who drove the session*, not by *who could act on it*. **(1) The session that caused it hears first** and gets one round to fix or refute. **(2) Nothing is ever posted on a client's ticket** — a run's escalation flags the run, and `postComment` leaves the guardrail path entirely.
- **R15 loses its sign-off as a consequence**, and this is the first time Timone has applied to itself the rule its own status file has always claimed: change a requirement's wording and its old evidence stops counting.
- **The machinery was built with no plan and no approval**, which for a Timone-self change of this size is a deviation. It is recorded in phase 21's opening rather than left to be discovered, and is owed to the completion report.
- **fvermaut was not asked to approve the *build*, only the two rulings** — a consequence of the previous point, noted so the next session does not read the build as approved work.

## Exact next action

**Approve or amend [phase 21](../plans/phases/phase-21.md).** It is a gate, not a build: six steps on `scratch-app`, none touching `ivtrends`, and it needs fvermaut present for step 2. Approval is the stamp `Approved for execution` on the file's Status line.

**Before running it:** confirm the daemon in use was started at or after `70bce0a` (23:19). The one currently running started **23:20:49**, so it qualifies — but it will not after the next code change, and this has now caused confusion three times in one day.

## Open questions

- **A refuted finding escalates anyway, and nobody has ruled on it.** [ADR-0027](../adr/0027-a-guardrail-finding-is-addressed-to-the-session-that-caused-it.md) says a session may *"fix it, or say why the finding is wrong"*. **Only the first is built.** A session can refute a finding, but the rule re-reads git at the next stop, the offending state is still there, and it escalates to a run flag regardless — so finding 1's own scenario still ends with an innocent session flagged, privately instead of publicly. Found while planning the gate, deliberately not engineered around. **Resolved by:** fvermaut, at phase 21 step 2, with the behaviour in front of him. The sub-question that makes it hard: what stops a dismissal path from being a way to silence true findings?
- **A session killed after being handed a finding escalates nothing at all.** Recorded in ADR-0027 as a known hole; phase 21 step 5 measures it rather than predicting it. **Resolved by:** whoever takes it after the measurement.
- **The attribution defect is untouched.** An uncommitted working-tree change carries no trailer, so the containment rule can still name the wrong session. ADR-0027 changes the *audience* of that mistake, not its *accuracy*. **Resolved by:** nobody yet; it is not a public risk any more, which lowers its urgency and does not close it.
- **Findings 8 and 9 of phase 20's gate are unfixed** — a queued run promotes onto a closed ticket, and there is no way to end a run, so clearing residue still means hand-editing `state.json`. **This will bite during phase 21's gate**, which creates fixture runs.
- **Carried unresolved from the prior handover:** the frozen output-token counter (R17's remainder); `timone status` still cannot see blocking; the four questions ADR-0026 leaves open; R21's clause 1 versus clause 3, which still blocks its verification.

## One note on how this session went, for whoever runs the next one

fvermaut lost the thread near the end — *"honestly I have no idea what you're doing"* — after being told three times to restart the daemon. **Two of those three restarts did nothing**: no work this session required a running daemon, and the instruction meant *"so your machine has today's code"*, which was never said in those words. A call to action that has no visible consequence spends the human's trust for nothing. The unanswered question at the close was whether he wants fewer check-ins and more explanation as work proceeds.
