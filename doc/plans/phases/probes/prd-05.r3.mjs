// Probe for PRD-05.R3 — Nothing reaches a default branch without a yes from a named person.
// Stage 7 artifact, authored 2026-09-28 (phase 40) from the register alone. The fake forge does
// GitHub's merge for real in its bare remote and logs "MERGED" when it does: that log and the
// remote's main are the evidence of what reached the default branch.
//
// Rig note: work a step would have committed is pushed BETWEEN daemon runs, never while a step
// session is live — in the in-process runtime a push during a live step was seen to leave that
// step never ending (verification report, "Limits of the rig").
//
// Register clauses (verbatim):
//   1. GIVEN any run WHEN the runner's actions are listed
//      THEN none of them merges a pull request or pushes to a default branch
//   2. GIVEN a run in which the runner skipped the approval of the list of pieces
//      WHEN the list is committed
//      THEN the requirements and the list of pieces are not merged into the default branch
//      AND they reach the operator in a pull request
//   3. GIVEN a run in which a named person approved the list of pieces in a comment
//      WHEN the approval is recorded
//      THEN chunk zero is merged as today, and the record names the comment the approval came from
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fixture, model, daemon, act, say, clause, assert, finish, OPERATOR, STRANGER, REPO_ROOT, CLI } from './_rig.mjs';
import { oldBuild } from './_old-build.mjs';
import { BEFORE_PHASE_43, BR, stepSession, boxScript, boxReplay, hookCli, plantStatusCommit, plantRun } from './_steps.mjs';

const N = 12;
const PRD = '# PRD-01: A count of open to-dos\n\n> **Status:** Active\n\nShow how many to-dos are open.\n';
const listText = (stamp) => `# Breakdown\n\n**Status:** ${stamp}\n\n1. **The count above the list** — show how many to-dos are open, above the list. Delivers PRD-01.R1.\n\n---\n\n## What this is\n\nThe list of pieces.\n`;
const whyOf = (q) => q.brief.split('## The ticket')[0];
const ended = (fx, stage) => fx.record(N).some((e) => e.kind === 'step-ended' && e.stage === stage);
const quiet = (fx) => fx.record(N).at(-1)?.kind === 'runner-ended' || fx.record(N).at(-1)?.kind === 'seen';

// A feature walked to its list of pieces, then either the list approved in `approver`'s comment,
// or the approval skipped and the work carried on to a pull request.
async function walk({ approver = null, skipApproval = false }) {
  const fx = fixture({ issues: { fixture: { [N]: {} } } });
  const T = {};
  const m = await model({
    runner: (c) => {
      if (c.turn > 0) return say();
      const w = whyOf(c);
      if (w.includes('picked up')) return act('start_step', { stage: 'requirements', instructions: 'write it down', reason: 'probe', skipReason: 'probe: the request is clear' });
      if (w.includes('"approve the requirements"')) return act('record_approval', { what: 'requirements', commentAt: T.req, reason: 'probe' });
      if (w.includes('"now cut it into pieces"')) return act('start_step', { stage: 'breakdown', instructions: 'cut it', reason: 'probe' });
      if (w.includes('"go on without approving the list"')) return act('start_step', { stage: 'planning', instructions: 'plan it', reason: 'probe', skipReason: 'probe: the operator said to go on without approving the list' });
      if (w.includes('preparing the work ended')) return act('start_step', { stage: 'execution', instructions: 'build it', reason: 'probe' });
      if (w.includes('"the build is pushed"')) return act('start_step', { stage: 'delivery', instructions: 'open the pull request', reason: 'probe', skipReason: 'probe: no check in this fixture' });
      if (w.includes('"approve the list"')) return act('record_approval', { what: 'pieces', commentAt: T.pcs, reason: 'probe' });
      return say();
    },
    step: (c) => {
      if (c.turn > 0) return say('done');
      if ((c.brief.match(/Timone-Stage: (\S+)/) || [])[1] === 'delivery') {
        const br = fx.run(N).branch;
        fx.editForge((f) => { const num = f.nextNumber++; f.prs[num] = { number: num, title: 'Probe', body: 'Delivery text.', head: br, base: 'main', state: 'OPEN', createdAt: new Date().toISOString(), comments: [] }; });
        return say('the pull request is open');
      }
      return say('done');
    },
  });
  const run = (until, ms = 30000) => daemon(fx, m, { until, timeoutMs: ms, settleMs: 1500 });
  await run(() => ended(fx, 'requirements') && quiet(fx));
  fx.pushBranch(fx.run(N).branch, { 'doc/specs/prd/prd-01-count.md': PRD.replace('Active', 'Draft') }, 'requirements');
  T.req = fx.comment(N, OPERATOR, 'approve the requirements');
  await run(() => fx.record(N).filter((e) => e.kind === 'step-ended' && e.stage === 'requirements').length >= 2 && quiet(fx));
  fx.pushBranch(fx.run(N).branch, { 'doc/specs/prd/prd-01-count.md': PRD }, 'record the requirements approval');
  fx.comment(N, OPERATOR, 'now cut it into pieces');
  await run(() => ended(fx, 'breakdown') && quiet(fx));
  const branch = fx.run(N).branch;
  const mainBefore = fx.remoteHead('main');
  if (approver) {
    fx.pushBranch(branch, { [`doc/plans/breakdowns/ticket-${N}.md`]: listText(`Approved by ${OPERATOR} 2026-09-28 — 1 piece`) }, 'the list of pieces');
    T.pcs = fx.comment(N, approver, 'approve the list');
    await run(() => fx.gh().some((g) => /MERGED/.test(g.result ?? '')) || fx.record(N).some((e) => e.kind === 'decision' && e.action === 'record_approval' && /Refused/.test(e.detail ?? '') && e.at > T.pcs.slice(0, 19)), 40000);
  }
  if (skipApproval) {
    fx.pushBranch(branch, { [`doc/plans/breakdowns/ticket-${N}.md`]: listText('Awaiting approval') }, 'the list of pieces');
    fx.comment(N, OPERATOR, 'go on without approving the list');
    await run(() => ended(fx, 'execution') && quiet(fx));
    fx.pushBranch(branch, { 'src/count.ts': 'export const count = 1;\n' }, 'the build');
    fx.comment(N, OPERATOR, 'the build is pushed');
    await run(() => ended(fx, 'delivery') && quiet(fx), 40000);
  }
  await m.stop();
  return {
    fx, mainBefore, mainAfter: fx.remoteHead('main'), branch, T,
    merged: fx.gh().filter((g) => /MERGED/.test(g.result ?? '')).map((g) => g.result),
    listOnMain: fx.remoteFile('main', `doc/plans/breakdowns/ticket-${N}.md`),
    prdOnMain: fx.remoteFile('main', 'doc/specs/prd/prd-01-count.md'),
    approvals: fx.record(N).filter((e) => e.kind === 'approval'),
    prs: Object.values(fx.forge().prs),
    issues: fx.forge().issues,
  };
}

// Clause 1: the runner's own actions, read from what the runner session was started with.
{
  const fx = fixture({ issues: { fixture: { [N]: {} } } });
  const m = await model({ runner: () => say() });
  await daemon(fx, m, { until: () => m.runner().length > 0, timeoutMs: 20000 });
  await m.stop();
  const tools = m.runner()[0]?.tools ?? [];
  const assertNoMerge = (list) => {
    assert(list.length > 0, 'no runner session was seen');
    const bad = list.filter((t) => /(merge|push|commit|Bash|Write|Edit)/i.test(t));
    assert(bad.length === 0, `actions that could merge or push: ${bad.join(', ')}`);
  };
  await clause('PRD-05.R3 clause 1', 'none of the runner\'s actions merges a pull request or pushes to a default branch', {
    broken: async () => assertNoMerge([...tools, 'mcp__runner__merge_pull_request']),
    correct: async () => assertNoMerge(tools),
  });
  fx.cleanup();
}

const skipped = await walk({ skipApproval: true });
const approved = await walk({ approver: OPERATOR });
const byStranger = await walk({ approver: STRANGER });

// Clause 2: the pieces approval skipped — nothing reaches main, and the list reaches the operator in a pull request.
function assertNotMerged(r) {
  assert(r.merged.length === 0 && r.mainAfter === r.mainBefore, `something reached main: ${r.merged.join('; ') || `main moved ${r.mainBefore} → ${r.mainAfter}`}`);
  assert(!r.listOnMain && !r.prdOnMain, 'the requirements or the list of pieces are on main');
}
await clause('PRD-05.R3 clause 2a', 'with the pieces approval skipped, the requirements and the list of pieces are not merged into the default branch', {
  broken: async () => assertNotMerged(approved),
  correct: async () => assertNotMerged(skipped),
});
function assertInPullRequest(r) {
  const pr = r.prs.find((p) => p.head === r.branch && p.state === 'OPEN');
  assert(pr, `no open pull request from ${r.branch}`);
  assert(r.fx.remoteFile(r.branch, `doc/plans/breakdowns/ticket-${N}.md`) && r.fx.remoteFile(r.branch, 'doc/specs/prd/prd-01-count.md'), 'the pull request\'s branch does not carry the requirements and the list');
  assert(/timone:departures[\s\S]*approval of the list of pieces[\s\S]*go on without approving/i.test(pr.body), `the pull request does not say the approval of the list was skipped:\n${pr.body}`);
}
await clause('PRD-05.R3 clause 2b', 'they reach the operator in a pull request', {
  broken: async () => assertInPullRequest({ ...skipped, prs: [] }),
  correct: async () => assertInPullRequest(skipped),
});

// Clause 3: a named person's approval, recorded → chunk zero merged as today, record names the comment.
function assertChunkZero(r) {
  assert(r.merged.length === 1, `merges into main: ${r.merged.length}`);
  assert(r.listOnMain?.includes('The count above the list') && r.prdOnMain, 'main does not carry the requirements and the list');
  const steps = Object.values(r.issues).filter((i) => i.number !== N && i.title.includes('The count above the list'));
  assert(steps.length === 1, `step tickets opened: ${steps.length}`);
  assert(r.issues[N].labels.includes('timone:map'), 'the ticket did not become the map of its pieces');
  const a = r.approvals.find((x) => x.what === 'pieces');
  assert(a && a.by === OPERATOR && a.commentAt === r.T.pcs, `the record does not name the approving comment: ${JSON.stringify(r.approvals)}`);
}
await clause('PRD-05.R3 clause 3', 'a named person\'s approval, recorded: chunk zero is merged as today, and the record names the comment', {
  broken: async () => assertChunkZero(byStranger),
  correct: async () => assertChunkZero(approved),
});

for (const r of [skipped, approved, byStranger]) r.fx.cleanup();

// ---------------------------------------------------------------- step sessions
//
// ✏ 2026-10-03 (phase 43 verification, timone#85): the title of R3 applied to the sessions
// the runner starts. The three clauses above cover the runner's own actions; a step session
// holds a token that can write any branch, and phase 43 claims R3 for them too. These labels
// are NOT register clauses — the register has three — and say so in their names. Each break
// leg runs the same scenario on the build from just before phase 43 (main at BEFORE_PHASE_43),
// where a step session could still reach the default branch: there, the assertion must fail.
const memo = (f) => { let p; return () => (p ??= f()); };
const OLD = memo(async () => oldBuild(BEFORE_PHASE_43));
const P = (fx) => `cd ${fx.dir}/projects/fixture && `;
const pushes = (fx) => [
  `${P(fx)}git checkout -q -B ${BR} && echo x > STATUS.md && git add -A && git -c user.email=a@b -c user.name=a commit -qm 'docs: STATUS.md - probe' && git push origin HEAD:refs/heads/${BR} 2>&1; echo EXIT=$?`,
  `${P(fx)}git push origin HEAD:main 2>&1; echo EXIT=$?`,
  `${P(fx)}git push origin HEAD:refs/heads/other 2>&1; echo EXIT=$?`,
  `${P(fx)}git push origin :${BR} 2>&1; echo EXIT=$?`,
  `${P(fx)}git push --no-verify origin HEAD:main 2>&1; echo EXIT=$?`,
  `${P(fx)}git -c core.hooksPath=/dev/null push origin HEAD:main 2>&1; echo EXIT=$?`,
  `${P(fx)}GIT_CONFIG_COUNT=0 git push origin HEAD:main 2>&1; echo EXIT=$?`,
  `gh pr merge 100 --repo probe-owner/fixture; echo EXIT=$?`,
  `gh api -X PUT repos/probe-owner/fixture/contents/STATUS.md -f message=x -f content=eA== -f branch=main; echo EXIT=$?`,
  `gh repo sync; echo EXIT=$?`,
  `echo 'probe body from stdin' | gh issue comment 12 --body-file -; echo EXIT=$?`,
];
const hostRun = async (cli) => {
  const r = await stepSession({ cli, commands: pushes });
  const res = { ...r, mainAfter: r.fx.remoteHead('main'), own: r.fx.remoteHead(BR), other: r.fx.remoteHead('other'), gh: r.fx.gh().filter((g) => !/^(issue (view|list)|pr list|api graphql|api repos\/probe-owner\/fixture\/compare)/.test(g.argv.join(' '))) };
  r.fx.cleanup();
  return res;
};
const HOST_NEW = memo(() => hostRun(CLI));
const HOST_OLD = memo(async () => hostRun(await OLD()));
const refused = (o) => /Refused:/.test(o ?? '') && !/EXIT=0/.test(o ?? '');

function assertHostPush(r) {
  assert(/EXIT=0/.test(r.outs[0]), `the push to the run's own work branch did not land: ${r.outs[0]}`);
  assert(r.mainAfter === r.mainBefore, `the remote's main moved: ${r.mainBefore} → ${r.mainAfter}`);
  for (const [i, what] of [[1, 'a push to main'], [2, 'a push to another branch'], [3, 'a delete of the work branch']]) assert(refused(r.outs[i]), `${what} was not refused: ${r.outs[i]}`);
  assert(!r.other && r.own, `another branch appeared on the remote (${r.other}), or the work branch is gone (${r.own})`);
}
await clause('PRD-05.R3 step sessions, part 1 (host)', "a step session's git push reaches its own work branch and nothing else: main, another branch and a delete are refused", {
  broken: async () => assertHostPush(await HOST_OLD()),
  correct: async () => assertHostPush(await HOST_NEW()),
});
function assertGuardOffRefused(r) {
  for (const i of [4, 5, 6]) assert(/Refused: this command would switch off the guard/.test(r.outs[i] ?? ''), `a command that switches the push guard off was not refused: ${r.outs[i]}`);
}
await clause('PRD-05.R3 step sessions, part 3 (guard off)', "a run's Bash command that would switch the push guard off (--no-verify, core.hooksPath, GIT_CONFIG_…) is refused before it runs", {
  broken: async () => assertGuardOffRefused(await HOST_OLD()),
  correct: async () => assertGuardOffRefused(await HOST_NEW()),
});
function assertHostForge(r) {
  for (const [i, what] of [[7, 'gh pr merge'], [8, 'a contents write to main'], [9, 'gh repo sync']]) assert(refused(r.outs[i]), `${what} was not refused: ${r.outs[i]}`);
  const reached = r.gh.filter((g) => /^(pr merge|repo sync)|contents\/STATUS\.md/.test(g.argv.join(' ')));
  assert(reached.length === 0, `a refused call still reached the forge: ${JSON.stringify(reached.map((g) => g.argv))}`);
  const comment = r.gh.find((g) => g.argv[0] === 'issue' && g.argv[1] === 'comment' && g.argv.includes('--body-file'));
  assert(/EXIT=0/.test(r.outs[10]) && comment && /probe body from stdin/.test(comment.stdin ?? ''), `an ordinary comment did not reach the forge with its stdin: ${r.outs[10]} ${JSON.stringify(comment)}`);
}
await clause('PRD-05.R3 step sessions, part 2 (host)', "a step session's gh merge, contents write to main and repo sync are refused and never reach the forge; a comment, with its stdin, still does", {
  broken: async () => assertHostForge(await HOST_OLD()),
  correct: async () => assertHostForge(await HOST_NEW()),
});

// The forge-call check on its own: the whole set of calls this pass tried, refused and allowed.
const forgeCases = [
  ['refuse', 'pr merge 5'], ['refuse', '-R o/r pr merge 5'], ['refuse', 'repo sync'],
  ['refuse', 'api -X PUT repos/o/r/contents/S.md -f message=x -f content=eA== -f branch=main'],
  ['refuse', 'api -X PUT repos/o/r/contents/S.md -f message=x -f content=eA=='],
  ['refuse', 'api --method PUT repos/o/r/contents/S.md -f branch=main'],
  ['refuse', 'api -X PUT repos/o/r/contents/S.md --input body.json'],
  ['refuse', 'api repos/o/r/merges -f base=main -f head=x'], ['refuse', 'api -X PUT repos/o/r/pulls/5/merge'],
  ['refuse', 'api -X PATCH repos/o/r/git/refs/heads/main -f sha=a'], ['refuse', 'api -X DELETE repos/o/r/git/refs/heads/main'],
  ['refuse', 'api repos/o/r/git/refs -f ref=refs/heads/other -f sha=a'],
  ['refuse', 'api graphql -f query=mutation{mergePullRequest(input:{pullRequestId:"x"}){clientMutationId}}'],
  ['refuse', 'api graphql -f query=mutation{createCommitOnBranch(input:{branch:{branchName:"main"}}){commit{oid}}}'],
  ['refuse', 'api graphql -f query=mutation{enablePullRequestAutoMerge(input:{pullRequestId:"x"}){clientMutationId}}'],
  ['refuse', 'api graphql -F query=@q.graphql'],
  ['allow', `api -X PUT repos/o/r/contents/S.md -f message=x -f content=eA== -f branch=${BR}`],
  ['allow', 'pr create --title x --body y'], ['allow', 'issue comment 5 -b hi'], ['allow', 'api repos/o/r/pulls/5'],
  ['allow', 'api graphql -f query=query{viewer{login}}'],
];
const splitArgs = (s) => s.match(/(?:[^\s"]+|"[^"]*")+/g);
function forgeCall(cli, args, branch = BR) {
  try { execFileSync(process.execPath, [cli, 'guardrails', 'forge-call', ...(branch ? ['--branch', branch] : []), '--', ...args], { stdio: ['ignore', 'pipe', 'pipe'] }); return { code: 0, out: '' }; }
  catch (e) { return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }; }
}
function assertForgeMatrix(cli) {
  const wrong = [];
  for (const [want, line] of forgeCases) {
    const r = forgeCall(cli, splitArgs(line));
    const got = r.code !== 0 && /Refused:/.test(r.out) ? 'refuse' : r.code === 0 ? 'allow' : `error ${r.code}`;
    if (got !== want) wrong.push(`${line} → ${got} (want ${want})`);
  }
  const nb = forgeCall(cli, ['api', '-X', 'PUT', 'repos/o/r/contents/S.md', '-f', 'branch=x'], null);
  if (!(nb.code !== 0 && /no work branch/.test(nb.out))) wrong.push('a step with no work branch may write a file through the API');
  assert(wrong.length === 0, wrong.join('; '));
}
await clause('PRD-05.R3 step sessions, part 2 (every call tried)', 'the forge-call check refuses every merge and every write to a branch but the run\'s own, and lets reads, comments, pull requests and own-branch writes through', {
  broken: async () => assertForgeMatrix(await OLD()),
  correct: async () => assertForgeMatrix(CLI),
});

// In a box: the script the daemon hands docker, run for real outside a container.
const boxRun = async (cli, timoneCommit) => {
  const b = await boxScript({ cli });
  assert(b.script, `the daemon handed docker no script: ${b.decision}`);
  const remote = path.join(b.fx.dir, 'remote', 'fixture.git');
  const mainBefore = b.fx.remoteHead('main');
  const r = boxReplay({
    script: b.script, timoneCommit: timoneCommit ?? execFileSync('git', ['-C', REPO_ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), projectRemote: remote,
    agent: [
      `git checkout -q -B "${BR}"; echo x > STATUS.md; git add -A; git -c user.email=a@b -c user.name=a commit -qm 'docs: STATUS.md - probe'`,
      `echo "=== own"; git push origin "HEAD:refs/heads/${BR}" 2>&1; echo EXIT=$?`,
      'echo "=== main"; git push origin HEAD:main 2>&1; echo EXIT=$?',
      'echo "=== config"; git config core.hooksPath /dev/null; git push origin HEAD:main 2>&1; echo EXIT=$?; git config --unset core.hooksPath',
      'echo "=== merge"; gh pr merge 5 2>&1; echo EXIT=$?',
      'echo "=== contents"; gh api -X PUT repos/probe-owner/fixture/contents/STATUS.md -f message=x -f content=eA== -f branch=main 2>&1; echo EXIT=$?',
    ],
  });
  const res = { ...r, envLine: b.envLine, mainBefore, mainAfter: b.fx.remoteHead('main'), own: b.fx.remoteHead(BR) };
  b.fx.cleanup();
  return res;
};
const BOX_NEW = memo(() => boxRun(CLI));
const BOX_OLD = memo(async () => boxRun(await OLD(), BEFORE_PHASE_43));
const section = (out, name) => (out.split(`=== ${name}\n`)[1] ?? '').split('\n=== ')[0];
function assertBoxPush(r) {
  assert(r.code === 0 && r.agentRan, `the box script did not reach the agent (exit ${r.code}): ${r.out.slice(-400)}`);
  assert(/EXIT=0/.test(section(r.out, 'own')) && r.own, `the push to the work branch did not land in the box: ${section(r.out, 'own')}`);
  assert(r.mainAfter === r.mainBefore, `the remote's main moved from inside the box: ${r.mainBefore} → ${r.mainAfter}`);
  assert(refused(section(r.out, 'main')) && refused(section(r.out, 'config')), `a push to main from the box was not refused: ${section(r.out, 'main')} / ${section(r.out, 'config')}`);
}
await clause('PRD-05.R3 step sessions, part 1 (box)', "in a box, the agent's push to main is refused, also when the project's own git config sets core.hooksPath; its own work branch still takes the push", {
  broken: async () => assertBoxPush(await BOX_OLD()),
  correct: async () => assertBoxPush(await BOX_NEW()),
});
function assertBoxForge(r) {
  assert(refused(section(r.out, 'merge')) && refused(section(r.out, 'contents')), `gh in the box let a merge or a write to main through: ${section(r.out, 'merge')} / ${section(r.out, 'contents')}`);
  const reached = r.ghCalls.filter((c) => /^pr merge|contents\/STATUS\.md/.test(c));
  assert(reached.length === 0, `a refused call still reached gh in the box: ${reached.join(' | ')}`);
}
await clause('PRD-05.R3 step sessions, part 2 (box)', 'in a box, gh pr merge and a contents write to main are refused before gh runs', {
  broken: async () => assertBoxForge(await BOX_OLD()),
  correct: async () => assertBoxForge(await BOX_NEW()),
});
// The box refuses to start the agent when the guard cannot be installed: this tree's script,
// over a Timone checkout that has no guard to install (the commit before phase 43).
const BOX_NO_GUARD = memo(async () => {
  const b = await boxScript({ cli: CLI });
  const r = boxReplay({ script: b.script, timoneCommit: BEFORE_PHASE_43, projectRemote: path.join(b.fx.dir, 'remote', 'fixture.git'), agent: ['echo agent ran'] });
  b.fx.cleanup();
  return r;
});
function assertStopsWithoutGuard(r) {
  assert(!r.agentRan && r.code !== 0 && /Refusing to work without it/.test(r.out), `the box started the agent with no push guard (exit ${r.code}, agent ran: ${r.agentRan}): ${r.out.slice(-300)}`);
}
await clause('PRD-05.R3 step sessions, part 1 (box, no guard)', 'a box whose push guard cannot be installed stops before the agent starts', {
  broken: async () => assertStopsWithoutGuard(await BOX_OLD()),
  correct: async () => assertStopsWithoutGuard(await BOX_NO_GUARD()),
});

// Part 3: inside a box the ledger is empty; the checks learn their run from the box.
function assertDeclared(r) {
  assert(/TIMONE_RUN_PROJECT=fixture TIMONE_RUN_BRANCH=timone\/12-add-a-count-of-open-to-dos/.test(r.envLine), `the box was not told which run it belongs to: ${r.envLine}`);
}
await clause('PRD-05.R3 step sessions, part 3 (box declares its run)', 'the daemon hands the box the run\'s project and work branch', {
  broken: async () => assertDeclared(await BOX_OLD()),
  correct: async () => assertDeclared(await BOX_NEW()),
});
function assertChecksReadDeclaration(cli) {
  const fx = fixture({ cli });
  try {
    const decl = { TIMONE_RUN_PROJECT: 'fixture', TIMONE_RUN_BRANCH: BR };
    const pre = (command) => ({ session_id: 'probe-decl', transcript_path: '/dev/null', cwd: fx.dir, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } });
    const deny = (r) => /"permissionDecision":"deny"/.test(r.out);
    assert(deny(hookCli(cli, 'guard', fx, pre('git -c core.hooksPath=/dev/null push origin HEAD:main'), decl)), 'with the box\'s declaration and an empty ledger, the guard let a run switch its push guard off');
    assert(!deny(hookCli(cli, 'guard', fx, pre('git -c core.hooksPath=/dev/null push origin HEAD:main'))), 'with no declaration (a person\'s own session), the guard refused');
    assert(!deny(hookCli(cli, 'guard', fx, pre(`git push origin HEAD:${BR}`), decl)), 'the guard refused an ordinary push to the work branch');
    const sid = 'probe-decl-stop';
    const ev = (e) => ({ session_id: sid, transcript_path: '/dev/null', cwd: fx.dir, hook_event_name: e, stop_hook_active: false });
    hookCli(cli, 'baseline', fx, ev('SessionStart'), decl);
    plantStatusCommit(fx, BR, sid);
    const c = hookCli(cli, 'check', fx, ev('Stop'), decl);
    assert(!/STATUS\.md was written/.test(c.out), `with the box's declaration, a status file on the run's own work branch was reported: ${c.out.slice(0, 300)}`);
  } finally { fx.cleanup(); }
}
await clause('PRD-05.R3 step sessions, part 3 (checks read it)', 'with an empty ledger, the checks take the box\'s declaration: the guard treats the session as the run, and the run\'s own-branch status file is not reported', {
  broken: async () => assertChecksReadDeclaration(await OLD()),
  correct: async () => assertChecksReadDeclaration(CLI),
});
const ENVFILE_NEW = memo(() => Promise.all(['TIMONE_RUN_BRANCH=main', 'TIMONE_RUN_PROJECT=other'].map(async (line) => { const b = await boxScript({ cli: CLI, envFile: [line] }); b.fx.cleanup(); return { line, ...b, fx: undefined }; })));
const ENVFILE_OLD = memo(async () => { const cli = await OLD(); return Promise.all(['TIMONE_RUN_BRANCH=main', 'TIMONE_RUN_PROJECT=other'].map(async (line) => { const b = await boxScript({ cli, envFile: [line] }); b.fx.cleanup(); return { line, ...b, fx: undefined }; })); });
function assertEnvFileRefused(rs) {
  for (const r of rs) assert(!r.script && /Refused: The step did not start: .*sets TIMONE_RUN_/.test(r.decision), `a project's run environment file with ${r.line} did not stop the step (docker got a script: ${!!r.script}; ${r.decision || r.envLine})`);
}
await clause('PRD-05.R3 step sessions, part 3 (env file cannot redirect)', "a project's run environment file that sets TIMONE_RUN_BRANCH or TIMONE_RUN_PROJECT stops the step before a box starts", {
  broken: async () => assertEnvFileRefused(await ENVFILE_OLD()),
  correct: async () => assertEnvFileRefused(await ENVFILE_NEW()),
});

// Part 4: the status-file check, both directions, from planted state.
function statusCase(cli, { where, declare = false, ledger = false }) {
  const fx = fixture({ cli });
  try {
    const sid = `probe-status-${where.replace(/\W/g, '')}-${declare ? 'd' : ''}${ledger ? 'l' : ''}`;
    const env = declare ? { TIMONE_RUN_PROJECT: 'fixture', TIMONE_RUN_BRANCH: BR } : {};
    if (ledger) plantRun(fx, sid);
    const ev = (e) => ({ session_id: sid, transcript_path: '/dev/null', cwd: fx.dir, hook_event_name: e, stop_hook_active: false });
    hookCli(cli, 'baseline', fx, ev('SessionStart'), env);
    plantStatusCommit(fx, where, sid);
    return hookCli(cli, 'check', fx, ev('Stop'), env).out;
  } finally { fx.cleanup(); }
}
function assertDefaultBranchReported(cli) {
  for (const how of [{ declare: true }, { ledger: true }]) {
    const out = statusCase(cli, { where: 'main', ...how });
    const finding = out.split('⚠️').find((f) => /STATUS\.md/.test(f)) ?? '';
    assert(finding, `a run's STATUS.md commit on main was not reported (${JSON.stringify(how)}): ${out.slice(0, 200) || '(silent)'}`);
    assert(finding.includes(BR), `the finding does not name the work branch: ${finding}`);
    assert(!/Nobody reading `main`|not on `main`/.test(finding), `the finding still sends the run to main: ${finding}`);
  }
}
await clause('PRD-05.R3 step sessions, part 4 (default branch reported)', "a run's STATUS.md commit on the default branch is reported — run known from the ledger or from the box — and the finding names the work branch, not main, as the place for it", {
  broken: async () => assertDefaultBranchReported(await OLD()),
  correct: async () => assertDefaultBranchReported(CLI),
});
function assertOtherDirections(cli) {
  assert(!/STATUS\.md was written/.test(statusCase(cli, { where: 'main' })), 'a person\'s own session was reported for writing STATUS.md on main');
  assert(!/STATUS\.md was written/.test(statusCase(cli, { where: BR, ledger: true })), 'a run was reported for STATUS.md on its own work branch (ledger)');
  assert(!/STATUS\.md was written/.test(statusCase(cli, { where: BR, declare: true })), 'a run was reported for STATUS.md on its own work branch (box declaration)');
  assert(/STATUS\.md was written on `timone\/12/.test(statusCase(cli, { where: BR })), 'a person\'s own session writing STATUS.md on a work branch is no longer reported');
}
await clause('PRD-05.R3 step sessions, part 4 (the other directions)', 'a person\'s own session on main and a run on its own work branch are not reported; a person\'s own session on a work branch still is', {
  broken: async () => assertOtherDirections(await OLD()),
  correct: async () => assertOtherDirections(CLI),
});
// The same, end to end: a host-side step commits STATUS.md on main; its Stop hook hands the finding back.
const STOP_RUN = async (cli) => {
  const r = await stepSession({ cli, stage: 'verification', waitForStop: true, commands: (fx) => [`${P(fx)}git checkout -q main && echo s > STATUS.md && git add STATUS.md && git -c user.email=a@b -c user.name=a commit -qm "docs: STATUS.md — probe" -m "Timone-Stage: verification"; echo EXIT=$?`] });
  r.fx.cleanup();
  return r;
};
const STOP_NEW = memo(() => STOP_RUN(CLI));
const STOP_OLD = memo(async () => STOP_RUN(await OLD()));
function assertStopFeedback(r) {
  const finding = r.after.split('⚠️').find((f) => /STATUS\.md was written/.test(f)) ?? '';
  assert(finding && finding.includes(BR) && !/Nobody reading `main`/.test(finding), `the step's Stop hook did not hand back a STATUS.md-on-main finding naming the work branch: ${r.after.slice(0, 400) || '(nothing)'}`);
}
await clause('PRD-05.R3 step sessions, part 4 (end to end)', 'a step session that commits STATUS.md on main is told, when it stops, to move it to its work branch', {
  broken: async () => assertStopFeedback(await STOP_OLD()),
  correct: async () => assertStopFeedback(await STOP_NEW()),
});

// Part 5: the written process. Text, read at this tree and at the commit before phase 43.
const OLD_RULE = /written only on the project's default branch — never on a work branch|never on a work branch/;
function readAt(rev, file) { return rev ? execFileSync('git', ['-C', REPO_ROOT, 'show', `${rev}:${file}`], { encoding: 'utf8' }) : fs.readFileSync(path.join(REPO_ROOT, file), 'utf8'); }
function assertProcessText(rev) {
  const live = (t) => t.replace(/~~[\s\S]*?~~/g, '');
  const proc = live(readAt(rev, 'process.md'));
  assert(!OLD_RULE.test(proc), 'process.md still says the status file is written only on the default branch');
  assert(/In a run, a step that owns a work branch writes `STATUS\.md` on that branch/.test(proc) && /A step that owns no branch writes no `STATUS\.md`/.test(proc), 'process.md does not say where a run writes its status file');
  for (const skill of ['timone-verify', 'timone-deliver']) {
    const t = live(readAt(rev, `.claude/skills/${skill}/SKILL.md`));
    assert(!OLD_RULE.test(t) && !/on the project's default branch, never on the phase branch/.test(t), `${skill} still tells a run to write STATUS.md on the default branch`);
    assert(/In a run, on the phase's work branch/.test(t), `${skill} does not say a run writes STATUS.md on its work branch`);
  }
  assert(/in a run this step owns no work branch, so that means no `STATUS\.md`/.test(readAt(rev, '.claude/skills/timone-wayfind/SKILL.md')), 'the wayfinding skill does not say a run writes no STATUS.md');
}
await clause('PRD-05.R3 step sessions, part 5 (written process)', 'process.md and the checking, delivery and wayfinding skills no longer tell a run to write STATUS.md on the default branch, and say where it goes instead', {
  broken: async () => assertProcessText(BEFORE_PHASE_43),
  correct: async () => assertProcessText(null),
});
const NOBRANCH = async (cli) => {
  const r = await stepSession({ cli, stage: 'triage', commands: (fx) => [`${P(fx)}git checkout -q -B probe-x && git -c user.email=a@b -c user.name=a commit -q --allow-empty -m x && git push origin HEAD:refs/heads/probe-x 2>&1; echo EXIT=$?`] });
  const res = { ...r, pushed: r.fx.remoteHead('probe-x') };
  r.fx.cleanup();
  return res;
};
const NB_NEW = memo(() => NOBRANCH(CLI));
const NB_OLD = memo(async () => NOBRANCH(await OLD()));
function assertNoBranchStep(r) {
  assert(/This step has no work branch, so it commits and pushes nothing/.test(r.brief.replace(/\s+/g, ' ')), 'a step that owns no branch is not told it commits nothing to the project');
  assert(refused(r.outs[0]) && !r.pushed, `a step that owns no branch pushed a branch: ${r.outs[0]}`);
}
await clause('PRD-05.R3 step sessions, part 5 (a step with no branch)', 'a step that owns no work branch is told it commits nothing to the project, and its push is refused', {
  broken: async () => assertNoBranchStep(await NB_OLD()),
  correct: async () => assertNoBranchStep(await NB_NEW()),
});

finish('PRD-05.R3');
