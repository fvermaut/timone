import { describe, expect, it } from "vitest";

import type { PullRequest, TicketingProject } from "../adapters/ticketing.js";
import { noBranches, noFiles } from "../adapters/ticketing.stubs.js";
import { gatherFacts, type FactsAdapter } from "./facts.js";

const PROJECT: TicketingProject = {
  name: "scratch-app",
  repoUrl: "https://github.com/fvermaut/scratch-app.git",
};

const BRANCH = "timone/12-a-due-date-on-each-task";

/**
 * A forge holding `branches`, each a map of path to content, built on the
 * stub adapter's branch and file reads. `main` is the default branch.
 *
 * `listFiles` answers the files directly under a directory, as the real one
 * does, and undefined for a branch that has no file under it at all.
 */
function forgeWith(
  branches: Record<string, Record<string, string>>,
  pullRequest?: PullRequest,
): FactsAdapter {
  return {
    ...noBranches,
    ...noFiles,
    async listFiles(_project, branch, directory) {
      const files = Object.keys(branches[branch] ?? {}).filter(
        (path) =>
          path.startsWith(`${directory}/`) &&
          !path.slice(directory.length + 1).includes("/"),
      );
      return files.length === 0 ? undefined : files;
    },
    async readFile(_project, branch, path) {
      return branches[branch]?.[path];
    },
    async aheadOfDefault(_project, branch) {
      return branch in branches ? 3 : undefined;
    },
    async findPullRequest() {
      return pullRequest;
    },
  };
}

describe("the facts the runner is given about a run's branch", () => {
  it("lists a phase file the branch has and the default branch does not, with its Status line", async () => {
    const forge = forgeWith({
      main: {
        "doc/plans/phases/phase-01.md": "# Phase 01\n\n> **Status:** Complete\n",
      },
      [BRANCH]: {
        "doc/plans/phases/phase-01.md": "# Phase 01\n\n> **Status:** Complete\n",
        "doc/plans/phases/phase-02.md":
          "# Phase 02: a due date on each task\n\n> **Status:** Planned.\n\n## Requirements\n",
      },
    });

    const facts = await gatherFacts(forge, PROJECT, { ticket: 12, branch: BRANCH });

    expect(facts.branch).toMatchObject({
      kind: "branch",
      name: BRANCH,
      phaseFiles: {
        kind: "known",
        value: [{ path: "doc/plans/phases/phase-02.md", status: "Planned." }],
      },
    });
  });

  it("gives how many commits the branch has that the default branch does not, and its pull request", async () => {
    const pullRequest: PullRequest = {
      number: 14,
      title: "A due date on each task",
      url: "https://github.com/fvermaut/scratch-app/pull/14",
      state: "open",
      headSha: "9f1c2d3",
    };
    const forge = forgeWith({ main: {}, [BRANCH]: {} }, pullRequest);

    const facts = await gatherFacts(forge, PROJECT, { ticket: 12, branch: BRANCH });

    expect(facts.branch).toMatchObject({
      ahead: { kind: "known", value: 3 },
      pullRequest: { kind: "known", value: pullRequest },
    });
  });

  it("names the verification and completion reports the branch added", async () => {
    const forge = forgeWith({
      main: {
        "doc/plans/phases/reports/phase-01-verification.md": "# Verification\n",
        "doc/plans/phases/reports/phase-01-complete.md": "# Complete\n",
      },
      [BRANCH]: {
        "doc/plans/phases/reports/phase-01-verification.md": "# Verification\n",
        "doc/plans/phases/reports/phase-01-complete.md": "# Complete\n",
        "doc/plans/phases/reports/phase-02-complete.md": "# Complete\n",
        "doc/plans/phases/reports/phase-02-handoffs.md": "# Handoffs\n",
      },
    });

    const facts = await gatherFacts(forge, PROJECT, { ticket: 12, branch: BRANCH });

    expect(facts.branch).toMatchObject({
      reports: { kind: "known", value: ["doc/plans/phases/reports/phase-02-complete.md"] },
    });
  });

  it("gives each requirements file's Status line as the branch has it, and says which ones the branch added", async () => {
    const forge = forgeWith({
      main: {
        "doc/specs/prd/prd-01-tasks.md": "# PRD-01\n\n> **Status:** Active\n",
        "doc/specs/prd/prd-01-tasks.criteria.md": "# Criteria\n\n- **Status:** verified\n",
      },
      [BRANCH]: {
        "doc/specs/prd/prd-01-tasks.md": "# PRD-01\n\n> **Status:** Active\n",
        "doc/specs/prd/prd-01-tasks.criteria.md": "# Criteria\n\n- **Status:** verified\n",
        "doc/specs/prd/prd-02-due-dates.md": "# PRD-02\n\n> **Status:** Draft\n",
        "doc/specs/prd/prd-02-due-dates.criteria.md": "# Criteria\n\n- **Status:** draft\n",
      },
    });

    const facts = await gatherFacts(forge, PROJECT, { ticket: 12, branch: BRANCH });

    expect(facts.requirements).toEqual({
      kind: "known",
      value: [
        { path: "doc/specs/prd/prd-01-tasks.md", status: "Active", addedOnBranch: false },
        { path: "doc/specs/prd/prd-02-due-dates.md", status: "Draft", addedOnBranch: true },
      ],
    });
  });

  it("gives the Status line of the ticket's list of pieces", async () => {
    const forge = forgeWith({
      main: {},
      [BRANCH]: {
        "doc/plans/breakdowns/ticket-12.md":
          "# Breakdown\n\n**Status:** Awaiting approval\n\n1. **Due dates** — …\n",
      },
    });

    const facts = await gatherFacts(forge, PROJECT, { ticket: 12, branch: BRANCH });

    expect(facts.breakdown).toEqual({
      kind: "known",
      value: { path: "doc/plans/breakdowns/ticket-12.md", status: "Awaiting approval" },
    });
  });

  it("says a run has no branch yet, and reads the requirements files from the default branch", async () => {
    const forge = forgeWith({
      main: { "doc/specs/prd/prd-01-tasks.md": "# PRD-01\n\n> **Status:** Active\n" },
    });

    const facts = await gatherFacts(forge, PROJECT, { ticket: 12, branch: undefined });

    expect(facts.branch).toEqual({ kind: "no-branch" });
    expect(facts.requirements).toEqual({
      kind: "known",
      value: [{ path: "doc/specs/prd/prd-01-tasks.md", status: "Active", addedOnBranch: false }],
    });
  });

  it("gives unknown for a fact whose forge call failed, and still gives the others", async () => {
    const forge: FactsAdapter = {
      ...forgeWith({ main: {}, [BRANCH]: {} }),
      async aheadOfDefault() {
        throw new Error("gh api repos/fvermaut/scratch-app/compare failed: HTTP 502");
      },
    };

    const facts = await gatherFacts(forge, PROJECT, { ticket: 12, branch: BRANCH });

    expect(facts.branch).toMatchObject({
      ahead: {
        kind: "unknown",
        why: expect.stringContaining("HTTP 502"),
      },
      phaseFiles: { kind: "known", value: [] },
      pullRequest: { kind: "known", value: undefined },
    });
    expect(facts.requirements).toEqual({ kind: "known", value: [] });
  });

  it.each([
    "readBranches",
    "listFiles",
    "readFile",
    "aheadOfDefault",
    "findPullRequest",
  ] as const)("answers, with the failure named in an unknown fact, when %s fails", async (call) => {
    const forge: FactsAdapter = {
      ...forgeWith({
        main: { "doc/specs/prd/prd-01-tasks.md": "# PRD-01\n\n> **Status:** Active\n" },
        [BRANCH]: {
          "doc/specs/prd/prd-01-tasks.md": "# PRD-01\n\n> **Status:** Active\n",
          "doc/plans/phases/phase-02.md": "> **Status:** Planned.\n",
          "doc/plans/breakdowns/ticket-12.md": "**Status:** Awaiting approval\n",
        },
      }),
      [call]: async () => {
        throw new Error(`${call} failed: connection reset`);
      },
    };

    const facts = await gatherFacts(forge, PROJECT, { ticket: 12, branch: BRANCH });

    const whys = [
      facts.requirements,
      facts.breakdown,
      ...(facts.branch.kind === "branch"
        ? [facts.branch.ahead, facts.branch.phaseFiles, facts.branch.reports, facts.branch.pullRequest]
        : []),
    ].flatMap((fact) => (fact.kind === "unknown" ? [fact.why] : []));
    expect(whys.some((why) => why.includes(`${call} failed: connection reset`))).toBe(true);
  });
});

describe("the list of pieces, under the name the merge reads (40u)", () => {
  it("finds ticket 7's list at doc/plans/breakdowns/ticket-07.md, the path the merge after its approval reads", async () => {
    // Verification of phase 40, found outside the verdicts, item 3: the brief
    // looked for `ticket-7.md` while the merge read `ticket-07.md`, so on
    // tickets 1 to 9 the runner was told there was no list.
    const forge = forgeWith({
      main: {},
      [BRANCH]: {
        "doc/plans/breakdowns/ticket-07.md": "# Breakdown\n\n**Status:** Awaiting approval\n",
      },
    });

    const facts = await gatherFacts(forge, PROJECT, { ticket: 7, branch: BRANCH });

    expect(facts.breakdown).toEqual({
      kind: "known",
      value: { path: "doc/plans/breakdowns/ticket-07.md", status: "Awaiting approval" },
    });
  });
});
