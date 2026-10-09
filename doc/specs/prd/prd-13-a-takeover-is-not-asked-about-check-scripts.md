# PRD-13: A takeover is not asked about check scripts

> **Status:** Active (approved by fvermaut on 2026-10-09T08:59:28Z)
> **Project:** timone — see [product-overview.md](../product-overview.md)
> **Criteria register:** [prd-13-a-takeover-is-not-asked-about-check-scripts.criteria.md](prd-13-a-takeover-is-not-asked-about-check-scripts.criteria.md)
> **Phases:** none yet

## Problem

Timone keeps its check scripts in two folders, listed in `PROBE_DIRECTORIES` in `src/daemon/probeGuard.ts`. A hook, the probe guard, judges every tool call that reads or writes them ([PRD-10](prd-10-the-probe-guard-knows-the-step-in-a-container.md)). It refuses a building step, allows a checking step, refuses everything else in a container, and **asks** in every other case. A session it cannot place is judged as a person's own session, and a person's own session is asked.

`timone takeover` opens a session in the person's terminal (`openSession` in `src/commands/takeover.ts`). It starts Claude without telling the guard anything. The ledger has no run for that session, the session is not in a container, and nothing declares a step. So the guard asks on every call that touches a check script. [timone#239](https://github.com/fvermaut/timone/issues/239) shows one: a takeover listed the file names in the project's check-script folder with `git ls-tree`, and the guard stopped it with *"Allow only if you are not building."* fvermaut reports that this happens constantly in takeovers.

A takeover is never a building step. Its instructions tell it not to write application code (`takeoverPrompt` in `src/daemon/prompts.ts`). Asking a person "are you building?" in a session that is told never to build is a question with one answer. fvermaut was asked on the ticket whether a takeover should read and change check scripts without being asked, and answered on 2026-10-09: *"yes, because takeover needs to also resolve merge conflicts."* A takeover is where a person ends up when a merge stops on a check script that both sides changed, as on [timone#234](https://github.com/fvermaut/timone/issues/234).

Source: the ticket and its thread, and the code of `src/commands/takeover.ts`, `src/commands/guardrails.ts`, `src/daemon/probeGuard.ts` and `src/daemon/prompts.ts`. No interview was held beyond the questions on the ticket.

**Why a new PRD and not a change to PRD-10.** PRD-10 is approved, and it names the takeover in its own out-of-scope list, because a person is there to answer. That is still true; what changed is that the question is useless. A new PRD leaves the record of what PRD-10 approved as it was, and adds the one case it left out. Every requirement of PRD-10 stays true.

## Goals

- A takeover works on check scripts, reading them and changing them, without the guard stopping it to ask.
- A takeover can resolve a merge conflict in a check script.
- Nothing about building changes: a building step is refused the check scripts exactly as today, on the host and in a container.
- A session the guard cannot place, and that is not a takeover, is still asked.

These serve the product's goal that a person's time goes to decisions, not to answering the same question again and again.

## Scope

### In scope

**A takeover session is marked as one** (R1). When `timone takeover` starts Claude, the session carries a mark in its environment that says it is a takeover, and of which ticket. The guard reads it from the hook's own environment, as it already reads a container's step. A project's environment file cannot set the mark.

**In a takeover, the guard allows reads and writes of check scripts** (R2). Every call the guard judges as a real read, list, run or write of a check script is allowed, with a short reason that says it is a takeover. It is never asked. This holds whatever step the ticket's run was parked on, because the takeover session is not that step. The command from the ticket, a `git ls-tree` of the folder, is one of the cases.

**In a takeover, a merge conflict in a check script can be resolved** (R3). The calls that resolve one are allowed: reading both versions, editing the file to remove the conflict, taking one side, and staging the result.

**Building steps are refused exactly as today** (R4). The mark changes nothing for a session that the ledger places as a building step, nor for any session in a container, where the container's step decides as PRD-10 says. A takeover that declares itself a building step with `timone stage` is refused.

**A session that is neither placed nor a takeover is still asked** (R5). A person's own Claude session, started without `timone takeover`, gets the question it gets today.

**A test runs the guard command as a takeover runs it** (R6): the hook command itself, with an empty ledger and the takeover's environment.

**`timone stage` says the truth in a takeover** (R7). It does not tell the person that they must declare the checking step to be let through.

**One real takeover shows it** (R8): a takeover lists and reads a check script and no question from the guard appears.

No screen of a product changes here. Everything happens in a terminal command and in a hook, so this PRD carries no accessibility criteria.

### Out of scope

- **Claude Code's own questions in a takeover**: asking before each edit and each command. The takeover keeps starting Claude in its normal mode. fvermaut's example was the guard's question, not these.
- **The update step and a merge conflict in a check script** ([timone#234](https://github.com/fvermaut/timone/issues/234)). That step runs in a container and stays kept out of check scripts as PRD-10 says. R3 is about a person resolving such a conflict in a takeover, not about the update step doing it.
- **[timone#174](https://github.com/fvermaut/timone/issues/174)**: `timone stage` writes its declaration where it is run from, so the guard may not see it. It is related, because declaring a step is today's only way past the question, but it is a separate fault and stays open on its own.
- **[timone#192](https://github.com/fvermaut/timone/issues/192)**: the guard judged text that only names the folders. PRD-10 R4 covers it.
- **Keeping a takeover from building.** The guard trusts the takeover's instructions, which forbid application code. It does not check what a takeover writes. A takeover that built code anyway would see the check scripts; that is accepted, as fvermaut accepted it on the ticket.
- **Any change to containers.** A session in a container is judged exactly as PRD-10 says, with or without the mark.

## Open Questions

The ticket settles what is wanted. Three points it does not name are written here as the plainest reading. Any of them can be changed when the requirements are approved.

- **A takeover that declares a building step with `timone stage` is refused** (R4). The declaration says the session builds, and a building session is refused. Any other declaration in a takeover changes nothing: it is still allowed.
- **A helper started inside a takeover is judged as the takeover.** It runs with the takeover's environment, so it carries the mark. PRD-10 already judges a helper as the session that started it.
- **A person who sets the mark by hand in their own session is treated as a takeover.** The mark is not a lock against the person whose machine it is. It keeps a builder out, and no builder runs on the host since every run moved into a container. A container ignores the mark (R4).
