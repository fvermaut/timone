import { z } from "zod";

/**
 * The label that marks a ticket as Timone's to touch. It is a permission
 * boundary, not a routing instruction (phase 11's load-bearing decision):
 * its presence says "the daemon may act on this issue", and says nothing
 * about what the issue is — classifying that is stage 1's job.
 */
export const MARK_LABEL = "timone";

/**
 * The header every machine-written comment carries.
 *
 * Timone posts through whatever credentials the machine has, so its comments
 * appear under a person's account. Without this line a thread reads as if the
 * human wrote their own acknowledgements and their own verdicts — and worse,
 * a session reading the thread back cannot tell its own words from theirs,
 * which is exactly what a gate decided by ticket replies must never confuse.
 */
export const MACHINE_MARKER =
  "🤖 **Timone** · automatic message — written by the machine, not by the account it appears under";

/**
 * The line an accepted conversation record carries, under the machine marker.
 *
 * A conversation concludes inside the conversation, but the *record* of it
 * lands on the ticket — and the ticket is the one surface the loop reads
 * ([ADR-0012](../../doc/adr/0012-conversation-channels.md)). This marker is
 * what lets the daemon tell "we agreed this" from everything else a session
 * might post. Matching on prose instead would make the pipeline's advance
 * depend on wording nobody knew was load-bearing.
 */
export const CONVERSATION_RECORD_MARKER =
  "✅ **Agreed** · the record of a conversation, accepted by the human";

/**
 * The line the machine's one clarifying question carries, when a written
 * answer left something unsettled ([ADR-0022](../../doc/adr/0022-a-conversation-ticket-can-be-answered-in-writing.md)).
 *
 * The written path is bounded at **one clarifying round**, and this marker is
 * where that round is counted. It is counted on the *ticket* rather than in
 * the ledger deliberately: the thread already holds the fact — the machine
 * either asked again or it did not — and a counter beside it would be a
 * second copy of one truth, free to disagree with the comments a human is
 * looking at. Read by {@link clarifyingRounds}.
 */
export const CLARIFICATION_MARKER =
  "❓ **Still open** · written by the machine when a written answer left something unsettled";

/**
 * The line a stage's closing comment carries when its work is done and the
 * pipeline may move on. Phase 13's back half runs stages whose sessions do
 * real, fallible work; the daemon judges them by the artifact they owe *and*
 * this record ([phase 13](../../doc/plans/phases/phase-13.md)'s outcome
 * rule, extending ADR-0014 from gates to outcomes) — never by an exit code,
 * which is how a gate once opened over nothing.
 */
export const STAGE_DONE_MARKER =
  "🏁 **Step finished** · written by the machine when a stage completed its work";

/**
 * {@link STAGE_DONE_MARKER}'s sibling for the other honest ending: the stage
 * stopped inside its bounds — a failed slice, an exhausted fix loop — and a
 * person has to look. The comment carrying it is the report R6 requires.
 */
export const STAGE_HANDED_MARKER =
  "🙋 **Needs a person** · written by the machine when a stage stopped and is asking for help";

/**
 * {@link STAGE_HANDED_MARKER}'s stronger sibling: the stage was given an
 * answer and acting on it is outside what that stage may do
 * ([ADR-0033](../../doc/adr/0033-a-stage-that-cannot-act-on-an-answer-escalates.md)).
 *
 * The difference from a handoff is what happens next, and it is the whole
 * reason there are two markers. A handoff waits for a reply and resumes on
 * one. This one has given up on being replied to: the stage already read the
 * answer and was right about it, so another answer buys another pass and the
 * same judgement — five of them, on ivtrends #1.
 */
export const STAGE_ESCALATED_MARKER =
  "🆘 **Needs more than a reply** · written by the machine when a stage cannot act on the answer it was given";

/**
 * The line a session writes when a stop has been cleared and the work goes
 * back to the machinery
 * ([ADR-0035](../../doc/adr/0035-a-resolved-escalation-hands-the-run-back.md)).
 *
 * **{@link STAGE_ESCALATED_MARKER}'s other half.** That one says *a person is
 * needed and no answer will do*; this one says *the person came, we settled
 * it, carry on*. It is the only thing that ends an escalation: not the
 * human's words, which the stage had already read and was right about, but
 * the machine's own record of the session they went through together — the
 * same shape as a conversation record, and read the same way.
 */
export const HANDBACK_MARKER =
  "🔁 **Picking it back up** · written by the machine when a stop has been cleared and the work goes on without you";

/**
 * The line under {@link HANDBACK_MARKER} naming where the work carries on, in
 * the plain words `stageLabel` gives a step — *"Carrying on at: building"*.
 *
 * A line rather than a hidden field: the ticket is the record, and a person
 * reading this thread is owed the same fact the machinery is reading. Absent
 * means *carry on where it stopped*, which is the honest default for a stop
 * cleared without anything being written.
 */
export const HANDBACK_STEP_PREFIX = "Carrying on at:";

/**
 * The line the preview comment carries, so a pull request ends up with one of
 * them rather than one per poll cycle.
 *
 * Unlike its siblings this marker is not just provenance — it is an
 * *identity*. Previews are reconciled every cycle
 * ([ADR-0021](../../doc/adr/0021-previews-are-reconciled-behind-an-adapter-seam.md)),
 * and a preview's URL changes whenever its stack is rebuilt, so the same
 * statement has to be *revised* on a client's pull request rather than
 * repeated. This is what {@link TicketingAdapter.upsertPullRequestComment}
 * matches on to find what it said last time.
 */
export const PREVIEW_MARKER =
  "🔍 **Preview** · a running copy of this pull request, kept up to date by the machine";

/**
 * The line a ticket's standing call to action carries, so a ticket ends up
 * with one of them rather than one per poll cycle.
 *
 * {@link PREVIEW_MARKER}'s kind of marker rather than its siblings': an
 * *identity*, not just provenance. What an open ticket is asking of the human
 * is a standing fact whose truth changes — a blocker closes, a run fails, a
 * stage moves — and [ADR-0024](../../doc/adr/0024-every-open-ticket-answers-for-itself.md)
 * has the daemon repair it every cycle rather than report it. This is what
 * {@link TicketingAdapter.upsertComment} matches on to find what was said
 * last time, and what the poll loop compares against to decide whether
 * anything needs saying at all.
 *
 * It can never change once it has shipped: an edited marker orphans every
 * comment posted under the old one, and the next cycle posts a second call to
 * action beside the first.
 */
export const CTA_MARKER =
  "📌 **Where this stands** · what this ticket needs right now, kept up to date by the machine";

/** Put the machine header on a comment body, unless it already carries one. */
export function stampMachineComment(body: string): string {
  return body.startsWith(MACHINE_MARKER)
    ? body
    : `${MACHINE_MARKER}\n\n---\n\n${body}`;
}

/** True when a comment body was written by Timone rather than by a person. */
export function isMachineComment(body: string): boolean {
  return body.trimStart().startsWith(MACHINE_MARKER);
}

/**
 * True when a comment is Timone's — by its **author** where Timone has an
 * identity, and by {@link MACHINE_MARKER} either way.
 *
 * Two readers, not one replacing the other, and the second is not a
 * transitional courtesy:
 *
 * - **The author** is the honest test now that Timone acts as its own App
 *   ([ADR-0042](../../doc/adr/0042-timone-acts-under-its-own-identity.md)). It
 *   catches a comment the machine wrote through a surface that never went
 *   through {@link stampMachineComment} — a review summary, a merge note —
 *   which the marker alone reads as a human's.
 * - **The marker** stays because every comment Timone wrote before it had an
 *   identity is authored by `fvermaut`. Dropping the fallback would make a
 *   whole backlog of the machine's own questions read as the human's answers,
 *   and the gates that wait for a human reply would fire on them.
 *
 * `machineLogin` is undefined wherever no identity is configured, which
 * leaves exactly the behaviour that shipped before this existed.
 *
 * **The two spellings are one identity.** GitHub renders an App's bot as
 * `timone-agent` on the GraphQL surface — which `gh --json` speaks — and as
 * `timone-agent[bot]` on REST, and this adapter reads both: a ticket thread
 * comes from GraphQL, an inline pull-request comment from REST. Watched on
 * `fvermaut/scratch-app` on 2026-08-22, after a live comment posted under the
 * App's own identity came back as `timone-agent` against a manifest declaring
 * `timone-agent[bot]`. A comparison against one spelling recognises half of
 * Timone's own comments and reads the other half as the human's.
 */
export function isFromTimone(
  comment: { author: string; body: string },
  machineLogin: string | undefined,
): boolean {
  if (
    machineLogin !== undefined &&
    sameLogin(comment.author, machineLogin)
  ) {
    return true;
  }
  return isMachineComment(comment.body);
}

/** Drop the `[bot]` GitHub's REST surface appends and its GraphQL one does not. */
function bareLogin(login: string): string {
  return login.endsWith("[bot]") ? login.slice(0, -"[bot]".length) : login;
}

/**
 * Whether two logins name the same forge identity, across the two spellings
 * GitHub uses for an App. Compared whole rather than by prefix: an account
 * called `timone-agent-helper` is somebody else.
 */
function sameLogin(one: string, other: string): boolean {
  return bareLogin(one) === bareLogin(other);
}

/** One comment in a ticket's thread. */
export const ticketCommentSchema = z.strictObject({
  author: z.string(),
  body: z.string(),
  createdAt: z.string(),
  /**
   * Whether Timone wrote this comment. Derived from {@link MACHINE_MARKER},
   * never from the author — the author is the account the machine borrows.
   */
  fromTimone: z.boolean(),
});

/** A ticket as the process sees it — no tracker-specific fields. */
export const ticketSchema = z.strictObject({
  number: z.number().int().positive(),
  title: z.string(),
  /** Verbatim issue body, however naive the language it is written in. */
  body: z.string(),
  labels: z.array(z.string()),
  url: z.string(),
  author: z.string(),
  createdAt: z.string(),
});

/** A ticket together with its comment thread, oldest comment first. */
export const ticketThreadSchema = ticketSchema.extend({
  comments: z.array(ticketCommentSchema),
});

export type TicketComment = z.infer<typeof ticketCommentSchema>;
export type Ticket = z.infer<typeof ticketSchema>;
export type TicketThread = z.infer<typeof ticketThreadSchema>;

/**
 * One dependency a step declares, as GitHub's native `blockedBy` gives it.
 *
 * It carries its **own** state rather than a number to look up, and that is
 * deliberate: `blockedBy` admits issues in other repositories, and the numbers
 * of the two collide freely — a step blocked by `timone#8` and one blocked by
 * `scratch-app#8` are indistinguishable by number alone. Verified against
 * `fvermaut/scratch-app` on 2026-08-21. Resolving by number would have matched
 * a foreign dependency against a local step of the same number and answered
 * confidently with the wrong one.
 */
export const dependencySchema = z.strictObject({
  number: z.number().int().positive(),
  /** The only field that says which repository the dependency lives in. */
  url: z.string(),
  /** Whether it is still open, and so still holding its dependent back. */
  open: z.boolean(),
});

/**
 * One step ticket of an initiative
 * ([ADR-0040](../../doc/adr/0040-one-step-is-one-ticket-and-doneness-is-a-fact-about-a-ticket.md)):
 * a child of the initiative's ticket, and one run's worth of work.
 *
 * Wider than a {@link Ticket} because the frontier rule asks questions a
 * ticket has never had to answer — whether it is closed, whether anyone has
 * claimed it, and what it waits for.
 */
export const stepSchema = z.strictObject({
  number: z.number().int().positive(),
  title: z.string(),
  state: z.enum(["open", "closed"]),
  /** Every label it carries; the hold is one of them, and named in `steps.ts`. */
  labels: z.array(z.string()),
  /**
   * The people who have taken it. Users only, and that is the field's exact
   * capability rather than a shortcoming: **a GitHub App's bot cannot be an
   * issue assignee at all**, so the machine's own hold is a label and this
   * field carries only the humans it can carry.
   */
  assignees: z.array(z.string()),
  blockedBy: z.array(dependencySchema),
  /**
   * True when the tracker counted more dependencies than it handed over, so
   * what this step waits for is **not fully known**. Read as blocked, never as
   * free: a step that should have been held back and was not is the failure
   * mode ADR-0040 names as the one to watch.
   */
  dependenciesIncomplete: z.boolean(),
  /**
   * A `Blocked by:` line found in the body, verbatim, or absent.
   *
   * The machine does **not** act on it — a dependency is the native relation
   * and nothing else — but it does not ignore it either. It is carried here so
   * that the machine can say on the ticket that it saw the line and does not
   * respect it, rather than walking silently past a dependency a human
   * believed they had declared. `.claude/skills/timone-wayfind/SKILL.md` still
   * offers the line, which is how one gets written in good faith.
   */
  bodyDependencyLine: z.string().optional(),
});

export type Dependency = z.infer<typeof dependencySchema>;
export type Step = z.infer<typeof stepSchema>;

/**
 * Where a pull request stands, as the process reads it: `merged` is the
 * terminal state that completes a run, `closed` (without merging) the one
 * that declines it, and `open` is a run still waiting on its review.
 */
export const PR_STATES = ["open", "merged", "closed"] as const;

/** A pull request as the process sees it — no tracker-specific fields. */
export const pullRequestSchema = z.strictObject({
  number: z.number().int().positive(),
  title: z.string(),
  url: z.string(),
  state: z.enum(PR_STATES),
  /**
   * The commit at the head of the PR's branch, as the *tracker* sees it.
   *
   * Deliberately read from the tracker rather than from a local clone: a
   * preview is reconciled against the commit under review, and a clone that
   * has not fetched recently would have the reconciler chasing a commit
   * nobody is looking at.
   */
  headSha: z.string(),
});

/**
 * One comment on a pull request. A ticket comment, plus — where the tracker
 * can thread a reply under it — the id to hand back as `replyTo`. Undefined
 * means the surface is flat there (GitHub's PR conversation, review
 * summaries); a reply still lands on the PR, just unthreaded.
 */
export const pullRequestCommentSchema = ticketCommentSchema.extend({
  replyTo: z.string().optional(),
});

/**
 * A pull request with everything said on it — conversation comments, review
 * summaries and inline review comments — as one thread, oldest first. One
 * merged sequence on purpose: the review loop reads "what did the human say
 * since the cursor", and which GitHub surface they said it on is not the
 * process's business.
 */
export const pullRequestThreadSchema = pullRequestSchema.extend({
  comments: z.array(pullRequestCommentSchema),
});

export type PullRequest = z.infer<typeof pullRequestSchema>;
export type PullRequestComment = z.infer<typeof pullRequestCommentSchema>;
export type PullRequestThread = z.infer<typeof pullRequestThreadSchema>;

/**
 * The subset of a managed project an adapter needs: its manifest name (for
 * error messages and run keys) and its clone URL (which the implementation
 * resolves to whatever the tracker addresses repositories by).
 */
export interface TicketingProject {
  name: string;
  repoUrl: string;
}

/**
 * The seam between the process and whatever tracks tickets. Real interface
 * from day one per ADR-0004: GitHub is the first implementation, not the
 * shape. Eleven capabilities, and no more — anything a stage needs beyond
 * these is a deliberate widening of the seam, not an incidental one. Three
 * of them are phase 13's widening: delivery and the review loop live on
 * pull requests, and the PR is stage 8's artifact (ADR-0004), so reading
 * and answering it is the ticketing seam's business, not a second adapter's.
 * The last three are phase 16's and phase 20's two, and their reasoning is
 * on the calls themselves.
 */
export interface TicketingAdapter {
  /** Open tickets carrying the mark label, oldest first. */
  listMarkedTickets(project: TicketingProject): Promise<Ticket[]>;

  /**
   * Every open ticket, marked or not, oldest first — {@link
   * listMarkedTickets}'s twin without the permission boundary applied.
   *
   * Phase 20's second widening of this seam, and deliberate rather than
   * incidental. Until
   * [ADR-0024](../../doc/adr/0024-every-open-ticket-answers-for-itself.md) the
   * daemon could not see an issue it was not allowed to work, so an unmarked
   * ticket was silent for ever with nothing on it explaining why — `#5` on the
   * pilot, filed and never spoken to. The ADR splits one boundary into two:
   * {@link MARK_LABEL} stops bounding what Timone *says* and still bounds what
   * it *does*. Seeing every open ticket is what makes the first half possible,
   * and it is exactly what {@link listMarkedTickets} must keep refusing to do
   * — **nothing may create a run from this listing** ([PRD-02.R1](../../doc/specs/prd/prd-02-inversion-of-control.criteria.md#r1--ticket-pickup)
   * forbids a run on an unmarked issue, and has never forbidden a comment).
   *
   * Implementations apply the same refusal to truncate that the marked listing
   * does: a backlog larger than one page is a listing to fail on, not to work
   * from silently.
   */
  listOpenTickets(project: TicketingProject): Promise<Ticket[]>;

  /**
   * The step tickets of one initiative — its children — **open and closed
   * alike**, in the order its approved breakdown put them.
   *
   * Closed ones are part of the answer rather than noise: the frontier chooses
   * the first step that is not done, so it has to be able to see that the ones
   * before it are.
   */
  listSteps(project: TicketingProject, initiative: number): Promise<Step[]>;

  /**
   * Open one step ticket as a child of its initiative, and answer with its
   * number.
   *
   * It is born carrying the mark and its parent, and **neither half of a
   * claim** — no hold label, no assignee. A step born claimed is one the
   * frontier never returns, and a whole initiative of them never starts.
   */
  createStep(
    project: TicketingProject,
    initiative: number,
    step: { title: string; body: string },
  ): Promise<number>;

  /**
   * Declare that one step waits for another, as GitHub's **native** relation
   * and not as a line in a body
   * ([ADR-0044](../../doc/adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md)
   * D6). The relation is what the frontier reads, and it is a thing fvermaut
   * can add or remove himself on any GitHub screen.
   */
  blockStep(
    project: TicketingProject,
    step: number,
    waitsFor: number,
  ): Promise<void>;

  /** Replace a ticket's body — how an initiative becomes a map of its steps. */
  setTicketBody(
    project: TicketingProject,
    number: number,
    body: string,
  ): Promise<void>;

  /**
   * Make sure a label exists, creating it if it does not.
   *
   * A state label nobody created is a state nobody can be in — the reason
   * `timone-wayfind` creates its own `wayfinder:*` labels on first use, and
   * the reason the hold label cannot simply be applied and hoped for.
   * **Creating one that already exists is the ordinary case**, not an error.
   */
  ensureLabel(
    project: TicketingProject,
    label: string,
    description?: string,
  ): Promise<void>;

  /** One ticket with its comment thread. */
  getTicket(project: TicketingProject, number: number): Promise<TicketThread>;

  /**
   * Append a comment to a ticket's thread. Implementations stamp it with
   * {@link MACHINE_MARKER}: marking is not the caller's job to remember.
   */
  postComment(
    project: TicketingProject,
    number: number,
    body: string,
  ): Promise<void>;

  /**
   * Say something on a ticket **in place of** whatever was last said under
   * `marker`, editing that comment rather than adding another. The twin of
   * {@link upsertPullRequestComment}, on the other surface.
   *
   * Phase 20's widening of this seam, and deliberate rather than incidental.
   * A ticket's call to action is the same kind of statement that docblock
   * argues about a preview — a standing fact whose truth changes, reconciled
   * every cycle
   * ([ADR-0024](../../doc/adr/0024-every-open-ticket-answers-for-itself.md)),
   * so appending it would fill a client's ticket with near-identical
   * comments. **That argument transfers here verbatim and is deliberately not
   * restated**; read it there.
   *
   * Implementations match on `marker` appearing in a comment they themselves
   * wrote — told by {@link isMachineComment}, never by the author, who is
   * only the account the machine borrows — and post a new one when they find
   * none. The body is stamped exactly as {@link postComment}'s is.
   */
  upsertComment(
    project: TicketingProject,
    number: number,
    marker: string,
    body: string,
  ): Promise<void>;

  /** Add a label to a ticket (labels are read off {@link Ticket.labels}). */
  applyLabel(
    project: TicketingProject,
    number: number,
    label: string,
  ): Promise<void>;

  /**
   * The pull request whose head is `branch`, or undefined when none exists.
   * When the branch has several, the liveliest wins: open, then merged,
   * then closed — a stale closed PR must not hide the one under review.
   */
  findPullRequest(
    project: TicketingProject,
    branch: string,
  ): Promise<PullRequest | undefined>;

  /** One pull request with everything said on it, as one thread. */
  getPullRequestThread(
    project: TicketingProject,
    number: number,
  ): Promise<PullRequestThread>;

  /**
   * Say something on a pull request, stamped with {@link MACHINE_MARKER}
   * exactly as ticket comments are. With `replyTo` (a comment's
   * {@link PullRequestComment.replyTo}), the reply threads under that
   * comment; without it, it lands on the PR conversation.
   */
  postPullRequestComment(
    project: TicketingProject,
    number: number,
    body: string,
    replyTo?: string,
  ): Promise<void>;

  /**
   * Say something on a pull request **in place of** whatever was last said
   * under `marker`, editing that comment rather than adding another.
   *
   * Phase 16's widening of this seam, and deliberate rather than incidental.
   * Everything else the process says on a pull request is an *event* — this
   * happened, then that did — and appending is the honest record of an event.
   * A preview is not an event but a **standing fact** whose truth changes:
   * "this pull request is running here". Reconciled every cycle, appended, it
   * would be a client's PR filling with near-identical comments. Editing is
   * what makes per-cycle reconciliation compatible with a surface a human
   * reads.
   *
   * Implementations match on `marker` appearing in a comment they themselves
   * wrote, and post a new one when they find none.
   */
  upsertPullRequestComment(
    project: TicketingProject,
    number: number,
    marker: string,
    body: string,
  ): Promise<void>;

  /**
   * Close a ticket whose journey has ended — `completed` when the work
   * merged or a question was answered, `not-planned` when the work was
   * declined. A ticket left open after the machine told it "this ticket's
   * journey ends here" is the machine saying one thing and doing another
   * (asked for by fvermaut at phase 13's live gate).
   */
  closeTicket(
    project: TicketingProject,
    number: number,
    reason: "completed" | "not-planned",
  ): Promise<void>;
}
