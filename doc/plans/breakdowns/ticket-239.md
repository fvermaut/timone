# Breakdown

**Status:** Awaiting approval

In this list, "the check folders" are the two `probes` folders listed in `PROBE_DIRECTORIES` in `src/daemon/probeGuard.ts`, as in [PRD-13](../../specs/prd/prd-13-a-takeover-is-not-asked-about-check-scripts.md).

1. **A takeover is marked, and the guard lets it work on check scripts** — `timone takeover` starts Claude with a mark naming the ticket, and the guard allows that session to read and change check scripts without asking.
   - `timone takeover` passes the mark to the Claude it starts, and to no process when it refuses or the wait is stopped. A project's environment file cannot set the mark.
   - In a takeover on the host, the guard allows every read, list, run and write of a check script, including the `git ls-tree` call shown on #239, and the calls that resolve a merge conflict in one. It never asks there.
   - A building step stays refused: a session the ledger places as building, any session in a container, and a takeover that declares `execution` or `remediation` with `timone stage`.
   - A person's own session without the mark, or with it empty, is still asked.
   - Holds the test that runs the guard command itself with an empty ledger and the takeover's environment, and the same calls asked when the mark is left out.
   - `timone stage` tells a takeover that it may already read and change the check scripts.
   - Delivers PRD-13 R1 to R7. R8 is checked in a real takeover after it lands.
   - Needs: nothing.

**Order:** 1.

**Why one piece:** the mark does nothing until the guard reads it, and the guard reading it does nothing until `timone takeover` sets it. Split in two, neither half would change anything a person could see. The change to `timone stage` is a few sentences next to the same rule, and a pull request of its own would cost more review than it saves.

**Three choices PRD-13 left open.** fvermaut approved PRD-13 without answering them, so its written answers stand. Any of them can be changed when this list is approved.

- **A takeover that declares a building step with `timone stage` is refused** the check scripts. Any other declaration in a takeover changes nothing.
- **A helper started inside a takeover is judged as the takeover**, because it carries the takeover's environment.
- **A container ignores the mark.** A session in a container is judged by its step only, as PRD-10 says.
