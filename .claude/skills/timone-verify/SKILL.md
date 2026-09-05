---
name: timone-verify
description: Stage 7 (Verification) of the Timone process — on a managed project, check a completed phase's observable behaviour against the criteria register from a context that did not watch the build, per channel (api / browser / human / live), write the verification report, run the bounded verify-fix loop, and flip the register statuses. Use when a phase file is stamped `Complete`, when execution's closing hands over to verification, or when the user says "verify phase NN", "run verification", or "check the delivered phase".
argument-hint: <project-name> <phase-ref: phase-NN or a path to the phase file>
---

# Timone Stage 7 — Verification

You did not watch the build, and that is the point. The register is the only source of expected behaviour; you trust the running app, never source-code intent, never the builder's word. Stage 6 already believes the work is correct — your job is to find out whether the application, as it actually runs, does what the register promised, and to be the only stage that writes the register's `Status` field. The process spec (`process.md`, stage 7) is normative; when this skill and the spec disagree, the spec wins.

**Everything you put in front of the human follows [Writing to the human](../../../process.md#writing-to-the-human).** Short sentences, plain words, no process vocabulary — no stage numbers, no skill names, nothing a reader would need `process.md` to understand. A ticket comment is a few sentences and under 150 words. Specifications, requirements and technical detail are **links** to committed artifacts, never text on a ticket. Every message ends with a call to action, and "no action needed" is one.

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
- **A prior verification report's `## HUMAN-CHECK scripts` section, and nothing else of it** (`doc/plans/phases/reports/phase-MM-verification.md`) — when the completion report carries a HUMAN-CHECK forward, it names where the script lives rather than restating it, and this stage is required to re-issue such scripts **verbatim**. Without this the obligation could not be discharged from the allowed list at all. It is safe because a verification report is a stage-7 artifact written under these same rules: it carries evidence and scripts, never build knowledge. **Read that section alone** — the rest of the file holds another pass's verdicts and probe design, and reading them is how a verifier starts confirming its predecessor instead of the running app. Declare the line range you opened.
- **`README.md`, `CONTEXT.md`, `doc/standards.md`, `STATUS.md`** in the target project — operational instructions, the domain's canonical terms, the conventions record (whose open non-conformances may already predict a failure), and the status file you are obliged to update at the end.
- **The operational configuration that stands the app up rather than implementing it** — compose files, `.env` / `.env.example`, the run and test scripts a package manifest declares. These tell you which port, which credentials, which command; they carry no behaviour under test. Reading the *application* config a criterion's behaviour depends on is a different act and stays forbidden.
- **Timone's own `standards/` baseline** — the accessibility and UI/UX entries are what the browser channel's baseline leg enforces.
- **Your own probe directory, `doc/plans/phases/probes/`** — the probes previous verification passes committed. It is yours: only this stage writes there, and stage 6 is blocked from reading it. See The probes below.
- **Timone's shared baseline probes, `standards/baseline/probes/`** — the accessibility and UI/UX checks every project's browser channel runs.

**Never read:**

- **`phase-NN-handoffs.md`** — the build narrative. One line of it and you know how the thing was made.
- **Diffs, `git show` of code, `git log -p`** — source intent in another costume.
- **Anything under the source tree, including the committed test suite.** The suite encodes the builder's understanding of the requirements; verifying against it verifies the builder against the builder.
- **ADRs** — build intent. Observable behaviour does not need them.

The project's own suite may be run **once**, as a build-health smoke, and reported as exactly that — it is never criterion evidence. All criterion evidence comes from probes authored by a verifier — this pass or an earlier one — from the register's clauses alone.

**A smoke that contradicts a probe is an instrument alarm, not a footnote.** When the build-health smoke fails on behaviour one of your probes passes — or passes behaviour your probes fail — one of the two instruments is measuring wrong, and the pass may not conclude until you know which. Resolve it instrument-side: run the probe's break step and prove what it actually transmits and observes. The suite stays non-evidence either way; what it is here is a tripwire, and filing the contradiction as "a discrepancy for the human" while your verdicts stand is exactly the false-negative path this rule exists to close.

## The gates

Gates 1 and 2 stop verification, exactly as before: you write **nothing** into the project, state which gate fired and why in one short paragraph, and name the skill or the human to route to. Gate 3 no longer does: ✏ since [ADR-0052](../../../doc/adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md), it blocks the affected criteria, records a departure, and lets the pass continue to its ordinary completion — see gate 3 below. A stopped verification, at gate 1 or gate 2, is a valid, complete outcome of this skill.

**1 — Completion gate.** A phase file not stamped `Complete — see …` is not verifiable — there is no completion report to run the app from, and stage 6's own validation has not finished vouching for the branch. Route to **`timone-execute`** when the phase is mid-execution or never started; route to the **human** when the state is unclear. Never verify "the parts that are done".

**2 — Register gate.** No criteria register covering the phase's claimed IDs, and no un-anchored stamp in the phase file's header, means there is nothing to verify against. Route to **`timone-prd`** (missing register) or **`timone-plan`** (missing anchoring statement). An un-anchored stamp is not this gate firing — see Scope below.

**3 — Environment gate.** The environment will not come up per the completion report's instructions — a container that won't start, a port that's taken, a missing local dependency. Every in-scope criterion is still **BLOCKED**: the report is written saying so, no probe runs, no register line changes, no fix loop is consumed — a fix loop is for behaviour that is observably wrong, and BLOCKED asserts nothing about behaviour. ✏ Since [ADR-0052](../../../doc/adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md), this no longer stops the pass: record a departure naming what failed to start and the exact command that failed, and let the pass continue for whatever in scope does not depend on the environment coming up. The stage still posts its ordinary completion, and the run proceeds to delivery.

## The branch

- **Verify at the phase branch's HEAD** (`phase-NN-<slug>`). Refuse a dirty working tree — report what is dirty; never stash or reset around it.
- **When the phase stacks on a phase whose verification commits are absent from its ancestry, merge that branch in first and say so** in the report. A stacked phase cut before its parent was verified cannot see the parent's register flips, so its regression computation would read stale `draft` statuses and silently verify nothing. The merge is recorded as part of the environment, not hidden.
- **Leave the clone on the verified branch, clean.** Your probes are committed with the report, so the only thing left behind is the artifact you meant to leave; scratch working files stay outside the tree.
- **Re-verifying an already-reported phase appends an iteration section** to the existing report — dated, with its own verdict table — never a second file. The register reflects the latest iteration.

## Scope

A pass covers, and the report lists, both of:

1. **The claimed set** — the requirement IDs the phase file's header carries (cross-checked against the completion report's requirements line).
2. **The standing regression set** — derived at verify time from the register(s), never maintained anywhere: every criterion with priority **MUST**, verify-via **`api`**, and status **`verified`**, as the register stands at the phase branch's HEAD, **narrowed to those whose declared dependencies this phase's diff touches**. List the derived set explicitly, even when empty, **and list what the narrowing removed**, so the computation audits.

**The narrowing, in full** ([ADR-0051](../../../doc/adr/0051-timone-verifies-itself-by-live-gate-and-a-regression-set-is-narrowed-by-what-it-depends-on.md) D4). A criterion may carry a `Depends-on:` line listing repository path prefixes. When it does, it is in the set only if the phase's diff touches one of them. **A criterion with no `Depends-on` is always in scope** — so a register nobody has annotated behaves exactly as it always did, and narrowing is something somebody chose, never something that happened.

Declared rather than inferred, and this is the whole reason the field exists: a rule reading the diff's own paths gets it wrong in both directions. A fourteen-line change to `standards/baseline/ui-ux.md` cannot break *"the daemon picks up a marked ticket"*, and it is precisely what could break *"the accessibility baseline is mandatory"*. Only the criterion knows what it rests on.

**Under-declaring is the risk, and it is a regression escaping.** A criterion whose dependencies are not confidently known carries no line at all.

**An un-anchored phase** (stamped so in its header, per stage 5) claims nothing by design: the pass is the regression set plus the carried-forward HUMAN-CHECK items from the completion report, and the gate degenerates to **zero regressions**. Stage 6's validation already covered the un-anchored deliverable itself; do not invent criteria for it.

## The environment

Stand the app up **in its production form** where the stack distinguishes one — a production build, never the dev server. The dev server forgives what production does not (unbuilt assets, lazy prerendering, development-only error overlays), and every one of those forgivenesses is a way to verify a behaviour the user will never receive. The completion report's run instructions are the recipe; its stated gotchas (seed ordering, ports, hostnames) are binding operational facts. When build order matters to what a page shows — prerendering, caching, revalidation windows — say in the report what order you used and why.

**The server command does not return, so never run it in the foreground.** `npm start`, `npm run dev` and their equivalents block until killed: run them detached (backgrounded), then wait for the port to answer before probing — poll with `curl` rather than sleeping a fixed time. A verifier that runs the server in the foreground hangs until something kills it, and produces no report and no evidence at all, which is indistinguishable from the pass having failed. Every other command in a verification pass — the build, the seed, the database bring-up, the probes themselves — returns normally. Kill the server when the pass ends.

## The channels

Each criterion carries a `Verify-via` channel; each of its clauses gets its own outcome.

- **`api`** — terminal-checkable. HTTP against the running app, direct database readback through the project's own client tooling. Run the criterion's committed probe when one exists; author it from the clause alone when it does not. This channel forms the standing regression suite, and it is the one the saved probes pay off on.
- **`browser`** — driven UI checks (Playwright, or the playwright MCP tools). For **user-facing deliverables the baseline leg is unconditional**: the automated accessibility scan (violations are failures — the baseline's rule, enforced here), a keyboard-only pass in which focus assertions are mechanical (where `document.activeElement` lands after each action is a fact, not a judgement), and the baseline's reflow checks. **Do not write these yourself** — they are Timone's, at `standards/baseline/probes/`, they take a page address, and they are the same for every project. Write a project probe only for what the project's own criteria assert. Where tooling cannot reach a baseline requirement, that clause becomes a HUMAN-CHECK with a precise script — never a silent skip, never an assumed pass.
- **`human`** — reported as **HUMAN-CHECK** with a precise manual script in the template below: setup, numbered steps, the expected observation, where to record the result. Emitting the script *is* this channel's deliverable; performing it is the human's act, on the human's schedule. Never simulate one, never mark one performed on your own authority.
- **`live`** ✏ Added 2026-09-04 ([ADR-0051](../../../doc/adr/0051-timone-verifies-itself-by-live-gate-and-a-regression-set-is-narrowed-by-what-it-depends-on.md) D1) — what only a **supervised run against real infrastructure** can observe: a real daemon, real credentials, a real forge, real containers, real managed projects. Reported as **LIVE-GATE**.

  **You never perform one.** The deliverable is a line naming the report that last observed it, read from the criterion's own `Last live gate:` field, plus a statement of whether this phase owes a fresh gate — it does when its diff touches what the criterion declares it depends on. Never author a probe for it, never write a manual script for it, never flip its status.

  **It is not `human`, and the difference is the performer.** *"The daemon picks up a marked ticket and opens a pull request on somebody else's repository"* is not something a person does by reading steps off a page; it is a machine run with a person watching. Writing a script for it would name the wrong performer and would be simulated in practice, which is the failure `human` already forbids.

  **It is not `BLOCKED` either.** BLOCKED means the check could not run and the gate stops. A `live` criterion is not expected to run here, so it does not block: it reports its last gate and the pass continues.

## The probes

A probe is a **committed artifact of this stage**, at `projects/<name>/doc/plans/phases/probes/<criterion-id>.<ext>` — one file per criterion, beside the reports, never in the source tree and never in the project's own test directories. It goes into the same `docs: verify phase NN — <theme>` commit as the report and the register flip.

**Author fresh, then run.** A probe is written from the register's clauses the first time its criterion is checked. Later passes **run** it — you do not re-derive it, and re-deriving it by hand is the cost this exists to remove. Throw it away and write it again from the register when the criterion's status is `revised`: changed intent makes the old probe stale by definition.

Reading a probe a previous verifier wrote is the same carve-out this skill already grants HUMAN-CHECK scripts — a stage-7 artifact carries evidence and scripts, never build knowledge. **It does not extend to the builder's suite**, which stays unreadable for the reason it always was.

**Red before green — a probe's pass counts only after the probe has been seen to fail, in this run, on this build.** Every probe carries a step that breaks, on purpose, the thing it exists to catch. Every run does both legs, in order:

1. Break it. Run the probe. **It must go red.**
2. Restore it. Run the probe. **It must go green.**

Green alone is not evidence. Green on both legs means the instrument is broken, not that the app is right: stop there, say so, and record no pass for that criterion. This is the executed form of the rule that used to ask you to calibrate — [timone#36](https://github.com/fvermaut/timone/issues/36) is the record of what asking was worth, three passes running. It also catches decay for free: a probe whose query or selector has stopped matching the app cannot be made to go red either.

Where the clause asserts a **transformation of input** (trimming, normalization, rejection), the break step is the one that proves transport: show the probe delivers its input **verbatim** to the app's boundary, because tooling silently normalizes (a multipart flag that strips padding, a shell that eats quotes, a client that URL-encodes), and a probe that pre-applies the expected transformation can only agree with the app.

**A probe with no break step is still committed, and flagged.** Some clauses have no single fact to flip — *"nothing raw survives the night"* has none. Mark it in the file and in the report, with the reason. It still runs. The report states the count plainly — *"18 probes proven able to fail, 2 not"* — so an unproven probe is a visible number and never a silent assumption.

**Label the output per clause, in the register's words.** `=== R1 clause 4 — a watched name with no index membership is still ingested`. Each pass, compare the register's clause list against the labels the probe printed: a criterion with seven clauses whose probe prints six has a gap, and you write the missing clause now. This catches a clause added to a criterion whose probe was never extended. It does not catch a probe that covers every clause but tests one wrongly — the break step is what limits that, since a probe aimed at the wrong fact usually cannot be made to go red on the right one.

**The baseline probes are Timone's, not the project's.** The accessibility and UI/UX checks live once under `standards/baseline/probes/`, take a page address, and are run by every project's browser channel. The project's own directory holds only what is specific to its rules and data.

**Run the set with one command, in parallel.** `node doc/plans/phases/probes/run.mjs --regression` against the standing app, printing a verdict table and each probe's per-clause output. The report quotes that output, so its required elements are unchanged — commands as run, per-clause outcomes.

## The fix loop

**You never fix.** Fixing means reading source, and a verifier that has read the fix has build knowledge for the re-verify. The loop:

1. Every FAIL (and REGRESSION) in the pass produces a **defect brief** in the template below — written from observation, quoting the register's clause, never speculating about cause in the code.
2. A **fresh fix context** receives the brief, the repository, and `doc/standards.md`; it implements, commits `fix: verify NN — <criterion-id> <slug>` on the phase's branch, and returns the commit SHA plus a one-paragraph note. You ingest **only the SHA** — never its transcript, never its diff.
3. **One full re-verify** — everything in scope except already-scripted HUMAN-CHECKs. A fix is a code change made by a context that did not watch the build; nothing short of a full re-run is defensible, because you cannot know what else it touched without reading it.
4. That brief-fix-reverify cycle is **one loop**. **Max 2 loops after the initial pass.** ✏ Since [ADR-0052](../../../doc/adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md), exhaustion no longer files a new ticket: remaining failures are recorded with evidence, their register lines flipped to `failed` exactly as before — that flip is still true evidence — and one entry is appended to the phase's departures record (`phase-NN-departures.md`) naming the remaining failures and why they were not resolved within the two loops. The stage posts its ordinary completion and the run proceeds to delivery; the report's carried-forward section (below) says exactly what remains.

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

**Verdicts:** PASS / FAIL / HUMAN-CHECK / LIVE-GATE / BLOCKED. **REGRESSION** is the FAIL variant reserved for a criterion that entered the pass already `verified` — same failure class, counts against the gate's zero-regressions clause, consumes the same fix loop; the distinct label exists because shipped behaviour broke and stage 9 reads it differently. **BLOCKED** asserts nothing about behaviour: register untouched, gate blocked, human routed, no loop consumed. **LIVE-GATE** is the `live` channel's only outcome: register untouched, gate **not** blocked, no loop consumed — it reports which gate last observed the criterion and whether this phase owes a fresh one. It is deliberately not BLOCKED: a criterion that was never going to run here has not failed to run.

**Only this stage writes the register's `Status` field** — once per pass, at pass conclusion, never mid-pass, in the same commit as the report and the probes: `docs: verify phase NN — <theme>` on the phase's branch. The report-flip coupling in one commit is the evidence link; the register line itself stays bare.

- `draft` → `verified` on PASS.
- `draft` → `failed` at loop exhaustion.
- `verified` → `failed` on an unresolved REGRESSION, with a dated `✏` marker naming the report.
- A requirement carrying an unperformed HUMAN-CHECK clause stays `draft`, with a dated partial-evidence marker linking the report and the script — a requirement's status is the weakest of its clauses' outcomes, and a script nobody has run is not evidence.

**The closing gate, restated from the spec:** all MUST criteria PASS, HUMAN-CHECK or LIVE-GATE, zero regressions, within 2 verify-fix loops. **A phase that owes a fresh live gate does not pass** until the gate has run and its report is committed — that is the one way a LIVE-GATE line stops a phase.

## The verification report

`projects/<name>/doc/plans/phases/reports/phase-NN-verification.md`. Every element below is required; iterations append.

````markdown
# Phase NN — Verification Report

- **Date:** <YYYY-MM-DD>
- **Phase:** [phase-NN.md](../phase-NN.md) — stamped `Complete`, completion report [phase-NN-complete.md](phase-NN-complete.md)
- **Scope:** <claimed IDs, or "un-anchored (stamped <date>, <who>) — regression set only">
- **Live gate owed:** <yes, naming the criteria whose dependencies this diff touches — or no>
- **Regression set (derived):** <the MUST+api+verified IDs at this HEAD, or "empty — nothing verified before this pass">
- **Branch:** `phase-NN-<slug>` @ `<sha>` <— plus "merged in `phase-MM-<slug>` first: its verification commits were absent from this branch's ancestry" when that applied>

## Environment

<How the app was stood up, in production form: the commands, the order, and why the order mattered when it did. The build-health smoke's one-line result, reported as such.>

## Independence declaration

Read: <the allowed-list artifacts actually read, by path>. Not read: handoffs, diffs, source, the committed test suite, ADRs. No implementation source was read; all criterion evidence below comes from verifier-authored probes, run from `doc/plans/phases/probes/` and `standards/baseline/probes/` or written this pass.

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

## Live gates

<One line per `live` criterion in scope: its ID, the report its `Last live gate:` names (or `never`), and whether this phase owes a fresh one. Or "No criterion in scope is on the `live` channel." Stated, never omitted — a section that disappears when empty is a section a reader stops looking for.>

## Regression

<The derived set's results, one line per ID — or "The derived regression set is empty; nothing to re-run." Stated, never omitted. Then what the narrowing removed: one line per criterion dropped and the `Depends-on` prefix that dropped it, or "Nothing was narrowed out." The removals are the part a reader has to be able to argue with.>

## Probes

<The count, stated plainly: "N probes proven able to fail, M not." Then, per probe: its criterion, whether it was authored this pass or run from the directory, and the outcome of its break step. Every probe with no break step is named here with the reason it has none. Probes written or rewritten this pass are listed with why — first check of the criterion, or the criterion was `revised`. Clause coverage: any criterion whose register clause count exceeds the labels its probe printed, and what was written to close the gap.>

## Fix-loop accounting

<N of 2 loops consumed. Per loop: the briefs issued, the fix commits returned, the full re-verify's outcome. "0 of 2 — the initial pass was clean." when so.>

## Register changes

<Every `Status` flip and marker written this pass, by ID — or "None: <why>.">

## Carried forward

<Only when anything remains BLOCKED or `failed`: what, the evidence, and a pointer to the phase's departures record (`phase-NN-departures.md`) for the entry recording it. Omit the section when nothing does.>
````

## Status reporting

Before finishing, update the target project's `STATUS.md` — **on the project's default branch, never on the phase branch** (`process.md`, Status reporting: every stage rewrites the whole file, so a branch-local copy conflicts the moment a second branch merges). Commit it there as its own `docs: STATUS.md — <theme>` commit, then **return the clone to the phase branch you were on**. Because the file lives on the default branch while the work does not, every item it carries must name which branch and which pull request it belongs to. Content — plain language: what was checked, what passed, what failed and got fixed, what is waiting on the human (every unperformed HUMAN-CHECK script belongs there), always naming which repository each item sits in. When verifying Timone's own work, the same obligation lands on Timone's root `STATUS.md`.

## Workflow

1. Resolve the target project, then the phase reference, to one file.
2. Read the allowed list — and nothing else.
3. Check gate 1 (completion stamp) and gate 2 (register or un-anchored stamp). If either fires, stop, route, write nothing.
4. Check out the phase branch; merge in an unancestored parent's verification commits when stacked; refuse dirt.
5. Derive the scope: claimed set + computed regression set, narrowed by `Depends-on` against this phase's diff. List both, and list what the narrowing removed.
6. Stand up the environment in production form (gate 3 if it will not come up — everything BLOCKED, record a departure, report, and continue rather than stop).
7. For every in-scope criterion, run its committed probe, or author one when there is none or the criterion is `revised`. Run the shared baseline probes for the browser channel. Every probe runs its break step first: red, then green. Compare each register clause list against the labels the probe printed and close any gap. Write HUMAN-CHECK scripts where only a human can look. **For a `live` criterion, write neither probe nor script** — report its last gate and whether this phase owes a fresh one.
8. FAILs → defect briefs → fresh fix context → full re-verify. Max 2 loops, then exhaustion protocol.
9. Write the report, commit the probes, and flip the register — all in one `docs: verify phase NN — <theme>` commit. Update `STATUS.md`.
10. Report per Closing below.


## Commit provenance

Every commit you cause to be made in a managed project carries the trailer
([ADR-0019](../../../doc/adr/0019-timone-authored-commits-carry-a-provenance-trailer.md)),
below any `Co-Authored-By:` line:

```
Timone-Stage: <this stage>
Timone-Run: <project>#<ticket>     # only when a ticket drove this session
Timone-Session: <the id you were given at the start of this session>
```

It is what makes machine-authored work identifiable from git history alone. An
automatic check at the end of every session reports any commit that omits it,
so leaving it off costs a correction rather than passing quietly.

## Closing

Report to the user, in this order:

1. The gate outcome, if gate 1 or gate 2 fired: which gate, why, and the exact next invocation — then stop, nothing below applies. ✏ Since [ADR-0052](../../../doc/adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md), gate 3 no longer produces this outcome — it shows up in the departures record instead, covered by item 5 below.
2. The scope verified — claimed set, derived regression set — and the verdict table.
3. Fix loops consumed, with the fix commit SHAs.
4. The report's path, and every script waiting on a human.
5. Anything carried forward — BLOCKED or `failed` — per the report's own "Carried forward" section and the phase's departures record.
6. The next invocation: `/timone-deliver <project> <phase-NN>` — naming the phase, because delivery refuses to pick one for the user just as you do.

Verification observes and reports. It never fixes with its own hands, never merges, and never opens a PR. Stop here.
