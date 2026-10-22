import {
  LEDGER_LABEL,
  type ContainerExit,
  type ContainerSpawn,
} from "./container-runtime.js";

/**
 * A starting daemon removes the boxes an earlier daemon of its own ledger left
 * behind, and says what it removed
 * ([timone#73](https://github.com/fvermaut/timone/issues/73)).
 *
 * A box is created for its run and does not outlive it
 * ([R23](../../doc/specs/prd/prd-02-inversion-of-control.criteria.md#r23--a-run-is-isolated-from-fvermauts-machine)
 * clause 1, [ADR-0041](../../doc/adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md)
 * D1). A daemon that stopped without removing its boxes broke that, and
 * the next daemon then asked docker for a name a leftover box still held.
 *
 * **Which boxes are this daemon's is read from a label, not from the name's
 * `timone-` prefix.** The prefix is not only the boxes': a preview of the
 * `timone` project and the service containers of a run's stack start with
 * it too, and removing them takes down what fvermaut is looking at or a
 * database a run is using. And a second daemon on the same machine, with a
 * ledger of its own, starts boxes with the same prefix; they are its boxes,
 * not leftovers. The label names the ledger of the daemon that started the
 * box, so it says whose the box is. A box from before the label existed has
 * none, and only the exact old name `timone-<project>-<digits>` is read as
 * a leftover then.
 */

/** One container, as `docker ps -a` lists it. */
export interface ListedBox {
  id: string;
  name: string;
  ledger: string;
}

/** The `--format` the listing asks for: id, name and the ledger label, tab-separated. */
export const LISTING_FORMAT = `{{.ID}}\t{{.Names}}\t{{.Label "${LEDGER_LABEL}"}}`;

/** Parse the listing's lines; a blank line or one with fewer than two fields is skipped. */
export function parseListing(lines: readonly string[]): ListedBox[] {
  const listed: ListedBox[] = [];
  for (const line of lines) {
    const [id, name, ledger = ""] = line.split("\t");
    if (id === undefined || name === undefined) continue;
    listed.push({ id, name, ledger });
  }
  return listed;
}

/**
 * The boxes a starting daemon removes: those labelled with its own ledger,
 * and those with no ledger label named exactly `timone-<project>-<digits>`
 * for one of its projects (the old naming). Nothing else. Pure.
 */
export function leftoverBoxes(
  listed: readonly ListedBox[],
  owner: { ledger: string; projects: readonly string[] },
): ListedBox[] {
  const oldNames = owner.projects.map(
    (project) => new RegExp(`^timone-${escapeForRegExp(project)}-\\d+$`),
  );
  return listed.filter(
    (box) =>
      box.ledger === owner.ledger ||
      (box.ledger === "" && oldNames.some((oldName) => oldName.test(box.name))),
  );
}

/** A project's name, with every character a regular expression reads escaped. */
function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * List every container, remove the leftovers, wait for the removal, and say
 * in the log what was removed. Never throws: a daemon that cannot list or
 * remove says so and starts anyway. `spawn` is required, so no caller can
 * reach the real docker without choosing to. Returns the removed names.
 */
export async function sweepLeftoverBoxes(options: {
  spawn: ContainerSpawn;
  ledger: string;
  projects: readonly string[];
  log: (message: string) => void;
}): Promise<string[]> {
  const listed = await listContainers(options.spawn);
  if (!listed.ok) {
    options.log(
      `could not list containers to remove leftover boxes: ${listed.reason}`,
    );
    return [];
  }

  const leftovers = leftoverBoxes(parseListing(listed.lines), options);
  if (leftovers.length === 0) return [];
  const names = leftovers.map((box) => box.name);
  const failure = await removeContainers(
    options.spawn,
    leftovers.map((box) => box.id),
  );
  if (failure !== undefined) {
    // docker removes what it can and exits 1 for the rest, so which of them
    // are gone is not known; none is claimed.
    options.log(
      `could not remove every leftover box (${names.join(", ")}): ${failure}`,
    );
    return [];
  }
  options.log(
    `removed ${names.length} box(es) left by an earlier daemon: ${names.join(", ")}`,
  );
  return names;
}

/** Remove the containers and wait for it; why it failed, or nothing. Never throws. */
async function removeContainers(
  spawn: ContainerSpawn,
  ids: readonly string[],
): Promise<string | undefined> {
  try {
    const exit = await spawn("docker", ["rm", "-f", ...ids]).exit;
    return exit.code === 0 ? undefined : failureOf(exit);
  } catch (error) {
    return firstLine(errorText(error));
  }
}

/** Every container's listing line, or why there is none. Never throws. */
async function listContainers(
  spawn: ContainerSpawn,
): Promise<{ ok: true; lines: string[] } | { ok: false; reason: string }> {
  try {
    const listing = spawn("docker", [
      "ps",
      "-a",
      "--no-trunc",
      "--format",
      LISTING_FORMAT,
    ]);
    const lines: string[] = [];
    for await (const line of listing.lines) lines.push(line);
    const exit = await listing.exit;
    return exit.code === 0
      ? { ok: true, lines }
      : { ok: false, reason: failureOf(exit) };
  } catch (error) {
    return { ok: false, reason: firstLine(errorText(error)) };
  }
}

/** Why a docker call failed, in one line: its stderr, or how it ended. */
function failureOf(exit: ContainerExit): string {
  const stderr = exit.stderr.trim();
  if (stderr !== "") return firstLine(stderr);
  return exit.signal === null
    ? `docker exited ${exit.code ?? "with no status"}`
    : `docker was killed by ${exit.signal}`;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function firstLine(text: string): string {
  return text.trim().split("\n")[0] ?? "";
}
