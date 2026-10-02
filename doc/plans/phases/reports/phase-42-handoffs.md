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
