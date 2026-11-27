import { describe, expect, it } from "vitest";

import { oauthContinuation } from "./oauth-continuation";

describe("OAuth sign-in continuation", () => {
  it("returns only the exact local consent path", () => {
    const path = "/oauth/consent/1234567890abcdef";
    expect(oauthContinuation("?continue=" + encodeURIComponent(path))).toBe(
      path,
    );
    for (const value of [
      "//example.test/oauth/consent/1234567890abcdef",
      "/oauth/consent/../account",
      path + "?extra=1",
      "https://example.test" + path,
      "/oauth/consent/short",
    ]) {
      expect(
        oauthContinuation("?continue=" + encodeURIComponent(value)),
      ).toBeUndefined();
    }
  });
});
