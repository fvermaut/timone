# PRD-10: The probe guard knows the step in a container, and judges only real reads and writes

> **Status:** Active
> **Approved by:** fvermaut, 2026-10-07T06:38:36Z
> **Project:** timone — see [product-overview.md](../product-overview.md)
> **Criteria register:** [prd-10-the-probe-guard-knows-the-step-in-a-container.criteria.md](prd-10-the-probe-guard-knows-the-step-in-a-container.criteria.md)
> **Phases:** none yet

## Problem

Timone keeps its check scripts in two folders: a `probes/` folder in the project's `doc/plans/phases/`, and a shared `probes/` folder in Timone's `standards/baseline/`. The two are listed in `PROBE_DIRECTORIES` in `src/daemon/probeGuard.ts`. Only the checking step may write them, and the builder may not read them, because a builder that reads the checks writes code to pass them ([ADR-0048](../../adr/0048-a-verification-probe-is-kept-proved-able-to-fail-and-hidden-from-the-builder.md) D4). A hook enforces this on every tool call: it refuses a builder, lets the checking step through, and asks a person in every other case.

The hook learns the step from the ledger, `.timone/state.json`. That file is on the host. A run in a container has its own empty `.timone/`, so inside a container the hook never knows the step. [timone#87](https://github.com/fvermaut/timone/issues/87) records what follows. The checking step of `timone#39`, in a container, was asked for permission to write its own check scripts, and there was nobody to answer. Worse, the building step in a container is not refused either: it is asked, like everything else. Every run has happened in a container since phase 30, so the rule of ADR-0048 D4 has not worked in either direction since then.

A second fault is in how the hook decides that a call concerns the folders. It refuses any call where any piece of text names a folder. [timone#192](https://github.com/fvermaut/timone/issues/192) records three calls refused during a build on 2026-10-02: a prompt that told a helper *not* to open the folders, a command that edited the phase file and whose text named the shared folder, and the commit message that followed. The build instructions require that prompt. So the rule and the hook contradict each other, and the only way round was to build the path from two halves in a script. Once the first fault is fixed, the hook will refuse every such call in a container too. fvermaut asked on 2026-10-07 to fix both together and to close #192 with #87.

Both faults showed again while this document was written. The session that wrote it ran in a container. Its first attempt to save this file was stopped by the hook, because the text named the two folders in full. The hook asked for permission, nobody could answer, and the write did not happen. This file names the folders in parts for that reason, and the register uses a short name for them.

Source: the two tickets, the conversation on #87, and the code of `src/commands/guardrails.ts`, `src/daemon/probeGuard.ts`, `src/daemon/declared-stage.ts` and `src/daemon/container-runtime.ts`. No interview was held: the two tickets say what is wanted.

## Goals

- In a container, the rule of ADR-0048 D4 holds as it does on the host: the builder cannot read the check scripts, and the checking step works on them without stopping.
- A run in a container never waits for an answer that nobody can give.
- The hook stops a real read or write of a check script, and nothing else. The builder can be told about the folders in plain words, as the build instructions require, without being refused.

These serve the product's goal that a run finishes unattended and that its checks are independent of its build.

## Scope

### In scope

**The container knows its step.** Every session Timone starts in a container carries the name of its step in its environment, next to the other facts about its run, and it is the same step the ledger records (R1). A project's own environment file cannot set it.

**The hook uses that step.** When the ledger has no run for the session, the hook takes the step from the container (R2). So in a container the checking step may write and read its check scripts without being asked, and a building step is refused them, as on the host. Inside a container a declaration made with `timone stage` changes nothing, so a builder cannot declare itself the checker. The ledger still wins wherever it has a run for the session. A person's own session on the host behaves as today.

**In a container the hook never asks** (R3). Nobody is there to answer. A step that neither builds nor checks, and a container that names no step or a step Timone does not know, is refused a real read or write of the check scripts, with a sentence that says why.

**Text that only names a folder is not judged** (R4). This holds in every session: a builder's, a checker's, and a person's. A prompt to a helper, a commit message, the text of a ticket comment or a pull request, the text written into another file, and a search for the folder's name in other files all pass without a word from the hook.

**A real read, list, run or write of a check script is still judged** (R5). That covers the file tools when their target is in a folder, and shell commands that read, list, copy, run or write a file there, also when such a command is joined to one that only names the folder. A script handed to `python`, `node` or a shell as text is judged by all of its text, as today, because the hook cannot tell what it will do.

**A test runs the hook as a container session runs it** (R6): the hook command itself, with an empty ledger and the container's environment, for a checking step and for a building step. This is the state every session in a container is in, and no test covers it today.

**`timone stage` says the truth in a container** (R7). It does not say that the session is now the checking step when the container's step decides.

**One supervised run shows it** (R8): a real checking step in a container writes its check scripts without being asked, and a real building step in a container is refused them.

No screen of a product changes here. Everything happens in hooks and in the container's set-up, so this PRD carries no accessibility criteria.

### Out of scope

- **A command that reaches a folder in more than one move**: changing into `doc/plans/phases` and then reading `probes/x`, a path kept in a variable, a path built from pieces, or a pattern with a wildcard in place of part of the path. The hook does not follow the shell's current folder or expand its variables. This gap is known and stays accepted, as the hook's own comment says: the hook stops the accident and the idle look, not a builder working to get around a refusal it has been told about.
- **A search that reads the whole project**, such as `grep -r total .` from the project's root. It reads the check scripts with everything else, and it is not caught today either.
- **A helper started inside a session.** It is judged as the step of the session that started it, on the host and in a container alike. The fix step that the update hands a failure to stays kept out by its instructions, as [ADR-0066](../../adr/0066-the-update-is-a-step-the-runner-starts-when-an-open-pull-request-falls-behind.md) D4 says.
- **A `timone takeover` session.** It runs on the person's own machine, not in a container, and a person is there to answer.
- **Moving the check scripts somewhere the builder's container cannot see.** ADR-0048 already rejected that: every container clones both repositories.
- **The link to `ivtrends#22`** in `standards/baseline/ui-ux.md`, which answers 404 to anyone not signed in. #87 notes it so it is not found again, and asks for no change.

## Open Questions

The tickets settle what is wanted. Three points they do not name are written here as the plainest reading of them. Any of them can be changed when the requirements are approved.

- **In a container, a step that neither builds nor checks is refused the check scripts** (R3). The tickets say only that asking is wrong where nobody can answer. Refusing is the choice that cannot leak a check to a builder. No step but the checking step and the update uses the check scripts today, so no step loses anything it needs.
- **A script handed to an interpreter as text is still judged by all of its text** (R5). The hook cannot tell a script that edits the phase file from one that reads a check script. To write text that names a folder into another file, a step uses the file tools, or a shell command that writes the text straight into the file (R4). That second way is how #192's middle case passes.
- **A tool the hook has no rule for is still judged by every piece of text in its input**, as today (R5). A new tool is then covered the day it appears, at the cost of the occasional question or refusal that #192 describes, until a rule is written for it.
