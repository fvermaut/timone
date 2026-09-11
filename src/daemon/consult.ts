import { query } from "@anthropic-ai/claude-agent-sdk";

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
  options: { model?: string; timeoutMs?: number } = {},
): AskCheckDeps["consult"] {
  const model = options.model ?? ASK_CHECK_MODEL;
  const timeoutMs = options.timeoutMs ?? ASK_CHECK_TIMEOUT_MS;

  return async (prompt: string): Promise<string | undefined> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const session = query({
        prompt,
        options: {
          abortController: controller,
          model,
          // It reads a string and writes a string. Anything it could reach
          // would be something it could act on, and acting is the one thing
          // this is not allowed to do (ADR-0054 D2).
          allowedTools: [],
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
