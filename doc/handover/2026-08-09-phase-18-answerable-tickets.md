# Handover — Timone — 2026-08-09

> Prior handover: [2026-08-09-phase-17-closed.md](2026-08-09-phase-17-closed.md). Its "Exact next action" — *stage 0 on a real project* — **was done between that handover and this session** (`1c8d555` registers `ivtrends`), and a `timone-wayfind` map was charted on it. This session is the consequence: the first real use of the process on a real project immediately exposed a hole, and fixing it is all this session did.

## Snapshot

**`ivtrends` was charted into a nine-ticket decision map that the human could read and could not answer.** Every ticket was a well-formed question with no instruction of any kind, and `timone takeover ivtrends#5` refused — wayfinder tickets are created by an interactive skill outside the daemon's conversation machinery and never enter the ledger. The **process half of the fix is committed** (`7af8cab`): [ADR-0022](../adr/0022-a-conversation-ticket-can-be-answered-in-writing.md) amends [ADR-0012](../adr/0012-conversation-channels.md) so a ticket waiting on a conversation offers two answer paths, bounded at one clarifying round. The **code half is [phase 18](../plans/phases/phase-18.md), approved by fvermaut and deliberately not built here** — he handed it to another session. All nine live tickets were given hand-written CTAs so the map is usable *today*, in a written-path-only form that says the terminal option does not exist yet. **PRD-02 is now 16 of 20 verified** — R3 dropped from `verified` to `revised` by the amendment, and R20 is new at `draft`.

## Done this session

- **[ADR-0022](../adr/0022-a-conversation-ticket-can-be-answered-in-writing.md)** — a ticket waiting on a conversation can be answered in writing. Amends ADR-0012's conversation bullet; that ADR's status line now says so, its body untouched.
- **[process.md](../../process.md)** — the conversations section carries the second path; stage 2's at-scale paragraph requires a per-type CTA in every ticket body.
- **[timone-wayfind](../../.claude/skills/timone-wayfind/SKILL.md)** — new "Every ticket carries its own CTA" section with the three verbatim templates, and "Reading a written answer" with the one-clarifying-round rule. Mode 2 step 3 now reads the thread *before* asking anything.
- **[PRD-02](../specs/prd/prd-02-inversion-of-control.criteria.md)** — **R3 `revised`** with a third clause for the written path; **R20 new** (`draft`), covering wayfinder tickets participating in the loop at all.
- **[Phase 18](../plans/phases/phase-18.md) written and approved** — five slices, `Approved for execution by fvermaut 2026-08-09`.
- **The nine live `ivtrends` tickets carry CTAs**, written by hand: [#5](https://github.com/fvermaut/ivtrends/issues/5), [#6](https://github.com/fvermaut/ivtrends/issues/6), [#9](https://github.com/fvermaut/ivtrends/issues/9) as *frontier*; #7, #8, #10, #12, #13 as *blocked*, naming their blockers by title; [#11](https://github.com/fvermaut/ivtrends/issues/11) as *prototype*. The phase file's "The live tickets, as they stand" section is the authority on what they say and why.
- **A stale fact corrected on #5, #6 and #9** — each still claimed to be blocked by AlphaVantage research closed days earlier. Struck through with what that research concluded, not deleted.

## In flight / blocked

- **[Phase 18](../plans/phases/phase-18.md) is approved and unstarted.** Nothing of it is built; the working tree carries no code changes. **605 tests green** at `7af8cab`.
- **The nine `ivtrends` tickets carry a CTA that 18e must *replace*, not append to.** They say the terminal option does not exist. Once 18b lands, it does, and a ticket left with both blocks would carry two sets of instructions disagreeing about reality. This is written into the phase file in two places because it is the one way this hand-work can poison the build.
- **`ivtrends` #5, #6 and #9 are the live frontier**, unassigned and unclaimed. Answering any of them is stage-2 work on a managed project, not Timone work.
- **`scratch-app` #4 still parked at triage; #10 and #13 still `failed`** — untouched for the fifth handover running.
- **17c's human gate is still outstanding**, as the prior handover left it.

## Decisions made this session

- **[ADR-0022](../adr/0022-a-conversation-ticket-can-be-answered-in-writing.md) — read it rather than this bullet.** The three choices it does *not* explain at length, because they were fvermaut's at the grill: the written path is picked up by **the daemon** (not lazily by the next session), it applies to **every** conversation ticket (not wayfinder-only), and the wording is **per ticket type**.
- **Wayfinder tickets will join the `timone`-marked set rather than getting a parallel watched set** — one pickup rule, one ledger, and `timone takeover` then needs no tracker-resolution path. Recorded as a load-bearing decision in the phase file, with the ADR gate explicitly considered and declined as reversible. **If the executing session disagrees, that disagreement is the trade-off and it earns its own ADR before 18b starts.**
- **The CTAs were written by hand before the build, on fvermaut's instruction**, rather than waiting for 18e. The alternative — nine unanswerable tickets across a session boundary — was the original complaint.
- **The prototype ticket cannot have a working CTA until 18b lands**, since its only path is the takeover. #11 says nothing is needed and that a link arrives when there is something behind it. That is honest rather than complete.
- **"Six tickets" was wrong; it is nine.** Corrected in `STATUS.md` and the phase file rather than quietly restated.

## Exact next action

**Execute [phase 18](../plans/phases/phase-18.md), starting with 18a** — invoke `timone-execute` on it. 18a is `src/channels/terminal.ts` and its test, and is the copy every later slice points at.

Two things the executing session must read before starting: the phase file's **"The live tickets, as they stand"** section (18e's step 1 is already done, and its shape changed as a result), and the **wayfinder-tickets-join-the-marked-set** decision under "Load-bearing decisions".

## Open questions

- **Does the daemon serializing one run per project ([R10](../specs/prd/prd-02-inversion-of-control.criteria.md)) fit a nine-ticket map?** A map's frontier is often three or four tickets a human could answer in any order, but the daemon will hold one at a time per project. Nobody has decided whether that is right or merely tolerable. It does not block phase 18 — the written path works regardless — and it becomes real the first time two frontier tickets are answered the same day. **Resolved by:** fvermaut, once he has actually used it.
- **Nothing picks up a written answer until phase 18 lands.** If fvermaut answers #5, #6 or #9 in the meantime, a session must be told to go and read it. **Resolved by:** the build, or by him saying he has answered.
- **The `ivtrends` ticket bodies refer to each other by bare number** (`#8`, `#5`), which `timone-wayfind`'s "refer by name" rule forbids in everything a human reads. Pre-existing, noticed while doing the CTA work, deliberately not fixed — nobody asked. **Resolved by:** a one-pass edit whenever someone wants it.
- **R11 and R17 remain PRD-02's two long-standing gaps**, unchanged by this session: R11 is one clause short, R17's output-token counter is still frozen and still unexplained.
