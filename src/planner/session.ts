import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

import { technicalFault } from "../daemon/faults.js";
import type { Run } from "../daemon/runs.js";
import { apiErrorFrom } from "../daemon/session.js";
import { appendEntry } from "../runner/record.js";
import {
  RUNNER_EFFORT,
  RUNNER_MODEL,
  RUNNER_RETRY_WAITS_MS,
  RUNNER_TIMEOUT_MS,
  type RunQuery,
} from "../runner/session.js";
import { plannerActions, type PlannerActionDeps } from "./actions.js";
import { buildPlannerBrief } from "./brief.js";
import { waitsForPlanner } from "./driver.js";
import type { PlannerFacts } from "./facts.js";
import { PLANNER_SERVER_NAME, plannerToolServer, qualifiedPlannerToolNames } from "./tools.js";

/**
 * The planner's session: one fresh session for each decision
 * ([ADR-0065](../../doc/adr/0065-the-planner-is-a-session-of-its-own-asked-when-a-build-would-start.md)
 * D1, D3).
 *
 * **The planner can only act through its four tools.** The session is given
 * no built-in tool, one tool server, and a list of allowed tools that holds
 * only that server's tools, as the runner's is. It reads no code and changes
 * no file.
 *
 * **Its cost is written into the record of the ticket it decided for**,
 * whatever the session's end, so it counts on that ticket's spending limit
 * like any other session.
 */

/**
 * How far one session may go. A decision reads the brief, perhaps a plan or
 * two, and makes one call; a session that needs more than 12 turns or $2 is
 * going round in circles.
 */
export const PLANNER_MAX_TURNS = 12;
export const PLANNER_MAX_BUDGET_USD = 2;

/** What one decision needs: the deps of the planner's actions, and the SDK's `query`. */
export type DecideDeps = PlannerActionDeps & { runQuery: RunQuery };

/**
 * How one session ended.
 *
 * - `ended` — the session ran to its end. What the planner decided, if
 *   anything, is in the ledger and the record, as its actions wrote it.
 * - `failed` — it did not. `retry` says whether trying again soon can help:
 *   only when the model could not be reached.
 */
export type DecideEnd =
  | { kind: "ended"; costUsd: number }
  | { kind: "failed"; retry: boolean; costUsd: number; error: string };

/**
 * The planner's working directory: an empty folder of its own under the
 * Timone root, for the runner's reason — the session must not start inside
 * a managed project (ADR-0007), or inside Timone's own files.
 */
function plannerDirectory(root: string): string {
  const path = join(root, ".timone", "planner");
  mkdirSync(path, { recursive: true });
  return path;
}

/**
 * Run one planner session deciding `run`, with `facts`: the brief, the
 * `planner` tool server, and the bounds above. Writes `planner-ended` with
 * the session's cost into the ticket's record, however it ended.
 *
 * **It never throws for a session that fails.** A session that ends with no
 * decision leaves the run waiting for the planner, as it was.
 */
export async function decide(deps: DecideDeps, run: Run, facts: PlannerFacts): Promise<DecideEnd> {
  const server = plannerToolServer(plannerActions(deps, run, facts));
  const brief = buildPlannerBrief(facts);
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, RUNNER_TIMEOUT_MS);
  const end = await converse(deps, brief, server, controller).finally(() => clearTimeout(timer));
  const ended: DecideEnd = timedOut ? tookTooLong(end.costUsd) : end;
  appendEntry(deps.root, deps.project.name, run.ticket, {
    kind: "planner-ended",
    at: deps.clock(),
    runId: run.id,
    ok: ended.kind === "ended",
    costUsd: ended.costUsd,
    ...(ended.kind === "failed" ? { error: ended.error } : {}),
  });
  return ended;
}

/**
 * Run the session to its end, or to its failure. Never throws: an SDK that
 * throws is a failed session, and what it cost is kept.
 */
async function converse(
  deps: DecideDeps,
  brief: { system: string; prompt: string },
  server: ReturnType<typeof plannerToolServer>,
  controller: AbortController,
): Promise<DecideEnd> {
  let result: ResultMessage | undefined;
  // The main thread's last word, when that word was an API error.
  let lastApiError: string | undefined;
  try {
    const session = deps.runQuery({
      prompt: brief.prompt,
      options: {
        model: RUNNER_MODEL,
        effort: RUNNER_EFFORT,
        systemPrompt: brief.system,
        tools: [],
        mcpServers: { [PLANNER_SERVER_NAME]: server },
        allowedTools: qualifiedPlannerToolNames(),
        settingSources: [],
        cwd: plannerDirectory(deps.root),
        maxTurns: PLANNER_MAX_TURNS,
        maxBudgetUsd: PLANNER_MAX_BUDGET_USD,
        abortController: controller,
      },
    });
    for await (const message of session) {
      const assistant = assistantMessage.safeParse(message);
      if (assistant.success && assistant.data.parent_tool_use_id === null) {
        lastApiError = apiErrorFrom(assistant.data);
      }
      const parsed = resultMessage.safeParse(message);
      if (parsed.success) result = parsed.data;
    }
  } catch (error) {
    // As for the runner: the SDK throws when it cannot reach the model, and
    // that is what trying again is for. A refused login is refused again.
    const text = oneLine(error);
    return {
      kind: "failed",
      retry: technicalFault(text) !== "credentials",
      costUsd: result?.total_cost_usd ?? 0,
      error: text,
    };
  }
  if (result === undefined) {
    return { kind: "failed", retry: false, costUsd: 0, error: "the session ended with no result" };
  }
  const costUsd = result.total_cost_usd ?? 0;
  const error = failureOf(result, lastApiError);
  if (error === undefined) return { kind: "ended", costUsd };
  const fault = technicalFault(error);
  const retry = !REACHED_A_CAP.includes(result.subtype) && (fault === "link" || fault === "expired");
  return { kind: "failed", retry, costUsd, error };
}

/** A session stopped because it ran too long. It reached the model, so it is not tried again soon. */
function tookTooLong(costUsd: number): DecideEnd {
  return {
    kind: "failed",
    retry: false,
    costUsd,
    error: `the session ran for ${RUNNER_TIMEOUT_MS / 60_000} minutes, and was stopped`,
  };
}

/** The result subtypes of a session that stopped at one of its caps. */
const REACHED_A_CAP: readonly string[] = ["error_max_turns", "error_max_budget_usd"];

/**
 * What went wrong in a session that ended with `result`, or undefined when
 * nothing did. A `success` is not proof on its own: the model's last word
 * may be an API error.
 */
function failureOf(result: ResultMessage, lastApiError: string | undefined): string | undefined {
  if (lastApiError !== undefined) return `the session stopped on an API error (${lastApiError})`;
  if (result.subtype !== "success") {
    const errors = result.errors ?? [];
    return errors.length === 0 ? result.subtype : `${result.subtype}: ${errors.join("; ")}`;
  }
  if (result.is_error === true) {
    return result.result ?? "the session reported success but flagged itself as an error";
  }
  return undefined;
}

/** An SDK message from the model, as far as the planner reads it. */
const assistantMessage = z.object({
  type: z.literal("assistant"),
  parent_tool_use_id: z.string().nullable(),
  error: z.string().optional(),
  message: z.object({ content: z.unknown() }).optional(),
});

/** The SDK's last message of a session: how it ended and what it cost. */
const resultMessage = z.object({
  type: z.literal("result"),
  subtype: z.string(),
  is_error: z.boolean().optional(),
  total_cost_usd: z.number().nonnegative().optional(),
  errors: z.array(z.string()).optional(),
  result: z.string().optional(),
});

type ResultMessage = z.infer<typeof resultMessage>;

/** Reduce an error to its first line. */
function oneLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0] ?? message;
}

/** What the planner's sessions need from outside: everything but the project, which each run names. */
export interface PlannerSessionDeps extends Omit<PlannerActionDeps, "project"> {
  runQuery: RunQuery;
  log: (message: string) => void;
}

/**
 * The planner's sessions, for every project.
 *
 * **At most one session per project at a time** (D1): a session asked for
 * while one of the same project runs is not started. The run still waits
 * for the planner, so the next cycle asks again.
 *
 * **A model that cannot be reached is tried again** as the runner is: after
 * 60 seconds, then 5 minutes. After the third try the session ends, the run
 * still waits, and the next cycle tries again.
 */
export class PlannerSessions {
  private readonly deps: PlannerSessionDeps;
  /** The projects with a session running now. */
  private readonly busy = new Set<string>();

  constructor(deps: PlannerSessionDeps) {
    this.deps = deps;
  }

  /** Decide `run` with `facts`, unless a session of its project runs already. */
  async decide(run: Run, facts: PlannerFacts): Promise<void> {
    if (this.busy.has(run.project)) {
      this.deps.log(`planner ${run.id} — a session of ${run.project} is running, so none is started`);
      return;
    }
    const config = this.deps.manifest.projects[run.project];
    if (config === undefined) {
      throw new Error(`project "${run.project}" is not in the manifest, so its planner cannot run`);
    }
    this.busy.add(run.project);
    try {
      const deps: DecideDeps = { ...this.deps, project: { name: run.project, repoUrl: config.repo_url } };
      for (let tried = 0; ; tried += 1) {
        const end = await decide(deps, run, facts);
        if (end.kind === "ended" || !end.retry) return;
        const wait = RUNNER_RETRY_WAITS_MS[tried];
        if (wait === undefined) break;
        await new Promise((resolve) => setTimeout(resolve, wait));
        const current = this.deps.store.get(run.id);
        if (current === undefined || !waitsForPlanner(current)) return;
      }
      this.deps.log(`planner ${run.id} — the model could not be reached after three tries; the next cycle tries again`);
    } finally {
      this.busy.delete(run.project);
    }
  }
}
