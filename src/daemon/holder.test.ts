import { describe, expect, it } from "vitest";

import { holderLiveness, type Holder } from "./holder.js";

/** A holder of something, with only the fields a case cares about varied. */
function holderOf(overrides: Partial<Holder> = {}): Holder {
  return {
    token: "5f0f4c1e-0000-4000-8000-000000000000",
    command: "timone daemon",
    pid: 4213,
    since: "2026-09-04T10:00:00Z",
    observedAt: "2026-09-04T10:00:00Z",
    ...overrides,
  };
}

/**
 * A stand-in for the machine's process table, and the reason it is injected
 * ([ADR-0025](../../doc/adr/0025-a-lock-holders-proof-of-life-is-its-process.md)):
 * a test cannot portably manufacture a dead pid, because every number it might
 * pick is one the runner's own machine may be using. A table the test writes
 * is a world the question can be asked about.
 */
function processTable(pids: readonly number[]): (pid: number) => boolean {
  return (pid) => pids.includes(pid);
}

describe("whether the process behind a hold is still there", () => {
  it("calls a holder whose process answers alive", () => {
    expect(
      holderLiveness(holderOf(), {
        processIsRunning: processTable([4213]),
        thisHost: () => "fvermaut-mac",
      }),
    ).toBe("alive");
  });

  it("calls a holder whose pid the OS does not know gone", () => {
    expect(
      holderLiveness(holderOf(), {
        processIsRunning: processTable([]),
        thisHost: () => "fvermaut-mac",
      }),
    ).toBe("gone");
  });

  it("cannot answer for a holder on another machine, and says so rather than gone", () => {
    // The third answer is the point of the case. This machine's pid table says
    // nothing about a pid on another host, so `gone` would be a guess — and it
    // is the guess that reclaims another machine's live run. Timone runs one
    // daemon on one machine today, which is exactly why the wrong default
    // would not be noticed until the day it stops being true.
    expect(
      holderLiveness(holderOf({ host: "some-other-box", pid: 4213 }), {
        processIsRunning: processTable([4213]),
        thisHost: () => "fvermaut-mac",
      }),
    ).toBe("unknown");
  });

  it("reads a holder that recorded no host as this machine's", () => {
    // Every lock and every ledger written before the field existed has none,
    // and all of them were written here.
    expect(
      holderLiveness(holderOf({ host: undefined }), {
        processIsRunning: processTable([]),
        thisHost: () => "fvermaut-mac",
      }),
    ).toBe("gone");
  });
});
