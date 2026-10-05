# PRD-09: A question names the command that answers it in a terminal

> **Status:** Active (approved by fvermaut on 2026-10-05T13:40:31Z)
> **Project:** timone — see [product-overview.md](../product-overview.md)
> **Criteria register:** [prd-09-a-question-names-the-command-that-answers-it-in-a-terminal.criteria.md](prd-09-a-question-names-the-command-that-answers-it-in-a-terminal.criteria.md)
> **Phases:** none yet

## Problem

On [ivtrends#158](https://github.com/fvermaut/ivtrends/issues/158) the machine asked fvermaut something on the ticket. He would have liked to answer it in his terminal. The message did not suggest that, and it did not give him the command to type. He filed [timone#213](https://github.com/fvermaut/timone/issues/213): *"I would have expected the machine to suggest a takeover right away, and also give the command that I can copy/paste."*

No written rule asks for this today. A person can always answer in writing on the ticket, and `timone takeover <project>#<n>` opens a session on the ticket in their terminal. But nothing tells the machine to offer the second way when it asks something. A few rules go the other way on purpose, for questions where a terminal session does not help.

There is also a timing problem. A question is often posted by a step that is still ending. While a step runs, `timone takeover` refuses and says the machine is working on the ticket ([PRD-05.R11](prd-05-a-runner-decides-each-step.criteria.md#r11--takeover-and-cancel-stay-and-retry-goes)). So a person who copies the command from a question the moment it appears can be refused. The written process says that no message may name a command the machine would refuse ([process.md](../../../process.md), the paragraph that starts *"Every command a ticket names can be run while the daemon is running"*).

Source: the conversation on [timone#213](https://github.com/fvermaut/timone/issues/213). The machine asked three questions on 2026-10-04, each with a suggested answer, and fvermaut answered "yes to all" on 2026-10-05.

## Goals

- A person who is asked something can answer it in their terminal by copying one command from the message. This serves the product's goal that the operator's part is decisions and reviews only, made where it suits them.
- The command never sends a person somewhere that cannot help them. This goal outranks the one above: where the terminal cannot settle the question, the command is left out.
- A command copied from a question is never refused because the step that asked is still ending.

## Scope

### In scope

Every question the machine asks a person names the takeover command, on a ticket or on a pull request (R1). A question is a message whose last line, *What I need from you:*, asks the person for something. This covers what the runner posts, what a step posts, the messages code writes itself, such as the one about the spending limit, and a pull request's description when it carries a question from the build. The message says the person can answer either way: in writing on the ticket, or by running the command.

The command is written out in full, with the project's real name and the ticket's real number, as code that can be copied and run without changing anything (R2). Adding it does not stop the machine from reading what the message asks.

Three kinds of question leave the command out on purpose (R3):

- a request to add a missing key or secret, because a terminal session cannot add it;
- the short question that asks whether a misspelled "approve" meant approve, because one word answers it ([PRD-04.R1](prd-04-one-short-question-instead-of-a-terminal.criteria.md#r1--a-reply-that-is-neither-an-approval-nor-a-change-request-is-met-with-one-short-question));
- a question that follows a terminal session on the same ticket that ended without settling it, because the same command will not help ([PRD-05.R18](prd-05-a-runner-decides-each-step.criteria.md#r18--the-runner-passes-a-replay-of-the-recorded-failures), case #120).

A takeover typed while a step of that ticket is still running no longer refuses. It says at the terminal which step it waits for, waits for that step to end, and then opens the session before the runner starts anything else on the ticket. The person can stop waiting at any time, and then nothing has changed (R4). This replaces the refusal kept in PRD-05.R11.

The written rules say the same thing as the machine does: `process.md`, the runner's instructions and the step skills (R5). They change with the build, so that they never describe something that does not exist yet.

No screen of a product changes here. The messages are read on GitHub and the waiting is shown in a terminal, so this PRD carries no accessibility criteria.

### Out of scope

- **The request to review and merge a pull request.** It asks for a review, not an answer, and the person merges on the pull request. A question carried to the pull request is in scope.
- **Messages that ask for nothing.** A message whose last line says "nothing" does not need the command.
- **What a takeover session does once it is open.** That stays as PRD-05.R11 and `process.md` describe it.
- **Questions asked inside a terminal session.** The person is already in their terminal.
- **The bodies of decision tickets on a map.** Their own rule already offers the takeover where it helps ([process.md](../../../process.md), the paragraph on wayfinding), and nothing changes there.
- **A chat channel**, such as Slack. The ticket and the terminal stay the two ways to answer.

## Open Questions

The conversation settled the three questions it asked. Two points it did not name are written here as the plainest reading of fvermaut's answers. Either can be changed when the requirements are approved.

- **A takeover waits for any running step of the ticket, not only one that has just asked a question** (R4). The command cannot tell a step that is about to ask from one that is not, and one rule is easier to explain than two. Waiting through a long build is possible; the terminal says what it waits for, and the person can stop waiting.
- **A request to review and merge a pull request is not a question** (Out of scope). Questions carried to the pull request from the build are.
