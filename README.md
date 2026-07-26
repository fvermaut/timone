# Timone

*Il timone* — the helm. A meta-project for agentic software development: Timone owns the agent harness and enforces one written engineering process across independent projects, inverting control so agents run the show and humans steer through tickets, pull requests, and preview deployments.

## Layout

- `process.md` — **the process**: the single written definition of every lifecycle stage, its artifact, gate, and owning skill
- `doc/specs/product-overview.md` — why Timone exists, goals in priority order, MVP success definition
- `doc/specs/prd/` — requirements: PRD-01 (the process layer — a skill per lifecycle stage) and PRD-02 (inversion of control — the daemon-driven loop)
- `doc/adr/` — architecture decision records (founding decisions: 0001–0007)
- `doc/plans/phases/` — executable phase plans and their reports
- `.claude/skills/` — the stage skills (`timone-onboard`, `timone-grill`, `timone-prd`, `timone-adr`, …) — see [.claude/skills/README.md](.claude/skills/README.md) for authoring conventions
- `standards/` — central standards library: a mandatory baseline (accessibility, UI/UX) plus per-stack entries, agent-drafted from primary sources and human-approved
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
```

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

Phases 01–07 delivered: foundations (process spec, manifest, workspace sync), the document trio (grill/PRD/ADR skills), the standards library (11 entries approved), onboarding (`timone-onboard` + `projects add`), triage (`timone-triage` + `projects update`), planning (`timone-plan`), and implementation (`timone-execute` + the TDD loop). Seven stage skills now exist and have been exercised end to end against scratch fixtures — `timone-execute`'s dry run built a running Next.js + PostgreSQL application from an empty repository. Next: verify, deliver and improve skills, plus the two-axis delivery review (PRD-01.R12–R14, R17), then the inverted loop (PRD-02). [STATUS.md](STATUS.md) carries the plain-language version.
