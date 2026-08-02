import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";

import {
  MARK_LABEL,
  type Ticket,
  type TicketingAdapter,
  type TicketingProject,
  type TicketThread,
} from "./ticketing.js";

const execFileAsync = promisify(execFile);

/**
 * How the adapter reaches the outside world. Injected so tests can drive
 * the whole implementation without a network or a `gh` binary: every
 * subprocess this file runs goes through here.
 */
export type CommandRunner = (
  command: string,
  args: string[],
) => Promise<string>;

/** Error shape thrown by promisified execFile for a failing process. */
interface ExecFileError extends Error {
  stderr?: string;
}

/**
 * The default runner: `gh` with arguments passed verbatim (never through a
 * shell). Throws an Error carrying gh's stderr when the command fails.
 */
export const execCommandRunner: CommandRunner = async (command, args) => {
  try {
    const { stdout } = await execFileAsync(command, args, {
      maxBuffer: 32 * 1024 * 1024,
    });
    return stdout;
  } catch (error) {
    const stderr = (error as ExecFileError).stderr?.trim();
    const reason =
      stderr !== undefined && stderr !== ""
        ? stderr
        : error instanceof Error
          ? error.message
          : String(error);
    throw new Error(`${command} ${args.join(" ")} failed: ${reason}`);
  }
};

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
});

const ghIssueWithCommentsSchema = ghIssueSchema.extend({
  comments: z.array(ghCommentSchema),
});

/** The JSON fields requested from `gh issue list`. */
const LIST_FIELDS = "number,title,body,labels,url,author,createdAt";
/** `gh issue view` additionally carries the thread. */
const VIEW_FIELDS = `${LIST_FIELDS},comments`;

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
      body,
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
}
