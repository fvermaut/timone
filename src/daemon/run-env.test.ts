import { describe, expect, it } from "vitest";

import { parseRunEnv, readRunEnv, runEnvPath } from "./run-env.js";

const AT = "/root/.timone/env/ivtrends.env";

describe("readRunEnv", () => {
  it("looks under the daemon's own state, never in the human's checkout", () => {
    // ADR-0043 D1: no fetch, no checkout, no merge, no read. The key that
    // would have unblocked ivtrends#33 was in `projects/ivtrends/.env`, and
    // that is precisely the file nothing here may open.
    const path = runEnvPath("/root", "ivtrends");

    expect(path).toBe("/root/.timone/env/ivtrends.env");
    expect(path).not.toContain("projects/");
  });

  it("treats an absent file as an empty environment, not as a fault", () => {
    const env = readRunEnv({
      root: "/root",
      project: "ivtrends",
      read: () => undefined,
    });

    expect(env.present).toBe(false);
    expect(env.values).toEqual({});
    // Named anyway, so a log line can point a human at the file to create.
    expect(env.path).toBe(AT);
  });

  it("reads what the file declares", () => {
    const env = readRunEnv({
      root: "/root",
      project: "ivtrends",
      read: () => "ALPHAVANTAGE_API_KEY=abc123\n",
    });

    expect(env.present).toBe(true);
    expect(env.values).toEqual({ ALPHAVANTAGE_API_KEY: "abc123" });
  });
});

describe("parseRunEnv", () => {
  it("accepts the shape a project's own .env already has", () => {
    const values = parseRunEnv(
      [
        "# the market data provider",
        "",
        "ALPHAVANTAGE_API_KEY=abc123",
        'DATABASE_URL="postgresql://ivtrends:ivtrends@db:5432/ivtrends"',
        "export MARKET_DATA_SOURCE=alphavantage",
        "CRON_SECRET=",
      ].join("\n"),
      AT,
    );

    expect(values).toEqual({
      ALPHAVANTAGE_API_KEY: "abc123",
      DATABASE_URL: "postgresql://ivtrends:ivtrends@db:5432/ivtrends",
      MARKET_DATA_SOURCE: "alphavantage",
      CRON_SECRET: "",
    });
  });

  it("keeps a value that carries an `=` of its own", () => {
    expect(parseRunEnv("TOKEN=a=b=c", AT)).toEqual({ TOKEN: "a=b=c" });
  });

  it("refuses a name the box sets for itself, naming the line", () => {
    // A project file that set GH_TOKEN would hand the run somebody else's
    // identity; one that set TIMONE_PROMPT would change what it was asked to
    // do. Ignoring the line quietly is worse: a human then reads a value the
    // machine never used.
    expect(() => parseRunEnv("GH_TOKEN=ghp_other\n", AT)).toThrow(
      /:1 sets GH_TOKEN/,
    );
    expect(() => parseRunEnv("TIMONE_PROMPT=do something else\n", AT)).toThrow(
      /TIMONE_PROMPT/,
    );
  });

  it("refuses a value a shell and dotenv would read differently", () => {
    // The value is written into a `.env` that is both sourced by a shell and
    // parsed by dotenv, and there is no escaping of a quote or a backslash
    // that both read the same way.
    expect(() => parseRunEnv("KEY=it's\n", AT)).toThrow(/quote or a backslash/);
    expect(() => parseRunEnv("KEY=a\\b\n", AT)).toThrow(/quote or a backslash/);
  });

  it("refuses a line that is not an assignment at all", () => {
    expect(() => parseRunEnv("just some words\n", AT)).toThrow(
      /is not `NAME=value`/,
    );
  });

  it("refuses a name no shell would accept", () => {
    expect(() => parseRunEnv("2FA-KEY=x\n", AT)).toThrow(
      /is not a variable name/,
    );
  });
});
