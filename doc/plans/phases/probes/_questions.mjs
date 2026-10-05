// Verifier helpers for PRD-09.R1, R2 and R3 (stage 7 artifact), written 2026-10-05 for phase 53's
// verification, from the register alone. No source, no diff, no test suite and no handoff note was read.
//
// Each scenario runs the BUILT daemon through _rig.mjs (fake forge, fake model, in-process steps)
// and returns what the machine posted, where. What the scenarios lean on was learned by running the
// daemon in this pass and reading what it showed its fake model and its fake forge:
//   - the runner's `post` action takes { where: 'ticket' | 'pull-request', body, reason } and, on
//     this build, an optional `leaveOutTakeover`: 'missing-key' | 'approval-word' |
//     'terminal-did-not-settle-it' (its schema, as the model is sent it);
//   - a step is started per stage with start_step; its instructions are the step session's system
//     prompt and first message, as the fake model receives them;
//   - the spending limit notice is posted when a step's cost passes $150, and also when a ticket
//     whose record already holds that cost is picked up again;
//   - the notice that an approved list of pieces could not be acted on is posted when GitHub
//     refuses to open the step tickets (here: `gh issue create` fails with HTTP 403).
// A break leg runs the same scenario on the build before phase 53 (BEFORE_PHASE_53, the branch's
// merge-base with main), where no message names the command.
import fs from 'node:fs';
import path from 'node:path';
import { fixture, model, daemon, act, say, sleep, OPERATOR } from './_rig.mjs';
import { approvedWalk } from './_people.mjs';
import { standInTerminal, startTakeover, takeoverPrompt } from './_places.mjs';
import { oldBuild } from './_old-build.mjs';
import { recordedRun, staleness } from './_replay.mjs';

export const BEFORE_PHASE_53 = '3d7c360e6464882f7e149ffce5c0ede6396d6506';
export const before53 = () => oldBuild(BEFORE_PHASE_53);
export const N = 12;
export const PROJECT = 'fixture';
export const COMMAND = `timone takeover ${PROJECT}#${N}`;
const whyOf = (q) => q.brief.split('## The ticket')[0];
const quiet = (fx) => ['runner-ended', 'seen'].includes(fx.record(N).at(-1)?.kind);
export const textOf = (body) => body.split('---\n\n').slice(1).join('---\n\n') || body;

// The register's definition: the last line that starts with **What I need from you:** asks for
// anything other than "nothing".
export function lastAsk(body) {
  return body.split('\n').filter((l) => l.startsWith('**What I need from you:**')).at(-1);
}
export function isQuestion(body) {
  const l = lastAsk(body);
  if (!l) return false;
  return !/^nothing\b/i.test(l.replace('**What I need from you:**', '').trim());
}
// Every code span (one pair of backticks) and code block in a text.
export function codeSpans(body) {
  const blocks = [...body.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((m) => m[1].trim());
  const inline = [...body.replace(/```[\s\S]*?```/g, '').matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);
  return [...blocks, ...inline];
}

// ---------------------------------------------------------------- the runner's post action
//
// posts: a list of post inputs, sent one per turn of one runner wake. With pr, the run first
// builds and a delivery step opens a pull request, and the posts are sent on the wake after
// delivery ended; without, on the wake for the new ticket.
export async function runnerPosts({ cli, posts, pr = false }) {
  const fx = fixture({ cli, issues: { [PROJECT]: { [N]: {} } } });
  let prOf = null;
  const results = [];
  const m = await model({
    runner: (c) => {
      const w = whyOf(c);
      const ready = pr ? (prOf && /deliver/i.test(w) && /ended/i.test(w)) : w.includes('picked up');
      if (ready) {
        // What the post action answered, one result per post, read on the turn after it.
        if (c.turn > 0) results.push(c.last.split('\n')[0]);
        return c.turn < posts.length ? act('post', posts[c.turn]) : say();
      }
      if (!pr || c.turn > 0) return say();
      if (w.includes('picked up')) return act('start_step', { stage: 'execution', instructions: 'build it', reason: 'probe', skipReason: 'probe: verifier fixture' });
      if (/building ended/i.test(w)) return act('start_step', { stage: 'delivery', instructions: 'deliver it', reason: 'probe', skipReason: 'probe: verifier fixture' });
      return say();
    },
    step: (c) => {
      if (c.turn > 0) return say('done');
      const a = fx.state().runs.find((r) => r.ticket === N && r.status === 'active');
      if (a?.stage === 'execution' && a.branch) fx.pushBranch(a.branch, { 'src/count.ts': 'export const count = 1;\n' }, 'the build');
      if (a?.stage === 'delivery' && a.branch) prOf = fx.editForge((f) => { const num = f.nextNumber++; f.prs[num] = { number: num, title: 'Add a count', body: `For #${N}.`, head: a.branch, base: 'main', state: 'OPEN', createdAt: new Date().toISOString(), comments: [] }; return num; });
      return say('done');
    },
  });
  await daemon(fx, m, { until: () => results.length >= posts.length && quiet(fx), timeoutMs: pr ? 90000 : 40000, settleMs: 1000 });
  await m.stop();
  const f = fx.forge();
  const out = {
    pr: prOf,
    results,
    ticket: (f.issues[N]?.comments ?? []).map((c) => c.body),
    onPr: prOf ? (f.prs[prOf]?.comments ?? []).map((c) => c.body) : [],
    fx,
  };
  out.find = (marker) => [...out.ticket, ...out.onPr].find((b) => b.includes(marker));
  return out;
}

// ---------------------------------------------------------------- the spending limit notice
//
// how: 'step' — a step's cost passes $150 during the run; 'new-run' — the ticket's record already
// holds $160 of cost when it is picked up.
export async function limitNotice({ cli, how }) {
  const fx = fixture({ cli, issues: { [PROJECT]: { [N]: {} } } });
  if (how === 'new-run') {
    const rec = path.join(fx.dir, '.timone', 'records', PROJECT, `${N}.jsonl`);
    fs.mkdirSync(path.dirname(rec), { recursive: true });
    fs.writeFileSync(rec, [
      { kind: 'step-started', at: '2026-10-01T10:00:00.000Z', runId: `${PROJECT}#${N}/1`, stage: 'triage', sessionId: 'probe', instructions: 'sort it' },
      { kind: 'step-ended', at: '2026-10-01T10:05:00.000Z', runId: `${PROJECT}#${N}/1`, stage: 'triage', sessionId: 'probe', ok: true, costUsd: 160 },
    ].map((e) => JSON.stringify(e)).join('\n') + '\n');
  }
  const m = await model({
    runner: (c) => (c.turn === 0 && whyOf(c).includes('picked up') ? act('start_step', { stage: 'triage', instructions: 'sort it', reason: 'probe' }) : say()),
    step: (c) => (c.brief.includes('Timone-Stage: triage') ? { ...say('sorted'), usage: { input_tokens: 40e6 } } : say('done')),
  });
  await daemon(fx, m, { until: () => fx.issue(N).comments.some((c) => /spending limit/.test(c.body)), timeoutMs: 40000, settleMs: 1000 });
  await m.stop();
  const notice = fx.issue(N).comments.find((c) => /spending limit/.test(c.body))?.body ?? '';
  return { notice, runnerSessions: m.runner().length, fx };
}

// ---------------------------------------------------------------- the pieces could not be acted on
export async function piecesFailed({ cli }) {
  const asks = (f) => f.issue(N).comments.some((c) => /piece/i.test(c.body) && isQuestion(c.body) && !/skipping/i.test(c.body));
  const r = await approvedWalk({ cli, plant: (f) => { f.failCalls = [{ pattern: '^issue create', message: 'gh: Resource not accessible by integration (HTTP 403)' }]; }, until: asks });
  const notice = r.fx.issue(N).comments.map((c) => c.body).filter((b) => /piece/i.test(b) && isQuestion(b) && !/skipping/i.test(b)).at(-1) ?? '';
  return { notice, fx: r.fx };
}

// ---------------------------------------------------------------- what each step is told
//
// Starts each stage on its own fixture, in parallel, and returns the first request each step
// session sent the model: its system prompt and first message.
export const STAGES = ['triage', 'clarification', 'wayfinding', 'charting', 'research', 'requirements', 'breakdown', 'planning', 'execution', 'verification', 'delivery', 'remediation', 'update'];
export async function stepInstructions({ cli, stages = STAGES }) {
  const out = {};
  await Promise.all(stages.map(async (stage) => {
    const fx = fixture({ cli, issues: { [PROJECT]: { [N]: {} } } });
    const m = await model({ runner: (c) => (c.turn === 0 && c.wake === 0 ? act('start_step', { stage, instructions: 'probe: do it', reason: 'probe', skipReason: 'probe: verifier fixture' }) : say()), step: () => say('done') });
    await daemon(fx, m, { until: () => m.steps().length > 0 || m.runner().some((r) => /^Refused: No session can be started/.test(r.last)), timeoutMs: 45000, settleMs: 300 });
    await m.stop();
    const s = m.steps().find((x) => x.turn === 0);
    const refused = m.runner().map((r) => r.last).find((l) => /^Refused: No session can be started/.test(l));
    out[stage] = s ? { text: `${s.system}\n\n${s.brief}` } : { refused: refused ?? 'no step session started' };
    fx.cleanup();
  }));
  return out;
}

// ---------------------------------------------------------------- the runner's own instructions
export async function runnerInstructions({ cli }) {
  const fx = fixture({ cli, issues: { [PROJECT]: { [N]: {} } } });
  const m = await model({ runner: () => say() });
  await daemon(fx, m, { until: () => m.runner().length > 0, timeoutMs: 30000, settleMs: 500 });
  await m.stop();
  fx.cleanup();
  const q = m.runner()[0];
  return q ? `${q.system}\n\n${q.brief}` : '';
}

// ---------------------------------------------------------------- after a terminal session
//
// A takeover opens on the ticket (a stand-in terminal), and ends. On the wake that follows, the
// runner posts `post`. Returns the comment, the wake's words and what the session was told.
export async function afterTakeover({ cli, post }) {
  const fx = fixture({ cli, issues: { [PROJECT]: { [N]: {} } } });
  standInTerminal(fx);
  let wake = '';
  const m = await model({ runner: (c) => { if (c.turn === 0 && /terminal session ended/i.test(whyOf(c))) { wake = whyOf(c); return act('post', post); } return say(); } });
  await daemon(fx, m, { until: (f) => f.record(N).some((e) => e.kind === 'runner-ended'), timeoutMs: 30000, settleMs: 500 });
  const marker = post.body.split('\n')[0];
  const d = daemon(fx, m, { until: (f) => f.issue(N).comments.some((c) => c.body.includes(marker)) || (wake && quiet(f)), timeoutMs: 45000, settleMs: 1000 });
  await sleep(1500);
  const t = startTakeover(fx, m, N);
  { const t0 = Date.now(); while (!takeoverPrompt(fx) && Date.now() - t0 < 20000) await sleep(200); }
  await sleep(800);
  await t.release();
  await d;
  await m.stop();
  const comment = fx.issue(N).comments.map((c) => c.body).find((b) => b.includes(marker)) ?? '';
  const result = m.runner().map((r) => r.last).find((l) => /^(Posted|Refused)/.test(l)) ?? '';
  return { comment, wake, result, session: takeoverPrompt(fx), fx };
}

// ---------------------------------------------------------------- timone status
export async function statusAfterQuestion({ cli, ask }) {
  const body = `Which colour should the count be?\n\n**What I need from you:** ${ask}`;
  const r = await runnerPosts({ cli, posts: [{ where: 'ticket', body, reason: 'probe' }] });
  const st = r.fx.cli(['status', '--manifest', r.fx.manifest, '--state', r.fx.statePath]);
  const line = st.out.split('\n').find((l) => l.includes(`#${N}`)) ?? '';
  return { ...r, status: st.out, line };
}

// ---------------------------------------------------------------- the real runner's choice
//
// Whether the real runner sets or leaves out leaveOutTakeover is a model's choice. Its instrument
// is the replay set (PRD-05.R18) against the real model, which this sandbox cannot call. The
// newest recorded replay is judged on whether it ran on this build.
export function realReplayState() {
  try {
    const run = recordedRun();
    const stale = staleness(run);
    return stale ? `the newest recorded replay is older than this build (${stale}); a replay on this build is owed (\`npm run --silent replay\`, from a logged-in terminal)` : null;
  } catch (e) {
    return `no recorded replay could be read: ${e.message}`;
  }
}
