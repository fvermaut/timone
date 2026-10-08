import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { delimiter, join } from "node:path";

import {
  query,
  type EffortLevel,
  type Options,
  type SDKMessage,
} from "@anthropic-ai/claude-agent-sdk";

import { checkoutVersion } from "../git.js";
import type { TicketingProject } from "../adapters/ticketing.js";
import { STAGE_TRAILER } from "./hooks.js";
import type { PipelineStage } from "./pipeline.js";
import { PROMPTED_STAGES } from "./prompts.js";
import {
  SessionProgress,
  type ProgressSnapshot,
  type SessionSummary,
} from "./progress.js";
import { forgeGuardBin, installPushGuard } from "./push-guard.js";
import type { ParkOptions, Run } from "./runs.js";

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
   *
   * **The branch is absent at every stage that owns none**: triage,
   * clarification, wayfinding and research all read the project and none of
   * them cuts a branch. A clone with no branch named stands on the remote's
   * default branch, which is what those stages want to read.
   */
  project: { name: string; remote: string; branch?: string };
}

/**
 * The daemon's own checkout, as a run has to see it: which version of Timone
 * this is (ADR-0041 D2).
 */
export interface TimoneCheckout {
  /**
   * The version a run started now would follow. Absent when `dir` is not a
   * git checkout at all — which a running daemon never reaches, since its
   * root *is* its own repository, and which is therefore a wiring mistake
   * rather than a state to report to anybody.
   */
  pin?: TimonePin;
}

/**
 * Read the daemon's own checkout.
 *
 * ✏ 2026-09-30: it no longer lists the files nobody has committed. Only the
 * old spawner read that list, to refuse to start a run, and the spawner was
 * removed.
 */
export async function readTimoneCheckout(dir: string): Promise<TimoneCheckout> {
  const pin = await checkoutVersion(dir);
  return pin === undefined ? {} : { pin };
}

/** What a workspace is assembled from: the pin, the project, its branch. */
export interface WorkspaceInput {
  timone: TimonePin;
  project: TicketingProject;
  /** Absent at a stage that owns no branch. See {@link SessionWorkspace}. */
  branch?: string;
}

/** What a runtime is asked to run. */
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
  /**
   * The session will be spoken to while it runs, through
   * {@link StartedSession.send} (timone#165).
   *
   * **Absent for every stage the daemon runs**, which send their prompt once
   * and wait: those produce exactly the box they always did. Only the runner
   * asks for this, because only the runner has anything to say to a step
   * after it has started. `true` or absent, never `false`, for the reason
   * {@link effort} is absent rather than undefined.
   *
   * The in-process runtime starts such a request as it starts any other and
   * offers no `send` (phase 40, departure recorded in
   * `phase-40-departures.md`); the box is where the runner's steps run.
   */
  interactive?: true;
  /**
   * The one branch this session's `git push` may reach (#85): the run's work
   * branch. Absent at a step that owns none, and then it may push nothing.
   * The guard that holds it to that is installed by the runtime.
   */
  workBranch?: string;
  /**
   * The step this session runs, spelled as the ledger records it. A box is
   * given it so that its checks know the step when the box's own ledger is
   * empty, as it always is (PRD-10.R1, #87).
   */
  stage: PipelineStage;
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
  /** Absent for a session nobody will speak to once it has started. */
  interactive?: true;
  /** Absent, or undefined, for a step that owns no branch. */
  workBranch?: string | undefined;
  /** The step this session runs. See {@link SessionRequest.stage}. */
  stage: PipelineStage;
}

/** A git object name as `git rev-parse` reports one: 40 hexadecimal digits. */
const COMMIT = /^[0-9a-f]{40}$/;

/**
 * The one place a {@link SessionRequest} is assembled. Every caller that
 * starts a session goes through it, so that the rules a request has to obey — the effort key is
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
    stage: input.stage,
    // Spread rather than assigned, so a stage with no effort produces a
    // request with no `effort` key — not one set to undefined, which the
    // runtime would have to tell apart from an intended value. The same
    // holds for a request nobody gave a workspace.
    ...(input.effort === undefined ? {} : { effort: input.effort }),
    ...(input.workspace === undefined
      ? {}
      : { workspace: workspaceOf(input.workspace) }),
    ...(input.interactive === undefined ? {} : { interactive: input.interactive }),
    ...(input.workBranch === undefined ? {} : { workBranch: input.workBranch }),
  };
}

/** The pin, the project and the branch, said the way a clone needs them. */
function workspaceOf(input: WorkspaceInput): SessionWorkspace {
  return {
    timone: input.timone,
    project: {
      name: input.project.name,
      remote: input.project.repoUrl,
      // Spread rather than assigned, for `sessionRequest`'s reason: a stage
      // that owns no branch produces a workspace with no `branch` key, not
      // one set to undefined that a runtime would have to tell apart.
      ...(input.branch === undefined ? {} : { branch: input.branch }),
    },
  };
}

/** How a session ended. */
export interface SessionOutcome {
  sessionId: string;
  ok: boolean;
  error?: string;
}

/** What a step's session needs to say how a running session is doing. */
export interface ProgressReader {
  snapshot(): ProgressSnapshot;
  summary(): SessionSummary | undefined;
}

/** A session that has started and will finish. */
export interface StartedSession {
  sessionId: string;
  completed: Promise<SessionOutcome>;
  /**
   * How the session is doing, for the step session's ticker. Optional because a
   * runtime that cannot see inside a session — a test fake, mostly — should
   * not have to invent numbers to satisfy the interface.
   */
  progress?: ProgressReader;
  /**
   * End the session now, because a human asked for the run to stop
   * ([ADR-0047](../../doc/adr/0047-a-cancel-stops-the-work-it-cancels.md)).
   *
   * **It must really stop the work, not just stop watching it.** A session
   * the daemon has looked away from is still spending money and still
   * pushing commits, which is [#69](https://github.com/fvermaut/timone/issues/69)
   * exactly. `completed` settles afterwards, with whatever the ending looked
   * like from outside; nobody reads it, because the run is cancelled.
   *
   * Returns nothing and never throws: a stop that fails must not become the
   * cancelling cycle's error, and there is nothing the caller could do with
   * one. Optional for the same reason {@link progress} is — a fake has no
   * work to stop.
   */
  stop?(): void;
  /**
   * Say something to the session while it runs (timone#165): the text
   * reaches it as a message from the user.
   *
   * Offered only for a request marked {@link SessionRequest.interactive}, and
   * only by a runtime that can deliver it — today, the box. A message sent
   * after the session has finished goes nowhere; how the session ended is
   * what `completed` says.
   */
  send?(text: string): void;
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
/**
 * What the main thread's last word said, when that word was an API error.
 *
 * **The short code alone is not enough to act on.** The runtime puts a code
 * in `error` — `authentication_failed` — and the sentence that says *which*
 * kind of failure it was in the message's own text. On 2026-08-23 a run died
 * carrying `error: "authentication_failed"` beside the text `Failed to
 * authenticate. API Error: 401 OAuth access token has expired.
 * Re-authenticate to continue.` Only the second of those two says the token
 * timed out rather than being refused, and that is the whole difference
 * between a stop the daemon mends by itself and one it puts in front of a
 * human ([#55](https://github.com/fvermaut/timone/issues/55)).
 *
 * The daemon kept only the code, so neither {@link technicalFault} nor the
 * reader of the ticket ever saw the word "expired". Both halves are kept now,
 * the code first because it is the stable one.
 */
export function apiErrorFrom(message: {
  error?: string;
  message?: { content?: unknown };
}): string | undefined {
  if (message.error === undefined) return undefined;
  const said = spokenText(message.message?.content);
  return said === undefined ? message.error : `${message.error}: ${said}`;
}

/** The text blocks of a message's content, joined; undefined when there are none. */
function spokenText(content: unknown): string | undefined {
  if (!Array.isArray(content)) return undefined;
  const said = content
    .filter(
      (block): block is { text: string } =>
        typeof block === "object" &&
        block !== null &&
        (block as { type?: unknown }).type === "text" &&
        typeof (block as { text?: unknown }).text === "string",
    )
    .map((block) => block.text.trim())
    .filter((text) => text !== "")
    .join(" ");
  return said === "" ? undefined : said;
}

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
 * The real ticker. Behind a seam so tests need no clock.
 *
 * Exported because the daemon is no longer the only thing that has to keep a
 * run's heartbeat warm: `timone takeover` holds a run `active` for as long as
 * a human sits in it, and a run that goes quiet is reclaimed as dead. Both
 * beat with the same mechanism rather than two that could drift.
 */
export function intervalTicker(onTick: () => void, intervalMs: number): Ticker {
  // **Once immediately, then on the interval** (ADR-0049 D3). A plain
  // `setInterval` says nothing for its first whole interval, so a takeover
  // spent its first thirty seconds holding a run it had given no sign of life
  // for at all — which is how wide timone#78's window was. The tick is
  // idempotent (it stamps a timestamp), so an extra one at the start costs
  // nothing and closes the gap where it is widest.
  onTick();
  const handle = setInterval(onTick, intervalMs);
  return { stop: () => clearInterval(handle) };
}

/**
 * The agent runtime, behind an interface so the code that starts sessions —
 * the part that carries the process rules — is testable without the SDK.
 */
export interface SessionRuntime {
  start(request: SessionRequest): Promise<StartedSession>;
}

/**
 * The workspace half of a request, or nothing at all.
 *
 * **This function is what was missing on 2026-08-22**, when the first real
 * daemon-spawned boxed run answered *"a boxed session needs a workspace to
 * clone: this request describes none"*. 30e added the field to the request
 * and 30f read the pin off the checkout, and **nothing joined them** — each
 * half correct on its own, and no unit test able to see the gap between them,
 * because until the box became the default no runtime read the field.
 *
 * Absent only when the checkout can name no version. That is legitimate: the
 * in-process runtime ignores the field, and a root that is no repository is a
 * wiring mistake with a different fix.
 *
 * **A run that holds no branch still gets a workspace**, and it used to not.
 * `triage`, `clarification`, `wayfinding` and `research` own no branch, so the
 * old rule handed the container runtime a request with no workspace at all —
 * which it refuses, by design. The refusal escapes to the poll loop, which
 * logs it and leaves the run `picked-up`, so the next cycle refuses it again:
 * a ticket that reads *"picked up, about to start"* for ever, and never
 * starts. Seen live on ivtrends #57 on 2026-09-01, the first ordinary ticket
 * filed on a project since the box became the default on 2026-08-22 — every
 * run in between was a step of an initiative, and a step enters at `planning`,
 * which does own a branch.
 *
 * The branch is what a clone is told to check out, and a stage that owns none
 * wants the project's default branch — which is where a clone stands when it
 * is told nothing. So the honest request is "clone the project, name no
 * branch", not "no workspace at all".
 */
export function workspaceFor(
  pin: TimonePin | undefined,
  project: TicketingProject,
  branch: string | undefined,
): { workspace?: WorkspaceInput } {
  if (pin === undefined) return {};
  return {
    workspace: {
      timone: pin,
      project,
      ...(branch === undefined ? {} : { branch }),
    },
  };
}

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

/** Reduce an error to one readable line. */
function oneLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0];
}

/**
 * The wait a claimed run goes back to when its session never starts — its own
 * wait, as the ledger recorded it, so a released run is indistinguishable from
 * one that was never claimed.
 *
 * Exported because two callers put a run back on the wait it already had:
 * `startStepSession` when a session's start throws, and `timone takeover`
 * when it gives a run back. Two copies of that shape would be two places for
 * the next field on a wait to be forgotten.
 *
 * The fallback text is unreachable in practice: parking names what a run waits
 * for, so a parked run has one. It is here so that releasing a claim can never
 * be the thing that throws.
 */
export function waitOf(run: Run): ParkOptions {
  return {
    waitingOn: run.wait?.on ?? "a human",
    ...(run.wait?.kind === undefined ? {} : { kind: run.wait?.kind }),
    ...(run.stage === undefined ? {} : { stage: run.stage }),
    ...(run.wait?.opened === undefined ? {} : { waitCursor: run.wait?.opened }),
  };
}

/** Whether `stage` is one the prompts module knows how to instruct. */
export function isPrompted(
  stage: PipelineStage,
): stage is (typeof PROMPTED_STAGES)[number] {
  return (PROMPTED_STAGES as readonly string[]).includes(stage);
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
export const agentSdkRuntime: SessionRuntime = agentSdkRuntimeWith(query);

/**
 * The SDK's `query`, as {@link agentSdkRuntimeWith} uses it: options in, a
 * stream of messages out. The real one returns more than this, and nothing
 * here needs the rest.
 */
export type QueryFunction = (params: {
  prompt: string;
  options?: Options;
}) => AsyncIterable<SDKMessage>;

/**
 * {@link agentSdkRuntime}, with the `query` it starts sessions through handed
 * in, so a test can read the options a session is started with without
 * starting one.
 */
export function agentSdkRuntimeWith(query: QueryFunction): SessionRuntime {
  return {
    async start(request: SessionRequest): Promise<StartedSession> {
      // What a cancellation pulls (ADR-0047). The SDK's own `interrupt` needs a
      // streaming input this runtime does not use, and abandoning the iterator
      // would leave the session running inside the daemon's own process — so
      // the controller is the one thing here that really ends the work.
      const controller = new AbortController();
      // The guard on this session's pushes (#85): its `git push` reaches the
      // run's work branch and nothing else, and its `gh` cannot merge or
      // write to another branch through the forge. A fresh directory per
      // session, because two sessions may run at once for different
      // branches. Under `.timone/`, which is never committed.
      const guardRoot = join(request.cwd, ".timone", "push-guard");
      mkdirSync(guardRoot, { recursive: true });
      const guardDir = mkdtempSync(join(guardRoot, "session-"));
      const guardEnv = installPushGuard(guardDir, {
        cli: join(request.cwd, "dist", "cli.js"),
        ...(request.workBranch === undefined ? {} : { workBranch: request.workBranch }),
      });
      const session = query({
        prompt: request.prompt,
        options: {
          abortController: controller,
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
          // The SDK hands the CLI exactly this, not this on top of its own
          // environment, so the rest of the daemon's is spread in first.
          // The guard's `gh` goes first on `PATH`, so the `gh` the session
          // runs is the one that checks every call (#85).
          env: {
            ...process.env,
            ...guardEnv,
            PATH: `${forgeGuardBin(guardDir)}${delimiter}${process.env.PATH ?? ""}`,
          },
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
              lastApiError = apiErrorFrom(message);
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
        } finally {
          rmSync(guardDir, { recursive: true, force: true });
        }
      })();

      return {
        sessionId: await sessionId,
        completed,
        progress,
        stop: () => controller.abort(),
      };
    },
  };
}
