import { describe, expect, it, vi } from "vitest";

import { securityInternals } from "./security.service.js";
import {
  DEFAULT_SECURITY_POLICY,
  SECURITY_CONFIG_CATALOG,
} from "./security-policy.js";

describe("security policy", () => {
  it("accepts the safe default policy", () => {
    expect(securityInternals.validatePolicy(DEFAULT_SECURITY_POLICY)).toEqual(
      DEFAULT_SECURITY_POLICY,
    );
  });

  it("rejects incoherent MFA and password policies", () => {
    expect(() =>
      securityInternals.validatePolicy({
        ...DEFAULT_SECURITY_POLICY,
        authentication: {
          ...DEFAULT_SECURITY_POLICY.authentication,
          mfaAvailable: false,
          mfaRequiredRoles: ["admin"],
        },
      }),
    ).toThrow("CONFIG_INVALID");
    expect(() =>
      securityInternals.validatePolicy({
        ...DEFAULT_SECURITY_POLICY,
        passwords: {
          ...DEFAULT_SECURITY_POLICY.passwords,
          privilegedMinLength: 10,
        },
      }),
    ).toThrow("CONFIG_INVALID");
  });

  it("rejects values whose runtime types do not match the catalog", () => {
    expect(() =>
      securityInternals.validatePolicy({
        ...DEFAULT_SECURITY_POLICY,
        accounts: {
          ...DEFAULT_SECURITY_POLICY.accounts,
          publicRegistration: "false",
        },
      }),
    ).toThrow("CONFIG_INVALID");
  });

  it("derives each catalog category from its policy key", () => {
    for (const option of SECURITY_CONFIG_CATALOG) {
      expect(option.key.startsWith(`${option.category}.`)).toBe(true);
    }
  });
});

describe("security primitives", () => {
  it("validates an RFC 6238 TOTP with the configured six digits", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(59_000));
    expect(
      securityInternals.verifyTotp(
        "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
        "287082",
      ),
    ).toBe(1);
    vi.useRealTimers();
  });

  it("removes sensitive metadata recursively", () => {
    expect(
      securityInternals.redact({
        result: "success",
        password: "never",
        nested: { sessionToken: "never", reason: "manual" },
      }),
    ).toEqual({ result: "success", nested: { reason: "manual" } });
  });

  it("creates a portable ZIP without adding unrelated values", () => {
    const archive = securityInternals.createZip({
      "manifest.json": '{"version":1}',
    });
    expect(archive.readUInt32LE(0)).toBe(0x04034b50);
    expect(archive.includes(Buffer.from("manifest.json"))).toBe(true);
    expect(archive.includes(Buffer.from("password_hash"))).toBe(false);
  });
});
