# Breakdown

**Status:** Awaiting approval

In this list, "the check folders" are the two `probes` folders listed in `PROBE_DIRECTORIES` in `src/daemon/probeGuard.ts`, as in [PRD-10](../../specs/prd/prd-10-the-probe-guard-knows-the-step-in-a-container.md).

1. **The guard judges only real reads and writes** — text that only names the check folders passes; a real read, list, run or write of a check script is still judged.
   - Prompts to helpers, commit messages, ticket and pull request text, and text written into another file all pass, for every kind of session.
   - The file tools, and shell commands that read, list, copy, run or write a file in the check folders, are still judged, also when joined to a command that passes.
   - Fixes the three refused calls of #192 on the host.
   - Delivers PRD-10 R4 and R5.
   - Needs: nothing.
2. **Each container knows its step, and the guard uses it** — the container is told its step, and the guard reads it there when the ledger has no run for the session.
   - The checking step in a container writes and runs its check scripts without being asked. The builder in a container is refused them.
   - In a container the guard never asks. A declaration made with `timone stage` changes nothing there, and `timone stage` says so.
   - Holds the test #87 asks for: the guard command itself, run with an empty ledger and a container's environment, for a checking step and for a building step.
   - Delivers PRD-10 R1, R2, R3, R6 and R7. R8 is checked on the next supervised run after it lands.
   - Needs: piece 1.

**Order:** 1, then 2.

**Why piece 1 comes first:** once a container knows its step, the builder there is refused every call whose text names the check folders, including the prompt the build instructions require. With piece 1 landed first, the builder is refused only real reads and writes.

**Why piece 2 is one piece:** telling the container its step does nothing until the guard reads it. Split, the first half would change no behaviour that can be checked.

**Three choices PRD-10 left open.** fvermaut approved PRD-10 without answering them, so the proposed answers stand. Any of them can be changed when this list is approved.

- **In a container, a step that neither builds nor checks is refused the check scripts** (R3, piece 2). Refusing cannot leak a check to a builder, and no other step uses them today.
- **A script handed to `python`, `node` or a shell as text is still judged by all of its text** (R5, piece 1). The guard cannot tell what such a script will do. To write text that names a check folder into another file, a step uses the file tools or a plain shell write.
- **A tool the guard has no rule for is still judged by all of its input text** (R5, piece 1). A new tool is covered the day it appears, at the cost of an occasional refusal until a rule is written for it.
