import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";

import { PIPELINE_STAGES, type PipelineStage } from "./pipeline.js";

/**
 * The step each session run by hand says it is running
 * ([#169](https://github.com/fvermaut/timone/issues/169)).
 *
 * The probe guard (ADR-0048 D4) learns a daemon session's step from the
 * ledger. A session run by hand has no run there, so until this file existed
 * the guard could not tell a checker from a builder and asked the person about
 * every call that named a probe. The checking step writes and runs probes all
 * pass long, so it stopped and asked every time.
 *
 * Keyed by session id, because that is the one thing the guard's hook payload
 * carries and the one thing the session start hook tells every session.
 */
const declarationsSchema = z.record(
  z.string(),
  z.object({
    stage: z.enum(PIPELINE_STAGES),
    /** When it was declared, so a person reading the file can tell old from new. */
    at: z.string().min(1),
  }),
);

type Declarations = z.infer<typeof declarationsSchema>;

/** Where the declarations live. The only place this path is spelled. */
export function declaredStagesPath(root: string): string {
  return join(root, ".timone", "declared-stages.json");
}

/**
 * Every declaration on disk. A missing file is an empty set — the state of
 * every root where nobody has declared anything yet. A file that cannot be
 * read or fails the schema answers undefined, and each caller decides what
 * that means for it.
 */
function load(path: string): Declarations | undefined {
  if (!existsSync(path)) return {};
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
  const parsed = declarationsSchema.safeParse(data);
  return parsed.success ? parsed.data : undefined;
}

/**
 * Write the declarations atomically: a temp file, then a rename over.
 *
 * **No state lock.** The lock guards the ledger, which has one writer
 * (ADR-0023); this file is not the ledger, the daemon never writes it, and the
 * guard only reads it. Taking the lock would also refuse this write whenever a
 * daemon is running, which is exactly when a person is likely to be working by
 * hand beside it. The rename means the guard never reads a half-written file.
 * The temp name is unique so two writers never rename each other's file away.
 *
 * What the rename does not stop: two sessions declaring in the same instant
 * both read, both write, and one declaration is lost. The lost session reads
 * as having no step, so the guard asks, which is the safe direction, and
 * declaring again fixes it.
 */
function save(path: string, declarations: Declarations): void {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temp, `${JSON.stringify(declarations, null, 2)}\n`, "utf8");
  renameSync(temp, path);
}

/**
 * Say that `sessionId` is running `stage`, replacing whatever it said before.
 *
 * A file that cannot be read is replaced rather than refused. Nothing in it
 * could be trusted anyway — the guard already reads it as no declaration for
 * anyone — and refusing would leave the person with no way to declare at all.
 */
export function declareStage(
  root: string,
  sessionId: string,
  stage: PipelineStage,
  now: () => string = () => new Date().toISOString(),
): void {
  const path = declaredStagesPath(root);
  const declarations = load(path) ?? {};
  declarations[sessionId] = { stage, at: now() };
  save(path, declarations);
}

/** Take back what `sessionId` declared. Clearing nothing is not an error. */
export function clearStage(root: string, sessionId: string): void {
  const path = declaredStagesPath(root);
  const declarations = load(path) ?? {};
  if (!(sessionId in declarations)) return;
  delete declarations[sessionId];
  save(path, declarations);
}

/**
 * The step `sessionId` declared, or undefined when it declared none.
 *
 * **Never throws.** The guard calls this in front of tool calls, and a guard
 * that throws blocks work in every session. An unreadable file means no
 * declaration, so the guard falls back to asking the person — the safe
 * direction, since asking can neither leak a probe to a builder nor hide one
 * from its owner.
 */
export function declaredStage(
  root: string,
  sessionId: string,
): PipelineStage | undefined {
  return load(declaredStagesPath(root))?.[sessionId]?.stage;
}
