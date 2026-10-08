// Verifier instrument (stage 7 artifact), written 2026-10-08 for phase 57's verification.
//
// Runs the probe guard as the hook runs it, for PRD-10.R2, R3 and R6: the built command
// `node <cli> guardrails guard --root <root> --state <state>`, a hook payload on stdin, and the
// environment of the session set on the command line. Written from PRD-10's register alone: its
// definitions of "the guard", "refuses / allows / asks / is silent", "a container session" (its
// environment carries TIMONE_RUN_PROJECT) and "a person's session" (it carries neither that nor the
// container's step). The container's step is TIMONE_RUN_STAGE, the name R1's hint gives it and the
// completion report says was used. No source was read.
//
// A person's session has both names REMOVED from its environment, not set empty: the register says
// it "carries neither".
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, execFile } from 'node:child_process';
import { CLI, REPO_ROOT } from './_lib.mjs';

export const { PROBE_DIRECTORIES } = await import(path.join(REPO_ROOT, 'dist', 'daemon', 'probeGuard.js'));
export const { PIPELINE_STAGES } = await import(path.join(REPO_ROOT, 'dist', 'daemon', 'pipeline.js'));
export const [P, S] = PROBE_DIRECTORIES;

const now = new Date().toISOString();
const runOf = (sessionId, stage) => ({ id: 'fixture#12/1', project: 'fixture', ticket: 12, seq: 1, status: 'active', stage, branch: 'timone/12-x', sessionId, flags: [], createdAt: now, updatedAt: now });

const ROOTS = [];
process.on('exit', () => { for (const d of ROOTS) fs.rmSync(d, { recursive: true, force: true }); });

// A fresh timone root. ledger: null for an empty ledger, or { sid, stage } for one run.
export function root({ ledger = null } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-guard-step-'));
  fs.mkdirSync(path.join(dir, '.timone'));
  const state = path.join(dir, 'state.json');
  fs.writeFileSync(state, JSON.stringify({ version: 1, runs: ledger ? [runOf(ledger.sid, ledger.stage)] : [] }));
  ROOTS.push(dir);
  return { dir, state };
}

// The environment of a session. box: false for a person's session. step: undefined leaves the
// container's step out (a "missing" step); '' sets it empty.
export function sessionEnv({ box, step } = {}) {
  const env = { ...process.env };
  for (const k of ['TIMONE_RUN_PROJECT', 'TIMONE_RUN_BRANCH', 'TIMONE_RUN_STAGE']) delete env[k];
  if (box) {
    env.TIMONE_RUN_PROJECT = 'fixture';
    env.TIMONE_RUN_BRANCH = 'timone/12-x';
    if (step !== undefined) env.TIMONE_RUN_STAGE = step;
  }
  return env;
}

// Declares, with the built `timone stage` command run as a person on the host, that `sid` runs `stage`.
export function declare(r, sid, stage, cli = CLI) {
  return execFileSync(process.execPath, [cli, 'stage', stage, '--session', sid, '--root', r.dir], { encoding: 'utf8', env: sessionEnv({ box: false }), stdio: ['ignore', 'pipe', 'pipe'] });
}

// The guard's answer: { decision: 'deny' | 'allow' | 'ask' | 'silent', reason }.
export function guard(r, { sid = 'sess-1', box, step, tool, input, cli = CLI }) {
  const payload = { session_id: sid, hook_event_name: 'PreToolUse', cwd: r.dir, tool_name: tool, tool_input: input };
  const out = execFileSync(process.execPath, [cli, 'guardrails', 'guard', '--root', r.dir, '--state', r.state], { input: JSON.stringify(payload), encoding: 'utf8', env: sessionEnv({ box, step }), stdio: ['pipe', 'pipe', 'pipe'] });
  if (!out.trim()) return { decision: 'silent', reason: '' };
  const h = JSON.parse(out)?.hookSpecificOutput ?? {};
  if (!['deny', 'allow', 'ask'].includes(h.permissionDecision)) throw new Error(`the guard printed something that is no decision: ${out.slice(0, 200)}`);
  return { decision: h.permissionDecision, reason: h.permissionDecisionReason ?? '' };
}

// The same, without waiting: for a probe that makes many judgements, run `limit` at a time.
function guardAsync(r, { sid = 'sess-1', box, step, tool, input, cli = CLI }) {
  const payload = { session_id: sid, hook_event_name: 'PreToolUse', cwd: r.dir, tool_name: tool, tool_input: input };
  return new Promise((resolve, reject) => {
    const child = execFile(process.execPath, [cli, 'guardrails', 'guard', '--root', r.dir, '--state', r.state], { encoding: 'utf8', env: sessionEnv({ box, step }) }, (err, out) => {
      if (err) return reject(err);
      if (!out.trim()) return resolve({ decision: 'silent', reason: '' });
      const h = JSON.parse(out)?.hookSpecificOutput ?? {};
      if (!['deny', 'allow', 'ask'].includes(h.permissionDecision)) return reject(new Error(`the guard printed something that is no decision: ${out.slice(0, 200)}`));
      resolve({ decision: h.permissionDecision, reason: h.permissionDecisionReason ?? '' });
    });
    child.stdin.end(JSON.stringify(payload));
  });
}
export async function guardMany(jobs, limit = 10) {
  const out = new Array(jobs.length);
  let next = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (next < jobs.length) { const i = next++; out[i] = await guardAsync(jobs[i].r, jobs[i]); }
  }));
  return out;
}

// The calls the register names, for each of the two folders, written relative and in full.
export const forms = (F) => [F, path.join(REPO_ROOT, F)];
export const readOf = (F) => ['Read', { file_path: `${F}/prd-10.r1.mjs` }];
export const writeOf = (F) => ['Write', { file_path: `${F}/prd-10.r1.mjs`, content: '// probe\n' }];
export const runCall = (F) => ['Bash', { command: `node ${F}/prd-10.r1.mjs`, description: 'run a probe' }];
export const ALL_FORMS = [...forms(P), ...forms(S)];

const show = (tool, input) => `${tool} ${JSON.stringify(input).slice(0, 90)}`;

// Judge each [label, opts] and require `want`. Throws listing every wrong one; returns the answers.
export function expect(r, cases, want) {
  const wrong = [];
  const got = [];
  for (const c of cases) {
    const a = guard(r, c);
    got.push(a);
    if (a.decision !== want) wrong.push(`${c.label ?? ''} ${show(c.tool, c.input)} → ${a.decision}, wanted ${want}`);
  }
  if (wrong.length) throw new Error(`${wrong.length} of ${cases.length} judgements wrong: ${wrong.slice(0, 6).join(' | ')}${wrong.length > 6 ? ` … and ${wrong.length - 6} more` : ''}`);
  return got;
}
