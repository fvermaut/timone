# Phase 42: A run spends its time on the work — the box's token, the checking step's re-runs, the building step's suites

> **Status:** Planned. ✏ 2026-10-03: reopened for 42d to 42f, the reviews' findings on pull request #193; closed again when they land.

> **Companion phases:** [phase 41](phase-41.md) removed the old code between steps and left the box's token handling untouched; this phase changes `src/daemon/container-runtime.ts` and `src/adapters/credentials.ts`, which phase 41 did not. [phase 30](phase-30.md) built the box and its token refresh (`keepForgeTokenFresh`). Governing decisions: [ADR-0061](../../adr/0061-a-check-script-proves-itself-once-and-a-fix-re-runs-what-it-can-affect.md) — the decision this phase builds; [ADR-0048](../../adr/0048-a-verification-probe-is-kept-proved-able-to-fail-and-hidden-from-the-builder.md) — D1, D3, D4 and D5 still bind the probes, only D2 is amended; [ADR-0051](../../adr/0051-timone-verifies-itself-by-live-gate-and-a-regression-set-is-narrowed-by-what-it-depends-on.md) — D4's narrowing of the first pass stays exactly as it is; [ADR-0041](../../adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md) and [ADR-0042](../../adr/0042-timone-acts-under-its-own-identity.md) — the box holds one token scoped to one repository, and that does not change.

> **Screens changed:** none — no slice changes anything a person sees.

## Requirements

> **PRD:** [prd-06-a-run-spends-its-time-on-the-work.md](../../specs/prd/prd-06-a-run-spends-its-time-on-the-work.md) — criteria in [prd-06-a-run-spends-its-time-on-the-work.criteria.md](../../specs/prd/prd-06-a-run-spends-its-time-on-the-work.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-06.R1 | MUST | A probe does its break run only when it is new, rewritten, or in doubt; the report names every probe that ran without one |
| PRD-06.R2 | MUST | After a fix, only the probes that failed and those the fix's changed file names can affect run again; the rest are listed with a reason |
| PRD-06.R3 | MUST | Old and new failures of the build-health smoke are told apart by the last report's list, never by building the default branch |
| PRD-06.R4 | MUST | Each sub-phase runs the tests its change can affect and the suites under a minute; everything runs whole once at the close |
| PRD-06.R5 | MUST | A box never holds a GitHub token that runs out before its next one arrives |
| PRD-01.R16 | MUST | The TDD loop, with its last clause revised to match PRD-06.R4 |

## Goal Description

Tickets take too long, and most of the time is commands, not the model ([#110](https://github.com/fvermaut/timone/issues/110), [#185](https://github.com/fvermaut/timone/issues/185)). fvermaut settled the rules in the interview of 2026-10-02 and approved PRD-06 and ADR-0061 together the same day, in the terminal. When he approved them he was told the work would be planned, built, checked and opened as **one pull request**, and that he would be asked nothing more until then. That is the list of pieces, with one piece, and it is why there is no breakdown file and no step tickets. Timone is built by hand in a terminal session, not by its daemon.

Three slices. **42a** fixes the token fault, the only code. **42b** rewrites the checking step's rules (R1–R3), **42c** the building step's rules (R4, PRD-01.R16). The rules are text — `process.md`, two skills, the shared probes' README — because that text is what a step session follows; nothing in `src/` runs probes or suites. 42b and 42c both edit `process.md`, so they run one after the other. 42a shares no file with either and may run beside 42b.

**One reading taken at planning, below the ADR bar.** ADR-0061 D1 says a probe does its break run when it is new. A shared baseline probe under `standards/baseline/probes/` is written once and run against many pages. This plan reads "new" as "never yet run against this page", so a baseline probe pointed at a page it has never checked does its break run there. It errs towards more break runs, not fewer, it is reversed by deleting one sentence, and it is no trade-off fvermaut was not shown: it is the same rule applied to the probe's real input. Not an ADR.

**What is owed, and what is not watched.** R1–R4 are `live`: only a real check and a real build on the scratch-app fixture can show a session following the new text, and this phase touches what they depend on (`.claude/skills/timone-verify/`, `.claude/skills/timone-execute/`, `process.md`). So the phase owes that watched run before its requirements can be ticked; under [ADR-0059](../../adr/0059-a-live-check-only-the-operator-can-run-rides-to-the-pull-request.md) it rides to the pull request as owed, because the daemon runs from fvermaut's terminal. R5 is `api`, and its falsifying test in 42a is a hard gate. The token is also taken by the machine's own `gh` calls outside any box (`src/adapters/command-runner.ts:328`, `src/commands/daemon.ts:336`); no criterion watches them, so 42a's existing-default test is the only guard that they keep today's 5-minute reuse.

**Left out on purpose.** The box also gets its first token as the `GH_TOKEN` and `GITHUB_TOKEN` environment variables, and they are never updated; `git` and `gh` read the file instead, so the fault #110 measured does not depend on them. Removing them could break a tool in the box that reads them, and R5 does not ask for it. Not done here.

## Context & Prerequisites

- **`src/adapters/credentials.ts`** — `CredentialProvider.tokenFor(repository)` (:63-69); `githubAppCredentials` (:161) caches one minted token per repository and reuses it while more than `EXPIRY_MARGIN_MS` (5 min, :89) is left (:196-215). Injected `mint` and `now` make it testable.
- **`src/daemon/container-runtime.ts`** — `FORGE_REFRESH_MS` = 20 min (:256), with a comment that is wrong about why 20 minutes is safe; the box's first token comes from `tokenFor` at spawn (:889-894); `keepForgeTokenFresh` (:787) sleeps `intervalMs` then calls `tokenFor` (:815) and writes the result into the box (`writeForgeToken`, :843).
- **The fault.** A token the cache minted for an earlier box, with 6 to 35 minutes left, is handed to a new box or written at a refresh. It dies before the next write 20 minutes later. The 6 September session waited 12.5 minutes on exactly that (`.timone/sessions/b0323576-2b4c-4d78-bff9-000a95fd5cb5.log:1689-1812`, timone root). The same timing explains [#71](https://github.com/fvermaut/timone/issues/71).
- **Tests that exist** — `src/adapters/credentials.test.ts:102` (reuse) and `:113` (re-mint near expiry); `src/daemon/container-runtime.test.ts:1284-1448`, the block *"the forge token a running box works on"*, with a hand-driven sleep (`handSleep`).
- **`.claude/skills/timone-verify/SKILL.md`** — never-read list (:45-50), build-health smoke and instrument alarm (:52-54), the narrowing (:82-92), *Red before green* (:127-134), the fix loop (:165-175), report template: smoke line (:225), *Probes* (:259), *Fix-loop accounting* (:266), step list (:295-299).
- **`.claude/skills/timone-execute/SKILL.md`** — *Rhythm* (:137), look check (:167), handoff *Validation evidence* (:234), *Closing the phase* (:248-256), completion report template (after :262).
- **`process.md`** — stage 6 (:44): *"run single test files during the loop, the full suite once at the end"*; stage 7 (:46): *"every run does both legs"*, *"one full re-verify of everything except already-scripted HUMAN-CHECKs"*, and the build-health smoke sentence.
- **`standards/baseline/probes/README.md`** — :30-39 restate *"seen to fail, on this build"* and both legs for the shared probes.
- **House style for amended text** — a changed rule carries `✏ Revised 2026-10-02 ([ADR-0061](…))` at the point of change, and words in it follow [Writing to the human](../../../process.md#writing-to-the-human) where a person reads them.

## Sub-phases

### Sub-phase 42a: A box is never handed a token that dies before its next one

**[MODIFY]** `src/adapters/credentials.ts` — `tokenFor(repository: string, options?: { minLifeMs?: number }): Promise<string>` on the interface and in `githubAppCredentials`. The cache reuses a token only while its remaining life is more than `Math.max(EXPIRY_MARGIN_MS, options?.minLifeMs ?? 0)`; otherwise it mints, as today, and caches the new token. Callers that pass nothing behave exactly as today. Update the interface's doc comment to say what `minLifeMs` is for.
**[MODIFY]** `src/daemon/container-runtime.ts` — add `BOX_TOKEN_MARGIN_MS = 15 * 60 * 1000` beside `FORGE_REFRESH_MS`, and rewrite `FORGE_REFRESH_MS`'s comment to state the real rule: every token a box receives must outlive the next refresh by the margin. The spawn's call (:893) passes `{ minLifeMs: FORGE_REFRESH_MS + BOX_TOKEN_MARGIN_MS }`. ✏ 2026-10-02 (build, timone#185): the spawn uses the interval the box's own refresh loop will wait, `(options.refreshIntervalMs ?? FORGE_REFRESH_MS) + BOX_TOKEN_MARGIN_MS`, so a longer interval set in options cannot break the rule. Found by the slice; the plan's wording would have left it. `keepForgeTokenFresh`'s call (:815) passes `{ minLifeMs: intervalMs + BOX_TOKEN_MARGIN_MS }`, so a test that shortens the interval keeps the rule.
**[MODIFY]** `src/adapters/credentials.test.ts`, `src/daemon/container-runtime.test.ts` — the cases below. The falsifying test goes in the existing *"the forge token a running box works on"* block and is named so that a reader of PRD-06.R5's `Falsified-by` line finds it: `"a box is never handed a token that dies before its next refresh"`.

**Seams under test (TDD):** two public seams. `githubAppCredentials(...).tokenFor` with an injected `mint` and `now` — it is the cache, and the cache is where the fault lives. `keepForgeTokenFresh` and the box spawn, with a fake `CredentialProvider` that records the options it is called with and a real `githubAppCredentials` behind a fake mint — the box's side is the observable end, a token written into a box. Red-green:
1. A cached token with 25 minutes left: `tokenFor(repo, { minLifeMs: 35 min })` mints again and returns the new token, and a following `tokenFor(repo)` returns the new one.
2. A cached token with 25 minutes left: `tokenFor(repo)` with no options returns the cached token (today's reuse is kept for the machine's own calls).
3. `keepForgeTokenFresh` asks `tokenFor` with `minLifeMs` at least `intervalMs + 10 min`.
4. The box spawn asks `tokenFor` with `minLifeMs` at least `FORGE_REFRESH_MS + 10 min`.
5. The falsifying test: a real `githubAppCredentials` on a fake clock whose fake mint first issues a token, then the clock moves so that token has 25 minutes left; a box is started and its refresh runs once. The token the box receives at spawn, and the one written at the refresh, are each the newer mint, never the 25-minute one. Then prove it can fail: drop the `minLifeMs` from the spawn's call, run it, see it red, record the failure in the handoff, restore.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
npx vitest run src/adapters/credentials.test.ts src/daemon/container-runtime.test.ts src/adapters/command-runner.test.ts; echo "exit: $?"   # expect 0
npx tsc --noEmit; echo "exit: $?"   # expect 0
git grep -n "tokenFor(" -- 'src/*.ts' ':!*.test.ts'   # every call site listed; only the two in container-runtime.ts pass minLifeMs
```

- [ ] Cases 1–5 each have red evidence before green in the handoff; case 2 may arrive green and is then proved by mutation (make the default reuse window 35 min, see it red, revert).
- [ ] The falsifying test's mutation run is in the handoff, with its failure message.
- [ ] `src/adapters/command-runner.ts` and `src/commands/daemon.ts` are unchanged.

---

### Sub-phase 42b: The checking step proves each probe once and re-runs only what a fix can affect

**[MODIFY]** `.claude/skills/timone-verify/SKILL.md`
**[MODIFY]** `process.md` — the stage 7 paragraph only (:46)
~~**[MODIFY]** `standards/baseline/probes/README.md` — :30-39~~ ✏ 2026-10-02 (build, timone#185): moved out of this slice. The file sits in the shared probe folder, which only the checking step may write ([ADR-0048](../../adr/0048-a-verification-probe-is-kept-proved-able-to-fail-and-hidden-from-the-builder.md) D1), and the hook refuses it to a building session. Phase 42's checking step makes item 7's change instead; see the departures record.

**Seams under test (TDD):** no behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based. The text is what a checking session follows, and PRD-06.R1–R3 are checked by watching one follow it.

> No dependency on other sub-phases. Sub-phase 42c edits `process.md` after this one.

Write each change from ADR-0061 and PRD-06's criteria, and mark each `✏ Revised 2026-10-02 ([ADR-0061](…))`:

1. **When a probe does its break run (R1, ADR-0061 D1).** Rewrite *Red before green* (SKILL.md :127-134). The rule that a pass counts only after the probe has been seen to fail stays. The break run then the real run happens when: the probe is written this pass; it is written again because its criterion is `revised`; its result is in doubt (the instrument alarm at :54); or it is a shared baseline probe run against a page it has never been run against. Every other run is the real run only. Keep *"green on both legs is a broken instrument"* for when both run. Replace *"it also catches decay for free"* with one sentence naming the accepted risk: an old probe that stopped being able to fail is no longer caught by its break run. Change step 7 (:297) to match. ✏ 2026-10-02 (build, timone#185): also the paragraph *Run the set with one command, in parallel* (:155). The one command is each project's own runner, written by an earlier check, and it may still do every probe's break run. Say that the one command does real runs only, that a probe owed a break run does it on its own, and that a runner which does both runs by default is given, or changed to take, a way to run real runs only — it is the checking step's own file. Found at the slice's gate: without it the rule saves nothing on a project whose runner breaks every probe.
2. **What runs after a fix (R2, ADR-0061 D2).** Replace step 3 of the fix loop (:173, *"One full re-verify"*) with a narrowed re-check: every probe that failed, plus every probe whose criterion the fix commit's changed files can affect, judged from `git show --name-only --format= <sha>` and the criteria's `Depends-on` lines. A fix that changes a file many criteria rest on — a database schema, a shared layout, a configuration file — sends every probe in scope again. Probes already proved this check run their real run only. No whole-set run follows the last fix. The `(browser)` clause re-runs and the screen read of step 8 follow the same narrowing. Change step 9 (:299) to match.
3. **The never-read list (:47) gets one exception, worded narrowly.** A list of changed file names (`git diff --name-only`, `git show --name-only --format=`) is not a diff: the narrowing already reads one for the phase, and the fix re-check reads one for the fix commit. Contents, `git show` of code and `git log -p` stay forbidden.
4. **Old and new smoke failures (R3, ADR-0061 D4).** At :52-54, add: when the build-health smoke has failing tests, mark each old or new by the list of smoke failures in the last check report on the default branch, and name that report; never build or run the default branch to compare; with no earlier list, report the failures unmarked and say so. The report template's smoke line (:225) asks for that list, so the next check has one to compare with.
5. **The report shows every skip.** *Probes* (:259): add the list, by criterion ID, of probes that ran without a break run. *Fix-loop accounting* (:266): per loop, the probes run again and every probe in scope not run again, each with its reason.
6. **`process.md` stage 7** (:46): replace *"every run does both legs"* and *"one full re-verify of everything except already-scripted HUMAN-CHECKs"* with the rules of items 1 and 2 in one or two sentences each, and add the smoke rule of item 4 after the sentence on the build-health smoke.
7. ~~**`standards/baseline/probes/README.md`** (:30-39): the same rule as item 1, for the shared probes, including the page reading.~~ ✏ 2026-10-02 (build, timone#185): moved to phase 42's checking step, for the reason given at the file list above.

#### Agent Validation Steps

```bash
git grep -n -E "every run does both legs|One full re-verify|full re-verify \(which repeats|in this run, on this build|catches decay for free" -- process.md .claude/skills/timone-verify; echo "exit: $?"   # expect 1: no old sentence left (✏ 2026-10-02: the probe folder is out of this slice)
for f in process.md .claude/skills/timone-verify/SKILL.md; do git grep -c "ADR-0061" -- "$f" || echo "MISSING in $f"; done   # expect a count for each file, no MISSING
git grep -n -E "name-only" -- .claude/skills/timone-verify/SKILL.md   # the exception and the fix re-check both name it
git diff --stat -- . ':!process.md' ':!.claude/skills/timone-verify' ':!doc/plans/phases/reports/phase-42-handoffs.md'   # expect empty
```

- [ ] From the skill alone, a reader can say in which four cases a probe does its break run, what runs after a fix, and how a smoke failure is marked old or new.
- [ ] The never-read list still forbids diffs, `git show` of code and `git log -p`; its exception names only file-name lists.
- [ ] The report template asks for the list of probes without a break run, the list not re-run after each fix with reasons, and the smoke failures marked old or new against a named report.
- [ ] Nothing else in stage 7 changed: the read lists, channels, verdicts, the two-loop cap and the register writes read as before.

---

### Sub-phase 42c: Each building part runs the tests its change can affect, and everything runs whole once at the close

**[MODIFY]** `.claude/skills/timone-execute/SKILL.md`
**[MODIFY]** `process.md` — the stage 6 paragraph only (:44)

**Seams under test (TDD):** no behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based.

> Sub-phase 42b must be complete before starting this sub-phase (both edit `process.md`).

Write each change from ADR-0061 D5 and PRD-06.R4, marked `✏ Revised 2026-10-02 ([ADR-0061](…))`:

1. **Rhythm** (:137): during the loop, single test files; at sub-phase end, the tests the change can affect and every suite that takes under a minute, whole; not the other suites whole. The sub-phase's own validation steps still pass before the next starts.
2. **Closing the phase** (:248): earlier sub-phases' validation runs once, at the close, not after each sub-phase that changes shared state. At the close, before the completion report, every suite of the project runs whole once, then every sub-phase's validation steps once. Keep the paragraphs on superseded checkboxes and on ordering by side effects (:250-252): they now apply to that one run. Remove the sentence that says to re-check as soon as a slice touches state an earlier slice observed, and say instead, in one sentence, the accepted risk: a part that breaks an earlier part is found at the close.
3. **Handoff template** (:234): *Validation evidence* names the tests and suites run at sub-phase end.
4. **Completion report template**: add a section `## Tests run` after *Sub-phase outcomes* — one line per sub-phase naming the tests and suites it ran, then the close's whole run of every suite and of every sub-phase's validation. "Stated, never omitted", as the template's other sections are.
5. **`process.md` stage 6** (:44): replace *"run single test files during the loop, the full suite once at the end"* with the rule of items 1 and 2 in one or two sentences.

#### Agent Validation Steps

```bash
git grep -n -E "full suite once\*\* at sub-phase end|after any slice that mutates shared state|re-check as soon as a slice" -- .claude/skills/timone-execute process.md; echo "exit: $?"   # expect 1
for f in process.md .claude/skills/timone-execute/SKILL.md; do git grep -c "ADR-0061" -- "$f" || echo "MISSING in $f"; done   # expect a count for each, no MISSING
git grep -n "## Tests run" -- .claude/skills/timone-execute/SKILL.md   # expect one line, inside the completion report template
git diff --stat -- . ':!process.md' ':!.claude/skills/timone-execute' ':!doc/plans/phases/reports/phase-42-handoffs.md'   # expect empty
```

- [ ] From the skill alone, a reader can say what a sub-phase runs at its end, what runs at the close and in what order, and where the report lists it.
- [ ] Stage 7's paragraph in `process.md` reads as 42b left it.
- [ ] Nothing else in stage 6 changed: TDD loop, gates, look check, commits and handoffs read as before.

### Sub-phase 42d: A box's first token is taken after the slow start-up, and its refresh interval is worked out once

> ✏ 2026-10-03 (build, timone#185): added after delivery. Both reviews of [pull request #193](https://github.com/fvermaut/timone/pull/193) are in [phase-42-delivery.md](reports/phase-42-delivery.md). fvermaut answered on 2026-10-03, in the terminal: fix all 8 findings on this branch before merging. This sub-phase answers Spec finding 1 and Standards finding 3.

**[MODIFY]** `src/daemon/container-runtime.ts` — in `containerRuntime(...).start`, work out the refresh interval once, `const refreshIntervalMs = options.refreshIntervalMs ?? FORGE_REFRESH_MS`, and use that one value both for the box token's `minLifeMs` (`refreshIntervalMs + BOX_TOKEN_MARGIN_MS`) and as the `intervalMs` passed to `keepForgeTokenFresh` (today it passes `options.refreshIntervalMs` unresolved, :1057-1059). Move the box's `tokenFor` call from the top of `start` (:909-923) to just before the box's environment is built — after `commitIsPushed`, `runEnv`, `services` and `modelToken`, and before the `env` that carries `GH_TOKEN` (:1001). The token is used nowhere before that line. Update the comment: the token is taken last so the start-up time does not eat the margin. ✏ 2026-10-03 (build, timone#185): a mint that fails now does so after `services` has started the stack, so the call takes the stack down before it throws again, as the model token's call just above already does; one test covers it. Found by the slice: the plan's move alone would have left the stack running.
**[MODIFY]** `src/daemon/container-runtime.test.ts` — the case below, in the block *"the forge token a running box works on"*.

**Seams under test (TDD):** `containerRuntime(...).start`, with a fake `services` that moves a fake clock forward, and a real `githubAppCredentials` behind a fake mint on the same clock — the same seam as 42a's falsifying test. Red-green:
1. The cache holds a token with 37 minutes left when `start` begins, and `services` takes 8 minutes on the fake clock. The token handed to the box is a newer mint, not the cached one (which would have 29 minutes left at spawn, 9 minutes past the first refresh — under the 10 PRD-06.R5 asks). Red on the current code.
2. The refactor of the interval carries no new behaviour; the existing tests in the block (the refresh waits its interval, the start asks for at least the interval plus 10 minutes, the longer-interval case) are its guard and must stay green.

> No dependency on 42e or 42f. It shares no file with them and may run beside 42e.

#### Agent Validation Steps

```bash
npx vitest run src/adapters/credentials.test.ts src/daemon/container-runtime.test.ts src/adapters/command-runner.test.ts; echo "exit: $?"   # expect 0
npx tsc --noEmit; echo "exit: $?"   # expect 0
grep -c "?? FORGE_REFRESH_MS" src/daemon/container-runtime.ts   # the default is applied once in start and once inside keepForgeTokenFresh: expect 2
git diff --stat -- . ':!src/daemon/container-runtime.ts' ':!src/daemon/container-runtime.test.ts' ':!doc/plans/phases/reports/phase-42-handoffs.md' ':!.claude/skills/timone-verify' ':!process.md'   # expect empty (42e's files excluded, it may run beside this one)
```

- [ ] Case 1 is seen red before the move, then green, in the handoff.
- [ ] In `start`, `tokenFor` is called after `services` and `modelToken` and before the box's environment is built.
- [ ] `keepForgeTokenFresh` receives the same interval value the start token was sized on.

---

### Sub-phase 42e: The checking rules use one word per idea, allow the read they need, and look at every screen again after a fix

> ✏ 2026-10-03 (build, timone#185): added after delivery, on fvermaut's answer above. This sub-phase answers Spec findings 2 and 5 and Standards findings 1 and 2.

**[MODIFY]** `.claude/skills/timone-verify/SKILL.md`
**[MODIFY]** `process.md` — the stage 7 paragraph only (:46)

**Seams under test (TDD):** no behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based.

> No dependency on 42d; it may run beside it. Sub-phase 42f edits `process.md` after this one.

Each change is marked `✏ Revised 2026-10-03 ([ADR-0061](…))` at the point of change, or folds into the 2026-10-02 marker already there when it rewrites that same sentence.

1. **The read the old/new rule needs (Spec 2, PRD-06.R3).** Add an item to the skill's **Read:** list (:38 is the HUMAN-CHECK item to model it on): the *Environment* section of the latest verification report on the default branch, and only its list of build-health smoke failures, read with `git show <default-branch>:<path>`. Say the same in `process.md`'s closed read list, worded as narrowly. Then the paragraph at :56 refers to that item instead of calling itself an addition to the list.
2. **One word per idea (Standards 1).** In the text this branch added, use the words the rest of the skill and stage 7 already use: a **pass** is one run of the checking step; the **verification report** is its report; **re-verify** is what follows a fix (step 3 becomes *A narrowed re-verify*, matching *brief-fix-reverify* and lines 184 and 260); in `process.md`, **stage 7** or **the verifier**, never "the checking step". Remove "check report", "this check", "this check's", "an earlier check", "the next check" and "re-check" from the branch's additions.
3. **The runner sentence (Standards 2).** Rewrite both the skill paragraph after *Run the set with one command* and `process.md`'s clause as short active sentences, for example: "The project's runner is a file this step owns. If it always does both runs, add an option that does real runs only, and commit that change with the report."
4. **Every screen again after a fix (Spec 5, PRD-06.R2).** R2 and ADR-0061 D2 speak only of probes. Restore the old rule for screens: after a fix, the screen read of *Reading the figures on the preview's data* runs again in full, as it did before ADR-0061. A `(browser)` clause is checked again when its criterion's probe is. Step 9 says the re-verify repeats step 8. The fix-loop accounting template no longer asks for "the screens read again". ✏ 2026-10-03 (build, timone#185): `process.md` stage 7 says the same, since 42b's sentence there named only probes and `process.md` outranks the skill. Found by the slice.

#### Agent Validation Steps

```bash
git grep -n -i -E "check report|this check'?s?\b|an earlier check|the next check|re-check|the checking step, whose|screens read again|screens that had a FAIL" -- .claude/skills/timone-verify/SKILL.md process.md; echo "exit: $?"   # expect 1
git grep -n -E "Environment" -- .claude/skills/timone-verify/SKILL.md | head   # the new Read: item is listed
git grep -n -E "repeats step 8" -- .claude/skills/timone-verify/SKILL.md   # expect a match in step 9
git diff --stat -- . ':!.claude/skills/timone-verify' ':!process.md' ':!doc/plans/phases/reports/phase-42-handoffs.md' ':!src/daemon/container-runtime.ts' ':!src/daemon/container-runtime.test.ts'   # expect empty (42d's files excluded)
```

- [ ] The **Read:** list and `process.md`'s closed list both name the one new read, and nothing else was added to either.
- [ ] A reader finds one word for each idea in the branch's additions: pass, verification report, re-verify.
- [ ] After a fix, every screen is read again; the text says so in the fix loop and in step 9.
- [ ] The rules of 42b are otherwise unchanged: the four break-run cases, the narrowed re-verify of probes, the smoke comparison.

---

### Sub-phase 42f: A slice is given the list of fast suites, and stage 6 requires the tests-run list

> ✏ 2026-10-03 (build, timone#185): added after delivery, on fvermaut's answer above. This sub-phase answers Spec findings 3 and 4.

**[MODIFY]** `.claude/skills/timone-execute/SKILL.md`
**[MODIFY]** `process.md` — the stage 6 paragraph only (:44)

**Seams under test (TDD):** no behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based.

> Sub-phase 42e must be complete before starting this sub-phase (both edit `process.md`).

Each change is marked `✏ Revised 2026-10-03 ([ADR-0061](…))`.

1. **The slice contract (Spec 3, PRD-06.R4).** Add a seventh item to *What a slice context receives — exactly this* (:97-106): the suites that take under a minute, as decided for the phase, and how that was decided. The *Which suites take under a minute* bullet then points to that item.
2. **Stage 6's required contents (Spec 4, PRD-06.R4).** In `process.md` stage 6, add to what a handoff note carries "the tests and suites run at sub-phase end", and to the completion report's required elements "the tests and suites each sub-phase ran, and the whole run of every suite at the close".

#### Agent Validation Steps

```bash
awk '/What a slice context receives/,/What a slice context returns/' .claude/skills/timone-execute/SKILL.md | grep -c -E "^[0-9]+\. "   # expect 7
git grep -n -E "whole run of every suite at the close" -- process.md   # expect one match, in stage 6
git diff --stat -- . ':!.claude/skills/timone-execute' ':!process.md' ':!doc/plans/phases/reports/phase-42-handoffs.md'   # expect empty
```

- [ ] A slice's input list names the fast suites, and nothing else was added to it.
- [ ] `process.md` stage 6 lists the tests-run contents for both the handoff and the completion report; stage 7's paragraph reads as 42e left it.

---

## Dependency graph

```
42a → (none)    the box's token outlives its next refresh (code, PRD-06.R5)
42b → (none)    the checking step's rules (text, PRD-06.R1–R3); may run beside 42a
42c → 42b       the building step's rules (text, PRD-06.R4, PRD-01.R16); shares process.md with 42b
42d → 42a       ✏ 2026-10-03: the box's first token after start-up; the interval worked out once (code, PRD-06.R5); may run beside 42e
42e → 42b       ✏ 2026-10-03: the checking rules' words, read list and screens (text, PRD-06.R2, R3)
42f → 42c, 42e  ✏ 2026-10-03: the slice contract and stage 6's required contents (text, PRD-06.R4); shares process.md with 42e
```
