import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  chunkProgress,
  isReproposal,
  parseBreakdown,
  fromDefaultBranch,
  fromWorkingTree,
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
  // What `readBreakdown` reports is the repository-relative path, because that
  // is what names the file whichever branch it was read from.
  return RELATIVE_PATH;
}

describe("the breakdown round-trips", () => {
  it("preserves an unapproved list of chunks", () => {
    expect(parseBreakdown(renderBreakdown(awaiting))).toEqual(awaiting);
  });

  it("preserves who approved, when, and how many pieces they saw", () => {
    expect(parseBreakdown(renderBreakdown(approved))).toEqual(approved);
  });

  it("reads the stamp a real approval session wrote, timestamp and all", () => {
    // The exact bytes off scratch-app's `main`, 2026-08-15T17:24:24Z. The
    // session was handed the gate reply's ISO timestamp and wrote it where
    // the instruction said `<date>` — entirely reasonable, and this pattern
    // rejected it. A rejected stamp makes the whole file `malformed`, and an
    // unreadable breakdown CLOSES ITS TICKET, so piece 2 of 2 would never
    // have been built and nothing would have said why. Kept as the literal
    // string rather than a constructed one, because what broke was the gap
    // between what a prompt writes and what this reads, and a constructed
    // fixture would agree with the code by definition.
    const live = [
      "# Breakdown",
      "",
      "**Status:** Approved by fvermaut 2026-08-15T17:24:24Z — 2 pieces",
      "",
      "1. **Putting a label on a to-do** — labels exist in the data.",
      "2. **Looking at one label at a time** — the list narrows to one label.",
      "",
    ].join("\n");

    const parsed = parseBreakdown(live);
    expect("kind" in parsed && parsed.kind === "malformed").toBe(false);
    expect(parsed).toMatchObject({
      stamp: { kind: "approved", by: "fvermaut", pieces: 2 },
    });
    expect((parsed as ParsedBreakdown).chunks).toHaveLength(2);
  });

  it("still refuses a stamp with no piece count, which the count is read from", () => {
    // The date is informational and parsed loosely on purpose; the count is
    // not, because `isReproposal` compares against it and a wrong number
    // there waves through work nobody approved.
    const parsed = parseBreakdown(
      "# Breakdown\n\n**Status:** Approved by fvermaut 2026-08-15T17:24:24Z\n\n1. **A** — a.\n",
    );
    expect("kind" in parsed && parsed.kind === "malformed").toBe(true);
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

    expect(() => readBreakdown(dir, TICKET, fromWorkingTree)).not.toThrow();
    expect(readBreakdown(dir, TICKET, fromWorkingTree)).toEqual({
      kind: "absent",
      path: RELATIVE_PATH,
    });
  });

  it("reads the approved list back off the file", () => {
    const dir = checkout();
    const path = withBreakdown(dir, renderBreakdown(approved));

    expect(readBreakdown(dir, TICKET, fromWorkingTree)).toEqual({
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

    const answer = readBreakdown(dir, TICKET, fromWorkingTree);
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

    const answer = readBreakdown(dir, TICKET, fromWorkingTree);
    expect(answer.kind).toBe("malformed");
    expect(answer).toMatchObject({ path });
    expect("reason" in answer && answer.reason).toContain("`Status:`");
  });
});


describe("where a breakdown is read from", () => {
  /**
   * A fixture shaped like a clone: one commit on `main`, and the `origin/HEAD`
   * symref a real `git clone` leaves behind. That pair is what names the
   * default branch.
   */
  function clone(dir: string): void {
    const git = (...args: string[]): void => {
      execFileSync("git", args, {
        cwd: dir,
        stdio: "ignore",
        env: {
          ...process.env,
          GIT_AUTHOR_NAME: "t",
          GIT_AUTHOR_EMAIL: "t@example.com",
          GIT_COMMITTER_NAME: "t",
          GIT_COMMITTER_EMAIL: "t@example.com",
        },
      });
    };
    git("init", "-b", "main");
    git("add", ".");
    git("commit", "-m", "fixture");
    git("update-ref", "refs/remotes/origin/main", "HEAD");
    git("symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main");
  }

  it("reads the approved list off the default branch", () => {
    const dir = checkout();
    withBreakdown(dir, renderBreakdown(approved));
    clone(dir);

    expect(readBreakdown(dir, TICKET, fromDefaultBranch)).toEqual({
      kind: "ok",
      path: RELATIVE_PATH,
      breakdown: approved,
    });
  });

  it("does not read a proposal that only exists in the working tree", () => {
    // The whole of the fix. A breakdown on a work branch is a proposal nobody
    // has approved, and counting pieces off one describes a list the human has
    // never seen. Committing an empty repository first, then writing the file,
    // is exactly the state a session leaves behind mid-stage.
    const dir = checkout();
    mkdirSync(join(dir, "doc"), { recursive: true });
    writeFileSync(join(dir, "doc", ".keep"), "", "utf8");
    clone(dir);
    withBreakdown(dir, renderBreakdown(approved));

    expect(readBreakdown(dir, TICKET, fromDefaultBranch).kind).toBe("absent");
    expect(readBreakdown(dir, TICKET, fromWorkingTree).kind).toBe("ok");
  });

  it("answers absent rather than throwing when the directory is no repository", () => {
    // On the path of every marked ticket on every cycle: an exception here
    // takes a whole project's turn with it.
    const dir = checkout();
    withBreakdown(dir, renderBreakdown(approved));

    expect(() => readBreakdown(dir, TICKET, fromDefaultBranch)).not.toThrow();
    expect(readBreakdown(dir, TICKET, fromDefaultBranch).kind).toBe("absent");
  });

  it("still says why a file on the default branch cannot be read", () => {
    // The `malformed` arm has to survive the change of source: a file that is
    // on the branch and does not parse is somebody's mistake, and the cycle
    // reports it.
    const dir = checkout();
    withBreakdown(dir, "# Breakdown\n\nsomebody deleted the status line\n");
    clone(dir);

    const answer = readBreakdown(dir, TICKET, fromDefaultBranch);
    expect(answer.kind).toBe("malformed");
    expect("reason" in answer && answer.reason).toContain("`Status:`");
  });
});
