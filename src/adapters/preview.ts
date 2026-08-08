import { z } from "zod";

/**
 * Where a preview stands, as the process reads it.
 *
 * `ready` is the only state carrying a URL, `failed` the only one carrying a
 * reason. `building` exists for an adapter that cannot answer synchronously —
 * a managed platform observes the push and mints the deployment itself, so
 * "not yet, ask again next cycle" is a real answer there. The Docker adapter
 * never returns it, because it waits for the stack itself.
 */
export const PREVIEW_STATES = ["ready", "building", "failed"] as const;

/**
 * What an adapter reports about one pull request's preview.
 *
 * Note what is absent: no container ids, no ports, no platform identifiers.
 * Everything about *how* belongs to the adapter ([ADR-0021](../../doc/adr/0021-previews-are-reconciled-behind-an-adapter-seam.md)),
 * and the URL is returned rather than derived, which is what lets a later
 * adapter change the addressing scheme without touching the poll loop.
 */
export const previewSchema = z.strictObject({
  state: z.enum(PREVIEW_STATES),
  /** Where to open it. Present exactly when the state is `ready`. */
  url: z.string().optional(),
  /**
   * Why it is not there, in words that go on a pull request. Present exactly
   * when the state is `failed`.
   */
  reason: z.string().optional(),
});

export type Preview = z.infer<typeof previewSchema>;

/**
 * The subset of a managed project a preview adapter needs: its manifest name
 * (which names the preview's containers and its worktree) and its path under
 * the timone root (which is where the source comes from).
 */
export interface PreviewProject {
  name: string;
  /** Manifest `path`, e.g. `projects/scratch-app`, relative to the root. */
  path: string;
}

/**
 * The seam between the process and whatever serves previews.
 *
 * **Two calls, and they are reconciliation rather than commands**
 * ([ADR-0021](../../doc/adr/0021-previews-are-reconciled-behind-an-adapter-seam.md)).
 * The shape is deliberate: an imperative `up` / `refresh` / `down` / `urlFor`
 * reads better while only one implementation exists and decays the moment a
 * second arrives, because a managed platform performs none of those verbs —
 * it observes the push and deploys by itself, leaving `teardown` a no-op and
 * `build` a wait. `ensure` and `release` are things both can honestly do.
 *
 * **Neither call may throw to signal a failed preview.** A pull request is
 * the deliverable and a preview is an aid to reviewing it, so a stack that
 * cannot come up is a value to report on the PR — never an exception that
 * wedges a poll cycle or parks a run.
 */
export interface PreviewAdapter {
  /**
   * Make it true that `pr`'s preview serves `headSha`, and say where it is.
   *
   * Called every cycle for every open Timone pull request on a bound project,
   * so it must be cheap when nothing has changed: an implementation that
   * rebuilt on each call would turn a poll loop into a rebuild loop.
   */
  ensure(
    project: PreviewProject,
    pr: number,
    headSha: string,
  ): Promise<Preview>;

  /**
   * Give up `pr`'s preview for good, leaving nothing behind on the host —
   * containers, their volumes, and whatever working copy was checked out for
   * them. Idempotent: releasing a preview that is already gone is a no-op,
   * because the cycle that observes a closed pull request is not necessarily
   * the first one to have done so.
   */
  release(project: PreviewProject, pr: number): Promise<void>;
}
