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
