import {
  CLARIFICATION_MARKER,
  CONVERSATION_RECORD_MARKER,
  MACHINE_MARKER,
  STAGE_DONE_MARKER,
  STAGE_HANDED_MARKER,
  type TicketingProject,
  type TicketThread,
} from "../adapters/ticketing.js";
import { takeoverCommand } from "../channels/terminal.js";
import { clarifyingRounds } from "./gates.js";
import type { Classification } from "./pipeline.js";

/** The stages that have a prompt. Extended as stages are built. */
export const PROMPTED_STAGES = [
  "triage",
  "clarification",
  "wayfinding",
  "requirements",
  "planning",
  "execution",
  "verification",
  "delivery",
  "remediation",
] as const;

export interface PromptContext {
  project: TicketingProject;
  ticket: TicketThread;
  /** What triage decided, once it has. */
  classification?: Classification;
  /**
   * The human's words, when they are what resumed this stage: a gate's change
   * request at a gated stage, or the answer they wrote on the ticket at a
   * conversation stage (ADR-0022). One field, because it is one fact — what
   * they said, to the stage that has to act on it — and each prompt frames it
   * for what its own stage was waiting on.
   */
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

/**
 * What every commit this session makes must say about where it came from
 * (ADR-0019).
 *
 * The prompt carries the stage and the run because it is the only place that
 * knows them; the session id arrives separately, from the `SessionStart`
 * hook, because the prompt is built before the SDK has issued one. The two
 * halves meet in the commit message.
 */
function provenanceBlock(stage: string, context: PromptContext): string {
  const { project, ticket } = context;

  return [
    "**Every commit you make in this session must end with these trailers**,",
    "below any `Co-Authored-By:` line:",
    "",
    "```",
    `Timone-Stage: ${stage}`,
    `Timone-Run: ${project.name}#${ticket.number}`,
    "Timone-Session: <the id you were given at the start of this session>",
    "```",
    "",
    "This is what makes the work you do identifiable from git history alone.",
    "An automatic check reports any commit that leaves them off.",
  ].join("\n");
}

/**
 * How this conversation session came to exist, said truthfully.
 *
 * Both openings used to be the first: *"A human has just opened this session
 * by running `timone takeover…`. They are at the keyboard now, waiting for
 * you."* ADR-0022 made that flatly false for a session the **daemon** starts
 * to ingest an answer written on the ticket — and it is the sentence most
 * likely to make such a session behave wrongly, since a session that believes
 * someone is reading along will ask a question and wait for a reply that
 * cannot arrive. Which side started the session changes who is waiting and
 * where the words have to land; it does not change what the stage is.
 */
function conversationOpening(context: PromptContext): string[] {
  const { project, ticket } = context;
  const opening = `You are resuming work on the managed project **${project.name}**.`;

  if (context.interactive === true) {
    return [
      opening,
      "A human has just opened this session by running",
      `\`${takeoverCommand(project.name, ticket.number)}\`.`,
      "**They are at the keyboard now, waiting for you.** This is a conversation, not a batch job.",
    ];
  }

  return [
    opening,
    "**Nobody is reading along as you work.** You were started by the",
    "machinery because they answered this ticket in writing, and everything",
    "you want to say to them has to be posted as a comment on the ticket —",
    "there is no other way for it to reach them, and nothing you leave",
    "unsaid here survives the end of your turn.",
  ];
}

/**
 * The human's written answer to the question this ticket was waiting on, and
 * the bound on what the session may do about it (ADR-0022).
 *
 * Deliberately not {@link feedbackBlock}, though both carry the human's words
 * back into a stage. A gate's feedback is a rejection — "you did this, do it
 * again differently" — and reading a written answer that way would have the
 * session apologise for a document nobody complained about. This is the
 * opposite: they answered a question, and the session's job is to see whether
 * the answer settles it.
 *
 * **The bound is expressed here because here is where it can be.** Whether an
 * answer "settles" the question is the session's judgement and no code's, so
 * nothing downstream can decide it — what is guaranteed instead is that a
 * second unsettled answer produces the takeover rather than a third question,
 * and this block is what guarantees it: the round already spent is read off
 * the thread, and the instruction changes accordingly.
 */
function writtenAnswerBlock(context: PromptContext): string {
  const answer = context.feedback;
  if (answer === undefined || answer.trim() === "") return "";

  const spent = clarifyingRounds(context.ticket);
  const { project, ticket } = context;

  return [
    "",
    "**They have answered this ticket in writing.** This is what they wrote,",
    "in their words — read it as the answer to what this ticket was waiting",
    "on, exactly as you would read a reply given out loud:",
    "",
    "--- what they wrote ---",
    answer,
    "--- end of what they wrote ---",
    "",
    "**Do not ask them again anything it already answers**, and do not make",
    "them repeat themselves. Answer from the codebase whatever the codebase",
    "can answer. If it settles the question, resolve this ticket now.",
    "",
    ...(spent === 0
      ? [
          "If something real is genuinely still open, you may ask **once**, and",
          "only about what is still open — post exactly one comment whose first",
          "content line is this line, exactly as written:",
          "",
          CLARIFICATION_MARKER,
          "",
          "That line is how the machinery knows the one question has been spent.",
          "Then stop and change nothing else. Asking about something they have",
          "already settled, or asking several things at once, wastes the one",
          "question on nothing.",
        ]
      : [
          "**You have already asked once, and this is their answer to that.**",
          "You may not ask a third time. If it still does not settle the",
          "question, say so plainly on the ticket and hand it back — tell them",
          "the rest is quicker talked through, and give them this to run:",
          "",
          "```",
          takeoverCommand(project.name, ticket.number),
          "```",
          "",
          "Then change nothing else. Do not ask them another question in",
          "writing: this ticket has had its written round, and typing at them",
          "again is the failure that bound exists to prevent.",
        ]),
    "",
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
  // Appended here rather than woven into each stage's text: the obligation is
  // the same for all of them, and a per-stage copy is a per-stage chance to
  // forget it. Stages that commit nothing carry it harmlessly.
  return [stageBody(stage, context), "", provenanceBlock(stage, context)].join(
    "\n",
  );
}

/** One stage's own instruction, before the shared obligations are appended. */
function stageBody(
  stage: (typeof PROMPTED_STAGES)[number],
  context: PromptContext,
): string {
  switch (stage) {
    case "triage":
      return triagePrompt(context);
    case "clarification":
      return clarificationPrompt(context);
    case "wayfinding":
      return wayfindingPrompt(context);
    case "requirements":
      return requirementsPrompt(context);
    case "planning":
      return planningPrompt(context);
    case "execution":
      return executionPrompt(context);
    case "verification":
      return verificationPrompt(context);
    case "delivery":
      return deliveryPrompt(context);
    case "remediation":
      return remediationPrompt(context);
  }
}

/**
 * ADR-0016's fix context: act on a review comment the human left on the open
 * pull request.
 *
 * The comment is confirmed intake — the human named the change themselves —
 * and the defect brief at once. The boundary the prompt draws is the ADR's:
 * a fix that would touch the PRD pair or the criteria register is intent,
 * not remediation, and gets a reply instead of a commit.
 */
function remediationPrompt(context: PromptContext): string {
  const { ticket, branch } = context;

  return [
    `A reviewer commented on the open pull request for ticket #${ticket.number} on **${context.project.name}**.`,
    "",
    ticketBlock(context),
    feedbackBlock(context.feedback),
    "",
    reentryBlock(),
    "",
    "The words above under “what they replied” are a **review comment from the",
    "pull request**, and they are your instruction: the human named the change",
    "themselves, which is what authorises acting on it without asking again.",
    "",
    `**Stay on the branch \`${branch ?? "the run's work branch"}\`** — the pull`,
    "request's head. Judge the comment first, and take exactly one of these",
    "three paths:",
    "",
    "- **A concrete change that touches neither the PRD pair nor the criteria",
    "  register** — make it: a focused commit on that branch, messaged",
    "  `fix: review — <slug>`, **pushed**, and a reply on the pull request's",
    "  own thread saying what you did. Nothing else changes — the reports and",
    "  the plan stay as they are; re-checking is the machinery's next move,",
    "  not yours.",
    "- **A comment that would move a requirement** — that is a change of",
    "  intent, and it takes the full path, not a quiet fix. Reply on the pull",
    "  request explaining that, commit nothing.",
    "- **A comment you would have to guess at** — vague, several readings,",
    "  scope beyond this pull request. Ask, in a reply on the pull request,",
    "  and commit nothing.",
    "",
    outcomeBlock(
      "you took one of the three paths to its end — the fix committed and " +
        "pushed with the reply posted, or the reply posted with nothing " +
        "committed. Follow it with which path and why, in one plain sentence.",
      "you could not take any path — the branch is gone, the pull request is " +
        "not what the ticket says, something structural. Follow it with what " +
        "you found.",
    ),
    "",
    writingBlock(),
    "",
    "Then stop.",
  ].join("\n");
}

/**
 * Stage 8: present the finished work for human judgement, as a pull request.
 */
function deliveryPrompt(context: PromptContext): string {
  const { ticket, branch } = context;

  return [
    `Present the finished work for ticket #${ticket.number} on **${context.project.name}** for review.`,
    "",
    ticketBlock(context),
    feedbackBlock(context.feedback),
    "",
    reentryBlock(),
    "",
    `**Stay on the branch \`${branch ?? "the run's work branch"}\`** — it carries`,
    "the verified work, the reports, and everything stage 8 reads.",
    "",
    "Run stage 8 for this phase, to the letter: its entry gates (a phase",
    "stamped complete, a verification report whose gate passed), the two-axis",
    "review as parallel fresh contexts, the delivery report committed on the",
    "branch **before** the pull request opens, and then the pull request",
    `itself — opened **from that branch**, referencing ticket #${ticket.number}, its body`,
    "carrying the scope and the verification outcome as the stage requires.",
    "**Never merge** — merging is the human's act, and the pull request exists",
    "to let them take it.",
    "",
    "Then post one comment on the ticket with a link to the pull request, in",
    "plain words — the ticket links the pull request, the pull request",
    "references the ticket, and a reader starting from either finds the other.",
    "",
    outcomeBlock(
      "the pull request is open with the delivery report committed. Follow it " +
        "with the PR's address and one sentence on what the reviewer will find.",
      "delivery was refused — an entry gate turned it away, or the platform " +
        "would not take the pull request. Follow it with what refused and why.",
    ),
    "",
    writingBlock(),
    "",
    "Then stop.",
  ].join("\n");
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
    "**You are running unattended, and nothing survives the end of your turn.**",
    "Nobody continues this conversation after your last message, and no",
    "notification will ever reach you — so anything you delegate must run to",
    "completion **before you finish**, and ending while \"waiting to be",
    "notified\" of background work is ending with the work undone. This is how",
    "a live delivery once produced nothing: it launched its reviews in the",
    "background and finished, and the reviews died with it.",
    "",
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
    provenanceBlock(`${approval.stage} (recording the approval)`, context),
    "",
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
 * Usually an interactive session, because the work *is* the conversation. The
 * daemon runs it in exactly one case (ADR-0022): the human answered on the
 * ticket in writing, and this session exists to ingest what they wrote. See
 * {@link conversationOpening} for why the difference has to be said out loud.
 */
function clarificationPrompt(context: PromptContext): string {
  const { classification } = context;

  return [
    ...conversationOpening(context),
    "",
    ticketBlock(context),
    writtenAnswerBlock(context),
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
 * Stage 2 at scale: resolve one decision ticket off a wayfinder map
 * (ADR-0010).
 *
 * The shape it has to resist is the interview's. A clarification session
 * ranges over the whole request and hands what it settles to stage 3; this one
 * answers **the single question its ticket holds** and stops, because the
 * ticket is the unit and the destination artifact belongs to the whole map.
 * So the prompt says which ticket, says one per session, and says plainly
 * that writing requirements is not what this is.
 */
function wayfindingPrompt(context: PromptContext): string {
  return [
    ...conversationOpening(context),
    "",
    ticketBlock(context),
    writtenAnswerBlock(context),
    "",
    reentryBlock(),
    "",
    `**This ticket is one decision on a shared map**, charted because the idea`,
    "behind it was too big to settle in one sitting. Its body is the single",
    "question it exists to resolve. Run the at-scale requirements-discovery",
    "stage on it — `timone-wayfind`, working through the map — and follow that",
    "skill's rules for the ticket's own type, which its labels give you.",
    "",
    "**Read the thread above before you ask anything.** They may already have",
    "answered in writing — that is one of the two ways this ticket offered, and",
    "re-asking what they have answered is the failure that path exists to",
    "avoid. Answer from the codebase anything the codebase can answer.",
    "",
    "**One ticket per session.** Resolve this one: post the answer as its",
    "resolution comment, **close** it, and append the one-line gist to the",
    "map's decisions. If the answer is a decision that is hard to reverse or",
    "carries a real trade-off, record it as an ADR at decision time, exactly as",
    "that stage requires — a decision that lives only on a ticket is lost.",
    "",
    "Start the resolution comment with the machine line below, then a blank",
    "line, then this exact line:",
    "",
    CONVERSATION_RECORD_MARKER,
    "",
    "That line is how the machinery knows this decision is settled and the",
    "ticket's journey is over. Without it the question stays open as far as",
    "anything downstream can tell, however plainly you wrote the answer.",
    "",
    "**If nothing was settled, post nothing carrying that line.** Say what is",
    "still open and change nothing else — an unresolved decision is not a",
    "decision, and marking one would close a question nobody answered.",
    "",
    "**Do not write the destination artifact.** No requirements, no PRD, no",
    "phase file, and no application code: the map produces decisions, and what",
    "it is finding its way to gets written once the whole effort closes, not",
    "off a single answer. Tend the map as the skill says — new tickets for fog",
    "the answer sharpened — and stop there.",
    "",
    "The human knows nothing about this process.",
    "**Never ask them to name a stage, a skill, or a process concept**, and never",
    "make them repeat something the ticket already says.",
    "",
    "The conversation itself is not a process artifact: nothing may cite it,",
    "and no transcript is kept. What survives is the resolution on the ticket,",
    "the gist on the map, whatever the glossary gained, and any ADR you wrote.",
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
