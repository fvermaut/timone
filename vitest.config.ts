import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    passWithNoTests: true,
    // A whole class of tests here drives **real git** rather than a fake —
    // `guardrails.test.ts` and `session.test.ts` build actual repositories and
    // shell out a dozen times per case, deliberately, because the rules they
    // check are rules about git and a fake would prove nothing about them.
    //
    // Vitest's 5s default is not sized for that. Those tests pass comfortably
    // alone and sit near the limit under a parallel full run, so the suite had
    // a latent flake that surfaced as roughly one failure in eight, with no
    // stable name attached to it. Phase 23's 23b added twenty tests, tipped
    // `resolves the session id against the ledger` over the edge every time,
    // and turned the flake into a reproducible failure — which is how it was
    // finally diagnosed on 2026-08-15.
    //
    // This is not masking a slow implementation: nothing in production waits
    // on git for five seconds. It is admitting that a real-git fixture is I/O
    // bound and giving it room. A test that needs more than this is asking a
    // real question about its own design.
    testTimeout: 20_000,
    // Managed project checkouts are independent repos with their own runners
    // and their own config (Playwright, path aliases, a database). Sweeping
    // them into Timone's run reports failures belonging to another repo and
    // drowns the signal this command exists to give.
    //
    // **Two places hold such a checkout, not one.** `projects/` is where they
    // are cloned; `.timone/previews/` is where phase 16 checks a pull
    // request's commit out to build a preview from. Both are client source
    // inside the timone root, and the second was missed until 16e's live gate
    // turned `npm test` red on a to-do app's Playwright specs.
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "projects/**",
      ".timone/**",
    ],
  },
});
