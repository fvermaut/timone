# Timone — Status

**Written for fvermaut, in plain language.** Agents write this file. They never read it as a source of truth — the requirements, plans and reports are. Everything below is about the Timone repository unless it names a project.

**Last updated:** 2026-09-04, night.

---

## Waiting on you

> **Read this first.** Timone worked one of its own tickets tonight. It stopped near the end for a good reason, that reason has been decided and built, and **the ticket can now finish.** One thing is worth two minutes.

**1. Answer on [#39](https://github.com/fvermaut/timone/issues/39) so its work can finish.**

Timone sorted, planned, wrote and checked this ticket on its own, in a container, in 34 minutes for $6.22. It stopped at the last check and asked a question. **The question has been answered** (below), so the job can pick up where it left off, finish, and open a pull request for you to merge.

Reply on the ticket, or:

```
node dist/cli.js takeover timone#39
```

**Why it matters:** nothing Timone has built for itself has reached a pull request yet. This would be the first.

**2. What it asked, and what was decided.**

Timone checks its own work against 20 promises. Tonight **2 could be checked and 18 could not be checked at all** — the sealed container it works in has no Docker, no key that reaches your other projects, and no copy of them, and almost everything Timone promises is about those things.

You approved the answer. It is written down as [ADR-0051](doc/adr/0051-timone-verifies-itself-by-live-gate-and-a-regression-set-is-narrowed-by-what-it-depends-on.md).

Those 18 promises are now marked as **"only a watched, running machine can check this"** — which is what tonight was. Each one now says what it needs and which watched run last saw it working. Sixteen say **"never"**. That is not new, it is the first time it has been written down: nothing was checking them before either, and now the file says so and names a report when there is one.

**Nothing about the container changed.** No new keys, no new access. That was the point.

**One thing you should know is weak.** A promise marked this way can be quietly forgotten — "never" is a true sentence nobody has to act on. The only thing that catches it is the rule that a job touching that machinery must run a watched check before it delivers. Nothing enforces that automatically.

**3. Before you start the machine again, build first.**

```
npm run build && node dist/cli.js daemon
```

**Do not use the `timone` command installed on your machine.** It is old code, and the machine has written a line to its notes that the old command cannot read — every `timone status`, `timone takeover` and `timone daemon` would fail until you reinstall.

**4. The to-do app's step 2 is still stopped and it is still a real question for you.**

[scratch-app #47](https://github.com/fvermaut/scratch-app/issues/47) asks you to drop the old "no reordering" rule and answer three questions about how moving a row should behave. It cannot be planned until you do, and step 1 ([#46](https://github.com/fvermaut/scratch-app/issues/46)) is stopped for the same reason.

Answer on the ticket, or:

```
node dist/cli.js takeover scratch-app#47
```

**3. Timone cannot check most of its own promises when it works on itself. This is new tonight.**

Timone now works tickets on its own repository, and each of those runs happens inside a sealed container. Tonight one of those runs checked the newest piece of work in the **Timone repository** — the branch `timone/39-primary-sources-owed-for-the-ui-ux-basel`.

Twenty promises are meant to be re-checked every time anything is delivered. **Two were checked and both hold.** The other eighteen could not be checked at all. Nothing about them is broken — the container simply has no way to run them. It has no Docker, none of the machine's login keys, and no copy of the to-do app or the trading app. Every promise about the background program, about the preview link on a pull request, and about what Timone does to somebody else's repository needs at least one of those three.

Three of the eighteen are worse than that: they are written so that they only count if **you** confirmed something. No unattended run can ever watch you confirm, so as written those three can never be checked this way at all.

Two smaller things came out of the same run. Timone's own safety check refuses to let the checking stage write into the folder that only the checking stage is allowed to write into — it asks a person for permission, and inside a container there is no person to ask. And one link in the design-rules file (`standards/baseline/ui-ux.md`, dated 19 August) points at `ivtrends` pull request 22 and answers "not found" to anyone not logged in; it is probably just a private repository, and it is older than tonight's work.

The full record is [the check's report](doc/plans/phases/reports/phase-33-verification.md), on that branch in the Timone repository. The work on that ticket is **stopped there** and has not gone to a pull request.

**What I need from you:** decide which way to go — give a run in a container what it needs to check these eighteen, or move those checks somewhere that already has it. Until one of those happens, every ticket Timone works on its own repository will stop in exactly this place.

**Nothing else needs you.**

---

## What is fixed, in the words of what used to go wrong

Seven ways a job could be lost. All seven are now built; four of them were watched happening correctly this evening on the to-do app.

**A job you picked up by hand is no longer taken away from you.** The machine used to decide a job was dead if it had been quiet for two minutes. Now a job says **which program is holding it**, and the machine asks the operating system whether that program is still running. A program that is thinking says nothing for as long as it thinks; a program that is gone is gone. Watched: a job held at a terminal for nearly four minutes, and the machine left it alone.

**"Working on it now" stops being a lie.** If the thing running a job is killed, `timone status` says so — **without the machine running at all**. It used to say "working on it now" for ever, because the only thing it had to go on was a clock, and a clock tells you nothing when nobody is watching it. Watched: a killed job read *"nobody is running this any more"* eleven seconds after it died, with nothing else running.

**Asking for a job and giving up no longer hands it to a terminal you have closed.** `timone takeover` used to leave its request on disk when it gave up waiting; the machine found it minutes later and handed the job to a terminal that was gone. It now takes the request back, and it checks whether it lost the race. It also waits long enough — two and a half minutes rather than seventy-five seconds, which was too short — and it tells you what it waited and that a long wait is not a fault. Watched, with the machine deliberately frozen.

**A job that broke through no fault of its own is tried once more before you are asked.** It used to stop dead and wait for you to type a command. If the second attempt also breaks, it stops and tells you both reasons. Watched: a job put back to work at the step it died in, with nothing said on the ticket, and the next attempt ran properly.

**A job the machine refuses to start is no longer reported as a job that died.** It used to say *"the machine running it stopped before the work was finished"* when nothing had stopped — the machine was simply refusing, once a minute, in a terminal nobody was reading. It now says the real reason on the ticket, once, after three tries. And the one refusal that goes away by itself — you having uncommitted changes here — is still retried silently for ever, because that is the right thing to do with it.

**A step you finish yourself now stops the ticket asking.** If you take a job over and finish the step, the machine reads what your session recorded instead of putting the old question back. That is what left `ivtrends` #58 asking you for an answer three hours after you had given it by doing the work. Watched.

**A ticket you close while its job is queued is not started.** This one turned out to be fixed already, on 15 August, and nobody had closed the report. It is now covered by tests that would catch it coming back.

**And one small thing you reported in August.** `timone status` used to say *"waiting on you: nothing right now"* about tickets that needed nothing. It says nothing of the kind now. The same fault appeared in a new place this evening while the work was being watched, and was fixed on the spot.

**1571 automatic tests pass.** Tests are not the same as somebody watching it work, which is why the paragraphs above say which ones were watched.

---

## Where things stand

Timone makes AI agents follow a written engineering process instead of improvising. It runs in stages: sort the request, dig out requirements, write them down, record decisions, plan, build, check, deliver, act on feedback. Ten of the twelve stages have a working skill. The two that do not — releasing to a live environment, and routine maintenance — are left for later on purpose.

The second half of the idea is that a background program — the daemon — drives those stages from your tickets, so you only answer, approve, review and merge. Most of that is built.

**Two lists of promises measure it, and a promise counts only when an agent that did not build the thing has checked it.**

| List | Where | Kept |
|---|---|---|
| The process | `doc/specs/prd/prd-01-process-layer.criteria.md` | 22 of 24 |
| The automatic loop | `doc/specs/prd/prd-02-inversion-of-control.criteria.md` | 11 of 22 |

Of the ten on the second list that are not kept: four lost their tick because you changed what they promise, one was checked and failed, and five have never been checked at all. The newest of the four lost it on 18 August, when you changed one of the rules yourself (below). **Nothing on that list moved on 19 August**, deliberately — four of the promises gained notes about what happened, and a promise only gets its tick back when somebody who did not build the thing checks it.

One promise lost its tick on 4 September — the one about a job being picked up again after the machine running it stopped. It was checked in August against a rule that has now been replaced, so it has to be checked again. That is a change of rule, not a fault.

---

## What changed recently

**4 September, night — how Timone checks its own work is decided.** [#84](https://github.com/fvermaut/timone/issues/84), closed. The two roads on that ticket were both wrong in the same way: giving the container Docker and a wider key, or moving the checks onto your machine, each make the job that can change Timone itself the **least** restricted job in the system. It should be the most.

So instead: a fourth kind of check, for what only a watched running machine can see. It is never faked, never turned into a list of steps for you, and never blocks a job on its own. Each promise of that kind now names what it rests on and which watched run last saw it. And a check is only re-run when the change could actually affect it — a change to a page of writing no longer drags twenty end-to-end checks behind it.

**4 September, night — Timone worked one of its own tickets, start to nearly finish.** The whole story is at the top of this file and in [the report](doc/plans/phases/reports/phase-32-live-gate.md). Three things are worth knowing.

**It never touched your folders.** The branch it worked on was made inside the container and pushed straight to GitHub. Your two Timone folders were untouched from start to finish.

**Every change it made says who made it.** Which step, which ticket, which session — readable from the history alone, with nothing to remember.

**One thing nearly stopped it before it started, and was only found by trying.** A project with no `compose.yaml` was refused outright, and Timone has none — it is a command-line program with no database beside it. Every Timone job would have died in the first minute with a message telling you to add a database to Timone. Not having one is a statement, not an omission.

**4 September, late — Timone is one of the projects it looks after.** Four pieces, and the order was deliberate: every guard that would have complained about a Timone job was fixed and proved able to still complain, *before* Timone was added to the list.

**The machine now says when it is running old code.** It loads its code once, when you start it, and keeps it until you stop it. It now checks each round what the main branch points at, and if it has moved on it says so — once, not once a round — and `timone status` says it too, above the projects. It names the version it is on and the command that fixes it. If it cannot reach GitHub it says nothing at all, rather than claiming to be up to date.

**A check that used to complain about correct work stops doing it.** When a branch takes a fix from `main`, everything already on `main` comes with it. The check could not tell "written here" from "arrived here", so it reported the status file as misplaced every time. It did that twice on the trading app on 30 August and again on this repository today. The two real cases from that day are in the tests, with their real version numbers.

**A job working on Timone may now commit Timone's own files.** The rules, the skills and the standards are Timone's source code. The check that keeps them out of a client's repository now asks *which repository is this*, by its address on GitHub — not by its name in the list, which anyone could type wrong.

**One thing was found only by trying it.** A project with no `compose.yaml` was refused outright, and Timone has none — it is a command-line program with no database beside it. So every Timone job would have failed on its first round with a message telling you to add a database to Timone. Not having one is a statement, not an omission: the machine now stands nothing up, says so in its log, and carries on.

1615 tests pass, up from 1588.

**4 September, late — the design-rules file got its sources, and the check that followed found something bigger.** The five rules about reading a screen of figures in `standards/baseline/ui-ux.md` now each carry a source, or say plainly that they are house style with no outside source behind them. That was the whole of the job. The check that ran after it could only run two of the twenty things it is supposed to re-check, and both of those hold. What to do about the other eighteen is the entry above.

**4 September — the seven faults above, built in one sitting.** Fourteen pieces. The plan for it said three things about the code that turned out not to be true, and each is written down in [the report](doc/plans/phases/reports/phase-31-complete.md) rather than quietly worked around — including one fault that had already been fixed in August and never closed. What was watched running for real, and what was not, is in [the gate's own report](doc/plans/phases/reports/phase-31-live-gate.md).

**22 August, afternoon — the container work is built.** Eleven of twelve pieces. The last one is your five minutes at the top of this file.

**Running in a container is now the default.** A job downloads Timone and the project from GitHub at exact versions, does its work inside, and the container is destroyed afterwards — including when things go wrong. It has no way to make containers of its own and no way to see your disk. Checked from inside a running one: no folders of yours, no `/Users`, and it does not run as the root user.

**Its database starts beside it, not inside it.** On a private network, with **nothing opened on your machine**. While this was being tested your own to-do app database was running on the same laptop, and the two never met.

**The browser checks work in the container exactly as they do outside it.** This was the one worth proving, because a browser check that quietly finds nothing — because the page never loaded — looks the same as a clean pass. The to-do app's own accessibility tests were run twice on the same version of the code: **22 passed inside the container, 22 passed outside it, the same 22 tests.** Then a page was broken on purpose and the run inside the container **failed, on exactly the three tests about that kind of fault.** So the check can fail, which is the thing worth knowing.

**It can log in to Claude, using your subscription.** Read fresh each time, kept nowhere.

**Two more things it cannot do, and both now say so plainly.** It will not run a version of Timone you have not pushed — the container downloads it, so it cannot follow a commit that is only on your laptop. And it will not build a project with no `compose.yaml`, which held the trading app up until that file was written back.

**Five faults were found by running things rather than reading them.** Three share a shape worth remembering: **a missing answer and a wrong question look identical.** A dropped connection read as "that branch does not exist". `docker compose down` succeeding while deleting nothing. A check of mine that said the to-do app had no `compose.yaml` when it has one. The other two: the container ran as the root user, which Claude refuses to work under — so it could not have run a single job — and the settings it was given never reached inside it. Eleven tests said those settings were correct and all eleven were right; none of them could see it.

1384 tests pass, up from 1224 yesterday.

**22 August — six pieces of the container work were built, and the four that fix your problem are all in.** The branch is `phase-30-work-in-a-box`. In order:

**The machine has its own identity, and it uses one key per repository.** Every message it posts and every merge it makes now goes out as `timone-agent`, not as you. The key it uses is made fresh for **one** repository and dies within the hour — a key for the to-do app cannot see the trading app at all. A test proves it asks for one repository and no more, because the thing you watched happen by hand last week does not stop somebody widening it next month.

One surprise, and it would have made three later checks pass while testing nothing. GitHub writes the same identity **two different ways** — `timone-agent` on one of its interfaces and `timone-agent[bot]` on the other — and this code reads both. Comparing against one spelling meant half the machine's own comments were read as yours. Found by posting a real comment and reading it back on each.

**It stopped reading your project folders.** Which branch exists, what a file says on a branch, how far a job's list has got — all of it comes from GitHub now. Two of these were not on the plan and would have broken silently: they read your folder with git, nothing ever refreshed that folder, and they only worked because the session happened to be running in it. In a box they would have answered "nothing was built" for work that was built.

**It stopped merging in your folder.** The one merge the machine makes without you reading a diff now happens on GitHub. It was watched doing it for real: a proper merge commit, signed by `timone-agent`, still carrying the line that says which stage made it.

**A check now says your folders are yours, and fails the tests if anyone puts it back.** It was tested by putting one back on purpose and watching it caught.

**The box can run a session.** A container starts from the image, downloads both repositories at exact versions, runs, reports what it is doing back to you live, and is destroyed on every way out — including the ones that go wrong. It is **off by default**; turning it on is the last piece. Watched for real: the download worked, the versions were exact, and nothing of your disk was inside.

**Its database and anything else it needs start beside it.** They are on a private network with **nothing opened on your machine** — the box reaches them by name. Watched for real, with a real database.

**Three bugs were found by running things rather than by reading them.** All three have the same shape, which is worth saying: **a missing answer and a wrong question look identical.**

- A dropped connection was reported as "that branch does not exist", which reads as "the stage did nothing". Fixed, and now a dropped connection stops the job and says so.
- `docker compose down` **succeeds and deletes nothing** when one setting is missing. A cleanup that reports success and leaves everything running is how a machine fills up quietly.
- A check I wrote to answer a question about the to-do app said it had no `compose.yaml`. It has one. The reading was wrong, not the app, and the reason was a bug in the new code that could not read the top level of a repository.

**Two things the machine cannot do, found the same way.** A run in a box downloads Timone from GitHub, so it cannot run a version you have not pushed — it now says that in a sentence instead of quoting git. And it cannot log in to Claude at all, which is item 2 at the top of this file.

1359 tests pass, up from 1224.

**21 August, evening — the machine now runs a job as a row of tickets instead of a count.** All ten pieces of the one-step-one-ticket work are built. Nothing behaves differently yet — nothing calls them — but they are the two halves everything after them stands on.

- **The rule.** Given a job's steps, it picks the first that is open, not waiting on another, not held by the machine and not taken by you. Four conditions, and any one of them read on its own would let a step you stopped be picked up again.
- **The reading.** It asks GitHub for a job's steps in one call — open and finished alike — with their labels, who has taken them and what they wait for.

**Two mistakes were avoided by checking GitHub rather than guessing.** A step can say it waits for a ticket in a *different* repository, and GitHub gives back only the number — so waiting for `timone #8` and waiting for the to-do app's own `#8` look identical. Reading the number alone would have checked the wrong ticket and been confident about it. And GitHub can tell you a step waits for five things and then hand over only three; that now reads as *"still waiting"*, never as *"free to start"*. Both were found by making two throwaway tickets and reading the real answers, before a line of the code was written.

- **The opening.** When you approve a list of pieces, it now opens **one ticket per piece** on GitHub, each hanging under the main ticket, and rewrites the main ticket into a map linking them all. Each piece waits for the one before it, said in GitHub's own way — so you can see the order on screen, and **you can remove one of those links yourself to let two pieces run side by side.** Nothing could say that before.

**Opening tickets is the first thing this machine does that cannot be undone by running it again**, so the care went there: running the approval twice opens nothing the second time, and if it stops half way through fourteen it opens exactly the seven that are missing when it comes back. That was proved by breaking the guard on purpose and watching the right two tests fail.

**One thing I decided and you may want to overrule.** The list of pieces you approve has no way to say "piece 9 needs piece 4 first" — the file format simply has no room for it. So I chained them in order, which is what the machine already did. If you want a list where pieces can say what they really depend on, that is a change to the file format and it is yours to ask for.

- **The picking up.** Each cycle it looks at your list of tickets and takes **one** — the first that is open, not waiting on another, not already taken by it, and not taken by you. It puts a label on the one it takes, and that label is what stops it starting the same piece twice. A fourteen-piece job does not become fourteen jobs at once.
- **The finishing.** When a piece is merged, **its own ticket** closes, saying so. The main ticket closes only when none of its pieces is left open, and it says what was really delivered — *"1 of 2 pieces were built — one was dropped"*. A job you abandoned one piece of still finishes instead of hanging for ever.

**One fault was found and fixed before it could bite.** Every piece would have been sent back to the very first step — *"tell me what you want"* — and asked you again about a list you had already approved. The old code recognised "a later piece" by a number that is now always 1. All fourteen pieces of a job would have done it, including the first.

**`timone status` still answers instantly.** It reads a picture the machine writes down each minute rather than asking GitHub while you wait. The worst that picture can be is one minute out of date, and it is only used for what it says on screen — never for deciding anything.

- **The showing.** `timone status` now tells you which step is live — *"#52 (step 2 of 3 of #7)"* — and, between two steps, that a job is alive and what is next. Nothing has ever shown you which step the machine thinks is next; the only way to see it was to run the code by hand.
- **The stopping.** Four places used to promise *"I'll start it afresh on my next pass"* about work you had told it to drop. That was untrue. All four now say the same true thing: **remove the `timone:held` label and it starts afresh, or close the ticket and it carries on without it.**
- **The counting is gone.** How far a job has got is now read off its tickets rather than counted from the machine's own records.

**One mistake I made and caught.** Deleting the counting nearly took the approval gate with it — the check that stops the machine building a longer list than the one you agreed to. How far the work has got comes off the tickets, but *what you agreed to* can only come off the file you approved. For a few minutes a job whose list had grown said "this one is finished" instead of asking you. The tests caught it and the code now explains why the two must stay separate.

**It was then run on the to-do app, and four faults turned up** — see the top of this file. All four are fixed.

1224 tests pass, up from 1138.


**21 August — you settled the five decisions that were holding up one step, one ticket.** Written down in `doc/adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md`. In short:

- **A job belongs to the step, not to the ticket you filed.** So you will type `timone retry ivtrends#57` for a step, not `timone retry ivtrends#1`. **This changes item 2 above once the work ships** — not before.
- **`timone cancel` throws the work away, as it always has.** The step stays open and the machine does not start it again. It writes on that ticket what your two ways out are.
- ~~**The machine holds a stopped step by assigning it to itself.**~~ **Changed the same afternoon: it uses a label.** GitHub does not let a machine identity be assigned to a ticket — tested every way once the identity existed, and every one refused. The label was the other option you were offered, so nothing new was decided. It also means the identity was never needed for this job at all, and the one-step-one-ticket work waits on nothing.
- **To make it do a dropped step after all, you remove the label** and it starts it afresh. This is the only thing in the whole system with no command to type — it is two clicks on GitHub, and removing a label is something you can do on any GitHub screen. Say the word if that grates and I will add a command.
- **A step you throw away does not stop the job finishing.** It closes saying "thirteen of fourteen, step 7 dropped" rather than pretending all fourteen were built. It works out which is which by whether a pull request ever merged, so you never have to remember to close it a particular way.
- **`timone status` stays instant.** It reads a picture the machine writes down each minute, rather than asking GitHub while you wait.
- **A step says it waits for another using GitHub's own "blocked by".** If you type `Blocked by: #60` in a ticket instead, the machine will tell you it saw it and that it does not act on it — rather than ignoring you and building the thing early.

Two of these correct the decision you took on 20 August rather than adding to it. It said to delete a piece of bookkeeping that turns out to be what makes `timone retry` work at all ([#51](https://github.com/fvermaut/timone/issues/51), now closed), and it said a cancelled step would simply be picked up again — which would have made `timone cancel` undo itself a minute later, while the command has printed *"I won't pick this chunk up again"* since the day it was built.

**The identity is built and the plan is updated.** No code was written against any of it — the checks came first, which is why the assigning turned out to be impossible *before* two pieces of work were written against it rather than after.

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
- **A Timone job has never reached a pull request.** One ran all the way to the last step on 4 September and stopped there. The reason was decided and built the same night, and the job can now finish — it needs your reply on [#39](https://github.com/fvermaut/timone/issues/39).
- **Sixteen of Timone's own promises have never been watched working.** They now say so, each in its own line, which is more than was true this morning. Nothing forces anybody to act on that.
- **One of the two checks fixed on 4 September was never seen working for real.** The rule about the status file being written in the wrong place: the job that ran never wrote one, because it stopped before the step that writes it. It is proven by tests and by replaying two real cases from August, and not by watching.
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

0. **Five minutes of yours to finish the container work** — item 1 at the top of this file. Everything else in it is built.
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
