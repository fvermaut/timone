// Verifier rig for PRD-05 (stage 7 artifact). Written 2026-09-28 for phase 40,
// from the register and from what the built app was seen to ask its forge and
// its model — never from its source or its tests.
//
// It runs the BUILT daemon (dist/cli.js) in a throwaway folder, against:
//   - a fake forge: _fake-gh.cjs, first on PATH, backed by a JSON file and a
//     bare git remote;
//   - a stand-in for the network to GitHub: _fetch-shim.mjs, loaded into the
//     daemon, so the credential it mints is a local throwaway;
//   - a fake model service on 127.0.0.1, answered by the probe's own plan.
// Step sessions run in-process (--runtime in-process): a boxed step clones from
// the real forge, which this rig replaces. The runner runs inside the daemon
// process in both runtimes.
//
// Nothing here reaches GitHub or a real model. Needs `npm run build` first.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { PROBE_DIR, REPO_ROOT, CLI } from './_lib.mjs';

export { REPO_ROOT, CLI };
export const FAKE_GH = path.join(PROBE_DIR, '_fake-gh.cjs');
export const FETCH_SHIM = path.join(PROBE_DIR, '_fetch-shim.mjs');
export const OPERATOR = 'probe-operator';
export const STRANGER = 'probe-stranger';
export const BOT = 'probe-bot';
export const MACHINE_HEADER = '🤖 **Timone** · automatic message — written by the machine, not by the account it appears under\n\n---\n\n';

let KEY;
function key() {
  KEY ??= crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs1', format: 'pem' });
  return KEY;
}
const G = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const GID = ['-c', 'user.email=probe@example.invalid', '-c', 'user.name=probe'];

if (!fs.existsSync(CLI)) {
  console.error('dist/cli.js is missing: run `npm run build` first.');
  process.exit(2);
}

// ---------------------------------------------------------------- fixture
//
// opts.projects: { name: { driver, driverLine, instructors, limit, places, labels } } — defaults to one
//   project named "fixture".
// opts.operator: the top-level operator login, or null for none.
// opts.issues:   { project: { number: {title, body, labels, author, comments} } }
// opts.timoneRepo: true adds a `timone` project so the runner has a Timone repo.
// opts.cli:      the built cli.js to run (default: this tree's dist/cli.js). A break leg can
//   point it at an older build, from _old-build.mjs.
//
// ✏ 2026-10-02 (phase 41 verification): every project is on the runner, and a `driver`
// line no longer loads (PRD-05.R19's note, R20). `driver: 'runner'` is still accepted from
// older probes and writes nothing. `driverLine: '<value>'` writes the line on purpose, for a
// probe that checks it is refused. Any other `driver` value is an error in the probe.
export function fixture(opts = {}) {
  const base = process.env.PROBE_TMP || os.tmpdir();
  const dir = fs.mkdtempSync(path.join(base, 'prd05-'));
  const projects = opts.projects ?? { fixture: {} };
  for (const [name, p] of Object.entries(projects)) {
    if (p.driver && p.driver !== 'runner') throw new Error(`rig: project ${name} asks for driver "${p.driver}"; a driver line no longer loads — use driverLine to plant one on purpose`);
  }
  const operator = opts.operator === undefined ? OPERATOR : opts.operator;
  fs.mkdirSync(path.join(dir, 'bin'));
  fs.mkdirSync(path.join(dir, 'remote'));
  fs.mkdirSync(path.join(dir, 'projects'));
  fs.mkdirSync(path.join(dir, 'claude-config'));
  fs.writeFileSync(path.join(dir, 'probe-key.pem'), key());
  fs.copyFileSync(FAKE_GH, path.join(dir, 'bin', 'gh'));
  fs.chmodSync(path.join(dir, 'bin', 'gh'), 0o755);
  // git is logged, and any URL that names github.com is refused, so no git call leaves the machine.
  const realGit = execFileSync('/usr/bin/which', ['git'], { encoding: 'utf8' }).trim();
  const gitLog = path.join(dir, 'git.log');
  fs.writeFileSync(path.join(dir, 'bin', 'git'), [
    '#!/bin/sh',
    `printf '%s\\t%s\\n' "$(date -u +%H:%M:%S)" "$*" >> "${gitLog}"`,
    'case "$*" in *github.com*) echo "probe rig: refusing a git call that names github.com" >&2; exit 128;; esac',
    `exec ${realGit} "$@"`,
    '',
  ].join('\n'));
  fs.chmodSync(path.join(dir, 'bin', 'git'), 0o755);

  const remotes = {};
  const gitConfig = [];
  let yaml = `identity:\n  app_id: 1\n  installation_id: 1\n  private_key_path: ${path.join(dir, 'probe-key.pem')}\n  login: ${BOT}[bot]\n  commit_email: ${BOT}@example.invalid\n`;
  if (operator) yaml += `operator: ${operator}\n`;
  yaml += 'projects:\n';
  const all = { ...projects };
  if (opts.timoneRepo) all.timone = { driver: undefined, noPath: false };
  for (const [name, p] of Object.entries(all)) {
    const bare = path.join(dir, 'remote', `${name}.git`);
    G(dir, 'init', '-q', '--bare', '-b', 'main', bare);
    G(dir, 'clone', '-q', bare, path.join('projects', name));
    const clone = path.join(dir, 'projects', name);
    for (const [file, text] of Object.entries(p.files ?? {})) {
      fs.mkdirSync(path.dirname(path.join(clone, file)), { recursive: true });
      fs.writeFileSync(path.join(clone, file), text);
    }
    G(clone, 'add', '-A');
    G(clone, ...GID, 'commit', '-q', '--allow-empty', '-m', 'init');
    // ✏ 2026-10-05 (phase 51 verification): the throwaway remote is filled by a fetch run in the
    // remote, not by a push from the clone. A run's container refuses every push that is not to
    // the run's own work branch (its pre-push hook), and that refused this rig's setup push to
    // its own scratch repository. Nothing is switched off: no push happens here at all. The
    // state left is the same as the push left: main on the remote, origin/main in the clone.
    G(bare, 'fetch', '-q', clone, 'main:main');
    G(clone, 'fetch', '-q', 'origin');
    // ✏ 2026-10-05 (phase 49 verification): a clone made from a remote that already has main
    // knows origin/HEAD; this one was cloned while the remote was empty, so set it as such a
    // clone would. Since phase 49 the push guard refuses a work branch's first push from a
    // clone without origin/HEAD (the completion report's known limits).
    G(clone, 'remote', 'set-head', 'origin', 'main');
    const slug = `probe-owner/${name}`;
    remotes[slug] = bare;
    gitConfig.push([`url.${bare}.insteadOf`, `https://github.com/${slug}.git`]);
    yaml += `  ${name}:\n    repo_url: https://github.com/${slug}.git\n    path: projects/${name}\n    stack:\n      - typescript\n    bindings:\n      ticketing: github\n`;
    if (p.driverLine) yaml += `    driver: ${p.driverLine}\n`;
    if (p.instructors) yaml += `    instructors: [${p.instructors.join(', ')}]\n`;
    if (p.limit !== undefined) yaml += `    ticket_limit_usd: ${p.limit}\n`;
    // ✏ 2026-10-05 (phase 49 verification): `places`, the project's number of places (PRD-07.R2;
    // the key is named in CONTEXT.md). Written only when a probe asks for it.
    if (p.places !== undefined) yaml += `    places: ${p.places}\n`;
  }
  fs.writeFileSync(path.join(dir, 'timone.yaml'), yaml);

  // The forge: one repository per project. The first project is the default slug.
  const names = Object.keys(all);
  const repoOf = (name) => ({ issues: {}, prs: {} });
  const forge = { slug: `probe-owner/${names[0]}`, nextNumber: 100, nextComment: 1000, issues: {}, prs: {}, others: {}, ahead: {}, remotes };
  const issues = opts.issues ?? { [names[0]]: { 1: {} } };
  for (const name of names) {
    const target = name === names[0] ? forge : (forge.others[`probe-owner/${name}`] = repoOf(name));
    for (const [num, i] of Object.entries(issues[name] ?? {})) {
      target.issues[num] = {
        number: Number(num),
        title: i.title ?? 'Add a count of open to-dos',
        body: i.body ?? 'Show how many to-dos are open, above the list.',
        labels: i.labels ?? ['timone'],
        state: i.state ?? 'OPEN',
        author: i.author ?? OPERATOR,
        createdAt: i.createdAt ?? '2026-09-28T10:00:00.000Z',
        comments: (i.comments ?? []).map((c, k) => ({ id: 900 + k, createdAt: `2026-09-28T10:0${k + 1}:00.000Z`, ...c })),
      };
    }
  }
  fs.writeFileSync(path.join(dir, 'forge.json'), JSON.stringify(forge, null, 2));

  // The daemon's own folder is a git repository in real use (the timone root).
  fs.writeFileSync(path.join(dir, '.gitignore'), 'projects/\nremote/\nwork/\n.timone/\nclaude-config/\n*.log\nforge.json*\nstate.json*\nbin/\n');
  G(dir, 'init', '-q', '-b', 'main');
  G(dir, 'add', '-A');
  G(dir, ...GID, 'commit', '-q', '-m', 'fixture root');

  const fx = {
    dir,
    cliPath: opts.cli ?? CLI,
    manifest: path.join(dir, 'timone.yaml'),
    statePath: path.join(dir, 'state.json'),
    forgePath: path.join(dir, 'forge.json'),
    env(port) {
      const env = { ...process.env };
      for (const k of ['CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_SSE_PORT']) delete env[k];
      Object.assign(env, {
        PATH: `${path.join(dir, 'bin')}:${process.env.PATH}`,
        FAKE_GH_LOG: path.join(dir, 'gh.log'),
        FAKE_FORGE: path.join(dir, 'forge.json'),
        FAKE_BOT_LOGIN: BOT,
        FAKE_NET_LOG: path.join(dir, 'net.log'),
        CLAUDE_CONFIG_DIR: path.join(dir, 'claude-config'),
        ANTHROPIC_BASE_URL: `http://127.0.0.1:${port ?? 9}`,
        ANTHROPIC_API_KEY: 'probe-dummy-key',
        DISABLE_TELEMETRY: '1',
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
        NODE_OPTIONS: `--import=${FETCH_SHIM}`,
        GIT_CONFIG_COUNT: String(gitConfig.length),
        GIT_TERMINAL_PROMPT: '0',
      });
      gitConfig.forEach(([k, v], i) => { env[`GIT_CONFIG_KEY_${i}`] = k; env[`GIT_CONFIG_VALUE_${i}`] = v; });
      return env;
    },
    record(ticket = 1, project = names[0]) {
      const p = path.join(dir, '.timone', 'records', project, `${ticket}.jsonl`);
      if (!fs.existsSync(p)) return [];
      return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    },
    state() { return fs.existsSync(fx.statePath) ? JSON.parse(fs.readFileSync(fx.statePath, 'utf8')) : { runs: [] }; },
    run(ticket = 1, project = names[0]) { return fx.state().runs.filter((r) => r.ticket === ticket && r.project === project).at(-1); },
    forge() { return JSON.parse(fs.readFileSync(fx.forgePath, 'utf8')); },
    issue(num, project = names[0]) {
      const f = fx.forge();
      return project === names[0] ? f.issues[num] : f.others[`probe-owner/${project}`]?.issues[num];
    },
    gh() {
      const p = path.join(dir, 'gh.log');
      return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
    },
    net() {
      const p = path.join(dir, 'net.log');
      return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
    },
    editForge(fn) {
      const lock = `${fx.forgePath}.lock`;
      const until = Date.now() + 10000;
      for (;;) {
        try { fs.mkdirSync(lock); break; } catch { if (Date.now() > until) throw new Error('forge lock stuck'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20); }
      }
      try {
        const f = fx.forge();
        const r = fn(f);
        fs.writeFileSync(fx.forgePath, JSON.stringify(f, null, 2));
        return r;
      } finally { fs.rmdirSync(lock); }
    },
    // Add a comment as `author` on a ticket (or, with pr, on a pull request). Returns its createdAt.
    comment(num, author, body, { project = names[0], pr = false } = {}) {
      return fx.editForge((f) => {
        const repo = project === names[0] ? f : f.others[`probe-owner/${project}`];
        const holder = pr ? repo.prs[num] : repo.issues[num];
        // Each comment gets its own second, as GitHub's times have no finer grain.
        let t = Math.ceil(Date.now() / 1000) * 1000;
        if (fx.lastCommentAt && t <= fx.lastCommentAt) t = fx.lastCommentAt + 1000;
        fx.lastCommentAt = t;
        const at = new Date(t).toISOString().replace('.000Z', 'Z');
        (holder.comments ??= []).push({ id: f.nextComment++, author, body, createdAt: at });
        return at;
      });
    },
    remoteHead(branch = 'main', project = names[0]) {
      try { return G(dir, '--git-dir', path.join(dir, 'remote', `${project}.git`), 'rev-parse', branch).trim(); } catch { return undefined; }
    },
    remoteFile(branch, file, project = names[0]) {
      try { return G(dir, '--git-dir', path.join(dir, 'remote', `${project}.git`), 'show', `${branch}:${file}`); } catch { return undefined; }
    },
    // Push a commit with the given files onto a branch of the remote, as a step would have.
    // Uses a private clone, never the daemon's. files: { path: text | (old) => text }.
    pushBranch(branch, files, message = 'probe: planted work', project = names[0]) {
      const clone = path.join(dir, 'work', project);
      if (!fs.existsSync(clone)) G(dir, 'clone', '-q', path.join(dir, 'remote', `${project}.git`), clone);
      G(clone, 'fetch', '-q', 'origin');
      const exists = (() => { try { G(clone, 'rev-parse', '--verify', '--quiet', `origin/${branch}`); return true; } catch { return false; } })();
      G(clone, 'checkout', '-q', '-B', branch, exists ? `origin/${branch}` : 'origin/main');
      for (const [file, text] of Object.entries(files)) {
        const p = path.join(clone, file);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, typeof text === 'function' ? text(fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '') : text);
      }
      G(clone, 'add', '-A');
      G(clone, ...GID, 'commit', '-q', '--allow-empty', '-m', message);
      // ✏ 2026-10-05 (phase 51 verification): a fetch run in the remote, not a push; see fixture().
      G(path.join(dir, 'remote', `${project}.git`), 'fetch', '-q', clone, `HEAD:refs/heads/${branch}`);
      G(clone, 'fetch', '-q', 'origin');
    },
    cli(args, { port } = {}) {
      try {
        const out = execFileSync(process.execPath, [fx.cliPath, ...args], { cwd: dir, env: fx.env(port), stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 });
        return { code: 0, out: out.toString(), err: '' };
      } catch (e) {
        return { code: e.status ?? 1, out: (e.stdout ?? '').toString(), err: (e.stderr ?? '').toString() };
      }
    },
    cleanup() {
      if (process.env.PROBE_KEEP) return;
      try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch {}
    },
  };
  return fx;
}

// ---------------------------------------------------------------- the fake model
//
// plan.runner(ctx) / plan.planner(ctx) / plan.step(ctx) / plan.other(ctx) return an answer:
//   { blocks: [{type:'text',text}|{type:'tool_use',name,input}], usage, httpError, hang }
// ctx: { body, kind, sid, wake (runner: 0-based index of its session), turn,
//        brief (first user message), last (newest user message, tool results included) }
export const say = (t = 'Nothing more to do.') => ({ blocks: [{ type: 'text', text: t }] });
export const act = (name, input, usage) => ({ blocks: [{ type: 'tool_use', name: `mcp__runner__${name}`, input }], usage });
// The planner's answers. plan.planner(ctx) returns one of these, or say() to decide nothing.
export const plannerTicket = (c) => Number((c.brief.match(/## The ticket you decide for\s+\S+ #(\d+)/) || [])[1]);
export const letBuild = (ticket, reason = 'probe: nothing else on the project overlaps', commentAt) => ({ blocks: [{ type: 'tool_use', name: 'mcp__planner__let_build', input: { ticket, reason, ...(commentAt ? { commentAt } : {}) } }] });
export const hold = (ticket, waitsFor, reason) => ({ blocks: [{ type: 'tool_use', name: 'mcp__planner__hold', input: { ticket, waitsFor, reason } }] });
export const passToRunner = (ticket, commentAt) => ({ blocks: [{ type: 'tool_use', name: 'mcp__planner__pass_to_runner', input: { ticket, commentAt } }] });
export const DEFAULT_PLANNER = (c) => (c.turn === 0 ? letBuild(plannerTicket(c)) : say());
export const bash = (command) => ({ blocks: [{ type: 'tool_use', name: 'Bash', input: { command, description: 'probe step' } }] });

const textOf = (m) =>
  typeof m?.content === 'string'
    ? m.content
    : (m?.content ?? [])
        .map((c) => c.text ?? (c.type === 'tool_result' ? (typeof c.content === 'string' ? c.content : (c.content ?? []).map((x) => x.text ?? '').join('')) : ''))
        .join('\n');

export async function model(plan = {}) {
  const requests = [];
  const other = [];
  const runnerSids = [];
  const open = new Set();
  const pendingStart = new Map(); // runner session id -> its last start_step answer
  const retryStart = new Map(); // ticket -> the start_step the planner's refusal turned away
  const server = http.createServer(async (req, res) => {
    let raw = '';
    for await (const c of req) raw += c;
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch {}
    if (!(req.method === 'POST' && req.url.startsWith('/v1/messages')) || req.url.startsWith('/v1/messages/count_tokens')) {
      other.push({ at: new Date().toISOString(), method: req.method, url: req.url });
      if (req.url.startsWith('/v1/messages/count_tokens')) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"input_tokens":100}'); }
      res.writeHead(404, { 'content-type': 'application/json' });
      return res.end('{"type":"error","error":{"type":"not_found_error","message":"probe"}}');
    }
    const tools = (body.tools ?? []).map((t) => t.name);
    // ✏ 2026-10-05 (phase 49 verification): the planner is a model session of its own, seen by
    // its tools (mcp__planner__let_build, hold, pass_to_runner, read_plan). Since phase 49 no
    // build starts until it has let the ticket build (PRD-07.R5), so a probe that plans no
    // planner answer gets DEFAULT_PLANNER: let the ticket named in its brief build at once.
    const kind = tools.includes('mcp__runner__end_run') ? 'runner' : tools.includes('mcp__planner__let_build') ? 'planner' : tools.includes('Bash') ? 'step' : 'other';
    let sid = '';
    try { sid = JSON.parse(body.metadata?.user_id ?? '{}').session_id ?? ''; } catch {}
    if (kind === 'runner' && !runnerSids.includes(sid)) runnerSids.push(sid);
    const msgs = body.messages ?? [];
    const ctx = {
      body, kind, sid, tools,
      wake: kind === 'runner' ? runnerSids.indexOf(sid) : undefined,
      turn: msgs.filter((m) => m.role === 'assistant').length,
      brief: textOf(msgs.find((m) => m.role === 'user')),
      last: textOf([...msgs].reverse().find((m) => m.role === 'user')),
      system: Array.isArray(body.system) ? body.system.map((s) => s.text).join('\n') : body.system ?? '',
    };
    const rec = { at: new Date().toISOString(), kind, sid, wake: ctx.wake, turn: ctx.turn, tools, brief: ctx.brief, last: ctx.last, system: ctx.system, model: body.model };
    requests.push(rec);
    let a;
    try { a = (plan[kind] ?? (kind === 'planner' ? DEFAULT_PLANNER : () => say()))(ctx) ?? say(); } catch (e) { a = say(`probe plan error: ${e.message}`); }
    // ✏ 2026-10-05 (phase 49 verification): since phase 49 a build's first try is refused until
    // the planner decides, and the runner is woken again when it has let the ticket build. A
    // probe written before then plans its build on the wake it cares about only. So, unless the
    // probe sets plan.noBuildRetry, the rig acts as a runner that takes the refusal's word: the
    // start_step the planner's refusal turned away is tried again, once, on the wake that says
    // the planner let the ticket build, when the probe's own plan does nothing on that wake.
    if (kind === 'runner' && !plan.noBuildRetry) {
      const tkt = (ctx.brief.match(/## The ticket\s+(\S+ #\d+):/) || [])[1];
      if (ctx.turn > 0 && pendingStart.has(sid) && /Refused: The planner has not decided/.test(ctx.last) && tkt) retryStart.set(tkt, pendingStart.get(sid));
      pendingStart.delete(sid);
      const why = ctx.brief.split('## The ticket')[0];
      const acts = (a.blocks ?? []).some((b) => b.type === 'tool_use');
      if (ctx.turn === 0 && tkt && retryStart.has(tkt) && /The planner let this ticket be built/.test(why) && !acts) { a = retryStart.get(tkt); retryStart.delete(tkt); rec.retried = true; }
      const st = (a.blocks ?? []).find((b) => b.type === 'tool_use' && b.name === 'mcp__runner__start_step');
      if (st) pendingStart.set(sid, { blocks: [st], usage: a.usage });
    }
    rec.answer = a;
    if (a.delayMs) await sleep(a.delayMs);
    if (a.hang) {
      open.add(res);
      res.on('close', () => { rec.closedAt = new Date().toISOString(); open.delete(res); });
      return;
    }
    if (a.httpError) {
      res.writeHead(a.httpError, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ type: 'error', error: { type: a.httpError === 529 ? 'overloaded_error' : 'api_error', message: 'probe: scripted failure' } }));
    }
    const blocks = (a.blocks ?? []).map((b, i) => (b.type === 'tool_use' ? { type: 'tool_use', id: `toolu_probe_${requests.length}_${i}`, name: b.name, input: b.input ?? {} } : { type: 'text', text: b.text }));
    const stop = blocks.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn';
    const usage = { input_tokens: 100, output_tokens: 20, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, ...(a.usage ?? {}) };
    const id = `msg_probe_${requests.length}`;
    const mdl = body.model || 'claude-probe';
    if (!body.stream) {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ id, type: 'message', role: 'assistant', model: mdl, content: blocks, stop_reason: stop, stop_sequence: null, usage }));
    }
    const ev = (e, d) => res.write(`event: ${e}\ndata: ${JSON.stringify(d)}\n\n`);
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    ev('message_start', { type: 'message_start', message: { id, type: 'message', role: 'assistant', model: mdl, content: [], stop_reason: null, stop_sequence: null, usage: { ...usage, output_tokens: 1 } } });
    blocks.forEach((b, i) => {
      if (b.type === 'text') {
        ev('content_block_start', { type: 'content_block_start', index: i, content_block: { type: 'text', text: '' } });
        ev('content_block_delta', { type: 'content_block_delta', index: i, delta: { type: 'text_delta', text: b.text } });
      } else {
        ev('content_block_start', { type: 'content_block_start', index: i, content_block: { type: 'tool_use', id: b.id, name: b.name, input: {} } });
        ev('content_block_delta', { type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: JSON.stringify(b.input) } });
      }
      ev('content_block_stop', { type: 'content_block_stop', index: i });
    });
    ev('message_delta', { type: 'message_delta', delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: usage.output_tokens } });
    ev('message_stop', { type: 'message_stop' });
    res.end();
    rec.answeredAt = new Date().toISOString();
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return {
    port: server.address().port,
    requests,
    other,
    runner: () => requests.filter((r) => r.kind === 'runner'),
    steps: () => requests.filter((r) => r.kind === 'step'),
    stop: () => new Promise((r) => { for (const res of open) res.destroy(); server.close(() => r()); }),
  };
}

// ---------------------------------------------------------------- the daemon
//
// Runs the built daemon until until(fx) holds or timeoutMs passes, then stops it.
export async function daemon(fx, m, { until = () => false, timeoutMs = 60000, interval = 2, settleMs = 0 } = {}) {
  const args = [fx.cliPath ?? CLI, 'daemon', '--manifest', fx.manifest, '--interval', String(interval), '--runtime', 'in-process', '--state', fx.statePath];
  const child = spawn(process.execPath, args, { cwd: fx.dir, env: fx.env(m?.port), stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  child.stderr.on('data', (d) => (out += d));
  const exited = new Promise((r) => child.on('exit', r));
  const start = Date.now();
  let met = false;
  while (Date.now() - start < timeoutMs) {
    await sleep(250);
    try { if (until(fx)) { met = true; break; } } catch {}
    if (child.exitCode !== null) break;
  }
  if (met && settleMs) await sleep(settleMs);
  child.kill('SIGTERM');
  const t = setTimeout(() => child.kill('SIGKILL'), 8000);
  await exited;
  clearTimeout(t);
  try { fs.rmSync(`${fx.statePath}.lock`, { force: true }); } catch {}
  fs.appendFileSync(path.join(fx.dir, 'daemon.log'), out);
  return { out, met, ms: Date.now() - start };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- red, then green
//
// Same contract and output as _lib.mjs's clause(), for async legs: the broken
// leg must throw (red), the correct leg must not (green).
//
// ✏ 2026-10-02 (phase 42 verification, ADR-0061 D1): with PROBE_REAL_ONLY=1 the
// broken leg is not run and the clause does its real run only. run.mjs sets it,
// because the one command does real runs only; a probe owed a break run is run
// on its own, without it. The output says which.
export const REAL_ONLY = process.env.PROBE_REAL_ONLY === '1';
const results = [];
export async function clause(id, wording, { broken, correct, unproven }) {
  let redOk = false, redDetail = '';
  if (unproven) {
    redDetail = `NO BREAK STEP — ${unproven}`;
  } else if (REAL_ONLY) {
    redDetail = 'real run only (PROBE_REAL_ONLY=1); this probe was proved able to fail by an earlier check';
  } else {
    try { await broken(); redDetail = 'the assertion still held on the broken setup'; } catch (e) { redOk = true; redDetail = e.message; }
  }
  let greenOk = false, greenDetail = '';
  try { await correct(); greenOk = true; greenDetail = 'assertion held'; } catch (e) { greenDetail = e.message; }
  const verdict = unproven ? (greenOk ? 'PASS-UNPROVEN' : 'FAIL') : REAL_ONLY ? (greenOk ? 'PASS' : 'FAIL') : !redOk ? 'INSTRUMENT-BROKEN' : greenOk ? 'PASS' : 'FAIL';
  console.log(`=== ${id} — ${wording}`);
  console.log(`    break leg: ${unproven ? 'none' : REAL_ONLY ? 'not run' : redOk ? 'RED (as required)' : 'GREEN — instrument broken'} — ${oneLine(redDetail)}`);
  console.log(`    green leg: ${greenOk ? 'PASS' : 'FAIL'} — ${oneLine(greenDetail)}`);
  results.push({ id, verdict });
  return verdict;
}
// A clause this pass can report on but not decide here (a real model is needed).
export function blocked(id, wording, why) {
  console.log(`=== ${id} — ${wording}`);
  console.log(`    BLOCKED — ${why}`);
  results.push({ id, verdict: 'BLOCKED' });
}
const oneLine = (s) => String(s).replace(/\s+/g, ' ').slice(0, 600);
export function assert(cond, message) { if (!cond) throw new Error(message); }
export function finish(criterionId) {
  const decided = results.filter((r) => r.verdict !== 'BLOCKED');
  const bad = decided.filter((r) => r.verdict !== 'PASS' && r.verdict !== 'PASS-UNPROVEN');
  const verdict = bad.some((r) => r.verdict === 'INSTRUMENT-BROKEN') ? 'INSTRUMENT-BROKEN' : bad.length ? 'FAIL' : decided.length === 0 ? 'BLOCKED' : 'PASS';
  const nb = results.length - decided.length;
  console.log(`--- ${criterionId}: ${verdict} (${results.length} clause labels, ${decided.length - bad.length} passing${nb ? `, ${nb} blocked` : ''}${REAL_ONLY ? ', real run only' : ''})`);
  process.exit(verdict === 'PASS' ? 0 : verdict === 'BLOCKED' ? 3 : 1);
}
