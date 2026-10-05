/**
 * The files a plan names, read from its file markers
 * ([ADR-0065](../../doc/adr/0065-the-planner-is-a-session-of-its-own-asked-when-a-build-would-start.md)
 * D3). The planner compares these lists across tickets to judge whether two
 * builds would change the same files.
 *
 * A plan marks each file it creates, changes or deletes with `**[NEW FILE]**`,
 * `**[MODIFY]**` or `**[DELETE]**`, followed by the file's path in backticks.
 * Every path after a marker on the same line counts, so a line that marks
 * several files, or names a file in its description, gives all of them. A
 * path on a line with no marker is prose, and does not count.
 */

/**
 * A span of code, or a file marker. A line is read from left to right, so a
 * marker quoted inside a span of code is part of the span, not a marker.
 */
const TOKEN = /`([^`\n]*)`|\*\*\[(?:NEW FILE|MODIFY|DELETE)\]\*\*/g;

/** A span of code made only of the characters a path is written with. */
const PATH_CHARACTERS = /^[\w.@/-]+$/;

/**
 * The endings that make a name with no folder a file name rather than a word
 * of code: `process.md` is a file, `store.register` is not.
 */
const FILE_ENDING =
  /\.(?:md|mdx|ts|tsx|js|jsx|mjs|cjs|json|yaml|yml|toml|sh|css|scss|html|sql|prisma|txt|env)$/;

/** Whether a span of code is a path: a folder in it, or a file name with a known ending. */
function isPath(text: string): boolean {
  return PATH_CHARACTERS.test(text) && (text.includes("/") || FILE_ENDING.test(text));
}

/**
 * Every path the plan's file markers name, each once, in the order the plan
 * first names it. Pure.
 *
 * A bare file name that is the last part of a path already in the list — a
 * line that says `driver.ts` after `src/runner/driver.ts` — names that file,
 * and is not listed again.
 */
export function planFiles(text: string): string[] {
  const found: string[] = [];
  for (const line of text.split("\n")) {
    let marked = false;
    for (const match of line.matchAll(TOKEN)) {
      const code = match[1];
      if (code === undefined) {
        marked = true;
      } else if (marked && isPath(code) && !found.includes(code)) {
        found.push(code);
      }
    }
  }
  const full = found.filter((path) => path.includes("/"));
  return found.filter(
    (path) => path.includes("/") || !full.some((each) => each.endsWith(`/${path}`)),
  );
}
