# Phase 42 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 42a — A box is never handed a token that dies before its next one

**Built.** `tokenFor` now takes an optional `minLifeMs`. The token cache reuses a cached token only if it has more life left than the larger of 5 minutes and `minLifeMs`. Otherwise it mints a new token and caches it. The two calls that hand a token to a box now ask for enough life. The box spawn asks for the interval its own refresh loop will wait + 15 minutes: 20 + 15 = 35 minutes by default. The refresh loop asks for its own interval + 15 minutes. The other two calls (`command-runner.ts:328`, `daemon.ts:336`) pass nothing, so they still reuse a token until 5 minutes are left.

**Files touched.**
- `src/adapters/credentials.ts` — `tokenFor(repository, options?: { minLifeMs?: number })` on `CredentialProvider` and in `githubAppCredentials`. The interface comment now says what `minLifeMs` is for. The cache check uses `Math.max(EXPIRY_MARGIN_MS, minLifeMs ?? 0)`.
- `src/daemon/container-runtime.ts` — new `BOX_TOKEN_MARGIN_MS = 15 * 60 * 1000` below `FORGE_REFRESH_MS`. The comment on `FORGE_REFRESH_MS` now states the rule: every token a box receives must outlive the next refresh by the margin. `keepForgeTokenFresh` passes `{ minLifeMs: intervalMs + BOX_TOKEN_MARGIN_MS }`. The spawn passes `{ minLifeMs: (options.refreshIntervalMs ?? FORGE_REFRESH_MS) + BOX_TOKEN_MARGIN_MS }`, as amended in the plan on 2026-10-02 (see below).
- `src/adapters/credentials.test.ts` — new block "a token that must live a given time", with cases 1 and 2.
- `src/daemon/container-runtime.test.ts` — cases 3, 4 and 5, and the amendment's test, in the block "the forge token a running box works on". New imports for the key file, and for `githubAppCredentials` and `MintCall`.
- `doc/plans/phases/reports/phase-42-handoffs.md` — created, with this section.

**Decisions taken inside the slice.**
1. The parameter is named `tokenOptions` inside `githubAppCredentials`, because `options` there is already the provider's own options.
2. The test fakes record the options object, and the tests check `asked[0]?.minLifeMs ?? 0`. A call with no options asks for no extra life, so 0 is the right reading. It also gives a clean failure message: "expected 0 to be greater than or equal to …".
3. Case 3 passes an explicit 30-minute interval and expects at least 40 minutes. A 30-minute interval fails if the call used the 20-minute constant instead of the interval (20 + 15 = 35 is less than 40).
4. Case 5 needs a box that keeps running until the refresh has run. The existing `fakeContainer` ends at once, and `liveContainer` lives in another block. So the test has its own small spawn that holds the box open until the test ends it. It also writes a real RSA key to a temp folder, because the real cache signs a JWT before it calls the mint. This is the same approach as `credentials.test.ts`.
5. In case 5 the clock moves to 12:55 before the refresh. At that time the box's own token (minted at 12:35) has 40 minutes left, so the refresh reuses it. The test therefore checks that both the start and the refresh hand over `ghs_minted_at_12:35`, and never `ghs_minted_at_12:00`.
6. The comment on `BOX_TOKEN_MARGIN_MS` gives a reason for 15 rather than 10: a refresh that runs a little late still finds the token alive. The plan gives the number and not the reason, so this reason is mine.

7. **The gap this slice found is closed.** The plan first had the spawn ask for `FORGE_REFRESH_MS` + 15 minutes. But the refresh loop it starts waits `options.refreshIntervalMs ?? FORGE_REFRESH_MS`. So a caller that set `refreshIntervalMs` above 20 minutes would have given the box a first token that does not follow the rule. I reported it, the plan was amended (✏ 2026-10-02 on the spawn's line), and the spawn now asks for `(options.refreshIntervalMs ?? FORGE_REFRESH_MS) + BOX_TOKEN_MARGIN_MS`. The trace is under "Amendment" below.

**What I would refactor (deferred).**
- The spawn and the refresh loop each work out the same interval (`options.refreshIntervalMs ?? FORGE_REFRESH_MS` in the spawn, `options.intervalMs ?? FORGE_REFRESH_MS` in the loop). They could compute it once and share it.
- The fake container that stays open in case 5 is close to `liveContainer` in the interactive block. One shared helper at file level could serve both.

**Validation evidence.**

*Case 1* — "mints again when the cached token would die before the life asked for" (`credentials.test.ts`). Red before the code:

```
× a token that must live a given time > mints again when the cached token would die before the life asked for 4ms
  → expected 'ghs_first' to be 'ghs_second' // Object.is equality
❯ src/adapters/credentials.test.ts:148:19
Tests  1 failed | 8 passed (9)
```

Green after the change to `tokenFor`: `Tests  9 passed (9)`. `tsc --noEmit` exit 0.

*Case 2* — "still reuses a token with 25 minutes left when no life is asked for". It arrived green (`Tests  10 passed (10)`), as the plan expected. Proved by mutation: `EXPIRY_MARGIN_MS` changed from `5 * 60 * 1000` to `35 * 60 * 1000`:

```
× a token that must live a given time > still reuses a token with 25 minutes left when no life is asked for 4ms
  → expected 'ghs_second' to be 'ghs_first' // Object.is equality
❯ src/adapters/credentials.test.ts:170:19
Tests  1 failed | 9 passed (10)
```

Restored from a copy. The constant reads `5 * 60 * 1000` again, and `Tests  10 passed (10)`.

*Case 3* — "asks for a token that outlives the next refresh by ten minutes" (`container-runtime.test.ts`). Red before the code:

```
× the forge token a running box works on > asks for a token that outlives the next refresh by ten minutes 11ms
  → expected 0 to be greater than or equal to 2400000
❯ src/daemon/container-runtime.test.ts:1389:38
Tests  1 failed | 84 skipped (85)
```

Green after adding `BOX_TOKEN_MARGIN_MS` and the `minLifeMs` on the refresh call: `Tests  85 passed (85)`. `tsc --noEmit` exit 0.

*Case 4* — "starts a box with a token that outlives its first refresh by ten minutes". Red before the code:

```
× the forge token a running box works on > starts a box with a token that outlives its first refresh by ten minutes 4ms
  → expected 0 to be greater than or equal to 1800000
❯ src/daemon/container-runtime.test.ts:1413:38
Tests  1 failed | 85 skipped (86)
```

Green after the `minLifeMs` on the spawn's call: `Tests  86 passed (86)`. `tsc --noEmit` exit 0.

*Case 5* — the falsifying test, "a box is never handed a token that dies before its next refresh". It arrived green, because cases 3 and 4 had already changed the code: `Tests  1 passed | 86 skipped (87)`. Proved by mutation, as the plan asks: the line `{ minLifeMs: FORGE_REFRESH_MS + BOX_TOKEN_MARGIN_MS },` was deleted from the spawn's call (`container-runtime.ts:915`). The falsifying test went red, and case 4 with it:

```
× the forge token a running box works on > starts a box with a token that outlives its first refresh by ten minutes 3ms
  → expected 0 to be greater than or equal to 1800000
× the forge token a running box works on > a box is never handed a token that dies before its next refresh 115ms
  → expected 'ghs_minted_at_12:00' to be 'ghs_minted_at_12:35' // Object.is equality
❯ src/daemon/container-runtime.test.ts:1503:23
    1503|       expect(atStart).toBe("ghs_minted_at_12:35");
Tests  2 failed | 85 passed (87)
```

The box got the noon token with 25 minutes left, which is the fault from 6 September. Restored from a copy. `grep minLifeMs` shows both calls again (:832 and :915), and `Tests  87 passed (87)`.

*Agent validation steps, run after the last edit.*

```
$ npx vitest run src/adapters/credentials.test.ts src/daemon/container-runtime.test.ts src/adapters/command-runner.test.ts; echo "exit: $?"
 ✓ src/adapters/command-runner.test.ts (28 tests)
 ✓ src/adapters/credentials.test.ts (10 tests)
 ✓ src/daemon/container-runtime.test.ts (87 tests)
 Test Files  3 passed (3)
      Tests  125 passed (125)
exit: 0

$ npx tsc --noEmit; echo "exit: $?"
exit: 0

$ git grep -n "tokenFor(" -- 'src/*.ts' ':!*.test.ts'
src/adapters/command-runner.ts:328:    const token = await options.credentials.tokenFor(repository);
src/adapters/credentials.ts:74:  tokenFor(repository: string, options?: { minLifeMs?: number }): Promise<string>;
src/adapters/credentials.ts:202:    async tokenFor(repository, tokenOptions) {
src/commands/daemon.ts:336:                      token: await credentials.tokenFor(
src/daemon/container-runtime.ts:832:        const token = await options.credentials.tokenFor(options.repository, {
src/daemon/container-runtime.ts:914:          : await options.credentials.tokenFor(
```

The call at `daemon.ts:336` passes only `repoSlug(workspace.project.remote)`. Only the two calls in `container-runtime.ts` pass `minLifeMs` (:833 and :916).

Whole suite, once, after `npm run build`: `Test Files  56 passed (56)`, `Tests  1416 passed (1416)`. That is 1411 before, plus the 5 new tests.

- [x] Cases 1–5 each have red evidence before green. Cases 1, 3 and 4 were red before their code. Case 2 was proved by mutation (default window set to 35 minutes). Case 5 was proved by mutation (spawn's `minLifeMs` removed).
- [x] The falsifying test's mutation run is above, with its failure message.
- [x] `src/adapters/command-runner.ts` and `src/commands/daemon.ts` are unchanged: `git diff --stat` on both is empty.

*Amendment (✏ 2026-10-02): the spawn asks for the interval its own refresh loop will wait.* Test "starts a box with a token that outlives a longer refresh interval by ten minutes". It starts a box with `refreshIntervalMs` set to 30 minutes and expects `tokenFor` to be asked for at least 30 + 10 = 40 minutes (2,400,000 ms). Red before the code, because the spawn still asked for 20 + 15 = 35 minutes:

```
× the forge token a running box works on > starts a box with a token that outlives a longer refresh interval by ten minutes 4ms
  → expected 2100000 to be greater than or equal to 2400000
❯ src/daemon/container-runtime.test.ts:1444:38
Tests  1 failed | 87 skipped (88)
```

Green after the spawn's call changed to `(options.refreshIntervalMs ?? FORGE_REFRESH_MS) + BOX_TOKEN_MARGIN_MS`: `Tests  1 passed | 87 skipped (88)`.

The case 5 mutation, run again on the new form of the call. I removed the whole `{ minLifeMs: … }` argument from the spawn's call. The falsifying test went red again, with case 4 and the amendment's test:

```
× … starts a box with a token that outlives its first refresh by ten minutes 3ms
  → expected 0 to be greater than or equal to 1800000
× … starts a box with a token that outlives a longer refresh interval by ten minutes 0ms
  → expected 0 to be greater than or equal to 2400000
× … a box is never handed a token that dies before its next refresh 72ms
  → expected 'ghs_minted_at_12:00' to be 'ghs_minted_at_12:35' // Object.is equality
Tests  3 failed | 85 passed (88)
```

Restored from a copy (`diff` against it is empty), then `Tests  88 passed (88)`.

Validation steps run again after the amendment:

```
$ npx vitest run src/adapters/credentials.test.ts src/daemon/container-runtime.test.ts src/adapters/command-runner.test.ts; echo "exit: $?"
 ✓ src/adapters/command-runner.test.ts (28 tests)
 ✓ src/adapters/credentials.test.ts (10 tests)
 ✓ src/daemon/container-runtime.test.ts (88 tests)
 Test Files  3 passed (3)
      Tests  126 passed (126)
exit: 0

$ npx tsc --noEmit; echo "exit: $?"
exit: 0

$ git grep -n "tokenFor(" -- 'src/*.ts' ':!*.test.ts'
src/adapters/command-runner.ts:328:    const token = await options.credentials.tokenFor(repository);
src/adapters/credentials.ts:74:  tokenFor(repository: string, options?: { minLifeMs?: number }): Promise<string>;
src/adapters/credentials.ts:202:    async tokenFor(repository, tokenOptions) {
src/commands/daemon.ts:336:                      token: await credentials.tokenFor(
src/daemon/container-runtime.ts:832:        const token = await options.credentials.tokenFor(options.repository, {
src/daemon/container-runtime.ts:916:          : await options.credentials.tokenFor(
```

Still only the two calls in `container-runtime.ts` pass `minLifeMs` (:833 and :919). `git diff --stat` on `src/adapters/command-runner.ts` and `src/commands/daemon.ts` is still empty.

Whole suite, once, after `npm run build` (exit 0): `Test Files  56 passed (56)`, `Tests  1417 passed (1417)`, exit 0. That is 1411 before the slice, plus 6 new tests.

**What 42b must know.** Nothing. 42b edits text only.

## 42b — The checking step proves each probe once and re-runs only what a fix can affect

**Built.** A checking session now does a probe's break run, then its real run, in four cases only: the probe is written this pass, it is written again because its criterion is `revised`, its result is in doubt because the build-health smoke contradicts it, or it is a shared baseline probe run against a page it has never been run against. Every other run of a probe is the real run only, and the report lists those probes by criterion ID. After a fix, the session runs again only the probes that failed and the probes whose criterion the fix commit's changed files can affect. It judges that from `git show --name-only --format= <sha>` and the criteria's `Depends-on` lines. A fix to a file many criteria rest on sends every probe in scope again. No run of the whole set follows the last fix, and the report lists every probe in scope not run again, with the reason. When the smoke has failing tests, the session marks each one old or new against the list in the last check report on the default branch, and names that report. It never checks out, builds or runs the default branch to compare. The never-read list now allows a list of changed file names, and nothing else of a change.

**Files touched.**
- `.claude/skills/timone-verify/SKILL.md` — *Never read*: the exception for lists of file names. After the instrument alarm paragraph: a new paragraph on old and new smoke failures. *The probes*: *Red before green* rewritten — the two runs defined, the four cases, the real run only otherwise, and the accepted risk in place of the old sentence on decay. *The fix loop*: step 3 is now the narrowed re-check. Report template: the smoke line under *Environment*, *Probes*, and *Fix-loop accounting*. *Workflow*: steps 7 and 9.
- `process.md` — the stage 7 paragraph only: the probe sentence (item 1), the fix-loop sentence (item 2), and the smoke rule after the sentence on the build-health smoke (item 4). "described next" became "described below", because the smoke rule now sits between that sentence and the probes.
- `doc/plans/phases/reports/phase-42-handoffs.md` — this section.

**Decisions taken inside the slice.**
1. Case 1 also covers a clause added to a probe to close a gap. That clause's check has never been seen to fail. Without this, the rule "a pass counts only after the probe has been seen to fail" would not hold for it.
2. Case 4 adds one sentence: when the checker cannot tell whether a baseline probe has run against a page before, it treats the page as new. The skill names no record of which pages a baseline probe has seen. Doing the break run when in doubt is the old behaviour, so it cannot hide a fault.
3. A criterion with no `Depends-on` line is judged from the fix's file names alone, and run again when the checker cannot tell. The plan says "judged from the names and the `Depends-on` lines" and does not cover a criterion with no line.
4. A `(browser)` clause is checked again only when its criterion is. A screen of the figures read is read again when a finding on it was a FAIL, or when the fix's files can affect it. This is the plan's "follow the same narrowing" applied per screen, since a screen is not a criterion. For the same reason the fix-loop accounting template also asks for the screens read again.
5. "The last check report on the default branch" is written as the verification report there with the highest phase number, and its latest iteration. The checker prints it with `git show <default-branch>:<path>` and reads only its *Environment* section, where the template now puts the list. The allowed read list is closed, so the new paragraph says that this is the one read the rule adds, the same kind of carve-out as a prior report's HUMAN-CHECK scripts section. The bullets of the read list are unchanged.
6. A report whose smoke passed whole is an empty list, so every failure now is new. A report with no smoke result, or with failures counted but not named, is no list: the failures are reported unmarked. A report written before this change may give a count of failures without their names; the first check after it then reports unmarked.
7. The skill says "never check out, build or run the default branch". The plan says "build or run"; PRD-06.R3's verification hint also searches the session record for a checkout, so the skill names it.
8. Inside the report template's code block the markers use the short form `✏ ADR-0061:`, as `✏ ADR-0057.` does there. A link does not show inside a code block.
9. The never-read exception is not added to `process.md`'s own never-read sentence, because item 6 does not list it. The new fix-loop sentence there says the judgement uses "the names of the files the fix commit changed (never its contents)", which carries the same limit.

**Validation evidence.** No behaviour-carrying code in this slice, so no seams were declared and there is no red-green trace; validation is checklist-based. The four commands, run after the last edit:

```
$ git grep -n -E "every run does both legs|One full re-verify|full re-verify \(which repeats|in this run, on this build|catches decay for free" -- process.md .claude/skills/timone-verify; echo "exit: $?"
exit: 1

$ for f in process.md .claude/skills/timone-verify/SKILL.md; do git grep -c "ADR-0061" -- "$f" || echo "MISSING in $f"; done
process.md:1
.claude/skills/timone-verify/SKILL.md:9

$ git grep -n -E "name-only" -- .claude/skills/timone-verify/SKILL.md
.claude/skills/timone-verify/SKILL.md:48:- **Diffs, `git show` of code, `git log -p`** — source intent in another costume. ✏ Revised 2026-10-02 (… D2): **one exception — a list of changed file names is not a diff.** `git diff --name-only` and `git show --name-only --format=` …
.claude/skills/timone-verify/SKILL.md:188:   - **every probe whose criterion the fix commit's changed files can affect.** Get the names of those files with `git show --name-only --format= <sha>` …

$ git diff --stat -- . ':!process.md' ':!.claude/skills/timone-verify' ':!doc/plans/phases/reports/phase-42-handoffs.md'
(empty)
```

`process.md` counts 1 because the whole stage 7 paragraph is one line; it carries three markers (D1, D2, D4).

- [x] From the skill alone, a reader can say in which four cases a probe does its break run, what runs after a fix, and how a smoke failure is marked old or new.
  - Four cases: *"1. **It is written this pass** … 2. **It is written again this pass because its criterion is `revised`.** 3. **Its result is in doubt** — the build-health smoke fails behaviour its real run passes, or passes behaviour it fails … 4. **It is a shared baseline probe, run against a page it has never been run against.**"* and *"**Every other run of a probe is its real run only.**"*
  - After a fix: *"Now run again only: **every probe that failed**; and **every probe whose criterion the fix commit's changed files can affect.** Get the names of those files with `git show --name-only --format= <sha>`, and compare them with each criterion's `Depends-on` lines."* — *"**A fix that changes a file many criteria rest on — a database schema, a shared layout, a configuration file — sends every probe in scope again.** Every probe run again here does its real run only"* — *"**No run of the whole set follows the last fix.**"*
  - Smoke: *"A failing test the list names is **old**; one it does not name is **new**."* — *"Name the report you compared with. **Never check out, build or run the default branch to compare.** When there is no earlier list … report the failures unmarked and say there was no list to compare with."*
- [x] The never-read list still forbids diffs, `git show` of code and `git log -p`; its exception names only file-name lists. The bullet still opens *"**Diffs, `git show` of code, `git log -p`**"* and the exception ends: *"The exception covers those name lists only: the contents of a change, `git show` of code and `git log -p` stay forbidden."* The only commands it names are `git diff --name-only` and `git show --name-only --format=`.
- [x] The report template asks for the list of probes without a break run, the list not re-run after each fix with reasons, and the smoke failures marked old or new against a named report.
  - *Probes*: *"then the list, by criterion ID, of every probe that ran without a break run this pass."*
  - *Fix-loop accounting*: *"Per loop: … the probes run again, with their outcomes; the screens read again; and every probe in scope not run again, each with its reason"*.
  - *Environment*: *"when the smoke has failing tests, follow it with **Smoke failures** — one line per failing test, named as the suite prints it and marked old or new — and the path of the report it was compared with."*
- [x] Nothing else in stage 7 changed. `git diff -U0` hunks in the skill are at old lines 48, after 55, 127, 132, 173, 225, 262, 266, 297 and 299 — the never-read bullet, the new smoke paragraph, *Red before green*, fix-loop step 3, the three template lines and workflow steps 7 and 9. The read list (old 32–43), the channels (100–115), the gates, the verdicts, the two-loop cap (fix-loop step 4) and the register writes (189–207) have no hunk. In `process.md` the one changed line is 46, and its word diff touches only the probe sentence, the fix-loop sentence, the smoke sentence and "next" → "below".

**What 42c must know.** In `process.md` only line 46 (stage 7) changed. Each stage is one line, so no line numbers moved; line 44 (stage 6) is untouched, including its "the full suite once at the end" and the ADR-0048 D4 note. 42c edits stage 6 and the build skill.

**Amendment (✏ 2026-10-02, from the slice's gate: item 1 of the plan now covers the one-command run).** The one command is each project's own runner, written by an earlier check, and it may still do every probe's break run. Without a change there, the new rule would save nothing on such a project.

- `.claude/skills/timone-verify/SKILL.md` — a new marked paragraph right after *Run the set with one command, in parallel* (now line 157, before *Reading the figures on the preview's data*). It says: *"**the one command does real runs only.** A probe owed a break run — one of the four cases under *Red before green* — does it on its own, before its real run. The project's runner is this step's own file, written by an earlier check. When it does both runs for every probe by default, give it a way to run real runs only, or add one to it, and commit that change with the report as you commit any probe. Without that, every probe still does its break run on every pass."*
- `process.md` — stage 7's sentence *"The regression set is run by one command, in parallel"* read the same way, so it gets one marked clause: *"**that command does real runs only:** a probe owed a break run does it on its own, before its real run, and a project's runner that does both runs by default is given a way to run real runs only by the checking step, whose file it is."* The sentence does not contain a probe folder path, so a plain edit was enough.

The four commands, run again after the amendment:

```
$ git grep -n -E "every run does both legs|One full re-verify|full re-verify \(which repeats|in this run, on this build|catches decay for free" -- process.md .claude/skills/timone-verify; echo "exit: $?"
exit: 1

$ for f in process.md .claude/skills/timone-verify/SKILL.md; do git grep -c "ADR-0061" -- "$f" || echo "MISSING in $f"; done
process.md:1
.claude/skills/timone-verify/SKILL.md:10

$ git grep -n -E "name-only" -- .claude/skills/timone-verify/SKILL.md
.claude/skills/timone-verify/SKILL.md:48:- **Diffs, `git show` of code, `git log -p`** — …
.claude/skills/timone-verify/SKILL.md:190:   - **every probe whose criterion the fix commit's changed files can affect.** …

$ git diff --stat -- . ':!process.md' ':!.claude/skills/timone-verify' ':!doc/plans/phases/reports/phase-42-handoffs.md'
(empty)
```

The skill's count went from 9 to 10 with the new paragraph. `process.md` still counts 1 line, and now carries four markers on it (D1 twice, D2, D4).

## 42c — Each building part runs the tests its change can affect, and everything runs whole once at the close

**Built.** A building session no longer runs every suite whole at the end of each sub-phase. At the end of a sub-phase it runs the tests its change can affect, and every suite that takes under a minute, whole. The sub-phase's own validation steps still pass before the next sub-phase starts, but earlier sub-phases' validation steps no longer run again between sub-phases. At the close, when the last sub-phase's commit is in and before the completion report is written, every suite of the project runs whole once, and then every sub-phase's validation steps run once. The session decides once per phase which suites take under a minute: from the time the latest completion report records for each suite, or, when there is none, from one whole run before the first slice, stopped after one minute. Each handoff now names the tests and suites run at sub-phase end. The completion report has a new section, *Tests run*, that lists them per sub-phase, and then the close's run with the time each suite took.

**Files touched.**
- `.claude/skills/timone-execute/SKILL.md` — *The TDD loop inside a slice*: the *Rhythm* bullet rewritten, and a new bullet *Which suites take under a minute*. *Handoff-note template*: *Validation evidence* also names the tests and suites run at sub-phase end. *Closing the phase*: the first paragraph rewritten — the one run at the close, its order, the accepted risk, and a sentence saying that the next two paragraphs (superseded checkboxes, order of the runs) apply to that run. *Completion report template*: a new section `## Tests run` after *Sub-phase outcomes*.
- `process.md` — the stage 6 paragraph only (line 44): *"Type-check regularly, run single test files during the loop, the full suite once at the end."* is now the loop sentence plus the rule, in two sentences after the marker.
- `doc/plans/phases/reports/phase-42-handoffs.md` — this section.

**Decisions taken inside the slice.**
1. **How the builder knows a suite takes under a minute.** The measure is the time of the suite's last whole run. The *Tests run* section now records, on the close's line, the time each suite's whole run took, and the next phase reads it there. The first phase a project builds under this rule has no such record. For that case I wrote one whole run of the suite before the first slice, stopped after one minute: a suite that finished takes under a minute, and a suite that was stopped does not. Two other answers were possible. "Treat a suite with no time as a minute or more" costs nothing, but on that first phase a fast unit suite would then run whole at no sub-phase end, and PRD-06.R4's verification hint looks for it at every sub-phase end. "Run it whole and time it" would run a slow browser suite whole twice on that phase, which is the cost the rule removes. The stopped run costs at most one minute per suite, once per project, and the report names it.
2. **The orchestrating session decides, once per phase, and names the suites in each slice's prompt.** A slice context receives only the inputs the contract lists, and the earlier completion report is not one of them. Naming the suites in the prompt follows what the skill already does for the never-read rule ("say so in the slice's prompt"). The contract's six-item list is unchanged.
3. **"The tests the change can affect"** is written as the tests of the files the sub-phase changed and the tests of the code that uses those files, with *"when you cannot tell whether a test can be affected, run it."* The plan and the ADR use the phrase without saying how to judge it. The builder has the code, so it judges from the code, and when in doubt the test runs.
4. **The close paragraph now says "If a whole suite or a prior validation now fails"**. The old text named only a prior validation. A whole suite that fails at the close needs the same outcome, or the paragraph would not say what happens then.
5. **Markers inside the two template code blocks use the short form** (`✏ ADR-0061:` and `✏ ADR-0061.`), as 42b did in the checking skill's report template. This skill had no marker inside a code block before; a link does not show there.
6. **The *Tests run* section's "stated, never omitted" case** is a sub-phase that ran no tests: it says so, with the reason. A slice that changes rule text only, like this one, is that case.
7. **Left as they were, because they stay true:** the look check's *"It runs after every prior slice's validation has been re-run (see *Closing the phase*)"* — that run is now the close's one run, which comes before the look check and the completion report; the close's list of conditions (*"every prior slice's validation still passes"*); the paragraph on a slice that breaks an earlier one still being committed; and the *Workflow* list, which never named the old re-runs either.

**Validation evidence.** No behaviour-carrying code in this slice, so no seams were declared and there is no red-green trace; validation is checklist-based. The four commands, run after the last edit:

```
$ git grep -n -E "full suite once\*\* at sub-phase end|after any slice that mutates shared state|re-check as soon as a slice" -- .claude/skills/timone-execute process.md; echo "exit: $?"
exit: 1

$ for f in process.md .claude/skills/timone-execute/SKILL.md; do git grep -c "ADR-0061" -- "$f" || echo "MISSING in $f"; done
process.md:2
.claude/skills/timone-execute/SKILL.md:5

$ git grep -n "## Tests run" -- .claude/skills/timone-execute/SKILL.md
.claude/skills/timone-execute/SKILL.md:286:## Tests run

$ git diff --stat -- . ':!process.md' ':!.claude/skills/timone-execute' ':!doc/plans/phases/reports/phase-42-handoffs.md'
(empty)
```

`process.md` counts 2 lines: line 44 (stage 6, this slice) and line 46 (stage 7, 42b). The skill counts 5 lines: *Rhythm*, the new bullet, the handoff template's evidence line, the close paragraph and the *Tests run* template. Line 286 lies between the completion report template's fences at lines 267 and 301, so the one `## Tests run` line is inside that template.

- [x] From the skill alone, a reader can say what a sub-phase runs at its end, what runs at the close and in what order, and where the report lists it.
  - Sub-phase end: *"**At sub-phase end, run the tests the change can affect, and every suite that takes under a minute, whole. Do not run the other suites whole:** every suite runs whole once, at the close (see *Closing the phase*)."* — *"The sub-phase's own validation steps still pass before the next sub-phase starts, as *The transition gate and escalation* says. Earlier sub-phases' validation steps do not run again until the close."* — *"A suite takes under a minute when its last whole run did."*
  - Close and order: *"When the last sub-phase's commit is in, and before the completion report is written: first run every suite of the project whole, once; then run the validation steps of every sub-phase, the last one included, once."*
  - Where it is listed: the completion report template's `## Tests run`: *"one line per sub-phase: its id, each test file its change could affect that it ran at its end, and each suite it ran whole. … Then one line for the close: every suite of the project run whole once, each with its result and the time its run took, and then every sub-phase's validation steps run once, in the order used, with the result."* And the handoff template's *Validation evidence*: *"then the tests and suites run at sub-phase end — each test file the change can affect, by name, and each suite run whole — with their results."*
- [x] Stage 7's paragraph in `process.md` reads as 42b left it. The checksum of line 46 is the same before and after this slice (`c8d8b6a2…`), and `git diff -U0 process.md` has one hunk, `@@ -44 +44 @@`.
- [x] Nothing else in stage 6 changed: TDD loop, gates, look check, commits and handoffs read as before. `git diff -U0` hunks in the skill are at old lines 137, 234, 248 and after 284 only: *Rhythm*, the handoff template's evidence line, the close's first paragraph and the new template section. The other TDD-loop bullets (red before green, seams, no speculative features, the three anti-patterns, refactoring, cases that cannot be driven red), the three gates, the commit rules, the sub-agent contract, both look checks, the transition gate, the handoff template's other fields, and the close's paragraphs on superseded checkboxes, order, committing a breaking slice and the close's conditions have no hunk. In `process.md` the word diff touches only the sentence *"Type-check regularly, run single test files during the loop, the full suite once at the end."*

**What delivery must know.**
- `process.md` stage 6 lists what a handoff note carries and what a completion report must hold. Neither list names the tests run at sub-phase end or the new *Tests run* section. The plan allowed one change to that paragraph, the test-rhythm sentence, so I did not add them. The skill carries both, and stage 6 says the layout belongs to the skill, so the two do not disagree. A reviewer may still want the lists to name it.
- On the first phase a project builds under this rule, the build runs each suite with no recorded time once before the first slice, stopped after one minute. Someone counting whole browser-suite runs in that session (PRD-06.R4's verification hint) will see that stopped run as a second call of the suite. It is not a whole run, and the *Tests run* section names it.
- The new bullet *Which suites take under a minute* and decision 2 add one thing the orchestrating session tells each slice. It is information about the project, not more of the plan.

## 42d — A box's first token is taken after the slow start-up, and its refresh interval is worked out once

**Built.** `start` now works out the refresh interval once, at the top: `const refreshIntervalMs = options.refreshIntervalMs ?? FORGE_REFRESH_MS`. The box's first token asks for `refreshIntervalMs + BOX_TOKEN_MARGIN_MS`. The refresh loop gets `intervalMs: refreshIntervalMs`, so both use the same value. Before, the loop got `options.refreshIntervalMs` unresolved and applied the default itself. The `tokenFor` call moved from the top of `start` to after `commitIsPushed`, `runEnv`, `services` and `modelToken`, and before the box's environment is built. A stack that takes minutes to come up no longer uses up the token's margin. The comment says why the token is taken last. Because the token is now taken after the stack is up, a mint that fails now takes the stack down before it throws. The model token already does the same. This is a departure from the plan; see decision 2.

**Files touched.**
- `src/daemon/container-runtime.ts`: `refreshIntervalMs` at :911. The `tokenFor` call at :971 is in a `try`. Its `catch` takes the stack down and throws again. It comes after `services` (:946) and `modelToken` (:955), and before `const env` (:986). The refresh loop gets `intervalMs: refreshIntervalMs` (:1071).
- `src/daemon/container-runtime.test.ts`: two new tests in the block "the forge token a running box works on". One is case 1, "takes the box's token after the slow start-up, so the start-up does not eat its margin" (:1538). The other is "takes the stack down again when no forge token can be minted" (:1597).

**Decisions taken inside the slice.**
1. Case 1 uses the same setup as 42a's falsifying test: a real `githubAppCredentials`, a fake mint on a fake clock, and an RSA key in a temp folder. I copied the setup into the new test and did not share it with 42a's test. Sharing it would be a refactor, and the plan does not ask for one. The fake `services` moves the clock forward 8 minutes and returns no stack. The times are fixed. The machine's own call is at 12:00, so its token dies at 13:00. The start begins at 12:23, when that token has 37 minutes left. The stack is up at 12:31. The test expects `ghs_minted_at_12:31`.
2. **A departure from the plan: the stack is taken down if the token cannot be minted.** Before the move, `tokenFor` ran before anything was created, so a mint that failed left nothing running. After the move, it runs after `services` has brought the stack up. The plan as written would leave that stack running when GitHub refuses a mint. I used the same `try`/`catch` the model token uses just above it. I added one test for it and saw it fail first. If this is not wanted, remove the `try`/`catch` and that one test. Case 1 does not depend on either.
3. The token is taken before `nameFor`, not right before `const env`. Only `nameFor`, `interactive` and `prompt` are between them, and none of them waits. With the token first, a mint that fails does not use up a box name. This was already true before the move.
4. The refresh loop now always gets `intervalMs`, the value already worked out. Before, it got `intervalMs` only when the option was set. The loop's own `?? FORGE_REFRESH_MS` stays, for callers of `keepForgeTokenFresh` that pass no interval. That is why the grep finds 2.

**Validation evidence.**

*Case 1*. Red on the code before the move:

```
× the forge token a running box works on > takes the box's token after the slow start-up, so the start-up does not eat its margin 266ms
  → expected 'ghs_minted_at_12:00' to be 'ghs_minted_at_12:31' // Object.is equality
❯ src/daemon/container-runtime.test.ts:1591:23
Tests  1 failed | 88 skipped (89)
```

The box got the noon token. At spawn it had 29 minutes left, and 9 at the first refresh. That is under the 10 minutes PRD-06.R5 asks for. Green after the move and the single interval: `Tests  89 passed (89)`. `tsc --noEmit` exit 0.

*Case 2*. No new test, as the plan says. The block's existing tests stayed green. I also tried one mutation: the refresh loop was given `intervalMs: FORGE_REFRESH_MS` in place of `refreshIntervalMs`. All 90 tests still passed (`Tests  90 passed (90)`). Restored from a copy, and `diff` against it is empty. So no test checks that `start` passes its interval to the refresh loop. That was also true before this slice. The third checkbox therefore rests on the code (:1071), not on a test.

*The stack teardown test (decision 2)*. Red before the `try`/`catch`:

```
× the forge token a running box works on > takes the stack down again when no forge token can be minted 5ms
  → expected +0 to be 1 // Object.is equality
❯ src/daemon/container-runtime.test.ts:1623:19
Tests  1 failed | 89 skipped (90)
```

Green after it: `Tests  90 passed (90)`. `tsc --noEmit` exit 0.

*Agent validation steps, run after the last edit.*

```
$ npx vitest run src/adapters/credentials.test.ts src/daemon/container-runtime.test.ts src/adapters/command-runner.test.ts; echo "exit: $?"
 ✓ src/adapters/command-runner.test.ts (28 tests)
 ✓ src/adapters/credentials.test.ts (10 tests)
 ✓ src/daemon/container-runtime.test.ts (90 tests)
 Test Files  3 passed (3)
      Tests  128 passed (128)
exit: 0

$ npx tsc --noEmit; echo "exit: $?"
exit: 0

$ grep -c "?? FORGE_REFRESH_MS" src/daemon/container-runtime.ts
2
(:805 in keepForgeTokenFresh, :911 in start)

$ git diff --stat -- . ':!src/daemon/container-runtime.ts' ':!src/daemon/container-runtime.test.ts' ':!doc/plans/phases/reports/phase-42-handoffs.md' ':!.claude/skills/timone-verify' ':!process.md'
(empty)
```

Whole suite, run once after `npm run build` (exit 0): `Test Files  56 passed (56)`, `Tests  1419 passed (1419)`, exit 0. That is 1417 before the slice, plus the 2 new tests.

- [x] Case 1 is seen red before the move, then green. The failure is quoted above.
- [x] In `start`, `tokenFor` (:971) is called after `services` (:946) and `modelToken` (:955), and before the box's environment is built (:986).
- [x] `keepForgeTokenFresh` receives `intervalMs: refreshIntervalMs` (:1071). The start token's `minLifeMs` uses the same value (`refreshIntervalMs + BOX_TOKEN_MARGIN_MS`). No test catches a mismatch between the two (see case 2).

**What 42e must know.** Nothing. This slice changed only the two files above.

## 42e — The checking rules use one word per idea, allow the read they need, and look at every screen again after a fix

**Built.** The verifier's allowed read list, in the skill and in `process.md`, now names one more read: the *Environment* section of the latest verification report on the default branch, and only its list of build-health smoke failures, printed with `git show <default-branch>:<path>`. The paragraph on old and new smoke failures now points at that item, and no longer calls itself an addition to the list. The text 42b added now uses the words the rest of stage 7 uses: **pass**, **verification report**, **re-verify**, and in `process.md` **stage 7** or **the verifier**. Fix-loop step 3 is now *A narrowed re-verify*. The sentence about the project's runner is now three short active sentences, in both files. After a fix, the read of the figures on the preview's data runs again in full on every screen, as it did before ADR-0061; a `(browser)` clause is checked again when its criterion's probe is; workflow step 9 says the re-verify repeats step 8 in full; the fix-loop accounting template no longer asks for the screens read again.

**Files touched.**
- `.claude/skills/timone-verify/SKILL.md` — *Read:* list: a new item at line 39, after the HUMAN-CHECK item. *Never read*: the file-name exception now says "to choose what the re-verify runs" (line 49). The old/new smoke paragraph (line 57). *Red before green*: "an earlier pass" (line 139). The runner paragraph after *Run the set with one command* (line 158). *The fix loop*: step 3's title (line 189) and its closing paragraph (line 193). Report template: *Environment* (line 245) and *Fix-loop accounting* (line 286). *Workflow*: step 9 (line 319).
- `process.md` — the stage 7 paragraph only (line 46): the closed read list, the smoke sentence, the runner clause, the fix-loop sentences, and one pre-existing word ("re-checked" → "checked again").

**Decisions taken inside the slice.**
1. The new *Read:* item in the skill also allows the smoke's one-line result just above the list, and says so. The old/new rule needs it: it is what tells "the smoke passed whole, so the list is empty" apart from "no smoke result, so there is no list". `process.md` names only the list, worded as narrowly as the HUMAN-CHECK item; where the line sits in the report is the skill's layout.
2. **`process.md` also gets the screen rule**, which the excerpt's item 4 lists only for the skill. Before this branch, `process.md` covered the screens with "one full re-verify of everything". 42b replaced that with a re-verify that names only probes. `process.md` wins over the skill, so leaving it silent could be read as narrowing the screens. The sentence that already ended the D2 passage was rewritten: *"No run of the whole probe set follows the last fix, but the read of the figures on the preview's data runs again in full after every fix."* It is the one change outside the excerpt's listed sites. Revert it if that is wrong.
3. The validation grep matched one word this branch did not add: "re-checked" in stage 7's sentence on `revised` criteria (from commit `dd63f9f`). It became "checked again", so the grep can exit 1. It is not a 2026-10-02 sentence, so it carries its own `✏ Revised 2026-10-03` marker.
4. The excerpt's example for the runner says "a file this step owns". The skill says "a file this stage owns", because the skill calls itself "this stage" when it speaks of probes ("only this stage writes there"). In the skill, "step" means the runner's step. `process.md` says "a file stage 7 owns" and "the verifier adds".
5. "to choose what to check again" (line 49) is not on the grep list. It names what follows a fix, so it became "to choose what the re-verify runs".
6. "No run of the whole set follows the last fix" became "the whole probe set", in fix-loop step 3, workflow step 9 and `process.md`. The screen read now runs in full after a fix, so "whole set" alone could be read as including it. R2 itself says "the whole probe set".
7. The fix-loop accounting template's "and the re-check" became "the re-verify's outcome", the words it had before this branch, without "full".
8. Markers. There are three new `✏ Revised 2026-10-03` markers: the new *Read:* item, the new item in `process.md`'s closed list, and "checked again". Every other change rewrites a sentence under a 2026-10-02 ADR-0061 marker that 42b wrote, so it uses that marker. The screen rule gets no new marker because, compared with `main`, it has not changed.

**Validation evidence.** No behaviour-carrying code in this slice, so no seams were declared and there is no red-green trace; validation is checklist-based. The four commands, run after the last edit:

```
$ git grep -n -i -E "check report|this check'?s?\b|an earlier check|the next check|re-check|the checking step, whose|screens read again|screens that had a FAIL" -- .claude/skills/timone-verify/SKILL.md process.md; echo "exit: $?"
exit: 1

$ git grep -n -E "Environment" -- .claude/skills/timone-verify/SKILL.md | head
.claude/skills/timone-verify/SKILL.md:39:- **The *Environment* section of the latest verification report on the default branch, and only its list of build-health smoke failures** ✏ Revised 2026-10-03 (…
.claude/skills/timone-verify/SKILL.md:57:**When the smoke has failing tests, mark each one old or new.** ✏ Revised 2026-10-02 (… D4). …
.claude/skills/timone-verify/SKILL.md:73:**3 — Environment gate.** …
.claude/skills/timone-verify/SKILL.md:243:## Environment

$ git grep -n -E "repeats step 8" -- .claude/skills/timone-verify/SKILL.md
.claude/skills/timone-verify/SKILL.md:319:9. FAILs → defect briefs → fresh fix context → the narrowed re-verify of *The fix loop*, step 3. ✏ Revised 2026-10-02 (… D2): it runs the probes that failed and those the fix's changed files can affect, real run only, and it repeats step 8 in full. …

$ git diff --stat -- . ':!.claude/skills/timone-verify' ':!process.md' ':!doc/plans/phases/reports/phase-42-handoffs.md' ':!src/daemon/container-runtime.ts' ':!src/daemon/container-runtime.test.ts'
(empty)
```

42b's own removal check, run again, still exits 1: `git grep -n -E "every run does both legs|One full re-verify|full re-verify \(which repeats|in this run, on this build|catches decay for free" -- process.md .claude/skills/timone-verify` → `exit: 1`.

- [x] The **Read:** list and `process.md`'s closed list both name the one new read, and nothing else was added to either.
  - Skill, line 39: *"**The *Environment* section of the latest verification report on the default branch, and only its list of build-health smoke failures** … Print the report with `git show <default-branch>:<path>` and cut it to the list … **Read that list alone** — the rest of the report holds another pass's verdicts. Declare the report and the line range you opened."* It is the only added line between lines 32 and 45 (`git diff -U0` hunk `@@ -38,0 +39 @@`).
  - `process.md`: *"✏ Revised 2026-10-03 (…) the *Environment* section of the latest verification report on the default branch and only its list of build-health smoke failures, printed with `git show <default-branch>:<path>` and never by checking that branch out (marking smoke failures old or new, below, needs that list and nothing else of the report),"* — the word diff shows this as the only insertion in the closed list.
  - Line 57 now refers to the item: *"Compare them with the list of smoke failures in the latest verification report on the project's default branch, read as the **Read:** list above allows."*
- [x] A reader finds one word for each idea in the branch's additions: pass, verification report, re-verify. The grep above exits 1. Step 3 reads *"3. **A narrowed re-verify.**"*, next to the unchanged *"That brief-fix-reverify cycle"*. Line 57: *"write this pass's own list in the report …, so the next pass has one to compare with."* Line 139: *"a probe an earlier pass already proved able to fail"*. Line 193: *"earlier in this pass or in an earlier pass"*, *"this narrowed re-verify safe"*. `process.md`: *"followed by a narrowed re-verify"*, *"the re-verify runs, real run only"*, *"the latest verification report on the default branch"*, and *"The project's runner is a file stage 7 owns. If it always does both runs, the verifier adds an option that does real runs only, and commits that change with the report."* The skill: *"The project's runner is a file this stage owns. If it always does both runs, add an option that does real runs only, and commit that change with the report."*
- [x] After a fix, every screen is read again; the text says so in the fix loop and in step 9.
  - Fix loop, line 193: *"A `(browser)` clause is checked again when its criterion's probe is. **The screen read of *Reading the figures on the preview's data* is not narrowed: after every fix it runs again in full**, on every screen the phase file names."*
  - Step 9, line 319: *"it runs the probes that failed and those the fix's changed files can affect, real run only, and it repeats step 8 in full."*
  - Template, line 286: *"Per loop: the briefs issued, the fix commits returned, the re-verify's outcome. ✏ ADR-0061: the probes run again, with their outcomes, and every probe in scope not run again, each with its reason"* — "the screens read again" is gone.
  - `process.md`: *"No run of the whole probe set follows the last fix, but the read of the figures on the preview's data runs again in full after every fix."*
- [x] The rules of 42b are otherwise unchanged: the four break-run cases, the narrowed re-verify of probes, the smoke comparison. The skill's `git diff -U0` hunks are at new lines 39, 49, 57, 139, 158, 189, 193, 245, 286 and 319. The four cases (lines 132–137) and the two bullets of step 3 (lines 190–191) have no hunk. At line 139 only "check" → "pass" changed. At line 193, "sends every probe in scope again" and the real-run-only rule are word for word the same. The smoke paragraph keeps its old/new rule, the empty-list case, *"**Never check out, build or run the default branch to compare.**"* and the no-list case word for word; only its pointer to the read changed. In `process.md` the D1 four cases, the D2 bold sentence (apart from "re-check" → "re-verify") and the D4 rule (apart from "last check report" → "latest verification report") are unchanged.

**What 42f must know.** In `process.md` only line 46 (stage 7) changed. Each stage is one line, so no line numbers moved. Line 44 (stage 6) is untouched by this slice. `CONTEXT.md` still says "the checking step" and "Later checks" in the *Probe* entry that this branch added. That entry is the words used to the human, and it was outside this slice's files.

## 42f — A slice is given the list of fast suites, and stage 6 requires the tests-run list

**Built.** A slice is now given the suites that take under a minute. The building skill's list of what a slice receives has a seventh item: those suites, as decided for the phase, and how that was decided. The bullet *Which suites take under a minute* no longer says "you name them in each slice's prompt". It says each slice receives the list as item 7 of its inputs. In `process.md`, stage 6 now requires the same tests-run contents the skill's templates already carry. A handoff note carries the tests and suites run at sub-phase end. A completion report carries the tests and suites each sub-phase ran, and the whole run of every suite at the close.

**Files touched.**

- `.claude/skills/timone-execute/SKILL.md` — *The sub-agent contract*: a new item 7 in the list of what a slice receives (line 105). *The TDD loop inside a slice*: the bullet *Which suites take under a minute* (line 139) now points to item 7, in place of "you name them in each slice's prompt".
- `process.md` — the stage 6 paragraph only (line 44): one item added to what a handoff note carries, and one to the completion report's required elements.
- `doc/plans/phases/reports/phase-42-handoffs.md` — this section.

**Decisions taken inside the slice.**

1. **"How that was decided" is the source of each suite's time, not the orchestrator's reasoning.** Item 7 says it in those terms: each suite's time in the latest completion report, or, for a suite with no time there, the run before the first slice that is stopped after one minute. The paragraph after the list still says "not your reasoning about the phase". Item 7 gives facts about the project, so the two do not disagree, and I left that paragraph as it was.
2. **Item 7 also says what to do when no suite takes under a minute: say so.** Without that line, a slice given nothing could not tell "no fast suite" from "not told".
3. **The bullet keeps its 2026-10-02 marker on the sentence 42c wrote, and the new pointer carries its own 2026-10-03 marker.** Only the end of the first sentence changed ("and you name them in each slice's prompt" was removed). The pointer sentence follows the old marker, so a reader sees which text is new.
4. **The bullet points to "item 7 of its inputs in *The sub-agent contract*"**, not to the list by its heading. The validation `awk` counts numbered lines from the first line that names that heading. A second line with the heading's words, below the list, would start a second count that runs to the end of the file.
5. **In `process.md`, the new completion-report element goes at the end of the list**, after "context for the next agent", not after the outcome table where the template puts it. The new element holds its own "and". At the end of the list it reads as one item; in the middle it would read as two. `process.md` leaves the layout to the skill, so the order there does not set the order of the report. The plan's wording is used word for word, so the validation grep finds it.
6. **Markers in `process.md` sit inside the lists, before the added item**, as 42e did with the new item in stage 7's closed list.

**Validation evidence.** No behaviour-carrying code in this slice, so no seams were declared and there is no red-green trace; validation is checklist-based. No tests or suites ran at sub-phase end: the slice changes rule text only. The three commands, run after the last edit:

```
$ awk '/What a slice context receives/,/What a slice context returns/' .claude/skills/timone-execute/SKILL.md | grep -c -E "^[0-9]+\. "
7

$ git grep -n -E "whole run of every suite at the close" -- process.md
process.md:44:**6 — Implementation.** … the tests and suites each sub-phase ran, and the whole run of every suite at the close. **When a sub-phase still fails, concretely:** …

$ git diff --stat -- . ':!.claude/skills/timone-execute' ':!process.md' ':!doc/plans/phases/reports/phase-42-handoffs.md'
(empty)
```

The seven numbered lines the `awk` range counts are items 1 to 6 as before (`git diff -U0` has no hunk on them) and the new item 7. The grep matches once, on line 44, which is stage 6.

- [x] A slice's input list names the fast suites, and nothing else was added to it.
  - Line 105: *"7. **The suites that take under a minute**, as decided for the phase, and how that was decided: from each suite's time in the latest completion report, or, for a suite with no time there, from the run before the first slice that is stopped after one minute. ✏ Revised 2026-10-03 (…). The slice runs these suites whole at its end, so it needs this list, and it cannot work the list out itself, because the earlier completion report is not one of its inputs. When no suite takes under a minute, say so."*
  - Line 139: *"**Which suites take under a minute** is decided once per phase, before the first slice. ✏ Revised 2026-10-02 (… D5). ✏ Revised 2026-10-03 (…): each slice receives the list, and how it was decided, as item 7 of its inputs in *The sub-agent contract*."*
  - The skill's `git diff -U0` has two hunks: `@@ -104,0 +105 @@` (item 7 added, nothing else in the list) and `@@ -138 +139 @@` (the bullet). The paragraph after the list ("Nothing else. …") and the list of what a slice returns have no hunk.
- [x] `process.md` stage 6 lists the tests-run contents for both the handoff and the completion report; stage 7's paragraph reads as 42e left it.
  - Handoff notes: *"**Handoff notes** carry what the slice built, the files it touched, decisions taken inside the slice, its validation evidence including the red-green trace, ✏ Revised 2026-10-03 (…) the tests and suites run at sub-phase end, and anything the next slice must know;"*
  - Completion report: *"… a per-sub-phase outcome table carrying commit SHAs, deviations from the plan, context for the next agent, and ✏ Revised 2026-10-03 (…) the tests and suites each sub-phase ran, and the whole run of every suite at the close."*
  - `git diff -U0 process.md` has one hunk, `@@ -44 +44 @@`. The word diff shows only the two insertions above and "and context for the next agent." becoming "context for the next agent, and". The SHA-256 of line 46 is `5a980761…` before and after this slice, and the SHA-256 of every line but 44 is `5afee01b…` before and after.

**What delivery must know.**

- Spec findings 3 and 4 of the delivery report are answered by this slice. Findings 1, 2 and 5 were 42d's and 42e's.
- `process.md` stage 6 opens with its own short list of what a slice is given: *"fresh context each, only the relevant plan excerpt, prior handoff, and file list."* It does not name the fast suites. It also never named `doc/standards.md`, the declared seams or the glossary terms, which the skill's list has carried for a long time. The plan allowed two changes to that paragraph, so I did not touch this sentence. A reviewer who reads "only" as a closed list may want it to name the fast suites, or to point to the skill's list.
- The skill's line 118, *"say so in the slice's prompt"*, is about the never-read rule, not the fast suites. It is unchanged.
