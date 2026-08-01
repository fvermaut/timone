# ADR-0010: Discovery maps live on the issue tracker as working memory (`timone-wayfind`)

- **Status:** accepted
- **Date:** 2026-08-01
- **Source:** wayfinder integration session of 2026-08-01

## Context

Stage 2 (`timone-grill`) is a single-session interview, and its conclusions evaporate unless stage 3 persists them. For an idea too big for one session — several independent decision areas, research needed between conversations, decisions that block other decisions — the process had nothing between "one long grill" and prematurely writing PRDs. `timone-handover` does not fill the gap: it is a linear resume note, not a decision map with a workable frontier.

Matt Pocock's [wayfinder skill](https://github.com/mattpocock/skills/blob/main/skills/engineering/wayfinder/SKILL.md) is exactly the missing shape: chart the idea as a shared map of decision tickets on the repo's issue tracker, then resolve them one session at a time until the way to the destination is clear. But adopting it verbatim collides with [ADR-0006](0006-specs-in-repo-single-source-of-truth.md) — "tickets never hold requirement detail" — because wayfinder's core rule is that a decision lives in exactly one place: its ticket.

## Decision

Adopt an adapted wayfinder as **`timone-wayfind`**, stage 2's **at-scale mode** — not a new stage, not a cross-cutting utility. The map is a single issue labelled `wayfinder:map` on the target project's GitHub repo, its decision tickets child issues; a project whose repo is not GitHub-hosted falls back — loudly, as in stage 1 — to a committed markdown map under `doc/wayfinder/`.

**Scaffolding, not spec — a bounded carve-out of ADR-0006.** Discovery tickets hold decision detail *as working memory only*, with the epistemic status of a grill transcript. Nothing on the map is normative. Promotion is immediate: a resolution passing stage 4's significance test becomes an ADR **at decision time**; the destination lands in-repo (normally the stage-3 PRD pair); PRDs and ADRs restate whatever they need and never point into tickets. The map closes only after the destination artifact is committed.

Deliberate deviations from upstream:

- **The execution override is struck.** Upstream lets an effort's Notes carry execution into the map; here the map only ever produces decisions. `task` tickets exist solely to unblock a decision (provisioning, access, moving data so its shape can be seen); anything that is a build routes through stage 1 like any other request.
- **The `prototype` ticket type is deferred** until Timone has a sanctioned prototyping convention (where prototype code lives, how it dies). Re-adopting it is its own decision.
- **Skill references remap:** upstream `/grilling` + `/domain-modeling` → `timone-grill` (which already owns the glossary via `CONTEXT.md`); `/research` → a fresh-context research sub-agent posting findings on the ticket; the tracker-setup skill is replaced by ADR-0004's GitHub binding plus the markdown fallback.

## Consequences

- The frontier — open, unblocked, unclaimed tickets — renders in the tracker's own UI, exactly the surface PRD-02's inverted loop needs a daemon to watch; AFK `research` tickets are natural autonomous-session work.
- Discipline is required: decisions must be promoted out of tickets promptly, or the map silently becomes a second source of truth — the failure ADR-0006 exists to prevent.
- `gh` support for native sub-issues and dependencies is partial; the skill degrades to a loud body convention (`Blocked by: #N`) where native relationships are unavailable.
- The markdown fallback is a second mechanics path to maintain.
- `timone-wayfind` is a fork with attribution; upstream wayfinder may evolve, and syncing is a choice, not an obligation.
