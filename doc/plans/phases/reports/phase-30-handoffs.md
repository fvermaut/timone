# Phase 30 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 30e — A session request describes a workspace instead of a path

**Built.** A session request can now say what to clone and at which versions, instead of only naming a folder on the daemon's disk. `SessionRequest` gains an optional `workspace`: the timone remote at one exact commit, and the target project's remote plus the branch this chunk's run works on. The two remotes and the pin are what a container needs to build itself (ADR-0041 D1), and the pin is a **commit** — a request built from a branch name is refused at the build, because two runs an hour apart must follow the same rules (ADR-0041 D2).

Nothing behaves differently yet. Both places that build a request go through one new builder, `sessionRequest()`, and neither of them names a workspace, so the request the in-process runtime receives is exactly the request it received before — same keys, same values, no `workspace` key at all. `agentSdkRuntime` is untouched.

**Files touched.**

- `src/daemon/session.ts` — added `TimonePin`, `SessionWorkspace`, `WorkspaceInput`, `SessionRequestInput` and the `sessionRequest()` builder; added the optional `workspace` field to `SessionRequest`; routed both build sites (the pipeline stage and the approval-record session) through the builder.
- `src/daemon/session.test.ts` — added a `describe("the request builder")` block with five tests; added `sessionRequest` to the existing import from `./session.js`. No existing test was changed.
- `doc/plans/phases/reports/phase-30-handoffs.md` — created, this file.

**Decisions taken inside the slice.**

- **The builder is a new exported function, not an extracted method.** There was no single builder: two object literals, at `session.ts:794` and `session.ts:1417`. A free function is testable without standing up a spawner, an adapter and a ledger, which is what the declared seam asks for. Both sites now call it.
- **`workspace` is optional on the request.** The spawner has no source for the timone remote or commit today, and supplying one would mean changing `src/commands/daemon.ts`, which this slice may not touch. Optional is the smallest widening that leaves every existing caller working and gives 30h a field to fill. 30h makes it required in practice by always supplying it.
- **The builder validates the pin and throws.** "Names a commit, not a branch" had to be a real behaviour or case (1) would only assert that a copy is a copy. The rule is `^[0-9a-f]{40}$` — what `git rev-parse HEAD` reports. A throw, not a result type, per `standards/typescript.md`: a request built from a branch name is a wiring mistake, not a domain failure, and it must stop at the build rather than surface later as two runs that behaved differently for no visible reason.
- **The builder assembles the project half rather than copying it.** Its input takes the `TicketingProject` the spawner already holds plus the branch, and maps `repoUrl` → `remote`, `name` → `name`. A builder that only copied its argument would be a middle man (`standards/code-smells.md`).
- **The "absent, not undefined" discipline moved into the builder.** The comment that used to sit at the pipeline call site now sits in the one place both paths pass through, and covers `workspace` as well as `effort`. Call sites can pass `effort: effortFor(stage)` directly.
- **`TimonePin` was extracted** after the third case, because `{ remote, commit }` was travelling in two signatures — a data clump with no name.

**Validation evidence.**

Red → green, one case at a time, each run as `npx vitest run src/daemon/session.test.ts -t "<name>"`.

1. **Case (1a) — "pins timone to the commit the daemon is running".** Written first. Red: `TypeError: (0 , sessionRequest) is not a function` at `session.test.ts:3672`. Green after adding `SessionWorkspace` (timone half only), the `workspace` field and the builder, and routing both build sites through it.
2. **Case (1b) — "refuses a timone version that is a branch name rather than a commit".** Red: `AssertionError: expected [Function] to throw an error / Expected: null / Received: undefined` — the builder happily accepted `commit: "main"`. Green after adding the `COMMIT` check and the throw.
3. **Case (2) — "names the target project's work branch, and where to clone it from".** Red: `AssertionError: expected { name: 'scratch-app', …(1) } to deeply equal { name: 'scratch-app', …(2) }` — `branch` and `remote` missing, the raw `repoUrl` leaking through. Green after adding the `project` half to `SessionWorkspace` and the `workspaceOf` mapping. Case (1a)'s fixture then had to gain the project and branch the type now requires; its assertion was not touched.
4. **Case (3) — "hands the in-process runtime what it received before, when no workspace is named" and "leaves the effort key out, rather than undefined, for a stage that declares none".** Green on arrival, as the plan predicted, so no red was fabricated. **Mutation probe instead:** the builder's two spreads were replaced with plain assignments (`effort: input.effort`, `workspace: … ?? undefined`). Both tests failed for real — `AssertionError: expected { cwd: '/root', prompt: 'go', …(3) } to strictly equal { cwd: '/root', prompt: 'go', …(1) }` and `AssertionError: expected [ 'cwd', 'prompt', 'model', …(2) ] to deeply equal [ 'cwd', 'prompt', 'model' ]`. The mutation was reverted and both went green again. The tests are not vacuous.

Validation block — `npm run build && npm test`:

- `npm run build` (`tsc`) — clean, no output.
- `npm test` — **27 files, 1129 tests, all passed**, 51.5s. Five of those are new; the other 1124 are unchanged and green.
- ☑ *Red→green trace for all three cases* — cases (1) and (2) driven red with the actual failure output recorded above; case (3) green on arrival with a real mutation-probe failure recorded, per the plan's own instruction not to fabricate a red.
- ☑ *The full suite passes unchanged* — no existing assertion was edited, no other file was touched, and `src/commands/guardrails.test.ts:205` (the documented real-git flake) passed on both full runs.

No test reaches the network or starts a model: the five new tests call one pure function.

**What 30f must know.**

- The field is `SessionRequest.workspace?: SessionWorkspace` and it is still **never populated in production**. The daemon builds every request without one. Filling it is 30h's job, and until then the container runtime will be handed `undefined` if it is wired up before that.
- 30h supplies a workspace by passing `workspace: { timone, project, branch }` to `sessionRequest()` — `project` is the `TicketingProject` the spawner already has in `spawn()`, and `branch` is `store.get(run.id)?.branch`, which is **undefined for a run that has not cut one yet**. The branch a run will use is derivable with `workBranch(ticket, seq)`, already imported in `session.ts`; deciding which of the two 30h uses is 30h's call, not a defect here.
- The timone remote and commit have no source anywhere in the daemon yet. Nothing reads `git rev-parse HEAD`, and nothing implements ADR-0041 D2's "a daemon with uncommitted changes refuses to spawn". Both are still owed. The builder will throw if handed anything that is not 40 hex digits, so whatever resolves the pin must resolve it fully, not to a short sha and not to `HEAD`.
- `agentSdkRuntime` was deliberately left untouched. It reads `request.cwd`, `prompt`, `model`, `effort` and nothing else, so it already ignores the new field.

## 30g — The base image

**Built.** The box a daemon-spawned run happens in. `Dockerfile` at the repository root builds `timone-agent` on Playwright's own published image, adds the toolchain, `gh`, the Claude Code CLI and the library that drives the browsers, and adds **no docker CLI**. `.dockerignore` keeps the host out of the build: the context is deny-by-default, so `projects/` — every client repository on this machine — cannot reach an image layer. `docker/image-check.mjs`, copied in at `/opt/timone/image-check.mjs`, is the script that asserts the five properties the plan names, and it fails loudly rather than reading a number off a `df` line.

Nothing else changed. No file under `src/`, no `package.json`, no test config.

**Files touched.**

- `Dockerfile` — created. `FROM mcr.microsoft.com/playwright:v1.62.1-noble`, then apt (`ca-certificates`, `curl`, `git`, `jq`, `openssh-client`, `unzip`), `gh` from the vendor's release tarball, `@anthropic-ai/claude-code`, and `playwright` into `/opt/timone` with the browser download skipped. Every version is an `ARG` with a pinned default.
- `.dockerignore` — created. `*` then `!docker/image-check.mjs`, followed by explicit re-denies for `projects/`, `node_modules/`, `dist/`, `.timone/`, `.git/`, `daemon.log`, `*.png`, `.playwright-mcp/`.
- `docker/image-check.mjs` — created. The source of the check script; the Dockerfile copies it to `/opt/timone/image-check.mjs`.
- `doc/plans/phases/reports/phase-30-handoffs.md` — this section appended.

**Decisions taken inside the slice.**

- **Base tag: `mcr.microsoft.com/playwright:v1.62.1-noble`.** This repo pins no Playwright version anywhere — `standards/testing.md` names Playwright but no version, `.mcp.json` runs `@playwright/mcp@latest`, and `package.json` has no Playwright dependency at all. So there was nothing to match, and the rule was "current stable, pinned". `v1.62.1` is the newest tag Microsoft publishes; `noble` is Ubuntu 24.04 LTS. The tag resolves to a multi-arch manifest, so the same line builds on this arm64 laptop and on an amd64 server. **Never `latest`** — ADR-0041 D2 makes two runs an hour apart follow identical rules, and a floating base tag would make that untrue for the image.
- **`/dev/shm` is fixed at run time, with `--shm-size=1g`, and the image cannot fix it alone.** Measured: the image run with no flag gets **64 MiB**, docker's default. The alternative — `--disable-dev-shm-usage` — was rejected: it is a *browser launch argument*, so it would have to be injected into every managed project's own Playwright config, which is code we do not own and must not edit. The container's run arguments are code we do own. **This is 30h's to pass** (see below).
- **The shm floor is 256 MiB, not 1 GiB.** Playwright's guidance is 1 GiB, which is what the daemon should pass; the floor sits below it so a smaller but workable size still passes, and far above 64 MiB so the docker default can never pass.
- **`gh` comes from the release tarball, not the apt channel.** The apt channel serves whatever it serves on the day of the build. A tarball URL carries the version as a number in the Dockerfile.
- **`playwright` is npm-installed into `/opt/timone` with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`.** The browsers are already in the base image at `/ms-playwright`; this adds only the library that drives them, and a second copy of the browsers would have doubled the image for nothing.
- **The container runs as root, as the base image does.** No user was added. The wall here is the container, not a uid inside it; if 30h or a later slice wants `pwuser` (which the base image already provides), that is a change to the run, not to this file.

**Validation evidence.**

**No red→green trace applies.** The plan says so in as many words — "the image is not unit-testable and this slice does not pretend otherwise" — and this slice added no unit-testable behaviour. What follows is every command as run, with its real output.

*Build context.* `.dockerignore` was written before the first build. Buildkit reports:

```
#3 [internal] load .dockerignore
#3 transferring context: 826B done
#4 [internal] load build context
#4 transferring context: 3.76kB done
```

**3.76 kB** — not hundreds of megabytes. Proved rather than inferred: a probe build of `FROM scratch` + `COPY . /ctx` against the same context, exported and listed, contains exactly one file:

```
ctx/docker/image-check.mjs
```

`projects/`, `node_modules/`, `dist/`, `.timone/`, `.git/` and the four root PNGs are all absent from the context.

*Build.*

```
docker build -t timone-agent .
```

- **Wall time, first build: 6 min 42 s.** Broken down by step: base image `FROM` 58.6 s, apt 58.1 s, `gh` 9.6 s, **`npm install -g @anthropic-ai/claude-code` 251.3 s** (the bulk of it), `npm install playwright` 22.5 s, `COPY` 0.0 s.
- **Rebuild after changing only `image-check.mjs`: 18.8 s.** That is the cost every future edit to the check script pays; the six-minute figure is paid once per base or version change.
- **Image size: 3.33 GB**, against a base image of **2.79 GB** — so this slice adds about 540 MB.

*The five assertions.* Assertions (1), (2), (4) and the reading for (5):

```
$ docker run --rm timone-agent /bin/sh -c '
  node -v && gh --version && claude --version &&
  ! command -v docker && ! test -e /var/run/docker.sock && df -h /dev/shm'
v24.18.1
gh version 2.97.0 (2026-07-31)
https://github.com/cli/cli/releases/tag/v2.97.0
2.1.238 (Claude Code)
Filesystem      Size  Used Avail Use% Mounted on
shm              64M     0   64M   0% /dev/shm
exit=0
```

Node is v24.18.1, comfortably over the `>=22` this repo's `package.json` requires.

Assertion (3), and (5) as a number rather than a `df` line. **Run with no flag, the image fails its own check** — which is the point:

```
$ docker run --rm timone-agent node /opt/timone/image-check.mjs
FAIL  /dev/shm size — 64 MiB against a floor of 256 MiB
PASS  no docker CLI — not on PATH
PASS  no docker socket — /var/run/docker.sock absent
PASS  chromium loads a page — version 151.0.7922.34
PASS  firefox loads a page — version 153.0
PASS  webkit loads a page — version 26.5

1 check(s) failed: /dev/shm size
exit=1
```

Run the way 30h must run it, everything passes:

```
$ docker run --rm --shm-size=1g timone-agent node /opt/timone/image-check.mjs
PASS  /dev/shm size — 1024 MiB against a floor of 256 MiB
PASS  no docker CLI — not on PATH
PASS  no docker socket — /var/run/docker.sock absent
PASS  chromium loads a page — version 151.0.7922.34
PASS  firefox loads a page — version 153.0
PASS  webkit loads a page — version 26.5

all checks passed
exit=0
```

Summary of the five, all against the built image: (1) the CLI answers `--version` — **pass**, `2.1.238`; (2) `gh` is present — **pass**, `2.97.0`; (3) each browser launches headless **and loads a real page** — **pass**, Chromium 151.0.7922.34, Firefox 153.0, WebKit 26.5; (4) `docker` is absent and `/var/run/docker.sock` does not exist — **pass**; (5) `/dev/shm` measured against a floor — **64 MiB by default, 1024 MiB with the flag**, floor 256 MiB.

*Non-vacuity.* The script was broken deliberately twice and watched failing, then reverted.

- **The browser leg.** The test page was changed to serve `a page that says the wrong thing` while the check still expected its marker. All three browsers reported the wrong text, so all three really navigated and read the DOM rather than merely launching:

  ```
  FAIL  chromium loads a page — page loaded but read "a page that says the wrong thing"
  FAIL  firefox loads a page — page loaded but read "a page that says the wrong thing"
  FAIL  webkit loads a page — page loaded but read "a page that says the wrong thing"
  3 check(s) failed  /  exit=1
  ```

  Reverted; the rebuilt image is green, and the deliberately broken image was deleted.

- **The docker-absence leg.** A dummy executable was mounted at `/usr/local/bin/docker` and an empty file at `/var/run/docker.sock`. Both checks flipped, so neither is a check that can only ever say yes:

  ```
  FAIL  no docker CLI — /usr/local/bin/docker
  FAIL  no docker socket — /var/run/docker.sock present
  2 check(s) failed  /  exit=1
  ```

- **The shm leg** proved itself without being touched: 64 MiB fails, 1024 MiB passes, same script, same image.

*Note worth carrying.* Even at 64 MiB of shared memory, all three browsers loaded the small test page fine. That is exactly why the plan insisted assertion (5) be a number against a floor: the browser leg would not have caught it, and the failure it prevents shows up later, mid-run, looking like an unrelated crash.

**What 30h must know.**

- **Pass `--shm-size=1g` on every `docker run` that starts an agent box.** The image cannot set it, and without it Chromium dies on real pages while the browsers still pass a shallow smoke test. 30h's red-green case (5) asserts on "the arguments actually passed" — **`--shm-size=1g` belongs in that assertion** alongside "nothing from the host filesystem is mounted".
- **Mount nothing.** The image and the check script both assume it. `/var/run/docker.sock` must never appear in a run's arguments; the check will catch it if it does, and that check is worth running in CI against whatever 30h builds.
- **The image is `timone-agent`, built from the repository root.** It is **not a preview** — no preview vocabulary, no preview adapter, nothing in `src/adapters/docker-preview.ts` applies to it.
- **Startup cost is real and it is front-loaded, not per-run.** 3.33 GB and six and a half minutes to build once; a run pays only container start. Whatever 30h does, it must not rebuild the image per run.
- **The check script is a run-time gate 30h can reuse.** `docker run --rm --shm-size=1g timone-agent node /opt/timone/image-check.mjs` exits non-zero on any failure, so it works as a preflight before a session is handed to a fresh box.
- **Node inside the box is v24.18.1** and `npm` is the base image's. Nothing about the Claude Code CLI's install path was customised: `claude` is on `PATH` at `/usr/bin/claude`, `gh` at `/usr/local/bin/gh`, `node` at `/usr/bin/node`.
