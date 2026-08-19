# Timone

*Il timone* — the helm. Timone makes AI agents follow one written engineering process across independent projects, and inverts control: agents run the work, you steer through tickets, pull requests and preview deployments.

## How it works

- **One process, written down.** [process.md](process.md) defines every lifecycle stage, its artifact and its gate. Each stage is implemented by a skill under `.claude/skills/`.
- **Driven by tickets.** A daemon watches the managed projects' issue trackers, picks up tickets carrying the `timone` label, and walks them through the process. You never name a stage or a skill — write the ticket in plain language.
- **You are asked, never assumed.** A ticket waiting on you says so and says what to do about it: reply on the ticket, or run the `timone takeover` line it hands you. **Merging stays yours.**
- **Everything is traceable.** Every commit Timone makes ends with `Timone-Stage:`, `Timone-Session:` and, when a ticket drove it, `Timone-Run: <project>#<ticket>` — so auditing a repo is a `git log --grep` away.
- **Every state is written down.** [doc/daemon-state-machine.md](doc/daemon-state-machine.md) draws what the daemon does: the states a piece of work can be in, the moves between them, and what makes it move.
- **Client repos receive only process artifacts** (`doc/…`, `CONTEXT.md`). Harness files never leave this repository.

Sessions always run at the timone repo root, never inside a managed project ([ADR-0007](doc/adr/0007-sessions-at-timone-root.md)).

## Getting started

```bash
npm install
npm run build
npm link                            # required — the CTAs Timone writes call `timone`

cp timone.example.yaml timone.yaml  # declare your projects
timone workspace sync               # clone them under projects/ (gitignored)
timone projects list
```

`npm link` is not optional: every instruction Timone writes on a ticket names the bare `timone` command, and without the link none of them can be followed.

## Everyday commands

```bash
timone daemon                    # watch the tickets and run what is marked
timone status                    # what each project is working, and what waits on you
timone takeover <project>#<n>    # pick up a ticket that wants a conversation
timone retry <project>#<n>       # re-arm a failed run at the stage where it stopped
timone cancel <project>#<n>      # stop a ticket's work for good
timone projects add|update <name> --repo <url> …   # register or correct a project
```

Only one daemon works at a time; a second one exits saying who holds the lock. Restart the daemon after pulling — a running process keeps executing the code it started with.

## The stages

Name one yourself when you want to (`/timone-<stage> <project> …`); otherwise the daemon routes for you.

| # | Skill | What it does |
|---|-------|--------------|
| 0 | `timone-onboard` | register, clone, doc tree, overview, founding ADRs |
| 1 | `timone-triage` | classify a request and route it |
| 2 | `timone-grill` / `timone-wayfind` | requirements interview — one sitting, or a map of questions |
| 3 | `timone-prd` | persist the PRD pair (narrative + criteria register) |
| 4 | `timone-adr` | record an architecture decision |
| 5 | `timone-plan` | cut work into thin vertical slices |
| 6 | `timone-execute` | build the phase, TDD, slice by slice |
| 7 | `timone-verify` | check observable behaviour against the criteria |
| 8 | `timone-deliver` | two-axis review, then open the pull request |
| 9 | `timone-improve` | triage feedback, amend or correct, dispatch the rest |

Plus two cross-cutting utilities: `timone-prototype` (something clickable to react to) and `timone-handover` (resume in a fresh session).

## Where things live

| Path | |
|------|--|
| [process.md](process.md) | the normative process definition |
| [STATUS.md](STATUS.md) | plain-language state of the project, no process knowledge assumed |
| [doc/specs/](doc/specs/) | product overview and the PRDs (PRD-01 process layer, PRD-02 inversion of control) |
| [doc/adr/](doc/adr/) | architecture decision records |
| [doc/plans/phases/](doc/plans/phases/) | phase plans and their reports |
| [standards/](standards/README.md) | mandatory baseline (accessibility, UI/UX) + per-stack entries |
| [.claude/skills/](.claude/skills/README.md) | the stage skills |
| `src/` | the Timone CLI (TypeScript) |

`npm test` runs the suite.
