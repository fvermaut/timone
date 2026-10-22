# Phase 66 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 66a — A box is named after its run, with a random part

**Built.** A box's name is now `timone-<project>-<ticket>-<seq>-<stage>-<8 hex>`, for example `timone-ivtrends-37-1-execution-0a1b2c3d`. The last part is random and new at every start, so a daemon that restarts no longer asks docker for a name a box left behind still holds (timone#73). A session no run started gets `timone-<project>-<stage>-<8 hex>`. Every part is lowercased, and every run of characters outside `[a-z0-9_.]` becomes one `-`. `startStepSession` now passes the run id to the runtime on the request, so the name can carry the ticket and the sequence.

**Files touched.**

- `src/daemon/session.ts` — `SessionRequest.runId?: string`, with the doc comment from the plan. `sessionRequest` and `SessionRequestInput` are unchanged.
- `src/daemon/step-session.ts` — `runtime.start({ ...input.request, runId })`, with a one-line comment.
- `src/daemon/container-runtime.ts` — new exported pure `boxName(request, suffix)`. The default `nameFor` is `boxName(request, randomBytes(4).toString("hex"))`. `let sequence = 0` is removed. The `nameFor` doc comment is updated. The `--name` comment in `runArgs` is unchanged, because it is still true.
- `src/daemon/container-runtime.test.ts` — new `describe("a box's name belongs to its run (timone#73)")` with cases 1–5, and `boxName` added to the import. No existing test was edited.
- `src/daemon/step-session.test.ts` — case 6 added in `describe("a step session, started and watched")`.

**Decisions taken inside the slice.**

- `boxName` does not check whether `runId`'s project matches the workspace project. The plan takes the project from the workspace only.
- Case 6 checks the whole request the runtime gets (`toEqual` on the fixed fields of the test's request plus `runId: "scratch-app#7/1"`). That covers both "the run id is there" and "the other fields are the input request's".
- Case 4 and case 5 build the ivtrends request with `sessionRequest(...)` and then add `runId`, the same way the file's `request()` helper does.

**Validation evidence.**

The cases were driven one at a time. Each red below was seen before the code that turned it green:

1. `names the box after the project, the ticket, the run's sequence, the stage and the suffix`. Red: `TypeError: (0 , boxName) is not a function`. Green after `boxName` was added.
2. `leaves the ticket and the sequence out for a session no run started`. Red against the step-1 code: `expected 'timone-scratch-app---execution-0a1b2c…' to be 'timone-scratch-app-execution-0a1b2c3d'`. Green after the two run parts were left out when there is no run id.
3. `gives a project whose name docker would refuse a name docker takes`. Red: `expected false to be true` (the `startsWith("timone-scratch-app-")` check). Green after the lowercasing and the character rule were added.
4. `asks docker for a new name after the daemon restarts (timone#73)`. Red: `expected 'timone-ivtrends-1' to match /^timone-ivtrends-37-1-execution-[0-9a…/`. Green after the default `nameFor` was changed.
5. `asks docker for a new name each time one runtime starts the same run`. **This case cannot be driven red on the old code.** One runtime's old counter already gave two different names (`timone-ivtrends-1`, then `timone-ivtrends-2`), so the case passes before the change. To show the test can fail, I ran a mutation: the default `nameFor` was given a fixed suffix (`boxName(request, "0a1b2c3d")`). Cases 4 and 5 then both failed with `expected 'timone-ivtrends-37-1-execution-0a1b2c…' not to be 'timone-ivtrends-37-1-execution-0a1b2c…'`. The mutation was then reverted.
6. `tells the runtime which run the session belongs to (timone#73)`. Red: `expected [ { cwd: '/root', …(3) } ] to deeply equal [ { cwd: '/root', …(4) } ]`. Green after the `step-session.ts` change.

The validation block:

- `npm run build` gave exit 0.
- Red run, with the new tests and the three source files as they are at `HEAD`: `npx vitest run src/daemon/container-runtime.test.ts src/daemon/step-session.test.ts` gave `Tests 5 failed | 114 passed (119)`, exit 1. The five that failed were cases 1, 2 and 3 (`boxName is not a function`), case 4 (`'timone-ivtrends-1'`) and case 6 (the request had no `runId`). Every other test passed, and so did case 5, for the reason given above.
- Green run, the same command after the change: `Tests 119 passed (119)`, exit 0.
- `npx tsc --noEmit` gave exit 0.
- `grep -nE "let sequence = 0|\+\+sequence" src/daemon/container-runtime.ts` gave no output, exit 1.

The checkboxes:

- [x] The red run is in the handoff, naming each new case and its result. Case 5 passed on the old code; that is recorded above, with the mutation.
- [x] Case 4 is in the suite and names timone#73, in its test name and in its describe.
- [x] Every existing test in both files passes unedited. `git diff --numstat` shows 97 and 29 lines added to the two test files, and 0 removed.

The affected test files: `npx vitest run src/daemon src/commands/daemon.test.ts src/runner` gave `Test Files 42 passed (42)`, `Tests 2106 passed (2106)`, exit 0.

**What 66b must know.** Names are no longer predictable without the `nameFor` seam. A test that needs to know a box's name must inject `nameFor`, as the existing stop test does with `timone-scratch-app-1`. Or it can read the `--name` argument from the `run` call that the fake spawn recorded. Every name the default makes starts `timone-` and matches docker's rule `/^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/`. `SessionRequest.runId` is set only on the `startStepSession` path. A request built by `sessionRequest` alone has no `runId`.
