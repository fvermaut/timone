# PRD-13 Acceptance Criteria — A takeover is not asked about check scripts

> Formal register for [prd-13-a-takeover-is-not-asked-about-check-scripts.md](prd-13-a-takeover-is-not-asked-about-check-scripts.md).
> Maintained by: timone-prd (creation), timone-verify (status),
> timone-prd (revisions). Requirement IDs are stable — never renumber.

In this register, as in [PRD-10's register](prd-10-the-probe-guard-knows-the-step-in-a-container.criteria.md):

- **`<probes>`** stands for either of the two folders listed in `PROBE_DIRECTORIES` in `src/daemon/probeGuard.ts`. Every criterion holds for both, with the path written relative to the repository or in full.
- **The guard** is the `PreToolUse` hook: `node dist/cli.js guardrails guard --root <root>`, fed a hook payload on stdin. It **refuses** a call when it answers `permissionDecision: "deny"`, **allows** it when it answers `"allow"`, **asks** when it answers `"ask"`, and **is silent** when it prints nothing.
- **The mark** is the variable `timone takeover` sets in the environment of the Claude session it starts (R1). **A takeover session** is one whose environment carries the mark, not empty. **A container session** is one whose environment carries `TIMONE_RUN_PROJECT` or `TIMONE_RUN_STAGE`, as PRD-10 defines it. **A person's session** carries none of the three.
- **A building step** is `execution` or `remediation`. **A checking step** is `verification` or `update`.

## R1 — A takeover session carries a mark

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN `timone takeover timone#239` resolves to opening a session
      WHEN it starts `claude`
      THEN the environment `claude` is started with holds the mark, and its value names `timone#239`
      AND every other variable of the person's own environment is passed on unchanged
    - GIVEN `timone takeover` refuses, or the person stops the wait before a session opens
      WHEN the command ends
      THEN no process was started with the mark
    - GIVEN a project's environment file under `.timone/env/` holds a line that sets the mark
      WHEN the file is read for a run
      THEN it is refused, and the refusal names the variable, as for the other names Timone sets itself
- **Verification hint:** the session is started by `openSession` in `src/commands/takeover.ts` through `deps.launcher.run("claude", [prompt], { cwd })`; `ProcessLauncher` takes no environment today, and `inheritingLauncher` passes none to `spawn`, so the child inherits the command's own. The takeover tests hold a fake launcher that records its calls. `TIMONE_TAKEOVER` is the name that fits next to `TIMONE_RUN_PROJECT` and `TIMONE_RUN_STAGE`. The reserved names are `RESERVED` in `src/daemon/run-env.ts`.

## R2 — In a takeover, the guard allows reads and writes of check scripts

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN an empty ledger, no declaration, and a takeover session that is not a container session
      WHEN the guard judges each of these calls
      THEN it allows every one of them, and the reason says in one plain sentence that this is a takeover, which does not build:
        - `Read`, `Write` and `Edit` of `<probes>/a.mjs`, with the path relative and in full
        - a `Glob` whose pattern is inside `<probes>`, and a `Grep` whose path is inside `<probes>`
        - `Bash` calls `ls <probes>`, `cat <probes>/a.mjs`, `node <probes>/a.mjs`, `git show origin/main:<probes>/a.mjs` and `git log -p -- <probes>`
        - the `Bash` call the ticket shows: `cd <project> && git ls-tree --name-only origin/main <probes>/ | grep -E '…'; gh issue view 235 --repo fvermaut/timone --json body --jq .body | head -30`
        - a `Bash` call that hands a script naming `<probes>` to an interpreter as text: `node -e "…"`
    - GIVEN the same session, with a ledger that holds a run for the ticket parked on any step (for example `execution`), whose session id is not this session's
      WHEN the guard judges a `Read` of `<probes>/a.mjs`
      THEN it allows it
    - GIVEN a takeover session that is not a container session, and a ledger with no run for the session
      WHEN the guard judges any tool call
      THEN its answer is never "ask"
- **Falsified-by:** a table test of `runGuard` in `src/commands/guardrails.test.ts`, one row per call of the first clause, seen to ask on today's code before it allows; and a test that runs the guard over every tool the table names and fails on any "ask" in a takeover session.
- **Verification hint:** `runGuard` in `src/commands/guardrails.ts` picks the stage in this order today: the ledger's run for the session, then the container's step (`containerStep`), then a declaration (`declaredStage`). The last branch of `probeGuardDecision` in `src/daemon/probeGuard.ts` asks; it is the branch every takeover reaches today. `ProbeGuardInput` already carries `container`; a takeover needs the same kind of flag.

## R3 — In a takeover, a merge conflict in a check script can be resolved

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN an empty ledger and a takeover session that is not a container session
      WHEN the guard judges each of these calls, which resolve a conflict in `<probes>/a.mjs`
      THEN it allows every one of them, and asks nothing:
        - `Bash` calls `git diff -- <probes>/a.mjs`, `git show :2:<probes>/a.mjs`, `git show :3:<probes>/a.mjs`, `git checkout --theirs -- <probes>/a.mjs`, `git checkout --ours -- <probes>/a.mjs` and `git add <probes>/a.mjs`
        - a `Read` of `<probes>/a.mjs`, then an `Edit` of it whose old text holds the conflict markers `<<<<<<<`, `=======` and `>>>>>>>` and whose new text holds none
    - GIVEN a test repository with a merge that stops on a conflict in `<probes>/a.mjs`, and a takeover session
      WHEN each call of the first clause that a person would use is passed to the guard command and then run
      THEN the guard allows each, and after `git add` and `git commit` the merge is complete with the file holding no conflict marker
- **Falsified-by:** the same table test as R2, holding every call of the first clause, which goes red if any is asked or refused.
- **Verification hint:** `git merge`, `git commit` and `git merge --continue` do not name a folder, so the guard is silent on them already. The rows that matter are those naming a file in `<probes>`: the shell rule in `shellReachesProbeDirectory` judges `:2:<probes>/…` as a real read, because a path that follows `:` reaches the folder.

## R4 — Building steps are refused exactly as today

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN a session the ledger places as a run whose stage is `execution`, and then `remediation`, whose environment also carries the mark
      WHEN the guard judges a `Read` of `<probes>/a.mjs`
      THEN it refuses it, with the reason it gives a building step today
    - GIVEN an empty ledger and a container session whose step is `execution`, and then `remediation`, whose environment also carries the mark
      WHEN the guard judges a `Read` of `<probes>/a.mjs`
      THEN it refuses it, with the reason it gives a building step today
    - GIVEN an empty ledger and a container session whose step is `requirements`, or missing, whose environment also carries the mark
      WHEN the guard judges a `Read` of `<probes>/a.mjs`
      THEN it refuses it, with the reason PRD-10 R3 gives a container
    - GIVEN an empty ledger, a takeover session that is not a container session, and a declaration in `.timone/declared-stages.json` that the session runs `execution`
      WHEN the guard judges a `Read` of `<probes>/a.mjs`
      THEN it refuses it
    - GIVEN the same, with a declaration of `verification`, and then of `planning`
      WHEN the guard judges a `Read` of `<probes>/a.mjs`
      THEN it allows it
- **Falsified-by:** a test of `runGuard` per clause, which goes red if the mark lets a building step or any container session through.
- **Verification hint:** the ledger and the container's step come before anything else in `runGuard` today and must stay first. Every criterion of PRD-10 R2, R3 and R5 still holds; its tests are the regression check for this one.

## R5 — A session that is neither placed nor a takeover is still asked

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN an empty ledger and a person's session, with no declaration
      WHEN the guard judges a `Read` of `<probes>/a.mjs`
      THEN it asks, with the question it asks today
    - GIVEN the same, but the environment sets the mark to an empty value
      WHEN the guard judges the same call
      THEN it asks
    - GIVEN an empty ledger and a person's session that declares `verification`
      WHEN the guard judges the same call
      THEN it allows it, as it does today
- **Verification hint:** these are the cases of PRD-10 R2's last clause; that test stays and gains the empty mark.

## R6 — A test runs the guard command as a takeover runs it

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN the project's test suite
      WHEN it is run
      THEN it holds a test that starts the guard command itself, as the hook starts it, with a state file that holds no run for the session, a hook payload on stdin, and an environment that holds the mark and neither `TIMONE_RUN_PROJECT` nor `TIMONE_RUN_STAGE`
      AND that test checks that a `Bash` call `ls <probes>` and a `Write` of `<probes>/a.mjs` are allowed, and that the same calls are asked when the mark is left out
    - GIVEN that test
      WHEN the guard command is changed for a moment to ignore the mark
      THEN the test fails
- **Verification hint:** `src/commands/guardrails.guard-command.test.ts` already starts the command for a container session (PRD-10 R6); the takeover case belongs next to it. It is the only test that proves the command reads the mark from its own process environment.

## R7 — `timone stage` says the truth in a takeover

- **Priority:** SHOULD
- **Status:** draft
- **Verify-via:** api
- **Criteria:** In a takeover session that is not a container session, `timone stage verification` and `timone stage --clear` say that a takeover may already read and change the check scripts without being asked. `timone stage execution` says the session is now refused them. A person's session and a container session get the sentences they get today.
- **Verification hint:** the sentences are built by `guardSays` in `src/commands/stage.ts`, which handles a container session first through `containerSays`.

## R8 — A real takeover is not asked

- **Priority:** SHOULD
- **Status:** draft
- **Verify-via:** live
- **Criteria:** On fvermaut's own machine, in a session opened with `timone takeover` on any ticket after the fix is installed, the session lists the check-script folder of a project and reads one check script, and no question from the guard appears. In a plain `claude` session at the same root, the same listing is still asked.
- **Verification hint:** the ticket's own command, a `git ls-tree` of the project's check-script folder on `origin/main`, is the call to repeat. The guard's question begins with *"This is"* and ends with *"Allow only if you are not building."*; a takeover's transcript should not hold it.
