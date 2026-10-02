// Verifier instrument (stage 7 artifact), written 2026-10-02 for phase 41's verification.
//
// Builds an older commit of this repository, outside the tree, and returns its dist/cli.js.
// A break leg uses it when the thing a probe exists to catch is something a phase removed:
// the older build is where that thing still exists, so a probe aimed at it must go red there.
//
// The commit is exported with `git archive` into a cache folder under the system's temporary
// folder, compiled with this tree's own TypeScript and node_modules (a link, not a copy), and
// reused by later runs. Nothing in the repository or its git metadata is changed. No source is
// read: it is compiled and run, as the current build is.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, execSync } from 'node:child_process';
import { REPO_ROOT } from './_lib.mjs';

// main just before phase 41 (the merge-base of timone/166): the old code between steps is
// still there, a project with no `driver` line runs on it, and `timone retry` exists.
export const BEFORE_PHASE_41 = '5088b7e8c2be50d475533affe040954e901838ac';

export function oldBuild(sha = BEFORE_PHASE_41) {
  const base = path.join(os.tmpdir(), 'timone-probe-builds');
  const dir = path.join(base, sha);
  const cli = path.join(dir, 'dist', 'cli.js');
  if (fs.existsSync(path.join(dir, '.built'))) return cli;
  fs.mkdirSync(base, { recursive: true });
  // Built in a private folder, then moved into place, so probes running in parallel never see half a build.
  const work = fs.mkdtempSync(path.join(base, `${sha.slice(0, 7)}-`));
  try {
    execSync(`git -C "${REPO_ROOT}" archive ${sha} | tar -x -C "${work}"`, { stdio: ['ignore', 'pipe', 'pipe'] });
    fs.symlinkSync(path.join(REPO_ROOT, 'node_modules'), path.join(work, 'node_modules'));
    execFileSync(process.execPath, [path.join(REPO_ROOT, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', work], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 5 * 60 * 1000 });
    fs.writeFileSync(path.join(work, '.built'), sha);
    try { fs.renameSync(work, dir); } catch { /* another probe finished first */ }
  } finally {
    if (fs.existsSync(work)) fs.rmSync(work, { recursive: true, force: true });
  }
  if (!fs.existsSync(path.join(dir, '.built'))) throw new Error(`could not build ${sha} into ${dir}`);
  return cli;
}
