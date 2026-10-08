// Probe for PRD-10.R1 — A container carries the name of its step.
// Stage 7 artifact, authored 2026-10-08 (phase 57 verification) from the register alone.
//
// Register clauses (verbatim):
//   1. GIVEN the runner starts a step `S` of a run in a container
//      WHEN the container's environment is built
//      THEN it holds the name `S`, spelled as the ledger records the run's stage
//   2. GIVEN the daemon starts a session for a run in a container in any other way it does today
//      WHEN the container's environment is built
//      THEN it holds the name of that session's step, spelled as the ledger records it
//   3. GIVEN a project's environment file under `.timone/env/` holds a line that sets the variable that
//      carries the step
//      WHEN the file is read for a run
//      THEN it is refused, and the refusal names the variable, as for the other names the container
//      sets for itself
//
// How it observes. The BUILT daemon runs in container mode (--runtime container) in a throwaway root
// (_rig.mjs's fixture), with a stand-in `docker` first on PATH. The stand-in starts nothing: it writes
// down its arguments, its own environment and the ledger as it stands at that moment, and for `docker
// run` answers as a finished session would (one init line and one result line). The container's
// environment is then worked out as docker builds it: each `-e NAME` takes NAME's value from docker's
// own environment, each `-e NAME=value` the value, each `--env-file` its lines. The variable that
// carries the step is TIMONE_RUN_STAGE, the name R1's hint gives and the completion report says was used.
//
// One run is walked through: the runner starts `requirements`; a person approves the requirements and
// the runner records the approval (a session of its own, started another way: clause 2); then the
// runner starts `execution` (after the planner lets it build) and then `verification`. Every container
// started is checked; the stand-in also shows whether any other session (the planner) starts one.
//
// Break legs: the same walk on the build before phase 57 (c718880), which gives a container no step and
// does not refuse the variable in a project's environment file.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fixture, model, act, say, sleep, clause, assert, finish, OPERATOR, REAL_ONLY, CLI } from './_rig.mjs';
import { oldBuild } from './_old-build.mjs';

const BEFORE_PHASE_57 = 'c718880c2b9a1901c0b4e46df6c02b380333f235';
const N = 12;
const VAR = 'TIMONE_RUN_STAGE';
const G = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const memo = (f) => { let p; return () => (p ??= f()); };

const INIT = JSON.stringify({ type: 'system', subtype: 'init', session_id: 'box-session', tools: [], model: 'probe' });
const RESULT = JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'done', session_id: 'box-session', total_cost_usd: 0, num_turns: 1, duration_ms: 5, usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }, modelUsage: { probe: { inputTokens: 1, outputTokens: 1, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, costUSD: 0 } }, permission_denials: [] });

// A container root as _steps.mjs's boxScript() makes one, with the recording docker described above.
function boxFixture(cli, envFile) {
  const fx = fixture({ issues: { fixture: { [N]: {} } }, cli, timoneRepo: true });
  fs.symlinkSync(path.dirname(fx.cliPath), path.join(fx.dir, 'dist'));
  G(fx.dir, 'remote', 'add', 'origin', 'https://github.com/probe-owner/timone.git');
  G(path.join(fx.dir, 'remote', 'timone.git'), 'fetch', '-q', fx.dir, '+HEAD:refs/heads/main');
  G(fx.dir, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  fs.writeFileSync(path.join(fx.dir, 'bin', 'git'), `#!/bin/bash
case "$*" in *"remote get-url origin") exec /usr/bin/git "\${@:1:$#-3}" config --get remote.origin.url;; esac
exec /usr/bin/git -c url.${fx.dir}/remote/fixture.git.insteadOf=https://github.com/probe-owner/fixture.git -c url.${fx.dir}/remote/timone.git.insteadOf=https://github.com/probe-owner/timone.git "$@"
`);
  if (envFile) {
    fs.mkdirSync(path.join(fx.dir, '.timone', 'env'), { recursive: true });
    fs.writeFileSync(path.join(fx.dir, '.timone', 'env', 'fixture.env'), envFile.join('\n') + '\n');
  }
  const log = path.join(fx.dir, 'docker.jsonl');
  fs.writeFileSync(path.join(fx.dir, 'bin', 'docker'), `#!${process.execPath}
const fs = require('fs');
const a = process.argv.slice(2);
let ledger = null;
try { ledger = JSON.parse(fs.readFileSync(${JSON.stringify(fx.statePath)}, 'utf8')); } catch {}
const files = {};
for (let i = 0; i < a.length; i++) if (a[i] === '--env-file') { try { files[a[i + 1]] = fs.readFileSync(a[i + 1], 'utf8'); } catch {} }
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({ argv: a, env: process.env, ledger, files }) + '\\n');
if (a[0] !== 'run') process.exit(0);
const done = () => { process.stdout.write(${JSON.stringify(INIT + '\n' + RESULT + '\n')}); process.exit(0); };
if (a.includes('-i')) { let b = ''; process.stdin.on('data', (d) => { b += d; if (b.includes('\\n')) done(); }); process.stdin.on('end', done); } else done();
`);
  fs.chmodSync(path.join(fx.dir, 'bin', 'docker'), 0o755);
  fx.dockerCalls = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
  return fx;
}

// The container's environment, as docker builds it from a recorded call.
function containerEnv(call) {
  const env = {};
  const a = call.argv;
  for (let i = 1; i < a.length; i++) {
    if (a[i] === '-e' || a[i] === '--env') {
      const v = a[++i];
      const k = v.split('=')[0];
      if (v.includes('=')) env[k] = v.slice(k.length + 1);
      else if (k in call.env) env[k] = call.env[k];
    } else if (a[i].startsWith('--env=')) {
      const v = a[i].slice(6), k = v.split('=')[0];
      if (v.includes('=')) env[k] = v.slice(k.length + 1); else if (k in call.env) env[k] = call.env[k];
    } else if (a[i] === '--env-file') {
      for (const line of (call.files[a[++i]] ?? '').split('\n')) {
        const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (m) env[m[1]] = m[2]; else if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(line.trim()) && line.trim() in call.env) env[line.trim()] = call.env[line.trim()];
      }
    }
  }
  return env;
}

async function daemonUntil(fx, m, steps) {
  const env = { ...fx.env(m.port), CLAUDE_CODE_OAUTH_TOKEN: 'sk-ant-oat01-probe-dummy' };
  delete env[VAR];
  const child = spawn(process.execPath, [fx.cliPath, 'daemon', '--manifest', fx.manifest, '--interval', '2', '--runtime', 'container', '--state', fx.statePath], { cwd: fx.dir, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  child.stderr.on('data', (d) => (out += d));
  const waitFor = async (cond, ms = 45000) => { const t = Date.now(); while (Date.now() - t < ms) { if (cond()) return true; await sleep(250); } return false; };
  try { await steps(waitFor); } finally {
    await sleep(1500);
    child.kill('SIGTERM');
    await sleep(1000);
    child.kill('SIGKILL');
    await m.stop();
  }
  return out;
}

const whyOf = (q) => q.brief.split('## The ticket')[0];
const ended = (fx, stage, n = 1) => fx.record(N).filter((e) => e.kind === 'step-ended' && e.stage === stage).length >= n;

// The whole walk. Returns every `docker run` with its container's environment and the ledger's stage.
async function walk(cli) {
  const fx = boxFixture(cli);
  const T = {};
  const m = await model({
    runner: (c) => {
      if (c.turn > 0) return say();
      const w = whyOf(c);
      if (w.includes('picked up')) return act('start_step', { stage: 'requirements', instructions: 'write it down', reason: 'probe', skipReason: 'probe: the request is clear' });
      if (w.includes('"approve the requirements"')) return act('record_approval', { what: 'requirements', commentAt: T.req, reason: 'probe' });
      if (w.includes('"now build it"')) return act('start_step', { stage: 'execution', instructions: 'build it', reason: 'probe', skipReason: 'probe: no plan in this fixture' });
      if (w.includes('"now check it"')) return act('start_step', { stage: 'verification', instructions: 'check it', reason: 'probe' });
      return say();
    },
  });
  const out = await daemonUntil(fx, m, async (waitFor) => {
    await waitFor(() => ended(fx, 'requirements'));
    await sleep(2500);
    fx.pushBranch(fx.run(N).branch, { 'doc/specs/prd/prd-01-count.md': '# PRD-01: A count of open to-dos\n\n> **Status:** Draft\n\nShow how many to-dos are open.\n' }, 'requirements');
    T.req = fx.comment(N, OPERATOR, 'approve the requirements');
    await waitFor(() => ended(fx, 'requirements', 2));
    await sleep(2500);
    fx.comment(N, OPERATOR, 'now build it');
    await waitFor(() => ended(fx, 'execution'));
    await sleep(2500);
    fx.comment(N, OPERATOR, 'now check it');
    await waitFor(() => ended(fx, 'verification'));
  });
  const runs = fx.dockerCalls().filter((c) => c.argv[0] === 'run').map((c) => {
    const env = containerEnv(c);
    const run = (c.ledger?.runs ?? []).filter((r) => r.ticket === N).at(-1);
    return { name: c.argv[c.argv.indexOf('--name') + 1], has: VAR in env, value: env[VAR], ledgerStage: run?.stage, prompt: 'TIMONE_PROMPT' in env, project: env.TIMONE_RUN_PROJECT };
  });
  const record = fx.record(N).map((e) => `${e.kind}${e.stage ? ` ${e.stage}` : ''}${e.action ? ` ${e.action}` : ''}${e.ok === false ? ' FAILED' : ''}${/Refused/.test(e.detail ?? '') ? ' REFUSED' : ''}`);
  fx.cleanup();
  return { runs, record, out };
}
const NEW_WALK = memo(() => walk(CLI));
const OLD_WALK = memo(() => walk(oldBuild(BEFORE_PHASE_57)));
const show = (r) => `${r.name}: ${VAR}=${r.has ? JSON.stringify(r.value) : '<not set>'}, ledger stage ${r.ledgerStage}`;

// Clause 1: the step sessions the runner starts (no TIMONE_PROMPT: they read the brief on stdin).
async function c1(w) {
  const { runs, record } = await w();
  const steps = runs.filter((r) => !r.prompt);
  const stages = steps.map((r) => r.value);
  for (const s of ['requirements', 'execution', 'verification']) assert(steps.some((r) => r.ledgerStage === s), `no container was started for the step ${s}; containers: ${runs.map(show).join('; ') || 'none'}; record: ${record.join(', ')}`);
  const wrong = steps.filter((r) => !r.has || r.value !== r.ledgerStage);
  assert(wrong.length === 0, `${wrong.length} of ${steps.length} step containers do not hold the ledger's stage: ${wrong.map(show).join('; ')}`);
  return steps;
}
await clause('R1 clause 1', 'the runner starts a step S in a container: the container holds S, spelled as the ledger records it', {
  broken: () => c1(OLD_WALK),
  correct: async () => { for (const r of await c1(NEW_WALK)) console.log(`    ${show(r)}`); },
});

// Clause 2: every other container the daemon started in the walk — the session that records the approval.
async function c2(w) {
  const { runs, record } = await w();
  const others = runs.filter((r) => r.prompt);
  assert(others.length >= 1, `no container was started for the approval; containers: ${runs.map(show).join('; ') || 'none'}; record: ${record.join(', ')}`);
  const wrong = others.filter((r) => !r.has || r.value !== r.ledgerStage);
  assert(wrong.length === 0, `${wrong.length} of ${others.length} other containers do not hold the ledger's stage: ${wrong.map(show).join('; ')}`);
  return { others, all: runs.length };
}
await clause('R1 clause 2', "a session started another way (recording an approval): its container holds that session's step, spelled as the ledger records it", {
  broken: () => c2(OLD_WALK),
  correct: async () => {
    const { others, all } = await c2(NEW_WALK);
    for (const r of others) console.log(`    ${show(r)} (the approval's session)`);
    console.log(`    ${all} containers started in the walk in all; no other kind of session started one`);
  },
});

// Clause 3: a project's environment file sets the variable. Compared with a name the container already
// sets for itself (TIMONE_RUN_PROJECT): the same kind of refusal, naming the variable.
async function envFileRun(cli, line) {
  const fx = boxFixture(cli, [line]);
  const m = await model({ runner: (c) => (c.turn > 0 ? say() : act('start_step', { stage: 'requirements', instructions: 'write it down', reason: 'probe', skipReason: 'probe: the request is clear' })) });
  await daemonUntil(fx, m, async (waitFor) => { await waitFor(() => fx.record(N).some((e) => e.kind === 'decision' && e.action === 'start_step')); });
  const decision = fx.record(N).find((e) => e.kind === 'decision' && e.action === 'start_step')?.detail ?? '';
  const started = fx.dockerCalls().some((c) => c.argv[0] === 'run');
  fx.cleanup();
  return { line, decision, started };
}
async function c3(cli) {
  const [mine, theirs] = await Promise.all([envFileRun(cli, `${VAR}=verification`), envFileRun(CLI, 'TIMONE_RUN_PROJECT=other')]);
  assert(/Refused/.test(theirs.decision) && !theirs.started, `instrument: a line setting TIMONE_RUN_PROJECT was not refused either: "${theirs.decision}"`);
  assert(!mine.started, `a container was started although the project's environment file sets ${VAR}; decision: "${mine.decision || '(none)'}"`);
  assert(/Refused/.test(mine.decision) && mine.decision.includes(VAR), `the refusal does not name ${VAR}: "${mine.decision}"`);
  const shape = (d) => d.replace(/TIMONE_RUN_PROJECT|TIMONE_RUN_STAGE/g, 'VAR').replace(/\S*\/\.timone\/env\//, '<root>/.timone/env/');
  return { mine, theirs, same: shape(mine.decision) === shape(theirs.decision) };
}
await clause('R1 clause 3', `a project's environment file that sets ${VAR} is refused, naming the variable, as for the container's other names`, {
  broken: () => c3(oldBuild(BEFORE_PHASE_57)),
  correct: async () => {
    const { mine, theirs, same } = await c3(CLI);
    console.log(`    ${mine.line}: no container started; "${mine.decision}"`);
    console.log(`    ${theirs.line}: no container started; "${theirs.decision}"`);
    console.log(`    the two refusals are ${same ? 'the same sentence, with only the name and the folder changed' : 'worded differently'}`);
  },
});

finish('PRD-10.R1');
