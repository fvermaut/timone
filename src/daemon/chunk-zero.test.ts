import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type {
  Dependency,
  Step,
  TicketingAdapter,
  TicketingProject,
} from "../adapters/ticketing.js";
import {
  noBranches,
  noFiles,
  noMerges,
  noRunnerCalls,
  noStepWrites,
} from "../adapters/ticketing.stubs.js";
import {
  openStepTickets,
  tryMergeChunkZero,
  type ChunkZeroDeps,
} from "./chunk-zero.js";
import { RunStore, type Run } from "./runs.js";
import { nextStep } from "./steps.js";

const PROJECT: TicketingProject = {
  name: "ivtrends",
  repoUrl: "https://github.com/fvermaut/ivtrends.git",
};

describe("tryMergeChunkZero, the form the runner uses (40x)", () => {
  it("cannot be written without the approval that allows the merge", () => {
    // PRD-05 R3: only a named person's yes lets work reach a default branch
    // with no pull request. `tsc` fails on this file if the line below ever
    // compiles. It is never run.
    const mergeWithoutApproval = (deps: ChunkZeroDeps, run: Run) =>
      // @ts-expect-error — `tryMergeChunkZero` requires the approval that allows it (R3).
      tryMergeChunkZero(deps, run, PROJECT);
    expect(mergeWithoutApproval).toBeTypeOf("function");
  });
});

/** The initiative whose list of pieces every case here opens. */
const INITIATIVE = 7;

/** The run that approved that list. Only its ticket is read. */
const RUN: Run = {
  id: "ivtrends#7/1",
  project: PROJECT.name,
  ticket: INITIATIVE,
  seq: 1,
  status: "active",
  flags: [],
  createdAt: "2026-10-04T09:00:00.000Z",
  updatedAt: "2026-10-04T09:00:00.000Z",
};

/** The R10 example: 2 and 3 need 1, and 4 needs 2 and 3. */
const R10_LIST = [
  "# Breakdown",
  "",
  "**Status:** Approved by fvermaut 2026-10-04 — 4 pieces",
  "",
  "1. **Tasks** — a task can be written down",
  "2. **Due dates** — a task carries a due date",
  "   - Needs: piece 1.",
  "3. **Owners** — a task names who does it",
  "   - Needs: piece 1.",
  "4. **Reminders** — the owner is reminded before the due date",
  "   - Needs: pieces 2 and 3.",
  "",
].join("\n");

/** Three pieces, one after the other. */
const THREE_PIECES = [
  "# Breakdown",
  "",
  "**Status:** Approved by fvermaut 2026-10-04 — 3 pieces",
  "",
  "1. **Tasks** — a task can be written down",
  "2. **Due dates** — a task carries a due date",
  "3. **Reminders** — the owner is reminded before the due date",
  "",
].join("\n");

/** An issue URL of this project's repository. */
function issueUrl(number: number): string {
  return `https://github.com/fvermaut/ivtrends/issues/${number}`;
}

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/**
 * A forge holding the initiative's step tickets in memory. `listSteps`
 * answers from that list, `createStep` adds to it from #11 upwards, and
 * `blockStep` adds to a step's `blockedBy`, so a second run sees what the
 * first one wrote. Every write is recorded, in order, as one line, and the
 * body each step ticket was opened with is kept under its title.
 */
function fakeForge(steps: { number: number; title: string; blockedBy: Dependency[] }[] = []) {
  const calls: string[] = [];
  const bodies: string[] = [];
  const stepBodies = new Map<string, string>();
  const adapter: TicketingAdapter = {
    ...noBranches,
    ...noFiles,
    ...noMerges,
    ...noRunnerCalls,
    ...noStepWrites,
    async listSteps(): Promise<Step[]> {
      return steps.map((step) => ({
        number: step.number,
        title: step.title,
        state: "open",
        labels: [],
        assignees: [],
        blockedBy: [...step.blockedBy],
        dependenciesIncomplete: false,
      }));
    },
    async createStep(_project, _initiative, step): Promise<number> {
      const number = 11 + steps.length;
      steps.push({ number, title: step.title, blockedBy: [] });
      stepBodies.set(step.title, step.body);
      calls.push(`open #${number} "${step.title}"`);
      return number;
    },
    async blockStep(_project, step, waitsFor): Promise<void> {
      steps
        .find((each) => each.number === step)
        ?.blockedBy.push({ number: waitsFor, url: issueUrl(waitsFor), open: true });
      calls.push(`#${step} waits for #${waitsFor}`);
    },
    async setTicketBody(_project, number, body): Promise<void> {
      bodies.push(body);
      calls.push(`body of #${number}`);
    },
    async ensureLabel(_project, label): Promise<void> {
      calls.push(`label ${label} made`);
    },
    async applyLabel(_project, number, label): Promise<void> {
      calls.push(`label ${label} on #${number}`);
    },
    async listMarkedTickets(): Promise<never> {
      throw new Error("no test here lists marked tickets");
    },
    async listOpenTickets(): Promise<never> {
      throw new Error("no test here lists open tickets");
    },
    async getTicket(): Promise<never> {
      throw new Error("no test here reads a ticket");
    },
    async postComment(): Promise<never> {
      throw new Error("no test here comments on a ticket");
    },
    async findPullRequest(): Promise<never> {
      throw new Error("no test here looks for a pull request");
    },
    async findOpenPullRequestOfTicket(): Promise<undefined> {
      return undefined;
    },
    async getPullRequestThread(): Promise<never> {
      throw new Error("no test here reads a pull request");
    },
    async postPullRequestComment(): Promise<never> {
      throw new Error("no test here comments on a pull request");
    },
    async upsertPullRequestComment(): Promise<never> {
      throw new Error("no test here comments on a pull request");
    },
    async closeTicket(): Promise<never> {
      throw new Error("no test here closes a ticket");
    },
  };
  return { adapter, calls, bodies, stepBodies, steps };
}

/** What `openStepTickets` needs, reading `list` as the initiative's list of pieces. */
function depsFor(adapter: TicketingAdapter, list: string): ChunkZeroDeps {
  const root = mkdtempSync(join(tmpdir(), "timone-chunk-zero-"));
  tempDirs.push(root);
  return {
    store: RunStore.open(join(root, "state.json")),
    adapter,
    breakdownSource: () => list,
    log: () => {},
  };
}

/** Only the relations among the recorded writes. */
function relations(calls: string[]): string[] {
  return calls.filter((call) => call.includes(" waits for "));
}

describe("openStepTickets, the step tickets of an approved list of pieces", () => {
  it("makes each step wait only for the steps its piece directly needs (R10)", async () => {
    const forge = fakeForge();

    const failure = await openStepTickets(depsFor(forge.adapter, R10_LIST), RUN, PROJECT, []);

    expect(failure).toBeUndefined();
    expect(forge.calls.filter((call) => call.startsWith("open "))).toEqual([
      'open #11 "1. Tasks"',
      'open #12 "2. Due dates"',
      'open #13 "3. Owners"',
      'open #14 "4. Reminders"',
    ]);
    expect(relations(forge.calls)).toEqual([
      "#12 waits for #11",
      "#13 waits for #11",
      "#14 waits for #12",
      "#14 waits for #13",
    ]);
  });

  it("gives the committed list of ticket 197 the relations its Needs: lines say", async () => {
    // The real file, whose order a person wrote before this code existed.
    const list = readFileSync(
      join(import.meta.dirname, "..", "..", "doc", "plans", "breakdowns", "ticket-197.md"),
      "utf8",
    );
    const forge = fakeForge();

    const failure = await openStepTickets(depsFor(forge.adapter, list), RUN, PROJECT, []);

    expect(failure).toBeUndefined();
    expect(forge.steps.map((step) => step.number)).toEqual([11, 12, 13, 14, 15, 16]);
    expect(relations(forge.calls)).toEqual([
      "#13 waits for #11",
      "#13 waits for #12",
      "#14 waits for #13",
      "#15 waits for #13",
    ]);
  });

  it("chains the steps one after the other, as before, when no piece has a Needs: line", async () => {
    const list = [
      "# Breakdown",
      "",
      "**Status:** Approved by fvermaut 2026-10-04 — 3 pieces",
      "",
      "1. **Tasks** — a task can be written down",
      "2. **Due dates** — a task carries a due date",
      "3. **Reminders** — the owner is reminded before the due date",
      "",
    ].join("\n");
    const forge = fakeForge();

    const failure = await openStepTickets(depsFor(forge.adapter, list), RUN, PROJECT, []);

    expect(failure).toBeUndefined();
    expect(forge.steps.map((step) => step.number)).toEqual([11, 12, 13]);
    expect(relations(forge.calls)).toEqual(["#12 waits for #11", "#13 waits for #12"]);
  });

  it("opens no ticket and writes no relation when run a second time on the same forge", async () => {
    const forge = fakeForge();
    const deps = depsFor(forge.adapter, R10_LIST);
    await openStepTickets(deps, RUN, PROJECT, []);
    forge.calls.splice(0);

    const failure = await openStepTickets(deps, RUN, PROJECT, []);

    expect(failure).toBeUndefined();
    expect(forge.calls.filter((call) => call.startsWith("open "))).toEqual([]);
    expect(relations(forge.calls)).toEqual([]);
  });

  it("adds only the relation a step is missing when the steps already exist", async () => {
    // A run that stopped after writing #14's first relation: #14 waits for
    // #12 only, and piece 4 needs pieces 2 and 3.
    const local = (number: number): Dependency => ({ number, url: issueUrl(number), open: true });
    const forge = fakeForge([
      { number: 11, title: "1. Tasks", blockedBy: [] },
      { number: 12, title: "2. Due dates", blockedBy: [local(11)] },
      { number: 13, title: "3. Owners", blockedBy: [local(11)] },
      { number: 14, title: "4. Reminders", blockedBy: [local(12)] },
    ]);

    const failure = await openStepTickets(depsFor(forge.adapter, R10_LIST), RUN, PROJECT, []);

    expect(failure).toBeUndefined();
    expect(forge.calls.filter((call) => call.startsWith("open "))).toEqual([]);
    expect(relations(forge.calls)).toEqual(["#14 waits for #13"]);
  });

  it("still writes a relation when the step waits for an issue of another repository with the same number", async () => {
    // #14 waits for scratch-app#13, which is not this project's #13.
    const local = (number: number): Dependency => ({ number, url: issueUrl(number), open: true });
    const forge = fakeForge([
      { number: 11, title: "1. Tasks", blockedBy: [] },
      { number: 12, title: "2. Due dates", blockedBy: [local(11)] },
      { number: 13, title: "3. Owners", blockedBy: [local(11)] },
      {
        number: 14,
        title: "4. Reminders",
        blockedBy: [
          local(12),
          { number: 13, url: "https://github.com/fvermaut/scratch-app/issues/13", open: true },
        ],
      },
    ]);

    const failure = await openStepTickets(depsFor(forge.adapter, R10_LIST), RUN, PROJECT, []);

    expect(failure).toBeUndefined();
    expect(relations(forge.calls)).toEqual(["#14 waits for #13"]);
  });

  it("opens nothing and says why when a Needs: line cannot be read", async () => {
    const list = [
      "# Breakdown",
      "",
      "**Status:** Approved by fvermaut 2026-10-04 — 3 pieces",
      "",
      "1. **Tasks** — a task can be written down",
      "2. **Due dates** — a task carries a due date",
      "   - Needs: piece 3.",
      "3. **Owners** — a task names who does it",
      "",
    ].join("\n");
    const forge = fakeForge();

    const failure = await openStepTickets(depsFor(forge.adapter, list), RUN, PROJECT, []);

    expect(forge.calls).toEqual([]);
    expect(failure).toMatch(
      /^the list of pieces at doc\/plans\/breakdowns\/ticket-07\.md does not say clearly what each piece needs: /,
    );
    expect(failure).toContain(`piece 2's Needs: line "piece 3." names piece 3, which comes after it`);
    expect(failure).toMatch(/, so no step tickets were opened$/);
  });

  it("writes the order in words on the initiative's ticket, under the list of its steps", async () => {
    const forge = fakeForge();

    await openStepTickets(depsFor(forge.adapter, R10_LIST), RUN, PROJECT, []);

    expect(forge.bodies).toEqual([
      [
        "This is built in pieces. Each one is its own ticket below.",
        "",
        "1. #11 — a task can be written down",
        "2. #12 — a task carries a due date",
        "3. #13 — a task names who does it",
        "4. #14 — the owner is reminded before the due date",
        "",
        "Order: 1, then 2 and 3 together, then 4.",
        "",
        "The list was approved in `doc/plans/breakdowns/ticket-07.md`.",
      ].join("\n"),
    ]);
  });
});

describe("openStepTickets names the project's people on every step ticket it opens (PRD-08)", () => {
  it("names the one named person on each of the three step tickets (R1)", async () => {
    const forge = fakeForge();

    const failure = await openStepTickets(
      depsFor(forge.adapter, THREE_PIECES),
      RUN,
      PROJECT,
      ["fvermaut"],
    );

    expect(failure).toBeUndefined();
    expect([...forge.stepBodies.keys()]).toEqual(["1. Tasks", "2. Due dates", "3. Reminders"]);
    for (const [title, firstLine] of [
      ["1. Tasks", "a task can be written down"],
      ["2. Due dates", "a task carries a due date"],
      ["3. Reminders", "the owner is reminded before the due date"],
    ] as const) {
      const body = forge.stepBodies.get(title);
      expect(body?.startsWith(`${firstLine}\n`)).toBe(true);
      expect(body).toContain("Part of #7.");
      expect(body).toContain("@fvermaut");
    }
  });

  it("names every named person on every step ticket when there are two (R1)", async () => {
    const forge = fakeForge();

    const failure = await openStepTickets(
      depsFor(forge.adapter, THREE_PIECES),
      RUN,
      PROJECT,
      ["alice", "bob"],
    );

    expect(failure).toBeUndefined();
    expect(forge.stepBodies.size).toBe(3);
    for (const body of forge.stepBodies.values()) {
      expect(body).toContain("@alice");
      expect(body).toContain("@bob");
    }
  });

  it("opens nothing and edits no step ticket's body on a re-run, so nobody is named twice (R1)", async () => {
    const forge = fakeForge([
      { number: 11, title: "1. Tasks", blockedBy: [] },
      { number: 12, title: "2. Due dates", blockedBy: [] },
      { number: 13, title: "3. Reminders", blockedBy: [] },
    ]);

    const failure = await openStepTickets(
      depsFor(forge.adapter, THREE_PIECES),
      RUN,
      PROJECT,
      ["fvermaut"],
    );

    expect(failure).toBeUndefined();
    expect(forge.calls.filter((call) => call.startsWith("open "))).toEqual([]);
    expect(forge.calls.filter((call) => call.startsWith("body of "))).toEqual(["body of #7"]);
  });

  it("opens the step tickets with no name and no @ in them when nobody is named (R5)", async () => {
    const forge = fakeForge();

    const failure = await openStepTickets(depsFor(forge.adapter, THREE_PIECES), RUN, PROJECT, []);

    expect(failure).toBeUndefined();
    expect(Object.fromEntries(forge.stepBodies)).toEqual({
      "1. Tasks":
        "a task can be written down\n\nPart of #7. The full list is in `doc/plans/breakdowns/ticket-07.md`.",
      "2. Due dates":
        "a task carries a due date\n\nPart of #7. The full list is in `doc/plans/breakdowns/ticket-07.md`.",
      "3. Reminders":
        "the owner is reminded before the due date\n\nPart of #7. The full list is in `doc/plans/breakdowns/ticket-07.md`.",
    });
    for (const body of forge.stepBodies.values()) expect(body).not.toContain("@");
  });

  it("leaves piece 1's step ticket free to be taken, with nobody assigned and nothing held (R4)", async () => {
    const forge = fakeForge();
    await openStepTickets(depsFor(forge.adapter, THREE_PIECES), RUN, PROJECT, ["fvermaut"]);

    const steps = await forge.adapter.listSteps(PROJECT, INITIATIVE);

    expect(nextStep(steps)?.number).toBe(11);
    // Every write the first run made is one of these, so none of them
    // assigned a step ticket to anyone or held it.
    const otherWrites = forge.calls.filter(
      (call) =>
        !/^open #\d+ "/.test(call) &&
        !/^#\d+ waits for #\d+$/.test(call) &&
        !/^label timone:(held|map) made$/.test(call) &&
        call !== "body of #7" &&
        call !== "label timone:map on #7",
    );
    expect(otherWrites).toEqual([]);
  });
});

