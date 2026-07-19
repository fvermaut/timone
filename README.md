# Timone

*Il timone* — the helm. A meta-project for agentic software development: Timone owns the agent harness and enforces one written engineering process across independent projects, inverting control so agents run the show and humans steer through tickets, pull requests, and preview deployments.

## Layout

- `process.md` — **the process**: the single written definition of every lifecycle stage, its artifact, gate, and owning skill
- `doc/specs/product-overview.md` — why Timone exists, goals in priority order, MVP success definition
- `doc/specs/prd/` — requirements: PRD-01 (the process layer — a skill per lifecycle stage) and PRD-02 (inversion of control — the daemon-driven loop)
- `doc/adr/` — architecture decision records (founding decisions: 0001–0006)
- `doc/plans/phases/` — executable phase plans and their reports
- `standards/` — central per-stack standards library (content authored by the human)
- `src/` — the Timone CLI (TypeScript, commander)
- `projects/` *(gitignored)* — managed project repos, declared in `timone.yaml` and materialized by the CLI

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

Phase 01 (foundations) delivered: process spec, manifest loader, `projects list`, `workspace sync`. Next: stage skills (PRD-01), then the inverted loop (PRD-02).
