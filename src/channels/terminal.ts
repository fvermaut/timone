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
