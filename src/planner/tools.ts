import {
  createSdkMcpServer,
  tool,
  type McpSdkServerConfigWithInstance,
  type SdkMcpToolDefinition,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import type { ActionResult } from "../runner/actions.js";
import type { PlannerActions } from "./actions.js";

/**
 * The planner's tools: one per action, and nothing else
 * ([ADR-0065](../../doc/adr/0065-the-planner-is-a-session-of-its-own-asked-when-a-build-would-start.md)
 * D3).
 *
 * **This list is the whole of what the planner can do.** It reads a plan,
 * and it answers with one decision. It has no tool that reads code, edits a
 * file or starts a step.
 *
 * **Each input is checked by its zod shape before an action sees it**, as
 * the runner's are: what the model sends is the least trusted input there is.
 */

/** The server's name, as the SDK prefixes it onto each tool's name. */
export const PLANNER_SERVER_NAME = "planner";

/** The planner's tools, by name. */
export const PLANNER_TOOL_NAMES = ["let_build", "hold", "pass_to_runner", "read_plan"] as const;

/**
 * The tools' names as the SDK calls them — `mcp__planner__hold` — for a
 * session's list of allowed tools.
 */
export function qualifiedPlannerToolNames(): string[] {
  return PLANNER_TOOL_NAMES.map((name) => `mcp__${PLANNER_SERVER_NAME}__${name}`);
}

/** The ticket the planner decides for, by its number. */
const ticket = z.number().int().positive().describe("The number of the ticket you decide for.");

/** Why the planner decides so, for a person to read. */
const reason = z
  .string()
  .trim()
  .min(1)
  .describe("Why, in one or two plain sentences for a person. Name files by their path.");

/** The time of a named person's comment, exactly as shown. */
const commentAt = z
  .string()
  .trim()
  .min(1)
  .describe("The time of the named person's comment that woke you, exactly as shown.");

const letBuildInput = z.object({
  ticket,
  reason,
  commentAt: commentAt
    .optional()
    .describe(
      "Only when a named person's comment that woke you says to build now: the time of that comment, exactly as shown.",
    ),
});

const holdInput = z.object({
  ticket,
  waitsFor: z
    .array(z.number().int().positive())
    .describe(
      "The tickets this ticket waits for: tickets you were shown as building, with an open pull request, or blocking it.",
    ),
  reason,
});

const passToRunnerInput = z.object({ ticket, commentAt });

const readPlanInput = z.object({
  ticket: z
    .number()
    .int()
    .positive()
    .describe("The ticket whose plan to read: the one you decide for, or one you were shown."),
});

export type LetBuildInput = z.infer<typeof letBuildInput>;
export type HoldInput = z.infer<typeof holdInput>;
export type PassToRunnerInput = z.infer<typeof passToRunnerInput>;
export type ReadPlanInput = z.infer<typeof readPlanInput>;

type ToolAnswer = Awaited<ReturnType<SdkMcpToolDefinition["handler"]>>;

/**
 * An action's answer, as the tool hands it back to the planner. A refusal is
 * marked as an error and says so in its first word.
 */
function answer(result: ActionResult): ToolAnswer {
  if (result.ok) return { content: [{ type: "text", text: result.said }] };
  return {
    content: [{ type: "text", text: `Refused: ${result.refused}` }],
    isError: true,
  };
}

/**
 * One tool per action, each with its input shape and a description written
 * for the planner, in plain words.
 */
export function plannerTools(actions: PlannerActions): SdkMcpToolDefinition<any>[] {
  return [
    tool(
      "let_build",
      "Let the ticket be built now. It starts as soon as a place on the project is free.",
      letBuildInput.shape,
      async (args) => answer(await actions.letBuild(args)),
    ),
    tool(
      "hold",
      "Hold the ticket until the tickets it waits for are merged or closed. The machine tells the ticket why.",
      holdInput.shape,
      async (args) => answer(await actions.hold(args)),
    ),
    tool(
      "pass_to_runner",
      "Pass the named person's comment that woke you to the runner, when it is not about when to build.",
      passToRunnerInput.shape,
      async (args) => answer(await actions.passToRunner(args)),
    ),
    tool(
      "read_plan",
      "Read the whole plan of the ticket you decide for, or of a ticket you were shown.",
      readPlanInput.shape,
      async (args) => answer(await actions.readPlan(args)),
    ),
  ];
}

/** The tool server a planner session is given, named {@link PLANNER_SERVER_NAME}. */
export function plannerToolServer(actions: PlannerActions): McpSdkServerConfigWithInstance {
  return createSdkMcpServer({
    name: PLANNER_SERVER_NAME,
    version: "1.0.0",
    tools: plannerTools(actions),
    // Never deferred behind a tool search, for the runner's reason: these
    // are the only things the planner can do.
    alwaysLoad: true,
  });
}
