# Phase 08: Verification — `timone-verify`

> **Status:** Complete — see [reports/phase-08-complete.md](reports/phase-08-complete.md). Approved for execution by fvermaut 2026-07-26; 08c's dry-run gate passed by fvermaut 2026-07-28.

> **Companion phases:** [Phase 02](phase-02.md) (skill authoring conventions — the mandatory target-project resolution preamble, and the artifact rule this phase reconciles a second time), [Phase 06](phase-06.md) (`timone-plan`'s `Status` lifecycle — its `Complete` stamp is this skill's entry gate), [Phase 07](phase-07.md) (its output is this phase's only input: the completion report written "for the next agent" is the stage-6→7 interface, and its dry-run left the runnable fixture R12 requires). Governing decisions: [ADR-0007](../../adr/0007-sessions-at-timone-root.md) (sessions run at the timone root; the skill resolves a target project and works only inside `projects/<name>/`), [ADR-0009](../../adr/0009-cli-first-agent-tooling-mcp-for-the-gap.md) (CLI-first tooling — the `api` channel is terminal probes by construction; the `browser` channel is exactly the gap MCP exists for).

## Requirements

> **PRD:** [prd-01-process-layer.md](../../specs/prd/prd-01-process-layer.md) — criteria in [prd-01-process-layer.criteria.md](../../specs/prd/prd-01-process-layer.criteria.md)

| ID         | Priority | Requirement (one line)                                                                                                                                     |
| ---------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PRD-01.R12 | MUST     | Verify skill: a verifier context with no build knowledge checks each in-scope criterion per its channel, writes a verification report with PASS / FAIL / HUMAN-CHECK / BLOCKED verdicts and evidence, and updates register statuses; MUST+api criteria already verified are re-run as regression |
| PRD-01.R20 | MUST     | Mandatory accessibility baseline — this phase delivers its **third** criterion only: browser-channel checks for user-facing deliverables include the baseline accessibility checks (automated scan where tooling exists, HUMAN-CHECK script otherwise) |

No un-anchored enabler work in this phase. R12 and R20 are grouped because R20's third criterion has no delivery vehicle other than this skill — it is a stage-7 obligation, and stage 7 has no skill. Its first two criteria are already delivered and evidenced (`doc/standards.md` baseline inclusion per [phase-02-verification.md](reports/phase-02-verification.md), PRD accessibility criteria per [phase-04-verification.md](reports/phase-04-verification.md)); R20 flips to `verified` only once 08c evidences the third. Deliberately out of scope: R13/R17 (delivery — phase 09), R14, R21/R22, R23, and R24, which the register itself bars from planning until a `timone-grill` session rewrites its criteria.

## Goal Description

Phase 07 closed the implementation stage and left behind the consumer-less half of its own interface: completion reports whose required elements exist "for the next agent", and a fixture no earlier phase could have produced — `projects/scratch-app`, a running Next.js + PostgreSQL to-do app on two stacked unmerged branches, with a criteria register of seven MUSTs all still `draft`. That is verbatim R12's GIVEN: "a project with a criteria register and a runnable app". This phase builds the consumer. Stage 7 is where Timone stops trusting the builder's word: a verifier context that did not watch the build checks observable behaviour against the register — trusting only the running app, never source-code intent — and is the only stage allowed to write the register's `Status` field.

**Eight spec gaps close first (08a).** Stage 7's note in `process.md` is one paragraph, and the read pass found it underspecified in ways the skill cannot paper over: the verdict vocabulary names four verdicts while R12's verification hint expects a fifth (`REGRESSION`); "no build knowledge" names no read list, and the completion report — written *for* stage 7 — sits ambiguously between allowed and forbidden; nothing says which criteria a pass covers, or what verification of an un-anchored phase (which `scratch-app` phase-02 is) even means; "2 verify-fix loops" names no fixer, no branch mechanics and no loop boundary; nothing says when the register flips or what couples a flip to its evidence; the report has no required elements despite three hand-written precedents in Timone's own repo; nothing says verification observes the production form (the phase-07 handover recorded that the axe scan ran against `next dev` and said stage 7 should not repeat that); and the "standing regression suite" the spec names has no stated home.

**Decisions taken at planning (2026-07-26, with fvermaut).** The dry run fixes `scratch-app`'s real defect for real: focus after deleting a todo drops to `<body>`, violating the focus-after-removal rule the baseline gained on 2026-07-26 and already recorded against the project — so the verify → FAIL → fix → re-verify loop gets exercised honestly, on a defect nobody planted. The screen-reader clause of `scratch-app`'s R7 stays a script-only HUMAN-CHECK: the skill emits the precise manual script and does not wait for it to be performed — which is exactly the behaviour R12 specifies, and it means R7 demonstrates the partial-evidence path rather than being forced closed. And the phase-07 prohibition on engineering failure traps applies to stage 7 identically: the loop-exhaustion path (2 loops spent, remaining failures handed to the human) is specified, never provoked — its first genuine firing on a real project is its test. One synthetic manipulation is sanctioned, because R12's own verification hint demands it: break one verified behaviour and re-run, expecting a `REGRESSION` verdict.

**Why the eight decisions are `process.md` amendments and not ADRs.** Each passed the significance test's trade-off part — REGRESSION-as-FAIL-variant against a fifth first-class verdict, a derived regression suite against a maintained artifact, a fresh fix context against letting the verifier fix — but none is hard to reverse and none is surprising given stage 7's existing paragraph. Same reasoning that kept phase 07's branch conventions and phase 06's `Status` lifecycle out of the ADR log.

**How the skill talks about the fix context, and why that isn't an ADR either.** Like stage 6's sub-agent contract, the skill specifies what a fix context receives (the defect brief, the repo, `doc/standards.md`) and what it returns (a commit SHA and a one-paragraph note), naming a concrete spawning mechanism only as an example — PRD-02's daemon substitutes the Agent SDK unedited. The one hard rule is directional: the verifier never fixes, and never reads the fix — a verifier that has read the fix has build knowledge for the re-verify.

## Context & Prerequisites

- **Phase 02** — `.claude/skills/README.md`: frontmatter rules, the mandatory six-step target-project resolution preamble (copy it verbatim), and the artifact rule that 08a reconciles a second time — stage 7 commits application-code fixes, a verification report, and register flips.
- **Phase 07** — `.claude/skills/timone-execute/SKILL.md` is the house-style template (terminal gates that route, a contract-shaped sub-agent section, inline fenced templates, a Closing that names a successor skill that does not exist yet). Its completion-report template defines the stage-6→7 interface this skill consumes; its Closing prescribes the exact invocation 08c's run 1 uses.
- **`process.md` stage 7** — normative but thin; 08a expands it with required elements and gate semantics only. The document layout of the verification report belongs to the skill, per the division phases 05–07 established.
- **The three hand-written precedents** — [phase-01-verification.md](reports/phase-01-verification.md), [phase-02-verification.md](reports/phase-02-verification.md), [phase-04-verification.md](reports/phase-04-verification.md) in Timone's own repo: verdict summary table, per-criterion evidence with commands as run, fix-loop accounting, a black-box declaration ("no implementation source was read"). 08a's required elements are distilled from them, exactly as 07a distilled the completion report from six precedents.
- **`standards/baseline/accessibility.md`** (`Approved`, amended 2026-07-26) — its Verification section is what R20's third criterion binds to stage 7, and its focus-after-removal rule is what the dry run's real FAIL trips. The skill states the enforcement point; it must not restate the entry's content.
- **The fixture** — `projects/scratch-app`: register `doc/specs/prd/prd-01-todo-list.criteria.md` (R1–R7, all MUST, all `draft`; R1–R5 `api`, R6–R7 `browser`; R7's screen-reader clause is permanently HUMAN-CHECK), branches `phase-01-to-do-list-vertical` and `phase-02-latency-smoke-check` (stacked; `main` is doc-only), phase 02 stamped un-anchored. Run instructions live in `projects/scratch-app/doc/plans/phases/reports/phase-01-complete.md` § Context for the next agent, and the verifier obeys them rather than rediscovering: `localhost` never `127.0.0.1`; Postgres on host port 5433; **seed before building** — `/` is statically prerendered with a 15-minute revalidation window, so a scan against an unseeded build meets an empty list; `npm run test:integration` truncates `Todo`; Playwright starts its own server.
- **Local prerequisites for 08c** — Docker, Node, `npx playwright install --with-deps chromium`, host port 5433 free.

## Sub-phases

### Sub-phase 08a: process-spec amendment — stage-7 decisions

**[MODIFY]** `process.md` — expand the stage-7 note with eight decisions, plus one reconciliation in the skills README. Keep `process.md` thin: it states required elements and gate semantics, never document layout; the report *template* lives in the skill (08b).

1. **Verdict vocabulary.** Report verdicts are PASS / FAIL / HUMAN-CHECK / BLOCKED. **REGRESSION is the FAIL variant reserved for a criterion that entered the pass already `verified`** — same failure class (counts against the gate's "zero regressions", consumes the same fix loop), distinct label because it means shipped behaviour broke and stage 9 reads it differently. This reconciles R12's criterion (four verdicts) with its hint (REGRESSION) without a fifth first-class verdict. **BLOCKED** means the check could not run at all (environment down, tooling absent, criterion unverifiable as written): it asserts nothing about behaviour, leaves the register untouched, blocks the gate, routes to the human, and consumes no fix loop.
2. **Verifier independence — a closed allowed read list**; anything not on it is not read, and the report declares what was read. Allowed: the criteria register(s); the PRD narrative; the phase file's `Status` and Requirements header (scope and the un-anchored stamp — never sub-phase bodies); **the completion report, whole** — it is the stage-6→7 interface, and the sharper principle does the guarding: *expected behaviour comes only from the register; the completion report supplies operational facts (how to run, carried-forward HUMAN-CHECKs), never expected values*; the project's `README.md`, `CONTEXT.md`, `doc/standards.md`; Timone's `standards/` baseline. Forbidden: `phase-NN-handoffs.md`, diffs or `git show` of code, anything under the source tree **including the committed test suite**, ADRs. The project's own suite may run once as a build-health smoke and be reported as such, but is never criterion evidence — evidence comes from verifier-authored throwaway probes, in scratch space, never committed.
3. **In-scope rule.** A pass covers (a) the requirement IDs the phase claims (per its Requirements header and completion report) plus (b) the standing regression set. For an un-anchored phase, (a) is empty by design: the pass is the regression set alone, plus carried-forward HUMAN-CHECK items from the completion report, and the gate degenerates to "zero regressions" — stage 6's validation already covered the un-anchored deliverable itself.
4. **Fix-loop mechanics.** The verifier **never fixes**. Each FAIL produces a **defect brief** — criterion ID, expected-per-register, observed behaviour, reproduction commands, evidence — and a **fresh fix context** (contract-shaped; the verifier ingests only the returned commit SHA, never the fix transcript) implements and commits `fix: verify NN — <criterion-id> <slug>` on the phase's branch. One loop = all of a pass's FAILs briefed and fixed, then one full re-verify of everything except already-scripted HUMAN-CHECKs — a fix is a code change made by a context that did not watch the build, so nothing short of a full re-run is defensible. Max 2 loops after the initial pass. Exhaustion: remaining FAILs recorded with evidence, register flipped to `failed`, routed to the human via stage 9.
5. **Register writes.** Only stage 7 flips `Status`, once per pass, at pass conclusion, in the same commit as the report: `docs: verify phase NN — <theme>` on the phase's branch. `draft` → `verified` on PASS; `draft` → `failed` at loop exhaustion; `verified` → `failed` on an unresolved REGRESSION, with a dated `✏` marker naming the report; a requirement carrying an unperformed HUMAN-CHECK clause stays `draft` with a dated partial-evidence marker linking the report and the script — per-requirement status is the weakest of its clauses' outcomes. The report-flip coupling in one commit is the evidence link; the register line itself stays bare.
6. **Report required elements** (template in the skill): date and scope statement (or the un-anchored stamp); verdict summary table (ID / priority / channel / verdict / loop); environment and an **independence declaration** naming what was read; per-criterion evidence — commands as run, output, per-clause outcomes; HUMAN-CHECK scripts verbatim; a regression section, stated even when empty; fix-loop accounting (N of 2; per loop: briefs, fix commits, re-verify outcome); register changes; a handed-to-the-human section whenever anything remains.
7. **Production form.** Verification observes the deliverable in its production form where the stack distinguishes one — a production build, never the dev server. Browser-channel checks for user-facing deliverables derive their accessibility checks from the register's criteria plus the baseline's verification section — automated scan where tooling reaches, HUMAN-CHECK script otherwise; scan violations are failures. Stated as the enforcement point; the baseline's content is not duplicated.
8. **The standing regression suite is derived, never maintained.** Computed at verify time from the register(s): every criterion with priority MUST, verify-via `api`, status `verified`, at the phase branch's HEAD. No second artifact to drift; each report lists the derived set so the computation audits.

**[MODIFY]** `.claude/skills/README.md` — reconcile the artifact rule a second time: stage 7 (`timone-verify`) additionally commits the application-code fixes its bounded verify-fix loops produce, plus the verification report and register status flips. What stays forbidden in every case is unchanged: skill files, harness config, timone internals (PRD-01.R4 — no PRD amendment needed).

> ✏ Refined 2026-07-27 (from 08c round 3): decision 2's closed read list was **too closed to execute its own steps**. Every run had to disclose a deviation: the verifier needs the compose file and `.env` to learn which port and credentials stand the app up, and needs `STATUS.md` because stage 7 is obliged to write it. A list that forbids its own mandated steps trains agents to step around it, which is worse than a wider list. The stage-7 note and the skill now admit `STATUS.md` and the **operational** configuration that stands the app up — compose files, `.env`/`.env.example`, the run and test scripts a manifest declares — while application configuration a criterion's behaviour depends on stays forbidden.

**Seams under test (TDD):** no behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
grep -n "REGRESSION\|BLOCKED" process.md
grep -n "regression suite\|fix: verify" process.md
grep -n "timone-verify" .claude/skills/README.md
git -C . diff --stat
```

- [ ] Stage-7 note states: the verdict set with REGRESSION as the FAIL variant for previously-verified criteria and BLOCKED's no-loop/no-flip semantics; the closed read list with the completion-report principle (operational facts, never expected values); the in-scope rule including the un-anchored case; fix-loop mechanics (fresh fix context, `fix: verify NN — …` on the phase branch, full re-verify per loop, max 2, exhaustion routing); register flip timing and the report-flip commit coupling; report required elements; the production-form rule; the derived regression suite
- [ ] `process.md` gained no verification-report *template* (that belongs to the skill)
- [ ] `.claude/skills/README.md`'s artifact rule permits stage-7 fix commits, report and register flips, and still forbids skill/harness/timone-internal files, matching R4's wording
- [ ] No other stage's text altered; stage 6's escalation and branch wording untouched
- [ ] No PRD amendment was made — R12's criterion needed none, its hint is reconciled by the REGRESSION-as-FAIL-variant decision

---

### Sub-phase 08b: `timone-verify` skill

**[NEW FILE]** `.claude/skills/timone-verify/SKILL.md`

**Seams under test (TDD):** no behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based, with the real test deferred to 08c.

> Sub-phase 08a must be complete before starting this sub-phase (spec wins; the skill restates it).

Per `process.md` stage 7, with the standard target-project resolution preamble from `.claude/skills/README.md` — managed projects only. Input: a project name plus a phase reference. **Standalone and from-execution are the same invocation** — `timone-execute`'s Closing hands over a command line, not a mode — and the skill says so, since that is half of R12's GIVEN. The skill:

1. **Opens with the stance** — you did not watch the build; the register is the only source of expected behaviour; you trust the running app, never source-code intent.
2. **States the two read lists from 08a** — read-before-you-verify and never-read — with no variants, and requires the report's independence declaration to match what actually happened.
3. **Fires its gates**, each terminal, each naming where to route, none writing anything:
   - Phase file not stamped `Complete — see …` → refuse; route to `timone-execute` (unfinished) or the human (never executed).
   - No criteria register and no un-anchored stamp → refuse; route to `timone-prd` or `timone-plan`.
   - Environment will not come up per the completion report's instructions → every criterion BLOCKED, report written, stop — no fix loop consumed.
4. **Sets up the branch** — verify at the phase branch's HEAD; refuse a dirty tree; **when the phase stacks on a phase whose verification commits are absent from its ancestry, merge that branch in first and say so** (without this, a stacked phase's regression set reads stale `draft` statuses); leave the clone on the verified branch, clean. Re-verifying an already-reported phase appends an iteration section to the existing report, never a second file.
5. **Derives the scope** — claimed IDs plus the computed regression set, or the un-anchored degenerate case — and lists both in the report.
6. **Stands the environment up in production form**, obeying the completion report's stated gotchas rather than rediscovering them.
7. **Checks each criterion per its channel** — `api`: verifier-authored probes (HTTP against the running app, direct DB readback), scratch-space scripts, never committed, never the project's suite; `browser`: for user-facing deliverables always includes the baseline leg — automated accessibility scan, keyboard-only pass (focus assertions are mechanical: where `document.activeElement` lands after an action), reflow checks — HUMAN-CHECK script where tooling cannot reach; `human`: HUMAN-CHECK with a precise manual script.
8. **Runs the fix loop** per 08a — defect brief, fresh fix context, full re-verify, max 2 loops, exhaustion protocol.
9. **Writes the report and flips the register** in one commit per 08a, updates `STATUS.md` in both repos' terms (the managed project's; Timone's own only when verifying Timone), and closes.

The skill carries three inline fenced templates (house style — no bundled reference files): the **verification report** (every 08a required element), the **defect brief**, and the **HUMAN-CHECK script** block. The fix-context section is contract-shaped — inputs (defect brief, repo, `doc/standards.md`), outputs (commit SHA, one-paragraph note) — with any concrete spawning mechanism named only as an example.

Closing: report the gate outcome or the scope, the verdict table, loops consumed, the report path, what was handed to the human, and the next invocation — `/timone-deliver <project>`. Note explicitly that `timone-deliver` does not exist yet (phase 09); name it anyway, as every stage skill names its successor.

#### Agent Validation Steps

```bash
head -6 .claude/skills/timone-verify/SKILL.md
grep -n "REGRESSION\|BLOCKED\|HUMAN-CHECK" .claude/skills/timone-verify/SKILL.md | head -20
grep -n "handoffs\|never read\|did not watch" .claude/skills/timone-verify/SKILL.md | head
grep -c "timone-deliver" .claude/skills/timone-verify/SKILL.md
```

- [ ] Frontmatter + targeting per `.claude/skills/README.md` (`argument-hint` starts with `<project-name>`, then the phase reference)
- [ ] Stage-7 rules restated with no variants: verdict vocabulary, both read lists, scope derivation including the un-anchored and regression computations, production form, loop bound, register mechanics — all matching 08a exactly
- [ ] All three gates are terminal, write nothing, and name the skill or human to route to
- [ ] The verifier never fixes and never reads a fix transcript; the fix context is stated as inputs/outputs with no runtime-specific mechanism written in as a requirement
- [ ] All three inline templates present; the report template carries every 08a required element including the independence declaration
- [ ] The accessibility leg is unconditional for user-facing browser-channel checks (R20's third criterion)
- [ ] Standalone and from-execution stated as the same invocation; the Closing names `/timone-deliver` with the does-not-exist-yet note

---

### Sub-phase 08c: Dry-run — four runs against `scratch-app`

**Seams under test (TDD):** this sub-phase writes no Timone code; its "seam" is the observable end state of each run, asserted below. The fix commit produced inside run 1 is made by a fix context under the skill's own rules — that is the run's evidence, not a property of this sub-phase.

> Sub-phases 08a and 08b must be complete before starting this sub-phase.

From fresh timone-root sessions:

1. **Full pass — verify `scratch-app` phase-01** (branch `phase-01-to-do-list-vertical`), invoked with exactly the command line `timone-execute`'s Closing prescribes — that is the from-execution evidence; no separate machinery exists to test.

   > ✏ Refined 2026-07-27: ran as expected — the real focus-after-delete FAIL found mechanically, briefed, fixed by a fresh fix context, re-verified PASS in loop 1 of 2. Preparing it exposed a defect in **`timone-execute`**, not this skill (round 1): its Closing named `/timone-verify <project>` with no phase reference, while verification refuses to pick a phase for the user — so the prescribed handover would strand any project past its first phase. Fixed in `timone-execute`. Regression set: empty (nothing is `verified` yet). Expect: environment stood up seeded-then-production-built; R1–R5 PASS via verifier-authored api probes with DB readback; R6 PASS via browser; **R7's automated clauses FAIL on focus-after-delete** (`document.activeElement` falls to `<body>`, the baseline's named failure) → loop 1: defect brief → fresh fix context implements the baseline's focus order and commits `fix: verify 01 — PRD-01.R7 focus after delete` → full re-verify → PASS. R7's screen-reader clause: HUMAN-CHECK, script written verbatim, deliberately not performed (decided 2026-07-26). End state: report and register flips committed `docs: verify phase 01 — …` on the phase-01 branch — R1–R6 `verified`, R7 `draft` with a dated partial-evidence marker; fix-loop accounting reads 1 of 2; the independence declaration is true of the transcript.
2. **Regression break — R12's verification hint discharged verbatim.** A synthetic commit on the phase-01 branch breaks one now-verified api behaviour (recommended: remove R1's `.trim()`; the commit message names itself a sanctioned probe). Re-invoke verify on phase-01. Expect: an iteration-2 section appended to the existing report; verdict **REGRESSION** on R1 — not plain FAIL; the loop fixes it for real; re-verify PASS; register stays `verified`. Default posture: probe and fix stay in the fixture's history; reverting both is offered to fvermaut at the gate instead.

   > ✏ Refined 2026-07-27: **this run's first attempt returned a false all-PASS, and that is the most valuable thing the dry run produced.** The verifier's R1 probe posted the padded title with `curl -F`, whose multipart parser strips the padding itself — so the probe pre-applied the very transformation it was checking and could only ever agree with the app. Worse, the verifier held the alarm in its hand: the build-health smoke was failing on exactly the trim tests, and it filed that contradiction as a note for the human while letting its verdicts stand. Two skill rules close it (round 2): a probe must be shown able to detect the failure it exists to catch — transformation clauses must prove verbatim transmission to the app's boundary — and a smoke/probe contradiction blocks the pass until resolved instrument-side. Re-run under the corrected skill, the pass caught the planted break as a REGRESSION **and** found a second, genuine defect nobody planted (mutations intermittently not reflected in the UI). Both were fixed in one loop. The run therefore took three report iterations, not two.
3. **Un-anchored — verify `scratch-app` phase-02** (branch `phase-02-latency-smoke-check`). Expect: the skill notices phase-01's verification commits are absent from this branch's ancestry, merges the phase-01 branch in and says so; recognises the un-anchored stamp; scope = regression set only (R1–R5, all PASS); zero register flips; the report states the un-anchored basis and the zero-regressions gate, and carries forward the completion report's open HUMAN-CHECK (the 2 ms latency-budget decision) to the human.

   > ✏ Refined 2026-07-27: ran exactly as expected, and **the merge-in rule proved load-bearing rather than tidy**: at phase-02's own tip every register line still read `draft`, so without the merge the regression set would have derived *empty* — the pass would have re-run nothing while appearing to satisfy the zero-regressions gate. The calibration rule added in round 2 also paid twice here: it discarded another `curl -F` probe that could not fail, and caught a probe-side false FAIL on R4 that would otherwise have sent a fix context at working code.
4. **Entry-gate probe** — invoke against a phase not stamped `Complete` (a nonexistent `scratch-app` phase-03, or `scratch-existing`'s never-executed plan). Expect: terminal refusal — no environment stood up, no probes run, correct routing named.

   > ✏ Refined 2026-07-27: **the plan offered two fixtures for one probe, and they test different things** — a defect the run exposed rather than a scope change. A *nonexistent* phase-03 never reaches gate 1: it stops at the skill's input-resolution rule, which refuses to pick a phase for the user. Gate 1 needs a phase file that exists and is *not* stamped `Complete`, and neither fixture had one — `scratch-existing`'s only plan was already closed. So the probe is two runs: **4a** the nonexistent reference (input resolution) and **4b** an approved-but-unexecuted `scratch-existing` phase-02, hand-authored as a fixture the same way phase 07 hand-authored its approval-gate plan. Both refused terminally and wrote nothing; 4b also correctly observed that this fixture's regression set would derive empty for want of any register.

Explicit non-goal, restated from the phase-07 sign-off: **no synthetic loop-exhaustion run.** The 2-loop bound and the handed-to-the-human protocol are fully specified in 08a and templated in 08b; their first genuine firing on a real project is their test.

Then: `git log --stat` in the fixture — no skill files, no harness config, no timone internals (R4 regression, now that a second skill commits code).

#### Agent Validation Steps

```bash
git -C projects/scratch-app log --oneline phase-01-to-do-list-vertical | head -8
git -C projects/scratch-app log --oneline phase-01-to-do-list-vertical | grep -c "fix: verify 01"
ls projects/scratch-app/doc/plans/phases/reports/ | grep verification
git -C projects/scratch-app show phase-01-to-do-list-vertical:doc/specs/prd/prd-01-todo-list.criteria.md | grep -c "Status:\*\* verified"
grep -n "REGRESSION" projects/scratch-app/doc/plans/phases/reports/phase-01-verification.md
grep -n "un-anchored\|regression" projects/scratch-app/doc/plans/phases/reports/phase-02-verification.md | head
# Failure probe: R7 must NOT read verified — its screen-reader clause is unperformed
git -C projects/scratch-app show phase-01-to-do-list-vertical:doc/specs/prd/prd-01-todo-list.criteria.md | grep -A2 "^## R7" | grep "verified"; echo "exit: $? (1 = clean, as required)"
# Failure probe: no skill, harness or timone-internal file may appear in the fixture's history
git -C projects/scratch-app log --stat | grep -E "\.claude/|timone\.yaml"; echo "exit: $? (1 = clean, as required)"
```

- [ ] Run 1: the real FAIL found mechanically, fixed in one loop by a fix context (not the verifier), R1–R6 `verified`, R7 `draft` with the partial-evidence marker, the screen-reader script present verbatim and unperformed, report-flip coupling in one `docs: verify phase 01` commit
- [ ] Run 1: the independence declaration lists what was read, and the transcript contains no handoffs read, no source read, no project-suite result used as criterion evidence
- [ ] Run 2: verdict is REGRESSION, not FAIL; an iteration section was appended, not a second report file; fixed within the loop budget
- [ ] Run 3: the merge-in is stated, scope is the regression set only, zero flips, the latency-budget HUMAN-CHECK carried forward
- [ ] Run 4: terminal refusal — nothing stood up, nothing written, correct routing named
- [ ] `git log --stat` in the fixture shows no skill, harness or timone-internal files
- [ ] Defects found are fixed in `timone-verify` (and in `process.md` when the spec is what was wrong, never by bending the skill around it)
- [ ] **Human gate:** fvermaut reviews the two verification reports and the refusal transcript, the focus-fix commit, the register diffs, and the independence trace; confirms the screen-reader item remains outstanding by choice; decides run 2's history posture (keep or revert the probe pair) — this gate is also R12's and R20's evidence

---

### Sub-phase 08d: Documentation

**[MODIFY]** `README.md` — add `/timone-verify <project-name> <phase-NN>` to the "Working with Timone" command list; update the Status paragraph.
**[MODIFY]** `doc/specs/prd/prd-01-process-layer.criteria.md` — flip R12 and R20 to `verified` once 08c's human gate passes (R20's third criterion evidenced by 08c; its first two per the phase-02 and phase-04 verification reports).
**[MODIFY]** `STATUS.md` — Timone's own, per the every-stage obligation. (`scratch-app`'s `STATUS.md` is updated by the dry runs themselves — a skill obligation, not an 08d touch.)

**Seams under test (TDD):** no behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based.

> All prior sub-phases must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
grep -n "timone-verify" README.md
grep -n -A3 "^## R12\|^## R20" doc/specs/prd/prd-01-process-layer.criteria.md
```

- [ ] Documented invocation matches actual behaviour; links resolve
- [ ] R12 and R20 flipped only after the 08c human gate passed
- [ ] The Status paragraph names what remains: deliver and improve (R13, R14, R17)

## Dependency graph

```
08a → (none)      process.md: stage-7 decisions (verdicts, read list, scope, fix loop, register, report, production form, derived regression suite); skills-README reconciliation (spec first)
08b → 08a         timone-verify skill
08c → 08a, 08b    dry-run: 4 runs (full pass with the real FAIL + fix, sanctioned REGRESSION break, un-anchored phase, entry-gate probe), human gate
08d → 08c         docs last + R12/R20 → verified
```
