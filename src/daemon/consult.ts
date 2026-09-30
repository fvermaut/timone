import { query, type Options, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";

import type { AskCheckDeps } from "./ask-check.js";

/**
 * The model the ask check consults, and the cheapest one that can do the job
 * ([ADR-0054](../../doc/adr/0054-an-ask-check-stands-in-front-of-every-question-put-to-a-person.md)).
 *
 * **The work is small on purpose.** Read one message, decide whether it is
 * more expensive than the matter it is about, and if so write two sentences.
 * The judgement was never the scarce thing — ADR-0033 recorded five sessions
 * at the most expensive setting the pipeline has, every one of which reached
 * the right conclusion. Spending that again to notice a misspelling would be
 * the same mistake wearing a fix.
 */
export const ASK_CHECK_MODEL = "claude-haiku-4-5-20251001";

/** How long the check may take before the composed message goes instead. */
export const ASK_CHECK_TIMEOUT_MS = 30_000;

/**
 * The SDK's `query`, or a test's stand-in that sees the options it is given.
 * Only the part of it this file uses: one prompt in, the messages out.
 */
export type ConsultQuery = (params: {
  prompt: string;
  options: Options;
}) => AsyncIterable<SDKMessage>;

/**
 * Put a question to a model, with no tools and one turn.
 *
 * **It never throws and it never hangs.** Both are contractual: this runs
 * inside the cycle that keeps every ticket's call to action current, so a
 * consult that threw would take down the reconciliation of every other ticket
 * in the listing, and one that hung would stop the loop. Every failure comes
 * back as `undefined`, which the check reads as *post the message as it was
 * composed*.
 */
export function sdkConsult(
  options: { model?: string; timeoutMs?: number; query?: ConsultQuery } = {},
): AskCheckDeps["consult"] {
  const model = options.model ?? ASK_CHECK_MODEL;
  const timeoutMs = options.timeoutMs ?? ASK_CHECK_TIMEOUT_MS;
  const ask = options.query ?? query;

  return async (prompt: string): Promise<string | undefined> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const session = ask({
        prompt,
        options: {
          abortController: controller,
          model,
          // It reads a string and writes a string. Anything it could reach
          // would be something it could act on, and acting is the one thing
          // this is not allowed to do (ADR-0054 D2).
          //
          // ✏ `tools: []` is what takes the built-in tools away (40u).
          // `allowedTools` only lists the tools that need no permission, so
          // an empty one took nothing away: the check was started with every
          // built-in tool — the shell, file writes, the web — in the
          // daemon's folder, and handed a named person's words to judge.
          tools: [],
          allowedTools: [],
          // And none of the settings on disk: left out, every source is
          // loaded — the project's CLAUDE.md, its hooks, its tool servers.
          // A question with one answer needs none of them.
          settingSources: [],
          permissionMode: "default",
        },
      });

      let said = "";
      for await (const message of session) {
        if (message.type !== "assistant") continue;
        for (const block of message.message.content) {
          if (block.type === "text") said += block.text;
        }
      }

      return said.trim() === "" ? undefined : said;
    } catch {
      return undefined;
    } finally {
      clearTimeout(timer);
    }
  };
}
