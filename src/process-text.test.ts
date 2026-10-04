import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The text a session follows: `process.md` and every stage skill.
 *
 * Nothing in `src/` writes `STATUS.md`. A step's session does, from what
 * these files tell it. So the files are the seam, and this test reads them
 * from the repository root as a session would
 * ([timone#85](https://github.com/fvermaut/timone/issues/85)).
 */
const ROOT = fileURLToPath(new URL("..", import.meta.url));

function read(relative: string): string {
  return readFileSync(join(ROOT, relative), "utf8");
}

const SKILLS = readdirSync(join(ROOT, ".claude/skills"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => `.claude/skills/${entry.name}/SKILL.md`);

const SESSION_TEXT = ["process.md", ...SKILLS];

/**
 * The text with every struck passage (`~~…~~`) taken out. A revised rule
 * keeps the earlier ruling visible as struck history, and that history is
 * not an instruction any more.
 */
function unstruck(text: string): string {
  return text.replace(/~~[\s\S]*?~~/g, "");
}

describe("where the text a session follows says STATUS.md goes", () => {
  it("reads process.md and more than one skill", () => {
    expect(SKILLS.length).toBeGreaterThan(1);
    expect(SKILLS).toContain(".claude/skills/timone-verify/SKILL.md");
    expect(SKILLS).toContain(".claude/skills/timone-deliver/SKILL.md");
  });

  it("process.md says a run writes it on its work branch, and a step with no branch writes none", () => {
    const text = unstruck(read("process.md"));
    const start = text.indexOf("**Status reporting.**");
    const end = text.indexOf("**Handover.**", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const section = text.slice(start, end);

    expect(section).toContain(
      "In a run, a step that owns a work branch writes `STATUS.md` on that branch",
    );
    expect(section).toContain("A step that owns no branch writes no `STATUS.md`");
  });

  it.each([
    ".claude/skills/timone-verify/SKILL.md",
    ".claude/skills/timone-deliver/SKILL.md",
  ])("%s, in its Status reporting section, sends a run to its work branch", (file) => {
    const text = unstruck(read(file));
    const start = text.indexOf("## Status reporting");
    const end = text.indexOf("\n## ", start + 1);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const section = text.slice(start, end);

    expect(section).toContain("**In a run, on the phase's work branch**");
    expect(section).not.toContain("never gains a `STATUS.md` edit");
  });

  it.each(SESSION_TEXT)(
    "%s no longer says the file is written only on the default branch",
    (file) => {
      const live = unstruck(read(file));
      expect(live).not.toContain("written only on the project's default branch");
      expect(live).not.toContain(
        "on the project's default branch, never on the phase branch",
      );
    },
  );
});

/**
 * The paragraphs of a text: blocks separated by a blank line. A list with
 * no blank line between its items is one paragraph.
 */
function paragraphs(text: string): string[] {
  return text.split(/\n[ \t]*\n/);
}

describe("how the text a session follows says a numbered file gets its number (44d)", () => {
  const NUMBERING_SKILLS = [
    [".claude/skills/timone-plan/SKILL.md", "phase"],
    [".claude/skills/timone-adr/SKILL.md", "adr"],
    [".claude/skills/timone-onboard/SKILL.md", "adr"],
    [".claude/skills/timone-triage/SKILL.md", "triage"],
    [".claude/skills/timone-prd/SKILL.md", "prd"],
  ] as const;

  it.each(NUMBERING_SKILLS)(
    "%s takes its number from the command, kind %s",
    (file, kind) => {
      const live = unstruck(read(file));
      expect(live).toMatch(
        new RegExp(`node dist/cli\\.js number \\S+ ${kind}\\b`),
      );
    },
  );

  it("process.md names the command", () => {
    expect(unstruck(read("process.md"))).toContain("node dist/cli.js number");
  });

  it.each(SESSION_TEXT)(
    "%s never tells a session to find a number from a folder",
    (file) => {
      expect(unstruck(read(file))).not.toMatch(
        /highest existing|take the highest|next available `?NN|use the next, zero-padded|Number sequentially/i,
      );
    },
  );

  it.each(NUMBERING_SKILLS)(
    "%s says, beside the command, that a failing command stops the session",
    (file) => {
      const beside = paragraphs(unstruck(read(file))).filter((p) =>
        p.includes("dist/cli.js number"),
      );
      expect(beside.length).toBeGreaterThan(0);
      expect(beside.some((p) => /fails?/i.test(p) && /\bstop/i.test(p))).toBe(
        true,
      );
    },
  );
});
