# Standards — Testing & TDD

> **Status: Draft — pending review (fvermaut).**
> Companion to `doc/process.md` stages 5–6, which own the process: seams are declared per sub-phase at planning time, implementation runs red→green at those seams only, and the three anti-patterns (implementation-coupled, tautological, horizontal slicing) are rejected there. This entry is the *how*: what a good test looks like at each seam on our stack (Vitest + Playwright over Next.js / Prisma / Postgres). It does not restate the process spec — when in doubt, the spec wins.

## What a good test is

- It observes behaviour through the **public interface of a declared seam** — never internal wiring. The refactor test: if the test breaks when the implementation changes but behaviour doesn't, it is implementation-coupled. Fowler on why we avoid the mockist style that produces such tests: "Coupling to the implementation also interferes with refactoring, since implementation changes are much more likely to break tests than with classic testing." [2]
- It reads as a specification: the name states behaviour under a condition ("rejects an overlapping booking with 409"), and each test checks **one condition** — "Test one condition per test." [1]
- Its expected values come from a source **independent of the code under test**: a PRD criterion, a hand-computed example, a fixed known input→output pair. Recomputing the expectation the code's way is the tautological anti-pattern (stage 6).
- Test code gets production-level care [1] — with one inversion: in tests, prefer visible duplication over clever abstraction. A reviewer must be able to read a single test top-to-bottom without chasing a homegrown DSL.

## Seam selection

Which boundaries earn tests (agreed at planning, stage 5):

- **Pure domain logic** (pricing, validation, date math) → unit seam: the exported function/module. Push behaviour here whenever possible — "Push your tests as far down the test pyramid as you can." [1]
- **Service seams** (a use-case function orchestrating Prisma + domain logic) → integration seam against a real Postgres.
- **Route handlers / server actions** → the HTTP contract: status, body shape, auth behaviour. Test by invoking the handler or fetching against a running dev server — never by asserting on internals.
- **A handful of user journeys** → Playwright, only flows whose breakage is a business incident (auth, the product's core loop).
- **Not seams:** React component internals, Prisma query shapes, private helpers already reachable through a public seam. A helper that seems to *need* direct tests is signalling it wants to be an exported domain module — extract it, then unit-test the export.

## Pyramid posture (Vitest + Playwright)

Shape per the pyramid: "Write lots of small and fast unit tests. Write some more coarse-grained tests and very few high-level tests." [1] On this stack:

- **Vitest unit** — node environment, pure logic, zero I/O.
- **Vitest integration** — real local Postgres (Compose service or testcontainer) through the real Prisma client; isolation via per-worker database/schema or per-test truncation. On a CRUD-heavy Next.js app this level carries most of the confidence — a mocked-Prisma "integration" test verifies nothing about the actual query or constraint.
- **Playwright e2e** — user-visible behaviour only: "verify that the application code works for the end users, and avoid relying on implementation details" [4]; third parties we don't control are mocked at the network layer ("Only test what you control" [4]).

Duplicate-coverage rule: "If a higher-level test spots an error and there's no lower-level test failing, you need to write a lower-level test" [1] — then consider deleting the redundant high-level assertion.

## Mocking discipline

- **Classical by default, never mockist**: real collaborators in-process; doubles only where the real thing is awkward (slow, non-deterministic, external). [2] Mocking the unit's *own* collaborators is how implementation-coupled tests are born: "Mockist tests are thus more coupled to the implementation of a method." [2]
- Mock only at **seams we own facing things we don't**: outbound HTTP clients (payments, email), the clock ("Always wrap the system clock, so it can be easily substituted for testing" [3] — `vi.setSystemTime` / `vi.useFakeTimers`), randomness.
- **Prisma is never mocked.** DB behaviour is proven against real Postgres at the integration seam; unit tests simply don't reach the DB — extract the logic instead.
- `vi.mock` is a last resort for module boundaries. Vitest's caveat that a module's *internal* calls bypass the mock [5] is a design smell detector: if you hit it, the seam is in the wrong place — move the boundary, don't fight the mock.

## Fixtures and factories

- Prefer **fixtures** (`test.extend` in Vitest, Playwright fixtures) over `beforeEach` chains: setup and teardown live together, fixtures compose, and only what a test uses is initialized ("Playwright Test will setup only the ones needed by your test and nothing else" [6]; Vitest fixtures are likewise lazily initialized [7]).
- Test data via **factory functions** (`buildUser(overrides)`): sensible defaults, explicit overrides for exactly what the test cares about — assertions reference only values the test itself set.
- **No shared seed dump** that tests implicitly depend on; each test builds its own state from scratch rather than trusting a predecessor's cleanup: "Keep your tests isolated from each other, so that execution of one test will not affect any others." [3]

## Flake posture

- A non-deterministic test is "a virulent infection that can completely ruin your entire test suite" [3]. The day a test flakes it is quarantined (skipped with a linked ticket) or deleted — never re-run-until-green — and fixed or removed within the week.
- "Never use bare sleeps to wait for asynchronous responses: use a callback or polling." [3] In Playwright that means web-first assertions — `await expect(locator).toBeVisible()` waits; `expect(await locator.isVisible())` doesn't [4].
- Playwright's retry classifier marks a fail-then-pass as **"flaky"** [8]; we treat that verdict as a failure to fix, not a pass. Retries exist to *surface* flakes on CI, not to absorb them.

## Tooling (enforced in config, never restated in prose)

- `vitest.config.ts` — the unit/integration split as separate `projects` (environment + setup per project); `coverage.thresholds` (`lines`/`branches`/`functions`/`statements`, optionally `autoUpdate` as a ratchet) [9] — the numbers live there, not in any doc; `mockReset: true` so mock state cannot leak between tests [5].
- `playwright.config.ts` — `retries` enabled on CI only, `forbidOnly` on CI, trace on first retry so flaky verdicts arrive with evidence [8].

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

Process alignment: `doc/process.md` — stage 5 (seams declared at planning) and stage 6 (red→green loop, anti-patterns, refactoring deferred to delivery review).
