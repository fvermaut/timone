// Probe for PRD-05.R2 — The runner acts only through the actions code gives it.
// Stage 7 artifact, authored 2026-09-28 (phase 40) from the register alone. The tool list is
// read where it cannot lie: in the request the runner session sends to the (fake) model service.
//
// Register clauses (verbatim; clause 1 as amended 2026-09-29 at verification — this probe's
// clause 1a was rewritten from the new words the same day):
//   1. GIVEN a runner session WHEN its tools are listed
//      THEN they are exactly: start a step session with instructions, send a running step a message,
//      stop a step, post on the ticket or the pull request, set or clear the hold on a ticket,
//      record a named person's approval by naming the comment that gave it,
//      file or update a Timone issue, and end the run
//      AND none of them edits a file, runs a shell command, pushes, or merges
//   2. GIVEN the runner decides that something in the project must be fixed WHEN it acts
//      THEN it starts a step session with instructions, and every commit that follows carries
//      that session's Timone-Stage trailer
import { execFileSync } from 'node:child_process';
import { fixture, model, daemon, act, say, clause, blocked, assert, finish } from './_rig.mjs';

const N = 12;
const fx = fixture({ issues: { fixture: { [N]: {} } } });
const FIX = 'PROBE-FIX: the count shows 3 when two to-dos are open; make it count only open ones.';
const m = await model({
  runner: (c) => (c.wake === 0 && c.turn === 0 ? act('start_step', { stage: 'execution', instructions: FIX, reason: 'probe: something must be fixed', skipReason: 'probe' }) : say()),
  step: () => say('fixed'),
});
await daemon(fx, m, { until: () => fx.record(N).some((e) => e.kind === 'step-ended'), timeoutMs: 30000 });
await m.stop();
const runnerReq = m.runner()[0];
const tools = runnerReq?.tools ?? [];
const toolDefs = runnerReq ? JSON.stringify(tools) : '';
const step = m.steps()[0];
const started = fx.record(N).find((e) => e.kind === 'step-started');
console.log(`    (the runner session was started with: ${tools.join(', ')})`);

// The register's eight kinds of action, and the tool names that would carry each.
const KINDS = {
  'start a step session with instructions': /start_step$/,
  'send a running step a message': /message_step$/,
  'stop a step': /stop_step$/,
  'post on the ticket or the pull request': /__post$/,
  'set or clear the hold on a ticket': /set_hold$/,
  "record a named person's approval by naming the comment that gave it": /record_approval$/,
  'file or update a Timone issue': /(file|comment)_timone_issue$/,
  'end the run': /end_run$/,
};
function assertExactly(list) {
  for (const [kind, re] of Object.entries(KINDS)) assert(list.some((t) => re.test(t)), `no tool for "${kind}"`);
  const extra = list.filter((t) => !Object.values(KINDS).some((re) => re.test(t)));
  assert(extra.length === 0, `tools the register does not list: ${extra.join(', ')}`);
}
await clause('PRD-05.R2 clause 1a', 'the runner session\'s tools are exactly the eight actions the register lists', {
  broken: async () => assertExactly([...tools, 'Bash']),
  correct: async () => assertExactly(tools),
});

const BUILTIN = ['Bash', 'Read', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'Agent', 'Task', 'Skill', 'Workflow'];
function assertNoPower(list) {
  const builtin = list.filter((t) => BUILTIN.includes(t));
  assert(builtin.length === 0, `built-in tools present: ${builtin.join(', ')}`);
  const risky = list.filter((t) => /(edit|write|bash|shell|exec|push|merge|commit)/i.test(t));
  assert(risky.length === 0, `tools whose names edit, run, push or merge: ${risky.join(', ')}`);
}
await clause('PRD-05.R2 clause 1b', 'none of them edits a file, runs a shell command, pushes, or merges', {
  broken: async () => assertNoPower([...tools, 'Edit']),
  correct: async () => assertNoPower(tools),
});

// Clause 2 in the rig: a fix goes through a step started with the runner's instructions, and
// that step is told to put its own stage in every commit's trailer.
function assertFixThroughStep(stage) {
  assert(started?.instructions === FIX, `the step was not started with the runner's instructions: ${JSON.stringify(started)}`);
  assert(step?.brief.includes(FIX), 'the step session did not receive the runner\'s instructions');
  assert(new RegExp(`Every commit you make in this session must end with these trailers[\\s\\S]*Timone-Stage: ${stage}\\n`).test(step.brief), `the step is not told to write "Timone-Stage: ${stage}" on every commit`);
}
await clause('PRD-05.R2 clause 2a', 'a fix is a step session started with instructions, told to carry its own Timone-Stage trailer on every commit', {
  broken: async () => assertFixThroughStep('verification'),
  correct: async () => assertFixThroughStep('execution'),
});

// Clause 2 on real work: every commit on the watched run's pull requests carries the trailer of
// the step session that made it (read-only, from GitHub). Needs a `gh` login to fvermaut/scratch-app.
function commitsOf(pr) {
  const out = execFileSync('gh', ['api', `repos/fvermaut/scratch-app/pulls/${pr}/commits`, '--jq', '.[] | [.sha, .commit.message] | @json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return out.trim().split('\n').map((l) => JSON.parse(l));
}
function assertTrailers(commits) {
  assert(commits.length > 0, 'no commits');
  for (const [sha, msg] of commits) {
    assert(/^Timone-Stage: \S+$/m.test(msg) && /^Timone-Session: [0-9a-f-]{36}$/m.test(msg), `${sha.slice(0, 7)} has no Timone-Stage/Timone-Session trailer`);
  }
}
let real;
try { real = [...commitsOf(61), ...commitsOf(64)]; } catch (e) { real = null; }
if (real) {
  await clause('PRD-05.R2 clause 2b', 'every commit on the watched run\'s pull requests (scratch-app #61, #64) carries its step session\'s Timone-Stage trailer', {
    broken: async () => assertTrailers([...real, ['0000000', 'probe: a commit written by hand\n\nno trailer here']]),
    correct: async () => assertTrailers(real),
  });
} else {
  blocked('PRD-05.R2 clause 2b', 'every commit on the watched run\'s pull requests carries its step session\'s Timone-Stage trailer', 'GitHub could not be read from here (gh).');
}

fx.cleanup();
finish('PRD-05.R2');
