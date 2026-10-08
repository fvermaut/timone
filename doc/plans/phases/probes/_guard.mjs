// Verifier instrument (stage 7 artifact), written 2026-10-08 for phase 56's verification.
//
// Runs the probe guard as the hook runs it: `node <cli> guardrails guard --root <root> --state <state>`,
// a hook payload on stdin, the environment set on the command line. Written from PRD-10's register
// alone: its definitions of "the guard", "refuses / allows / asks / is silent", "a container session"
// and "a person's session". No source was read.
//
// The folders come from PROBE_DIRECTORIES, read off the built module the register names, so a probe
// never depends on how they are spelled here.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { CLI, REPO_ROOT } from './_lib.mjs';

export const { PROBE_DIRECTORIES } = await import(path.join(REPO_ROOT, 'dist', 'daemon', 'probeGuard.js'));
export const [P, S] = PROBE_DIRECTORIES; // the project's folder, the shared one

// One root and one ledger for the whole probe: run B is a building step (execution), run C a
// checking step (verification). Any other session id has no run: a person's session.
export const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-guard-'));
fs.mkdirSync(path.join(ROOT, '.timone'));
const STATE = path.join(ROOT, 'state.json');
const now = new Date().toISOString();
const run = (sessionId, stage, ticket) => ({ id: `fixture#${ticket}/1`, project: 'fixture', ticket, seq: 1, status: 'active', stage, branch: `timone/${ticket}-x`, sessionId, flags: [], createdAt: now, updatedAt: now });
fs.writeFileSync(STATE, JSON.stringify({ version: 1, runs: [run('build-1', 'execution', 12), run('check-1', 'verification', 13)] }));
process.on('exit', () => fs.rmSync(ROOT, { recursive: true, force: true }));

// The kinds of session the register names. `box` sets TIMONE_RUN_PROJECT, as a container does.
export const SESSIONS = {
  'building, host': { sid: 'build-1', box: false },
  'building, container': { sid: 'build-1', box: true },
  'checking, host': { sid: 'check-1', box: false },
  'checking, container': { sid: 'check-1', box: true },
  "person's": { sid: 'person-1', box: false },
};

// The guard's answer: 'deny' | 'allow' | 'ask' | 'silent'. Anything else throws.
export function judge(session, tool, input, cli = CLI) {
  const { sid, box } = SESSIONS[session];
  const env = { ...process.env, TIMONE_RUN_PROJECT: box ? 'fixture' : '', TIMONE_RUN_BRANCH: box ? `timone/${sid === 'build-1' ? 12 : 13}-x` : '' };
  const payload = { session_id: sid, hook_event_name: 'PreToolUse', cwd: ROOT, tool_name: tool, tool_input: input };
  const out = execFileSync(process.execPath, [cli, 'guardrails', 'guard', '--root', ROOT, '--state', STATE], { input: JSON.stringify(payload), encoding: 'utf8', env, stdio: ['pipe', 'pipe', 'pipe'] });
  if (!out.trim()) return 'silent';
  const d = JSON.parse(out)?.hookSpecificOutput?.permissionDecision;
  if (!['deny', 'allow', 'ask'].includes(d)) throw new Error(`the guard printed something that is no decision: ${out.slice(0, 200)}`);
  return d;
}

const show = (tool, input) => `${tool} ${JSON.stringify(input).replace(/\n/g, '\\n').slice(0, 110)}`;

// Every call, for every named session, must get `want` (a string, or a function of the session).
// Throws one error listing every call that did not, so a leg's detail names them all.
export function expectAll(calls, sessions, want, cli) {
  const wrong = [];
  let n = 0;
  for (const s of sessions) {
    const w = typeof want === 'function' ? want(s) : want;
    for (const [tool, input] of calls) {
      n++;
      const got = judge(s, tool, input, cli);
      if (got !== w) wrong.push(`${s}: ${show(tool, input)} → ${got}, wanted ${w}`);
    }
  }
  const LIMIT = Number(process.env.PROBE_LIST_LIMIT || 8);
  const listed = wrong.slice(0, LIMIT).concat(wrong.length > LIMIT ? [`… and ${wrong.length - LIMIT} more`] : []);
  if (wrong.length) throw new Error(`${wrong.length} of ${n} judgements wrong:\n      - ${listed.join('\n      - ')}`);
  return n;
}
