// Shared helpers for verifier-authored probes.
// Stage 7 artifact. Written from the criteria register alone; no source was read.
import { execFileSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const PROBE_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(PROBE_DIR, '..', '..', '..', '..');
export const CLI = path.join(REPO_ROOT, 'dist', 'cli.js');

export function sh(cmd, cwd) {
  return execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
}

// Run the built CLI and capture everything a terminal would see.
export function cli(args, cwd) {
  try {
    const out = execFileSync(process.execPath, [CLI, ...args], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out: out.toString(), err: '' };
  } catch (e) {
    return {
      code: e.status ?? 1,
      out: (e.stdout ?? '').toString(),
      err: (e.stderr ?? '').toString(),
    };
  }
}

// A clause runs twice: broken input must go red, correct input must go green.
// Green alone is never evidence (process.md, stage 7).
//
// ✏ 2026-10-02 (phase 42 verification, ADR-0061 D1): with PROBE_REAL_ONLY=1 the
// broken leg is not run and the clause does its real run only. run.mjs sets it,
// because the one command does real runs only; a probe owed a break run is run
// on its own, without it.
export const REAL_ONLY = process.env.PROBE_REAL_ONLY === '1';
const results = [];

export function clause(id, wording, { broken, correct }) {
  let redOk = false;
  let redDetail = '';
  if (REAL_ONLY) {
    redDetail = 'real run only (PROBE_REAL_ONLY=1)';
  } else {
    try {
      broken();
      redDetail = 'the assertion still held on broken input';
    } catch (e) {
      redOk = true;
      redDetail = e.message;
    }
  }

  let greenOk = false;
  let greenDetail = '';
  try {
    correct();
    greenOk = true;
    greenDetail = 'assertion held';
  } catch (e) {
    greenDetail = e.message;
  }

  const verdict = REAL_ONLY ? (greenOk ? 'PASS' : 'FAIL') : !redOk ? 'INSTRUMENT-BROKEN' : greenOk ? 'PASS' : 'FAIL';
  console.log(`=== ${id} — ${wording}`);
  console.log(`    break leg: ${REAL_ONLY ? 'not run' : redOk ? 'RED (as required)' : 'GREEN — instrument broken'} — ${redDetail}`);
  console.log(`    green leg: ${greenOk ? 'PASS' : 'FAIL'} — ${greenDetail}`);
  results.push({ id, verdict });
  return verdict;
}

export function assert(cond, message) {
  if (!cond) throw new Error(message);
}

export function finish(criterionId) {
  const bad = results.filter((r) => r.verdict !== 'PASS');
  const verdict = bad.length === 0 ? 'PASS' : bad.some((r) => r.verdict === 'INSTRUMENT-BROKEN') ? 'INSTRUMENT-BROKEN' : 'FAIL';
  console.log(`--- ${criterionId}: ${verdict} (${results.length} clause labels, ${results.length - bad.length} passing${REAL_ONLY ? ', real run only' : ''})`);
  process.exit(verdict === 'PASS' ? 0 : 1);
}
