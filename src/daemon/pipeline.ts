import type { EffortLevel } from "@anthropic-ai/claude-agent-sdk";

import type { GateDecision } from "./gates.js";

/**
 * The four kinds stage 1 classifies a request into. The daemon reads them
 * back off the `triage:<kind>` label the triage session applied.
 */
export const CLASSIFICATIONS = ["feature", "bug", "chore", "question"] as const;

export type Classification = (typeof CLASSIFICATIONS)[number];

/**
 * The kinds of ticket a wayfinder effort holds (ADR-0010), read back off the
 * `wayfinder:<type>` label the charting session applied.
 *
 * **`map` is the fifth, and it was deliberately absent until ADR-0024.** The
 * reasoning that kept it out was sound and is now overtaken: the map is an
 * index of the effort rather than a question anybody can answer, so a run on
 * it would be a run nothing could resolve. What that missed is the *last*
 * transition — the effort closing into a specification — which is a question
 * only the map can carry, because the map is the ticket that represents the
 * effort to the human. On 2026-08-13 fvermaut wrote his instruction on
 * `ivtrends` #1 and nothing was listening.
 *
 * So the map is a kind with a stage of its own ({@link PIPELINE_STAGES}'s
 * `charting`), **and the decision tickets are unchanged**.
 */
const WAYFINDER_TYPES = [
  "research",
  "grilling",
  "prototype",
  "task",
  "map",
] as const;

type WayfinderType = (typeof WAYFINDER_TYPES)[number];

/**
 * The label a wayfinding session applies to a map once its frontier is empty
 * — every decision ticket closed, no fog left
 * ([ADR-0024](../../doc/adr/0024-every-open-ticket-answers-for-itself.md)).
 *
 * **Not a `wayfinder:<type>`**, though it shares the namespace: it says
 * nothing about what kind of ticket this is, only that this map's own
 * questions are all answered. {@link wayfinderStage} ignores it for exactly
 * that reason, and a map carrying it is still a `wayfinder:map`.
 *
 * It is a label rather than anything in the ledger because the session that
 * closes the last decision ticket works the tracker and not the run store,
 * and because a human reading the map can see it — the frontier is a fact
 * about the tracker's own open issues, and this is where it is written down.
 */
export const FRONTIER_EMPTY_LABEL = "wayfinder:frontier-empty";

/** Whether `labels` say this map's decision tickets are all closed. */
export function frontierIsEmpty(labels: readonly string[]): boolean {
  return labels.includes(FRONTIER_EMPTY_LABEL);
}

/**
 * The stages a run passes through. Named for what they do rather than by
 * `process.md`'s numbers, because these strings surface in `timone status`
 * and on tickets, where a number would mean nothing to the reader.
 */
export const PIPELINE_STAGES = [
  "triage",
  "clarification",
  "wayfinding",
  "charting",
  "research",
  "requirements",
  "breakdown",
  "planning",
  "execution",
  "verification",
  "delivery",
  "remediation",
  "feedback",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/**
 * What a stage waits for once its session has done its work. `review` is the
 * wait at the end of the line: the work sits as an open pull request, and
 * what resolves it is a human's review comment, merge, or close — read off
 * the PR thread, never off the ticket.
 *
 * `escalation` is the odd one, and deliberately so
 * ([ADR-0033](../../doc/adr/0033-a-stage-that-cannot-act-on-an-answer-escalates.md)).
 * No stage declares it — see {@link StageFacts.waits} — because it is not
 * something a stage's own work opens. It is written onto a run whichever
 * stage was running, when that stage has been given an answer it may not act
 * on. Nothing written ends it: the stage already read those words and was
 * right about them, so reading them again buys another pass and the same
 * judgement. What ends it is a person.
 */
export type WaitKind = "gate" | "conversation" | "review" | "escalation" | "none";

interface StageFacts {
  /** The stage of `process.md` this is, for anyone comparing the two. */
  processStage: number;
  /**
   * What this step is called when a person is told about it — in `timone
   * status`, and in the note an escalation session writes to say where the
   * work carries on ([ADR-0035](../../doc/adr/0035-a-resolved-escalation-hands-the-run-back.md)
   * D3).
   *
   * **It lives here so it cannot be partial.** It was a map in `status.ts`
   * covering five stages of thirteen, which was survivable while nothing read
   * it back; a name the machinery *parses* has to exist for every stage and
   * name exactly one. Being a field of this table makes the first true by
   * construction — the compiler will not accept a stage without one — and
   * {@link stageFromLabel} carries the second.
   *
   * Written for someone who has never heard of this process: never the
   * stage's own name, never a number.
   */
  label: string;
  /** What the run waits on when the stage's session finishes. */
  waits: WaitKind;
  /**
   * Whether a run at this stage owns a work branch — and therefore holds its
   * project against every other ticket (see `RunStore`). Stages that only
   * talk to the human touch no repository and hold nothing.
   */
  ownsBranch: boolean;
  /** Whether the machinery for this stage exists yet. */
  built: boolean;
  /** The stage that follows, once this one's outcome is accepted. */
  next?: PipelineStage;
}

/**
 * A stage the daemon starts a session for, which must therefore say what that
 * session runs on. Declaring the model is not optional here on purpose: a
 * spawned stage without one silently takes the runtime's default, which is
 * precisely the defect this requirement closes — and it would hide in
 * whichever stage nobody thought to check.
 */
interface SpawnedStage {
  built: true;
  /** Never set here: {@link UnspawnedStage} is what carries the false. */
  spawns?: never;
  waits: WaitKind;
  model: string;
  /**
   * Omitted for models that reject the parameter — Haiku 4.5 does. Optional
   * rather than defaulted, so the type carries the constraint instead of a
   * runtime check having to.
   */
  effort?: EffortLevel;
}

/**
 * A stage no session is ever started for, and which therefore declares
 * neither. A model on it would be configuration nothing reads.
 *
 * **Two ways to be one, and they are different facts about a stage:**
 *
 * - `built: false` — the machinery does not exist yet.
 * - `built: true, spawns: false` — the machinery exists and it is not a
 *   session. `charting` is the first of these (ADR-0024): what happens at the
 *   map's stage is a ticket waiting and a call to action tracking it, and the
 *   session that follows the human's go-ahead belongs to stage 3, on the same
 *   run. Declaring a model here would name a session nobody starts.
 *
 * It used to be one way, and briefly looked like a third. A stage waiting on
 * a conversation was unspawnable because `spawn()` short-circuited to
 * `openConversation` before it ever reached `runStage` — but a conversation
 * can now be **answered in writing**, and the session that ingests that
 * answer is a session the daemon starts. So a conversation stage declares a
 * model like any other spawned stage; what it still never does is start *of
 * its own accord* (see {@link runsUnattended}).
 */
type UnspawnedStage = { model?: never; effort?: never } & (
  | { built: false; spawns?: never }
  | { built: true; spawns: false }
);

type StageSpec = StageFacts & (SpawnedStage | UnspawnedStage);

/**
 * The model the approval-recording session runs on. Not a stage — it has no
 * row in the graph because it is not one of `process.md`'s steps — but it is
 * the second place `runtime.start` is called, and the one that would
 * otherwise keep the runtime default while every real stage moved off it.
 *
 * Haiku because the work genuinely is mechanical: stamp a name and a date
 * into an artifact that already exists, commit, push. No effort goes with it.
 */
export const APPROVAL_RECORD_MODEL = "claude-haiku-4-5";

/**
 * The stage graph. It is data rather than control flow on purpose: the daemon
 * orchestrates stage skills and never reimplements them, so what it holds
 * about a stage is which skill runs, what the run then waits for, what comes
 * next, and what it runs on — and those are facts, not code paths.
 *
 * The model and effort columns were settled once, at the grill of
 * 2026-08-06, and carry their reasons here so no slice re-argues them. They
 * live in the graph rather than in `timone.yaml` because the manifest is
 * strictly per-*project* and this is per-*stage*; moving them later would be
 * a refactor, and changing one is a one-line edit — which is why the choice
 * is recorded in phase 14's plan rather than in an ADR.
 */
const STAGES: Record<PipelineStage, StageSpec> = {
  triage: {
    processStage: 1,
    label: "sorting the request",
    waits: "none",
    ownsBranch: false,
    built: true,
    // Not the cheap model, though the work looks small: triage routes
    // silently. A `triage:chore` label goes straight to planning while
    // `triage:feature` opens a human interview first, so a misclassification
    // skips a gate and nobody is told a gate was skipped.
    model: "claude-sonnet-5",
    effort: "medium",
    // What follows depends on the classification: see `routeAfterTriage`.
  },
  clarification: {
    processStage: 2,
    label: "asking what you need",
    waits: "conversation",
    ownsBranch: false,
    built: true,
    // Read only when the *daemon* spawns the session that ingests a written
    // answer (ADR-0022) — a human's `timone takeover` runs in their own CLI
    // and never consults this. That session judges whether what they wrote
    // settles the question, resolves or asks the one remaining thing on that
    // judgement, and may write an ADR: the same class of work as requirements
    // and planning, which carry the same pair.
    model: "claude-opus-5",
    effort: "high",
    next: "requirements",
  },
  wayfinding: {
    // Stage 2's other mode: the same requirements discovery, at scale
    // (ADR-0010). What is resolved here is one decision ticket off a map, and
    // what it produces is a decision — never a slice of a build, which is why
    // it owns no branch.
    processStage: 2,
    label: "talking a question through",
    waits: "conversation",
    ownsBranch: false,
    built: true,
    // The same pair as `clarification`, for the same reason and read on the
    // same occasion: the daemon-spawned session that ingests a written answer.
    model: "claude-opus-5",
    effort: "high",
    // **Nothing follows, on purpose.** A decision ticket's answer resolves
    // that ticket and ends its run. The destination artifact is the whole
    // map's to hand to stage 3 once the effort closes, and advancing one
    // ticket into PRD-writing would write requirements off a single answer.
  },
  charting: {
    // The map itself ([ADR-0024](../../doc/adr/0024-every-open-ticket-answers-for-itself.md),
    // amending ADR-0010). Stage 2's other artifact: not a question anybody
    // answers but the effort's own ticket, and the only place the stage-2 →
    // stage-3 handover can be asked for — which is why the `next` is here and
    // emphatically not on `wayfinding`, where it would write a specification
    // off a single decision ticket's answer.
    processStage: 2,
    label: "keeping the list of questions",
    // The go-ahead is an ordinary written answer, read exactly as any other
    // (ADR-0022's path, unchanged): "say go and I'll write the specification".
    // Not a gate — a gate is an approval of something already written, and
    // there is nothing to approve until stage 3 has run.
    waits: "conversation",
    // The map holds nothing while it waits. It starts holding its project the
    // moment the go-ahead lands, because what follows *does* own a branch —
    // and from then until the specification is committed no other ticket on
    // that project moves. ADR-0024 records that as intended.
    ownsBranch: false,
    built: true,
    // Nothing runs at this stage: the map's whole behaviour is a ticket
    // waiting and a call to action tracking its own state. See
    // {@link UnspawnedStage}.
    spawns: false,
    next: "requirements",
  },
  research: {
    // The one wayfinder type nobody waits on: its own CTA says "nothing —
    // I'm resolving this one myself and will post what I find here".
    processStage: 2,
    label: "looking something up",
    waits: "none",
    ownsBranch: false,
    // Built by phase 27. What kept it unbuilt was the spawner's post-stage
    // fall-through, which assumed the only wait-free stage was triage and read
    // a classification off the ticket's labels — which a wayfinder ticket does
    // not carry, so a run reaching it died on "triage recorded no
    // classification". `afterStage` now has a branch of its own for it, which
    // is what the fall-through's own comment said any new wait-free stage had
    // to be given.
    built: true,
    // Not the cheap model, for `triage`'s reason wearing stage 2's clothes:
    // what this stage produces is an answer somebody's decision rests on, and
    // a lookup that is confidently wrong is worse than one that says it could
    // not find out. Judging what a source is worth is the work here.
    model: "claude-opus-5",
    effort: "high",
    // **Nothing follows, on purpose** — `wayfinding`'s reasoning exactly. A
    // research answer resolves its own ticket and feeds the map; advancing on
    // one would write requirements off a single lookup.
  },
  requirements: {
    processStage: 3,
    label: "writing down what it needs",
    waits: "gate",
    ownsBranch: true,
    built: true,
    // The PRD everything downstream is built and verified against.
    model: "claude-opus-5",
    effort: "high",
    next: "breakdown",
  },
  breakdown: {
    // ADR-0030 D1. `process.md` stage 5 — this *is* the planning stage in the
    // sense ADR-0028 D1 means, split into its own row because one stage cannot
    // declare two waits, and the list of pieces is gated while each piece's
    // phase file is not. Four stages already share `processStage: 2` for the
    // same reason, so the mapping being many-to-one is the precedent, not the
    // exception.
    processStage: 5,
    label: "working out the pieces",
    waits: "gate",
    // Chunk zero's branch, inherited rather than cut: `claimBranch` returns
    // early when the run already has one, so this costs nothing and keeps the
    // project held from the specification through the approval (ADR-0028 D2).
    ownsBranch: true,
    built: true,
    // The one cut the human approves for the whole initiative, and the only
    // approval standing between a specification and every pull request that
    // follows it. A bad cut is not a bad phase, it is a bad five phases.
    model: "claude-opus-5",
    effort: "high",
    next: "planning",
  },
  planning: {
    processStage: 5,
    label: "preparing the work",
    // ✏ Ungated since ADR-0030 D1. The plan the human approved is the
    // breakdown; this stage writes one chunk's phase file per visit, and a
    // gate here would ask them again about work they have already said yes to
    // — once per chunk. What judges the chunk is its pull request.
    waits: "none",
    ownsBranch: true,
    built: true,
    // Unchanged: a bad cut of one chunk still costs a whole phase, and this is
    // now the last unattended judgement before code gets written.
    model: "claude-opus-5",
    effort: "high",
    next: "execution",
  },
  execution: {
    processStage: 6,
    label: "building",
    waits: "none",
    ownsBranch: true,
    built: true,
    // A fleet: `timone-execute` spawns one sub-agent per sub-phase, and they
    // inherit this row.
    model: "claude-opus-5",
    effort: "xhigh",
    next: "verification",
  },
  verification: {
    processStage: 7,
    label: "checking the result",
    waits: "none",
    ownsBranch: true,
    built: true,
    // The check nobody else performs — correctness over cost.
    model: "claude-opus-5",
    effort: "xhigh",
    next: "delivery",
  },
  delivery: {
    processStage: 8,
    label: "delivering",
    waits: "review",
    ownsBranch: true,
    built: true,
    // Also a fleet: two review axes as parallel fresh contexts.
    model: "claude-opus-5",
    effort: "high",
    // Nothing follows in the graph: the run ends at the pull request, whose
    // merge or close is a terminal event on the run, not a stage.
  },
  remediation: {
    // ADR-0016's carve-out of stage 9: a concrete review comment is
    // confirmed intake, and its fix rides the verify-fix shape — so what
    // follows a remediation is a full verification, then re-delivery.
    processStage: 9,
    label: "acting on your review",
    waits: "none",
    ownsBranch: true,
    built: true,
    // Coding, on a live pull request.
    model: "claude-opus-5",
    effort: "high",
    next: "verification",
  },
  feedback: {
    processStage: 9,
    label: "looking into what went wrong",
    // **A gate, because a diagnosis is not a decision to act.** Stage 9
    // classifies what a reaction *means* and proposes a response; the human
    // confirms it, and only then does anything get built. That is the same
    // shape as the specification gate and it reuses the same machinery: the
    // record is committed and readable before the question is asked, so what
    // is approved is the document rather than a paraphrase of it.
    waits: "gate",
    // It writes the feedback record, so it holds its project from the moment
    // the diagnosis starts until the human has answered. A bug diagnosis that
    // ran beside another ticket's build would be reading a working copy
    // somebody else was changing.
    ownsBranch: true,
    // Built by phase 27. Until then `routeAfterTriage` sent every `bug` here
    // and every one of them parked for the life of the ledger — one of stage
    // 1's four classifications routed into nothing at all.
    built: true,
    // The judgement is what layer a complaint belongs to: a change of intent,
    // a gap in what was built, or a record that is simply wrong. Getting that
    // wrong sends a PRD amendment through a build, or a defect through a
    // document edit.
    model: "claude-opus-5",
    effort: "high",
    // Approving the diagnosis dispatches it, and the first stage that can act
    // on it is planning — ADR-0016's carve-out is the *other* road, taken by a
    // review comment on an open pull request, which never comes through here.
    next: "planning",
  },
};

/** What a stage's outcome does to the run that reached it. */
export type PipelineTransition =
  | { kind: "advance"; stage: PipelineStage }
  | { kind: "repeat"; stage: PipelineStage; feedback: string }
  | { kind: "wait" }
  | { kind: "finish"; reason: string }
  /**
   * The stage stopped because what it was asked to do next is outside what
   * it may do — most often an answer it read, understood, and cannot act on
   * without breaking the very check it exists to make (ADR-0033).
   *
   * `reason` is the stage's own account of the dead end, in its own words,
   * and it is input to whoever picks the run up rather than an instruction:
   * a stage sees its own ticket and its own work, not the source, the
   * decisions or the diff. `owed` is the stage it believes should have run
   * next, when it has a view — and it may be wrong about that too.
   */
  | { kind: "escalate"; reason: string; owed?: PipelineStage };

/**
 * The classification a triage session recorded, read back off the ticket's
 * labels. Anything unrecognised reads as unclassified: routing on a word
 * nobody defined is worse than triaging the ticket again.
 */
export function classificationFromLabels(
  labels: readonly string[],
): Classification | undefined {
  for (const label of labels) {
    const kind = label.startsWith("triage:") ? label.slice("triage:".length) : "";
    if ((CLASSIFICATIONS as readonly string[]).includes(kind)) {
      return kind as Classification;
    }
  }
  return undefined;
}

/**
 * The stage a wayfinder ticket carrying `labels` enters, or undefined when
 * the ticket is not one.
 *
 * **Derived from the labels every time, never stored on the run.** The
 * tracker holds the ticket's type; a copy of it in the ledger is a copy that
 * can disagree with a label a human has since changed.
 *
 * Three answers, and the split is ADR-0010's own table plus ADR-0024's
 * amendment to it:
 *
 * - `research` resolves itself with nobody waiting.
 * - `grilling`, `prototype` and `task` each resolve only through exchange
 *   with a human — a conversation, whatever medium it runs on — and their
 *   stage has nothing following it, on purpose.
 * - `map` is the effort itself, and its stage is the one that hands stage 2's
 *   whole outcome to stage 3.
 */
/**
 * Whether `labels` say this ticket is a wayfinder map — the effort itself,
 * rather than one of the decisions it holds.
 *
 * Told apart from {@link wayfinderStage} on purpose. That answers *where does
 * this enter*, and a map's answer to it is only true once: a map is a decision
 * ticket for its first chunk and an initiative building its pieces after that
 * (`entryContext` in `poll.ts` is where the difference is spent).
 */
export function isMap(labels: readonly string[]): boolean {
  return labels.includes("wayfinder:map");
}

export function wayfinderStage(
  labels: readonly string[],
): PipelineStage | undefined {
  for (const label of labels) {
    const type = label.startsWith("wayfinder:")
      ? label.slice("wayfinder:".length)
      : "";
    if (!(WAYFINDER_TYPES as readonly string[]).includes(type)) continue;

    const kind = type as WayfinderType;
    if (kind === "research") return "research";
    if (kind === "map") return "charting";
    return "wayfinding";
  }
  return undefined;
}

/**
 * Where a classified request goes next — `process.md` stage 1's routing
 * table, and nothing more.
 *
 * One narrowing is deliberate and worth naming: the spec lets triage send a
 * feature straight to stage 3 when its requirements are already clear, and
 * lets it *recommend* the at-scale discovery mode for a sprawling one. Both
 * are judgements, and a `triage:<kind>` label cannot carry a judgement — so
 * the daemon takes the safe road every time and asks the human first. A
 * clarification conversation that turns out to be unnecessary costs one short
 * interview; a skipped one costs a PRD written against a guess.
 */
export function routeAfterTriage(kind: Classification): PipelineTransition {
  switch (kind) {
    case "feature":
      return { kind: "advance", stage: "clarification" };
    case "chore":
      return { kind: "advance", stage: "planning" };
    case "bug":
      return { kind: "advance", stage: "feedback" };
    case "question":
      return {
        kind: "finish",
        reason: "a question is answered on the ticket, not built",
      };
  }
}

/** The stage that follows `stage`, or undefined at the end of the line. */
export function stageAfter(stage: PipelineStage): PipelineStage | undefined {
  return STAGES[stage].next;
}

/**
 * What this step is called when a person is told about it. Total: every stage
 * has one, and the compiler enforces it.
 */
export function stageLabel(stage: PipelineStage): string {
  return STAGES[stage].label;
}

/**
 * The stage a plain name refers to, or undefined when no stage answers to it
 * ([ADR-0035](../../doc/adr/0035-a-resolved-escalation-hands-the-run-back.md)
 * D3).
 *
 * **Forgiving about how it was typed, exact about which words.** A session
 * writing `Building` means the same step; one writing `build` means nothing
 * anybody defined, and the undefined is the answer — a caller that guessed
 * would start a session at the wrong step, on a branch carrying half-built
 * work.
 */
export function stageFromLabel(label: string): PipelineStage | undefined {
  const wanted = label.trim().toLowerCase();
  if (wanted === "") return undefined;
  return PIPELINE_STAGES.find((stage) => STAGES[stage].label === wanted);
}

/** What a run at `stage` waits for once the stage's work is done. */
export function waitFor(stage: PipelineStage): WaitKind {
  return STAGES[stage].waits;
}

/** Whether a run at `stage` owns a work branch, and so holds its project. */
export function ownsBranch(stage: PipelineStage): boolean {
  return STAGES[stage].ownsBranch;
}

/** Whether the machinery for `stage` exists yet. */
export function isBuilt(stage: PipelineStage): boolean {
  return STAGES[stage].built;
}

/**
 * The model a stage's session runs on, or undefined for a stage no session is
 * ever started for. The undefined is a real answer rather than a gap: see
 * {@link UnspawnedStage}.
 */
export function modelFor(stage: PipelineStage): string | undefined {
  return STAGES[stage].model;
}

/**
 * The reasoning effort a stage's session runs at, or undefined when there is
 * none to send — either because the stage spawns nothing, or because its
 * model rejects the parameter. Callers must omit the field entirely on
 * undefined rather than sending it unset.
 */
export function effortFor(stage: PipelineStage): EffortLevel | undefined {
  return STAGES[stage].effort;
}

/**
 * Whether the daemon starts this stage **of its own accord**.
 *
 * Derived rather than declared, because it *is* the same fact: a stage whose
 * wait is a conversation has no unattended work to do — the conversation is
 * the work, and it needs a human to have said something. Recording it twice
 * would let the two drift.
 *
 * ADR-0022 narrowed what this answers without changing the answer. A written
 * answer on the ticket *does* start a conversation stage's session — but the
 * human is what started it, and this function is still false for that stage,
 * because the daemon reaching the stage with nothing in hand must still stop
 * and invite rather than run. The written path is a branch in the spawner on
 * the answer's presence, not a redefinition of this.
 */
export function runsUnattended(stage: PipelineStage): boolean {
  return waitFor(stage) !== "conversation";
}

/** The `process.md` stage number, for messages that need to be precise. */
export function processStage(stage: PipelineStage): number {
  return STAGES[stage].processStage;
}

/**
 * Apply the human's answer to a gate.
 *
 * Approval advances exactly one stage; a change request re-enters the *same*
 * stage carrying the human's words, so the stage redoes its work with them in
 * hand. No third outcome exists, which is the property that makes a gate a
 * gate — see {@link readGateDecision} for why a reply is judged by shape.
 */
export function readGate(
  stage: PipelineStage,
  decision: GateDecision | undefined,
): PipelineTransition {
  requireWait(stage, "gate");
  if (decision === undefined) return { kind: "wait" };

  if (decision.kind === "change-request") {
    return { kind: "repeat", stage, feedback: decision.feedback };
  }

  const next = stageAfter(stage);
  if (next === undefined) {
    return { kind: "finish", reason: `nothing follows ${stage}` };
  }
  return { kind: "advance", stage: next };
}

/**
 * Apply the end of a conversation. Only an accepted outcome advances: a
 * conversation someone opened and walked away from decided nothing, and the
 * ticket is still waiting on them.
 */
export function concludeConversation(
  stage: PipelineStage,
  outcome: { accepted: boolean },
): PipelineTransition {
  requireWait(stage, "conversation");
  if (!outcome.accepted) return { kind: "wait" };

  const next = stageAfter(stage);
  if (next === undefined) {
    return { kind: "finish", reason: `nothing follows ${stage}` };
  }
  return { kind: "advance", stage: next };
}

/**
 * Refuse to apply the wrong kind of answer to a stage. A gate reply arriving
 * for a stage that waits on a conversation means the caller has lost track of
 * what the run is doing, and guessing would resolve a wait nobody answered.
 */
function requireWait(stage: PipelineStage, expected: WaitKind): void {
  const actual = waitFor(stage);
  if (actual !== expected) {
    throw new Error(
      `Stage ${stage} waits on ${actual === "none" ? "nothing" : actual}, ` +
        `not on a ${expected}`,
    );
  }
}
