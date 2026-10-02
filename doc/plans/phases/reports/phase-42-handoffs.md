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
