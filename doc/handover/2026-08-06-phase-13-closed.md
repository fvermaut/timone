# Handover — Timone — 2026-08-06

> Prior handover: [2026-08-05-phase-12-closed.md](2026-08-05-phase-12-closed.md) — its "Exact next action" (plan phase 13) is **done**, as is the phase itself; read this file instead.

## Snapshot

**Phase 13 is complete and signed off.** A ticket now travels from plain language to a **merged, closed pull request** with the human's only inputs being answers, approvals, review comments and the merge: the daemon executes the approved phase slice by slice, a thread-less fresh session verifies against the register, delivery opens the PR with both review axes, review comments are remediated per ADR-0016 (fix → full re-verify → same PR) or clarified without a commit, and the merge completes the run, closes the ticket and promotes the queue. `timone retry` is the supported way back from a failed run. **PRD-02 R6 and R7 `verified`; R11 three-of-four clauses observed, `draft` until phase 14's previews; R2/R10/R15 evidence limits closed.** 435 tests green, `type-check` clean, `main` pushed.

## Done this session

- **Phase 13 planned, grilled, approved and executed in one arc.** The plan's two flagged process contradictions were settled *before* approval: [ADR-0015](../adr/0015-branch-per-driving-unit.md) (the branch belongs to the driving unit of work) and [ADR-0016](../adr/0016-review-remediation-rides-the-verify-fix-shape.md) (a concrete review comment is confirmed intake; remediation rides the verify-fix shape). `process.md` stages 6 and 9, `timone-execute` and `timone-improve` amended to match.
- **13a–13g built TDD-red-first, one commit each** ([completion report](../plans/phases/reports/phase-13-complete.md) has the table): the PR adapter surface, the pipeline back half with outcome markers, the execution/verification/delivery stages judged by artifact + marker (never exit code), the review loop with its `remediation` stage, and `timone retry`.
- **13h passed live on `scratch-app` #6**, fvermaut in the loop — including two refusals over a stray commit an interactive session had left, three real `retry` recoveries, both sides of the ADR-0016 boundary, and R10's first live queue promotion.
- **Two defects found live, fixed, and recorded as plan amendments:** an unattended session ending while "waiting to be notified" of background sub-agents (prompts now say nothing survives the turn), and completed tickets never closing (the seam's eighth capability, `closeTicket` — raised by fvermaut at the gate).

## In flight / blocked

- **`scratch-app` #4 remains parked at triage** (`triage:bug`), waiting on stage 9's daemon path. Holds no project.
- Nothing else is in flight; the ledger's only other runs are terminal.

## Decisions made this session

- **[ADR-0015](../adr/0015-branch-per-driving-unit.md)** and **[ADR-0016](../adr/0016-review-remediation-rides-the-verify-fix-shape.md)** — see above; both grilled pre-approval, the 12e lesson applied early.
- **A stage is judged by its artifact and its recorded outcome, never an exit code** — ADR-0014 extended from gates to outcomes (markers `STAGE_DONE_MARKER` / `STAGE_HANDED_MARKER`, cross-checked per stage: the phase file's `Status:` flip, the verification report, the PR itself).
- **A reply-only remediation re-parks directly** rather than riding verify → deliver: a clarifying question changes nothing, and the `producedWork` branch-tip evidence is what separates the paths.
- **Merged and closed-unmerged are terminal events on the run, not stages**; both close the ticket (`completed` / `not-planned`).

## Exact next action

**Plan phase 14: Docker previews** (PRD-02 R8, R12 — and the flip of R11's last clause), hand-planned as ever. The PRD's open question "preview exposure: localhost vs reverse proxy" must be settled when building R8 — likely a short grill first. `scratch-app` merged work is ready to serve as the first previewed PR's base whenever the next ticket arrives.

## Open questions

- **Interactive sessions leave no trace and no guardrails — now with live consequences:** the stray email-alerts commit that blocked the build came from fvermaut's own interactive R13 test. The marker-as-convention grill is overdue.
- **A crashed daemon has no recovery path:** `timone retry` covers `failed` runs; a process killed mid-session leaves the run `active` forever, resumable by nothing. Worth a slice in a future phase.
- **The bounded verify-fix loop has never fired on the daemon path** (both live passes were clean) — recorded as a register limit, not a gap to manufacture evidence for.
- **R11's "(the improve skill)" parenthetical** predates ADR-0016 — reconcile at the requirement's next revision (stage 9 record item).
- Carried unchanged: the real bot identity (needs a credential); only one conversation medium behind the R14 seam; the deferred PRD-01 list; `scratch-app`'s screen-reader HUMAN-CHECK and the guessed 2 ms latency budget; a benign double guardrail call on gate-failure paths (tidy when next open).
