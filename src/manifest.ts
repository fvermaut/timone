import { readFileSync } from "node:fs";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { z } from "zod";

import { DEFAULT_LIMIT_USD } from "./runner/limit.js";

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
  /**
   * Whether the daemon introduces itself, once, on this project's open
   * tickets that carry no mark
   * ([ADR-0024](../doc/adr/0024-every-open-ticket-answers-for-itself.md)).
   *
   * **Absent is off, and that is the whole of the restraint.** The ADR asks
   * for a switch "defaulting off for a repository onboarded with an existing
   * backlog — introducing Timone to two hundred issues at once is a worse
   * first impression than silence", and an entry written before this key
   * existed is exactly such a repository. So it is optional rather than
   * defaulted: `undefined` and `false` both mean silence, and no manifest
   * already on disk acquires an opinion by being re-read.
   *
   * Onboarding is where it is decided (`.claude/skills/timone-onboard`),
   * deliberately and per project — this is the first thing Timone says
   * somewhere nobody invited it.
   */
  introduce_unmarked: z.boolean().optional(),
  bindings: bindingsSchema,
  /**
   * The forge logins whose comments the runner takes as instructions on this
   * project (ADR-0060 D6: "only people named for the project in `timone.yaml`
   * can instruct it, the operator by default"). When set, they **replace** the
   * top-level `operator` rather than joining it, so a project can be steered
   * by the people named here alone.
   *
   * At least one when present: an empty list would replace the operator with
   * nobody, which is the case the manifest refuses below, written another way.
   */
  instructors: z
    .array(z.string().min(1, "must not be empty"))
    .min(1, "must name at least one person")
    .optional(),
  /**
   * How many dollars one ticket of this project may spend, across all its
   * runs, before no new session starts (ADR-0060 D5: "the amount can be
   * changed per project"). Absent means `DEFAULT_LIMIT_USD`, read through
   * {@link ticketLimitOf}.
   */
  ticket_limit_usd: z.number().positive("must be more than 0").optional(),
  /**
   * How many places this project has: how many of its tickets may have a
   * step running at once
   * ([PRD-07.R2](../doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md),
   * [ADR-0065](../doc/adr/0065-the-planner-is-a-session-of-its-own-asked-when-a-build-would-start.md)
   * D6). Absent means `DEFAULT_PLACES`, read through {@link placesOf}.
   */
  places: z.number().int().min(1, "must be 1 or more").optional(),
});

/**
 * Timone's own identity on the forge
 * ([ADR-0042](../doc/adr/0042-timone-acts-under-its-own-identity.md), as
 * amended): a **GitHub App installed on the managed repositories**, not a
 * second account invited to them.
 *
 * There is nothing here to record per project. The installation is the grant
 * and its repository selection is the scoping, so adding a project later edits
 * that selection on GitHub rather than this file.
 *
 * **No token is declared and none may be.** What is on disk is a private key,
 * under `.timone/`, which `.gitignore` already excludes as daemon machine
 * state — so it cannot ride into a client repository and it does not make
 * timone's own checkout dirty. Every credential is minted from it, scoped to
 * one repository, and dies within the hour (`src/adapters/credentials.ts`).
 */
const identitySchema = z.strictObject({
  /** The App's numeric id. */
  app_id: z.number().int().positive(),
  /** The installation covering the repositories declared below. */
  installation_id: z.number().int().positive(),
  /** Path to the App's private key, relative to the timone root. */
  private_key_path: z.string().min(1, "must not be empty"),
  /**
   * The login the App acts under on the forge — `timone-agent[bot]`.
   *
   * Declared because a comment has to be recognisable as Timone's by its
   * author and not only by the marker in its body. It is **not** how the
   * credential is obtained; it is how the credential's work is read back.
   */
  login: z.string().min(1, "must not be empty"),
  /**
   * The email machine-authored commits carry.
   *
   * ✏ Added 2026-08-22, after the first real boxed run pushed two commits
   * authored `Francois Vermaut <fvermaut@gmail.com>`. A fresh clone inside
   * the box has no `user.email`, and what filled the gap was the host's.
   * [R23](../doc/specs/prd/prd-02-inversion-of-control.criteria.md) clause 5
   * says a commit the machine produces is **Timone's own and not
   * fvermaut's**.
   *
   * GitHub links a commit to the App's bot only for
   * `<numeric-id>+<login>@users.noreply.github.com` — the same address
   * GitHub's own merge API stamps — and the numeric id is not derivable from
   * the login, so it is declared rather than guessed. Optional: without it
   * the commits are still not fvermaut's, they simply do not link to a
   * profile.
   */
  commit_email: z.string().min(1, "must not be empty").optional(),
});

/** Schema for the whole timone.yaml manifest. Unknown keys are rejected. */
const manifestSchema = z.strictObject({
  /**
   * Optional here, and refused at the daemon.
   *
   * `workspace sync` and `projects list` are fvermaut's own commands, run
   * from his terminal under his own login, and a manifest that never spawns
   * a run needs no identity. What may never borrow his login is the daemon —
   * so `src/commands/daemon.ts` refuses to start without this block, which
   * is where "fails loudly at spawn time, never falls back to ambient login"
   * actually lives.
   */
  identity: identitySchema.optional(),
  /**
   * The operator's own forge login: the person who may instruct the runner
   * on every project that does not name its own `instructors` (ADR-0060 D6).
   *
   * Top-level because it is one person across every project. Optional,
   * because `workspace sync` and `projects list` need nobody named.
   *
   * ✏ 2026-09-30: until the `driver` line was removed, a runner project
   * that named nobody was refused here. Refusing it here now would refuse
   * every manifest without an operator, including the ones those two
   * commands read. So the refusal moved to the daemon's start, beside the
   * refusal of a missing `identity` block: `src/commands/daemon.ts` does not
   * start while any project names nobody who may instruct it.
   */
  operator: z.string().min(1, "must not be empty").optional(),
  projects: z.record(z.string(), projectConfigSchema),
});

export type Identity = z.infer<typeof identitySchema>;
export type ProjectConfig = z.infer<typeof projectConfigSchema>;
export type Manifest = z.infer<typeof manifestSchema>;

/**
 * The forge logins whose comments may instruct the runner on project `name`:
 * the project's own `instructors` when it names any, and otherwise the
 * operator alone. Empty when the manifest names nobody, which the daemon
 * refuses at its start (`src/commands/daemon.ts`).
 *
 * Logins come back as written. Comparing them with a comment's author is the
 * caller's work, because only the caller knows which surface the author came
 * from.
 */
export function namedPeople(manifest: Manifest, name: string): string[] {
  const instructors = manifest.projects[name]?.instructors;
  if (instructors !== undefined) return [...instructors];
  return manifest.operator === undefined ? [] : [manifest.operator];
}

/**
 * How many dollars one ticket of this project may spend before no new
 * session starts (ADR-0060 D5).
 */
export function ticketLimitOf(config: ProjectConfig): number {
  return config.ticket_limit_usd ?? DEFAULT_LIMIT_USD;
}

/**
 * How many places a project has when its entry sets none (PRD-07.R2 clause 1,
 * ADR-0065 D6).
 */
export const DEFAULT_PLACES = 2;

/**
 * How many places this project has: how many of its runs may have a step
 * running at once (PRD-07.R2, ADR-0065 D6).
 */
export function placesOf(config: ProjectConfig): number {
  return config.places ?? DEFAULT_PLACES;
}

/**
 * {@link placesOf} for each project of `manifest`, by its name: what every
 * command that opens the ledger tells it. A project the manifest no longer
 * has gets `DEFAULT_PLACES`, so a run of a project removed from `timone.yaml`
 * can still be read and ended.
 */
export function placesIn(manifest: Manifest): (project: string) => number {
  return (project) => {
    const config = manifest.projects[project];
    return config === undefined ? DEFAULT_PLACES : placesOf(config);
  };
}

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
 * One sentence for each project in `data` whose entry still has a `driver`
 * line, saying to delete it. Empty when none has.
 *
 * ✏ 2026-09-30: the runner drives every project, so the line that chose
 * between it and the old daemon means nothing any more
 * ([ADR-0060](../doc/adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md)
 * D9). It is refused rather than ignored, so a manifest that still says
 * `driver: daemon` cannot load and look as if the line did something. Read
 * before the schema, whose "unknown key" would not say why the line went.
 */
function removedDriverLines(data: unknown): string[] {
  const projects = valueAt(data, ["projects"]);
  if (projects === null || typeof projects !== "object") return [];
  return Object.entries(projects)
    .filter(([, entry]) => entry !== null && typeof entry === "object" && "driver" in entry)
    .map(
      ([name]) =>
        `${name}: the \`driver\` line was removed on 2026-09-30. ` +
        "Every project is now driven by the runner. Delete the line.",
    );
}

/**
 * Validate already-parsed manifest data. Throws an Error with readable,
 * project/field-scoped messages on failure.
 */
export function parseManifest(data: unknown): Manifest {
  const removed = removedDriverLines(data);
  if (removed.length > 0) throw new Error(removed.join("\n"));

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
    ...manifest,
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
    ...manifest,
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
