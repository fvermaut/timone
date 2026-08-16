# Timone — Status

**Written for fvermaut, in plain language.** Agents write this file. They never read it as a source of truth — the requirements, plans and reports are. Everything below is about the Timone repository unless it names a project.

**Last updated:** 2026-08-16.

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
| The automatic loop | `doc/specs/prd/prd-02-inversion-of-control.criteria.md` | 13 of 22 |

Of the nine on the second list that are not kept: three lost their tick because you changed what they promise, one was checked and failed, and five have never been checked at all.

966 automatic tests pass. Tests are not the same as somebody watching it work.

---

## What changed recently

**16 August — tickets are written short.** You said the machine's tickets and comments were too long. There is now a written rule in [`process.md`](process.md#writing-to-the-human), and every skill points at it. Short sentences, common words, no words that only make sense if you have read the process. A comment is a few sentences. Requirements and technical detail are links to files, never text on a ticket. A test fails if a message grows past 150 words.

**16 August — a job that stops to ask you something now waits instead of failing.** Before, it was recorded as broken, so your written reply was picked up by nothing, and the command the ticket offered you could not be run while the watcher was up. Both are fixed. The cost you accepted: a job waiting on you holds its project until you answer, and `timone cancel` is the way out.

**15 August — you agree the pieces once, and they arrive one at a time.** A big job is now proposed as a list of pieces. You say yes to the list once. Each piece is then built and delivered as its own pull request, small enough to read. A small chore skips approval entirely and is judged on its pull request — you chose that knowing nothing stops a misread chore before the work happens.

**14 August — every open ticket says what happens next**, checked and repaired every minute. A ticket you file without the label gets exactly one comment explaining why nothing is happening.

**14 August — one written answer sets one session going, not two.** You proved this yourself, by answering three throwaway questions in your own words and judging the replies.

Earlier work is in the reports under `doc/plans/phases/reports/`, one file per piece of work. It used to be repeated here at length; it is not any more.

---

## Not proven yet

- **Nobody has watched the 15 and 16 August work run.** No real ticket has been through the list-of-pieces machinery. No stopped job has been restarted by a written reply. This is exactly the state the machine was in just before it produced the last two faults.
- **The rule that a piece must not be built without your approval is written, not enforced.** A building session obeys it. Nothing checks it.
- **One accessibility check on the to-do app is still owed.** Listen to it with VoiceOver and Safari and confirm the controls are announced sensibly. The script is in that project's own repository, at `doc/plans/phases/reports/phase-01-verification.md`. It needs about twenty minutes.

---

## Known problems

Three are filed as bugs on [Timone's own repository](https://github.com/fvermaut/timone/issues):

- [#1](https://github.com/fvermaut/timone/issues/1) — a stopped job could not be reached by the person it was waiting for. The 16 August work fixes this. It stays open until somebody watches it work.
- [#3](https://github.com/fvermaut/timone/issues/3) — a message asks you for a conversation without saying what it wants to know.
- [#4](https://github.com/fvermaut/timone/issues/4) — a handed-back message never says whether the fault is in the app or in the machine.

Not filed, and still true:

- **A running watcher keeps running the code it started with.** Yours started at 13:22 today, before the shorter wording was built. Stop it and start it again to pick up anything built since.
- **The live count of how much a job has written is too low**, by two to six times. The figure printed when a job ends is correct. Unexplained since 8 August.
- **The safety check can still blame the wrong session** for a change you made and have not committed. Commit or stash your own work before the machine starts.
- **A ticket marked "throwaway" still has its decisions written into the project's permanent records.** It happened twice in two days. Nothing treats "this is a test" as a limit.
- **Every message still appears under your GitHub name.** A line on each says the machine wrote it. The real fix is a separate robot account, which needs a credential from you.
- **A job whose ticket was closed while it queued still starts, and is billed for.** Nothing re-checks the ticket between joining the queue and reaching the front.
- **A killed session is reported as still working, for ever.** The machine may only call a job dead if it was watching. With no watcher running, nothing ever watches, so the line never corrects itself.
- **A watcher killed outright leaves its project locked for about two minutes.** This is a deliberate trade, not a fault.
- **The log prints "resuming" after a session has already finished.** Nothing is wrong with the behaviour, but it looks exactly like a fault that was fixed, and it is the log somebody will read while diagnosing the next problem.
- **`timone status` does not know that one ticket can be waiting on another.** It also cannot tell a question you never answered from one you answered twice, and it says a project is idle between two pieces of the same job.
- **Two pieces of the same job look identical in the project's history.** Every commit says which ticket it came from; none says which piece.
- **One test fails now and then because it is slow, not because it is wrong.** It does real work with version control and runs out of its five-second allowance on a busy machine.
- **The onboarding skill cannot repair a project.** It refuses any project already registered, which is every project that could have a file missing.
- **Nothing notices when the standards library goes out of date.** Five entries were wrong in one weekend, each correct when written.
- **The give-up-and-ask-a-human path has never fired**, in building, checking or delivering. The first real failure on real work is its test.
- **Timone's own work is planned by hand**, so this file is written by hand too.

These last ones live only in this file. Their proper home is an issue on Timone's repository, one each. **Say the word and I will file them.**

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
