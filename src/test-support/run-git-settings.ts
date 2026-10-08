/**
 * A numbered git setting, as git reads it from the environment:
 * `GIT_CONFIG_COUNT`, `GIT_CONFIG_KEY_<n>` or `GIT_CONFIG_VALUE_<n>`.
 * `GIT_CONFIG_NOSYSTEM` and other names that only start the same way are not
 * numbered settings, so they do not match.
 */
const RUN_GIT_SETTING = /^GIT_CONFIG_(COUNT|KEY_\d+|VALUE_\d+)$/;

/**
 * Takes the run's numbered git settings out of `env`, and returns a function
 * that puts them back (PRD-11).
 *
 * A run's container switches the push guard on through these variables. The
 * push guard refuses any push that does not go to the run's own branch. Some
 * tests make a throwaway repository and push `main` to it; inside a run's
 * container the push guard refuses that push, and the test fails for a reason
 * that has nothing to do with the code it checks. Outside a run none of these
 * variables are set, and the call changes nothing.
 *
 * It removes only `GIT_CONFIG_COUNT`, `GIT_CONFIG_KEY_<digits>` and
 * `GIT_CONFIG_VALUE_<digits>`. Nothing else in `env` is touched. The returned
 * function puts back each removed variable with its exact value, and leaves
 * alone any variable added after the call.
 *
 * **For tests only.** It runs no git and builds no path.
 *
 * It edits the object itself rather than using `vi.stubEnv`.
 * `guardrails.test.ts` calls `vi.unstubAllEnvs()` in the middle of a test, and
 * that call puts back everything `vi.stubEnv` changed. A variable removed with
 * `vi.stubEnv` would come back halfway through that test. A variable removed
 * by plain code stays removed until the returned function runs.
 */
export function withoutRunGitSettings(
  env: NodeJS.ProcessEnv = process.env,
): () => void {
  const removed: [name: string, value: string | undefined][] = [];
  for (const name of Object.keys(env)) {
    if (RUN_GIT_SETTING.test(name)) {
      removed.push([name, env[name]]);
      delete env[name];
    }
  }
  return () => {
    for (const [name, value] of removed) {
      env[name] = value;
    }
  };
}
