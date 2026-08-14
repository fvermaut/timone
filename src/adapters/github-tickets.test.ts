import { describe, expect, it } from "vitest";

import {
  MACHINE_MARKER,
  MARK_LABEL,
  type TicketingProject,
} from "./ticketing.js";
import {
  GitHubTicketingAdapter,
  repoSlug,
  type CommandRunner,
} from "./github-tickets.js";

const alpha: TicketingProject = {
  name: "scratch-app",
  repoUrl: "https://github.com/fvermaut/scratch-app.git",
};

/** Recorded invocation: the command and its verbatim argument vector. */
interface Invocation {
  command: string;
  args: string[];
}

/**
 * A fake command runner. `responses` is consulted in order: each call pops
 * the next canned stdout. Every invocation is recorded for assertion, and
 * the network is never touched.
 */
function fakeRunner(...responses: string[]): {
  run: CommandRunner;
  calls: Invocation[];
} {
  const calls: Invocation[] = [];
  const queue = [...responses];
  const run: CommandRunner = async (command, args) => {
    calls.push({ command, args });
    const next = queue.shift();
    if (next === undefined) {
      throw new Error(
        `fake runner: unexpected call ${command} ${args.join(" ")}`,
      );
    }
    return next;
  };
  return { run, calls };
}

/** A `gh issue list --json …` element as GitHub actually returns it. */
function ghIssue(overrides: Record<string, unknown> = {}): unknown {
  return {
    number: 7,
    title: "the page feels slow",
    body: "when I add many items it takes ages",
    labels: [{ id: "L1", name: MARK_LABEL, description: "", color: "ededed" }],
    url: "https://github.com/fvermaut/scratch-app/issues/7",
    author: { id: "U1", is_bot: false, login: "fvermaut", name: "Francois" },
    createdAt: "2026-08-02T10:00:00Z",
    ...overrides,
  };
}

describe("repoSlug", () => {
  it.each([
    ["https://github.com/fvermaut/scratch-app.git", "fvermaut/scratch-app"],
    ["https://github.com/fvermaut/scratch-app", "fvermaut/scratch-app"],
    ["git@github.com:fvermaut/scratch-app.git", "fvermaut/scratch-app"],
    ["ssh://git@github.com/fvermaut/scratch-app.git", "fvermaut/scratch-app"],
  ])("derives %s → %s", (url, expected) => {
    expect(repoSlug(url)).toBe(expected);
  });

  it("fails loudly on a URL it cannot read as owner/repo", () => {
    expect(() => repoSlug("file:///tmp/local-repo")).toThrow(
      /file:\/\/\/tmp\/local-repo/,
    );
  });
});

describe("listMarkedTickets", () => {
  it("asks gh for open, mark-labelled issues on the project's repo", async () => {
    const { run, calls } = fakeRunner(JSON.stringify([ghIssue()]));
    await new GitHubTicketingAdapter({ run }).listMarkedTickets(alpha);

    expect(calls).toHaveLength(1);
    expect(calls[0].command).toBe("gh");
    const args = calls[0].args;
    expect(args.slice(0, 2)).toEqual(["issue", "list"]);
    expect(args).toContain("--repo");
    expect(args[args.indexOf("--repo") + 1]).toBe("fvermaut/scratch-app");
    expect(args[args.indexOf("--label") + 1]).toBe(MARK_LABEL);
    expect(args[args.indexOf("--state") + 1]).toBe("open");
  });

  it("maps gh's shape onto tickets, keeping a naive body verbatim", async () => {
    const body =
      "the page feels slow when I add many items\n\nit's really annoying 😩";
    const { run } = fakeRunner(JSON.stringify([ghIssue({ body })]));

    const tickets = await new GitHubTicketingAdapter({ run }).listMarkedTickets(
      alpha,
    );

    expect(tickets).toEqual([
      {
        number: 7,
        title: "the page feels slow",
        body,
        labels: [MARK_LABEL],
        url: "https://github.com/fvermaut/scratch-app/issues/7",
        author: "fvermaut",
        createdAt: "2026-08-02T10:00:00Z",
      },
    ]);
  });

  it("returns an empty list when nothing is marked", async () => {
    const { run } = fakeRunner("[]\n");
    await expect(
      new GitHubTicketingAdapter({ run }).listMarkedTickets(alpha),
    ).resolves.toEqual([]);
  });

  it("orders tickets oldest first regardless of gh's order", async () => {
    const { run } = fakeRunner(
      JSON.stringify([
        ghIssue({ number: 9, createdAt: "2026-08-02T12:00:00Z" }),
        ghIssue({ number: 4, createdAt: "2026-08-01T09:00:00Z" }),
      ]),
    );
    const tickets = await new GitHubTicketingAdapter({ run }).listMarkedTickets(
      alpha,
    );
    expect(tickets.map((ticket) => ticket.number)).toEqual([4, 9]);
  });

  it("refuses to truncate silently at the page limit", async () => {
    const page = [ghIssue({ number: 1 }), ghIssue({ number: 2 })];
    const { run } = fakeRunner(JSON.stringify(page));

    await expect(
      new GitHubTicketingAdapter({ run, pageLimit: 2 }).listMarkedTickets(alpha),
    ).rejects.toThrow(/page limit/i);
  });

  it("accepts a page one short of the limit", async () => {
    const { run } = fakeRunner(JSON.stringify([ghIssue({ number: 1 })]));
    await expect(
      new GitHubTicketingAdapter({ run, pageLimit: 2 }).listMarkedTickets(alpha),
    ).resolves.toHaveLength(1);
  });

  it("fails loudly with the raw payload when gh returns nonsense", async () => {
    const { run } = fakeRunner("not json at all");
    await expect(
      new GitHubTicketingAdapter({ run }).listMarkedTickets(alpha),
    ).rejects.toThrow(/not json at all/);
  });

  it("fails loudly with the raw payload when a field is missing", async () => {
    const payload = JSON.stringify([{ number: 7, title: "no body field" }]);
    const { run } = fakeRunner(payload);
    await expect(
      new GitHubTicketingAdapter({ run }).listMarkedTickets(alpha),
    ).rejects.toThrow(/no body field/);
  });
});

describe("getTicket", () => {
  it("reads one issue with its comment thread", async () => {
    const { run, calls } = fakeRunner(
      JSON.stringify(
        ghIssue({
          comments: [
            {
              author: { login: "timone-bot" },
              body: "picked this up",
              createdAt: "2026-08-02T10:05:00Z",
            },
          ],
        }),
      ),
    );

    const thread = await new GitHubTicketingAdapter({ run }).getTicket(alpha, 7);

    expect(calls[0].args.slice(0, 3)).toEqual(["issue", "view", "7"]);
    expect(calls[0].args[calls[0].args.indexOf("--repo") + 1]).toBe(
      "fvermaut/scratch-app",
    );
    expect(thread.number).toBe(7);
    expect(thread.comments).toEqual([
      {
        author: "timone-bot",
        body: "picked this up",
        createdAt: "2026-08-02T10:05:00Z",
        fromTimone: false,
      },
    ]);
  });

  it("reads a thread with no comments as an empty thread", async () => {
    const { run } = fakeRunner(JSON.stringify(ghIssue({ comments: [] })));
    const thread = await new GitHubTicketingAdapter({ run }).getTicket(alpha, 7);
    expect(thread.comments).toEqual([]);
  });

  it("tells its own comments from the human's, whatever the author says", async () => {
    const { run } = fakeRunner(
      JSON.stringify(
        ghIssue({
          comments: [
            {
              author: { login: "fvermaut" },
              body: `${MACHINE_MARKER}\n\n---\n\nPicked this up.`,
              createdAt: "2026-08-02T10:05:00Z",
            },
            {
              author: { login: "fvermaut" },
              body: "it's worse on the archive page",
              createdAt: "2026-08-02T10:10:00Z",
            },
          ],
        }),
      ),
    );

    const thread = await new GitHubTicketingAdapter({ run }).getTicket(alpha, 7);

    // Both comments are authored by the same account — only the marker separates them.
    expect(thread.comments.map((comment) => comment.author)).toEqual([
      "fvermaut",
      "fvermaut",
    ]);
    expect(thread.comments.map((comment) => comment.fromTimone)).toEqual([
      true,
      false,
    ]);
  });
});

describe("postComment", () => {
  it("marks every comment as the machine's, above the body", async () => {
    const { run, calls } = fakeRunner("");
    const body = "Picked this up.\n\n**What I need from you:** nothing yet.";

    await new GitHubTicketingAdapter({ run }).postComment(alpha, 7, body);

    expect(calls[0].args.slice(0, 3)).toEqual(["issue", "comment", "7"]);
    const posted = calls[0].args[calls[0].args.indexOf("--body") + 1];
    expect(posted.startsWith(MACHINE_MARKER)).toBe(true);
    expect(posted).toContain(body);
    expect(posted.trimEnd().endsWith("nothing yet.")).toBe(true);
    expect(calls[0].args[calls[0].args.indexOf("--repo") + 1]).toBe(
      "fvermaut/scratch-app",
    );
  });

  it("does not stack a second marker on an already-marked body", async () => {
    const { run, calls } = fakeRunner("");
    const body = `${MACHINE_MARKER}\n\n---\n\nalready marked`;

    await new GitHubTicketingAdapter({ run }).postComment(alpha, 7, body);

    const posted = calls[0].args[calls[0].args.indexOf("--body") + 1];
    expect(posted).toBe(body);
    expect(posted.split(MACHINE_MARKER)).toHaveLength(2);
  });
});

describe("applyLabel", () => {
  it("adds the label to the issue", async () => {
    const { run, calls } = fakeRunner("");
    await new GitHubTicketingAdapter({ run }).applyLabel(alpha, 7, "triage:bug");

    expect(calls[0].args.slice(0, 3)).toEqual(["issue", "edit", "7"]);
    expect(calls[0].args[calls[0].args.indexOf("--add-label") + 1]).toBe(
      "triage:bug",
    );
  });
});

describe("upsertComment", () => {
  /**
   * Stands in for whatever marker the caller passes — the marker is a
   * parameter, so the adapter must work for any stable line, and pinning a
   * particular one here would test a constant rather than the behaviour.
   */
  const marker = "📣 **What happens next** · kept up to date by the machine";
  const body = `${marker}\n\n**What I need from you:** nothing right now.`;

  /** A comment as `gh issue view --json comments` returns it. */
  function ghComment(commentBody: string, id = 777): unknown {
    return {
      author: { login: "fvermaut" },
      body: commentBody,
      createdAt: "2026-08-08T10:00:00Z",
      url: `https://github.com/fvermaut/scratch-app/issues/7#issuecomment-${id}`,
    };
  }

  it("looks for what it said on the ticket, not on a pull request", async () => {
    const { run, calls } = fakeRunner(JSON.stringify({ comments: [] }), "");

    await new GitHubTicketingAdapter({ run }).upsertComment(
      alpha,
      7,
      marker,
      body,
    );

    expect(calls[0].args.slice(0, 3)).toEqual(["issue", "view", "7"]);
    expect(calls[0].args[calls[0].args.indexOf("--repo") + 1]).toBe(
      "fvermaut/scratch-app",
    );
    expect(calls[0].args[calls[0].args.indexOf("--json") + 1]).toBe("comments");
  });

  it("edits what it said last time rather than saying it again", async () => {
    const { run, calls } = fakeRunner(
      JSON.stringify({
        comments: [
          ghComment("it's worse on the archive page"),
          ghComment(`${MACHINE_MARKER}\n\n---\n\n${marker}\n\nstale`, 42),
        ],
      }),
      "",
    );

    await new GitHubTicketingAdapter({ run }).upsertComment(
      alpha,
      7,
      marker,
      body,
    );

    expect(calls[1]).toEqual({
      command: "gh",
      args: [
        "api",
        "--method",
        "PATCH",
        "repos/fvermaut/scratch-app/issues/comments/42",
        "-f",
        `body=${MACHINE_MARKER}\n\n---\n\n${body}`,
      ],
    });
  });

  it("posts a first one when it has never said it before", async () => {
    const { run, calls } = fakeRunner(
      JSON.stringify({
        comments: [ghComment("it's worse on the archive page")],
      }),
      "",
    );

    await new GitHubTicketingAdapter({ run }).upsertComment(
      alpha,
      7,
      marker,
      body,
    );

    expect(calls[1].args.slice(0, 3)).toEqual(["issue", "comment", "7"]);
    expect(calls[1].args.at(-1)).toBe(`${MACHINE_MARKER}\n\n---\n\n${body}`);
  });

  it("will not overwrite a human's own comment that quotes the marker", async () => {
    const { run, calls } = fakeRunner(
      // The human quoting the CTA back to ask about it. Same account the
      // machine posts under, same marker text in the body — the machine
      // header is the only thing it lacks, and that has to be enough.
      JSON.stringify({
        comments: [
          ghComment(`${marker}\n\nis this still what you need from me?`, 42),
        ],
      }),
      "",
    );

    await new GitHubTicketingAdapter({ run }).upsertComment(
      alpha,
      7,
      marker,
      body,
    );

    expect(calls[1].args.slice(0, 3)).toEqual(["issue", "comment", "7"]);
    expect(calls).toHaveLength(2);
    expect(calls.flatMap((call) => call.args)).not.toContain("PATCH");
  });

  it("refuses to guess when the comment it must edit has no address", async () => {
    const { run } = fakeRunner(
      JSON.stringify({
        comments: [
          {
            author: { login: "fvermaut" },
            body: `${MACHINE_MARKER}\n\n---\n\n${marker}\n\nstale`,
            createdAt: "2026-08-08T10:00:00Z",
          },
        ],
      }),
    );

    // Posting instead would leave two calls to action on the ticket, one of
    // them stale — the outcome editing exists to prevent.
    await expect(
      new GitHubTicketingAdapter({ run }).upsertComment(alpha, 7, marker, body),
    ).rejects.toThrow(/no url/);
  });
});
