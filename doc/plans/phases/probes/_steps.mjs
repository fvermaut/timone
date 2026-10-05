// Verifier instrument (stage 7 artifact), written 2026-10-03 for phase 43's verification.
//
// What a STEP SESSION can do to the default branch, observed from outside — PRD-05.R3's
// title ("nothing reaches a default branch without a yes from a named person") applied to
// the sessions the runner starts, not only to the runner's own actions. Built from what the
// built app was seen to do and hand over, never from its source or its tests:
//
//   stepSession()  runs the BUILT daemon (in-process runtime, _rig.mjs) and lets the fake
//                  model's step session run real Bash commands; returns each tool result.
//                  The fixture root gets the same three hooks a timone root declares in
//                  .claude/settings.json, pointed at the build under test, and a `dist` link,
//                  because the guard's hooks call `<root>/dist/cli.js`.
//   boxScript()    runs the BUILT daemon in container mode against a stand-in `docker` that
//                  records what it is handed (argv, the run's declared env) and starts nothing.
//   boxReplay()    runs the captured box script for real, outside any container: the only
//                  change is the paths `/workspace/timone` (moved into a scratch folder) and
//                  `/usr/local/bin/gh` (moved to a stand-in that records calls), and
//                  `claude` is a stand-in that runs the commands the probe gives it. Timone is
//                  cloned from this repository at the commit asked for, installed and built,
//                  exactly as the script does in a box. Nothing reaches GitHub: the project
//                  remote is a local bare repository.
//   hookCli()      runs one guardrails hook with a hook payload on stdin.
//
// Needs `npm run build` first. Uses the network only for the box script's own `npm ci`.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fixture, model, daemon, act, say, bash, sleep, REPO_ROOT } from './_rig.mjs';

export const BEFORE_PHASE_43 = 'b495bb682143272ac138e4bdd682aca828ec4dd9';
export const N = 12;
export const BR = 'timone/12-add-a-count-of-open-to-dos';
const G = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

function plantHooks(fx) {
  fs.symlinkSync(path.dirname(fx.cliPath), path.join(fx.dir, 'dist'));
  const hook = (sub) => [{ hooks: [{ type: 'command', command: `node "${fx.cliPath}" guardrails ${sub} --root "${fx.dir}" --state "${fx.statePath}"` }] }];
  fs.mkdirSync(path.join(fx.dir, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(fx.dir, '.claude', 'settings.json'), JSON.stringify({ hooks: { SessionStart: hook('baseline'), PreToolUse: hook('guard'), Stop: hook('check') } }, null, 2));
}

// commands: (fx) => [bash command, ...]. Returns { fx, outs, after, brief, mainBefore }.
// `after` is the first message the step received after its last command — the Stop hook's
// feedback when the check handed a finding back.
export async function stepSession({ cli, stage = 'execution', commands, waitForStop = false }) {
  const fx = fixture({ issues: { fixture: { [N]: {} } }, cli });
  plantHooks(fx);
  const cmds = commands(fx);
  const mainBefore = fx.remoteHead('main');
  const outs = [];
  let first, brief, after;
  const m = await model({
    runner: (c) => (c.turn > 0 ? say() : act('start_step', { stage, instructions: 'probe', reason: 'probe', skipReason: 'probe: verifier fixture' })),
    step: (c) => {
      first ??= c.sid;
      if (c.sid !== first) return say('done');
      brief ??= c.brief;
      if (c.turn > 0 && c.turn <= cmds.length) outs.push(c.last);
      else if (c.turn > cmds.length) after ??= c.last;
      if (c.turn < cmds.length) return bash(cmds[c.turn]);
      return say('done');
    },
  });
  await daemon(fx, m, {
    until: () => outs.length >= cmds.length && (!waitForStop || after !== undefined || fx.record(N).some((e) => e.kind === 'step-ended')),
    timeoutMs: 120000,
    settleMs: waitForStop ? 4000 : 1500,
  });
  await m.stop();
  return { fx, outs, after: after ?? '', brief: brief ?? '', mainBefore };
}

// Starts the built daemon in container mode against a stand-in docker. envFile: lines for the
// project's run environment file, or null. Returns { fx, script, env, argv, decision }.
export async function boxScript({ cli, envFile = null }) {
  const fx = fixture({ issues: { fixture: { [N]: {} } }, cli, timoneRepo: true });
  fs.symlinkSync(path.dirname(fx.cliPath), path.join(fx.dir, 'dist'));
  // The daemon builds a box from the remotes: its root needs an origin that holds its commit.
  G(fx.dir, 'remote', 'add', 'origin', 'https://github.com/probe-owner/timone.git');
  G(fx.dir, 'push', '-q', '-f', path.join(fx.dir, 'remote', 'timone.git'), 'HEAD:main');
  G(fx.dir, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  // git: the daemon's own clones name github.com; send them to the local bare remotes.
  fs.writeFileSync(path.join(fx.dir, 'bin', 'git'), `#!/bin/bash
case "$*" in *"remote get-url origin") exec /usr/bin/git "\${@:1:$#-3}" config --get remote.origin.url;; esac
exec /usr/bin/git -c url.${fx.dir}/remote/fixture.git.insteadOf=https://github.com/probe-owner/fixture.git -c url.${fx.dir}/remote/timone.git.insteadOf=https://github.com/probe-owner/timone.git "$@"
`);
  if (envFile) {
    fs.mkdirSync(path.join(fx.dir, '.timone', 'env'), { recursive: true });
    fs.writeFileSync(path.join(fx.dir, '.timone', 'env', 'fixture.env'), envFile.join('\n') + '\n');
  }
  const log = path.join(fx.dir, 'docker.log');
  fs.writeFileSync(path.join(fx.dir, 'bin', 'docker'), `#!/bin/sh
case "$1" in run)
  { echo "ENV TIMONE_RUN_PROJECT=\${TIMONE_RUN_PROJECT-<unset>} TIMONE_RUN_BRANCH=\${TIMONE_RUN_BRANCH-<unset>}"; for a in "$@"; do printf '%s\\n\\036\\n' "$a"; done; } > "${log}"
  cat > /dev/null;;
esac
exit 0
`);
  fs.chmodSync(path.join(fx.dir, 'bin', 'docker'), 0o755);
  const m = await model({ runner: (c) => (c.turn > 0 ? say() : act('start_step', { stage: 'execution', instructions: 'probe', reason: 'probe', skipReason: 'probe: verifier fixture' })) });
  const env = { ...fx.env(m.port), CLAUDE_CODE_OAUTH_TOKEN: 'sk-ant-oat01-probe-dummy' };
  const child = spawn(process.execPath, [fx.cliPath, 'daemon', '--manifest', fx.manifest, '--interval', '2', '--runtime', 'container', '--state', fx.statePath], { cwd: fx.dir, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  child.stderr.on('data', (d) => (out += d));
  const start = Date.now();
  // ✏ 2026-10-05 (phase 49 verification): the planner's gate refuses the build's first try
  // (PRD-07.R5) and the rig tries again once the planner lets it, so that refusal is not the
  // decision waited for here.
  const decided = () => fx.record(N).some((e) => e.kind === 'decision' && e.action === 'start_step' && !/The planner has not decided/.test(e.detail ?? ''));
  while (Date.now() - start < 60000 && !(fs.existsSync(log) && decided()) && !(decided() && Date.now() - start > 8000)) await sleep(250);
  await sleep(500);
  child.kill('SIGTERM');
  await sleep(1000);
  child.kill('SIGKILL');
  await m.stop();
  const decision = fx.record(N).find((e) => e.kind === 'decision' && e.action === 'start_step' && !/The planner has not decided/.test(e.detail ?? ''))?.detail ?? '';
  if (!fs.existsSync(log)) return { fx, script: null, envLine: '', argv: [], decision, out };
  const [envLine, ...rest] = fs.readFileSync(log, 'utf8').split('\n');
  const argv = rest.join('\n').split('\n\x1e\n').slice(0, -1);
  const script = argv[argv.indexOf('-c') + 1] ?? null;
  return { fx, script, envLine, argv, decision, out };
}

// Runs a captured box script outside any container. agent: bash lines the stand-in `claude`
// runs inside the project clone. timoneCommit: the Timone commit the box checks out and builds.
export function boxReplay({ script, timoneCommit, projectRemote, branch = BR, project = 'fixture', agent }) {
  const box = fs.mkdtempSync(path.join(process.env.PROBE_TMP || os.tmpdir(), 'prd05-box-'));
  fs.mkdirSync(path.join(box, 'home'));
  fs.mkdirSync(path.join(box, 'fakebin'));
  const ran = path.join(box, 'agent-ran');
  fs.writeFileSync(path.join(box, 'fakebin', 'claude'), ['#!/bin/bash', 'cat > /dev/null', `touch "${ran}"`, `cd "${box}/ws/projects/${project}"`, ...agent, ''].join('\n'));
  fs.chmodSync(path.join(box, 'fakebin', 'claude'), 0o755);
  // gh: the box's wrapper runs /usr/local/bin/gh by absolute path. That path is moved to a
  // stand-in that records the call and answers nothing, so no gh call leaves the machine.
  // ✏ 2026-10-03: added after a break-leg run of the older box script sent one contents write
  // to api.github.com with this file's dummy token (answered 401, nothing changed).
  const ghLog = path.join(box, 'gh.log');
  fs.writeFileSync(path.join(box, 'fakebin', 'gh'), `#!/bin/sh\nprintf '%s\\n' "$*" >> "${ghLog}"\necho "stand-in gh reached: $*"\nexit 0\n`);
  fs.chmodSync(path.join(box, 'fakebin', 'gh'), 0o755);
  const moved = script.split('/workspace/timone').join(`${box}/ws`).split('/usr/local/bin/gh').join(path.join(box, 'fakebin', 'gh'));
  const env = {
    HOME: path.join(box, 'home'),
    PATH: `${path.join(box, 'fakebin')}:/usr/local/bin:/usr/bin:/bin`,
    TIMONE_REMOTE: REPO_ROOT,
    TIMONE_COMMIT: timoneCommit,
    PROJECT_REMOTE: projectRemote,
    PROJECT_BRANCH: branch,
    TIMONE_RUN_PROJECT: project,
    TIMONE_RUN_BRANCH: branch,
    TIMONE_MODEL: 'probe',
    GH_TOKEN: 'probe-not-a-token',
  };
  let code = 0, out = '';
  try {
    out = execFileSync('sh', ['-c', moved], { cwd: box, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 15 * 60 * 1000 });
  } catch (e) {
    code = e.status ?? 1;
    out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
  }
  const agentRan = fs.existsSync(ran);
  const ghCalls = fs.existsSync(ghLog) ? fs.readFileSync(ghLog, 'utf8').split('\n').filter(Boolean) : [];
  if (!process.env.PROBE_KEEP) fs.rmSync(box, { recursive: true, force: true });
  return { code, out, agentRan, ghCalls };
}

// One guardrails hook, with a hook payload on stdin. env: extra environment (the box's declaration).
export function hookCli(cli, sub, fx, payload, env = {}) {
  try {
    const out = execFileSync(process.execPath, [cli, 'guardrails', sub, '--root', fx.dir, '--state', fx.statePath], {
      cwd: fx.dir, input: JSON.stringify(payload), encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, TIMONE_RUN_PROJECT: '', TIMONE_RUN_BRANCH: '', ...env },
    });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

export function plantStatusCommit(fx, where, sid) {
  const clone = path.join(fx.dir, 'projects', 'fixture');
  if (where !== 'main') G(clone, 'checkout', '-q', '-B', where);
  fs.writeFileSync(path.join(clone, 'STATUS.md'), '# Status\n');
  G(clone, 'add', '-A');
  G(clone, '-c', 'user.email=p@example.invalid', '-c', 'user.name=p', 'commit', '-q', '-m', `docs: STATUS.md — probe\n\nTimone-Stage: verification\nTimone-Session: ${sid}`);
  if (where !== 'main') G(clone, 'checkout', '-q', 'main');
}

// A run in the ledger, in the shape the daemon itself writes (status `active`).
export function plantRun(fx, sid, branch = BR) {
  const now = new Date().toISOString();
  fs.writeFileSync(fx.statePath, JSON.stringify({ version: 1, runs: [{ id: `fixture#${N}/1`, project: 'fixture', ticket: N, seq: 1, status: 'active', stage: 'verification', branch, sessionId: sid, flags: [], createdAt: now, updatedAt: now }] }));
}
