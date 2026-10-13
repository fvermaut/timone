// Checks the runner asked for on timone#234 (phase 61), beyond the criteria register.
// Stage 7 artifact, written 2026-10-13 by phase 61's verification.
//
// This is NOT the probe of a criterion. Phase 61 claims PRD-07.R7, which is on the `live`
// channel, so it gets no probe (its verdict is LIVE-GATE), and PRD-05.R18, which has its own
// probe. The runner's instructions for this step asked for five parts to be confirmed:
//   1. the update finds a check script named with a dash (prd-18-r12.mjs), and runs a project's
//      test:unit, test:integration and test:e2e when it has no `test` script (#235);
//   2. `update-conflicts` lists the conflicted files and marks the check scripts;
//   3. the update's record says which check scripts were joined and how;
//   4. an update that could not finish its merge is recorded as failed, and a person is asked;
//   5. the update's instructions and ADR-0066 no longer forbid opening a check script during an
//      update, and no other written rule still says so.
// Written from those words, from the built commands' own --help and output, and from what the
// built daemon showed a fake forge and a fake model. No source and no test source was read.
// Part 2's "a test for a check script changed on both sides" is a test title, read from the
// suite's printed output in the report, not here.
//
// Every check has a break leg that must go red. Parts 1 and 2 run the built commands against
// throwaway git repositories. Parts 3 and 4 run the built daemon (_rig.mjs) through a chore to
// its pull request, move main by a change to the same check script, and let a scripted update
// step do one of three things. Part 5 reads the written rules, and its break leg reads the same
// files as they stand on origin/main, before phase 61.
//
//   node doc/plans/phases/probes/phase-61-requested.mjs          break leg, then real leg
//   PROBE_REAL_ONLY=1 node doc/plans/phases/probes/phase-61-requested.mjs   real leg only
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fixture as rigFixture, model, daemon, act, say, bash, clause, assert, finish } from './_rig.mjs';
import { CLI, REPO_ROOT } from './_lib.mjs';

const GID = ['-c', 'user.email=probe@example.invalid', '-c', 'user.name=probe'];
const G = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const DIRS = [];
process.on('exit', () => { if (!process.env.PROBE_KEEP) for (const d of DIRS) fs.rmSync(d, { recursive: true, force: true }); });

// ---------------------------------------------------------------- a throwaway project
// A timone root with a manifest naming one project, `fixture`, and its clone of a bare remote.
// The remote is filled by a fetch run in it, never by a push: the container this runs in refuses
// every push that is not to its own work branch.
function project(files) {
  const dir = fs.mkdtempSync(path.join(process.env.PROBE_TMP || os.tmpdir(), 'v61-'));
  DIRS.push(dir);
  const bare = path.join(dir, 'remote', 'fixture.git');
  fs.mkdirSync(path.dirname(bare), { recursive: true });
  G(dir, 'init', '-q', '--bare', '-b', 'main', bare);
  const clone = path.join(dir, 'projects', 'fixture');
  G(dir, 'clone', '-q', bare, clone);
  const fx = { dir, clone, bare };
  write(fx, files);
  G(clone, 'add', '-A');
  G(clone, ...GID, 'commit', '-q', '--allow-empty', '-m', 'init');
  G(bare, 'fetch', '-q', clone, 'main:main');
  G(clone, 'fetch', '-q', 'origin');
  G(clone, 'remote', 'set-head', 'origin', 'main');
  fs.writeFileSync(path.join(dir, 'timone.yaml'), 'projects:\n  fixture:\n    repo_url: https://example.invalid/probe/fixture.git\n    path: projects/fixture\n    stack:\n      - typescript\n    bindings:\n      ticketing: github\n');
  return fx;
}
function write(fx, files = {}) {
  for (const [f, t] of Object.entries(files)) {
    const p = path.join(fx.clone, f);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, t);
  }
}
function commit(fx, branch, files, msg = 'probe') {
  try { G(fx.clone, 'checkout', '-q', branch); } catch { G(fx.clone, 'checkout', '-q', '-b', branch); }
  write(fx, files);
  G(fx.clone, 'add', '-A');
  G(fx.clone, ...GID, 'commit', '-q', '--allow-empty', '-m', msg);
  G(fx.bare, 'fetch', '-q', fx.clone, `${branch}:${branch}`);
  G(fx.clone, 'fetch', '-q', 'origin');
}
function cli(fx, args) {
  try { return { code: 0, out: execFileSync(process.execPath, [CLI, ...args], { cwd: fx.dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; }
  catch (e) { return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }; }
}
const plan = (n, ids) => `# Phase ${n}: probe\n\n> **Status:** Complete — see nothing.\n\n## Requirements\n\n| ID | Priority | Requirement (one line) |\n| -- | -------- | ---------------------- |\n${ids.map((i) => `| ${i} | MUST | probe |`).join('\n')}\n`;
const IVTRENDS_SCRIPTS = { build: 'true', 'test:unit': 'echo unit', 'test:watch': 'vitest', 'test:integration': 'echo int', 'test:unit:watch': 'vitest --watch', 'test:e2e': 'echo e2e' };

// ---------------------------------------------------------------- part 1
// A branch whose plan claims PRD-18.R12 (check script named with a dash) and PRD-18.R13 (none);
// main then gains a plan claiming PRD-19.R1, whose check script is named with a dot.
function updateChecks({ scripts, dashed }) {
  const fx = project({ 'package.json': JSON.stringify({ name: 'f', scripts }, null, 2), 'doc/plans/phases/phase-01.md': plan(1, []) });
  commit(fx, 'timone/5-x', { 'doc/plans/phases/phase-02.md': plan(2, ['PRD-18.R12', 'PRD-18.R13']), ...(dashed ? { 'doc/plans/phases/probes/prd-18-r12.mjs': 'process.exit(0);\n' } : {}) });
  const before = G(fx.clone, 'rev-parse', 'HEAD').trim();
  commit(fx, 'main', { 'doc/plans/phases/phase-03.md': plan(3, ['PRD-19.R1']), 'doc/plans/phases/probes/prd-19.r1.mjs': 'process.exit(0);\n' }, 'arrived');
  G(fx.clone, 'checkout', '-q', 'timone/5-x');
  const r = cli(fx, ['update-checks', 'fixture', '--before', before, '--json']);
  const text = cli(fx, ['update-checks', 'fixture', '--before', before]).out;
  return { json: r.code === 0 ? JSON.parse(r.out) : null, code: r.code, text };
}
const withDash = updateChecks({ scripts: IVTRENDS_SCRIPTS, dashed: true });
const noDash = updateChecks({ scripts: IVTRENDS_SCRIPTS, dashed: false });
const noTestScripts = updateChecks({ scripts: { build: 'true', lint: 'true' }, dashed: true });
console.log(`    (update-checks, as printed: ${withDash.text.trim().replace(/\n+/g, ' | ')})`);

function assertDashFound(r) {
  const own = r.json?.own?.checks ?? [];
  const c = own.find((x) => x.id === 'PRD-18.R12');
  assert(c?.script === 'doc/plans/phases/probes/prd-18-r12.mjs', `PRD-18.R12's check script, named with a dash, is not found: ${JSON.stringify(c)}`);
  assert(own.find((x) => x.id === 'PRD-18.R13') && !own.find((x) => x.id === 'PRD-18.R13').script, 'PRD-18.R13, which has no check script, is not listed as having none');
  const arrived = (r.json?.arrived ?? []).flatMap((p) => p.checks);
  assert(arrived.find((x) => x.id === 'PRD-19.R1')?.script === 'doc/plans/phases/probes/prd-19.r1.mjs', 'the check script named with a dot, of the plan that arrived, is no longer found');
}
await clause('part 1a', 'update-checks finds a check script named with a dash (prd-18-r12.mjs), and still finds one named with a dot', {
  broken: () => assertDashFound(noDash),
  correct: () => assertDashFound(withDash),
});
function assertTestScripts(r) {
  const cmds = r.json?.testCommands;
  assert(JSON.stringify(cmds) === JSON.stringify(['npm run test:unit', 'npm run test:integration', 'npm run test:e2e']), `the test commands of a project with test:unit, test:integration, test:e2e and two watch scripts, and no test script, are ${JSON.stringify(cmds)}`);
}
await clause('part 1b', 'a project with no `test` script: the update runs test:unit, test:integration and test:e2e, in that order, and no watch script', {
  broken: () => assertTestScripts(noTestScripts),
  correct: () => assertTestScripts(withDash),
});

// ---------------------------------------------------------------- part 2
// Both sides change: a source file; a check script named with a dot; one named with a dash that
// both sides added; a helper in the probe folder; a file in Timone's baseline probe folder.
function conflicts({ checksToo }) {
  const base = { 'package.json': '{"name":"f","scripts":{"test":"true"}}', 'src/a.js': 'base\n' };
  const probeFiles = (side) => ({ 'doc/plans/phases/probes/prd-07.r7.mjs': `${side}\n`, 'doc/plans/phases/probes/_lib.mjs': `${side}\n`, 'standards/baseline/probes/keyboard.mjs': `${side}\n` });
  const fx = project({ ...base, ...(checksToo ? probeFiles('base') : {}) });
  commit(fx, 'timone/5-x', { 'src/a.js': 'branch\n', ...(checksToo ? { ...probeFiles('branch'), 'doc/plans/phases/probes/prd-20-r1.mjs': 'branch added\n' } : {}) });
  commit(fx, 'main', { 'src/a.js': 'main\n', ...(checksToo ? { ...probeFiles('main'), 'doc/plans/phases/probes/prd-20-r1.mjs': 'main added\n' } : {}) });
  G(fx.clone, 'checkout', '-q', 'timone/5-x');
  const idle = cli(fx, ['update-conflicts', 'fixture']);
  try { G(fx.clone, 'merge', '--no-edit', 'origin/main'); } catch {}
  const r = cli(fx, ['update-conflicts', 'fixture', '--json']);
  return { idle, json: r.code === 0 ? JSON.parse(r.out) : null, text: cli(fx, ['update-conflicts', 'fixture']).out };
}
const both = conflicts({ checksToo: true });
const codeOnly = conflicts({ checksToo: false });
console.log(`    (update-conflicts, as printed: ${both.text.trim().replace(/\n+/g, ' | ')})`);
console.log(`    (with no merge in progress: exit ${both.idle.code}, "${both.idle.out.trim()}")`);
function assertMarked(r) {
  const checks = r.json?.checkScripts ?? [];
  const byPath = Object.fromEntries(checks.map((c) => [c.path, c.id]));
  assert(byPath['doc/plans/phases/probes/prd-07.r7.mjs'] === 'PRD-07.R7', `a check script both sides changed is not marked with its requirement: ${JSON.stringify(checks)}`);
  assert(byPath['doc/plans/phases/probes/prd-20-r1.mjs'] === 'PRD-20.R1', `a check script both sides added, named with a dash, is not marked: ${JSON.stringify(checks)}`);
  assert('doc/plans/phases/probes/_lib.mjs' in byPath && 'standards/baseline/probes/keyboard.mjs' in byPath, `a helper in the probe folder, or a file in the baseline probe folder, is not with the check scripts: ${JSON.stringify(checks)}`);
  assert(JSON.stringify(r.json?.others) === JSON.stringify(['src/a.js']), `the other conflicted files are ${JSON.stringify(r.json?.others)}, not src/a.js alone`);
}
await clause('part 2', 'update-conflicts lists every conflicted file, and marks the check scripts (with their requirement) apart from the others', {
  broken: () => assertMarked(codeOnly),
  correct: () => assertMarked(both),
});

// ---------------------------------------------------------------- parts 3 and 4
// The built daemon walks a chore to its pull request; the build put a check script on the branch.
// Main then changes the same check script, so the update's merge stops on it. The update step
// is scripted. mode: 'joined' joins the script, writes an entry naming the join, publishes;
// 'joined-none' does the same with `Check scripts joined: none`; 'abort' stops the merge and
// writes the entry for a merge that could not be finished; 'nothing' writes nothing.
const N = 12;
const PLAN1 = plan(1, ['PRD-01.R1']);
const whyOf = (q) => q.brief.split('## The ticket')[0];
async function walk(mode) {
  const fx = rigFixture({ issues: { fixture: { [N]: { labels: ['timone', 'triage:chore'] } } }, projects: { fixture: { files: { 'package.json': '{"name":"f","scripts":{"test":"true"}}', 'doc/plans/phases/probes/prd-01.r1.mjs': '// clause 1\ncheck("a");\n' } } } });
  const steps = ['triage', 'planning', 'execution', 'verification', 'delivery'];
  let i = 0;
  let updates = 0;
  const why = [];
  const P = 'projects/fixture';
  const m = await model({
    runner: (c) => {
      if (c.turn > 0) return say();
      const w = whyOf(c);
      why.push(w);
      if (/moved on/.test(w) && updates === 0) { updates++; return act('start_step', { stage: 'update', instructions: 'probe: update', reason: 'probe: behind' }); }
      if (i < steps.length && /picked up|ended: it succeeded/.test(w)) { const s = steps[i++]; return act('start_step', { stage: s, instructions: `probe: ${s}`, reason: 'probe' }); }
      return say();
    },
    step: (c) => {
      const stage = (c.brief.match(/Timone-Stage: (\S+)/) || [])[1];
      const br = fx.run(N).branch;
      if (stage === 'update') {
        const bare = path.join(fx.dir, 'remote', 'fixture.git');
        const g = `git -C ${P} -c user.email=p@x -c user.name=p`;
        const merged = mode !== 'abort';
        const joined = mode === 'joined' ? 'PRD-01.R1: kept the checks each side added, all in one script' : 'none';
        const result = merged ? 'passes' : 'does not pass — main could not be merged in: PRD-01.R1: cannot tell which check is stricter';
        const entry = [
          'sleep 2', // the entry's heading time is written in whole seconds; keep it after the step's start
          `SHA=$(git -C ${P} rev-parse --short=7 origin/main)`,
          `printf '# Phase 01 — Updates\\n\\n## Update 1 — %s\\n\\n- **Level with:** main at %s\\n- **Arrived:** 1 commit with no plan\\n- **Whole test suite:** ${merged ? 'passed — 1 test passed' : 'none — the merge could not be finished'}\\n- **Check scripts of this ticket:** ${merged ? 'passed — PRD-01.R1' : 'none — the merge could not be finished'}\\n- **Check scripts of the work that arrived:** none — no plan arrived\\n- **Fixes:** 0\\n- **Code changed:** none\\n- **Check scripts joined:** ${joined}\\n- **Result:** ${result}\\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$SHA" > ${P}/doc/plans/phases/reports/phase-01-update.md`,
          `${g} add doc/plans/phases/reports/phase-01-update.md`,
          `${g} commit -qm 'docs: update 01 — level with main'`,
          // the container refuses a push to any branch but its own: the fake forge takes the commit by a fetch run in it
          `git --git-dir ${bare} fetch -q ${path.join(fx.dir, P)} HEAD:refs/heads/${br}`,
        ].join(' && ');
        const start = `git -C ${P} fetch -q origin && git -C ${P} checkout -q -B ${br} origin/${br} && mkdir -p ${P}/doc/plans/phases/reports && (git -C ${P} merge --no-edit origin/main; true) && node ${fx.cliPath} update-conflicts fixture --manifest ${fx.manifest}`;
        const join = `printf '// clause 1\\ncheck("a");\\n// clause 2 (main)\\ncheck("m");\\n// clause 2 (branch)\\ncheck("b");\\n' > ${P}/doc/plans/phases/probes/prd-01.r1.mjs && ${g} add -A && ${g} commit -q --no-edit`;
        const cmds = { joined: [start, `${join} && ${entry}`], 'joined-none': [start, `${join} && ${entry}`], abort: [start, `git -C ${P} merge --abort && ${entry}`], nothing: [] }[mode];
        return c.turn < cmds.length ? bash(cmds[c.turn]) : say('done');
      }
      if (c.turn > 0) return say('done');
      if (stage === 'execution') fx.pushBranch(br, { 'doc/plans/phases/phase-01.md': PLAN1, 'doc/plans/phases/probes/prd-01.r1.mjs': '// clause 1\ncheck("a");\n// clause 2 (branch)\ncheck("b");\n' }, 'build');
      if (stage === 'delivery') fx.editForge((f) => { const num = f.nextNumber++; f.prs[num] = { number: num, title: 'Probe', body: 'Delivery text.', head: br, base: 'main', state: 'OPEN', createdAt: new Date().toISOString(), comments: [] }; });
      return say('done');
    },
  });
  await daemon(fx, m, { until: () => Object.values(fx.forge().prs).some((p) => p.body.includes('timone:departures')), timeoutMs: 60000, settleMs: 3000 });
  fx.pushBranch('main', { 'doc/plans/phases/probes/prd-01.r1.mjs': '// clause 1\ncheck("a");\n// clause 2 (main)\ncheck("m");\n' }, 'main moved: another ticket changed the same check script');
  const updEnded = () => fx.record(N).some((e) => e.kind === 'step-ended' && e.stage === 'update');
  await daemon(fx, m, { until: () => updEnded() && ['runner-ended', 'seen'].includes(fx.record(N).at(-1)?.kind) && why.some((w) => /up to date ended/.test(w)), timeoutMs: 90000, settleMs: 3000 });
  await m.stop();
  const ended = fx.record(N).filter((e) => e.kind === 'step-ended' && e.stage === 'update');
  const pr = Object.values(fx.forge().prs)[0];
  const section = pr?.body.match(/<!-- timone:update -->\n([\s\S]*?)<!-- \/timone:update -->/)?.[1] ?? '';
  const r = { mode, ended, section, woke: why.filter((w) => /up to date ended/.test(w)), rules: m.runner().at(-1)?.system ?? '' };
  fx.cleanup();
  return r;
}
const joined = await walk('joined');
const joinedNone = await walk('joined-none');
const aborted = await walk('abort');
const nothing = await walk('nothing');
for (const r of [joined, aborted, nothing]) {
  console.log(`    (update ${r.mode}: the step ${r.ended.map((e) => (e.ok ? 'succeeded' : `failed — "${e.error}"`)).join(', ') || 'did not end'}; the runner was told: "${(r.woke[0] ?? '').split('\n').find((l) => l.startsWith('- ')) ?? '(nothing)'}")`);
}
console.log(`    (the section at the top of the pull request after the join: ${joined.section.trim().replace(/\n+/g, ' | ')})`);

await clause('part 3', 'the update\'s record says which check scripts were joined and how, and the top of the pull request shows it', {
  broken: async () => assert(/Check scripts joined: PRD-01\.R1: kept the checks each side added/.test(joinedNone.section), `the pull request's section does not name the joined check script: ${joinedNone.section}`),
  correct: async () => assert(/Check scripts joined: PRD-01\.R1: kept the checks each side added/.test(joined.section), `the pull request's section does not name the joined check script: ${joined.section}`),
});
function assertFailedAndAsked(r) {
  assert(r.ended.length === 1 && r.ended[0].ok === false, `the update is not recorded as a step that failed: ${JSON.stringify(r.ended)}`);
  assert(r.woke.some((w) => /bringing the work up to date ended: it failed/.test(w)), 'the runner was not told the update failed');
  assert(/When it failed, the branch is still behind: say on the ticket in plain words what stopped it, and ask a named person to bring the branch level/.test(r.rules), 'the runner\'s rules do not say to ask a named person when the update failed');
}
await clause('part 4', 'an update that could not finish its merge is recorded as failed, the runner is told so, and its rules say to ask a named person', {
  broken: async () => assertFailedAndAsked(joined),
  correct: async () => {
    assertFailedAndAsked(aborted);
    assert(/merge of main at \w+ was not finished/.test(aborted.ended[0].error ?? ''), `the failure does not say the merge was not finished: "${aborted.ended[0].error}"`);
    assertFailedAndAsked(nothing);
  },
});

// ---------------------------------------------------------------- part 5
// The written rules a session follows: the skills, process.md, CONTEXT.md, README.md, CLAUDE.md
// and Timone's standards. Records (ADRs, plans, reports, PRDs) are history and are not scanned,
// except ADR-0066's status line, which the runner named.
const RULE_FILES = () => {
  const out = [];
  const walkDir = (d) => { for (const e of fs.readdirSync(path.join(REPO_ROOT, d), { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walkDir(p); else if (p.endsWith('.md')) out.push(p); } };
  walkDir('.claude');
  walkDir('standards');
  return [...out, 'process.md', 'CONTEXT.md', 'README.md', 'CLAUDE.md'].filter((f) => fs.existsSync(path.join(REPO_ROOT, f)));
};
const onBranch = (f) => fs.readFileSync(path.join(REPO_ROOT, f), 'utf8');
const onMain = (f) => { try { return G(REPO_ROOT, 'show', `origin/main:${f}`); } catch { return ''; } };
const UPDATE_SKILL = '.claude/skills/timone-update/SKILL.md';
const ADR66 = 'doc/adr/0066-the-update-is-a-step-the-runner-starts-when-an-open-pull-request-falls-behind.md';

function assertSkillAllowsJoin(read) {
  const text = read(UPDATE_SKILL);
  const bullet = text.split('\n').find((l) => /The contents of the probe folder/.test(l)) ?? '';
  assert(/exception/i.test(bullet) && /update-conflicts/.test(bullet) && /join/.test(bullet), `the update's rule on the probe folder has no exception for a check script it joins: "${bullet.slice(0, 200)}"`);
  assert(/join every check script it lists, yourself/i.test(text), 'the update\'s instructions do not tell the session to join a conflicted check script itself');
}
await clause('part 5a', 'the update\'s instructions let the session open a check script that update-conflicts names, to join it', {
  broken: () => assertSkillAllowsJoin(onMain),
  correct: () => assertSkillAllowsJoin(onBranch),
});
function assertAdrAmended(read) {
  const status = read(ADR66).split('\n').find((l) => /^- \*\*Status:\*\*/.test(l)) ?? '';
  assert(/amended/i.test(status) && /ADR-0068|0068-/.test(status) && /D4/.test(status), `ADR-0066's status line does not say ADR-0068 amends D4: "${status.slice(0, 200)}"`);
}
await clause('part 5b', 'ADR-0066 says, on its status line, that ADR-0068 amends its rule D4 for check scripts', {
  broken: () => assertAdrAmended(onMain),
  correct: () => assertAdrAmended(onBranch),
});
// The old rule, in the words it was found written: the probe folder is written (or run) only by
// the checking step, or the update never opens it — with no word of the update's exception.
const OLD_RULE = [/written and run only by/i, /only this stage writes there(?![^.]*\.[^.]*update)/i, /\bupdate\b[^.]{0,80}never (opens?|edits?|reads?)[^.]{0,40}(check script|probe)/i];
function stale(read) {
  const hits = [];
  for (const f of RULE_FILES()) {
    read(f).split('\n').forEach((l, k) => {
      if (OLD_RULE.some((re) => re.test(l)) && !/ADR-0068|joins? (a|the|that) check script/i.test(l)) hits.push(`${f}:${k + 1}: ${l.trim().slice(0, 160)}`);
    });
  }
  return hits;
}
const staleNow = stale(onBranch);
for (const h of staleNow) console.log(`    (still written: ${h})`);
await clause('part 5c', 'no other written rule still says the check scripts are written or opened only by the checking step', {
  broken: () => { const h = stale(onMain); assert(h.length === 0, `${h.length} place(s) still say it on origin/main: ${h.join(' ; ')}`); },
  correct: () => assert(staleNow.length === 0, `${staleNow.length} place(s) still say it: ${staleNow.join(' ; ')}`),
});

finish('phase 61, the runner\'s five parts');
