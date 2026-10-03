---
name: timone-wayfind
description: Stage 2 (Requirements discovery) of the Timone process, at scale — when a loose idea on a managed project is too big for one grill session, chart it as a shared map of decision tickets on the project's issue tracker, then resolve them one session at a time until the way to the destination is clear. Use when the user says "chart this", "map this out", "wayfind this", "work the map", or when triage or a grill session finds an idea spanning multiple independent unresolved decision areas.
argument-hint: <project-name> <loose idea | map ref [ticket ref]>
---

# Timone Wayfind — Requirements Discovery at Scale (Stage 2)

Implements stage 2's at-scale mode of [the Timone process](../../../process.md). That spec is normative: if this skill and the spec ever disagree, the spec wins. Adapted from [Matt Pocock's wayfinder](https://github.com/mattpocock/skills/blob/main/skills/engineering/wayfinder/SKILL.md) per [ADR-0010](../../../doc/adr/0010-wayfinder-discovery-maps.md), which records the deliberate deviations.

**Everything you put in front of the human follows [Writing to the human](../../../process.md#writing-to-the-human).** Short sentences, plain words, no process vocabulary — no stage numbers, no skill names, nothing a reader would need `process.md` to understand. A ticket comment is a few sentences and under 150 words. Specifications, requirements and technical detail are **links** to committed artifacts, never text on a ticket. Every message ends with a call to action, and "no action needed" is one.

A loose idea has arrived, too big for one grill session and wrapped in fog: the way from here to the **destination** isn't visible yet. This skill charts the way as a **shared map** of **decision tickets** — questions whose resolution is a decision, not slices of a build — and resolves them one session at a time until nothing is left to decide.

## Target-project resolution (do this first)

1. The target project is the one named in the invocation argument or prompt.
2. If no project is named: read `timone.yaml`, list the project names, and **ask** the user to pick. Never guess.
3. Validate the name against `timone.yaml`. Unknown name → abort, listing the valid names.
4. Check `projects/<name>/` exists on disk. Not cloned → abort, suggesting `node dist/cli.js workspace sync`.
5. From here on, every file you read or write lives under `projects/<name>/…` — the only exceptions are *reading* timone's own `process.md`, `standards/`, and `timone.yaml`.
6. In a session the runner started, the target project arrives in the session's prompt; the same validation applies. ✏ 2026-09-30 ([ADR-0060](../../../doc/adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md))

## Scaffolding, never spec

The map is working memory with the epistemic status of a grill transcript. **Nothing on it is normative.**

- A resolution that passes stage 4's significance test (hard to reverse, surprising without context, a real trade-off) becomes an ADR **at decision time** — run `timone-adr` before moving on, exactly as a grill session would.
- The destination artifact lands in-repo — normally the stage-3 PRD pair via `timone-prd`. PRDs and ADRs **restate** what they need from tickets; they never point into them (ADR-0006 stands).
- **Plan, don't do — no exceptions.** Every ticket resolves a decision. `task` tickets exist solely to unblock a decision; anything that is a build routes through `timone-triage` like any other request. The upstream Notes-override that carries execution into the map is struck (ADR-0010).

## The map

A single issue on the project's tracker labelled `wayfinder:map` **and `timone`** — the canonical artifact of the effort. It is an **index**, not a store: it gists closed decisions and links the tickets that hold their detail; open tickets are *not* listed in the body — they are open child tickets, found by query. Body template:

```markdown
## Destination

<what reaching the end looks like — the spec, decision, or change this effort is finding its way to; one or two lines>

## Notes

<domain; standing preferences for this effort; skills every session should consult>

## Decisions so far

- [<closed ticket title>](link) — <one-line gist of the answer>

## Not yet specified

<in-scope fog you can't ticket yet — see "Fog of war">

## Out of scope

<work consciously ruled beyond the destination — never graduates>

---

**What I need from you:** nothing — I'm working through the questions on this map, and I'll come back here when the last one is closed.
```

**The map carries the `timone` mark, like every ticket on it** ([ADR-0024](../../../doc/adr/0024-every-open-ticket-answers-for-itself.md), amending ADR-0010's "never becomes a run" *for the map alone*). It is the ticket that represents the effort to the human, so it is the ticket they write on — and the one transition the process could not otherwise be given, stage 2 → stage 3, is the map's own. ✏ 2026-09-30 ([ADR-0060](../../../doc/adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md)). Marked, the map has a run, and the runner reads what a named person writes on it. While questions are open, the map asks for nothing. Once the route is posted, **a comment agreeing is what starts the specification**: the runner reads it and starts the step that writes it, the next step of the map's default order. Leave the mark off and that comment lands nowhere, which is exactly what happened to `ivtrends` #1 on 2026-08-13.

Its closing line is the one above while questions remain, and is rewritten when the way is clear — see [Closing the effort](#closing-the-effort). Nothing else about the map changes: it is still an index, still scaffolding rather than spec, and it still holds no decision that has not been promoted into a permanent document.

**Refer by name:** in everything the human reads, tickets go by their titles (wrapping their links), never bare numbers. A wall of `#42, #43` is illegible.

### Tickets

Each ticket is a child of the map, body = the question it resolves, sized to one session, labelled `wayfinder:<type>` **and `timone`**:

**Both labels, every decision ticket.** ✏ 2026-09-30 ([ADR-0060](../../../doc/adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md)). `wayfinder:<type>` says what kind of question it is, and the runner reads it to choose the ticket's default order. `timone` is the mark the daemon watches. It gives the ticket a run, and only a ticket with a run has a runner that reads the answer a named person writes on it. A decision ticket created without the mark is the defect [ADR-0022](../../../doc/adr/0022-a-conversation-ticket-can-be-answered-in-writing.md) was written about: a well-formed question nothing is listening to.

**Mark the map as well** — `wayfinder:map` **and `timone`**, from the moment you create it. This reverses an earlier rule that said never to; the reasoning and its consequences are above, under [The map](#the-map).

**`research` needs nobody.** It is resolved in the charting session by a sub-agent (Mode 1, step 5), and normally closed there. ✏ 2026-09-30 ([ADR-0060](../../../doc/adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md)). A `research` ticket left open and marked is still resolved without a person: its default order is one step, a session that answers it from sources and asks nobody. Still close each one in the session that fired it, so that no second session is started to answer it again.

| Type | Mode | Resolved by |
|---|---|---|
| `research` | AFK | a fresh-context research sub-agent (Explore/general-purpose) reading docs, third-party APIs, knowledge bases; findings posted as the resolution comment, assets linked not pasted |
| `grilling` | HITL — **the default** | the `timone-grill` interview discipline scoped to the ticket's question: one question at a time, recommended answers, codebase-answerable questions answered from the codebase, glossary maintenance in `CONTEXT.md` throughout |
| `prototype` | HITL | `timone-prototype` ([ADR-0011](../../../doc/adr/0011-prototype-convention.md)): a cheap, throwaway artifact to react to when "how should it look/behave" is the key question — a `prototype/NN-<slug>` branch served at a preview URL, never merged, deleted once the reaction is recorded; the human's reaction *is* the resolution |
| `task` | HITL or AFK | manual work that unblocks a decision (signing up for a service, provisioning access, moving data so its shape can be seen) — done by the agent where possible, else handed to the human as a precise checklist; the resolution records what was done and the resulting facts later tickets depend on |

A HITL ticket resolves only through exchange with the human — never answer the human's side yourself.

### Every ticket carries its own CTA

A ticket body is the question **plus what the human is being asked to do about it** ([ADR-0022](../../../doc/adr/0022-a-conversation-ticket-can-be-answered-in-writing.md)). A question with no instruction is a defect: the human is assumed to know nothing about this process, and a wall of well-phrased questions they cannot act on is worse than no ticket. Close every body with the block for its type, verbatim in shape, substituting the real project and number.

✏ 2026-09-30 ([ADR-0060](../../../doc/adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md)). The blocks below offer only what the runner acts on now. The old ones promised one more question in writing and then a stop, and a takeover that picked the ticket up where it waited. The code that kept those promises was removed.

**`grilling` and `task` — both paths:**

````markdown
---

**Two ways to answer — pick either.**

- **Write your answer here.** A comment is enough. You don't need to answer every part, and "I don't know, what do you suggest?" is a real answer.
- **Talk it through instead.** Run this in your terminal:

  ```
  timone takeover <project>#<n>
  ```

**What I need from you:** answer here, or run the command.
````

**`prototype` — the takeover alone**, because there is nothing to react to until it is built:

````markdown
---

**This one needs something to look at first.** Run this in your terminal. A session opens with you, builds it, and shows it to you:

```
timone takeover <project>#<n>
```

**What I need from you:** run the command when you have a few minutes.
````

**`research` — nobody is waiting on the human:**

```markdown
---

**What I need from you:** nothing — I'm resolving this one myself and will post what I find here.
```

**The mark is what makes both paths work.** ✏ 2026-09-30 ([ADR-0060](../../../doc/adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md)). The daemon picks up a marked ticket and gives it a run. The runner reads the ticket's `wayfinder:<type>` label as its kind, so the run starts at this stage and not at sorting. `timone takeover` opens a session on the ticket in the person's terminal. When the run's step is this one, that session is told to hold the conversation with this skill. When it ends, the runner reads what it left on the ticket. Write the blocks as they stand; the way to make the written path a lie is to leave the mark off.

### How a question on the map is answered

✏ 2026-09-30 ([ADR-0060](../../../doc/adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md)). This section used to describe how the old code picked up a written answer and allowed one more question in writing. That code was removed.

**A named person answers in plain words on the ticket.** No keyword, nothing for them to remember. Their comment wakes the runner. The runner reads it and decides the next step; the step that resolves a decision ticket is Mode 2 below. That step reads the thread before it asks anything, takes the answer at its word, and restates what it understood in the resolution comment, so a misreading shows where the human is already looking. When the answer leaves part of the question open, the step posts only what is still open and ends. The next answer wakes the runner again. A person who would rather talk it through runs `timone takeover` instead.

**A comment that asks what is still open has a hard shape.** One line confirming their answers are recorded — a short list, not a restatement of each one. Then the single thing still open, in plain words. Then your recommendation, **one sentence of why and one sentence of what it costs**, and nothing more; the rest is a link to the artifact that holds it. Then the CTA. Under 150 words in total. `scratch-app` #31 is the counter-example this rule was written from: 520 words to ask one yes-or-no question, and fvermaut said he could not use it.

**Claiming:** assign the ticket to yourself **before any work** — the assignee *is* the claim; open + unassigned = unclaimed. **Blocking:** use GitHub's native dependency relationship — `gh issue edit <n> --add-blocked-by <m>` — and **nothing else**. ✏ 2026-08-21: the body line `Blocked by: #N, #M` used to be offered here as a fallback. It is no longer a fallback and is not a second format ([ADR-0044](../../../doc/adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) D6). ✏ 2026-09-30: this used to say the daemon reads such a line and says on the ticket that it refuses it. No code does that now. **The machine reads only the native field**, so a dependency written as a body line is a dependency that does not hold. The **frontier** is the open, unblocked, unclaimed children. Expect other sessions to be editing the tracker concurrently.

### Tracker binding and fallback

The GitHub path applies when the project's `repo_url` in `timone.yaml` is GitHub-hosted; run `gh` from `projects/<name>/`, creating the `wayfinder:*` labels on first use. Otherwise fall back — **loudly, never silently** — to committed markdown in the target project:

- `doc/wayfinder/NN-<slug>/map.md` — the map body above, plus a `Status: open | closed` line. `NN` allocated by scanning existing efforts, zero-padded, never reused.
- `doc/wayfinder/NN-<slug>/tickets/NNN-<slug>.md` — one file per ticket: `Status`, `Type`, `Claimed by: <who> <date>` (the claim), `Blocked by: <NNN, …>`, `## Question`, and `## Resolution` on close.
- Every mutation is committed (`docs: wayfind NN — <what changed>`); the commit is what makes concurrent sessions see claims.

## Fog of war, and out of scope

Don't chart what you can't yet see. **Ticket when** the question is already sharp — even if blocked; **Not yet specified when** you can't phrase it that sharply yet — don't pre-slice fog into ticket-sized pieces; one patch may graduate into several tickets, or none. Resolving a ticket clears fog: graduate whatever became specifiable into fresh tickets, removing it from **Not yet specified**.

Fog only gathers *toward* the destination. Work beyond it is **out of scope** — its own map section, one line with the why. A live ticket exposed as past the destination gets **closed** and a line there, linking it; it never enters **Decisions so far**, which records only the route actually walked. Out-of-scope work returns only if the destination is redrawn — as a fresh effort, not a resumption.

## Mode 1 — Chart the map

Invoked with a loose idea. Charting is one session's work; it hand-resolves nothing.

1. **Name the destination** — a short grill (one question at a time, recommended answers) pinning down what this map is finding its way to. The destination fixes the scope, so it comes first.
2. **Map the frontier, breadth-first** — fan out across the whole space, surfacing the open decisions and the first steps takeable now. **If this surfaces no fog** — the journey fits one session — you don't need a map: stop and suggest plain `timone-grill` (or `timone-prd` directly).
3. **Create the map** (`wayfinder:map` **and `timone`**): Destination and Notes filled, Decisions-so-far empty, the fog sketched into Not yet specified, and the map's own closing line as the body template has it.
4. **Create the tickets you can specify now** — each labelled `wayfinder:<type>` **and `timone`**, each closing on the CTA block for its type — then wire blocking in a **second pass** (tickets need ids before they can reference each other).
5. **Fire the research sub-agents** — each `research` ticket you just created gets a fresh-context sub-agent resolving it in parallel, posting findings as its resolution comment.
6. Stop. Report the map by name with its link, the frontier, and the suggested first working session. Update `STATUS.md` per the process convention (in a run this step owns no work branch, so that means no `STATUS.md` and no commit to the project).

## Mode 2 — Work through the map

Invoked with a map (URL, number, or fallback path); a ticket is optional — without one, *you* pick.

1. **Load the map** — the low-res view, not every ticket body.
2. **Choose the ticket**: the user's if named, else the first frontier ticket. **Claim it before any work.**
3. **Read the thread before asking anything.** A human may already have answered in writing — that is one of the two paths every HITL ticket offers, and re-asking a question they have answered is the failure the path exists to avoid. Then **resolve it** per its type (table above), zooming as needed — fetch the full body of any related closed ticket on demand; consult the skills the map's Notes name.
4. **Record the resolution**: post the answer as a resolution comment, **close** the ticket, append the one-line gist to the map's Decisions so far. If the decision was ADR-significant, the ADR was already written at decision time (see above).
5. **Tend the map**: create-then-wire newly surfaced tickets; graduate sharpened fog; rule mis-scoped tickets out of scope; update or delete tickets the answer invalidated.
6. **One ticket per session** — `research` tickets excepted. Update `STATUS.md` per the process convention (in a run this step owns no work branch, so that means no `STATUS.md` and no commit to the project), then stop.

## Closing the effort

The way is clear when the frontier is empty and no fog remains. Then, **on the map ticket, in this order**:

1. **Post the route** — decisions by name, risks, deliberately open questions — as a comment on the map. This is the summary the human reads before agreeing, and it is also the machine's last word on the ticket: **only what is written after it counts as the go-ahead**, so post it before step 2 and never after.
2. **Rewrite the map's closing line** to ask for the go-ahead, replacing the one the body template carries:

   ````markdown
   ---

   **Every question on this map is answered.** Say the word here and I'll write the specification this map has been finding its way to — a plain comment is enough.

   **What I need from you:** say go ahead here, and I'll write it.
   ````

3. **No label starts anything.** ✏ 2026-09-30 ([ADR-0060](../../../doc/adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md)). The old code read the `wayfinder:frontier-empty` label as the sign that the way was clear. That code was removed, and nothing reads the label now. The runner reads the route and the new closing line in the map's thread, and a named person's next comment wakes it.
4. **Stop there.** ✏ 2026-09-30 ([ADR-0060](../../../doc/adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md)). The go-ahead wakes the runner, which starts stage 3 on the map's own run, with nothing run by hand — a comment agreeing is the whole mechanism ([ADR-0024](../../../doc/adr/0024-every-open-ticket-answers-for-itself.md)). Do not invoke `timone-prd` yourself off your own reading of the map; if the human is in the session with you and asks for the specification now, that is their call and it is theirs to make, not yours to assume.
5. **Once the specification step starts, the map holds its whole project.** ✏ 2026-09-30 ([ADR-0060](../../../doc/adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md)). That step cuts a work branch for the map's run, and a run with a work branch holds its project: no other ticket on it moves. That is intended, and it is worth saying in the route summary so nobody wonders why the queue stopped.
6. Close the map **only after the destination artifact is committed**, with a closing comment linking it.

**On the markdown fallback there is no ticket and no run**, so no runner ever reads the map and steps 4 and 5 have nothing to act on: write the route and the go-ahead ask into `map.md`, say plainly that the specification needs a session started by hand, and stop. The mechanism above is the tracker path's alone. ✏ 2026-09-30 ([ADR-0060](../../../doc/adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md))

**If the frontier reopens** — fog graduating into fresh tickets after the route is posted — put the working line back in the body, and post on the map that a question is open again, so that its newest comment is true. ✏ 2026-09-30 ([ADR-0060](../../../doc/adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md)): this used to say to remove `wayfinder:frontier-empty`, and that nothing would then start the specification. Nothing reads the label now; the runner reads the map's thread, and the comment is what tells it the way is no longer clear.

Wayfinding produces decisions, never deliverables: no application code, no phase files, no PRDs written by this skill itself. `CONTEXT.md` (during grilling tickets), `STATUS.md`, and the fallback `doc/wayfinder/` tree are the only files it writes in the target project.
