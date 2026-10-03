# Phase 42 — Delivery Report

- **Date:** 2026-10-03
- **Phase:** [phase-42.md](../phase-42.md) — `Complete`, verified in [phase-42-verification.md](phase-42-verification.md)
- **Branch:** `timone/185-a-run-spends-its-time-on-the-work` @ `697cd12`
- **Base:** `main` — the branch was cut from the project's default branch at `bcd2d7d`
- **Pull request:** opened against this report; its address is in the session's closing message and on tickets #185 and #110
- **Screen:** no user-facing screen in this phase
- **Questions for the human:** 2 — one carried from the verification report (PRD-06.R5), one from this delivery (the review findings)
- **Departures:** [`phase-42-departures.md`](phase-42-departures.md) — 5 entries

## Scope

The phase claims PRD-06.R1–R5 and the revised PRD-01.R16, from [PRD-06](../../../specs/prd/prd-06-a-run-spends-its-time-on-the-work.md) and [ADR-0061](../../../adr/0061-a-check-script-proves-itself-once-and-a-fix-re-runs-what-it-can-affect.md). Tickets: #185, with #110; R5 is the first half of #71.

- A box asks the shared token cache for a token that outlives its own refresh interval by 15 minutes (R5).
- The checking step does a probe's break run only when the probe is new, rewritten, in doubt, or a shared probe on a page it has never checked (R1). After a fix it runs again only the probes that failed and those the fix's changed file names can affect (R2). It tells old smoke failures from new ones by the last report's list (R3).
- The building step runs the tests a sub-phase's change can affect and the suites under a minute, and runs everything whole once at the close (R4, PRD-01.R16).

The review subject is the seven non-process files: `src/adapters/credentials.ts`, `src/adapters/credentials.test.ts`, `src/daemon/container-runtime.ts`, `src/daemon/container-runtime.test.ts`, `.claude/skills/timone-verify/SKILL.md`, `.claude/skills/timone-execute/SKILL.md`, `process.md`. The probe runner's three files and the shared probes' README were changed by the checking step, in its own folders. Neither review read them; the verification report describes the change.

## How to try it

### Against the preview

Timone has no preview configured for pull requests. Use the local steps.

### On a local checkout

Set up as the project's [README](../../../../README.md) says. Then:

1. `git switch timone/185-a-run-spends-its-time-on-the-work && npm run build && npx vitest run --passWithNoTests` — 56 files and 1417 tests pass. The build matters: `src/cli.test.ts` runs the built program.
2. `npx vitest run src/daemon/container-runtime.test.ts -t "never handed a token"` — one test passes. It is R5's falsifying test. It starts a box on a fake clock while the cache holds a token with 25 minutes left, and checks the box gets a new token at start and at its refresh.
3. Read the new checking rules in `.claude/skills/timone-verify/SKILL.md`: *Red before green* (the four cases for a break run), the paragraph after *Run the set with one command*, and step 3 of *The fix loop*.
4. Read the new building rules in `.claude/skills/timone-execute/SKILL.md`: *Rhythm*, *Which suites take under a minute*, *Closing the phase*, and the completion report's *Tests run* section.
5. In the probe folder under `doc/plans/phases`, run `node run.mjs --regression` against a running stack: each probe prints `break leg: not run — real run only`. With `--with-break`, every probe does both runs, as before.

## Verification outcome

Verified in [phase-42-verification.md](phase-42-verification.md) — 0 of 2 fix loops consumed. No FAIL, no regression.

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-06.R1 | MUST | live | LIVE-GATE | 0 |
| PRD-06.R2 | MUST | live | LIVE-GATE | 0 |
| PRD-06.R3 | MUST | live | LIVE-GATE | 0 |
| PRD-06.R4 | MUST | live | LIVE-GATE | 0 |
| PRD-06.R5 | MUST | api | BLOCKED | 0 |
| PRD-01.R16 | MUST | human | HUMAN-CHECK | 0 |
| PRD-05.R2 | MUST | api (regression) | PASS | 0 |
| PRD-05.R3 | MUST | api (regression) | PASS | 0 |
| PRD-05.R4 | MUST | api (regression) | PASS | 0 |
| PRD-05.R5 | MUST | api (regression) | PASS | 0 |
| PRD-05.R7 | MUST | api (regression) | PASS (one clause BLOCKED, as before) | 0 |
| PRD-05.R10 | MUST | api (regression) | PASS | 0 |
| PRD-05.R11 | MUST | api (regression) | PASS | 0 |
| PRD-05.R18 | MUST | api (regression) | BLOCKED | 0 |

### Outstanding for the human

- [ ] PRD-06.R5 — decide how it is checked (question 1 in the pull request).
- [ ] PRD-06.R1–R4 — live gate owed: a watched check and a watched build on the scratch-app fixture, with the daemon on this branch's code. The steps are each criterion's verification hint in [the criteria register](../../../specs/prd/prd-06-a-run-spends-its-time-on-the-work.criteria.md).
- [ ] PRD-05.R18, and PRD-05.R7's real-runner clause — run the replay on this branch: `npm run --silent replay`.
- [ ] PRD-01.R16 — HUMAN-CHECK script in [phase-42-verification.md](phase-42-verification.md) § HUMAN-CHECK scripts, after the first build of two or more sub-phases under the new rule.
- [ ] The other `live` criteria whose declared files this diff touches — listed in [phase-42-verification.md](phase-42-verification.md) § Live gates.

## Standards review — phase 42

- **Read:** the review-subject diff; `standards/code-smells.md`, `standards/typescript.md`, `standards/testing.md`; `tsconfig.json` and the `package.json` scripts; for context, the current text of the seven files, and the `origin/main` versions of the two skills, `timone-deliver/SKILL.md` and `process.md`.
- **Diff:** `origin/main...697cd12` — 7 files in the review subject
- **Findings:** 3

### 1. The same thing goes by two names: "pass" and "check", "re-verify" and "re-check", "verification report" and "check report", "stage 7" and "the checking step" — Inconsistent vocabulary

- **Where:** `.claude/skills/timone-verify/SKILL.md:56`, `:138`, `:157`, `:188`–`:193`; `process.md:46`
- **What:** The verify skill's word for one verification run is "pass". The diff adds "check" as a second name (lines 56, 138, 157, 192). Step 3 of the fix loop is renamed "A narrowed re-check", while the next, unchanged line still says "That brief-fix-reverify cycle" (193), as do lines 184 and 260. In `process.md` the new text says "the last check report" where the rest of the stage says "verification report", and "the checking step" where the same paragraph says "stage 7".
- **Why it matters:** One idea has two names within a few paragraphs, and a reader cannot tell whether they mean the same thing. CLAUDE.md's plain-English rule asks for the same common word each time.
- **Suggested remediation:** Use the established words ("pass", "verification report", "stage 7" or "the verifier"), or rename the remaining "re-verify" lines to match. — not applied here

### 2. The sentence telling the verifier to change the project's probe runner has to be read twice — plain English

- **Where:** `process.md:46`; `.claude/skills/timone-verify/SKILL.md:157`
- **What:** `process.md`: "a project's runner that does both runs by default is given a way to run real runs only by the checking step, whose file it is." It is passive, and "only by the checking step" can be read as "only the checking step may run it". The skill: "give it a way to run real runs only, or add one to it" says the same thing twice, and "it" and "one" point at different things.
- **Why it matters:** CLAUDE.md: the reader does not read English as a first language, and "a sentence he has to decode costs him time."
- **Suggested remediation:** Short active sentences: "The project's runner is a file this step owns. If it always does both runs, add an option that does real runs only. Commit that change with the report." — not applied here

### 3. The rule for how long a box's token must last is written twice, with its default interval worked out separately each time — Duplicated code

- **Where:** `src/daemon/container-runtime.ts:805`, `:830`–`:834`, `:909`–`:923`
- **What:** `keepForgeTokenFresh` asks for `intervalMs + BOX_TOKEN_MARGIN_MS`, with `intervalMs = options.intervalMs ?? FORGE_REFRESH_MS`. `start` restates both the default and the sum, then passes `options.refreshIntervalMs` unresolved to `keepForgeTokenFresh`, which applies its own default. Only a comment keeps the two the same.
- **Why it matters:** If one default changes, the start token and the refresh loop no longer agree, and nothing fails.
- **Suggested remediation:** Work out the interval once in `start` and pass it on, or a small helper both places call. — not applied here

## Spec review — phase 42

- **Read:** the review-subject diff; the PRD-06 pair; the PRD-01.R16 block; `phase-42.md` down to the end of *Requirements*; for context, the current two skills, `src/adapters/credentials.ts` and `src/daemon/container-runtime.ts`; and, to check no other path hands a token to a box, excerpts of `src/adapters/command-runner.ts`, `src/commands/daemon.ts` and `src/daemon/services.ts`.
- **Diff:** `origin/main...697cd12` — 7 files in the review subject
- **Findings:** 5

### 1. The box's first token is taken before the slow start-up steps, but the refresh timer starts only after the spawn — PRD-06.R5

- **Where:** `src/daemon/container-runtime.ts:909–922`, `:958`, `:967`, `:1015`, `:1058`
- **What:** `start()` asks for the token first. Then it runs `commitIsPushed`, `runEnv`, `options.services(request)` (the clone and `docker compose up --wait`, up to 180 + 60 s in `services.ts`) and `options.modelToken()`, and only then spawns the box. The refresh loop starts after the spawn and first waits a full interval. So the box gets 35 minutes minus the start-up time, with the next refresh still 20 minutes away. The 15-minute margin covers R5's 10 minutes only while start-up stays under 5 minutes, and the code does not tie the two together.
- **Why it matters:** R5 clause 2 measures life "when it is handed over". A slow stack or clone would break it without anyone noticing; the falsifying test has no `services` step.
- **Suggested remediation:** Take the token just before the box's environment is built, after services and the model token, or add the start-up time to `minLifeMs`; add a test where time passes inside `services`. — not applied here

### 2. The closed read list still forbids the read that the old/new marking needs — PRD-06.R3

- **Where:** `.claude/skills/timone-verify/SKILL.md:38` and `:56`; `process.md:46`
- **What:** The new paragraph at :56 tells the verifier to open the *Environment* section of the last report on the default branch, "the one read this rule adds to the list". The list item at :38 still says a prior report's HUMAN-CHECK section "and nothing else of it". `process.md`'s closed list is unchanged too.
- **Why it matters:** A verifier following the closed list cannot open the list R3 clause 1 marks old and new against.
- **Suggested remediation:** Add the *Environment* section of the last default-branch report to the skill's **Read:** list and to `process.md`'s closed list, worded as narrowly as the HUMAN-CHECK item. — not applied here

### 3. A slice must be told which suites take under a minute, but the slice's input list does not include them — PRD-06.R4, PRD-01.R16

- **Where:** `.claude/skills/timone-execute/SKILL.md:97–106` and `:138`
- **What:** :138 says the orchestrator names the suites under a minute in each slice's prompt. The sub-agent contract still says a slice receives "exactly this" six items, then "Nothing else … not your reasoning about the phase."
- **Why it matters:** R4 clause 1 needs the slice to know those suites, and the contract forbids passing them.
- **Suggested remediation:** Add a seventh item to "What a slice context receives": the suites that take under a minute, with how that was decided. — not applied here

### 4. `process.md` does not add the per-sub-phase test list to the completion report's required contents — PRD-06.R4

- **Where:** `process.md:44` (stage 6, "Completion report … required elements")
- **What:** Only the skill's template adds `## Tests run`; the list of required elements in `process.md` is unchanged.
- **Why it matters:** R4 clause 3 says the completion report lists what each sub-phase ran, and R4 names `process.md` in `Depends-on`.
- **Suggested remediation:** Add "the tests and suites each sub-phase ran, and the whole-suite run at the close" to the stage 6 list. — not applied here

### 5. Screens are no longer all looked at again after a fix, which R2 does not ask for, and the skipped screens are not listed with a reason — PRD-06.R2

- **Where:** `.claude/skills/timone-verify/SKILL.md:192`, `:285`, `:318`
- **What:** The re-check also narrows the screen read after a fix. R2 and the PRD talk only about probes. The fix-loop template records only the screens read again, not the ones skipped.
- **Why it matters:** It goes beyond R2, and falls short of the PRD goal "What is skipped is always visible".
- **Suggested remediation:** Keep the full screen re-read after a fix, or keep the narrowing and list every changed screen not read again, with its reason. — not applied here

## Notes

- `STATUS.md` was updated on `main` by the checking step (`2d1a9f4`) and again by this delivery.
- Filed on the way, not part of this pull request: [#192](https://github.com/fvermaut/timone/issues/192), the probe guard refuses a prompt or a commit that only names a probe folder.

## Iteration 2 — 2026-10-03

- **Branch:** `timone/185-a-run-spends-its-time-on-the-work` @ `7df29f9`
- **What changed since the first delivery:** fvermaut answered both questions in the terminal on 2026-10-03 ([comment on #193](https://github.com/fvermaut/timone/pull/193#issuecomment-5966801325)): accept the builder's test for PRD-06.R5, and fix all 8 findings before merging. Sub-phases 42d, 42e and 42f fixed them (`5eac980`, `f83c736`, `390d574`); the phase was closed again (`d62329d`) and checked again ([phase-42-verification.md](phase-42-verification.md), *Iteration 2*, `7df29f9`): no FAIL, no regression, PRD-06.R5 `verified` on the builder's test by his decision.
- **Axes re-run:** yes, both, because the review subject changed (code in `src/daemon/container-runtime.ts` and its test, both skills, `process.md`).
- **The first delivery's 8 findings:** all 8 are answered by 42d–42f, and none is raised again below.
- **New findings:** Standards 6, Spec 2. None breaks the build.
- **Departures:** 8 entries now (3 added since the first delivery: two by the build, one by the check).

### Standards review — phase 42, iteration 2

- **Read:** the review-subject diff (`origin/main...7df29f9`, whole); `standards/code-smells.md`, `standards/typescript.md`, `standards/testing.md`; `tsconfig.json`; the `scripts` block of `package.json`; for context, parts of `src/daemon/container-runtime.ts`, `src/adapters/credentials.ts`, `src/daemon/container-runtime.test.ts`, and greps of the `origin/main` and HEAD versions of the two skills and `process.md`.
- **Diff:** `origin/main...7df29f9` — 7 files in the review subject
- **Findings:** 6

#### 1. The "take the stack down if this fails" block is copied a second time, and the cleanup line now appears four times in `start()` — Duplicated code (also Long function)

- **Where:** `src/daemon/container-runtime.ts:966–978`, next to `:952–959`; the cleanup line at `:957`, `:976`, `:1044`, `:1159`
- **What:** The new token fetch copies the shape of the model-token block above it, and adds the fourth copy of `if (stack !== undefined) await stack.down().catch(() => undefined);` in one function, which runs from line 900 to 1186.
- **Why it matters:** code-smells.md, Duplicated code: "A repeated one-liner counts … the copies are what the fourth sibling will forget."
- **Suggested remediation:** One local helper inside `start()`, used in all four places. — not applied here

#### 2. The diff names the two runs "break run" and "real run", then calls them "legs" in the same sentence — Inconsistent vocabulary

- **Where:** `.claude/skills/timone-verify/SKILL.md:146`; `process.md:46`
- **What:** "When both runs happen, green on both legs means the instrument is broken." Elsewhere in the skill, "leg" means the browser channel's baseline leg.
- **Why it matters:** one word per idea.
- **Suggested remediation:** "when both runs happen and the probe passes on both, the probe is broken". — not applied here

#### 3. A ✏ marker sits on a change of wording only, and links an ADR that changed nothing there — the ✏ marker convention

- **Where:** `process.md:46` (stage 7, register writes)
- **What:** The only change is `re-checked,` → `checked again ✏ Revised 2026-10-03 (…),`. No rule changed.
- **Why it matters:** a dated marker means a rule changed there.
- **Suggested remediation:** keep the words, remove the marker. — not applied here

#### 4. A clause in the slice's input list can be read the wrong way — plain English

- **Where:** `.claude/skills/timone-execute/SKILL.md:105` (item 7)
- **What:** "from the run before the first slice that is stopped after one minute" reads as if the slice is stopped.
- **Why it matters:** the reader has to work the sentence out.
- **Suggested remediation:** "from one whole run of it before the first slice, stopped after one minute". — not applied here

#### 5. Figurative wording and very long sentences in the new text — plain English

- **Where:** `.claude/skills/timone-verify/SKILL.md:193`; `process.md:46`; `src/daemon/container-runtime.test.ts:1538`
- **What:** "sends every probe in scope again"; a test named "…does not eat its margin"; sentences of about 65 words in `process.md` stage 7.
- **Why it matters:** no metaphors, short sentences.
- **Suggested remediation:** "every probe in scope runs again"; rename the test; split the sentences as the skill does. — not applied here

#### 6. A doc comment states a computed number as a fixed fact — Magic number (in a comment)

- **Where:** `src/daemon/container-runtime.ts:261–262`
- **What:** "a fresh one always has the 35 minutes a box asks for" — true only for the default interval, since the interval is an option.
- **Why it matters:** the comment goes wrong silently when a constant or the option changes.
- **Suggested remediation:** state the rule in words: the refresh interval plus the margin must stay under the one hour a token lives. — not applied here

### Spec review — phase 42, iteration 2

- **Read:** the review-subject diff (`origin/main...7df29f9`, whole); the PRD-06 pair; the PRD-01.R16 block; `phase-42.md` down to the end of *Requirements*; for context, parts of `src/daemon/container-runtime.ts`, `src/adapters/credentials.ts`, the two skills and `process.md`.
- **Diff:** `origin/main...7df29f9` — 7 files in the review subject
- **Findings:** 2

R5 holds against every clause: the box token is taken after the stack and the model token are ready, nothing waits between taking it and creating the box, and the refresh loop waits the same interval the token was sized on. R2 and R3 match their clauses. No scope creep.

#### 1. The rules do not say what to do when a sub-phase's validation steps run a slow suite whole — PRD-06.R4

- **Where:** `.claude/skills/timone-execute/SKILL.md:138`, `:184`, `:250`; `process.md:44`
- **What:** A sub-phase must not run a slow suite whole, and its own validation steps must pass "as written". When a validation step itself runs the browser suite whole, the text does not say which rule wins. A session following it runs the suite at the sub-phase end and again at the close, so the repeated browser runs of #110 could survive.
- **Why it matters:** R4 clause 1 ("not the other suites whole" and "its own validation steps pass") and clause 2 (each suite whole once at the close) conflict in that case.
- **Suggested remediation:** say that such a step is not run at the sub-phase end, the close's whole run of that suite satisfies it, and the handoff records this; or have plans stop writing validation steps that run a slow suite whole. — not applied here

#### 2. A probe that no pass has seen fail can now pass without a break run — PRD-06.R1

- **Where:** `.claude/skills/timone-verify/SKILL.md:130–139`, `:282`; `process.md:46`
- **What:** None of the four break-run cases covers an earlier probe that was never seen to fail (for example one whose earlier break run stayed green). Under the new text, its next pass is a real run only, and green counts as PASS. The verifier cannot tell such a probe from a proved one, because nothing it may read records which probes were proved.
- **Why it matters:** R1 clause 1 is followed to the letter, but the rule's own premise — a pass counts only after the probe has been seen to fail — is broken for this case.
- **Suggested remediation:** a fifth case: an earlier probe with no recorded red result does its break run, with that result recorded where the verifier may read it (for example a line in the probe file); amend R1 to name it. — not applied here
