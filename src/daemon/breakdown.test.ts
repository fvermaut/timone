import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  chunkProgress,
  isReproposal,
  parseBreakdown,
  readBreakdown,
  renderBreakdown,
  type ParsedBreakdown,
} from "./breakdown.js";

/** The ticket every checkout in this file carries a breakdown for. */
const TICKET = 7;

/** Where that ticket's breakdown is expected to sit, spelled out by hand. */
const RELATIVE_PATH = join("doc", "plans", "breakdowns", "ticket-07.md");

/** A three-chunk breakdown nobody has approved yet. */
const awaiting: ParsedBreakdown = {
  stamp: { kind: "awaiting" },
  chunks: [
    {
      title: "The ledger learns chunks",
      delivers: "a run carries its sequence number",
    },
    {
      title: "The next chunk opens",
      delivers: "a merged pull request opens the next one",
    },
    {
      title: "The ticket closes",
      delivers: "the last merge closes the conversation",
    },
  ],
};

/** The same three chunks, once fvermaut has approved them. */
const approved: ParsedBreakdown = {
  stamp: { kind: "approved", by: "fvermaut", at: "2026-08-15", pieces: 3 },
  chunks: awaiting.chunks,
};

/** Temp checkouts created by the current test, removed in afterEach. */
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** An empty directory standing in for a project checkout. */
function checkout(): string {
  const dir = mkdtempSync(join(tmpdir(), "timone-breakdown-"));
  tempDirs.push(dir);
  return dir;
}

/** Write {@link TICKET}'s breakdown into a checkout, and answer its path. */
function withBreakdown(dir: string, text: string): string {
  const path = join(dir, RELATIVE_PATH);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
  return path;
}

describe("the breakdown round-trips", () => {
  it("preserves an unapproved list of chunks", () => {
    expect(parseBreakdown(renderBreakdown(awaiting))).toEqual(awaiting);
  });

  it("preserves who approved, when, and how many pieces they saw", () => {
    expect(parseBreakdown(renderBreakdown(approved))).toEqual(approved);
  });
});

describe("which chunk is next", () => {
  it("names the chunk after the ones the ledger has settled", () => {
    expect(chunkProgress(approved, 1)).toEqual({
      total: 3,
      done: 1,
      next: { index: 2, title: "The next chunk opens" },
    });
  });

  it("answers no next chunk once the list is exhausted — the close-the-ticket signal", () => {
    expect(chunkProgress(approved, 3)).toEqual({ total: 3, done: 3 });
  });

  it("clamps a settled count larger than the list rather than throwing", () => {
    expect(chunkProgress(approved, 7)).toEqual({ total: 3, done: 3 });
  });
});

describe("a re-proposal is visible from the artifact alone", () => {
  it("calls a list longer than its own stamp's count a re-proposal", () => {
    const gained: ParsedBreakdown = {
      stamp: { kind: "approved", by: "fvermaut", at: "2026-08-15", pieces: 2 },
      chunks: approved.chunks,
    };
    expect(isReproposal(gained)).toBe(true);
  });

  it("calls a list whose length agrees with its stamp nothing of the kind", () => {
    expect(isReproposal(approved)).toBe(false);
  });

  it("calls an unapproved breakdown nothing of the kind — nothing was approved", () => {
    expect(isReproposal(awaiting)).toBe(false);
  });
});

describe("reading a breakdown out of a checkout", () => {
  it("answers rather than throwing when the project has no doc/ at all", () => {
    const dir = checkout();

    expect(() => readBreakdown(dir, TICKET)).not.toThrow();
    expect(readBreakdown(dir, TICKET)).toEqual({
      kind: "absent",
      path: join(dir, RELATIVE_PATH),
    });
  });

  it("reads the approved list back off the file", () => {
    const dir = checkout();
    const path = withBreakdown(dir, renderBreakdown(approved));

    expect(readBreakdown(dir, TICKET)).toEqual({
      kind: "ok",
      path,
      breakdown: approved,
    });
  });

  it("says why a file with a stamp and no chunks cannot be read", () => {
    const dir = checkout();
    const path = withBreakdown(
      dir,
      "# Breakdown\n\n**Status:** Awaiting approval\n",
    );

    const answer = readBreakdown(dir, TICKET);
    expect(answer.kind).toBe("malformed");
    expect(answer).toMatchObject({ path });
    expect("reason" in answer && answer.reason).toContain("no chunks");
  });

  it("says why a file with chunks and no stamp cannot be read", () => {
    const dir = checkout();
    const path = withBreakdown(
      dir,
      "# Breakdown\n\n1. **One** — the only piece.\n",
    );

    const answer = readBreakdown(dir, TICKET);
    expect(answer.kind).toBe("malformed");
    expect(answer).toMatchObject({ path });
    expect("reason" in answer && answer.reason).toContain("`Status:`");
  });
});
