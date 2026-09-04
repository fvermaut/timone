import type { DaemonRecord } from "./runs.js";

/**
 * How much of a sha a message shows. Seven characters is what git itself
 * prints and what fvermaut will paste into `git show`.
 */
const SHORT_SHA = 7;

/**
 * What the daemon's process is running, and what the default branch has moved
 * to — the two halves of [timone#5](https://github.com/fvermaut/timone/issues/5).
 */
export interface DaemonVersion {
  /** The commit the daemon's process started on. */
  commit: string;
  /**
   * The default branch's tip. **Absent means the remote could not be asked**,
   * which is not the same as being up to date.
   */
  tip?: string;
}

/**
 * The one sentence to say when the daemon is running old code, or undefined
 * when there is nothing to say.
 *
 * Three ways to say nothing, and they are different states:
 *
 * - the tip is the commit the daemon started on — it is current;
 * - there is no tip — the remote could not be asked, and a check that said
 *   "up to date" when it could not look would be worse than one that said
 *   nothing at all;
 * - no daemon is running, which is {@link daemonRecordNotice}'s job.
 *
 * **The message is about the daemon's own process.** A daemon loads its code
 * at start-up and keeps it until somebody restarts it. A run does not have
 * this problem — it pins its own commit and refuses one the remote does not
 * carry (ADR-0041 D1) — so the message says which of the two it means, or an
 * operator restarts the wrong thing.
 */
export function daemonVersionNotice(version: DaemonVersion): string | undefined {
  const { commit, tip } = version;
  if (tip === undefined) return undefined;
  if (tip === commit) return undefined;

  return (
    `⚠ The daemon is running an old copy of Timone. Its process started on ` +
    `commit ${commit.slice(0, SHORT_SHA)}, and the default branch is now on ` +
    `${tip.slice(0, SHORT_SHA)}. Stop it and start it again to pick that up: ` +
    `node dist/cli.js daemon. Only the daemon's own process is behind — every ` +
    `job downloads the copy of Timone it was told to use.`
  );
}

/**
 * The same sentence for a reader of `timone status`, from what the last cycle
 * wrote down — or undefined when there is nothing to say.
 *
 * A record whose process has stopped never reaches this: {@link
 * RunStore.daemonVersion} answers undefined for one, because nobody is
 * running old code once there is no daemon.
 */
export function daemonRecordNotice(
  record: DaemonRecord | undefined,
): string | undefined {
  if (record === undefined) return undefined;
  return daemonVersionNotice({
    commit: record.commit,
    ...(record.tip === undefined ? {} : { tip: record.tip }),
  });
}
