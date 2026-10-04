# Breakdown

**Status:** Approved by fvermaut 2026-10-04T13:41:15Z — 1 piece

1. **Every ticket the machine opens names the project's people** — the tickets opened for the pieces of an approved list, and the issues the runner files on Timone, carry `@` and the login of each person `namedPeople` gives for the project, so GitHub notifies them of the ticket and of every comment on it after; the instructions for charting a large piece of work tell the session to do the same on the tickets it opens.
   - The names are added by code, in one place both paths use. A Timone issue names the people of the `timone` project, never those of the project where the fault was seen.
   - Nobody is assigned. A project that names nobody still gets its ticket, with no name in it.
   - Delivers PRD-08 R1, R2, R3, R4, R5 and R6. R6 is checked on a live run on scratch-app.
   - Needs: nothing.

**Why one piece:** the two code paths share the code that writes the names, and the change to the charting instructions is a few lines. Split, each part would be a pull request too small to be worth a review of its own.
