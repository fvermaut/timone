# Timone — Status

**Written for fvermaut, in plain language.** Agents write this file. They never read it as a source of truth — the requirements, plans and reports are. Everything below is about the Timone repository unless it names a project.

**Last updated:** 2026-08-18.

---

## Waiting on you

**1. The trading app is stuck, and it needs two labels.** All fifteen questions on `ivtrends` are answered and closed. The list that holds them — [ivtrends #1](https://github.com/fvermaut/ivtrends/issues/1) — carries neither label it needs, so nothing is watching it. If you write "go ahead" on it today, nothing will happen. This is the same failure you hit on 13 August.

- `timone` — without it, no job is ever created for the ticket.
- `wayfinder:frontier-empty` — this is what says the questions are all answered. It is what makes the ticket ask you for the go-ahead, and what makes your reply count as one. **This label does not exist in that repository yet and has to be created first.**

**Tell me to do it and I will**, in that order. Then the ticket will ask you itself, within a minute, and you answer it in your own words.

**2. One job on the to-do app needs restarting.** `scratch-app` [#13](https://github.com/fvermaut/scratch-app/issues/13) stopped on a server error. Run:

```
timone retry scratch-app#13
```

**3. One old job should be thrown away.** `scratch-app` #10 was a throwaway test ticket. It is closed, but its job is still recorded as stopped. Run:

```
timone cancel scratch-app#10
```

**4. Two rules need your ruling.** Neither blocks anything.

- You asked for two things that cannot both be true: every open ticket must say what happens next, **and** a repository joined with a big backlog stays silent. On such a repository, an unlabelled ticket would say nothing. Which rule wins?
- On 14 August the machine was supposed to give up and hand a conversation back to your terminal. It worked the answer out instead, and you called that a pass. Should the rule change, or the behaviour?

**5. Nothing you can do about `scratch-app` [#4](https://github.com/fvermaut/scratch-app/issues/4).** It is waiting at a step that has never been built. It stays there until that step exists. It is listed so you are not left wondering.

---

## Where things stand

Timone makes AI agents follow a written engineering process instead of improvising. It runs in stages: sort the request, dig out requirements, write them down, record decisions, plan, build, check, deliver, act on feedback. Ten of the twelve stages have a working skill. The two that do not — releasing to a live environment, and routine maintenance — are left for later on purpose.

The second half of the idea is that a background watcher drives those stages from your tickets, so you only answer, approve, review and merge. Most of that is built.

**Two lists of promises measure it, and a promise counts only when an agent that did not build the thing has checked it.**

| List | Where | Kept |
|---|---|---|
| The process | `doc/specs/prd/prd-01-process-layer.criteria.md` | 22 of 24 |
| The automatic loop | `doc/specs/prd/prd-02-inversion-of-control.criteria.md` | 12 of 22 |

Of the ten on the second list that are not kept: four lost their tick because you changed what they promise, one was checked and failed, and five have never been checked at all. The newest of the four lost it on 18 August, when you changed one of the rules yourself (below).

1063 automatic tests pass. Tests are not the same as somebody watching it work.

---

## What changed recently

**18 August — the machine stops asking you the same question.** On the trading app it asked you the same thing five times. You answered four times. Each answer started the same expensive job again, which read your answer, decided it could not do what you asked, and asked again. It was right every time: you were telling it to change the very promises it was checking against, and it may not write those itself.

Now a job that is asked for something it may not do stops once. The ticket says so plainly, says that writing another answer will not move it, and gives you one command to run:

```
timone takeover <project>#<number>
```

That command opens the job in your terminal with everything it knows about where it stopped, and there it can do things it cannot do on its own. If a job never notices it is stuck, the machine notices for it: asking you twice about the same thing after you have already answered stops it as well, and the ticket says sorry.

It has been watched on the to-do app, on two throwaway tickets I filed and answered myself. It worked, and the first attempt found a real fault: the machine wrote its explanation without the header that says "this is the machine talking", so it read its own words back as yours. That is fixed. Seventeen watcher passes over a stopped job, with two more answers written on it, started nothing and cost nothing.

You then read one yourself and caught a second fault I had called cosmetic: the message explained the stop and ended "I need nothing from you", so the one command that unblocks it was only in the pinned note higher up the page. Now the message itself ends with the command. **You read it and said yes** — [#37](https://github.com/fvermaut/scratch-app/issues/37) on the to-do app told you the truth and gave you the way out the first time. That is the first time the words on a stopped ticket have been judged by the person they are written for.

Three things about this work still have nobody watching them: what happens after you run the command, the safety net for a job that never notices it is stuck, and what a stopped job costs when it is holding a project. All three are written up in `doc/plans/phases/reports/phase-25-live-gate.md`. The full account is in `doc/plans/phases/reports/phase-25-live-gate.md`.

**16 August — tickets are written short.** You said the machine's tickets and comments were too long. There is now a written rule in [`process.md`](process.md#writing-to-the-human), and every skill points at it. Short sentences, common words, no words that only make sense if you have read the process. A comment is a few sentences. Requirements and technical detail are links to files, never text on a ticket. A test fails if a message grows past 150 words.

**16 August — a job that stops to ask you something now waits instead of failing.** Before, it was recorded as broken, so your written reply was picked up by nothing, and the command the ticket offered you could not be run while the watcher was up. Both are fixed. The cost you accepted: a job waiting on you holds its project until you answer, and `timone cancel` is the way out.

**15 August — you agree the pieces once, and they arrive one at a time.** A big job is now proposed as a list of pieces. You say yes to the list once. Each piece is then built and delivered as its own pull request, small enough to read. A small chore skips approval entirely and is judged on its pull request — you chose that knowing nothing stops a misread chore before the work happens.

**14 August — every open ticket says what happens next**, checked and repaired every minute. A ticket you file without the label gets exactly one comment explaining why nothing is happening.

**14 August — one written answer sets one session going, not two.** You proved this yourself, by answering three throwaway questions in your own words and judging the replies.

Earlier work is in the reports under `doc/plans/phases/reports/`, one file per piece of work. It used to be repeated here at length; it is not any more.

---

## Not proven yet

- **Nobody has watched the 15, 16 and 18 August work run.** No real ticket has been through the list-of-pieces machinery. No stopped job has been restarted by a written reply. This is exactly the state the machine was in just before it produced the last two faults.
- **The rule that a piece must not be built without your approval is written, not enforced.** A building session obeys it. Nothing checks it.
- **One accessibility check on the to-do app is still owed.** Listen to it with VoiceOver and Safari and confirm the controls are announced sensibly. The script is in that project's own repository, at `doc/plans/phases/reports/phase-01-verification.md`. It needs about twenty minutes.

---

## Known problems

**They are all filed now**, one each, on [Timone's own repository](https://github.com/fvermaut/timone/issues). They used to live only in this file. The list below is a pointer — read the ticket for the detail.

The ones that would bite you in ordinary use:

- [#5](https://github.com/fvermaut/timone/issues/5) — a running watcher keeps using the code it started with. Nothing is running right now, so the next one you start has the 18 August work in it.
- [#9](https://github.com/fvermaut/timone/issues/9) — the safety check blames the machine for a change you have not committed. Commit or stash your own work before the machine starts.
- [#13](https://github.com/fvermaut/timone/issues/13) — a list of questions is only finished if somebody remembers to label it. This is what silently stopped the trading app.
- [#12](https://github.com/fvermaut/timone/issues/12) — a job whose ticket was closed while it waited still starts, and is billed.
- [#7](https://github.com/fvermaut/timone/issues/7) — a ticket that calls itself a throwaway still has its decisions written into the project for good.

The rest, in short: [#1](https://github.com/fvermaut/timone/issues/1) a stopped job could not be reached (the 16 August work fixes this, and it stays open until somebody watches it), [#3](https://github.com/fvermaut/timone/issues/3) and [#4](https://github.com/fvermaut/timone/issues/4) two messages that do not say enough, [#6](https://github.com/fvermaut/timone/issues/6) a misleading log line, [#8](https://github.com/fvermaut/timone/issues/8) a test that is slow rather than wrong, [#10](https://github.com/fvermaut/timone/issues/10) a wrong live count, [#11](https://github.com/fvermaut/timone/issues/11) a killed session reported as working, [#14](https://github.com/fvermaut/timone/issues/14) and [#15](https://github.com/fvermaut/timone/issues/15) two faults in what `timone status` tells you, [#16](https://github.com/fvermaut/timone/issues/16) pieces of one job indistinguishable in history, [#17](https://github.com/fvermaut/timone/issues/17) onboarding cannot repair a project, [#18](https://github.com/fvermaut/timone/issues/18) nothing notices stale standards, [#19](https://github.com/fvermaut/timone/issues/19) every message appears under your name.

**Two things are on purpose and are not filed.** A watcher killed outright leaves its project locked for about two minutes — that is a deliberate trade. And Timone's own work is planned by hand, which is why this file is written by hand.

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
