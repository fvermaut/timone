import {
  NEEDED_FROM_YOU,
  type PullRequest,
  type TicketComment,
  type TicketingAdapter,
  type TicketingProject,
  type TicketThread,
} from "../adapters/ticketing.js";
import { namedPeople, ticketLimitOf, type Manifest } from "../manifest.js";
import {
  APPROVAL_RECORD_MODEL,
  classificationFromLabels,
  effortFor,
  modelFor,
  ownsBranch,
  stageLabel,
  type PipelineStage,
} from "../daemon/pipeline.js";
import {
  approvalRecordPrompt,
  runnerInstructionsBlock,
  stagePrompt,
  workBranch,
} from "../daemon/prompts.js";
import { NoPlaceError, type Run, type RunStore } from "../daemon/runs.js";
import { HELD_LABEL, HELD_LABEL_DESCRIPTION, PRIORITY_LABEL } from "../daemon/steps.js";
import {
  openStepTickets,
  tryMergeChunkZero,
  type ChunkZeroApproval,
  type ChunkZeroDeps,
} from "../daemon/chunk-zero.js";
import { closeInitiativeIfDone } from "../daemon/poll.js";
import { withPeopleNamed } from "../daemon/people.js";
import {
  isPrompted,
  sessionRequest,
  workspaceFor,
  type TimonePin,
} from "../daemon/session.js";
import type {
  StepResult,
  StepSession,
  StepSessionInput,
} from "../daemon/step-session.js";
import {
  defaultOrder,
  standingOf,
  ticketKindOf,
  type Approval,
  type OrderStep,
  type TicketContext,
} from "./order.js";
import {
  departureNotice,
  joined,
  limitNotice,
  piecesApprovedNotice,
  piecesFailedNotice,
  type PiecesFailure,
} from "./comments.js";
import { sinceLastBuild } from "./departures.js";
import { isNamedPerson } from "./brief.js";
import { allowanceOf, isOverLimit, spentOn } from "./limit.js";
import { appendEntry, readRecord, startsAStep, type RecordEntry } from "./record.js";
import type {
  CommentTimoneIssueInput,
  EndRunInput,
  FileTimoneIssueInput,
  MessageStepInput,
  PostInput,
  RecordApprovalInput,
  RunnerToolName,
  SetHoldInput,
  StartStepInput,
  StopStepInput,
} from "./tools.js";

/**
 * The runner's actions: the only things the runner can do
 * ([ADR-0060](../../doc/adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md),
 * PRD-05).
 *
 * **The runner decides; code keeps the rules.** Each action checks what must
 * hold before it acts — a named person's approval, the spending limit, a
 * reason for every skipped step, a pull request merged (or a named person's
 * comment asking to stop) before a run whose branch holds commits the default
 * branch lacks may end — and refuses in plain words when it does not. The
 * runner reads the refusal and decides again. A rule written only in the
 * runner's instructions is a request; a rule here is a fact.
 */

/**
 * What an action answers, in plain words for the runner to read.
 *
 * A refusal is an expected answer, not an error: the runner asked for
 * something the rules do not allow, and it is told why.
 */
export type ActionResult = { ok: true; said: string } | { ok: false; refused: string };

/** A step of a run that is running now. */
export interface RunningStep {
  stage: PipelineStage;
  session: StepSession;
  /** When the step was started, as an ISO-8601 timestamp. */
  startedAt: string;
  /** When the runner asked the step to stop, if it did. */
  stopRequested?: string;
}

/**
 * The steps running now, by run id.
 *
 * **A step outlives the wake that started it.** The runner is woken, starts
 * a step, and ends; the step runs on for an hour. The actions are built again
 * at each wake, so what is running cannot live in them. The driver owns one
 * of these and hands it to every wake's actions.
 */
export class RunningSteps {
  private readonly steps = new Map<string, RunningStep>();

  get(runId: string): RunningStep | undefined {
    return this.steps.get(runId);
  }

  set(runId: string, step: RunningStep): void {
    this.steps.set(runId, step);
  }

  delete(runId: string): void {
    this.steps.delete(runId);
  }

  has(runId: string): boolean {
    return this.steps.has(runId);
  }
}

/** What the runner's actions need from outside. */
export interface RunnerActionDeps {
  store: RunStore;
  adapter: TicketingAdapter;
  manifest: Manifest;
  /**
   * The Timone root. It is where the run record lives (`.timone/records/`),
   * and the working directory of every session, which never runs inside a
   * managed project (ADR-0007).
   */
  root: string;
  /**
   * The version of Timone a step's box is built from: `readTimoneCheckout`'s
   * pin, read by the caller (ADR-0041 D2). Undefined when the root is no
   * checkout, and then the request carries no workspace, as the spawner's
   * does. A seam, because reading it runs git, and the runner's actions run
   * none.
   */
  timonePin: () => Promise<TimonePin | undefined>;
  project: TicketingProject;
  /**
   * What the driver knows about the ticket that its labels do not say, so
   * its kind — and so its default order — is read the way the brief reads it.
   */
  ticketContext: TicketContext;
  /** `startStepSession`, bound to the daemon's store, runtime and log. */
  startStep: (input: StepSessionInput) => Promise<StepSession>;
  running: RunningSteps;
  /**
   * Called once a step has ended and the machine has written down how. The
   * driver puts the run back to wait for the runner, and wakes it: that wait
   * is the driver's to make, not the actions'.
   */
  stepEnded: (runId: string, stage: PipelineStage, result: StepResult) => Promise<void>;
  /** The time now, as an ISO-8601 timestamp. */
  clock: () => string;
  log: (message: string) => void;
}

/** The actions the runner can take in one run. */
export interface RunnerActions {
  startStep(input: StartStepInput): Promise<ActionResult>;
  messageStep(input: MessageStepInput): Promise<ActionResult>;
  stopStep(input: StopStepInput): Promise<ActionResult>;
  post(input: PostInput): Promise<ActionResult>;
  setHold(input: SetHoldInput): Promise<ActionResult>;
  recordApproval(input: RecordApprovalInput): Promise<ActionResult>;
  fileTimoneIssue(input: FileTimoneIssueInput): Promise<ActionResult>;
  commentTimoneIssue(input: CommentTimoneIssueInput): Promise<ActionResult>;
  endRun(input: EndRunInput): Promise<ActionResult>;
}

const NO_STEP_RUNNING = "No step of this run is running now.";

/**
 * What a `step-ended` entry says ended a step the runner asked to stop, so a
 * reader of the record can tell it from a step that failed by itself.
 */
export const STOPPED_BY_RUNNER = "runner";

/**
 * The label a fault in Timone is filed under, as Timone's own defects always
 * are (CLAUDE.md). Nothing else: an issue marked for the machine would be
 * worked by the daemon, and a fault is for a person to judge first.
 */
const TIMONE_BUG_LABEL = "bug";

const NO_TIMONE_PROJECT =
  "The manifest has no project called timone, so there is nowhere to file a fault in Timone.";

/** Timone's own repository, as the manifest declares it, or undefined when it does not. */
function timoneProject(manifest: Manifest): TicketingProject | undefined {
  const config = manifest.projects["timone"];
  return config === undefined ? undefined : { name: "timone", repoUrl: config.repo_url };
}

/**
 * Whether a comment carries the call-to-action line with something after it
 * on the same line. Every message Timone posts ends on it, and a reader
 * looks at it first: a comment without it leaves the person not knowing
 * whether anything is asked of them.
 */
function asksSomething(body: string): boolean {
  return body
    .split("\n")
    .some((line) => {
      const at = line.indexOf(NEEDED_FROM_YOU);
      return at !== -1 && line.slice(at + NEEDED_FROM_YOU.length).trim() !== "";
    });
}

/**
 * The steps of `order` that starting `stage` now would leave out, for run
 * `runId`.
 *
 * A step is left out when it comes before `stage` in the order, has not been
 * done — a session at its stage has not started, or its approval has not been
 * recorded — and the run has not already said it left it out. That last part
 * matters: once the runner has skipped a step with its reason, every later
 * step would otherwise count it again, and ask for a reason and tell the
 * person each time.
 *
 * Nothing is left out by a stage the order does not hold (a remediation on a
 * feature ticket), or by a stage this run has already started once: that is
 * going back, or running a step again, and neither leaves anything out. The
 * session that writes an approval into its file does not start its stage's
 * step (40v).
 *
 * **Except the check of the work built last** (verification of phase 40).
 * Building again after the check is going back, but a step after the check
 * that starts with no check since that building leaves the check out for
 * that work, though the check ran once before — unless the run has said so
 * since that building. `recheck` is set then.
 */
function skippedBy(
  stage: PipelineStage,
  order: readonly OrderStep[],
  entries: readonly RecordEntry[],
  runId: string,
): { steps: OrderStep[]; recheck?: OrderStep } {
  const ofRun = entries.filter((entry) => "runId" in entry && entry.runId === runId);
  const done = (step: OrderStep): boolean =>
    step.stage !== undefined
      ? ofRun.some((entry) => startsAStep(entry) && entry.stage === step.stage)
      : ofRun.some((entry) => entry.kind === "approval" && entry.what === step.approval);
  const departed = (step: OrderStep): boolean =>
    ofRun.some((entry) => entry.kind === "departure" && entry.skipped.includes(step.id));

  const target = order.findIndex((step) => step.stage === stage);
  const step = order[target];
  if (step === undefined) return { steps: [] };
  const before = order.slice(0, target);
  const left = done(step) ? [] : before.filter((each) => !done(each) && !departed(each));

  const since = sinceLastBuild(ofRun);
  const recheck =
    since === undefined
      ? undefined
      : before.find(
          (each) =>
            each.check === true &&
            done(each) &&
            !since.some((entry) => startsAStep(entry) && entry.stage === each.stage) &&
            !since.some((entry) => entry.kind === "departure" && entry.skipped.includes(each.id)),
        );
  if (recheck === undefined) return { steps: left };
  return { steps: before.filter((each) => each === recheck || left.includes(each)), recheck };
}

/** What a person calls each thing a named person approves. */
export const APPROVAL_WORDS: Record<Approval, string> = {
  requirements: "the requirements",
  pieces: "the list of pieces",
};

/** The stage whose step writes each thing a named person approves. */
const APPROVED_STAGE = {
  requirements: "requirements",
  pieces: "breakdown",
} as const satisfies Record<Approval, PipelineStage>;

/**
 * Why a comment cannot approve something that was finished after it. One
 * sentence for each thing approved, so the words agree: the requirements
 * are many, the list of pieces is one.
 */
const WRITTEN_BEFORE: Record<Approval, string> = {
  requirements:
    "That comment was written before the requirements were finished, so it cannot approve them. " +
    "Ask the person to approve the requirements now that they are written.",
  pieces:
    "That comment was written before the list of pieces was finished, so it cannot approve it. " +
    "Ask the person to approve the list of pieces now that it is written.",
};

/** Why there is nothing to approve yet: no step of the run has written the thing. */
const NOT_WRITTEN: Record<Approval, string> = {
  requirements:
    "No step of this run has finished writing the requirements, so there is nothing to approve yet. " +
    "Start the step that writes them first.",
  pieces:
    "No step of this run has finished writing the list of pieces, so there is nothing to approve yet. " +
    "Start the step that writes it first.",
};

/** What a `notice` entry says the ticket was told when it reached its limit. */
const LIMIT_NOTICE = "limit";

/**
 * The project's own limit per ticket. A project the manifest does not
 * declare has no run at all, so reaching this without one is a wiring
 * mistake.
 */
function limitBaseOf(manifest: Manifest, name: string): number {
  const config = manifest.projects[name];
  if (config === undefined) {
    throw new Error(`project "${name}" is not in the manifest, so it has no limit`);
  }
  return ticketLimitOf(config);
}

/** Whether the ticket was told of its limit since a named person last raised it. */
function toldOfLimit(entries: readonly RecordEntry[]): boolean {
  let told = false;
  for (const entry of entries) {
    if (entry.kind === "limit-raised") told = false;
    if (entry.kind === "notice" && entry.about === LIMIT_NOTICE) told = true;
  }
  return told;
}

/** What a `notice` entry starts with when the approved list of pieces was not acted on (40x). */
const PIECES_FAILED_NOTICE = "list of pieces not acted on";

/**
 * What failed after the approval of the list of pieces, in the words the
 * record's notice keeps and the runner is told: what did not happen, and
 * what the forge or git said in brackets.
 */
function piecesFailureText(failure: PiecesFailure): string {
  switch (failure.failed) {
    case "merge":
      return failure.conflict
        ? "the requirements and the list of pieces were not added to the default branch, because it " +
            "has changes that clash with them, and a person has to decide which side to keep " +
            `(${failure.said})`
        : `the requirements and the list of pieces were not added to the default branch (${failure.said})`;
    case "tickets":
      return (
        "the requirements and the list of pieces are on the default branch, but the tickets for " +
        `the pieces were not opened (${failure.said})`
      );
    default:
      return failure satisfies never;
  }
}

/** What the `notice` entry says: the run, then what failed and why. */
function piecesFailedAbout(runId: string, failure: PiecesFailure): string {
  return `${PIECES_FAILED_NOTICE}, run ${runId}: ${piecesFailureText(failure)}`;
}

/**
 * What failed and why, when `about` is the notice {@link piecesFailedAbout}
 * wrote for run `runId`, or undefined when it is any other notice. The
 * driver reads it back to tell the runner on the wake after the step (40x).
 */
export function piecesFailureIn(about: string, runId: string): string | undefined {
  const start = `${PIECES_FAILED_NOTICE}, run ${runId}: `;
  return about.startsWith(start) ? about.slice(start.length) : undefined;
}

/**
 * The approvals run `runId` has gone without: named in one of its
 * `departure` entries, and never recorded as given. A step is told of each,
 * so a skill that finds an unapproved file knows it was left so on purpose.
 */
function skippedApprovals(
  order: readonly OrderStep[],
  entries: readonly RecordEntry[],
  runId: string,
): Approval[] {
  const ofRun = entries.filter((entry) => "runId" in entry && entry.runId === runId);
  return order.flatMap((step) => {
    if (step.approval === undefined) return [];
    const departed = ofRun.some(
      (entry) => entry.kind === "departure" && entry.skipped.includes(step.id),
    );
    const given = ofRun.some(
      (entry) => entry.kind === "approval" && entry.what === step.approval,
    );
    return departed && !given ? [step.approval] : [];
  });
}

/** The text with its first letter in capitals, to start a sentence. */
function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Reduce an error to its first line, for a refusal the runner reads. */
function oneLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0] ?? message;
}

/** The runner's actions for `run`. */
export function runnerActions(deps: RunnerActionDeps, run: Run): RunnerActions {
  /** The run as the ledger has it now: a branch or a pull request may be newer than `run`. */
  const current = (): Run => deps.store.get(run.id) ?? run;

  /**
   * Add one entry to the end of the ticket's record. Only the machine writes
   * there — these actions, never the runner — which is what lets the limit
   * and the departure list be worked out from it.
   */
  const write = (entry: RecordEntry): void => {
    appendEntry(deps.root, deps.project.name, run.ticket, entry);
  };

  /**
   * The number of the run's open pull request, or undefined when it has none.
   * The ledger's own number first, then the forge's answer for the branch.
   */
  const openPullRequest = async (): Promise<number | undefined> => {
    const { pr, branch } = current();
    if (pr !== undefined) return pr;
    if (branch === undefined) return undefined;
    const found = await deps.adapter.findPullRequest(deps.project, branch);
    return found?.state === "open" ? found.number : undefined;
  };

  /**
   * Every entry of the ticket's record, every run's, or the reason it cannot
   * be read. Every run's, because the limit is counted across all of them.
   */
  const readTicketRecord = ():
    | { ok: true; entries: RecordEntry[] }
    | { ok: false; refused: string } => {
    const read = readRecord(deps.root, deps.project.name, run.ticket);
    return read.ok
      ? { ok: true, entries: read.value }
      : { ok: false, refused: read.error.message };
  };

  /**
   * The branch a step at `stage` works on: the run's own, or — at the first
   * stage that owns one — a new one claimed in the ledger now, before the
   * step starts. Several runs of a project may own a branch at once, so the
   * claim is never refused (ADR-0063 D1): what keeps a step from starting
   * is a place, asked for before this.
   */
  const branchFor = (stage: PipelineStage, ticket: TicketThread): string | undefined => {
    const held = current().branch;
    if (held !== undefined || !ownsBranch(stage)) return held;
    const name = workBranch(ticket, run.seq);
    deps.store.claimBranch(run.id, name);
    return name;
  };

  /**
   * The refusal of a step for want of a place: who takes the place, by run
   * id, and that this ticket now waits for its turn (ADR-0063 D2). The run
   * id is there so the runner, and a person reading the record, can find
   * the other run.
   */
  const noPlace = (holder: Run): { ok: false; refused: string } => ({
    ok: false,
    refused:
      `${new NoPlaceError(deps.project.name, holder).message} This ticket now waits for its ` +
      "turn, and you are woken when a place is given to it.",
  });

  /**
   * Why no step may start now, or undefined when one may: a step of this run
   * is already running, or the ticket has spent its limit. Asked before every
   * session this run starts, the approval's own included, because each one
   * spends money and each one works on the same branch.
   */
  const stepBlocked = async (
    entries: readonly RecordEntry[],
  ): Promise<{ ok: false; refused: string } | undefined> => {
    const running = deps.running.get(run.id);
    if (running !== undefined) {
      return {
        ok: false,
        refused:
          `A step of this run is running now: ${stageLabel(running.stage)}, started at ` +
          `${running.startedAt}. Wait for it to end, or stop it.`,
      };
    }
    return limitRefusal(entries);
  };

  /**
   * The refusal when the ticket has spent its allowance, or undefined while
   * it may still spend (ADR-0060 D5).
   *
   * The ticket is told once each time the limit is reached: a notice is
   * posted only when none has been since the last time a named person
   * allowed more. The runner may try again on every wake, and a comment for
   * each try would bury the one line the person needs.
   */
  const limitRefusal = async (
    entries: readonly RecordEntry[],
  ): Promise<{ ok: false; refused: string } | undefined> => {
    const base = limitBaseOf(deps.manifest, deps.project.name);
    if (!isOverLimit(entries, base)) return undefined;
    const spentUsd = spentOn(entries);
    const allowanceUsd = allowanceOf(entries, base);
    if (!toldOfLimit(entries)) {
      const ticket = await deps.adapter.getTicket(deps.project, run.ticket);
      const order = defaultOrder(ticketKindOf(ticket.labels, deps.ticketContext));
      await deps.adapter.postComment(
        deps.project,
        run.ticket,
        limitNotice({
          spentUsd,
          allowanceUsd,
          raiseUsd: base,
          standing: standingOf(entries, run.id, order),
        }),
      );
      write({ kind: "limit-reached", at: deps.clock(), spentUsd });
      write({ kind: "notice", at: deps.clock(), about: LIMIT_NOTICE });
    }
    return {
      ok: false,
      refused:
        `This ticket has spent $${spentUsd.toFixed(2)} of the $${allowanceUsd.toFixed(2)} it may spend. ` +
        "No step can start until a named person allows more.",
    };
  };

  /**
   * The comment at `commentAt` on the run's ticket, with the ticket it is on,
   * when a named person wrote it — or why it cannot count.
   *
   * **Code checks only that the comment is there and whose it is**, never
   * what it says: the runner judges the words. A comment the machine posted
   * never counts, even under a named person's login: it is a record of what
   * the machine did. `onlyNamed` ends the refusal of a comment by someone
   * who is not named, and says what only a named person can do.
   *
   * One lookup for an approval and for a request to stop the work (40t), so
   * the two cannot come to disagree on whose comment counts.
   */
  const namedPersonsComment = async (
    commentAt: string,
    onlyNamed: string,
  ): Promise<
    { ok: true; comment: TicketComment; ticket: TicketThread } | { ok: false; refused: string }
  > => {
    const ticket = await deps.adapter.getTicket(deps.project, run.ticket);
    const comment = ticket.comments.find(
      (each) => each.createdAt === commentAt && !each.fromTimone,
    );
    if (comment === undefined) {
      return {
        ok: false,
        refused: `There is no comment by a person at ${commentAt} on ticket #${run.ticket}.`,
      };
    }
    if (!isNamedPerson(namedPeople(deps.manifest, deps.project.name), comment.author)) {
      return {
        ok: false,
        refused:
          `The comment at ${commentAt} is by ${comment.author}, who is not named for this ` +
          `project. ${onlyNamed}`,
      };
    }
    return { ok: true, comment, ticket };
  };

  /**
   * The approval of the list of pieces this run's record holds — the latest,
   * when there are several — or undefined when it holds none.
   *
   * **The record is the only source a merge takes its approval from** (R3).
   * Only `recordApproval` writes an `approval` entry, and only for a comment
   * by a named person, so an approval that is not in the record was never
   * given as far as the machine can prove — whatever else is in memory.
   */
  const recordedApprovalOfPieces = (): ChunkZeroApproval | undefined => {
    const read = readRecord(deps.root, deps.project.name, run.ticket);
    if (!read.ok) return undefined;
    const approval = read.value
      .flatMap((entry) =>
        entry.kind === "approval" && entry.runId === run.id && entry.what === "pieces"
          ? [entry]
          : [],
      )
      .at(-1);
    return approval === undefined ? undefined : { by: approval.by, at: approval.commentAt };
  };

  /**
   * Note in the record what failed after the approval of the list of pieces,
   * then tell the ticket (40x). The note comes first: it is what the runner
   * is told from, so a forge that fails on the comment still leaves the
   * runner knowing.
   */
  const piecesNotActedOn = async (failure: PiecesFailure): Promise<void> => {
    write({ kind: "notice", at: deps.clock(), about: piecesFailedAbout(run.id, failure) });
    await deps.adapter.postComment(deps.project, run.ticket, piecesFailedNotice(failure));
  };

  /**
   * Close chunk zero once the approval of the list of pieces is in its file:
   * merge the requirements and the list into the default branch, open one
   * ticket per piece, and end this run (ADR-0030 D2, ADR-0040). The same code
   * the daemon runs, from `chunk-zero.ts`, so the two cannot drift.
   *
   * **A merge that fails, or tickets that do not open, end nothing** (40x,
   * PRD-05 R16). The run stays, and the driver puts it back on the runner's
   * wait once the step's end is told, as after any step. The record notes
   * what failed and why, and the driver reads that note to tell the runner
   * on the wake that follows. The ticket is told once, in plain words. A
   * failed run would be one nothing wakes again, and the old comment pointed
   * at a standing note that a project the runner drives does not have.
   */
  const closeChunkZero = async (): Promise<void> => {
    const approval = recordedApprovalOfPieces();
    if (approval === undefined) {
      write({
        kind: "decision",
        at: deps.clock(),
        runId: run.id,
        action: "chunk-zero-not-merged",
        reason: "the run record holds no approval of the list of pieces for this run",
      });
      return;
    }
    const chunkZero: ChunkZeroDeps = { store: deps.store, adapter: deps.adapter, log: deps.log };
    const refusal = await tryMergeChunkZero(chunkZero, current(), deps.project, approval);
    if (refusal !== undefined) {
      await piecesNotActedOn({
        failed: "merge",
        conflict: refusal.conflict === true,
        said: refusal.reason,
      });
      return;
    }
    const failure = await openStepTickets(
      chunkZero,
      current(),
      deps.project,
      namedPeople(deps.manifest, deps.project.name),
    );
    if (failure !== undefined) {
      await piecesNotActedOn({ failed: "tickets", said: failure });
      return;
    }
    // Code's own decision, not the runner's: it is written down with the
    // approval that allowed it, so the record shows why the default branch
    // moved with no pull request.
    write({
      kind: "decision",
      at: deps.clock(),
      runId: run.id,
      action: "chunk-zero-merged",
      reason: `the list of pieces was approved by ${approval.by}, in the comment at ${approval.at}`,
    });
    deps.store.complete(run.id);
    await deps.adapter.postComment(deps.project, run.ticket, piecesApprovedNotice(approval.by));
  };

  /**
   * `body`, with what the runner tried written down: the action, the reason
   * it gave, and — when the action was refused or failed — why. The record
   * then shows every attempt, not only the ones that worked: a runner that
   * keeps asking for something the rules refuse is a thing a person needs to
   * be able to see.
   */
  const decided =
    <Input extends { reason: string }>(
      action: RunnerToolName,
      body: (input: Input) => Promise<ActionResult>,
    ) =>
    async (input: Input): Promise<ActionResult> => {
      const decision = (detail?: string): RecordEntry => ({
        kind: "decision",
        at: deps.clock(),
        runId: run.id,
        action,
        reason: input.reason,
        ...(detail === undefined ? {} : { detail }),
      });
      let result: ActionResult;
      try {
        result = await body(input);
      } catch (error) {
        write(decision(`Failed: ${oneLine(error)}`));
        throw error;
      }
      write(decision(result.ok ? undefined : `Refused: ${result.refused}`));
      return result;
    };

  /**
   * Write down that a step started, count it as running, and arrange for
   * its end to be written down too.
   *
   * **The end is watched here, not awaited.** A step runs for as long as it
   * takes, long after the runner's wake that started it has finished. When it
   * ends, the machine writes down how, and what it cost — the limit is counted
   * from that entry, so it cannot wait for anyone to ask — and only then tells
   * the driver, which wakes the runner.
   *
   * `records` is the approval the session writes into its file, when that is
   * what it is for. It is written on the entry, so the record does not read
   * the session as its stage's step running again (40v).
   */
  const watchStep = (
    stage: PipelineStage,
    session: StepSession,
    instructions: string,
    afterwards?: (result: StepResult) => Promise<void>,
    records?: Approval,
  ): void => {
    write({
      kind: "step-started",
      at: deps.clock(),
      runId: run.id,
      stage,
      sessionId: session.sessionId,
      instructions,
      ...(records === undefined ? {} : { records }),
    });
    deps.running.set(run.id, { stage, session, startedAt: deps.clock() });

    const ended = async (result: StepResult): Promise<void> => {
      const { outcome, summary } = result;
      const stopped = deps.running.get(run.id)?.stopRequested !== undefined;
      write({
        kind: "step-ended",
        at: deps.clock(),
        runId: run.id,
        stage,
        sessionId: session.sessionId,
        ok: outcome.ok,
        costUsd: summary?.costUsd ?? 0,
        ...(outcome.error === undefined ? {} : { error: outcome.error }),
        ...(stopped ? { stoppedBy: STOPPED_BY_RUNNER } : {}),
      });
      deps.running.delete(run.id);
      if (afterwards !== undefined) {
        // Whatever happens here, the driver is still told the step ended: a
        // run whose driver is never told waits for ever, with nothing running.
        try {
          await afterwards(result);
        } catch (error) {
          deps.log(`runner ${run.id} — after ${stage} ended: ${oneLine(error)}`);
        }
      }
      await deps.stepEnded(run.id, stage, result);
    };

    // Nothing awaits this promise, so nothing may escape it: a failure here
    // is logged rather than left as a rejection nobody would see.
    void session.completed
      .then(ended, (error: unknown) =>
        ended({ outcome: { sessionId: session.sessionId, ok: false, error: oneLine(error) } }),
      )
      .catch((error: unknown) => {
        deps.log(`runner ${run.id} — the end of a step was not handled: ${oneLine(error)}`);
      });
  };

  return {
    startStep: decided("start_step", async ({ stage, instructions, skipReason }) => {
      const model = modelFor(stage);
      if (!isPrompted(stage) || model === undefined) {
        return {
          ok: false,
          refused: `No session can be started for ${stageLabel(stage)}: it has no instructions of its own.`,
        };
      }
      const record = readTicketRecord();
      if (!record.ok) return record;
      const blocked = await stepBlocked(record.entries);
      if (blocked !== undefined) return blocked;
      const ticket = await deps.adapter.getTicket(deps.project, run.ticket);
      const order = defaultOrder(ticketKindOf(ticket.labels, deps.ticketContext));
      const { steps: skipped, recheck } = skippedBy(stage, order, record.entries, run.id);
      const why = (skipReason ?? "").trim();
      if (skipped.length > 0 && why === "") {
        return {
          ok: false,
          refused:
            `Starting ${stageLabel(stage)} now leaves out ${joined(skipped.map((step) => step.label))}. ` +
            (recheck === undefined
              ? ""
              : `${capitalised(recheck.label)} has not run since the work was last built. `) +
            "Give the reason in skipReason, or start the step that comes first.",
        };
      }

      // A step needs a place on the project (ADR-0063 D2). Asked after every
      // other rule, so a try refused for another reason does not wait, and
      // before the branch is claimed, so a refused try writes nothing else.
      const turn = {
        priority: ticket.labels.includes(PRIORITY_LABEL),
        openedAt: ticket.createdAt,
      };
      const place = deps.store.askPlace(run.id, turn);
      if (!place.ok) return noPlace(place.holder);

      const branch = branchFor(stage, ticket);

      const departure: RecordEntry | undefined =
        skipped.length === 0
          ? undefined
          : {
              kind: "departure",
              at: deps.clock(),
              runId: run.id,
              skipped: skipped.map((step) => step.id),
              reason: why,
            };
      if (departure !== undefined) {
        await deps.adapter.postComment(
          deps.project,
          run.ticket,
          departureNotice({
            skippedLabels: skipped.map((step) => step.label),
            reason: why,
            nextLabel: stageLabel(stage),
          }),
        );
        write(departure);
      }

      const request = sessionRequest({
        cwd: deps.root,
        prompt: [
          stagePrompt(stage, {
            project: deps.project,
            ticket,
            classification: classificationFromLabels(ticket.labels),
            branch,
          }),
          "",
          runnerInstructionsBlock(
            instructions,
            skippedApprovals(
              order,
              departure === undefined ? record.entries : [...record.entries, departure],
              run.id,
            ),
          ),
        ].join("\n"),
        model,
        effort: effortFor(stage),
        ...workspaceFor(await deps.timonePin(), deps.project, branch),
        interactive: true,
        // The one branch this step's pushes may reach (#85). Given whether or
        // not Timone's version is known, because the guard does not depend
        // on the workspace.
        workBranch: branch,
      });

      // **The ledger learns the step before the step starts** (40r), as the
      // daemon's own runs do, so `timone status` says what is running: on
      // scratch-app#60 the ledger read "stage: null" for the whole build.
      // Written after every rule above, so a refused step changes nothing.
      // A session that does not start puts the stage back as it was. A run
      // with no stage yet keeps the new one: the ledger has no way to clear
      // it, and it names the step the runner is trying to start.
      //
      // `setStage` changes nothing but the stage. ✏ 2026-09-30: it once also
      // cleared `consumedAnswerAt` and `reAsksAfterAnswer`, which belonged to
      // the old code's conversation waits; both were removed from the ledger.
      const stageBefore = current().stage;
      deps.store.setStage(run.id, stage);
      let session: StepSession;
      try {
        session = await deps.startStep({
          runId: run.id,
          request,
          label: `${run.id} (${stage})`,
          announce: (sessionId) =>
            `session ${sessionId} started for ${run.id} (${stage}, ${model}) — by the runner`,
        });
      } catch (error) {
        if (stageBefore !== undefined) deps.store.setStage(run.id, stageBefore);
        // Another run took the place between the ask and the start. The
        // ledger refused before it wrote anything, so the run asks for a
        // place once more, and that writes that it waits.
        if (error instanceof NoPlaceError) {
          const again = deps.store.askPlace(run.id, turn);
          if (!again.ok) return noPlace(again.holder);
        }
        return { ok: false, refused: `The step did not start: ${oneLine(error)}` };
      }
      watchStep(stage, session, instructions);
      return {
        ok: true,
        said: `Started ${stageLabel(stage)}, in session ${session.sessionId}. You are woken when it ends.`,
      };
    }),
    messageStep: decided("message_step", async ({ text }) => {
      const step = deps.running.get(run.id);
      if (step === undefined) return { ok: false, refused: NO_STEP_RUNNING };
      if (step.session.send === undefined) {
        return {
          ok: false,
          refused:
            `${capitalised(stageLabel(step.stage))} runs where no message can reach it. ` +
            "Stop it and start it again with new instructions, or let it end.",
        };
      }
      step.session.send(text);
      return { ok: true, said: `Sent the message to ${stageLabel(step.stage)}.` };
    }),
    stopStep: decided("stop_step", async () => {
      const step = deps.running.get(run.id);
      if (step === undefined) return { ok: false, refused: NO_STEP_RUNNING };
      deps.running.set(run.id, { ...step, stopRequested: deps.clock() });
      step.session.stop();
      return {
        ok: true,
        said: `Asked ${stageLabel(step.stage)} to stop. You are woken when it has stopped.`,
      };
    }),
    post: decided("post", async ({ where, body }) => {
      if (!asksSomething(body)) {
        return {
          ok: false,
          refused:
            `The comment has no line that starts with ${NEEDED_FROM_YOU} and says ` +
            'what you need from the reader, or "nothing". Add it, and post again.',
        };
      }
      if (where === "ticket") {
        await deps.adapter.postComment(deps.project, run.ticket, body);
        return { ok: true, said: `Posted on ticket #${run.ticket}.` };
      }
      const pr = await openPullRequest();
      if (pr === undefined) {
        return { ok: false, refused: "This run has no open pull request to post on." };
      }
      await deps.adapter.postPullRequestComment(deps.project, pr, body);
      return { ok: true, said: `Posted on pull request #${pr}.` };
    }),
    setHold: decided("set_hold", async ({ on }) => {
      if (on) {
        // The label may not exist yet on a project that never held a ticket,
        // and applying a label nobody created fails.
        await deps.adapter.ensureLabel(deps.project, HELD_LABEL, HELD_LABEL_DESCRIPTION);
        await deps.adapter.applyLabel(deps.project, run.ticket, HELD_LABEL);
        return { ok: true, said: `Ticket #${run.ticket} is on hold.` };
      }
      await deps.adapter.removeLabel(deps.project, run.ticket, HELD_LABEL);
      return { ok: true, said: `Ticket #${run.ticket} is no longer on hold.` };
    }),
    recordApproval: decided("record_approval", async ({ what, commentAt }) => {
      const found = await namedPersonsComment(commentAt, "Only a named person can approve.");
      if (!found.ok) return found;
      const { comment, ticket } = found;
      const { branch } = current();
      if (branch === undefined) {
        return {
          ok: false,
          refused: "This run has no branch yet, so there is no file to write the approval into.",
        };
      }
      const record = readTicketRecord();
      if (!record.ok) return record;
      // An approval is a comment written after the thing it approves was
      // finished (PRD-05.R7). A named person's comment from before — "approve
      // them yourself in my name", written while the requirements did not
      // exist yet (scratch-app#37) — would otherwise count as their approval,
      // and R7 would rest only on the runner choosing not to ask for it. The
      // end of the last step that wrote the thing, in this run, is when it
      // was finished; with no such step there is nothing to approve yet.
      // Compared as instants, not as text.
      const finished = record.entries
        .filter(
          (entry) =>
            entry.kind === "step-ended" &&
            entry.runId === run.id &&
            entry.stage === APPROVED_STAGE[what] &&
            entry.ok,
        )
        .at(-1);
      if (finished === undefined) return { ok: false, refused: NOT_WRITTEN[what] };
      if (Date.parse(commentAt) <= Date.parse(finished.at)) {
        return {
          ok: false,
          refused:
            `${WRITTEN_BEFORE[what]} The comment is from ${commentAt}, and the step that wrote ` +
            `${APPROVAL_WORDS[what]} ended at ${finished.at}.`,
        };
      }
      const blocked = await stepBlocked(record.entries);
      if (blocked !== undefined) return blocked;

      write({
        kind: "approval",
        at: deps.clock(),
        runId: run.id,
        what,
        by: comment.author,
        commentAt,
      });

      // The approval goes into the file it approves, by a short session of
      // its own on the run's branch: the file is the record the next steps
      // read (ADR-0006), and the ticket is not. It is counted as running, and
      // its cost counts toward the limit, as a step's does. But it is written
      // down as recording the approval, not as a step of the order (40v).
      const stage = APPROVED_STAGE[what];
      const request = sessionRequest({
        cwd: deps.root,
        prompt: approvalRecordPrompt(
          { stage, by: comment.author, at: commentAt },
          { project: deps.project, ticket, branch },
        ),
        model: APPROVAL_RECORD_MODEL,
        ...workspaceFor(await deps.timonePin(), deps.project, branch),
        workBranch: branch,
      });
      let session: StepSession;
      try {
        session = await deps.startStep({
          runId: run.id,
          request,
          label: `${run.id} (recording the approval)`,
          announce: () => `record ${run.id} — ${comment.author} approved ${stage}`,
        });
      } catch (error) {
        return {
          ok: false,
          refused:
            "The approval is written down, but the step that writes it into the file " +
            `did not start: ${oneLine(error)}`,
        };
      }
      watchStep(
        stage,
        session,
        `Record the approval ${comment.author} gave at ${commentAt}.`,
        what === "pieces"
          ? async (result) => {
              if (result.outcome.ok) await closeChunkZero();
            }
          : undefined,
        what,
      );
      return {
        ok: true,
        said:
          `Recorded ${comment.author}'s approval of ${APPROVAL_WORDS[what]}, and started the ` +
          "step that writes it into the file. You are woken when it ends.",
      };
    }),
    fileTimoneIssue: decided("file_timone_issue", async ({ title, body }) => {
      const timone = timoneProject(deps.manifest);
      if (timone === undefined) return { ok: false, refused: NO_TIMONE_PROJECT };
      const number = await deps.adapter.createIssue(timone, {
        title,
        body: withPeopleNamed(body, namedPeople(deps.manifest, "timone")),
        labels: [TIMONE_BUG_LABEL],
      });
      return { ok: true, said: `Filed Timone issue #${number}.` };
    }),
    commentTimoneIssue: decided("comment_timone_issue", async ({ number, body }) => {
      const timone = timoneProject(deps.manifest);
      if (timone === undefined) return { ok: false, refused: NO_TIMONE_PROJECT };
      await deps.adapter.postComment(timone, number, body);
      return { ok: true, said: `Added a comment to Timone issue #${number}.` };
    }),
    endRun: decided("end_run", async ({ closeTicket, stopCommentAt }) => {
      if (deps.running.has(run.id)) {
        return {
          ok: false,
          refused: "A step of this run is still running. Stop it, or wait for it to end.",
        };
      }
      // **A run waits on its open pull request** (40r). A person may still
      // ask for a change there, and only a live run answers it. A run ended
      // with its ticket still open and marked is picked up again as new
      // work, which is what scratch-app#60 did at 09:30:59. The forge's
      // answer for the branch is read, not the ledger's number: it holds the
      // state, and it names the open one when an older one was closed.
      //
      // A merged pull request ends the run: a person took the work, and a
      // squash merge leaves the branch ahead, so the count alone would keep
      // it from ever ending.
      //
      // **A closed one does not, while the branch is ahead** (40w,
      // PRD-05.R4). The branch still holds commits that no open pull
      // request carries, as when there is none, and the close alone does
      // not say whether to do the work again or to drop it. So the run ends
      // as it would with no pull request: when a new one for the work is
      // merged, or on a named person's stop, below. A closed one on a
      // branch with nothing ahead ends the run: no work is left on it.
      //
      // **A named person's plain "stop" ends a run with no pull request**
      // (40t, PRD-05.R4), or with one closed without merging (40w). On #115
      // the operator finished the work by hand and said so, and the run
      // could not end: only `timone cancel`, a terminal command, ended a run
      // whose branch held commits and no pull request. The runner judges
      // whether the words ask to stop for good, and names the comment; code
      // checks only that the comment is there and is a named person's, as it
      // does for an approval. The run is then cancelled, not done: nothing it
      // made was taken. An open pull request still refuses, above: the run
      // waits on it, whatever was said.
      const { branch } = current();
      let found: PullRequest | undefined;
      let stoppedBy: TicketComment | undefined;
      if (branch !== undefined) {
        found = await deps.adapter.findPullRequest(deps.project, branch);
        if (found?.state === "open") {
          return {
            ok: false,
            refused:
              `Pull request #${found.number} is open. The run waits on it: answer its review, ` +
              "and end the run when it is merged.",
          };
        }
        const ahead = await deps.adapter.aheadOfDefault(deps.project, branch);
        if (ahead !== undefined && ahead > 0 && found?.state !== "merged") {
          if (stopCommentAt === undefined) {
            return {
              ok: false,
              refused:
                found === undefined
                  ? `This run changed files on ${branch}, and they have no pull request yet. ` +
                    "The run waits on one, and ends when it is merged."
                  : `Pull request #${found.number} was closed without merging, and the changes this run made ` +
                    `on ${branch} are not on the default branch. The run can end in two ways: a new pull ` +
                    "request for this work is merged, or a named person asks on the ticket to stop the work.",
            };
          }
          const stop = await namedPersonsComment(
            stopCommentAt,
            "Only a named person can stop the work.",
          );
          if (!stop.ok) return stop;
          stoppedBy = stop.comment;
        }
      }
      const merged = found?.state === "merged";
      if (stoppedBy === undefined) {
        deps.store.complete(run.id);
      } else {
        // The reason is what `timone status` shows after "was cancelled:".
        deps.store.cancel(
          run.id,
          `${stoppedBy.author} asked to stop the work, in the comment at ${stoppedBy.createdAt}`,
        );
      }
      // The ticket is closed only when the runner asks, on a stop too: a
      // person who stopped the work may want the ticket kept, as on #115
      // ("Leave this one on hold").
      if (closeTicket) {
        await deps.adapter.closeTicket(deps.project, run.ticket, "completed");
      }
      // **A map closes with its last piece** (40s), as the daemon closes one
      // in `concludeStep`, and with the same code. On scratch-app#62 the map
      // stayed open after its one piece, #63, merged and closed. Facts
      // decide it, never the runner's words: the forge says the pull
      // request merged, the ledger's picture says the ticket is a piece of
      // a map, and the forge says whether any piece is still open. A piece
      // the runner leaves open keeps the map open.
      const map = deps.store.initiativeFor(deps.project.name, run.ticket);
      if (merged && map !== undefined && map.steps.includes(run.ticket)) {
        await closeInitiativeIfDone(deps, deps.project, map.initiative, deps.log);
      }
      // A stop comes only where no pull request is open or merged, so a pull
      // request found here was closed without merging.
      const ended =
        stoppedBy === undefined
          ? "The run is ended"
          : `The run is ended without ${found === undefined ? "a" : "a merged"} pull request, ` +
            `as ${stoppedBy.author} asked in the comment at ${stoppedBy.createdAt}`;
      return closeTicket
        ? { ok: true, said: `${ended}, and ticket #${run.ticket} is closed.` }
        : { ok: true, said: `${ended}.` };
    }),
  };
}
