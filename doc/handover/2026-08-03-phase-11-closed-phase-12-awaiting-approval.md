# Handover — Timone — 2026-08-03

> Prior handover: [2026-08-02-prd-02-grilled-phase-11-awaiting-approval.md](2026-08-02-prd-02-grilled-phase-11-awaiting-approval.md) — its "Exact next action" (fvermaut approves phase 11, then execute by hand) is **done**; read this file instead.

## Snapshot

**Phase 11 is built, proven live, and closed.** The daemon picks up marked tickets on managed projects, acknowledges them, spawns an Agent SDK session from the timone root that classifies the request itself, parks the run, serializes work per project, and runs three guardrail checks after every session. All of it was watched working on `scratch-app`. PRD-02's R1, R2, R9, R10 and R15 are `verified`; **R13 remains `draft`** — its daemon half is proven, its interactive half has never been observed. **Phase 12 is planned and stamped `Awaiting approval`.** Tree clean, `main` pushed, commits `aaf9146`–`01b0e66`. 116 tests green, `type-check` clean.

## Done this session

- **Phase 11 executed by hand, 11a–11h** — [phase-11.md](../plans/phases/phase-11.md) (`Complete`), report at [phase-11-complete.md](../plans/phases/reports/phase-11-complete.md). New: `src/adapters/{ticketing,github-tickets}.ts`, `src/daemon/{runs,poll,session,hooks}.ts`, `src/commands/{daemon,status}.ts`.
- **Live proof on `scratch-app`** — [#4](https://github.com/fvermaut/scratch-app/issues/4) picked up, classified `triage:bug` with a rationale naming no stage or skill; [#5](https://github.com/fvermaut/scratch-app/issues/5) unlabelled and untouched; [#6](https://github.com/fvermaut/scratch-app/issues/6) queued then triaged; guardrail violation and clean re-run both observed; `#7` was a scripted fixture, closed.
- **Register flips** — [prd-02 criteria](../specs/prd/prd-02-inversion-of-control.criteria.md): R1, R2, R9, R10, R15 `verified`, three of them carrying explicit "known limit of the evidence" notes; R13 left `draft` with both clauses' status recorded.
- **`README.md` and `STATUS.md`** updated; STATUS's two "nothing checks that a stage obeyed it" entries downgraded to *partly closed* rather than closed.
- **[phase-12.md](../plans/phases/phase-12.md) drafted**, `Awaiting approval` — 12a–12h, R3/R4/R5/R14 plus R13's missing clause.
- Two fixes outside the plan: `504adab` (the marker, below) and `bc5d40f` (the root `npm test` swept `projects/`, reporting four failures belonging to `scratch-app`).

## In flight / blocked

- **Phase 12 is blocked on fvermaut's approval** of [phase-12.md](../plans/phases/phase-12.md), which also carries one open decision he must actively choose (holds-the-project, below) rather than merely sign.
- **`scratch-app` is frozen.** `#4` is parked awaiting the stage phase 12 builds, and `#6` is queued behind it. Under phase 11's rule this is permanent until phase 12 lands. The side ledger used for the marker proof left `#6` triaged in reality but `queued` in the real ledger (`.timone/state.json`) — harmless while `#4` never terminates, and it must not be forgotten if the holds-the-project rule changes.

## Decisions made this session

- **fvermaut approved phase 11** (2026-08-02) and **passed its 11g live-proof gate** (2026-08-03), including the marker wording as written.
- **Machine comments carry a marker line** (`504adab`) — Timone posts through the human's `gh` credentials, so its comments appeared authored by him. Beyond confusion, a session reading the thread back could not tell its own words from his, which [ADR-0012](../adr/0012-conversation-channels.md)'s ticket-only decision write-path makes load-bearing: phase 12 could otherwise read Timone's own comment as an approval. Held in three places — the adapter stamps what the daemon posts, the session prompt instructs the session to stamp what it posts itself, and `getTicket` returns `fromTimone` per comment. Recorded as a dated `✏ Refined` amendment on the phase file; stamp retained (defect execution found). **No ADR** — it implements ADR-0012 rather than deciding anything new.
- **Deferred deliberately, both named in the phase file:** a real bot identity (GitHub App, `timone[bot]`) needs credentials from fvermaut and is its own slice; making the marker a process-wide convention in `process.md` and the stage skills is a meta-level change and **gets a grill first**.
- **Evidence discipline held over the plan's own instruction.** 11h said "flip R1, R2, R13 as verified"; R13's second clause has no evidence, so it was not flipped. Three verified entries carry written limits.

## Exact next action

**fvermaut reads [phase-12.md](../plans/phases/phase-12.md) and approves — and answers the one embedded question: does a parked run hold its project?** The plan proposes changing phase 11's rule so a parked run holds its project only once it owns a work branch (so several tickets can await answers at once, while anything touching the repo still runs one at a time); the alternative is keeping phase 11's simpler rule and accepting the freeze. Roughly ten lines differ. On approval: flip the Status line to `Approved for execution by fvermaut <date>`, commit `docs: approve phase 12`, then execute 12a onward **by hand** (`/timone-execute` targets managed projects only; its shape — TDD at declared seams, one commit per sub-phase `<type>: 12x — <deliverable>` — is followed without the instrument). 12a and 12b are independent; start there.

## Open questions

- **Holds-the-project** — fvermaut, at phase-12 approval. Blocks 12b.
- **The two fixture projects** (`scratch-app-2`, `scratch-existing`) declare local paths as `repo_url` and log an adapter refusal every poll. One line skips non-GitHub projects quietly, or they leave the manifest — fvermaut, folded into 12b if wanted.
- **A real bot identity** — needs fvermaut to create a GitHub App and supply a key. Until then the marker is what exists.
- **The marker as a process-wide convention** — needs a grill session; interactive stage sessions currently post unmarked comments.
- **R13's second clause** costs one prompt to settle: state a raw request in a terminal session and watch whether it routes through triage. Planned as 12g step 5.
- Carried unchanged: the deferred PRD-01 list (R23 onboarding repair, R24 standards-drift needing a grill, deployment/maintenance skills, `timone-wayfind`'s first use, never-fired give-up paths). `scratch-app`'s PRs #1–#3 are all merged; its screen-reader HUMAN-CHECK and the guessed 2 ms latency budget remain open on that project.
