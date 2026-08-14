# Timone

*Il timone* — the helm. A meta-project for agentic software development: Timone owns the agent harness and enforces one written engineering process across independent projects, inverting control so agents run the show and humans steer through tickets, pull requests, and preview deployments.

## Layout

- `process.md` — **the process**: the single written definition of every lifecycle stage, its artifact, gate, and owning skill
- `doc/specs/product-overview.md` — why Timone exists, goals in priority order, MVP success definition
- `doc/specs/prd/` — requirements: PRD-01 (the process layer — a skill per lifecycle stage) and PRD-02 (inversion of control — the daemon-driven loop)
- `doc/adr/` — architecture decision records (founding decisions: 0001–0007)
- `doc/plans/phases/` — executable phase plans and their reports
- `.claude/skills/` — the stage skills (`timone-onboard`, `timone-grill`, `timone-prd`, `timone-adr`, …, `timone-improve`) — see [.claude/skills/README.md](.claude/skills/README.md) for authoring conventions
- `doc/feedback/` — stage 9's intake records, one per body of feedback: the per-item diagnosis, the human's decision, and what each item was dispatched to
- `standards/` — central standards library in three tiers: a mandatory baseline (accessibility, UI/UX), per-stack entries, and review references applied by stage 8 (the code-smell list) — agent-drafted from primary sources and human-approved
- `src/` — the Timone CLI (TypeScript, commander)
- `projects/` *(gitignored)* — managed project repos, declared in `timone.yaml` and materialized by the CLI

## Working with Timone

Sessions run at the timone repo root — never inside a managed project ([ADR-0007](doc/adr/0007-sessions-at-timone-root.md)). Bring a new repo under management first; every other stage skill then takes that project as its target — name it in your prompt, or the skill asks. From the root:

```
/timone-onboard <project-name> <repo-url>                  # stage 0 — register, clone, doc tree, overview, founding ADRs, standards
/timone-triage <project-name> <request | issue-ref>         # stage 1 — classify a request, record it, route it
/timone-grill <project-name> <topic or idea to grill>       # stage 2 — requirements interview
/timone-prd <project-name>                                  # stage 3 — persist the PRD pair
/timone-adr <project-name> <decision to record>              # stage 4 — architecture decision record
/timone-plan <project-name> <prd-ref | req IDs | work>       # stage 5 — cut a phase into vertical slices
/timone-execute <project-name> <phase-NN>                    # stage 6 — execute an approved phase, TDD, slice by slice
/timone-verify <project-name> <phase-NN>                     # stage 7 — check a completed phase against the criteria register
/timone-deliver <project-name> <phase-NN>                    # stage 8 — two-axis review, then open the pull request
/timone-improve <project-name> <feedback | review findings>  # stage 9 — triage feedback, amend or correct, dispatch the rest
```

Stage 9 closes the loop rather than ending it: it diagnoses each item's **layer** (intent change / implementation gap / the record is wrong), classifies the remediation into one of seven vehicles, stops at a human confirmation gate, and then dispatches — amending the PRD or correcting a process artifact itself when that is the whole fix, and sending everything else back through stages 5 → 8, or to stage 7 when only observed behaviour can settle it. **It commits documents only.** Code it dispatched would be code no verification pass had seen and no delivery review had read — the hole stage 8 closes by refusing to refactor, reopened one stage later.

### Running it from tickets instead of typing

Naming a skill is your right, not your duty. The daemon watches the managed projects' issue trackers and drives the process itself:

```bash
node dist/cli.js daemon                 # poll every 60s until stopped
node dist/cli.js daemon --once          # a single cycle — every transition inspectable
node dist/cli.js daemon --interval 30   # seconds between cycles
node dist/cli.js daemon --progress-interval 15  # how often it says what a session is doing
node dist/cli.js status                 # what each project is working, and what waits on you
node dist/cli.js takeover <project>#<n> # pick up a ticket that wants to talk something through
node dist/cli.js retry <project>#<n>    # re-arm a failed run at the stage where it stopped
```

**Only one watcher works a ledger, and a second one says so rather than joining in** ([ADR-0023](doc/adr/0023-one-answer-one-session.md)). Start a second `daemon` — or a `takeover` or `retry`, which spawn sessions too — while one is running, and it exits non-zero with one sentence naming the holder's pid and when it took the ledger, having started nothing. Two of them acting on the same answered ticket is how one written answer bought two agent sessions before 2026-08-11. A holder that **crashed** does not wedge its project: its lock is taken back by the next daemon, which says whom it took it from — but a holder that is merely quiet is refused however long it has been quiet, because **a lock holder's proof of life is its process, not its silence** ([ADR-0025](doc/adr/0025-a-lock-holders-proof-of-life-is-its-process.md)), and a daemon two hours into a session is busy rather than dead. The cost, so it is not a surprise: for the first couple of minutes after a crash the lock is still inside its quiet window and a fresh daemon is refused. **Restart the daemon after pulling** — a running process keeps executing the code it started with, so a fix does nothing for the watcher already up.

**While a session works, the daemon says so.** Every `--progress-interval` seconds (30 by default) it appends a line naming how long the session has run, how many turns it has taken, how many output tokens it has spent and how many sub-agents are working right now; when the session ends it prints one line with what it actually cost. The output is append-only and consults no terminal, so `> daemon.log` and a systemd journal show exactly what the screen showed.

**That same tick is what proves the run alive** ([ADR-0017](doc/adr/0017-a-runs-liveness-is-its-heartbeat.md)), so `--progress-interval` is not only a display setting: it also decides when a run counts as abandoned. Kill the daemon mid-session — a crash, a laptop lid, a `SIGKILL` — and the run it was working would otherwise sit "in progress" forever with its project hostage. Instead, the next daemon finds it silent for four intervals, stops it with a plain reason, says so on the ticket, frees the project and starts whatever was queued. **It does not resume it**: a crash can leave half-finished commits on the branch, and a crash that repeats would loop forever. `timone retry` is the way back, and `timone status` names that command next to every failure. The honest cost: an overnight run stops at the crash and waits for you.

**Every commit Timone makes says which step made it** ([ADR-0019](doc/adr/0019-timone-authored-commits-carry-a-provenance-trailer.md)). Commit messages end with `Timone-Stage:`, plus `Timone-Session:` and — when a ticket drove the work — `Timone-Run: <project>#<ticket>`. So auditing a repository is a git query rather than a reconstruction:

```bash
git log --grep=Timone-Stage --oneline          # everything the machine authored
git log --grep="Timone-Run: myapp#42" --stat   # everything one ticket produced
```

Commits made before this landed carry nothing, and nothing was rewritten — absence proves nothing about older history.

A ticket now goes the whole way: after you approve the plan, the daemon builds it slice by slice, has a fresh session that never watched the build check the result, and opens a pull request carrying the scope, the verification outcome and two independent reviews. The ticket links the PR and the PR references the ticket. **Merging stays yours** — a merge completes the ticket (and closes it), and whatever was queued behind it starts.

**Review comments on an open Timone PR are acted on** ([ADR-0016](doc/adr/0016-review-remediation-rides-the-verify-fix-shape.md)): name a concrete change and the next cycle makes it — one `fix: review — …` commit, a full re-check, the same PR refreshed, and a reply saying what was done. A vague comment gets you a clarifying question and no commit; a comment that would change what was agreed gets told so plainly and taken through the front door. `timone retry` is the way back when a run fails: it re-arms at the stage that stopped, keeping the branch and everything on it.

**The `timone` label is a permission boundary, not an instruction.** Putting it on an open issue says the daemon may act on that issue; it says nothing about what the issue *is* — classifying that is stage 1's job, run by an agent that has read the raw text. An unlabelled issue is never touched. Write tickets in plain language: naming a stage, a skill or a process concept is never required of you ([PRD-02.R13](doc/specs/prd/prd-02-inversion-of-control.criteria.md)).

### The two ways you get asked something

Human moments come in two kinds ([ADR-0012](doc/adr/0012-conversation-channels.md)) — a single decision, and a back-and-forth. **A ticket that is waiting on you always says so, and always says what to do about it.**

- **A single decision — answered on the ticket.** When Timone wants approval, it posts what it wrote, links the artifact on its branch, and tells you the literal word to reply. **Reply `approve` and it goes on; reply anything else and it treats your reply as a change and does that step again with your words in hand.** There is no third outcome, and nothing is read as approval unless it *is* the word — "approve once you've fixed the wording" is a change request, deliberately, because a gate that guesses at intent eventually approves something nobody approved. Only replies posted after the request count, and only yours: Timone's own comments carry a marker, so it can never approve its own work by quoting the word back.
- **A back-and-forth — answered whichever way suits you.** When a step needs an interview rather than a single answer, the ticket offers **two ways to answer and prefers neither** ([ADR-0022](doc/adr/0022-a-conversation-ticket-can-be-answered-in-writing.md)): write your answer in the thread, or run the copy-pasteable `timone takeover <project>#<ticket>` beside it. **Both reach the same session and produce the same record**, so the choice is yours and needs no explaining. A written answer is read exactly the way a gate reply is — any comment of yours posted after the question counts, with no keyword to remember — and it need not be complete: *"I don't know, what do you suggest?"* is a real answer. The takeover works out what that ticket is waiting for and drops you into the conversation; you never name a stage or a skill. Either way, what gets settled is posted back to the ticket as the record — the conversation itself is not kept and nothing may cite it. Run the command on a ticket that is waiting for a *ticket reply* instead and it says so rather than opening an interview.

**The written path is bounded at one more question, and the bound is the whole reason it is allowed.** Comment ping-pong was ruled out deliberately: a fifteen-turn interview run as a comment thread is miserable, and the failure is gradual — an exchange that was going to be one round becomes eleven. So if what you write leaves something open, Timone posts **only the part still open**, never the whole question again, and waits once more. If that second answer still does not settle it, it stops typing at you and hands back the takeover. It degrades toward the terminal, which is where that particular conversation was heading anyway.

**An idea too big for one sitting is charted as a map of questions — and those tickets are watched like any other.** Each question gets its own ticket, sized to one session, with the dependencies between them drawn in so it is always visible which are ready. They carry the same `timone` label as everything else, which is what makes them visible to the daemon at all; it recognises them as questions being *asked of you* rather than fresh requests, so it never sorts them as though you had just filed them, and parks each one waiting on your answer. That is what makes `timone takeover <project>#<ticket>` work on them — before 2026-08-09 it refused, because that side of the machine had never been told those tickets existed, and every instruction written onto them was one nobody could follow. The map itself is an index rather than a question, so it is never marked and nothing ever waits on it. Two narrower cases stay honest about themselves: a question that needs something to look at first offers the takeover alone, because there is nothing to write an answer to until it is built, and a question Timone is answering by research asks you for nothing and says so.

One session per project runs at a time, always. A parked ticket only blocks the others once it owns a work branch — so several tickets can sit waiting for your answer at once, and one unanswered question no longer freezes a project. Every message Timone posts is stamped as the machine's, because it posts through your GitHub credentials and would otherwise read as though you wrote it — which would also let a later session mistake its own words for your approval. After **every** session at the timone root — the daemon's and the ones you start yourself — four deterministic checks run: unpushed commits, `STATUS.md` off the default branch, files touched outside the target project, and a commit that does not say which step made it. They live in `SessionStart`/`Stop` hooks in the tracked `.claude/settings.json` ([ADR-0018](doc/adr/0018-the-session-bracket-belongs-to-the-hooks.md)), which is what makes them reach your own sessions: until phase 14 they were wired into the daemon's start-a-session code and saw nothing else, and on 2026-08-06 a stray commit from a session you ran by hand blocked a build. A violation on a run the daemon drove is one loud ticket comment as before; a violation in a session you started is printed to you and appended to `.timone/sessions.jsonl`, and posted on no ticket at all. A clean session of either kind produces silence. Daemon state lives in `.timone/state.json` at the root — machine state, gitignored, never a process artifact.

`timone-onboard` is the one skill allowed to add a project — it does so via `timone projects add` (below), never by hand-editing `timone.yaml` ([ADR-0008](doc/adr/0008-manifest-writes-via-cli-command.md)). Every other skill validates its target against `timone.yaml`, requires the project to be cloned (`workspace sync` first), and touches only `projects/<name>/…` — the only files any skill ever commits there are process artifacts (`doc/…`, `CONTEXT.md`). See [process.md](process.md) for the full lifecycle these skills implement.

## Getting started

```bash
npm install
npm run build
npm link          # required — see below

# describe your projects (see timone.example.yaml)
cp timone.example.yaml timone.yaml

node dist/cli.js projects list      # table of managed projects + cloned state
node dist/cli.js workspace sync     # clone missing, fast-forward clean, skip dirty
node dist/cli.js projects add <name> --repo <url> --path projects/<name> \
  --stack <comma,list> --ticketing github [--preview docker]   # register a project (used by timone-onboard)
node dist/cli.js projects update <name> [--repo <url>] [--path <path>] \
  [--stack <comma,list>] [--ticketing github] [--preview docker]   # correct an existing entry (ADR-0008: never hand-edit)
```

**`npm link` is not optional, and it is not a convenience.** Timone writes calls to action for you — on client tickets, and in `timone status` — and every one of them names the `timone` command: `timone takeover <project>#<ticket>` to open a conversation, `timone retry <project>#<n>` to re-arm a failed run, `timone daemon` to start the watcher. Without the link that command does not exist, and **every instruction the machine gives you is one you cannot follow**. It went unnoticed until 2026-08-08, when `scratch-app` #13 became the first ticket to park on a wait only a human could clear and the copy-pasteable command in its comment turned out not to run ([the 14g gate report](doc/plans/phases/reports/phase-14-live-gate.md)). The `node dist/cli.js …` form used elsewhere in this README works either way; the CTAs are written the short way on purpose, because a comment on a client's ticket should not carry this repository's build layout.

`npm test` runs the suite (manifest validation + workspace-sync integration tests on local fixtures).

## Status

Phases 01–10 delivered: foundations (process spec, manifest, workspace sync), the document trio (grill/PRD/ADR skills), the standards library (12 entries approved), onboarding (`timone-onboard` + `projects add`), triage (`timone-triage` + `projects update`), planning (`timone-plan`), implementation (`timone-execute` + the TDD loop), verification (`timone-verify` + the accessibility baseline's stage-7 leg), delivery (`timone-deliver` + the two-axis review + the code-smell reference), and feedback (`timone-improve` + the seven remediation classes + the intent/verdict register carve-out). **Ten stage skills** now exist and have been exercised end to end against scratch fixtures — `timone-execute`'s dry run built a running Next.js + PostgreSQL application from an empty repository, `timone-verify`'s then checked it black-box and had two regressions fixed, `timone-deliver`'s opened three real pull requests carrying both review axes, and `timone-improve`'s took four real feedback intakes and drove one of them the whole way round: a delivery-review finding became a PRD amendment, a plan, a build, a verification pass and a new pull request, with stage 9 authoring no code commit. **The lifecycle now closes rather than ending at delivery. 22 of PRD-01's 24 requirements are verified.**

**Phase 11 delivered the inverted loop's first slice** ([PRD-02](doc/specs/prd/prd-02-inversion-of-control.md)): the daemon picks up marked tickets, acknowledges them, spawns a session from the timone root that classifies the request itself, serializes work per project, and runs three guardrail checks after every session — proven live on `scratch-app`, where a ticket written as "the page feels slow when I add many items" came back classified with a rationale and no process vocabulary. **R1, R2, R9, R10 and R15 verified; R13's daemon half verified, its interactive half still unproven.**

**Phase 12 delivered the gates and the conversations** ([report](doc/plans/phases/reports/phase-12-complete.md)): a classified ticket walks on by itself — a feature opens a terminal conversation, the requirements and then the plan are each committed on a work branch and gated on a ticket reply, and an approval is written back into the artifact as its stamp. A gate reply is judged by shape, and Timone's own comments are excluded by the marker, so it cannot approve its own work. **R3, R4, R5, R13 and R14 verified** at fvermaut's 12g gate on `scratch-app` #6, which went from a vague ticket to an approved five-slice phase file through one conversation and two gated round-trips, change requests included. R13's interactive clause closed the same day, with a written limit: an interactive session leaves no artifact, so it is verified from direct report rather than from an inspection.

That gate also found the phase's largest defect: the plan gate asked for approval of a plan that did not exist, because two skills contradicted PRD-02.R4/R5 and two consecutive sessions resolved the contradiction in opposite directions. Settled by [ADR-0014](doc/adr/0014-artifact-first-gates.md) — gated stages write their artifact first and gate on it — which amended `process.md`, both skills, and when requirement IDs become permanent. Next: phase 13 (execution → verification → PR), after which the pilot starts. Still open on PRD-01: onboarding repair (R23) and standards-drift detection (R24, awaiting a grill session to rewrite its criteria). [STATUS.md](STATUS.md) carries the plain-language version.
