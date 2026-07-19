# ADR-0009: Framework CLIs are the default agent tooling surface; MCP servers are adopted only for a named capability gap

- **Status:** accepted
- **Date:** 2026-07-20
- **Source:** Grill session on MCP delivery, 2026-07-19/20 (fvermaut), triggered by an observation at phase 06's closing gate.

## Context

`standards/shadcn.md` names the shadcn MCP server for agent sessions; no other standards entry mentions MCP, and no general rule existed. The naive rule — "adopt the official MCP server for every stack we use" — was the starting proposal.

Two facts made it the wrong rule. First, the vendors are moving the other way: Microsoft's Playwright MCP README states that "modern coding agents increasingly favor CLI-based workflows exposed as SKILLs over MCP because CLI invocations are more token-efficient," and ships a separate `@playwright/cli --skills` for routine work, scoping MCP to exploratory automation. Vercel (`vercel skills`, `vercel agent init`), Supabase (`npx skills add supabase/agent-skills`) and Next.js (`AGENTS.md` by default) all now ship a CLI/skills path alongside their MCP server. Second, MCP tool definitions occupy session context unconditionally, and this project already treats context as a real cost (`phase-03.md`: "these are injected into agent contexts; length is a cost").

Timone had also already made this call once without generalizing it: ADR-0004 chose the `gh` CLI as the GitHub surface with no adapter layer, and `timone-triage` uses it directly.

Alternatives considered:

- **MCP-first wherever an official server exists.** Maximizes structured tool access and was the original instinct. Rejected: it spends context in every session on tool definitions that duplicate CLI capability, and it runs against the vendors' own stated direction — three of the seven candidate servers turned out to duplicate CLI surface outright, and one (Vitest) does not exist at all.
- **Per-entry decision with no cross-cutting rule.** Most faithful to each vendor's guidance. Rejected: it gives the plan and execute skills no principle to apply when a new stack arrives, guaranteeing the debate recurs per project.
- **A single global MCP configuration covering everything.** Simplest, zero machinery. Rejected on isolation grounds — see the tiering decision below.

## Decision

**The framework CLI is the default agent tooling surface. An MCP server is adopted only when it exposes a capability the CLI genuinely cannot**, and the standards entry adopting it must name that capability.

MCP configuration is **two-tier, split on credentials**:

- **Global tier** — `/.mcp.json` at the timone root, for servers carrying no credential and no client-scoped data access. Versioned with timone, like the skills.
- **Scoped tier** — per-project and daemon-only, for any credentialed server. Because sessions run at the timone root (ADR-0007), a globally configured credentialed server would hold one client's access while a session works on another. The daemon sets these per spawn via the Agent SDK (ADR-0002); a manifest field, written through the CLI (ADR-0008), carries the selection.

Initial application: the global tier holds **`playwright`** (live browser state, which no CLI exposes) and **`next-devtools`** (dev-server errors and logs). The scoped tier is **policy with zero members** — under the CLI-first rule the Supabase CLI covers its MCP server's real work, and no other candidate qualifies. GitHub is explicitly not adopted: `gh` remains the single GitHub surface per ADR-0004.

## Consequences

- Nothing speculative gets built: one small `.mcp.json`, no manifest schema change, no daemon dependency. The scoped tier is specified but unimplemented until PRD-02.
- Every standards entry that adopts an MCP server must justify it against the CLI. Entries that don't adopt one need say nothing — silence means "the CLI covers it."
- The scoped tier's first real use will also be its first validation, at the moment the daemon lands. Its design is therefore untested policy, accepted deliberately over building machinery with no current member.
- Both adopted servers are pre-1.0 (`@playwright/mcp` 0.0.78, `next-devtools-mcp` 0.4.0) and will churn. `playwright` may be retired by this very rule if Microsoft's CLI+skills path matures — that is the rule working, not failing.
- Cross-client isolation for credentialed tooling now has a stated design, where ADR-0007 left it as convention pending daemon-level scoping. This ADR narrows that debt without closing it.
- `standards/shadcn.md`'s existing MCP mention must be re-justified against the CLI-first rule or dropped; the shadcn CLI covers `add`/`view`/`search`.
