import {
  CONVERSATION_RECORD_MARKER,
  MACHINE_MARKER,
  type TicketingProject,
  type TicketThread,
} from "../adapters/ticketing.js";
import { takeoverCommand } from "../channels/terminal.js";
import type { Classification } from "./pipeline.js";

/** The stages that have a prompt. Extended as stages are built. */
export const PROMPTED_STAGES = [
  "triage",
  "clarification",
  "requirements",
] as const;

export interface PromptContext {
  project: TicketingProject;
  ticket: TicketThread;
  /** What triage decided, once it has. */
  classification?: Classification;
  /** The human's words, when a gate sent this stage back to redo its work. */
  feedback?: string;
  /** The work branch this run owns, at the stages that own one. */
  branch?: string;
  /** True when a human opened this session themselves and is waiting in it. */
  interactive?: boolean;
}

/**
 * The ticket, its thread, and who said what.
 *
 * The attribution is the part that matters: Timone posts through the human's
 * GitHub account, so both voices carry the same login and only the marker
 * tells them apart. A session that cannot do that reads its own earlier
 * output as the human's instructions.
 */
function ticketBlock(context: PromptContext): string {
  const { project, ticket } = context;

  const thread =
    ticket.comments.length === 0
      ? "(no replies yet)"
      : ticket.comments
          .map((comment) => {
            const who = comment.fromTimone
              ? "Timone (you), earlier"
              : `${comment.author} (a person)`;
            return `--- ${who}, at ${comment.createdAt} ---\n${comment.body}`;
          })
          .join("\n\n");

  return [
    `Project: ${project.name} — touch only \`projects/${project.name}/…\`.`,
    `Ticket: #${ticket.number} — ${ticket.title}`,
    `URL: ${ticket.url}`,
    `Filed by: ${ticket.author}`,
    "",
    "--- the ticket, in the words it was written in ---",
    ticket.body,
    "--- end of ticket ---",
    "",
    "Replies so far, oldest first. Timone posts under the same account as the",
    "human, so the author name does not tell you apart from them — the labels",
    "below do:",
    "",
    thread,
  ].join("\n");
}

/** Where the session is running, and what it may assume it remembers. */
function reentryBlock(): string {
  return [
    "You are running at the timone root. Follow `process.md` and `CLAUDE.md`.",
    "",
    "**You have no memory of any earlier session on this ticket — nothing was carried over.**",
    "Rebuild what you need from the committed artifacts and the thread above.",
    "If that is not enough to continue, the artifacts are what is deficient —",
    "say so rather than guessing.",
  ].join("\n");
}

/** How the session must write, and how it must sign what it posts. */
function writingBlock(): string {
  return [
    "Write anything you post for someone who knows nothing about this process:",
    "no stage numbers, no skill names, no process jargon. End every message to",
    "them with one explicit line saying what, if anything, you need from them.",
    "",
    "**Every comment you post on the ticket must start with this exact line,**",
    "followed by a blank line, `---` and a blank line, then your text. You are",
    "posting through a person's GitHub account: without it the thread reads as",
    "though they wrote your words, and neither they nor a later session can tell",
    "your output from theirs.",
    "",
    MACHINE_MARKER,
  ].join("\n");
}

/** The human's words, when a gate sent this stage back to do it again. */
function feedbackBlock(feedback: string | undefined): string {
  if (feedback === undefined || feedback.trim() === "") return "";

  return [
    "",
    "**You have done this stage before, and they asked for a change.** This is",
    "what they said, in their words:",
    "",
    "--- what they replied ---",
    feedback,
    "--- end of reply ---",
    "",
    "Do the stage again with that in hand. Do not defend the previous version,",
    "and do not ask them to repeat themselves.",
    "",
  ].join("\n");
}

/**
 * Build the instruction a session at `stage` starts from.
 *
 * Prompts are data here, not strings built at the call site, so their rules
 * are assertable: every one of them carries the ticket verbatim, separates
 * the voices, re-enters statelessly, and signs what it posts. A prompt that
 * skips one of those is a session that misreads the thread or leaves the
 * human unable to tell who is talking.
 */
export function stagePrompt(
  stage: (typeof PROMPTED_STAGES)[number],
  context: PromptContext,
): string {
  switch (stage) {
    case "triage":
      return triagePrompt(context);
    case "clarification":
      return clarificationPrompt(context);
    case "requirements":
      return requirementsPrompt(context);
  }
}

/**
 * The work branch a ticket's run owns, from the requirements stage on.
 *
 * Named from the ticket rather than from the phase, because at this point
 * there is no phase yet — and a human scanning branches should be able to
 * tell which ticket each one belongs to without opening it.
 */
export function workBranch(ticket: TicketThread): string {
  const slug = ticket.title
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return `timone/${ticket.number}${slug === "" ? "" : `-${slug}`}`;
}

/**
 * Stage 3: write down what is being asked for, and commit it where the human
 * can read it.
 *
 * The order here — commit, then gate — is [PRD-02.R4](../../doc/specs/prd/prd-02-inversion-of-control.criteria.md)'s,
 * and it differs from `process.md` stage 3's "approve the list before files
 * are written". On a work branch the cost of writing first is a branch nobody
 * merges, and what the human then reviews is the real criteria register
 * rather than a paraphrase of it. The divergence is deliberate and recorded;
 * see the phase-12 completion report.
 */
function requirementsPrompt(context: PromptContext): string {
  const { ticket, branch } = context;

  return [
    `Write down what ticket #${ticket.number} on **${context.project.name}** is asking for.`,
    "",
    ticketBlock(context),
    feedbackBlock(context.feedback),
    "",
    reentryBlock(),
    "",
    `**Work on the branch \`${branch ?? "the run's work branch"}\`**, cut from the`,
    "project's default branch — create it if it does not exist, and do all of",
    "this stage's work there. Nothing goes on the default branch.",
    "",
    "Run stage 3 for this ticket. Its input is what the thread above already",
    "settled — the conversation record is the agreed statement of the problem,",
    "and re-asking what it answers wastes the human's time. Where the record is",
    "silent and the requirement cannot be written testably, say so plainly in",
    "your summary rather than inventing an answer.",
    "",
    "**Commit the PRD pair on that branch and push it.** Committed and pushed",
    "are not the same claim: a commit that exists only here is invisible to the",
    "person who has to read it, and this stage is not finished until it is on",
    "the remote.",
    "",
    "Then post one comment on the ticket summarizing, in plain words, what you",
    "understood they want — the substance, not a file listing. Do **not** ask",
    "them to approve it and do not invent an approval instruction: the",
    "machinery posts the approval request itself, immediately after yours, and",
    "two different sets of instructions would tell them two different things.",
    "",
    writingBlock(),
    "",
    "Then stop.",
  ].join("\n");
}

/** Stage 1: work out what kind of request this is, and record it. */
function triagePrompt(context: PromptContext): string {
  const { ticket } = context;

  return [
    `A ticket was filed on the managed project **${context.project.name}** and marked for Timone.`,
    "",
    ticketBlock(context),
    feedbackBlock(context.feedback),
    "",
    reentryBlock(),
    "",
    "**This request has not been classified.** Classify it yourself by running",
    "stage 1 on the raw text above — do not assume what kind of request it is,",
    "and do not act on it beyond classifying it.",
    "",
    "Record the outcome the way the process requires: the classification and its",
    `rationale as a comment on ticket #${ticket.number}, and a \`triage:<kind>\` label`,
    "on the issue.",
    "",
    writingBlock(),
    "",
    "Then stop. Whatever should happen next is started for you once the",
    "classification is on the ticket.",
  ].join("\n");
}

/**
 * Stage 2: the interview.
 *
 * Always an interactive session — the daemon never runs this one, because
 * the work *is* the conversation and a conversation needs someone present.
 */
function clarificationPrompt(context: PromptContext): string {
  const { ticket, classification } = context;

  return [
    `You are resuming work on the managed project **${context.project.name}**.`,
    "A human has just opened this session by running",
    `\`${takeoverCommand(context.project.name, ticket.number)}\`.`,
    "**They are at the keyboard now, waiting for you.** This is a conversation, not a batch job.",
    "",
    ticketBlock(context),
    feedbackBlock(context.feedback),
    "",
    reentryBlock(),
    "",
    classification === undefined
      ? "This request has been classified already; read the thread for what was decided."
      : `This request was classified as a **${classification}**, with the reasoning on the ticket.`,
    "",
    "Run the requirements-discovery stage on it: interview them until every",
    "branch of the decision tree is resolved, one question at a time, each with",
    "a recommended answer, and answer from the codebase anything the codebase",
    "can answer rather than asking. Maintain the project's glossary as you go,",
    "exactly as that stage requires.",
    "",
    "The human knows nothing about this process.",
    "**Never ask them to name a stage, a skill, or a process concept**, and never",
    "make them repeat something the ticket already says.",
    "",
    "When every branch is resolved, summarize what you agreed — decisions and",
    "risks — and ask them, in plain words, whether that summary is right. If",
    "they accept it, post it to the ticket as the record, starting the comment",
    "with the machine line below, then a blank line, then this exact line:",
    "",
    CONVERSATION_RECORD_MARKER,
    "",
    "That line is how the machinery knows the two of you finished; without it",
    "this ticket will sit waiting for a conversation that already happened.",
    "",
    "**If they leave without accepting the summary, post nothing carrying that",
    "line.** Say on the ticket that the conversation is unfinished and what is",
    "still open, and change nothing else — an unaccepted conversation decided",
    "nothing.",
    "",
    "The conversation itself is not a process artifact: nothing may cite it,",
    "and no transcript is kept. What survives is the summary on the ticket and",
    "whatever the glossary gained.",
    "",
    writingBlock(),
  ].join("\n");
}

/**
 * The one line the ticket shows about a conversation before it happens.
 * Written from the ticket's own title, because that is what the human wrote
 * and the only thing the machinery knows before the interview.
 */
export function conversationSubject(ticket: TicketThread): string {
  return (
    `Before I write down what "${ticket.title}" actually needs, there are a ` +
    "few things I want to check with you — the kind of thing that's quicker " +
    "talked through than typed back and forth."
  );
}

/**
 * The prompt for a session a human opened themselves with `timone takeover`.
 *
 * The same stage prompt the daemon would use: which side started the session
 * changes who is waiting, not what the stage is.
 */
export function takeoverPrompt(
  project: string,
  stage: (typeof PROMPTED_STAGES)[number],
  ticket: TicketThread,
): string {
  return stagePrompt(stage, {
    project: { name: project, repoUrl: "" },
    ticket,
    interactive: true,
  });
}
