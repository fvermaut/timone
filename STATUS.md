# Timone — Status

**For fvermaut. Plain language, no process knowledge assumed.** This file is a status report, not agent context — agents update it, they never treat it as a source of truth. Last updated **2026-07-25**.

> **This file is about Timone itself** — the tool. Each managed project has its own `STATUS.md` under `projects/<name>/`, covering that project. When something here mentions a project, it says so by name.

---

## In one paragraph

Timone makes AI agents follow a real engineering process instead of improvising. The process has stages — sort the request, dig out requirements, write them down, record decisions, plan, build, verify, deliver, act on feedback. Each stage is a skill an agent runs. **Seven of the eleven stages now have working skills.** The current work is the hardest one: the skill that actually writes code. It's built and has been used to build a real application end to end. Four stages remain unbuilt, and then the bigger goal — having all this run automatically from tickets instead of being typed by hand.

## Done

- **The process is written down** — `process.md` is the single definition every skill obeys. When a skill and it disagree, it wins.
- **The plumbing** — a manifest of managed projects, a command to clone them into place, and the rule that sessions run here at the Timone root rather than inside a client's repo.
- **Seven stage skills work and have been tested against throwaway projects:** onboarding a new repo, sorting an incoming request, interviewing you for requirements, writing requirements down, recording architecture decisions, planning work into steps, and — new this weekend — **building the code**.
- **A standards library** — 11 entries covering the preferred stack, plus two that apply to every project with no opt-out: accessibility (a legal requirement in the EU) and UI/UX.
- **13 of Timone's 21 requirements are formally verified.**

## In progress

**Building the code-writing skill.** Four parts: write the rules (done), write the skill (done), prove it by using it for real (essentially done), sign it off (**waiting on you** — see below).

Proving it meant pointing the skill at a throwaway to-do list app and telling it to build the thing from scratch. It did. That took six rounds of fixes — roughly 30 defects — because every real run exposed something the instructions got wrong. That's the dry run doing its job.

One part is deliberately unfinished: **testing what happens when work fails repeatedly and has to be handed back to a human.** It needs Docker switched off for a single run, which is a two-minute thing whenever you want it done.

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

1. **Sign off the code-writing skill's dry run.** The plan says you review the evidence before it's marked done. I shouldn't tick your box. The evidence: the working app in `projects/scratch-app/`, and its build log at `projects/scratch-app/doc/plans/phases/reports/`.
2. **Two of your standards documents contradict each other.** One says buttons should grey out while submitting; the other says never move someone's keyboard focus. Greying out a checkbox someone is standing on does exactly that — we measured it. Both are no-opt-out, so one document has to change.
3. **A database instruction in the standards library produces something Node can't load.** Costs every project a workaround.
4. **Four standards corrections are drafted and awaiting your nod** — instructions that turned out not to work when actually run.

## Known problems not yet fixed

- **The onboarding skill can't repair a project.** It refuses to run on any project already registered — which is every project that could have a file missing. Found when a project turned out to be missing a required file; the only way to fix it was to override the skill by hand. Needs its own piece of work.
- **Nothing detects when the standards library drifts out of date.** Four entries were wrong this weekend and only running them found out. There's no mechanism.
- **Timone's own phases are planned by hand.** The planning skill only works on managed projects, by choice. So this file's "in progress" section was hand-written, not generated.

## Jargon key

Only if you need it: a **phase** is a chunk of work planned as one unit; a **sub-phase** or **slice** is one step inside it; a **gate** is a checkpoint that must pass before continuing, either automatic or you; **PRD** is the requirements document; **ADR** is a recorded decision.
