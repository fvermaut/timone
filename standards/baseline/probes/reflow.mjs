#!/usr/bin/env node
/**
 * Reflow, per the baseline's visual rules: the page must lay out at 320 CSS px
 * with no horizontal scroll (WCAG 1.4.10), and text must not sit in
 * fixed-height containers that clip it when it grows (1.4.12).
 *
 * 320x256 is the viewport 1.4.10 is written against — 1280x1024 at 400% zoom.
 *
 * Break step: inject a block 900 px wide, which cannot fit and must be
 * reported as horizontal scroll.
 */
import { args, onPage } from "./_shared.mjs";

const VIEWPORT = { width: 320, height: 256 };

const options = args();

await onPage(options, async (page) => {
  await page.setViewportSize(VIEWPORT);
  // Re-settle after the resize: a responsive layout is not finished reflowing
  // at the moment the viewport changes.
  await page.waitForTimeout(300);

  if (options.breaking) {
    await page.evaluate(() => {
      const planted = document.createElement("div");
      planted.style.width = "900px";
      planted.style.height = "8px";
      planted.id = "timone-break-step";
      document.body.append(planted);
    });
    console.log("break step: injected a 900px-wide block");
    await page.waitForTimeout(150);
  }

  const findings = await page.evaluate(() => {
    const out = [];
    const doc = document.documentElement;

    if (doc.scrollWidth > doc.clientWidth + 1) {
      out.push(
        `the page scrolls horizontally at 320px: content is ${doc.scrollWidth}px wide in a ${doc.clientWidth}px viewport`,
      );
      // Name what actually overflows, so the finding is actionable rather than
      // a number the reader has to go hunting behind.
      for (const el of document.querySelectorAll("body *")) {
        const box = el.getBoundingClientRect();
        if (box.width > 0 && box.right > doc.clientWidth + 1) {
          out.push(
            `  overflows: <${el.tagName.toLowerCase()}${el.id === "" ? "" : `#${el.id}`}> reaches ${Math.round(box.right)}px`,
          );
          if (out.length > 12) break;
        }
      }
    }

    for (const el of document.querySelectorAll("body *")) {
      const style = getComputedStyle(el);
      const text = (el.textContent ?? "").trim();
      if (text === "" || el.children.length > 0) continue;
      const fixed = style.height !== "auto" && /^\d+(\.\d+)?px$/.test(style.height);
      if (fixed && el.scrollHeight > el.clientHeight + 1) {
        out.push(
          `text is clipped by a fixed height: <${el.tagName.toLowerCase()}> is ${style.height} but its text needs ${el.scrollHeight}px`,
        );
      }
    }
    return out;
  });

  console.log(`=== reflow on ${options.url} at ${VIEWPORT.width}x${VIEWPORT.height}`);
  return findings;
});
