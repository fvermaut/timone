import { describe, expect, it } from "vitest";

import { forgeCallRefusal } from "./forge-guard.js";

/** A file's content as `gh api` sends it: base64, and nothing the rule reads. */
const CONTENT = "content=aGVsbG8K";

describe("what a run may not do through the forge", () => {
  const WORK = "timone/7-x";

  it.each([
    ["merging a pull request", ["pr", "merge", "12", "--squash"], "`gh pr merge`"],
    ["syncing a branch on the forge", ["repo", "sync"], "`gh repo sync`"],
    [
      "merging one branch into another",
      ["api", "repos/o/r/merges", "-f", "base=main", "-f", "head=x"],
      "repos/o/r/merges",
    ],
    [
      "writing a file without naming a branch",
      ["api", "-X", "PUT", "repos/o/r/contents/STATUS.md", "-f", "message=m", "-f", CONTENT],
      "repos/o/r/contents/STATUS.md",
    ],
    [
      "writing a file to another branch",
      [
        "api", "-X", "PUT", "repos/o/r/contents/STATUS.md",
        "-f", "message=m", "-f", CONTENT, "-f", "branch=main",
      ],
      "repos/o/r/contents/STATUS.md",
    ],
    [
      "moving a branch",
      ["api", "-X", "PATCH", "repos/o/r/git/refs/heads/main", "-f", "sha=1111111"],
      "repos/o/r/git/refs/heads/main",
    ],
    ["merging a pull request by its API", ["api", "-X", "PUT", "repos/o/r/pulls/3/merge"], "repos/o/r/pulls/3/merge"],
    [
      "merging a pull request through GraphQL",
      ["api", "graphql", "-f", 'query=mutation { mergePullRequest(input: {pullRequestId: "P"}) { clientMutationId } }'],
      "mergePullRequest",
    ],
  ])("refuses %s, and says what it refused", (_what, args, named) => {
    const refusal = forgeCallRefusal(args, WORK);

    expect(refusal).toMatch(/^Refused: /);
    expect(refusal).toContain(named);
    expect(refusal).toContain("Commit on `timone/7-x` and push that.");
  });

  it("never tells the reader to put anything on the default branch", () => {
    const refusal =
      forgeCallRefusal(
        [
          "api", "-X", "PUT", "repos/o/r/contents/STATUS.md",
          "-f", "message=m", "-f", CONTENT, "-f", "branch=main",
        ],
        WORK,
      ) ?? "";

    expect(refusal).not.toMatch(/(push|commit|merge|write)[^.]*\bto `?main`?/i);
    expect(refusal).not.toMatch(/on `?main`?/i);
    expect(refusal).toContain("Nothing reaches the project's default branch without a person's yes.");
  });
});

describe("what a run may do through the forge", () => {
  const WORK = "timone/7-x";

  it.each([
    ["opening a pull request", ["pr", "create", "--title", "t", "--body", "b"]],
    ["commenting on an issue", ["issue", "comment", "85", "--body", "x"]],
    ["reading an issue's comments", ["api", "repos/o/r/issues/85/comments"]],
    ["commenting through the API", ["api", "-X", "POST", "repos/o/r/issues/85/comments", "-f", "body=x"]],
    [
      "writing a file to its own work branch",
      [
        "api", "-X", "PUT", "repos/o/r/contents/doc/x.md",
        "-f", "message=m", "-f", CONTENT, "-f", "branch=timone/7-x",
      ],
    ],
    [
      "running a GraphQL query",
      ["api", "graphql", "-f", "query=query { repository(owner: \"o\", name: \"r\") { id } }"],
    ],
  ])("allows %s", (_what, args) => {
    expect(forgeCallRefusal(args, WORK)).toBeUndefined();
  });
});

describe("what a step with no work branch may do through the forge", () => {
  it.each([
    ["a branch named like a run's", ["-f", "branch=timone/7-x"]],
    ["a branch named undefined", ["-f", "branch=undefined"]],
    ["no branch at all", []],
  ])("refuses writing a file to %s, and says the step writes nothing", (_what, branch) => {
    const refusal = forgeCallRefusal(
      ["api", "-X", "PUT", "repos/o/r/contents/doc/x.md", "-f", "message=m", "-f", CONTENT, ...branch],
      undefined,
    );

    expect(refusal).toMatch(/^Refused: /);
    expect(refusal).toContain("this step has no work branch, so it writes nothing to the project");
    expect(refusal).toContain("Say what you did on the ticket.");
    expect(refusal).not.toMatch(/(only to|Commit on) `undefined`/);
  });
});

describe("the same calls, written another way", () => {
  const WORK = "timone/7-x";

  it.each([
    ["the method joined to its flag", ["api", "--method=PUT", "repos/o/r/pulls/3/merge"]],
    ["the method joined to its short flag", ["api", "-XPUT", "repos/o/r/pulls/3/merge"]],
    ["a path that starts with a slash", ["api", "-X", "PUT", "/repos/o/r/pulls/3/merge"]],
    ["a whole URL", ["api", "-X", "PUT", "https://api.github.com/repos/o/r/pulls/3/merge"]],
    ["the repository named before the merge", ["pr", "--repo", "o/r", "merge", "12"]],
    ["a GraphQL query read from a file", ["api", "graphql", "--input", "query.json"]],
  ])("refuses %s", (_what, args) => {
    expect(forgeCallRefusal(args, WORK)).toMatch(/^Refused: /);
  });

  it("allows reading a file from any branch", () => {
    expect(forgeCallRefusal(["api", "repos/o/r/contents/STATUS.md?ref=main"], WORK)).toBeUndefined();
  });
});
