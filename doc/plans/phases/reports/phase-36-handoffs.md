# Phase 36 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 36a — The pull request body opens on departures and, when there is a screen, its comparison

**Built.** `timone-deliver`'s gate 4 no longer blocks the PR on a human viewing the built screen. It is renamed "4 — The screen" and keeps exactly one refusal: the phase's completion report carrying no shell-slice difference list at all, which routes to `timone-execute` naming the sub-phase whose validation should have produced it. When a screen exists and the comparison is on record, the gate reads the shell slice's difference list and its named reference straight from the completion report and carries both into the PR body instead of asking anyone anything. The delivery report's `Look gate:` field is replaced by a `Screen:` field. The PR body template gains two new opening sections, `## Departures` and `## The screen`, inserted before `## Scope` — Departures always present (quoting `phase-NN-departures.md` or stating nothing was bent), the screen section present only when the phase carries one, ending with "No prior viewing: merging this pull request is the yes." The `## Workflow` list gains a new step 7 composing both sections before the delivery report is committed; later steps renumbered 8-11.

**Files touched.**

- `.claude/skills/timone-deliver/SKILL.md` — gate 4 replaced (rename, new refusal set, new "reads not asks" behaviour, explicit statement of which half of ADR-0039 it reverses); delivery report template's `Look gate:` field replaced with `Screen:`; PR body template gains `## Departures` and `## The screen` sections between the opening line and `## Scope`; `## Workflow` numbered list gains step 7 (departures/screen composition) with steps 7-10 renumbered to 8-11.
- `doc/plans/phases/reports/phase-36-handoffs.md` — created with the required header, this section appended.

**Standards.** `doc/standards.md` does not exist in this project (onboarding incomplete). Per the plan's instruction, fell back to Timone's central standards baseline. This sub-phase changes only prose in a skill-instruction file — no application code, no tests — so no stack-specific standard entry applies.

**Decisions taken inside the slice.**

- **Removed the "This does not reverse the HUMAN-CHECK rule below" paragraph entirely**, rather than editing it in place. That paragraph's whole point was to contrast the look gate's judgement (blocking, human-performed, right there in this gate) against a HUMAN-CHECK's evidence-gathering (non-blocking, deferred). Once gate 4 stopped asking a human anything or blocking on their answer, the contrast it drew no longer holds — there is no judgement left in this gate to distinguish from a HUMAN-CHECK. Keeping it would assert something false (that this gate still performs a judgement the PR exists to obtain). No replacement text was needed since the new gate 4 body already states plainly, in its own bullets, what the gate does and does not do now.
- **Added an ADR-0038 citation** in the new refusal bullet, since the plan's refusal condition ("ADR-0038's shell gate never ran or was never recorded") names that ADR directly — the existing file already cites ADR-0038 elsewhere (gate 3, workflow) so this follows the file's own convention of linking every named ADR on first mention in a block.
- **Left the pre-existing mislabeling in `## Workflow` step 2** ("gate 4 (GitHub binding and `gh`)", which actually describes gate 5's content) untouched. It predates this sub-phase, is not part of the plan's excerpt, and touching it would go beyond the specified edits.

**Validation evidence.**

All seven grep commands were run against the edited file; output below.

```
=== grep 1 ===
(no output)
exit: 1
=== grep 2 ===
(no output)
exit: 1
=== grep 3 ===
187:## Departures
exit: 0
=== grep 4 ===
191:## The screen
exit: 0
=== grep 5 ===
116:- **Screen:** <"no user-facing screen in this phase" | "no prior viewing — the shell slice's comparison and the preview are carried in the pull request body"> — [ADR-0052](../../../doc/adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md)
exit: 0
=== grep 6 ===
43:- **A phase with a screen carries exactly one refusal here: no shell-slice comparison at all.** When the phase's completion report carries no recorded difference list from the shell slice, that is a missing artifact — [ADR-0038](../../../doc/adr/0038-a-screens-shell-is-built-before-its-behaviours.md)'s shell gate either never ran or was never recorded, not a difference this process explained and accepted. Refuse, and route to **`timone-execute`**, naming the sub-phase whose validation should have produced the list.
exit: 0
=== grep 7 ===
199:**Preview:** <"this project has no preview configured for pull requests — see the local checkout steps below" when the project has no `bindings.preview` in `timone.yaml`, otherwise "building now — the machine posts its address in a comment on this pull request as soon as it is ready, usually within a few minutes.">
exit: 0
```

Checkbox-by-checkbox:

- [x] First two greps exit 1 — confirmed: the old "does not get a pull request until the human has seen" sentence and the "seen and approved by" field value are both gone.
- [x] Next three greps exit 0 — confirmed: `## Departures`, `## The screen`, and `**Screen:**` are all present.
- [x] Sixth grep exits 0 — confirmed: gate 4's surviving refusal (missing shell comparison, routed to `timone-execute`, naming the sub-phase whose validation should have produced the list) is present verbatim.
- [x] Seventh grep exits 0 — confirmed: the screen section's preview wording ("posts its address in a comment on this pull request... within a few minutes") points at the existing comment mechanism, not a literal address required at open time.
- [x] Gate 4's new text names which half of ADR-0039 it reverses and which half is unaffected — confirmed by reading the new gate 4 bullets: the fourth bullet states "This reverses only the delivery-time half of ADR-0039" and explicitly says "The shell slice's own fresh-context comparison — that ADR's check 1 — is unaffected: it still runs, and still blocks, at execution time, under stage 6's bounded retries."
- [x] Gates 1, 2, 3 and 5 are byte-identical to before this sub-phase — confirmed by `git diff` review: the diff hunk touching the gates section starts exactly at the `**4 —` line and ends exactly at the `**5 — Platform gate.**` line (gate 5's own text is unchanged, only appearing in the diff as unchanged context). No other line in gates 1-3 or 5 appears in the diff.

All checkboxes pass. No fixes were needed after the first run of the validation commands.

**What 36b must know.** 36b touches `process.md` (out of scope for this sub-phase, explicitly deferred). The stage-8 skill's contract has changed: gate 4 no longer performs a blocking human look-gate, it now only guards against a missing shell-slice comparison artifact, and the PR body's first two sections are now Departures and The screen. If `process.md`'s stage 8 description still describes the old blocking look gate or omits the Departures/screen PR sections, 36b will need to bring it in line with what is now implemented here. The exact new gate 4 wording, the `Screen:` report field, and the PR body template's two new sections (as written in `.claude/skills/timone-deliver/SKILL.md`) are the source of truth to match against.
