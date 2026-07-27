# Timone — Status

**For fvermaut. Plain language, no process knowledge assumed.** This file is a status report, not agent context — agents update it, they never treat it as a source of truth. Last updated **2026-07-26**.

> **This file is about Timone itself** — the tool. Each managed project has its own `STATUS.md` under `projects/<name>/`, covering that project. When something here mentions a project, it says so by name.

---

## In one paragraph

Timone makes AI agents follow a real engineering process instead of improvising. The process has stages — sort the request, dig out requirements, write them down, record decisions, plan, build, verify, deliver, act on feedback. Each stage is a skill an agent runs. **Seven of the eleven stages now have working skills.** The hardest one — the skill that actually writes code — is finished and signed off: it built a real, running application from an empty repository. Four stages remain unbuilt, and then the bigger goal — having all this run automatically from tickets instead of being typed by hand.

## Done

- **The process is written down** — `process.md` is the single definition every skill obeys. When a skill and it disagree, it wins.
- **The plumbing** — a manifest of managed projects, a command to clone them into place, and the rule that sessions run here at the Timone root rather than inside a client's repo.
- **Seven stage skills work and have been tested against throwaway projects:** onboarding a new repo, sorting an incoming request, interviewing you for requirements, writing requirements down, recording architecture decisions, planning work into steps, and — new this weekend — **building the code**.
- **A standards library** — 11 entries covering the preferred stack, plus two that apply to every project with no opt-out: accessibility (a legal requirement in the EU) and UI/UX.
- **15 of Timone's 24 requirements are formally verified.**

## Just finished

**The verify skill is built and proved — and it is waiting on your review** (2026-07-27). The rules, the skill, and four proof runs are done; only the paperwork step remains, and that is deliberately blocked until you sign off. Details in "Waiting on you" below.

## Previously

**The code-writing skill is done and signed off** (2026-07-26). All four parts landed: the rules, the skill, the proof, and your sign-off. Two more requirements are now formally verified, and the phase is closed with its report at `doc/plans/phases/reports/phase-07-complete.md`.

Proving it meant pointing the skill at a throwaway to-do list app (`projects/scratch-app`) and telling it to build the thing from scratch. It did. That took **seven rounds of fixes — roughly 35 defects** — because every real run exposed something the instructions got wrong. That's the dry run doing its job.

The seventh round is worth singling out: **the rule for choosing a branch meant no project could ever start its second phase.** It said start from the project's main branch — but a finished phase sits unmerged until a human approves it, so main had no code on it at all. Found while preparing a test rather than running one, on the second phase of the first project.

**One thing is untested and is being left that way deliberately: what happens when work fails repeatedly and has to be handed back to a human.** I tried three times to provoke it and failed each time, for a reason worth knowing: the better this skill got, the harder that path became to reach honestly. A broken plan is now caught before any work starts. A missing permission or a stopped database stops immediately rather than retrying, because a retry couldn't change either. An over-ambitious performance target was simply met. Provoking it reliably would mean building a trap designed to defeat a competent agent, which tests my ingenuity rather than the tool. **Recommendation: let the first real failure on a genuine project be its test**, with the report noting that's what it is. The behaviour is fully specified — it has just never fired. You accepted this at sign-off.

Closing the phase turned up one last inconsistency, now fixed: the branch fix from round seven had been written into the skill but not into `process.md`, the document that outranks it. So the rulebook still said the thing that could never work.

## Next up

**Your review of the verify skill, then the delivery skill.** Once you sign off (see "Waiting on you"), the last step of this phase marks two more requirements verified and closes it. After that: the skill that opens the pull request, with two independent reviews attached.

## What's left after this

Four stages still have no skill:

| Stage | What it does |
|---|---|
| **Verify** | A fresh agent that didn't watch the build checks the app actually does what was promised |
| **Deliver** | Opens the pull request, with two independent reviews attached |
| **Feedback** | Takes your "that's not what I meant" and works out whether the requirements were wrong or the code was |
| *(inside Deliver)* | The two-review mechanism itself — one for conventions, one for whether it built the right thing |

Two more are built but not formally signed off: the accessibility baseline, and the handover writer.

**Then** the second half of the vision: instead of you typing instructions, a background service watches your tickets and drives these same stages itself, posting questions and results back to the ticket. Nothing on that has started.

## Waiting on you

**Review the verify skill's proof runs and sign off** — this is the gate written into the plan, and nothing proceeds past it. What to look at, all on Timone itself unless stated:

1. **The verification reports** on the to-do app (`projects/scratch-app`): `doc/plans/phases/reports/phase-01-verification.md` (three passes) and `phase-02-verification.md` (one).
2. **The two fixes the checker caused to be made** to the to-do app, each by a separate agent that was told only what was wrong, never how it was built.
3. **One decision:** the second proof run deliberately broke something to see whether the checker would notice. The break and its repair are both still in the to-do app's history. Say if you'd rather they were removed.
4. **One confirmation:** the screen-reader check on the to-do app is still unperformed, by your choice. The written script is in the phase-01 report whenever you want it.

**Also newly waiting on you, from the to-do app itself** (raised by the checker, not by me): a decision on the 2 ms speed limit that phase 02 set — it passes today but only on a local database, and one reading was seen that would have failed it. Three options are laid out in `projects/scratch-app/doc/plans/phases/reports/phase-02-verification.md`.

Everything else was closed on 2026-07-26 — see below.

## What the proof runs found

Four runs, three rounds of fixes. The one worth your attention:

**The checker's first attempt at the deliberate break returned "everything passes" — and it was wrong.** The requirement says a title typed with spaces around it gets stored without them. To test that, the checker sent a padded title to the app — but the tool it used to send it strips padding itself, before the app ever sees it. So the test performed the very trimming it was supposed to be checking, and could only ever agree. Worse: the app's own test suite was failing on exactly that behaviour at the time, and the checker wrote that contradiction down as a curiosity for you rather than treating it as the alarm it was.

Two rules now close this, and they are the most valuable thing this phase produced: **a check must be shown capable of failing before its "pass" counts**, and **when the app's own tests and the checker disagree, the checker stops and works out which instrument is lying** instead of filing it and moving on. Re-run under those rules, the checker caught the planted break immediately — and found a second, real bug nobody planted: items occasionally not appearing or disappearing on screen after being saved. Both were fixed and re-checked.

The other two rounds: the code-writing skill was handing over an instruction with the phase number missing, which would have stranded any project past its first phase; and the checker's list of "what you may read" was so tight it forbade reading the files that tell it which port the app runs on — a rule that forbids its own instructions trains agents to ignore rules.

## Decided on 2026-07-26

- **The two contradicting rules are reconciled.** Controls now grey out while submitting *only where pressing twice would be an accident* — submit, pay, delete. Where pressing twice is what you meant (a checkbox, a quantity stepper), the control stays operable and the "working on it" signal moves to the row around it. The accessibility document was left untouched, because it encodes a legal requirement and carving an exception into it would have been a documented failure rather than a fix.
- **All four standards corrections approved** and now binding.
- **The database instruction is fixed, and this time it was actually run before being written down.** Two settings, and the generated code loads under plain Node with no workaround; the app's type check and production build both stay green. Every project stops paying a ~25-line tax.
- **`doc/todo.md` left exactly as it is**, and told to stop showing up as stray residue.
- **Where focus goes when you delete something is settled** — and settled once for every project rather than once for the to-do app. Delete a row with the keyboard today and you're silently returned to the top of the page; the rule now says focus moves to the next row's equivalent button, the previous row if you deleted the last one, or the "add" box if the list is now empty. The W3C's guidance describes exactly the failure we had. The to-do app doesn't comply yet, and that's recorded against it.
- **Two loose problems became tracked requirements** instead of notes in this file: repairing a project that's missing a required document, and noticing when the standards library goes stale.

## Known problems not yet fixed

- **The onboarding skill can't repair a project.** It refuses to run on any project already registered — which is every project that could have a file missing. Found when a project turned out to be missing a required file; the only way to fix it was to override the skill by hand. **Now a tracked requirement** (2026-07-26) rather than a loose note, so it gets planned and built like anything else.
- **Nothing detects when the standards library drifts out of date.** Five entries were wrong this weekend, each correct when written, each found only because something finally ran it. **Now a tracked requirement** (2026-07-26) — but deliberately without a solution attached: version stamps, a re-check schedule, running the instructions in CI, or something else. That gets worked out in an interview session before anyone plans it, because picking a mechanism now would be guessing.
- **Timone's own phases are planned by hand.** The planning skill only works on managed projects, by choice. So this file's status sections are hand-written, not generated.
- **The hand-back-to-a-human path has never fired.** Specified, refined twice, never exercised. See "Just finished" above for why, and why chasing it further is a poor use of effort.
- **Two finished pieces of work on the to-do app are stacked up with nowhere to go.** Both are complete and neither can be delivered, because the stages that check and ship work don't exist yet. They are the first thing the next two skills will unblock.

## Jargon key

Only if you need it: a **phase** is a chunk of work planned as one unit; a **sub-phase** or **slice** is one step inside it; a **gate** is a checkpoint that must pass before continuing, either automatic or you; **PRD** is the requirements document; **ADR** is a recorded decision.
