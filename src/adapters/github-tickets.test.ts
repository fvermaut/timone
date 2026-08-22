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

describe("listOpenTickets", () => {
  it("asks gh for every open issue, with no label filter at all", async () => {
    // The discriminating assertion is the absence: `--label` present here
    // would make this listing a second copy of the marked one, and the
    // unmarked ticket ADR-0024 exists for would stay invisible.
    const { run, calls } = fakeRunner(JSON.stringify([ghIssue()]));
    await new GitHubTicketingAdapter({ run }).listOpenTickets(alpha);

    expect(calls).toHaveLength(1);
    expect(calls[0].command).toBe("gh");
    const args = calls[0].args;
    expect(args.slice(0, 2)).toEqual(["issue", "list"]);
    expect(args).not.toContain("--label");
    expect(args[args.indexOf("--repo") + 1]).toBe("fvermaut/scratch-app");
    expect(args[args.indexOf("--state") + 1]).toBe("open");
  });

  it("returns an unlabelled issue, which the marked listing never would", async () => {
    const { run } = fakeRunner(
      JSON.stringify([ghIssue({ number: 5, labels: [] })]),
    );

    const tickets = await new GitHubTicketingAdapter({ run }).listOpenTickets(
      alpha,
    );

    expect(tickets).toHaveLength(1);
    expect(tickets[0].number).toBe(5);
    expect(tickets[0].labels).toEqual([]);
  });

  it("orders tickets oldest first regardless of gh's order", async () => {
    const { run } = fakeRunner(
      JSON.stringify([
        ghIssue({ number: 9, createdAt: "2026-08-02T12:00:00Z" }),
        ghIssue({ number: 4, createdAt: "2026-08-01T09:00:00Z", labels: [] }),
      ]),
    );
    const tickets = await new GitHubTicketingAdapter({ run }).listOpenTickets(
      alpha,
    );
    expect(tickets.map((ticket) => ticket.number)).toEqual([4, 9]);
  });

  it("refuses to truncate silently at the page limit", async () => {
    // A backlog is precisely where this listing gets large, and a truncated
    // one would introduce Timone to an arbitrary page of it.
    const page = [ghIssue({ number: 1 }), ghIssue({ number: 2 })];
    const { run } = fakeRunner(JSON.stringify(page));

    await expect(
      new GitHubTicketingAdapter({ run, pageLimit: 2 }).listOpenTickets(alpha),
    ).rejects.toThrow(/page limit/i);
  });

  it("fails loudly with the raw payload when gh returns nonsense", async () => {
    const { run } = fakeRunner("not json at all");
    await expect(
      new GitHubTicketingAdapter({ run }).listOpenTickets(alpha),
    ).rejects.toThrow(/not json at all/);
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

  it("knows its own comment by its author once it has an identity", async () => {
    const { run } = fakeRunner(
      JSON.stringify(
        ghIssue({
          comments: [
            {
              // No marker: written by a stage that posted through the forge
              // rather than through `postComment`.
              author: { login: "timone-agent[bot]" },
              body: "Picked this up.",
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

    const thread = await new GitHubTicketingAdapter({
      run,
      machineLogin: "timone-agent[bot]",
    }).getTicket(alpha, 7);

    expect(thread.comments.map((comment) => comment.fromTimone)).toEqual([
      true,
      false,
    ]);
  });

  it("knows the same bot under either spelling the forge uses for it", async () => {
    // GitHub renders one identity two ways, and this adapter reads both
    // surfaces: GraphQL — which `gh --json` speaks — answers `timone-agent`,
    // while REST answers `timone-agent[bot]`. Watched on `fvermaut/scratch-app`
    // on 2026-08-22. A comparison against one spelling silently fails to
    // recognise half of Timone's own comments.
    const { run } = fakeRunner(
      JSON.stringify(
        ghIssue({
          comments: [
            {
              author: { login: "timone-agent" },
              body: "Read on the GraphQL surface.",
              createdAt: "2026-08-02T10:05:00Z",
            },
            {
              author: { login: "timone-agent[bot]" },
              body: "Read on the REST surface.",
              createdAt: "2026-08-02T10:06:00Z",
            },
            {
              author: { login: "timone-agent-helper" },
              body: "A different account whose name merely starts the same.",
              createdAt: "2026-08-02T10:07:00Z",
            },
          ],
        }),
      ),
    );

    const thread = await new GitHubTicketingAdapter({
      run,
      machineLogin: "timone-agent[bot]",
    }).getTicket(alpha, 7);

    expect(thread.comments.map((comment) => comment.fromTimone)).toEqual([
      true,
      true,
      false,
    ]);
  });

  it("keeps the marker fallback, so history written under a borrowed login still reads right", async () => {
    const { run } = fakeRunner(
      JSON.stringify(
        ghIssue({
          comments: [
            {
              // Every comment Timone wrote before it had an identity is
              // authored by fvermaut. Losing them would make a whole backlog
              // of the machine's own questions read as the human's answers.
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

    const thread = await new GitHubTicketingAdapter({
      run,
      machineLogin: "timone-agent[bot]",
    }).getTicket(alpha, 7);

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

/**
 * A `gh issue list --json …` element carrying the step fields, in gh's real
 * shape — verified against `fvermaut/scratch-app` on 2026-08-21, including the
 * fields the adapter ignores.
 */
function ghStep(overrides: Record<string, unknown> = {}): unknown {
  return {
    ...(ghIssue() as Record<string, unknown>),
    number: 51,
    title: "The ledger learns steps",
    state: "OPEN",
    closed: false,
    assignees: [],
    blockedBy: { nodes: [], totalCount: 0 },
    parent: {
      id: "I_kwDOTmd-IM8AAAABNssLJA",
      number: 50,
      state: "OPEN",
      title: "the lists could be smarter",
      url: "https://github.com/fvermaut/scratch-app/issues/50",
    },
    ...overrides,
  };
}

/** One `blockedBy` node, as gh returns it — its own state, and its own repo. */
function ghDependency(
  number: number,
  state: "OPEN" | "CLOSED",
  repo = "fvermaut/scratch-app",
): unknown {
  return {
    id: `I_${number}`,
    number,
    state,
    title: `whatever #${number} is`,
    url: `https://github.com/${repo}/issues/${number}`,
  };
}

/** The parent every step in these tests hangs from. */
const INITIATIVE = 50;

describe("listSteps", () => {
  it("asks gh for both states and for every field a step needs", async () => {
    const { run, calls } = fakeRunner(JSON.stringify([]));

    await new GitHubTicketingAdapter({ run }).listSteps(alpha, INITIATIVE);

    expect(calls).toHaveLength(1);
    expect(calls[0].args).toContain("all");
    const fields = calls[0].args[calls[0].args.indexOf("--json") + 1];
    for (const field of [
      "state",
      "labels",
      "assignees",
      "blockedBy",
      "parent",
    ]) {
      expect(fields).toContain(field);
    }
  });

  /**
   * (1) The breakdown's order, not the tracker's. 29c opens the step tickets
   * in the order the human approved, so ascending number *is* that order —
   * whereas gh answers newest first, which would run the initiative backwards.
   */
  it("returns the children in the breakdown's order, not the tracker's", async () => {
    const { run } = fakeRunner(
      JSON.stringify([
        ghStep({ number: 53 }),
        ghStep({ number: 51 }),
        ghStep({ number: 52 }),
        ghStep({ number: 60, parent: null }),
      ]),
    );

    const steps = await new GitHubTicketingAdapter({ run }).listSteps(
      alpha,
      INITIATIVE,
    );

    expect(steps.map((s) => s.number)).toEqual([51, 52, 53]);
  });

  /** (2) No dependency at all is unblocked — not malformed, not incomplete. */
  it("reads a child with no dependencies as free", async () => {
    const { run } = fakeRunner(JSON.stringify([ghStep()]));

    const [step] = await new GitHubTicketingAdapter({ run }).listSteps(
      alpha,
      INITIATIVE,
    );

    expect(step.blockedBy).toEqual([]);
    expect(step.dependenciesIncomplete).toBe(false);
    expect(step.bodyDependencyLine).toBeUndefined();
  });

  /**
   * (3) A dependency list the tracker counted but did not hand over. The step
   * waits on something nobody can name, and saying so is the whole point: a
   * step that should have been held back and was not is the failure mode
   * ADR-0040 names as the one to watch.
   */
  it("reports an incomplete dependency list rather than reading it as free", async () => {
    const { run } = fakeRunner(
      JSON.stringify([
        ghStep({
          blockedBy: { nodes: [ghDependency(49, "CLOSED")], totalCount: 2 },
        }),
      ]),
    );

    const [step] = await new GitHubTicketingAdapter({ run }).listSteps(
      alpha,
      INITIATIVE,
    );

    expect(step.dependenciesIncomplete).toBe(true);
  });

  /**
   * (4) The body line is read and refused, never parsed. A human following
   * the wayfinding skill's prose writes one in good faith; the machine says
   * it saw it and does not respect it, rather than walking straight past a
   * dependency they thought they had declared.
   */
  it("reports a `Blocked by:` line in the body without acting on it", async () => {
    const { run } = fakeRunner(
      JSON.stringify([
        ghStep({ body: "does the thing\n\nBlocked by: #49, #48\n" }),
      ]),
    );

    const [step] = await new GitHubTicketingAdapter({ run }).listSteps(
      alpha,
      INITIATIVE,
    );

    expect(step.bodyDependencyLine).toBe("Blocked by: #49, #48");
    expect(step.blockedBy).toEqual([]);
  });

  /**
   * (5) The machine's hold, on the label. An implementation that reads the
   * assignees alone sees nothing here and reports the step as free — and then
   * the daemon rebuilds work that was deliberately stopped, with every call
   * succeeding.
   */
  it("reads a child carrying the hold label as held", async () => {
    const { run } = fakeRunner(
      JSON.stringify([
        ghStep({
          labels: [
            { id: "L1", name: MARK_LABEL, description: "", color: "ededed" },
            { id: "L2", name: "timone:held", description: "", color: "ededed" },
          ],
        }),
      ]),
    );

    const [step] = await new GitHubTicketingAdapter({ run }).listSteps(
      alpha,
      INITIATIVE,
    );

    expect(step.labels).toEqual([MARK_LABEL, "timone:held"]);
  });

  /** (6) A human's takeover, on the other field. Both halves or neither. */
  it("reads a child assigned to a person as claimed by that person", async () => {
    const { run } = fakeRunner(
      JSON.stringify([
        ghStep({
          assignees: [
            {
              id: "MDQ6VXNlcjQzMDA3Mjcw",
              login: "fvermaut",
              name: "François Vermaut",
              databaseId: 43007270,
            },
          ],
        }),
      ]),
    );

    const [step] = await new GitHubTicketingAdapter({ run }).listSteps(
      alpha,
      INITIATIVE,
    );

    expect(step.assignees).toEqual(["fvermaut"]);
  });

  it("carries a closed child, and its state, rather than hiding it", async () => {
    const { run } = fakeRunner(
      JSON.stringify([ghStep({ state: "CLOSED", closed: true })]),
    );

    const [step] = await new GitHubTicketingAdapter({ run }).listSteps(
      alpha,
      INITIATIVE,
    );

    expect(step.state).toBe("closed");
  });

  /**
   * A dependency's number says nothing about which repository it lives in —
   * `timone#8` and `scratch-app#8` are the same number — so its own state
   * travels with it and no number is ever looked up.
   */
  it("keeps a dependency's own state, including one in another repository", async () => {
    const { run } = fakeRunner(
      JSON.stringify([
        ghStep({
          blockedBy: {
            nodes: [
              ghDependency(8, "OPEN", "fvermaut/timone"),
              ghDependency(49, "CLOSED"),
            ],
            totalCount: 2,
          },
        }),
      ]),
    );

    const [step] = await new GitHubTicketingAdapter({ run }).listSteps(
      alpha,
      INITIATIVE,
    );

    expect(step.blockedBy).toEqual([
      {
        number: 8,
        url: "https://github.com/fvermaut/timone/issues/8",
        open: true,
      },
      {
        number: 49,
        url: "https://github.com/fvermaut/scratch-app/issues/49",
        open: false,
      },
    ]);
    expect(step.dependenciesIncomplete).toBe(false);
  });

  it("reaches no network", async () => {
    const { run, calls } = fakeRunner(JSON.stringify([ghStep()]));

    await new GitHubTicketingAdapter({ run }).listSteps(alpha, INITIATIVE);

    expect(calls.every((c) => c.command === "gh")).toBe(true);
  });
});

describe("the writes that open an initiative's steps", () => {
  it("creates a step as a child of its initiative, in one call", async () => {
    const { run, calls } = fakeRunner(
      "https://github.com/fvermaut/scratch-app/issues/51\n",
    );

    const number = await new GitHubTicketingAdapter({ run }).createStep(
      alpha,
      INITIATIVE,
      { title: "The ledger learns steps", body: "does the thing" },
    );

    expect(number).toBe(51);
    expect(calls[0].args).toEqual([
      "issue",
      "create",
      "--repo",
      "fvermaut/scratch-app",
      "--title",
      "The ledger learns steps",
      "--body",
      "does the thing",
      "--label",
      MARK_LABEL,
      "--parent",
      String(INITIATIVE),
    ]);
  });

  /**
   * A step is born carrying neither half of a claim. A step born held, or
   * born assigned, is one the frontier never returns — and fourteen of them
   * is an initiative that never starts.
   */
  it("creates a step carrying neither the hold label nor an assignee", async () => {
    const { run, calls } = fakeRunner(
      "https://github.com/fvermaut/scratch-app/issues/51\n",
    );

    await new GitHubTicketingAdapter({ run }).createStep(alpha, INITIATIVE, {
      title: "The ledger learns steps",
      body: "does the thing",
    });

    expect(calls[0].args).not.toContain("timone:held");
    expect(calls[0].args).not.toContain("--assignee");
  });

  it("refuses a create whose answer is not an issue url", async () => {
    const { run } = fakeRunner("something went sideways\n");

    await expect(
      new GitHubTicketingAdapter({ run }).createStep(alpha, INITIATIVE, {
        title: "The ledger learns steps",
        body: "does the thing",
      }),
    ).rejects.toThrow(/issue url/i);
  });

  it("declares a dependency as the native relation", async () => {
    const { run, calls } = fakeRunner("");

    await new GitHubTicketingAdapter({ run }).blockStep(alpha, 52, 51);

    expect(calls[0].args).toEqual([
      "issue",
      "edit",
      "52",
      "--repo",
      "fvermaut/scratch-app",
      "--add-blocked-by",
      "51",
    ]);
  });

  it("rewrites an initiative's body into the map of its steps", async () => {
    const { run, calls } = fakeRunner("");

    await new GitHubTicketingAdapter({ run }).setTicketBody(
      alpha,
      INITIATIVE,
      "1. #51\n2. #52",
    );

    expect(calls[0].args).toEqual([
      "issue",
      "edit",
      String(INITIATIVE),
      "--repo",
      "fvermaut/scratch-app",
      "--body",
      "1. #51\n2. #52",
    ]);
  });

  it("creates the hold label when it is missing", async () => {
    const { run, calls } = fakeRunner("");

    await new GitHubTicketingAdapter({ run }).ensureLabel(
      alpha,
      "timone:held",
      "Timone stopped this step and will not take it up again",
    );

    expect(calls[0].args.slice(0, 4)).toEqual([
      "label",
      "create",
      "timone:held",
      "--repo",
    ]);
  });

  /**
   * `gh label create` fails on a duplicate, and a label that already exists is
   * the ordinary case on every run after the first. Swallowing that one
   * failure is the create-or-ignore this slice's idempotence needs; any other
   * failure still travels.
   */
  it("treats a label that already exists as done, not as a failure", async () => {
    const run: CommandRunner = async () => {
      throw new Error("failed to create label: already exists");
    };

    await expect(
      new GitHubTicketingAdapter({ run }).ensureLabel(alpha, "timone:held"),
    ).resolves.toBeUndefined();
  });

  it("lets any other label failure travel", async () => {
    const run: CommandRunner = async () => {
      throw new Error("HTTP 403: Resource not accessible by integration");
    };

    await expect(
      new GitHubTicketingAdapter({ run }).ensureLabel(alpha, "timone:held"),
    ).rejects.toThrow(/403/);
  });
});
