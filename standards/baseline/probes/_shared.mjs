/**
 * What every baseline probe needs: argument parsing, a browser, and the
 * two-leg contract.
 *
 * Playwright and axe are resolved from the *project's* node_modules rather
 * than installed here. Timone is not a web project and should not grow a
 * browser toolchain to check other people's pages; every managed project that
 * has a browser channel already has both.
 */
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export function args(argv = process.argv.slice(2)) {
  const read = (flag) => {
    const at = argv.indexOf(flag);
    return at === -1 ? undefined : argv[at + 1];
  };
  const url = read("--url");
  const modules = read("--modules");
  if (url === undefined || modules === undefined) {
    console.error(
      "usage: <probe> --url <page url> --modules <path to the project's node_modules> [--break]",
    );
    process.exit(2);
  }
  return { url, modules: resolve(modules), breaking: argv.includes("--break") };
}

/**
 * Import a package out of the project's own install.
 *
 * Both packages here are CommonJS, so what `import()` hands back is a module
 * namespace whose `default` is the real export object. Reading through it is
 * not optional: the named keys are absent, and forgetting that is how the
 * first run of these probes died on `chromium` being undefined.
 */
export async function fromProject(modules, specifier) {
  const loaded = await import(pathToFileURL(resolve(modules, specifier)).href);
  return loaded.default ?? loaded;
}

/**
 * Open the page, hand it to the probe, and turn its findings into an exit
 * code. Findings are always printed in full: a probe that reported only its
 * first finding would send a verifier round the loop once per fault.
 */
export async function onPage({ url, modules }, probe) {
  const { chromium } = await fromProject(modules, "playwright/index.js");
  const browser = await chromium.launch();
  try {
    // An explicit context, not `browser.newPage()`: axe refuses a page that
    // has no context of its own ("Please use browser.newContext()").
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle" });
    const findings = await probe(page);
    for (const finding of findings) console.log(`  ${finding}`);
    console.log(
      findings.length === 0
        ? "PASS — nothing found"
        : `FAIL — ${findings.length} finding(s)`,
    );
    process.exitCode = findings.length === 0 ? 0 : 1;
  } finally {
    await browser.close();
  }
}
