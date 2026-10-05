# Breakdown

**Status:** Approved by fvermaut 2026-10-05 — 2 pieces

1. **A takeover waits for the running step** — `timone takeover` typed while a step of its ticket runs waits for that step to end, then opens the session.
   - At the terminal it says which step it waits for, and that Ctrl-C stops the wait. Stopping changes nothing on the run.
   - The runner starts no other step on the ticket between the step's end and the session opening.
   - With no daemon running, it says so and does not wait.
   - `process.md` and PRD-05 R11 stop saying that a takeover refuses while a step runs.
   - Delivers PRD-09 R4, and R5 for the takeover paragraph.
   - Needs: nothing.
2. **Every question names the command** — each question the machine asks, on a ticket or a pull request, carries `timone takeover <project>#<n>` in code formatting, and says the person can answer in writing or in the terminal.
   - Reaches every way a question is written: the messages code writes, the runner's post action, each step's own comments, and a question carried to the pull request.
   - Leaves the command out for a missing key, a misspelled "approve", and after a terminal session that ended without settling the question.
   - `timone status` still shows what a question asks.
   - The runner's instructions, the step instructions, `process.md` and the step skills say the same.
   - Delivers PRD-09 R1, R2, R3, and R5 for the rules on asking.
   - Needs: piece 1.

**Why piece 1 comes first:** a message may not name a command the machine would refuse. Until the takeover waits, a command copied from a fresh question can be refused, because the step that asked is still ending.

**Why piece 2 is one piece:** the rule and its three exceptions are the same for every way a question is written. Split by way of posting, the written rules would describe the machine wrongly between the pull requests.
