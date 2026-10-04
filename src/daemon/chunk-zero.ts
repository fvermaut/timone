import { repoSlug } from "../adapters/github-tickets.js";
import type {
  Dependency,
  MergeOutcome,
  TicketingAdapter,
  TicketingProject,
} from "../adapters/ticketing.js";
import {
  fromForgeDefaultBranch,
  orderOf,
  readBreakdown,
  type BreakdownSource,
  type Chunk,
} from "./breakdown.js";
import type { Run, RunStore } from "./runs.js";
import { mergeMessage } from "./session.js";
import {
  HELD_LABEL,
  HELD_LABEL_DESCRIPTION,
  MAP_LABEL,
  MAP_LABEL_DESCRIPTION,
} from "./steps.js";

/**
 * What the two acts that close chunk zero need from outside: merging its
 * branch, and opening one ticket per step of the approved breakdown
 * (ADR-0030 D2, ADR-0040).
 *
 * Moved out of the old spawner so that the runner called the same code rather
 * than a copy of it. The spawner was removed on 2026-09-30; the runner is the
 * one caller left.
 */
export interface ChunkZeroDeps {
  store: RunStore;
  adapter: TicketingAdapter;
  /**
   * Reads a ticket's approved breakdown. Defaults to the forge's default
   * branch, `breakdown.ts`'s `fromForgeDefaultBranch`.
   */
  breakdownSource?: BreakdownSource;
  /**
   * Merges chunk zero's branch into the default branch and pushes it.
   * Defaults to the ticketing adapter's `mergeIntoDefault`.
   */
  mergeProbe?: (
    project: TicketingProject,
    branch: string,
    message: string,
  ) => Promise<MergeOutcome>;
  log: (message: string) => void;
}

/**
 * A named person's approval of the list of pieces: who gave it, and when
 * their comment says they did.
 */
export interface ChunkZeroApproval {
  by: string;
  at: string;
}

/**
 * Why chunk zero was not merged: what the forge or git said, and whether the
 * two sides clash.
 */
export type ChunkZeroRefusal = Extract<MergeOutcome, { merged: false }>;

/**
 * Merge chunk zero — the branch carrying the specification and the approved
 * breakdown — into the project's default branch, with no pull request
 * (ADR-0030 D2). Returns the refusal, or undefined when the branch is on the
 * default branch now. It writes nothing about a refusal: no run is failed and
 * no ticket is told. What a refusal means for the run, and what the ticket is
 * told, is the caller's to decide (40x).
 *
 * **`approval` is required, so no caller can merge without one** (PRD-05 R3:
 * only a named person's yes lets work reach a default branch with no pull
 * request). The runner takes it only from the run record's `approval` entry.
 * The check is the compiler's — a call without an approval does not build —
 * so nothing here reads it again.
 *
 * {@link attemptMerge} below takes no approval. Only this function may call
 * it.
 *
 * ✏ 2026-09-30: `mergeChunkZero`, the old daemon's form, which failed the
 * run and posted on the ticket, was deleted. Nothing called it.
 */
export async function tryMergeChunkZero(
  deps: ChunkZeroDeps,
  run: Run,
  project: TicketingProject,
  // Required and not read: see above. Named with an underscore only so a
  // reader does not look for where it is used.
  _approval: ChunkZeroApproval,
): Promise<ChunkZeroRefusal | undefined> {
  const branch = deps.store.get(run.id)?.branch;
  const outcome = await attemptMerge(deps, project, branch);
  if (!outcome.merged) return outcome;

  // `alreadyThere` is a success and is logged as the different thing it
  // is: a cycle retried after a merge that landed reaches here, and
  // reporting it as a fresh merge would hide a retry nobody knew about.
  deps.log(
    outcome.alreadyThere === true
      ? `merged ${run.id} — ${branch} was already on ${outcome.into}`
      : `merged ${run.id} — ${branch} into ${outcome.into}`,
  );
  return undefined;
}

/**
 * The merge itself, with a thrown git failure reduced to a refusal.
 *
 * Not exported: it takes no approval, so only {@link tryMergeChunkZero} may
 * call it.
 */
async function attemptMerge(
  deps: ChunkZeroDeps,
  project: TicketingProject,
  branch: string | undefined,
): Promise<MergeOutcome> {
  if (branch === undefined) {
    return { merged: false, reason: "the run holds no work branch" };
  }
  const merge =
    deps.mergeProbe ??
    ((target: TicketingProject, name: string, message: string) =>
      deps.adapter.mergeIntoDefault(target, name, message));
  try {
    return await merge(project, branch, mergeMessage(branch));
  } catch (error) {
    return { merged: false, reason: oneLine(error) };
  }
}

/**
 * Open one ticket per step of an approved breakdown, as children of the
 * initiative's own ticket, and turn that ticket into a map of them
 * ([ADR-0040](../../doc/adr/0040-one-step-is-one-ticket-and-doneness-is-a-fact-about-a-ticket.md)).
 *
 * **This is TypeScript and must never become an instruction in
 * `approvalRecordPrompt`.** Idempotence is the whole deliverable here, and
 * idempotence cannot be asserted about a prompt: a model told "create only
 * what is missing" is a hope, not a guard. Fourteen issues opened twice is
 * worse than fourteen never opened, and re-running is the ordinary case —
 * a retry, a redelivered comment, a daemon restarted mid-cycle.
 *
 * It answers rather than throws. A tracker that fell over on the seventh
 * create leaves six real tickets behind, and the next cycle opens the other
 * eight; taking the run down with it would turn a partial success into a
 * failed initiative.
 */
export async function openStepTickets(
  deps: ChunkZeroDeps,
  run: Run,
  project: TicketingProject,
): Promise<string | undefined> {
  const { adapter } = deps;
  const read = await readBreakdown(
    run.ticket,
    deps.breakdownSource ?? fromForgeDefaultBranch(adapter, project),
  );
  if (read.kind !== "ok") {
    return (
      `the approved breakdown at ${read.path} is ${read.kind}, so no step ` +
      "tickets could be opened"
    );
  }

  // Read before the forge is touched. A `Needs:` line that cannot be read is
  // refused rather than guessed: falling back to the chain would write
  // relations that contradict the order the person approved (R10).
  const order = orderOf(read.breakdown);
  if (order.kind === "unclear") {
    return (
      `the list of pieces at ${read.path} does not say clearly what each ` +
      `piece needs: ${order.reason}, so no step tickets were opened`
    );
  }
  const { needs } = order;

  try {
    // Before anything can be held, the label has to exist — a state nobody
    // created is a state nobody can be in, which is why `timone-wayfind`
    // creates its own on first use. **29c owns this, not 29d**; both slices
    // assuming the other did it shows up as a claim silently not applied.
    await adapter.ensureLabel(project, HELD_LABEL, HELD_LABEL_DESCRIPTION);
    await adapter.ensureLabel(project, MAP_LABEL, MAP_LABEL_DESCRIPTION);

    // The existing children are what makes a re-run free. They are matched
    // by title, and the title carries the chunk's number — so two chunks
    // that happen to be called the same thing are still two tickets, and a
    // child a human opened by hand matches nothing and is left alone.
    const existing = await adapter.listSteps(project, run.ticket);
    const byTitle = new Map(existing.map((step) => [step.title, step.number]));

    const opened: { number: number; chunk: Chunk }[] = [];
    for (const [index, chunk] of read.breakdown.chunks.entries()) {
      const title = stepTitle(index, chunk.title);
      let number = byTitle.get(title);

      if (number === undefined) {
        number = await adapter.createStep(project, run.ticket, {
          title,
          body: stepBody(chunk, run.ticket, read.path),
        });
      }
      opened.push({ number, chunk });
    }

    // Each step waits for the steps its piece directly needs, and no others:
    // the forge already makes a wait carry through (R10). Every step is
    // checked, not only the ones this run opened, because a run that stopped
    // between opening a ticket and writing its relations left it waiting for
    // nothing. Only what is missing is written, so a re-run writes nothing
    // twice, and a relation is never removed — one a person added by hand
    // stays. A step this run opened is in `existing` not at all, so it has
    // no relations yet.
    const blockedByOf = new Map(existing.map((step) => [step.number, step.blockedBy]));
    for (const [index, step] of opened.entries()) {
      const blockedBy = blockedByOf.get(step.number) ?? [];
      for (const need of needs[index] ?? []) {
        const waitsFor = opened[need - 1];
        if (
          waitsFor !== undefined &&
          !blockedBy.some((dependency) => isStepOf(project, dependency, waitsFor.number))
        ) {
          await adapter.blockStep(project, step.number, waitsFor.number);
        }
      }
    }

    await adapter.setTicketBody(
      project,
      run.ticket,
      initiativeMap(opened, order.words, read.path),
    );
    // Last, and only once the children exist: from here the daemon reads
    // this ticket as a map and never opens a run on it. Marking it before
    // its steps were opened would strand the initiative — a map with no
    // children is a ticket nothing will ever pick up.
    await adapter.applyLabel(project, run.ticket, MAP_LABEL);
    deps.log(`steps ${run.id} — ${read.breakdown.chunks.length} steps stand`);
    return undefined;
  } catch (error) {
    // The tickets already opened are real and stay — re-running opens only
    // what is missing, which is what 29c's idempotence is for. What must not
    // happen is this run carrying on as though the steps existed.
    return `could not open the step tickets: ${oneLine(error)}`;
  }
}

/**
 * Whether a dependency is issue `number` of this project's own repository.
 *
 * The number alone is not enough: `blockedBy` can hold issues of other
 * repositories, and their numbers collide with ours (see `dependencySchema`).
 * A step waiting for another repository's #13 is not waiting for our #13.
 * The dependency's URL is the only field that names its repository, so it is
 * compared with the issue URL this project's own #`number` has. Letter case
 * is ignored, because GitHub treats owner and repository names that way.
 */
function isStepOf(
  project: TicketingProject,
  dependency: Dependency,
  number: number,
): boolean {
  if (dependency.number !== number) return false;
  const own = `https://github.com/${repoSlug(project.repoUrl)}/issues/${number}`;
  return dependency.url.toLowerCase() === own.toLowerCase();
}

/** How a step ticket is titled: the chunk's number, then its name. */
function stepTitle(index: number, title: string): string {
  return `${index + 1}. ${title}`;
}

/**
 * What a step ticket says. Short, and every technical word is a link: a
 * ticket carries what is being done and what is needed, and the detail lives
 * in the committed artifact it points at (`process.md`, *Writing to the
 * human*).
 */
function stepBody(
  chunk: Chunk,
  initiative: number,
  breakdownPath: string,
): string {
  return [
    chunk.delivers,
    "",
    `Part of #${initiative}. The full list is in \`${breakdownPath}\`.`,
  ].join("\n");
}

/**
 * The initiative's ticket, rewritten as the map of its children.
 *
 * Each line is the step's **number**, which GitHub renders as a live link
 * carrying its title and whether it is closed — so the map shows how far the
 * work has got without anything having to keep a tally up to date.
 *
 * The order follows the list in the same words the list of pieces uses, so
 * the ticket says which steps are built at the same time. The numbers in it
 * are the pieces' numbers, which are the map's line numbers. A blank line
 * comes before it: a line right under a numbered item would be read as part
 * of that item.
 */
function initiativeMap(
  steps: { number: number; chunk: Chunk }[],
  orderWords: string,
  breakdownPath: string,
): string {
  return [
    "This is built in pieces. Each one is its own ticket below.",
    "",
    ...steps.map(
      (step, index) => `${index + 1}. #${step.number} — ${step.chunk.delivers}`,
    ),
    "",
    `Order: ${orderWords}`,
    "",
    `The list was approved in \`${breakdownPath}\`.`,
  ].join("\n");
}

function oneLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0];
}
