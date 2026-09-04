// Probe for PRD-01.R3 — Workspace sync.
//
// Register clauses (verbatim):
//   1. GIVEN a manifest project whose local path does not exist
//      WHEN workspace sync runs
//      THEN the repo is cloned to the declared path under `projects/`, and that
//      path is invisible to Timone's own git status
//   2. GIVEN an already-cloned project with no local changes
//      WHEN workspace sync runs
//      THEN the clone is fast-forwarded; a clone with uncommitted changes is
//      left untouched and reported
//
// Each assertion is labelled and each has its own break step. The remote is a
// local bare repository, so the probe needs no network and touches nothing
// outside a temporary directory. Authored 2026-09-04 from the register alone.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, sh, clause, assert, finish } from './_lib.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-prd01r3-'));
let n = 0;

// Build a fresh world: a bare remote holding one commit, plus a directory
// standing in for a timone root that declares it.
function world({ ignoreProjects = true, declaredPath = 'projects/fixture' } = {}) {
  const w = path.join(tmp, `w${n++}`);
  const origin = path.join(w, 'origin.git');
  const seed = path.join(w, 'seed');
  const root = path.join(w, 'root');
  fs.mkdirSync(w, { recursive: true });
  sh(`git init -q --bare -b main "${origin}"`);
  sh(`git init -q -b main "${seed}"`);
  sh('git config user.email probe@timone.invalid && git config user.name probe', seed);
  fs.writeFileSync(path.join(seed, 'file.txt'), 'one\n');
  sh('git add -A && git commit -qm c1', seed);
  sh(`git push -q "${origin}" main`, seed);

  fs.mkdirSync(root, { recursive: true });
  sh('git init -q -b main .', root);
  sh('git config user.email probe@timone.invalid && git config user.name probe', root);
  fs.writeFileSync(path.join(root, '.gitignore'), ignoreProjects ? 'projects/\n' : '# nothing ignored\n');
  fs.writeFileSync(
    path.join(root, 'timone.yaml'),
    `projects:\n  fixture:\n    repo_url: file://${origin}\n    path: ${declaredPath}\n    stack:\n      - typescript\n    bindings:\n      ticketing: github\n      preview: docker\n`,
  );
  sh('git add -A && git commit -qm root', root);
  return { origin, seed, root, clone: path.join(root, 'projects', 'fixture') };
}

function advanceRemote(w, message) {
  fs.appendFileSync(path.join(w.seed, 'file.txt'), `${message}\n`);
  sh(`git commit -qam ${message}`, w.seed);
  sh(`git push -q "${w.origin}" main`, w.seed);
  return sh('git rev-parse HEAD', w.seed).trim();
}

const head = (repo) => sh('git rev-parse HEAD', repo).trim();

clause(
  'PRD-01.R3 clause 1a',
  'the repo is cloned to the declared path under `projects/`',
  {
    broken: () => {
      // The manifest declares a different path; a clone at projects/fixture
      // must not appear, so the assertion goes red.
      const w = world({ declaredPath: 'projects/elsewhere' });
      cli(['workspace', 'sync'], w.root);
      assertCloned(w);
    },
    correct: () => {
      const w = world();
      const r = cli(['workspace', 'sync'], w.root);
      assert(r.code === 0, `sync exit ${r.code}: ${r.err.trim()}`);
      assertCloned(w);
    },
  },
);

function assertCloned(w) {
  assert(fs.existsSync(w.clone), 'no clone at the declared path projects/fixture');
  assert(
    head(w.clone) === head(w.seed) || sh('git log --oneline', w.clone).includes('c1'),
    'the clone does not carry the remote history',
  );
}

clause(
  'PRD-01.R3 clause 1b',
  "that path is invisible to Timone's own git status",
  {
    broken: () => {
      // The root does not ignore projects/; the clone must now show up.
      const w = world({ ignoreProjects: false });
      cli(['workspace', 'sync'], w.root);
      assertInvisible(w);
    },
    correct: () => {
      const w = world();
      cli(['workspace', 'sync'], w.root);
      assertInvisible(w);
    },
  },
);

function assertInvisible(w) {
  assert(fs.existsSync(w.clone), 'the clone was not created, so invisibility proves nothing');
  const status = sh('git status --porcelain', w.root);
  assert(!status.includes('projects'), `git status at the root reports the clone:\n${status}`);
}

clause(
  'PRD-01.R3 clause 2a',
  'an already-cloned project with no local changes is fast-forwarded',
  {
    broken: () => {
      // The clone is dirty, so sync must refuse to move it and the
      // fast-forward assertion goes red.
      const w = world();
      cli(['workspace', 'sync'], w.root);
      const target = advanceRemote(w, 'c2');
      fs.appendFileSync(path.join(w.clone, 'file.txt'), 'local edit\n');
      cli(['workspace', 'sync'], w.root);
      assert(head(w.clone) === target, 'the clone was not fast-forwarded to the remote head');
    },
    correct: () => {
      const w = world();
      cli(['workspace', 'sync'], w.root);
      const before = head(w.clone);
      const target = advanceRemote(w, 'c2');
      const r = cli(['workspace', 'sync'], w.root);
      assert(r.code === 0, `sync exit ${r.code}: ${r.err.trim()}`);
      assert(before !== target, 'the remote did not actually move; the check would be vacuous');
      assert(head(w.clone) === target, 'the clone was not fast-forwarded to the remote head');
    },
  },
);

clause(
  'PRD-01.R3 clause 2b',
  'a clone with uncommitted changes is left untouched and reported',
  {
    broken: () => {
      // The clone is clean, so sync moves it and says "updated": both halves
      // of the assertion go red.
      const w = world();
      cli(['workspace', 'sync'], w.root);
      const before = head(w.clone);
      advanceRemote(w, 'c2');
      const r = cli(['workspace', 'sync'], w.root);
      assertUntouchedAndReported(w, before, r);
    },
    correct: () => {
      const w = world();
      cli(['workspace', 'sync'], w.root);
      const before = head(w.clone);
      advanceRemote(w, 'c2');
      fs.appendFileSync(path.join(w.clone, 'file.txt'), 'local edit\n');
      const r = cli(['workspace', 'sync'], w.root);
      assertUntouchedAndReported(w, before, r);
    },
  },
);

function assertUntouchedAndReported(w, before, r) {
  assert(head(w.clone) === before, 'the clone moved despite carrying uncommitted changes');
  const said = `${r.out}${r.err}`.toLowerCase();
  assert(
    said.includes('dirty') || said.includes('skip') || said.includes('untouched') || said.includes('local change'),
    `sync did not report the clone it left alone:\n${r.out}${r.err}`,
  );
}

finish('PRD-01.R3');
