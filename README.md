# Timone

*Il timone* — the helm. A meta-project for agentic software development: Timone owns the agent harness and enforces one written engineering process across independent projects, inverting control so agents run the show and humans steer through tickets, pull requests, and preview deployments.

## Layout

- `process.md` — **the process**: the single written definition of every lifecycle stage, its artifact, gate, and owning skill
- `doc/specs/product-overview.md` — why Timone exists, goals in priority order, MVP success definition
- `doc/specs/prd/` — requirements: PRD-01 (the process layer — a skill per lifecycle stage) and PRD-02 (inversion of control — the daemon-driven loop)
- `doc/adr/` — architecture decision records (founding decisions: 0001–0007)
- `doc/plans/phases/` — executable phase plans and their reports
- `.claude/skills/` — the stage skills (`timone-grill`, `timone-prd`, `timone-adr`, …) — see [.claude/skills/README.md](.claude/skills/README.md) for authoring conventions
- `standards/` — central standards library: a mandatory baseline (accessibility, UI/UX) plus per-stack entries, agent-drafted from primary sources and human-approved
- `src/` — the Timone CLI (TypeScript, commander)
- `projects/` *(gitignored)* — managed project repos, declared in `timone.yaml` and materialized by the CLI

## Working with Timone

Sessions run at the timone repo root — never inside a managed project ([ADR-0007](doc/adr/0007-sessions-at-timone-root.md)). Every stage skill takes a target project: name it in your prompt, or the skill asks. From the root:

```
/timone-grill <project-name> <topic or idea to grill>     # stage 2 — requirements interview
/timone-prd <project-name>                                 # stage 3 — persist the PRD pair
/timone-adr <project-name> <decision to record>            # stage 4 — architecture decision record
```

Each skill validates the target against `timone.yaml`, requires the project to be cloned (`workspace sync` first), and touches only `projects/<name>/…` — the only files it ever commits there are process artifacts (`doc/…`, `CONTEXT.md`). See [process.md](process.md) for the full lifecycle these skills implement.

## Getting started

```bash
npm install
npm run build

# describe your projects (see timone.example.yaml)
cp timone.example.yaml timone.yaml

node dist/cli.js projects list      # table of managed projects + cloned state
node dist/cli.js workspace sync     # clone missing, fast-forward clean, skip dirty
```

`npm test` runs the suite (manifest validation + workspace-sync integration tests on local fixtures).

## Status

Phase 01 (foundations) and phase 02 (document trio: grill/PRD/ADR skills) delivered. Phase 03 (standards library content) delivered — 11 entries approved. Next: onboarding, triage, plan, execute, verify, deliver, and improve skills (remaining PRD-01 scope), then the inverted loop (PRD-02).
