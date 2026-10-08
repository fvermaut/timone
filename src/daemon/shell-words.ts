/**
 * A reader of one `Bash` command string, for the probe guard
 * ([#192](https://github.com/fvermaut/timone/issues/192)).
 *
 * The guard needs to tell a path a command opens from a path a command only
 * carries as text: a commit message, a pull request body, lines written into
 * a file. That takes the command's words, not its characters. This reader is
 * written by hand and kept small, as `forge-guard.ts` reads its command lines:
 * the guard runs on every tool call, and a parsing library would be a fifth
 * runtime dependency for one job.
 *
 * It reads the shell's quoting, separators, groups, substitutions and
 * here-documents. It does not expand anything: a variable stays as written.
 * Anything it cannot finish makes the whole command unreadable, and the guard
 * then falls back to its old rule. It never throws, since a hook that throws
 * breaks the session it runs in (ADR-0018).
 */

/** One simple command: a program and its words, as the shell would run it. */
export interface SimpleCommand {
  /**
   * The words, program first, with quotes and backslashes removed. The target
   * of a redirection is a word too. A substitution adds nothing to the word it
   * sits in: its output is not known, and its commands are read on their own.
   */
  words: string[];
  /** The bodies of the command's here-documents, kept apart from its words. */
  heredocs: string[];
  /** The text inside each `$( … )` and `` ` … ` `` in the command. */
  substitutions: string[];
}

/** Thrown inside the reader when it cannot finish; never leaves this file. */
class Unreadable extends Error {}

/** A here-document whose body starts on the line after the one that opened it. */
interface PendingHeredoc {
  delimiter: string;
  /** `<<-`: leading tabs are removed from each line, the closing line too. */
  stripTabs: boolean;
  /** A quoted delimiter turns substitution off inside the body. */
  quoted: boolean;
  command: SimpleCommand;
}

/** Characters that end a word outside quotes. */
const WORD_ENDS = " \t\n;&|<>()";

class Reader {
  private at = 0;

  constructor(
    private readonly src: string,
    private readonly commands: SimpleCommand[],
  ) {}

  private newCommand(): SimpleCommand {
    const command: SimpleCommand = { words: [], heredocs: [], substitutions: [] };
    this.commands.push(command);
    return command;
  }

  /**
   * Read commands up to the end of the text or, inside a group or a `$(`,
   * up to the `)` that closes it.
   */
  readList(inParens: boolean): void {
    const src = this.src;
    let command = this.newCommand();
    let word = "";
    let inWord = false;
    const pending: PendingHeredoc[] = [];
    const endWord = (): void => {
      if (inWord) command.words.push(word);
      word = "";
      inWord = false;
    };

    while (this.at < src.length) {
      const c = src.charAt(this.at);
      const next = src.charAt(this.at + 1);
      if (c === "\\") {
        // A backslash before a newline joins two lines; before anything else
        // it keeps that character as it is.
        if (next !== "\n") {
          word += next;
          inWord = true;
        }
        this.at += 2;
      } else if (c === "'") {
        const end = src.indexOf("'", this.at + 1);
        if (end === -1) throw new Unreadable();
        word += src.slice(this.at + 1, end);
        inWord = true;
        this.at = end + 1;
      } else if (c === '"') {
        this.at += 1;
        word += this.readDoubleQuoted(command, true);
        inWord = true;
      } else if (c === "$" && next === "(") {
        this.at += 2;
        this.readSubstitution(command);
        inWord = true;
      } else if (c === "`") {
        this.at += 1;
        this.readBackticks(command);
        inWord = true;
      } else if (c === "#" && !inWord) {
        const end = src.indexOf("\n", this.at);
        this.at = end === -1 ? src.length : end;
      } else if (c === " " || c === "\t") {
        endWord();
        this.at += 1;
      } else if (c === "\n") {
        endWord();
        this.at += 1;
        this.readHeredocBodies(pending.splice(0));
        command = this.newCommand();
      } else if (c === "&" && next === ">") {
        // `&>` and `&>>` send both outputs to the word that follows.
        endWord();
        this.at += src.charAt(this.at + 2) === ">" ? 3 : 2;
      } else if (c === ";" || c === "&" || c === "|") {
        endWord();
        this.at += 1;
        command = this.newCommand();
      } else if (c === "(") {
        endWord();
        this.at += 1;
        this.readList(true);
        command = this.newCommand();
      } else if (c === ")") {
        if (!inParens || pending.length > 0) throw new Unreadable();
        endWord();
        this.at += 1;
        return;
      } else if (c === "<" || c === ">") {
        // A number just before it (`2>`) names a stream, not a word.
        if (/^\d+$/.test(word)) {
          word = "";
          inWord = false;
        }
        endWord();
        if (src.startsWith("<<<", this.at)) {
          this.at += 3;
        } else if (src.startsWith("<<", this.at)) {
          this.at += 2;
          const stripTabs = src.charAt(this.at) === "-";
          if (stripTabs) this.at += 1;
          pending.push({ ...this.readDelimiter(), stripTabs, command });
        } else if (next === "(") {
          // `<( … )` and `>( … )`: a command whose output is read as a file.
          this.at += 2;
          this.readSubstitution(command);
        } else {
          this.at += 1;
          while (this.at < src.length && ">&|".includes(src.charAt(this.at))) this.at += 1;
        }
      } else {
        word += c;
        inWord = true;
        this.at += 1;
      }
    }

    endWord();
    if (inParens || pending.length > 0) throw new Unreadable();
  }

  /**
   * Read the text of a double-quoted string, from just after its opening
   * quote; with `closed` false, read to the end instead, as the body of a
   * here-document is read. A substitution inside is read as commands.
   */
  private readDoubleQuoted(command: SimpleCommand, closed: boolean): string {
    const src = this.src;
    let text = "";
    while (this.at < src.length) {
      const c = src.charAt(this.at);
      const next = src.charAt(this.at + 1);
      if (closed && c === '"') {
        this.at += 1;
        return text;
      }
      if (c === "\\" && next !== "" && '$`"\\\n'.includes(next)) {
        if (next !== "\n") text += next;
        this.at += 2;
      } else if (c === "$" && next === "(") {
        this.at += 2;
        this.readSubstitution(command);
      } else if (c === "`") {
        this.at += 1;
        this.readBackticks(command);
      } else {
        text += c;
        this.at += 1;
      }
    }
    if (closed) throw new Unreadable();
    return text;
  }

  /** Read a `$( … )` from just after its `$(`; its commands join the list. */
  private readSubstitution(command: SimpleCommand): void {
    const start = this.at;
    this.readList(true);
    command.substitutions.push(this.src.slice(start, this.at - 1));
  }

  /** Read a `` ` … ` `` from just after its opening backtick. */
  private readBackticks(command: SimpleCommand): void {
    const src = this.src;
    let text = "";
    while (this.at < src.length && src.charAt(this.at) !== "`") {
      const c = src.charAt(this.at);
      const next = src.charAt(this.at + 1);
      // Inside backticks, `\`` and `\\` stand for the character itself.
      if (c === "\\" && (next === "`" || next === "\\" || next === "$")) {
        text += next;
        this.at += 2;
      } else {
        text += c;
        this.at += 1;
      }
    }
    if (this.at >= src.length) throw new Unreadable();
    this.at += 1;
    command.substitutions.push(text);
    new Reader(text, this.commands).readList(false);
  }

  /** Read the word after `<<`: the line that will close the body. */
  private readDelimiter(): { delimiter: string; quoted: boolean } {
    const src = this.src;
    while (src.charAt(this.at) === " " || src.charAt(this.at) === "\t") this.at += 1;
    let delimiter = "";
    let quoted = false;
    while (this.at < src.length && !WORD_ENDS.includes(src.charAt(this.at))) {
      const c = src.charAt(this.at);
      if (c === "'" || c === '"') {
        const end = src.indexOf(c, this.at + 1);
        if (end === -1) throw new Unreadable();
        delimiter += src.slice(this.at + 1, end);
        quoted = true;
        this.at = end + 1;
      } else if (c === "\\") {
        delimiter += src.charAt(this.at + 1);
        quoted = true;
        this.at += 2;
      } else {
        delimiter += c;
        this.at += 1;
      }
    }
    if (delimiter === "") throw new Unreadable();
    return { delimiter, quoted };
  }

  /** Read the bodies of the here-documents opened on the line just ended. */
  private readHeredocBodies(pending: readonly PendingHeredoc[]): void {
    const src = this.src;
    for (const heredoc of pending) {
      const lines: string[] = [];
      for (;;) {
        if (this.at >= src.length) throw new Unreadable();
        const newline = src.indexOf("\n", this.at);
        const end = newline === -1 ? src.length : newline;
        const line = heredoc.stripTabs ? src.slice(this.at, end).replace(/^\t+/, "") : src.slice(this.at, end);
        this.at = newline === -1 ? src.length : newline + 1;
        if (line === heredoc.delimiter) break;
        lines.push(line);
      }
      const body = lines.join("\n");
      heredoc.command.heredocs.push(body);
      if (!heredoc.quoted) new Reader(body, this.commands).readDoubleQuoted(heredoc.command, false);
    }
  }
}

/**
 * The simple commands in a `Bash` command string, those inside groups and
 * substitutions included; or undefined when the string cannot be read to the
 * end — an unclosed quote, an unclosed `$(`, a here-document with no closing
 * line. Never throws.
 */
export function readShellCommand(command: string): SimpleCommand[] | undefined {
  try {
    const commands: SimpleCommand[] = [];
    new Reader(command, commands).readList(false);
    return commands.filter(
      (found) => found.words.length + found.heredocs.length + found.substitutions.length > 0,
    );
  } catch {
    // Unreadable, or anything else that went wrong — a nesting too deep for
    // the stack among them. Either way the guard falls back to its old rule.
    return undefined;
  }
}
