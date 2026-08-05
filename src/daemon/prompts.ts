import {
  CONVERSATION_RECORD_MARKER,
  MACHINE_MARKER,
  STAGE_DONE_MARKER,
  STAGE_HANDED_MARKER,
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
  "planning",
  "execution",
  "verification",
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
    case "planning":
      return planningPrompt(context);
    case "execution":
      return executionPrompt(context);
    case "verification":
      return verificationPrompt(context);
  }
}

/**
 * Stage 7: check what was built, from a context that did not watch the
 * build.
 *
 * The one prompt built without {@link ticketBlock}, on purpose: the thread
 * holds execution's own account of what it built, and the ticket's prose
 * holds the request in the reporter's framing — both are exactly what stage
 * 7's independence excludes. The criteria register on the branch is the only
 * authority on expected behaviour, and the skill's closed read list does the
 * rest. Statelessness (ADR-0013) makes the fresh context free; this function
 * is about what the prompt *withholds*.
 */
function verificationPrompt(context: PromptContext): string {
  const { ticket, branch } = context;

  return [
    `Check what was just built for ticket #${ticket.number} on **${context.project.name}**,`,
    "**without having watched it being built.**",
    "",
    `Project: ${context.project.name} — touch only \`projects/${context.project.name}/…\`.`,
    feedbackBlock(context.feedback),
    "",
    "You are running at the timone root. Follow `process.md` and `CLAUDE.md`.",
    "",
    "**You have no memory of any earlier session on this ticket — nothing was carried over.**",
    "And that is deliberate: this stage checks observable behaviour from a",
    "context that did not watch the build. This prompt carries neither the",
    "ticket's text nor its thread, and you must not go and read them — the",
    "criteria register is the only authority on what the software should do,",
    "and the stage's own closed read list is the whole of what you may open.",
    "",
    `Work against the branch \`${branch ?? "the run's work branch"}\`. The phase`,
    "to verify is the newest phase file under `doc/plans/phases/` on that",
    "branch; its own status line tells you whether it is yours to verify.",
    "",
    "Run stage 7 on it to the letter: the register's criteria per channel, the",
    "independence rules, the bounded verify-fix loops, the report with its",
    "required elements, and the register flips in the same commit as the",
    "report — on that branch, committed and **pushed**.",
    "",
    outcomeBlock(
      "the pass concluded and the gate passed — every MUST criterion PASS or " +
        "HUMAN-CHECK, zero unresolved regressions, within the loops. Follow it " +
        "with the verdict table in plain words, HUMAN-CHECKs called out.",
      "the pass concluded and the gate did not pass — loops exhausted, or a " +
        "check BLOCKED. Follow it with what failed, the evidence, and where " +
        "the report lives.",
    ),
    "",
    writingBlock(),
    "",
    "Then stop.",
  ].join("\n");
}

/**
 * The two honest endings of an unattended work stage, as instruction text.
 * Shared by every back-half prompt: the closing comment is half of how the
 * daemon judges the stage (the artifact is the other half), so the markers
 * are quoted verbatim rather than described.
 */
function outcomeBlock(done: string, handed: string): string {
  return [
    "Then close with **exactly one comment on the ticket**, and make its first",
    "content line one of these two, exactly as written:",
    "",
    `${STAGE_DONE_MARKER}`,
    "",
    `— ${done}`,
    "",
    `${STAGE_HANDED_MARKER}`,
    "",
    `— ${handed}`,
    "",
    "That line is how the machinery knows how this ended. A session that posts",
    "neither leaves the ticket looking abandoned, and a session that posts the",
    "first without having done the work asks the machinery to build on nothing.",
  ].join("\n");
}

/**
 * Stage 6: build what the approved phase file says, on the branch that
 * carries it.
 *
 * The prompt names the stamp to check and never claims the check has passed:
 * the artifact is the authority on its own approval (ADR-0014), and a prompt
 * asserting it would let a mis-resumed run build an unapproved plan on the
 * daemon's say-so.
 */
function executionPrompt(context: PromptContext): string {
  const { ticket, branch } = context;

  return [
    `Build what was planned for ticket #${ticket.number} on **${context.project.name}**.`,
    "",
    ticketBlock(context),
    feedbackBlock(context.feedback),
    "",
    reentryBlock(),
    "",
    `**Stay on the branch \`${branch ?? "the run's work branch"}\`** — the`,
    "requirements and the phase file this run produced are committed there, and",
    "the code goes on the same branch, never a new one ([ADR-0015](doc/adr/0015-branch-per-driving-unit.md)).",
    "",
    "What to build is the newest phase file under `doc/plans/phases/` on that",
    "branch, and **its own `Status:` line is the authority on whether you may",
    "build it**: run stage 6 on it only if it is stamped",
    "`Approved for execution`. Anything else — stop, say so on the ticket, and",
    "treat nothing in this prompt as permission.",
    "",
    "Run stage 6 to the letter: slices in dependency order, the TDD loop at the",
    "declared seams, one commit per sub-phase after its validation passes,",
    "handoffs and the completion report where the stage requires them, and",
    "**push everything you commit**. When the phase is done, flip the phase",
    "file's `Status:` line to `Complete — see <report>`, exactly as the stage",
    "requires — that flip is half of how the machinery reads your outcome.",
    "",
    outcomeBlock(
      "every slice landed and validated. Follow it with a plain-words account " +
        "of what was built and where it lives.",
      "you stopped inside the stage's own bounds — a slice failed twice, the " +
        "plan cannot execute as written. Follow it with which step failed and " +
        "both attempts, in words a person can act on.",
    ),
    "",
    writingBlock(),
    "",
    "Then stop.",
  ].join("\n");
}

/** A human's approval of a gate, as the artifact must record it. */
export interface RecordedApproval {
  /** The stage whose artifact the approval belongs to. */
  stage: (typeof PROMPTED_STAGES)[number];
  /** Who approved, as the ticket recorded them. */
  by: string;
  /** When, as the ticket recorded it. */
  at: string;
}

/** What each gated stage's artifact must say once the human has approved it. */
const APPROVAL_RECORD: Partial<
  Record<(typeof PROMPTED_STAGES)[number], { artifact: string; what: string }>
> = {
  requirements: {
    artifact: "the PRD pair under `doc/specs/prd/`",
    what: "set the PRD's status to Active, as stage 3's closing gate requires",
  },
  planning: {
    artifact: "the phase file under `doc/plans/phases/`",
    what:
      "replace its `Status:` line with `Approved for execution by <who> <date>`, " +
      "which is the written trace of stage 5's gate and the thing stage 6 " +
      "refuses to start without",
  },
};

/**
 * The instruction for the short session that writes an approval into the
 * artifact it belongs to.
 *
 * The approval happens on the ticket, but the artifact is the record
 * (ADR-0006), and a gate whose outcome lives only in a comment thread is a
 * gate the next stage cannot see. This is what turns a reply into the stamp
 * the process reads.
 */
export function approvalRecordPrompt(
  approval: RecordedApproval,
  context: PromptContext,
): string {
  const spec = APPROVAL_RECORD[approval.stage];

  return [
    `**${approval.by} approved this on ${approval.at}.** Record that, and nothing else.`,
    "",
    ticketBlock(context),
    "",
    reentryBlock(),
    "",
    `Work on the branch \`${context.branch ?? "the run's work branch"}\`. In`,
    `${spec?.artifact ?? "the artifact this stage produced"}: ${spec?.what ?? "record the approval"},`,
    `naming ${approval.by} and the date ${approval.at}. Commit and **push** it.`,
    "",
    "That is the whole task. Do not revise the artifact's content, do not start",
    "the next stage, and do not comment on the ticket — the approval was given,",
    "not requested, and the machinery says what happens next.",
  ].join("\n");
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
 * The order here — commit, then gate — is [ADR-0014](../../doc/adr/0014-artifact-first-gates.md)'s,
 * and the skill this prompt drives now says the same thing. It did not always:
 * both skills used to gate before writing, and the disagreement between that
 * and PRD-02.R4 was settled by grilling it rather than by whichever session
 * happened to read which instruction first.
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
    "**Commit the PRD pair on that branch and push it**, with the narrative",
    "stamped `Draft`. Writing before the approval is correct and is what the",
    "stage now asks for — the human approves the committed register, not a",
    "paraphrase of it. Committed and pushed are not the same claim: a commit",
    "that exists only here is invisible to the person who has to read it, and",
    "this stage is not finished until it is on the remote.",
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
 * Stage 5: cut the approved requirements into a phase of thin vertical
 * slices, on the same branch, gated exactly as the requirements were.
 */
function planningPrompt(context: PromptContext): string {
  const { ticket, branch } = context;

  return [
    `Plan the work for ticket #${ticket.number} on **${context.project.name}**.`,
    "",
    ticketBlock(context),
    feedbackBlock(context.feedback),
    "",
    reentryBlock(),
    "",
    `**Stay on the branch \`${branch ?? "the run's work branch"}\`** — the approved`,
    "requirements are already committed there, and they are what you are",
    "planning against. Read them; do not re-derive them from this ticket.",
    "",
    "Run stage 5 for this ticket. If the planned work implies a significant",
    "decision nobody has written down, stop and record that decision first —",
    "stage 4 exists for exactly that, and a plan resting on an undocumented",
    "choice is a plan nobody can review.",
    "",
    "**Commit the phase file on that branch and push it.** Stamp its `Status:`",
    "line `Awaiting approval` — the human has not approved it yet, and a file",
    "claiming otherwise would let the next stage start on nobody's authority.",
    "Writing the file before the approval is correct and is what the stage now",
    "asks for: the human judges the real plan, with its seams and its",
    "validation blocks, not a summary of one that does not exist yet.",
    "",
    "Then post one comment on the ticket describing, in plain words, what you",
    "propose to build and in what order — the shape of the work, not a list of",
    "file names. Do **not** ask them to approve it: the machinery posts the",
    "approval request itself, immediately after yours.",
    "",
    writingBlock(),
    "",
    "Then stop.",
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
