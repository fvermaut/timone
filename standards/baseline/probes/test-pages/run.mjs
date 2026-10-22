#!/usr/bin/env node
/**
 * Run the keyboard and reflow probes against the test pages here, and check
 * each run ends the way it must: green on a sound page, red on a broken one,
 * and red on a sound page when the probe plants its own fault (`--break`).
 *
 *   node standards/baseline/probes/test-pages/run.mjs --modules <node_modules with playwright>
 *
 * The pages are opened from disk (file://), so nothing needs serving.
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const at = process.argv.indexOf("--modules");
if (at === -1) {
  console.error("usage: run.mjs --modules <path to a node_modules holding playwright>");
  process.exit(2);
}
const modules = resolve(process.argv[at + 1]);

const runs = [
  ["keyboard", "keyboard-547-sound.html", false, 0],
  ["keyboard", "keyboard-547-sound.html", true, 1],
  ["keyboard", "keyboard-547-broken.html", false, 1],
  ["keyboard", "keyboard-trap-broken.html", false, 1],
  ["reflow", "reflow-sr-only-sound.html", false, 0],
  ["reflow", "reflow-sr-only-sound.html", true, 1],
  ["reflow", "reflow-clipped-broken.html", false, 1],
];

let wrong = 0;
for (const [probe, page, breaking, want] of runs) {
  const url = pathToFileURL(resolve(here, page)).href;
  const argv = [resolve(here, "..", `${probe}.mjs`), "--url", url, "--modules", modules];
  if (breaking) argv.push("--break");
  const run = spawnSync(process.execPath, argv, { encoding: "utf8" });
  const got = run.status;
  const ok = got === want;
  if (!ok) wrong += 1;
  console.log(
    `${ok ? "ok  " : "WRONG"} ${probe} on ${page}${breaking ? " --break" : ""}: exit ${got}, must be ${want}`,
  );
  for (const line of `${run.stdout}${run.stderr}`.trim().split("\n")) console.log(`      ${line}`);
}
console.log(wrong === 0 ? "every run ended as it must" : `${wrong} run(s) ended wrongly`);
process.exitCode = wrong === 0 ? 0 : 1;
