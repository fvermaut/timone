#!/usr/bin/env node
/**
 * The automated accessibility scan the baseline makes unconditional for every
 * user-facing deliverable: axe over the WCAG 2.0/2.1 A and AA rule sets.
 * Violations are failures. No suppression is configured, so no suppression can
 * hide anything.
 *
 * Break step: plant an `<img>` with no alt text. `image-alt` is a rule axe
 * always carries and never needs configuration for, so a scan that misses it
 * is a scan that is not running.
 */
import { args, fromProject, onPage } from "./_shared.mjs";

const options = args();

await onPage(options, async (page) => {
  if (options.breaking) {
    await page.evaluate(() => {
      const planted = document.createElement("img");
      planted.src =
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
      planted.id = "timone-break-step";
      document.body.prepend(planted);
    });
    console.log("break step: planted an <img> with no alt text");
  }

  const { AxeBuilder } = await fromProject(
    options.modules,
    "@axe-core/playwright/dist/index.js",
  );
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  console.log(`=== axe on ${options.url} — ${results.passes.length} checks passed`);
  return results.violations.flatMap((violation) =>
    violation.nodes.map(
      (node) =>
        `${violation.id} [${violation.impact}] ${node.target.join(" ")} — ${violation.help}`,
    ),
  );
});
