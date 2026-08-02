import type { Manifest } from "../manifest.js";
import type { TicketingAdapter, TicketingProject } from "../adapters/ticketing.js";
import type { Run, RunStore } from "./runs.js";

/**
 * The hand-off to a spawned agent session. Declared here rather than in the
 * session module so the poll loop depends on the seam, not on the Agent SDK:
 * the loop is fully testable with a fake, and the real spawner is one
 * implementation of this interface.
 */
export interface SessionSpawner {
  spawn(run: Run, project: TicketingProject): Promise<void>;
}

export interface PollDeps {
  manifest: Manifest;
  store: RunStore;
  adapter: TicketingAdapter;
  spawner: SessionSpawner;
  /** Progress sink; defaults to silence (the command wires stdout). */
  log?: (message: string) => void;
}

export interface PollResult {
  /** Run ids newly picked up this cycle. */
  pickedUp: string[];
  /** Run ids newly queued behind an occupying run this cycle. */
  queued: string[];
  /** Run ids handed to the spawner this cycle. */
  spawned: string[];
  /** One readable line per project that failed; the cycle continued. */
  errors: string[];
}

/**
 * The acknowledgement posted when a ticket is picked up. Written for
 * someone who knows nothing about the process: no stage names, no skill
 * names, and a closing line that says plainly what is being asked of them
 * (here: nothing).
 */
export function pickedUpComment(): string {
  return [
    "**Picked this up.**",
    "",
    "I'm reading it now, working out what kind of request it is and what should",
    "happen next. Whatever I work out gets written back here on this ticket.",
    "",
    "**What I need from you:** nothing right now — I'll comment here when I do.",
  ].join("\n");
}

/**
 * The acknowledgement posted when a ticket has to wait: this project is
 * already working something else, and it works one thing at a time.
 */
export function queuedComment(
  aheadOfIt: number,
  position: number,
): string {
  const place =
    position <= 1 ? "It's next in line." : `It's number ${position} in line.`;
  return [
    "**This one is in the queue.**",
    "",
    `I'm already working on #${aheadOfIt} for this project, and I take one thing`,
    `at a time so two pieces of work never collide. ${place}`,
    "",
    "**What I need from you:** nothing right now — I'll comment here when I start.",
  ].join("\n");
}

/** Reduce an error to one readable line. */
function oneLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0];
}

/**
 * Run one poll cycle over every project in the manifest: list the marked
 * tickets, register the ones not already tracked, acknowledge each exactly
 * once, and hand the project's occupying run to the spawner if no session
 * is attached to it yet.
 *
 * Nothing here throws: a project whose tracker misbehaves is reported in
 * `errors` and the remaining projects are still polled. The acknowledgement
 * is posted only for runs this cycle created, which is what makes repeated
 * cycles silent (the store's registration is idempotent per ticket).
 */
export async function pollOnce(deps: PollDeps): Promise<PollResult> {
  const { manifest } = deps;
  const log = deps.log ?? (() => {});
  const result: PollResult = {
    pickedUp: [],
    queued: [],
    spawned: [],
    errors: [],
  };

  for (const [name, config] of Object.entries(manifest.projects)) {
    const project: TicketingProject = { name, repoUrl: config.repo_url };
    try {
      await pollProject(project, deps, result, log);
    } catch (error) {
      const line = `${name}: ${oneLine(error)}`;
      result.errors.push(line);
      log(`error  ${line}`);
    }
  }

  return result;
}

/** One project's share of a cycle. Throws only on tracker-level failures. */
async function pollProject(
  project: TicketingProject,
  deps: PollDeps,
  result: PollResult,
  log: (message: string) => void,
): Promise<void> {
  const { store, adapter, spawner } = deps;

  const tickets = await adapter.listMarkedTickets(project);
  for (const ticket of tickets) {
    const occupier = store.occupyingRun(project.name);
    const { run, created } = store.register(project.name, ticket.number);
    if (!created) continue;

    if (run.status === "queued") {
      result.queued.push(run.id);
      log(`queued ${run.id}`);
      await adapter.postComment(
        project,
        ticket.number,
        queuedComment(occupier?.ticket ?? 0, store.queuePosition(run.id)),
      );
    } else {
      result.pickedUp.push(run.id);
      log(`pickup ${run.id}`);
      await adapter.postComment(project, ticket.number, pickedUpComment());
    }
  }

  // Hand off whatever now holds the project, if nothing is running it yet.
  // Promotion out of the queue happens in the store when a run ends, so a
  // ticket queued in an earlier cycle starts here without being re-acked.
  const occupier = store.occupyingRun(project.name);
  if (occupier !== undefined && occupier.status === "picked-up") {
    try {
      await spawner.spawn(occupier, project);
      result.spawned.push(occupier.id);
      log(`spawn  ${occupier.id}`);
    } catch (error) {
      const line = `${project.name}: could not start a session for #${occupier.ticket}: ${oneLine(error)}`;
      result.errors.push(line);
      log(`error  ${line}`);
    }
  }
}
