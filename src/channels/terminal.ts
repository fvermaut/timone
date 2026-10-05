import { NEEDED_FROM_YOU } from "../adapters/ticketing.js";
import { isQuestion } from "../daemon/outcomes.js";

/**
 * The command that opens a ticket in the person's own terminal.
 *
 * One argument, `<project>#<ticket>` — the two things the human already has
 * in front of them. The command finds the ticket's run in the ledger; naming
 * a stage or a skill is never asked of them.
 *
 * ✏ 2026-09-30: the terminal channel that invited a person into a
 * conversation, and the conversation seam in `conversation.ts`, were deleted.
 * Nothing had started a conversation through them since the old code between
 * steps was removed. This command is what is left, and `prompts.ts` uses it.
 */
export function takeoverCommand(project: string, ticket: number): string {
  return `timone takeover ${project}#${ticket}`;
}

/**
 * The sentence that tells a person both ways to answer a question
 * (PRD-09 R1): in writing on the ticket, or by running the takeover command
 * in their terminal. The command is in code formatting with nothing else
 * inside, so it can be copied as it is (R2).
 */
export function twoWaysToAnswer(project: string, ticket: number): string {
  return (
    "You can answer here in writing, or in your terminal by running " +
    `\`${takeoverCommand(project, ticket)}\`.`
  );
}

/**
 * `body` with the sentence of `twoWaysToAnswer` on its own line, above the
 * last line holding `**What I need from you:**`, with a blank line between.
 * A message that is not a question (`isQuestion`), or that already holds the
 * exact command in code formatting, is returned as it was.
 *
 * That last line is left as it was, so what `askedFor` reads off it, and the
 * wait the run shows in `timone status`, do not change (R2).
 */
export function withTwoWaysToAnswer(body: string, project: string, ticket: number): string {
  if (!isQuestion(body) || body.includes(`\`${takeoverCommand(project, ticket)}\``)) return body;
  const at = body.lastIndexOf(NEEDED_FROM_YOU);
  const lineStart = body.lastIndexOf("\n", at) + 1;
  return `${body.slice(0, lineStart)}${twoWaysToAnswer(project, ticket)}\n\n${body.slice(lineStart)}`;
}
