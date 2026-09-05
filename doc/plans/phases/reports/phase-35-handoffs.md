# Phase 35 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 35a — The daemon can tell a build stage from any other, and a stray escalation from one is a failure, not a park

**Built.** A pure `inBuild(stage)` fact on the stage graph, and a branch in `afterStage` that reads it: an escalation at `execution`, `verification` or `delivery` now fails the run (`store.fail`, reason prefixed and carrying the escalation comment's own text, no wait left on the run) instead of parking it on a person. Every other stage — `requirements`, `breakdown`, `remediation`, every discovery/triage stage — keeps ADR-0033's park-and-wait behaviour byte-for-byte. `timone status`'s CTA for a failed run now recognises the new reason prefix and reports it as the machine's own defect (a question it should not have asked), with the standing `timone retry <project>#<ticket>` command and no "waiting on you" wording — checked ahead of, and worded differently from, the existing `technicalFault` branches.

**Files touched.**

- `src/daemon/pipeline.ts` — added `inBuild: boolean` to `StageFacts`; set `true` on `execution`, `verification`, `delivery`, `false` on the other nine stages (including `remediation`, called out explicitly since ADR-0016 could make it look like a build stage and it is not one); added `export function inBuild(stage)` beside `ownsBranch`/`isBuilt`.
- `src/daemon/session.ts` — imported `inBuild` from `pipeline.ts` and `BUILD_ESCALATION_PREFIX` from `faults.ts`; added `failBuildEscalation(store, id, stage, outcome, log)` beside `escalate`; `afterStage`'s `outcome?.kind === "escalated"` branch now calls `failBuildEscalation` when `inBuild(stage)` is true and `escalate` otherwise; updated the branch's comment to name ADR-0052's carve-out alongside ADR-0033.
- `src/daemon/faults.ts` — added `BUILD_ESCALATION_PREFIX` (the constant `"a build stage escalated: "`) and `isBuildEscalation(failure)`, a classifier separate from `TechnicalFault` (it is a stage behaving wrongly, not the machine's infrastructure breaking). Placed here, not in `session.ts`, so `cta.ts` can read it without importing the module that loads the agent SDK — the same boundary `technicalFault` already exists to keep.
- `src/daemon/cta.ts` — imported `isBuildEscalation`; in the `failed`-run branch, added a check for it ahead of the `technicalFault` call, returning a CTA worded as the machine's own defect (`waitingOnYou: false`, `command: timone retry <project>#<ticket>`).
- `src/daemon/pipeline.test.ts` — added a new `describe("inBuild", ...)` block: true for the three build stages, false for every other declared stage (including `remediation`), and an exhaustiveness sweep over `PIPELINE_STAGES`.
- `src/daemon/session.test.ts` — rewrote the existing verification-stage test (`"stops on a person, not on an answer, when it cannot use the one it was given"` → `"fails the run rather than parking it, when it cannot use the answer it was given"`) to assert `failed`/`run.failure` instead of `parked`/`escalation`, since `verification` is now a build stage. Added a new regression-guard test in `"the requirements gate"` block asserting an escalation at `requirements` still parks with `wait.kind === "escalation"`, unchanged.
- `src/daemon/cta.test.ts` — added a test in the `"ctaFor — a run the machine broke itself"` block asserting the new branch's headline, `waitingOnYou: false`, absence of "waiting on you" wording, and the retry command.
- `doc/plans/phases/reports/phase-35-handoffs.md` — created (this file).

**Decisions taken inside the slice.**

- Reason-string prefix: `"a build stage escalated: "` (exported as `faults.ts`'s `BUILD_ESCALATION_PREFIX`), followed directly by the escalation comment's own `body` text — no reformatting.
- `failBuildEscalation` posts no comment to the ticket, mirroring `escalate`'s own documented choice ("Nothing is posted. The stage's comment is the account.") — the escalation session's own comment, already on the ticket, is the record; `ctaFor` is what turns `run.failure` into what a human reads.
- The classifier (`BUILD_ESCALATION_PREFIX` / `isBuildEscalation`) lives in `faults.ts`, not `session.ts`, specifically so `cta.ts` — read by `timone status` without loading the agent runtime — can check it without importing `session.ts`. This mirrors `technicalFault`'s own existing placement and its documented reason.
- `isBuildEscalation` is a function separate from `TechnicalFault`, per the plan's explicit instruction: this is a stage behaving wrongly, not the machine's own infrastructure breaking, so it does not become a fourth `TechnicalFault` variant.
- CTA wording: headline "I asked a question inside the build that I had no business asking, so I stopped."; `needFromYou`: "nothing on this ticket — this is mine to fix, and this command starts me again." Chosen to match the shape (headline stating what happened, command-first `needFromYou`, `waitingOnYou: false`) of the `credentials`/`expired`/`link` branches immediately above it in `cta.ts`, without borrowing their login/connection language.
- `remediation`'s `inBuild: false` is called out with an inline comment in `pipeline.ts`, since ADR-0016's carve-out (coding on a live pull request) could read as build-like; the plan's own stage list excludes it, so it stays on ADR-0033's path.

**Validation evidence.**

Red-green trace:

1. `inBuild` — no separate red/green cycle: the accessor was implemented directly (it is a one-line pure lookup guarded by the compiler's `Record<PipelineStage, StageSpec>` exhaustiveness, so there was no meaningful failing state to observe beyond a type error). Tests were written immediately after and passed on first run (`npx vitest run src/daemon/pipeline.test.ts` → 67 passed, including the new `describe("inBuild", ...)` block).
2. Case 2 (build-stage escalation fails the run) — rewrote the verification test's assertions first, ran it against the *unmodified* `session.ts`: **RED**, `AssertionError: expected 'parked' to be 'failed'`. Implemented `inBuild` import, `failBuildEscalation`, and the `afterStage` branch; reran: **GREEN**.
3. Case 3 (requirements still parks) — wrote the new regression test against the *unmodified* `session.ts` first (before the session.ts edit): it passed immediately (**GREEN from the start** — this is the guard that the non-build path is untouched, so it never needed to go red; confirmed again after the session.ts change, still green). One test-setup bug found and fixed along the way: the fixture I first reused (`settled`, carrying a comment dated 2026-08-03) predated the fake adapter's own posted-comment clock (fixed at 2026-08-02T11:00 onward), so the escalation comment read as *before* the outcome cursor and went undetected — not a production bug, a test-fixture collision. Fixed by using a bare `{ ...thread, labels: [...] }` fixture with no seeded comment.
4. Case 4 (daemon-mechanical parks unaffected) — read `RunStore.reclaim()` (`src/daemon/runs.ts`, its dead-holder path around line 1278) and `boundRefusal` (`src/daemon/poll.ts:994-1019`): both call `store.park(...)` directly with `kind: "escalation"`, never through `session.ts`'s `escalate`/`afterStage`. Ran the existing coverage rather than duplicating it: `npx vitest run src/daemon/runs.test.ts -t "reclaim"` → 5 passed; `npx vitest run src/daemon/poll.test.ts -t "refus"` → 7 passed. Both green, confirming this slice's change reaches only the outcome-driven check in `afterStage`.

Validation block:

```
$ npm run build && echo "build exit: $?"
> timone@0.1.0 build
> tsc
build exit: 0

$ npx vitest run src/daemon/pipeline.test.ts src/daemon/session.test.ts src/daemon/cta.test.ts
 ✓ src/daemon/pipeline.test.ts (67 tests) 6ms
 ✓ src/daemon/cta.test.ts (64 tests) 5ms
 ✓ src/daemon/session.test.ts (156 tests) 189ms
 Test Files  3 passed (3)
      Tests  287 passed (287)

$ npx vitest run src/daemon
 Test Files  21 passed (21)
      Tests  1179 passed (1179)
```

Checkboxes:

- [x] `inBuild` exhaustive over `PIPELINE_STAGES` — compiler-enforced (`Record<PipelineStage, StageSpec>`; a stage missing `inBuild` fails `tsc`, verified by removing one during development and watching the build error, then restoring it) and test-asserted (`describe("inBuild", ...)`'s exhaustiveness sweep).
- [x] Both legs of case 2 and case 3 pass, red before green — case 2 traced above; case 3 was green from the start by design (a regression guard, not a new behaviour), which is consistent with "unchanged from today" in the plan's own case 3 wording.
- [x] Case 4 passes unmodified against the existing `reclaim`/`boundRefusal` tests, confirming no daemon-mechanical path changed.
- [x] Full daemon test suite green: `npx vitest run src/daemon` → 1179 passed, 21 files.

**What 35b must know.** `doc/plans/phases/reports/phase-35-handoffs.md` is created at this path with the header shown above; 35b appends its own `## 35b — ...` section below this one, does not recreate the header. No dependency from 35b on this slice's internals beyond what's importable: `inBuild` from `pipeline.ts`, `BUILD_ESCALATION_PREFIX`/`isBuildEscalation` from `faults.ts`, and `failBuildEscalation` (private to `session.ts`, not exported — if 35b needs the same fail-vs-park dispatch elsewhere, use `inBuild(stage)` directly rather than reaching for this function). One gotcha worth flagging: the fake adapter's `postComment` in `session.test.ts` stamps a fixed synthetic clock starting at `2026-08-02T11:00:00Z`; any fixture seeded with a comment dated after that (like the existing `settled` thread, dated 2026-08-03) will cause anything relying on `outcomeCursorFrom`/`readStageOutcome` to miss a comment posted during a test's `work` callback. Use a bare `thread`-derived fixture with no seeded comments when a test needs to post and then have the outcome read back.
