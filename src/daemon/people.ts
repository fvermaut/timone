/**
 * How the start of the line that names a project's people reads, on every
 * ticket the machine opens.
 */
export const NAMED_LINE_START =
  "Named so that GitHub tells them about this ticket and every comment on it:";

/**
 * `body`, with a last line naming each of the project's named people with an
 * `@` ([PRD-08](../../doc/specs/prd/prd-08-a-ticket-the-machine-opens-names-its-people.md)).
 *
 * The machine opens its tickets under its own identity
 * ([ADR-0042](../../doc/adr/0042-timone-acts-under-its-own-identity.md)), so
 * nobody follows them: GitHub tells nobody that they were opened or that
 * someone commented on them. GitHub does tell a person whose login is written
 * with an `@` in the plain text of a ticket, and from then on tells them of
 * every comment on it. That is why the names are written into the body.
 */
export function withPeopleNamed(body: string, people: readonly string[]): string {
  const logins = [
    ...new Set(
      people
        .map((login) => login.trim().replace(/^@+/, ""))
        .filter((login) => login !== ""),
    ),
  ];
  if (logins.length === 0) return body;
  const names = logins.map((login) => `@${login}`).join(" ");
  return `${body.replace(/\n+$/, "")}\n\n${NAMED_LINE_START} ${names}`;
}
