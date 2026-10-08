# PRD-10 Acceptance Criteria — The probe guard knows the step in a container, and judges only real reads and writes

> Formal register for [prd-10-the-probe-guard-knows-the-step-in-a-container.md](prd-10-the-probe-guard-knows-the-step-in-a-container.md).
> Maintained by: timone-prd (creation), timone-verify (status),
> timone-prd (revisions). Requirement IDs are stable — never renumber.

In this register:

- **`<probes>`** stands for either of the two folders listed in `PROBE_DIRECTORIES` in `src/daemon/probeGuard.ts`. Every criterion holds for both, with the path written relative to the repository or in full. The register does not spell the paths out because, until R4 holds, a session that writes them is stopped by the very hook this register is about.
- **The guard** is the `PreToolUse` hook: `node dist/cli.js guardrails guard --root <root>`, fed a hook payload on stdin. It **refuses** a call when it answers `permissionDecision: "deny"`, **allows** it when it answers `"allow"`, **asks** when it answers `"ask"`, and **is silent** when it prints nothing.
- **A container session** is a session whose environment carries `TIMONE_RUN_PROJECT`, as every session Timone starts in a container does since #85. **A person's session** is one whose environment carries neither that nor the container's step.
- **A building step** is `execution` or `remediation`. **A checking step** is `verification` or `update`.

## R1 — A container carries the name of its step

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN the runner starts a step `S` of a run in a container
      WHEN the container's environment is built
      THEN it holds the name `S`, spelled as the ledger records the run's stage
    - GIVEN the daemon starts a session for a run in a container in any other way it does today
      WHEN the container's environment is built
      THEN it holds the name of that session's step, spelled as the ledger records it
    - GIVEN a project's environment file under `.timone/env/` holds a line that sets the variable that carries the step
      WHEN the file is read for a run
      THEN it is refused, and the refusal names the variable, as for the other names the container sets for itself
- **Verification hint:** the environment is built in `src/daemon/container-runtime.ts`, next to `TIMONE_COMMIT`, `PROJECT_REMOTE`, `TIMONE_RUN_PROJECT` and `TIMONE_RUN_BRANCH`; `TIMONE_RUN_STAGE` is the name that fits them. The runner starts a step in `src/runner/actions.ts`, where `setStage` records the step just before `startStep`; today `SessionRequest` (`src/daemon/session.ts`) carries no step. The reserved names are `RESERVED` in `src/daemon/run-env.ts`. The existing tests of the container's environment are the place to read the built environment back.

## R2 — In a container with no run in the ledger, the guard judges by the container's step

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN an empty ledger and a container session whose step is `verification`
      WHEN the guard judges a `Write` of `<probes>/prd-10.r1.mjs`, and then a `Bash` call `node <probes>/prd-10.r1.mjs`
      THEN it allows both, and asks nothing
    - GIVEN the same, with the step `update`
      WHEN the guard judges a `Read` of `<probes>/prd-10.r1.mjs`
      THEN it allows it
    - GIVEN an empty ledger and a container session whose step is `execution`, and then `remediation`
      WHEN the guard judges a `Read` of `<probes>/prd-10.r1.mjs`
      THEN it refuses it, with the reason it gives a building step on the host today
    - GIVEN an empty ledger, a container session whose step is `execution`, and a declaration in `.timone/declared-stages.json` that the session runs `verification`
      WHEN the guard judges a `Read` of `<probes>/prd-10.r1.mjs`
      THEN it refuses it
    - GIVEN a ledger with a run for the session whose stage is `execution`, and a container step `verification`
      WHEN the guard judges a `Read` of `<probes>/prd-10.r1.mjs`
      THEN it refuses it: the ledger wins
    - GIVEN an empty ledger and a person's session
      WHEN the guard judges a `Read` of `<probes>/prd-10.r1.mjs`, first with no declaration and then with a declaration of `verification`
      THEN it asks, and then it allows, as it does today ([#169](https://github.com/fvermaut/timone/issues/169))
- **Falsified-by:** a test of `runGuard` in `src/commands/guardrails.test.ts`, one per clause, each seen to fail on today's code before it passes, which goes red when the container's step is ignored, or when a declaration is allowed to beat it.
- **Verification hint:** the order is decided in `runGuard` (`src/commands/guardrails.ts`): today it takes the ledger's run, then the declaration, and never the environment. `sessionRun` in the same file already reads `TIMONE_RUN_PROJECT` with the ledger winning, and is the pattern to follow. Run the guard with `--state` pointing at an empty state file and the environment set on the command line.

## R3 — In a container the guard never asks

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN an empty ledger and a container session whose step is any name in `PIPELINE_STAGES` that is neither a building nor a checking step (for example `requirements`, `planning`, `delivery`)
      WHEN the guard judges a `Read` of `<probes>/prd-10.r1.mjs`
      THEN it refuses it, and the reason says in one or two plain sentences that only the checking step uses these files and that nobody in a container can be asked
    - GIVEN an empty ledger and a container session whose step is missing, empty, or a name that is not in `PIPELINE_STAGES`
      WHEN the guard judges the same call
      THEN it refuses it, with the same reason
    - GIVEN any container session, with any step or none, and any tool call
      WHEN the guard judges it
      THEN its answer is never "ask"
- **Falsified-by:** a test that runs the guard over every name in `PIPELINE_STAGES`, plus a missing, an empty and an unknown step, in a container session with an empty ledger, and fails on any "ask". It is seen to fail on today's code first.
- **Verification hint:** today the last branch of `probeGuardDecision` in `src/daemon/probeGuard.ts` asks for every session that is neither a builder nor a checker. That branch stays for a person's session.

## R4 — Text that only names a check-script folder is not judged

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** api
- **Criteria:**
    - GIVEN a building step's session, a checking step's session, and a person's session, on the host and in a container
      WHEN the guard judges each of these calls
      THEN it is silent on every one of them:
        - an `Agent` call whose prompt says "Do not open `<probes>`"
        - an `Edit` of `doc/plans/phases/phase-42.md` whose new text names `<probes>/README.md`, and a `Write` of that file whose content names it
        - a `Bash` call `git commit -m "… <probes> …"`
        - a `Bash` call `gh issue comment 87 --body "… <probes> …"`, and `gh pr create --title "…" --body "… <probes> …"`
        - a `Bash` call that writes text naming `<probes>` straight into a file outside the folders: `cat >> doc/plans/phases/phase-42.md <<'EOF'` … `EOF`, and the same with `cat >` and with `tee`
        - a `Grep` whose pattern is the folder's name and whose path is `src/`
    - GIVEN the three calls #192 records: the prompt telling a helper not to open the folders, the edit of the phase file naming the shared folder's README, and the commit whose message names that path
      WHEN each is made, in the form R4's first clause lists for it, by a building step in a container
      THEN none of them is refused
- **Falsified-by:** a table test in `src/daemon/probeGuard.test.ts` holding every call of the first clause, for each kind of session, seen to fail on today's code before it passes.
- **Verification hint:** today `mentionsProbeDirectory` in `src/daemon/probeGuard.ts` looks at every string in the tool's input. The tool's name reaches the guard as `tool_name` in the hook payload, and `runGuard` already receives it as `toolName`. `guardSays` in `src/commands/stage.ts` calls the guard with a bare path and no tool name, and must still print the right sentence.

## R5 — A real read, list, run or write of a check script is still judged

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** api
- **Criteria:**
    - GIVEN a building step's session, in a container and on the host
      WHEN the guard judges each of these calls
      THEN it refuses every one of them:
        - `Read`, `Write` and `Edit` of `<probes>/a.sh`, and `NotebookEdit` of `<probes>/a.ipynb`, with the path relative and in full
        - a `Glob` whose pattern or path is inside `<probes>`, and a `Grep` whose path is inside `<probes>`
        - `Bash` calls `cat <probes>/a.sh`, `ls <probes>`, `sed -n 1,20p <probes>/a.sh`, `head <probes>/a.sh`, `bash <probes>/a.sh`, `node <probes>/a.mjs`, `grep -rn total <probes>`, `cp <probes>/a.sh /tmp/`, `echo x > <probes>/b.sh`, `git show HEAD:<probes>/a.sh` and `git log -p -- <probes>`
        - a `Bash` call that joins a call R4 lets through to one of the above: `git commit -m "x" && cat <probes>/a.sh`
        - a `Bash` call that hands a script naming `<probes>` to an interpreter as text: `python3 - <<'EOF'` … `EOF`, `node -e "…"` and `bash -c "…"`
        - a call to a tool the guard has no rule for, any of whose input text names `<probes>`
    - GIVEN a checking step's session in a container, and a person's session
      WHEN the guard judges the same calls
      THEN it allows them for the checking step, and asks the person, as R2 says
- **Falsified-by:** the same table test as R4, holding every call of the first clause, which goes red if any of them is let through.
- **Verification hint:** the hook payload's `tool_input` holds `file_path` for `Read`, `Write` and `Edit`, `notebook_path` for `NotebookEdit`, `pattern` and `path` for `Glob` and `Grep`, `command` for `Bash`, and `prompt` for `Agent`. The guard's comment in `src/daemon/probeGuard.ts` keeps the accepted gap that the PRD's Out of scope names, and should say R5's interpreter rule in the same place.

## R6 — A test runs the guard command as a container session runs it

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN the project's test suite
      WHEN it is run
      THEN it holds a test that starts the guard command itself, as the hook starts it, with a state file that holds no run, a hook payload on stdin, and an environment holding `TIMONE_RUN_PROJECT` and the container's step
      AND that test checks that a `Write` of `<probes>/prd-10.r1.mjs` is allowed for `verification`, and that a `Read` of it is refused for `execution`
    - GIVEN that test
      WHEN the guard command is changed for a moment to ignore the container's step
      THEN the test fails
- **Verification hint:** #87 asks for this test by name: *"it needs a test that runs the guard with no ledger entry, because that is the state every boxed session is in and no current test covers it."* It is the only test that also proves the command reads the step from its own process environment, which the unit tests of R2 do not.

## R7 — `timone stage` does not claim a step in a container

- **Priority:** SHOULD
- **Status:** draft
- **Verify-via:** api
- **Criteria:** In a container session, `timone stage verification` says that the container's step decides what the guard does, names that step, and does not say that the session is now the checking step. A person's session gets the same sentences as today.
- **Verification hint:** the sentence is built by `guardSays` in `src/commands/stage.ts`, which assumes a session run by hand.

## R8 — A real run in a container shows both directions

- **Priority:** SHOULD
- **Status:** draft
- **Verify-via:** live
- **Criteria:** On a supervised run of a ticket against the real daemon, the checking step in its container writes and runs its check scripts without being asked and without a refusal, and its transcript shows no question from the guard. On the same run, or another, the building step in its container is refused a read of a check script when it tries one, and it still names the folders in its prompts to helpers and in its commit messages without being refused.
- **Verification hint:** the next real check of any Timone ticket after the fix serves for the first half. For the second half, the build's transcript is searched for the guard's refusal sentence; a builder that never tries a read leaves this half unobserved, and the report says so.
