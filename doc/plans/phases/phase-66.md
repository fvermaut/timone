# Phase 66: A box's name belongs to its run — unique box names, a removal that is waited for and touches only its own box, boxes removed on Ctrl-C, and leftovers removed when the daemon starts

> **Status:** Planned.

> **Companion phases:** [Phase 30](phase-30.md) built the box runtime (`src/daemon/container-runtime.ts`, slice 30h), including the per-daemon counter in the name and the `docker rm -f` on every ending that this phase changes. [Phase 47](phase-47.md) left this ticket out of PRD-07 on purpose ("Box names that collide (#73) are out of scope in PRD-07"); [PRD-07](../../specs/prd/prd-07-several-tickets-of-one-project-at-once.md)'s out-of-scope list says the same and says it "is fixed there", meaning here. No open phase edits the same lines. Governing decisions: [ADR-0041](../../adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md) D1, because "one container per run, created when the run starts and destroyed when it ends" is the rule this phase makes true; [ADR-0047](../../adr/0047-a-cancel-stops-the-work-it-cancels.md) D3, because a box is stopped by removing its container, never by killing the `docker run` client, and the Ctrl-C path here does it the same way; [ADR-0025](../../adr/0025-a-lock-holders-proof-of-life-is-its-process.md) (the state lock refuses a second daemon while the first one's process is alive), because the start-up removal is safe only under that lock; [ADR-0059](../../adr/0059-a-live-check-only-the-operator-can-run-rides-to-the-pull-request.md) D1, because the live check this phase owes cannot run in a box with no docker and rides to the pull request.

> **Screens changed:** none — the change is in how the daemon names, ends and cleans up containers; no slice changes anything a person sees on a screen Timone draws. The daemon's log gains two kinds of line (what was removed at start, what was removed at Ctrl-C).

## Requirements

> **PRD:** [prd-02-inversion-of-control.md](../../specs/prd/prd-02-inversion-of-control.md) (Active) — criteria in [prd-02-inversion-of-control.criteria.md](../../specs/prd/prd-02-inversion-of-control.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-02.R23 | MUST | A run is isolated from fvermaut's machine — clause 1: the session's work "happens inside a container created for that run and destroyed when it ends". |

This phase claims clause 1 of PRD-02.R23, on the words "created for that run and destroyed when it ends". Today a container is named after a counter, not its run, is not destroyed when the daemon is stopped, and its destruction is not waited for, so a later run can find the name taken. R23 stays `draft`: its own notes list what must still be watched live, and this phase does not supply all of that.

## Goal Description

**What is wrong.** [timone#73](https://github.com/fvermaut/timone/issues/73), seen again at least twelve times between 2026-09-01 and 2026-10-13 on `ivtrends`, `scratch-app` and `timone`: a box fails before its session starts, with docker's `Conflict. The container name "/timone-ivtrends-4" is already in use`. The sorting step checked on `main` (`c5f0fc8`) that all four causes in the ticket still hold, plus a fifth:

1. **The name comes from a counter that starts at 1 in every daemon.** `containerRuntime` in `src/daemon/container-runtime.ts` (lines ~984–988) names a box `timone-<project>-<n>` with `n` from `let sequence = 0`, and `runtimeFor` builds one runtime per daemon process. A restarted daemon asks for names an earlier daemon already used.
2. **Ctrl-C leaves the boxes.** The SIGINT/SIGTERM handler in `src/commands/daemon.ts` (lines ~769–774) releases the state locks and exits. Boxes are started with `--name` and without `--rm`, so a box from a stopped daemon keeps its name until someone removes it. After SIGTERM the box even keeps working.
3. **A failed start removes a box it did not make.** When `docker run` refuses because the name is taken, the ending path still runs `docker rm -f <name>` (line ~1261), which removes the other box. If that box belonged to a live run, that run is killed.
4. **Nothing removes leftover boxes when the daemon starts.**
5. **The removal is not waited for.** `destroy` (lines ~1315–1322) starts `docker rm -f` and returns at once; `completed` resolves while the container still exists. The next step of the same run can start while the old box still holds its name. The comment of 2026-09-07 shows the automatic retry hit the same window twice. So this phase removes the race; it does not rely on retries.

**What this phase builds, in order.** (a) A box is named after its run: project, ticket, run sequence, step, and eight random hexadecimal characters, so no two starts ask for the same name, in one daemon or across restarts. (b) The end of a box waits for its removal before the session counts as ended, and the services beside it are taken down only after that. A start that docker refused because the name was taken removes nothing. (c) On SIGINT or SIGTERM the daemon removes every box it still has running, synchronously, then exits. (d) Each box carries a label naming the ledger (state file) of the daemon that started it. When a daemon starts and holds the lock, it removes the boxes labelled with its own ledger, and the boxes named the old way for its own projects, and says in its log what it removed.

**Decisions taken here that did not reach an ADR.** Each is a few lines of code, undone by an edit, so none passes the "hard to reverse" part of the test. They serve ADR-0041 D1 and do not change it.
1. **The start-up removal finds boxes by a label, not by the `timone-` prefix the ticket names.** The prefix is shared: a preview of the `timone` project is the compose project `timone-pr-<n>` (`composeProject` in `src/adapters/docker-preview.ts`), and the services beside a run are the compose project `timone-<project>-<branch>` (`composeProject` in `src/daemon/services.ts`). A prefix match would take down a live preview, which PRD-02.R8 promises. The label holds the absolute path of the daemon's state file, so a second daemon on another ledger (for example a live check run beside the main daemon) never removes the first one's boxes.
2. **Boxes named the old way are removed by an exact pattern**: `timone-<project>-<digits>`, with `<project>` one of the manifest's projects, and only when the box has no ledger label. These are the leftovers on fvermaut's machine today; none of them can collide with a new name any more, but each holds memory and may still be running. The pattern cannot match a preview (`timone-pr-5-app-1`), a service container (`timone-timone-default-db-1`), or a new name (a new name always has a step name, which has letters, before its last part). **Known limit, kept on purpose:** an old-code daemon running at the same moment on another ledger would lose its boxes. Once the daemon runs this code, no box is named that way.
3. **The removal on Ctrl-C is synchronous** (`spawnSync`), and the process exits right after. If it were asynchronous, the event loop would run while the boxes go away: each step's `completed` would settle, and the runner would treat the step as failed — writing the ledger after the lock was released and posting a "something went wrong" comment on the ticket. A blocking removal lets nothing else run between the removal and the exit. The step cut short is found by the next daemon's reclaim, exactly as today.
4. **A start docker refused for a taken name is recognised from docker's own words** (`Conflict. The container name "…" is already in use`). With random names this should not happen again; this is a second check, so a collision can never again remove another run's box.
5. **The run id reaches the runtime through `startStepSession`**, which already has it, and not through the two call sites in `src/runner/actions.ts`. Every boxed session is started by `startStepSession` (it is the only user of the runtime in `src/commands/daemon.ts`).

**Not done here.** The services stack beside a box that Ctrl-C ends is not taken down at exit; the next run on the same branch reuses the same compose project name. The previews are not touched. The step's ledger state at Ctrl-C is unchanged: the next daemon's reclaim handles it, as today.

**Regression set and what no criterion watches.** The diff touches `src/daemon/container-runtime.ts`, `src/daemon/session.ts`, `src/daemon/step-session.ts`, a new `src/daemon/leftover-boxes.ts`, `src/commands/daemon.ts`, and their tests. Derived from the registers at planning time (MUST, `api`, `verified`, narrowed by `Depends-on`; a criterion with no `Depends-on` is always in): PRD-05.R2, R3, R4, R5, R7, R10, R11, R18; PRD-06.R5; PRD-07.R4, R6, R9; PRD-08.R5; PRD-09.R2, R4, R5; PRD-10.R2, R3, R4, R5, R6. PRD-06.R5 names `container-runtime.ts` directly; its `Falsified-by:` test in `src/daemon/container-runtime.test.ts` must stay green. Verification derives the set again from the registers as they stand then. **What no criterion watches:** PRD-02.R23 is `draft`, so nothing in the set watches box names, box removal or start-up cleanup. The tests of 66a–66d are therefore hard gates, especially the ones that say what must **not** be removed: a refused start removes nothing; another ledger's box, a preview and a service container survive the start-up removal; a refused second daemon removes nothing.

**A live check is owed before merge.** The `live` criteria PRD-02.R1, R2, R4 and R8 are `verified` and depend on `src/daemon/` and `src/commands/daemon.ts`. Every boxed step now starts and ends through changed code, and the start-up removal runs next to previews (R8). This container has no docker, so the check cannot run here; under ADR-0059 D1 it rides to the pull request as an unticked item. Its steps are in "Live check owed" at the end of this file.

**No triage record.** The ticket was classified as a bug on the ticket itself (comments of 2026-10-07 and 2026-10-22), and no file under `doc/triage/` was committed for it. The runner's instructions for this step restate the classification; this plan follows them. The project has no `doc/standards.md`; Timone's central `standards/typescript.md`, `standards/testing.md` and `standards/code-smells.md` (all Approved) apply. `standards/testing.md` allows a test double for something external, and docker is external: every test here drives docker through the injected `ContainerSpawn` and never through the real one.

## Context & Prerequisites

- **`src/daemon/container-runtime.ts`** — `ContainerSpawn` and `ContainerProcess` (lines ~76–99); `ContainerRuntimeOptions.nameFor` (line ~112, "Names the container. Behind a seam so a test is not clock-dependent"); `dockerSpawn` (line ~389, not exported); `runArgs(name, image, script, network, env, interactive)` (line ~821) with the comment on `--name` and no `--rm`; `containerRuntime` (line ~980) with `let sequence = 0` and the default `nameFor`; the `completed` block that calls `refresh?.stop()`, `await container.exit`, `destroy(spawn, name)`, then `stack.down()` (lines ~1251–1263); the interactive-without-stdin path that calls `destroy` (line ~1146); `stop: () => destroy(spawn, name)` (line ~1286); `destroy` (line ~1315); `reasonFor` (line ~1325).
- **`src/daemon/container-runtime.test.ts`** — helpers `request()` (scratch-app, stage `execution`, no run id), `fakeContainer(lines, exit)` (records every non-`run` call in `removed` as `args.join(" ")`), `oneShot()`, `runtimeWith(spawn)`; `describe("what the box is given, and what it is not")` with `runCall()`/`runArgs()` helpers; the test "stops a session by removing the container, not by killing the client" (line ~236), which must keep passing unedited.
- **`src/daemon/session.ts`** — `SessionRequest` (line ~93), `SessionRuntime` (line ~382, only `start`), `StartedSession.stop?()` (line ~255).
- **`src/daemon/step-session.ts`** — `startStepSession(deps, input)` (line ~110) calls `runtime.start(input.request)` (line ~127); `input.runId` is `<project>#<ticket>/<seq>` (`runId` in `src/daemon/runs.ts`, line ~1636). Tests in `src/daemon/step-session.test.ts` use a stand-in `SessionRuntime`.
- **`src/commands/daemon.ts`** — `runtimeFor(choice)` (line ~280); `RunDaemonOptions` (line ~362); `runDaemon` (line ~419) with `withStateLock(…, async (lock) => { …; options.store.regivePlaces(); return poll(…) })`; the action computes `statePath` (line ~634) before `runtimeFor` (line ~662); the signal handler (lines ~765–774). Tests in `src/commands/daemon.test.ts`: `clockedStore()`, `quietAdapter()`, `standInRunner(...)`, and "refuses a second daemon while the first holds the ledger, naming the holder" (line ~150).
- **`src/daemon/lock.ts`** — `releaseHeldLocks()` (line ~88). Not changed.
- **Pipeline stage names** (`PIPELINE_STAGES` in `src/daemon/pipeline.ts`) are all lowercase letters and `-`, so a stage is always safe in a container name and always has letters.
- **Known state** — on this branch, cut from `main` at `c5f0fc8`: `npx vitest run src/daemon/container-runtime.test.ts src/commands/daemon.test.ts src/daemon/step-session.test.ts` passes 139 of 139 **after `npm run build`**. Without a build, two tests in `the guard on a boxed run's gh calls` fail because `dist/cli.js` is missing. Every validation block below builds first.
- **No docker.** The building session runs in a box with no docker. No test, probe or validation step may start, list or remove a real container. Every new function that reaches docker takes its spawner as a **required** parameter, or uses the real one only when the runtime itself uses the real one (see 66c), so a test that forgets to inject one cannot reach docker on fvermaut's machine either.

## Sub-phases

### Sub-phase 66a: A box is named after its run, with a random part

**[MODIFY]** `src/daemon/session.ts` — add to `SessionRequest`:
```ts
/**
 * The run this session belongs to, as the ledger writes it:
 * `<project>#<ticket>/<seq>`. A box is named after it (timone#73). Absent
 * for a session no run started.
 */
runId?: string;
```
`sessionRequest` and `SessionRequestInput` do not change.

**[MODIFY]** `src/daemon/step-session.ts` — in `startStepSession`, start the runtime with `{ ...input.request, runId }` instead of `input.request`. One line, with a short comment: the run id is what the box is named after (timone#73).

**[MODIFY]** `src/daemon/container-runtime.ts`:
- Add and export a pure `boxName(request: SessionRequest, suffix: string): string`. Parts, joined with `-`: `timone`; the project (`request.workspace?.project.name ?? "session"`); when `request.runId` matches `/#(\d+)\/(\d+)$/`, the ticket and the sequence; the stage (`request.stage`); the suffix. Each part is lowercased and every run of characters outside `[a-z0-9_.]` becomes one `-`. Examples: run `scratch-app#7/1`, stage `execution`, suffix `0a1b2c3d` → `timone-scratch-app-7-1-execution-0a1b2c3d`; no run id → `timone-scratch-app-execution-0a1b2c3d`.
- The default `nameFor` becomes `(request) => boxName(request, randomBytes(4).toString("hex"))` (`randomBytes` from `node:crypto`). Remove `let sequence = 0`. Update the doc comment of `nameFor`: it stays a seam for tests; the default is unique per start.
- Replace the comment above `"--name"` in `runArgs` only if it says something no longer true; the reason for no `--rm` stays.

**[MODIFY]** `src/daemon/container-runtime.test.ts` — a new `describe("a box's name belongs to its run (timone#73)")`. Existing tests unedited.

**[MODIFY]** `src/daemon/step-session.test.ts` — one new case in `describe("a step session, started and watched")`.

**Seams under test (TDD):** `boxName` is the first seam — pure, the request and a suffix in, the name out. The `--name` argument that `containerRuntime(...).start(request)` passes to the injected spawn is the second: it is what docker is actually asked for. `startStepSession` is the third: it is the one place every boxed session starts. Red-green:
1. `boxName` for a request with `runId: "scratch-app#7/1"`, stage `execution`, suffix `0a1b2c3d` returns `timone-scratch-app-7-1-execution-0a1b2c3d`.
2. `boxName` for the same request without `runId` returns `timone-scratch-app-execution-0a1b2c3d`.
3. `boxName` for a project named `Scratch App` returns a name that starts `timone-scratch-app-` and matches docker's rule `/^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/`.
4. **The ticket's case.** Two runtimes built with the default `nameFor` (the same daemon restarted), each starting the same request with `runId: "ivtrends#37/1"` and project `ivtrends`: the two `--name` values differ, and each matches `/^timone-ivtrends-37-1-execution-[0-9a-f]{8}$/`. On the code before the change both are `timone-ivtrends-1`.
5. One runtime starting the same request twice gives two different names.
6. `startStepSession` with `runId: "scratch-app#7/1"` hands the runtime a request whose `runId` is `scratch-app#7/1`, and whose other fields are the input request's.

Cases 1–6 must be seen to fail before the change (1–3 because `boxName` does not exist; run the red step with vitest, which does not type-check). Record the red run in the handoff.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
cd projects/timone   # from the timone root
npm run build        # the gh-guard tests read dist/cli.js; expect exit 0

# Red first: expect the new cases to fail, every other test to pass.
npx vitest run src/daemon/container-runtime.test.ts src/daemon/step-session.test.ts ; echo "exit: $?"

# Green after the change. Expect every test in both files to pass, exit: 0.
npx vitest run src/daemon/container-runtime.test.ts src/daemon/step-session.test.ts ; echo "exit: $?"
npx tsc --noEmit ; echo "exit: $?"            # expect exit: 0

# The per-daemon counter is gone. Expect no output, exit: 1. (A variable for
# the run's own sequence number is fine; only the counter's two forms are probed.)
grep -nE "let sequence = 0|\+\+sequence" src/daemon/container-runtime.ts ; echo "exit: $?"
```

- [ ] The red run is in the handoff, naming each new case and its result.
- [ ] Case 4 is in the suite and names timone#73.
- [ ] Every existing test in both files passes unedited.

---

### Sub-phase 66b: The end of a box waits for its removal, and a start refused for a taken name removes nothing

**[MODIFY]** `src/daemon/container-runtime.ts`:
- `destroy(spawn, name)` returns `Promise<void>`: it resolves when the `docker rm -f <name>` process has exited, whatever its status, and never rejects (a spawn that throws resolves at once, as today's `try` does). Keep its comment and add one line: it is waited for, so the next step never finds the name or the network still in use (timone#73, comment of 2026-09-07).
- Inside `start`, one removal per box: `let removal: Promise<void> | undefined; const remove = (): Promise<void> => (removal ??= destroy(spawn, name));`. `stop` becomes `stop: () => { void remove(); }`; the interactive-without-stdin path does `await remove()`; the `completed` path does `await remove()` and only then `stack.down()`. So a cancel and the ending that follows it wait on the same removal, and the stack's network is taken down after the box has left it.
- Export a constant `NAME_TAKEN = /Conflict\. The container name "[^"]*" is already in use/`. In `completed`, after `const exit = await container.exit`: when no line was ever read from the box, `exit.code === 125` and `NAME_TAKEN.test(exit.stderr)`, the box was never made by this start: skip `remove()`, still take the stack down, and return the usual `reasonFor(exit)` outcome. Comment: this start did not make that container, and it may be a live run's (timone#73).

**[MODIFY]** `src/daemon/container-runtime.test.ts` — a new `describe("the end of a box waits for its removal, and removes only its own box (timone#73)")`. Existing tests unedited; the ADR-0047 stop test must still pass.

**Seams under test (TDD):** `containerRuntime(...).start(request)` and its `completed` promise, driven by an injected `ContainerSpawn` whose `rm` process the test controls. This is the boundary the step runner waits on, so "the session has ended" is observed exactly where the next step's start depends on it. Red-green:
1. With an `rm` process whose `exit` the test resolves by hand: after the box's lines end, `completed` is still pending (checked after flushing pending promises, for example `await new Promise((r) => setTimeout(r, 10))`); after the test resolves the `rm` exit, `completed` resolves.
2. With a services stack (a fake `ServiceStack` whose `down` records into the same ordered list as the spawn): the order is `run`, `rm -f <name>` exited, then `down`.
3. **The ticket's worse case.** `docker run` prints no line and exits 125 with stderr `docker: Error response from daemon: Conflict. The container name "/timone-scratch-app-1" is already in use by container "9620e0a0708b". You have to remove (or rename) that container to be able to reuse that name.`: no spawn call with `args[0] === "rm"` is made; `completed` gives `ok: false` with an error containing `already in use`; the stack's `down` is still called.
4. `docker run` exits 125 with any other stderr (for example `Unable to find image`): `rm -f <name>` **is** called.
5. An `rm` process that exits 1 with stderr: `completed` still resolves with the session's own outcome (a `result` line → `ok: true`).
6. `stop()` and the ending that follows it both wait on one removal: the spawn sees exactly one `rm -f <name>` call.

Cases 1, 2, 3 and 6 must be seen to fail before the change. Cases 4 and 5 pass before and after; they guard that the fix still removes a box it did make. Record the red run in the handoff.

> Sub-phase 66a must be complete before starting this sub-phase (same files; 66a's tests must stay green).

#### Agent Validation Steps

```bash
cd projects/timone
npm run build ; echo "exit: $?"                 # expect exit: 0

# Red first: expect cases 1, 2, 3, 6 to fail and cases 4, 5 to pass.
npx vitest run src/daemon/container-runtime.test.ts ; echo "exit: $?"

# Green after the change. Expect every test to pass, exit: 0.
npx vitest run src/daemon/container-runtime.test.ts src/daemon/step-session.test.ts ; echo "exit: $?"
npx tsc --noEmit ; echo "exit: $?"              # expect exit: 0

# The ADR-0047 stop test, by name, unedited. Expect 1 passed, exit: 0.
npx vitest run src/daemon/container-runtime.test.ts -t "stops a session by removing the container" ; echo "exit: $?"
```

- [ ] The red run is in the handoff, naming each case and its result before the change.
- [ ] Case 3 is in the suite and names timone#73.
- [ ] `git diff main -- src/daemon/container-runtime.test.ts` shows only added lines inside the new `describe` blocks of 66a and 66b (plus imports).

---

### Sub-phase 66c: Ctrl-C removes the boxes that are still running

**[MODIFY]** `src/daemon/session.ts` — add to `SessionRuntime`:
```ts
/**
 * Remove every box this runtime started that has not ended yet, and return
 * when they are gone. **Synchronous on purpose**: it is called just before
 * the process exits on a signal, and nothing else may run in between — no
 * step's ending, no ledger write, no ticket comment (timone#73). Returns the
 * names it removed. Absent for a runtime whose sessions die with the process.
 */
stopAllNow?(): string[];
```

**[MODIFY]** `src/daemon/container-runtime.ts`:
- New option `removeNow?: (names: readonly string[]) => void` on `ContainerRuntimeOptions`, documented as the synchronous removal used on exit. Default, **only when `options.spawn` is also absent**: `spawnSync("docker", ["rm", "-f", ...names], { stdio: "ignore", timeout: 20_000 })` inside a `try` that swallows any error. When `spawn` is injected and `removeNow` is not, the default is a function that removes nothing. Say why in a comment: a test runtime must never reach the real docker.
- In `containerRuntime`, a `const live = new Set<string>()`. A name is added just before the `docker run` spawn, and deleted once `remove()` has settled in `completed` (and in the interactive-without-stdin path). For the refused-name case of 66b it is deleted without a removal.
- The returned object gains `stopAllNow()`: take the names in `live`; if none, return `[]` without calling `removeNow`; otherwise call `removeNow(names)` once, clear `live`, return the names.

**[MODIFY]** `src/commands/daemon.ts`:
- Export `stopOnSignal(signal: "SIGINT" | "SIGTERM", deps: { releaseLocks: () => void; runtime: SessionRuntime; log: (message: string) => void; exit: (code: number) => void }): void`. Order: `releaseLocks()`; `const names = deps.runtime.stopAllNow?.() ?? []`; when `names.length > 0`, `log(\`stopped: removed ${names.length} box(es) still running: ${names.join(", ")}\`)`; `exit(signal === "SIGINT" ? 130 : 143)`.
- The handler becomes `process.once(signal, () => stopOnSignal(signal, { releaseLocks: releaseHeldLocks, runtime, log, exit: (code) => process.exit(code) }))`. Keep the existing comment and add to it: the boxes are removed here, synchronously, so no step's ending is handled between their removal and the exit; the steps they ran are still found by the next daemon's reclaim. A box left running after the daemon stopped kept working and pushing (timone#73).

**[MODIFY]** `src/daemon/container-runtime.test.ts` — a new `describe("a stopping daemon removes the boxes still running (timone#73)")`.

**[MODIFY]** `src/commands/daemon.test.ts` — a new `describe("stopOnSignal")`.

**Seams under test (TDD):** `stopAllNow` on the runtime `containerRuntime` returns, with an injected `spawn` and an injected `removeNow` that records its argument. `stopOnSignal` in `src/commands/daemon.ts`, with recording stand-ins for the four dependencies: it is the whole of what the signal handler does, and the handler itself is one line. Red-green:
1. Two boxes started and still running (fake `run` processes that yield the init line, then wait): `stopAllNow()` calls `removeNow` once with both names, and returns both.
2. A box whose session has completed is not in what `stopAllNow()` passes or returns.
3. No box running: `removeNow` is not called and the result is `[]`.
4. A box refused for a taken name (66b case 3) is not in the list after its `completed` settles.
5. A runtime built with an injected `spawn` and no `removeNow`: `stopAllNow()` with a box running returns its name and does not throw, and nothing outside the fake spawn ran (the fake records no `rm` call through `spawn` either, because the removal is the no-op default).
6. `stopOnSignal("SIGINT", …)` with a runtime whose `stopAllNow` returns `["timone-a", "timone-b"]`: the recorded order is `releaseLocks`, `stopAllNow`, one log line containing both names, `exit(130)`.
7. `stopOnSignal("SIGTERM", …)` exits with `143`.
8. `stopOnSignal` with a runtime that has no `stopAllNow` (the in-process one): `releaseLocks`, then `exit`, and no log line.

Cases 1–8 must be seen to fail before the change (the functions do not exist). Record the red run in the handoff.

> Sub-phase 66b must be complete before starting this sub-phase (the set of running boxes is kept in step with the one removal 66b introduces).

#### Agent Validation Steps

```bash
cd projects/timone
npm run build ; echo "exit: $?"                 # expect exit: 0

# Red first: expect the new cases to fail, all others to pass.
npx vitest run src/daemon/container-runtime.test.ts src/commands/daemon.test.ts ; echo "exit: $?"

# Green. Expect every test to pass, exit: 0.
npx vitest run src/daemon/container-runtime.test.ts src/commands/daemon.test.ts src/daemon/step-session.test.ts ; echo "exit: $?"
npx tsc --noEmit ; echo "exit: $?"              # expect exit: 0

# The handler calls stopOnSignal and nothing else (comments excluded).
# Expect one line inside the process.once handler, exit: 0.
grep -n "stopOnSignal(" src/commands/daemon.ts | grep -v '^\s*[0-9]*:\s*\(//\|\*\)' ; echo "exit: $?"

# No test file reaches the real docker. Expect no output, exit: 1.
grep -rn 'spawnSync("docker"\|dockerSpawn' src --include=*.test.ts ; echo "exit: $?"
```

- [ ] The red run is in the handoff.
- [ ] Case 5 is in the suite: a runtime with a fake spawn cannot reach the real docker through `stopAllNow`.
- [ ] Every existing test in the three files passes unedited.

---

### Sub-phase 66d: Each box names its ledger, and a starting daemon removes the leftovers of its own ledger and says what it removed

**[MODIFY]** `src/daemon/container-runtime.ts`:
- Export `LEDGER_LABEL = "timone.ledger"` and export `dockerSpawn` (unchanged otherwise).
- New option `ledger?: string` on `ContainerRuntimeOptions`: the absolute path of the state file of the daemon that starts the box. When given, `runArgs` adds `"--label", \`${LEDGER_LABEL}=${ledger}\`` (after `--name`). Pass it through as a new last parameter of `runArgs`.

**[NEW FILE]** `src/daemon/leftover-boxes.ts`, with a module comment citing PRD-02.R23 clause 1, ADR-0041 D1 and timone#73, and the reasons in this phase's Goal Description for a label and not the prefix:
```ts
/** One container, as `docker ps -a` lists it. */
export interface ListedBox { id: string; name: string; ledger: string }

/** The `--format` the listing asks for: id, name and the ledger label, tab-separated. */
export const LISTING_FORMAT = `{{.ID}}\t{{.Names}}\t{{.Label "${LEDGER_LABEL}"}}`;

/** Parse the listing's lines; a blank line or one with fewer than two fields is skipped. */
export function parseListing(lines: readonly string[]): ListedBox[];

/**
 * The boxes a starting daemon removes: those labelled with its own ledger,
 * and those with no ledger label named exactly `timone-<project>-<digits>`
 * for one of its projects (the old naming). Nothing else. Pure.
 */
export function leftoverBoxes(
  listed: readonly ListedBox[],
  owner: { ledger: string; projects: readonly string[] },
): ListedBox[];

/**
 * List every container, remove the leftovers, wait for the removal, and say
 * in the log what was removed. Never throws: a daemon that cannot list or
 * remove says so and starts anyway. `spawn` is required, so no caller can
 * reach the real docker without choosing to. Returns the removed names.
 */
export function sweepLeftoverBoxes(options: {
  spawn: ContainerSpawn;
  ledger: string;
  projects: readonly string[];
  log: (message: string) => void;
}): Promise<string[]>;
```
`sweepLeftoverBoxes` runs `spawn("docker", ["ps", "-a", "--no-trunc", "--format", LISTING_FORMAT])`, reads all of `lines`, awaits `exit`. On a non-zero exit, or a spawn that throws: log `could not list containers to remove leftover boxes: <reason>` and return `[]`. With no leftovers: log nothing, return `[]`. Otherwise run `spawn("docker", ["rm", "-f", ...ids])`, await its exit, and log `removed <n> box(es) left by an earlier daemon: <names, comma-separated>`; when that `rm` exits non-zero, log `could not remove every leftover box (<names>): <stderr, one line>` instead. Project names in the old-name pattern are escaped for use in a regular expression.

**[MODIFY]** `src/commands/daemon.ts`:
- `RunDaemonOptions` gains `sweep?: () => Promise<void>`, documented: run once, under the lock, before the first cycle; a refused daemon never runs it, so it can never remove a live daemon's boxes (ADR-0025). In `runDaemon`, inside the `withStateLock` callback, call it first (before `regivePlaces()`), in a `try` that logs a thrown error and goes on.
- `RuntimeChoice` gains `ledger?: string`, passed to `containerRuntime` as `ledger`. The action passes `ledger: statePath` to `runtimeFor`, and passes to `runDaemon`, only when the runtime is `container`: `sweep: async () => { await sweepLeftoverBoxes({ spawn: dockerSpawn, ledger: statePath, projects: Object.keys(manifest.projects), log }); }`.

**[NEW FILE]** `src/daemon/leftover-boxes.test.ts`.

**[MODIFY]** `src/daemon/container-runtime.test.ts` — the label cases, in `describe("what the box is given, and what it is not")` as new `it`s.

**[MODIFY]** `src/commands/daemon.test.ts` — new cases for the sweep's place in `runDaemon`.

**Seams under test (TDD):** `leftoverBoxes` is the decision — pure, the listing and the owner in, what to remove out — so every "must not remove" case is tested there without any spawn. `sweepLeftoverBoxes` with an injected spawn is the effect: what docker is asked and what the log says. `runDaemon` with a recording `sweep` is where it runs: under the lock, before the first cycle. The `run` arguments seen by an injected spawn show the label. Red-green:

At `leftoverBoxes`, with owner `{ ledger: "/home/f/timone/.timone/state.json", projects: ["ivtrends", "timone", "scratch-app"] }`:
1. A box labelled with that ledger, any name → removed.
2. A box labelled with another ledger (`/tmp/live-check/state.json`) → kept.
3. Unlabelled `timone-ivtrends-4` and `timone-timone-13` → removed (the old naming).
4. Unlabelled `timone-pr-5-app-1` (a preview of the `timone` project), `timone-timone-default-db-1` and `timone-ivtrends-timone-73-db-1` (service containers), `ivtrends-pr-12-web-1` (a preview) → all kept.
5. Unlabelled `timone-otherproject-3` (not a manifest project) → kept.
6. Unlabelled new-style name `timone-ivtrends-37-1-delivery-0a1b2c3d` → kept.

At `parseListing`:
7. Three tab-separated lines, one with an empty label and one blank line → two-field and three-field rows parsed, the blank line skipped, the empty label read as `""`.

At `sweepLeftoverBoxes`, with a fake spawn:
8. The listing call is exactly `docker ps -a --no-trunc --format <LISTING_FORMAT>`; with leftovers, one `docker rm -f <id> <id>` call follows, and one log line names both boxes by name; the result is their names.
9. No leftovers → no `rm` call, no log line, `[]`.
10. Listing exits 1 → one log line starting `could not list containers`, no `rm` call, resolves `[]`. A spawn that throws → the same, and no rejection.
11. The `rm` exits 1 → one log line starting `could not remove every leftover box`, and the promise resolves.

At the box's `run` arguments:
12. A runtime with `ledger: "/x/state.json"` passes `--label` followed by `timone.ledger=/x/state.json`; still no `-v`, no `--mount`.
13. A runtime without `ledger` passes no `--label`.

At `runDaemon`:
14. With `once: true`, a `statePath`, and a `sweep` and an adapter that both record into one list: `sweep` runs once, and before the cycle's first adapter call.
15. **A refused second daemon never sweeps.** In the shape of the existing "refuses a second daemon" test: the second `runDaemon`, refused, returns 1 and its `sweep` was never called.
16. A `sweep` that throws: the error is logged, and the cycle still runs and the command returns 0.

Cases 1–16 must be seen to fail before the change (the module, options and labels do not exist). Record the red run in the handoff.

> Sub-phase 66c must be complete before starting this sub-phase (both change `runArgs`' callers in `container-runtime.ts` and the action in `src/commands/daemon.ts`).

#### Agent Validation Steps

```bash
cd projects/timone
npm run build ; echo "exit: $?"                 # expect exit: 0

# Red first: expect the new cases to fail (or the new test file to fail to import).
npx vitest run src/daemon/leftover-boxes.test.ts src/daemon/container-runtime.test.ts src/commands/daemon.test.ts ; echo "exit: $?"

# Green. Expect every test to pass, exit: 0.
npx vitest run src/daemon/leftover-boxes.test.ts src/daemon/container-runtime.test.ts src/commands/daemon.test.ts src/daemon/step-session.test.ts ; echo "exit: $?"
npx tsc --noEmit ; echo "exit: $?"              # expect exit: 0

# The sweep is wired under the lock, not before it. Expect the sweep call's
# line number to be greater than the withStateLock line's, inside runDaemon.
grep -n "withStateLock(\|options.sweep" src/commands/daemon.ts ; echo "exit: $?"

# No test reaches the real docker. Expect no output, exit: 1.
grep -rn 'spawnSync("docker"\|dockerSpawn' src --include=*.test.ts ; echo "exit: $?"

# The whole suite. Expect exit: 0.
npx vitest run ; echo "exit: $?"
```

- [ ] The red run is in the handoff.
- [ ] Cases 2, 4, 5, 6 and 15 (what must **not** be removed) are in the suite; they are the hard gate of this phase.
- [ ] `git diff --stat main` lists only `src/daemon/container-runtime.ts`, `src/daemon/container-runtime.test.ts`, `src/daemon/session.ts`, `src/daemon/step-session.ts`, `src/daemon/step-session.test.ts`, `src/daemon/leftover-boxes.ts`, `src/daemon/leftover-boxes.test.ts`, `src/commands/daemon.ts`, `src/commands/daemon.test.ts`, and this phase's own files under `doc/plans/phases/`.

---

## Dependency graph

```
66a → (none)        a box is named after its run, with a random part
66b → 66a           the end of a box waits for its removal; a start refused for a taken name removes nothing
66c → 66b           Ctrl-C and SIGTERM remove the boxes still running, synchronously, before exit
66d → 66c           each box names its ledger; a starting daemon removes its own leftovers and the old-named ones, and logs them
```

All four slices change `src/daemon/container-runtime.ts` and its test file, so none runs in parallel.

## Live check owed (rides to the pull request)

Run by the operator on fvermaut's machine, on `scratch-app`, never on a live project, with the daemon on this branch's build. It covers PRD-02.R23 clause 1 on these words, and re-checks PRD-02.R2 (a boxed step runs to its end) and PRD-02.R8 (a preview survives a daemon start).

1. Before starting: note `docker ps -a --format '{{.Names}}'`. Make sure one `scratch-app` preview is up, and create one stopped old-named container: `docker create --name timone-scratch-app-1 alpine true`.
2. Start the daemon. Its log says it removed `timone-scratch-app-1`. `docker ps -a` still shows the preview's containers and everything else from step 1.
3. Mark one `scratch-app` ticket. While a step runs, `docker ps --filter label=timone.ledger --format '{{.Names}}'` shows one box named `timone-scratch-app-<ticket>-1-<step>-<8 hex>`. When the step ends, before the next one starts, that name is gone from `docker ps -a`.
4. While a later step runs, press Ctrl-C. The log names the box it removed. `docker ps -a --filter label=timone.ledger` is empty.
5. Start the daemon again. The run's step is reclaimed and runs again in a box with a new name, without a name conflict.
