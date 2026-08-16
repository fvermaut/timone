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
6. In loop mode (daemon-initiated sessions), the target project arrives in the event context; the same validation applies.

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

**The map carries the `timone` mark, like every ticket on it** ([ADR-0024](../../../doc/adr/0024-every-open-ticket-answers-for-itself.md), amending ADR-0010's "never becomes a run" *for the map alone*). It is the ticket that represents the effort to the human, so it is the ticket they write on — and the one transition the process could not otherwise be given, stage 2 → stage 3, is the map's own. Marked, it becomes a run parked at a stage of its own: while the frontier is open it asks for nothing and starts nothing, and once the frontier is empty **a comment agreeing is what starts the specification**. Leave the mark off and that comment lands nowhere, which is exactly what happened to `ivtrends` #1 on 2026-08-13.

Its closing line is the one above while questions remain, and is rewritten when the way is clear — see [Closing the effort](#closing-the-effort). Nothing else about the map changes: it is still an index, still scaffolding rather than spec, and it still holds no decision that has not been promoted into a permanent document.

**Refer by name:** in everything the human reads, tickets go by their titles (wrapping their links), never bare numbers. A wall of `#42, #43` is illegible.

### Tickets

Each ticket is a child of the map, body = the question it resolves, sized to one session, labelled `wayfinder:<type>` **and `timone`**:

**Both labels, every decision ticket.** `wayfinder:<type>` says what kind of question it is; `timone` is the mark the daemon watches, and it is what gives the ticket a run — which is in turn what makes its `timone takeover` line work and what lets a written answer be picked up at all. A decision ticket created without the mark is the defect [ADR-0022](../../../doc/adr/0022-a-conversation-ticket-can-be-answered-in-writing.md) was written about: a well-formed question nothing is listening to.

**Mark the map as well** — `wayfinder:map` **and `timone`**, from the moment you create it. This reverses an earlier rule that said never to; the reasoning and its consequences are above, under [The map](#the-map).

**`research` is the one type the daemon cannot yet resolve unattended.** It is resolved in-session by a sub-agent (Mode 1, step 5) and normally closed before the daemon would ever list it. A `research` ticket left open and marked parks with a comment saying that machinery is not built — honest, but not what its own CTA promises, so close them in the session that fired them.

| Type | Mode | Resolved by |
|---|---|---|
| `research` | AFK | a fresh-context research sub-agent (Explore/general-purpose) reading docs, third-party APIs, knowledge bases; findings posted as the resolution comment, assets linked not pasted |
| `grilling` | HITL — **the default** | the `timone-grill` interview discipline scoped to the ticket's question: one question at a time, recommended answers, codebase-answerable questions answered from the codebase, glossary maintenance in `CONTEXT.md` throughout |
| `prototype` | HITL | `timone-prototype` ([ADR-0011](../../../doc/adr/0011-prototype-convention.md)): a cheap, throwaway artifact to react to when "how should it look/behave" is the key question — a `prototype/NN-<slug>` branch served at a preview URL, never merged, deleted once the reaction is recorded; the human's reaction *is* the resolution |
| `task` | HITL or AFK | manual work that unblocks a decision (signing up for a service, provisioning access, moving data so its shape can be seen) — done by the agent where possible, else handed to the human as a precise checklist; the resolution records what was done and the resulting facts later tickets depend on |

A HITL ticket resolves only through exchange with the human — never answer the human's side yourself.

### Every ticket carries its own CTA

A ticket body is the question **plus what the human is being asked to do about it** ([ADR-0022](../../../doc/adr/0022-a-conversation-ticket-can-be-answered-in-writing.md)). A question with no instruction is a defect: the human is assumed to know nothing about this process, and a wall of well-phrased questions they cannot act on is worse than no ticket. Close every body with the block for its type, verbatim in shape, substituting the real project and number:

**`grilling` and `task` — both paths:**

````markdown
---

**Two ways to answer — pick either.**

- **Write your answer here.** A comment is enough. You don't need to answer every part, and "I don't know, what do you suggest?" is a real answer. If something is still unclear I'll ask once more here, then stop.
- **Talk it through instead.** Run this and I'll pick up where this ticket left off:

  ```
  timone takeover <project>#<n>
  ```

**What I need from you:** answer here, or run the command.
````

**`prototype` — the takeover alone**, because there is nothing to react to until it is built:

````markdown
---

**This one needs something to look at first.** Run this and I'll build it and show it to you:

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

**The takeover line is a promise the CLI keeps, so long as the ticket carries the mark.** `timone takeover` resolves a ticket from the daemon's run ledger; the `timone` label above is what puts it there. The daemon picks a marked decision ticket up, recognises its `wayfinder:<type>`, enters at this stage rather than triaging it as a fresh request, and parks it waiting on you — which is the state the takeover resolves. Write both templates as they stand; the only way to make either line a lie is to leave the mark off.

### Reading a written answer

A comment on a claimed ticket, authored by the human and posted after the question, **is** the answer to it — no keyword, nothing for them to remember. When a session picks one up:

1. **Take it at its word and check it against the map.** A written answer is thinner than an interview by nature; it carries no hesitation you can read. Restate what you understood in the resolution comment so a misreading surfaces where the human is already looking.
2. **If it settles the question**, resolve the ticket exactly as an interview would have: resolution comment, close, gist onto the map, ADR at decision time if it passes stage 4's test.
3. **If it is partial or ambiguous**, post **only what is still open** — never the whole question again — and wait. Answer from the codebase anything the codebase can answer rather than asking it a second time.

   **This comment is where the process goes wrong most often, so it has a hard shape.** One line confirming their answers are recorded — a short list, not a restatement of each one. Then the single thing still open, in plain words. Then your recommendation, **one sentence of why and one sentence of what it costs**, and nothing more; the rest is a link to the artifact that holds it. Then the CTA. Under 150 words in total. `scratch-app` #31 is the counter-example this rule was written from: 520 words to ask one yes-or-no question, and fvermaut said he could not use it.
4. **One clarifying round, then stop asking in writing.** If the next answer still does not settle it, say so and hand back the takeover command. The bound is the whole reason the written path is allowed; a thread that keeps going is the ping-pong [ADR-0012](../../../doc/adr/0012-conversation-channels.md) struck out.

**Claiming:** assign the ticket to yourself **before any work** — the assignee *is* the claim; open + unassigned = unclaimed. **Blocking:** use GitHub's native sub-issue and dependency relationships where `gh`/GraphQL supports them (verify once per repo); where unavailable, fall back loudly to a body line `Blocked by: #N, #M`. The **frontier** is the open, unblocked, unclaimed children. Expect other sessions to be editing the tracker concurrently.

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
6. Stop. Report the map by name with its link, the frontier, and the suggested first working session. Update `STATUS.md` per the process convention.

## Mode 2 — Work through the map

Invoked with a map (URL, number, or fallback path); a ticket is optional — without one, *you* pick.

1. **Load the map** — the low-res view, not every ticket body.
2. **Choose the ticket**: the user's if named, else the first frontier ticket. **Claim it before any work.**
3. **Read the thread before asking anything.** A human may already have answered in writing — that is one of the two paths every HITL ticket offers, and re-asking a question they have answered is the failure the path exists to avoid. Then **resolve it** per its type (table above), zooming as needed — fetch the full body of any related closed ticket on demand; consult the skills the map's Notes name.
4. **Record the resolution**: post the answer as a resolution comment, **close** the ticket, append the one-line gist to the map's Decisions so far. If the decision was ADR-significant, the ADR was already written at decision time (see above).
5. **Tend the map**: create-then-wire newly surfaced tickets; graduate sharpened fog; rule mis-scoped tickets out of scope; update or delete tickets the answer invalidated.
6. **One ticket per session** — `research` tickets excepted. Update `STATUS.md`, then stop.

## Closing the effort

The way is clear when the frontier is empty and no fog remains. Then, **on the map ticket, in this order**:

1. **Post the route** — decisions by name, risks, deliberately open questions — as a comment on the map. This is the summary the human reads before agreeing, and it is also the machine's last word on the ticket: **only what is written after it counts as the go-ahead**, so post it before step 2 and never after.
2. **Rewrite the map's closing line** to ask for the go-ahead, replacing the one the body template carries:

   ````markdown
   ---

   **Every question on this map is answered.** Say the word here and I'll write the specification this map has been finding its way to — a plain comment is enough.

   **What I need from you:** say go ahead here, and I'll write it.
   ````

3. **Apply `wayfinder:frontier-empty` to the map.** That label is what tells the daemon the frontier is empty: on its next pass it opens the map's wait, keeps the map's standing call to action in step with it, and reads the human's next comment as the go-ahead. Without the label the map goes on asking for nothing, whatever the body says. Create the label on first use, as with the other `wayfinder:*` ones.
4. **Stop there.** The go-ahead starts stage 3 on the map's own run, with nothing run by hand — a comment agreeing is the whole mechanism ([ADR-0024](../../../doc/adr/0024-every-open-ticket-answers-for-itself.md)). Do not invoke `timone-prd` yourself off your own reading of the map; if the human is in the session with you and asks for the specification now, that is their call and it is theirs to make, not yours to assume.
5. **From the go-ahead until the specification is committed, the map holds its whole project** — no other ticket on it moves. That is intended, and it is worth saying in the route summary so nobody wonders why the queue stopped.
6. Close the map **only after the destination artifact is committed**, with a closing comment linking it.

**On the markdown fallback there is no daemon and no label**, so steps 3–5 have nothing to act on: write the route and the go-ahead ask into `map.md`, say plainly that the specification needs a session started by hand, and hand back. The mechanism above is the tracker path's alone.

**If the frontier reopens** — fog graduating into fresh tickets after step 3 — remove `wayfinder:frontier-empty` and put the working line back in the body. The map's own wait is not withdrawn once opened (a question the human may be halfway through answering), but nothing will start the specification while a question is open again.

Wayfinding produces decisions, never deliverables: no application code, no phase files, no PRDs written by this skill itself. `CONTEXT.md` (during grilling tickets), `STATUS.md`, and the fallback `doc/wayfinder/` tree are the only files it writes in the target project.
