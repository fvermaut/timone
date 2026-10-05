# Timone

*Il timone* — the helm. Timone makes AI agents follow one written engineering process across independent projects, and inverts control: agents run the work, you steer through tickets, pull requests and preview deployments.

## How it works

- **One process, written down.** [process.md](process.md) defines every lifecycle stage, its artifact and its gate. Each stage is implemented by a skill under `.claude/skills/`.
- **Driven by tickets.** A daemon watches the managed projects' issue trackers and picks up tickets carrying the `timone` label. For each ticket, **the runner decides each step**. The runner is an agent: it reads the ticket and the work so far, and chooses what happens next. The order in [process.md](process.md) is its default. You never name a stage or a skill — write the ticket in plain language.
- **You are asked, never assumed.** The newest comment on a ticket says what it needs from you. Answer on the ticket in plain words, or open a terminal session on it with `timone takeover`. **Merging stays yours:** the machine never merges a pull request, and nothing reaches a default branch without your yes.
- **Everything is traceable.** Every commit Timone makes ends with `Timone-Stage:`, `Timone-Session:` and, when a ticket drove it, `Timone-Run: <project>#<ticket>` — so auditing a repo is a `git log --grep` away.
- **Every state is written down.** [manual/how-the-daemon-works.md](manual/how-the-daemon-works.md) says what the daemon does in one cycle, how the runner moves a run, what a run waits for, and what code keeps whatever the runner decides.
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

### Give the daemon a lasting login

The daemon runs each ticket in a container, and a container cannot log in by itself. It is handed a token when it starts, and it keeps that token for the whole run.

**Set this up once.** Without it the daemon borrows your own Claude login, which lives about six hours counted from when you last used the CLI — not from when a run starts. A run that outlives it is refused partway and loses everything it has done since its last push.

```bash
claude setup-token                  # prints a long-lived token; copy it

# keep it in the keychain, not in a file. `-w` last means it prompts,
# so the token never reaches your shell history or a `ps` listing.
security add-generic-password -a "$USER" -s timone-model-token -U -w
```

Then add this to `~/.zshrc`, so every terminal — and every daemon started from one — has it:

```bash
export CLAUDE_CODE_OAUTH_TOKEN="$(security find-generic-password -s timone-model-token -w 2>/dev/null)"
```

Open a new terminal and start the daemon. **It says which login it has, every time:**

```
Model login: a lasting token, from this daemon's environment. Runs of any length are covered.
```

If it says *borrowed from this machine's Claude login* instead, the variable did not reach it — check that the terminal you started the daemon from is a new one. The first read from the keychain asks for permission; choose "Always Allow" so an unattended daemon is never blocked on it.

**Check it again whenever runs start failing on login.** That line is the fastest way to tell a missing variable from an expired token, and a missing variable is much the more likely of the two: a token lives a long time, an exported variable lasts until the next new terminal.

## Everyday commands

```bash
timone daemon                    # watch the tickets and run what is marked
timone status                    # what each project is working, and what waits on you
timone takeover <project>#<n>    # work on a ticket in this terminal, then give it back to the runner
timone cancel <project>#<n>      # stop a ticket's work for good
timone projects add|update <name> --repo <url> …   # register or correct a project
```

Only one daemon works at a time; a second one exits saying who holds the lock. Restart the daemon after pulling — a running process keeps executing the code it started with. The daemon reads `timone.yaml` only when it starts, so a change to that file needs a restart too.

Two credentials keep a boxed run alive, and neither is yours to manage after setup. The model login comes from the token above. The GitHub token is minted per run, scoped to the one repository, and refreshed into the running container every twenty minutes — a minted token dies after an hour and runs last longer than that. [manual/how-the-daemon-works.md](manual/how-the-daemon-works.md) has both in full.

## The runner

Every project is driven by the runner. The runner is an agent. Each time something happens on a run, it reads the ticket and the work so far, and chooses what to do next. The order in [process.md](process.md) is its default. It may leave that order when it has a reason. Each time it does, it says so on the ticket, with the reason, and the pull request lists each change to the order in its first lines. It never merges a pull request. The decision is [ADR-0060](doc/adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md).

There is nothing to switch on, and there is no `driver` line to set. A manifest that still has one does not load: the error names the project and says to delete the line.

```yaml
operator: your-login           # may instruct the runner on every project
projects:
  scratch-app:
    # … repo_url, path, stack, bindings, as before
    instructors: [your-login]  # optional: these people instead of the operator
    ticket_limit_usd: 150      # optional: what one ticket may spend, in dollars
    places: 3                  # optional: how many tickets build at once; 2 when missing
```

**Who may instruct it.** The people in `instructors` on the project, or the `operator` when the project names nobody. `instructors` replaces the operator, so list the operator there too if they should still instruct it. The runner sees only these people's comments; anyone else's are left out. The daemon does not start while a project names nobody — no `instructors` and no `operator` — and it says which project, and what to add. `timone projects list` and `timone workspace sync` still read such a manifest.

**How you talk to it.** Write in plain words on the ticket or the pull request. Each comment by a person who may instruct it wakes the runner. `timone takeover` opens a terminal session on a ticket nothing is working on right now; when the session ends, the runner reads what it left. `timone cancel` stops the run and any step still running, and puts the `timone:held` label on the ticket so it is not started again. It also works when no daemon is running. The retry command was removed: typed, it says to write on the ticket instead.

**The limit.** One ticket may spend $150 across all its runs, the runner's own sessions included. `ticket_limit_usd` on the project changes it. At the limit, no new session starts, and the ticket says what was spent and where the work stands. Reply "continue", or any words that mean it, to allow the same amount again. Only a reply from a person who may instruct the runner counts.

**How many tickets build at once.** `places` on the project is a whole number, 1 or more. It is how many of the project's tickets may have a step running at the same time. When the line is missing, the project has 2. A running step takes a place, whatever the step is: a plan, a build, a check, or an update of a pull request. A place given to a waiting ticket and not yet used counts as taken. Nothing else takes one: not a ticket waiting for a person, for a merge or for its turn, not a ticket with only an open pull request, not a runner session, and not a `timone takeover` terminal. A freed place goes to a ticket labelled `priority:high` first, then to the ticket opened first. Before a ticket's build starts, another agent, the planner, decides whether it may build now. It is asked only before the build. The planner takes no place. It holds the ticket back when another ticket that is building, or that has an open pull request, changes most of the same files. It also holds it back when it needs another ticket's work that is not merged. The ticket then gets a comment that names the ticket it waits for and gives the reason. It is decided again when that ticket's pull request merges or closes, and its plan is not rewritten. A named person can write on the ticket, in plain words, that it should build now: someone in the project's `instructors`, or the `operator` when the project lists no `instructors`. The ticket is then built when a place is free, and the machine says so on the ticket. Anyone else's comment changes nothing. The daemon reads `timone.yaml` only when it starts, so a change to it needs a restart. The requirements are [PRD-07](doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.md); the decision is [ADR-0065](doc/adr/0065-the-planner-is-a-session-of-its-own-asked-when-a-build-would-start.md).

**What it did.** The machine writes down each step, each decision of the runner with its reason, and what each session cost. `timone record` shows it. The replay checks the runner itself.

```bash
timone record <project>#<n>    # each step with its times and cost, each decision with its reason,
                               # the steps left out, and the spending against the limit
npm run replay                 # check the runner against nineteen recorded failures
npm run replay -- --dry        # the same cases with a script in place of the model; costs nothing
```

The real replay calls the model, so it costs money and needs a terminal where you are logged in to Claude.

## The stages

Name one yourself when you want to (`/timone-<stage> <project> …`); otherwise the runner decides each step for you.

| # | Skill | What it does |
|---|-------|--------------|
| 0 | `timone-onboard` | register, clone, doc tree, overview, founding ADRs |
| 1 | `timone-triage` | read the project's documents, classify a request and route it |
| 2 | `timone-grill` / `timone-wayfind` | requirements interview — one sitting, or a map of questions |
| 3 | `timone-prd` | persist the PRD pair (narrative + criteria register) |
| 4 | `timone-adr` | record an architecture decision |
| 5 | `timone-plan` | cut work into thin vertical slices |
| 6 | `timone-execute` | build the phase, TDD, slice by slice |
| 7 | `timone-verify` | check observable behaviour against the criteria |
| 8 | `timone-deliver` | two-axis review, then open the pull request |

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
