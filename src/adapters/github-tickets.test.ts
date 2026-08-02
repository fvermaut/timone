import { describe, expect, it } from "vitest";

import { MARK_LABEL, type TicketingProject } from "./ticketing.js";
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
      },
    ]);
  });

  it("reads a thread with no comments as an empty thread", async () => {
    const { run } = fakeRunner(JSON.stringify(ghIssue({ comments: [] })));
    const thread = await new GitHubTicketingAdapter({ run }).getTicket(alpha, 7);
    expect(thread.comments).toEqual([]);
  });
});

describe("postComment", () => {
  it("posts the body verbatim through gh", async () => {
    const { run, calls } = fakeRunner("");
    const body = "Picked this up.\n\n**What I need from you:** nothing yet.";

    await new GitHubTicketingAdapter({ run }).postComment(alpha, 7, body);

    expect(calls[0].args.slice(0, 3)).toEqual(["issue", "comment", "7"]);
    expect(calls[0].args[calls[0].args.indexOf("--body") + 1]).toBe(body);
    expect(calls[0].args[calls[0].args.indexOf("--repo") + 1]).toBe(
      "fvermaut/scratch-app",
    );
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
