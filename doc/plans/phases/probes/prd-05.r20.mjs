// Probe for PRD-05.R20 — The old code between steps is removed once every project runs on the runner.
// Stage 7 artifact, authored 2026-10-02 (phase 41 verification, timone#166) from the register alone.
// First check of this criterion.
//
// Criterion (verbatim): once no project in `timone.yaml` runs on the current daemon, the code that
// chooses the next step, reads a step's end from an exact line, and decides where a run waits is
// deleted. The ADRs that ADR-0060 lists as superseded get their status lines changed in that same
// pull request. `process.md` and the step skills say that the order is the default, and describe
// the runner.
//
// The criterion is one bullet; its parts are labelled clause 1 to 4 below, in its own order.
//
// No source is read. Deleted code is observed through what it used to do: the build from just
// before phase 41 (_old-build.mjs) still has it, and runs a project with no `driver` line on it.
// Every behaviour check runs that build as its break leg and must go red there. The documents are
// read mechanically: ADR-0060's lines that name what it supersedes, the status line of each ADR it
// names, process.md, and the step skills. The break legs read the same files as they stood before
// phase 41. The probe prints ADR numbers and status lines, never more of an ADR.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import { execFileSync } from 'node:child_process';
import { oldBuild, BEFORE_PHASE_41 } from './_old-build.mjs';
import { fixture, model, daemon, act, say, sleep, clause, assert, finish, REPO_ROOT, CLI, OPERATOR } from './_rig.mjs';

const OLD = oldBuild();
const N = 7;
const git = (...a) => execFileSync('git', ['-C', REPO_ROOT, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

// ---------------------------------------------------------------- one run, on each build
//
// A project with no `driver` line, one marked ticket. The fake model plays the runner:
//   wake 0 (new ticket)   → start sorting the request (triage)
//   wake 1 (a step ended) → start planning: not the default next step, which is the interview
//   any later wake        → do nothing
// Every step ends with the single word "done": no closing line, nothing posted on the ticket.
// When the run has gone quiet, a named person comments on the ticket.
const COMMENT = 'PROBE-R20: where does this stand?';
async function aRun(cliPath) {
  const fx = fixture({ issues: { fixture: { [N]: {} } }, cli: cliPath });
  const m = await model({
    runner: (c) => {
      if (c.turn > 0) return say();
      if (c.wake === 0) return act('start_step', { stage: 'triage', instructions: 'sort it', reason: 'probe: a new ticket', skipReason: 'probe' });
      if (c.wake === 1) return act('start_step', { stage: 'planning', instructions: 'plan it', reason: 'probe: planning next', skipReason: 'probe: the requirements are already written' });
      return say();
    },
    step: () => say('done'),
  });
  // Until the run has gone quiet: two steps ended and the runner woke after the second, or (the old
  // build) nothing has moved for a while.
  const quiet = () => {
    const rec = fx.record(N);
    return rec.filter((e) => e.kind === 'step-ended').length >= 2 && rec.filter((e) => e.kind === 'runner-ended').length >= 3;
  };
  await daemon(fx, m, { until: quiet, timeoutMs: 30000, settleMs: 4000 });
  const before = { runner: m.runner().length, woke: fx.record(N).filter((e) => e.kind === 'woke').length };
  fx.comment(N, OPERATOR, COMMENT);
  await daemon(fx, m, { until: () => fx.record(N).filter((e) => e.kind === 'woke').length > before.woke && m.runner().length > before.runner, timeoutMs: 20000, settleMs: 3000 });
  await m.stop();
  const rec = fx.record(N);
  const stageOf = (q) => (q.brief.match(/Timone-Stage:\s*([a-z-]+)/) || [])[1] ?? '?';
  const stepSids = [...new Set(m.steps().map((q) => q.sid))];
  const r = {
    runnerRequests: m.runner().length,
    stepSessions: stepSids.map((sid) => stageOf(m.steps().find((q) => q.sid === sid))),
    started: rec.filter((e) => e.kind === 'step-started').map((e) => e.stage),
    decisions: rec.filter((e) => e.kind === 'decision' && e.action === 'start_step').length,
    ended: rec.filter((e) => e.kind === 'step-ended'),
    wokeAfterEnd: rec.filter((e, i) => e.kind === 'woke' && rec.slice(0, i).some((x) => x.kind === 'step-ended') && e.events.some((t) => /ended/i.test(t))).length,
    status: fx.run(N)?.status,
    failure: fx.run(N)?.failure,
    wait: fx.run(N)?.wait,
    commentReachedRunner: m.runner().slice(before.runner).some((q) => q.brief.includes(COMMENT) || q.last.includes(COMMENT)),
    timonePosts: (fx.issue(N)?.comments ?? []).filter((c) => c.author !== OPERATOR).length,
  };
  fx.cleanup();
  return r;
}
const now = await aRun(CLI);
const old = await aRun(OLD);
const show = (r) => `runner requests ${r.runnerRequests}; step sessions [${r.stepSessions.join(', ')}]; steps the record shows started [${r.started.join(', ')}], by ${r.decisions} runner decision(s); run ${r.status}${r.failure ? ` ("${r.failure}")` : ''}`;
console.log(`    (this build: ${show(now)})`);
console.log(`    (the build before phase 41: ${show(old)})`);

// ---------------------------------------------------------------- clause 1
const realManifest = fs.readFileSync(path.join(REPO_ROOT, 'timone.yaml'), 'utf8');
function load(cliPath, text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-r20-'));
  fs.writeFileSync(path.join(dir, 'timone.yaml'), text);
  let r;
  try { r = { code: 0, out: execFileSync(process.execPath, [cliPath, 'projects', 'list'], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] }).toString() }; }
  catch (e) { r = { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }; }
  fs.rmSync(dir, { recursive: true, force: true });
  return r;
}
const withDriverLine = realManifest.replace(/(\n  timone:\n)/, '$1    driver: daemon\n');
function assertNoProjectOnTheDaemon(cliPath, r) {
  const entries = Object.entries(YAML.parse(realManifest).projects ?? {});
  assert(entries.length > 0, 'the repository\'s timone.yaml declares no project');
  const lined = entries.filter(([, p]) => p && 'driver' in p).map(([n]) => n);
  assert(lined.length === 0, `entries that still choose a driver: ${lined.join(', ')}`);
  const l = load(cliPath, realManifest);
  assert(l.code === 0, `the repository's timone.yaml does not load: ${l.out.trim()}`);
  assert(withDriverLine !== realManifest, 'probe: could not plant a driver line on the timone entry');
  const back = load(cliPath, withDriverLine);
  assert(back.code !== 0, 'a driver line putting the timone entry back on the current daemon was accepted');
  assert(r.runnerRequests > 0, 'a project with no driver line was not driven by the runner: no runner session started');
}
await clause('PRD-05.R20 clause 1', 'no project in timone.yaml runs on the current daemon', {
  broken: async () => assertNoProjectOnTheDaemon(OLD, old),
  correct: async () => assertNoProjectOnTheDaemon(CLI, now),
});

// ---------------------------------------------------------------- clause 2
await clause('PRD-05.R20 clause 2a', 'the code that chooses the next step is deleted: only the steps the runner chose run, in its order, and none follows when it chooses none', {
  broken: async () => assertRunnerChose(old),
  correct: async () => assertRunnerChose(now),
});
function assertRunnerChose(r) {
  assert(r.stepSessions.length === r.decisions, `${r.stepSessions.length} step session(s) ran, and the runner started ${r.decisions}`);
  assert(JSON.stringify(r.started) === JSON.stringify(['triage', 'planning']), `the steps started were [${r.started.join(', ')}]; the runner chose [triage, planning], and then nothing`);
}
await clause('PRD-05.R20 clause 2b', 'the code that reads a step\'s end from an exact line is deleted: a step that ends with no closing line still ends, and the runner wakes on it', {
  broken: async () => assertEndRead(old),
  correct: async () => assertEndRead(now),
});
function assertEndRead(r) {
  assert(r.status !== 'failed', `the run was failed: "${r.failure ?? ''}"`);
  assert(r.ended.length === r.stepSessions.length && r.ended.length > 0, `${r.stepSessions.length} step(s) ran and ${r.ended.length} end(s) were recorded`);
  assert(r.wokeAfterEnd >= r.ended.length, `${r.ended.length} step(s) ended and the runner woke on ${r.wokeAfterEnd} of them`);
}
await clause('PRD-05.R20 clause 2c', 'the code that decides where a run waits is deleted: the quiet run waits on the runner, and a named person\'s comment reaches it', {
  broken: async () => assertWaitsOnRunner(old),
  correct: async () => assertWaitsOnRunner(now),
});
function assertWaitsOnRunner(r) {
  assert(r.status !== 'failed', `the run was failed by code: "${r.failure ?? ''}"`);
  assert(r.commentReachedRunner, 'the named person\'s comment did not reach the runner');
}
console.log(`    (this build's quiet run: ${now.status}, waiting ${JSON.stringify(now.wait ?? null)}; Timone's comments on the ticket: ${now.timonePosts}. The build before phase 41: ${old.status}, Timone's comments: ${old.timonePosts})`);

// ---------------------------------------------------------------- clause 3
const ADR_DIR = 'doc/adr';
const adrFiles = fs.readdirSync(path.join(REPO_ROOT, ADR_DIR)).filter((f) => /^\d{4}-.*\.md$/.test(f));
const fileOf = (n) => adrFiles.find((f) => f.startsWith(`${n}-`));
const adr60 = fileOf('0060');
assert(adr60, 'ADR-0060 is not in doc/adr/');
const SUPERSEDED = (() => {
  const s = new Set();
  for (const line of fs.readFileSync(path.join(REPO_ROOT, ADR_DIR, adr60), 'utf8').split('\n')) {
    if (!/supersed/i.test(line)) continue;
    for (const m of line.matchAll(/ADR-(\d{4})/g)) s.add(m[1]);
    for (const m of line.matchAll(/\]\((?:[./]*)(?:doc\/adr\/)?(\d{4})-[^)]*\.md\)/g)) s.add(m[1]);
  }
  s.delete('0060');
  return [...s].sort();
})();
function statusLine(text) {
  const m = text.match(/^(?:>\s*)?(?:-\s*)?\*\*Status:?\*\*:?[ \t]*(.+)$/im) || text.match(/^(?:>\s*)?Status:[ \t]*(.+)$/im);
  if (m) return m[1].trim();
  const h = text.match(/^#+\s*Status\s*\n+([^\n]+)/im);
  return h ? h[1].trim() : '';
}
const changedOnBranch = new Set(git('diff', '--name-only', BEFORE_PHASE_41, 'HEAD').split('\n').filter(Boolean));
function assertStatusLines(read, changed) {
  assert(SUPERSEDED.length > 0, 'no superseded ADR was found in ADR-0060\'s lines');
  const bad = [];
  for (const n of SUPERSEDED) {
    const f = fileOf(n);
    if (!f) { bad.push(`ADR-${n}: no file`); continue; }
    const st = statusLine(read(path.join(ADR_DIR, f)));
    if (!/supersed/i.test(st) || !/0060/.test(st)) bad.push(`ADR-${n}: "${st.slice(0, 120)}"`);
    if (!changed.has(path.join(ADR_DIR, f))) bad.push(`ADR-${n}: not changed in this pull request`);
  }
  assert(bad.length === 0, bad.join('; '));
}
const readNow = (p) => fs.readFileSync(path.join(REPO_ROOT, p), 'utf8');
const readBefore = (p) => { try { return git('show', `${BEFORE_PHASE_41}:${p}`); } catch { return ''; } };
await clause('PRD-05.R20 clause 3', 'the ADRs that ADR-0060 lists as superseded get their status lines changed in that same pull request', {
  broken: async () => assertStatusLines(readBefore, new Set()),
  correct: async () => assertStatusLines(readNow, changedOnBranch),
});
console.log(`    (ADR-0060 names as superseded: ${SUPERSEDED.map((n) => `ADR-${n}`).join(', ')})`);
for (const n of SUPERSEDED) console.log(`    (ADR-${n} status line: "${statusLine(readNow(path.join(ADR_DIR, fileOf(n)))).slice(0, 160)}")`);

// ---------------------------------------------------------------- clause 4
// The step skills: the owning skill of each stage a run passes through, stages 1 to 8 of
// process.md's table ("each step is a session running a stage skill"). Stage 0, onboarding, is
// once per project and not a step of a run.
function stepSkills(processText) {
  const skills = [];
  for (const line of processText.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 5 || !/^\d+$/.test(cells[1])) continue;
    const n = Number(cells[1]);
    if (n < 1 || n > 8) continue;
    for (const m of cells[3].matchAll(/timone-[a-z-]+/g)) skills.push(m[0]);
  }
  return [...new Set(skills)];
}
const SKILLS = stepSkills(readNow('process.md'));
const retryGivenToRun = (text) => text.split('\n').filter((l) => /timone retry/.test(l) && !/removed|gone|no longer|was deleted/i.test(l));
function assertProcessDoc(read) {
  const t = read('process.md');
  assert(/\bdefault order\b|\border\b[^.\n]{0,80}\bdefault\b/i.test(t), 'process.md does not say the order is the default');
  assert(/\brunner\b[^.\n]{0,80}\b(decides|chooses)\b/i.test(t), 'process.md does not say a runner decides or chooses the steps');
  const r = retryGivenToRun(t);
  assert(r.length === 0, `process.md still gives \`timone retry\` to run: "${r[0]?.slice(0, 120)}"`);
}
await clause('PRD-05.R20 clause 4a', 'process.md says that the order is the default, and describes the runner', {
  broken: async () => assertProcessDoc(readBefore),
  correct: async () => assertProcessDoc(readNow),
});
// ✏ 2026-10-02 (phase 41 verification, iteration 3): 4b now also checks that each step skill says the
// order is the default, as the criterion's words ask of `process.md` "and the step skills". The first
// pass checked only that each names the runner, and said so. A skill passes this part when it says
// "default order", the order is the default, or that the runner chooses the next step and one
// "is the default one" — the words several skills use.
const SAYS_DEFAULT = /\bdefault order\b|\border\b[^.\n]{0,80}\bdefault\b|\bis the default one\b/i;
function assertSkills(read) {
  assert(SKILLS.length >= 8, `process.md's table named only ${SKILLS.length} step skills: ${SKILLS.join(', ')}`);
  const bad = [];
  for (const s of SKILLS) {
    const t = read(`.claude/skills/${s}/SKILL.md`);
    if (!t) { bad.push(`${s}: no SKILL.md`); continue; }
    if (!/\brunner\b/i.test(t)) bad.push(`${s}: never names the runner`);
    if (!SAYS_DEFAULT.test(t)) bad.push(`${s}: does not say the order is the default`);
    if (retryGivenToRun(t).length) bad.push(`${s}: still gives \`timone retry\` to run`);
  }
  assert(bad.length === 0, bad.join('; '));
}
await clause('PRD-05.R20 clause 4b', 'the step skills say that the order is the default, and describe the runner', {
  broken: async () => assertSkills(readBefore),
  correct: async () => assertSkills(readNow),
});
const said = (s) => (readNow(`.claude/skills/${s}/SKILL.md`).match(SAYS_DEFAULT) ?? [''])[0];
console.log(`    (the step skills, from process.md's table, stages 1 to 8: ${SKILLS.join(', ')})`);
console.log(`    (each names the runner, and says the order is the default in these words: ${SKILLS.map((s) => `${s} "${said(s)}"`).join('; ')}. The words are checked, not whether the description is complete.)`);

finish('PRD-05.R20');
