import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  isReproposal,
  orderOf,
  parseBreakdown,
  fromDefaultBranch,
  fromWorkingTree,
  readBreakdownSync,
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

  it("keeps each piece's Needs: line, and leaves a piece without one without one", () => {
    const withNeeds: ParsedBreakdown = {
      stamp: { kind: "awaiting" },
      chunks: [
        { title: "One", delivers: "the first piece.", needsLine: "nothing." },
        { title: "Two", delivers: "the second piece." },
        {
          title: "Three",
          delivers: "the third piece.",
          needsLine: "piece 1. It can be built at the same time as piece 2.",
        },
      ],
    };

    expect(parseBreakdown(renderBreakdown(withNeeds))).toStrictEqual(withNeeds);
  });

  it("reads a Needs: line whose label is in bold", () => {
    const answer = parseBreakdown(
      [
        "# Breakdown",
        "",
        "**Status:** Awaiting approval",
        "",
        "1. **One** — the first piece.",
        "2. **Two** — the second piece.",
        "   - **Needs:** piece 1.",
        "",
      ].join("\n"),
    );

    expect(answer).toStrictEqual({
      stamp: { kind: "awaiting" },
      chunks: [
        { title: "One", delivers: "the first piece." },
        { title: "Two", delivers: "the second piece.", needsLine: "piece 1." },
      ],
    });
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

    expect(() => readBreakdownSync(TICKET, fromWorkingTree(dir))).not.toThrow();
    expect(readBreakdownSync(TICKET, fromWorkingTree(dir))).toEqual({
      kind: "absent",
      path: RELATIVE_PATH,
    });
  });

  it("reads the approved list back off the file", () => {
    const dir = checkout();
    const path = withBreakdown(dir, renderBreakdown(approved));

    expect(readBreakdownSync(TICKET, fromWorkingTree(dir))).toEqual({
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

    const answer = readBreakdownSync(TICKET, fromWorkingTree(dir));
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

    const answer = readBreakdownSync(TICKET, fromWorkingTree(dir));
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

    expect(readBreakdownSync(TICKET, fromDefaultBranch(dir))).toEqual({
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

    expect(readBreakdownSync(TICKET, fromDefaultBranch(dir)).kind).toBe("absent");
    expect(readBreakdownSync(TICKET, fromWorkingTree(dir)).kind).toBe("ok");
  });

  it("answers absent rather than throwing when the directory is no repository", () => {
    // On the path of every marked ticket on every cycle: an exception here
    // takes a whole project's turn with it.
    const dir = checkout();
    withBreakdown(dir, renderBreakdown(approved));

    expect(() => readBreakdownSync(TICKET, fromDefaultBranch(dir))).not.toThrow();
    expect(readBreakdownSync(TICKET, fromDefaultBranch(dir)).kind).toBe("absent");
  });

  it("still says why a file on the default branch cannot be read", () => {
    // The `malformed` arm has to survive the change of source: a file that is
    // on the branch and does not parse is somebody's mistake, and the cycle
    // reports it.
    const dir = checkout();
    withBreakdown(dir, "# Breakdown\n\nsomebody deleted the status line\n");
    clone(dir);

    const answer = readBreakdownSync(TICKET, fromDefaultBranch(dir));
    expect(answer.kind).toBe("malformed");
    expect("reason" in answer && answer.reason).toContain("`Status:`");
  });
});

/**
 * Read a list as `parseBreakdown` does, and fail loudly if it does not parse,
 * so a case about the order never passes on a list that was not read at all.
 */
function parsed(text: string): ParsedBreakdown {
  const answer = parseBreakdown(text);
  if ("kind" in answer) throw new Error(`fixture did not parse: ${answer.reason}`);
  return answer;
}

describe("the order of the pieces, read from their Needs: lines", () => {
  it("reads 2 and 3 needing 1, and 4 needing 2 and 3, as levels", () => {
    const list = parsed(
      [
        "# Breakdown",
        "",
        "**Status:** Awaiting approval",
        "",
        "1. **One** — the first piece.",
        "   - Needs: nothing.",
        "2. **Two** — the second piece.",
        "   - Needs: piece 1.",
        "3. **Three** — the third piece.",
        "   - Needs: piece 1.",
        "4. **Four** — the fourth piece.",
        "   - Needs: pieces 2 and 3.",
        "",
      ].join("\n"),
    );

    expect(orderOf(list)).toEqual({
      kind: "clear",
      needs: [[], [1], [1], [2, 3]],
      words: "1, then 2 and 3 together, then 4.",
    });
  });

  it("reads the committed list of ticket 197 as its writer wrote the order by hand", () => {
    // The real file, not a copy: its "Order:" line was written by a person
    // before this code existed, so it is an answer the code did not choose.
    // Piece 4's line, "piece 3. It can be built at the same time as piece 5.",
    // has a second sentence naming another piece, which must not be read.
    const list = parsed(
      readFileSync(
        join(import.meta.dirname, "..", "..", "doc", "plans", "breakdowns", "ticket-197.md"),
        "utf8",
      ),
    );

    expect(orderOf(list)).toEqual({
      kind: "clear",
      needs: [[], [], [1, 2], [3], [3], []],
      words:
        "1 and 2 together, then 3, then 4 and 5 together. " +
        "6 needs none of the others.",
    });
  });

  it("reads a list with no Needs: lines as each piece needing the one above", () => {
    // Every list written before the line existed, ticket-103.md among them,
    // meant this order, and the step tickets it opened were chained this way.
    const list = parsed(
      [
        "# Breakdown",
        "",
        "**Status:** Approved by fvermaut 2026-09-05 — 3 pieces",
        "",
        "1. **One** — the first piece.",
        "2. **Two** — the second piece.",
        "3. **Three** — the third piece.",
        "",
      ].join("\n"),
    );

    expect(orderOf(list)).toEqual({
      kind: "clear",
      needs: [[], [1], [2]],
      words: "1, then 2, then 3.",
    });
  });

  it("reads a list of one piece as that piece alone, with no others to mention", () => {
    // ticket-128.md is such a list. "1 needs none of the others" would name
    // others that do not exist.
    const list = parsed(
      [
        "# Breakdown",
        "",
        "**Status:** Approved by fvermaut 2026-09-11 — 1 pieces",
        "",
        "1. **One** — the only piece.",
        "",
      ].join("\n"),
    );

    expect(orderOf(list)).toEqual({ kind: "clear", needs: [[]], words: "1." });
  });

  it("says what a piece waits for when it does not need the whole level before it", () => {
    const list = parsed(
      [
        "# Breakdown",
        "",
        "**Status:** Awaiting approval",
        "",
        "1. **One** — the first piece.",
        "   - Needs: nothing.",
        "2. **Two** — the second piece.",
        "   - Needs: piece 1.",
        "3. **Three** — the third piece.",
        "   - Needs: piece 1.",
        "4. **Four** — the fourth piece.",
        "   - Needs: piece 2.",
        "",
      ].join("\n"),
    );

    expect(orderOf(list)).toEqual({
      kind: "clear",
      needs: [[], [1], [1], [2]],
      words: "1, then 2 and 3 together, then 4. 4 waits only for 2.",
    });
  });

  it("names three pieces on one level with commas and a last and", () => {
    const list = parsed(
      [
        "# Breakdown",
        "",
        "**Status:** Awaiting approval",
        "",
        "1. **One** — the first piece.",
        "2. **Two** — the second piece.",
        "   - Needs: piece 1.",
        "3. **Three** — the third piece.",
        "   - Needs: piece 1.",
        "4. **Four** — the fourth piece.",
        "   - Needs: piece 1.",
        "",
      ].join("\n"),
    );

    expect(orderOf(list)).toEqual({
      kind: "clear",
      needs: [[], [1], [1], [1]],
      words: "1, then 2, 3 and 4 together.",
    });
  });
});

describe("a Needs: line that cannot be read is refused, not guessed", () => {
  /** Three pieces, the second of which needs what `line` says. */
  function threePiecesWithSecondNeeding(line: string): ParsedBreakdown {
    return parsed(
      [
        "# Breakdown",
        "",
        "**Status:** Awaiting approval",
        "",
        "1. **One** — the first piece.",
        "2. **Two** — the second piece.",
        `   - Needs: ${line}`,
        "3. **Three** — the third piece.",
        "",
      ].join("\n"),
    );
  }

  it("refuses a piece that needs itself", () => {
    const order = orderOf(threePiecesWithSecondNeeding("piece 2."));

    expect(order.kind).toBe("unclear");
    expect("reason" in order && order.reason).toContain("piece 2");
    expect("reason" in order && order.reason).toContain('"piece 2."');
  });

  it("refuses a piece that needs a later piece", () => {
    const order = orderOf(threePiecesWithSecondNeeding("piece 3."));

    expect(order.kind).toBe("unclear");
    expect("reason" in order && order.reason).toContain("piece 2");
    expect("reason" in order && order.reason).toContain('"piece 3."');
  });

  it("refuses a piece that needs a number past the end of the list", () => {
    const order = orderOf(threePiecesWithSecondNeeding("piece 9."));

    expect(order.kind).toBe("unclear");
    expect("reason" in order && order.reason).toContain("piece 2");
    expect("reason" in order && order.reason).toContain('"piece 9."');
    // Not "comes after it": there is no piece 9 to come after anything.
    expect("reason" in order && order.reason).toContain("not in the list");
  });

  it("refuses a line that names no piece and does not say nothing or none", () => {
    // Read as "needs nothing", this would let piece 2 start before the piece
    // its writer meant, so it is refused rather than guessed.
    const order = orderOf(threePiecesWithSecondNeeding("the first one."));

    expect(order.kind).toBe("unclear");
    expect("reason" in order && order.reason).toContain("piece 2");
    expect("reason" in order && order.reason).toContain('"the first one."');
  });
});


describe("every committed list reads as it did before the Needs: line", () => {
  /** A committed list's text, read off this repository's own `doc/`. */
  function committed(name: string): string {
    return readFileSync(
      join(import.meta.dirname, "..", "..", "doc", "plans", "breakdowns", name),
      "utf8",
    );
  }

  /** The stamp and each piece's title and description, and nothing else. */
  function titlesAndStamp(text: string): unknown {
    const answer = parseBreakdown(text);
    if ("kind" in answer) return answer;
    return {
      stamp: answer.stamp,
      chunks: answer.chunks.map(({ title, delivers }) => ({ title, delivers })),
    };
  }

  // The four lists are named rather than found, so a list committed later
  // does not change what this case checks. The expected values are copied by
  // hand from the files, as the parser read them before this change.

  it("reads ticket-103.md as before", () => {
    expect(titlesAndStamp(committed("ticket-103.md"))).toEqual({
      stamp: {
        kind: "approved",
        by: "fvermaut",
        at: "2026-09-05T15:47:09Z",
        pieces: 2,
      },
      chunks: [
        {
          title: "The run carries on instead of stopping",
          delivers:
            "from the agreement to the pull request the machine never parks and never asks: every departure from what was agreed — a wrong plan step, a contradicted requirement, a check it cannot run, a workaround, tests still failing — is written into one dated record on the work branch that names the run, the plan and the requirements are amended in place as the build needs, and the run always reaches a pull request; a stop that happens anyway is reported as a defect, and the stops left before the build are ones a typed reply settles.",
        },
        {
          title: "The pull request carries the judgement",
          delivers:
            "the body opens on that record, listing what was bent or saying explicitly that nothing was, a screen is shown there with its preview address and its comparison against the reference instead of before, and closing the pull request without merging brings the work back as a fresh request rather than patching the rejected branch.",
        },
      ],
    });
  });

  it("reads ticket-128.md as before", () => {
    expect(titlesAndStamp(committed("ticket-128.md"))).toEqual({
      stamp: { kind: "approved", by: "fvermaut", at: "2026-09-11", pieces: 1 },
      chunks: [
        {
          title: "The ask check, everywhere a person is asked",
          delivers:
            "a reply that is neither a yes nor a change request gets one short question instead of a demand for a terminal session. The check has two outcomes and no route to a gate outcome or a run's state. It stands in front of every message that asks a person for something, not only the approval gate, and a written answer to its own question starts the session a terminal command starts today.",
        },
      ],
    });
  });

  it("refuses ticket-164.md for its Status: line, as before", () => {
    // This list could not be read before this change either: its stamp
    // carries a sentence after the piece count. It must stay exactly as it
    // was, not start being read now.
    expect(titlesAndStamp(committed("ticket-164.md"))).toEqual({
      kind: "malformed",
      reason:
        'unreadable `Status:` line "Approved by fvermaut 2026-09-26 — 2 pieces. Given in the terminal session `e9bd67c9-0d4c-4797-8329-7a5bfe529e75`: these two pieces were proposed, and he answered *"look I understand, it\'s more complex than I thought, do as you think it\'s best"*." — expected "Awaiting approval" or "Approved by <who> <date> — N pieces"',
    });
  });

  it("reads ticket-197.md as before", () => {
    expect(titlesAndStamp(committed("ticket-197.md"))).toEqual({
      stamp: {
        kind: "approved",
        by: "fvermaut",
        at: "2026-10-04T06:34:53Z",
        pieces: 6,
      },
      chunks: [
        {
          title: "Numbered files never take the same number",
          delivers:
            "two tickets worked at the same time never give a phase file, an ADR or a triage record the same number.",
        },
        {
          title: "STATUS.md and the requirement registers stop conflicting",
          delivers:
            "when one pull request merges, another that changed the same `STATUS.md` or register is brought level without a person, and nothing either wrote is lost.",
        },
        {
          title: "The project is free when the pull request opens",
          delivers:
            "a ticket with an open pull request, or one waiting for a person, no longer stops the next ticket of its project from building.",
        },
        {
          title: "The update after a merge",
          delivers:
            "after a pull request merges, every other open pull request of the project is brought level, fixed and tested again, and says on top what had to change.",
        },
        {
          title: "Two places and the planner",
          delivers:
            "each project builds up to 2 tickets at once, or the number `timone.yaml` sets, and the planner decides from each plan which ticket may start.",
        },
        {
          title: "The list of pieces shows what is built at the same time",
          delivers:
            "a list of pieces shows its order in plain words, and the step tickets it opens wait for each other exactly as that order says.",
        },
      ],
    });
  });
});
