# Timone

Timone is the meta-project steering agentic development across independent client/personal projects. Sessions run here at the timone root — never inside a managed project ([ADR-0007](doc/adr/0007-sessions-at-timone-root.md)).

## The essentials

- **The process** is defined in [doc/process.md](doc/process.md) — the single normative definition of every lifecycle stage, its artifact, and its gate. Stage skills under `.claude/skills/` implement it.
- **Managed projects** are declared in `timone.yaml` and live as independent git repos under `projects/` (gitignored here). Materialize with `node dist/cli.js workspace sync`; inspect with `node dist/cli.js projects list`.
- **Target project:** every stage skill operates on one managed project — named in the prompt, or asked for; in daemon-triggered sessions it comes from the event. Skills touch only `projects/<name>/…`.
- **Client repos receive only process artifacts** (`doc/…`, `CONTEXT.md`). Never commit skills, harness files, or timone internals into a managed project.
- **Standards** live in [standards/](standards/README.md): a mandatory baseline (accessibility per EAA, UI/UX) plus per-project stack entries. Only `Approved` entries are normative.
- Timone's own requirements are PRD-01/PRD-02 under [doc/specs/prd/](doc/specs/prd/); its decisions are ADRs under [doc/adr/](doc/adr/).
