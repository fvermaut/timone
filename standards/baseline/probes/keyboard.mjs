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
 * How many presses: the page's own number of tab stops, plus a margin, and
 * the walk ends early once focus comes back round to where it started. A fixed
 * number of presses (it was 400) gives a false fault for every control past
 * it on a page with more controls than that (timone#127). `HARD_STOP` still
 * caps the walk, so a page that traps focus cannot keep it going forever.
 *
 * Break step: take one visible control out of the tab order with
 * `tabindex="-1"`. It must come back as unreachable.
 */
import { args, onPage } from "./_shared.mjs";

/** Presses allowed beyond the page's own count of tab stops. */
const MARGIN = 50;
/** The most presses any page gets, however many tab stops it has. */
const HARD_STOP = 10_000;

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

  // Every element the browser puts in the tab order, not only the ones the
  // selector names: a scrollable region or a `contenteditable` takes a press
  // too, and a budget that left them out would run short.
  const tabStops = await page.evaluate(
    () =>
      [...document.querySelectorAll("*")].filter(
        (el) => el.tabIndex >= 0 && el.getClientRects().length > 0,
      ).length,
  );
  const budget = Math.min(Math.max(tabStops, expected) * 2 + MARGIN, HARD_STOP);

  await page.evaluate(() => document.body.focus());
  const reached = new Set();
  const outlines = [];
  let presses = 0;
  let wrapped = false;
  while (presses < budget) {
    await page.keyboard.press("Tab");
    presses += 1;
    const landed = await page.evaluate(() => {
      const el = document.activeElement;
      if (el === null || el === document.body) return undefined;
      // The first element focus lands on is where the walk started; landing
      // there again means the walk has been all the way round.
      if (window.__timoneKbFirst === undefined) window.__timoneKbFirst = el;
      else if (window.__timoneKbFirst === el) return { back: true };
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
    if (landed.back) {
      wrapped = true;
      break;
    }
    if (landed.mark !== null) reached.add(landed.mark);
    if (!landed.outline) outlines.push(`<${landed.name}> takes focus with nothing visible`);
    if (reached.size >= expected) break;
  }

  const ended =
    reached.size >= expected
      ? "every control reached"
      : wrapped
        ? "focus came back to the first control"
        : `stopped at the limit of ${budget} presses`;
  console.log(
    `=== keyboard on ${options.url} — ${reached.size} of ${expected} controls reached by Tab (${presses} presses, ${tabStops} tab stops; ${ended})`,
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
