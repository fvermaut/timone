import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parse as parseYamlText } from "yaml";

import {
  addProject,
  loadManifest,
  parseManifest,
  serializeManifest,
  updateProject,
  type Manifest,
  type ProjectConfig,
  type ProjectPatch,
} from "./manifest.js";

let dir: string;
let counter = 0;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "timone-manifest-test-"));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Write YAML to a temp file and return its path. */
function writeManifest(yamlText: string): string {
  const file = join(dir, `manifest-${counter++}.yaml`);
  writeFileSync(file, yamlText, "utf8");
  return file;
}

const validYaml = `
projects:
  client-alpha:
    repo_url: git@github.com:fvermaut/pilot-app.git
    path: projects/client-alpha
    stack:
      - typescript
      - react
    bindings:
      ticketing: github
      preview: docker
  internal-tools:
    repo_url: git@github.com:fvermaut/internal-tools.git
    path: projects/internal-tools
    stack: []
    bindings:
      ticketing: github
`;

describe("loadManifest", () => {
  it("parses a valid manifest with typed, accessible fields", () => {
    const manifest: Manifest = loadManifest(writeManifest(validYaml));

    expect(Object.keys(manifest.projects)).toEqual([
      "client-alpha",
      "internal-tools",
    ]);

    const alpha = manifest.projects["client-alpha"]!;
    expect(alpha.repo_url).toBe("git@github.com:fvermaut/pilot-app.git");
    expect(alpha.path).toBe("projects/client-alpha");
    expect(alpha.stack).toEqual(["typescript", "react"]);
    expect(alpha.bindings.ticketing).toBe("github");
    expect(alpha.bindings.preview).toBe("docker");
  });

  it("rejects a project missing repo_url, naming project and field", () => {
    const file = writeManifest(`
projects:
  client-alpha:
    path: projects/client-alpha
    stack: []
    bindings:
      ticketing: github
`);
    expect(() => loadManifest(file)).toThrowError(
      'Invalid manifest: project "client-alpha": missing required field "repo_url"',
    );
  });

  it("rejects an unknown ticketing value with a readable error", () => {
    const file = writeManifest(`
projects:
  client-alpha:
    repo_url: git@github.com:fvermaut/pilot-app.git
    path: projects/client-alpha
    stack: []
    bindings:
      ticketing: jira
`);
    expect(() => loadManifest(file)).toThrowError(
      'Invalid manifest: project "client-alpha": field "bindings.ticketing" must be "github"',
    );
  });

  it("rejects an unknown preview value with a readable error", () => {
    const file = writeManifest(`
projects:
  client-alpha:
    repo_url: git@github.com:fvermaut/pilot-app.git
    path: projects/client-alpha
    stack: []
    bindings:
      ticketing: github
      preview: kubernetes
`);
    expect(() => loadManifest(file)).toThrowError(
      'Invalid manifest: project "client-alpha": field "bindings.preview" must be "docker"',
    );
  });

  it('rejects a path that does not start with "projects/"', () => {
    const file = writeManifest(`
projects:
  client-alpha:
    repo_url: git@github.com:fvermaut/pilot-app.git
    path: apps/client-alpha
    stack: []
    bindings:
      ticketing: github
`);
    expect(() => loadManifest(file)).toThrowError(
      'Invalid manifest: project "client-alpha": field "path": must start with "projects/"',
    );
  });

  it("rejects unknown extra keys on a project", () => {
    const file = writeManifest(`
projects:
  client-alpha:
    repo_url: git@github.com:fvermaut/pilot-app.git
    path: projects/client-alpha
    stack: []
    docker_image: node:22
    bindings:
      ticketing: github
`);
    expect(() => loadManifest(file)).toThrowError(
      'Invalid manifest: project "client-alpha": unknown key "docker_image"',
    );
  });

  it("rejects unknown extra keys inside bindings", () => {
    const file = writeManifest(`
projects:
  client-alpha:
    repo_url: git@github.com:fvermaut/pilot-app.git
    path: projects/client-alpha
    stack: []
    bindings:
      ticketing: github
      deploy: heroku
`);
    expect(() => loadManifest(file)).toThrowError(
      'Invalid manifest: project "client-alpha": unknown key "deploy" in "bindings"',
    );
  });

  it("accepts an empty stack array", () => {
    const file = writeManifest(`
projects:
  bare-bones:
    repo_url: git@github.com:fvermaut/bare-bones.git
    path: projects/bare-bones
    stack: []
    bindings:
      ticketing: github
`);
    const manifest = loadManifest(file);
    expect(manifest.projects["bare-bones"]!.stack).toEqual([]);
  });

  it("accepts a missing preview binding", () => {
    const manifest = loadManifest(writeManifest(validYaml));
    expect(manifest.projects["internal-tools"]!.bindings.preview).toBeUndefined();
  });

  it("rejects an empty repo_url", () => {
    const file = writeManifest(`
projects:
  client-alpha:
    repo_url: ""
    path: projects/client-alpha
    stack: []
    bindings:
      ticketing: github
`);
    expect(() => loadManifest(file)).toThrowError(
      'Invalid manifest: project "client-alpha": field "repo_url": must not be empty',
    );
  });

  it("throws a clear error naming the path for a missing file", () => {
    const missing = join(dir, "does-not-exist.yaml");
    expect(() => loadManifest(missing)).toThrowError(
      `Cannot read manifest file "${missing}"`,
    );
  });

  it("throws a clear error naming the path for invalid YAML", () => {
    const file = writeManifest("projects: [unclosed");
    expect(() => loadManifest(file)).toThrowError(
      `Invalid YAML in manifest file "${file}"`,
    );
  });
});

const validEntry: ProjectConfig = {
  repo_url: "git@github.com:fvermaut/scratch-app.git",
  path: "projects/scratch-app",
  stack: ["typescript"],
  bindings: { ticketing: "github" },
};

describe("addProject", () => {
  it("adds to an empty manifest and produces a valid single-entry manifest", () => {
    const empty: Manifest = { projects: {} };
    const updated = addProject(empty, "scratch-app", validEntry);

    expect(Object.keys(updated.projects)).toEqual(["scratch-app"]);
    expect(updated.projects["scratch-app"]).toEqual(validEntry);
  });

  it("throws on a duplicate name, naming the project", () => {
    const manifest: Manifest = { projects: { "scratch-app": validEntry } };
    expect(() => addProject(manifest, "scratch-app", validEntry)).toThrowError(
      /"scratch-app".*already exists/,
    );
  });

  it("throws the same field-naming error style as loadManifest for an invalid ticketing value", () => {
    const empty: Manifest = { projects: {} };
    const invalidEntry = {
      ...validEntry,
      bindings: { ticketing: "jira" },
    } as unknown as ProjectConfig;

    expect(() => addProject(empty, "scratch-app", invalidEntry)).toThrowError(
      'Invalid manifest: project "scratch-app": field "bindings.ticketing" must be "github"',
    );
  });

  it("does not mutate its input manifest argument", () => {
    const empty: Manifest = { projects: {} };
    addProject(empty, "scratch-app", validEntry);

    expect(Object.keys(empty.projects)).toEqual([]);
  });
});

describe("updateProject", () => {
  const baseManifest = (): Manifest => ({
    projects: {
      "scratch-app": {
        repo_url: "git@github.com:fvermaut/scratch-app.git",
        path: "projects/scratch-app",
        stack: ["typescript"],
        bindings: { ticketing: "github", preview: "docker" },
      },
      "scratch-existing": {
        repo_url: "git@github.com:fvermaut/scratch-existing.git",
        path: "projects/scratch-existing",
        stack: ["typescript", "nextjs"],
        bindings: { ticketing: "github" },
      },
    },
  });

  it("updates one field and preserves every other field", () => {
    const updated = updateProject(baseManifest(), "scratch-existing", {
      stack: ["typescript", "nextjs", "tailwind"],
    });

    const project = updated.projects["scratch-existing"]!;
    expect(project.stack).toEqual(["typescript", "nextjs", "tailwind"]);
    expect(project.repo_url).toBe("git@github.com:fvermaut/scratch-existing.git");
    expect(project.path).toBe("projects/scratch-existing");
    expect(project.bindings).toEqual({ ticketing: "github" });
    expect(updated.projects["scratch-app"]).toEqual(
      baseManifest().projects["scratch-app"],
    );
  });

  it("merges bindings partially, preserving fields not in the patch", () => {
    const updated = updateProject(baseManifest(), "scratch-existing", {
      bindings: { preview: "docker" },
    });

    expect(updated.projects["scratch-existing"]!.bindings).toEqual({
      ticketing: "github",
      preview: "docker",
    });
  });

  it("throws on an unknown project name, listing the valid names", () => {
    expect(() =>
      updateProject(baseManifest(), "no-such-project", { stack: [] }),
    ).toThrowError(
      'Invalid manifest: project "no-such-project": not found (known projects: "scratch-app", "scratch-existing")',
    );
  });

  it("throws the same field-naming error style as loadManifest for an invalid ticketing value", () => {
    const patch = { bindings: { ticketing: "jira" } } as unknown as ProjectPatch;
    expect(() =>
      updateProject(baseManifest(), "scratch-app", patch),
    ).toThrowError(
      'Invalid manifest: project "scratch-app": field "bindings.ticketing" must be "github"',
    );
  });

  it("does not mutate its input manifest argument", () => {
    const manifest = baseManifest();
    updateProject(manifest, "scratch-existing", { stack: ["changed"] });

    expect(manifest).toEqual(baseManifest());
  });

  it("produces a manifest that round-trips through serializeManifest/loadManifest", () => {
    const updated = updateProject(baseManifest(), "scratch-existing", {
      repo_url: "git@github.com:fvermaut/renamed.git",
    });

    const file = join(dir, `manifest-${counter++}.yaml`);
    writeFileSync(file, serializeManifest(updated), "utf8");
    expect(loadManifest(file)).toEqual(updated);
  });
});

describe("serializeManifest", () => {
  it("round-trips through parseManifest/loadManifest unchanged", () => {
    const manifest: Manifest = {
      projects: {
        "client-alpha": {
          repo_url: "git@github.com:fvermaut/pilot-app.git",
          path: "projects/client-alpha",
          stack: ["typescript", "react"],
          bindings: { ticketing: "github", preview: "docker" },
        },
        "internal-tools": {
          repo_url: "git@github.com:fvermaut/internal-tools.git",
          path: "projects/internal-tools",
          stack: [],
          bindings: { ticketing: "github" },
        },
      },
    };

    const yamlText = serializeManifest(manifest);

    expect(parseManifest(parseYamlText(yamlText))).toEqual(manifest);

    const file = join(dir, `manifest-${counter++}.yaml`);
    writeFileSync(file, yamlText, "utf8");
    expect(loadManifest(file)).toEqual(manifest);
  });
});
