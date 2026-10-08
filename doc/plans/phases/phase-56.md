# Phase 56: The guard judges only real reads and writes — text that only names the check folders passes

> **Status:** Planned.

> **Companion phases:** [phase 54](phase-54.md), the last merged, touched none of these files; phase 55 is reserved by another ticket. The next piece of the same list, *each container knows its step* ([breakdown of #87](../breakdowns/ticket-87.md), piece 2), changes `runGuard` in `src/commands/guardrails.ts` and `guardSays` in `src/commands/stage.ts` again, and builds on what this phase leaves. Governing decisions: [ADR-0048](../../adr/0048-a-verification-probe-is-kept-proved-able-to-fail-and-hidden-from-the-builder.md) D4 — the builder is kept from the check scripts by this hook, so every real read, list, run or write must still be judged; this phase narrows only what counts as one. [ADR-0018](../../adr/0018-the-session-bracket-belongs-to-the-hooks.md) — the guard is a `PreToolUse` hook that must never break a session, so every new path through it stays inside the existing `try`, and a command it cannot read falls back to the old rule rather than throwing. [ADR-0050](../../adr/0050-timone-becomes-a-managed-project-once-the-run-path-is-fixed.md) D5 — this project is Timone, so `src/` is committed here.

> **Screens changed:** none — the guard answers a hook on stdout; no slice changes anything a person sees.

## Requirements

> **PRD:** [prd-10-the-probe-guard-knows-the-step-in-a-container.md](../../specs/prd/prd-10-the-probe-guard-knows-the-step-in-a-container.md) — criteria in [prd-10-the-probe-guard-knows-the-step-in-a-container.criteria.md](../../specs/prd/prd-10-the-probe-guard-knows-the-step-in-a-container.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-10.R4 | MUST | Text that only names a check-script folder — a helper's prompt, a commit message, ticket and pull request text, text written into another file, a search for the folder's name elsewhere — is not judged, for every kind of session. |
| PRD-10.R5 | MUST | A real read, list, run or write of a check script — by a file tool, a search tool, or a shell command, also when joined to a command that passes, and any script handed to an interpreter as text, and any tool with no rule — is still judged. |

In this file, as in the register, **`<probes>`** stands for either folder in `PROBE_DIRECTORIES` (`src/daemon/probeGuard.ts`). The folders' paths are never written out here, in a helper's prompt, in a test or in a commit message: until this phase is deployed, the guard that judges the build of this phase is today's guard, and it refuses or asks about any call whose text names them. Tests build every fixture from `PROBE_DIRECTORIES`, as `src/update-checks.test.ts` already does.

## Goal Description

[#192](https://github.com/fvermaut/timone/issues/192) records three calls the guard refused during a build on 2026-10-02: a helper's prompt that said *not* to open the folders, a shell edit of the phase file whose text named the shared folder's README, and the commit whose message named that path. The build instructions require the first of them. The cause is `mentionsProbeDirectory` (`src/daemon/probeGuard.ts:57`): it looks at every string in the tool's input and cannot tell a read from a sentence. This phase is piece 1 of the [list approved on #87](../breakdowns/ticket-87.md) and goes first for the reason the list gives: once piece 2 lets a container know its step, a builder there would be refused every call that names the folders, including that prompt.

**The cut.** The guard learns which tool is being called — `runGuard` already receives it as `toolName`, and only the push guard uses it today — and judges each tool by what it opens. Slice 56a does this for the file tools, the search tools and the helper prompt, where the target is a named field. Slice 56b does it for `Bash`, which needs the command read into its separate commands and words. They are two slices because the second is most of the work and most of the risk, and the first is observable on its own: after 56a, #192's first call passes and every file-tool read is still judged.

**Three choices the PRD left open were settled when the list was approved** (the breakdown's last section): a script handed to `python`, `node` or a shell as text is judged by all of its text; a tool with no rule is judged by all of its input text; and — piece 2, not here — a container step that neither builds nor checks is refused. This phase follows the first two exactly.

**Decisions taken here that do not clear the ADR bar.** (1) *The shell command is read by a small reader written for this, not by a parsing library.* The project has four runtime dependencies; the hook runs on every tool call of every session; the forge guard (`src/daemon/forge-guard.ts`) already reads command lines by hand. It is one new file with no caller but the guard, so it is not hard to reverse, and it trades nothing the PRD or a standard cares about. (2) *In a shell command, a word reaches a folder when the folder's path starts the word, or follows `/`, `:` or `=` in it* (`cat <probes>/a.sh`, `/abs/…/<probes>`, `HEAD:<probes>/a.sh`, `--file=<probes>/x`). After a space or any other character it is text (`-m "Do not open <probes>"`). This is the plainest test that separates the two shapes R4 and R5 list. Its known cost: a commit message or a `grep` pattern that *begins* with the path is judged. The way round is the one R4 already names: start the sentence with a word, or search with the `Grep` tool. Both are rules inside one function, changed by editing it; neither surprises a reader who has the PRD.

**Regression set** (ADR-0051 D4: MUST, `api`, `verified`, narrowed by `Depends-on`). The diff touches `src/daemon/` (new `shell-words.ts`, `probeGuard.ts`) and `src/commands/` (`guardrails.ts`, `stage.ts`). That brings in [PRD-07.R4](../../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md), [R6](../../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md) and [R9](../../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md), whose `Depends-on` names all of `src/daemon/`. None of them reads the guard; the whole suite is their gate. **A live gate is owed before delivery** by the letter of D4: [PRD-02.R2](../../specs/prd/prd-02-inversion-of-control.criteria.md) (*daemon-spawned sessions resolve a target project*, `live`, `verified`) names `src/commands/guardrails.ts`, and several `live` criteria name all of `src/daemon/`. The change cannot alter how a session finds its project — `sessionRun` and `runForSession` are not touched — and delivery should say which observation it relies on. **What no criterion watches:** that the guard still says nothing for a call that names no folder at all (the common case, nearly every tool call made). Today's test *"stays silent when the call has nothing to do with a probe"* covers one `file_path`; 56a and 56b each add a silent case for their own tools, and those cases are a hard gate.

`doc/standards.md` does not exist in this project; the central `standards/` entries for TypeScript, testing and code smells govern, as for the rest of `src/`. `testing.md` puts the seam at the public function and keeps private helpers untested directly, which is why the shell reader is tested through `probeGuardDecision` and not on its own. No triage record under `doc/triage/` covers #229; the ticket is a step of the approved list.

## Context & Prerequisites

- **`src/daemon/probeGuard.ts`** — `PROBE_DIRECTORIES` (11), `strings` (36), `mentionsProbeDirectory` (57, with the comment that keeps the accepted two-step gap), `ProbeGuardInput` (69: `toolInput`, `stage`), `probeGuardDecision` (85: silent unless `mentionsProbeDirectory`, then deny / allow / ask by stage). The three reasons it gives stay word for word.
- **`src/commands/guardrails.ts`** — `GuardDeps.toolName` (152) is already filled from the payload's `tool_name` by the `guard` command (527). `runGuard` (182) passes only `toolInput` and `stage` to `probeGuardDecision`.
- **`src/commands/stage.ts`** — `guardSays` (40) asks `probeGuardDecision` about the bare string `PROBE_DIRECTORIES[0]` with no tool name. Its four sentences are pinned by `src/commands/stage.test.ts` (59-95).
- **`src/daemon/probeGuard.test.ts`** — existing tests spell the folders out; they call `probeGuardDecision` and `mentionsProbeDirectory` without a tool name and must stay green unchanged (no tool name means *no rule*, which keeps today's behaviour). New tests are added in new `describe` blocks at the end of the file, built from `PROBE_DIRECTORIES`; never edit a line of the old tests that holds a folder's path.
- **`src/commands/guardrails.test.ts`** — its `workspace()` helper makes git repositories and pushes to a throwaway remote, which the run's push guard refuses inside a container: 45 tests of this file fail there today, for the reason [#220](https://github.com/fvermaut/timone/issues/220) fixes. New `runGuard` tests must not call `workspace()`: make the root with `mkdtempSync` alone and open the ledger with `newStore(root)`. They then run in a container.
- **Known-bad state** — in a run's container today, `npx vitest run` ends `Test Files 4 failed | 72 passed (76)`, `Tests 70 failed | 1914 passed (1984)`; the four files are `src/commands/guardrails.test.ts`, `src/numbers.test.ts`, `src/workspace.test.ts` and `src/commands/number.test.ts`, all #220. Clearing `GIT_CONFIG_*` on the command line is refused by the push guard, rightly. So the whole-suite gate below is: **no failure outside those four files, and no new failure inside them** (if #220 has merged by the time this is built, the whole suite passes).
- **Tool inputs** (from `node_modules/@anthropic-ai/claude-agent-sdk/sdk-tools.d.ts`): `Read`, `Write`, `Edit` — `file_path`; `NotebookEdit` — `notebook_path`; `Glob` — `pattern`, `path`; `Grep` — `pattern`, `path`, `glob`; `Bash` — `command`; `Agent` — `prompt`, `description`, `subagent_type` (older versions called this tool `Task`, with the same fields).
- **`CONTEXT.md`** calls these files *probes*, and *check scripts* in words to a person. Code and comments keep *probe*.

## Sub-phases

### Sub-phase 56a: The file tools, the search tools and a helper's prompt are judged by what they open

**[MODIFY]** `src/daemon/probeGuard.ts` —
- `ProbeGuardInput` gains `toolName?: string | undefined` (the hook payload's `tool_name`; undefined when a caller does not know it).
- New exported `reachesProbeDirectory(toolName: string | undefined, toolInput: unknown): boolean`, which `probeGuardDecision` calls in place of `mentionsProbeDirectory`. Rules, by tool name:
  - `Read`, `Write`, `Edit` → only `file_path` is looked at. `NotebookEdit` → only `notebook_path`.
  - `Glob` → `pattern` and `path`. `Grep` → `path` and `glob`; its `pattern` is text.
  - `Agent` and `Task` → nothing is looked at: a helper's prompt is text.
  - `Bash` → in this slice, unchanged: all of its text (56b replaces this).
  - Any other tool name, or none → all of its input text, as today (`mentionsProbeDirectory`).
  - A field is looked at with today's test: the string contains a folder's path. A field that is missing or not a string is skipped, not an error.
- Doc comments: `reachesProbeDirectory` says why tools are judged by their target (#192), and that a tool with no rule keeps the old rule so a new tool is covered the day it appears (the choice approved with the list). `mentionsProbeDirectory`'s comment says it is now the rule for a tool with no rule.

**[MODIFY]** `src/commands/guardrails.ts` — `runGuard` passes `toolName: deps.toolName` to `probeGuardDecision`. Nothing else in the file changes.

**[MODIFY]** `src/commands/stage.ts` — `guardSays` asks the guard about the call its sentence is about: `toolName: "Read"`, `toolInput: { file_path: join(PROBE_DIRECTORIES[0], "x.mjs") }`. Its sentences do not change; `stage.test.ts` passes unchanged.

**[MODIFY]** `src/daemon/probeGuard.test.ts`, `src/commands/guardrails.test.ts` — the cases below.

**Seams under test (TDD):** `probeGuardDecision` is the seam — pure, exported, and the one function every caller asks; the stage it is given is the kind of session. `runGuard` is the second seam, for the one thing `probeGuardDecision` cannot show: that the tool name and the session kind reach it from the hook's side, on the host and in a container. Fixture paths: `const p = PROBE_DIRECTORIES[0]`, `const shared = PROBE_DIRECTORIES[1]`; file names joined with `join` or a template string.

In `probeGuard.test.ts`, a new `describe("what the guard judges: the file tools, the search tools and a helper (PRD-10 R4, R5)")`, as `it.each` tables over the stages `execution`, `remediation`, `verification`, `update`, `planning` and `undefined` (a person):

1. **Silent (R4), red today for every stage:** `Agent` with `prompt: \`Do not open ${p} or ${shared}.\``; `Task` with the same prompt; `Edit` of `doc/plans/phases/phase-42.md` whose `new_string` names `${shared}/README.md`; `Write` of that file whose `content` names it; `Grep` with `pattern: p`, `path: "src/"`; `Grep` with `pattern: p` and no `path`. Each → `undefined`.
2. **Still judged (R5), green before and after:** `Read`, `Write`, `Edit` of `${p}/a.sh` and of the full path `/workspace/timone/projects/timone/${p}/a.sh`; `NotebookEdit` of `${p}/a.ipynb`; `Glob` with `pattern: \`${p}/*.mjs\``; `Glob` with `pattern: "*.mjs"`, `path: p`; `Grep` with `pattern: "total"`, `path: p`; `Grep` with `pattern: "total"`, `glob: \`${shared}/**\``. Each → `deny` for `execution` and `remediation`, `allow` for `verification` and `update`, `ask` for `planning` and `undefined`, with today's three reasons.
3. **A tool with no rule keeps the old rule (R5):** `toolName: "WebFetch"` with `prompt` naming `p`; `toolName: "mcp__x__y"` with a nested field naming it; `toolName: undefined` with `{ file_path: \`${p}/a.sh\` }` → judged as in case 2.
4. **The common case stays silent (hard gate):** `Read` of `src/index.ts`, `Write` of `doc/plans/phases/reports/phase-42-complete.md` with content naming nothing, `Agent` with a prompt naming nothing, `Glob` of `src/**/*.ts` → `undefined` for every stage.

In `guardrails.test.ts`, a new `describe("the guard judges only real reads and writes, for every kind of session (PRD-10 R4, R5)")` that never calls `workspace()`. Kinds of session: a ledger run at `execution`, a ledger run at `verification`, and no run (a person); each with `env: {}` (host) and `env: { TIMONE_RUN_PROJECT: "timone" }` (container). For each of the six:

5. **#192's first two calls pass (R4), red today:** `runGuard` with `toolName: "Agent"` and the prompt of case 1, and with `toolName: "Edit"` and the edit of case 1 → `undefined`.
6. **A real read is still judged (R5), green before and after:** `toolName: "Read"` of `${p}/prd-10.r1.mjs` → `deny` for the `execution` run, `allow` for the `verification` run, `ask` for the person. (Piece 2 changes the container row with no run: there it will be refused. Leave that to piece 2.)

> No dependency on other sub-phases.

Write cases 1 and 5 first and run them red; record the red output in the handoff. Cases 2, 3, 4 and 6 are green before the change and must stay green. The existing tests of `probeGuard.test.ts`, `guardrails.test.ts` and `stage.test.ts` are not edited.

#### Agent Validation Steps

```bash
cd projects/timone
npx tsc --noEmit; echo "exit: $?"                                   # expect 0
npx vitest run src/daemon/probeGuard.test.ts src/commands/stage.test.ts; echo "exit: $?"   # expect 0
npx vitest run src/commands/guardrails.test.ts -t "only real reads and writes"; echo "exit: $?"   # expect 0 (runs in a container: no workspace())
# The guard command itself, as the hook calls it: an empty ledger, a person's session.
npm run build >/dev/null; echo "exit: $?"                          # expect 0
S="$(mktemp -d)/state.json"
P=$(node -e 'import("./dist/daemon/probeGuard.js").then(m=>console.log(m.PROBE_DIRECTORIES[0]))')
printf '{"session_id":"s1","tool_name":"Agent","tool_input":{"prompt":"Do not open %s","description":"d"}}' "$P" \
  | node dist/cli.js guardrails guard --root . --state "$S"; echo "exit: $?"   # expect no output, exit 0
printf '{"session_id":"s1","tool_name":"Read","tool_input":{"file_path":"%s/a.sh"}}' "$P" \
  | node dist/cli.js guardrails guard --root . --state "$S" | grep -c '"permissionDecision":"ask"'   # expect 1
npx vitest run 2>&1 | grep -E '^ FAIL ' | grep -vE 'src/(commands/guardrails|numbers|workspace|commands/number)\.test\.ts' ; echo "exit: $?"   # expect no lines, exit 1
```

- [ ] Cases 1 and 5 were red before the change and are green after; the handoff shows both runs.
- [ ] Cases 2, 3, 4 and 6 are green before and after.
- [ ] `stage.test.ts` passes without an edit: `timone stage` says the same sentences.
- [ ] The guard command prints nothing for the helper's prompt and still asks about the read.
- [ ] The whole suite has no failure outside the four files of #220, and the count of failures in `guardrails.test.ts` is not higher than the 45 of today.
- [ ] No file this slice adds or edits contains a folder's path written out (`git diff` is checked by eye; a grep would need the path).

---

### Sub-phase 56b: A shell command is judged by the words that reach the folders

**[NEW FILE]** `src/daemon/shell-words.ts` — a reader of one `Bash` command string. Exported only for `probeGuard.ts`. It returns either *unreadable*, or the list of simple commands in the string, each with:
- `words` — its words with quotes and backslashes removed, the program first. A redirection's target (`>`, `>>`, `<`, `2>`, `&>`, `>|`, and the word after `<<<`) is a word too.
- `heredocs` — the bodies of its here-documents (`<<WORD`, `<<-WORD`, `<<'WORD'`, `<<"WORD"`), kept apart from the words.
- `substitutions` — the text inside each `$( … )` and each `` ` … ` `` found outside single quotes, including inside double quotes and inside a here-document whose delimiter was not quoted. That text is read again by the same reader, and its commands join the list.

Commands are separated by `;`, `&&`, `||`, `|`, `&`, and newlines outside quotes. `( … )` and `{ …; }` groups are read as the commands inside them. Anything the reader cannot finish — an unclosed quote, an unclosed `$(`, a here-document with no closing line — makes the whole command *unreadable*. The reader never throws.

**[MODIFY]** `src/daemon/probeGuard.ts` — the `Bash` rule of `reachesProbeDirectory` becomes:
1. Read `command` with the reader. *Unreadable* → judge all of the call's text, as today.
2. **A command that hands code to an interpreter as text** makes the whole call judged by all of its text, as today (approved with the list). That is a command whose program, after any leading `VAR=value` words and the wrappers `env`, `sudo`, `command`, `exec`, `time`, `nice`, `nohup` and `timeout <n>`, is:
   - `eval` or `xargs`; or
   - a shell or interpreter — `sh`, `bash`, `zsh`, `dash`, `ksh`, `python`, `python3`, `node`, `deno`, `bun`, `tsx`, `perl`, `ruby`, `php` — called with `-c`, `-e`, `-p`, `--eval` or `--print`, or with `-` as its script, or with no script file at all (it reads a here-document, a here-string or a pipe).
   An interpreter given a script file is not this case: its words are judged as in 3, so `bash <probes>/a.sh` and `node <probes>/a.mjs` are judged by their path.
3. Otherwise, the call reaches a folder when **any word** of any command reaches it: a folder's path starts the word, or follows `/`, `:` or `=` in it. Here-document bodies are not looked at (they are text a command reads, and the interpreter case of 2 has already caught the ones that run). A path after any other character — a space, a quote mark, a backtick — is text.
- Program names are matched on the last part of the path (`/usr/bin/python3` is `python3`), and a version suffix is allowed on `python` (`python3.12`).
- Update `mentionsProbeDirectory`'s comment block: the accepted gap (a path reached in two moves, a variable, a path built from pieces, a wildcard, a search of the whole project) stays, word for word in meaning; add the interpreter rule of 2 and why (the guard cannot tell what a script will do), and the start-of-word rule of 3 with its known cost (a message or `grep` pattern that *begins* with the path is judged; start it with a word, or use the `Grep` tool).

**[MODIFY]** `src/daemon/probeGuard.test.ts`, `src/commands/guardrails.test.ts` — the cases below.

**Seams under test (TDD):** `probeGuardDecision` with `toolName: "Bash"` is the seam, as in 56a; the reader is private to the guard and is tested through it (`testing.md`: a helper reachable through a public seam is not a seam). `runGuard` carries #192's commit for every kind of session. Same fixture rule as 56a: paths from `PROBE_DIRECTORIES`, never written out. In `probeGuard.test.ts`, a new `describe("what the guard judges: shell commands (PRD-10 R4, R5)")`, as `it.each` tables over the same six stages:

1. **Silent (R4), red today for every stage:** `git commit -m "Do not open ${p}"`; `git commit -m "$(cat <<'EOF'` ⏎ `docs: name ${shared}/README.md` ⏎ `EOF` ⏎ `)"` (the form commits are written in); `gh issue comment 87 --body "Do not open ${p}"`; `gh pr create --title "t" --body "Do not open ${p}"`; `gh pr create --title "t" --body "$(cat <<'EOF'` … names `p` … `EOF` ⏎ `)"`; `cat >> doc/plans/phases/phase-42.md <<'EOF'` ⏎ `See ${shared}/README.md` ⏎ `EOF`; the same with `cat >`; `tee doc/plans/phases/phase-42.md <<'EOF'` … `EOF`; `tee -a doc/plans/phases/phase-42.md <<'EOF'` … `EOF`. Each → `undefined`.
2. **Still judged (R5), red for none, must stay judged:** `cat ${p}/a.sh`; `ls ${p}`; `sed -n 1,20p ${p}/a.sh`; `head ${p}/a.sh`; `bash ${p}/a.sh`; `node ${p}/a.mjs`; `grep -rn total ${p}`; `cp ${p}/a.sh /tmp/`; `echo x > ${p}/b.sh`; `echo x >${p}/b.sh`; `git show HEAD:${p}/a.sh`; `git log -p -- ${p}`; `cat /workspace/timone/projects/timone/${p}/a.sh`; `cat "${p}/my file.sh"`. Each → `deny` for `execution` and `remediation`, `allow` for `verification` and `update`, `ask` for `planning` and `undefined`.
3. **Joined to a call that passes (R5):** `git commit -m "x" && cat ${p}/a.sh`; `git commit -m "Do not open ${p}"; ls ${p}`; `echo "$(cat ${p}/a.sh)"` → judged as in case 2.
4. **Handed to an interpreter as text (R5):** `python3 - <<'EOF'` ⏎ `print(open("${p}/a.sh").read())` ⏎ `EOF`; `node -e "require('fs').readFileSync('${p}/a.mjs')"`; `bash -c "cat ${p}/a.sh"`; `echo "cat ${p}/a.sh" | sh`; `eval "cat ${p}/a.sh"`; and `python3 - <<'EOF'` whose body only *prints a sentence* naming `p` → judged as in case 2 (the last one is the accepted cost of the approved rule; the test says so in its name).
5. **Unreadable falls back to the old rule:** `cat "${p}/a.sh` (no closing quote) and `git commit -m "$(cat <<'EOF'` naming `p` with no closing `EOF` → judged as in case 2; a command with no folder in it that is unreadable (`echo "x`) → `undefined`.
6. **The common case stays silent (hard gate):** `npx vitest run`, `git status`, `cat src/index.ts | head`, `node dist/cli.js number timone phase`, `python3 - <<'EOF'` ⏎ `print(1)` ⏎ `EOF` → `undefined` for every stage.

In `guardrails.test.ts`, inside 56a's `describe`, for the same six kinds of session:

7. **#192's third call passes (R4), red today:** `runGuard` with `toolName: "Bash"` and the commit of case 1 (the here-document form) → `undefined`.
8. **A real read joined to it is still judged (R5):** `toolName: "Bash"`, `git commit -m "x" && cat ${p}/a.sh` → `deny` / `allow` / `ask` as in 56a's case 6.

> Sub-phase 56a must be complete before starting this sub-phase (it adds `toolName` to the guard and the dispatch by tool that this slice fills in for `Bash`; both slices edit the same two test files).

Write cases 1 and 7 first and run them red; record the red output in the handoff. Cases 2 to 6 and 8 are green before the change and must stay green; they are what proves the change narrowed nothing it should not.

#### Agent Validation Steps

```bash
cd projects/timone
npx tsc --noEmit; echo "exit: $?"                                   # expect 0
npx vitest run src/daemon/probeGuard.test.ts src/commands/stage.test.ts; echo "exit: $?"   # expect 0
npx vitest run src/commands/guardrails.test.ts -t "only real reads and writes"; echo "exit: $?"   # expect 0
# shell-words.ts is used by the guard and nothing else.
grep -rln "shell-words" src --include=*.ts; echo "exit: $?"         # expect only src/daemon/probeGuard.ts, exit 0
# The guard command itself, with #192's commit and with a real read joined to it.
npm run build >/dev/null; echo "exit: $?"                          # expect 0
S="$(mktemp -d)/state.json"
P=$(node -e 'import("./dist/daemon/probeGuard.js").then(m=>console.log(m.PROBE_DIRECTORIES[1]))')
node -e 'const p=process.argv[1]; console.log(JSON.stringify({session_id:"s1",tool_name:"Bash",tool_input:{command:`git commit -m "$(cat <<'"'"'EOF'"'"'\ndocs: name ${p}/README.md\nEOF\n)"`}}))' "$P" \
  | node dist/cli.js guardrails guard --root . --state "$S"; echo "exit: $?"   # expect no output, exit 0
node -e 'const p=process.argv[1]; console.log(JSON.stringify({session_id:"s1",tool_name:"Bash",tool_input:{command:`git commit -m "x" && cat ${p}/a.sh`}}))' "$P" \
  | node dist/cli.js guardrails guard --root . --state "$S" | grep -c '"permissionDecision":"ask"'   # expect 1
npx vitest run 2>&1 | grep -E '^ FAIL ' | grep -vE 'src/(commands/guardrails|numbers|workspace|commands/number)\.test\.ts' ; echo "exit: $?"   # expect no lines, exit 1
```

- [ ] Cases 1 and 7 were red before the change and are green after; the handoff shows both runs.
- [ ] Cases 2 to 6 and 8 are green before and after.
- [ ] The guard command prints nothing for #192's commit and still asks about the joined read.
- [ ] `mentionsProbeDirectory`'s comment states the accepted gap, the interpreter rule and the start-of-word rule with its cost.
- [ ] The whole suite has no failure outside the four files of #220, and the count of failures in `guardrails.test.ts` is not higher than the 45 of today.
- [ ] No file this slice adds or edits contains a folder's path written out.

## Dependency graph

```
56a → (none)   the guard learns the tool's name; file tools, search tools and a helper's prompt are judged by what they open
56b → 56a      Bash commands are read into commands and words; only a word that reaches a folder, or code handed to an interpreter, is judged
```

The two slices share `src/daemon/probeGuard.ts` and both test files, so they run one after the other. There is no documentation slice: the rule is described in the guard's own comment (56b), and nothing in `process.md`, the skills or the ADRs describes the old rule of judging every string.
