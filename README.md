# Timone

*Il timone* — the helm. A meta-project for agentic software development: Timone owns the agent harness and enforces one written engineering process across independent projects, inverting control so agents run the show and humans steer through tickets, pull requests, and preview deployments.

## Layout

- `process.md` — **the process**: the single written definition of every lifecycle stage, its artifact, gate, and owning skill
- `doc/specs/product-overview.md` — why Timone exists, goals in priority order, MVP success definition
- `doc/specs/prd/` — requirements: PRD-01 (the process layer — a skill per lifecycle stage) and PRD-02 (inversion of control — the daemon-driven loop)
- `doc/adr/` — architecture decision records (founding decisions: 0001–0007)
- `doc/plans/phases/` — executable phase plans and their reports
- `.claude/skills/` — the stage skills (`timone-onboard`, `timone-grill`, `timone-prd`, `timone-adr`, …, `timone-improve`) — see [.claude/skills/README.md](.claude/skills/README.md) for authoring conventions
- `doc/feedback/` — stage 9's intake records, one per body of feedback: the per-item diagnosis, the human's decision, and what each item was dispatched to
- `standards/` — central standards library in three tiers: a mandatory baseline (accessibility, UI/UX), per-stack entries, and review references applied by stage 8 (the code-smell list) — agent-drafted from primary sources and human-approved
- `src/` — the Timone CLI (TypeScript, commander)
- `projects/` *(gitignored)* — managed project repos, declared in `timone.yaml` and materialized by the CLI

## Working with Timone

Sessions run at the timone repo root — never inside a managed project ([ADR-0007](doc/adr/0007-sessions-at-timone-root.md)). Bring a new repo under management first; every other stage skill then takes that project as its target — name it in your prompt, or the skill asks. From the root:

```
/timone-onboard <project-name> <repo-url>                  # stage 0 — register, clone, doc tree, overview, founding ADRs, standards
/timone-triage <project-name> <request | issue-ref>         # stage 1 — classify a request, record it, route it
/timone-grill <project-name> <topic or idea to grill>       # stage 2 — requirements interview
/timone-prd <project-name>                                  # stage 3 — persist the PRD pair
/timone-adr <project-name> <decision to record>              # stage 4 — architecture decision record
/timone-plan <project-name> <prd-ref | req IDs | work>       # stage 5 — cut a phase into vertical slices
/timone-execute <project-name> <phase-NN>                    # stage 6 — execute an approved phase, TDD, slice by slice
/timone-verify <project-name> <phase-NN>                     # stage 7 — check a completed phase against the criteria register
/timone-deliver <project-name> <phase-NN>                    # stage 8 — two-axis review, then open the pull request
/timone-improve <project-name> <feedback | review findings>  # stage 9 — triage feedback, amend or correct, dispatch the rest
```

Stage 9 closes the loop rather than ending it: it diagnoses each item's **layer** (intent change / implementation gap / the record is wrong), classifies the remediation into one of seven vehicles, stops at a human confirmation gate, and then dispatches — amending the PRD or correcting a process artifact itself when that is the whole fix, and sending everything else back through stages 5 → 8, or to stage 7 when only observed behaviour can settle it. **It commits documents only.** Code it dispatched would be code no verification pass had seen and no delivery review had read — the hole stage 8 closes by refusing to refactor, reopened one stage later.

### Running it from tickets instead of typing

Naming a skill is your right, not your duty. The daemon watches the managed projects' issue trackers and drives the process itself:

```bash
node dist/cli.js daemon                 # poll every 60s until stopped
node dist/cli.js daemon --once          # a single cycle — every transition inspectable
node dist/cli.js daemon --interval 30   # seconds between cycles
node dist/cli.js status                 # what each project is working, and what waits on you
node dist/cli.js takeover <project>#<n> # pick up a ticket that wants to talk something through
```

**The `timone` label is a permission boundary, not an instruction.** Putting it on an open issue says the daemon may act on that issue; it says nothing about what the issue *is* — classifying that is stage 1's job, run by an agent that has read the raw text. An unlabelled issue is never touched. Write tickets in plain language: naming a stage, a skill or a process concept is never required of you ([PRD-02.R13](doc/specs/prd/prd-02-inversion-of-control.criteria.md)).

### The two ways you get asked something

Human moments come in two kinds, and each has its own medium ([ADR-0012](doc/adr/0012-conversation-channels.md)):

- **A single decision — answered on the ticket.** When Timone wants approval, it posts what it wrote, links the artifact on its branch, and tells you the literal word to reply. **Reply `approve` and it goes on; reply anything else and it treats your reply as a change and does that step again with your words in hand.** There is no third outcome, and nothing is read as approval unless it *is* the word — "approve once you've fixed the wording" is a change request, deliberately, because a gate that guesses at intent eventually approves something nobody approved. Only replies posted after the request count, and only yours: Timone's own comments carry a marker, so it can never approve its own work by quoting the word back.
- **A back-and-forth — held in your terminal.** When a step needs an interview rather than an answer, the ticket hands you a copy-pasteable `timone takeover <project>#<ticket>`. Running it works out what that ticket is waiting for and drops you into the conversation; you never name a stage or a skill. What you agree gets posted back to the ticket as the record — the conversation itself is not kept and nothing may cite it. Run it on a ticket that is waiting for a *ticket reply* instead and it says so rather than opening an interview.

One session per project runs at a time, always. A parked ticket only blocks the others once it owns a work branch — so several tickets can sit waiting for your answer at once, and one unanswered question no longer freezes a project. Every message Timone posts is stamped as the machine's, because it posts through your GitHub credentials and would otherwise read as though you wrote it — which would also let a later session mistake its own words for your approval. After every spawned session three deterministic checks run (unpushed commits, `STATUS.md` off the default branch, files touched outside the target project); each violation is one loud ticket comment, and a clean session produces silence. Daemon state lives in `.timone/state.json` at the root — machine state, gitignored, never a process artifact.

`timone-onboard` is the one skill allowed to add a project — it does so via `timone projects add` (below), never by hand-editing `timone.yaml` ([ADR-0008](doc/adr/0008-manifest-writes-via-cli-command.md)). Every other skill validates its target against `timone.yaml`, requires the project to be cloned (`workspace sync` first), and touches only `projects/<name>/…` — the only files any skill ever commits there are process artifacts (`doc/…`, `CONTEXT.md`). See [process.md](process.md) for the full lifecycle these skills implement.

## Getting started

```bash
npm install
npm run build

# describe your projects (see timone.example.yaml)
cp timone.example.yaml timone.yaml

node dist/cli.js projects list      # table of managed projects + cloned state
node dist/cli.js workspace sync     # clone missing, fast-forward clean, skip dirty
node dist/cli.js projects add <name> --repo <url> --path projects/<name> \
  --stack <comma,list> --ticketing github [--preview docker]   # register a project (used by timone-onboard)
node dist/cli.js projects update <name> [--repo <url>] [--path <path>] \
  [--stack <comma,list>] [--ticketing github] [--preview docker]   # correct an existing entry (ADR-0008: never hand-edit)
```

`npm test` runs the suite (manifest validation + workspace-sync integration tests on local fixtures).

## Status

Phases 01–10 delivered: foundations (process spec, manifest, workspace sync), the document trio (grill/PRD/ADR skills), the standards library (12 entries approved), onboarding (`timone-onboard` + `projects add`), triage (`timone-triage` + `projects update`), planning (`timone-plan`), implementation (`timone-execute` + the TDD loop), verification (`timone-verify` + the accessibility baseline's stage-7 leg), delivery (`timone-deliver` + the two-axis review + the code-smell reference), and feedback (`timone-improve` + the seven remediation classes + the intent/verdict register carve-out). **Ten stage skills** now exist and have been exercised end to end against scratch fixtures — `timone-execute`'s dry run built a running Next.js + PostgreSQL application from an empty repository, `timone-verify`'s then checked it black-box and had two regressions fixed, `timone-deliver`'s opened three real pull requests carrying both review axes, and `timone-improve`'s took four real feedback intakes and drove one of them the whole way round: a delivery-review finding became a PRD amendment, a plan, a build, a verification pass and a new pull request, with stage 9 authoring no code commit. **The lifecycle now closes rather than ending at delivery. 22 of PRD-01's 24 requirements are verified.**

**Phase 11 delivered the inverted loop's first slice** ([PRD-02](doc/specs/prd/prd-02-inversion-of-control.md)): the daemon picks up marked tickets, acknowledges them, spawns a session from the timone root that classifies the request itself, serializes work per project, and runs three guardrail checks after every session — proven live on `scratch-app`, where a ticket written as "the page feels slow when I add many items" came back classified with a rationale and no process vocabulary. **R1, R2, R9, R10 and R15 verified; R13's daemon half verified, its interactive half still unproven.**

**Phase 12 is built and awaiting its live gate.** A classified ticket now walks on by itself: a feature opens a terminal conversation, the requirements and the plan are each committed on a work branch and gated on a ticket reply, and an approval is written back into the artifact as its stamp. A gate reply is judged by shape — the literal word `approve`, or anything else read as a change request — and Timone's own comments are excluded by the marker, so it cannot approve its own work. Its first live transition was watched on `scratch-app` #6; **the half needing a human at the keyboard has not been, so R3, R4, R5 and R14 stay unverified with their partial evidence written into the register.** Next: fvermaut's 12g gate, then phase 13 (execution → PR), after which the pilot starts. Still open on PRD-01: onboarding repair (R23) and standards-drift detection (R24, awaiting a grill session to rewrite its criteria). [STATUS.md](STATUS.md) carries the plain-language version.
