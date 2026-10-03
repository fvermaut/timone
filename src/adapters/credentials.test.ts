import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  githubAppCredentials,
  type MintCall,
  type MintRequest,
} from "./credentials.js";

/**
 * A real RSA key, generated once per file. The provider signs with it for
 * real — a fake signer would leave the one thing GitHub actually checks
 * untested, and RS256 over a 2048-bit key costs milliseconds.
 */
const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

let dir: string;
let keyPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "timone-credentials-"));
  keyPath = join(dir, "app.private-key.pem");
  writeFileSync(keyPath, privateKey, { mode: 0o600 });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** A recording mint seam that answers with a token nobody has to guess at. */
function recorder(
  answer: (request: MintRequest, index: number) => {
    token: string;
    expiresAt: string;
  } = (_request, index) => ({
    token: `ghs_token_${index}`,
    expiresAt: "2026-08-22T14:00:00Z",
  }),
): { mint: MintCall; calls: MintRequest[] } {
  const calls: MintRequest[] = [];
  const mint: MintCall = async (request) => {
    calls.push(request);
    return answer(request, calls.length - 1);
  };
  return { mint, calls };
}

function provider(
  mint: MintCall,
  now: () => Date = () => new Date("2026-08-22T12:00:00Z"),
) {
  return githubAppCredentials({
    appId: 4670926,
    installationId: 155426497,
    privateKeyPath: keyPath,
    mint,
    now,
  });
}

describe("a credential scoped to one repository", () => {
  it("names the one repository it is for, and nothing else", async () => {
    const { mint, calls } = recorder();

    await provider(mint).tokenFor("fvermaut/scratch-app");

    expect(calls).toHaveLength(1);
    expect(calls[0].repositories).toEqual(["scratch-app"]);
  });

  it("asks the installation whose id it was given", async () => {
    const { mint, calls } = recorder();

    await provider(mint).tokenFor("fvermaut/scratch-app");

    expect(calls[0].url).toBe(
      "https://api.github.com/app/installations/155426497/access_tokens",
    );
  });

  it("mints once per repository, never one token reused across projects", async () => {
    const { mint, calls } = recorder();
    const credentials = provider(mint);

    const first = await credentials.tokenFor("fvermaut/scratch-app");
    const second = await credentials.tokenFor("fvermaut/ivtrends");

    expect(calls.map((call) => call.repositories)).toEqual([
      ["scratch-app"],
      ["ivtrends"],
    ]);
    expect(second).not.toBe(first);
  });

  it("reuses a live token rather than minting per call", async () => {
    const { mint, calls } = recorder();
    const credentials = provider(mint);

    const first = await credentials.tokenFor("fvermaut/scratch-app");
    const second = await credentials.tokenFor("fvermaut/scratch-app");

    expect(calls).toHaveLength(1);
    expect(second).toBe(first);
  });

  it("mints again once the cached token is close enough to expiry", async () => {
    const { mint, calls } = recorder();
    let clock = new Date("2026-08-22T12:00:00Z");
    const credentials = provider(mint, () => clock);

    await credentials.tokenFor("fvermaut/scratch-app");
    // The answer above expires at 14:00; 13:59 is inside the safety margin.
    clock = new Date("2026-08-22T13:59:00Z");
    await credentials.tokenFor("fvermaut/scratch-app");

    expect(calls).toHaveLength(2);
  });
});

describe("a token that must live a given time", () => {
  it("mints again when the cached token would die before the life asked for", async () => {
    // PRD-06.R5. On 6 September a box was handed a cached token with about
    // 13 minutes left. Its next token came 20 minutes later, and the session
    // waited 12.5 minutes without one.
    const { mint, calls } = recorder((_request, index) =>
      index === 0
        ? { token: "ghs_first", expiresAt: "2026-08-22T13:00:00Z" }
        : { token: "ghs_second", expiresAt: "2026-08-22T13:35:00Z" },
    );
    let clock = new Date("2026-08-22T12:00:00Z");
    const credentials = provider(mint, () => clock);

    await credentials.tokenFor("fvermaut/scratch-app");
    // 25 minutes before the first token dies.
    clock = new Date("2026-08-22T12:35:00Z");
    const asked = await credentials.tokenFor("fvermaut/scratch-app", {
      minLifeMs: 35 * 60 * 1000,
    });
    const after = await credentials.tokenFor("fvermaut/scratch-app");

    expect(asked).toBe("ghs_second");
    // The new token is the one kept: the next caller gets it too.
    expect(after).toBe("ghs_second");
    expect(calls).toHaveLength(2);
  });

  it("still reuses a token with 25 minutes left when no life is asked for", async () => {
    // The machine's own calls outside any box use the token at once, so
    // 25 minutes is plenty for them, and minting each time would cost a
    // request for nothing.
    const { mint, calls } = recorder((_request, index) =>
      index === 0
        ? { token: "ghs_first", expiresAt: "2026-08-22T13:00:00Z" }
        : { token: "ghs_second", expiresAt: "2026-08-22T13:35:00Z" },
    );
    let clock = new Date("2026-08-22T12:00:00Z");
    const credentials = provider(mint, () => clock);

    await credentials.tokenFor("fvermaut/scratch-app");
    clock = new Date("2026-08-22T12:35:00Z");
    const again = await credentials.tokenFor("fvermaut/scratch-app");

    expect(again).toBe("ghs_first");
    expect(calls).toHaveLength(1);
  });
});

describe("the assertion it signs", () => {
  it("is an RS256 JWT issued by the app, expiring within ten minutes", async () => {
    const { mint, calls } = recorder();

    await provider(mint).tokenFor("fvermaut/scratch-app");

    const [rawHeader, rawPayload, signature] = calls[0].jwt.split(".");
    const header = JSON.parse(
      Buffer.from(rawHeader, "base64url").toString("utf8"),
    );
    const payload = JSON.parse(
      Buffer.from(rawPayload, "base64url").toString("utf8"),
    );

    expect(header).toEqual({ alg: "RS256", typ: "JWT" });
    expect(payload.iss).toBe("4670926");
    expect(signature.length).toBeGreaterThan(0);

    const issuedAt = Math.floor(Date.parse("2026-08-22T12:00:00Z") / 1000);
    // Issued a little in the past: GitHub rejects a clock that runs fast.
    expect(payload.iat).toBeLessThan(issuedAt);
    expect(payload.exp - payload.iat).toBeLessThanOrEqual(600);
  });
});

describe("failing loudly", () => {
  it("names the key file when it cannot be read", async () => {
    const { mint } = recorder();
    const credentials = githubAppCredentials({
      appId: 4670926,
      installationId: 155426497,
      privateKeyPath: join(dir, "absent.pem"),
      mint,
    });

    await expect(credentials.tokenFor("fvermaut/scratch-app")).rejects.toThrow(
      /absent\.pem/,
    );
  });

  it("refuses a repository it cannot reduce to owner and name", async () => {
    const { mint, calls } = recorder();

    await expect(provider(mint).tokenFor("scratch-app")).rejects.toThrow(
      /scratch-app/,
    );
    expect(calls).toHaveLength(0);
  });
});
