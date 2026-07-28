# Timone — Status

**For fvermaut. Plain language, no process knowledge assumed.** This file is a status report, not agent context — agents update it, they never treat it as a source of truth. Last updated **2026-07-28**.

> **This file is about Timone itself** — the tool. Each managed project has its own `STATUS.md` file; the to-do app's is at `projects/scratch-app/STATUS.md`. **Every file path in this file lives in the Timone repository unless it says otherwise.** When something here is about a project, it names the project and says so.

---

## In one paragraph

Timone makes AI agents follow a real engineering process instead of improvising. The process runs in **stages** — sort the request, dig out requirements, write them down, record decisions, plan, build, check, deliver, act on feedback. Each stage is driven by a **skill**: a written instruction file an agent loads and follows, the way a new colleague would follow a runbook. There are twelve stages in all, and **nine of them now have a working skill**. Of the three that don't, two are deliberately left for later. One is a real gap: the stage that handles your feedback. After that comes the bigger goal — having all this run automatically from tickets instead of being typed by hand.

## What "done" means here

Timone's own requirements are written down as a numbered list in `doc/specs/prd/prd-01-process-layer.criteria.md` — one file, twenty-four entries, each stating what must be true and how to check it. **A requirement counts as verified only when an agent that did not build the thing has checked it and recorded evidence.** Right now **17 of the 24 are verified.** Four more are finished and waiting on your sign-off right now — see *Waiting on you*. That would make 21.

## Done

- **The process is written down** — `process.md` is the single definition every skill obeys. When a skill and it disagree, it wins and the skill gets corrected.
- **The plumbing** — a list of managed projects, a command to copy them onto your machine, and the rule that work happens here rather than inside a client's repository.
- **Nine stage skills exist and have each been exercised against throwaway projects:** onboarding a new repository, sorting an incoming request, interviewing you for requirements, writing requirements down, recording architecture decisions, planning work into steps, **building the code**, **checking the result**, and — new today — **opening the pull request**.
- **A standards library** — twelve written entries. Ten cover the preferred technology choices; two apply to every project with no exceptions (accessibility, which is a legal requirement in the EU, and visual/interaction design). The twelfth is new today, below.

## Just finished

**The delivery skill is built, and it has opened two real pull requests** (2026-07-28). This was the last stage before feedback.

Delivery does one thing: it puts finished work in front of you, with everything you need to judge it. It does not improve the work, does not merge it, and does not decide anything the pull request exists to let you decide.

Two independent reviews run before the pull request opens, and **they are deliberately never blended into one list**. One asks *"does this follow the conventions we agreed?"*. The other asks *"did it build the thing we actually asked for?"*. They are kept apart because code can follow every convention while building the wrong thing, and can build exactly the right thing while breaking every convention — a single merged list hides that difference.

**Neither review is allowed to change anything.** They report; you decide. Anything worth acting on goes through the feedback stage, which is the next skill to build. This resolved a genuine contradiction in `process.md`, the written rulebook every skill obeys: the building stage had been telling its agents "leave the tidying-up to the delivery review", which reads as a promise that delivery *does* the tidying — while the delivery stage said the reviews only report. Delivery cannot be allowed to change code, because that code would land *after* the checking stage signed off and *before* you read it, quietly invalidating the sign-off at the moment it is being shown to you. So the building stage's sentence was the one that was wrong, and it has been corrected.

**A twelfth standards entry was written and you approved it:** a fixed list of code smells (`standards/code-smells.md`) — twenty things a reviewer looks for in a change, each with the signal that identifies it. The conventions review had been specified against this list for weeks, and the list had never existed.

**Two pull requests are now open on the to-do app** and waiting for you. Both are listed under *Waiting on you*.

## What the proof runs found

Four runs against the to-do app, and three rounds of corrections. **Two of the three corrections were rules that contradicted themselves** — the most useful kind of finding, because nothing fails visibly when an instruction is impossible to obey; the agent just quietly picks one half.

1. **The code-smell list was too narrow.** It described duplication as "the same block appearing three times", so a single repeated *line* did not count — and a one-line cache instruction copied into all three places that needed it went unreported. The list now says a repeated one-liner counts. Re-run against the corrected list, a fresh reviewer put exactly that finding first.
2. **The reviewers were told to read every file in the change, and also forbidden to read one of them.** A finished piece of work always contains its own checking report, so the two rules could never both be obeyed. The reviewers are now told plainly that the paperwork is not what they review.
3. **Re-delivering re-reviewed its own paperwork, forever.** The rule said "re-run the reviews when new work arrives" — but the delivery report *is* new work on the same branch, so every re-delivery would have re-reviewed what the last one wrote, and the next would re-review that. Re-running is now tied to the code actually changing.

**One result is worth your attention, and it is not a defect.** On the to-do app, the checking agent ran the real application and confirmed that deleting an item removes it immediately. The conventions-and-requirements reviewer read the source code instead, and found the code openly admits that its normal path sometimes fails — so it schedules two backup refreshes, a quarter-second and a full second later, with a comment conceding the first one can lose the race. **Both are true of what each looked at**: one watched it work, the other read why it might not. That disagreement is printed in the pull request rather than resolved, because resolving it would have meant hiding one of them.

## Previously

**The checking skill was finished and signed off** (2026-07-28). An agent that never saw the to-do app being built now checks it against its promises — running the real application, never reading its code or its tests. What it cannot check by machine, it writes up as a script for you rather than guessing. What fails, it hands to a separate agent to fix, then re-checks everything from scratch. Report: `doc/plans/phases/reports/phase-08-complete.md` (Timone repository).

That took three rounds of corrections, and the middle one is the one worth remembering. **The checker's first attempt at a deliberately planted bug returned "everything passes" — and it was wrong.** The requirement says a title typed with spaces around it gets stored without them. To test that, the checker sent a padded title to the app — but the tool it used to send it strips padding itself, before the app ever sees it. So the test performed the very trimming it was supposed to be checking, and could only ever agree. Worse: the app's own tests were failing on exactly that behaviour at the time, and the checker wrote that contradiction down as a curiosity for you rather than treating it as the alarm it was. Two rules now close this: **a check must be shown capable of failing before its "pass" counts**, and **when the app's own tests and the checker disagree, the checker stops and works out which instrument is lying**.

**The code-writing skill was finished and signed off** (2026-07-26). Proving it meant pointing it at a throwaway to-do list app and telling it to build the thing from scratch. It did. That took seven rounds of corrections — roughly 35 defects — because every real run exposed something the instructions got wrong. Report: `doc/plans/phases/reports/phase-07-complete.md` (Timone repository).

The seventh round is worth singling out: **the rule for choosing where to start work meant no project could ever begin its second piece of work.** Git, the version-control system, keeps work on named lines of development called *branches*; the main line is called `main`. The rule said start from `main` — but finished work sits waiting for your approval rather than joining `main` immediately, so `main` had no code on it at all. Found while preparing a test rather than running one.

## What's left

| Stage | What it does | State |
|---|---|---|
| **Feedback** | Takes your "that's not what I meant" and works out whether the requirements were wrong or the code was | **The one real gap.** Next to build. |
| **Deployment** | Releases approved work to a live environment | Deliberately later — defined in `process.md`, the written rulebook every skill obeys, no skill yet |
| **Maintenance** | Turns dependency updates and production issues into new incoming requests | Deliberately later — defined in `process.md`, the written rulebook every skill obeys, no skill yet |

**Then** the second half of the vision: instead of you typing instructions, a background service watches your tickets and drives these same stages itself, posting questions and results back to the ticket. Nothing on that has started.

## Waiting on you

**Two things on Timone itself:**

1. **Read the two pull requests and confirm this delivery skill did its job.** They are on the to-do app but the sign-off is Timone's — the pull requests *are* the evidence that the skill works. Links below.
2. **Then four more requirements can be marked verified** — the delivery skill, the two-review mechanism, the handover writer (the skill that captures where work stands so a fresh session can pick it up) and this status file — taking Timone from 17 of 24 to 21 of 24.

**Three things on the to-do app** (`projects/scratch-app`), which has its own status file at `projects/scratch-app/STATUS.md`:

1. **Pull request #1 — the to-do list itself:** <https://github.com/fvermaut/scratch-app/pull/1>. Six conventions findings, three requirements findings, and one item that cannot be signed off without you (below).
2. **Pull request #2 — the speed check:** <https://github.com/fvermaut/scratch-app/pull/2>. It sits **on top of** #1, so #1 has to merge first. It also asks you to decide a speed limit: the check demands a list read finish in under 2 milliseconds, which passes comfortably here but was seen to fail once on a busy machine, and the number was never measured — it was guessed.
3. **Listen to the app with a screen reader** (VoiceOver + Safari) and confirm the controls are announced sensibly. No automated test can settle this; your own accessibility standard says so outright. The step-by-step script is in `doc/plans/phases/reports/phase-01-verification.md` **in the scratch-app repository, not this one**.

## Known problems not yet fixed

- **This file was wrong until today, and that is itself a finding.** While the delivery skill was being proved, the to-do app's status file was updated and this one was not — so for several hours the two disagreed about whether the delivery stage existed at all. The rule says a stage that changes things and leaves the status file stale has not finished. Timone's own work puts documentation last, which is exactly the window where this can happen.
- **The onboarding skill cannot repair a project.** It refuses to run on any project already registered — which is every project that could have a file missing. It is now a tracked requirement rather than a loose note.
- **Nothing detects when the standards library goes out of date.** Five entries were wrong in one weekend, each correct when written, each found only because something finally ran it. Now a tracked requirement — deliberately without a solution attached, because picking a mechanism now would be guessing. It needs an interview session first.
- **Timone's own work is planned by hand.** The planning skill only works on managed projects, by choice. So this file's sections are hand-written, not generated.
- **The give-up-and-ask-a-human path has never fired — now true of three skills.** Building, checking and delivering all have a "I've tried and stopped, over to you" route, fully written and never triggered. Same reasoning each time: provoking it means building a trap designed to defeat a competent agent, which tests my ingenuity rather than the tool. The first real failure on real work is its test.
- **Nothing is merged.** Both pieces of work on the to-do app are finished, checked, and now open for review — but merging is yours and neither has been merged.

## Jargon key

Only if you need it. **Skill** — a written instruction file an agent loads and follows for one stage. **Stage** — one step of the process, from sorting a request through to maintenance. **Phase** — a chunk of work planned and built as one unit; the numbered "phase 07" and "phase 08" in this file are Timone's own chunks of work, in order. **Branch** — a named line of development in Git; **merging** joins one into another, and **`main`** is the primary one. **Pull request** — the page where a branch is reviewed and where you press merge. **Requirement** — a numbered, checkable statement of what something must do; Timone's own are in `doc/specs/prd/prd-01-process-layer.criteria.md`. **Verified** — checked by an agent that did not build the thing, with evidence recorded.
