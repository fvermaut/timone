# Phase 13 — completion report

- **Date:** 2026-08-06
- **Plan:** [phase-13.md](../phase-13.md), approved for execution by fvermaut 2026-08-05 — after its two flagged process contradictions were settled at a pre-approval grill ([ADR-0015](../../adr/0015-branch-per-driving-unit.md), [ADR-0016](../../adr/0016-review-remediation-rides-the-verify-fix-shape.md)) rather than left for later.
- **Requirements delivered:** PRD-02 **R6, R7** → `verified`. **R11** stays `draft` with three of four clauses observed — its preview clause needs phase 14's R8. Evidence-limit notes on **R2, R10, R15** closed where 13h supplied the missing live halves.
- **Tests:** 435 green. `type-check` clean.

## What it does now

A ticket goes from raw text to a **merged pull request** without anyone naming a stage or a skill. After the plan gate, the daemon builds the approved phase slice by slice, a fresh session that never watched the build verifies it against the register, and delivery opens a PR carrying scope, verdict table and two independent reviews — then parks on the human's review. A concrete review comment is remediated, re-verified in full and folded into the same PR; a vague one gets a clarifying question. The merge completes and closes the ticket, and the queue promotes. A failed run has a supported way back: `timone retry`.

## Sub-phase outcomes

| # | Deliverable | Commit | Notes |
|---|---|---|---|
| 13a | PR surface of the ticketing seam | `7f11313` | Three capabilities; one merged thread |
| 13b | Pipeline back half + outcome markers | `5cd25dd` | `built` flips per-slice, a phase-12 test enforced it |
| 13c | The execution stage | `b7eedc9` | Found the resume trap (below) |
| 13d | The verification stage | `050e1b0` | The one prompt with no thread |
| 13e | The delivery stage | `2a4dfec` | The PR is the artifact checked |
| 13f | The review loop | `3349a77` | `remediation` stage per ADR-0016 |
| 13g | `timone retry` | `6dea898` | `failed → picked-up`, the only road out |
| — | Unattended sessions must not end awaiting background work | (13h fix) | Found live by the first delivery |
| — | Close the ticket when its journey ends | `f64bc27` | Requested by fvermaut at the gate |
| 13h | Live proof on `scratch-app` #6 | — | Below |
| 13i | Docs, register flips, this report | this commit | |

## 13h — what was actually observed

Against `projects/scratch-app`, `--once` per step, fvermaut in the loop.

| Step | Outcome |
|---|---|
| 1 — R6 execution | **Observed, after two honest refusals.** The session first refused to build on a stray commit (below), twice, with plain-language reports; after fvermaut's `move it and build` on the ticket it relocated the misplaced triage record to the default branch and built all five slices — one validated commit each, completion report, `Status:` flip, outcome marker. Guardrails clean on sessions that wrote real files (R2's containment clause and R15's placement rule finally non-vacuous). |
| 2 — recovery | **Observed three times, on real failures.** `timone retry` re-armed the run after both refusals and after the delivery defect — `.timone/state.json` was never hand-edited, closing 12g's gap with live evidence rather than the planned artificial kill. |
| 3 — R6 verification | **Observed.** A fresh session with a deliberately thread-less prompt verified against the register: clean first pass, 0 of 2 loops, report committed; a second full pass ran after the review fix, also clean. |
| 4 — R7 delivery | **Observed, after one live defect (below).** [PR #9](https://github.com/fvermaut/scratch-app/pull/9) from the work branch, referencing #6, scope + verdict table + both review axes in the body, delivery report committed before the PR opened, ticket linking back. |
| 5 — R11's loop, both sides | **Observed.** Concrete comment → `fix: review — derive-skeleton-row-height-from-row-classes` (`69760d9`), full re-verify (`18ea12f`), same PR refreshed (`a2419f1`), plain-words reply. Vague comment → a clarifying question naming the four things "spacing" could mean, flagging which are written agreements — and **no commit**, run re-parked directly. |
| 6 — terminal + promotion | **Observed.** Fixture #10 queued behind the open PR; the merge completed the run, the ticket was told and closed, and #10 started in the same cycle — R10's first live promotion. #10's afterlife exercised the gate-over-nothing rule: a nothing-to-plan chore failed rather than asking approval of a blank. |

`git log --stat --all` on scratch-app: no harness files, no timone internals; every `STATUS.md` commit on the default branch's first-parent line.

**Human gate:** passed — fvermaut confirmed the PR gave him what he needed and the review loop did what his comments asked ("all good"), after raising one change (ticket closure, adopted at the gate).

## What 13h found

- **An interactive session's stray commit blocked the build — and the daemon caught it.** fvermaut's R13 interactive test of 2026-08-05 (the email-alerts request) committed its triage record onto whatever branch the clone had checked out — #6's work branch — unpushed, unguarded, unnoticed. The execution session's pre-flight found it, refused to build on another conversation's material, and asked rather than tidied. **This is the strongest live evidence yet for the open question about interactive sessions leaving no trace and running no guardrails.**
- **The gate discipline held against a relayed decision.** fvermaut's first `move it and build` never landed on the ticket (a lost submit); the retried session checked the thread itself, found silence, and refused again rather than taking the orchestrating conversation's word for it. The ticket is the sole write-path for decisions, and the machinery would not accept a substitute.
- **An unattended session that ends "waiting to be notified" has ended.** The first delivery session launched its two review axes as background sub-agents and finished its turn expecting notifications; the reviews died with it and the stage produced nothing. The daemon's two-witness check failed the run rather than parking on a review of nothing (the 12f rule generalised, working). Fixed: every unattended work prompt now states that nothing survives the end of the turn, pinned by tests.
- **Tickets never closed.** Raised by fvermaut at the gate: a completed run told its ticket "this ticket's journey ends here" and left it open. The seam gained `closeTicket` — merged → `completed`, declined → `not-planned`, answered questions close too — recorded as a gate-approved amendment.
- **The resume path would have skipped execution entirely** (caught by 13c's tests before it could fire live): phase-11 parks recorded the stage that had run, 12f's parks the stage that couldn't — and the old resume asked "what follows?" for both, which would have sent #6 to verification over code nobody wrote the moment verification existed.
- **A benign wart:** when a gate-owing stage produces nothing, guardrails run twice (once in `runStage`, once in the failure path) and the second call logs "no baseline was taken". Harmless — the first call did the real check — but worth a tidy-up whenever that code is next open.

## Deviations from the plan

- **Step 2's artificial mid-run kill was not performed** — three real failures exercised `timone retry` instead, which is stronger evidence than a manufactured one. Consequence: a *crashed daemon* (as opposed to a failed session) still has no proven recovery path — a run left `active` by a process kill can be resumed by nothing, `retry` included. Carried to open questions.
- **The bounded verify-fix loop never fired live** — both passes were clean. The register note records the limit.
- **Two fixes landed outside the slice bodies** (the unattended-delegation prompt rule; ticket closure), each a dated ✏ amendment on the plan — the first scope-reducing, the second scope-growing with fvermaut's gate-time request as its re-approval.

## For the next agent

- **Phase 14 is previews** (R8, R12) — Docker stacks per PR, URL posted on the PR, refresh on push, teardown on close — which is also what lets R11 flip: its preview clause is the only one unobserved.
- **`scratch-app` #4 is still parked at triage** (`triage:bug`), waiting on stage 9's daemon path. Holds no project.
- **Open questions, updated:** interactive sessions leave no trace *and no guardrails* — now with live consequences (the stray commit), needs the marker-convention grill more than ever; a crashed daemon leaves a run `active` with no recovery path (`retry` covers `failed` only); the bot identity still needs a credential; only one conversation medium exists; R11's "(the improve skill)" parenthetical needs reconciling with ADR-0016 next time the requirement is revised.
