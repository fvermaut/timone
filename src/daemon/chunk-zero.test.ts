import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { TicketingAdapter, TicketingProject } from "../adapters/ticketing.js";
import {
  noBranches,
  noFiles,
  noMerges,
  noRunnerCalls,
  noStepWrites,
  noSteps,
} from "../adapters/ticketing.stubs.js";
import { mergeChunkZero, tryMergeChunkZero, type ChunkZeroDeps } from "./chunk-zero.js";
import { RunStore, type Run } from "./runs.js";
import { failedComment } from "./session.js";

/** Temp dirs created by the current test, removed in afterEach. */
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const PROJECT: TicketingProject = {
  name: "ivtrends",
  repoUrl: "https://github.com/fvermaut/ivtrends.git",
};

/** A forge that only takes comments; every other call is one no test here makes. */
function commentsOnly(posted: { number: number; body: string }[]): TicketingAdapter {
  const unused = (name: string) => async (): Promise<never> => {
    throw new Error(`no test here calls the forge's ${name}`);
  };
  return {
    ...noBranches,
    ...noFiles,
    ...noMerges,
    ...noRunnerCalls,
    ...noStepWrites,
    ...noSteps,
    listMarkedTickets: unused("listMarkedTickets"),
    listOpenTickets: unused("listOpenTickets"),
    getTicket: unused("getTicket"),
    postComment: async (_project, number, body) => {
      posted.push({ number, body });
    },
    upsertComment: unused("upsertComment"),
    applyLabel: unused("applyLabel"),
    findPullRequest: unused("findPullRequest"),
    getPullRequestThread: unused("getPullRequestThread"),
    postPullRequestComment: unused("postPullRequestComment"),
    upsertPullRequestComment: unused("upsertPullRequestComment"),
    closeTicket: unused("closeTicket"),
  };
}

describe("mergeChunkZero, as the current daemon uses it (40x)", () => {
  it("still fails the run and posts the failure comment when the merge conflicts", async () => {
    const root = mkdtempSync(join(tmpdir(), "timone-chunk-zero-"));
    tempDirs.push(root);
    const store = RunStore.open(join(root, ".timone", "state.json"));
    const { run: registered } = store.register(PROJECT.name, 7);
    store.activate(registered.id, "session-breakdown");
    const run = store.claimBranch(registered.id, "timone/7-the-page-feels-slow");
    const posted: { number: number; body: string }[] = [];
    const expectedReason =
      "the approved breakdown and the default branch have changes that clash — a merge conflict, " +
      "and nothing was merged (CONFLICT (content): Merge conflict in doc/specs/prd/prd-07.md). " +
      "Somebody has to decide which side wins; trying again changes nothing.";

    const merged = await mergeChunkZero(
      {
        store,
        adapter: commentsOnly(posted),
        mergeProbe: async () => ({
          merged: false,
          conflict: true,
          reason: "CONFLICT (content): Merge conflict in doc/specs/prd/prd-07.md",
        }),
        log: () => {},
      },
      run,
      PROJECT,
      { by: "fvermaut", at: "2026-09-29T10:00:00Z" },
    );

    expect(merged).toBe(false);
    expect(store.get(run.id)).toMatchObject({ status: "failed", failure: expectedReason });
    expect(posted).toEqual([{ number: 7, body: failedComment(expectedReason) }]);
  });
});

describe("tryMergeChunkZero, the form the runner uses (40x)", () => {
  it("cannot be written without the approval that allows the merge, as the daemon's form cannot", () => {
    // PRD-05 R3: only a named person's yes lets work reach a default branch
    // with no pull request. `tsc` fails on this file if the line below ever
    // compiles. It is never run.
    const mergeWithoutApproval = (deps: ChunkZeroDeps, run: Run) =>
      // @ts-expect-error — `tryMergeChunkZero` requires the approval that allows it (R3).
      tryMergeChunkZero(deps, run, PROJECT);
    expect(mergeWithoutApproval).toBeTypeOf("function");
  });
});
