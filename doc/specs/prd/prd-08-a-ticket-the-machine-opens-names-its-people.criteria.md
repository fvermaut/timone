# PRD-08 Acceptance Criteria — A ticket the machine opens names the people it is for

> Formal register for [prd-08-a-ticket-the-machine-opens-names-its-people.md](prd-08-a-ticket-the-machine-opens-names-its-people.md).
> Maintained by: timone-prd (creation), timone-verify (status),
> timone-prd (revisions). Requirement IDs are stable — never renumber.
>
> Words used here: the **people of a project** are the logins `namedPeople` in `src/manifest.ts` returns for it: the project's `instructors` in `timone.yaml` when it lists any, and otherwise the `operator`. To **name** a person is to write their login with `@` before it, for example `@fvermaut`, in the text of a ticket.
>
> No requirement here puts anything on a screen that Timone draws, so no accessibility criteria apply.

## R1 — A ticket opened for a piece names the project's people

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Falsified-by:** a test that runs the opening of step tickets on a fake tracker for a project whose people are `alice` and `bob`, and fails if any ticket it opens has a body without `@alice` or without `@bob`
- **Depends-on:** `src/daemon/chunk-zero.ts, src/adapters/, src/manifest.ts`
- **Criteria:**
    - GIVEN a project whose entry in `timone.yaml` lists no `instructors`, and `operator: fvermaut` at the top of the file
      WHEN a named person approves a list of three pieces and the machine opens the three tickets
      THEN the body of each of the three tickets contains `@fvermaut`
    - GIVEN a project whose entry lists `instructors: [alice, bob]`
      WHEN the machine opens a ticket for one of its pieces
      THEN the body contains `@alice` and `@bob`
    - GIVEN a ticket for a piece that already exists, so that a second run of the opening finds it by its title
      WHEN the opening runs again
      THEN that ticket is not opened again and its body is not changed
- **Verification hint:** drive the opening in `src/daemon/chunk-zero.ts` with the stub tracker in `src/adapters/ticketing.stubs.ts` and read the `body` passed to `createStep`. The exact words around the names are the build's choice.

## R2 — An issue the runner files on Timone names the people of the `timone` project

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Falsified-by:** a test that calls the runner's action that files a Timone issue, with a body that names nobody, and fails if the body sent to the tracker lacks the people of the `timone` project
- **Depends-on:** `src/runner/actions.ts, src/adapters/, src/manifest.ts`
- **Criteria:**
    - GIVEN `operator: fvermaut`, and a `timone` project that lists no `instructors`
      WHEN the runner files a Timone issue with a body that names nobody
      THEN the body of the issue opened on the Timone repository contains `@fvermaut`
      AND the name is added by code, whatever words the runner wrote
    - GIVEN a run on a client project whose entry lists `instructors: [client-person]`
      WHEN the runner files a Timone issue about a fault it saw on that run
      THEN the body names the people of the `timone` project
      AND it does not contain `@client-person`
- **Verification hint:** `fileTimoneIssue` in `src/runner/actions.ts` calls `createIssue` with the runner's `title` and `body`. Call the action with a fake adapter and read the body it received.

## R3 — The instructions for charting a large piece of work name the project's people on every ticket

- **Priority:** SHOULD
- **Status:** draft
- **Verify-via:** api
- **Criteria:** the instructions in `.claude/skills/timone-wayfind/SKILL.md` tell the session to name the people of the project in the body of every ticket it opens: the map ticket and each decision ticket. They say where the session finds those people (`timone.yaml`, `instructors` or else `operator`). A session that opens tickets by its own `gh` command cannot be checked by code each time, so this requirement is about the instructions, and it is a SHOULD.
- **Verification hint:** read the skill. The places that create the map and the decision tickets each say to name the project's people.

## R4 — Nobody is assigned to a ticket because of this

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Falsified-by:** a test that records every call each path of R1 and R2 makes to the tracker, and fails if any of them sets an assignee
- **Depends-on:** `src/daemon/chunk-zero.ts, src/runner/actions.ts, src/adapters/`
- **Criteria:**
    - GIVEN either path of R1 and R2
      WHEN it opens a ticket
      THEN the ticket has no assignee
      AND the `gh` command that opens it carries no `--assignee`
    - GIVEN a ticket for a piece that names `@fvermaut` in its body, and is open, not blocked and has no assignee
      WHEN the machine looks for the next piece to start
      THEN that ticket can be chosen, as it could before this change
- **Verification hint:** [ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) makes an assignee mean that a person holds a ticket. Read the arguments of `createStep` and `createIssue` in `src/adapters/github-tickets.ts`. For the second clause, the frontier reads assignees and labels, not body text.

## R5 — When the file names nobody, the ticket still opens

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN a project for which `namedPeople` returns an empty list
      WHEN either path of R1 and R2 opens a ticket
      THEN the ticket opens as it would have before this change
      AND its body contains no `@`-name added by code, and no empty name such as a lone `@`
- **Verification hint:** the daemon refuses to start when a project names nobody (`nobodyInstructs` in `src/commands/daemon.ts`), so this is reached only in tests or by code that builds the actions without that check. Call each path directly with a manifest that has no `operator` and no `instructors`.

## R6 — The operator is notified of a ticket the machine opened

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** live
- **Criteria:**
    - GIVEN fvermaut does not watch the repository, and the daemon runs as `timone-agent[bot]`
      WHEN the machine opens a ticket for a piece on scratch-app
      THEN fvermaut's GitHub notifications show that ticket
    - GIVEN that same ticket
      WHEN a comment is posted on it later, by the machine or by another person
      THEN fvermaut's GitHub notifications show the comment
- **Verification hint:** on scratch-app, never on ivtrends. Before the run, check that fvermaut's watch setting for `fvermaut/scratch-app` is "Participating and @mentions". `gh api notifications` read with fvermaut's own login shows both. A ticket filed with the runner's Timone action can stand in for a piece ticket if no list of pieces is approved during the run.
