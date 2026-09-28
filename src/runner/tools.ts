import {
  createSdkMcpServer,
  tool,
  type McpSdkServerConfigWithInstance,
  type SdkMcpToolDefinition,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import { PIPELINE_STAGES } from "../daemon/pipeline.js";
import type { ActionResult, RunnerActions } from "./actions.js";

/**
 * The runner's tools: one per action, and nothing else
 * ([ADR-0060](../../doc/adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md),
 * PRD-05 R2).
 *
 * **This list is the whole of what the runner can do.** It has no tool that
 * edits a file, runs a command, pushes or merges. Work on the project is done
 * by a step the runner starts, never by the runner itself.
 *
 * **Each input is checked by its zod shape before an action sees it.** What
 * the model sends is the least trusted input in the system; the tool server
 * refuses a call whose input does not fit, and the action is never reached.
 */

/** The server's name, as the SDK prefixes it onto each tool's name. */
export const RUNNER_SERVER_NAME = "runner";

/** The runner's tools, by name, in the order R2 lists them. */
export const RUNNER_TOOL_NAMES = [
  "start_step",
  "message_step",
  "stop_step",
  "post",
  "set_hold",
  "record_approval",
  "file_timone_issue",
  "comment_timone_issue",
  "end_run",
] as const;

export type RunnerToolName = (typeof RUNNER_TOOL_NAMES)[number];

/**
 * The tools' names as the SDK calls them — `mcp__runner__start_step` — for a
 * session's list of allowed tools.
 */
export function qualifiedRunnerToolNames(): string[] {
  return RUNNER_TOOL_NAMES.map((name) => `mcp__${RUNNER_SERVER_NAME}__${name}`);
}

/** Why the runner does this. Every action writes it into the run record. */
const reason = z
  .string()
  .trim()
  .min(1)
  .describe("Why you are doing this, in one or two plain sentences.");

const startStepInput = z.object({
  stage: z
    .enum(PIPELINE_STAGES)
    .describe("The step to start, by its name in the default order."),
  instructions: z
    .string()
    .trim()
    .min(1)
    .describe("What the step must do, in plain words. The step reads these first."),
  reason,
  skipReason: z
    .string()
    .optional()
    .describe(
      "Needed when this step leaves out steps of the default order that have not run: why they are left out.",
    ),
});

const messageStepInput = z.object({
  text: z.string().trim().min(1).describe("What to tell the running step."),
  reason,
});

const stopStepInput = z.object({ reason });

const postInput = z.object({
  where: z
    .enum(["ticket", "pull-request"])
    .describe("Post on the ticket, or on the run's open pull request."),
  body: z
    .string()
    .trim()
    .min(1)
    .describe(
      "The comment. It must end with a line that starts with **What I need from you:** and says what you need, or nothing.",
    ),
  reason,
});

const setHoldInput = z.object({
  on: z.boolean().describe("true puts the hold on the ticket, false takes it off."),
  reason,
});

const recordApprovalInput = z.object({
  what: z
    .enum(["requirements", "pieces"])
    .describe("What was approved: the requirements, or the list of pieces."),
  commentAt: z
    .string()
    .trim()
    .min(1)
    .describe("The time of the named person's comment that gave the approval, exactly as shown."),
  reason,
});

const fileTimoneIssueInput = z.object({
  title: z.string().trim().min(1).describe("A short title that says what went wrong."),
  body: z
    .string()
    .trim()
    .min(1)
    .describe("What was seen, on which ticket, when, and in which session."),
  reason,
});

const commentTimoneIssueInput = z.object({
  number: z.number().int().positive().describe("The number of the open Timone issue."),
  body: z
    .string()
    .trim()
    .min(1)
    .describe("What was seen this time, on which ticket, when, and in which session."),
  reason,
});

const endRunInput = z.object({
  reason,
  closeTicket: z.boolean().describe("true also closes the ticket, as done."),
  stopCommentAt: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe(
      "Only when a named person asked in their own comment to stop the work for good: " +
        "the time of that comment, exactly as shown. The run then ends without a pull request.",
    ),
});

export type StartStepInput = z.infer<typeof startStepInput>;
export type MessageStepInput = z.infer<typeof messageStepInput>;
export type StopStepInput = z.infer<typeof stopStepInput>;
export type PostInput = z.infer<typeof postInput>;
export type SetHoldInput = z.infer<typeof setHoldInput>;
export type RecordApprovalInput = z.infer<typeof recordApprovalInput>;
export type FileTimoneIssueInput = z.infer<typeof fileTimoneIssueInput>;
export type CommentTimoneIssueInput = z.infer<typeof commentTimoneIssueInput>;
export type EndRunInput = z.infer<typeof endRunInput>;

type ToolAnswer = Awaited<ReturnType<SdkMcpToolDefinition["handler"]>>;

/**
 * An action's answer, as the tool hands it back to the runner. A refusal is
 * marked as an error and says so in its first word, so the runner cannot
 * read it as done.
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
 * for the runner. The descriptions are part of what the runner reads, so
 * they are plain words.
 */
export function runnerTools(actions: RunnerActions): SdkMcpToolDefinition<any>[] {
  return [
    tool(
      "start_step",
      "Start one step of the work, with your instructions for it. Only one step runs at a time.",
      startStepInput.shape,
      async (args) => answer(await actions.startStep(args)),
    ),
    tool(
      "message_step",
      "Send a message to the step that is running now.",
      messageStepInput.shape,
      async (args) => answer(await actions.messageStep(args)),
    ),
    tool(
      "stop_step",
      "Stop the step that is running now. You are woken again when it has stopped.",
      stopStepInput.shape,
      async (args) => answer(await actions.stopStep(args)),
    ),
    tool(
      "post",
      "Post a comment on the ticket, or on the run's open pull request.",
      postInput.shape,
      async (args) => answer(await actions.post(args)),
    ),
    tool(
      "set_hold",
      "Put the hold on the ticket, or take it off.",
      setHoldInput.shape,
      async (args) => answer(await actions.setHold(args)),
    ),
    tool(
      "record_approval",
      "Record that a named person approved the requirements or the list of pieces, in their own comment.",
      recordApprovalInput.shape,
      async (args) => answer(await actions.recordApproval(args)),
    ),
    tool(
      "file_timone_issue",
      "File a new issue about a fault in Timone itself.",
      fileTimoneIssueInput.shape,
      async (args) => answer(await actions.fileTimoneIssue(args)),
    ),
    tool(
      "comment_timone_issue",
      "Add a comment to an open issue about a fault in Timone itself.",
      commentTimoneIssueInput.shape,
      async (args) => answer(await actions.commentTimoneIssue(args)),
    ),
    tool(
      "end_run",
      "End this run. A run that changed files waits while its pull request is open. " +
        "End it when the pull request is merged, and close the ticket then, or when it is closed. " +
        "A run that changed nothing can end at any time. " +
        "A run that changed files and has no pull request can also end when a named person asked " +
        "in their own comment to stop the work for good: give the time of that comment in stopCommentAt.",
      endRunInput.shape,
      async (args) => answer(await actions.endRun(args)),
    ),
  ];
}

/** The tool server a runner session is given, named {@link RUNNER_SERVER_NAME}. */
export function runnerToolServer(actions: RunnerActions): McpSdkServerConfigWithInstance {
  return createSdkMcpServer({
    name: RUNNER_SERVER_NAME,
    version: "1.0.0",
    tools: runnerTools(actions),
    // Never deferred behind a tool search: these are the only things the
    // runner can do, and a runner that had to look for them could decide
    // there was nothing it could do.
    alwaysLoad: true,
  });
}
