import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { readTranscript } from "./transcript.js";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function saved(...lines: string[]): { dir: string; file: string } {
  const dir = mkdtempSync(join(tmpdir(), "timone-transcript-"));
  dirs.push(dir);
  const file = join(dir, "abc123.jsonl");
  writeFileSync(file, `${lines.join("\n")}\n`, "utf8");
  return { dir, file };
}

const init = JSON.stringify({
  type: "system",
  subtype: "init",
  session_id: "abc123",
  model: "claude-opus-5",
  cwd: "/workspace/timone",
  tools: ["Bash"],
});

const call = JSON.stringify({
  type: "assistant",
  parent_tool_use_id: null,
  message: {
    content: [{ type: "tool_use", id: "t", name: "Bash", input: { command: "npm test" } }],
  },
});

describe("reading a saved transcript back", () => {
  it("renders a file of JSON lines for a person", () => {
    const { file } = saved(init, call);

    const out = readTranscript(file);

    expect(out).toContain("abc123");
    expect(out).toContain("Bash(npm test)");
  });

  it("finds a session by its id, without being told the path", () => {
    // Forensics starts from the id on a ticket comment, not from a filename.
    const { dir } = saved(init, call);

    expect(readTranscript("abc123", dir)).toContain("Bash(npm test)");
  });

  it("says which sessions there are when the one asked for is not among them", () => {
    const { dir } = saved(init);

    expect(() => readTranscript("nosuch", dir)).toThrow(/abc123/);
  });

  it("says so plainly when there are no transcripts at all", () => {
    const dir = mkdtempSync(join(tmpdir(), "timone-transcript-"));
    dirs.push(dir);

    expect(() => readTranscript("anything", dir)).toThrow(/no transcripts/i);
  });
});
