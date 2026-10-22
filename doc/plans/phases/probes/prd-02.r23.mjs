// Probe for PRD-02.R23 — A run is isolated from fvermaut's machine.
// Stage 7 artifact, authored 2026-10-22 (phase 66 verification, timone#73) from the register alone,
// and from the four points the runner's instructions for that pass named. No source was read.
//
// Register clause 1 (verbatim):
//   GIVEN a marked ticket on a managed project
//   WHEN the daemon spawns the session for it
//   THEN that session's work happens inside a container created for that run and destroyed when it
//   ends, whose content came from cloning timone and the target project from their git remotes, with
//   no path from fvermaut's filesystem mounted into it
//
// Phase 66 claims clause 1 on the words "created for that run and destroyed when it ends". The runner
// split that into four parts; they are labels (a) to (e) below, the refused start and the wait for the
// removal being two. (f) is the clause's last words (no host path mounted).
// Clauses 2–6 need a real daemon, a real forge and real containers; they are printed BLOCKED here.
//
// How it observes. The BUILT daemon runs in container mode (--runtime container) in a throwaway root
// (_rig.mjs's fixture), with a stand-in `docker` first on PATH. The stand-in starts nothing. It keeps a
// list of containers in a file, as docker does: `docker run --name N` adds N, and refuses with docker's
// own "Conflict. The container name "/N" is already in use" when N is on the list; `docker rm -f N`
// takes N off the list, after a delay the probe sets; `docker ps` lists them in the format asked for.
// Every call is written down with its time, its arguments and the daemon process that made it.
// A `docker run` either answers as a finished session would (one init line, one result line), or
// keeps running until its container is removed — what a box looks like while its session works.
//
// Break legs: the same scenes on the build of main before phase 66 (c5f0fc8), which names a box from a
// counter, does not wait for the removal, removes a name docker refused, leaves boxes on Ctrl-C and
// removes nothing when it starts. (f)'s break leg adds a host path mount to the recorded arguments.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fixture, model, act, say, sleep, clause, blocked, assert, finish, breakRunFor, CLI } from './_rig.mjs';
import { oldBuild } from './_old-build.mjs';

const BEFORE_PHASE_66 = 'c5f0fc875e5b3c79b34799e0a1971c6a9d1dd154';
const N = 12;
const G = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const memo = (f) => { let p; return () => (p ??= f()); };
const OLD = memo(() => oldBuild(BEFORE_PHASE_66));

const INIT = JSON.stringify({ type: 'system', subtype: 'init', session_id: 'box-session', tools: [], model: 'probe' });
const RESULT = JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'done', session_id: 'box-session', total_cost_usd: 0, num_turns: 1, duration_ms: 5, usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }, modelUsage: { probe: { inputTokens: 1, outputTokens: 1, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, costUSD: 0 } }, permission_denials: [] });

// The stand-in docker. Its behaviour is read from <root>/docker-mode.json at each call:
//   run: 'finish' | 'hang' | 'conflict'   rmDelayMs: how long `docker rm` takes
const STAND_IN = (dir, statePath) => `#!${process.execPath}
const fs = require('fs');
const path = require('path');
const dir = ${JSON.stringify(dir)};
const LOG = path.join(dir, 'docker.jsonl');
const LIST = path.join(dir, 'docker-containers.json');
const a = process.argv.slice(2);
const mode = (() => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'docker-mode.json'), 'utf8')); } catch { return {}; } })();
const log = (o) => fs.appendFileSync(LOG, JSON.stringify({ t: Date.now(), pid: process.pid, ppid: process.ppid, argv: a, ...o }) + '\\n');
const read = () => { try { return JSON.parse(fs.readFileSync(LIST, 'utf8')); } catch { return {}; } };
const write = (l) => { fs.writeFileSync(LIST + '.tmp', JSON.stringify(l, null, 1)); fs.renameSync(LIST + '.tmp', LIST); };
const record = () => { try { return fs.readFileSync(path.join(dir, '.timone', 'records', 'fixture', '${N}.jsonl'), 'utf8').split('\\n').filter(Boolean).map((l) => JSON.parse(l).kind); } catch { return []; } };
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
let cmd = a[0];
let args = a.slice(1);
if (cmd === 'container') { cmd = { ls: 'ps', list: 'ps', rm: 'rm', remove: 'rm', inspect: 'inspect' }[a[1]] ?? a[1]; args = a.slice(2); }
const VALUED = new Set(['--name', '--label', '-l', '-e', '--env', '--env-file', '--network', '--net', '-v', '--volume', '--mount', '-w', '--workdir', '--user', '-u', '--entrypoint', '--format', '-f', '--filter', '--memory', '--cpus', '--add-host', '--hostname', '-h', '--label-file', '--cidfile', '--pull', '--platform', '--stop-timeout', '--shm-size', '--ulimit', '--cap-add', '--cap-drop', '--security-opt', '--tmpfs', '--log-driver', '--log-opt', '--restart', '-p', '--publish', '--network-alias', '--ip', '--dns', '--pids-limit']);
if (cmd === 'run' || cmd === 'create') {
  let name = null; const labels = {}; let image = null;
  for (let i = 0; i < args.length; i++) {
    const x = args[i];
    if (x === '--name') name = args[++i];
    else if (x.startsWith('--name=')) name = x.slice(7);
    else if (x === '--label' || x === '-l') { const v = args[++i]; const k = v.split('=')[0]; labels[k] = v.slice(k.length + 1); }
    else if (x.startsWith('--label=')) { const v = x.slice(8); const k = v.split('=')[0]; labels[k] = v.slice(k.length + 1); }
    else if (VALUED.has(x)) i++;
    else if (x.startsWith('-')) continue;
    else { image = x; break; }
  }
  name ??= 'anon-' + process.pid;
  const l = read();
  if (mode.run === 'conflict' && !l[name]) { l[name] = { id: 'f00d' + process.pid, labels: { owner: 'another-run' }, image: 'someone-else', state: 'running' }; write(l); }
  if (l[name]) {
    log({ phase: 'refused', name });
    process.stderr.write('docker: Error response from daemon: Conflict. The container name "/' + name + '" is already in use by container "' + l[name].id + '". You have to remove (or rename) that container to be able to reuse that name.\\nSee \\'docker run --help\\'.\\n');
    process.exit(125);
  }
  l[name] = { id: 'c0' + process.pid.toString(16) + Date.now().toString(16), labels, image, state: 'running' };
  write(l);
  log({ phase: 'started', name, labels });
  if (mode.run === 'hang') {
    const until = Date.now() + 120000;
    const tick = () => { if (!read()[name]) { log({ phase: 'killed', name }); process.exit(137); } if (Date.now() > until) process.exit(0); setTimeout(tick, 100); };
    process.stdin.resume(); process.stdin.on('error', () => {});
    tick();
  } else {
    const done = () => { const l2 = read(); if (l2[name]) { l2[name].state = 'exited'; write(l2); } process.stdout.write(${JSON.stringify(INIT + '\n' + RESULT + '\n')}); log({ phase: 'finished', name }); process.exit(0); };
    if (args.includes('-i') || args.includes('--interactive')) { let b = ''; process.stdin.on('data', (d) => { b += d; if (b.includes('\\n')) done(); }); process.stdin.on('end', done); } else done();
  }
} else if (cmd === 'rm') {
  const names = args.filter((x) => !x.startsWith('-'));
  log({ phase: 'rm-start', names, record: record() });
  if (mode.rmDelayMs) sleepSync(mode.rmDelayMs);
  const l = read();
  let code = 0;
  for (const n of names) {
    const key = l[n] ? n : Object.keys(l).find((k) => l[k].id === n || l[k].id.startsWith(n));
    if (key) { delete l[key]; process.stdout.write(n + '\\n'); } else { process.stderr.write('Error response from daemon: No such container: ' + n + '\\n'); code = 1; }
  }
  write(l);
  log({ phase: 'rm-end', names, code, record: record() });
  process.exit(code);
} else if (cmd === 'ps') {
  let format = null; const filters = []; let quiet = false;
  for (let i = 0; i < args.length; i++) {
    const x = args[i];
    if (x === '--format') format = args[++i]; else if (x.startsWith('--format=')) format = x.slice(9);
    else if (x === '--filter' || x === '-f') filters.push(args[++i]); else if (x.startsWith('--filter=')) filters.push(x.slice(9));
    else if (x === '-q' || x === '--quiet') quiet = true;
    else if (x === '-aq' || x === '-qa') quiet = true;
  }
  const all = args.some((x) => x === '-a' || x === '--all' || x === '-aq' || x === '-qa');
  const l = read();
  let rows = Object.entries(l).map(([n, c]) => ({ Names: n, ID: c.id, Labels: c.labels ?? {}, Image: c.image ?? 'img', State: c.state, Status: c.state === 'running' ? 'Up 1 minute' : 'Exited (0) 1 minute ago' }));
  if (!all) rows = rows.filter((r) => r.State === 'running');
  for (const f of filters) {
    const k = f.split('=')[0]; const v = f.slice(k.length + 1);
    if (k === 'label') { const lk = v.split('=')[0]; const lv = v.includes('=') ? v.slice(lk.length + 1) : null; rows = rows.filter((r) => lk in r.Labels && (lv === null || r.Labels[lk] === lv)); }
    else if (k === 'name') rows = rows.filter((r) => r.Names.includes(v.replace(/^\\^/, '')) && (!v.startsWith('^') || r.Names.startsWith(v.slice(1))));
    else if (k === 'status') rows = rows.filter((r) => r.State === v);
  }
  const labelStr = (r) => Object.entries(r.Labels).map(([k, v]) => k + '=' + v).join(',');
  const render = (r) => {
    if (quiet && !format) return r.ID;
    if (!format) return r.ID + '   ' + r.Image + '   ' + r.Status + '   ' + r.Names;
    return format.replace(/^table\\s+/, '')
      .replace(/\\{\\{\\s*json \\.\\s*\\}\\}/g, () => JSON.stringify({ ID: r.ID, Names: r.Names, Labels: labelStr(r), Image: r.Image, State: r.State, Status: r.Status }))
      .replace(/\\{\\{\\s*json \\.Labels\\s*\\}\\}/g, () => JSON.stringify(labelStr(r)))
      .replace(/\\{\\{\\s*\\.Label\\s+"([^"]*)"\\s*\\}\\}/g, (_, k) => r.Labels[k] ?? '')
      .replace(/\\{\\{\\s*\\.Labels\\s*\\}\\}/g, () => labelStr(r))
      .replace(/\\{\\{\\s*\\.(Names|Name|ID|Image|State|Status)\\s*\\}\\}/g, (_, k) => (k === 'Name' ? r.Names : r[k]))
      .replace(/\\\\t/g, '\\t');
  };
  log({ phase: 'ps', count: rows.length });
  if (rows.length) process.stdout.write(rows.map(render).join('\\n') + '\\n');
  process.exit(0);
} else if (cmd === 'inspect') {
  const l = read();
  const names = args.filter((x) => !x.startsWith('-'));
  const found = names.filter((n) => l[n]).map((n) => ({ Id: l[n].id, Name: '/' + n, Config: { Labels: l[n].labels, Image: l[n].image }, State: { Status: l[n].state, Running: l[n].state === 'running' } }));
  log({ phase: 'inspect' });
  process.stdout.write(JSON.stringify(found) + '\\n');
  process.exit(found.length === names.length ? 0 : 1);
} else {
  log({ phase: 'other' });
  process.exit(0);
}
`;

// A container root as _steps.mjs's boxScript() makes one, with the stand-in docker above.
function boxFixture(cli, { mode = { run: 'finish' }, containers = {} } = {}) {
  const fx = fixture({ issues: { fixture: { [N]: {} } }, cli, timoneRepo: true });
  fs.symlinkSync(path.dirname(fx.cliPath), path.join(fx.dir, 'dist'));
  G(fx.dir, 'remote', 'add', 'origin', 'https://github.com/probe-owner/timone.git');
  G(path.join(fx.dir, 'remote', 'timone.git'), 'fetch', '-q', fx.dir, '+HEAD:refs/heads/main');
  G(fx.dir, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  fs.writeFileSync(path.join(fx.dir, 'bin', 'git'), `#!/bin/bash
case "$*" in *"remote get-url origin") exec /usr/bin/git "\${@:1:$#-3}" config --get remote.origin.url;; esac
exec /usr/bin/git -c url.${fx.dir}/remote/fixture.git.insteadOf=https://github.com/probe-owner/fixture.git -c url.${fx.dir}/remote/timone.git.insteadOf=https://github.com/probe-owner/timone.git "$@"
`);
  fs.writeFileSync(path.join(fx.dir, 'bin', 'docker'), STAND_IN(fx.dir, fx.statePath));
  fs.chmodSync(path.join(fx.dir, 'bin', 'docker'), 0o755);
  fx.mode = (m) => fs.writeFileSync(path.join(fx.dir, 'docker-mode.json'), JSON.stringify(m));
  fx.mode(mode);
  fx.containers = () => { try { return JSON.parse(fs.readFileSync(path.join(fx.dir, 'docker-containers.json'), 'utf8')); } catch { return {}; } };
  fx.setContainers = (c) => fs.writeFileSync(path.join(fx.dir, 'docker-containers.json'), JSON.stringify(c, null, 1));
  if (Object.keys(containers).length) fx.setContainers(containers);
  const log = path.join(fx.dir, 'docker.jsonl');
  fx.calls = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
  fx.started = () => fx.calls().filter((c) => c.phase === 'started');
  fx.rms = () => fx.calls().filter((c) => c.phase === 'rm-start');
  fx.killStandIns = () => { for (const c of fx.calls().filter((c) => c.phase === 'started')) { try { process.kill(c.pid, 'SIGKILL'); } catch {} } };
  return fx;
}

const runnerStarts = () => model({ runner: (c) => (c.turn > 0 ? say() : act('start_step', { stage: 'requirements', instructions: 'write it down', reason: 'probe', skipReason: 'probe: the request is clear' })) });

function startDaemon(fx, m) {
  const env = { ...fx.env(m.port), CLAUDE_CODE_OAUTH_TOKEN: 'sk-ant-oat01-probe-dummy' };
  const child = spawn(process.execPath, [fx.cliPath, 'daemon', '--manifest', fx.manifest, '--interval', '2', '--runtime', 'container', '--state', fx.statePath], { cwd: fx.dir, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const d = { child, out: '', exited: new Promise((r) => child.on('exit', (code, signal) => r({ code, signal }))) };
  child.stdout.on('data', (x) => (d.out += x));
  child.stderr.on('data', (x) => (d.out += x));
  return d;
}
const waitFor = async (cond, ms = 45000) => { const t = Date.now(); while (Date.now() - t < ms) { if (cond()) return true; await sleep(200); } return false; };
async function stop(d, signal = 'SIGTERM', ms = 15000) {
  if (d.child.exitCode !== null || d.child.signalCode !== null) return d.exited;
  d.child.kill(signal);
  const t = setTimeout(() => d.child.kill('SIGKILL'), ms);
  const r = await d.exited;
  clearTimeout(t);
  return r;
}
const stepEnded = (fx) => fx.record(N).some((e) => e.kind === 'step-ended');
const tail = (s, n = 600) => s.replace(/\s+/g, ' ').slice(-n);

// ------------------------------------------------------------------ 1a — the name belongs to the run
// Two daemons, each in a fresh root, each start the same step of the same ticket: the first run of
// ticket 12 on project `fixture`, step `requirements`. What a restarted daemon does is exactly this:
// it asks again for the first box of its life.
async function oneStart(cli) {
  const fx = boxFixture(cli);
  const m = await runnerStarts();
  const d = startDaemon(fx, m);
  await waitFor(() => fx.started().length >= 1 && stepEnded(fx));
  await sleep(1500);
  await stop(d);
  await m.stop();
  const s = fx.started()[0];
  const run = fx.run(N);
  fx.killStandIns();
  fx.cleanup();
  return { name: s?.name, run, labels: s?.labels, out: d.out };
}
async function c1a(cli) {
  const [x, y] = await Promise.all([oneStart(cli), oneStart(cli)]);
  for (const r of [x, y]) {
    assert(r.name, `no box was started; daemon said: ${tail(r.out)}`);
    assert(r.run, `the ledger holds no run for ticket ${N}`);
    const parts = { project: 'fixture', ticket: String(N), 'run number': String(r.run.seq), step: r.run.stage };
    const missing = Object.entries(parts).filter(([, v]) => !r.name.split(/[^A-Za-z0-9]+/).includes(v));
    assert(missing.length === 0, `the box "${r.name}" does not carry its run's ${missing.map(([k, v]) => `${k} (${v})`).join(', ')}`);
  }
  assert(x.name !== y.name, `two daemons asked docker for the same name "${x.name}" for the first box of their life`);
  const strip = (r) => r.name.split(/[^A-Za-z0-9]+/).filter((p) => !['timone', 'fixture', String(N), String(r.run.seq), r.run.stage].includes(p));
  const rx = strip(x), ry = strip(y);
  assert(rx.length >= 1 && rx.join('-') !== ry.join('-'), `the names differ by nothing but the run's own parts: "${x.name}" and "${y.name}"`);
  const randomBits = (s) => s.join('').length * 4;
  return { x, y, rx, ry, bits: Math.min(randomBits(rx), randomBits(ry)) };
}
await clause('R23 clause 1 (a)', 'a box is named after its run — project, ticket, run number, step — plus a random part, so two daemons never ask docker for the same name', {
  broken: () => c1a(OLD()),
  correct: async () => {
    const { x, y, rx, bits } = await c1a(CLI);
    console.log(`    daemon 1: "${x.name}" (ledger: run ${x.run.id}, step ${x.run.stage})`);
    console.log(`    daemon 2: "${y.name}" (ledger: run ${y.run.id}, step ${y.run.stage})`);
    console.log(`    the part that is not the run's: "${rx.join('-')}", about ${bits} bits`);
  },
});

// ------------------------------------------------------------------ 1b — the end waits for the removal
// `docker rm` takes 3 seconds. The stand-in writes down, when the removal starts and when it ends,
// which entries the ticket's record holds. If the daemon waits for the removal before the session counts
// as ended, the `step-ended` entry is not there when the removal ends.
async function c1b(cli) {
  const fx = boxFixture(cli, { mode: { run: 'finish', rmDelayMs: 3000 } });
  const m = await runnerStarts();
  const d = startDaemon(fx, m);
  await waitFor(() => fx.started().length >= 1 && stepEnded(fx) && fx.calls().some((c) => c.phase === 'rm-end'), 60000);
  await sleep(1000);
  await stop(d);
  await m.stop();
  const name = fx.started()[0]?.name;
  const calls = fx.calls();
  const rmEnd = calls.find((c) => c.phase === 'rm-end' && c.names.includes(name));
  const rmStart = calls.find((c) => c.phase === 'rm-start' && c.names.includes(name));
  const record = fx.record(N).map((e) => e.kind);
  const left = fx.containers();
  fx.killStandIns();
  fx.cleanup();
  assert(name, `no box was started; daemon said: ${tail(d.out)}`);
  assert(rmStart && rmEnd, `the box "${name}" was never removed; record: ${record.join(', ')}`);
  assert(!(name in left), `the box "${name}" is still on docker's list after the run`);
  assert(!rmEnd.record.includes('step-ended'), `the session counted as ended before docker had removed its box: the record held "step-ended" when the 3-second removal finished (record at removal start: ${rmStart.record.join(', ')})`);
  assert(record.includes('step-ended'), `the session never counted as ended; record: ${record.join(', ')}`);
  return { name, rmStart, rmEnd, record };
}
await clause('R23 clause 1 (b)', 'the end of a box waits for docker to remove it: the session counts as ended only after the removal has finished', {
  broken: () => c1b(OLD()),
  correct: async () => {
    const r = await c1b(CLI);
    console.log(`    box "${r.name}": removal took ${r.rmEnd.t - r.rmStart.t} ms; the record at its end held: ${r.rmEnd.record.join(', ') || '(nothing)'}`);
    console.log(`    the record afterwards: ${r.record.join(', ')}`);
  },
});

// ------------------------------------------------------------------ 1c — a refused start removes nothing
// Every `docker run` is refused: the name is already held by another run's container, which the
// stand-in puts on its list at that moment. Nothing may then remove that container.
async function c1c(cli) {
  const fx = boxFixture(cli, { mode: { run: 'conflict' } });
  const m = await runnerStarts();
  const d = startDaemon(fx, m);
  await waitFor(() => fx.calls().some((c) => c.phase === 'refused') && fx.record(N).some((e) => e.kind === 'step-ended' || (e.kind === 'decision' && e.action === 'start_step')), 60000);
  await sleep(5000);
  await stop(d);
  await m.stop();
  const refused = fx.calls().filter((c) => c.phase === 'refused').map((c) => c.name);
  const rms = fx.rms().flatMap((c) => c.names);
  const left = fx.containers();
  const record = fx.record(N).map((e) => `${e.kind}${e.ok === false ? ' FAILED' : ''}`);
  fx.cleanup();
  assert(refused.length >= 1, `docker was never asked to start a box; daemon said: ${tail(d.out)}`);
  const hit = refused.filter((n) => rms.includes(n) || !(n in left));
  assert(hit.length === 0, `after docker refused the name, the daemon removed the container that held it: ${hit.join(', ')} (every removal: ${rms.join(', ')})`);
  return { refused, rms, record };
}
await clause('R23 clause 1 (c)', 'a start docker refused because the name was taken removes nothing: the container that holds the name is left alone', {
  broken: () => c1c(OLD()),
  correct: async () => {
    const r = await c1c(CLI);
    console.log(`    refused names: ${r.refused.join(', ')}; still on docker's list afterwards; removals made: ${r.rms.join(', ') || 'none'}`);
    console.log(`    the record: ${r.record.join(', ')}`);
  },
});

// ------------------------------------------------------------------ 1d — Ctrl-C and SIGTERM remove running boxes
async function onSignal(cli, signal) {
  const fx = boxFixture(cli, { mode: { run: 'hang' } });
  const m = await runnerStarts();
  const d = startDaemon(fx, m);
  await waitFor(() => fx.started().length >= 1, 60000);
  await sleep(1500);
  const name = fx.started()[0]?.name;
  const id = fx.containers()[name]?.id;
  const before = d.out.length;
  const ex = await stop(d, signal, 20000);
  await m.stop();
  await sleep(500);
  const rms = fx.rms().filter((c) => c.ppid === d.child.pid).flatMap((c) => c.names).map((x) => (id && id.startsWith(x) ? name : x));
  const left = fx.containers();
  const said = d.out.slice(before);
  fx.killStandIns();
  fx.cleanup();
  return { name, rms, left, said, ex, out: d.out };
}
async function c1d(cli) {
  const [i, t] = await Promise.all([onSignal(cli, 'SIGINT'), onSignal(cli, 'SIGTERM')]);
  for (const [sig, r] of [['SIGINT', i], ['SIGTERM', t]]) {
    assert(r.name, `${sig}: no box was started; daemon said: ${tail(r.out)}`);
    assert(r.ex.signal !== 'SIGKILL', `${sig}: the daemon did not exit within 20 s and was killed`);
    assert(r.rms.includes(r.name), `${sig}: the daemon exited without removing its running box "${r.name}" (removals: ${r.rms.join(', ') || 'none'})`);
    assert(!(r.name in r.left), `${sig}: the box "${r.name}" is still on docker's list after the daemon exited`);
    assert(r.said.includes(r.name), `${sig}: the daemon's log does not name the box it removed; it said after the signal: ${tail(r.said, 400)}`);
  }
  return { i, t };
}
await clause('R23 clause 1 (d)', 'on SIGINT or SIGTERM the daemon removes the boxes still running and names them in its log', {
  broken: () => c1d(OLD()),
  correct: async () => {
    const { i, t } = await c1d(CLI);
    for (const [sig, r] of [['SIGINT', i], ['SIGTERM', t]]) {
      const line = r.said.split('\n').find((l) => l.includes(r.name)) ?? '';
      console.log(`    ${sig}: box "${r.name}" removed; exit ${r.ex.code ?? r.ex.signal}; log line: ${line.trim()}`);
    }
  },
});

// ------------------------------------------------------------------ 1e — the start-up removal
// Daemon A starts a box that keeps running, and is then killed with SIGKILL: nothing of it cleans up,
// as when a machine loses power. Beside A's box, docker's list holds containers the probe plants:
//   - an old-style box of a manifest project, `timone-fixture-4`, named the way boxes were before;
//   - a box like A's, but labelled with another ledger (another daemon's state file);
//   - preview- and service-shaped containers, which are not boxes. How the build names a preview was
//     not looked up (that would mean reading source): three shapes are planted, compose-style and
//     timone-prefixed.
// Daemon B then starts on A's root. It must remove A's box and the old-style box, name them in its
// log, and leave everything else. A third daemon, C, started while B runs, is refused by the lock and
// must remove nothing.
const PLANTED_KEEP = {
  'fixture-pr-12-web-1': { id: 'p1', labels: { 'com.docker.compose.project': 'fixture-pr-12', 'com.docker.compose.service': 'web' }, image: 'fixture-web', state: 'running' },
  'timone-preview-fixture-12': { id: 'p2', labels: {}, image: 'fixture-web', state: 'running' },
  'timone-fixture-pr-12': { id: 'p3', labels: { 'com.docker.compose.project': 'timone-fixture-pr-12' }, image: 'fixture-web', state: 'running' },
  'fixture-db-1': { id: 's1', labels: { 'com.docker.compose.project': 'fixture', 'com.docker.compose.service': 'db' }, image: 'postgres', state: 'running' },
  'postgres': { id: 's2', labels: {}, image: 'postgres', state: 'running' },
};
async function c1e(cli) {
  const fx = boxFixture(cli, { mode: { run: 'hang' } });
  const m = await runnerStarts();
  const a = startDaemon(fx, m);
  await waitFor(() => fx.started().length >= 1, 60000);
  await sleep(1500);
  a.child.kill('SIGKILL');
  await a.exited;
  fx.killStandIns();
  const boxA = fx.started()[0]?.name;
  assert(boxA, `daemon A started no box; it said: ${tail(a.out)}`);
  const list = fx.containers();
  assert(list[boxA], `instrument: A's box "${boxA}" is not on docker's list after A was killed`);
  // The other ledger's box: A's own labels, with every label that names A's state file pointed elsewhere.
  const aLabels = list[boxA].labels ?? {};
  const otherLabels = Object.fromEntries(Object.entries(aLabels).map(([k, v]) => [k, String(v).split(fx.statePath).join('/elsewhere/.timone/state.json')]));
  const ledgerLabel = Object.keys(aLabels).find((k) => String(aLabels[k]).includes(fx.statePath)) ?? null;
  list['timone-fixture-12-1-requirements-0badc0de'] = { id: 'o1', labels: otherLabels, image: list[boxA].image, state: 'running' };
  list['timone-fixture-4'] = { id: 'old4', labels: {}, image: list[boxA].image, state: 'exited' };
  Object.assign(list, PLANTED_KEEP);
  fx.setContainers(list);
  const otherKey = Object.keys(list).find((k) => list[k].id === 'o1');
  fs.rmSync(`${fx.statePath}.lock`, { force: true, recursive: true });
  fx.mode({ run: 'finish' });
  const b = startDaemon(fx, m);
  await waitFor(() => !(boxA in fx.containers()) && !('timone-fixture-4' in fx.containers()), 30000);
  await sleep(3000);
  const c = startDaemon(fx, m);
  const cEx = await Promise.race([c.exited, sleep(20000).then(() => null)]);
  if (!cEx) await stop(c);
  await stop(b);
  await m.stop();
  const after = fx.containers();
  // `docker rm` takes a name or an id; each argument is turned back into the name it removed.
  const byId = Object.fromEntries(Object.entries(list).map(([k, v]) => [v.id, k]));
  const asName = (x) => (x in list ? x : byId[x] ?? Object.entries(byId).find(([id]) => id.startsWith(x))?.[1] ?? x);
  const rmsB = fx.rms().filter((x) => x.ppid === b.child.pid).flatMap((x) => x.names).map(asName);
  const rmsC = fx.rms().filter((x) => x.ppid === c.child.pid).flatMap((x) => x.names).map(asName);
  fx.killStandIns();
  fx.cleanup();
  const keep = [otherKey, ...Object.keys(PLANTED_KEEP)];
  assert(rmsB.includes(boxA) && !(boxA in after), `daemon B did not remove A's leftover box "${boxA}" (B's removals: ${rmsB.join(', ') || 'none'}); B said: ${tail(b.out, 300)}`);
  assert(rmsB.includes('timone-fixture-4') && !('timone-fixture-4' in after), `daemon B did not remove the old-style box "timone-fixture-4" (B's removals: ${rmsB.join(', ') || 'none'})`);
  assert(b.out.includes(boxA) && b.out.includes('timone-fixture-4'), `daemon B's log does not name what it removed; it said: ${tail(b.out, 400)}`);
  const touched = keep.filter((k) => rmsB.includes(k) || !(k in after));
  assert(touched.length === 0, `daemon B removed containers that are not its leftovers: ${touched.join(', ')}`);
  assert(rmsC.length === 0, `daemon C, refused by the lock, still removed: ${rmsC.join(', ')}`);
  return { boxA, ledgerLabel, keep, rmsB, b, c, cEx };
}
await clause('R23 clause 1 (e)', "a starting daemon removes the boxes an earlier daemon of the same ledger left, and old-style box names, says so in its log, and leaves previews, services and other ledgers' boxes alone; a daemon refused by the lock removes nothing", {
  broken: () => c1e(OLD()),
  correct: async () => {
    const r = await c1e(CLI);
    console.log(`    A's box "${r.boxA}", ledger label: ${r.ledgerLabel ?? '(none found)'}`);
    console.log(`    B removed: ${r.rmsB.join(', ')}`);
    for (const l of r.b.out.split('\n').filter((l) => l.includes(r.boxA) || l.includes('timone-fixture-4'))) console.log(`    B's log: ${l.trim()}`);
    console.log(`    kept: ${r.keep.join(', ')}`);
    console.log(`    C: exit ${r.cEx ? r.cEx.code : 'none within 20 s'}; said: ${tail(r.c.out, 200)}`);
  },
});

// ------------------------------------------------------------------ 1f — nothing of the host is mounted
// The clause's last words: "with no path from fvermaut's filesystem mounted into it". Read from every
// `docker run` the build makes in one start. Break leg: the same arguments with one host path added.
function mounts(argv) {
  const found = [];
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '-v' || x === '--volume') found.push(argv[i + 1]);
    else if (x.startsWith('--volume=') || x.startsWith('-v=')) found.push(x.split('=').slice(1).join('='));
    else if (x === '--mount') found.push(argv[i + 1]);
    else if (x.startsWith('--mount=')) found.push(x.slice(8));
  }
  return found.filter((m) => m && (m.startsWith('/') || m.startsWith('~') || m.startsWith('.') || /type=bind/.test(m)));
}
const runArgv = memo(async () => {
  const fx = boxFixture(CLI);
  const m = await runnerStarts();
  const d = startDaemon(fx, m);
  await waitFor(() => fx.started().length >= 1 && stepEnded(fx));
  await stop(d);
  await m.stop();
  const argvs = fx.calls().filter((c) => c.phase === 'started' || c.phase === 'refused').map((c) => c.argv);
  fx.cleanup();
  return argvs;
});
await clause('R23 clause 1 (f)', "no path from the host's filesystem is mounted into the box", {
  broken: async () => { const a = await runArgv(); const bad = [[...a[0].slice(0, 1), '-v', '/Users/fvermaut:/workspace/home', ...a[0].slice(1)]]; for (const x of bad) { const f = mounts(x); assert(f.length === 0, `a host path is mounted: ${f.join(', ')}`); } },
  correct: async () => {
    const a = await runArgv();
    assert(a.length >= 1, 'no docker run was made');
    for (const x of a) { const f = mounts(x); assert(f.length === 0, `a host path is mounted: ${f.join(', ')}`); }
    console.log(`    ${a.length} docker run call(s); none carries -v, --volume or a bind --mount of a host path`);
  },
});

blocked('R23 clause 2', "fvermaut's checkout is untouched while a run builds", 'not claimed by phase 66; needs a real daemon-driven run on a real machine');
blocked('R23 clause 3', 'two runs an hour apart hold timone at the same commit; a dirty daemon checkout refuses', 'not claimed by phase 66; needs real containers');
blocked('R23 clause 4', 'services beside the box on a private network, no docker socket inside', 'not claimed by phase 66; needs real docker');
blocked('R23 clause 5', "authorship is Timone's own account; the credential opens one repository", 'not claimed by phase 66; needs the real forge');
blocked('R23 clause 6', 'both merges go through the forge', 'not claimed by phase 66; needs the real forge');

finish('PRD-02.R23');
