import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type {
  Dependency,
  PullRequestThread,
  TicketingProject,
  TicketThread,
} from "../adapters/ticketing.js";
import { RunStore } from "../daemon/runs.js";
import { gatherPlannerFacts, type PlannerCycle, type PlannerFactsAdapter } from "./facts.js";

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

const PHASES = "doc/plans/phases";

/** A ledger in a fresh folder, with places enough that none is ever refused. */
function newStore(): RunStore {
  const dir = mkdtempSync(join(tmpdir(), "planner-facts-"));
  tempDirs.push(dir);
  return RunStore.open(join(dir, "state.json"), { placesOf: () => 5 });
}

/** A phase file whose markers name `files`. */
function phase(title: string, files: readonly string[]): string {
  return [
    `# ${title}`,
    "",
    "> **Status:** Approved",
    "",
    ...files.map((file) => `**[MODIFY]** \`${file}\` — a change.`),
  ].join("\n");
}

/**
 * An in-memory forge: the files on each branch, by path, and the files each
 * pull request changes. The default branch is `main`, and holds no phase
 * file that a ticket's branch added.
 */
function fakeForge(
  branches: Record<string, Record<string, string>>,
  pullRequestFiles: Record<number, string[]> = {},
) {
  const asked: number[] = [];
  const adapter: PlannerFactsAdapter = {
    readBranches: async () => ({ defaultBranch: "main" }),
    listFiles: async (_project, branch, directory) => {
      const files = branches[branch];
      if (files === undefined) return undefined;
      return Object.keys(files).filter((path) => path.startsWith(`${directory}/`));
    },
    readFile: async (_project, branch, path) => branches[branch]?.[path],
    listPullRequestFiles: async (_project, pr) => {
      asked.push(pr);
      return pullRequestFiles[pr] ?? [];
    },
  };
  return { adapter, asked };
}

/** A ticket's thread on scratch-app, with no comments. */
function thread(number: number, title: string, labels: string[] = ["timone"]): TicketThread {
  return {
    number,
    title,
    body: "",
    labels,
    url: `https://github.com/fvermaut/scratch-app/issues/${number}`,
    author: "fvermaut",
    createdAt: "2026-10-01T09:00:00Z",
    comments: [],
  };
}

/** A pull request's thread, in the state given. */
function pullRequest(number: number, state: "open" | "merged" | "closed"): PullRequestThread {
  return {
    number,
    title: `The work of pull request #${number}`,
    url: `https://github.com/fvermaut/scratch-app/pull/${number}`,
    state,
    headSha: "abc1234",
    comments: [],
  };
}

/** What a poll cycle hands over: the threads it reads, and the step survey's blockers. */
function cycleOf(
  tickets: readonly TicketThread[],
  pulls: readonly PullRequestThread[] = [],
  blockers: Record<number, Dependency[]> = {},
): PlannerCycle {
  return {
    threads: (number) => ({
      ticket: async () => {
        const found = tickets.find((each) => each.number === number);
        if (found === undefined) throw new Error(`no ticket #${number} in this test`);
        return found;
      },
      pullRequest: async (pr) => {
        const found = pulls.find((each) => each.number === pr);
        if (found === undefined) throw new Error(`no pull request #${pr} in this test`);
        return found;
      },
    }),
    blockedBy: (ticket) => blockers[ticket] ?? [],
  };
}

describe("gatherPlannerFacts: what the planner is told (ADR-0065 D3)", () => {
  it("lists a ticket building and a ticket with an open pull request, each with its files, and not one done or held", async () => {
    const store = newStore();
    const decided = store.register(PROJECT.name, 12).run;
    store.claimBranch(decided.id, "timone/12-due-dates");

    // B: let build, no pull request yet.
    const building = store.register(PROJECT.name, 7).run;
    store.claimBranch(building.id, "timone/7-sorting");
    store.decidePlanner(building.id, { kind: "build", at: "2026-10-05T08:00:00Z", reason: "No overlap." });

    // C: its pull request #30 is open.
    const reviewed = store.register(PROJECT.name, 9).run;
    store.claimBranch(reviewed.id, "timone/9-colours");
    store.decidePlanner(reviewed.id, { kind: "build", at: "2026-10-04T08:00:00Z", reason: "No overlap." });
    store.recordPullRequest(reviewed.id, 30);

    // D: done, though it was let build and has no pull request on the ledger.
    const finished = store.register(PROJECT.name, 5).run;
    store.claimBranch(finished.id, "timone/5-old");
    store.decidePlanner(finished.id, { kind: "build", at: "2026-10-03T08:00:00Z", reason: "No overlap." });
    store.activate(finished.id, "session-5");
    store.complete(finished.id);

    // E: held by the planner, waiting for #7.
    const held = store.register(PROJECT.name, 6).run;
    store.claimBranch(held.id, "timone/6-filters");
    store.decidePlanner(held.id, {
      kind: "hold",
      at: "2026-10-05T08:10:00Z",
      reason: "It changes the same list as #7.",
      waitsFor: [7],
    });

    const { adapter, asked } = fakeForge(
      {
        main: {},
        "timone/12-due-dates": {
          [`${PHASES}/phase-50.md`]: phase("Phase 50 — Due dates", ["src/tasks.ts", "src/list.tsx"]),
        },
        "timone/7-sorting": {
          [`${PHASES}/phase-51.md`]: phase("Phase 51 — Sorting", ["src/list.tsx", "src/sort.ts"]),
        },
        "timone/9-colours": {
          [`${PHASES}/phase-52.md`]: phase("Phase 52 — Colours", ["src/theme.ts"]),
        },
        "timone/5-old": {
          [`${PHASES}/phase-49.md`]: phase("Phase 49 — Old", ["src/tasks.ts"]),
        },
        "timone/6-filters": {
          [`${PHASES}/phase-53.md`]: phase("Phase 53 — Filters", ["src/list.tsx"]),
        },
      },
      { 30: ["src/theme.ts", "src/theme.test.ts"] },
    );
    const cycle = cycleOf(
      [
        thread(12, "Due dates on tasks", ["timone", "triage:feature"]),
        thread(7, "Sort the list"),
        thread(9, "Colours for late tasks"),
        thread(5, "An old ticket"),
        thread(6, "Filters"),
      ],
      [pullRequest(30, "open")],
    );

    const facts = await gatherPlannerFacts({ store, adapter, project: PROJECT }, decided, cycle);

    expect(facts.ticket).toMatchObject({
      number: 12,
      title: "Due dates on tasks",
      labels: ["timone", "triage:feature"],
    });
    expect(facts.ticket.plan).toMatchObject({
      kind: "known",
      value: {
        path: `${PHASES}/phase-50.md`,
        title: "Phase 50 — Due dates",
        files: ["src/tasks.ts", "src/list.tsx"],
      },
    });
    expect(
      facts.others.map((other) => ({
        number: other.number,
        title: other.title,
        state: other.state,
        plan: other.plan.kind === "known" ? other.plan.value?.files : other.plan.why,
      })),
    ).toEqual([
      { number: 7, title: "Sort the list", state: { kind: "building" }, plan: ["src/list.tsx", "src/sort.ts"] },
      {
        number: 9,
        title: "Colours for late tasks",
        state: {
          kind: "open-pull-request",
          pr: 30,
          files: { kind: "known", value: ["src/theme.ts", "src/theme.test.ts"] },
        },
        plan: ["src/theme.ts"],
      },
    ]);
    expect(asked).toEqual([30]);
  });

  it("tells an unreadable plan as a fact with its reason, and takes the blockers from the cycle's survey", async () => {
    const store = newStore();
    const decided = store.register(PROJECT.name, 12).run;
    store.claimBranch(decided.id, "timone/12-due-dates");
    const { adapter } = fakeForge({ main: {}, "timone/12-due-dates": { [`${PHASES}/phase-50.md`]: "" } });
    adapter.readFile = async () => {
      throw new Error("gh api failed after 3 attempts: ECONNRESET");
    };
    const blocker: Dependency = {
      number: 8,
      url: "https://github.com/fvermaut/scratch-app/issues/8",
      open: true,
    };
    const cycle = cycleOf([thread(12, "Due dates on tasks")], [], { 12: [blocker] });

    const facts = await gatherPlannerFacts({ store, adapter, project: PROJECT }, decided, cycle);

    expect(facts.ticket.plan).toEqual({
      kind: "unknown",
      why: "the forge did not answer: gh api failed after 3 attempts: ECONNRESET",
    });
    expect(facts.blockers).toEqual([blocker]);
  });
});
