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
