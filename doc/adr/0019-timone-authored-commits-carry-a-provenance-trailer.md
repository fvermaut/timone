# ADR-0019: Timone-authored commits carry a provenance trailer

- **Status:** accepted
- **Date:** 2026-08-06
- **Source:** grill session of 2026-08-06 — the marker-as-convention grill [phase 13](../plans/phases/phase-13.md) recorded as overdue; sibling of [ADR-0018](0018-the-session-bracket-belongs-to-the-hooks.md)

## Context

Timone already has a marker convention, and it works. `MACHINE_MARKER` stamps every comment the harness posts, the adapter applies it so no caller has to remember, and `fromTimone` is derived from the marker **never from the author** — which is what lets the loop tell its own words from the human's while both appear under fvermaut's GitHub account. `STAGE_DONE_MARKER` and `CONVERSATION_RECORD_MARKER` extend the same idea to outcomes and conversation records.

The convention stops at the ticket. **Commits carry no equivalent.** Once work lands on a branch there is nothing in git that says which stage authored it, which run drove it, or whether a machine or a human at a keyboard made it. `STATUS.md` has recorded the consequence since 2026-08-05: a session fvermaut runs himself *"leaves no ticket, no label and no commit behind, so that particular check rests on your word and nobody else can go back and re-read it."*

On 2026-08-06 that became concrete. A stray `email-alerts` commit blocked a build on `scratch-app`; establishing where it came from meant reconstructing a session from memory, because the commit itself said nothing. The ledger could not answer either — an interactive session has no run in it.

Something *is* on those commits already: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`, on Timone's own history and on the pilot's. It is not enough. It names the model, which is the least interesting fact; it appears identically on daemon-driven and human-driven work; every Claude Code session anywhere in the world emits it; and it survives no question worth asking — *which stage, which ticket, which run, was anyone watching.*

The alternatives considered:

- **A local session journal only** (`.timone/sessions.jsonl`), nothing in commit messages. Nothing lands in client repos at all, which respects the containment rule most literally. Rejected: the record dies with the machine, is invisible to anyone reviewing the client repository, and cannot be read from a clone — precisely the audience that needs it. It is kept anyway, by ADR-0018, as the *interactive* record; it is simply not sufficient as the *durable* one.
- **A trailer on interactive commits only**, since daemon commits are already traceable through the ledger and the ticket. Keeps client history minimal. Rejected because the absence of a trailer would then mean two different things — human-typed, or daemon-authored — which is the ambiguity the trailer exists to remove, reintroduced as the default case.
- **A trailer on every Timone-authored commit** (chosen).

**The containment rule has to be answered head-on.** `CLAUDE.md` is unambiguous: *"Client repos receive only process artifacts (`doc/…`, `CONTEXT.md`). Never commit skills, harness files, or timone internals into a managed project."* A trailer is harness metadata, and it lands in a client's history permanently. The rule's target, though, is **files** — R2's criterion tests it as *"no commit adds harness files to X's repo"*, verified by `git log --stat` matching no harness path. A trailer adds no path. And the rule's purpose is that a client repo stay a working repo rather than a Timone artifact: a git trailer is a standard, tool-parsed, three-line convention that a client's own tooling already knows how to ignore, and its presence answers "who wrote this and why" for exactly the person most entitled to ask — a maintainer reading their own history.

## Decision

**Every commit a Timone session makes carries a provenance trailer, in both timone and managed repositories, whether or not a run drove it.**

```
Timone-Stage: remediation
Timone-Run: scratch-app#6
Timone-Session: abc123
```

- **`Timone-Stage` is always present.** For a daemon-driven session it is the pipeline stage; for a session with no run it is `interactive`. That value is the one that makes the absence of a `Timone-Run` line meaningful rather than ambiguous.
- **`Timone-Run` is present when a run drove the commit**, in the ledger's own `<project>#<ticket>` form, so a commit links back to its ticket without a lookup.
- **`Timone-Session` is always present** — the SDK session id, which is what ties a commit to its journal entry and to the run that recorded it.
- **`Co-Authored-By` stays.** It is orthogonal and answers a different question.
- **A commit with no `Timone-Stage` trailer was made by a human by hand**, and that is a statement the history now supports.

## Consequences

- `git log --grep=Timone-Stage` audits a repository for machine-authored work, from any clone, forever. The 2026-08-06 stray commit becomes a one-line answer instead of a reconstruction.
- Provenance outlives the systems that produced it. The ledger is gitignored machine state and the tickets live on someone else's server; git history is the only record that travels with the code.
- **A convention only binds the sessions that follow it, so the convention alone would have re-created the gap it closes.** The stage skills can be amended to emit the trailer; a human-driven session follows no skill. This is why [ADR-0018](0018-the-session-bracket-belongs-to-the-hooks.md) is its sibling rather than a coincidence: the `Stop` hook gains a fourth deterministic rule — *a commit made during this session without a `Timone-Stage` trailer is a violation* — and enforcement is what turns the convention into a fact. Neither decision delivers what it promises without the other.
- Harness metadata now lands in client repositories, narrowing the containment rule from "nothing of Timone's" to "no harness *files*". `CLAUDE.md` and PRD-02 R2's criterion are amended to say so explicitly, because a rule that is quietly narrower than its wording is how the next contradiction starts.
- **The trailer cannot be retrofitted.** Every commit before this lands is unmarked, so absence proves nothing about history predating the convention. Nothing is rewritten to fix that; the record starts where it starts.
- A squash-merge on GitHub composes trailers from the squashed commits into one message; a rebase preserves them. Neither loses provenance, though a squashed PR may carry several `Timone-Session` lines — which is accurate, not a defect.
