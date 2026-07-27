---
name: timone-verify
description: Stage 7 (Verification) of the Timone process — on a managed project, check a completed phase's observable behaviour against the criteria register from a context that did not watch the build, per channel (api / browser / human), write the verification report, run the bounded verify-fix loop, and flip the register statuses. Use when a phase file is stamped `Complete`, when execution's closing hands over to verification, or when the user says "verify phase NN", "run verification", or "check the delivered phase".
argument-hint: <project-name> <phase-ref: phase-NN or a path to the phase file>
---

# Timone Stage 7 — Verification

You did not watch the build, and that is the point. The register is the only source of expected behaviour; you trust the running app, never source-code intent, never the builder's word. Stage 6 already believes the work is correct — your job is to find out whether the application, as it actually runs, does what the register promised, and to be the only stage that writes the register's `Status` field. The process spec (`process.md`, stage 7) is normative; when this skill and the spec disagree, the spec wins.

**Standalone and from-execution are the same invocation.** `timone-execute`'s closing hands over a command line, not a mode: there is no privileged path from execution, no extra context it may pass you, and nothing it could tell you that you would be allowed to use. Whoever invokes this skill, the rules below are identical.

## Target-project resolution (do this first)

1. The target project is the one named in the invocation argument or prompt.
2. If no project is named: read `timone.yaml`, list the project names, and **ask** the user to pick. Never guess.
3. Validate the name against `timone.yaml`. Unknown name → abort, listing the valid names.
4. Check `projects/<name>/` exists on disk. Not cloned → abort, suggesting `node dist/cli.js workspace sync`.
5. From here on, every file you read or write lives under `projects/<name>/…` — the only exceptions are *reading* timone's own `process.md`, `standards/`, and `timone.yaml`.
6. In loop mode (daemon-initiated sessions), the target project arrives in the event context; the same validation applies.

## Input

A project name plus a phase reference: `phase-01`, `01`, or a path to the file. Resolve it to exactly one file under `projects/<name>/doc/plans/phases/phase-NN.md`. Ambiguous or missing → say which files exist and stop; never pick a phase for the user.

## Read before you verify — and what you must never read

Your independence is a **closed allowed list**; anything not on it is not read, and the report declares what was read. Expected behaviour comes only from the register. The completion report supplies operational facts — how to run the app, carried-forward HUMAN-CHECKs, state left behind — never expected values; if it seems to tell you what a behaviour *should* be, the register is the authority and the discrepancy is a finding.

**Read:**

- **The criteria register(s)** (`doc/specs/prd/*.criteria.md`) for the requirement IDs in scope — the behaviour the app owes, clause by clause. This is the whole of your expectation.
- **The PRD narrative** the register belongs to — for the domain framing the criteria assume, not for extra requirements.
- **The phase file's `Status` line and requirements header** — the stamp is the entry gate, the header (its requirement IDs, or its un-anchored stamp) is the claimed scope. **Never the sub-phase bodies**: they describe how the thing was built, which is exactly what you must not know.
- **The completion report, whole** (`doc/plans/phases/reports/phase-NN-complete.md`) — it is the stage-6→7 interface, and its "context for the next agent" section was written for you: run instructions, suite commands, HUMAN-CHECK items carried forward, known-open observations, state left behind. Obey its stated gotchas rather than rediscovering them.
- **`README.md`, `CONTEXT.md`, `doc/standards.md`, `STATUS.md`** in the target project — operational instructions, the domain's canonical terms, the conventions record (whose open non-conformances may already predict a failure), and the status file you are obliged to update at the end.
- **The operational configuration that stands the app up rather than implementing it** — compose files, `.env` / `.env.example`, the run and test scripts a package manifest declares. These tell you which port, which credentials, which command; they carry no behaviour under test. Reading the *application* config a criterion's behaviour depends on is a different act and stays forbidden.
- **Timone's own `standards/` baseline** — the accessibility and UI/UX entries are what the browser channel's baseline leg enforces.

**Never read:**

- **`phase-NN-handoffs.md`** — the build narrative. One line of it and you know how the thing was made.
- **Diffs, `git show` of code, `git log -p`** — source intent in another costume.
- **Anything under the source tree, including the committed test suite.** The suite encodes the builder's understanding of the requirements; verifying against it verifies the builder against the builder.
- **ADRs** — build intent. Observable behaviour does not need them.

The project's own suite may be run **once**, as a build-health smoke, and reported as exactly that — it is never criterion evidence. All evidence comes from probes you author yourself, from the register's clauses alone, written in scratch space **outside the project tree** and never committed.

**A smoke that contradicts a probe is an instrument alarm, not a footnote.** When the build-health smoke fails on behaviour one of your probes passes — or passes behaviour your probes fail — one of the two instruments is measuring wrong, and the pass may not conclude until you know which. Resolve it instrument-side: re-calibrate your probe and prove what it actually transmits and observes. The suite stays non-evidence either way; what it is here is a tripwire, and filing the contradiction as "a discrepancy for the human" while your verdicts stand is exactly the false-negative path this rule exists to close.

## The gates

Each gate stops verification. When one fires you write **nothing** into the project, state which gate fired and why in one short paragraph, and name the skill or the human to route to. A stopped verification is a valid, complete outcome of this skill.

**1 — Completion gate.** A phase file not stamped `Complete — see …` is not verifiable — there is no completion report to run the app from, and stage 6's own validation has not finished vouching for the branch. Route to **`timone-execute`** when the phase is mid-execution or never started; route to the **human** when the state is unclear. Never verify "the parts that are done".

**2 — Register gate.** No criteria register covering the phase's claimed IDs, and no un-anchored stamp in the phase file's header, means there is nothing to verify against. Route to **`timone-prd`** (missing register) or **`timone-plan`** (missing anchoring statement). An un-anchored stamp is not this gate firing — see Scope below.

**3 — Environment gate.** The environment will not come up per the completion report's instructions — a container that won't start, a port that's taken, a missing local dependency. Every in-scope criterion is **BLOCKED**: the report is written saying so, no probe runs, no register line changes, no fix loop is consumed — a fix loop is for behaviour that is observably wrong, and BLOCKED asserts nothing about behaviour. Route to the human with what failed to start and the exact command that failed.

## The branch

- **Verify at the phase branch's HEAD** (`phase-NN-<slug>`). Refuse a dirty working tree — report what is dirty; never stash or reset around it.
- **When the phase stacks on a phase whose verification commits are absent from its ancestry, merge that branch in first and say so** in the report. A stacked phase cut before its parent was verified cannot see the parent's register flips, so its regression computation would read stale `draft` statuses and silently verify nothing. The merge is recorded as part of the environment, not hidden.
- **Leave the clone on the verified branch, clean.** Your probes live outside the tree, so nothing of yours should be left behind.
- **Re-verifying an already-reported phase appends an iteration section** to the existing report — dated, with its own verdict table — never a second file. The register reflects the latest iteration.

## Scope

A pass covers, and the report lists, both of:

1. **The claimed set** — the requirement IDs the phase file's header carries (cross-checked against the completion report's requirements line).
2. **The standing regression set** — derived at verify time from the register(s), never maintained anywhere: every criterion with priority **MUST**, verify-via **`api`**, and status **`verified`**, as the register stands at the phase branch's HEAD. List the derived set explicitly, even when empty, so the computation audits.

**An un-anchored phase** (stamped so in its header, per stage 5) claims nothing by design: the pass is the regression set plus the carried-forward HUMAN-CHECK items from the completion report, and the gate degenerates to **zero regressions**. Stage 6's validation already covered the un-anchored deliverable itself; do not invent criteria for it.

## The environment

Stand the app up **in its production form** where the stack distinguishes one — a production build, never the dev server. The dev server forgives what production does not (unbuilt assets, lazy prerendering, development-only error overlays), and every one of those forgivenesses is a way to verify a behaviour the user will never receive. The completion report's run instructions are the recipe; its stated gotchas (seed ordering, ports, hostnames) are binding operational facts. When build order matters to what a page shows — prerendering, caching, revalidation windows — say in the report what order you used and why.

## The channels

Each criterion carries a `Verify-via` channel; each of its clauses gets its own outcome.

- **`api`** — terminal-checkable. Author your own probes from the clause alone: HTTP against the running app, direct database readback through the project's own client tooling. Scripts live in scratch space, never in the tree, never committed. This channel forms the standing regression suite.
- **`browser`** — driven UI checks (Playwright, or the playwright MCP tools). For **user-facing deliverables the baseline leg is unconditional**: the automated accessibility scan (violations are failures — the baseline's rule, enforced here), a keyboard-only pass in which focus assertions are mechanical (where `document.activeElement` lands after each action is a fact, not a judgement), and the baseline's reflow checks. Where tooling cannot reach a baseline requirement, that clause becomes a HUMAN-CHECK with a precise script — never a silent skip, never an assumed pass.
- **`human`** — reported as **HUMAN-CHECK** with a precise manual script in the template below: setup, numbered steps, the expected observation, where to record the result. Emitting the script *is* this channel's deliverable; performing it is the human's act, on the human's schedule. Never simulate one, never mark one performed on your own authority.

**Calibrate the instrument before trusting it.** A probe that cannot fail is not evidence. Before a probe's verdict counts, show it could have detected the failure it exists to catch — above all when the clause asserts a transformation of input (trimming, normalization, rejection): first prove the probe delivers its input **verbatim** to the app's boundary, because transport tooling silently normalizes (a multipart flag that strips padding, a shell that eats quotes, a client that URL-encodes), and a probe that pre-applies the expected transformation can only agree with the app. This is the verification-side twin of stage 6's tautological-assertion rule: a probe passing on arrival, never having been seen to distinguish conforming from non-conforming behaviour, deserves the same suspicion as a test never seen red.

## The fix loop

**You never fix.** Fixing means reading source, and a verifier that has read the fix has build knowledge for the re-verify. The loop:

1. Every FAIL (and REGRESSION) in the pass produces a **defect brief** in the template below — written from observation, quoting the register's clause, never speculating about cause in the code.
2. A **fresh fix context** receives the brief, the repository, and `doc/standards.md`; it implements, commits `fix: verify NN — <criterion-id> <slug>` on the phase's branch, and returns the commit SHA plus a one-paragraph note. You ingest **only the SHA** — never its transcript, never its diff.
3. **One full re-verify** — everything in scope except already-scripted HUMAN-CHECKs. A fix is a code change made by a context that did not watch the build; nothing short of a full re-run is defensible, because you cannot know what else it touched without reading it.
4. That brief-fix-reverify cycle is **one loop**. **Max 2 loops after the initial pass.** At exhaustion: remaining failures recorded with evidence, their register lines flipped to `failed`, and the work goes to the human via stage 9 — the report's handed-to-the-human section says exactly what remains and why. (`timone-improve`, stage 9's skill, does not exist yet — phase 09 and later; name it anyway and hand the human the report.)

**Mechanism is an example, never a requirement.** Today the obvious instrument for the fix context is a sub-agent spawned from this session with the brief as its prompt; PRD-02's daemon will spawn the same contract through the Agent SDK. Anything that receives those inputs and returns a SHA satisfies the contract.

```markdown
## Defect brief — <criterion-id>, loop <N>

- **Criterion:** <the GIVEN/WHEN/THEN clause, quoted verbatim from the register>
- **Expected (per the register):** <the observable outcome the clause demands>
- **Observed:** <what the running app actually did — facts, no cause analysis>
- **Reproduction:** <exact commands or steps, from a clean start, that show the failure>
- **Evidence:** <the probe output or artifact demonstrating the observation>
- **Constraint:** commit as `fix: verify NN — <criterion-id> <slug>` on `phase-NN-<slug>`; conform to `doc/standards.md`; change nothing the brief does not require.
```

## Verdicts and the register

**Verdicts:** PASS / FAIL / HUMAN-CHECK / BLOCKED. **REGRESSION** is the FAIL variant reserved for a criterion that entered the pass already `verified` — same failure class, counts against the gate's zero-regressions clause, consumes the same fix loop; the distinct label exists because shipped behaviour broke and stage 9 reads it differently. **BLOCKED** asserts nothing about behaviour: register untouched, gate blocked, human routed, no loop consumed.

**Only this stage writes the register's `Status` field** — once per pass, at pass conclusion, never mid-pass, in the same commit as the report: `docs: verify phase NN — <theme>` on the phase's branch. The report-flip coupling in one commit is the evidence link; the register line itself stays bare.

- `draft` → `verified` on PASS.
- `draft` → `failed` at loop exhaustion.
- `verified` → `failed` on an unresolved REGRESSION, with a dated `✏` marker naming the report.
- A requirement carrying an unperformed HUMAN-CHECK clause stays `draft`, with a dated partial-evidence marker linking the report and the script — a requirement's status is the weakest of its clauses' outcomes, and a script nobody has run is not evidence.

**The closing gate, restated from the spec:** all MUST criteria PASS or HUMAN-CHECK, zero regressions, within 2 verify-fix loops.

## The verification report

`projects/<name>/doc/plans/phases/reports/phase-NN-verification.md`. Every element below is required; iterations append.

````markdown
# Phase NN — Verification Report

- **Date:** <YYYY-MM-DD>
- **Phase:** [phase-NN.md](../phase-NN.md) — stamped `Complete`, completion report [phase-NN-complete.md](phase-NN-complete.md)
- **Scope:** <claimed IDs, or "un-anchored (stamped <date>, <who>) — regression set only">
- **Regression set (derived):** <the MUST+api+verified IDs at this HEAD, or "empty — nothing verified before this pass">
- **Branch:** `phase-NN-<slug>` @ `<sha>` <— plus "merged in `phase-MM-<slug>` first: its verification commits were absent from this branch's ancestry" when that applied>

## Environment

<How the app was stood up, in production form: the commands, the order, and why the order mattered when it did. The build-health smoke's one-line result, reported as such.>

## Independence declaration

Read: <the allowed-list artifacts actually read, by path>. Not read: handoffs, diffs, source, the committed test suite, ADRs. No implementation source was read; all criterion evidence below comes from verifier-authored probes.

## Verdict summary

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-NN.R<k> | MUST | api | PASS | 0 |

## Evidence

### PRD-NN.R<k> — <verdict>

<Per clause: the probe as run, its output trimmed to what carries the evidence, and the clause's outcome. For a FAIL fixed in-loop: the failing observation, the fix commit SHA, and the re-verify observation.>

## HUMAN-CHECK scripts

### HUMAN-CHECK — <criterion-id>, <clause>

- **Setup.** <the state to stand up first>
- **Steps.** <numbered, precise, no judgement calls>
- **Expected.** <what the human must observe for the clause to pass>
- **Record.** <where the result lands: this report's next iteration, and the register marker to update>

## Regression

<The derived set's results, one line per ID — or "The derived regression set is empty; nothing to re-run." Stated, never omitted.>

## Fix-loop accounting

<N of 2 loops consumed. Per loop: the briefs issued, the fix commits returned, the full re-verify's outcome. "0 of 2 — the initial pass was clean." when so.>

## Register changes

<Every `Status` flip and marker written this pass, by ID — or "None: <why>.">

## Handed to the human

<Only when anything remains: what, the evidence, and that it routes via stage 9. Omit the section when nothing does.>
````

## Status reporting

Before finishing, update the target project's `STATUS.md` — plain language: what was checked, what passed, what failed and got fixed, what is waiting on the human (every unperformed HUMAN-CHECK script belongs there), always naming which repository each item sits in. When verifying Timone's own work, the same obligation lands on Timone's root `STATUS.md`.

## Workflow

1. Resolve the target project, then the phase reference, to one file.
2. Read the allowed list — and nothing else.
3. Check gate 1 (completion stamp) and gate 2 (register or un-anchored stamp). If either fires, stop, route, write nothing.
4. Check out the phase branch; merge in an unancestored parent's verification commits when stacked; refuse dirt.
5. Derive the scope: claimed set + computed regression set. List both.
6. Stand up the environment in production form (gate 3 if it will not come up — everything BLOCKED, report, stop).
7. Check every in-scope criterion per its channel; write HUMAN-CHECK scripts where only a human can look.
8. FAILs → defect briefs → fresh fix context → full re-verify. Max 2 loops, then exhaustion protocol.
9. Write the report and flip the register in one `docs: verify phase NN — <theme>` commit. Update `STATUS.md`.
10. Report per Closing below.

## Closing

Report to the user, in this order:

1. The gate outcome, if one fired: which gate, why, and the exact next invocation — then stop, nothing below applies.
2. The scope verified — claimed set, derived regression set — and the verdict table.
3. Fix loops consumed, with the fix commit SHAs.
4. The report's path, and every script waiting on a human.
5. Anything handed to the human via stage 9.
6. The next invocation: `/timone-deliver <project>`.

`timone-deliver` (stage 8) does not exist yet — it arrives in phase 09. Name it anyway, as every other stage skill names its successor; a stage that hides the next one leaves the human to remember the process.

Verification observes and reports. It never fixes with its own hands, never merges, and never opens a PR. Stop here.
