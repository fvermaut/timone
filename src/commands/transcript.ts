import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Command } from "commander";

import { renderTranscript } from "../daemon/transcript.js";

/**
 * Read back what an agent did in a box.
 *
 * **Forensics is the whole point.** A boxed session's own transcript dies with
 * its container, so the daemon keeps every line on the host as it arrives.
 * This is how a person reads one afterwards — starting from the session id
 * that appears on a ticket comment, rather than from a path they have to
 * work out.
 */

/** Where the daemon keeps them. */
export function transcriptDir(root: string): string {
  return join(root, ".timone", "sessions");
}

/**
 * Render a saved transcript. `which` is a path, or a session id to look up in
 * `dir`.
 *
 * Throws naming what *is* there when the id is unknown — an operator with a
 * mistyped id wants the list, not a "not found".
 */
export function readTranscript(which: string, dir?: string): string {
  if (which.endsWith(".jsonl") && existsSync(which)) {
    return renderTranscript(readFileSync(which, "utf8"));
  }

  const from = dir ?? ".";
  const sessions = existsSync(from)
    ? readdirSync(from)
        .filter((name) => name.endsWith(".jsonl"))
        .map((name) => name.replace(/\.jsonl$/, ""))
    : [];

  if (sessions.length === 0) {
    throw new Error(
      `There are no transcripts in ${resolve(from)}. A boxed run writes one ` +
        "as it goes; a run that happened in-process has none, by design.",
    );
  }

  const hit = sessions.find((name) => name === which || name.startsWith(which));
  if (hit === undefined) {
    throw new Error(
      `No transcript for "${which}". These are the ones there: ${sessions.join(", ")}.`,
    );
  }
  return renderTranscript(readFileSync(join(from, `${hit}.jsonl`), "utf8"));
}

export function registerTranscriptCommand(program: Command): void {
  program
    .command("transcript")
    .description("read back what an agent did in a box")
    .argument(
      "<session>",
      "a session id, a prefix of one, or the path to a .jsonl transcript",
    )
    .option("--root <path>", "the timone root", process.cwd())
    .action((session: string, options: { root: string }) => {
      try {
        console.log(readTranscript(session, transcriptDir(options.root)));
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    });
}
