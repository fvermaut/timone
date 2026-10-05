import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Command } from "commander";

import { loadManifest } from "../manifest.js";
import { updateChecks, type PlanChecks, type RunGit, type UpdateChecks } from "../update-checks.js";

/**
 * `timone update-checks <project> [--before <commit>] [--json]` — print the
 * three test sets an update runs on the project's checked-out branch: the
 * project's test command, the check scripts of the branch's own plan, and
 * those of each plan that arrived on the default branch since `--before`.
 * The update asks it before it merges, so `--before` is `HEAD` by default.
 *
 * It exits 2 with one sentence when the project is unknown or git fails.
 */
export function registerUpdateChecksCommand(program: Command): void {
  program
    .command("update-checks")
    .description("Say which tests and check scripts an update of the project's branch runs")
    .argument("<project>", "the project, as named in the manifest")
    .option("--before <commit>", "the branch's commit before the default branch was merged in", "HEAD")
    .option("--json", "print the answer as JSON")
    .option("--manifest <path>", "path to the timone manifest file", "timone.yaml")
    .action(
      (project: string, options: { before: string; json?: boolean; manifest: string }) => {
        try {
          const manifest = loadManifest(options.manifest);
          const config = manifest.projects[project];
          if (config === undefined) {
            const known = Object.keys(manifest.projects).join(", ") || "none";
            throw new Error(
              `I don't know a project called "${project}"; the projects I know are: ${known}.`,
            );
          }
          const dir = resolve(process.cwd(), config.path);
          if (!existsSync(dir)) {
            throw new Error(`The project "${project}" is not checked out at ${dir}.`);
          }
          const git = gitIn(dir);
          const defaultBranch = git(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"])
            .trim()
            .replace(/^origin\//, "");
          const checks = updateChecks(git, { defaultBranch, before: options.before });
          console.log(
            options.json === true
              ? JSON.stringify(checks, null, 2)
              : plainText(checks, defaultBranch, options.before),
          );
        } catch (error) {
          console.error(error instanceof Error ? error.message : String(error));
          process.exitCode = 2;
        }
      },
    );
}

/** The port `updateChecks` takes: git run in `dir`, throwing a sentence that names the command when it fails. */
function gitIn(dir: string): RunGit {
  return (args) => {
    try {
      return execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      const said =
        error instanceof Error && "stderr" in error && typeof error.stderr === "string"
          ? error.stderr.trim()
          : String(error);
      throw new Error(`\`git ${args.join(" ")}\` failed in ${dir}: ${said}`);
    }
  };
}

/** The three sets as a person reads them, one block each. */
function plainText(checks: UpdateChecks, defaultBranch: string, before: string): string {
  const blocks = [
    checks.testCommand === undefined
      ? "The project has no test command: there is no scripts.test in its package.json."
      : `The project's tests: ${checks.testCommand}`,
    checks.own === undefined
      ? "This branch adds no plan."
      : planBlock(`This branch's plan, ${checks.own.phase}:`, checks.own),
    ...(checks.arrived.length === 0
      ? [`No plan arrived on ${defaultBranch} since ${before}.`]
      : checks.arrived.map((plan) =>
          planBlock(
            plan.pullRequest === undefined
              ? `Arrived on ${defaultBranch}, ${plan.phase}:`
              : `Arrived on ${defaultBranch} with pull request #${plan.pullRequest}, ${plan.phase}:`,
            plan,
          ),
        )),
  ];
  return blocks.join("\n\n");
}

/** One plan's block: its heading, then each requirement with its check script. */
function planBlock(heading: string, plan: PlanChecks): string {
  if (plan.checks.length === 0) return `${heading}\n  It claims no requirement.`;
  return [heading, ...plan.checks.map((check) => `  ${check.id}: ${check.script ?? "no check script"}`)].join("\n");
}
