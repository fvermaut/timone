// Probe for PRD-05.R16 — A runner that fails is started again, and the run is not failed for it.
// Stage 7 artifact, authored 2026-09-28 (phase 40) from the register alone. LONG: about 32 minutes,
// because it waits for the real schedule (60 s, 5 min, then 15 min). The model service is made
// unreachable by pointing the daemon at a port nothing listens on; the session library then gives
// up after its own retries (about 3 minutes per attempt), which is when code sees the failure.
//
// Register clauses (verbatim):
//   1. GIVEN a runner session that fails because the model service cannot be reached
//      WHEN code sees the failure
//      THEN it starts the runner again after 60 seconds, then after 5 minutes, and posts nothing on the ticket meanwhile
//   2. GIVEN three failures in a row WHEN the third one ends
//      THEN the ticket says the machine cannot reach its model, asks the reader for nothing,
//      and code keeps trying every 15 minutes
//   3. GIVEN any failure of the runner WHEN the run is read afterwards
//      THEN its state is what it was before the failure, and the project is not held by a run that nothing is working on
import { fixture, model, daemon, act, say, clause, assert, finish } from './_rig.mjs';

const N = 12;
const secs = (a, b) => (Date.parse(b) - Date.parse(a)) / 1000;

async function watch({ reachable }) {
  const fx = fixture({ issues: { fixture: { [N]: {} } } });
  const m = reachable ? await model({ runner: (c) => (c.wake === 0 && c.turn === 0 ? act('start_step', { stage: 'triage', instructions: 'sort', reason: 'p' }) : say()), step: () => ({ hang: true }) }) : { port: 9 };
  const samples = [];
  const failures = () => fx.record(N).filter((e) => e.kind === 'runner-ended' && !e.ok);
  await daemon(fx, m, {
    interval: 5,
    timeoutMs: reachable ? 20000 : 36 * 60 * 1000,
    until: () => {
      const r = fx.run(N);
      if (r) samples.push({ at: new Date().toISOString(), status: r.status, wait: JSON.stringify(r.wait ?? null) });
      return !reachable && fx.record(N).filter((e) => e.kind === 'woke').length >= 4;
    },
  });
  if (m.stop) await m.stop();
  const rec = fx.record(N);
  const r = {
    wokes: rec.filter((e) => e.kind === 'woke').map((e) => e.at),
    fails: rec.filter((e) => e.kind === 'runner-ended' && !e.ok).map((e) => ({ at: e.at, error: e.error })),
    comments: fx.issue(N).comments.slice(1).map((c) => ({ at: c.createdAt, body: c.body })),
    samples,
    firstWait: samples[0]?.wait,
  };
  fx.cleanup();
  return r;
}

const dead = await watch({ reachable: false });
const alive = await watch({ reachable: true });
console.log(`    (attempts started: ${dead.wokes.map((t) => t.slice(11, 19)).join(', ')}; failures: ${dead.fails.map((f) => f.at.slice(11, 19)).join(', ')})`);
console.log(`    (failure reason: ${dead.fails[0]?.error})`);

function assertSchedule(r) {
  assert(r.fails.length >= 2 && r.wokes.length >= 3, `only ${r.fails.length} failures and ${r.wokes.length} attempts`);
  const g1 = secs(r.fails[0].at, r.wokes[1]);
  const g2 = secs(r.fails[1].at, r.wokes[2]);
  assert(g1 >= 55 && g1 <= 70, `second attempt ${g1}s after the first failure, not 60`);
  assert(g2 >= 290 && g2 <= 315, `third attempt ${g2}s after the second failure, not 300`);
  const before3 = r.comments.filter((c) => Date.parse(c.at) < Date.parse(r.fails[2]?.at ?? '2999-01-01'));
  assert(before3.length === 0, `posted on the ticket meanwhile: ${before3.map((c) => c.body.slice(0, 80)).join(' | ')}`);
}
await clause('PRD-05.R16 clause 1', 'the model service cannot be reached: the runner is started again after 60 seconds, then after 5 minutes, and nothing is posted meanwhile', {
  broken: async () => assertSchedule(alive),
  correct: async () => assertSchedule(dead),
});

function assertThirdSaysAndKeepsTrying(r) {
  assert(r.fails.length >= 3 && r.wokes.length >= 4, `only ${r.fails.length} failures and ${r.wokes.length} attempts were seen`);
  const after3 = r.comments.filter((c) => Date.parse(c.at) >= Date.parse(r.fails[2].at) - 1000 && Date.parse(c.at) < Date.parse(r.wokes[3]));
  assert(after3.length === 1, `${after3.length} comments after the third failure`);
  const t = after3[0].body;
  assert(/cannot reach the model/i.test(t), `the comment does not say the machine cannot reach its model: ${t.slice(0, 200)}`);
  assert(/\*\*What I need from you:\*\* nothing\./.test(t), 'the comment asks the reader for something');
  const g3 = secs(r.fails[2].at, r.wokes[3]);
  assert(g3 >= 885 && g3 <= 915, `the next attempt came ${g3}s after the third failure, not 900`);
}
await clause('PRD-05.R16 clause 2', 'three failures in a row: the ticket says the machine cannot reach its model, asks for nothing, and code keeps trying every 15 minutes', {
  broken: async () => assertThirdSaysAndKeepsTrying(alive),
  correct: async () => assertThirdSaysAndKeepsTrying(dead),
});
console.log(`    (the comment read: "${dead.comments[0]?.body.split('---\n\n')[1]?.replace(/\n+/g, ' ')}")`);

function assertStateKept(r) {
  assert(r.samples.length > 10, 'too few observations of the run');
  const bad = r.samples.filter((s) => s.status !== 'parked' || s.wait !== r.firstWait);
  assert(bad.length === 0, `the run changed while nothing worked on it: ${JSON.stringify(bad[0])}`);
}
await clause('PRD-05.R16 clause 3', 'after each failure the run is as it was before, and it is never left active with nothing working on it', {
  broken: async () => assertStateKept(alive),
  correct: async () => assertStateKept(dead),
});

finish('PRD-05.R16');
