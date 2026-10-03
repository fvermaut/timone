# Breakdown

**Status:** Awaiting approval

1. **Numbered files never take the same number** — two tickets worked at the same time never give a phase file, an ADR or a triage record the same number.
   - Delivers PRD-07 R8, clause 1.
   - Needs: nothing.
2. **STATUS.md and the requirement registers stop conflicting** — when one pull request merges, another that changed the same `STATUS.md` or register is brought level without a person, and nothing either wrote is lost.
   - Delivers PRD-07 R8, clauses 2 and 3.
   - Needs: nothing. It can be built at the same time as piece 1.
3. **The project is free when the pull request opens** — a ticket with an open pull request, or one waiting for a person, no longer stops the next ticket of its project from building.
   - One ticket still builds at a time. A freed turn goes to one ticket only: `priority:high` first, then the oldest.
   - A ticket with an open pull request keeps its run and is not picked up again. A takeover is allowed while another ticket builds.
   - Records the decision that replaces the rule of ADR-0026, and removes that rule from `process.md` and the requirements it changes.
   - Delivers PRD-07 R1, R3, R9, R13, R2 except the number of places, and R12 for what it changes. Covers #181 (R9) and #184 (R3).
   - Needs: pieces 1 and 2.
4. **The update after a merge** — after a pull request merges, every other open pull request of the project is brought level, fixed and tested again, and says on top what had to change.
   - The same happens to a pull request that opens behind the default branch.
   - Delivers PRD-07 R7 and R14.
   - Needs: piece 3. It can be built at the same time as piece 5.
5. **Two places and the planner** — each project builds up to 2 tickets at once, or the number `timone.yaml` sets, and the planner decides from each plan which ticket may start.
   - A held ticket says on the ticket what it waits for and why. A named person can overrule.
   - Every open step ticket that is not blocked may build, not only the first one.
   - Delivers PRD-07 R2's number of places, R4, R5, R6, and R12 for what it changes.
   - Needs: piece 3. It can be built at the same time as piece 4.
6. **The list of pieces shows what is built at the same time** — a list of pieces shows its order in plain words, and the step tickets it opens wait for each other exactly as that order says.
   - Delivers PRD-07 R10 and R11.
   - Needs: none of the others. It is last because it is only useful once several tickets build at once.

**Order:** 1 and 2 together, then 3, then 4 and 5 together. 6 needs none of the others.

**Why the planner and the second place are one piece:** a second place without the planner would let two tickets that change the same files build at once on every project, ivtrends included, with nothing to hold one back.

**Until pieces 3 and 5 have merged, these pieces are built one after the other, in this order.** The machine that builds them still works on one ticket of a project at a time, and it opens step tickets that each wait for the one before.
