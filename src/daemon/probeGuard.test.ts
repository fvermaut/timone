import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  PROBE_DIRECTORIES,
  mentionsProbeDirectory,
  probeGuardDecision,
} from "./probeGuard.js";

describe("mentionsProbeDirectory", () => {
  it("finds the project's probe directory in a file path", () => {
    expect(
      mentionsProbeDirectory({
        file_path: "/w/timone/projects/ivtrends/doc/plans/phases/probes/PRD-01.R3.mjs",
      }),
    ).toBe(true);
  });

  it("finds Timone's shared baseline probes", () => {
    expect(
      mentionsProbeDirectory({ file_path: "standards/baseline/probes/axe.mjs" }),
    ).toBe(true);
  });

  it("finds it inside a shell command", () => {
    expect(
      mentionsProbeDirectory({
        command: "cat projects/ivtrends/doc/plans/phases/probes/PRD-01.R1.mjs | head",
      }),
    ).toBe(true);
  });

  it("finds it nested in a structured input", () => {
    expect(
      mentionsProbeDirectory({
        edits: [{ path: "doc/plans/phases/probes/x.mjs", old: "a", new: "b" }],
      }),
    ).toBe(true);
  });

  it("leaves the reports directory alone", () => {
    expect(
      mentionsProbeDirectory({
        file_path: "doc/plans/phases/reports/phase-16-verification.md",
      }),
    ).toBe(false);
  });

  it("leaves a source file whose name merely contains 'probe' alone", () => {
    expect(mentionsProbeDirectory({ file_path: "src/lib/probe-helper.ts" })).toBe(
      false,
    );
  });

  it("says no when the input carries no strings at all", () => {
    expect(mentionsProbeDirectory({ limit: 20, force: true })).toBe(false);
    expect(mentionsProbeDirectory(undefined)).toBe(false);
  });

  it("names both directories it guards", () => {
    expect(PROBE_DIRECTORIES).toEqual([
      "doc/plans/phases/probes",
      "standards/baseline/probes",
    ]);
  });
});

describe("probeGuardDecision", () => {
  it("stays silent when the call has nothing to do with a probe", () => {
    expect(
      probeGuardDecision({ toolInput: { file_path: "src/index.ts" }, stage: "execution" }),
    ).toBeUndefined();
  });

  it("denies a build run — this is the fault the guard exists for", () => {
    const decision = probeGuardDecision({
      toolInput: { file_path: "doc/plans/phases/probes/PRD-01.R3.mjs" },
      stage: "execution",
    });
    expect(decision?.permissionDecision).toBe("deny");
    expect(decision?.permissionDecisionReason).toContain("doc/plans/phases/probes");
  });

  it("denies a remediation run too — it writes code like execution does", () => {
    expect(
      probeGuardDecision({
        toolInput: { command: "grep -r x standards/baseline/probes/" },
        stage: "remediation",
      })?.permissionDecision,
    ).toBe("deny");
  });

  it("allows verification, which owns the directory", () => {
    expect(
      probeGuardDecision({
        toolInput: { file_path: "doc/plans/phases/probes/PRD-01.R3.mjs" },
        stage: "verification",
      })?.permissionDecision,
    ).toBe("allow");
  });

  it("asks when a human is driving, rather than refusing them their own files", () => {
    const decision = probeGuardDecision({
      toolInput: { file_path: "doc/plans/phases/probes/PRD-01.R3.mjs" },
      stage: undefined,
    });
    expect(decision?.permissionDecision).toBe("ask");
  });

  it("asks for a stage that neither builds nor verifies", () => {
    expect(
      probeGuardDecision({
        toolInput: { file_path: "doc/plans/phases/probes/PRD-01.R3.mjs" },
        stage: "delivery",
      })?.permissionDecision,
    ).toBe("ask");
  });
});

describe("the probe guard and the update (ADR-0066 D4)", () => {
  // Built from the constant, so no fixture here spells the folder out.
  const probe = { file_path: join(PROBE_DIRECTORIES[0], "PRD-07.R7.mjs") };

  it("allows the update, which runs the check scripts as the check does, and says so by name", () => {
    const decision = probeGuardDecision({ toolInput: probe, stage: "update" });

    expect(decision?.permissionDecision).toBe("allow");
    expect(decision?.permissionDecisionReason).toMatch(/^Update /);
  });

  it("still allows verification, and names it", () => {
    const decision = probeGuardDecision({ toolInput: probe, stage: "verification" });

    expect(decision?.permissionDecision).toBe("allow");
    expect(decision?.permissionDecisionReason).toMatch(/^Verification /);
  });

  it.each(["execution", "remediation"] as const)("still denies %s", (stage) => {
    expect(probeGuardDecision({ toolInput: probe, stage })?.permissionDecision).toBe("deny");
  });

  it("still asks when no stage is running", () => {
    expect(probeGuardDecision({ toolInput: probe, stage: undefined })?.permissionDecision).toBe("ask");
  });
});

describe("what the guard judges: the file tools, the search tools and a helper (PRD-10 R4, R5)", () => {
  // Built from the constant, so no fixture here spells a folder out.
  const p = PROBE_DIRECTORIES[0];
  const shared = PROBE_DIRECTORIES[1];

  /** Every kind of session: the stages a run can be at, and a person. */
  const SESSIONS = [
    "execution",
    "remediation",
    "verification",
    "update",
    "planning",
    undefined,
  ] as const;

  /** A call as the hook carries it: the tool's name and its input. */
  type Call = readonly [label: string, toolName: string | undefined, toolInput: unknown];

  /** Every call crossed with every kind of session. */
  const everySession = (calls: readonly Call[]) =>
    SESSIONS.flatMap((stage) =>
      calls.map(([label, toolName, toolInput]) => ({ label, toolName, toolInput, stage })),
    );

  const helperPrompt = `Do not open ${p} or ${shared}.`;
  const phaseFile = "doc/plans/phases/phase-42.md";

  /** Calls that only name a folder: text, not a read or a write (R4). */
  const onlyNames: readonly Call[] = [
    ["an Agent prompt", "Agent", { prompt: helperPrompt, description: "d", subagent_type: "claude" }],
    ["a Task prompt (the older name)", "Task", { prompt: helperPrompt, description: "d" }],
    [
      "an Edit of a plan naming a folder",
      "Edit",
      { file_path: phaseFile, old_string: "x", new_string: `See ${shared}/README.md.` },
    ],
    ["a Write of a plan naming a folder", "Write", { file_path: phaseFile, content: `See ${shared}/README.md.` }],
    ["a Grep for a folder name in src/", "Grep", { pattern: p, path: "src/" }],
    ["a Grep for a folder name, no path", "Grep", { pattern: p }],
  ];

  it.each(everySession(onlyNames))("is silent on $label, for stage $stage", ({ toolName, toolInput, stage }) => {
    expect(probeGuardDecision({ toolName, toolInput, stage })).toBeUndefined();
  });

  /** What the guard says about a real read or write, word for word, by stage. */
  const where = PROBE_DIRECTORIES.join(" and ");
  const refused = {
    permissionDecision: "deny",
    permissionDecisionReason:
      `Refused: ${where} hold the checks that will be run against what you build. ` +
      "A builder that reads them writes code to pass them, which is the same fault " +
      "as a verifier checking against your own test suite, with the two parties " +
      "swapped. Carry on without them. If you believe a probe is wrong, that is a " +
      "finding for the human, not a file to open.",
  };
  const allowed = (name: string) => ({
    permissionDecision: "allow",
    permissionDecisionReason: `${name} runs the checks kept in ${where}, so it may read them.`,
  });
  const asked = {
    permissionDecision: "ask",
    permissionDecisionReason:
      `This is ${where}, which belongs to the stage that checks the build. ` +
      "Nothing that builds code may read it. Allow only if you are not building.",
  };
  const judged = {
    execution: refused,
    remediation: refused,
    verification: allowed("Verification"),
    update: allowed("Update"),
    planning: asked,
    person: asked,
  };

  const full = `/workspace/timone/projects/timone/${p}/a.sh`;

  /** Calls that really read, list or write a check script (R5). */
  const reaches: readonly Call[] = [
    ["a Read of a script", "Read", { file_path: `${p}/a.sh` }],
    ["a Read by full path", "Read", { file_path: full }],
    ["a Write of a script", "Write", { file_path: `${p}/a.sh`, content: "echo" }],
    ["a Write by full path", "Write", { file_path: full, content: "echo" }],
    ["an Edit of a script", "Edit", { file_path: `${p}/a.sh`, old_string: "a", new_string: "b" }],
    ["an Edit by full path", "Edit", { file_path: full, old_string: "a", new_string: "b" }],
    ["a NotebookEdit of a notebook", "NotebookEdit", { notebook_path: `${p}/a.ipynb`, new_source: "x" }],
    ["a Glob whose pattern is inside", "Glob", { pattern: `${p}/*.mjs` }],
    ["a Glob whose path is a folder", "Glob", { pattern: "*.mjs", path: p }],
    ["a Grep whose path is a folder", "Grep", { pattern: "total", path: p }],
    ["a Grep whose glob is inside", "Grep", { pattern: "total", glob: `${shared}/**` }],
  ];

  /** Tools with no rule of their own keep the old rule: any text (R5). */
  const noRule: readonly Call[] = [
    ["a WebFetch whose prompt names one", "WebFetch", { url: "https://example.com", prompt: `Read ${p}` }],
    ["an MCP tool with a nested field", "mcp__x__y", { options: { paths: [`${p}/a.sh`] } }],
    ["a call with no tool name", undefined, { file_path: `${p}/a.sh` }],
  ];

  it.each(everySession([...reaches, ...noRule]))(
    "judges $label, for stage $stage",
    ({ toolName, toolInput, stage }) => {
      expect(probeGuardDecision({ toolName, toolInput, stage })).toEqual(judged[stage ?? "person"]);
    },
  );

  /** The calls almost every session makes, which must stay unanswered. */
  const common: readonly Call[] = [
    ["a Read of source", "Read", { file_path: "src/index.ts" }],
    [
      "a Write of a report",
      "Write",
      { file_path: "doc/plans/phases/reports/phase-42-complete.md", content: "# Phase 42\n\nDone." },
    ],
    ["an Agent prompt naming nothing", "Agent", { prompt: "Summarise src/index.ts.", description: "d" }],
    ["a Glob of source", "Glob", { pattern: "src/**/*.ts" }],
  ];

  it.each(everySession(common))("is silent on $label, for stage $stage", ({ toolName, toolInput, stage }) => {
    expect(probeGuardDecision({ toolName, toolInput, stage })).toBeUndefined();
  });
});

describe("what the guard judges: shell commands (PRD-10 R4, R5)", () => {
  // Built from the constant, so no fixture here spells a folder out.
  const p = PROBE_DIRECTORIES[0];
  const shared = PROBE_DIRECTORIES[1];

  /** Every kind of session: the stages a run can be at, and a person. */
  const SESSIONS = [
    "execution",
    "remediation",
    "verification",
    "update",
    "planning",
    undefined,
  ] as const;

  /** A shell command, with the words a test calls it by. */
  type Command = readonly [label: string, command: string];

  /** Every command crossed with every kind of session. */
  const everySession = (commands: readonly Command[]) =>
    SESSIONS.flatMap((stage) => commands.map(([label, command]) => ({ label, command, stage })));

  const decide = (command: string, stage: (typeof SESSIONS)[number]) =>
    probeGuardDecision({ toolName: "Bash", toolInput: { command, description: "d" }, stage });

  const phaseFile = "doc/plans/phases/phase-42.md";

  /** A command's text written over several lines, as a session writes it. */
  const lines = (...text: string[]) => text.join("\n");

  /** Commands that only name a folder in text they write or send (R4). */
  const onlyNames: readonly Command[] = [
    ["a commit message", `git commit -m "Do not open ${p}"`],
    [
      "a commit message from a here-document",
      lines(`git commit -m "$(cat <<'EOF'`, `docs: name ${shared}/README.md`, "EOF", `)"`),
    ],
    ["a ticket comment", `gh issue comment 87 --body "Do not open ${p}"`],
    ["a pull request body", `gh pr create --title "t" --body "Do not open ${p}"`],
    [
      "a pull request body from a here-document",
      lines(`gh pr create --title "t" --body "$(cat <<'EOF'`, `Keep out of ${p}.`, "EOF", `)"`),
    ],
    ["text appended to a plan", lines(`cat >> ${phaseFile} <<'EOF'`, `See ${shared}/README.md`, "EOF")],
    ["text written to a plan", lines(`cat > ${phaseFile} <<'EOF'`, `See ${shared}/README.md`, "EOF")],
    ["text written to a plan by tee", lines(`tee ${phaseFile} <<'EOF'`, `See ${shared}/README.md`, "EOF")],
    ["text appended to a plan by tee", lines(`tee -a ${phaseFile} <<'EOF'`, `See ${shared}/README.md`, "EOF")],
  ];

  it.each(everySession(onlyNames))("is silent on $label, for stage $stage", ({ command, stage }) => {
    expect(decide(command, stage)).toBeUndefined();
  });

  /** What the guard decides about a real read, by stage. */
  const judged = {
    execution: "deny",
    remediation: "deny",
    verification: "allow",
    update: "allow",
    planning: "ask",
    person: "ask",
  } as const;

  /** Commands that really read, list, run or write a check script (R5). */
  const reaches: readonly Command[] = [
    ["a cat of a script", `cat ${p}/a.sh`],
    ["a listing of a folder", `ls ${p}`],
    ["a sed of a script", `sed -n 1,20p ${p}/a.sh`],
    ["a head of a script", `head ${p}/a.sh`],
    ["a script run by bash", `bash ${p}/a.sh`],
    ["a script run by node", `node ${p}/a.mjs`],
    ["a grep inside a folder", `grep -rn total ${p}`],
    ["a copy of a script", `cp ${p}/a.sh /tmp/`],
    ["a write into a folder", `echo x > ${p}/b.sh`],
    ["a write into a folder with no space", `echo x >${p}/b.sh`],
    ["a script read out of git", `git show HEAD:${p}/a.sh`],
    ["the history of a folder", `git log -p -- ${p}`],
    ["a cat by full path", `cat /workspace/timone/projects/timone/${p}/a.sh`],
    ["a cat of a quoted path", `cat "${p}/my file.sh"`],
  ];

  /** A real read joined to a call that passes (R5). */
  const joined: readonly Command[] = [
    ["a read after a commit", `git commit -m "x" && cat ${p}/a.sh`],
    ["a listing after a commit naming a folder", `git commit -m "Do not open ${p}"; ls ${p}`],
    ["a read inside a substitution", `echo "$(cat ${p}/a.sh)"`],
  ];

  /** Code handed to an interpreter as text: the guard cannot tell what it does (R5). */
  const interpreted: readonly Command[] = [
    ["python reading a here-document", lines("python3 - <<'EOF'", `print(open("${p}/a.sh").read())`, "EOF")],
    ["node -e", `node -e "require('fs').readFileSync('${p}/a.mjs')"`],
    ["bash -c", `bash -c "cat ${p}/a.sh"`],
    ["a command piped to sh", `echo "cat ${p}/a.sh" | sh`],
    ["eval", `eval "cat ${p}/a.sh"`],
    [
      "python only printing a sentence that names a folder (the accepted cost of the rule)",
      lines("python3 - <<'EOF'", `print("Do not open ${p}")`, "EOF"),
    ],
  ];

  /** Commands the reader cannot finish fall back to all of the text. */
  const unreadable: readonly Command[] = [
    ["an unclosed quote", `cat "${p}/a.sh`],
    ["a here-document with no closing line", lines(`git commit -m "$(cat <<'EOF'`, `docs: name ${p}`, `)"`)],
  ];

  it.each(everySession([...reaches, ...joined, ...interpreted, ...unreadable]))(
    "judges $label, for stage $stage",
    ({ command, stage }) => {
      expect(decide(command, stage)?.permissionDecision).toBe(judged[stage ?? "person"]);
    },
  );

  /** The commands almost every session runs, which must stay unanswered. */
  const common: readonly Command[] = [
    ["the tests", "npx vitest run"],
    ["git status", "git status"],
    ["a pipe", "cat src/index.ts | head"],
    ["the cli", "node dist/cli.js number timone phase"],
    ["python reading a here-document", lines("python3 - <<'EOF'", "print(1)", "EOF")],
    ["an unclosed quote naming no folder", `echo "x`],
  ];

  it.each(everySession(common))("is silent on $label, for stage $stage", ({ command, stage }) => {
    expect(decide(command, stage)).toBeUndefined();
  });
});
