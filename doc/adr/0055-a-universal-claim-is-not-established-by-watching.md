# ADR-0055: A universal claim is not established by watching, and a status may not outrun its own notes

- **Status:** accepted
- **Date:** 2026-09-12
- **Source:** the audit of ADR-0052's rollout owed by [timone#129](https://github.com/fvermaut/timone/issues/129), after `ivtrends` [#90](https://github.com/fvermaut/ivtrends/issues/90)
- **Extends:** [ADR-0051](0051-timone-verifies-itself-by-live-gate-and-a-regression-set-is-narrowed-by-what-it-depends-on.md), which made the live gate the way Timone verifies itself and did not say what a live gate can and cannot establish
- **Bounds:** [ADR-0052](0052-a-run-that-enters-the-build-ends-at-its-pull-request.md), whose own consequences named PRD-03's register as what would verify its rollout

## Context

ADR-0052 closed on: *"`process.md`, the execute, verify and deliver skills, and the daemon's run states must change to match; PRD-03's register is what verifies they did."* The register reported that they had. They had not, and `ivtrends` #90 is what the gap cost.

**The register is not vague about this. It is precise, and the status line contradicts it.** Three findings, all readable in PRD-03 today:

- **PRD-03.R5**, *"No question without the power to act on its answer"*, is `verified` on the phase-35 live gate of 2026-09-07: *"every typed reply moved the work; no reply was redirected to a command"*. The claim is a universal — *at no point is the human told their reply cannot be acted on* — and the gate established it for the replies it happened to type. Nobody typed a misspelling. Three days later `ivtrends` #90 typed one, and the reply was redirected to a command.
- **PRD-03.R1** is `verified` while its own note says clause 2 *"was never triggered — no run's own work failed … the own-tests-red case remains owed a direct sighting."* A clause nobody has ever seen hold is carried inside a requirement marked verified, and the note recording that is beneath the status contradicting it.
- **PRD-03.R1 clause 3** was found to **diverge** from ADR-0052 and was *"reworded to the stop-and-ask that exists, rather than changing the code"*. That is a decision being changed — the ADR says a run never stops, the reworded clause says this one does — recorded as an edit to a criterion rather than as an amendment to the decision it contradicts.

**The common root is what a live gate is.** It watches a running system do things. What it observes is a set of paths, and what a MUST of this kind claims is a property of every path. Those are different sizes of statement, and no number of passes closes the gap: the gate that watched *many rounds* of replies on `scratch-app` #50 and #51 was not weak or careless, it was doing the only thing watching can do.

**What made this invisible is that nothing in the register distinguishes the two.** `verified` reads the same whether it means *a test would go red if this stopped holding* or *we watched four runs and it held in all four*. The second is worth having. It is not worth the same.

**Alternatives considered:**

- **Run more live gates, or run them for longer.** Rejected: it treats a categorical limit as a quantitative one. The misspelling case was not rare, it was simply not thought of — and a gate that runs twice as long still only walks the paths whoever drove it thought to walk.
- **Forbid `verify-via: live` on any universal claim, and demand `api`.** Rejected: it would delete the live gate's real job. ADR-0051 made it the way Timone verifies itself precisely because much of what Timone does is only observable in a real daemon against a real forge. The answer is not to stop watching; it is to stop letting watching alone close a universal.
- **A rule in the verification skill.** Rejected, and the rejection is the whole subject of this ADR: ADR-0052's rules reached the skills and stopped there. A rule written only in an instruction file is the failure mode being fixed, not the fix.
- **A check that runs when a status is written.** Attractive and unavailable: a status is flipped by an agent editing a file, and there is no moment the machinery owns to hang a check on. The check therefore runs where the harness already inspects a session's work.

## Decision

**D1 — A MUST whose claim is universal may not reach `verified` on watching alone.** A claim is universal when it says a thing never happens or always happens — *no*, *never*, *always*, *at no point*, *every*. Such a criterion reaches `verified` only when at least one check exists that **can fail by construction**: a test at a seam, a type that admits nothing else, a probe that has been proved able to go red. The live gate still runs and still counts; what it may no longer do is close the claim by itself.

**D2 — A status may not outrun its own notes.** A criterion carrying a written record that one of its clauses was never observed is not `verified`, whatever the rest of it did. The register already writes these admissions down; what changes is that the status has to agree with them.

**D3 — A criterion that diverges from an accepted decision is not reworded until the decision is.** Finding that the code does something the ADR forbids is a finding about the code or about the decision, and either way it is settled where the decision lives. Rewording the criterion first makes the register agree with the code and leaves the ADR standing, wrong, as the thing everything else is read against.

**D4 — These are checked by the harness, not asked of an agent.** A check reads the registers and reports a criterion that breaks D1 or D2, in the same place the session's other faults are reported. It is deliberately a repository check rather than a session one: a register that already breaks the rule is a standing fault, and being told about it on every session until it is fixed is the correct amount of noise for something that cost `ivtrends` #90.

## Consequences

- **PRD-03.R1 and R5 lose `verified` immediately**, and that is the decision working rather than a side effect. R5's universal was falsified in the field; R1 carries a clause its own note says nobody has seen. Both go back to `draft`, which is what *not yet established* has always meant.
- **Some criteria will sit at `draft` for a long time**, because writing a falsifiable check for them is real work and occasionally impossible. That is the honest state, and it is strictly better than the state this replaces, where the same criterion read as finished.
- **The check can only see claims it can recognise.** It reads the criterion's words for the universal quantifiers named in D1, so a universal phrased around them — *"a reply is acted on in all cases"* — slips past. This is a floor, not a proof, and it is worth having for the same reason ADR-0033's mechanical floor was: the first detector is the human writing the criterion, and this catches what that misses.
- **It will fire on registers nobody is working on**, including client projects', the moment their MUSTs are universal and watched. Expected, and the reason D4 makes it a repository check: the alternative is a fault that only the session that introduced it ever hears about, which is how a four-day-old rollout gap goes unnoticed.
- **D3 costs a stop.** A build that finds a criterion contradicting an ADR now has somewhere to go that is not *edit the criterion*, and that somewhere is slower. ADR-0052's own rule bounds it: inside the build a run still records the departure and carries on, and the decision is settled at the pull request rather than by waiting.
