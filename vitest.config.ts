import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    passWithNoTests: true,
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
