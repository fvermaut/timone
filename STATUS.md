# Timone — Status

**For fvermaut. Plain language, no process knowledge assumed.** This file is a status report, not agent context — agents update it, they never treat it as a source of truth. Last updated **2026-08-01**.

> **This file is about Timone itself** — the tool. Each managed project has its own `STATUS.md` file; the to-do app's is at `projects/scratch-app/STATUS.md`. **Every file path in this file lives in the Timone repository unless it says otherwise.** When something here is about a project, it names the project and says so.

---

## In one paragraph

Timone makes AI agents follow a real engineering process instead of improvising. The process runs in **stages** — sort the request, dig out requirements, write them down, record decisions, plan, build, check, deliver, act on feedback. Each stage is driven by a **skill**: a written instruction file an agent loads and follows, the way a new colleague would follow a runbook. There are twelve stages in all, and **nine of them now have a working skill**. Of the three that don't, two are deliberately left for later. One is a real gap: the stage that handles your feedback. After that comes the bigger goal — having all this run automatically from tickets instead of being typed by hand.

## What "done" means here

Timone's own requirements are written down as a numbered list in `doc/specs/prd/prd-01-process-layer.criteria.md` — one file, twenty-four entries, each stating what must be true and how to check it. **A requirement counts as verified only when an agent that did not build the thing has checked it and recorded evidence.** **21 of the 24 are now verified** — you signed off the last four on 2026-07-29: the delivery skill, the two-review mechanism, the handover writer and this status file.

## Done

- **The process is written down** — `process.md` is the single definition every skill obeys. When a skill and it disagree, it wins and the skill gets corrected.
- **The plumbing** — a list of managed projects, a command to copy them onto your machine, and the rule that work happens here rather than inside a client's repository.
- **Nine stage skills exist and have each been exercised against throwaway projects:** onboarding a new repository, sorting an incoming request, interviewing you for requirements, writing requirements down, recording architecture decisions, planning work into steps, **building the code**, **checking the result**, and — new today — **opening the pull request**.
- **A standards library** — twelve written entries. Ten cover the preferred technology choices; two apply to every project with no exceptions (accessibility, which is a legal requirement in the EU, and visual/interaction design). The twelfth is new today, below.

## Just finished

**Prototypes are in — react instead of read** (2026-08-01, decided in a five-question interview with you). A prototype is a rough, clickable version of an idea, built cheap and thrown away, existing so you can *react* to something instead of reading a document. It now serves two moments: settling a "how should this look or behave?" question on a discovery map (the entry below), and the requirements stage — where, for anything with a user interface, you can be walked through a clickable mock while approving the requirement list, instead of only reading it. Two rules keep it honest. First, **approving a mock never replaces approving the written requirements** — a mock always shows less than the requirements say (what happens on errors, what is mandatory versus nice-to-have, accessibility), so the agent must point out every place the mock and the list differ before asking for your sign-off. Second, **prototype code is built to die**: it lives on its own branch, is never merged, never becomes the starting point of real work, and is deleted once your reaction is recorded — the reaction is what is kept, not the code. A small dedicated skill, `timone-prototype`, owns that whole lifecycle. Decision record: `doc/adr/0011-prototype-convention.md`. Untested caveat: the machinery meant to serve these mocks as clickable pages (the Docker preview decision from day one) has never actually done so — the first prototype is its test.

**A new skill for big, foggy ideas** (2026-08-01). Until now, digging requirements out of you happened in a single interview sitting — fine for one feature, hopeless for an idea too large to settle in one conversation. The new `timone-wayfind` skill charts such an idea as a **map**: a list of open questions kept on the project's issue tracker, each sized to one working session, with the dependencies between them drawn in so it is always visible which questions are ready to tackle. Sessions then resolve them one at a time — interviewing you, or researching alone — until nothing is left to decide and the requirements get written down the normal way. The map is scratch paper, not the record: any decision that matters is promptly moved into the permanent documents, because tickets organise work and never hold the truth — a rule you set on day one, which this design keeps (the reasoning is recorded in `doc/adr/0010-wayfinder-discovery-maps.md`). It is adapted from a published skill by Matt Pocock, with one deliberate cut: it never builds anything — building has its own stages. (A second cut made that morning, leaving out its "prototype" question type, was reversed the same day — see the entry above.) It has not yet been used on a real idea — the first oversized one is its test.

**The delivery skill is built, and it has opened two real pull requests** (2026-07-28). This was the last stage before feedback.

Delivery does one thing: it puts finished work in front of you, with everything you need to judge it. It does not improve the work, does not merge it, and does not decide anything the pull request exists to let you decide.

Two independent reviews run before the pull request opens, and **they are deliberately never blended into one list**. One asks *"does this follow the conventions we agreed?"*. The other asks *"did it build the thing we actually asked for?"*. They are kept apart because code can follow every convention while building the wrong thing, and can build exactly the right thing while breaking every convention — a single merged list hides that difference.

**Neither review is allowed to change anything.** They report; you decide. Anything worth acting on goes through the feedback stage, which is the next skill to build. This resolved a genuine contradiction in `process.md`, the written rulebook every skill obeys: the building stage had been telling its agents "leave the tidying-up to the delivery review", which reads as a promise that delivery *does* the tidying — while the delivery stage said the reviews only report. Delivery cannot be allowed to change code, because that code would land *after* the checking stage signed off and *before* you read it, quietly invalidating the sign-off at the moment it is being shown to you. So the building stage's sentence was the one that was wrong, and it has been corrected.

**A twelfth standards entry was written and you approved it:** a fixed list of code smells (`standards/code-smells.md`) — twenty things a reviewer looks for in a change, each with the signal that identifies it. The conventions review had been specified against this list for weeks, and the list had never existed.

**Two pull requests were opened on the to-do app. You merged the first on 2026-07-29** — the first work Timone has ever put through the whole process end to end, from an empty repository to merged. The second is still open and listed under *Waiting on you*.

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
| **Feedback** | Takes your "that's not what I meant" and works out whether the requirements were wrong or the code was | **The one real gap.** The plan for building it is written and waiting for your approval — see *Waiting on you*. |
| **Deployment** | Releases approved work to a live environment | Deliberately later — defined in `process.md`, the written rulebook every skill obeys, no skill yet |
| **Maintenance** | Turns dependency updates and production issues into new incoming requests | Deliberately later — defined in `process.md`, the written rulebook every skill obeys, no skill yet |

**Then** the second half of the vision: instead of you typing instructions, a background service watches your tickets and drives these same stages itself, posting questions and results back to the ticket. Nothing on that has started.

## Waiting on you

**One thing on Timone itself: approve the feedback-stage plan** (2026-08-01, `doc/plans/phases/phase-10.md` in the Timone repository). It is the written plan for the last missing skill — the one that takes feedback on delivered work and acts on it. Its two ground rules, for your judgement: the feedback skill **never changes code itself** — it sorts each piece of feedback into *we asked for the wrong thing*, *it was built wrong*, or *the paperwork is wrong*, proposes a response, and moves only after you confirm each item (you can also decline or postpone any of them); and anything that does touch code goes back through the normal build → check → deliver stages, so no change ever lands unchecked. Proving it will finally spend the material saved for exactly this: the nine review findings from the to-do app's first pull request, the old "completed todos reappear" bug report from day one (long since fixed — the skill must recognize that rather than invent work), and one case where a review suggested the *requirements* should change. Nothing else on Timone waits on a human.

**Previously settled:** You settled the last open question on 2026-07-29: this file is written only on a project's main line, never on a working branch. Every stage rewrites the whole file, so two branches editing it collide the moment the second one merges — a collision in the one document meant to tell you where things stand. That rule is now in the rulebook and in the two skills that write it. **The to-do app still carries the old arrangement on both its open branches; fixing that is listed below.**

**Three things on the to-do app** (`projects/scratch-app`), which has its own status file at `projects/scratch-app/STATUS.md` — now on its main line only:

1. **~~Pull request #1 — the to-do list itself.~~ Merged 2026-07-29.** Its nine review findings were deliberately not acted on; they are the working material the feedback skill will be built against. Nothing was lost by merging.
2. **Pull request #2 — the speed check:** <https://github.com/fvermaut/scratch-app/pull/2>. Now that #1 has merged, this one points at the main line and merges cleanly. It still asks you to decide a speed limit: the check demands a list read finish in under 2 milliseconds, which passes comfortably here but was seen to fail once on a busy machine, and the number was never measured — it was guessed.
3. **Listen to the app with a screen reader** (VoiceOver + Safari) and confirm the controls are announced sensibly. No automated test can settle this; your own accessibility standard says so outright. The step-by-step script is in `doc/plans/phases/reports/phase-01-verification.md` **in the scratch-app repository, not this one**. Note this is now merged work with one accessibility requirement still unconfirmed.

## Known problems not yet fixed

- **This file was wrong until today, and that is itself a finding.** While the delivery skill was being proved, the to-do app's status file was updated and this one was not — so for several hours the two disagreed about whether the delivery stage existed at all. The rule says a stage that changes things and leaves the status file stale has not finished. Timone's own work puts documentation last, which is exactly the window where this can happen.
- **The onboarding skill cannot repair a project.** It refuses to run on any project already registered — which is every project that could have a file missing. It is now a tracked requirement rather than a loose note.
- **Nothing detects when the standards library goes out of date.** Five entries were wrong in one weekend, each correct when written, each found only because something finally ran it. Now a tracked requirement — deliberately without a solution attached, because picking a mechanism now would be guessing. It needs an interview session first.
- **Timone's own work is planned by hand.** The planning skill only works on managed projects, by choice. So this file's sections are hand-written, not generated.
- **The give-up-and-ask-a-human path has never fired — now true of three skills.** Building, checking and delivering all have a "I've tried and stopped, over to you" route, fully written and never triggered. Same reasoning each time: provoking it means building a trap designed to defeat a competent agent, which tests my ingenuity rather than the tool. The first real failure on real work is its test.
- **The status file was fixed by hand on a live pull request.** The to-do app had no copy on its main line and two divergent copies on its branches — the collision you predicted, which fired the moment the second merge was attempted. All three now agree. What is *not* solved is prevention: the rule is written down, but nothing checks that a stage obeyed it.

## Jargon key

Only if you need it. **Skill** — a written instruction file an agent loads and follows for one stage. **Stage** — one step of the process, from sorting a request through to maintenance. **Phase** — a chunk of work planned and built as one unit; the numbered "phase 07" and "phase 08" in this file are Timone's own chunks of work, in order. **Branch** — a named line of development in Git; **merging** joins one into another, and **`main`** is the primary one. **Pull request** — the page where a branch is reviewed and where you press merge. **Requirement** — a numbered, checkable statement of what something must do; Timone's own are in `doc/specs/prd/prd-01-process-layer.criteria.md`. **Verified** — checked by an agent that did not build the thing, with evidence recorded.
