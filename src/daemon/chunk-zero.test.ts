import { describe, expect, it } from "vitest";

import type { TicketingProject } from "../adapters/ticketing.js";
import { tryMergeChunkZero, type ChunkZeroDeps } from "./chunk-zero.js";
import type { Run } from "./runs.js";

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
