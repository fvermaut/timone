# PRD-08: A ticket the machine opens names the people it is for

> **Status:** Draft
> **Project:** timone — see [product-overview.md](../product-overview.md)
> **Criteria register:** [prd-08-a-ticket-the-machine-opens-names-its-people.criteria.md](prd-08-a-ticket-the-machine-opens-names-its-people.criteria.md)
> **Phases:** none yet

## Problem

The machine opens tickets under its own GitHub identity, `timone-agent[bot]` ([ADR-0042](../../adr/0042-timone-acts-under-its-own-identity.md)). GitHub sends a notification only to people who follow a ticket. Nobody follows a ticket the machine opened, so nobody hears about it: not when it opens, and not when the machine or anyone else comments on it later.

fvermaut asked for this on 4 October 2026 ([timone#207](https://github.com/fvermaut/timone/issues/207)): "Tickets created by the machine should add the operator as a watcher. Otherwise I don't get notifications on the ticket."

The machine opens tickets in three places today:

- When a person approves the list of pieces for a piece of work, code opens one ticket per piece (`src/daemon/chunk-zero.ts`, through `createStep` in `src/adapters/github-tickets.ts`).
- When the runner finds a fault in Timone, it files an issue on Timone's own repository (`fileTimoneIssue` in `src/runner/actions.ts`, through `createIssue`), as [PRD-05.R17](prd-05-a-runner-decides-each-step.criteria.md#r17--a-fault-in-timone-is-filed-not-fixed) says.
- A step session that charts a large piece of work opens a map ticket and one ticket per open decision itself, with `gh`, as the `timone-wayfind` instructions say.

GitHub has no way to add a watcher to a ticket for someone else. Two ways remain: name the person in the ticket's text, or assign the ticket to them. Being named subscribes a person to the ticket. The sorting step chose naming, and said so on the ticket on 4 October 2026. Assigning was ruled out: under [ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) an assigned ticket means a person holds it, and the machine would stop working on it.

## Goals

- The operator hears about every ticket the machine opens, and about every comment on it afterwards, without watching the whole repository. This serves the product's second goal: the operator's part is decisions and reviews, and the operator cannot decide anything on a ticket the operator never sees.
- Naming a person never changes what the machine does with the ticket.

## Scope

### In scope

**Who is named.** The people named for the project in `timone.yaml`: the project's `instructors` when it lists any, and otherwise the `operator` at the top of the file. These are the same people who may instruct the runner on that project (PRD-05.R10), and the code already reads them (`namedPeople` in `src/manifest.ts`). Today no project lists its own `instructors`, so every ticket names `fvermaut`.

**Where they are named.** In the text of the ticket, when it is opened, with `@` before each login.

- Each ticket opened for a piece of an approved list names the project's people (R1).
- Each issue the runner files on Timone's own repository names the people of the `timone` project, not the people of the project where the fault was seen (R2). A client's people are not told about Timone's own faults.
- The instructions for charting a large piece of work tell the session to name the project's people in every ticket it opens (R3).

**What does not change.** Nobody is assigned to a ticket because of this (R4). When the file names nobody for a project, the ticket still opens, with no name in it, and nothing fails (R5). The daemon already refuses to start in that case, so this is a guard and not a path that is used.

**That it works.** On a watched run, the operator gets a GitHub notification for a ticket the machine opened, and for a comment on it afterwards (R6).

### Out of scope

- **Tickets the machine opened before this change.** They are not edited. GitHub does not send a notification for a name added by editing a ticket, so editing them would not help.
- **Pull requests the machine opens.** The ticket asks about tickets. See the open question below.
- **Comments the machine posts on tickets that a person opened.** The person who opened a ticket already follows it.
- **A setting for who is named, apart from `instructors` and `operator`.** Nothing new is added to `timone.yaml`.
- **Naming a person on each comment.** Being named once, when the ticket opens, subscribes the person to every comment after it.

## Open Questions

- **Pull requests.** The machine opens pull requests under its own identity too. Whether fvermaut is notified of them today depends on the settings of that account, and the ticket does not say. Owner: fvermaut. If the same is wanted the same for pull requests, it is a new ticket.
- **A project with its own `instructors` that leave the operator out.** As written, the operator is not named on that project's tickets. No project is like this today. The question comes back when the first one is.
