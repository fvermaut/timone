import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Command } from "commander";

import {
  baselinePath,
  captureBaseline,
  collectEvidence,
  journalPath,
  loadBaseline,
  markSeen,
  reportGuardrails,
  saveBaseline,
  sweepBaselines,
  violationFeedback,
  type ReportTarget,
  type Violation,
} from "../daemon/hooks.js";
import { loadManifest, type Manifest } from "../manifest.js";
import { probeGuardDecision } from "../daemon/probeGuard.js";
import { RunStore, defaultStatePath, type Run } from "../daemon/runs.js";

/** How long a parked baseline outlives the session that wrote it. */
const BASELINE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** The fields of a hook payload these commands read. */
export interface HookPayload {
  session_id: string;
  cwd?: string;
  /** `PreToolUse` only: which tool is about to run, and with what. */
  tool_name?: string;
  tool_input?: unknown;
}

/**
 * Read the hook payload the CLI is given on stdin.
 *
 * Returns undefined rather than throwing on anything unreadable: this runs as
 * a hook on every session, and a guardrail that can break a session is worse
 * than one that occasionally cannot judge it.
 */
export async function readHookPayload(
  stdin: NodeJS.ReadableStream,
): Promise<HookPayload | undefined> {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(Buffer.from(chunk));
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as { session_id?: unknown }).session_id === "string"
    ) {
      return parsed as HookPayload;
    }
  } catch {
    // Fall through: no payload, nothing to key a baseline by.
  }
  return undefined;
}

export interface BaselineDeps {
  root: string;
  manifest: Manifest;
  sessionId: string;
  now: Date;
}

/**
 * `SessionStart`: park the state of the world so `Stop` has something to
 * judge against. Every declared project is baselined, because nobody has yet
 * said which one this session will touch — and an interactive session may
 * never say.
 */
export async function runBaseline(deps: BaselineDeps): Promise<string> {
  sweepBaselines(deps.root, deps.now, BASELINE_MAX_AGE_MS);
  const baseline = await captureBaseline(
    deps.root,
    Object.keys(deps.manifest.projects),
  );
  saveBaseline(
    baselinePath(deps.root, deps.sessionId),
    baseline,
    deps.now.toISOString(),
  );
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: trailerInstruction(deps.sessionId),
    },
  });
}

/**
 * What every session is told about the trailer it owes (ADR-0019).
 *
 * It arrives from the `SessionStart` hook rather than from a prompt or a
 * skill, and that is the whole point: the hook is the one place *both* kinds
 * of session pass through, so an interactive session — which follows no skill
 * and reads no stage prompt — is told the same thing as a daemon one. It is
 * also the only place the session id is known: the prompt is built before the
 * SDK has issued one.
 */
export function trailerInstruction(sessionId: string): string {
  return [
    "**Every git commit you make in this session must end with these trailers:**",
    "",
    "```",
    "Timone-Stage: <the process stage you are running, or `interactive` if none>",
    `Timone-Session: ${sessionId}`,
    "```",
    "",
    "Add `Timone-Run: <project>#<ticket>` as a third line when a run drove this",
    "session — the stage's own instructions say so and name the run when they do.",
    "",
    "These go below any `Co-Authored-By:` line and replace nothing. They are what",
    "makes machine-authored work identifiable from git history alone, and an",
    "automatic check at the end of this session reports any commit that lacks them.",
  ].join("\n");
}

export interface GuardDeps {
  store: RunStore;
  sessionId: string;
  toolInput: unknown;
}

/**
 * `PreToolUse`: refuse a builder the verifier's probes
 * ([ADR-0048](../../doc/adr/0048-a-verification-probe-is-kept-proved-able-to-fail-and-hidden-from-the-builder.md) D4).
 *
 * Returns the hook's JSON reply, or undefined to say nothing — which is the
 * answer for almost every tool call ever made. The stage comes from the
 * ledger the same way {@link runCheck} finds the run: resolved from the
 * session id, never configured, so an interactive session is recognised by
 * having no run rather than by being told it has none.
 */
export function runGuard(deps: GuardDeps): string | undefined {
  const run = runForSession(deps.store, deps.sessionId);
  const decision = probeGuardDecision({
    toolInput: deps.toolInput,
    stage: run?.stage,
  });
  if (decision === undefined) return undefined;
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      ...decision,
    },
  });
}

export interface CheckDeps {
  root: string;
  manifest: Manifest;
  store: RunStore;
  sessionId: string;
  print: (message: string) => void;
  journal: (line: string) => void;
}

/**
 * The run that drove this session, found by looking its id up in the ledger —
 * resolved rather than configured, because runs already store it
 * (`store.activate(run.id, started.sessionId)`). Undefined means a human was
 * driving.
 */
export function runForSession(store: RunStore, sessionId: string): Run | undefined {
  return store.all().find((run) => run.sessionId === sessionId);
}

/** What `Stop` decided, for the caller that has to act on it. */
export interface CheckOutcome {
  /** One line for whoever is watching the command run. */
  account: string;
  /**
   * Findings handed to the session itself (ADR-0027). Non-empty means the
   * session may not stop yet: the caller writes them where the session will
   * read them and refuses the stop.
   */
  returned: Violation[];
}

/**
 * `Stop`: judge what the session changed, and decide who hears about it.
 *
 * A missing baseline is reported rather than passed over: the checks cannot
 * judge a session they have no `before` for, and silence would look exactly
 * like a clean session.
 */
export async function runCheck(deps: CheckDeps): Promise<CheckOutcome> {
  const path = baselinePath(deps.root, deps.sessionId);
  const parked = loadBaseline(path);
  if (parked === undefined) {
    return {
      account: `no baseline was taken for session ${deps.sessionId}, so nothing could be checked`,
      returned: [],
    };
  }

  const run = runForSession(deps.store, deps.sessionId);

  const evidence = await collectEvidence(deps.root, parked.baseline, {
    sessionId: deps.sessionId,
    ...(run === undefined ? {} : { target: run.project }),
  });

  const target: ReportTarget =
    run === undefined
      ? { kind: "interactive", sessionId: deps.sessionId }
      : { kind: "run", runId: run.id };

  const disposition = await reportGuardrails(evidence, {
    store: deps.store,
    target,
    print: deps.print,
    journal: deps.journal,
    seen: parked.seen,
  });

  markSeen(path, {
    returned: disposition.returned.map((violation) => violation.summary),
    escalated: disposition.escalated.map((violation) => violation.summary),
  });

  const kind = run === undefined ? "this session" : run.id;
  if (disposition.returned.length > 0) {
    return {
      account: `guardrails handed ${disposition.returned.length} finding(s) back to ${kind}`,
      returned: disposition.returned,
    };
  }
  return {
    account:
      disposition.escalated.length === 0
        ? `guardrails clean for ${kind}`
        : `guardrails flagged ${disposition.escalated.length} violation(s) for ${kind}`,
    returned: [],
  };
}

/** Append one line to the session journal, creating it if needed. */
export function appendJournal(root: string, line: string): void {
  const path = journalPath(root);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${line}\n`, "utf8");
}

/** Register the `guardrails` command on the program. */
export function registerGuardrailsCommand(program: Command): void {
  const guardrails = program
    .command("guardrails")
    .description(
      "The automatic checks that bracket every session at the timone root",
    );

  // `--root` rather than trusting the cwd: a hook is invoked by the harness,
  // not by a shell someone stood in, and every path here — the manifest, the
  // ledger, the checkouts — is relative to the timone root. The settings file
  // passes `$CLAUDE_PROJECT_DIR`, which is the harness's own answer to
  // "where is this project", so the two can never disagree.
  const commonOptions = (command: Command): Command =>
    command
      .option("--root <path>", "the timone root", process.cwd())
      .option(
        "--manifest <path>",
        "path to the timone manifest file, relative to the root",
        "timone.yaml",
      )
      .option("--state <path>", "path to the daemon state file");

  commonOptions(
    guardrails
      .command("baseline")
      .description("Record the state of the world before a session (SessionStart hook)"),
  ).action(async (options: { root: string; manifest: string }) => {
    // Nothing here may fail a session. A hook that throws turns a guardrail
    // into an outage, which is a worse failure than the ones it catches.
    try {
      const payload = await readHookPayload(process.stdin);
      if (payload === undefined) return;
      const root = resolve(options.root);
      // The only thing this command writes to stdout: the hook's JSON reply,
      // which is how the session is told its own id and what it owes.
      console.log(
        await runBaseline({
          root,
          manifest: loadManifest(resolve(root, options.manifest)),
          sessionId: payload.session_id,
          now: new Date(),
        }),
      );
    } catch (error) {
      console.error(
        `guardrails baseline: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });

  commonOptions(
    guardrails
      .command("guard")
      .description(
        "Refuse a build run the verifier's probes (PreToolUse hook)",
      ),
  ).action(async (options: { root: string; state?: string }) => {
    // Same posture as the other two: nothing here may fail a session. A guard
    // that throws blocks every tool call in every session, which is a far
    // worse outcome than the leak it is watching for.
    try {
      const payload = await readHookPayload(process.stdin);
      if (payload === undefined) return;
      const root = resolve(options.root);
      const statePath =
        options.state === undefined
          ? defaultStatePath(root)
          : resolve(options.state);
      const reply = runGuard({
        store: RunStore.open(statePath),
        sessionId: payload.session_id,
        toolInput: payload.tool_input,
      });
      // Silence is the common case and the correct one: no opinion, no delay,
      // no line in anybody's transcript.
      if (reply !== undefined) console.log(reply);
    } catch (error) {
      console.error(
        `guardrails guard: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });

  commonOptions(
    guardrails
      .command("check")
      .description("Judge what a session changed and report it (Stop hook)"),
  ).action(async (options: { root: string; manifest: string; state?: string }) => {
    try {
      const payload = await readHookPayload(process.stdin);
      if (payload === undefined) return;

      const root = resolve(options.root);
      // No ledger at all is a legitimate state — the daemon may never have
      // run here — and `RunStore.open` starts empty rather than failing.
      const statePath =
        options.state === undefined
          ? defaultStatePath(root)
          : resolve(options.state);

      const outcome = await runCheck({
        root,
        manifest: loadManifest(resolve(root, options.manifest)),
        store: RunStore.open(statePath),
        sessionId: payload.session_id,
        print: (message) => console.log(message),
        journal: (line) => appendJournal(root, line),
      });

      // ADR-0027: a first sighting is handed to the session, and the session
      // may not stop on it. Exit 2 is the harness's channel for that — stderr
      // goes to the session rather than to whoever is watching — so the
      // feedback and the account cannot share it. The account goes to stdout,
      // where it is the session's own transcript, not its instructions.
      if (outcome.returned.length > 0) {
        console.error(violationFeedback(outcome.returned));
        console.log(outcome.account);
        process.exitCode = 2;
        return;
      }

      if (!outcome.account.startsWith("guardrails clean")) {
        console.error(outcome.account);
      }
    } catch (error) {
      console.error(
        `guardrails check: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });
}
