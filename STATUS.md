# Timone — Status

**Written for fvermaut, in plain language.** Agents write this file. They never read it as a source of truth — the requirements, plans and reports are. Everything below is about the Timone repository unless it names a project.

**Last updated:** 2026-08-20, late evening.

---

## Waiting on you

> **Read this first, it is new.** I was asked to build the one-step-one-ticket work and the container work, one after the other. **The container work started and three of its twelve pieces are built.** The one-step-one-ticket work **did not start at all** — reading the code against the plan first turned up four things only you can settle, and two of them would have broken something that works today. Nothing was built on a guess. Details in item 5.

**0. One thing changed that you will notice.** From now on, **the daemon will not start any job while there are uncommitted changes in the Timone folder**. It says which files, in the daemon's log. This is on purpose — every job has to follow one saved copy of the rules, and running rules you cannot see on screen is the confusion this prevents. But it is live *now*, before the container work that it was built for. So if you start the daemon and nothing happens, check the log and commit or undo your own edits first.

**1. Make a GitHub account for Timone.** This is new, and nothing about running agents in containers can start until it exists. Create an account — any name you like — and invite it to `ivtrends` and `scratch-app`. About an hour, once.

Today the machine has no account of its own. It borrows yours. That is why every comment it writes looks like you wrote it, and it is also why an agent working on one project can currently reach every repository you can. Its own account fixes both.

**And confirm the wording of the container promise, which takes five minutes.** It was written from your seven rulings and marked "awaiting your confirmation", and it is what the whole container plan is measured against. It is in `doc/specs/prd/prd-02-inversion-of-control.criteria.md`, called R23 — six short paragraphs. Read them and say yes, or say what is wrong. Twelve pieces of work sit behind it.

**2. The trading app's latest piece stopped, and it was not its fault.** `ivtrends` [#1](https://github.com/fvermaut/ivtrends/issues/1) has delivered four pieces. The fifth stopped on a server error at the other end. It needs one command:

```
timone retry ivtrends#1
```

The ticket has both labels it needs now, so once it is running again it carries on by itself.

**3. One job on the to-do app needs restarting.** `scratch-app` [#13](https://github.com/fvermaut/scratch-app/issues/13) stopped on a server error too:

```
timone retry scratch-app#13
```

**4. One old job should be thrown away.** `scratch-app` #10 was a throwaway test ticket. It is closed, but its job is still recorded as stopped:

```
timone cancel scratch-app#10
```

**5. Four decisions block the one-step-one-ticket work. It cannot start without them.**

This is the work that splits a big job into one ticket per step, so a thread stops reaching 73 comments. The plan for it is written. Reading it against the code before building found four things the plan cannot decide for itself. They are written up in full at the top of `doc/plans/phases/phase-29.md`; here they are in short.

- **A deletion in the plan would stop `timone retry` from working.** The decision you approved says to delete a piece of bookkeeping because the only thing using it is going away. That is not right — it is also what keeps a **failed** job sitting still so `timone retry` can restart it where it broke. Delete it as written and either failed work stops being restartable, or the machine opens a new job beside the failure and then refuses your retry. **Keep the piece and delete only the counting, or change the behaviour on purpose?** My advice is keep it. It is yours to settle because the written decision is the thing that is wrong, and only you can change that. ([#51](https://github.com/fvermaut/timone/issues/51))
- **Which number does `timone retry` take after the change?** Today a job belongs to the ticket you filed. After the change, each step is its own ticket. So does a job belong to the step's number or to the original one? If the step's, then the command you are told to type becomes `timone retry scratch-app#27` for a step you never filed. If the original, nothing records which step a merged pull request finished. **It changes what you type, so it is yours.**
- **Should `timone status` be allowed to get slower?** To say which step is live it has to ask GitHub, and today it answers instantly from a local file. Three ways out: remember the answer locally, show less, or accept the wait. **Which?**
- **How does one step say it is waiting for another?** GitHub can now record this itself, and there is also a plain "Blocked by: #12" line written into the ticket. Nothing in the code reads either yet. **Native, the written line, or both?** Two pieces of the work need the same answer, so nothing starts until this one is settled.

**Three older rules also need a ruling.** None of them blocks anything today.

- You asked for two things that cannot both be true: every open ticket must say what happens next, **and** a repository joined with a big backlog stays silent. On such a repository, an unlabelled ticket would say nothing. Which rule wins?
- On 14 August the machine was supposed to give up and hand a conversation back to your terminal. It worked the answer out instead, and you called that a pass. Should the rule change, or the behaviour?
- **New, from yesterday's test:** a ticket whose requirements are already written and agreed was picked up as brand-new work. The sorting step read the branch, said *"the next open step is the build plan, not another round of requirements discovery"* — and was then sent into another round of requirements discovery, because it routes on the label and nothing else. Should it be allowed to route on what it finds? ([#32](https://github.com/fvermaut/timone/issues/32))

**6. The slow-page report is unstuck, and now it needs you.** `scratch-app` [#4](https://github.com/fvermaut/scratch-app/issues/4) sat for seventeen days at a step that had never been built. That step exists now, and it has looked at the problem and written up what it thinks. Read what it says on the ticket and reply there — `approve` if you agree, or say what you want different.

It found a mistake it had made itself in August: it had told you the app already promises a tick shows up straight away, and it does not. So it wants to write that promise down first, and it has guessed the numbers. The numbers are the part worth arguing with.

---

## Where things stand

Timone makes AI agents follow a written engineering process instead of improvising. It runs in stages: sort the request, dig out requirements, write them down, record decisions, plan, build, check, deliver, act on feedback. Ten of the twelve stages have a working skill. The two that do not — releasing to a live environment, and routine maintenance — are left for later on purpose.

The second half of the idea is that a background program — the daemon — drives those stages from your tickets, so you only answer, approve, review and merge. Most of that is built.

**Two lists of promises measure it, and a promise counts only when an agent that did not build the thing has checked it.**

| List | Where | Kept |
|---|---|---|
| The process | `doc/specs/prd/prd-01-process-layer.criteria.md` | 22 of 24 |
| The automatic loop | `doc/specs/prd/prd-02-inversion-of-control.criteria.md` | 12 of 22 |

Of the ten on the second list that are not kept: four lost their tick because you changed what they promise, one was checked and failed, and five have never been checked at all. The newest of the four lost it on 18 August, when you changed one of the rules yourself (below). **Nothing on that list moved on 19 August**, deliberately — four of the promises gained notes about what happened, and a promise only gets its tick back when somebody who did not build the thing checks it.

1134 automatic tests pass. Tests are not the same as somebody watching it work.

---

## What changed recently

**20 August, late — three pieces of the box are built, and the other work stopped before it started.** The branch is `phase-30-work-in-a-box`, nothing is merged, and there is no pull request yet.

Built and checked:

- **A job now says what to clone and at which exact version**, instead of naming a folder on your disk. Nothing behaves differently yet — it is the shape the container work needs, changed on its own so it can be read on its own.
- **The daemon refuses to start a job when your Timone folder has uncommitted changes**, and names the files. See item 0 above: this is live now.
- **The box itself exists** — a container image with node, the tools, GitHub's command, the Claude command and all three browsers. It has no way to make containers of its own, and that is checked rather than assumed. It is 3.3 GB and takes about seven minutes to build the first time.

One check earned its keep. All three browsers load a page perfectly well on the small default shared memory, so the browser test would **not** have caught that the setting was too small — Chromium would have died later, on a real page, looking like an unrelated crash. The check measures the number instead. The container has to be started with `--shm-size=1g`, and the piece that starts containers has to pass it.

**Nothing else in the container work can start**, and the reason is item 1: the machine has no account of its own. Four of the twelve pieces need it. Reading the plan against the code also found that the piece meant to stop the machine touching your folder would, as written, have forbidden two things it promises not to touch — the safety check and the preview machinery. That is written into the plan now, not discovered later.

**Five faults were filed that had been carried in somebody's head since 17 August** — [#47](https://github.com/fvermaut/timone/issues/47) a call to GitHub can hang for ever, [#48](https://github.com/fvermaut/timone/issues/48) a dropped connection fails the job instead of being retried, [#49](https://github.com/fvermaut/timone/issues/49) a slow cycle is reported as the machine not running at all, [#50](https://github.com/fvermaut/timone/issues/50) a failed connection is reported as a branch that does not exist, and [#51](https://github.com/fvermaut/timone/issues/51) the deletion in item 5. There is also a likely cause for the test that fails now and then, added to [#8](https://github.com/fvermaut/timone/issues/8).

**18 August — the machine stops asking you the same question.** On the trading app it asked you the same thing five times. You answered four times. Each answer started the same expensive job again, which read your answer, decided it could not do what you asked, and asked again. It was right every time: you were telling it to change the very promises it was checking against, and it may not write those itself.

Now a job that is asked for something it may not do stops once. The ticket says so plainly, says that writing another answer will not move it, and gives you one command to run:

```
timone takeover <project>#<number>
```

That command opens the job in your terminal with everything it knows about where it stopped, and there it can do things it cannot do on its own. If a job never notices it is stuck, the machine notices for it: asking you twice about the same thing after you have already answered stops it as well, and the ticket says sorry.

It has been watched on the to-do app, on two throwaway tickets I filed and answered myself. It worked, and the first attempt found a real fault: the machine wrote its explanation without the header that says "this is the machine talking", so it read its own words back as yours. That is fixed. Seventeen daemon passes over a stopped job, with two more answers written on it, started nothing and cost nothing.

You then read one yourself and caught a second fault I had called cosmetic: the message explained the stop and ended "I need nothing from you", so the one command that unblocks it was only in the pinned note higher up the page. Now the message itself ends with the command. **You read it and said yes** — [#37](https://github.com/fvermaut/scratch-app/issues/37) on the to-do app told you the truth and gave you the way out the first time. That is the first time the words on a stopped ticket have been judged by the person they are written for.

**You then ran the command on [#37](https://github.com/fvermaut/scratch-app/issues/37) and it did the job properly.** It refused to sign your name, wrote everything out, asked you one question instead of ten, got your yes in the terminal, wrote that down on the ticket for the record, and started building. It left a written account of what it did and what it guessed.

**That run then found the one thing nobody thought of**, and it is fixed. When your session ended, the job went back to being stopped: nothing could say "this is sorted, carry on", so the work sat on its branch and the daemon would never take it further. That was [#30](https://github.com/fvermaut/timone/issues/30).

**20 August — agents will work in a box, and the machine will stop touching your folder.** You asked for this: switching branch while an agent builds breaks its work. It is planned, not built.

Every job the daemon starts will run in a fresh container that fetches Timone and the project from GitHub and is thrown away after. Nothing from your disk goes in. The project's database starts next to it, from the compose file the project already keeps for previews, and the container gets no control over docker itself — that shortcut would hand the agent your laptop back.

Reading the code turned up something you did not know: your folder has **two** machine users, not one. The daemon itself also checks branches out there and merges there. Boxing the agents alone would have left your problem in place, in a form that is harder to see. So merging and reading branches move to GitHub, and `projects/` becomes yours alone.

Playwright does work in a container. There is a step in the plan that proves it rather than assuming it: the same check runs inside a box and outside one, and the two answers must match.

The plan is `doc/plans/phases/phase-30.md` — twelve pieces, the first four fix your branch problem and the rest build the wall. The reasons are in `doc/adr/`, numbers 41, 42 and 43. **It runs after the one-step-one-ticket work and before the trading app restarts**, which is the order you chose.

One thing to know: after this, a project with no compose file cannot be built by an agent at all. `ivtrends` has not got one.

**19 August — bug reports go somewhere now.** Drawing the whole machine out on one page showed that one of the four kinds of request it sorts into had nowhere to go: a bug was sorted, sent on to a step that had never been built, and stopped there for good. `scratch-app` [#4](https://github.com/fvermaut/scratch-app/issues/4) had been sitting like that since 2 August. That step is built, and four smaller mismatches the drawing exposed are fixed with it.

It was watched on #4 itself, not on a ticket I made up. It picked the report back up, worked out why the page drags, wrote it up, and asked you to read it — and in doing so it caught a mistake it had made in August: it had told you the app already promises a tick shows up straight away, and it does not. It says so itself, on the ticket.

There is a drawing of how the whole thing works now, for you rather than for the machine. **All of this is on a branch waiting to be merged** — `docs/daemon-state-machine`. Merging it is yours.

**19 August — what you sort out in your terminal now goes back to the machine.** You ruled on three questions and the work is built. The session you open clears the blockage and stops there: it writes the words a decision needs — the requirements, the reasons, a correction — and it does not build the thing. Building goes back to the daemon, where it arrives one piece at a time, each piece costs a visible amount, each stops for you where it should, and a second pair of eyes checks it. Then the session leaves one comment saying it is sorted and where to carry on, and the daemon picks it up on its next pass. Nothing for you to type. If it names a place the machine does not recognise, the ticket says so and quotes what it wrote, rather than guessing and starting the wrong work.

**Half of it has been watched.** On a throwaway ticket, a note saying "carry on at writing down what it needs" made the daemon pick the job up by itself, take the branch and start that step, and the ticket stopped saying it was stuck — nothing typed. A note naming a place the machine does not know left the job where it was and said so, quoting the words back. Writing another answer still started nothing.

That test found a third fault and it is fixed: once the machine had refused a note, a corrected one could never be read, so the ticket asked you to come back and then ignored what you said. The newest note now wins.

**And you watched the part that needed you.** You opened a stopped ticket, said yes at your keyboard, and the session wrote the requirements and stopped — it built nothing, and said in its own note that not building was the point. Then the daemon picked the work up by itself, on the same branch, at the step the note named. Your words: *it stopped right*.

Two things came out of that run. The daemon you started read the real job list instead of the test copy, so it treated the test ticket as brand-new work: it said "the requirements are already approved, the next step is the plan" and then asked you for a fresh conversation anyway. That contradiction is filed as [#32](https://github.com/fvermaut/timone/issues/32) and needs your ruling. And the safety check keeps blaming this work for a merge you made yourself on 16 August — [#33](https://github.com/fvermaut/timone/issues/33).

The last unwatched thing is the far end: letting a handed-back job run all the way to a pull request. Nothing is stopping it; it just costs money and nobody has spent it yet.

Two smaller things still have nobody watching them: the safety net for a job that never notices it is stuck, and what a stopped job costs when it is holding a project. Both are in `doc/plans/phases/reports/phase-25-live-gate.md`. The full account is in `doc/plans/phases/reports/phase-25-live-gate.md`.

**16 August — tickets are written short.** You said the machine's tickets and comments were too long. There is now a written rule in [`process.md`](process.md#writing-to-the-human), and every skill points at it. Short sentences, common words, no words that only make sense if you have read the process. A comment is a few sentences. Requirements and technical detail are links to files, never text on a ticket. A test fails if a message grows past 150 words.

**16 August — a job that stops to ask you something now waits instead of failing.** Before, it was recorded as broken, so your written reply was picked up by nothing, and the command the ticket offered you could not be run while the daemon was up. Both are fixed. The cost you accepted: a job waiting on you holds its project until you answer, and `timone cancel` is the way out.

**15 August — you agree the pieces once, and they arrive one at a time.** A big job is now proposed as a list of pieces. You say yes to the list once. Each piece is then built and delivered as its own pull request, small enough to read. A small chore skips approval entirely and is judged on its pull request — you chose that knowing nothing stops a misread chore before the work happens.

**14 August — every open ticket says what happens next**, checked and repaired every minute. A ticket you file without the label gets exactly one comment explaining why nothing is happening.

**14 August — one written answer sets one session going, not two.** You proved this yourself, by answering three throwaway questions in your own words and judging the replies.

**Both of these are finished and closed** — the two pieces of work are written up in `doc/plans/phases/reports/phase-25-*.md` and `phase-26-*.md`, and the two faults they were for are closed on Timone's own list ([#28](https://github.com/fvermaut/timone/issues/28), [#30](https://github.com/fvermaut/timone/issues/30)). What was watched and what was not is in the reports, said plainly.

Earlier work is in the reports under `doc/plans/phases/reports/`, one file per piece of work. It used to be repeated here at length; it is not any more.

---

## Not proven yet

- **Nobody has watched the 15 and 16 August work run.** No real ticket has been through the list-of-pieces machinery, and no stopped job has been restarted by a written reply. The 18 and 19 August work *has* been watched, on throwaway tickets — that is the difference between those two lines.
- **Two rules are written and nothing enforces them.** A piece must not be built without your approval; and a session you open on a stopped job must not build it. Sessions obeyed both when watched. Nothing checks either.
- **The safety net has never fired in the wild.** If a step never notices it is stuck, the machine is supposed to notice after you have answered the same thing twice. That is proven by test and has not been seen live, because every step that was watched noticed by itself.
- **A stopped job that is holding a project has not been watched blocking one.** It is the cost you accepted on 16 August, and it is still only argued.
- **A handed-back job has not been watched running all the way to a pull request.** It was stopped on purpose when the test ticket was done.
- **One accessibility check on the to-do app is still owed.** Listen to it with VoiceOver and Safari and confirm the controls are announced sensibly. The script is in that project's own repository, at `doc/plans/phases/reports/phase-01-verification.md`. It needs about twenty minutes.

---

## Known problems

**They are all filed now**, one each, on [Timone's own repository](https://github.com/fvermaut/timone/issues). They used to live only in this file. The list below is a pointer — read the ticket for the detail.

The ones that would bite you in ordinary use:

- [#5](https://github.com/fvermaut/timone/issues/5) — a running daemon keeps using the code it started with. Nothing is running right now, so the next one you start has everything below in it.
- [#32](https://github.com/fvermaut/timone/issues/32) — the sorting step can see the work is further along and is routed as if it were not, on the same ticket, in the same breath.
- [#9](https://github.com/fvermaut/timone/issues/9) — the safety check blames the machine for a change you have not committed. Commit or stash your own work before the machine starts.
- [#13](https://github.com/fvermaut/timone/issues/13) — a list of questions is only finished if somebody remembers to label it. This is what silently stopped the trading app.
- [#12](https://github.com/fvermaut/timone/issues/12) — a job whose ticket was closed while it waited still starts, and is billed.
- [#7](https://github.com/fvermaut/timone/issues/7) — a ticket that calls itself a throwaway still has its decisions written into the project for good.

- [#23](https://github.com/fvermaut/timone/issues/23) — the safety check blames this work for merges you made yourself in the browser, and counts one of them once per branch it sits on. It has now been filed three times by three different sessions; the duplicates are closed.

The rest, in short: [#1](https://github.com/fvermaut/timone/issues/1) a stopped job could not be reached (the 16 August work fixes this, and it stays open until somebody watches it), [#3](https://github.com/fvermaut/timone/issues/3) and [#4](https://github.com/fvermaut/timone/issues/4) two messages that do not say enough, [#6](https://github.com/fvermaut/timone/issues/6) a misleading log line, [#8](https://github.com/fvermaut/timone/issues/8) a test that is slow rather than wrong, [#10](https://github.com/fvermaut/timone/issues/10) a wrong live count, [#11](https://github.com/fvermaut/timone/issues/11) a killed session reported as working, [#14](https://github.com/fvermaut/timone/issues/14) and [#15](https://github.com/fvermaut/timone/issues/15) two faults in what `timone status` tells you, [#16](https://github.com/fvermaut/timone/issues/16) pieces of one job indistinguishable in history, [#17](https://github.com/fvermaut/timone/issues/17) onboarding cannot repair a project, [#18](https://github.com/fvermaut/timone/issues/18) nothing notices stale standards, [#19](https://github.com/fvermaut/timone/issues/19) every message appears under your name.

**Two things are on purpose and are not filed.** A daemon killed outright leaves its project locked for about two minutes — that is a deliberate trade. And Timone's own work is planned by hand, which is why this file is written by hand.

**One is a gap rather than a fault**, so it is not filed either: the "I have tried and I am stopping, over to you" path exists in building, checking and delivering, and has never once fired. The first real failure on real work is its test. The same is true of the 18 August work, which is the stronger version of that path.

---

## What is left to build

1. **A chat channel** (Slack or Teams), so the machine can ask you a short question at the moment it needs to, instead of settling for a fixed rule.
2. **The bug-report path.** `scratch-app` #4 is parked waiting for exactly this.
3. **Releasing to a live environment**, and **routine maintenance**. Both are described in `process.md` and neither has a skill yet.

---

## Where the detail lives

- The process itself: [`process.md`](process.md).
- Decisions and why they were made: `doc/adr/`.
- What was built, and what each build did or did not prove: `doc/plans/phases/reports/`.
- The to-do app has its own status file at `projects/scratch-app/STATUS.md`.

**What I need from you:** say the word and I will put the two labels on [ivtrends #1](https://github.com/fvermaut/ivtrends/issues/1), which is the only thing standing between the trading app and its specification. The rest of this list can wait.
