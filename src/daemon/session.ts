import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { query, type EffortLevel } from "@anthropic-ai/claude-agent-sdk";

const execFileAsync = promisify(execFile);

import {
  checkoutVersion,
  mergeIntoDefault,
  uncommittedFiles,
  type MergeOutcome,
} from "../git.js";
import type { Manifest } from "../manifest.js";
import type {
  TicketComment,
  TicketingAdapter,
  TicketingProject,
  TicketThread,
} from "../adapters/ticketing.js";
import {
  inviteToConversation,
  type ConversationChannel,
} from "../channels/conversation.js";
import { TerminalChannel } from "../channels/terminal.js";
import { technicalFault, type TechnicalFault } from "./faults.js";
import { gateCommentFor } from "./gate-comment.js";
import {
  fromDefaultBranch,
  readBreakdown,
  type BreakdownSource,
  type Chunk,
} from "./breakdown.js";
import {
  HELD_LABEL,
  HELD_LABEL_DESCRIPTION,
  MAP_LABEL,
  MAP_LABEL_DESCRIPTION,
} from "./steps.js";
import { STAGE_TRAILER } from "./hooks.js";
import { instant, readConversationRecord, waitCursorFrom } from "./gates.js";
import { outcomeCursorFrom, readStageOutcome, type StageOutcome } from "./outcomes.js";
import {
  APPROVAL_RECORD_MODEL,
  classificationFromLabels,
  concludeConversation,
  effortFor,
  isBuilt,
  modelFor,
  ownsBranch,
  processStage,
  routeAfterTriage,
  runsUnattended,
  stageAfter,
  waitFor,
  type PipelineStage,
} from "./pipeline.js";
import type { SessionSpawner, SpawnContext } from "./poll.js";
import {
  PROMPTED_STAGES,
  approvalRecordPrompt,
  conversationSubject,
  stagePrompt,
  workBranch,
} from "./prompts.js";
import {
  DEFAULT_PROGRESS_INTERVAL_SECONDS,
  SessionProgress,
  closingLine,
  tickLine,
  type ProgressSnapshot,
  type SessionSummary,
} from "./progress.js";
import {
  ESCALATION_WAIT,
  type ParkOptions,
  type Run,
  type RunStore,
} from "./runs.js";

/**
 * Timone itself, at one exact commit — never a branch name (ADR-0041 D2).
 * Two runs started an hour apart follow identical rules only if the version
 * is fixed when the run starts, and a branch moves.
 */
export interface TimonePin {
  remote: string;
  commit: string;
}

/**
 * What a run's copy of the world is made of: the remotes it is cloned from
 * and the versions it is held at (ADR-0041 D1).
 *
 * A runtime that runs the session in this process has no use for it — it is
 * already standing in a checkout. A runtime that builds a container has
 * nothing else: the remotes are the only source of truth, and that is what
 * makes the container disposable.
 */
export interface SessionWorkspace {
  timone: TimonePin;
  /**
   * The target project, at the branch this chunk's run works on — the layout
   * ADR-0007 already fixed, `projects/<name>/`, said in the terms a clone
   * needs.
   */
  project: { name: string; remote: string; branch: string };
}

/**
 * The daemon's own checkout, as the spawn path has to see it: which version
 * of Timone this is, and what in it has not been committed (ADR-0041 D2).
 */
export interface TimoneCheckout {
  /**
   * The version a run started now would follow. Absent when `dir` is not a
   * git checkout at all — which a running daemon never reaches, since its
   * root *is* its own repository, and which is therefore a wiring mistake
   * rather than a state to report to anybody.
   */
  pin?: TimonePin;
  /**
   * Repo-relative paths carrying changes nobody has committed — staged,
   * unstaged and untracked alike.
   *
   * Files git was told to ignore are never among them. That is not a filter
   * applied here: `git status --porcelain` leaves them out, which is why
   * `node_modules/` and `dist/` are not work anybody has to commit.
   */
  uncommitted: string[];
}

/**
 * Read the daemon's own checkout. Behind a seam on the spawner for the same
 * reason as {@link AgentSessionSpawnerOptions.repoProbe}.
 *
 * **What is outstanding is read first, and separately from the version.** A
 * checkout with no `origin` has no version to pin and still has work in it
 * nobody has committed, and it is the second of those that stops a run.
 */
export async function readTimoneCheckout(dir: string): Promise<TimoneCheckout> {
  const uncommitted = await uncommittedFiles(dir);
  const pin = await checkoutVersion(dir);
  return { ...(pin === undefined ? {} : { pin }), uncommitted };
}

/**
 * How many files the refusal names before it starts counting.
 *
 * A tree with two hundred changes in it produces a line nobody reads, and the
 * first ten are enough to recognise what is going on.
 */
const NAMED_IN_REFUSAL = 10;

/**
 * What the daemon says when it will not start a run because its own folder
 * has changes in it that nobody has committed (ADR-0041 D2).
 *
 * **Read by a person, not by a stage**, and by one who has never heard the
 * word "pin": it goes to the terminal the daemon runs in, not onto a client's
 * ticket. Nothing here is about the ticket, and saying it there would be the
 * machine airing its own housekeeping in front of somebody's work.
 *
 * **One line.** The poll loop reports a refused spawn through `oneLine`,
 * which keeps the first line and drops the rest — so a message that put the
 * file names on line two would name nothing at all where it is read.
 */
export function uncommittedRefusal(files: readonly string[]): string {
  const named = files.slice(0, NAMED_IN_REFUSAL);
  const rest = files.length - named.length;
  const list = [...named, ...(rest > 0 ? [`and ${rest} more`] : [])].join(", ");
  return (
    `I did not start this session. There are changes in Timone's own folder ` +
    `that are not committed: ${list}. Every run has to use the same saved ` +
    `copy of my rules, so I stop rather than guess. Commit these files, or ` +
    `undo them, and I will start on my next check.`
  );
}

/** What a workspace is assembled from: the pin, the project, its branch. */
export interface WorkspaceInput {
  timone: TimonePin;
  project: TicketingProject;
  branch: string;
}

/** What the spawner asks a runtime to run. */
export interface SessionRequest {
  /** Always the timone root — sessions never run inside a managed project. */
  cwd: string;
  prompt: string;
  /**
   * The model this session runs on, declared per stage in the graph. Required
   * rather than optional: a request that could omit it is a request that can
   * silently take whatever the runtime defaults to, which is the failure this
   * field exists to make impossible.
   */
  model: string;
  /**
   * The reasoning effort, when the stage declares one. Absent — not
   * undefined — for models that reject the parameter, so the runtime has
   * something unambiguous to omit.
   */
  effort?: EffortLevel;
  /**
   * What to clone, and at which versions. Absent when the caller cannot name
   * a version — the in-process runtime ignores the field entirely, so a
   * request without one runs exactly as it always did.
   */
  workspace?: SessionWorkspace;
}

/** What {@link sessionRequest} is given to assemble a request from. */
export interface SessionRequestInput {
  cwd: string;
  prompt: string;
  model: string;
  /** Absent, or undefined, for a stage that declares no effort. */
  effort?: EffortLevel;
  /** Absent until the caller can name the versions to clone at. */
  workspace?: WorkspaceInput;
}

/** A git object name as `git rev-parse` reports one: 40 hexadecimal digits. */
const COMMIT = /^[0-9a-f]{40}$/;

/**
 * The one place a {@link SessionRequest} is assembled. Both spawn paths go
 * through it so that the rules a request has to obey — the effort key is
 * absent rather than undefined, the timone version is a commit and not a
 * branch — are stated once instead of at every build site.
 *
 * Throws when the timone version is not a commit. That is a wiring mistake,
 * not a domain failure: a request built from a branch name would start a run
 * whose rules can move under it, which is the whole thing ADR-0041 D2 exists
 * to prevent, and it must stop at the build rather than surface as two runs
 * that behaved differently for no visible reason.
 */
export function sessionRequest(input: SessionRequestInput): SessionRequest {
  const commit = input.workspace?.timone.commit;
  if (commit !== undefined && !COMMIT.test(commit)) {
    throw new Error(
      `timone must be pinned to a commit, not "${commit}" (ADR-0041 D2)`,
    );
  }
  return {
    cwd: input.cwd,
    prompt: input.prompt,
    model: input.model,
    // Spread rather than assigned, so a stage with no effort produces a
    // request with no `effort` key — not one set to undefined, which the
    // runtime would have to tell apart from an intended value. The same
    // holds for a request nobody gave a workspace.
    ...(input.effort === undefined ? {} : { effort: input.effort }),
    ...(input.workspace === undefined
      ? {}
      : { workspace: workspaceOf(input.workspace) }),
  };
}

/** The pin, the project and the branch, said the way a clone needs them. */
function workspaceOf(input: WorkspaceInput): SessionWorkspace {
  return {
    timone: input.timone,
    project: {
      name: input.project.name,
      remote: input.project.repoUrl,
      branch: input.branch,
    },
  };
}

/** How a session ended. */
export interface SessionOutcome {
  sessionId: string;
  ok: boolean;
  error?: string;
}

/** What the spawner needs to say how a running session is doing. */
export interface ProgressReader {
  snapshot(): ProgressSnapshot;
  summary(): SessionSummary | undefined;
}

/** A session that has started and will finish. */
export interface StartedSession {
  sessionId: string;
  completed: Promise<SessionOutcome>;
  /**
   * How the session is doing, for the spawner's ticker. Optional because a
   * runtime that cannot see inside a session — a test fake, mostly — should
   * not have to invent numbers to satisfy the interface.
   */
  progress?: ProgressReader;
}

/** A running ticker, stoppable. */
export interface Ticker {
  stop(): void;
}

/**
 * How a session really ended, given the result the SDK reported and the last
 * thing the model was seen to say.
 *
 * A `success` subtype is not on its own proof that the work happened. On
 * 2026-08-07 a planning session died on `API Error: Connection closed
 * mid-response` — the transcript ends on a synthetic message carrying
 * `error: "server_error"` — and the SDK still reported success. The daemon
 * believed it, opened a gate over a branch with nothing on it, and asked a
 * human to approve a document that was never written.
 *
 * So three things are read, not one: the subtype, the result's own
 * `is_error`, and whether the model's *last* word was an API error. The last
 * of those is deliberately last-wins — an error the CLI retried and recovered
 * from is followed by a real message, which clears it, and only an error
 * nothing came back from survives to be reported.
 */
export function sessionOutcomeFrom(
  sessionId: string,
  result: { subtype: string; is_error?: boolean },
  lastApiError: string | undefined,
): SessionOutcome {
  if (lastApiError !== undefined) {
    return {
      sessionId,
      ok: false,
      error: `the session stopped on an API error (${lastApiError})`,
    };
  }
  if (result.subtype !== "success") {
    return { sessionId, ok: false, error: result.subtype };
  }
  if (result.is_error === true) {
    return {
      sessionId,
      ok: false,
      error: "the session reported success but flagged itself as an error",
    };
  }
  return { sessionId, ok: true };
}

/**
 * How long the daemon waits before trying a stage again after the link broke,
 * in order — so two waits are three attempts in all.
 *
 * A minute clears a hiccup, five clear a short outage, and the shortness of
 * the list is the point: the ceiling is what stops a stage that breaks every
 * time from looping, which is the risk ADR-0017 named when it declined to
 * retry anything at all.
 */
export const DEFAULT_LINK_RETRY_WAITS_MS: readonly number[] = [60_000, 300_000];

/** `30s`, `5m` — a wait in the shortest words that stay exact. */
function waitWords(ms: number): string {
  const total = Math.round(ms / 1000);
  return total >= 60 && total % 60 === 0 ? `${total / 60}m` : `${total}s`;
}

/** The real ticker. Behind a seam so tests need no clock. */
function intervalTicker(onTick: () => void, intervalMs: number): Ticker {
  const handle = setInterval(onTick, intervalMs);
  return { stop: () => clearInterval(handle) };
}

/**
 * The agent runtime, behind an interface so the spawner's configuration —
 * the part that carries the process rules — is testable without the SDK.
 */
export interface SessionRuntime {
  start(request: SessionRequest): Promise<StartedSession>;
}

/** How a step ticket is titled: the chunk's number, then its name. */
function stepTitle(index: number, title: string): string {
  return `${index + 1}. ${title}`;
}

/**
 * What a step ticket says. Short, and every technical word is a link: a
 * ticket carries what is being done and what is needed, and the detail lives
 * in the committed artifact it points at (`process.md`, *Writing to the
 * human*).
 */
function stepBody(
  chunk: Chunk,
  initiative: number,
  breakdownPath: string,
): string {
  return [
    chunk.delivers,
    "",
    `Part of #${initiative}. The full list is in \`${breakdownPath}\`.`,
  ].join("\n");
}

/**
 * The initiative's ticket, rewritten as the map of its children.
 *
 * Each line is the step's **number**, which GitHub renders as a live link
 * carrying its title and whether it is closed — so the map shows how far the
 * work has got without anything having to keep a tally up to date.
 */
function initiativeMap(
  steps: { number: number; chunk: Chunk }[],
  breakdownPath: string,
): string {
  return [
    "This is built in pieces. Each one is its own ticket below.",
    "",
    ...steps.map(
      (step, index) => `${index + 1}. #${step.number} — ${step.chunk.delivers}`,
    ),
    "",
    `The list was approved in \`${breakdownPath}\`.`,
  ].join("\n");
}

export interface AgentSessionSpawnerOptions {
  manifest: Manifest;
  store: RunStore;
  adapter: TicketingAdapter;
  runtime: SessionRuntime;
  /** The timone root; every session runs here (ADR-0007). */
  root: string;
  /** Where multi-turn conversations happen. Defaults to the terminal. */
  channel?: ConversationChannel;
  /**
   * Reads a branch's tip in a project checkout. Behind a seam so the
   * did-this-stage-produce-anything check is testable without a real repo.
   */
  repoProbe?: (repoDir: string, branch: string) => Promise<string | undefined>;
  /**
   * Reads the checkout's current `HEAD`. It is the baseline for a stage that
   * has no work branch yet: the commit a new branch would be cut from, and
   * therefore the thing a branch must have moved *past* to have produced
   * anything.
   */
  headProbe?: (repoDir: string) => Promise<string | undefined>;
  /**
   * Reads the `Status:` line of the newest phase file on a branch. The
   * artifact half of execution's outcome check — the stage's own closing act
   * is flipping this line to `Complete` — behind a seam for the same reason
   * as {@link repoProbe}.
   */
  planStatusProbe?: (
    repoDir: string,
    branch: string,
  ) => Promise<string | undefined>;
  /**
   * Finds the newest phase's verification report on a branch, returning its
   * path or undefined. The artifact half of verification's outcome check.
   */
  verificationReportProbe?: (
    repoDir: string,
    branch: string,
  ) => Promise<string | undefined>;
  /**
   * Merges chunk zero's branch into the project's default branch and pushes
   * it — the daemon's one write to a branch it is not standing on, reached
   * only from the breakdown gate's approval (ADR-0030 D2). Behind a seam for
   * the same reason as {@link repoProbe}, and defaulting to `git.ts`'s
   * implementation.
   */
  mergeProbe?: (
    repoDir: string,
    branch: string,
    message: string,
  ) => Promise<MergeOutcome>;
  /**
   * Reads a ticket's approved breakdown off the project's default branch —
   * the list of steps this spawner then opens one ticket for. Behind a seam
   * for the same reason as {@link repoProbe}, and defaulting to
   * `breakdown.ts`'s `fromDefaultBranch`.
   */
  breakdownSource?: BreakdownSource;
  /**
   * Reads the daemon's own checkout: which version of Timone it is running,
   * and what in it has not been committed (ADR-0041 D2). Behind a seam for
   * the same reason as {@link repoProbe}, and defaulting to
   * {@link readTimoneCheckout} against {@link root}.
   */
  timoneProbe?: (dir: string) => Promise<TimoneCheckout>;
  /**
   * Milliseconds between progress lines while a session works. Defaults to
   * {@link DEFAULT_PROGRESS_INTERVAL_SECONDS}.
   */
  progressIntervalMs?: number;
  /**
   * How long to wait before each further attempt at a stage whose session
   * died on the link, in order. Defaults to
   * {@link DEFAULT_LINK_RETRY_WAITS_MS}; an empty list turns retrying off,
   * which is the behaviour every caller had before ADR-0034.
   */
  linkRetryWaitsMs?: readonly number[];
  /** Waiting. Behind a seam so a test needs no real clock. */
  sleep?: (ms: number) => Promise<void>;
  /** Starts a ticker. Behind a seam so tests need no real timer. */
  ticker?: (onTick: () => void, intervalMs: number) => Ticker;
  log?: (message: string) => void;
}

/** The comment posted when a run reaches a stage this phase has not built. */
export function parkedComment(stage: PipelineStage): string {
  return [
    "**That's as far as I can take this one for now.**",
    "",
    `Everything up to this point is done and written on this ticket. What comes`,
    `next — process stage ${processStage(stage)} — is machinery that isn't built yet.`,
    "",
    "**What I need from you:** nothing right now — this ticket keeps its place and picks up from here once that machinery lands.",
  ].join("\n");
}

/** The comment posted when a question has been answered and nothing follows. */
export function answeredComment(): string {
  return [
    "**Answered above — and that's the whole of it.**",
    "",
    "This one was a question rather than something to build, so there's nothing",
    "to plan and nothing to make. I'm closing my side of it.",
    "",
    "**What I need from you:** nothing — reopen or file a new ticket if you want something built.",
  ].join("\n");
}

/** The comment posted when a session ends badly. */
export function failedComment(reason: string): string {
  return [
    "**Something went wrong while I was working on this.**",
    "",
    `The session stopped early: ${reason}`,
    "",
    "Nothing was decided about this ticket, so nothing here is final.",
    "",
    "**What I need from you:** re-mark this ticket when you want me to try again," +
      " or leave it and tell me what looks wrong.",
  ].join("\n");
}

/**
 * The comment posted when the machine could not reach the service it runs on,
 * or was refused by it ([ADR-0034](../../doc/adr/0034-a-technical-stop-is-retried-not-reported.md)).
 *
 * A different comment from {@link failedComment} because it carries a
 * different message. Nothing here is about the ticket, so it says whose fault
 * it is, what was tried, and asks the reader for nothing — where the old one
 * said "something went wrong" over a request to re-mark a ticket, which is
 * both the wrong subject and, on a broken run, an act with no effect.
 */
export function unreachableComment(
  fault: TechnicalFault,
  reason: string,
  attempts: number,
): string {
  const headline =
    fault === "credentials"
      ? "**My login to the service I run on was refused, so I stopped here.**"
      : "**I could not reach the service I run on, so I stopped here.**";
  const what =
    fault === "credentials"
      ? `Trying again would be refused the same way: ${reason}.`
      : attempts > 1
        ? `I tried ${attempts} times over a few minutes, and it ended the same way each time: ${reason}.`
        : `It ended this way: ${reason}.`;
  return [
    headline,
    "",
    "This is a fault on my side. It is not about this ticket, and it is not",
    "something you did.",
    "",
    what,
    "",
    "Nothing was decided here, so nothing on this ticket has changed.",
    "",
    "**What I need from you:** nothing on this ticket — this one is mine to fix." +
      " The standing note on this ticket has the way to start me again once it is fixed.",
  ].join("\n");
}

/** The comment posted when triage finished without recording a classification. */
export function producedNothingComment(stage: PipelineStage): string {
  return [
    "**I stopped without writing anything down, and that's mine to fix.**",
    "",
    `The step I just ran (${stage}) was supposed to leave a document on this`,
    "ticket's branch for you to read and approve. It didn't.",
    "",
    "So there is **nothing for you to approve**, and I would rather say that than",
    "ask you to sign off on a blank.",
    "",
    "Nothing has moved on, and every answer you have already given on this ticket",
    "still stands.",
    "",
    "**What I need from you:** nothing right now — this needs fixing at my end, and I'll come back here when it is.",
  ].join("\n");
}

/** The comment posted when triage finished without recording a classification. */
export function unclassifiedComment(): string {
  return [
    "**I couldn't work out what kind of request this is.**",
    "",
    "I read it and finished without reaching a conclusion I could act on, which",
    "is my failure and not yours.",
    "",
    "**What I need from you:** re-mark this ticket to make me try again, or add a line saying what you're after.",
  ].join("\n");
}

/**
 * The `Status:` line of the newest phase file on `branch`, or undefined when
 * the branch carries none. Newest by number, because that is the file the
 * planning stage just committed and the one execution was told to build.
 */
async function gitPlanStatus(
  repoDir: string,
  branch: string,
): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["ls-tree", "-r", "--name-only", branch, "--", "doc/plans/phases"],
      { cwd: repoDir },
    );
    const newest = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^doc\/plans\/phases\/phase-\d+\.md$/.test(line))
      .sort()
      .at(-1);
    if (newest === undefined) return undefined;

    const { stdout: content } = await execFileAsync(
      "git",
      ["show", `${branch}:${newest}`],
      { cwd: repoDir },
    );
    const line = content
      .split("\n")
      .find((candidate) => candidate.includes("Status:"));
    return line?.replace(/^.*Status:\*{0,2}\s*/, "").trim();
  } catch {
    return undefined;
  }
}

/**
 * The newest phase's verification report on `branch` — its path when the
 * file exists there, undefined otherwise. "Newest phase" is resolved the
 * same way {@link gitPlanStatus} resolves it, so the two witnesses of the
 * back half always talk about the same phase.
 */
async function gitVerificationReport(
  repoDir: string,
  branch: string,
): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["ls-tree", "-r", "--name-only", branch, "--", "doc/plans/phases"],
      { cwd: repoDir },
    );
    const files = stdout.split("\n").map((line) => line.trim());
    const newest = files
      .filter((line) => /^doc\/plans\/phases\/phase-\d+\.md$/.test(line))
      .sort()
      .at(-1);
    if (newest === undefined) return undefined;

    const phase = /phase-(\d+)\.md$/.exec(newest)?.[1];
    const report = `doc/plans/phases/reports/phase-${phase}-verification.md`;
    return files.includes(report) ? report : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A branch's tip sha in `repoDir`, or undefined when the branch does not
 * exist. Missing is a legitimate answer, not an error: before the first stage
 * that owns one, there is no branch.
 */
async function gitBranchHead(
  repoDir: string,
  branch: string,
): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["rev-parse", "--verify", `refs/heads/${branch}`],
      { cwd: repoDir },
    );
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * The checkout's current HEAD sha. Undefined is a legitimate answer — an
 * unborn branch in a fresh clone has no HEAD commit.
 */
async function gitCurrentHead(repoDir: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: repoDir,
    });
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

/** Reduce an error to one readable line. */
/**
 * The message the chunk-zero merge commit carries.
 *
 * A merge git records as a commit is a commit this system authored, so
 * [ADR-0019](../../doc/adr/0019-timone-authored-commits-carry-a-provenance-trailer.md)'s
 * trailer is not optional on it. The merge is made by the **daemon** rather
 * than by a spawned session, so there is no session id to name — the stage is
 * what answers "where did this come from?", and `breakdown` is the only stage
 * that can produce this commit.
 *
 * Found by the guardrail check on 2026-08-15, after the first live merge put
 * an untrailed `Merge branch …` on a client's default branch — the rule
 * catching the first commit made by machinery written the same day.
 */
export function mergeMessage(branch: string): string {
  return [
    `Merge the approved breakdown from ${branch}`,
    "",
    "The specification and the list of pieces, agreed in one gesture and",
    "landed on the default branch so every piece cuts from a branch that",
    "carries them (ADR-0030 D2).",
    "",
    `${STAGE_TRAILER}: breakdown`,
  ].join("\n");
}

function oneLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0];
}

/**
 * The wait a claimed run goes back to when its session never starts — its own
 * wait, as the ledger recorded it, so a released run is indistinguishable from
 * one that was never claimed.
 *
 * Exported since ADR-0023's consume: the poll loop advances a wait's cursor
 * and `timone retry` rewinds it, and both are "the wait it already had, with
 * one field different". Three copies of that shape would be three places for
 * the next field on a wait to be forgotten.
 *
 * The fallback text is unreachable in practice: parking names what a run waits
 * for, so a parked run has one. It is here so that releasing a claim can never
 * be the thing that throws.
 */
/**
 * A stage stopped part-way and asked the human for something. **Park it; do
 * not fail it**
 * ([ADR-0031](../../doc/adr/0031-a-handoff-is-a-wait-not-a-failure.md)).
 *
 * This function exists because the same three lines used to be written out
 * three times, and all three called `store.fail` while the reason they wrote
 * said *"handed the work to you"* — a failure whose own words described a
 * wait. On `scratch-app` #31 the human answered that invitation with `carry
 * on` and nothing could act on it: a failed run has no trigger but `timone
 * retry`, and `resumeAnsweredRuns` watches parked runs only.
 *
 * **The wait kind is `conversation` and is reused, not invented.**
 * `resolveWait` re-enters the *same* stage carrying the human's words for that
 * kind, which is exactly what a stage that asked a question needs — it is the
 * one that has to judge whether the answer settles anything. It also buys both
 * of ADR-0022's answer paths: write on the ticket, or take over.
 *
 * **The cursor is the handoff comment's own instant**, so only what is said
 * after the question can answer it. Not "now": a clock a second ahead would
 * swallow a reply typed immediately. Not an instant computed elsewhere: the
 * comment the wait was opened on and the comment the answer is measured
 * against must be one comment, which is what ADR-0023 keeps intact.
 *
 * **Nothing is posted here.** The session's own comment is the report; a
 * `failedComment` under it would be the machine saying "something went wrong"
 * beneath its own polite question, which is half of what made the ticket
 * unreadable. The standing call to action reconciles itself from the run's
 * state and now reads *"This one is waiting on you"*.
 */
function handBack(
  store: RunStore,
  id: string,
  stage: PipelineStage,
  outcome: { comment: TicketComment },
  log: (message: string) => void,
): void {
  store.park(id, {
    waitingOn: "your answer to the question in my last comment.",
    kind: "conversation",
    stage,
    waitCursor: outcome.comment.createdAt,
  });
  log(`parked ${id} — ${stage} handed back, waiting on you`);
}

/**
 * A stage was given an answer it may not act on, and said so
 * ([ADR-0033](../../doc/adr/0033-a-stage-that-cannot-act-on-an-answer-escalates.md)).
 *
 * {@link handBack}'s sibling, and the one field that differs is the whole
 * difference: the wait kind. A handoff waits for a reply and resumes on one.
 * This wait resumes on nothing written, because the stage already read the
 * words and was right about them — on ivtrends #1 it was right five times,
 * at the pipeline's most expensive setting, and each rightness cost a full
 * pass.
 *
 * **The cursor is the escalation comment's own instant**, for handBack's
 * reason and one more: the prompt the escalation session starts from finds
 * the stage's account by matching that instant, so a clock a second out would
 * lose the account this whole path exists to carry.
 *
 * **Nothing is posted.** The stage's comment is the account; the standing
 * call to action already says what a person can do about it.
 */
function escalate(
  store: RunStore,
  id: string,
  stage: PipelineStage,
  outcome: { comment: TicketComment },
  log: (message: string) => void,
): void {
  store.park(id, {
    waitingOn: ESCALATION_WAIT,
    kind: "escalation",
    stage,
    waitCursor: outcome.comment.createdAt,
  });
  log(`parked ${id} — ${stage} can go no further, waiting on a person`);
}

export function waitOf(run: Run): ParkOptions {
  return {
    waitingOn: run.waitingOn ?? "a human",
    ...(run.waitingKind === undefined ? {} : { kind: run.waitingKind }),
    ...(run.stage === undefined ? {} : { stage: run.stage }),
    ...(run.waitCursor === undefined ? {} : { waitCursor: run.waitCursor }),
  };
}

/**
 * The later of two instants — the one a re-park may safely wait from, since a
 * cursor is only ever a claim that everything up to it has been read.
 */
function laterOf(one: string, other: string): string {
  return instant(one) >= instant(other) ? one : other;
}

/** Whether `stage` is one the prompts module knows how to instruct. */
function isPrompted(
  stage: PipelineStage,
): stage is (typeof PROMPTED_STAGES)[number] {
  return (PROMPTED_STAGES as readonly string[]).includes(stage);
}

/**
 * Drives a run through the pipeline until it reaches a human wait.
 *
 * One session per stage, and the run walks on by itself between stages that
 * need no human — a stage boundary is not a session boundary, a *wait* is
 * (ADR-0013). So triage flowing into planning happens in one pass, while
 * anything needing an answer stops, parks, and is resumed by a later poll
 * from the artifacts and the thread.
 *
 * Two invariants live here rather than in the prompt, because a prompt is a
 * request and an invariant is not: the target project must be declared in
 * `timone.yaml` before anything is spawned (R2), and the session's working
 * directory is the timone root, never the project checkout (ADR-0007).
 */
export class AgentSessionSpawner implements SessionSpawner {
  private readonly log: (message: string) => void;
  private readonly channel: ConversationChannel;
  private readonly progressIntervalMs: number;
  private readonly linkRetryWaitsMs: readonly number[];
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly options: AgentSessionSpawnerOptions) {
    this.log = options.log ?? (() => {});
    this.channel = options.channel ?? new TerminalChannel();
    this.progressIntervalMs =
      options.progressIntervalMs ?? DEFAULT_PROGRESS_INTERVAL_SECONDS * 1000;
    this.linkRetryWaitsMs = options.linkRetryWaitsMs ?? DEFAULT_LINK_RETRY_WAITS_MS;
    this.sleep =
      options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async spawn(
    run: Run,
    project: TicketingProject,
    context: SpawnContext = {},
  ): Promise<void> {
    const { manifest } = this.options;

    if (!(project.name in manifest.projects)) {
      throw new Error(
        `Refusing to spawn a session for "${project.name}": it is not declared in the manifest`,
      );
    }

    // **Once per run, and here rather than per stage** (ADR-0041 D2). A run
    // walks several stages between two human waits, and the version it
    // follows must be the one it started on: a pin re-read at every stage is
    // not a pin, it is a branch with extra steps.
    //
    // **Before anything is claimed and before any session starts**, including
    // the approval record's — every one of those is a session, and a refusal
    // that arrived after one of them would already have spent it.
    const checkout = await this.timoneCheckout();
    if (checkout.uncommitted.length > 0) {
      // Thrown rather than written on the ticket, exactly as the manifest
      // refusal above is. The poll loop catches it, reports it in the
      // daemon's own log and leaves the run untouched, so the next cycle
      // starts it as soon as the changes are committed — where failing the
      // run would leave every marked ticket needing `timone retry` by hand.
      throw new Error(uncommittedRefusal(checkout.uncommitted));
    }
    if (checkout.pin !== undefined) {
      this.log(`pinned ${run.id} — timone at ${checkout.pin.commit.slice(0, 7)}`);
    }

    let stage: PipelineStage = context.stage ?? run.stage ?? "triage";
    let feedback = context.feedback;

    if (context.approval !== undefined) {
      const recorded = await this.recordApproval(run, project, context.approval);
      if (!recorded) return;
    }

    for (;;) {
      if (!isBuilt(stage)) {
        await this.park(run, project, stage);
        return;
      }

      // A conversation stage still never starts of the daemon's own accord —
      // but ADR-0022 gave the human a second way to start it, and an answer
      // in hand *is* them having started it. Arriving here with nothing is
      // still a stop; arriving with their words falls through to the session
      // that ingests them, because re-posting the invitation they have just
      // answered is the precise failure the written path exists to prevent.
      if (!runsUnattended(stage) && feedback === undefined) {
        // The map is the one conversation with nothing to ask yet. Its
        // question is the whole effort's — *shall I write the specification?*
        // — and it is not owed until its own decision tickets are all closed
        // (ADR-0024). An invitation posted here would be a question on a
        // ticket nobody can answer, which is this phase's fault inverted.
        if (stage === "charting") {
          this.holdMap(run, stage);
          return;
        }
        await this.openConversation(run, project, stage);
        return;
      }

      // Recorded before the stage runs, not after it finishes. `timone status`
      // reads this to say what a run is doing, and since 14f to say which
      // model it is doing it on — so a stage written only on completion has
      // both describing the *previous* stage for as long as the current one
      // takes, which for a build is hours. Seen live on 2026-08-07: a run
      // three minutes into building still read "planning".
      this.options.store.setStage(run.id, stage);

      await this.claimBranch(run, project, stage);

      const outcome = await this.runStage(run, project, stage, feedback);
      if (!outcome.ok) return;
      feedback = undefined;

      const next = await this.afterStage(
        run,
        project,
        stage,
        outcome.ticket,
        outcome.producedWork,
        outcome.outcome,
        outcome.cursor,
      );
      if (next === undefined) return;
      stage = next;
      this.options.store.setStage(run.id, stage);
      this.log(`stage  ${run.id} → ${stage}`);
    }
  }

  /**
   * Run one stage's session. Returns the ticket as it stood afterwards, and
   * whether the session actually moved the work branch on — which is the only
   * evidence the daemon has that a stage owing an artifact produced one.
   *
   * `cursor` is the instant the session started from: everything the session
   * itself said is strictly after it. Returned rather than kept private
   * because judging the stage means reading what *this* session posted, and
   * the outcome markers and a conversation's record must be read from the
   * same instant or the two judgements can disagree about whose words they
   * are looking at.
   */
  private async runStage(
    run: Run,
    project: TicketingProject,
    stage: PipelineStage,
    feedback: string | undefined,
  ): Promise<
    | {
        ok: true;
        ticket: TicketThread;
        producedWork: boolean;
        outcome: StageOutcome | undefined;
        cursor: string;
      }
    | { ok: false }
  > {
    const { store, adapter, root } = this.options;

    const model = modelFor(stage);
    if (!isPrompted(stage) || model === undefined) {
      // A stage the graph calls built and the prompts module cannot instruct
      // is a wiring mistake, and failing loudly beats running a blank session.
      // The missing model is the same mistake wearing different clothes — and
      // is unreachable while the graph type-checks, since a stage the daemon
      // spawns cannot be declared without one. It is here so that a stage
      // reaching this line by some path the types cannot see stops, rather
      // than running on whatever the runtime happens to default to.
      const reason =
        isPrompted(stage) && model === undefined
          ? `no model is declared for the ${stage} stage`
          : `no prompt exists for the ${stage} stage`;
      store.fail(run.id, reason);
      await adapter.postComment(project, run.ticket, failedComment(reason));
      return { ok: false };
    }

    const before = await adapter.getTicket(project, run.ticket);
    const prompt = stagePrompt(stage, {
      project,
      ticket: before,
      classification: classificationFromLabels(before.labels),
      feedback,
      branch: store.get(run.id)?.branch,
    });

    const branch = store.get(run.id)?.branch;
    // A branch the stage has not cut yet has no tip, and "no tip" must not
    // read as "different from whatever tip appears" — cutting a branch is not
    // doing work. The checkout's current HEAD is what the stage would cut
    // from, so it is the honest baseline.
    const headBefore =
      (await this.branchHead(project, branch)) ?? (await this.currentHead(project));

    const { outcome, attempts } = await this.runSession(
      run,
      stage,
      sessionRequest({ cwd: root, prompt, model, effort: effortFor(stage) }),
    );

    if (!outcome.ok) {
      const reason = outcome.error ?? "the session ended without a result";
      // Whose failure it was decides which words the ticket gets (ADR-0034).
      // A technical stop reaching here has already been tried as often as it
      // is going to be, so what is left to say is that it was the machine's
      // fault and not the reader's.
      const fault = technicalFault(outcome.error);
      store.fail(run.id, reason);
      await adapter.postComment(
        project,
        run.ticket,
        fault === undefined
          ? failedComment(reason)
          : unreachableComment(fault, reason, attempts),
      );
      this.log(`failed ${run.id} — ${reason}`);
      return { ok: false };
    }

    const headAfter = await this.branchHead(project, branch);

    const cursor = outcomeCursorFrom(before);
    const after = await adapter.getTicket(project, run.ticket);
    return {
      ok: true,
      ticket: after,
      producedWork: headAfter !== undefined && headAfter !== headBefore,
      outcome: readStageOutcome(after, cursor),
      cursor,
    };
  }

  /**
   * Run one stage's session, and try it again when what stopped it was the
   * link rather than the work
   * ([ADR-0034](../../doc/adr/0034-a-technical-stop-is-retried-not-reported.md)).
   *
   * **Nothing is posted between attempts**, and that is the whole point: a
   * dropped connection is not news, and a ticket is not where it is mended.
   * What the human sees is either the stage finishing, or — once the waits
   * run out — one comment saying the machine could not get through.
   *
   * **The act is the one `timone retry` already performs**: the same stage, a
   * fresh session, on the branch as the last attempt left it. Nothing new is
   * being trusted here; what changes is that a human no longer has to be
   * awake to ask for it.
   *
   * **A start that throws is an outcome like any other, from the second
   * attempt on.** The first is left to throw, because {@link startClaimed}
   * puts a parked run back on its wait before rethrowing and the poll loop
   * reports it. From the second the run is active and claimed, so a throw
   * escaping here would leave it that way with nobody to release it.
   */
  private async runSession(
    run: Run,
    stage: PipelineStage,
    request: SessionRequest,
  ): Promise<{ outcome: SessionOutcome; attempts: number }> {
    for (let attempt = 1; ; attempt += 1) {
      const outcome = await this.attemptSession(run, stage, request, attempt);
      if (outcome.ok) return { outcome, attempts: attempt };

      // Only a broken link is retried. A refused login would be refused
      // again, and a stage that broke on its own work would break the same
      // way — both are told to the human at once, in their own words.
      const wait =
        technicalFault(outcome.error) === "link"
          ? this.linkRetryWaitsMs[attempt - 1]
          : undefined;
      if (wait === undefined) return { outcome, attempts: attempt };

      this.log(
        `retry  ${run.id} (${stage}) — ${outcome.error}; ` +
          `trying again in ${waitWords(wait)}`,
      );
      await this.pause(run.id, wait);
    }
  }

  /** One attempt at a stage's session: start it, watch it, report how it ended. */
  private async attemptSession(
    run: Run,
    stage: PipelineStage,
    request: SessionRequest,
    attempt: number,
  ): Promise<SessionOutcome> {
    let started: StartedSession;
    try {
      started = await this.startClaimed(run, request);
    } catch (error) {
      if (attempt === 1) throw error;
      return { sessionId: "unknown", ok: false, error: oneLine(error) };
    }

    this.log(
      `session ${started.sessionId} started for ${run.id} ` +
        `(${stage}, ${request.model})${attempt === 1 ? "" : ` — attempt ${attempt}`}`,
    );
    return this.watch(run.id, `${run.id} (${stage})`, started);
  }

  /**
   * Wait between attempts, without going quiet.
   *
   * The heartbeat is what proves a run alive (ADR-0017, narrowed by
   * ADR-0020), and it is stamped by the progress ticker — which belongs to a
   * session, and between two attempts there is none. A silent wait longer
   * than four intervals would be read on another cycle as a dead run and
   * reclaimed: the recovery machinery killing the run it is nursing. So the
   * ticker runs over the wait as well, stamping and printing nothing.
   */
  private async pause(runId: string, ms: number): Promise<void> {
    const start = this.options.ticker ?? intervalTicker;
    const ticker = start(() => {
      this.options.store.heartbeat(runId);
    }, this.progressIntervalMs);

    try {
      await this.sleep(ms);
    } finally {
      ticker.stop();
    }
  }

  /**
   * Claim the run, then start its session — in that order (ADR-0023).
   *
   * The claim is what tells a second process the run is taken, so it has to
   * be on disk *before* the work exists rather than after it returns.
   * `runtime.start` awaits the session's first message, so the window between
   * the two used to be as long as a session takes to answer, and for all of
   * it the ledger still advertised the run as waiting on a human.
   *
   * Only a parked run is claimed here, because a `picked-up` run is already
   * claimed: that status occupies the project's session slot and every guard
   * already excludes it. What was missing was never a claim for the entry
   * path — it was one for the resume path.
   *
   * If the spawn fails the run goes back to the wait it came from, and the
   * error goes on to whoever asked for the session. **A claim that outlives
   * its session is the stuck-run fault**, so releasing it is part of the same
   * path rather than a later cycle's problem.
   */
  private async startClaimed(
    run: Run,
    request: SessionRequest,
  ): Promise<StartedSession> {
    const { store, runtime } = this.options;

    const before = store.get(run.id);
    const parked = before?.status === "parked" ? before : undefined;
    if (parked !== undefined) store.claim(run.id);

    try {
      const started = await runtime.start(request);
      store.activate(run.id, started.sessionId);
      return started;
    } catch (error) {
      if (parked !== undefined) store.park(run.id, waitOf(parked));
      throw error;
    }
  }

  /**
   * Judge an unattended work stage by its two witnesses: the outcome its
   * session recorded on the ticket, and the artifact it owes on the branch.
   * Only the honest pair — a done marker over a real artifact — advances;
   * a handed-to-human outcome stops without commentary (the session's own
   * comment is the report); every other combination is a wiring defect the
   * run fails loudly on, because a stage that says one thing and shows
   * another cannot be built upon in either direction.
   */
  private async afterWorkStage(
    run: Run,
    project: TicketingProject,
    stage: PipelineStage,
    outcome: StageOutcome | undefined,
    artifact: () => Promise<{ ok: boolean; observed: string }>,
  ): Promise<PipelineStage | undefined> {
    const { store, adapter } = this.options;

    if (outcome?.kind === "handed-to-human") {
      handBack(store, run.id, stage, outcome, this.log.bind(this));
      return undefined;
    }

    const evidence = await artifact();
    if (outcome?.kind === "advanced" && evidence.ok) {
      return stageAfter(stage);
    }

    const reason =
      outcome === undefined
        ? `the ${stage} stage ended without recording an outcome, and ${evidence.observed}`
        : `the ${stage} stage said it finished, but ${evidence.observed}`;
    store.fail(run.id, reason);
    await adapter.postComment(project, run.ticket, failedComment(reason));
    this.log(`failed ${run.id} — ${reason}`);
    return undefined;
  }

  /**
   * Judge a remediation. Three honest endings, because ADR-0016 gives the
   * session three paths: a fix committed (the branch moved) re-verifies —
   * nothing reaches the PR unchecked; a reply with nothing committed goes
   * straight back to waiting on the review — a clarifying question is not a
   * change and re-verifying nothing would be theatre; handed-to-human stops
   * as everywhere else.
   */
  private async afterRemediation(
    run: Run,
    project: TicketingProject,
    outcome: StageOutcome | undefined,
    producedWork: boolean,
  ): Promise<PipelineStage | undefined> {
    const { store, adapter } = this.options;

    if (outcome?.kind === "handed-to-human") {
      handBack(store, run.id, "remediation", outcome, this.log.bind(this));
      return undefined;
    }

    if (outcome?.kind === "advanced" && producedWork) {
      return "verification";
    }

    if (outcome?.kind === "advanced") {
      const pr = store.get(run.id)?.pr;
      if (pr !== undefined) {
        const thread = await adapter.getPullRequestThread(project, pr);
        store.park(run.id, {
          waitingOn: `your review of pull request #${pr}`,
          kind: "review",
          stage: "remediation",
          waitCursor: thread.comments.at(-1)?.createdAt ?? "",
        });
        this.log(`parked ${run.id} — replied on PR #${pr}, waiting again`);
        return undefined;
      }
    }

    const reason =
      outcome === undefined
        ? "the remediation ended without recording an outcome"
        : "the remediation said it finished, but the run has lost its pull request";
    store.fail(run.id, reason);
    await adapter.postComment(project, run.ticket, failedComment(reason));
    this.log(`failed ${run.id} — ${reason}`);
    return undefined;
  }

  /**
   * Judge the delivery and park the run on its review. Delivery's artifact
   * is the pull request itself (ADR-0004) — a branch probe cannot prove one
   * exists, so the tracker is asked directly. The park's cursor sits at the
   * PR thread's newest comment: only what the human says after the park can
   * wake the run.
   */
  private async afterDelivery(
    run: Run,
    project: TicketingProject,
    outcome: StageOutcome | undefined,
  ): Promise<void> {
    const { store, adapter } = this.options;

    if (outcome?.kind === "handed-to-human") {
      handBack(store, run.id, "delivery", outcome, this.log.bind(this));
      return;
    }

    const branch = store.get(run.id)?.branch;
    const pr =
      branch === undefined
        ? undefined
        : await adapter.findPullRequest(project, branch);
    const open = pr !== undefined && pr.state === "open";

    if (outcome?.kind !== "advanced" || !open) {
      // A park on a review nobody can perform is a gate over nothing —
      // the 12f rule wearing stage 8's clothes.
      const observed = open
        ? `pull request #${pr.number} exists`
        : "no open pull request exists for the branch";
      const reason =
        outcome === undefined
          ? `the delivery stage ended without recording an outcome, and ${observed}`
          : `the delivery stage said it finished, but ${observed}`;
      store.fail(run.id, reason);
      await adapter.postComment(project, run.ticket, failedComment(reason));
      this.log(`failed ${run.id} — ${reason}`);
      return;
    }

    store.recordPullRequest(run.id, pr.number);
    const thread = await adapter.getPullRequestThread(project, pr.number);
    store.park(run.id, {
      waitingOn: `your review of pull request #${pr.number}`,
      kind: "review",
      stage: "delivery",
      waitCursor: thread.comments.at(-1)?.createdAt ?? "",
    });
    this.log(`parked ${run.id} at delivery, waiting on PR #${pr.number}`);
  }

  /**
   * The daemon's own checkout, as this run must see it. A read that fails
   * answers "no version, nothing outstanding" rather than throwing: the
   * refusal in `spawn` is about work somebody has not committed, and a root that
   * is not a checkout at all is a different fault with a different fix.
   */
  private async timoneCheckout(): Promise<TimoneCheckout> {
    const probe = this.options.timoneProbe ?? readTimoneCheckout;
    try {
      return await probe(this.options.root);
    } catch {
      return { uncommitted: [] };
    }
  }

  /** The phase file's status text on `branch`, or undefined without one. */
  private async planStatus(
    project: TicketingProject,
    branch: string | undefined,
  ): Promise<string | undefined> {
    if (branch === undefined) return undefined;
    const probe = this.options.planStatusProbe ?? gitPlanStatus;
    try {
      return await probe(
        join(this.options.root, "projects", project.name),
        branch,
      );
    } catch {
      return undefined;
    }
  }

  /** The verification report's path on `branch`, or undefined without one. */
  private async verificationReport(
    project: TicketingProject,
    branch: string | undefined,
  ): Promise<string | undefined> {
    if (branch === undefined) return undefined;
    const probe = this.options.verificationReportProbe ?? gitVerificationReport;
    try {
      return await probe(
        join(this.options.root, "projects", project.name),
        branch,
      );
    } catch {
      return undefined;
    }
  }

  /** The checkout's current HEAD, or undefined when it cannot be read. */
  private async currentHead(
    project: TicketingProject,
  ): Promise<string | undefined> {
    const probe = this.options.headProbe ?? gitCurrentHead;
    try {
      return await probe(join(this.options.root, "projects", project.name));
    } catch {
      return undefined;
    }
  }

  /** The work branch's tip, or undefined when there is no branch yet. */
  private async branchHead(
    project: TicketingProject,
    branch: string | undefined,
  ): Promise<string | undefined> {
    if (branch === undefined) return undefined;
    const probe = this.options.repoProbe ?? gitBranchHead;
    try {
      return await probe(join(this.options.root, "projects", project.name), branch);
    } catch {
      return undefined;
    }
  }

  /**
   * What the run does now that `stage`'s session has finished: the next stage
   * to run, or undefined when the run has stopped for good or for now.
   */
  private async afterStage(
    run: Run,
    project: TicketingProject,
    stage: PipelineStage,
    ticket: TicketThread,
    producedWork: boolean,
    outcome: StageOutcome | undefined,
    cursor: string,
  ): Promise<PipelineStage | undefined> {
    const { store, adapter } = this.options;

    // **Before every other ending, and for every stage** (ADR-0033 D2). A
    // stage handed something outside what it may do is stopped whatever kind
    // of stage it is — the gate it would have opened and the conversation it
    // would have re-parked on are both questions, and asking another question
    // is the loop this closes.
    if (outcome?.kind === "escalated") {
      escalate(store, run.id, stage, outcome, this.log.bind(this));
      return undefined;
    }

    if (waitFor(stage) === "gate") {
      await this.openGate(run, project, stage, producedWork);
      return undefined;
    }

    if (waitFor(stage) === "conversation") {
      return this.afterConversation(run, project, stage, ticket, cursor);
    }

    if (stage === "execution") {
      return this.afterWorkStage(run, project, stage, outcome, async () => {
        const status = await this.planStatus(
          project,
          store.get(run.id)?.branch,
        );
        return {
          ok: status !== undefined && /^Complete\b/.test(status),
          observed: `the phase file's status is "${status ?? "not found"}"`,
        };
      });
    }

    if (stage === "verification") {
      return this.afterWorkStage(run, project, stage, outcome, async () => {
        const report = await this.verificationReport(
          project,
          store.get(run.id)?.branch,
        );
        return {
          ok: report !== undefined,
          observed:
            report !== undefined
              ? `the verification report is ${report}`
              : "no verification report exists on the branch",
        };
      });
    }

    if (stage === "delivery") {
      await this.afterDelivery(run, project, outcome);
      return undefined;
    }

    if (stage === "remediation") {
      return this.afterRemediation(run, project, outcome, producedWork);
    }

    // ✏ Wait-free since ADR-0030 D1, so no longer caught by the gate branch at
    // the top of this method — and **without this branch it would fall through
    // to triage's**, which reads a `triage:` label off the ticket and routes on
    // it. That is not a wrong answer, it is three: back to `clarification` on a
    // feature, re-opening an interview the human has already had; back to
    // `planning` on a chore, which is `spawn`'s unbounded loop spending money
    // every turn; and a failed run reading "triage recorded no classification"
    // on a ticket that never carried one.
    //
    // Judged exactly as the other unattended work stages are — the outcome the
    // session recorded, over the artifact it owes. `producedWork` is that
    // artifact's witness here: the branch tip moved, so a phase file exists.
    // It is the branch-tip comparison R5 installed after the daemon once
    // believed a session's exit code alone, and it is doing more work than
    // usual at this stage, because with the gate gone nothing else stands
    // between an empty branch and a build session.
    if (stage === "planning") {
      return this.afterWorkStage(run, project, stage, outcome, async () => ({
        ok: producedWork,
        observed: producedWork
          ? "the branch carries what it planned"
          : "nothing was committed to the branch",
      }));
    }

    // ✏ Built since phase 27, and it needs a branch here for the reason the
    // fall-through below spells out: it is wait-free, so without one it lands
    // on triage's judgement, which reads a `triage:` label off the ticket — and
    // a wayfinder ticket carries none, so every research run would die on
    // "triage recorded no classification". That is precisely the defect that
    // kept this stage declared `built: false` for three phases.
    //
    // **Nothing follows it, so an advance ends the run.** A research answer
    // resolves its own ticket and feeds the map (ADR-0010); the map's own
    // ticket is what hands stage 2's outcome to stage 3.
    //
    // **The outcome marker is the whole of the evidence, and legitimately so.**
    // Every other unattended stage is judged against an artifact on a branch,
    // because it owes one. This stage owes an *answer on the ticket*, and the
    // marker is a comment on that ticket — `readStageOutcome` only sees one
    // that Timone posted after this session began. There is nothing else to
    // check that would not be checking the same comment twice.
    if (stage === "research") {
      if (outcome?.kind === "handed-to-human") {
        handBack(store, run.id, stage, outcome, this.log.bind(this));
        return undefined;
      }
      if (outcome?.kind === "advanced") {
        store.complete(run.id);
        this.log(`done   ${run.id} — ${stage} answered it`);
        return undefined;
      }
      const reason = `the ${stage} stage ended without recording an outcome`;
      store.fail(run.id, reason);
      await adapter.postComment(project, run.ticket, failedComment(reason));
      this.log(`failed ${run.id} — ${reason}`);
      return undefined;
    }

    // The only remaining wait-free stage is triage, and what follows it is
    // the classification it just recorded — read back off the ticket, because
    // the label is where the process says the record lives.
    //
    // **This is a fall-through, so it is what every future wait-free stage
    // silently inherits**, and it type-checks whatever reaches it. A stage
    // added above without a branch of its own lands here and gets triage's
    // judgement applied to it — see the `planning` branch just above for what
    // that costs.
    const kind = classificationFromLabels(ticket.labels);
    if (kind === undefined) {
      store.fail(run.id, "triage recorded no classification");
      await adapter.postComment(project, run.ticket, unclassifiedComment());
      return undefined;
    }

    const transition = routeAfterTriage(kind);
    if (transition.kind === "finish") {
      store.complete(run.id);
      await adapter.postComment(project, run.ticket, answeredComment());
      // The comment says "I'm closing my side of it" — so close it, rather
      // than saying one thing and doing another.
      await adapter.closeTicket(project, run.ticket, "completed");
      this.log(`done   ${run.id} — ${transition.reason}`);
      return undefined;
    }
    if (transition.kind !== "advance") return undefined;

    return transition.stage;
  }

  /**
   * Judge a session that ingested a written answer (ADR-0022).
   *
   * Three endings, and the ticket is where all three are read from — the
   * daemon never saw the exchange, so what the session *posted* is the whole
   * of what it knows. **Settled** is a record carrying the conversation
   * marker {@link readConversationRecord} looks for, and it ends the
   * conversation exactly as a takeover's would: on to the next stage, or done
   * when nothing follows (wayfinding, whose one decision is the whole run).
   *
   * **Not settled** and **handed back** are one ledger state and two
   * comments, deliberately. Whether the session asked the one remaining thing
   * or gave up and named the takeover, the ticket is waiting on a human
   * again; the difference is what they read, not what the run is doing.
   * Trying to tell them apart mechanically would be this slice deciding
   * "settled", which is the session's judgement and no code's.
   *
   * The **fresh cursor** is what makes the resume once-only: the answer that
   * started this session now sits before the cursor and cannot start another.
   * It is written here, by whoever ran the session, because the poll loop
   * cannot write it for a session it did not run without owning the same fact
   * twice.
   */
  private async afterConversation(
    run: Run,
    project: TicketingProject,
    stage: PipelineStage,
    ticket: TicketThread,
    cursor: string,
  ): Promise<PipelineStage | undefined> {
    const { store } = this.options;

    if (readConversationRecord(ticket, cursor) === undefined) {
      this.stop(run, {
        waitingOn: run.waitingOn ?? "a conversation in your terminal",
        kind: "conversation",
        stage,
        // Never before the answer this session was started on (ADR-0023).
        // `waitCursorFrom` answers "when did the machine last speak", which is
        // the right question when the session *spoke* — and the wrong one when
        // it posted nothing, because then it resolves to the invitation the
        // human already replied to and the next cycle reads their reply a
        // second time. `cursor` is the newest comment on the thread as this
        // session began, so it is never earlier than their answer; the later
        // of the two is right in both cases and changes nothing on the path
        // where the session did post.
        waitCursor: laterOf(waitCursorFrom(ticket), cursor),
      });
      this.log(`parked ${run.id} at ${stage}, still waiting on a conversation`);
      return undefined;
    }

    const transition = concludeConversation(stage, { accepted: true });
    if (transition.kind === "advance") return transition.stage;

    store.complete(run.id);
    this.log(`done   ${run.id} — ${stage} resolved it`);
    return undefined;
  }

  /**
   * Write an approval into the artifact it belongs to, before the run moves
   * on. Returns false when the recording session failed, in which case the
   * run has already been failed and the ticket told.
   *
   * A short session of its own rather than a line appended to the next
   * stage's prompt: the next stage may not be built, and an approval that
   * only lands when the following stage happens to run is an approval that
   * disappears whenever the pipeline stops.
   */
  private async recordApproval(
    run: Run,
    project: TicketingProject,
    approval: NonNullable<SpawnContext["approval"]>,
  ): Promise<boolean> {
    const { store, adapter, root } = this.options;
    if (!isPrompted(approval.stage)) return true;

    const ticket = await adapter.getTicket(project, run.ticket);
    const prompt = approvalRecordPrompt(
      { stage: approval.stage, by: approval.by, at: approval.at },
      { project, ticket, branch: store.get(run.id)?.branch },
    );

    // Its own declared model, never the runtime's default: this is the second
    // `runtime.start` site and not a `PipelineStage`, so nothing in the graph
    // speaks for it. Haiku carries no effort at all.
    const started = await this.startClaimed(
      run,
      sessionRequest({ cwd: root, prompt, model: APPROVAL_RECORD_MODEL }),
    );
    this.log(`record ${run.id} — ${approval.by} approved ${approval.stage}`);

    const outcome = await this.watch(run.id, `${run.id} (approval record)`, started);
    if (!outcome.ok) {
      const reason = `could not record the approval: ${outcome.error ?? "the session ended without a result"}`;
      store.fail(run.id, reason);
      await adapter.postComment(project, run.ticket, failedComment(reason));
      return false;
    }

    // Only now, with the stamp committed and pushed: approving the breakdown
    // is one gesture with two effects (ADR-0030 D2), and a chunk zero merged
    // before its approval was recorded would be work on the default branch
    // with nothing on the branch saying what authorised it.
    if (approval.stage === "breakdown") {
      if (!(await this.mergeChunkZero(run, project))) return false;

      // **And the run stops here, either way.** Approving a breakdown turns
      // this ticket into a *map* of its steps
      // ([ADR-0040](../../doc/adr/0040-one-step-is-one-ticket-and-doneness-is-a-fact-about-a-ticket.md)):
      // planning belongs to each step's own run, one at a time, behind
      // whatever else is queued. Letting this run walk on into `planning` is
      // the chunk model wearing the new model's clothes — it planned the whole
      // initiative on the map ticket, for nine minutes of Opus, and phase 29's
      // live gate is what caught it.
      const failure = await this.openStepTickets(run, project);
      if (failure !== undefined) {
        // A failure here leaves an approved breakdown with no steps, so
        // nothing will ever pick the work up. It is a fault and is recorded as
        // one — the alternative, which is what shipped, was to carry on and
        // build the whole thing as if the steps had never been the point.
        store.fail(run.id, failure);
        await adapter.postComment(project, run.ticket, failedComment(failure));
        return false;
      }
      store.complete(run.id);
      return false;
    }

    return true;
  }

  /**
   * Open one ticket per step of an approved breakdown, as children of the
   * initiative's own ticket, and turn that ticket into a map of them
   * ([ADR-0040](../../doc/adr/0040-one-step-is-one-ticket-and-doneness-is-a-fact-about-a-ticket.md)).
   *
   * **This is TypeScript and must never become an instruction in
   * `approvalRecordPrompt`.** Idempotence is the whole deliverable here, and
   * idempotence cannot be asserted about a prompt: a model told "create only
   * what is missing" is a hope, not a guard. Fourteen issues opened twice is
   * worse than fourteen never opened, and re-running is the ordinary case —
   * a retry, a redelivered comment, a daemon restarted mid-cycle.
   *
   * It answers rather than throws. A tracker that fell over on the seventh
   * create leaves six real tickets behind, and the next cycle opens the other
   * eight; taking the run down with it would turn a partial success into a
   * failed initiative.
   */
  private async openStepTickets(
    run: Run,
    project: TicketingProject,
  ): Promise<string | undefined> {
    const { adapter, root } = this.options;
    const read = readBreakdown(
      join(root, "projects", project.name),
      run.ticket,
      this.options.breakdownSource ?? fromDefaultBranch,
    );
    if (read.kind !== "ok") {
      return (
        `the approved breakdown at ${read.path} is ${read.kind}, so no step ` +
        "tickets could be opened"
      );
    }

    try {
      // Before anything can be held, the label has to exist — a state nobody
      // created is a state nobody can be in, which is why `timone-wayfind`
      // creates its own on first use. **29c owns this, not 29d**; both slices
      // assuming the other did it shows up as a claim silently not applied.
      await adapter.ensureLabel(project, HELD_LABEL, HELD_LABEL_DESCRIPTION);
      await adapter.ensureLabel(project, MAP_LABEL, MAP_LABEL_DESCRIPTION);

      // The existing children are what makes a re-run free. They are matched
      // by title, and the title carries the chunk's number — so two chunks
      // that happen to be called the same thing are still two tickets, and a
      // child a human opened by hand matches nothing and is left alone.
      const existing = await adapter.listSteps(project, run.ticket);
      const byTitle = new Map(existing.map((step) => [step.title, step.number]));

      const opened: { number: number; chunk: Chunk }[] = [];
      let previous: number | undefined;
      for (const [index, chunk] of read.breakdown.chunks.entries()) {
        const title = stepTitle(index, chunk.title);
        let number = byTitle.get(title);

        if (number === undefined) {
          number = await adapter.createStep(project, run.ticket, {
            title,
            body: stepBody(chunk, run.ticket, read.path),
          });
          // The chain is written only for a ticket this run opened. A step
          // that already existed already carries its relation, and writing it
          // again is the second `blockedBy` edge case (2) forbids.
          if (previous !== undefined) {
            await adapter.blockStep(project, number, previous);
          }
        }
        previous = number;
        opened.push({ number, chunk });
      }

      await adapter.setTicketBody(
        project,
        run.ticket,
        initiativeMap(opened, read.path),
      );
      // Last, and only once the children exist: from here the daemon reads
      // this ticket as a map and never opens a run on it. Marking it before
      // its steps were opened would strand the initiative — a map with no
      // children is a ticket nothing will ever pick up.
      await adapter.applyLabel(project, run.ticket, MAP_LABEL);
      this.log(`steps ${run.id} — ${read.breakdown.chunks.length} steps stand`);
      return undefined;
    } catch (error) {
      // The tickets already opened are real and stay — re-running opens only
      // what is missing, which is what 29c's idempotence is for. What must not
      // happen is this run carrying on as though the steps existed.
      return `could not open the step tickets: ${oneLine(error)}`;
    }
  }

  /**
   * Merge chunk zero — the branch carrying the specification and the approved
   * breakdown — into the project's default branch, with no pull request
   * (ADR-0030 D2). Returns false when it did not happen, having failed the run
   * and said why on the ticket, exactly as a failed approval record does:
   * chunk 1 cuts from the default branch, so a silently failed merge would
   * have it build against a default branch that does not carry the
   * specification, and nothing downstream would notice.
   */
  private async mergeChunkZero(
    run: Run,
    project: TicketingProject,
  ): Promise<boolean> {
    const { store, adapter } = this.options;
    const branch = store.get(run.id)?.branch;
    const outcome = await this.attemptMerge(project, branch);

    if (outcome.merged) {
      this.log(`merged ${run.id} — ${branch} into ${outcome.into}`);
      return true;
    }

    const reason = `could not merge the approved breakdown into the default branch: ${outcome.reason}`;
    store.fail(run.id, reason);
    await adapter.postComment(project, run.ticket, failedComment(reason));
    return false;
  }

  /** The merge itself, with a thrown git failure reduced to a refusal. */
  private async attemptMerge(
    project: TicketingProject,
    branch: string | undefined,
  ): Promise<MergeOutcome> {
    if (branch === undefined) {
      return { merged: false, reason: "the run holds no work branch" };
    }
    const merge = this.options.mergeProbe ?? mergeIntoDefault;
    try {
      return await merge(
        join(this.options.root, "projects", project.name),
        branch,
        mergeMessage(branch),
      );
    } catch (error) {
      return { merged: false, reason: oneLine(error) };
    }
  }

  /**
   * Give the run its work branch, at the first stage that owns one.
   *
   * This is the moment it starts holding its project — so it happens before
   * the session starts, not after. A session that cut a branch on a project
   * another run was already working would have made the collision before the
   * ledger ever heard about it.
   */
  private async claimBranch(
    run: Run,
    project: TicketingProject,
    stage: PipelineStage,
  ): Promise<void> {
    const { store, adapter } = this.options;
    if (!ownsBranch(stage)) return;
    if (store.get(run.id)?.branch !== undefined) return;

    const ticket = await adapter.getTicket(project, run.ticket);
    // The chunk's number, not the ticket's alone: a ticket hosts a sequence of
    // chunks (ADR-0026) and each owns its own branch, so chunk 2 must not
    // claim the one chunk 1 merged and closed. Chunk 1's name is unchanged.
    const branch = workBranch(ticket, run.seq);
    store.claimBranch(run.id, branch);
    this.log(`branch ${run.id} → ${branch}`);
  }

  /**
   * Post the approval request and park on it.
   *
   * The daemon writes this comment, never the session that did the work: the
   * CTA has to be worded exactly as the decision reader accepts it, and a
   * session asked to invent its own would eventually word it otherwise —
   * leaving the human answering a question nothing was listening for.
   */
  private async openGate(
    run: Run,
    project: TicketingProject,
    stage: PipelineStage,
    producedWork: boolean,
  ): Promise<void> {
    const { store, adapter } = this.options;
    const branch = store.get(run.id)?.branch ?? "the work branch";

    // A gate over nothing is the one failure a gate must never have. If the
    // stage committed nothing, the link would 404 and a reply of `approve`
    // would advance the pipeline past a step nobody did — so say so plainly
    // and stop, rather than asking for a signature on a blank.
    if (!producedWork) {
      const reason = `the ${stage} stage finished without committing anything to gate`;
      store.fail(run.id, reason);
      await adapter.postComment(project, run.ticket, producedNothingComment(stage));
      this.log(`failed ${run.id} — ${reason}`);
      return;
    }

    const comment = gateCommentFor(stage, project, branch, [
      "I've written it up and put it on a branch, so you can read the real thing",
      "rather than my description of it.",
    ]);

    if (comment !== undefined) {
      await adapter.postComment(project, run.ticket, comment);
    }

    const after = await adapter.getTicket(project, run.ticket);
    store.park(run.id, {
      waitingOn: "your answer on the ticket",
      kind: "gate",
      stage,
      waitCursor: waitCursorFrom(after),
    });
    this.log(`parked ${run.id} at ${stage}, waiting on a reply`);
  }

  /** Invite the human into a conversation, and park until they conclude it. */
  private async openConversation(
    run: Run,
    project: TicketingProject,
    stage: PipelineStage,
  ): Promise<void> {
    const { store, adapter } = this.options;

    const ticket = await adapter.getTicket(project, run.ticket);
    const opened = await inviteToConversation(this.channel, {
      project: project.name,
      ticket: run.ticket,
      stage,
      subject: conversationSubject(ticket),
    });

    await adapter.postComment(project, run.ticket, opened.comment);
    const after = await adapter.getTicket(project, run.ticket);

    this.stop(run, {
      waitingOn: opened.waitingOn,
      kind: "conversation",
      stage,
      waitCursor: waitCursorFrom(after),
    });
    this.log(`parked ${run.id} at ${stage}, waiting on a conversation`);
  }

  /**
   * Stop on a wayfinder map, silently: it is being worked, and nobody is
   * being asked anything ([ADR-0024](../../doc/adr/0024-every-open-ticket-answers-for-itself.md)).
   *
   * **Nothing is posted, and that is the point.** Every other stop here has a
   * comment of its own because it is announcing something new; this one is
   * announcing that the effort carries on, which the map's standing call to
   * action already says and keeps saying as the map's state changes. A
   * comment here would be the third thing on the ticket saying the same
   * sentence, and the first of them to go stale.
   *
   * No wait kind and no cursor, deliberately. A park with no kind is a run
   * *not waiting on a human* — precisely true of a map still working its
   * list — and the poll loop opens the real wait, with the cursor it must be
   * answered from, on the cycle the frontier turns out to be empty.
   */
  private holdMap(run: Run, stage: PipelineStage): void {
    this.stop(run, {
      waitingOn: "this map's own questions to be answered",
      stage,
    });
    this.log(`parked ${run.id} at ${stage} — working the map`);
  }

  /** Park a run at a stage nothing can run yet, and say so on the ticket. */
  private async park(
    run: Run,
    project: TicketingProject,
    stage: PipelineStage,
  ): Promise<void> {
    const { adapter } = this.options;

    this.stop(run, { waitingOn: "the next stage to be built", stage });
    await adapter.postComment(project, run.ticket, parkedComment(stage));
    this.log(`parked ${run.id} at ${stage} — not built yet`);
  }

  /**
   * Put a run into a wait, whether it was running or already waiting for
   * something else. A resumed run that advances into a stage nothing can run
   * yet never became active, so what changes is its wait, not its state.
   */
  private stop(run: Run, options: ParkOptions): Run {
    const { store } = this.options;
    const current = store.get(run.id);
    return current?.status === "parked"
      ? store.repark(run.id, options)
      : store.park(run.id, options);
  }

  /**
   * Await a session, saying what it is doing while it works and what it cost
   * when it stops.
   *
   * The ticker is cleared in a `finally`, so a session that fails or throws
   * leaves no timer behind, and the closing line is printed there too — the
   * money was spent whether or not the session succeeded, and a cost report
   * that only appears on success is a success report wearing its clothes.
   */
  private async watch(
    runId: string,
    label: string,
    started: StartedSession,
  ): Promise<SessionOutcome> {
    const { progress } = started;
    const start = this.options.ticker ?? intervalTicker;

    // One tick, two jobs (ADR-0020, which narrowed the heartbeat's meaning and
    // left ADR-0017's mechanism alone). The heartbeat is stamped unconditionally
    // — including for a runtime that can say nothing about its progress —
    // because it is what proves the run alive, and a tick made conditional on
    // having something to print would silently move recovery with it.
    const ticker = start(() => {
      this.options.store.heartbeat(runId);
      if (progress !== undefined) {
        this.log(`work   ${label} — ${tickLine(progress.snapshot())}`);
      }
    }, this.progressIntervalMs);

    try {
      return await started.completed;
    } finally {
      ticker.stop();
      const summary = progress?.summary();
      if (summary !== undefined) {
        this.log(`cost   ${label} — ${closingLine(summary)}`);
      }
    }
  }

}

/**
 * The real runtime: one Claude Agent SDK session per run (ADR-0002).
 *
 * Permissions are bypassed because there is no human at the keyboard to
 * answer a prompt — a daemon session that asks would hang forever. That is
 * the accepted risk PRD-02 records for sandboxing; the path-containment
 * guardrail (R15) is what catches a session that strays. That check no longer
 * lives here — since ADR-0018 it is a `Stop` hook in `.claude/settings.json`,
 * which is what makes it cover interactive sessions too.
 */
export const agentSdkRuntime: SessionRuntime = {
  async start(request: SessionRequest): Promise<StartedSession> {
    const session = query({
      prompt: request.prompt,
      options: {
        cwd: request.cwd,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        model: request.model,
        // The only honest live source of output tokens is the cumulative
        // `usage` on a `message_delta`, and that arrives only as a partial
        // message. Without this the progress line reports about a thirtieth
        // of the truth (see `SessionProgress.observeStreamEvent`).
        includePartialMessages: true,
        // Omitted entirely when the stage declares none — Haiku 4.5 rejects
        // the parameter, and sending it as undefined is not the same as not
        // sending it.
        ...(request.effort === undefined ? {} : { effort: request.effort }),
      },
    });

    let resolveId!: (id: string) => void;
    const sessionId = new Promise<string>((resolve) => {
      resolveId = resolve;
    });

    // Fed as the stream is consumed rather than reconstructed afterwards:
    // everything the tick reports has to be known *while* the session runs,
    // and the stream is the only place it exists.
    const progress = new SessionProgress();

    const completed = (async (): Promise<SessionOutcome> => {
      let id = "unknown";
      // The last thing the main thread said, when that was an API error.
      // Assignment is unconditional so a later real message clears it: an
      // error the CLI recovered from is not how the session ended.
      let lastApiError: string | undefined;
      try {
        for await (const message of session) {
          progress.observe(message);
          if ("session_id" in message && typeof message.session_id === "string") {
            id = message.session_id;
            resolveId(id);
          }
          if (message.type === "assistant" && message.parent_tool_use_id === null) {
            lastApiError = message.error;
          }
          if (message.type === "result") {
            resolveId(id);
            return sessionOutcomeFrom(id, message, lastApiError);
          }
        }
        resolveId(id);
        return { sessionId: id, ok: false, error: "session ended with no result" };
      } catch (error) {
        resolveId(id);
        return { sessionId: id, ok: false, error: oneLine(error) };
      }
    })();

    return { sessionId: await sessionId, completed, progress };
  },
};
