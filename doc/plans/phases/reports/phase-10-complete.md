# Phase 10 — Completion Report

- **Date closed:** 2026-08-02
- **Phase:** [phase-10.md](../phase-10.md) — approved 2026-08-01, **re-approved 2026-08-02** after the scope change recorded below
- **Theme:** the feedback stage — `timone-improve`, stage 9 of `process.md`
- **Requirement:** [PRD-01.R14](../../../specs/prd/prd-01-process-layer.criteria.md) — flipped to `verified` by fvermaut on the `human` channel, 2026-08-02

## What the phase delivered

| Sub-phase | Commits | Outcome |
| --- | --- | --- |
| **10a** — stage-9 spec | `cc7367e` | `process.md`'s one-paragraph stage 9 expanded to the ten decisions the plan specified; the register contradiction resolved as verdict transitions (stage 7's) vs intent transitions (stage 9's); `doc/feedback/NNN-<slug>.md` added to artifact conventions |
| **10b** — the skill | `5bc9489` | `timone-improve`, plus retirement of four stale "does not exist yet" concessions — two the plan named, two more of the same class found while checking |
| **10c** — dry runs and real intakes | `e057c50`, `3e8cf67`, `05f91aa`, `b869108`, `dd63f9f`, `6d2f2fa`, `b3aea9e`, `fb35332` | twelve dry runs, **four real intakes** against `scratch-app`, **seven correction rounds**, and one dispatch driven end to end to a pull request |
| **10d** — documentation and close | this commit | `README.md`, Timone's `STATUS.md`, R14 → `verified`, plus two process corrections the phase's own execution exposed |

## The scope change, and why the stamp was re-taken

The plan specified **six** remediation classes. Three of the four dry runs independently hit the same wall: the record layer had exactly one class, `report amendment`, defined over completion/verification/delivery reports — and the artifacts that actually misdescribed reality were `doc/standards.md` and `prisma/schema.prisma`. Two changes followed: `report amendment` widened to **`record correction`** over any committed process artifact, and a **seventh class, `verification pass`**, was added to dispatch to stage 7 the items only observed behaviour can settle.

Growing the plan that way voids its approval under stage 5's re-approval rule, and the ✏ marker recording it is dated a day after the original stamp and asks for agreement in its own text. **fvermaut re-approved on 2026-08-02, on the evidence rather than on the marker** — by then both the seventh class and the widened `record correction` had been exercised live on `scratch-app`, and the loop had closed at a pull request.

## The seven correction rounds

Every one came from running the thing, not from reading it.

| Round | The defect that mattered |
| --- | --- |
| 1 | The record layer had one class; three of four runs hit artifacts it could not reach |
| 2 | All four re-runs found the intent→verification-pass dispatch downgraded from an obligation to "say so in the record" |
| 3 | The layer question gave opposite answers on the highest-stakes item; two tiebreaks added |
| 4 | First real execution: **nothing was ever pushed** — a "committed artifact" nobody could open |
| 5 | The intent path, run live: an amendment **strips regression protection from work dispatched beside it** |
| 6 | A corrected file must defend itself to a reader who never opens `doc/feedback/` |
| 7 | `timone-plan` refused stage-9 refinements; `timone-verify` never said the app server blocks |

## Cross-stage corrections this phase caused

All because stage 9 sends work into stages written before it existed:

- **`timone-plan`** — the un-anchored path was scoped to "chore work triage routes here", so a refinement from a feedback record — the commonest thing stage 9 dispatches — had no branch and would have been refused. Also: "protected by the regression set" was asserted and never computed.
- **`timone-verify`** — never warned that `npm start` does not return. Two verifier contexts hung and died having written nothing.
- **`timone-deliver`, `timone-execute`, `timone-triage`** — stale existence claims.

## The four intakes, executed for real on `scratch-app`

| Record | Source | Outcome |
| --- | --- | --- |
| `001-completed-todos-reappear-after-reload.md` | triage 001 | closed **already resolved** — the record predates the build by six days; no dispatch, no PRD touch |
| `002-phase-01-delivery-review-findings.md` | PR #1's nine findings | 7 confirmed, 1 declined, 1 deferred with a trigger. **PRD-01.R6 amended in place**, `Status: revised`, register intent-transition in the same commit (`26aba7c`). Three dispatches |
| `003-extended-zod-deviation-cites-r2-r3.md` | PR #2 Spec finding 2 | record correction to `doc/standards.md` — the zod grant no longer claims requirement backing it never had |
| `004-stale-focus-after-delete-non-conformance.md` | PR #2 Spec finding 1 | record correction — a stale open non-conformance withdrawn; the finding's headline accused the wrong artifact and its own report's note reversed it |

## The loop closing — run 5

This is what the phase existed to produce. Feedback 002 item 1 (the cache-tag constant), bounded by fvermaut to that one item:

`doc/feedback/002` → **stage 5** (`phase-03`, its own approval gate, approved as written) → **stage 6** (`03e5ebf`, closed `79420b1`) → **stage 7** (`b52bfab`, clean first pass, 0 of 2 fix loops) → **stage 8** (`1442870`, [`scratch-app` PR #3](https://github.com/fvermaut/scratch-app/pull/3)).

**Stage 9 authored no code commit.** Both failure probes from the plan run clean: `git log --stat --grep "feedback" -- ':!doc' ':!STATUS.md'` lists no files, and no `.claude/` or `timone.yaml` path appears anywhere in the fixture's history.

Phase 03's verification also exercised the seam the plan cared about — how a `revised` criterion behaves in the regression-set *derivation*. It excluded `scratch-app` PRD-01.R6 correctly and showed the computation. See the known limit below.

## 10d's two additions beyond the plan

Both are process corrections this phase's own execution exposed, and both are recorded rather than folded in silently:

1. **`process.md` — every stage pushes what it commits.** The status-reporting section told every stage to commit `STATUS.md` and never said to push. Stage 8 pushes only because `gh pr create` refuses an unpushed branch — an accident of one tool. Observed three times in one day: stage 9's first live intake committed four records nobody could open, and a verification pass and a delivery pass each died between their commit and their push. The rule now says a stage that has committed and not pushed has not finished. **Not solved:** nothing enforces it.
2. **`timone-verify` — the allowed list could not discharge its own obligation.** Re-issuing a carried-forward HUMAN-CHECK script verbatim requires reading the prior verification report, which was not on the list. Phase 03's verifier read it, declared the line range, and argued it correctly — a stage-7 artifact carries evidence, never build knowledge. The list now says so, scoped to that section alone, in both the skill and `process.md`.

## Known limits, recorded not hidden

- **R14's criterion text is out of date.** It names six classes; there are seven. Rewriting the clause is an intent transition — stage 9's write on its own record, not stage 7's — and the change is a widening this evidence satisfies rather than contradicts. `process.md` stage 9 is the authority on the class list. Recorded as a marker on R14.
- **The `revised`-drops-out rule has a live case that does not discriminate.** `scratch-app` PRD-01.R6 left the derived regression set, but it is `browser`-channel and the derivation is `api`-only, so the `revised` status was never the load-bearing reason. Discriminating evidence needs a MUST + `api` + `verified` criterion to go `revised`; none exists yet.
- **`scratch-app` PRD-01.R6 is a MUST that nothing currently regression-checks**, and stays that way until the queued first-load-freshness phase re-verifies it against its new wording.
- **PRD-01.R7's screen-reader HUMAN-CHECK** on `scratch-app` remains unperformed and cannot be discharged by any agent. It is carried as an unticked item in PR #3.

## State left behind

- `scratch-app` PR #3 is **open and must not merge** without fvermaut. Its branch `phase-03-todos-cache-tag` is pushed and clean.
- PR #3 carries **two unactioned Standards findings** (`revalidateTodos`'s name; `todo-cache.ts`'s `server-only` exemption). Neither is queued; both route to `/timone-improve scratch-app phase-03 delivery review findings` if fvermaut wants them taken.
- `scratch-app`'s merged `phase-01-to-do-list-vertical` branch has still not been deleted — carried forward, unchanged.
