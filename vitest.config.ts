import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    passWithNoTests: true,
    // Managed project checkouts are independent repos with their own runners
    // and their own config (Playwright, path aliases, a database). Sweeping
    // them into Timone's run reports failures belonging to another repo and
    // drowns the signal this command exists to give.
    exclude: ["**/node_modules/**", "**/dist/**", "projects/**"],
  },
});
