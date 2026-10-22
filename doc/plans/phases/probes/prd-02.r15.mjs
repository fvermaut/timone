// PRD-02.R15 — Post-session guardrail hooks.
// Stage 7 artifact, authored 2026-10-18 (phase 64 verification, timone#250) from the register
// alone. No source and no test was read.
//
// The register's fifth clause, verbatim:
//   GIVEN a clean session of either kind
//   WHEN the hooks run
//   THEN they stay silent
//
// PARTIAL BY DESIGN. Phase 64 claims clause 5 for one false finding only: a session whose work
// holds PRD-07.R3's note as the register has it. That note says, of the build before phase 60,
// "that ticket was never woken". Nothing in the note says a clause was not seen to hold, so a
// session that commits it, and pushes it, is clean, and the hooks must say nothing. Clauses 1 to
// 4 (a first sighting handed back, a run flagged, a person's session journalled) are not claimed
// by this phase and are not checked here; the register's own note on R15 says what they owe is
// a live observation. A later pass that checks them adds their labels to this file.
//
// Break leg: the same session, run on the build just before phase 64 (`ba699d2`, the base of
// timone/250), where the hooks are known to speak on this note. It must go red there.
//
// ✏ 2026-10-22 (phase 65 verification, timone#90): six labels added, from the register's clauses
// 1 and 5 alone. No source and no test was read. Phase 65 claims both clauses for one false
// finding: commits that GitHub's servers built, which a session only pulled, were reported as
// commits "made in this session". The register's clause 1, verbatim:
//   GIVEN any agent session at the timone root completes, whether the daemon spawned it or a
//   human started it
//   WHEN the guardrail hooks run
//   THEN violations of the deterministic rules — commits left unpushed, `STATUS.md` written
//   anywhere but the default branch, files touched outside `projects/<target>/` (process
//   artifacts excepted per R2), and commits made without a `Timone-Stage` trailer — are reported
//   loudly
// Clause 5 labels: a session that pulls GitHub's one-parent squash merges (#231), a run that cuts
// its branch from a main that moved (#101), a session that pulls GitHub's two-parent merge. Each
// session is clean: what it made itself carries its trailer and reached the remote.
// Clause 1 labels: a session's own untrailed merge, two parents or one, and an untrailed commit
// whose committer is a person's `…@users.noreply.github.com` address. Each must be reported.
// A GitHub-built commit is made here as GitHub makes one: committer `GitHub <noreply@github.com>`,
// in a second clone, landed on the remote's main. The container sets GIT_COMMITTER_* in the
// environment, which beats `-c user.email`, so every commit here sets its identity in the env.
//
//   node doc/plans/phases/probes/prd-02.r15.mjs                     break leg, then real leg
//   PROBE_REAL_ONLY=1 node doc/plans/phases/probes/prd-02.r15.mjs   real leg only
//   PROBE_REAL_ONLY=1 PROBE_BREAK_FOR='<label>|<label>' …           break leg for the named labels
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { clause, assert, finish, fixture, REPO_ROOT, CLI } from './_rig.mjs';
import { hookCli, plantRun, BR } from './_steps.mjs';
import { oldBuild } from './_old-build.mjs';
import { registerSession, block } from './_register-session.mjs';

import { BEFORE_PHASE_64 } from './_register-session.mjs';
const PRD = path.join(REPO_ROOT, 'doc', 'specs', 'prd');
const PRD07 = path.join(PRD, fs.readdirSync(PRD).find((f) => /^prd-07-.*\.criteria\.md$/.test(f)));
const R3 = block(PRD07, 'R3');
assert(R3 && /was never woken/.test(R3) && /\*\*Status:\*\* verified/.test(R3), "PRD-07.R3 in the register no longer holds the note this probe is about (verified, 'was never woken')");

function assertSilent(cli) {
  for (const kind of ['person', 'run']) {
    // The register file as the project has it, whole, and R3's block alone in a file of its own.
    for (const [name, text] of [['whole PRD-07 register', fs.readFileSync(PRD07, 'utf8')], ['R3 alone', `# PRD-01 — criteria\n\n${R3}`]]) {
      const r = registerSession(cli, { kind, files: { [name === 'R3 alone' ? 'doc/specs/prd/prd-01-probe.criteria.md' : `doc/specs/prd/${path.basename(PRD07)}`]: text } });
      assert(/^## \S+\.\.\.origin\/\S+$/.test(r.status), `${kind} session, ${name}: the session's commit did not reach the remote (${r.status}), so the session was not clean`);
      assert(r.code === 0 && r.out.trim() === '', `${kind} session, ${name}: the hooks spoke on a clean session (exit ${r.code}): ${r.out.slice(0, 400)}`);
    }
  }
}

await clause('PRD-02.R15 clause 5', 'GIVEN a clean session of either kind WHEN the hooks run THEN they stay silent — a session that commits and pushes PRD-07.R3 as the register has it ("that ticket was never woken")', {
  broken: async () => assertSilent(oldBuild(BEFORE_PHASE_64)),
  correct: async () => assertSilent(CLI),
});

// ---------------------------------------------------------------- phase 65 (timone#90)

// main just before phase 65: the base of timone/90's branch. The hooks there are known to report
// GitHub's one-parent squash merges (#90, #101, #231).
const BEFORE_PHASE_65 = 'c5f0fc875e5b3c79b34799e0a1971c6a9d1dd154';
const GITHUB = { name: 'GitHub', email: 'noreply@github.com' };
const PERSON = { name: 'A Person', email: 'person@example.invalid' };
const SESSION_ID = { name: 'probe session', email: 'session@example.invalid' };
const NOREPLY_PERSON = { name: 'someone', email: '12345+someone@users.noreply.github.com' };

const who = (author, committer = author) => ({
  GIT_AUTHOR_NAME: author.name, GIT_AUTHOR_EMAIL: author.email,
  GIT_COMMITTER_NAME: committer.name, GIT_COMMITTER_EMAIL: committer.email,
});
const G = (cwd, args, env = {}) => execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const trailer = (sid, stage = 'verification') => `\n\nTimone-Stage: ${stage}\nTimone-Session: ${sid}`;
function put(dir, file, text) {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  fs.writeFileSync(path.join(dir, file), text);
}

// One session, seen from outside. `onRemote(gh)` runs in a second clone (GitHub's side) after the
// session's baseline and lands main on the remote; `work(clone, sid)` is what the session does.
// Whatever the session leaves on a branch is put on the remote by a fetch run in the remote (a
// run's container refuses pushes that are not to its own work branch; _register-session.mjs).
function session(cli, { kind, onRemote, work, look = [] }) {
  const sid = `probe-r15-90-${kind}`;
  const fx = fixture({ cli });
  try {
    const clone = path.join(fx.dir, 'projects', 'fixture');
    const bare = path.join(fx.dir, 'remote', 'fixture.git');
    if (kind === 'run') plantRun(fx, sid, BR);
    const ev = (e) => ({ session_id: sid, transcript_path: '/dev/null', cwd: fx.dir, hook_event_name: e, stop_hook_active: false });
    hookCli(cli, 'baseline', fx, ev('SessionStart'));
    if (onRemote) {
      // GitHub's side sits outside the timone root, as GitHub's servers do: a folder inside the
      // root would be the session's own change outside `projects/<target>/`.
      const gh = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-r15-github-'));
      try {
        G(gh, ['clone', '-q', bare, '.']);
        onRemote(gh);
        G(bare, ['fetch', '-q', gh, 'main:main']);
      } finally {
        fs.rmSync(gh, { recursive: true, force: true });
      }
    }
    const made = work(clone, sid);
    const branch = G(clone, ['rev-parse', '--abbrev-ref', 'HEAD']);
    G(bare, ['fetch', '-q', '-f', clone, `${branch}:${branch}`]);
    G(clone, ['fetch', '-q', 'origin']);
    if (branch !== 'main') G(clone, ['branch', '-q', '--set-upstream-to', `origin/${branch}`]);
    const status = G(clone, ['status', '-sb']).split('\n')[0];
    const shape = (rev) => {
      const [parents, ce] = G(clone, ['log', '-1', '--format=%P%x09%ce', rev]).split('\t');
      return { sha: G(clone, ['rev-parse', '--short', rev]), parents: parents.split(' ').filter(Boolean).length, committer: ce };
    };
    const shapes = Object.fromEntries(look.map((rev) => [rev, shape(rev)]));
    const r = hookCli(cli, 'check', fx, ev('Stop'));
    return { ...r, status, made, shape: (rev) => shapes[rev] };
  } finally {
    fx.cleanup();
  }
}

// GitHub squash-merges a pull request: one commit, one parent, GitHub as committer, no trailer
// that git reads.
function squashes(n, committer = GITHUB) {
  return (gh) => {
    for (let k = 1; k <= n; k++) {
      put(gh, `src/feature-${k}.txt`, `feature ${k}\n`);
      G(gh, ['add', '-A']);
      G(gh, ['commit', '-q', '-m', `Feature ${k} (#${100 + k})\n\n* feat: feature ${k}\n\n* docs: say so`], who(PERSON, committer));
    }
  };
}
// GitHub merges a pull request with a merge commit: two parents, GitHub as committer. The pull
// request's own commit carries the trailer of the session that made it, which is not this one.
function mergeCommit(committer = GITHUB) {
  return (gh) => {
    G(gh, ['checkout', '-q', '-b', 'feat']);
    put(gh, 'src/feat.txt', 'feat\n');
    G(gh, ['add', '-A']);
    G(gh, ['commit', '-q', '-m', `feat: a feature${trailer('another-session', 'execution')}`], who(PERSON));
    G(gh, ['checkout', '-q', 'main']);
    put(gh, 'src/main-side.txt', 'main moved\n');
    G(gh, ['add', '-A']);
    G(gh, ['commit', '-q', '-m', `docs: main moved${trailer('a-third-session', 'execution')}`], who(PERSON));
    G(gh, ['merge', '-q', '--no-ff', 'feat', '-m', 'Merge pull request #12 from probe-owner/feat'], who(PERSON, committer));
  };
}
const pullFF = (clone) => G(clone, ['pull', '-q', '--ff-only', 'origin', 'main'], who(SESSION_ID));

function assertQuiet(r, what) {
  assert(/^## main\.\.\.origin\/main$|^## \S+\.\.\.origin\/\S+$/.test(r.status) && !/ahead|behind/.test(r.status), `${what}: the session's work did not end level with the remote (${r.status}), so it was not a clean session`);
  assert(r.code === 0 && r.out.trim() === '', `${what}: the hooks spoke on a clean session (exit ${r.code}): ${r.out.replace(/\s+/g, ' ').slice(0, 400)}`);
}
function assertReported(r, sha, what) {
  assert(r.code !== 0 && r.out.includes(sha) && /Timone-Stage/.test(r.out), `${what}: the hooks did not report commit ${sha} (exit ${r.code}): ${r.out.replace(/\s+/g, ' ').slice(0, 400) || '(no output)'}`);
}

// Clause 5, #231: a session that only pulls GitHub's squash merges.
function pulledSquashes(cli, kind, committer) {
  const r = session(cli, {
    kind,
    look: ['origin/main', 'origin/main~1', 'origin/main~2'],
    onRemote: squashes(3, committer),
    work: (clone, sid) => {
      pullFF(clone);
      if (kind === 'run') {
        G(clone, ['checkout', '-q', '-b', BR]);
        put(clone, 'doc/note.md', 'work\n');
        G(clone, ['add', '-A']);
        G(clone, ['commit', '-q', '-m', `docs: work${trailer(sid)}`], who(SESSION_ID));
      }
    },
  });
  // Transport: the session really holds three one-parent commits with the committer asked for.
  for (const rev of ['origin/main', 'origin/main~1', 'origin/main~2']) {
    const s = r.shape(rev);
    assert(s.parents === 1 && s.committer === committer.email, `instrument: ${rev} is not a one-parent commit by ${committer.email} (${JSON.stringify(s)})`);
  }
  return r;
}

const L5_SQUASH = 'PRD-02.R15 clause 5, GitHub squash merges pulled';
await clause(L5_SQUASH, 'GIVEN a clean session of either kind WHEN the hooks run THEN they stay silent — a person\'s session on main runs `git pull --ff-only` and receives three one-parent commits GitHub built (committer noreply@github.com, no trailer), as in #231', {
  broken: async () => assertQuiet(pulledSquashes(oldBuild(BEFORE_PHASE_65), 'person', GITHUB), 'build before phase 65'),
  correct: async () => assertQuiet(pulledSquashes(CLI, 'person', GITHUB), 'this build'),
});

const L5_BRANCH = 'PRD-02.R15 clause 5, run branched from a main GitHub moved';
await clause(L5_BRANCH, 'GIVEN a clean session of either kind WHEN the hooks run THEN they stay silent — a run pulls main after GitHub squash-merged three pull requests, cuts its work branch from it, commits with its own trailer and puts the branch on the remote, as in #101', {
  broken: async () => assertQuiet(pulledSquashes(oldBuild(BEFORE_PHASE_65), 'run', GITHUB), 'build before phase 65'),
  correct: async () => assertQuiet(pulledSquashes(CLI, 'run', GITHUB), 'this build'),
});

function pulledMerge(cli, committer) {
  const r = session(cli, { kind: 'person', look: ['origin/main'], onRemote: mergeCommit(committer), work: (clone) => pullFF(clone) });
  const s = r.shape('origin/main');
  assert(s.parents === 2 && s.committer === committer.email, `instrument: origin/main is not a two-parent commit by ${committer.email} (${JSON.stringify(s)})`);
  return r;
}
const L5_MERGE = 'PRD-02.R15 clause 5, GitHub two-parent merge pulled';
await clause(L5_MERGE, 'GIVEN a clean session of either kind WHEN the hooks run THEN they stay silent — a person\'s session pulls a two-parent merge commit GitHub built', {
  // The build before phase 65 already excused this shape, so the break is in the one fact the
  // clause rests on: the same merge, pulled the same way, built by a person instead of GitHub.
  // The plan keeps that case reported on purpose; the probe must go red on it.
  broken: async () => assertQuiet(pulledMerge(CLI, PERSON), 'the same merge with a person as committer'),
  correct: async () => assertQuiet(pulledMerge(CLI, GITHUB), 'this build'),
});

// Clause 1: what the session made itself, untrailed, is reported, whatever its shape.
// The break gives the same commit GitHub's committer address, which is the one thing that
// excuses a commit; the probe must go red there.
function ownMerge(cli, kind, committer) {
  const r = session(cli, {
    kind,
    look: ['HEAD'],
    work: (clone, sid) => {
      if (kind === 'run') G(clone, ['checkout', '-q', '-b', BR]);
      const base = G(clone, ['rev-parse', '--abbrev-ref', 'HEAD']);
      G(clone, ['checkout', '-q', '-b', 'side']);
      put(clone, 'doc/side.md', 'side\n');
      G(clone, ['add', '-A']);
      G(clone, ['commit', '-q', '-m', `docs: side${trailer(sid)}`], who(SESSION_ID));
      G(clone, ['checkout', '-q', base]);
      put(clone, 'doc/base.md', 'base\n');
      G(clone, ['add', '-A']);
      G(clone, ['commit', '-q', '-m', `docs: base${trailer(sid)}`], who(SESSION_ID));
      G(clone, ['merge', '-q', '--no-ff', 'side', '-m', 'Merge branch side'], who(SESSION_ID, committer));
      G(clone, ['branch', '-q', '-D', 'side']);
      return G(clone, ['rev-parse', '--short', 'HEAD']);
    },
  });
  const s = r.shape('HEAD');
  assert(s.parents === 2 && s.committer === committer.email, `instrument: the session's merge is not two-parent by ${committer.email} (${JSON.stringify(s)})`);
  return r;
}
function ownSquash(cli, kind, committer) {
  const r = session(cli, {
    kind,
    look: ['HEAD'],
    work: (clone, sid) => {
      if (kind === 'run') G(clone, ['checkout', '-q', '-b', BR]);
      const base = G(clone, ['rev-parse', '--abbrev-ref', 'HEAD']);
      G(clone, ['checkout', '-q', '-b', 'side']);
      put(clone, 'doc/side.md', 'side\n');
      G(clone, ['add', '-A']);
      G(clone, ['commit', '-q', '-m', `docs: side${trailer(sid)}`], who(SESSION_ID));
      G(clone, ['checkout', '-q', base]);
      G(clone, ['merge', '-q', '--squash', 'side'], who(SESSION_ID));
      G(clone, ['commit', '-q', '-m', 'Squashed side (#7)\n\n* docs: side'], who(SESSION_ID, committer));
      G(clone, ['branch', '-q', '-D', 'side']);
      return G(clone, ['rev-parse', '--short', 'HEAD']);
    },
  });
  const s = r.shape('HEAD');
  assert(s.parents === 1 && s.committer === committer.email, `instrument: the session's squash is not one-parent by ${committer.email} (${JSON.stringify(s)})`);
  return r;
}
function ownCommit(cli, kind, committer) {
  const r = session(cli, {
    kind,
    look: ['HEAD'],
    work: (clone) => {
      if (kind === 'run') G(clone, ['checkout', '-q', '-b', BR]);
      put(clone, 'doc/plain.md', 'plain\n');
      G(clone, ['add', '-A']);
      G(clone, ['commit', '-q', '-m', 'docs: a commit with no trailer'], who(committer));
      return G(clone, ['rev-parse', '--short', 'HEAD']);
    },
  });
  const s = r.shape('HEAD');
  assert(s.committer === committer.email, `instrument: the session's commit is not by ${committer.email} (${JSON.stringify(s)})`);
  return r;
}
const bothKinds = (make, committer, what) => {
  for (const kind of ['person', 'run']) {
    const r = make(kind, committer);
    assertReported(r, r.made, `${kind} session, ${what}`);
  }
};

const L1_MERGE = 'PRD-02.R15 clause 1, a session\'s own two-parent merge';
await clause(L1_MERGE, 'GIVEN any agent session … whether the daemon spawned it or a human started it WHEN the guardrail hooks run THEN … commits made without a `Timone-Stage` trailer … are reported loudly — the session merges a branch on its own machine with `--no-ff` (two parents, the session as committer, no trailer) and puts it on the remote', {
  broken: async () => bothKinds((kind) => ownMerge(CLI, kind, GITHUB), GITHUB, 'the same merge with GitHub as committer'),
  correct: async () => bothKinds((kind) => ownMerge(CLI, kind, SESSION_ID), SESSION_ID, 'its own merge'),
});

const L1_SQUASH = 'PRD-02.R15 clause 1, a session\'s own one-parent squash';
await clause(L1_SQUASH, 'GIVEN any agent session … WHEN the guardrail hooks run THEN … commits made without a `Timone-Stage` trailer … are reported loudly — the session squashes a branch on its own machine (`git merge --squash`, one parent, the session as committer, no trailer) and puts it on the remote', {
  broken: async () => bothKinds((kind) => ownSquash(CLI, kind, GITHUB), GITHUB, 'the same squash with GitHub as committer'),
  correct: async () => bothKinds((kind) => ownSquash(CLI, kind, SESSION_ID), SESSION_ID, 'its own squash'),
});

const L1_NOREPLY = 'PRD-02.R15 clause 1, a person\'s users.noreply.github.com address';
await clause(L1_NOREPLY, 'GIVEN any agent session … WHEN the guardrail hooks run THEN … commits made without a `Timone-Stage` trailer … are reported loudly — the session makes an untrailed commit whose committer is `12345+someone@users.noreply.github.com`, a person\'s GitHub address, not GitHub\'s own', {
  broken: async () => bothKinds((kind) => ownCommit(CLI, kind, GITHUB), GITHUB, 'the same commit with GitHub as committer'),
  correct: async () => bothKinds((kind) => ownCommit(CLI, kind, NOREPLY_PERSON), NOREPLY_PERSON, 'a person\'s noreply address'),
});

finish('PRD-02.R15');
