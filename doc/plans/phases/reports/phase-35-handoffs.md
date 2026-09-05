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

## 35b — Execution amends the plan and the register itself, records what it bent, and never stops for it

**Built.** `timone-execute`'s own skill instructions (`.claude/skills/timone-execute/SKILL.md`) now say what ADR-0052 requires: gate 2 (undeclared seams) and gate 3 (reality contradicts the plan) no longer stop the run and route to `timone-plan`. Each now has the execute session amend the phase file (or the criteria register, for gate 3's contradicted-requirement case) itself, in place, with a dated marker naming the run — `✏ <date> (build, timone#<ticket>): <what changed and why>` — append one entry to a new per-phase departures record, and carry on against the amended text. The two-attempt validation failure at "The transition gate and escalation" no longer stops the whole run either: it records both attempts and what was done instead (best-effort state naming what's unmet, or an openly-recorded workaround) in the departures record, commits, and starts the sub-phase's dependents. The shell slice's look-check failure funnels into this same updated handling. Gate 1 (agreement) is untouched — it still stops and routes, as ADR-0052 leaves it. A new "The departures record" section documents the `phase-NN-departures.md` convention (created on first departure, appended thereafter, one dated entry per departure) that all three of these paths write to, and the completion report template gained a header-level `**Departures:**` bullet pointing at it, alongside — not replacing — the existing "Deviations from the plan" section.

**Files touched.**

- `.claude/skills/timone-execute/SKILL.md` — ten edits: the "three gates" framing paragraph, gate 2's body, gate 3's body, the "which gate fires when" sentence right after both gates, the two-attempt failure paragraph under "The transition gate and escalation", the shell slice's look-check failure sentence, a new "## The departures record" section inserted between "The transition gate and escalation" and "## Handoff-note template", a new `**Departures:**` bullet in the completion-report template, and two Workflow-section sentences (step 3, and the "Gate 3 sits over steps 4–6" sentence) brought into line with the same change.

**Decisions taken inside the slice.** None beyond the plan's literal instruction — all ten edits were supplied verbatim by the orchestrator as exact OLD/NEW text, and each OLD block matched the file's actual text exactly before replacement, so no wording judgement calls were needed. The four consistency-fix edits (the gate-framing paragraph, the "which gate fires when" sentence, and the two Workflow-section sentences) were each a separate restatement elsewhere in the same file of gate 2/3's old stop-and-route behaviour; left alone they would have contradicted the six plan-named edits, so they were corrected as the plan's own scope discipline section required.

**Validation evidence.**

```
$ grep -n "hand to the human\|route to \`timone-plan\`.*re-enter" .claude/skills/timone-execute/SKILL.md; echo "exit: $?"
exit: 1

$ grep -n "phase-NN-departures.md" .claude/skills/timone-execute/SKILL.md; echo "exit: $?"
67:**2 — Undeclared-seams gate.** ... phase's departures record (`phase-NN-departures.md`, defined below in *The departures record*) ...
71:**3 — Reality-contradicts-the-plan gate.** ... phase's departures record (`phase-NN-departures.md`, defined below in *The departures record*) ...
169:**Failure → at most two attempts, then record and carry on.** ... phase's departures record (`phase-NN-departures.md`, defined below in *The departures record*) ...
175:✏ Added [ADR-0052](...). Every departure this stage records ... goes to one file: `projects/<name>/doc/plans/phases/reports/phase-NN-departures.md`. ...
248:- **Departures:** `phase-NN-departures.md` — N entries, or *none — the phase executed as planned*.
exit: 0
```

Checkboxes: first grep exits 1 — pass. Second grep exits 0 — pass. `timone-adr` authority sentence at the end of gate 3's paragraph is present, unchanged — pass. The completion report's new `**Departures:**` bullet sits alongside the untouched "## Deviations from the plan" section, not replacing it — pass. Read the whole file end to end after editing: headings intact, all fences balanced (the new entry-template fence, the untouched handoff-template fence, and the untouched completion-report-template fence all open and close correctly).

**No behaviour-carrying code in this sub-phase** — documentation-only change to one skill file plus this handoff entry.

**What 35c must know.** The new section is titled exactly `## The departures record`, placed between `## The transition gate and escalation` and `## Handoff-note template` in `.claude/skills/timone-execute/SKILL.md`. The departures-entry template (nested in a four-backtick fence, matching the file's existing double-fence convention for templates) is:

````markdown
## <date> — <run/ticket>, <stage>

**Kind:** plan step | requirement | check not run | workaround
**Agreed:** <what the plan or requirement said>
**Did instead:** <what happened>
**Why:** <the reason, one or two sentences>
````

The in-place amendment marker convention to mirror when touching `timone-verify`'s own skill file is `✏ <date> (build, timone#<ticket>): <what changed and why>` — distinct from the pre-existing `✏ Refined <date>` marker style used for stage-5 plan amendments, and distinct from the `✏ <date> ([ADR-NNNN](path))` style used for citing an accepted decision.

**Post-review addendum (orchestrator, same session).** A read-through after the sub-agent's ten edits landed found three more passages in the same file still describing the pre-ADR-0052 behaviour: "Read before you execute"'s note on an uncommitted handoff section, the matching sentence under "What 'dirty' means", and the "Closing" section's report-order list. All three assumed gate 2, gate 3, or an exhausted retry could still leave a slice mid-flight and uncommitted, or stop the whole report. Amended in place, using this same sub-phase's new authority, and recorded as the phase's first entry in `phase-35-departures.md` (created by this fix). 35c needs nothing further from this — the observation raised in the sub-agent's own report above is resolved.

## 35c — Verification records what it could not check or could not fix, and hands the run to delivery anyway

**Built.** `timone-verify`'s own skill instructions (`.claude/skills/timone-verify/SKILL.md`) now say what ADR-0052 requires: gate 3 (the environment will not come up) no longer stops the whole pass and routes to a human. It still marks every in-scope criterion **BLOCKED**, exactly as before, but now also records one entry in the phase's departures record (`phase-NN-departures.md`) naming what failed to start and the exact command that failed, then lets the pass continue for whatever in scope does not depend on the environment — the stage posts its ordinary completion and the run proceeds to delivery. The fix loop's exhaustion (two loops consumed, failures remain) no longer files a new ticket for a human/stage-1 to classify: remaining failures are still recorded with evidence and their register lines still flip to `failed` — that flip stays true evidence — but instead of a new ticket, one departures-record entry is appended naming the remaining failures and why they were not resolved, and the stage posts its ordinary completion so the run reaches delivery. The report template's old "Handed to the human" section is renamed "Carried forward" and now points at the departures record for anything BLOCKED or `failed`, rather than describing a stop that no longer happens. Gate 1 (completion) and gate 2 (register) are untouched — both still stop the pass and route, since both fire on a precondition missing entirely, before any checking starts.

**Files touched.**

- `.claude/skills/timone-verify/SKILL.md` — six edits: the "## The gates" framing paragraph (gates 1/2 vs gate 3 now distinguished), gate 3's body, the fix loop's exhaustion paragraph (item 4 under "## The fix loop"), the report template's section rename ("## Handed to the human" → "## Carried forward"), Workflow step 6, and the Closing section's numbered list (items 1 and 5).
- `doc/plans/phases/reports/phase-35-handoffs.md` — this section appended.

**Decisions taken inside the slice.** None beyond the plan's literal instruction for edits 2–4 (gate 3, fix-loop exhaustion, report-template rename) — each OLD block matched the file's actual text exactly before replacement, so no wording judgement calls were needed there. Edits 1, 5 and 6 were the consistency fixes the plan's own scope-discipline section required: the "## The gates" opening paragraph, Workflow step 6, and the Closing list's items 1 and 5 each separately restated gate 3's or the fix-loop's old stop-and-route behaviour elsewhere in the same file; left alone they would have contradicted the three plan-named edits the moment a reader reached them. No wording beyond what the orchestrator's prompt specified verbatim was introduced.

**Validation evidence.**

```
$ grep -n "route to the human\|goes to the human as a new ticket\|stage 1 classifies" .claude/skills/timone-verify/SKILL.md; echo "exit: $?"
exit: 1

$ grep -n "phase-NN-departures.md\|Handed to the human" .claude/skills/timone-verify/SKILL.md; echo "exit: $?"
141:4. ... and one entry is appended to the phase's departures record (`phase-NN-departures.md`) naming the remaining failures and why they were not resolved within the two loops. ...
234:<Only when anything remains BLOCKED or `failed`: what, the evidence, and a pointer to the phase's departures record (`phase-NN-departures.md`) for the entry recording it. Omit the section when nothing does.>
exit: 0
```

Checkboxes: first grep exits 1 — pass, and confirmed as the known pre-existing quirk (the literal phrases don't appear verbatim in the unmodified file either — bold markers and capitalization differences break the match), not evidence of anything by itself. Second grep exits 0, showing both departures-record references and no remaining "Handed to the human" heading (the only surviving occurrence of that phrase is inside a Closing-list sentence explicitly saying it no longer applies). Read gate 3 (lines 56–64) and the fix-loop exhaustion paragraph (lines 134–141) directly after editing: gate 3 now blocks + records a departure + continues to ordinary completion, with no "route to the human" language remaining; the fix-loop paragraph now records a departure + posts ordinary completion, with no "new ticket" or "stage 1 classifies" language remaining. Fence balance checked (`grep -n '^````\|^```'`): the defect-brief fence (145/154), the verification-report template fence (173/235), and the commit-provenance fence (261/265) all open and close correctly — no orphaned fences. Gate 1 (line 60) and gate 2 (line 62) text confirmed byte-for-byte unchanged from before this sub-phase.

**What 35d must know.** The renamed report-template section is `## Carried forward`, at line 232 in `.claude/skills/timone-verify/SKILL.md`, immediately after `## Register changes` — its placeholder text points readers at `phase-NN-departures.md` by name, following the same convention 35b established in `timone-execute`'s own file (`## The departures record` there). If 35d touches `timone-deliver`'s own skill file, the same departures-record file name and path — `projects/<name>/doc/plans/phases/reports/phase-NN-departures.md`, created on first departure, appended thereafter, one dated `## <date> — <run/ticket>, <stage>` entry with `**Kind:**` / `**Agreed:**` / `**Did instead:**` / `**Why:**` fields — is the one to reference, not a new one.
