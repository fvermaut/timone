// Probe for PRD-07.R6 — A held ticket says what it waits for, and a named person can overrule.
// Stage 7 artifact, authored 2026-10-05 (phase 49) from the register alone. Runs the built
// daemon through _rig.mjs (fake forge, fake model, in-process steps). Needs `npm run build`
// first. Nothing reaches GitHub or a real model.
//
// Register clauses (verbatim):
//   1. GIVEN the planner holds a ticket back
//      WHEN it records the decision
//      THEN a comment on that ticket, in plain words, names the ticket it waits for and gives the reason
//   2. GIVEN a held ticket
//      WHEN a named person writes on it, in plain words, that it should build now
//      THEN the planner lets it build when a place is free, and says on the ticket that it does so on that comment
//   3. GIVEN a held ticket
//      WHEN someone not named for the project writes the same
//      THEN nothing changes
//
// The planner is a model session; here the fake model answers for it, so its JUDGEMENT is the
// probe's script, and what is checked is everything code does around it: what the planner is
// shown, what is written on the ticket, which comments reach it, what is accepted from it.
// What the built app was seen to offer the planner: the tools `hold {ticket, waitsFor, reason}`,
// `let_build {ticket, reason, commentAt?}` and `pass_to_runner {ticket, commentAt}`, and a brief
// whose section "## The comment that woke you" quotes a comment with its time. The planner's
// script: let #70 build; hold #71 waiting for #70; when a comment woke it, let #71 build on that
// comment, giving the comment's time as shown.
//
// Fixtures: ticket #70 builds (a step that does not end, or one that ends after 25 s); ticket #71
// arrives, is held, then a person not named for the project writes "Please build this now." on
// it, and ten seconds later the operator (a named person) writes the same. Variant "cites the
// stranger": woken by the operator's comment, the planner answers let_build giving the time of
// the stranger's comment instead, so code must check whose comment it is.
//
// Break legs. 1: the same check on #70, which the planner let build, where no comment says it
// waits. 2: the same check on the state just before the operator wrote. 3: the same "nothing
// changes" check across the operator's comment, where it does change. 3 (cites the stranger):
// the same check on the fixture where the planner cites the operator's comment.
import { fixture, model, daemon, act, say, clause, assert, finish, OPERATOR, STRANGER } from './_rig.mjs';

const START = act('start_step', { stage: 'execution', instructions: 'probe: build', reason: 'probe', skipReason: 'probe: verifier fixture' });
const REASON = 'Both change src/count.ts in the same lines.';
const BUILD_NOW = 'Please build this now.';
const whyOf = (c) => c.brief.split('## The ticket')[0];
const started = (fx, n) => fx.record(n).filter((e) => e.kind === 'step-started');
const machine = (fx, n) => (fx.issue(n)?.comments ?? []).filter((c) => c.author !== OPERATOR && c.author !== STRANGER);

async function held({ places, citeStranger = false, slow70 = false }) {
  const fx = fixture({ projects: { fixture: places === undefined ? {} : { places } }, issues: { fixture: { 70: { title: 'First', createdAt: '2026-09-01T10:00:00.000Z' } } } });
  const briefs = [];
  const at = {};
  const m = await model({
    runner: (c) => {
      if (c.turn > 0) return say();
      const t = Number((c.brief.match(/## The ticket\s+\S+ #(\d+):/) || [])[1]);
      const w = whyOf(c);
      if (t === 70) return w.includes('picked up') ? START : say();
      return w.includes('picked up') || /place/i.test(w) ? START : say();
    },
    planner: (c) => {
      briefs.push({ at: new Date().toISOString(), turn: c.turn, brief: c.brief, last: c.last });
      if (c.turn > 0) return say();
      const t = Number((c.brief.match(/## The ticket you decide for\s+\S+ #(\d+):/) || [])[1]);
      if (t === 70) return { blocks: [{ type: 'tool_use', name: 'mcp__planner__let_build', input: { ticket: 70, reason: 'Nothing else is being built.' } }] };
      const woke = c.brief.split('## The comment that woke you')[1] ?? '';
      const shown = (woke.match(/wrote at (\d{4}-\d\d-\d\dT[\d:.]+Z)/) || [])[1];
      if (shown) return { blocks: [{ type: 'tool_use', name: 'mcp__planner__let_build', input: { ticket: t, reason: 'A person asked for it.', commentAt: citeStranger ? at.stranger : shown } }] };
      return { blocks: [{ type: 'tool_use', name: 'mcp__planner__hold', input: { ticket: t, waitsFor: [70], reason: REASON } }] };
    },
    step: (c) => {
      const a = fx.state().runs.find((r) => r.ticket === 70 && r.status === 'active');
      if (slow70 && a && c.turn === 0 && !started(fx, 71).length && !fx.record(70).some((e) => e.kind === 'step-ended')) return { delayMs: 25000, blocks: [{ type: 'text', text: 'done' }] };
      return { hang: true };
    },
  });
  const out = { fx, snaps: {} };
  const shot = () => ({ decisions: fx.record(71).filter((e) => e.kind === 'planner-decision'), notices: fx.record(71).filter((e) => e.kind === 'notice' && /planner read comment/.test(e.about ?? '')), started: started(fx, 71).map((e) => e.at), planner: fx.run(71)?.planner, comments: machine(fx, 71).map((c) => c.body), refusals: fx.record(71).filter((e) => e.kind === 'decision' && /^Refused/.test(e.detail ?? '')).map((e) => e.detail) });
  let phase = 0, t = 0;
  await daemon(fx, m, {
    timeoutMs: 150000,
    until: () => {
      if (phase === 0 && started(fx, 70).length) { phase = 1; fx.editForge((f) => { f.issues[71] = { number: 71, title: 'Second', body: 'Show the open count.', labels: ['timone'], state: 'OPEN', author: OPERATOR, createdAt: '2026-09-02T10:00:00.000Z', comments: [] }; }); }
      if (phase === 1 && fx.record(71).some((e) => e.kind === 'planner-decision')) { phase = 2; t = Date.now(); out.snaps.held = shot(); at.stranger = fx.comment(71, STRANGER, BUILD_NOW); }
      if (phase === 2 && Date.now() - t > 12000) { phase = 3; t = Date.now(); out.snaps.afterStranger = shot(); at.operator = fx.comment(71, OPERATOR, BUILD_NOW); }
      if (phase === 3 && Date.now() - t > (slow70 ? 40000 : 15000)) { out.snaps.afterOperator = shot(); return true; }
      if (phase === 3 && slow70 && started(fx, 71).length && Date.now() - t > 5000) { out.snaps.afterOperator = shot(); return true; }
      return false;
    },
  });
  out.at = at;
  out.briefs = briefs;
  out.step70Ended = fx.record(70).find((e) => e.kind === 'step-ended')?.at;
  out.c70 = machine(fx, 70).map((c) => c.body);
  await m.stop();
  return out;
}

const [two, one, cites] = await Promise.all([held({}), held({ places: 1, slow70: true }), held({ citeStranger: true })]);
const flat = (s) => s.replace(/\s+/g, ' ');

// Clause 1.
function holdComment(bodies, snapHold) {
  const c = bodies.find((b) => /#70\b/.test(b) && b.includes(REASON));
  assert(c, `no comment on the ticket names the ticket it waits for (#70) with the reason: ${JSON.stringify(bodies.map((b) => flat(b).slice(-200)))}`);
  assert(/wait/i.test(c), `the comment does not say the ticket waits: "${flat(c)}"`);
  if (snapHold) assert(snapHold.decisions.some((d) => d.decision === 'hold'), `setup: the planner's hold was not recorded: ${JSON.stringify(snapHold.decisions)}`);
  return c;
}
await clause('PRD-07.R6 clause 1', 'the planner holds a ticket back: when it records the decision, a comment on that ticket, in plain words, names the ticket it waits for and gives the reason', {
  broken: async () => holdComment(two.c70),
  correct: async () => holdComment(two.snaps.held.comments, two.snaps.held),
});
console.log(`    (the comment: "${flat(holdComment(two.snaps.held.comments)).slice(0, 400)}")`);

// Clause 2.
function builtOnComment(s, at, name = OPERATOR) {
  const d = s.decisions.find((x) => x.decision === 'build');
  assert(d, `the planner did not let the held ticket build: ${JSON.stringify(s.decisions.map((x) => x.decision))}`);
  assert(s.planner?.decision?.onComment?.by === name && s.planner.decision.onComment.at === at, `the decision is not recorded as made on ${name}'s comment at ${at}: ${JSON.stringify(s.planner?.decision)}`);
  assert(s.started.length, 'the held ticket\'s build did not start');
  const said = s.comments.find((b) => b.includes(name) && /comment/i.test(b) && /build/i.test(b));
  assert(said, `nothing on the ticket says it builds on that comment: ${JSON.stringify(s.comments.map((b) => flat(b).slice(-160)))}`);
  return said;
}
await clause('PRD-07.R6 clause 2', 'a held ticket: a named person writes on it, in plain words, that it should build now, and the planner lets it build when a place is free, and says on the ticket that it does so on that comment', {
  broken: async () => builtOnComment(two.snaps.afterStranger, two.at.operator),
  correct: async () => {
    builtOnComment(two.snaps.afterOperator, two.at.operator);
    builtOnComment(one.snaps.afterOperator, one.at.operator);
    assert(one.step70Ended && one.snaps.afterOperator.started[0] >= one.step70Ended, `with one place, the held ticket started at ${one.snaps.afterOperator.started[0]}, before the place was free (the other step ended at ${one.step70Ended})`);
  },
});
console.log(`    (two places — the comment: "${flat(builtOnComment(two.snaps.afterOperator, two.at.operator)).slice(0, 300)}"; the build started ${two.snaps.afterOperator.started[0]?.slice(11, 19)}, the operator wrote at ${two.at.operator?.slice(11, 19)})`);
console.log(`    (one place — the other ticket's step ended at ${one.step70Ended?.slice(11, 19)}; the held ticket's build started at ${one.snaps.afterOperator.started[0]?.slice(11, 19)}; refused before that: ${JSON.stringify(one.snaps.afterOperator.refusals.map((r) => r.slice(0, 60)))})`);

// Clause 3.
function nothingChanges(before, after, label) {
  assert(before.decisions.length === after.decisions.length, `${label}: a new planner decision was recorded: ${JSON.stringify(after.decisions.slice(before.decisions.length))}`);
  assert(after.notices.length === before.notices.length, `${label}: the planner read the comment: ${JSON.stringify(after.notices.slice(before.notices.length))}`);
  assert(after.started.length === before.started.length, `${label}: the held ticket's build started`);
  assert(after.planner?.decision?.kind === 'hold', `${label}: the ticket is no longer held: ${JSON.stringify(after.planner?.decision)}`);
  assert(after.comments.length === before.comments.length, `${label}: something new was written on the ticket: ${JSON.stringify(after.comments.slice(before.comments.length).map(flat))}`);
}
await clause('PRD-07.R6 clause 3', 'a held ticket: someone not named for the project writes the same, and nothing changes', {
  broken: async () => nothingChanges(two.snaps.afterStranger, two.snaps.afterOperator, 'across the operator\'s comment'),
  correct: async () => { for (const r of [two, one, cites]) nothingChanges(r.snaps.held, r.snaps.afterStranger, 'across the stranger\'s comment'); },
});
console.log(`    (planner sessions while the stranger's comment stood: ${two.briefs.filter((b) => b.turn === 0 && b.at > two.at.stranger && b.at < two.at.operator).length})`);

function strangerNotTaken(r) {
  const s = r.snaps.afterOperator;
  assert(!(s.planner?.decision?.onComment?.by === STRANGER), `the planner's decision was taken on the stranger's comment: ${JSON.stringify(s.planner?.decision)}`);
  assert(!s.decisions.some((d) => d.decision === 'build'), `the held ticket was let build: ${JSON.stringify(s.decisions)}`);
  assert(!s.started.length, 'the held ticket\'s build started');
}
await clause('PRD-07.R6 clause 3 (the planner cites the stranger\'s comment)', 'a held ticket: the planner answers that it builds on the comment of someone not named for the project, and nothing changes', {
  broken: async () => strangerNotTaken(two),
  correct: async () => strangerNotTaken(cites),
});
{
  const answered = cites.briefs.filter((b) => b.turn === 1).map((b) => flat(b.last).slice(0, 240));
  console.log(`    (the planner was answered: ${JSON.stringify(answered)}; the ticket's decision at the end: ${JSON.stringify(cites.snaps.afterOperator.planner?.decision)})`);
}

for (const r of [two, one, cites]) r.fx.cleanup();
finish('PRD-07.R6');
