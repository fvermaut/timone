// Probe for PRD-01.R2 — Project manifest.
//
// Register clause (verbatim):
//   GIVEN a `timone.yaml` declaring a project with repo URL, local path, stack,
//   and platform bindings
//   WHEN Timone loads its configuration
//   THEN the project is listed as managed with the declared attributes, and an
//   entry missing a required field is rejected with an error naming the field
//
// The single register bullet carries two assertions; each is labelled and each
// has its own break step. Authored 2026-09-04 from the register alone.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cli, clause, assert, finish } from './_lib.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-prd01r2-'));

function manifest(dir, body) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'timone.yaml'), body);
  return dir;
}

const DECLARED = `projects:
  fixture:
    repo_url: https://example.invalid/fixture.git
    path: projects/fixture
    stack:
      - typescript
    bindings:
      ticketing: github
      preview: docker
`;

// Same shape, one declared value changed to another the manifest accepts.
// The listing still succeeds, so a red here proves the probe reads the row the
// CLI printed rather than asserting a constant.
const OTHER = DECLARED.replace('typescript', 'rust');

clause(
  'PRD-01.R2 clause 1a',
  'the project is listed as managed with the declared attributes',
  {
    broken: () => {
      // Declare different attributes; the assertion below must stop holding.
      const dir = manifest(path.join(tmp, 'break-1a'), OTHER);
      const r = cli(['projects', 'list'], dir);
      assertListing(r);
    },
    correct: () => {
      const dir = manifest(path.join(tmp, 'ok-1a'), DECLARED);
      const r = cli(['projects', 'list'], dir);
      assertListing(r);
    },
  },
);

function assertListing(r) {
  assert(r.code === 0, `exit ${r.code}; stderr: ${r.err.trim()}`);
  const row = r.out.split('\n').find((l) => l.startsWith('fixture'));
  assert(row, `no row for the declared project in:\n${r.out}`);
  for (const want of ['projects/fixture', 'typescript', 'github', 'docker']) {
    assert(row.includes(want), `row does not carry the declared "${want}": ${row.trim()}`);
  }
}

for (const field of ['repo_url', 'path', 'stack', 'bindings']) {
  clause(
    `PRD-01.R2 clause 1b (${field})`,
    'an entry missing a required field is rejected with an error naming the field',
    {
      broken: () => {
        // Nothing missing: the rejection must not fire, so the assertion goes red.
        const dir = manifest(path.join(tmp, `break-1b-${field}`), DECLARED);
        assertRejection(cli(['projects', 'list'], dir), field);
      },
      correct: () => {
        const dir = manifest(path.join(tmp, `ok-1b-${field}`), strip(DECLARED, field));
        assertRejection(cli(['projects', 'list'], dir), field);
      },
    },
  );
}

function strip(text, field) {
  const cuts = {
    repo_url: '    repo_url: https://example.invalid/fixture.git\n',
    path: '    path: projects/fixture\n',
    stack: '    stack:\n      - typescript\n',
    bindings: '    bindings:\n      ticketing: github\n      preview: docker\n',
  };
  return text.replace(cuts[field], '');
}

function assertRejection(r, field) {
  assert(r.code !== 0, `the manifest was accepted (exit 0):\n${r.out}`);
  const said = `${r.out}${r.err}`;
  assert(said.includes(field), `the error does not name the field "${field}": ${said.trim()}`);
}

finish('PRD-01.R2');
