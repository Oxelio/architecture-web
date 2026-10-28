import {
  DEFAULT_SECURITY_POLICY,
  parseSecurityPolicy,
} from "@architecture/iam/domain";
import { describe, expect, it, vi } from "vitest";

import { NodeAccountArchiveAdapter } from "./node-account-archive.adapter.js";
import { NodeMfaCryptographyAdapter } from "./node-mfa-cryptography.adapter.js";
describe("security primitives", () => {
  it("accepts a complete valid configuration and rejects inconsistent runtime values", () => {
    expect(parseSecurityPolicy(DEFAULT_SECURITY_POLICY).success).toBe(true);
    expect(
      parseSecurityPolicy({
        ...DEFAULT_SECURITY_POLICY,
        accounts: {
          ...DEFAULT_SECURITY_POLICY.accounts,
          publicRegistration: "false",
        },
      }).success,
    ).toBe(false);
    expect(
      parseSecurityPolicy({
        ...DEFAULT_SECURITY_POLICY,
        authentication: {
          ...DEFAULT_SECURITY_POLICY.authentication,
          mfaAvailable: false,
          mfaRequiredRoles: ["admin"],
        },
      }).success,
    ).toBe(false);
  });
  it("verifies RFC 6238 TOTP and authenticates sealed secrets", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(59000));
    const crypto = new NodeMfaCryptographyAdapter("test-key");
    expect(
      crypto.verifyTotp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", "287082"),
    ).toBe(1);
    const sealed = crypto.seal("secret");
    expect(crypto.open(sealed)).toBe("secret");
    expect(() =>
      new NodeMfaCryptographyAdapter("different-key").open(sealed),
    ).toThrow();
    vi.useRealTimers();
  });
  it("creates a portable ZIP from only explicitly supplied data", () => {
    const bytes = Buffer.from(
      new NodeAccountArchiveAdapter().build({
        "manifest.json": '{"version":2}',
      }),
    );
    expect(bytes.readUInt32LE(0)).toBe(0x04034b50);
    expect(bytes.includes(Buffer.from("manifest.json"))).toBe(true);
  });
});
