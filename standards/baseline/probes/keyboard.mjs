#!/usr/bin/env node
/**
 * The keyboard-only pass. Every interactive element must be reachable by Tab
 * alone, and focus must be visible wherever it lands.
 *
 * Reachability is walked mechanically: Tab from the top of the document, and
 * record where `document.activeElement` lands after each press. Where focus
 * goes is a fact, not a judgement — which is the only reason this check can be
 * automated at all.
 *
 * Break step: take one visible control out of the tab order with
 * `tabindex="-1"`. It must come back as unreachable.
 */
import { args, onPage } from "./_shared.mjs";

/** Enough presses to cross a dense page, and a stop for a trap. */
const MAX_TABS = 400;

const options = args();

await onPage(options, async (page) => {
  const selector =
    "a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])";

  if (options.breaking) {
    const broke = await page.evaluate((sel) => {
      const first = [...document.querySelectorAll(sel)].find(
        (el) => !el.hasAttribute("disabled") && el.getClientRects().length > 0,
      );
      if (first === undefined) return undefined;
      first.setAttribute("tabindex", "-1");
      return first.tagName.toLowerCase();
    }, selector);
    console.log(`break step: took one <${broke}> out of the tab order`);
  }

  const expected = await page.evaluate((sel) => {
    const visible = [...document.querySelectorAll(sel)].filter(
      (el) => !el.hasAttribute("disabled") && el.getClientRects().length > 0,
    );
    // Stamp each one so the walk can name what it did and did not reach.
    visible.forEach((el, index) => el.setAttribute("data-timone-kb", String(index)));
    return visible.length;
  }, selector);

  await page.evaluate(() => document.body.focus());
  const reached = new Set();
  const outlines = [];
  for (let press = 0; press < MAX_TABS; press += 1) {
    await page.keyboard.press("Tab");
    const landed = await page.evaluate(() => {
      const el = document.activeElement;
      if (el === null || el === document.body) return undefined;
      const style = getComputedStyle(el);
      return {
        mark: el.getAttribute("data-timone-kb"),
        name: el.tagName.toLowerCase(),
        outline:
          style.outlineStyle !== "none" ||
          style.boxShadow !== "none" ||
          style.borderStyle !== "none",
      };
    });
    if (landed === undefined) continue;
    if (landed.mark !== null) reached.add(landed.mark);
    if (!landed.outline) outlines.push(`<${landed.name}> takes focus with nothing visible`);
    if (reached.size >= expected) break;
  }

  console.log(
    `=== keyboard on ${options.url} — ${reached.size} of ${expected} controls reached by Tab`,
  );

  const unreachable = await page.evaluate(
    (marks) =>
      [...document.querySelectorAll("[data-timone-kb]")]
        .filter((el) => !marks.includes(el.getAttribute("data-timone-kb")))
        .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 40)}"`),
    [...reached],
  );

  return [
    ...unreachable.map((what) => `not reachable by keyboard: ${what}`),
    ...new Set(outlines),
  ];
});
