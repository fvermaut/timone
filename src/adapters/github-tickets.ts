import { z } from "zod";

import {
  isMachineComment,
  MARK_LABEL,
  stampMachineComment,
  type PullRequest,
  type PullRequestComment,
  type PullRequestThread,
  type Ticket,
  type TicketingAdapter,
  type TicketingProject,
  type TicketThread,
} from "./ticketing.js";

// The runner moved to its own module when the preview adapter became its
// second user: a Docker adapter importing its subprocess seam from the GitHub
// adapter would be a dependency between two implementations that share
// nothing. Re-exported here so every existing importer is unaffected.
export {
  execCommandRunner,
  type CommandOptions,
  type CommandRunner,
} from "./command-runner.js";
import type { CommandRunner } from "./command-runner.js";
import { execCommandRunner } from "./command-runner.js";

/**
 * Reduce a clone URL to GitHub's `owner/repo`. Handles the three forms a
 * manifest realistically carries: https, scp-style ssh, and ssh:// URLs.
 *
 * Throws naming the offending URL rather than guessing — a project whose
 * repo cannot be addressed must fail where it is configured, not later as
 * a confusing `gh` error.
 */
export function repoSlug(repoUrl: string): string {
  const match = /(?:github\.com[/:])([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(
    repoUrl,
  );
  if (match === null) {
    throw new Error(
      `Cannot derive a GitHub owner/repo from repo_url "${repoUrl}"`,
    );
  }
  return `${match[1]}/${match[2]}`;
}

/** The `labels` element as `gh --json labels` returns it. */
const ghLabelSchema = z.looseObject({ name: z.string() });

/** The `author` object as `gh --json author` returns it. */
const ghAuthorSchema = z.looseObject({ login: z.string() });

/**
 * The issue shape this adapter asks `gh` for. Loose on purpose: gh adds
 * fields over time and unknown extras are not this seam's business — but
 * every field we map is required, so a shape change we do depend on fails
 * loudly instead of yielding undefined.
 */
const ghIssueSchema = z.looseObject({
  number: z.number().int().positive(),
  title: z.string(),
  body: z.string(),
  labels: z.array(ghLabelSchema),
  url: z.string(),
  author: ghAuthorSchema,
  createdAt: z.string(),
});

const ghCommentSchema = z.looseObject({
  author: ghAuthorSchema,
  body: z.string(),
  createdAt: z.string(),
  /**
   * The comment's permalink, e.g. `…/pull/9#issuecomment-1234567` or
   * `…/issues/7#issuecomment-1234567`. The only place `gh pr view` and
   * `gh issue view --json comments` surface the numeric id that the REST
   * endpoint for editing a comment addresses — the `id` field they return is
   * GraphQL's opaque node id, which that endpoint does not accept. One
   * endpoint serves both: to GitHub a ticket comment and a pull request's
   * conversation comment are the same resource.
   */
  url: z.string().optional(),
});

const ghIssueWithCommentsSchema = ghIssueSchema.extend({
  comments: z.array(ghCommentSchema),
});

/** The JSON fields requested from `gh issue list`. */
const LIST_FIELDS = "number,title,body,labels,url,author,createdAt";
/** `gh issue view` additionally carries the thread. */
const VIEW_FIELDS = `${LIST_FIELDS},comments`;

/** How `gh` spells a pull request's state, mapped to how the process does. */
const GH_PR_STATES = {
  OPEN: "open",
  MERGED: "merged",
  CLOSED: "closed",
} as const;

const ghPullStateSchema = z.enum(
  Object.keys(GH_PR_STATES) as [keyof typeof GH_PR_STATES],
);

/** The pull-request shape `gh pr list`/`gh pr view` return. */
const ghPullSchema = z.looseObject({
  number: z.number().int().positive(),
  title: z.string(),
  url: z.string(),
  state: ghPullStateSchema,
  /** GitHub's name for the commit at the head of the PR's branch. */
  headRefOid: z.string(),
});

/** A PR review summary as `gh pr view --json reviews` returns it. */
const ghReviewSchema = z.looseObject({
  author: ghAuthorSchema,
  body: z.string(),
  submittedAt: z.string().optional(),
});

const ghPullWithThreadSchema = ghPullSchema.extend({
  comments: z.array(ghCommentSchema),
  reviews: z.array(ghReviewSchema),
});

/** An inline review comment as the REST `pulls/N/comments` endpoint returns it. */
const ghInlineCommentSchema = z.looseObject({
  id: z.number(),
  in_reply_to_id: z.number().optional(),
  user: ghAuthorSchema,
  body: z.string(),
  created_at: z.string(),
});

/** The JSON fields requested for pull requests. */
const PR_FIELDS = "number,title,url,state,headRefOid";
const PR_VIEW_FIELDS = `${PR_FIELDS},comments,reviews`;

function toPullRequest(pull: z.infer<typeof ghPullSchema>): PullRequest {
  return {
    number: pull.number,
    title: pull.title,
    url: pull.url,
    state: GH_PR_STATES[pull.state],
    headSha: pull.headRefOid,
  };
}

/**
 * The numeric id the REST comment-editing endpoint addresses, out of a
 * comment's permalink (`…#issuecomment-1234567`).
 *
 * Throws rather than falling back to posting a fresh comment: the whole point
 * of editing is that a client's pull request does not accumulate near-copies
 * of the same statement, and a silent fallback would produce exactly that.
 */
export function commentDatabaseId(url: string): string {
  const match = /#issuecomment-(\d+)$/.exec(url.trim());
  if (match === null) {
    throw new Error(`Cannot derive a comment id from "${url}"`);
  }
  return match[1];
}

/**
 * Parse `gh` stdout as JSON against `schema`, failing loudly with the raw
 * payload in the message. A truncated or unexpected payload is the one
 * failure mode that silently poisons everything downstream, so the raw text
 * is preserved in the error rather than summarized.
 */
function parseGhJson<T>(schema: z.ZodType<T>, raw: string, context: string): T {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${context}: gh returned unparseable JSON (${reason}). Raw payload:\n${raw}`,
    );
  }

  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.map(String).join(".") || "<root>"}: ${issue.message}`)
      .join("; ");
    throw new Error(
      `${context}: gh returned an unexpected shape (${details}). Raw payload:\n${raw}`,
    );
  }
  return result.data;
}

/** Map gh's issue shape onto the tracker-neutral {@link Ticket}. */
function toTicket(issue: z.infer<typeof ghIssueSchema>): Ticket {
  return {
    number: issue.number,
    title: issue.title,
    body: issue.body,
    labels: issue.labels.map((label) => label.name),
    url: issue.url,
    author: issue.author.login,
    createdAt: issue.createdAt,
  };
}

export interface GitHubTicketingOptions {
  /** Injected subprocess runner; defaults to running `gh` for real. */
  run?: CommandRunner;
  /** The permission-boundary label. Defaults to {@link MARK_LABEL}. */
  markLabel?: string;
  /**
   * How many issues one `gh issue list` may return. Reaching it is treated
   * as an error rather than a truncation, so a backlog larger than the page
   * is never silently invisible to the daemon.
   */
  pageLimit?: number;
}

/**
 * {@link TicketingAdapter} over the `gh` CLI (ADR-0009: CLI-first). Holds no
 * state beyond its options; every call is one `gh` invocation.
 */
export class GitHubTicketingAdapter implements TicketingAdapter {
  private readonly run: CommandRunner;
  private readonly markLabel: string;
  private readonly pageLimit: number;

  constructor(options: GitHubTicketingOptions = {}) {
    this.run = options.run ?? execCommandRunner;
    this.markLabel = options.markLabel ?? MARK_LABEL;
    this.pageLimit = options.pageLimit ?? 200;
  }

  async listMarkedTickets(project: TicketingProject): Promise<Ticket[]> {
    const slug = repoSlug(project.repoUrl);
    const raw = await this.run("gh", [
      "issue",
      "list",
      "--repo",
      slug,
      "--label",
      this.markLabel,
      "--state",
      "open",
      "--json",
      LIST_FIELDS,
      "--limit",
      String(this.pageLimit),
    ]);

    const issues = parseGhJson(
      z.array(ghIssueSchema),
      raw,
      `listing ${this.markLabel}-marked issues on ${slug}`,
    );

    if (issues.length >= this.pageLimit) {
      throw new Error(
        `${slug}: ${issues.length} marked issues hit the page limit of ` +
          `${this.pageLimit} — refusing to work from a truncated list`,
      );
    }

    return issues
      .map(toTicket)
      .sort(
        (a, b) => a.createdAt.localeCompare(b.createdAt) || a.number - b.number,
      );
  }

  async getTicket(
    project: TicketingProject,
    number: number,
  ): Promise<TicketThread> {
    const slug = repoSlug(project.repoUrl);
    const raw = await this.run("gh", [
      "issue",
      "view",
      String(number),
      "--repo",
      slug,
      "--json",
      VIEW_FIELDS,
    ]);

    const issue = parseGhJson(
      ghIssueWithCommentsSchema,
      raw,
      `reading ${slug}#${number}`,
    );

    return {
      ...toTicket(issue),
      comments: issue.comments.map((comment) => ({
        author: comment.author.login,
        body: comment.body,
        createdAt: comment.createdAt,
        fromTimone: isMachineComment(comment.body),
      })),
    };
  }

  async postComment(
    project: TicketingProject,
    number: number,
    body: string,
  ): Promise<void> {
    await this.run("gh", [
      "issue",
      "comment",
      String(number),
      "--repo",
      repoSlug(project.repoUrl),
      "--body",
      stampMachineComment(body),
    ]);
  }

  async upsertComment(
    project: TicketingProject,
    number: number,
    marker: string,
    body: string,
  ): Promise<void> {
    const slug = repoSlug(project.repoUrl);

    const raw = await this.run("gh", [
      "issue",
      "view",
      String(number),
      "--repo",
      slug,
      "--json",
      "comments",
    ]);
    const { comments } = parseGhJson(
      z.looseObject({ comments: z.array(ghCommentSchema) }),
      raw,
      `reading comments on ${slug}#${number}`,
    );

    // Ours *and* carrying the marker. Matching the marker alone would let a
    // human quoting the CTA back at the machine capture the edit — and since
    // Timone comments under the human's own account, the machine header is
    // the only thing that tells the two apart.
    const existing = comments.find(
      (comment) =>
        isMachineComment(comment.body) && comment.body.includes(marker),
    );
    if (existing === undefined) {
      await this.postComment(project, number, body);
      return;
    }
    if (existing.url === undefined) {
      throw new Error(
        `gh returned a comment on ${slug}#${number} with no url, so it cannot be edited`,
      );
    }

    // A ticket comment and a pull request's conversation comment are one and
    // the same resource to GitHub, so this is the endpoint its twin patches.
    await this.run("gh", [
      "api",
      "--method",
      "PATCH",
      `repos/${slug}/issues/comments/${commentDatabaseId(existing.url)}`,
      "-f",
      `body=${stampMachineComment(body)}`,
    ]);
  }

  async applyLabel(
    project: TicketingProject,
    number: number,
    label: string,
  ): Promise<void> {
    await this.run("gh", [
      "issue",
      "edit",
      String(number),
      "--repo",
      repoSlug(project.repoUrl),
      "--add-label",
      label,
    ]);
  }

  async closeTicket(
    project: TicketingProject,
    number: number,
    reason: "completed" | "not-planned",
  ): Promise<void> {
    await this.run("gh", [
      "issue",
      "close",
      String(number),
      "--repo",
      repoSlug(project.repoUrl),
      "--reason",
      reason === "completed" ? "completed" : "not planned",
    ]);
  }

  async findPullRequest(
    project: TicketingProject,
    branch: string,
  ): Promise<PullRequest | undefined> {
    const slug = repoSlug(project.repoUrl);
    const raw = await this.run("gh", [
      "pr",
      "list",
      "--repo",
      slug,
      "--head",
      branch,
      "--state",
      "all",
      "--json",
      PR_FIELDS,
      "--limit",
      String(this.pageLimit),
    ]);

    const pulls = parseGhJson(
      z.array(ghPullSchema),
      raw,
      `listing pull requests for ${slug} head ${branch}`,
    );
    if (pulls.length === 0) return undefined;

    // The liveliest PR wins: a stale closed one must not hide the one under
    // review. Within a state, the newest (highest number) is the answer.
    const rank: Record<PullRequest["state"], number> = {
      open: 0,
      merged: 1,
      closed: 2,
    };
    return pulls
      .map(toPullRequest)
      .sort((a, b) => rank[a.state] - rank[b.state] || b.number - a.number)[0];
  }

  async getPullRequestThread(
    project: TicketingProject,
    number: number,
  ): Promise<PullRequestThread> {
    const slug = repoSlug(project.repoUrl);

    const viewRaw = await this.run("gh", [
      "pr",
      "view",
      String(number),
      "--repo",
      slug,
      "--json",
      PR_VIEW_FIELDS,
    ]);
    const pull = parseGhJson(
      ghPullWithThreadSchema,
      viewRaw,
      `reading ${slug}!${number}`,
    );

    // Inline review comments live behind a REST endpoint `gh pr view` does
    // not surface; `--paginate` so a long review is never silently cut off.
    const inlineRaw = await this.run("gh", [
      "api",
      "--paginate",
      `repos/${slug}/pulls/${number}/comments`,
    ]);
    const inline = parseGhJson(
      z.array(ghInlineCommentSchema),
      inlineRaw,
      `reading inline review comments on ${slug}!${number}`,
    );

    const comments: PullRequestComment[] = [
      ...pull.comments.map((comment) => ({
        author: comment.author.login,
        body: comment.body,
        createdAt: comment.createdAt,
        fromTimone: isMachineComment(comment.body),
      })),
      // A review's summary text is a comment; a review that carried none
      // (inline remarks only, or a bare verdict) contributes nothing here.
      ...pull.reviews
        .filter(
          (review) => review.body !== "" && review.submittedAt !== undefined,
        )
        .map((review) => ({
          author: review.author.login,
          body: review.body,
          createdAt: review.submittedAt as string,
          fromTimone: isMachineComment(review.body),
        })),
      // Replying threads under the *root* of an inline thread, so a reply
      // to a reply names the same root its sibling does.
      ...inline.map((comment) => ({
        author: comment.user.login,
        body: comment.body,
        createdAt: comment.created_at,
        fromTimone: isMachineComment(comment.body),
        replyTo: String(comment.in_reply_to_id ?? comment.id),
      })),
    ];

    return {
      ...toPullRequest(pull),
      comments: comments.sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      ),
    };
  }

  async postPullRequestComment(
    project: TicketingProject,
    number: number,
    body: string,
    replyTo?: string,
  ): Promise<void> {
    const slug = repoSlug(project.repoUrl);
    const stamped = stampMachineComment(body);

    if (replyTo === undefined) {
      await this.run("gh", [
        "pr",
        "comment",
        String(number),
        "--repo",
        slug,
        "--body",
        stamped,
      ]);
      return;
    }

    await this.run("gh", [
      "api",
      "--method",
      "POST",
      `repos/${slug}/pulls/${number}/comments/${replyTo}/replies`,
      "-f",
      `body=${stamped}`,
    ]);
  }

  async upsertPullRequestComment(
    project: TicketingProject,
    number: number,
    marker: string,
    body: string,
  ): Promise<void> {
    const slug = repoSlug(project.repoUrl);

    const raw = await this.run("gh", [
      "issue",
      "view",
      String(number),
      "--repo",
      slug,
      "--json",
      "comments",
    ]);
    const { comments } = parseGhJson(
      z.looseObject({ comments: z.array(ghCommentSchema) }),
      raw,
      `reading comments on ${slug}!${number}`,
    );

    // Ours *and* carrying the marker. Matching the marker alone would let a
    // human quoting the preview comment back at the machine capture the edit.
    const existing = comments.find(
      (comment) => isMachineComment(comment.body) && comment.body.includes(marker),
    );
    if (existing === undefined) {
      await this.postPullRequestComment(project, number, body);
      return;
    }
    if (existing.url === undefined) {
      throw new Error(
        `gh returned a comment on ${slug}!${number} with no url, so it cannot be edited`,
      );
    }

    await this.run("gh", [
      "api",
      "--method",
      "PATCH",
      `repos/${slug}/issues/comments/${commentDatabaseId(existing.url)}`,
      "-f",
      `body=${stampMachineComment(body)}`,
    ]);
  }
}
