# Standards — Testing & TDD

> **Status: Approved 2026-07-19 (fvermaut).**
> Companion to `process.md` stages 5–6, which own the process (seams declared at planning, red→green at those seams, the three anti-patterns rejected there). This entry is the *how* on our stack (Vitest + Playwright over Next.js / Prisma / Postgres). When in doubt, the spec wins.

## What a good test is

- It observes behaviour through the **public interface of a declared seam**, never internal wiring. Refactor test: if it breaks when the implementation changes but behaviour doesn't, it is implementation-coupled [2].
- It reads as a specification: the name states behaviour under a condition ("rejects an overlapping booking with 409"); one condition per test [1].
- Expected values come from a source **independent of the code under test** (PRD criterion, hand-computed example, fixed input→output pair) — recomputing them the code's way is the tautological anti-pattern (stage 6).
- Test code gets production-level care [1], with one inversion: prefer visible duplication over clever abstraction — a reviewer must read a test top-to-bottom without chasing a homegrown DSL.

## Seam selection

Which boundaries earn tests (agreed at planning, stage 5):

- **Pure domain logic** (pricing, validation, date math) → unit seam: the exported function/module. Push behaviour here whenever possible [1].
- **Service seams** (use-case function orchestrating Prisma + domain logic) → integration seam against real Postgres.
- **Route handlers / server actions** → the HTTP contract: status, body shape, auth behaviour — by invoking the handler or fetching a running dev server, never asserting on internals.
- **A handful of user journeys** → Playwright, only flows whose breakage is a business incident (auth, the core loop).
- **Not seams:** React component internals, Prisma query shapes, private helpers reachable through a public seam. A helper that seems to need direct tests wants to be an exported domain module — extract it, then unit-test the export.

## Pyramid posture (Vitest + Playwright)

"Write lots of small and fast unit tests. Write some more coarse-grained tests and very few high-level tests." [1]

- **Vitest unit** — node environment, pure logic, zero I/O.
- **Vitest integration** — real local Postgres (Compose service or testcontainer) through the real Prisma client; isolation via per-worker database/schema or per-test truncation. On a CRUD-heavy app this level carries most of the confidence — a mocked-Prisma "integration" test verifies nothing about the actual query or constraint.
- **Playwright e2e** — user-visible behaviour only [4]; third parties we don't control are mocked at the network layer ("Only test what you control" [4]).
- Duplicate-coverage rule: a higher-level failure with no lower-level test failing means write the lower-level test [1] — then consider deleting the redundant high-level assertion.

## Mocking discipline

- **Classical by default, never mockist** [2]: real collaborators in-process; doubles only where the real thing is slow, non-deterministic, or external. Mocking the unit's *own* collaborators breeds implementation-coupled tests.
- Mock only at **seams we own facing things we don't**: outbound HTTP clients (payments, email), the clock (`vi.setSystemTime` / `vi.useFakeTimers` [3]), randomness.
- **Prisma is never mocked.** DB behaviour is proven against real Postgres at the integration seam; unit tests simply don't reach the DB — extract the logic instead.
- `vi.mock` is a last resort. Vitest's caveat that a module's *internal* calls bypass the mock [5] is a design-smell detector: move the boundary, don't fight the mock.

## Fixtures and factories

- Prefer **fixtures** (`test.extend` in Vitest, Playwright fixtures) over `beforeEach` chains: setup/teardown live together, fixtures compose, and only what a test uses is initialized (lazy in both [6][7]).
- Test data via **factory functions** (`buildUser(overrides)`): sensible defaults, explicit overrides — assertions reference only values the test itself set.
- **No shared seed dump**; each test builds its own state from scratch, never trusting a predecessor's cleanup [3].

## Flake posture

- A flaky test is quarantined (skipped with a linked ticket) or deleted the day it flakes — never re-run-until-green — and fixed or removed within the week [3].
- "Never use bare sleeps to wait for asynchronous responses" [3]: in Playwright, web-first assertions — `await expect(locator).toBeVisible()` waits; `expect(await locator.isVisible())` doesn't [4].
- Playwright's fail-then-pass "flaky" verdict [8] is a failure to fix, not a pass. Retries exist to *surface* flakes on CI, not absorb them.

## Tooling (enforced in config, never restated in prose)

- `vitest.config.ts` — unit/integration split as separate `projects`; `coverage.thresholds` (optionally `autoUpdate` as a ratchet) [9] — the numbers live there, not in any doc; `mockReset: true` so mock state can't leak [5].
- `playwright.config.ts` — `retries` on CI only, `forbidOnly` on CI, trace on first retry so flaky verdicts arrive with evidence [8].

## Sources

1. Vocke, H. — *The Practical Test Pyramid* — <https://martinfowler.com/articles/practical-test-pyramid.html>
2. Fowler, M. — *Mocks Aren't Stubs* — <https://martinfowler.com/articles/mocksArentStubs.html>
3. Fowler, M. — *Eradicating Non-Determinism in Tests* — <https://martinfowler.com/articles/nonDeterminism.html>
4. Playwright — *Best Practices* — <https://playwright.dev/docs/best-practices>
5. Vitest — *Mocking* — <https://vitest.dev/guide/mocking>
6. Playwright — *Fixtures* — <https://playwright.dev/docs/test-fixtures>
7. Vitest — *Test Context* — <https://vitest.dev/guide/test-context>
8. Playwright — *Retries* — <https://playwright.dev/docs/test-retries>
9. Vitest — *Coverage config* — <https://vitest.dev/config/coverage>

Process alignment: `process.md` — stage 5 (seams declared at planning), stage 6 (red→green, anti-patterns, refactoring deferred to delivery review).
