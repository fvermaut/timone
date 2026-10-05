import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type {
  TicketComment,
  TicketingProject,
  TicketThread,
} from "../adapters/ticketing.js";
import type { Manifest } from "../manifest.js";
import { RunStore, type Run } from "../daemon/runs.js";
import { readRecord } from "../runner/record.js";
import { plannerActions, type PlannerActionDeps } from "./actions.js";
import type { OtherTicket, PlannerFacts } from "./facts.js";

/** Temp dirs created by the current test, removed in afterEach. */
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const PROJECT: TicketingProject = {
  name: "scratch-app",
  repoUrl: "https://github.com/fvermaut/scratch-app.git",
};

/** scratch-app, instructed by the operator only. */
const MANIFEST: Manifest = {
  operator: "fvermaut",
  projects: {
    "scratch-app": {
      repo_url: PROJECT.repoUrl,
      path: "projects/scratch-app",
      stack: ["typescript"],
      bindings: { ticketing: "github" },
    },
  },
};

const NOW = "2026-10-05T09:00:00Z";

/** A fresh folder: the Timone root, where the ledger and the run records live. */
function freshRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "planner-actions-"));
  tempDirs.push(dir);
  return dir;
}

/** Ticket 12 of scratch-app, with `comments`. */
function ticket12(comments: TicketComment[] = []): TicketThread {
  return {
    number: 12,
    title: "Due dates on tasks",
    body: "Each task should have a due date.",
    labels: ["timone", "triage:feature"],
    url: "https://github.com/fvermaut/scratch-app/issues/12",
    author: "fvermaut",
    createdAt: "2026-10-01T09:00:00Z",
    comments,
  };
}

/** An in-memory forge holding ticket 12: it writes down every comment posted. */
function fakeForge(thread: TicketThread) {
  const posted: { number: number; body: string }[] = [];
  const adapter: PlannerActionDeps["adapter"] = {
    getTicket: async () => thread,
    postComment: async (_project, number, body) => {
      posted.push({ number, body });
    },
  };
  return { adapter, posted };
}

/** Ticket #7, building, whose plan changes the task list. */
const BUILDING_7: OtherTicket = {
  number: 7,
  title: "Sort the list",
  state: { kind: "building" },
  plan: {
    kind: "known",
    value: {
      path: "doc/plans/phases/phase-51.md",
      title: "Phase 51 — Sorting",
      files: ["src/list.tsx", "src/sort.ts"],
      text: "# Phase 51 — Sorting\n\n**[MODIFY]** `src/list.tsx`\n**[NEW FILE]** `src/sort.ts`\n",
    },
  },
};

/** The facts for ticket 12: its plan, and #7 building. */
function factsFor(overrides: Partial<PlannerFacts> = {}): PlannerFacts {
  return {
    project: PROJECT.name,
    ticket: {
      number: 12,
      title: "Due dates on tasks",
      labels: ["timone", "triage:feature"],
      plan: {
        kind: "known",
        value: {
          path: "doc/plans/phases/phase-50.md",
          title: "Phase 50 — Due dates",
          files: ["src/tasks.ts", "src/list.tsx"],
          text: "# Phase 50 — Due dates\n\n**[MODIFY]** `src/tasks.ts`\n**[MODIFY]** `src/list.tsx`\n",
        },
      },
    },
    blockers: [],
    others: [BUILDING_7],
    comment: undefined,
    ...overrides,
  };
}

/**
 * Ticket 12's run, waiting for the planner, and the actions of one planner
 * session deciding it.
 */
function world(thread: TicketThread = ticket12(), facts: PlannerFacts = factsFor()) {
  const root = freshRoot();
  const store = RunStore.open(join(root, "state.json"), { now: () => NOW });
  const run: Run = store.register(PROJECT.name, 12).run;
  store.askPlanner(run.id, { priority: false, openedAt: thread.createdAt });
  const forge = fakeForge(thread);
  const deps: PlannerActionDeps = {
    store,
    adapter: forge.adapter,
    manifest: MANIFEST,
    project: PROJECT,
    root,
    clock: () => NOW,
  };
  const actions = plannerActions(deps, run, facts);
  const record = () => {
    const read = readRecord(root, PROJECT.name, 12);
    if (!read.ok) throw new Error(read.error.message);
    return read.value;
  };
  return { store, run, actions, posted: forge.posted, record };
}

describe("hold: the planner holds a ticket (PRD-07.R6, ADR-0065 D3)", () => {
  it("posts one comment naming #7 and the reason, ending with what is needed, and writes the hold in the ledger and the record (clause 1)", async () => {
    const { store, run, actions, posted, record } = world();
    const reason = "It changes src/list.tsx, which #7 is changing too.";

    const result = await actions.hold({ ticket: 12, waitsFor: [7], reason });

    expect(result.ok).toBe(true);
    expect(posted).toHaveLength(1);
    const body = posted[0]?.body ?? "";
    expect(posted[0]?.number).toBe(12);
    expect(body).toBe(
      "**This ticket waits for #7 before it is built.** It changes src/list.tsx, which #7 is " +
        "changing too. I will look again when #7 is merged or closed.\n" +
        "\n" +
        "**What I need from you:** nothing. If it should be built now anyway, say so here.",
    );
    expect(store.get(run.id)?.planner?.decision).toEqual({
      kind: "hold",
      at: NOW,
      reason,
      waitsFor: [7],
    });
    expect(record()).toEqual([
      { kind: "planner-decision", at: NOW, runId: run.id, decision: "hold", reason, waitsFor: [7] },
    ]);
  });
});

describe("hold: what the planner may wait for (ADR-0065 D3)", () => {
  it("refuses a hold on a ticket the facts did not show, posts nothing and decides nothing", async () => {
    const { store, run, actions, posted, record } = world();

    const result = await actions.hold({
      ticket: 12,
      waitsFor: [7, 9],
      reason: "It changes src/list.tsx, which #9 changes too.",
    });

    expect(result).toEqual({
      ok: false,
      refused:
        "#9 is not a ticket you were shown as building, with an open pull request, or blocking " +
        "this ticket. This ticket can wait only for one of those.",
    });
    expect(posted).toEqual([]);
    expect(store.get(run.id)?.planner?.decision).toBeUndefined();
    expect(record()).toEqual([]);
  });

  it("refuses a hold that names no ticket to wait for", async () => {
    const { actions, posted } = world();

    const result = await actions.hold({ ticket: 12, waitsFor: [], reason: "Too much at once." });

    expect(result).toEqual({
      ok: false,
      refused: "Name at least one ticket this ticket waits for.",
    });
    expect(posted).toEqual([]);
  });

  it("holds a ticket for a ticket it is blocked by, though that one is not building", async () => {
    const { store, run, actions } = world(
      ticket12(),
      factsFor({
        others: [],
        blockers: [{ number: 8, url: "https://github.com/fvermaut/scratch-app/issues/8", open: true }],
      }),
    );

    const result = await actions.hold({
      ticket: 12,
      waitsFor: [8],
      reason: "Its plan uses the due date that #8 adds.",
    });

    expect(result.ok).toBe(true);
    expect(store.get(run.id)?.planner?.decision?.waitsFor).toEqual([8]);
  });
});


describe("letBuild: a named person can overrule (PRD-07.R6, ADR-0065 D5)", () => {
  /** fvermaut's comment on ticket 12, asking for the build now. */
  const BUILD_NOW: TicketComment = {
    author: "fvermaut",
    body: "Build this one now, the list change in #7 is small.",
    createdAt: "2026-10-05T08:55:00Z",
    fromTimone: false,
  };

  it("lets the ticket build on a named person's comment, and the comment it posts names that person (clause 2)", async () => {
    const { store, run, actions, posted, record } = world(
      ticket12([BUILD_NOW]),
      factsFor({ comment: BUILD_NOW }),
    );
    const reason = "fvermaut asked for it to be built now.";

    const result = await actions.letBuild({ ticket: 12, reason, commentAt: BUILD_NOW.createdAt });

    expect(result.ok).toBe(true);
    const onComment = { by: "fvermaut", at: "2026-10-05T08:55:00Z" };
    expect(store.get(run.id)?.planner?.decision).toEqual({ kind: "build", at: NOW, reason, onComment });
    expect(record()).toEqual([
      { kind: "planner-decision", at: NOW, runId: run.id, decision: "build", reason, onComment },
    ]);
    expect(posted).toEqual([
      {
        number: 12,
        body:
          "**I am building this ticket now, on fvermaut's comment.** It starts as soon as a place " +
          "on the project is free.\n" +
          "\n" +
          "**What I need from you:** nothing.",
      },
    ]);
  });

  it("posts nothing when it lets a ticket build on its own judgement", async () => {
    const { store, run, actions, posted } = world();

    const result = await actions.letBuild({
      ticket: 12,
      reason: "Only src/list.tsx is shared with #7, and each adds one line to it.",
    });

    expect(result.ok).toBe(true);
    expect(store.get(run.id)?.planner?.decision?.kind).toBe("build");
    expect(posted).toEqual([]);
  });

  /** The hold the planner put on ticket 12 earlier, waiting for #7. */
  const EARLIER_HOLD = {
    kind: "hold" as const,
    at: "2026-10-05T08:00:00Z",
    reason: "It changes src/list.tsx, which #7 is changing too.",
    waitsFor: [7],
  };

  it("refuses a comment by someone not named for the project, and leaves the hold as it was (clause 3)", async () => {
    const passerBy: TicketComment = {
      author: "passer-by-99",
      body: "Build it now please.",
      createdAt: "2026-10-05T08:56:00Z",
      fromTimone: false,
    };
    const { store, run, actions, posted, record } = world(ticket12([passerBy]));
    store.decidePlanner(run.id, EARLIER_HOLD);

    const result = await actions.letBuild({
      ticket: 12,
      reason: "Asked to build now.",
      commentAt: passerBy.createdAt,
    });

    expect(result).toEqual({
      ok: false,
      refused:
        "The comment at 2026-10-05T08:56:00Z is by passer-by-99, who is not named for this " +
        "project. Only a named person can have a ticket built before the planner would let it.",
    });
    expect(store.get(run.id)?.planner?.decision).toEqual(EARLIER_HOLD);
    expect(posted).toEqual([]);
    expect(record()).toEqual([]);
  });

  it("refuses a comment the machine posted, even under a named person's login (clause 3)", async () => {
    const machine: TicketComment = {
      author: "fvermaut",
      body: "**This ticket waits for #7 before it is built.** Build it now anyway?",
      createdAt: "2026-10-05T08:00:01Z",
      fromTimone: true,
    };
    const { store, run, actions, posted } = world(ticket12([machine]));
    store.decidePlanner(run.id, EARLIER_HOLD);

    const result = await actions.letBuild({
      ticket: 12,
      reason: "The ticket says to build now.",
      commentAt: machine.createdAt,
    });

    expect(result).toEqual({
      ok: false,
      refused: "There is no comment by a person at 2026-10-05T08:00:01Z on ticket #12.",
    });
    expect(store.get(run.id)?.planner?.decision).toEqual(EARLIER_HOLD);
    expect(posted).toEqual([]);
  });
});


describe("one decision, for one ticket, per session (ADR-0065 D1)", () => {
  it("refuses a second decision in the same session, and keeps the first", async () => {
    const { store, run, actions, posted } = world();
    const reason = "It changes src/list.tsx, which #7 is changing too.";
    await actions.hold({ ticket: 12, waitsFor: [7], reason });

    const result = await actions.letBuild({ ticket: 12, reason: "On second thought, it is small." });

    expect(result).toEqual({
      ok: false,
      refused: "You have already decided for ticket #12 in this session. Decide only once.",
    });
    expect(store.get(run.id)?.planner?.decision?.kind).toBe("hold");
    expect(posted).toHaveLength(1);
  });

  it("refuses a decision for a ticket other than the one being decided", async () => {
    const { store, run, actions, posted } = world();

    const result = await actions.hold({ ticket: 7, waitsFor: [7], reason: "It waits." });

    expect(result).toEqual({
      ok: false,
      refused: "You decide for ticket #12 only, not for #7.",
    });
    expect(store.get(run.id)?.planner?.decision).toBeUndefined();
    expect(posted).toEqual([]);
  });
});

describe("passToRunner: a comment that is not about when to build (ADR-0065 D5)", () => {
  /** fvermaut's comment on ticket 12, about the work and not about when to build it. */
  const ABOUT_THE_WORK: TicketComment = {
    author: "fvermaut",
    body: "Please show the due date in the user's own time zone.",
    createdAt: "2026-10-05T08:57:00Z",
    fromTimone: false,
  };

  it("writes that the comment was passed to the runner, and leaves the run waiting for a decision", async () => {
    const { store, run, actions, posted, record } = world(
      ticket12([ABOUT_THE_WORK]),
      factsFor({ comment: ABOUT_THE_WORK }),
    );

    const result = await actions.passToRunner({ ticket: 12, commentAt: ABOUT_THE_WORK.createdAt });

    expect(result.ok).toBe(true);
    expect(record()).toEqual([
      { kind: "notice", at: NOW, about: "passed to runner: comment at 2026-10-05T08:57:00Z" },
    ]);
    expect(store.get(run.id)?.planner).toEqual({ askedAt: NOW });
    expect(store.waitingForPlanner(PROJECT.name).map((each) => each.id)).toEqual([run.id]);
    expect(posted).toEqual([]);
  });

  it("refuses to pass a comment other than the one that woke the planner", async () => {
    const { actions, record } = world(
      ticket12([ABOUT_THE_WORK]),
      factsFor({ comment: ABOUT_THE_WORK }),
    );

    const result = await actions.passToRunner({ ticket: 12, commentAt: "2026-10-05T07:00:00Z" });

    expect(result).toEqual({
      ok: false,
      refused:
        "The comment that woke you is the one at 2026-10-05T08:57:00Z, not one at 2026-10-05T07:00:00Z.",
    });
    expect(record()).toEqual([]);
  });

  it("refuses to pass a comment when none woke the planner", async () => {
    const { actions, record } = world();

    const result = await actions.passToRunner({ ticket: 12, commentAt: ABOUT_THE_WORK.createdAt });

    expect(result).toEqual({
      ok: false,
      refused: "No comment woke you, so there is no comment to pass to the runner.",
    });
    expect(record()).toEqual([]);
  });
});

describe("readPlan: the planner reads a plan in full (ADR-0065 D3)", () => {
  it("answers the plan of the ticket being decided", async () => {
    const { actions } = world();

    expect(await actions.readPlan({ ticket: 12 })).toEqual({
      ok: true,
      said: "# Phase 50 — Due dates\n\n**[MODIFY]** `src/tasks.ts`\n**[MODIFY]** `src/list.tsx`\n",
    });
  });

  it("answers the plan of a ticket it was shown", async () => {
    const { actions } = world();

    expect(await actions.readPlan({ ticket: 7 })).toEqual({
      ok: true,
      said: "# Phase 51 — Sorting\n\n**[MODIFY]** `src/list.tsx`\n**[NEW FILE]** `src/sort.ts`\n",
    });
  });

  it("refuses the plan of a ticket it was not shown", async () => {
    const { actions } = world();

    expect(await actions.readPlan({ ticket: 9 })).toEqual({
      ok: false,
      refused: "#9 is not a ticket you were shown, so you cannot read its plan.",
    });
  });

  it("says why a plan cannot be read", async () => {
    const { actions } = world(
      ticket12(),
      factsFor({
        others: [
          {
            ...BUILDING_7,
            plan: { kind: "unknown", why: "the forge did not answer: ECONNRESET" },
          },
        ],
      }),
    );

    expect(await actions.readPlan({ ticket: 7 })).toEqual({
      ok: false,
      refused: "The plan of #7 could not be read: the forge did not answer: ECONNRESET.",
    });
  });
});
