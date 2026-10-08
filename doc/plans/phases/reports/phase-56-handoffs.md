# Phase 56 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 56a — The file tools, the search tools and a helper's prompt are judged by what they open

**Built.** The probe guard now judges a tool call by what the tool opens, not by every word it carries. `Read`, `Write` and `Edit` are judged on `file_path` only, `NotebookEdit` on `notebook_path`, `Glob` on `pattern` and `path`, `Grep` on `path` and `glob` (its `pattern` is text). `Agent` and `Task` are never judged: a helper's prompt is text. `Bash`, any other tool, and a call with no tool name keep the old rule (all of the input's text). The hook's `guard` command passes the payload's `tool_name` through, so this holds for every kind of session, on the host and in a container. A helper told to keep out of a check-script folder, and a plan that names one, now pass with no reply. A real read is judged as before, with the same three reasons.

**Files touched.**

- `src/daemon/probeGuard.ts` — `ProbeGuardInput` gains `toolName?: string | undefined`. New exported `reachesProbeDirectory(toolName, toolInput)` with a private `TARGET_FIELDS` map of tool name to the fields that name a target; `probeGuardDecision` calls it in place of `mentionsProbeDirectory`. Doc comments: `reachesProbeDirectory` says why tools are judged by their target (#192) and that a tool with no rule keeps the old rule; `mentionsProbeDirectory` says it is now the rule for a tool with no rule. The three reasons are unchanged.
- `src/commands/guardrails.ts` — `runGuard` passes `toolName: deps.toolName` to `probeGuardDecision`. One line.
- `src/commands/stage.ts` — `guardSays` asks about a `Read` of `join(PROBE_DIRECTORIES[0], "x.mjs")`; `join` added to the existing `node:path` import. Sentences unchanged.
- `src/daemon/probeGuard.test.ts` — new `describe` at the end (cases 1 to 4). Old tests not edited.
- `src/commands/guardrails.test.ts` — new `describe` at the end (cases 5 and 6), never calls `workspace()`. The top of the file is not touched: `PROBE_DIRECTORIES` comes from a module-level `const { PROBE_DIRECTORIES } = await import("../daemon/probeGuard.js")` placed just before the new block. Old tests not edited.

**Decisions taken inside the slice.**

- `TARGET_FIELDS` is a `Map`, not an object literal, so a tool named like an object key (`constructor`, `toString`) cannot find a prototype member and crash the guard. A field is read with `Reflect.get`, so no cast is needed.
- A tool in the map whose input is not an object is not judged (it has no target fields). A tool not in the map goes to `mentionsProbeDirectory` as before.
- Case 2 pins the three reasons word for word, built from `PROBE_DIRECTORIES`, so the plan's "the three reasons stay word for word" is checked, not only the decision.
- Case 3's `WebFetch` input also carries a `url`, as the real tool does; the `mcp__x__y` input names the folder inside an array inside an object.
- In `guardrails.test.ts`, each case makes its own root with `mkdtempSync` (registered in `tempDirs`) and opens the ledger with `newStore(root)`. The run is registered as `timone#229` for session `session-192`. `root` is passed to `runGuard`, as the hook does, so the declared-step lookup runs and finds nothing.
- Case 6 expects `ask` for the person in a container too, as today. The plan leaves that row to piece 2.

**Validation evidence.**

Red-green trace.

1. Case 1 written alone, before any code change: `npx vitest run src/daemon/probeGuard.test.ts` → `Tests 36 failed | 19 passed (55)`. The 36 are the 6 calls x 6 kinds of session. Failure messages: `AssertionError: expected { permissionDecision: 'deny', …(1) } to be undefined` (and the same with `'allow'` and `'ask'`).
2. Case 5 written alone, before any code change: `npx vitest run src/commands/guardrails.test.ts -t "only real reads and writes"` → `Tests 12 failed | 52 skipped (64)`. Failure message: `AssertionError: expected '{"hookSpecificOutput":{"hookEventName…' to be undefined`.
3. Cases 2, 3 and 4 added, still before the code change: `probeGuard.test.ts` → `Tests 36 failed | 127 passed (163)`. The 36 failures are only case 1's six labels; all 108 tests of cases 2, 3 and 4 and the 19 old tests pass.
4. Case 6 added, still before the code change: `-t "only real reads and writes"` → `Tests 12 failed | 6 passed | 52 skipped (70)`. The 6 that pass are case 6.
5. After the change: `probeGuard.test.ts` → `163 passed (163)`; `-t "only real reads and writes"` → `18 passed | 52 skipped (70)`.

Validation commands, run from the project folder.

- `npx tsc --noEmit; echo "exit: $?"` → `exit: 0`.
- `npx vitest run src/daemon/probeGuard.test.ts src/commands/stage.test.ts` → `Test Files 2 passed (2)`, `Tests 166 passed (166)`, exit 0.
- `npx vitest run src/commands/guardrails.test.ts -t "only real reads and writes"` → `Test Files 1 passed (1)`, `Tests 18 passed | 52 skipped (70)`, exit 0.
- `npm run build >/dev/null; echo "exit: $?"` → `exit: 0`.
- The `Agent` payload piped to `node dist/cli.js guardrails guard --root . --state "$S"` → no output, `exit: 0`.
- The `Read` payload of `$P/a.sh` piped to the same command, `grep -c '"permissionDecision":"ask"'` → `1`.

Checkboxes.

- [x] Cases 1 and 5 were red before the change and are green after (steps 1, 2 and 5 above).
- [x] Cases 2, 3, 4 and 6 are green before and after (steps 3, 4 and 5).
- [x] `stage.test.ts` passes without an edit: `3 passed (3)`.
- [x] The guard command prints nothing for the helper's prompt and still asks about the read.
- [x] No failure outside the four files of #220 in the files this change can reach (below); `guardrails.test.ts` has 45 failures, as today. The whole-suite line was left to the phase close, at the runner's request.
- [x] No added or changed line names a folder: a `node` script over `git diff -U0`, matching against `PROBE_DIRECTORIES`, reports `changed lines: 268 lines naming a folder: 0`. The diff was also read by eye. The test files have additions only.

Tests run at slice end, by file (every test file that imports `probeGuard`, `guardrails` or `stage`):

- `src/daemon/probeGuard.test.ts` — 163 passed.
- `src/commands/stage.test.ts` — 3 passed.
- `src/commands/guardrails.test.ts` — 45 failed, 25 passed (70). All 45 fail with `Error: Command failed: git push -q origin main`, the push guard refusing `workspace()`'s push (#220). All 18 new tests pass.
- `src/update-checks.test.ts` — 2 passed.
- `src/update-checks.git.test.ts` — 7 passed.
- `src/guards/checkouts.test.ts` — 7 passed.

**What 56b must know.**

- `Bash` has no entry in `TARGET_FIELDS`, so `reachesProbeDirectory` sends it to `mentionsProbeDirectory`. A shell rule needs parsing, not a list of fields, so it most likely belongs as its own branch in `reachesProbeDirectory`, before the map lookup.
- In `guardrails.test.ts`, the binding `PROBE_DIRECTORIES` now exists at module level, from the `await import` just before the 56a block. A later block at the end of the file can use it; declaring it again would be an error.
- Case 6 takes the expected decision from `SESSIONS[].read`, which depends on the kind of session only, not on host or container. When piece 2 refuses the container row with no run, that row needs its own expected value.
