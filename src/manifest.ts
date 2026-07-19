import { readFileSync } from "node:fs";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { z } from "zod";

/**
 * Schema for the `bindings` block of a project. Unknown keys are rejected.
 * For now only one implementation exists per binding kind.
 */
const bindingsSchema = z.strictObject({
  ticketing: z.literal("github"),
  preview: z.literal("docker").optional(),
});

/** Schema for a single entry under `projects`. Unknown keys are rejected. */
const projectConfigSchema = z.strictObject({
  repo_url: z.string().min(1, "must not be empty"),
  path: z
    .string()
    .refine((value) => value.startsWith("projects/"), {
      message: 'must start with "projects/"',
    }),
  stack: z.array(z.string()),
  bindings: bindingsSchema,
});

/** Schema for the whole timone.yaml manifest. Unknown keys are rejected. */
const manifestSchema = z.strictObject({
  projects: z.record(z.string(), projectConfigSchema),
});

export type ProjectConfig = z.infer<typeof projectConfigSchema>;
export type Manifest = z.infer<typeof manifestSchema>;

/** Walk `data` along `path`, returning undefined if any step is missing. */
function valueAt(data: unknown, path: readonly PropertyKey[]): unknown {
  let current: unknown = data;
  for (const key of path) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<PropertyKey, unknown>)[key];
  }
  return current;
}

/**
 * Turn a single zod issue into a human-readable message that names the
 * offending project and field, e.g.
 * `project "client-alpha": missing required field "repo_url"`.
 */
function formatIssue(issue: z.core.$ZodIssue, data: unknown): string {
  const path = issue.path;

  let projectName: string | undefined;
  let fieldPath: string;
  if (path[0] === "projects" && path.length >= 2) {
    projectName = String(path[1]);
    fieldPath = path.slice(2).map(String).join(".");
  } else {
    fieldPath = path.map(String).join(".");
  }

  let detail: string;
  if (issue.code === "unrecognized_keys") {
    const keys = issue.keys.map((key) => `"${key}"`).join(", ");
    detail =
      fieldPath === ""
        ? `unknown key ${keys}`
        : `unknown key ${keys} in "${fieldPath}"`;
  } else if (issue.code === "invalid_type" && valueAt(data, path) === undefined) {
    detail =
      fieldPath === ""
        ? "missing document"
        : `missing required field "${fieldPath}"`;
  } else if (issue.code === "invalid_value") {
    const allowed = issue.values.map((value) => JSON.stringify(value));
    const expectation =
      allowed.length === 1 ? allowed[0] : `one of ${allowed.join(", ")}`;
    detail = `field "${fieldPath}" must be ${expectation}`;
  } else {
    detail =
      fieldPath === "" ? issue.message : `field "${fieldPath}": ${issue.message}`;
  }

  return projectName === undefined
    ? detail
    : `project "${projectName}": ${detail}`;
}

/**
 * Validate already-parsed manifest data. Throws an Error with readable,
 * project/field-scoped messages on failure.
 */
export function parseManifest(data: unknown): Manifest {
  const result = manifestSchema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((issue) => formatIssue(issue, data));
    throw new Error(`Invalid manifest: ${details.join("; ")}`);
  }
  return result.data;
}

/**
 * Read, parse and validate a timone.yaml manifest from disk.
 *
 * Throws a clear error naming the file path when the file is missing or
 * unreadable, or when it is not valid YAML; throws a project/field-scoped
 * validation error when the content does not match the schema.
 */
export function loadManifest(filePath: string): Manifest {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot read manifest file "${filePath}": ${reason}`);
  }

  let data: unknown;
  try {
    data = parseYaml(raw);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid YAML in manifest file "${filePath}": ${reason}`);
  }

  return parseManifest(data);
}

/**
 * Add a project entry to a manifest, returning a new `Manifest` (the input
 * is never mutated). Validates `entry` against the same per-project zod
 * shape `loadManifest` uses, via {@link parseManifest}, so error messages
 * share its "project ... field ..." style.
 *
 * Throws when `name` already exists in `manifest.projects`, or when `entry`
 * fails validation.
 */
export function addProject(
  manifest: Manifest,
  name: string,
  entry: ProjectConfig,
): Manifest {
  if (name in manifest.projects) {
    throw new Error(`Invalid manifest: project "${name}": already exists`);
  }

  const candidate = {
    projects: { ...manifest.projects, [name]: entry },
  };
  return parseManifest(candidate);
}

/**
 * A partial correction to an existing project entry. Only the provided
 * fields change; `bindings` is itself merged field-by-field.
 */
export type ProjectPatch = Partial<Omit<ProjectConfig, "bindings">> & {
  bindings?: Partial<ProjectConfig["bindings"]>;
};

/**
 * Apply a patch to an existing project entry, returning a new `Manifest`
 * (the input is never mutated). Fields absent from the patch keep their
 * current values; the merged result is validated via {@link parseManifest},
 * so error messages share its "project ... field ..." style.
 *
 * Throws when `name` does not exist in `manifest.projects` (listing the
 * known names), or when the merged entry fails validation.
 */
export function updateProject(
  manifest: Manifest,
  name: string,
  patch: ProjectPatch,
): Manifest {
  const existing = manifest.projects[name];
  if (existing === undefined) {
    const known = Object.keys(manifest.projects)
      .map((key) => `"${key}"`)
      .join(", ");
    throw new Error(
      `Invalid manifest: project "${name}": not found (known projects: ${known})`,
    );
  }

  const { bindings: bindingsPatch, ...fieldsPatch } = patch;
  const merged = {
    ...existing,
    ...fieldsPatch,
    bindings: { ...existing.bindings, ...bindingsPatch },
  };

  const candidate = {
    projects: { ...manifest.projects, [name]: merged },
  };
  return parseManifest(candidate);
}

/**
 * Serialize a manifest back to YAML text. Does not preserve comments (see
 * ADR-0008); round-trips through {@link parseManifest} / {@link loadManifest}.
 */
export function serializeManifest(manifest: Manifest): string {
  return stringifyYaml(manifest);
}
