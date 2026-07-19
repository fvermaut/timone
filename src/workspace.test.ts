import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { Manifest, ProjectConfig } from "./manifest.js";
import { syncWorkspace } from "./commands/workspace.js";

/** Temp dirs created by the current test, removed in afterEach. */
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** Run git with the given args in `cwd`, returning stdout. */
function git(args: string[], cwd: string): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** A manifest project entry pointing at `repoUrl`, checked out at `path`. */
function projectEntry(repoUrl: string, path: string): ProjectConfig {
  return {
    repo_url: repoUrl,
    path,
    stack: [],
    bindings: { ticketing: "github" },
  };
}

interface Fixture {
  /** Path of the bare "remote" repository. */
  remote: string;
  /** Working clone used to push commits to the remote. */
  seed: string;
  /** Workspace root that syncWorkspace resolves project paths against. */
  workspace: string;
  manifest: Manifest;
  /** Where the `alpha` project gets cloned inside the workspace. */
  clonePath: string;
}

/**
 * Build a local-only fixture: a bare remote with one commit on `main`
 * (file.txt containing "v1\n"), a seed clone with a configured test
 * identity for pushing more commits, and a one-project manifest.
 */
function makeFixture(): Fixture {
  const tmp = mkdtempSync(join(tmpdir(), "timone-workspace-test-"));
  tempDirs.push(tmp);

  const remote = join(tmp, "remote.git");
  const seed = join(tmp, "seed");
  const workspace = join(tmp, "workspace");
  mkdirSync(workspace);

  git(["init", "--bare", "--initial-branch=main", remote], tmp);
  git(["init", "--initial-branch=main", seed], tmp);
  git(["config", "user.email", "timone-test@example.com"], seed);
  git(["config", "user.name", "Timone Test"], seed);
  git(["config", "commit.gpgsign", "false"], seed);
  writeFileSync(join(seed, "file.txt"), "v1\n");
  git(["add", "."], seed);
  git(["commit", "-m", "initial"], seed);
  git(["remote", "add", "origin", remote], seed);
  git(["push", "origin", "main"], seed);

  const manifest: Manifest = {
    projects: { alpha: projectEntry(remote, "projects/alpha") },
  };
  return {
    remote,
    seed,
    workspace,
    manifest,
    clonePath: join(workspace, "projects", "alpha"),
  };
}

/** Commit new file.txt content in the seed clone and push it to the remote. */
function pushCommit(fixture: Fixture, content: string): void {
  writeFileSync(join(fixture.seed, "file.txt"), content);
  git(["add", "."], fixture.seed);
  git(["commit", "-m", "update"], fixture.seed);
  git(["push", "origin", "main"], fixture.seed);
}

describe("syncWorkspace", () => {
  it("clones a missing project on first sync", async () => {
    const fixture = makeFixture();

    const entries = await syncWorkspace(fixture.manifest, fixture.workspace);

    expect(entries).toEqual([{ name: "alpha", status: "cloned", failed: false }]);
    expect(readFileSync(join(fixture.clonePath, "file.txt"), "utf8")).toBe(
      "v1\n",
    );
  });

  it("reports up-to-date when the upstream has not moved", async () => {
    const fixture = makeFixture();
    await syncWorkspace(fixture.manifest, fixture.workspace);

    const entries = await syncWorkspace(fixture.manifest, fixture.workspace);

    expect(entries).toEqual([
      { name: "alpha", status: "up-to-date", failed: false },
    ]);
  });

  it("fast-forwards and reports updated when the upstream gains a commit", async () => {
    const fixture = makeFixture();
    await syncWorkspace(fixture.manifest, fixture.workspace);
    pushCommit(fixture, "v2\n");

    const entries = await syncWorkspace(fixture.manifest, fixture.workspace);

    expect(entries).toEqual([
      { name: "alpha", status: "updated", failed: false },
    ]);
    expect(readFileSync(join(fixture.clonePath, "file.txt"), "utf8")).toBe(
      "v2\n",
    );
  });

  it("skips a dirty checkout without touching it", async () => {
    const fixture = makeFixture();
    await syncWorkspace(fixture.manifest, fixture.workspace);
    pushCommit(fixture, "v2\n");
    writeFileSync(join(fixture.clonePath, "file.txt"), "local edit\n");

    const entries = await syncWorkspace(fixture.manifest, fixture.workspace);

    expect(entries).toEqual([
      { name: "alpha", status: "skipped (dirty)", failed: false },
    ]);
    expect(readFileSync(join(fixture.clonePath, "file.txt"), "utf8")).toBe(
      "local edit\n",
    );
  });

  it("skips a checkout on a non-default branch", async () => {
    const fixture = makeFixture();
    await syncWorkspace(fixture.manifest, fixture.workspace);
    git(["checkout", "-b", "feature"], fixture.clonePath);

    const entries = await syncWorkspace(fixture.manifest, fixture.workspace);

    expect(entries).toEqual([
      { name: "alpha", status: "skipped (on branch feature)", failed: false },
    ]);
  });

  it("fails a plain non-git directory but still processes the others", async () => {
    const fixture = makeFixture();
    mkdirSync(fixture.clonePath, { recursive: true });
    const manifest: Manifest = {
      projects: {
        alpha: fixture.manifest.projects["alpha"]!,
        beta: projectEntry(fixture.remote, "projects/beta"),
      },
    };

    const entries = await syncWorkspace(manifest, fixture.workspace);

    expect(entries).toEqual([
      { name: "alpha", status: "failed (not a git repository)", failed: true },
      { name: "beta", status: "cloned", failed: false },
    ]);
    expect(
      readFileSync(join(fixture.workspace, "projects", "beta", "file.txt"), "utf8"),
    ).toBe("v1\n");
  });
});
