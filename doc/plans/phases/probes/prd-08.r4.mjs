// Probe for PRD-08.R4 — Nobody is assigned to a ticket because of this.
//
// Stage 7 artifact, written 2026-10-04 for phase 46's verification, from the criteria register
// alone. No source, no diff, no test suite and no handoff note was read. The built daemon runs on
// the fake forge (_rig.mjs), whose `gh` logs every call the daemon makes with its full arguments.
//
// Register clauses (verbatim):
//   1. GIVEN either path of R1 and R2 / WHEN it opens a ticket / THEN the ticket has no assignee
//      AND the `gh` command that opens it carries no `--assignee`
//   2. GIVEN a ticket for a piece that names `@fvermaut` in its body, and is open, not blocked and
//      has no assignee / WHEN the machine looks for the next piece to start / THEN that ticket can
//      be chosen, as it could before this change
//
// Clause 1 reads every `gh` call of both paths — a walk to three step tickets, and a filed Timone
// issue — for any way of setting an assignee: `--assignee`/`-a` on create, `--add-assignee` on edit,
// or an API call naming assignees. And it reads every opened ticket's assignees back from the forge.
//
// Break steps:
//   1  after the app's own calls, the probe sends one `gh issue create --assignee fvermaut` and one
//      `gh issue edit --add-assignee fvermaut` through the same fake `gh`, so the log holds them as
//      it would hold the app's: the check must go red. This proves the check reads what is sent.
//   2  the ticket for piece 1 already exists when the list is approved and carries the hold label
//      `timone:held`; the opening uses it as piece 1's ticket and it must not be chosen, so the
//      "chosen" check must go red.
//
// Needs `npm run build` first. Nothing reaches GitHub or a real model.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { clause, assert, finish, CLI } from './_rig.mjs';
import { approvedWalk, fileTimoneIssue, stepTitle, namesInPlainText, N } from './_people.mjs';

const assigning = (g) => {
  const a = g.argv;
  if (a[0] === 'issue' && a[1] === 'create' && (a.includes('--assignee') || a.includes('-a'))) return true;
  if (a[0] === 'issue' && a[1] === 'edit' && (a.includes('--add-assignee') || a.includes('--assignee'))) return true;
  if (a[0] === 'api' && a.some((x) => /assignee/i.test(x))) return true;
  return false;
};

// ---------------------------------------------------------------- clause 1

async function bothPaths(inject) {
  const walk = await approvedWalk({ cli: CLI });
  const filed = await fileTimoneIssue({ cli: CLI, projects: { fixture: {}, timone: {} }, body: 'PROBE-R08: a fault.' });
  if (inject) {
    const gh = path.join(walk.fx.dir, 'bin', 'gh');
    execFileSync(gh, ['issue', 'create', '--repo', 'probe-owner/fixture', '--title', 'injected', '--body', 'x', '--assignee', 'fvermaut'], { env: walk.fx.env() });
    execFileSync(gh, ['issue', 'edit', '100', '--repo', 'probe-owner/fixture', '--add-assignee', 'fvermaut'], { env: walk.fx.env() });
  }
  const r = {
    calls: [...walk.fx.gh(), ...filed.fx.gh()],
    opened: [...[1, 2, 3].flatMap((k) => walk.fx.forge().issues ? Object.values(walk.fx.forge().issues).filter((i) => i.title === stepTitle(k)) : []), ...filed.filed],
  };
  walk.fx.cleanup();
  filed.fx.cleanup();
  return r;
}
const assertNobodyAssigned = (r) => {
  assert(r.opened.length === 4, `tickets opened on the two paths: ${r.opened.length}, expected 3 step tickets and 1 Timone issue`);
  const bad = r.calls.filter(assigning);
  assert(bad.length === 0, `a gh call sets an assignee: ${bad.map((g) => `gh ${g.argv.join(' ').slice(0, 160)}`).join(' | ')}`);
  for (const i of r.opened) assert((i.assignees ?? []).length === 0, `#${i.number} has assignees ${i.assignees}`);
};
await clause('PRD-08.R4 clause 1', 'on both paths, the ticket opened has no assignee and the gh command that opens it carries no --assignee', {
  broken: async () => assertNobodyAssigned(await bothPaths(true)),
  correct: async () => {
    const r = await bothPaths(false);
    for (const g of r.calls.filter((c) => c.argv[1] === 'create')) console.log(`    gh ${g.argv.filter((x, i, a) => a[i - 1] !== '--body').join(' ')} (body omitted)`);
    console.log(`    ${r.calls.length} gh calls read; ${r.calls.filter(assigning).length} set an assignee`);
    assertNobodyAssigned(r);
  },
});

// ---------------------------------------------------------------- clause 2

async function walkToPickup(plant) {
  let mapAt;
  const step1 = (fx) => Object.values(fx.forge().issues).find((i) => i.title === stepTitle(1));
  const chosen = (fx) => { const s = step1(fx); return !!s && fx.state().runs.some((x) => x.ticket === s.number); };
  const r = await approvedWalk({
    cli: CLI,
    plant,
    until: (fx) => {
      if (chosen(fx)) return true;
      if (!mapAt && fx.gh().some((g) => g.argv[1] === 'edit' && g.argv.includes('timone:map'))) mapAt = Date.now();
      return mapAt && Date.now() - mapAt > 15000;
    },
  });
  const s = step1(r.fx);
  const out = { s, chosen: chosen(r.fx), comments: (s?.comments ?? []).map((c) => c.body), runs: r.fx.state().runs.map((x) => `#${x.ticket}`) };
  r.fx.cleanup();
  return out;
}
const assertChosen = (o) => {
  assert(o.s, 'no ticket for piece 1 was opened');
  assert(namesInPlainText(o.s.body).has('fvermaut'), `the ticket for piece 1 does not name @fvermaut: ${JSON.stringify(o.s.body)}`);
  assert(o.s.state === 'OPEN' && (o.s.blockedBy ?? []).length === 0 && (o.s.assignees ?? []).length === 0, `the ticket for piece 1 is not open, unblocked and unassigned: ${JSON.stringify({ state: o.s.state, blockedBy: o.s.blockedBy, assignees: o.s.assignees })}`);
  assert(o.chosen, `the ticket for piece 1 (#${o.s.number}) was not chosen; runs: ${o.runs.join(', ')}`);
};
await clause('PRD-08.R4 clause 2', 'a ticket for a piece that names @fvermaut, open, not blocked, unassigned: it can be chosen as the next piece to start', {
  broken: async () => assertChosen(await walkToPickup((f) => {
    f.issues[50] = { number: 50, title: stepTitle(1), body: 'keep the to-dos.\n\nNamed so that GitHub tells them about this ticket and every comment on it: @fvermaut', labels: ['timone:held'], state: 'OPEN', author: 'probe-bot', createdAt: '2026-09-28T10:00:00.000Z', comments: [], parent: N };
  })),
  correct: async () => {
    const o = await walkToPickup();
    console.log(`    piece 1 is #${o.s?.number}: last line "${o.s?.body.trim().split('\n').at(-1)}"; runs: ${o.runs.join(', ')}`);
    console.log(`    first comment on it: ${(o.comments[0] ?? '(none)').split('\n').filter(Boolean)[2] ?? ''}`);
    assertChosen(o);
  },
});

finish('PRD-08.R4');
