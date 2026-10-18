// Verifier instrument (stage 7 artifact), written 2026-10-18 for phase 64's verification.
//
// One session at a timone root, seen only from outside: the SessionStart hook runs, the session
// commits a criteria register into a managed project and puts the commit on the remote, and the
// Stop hook runs. Returns what the Stop hook printed and its exit code. Written from the register
// (PRD-02.R15) and from what the built hooks were seen to print. No source and no test was read.
//
// Two kinds of session, as R15's clauses name them:
//   person — no run in the ledger and no declaration: the session commits on main.
//   run    — a run in the ledger for this session, on its work branch, which it commits to.
// The commit reaches the throwaway remote by a fetch run IN the remote, not by a push from the
// clone: a run's container refuses every push that is not to its own work branch, and this is a
// scratch repository (the same way _rig.mjs fills its remotes). The state left is the one a push
// leaves: the remote has the commit, and the clone's remote-tracking branch names it.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fixture } from './_rig.mjs';
import { hookCli, plantRun, BR } from './_steps.mjs';

const GID = ['-c', 'user.email=probe@example.invalid', '-c', 'user.name=probe'];

// files: { 'doc/specs/prd/<name>.criteria.md': text }. kind: 'person' | 'run'.
export function registerSession(cli, { files, kind = 'person', sid = `probe-r15-${kind}` }) {
  const fx = fixture({ cli });
  try {
    const clone = path.join(fx.dir, 'projects', 'fixture');
    const bare = path.join(fx.dir, 'remote', 'fixture.git');
    const G = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const branch = kind === 'run' ? BR : 'main';
    if (kind === 'run') plantRun(fx, sid, BR);
    const ev = (e) => ({ session_id: sid, transcript_path: '/dev/null', cwd: fx.dir, hook_event_name: e, stop_hook_active: false });
    hookCli(cli, 'baseline', fx, ev('SessionStart'));
    if (branch !== 'main') G(clone, 'checkout', '-q', '-b', branch);
    for (const [file, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(clone, file)), { recursive: true });
      fs.writeFileSync(path.join(clone, file), text);
    }
    G(clone, 'add', '-A');
    G(clone, ...GID, 'commit', '-q', '--allow-empty', '-m', `docs: verify phase 01 — probe\n\nTimone-Stage: verification\nTimone-Session: ${sid}`);
    G(bare, 'fetch', '-q', clone, `${branch}:${branch}`);
    G(clone, 'fetch', '-q', 'origin');
    if (branch !== 'main') G(clone, 'branch', '-q', '--set-upstream-to', `origin/${branch}`);
    const status = G(clone, 'status', '-sb').split('\n')[0];
    const r = hookCli(cli, 'check', fx, ev('Stop'));
    return { ...r, status };
  } finally {
    fx.cleanup();
  }
}

// The block of one requirement (`## Rk — …` up to the next `## R`) from a register file.
export function block(file, rk) {
  const text = fs.readFileSync(file, 'utf8');
  return text.split(/\n(?=## R\d+ )/).find((b) => b.startsWith(`## ${rk} `)) ?? null;
}

// The register's own wording is kept; `⚠️` starts each finding the Stop hook prints.
export const findings = (out) => out.split('⚠️').slice(1);

// The base of timone/250: the build just before phase 64, for break legs (_old-build.mjs).
export const BEFORE_PHASE_64 = 'ba699d27a1a9afa7c5632520bac21de9ac5427ee';
