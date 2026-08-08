import { describe, expect, it } from "vitest";

import {
  MACHINE_MARKER,
  PREVIEW_MARKER,
  type TicketingProject,
} from "./ticketing.js";
import { GitHubTicketingAdapter, type CommandRunner } from "./github-tickets.js";

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

/** A `gh pr list --json …` element as GitHub actually returns it. */
function ghPull(overrides: Record<string, unknown> = {}): unknown {
  return {
    number: 9,
    title: "Typing in the box is fiddly on my phone",
    url: "https://github.com/fvermaut/scratch-app/pull/9",
    state: "OPEN",
    headRefOid: "9f1c0d3ab2e4f5061728394a5b6c7d8e9f0a1b2c",
    createdAt: "2026-08-06T10:00:00Z",
    ...overrides,
  };
}

describe("findPullRequest", () => {
  it("finds the pull request whose head is the branch, mapping gh's state", async () => {
    const { run, calls } = fakeRunner(JSON.stringify([ghPull()]));
    const adapter = new GitHubTicketingAdapter({ run });

    const pr = await adapter.findPullRequest(alpha, "timone/6-fiddly-box");

    expect(pr).toEqual({
      headSha: "9f1c0d3ab2e4f5061728394a5b6c7d8e9f0a1b2c",
      number: 9,
      title: "Typing in the box is fiddly on my phone",
      url: "https://github.com/fvermaut/scratch-app/pull/9",
      state: "open",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].command).toBe("gh");
    expect(calls[0].args).toContain("--head");
    expect(calls[0].args).toContain("timone/6-fiddly-box");
    expect(calls[0].args).toContain("fvermaut/scratch-app");
  });

  it.each([
    ["MERGED", "merged"],
    ["CLOSED", "closed"],
    ["OPEN", "open"],
  ])("maps gh state %s to %s", async (ghState, expected) => {
    const { run } = fakeRunner(JSON.stringify([ghPull({ state: ghState })]));
    const adapter = new GitHubTicketingAdapter({ run });

    const pr = await adapter.findPullRequest(alpha, "timone/6-fiddly-box");

    expect(pr?.state).toBe(expected);
  });

  it("returns undefined when no pull request exists for the branch", async () => {
    const { run } = fakeRunner(JSON.stringify([]));
    const adapter = new GitHubTicketingAdapter({ run });

    await expect(
      adapter.findPullRequest(alpha, "timone/6-fiddly-box"),
    ).resolves.toBeUndefined();
  });

  it("prefers open over merged over closed when the branch has several", async () => {
    const { run } = fakeRunner(
      JSON.stringify([
        ghPull({ number: 3, state: "CLOSED" }),
        ghPull({ number: 5, state: "MERGED" }),
        ghPull({ number: 9, state: "OPEN" }),
      ]),
    );
    const adapter = new GitHubTicketingAdapter({ run });

    const pr = await adapter.findPullRequest(alpha, "timone/6-fiddly-box");

    expect(pr?.number).toBe(9);
  });

  it("prefers merged over closed when nothing is open", async () => {
    const { run } = fakeRunner(
      JSON.stringify([
        ghPull({ number: 3, state: "CLOSED" }),
        ghPull({ number: 5, state: "MERGED" }),
      ]),
    );
    const adapter = new GitHubTicketingAdapter({ run });

    const pr = await adapter.findPullRequest(alpha, "timone/6-fiddly-box");

    expect(pr?.number).toBe(5);
  });

  it("fails loudly on an unparseable payload rather than yielding undefined", async () => {
    const { run } = fakeRunner("not json");
    const adapter = new GitHubTicketingAdapter({ run });

    await expect(
      adapter.findPullRequest(alpha, "timone/6-fiddly-box"),
    ).rejects.toThrow(/not json/);
  });
});

/** Canned payloads for the two calls `getPullRequestThread` makes. */
function prViewPayload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    number: 9,
    title: "Typing in the box is fiddly on my phone",
    url: "https://github.com/fvermaut/scratch-app/pull/9",
    state: "OPEN",
    headRefOid: "9f1c0d3ab2e4f5061728394a5b6c7d8e9f0a1b2c",
    comments: [
      {
        id: "C1",
        author: { login: "fvermaut" },
        body: "Looks close — one nit below.",
        createdAt: "2026-08-06T12:00:00Z",
      },
    ],
    reviews: [
      {
        author: { login: "fvermaut" },
        body: "Requesting one change.",
        state: "CHANGES_REQUESTED",
        submittedAt: "2026-08-06T11:00:00Z",
      },
      {
        author: { login: "fvermaut" },
        body: "",
        state: "COMMENTED",
        submittedAt: "2026-08-06T11:30:00Z",
      },
    ],
    ...overrides,
  });
}

function reviewCommentsPayload(): string {
  return JSON.stringify([
    {
      id: 501,
      user: { login: "fvermaut" },
      body: "Please rename this variable.",
      created_at: "2026-08-06T11:00:05Z",
    },
    {
      id: 502,
      in_reply_to_id: 501,
      user: { login: "fvermaut" },
      body: `${MACHINE_MARKER}\n\n---\n\nDone — renamed in abc1234.`,
      created_at: "2026-08-06T13:00:00Z",
    },
  ]);
}

describe("getPullRequestThread", () => {
  it("merges conversation, review summaries and inline comments oldest first", async () => {
    const { run } = fakeRunner(prViewPayload(), reviewCommentsPayload());
    const adapter = new GitHubTicketingAdapter({ run });

    const thread = await adapter.getPullRequestThread(alpha, 9);

    expect(thread.number).toBe(9);
    expect(thread.state).toBe("open");
    expect(thread.comments.map((comment) => comment.body)).toEqual([
      "Requesting one change.",
      "Please rename this variable.",
      "Looks close — one nit below.",
      `${MACHINE_MARKER}\n\n---\n\nDone — renamed in abc1234.`,
    ]);
  });

  it("derives fromTimone from the marker, never from the author", async () => {
    const { run } = fakeRunner(prViewPayload(), reviewCommentsPayload());
    const adapter = new GitHubTicketingAdapter({ run });

    const thread = await adapter.getPullRequestThread(alpha, 9);

    // Every comment above is posted by the same login; only the marker
    // separates the machine's words from the human's.
    expect(thread.comments.map((comment) => comment.fromTimone)).toEqual([
      false,
      false,
      false,
      true,
    ]);
  });

  it("drops review summaries with empty bodies rather than inventing comments", async () => {
    const { run } = fakeRunner(prViewPayload(), reviewCommentsPayload());
    const adapter = new GitHubTicketingAdapter({ run });

    const thread = await adapter.getPullRequestThread(alpha, 9);

    expect(
      thread.comments.filter((comment) => comment.body === ""),
    ).toHaveLength(0);
  });

  it("gives inline comments the reply id of their thread root", async () => {
    const { run } = fakeRunner(prViewPayload(), reviewCommentsPayload());
    const adapter = new GitHubTicketingAdapter({ run });

    const thread = await adapter.getPullRequestThread(alpha, 9);

    const inline = thread.comments.filter(
      (comment) => comment.replyTo !== undefined,
    );
    // The root inline comment threads under itself; its reply threads under
    // the root, so a reply to either lands in the same thread.
    expect(inline.map((comment) => comment.replyTo)).toEqual(["501", "501"]);
  });

  it("leaves conversation comments and review summaries unthreadable", async () => {
    const { run } = fakeRunner(prViewPayload(), reviewCommentsPayload());
    const adapter = new GitHubTicketingAdapter({ run });

    const thread = await adapter.getPullRequestThread(alpha, 9);

    expect(thread.comments[0].replyTo).toBeUndefined();
    expect(thread.comments[2].replyTo).toBeUndefined();
  });
});

describe("postPullRequestComment", () => {
  it("posts a conversation comment stamped with the machine marker", async () => {
    const { run, calls } = fakeRunner("");
    const adapter = new GitHubTicketingAdapter({ run });

    await adapter.postPullRequestComment(alpha, 9, "All done.");

    expect(calls).toHaveLength(1);
    expect(calls[0].args).toContain("comment");
    const body = calls[0].args[calls[0].args.indexOf("--body") + 1];
    expect(body.startsWith(MACHINE_MARKER)).toBe(true);
    expect(body).toContain("All done.");
  });

  it("threads a reply under an inline review comment, stamped the same way", async () => {
    const { run, calls } = fakeRunner("{}");
    const adapter = new GitHubTicketingAdapter({ run });

    await adapter.postPullRequestComment(alpha, 9, "Renamed.", "501");

    expect(calls).toHaveLength(1);
    const args = calls[0].args;
    expect(args.join(" ")).toContain(
      "repos/fvermaut/scratch-app/pulls/9/comments/501/replies",
    );
    const bodyArg = args.find((arg) => arg.startsWith("body="));
    expect(bodyArg?.slice("body=".length).startsWith(MACHINE_MARKER)).toBe(
      true,
    );
  });

  it("never double-stamps a body that already carries the marker", async () => {
    const { run, calls } = fakeRunner("");
    const adapter = new GitHubTicketingAdapter({ run });

    await adapter.postPullRequestComment(
      alpha,
      9,
      `${MACHINE_MARKER}\n\n---\n\nAll done.`,
    );

    const body = calls[0].args[calls[0].args.indexOf("--body") + 1];
    expect(body.match(new RegExp("🤖", "g"))).toHaveLength(1);
  });
});

describe("closeTicket", () => {
  it("closes a completed ticket with the completed reason", async () => {
    const { run, calls } = fakeRunner("");
    const adapter = new GitHubTicketingAdapter({ run });

    await adapter.closeTicket(alpha, 6, "completed");

    expect(calls[0].args).toEqual([
      "issue",
      "close",
      "6",
      "--repo",
      "fvermaut/scratch-app",
      "--reason",
      "completed",
    ]);
  });

  it("closes declined work as not planned", async () => {
    const { run, calls } = fakeRunner("");
    const adapter = new GitHubTicketingAdapter({ run });

    await adapter.closeTicket(alpha, 6, "not-planned");

    expect(calls[0].args).toContain("not planned");
  });
});

describe("upsertPullRequestComment", () => {
  const preview = `${PREVIEW_MARKER}\n\nOpen it: http://localhost:54321/`;

  /** A comment as `gh pr view --json comments` returns it. */
  function ghComment(body: string, id = 777): unknown {
    return {
      author: { login: "fvermaut" },
      body,
      createdAt: "2026-08-08T10:00:00Z",
      url: `https://github.com/fvermaut/scratch-app/pull/9#issuecomment-${id}`,
    };
  }

  it("edits what it said last time rather than saying it again", async () => {
    const { run, calls } = fakeRunner(
      JSON.stringify({
        comments: [
          ghComment("just a human talking"),
          ghComment(`${MACHINE_MARKER}\n\n---\n\n${PREVIEW_MARKER}\n\nstale`, 42),
        ],
      }),
      "",
    );
    const adapter = new GitHubTicketingAdapter({ run });

    await adapter.upsertPullRequestComment(alpha, 9, PREVIEW_MARKER, preview);

    expect(calls[1]).toEqual({
      command: "gh",
      args: [
        "api",
        "--method",
        "PATCH",
        "repos/fvermaut/scratch-app/issues/comments/42",
        "-f",
        `body=${MACHINE_MARKER}\n\n---\n\n${preview}`,
      ],
    });
  });

  it("posts a first one when it has never said it before", async () => {
    const { run, calls } = fakeRunner(
      JSON.stringify({ comments: [ghComment("just a human talking")] }),
      "",
    );
    const adapter = new GitHubTicketingAdapter({ run });

    await adapter.upsertPullRequestComment(alpha, 9, PREVIEW_MARKER, preview);

    expect(calls[1].args.slice(0, 2)).toEqual(["pr", "comment"]);
    expect(calls[1].args.at(-1)).toBe(`${MACHINE_MARKER}\n\n---\n\n${preview}`);
  });

  it("will not let a human quoting the marker capture the edit", async () => {
    const { run, calls } = fakeRunner(
      // A person pasting the preview comment back into the thread — no
      // machine header, so it is not ours and must not be overwritten.
      JSON.stringify({ comments: [ghComment(`${PREVIEW_MARKER}\n\nis this right?`)] }),
      "",
    );
    const adapter = new GitHubTicketingAdapter({ run });

    await adapter.upsertPullRequestComment(alpha, 9, PREVIEW_MARKER, preview);

    expect(calls[1].args.slice(0, 2)).toEqual(["pr", "comment"]);
  });

  it("refuses to guess when the comment it must edit has no address", async () => {
    const { run } = fakeRunner(
      JSON.stringify({
        comments: [
          {
            author: { login: "fvermaut" },
            body: `${MACHINE_MARKER}\n\n---\n\n${PREVIEW_MARKER}\n\nstale`,
            createdAt: "2026-08-08T10:00:00Z",
          },
        ],
      }),
    );
    const adapter = new GitHubTicketingAdapter({ run });

    // Posting instead would put a near-copy on a client's pull request, which
    // is the one outcome this call exists to prevent.
    await expect(
      adapter.upsertPullRequestComment(alpha, 9, PREVIEW_MARKER, preview),
    ).rejects.toThrow(/no url/);
  });
});
