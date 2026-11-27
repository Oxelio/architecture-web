import { generateKeyPairSync, randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { loadOAuthOptions } from "./oauth.config.js";

function fixture() {
  const secret = () => randomBytes(32).toString("base64url");
  const pair = generateKeyPairSync("ec", { namedCurve: "P-256" });
  return {
    issuer: "https://issuer.example.test",
    cookieKeys: [secret(), secret()],
    artifactKeys: [secret()],
    bindingKeys: [secret()],
    jwks: {
      keys: [
        {
          ...pair.privateKey.export({ format: "jwk" }),
          kid: "issuer-key",
          use: "sig",
          alg: "ES256",
        },
      ],
    },
  };
}

describe("delegated OAuth deployment settings", () => {
  it("loads the configured HTTPS authority and independent rings with active keys first", () => {
    const options = fixture();
    const parsed = loadOAuthOptions(JSON.stringify(options), true);
    expect(parsed?.trustProxy).toBe(true);
    expect(parsed?.issuer).toBe(options.issuer);
    expect(parsed?.cookieKeys).toEqual(options.cookieKeys);
    expect(parsed?.artifactKeys).toEqual(
      options.artifactKeys.map((key) => Buffer.from(key, "base64url")),
    );
    expect(loadOAuthOptions(undefined, false)).toBeUndefined();
  });

  it("rejects malformed or unsafe configuration with a secret-free error", () => {
    const options = fixture();
    const weakConfigurations = [
      "{",
      JSON.stringify({ ...options, issuer: "http://issuer.example.test" }),
      JSON.stringify({
        ...options,
        issuer: "https://issuer.example.test/path",
      }),
      JSON.stringify({ ...options, artifactKeys: options.cookieKeys }),
      JSON.stringify({ ...options, artifactKeys: ["short-key"] }),
      JSON.stringify({ ...options, jwks: { keys: [] } }),
    ];
    for (const raw of weakConfigurations) {
      expect(() => loadOAuthOptions(raw, false)).toThrow(
        /^Invalid delegated OAuth configuration$/u,
      );
    }
  });
});
