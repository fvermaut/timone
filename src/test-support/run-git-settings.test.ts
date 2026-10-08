import { describe, expect, it } from "vitest";

import { withoutRunGitSettings } from "./run-git-settings.js";

/**
 * `withoutRunGitSettings` on a plain object, never on `process.env`. A run's
 * container switches the push guard on through numbered git settings; these
 * cases check that the helper takes exactly those away and puts them back.
 */

describe("withoutRunGitSettings", () => {
  it("removes the numbered git settings and leaves every other variable alone", () => {
    const env: NodeJS.ProcessEnv = {
      GIT_CONFIG_COUNT: "2",
      GIT_CONFIG_KEY_0: "core.hooksPath",
      GIT_CONFIG_VALUE_0: "/run/hooks",
      GIT_CONFIG_KEY_1: "timone.runBranch",
      GIT_CONFIG_VALUE_1: "timone/1-a-run",
      GIT_AUTHOR_NAME: "bot",
      PATH: "/bin",
    };

    withoutRunGitSettings(env);

    expect(env).toEqual({ GIT_AUTHOR_NAME: "bot", PATH: "/bin" });
  });

  it("puts back each removed setting with its exact value, and leaves alone a variable added since", () => {
    const env: NodeJS.ProcessEnv = {
      GIT_CONFIG_COUNT: "2",
      GIT_CONFIG_KEY_0: "core.hooksPath",
      GIT_CONFIG_VALUE_0: "/run/hooks",
      GIT_CONFIG_KEY_1: "timone.runBranch",
      GIT_CONFIG_VALUE_1: "timone/1-a-run",
      GIT_AUTHOR_NAME: "bot",
      PATH: "/bin",
    };

    const restore = withoutRunGitSettings(env);
    env.ADDED_BY_THE_TEST = "yes";
    restore();

    expect(env).toEqual({
      GIT_CONFIG_COUNT: "2",
      GIT_CONFIG_KEY_0: "core.hooksPath",
      GIT_CONFIG_VALUE_0: "/run/hooks",
      GIT_CONFIG_KEY_1: "timone.runBranch",
      GIT_CONFIG_VALUE_1: "timone/1-a-run",
      GIT_AUTHOR_NAME: "bot",
      PATH: "/bin",
      ADDED_BY_THE_TEST: "yes",
    });
  });

  it("changes nothing outside a run, where none of the settings are set", () => {
    const env: NodeJS.ProcessEnv = {
      GIT_AUTHOR_NAME: "bot",
      HOME: "/home/bot",
      PATH: "/bin",
    };

    const restore = withoutRunGitSettings(env);
    expect(env).toEqual({ GIT_AUTHOR_NAME: "bot", HOME: "/home/bot", PATH: "/bin" });

    restore();
    expect(env).toEqual({ GIT_AUTHOR_NAME: "bot", HOME: "/home/bot", PATH: "/bin" });
  });

  it("removes a numbered setting with no count beside it, and leaves alone names that only start the same way", () => {
    const env: NodeJS.ProcessEnv = {
      GIT_CONFIG_KEY_7: "timone.runBranch",
      GIT_CONFIG_VALUE_7: "timone/1-a-run",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIGURE: "yes",
    };

    withoutRunGitSettings(env);

    expect(env).toEqual({ GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIGURE: "yes" });
  });
});
