# Phase 01 — Verification Report (iteration 1)
**Date:** 2026-07-19   **Verifier scope:** 2 current-phase criteria (R1 human-verified separately)

## Summary

| ID | Priority | Channel | Verdict |
|----|----------|---------|---------|
| PRD-01.R2 — Project manifest | MUST | api | PASS |
| PRD-01.R3 — Workspace sync | MUST | api | PASS |

Environment: `npm install` + `npm run build` succeeded; `npm test` — 18/18 tests passed (2 files).
All verification was black-box via `node dist/cli.js`; no implementation source was read.
Fixture repos were local (`git init --bare` + seeded clone pushed via `file://` URL); no network cloning.
All scratch artifacts (fixture repos, test manifests, `projects/syncproj` clone) were removed afterwards; `git status` at the timone root is clean apart from this report.

## Evidence

### PRD-01.R2 — PASS

**Valid entry is listed as managed with its declared attributes.**

Manifest (`valid.yaml`, in scratch dir):

```yaml
projects:
  pilot-app:
    repo_url: git@github.com:fvermaut/pilot-app.git
    path: projects/pilot-app
    stack:
      - typescript
      - react
    bindings:
      ticketing: github
      preview: docker
```

```
$ node dist/cli.js projects list --manifest $SCRATCH/valid.yaml
NAME       PATH                STACK             TICKETING  PREVIEW  CLONED
pilot-app  projects/pilot-app  typescript,react  github     docker   no
exit=0
```

Declared path, stack, and both platform bindings are shown. (The repo URL itself is not a column in the list output, but it is a declared, validated attribute — an entry missing it is rejected, below.)

**Entry missing a required field is rejected with an error naming the field.**

Manifest (`mixed.yaml`) contained one valid entry (`good-app`) and one entry (`bad-app`) with no `repo_url`:

```
$ node dist/cli.js projects list --manifest $SCRATCH/mixed.yaml
Invalid manifest: project "bad-app": missing required field "repo_url"
exit=1
```

The error names both the offending project and the missing field, and the exit code is non-zero. Additional variants behave consistently:

```
$ node dist/cli.js projects list --manifest $SCRATCH/missing-path.yaml
Invalid manifest: project "no-path": missing required field "path"
exit=1

$ node dist/cli.js projects list --manifest $SCRATCH/missing-bindings.yaml
Invalid manifest: project "no-bindings": missing required field "bindings"
exit=1
```

### PRD-01.R3 — PASS

Fixture: local bare repo `origin.git` (branch `main`) with a seeded commit, referenced from the manifest as `repo_url: file://$SCRATCH/repos/origin.git`, `path: projects/syncproj`. All sync commands run from the timone root.

**Run 1 — missing path is cloned to the declared path under `projects/`, invisible to root git status.**

```
$ node dist/cli.js workspace sync --manifest $SCRATCH/sync.yaml
syncproj  cloned
exit=0

$ git -C projects/syncproj log --oneline
fb02fde initial commit

$ git status --porcelain --ignored=no | grep projects
(no output — projects/ not visible to timone root git status; git status --short is clean)
```

**Run 2 — clean, already-cloned project is fast-forwarded.**

A second commit was pushed to the fixture origin, then:

```
$ node dist/cli.js workspace sync --manifest $SCRATCH/sync.yaml
syncproj  updated
exit=0

$ git -C projects/syncproj log --oneline
6edc171 second commit
fb02fde initial commit
```

**Run 3 — clone with uncommitted changes is left untouched and reported.**

A third commit was pushed to origin, and `projects/syncproj/README.md` was given an uncommitted local edit:

```
$ node dist/cli.js workspace sync --manifest $SCRATCH/sync.yaml
syncproj  skipped (dirty)
exit=0

$ git -C projects/syncproj log --oneline
6edc171 second commit          # third commit NOT pulled
fb02fde initial commit

$ git -C projects/syncproj status --short
 M README.md                   # local edit preserved
$ tail -1 projects/syncproj/README.md
local uncommitted edit
```

**Runs 4–5 — recovery and idempotency.** After reverting the local edit, sync fast-forwarded to the third commit (`syncproj  updated`, log head `3d0991d third commit`); an immediate re-run reported `syncproj  up-to-date` with exit 0.
