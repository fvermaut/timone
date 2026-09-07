# Phase 35 — Departures record

> One dated entry per departure, appended as it happens, never rewritten. Format per `.claude/skills/timone-execute/SKILL.md`, "The departures record".

## 2026-09-05 — timone#105, execution

**Kind:** plan step

**Agreed:** Sub-phase 35b names four exact passages in `.claude/skills/timone-execute/SKILL.md` to change (gate 2, gate 3, the two-attempt failure paragraph, the shell slice's look-check sentence), plus a new departures-record section and a completion-report template line. Nothing else in the file was named.

**Did instead:** After landing those four edits (and the consistency fixes they forced elsewhere in "The three gates" and the "Workflow" section, both within 35b's own scope), a further read-through found three more passages in the same file that describe the *old* stop-and-park behaviour as still current: "Read before you execute"'s note on an uncommitted handoff section ("the trace an escalated slice left behind, since escalation deliberately preserves uncommitted work"), the matching sentence under "What 'dirty' means", and the "Closing" section's report-order list ("The gate outcome, if one fired... then stop, nothing below applies" and "including any that escalated"). All three assumed gate 2, gate 3, or an exhausted retry could still leave a slice mid-flight and uncommitted, or stop the whole report — none of which is true any more after 35b's own edits. Amended all three in place, dated with this same marker, rather than shipping a file that contradicts itself two sections after fixing the contradiction.

**Why:** Leaving them would mean a future execute session reads correct instructions for gate 2/3 in one place and stale, contradictory instructions for the resume path and the closing report three sections later in the same file. That is worse than the situation this sub-phase set out to fix — a self-contradictory skill file is exactly the kind of ambiguity that used to cause a run to stop and ask a question nobody could act on.
