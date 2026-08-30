---
name: timone-deliver
description: Stage 8 (Delivery) of the Timone process — on a managed project, present a completed and verified phase for human judgement: run the two-axis review (Standards and Spec) as parallel fresh contexts, commit the delivery report, and open a pull request carrying scope, the verification outcome and both reports. Use when a phase has been verified, when verification's closing hands over to delivery, or when the user says "deliver phase NN", "open the PR", "ship this phase", or "run the delivery review".
argument-hint: <project-name> <phase-ref: phase-NN or a path to the phase file>
---

# Timone Stage 8 — Delivery

Delivery presents finished work for human judgement. It does not improve the work, does not merge it, and decides nothing the pull request exists to let a human decide. Stage 6 built it and stage 7 proved it; your job is to put it in front of the person who says yes, with everything they need to say yes or no in one place — and to say nothing they would have to take on trust. The process spec (`process.md`, stage 8) is normative; when this skill and the spec disagree, the spec wins.

**Everything you put in front of the human follows [Writing to the human](../../../process.md#writing-to-the-human).** Short sentences, plain words, no process vocabulary — no stage numbers, no skill names, nothing a reader would need `process.md` to understand. A ticket comment is a few sentences and under 150 words. Specifications, requirements and technical detail are **links** to committed artifacts, never text on a ticket. Every message ends with a call to action, and "no action needed" is one.

**Standalone and from-verification are the same invocation.** `timone-verify`'s closing hands over a command line, not a mode: there is no privileged path from verification and no extra context it may pass you. Whoever invokes this skill, the rules below are identical.

## Target-project resolution (do this first)

1. The target project is the one named in the invocation argument or prompt.
2. If no project is named: read `timone.yaml`, list the project names, and **ask** the user to pick. Never guess.
3. Validate the name against `timone.yaml`. Unknown name → abort, listing the valid names.
4. Check `projects/<name>/` exists on disk. Not cloned → abort, suggesting `node dist/cli.js workspace sync`.
5. From here on, every file you read or write lives under `projects/<name>/…` — the only exceptions are *reading* timone's own `process.md`, `standards/`, and `timone.yaml`.
6. In loop mode (daemon-initiated sessions), the target project arrives in the event context; the same validation applies.

## The gates

Each gate stops delivery. When one fires you write **nothing** into the project, push nothing, open nothing, state which gate fired and why in one short paragraph, and name the skill or the human to route to. A stopped delivery is a valid, complete outcome of this skill.

**Their order is fixed: 1 → 2 → 3 → 4 → 5.** Gates about the work precede gates about where it goes, so a project whose phase was never verified hears *that* rather than a complaint about its git host. Fire the first one that applies and stop; do not report the others speculatively.

**1 — Input gate.** A project name plus a phase reference: `phase-01`, `01`, or a path. Resolve it to exactly one file under `projects/<name>/doc/plans/phases/phase-NN.md`. Ambiguous, absent, or no phase given → say which phase files exist, and stop. **Never pick a phase for the user**: delivering the wrong branch is not a mistake a later gate catches.

**2 — Completion gate.** A phase file not stamped `Complete — see …` has nothing to deliver. Route to **`timone-execute`** when the phase is mid-execution or never started; route to the **human** when the state is unclear.

**3 — Verification gate.** Read the verification report at `doc/plans/phases/reports/phase-NN-verification.md`, latest iteration.
- **No report at all** → route to **`timone-verify`**. A `Complete` stamp is stage 6 vouching for its own work; stage 7 is what makes it presentable.
- **The stage-7 gate did not pass** — any MUST criterion neither PASS nor HUMAN-CHECK, any unresolved regression, any register line reading `failed`, or any BLOCKED verdict — → file it as a ticket for **stage 1**, not back to stage 7 (✏ 2026-08-19: stage 9 until [ADR-0036](../../../doc/adr/0036-feedback-is-triage-with-the-documents-open.md) retired it). A failed pass has already spent its fix loops; re-running verification cannot manufacture a different answer.
- **An unperformed HUMAN-CHECK is not this gate firing.** See below.

**4 — Look gate.** ✏ 2026-08-19 ([ADR-0039](../../../doc/adr/0039-the-look-is-gated-twice.md)). **A phase carrying a user-facing screen does not get a pull request until the human has seen the built screen beside its reference and said yes.**

- **Skip it entirely** when the phase built no user-facing screen. Say so in the delivery report rather than leaving its absence to inference.
- **Otherwise: stand the app up, capture the screen, and put it in front of them** next to the reference the phase file names — the kept prototype ([ADR-0037](../../../doc/adr/0037-a-prototype-that-settles-a-look-is-kept-and-only-its-presentation-crosses.md)), or the project's `doc/design.md`. Hand over the shell slice's recorded difference list from the completion report: that list is the substance of what they are approving, since a difference explained there is a difference this process accepted on the builder's word.
- **Ask once, plainly, and end with the call to action.** The question is "does this look right" — not a review, not a checklist. Their yes is recorded in the delivery report with the date.
- **A "no" stops delivery.** Write nothing, push nothing, open nothing. It is not a review finding and it does not go back to stage 7: it re-enters **stage 1** as a later request, per [ADR-0036](../../../doc/adr/0036-feedback-is-triage-with-the-documents-open.md). Say that in one short paragraph and stop — a stopped delivery is a valid, complete outcome.

**This does not reverse the HUMAN-CHECK rule below.** A scripted accessibility check is *evidence*, gathered later, and withholding the PR would hide it from the person who discharges it. The look gate is a *judgement*, and it is the judgement the pull request exists to obtain — presenting a screen its owner has not seen is not presenting it.

**5 — Platform gate.** The pull request *is* this stage's artifact ([ADR-0004](../../../doc/adr/0004-github-first-adapter-pair.md)), so there is no fallback surface:
- The project's `repo_url` in `timone.yaml` is not GitHub-hosted (does not match `github.com`) → refuse **loudly** and route to the human. Unlike stage 1's triage record there is no doc-record substitute: a delivery record with no review surface would mean shipping nothing while reporting success.
- `gh` is not installed, or `gh auth status` fails → refuse the same way, naming the missing prerequisite. Never attempt `gh auth login`; it is interactive and it is the human's.

## An unperformed HUMAN-CHECK does not block delivery

Stage 7 emits manual scripts and does not wait for them to be performed. A requirement left `draft` with a partial-evidence marker is a *known, evidenced* open item — carry it into the PR body as an explicit **unticked checklist item** naming where its script lives, and say so in the delivery report. Merging is a human act and the PR is where that human already is; withholding the PR would hide the item from the only person who can discharge it.

You never write the criteria register. Only stage 7 does — including for a check the human performs after your PR is open.

## The branch and the base

- **Deliver at the phase branch's HEAD** (`phase-NN-<slug>`). Refuse a dirty working tree — report what is dirty; never stash or reset around it.
- **Determine the base branch, and record why.** If the phase's branch was cut from the project's default branch, the base is the default branch. **If it was stacked on a previous phase's unmerged branch** (stage 6's stacking rule — the completion report says so), the base is **that parent branch**, and the PR body names which PR must merge first. Opening a stacked phase against the default branch would show the parent's commits as this phase's work and make the diff — the thing both axes review — a fiction.
- **Push the branch to `origin`.** Delivery never merges, never rebases, never force-pushes, and never rewrites history: merge order is the human's.
- **The diff range is `<base>...<head>`** (three dots — the merge-base). Both axes review that range and nothing else; compute it once and hand it to both.
- **The review subject is the range's non-process files.** A phase's diff also carries its own process artifacts — the phase file, the handoff notes, the completion and verification reports, the criteria register, `STATUS.md`, `CONTEXT.md`. Those are not what either axis reviews, and "the current content of the files the diff touches" never overrides a read list: a file the diff contains but the axis's list forbids stays unread. Without this the two rules contradict each other, since the verification report is always in the range and always forbidden. A process artifact that *is* on an axis's own list — the criteria register, for Spec — is read from that list, and noticing what the diff did to it is fair game.

## The two axes

Two reviews, run as **parallel fresh contexts**, each with its own read list, each returning a report in the shared section shape below.

**Standards** — does the diff conform to the conventions this project has agreed to?
- **Reads:** the diff range; the project's `doc/standards.md`; timone's `standards/code-smells.md` (the review reference); the project's tool configuration — ESLint, Prettier, `tsconfig`, and whatever else the repo enforces mechanically.
- The tool configuration is read **so it can skip**: anything linting, formatting or type-checking already catches is not a finding. Restating a tool's job wastes the human's attention on the one report they read by hand.
- On conflict, `doc/standards.md` **overrides** the smell reference. The project's recorded deviations are decisions, not defects.

**Spec** — does the diff faithfully implement what was asked for?
- **Reads:** the diff range; the PRD pair (narrative and criteria register); the phase file's requirements header.
- Looks for missing requirements, scope creep, and implementations that look wrong against the criterion they claim to satisfy. **Every finding quotes the requirement ID it bears on.**
- An **un-anchored** phase claims no requirement IDs. Say so and report no findings against requirements — do not manufacture a PRD for it; stage 6's validation already covered the deliverable, and inventing criteria at review time invents a standard nobody agreed to.

**What neither axis may read.** Not each other's report — they are independent or they are one review with two headings. And **not the verification report**: behaviour evidence is stage 7's, and a spec reviewer holding a PASS table reviews the report instead of the diff, which is the one thing it was spawned not to do.

**Never merged.** Concatenate the two reports under distinct headings; never rank their findings into one list, never dedupe across them. Standards-clean code can build the wrong thing and spec-faithful code can break conventions — a merged list hides exactly that distinction.

**They report; they never block, and they never refactor.** Findings do not withhold the PR: a review that withheld it would hide its own findings from the only person who can act on them. Remediation goes through **stage 9**. Committing a refactor here would put code into the branch that no verification pass has ever seen — landing after the report that certifies the behaviour and before the human reads it, invalidating stage 7's evidence at the moment it is being presented.

**Mechanism is an example, never a requirement.** Today the obvious instrument is two sub-agents spawned from this session, each with its read list as its prompt; PRD-02's daemon will spawn the same contract through the Agent SDK. Anything that receives those inputs, in isolation from the other axis, and returns a report in the shape below satisfies the contract.

```markdown
## <Standards | Spec> review — phase NN

- **Read:** <the artifacts actually read, by path>
- **Diff:** `<base>...<head>` — <N> files, +<A>/−<B>
- **Findings:** <N, or "none">

### <n>. <one-line finding> — <smell name | requirement ID>

- **Where:** `<path>:<line>–<line>`
- **What:** <the observation, quoting the hunk>
- **Why it matters:** <the standard, smell or requirement it bears on — by name or ID>
- **Suggested remediation:** <what stage 9 would do> — not applied here
```

Silence is a valid report. An axis that always finds something is padding, not reviewing.

## The delivery report

`projects/<name>/doc/plans/phases/reports/phase-NN-delivery.md`, committed on the phase's branch as `docs: deliver phase NN — <theme>` **before** the PR opens ([ADR-0006](../../../doc/adr/0006-specs-in-repo-single-source-of-truth.md) — the repo is the source of truth; a PR body lives on a platform and a platform is not an archive). It carries both axes verbatim, so the PR body can quote and link rather than being the only copy.

````markdown
# Phase NN — Delivery Report

- **Date:** <YYYY-MM-DD>
- **Phase:** [phase-NN.md](../phase-NN.md) — `Complete`, verified in [phase-NN-verification.md](phase-NN-verification.md)
- **Branch:** `phase-NN-<slug>` @ `<sha>`
- **Base:** `<base>` — <why: the project's default branch, or "phase-MM-<slug> is complete but unmerged; this phase was stacked on it">
- **Pull request:** <URL, added when opened — see below>
- **Look gate:** <"no user-facing screen in this phase" | "seen and approved by <who> on <date>, against <the reference>"> — [ADR-0039](../../../doc/adr/0039-the-look-is-gated-twice.md)

## Scope

<What this phase delivers, in the phase file's own terms: the requirement IDs claimed, or the un-anchored stamp with its date and approver.>

## How to try it

### Against the preview

<The preview URL is not known when this report is written — the machine posts it in its own comment on the pull request. Write the steps so they take that URL as their one variable.>

1. <step — the exact command or the exact page, and what the reviewer should see>

### On a local checkout

<Name the project's own setup document rather than repeating it, then give only the steps this phase adds.>

1. <step>

## Verification outcome

<The verdict table from the verification report, quoted — ID / priority / channel / verdict / loop — plus loops consumed.>

### Outstanding for the human

- [ ] <criterion ID> — <clause>: HUMAN-CHECK script in [phase-NN-verification.md](phase-NN-verification.md) § HUMAN-CHECK scripts

<Omit the section when nothing is outstanding.>

## Standards review — phase NN

<the axis report verbatim>

## Spec review — phase NN

<the axis report verbatim>

## Notes

<Anything the human needs that is neither a finding nor a verdict: the stacked-merge order, a re-delivery iteration marker, prerequisites that were absent.>
````

**Re-delivery updates; it never forks.** A branch that already has an open PR gets that PR's body refreshed and a dated **iteration section** appended to this existing report — never a second PR, never a second file. State in the iteration what changed since the last delivery: new commits, whether the axes were re-run, findings that appeared or went away.

**An axis is re-run when its subject changed, not when any commit landed.** The subject is the range's non-process files. Your own previous delivery is a commit on this branch, so a rule of "re-run on any new commit" makes every re-delivery re-review the delivery report it just wrote, and the next one re-review that — a loop with no fixed point. When only process artifacts moved since the last delivery, say so in the iteration section, carry the prior findings forward unchanged, and do not spawn the axes. When the subject did change, re-run both and report what appeared or went away.

## How to try it

**Every pull request carries it, and both halves are always written** (`process.md`, stage 8). One half runs against the preview, whose URL the machine posts in a comment on the same pull request; the other runs on a local checkout, which is what the reviewer has whenever the preview did not build. Write both even when the preview is up: a preview can fail after the pull request opens, and nothing rewrites the body when it does.

**Lift the steps, never invent them.** Their source is the phase file's validation commands and the verification report's HUMAN-CHECK scripts. Those commands were actually run, so they work; a command written fresh at delivery time has been run by nobody. Adapt only what has to change — a local database URL becomes the preview's address, a script path becomes a `curl` against the running app.

**Be specific to this phase, and say what the reviewer should see.** "Run the app" is not a step. "`curl -X POST <preview>/api/nightly`, then open `<preview>/universe` and check every watched name shows today's date" is. A step with no expected outcome cannot be judged, only performed.

**Do not repeat the project's setup.** The local half links to the project's own setup document — its `README.md` or `CONTEXT.md` — for install, environment and database, then lists only the steps this phase adds. A pull request that restates setup goes stale the moment setup changes.

**A phase with no user-facing screen still gets this section, and needs it most.** A preview URL alone says nothing about a scheduled job, an API route or a migration. The written step is the only way in. Never write "nothing to try" — if the phase changed observable behaviour, there is a way to observe it; if it genuinely changed none, say what the reviewer can run to see that the existing behaviour is intact.

## The pull request

Opened with `gh pr create` from within `projects/<name>/`, after the delivery report is committed and the branch is pushed.

- **Title:** the phase's theme, in the project's convention — `<type>: phase NN — <theme>`.
- **Base:** the branch determined above, passed explicitly with `--base`. Never rely on the repository's default.

````markdown
Delivers **phase NN — <theme>** of [`<project>`](.).

## Scope

<One paragraph, then the driving ticket reference — or, when the project has no ticket home, the requirement IDs this phase claims, linked to the criteria register. R13's "ticket/requirements" is a disjunction: name the requirements when there is no ticket, never neither.>

## How to try it

**Against the preview** — the machine posts the URL in its own comment on this pull request. If that comment says the branch would not build, use the local steps below instead.

1. <step — exact command or exact page, and what you should see>

**On your own machine**

1. <checkout and setup, by link to the project's setup document — never repeated here>
2. <step — only what this phase adds>

## Verification

Verified in [`phase-NN-verification.md`](<link>) — <N> of 2 fix loops consumed.

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |

**Waiting on a human reviewer:**

- [ ] <criterion ID> — <clause>: run the HUMAN-CHECK script in the verification report before merging

## Standards review

<findings, or "No findings.">

## Spec review

<findings quoting requirement IDs, or "No findings.">

## Base branch

<Only when the base is not the default branch: which PR must merge first, and why this phase was stacked.>

---

Both reviews in full: [`phase-NN-delivery.md`](<link>). Merging is a human act — this PR does not auto-merge.
````

Record the PR URL in the delivery report only if a commit already has to be made for another reason; otherwise the report states that the PR was opened against it, and the URL reaches the human through the Closing. A second commit whose only content is a link is churn on a branch a human is about to read.

## Status reporting

Before finishing, update the target project's `STATUS.md` — **on the project's default branch, never on the phase branch** (`process.md`, Status reporting: every stage rewrites the whole file, so a branch-local copy conflicts the moment a second branch merges). Commit it there as its own `docs: STATUS.md — <theme>` commit, then **return the clone to the phase branch you were on**. This is also why the PR body and the delivery report carry the status the PR needs: the PR's own branch never gains a `STATUS.md` edit. Content — plain language: what is now open for review, where the PR is, what the two reviews found (separately), what is waiting on the human before merge, and always naming which repository each item sits in. When delivering Timone's own work, the same obligation lands on Timone's root `STATUS.md`.

## Workflow

1. Resolve the target project, then the phase reference, to one file (gate 1).
2. Check gate 2 (completion stamp), gate 3 (verification report and its gate), gate 4 (GitHub binding and `gh`), **in that order**. If one fires, stop, route, write nothing.
3. Check out the phase branch; refuse dirt. Determine the base branch and record why. Push to `origin`.
4. Compute the diff range `<base>...<head>` once.
5. Spawn both axes in parallel as fresh contexts, each with its own read list. Collect two reports; never merge them.
6. Write the **How to try it** steps, lifting them from the phase file's validation commands and the verification report's HUMAN-CHECK scripts. Both halves — preview and local.
7. Write and commit the delivery report — `docs: deliver phase NN — <theme>` — before opening anything.
8. Open the PR with `gh pr create --base <base>`, or refresh the existing one and append an iteration section.
9. Update `STATUS.md`.
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

1. The gate outcome, if one fired: which gate, why, and the exact next invocation — then stop, nothing below applies.
2. The PR URL, and the base branch with its reason when it is not the default.
3. Both axes' finding counts, **stated separately** — never a combined total.
4. The delivery report's path.
5. Every outstanding HUMAN-CHECK now carried in the PR.
6. The next invocation, for anything the human wants acted on: file it as a ticket and let stage 1 read it — ✏ 2026-08-19, [ADR-0036](../../../doc/adr/0036-feedback-is-triage-with-the-documents-open.md) retired stage 9. Triage names the source it is given and never hunts for one, so name the findings or the report.

Delivery presents and records. It never fixes with its own hands, never merges, and never writes the criteria register. Stop here.
