# Phase 49 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 49a — Each project has the number of places `timone.yaml` sets, and 2 when it sets none

**Built.** A project entry in `timone.yaml` may set `places`, a whole number of 1 or more. A project that sets none has 2. The ledger (`RunStore`) is told the number per project when it is opened, and uses it both to refuse a place and to give freed places. Every command that opens the ledger tells it the number from the manifest it loads. The runner's brief says the place is `free` while fewer runs take a place than the project has. `PLACES_PER_PROJECT` is gone.

**Files touched.**

- `src/manifest.ts` — `places` on a project entry (`z.number().int().min(1, "must be 1 or more").optional()`, doc comment naming PRD-07.R2 and ADR-0065 D6); `DEFAULT_PLACES = 2`; `placesOf(config)`; `placesIn(manifest)`, which answers `placesOf` by project name and `DEFAULT_PLACES` for a project the manifest does not have.
- `src/daemon/runs.ts` — `PLACES_PER_PROJECT` deleted. `RunStoreOptions.placesOf` (default `() => DEFAULT_PLACES`), public `placesOf(project)`. `placeTakenFrom` and `givePlaces` read it. Doc comments corrected.
- `src/runner/session.ts` — `placeOf` reads `deps.store.placesOf(run.project)`.
- `src/commands/daemon.ts`, `cancel.ts`, `takeover.ts`, `status.ts` — `RunStore.open(statePath, { placesOf: placesIn(manifest) })`.
- `src/commands/guardrails.ts` — `check` loads the manifest once and passes `placesIn(manifest)`. `guard` passes `placesForGuard(...)`, a small local function that falls back to `DEFAULT_PLACES` when the manifest cannot be read. `guard`'s option type now names `manifest`, which `commonOptions` already declared.
- `src/manifest.test.ts`, `src/daemon/runs.test.ts`, `src/runner/session.test.ts` — the cases below.
- `src/commands/status.test.ts` (`ledger()`), `src/runner/actions.test.ts` (`placeWorld`), `src/runner/driver.test.ts` (`threeRuns`, and the store the restart case reopens), `src/daemon/poll.test.ts` (`newStore`) — each opens its store with `placesOf: () => 1`, case 3's change and nothing else. Granted by a plan amendment.

**Decisions taken inside the slice.**

- **`placesIn(manifest)` in `src/manifest.ts`.** The plan writes each opener as `placesOf: (name) => placesOf(<the project's config>)`. With `noUncheckedIndexedAccess` the config can be `undefined` (a run of a project removed from `timone.yaml`), so each lambda would need the same fallback. Six copies of it is the duplicated-code smell. One exported function holds the fallback instead; it is tested at the manifest seam. A project the manifest does not have gets `DEFAULT_PLACES`.
- **The guard does not fail on an unreadable manifest.** `guardrails guard` never loaded the manifest before, and it only reads the ledger. If loading it threw, the guard's catch would print an error and allow the tool call, so a broken `timone.yaml` would switch off the probe guard. `placesForGuard` gives `DEFAULT_PLACES` instead. `check` loads it as it already did.
- **`placeTakenFrom` no longer refuses only because a place is given to another run.** The old test was `taking < PLACES_PER_PROJECT && given === undefined`. A given run already counts in `taking`, so with one place the second test changed nothing. With two places it refused a run while the second place was free. It is now `taking < placesOf(project)`. An extra case at R2 clause 3 covers it (below). The run named in a refusal is still the one a place is given to, when there is one.
- **Phase 47's cases open their store with one place** through the shared helper: `newStore()` in `runs.test.ts` and `world()` in `session.test.ts` now pass `placesOf: () => 1` (`world(2)` for the new case). The cases are unchanged otherwise.
- **PLAN PROBLEM, resolved by a plan amendment granting the four files.** 14 existing tests in four files outside the first file list failed, because they opened a store with no `placesOf` and got 2 places. They are phase 47's one-place cases, exactly as case 3 describes: 2 in `src/commands/status.test.ts`, 4 in `src/runner/actions.test.ts`, 7 in `src/runner/driver.test.ts`, 1 in `src/daemon/poll.test.ts`. With `DEFAULT_PLACES` set to 1 for one run, all four files passed (240 of 240), so the default was the only cause. The amended plan grants the four files for this change only; each store helper now passes `placesOf: () => 1`, and the four files pass.

**Validation evidence.**

Per declared case (red line seen, then green):

1. `src/manifest.test.ts`, "how many places a project has (PRD-07.R2)":
   - "gives a project that sets no number 2 places (clause 1)" — red: `TypeError: (0 , placesOf) is not a function`; green.
   - "gives a project that sets 3 places 3 (clause 2)" — red: `Error: Invalid manifest: project "client-alpha": unknown key "places"`; green.
   - "refuses 0 places" — red: `AssertionError: expected [Function] to throw an error`; green. Message asserted exactly: `project "client-alpha": field "places": must be 1 or more`.
   - "refuses 1.5 places" — red: `AssertionError: expected [Function] to throw an error`; green.
   - `refuses "2" written as text` — true before code (a string is not a number to zod). Mutation: `z.coerce.number()` → `AssertionError: expected [Function] to throw an error`; reverted, green.
   - "answers each project's number by its name, and 2 for a project the manifest does not have" (`placesIn`) — red: `TypeError: (0 , placesIn) is not a function`; green.
2. `src/daemon/runs.test.ts`, "the number of places on a project (PRD-07.R2)" › "lets two runs of one project take a place when the store is told no number, and refuses a third naming one of them (clause 3)" — red: `AssertionError: expected { ok: false, holder: { …(11) } } to deeply equal { ok: true }`; green.
   Extra case, same describe: "lets a run take the second place while the first is given to another run (clause 3)" — red: `AssertionError: expected { ok: false, holder: { …(11) } } to deeply equal { ok: true }`; green after the `placeTakenFrom` change.
3. With the store's default at 2, 21 of phase 47's cases in `runs.test.ts` went red, e.g. "one step at a time on a project with one place › refuses to activate a run while another run's step takes the place" — `AssertionError: expected function to throw an error, but it didn't`. After `newStore()` passed `placesOf: () => 1`: 145 of 145 green. In `session.test.ts` the 5 cases of "a place on the project after a wake (ADR-0063 D2, D3)" went red the same way (e.g. `expected [] to deeply equal [ 'scratch-app#12/1' ]`) and green after `world()` passed one place.
4. "gives the place of a run that parks to the waiting run by its order, while the other run keeps its step (clause 4)" — green as soon as written (`givePlaces` already read the number). Mutation: `givePlaces` stops at `taking.length >= 1` → `AssertionError: expected undefined to be defined`; reverted, green.
5. "counts the places of each project on its own when two projects have different numbers" — green as soon as written. Mutation A, count every project's runs in `placeTakenFrom` → `expected { ok: false, … } to deeply equal { ok: true }`. Mutation B, read scratch-app's number for every project → `expected undefined to be 'ivtrends#1/1'`. Both reverted, green.
6. `src/runner/session.test.ts` › "tells the runner the place is free while one of the project's two places is taken (PRD-07.R2)" — red: received `- The project's place: taken: scratch-app#11/1 has a step running.`, expected `- The project's place: free.`; green after `placeOf` read `store.placesOf`.

The validation block, as run (after `npm run build`, and after the plan amendment):

```
$ npx tsc --noEmit; echo "exit: $?"
exit: 0

$ npx vitest run src/manifest.test.ts src/daemon/runs.test.ts src/runner/session.test.ts src/commands/; echo "exit: $?"
 Test Files  15 passed (15)
      Tests  450 passed (450)
exit: 0

$ grep -rn "PLACES_PER_PROJECT" src --include=*.ts | grep -vE '^\S+:[0-9]+:\s*(//|\*)'; echo "exit: $? (expected 1)"
exit: 1 (expected 1)

$ grep -rn "RunStore.open(" src/commands --include=*.ts | grep -v test.ts
src/commands/status.ts:580:        store = RunStore.open(statePath, { placesOf: placesIn(manifest) });
src/commands/cancel.ts:339:          store = RunStore.open(statePath, { placesOf: placesIn(manifest) });
src/commands/daemon.ts:631:        store = RunStore.open(statePath, { placesOf: placesIn(manifest) });
src/commands/guardrails.ts:473:        store: RunStore.open(statePath, { placesOf: placesForGuard(resolve(root, options.manifest)) }),
src/commands/guardrails.ts:605:        store: RunStore.open(statePath, { placesOf: placesIn(manifest) }),
src/commands/takeover.ts:832:          store = RunStore.open(statePath, { placesOf: placesIn(manifest) });

$ npx vitest run src/runner/actions.test.ts src/runner/driver.test.ts src/daemon/poll.test.ts; echo "exit: $?"
 Test Files  3 passed (3)
      Tests  194 passed (194)
exit: 0
```

- [x] Cases 1–6 pass, with the red run of each new case recorded above (cases 4 and 5 proved by mutation). **Pass.**
- [x] Every `RunStore.open` under `src/commands/` passes `placesOf`: `cancel.ts:339`, `guardrails.ts:473` (guard), `guardrails.ts:605` (check), `takeover.ts:832`, `daemon.ts:631`, `status.ts:580`. **Pass.**
- [x] The place-order and stale-run cases already in `runs.test.ts` stay green (148 of 148). **Pass.**

Test files run at the end, by name (after `npm run build`):

- `src/manifest.test.ts` — 53 passed.
- `src/daemon/runs.test.ts` — 148 passed.
- `src/runner/session.test.ts` — 26 passed.
- `src/commands/` — every file passed, `status.test.ts`, `cancel.test.ts`, `daemon.test.ts`, `guardrails.test.ts`, `projects.test.ts` and `takeover.test.ts` among them.
- `src/runner/actions.test.ts` (its `endRun` cases included), `src/runner/driver.test.ts`, `src/daemon/poll.test.ts` — 194 passed.
- `src/daemon/chunk-zero.test.ts`, `hooks.test.ts`, `lock.test.ts`, `step-session.test.ts`, `src/runner/tools.test.ts`, `src/workspace.test.ts`, `src/cli.test.ts`, `src/guards/checkouts.test.ts`, `src/runner/replay/harness.test.ts` — passed.
- Whole suite, once: 66 files, 1772 passed, 0 failed. `npm run replay` was not run (no model login in this container); `src/runner/replay/harness.test.ts` passed instead.

**What 49b must know.**

- `src/runner/replay/recording.ts` opens its store with no `placesOf`, so the replay now runs with 2 places. Its cases passed in the harness test.
- Wording not in this slice's files still speaks of one place: the runner's rule in `src/runner/brief.ts` line 134 ("A step needs the project's place…") and the fact label `- The project's place:`; `CONTEXT.md` **Place** ("Every project has one place until the number can be set in `timone.yaml`").
- `RunStore.placesOf(project)` is public and is what any later code should ask for the number.
