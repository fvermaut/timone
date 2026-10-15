import { describe, expect, it } from "vitest";

import { mapTicketReply } from "./comments.js";

describe("mapTicketReply — the answer on a map ticket", () => {
  it("lists each open step ticket on its own line, says the ticket is not read, and ends with what is needed", () => {
    const reply = mapTicketReply([
      { number: 51, title: "1. Piece one" },
      { number: 52, title: "2. Piece two" },
    ]);

    const lines = reply.split("\n");
    expect(lines).toContain("- #51 — 1. Piece one");
    expect(lines).toContain("- #52 — 2. Piece two");
    expect(reply).toContain("This ticket is not read any more.");
    expect(lines.at(-1)?.startsWith("**What I need from you:**")).toBe(true);
  });

  it("names no ticket number and says to open a new ticket when no step ticket is open", () => {
    const reply = mapTicketReply([]);

    expect(reply).not.toContain("#");
    expect(reply).toContain("Every piece of its work is finished or was dropped.");
    expect(reply).toContain("If it is a new request, open a new ticket.");
  });

  it("names no takeover command, with or without open step tickets", () => {
    expect(mapTicketReply([{ number: 51, title: "1. Piece one" }])).not.toContain("timone takeover");
    expect(mapTicketReply([])).not.toContain("timone takeover");
  });
});
